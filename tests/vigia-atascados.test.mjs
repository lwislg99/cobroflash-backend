// El vigía de PR atascados — SCRUM-840.
//
// Vigila una PROMESA ROTA, no el paso del tiempo: PR en los que la automatización dijo que
// haría algo y no lo hizo. Este fichero ejerce las tres decisiones que lo sostienen —a quién
// mira, por qué está atascado, y cuándo merece la pena avisar— más su suelo.
//
// SIN GATE: funciones puras. Ni BD, ni red, ni servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  esAsuntoDelVigia, causaDelAtasco, haEmpeorado, sueloDeLaPasada, horasDesde, validarSonda, GRACIA_MINUTOS,
  ETIQUETA_NO_MERGEAR, BOT,
} from '../scripts/vigia-atascados.mjs';

// El meta-guard de la casa ejecuta esto: si el vigía dejara de distinguir «sin checks» de
// «esperando», su clasificación seguiría pareciendo correcta y el #1212 volvería a ser
// invisible. La mutación imita ese defecto exacto.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: "    return { causa: 'SIN-CHECKS', detalle: 'ningún check ha arrancado sobre el head actual: el auto-merge no se disparará nunca' };",
    a: "    return { causa: 'ESPERANDO', detalle: 'apagado a propósito por la mutación' };",
    cae: 'SIN-CHECKS es una causa PROPIA, no «esperando»',
  },
  // SCRUM-839b · las tres cosas que se construyen aquí, cada una con el defecto exacto que la anula.
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: '      const bloquean = rojos.filter((n) => obs.obligatorios.includes(n));',
    a: '      const bloquean = [];',
    cae: '🔴 CEBO REAL #1205 · su obligatorio en FAILURE desde el 8-sep → ROJO-OBLIGATORIO, no ESPERANDO',
  },
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: '    .filter((p) => previo.has(p.numero) && Number(p.umbral || 0) > Number(previo.get(p.numero).umbral || 0))',
    a: '    .filter(() => false)',
    cae: '🔴 CEBO REAL #1212 · con la memoria REAL del issue #1241 vuelve a avisar por edad',
  },
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: "export const IDENTIDADES_BOT = [BOT, 'app/yaqu-bot'];",
    a: 'export const IDENTIDADES_BOT = [BOT];',
    cae: '🔴 `gh pr list` devuelve al bot como `app/yaqu-bot`: tiene que contar como el bot',
  },
  {
    fichero: 'scripts/vigia-atascados.mjs',
    de: '    .filter((p) => !seArreglaEsperando(p.causa) || Number(p.umbral || 0) > 0);',
    a: '    .filter(() => true);',
    cae: '🔴 CONTROL NEGATIVO REAL #1259 · recién empujado CON checks corriendo: ESPERANDO, y NO avisa',
  },
];

// ── A QUIÉN MIRA ──────────────────────────────────────────────────────────────────────────

test('auto-merge armado → lo vigila (la máquina prometió mergearlo)', () => {
  const r = esAsuntoDelVigia({ autor: 'quien-sea', autoMerge: true });
  assert.equal(r.vigilar, true);
  assert.match(r.porque, /prometi/);
});

test('lo abrió el bot y no llegó a armar → lo vigila (es el caso del #1190)', () => {
  assert.equal(esAsuntoDelVigia({ autor: BOT, autoMerge: false }).vigilar, true);
});

test('🔴 PR de una persona SIN auto-merge → NO lo vigila, y dice por qué', () => {
  // Es el descarte que hace que el vigía sobreviva: el 9-sep eran 14 de 18 PR abiertos, de 36
  // a 858 horas. Contarlos daría catorce líneas en cada pasada, para siempre.
  const r = esAsuntoDelVigia({ autor: 'Javierpf28', autoMerge: false });
  assert.equal(r.vigilar, false);
  assert.match(r.porque, /backlog, no atasco/);
});

test('draft → no lo vigila', () => {
  assert.equal(esAsuntoDelVigia({ autor: BOT, autoMerge: true, draft: true }).vigilar, false);
});

test('la ETIQUETA gana al título: `no-mergear` lo saca del censo', () => {
  // Etiqueta y no título a propósito: un título es texto libre y cambia sin que nadie lo note.
  const r = esAsuntoDelVigia({ autor: BOT, autoMerge: true, etiquetas: ['algo', ETIQUETA_NO_MERGEAR] });
  assert.equal(r.vigilar, false);
  assert.match(r.porque, new RegExp(ETIQUETA_NO_MERGEAR));
});

test('la etiqueta se compara sin importar mayúsculas', () => {
  assert.equal(esAsuntoDelVigia({ autor: BOT, autoMerge: true, etiquetas: ['NO-MERGEAR'] }).vigilar, false);
});

// ── POR QUÉ ESTÁ ATASCADO ────────────────────────────────────────────────────────────────

test('🔴 SIN-CHECKS es una causa PROPIA, no «esperando»', () => {
  // La tercera categoría, y la que bloqueaba de verdad: el #1212 tenía CERO check-runs sobre
  // su head. No es dirty ni behind — es que el auto-merge no se va a disparar nunca.
  const r = causaDelAtasco({ estado: 'UNKNOWN', checks: 0 });
  assert.equal(r.causa, 'SIN-CHECKS');
  assert.match(r.detalle, /nunca/);
});

test('sin checks manda sobre el estado del merge', () => {
  // Aunque el estado dijera DIRTY, sin checks no hay nada que esperar: la causa es ésa.
  assert.equal(causaDelAtasco({ estado: 'DIRTY', checks: 0 }).causa, 'SIN-CHECKS');
});

test('las otras dos causas, separadas', () => {
  assert.equal(causaDelAtasco({ estado: 'DIRTY', checks: 5 }).causa, 'DIRTY');
  assert.equal(causaDelAtasco({ estado: 'BEHIND', checks: 5 }).causa, 'BEHIND');
});

test('🔴 `unknown` NO es limpio: es SIN-ESTADO', () => {
  // Medido: llegó unknown en 3 de 4 PR del bot el 9-sep y en 13 de 16 el 8-sep. Leerlo como
  // «no hay conflicto» sería el cero de instrumento ciego.
  assert.equal(causaDelAtasco({ estado: 'UNKNOWN', checks: 5 }).causa, 'SIN-ESTADO');
  assert.equal(causaDelAtasco({ estado: '', checks: 5 }).causa, 'SIN-ESTADO');
  assert.equal(causaDelAtasco({ checks: 5 }).causa, 'SIN-ESTADO');
});

test('un estado sano con checks corriendo es ESPERANDO, no un atasco nuevo', () => {
  assert.equal(causaDelAtasco({ estado: 'UNSTABLE', checks: 5 }).causa, 'ESPERANDO');
});

// ── CUÁNDO MERECE LA PENA AVISAR ─────────────────────────────────────────────────────────

test('un PR nuevo en la lista EMPEORA', () => {
  // SCRUM-839b: con una causa que NO se arregla esperando. Un BEHIND recién llegado ya no avisa al
  // entrar —avisa por edad—: el laboratorio con datos reales lo pilló avisando de un PR empujado
  // hacía un minuto. Ver «CONTROL NEGATIVO REAL #1259».
  const r = haEmpeorado([{ numero: 1, causa: 'DIRTY' }], [{ numero: 1, causa: 'DIRTY' }, { numero: 2, causa: 'DIRTY' }]);
  assert.equal(r.empeora, true);
  assert.deepEqual(r.nuevos, [2]);
});

test('cambiar de causa EMPEORA (behind → dirty no es lo mismo)', () => {
  const r = haEmpeorado([{ numero: 1, causa: 'BEHIND' }], [{ numero: 1, causa: 'DIRTY' }]);
  assert.equal(r.empeora, true);
  assert.deepEqual(r.cambiados, [1]);
});

test('🔴 la MISMA lista NO empeora: se reescribe el cuerpo y no se comenta', () => {
  // Un comentario por pasada es ruido, y el ruido se silencia el primer día.
  const misma = [{ numero: 1, causa: 'DIRTY' }, { numero: 2, causa: 'SIN-CHECKS' }];
  assert.equal(haEmpeorado(misma, misma).empeora, false);
});

test('que un PR se DESATASQUE no es empeorar', () => {
  assert.equal(haEmpeorado([{ numero: 1, causa: 'DIRTY' }, { numero: 2, causa: 'BEHIND' }], [{ numero: 1, causa: 'DIRTY' }]).empeora, false);
});

// ── EL SUELO ─────────────────────────────────────────────────────────────────────────────

test('🔴 el suelo de la pasada reconoce su cebo', () => {
  const s = sueloDeLaPasada();
  assert.equal(s.ok, true, 'si el suelo no reconoce su propio cebo, un cero de esa pasada no vale');
  assert.match(s.detalle, /suelo OK/);
});

test('🔴 y el suelo sabe DECIR que está roto, no solo que está bien', () => {
  // Un suelo que solo sabe decir «OK» es el mismo instrumento ciego que viene a impedir.
  // Se comprueba que el mensaje de rotura existe y nombra la consecuencia.
  const fuente = sueloDeLaPasada.toString();
  assert.match(fuente, /SUELO ROTO/);
  assert.match(fuente, /NO significa que no haya atascados/);
});

// ── LA MEDIDA DEL TIEMPO ─────────────────────────────────────────────────────────────────

test('horasDesde mide, y dice NO SÉ en vez de inventar un cero', () => {
  const ahora = Date.parse('2026-09-09T12:00:00Z');
  assert.equal(horasDesde('2026-09-09T09:00:00Z', ahora), 3);
  assert.equal(horasDesde('no es una fecha', ahora), null, 'una fecha ilegible no es «hace 0 horas»');
  assert.equal(horasDesde(undefined, ahora), null);
});

// ── QUE EL WORKFLOW SIGA USANDO ESTO ─────────────────────────────────────────────────────
// Un clasificador correcto que el workflow no invoca no protege de nada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WF = path.join(REPO, '.github', 'workflows', 'vigia-atascados.yml');
const PASADA = path.join(REPO, 'scripts', 'vigia-pasada.mjs');

test('el workflow llama a la pasada, y la pasada usa el suelo y el espejo', () => {
  const yml = fs.readFileSync(WF, 'utf8');
  assert.match(yml, /scripts\/vigia-pasada\.mjs/, 'el workflow debe delegar la decisión');
  const p = fs.readFileSync(PASADA, 'utf8');
  assert.match(p, /sueloDeLaPasada/, 'sin suelo, un cero no se distingue de no saber mirar');
  assert.match(p, /cuerpoNoDebeDespertar/, 'el cuerpo lleva títulos ajenos: hay que comprobarlo');
});

test('🔴 el vigía NO usa la llave de la App: su token no debe crear ejecuciones', () => {
  const soloCodigo = fs.readFileSync(WF, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.ok(!/create-github-app-token/.test(soloCodigo),
    'con la llave de la App sus comentarios podrían despertar workflows; aquí se quiere lo contrario');
  assert.match(soloCodigo, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
});

test('comenta solo al empeorar: el camino de «sin cambios» existe y no comenta', () => {
  const yml = fs.readFileSync(WF, 'utf8');
  assert.match(yml, /SIN CAMBIOS A PEOR/, 'tiene que haber una salida que reescribe sin notificar');
});

// ── SCRUM-839 · FASE 1: DETECTAR EL CONFLICTO, CON DOS SONDAS Y CON GRACIA ────────────────
//
// La señal de este ticket NO es «está rojo»: un PR en conflicto se queda SIN COLOR, y por eso
// el avisador de rojos no lo ve y nadie lo despierta. Son dos ausencias —conflicto y cero
// checks— y por eso el suelo importa más que de costumbre.

test('🔴 la GRACIA: cero checks recién empujado NO es un atasco', () => {
  // Sin esto, cada push sale como atascado durante un rato y el vigía se vuelve ruido.
  const r = causaDelAtasco({ estado: 'UNKNOWN', checks: 0, minutosDesdePush: 2 });
  assert.equal(r.causa, 'RECIEN-EMPUJADO');
  assert.match(r.detalle, /gracia/);
});

test('pasada la gracia, cero checks SÍ es SIN-CHECKS', () => {
  assert.equal(causaDelAtasco({ estado: 'UNKNOWN', checks: 0, minutosDesdePush: GRACIA_MINUTOS }).causa, 'SIN-CHECKS');
  assert.equal(causaDelAtasco({ estado: 'UNKNOWN', checks: 0, minutosDesdePush: 240 }).causa, 'SIN-CHECKS');
});

test('sin dato de minutos NO se regala la gracia', () => {
  // No saber cuándo se empujó no es «se empujó hace un momento».
  assert.equal(causaDelAtasco({ estado: 'UNKNOWN', checks: 0 }).causa, 'SIN-CHECKS');
});

test('las dos sondas de acuerdo → DIRTY, y lo dice', () => {
  const r = causaDelAtasco({ estado: 'DIRTY', checks: 5, sondaConflicto: true });
  assert.equal(r.causa, 'DIRTY');
  assert.match(r.detalle, /CONFIRMADO por las dos sondas/);
});

test('🔴 la sonda ve conflicto y el campo no → DISCREPA, no se elige en silencio', () => {
  // Es el caso real: `mergeStateStatus` se calcula en diferido y la primera lectura da UNKNOWN.
  const r = causaDelAtasco({ estado: 'UNKNOWN', checks: 5, sondaConflicto: true });
  assert.equal(r.causa, 'CONFLICTO-DISCREPA');
  assert.match(r.detalle, /merge-tree/);
});

test('🔴 el campo dice DIRTY y la sonda dice limpio → también DISCREPA', () => {
  const r = causaDelAtasco({ estado: 'DIRTY', checks: 5, sondaConflicto: false });
  assert.equal(r.causa, 'CONFLICTO-DISCREPA');
});

test('sin segunda sonda, el campo sigue mandando y se dice que faltaba', () => {
  const r = causaDelAtasco({ estado: 'DIRTY', checks: 5, sondaConflicto: null });
  assert.equal(r.causa, 'DIRTY');
  assert.match(r.detalle, /segunda sonda no disponible/);
});

// ── EL CONTROL DE LA SONDA, QUE VA ANTES DE USARLA ───────────────────────────────────────

test('🔴 validarSonda acepta una sonda que compara algo consigo mismo y da 0', () => {
  assert.equal(validarSonda(() => 0).valida, true);
});

test('🔴 y RECHAZA una sonda que dice conflicto siempre', () => {
  // Una sonda así marcaría conflicto en todo y parecería que funciona. Es el control que el
  // orquestador pidió porque su primera versión daba 1 y no valía nada.
  const r = validarSonda(() => 1);
  assert.equal(r.valida, false);
  assert.match(r.motivo, /consigo mismo/);
});

test('🔴 y RECHAZA una sonda que no se puede ejecutar', () => {
  assert.equal(validarSonda(() => { throw new Error('no existe git'); }).valida, false);
});

test('🔴 RECIEN-EMPUJADO se DESCARTA de la lista, no se cuenta como atasco', () => {
  // Se vio al correr la pasada entera, no leyéndola: entraba en la tabla, y con eso cada push
  // haría «empeorar» el conjunto y dispararía un comentario. El vigía se silenciaría por su
  // propio ruido. Aquí se fija que la pasada lo saca de la lista DICIENDO por qué.
  const pasada = fs.readFileSync(PASADA, 'utf8');
  assert.match(pasada, /RECIEN-EMPUJADO'\s*\)\s*\{\s*descartados\.push/,
    'la pasada debe descartar RECIEN-EMPUJADO en vez de contarlo como atascado');
});

test('el workflow valida la sonda ANTES de usarla, y degrada si no pasa', () => {
  const yml = fs.readFileSync(WF, 'utf8');
  assert.match(yml, /merge-tree --write-tree origin\/main origin\/main/,
    'el control de la sonda es compararla consigo misma');
  assert.match(yml, /steps\.sonda\.outputs\.valida/,
    'y su resultado tiene que gobernar si la sonda se usa o no');
});

// ── SCRUM-839b · UN ATASCO QUE ENVEJECE VUELVE A AVISAR, Y EL ROJO OBLIGATORIO TIENE NOMBRE ─
//
// Medido el 15-sep-2026 a las 09:55Z: el issue #1241 llevaba seis días abierto con CERO
// comentarios, listando el #1212 (SIN-CHECKS, 144 h), el #1205 (ESPERANDO, 166 h) y el #1228
// (CONFLICTO-DISCREPA, 137 h). Dos agujeros:
//   · el vigía solo comentaba cuando el CONJUNTO empeoraba, y un atasco que no cambia de
//     tamaño sí empeora de EDAD;
//   · no tenía categoría para rojo: el #1205 tiene su único check obligatorio en FAILURE desde
//     el 8-sep y lo llamaba «esperando a que pase el check obligatorio». Sin push no pasa.
// Los cebos son las respuestas REALES de la API, recortadas a los campos que se usan.
import * as V from '../scripts/vigia-atascados.mjs';

// Medido el 15-sep-2026 ~09:55Z con la API pública, recortado a los campos que se usan.
// #1205 · head b3f2fba9 · empujado 2026-09-08T10:09:44Z
const CHECKS_1205 = [
  {
    id: 102021215787,
    name: "abrir-pr-y-armar-automerge",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-08T10:09:49Z",
    completed_at: "2026-09-08T10:10:00Z"
  },
  {
    id: 102021223163,
    name: "¿este PR toca la zona roja?",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-08T10:09:50Z",
    completed_at: "2026-09-08T10:10:03Z"
  },
  {
    id: 102021223224,
    name: "constancia del ALTER (informativo)",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-08T10:09:50Z",
    completed_at: "2026-09-08T10:10:17Z"
  },
  {
    id: 102021223379,
    name: "build + tests (con banco desechable)",
    status: "completed",
    conclusion: "failure",
    started_at: "2026-09-08T10:09:50Z",
    completed_at: "2026-09-08T10:14:50Z"
  },
  {
    id: 102021223490,
    name: "meta-guard · los guards caen cuando deben",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-08T10:09:50Z",
    completed_at: "2026-09-08T10:16:59Z"
  },
  {
    id: 102021223547,
    name: "vigía del despliegue (informativo)",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-08T10:09:52Z",
    completed_at: "2026-09-08T10:10:00Z"
  },
  {
    id: 102021223598,
    name: "guards de navegador (fuera de la tanda)",
    status: "completed",
    conclusion: "failure",
    started_at: "2026-09-08T10:09:51Z",
    completed_at: "2026-09-08T10:13:38Z"
  }
];

// #1248 · head 186b19a3 · MERGEADO con dos checks NO obligatorios en rojo
const CHECKS_1248 = [
  {
    id: 104326053544,
    name: "abrir-pr-y-armar-automerge",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-15T09:24:04Z",
    completed_at: "2026-09-15T09:24:30Z"
  },
  {
    id: 104326185375,
    name: "guards de navegador (fuera de la tanda)",
    status: "completed",
    conclusion: "failure",
    started_at: "2026-09-15T09:24:29Z",
    completed_at: "2026-09-15T09:28:08Z"
  },
  {
    id: 104326185383,
    name: "¿este PR toca la zona roja?",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-15T09:24:28Z",
    completed_at: "2026-09-15T09:24:35Z"
  },
  {
    id: 104326185606,
    name: "vigía del despliegue (informativo)",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-15T09:24:28Z",
    completed_at: "2026-09-15T09:24:40Z"
  },
  {
    id: 104326185655,
    name: "constancia del ALTER (informativo)",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-15T09:24:28Z",
    completed_at: "2026-09-15T09:24:54Z"
  },
  {
    id: 104326185760,
    name: "meta-guard · los guards caen cuando deben",
    status: "completed",
    conclusion: "failure",
    started_at: "2026-09-15T09:24:29Z",
    completed_at: "2026-09-15T09:31:26Z"
  },
  {
    id: 104326185779,
    name: "build + tests (con banco desechable)",
    status: "completed",
    conclusion: "success",
    started_at: "2026-09-15T09:24:28Z",
    completed_at: "2026-09-15T09:28:30Z"
  }
];

// GET /repos/lwislg99/cobroflash-backend/rules/branches/main
const REGLAS_MAIN = [
  {
    type: "deletion"
  },
  {
    type: "non_fast_forward"
  },
  {
    type: "pull_request"
  },
  {
    type: "required_status_checks",
    parameters: {
      required_status_checks: [
        {
          context: "build + tests (con banco desechable)"
        }
      ]
    }
  }
];

const OBLIGATORIO = 'build + tests (con banco desechable)';
const edadDesde = (iso, ahoraIso) => (Date.parse(ahoraIso) - Date.parse(iso)) / 3600e3;

// ── ② EL ROJO EN EL CHECK OBLIGATORIO ─────────────────────────────────────────────────────

test('la lista de obligatorios se DERIVA de las reglas vivas de main, no se escribe a mano', () => {
  assert.equal(typeof V.checksObligatoriosDeReglas, 'function', 'falta checksObligatoriosDeReglas');
  assert.deepEqual(V.checksObligatoriosDeReglas(REGLAS_MAIN), [OBLIGATORIO]);
});

test('🔴 SUELO de la lista: vacía, ilegible o sin regla NO es «nada es obligatorio»', () => {
  assert.equal(typeof V.checksObligatoriosDeReglas, 'function', 'falta checksObligatoriosDeReglas');
  assert.equal(V.checksObligatoriosDeReglas(null), null);
  assert.equal(V.checksObligatoriosDeReglas({ message: 'Not Found' }), null);
  assert.equal(V.checksObligatoriosDeReglas([{ type: 'deletion' }]), null);
  assert.equal(V.checksObligatoriosDeReglas([{ type: 'required_status_checks', parameters: { required_status_checks: [] } }]), null);
});

test('🔴 CEBO REAL #1205 · su obligatorio en FAILURE desde el 8-sep → ROJO-OBLIGATORIO, no ESPERANDO', () => {
  const r = causaDelAtasco({ estado: 'BLOCKED', checks: CHECKS_1205.length, checkRuns: CHECKS_1205, obligatorios: [OBLIGATORIO], sondaConflicto: false });
  assert.equal(r.causa, 'ROJO-OBLIGATORIO', `salió ${r.causa}: el vigía seguiría diciendo «esperando»`);
  assert.match(r.detalle, /build \+ tests \(con banco desechable\)/, 'tiene que nombrar el check que bloquea');
});

test('CEBO REAL #1248 · rojo SOLO en checks NO obligatorios → no es atasco rojo (y de hecho entró)', () => {
  const r = causaDelAtasco({ estado: 'UNSTABLE', checks: CHECKS_1248.length, checkRuns: CHECKS_1248, obligatorios: [OBLIGATORIO], sondaConflicto: false });
  assert.notEqual(r.causa, 'ROJO-OBLIGATORIO', 'guards de navegador y meta-guard en rojo no bloquean: el #1248 se mergeó');
  assert.equal(r.causa, 'ESPERANDO');
});

test('un obligatorio TODAVÍA CORRIENDO es ESPERANDO de verdad', () => {
  const runs = [{ id: 1, name: OBLIGATORIO, status: 'in_progress', conclusion: null }];
  assert.equal(causaDelAtasco({ estado: 'BLOCKED', checks: 1, checkRuns: runs, obligatorios: [OBLIGATORIO] }).causa, 'ESPERANDO');
});

test('🔴 manda la ÚLTIMA ejecución de cada check (por id), no la primera que aparezca', () => {
  const rojoViejoVerdeNuevo = [
    { id: 10, name: OBLIGATORIO, status: 'completed', conclusion: 'failure' },
    { id: 11, name: OBLIGATORIO, status: 'completed', conclusion: 'success' },
  ];
  assert.equal(causaDelAtasco({ estado: 'BLOCKED', checks: 2, checkRuns: rojoViejoVerdeNuevo, obligatorios: [OBLIGATORIO] }).causa, 'ESPERANDO',
    'un fallo relanzado en verde ya no bloquea');
  const verdeViejoRojoNuevo = [
    { id: 10, name: OBLIGATORIO, status: 'completed', conclusion: 'success' },
    { id: 11, name: OBLIGATORIO, status: 'completed', conclusion: 'failure' },
  ];
  assert.equal(causaDelAtasco({ estado: 'BLOCKED', checks: 2, checkRuns: verdeViejoRojoNuevo, obligatorios: [OBLIGATORIO] }).causa, 'ROJO-OBLIGATORIO');
});

test('🔴 sin lista de obligatorios y con algo en rojo → ROJO-SIN-LISTA, no ESPERANDO', () => {
  const r = causaDelAtasco({ estado: 'BLOCKED', checks: CHECKS_1205.length, checkRuns: CHECKS_1205, obligatorios: null });
  assert.equal(r.causa, 'ROJO-SIN-LISTA', 'no poder leer qué bloquea no es poder decir que espera');
});

test('sin datos de checks el clasificador se comporta como antes (no inventa rojo)', () => {
  assert.equal(causaDelAtasco({ estado: 'UNSTABLE', checks: 5 }).causa, 'ESPERANDO');
});

test('el conflicto sigue mandando sobre el rojo: resolverlo empuja y relanza CI', () => {
  const r = causaDelAtasco({ estado: 'DIRTY', checks: 7, checkRuns: CHECKS_1205, obligatorios: [OBLIGATORIO], sondaConflicto: true });
  assert.equal(r.causa, 'DIRTY');
});

// ── ① UN ATASCO QUE ENVEJECE ──────────────────────────────────────────────────────────────

test('los umbrales de edad: 24 h, 72 h, 168 h y después cada semana', () => {
  assert.equal(typeof V.umbralDeEdad, 'function', 'falta umbralDeEdad');
  const tabla = [[0, 0], [23.9, 0], [24, 24], [71.9, 24], [72, 72], [167.9, 72], [168, 168], [335.9, 168], [336, 336], [503.9, 336], [504, 504]];
  for (const [h, u] of tabla) assert.equal(V.umbralDeEdad(h), u, `${h} h → umbral ${u}`);
});

test('🔴 edad desconocida NO cuenta como vieja ni dispara aviso por edad', () => {
  assert.equal(typeof V.umbralDeEdad, 'function', 'falta umbralDeEdad');
  for (const x of [null, undefined, NaN, -5]) assert.equal(V.umbralDeEdad(x), 0, String(x));
});

test('🔴 CEBO REAL #1212 · con la memoria REAL del issue #1241 vuelve a avisar por edad', () => {
  // Memoria literal del cuerpo del #1241 el 15-sep: no guardaba umbral porque el vigía no lo tenía.
  const antes = [{ numero: 1205, causa: 'ESPERANDO' }, { numero: 1212, causa: 'SIN-CHECKS' }, { numero: 1228, causa: 'CONFLICTO-DISCREPA' }];
  const edad = edadDesde('2026-09-09T08:04:46Z', '2026-09-15T09:55:03Z'); // push real → PASO 0
  const u = typeof V.umbralDeEdad === 'function' ? V.umbralDeEdad(edad) : 0;
  const ahora = [
    { numero: 1205, causa: 'ESPERANDO', umbral: 0 },
    { numero: 1212, causa: 'SIN-CHECKS', umbral: u },
    { numero: 1228, causa: 'CONFLICTO-DISCREPA', umbral: 0 },
  ];
  const r = haEmpeorado(antes, ahora);
  assert.equal(r.empeora, true, `${Math.round(edad)} h y ni un aviso: tiene que avisar`);
  assert.deepEqual(r.envejecidos, [{ numero: 1212, umbral: 72 }], 'el #1212 cruzó 72 h sin que nadie lo dijera');
});

test('🔴 CONTROL NEGATIVO · mismo atasco, sin cruzar umbral → SILENCIO', () => {
  const antes = [{ numero: 1212, causa: 'SIN-CHECKS', umbral: 72 }];
  const ahora = [{ numero: 1212, causa: 'SIN-CHECKS', umbral: 72 }]; // de 146 h a 150 h
  assert.equal(haEmpeorado(antes, ahora).empeora, false, 'cuatro horas más no merecen un aviso: eso era el ruido');
});

test('🔴 y al cruzar el SIGUIENTE umbral vuelve a avisar', () => {
  const r = haEmpeorado([{ numero: 1212, causa: 'SIN-CHECKS', umbral: 72 }], [{ numero: 1212, causa: 'SIN-CHECKS', umbral: 168 }]);
  assert.equal(r.empeora, true);
  assert.deepEqual(r.envejecidos, [{ numero: 1212, umbral: 168 }]);
});

test('un PR que se MUEVE (push nuevo) baja de umbral, y eso no es empeorar', () => {
  assert.equal(haEmpeorado([{ numero: 1, causa: 'DIRTY', umbral: 72 }], [{ numero: 1, causa: 'DIRTY', umbral: 0 }]).empeora, false);
});

test('🔴 CONTROL NEGATIVO · un PR recién empujado no avisa, ni por atasco ni por edad', () => {
  assert.equal(causaDelAtasco({ estado: 'UNKNOWN', checks: 0, minutosDesdePush: 3 }).causa, 'RECIEN-EMPUJADO', 'la gracia sigue valiendo');
  assert.equal(typeof V.umbralDeEdad, 'function', 'falta umbralDeEdad');
  assert.equal(V.umbralDeEdad(3 / 60), 0);
});

// ── LA IDENTIDAD DEL BOT, MEDIDA EN EL PROPIO ISSUE ───────────────────────────────────────

test('🔴 `gh pr list` devuelve al bot como `app/yaqu-bot`: tiene que contar como el bot', () => {
  // Columna «autor» del #1241, literal. Comparar solo con `yaqu-bot[bot]` no casaba nunca con
  // datos reales: un PR del bot SIN auto-merge (el caso #1190) no habría salido jamás.
  assert.equal(esAsuntoDelVigia({ autor: 'app/yaqu-bot', autoMerge: false }).vigilar, true);
});

test('y una cuenta que solo se le parece NO', () => {
  assert.equal(esAsuntoDelVigia({ autor: 'yaqu-bot', autoMerge: false }).vigilar, false);
});

// ── EL SUELO Y EL CABLEADO ────────────────────────────────────────────────────────────────

test('🔴 el suelo ejerce también el rojo obligatorio y la edad, no solo el DIRTY', () => {
  assert.equal(sueloDeLaPasada().ok, true);
  const f = sueloDeLaPasada.toString();
  assert.match(f, /ROJO-OBLIGATORIO/, 'si el rojo se rompe, un cero de rojos tiene que distinguirse de no saber mirar');
  assert.match(f, /umbralDeEdad/, 'y lo mismo para la edad');
});

test('la pasada lee reglas y checks, guarda el umbral y comprueba TAMBIÉN el aviso', () => {
  const p = fs.readFileSync(PASADA, 'utf8');
  assert.match(p, /reglas\.json/);
  assert.match(p, /checksObligatoriosDeReglas/);
  assert.match(p, /umbralDeEdad/);
  assert.match(p, /aviso\.md/);
  assert.ok((p.match(/cuerpoNoDebeDespertar\(/g) || []).length >= 2, 'el aviso pasa la comprobación de la mención, no solo el cuerpo');
});

test('el workflow publica el aviso que compone la pasada, y le da el dueño para mencionarlo', () => {
  const codigo = fs.readFileSync(WF, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(codigo, /rules\/branches\/main/, 'la lista de obligatorios se lee de las reglas vivas');
  assert.match(codigo, /--body-file aviso\.md/);
  assert.match(codigo, /DUENO:\s*\$\{\{\s*github\.repository_owner\s*\}\}/);
  assert.ok(!/cambiaron de causa/.test(codigo), 'el aviso ya no se compone en bash');
});

// ── LO QUE ENCONTRÓ EL LABORATORIO CON DATOS REALES (15-sep-2026, 10:17Z) ──────────────────
//
// La primera pasada de laboratorio —reunión REAL con `gh`, memoria REAL del #1241— avisaba de dos
// cosas que no debía:
//   · #1259, empujado hacía UN minuto, entraba en el aviso como ESPERANDO. La gracia solo cubre
//     «cero checks», y éste ya tenía siete arrancados. El control negativo, con datos reales, fallaba.
//   · #1190, que el arreglo de la identidad del bot por fin hace visible, salía ESPERANDO con TODOS
//     sus checks en verde. No espera nada: nadie armó el auto-merge y nadie lo va a mergear.
// Payloads reales de `GET /commits/<head>/check-runs`, recortados a los campos que se usan.

const CHECKS_1190 = [ // head e9f66075, 8-sep
  { id: 101982073680, name: 'meta-guard · los guards caen cuando deben', status: 'completed', conclusion: 'success' },
  { id: 101982073335, name: 'constancia del ALTER (informativo)', status: 'completed', conclusion: 'success' },
  { id: 101982073298, name: 'guards de navegador (fuera de la tanda)', status: 'completed', conclusion: 'success' },
  { id: 101982073238, name: 'vigía del despliegue (informativo)', status: 'completed', conclusion: 'success' },
  { id: 101982073118, name: '¿este PR toca la zona roja?', status: 'completed', conclusion: 'success' },
  { id: 101982072991, name: 'build + tests (con banco desechable)', status: 'completed', conclusion: 'success' },
  { id: 101982002777, name: 'abrir-pr-y-armar-automerge', status: 'completed', conclusion: 'failure' },
];

const CHECKS_1259 = [ // head a36821af, 15-sep, leído un minuto después del push
  { id: 104338896466, name: '¿este PR toca la zona roja?', status: 'completed', conclusion: 'success' },
  { id: 104338896075, name: 'constancia del ALTER (informativo)', status: 'completed', conclusion: 'success' },
  { id: 104338896036, name: 'guards de navegador (fuera de la tanda)', status: 'in_progress', conclusion: null },
  { id: 104338895962, name: 'meta-guard · los guards caen cuando deben', status: 'in_progress', conclusion: null },
  { id: 104338895956, name: 'build + tests (con banco desechable)', status: 'in_progress', conclusion: null },
  { id: 104338895715, name: 'vigía del despliegue (informativo)', status: 'completed', conclusion: 'success' },
  { id: 104338826492, name: 'abrir-pr-y-armar-automerge', status: 'completed', conclusion: 'success' },
];

test('🔴 CONTROL NEGATIVO REAL #1259 · recién empujado CON checks corriendo: ESPERANDO, y NO avisa', () => {
  const c = causaDelAtasco({
    estado: 'BLOCKED', checks: CHECKS_1259.length, minutosDesdePush: 1, checkRuns: CHECKS_1259,
    obligatorios: [OBLIGATORIO], sondaConflicto: false, autoMerge: true,
  });
  assert.equal(c.causa, 'ESPERANDO');
  const r = haEmpeorado([], [{ numero: 1259, causa: c.causa, umbral: V.umbralDeEdad(1 / 60) }]);
  assert.equal(r.empeora, false, 'un PR de hace un minuto con su CI corriendo no es un atasco que contarle a nadie');
});

test('un atasco que espera y ENTRA ya viejo sí avisa: es la edad lo que lo vuelve atasco', () => {
  const r = haEmpeorado([], [{ numero: 7, causa: 'ESPERANDO', umbral: 168 }]);
  assert.equal(r.empeora, true);
  assert.deepEqual(r.nuevos, [7]);
});

test('y el que espera y entró en silencio avisa al cruzar las 24 h', () => {
  const r = haEmpeorado([{ numero: 1259, causa: 'ESPERANDO', umbral: 0 }], [{ numero: 1259, causa: 'ESPERANDO', umbral: 24 }]);
  assert.equal(r.empeora, true);
  assert.deepEqual(r.envejecidos, [{ numero: 1259, umbral: 24 }]);
});

test('🔴 una causa que NO se arregla esperando avisa al entrar, sin esperar a la edad', () => {
  for (const causa of ['SIN-CHECKS', 'DIRTY', 'CONFLICTO-DISCREPA', 'ROJO-OBLIGATORIO', 'ROJO-SIN-LISTA', 'SIN-AUTO-MERGE']) {
    assert.equal(haEmpeorado([], [{ numero: 1, causa, umbral: 0 }]).empeora, true, causa);
  }
});

test('pasar A una causa que espera no es empeorar (un push arregló el rojo y CI corre)', () => {
  assert.equal(haEmpeorado([{ numero: 1, causa: 'ROJO-OBLIGATORIO', umbral: 0 }], [{ numero: 1, causa: 'ESPERANDO', umbral: 0 }]).empeora, false);
});

test('🔴 pasar DE una causa que espera a una que no, sí: el #1205 de ESPERANDO a ROJO-OBLIGATORIO', () => {
  const r = haEmpeorado([{ numero: 1205, causa: 'ESPERANDO' }], [{ numero: 1205, causa: 'ROJO-OBLIGATORIO', umbral: 0 }]);
  assert.equal(r.empeora, true);
  assert.deepEqual(r.cambiados, [1205]);
});

test('🔴 CEBO REAL #1190 · del bot, sin auto-merge y todo en verde → SIN-AUTO-MERGE, no ESPERANDO', () => {
  const r = causaDelAtasco({
    estado: 'UNSTABLE', checks: CHECKS_1190.length, checkRuns: CHECKS_1190,
    obligatorios: [OBLIGATORIO], sondaConflicto: false, autoMerge: false,
  });
  assert.equal(r.causa, 'SIN-AUTO-MERGE', `salió ${r.causa}: «esperando a que pase» un check que ya pasó el 8-sep`);
});

test('sin el dato del auto-merge el clasificador no inventa SIN-AUTO-MERGE', () => {
  assert.equal(causaDelAtasco({ estado: 'UNSTABLE', checks: 5 }).causa, 'ESPERANDO');
});

test('el rojo obligatorio manda sobre la falta de auto-merge: primero hace falta un push', () => {
  const r = causaDelAtasco({ estado: 'BLOCKED', checks: CHECKS_1205.length, checkRuns: CHECKS_1205, obligatorios: [OBLIGATORIO], autoMerge: false });
  assert.equal(r.causa, 'ROJO-OBLIGATORIO');
});

test('la pasada le da al clasificador el dato del auto-merge', () => {
  assert.match(fs.readFileSync(PASADA, 'utf8'), /causaDelAtasco\(\{[^}]*autoMerge/);
});

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
  const r = haEmpeorado([{ numero: 1, causa: 'DIRTY' }], [{ numero: 1, causa: 'DIRTY' }, { numero: 2, causa: 'BEHIND' }]);
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

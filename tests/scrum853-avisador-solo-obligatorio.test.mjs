// SCRUM-853 — el avisador despierta SOLO por rojo en un check OBLIGATORIO, y nadie escribe sobre
// un PR que ya entró.
//
// EL CÍRCULO, medido el 15-sep-2026 (orquestador a las 10:37Z sobre 5359f41d; Sesión 5 entre las
// 13:55Z y las 14:07Z, reloj de GitHub, sobre 289cbf41):
//
//   · 47 ramas claude/pr-* vivas. En TODAS, la hora que lleva el nombre de la rama es de 1 a 7 min
//     POSTERIOR al mergedAt de su PR. No es que Claude termine tarde: es que ARRANCA sobre un PR ya
//     mergeado, y claude-code-action@v1 hace justo eso con un PR cerrado — src/github/operations/
//     branch.ts: `if (prState === "CLOSED" || prState === "MERGED")` → «Fall through to create a
//     new branch». Rama nueva, sin PR, sin nadie que la mire.
//   · El avisador comentó DESPUÉS del merge en los 7 PR medidos. El #1255, al segundo:
//         09:46:52  «build + tests» (el único obligatorio) en verde
//         09:46:56  el auto-merge mergea
//         09:46:57  «meta-guard» en rojo → el workflow CI entero termina en failure
//         09:47:14  el avisador comenta «@claude el CI de este PR está en ROJO» sobre un PR mergeado
//         09:47:17  arranca claude.yml → claude/pr-1255-20260915-0947
//   · claude.yml: 109 ejecuciones hoy.
//
// SIN GATE: funciones puras + lectura de ficheros. Ni BD, ni red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as P from '../scripts/puerta-avisador-rojo.mjs';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR_WF = path.join(REPO, '.github', 'workflows');
const AVISADOR = path.join(DIR_WF, 'avisador-rojo.yml');
const CLAUDE_YML = path.join(DIR_WF, 'claude.yml');
const PUERTA = path.join(REPO, 'scripts', 'puerta-avisador-rojo.mjs');
const PUERTA_CLAUDE = path.join(REPO, 'scripts', 'puerta-claude.mjs');

// La puerta de claude.yml es un fichero nuevo. Si falta, sus tests tienen que caer DICIENDO que
// falta, no tumbar este fichero entero antes de que corran los demás.
const C = fs.existsSync(PUERTA_CLAUDE) ? await import(pathToFileURL(PUERTA_CLAUDE).href) : {};

// Cada pieza del 853 con el defecto EXACTO que la anula.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/puerta-avisador-rojo.mjs',
    de: '  const bloquean = rojos.filter((n) => obligatorios.includes(n));',
    a: '  const bloquean = rojos;',
    cae: 'CEBO REAL #1255 · rojo SOLO en checks NO obligatorios → NO despierta',
  },
  {
    fichero: 'scripts/puerta-avisador-rojo.mjs',
    de: '  const obligatorios = checksObligatoriosDeReglas(e.reglas);',
    a: '  const obligatorios = checksObligatoriosDeReglas(e.reglas) || checksEnRojo(e.checkRuns || []);',
    cae: 'sin lista de obligatorios NO despierta, y lo DICE con su código',
  },
  {
    fichero: 'scripts/puerta-avisador-rojo.mjs',
    de: '  const cerrado = prNoAbierto(estadoPR);',
    a: '  const cerrado = null;',
    cae: 'CEBO REAL #1255 · el aviso salió 18 s DESPUÉS del merge',
  },
  {
    fichero: 'scripts/puerta-claude.mjs',
    de: '  const cerrado = prNoAbierto(estadoPR);',
    a: '  const cerrado = null;',
    cae: 'CEBO REAL #1255 · claude.yml NO arranca sobre un PR ya mergeado',
  },
  {
    fichero: 'scripts/puerta-claude.mjs',
    de: '  const mudas = ramasDespues.map(corta).filter((r) => !previas.has(r));',
    a: '  const mudas = [];',
    cae: 'CEBO REAL #1255 · PR mergeado cuando Claude termina y rama claude/pr-* nueva → RAMA-MUDA',
  },
  {
    fichero: '.github/workflows/claude.yml',
    de: "        if: steps.puerta.outputs.despertar == 'si'",
    a: '        if: always()',
    cae: 'claude.yml pregunta a la puerta ANTES de la acción',
  },
  {
    fichero: '.github/workflows/claude.yml',
    de: '            CUERPO="$CUERPO" node --input-type=module -e "',
    a: '            node --input-type=module -e "',
    cae: 'el aviso de rama muda se comprueba sobre el fichero que de verdad se va a publicar',
  },
  {
    fichero: 'scripts/puerta-claude.mjs',
    de: "  const cabeza = cabezaRemota === '' ? '' : (/^[0-9a-f]{40}$/.test(String(cabezaRemota)) ? cabezaRemota : null);",
    a: '  const cabeza = cabezaRemota;',
    cae: 'un 404 que llega como CUERPO DEL ERROR no es una cabeza remota',
  },
  {
    fichero: '.github/workflows/avisador-rojo.yml',
    de: '          if ! REGLAS="$(gh api "repos/$REPO/rules/branches/main" 2>/dev/null)"; then REGLAS=null; fi',
    a: `          REGLAS="$(gh api "repos/$REPO/rules/branches/main" 2>/dev/null || echo 'null')"`,
    cae: 'lo que añade el 853 no se queda con la salida de un `gh api` que ha FALLADO',
  },
];

const OBLIGATORIO = 'build + tests (con banco desechable)';
const NUESTRO = 'lwislg99/cobroflash-backend';

/** `GET /repos/…/rules/branches/main` a las 14:07Z del 15-sep, recortado a lo que se usa. */
const REGLAS_MAIN = [
  { type: 'deletion' },
  { type: 'non_fast_forward' },
  { type: 'pull_request', parameters: { allowed_merge_methods: ['squash', 'merge'], required_approving_review_count: 0 } },
  {
    type: 'required_status_checks',
    parameters: {
      do_not_enforce_on_create: false,
      required_status_checks: [{ context: OBLIGATORIO, integration_id: 15368 }],
      strict_required_status_checks_policy: false,
    },
  },
];

/** #1255, head 08621119: rojo SOLO en dos checks NO obligatorios. Es el que dejó la rama muda. */
const CHECKS_1255 = [
  { id: 104331159720, name: '¿este PR toca la zona roja?', status: 'completed', conclusion: 'success' },
  { id: 104331159634, name: 'guards de navegador (fuera de la tanda)', status: 'completed', conclusion: 'failure' },
  { id: 104331159541, name: 'vigía del despliegue (informativo)', status: 'completed', conclusion: 'success' },
  { id: 104331159516, name: 'constancia del ALTER (informativo)', status: 'completed', conclusion: 'success' },
  { id: 104331159430, name: OBLIGATORIO, status: 'completed', conclusion: 'success' },
  { id: 104331159255, name: 'meta-guard · los guards caen cuando deben', status: 'completed', conclusion: 'failure' },
  { id: 104331087545, name: 'abrir-pr-y-armar-automerge', status: 'completed', conclusion: 'success' },
];

/** #1205, head b3f2fba9 (8-sep): los dos rojos reales de aquel head, uno de ellos el obligatorio. */
const CHECKS_1205 = [
  { id: 102021223379, name: OBLIGATORIO, status: 'completed', conclusion: 'failure' },
  { id: 102021223598, name: 'guards de navegador (fuera de la tanda)', status: 'completed', conclusion: 'failure' },
];

/** Un PR nuestro, del bot, ABIERTO, fuera del camino fiscal y sin avisos: solo varía lo del 853. */
const propio = {
  conclusionCI: 'failure', repoBase: NUESTRO, repoOrigen: NUESTRO, autor: P.BOT, permisoAutor: '',
  marcasPrevias: [], ficheros: ['tests/scrum716-ritmo-de-despliegue.test.mjs'],
  marcaActual: '08621119ccdd:guards de navegador (fuera de la tanda)', tope: 3,
  reglas: REGLAS_MAIN, estadoPR: 'open',
};

const sinComentariosYml = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const sinComentariosJs = (t) => t.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');

// ── ① EL AVISADOR DESPIERTA SOLO POR ROJO EN UN OBLIGATORIO ──────────────────────────────────

test('🔴 CEBO REAL #1255 · rojo SOLO en checks NO obligatorios → NO despierta, y lo dice', () => {
  const r = P.decidir({ ...propio, checkRuns: CHECKS_1255 });
  assert.equal(r.avisar, false, 'guards de navegador y meta-guard no bloquean el merge: el #1255 entró igual');
  assert.equal(r.codigo, 'SIN-ROJO-OBLIGATORIO');
  assert.match(r.motivo, /guards de navegador/, 'el «no» nombra lo que sí estaba en rojo');
});

test('🔴 CONTROL POSITIVO · rojo en «build + tests» → SÍ despierta, y nombra el check', () => {
  const r = P.decidir({ ...propio, checkRuns: CHECKS_1205 });
  assert.equal(r.avisar, true, 'si esto no despierta, el 853 ha apagado el avisador en vez de afinarlo');
  assert.equal(r.codigo, 'AVISAR');
  assert.match(r.motivo, /build \+ tests \(con banco desechable\)/);
});

test('🔴 sin lista de obligatorios NO despierta, y lo DICE con su código', () => {
  for (const reglas of [null, undefined, { message: 'Not Found' }, [{ type: 'deletion' }]]) {
    const r = P.decidir({ ...propio, checkRuns: CHECKS_1205, reglas });
    assert.equal(r.avisar, false, `reglas=${JSON.stringify(reglas)}`);
    assert.equal(r.codigo, 'SIN-LISTA-OBLIGATORIOS');
  }
});

test('sin check-runs leídos no se sabe qué cayó → no despierta', () => {
  for (const checkRuns of [null, undefined, 'x']) {
    assert.equal(P.decidir({ ...propio, checkRuns }).codigo, 'SIN-CHECKS-LEIDOS', String(checkRuns));
  }
});

test('manda la ÚLTIMA ejecución: un obligatorio relanzado en verde ya no despierta', () => {
  const runs = [
    { id: 10, name: OBLIGATORIO, status: 'completed', conclusion: 'failure' },
    { id: 11, name: OBLIGATORIO, status: 'completed', conclusion: 'success' },
  ];
  assert.equal(P.decidir({ ...propio, checkRuns: runs }).codigo, 'SIN-ROJO-OBLIGATORIO');
});

test('🔴 UNA SOLA FUENTE · la puerta usa el lector del vigía, no una copia', () => {
  const codigo = sinComentariosJs(fs.readFileSync(PUERTA, 'utf8'));
  for (const f of ['checksObligatoriosDeReglas', 'checksEnRojo']) {
    assert.match(codigo, new RegExp(`import\\s*\\{[^}]*\\b${f}\\b[^}]*\\}\\s*from\\s*'\\./vigia-atascados\\.mjs'`), f);
  }
});

/** Quién LEE `required_status_checks` en código (no en comentarios), en scripts/ y workflows. */
function lectoresDeReglas() {
  const LEE = /(?<!strict_)required_status_checks(?!_policy)/;
  const out = [];
  const visitar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') visitar(abs); continue; }
      if (/\.(mjs|cjs|js|ts)$/.test(e.name) && LEE.test(sinComentariosJs(fs.readFileSync(abs, 'utf8')))) {
        out.push(path.relative(REPO, abs).split(path.sep).join('/'));
      }
    }
  };
  visitar(path.join(REPO, 'scripts'));
  for (const f of fs.readdirSync(DIR_WF)) {
    if (f.endsWith('.yml') && LEE.test(sinComentariosYml(fs.readFileSync(path.join(DIR_WF, f), 'utf8')))) {
      out.push(`.github/workflows/${f}`);
    }
  }
  return out.sort();
}

test('🔴 CENSO · en scripts/ y en los workflows, UN solo sitio lee la lista de obligatorios', () => {
  const lectores = lectoresDeReglas();
  assert.ok(lectores.includes('scripts/vigia-atascados.mjs'),
    'SUELO: el censo tiene que ver al lector que SÍ existe; si no lo ve, está ciego y su cero no vale');
  assert.deepEqual(lectores, ['scripts/vigia-atascados.mjs'], `hay copias del lector: ${lectores.join(', ')}`);
});

test('el avisador reúne reglas, check-runs y estado del PR, y se los da a la puerta', () => {
  const c = sinComentariosYml(fs.readFileSync(AVISADOR, 'utf8'));
  assert.match(c, /rules\/branches\/main/, 'la lista de obligatorios sale de las reglas vivas de main');
  assert.match(c, /commits\/\$SHA\/check-runs\?per_page=100/, 'y los rojos, de TODOS los check-runs del head');
  assert.match(c, /pulls\/\$PR"[^\n]*merged/, 'el estado del PR se lee en el momento, con su merged');
  for (const campo of ['reglas', 'checkRuns', 'estadoPR']) assert.match(c, new RegExp(`\\b${campo}\\s*:`), campo);
});

test('el aviso le dice a Claude QUÉ check obligatorio cayó', () => {
  // Hoy le dice «el CI está en ROJO», y Claude arregla lo primero que ve rojo: el meta-guard.
  const c = sinComentariosYml(fs.readFileSync(AVISADOR, 'utf8'));
  assert.match(c, /CUERPO="\$\(printf[^\n]*"\$MOTIVO"/);
});

// ── ② NADIE ESCRIBE SOBRE UN PR QUE YA ENTRÓ ─────────────────────────────────────────────────

test('estadoDelPR normaliza la respuesta de la API en UN sitio', () => {
  assert.equal(typeof P.estadoDelPR, 'function', 'falta estadoDelPR en puerta-avisador-rojo.mjs');
  assert.equal(P.estadoDelPR({ state: 'open', merged: false }), 'open');
  assert.equal(P.estadoDelPR({ state: 'closed', merged: true }), 'merged', 'respuesta real del #1255');
  assert.equal(P.estadoDelPR({ state: 'closed', merged: false }), 'closed');
  for (const x of [null, undefined, {}, { message: 'Not Found' }, { state: 'raro' }]) {
    assert.equal(P.estadoDelPR(x), null, JSON.stringify(x));
  }
});

test('🔴 CEBO REAL #1255 · el aviso salió 18 s DESPUÉS del merge: con el PR mergeado NO despierta', () => {
  // Con el rojo en un obligatorio, a propósito: la puerta del PR cerrado no puede depender de la otra.
  const r = P.decidir({ ...propio, checkRuns: CHECKS_1205, estadoPR: 'merged' });
  assert.equal(r.avisar, false);
  assert.equal(r.codigo, 'PR-YA-CERRADO');
  assert.match(r.motivo, /mergeado/);
});

test('cerrado sin merge, tampoco', () => {
  assert.equal(P.decidir({ ...propio, checkRuns: CHECKS_1205, estadoPR: 'closed' }).codigo, 'PR-YA-CERRADO');
});

test('🔴 sin estado del PR no despierta (falla cerrado)', () => {
  for (const estadoPR of [null, undefined, '', 'raro']) {
    assert.equal(P.decidir({ ...propio, checkRuns: CHECKS_1205, estadoPR }).codigo, 'SIN-ESTADO-PR', String(estadoPR));
  }
});

test('las puertas de seguridad siguen mandando: las del 853 van DETRÁS del fork y de lo fiscal', () => {
  assert.equal(P.decidir({ ...propio, checkRuns: CHECKS_1255, estadoPR: 'merged', repoOrigen: 'ajeno/x' }).codigo, 'FORK-NO-DESPIERTA');
  assert.equal(P.decidir({ ...propio, checkRuns: CHECKS_1255, estadoPR: 'merged', ficheros: ['prisma/schema.prisma'] }).codigo, 'ESCALADO-FISCAL');
});

test('y el tope sigue donde estaba, detrás de todas', () => {
  const r = P.decidir({ ...propio, checkRuns: CHECKS_1205, marcasPrevias: ['a:x', 'b:y', 'c:z'], marcaActual: 'd:w' });
  assert.equal(r.codigo, 'TOPE-ALCANZADO');
});

// ── ② EN claude.yml: DONDE SE DESPIERTA, NO DONDE SE LLAMA ───────────────────────────────────
// El avisador es UNO de los que llaman. Una persona que escribe @claude en un PR ya mergeado
// produce la misma rama muda: la puerta tiene que estar en claude.yml.

test('🔴 CEBO REAL #1255 · claude.yml NO arranca sobre un PR ya mergeado', () => {
  assert.equal(typeof C.antesDeDespertar, 'function', 'falta scripts/puerta-claude.mjs → antesDeDespertar');
  const r = C.antesDeDespertar({ esPR: true, estadoPR: 'merged' });
  assert.equal(r.despertar, false, 'con un PR cerrado la acción crea claude/pr-N-<fecha>: la rama muda');
  assert.equal(r.codigo, 'PR-YA-CERRADO');
});

test('CONTROL POSITIVO · PR abierto → arranca; comentario en un issue → arranca', () => {
  assert.equal(typeof C.antesDeDespertar, 'function', 'falta antesDeDespertar');
  assert.equal(C.antesDeDespertar({ esPR: true, estadoPR: 'open' }).despertar, true);
  assert.equal(C.antesDeDespertar({ esPR: false, estadoPR: null }).despertar, true, 'un issue no tiene PR que haya entrado');
});

test('🔴 sin estado del PR, claude.yml no arranca', () => {
  assert.equal(typeof C.antesDeDespertar, 'function', 'falta antesDeDespertar');
  for (const estadoPR of [null, undefined, '', 'raro']) {
    assert.equal(C.antesDeDespertar({ esPR: true, estadoPR }).codigo, 'SIN-ESTADO-PR', String(estadoPR));
  }
});

test('🔴 lo que no arranca CONTESTA, y la respuesta no despierta a nadie', () => {
  assert.equal(typeof C.respuestaSinDespertar, 'function', 'falta respuestaSinDespertar');
  const t = C.respuestaSinDespertar({ numero: 1255, estadoPR: 'merged' });
  assert.match(t, /#1255/);
  assert.match(t, /mergeado/);
  assert.equal(P.cuerpoNoDebeDespertar(t), true);
});

const FIN_1255 = {
  estadoPR: 'merged', ramasAntes: [], ramasDespues: ['refs/heads/claude/pr-1255-20260915-0947'],
  ramaCabeza: 'scrum-844-el-resto-de-la-red', cabezaPR: '08621119ccdde5a23f24e4ba36407e0ae976a6da', cabezaRemota: '',
};

test('🔴 CEBO REAL #1255 · PR mergeado cuando Claude termina y rama claude/pr-* nueva → RAMA-MUDA', () => {
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  const r = C.ramasMudas(FIN_1255);
  assert.equal(r.declarar, true);
  assert.equal(r.codigo, 'RAMA-MUDA');
  assert.deepEqual(r.mudas, ['claude/pr-1255-20260915-0947']);
});

test('🔴 PR mergeado DURANTE el trabajo y Claude empuja a la rama del PR ya borrada → RAMA-MUDA', () => {
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  const r = C.ramasMudas({ ...FIN_1255, ramasDespues: [], cabezaRemota: 'b8e456293feef61f6403df6f9f0d2745fdfbf61b' });
  assert.equal(r.codigo, 'RAMA-MUDA');
  assert.deepEqual(r.mudas, ['scrum-844-el-resto-de-la-red']);
});

test('CONTROL NEGATIVO · lo normal tras un merge (cabeza borrada, ninguna rama nueva) → nada que declarar', () => {
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  const r = C.ramasMudas({ ...FIN_1255, ramasDespues: [] });
  assert.equal(r.declarar, false);
  assert.equal(r.codigo, 'SIN-RAMA-MUDA');
});

test('CONTROL NEGATIVO · PR abierto y Claude empujó a SU rama → nada que declarar', () => {
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  const r = C.ramasMudas({ ...FIN_1255, estadoPR: 'open', ramasDespues: [], cabezaRemota: 'b8e456293feef61f6403df6f9f0d2745fdfbf61b' });
  assert.equal(r.codigo, 'SIN-RAMA-MUDA');
});

test('una rama claude/pr-* que YA existía antes de arrancar no es de este run', () => {
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  const r = C.ramasMudas({ ...FIN_1255, ramasAntes: FIN_1255.ramasDespues });
  assert.equal(r.codigo, 'SIN-RAMA-MUDA');
});

test('🔴 si no se pudieron listar las ramas, no se afirma que no haya muda', () => {
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  for (const k of ['ramasAntes', 'ramasDespues']) {
    const r = C.ramasMudas({ ...FIN_1255, [k]: null });
    assert.equal(r.codigo, 'NO-SE-PUDO-MIRAR', k);
    assert.equal(r.declarar, true, 'no poder mirar se dice, no se calla');
  }
});

test('🔴 LO CAZÓ EL LABORATORIO · un 404 que llega como CUERPO DEL ERROR no es una cabeza remota', () => {
  // Medido el 15-sep: `gh api …/git/ref/heads/scrum-844-el-resto-de-la-red -q .object.sha`, con la
  // rama ya borrada, sale con 1 y escribe por stdout ESTO; `$(… || echo '')` se quedaba con ello, y el
  // paso declaraba muda una rama que no existe.
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  const CUERPO_404 = '{"message":"Not Found","documentation_url":"https://docs.github.com/rest/git/refs#get-a-reference","status":"404"}';
  const r = C.ramasMudas({ ...FIN_1255, ramasAntes: FIN_1255.ramasDespues, cabezaRemota: CUERPO_404 });
  assert.notEqual(r.codigo, 'RAMA-MUDA', 'declaraba muda una rama que no existe');
  assert.equal(r.codigo, 'NO-SE-PUDO-MIRAR', 'y no saber tampoco es «no hay»');
});

test('con el PR cerrado y la cabeza remota o el PR ilegibles, no se afirma que no haya muda', () => {
  assert.equal(typeof C.ramasMudas, 'function', 'falta ramasMudas');
  for (const cabezaRemota of [null, undefined]) {
    assert.equal(C.ramasMudas({ ...FIN_1255, ramasDespues: [], cabezaRemota }).codigo, 'NO-SE-PUDO-MIRAR', String(cabezaRemota));
  }
  assert.equal(C.ramasMudas({ ...FIN_1255, ramasDespues: [], estadoPR: null, ramaCabeza: undefined }).codigo, 'NO-SE-PUDO-MIRAR');
});

test('🔴 lo que añade el 853 no se queda con la salida de un `gh api` que ha FALLADO', () => {
  const PATRON = (v) => new RegExp(`\\b${v}="\\$\\(gh api[^\\n]*(?:\\\\\\n[^\\n]*)*\\|\\| echo`);
  for (const [f, vars] of [[AVISADOR, ['ESTADO_PR', 'REGLAS', 'CHECK_RUNS']], [CLAUDE_YML, ['PR_API', 'DESPUES', 'CABEZA_REMOTA']]]) {
    const c = sinComentariosYml(fs.readFileSync(f, 'utf8'));
    for (const v of vars) assert.ok(!PATRON(v).test(c), `${path.basename(f)} · ${v} captura el cuerpo del error`);
  }
  // Control del propio patrón: tiene que reconocer la forma vieja, en una línea y partida en dos.
  assert.ok(PATRON('X').test('X="$(gh api "a" -q .b 2>/dev/null || echo null)"'));
  assert.ok(PATRON('X').test('X="$(gh api "a" \\\n   -q .b 2>/dev/null || echo null)"'));
  assert.match(sinComentariosYml(fs.readFileSync(CLAUDE_YML, 'utf8')), /git ls-remote --exit-code origin "refs\/heads\/\$RAMA"/);
});

test('🔴 el aviso de rama muda nombra la rama y a una PERSONA, y no despierta a Claude', () => {
  assert.equal(typeof C.avisoRamaMuda, 'function', 'falta avisoRamaMuda');
  const t = C.avisoRamaMuda({ numero: 1255, estadoPR: 'merged', mudas: ['claude/pr-1255-20260915-0947'], dueno: 'lwislg99' });
  assert.match(t, /claude\/pr-1255-20260915-0947/);
  assert.match(t, /@lwislg99/);
  assert.equal(P.cuerpoNoDebeDespertar(t), true);
});

/** Los pasos del job de claude.yml, cada uno con su texto (sin comentarios). */
const pasosDeClaude = () => sinComentariosYml(fs.readFileSync(CLAUDE_YML, 'utf8')).split(/\n(?= {6}- )/);

test('🔴 claude.yml pregunta a la puerta ANTES de la acción, y la acción depende de la respuesta', () => {
  const pasos = pasosDeClaude();
  const iPuerta = pasos.findIndex((p) => /puerta-claude\.mjs"? antes\b/.test(p));
  const iAccion = pasos.findIndex((p) => /anthropics\/claude-code-action@/.test(p));
  assert.ok(iPuerta >= 0, 'no hay paso que pregunte a la puerta antes de despertar');
  assert.ok(iAccion > iPuerta, 'la puerta tiene que ir ANTES de la acción');
  assert.match(pasos[iAccion], /if:\s*steps\.puerta\.outputs\.despertar\s*==\s*'si'/);
});

test('🔴 y DESPUÉS de la acción, pase lo que pase, mira si quedó una rama muda', () => {
  const pasos = pasosDeClaude();
  const iAccion = pasos.findIndex((p) => /anthropics\/claude-code-action@/.test(p));
  const iDespues = pasos.findIndex((p) => /puerta-claude\.mjs"? despues\b/.test(p));
  assert.ok(iDespues > iAccion, 'no hay paso que mire las ramas después de la acción');
  assert.match(pasos[iDespues], /always\(\)/, 'si la acción falla a medias, la rama muda también puede quedar');
});

test('🔴 la puerta de claude.yml se ejecuta desde MAIN, no desde el árbol del PR', () => {
  // En un `pull_request_review_comment` el checkout trae el código del PR: ejecutar un script de
  // ahí es ejecutar lo que ha escrito quien comenta, en un job con `contents: write`.
  const c = sinComentariosYml(fs.readFileSync(CLAUDE_YML, 'utf8'));
  assert.match(c, /git show origin\/main:scripts\/puerta-claude\.mjs/);
  assert.ok(!/node scripts\/puerta-claude\.mjs/.test(c), 'nunca desde el árbol del checkout');
});

test('🔴 el aviso de rama muda se comprueba sobre el fichero que de verdad se va a publicar', () => {
  // Lo cazó el LABORATORIO, no los tests (15-sep, 14:2xZ, pasos reales sacados del YAML): esa
  // comprobación leía `process.env.CUERPO` en un `node` que no lo recibía. Reventaba con código 1
  // —el mismo que «lleva la mención»—, el paso decía eso, y el aviso de rama muda no salía NUNCA.
  // Un aviso que no puede salir es la rama muda otra vez, con un error falso encima.
  const p = pasosDeClaude().find((x) => /puerta-claude\.mjs"? despues\b/.test(x));
  assert.ok(p, 'no encuentro el paso de después');
  assert.match(p, /CUERPO="\$CUERPO" node --input-type=module/, 'la comprobación tiene que recibir la ruta del aviso');
  assert.match(p, /process\.exit\(2\)/, 'y «no se pudo comprobar» no puede salir con el mismo código que «lleva la mención»');
});

test('lo que claude.yml escribe como respuesta sale con el GITHUB_TOKEN y pasa la comprobación', () => {
  const pasos = pasosDeClaude();
  const escriben = pasos.filter((p) => /gh (pr|issue) comment/.test(p));
  assert.ok(escriben.length >= 2, 'la respuesta del «no arranco» y el aviso de rama muda');
  for (const p of escriben) {
    assert.match(p, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/, 'con la llave de la App, un texto con la mención despertaría');
    assert.match(p, /cuerpoNoDebeDespertar/);
  }
});

// tests/scrum1153-censo-entorno-prestado.test.mjs — SCRUM-1153
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RED DEL CENSO DE `scripts/_censo-entorno-prestado.mjs`: que siga viendo lo que promete ver.
//
// ⛔ Esto NO censa el árbol de verdad (eso es correr el script). Comprueba que el detector
// DISTINGUE: acusa el código viejo real de SCRUM-938, acusa un caso fabricado mínimo, y NO acusa
// el mismo caso una vez que se le aplica —mecánicamente, no a mano— el arreglo que ya se conoce.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { clasificaFuente, motivosParaNoFiarse, censar } from '../scripts/_censo-entorno-prestado.mjs';

const deGit = (sha, ruta) => execFileSync('git', ['show', `${sha}:${ruta}`], { encoding: 'utf8', maxBuffer: 1 << 24 });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO — sobre el árbol de verdad, no fabricado
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1153 · SUELO: el censo real ve población y no calla sin motivo', () => {
  const c = censar('.');
  const motivos = motivosParaNoFiarse(c);
  assert.deepEqual(motivos, [], `🔴 CIEGO: ${motivos.join(' · ')}`);
  assert.ok(c.ficheros > 500, `🔴 población sospechosamente pequeña: ${c.ficheros} ficheros`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 CONTROL POSITIVO REAL — el código viejo de SCRUM-938, leído de git, no reconstruido
//
// `5e64a41b` es el commit ANTERIOR al arreglo (`d05d9aa6`, "SCRUM-938: arregla el censo
// lista-como-fixture"). Un control positivo sobre el código de HOY saldría limpio y no probaría
// nada: `decidirVaciando` hoy construye `entornoHijo` a mano y borra las tres variables.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1153 · 🔴 ② CONTROL POSITIVO REAL: el `decidirVaciando` viejo de SCRUM-938 se acusa', () => {
  const viejo = deGit('5e64a41b', 'scripts/censo-lista-como-fixture.mjs');
  const hallados = clasificaFuente('censo-lista-como-fixture.mjs', viejo);
  const acusados = hallados.filter((h) => h.acusado);
  assert.equal(acusados.length, 1,
    `🔴 EL CENSO NO VE EL DEFECTO QUE LO ORIGINÓ: \`decidirVaciando\` (pre-fix) heredaba `
    + `\`process.env\` entero sin construirlo a mano, y parseaba \`r.stdout.match(...)\`. `
    + `Hallados: ${JSON.stringify(hallados)}`);
  assert.equal(acusados[0].envClase, null, '🔴 el viejo no pasaba NINGÚN `env`: tiene que verse como "sin env", no como otra clase.');
});

test('SCRUM-1153 · CONTROL NEGATIVO REAL (mismo fichero, código de HOY): ya no se acusa', () => {
  const hoy = deGit('HEAD', 'scripts/censo-lista-como-fixture.mjs');
  const hallados = clasificaFuente('censo-lista-como-fixture.mjs', hoy);
  const acusados = hallados.filter((h) => h.acusado);
  assert.deepEqual(acusados, [],
    `🔴 FALSO POSITIVO sobre código ya arreglado: ${JSON.stringify(acusados)}. `
    + `\`decidirVaciando\` construye \`entornoHijo = { ...process.env }\` y borra las tres `
    + 'variables ANTES de que `correr()` (un closure anidado) lo use — el censo tiene que mirar '
    + 'el fichero entero, no sólo la función que envuelve la llamada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ CONTROL POSITIVO FABRICADO + NEGATIVO DERIVADO (SCRUM-846 + "no cableado a mano")
//
// El negativo NO es un segundo texto escrito aparte —eso es lo que caducó solo en SCRUM-940/938—
// es el MISMO texto positivo, con el arreglo aplicado por una función (`saneado`), para que los
// dos casos no puedan divergir en su forma: sólo difieren en la única línea que importa.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const FABRICADO = [
  "import { spawnSync } from 'node:child_process';",
  'export function medir(ruta) {',
  "  const r = spawnSync(process.execPath, ['--test', ruta], { cwd: '.', encoding: 'utf8' });",
  "  return Number((r.stdout.match(/^\\u2139 tests (\\d+)/m) || [])[1] || 0);",
  '}',
].join('\n');

/** Aplica el arreglo YA CONOCIDO (SCRUM-938) por sustitución de texto: no es un segundo fixture. */
function saneado(fuente) {
  const conEntorno = fuente.replace(
    "export function medir(ruta) {",
    "export function medir(ruta) {\n"
    + "  const entorno = { ...process.env };\n"
    + "  delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;",
  );
  return conEntorno.replace("{ cwd: '.', encoding: 'utf8' }", "{ cwd: '.', encoding: 'utf8', env: entorno }");
}

test('SCRUM-1153 · 🔴 ③ CONTROL POSITIVO FABRICADO: caso mínimo, sin env, se acusa', () => {
  const hallados = clasificaFuente('fabricado.mjs', FABRICADO);
  assert.equal(hallados.length, 1, `🔴 no ve la llamada mínima: ${JSON.stringify(hallados)}`);
  assert.equal(hallados[0].acusado, true, '🔴 un `spawnSync(process.execPath, …)` sin `env` que parsea su stdout tiene que acusarse.');
  assert.equal(hallados[0].envClase, null);
});

test('SCRUM-1153 · ✅ NEGATIVO DERIVADO: el MISMO caso, saneado mecánicamente, sale limpio', () => {
  const arreglado = saneado(FABRICADO);
  assert.notEqual(arreglado, FABRICADO, '🔴 la sustitución no tocó nada: el negativo no está probando el arreglo.');
  const hallados = clasificaFuente('fabricado.mjs', arreglado);
  assert.equal(hallados.length, 1, `🔴 el saneado rompió el reconocimiento de la llamada: ${JSON.stringify(hallados)}`);
  assert.equal(hallados[0].acusado, false,
    `🔴 sigue acusando después de construir el env a mano y borrar las tres variables: ${JSON.stringify(hallados[0])}`);
  assert.equal(hallados[0].envClase, 'A_MANO');
});

// Y la mitad que decide que el detector no acusa A TODO (SCRUM-940 §): sin `process.execPath` no
// hay `node` hijo, aunque el resto sea idéntico.
test('SCRUM-1153 · NEGATIVO: un hijo que NO es `node` no se acusa, aunque parsee stdout sin env', () => {
  const otroProceso = FABRICADO.replace('process.execPath', "'git'");
  const hallados = clasificaFuente('fabricado.mjs', otroProceso);
  assert.deepEqual(hallados, [], '🔴 acusa a cualquier `spawnSync`, no sólo a los que lanzan un `node` hijo: eso mediría la mitad de la casa.');
});

test('SCRUM-1153 · NEGATIVO: si no se parsea `stdout`, no es este defecto (sólo mira el status)', () => {
  const soloStatus = FABRICADO.replace(
    "return Number((r.stdout.match(/^\\u2139 tests (\\d+)/m) || [])[1] || 0);",
    'return r.status;',
  );
  const hallados = clasificaFuente('fabricado.mjs', soloStatus);
  assert.deepEqual(hallados, [],
    '🔴 acusa una llamada que sólo mira el código de salida: eso es `reales-por-biseccion.mjs` '
    + '(SCRUM-940), y ese fichero no parsea NADA — no es este defecto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ 🔴 POR QUÉ SCRUM-940 Y SCRUM-928C **NO** SON CONTROL POSITIVO DE ESTE CENSO
//
// El encargo (SCRUM-1153) los cita en su tabla de motivación junto a SCRUM-938 como "casos ya
// confirmados", y su criterio de aceptación #1 pide que el censo acuse "los tres casos históricos
// de arriba". Medido contra el código real, no se sostiene para dos de los tres — y se deja
// escrito aquí, con el código real que lo demuestra, en vez de forzar un fixture que no reproduce
// el fichero que de verdad existió.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1153 · 🔴 ④ SCRUM-940 no tiene sujeto `spawn`: su defecto es un `\\b` dentro de una regex', () => {
  // El propio código de SCRUM-940 (hoy, en main) no contiene ninguna llamada de la familia spawn.
  const suelos = deGit('HEAD', 'scripts/_censo-de-suelos.mjs');
  const hallados = clasificaFuente('_censo-de-suelos.mjs', suelos);
  assert.deepEqual(hallados, [],
    '🔴 si esto deja de estar vacío, `_censo-de-suelos.mjs` ha empezado a lanzar hijos: revisar '
    + 'si de verdad hace falta ampliar el alcance de SCRUM-1153.');
});

test('SCRUM-1153 · 🔴 ④ `correrPaso` (SCRUM-928c) spawnea `bash`, no `node`, y no parsea `stdout`', () => {
  const vigia = deGit('HEAD', 'tests/scrum853c-el-vigia-no-se-cree-un-error.test.mjs');
  const hallados = clasificaFuente('scrum853c-el-vigia-no-se-cree-un-error.test.mjs', vigia);
  assert.deepEqual(hallados, [],
    '🔴 si esto deja de estar vacío, `correrPaso` ha empezado a lanzar un `node` hijo cuyo stdout '
    + 'se parsea: entonces SÍ sería control positivo de este censo, y hay que añadirlo arriba. Hoy '
    + 'spawnea `bash` (el `node` real corre DENTRO del guion, como texto sustituido — invisible '
    + 'para este AST) y lee ficheros del temporal, no `r.stdout`.');
});

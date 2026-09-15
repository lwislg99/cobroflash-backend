// tests/scrum850b-las-formas-que-mienten.test.mjs — SCRUM-850b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS FORMAS DE INVOCAR LA TANDA, REPRODUCIDAS — no citadas
//
// SCRUM-850 dejó el censo y el guard. Esto añade dos cosas que le faltaban:
//
//   ① un BANCO que ejecuta una tanda de verdad —con un test rojo a propósito— por cada forma,
//      y enseña cuál devuelve 0 con el rojo dentro. Hasta ahora las formas estaban NOMBRADAS
//      en una lista de casos; aquí se MIDEN;
//   ② el hueco que ese banco destapó: el `&`.
//
// ── 🔴 EL HUECO, MEDIDO EL 15-sep-2026 ──────────────────────────────────────────────────
//
//     node --test rojo.test.mjs verde.test.mjs        -> exit 1   honesto
//     node --test rojo.test.mjs verde.test.mjs &      -> exit 0   🔴 MIENTE
//
// El censo lo daba por SANO porque `segmentar` sólo partía por `&&`. No es una prohibición
// nueva: es el mismo criterio de `|` y `;` —«este separador se come el veredicto»— aplicado al
// separador que faltaba.
//
// ── ⚠️ Y UN ERROR PROPIO, PORQUE CASI CUESTA EL GUARD BUENO ─────────────────────────────
//
// La primera versión partía por CUALQUIER `&`, y entonces marcaba `npm test > salida.txt 2>&1`
// —la forma SANA, la que la casa recomienda— como si se comiera el veredicto. Un guard que
// marca de más se acaba apagando, y habría apagado el bueno. Lo cazó el propio banco. El
// criterio final es de forma: un `&` pegado a un `>` o un `<` es REDIRECCIÓN, no segundo plano.
//
// ── LO QUE SE REPORTA Y NO SE ARREGLA AQUÍ ──────────────────────────────────────────────
//
// `set -o pipefail; npm test | tail` es HONESTA (medido: exit 1) y el censo la marca TUBERIA.
// Es un falso positivo real, pero HOY no tiene víctima —el árbol tiene 0 invocaciones que se
// coman el código—, así que se declara y no se le fabrica una excepción: una excepción que
// nadie necesita es una puerta que alguien usará.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { veredictoDeLinea, segmentar, VEREDICTOS, censar } from '../scripts/_invocaciones-de-la-tanda.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_invocaciones-de-la-tanda.mjs',
    de: "      if (!esRedireccion) { out.push({ texto: buf, sep: '&' }); buf = ''; continue; }",
    a: '      if (false) { /* el hueco del `&`, reabierto a proposito */ }',
    cae: '🔴 `&` manda la tanda al segundo plano y el veredicto se pierde',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL BANCO · una tanda DE VERDAD, con un rojo dentro, invocada de cada forma
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Monta la tanda de laboratorio y devuelve cómo invocarla.
 *
 * ⚠️ Los ficheros se pasan UNO A UNO y la carpeta vive donde node sepa resolverla. La primera
 * versión de este banco usaba `mktemp -d` y `node --test <carpeta>`: en Windows eso da
 * «Cannot find module», así que el `exit 1` del control venía del CRASH y no del test rojo —
 * y la tabla entera medía otra cosa. Por eso el suelo de abajo no es adorno.
 */
function bancoDeTanda() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanda850b-'));
  const rojo = path.join(dir, 'rojo.test.mjs');
  const verde = path.join(dir, 'verde.test.mjs');
  fs.writeFileSync(rojo, "import test from 'node:test';\nimport assert from 'node:assert/strict';\n"
    + "test('ESTE TEST FALLA A PROPOSITO', () => { assert.equal(1, 2); });\n");
  fs.writeFileSync(verde, "import test from 'node:test';\ntest('este pasa', () => {});\n");
  // Las rutas van con BARRA NORMAL: una ruta de Windows dentro de `bash -c` pierde las
  // contrabarras como escapes, y entonces node no resuelve el fichero y el banco no corre.
  const q = (s) => '"' + s.split(path.sep).join('/') + '"';
  return { dir, tanda: [q(process.execPath), '--test', '--test-force-exit', q(rojo), q(verde)].join(' ') };
}

/**
 * 🔴 EL ENTORNO SE LIMPIA, Y ES LO QUE HACE QUE ESTE BANCO EXISTA.
 *
 * `node --test` marca a sus hijos con `NODE_TEST_CONTEXT`, y si ve esa marca se NIEGA a
 * ejecutar: «run() is being called recursively within a test file. skipping running files.»
 * — y sale con 0 y un aviso. O sea: un banco que lance una tanda desde dentro de la tanda mide
 * un runner que no ha corrido, y todas sus filas serían ruido con forma de tabla.
 *
 * Es exactamente la familia de este ticket, una vuelta más adentro: el instrumento contesta algo
 * plausible sin haber medido. Por eso el suelo de aquí abajo exige ver el nombre del test rojo
 * en la salida antes de creerse ni una fila.
 */
const ENTORNO_LIMPIO = (() => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; })();

const enShell = (cmd) => {
  try {
    execFileSync('bash', ['-c', cmd], { stdio: 'pipe', encoding: 'utf8', env: ENTORNO_LIMPIO });
    return { code: 0 };
  } catch (e) { return { code: e.status ?? -1, salida: String(e.stdout || '') }; }
};
const salidaDe = (cmd) => {
  try { return execFileSync('bash', ['-c', cmd], { stdio: 'pipe', encoding: 'utf8', env: ENTORNO_LIMPIO }); }
  catch (e) { return String(e.stdout || '') + String(e.stderr || ''); }
};

test('SCRUM-850b · 🔴 SUELO DEL BANCO: la tanda corre, y su rojo es el del TEST', () => {
  const { dir, tanda } = bancoDeTanda();
  try {
    const salida = salidaDe(tanda + ' 2>&1');
    assert.match(salida, /FALLA A PROPOSITO/,
      '🔴 el banco no está ejecutando el test rojo: lo que salga de él no significa nada. '
      + '(Pasó de verdad: con la carpeta de `mktemp`, node daba «Cannot find module» y el rojo '
      + 'era del crash.)');
    assert.match(salida, /este pasa/, '🔴 el banco tampoco ejecuta el verde: no hay tanda.');
    assert.notEqual(enShell(tanda).code, 0, '🔴 la tanda de laboratorio no sale en rojo.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-850b · 🔴 LAS FORMAS, EJECUTADAS: cuáles devuelven 0 con un test en rojo', () => {
  const { dir, tanda } = bancoDeTanda();
  try {
    // [forma, ¿se espera que MIENTA?]
    const FORMAS = [
      [tanda, false],
      [tanda + ' 2>&1 | tail -3', true],
      [tanda + ' 2>&1 | head -3', true],
      [tanda + ' 2>&1 | cat', true],
      [tanda + ' 2>&1 | grep -q "FALLA A PROPOSITO"', true],
      ['{ ' + tanda + ' >/dev/null 2>&1; echo x >/dev/null; }', true],
      ['( ' + tanda + ' >/dev/null 2>&1 & ) ; sleep 1', true],
      ['if ' + tanda + ' >/dev/null 2>&1; then :; fi', true],
      [tanda + ' > "' + path.join(dir, 'o.txt') + '" 2>&1', false],
      [tanda + ' >/dev/null 2>&1 && echo x >/dev/null', false],
      ['RES="$(' + tanda + ' 2>&1)"', false],
    ];
    const sorpresas = [];
    for (const [cmd, deberiaMentir] of FORMAS) {
      const miente = enShell(cmd + ' >/dev/null 2>&1').code === 0;
      if (miente !== deberiaMentir) sorpresas.push((miente ? 'MIENTE y no se esperaba' : 'ya NO miente') + ': ' + cmd.replace(tanda, '<tanda>'));
    }
    assert.deepEqual(sorpresas, [],
      '🔴 el shell ya no se comporta como se midió el 15-sep-2026:\n  ' + sorpresas.join('\n  ')
      + '\n  Re-medir antes de tocar el censo: lo que decide es esta tabla, no la lista de casos.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL HUECO CERRADO · el `&`
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-850b · 🔴 el censo VE el `&` — era el hueco', () => {
  for (const linea of ['npm test &', 'npm test & echo hecho', 'npm run test:staging:gated &']) {
    const h = veredictoDeLinea(linea);
    assert.equal(h.length, 1, `no ve la invocación en: ${linea}`);
    assert.equal(h[0].veredicto, VEREDICTOS.SEGUNDO_PLANO,
      `🔴 «${linea}» sale ${h[0].veredicto}. Una tanda en segundo plano devuelve el código del `
      + 'SHELL, que es 0 siempre: el veredicto se pierde entero.');
  }
});

test('SCRUM-850b · 🔴 CONTROL NEGATIVO: una REDIRECCIÓN con `&` no es segundo plano', () => {
  // El error que casi me cuesta el guard bueno. `> fichero 2>&1` es la forma SANA y la que la
  // casa recomienda: marcarla habría hecho que alguien apagara el guard en dos semanas.
  for (const linea of [
    'npm test > salida.txt 2>&1',
    'npm test 2>&1 > salida.txt',
    'npm test &> salida.txt',
    'npm test >&2',
  ]) {
    const h = veredictoDeLinea(linea);
    assert.equal(h.length, 1, `no ve la invocación en: ${linea}`);
    assert.equal(h[0].veredicto, VEREDICTOS.SANO,
      `🔴 «${linea}» se marca como ${h[0].veredicto}, y es una REDIRECCIÓN, no un segundo plano. `
      + 'Un guard que marca la forma buena es un guard que alguien va a apagar.');
  }
  // Y `&&` sigue partiendo como `&&`, no como dos `&`.
  assert.deepEqual(segmentar('npm run build && npm test').map((s) => s.sep), ['&&', null]);
  assert.equal(veredictoDeLinea('npm run build && npm test')[0].veredicto, VEREDICTOS.SANO);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LO QUE NO SE ARREGLA, DICHO — y comprobado que sigue siendo verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-850b · el falso positivo de `pipefail` SIGUE ahí, y se declara', () => {
  // Reportado, no arreglado: hoy no tiene víctima (el árbol tiene 0 invocaciones que se coman
  // el código) y una excepción que nadie necesita es una puerta que alguien usará. Si algún día
  // alguien escribe una invocación así, este test le recuerda que está declarado.
  assert.equal(veredictoDeLinea('set -o pipefail; npm test | tail -3').some(
    (h) => h.veredicto === VEREDICTOS.TUBERIA), true,
    'si esto ha dejado de ser verdad, alguien le ha metido la excepción: que venga con su '
    + 'medición y su motivo, no de tapadillo.');
});

test('SCRUM-850b · SUELO: el árbol NO tiene hoy ninguna invocación con `&`', () => {
  // La otra dirección del suelo: si mañana entra una, el guard de SCRUM-850 la cazará. Hoy se
  // deja constancia MEDIDA de que el hueco estaba abierto y vacío — que no es lo mismo que
  // «no existía».
  const c = censar(RAIZ).invocaciones.map((h) => h.veredicto);
  assert.ok(c.length > 0, '🔴 CIEGO: el censo no ve ninguna invocación en el árbol.');
  assert.equal(c.includes(VEREDICTOS.SEGUNDO_PLANO), false,
    '🔴 ha entrado una invocación de la tanda en segundo plano. Su veredicto se pierde entero.');
});

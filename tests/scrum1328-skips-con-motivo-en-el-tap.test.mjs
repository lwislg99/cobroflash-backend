// tests/scrum1328-skips-con-motivo-en-el-tap.test.mjs — SCRUM-1328 ④
//
// EL CONTROL POSITIVO QUE PEDÍA EL TICKET: un TAP de la tanda con FALLOS dentro sigue leyéndose, y los
// `# SKIP` con su motivo siguen apareciendo. SCRUM-1289/1289b arreglaron que un nieto `node --test`
// pisara el TAP; sus bancos miden una tanda VERDE, sin un solo salto. Lo que `CLAUDE.md` enseña a hacer
// con ese TAP (`grep "# SKIP"`, bloque de comandos) es leer los saltos, y si el TAP vuelve a romperse los
// saltos desaparecen SIN AVISAR: un `grep` sobre NUL da cero líneas, y cero se lee como «nada saltó».
//
// Se mide EL VIAJE, como 1289b: una tanda de juguete con los reporters en `NODE_OPTIONS` (como `ci.yml`),
// un nieto que los hereda, y un fichero con un test que cae, un salto CON motivo, uno SIN motivo y un
// test que pasa con «# SKIP» dentro de su NOMBRE (la cruz dentro del nombre, cicatriz ③ del equipo).
//   · con `tanda-con-veredicto.mjs` el TAP sale entero: el fallo por su nombre, el motivo LITERAL, el
//     salto mudo señalado, y los saltos leídos SUMAN lo que declara `# skipped N`;
//   · SIN el envoltorio (el control sembrado), el mismo lector tiene que decir CIEGO, no «0 saltos».
//
// La población de cada lectura es el resumen del propio TAP: pass + fail + skipped + cancelled + todo
// tienen que dar `# tests N`, y los saltos leídos tienen que dar `# skipped N`. Si no suman, se está
// contando texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { integridadTap } from '../scripts/equipo/por-que-cayo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENVOLTORIO = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Quitar el arreglo de 1289b: los reporters se quedan en NODE_OPTIONS y el nieto vuelve a pisar.
    fichero: 'scripts/tanda-con-veredicto.mjs',
    de: 'const lanzar = reportersComoArgumentos(orden, args, process.env);',
    a: 'const lanzar = { args, env: process.env, movidos: [] }; // sin mover los reporters, a proposito',
    cae: 'CON el envoltorio, el TAP de una tanda ROJA',
  },
  {
    // Un lector que no mira la integridad cuenta saltos sobre un TAP pisado: «0 saltos» donde no miró.
    fichero: 'tests/scrum1328-skips-con-motivo-en-el-tap.test.mjs',
    // Con la línea de antes: a secas, el ancla casaba también con esta misma declaración (SCRUM-1321).
    de: '  const integ = integridadTap(buf);\n  if (!integ.ok) return { ciego: true, motivo: integ.motivo };',
    a: '  const integ = integridadTap(buf);\n  // sin mirar la integridad, a proposito',
    cae: 'CONTROL SEMBRADO: SIN el envoltorio el mismo lector dice CIEGO',
  },
];

// ═══ EL LECTOR ═══════════════════════════════════════════════════════════════════════════

const SKIP = / # SKIP(?: (.*))?$/; // un `#` del nombre va escapado (`\#`): éste es el de la directiva

/**
 * Los saltos de un TAP, con su motivo, o CIEGO si el TAP no se puede leer como el de UNA tanda.
 * Sólo líneas de test de la RAÍZ (sin sangría): el caso se ancla al inicio, no se cuenta la cruz suelta.
 */
export function saltosDelTap(buf) {
  const integ = integridadTap(buf);
  if (!integ.ok) return { ciego: true, motivo: integ.motivo };
  const lineas = buf.toString('utf8').split(/\r?\n/);
  const cifra = (clave) => {
    const m = lineas.map((l) => new RegExp(`^# ${clave} (\\d+)$`).exec(l)).filter(Boolean);
    return m.length === 1 ? Number(m[0][1]) : null;
  };
  const resumen = Object.fromEntries(['tests', 'pass', 'fail', 'skipped', 'cancelled', 'todo'].map((k) => [k, cifra(k)]));
  const saltos = [];
  const fallos = [];
  for (const l of lineas) {
    const m = /^(not )?ok \d+ - (.*)$/.exec(l);
    if (!m) continue;
    const s = SKIP.exec(m[2]);
    if (s) saltos.push({ nombre: m[2].slice(0, s.index), motivo: (s[1] ?? '').trim() });
    else if (m[1]) fallos.push(m[2]);
  }
  const suma = resumen.pass + resumen.fail + resumen.skipped + resumen.cancelled + resumen.todo;
  return {
    ciego: false,
    resumen,
    cuadra: Object.values(resumen).every((v) => v !== null) && suma === resumen.tests,
    saltos,
    sinMotivo: saltos.filter((s) => s.motivo === '').map((s) => s.nombre),
    perdidos: (resumen.skipped ?? 0) - saltos.length,
    fallos,
  };
}

/** La receta de `CLAUDE.md` tal cual: `grep "# SKIP"` sobre el fichero, sin anclar. */
const recetaDeClaudeMd = (buf) => buf.toString('utf8').split(/\r?\n/).filter((l) => l.includes('# SKIP'));

// ═══ EL BANCO ════════════════════════════════════════════════════════════════════════════

const MOTIVO = 'sin QA_DB_TEST=1 · SCRUM-1328 cuarto caso';
const CAE = 'cae a proposito · SCRUM-1328';
const PRIMEROS = 20;
const TOTAL = PRIMEROS + 1 + 5; // a-primero + b-lanza + c-mezcla

const opcionesDelCi = (tap) =>
  `--test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=${tap}`;

function banco() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1328-'));
  fs.writeFileSync(path.join(dir, 'nieto.test.mjs'), "import test from 'node:test';\ntest('nieto', () => {});\n");
  // Como en el CI, el padre ya ha ESCRITO parte de su TAP cuando el nieto trunca (cicatriz de J3, 1-oct).
  fs.writeFileSync(path.join(dir, 'a-primero.test.mjs'),
    "import test from 'node:test';\n" +
    `for (let i = 0; i < ${PRIMEROS}; i++) test('primero con un nombre largo para ocupar bytes ' + i, () => {});\n`);
  // La forma de scrum976 ANTES de SCRUM-1289: borra NODE_TEST_CONTEXT y NO borra NODE_OPTIONS.
  fs.writeFileSync(path.join(dir, 'b-lanza.test.mjs'), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { spawnSync } from 'node:child_process';",
    "test('lanza su propio node --test', () => {",
    '  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;',
    "  const r = spawnSync(process.execPath, ['--test', 'nieto.test.mjs'], { cwd: import.meta.dirname, env, encoding: 'utf8' });",
    "  assert.equal(r.status, 0, 'el nieto tiene que correr: ' + r.stderr);",
    '});',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'c-mezcla.test.mjs'), [
    "import test from 'node:test';",
    "test('pasa', () => {});",
    "test('pasa con # SKIP dentro de su nombre', () => {});",
    `test('salta con motivo', { skip: ${JSON.stringify(MOTIVO)} }, () => {});`,
    "test('salta sin motivo', { skip: true }, () => {});",
    `test(${JSON.stringify(CAE)}, () => { throw new Error('rojo sembrado'); });`,
    '',
  ].join('\n'));
  return dir;
}

function correr(dir, conEnvoltorio) {
  const tap = path.join(dir, conEnvoltorio ? 'con.tap' : 'sin.tap');
  const env = { ...process.env, NODE_OPTIONS: opcionesDelCi(tap) };
  delete env.NODE_TEST_CONTEXT;
  delete env.FORCE_COLOR;
  const orden = ['--test', '--test-force-exit', '--test-concurrency=1', 'a-primero.test.mjs', 'b-lanza.test.mjs', 'c-mezcla.test.mjs'];
  const r = conEnvoltorio
    ? spawnSync(process.execPath, [ENVOLTORIO, 'node', ...orden], { cwd: dir, env, encoding: 'utf8' })
    : spawnSync(process.execPath, orden, { cwd: dir, env, encoding: 'utf8' });
  return { r, buf: fs.existsSync(tap) ? fs.readFileSync(tap) : Buffer.alloc(0) };
}

// ═══ EL VIAJE ════════════════════════════════════════════════════════════════════════════

test('SCRUM-1328 ④ · 🔴 CON el envoltorio, el TAP de una tanda ROJA se lee entero: el fallo, el motivo y el salto mudo', () => {
  const dir = banco();
  try {
    const { r, buf } = correr(dir, true);
    assert.equal(r.status, 1, `la tanda lleva un rojo sembrado y tiene que salir 1: ${r.status} · ${r.stderr.slice(-400)}`);
    const t = saltosDelTap(buf);
    assert.equal(t.ciego, false, `🔴 EL TAP NO SE PUEDE LEER con el envoltorio: ${t.motivo}`);
    assert.equal(t.resumen.tests, TOTAL, 'la población del TAP es la tanda entera');
    assert.equal(t.cuadra, true, `pass+fail+skipped+cancelled+todo no da tests: ${JSON.stringify(t.resumen)}`);
    assert.deepEqual(t.fallos, [CAE], 'el fallo se lee POR SU NOMBRE, y es el único');
    assert.equal(t.resumen.skipped, 2);
    assert.equal(t.perdidos, 0, 'los saltos leídos suman lo que declara `# skipped N`');
    assert.deepEqual(t.saltos, [
      { nombre: 'salta con motivo', motivo: MOTIVO },
      { nombre: 'salta sin motivo', motivo: '' },
    ]);
    assert.deepEqual(t.sinMotivo, ['salta sin motivo'], 'el salto sin motivo se SEÑALA, no se cuenta como uno más');
    // Y la receta de CLAUDE.md, sobre el mismo fichero, enseña el motivo literal…
    const receta = recetaDeClaudeMd(buf);
    assert.ok(receta.some((l) => l.endsWith(`# SKIP ${MOTIVO}`)), `la receta no enseña el motivo:\n${receta.join('\n')}`);
    // …pero casa también con el nombre que lleva «# SKIP» dentro, DOS veces: su `ok` y su cabecera
    // `# Subtest:` (medido: yo esperaba una). Por eso el lector se ancla al caso y cuadra con el resumen.
    assert.equal(receta.length, t.resumen.skipped + 2,
      `grep a secas debería ver los 2 saltos y las 2 líneas del nombre trampa:\n${receta.join('\n')}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-1328 ④ · 🔴 CONTROL SEMBRADO: SIN el envoltorio el mismo lector dice CIEGO, no «0 saltos»', () => {
  const dir = banco();
  try {
    const { buf } = correr(dir, false);
    assert.ok(buf.length > 0, 'el banco no escribió ningún TAP: no hay nada que mirar');
    const t = saltosDelTap(buf);
    assert.equal(t.ciego, true,
      '🔴 NO SUPE REPRODUCIR LA AVERÍA: con el nieto pisando, el TAP salió legible ' +
      `(${JSON.stringify(t.resumen)}). Sin esto, el verde del caso de arriba no prueba nada.`);
    assert.match(t.motivo, /NUL|resúmenes/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ═══ EL LECTOR, SOBRE TAPs FABRICADOS ════════════════════════════════════════════════════

const tap = (cuerpo, { tests, pass, fail = 0, skipped }) =>
  `TAP version 13\n${cuerpo}1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${pass}\n# fail ${fail}\n` +
  `# cancelled 0\n# skipped ${skipped}\n# todo 0\n# duration_ms 1\n`;

test('SCRUM-1328 ④ · 🔴 un salto PERDIDO (el resumen declara 2 y el TAP enseña 1) se detecta', () => {
  const t = saltosDelTap(Buffer.from(tap('ok 1 - a\nok 2 - b # SKIP motivo\n', { tests: 3, pass: 1, skipped: 2 })));
  assert.equal(t.ciego, false);
  assert.equal(t.perdidos, 1);
});

test('SCRUM-1328 ④ · el «# SKIP» escapado dentro de un nombre y el salto de un subtest sangrado no cuentan', () => {
  const cuerpo = 'ok 1 - nombre con \\# SKIP dentro\n    ok 1 - hijo # SKIP de un subtest\nok 2 - b # SKIP motivo\n';
  const t = saltosDelTap(Buffer.from(tap(cuerpo, { tests: 2, pass: 1, skipped: 1 })));
  assert.deepEqual(t.saltos, [{ nombre: 'b', motivo: 'motivo' }]);
  assert.equal(t.perdidos, 0);
});

test('SCRUM-1328 ④ · CONTROL: un TAP con NUL o con dos resúmenes es CIEGO, aunque traiga saltos legibles', () => {
  const sano = tap('ok 1 - b # SKIP motivo\n', { tests: 1, pass: 0, skipped: 1 });
  assert.equal(saltosDelTap(Buffer.from(sano)).ciego, false);
  assert.equal(saltosDelTap(Buffer.from(sano.replace('TAP version 13\n', 'TAP version 13\n' + '\0'.repeat(50)))).ciego, true);
  assert.equal(saltosDelTap(Buffer.from(sano + '# tests 4\n')).ciego, true);
  assert.equal(saltosDelTap(Buffer.alloc(0)).ciego, true);
});

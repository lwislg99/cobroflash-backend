// tests/scrum1321-el-resumen-no-prueba-el-final.test.mjs — SCRUM-1321
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL META-GUARD DIJO «EL TÍTULO CAMBIÓ» SOBRE UN TEST QUE NADIE HABÍA RENOMBRADO.
//
// El 1-oct-2026 el job del meta-guard sacó `scrum859 · CIEGO` en dos PR con esta explicación:
//
//     resumen SÍ llegó en 1019 ms: node:test contó 16 tests (…) frente a los 16 que este script
//     acumuló. CUADRAN: el fichero terminó con normalidad — si el test buscado no aparece, el
//     título cambió.
//
// Con esa frase se abrió SCRUM-1321 pidiendo arreglar un renombrado. No lo había: el título está
// igual desde el 15-sep, y la misma línea del log decía que la pasada LIMPIA traía 20 tests y la
// mutada 16. Faltaban cuatro. El diagnóstico (SCRUM-1100) daba por hecho que `test:summary` viaja
// desde el hijo y que si llega y cuadra es que el fichero acabó. Aquí se MIDE que no: lo escribe
// el proceso padre con lo que le llegó, así que llega y cuadra siempre.
//
// Tres cosas, y cada una con el caso que la haría fallar:
//   ① la SONDA contra `node:test` de verdad — el hecho que sostiene todo lo demás;
//   ② el diagnóstico: con la limpia delante cuenta y NOMBRA lo que falta, y no acusa de renombrar;
//   ③ la puerta de `aplicarUna`: un ancla que casa dos veces sale CIEGA y no se muta nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  diagnosticoDeCorte, ausentesRespectoALaLimpia, aplicarUna,
} from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El diagnóstico deja de mirar la limpia: vuelve a no saber qué falta.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return NOMBRES_DE(limpia).filter((n) => !vistos.has(n));',
    a: '  return []; // SCRUM-1321: no falta nunca nada, a proposito',
    cae: 'SCRUM-1321 · 🔴 EL CASO MEDIDO: 20 en la limpia y 16 en la mutada',
  },
];

// ═══ ① LA SONDA · ¿quién escribe `test:summary`? ═════════════════════════════════════════════

/** Cinco tests; con MORIR=1 el tercero mata el proceso con código 0. Cada uno deja su testigo (A21). */
const COBAYA = [
  "import test from 'node:test';",
  "import fs from 'node:fs';",
  "const marca = (n) => fs.appendFileSync(process.env.TESTIGO, n + '\\n');",
  "test('uno', () => { marca('uno'); });",
  "test('dos', () => { marca('dos'); });",
  "test('tres', () => { marca('tres'); if (process.env.MORIR === '1') process.exit(0); });",
  "test('cuatro', () => { marca('cuatro'); });",
  "test('cinco', () => { marca('cinco'); });",
  '',
].join('\n');

/** Corre la cobaya con `run()`, igual que `correr()` del meta-guard, y saca lo que vio por stdout. */
const SONDA = [
  "import { run } from 'node:test';",
  "import fs from 'node:fs';",
  'const [cobaya, testigo] = process.argv.slice(2);',
  'process.env.TESTIGO = testigo;',
  'const nombres = []; let resumen = null;',
  'const flujo = run({ files: [cobaya], forceExit: true, timeout: 60000 });',
  'for await (const ev of flujo) {',
  "  if (ev.type === 'test:pass' || ev.type === 'test:fail') nombres.push(ev.data.name);",
  "  else if (ev.type === 'test:summary') resumen = ev.data;",
  '}',
  "const ejecutados = fs.existsSync(testigo) ? fs.readFileSync(testigo, 'utf8').trim().split('\\n') : [];",
  'process.stdout.write(JSON.stringify({ nombres, ejecutados, tests: resumen ? resumen.counts.tests : null }));',
  '',
].join('\n');

function sondear(morir) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1321-sonda-'));
  try {
    const cobaya = path.join(dir, 'cobaya.mjs');
    const sonda = path.join(dir, 'sonda.mjs');
    fs.writeFileSync(cobaya, COBAYA);
    fs.writeFileSync(sonda, SONDA);
    // El entorno del hijo, a mano (patrón de SCRUM-813/938/1153/1308): con el NODE_TEST_CONTEXT del
    // runner que corre ESTE test no ejecuta nada, y con el NODE_OPTIONS del CI pisaría el TAP.
    const env = { ...process.env, MORIR: morir ? '1' : '0' };
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_OPTIONS;
    delete env.FORCE_COLOR;
    const r = spawnSync(process.execPath, [sonda, cobaya, path.join(dir, 'testigo.txt')],
      { cwd: dir, encoding: 'utf8', env });
    let medida = null;
    try { medida = JSON.parse(r.stdout); } catch { /* se decide abajo: sin medida es CIEGO */ }
    return { status: r.status, stderr: r.stderr, medida };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('SCRUM-1321 · 🔴 LA SONDA: un fichero que muere a medias entrega resumen, y el resumen CUADRA', () => {
  // CONTROL primero: la cobaya entera. Sin él, «llegan menos de cinco» podría ser que la sonda no
  // sabe leer, y lo de abajo mediría el instrumento en vez de a `node:test`.
  const entera = sondear(false);
  assert.ok(entera.medida, `🔴 CIEGO: la sonda no dejó medida (status ${entera.status}): ${entera.stderr}`);
  assert.deepEqual(entera.medida.ejecutados, ['uno', 'dos', 'tres', 'cuatro', 'cinco'],
    '🔴 CIEGO: la cobaya entera no ejecutó sus cinco tests. La sonda no arrancó lo que dice.');
  assert.equal(entera.medida.nombres.length, 5, '🔴 la cobaya entera no reportó sus cinco tests.');
  assert.equal(entera.medida.tests, 5);

  const cortada = sondear(true);
  assert.ok(cortada.medida, `🔴 CIEGO: la sonda no dejó medida (status ${cortada.status}): ${cortada.stderr}`);
  // El sujeto EXISTIÓ y murió donde tenía que morir: tres de cinco, por el testigo y no por lo que
  // reporta `node:test`, que es justo lo que está en duda.
  assert.deepEqual(cortada.medida.ejecutados, ['uno', 'dos', 'tres'],
    '🔴 la cobaya no murió en el tercer test: el caso no es el que este test dice provocar.');
  assert.ok(cortada.medida.nombres.length < 5,
    '🔴 un fichero que murió en el tercero reporta sus cinco tests: entonces no se pierde nada '
    + 'y este ticket no tiene caso.');

  // 🔴 LO QUE DECIDE. Si un día `node:test` dejara de emitir el resumen cuando el hijo muere a
  // medias, o lo emitiera con el recuento REAL del fichero, estos dos asertos caerían — y sería
  // una buena noticia: el resumen volvería a servir de prueba, y `diagnosticoDeCorte` se podría
  // apoyar en él otra vez. Mientras pasen, «llegó y cuadra» no dice NADA de cómo acabó el fichero.
  assert.notEqual(cortada.medida.tests, null,
    '✅ CAMBIO DE COMPORTAMIENTO: el resumen ya NO llega cuando el fichero muere a medias. '
    + 'Su ausencia vuelve a ser una prueba de corte: revisa `diagnosticoDeCorte` (SCRUM-1321).');
  assert.equal(cortada.medida.tests, cortada.medida.nombres.length,
    '✅ CAMBIO DE COMPORTAMIENTO: el resumen ya NO cuadra con lo que llegó cuando el fichero '
    + 'muere a medias. Vuelve a servir de prueba: revisa `diagnosticoDeCorte` (SCRUM-1321).');
});

// ═══ ② EL DIAGNÓSTICO ════════════════════════════════════════════════════════════════════════

/** El caso del log del 1-oct (job 110167478819), con sus recuentos: limpia 20, mutada 9 + 7. */
const N = (prefijo, n) => Array.from({ length: n }, (_, i) => `${prefijo} ${i + 1}`);
const BUSCADO = 'SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave';
const PERDIDOS = [BUSCADO, 'perdido 2', 'perdido 3', 'perdido 4'];
const LIMPIA = { pasados: [...N('llega', 16), ...PERDIDOS], caidos: [], saltados: [] };
const MUTADA = {
  pasados: N('llega', 16).slice(0, 9),
  caidos: N('llega', 16).slice(9),
  saltados: [],
  resumen: { counts: { tests: 16, passed: 9, skipped: 0 } },
  duracionMs: 1019,
  timeoutMs: 300000,
};

test('SCRUM-1321 · 🔴 EL CASO MEDIDO: 20 en la limpia y 16 en la mutada → dice que FALTAN 4, los nombra, y no acusa de renombrar', () => {
  assert.equal(LIMPIA.pasados.length, 20, '🔴 el caso no reproduce los 20 de la pasada limpia.');
  assert.equal(MUTADA.pasados.length + MUTADA.caidos.length, 16, '🔴 el caso no reproduce los 16 de la mutada.');
  assert.deepEqual(ausentesRespectoALaLimpia(MUTADA, LIMPIA), PERDIDOS);

  const d = diagnosticoDeCorte(MUTADA, LIMPIA);
  assert.match(d, /FALTAN 4 de los 20/, `🔴 no cuenta lo que falta respecto a la limpia: ${d}`);
  assert.ok(d.includes(`«${BUSCADO}»`),
    '🔴 dice que faltan y no dice CUÁLES. Sin los nombres, la próxima vez tampoco habrá con qué acotar la pérdida.');
  assert.match(d, /NO es un título renombrado/,
    '🔴 no descarta el renombrado. Ese test pasó con ese nombre en la limpia, un momento antes.');
  assert.doesNotMatch(d, /el título cambió/,
    '🔴 vuelve la frase que mandó a dos sesiones a buscar un renombrado que no existía.');
  assert.doesNotMatch(d, /terminó con normalidad/,
    '🔴 afirma que el fichero terminó con normalidad a partir de un resumen que escribe el padre.');
});

test('SCRUM-1321 · ✅ NEGATIVO: si NO falta ninguno respecto a la limpia, no se inventa un corte', () => {
  // Sin esto, «dice que faltan» y «dice siempre que faltan» dan el mismo verde en el test de arriba.
  const completa = { ...MUTADA, pasados: LIMPIA.pasados.slice(0, 13), caidos: LIMPIA.pasados.slice(13) };
  assert.deepEqual(ausentesRespectoALaLimpia(completa, LIMPIA), []);
  const d = diagnosticoDeCorte(completa, LIMPIA);
  assert.doesNotMatch(d, /FALTAN/, `🔴 acusa un corte con los 20 tests delante: ${d}`);
  assert.match(d, /no falta NINGUNO de los 20/);
});

test('SCRUM-1321 · sin la pasada limpia no afirma NADA: ni corte ni renombrado', () => {
  const d = diagnosticoDeCorte(MUTADA);
  assert.match(d, /Sin la pasada limpia delante no se puede decir qué falta/);
  assert.doesNotMatch(d, /el título cambió/);
  assert.doesNotMatch(d, /terminó con normalidad/);
  // Y lo que SCRUM-1100 ya hacía bien sigue en pie: sin resumen lo dice, y sin datos no evalúa.
  assert.match(diagnosticoDeCorte({ ...MUTADA, resumen: null }, LIMPIA), /SIN RESUMEN/);
  assert.match(diagnosticoDeCorte({}, LIMPIA), /NO EVALUABLE/);
});

// ═══ ③ LA PUERTA DE `aplicarUna` ═════════════════════════════════════════════════════════════

test('SCRUM-1321 · 🔴 PUERTA 1b: un ancla que casa DOS veces sale CIEGA nombrando las líneas, y NO se muta nada', async () => {
  // El fichero vigilado y el guard viven FUERA del árbol: si la puerta no parase, lo que se
  // mutaría es este temporal y no un fichero del repositorio.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1321-puerta-'));
  try {
    const vigilado = path.join(dir, 'vigilado.yml');
    const ORIGINAL = "        if: a == 'si' && b == 'true'\n        id: accion\n        if: a == 'si'\n";
    fs.writeFileSync(vigilado, ORIGINAL);
    const guard = path.join(dir, 'fixture.test.mjs');
    fs.writeFileSync(guard, "import test from 'node:test';\ntest('uno', () => {});\n");
    const fichero = path.relative(RAIZ, vigilado);
    assert.ok(fs.existsSync(path.join(RAIZ, fichero)),
      '🔴 CIEGO: el temporal no se alcanza desde la raíz del repo (¿otra unidad?). No se ha medido nada.');
    // La línea base, fabricada: el test nombrado «pasó» y el árbol estaba quieto. Así se llega
    // a la puerta que se quiere medir, y no se queda en PUERTA 0 ni en PUERTA 1.
    const limpia = { pasados: ['uno'], caidos: [], saltados: [], errores: {}, movidos: [] };

    const r = await aplicarUna({ fichero, de: "        if: a == 'si'", a: '        if: always()', cae: 'uno' }, guard, limpia);
    assert.equal(r.ok, false);
    assert.equal(r.mudo, undefined,
      '🔴 sale MUDO: acusa al guard de no vigilar cuando la declaración no dice qué quiere mutar. '
      + 'Es el veredicto falso que `scrum853` llevó más de 40 horas.');
    assert.match(String(r.ciego), /aparece 2 veces/);
    assert.match(String(r.ciego), /líneas 1, 3/, '🔴 no dice dónde están las dos ocurrencias.');
    assert.equal(fs.readFileSync(vigilado, 'utf8'), ORIGINAL, '🔴 la puerta dice que no muta, y ha mutado.');

    // 🔴 CONTROL NEGATIVO: la puerta no dispara sobre todo. Un ancla que NO está sigue saliendo
    // por su propia puerta, con su propio motivo — si las dos dijeran lo mismo, no distinguiría.
    const r2 = await aplicarUna({ fichero, de: 'if: esto no está', a: 'x', cae: 'uno' }, guard, limpia);
    assert.match(String(r2.ciego), /el ancla no está/);
    assert.doesNotMatch(String(r2.ciego), /aparece \d+ veces/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

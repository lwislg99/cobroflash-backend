// docs/master/evidencias/SCRUM-1405/cobaya.mjs — SCRUM-1405
//
// EL REPRODUCTOR MÍNIMO Y SU TESTIGO (autorizados en SCRUM-1339 c.17951 ① y ②).
//
// Genera EN UNA CARPETA DE FUERA DEL ÁRBOL un fichero de test (la cobaya) y lo lanza N veces con
// `node --test`, con y sin `--test-force-exit`. Cada caso de la cobaya deja una línea en un fichero
// TESTIGO con una escritura síncrona, ANTES de terminar: es lo único que separa «el caso no se
// ejecutó» de «se ejecutó y su informe no llegó». No se instrumenta ningún fichero de `tests/`.
//
// La cobaya no vive en el repositorio: aquí sólo está su plantilla, como texto.
//
//   node docs/master/evidencias/SCRUM-1405/cobaya.mjs <carpeta de fuera, sin espacios> \
//        [--pasadas N] [--carga M] [--solo A,B] [--reales tests/x.test.mjs,tests/y.test.mjs]
//
// Imprime UNA fila por pasada (TSV, a <carpeta>/cobaya-pasadas.tsv) y, SIEMPRE, una línea por
// celda: «N pasadas · K con casos ausentes». También cuando K es 0 (c.17951, control ③).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// ── argumentos ────────────────────────────────────────────────────────────────────────────
const [carpeta, ...resto] = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = resto.indexOf(`--${nombre}`);
  return i === -1 ? porDefecto : resto[i + 1];
};
if (!carpeta) {
  console.error('uso: node cobaya.mjs <carpeta de fuera del árbol, sin espacios> [--pasadas N] [--carga M] [--solo A,B] [--reales a,b]');
  process.exit(2);
}
const DIR = path.resolve(carpeta);
if (/\s/.test(DIR)) {
  console.error(`🔴 la carpeta lleva espacios (${DIR}): NODE_OPTIONS partiría la ruta de la sonda. Otra carpeta.`);
  process.exit(2);
}
const PASADAS = Number(opcion('pasadas', '20'));
const CARGA = Number(opcion('carga', '0'));
const SOLO = opcion('solo', '') ? opcion('solo', '').split(',') : null;
const REALES = opcion('reales', '') ? opcion('reales', '').split(',') : [];

// ── las celdas ────────────────────────────────────────────────────────────────────────────
// La «grande» escribe mucho más de lo que cabe en una tubería de Linux (64 KB) y lo hace de un
// tirón: casos síncronos, sin soltar el bucle. La «pequeña» cabe entera. La «asíncrona» escribe lo
// mismo que la grande pero suelta el bucle en cada caso.
const GRANDE = { casos: 80, relleno: 600, copias: 4, modo: 'sinc' };
const CELDAS = [
  { id: 'A-con-grande', flag: true, ...GRANDE },
  { id: 'B-sin-grande', flag: false, ...GRANDE },
  { id: 'C-con-grande-bloqueante', flag: true, ...GRANDE, sonda: true, bloqueante: true },
  { id: 'D-con-grande-sonda', flag: true, ...GRANDE, sonda: true },
  { id: 'E-con-asincrona', flag: true, ...GRANDE, modo: 'asinc' },
  { id: 'F-con-pequena', flag: true, casos: 10, relleno: 0, copias: 4, modo: 'sinc' },
  { id: 'G-con-rojo-en-la-cola', flag: true, ...GRANDE, rojoEn: 80 },
  { id: 'H-sin-rojo-en-la-cola', flag: false, ...GRANDE, rojoEn: 80 },
  { id: 'I-cortado-en-el-40', flag: false, ...GRANDE, copias: 1, cortaEn: 40 },
  { id: 'J-con-grande-una-copia', flag: true, ...GRANDE, copias: 1 },
  { id: 'K-sin-grande-sonda', flag: false, ...GRANDE, sonda: true },
].filter((c) => !SOLO || SOLO.includes(c.id.split('-')[0]));

// ── la plantilla de la cobaya ─────────────────────────────────────────────────────────────
function fuenteDeLaCobaya({ copia, casos, relleno, modo, rojoEn = 0, cortaEn = 0 }) {
  const asinc = modo === 'asinc';
  return [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import fs from 'node:fs';",
    'const TESTIGO = process.env.COBAYA_TESTIGO;',
    `const RELLENO = 'x'.repeat(${relleno});`,
    `for (let i = 1; i <= ${casos}; i++) {`,
    "  const n = String(i).padStart(3, '0');",
    `  test(\`cobaya ${copia} caso \${n} \${RELLENO}\`, ${asinc ? 'async ' : ''}() => {`,
    `    fs.appendFileSync(TESTIGO, \`${copia} \${n}\\n\`);`,
    asinc ? '    await new Promise((r) => setImmediate(r));' : '',
    cortaEn ? `    if (i === ${cortaEn}) process.exit(0);` : '',
    rojoEn ? `    assert.notEqual(i, ${rojoEn}, 'rojo sembrado en la cola');` : '',
    '  });',
    '}',
    '',
  ].filter((l) => l !== '').join('\n') + '\n';
}

// ── el entorno del sujeto se construye a mano (A21: no se le presta el del laboratorio) ────
function entornoLimpio(extra) {
  const e = {};
  for (const k of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 'TMPDIR', 'SystemRoot', 'SYSTEMROOT', 'LANG']) {
    if (process.env[k] !== undefined) e[k] = process.env[k];
  }
  return { ...e, ...extra };
}
function entornoDeLaTanda() {
  const e = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete e[k];
  return e;
}

// ── lectura del TAP ───────────────────────────────────────────────────────────────────────
function leerElTap(ruta) {
  let texto = '';
  try { texto = fs.readFileSync(ruta, 'utf8'); } catch { return null; }
  const informados = new Map(); // «copia nnn» → 'ok' | 'not ok'
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*(not ok|ok) \d+ - cobaya (\S+) caso (\d+)/.exec(linea);
    if (m) informados.set(`${m[2]} ${m[3]}`, m[1]);
  }
  const numero = (clave) => {
    const m = new RegExp(`^# ${clave} (\\d+)`, 'm').exec(texto);
    return m ? Number(m[1]) : null;
  };
  return { informados, tests: numero('tests'), pass: numero('pass'), fail: numero('fail'), bytes: Buffer.byteLength(texto) };
}

function leerLasSondas(dirSonda) {
  const filas = [];
  let nombres = [];
  try { nombres = fs.readdirSync(dirSonda); } catch { return filas; }
  for (const n of nombres) {
    try { filas.push(JSON.parse(fs.readFileSync(path.join(dirSonda, n), 'utf8'))); } catch { /* fila ilegible: se nota en el recuento */ }
  }
  return filas;
}

// ── una pasada de una celda ───────────────────────────────────────────────────────────────
function pasadaDeCelda(celda, i) {
  const base = path.join(DIR, celda.id);
  fs.mkdirSync(base, { recursive: true });
  const ficheros = [];
  for (let c = 1; c <= celda.copias; c++) {
    const f = path.join(base, `cobaya-c${c}.test.mjs`);
    if (i === 1) fs.writeFileSync(f, fuenteDeLaCobaya({ ...celda, copia: `c${c}` }));
    ficheros.push(f);
  }
  const testigo = path.join(base, 'testigo.txt');
  const tap = path.join(base, 'pasada.tap');
  const dirSonda = path.join(base, 'sonda');
  fs.rmSync(testigo, { force: true });
  fs.rmSync(tap, { force: true });
  fs.rmSync(dirSonda, { recursive: true, force: true });
  const extra = { COBAYA_TESTIGO: testigo };
  if (celda.sonda) {
    fs.mkdirSync(dirSonda, { recursive: true });
    extra.SONDA_1405_DIR = dirSonda;
    extra.NODE_OPTIONS = `--import=${pathToFileURL(path.join(DIR, 'sonda.mjs')).href}`;
    if (celda.bloqueante) extra.SONDA_1405_BLOQUEANTE = '1';
  }
  const args = ['--test', ...(celda.flag ? ['--test-force-exit'] : []), '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...ficheros];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: base, env: entornoLimpio(extra), timeout: 180_000, windowsHide: true });
  const ms = Date.now() - t0;

  const declarados = [];
  for (let c = 1; c <= celda.copias; c++) for (let k = 1; k <= celda.casos; k++) declarados.push(`c${c} ${String(k).padStart(3, '0')}`);
  let lineasTestigo = [];
  try { lineasTestigo = fs.readFileSync(testigo, 'utf8').split('\n').filter(Boolean); } catch { /* sin testigo: la pasada es CIEGA */ }
  const ejecutados = new Set(lineasTestigo);
  const t = leerElTap(tap);
  const informados = t ? t.informados : new Map();
  const ausentes = declarados.filter((d) => !informados.has(d));
  const ausentesEjecutados = ausentes.filter((d) => ejecutados.has(d));
  // ¿es la cola? por cada copia, lo que falta tiene que ser «del m al último», sin huecos
  let forma = ausentes.length ? 'cola' : '-';
  for (let c = 1; c <= celda.copias && ausentes.length; c++) {
    const faltan = ausentes.filter((d) => d.startsWith(`c${c} `)).map((d) => Number(d.split(' ')[1]));
    if (faltan.length && faltan[0] + faltan.length - 1 !== celda.casos) forma = 'otra';
  }
  const sondas = celda.sonda ? leerLasSondas(dirSonda) : [];
  const pend = sondas.map((s) => Math.max(s.pendientes ?? 0, s.cola ?? 0));
  return {
    celda: celda.id, pasada: i, flag: celda.flag ? 'con' : 'sin', modo: celda.modo, casos: celda.casos, copias: celda.copias, carga: CARGA,
    salida: r.status === null ? `señal ${r.signal}` : r.status,
    declarados: declarados.length, ejecutados: ejecutados.size, informados: informados.size,
    ausentes: ausentes.length, ausentes_ejecutados: ausentesEjecutados.length, ausentes_no_ejecutados: ausentes.length - ausentesEjecutados.length,
    forma, tap_tests: t ? t.tests : 'SIN TAP', tap_fail: t ? t.fail : 'SIN TAP',
    rojos_esperados: celda.rojoEn ? celda.copias : 0, rojos_en_tap: [...informados.values()].filter((v) => v === 'not ok').length,
    sondas: celda.sonda ? sondas.length : '-', sondas_con_pendientes: celda.sonda ? pend.filter((p) => p > 0).length : '-',
    pendientes_max: celda.sonda ? (pend.length ? Math.max(...pend) : 'SIN SONDA') : '-',
    escritos_max: celda.sonda ? (sondas.length ? Math.max(...sondas.map((s) => s.escritos ?? 0)) : 'SIN SONDA') : '-',
    bloqueante: celda.sonda ? [...new Set(sondas.map((s) => s.bloqueante))].join('|') : '-',
    ms,
  };
}

// ── una pasada de un fichero REAL, a solas, sin tocarlo ───────────────────────────────────
function pasadaDeReal(fichero, flag, i) {
  const id = `real-${path.basename(fichero).replace(/\.test\.mjs$/, '')}-${flag ? 'con' : 'sin'}`;
  const base = path.join(DIR, id);
  fs.mkdirSync(base, { recursive: true });
  const tap = path.join(base, 'pasada.tap');
  fs.rmSync(tap, { force: true });
  const args = ['--test', ...(flag ? ['--test-force-exit'] : []), '--test-reporter=tap', `--test-reporter-destination=${tap}`, fichero];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: process.cwd(), env: entornoDeLaTanda(), timeout: 300_000, windowsHide: true });
  const t = leerElTap(tap);
  return { celda: id, pasada: i, flag: flag ? 'con' : 'sin', salida: r.status === null ? `señal ${r.signal}` : r.status, tap_tests: t ? t.tests : 'SIN TAP', tap_fail: t ? t.fail : 'SIN TAP', ms: Date.now() - t0 };
}

// ── la batería ────────────────────────────────────────────────────────────────────────────
fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(path.join(AQUI, 'sonda.mjs'), path.join(DIR, 'sonda.mjs'));

const cargas = [];
for (let k = 0; k < CARGA; k++) cargas.push(spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore', windowsHide: true }));
const pararCargas = () => { for (const c of cargas) { try { c.kill('SIGKILL'); } catch { /* ya no está */ } } };
process.on('exit', pararCargas);

console.log(`POBLACIÓN · node ${process.version} · ${process.platform} · ${os.availableParallelism()} hilos · ${PASADAS} pasadas por celda · ${CELDAS.length} celdas de cobaya · ${REALES.length} ficheros reales · carga ${CARGA} procesos`);

const filas = [];
const filasReales = [];
for (let i = 1; i <= PASADAS; i++) {
  for (const celda of CELDAS) filas.push(pasadaDeCelda(celda, i));
  for (const f of REALES) for (const flag of [true, false]) filasReales.push(pasadaDeReal(f, flag, i));
}
pararCargas();

const aTsv = (fs_) => (fs_.length ? [Object.keys(fs_[0]).join('\t'), ...fs_.map((f) => Object.values(f).join('\t'))].join('\n') + '\n' : '');
const sufijo = `carga${CARGA}`;
fs.writeFileSync(path.join(DIR, `cobaya-pasadas-${sufijo}.tsv`), aTsv(filas));
if (filasReales.length) fs.writeFileSync(path.join(DIR, `reales-pasadas-${sufijo}.tsv`), aTsv(filasReales));

const cuenta = (lista) => {
  const m = {};
  for (const x of lista) m[x] = (m[x] || 0) + 1;
  return Object.entries(m).sort().map(([k, v]) => `${k}×${v}`).join(' ') || '(nada)';
};
const suma = (lista, campo) => lista.reduce((a, f) => a + (Number(f[campo]) || 0), 0);

console.log('\n── LA COBAYA ──');
for (const celda of CELDAS) {
  const mias = filas.filter((f) => f.celda === celda.id);
  const ciegas = mias.filter((f) => f.ejecutados === 0);
  const conAusentes = mias.filter((f) => f.ausentes > 0);
  console.log(
    `${celda.id} · carga ${CARGA} · ${mias.length} pasadas · ${conAusentes.length} con casos ausentes`
    + ` · casos ausentes ${suma(mias, 'ausentes')} (ejecutados ${suma(mias, 'ausentes_ejecutados')}, NO ejecutados ${suma(mias, 'ausentes_no_ejecutados')})`
    + ` · forma ${cuenta(conAusentes.map((f) => f.forma))}`
    + ` · salidas ${cuenta(mias.map((f) => f.salida))}`
    + (celda.rojoEn ? ` · rojos en el TAP ${suma(mias, 'rojos_en_tap')} de ${suma(mias, 'rojos_esperados')} · pasadas con salida 0: ${mias.filter((f) => f.salida === 0).length}` : '')
    + (celda.sonda ? ` · pasadas con bytes pendientes al salir ${mias.filter((f) => Number(f.sondas_con_pendientes) > 0).length} · de ellas con ausentes ${mias.filter((f) => Number(f.sondas_con_pendientes) > 0 && f.ausentes > 0).length} · con ausentes y SIN pendientes ${mias.filter((f) => !(Number(f.sondas_con_pendientes) > 0) && f.ausentes > 0).length} · bloqueante ${cuenta(mias.map((f) => f.bloqueante))}` : '')
    + (ciegas.length ? ` · 🔴 ${ciegas.length} pasadas CIEGAS (testigo vacío: la cobaya no corrió)` : ''),
  );
}
if (REALES.length) {
  console.log('\n── FICHEROS REALES, A SOLAS (sin testigo: no se tocan) ──');
  for (const id of [...new Set(filasReales.map((f) => f.celda))]) {
    const mias = filasReales.filter((f) => f.celda === id);
    const n = mias.map((f) => f.tap_tests).filter((x) => typeof x === 'number');
    const max = n.length ? Math.max(...n) : null;
    console.log(`${id} · carga ${CARGA} · ${mias.length} pasadas · ${n.filter((x) => x < max).length} por debajo de su máximo (${max}) · # tests ${cuenta(mias.map((f) => f.tap_tests))} · salidas ${cuenta(mias.map((f) => f.salida))}`);
  }
}
console.log(`\nEXIT=0 · filas ${filas.length} + ${filasReales.length} · ${path.join(DIR, `cobaya-pasadas-${sufijo}.tsv`)}`);

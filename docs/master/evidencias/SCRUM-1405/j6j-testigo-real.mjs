// docs/master/evidencias/SCRUM-1405/j6j-testigo-real.mjs — SCRUM-1405, tramo de J6j
//
// EL TESTIGO DENTRO DE UN FICHERO REAL. Hasta hoy, «los casos que faltan SE EJECUTARON» estaba medido
// con testigo sólo en una cobaya fabricada; los ficheros reales se midieron SIN TOCAR (por `# tests`).
// Este guion le pone el testigo a UNO real y contesta: de los casos que no informan, ¿todos tienen
// su línea de «empecé»?
//
// ⛔ No se lanza contra el árbol de trabajo de nadie: el fichero real se reescribe EN SU SITIO (misma
// ruta, mismos imports relativos) y se restaura al acabar, con su sha256 comprobado. Exige
// `--en-sitio` para que nadie lo haga sin querer. En CI corre sobre la copia desechable del runner.
//
// El testigo: UNA línea del fichero real cambia, la de `import test from 'node:test';`, y en su
// sitio va (en una sola línea, para no mover ninguna otra) un envoltorio de `test` que apunta
//   DECLARADO <nombre>   al declarar el caso (carga del módulo)
//   INICIO <nombre>      al entrar en el cuerpo del caso, antes de ejecutar nada suyo
// con `appendFileSync` a un fichero aparte (TESTIGO_1405). Nada a la salida estándar: no añade ni un
// byte a la tubería cuya pérdida se mide.
//
// Antes de medir el real, TRES controles fabricados, por el MISMO instrumentar() y el MISMO analizar():
//   presente  10 casos verdes                    → 0 ausentes, 10 con testigo
//   corte     10 casos, el 5.º hace process.exit  → 6..10 ausentes y SIN testigo (no se ejecutaron);
//                                                   el 5.º, si falta, CON testigo (empezó)
//   ciego     el presente, sin TESTIGO_1405        → la pasada sale CIEGA, no «0 sin testigo»
// Si alguno no da lo esperado, el testigo no distingue y NO se mide el real: sale con 1.
//
// uso: node j6j-testigo-real.mjs <carpeta de fuera, sin espacios> --en-sitio
//        [--real tests/x.test.mjs] [--pasadas N] [--carga M] [--solo-controles]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const DIR = path.resolve(process.argv[2] || '');
const opcion = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const tiene = (n) => process.argv.includes(`--${n}`);
if (!process.argv[2] || process.argv[2].startsWith('--') || !tiene('en-sitio')) {
  console.error('uso: node j6j-testigo-real.mjs <carpeta de fuera> --en-sitio [--real tests/x.test.mjs] [--pasadas N] [--carga M] [--solo-controles]');
  process.exit(2);
}
const REAL = opcion('real', 'tests/scrum834-puerta-avisador-rojo.test.mjs');
const PASADAS = Number(opcion('pasadas', '20'));
const CARGA = Number(opcion('carga', '0'));
fs.mkdirSync(DIR, { recursive: true });

// ── el testigo ────────────────────────────────────────────────────────────────────────────
const LINEA_IMPORT = "import test from 'node:test';";
const ENVOLTORIO = "import testDelRunner1405 from 'node:test'; import fsTestigo1405 from 'node:fs'; const apunta1405 = (l) => { if (process.env.TESTIGO_1405) fsTestigo1405.appendFileSync(process.env.TESTIGO_1405, l + '\\n'); }; const test = (nombre, ...resto) => { const fn = resto.length && typeof resto[resto.length - 1] === 'function' ? resto.pop() : null; apunta1405('DECLARADO\\t' + JSON.stringify(nombre)); if (!fn) return testDelRunner1405(nombre, ...resto); return testDelRunner1405(nombre, ...resto, function (t) { apunta1405('INICIO\\t' + JSON.stringify(nombre)); return fn.call(this, t); }); }; // ← testigo de SCRUM-1405 (J6j); sólo en la copia desechable";

function instrumentar(texto) {
  const lineas = texto.split('\n');
  const donde = lineas.map((l, i) => (l.replace(/\r$/, '') === LINEA_IMPORT ? i : -1)).filter((i) => i >= 0);
  if (donde.length !== 1) throw new Error(`🔴 esperaba UNA línea «${LINEA_IMPORT}» y hay ${donde.length}: no instrumento a ciegas`);
  const otra = lineas.filter((l, i) => i !== donde[0] && /\bnode:test\b/.test(l) && !/^\s*\/\//.test(l));
  if (otra.length) throw new Error(`🔴 el fichero usa node:test por otra vía (${otra.length} líneas): el testigo no lo vería todo`);
  lineas[donde[0]] = ENVOLTORIO + (lineas[donde[0]].endsWith('\r') ? '\r' : '');
  return lineas.join('\n');
}

// ── lectura del TAP: casos de primer nivel, por NOMBRE ───────────────────────────────────────
function desescaparTap(s) {
  const mapa = { n: '\n', t: '\t', r: '\r', f: '\f', v: '\v', b: '\b', '#': '#', '\\': '\\' };
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length && mapa[s[i + 1]] !== undefined) { out += mapa[s[i + 1]]; i++; } else out += s[i];
  }
  return out;
}
function nombreDeLinea(resto) {
  // la directiva (# SKIP / # TODO) empieza en el primer « #» SIN escapar
  for (let i = 0; i < resto.length - 1; i++) {
    if (resto[i] === ' ' && resto[i + 1] === '#' && (i === 0 || resto[i - 1] !== '\\')) return desescaparTap(resto.slice(0, i));
  }
  return desescaparTap(resto);
}
function leerElTap(ruta) {
  let texto;
  try { texto = fs.readFileSync(ruta, 'utf8'); } catch { return null; }
  const informados = new Map(); // nombre → veces
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^(not ok|ok) \d+ - (.*)$/.exec(linea);
    if (!m) continue;
    const n = nombreDeLinea(m[2]);
    informados.set(n, (informados.get(n) || 0) + 1);
  }
  const num = (k) => { const m = new RegExp(`^# ${k} (\\d+)`, 'm').exec(texto); return m ? Number(m[1]) : null; };
  return { informados, tests: num('tests'), fail: num('fail'), bytes: Buffer.byteLength(texto) };
}
function leerElTestigo(ruta) {
  let texto;
  try { texto = fs.readFileSync(ruta, 'utf8'); } catch { return null; }
  const declarados = []; const iniciados = new Set();
  for (const l of texto.split('\n')) {
    const [tipo, json] = l.split('\t');
    if (!json) continue;
    if (tipo === 'DECLARADO') declarados.push(JSON.parse(json));
    else if (tipo === 'INICIO') iniciados.add(JSON.parse(json));
  }
  return { declarados, iniciados };
}

// ── una pasada ────────────────────────────────────────────────────────────────────────────
function entornoLimpio(extra) {
  const e = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'TESTIGO_1405']) delete e[k];
  return { ...e, ...extra };
}
function pasada({ brazo, fichero, cwd, flag, conTestigo, i, sinEntorno = false }) {
  const base = path.join(DIR, brazo);
  fs.mkdirSync(base, { recursive: true });
  const tap = path.join(base, 'pasada.tap');
  const testigo = path.join(base, 'testigo.txt');
  fs.rmSync(tap, { force: true }); fs.rmSync(testigo, { force: true });
  const args = ['--test', ...(flag ? ['--test-force-exit'] : []), '--test-reporter=tap', `--test-reporter-destination=${tap}`, fichero];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd, env: entornoLimpio(conTestigo && !sinEntorno ? { TESTIGO_1405: testigo } : {}), timeout: 300_000, killSignal: 'SIGKILL', windowsHide: true });
  const ms = Date.now() - t0;
  const t = leerElTap(tap);
  const w = conTestigo ? leerElTestigo(testigo) : null;
  const fila = { brazo, pasada: i, flag: flag ? 'con' : 'sin', testigo: conTestigo ? 'sí' : 'no', salida: r.status === null ? `señal ${r.signal}` : r.status, ms,
    tap_tests: t ? t.tests : 'SIN TAP', tap_fail: t ? t.fail : 'SIN TAP', informados: t ? [...t.informados.values()].reduce((a, b) => a + b, 0) : 0 };
  if (!conTestigo) return { ...fila, declarados: '-', ausentes: '-', ausentes_con_testigo: '-', ausentes_sin_testigo: '-', informados_sin_inicio: '-', primer_ausente: '-', forma: '-', ciega: '-', ausentes_nombres: [] };
  if (!w || w.declarados.length === 0) return { ...fila, declarados: 0, ausentes: '?', ausentes_con_testigo: '?', ausentes_sin_testigo: '?', informados_sin_inicio: '?', primer_ausente: '?', forma: '?', ciega: 'CIEGA', ausentes_nombres: [] };
  const inf = t ? t.informados : new Map();
  const ausentes = w.declarados.filter((n) => !inf.has(n));
  const con = ausentes.filter((n) => w.iniciados.has(n));
  const sin = ausentes.filter((n) => !w.iniciados.has(n));
  const informadosSinInicio = w.declarados.filter((n) => inf.has(n) && !w.iniciados.has(n)).length;
  const idx = ausentes.map((n) => w.declarados.indexOf(n));
  const forma = !ausentes.length ? '-' : (idx[0] + ausentes.length === w.declarados.length && idx.every((v, k) => v === idx[0] + k) ? 'cola' : 'otra');
  return { ...fila, declarados: w.declarados.length, ausentes: ausentes.length, ausentes_con_testigo: con.length, ausentes_sin_testigo: sin.length,
    informados_sin_inicio: informadosSinInicio, primer_ausente: ausentes.length ? idx[0] + 1 : '-', forma, ciega: 'no', ausentes_nombres: sin };
}

const aTsv = (filas) => {
  const cols = Object.keys(filas[0]).filter((c) => c !== 'ausentes_nombres');
  return [cols.join('\t'), ...filas.map((f) => cols.map((c) => String(f[c])).join('\t'))].join('\n') + '\n';
};
const suma = (filas, c) => filas.reduce((a, f) => a + (typeof f[c] === 'number' ? f[c] : 0), 0);

// ── 0 · control del lector: un TAP fabricado con un nombre que lleva lo que se escapa ───────
{
  const n = 'raro # con almohadilla \\ y barra';
  const tapF = path.join(DIR, 'control-lector.tap');
  fs.writeFileSync(tapF, `TAP version 13\nok 1 - ${n.replace(/\\/g, '\\\\').replace(/#/g, '\\#')}\nok 2 - saltado # SKIP motivo\n# tests 2\n`);
  const t = leerElTap(tapF);
  if (!t || !t.informados.has(n) || !t.informados.has('saltado') || t.tests !== 2) { console.error('🔴 CONTROL DEL LECTOR: no lee bien un TAP fabricado'); process.exit(1); }
  console.log('control del lector · ok (nombre escapado y directiva SKIP leídos)');
}

// ── 1 · los controles fabricados ─────────────────────────────────────────────────────────
const FIX = path.join(DIR, 'fixtures');
fs.mkdirSync(FIX, { recursive: true });
const fixture = (corteEn) => [
  "import test from 'node:test';",
  "import assert from 'node:assert/strict';",
  'for (let i = 1; i <= 10; i++) {',
  "  test(`fixture · caso ${String(i).padStart(2, '0')}`, () => {",
  corteEn ? `    if (i === ${corteEn}) process.exit(0);` : '',
  '    assert.equal(i, i);',
  '  });',
  '}',
  '',
].filter((l) => l !== '').join('\n');
fs.writeFileSync(path.join(FIX, 'presente.test.mjs'), instrumentar(fixture(0)));
fs.writeFileSync(path.join(FIX, 'corte.test.mjs'), instrumentar(fixture(5)));
const controles = [];
let controlRoto = 0;
for (const flag of [true, false]) {
  for (let i = 1; i <= 5; i++) {
    const p = pasada({ brazo: `ctrl-presente-${flag ? 'con' : 'sin'}`, fichero: 'presente.test.mjs', cwd: FIX, flag, conTestigo: true, i });
    const okP = p.declarados === 10 && p.ausentes === 0 && p.informados_sin_inicio === 0;
    const c = pasada({ brazo: `ctrl-corte-${flag ? 'con' : 'sin'}`, fichero: 'corte.test.mjs', cwd: FIX, flag, conTestigo: true, i });
    const nombres = new Set(c.ausentes_nombres);
    const okC = c.declarados === 10 && c.ausentes_sin_testigo === 5 && [6, 7, 8, 9, 10].every((k) => nombres.has(`fixture · caso ${String(k).padStart(2, '0')}`)) && c.ausentes_con_testigo >= 1;
    // ciego: el MISMO fichero instrumentado, sin decirle dónde apuntar → el analizador debe decir CIEGA
    const z = pasada({ brazo: `ctrl-ciego-${flag ? 'con' : 'sin'}`, fichero: 'presente.test.mjs', cwd: FIX, flag, conTestigo: true, i, sinEntorno: true });
    const okZ = z.salida === 0 && z.ciega === 'CIEGA';
    if (!okP || !okC || !okZ) controlRoto++;
    controles.push({ ...p, control: 'presente', esperado: okP ? 'sí' : 'NO' }, { ...c, control: 'corte', esperado: okC ? 'sí' : 'NO' },
      { ...z, control: 'ciego', esperado: okZ ? 'sí' : 'NO' });
  }
}
fs.writeFileSync(path.join(DIR, 'controles.tsv'), aTsv(controles));
const corteCon = controles.filter((f) => f.control === 'corte');
console.log(`CONTROLES · ${controles.length} pasadas (presente, corte, ciego × con/sin el flag × 5) · ${controlRoto} pasadas con algún control fuera de lo esperado`);
console.log(`  corte: ${suma(corteCon, 'ausentes')} ausentes · ${suma(corteCon, 'ausentes_con_testigo')} con testigo · ${suma(corteCon, 'ausentes_sin_testigo')} SIN testigo (deben ser 5 por pasada: ${corteCon.length * 5})`);
if (controlRoto) { console.error('🔴 EL TESTIGO NO DISTINGUE «se ejecutó y no informó» de «no se ejecutó»: no mido el real'); process.exit(1); }
console.log('  el testigo dice las dos cosas, y el analizador dice CIEGA cuando no hay testigo');
if (tiene('solo-controles')) process.exit(0);

// ── 2 · el fichero REAL ───────────────────────────────────────────────────────────────────
const RAIZ = process.cwd();
const rutaReal = path.join(RAIZ, REAL);
const original = fs.readFileSync(rutaReal);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const shaOriginal = sha(original);
const instrumentado = instrumentar(original.toString('utf8'));
const lineasO = original.toString('utf8').split('\n'); const lineasI = instrumentado.split('\n');
const distintas = lineasO.filter((l, i) => l !== lineasI[i]).length;
if (lineasO.length !== lineasI.length || distintas !== 1) { console.error(`🔴 la instrumentación cambia ${distintas} líneas (esperaba 1)`); process.exit(1); }
const casosPorTexto = lineasO.filter((l) => /^test\(/.test(l)).length;
console.log(`REAL · ${REAL} · sha256 ${shaOriginal.slice(0, 16)} · ${casosPorTexto} líneas «test(» en columna 0 · la instrumentación cambia 1 línea de ${lineasO.length}`);

const cargas = [];
for (let k = 0; k < CARGA; k++) cargas.push(spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore', windowsHide: true }));
const filas = [];
try {
  for (let i = 1; i <= PASADAS; i++) {
    // los tres brazos, intercalados: el mismo instante de la máquina para los tres
    fs.writeFileSync(rutaReal, original);
    filas.push(pasada({ brazo: 'sin-tocar-con-flag', fichero: REAL, cwd: RAIZ, flag: true, conTestigo: false, i }));
    fs.writeFileSync(rutaReal, instrumentado);
    filas.push(pasada({ brazo: 'testigo-con-flag', fichero: REAL, cwd: RAIZ, flag: true, conTestigo: true, i }));
    filas.push(pasada({ brazo: 'testigo-sin-flag', fichero: REAL, cwd: RAIZ, flag: false, conTestigo: true, i }));
  }
} finally {
  fs.writeFileSync(rutaReal, original);
  for (const c of cargas) c.kill('SIGKILL');
}
const shaFinal = sha(fs.readFileSync(rutaReal));
console.log(`restaurado · sha256 ${shaFinal === shaOriginal ? 'IGUAL al original' : '🔴 DISTINTO: ' + shaFinal}`);
fs.writeFileSync(path.join(DIR, `real-pasadas-carga${CARGA}.tsv`), aTsv(filas));
const sinTestigo = [];
for (const f of filas) for (const n of f.ausentes_nombres) sinTestigo.push(`${f.brazo}\t${f.pasada}\t${n}`);
fs.writeFileSync(path.join(DIR, `real-ausentes-sin-testigo-carga${CARGA}.tsv`), 'brazo\tpasada\tcaso\n' + sinTestigo.join('\n') + (sinTestigo.length ? '\n' : ''));

console.log(`POBLACIÓN · node ${process.version} · ${process.platform} · ${os.availableParallelism()} hilos · carga ${CARGA} · ${PASADAS} pasadas por brazo`);
for (const brazo of ['sin-tocar-con-flag', 'testigo-con-flag', 'testigo-sin-flag']) {
  const fs_ = filas.filter((f) => f.brazo === brazo);
  const bajo = fs_.filter((f) => typeof f.tap_tests !== 'number' || f.tap_tests < casosPorTexto).length;
  const salidas = [...new Set(fs_.map((f) => f.salida))].join('|');
  if (brazo === 'sin-tocar-con-flag') { console.log(`  ${brazo}: ${fs_.length} pasadas · ${bajo} con «# tests» por debajo de ${casosPorTexto} · salidas ${salidas}`); continue; }
  const conA = fs_.filter((f) => typeof f.ausentes === 'number' && f.ausentes > 0);
  console.log(`  ${brazo}: ${fs_.length} pasadas · ${fs_.filter((f) => f.ciega === 'CIEGA').length} CIEGAS · declarados por pasada ${[...new Set(fs_.map((f) => f.declarados))].join('|')} · ${bajo} con «# tests» por debajo de ${casosPorTexto} · ${conA.length} con casos ausentes · ${suma(fs_, 'ausentes')} casos ausentes · ${suma(fs_, 'ausentes_con_testigo')} CON testigo · ${suma(fs_, 'ausentes_sin_testigo')} SIN testigo · ${suma(fs_, 'informados_sin_inicio')} informados sin testigo · forma ${[...new Set(conA.map((f) => f.forma))].join('|') || '-'} · salidas ${salidas}`);
}
const sinT = suma(filas, 'ausentes_sin_testigo');
const ciegas = filas.filter((f) => f.ciega === 'CIEGA').length;
console.log(sinT ? `🔴 HALLAZGO · ${sinT} casos ausentes SIN testigo: no consta que se ejecutaran (lista en real-ausentes-sin-testigo-carga${CARGA}.tsv)` : `veredicto · 0 casos ausentes sin testigo${ciegas ? ` · ⚠️ ${ciegas} pasadas CIEGAS, sin juzgar` : ''}`);
process.exit(shaFinal === shaOriginal ? 0 : 1);

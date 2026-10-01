// banco.mjs — SCRUM-1391 · EJECUTAR las puertas con techo que SCRUM-1345 §⑤ dejó LEÍDAS.
//
// Qué hace: copia `scripts/` (y lo mínimo que necesita) a una carpeta FUERA del árbol, fabrica allí
// tests de mentira que agotan el plazo, y corre contra ellos el código REAL de cada puerta, sin
// modificarlo. Nada de esto toca el árbol: ni `tests/`, ni `tests/_guard-texto.mjs`, ni ningún guard.
// Los tests de mentira viven en cadenas, no en ficheros del repo: un fichero que registrara tests
// aquí lo denunciaría `tests/scrum708-el-fichero-que-no-corre.test.mjs`, y con razón.
//
//   node docs/master/evidencias/SCRUM-1391/banco.mjs todas --node-modules <carpeta node_modules> [--salidas <dir>]
//   node docs/master/evidencias/SCRUM-1391/banco.mjs <sonda|plazo-test|staging|empuje|meta-async|meta-sync|gateados|mudez|mudez-con-color> --node-modules <…>
//
// Se lanza desde la raíz del árbol que se quiere medir. `--node-modules` puede ser el de otro árbol
// (un worktree anidado no trae el suyo): se enlaza, no se copia, y el enlace se quita al acabar.
// `todas` lanza las nueve en paralelo (casi todo es esperar), guarda cada salida y escribe SIEMPRE la
// línea «N puertas ejercitadas · K con la forma · M que no se pudieron ejercitar», también con cero.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs';

const YO = fileURLToPath(import.meta.url);
const RAIZ = process.cwd();
const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const MODO = process.argv[2];
const NODE_MODULES = arg('--node-modules') ? path.resolve(arg('--node-modules')) : path.join(RAIZ, 'node_modules');
const ESPERA_MS = 330000; // un 10 % por encima de los 300 s de las dos puertas que usan `run()`
const t0 = Date.now();
const log = (s) => console.log('+' + ((Date.now() - t0) / 1000).toFixed(1) + 's ' + s);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const veredicto = (v) => console.log('VEREDICTO-PUERTA ' + JSON.stringify(v));

/** El entorno del sujeto, hecho a mano: sin el color del chat ni el contexto de un `node --test` padre. */
function entornoLimpio(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS']) if (!(k in extra)) delete env[k];
  return env;
}

/** ¿Es este árbol el commit que digo, y con las puertas sin tocar? Si no se puede saber, CIEGO. */
function cabecera(puerta) {
  let head = null; let sucio = null;
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim();
    sucio = execFileSync('git', ['status', '--porcelain', '--', 'scripts', 'tests/_guard-texto.mjs', 'tsconfig.json'], { cwd: RAIZ, encoding: 'utf8' }).trim();
  } catch { /* se dice abajo */ }
  log('BANCO SCRUM-1391 · puerta «' + puerta + '» · árbol ' + RAIZ + ' @ ' + (head || 'NO SE PUDO LEER') + ' · node ' + process.version + ' · ' + process.platform);
  if (!head || sucio) {
    log('CIEGO: ' + (!head ? 'no pude leer el commit del árbol' : 'el árbol tiene cambios en lo que se va a copiar:\n' + sucio));
    veredicto({ puerta, ejercitada: false, forma: null, frase: 'el banco no pudo arrancar sobre un árbol limpio' });
    console.log('EXIT=2'); process.exit(2);
  }
  if (!fs.existsSync(path.join(NODE_MODULES, 'typescript', 'package.json'))) {
    log('CIEGO: no hay `typescript` en ' + NODE_MODULES + ' — pásame --node-modules <carpeta>');
    veredicto({ puerta, ejercitada: false, forma: null, frase: 'el banco no encontró node_modules' });
    console.log('EXIT=2'); process.exit(2);
  }
}

/** Quita el enlace, y SÓLO el enlace. Dice si la copia ya se puede borrar sin tocar lo enlazado. */
function soltarEnlace(dir) {
  const enlace = path.join(dir, 'node_modules');
  try { fs.rmdirSync(enlace); } catch { try { fs.unlinkSync(enlace); } catch { /* se comprueba abajo */ } }
  return { quitado: !fs.existsSync(enlace), intacto: fs.existsSync(path.join(NODE_MODULES, 'typescript', 'package.json')) };
}

/** La copia fuera del árbol. Devuelve su carpeta. */
function montar(etiqueta) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1391-' + etiqueta + '-'));
  // Si algo revienta antes de `desmontar(dir)`, la copia se borra igual al salir el proceso, y por el
  // MISMO camino: primero el enlace. Por eso aquí NO va `temporal()`: su borrado no sabe que dentro
  // cuelga el `node_modules` de verdad, y si el enlace no se deja quitar la copia se QUEDA.
  process.on('exit', () => { const e = soltarEnlace(dir); if (e.quitado && e.intacto) fs.rmSync(dir, { recursive: true, force: true }); });
  fs.cpSync(path.join(RAIZ, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  for (const f of ['tsconfig.json', 'package.json']) fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.copyFileSync(path.join(RAIZ, 'tests', '_guard-texto.mjs'), path.join(dir, 'tests', '_guard-texto.mjs'));
  fs.symlinkSync(NODE_MODULES, path.join(dir, 'node_modules'), 'junction');
  return dir;
}

/** Quita PRIMERO el enlace (sólo el enlace) y sólo después borra la copia. */
function desmontar(dir) {
  const { quitado, intacto } = soltarEnlace(dir);
  if (quitado && intacto) fs.rmSync(dir, { recursive: true, force: true });
  log('copia desmontada: enlace quitado=' + quitado + ' · node_modules de verdad intacto=' + intacto + ' · carpeta borrada=' + !fs.existsSync(dir));
}

const escribir = (dir, nombre, lineas) => { const f = path.join(dir, nombre); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, lineas.join('\n') + '\n'); return f; };
const fin = (codigo = 0) => { console.log('EXIT=' + codigo); process.exit(codigo); };

// ── LOS TESTS DE MENTIRA (cadenas) ───────────────────────────────────────────────────────────────
const SALTADOS = [
  "import { test, before } from 'node:test';",
  "test('gateado-1', { skip: 'sin base' }, () => {});",
  "test('gateado-2', { skip: 'sin base' }, () => {});",
];
const ESPERA_ASYNC = 'await new Promise((s) => setTimeout(s, Number(process.env.COBAYA_ESPERA_MS)));';
const ESPERA_SYNC = 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.COBAYA_ESPERA_MS));';

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SONDA · qué entrega `run({ timeout })` de node:test cuando el plazo vence. Plazo corto (4 s).
// ═════════════════════════════════════════════════════════════════════════════════════════════
async function sonda() {
  cabecera('sonda');
  const { run } = await import('node:test');
  const dir = temporal('scrum1391-sonda-');
  const casos = [
    ['p1-async', ["import { test } from 'node:test';", "test('rapido', () => {});", "test('colgado-async', async () => { " + ESPERA_ASYNC + ' });', "test('despues', () => {});"]],
    ['p2-sync', ["import { test } from 'node:test';", "test('rapido', () => {});", "test('bloqueado-sync', () => { " + ESPERA_SYNC + ' });', "test('despues', () => {});"]],
    ['p5-gateado-con-before', [...SALTADOS, 'before(async () => { ' + ESPERA_ASYNC + ' });']],
    ['p6-gateado-que-muere', [...SALTADOS, "process.kill(process.pid, 'SIGKILL');"]],
  ];
  log('POBLACION: ' + casos.length + ' ficheros de mentira · plazo de run() 4000 ms · cada espera 12000 ms');
  process.env.COBAYA_ESPERA_MS = '12000';
  for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS']) delete process.env[k];
  for (const [nombre, lineas] of casos) {
    const f = escribir(dir, nombre + '.test.mjs', lineas);
    const ti = Date.now();
    const eventos = [];
    for await (const ev of run({ files: [f], forceExit: true, timeout: 4000 })) {
      const d = ev.data || {};
      if (ev.type === 'test:pass' || ev.type === 'test:fail') {
        const e = d.details && d.details.error;
        eventos.push(ev.type + ' «' + (path.isAbsolute(String(d.name)) ? 'RUTA DEL FICHERO' : d.name) + '»' + (d.skip ? ' skip' : '') + (e ? ' failureType=' + e.failureType : ''));
      } else if (ev.type === 'test:summary' && d.file) eventos.push('resumen ' + JSON.stringify({ tests: d.counts.tests, passed: d.counts.passed, failed: d.counts.failed, cancelled: d.counts.cancelled, skipped: d.counts.skipped }) + ' success=' + d.success);
    }
    log(nombre + ' · duró ' + ((Date.now() - ti) / 1000).toFixed(1) + ' s');
    for (const e of eventos) console.log('      ' + e);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fin(0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PUERTA · tests con plazo propio (`test(nombre, { timeout }, fn)`).
// ═════════════════════════════════════════════════════════════════════════════════════════════
function plazoTest() {
  cabecera('tests con plazo propio');
  const dir = temporal('scrum1391-plazo-');
  escribir(dir, 'con-plazo.test.mjs', ["import { test } from 'node:test';", "test('rapido', () => {});",
    "test('con plazo propio que vence', { timeout: 500 }, async () => { await new Promise((s) => setTimeout(s, 5000)); });"]);
  escribir(dir, 'orden.test.mjs', ["import { test } from 'node:test';",
    "test('opciones DESPUES de la funcion', async () => { await new Promise((s) => setTimeout(s, 2000)); }, { timeout: 500 });",
    "test('opciones ANTES de la funcion', { timeout: 500 }, async () => { await new Promise((s) => setTimeout(s, 2000)); });"]);
  log('POBLACION: 2 ficheros de mentira · 4 tests · plazos de 500 ms');
  const corre = (f) => {
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', f], { cwd: dir, encoding: 'utf8', env: entornoLimpio() });
    const out = r.stdout || '';
    const filas = out.split('\n').filter((l) => /^(not ok|ok) /.test(l) || /failureType/.test(l) || /^# (tests|pass|fail|cancelled) /.test(l)).map((l) => l.trim());
    return { status: r.status, filas, out };
  };
  const a = corre('con-plazo.test.mjs');
  log('① un plazo propio que vence → salida ' + a.status + ' · ' + a.filas.join(' · '));
  const b = corre('orden.test.mjs');
  log('② el orden de los argumentos → salida ' + b.status + ' · ' + b.filas.join(' · '));
  const control = a.filas.includes('ok 1 - rapido');
  const cae = a.status === 1 && a.filas.some((l) => l.startsWith('not ok 2 - con plazo propio que vence'));
  const ignorado = b.filas.some((l) => l.startsWith('ok 1 - opciones DESPUES'));
  fs.rmSync(dir, { recursive: true, force: true });
  veredicto({ puerta: 'tests con plazo propio', ejercitada: control, forma: control ? (cae ? 'si' : 'no') : null,
    frase: 'el plazo vencido sale `not ok`, salida 1, contado como `cancelled` y no como `fail`; unas opciones escritas DESPUÉS de la función ' + (ignorado ? 'se IGNORAN (el test de 2 s pasa con plazo de 500 ms)' : 'se aplican') });
  fin(0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PUERTA · staging-gated. NO se puede lanzar sin base. Se ejecutan sus dos mitades puras.
// ═════════════════════════════════════════════════════════════════════════════════════════════
async function staging() {
  cabecera('staging-gated');
  const de = (f) => import(pathToFileURL(path.join(RAIZ, 'scripts', f)).href);
  const { esAbortadoPorTiempo, medirMargen } = await de('_margen-tanda.mjs');
  const { validarEvidencia, mensajeVeredicto, CLAVES_HIJOS, SUELO_TOTAL } = await de('_evidencia-tanda.mjs');
  log('POBLACION: 3 hijos reales (plazo vencido · rojo que termina · verde) · claves de hijo del recibo: ' + CLAVES_HIJOS.join(', '));
  const lanzar = (codigo, timeout) => {
    const ti = Date.now();
    // Las mismas opciones que usa el runner (scripts/staging-gated.mjs, el `spawnSync` del bucle de hijos).
    const res = spawnSync(process.execPath, ['-e', codigo], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout, killSignal: 'SIGTERM' });
    return { res, margen: medirMargen(ti, timeout) };
  };
  const vistos = {};
  for (const [nombre, { res, margen }] of [
    ['plazo vencido', lanzar('setTimeout(() => {}, 30000)', 1000)],
    ['rojo que termina', lanzar('process.exit(1)', 20000)],
    ['verde', lanzar('process.exit(0)', 20000)],
  ]) {
    vistos[nombre] = esAbortadoPorTiempo(res);
    log('① ' + nombre + ' → status=' + res.status + ' signal=' + res.signal + ' error.code=' + (res.error && res.error.code) + ' durMs=' + margen.durMs + ' · esAbortadoPorTiempo=' + vistos[nombre]);
  }
  const recibo = (hijos, fail) => JSON.stringify({ commit: 'c'.repeat(40), huella: 'h'.repeat(64), huellaFicheros: 500, terminadaEn: new Date().toISOString(),
    total: SUELO_TOTAL + 9000, pass: SUELO_TOTAL + 9000 - fail, fail, skip: 0, ficheros: 1, hijos, autotest: false });
  const verde = { exit: 0, tests: 10, pass: 10, fail: 0 };
  const todos = (ultimo) => Object.fromEntries(CLAVES_HIJOS.map((c, i) => [c, i === CLAVES_HIJOS.length - 1 ? ultimo : verde]));
  const claves = {};
  for (const [nombre, texto] of [['plazo vencido', recibo(todos(null), 0)], ['rojo real', recibo(todos({ exit: 1, tests: 10, pass: 8, fail: 2 }), 2)]]) {
    const v = validarEvidencia({ texto, commitActual: 'c'.repeat(40), huellaActual: { huella: 'h'.repeat(64), ficheros: 500 }, ahoraMs: Date.now(), ficherosEsperados: 1 });
    const msg = mensajeVeredicto(v, { activo: true });
    claves[nombre] = v.problemas.map((p) => p.clave).join(',');
    log('② recibo de «' + nombre + ' en el último hijo» → claves [' + claves[nombre] + '] · remedio: ' + (/NO ES VÁLIDA/.test(msg) ? 'TANDA NO VÁLIDA, vuelve a lanzarla' : /salió ROJA/.test(msg) ? 'ROJA: ticket y cuarentena' : 'otro'));
  }
  veredicto({ puerta: 'staging-gated', ejercitada: false, forma: null,
    frase: 'no se puede lanzar sin base (toma el turno de staging antes del primer hijo); ejecutadas sus dos mitades puras: el plazo se reconoce (' + vistos['plazo vencido']
      + ') y el recibo lo separa del rojo ([' + claves['plazo vencido'] + '] frente a [' + claves['rojo real'] + ']); que los dos acaben en `fallaron` y salida 1 queda LEÍDO' });
  fin(0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PUERTA · puerta-claude-empuje (la décima del recuento: «no lo sé»).
// ═════════════════════════════════════════════════════════════════════════════════════════════
async function empuje() {
  cabecera('puerta-claude-empuje');
  const m = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'puerta-claude-empuje.mjs')).href);
  const dir = temporal('scrum1391-empuje-');
  const T = "import { test } from 'node:test';";
  escribir(dir, 'tests/verde.test.mjs', [T, "test('el que cayo en CI', () => {});"]);
  escribir(dir, 'tests/rojo.test.mjs', [T, "import assert from 'node:assert/strict';", "test('el que cayo en CI', () => { assert.equal(1, 2); });"]);
  escribir(dir, 'tests/cuelga-el-nombrado.test.mjs', [T, "test('otro que pasa', () => {});", "test('el que cayo en CI', async () => { await new Promise((s) => setTimeout(s, 60000)); });"]);
  escribir(dir, 'tests/cuelga-otro-despues.test.mjs', [T, "test('el que cayo en CI', () => {});", "test('otro que cuelga', async () => { await new Promise((s) => setTimeout(s, 60000)); });"]);
  const casos = ['verde', 'rojo', 'cuelga-el-nombrado', 'cuelga-otro-despues'];
  // `timeoutMs` es PARÁMETRO de `pasadaLocal` (por defecto 10 min): se le pasan 3 s. No se toca la puerta.
  log('POBLACION: ' + casos.length + ' ficheros de mentira (2 controles + 2 que agotan el plazo) · plazo pasado a pasadaLocal: 3000 ms');
  const r = {};
  for (const c of casos) {
    const fichero = 'tests/' + c + '.test.mjs';
    const fallos = [{ fichero, nombre: 'el que cayo en CI' }];
    const taps = m.pasadaLocal({ arbol: dir, fallos, dirTaps: path.join(dir, 'taps-' + c), env: entornoLimpio(), timeoutMs: 3000 });
    const tap = taps[fichero];
    const local = m.veredictoLocal(fallos, taps);
    const d = m.decidirEmpuje({ despertar: { avisador: true, runId: '1' }, commitsNuevos: 1, diagnostico: { ciego: false, fallos }, local });
    r[c] = d.codigo;
    log(c + ' · TAP: ' + (tap === null ? 'NO EXISTE' : m.leerTap(tap).map((x) => (x.ok ? 'ok ' : 'not ok ') + x.nombre).join(' | ') + ' · resumen: ' + (/^# tests/m.test(tap) ? 'SÍ' : 'NO'))
      + ' → ' + local[0].estado + ' → ' + d.codigo + ' (empujar=' + d.empujar + ')');
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const control = r.verde === 'EMPUJA-GUARD-VERDE' && r.rojo === 'NO-EMPUJA-SIGUE-ROJO';
  veredicto({ puerta: 'puerta-claude-empuje', ejercitada: control, forma: control ? (r['cuelga-el-nombrado'] === 'NO-EMPUJA-SIGUE-ROJO' ? 'si' : 'no') : null,
    frase: 'el test nombrado que agota el plazo sale ' + r['cuelga-el-nombrado'] + '; si el nombrado ya salió `ok` y lo que cuelga es otro, ' + r['cuelga-otro-despues'] });
  fin(0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PUERTA · el `run()` del meta-guard. `correr()` y `aplicarUna()` REALES sobre un guard MUDO por
// construcción: su test declarado no afirma nada del sujeto. La mutación sólo lo hace TARDAR.
// ═════════════════════════════════════════════════════════════════════════════════════════════
async function meta(forma) {
  cabecera('meta-guard (' + forma + ')');
  const dir = montar('meta-' + forma);
  log('copia en ' + dir + ' · scripts/meta-guard-mutaciones.mjs sha256 ' + sha(path.join(dir, 'scripts', 'meta-guard-mutaciones.mjs')) + ' (el del árbol: ' + sha(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')) + ')');
  const SUJETO = 'scripts/_sujeto-de-mentira.mjs';
  const GUARD = 'cobaya-muda.test.mjs';
  escribir(dir, SUJETO, ["export const MODO = 'normal';"]);
  escribir(dir, 'tests/' + GUARD, [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import fs from 'node:fs';",
    "import { MODO } from '../scripts/_sujeto-de-mentira.mjs';",
    "const anota = (s) => fs.appendFileSync(process.env.COBAYA_TESTIGO, new Date().toISOString() + ' ' + s + ' MODO=' + MODO + '\\n');",
    "anota('carga');",
    "test('control que pasa siempre', () => {});",
    "test('T-DECLARADO no mira el defecto', async () => {",
    "  anota('entra');",
    "  if (MODO === 'cuelga-async') " + ESPERA_ASYNC,
    "  if (MODO === 'cuelga-sync') " + ESPERA_SYNC,
    "  anota('sale');",
    '  assert.equal(1, 1);',
    '});',
    "test('el de despues', () => {});",
  ]);
  const TESTIGO = path.join(dir, 'testigo.txt');
  fs.writeFileSync(TESTIGO, '');
  Object.assign(process.env, { COBAYA_TESTIGO: TESTIGO, COBAYA_ESPERA_MS: String(ESPERA_MS) });
  for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS']) delete process.env[k];
  const m = await import(pathToFileURL(path.join(dir, 'scripts', 'meta-guard-mutaciones.mjs')).href);
  log('POBLACION: 1 guard de mentira (MUDO por construcción) · 2 mutaciones (control + la que sólo tarda) · espera ' + ESPERA_MS + ' ms · forma ' + forma);
  const pinta = (r) => 'pasados ' + r.pasados.length + ' · caídos ' + JSON.stringify(r.caidos.map((n) => (path.isAbsolute(n) ? 'RUTA DEL FICHERO' : n))) + ' · errores ' + JSON.stringify(r.errores)
    + ' · resumen ' + JSON.stringify(r.resumen && { tests: r.resumen.counts.tests, passed: r.resumen.counts.passed, failed: r.resumen.counts.failed, cancelled: r.resumen.counts.cancelled })
    + ' · duró ' + r.duracionMs + ' ms de ' + r.timeoutMs + ' · movidos ' + r.movidos.length;
  const nombre = (r) => (r.ok ? 'VIVA' : r.mudo ? 'MUDA' : r.muerto ? 'MUERTO' : r.ciego ? 'CIEGA' : 'DESCONOCIDO');
  const limpia = await m.correr(GUARD);
  log('LIMPIA · ' + pinta(limpia));
  const vigia = setInterval(() => log('… aplicarUna sigue sin volver (el plazo de la puerta son 300 s)'), 60000);
  const sale = {};
  for (const mut of [
    { id: 'M0 · control: mutación inofensiva', de: "MODO = 'normal'", a: "MODO = 'otro-valor'" },
    { id: 'M1 · la mutación SÓLO lo hace tardar (cuelga-' + forma + ')', de: "MODO = 'normal'", a: "MODO = 'cuelga-" + forma + "'" },
  ]) {
    const antes = fs.readFileSync(TESTIGO, 'utf8').split('\n').filter(Boolean).length;
    const ti = Date.now();
    const r = await m.aplicarUna({ fichero: SUJETO, de: mut.de, a: mut.a, cae: 'T-DECLARADO' }, GUARD, limpia);
    const seg = (Date.now() - ti) / 1000;
    sale[mut.id.slice(0, 2)] = { v: nombre(r), seg };
    log('MUTACIÓN ' + mut.id + ' → ' + nombre(r) + ' · tardó ' + seg.toFixed(1) + ' s');
    log('   testigo de la cobaya: ' + fs.readFileSync(TESTIGO, 'utf8').split('\n').filter(Boolean).slice(antes).map((l) => l.replace(/^\S+ /, '')).join(' | '));
    if (r.tras) log('   tras · ' + pinta(r.tras));
    for (const k of ['mudo', 'ciego', 'muerto']) if (r[k]) log('   ' + k + ': ' + String(r[k]).replace(/\s+/g, ' ').slice(0, 400));
    log('   sujeto restaurado: ' + (fs.readFileSync(path.join(dir, SUJETO), 'utf8') === "export const MODO = 'normal';\n"));
  }
  clearInterval(vigia);
  desmontar(dir);
  const control = sale.M0.v === 'MUDA' && limpia.pasados.some((n) => n.includes('T-DECLARADO'));
  veredicto({ puerta: 'meta-guard', variante: forma, ejercitada: control, forma: control ? (sale.M1.v === 'VIVA' ? 'si' : 'no') : null,
    frase: 'un guard MUDO (control: ' + sale.M0.v + ') cuya mutación sólo lo hace tardar ' + (ESPERA_MS / 1000) + ' s en ' + forma + ' sale ' + sale.M1.v + ' a los ' + sale.M1.seg.toFixed(0) + ' s' });
  fin(0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PUERTA · censo-guards-gateados. `medirGateados()` y `veredictoDelCenso()` REALES, dos pasadas:
// una con esperas de 2 s (bajo el plazo) y otra por encima de los 300 s.
// ═════════════════════════════════════════════════════════════════════════════════════════════
async function gateados() {
  cabecera('censo-guards-gateados');
  const dir = montar('gateados');
  log('copia en ' + dir + ' · scripts/censo-guards-gateados.mjs sha256 ' + sha(path.join(dir, 'scripts', 'censo-guards-gateados.mjs')) + ' (el del árbol: ' + sha(path.join(RAIZ, 'scripts', 'censo-guards-gateados.mjs')) + ')');
  const F = {
    'g1-gateado-control': SALTADOS,
    'g2-real-control': ["import { test } from 'node:test';", "test('real', () => {});"],
    'g3-real-lento-async': [...SALTADOS, "test('real que tarda', async () => { " + ESPERA_ASYNC + ' });'],
    'g4-gateado-con-before-lento': [...SALTADOS, 'before(async () => { ' + ESPERA_ASYNC + ' });'],
    'g5-gateado-que-muere': [...SALTADOS, "process.kill(process.pid, 'SIGKILL');"],
    'g6-real-lento-sync': [...SALTADOS, "test('real que bloquea', () => { " + ESPERA_SYNC + ' });'],
  };
  const rutas = Object.entries(F).map(([n, l]) => escribir(dir, 'mentira/' + n + '.test.mjs', l));
  for (const k of ['FORCE_COLOR', 'NODE_TEST_CONTEXT', 'NODE_OPTIONS']) delete process.env[k];
  const m = await import(pathToFileURL(path.join(dir, 'scripts', 'censo-guards-gateados.mjs')).href);
  // Como si los TRES gateados de verdad (g1, g4, g5) declararan mutaciones: la verdad son 3 expuestos.
  const declaran = new Set(['g1-gateado-control.test.mjs', 'g4-gateado-con-before-lento.test.mjs', 'g5-gateado-que-muere.test.mjs']);
  log('POBLACION: ' + rutas.length + ' ficheros de mentira · 3 son gateados de verdad (g1, g4, g5) y los tres «declaran» · plazo de la puerta 300000 ms');
  const pasada = async (espera) => {
    process.env.COBAYA_ESPERA_MS = String(espera);
    const ti = Date.now();
    const vigia = setInterval(() => log('… medirGateados sigue sin volver'), 60000);
    const porFichero = await m.medirGateados(rutas);
    clearInterval(vigia);
    const v = m.veredictoDelCenso(porFichero, declaran);
    log('PASADA con esperas de ' + espera + ' ms · tardó ' + ((Date.now() - ti) / 1000).toFixed(1) + ' s');
    for (const n of Object.keys(F)) console.log('      ' + n + ' → ' + JSON.stringify(porFichero.get(n + '.test.mjs') || 'NO APARECE'));
    const g = v.gateados ? v.gateados.map((x) => x.fichero.slice(0, 2)) : [];
    const e = v.expuestos ? v.expuestos.map((x) => x.fichero.slice(0, 2)) : [];
    log('   el censo dice: gateados [' + g.join(', ') + '] · expuestos [' + e.join(', ') + '] · la verdad: gateados [g1, g4, g5] · expuestos [g1, g4, g5]');
    return { g, e };
  };
  const corta = await pasada(2000);
  const larga = await pasada(ESPERA_MS);
  desmontar(dir);
  const control = corta.g.includes('g1') && corta.g.includes('g4') && !corta.g.includes('g2') && larga.g.includes('g1');
  const desaparece = control && !larga.g.includes('g4');
  veredicto({ puerta: 'censo-guards-gateados', ejercitada: control, forma: control ? (desaparece ? 'inversa' : 'no') : null,
    frase: 'bajo el plazo, el gateado con un `before` lento cuenta como gateado y expuesto; con el plazo vencido ' + (desaparece ? 'DESAPARECE de las dos listas' : 'sigue en las dos listas')
      + '; el gateado que muere al cargar ' + (larga.g.includes('g5') || corta.g.includes('g5') ? 'aparece' : 'no aparece en ninguna de las dos pasadas') });
  fin(0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// PUERTA · censo-mudez. El guion ACTÚA AL IMPORTARSE (muta `tests/_guard-texto.mjs`), así que se
// lanza entero y sin tocar… sobre la copia, con una carpeta `tests/` fabricada de 20 guards.
// ═════════════════════════════════════════════════════════════════════════════════════════════
function mudez(conColor) {
  cabecera('censo-mudez' + (conColor ? ' (con FORCE_COLOR)' : ''));
  const dir = montar('mudez');
  log('copia en ' + dir + ' · scripts/censo-mudez.mjs sha256 ' + sha(path.join(dir, 'scripts', 'censo-mudez.mjs')) + ' (el del árbol: ' + sha(path.join(RAIZ, 'scripts', 'censo-mudez.mjs')) + ')');
  const CAB = ["import { test } from 'node:test';", "import assert from 'node:assert/strict';", "import { soloEjecutable } from './_guard-texto.mjs';", "const FUENTE = 'const a = 1; // prohibido\\nconst b = 2;';"];
  const SUELO = "assert.ok(t.includes('const b'), 'suelo'); ";
  const NEGACION = "assert.ok(!t.includes('prohibido'));";
  for (let i = 1; i <= 16; i++) escribir(dir, 'tests/v' + String(i).padStart(2, '0') + '-vivo.test.mjs', [...CAB, "test('negacion CON suelo', () => { const t = soloEjecutable(FUENTE); " + SUELO + NEGACION + ' });']);
  escribir(dir, 'tests/m1-mudo-control.test.mjs', [...CAB, "test('negacion SIN suelo', () => { const t = soloEjecutable(FUENTE); " + NEGACION + ' });']);
  escribir(dir, 'tests/n1-no-aplica-control.test.mjs', ["import { test } from 'node:test';", '// solo NOMBRA soloEjecutable en un comentario', "test('nada', () => {});"]);
  escribir(dir, 'tests/m2-mudo-lento-al-mutar.test.mjs', [...CAB, "test('negacion SIN suelo, lenta cuando el filtro devuelve vacio', async () => { const t = soloEjecutable(FUENTE); if (t === '') await new Promise((s) => setTimeout(s, 200000)); " + NEGACION + ' });']);
  escribir(dir, 'tests/c1-lento-siempre.test.mjs', [...CAB, "test('negacion CON suelo, lenta siempre', async () => { const t = soloEjecutable(FUENTE); await new Promise((s) => setTimeout(s, 200000)); " + SUELO + NEGACION + ' });']);
  const helper = path.join(dir, 'tests', '_guard-texto.mjs');
  const antes = sha(helper);
  log('POBLACION: 20 guards de mentira = 16 vivos + 1 mudo (control) + 1 que sólo nombra el filtro + 1 MUDO que tarda 200 s sólo al mutar + 1 que tarda 200 s siempre · plazo de la puerta 180000 ms');
  const ti = Date.now();
  const r = spawnSync(process.execPath, ['scripts/censo-mudez.mjs'], { cwd: dir, encoding: 'utf8', env: entornoLimpio(conColor ? { FORCE_COLOR: '3' } : {}) });
  const out = (r.stdout || '') + (r.stderr || '');
  log('censo-mudez terminó en ' + ((Date.now() - ti) / 1000).toFixed(0) + ' s · salida ' + r.status + ' · signal ' + r.signal + ' · el filtro de la copia quedó idéntico: ' + (sha(helper) === antes));
  console.log(out.split('\n').map((l) => '      | ' + l).join('\n'));
  const n = (c) => Number((new RegExp('^\\s+' + c + '\\s+(\\d+)$', 'm').exec(out) || [])[1]);
  const bloque = (titulo) => { const i = out.indexOf(titulo); if (i < 0) return ''; const resto = out.slice(i); const f = resto.indexOf('\n\n'); return f < 0 ? resto : resto.slice(0, f); };
  const mudos = bloque('MUDOS'); const ciegos = bloque('CIEGOS'); const noAplica = bloque('NO APLICA —');
  desmontar(dir);
  if (conColor) {
    veredicto({ puerta: 'censo-mudez', variante: 'con FORCE_COLOR=3', ejercitada: r.status !== null, forma: null,
      frase: 'con el color que heredan las sesiones: VIVO ' + n('VIVO') + ' · MUDO ' + n('MUDO') + ' · CIEGO ' + n('CIEGO') + ' · salida ' + r.status });
    fin(0);
  }
  const control = mudos.includes('m1-mudo-control') && noAplica.includes('n1-no-aplica-control') && ciegos.includes('c1-lento-siempre');
  const halaga = n('VIVO') === 17 && !mudos.includes('m2-mudo-lento-al-mutar');
  veredicto({ puerta: 'censo-mudez', ejercitada: control, forma: control ? (halaga ? 'si' : 'no') : null,
    frase: 'plazo vencido en la pasada LIMPIA → CIEGO (' + ciegos.includes('c1-lento-siempre') + '); plazo vencido en la pasada MUTADA → el guard mudo cuenta como ' + (halaga ? 'VIVO (17 vivos con 16 de verdad)' : 'otra cosa: VIVO ' + n('VIVO') + ', MUDO ' + n('MUDO')) });
  fin(0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TODAS · las nueve en paralelo, cada salida a su fichero, y la línea que sale SIEMPRE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
async function todas() {
  const dirSalidas = path.resolve(arg('--salidas') || path.dirname(YO));
  const MODOS = ['sonda', 'plazo-test', 'staging', 'empuje', 'meta-async', 'meta-sync', 'gateados', 'mudez', 'mudez-con-color'];
  log('BANCO SCRUM-1391 · ' + MODOS.length + ' pasadas en paralelo · salidas en ' + dirSalidas);
  const resultados = await Promise.all(MODOS.map((modo) => new Promise((resuelve) => {
    const destino = path.join(dirSalidas, 'salida-' + modo + '.txt');
    const h = spawn(process.execPath, [YO, modo, '--node-modules', NODE_MODULES], { cwd: RAIZ, env: entornoLimpio() });
    let out = '';
    h.stdout.on('data', (d) => { out += d; });
    h.stderr.on('data', (d) => { out += d; });
    h.on('close', (status, signal) => {
      fs.writeFileSync(destino, out.replace(/\r\n/g, '\n'));
      const veredictos = out.split('\n').filter((l) => l.startsWith('VEREDICTO-PUERTA ')).map((l) => JSON.parse(l.slice(17)));
      log('terminó ' + modo + ' · salida ' + status + (signal ? ' · señal ' + signal : '') + ' · ' + veredictos.length + ' veredicto(s) · ' + path.basename(destino));
      // Lo que salga de un proceso matado NO se cuenta: sin su «EXIT=0» no hay veredicto que valga.
      resuelve({ modo, valido: status === 0 && /^EXIT=0$/m.test(out), veredictos });
    });
  })));
  const PUERTAS = ['staging-gated', 'meta-guard', 'censo-guards-gateados', 'censo-mudez', 'tests con plazo propio', 'puerta-claude-empuje'];
  const filas = [];
  for (const p of PUERTAS) {
    const suyos = resultados.filter((r) => r.valido).flatMap((r) => r.veredictos).filter((v) => v.puerta === p);
    const ejercitada = suyos.some((v) => v.ejercitada && v.forma !== null);
    const formas = suyos.filter((v) => v.ejercitada && v.forma !== null).map((v) => v.forma);
    const forma = formas.includes('si') ? 'si' : formas.includes('inversa') ? 'inversa' : formas.includes('no') ? 'no' : null;
    filas.push({ p, ejercitada, forma, suyos });
  }
  console.log('');
  for (const f of filas) {
    console.log((f.ejercitada ? 'EJERCITADA ' : 'NO EJERCITADA ') + '· ' + f.p + ' · forma: ' + (f.forma === 'si' ? 'SÍ' : f.forma === 'inversa' ? 'LA INVERSA (el plazo borra un hallazgo)' : f.forma === 'no' ? 'NO' : 'sin juzgar'));
    for (const v of f.suyos) console.log('     ' + (v.variante ? '[' + v.variante + '] ' : '') + v.frase);
    if (!f.suyos.length) console.log('     ninguna pasada de esta puerta terminó: SIN JUZGAR');
  }
  const N = filas.filter((f) => f.ejercitada).length;
  const K = filas.filter((f) => f.ejercitada && f.forma === 'si').length;
  const I = filas.filter((f) => f.ejercitada && f.forma === 'inversa').length;
  const M = filas.filter((f) => !f.ejercitada).length;
  console.log('\n' + N + ' puertas ejercitadas · ' + K + ' con la forma · ' + M + ' que no se pudieron ejercitar   (de ' + filas.length + ' · ' + I + ' con la forma inversa · pasadas que no terminaron: ' + resultados.filter((r) => !r.valido).map((r) => r.modo).join(', ') + (resultados.every((r) => r.valido) ? 'ninguna' : '') + ')');
  fin(resultados.every((r) => r.valido) ? 0 : 2);
}

const MODOS = {
  sonda, 'plazo-test': plazoTest, staging, empuje, 'meta-async': () => meta('async'), 'meta-sync': () => meta('sync'),
  gateados, mudez: () => mudez(false), 'mudez-con-color': () => mudez(true), todas,
};
if (!MODOS[MODO]) { console.error('uso: node banco.mjs <' + Object.keys(MODOS).join('|') + '> --node-modules <carpeta>'); process.exit(2); }
await MODOS[MODO]();

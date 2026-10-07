#!/usr/bin/env node
// docs/master/evidencias/scrum1389/banco.mjs — SCRUM-1389
//
// LA PREGUNTA: ¿`node --test` deja DISTINGUIR, en lo que emite, un proceso por fichero que NO
// ARRANCA de un test que FALLA? Se MIDE; aquí no se arregla nada y no se toca ningún script.
//
// Parte del banco de J1h (docs/master/evidencias/scrum1343/banco-otras-puertas.mjs), del que toma
// la manera de fabricar el nieto que no existe (una copia de node que el primer fichero renombra).
// Le añade lo que a aquél le faltaba: los casos intermedios (el proceso SÍ se crea y muere al
// empezar) y la lectura de los EVENTOS del runner, no sólo del texto del reporter `spec`.
//
// Cada caso corre `node --test` DOS veces sobre los mismos ficheros: con `spec` (lo que lee una
// persona) y con un reporter propio que vuelca cada evento `test:pass` / `test:fail` tal cual lo
// entrega `node:test` (lo que podría leer un instrumento).
//
// USO:  node docs/master/evidencias/scrum1389/banco.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs';

const TMP = temporal('scrum1389-banco-');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TANDA = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');

// El entorno de los sujetos, a mano (A21): sin NODE_OPTIONS, NODE_TEST_CONTEXT ni FORCE_COLOR.
const ENV = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) {
  if (process.env[k] !== undefined) ENV[k] = process.env[k];
}

const escribir = (nombre, texto) => { const f = path.join(TMP, nombre); fs.writeFileSync(f, texto); return f; };
const LIMPIO = escribir('limpio.test.mjs', "import test from 'node:test';\ntest('caso limpio del banco', () => {});\n");
const OTRO = escribir('otro-limpio.test.mjs', "import test from 'node:test';\ntest('otro caso limpio del banco', () => {});\n");
const ROJO = escribir('rojo.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('caso que cae de verdad', () => { assert.equal(1, 2); });\n");
const IMPORT_ROTO = escribir('import-roto.test.mjs', "import test from 'node:test';\nimport './este-modulo-no-existe.mjs';\ntest('nunca llega a registrarse', () => {});\n");
const SINTAXIS = escribir('sintaxis-rota.test.mjs', "import test from 'node:test';\ntest('nunca llega', () => { ;;; ) \n");
const THROW = escribir('throw-arriba.test.mjs', "throw new Error('revienta en la primera linea');\n");
const EXIT1 = escribir('exit-uno-mudo.test.mjs', 'process.exit(1);\n');
const NATIVO = escribir('nativo.test.mjs', 'process.exit(3221225794);\n');
const MEDIO = escribir('muere-a-medias.test.mjs', "import test from 'node:test';\ntest('pasa y luego el proceso muere', () => {});\ntest('mata el proceso', () => { process.exit(3221225794); });\ntest('este ya no corre', () => {});\n");
const RENOMBRA = escribir('a-renombra.test.mjs', "import fs from 'node:fs';\nimport test from 'node:test';\n"
  // Con reintento: recién copiado, el binario puede estar ocupado un instante (medido: un EBUSY en
  // una pasada de tres) y entonces el caso no fabricaría lo que dice. El TESTIGO lo comprueba igual.
  + "test('renombra el binario', () => { const de = process.env.BANCO_NODE_COPIA; let ultimo;\n"
  + "  for (let i = 0; i < 50; i += 1) { try { fs.renameSync(de, de + '.ya-no'); return; } catch (e) { ultimo = e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); } }\n"
  + "  throw ultimo; });\n");

// El reporter que vuelca los eventos. Una línea por evento de veredicto, y una por el resumen.
const VOLCADOR = escribir('volcador.mjs', `
export default async function* volcador(fuente) {
  for await (const ev of fuente) {
    if (ev.type === 'test:pass' || ev.type === 'test:fail') {
      const e = ev.data.details?.error;
      const c = e?.cause;
      yield 'EVENTO ' + JSON.stringify({
        tipo: ev.type, nombre: ev.data.name, anidado: ev.data.nesting,
        esFichero: (typeof ev.data.file === 'string' && ev.data.line === 1 && ev.data.column === 1
          && ev.data.file.split('\\\\').join('/').endsWith('/' + String(ev.data.name).split('\\\\').join('/'))) || undefined,
        fila: ev.data.line, col: ev.data.column,
        failureType: e?.failureType, code: e?.code,
        exitCode: e?.exitCode, signal: e?.signal,
        causaCode: c?.code, causaSyscall: typeof c?.syscall === 'string' ? c.syscall.split(' ')[0] : undefined,
        causaTipo: c === undefined ? undefined : (c === null ? 'null' : (c?.constructor?.name ?? typeof c)),
        mensaje: typeof e?.message === 'string' ? e.message.split('\\n')[0].slice(0, 80) : undefined,
      }) + '\\n';
    }
    if (ev.type === 'test:summary' && ev.data.file === undefined) yield 'RESUMEN ' + JSON.stringify(ev.data.counts) + '\\n';
  }
}
`);

const limpiar = (s) => s.split(TMP).join('<banco>');
let n = 0;
const filas = [];
function caso(titulo, clase, absolutos, { ejecutable = process.execPath, env = ENV, preparar } = {}) {
  n += 1;
  // ⚠️ Rutas RELATIVAS al directorio de trabajo, como las recibe la tanda de verdad (`tests/*.test.mjs`).
  // La primera pasada de este banco las daba absolutas y el lector de huellas de la casa salía MUDO en
  // los nueve casos: compara el nombre del `✖` con el del `test at`, y con ruta absoluta no coinciden.
  // Era una avería del banco, no de la casa; se quedó escrito para que nadie la repita.
  const ficheros = absolutos.map((f) => path.relative(TMP, f));
  console.log('\n' + '█'.repeat(100));
  console.log('CASO ' + n + ' · ' + titulo);
  console.log('█'.repeat(100));
  const una = (reporter) => {
    const exe = preparar ? preparar() : ejecutable;
    const r = spawnSync(exe.ejecutable ?? exe, ['--test', '--test-concurrency=1', '--test-reporter=' + reporter, ...ficheros],
      { cwd: TMP, env: exe.env ?? env, encoding: 'utf8', timeout: 120000 });
    return r;
  };
  const spec = una('spec');
  const cuenta = (limpiar(spec.stdout || '').match(/^ℹ (tests|pass|fail|cancelled) \d+$/gm) || []).join(' · ');
  console.log('spec  → ' + (cuenta || '(SIN RECUENTO)') + ' · EXIT=' + spec.status);
  const ev = una(pathToFileURL(VOLCADOR).href);
  const lineas = limpiar(ev.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('EVENTO ') || l.startsWith('RESUMEN '));
  for (const l of lineas) console.log(l);
  console.log('eventos → EXIT=' + ev.status + (ev.error ? ' · error del banco: ' + ev.error.code : ''));
  if ((ev.stderr || '').trim()) console.log('stderr del runner (primeras 3 líneas): ' + limpiar(ev.stderr).trim().split(/\r?\n/).slice(0, 3).join(' ⏎ '));
  const fallos = lineas.filter((l) => l.startsWith('EVENTO ')).map((l) => JSON.parse(l.slice(7))).filter((e) => e.tipo === 'test:fail');
  // El TAP, que es lo que el CI guarda en `tanda.tap`: el bloque YAML de cada `not ok`, sin la pila.
  const tap = una('tap');
  const bloques = limpiar(tap.stdout || '').split(/\r?\n/);
  let dentro = false;
  for (const l of bloques) {
    if (/^not ok /.test(l)) dentro = true;
    if (dentro && /^(not ok |  (duration_ms|type|location|failureType|exitCode|signal|error|code|errno|syscall|path):)/.test(l)) console.log('   tap│ ' + l.slice(0, 160));
    if (dentro && /^ {2}\.\.\.$/.test(l)) dentro = false;
  }
  console.log('tap   → ' + ((limpiar(tap.stdout || '').match(/^# (tests|pass|fail) \d+$/gm) || []).join(' · ') || '(SIN RECUENTO)') + ' · EXIT=' + tap.status);
  // Y la puerta de la casa TAL CUAL está en el árbol: qué dice HOY de ese rojo su lector de huellas
  // (SCRUM-1331 / SCRUM-1332), que escribe en la salida de error después de la tanda.
  const exeP = preparar ? preparar() : { ejecutable, env };
  const puerta = spawnSync(process.execPath, [TANDA, exeP.ejecutable === process.execPath ? 'node' : exeP.ejecutable, '--test', '--test-concurrency=1', '--test-reporter=spec', ...ficheros],
    { cwd: TMP, env: exeP.env, encoding: 'utf8', timeout: 120000 });
  const dicho = limpiar(puerta.stderr || '').split(/\r?\n/).filter((l) => /^\s+(🔴|⚠️|población:|Y ADEMÁS|No hay ningún otro)/u.test(l) || l.startsWith('ℹ️'));
  console.log('puerta (tanda-con-veredicto) → EXIT=' + puerta.status + (dicho.length ? '' : ' · su lector de huellas NO DICE NADA'));
  for (const l of dicho) console.log('   │' + l.slice(0, 330));
  filas.push({ n, clase, titulo, fallos, exit: ev.status, cuenta, puerta: puerta.status,
    rotulo: (dicho.map((l) => (l.match(/🔴 ([^·]+) ·/u) || [])[1]).filter(Boolean).join(' + ') || '(nada)') });
  return { spec, ev, fallos };
}

console.log('BANCO SCRUM-1389 · plataforma ' + process.platform + ' · node ' + process.version);
console.log('POBLACIÓN: 9 casos · 2 controles (limpio, rojo de verdad), 5 de «el proceso SE CREA y muere», 2 de «el proceso NO SE CREA»');

caso('CONTROL · dos limpios', 'control-verde', [LIMPIO, OTRO]);
caso('CONTROL · un limpio y un ROJO DE VERDAD (assert dentro de un test)', 'rojo-real', [LIMPIO, ROJO]);
caso('SE CREA y muere · un import que no resuelve', 'muere-al-empezar', [LIMPIO, IMPORT_ROTO]);
caso('SE CREA y muere · error de sintaxis', 'muere-al-empezar', [LIMPIO, SINTAXIS]);
caso('SE CREA y muere · throw en la primera línea', 'muere-al-empezar', [LIMPIO, THROW]);
caso('SE CREA y muere · process.exit(1) sin una letra', 'muere-mudo', [LIMPIO, EXIT1]);
caso('SE CREA y muere · sale con 0xC0000142 sin una letra (IMITACIÓN del código nativo)', 'muere-mudo', [LIMPIO, NATIVO]);
caso('SE CREA, corre un caso y muere a medias con 0xC0000142 (IMITACIÓN)', 'muere-a-medias', [LIMPIO, MEDIO]);
{
  const copias = [];
  const preparar = () => {
    const copia = path.join(TMP, 'node-copia-' + (copias.length + 1) + path.extname(process.execPath));
    fs.copyFileSync(process.execPath, copia);
    copias.push(copia);
    return { ejecutable: copia, env: { ...ENV, BANCO_NODE_COPIA: copia } };
  };
  caso('NO SE CREA · dos nietos sin binario (ENOENT: la copia de node desaparece a mitad)', 'no-arranca', [RENOMBRA, LIMPIO, OTRO], { preparar });
  // Un testigo POR PASADA (spec, eventos, tap y puerta): si en alguna no se renombró, ESA no vale.
  const renombradas = copias.filter((c) => fs.existsSync(c + '.ya-no')).length;
  console.log('TESTIGO: binario renombrado en ' + renombradas + ' de ' + copias.length + ' pasadas' + (renombradas === copias.length ? '' : ' — EL CASO DE ARRIBA NO VALE'));
}

// ── La tabla: qué campos del evento separan cada clase ──────────────────────────────────────
console.log('\n' + '═'.repeat(100));
console.log('TABLA · un renglón por evento `test:fail` (los `test:pass` no se listan)');
console.log('caso | clase | anidado | esFichero | failureType | code | exitCode | signal | causaCode | causaSyscall | recuento');
for (const f of filas) {
  if (f.fallos.length === 0) console.log(f.n + ' | ' + f.clase + ' | (ningún test:fail) | | | | | | | | ' + f.cuenta);
  for (const e of f.fallos) {
    console.log([f.n, f.clase, e.anidado, e.esFichero === true ? 'sí' : 'no', e.failureType, e.code, e.exitCode, e.signal, e.causaCode, e.causaSyscall, f.cuenta]
      .map((x) => (x === undefined ? '—' : x)).join(' | '));
  }
}
console.log('\nTABLA 2 · lo que dice HOY la puerta de la casa (scripts/tanda-con-veredicto.mjs, sin tocar)');
console.log('caso | clase | EXIT de la puerta | rótulo de su lector de huellas');
for (const f of filas) console.log([f.n, f.clase, f.puerta, f.rotulo].join(' | '));
console.log('\nCASOS CORRIDOS=' + n + ' · BANCO=0');

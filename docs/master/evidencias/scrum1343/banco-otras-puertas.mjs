#!/usr/bin/env node
// docs/master/evidencias/scrum1343/banco-otras-puertas.mjs — SCRUM-1343
//
// LA PREGUNTA QUE EL TICKET DEJA SIN MEDIR: ¿las otras puertas que lanzan hijos dicen «he encontrado
// algo» cuando un hijo NO ARRANCA? Se MIDE; aquí no se arregla nada.
//
// Las tres puertas corren TAL CUAL están en el árbol (ni copia ni parche). Lo que se fabrica es el
// hijo que no arranca, de dos maneras, y ninguna carga la máquina:
//
//   ENOENT ...... el binario no existe. Para un hijo DIRECTO se cambia `process.execPath` desde un
//                 `--import` (es una propiedad escribible), así la puerta lanza algo que no está.
//                 Para un NIETO (el proceso por fichero que lanza `node --test`), el runner corre
//                 con una COPIA de node que el primer fichero renombra.
//   NATIVO ...... el hijo sale con 3221225794 (0xC0000142) sin una letra. ⚠️ IMITACIÓN: el proceso
//                 arranca y sale con ese número. Es lo que la puerta ve, no lo que pasó.
//
// USO:  node docs/master/evidencias/scrum1343/banco-otras-puertas.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1343-otras-'));
const INEXISTENTE = path.join(TMP, 'este-node-no-existe.exe');

// El entorno de los sujetos, a mano (A21).
const ENV = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) {
  if (process.env[k] !== undefined) ENV[k] = process.env[k];
}

const escribir = (nombre, texto) => { const f = path.join(TMP, nombre); fs.writeFileSync(f, texto); return f; };
const LIMPIO = escribir('limpio.test.mjs', "import test from 'node:test';\ntest('caso limpio del banco', () => {});\n");
const OTRO = escribir('otro-limpio.test.mjs', "import test from 'node:test';\ntest('otro caso limpio del banco', () => {});\n");
const ROJO = escribir('rojo.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('caso que cae de verdad', () => { assert.equal(1, 2); });\n");
const NATIVO = escribir('nativo.test.mjs', 'process.exit(3221225794);\n');
const RENOMBRA = escribir('a-renombra.test.mjs', "import fs from 'node:fs';\nimport test from 'node:test';\n"
  + "test('renombra el binario', () => { fs.renameSync(process.env.BANCO_NODE_COPIA, process.env.BANCO_NODE_COPIA + '.ya-no'); });\n");
const PRELOAD = escribir('execpath-inexistente.mjs', 'process.execPath = process.env.BANCO_INEXISTENTE;\n');

let n = 0;
function caso(titulo, ejecutable, args, env = ENV) {
  n += 1;
  const r = spawnSync(ejecutable, args, { cwd: RAIZ, env, encoding: 'utf8', timeout: 180000 });
  console.log('\n' + '█'.repeat(100));
  console.log('CASO ' + n + ' · ' + titulo);
  console.log('█'.repeat(100));
  console.log(((r.stdout || '') + (r.stderr || '')).split(TMP).join('<banco>').trimEnd() || '(sin salida)');
  console.log('\nEXIT=' + r.status + (r.signal ? ' · señal ' + r.signal : '') + (r.error ? ' · error del banco: ' + r.error.code : ''));
  return r;
}

console.log('BANCO SCRUM-1343 (otras puertas) · plataforma ' + process.platform + ' · node ' + process.version);
console.log('POBLACIÓN: 3 puertas — scripts/tanda-con-veredicto.mjs, scripts/guards-entrada.mjs, scripts/meta-guard-mutaciones.mjs (su `correr`)');

// ── tanda-con-veredicto ──────────────────────────────────────────────────────────────────────
const TANDA = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');
const T = ['--test', '--test-concurrency=1', '--test-reporter=spec'];
caso('tanda-con-veredicto · CONTROL: un limpio y un rojo de verdad', process.execPath, [TANDA, 'node', ...T, LIMPIO, ROJO]);
caso('tanda-con-veredicto · CONTROL: dos limpios', process.execPath, [TANDA, 'node', ...T, LIMPIO, OTRO]);
caso('tanda-con-veredicto · su hijo DIRECTO no existe (ENOENT)', process.execPath, [TANDA, INEXISTENTE, ...T, LIMPIO]);
caso('tanda-con-veredicto · un NIETO sale con 0xC0000142 sin una letra (imitación)', process.execPath, [TANDA, 'node', ...T, LIMPIO, NATIVO, OTRO]);
{
  const copia = path.join(TMP, 'node-copia' + path.extname(process.execPath));
  fs.copyFileSync(process.execPath, copia);
  caso('tanda-con-veredicto · dos NIETOS no arrancan (ENOENT: el binario desaparece a mitad)', process.execPath,
    [TANDA, copia, ...T, RENOMBRA, LIMPIO, OTRO], { ...ENV, BANCO_NODE_COPIA: copia });
}

// ── guards-entrada ───────────────────────────────────────────────────────────────────────────
caso('guards-entrada · su hijo DIRECTO (el `node --test`) no existe (ENOENT)', process.execPath,
  ['--import', pathToFileURL(PRELOAD).href, path.join(RAIZ, 'scripts', 'guards-entrada.mjs')], { ...ENV, BANCO_INEXISTENTE: INEXISTENTE });

// Y sus NIETOS (el proceso por fichero): la puerta corre con una copia de node, y el PRIMER nieto
// que arranca renombra ese binario. Los que el runner ya había lanzado corren; los que lanza
// después no encuentran binario. Es el caso del 1-oct: unos miden y otros no llegan a existir.
//
// ⚠️ Medido al escribir esto: el proceso `node --test` (el que reparte) NO carga los `--import` de
// NODE_OPTIONS; sólo los cargan los procesos por fichero. La primera versión de este caso renombraba
// desde el runner, no renombró nada, y los doce guards corrieron en verde: una cobaya que no hizo
// lo suyo. Por eso este caso lleva TESTIGO: si al acabar el binario no está renombrado, no vale.
{
  const copia = path.join(TMP, 'node-copia-entrada' + path.extname(process.execPath));
  fs.copyFileSync(process.execPath, copia);
  const aLaCopia = escribir('execpath-a-la-copia.mjs', 'process.execPath = process.env.BANCO_NODE_COPIA;\n');
  const renombrador = escribir('renombra-desde-el-primer-nieto.mjs', "import fs from 'node:fs';\n"
    + "if (process.execArgv.includes('--test-isolation=process')) { try { fs.renameSync(process.env.BANCO_NODE_COPIA, process.env.BANCO_NODE_COPIA + '.ya-no'); } catch { /* otro nieto llegó antes */ } }\n");
  caso('guards-entrada · parte de sus NIETOS (un proceso por fichero) no arrancan (ENOENT)', process.execPath,
    ['--import', pathToFileURL(aLaCopia).href, path.join(RAIZ, 'scripts', 'guards-entrada.mjs')],
    { ...ENV, BANCO_NODE_COPIA: copia, NODE_OPTIONS: '--import ' + pathToFileURL(renombrador).href });
  console.log('TESTIGO del caso de los nietos: binario renombrado = ' + (fs.existsSync(copia + '.ya-no') ? 'sí' : 'NO — el caso de arriba NO VALE'));
}

// ── meta-guard: su `correr`, que es quien lanza el fichero del guard ─────────────────────────
const SONDA = escribir('sonda-meta-guard.mjs', `
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const m = await import(pathToFileURL(path.join(process.env.BANCO_RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const ver = async (titulo, fichero) => {
  const r = await m.correr(fichero);
  const dir = path.dirname(fichero); const base = path.basename(fichero);
  console.log(titulo);
  console.log('   pasados=' + JSON.stringify(r.pasados) + ' · caidos=' + JSON.stringify(r.caidos.map((c) => path.basename(c))));
  console.log('   errores=' + JSON.stringify(Object.values(r.errores)));
  console.log('   murioElFichero=' + m.murioElFichero(r, base, dir) + ' · cayo(«caso limpio»)=' + m.cayo(r, 'caso limpio') + ' · cayo(«limpio»)=' + m.cayo(r, 'limpio'));
};
await ver('A · línea base, el proceso arranca:', process.env.BANCO_LIMPIO);
await ver('B · el fichero sale con 0xC0000142 sin una letra (imitación):', process.env.BANCO_NATIVO);
process.execPath = process.env.BANCO_INEXISTENTE;
await ver('C · el proceso del fichero NO EXISTE (ENOENT):', process.env.BANCO_LIMPIO);
console.log('MUERTE_CUENTA_COMO=' + m.MUERTE_CUENTA_COMO);
// Cuántas declaraciones del árbol nombran en «cae» un fragmento que TAMBIÉN está en la ruta de su
// fichero: ahí \`cayo()\` casaría con la muerte del fichero (cuyo nombre es la ruta) y diría VIVA.
const censo = m.censoDeDeclaraciones();
let total = 0; const enLaRuta = [];
for (const { guard, mutaciones } of censo) for (const mut of mutaciones) {
  total += 1;
  if (path.join(process.env.BANCO_RAIZ, 'tests', guard).includes(mut.cae)) enLaRuta.push(guard + ' · «' + mut.cae + '»');
}
console.log('declaraciones censadas=' + total + ' · con «cae» contenido en la ruta de su fichero=' + enLaRuta.length);
for (const x of enLaRuta) console.log('   · ' + x);
`);
caso('meta-guard · `correr()` sobre un fichero cuyo proceso no arranca', process.execPath, [SONDA],
  { ...ENV, BANCO_RAIZ: RAIZ, BANCO_LIMPIO: LIMPIO, BANCO_NATIVO: NATIVO, BANCO_INEXISTENTE: INEXISTENTE });

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* un temporal que no se deja borrar no cambia lo medido */ }
console.log('\n' + '═'.repeat(100));
console.log('CASOS CORRIDOS=' + n + ' · BANCO=0');

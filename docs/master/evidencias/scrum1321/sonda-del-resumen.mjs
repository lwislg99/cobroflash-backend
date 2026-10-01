// SCRUM-1321 · ¿De dónde sale `test:summary`? ¿Del hijo (lo que de verdad ejecutó) o del padre
// (lo que le llegó)? Se corre una cobaya dos veces con run(), como hace `correr()` del meta-guard:
// entera (control) y muriendo en el tercero de sus cinco tests.
//
// Uso, desde la raíz del repo:  node docs/master/evidencias/scrum1321/sonda-del-resumen.mjs
//
// La cobaya se ESCRIBE en un temporal fuera del árbol y se borra al acabar. No vive como fichero
// del repositorio a propósito: un fichero que registra tests fuera de `tests/` no lo ejecuta la
// tanda, y `tests/scrum708-el-fichero-que-no-corre.test.mjs` lo denuncia (lo denunció: PR #2043).
import { run } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Cinco tests; con MORIR=1 el tercero mata el proceso con código 0. Cada uno deja su testigo (A21). */
const COBAYA = [
  "import test from 'node:test';",
  "import fs from 'node:fs';",
  "const marca = (n) => fs.appendFileSync(process.env.TESTIGO, n + '\\n');",
  "test('uno', () => { marca('uno'); });",
  "test('dos', () => { marca('dos'); });",
  "test('tres · muere aquí', () => { marca('tres'); if (process.env.MORIR === '1') process.exit(0); });",
  "test('cuatro', () => { marca('cuatro'); });",
  "test('cinco', () => { marca('cinco'); });",
  '',
].join('\n');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1321-sonda-'));
const RUTA_COBAYA = path.join(DIR, 'cobaya-de-cinco.mjs');
const TESTIGO = path.join(DIR, 'testigo.txt');
const sinRuta = (n) => (path.isAbsolute(n) ? `[LA RUTA DEL FICHERO, no un test] ${path.basename(n)}` : n);

async function pasada(morir) {
  fs.rmSync(TESTIGO, { force: true });
  process.env.TESTIGO = TESTIGO;
  process.env.MORIR = morir ? '1' : '0';
  const pasados = []; const caidos = []; let resumen = null;
  const flujo = run({ files: [RUTA_COBAYA], cwd: DIR, forceExit: true, timeout: 60000 });
  for await (const ev of flujo) {
    if (ev.type === 'test:pass') pasados.push(ev.data.name);
    else if (ev.type === 'test:fail') caidos.push(ev.data.name);
    else if (ev.type === 'test:summary') resumen = ev.data;
  }
  const ejecutados = fs.existsSync(TESTIGO) ? fs.readFileSync(TESTIGO, 'utf8').trim().split('\n') : [];
  console.log(`\nMORIR=${morir ? 1 : 0}`);
  console.log('  declarados en el fichero ...... 5');
  console.log(`  ejecutados (testigo) .......... ${ejecutados.length}: ${ejecutados.join(', ')}`);
  console.log(`  test:pass recibidos ........... ${pasados.length}: ${pasados.map(sinRuta).join(' | ')}`);
  console.log(`  test:fail recibidos ........... ${caidos.length}: ${caidos.map(sinRuta).join(' | ')}`);
  console.log(`  test:summary .................. ${resumen ? JSON.stringify(resumen.counts) : 'NO LLEGÓ'}`);
  const acumulados = pasados.length + caidos.length;
  console.log(`  ¿«CUADRAN» (summary.tests === acumulados)? ${resumen ? resumen.counts.tests === acumulados : 'n/a'}`);
}

console.log(`node ${process.version} · ${process.platform}`);
try {
  fs.writeFileSync(RUTA_COBAYA, COBAYA);
  await pasada(false);
  await pasada(true);
} finally {
  fs.rmSync(DIR, { recursive: true, force: true });
}
console.log('\nEXIT=0');

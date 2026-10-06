// ¿`run({ forceExit: true })` —lo que usa `correr()`— le pasa `--test-force-exit` al HIJO?
// Cobaya FUERA del árbol; deja sus argumentos en un testigo. Control: la misma sin forceExit.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { run } from 'node:test';
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sonda-flag-'));
const testigo = path.join(d, 'testigo.txt');
const cobaya = path.join(d, 'cobaya.test.mjs');
fs.writeFileSync(cobaya, `import { test } from 'node:test'; import fs from 'node:fs';
test('uno', () => { fs.appendFileSync(${JSON.stringify(testigo)}, JSON.stringify({ execArgv: process.execArgv, ctx: process.env.NODE_TEST_CONTEXT }) + '\\n'); });`);
for (const forceExit of [true, false]) {
  fs.rmSync(testigo, { force: true });
  let n = 0;
  for await (const e of run({ files: [cobaya], forceExit })) if (e.type === 'test:pass') n += 1;
  console.log(`forceExit=${forceExit} · eventos pass ${n} · el hijo vio: ${fs.existsSync(testigo) ? fs.readFileSync(testigo, 'utf8').trim() : 'SIN TESTIGO (ciego)'}`);
}
fs.rmSync(d, { recursive: true, force: true });
console.log(`node ${process.version} ${process.platform}`);
process.exit(0);

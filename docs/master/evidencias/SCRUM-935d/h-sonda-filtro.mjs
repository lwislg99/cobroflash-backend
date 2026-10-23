// Sonda: cómo informa node:test run() con testNamePatterns y execArgv.
//
// La cobaya no vive en el repositorio: aquí sólo está su plantilla, como texto, y se escribe al
// correr en una carpeta temporal de fuera del árbol (como la de SCRUM-1405). Escrita como fichero
// en `evidencias/` registraba tests que la tanda no ejecuta, y eso lo tumba `scrum708`.
//
//   node docs/master/evidencias/SCRUM-935d/h-sonda-filtro.mjs
import { run } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COBAYA = `import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

let estado = 0;
console.log('CARGA-DEL-MODULO');
test('primero pone estado', () => { estado = 1; });
test('segundo depende del primero', () => { assert.equal(estado, 1); });
test('lento', async () => { await new Promise((r) => setTimeout(r, 300)); });
describe('grupo exterior', () => {
  test('interno con (paréntesis) y [corchetes] y *', () => {});
  test('interno dos', () => {});
});
test('marca execArgv', () => { console.log('EXECARGV=' + JSON.stringify(process.execArgv)); });
`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum935d-sonda-'));
const cobaya = path.join(dir, 'cobaya.test.mjs');
fs.writeFileSync(cobaya, COBAYA);

async function una(rotulo, opts) {
  const ev = [];
  const t0 = Date.now();
  for await (const e of run({ files: [cobaya], forceExit: true, ...opts })) {
    if (e.type === 'test:pass') ev.push(`pass${e.data.skip ? '(skip:' + e.data.skip + ')' : ''}${e.data.todo ? '(todo)' : ''} d${e.data.nesting} «${e.data.name}»`);
    else if (e.type === 'test:fail') ev.push(`FAIL d${e.data.nesting} «${e.data.name}» ${e.data.details?.error?.cause?.message || e.data.details?.error?.message || ''}`.slice(0, 160));
    else if (e.type === 'test:stdout') ev.push(`stdout ${String(e.data.message).trim()}`);
    else if (e.type === 'test:summary') ev.push(`summary ${JSON.stringify(e.data.counts)} file=${e.data.file ? path.basename(e.data.file) : '-'}`);
  }
  console.log(`\n### ${rotulo} (${Date.now() - t0} ms)`); for (const l of ev) console.log('  ' + l.split(dir).join('<tmp>'));
}

try {
  await una('sin filtro', {});
  await una('filtro exacto «segundo depende del primero»', { testNamePatterns: [new RegExp(`^${esc('segundo depende del primero')}$`)] });
  await una('filtro exacto interno con caracteres', { testNamePatterns: [new RegExp(`^${esc('interno con (paréntesis) y [corchetes] y *')}$`)] });
  await una('filtro que no casa', { testNamePatterns: [/^no existe$/] });
  await una('execArgv', { execArgv: ['--no-warnings'], testNamePatterns: [/^marca execArgv$/] });
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

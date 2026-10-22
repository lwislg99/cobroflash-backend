// Sonda: cómo informa node:test run() con testNamePatterns y execArgv.
import { run } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function una(rotulo, opts) {
  const ev = [];
  const t0 = Date.now();
  for await (const e of run({ files: [path.join(dir, 'cobaya.test.mjs')], forceExit: true, ...opts })) {
    if (e.type === 'test:pass') ev.push(`pass${e.data.skip ? '(skip:' + e.data.skip + ')' : ''}${e.data.todo ? '(todo)' : ''} d${e.data.nesting} «${e.data.name}»`);
    else if (e.type === 'test:fail') ev.push(`FAIL d${e.data.nesting} «${e.data.name}» ${e.data.details?.error?.cause?.message || e.data.details?.error?.message || ''}`.slice(0, 160));
    else if (e.type === 'test:stdout') ev.push(`stdout ${String(e.data.message).trim()}`);
    else if (e.type === 'test:summary') ev.push(`summary ${JSON.stringify(e.data.counts)} file=${e.data.file ? path.basename(e.data.file) : '-'}`);
  }
  console.log(`\n### ${rotulo} (${Date.now() - t0} ms)`); for (const l of ev) console.log('  ' + l);
}

await una('sin filtro', {});
await una('filtro exacto «segundo depende del primero»', { testNamePatterns: [new RegExp(`^${esc('segundo depende del primero')}$`)] });
await una('filtro exacto interno con caracteres', { testNamePatterns: [new RegExp(`^${esc('interno con (paréntesis) y [corchetes] y *')}$`)] });
await una('filtro que no casa', { testNamePatterns: [/^no existe$/] });
await una('execArgv', { execArgv: ['--no-warnings'], testNamePatterns: [/^marca execArgv$/] });

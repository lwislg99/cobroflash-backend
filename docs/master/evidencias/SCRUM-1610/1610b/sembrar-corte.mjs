// Siembra un corte en el lector de 1516c (y, con --sin-exigir, le quita la exigencia del centinela), corre el
// test, imprime qué cae y con qué mensaje, y restaura. Uso: node sembrar-corte.mjs <raiz> [--sin-exigir] [--solo-primero]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = process.argv[2];
const abs = path.join(raiz, 'tests', 'scrum1516c-frontera-en-el-obligatorio.test.mjs');
const orig = fs.readFileSync(abs, 'utf8');
const muts = [];
// El corte: la salida que llega se queda en sus primeras 150 líneas (en una frontera de línea, como en CI).
const solo1 = process.argv.includes('--solo-primero');
muts.push(["    hijo.on('close', (codigo) => { clearTimeout(corte); ok({ codigo, salida, stderr, error }); });",
  solo1
    ? "    hijo.on('close', (codigo) => { clearTimeout(corte); const ls = salida.split('\\n'); if (ls.length > 30) globalThis.__n = (globalThis.__n || 0) + 1; ok({ codigo, salida: ls.length > 30 && globalThis.__n <= 3 ? ls.slice(0, -21).join('\\n') + '\\n' : salida, stderr, error }); });"
    : "    hijo.on('close', (codigo) => { clearTimeout(corte); const ls = salida.split('\\n'); ok({ codigo, salida: ls.length > 30 ? ls.slice(0, -21).join('\\n') + '\\n' : salida, stderr, error }); });"]);
if (process.argv.includes('--sin-exigir')) muts.push(['  assert.ok(!r.cortada, ', '  assert.ok(true || !r.cortada, ']);
let s = orig;
for (const [de, a] of muts) {
  const n = s.split(de).length - 1;
  if (n !== 1) { console.log('CIEGO · ancla casa ' + n + ' veces: ' + de.slice(0, 60)); process.exit(2); }
  s = s.replace(de, () => a);
}
fs.writeFileSync(abs, s);
try {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
  const r = spawnSync(process.execPath, ['--test', 'tests/scrum1516c-frontera-en-el-obligatorio.test.mjs'], { cwd: raiz, encoding: 'utf8', env });
  const o = r.stdout;
  console.log('rc ' + r.status + ' · pasan ' + (o.match(/^✔ /gm) || []).length + ' · caen ' + (o.match(/^✖ SCRUM/gm) || []).length);
  for (const l of o.split('\n')) if (/^\[|^✔ |^✖ SCRUM|CIEGO · salida cortada|AssertionError|leo \d+ rutas|no trae la línea|SEMBRADOS|declaradas en/.test(l)) console.log('  ' + l.slice(0, 260));
} finally {
  fs.writeFileSync(abs, orig);
}
console.log(fs.readFileSync(abs, 'utf8') === orig ? 'restaurado' : '🔴 NO RESTAURADO');

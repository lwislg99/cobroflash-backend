// Cruza la lista del censo de 1387e con los registros docs/master/SCRUM-<n>*.md CREADOS después de una base.
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
// Uso: node nuevos.mjs <lista.tsv de censo-registros.mjs --lista> <sha base> <sha punta>
const [, , lista, base, punta] = process.argv;
if (!lista || !base || !punta) { console.log('CIEGO · faltan argumentos: <lista> <base> <punta>'); process.exit(2); }
const add = execFileSync('git', ['diff', '--name-only', '--diff-filter=A', base, punta, '--', 'docs/master/'], { encoding: 'utf8' })
  .split('\n').map((l) => l.match(/^docs\/master\/SCRUM-0*(\d+)[a-z0-9-]*\.md$/i)).filter(Boolean).map((m) => m[1]);
const nuevos = new Set(add);
const filas = fs.readFileSync(lista, 'utf8').trim().split('\n').map((l) => l.split('\t'));
const cuenta = {};
for (const [n, clase, , comp] of filas) if (nuevos.has(n)) { const k = `${clase}/${comp}`; cuenta[k] = (cuenta[k] ?? 0) + 1; }
const fueraTexto = filas.filter(([n, c, , comp]) => nuevos.has(n) && ['B', 'C2', 'C3'].includes(c) && comp === 'texto').map((f) => f[0]);
console.log(`base ${base} · registros nuevos en docs/master ${nuevos.size} · de ellos afirman ${filas.filter((f) => nuevos.has(f[0])).length}`);
console.log(JSON.stringify(cuenta));
console.log(`fuera y solo texto: ${fueraTexto.length} · ${fueraTexto.slice(0, 40).join(' ')}`);

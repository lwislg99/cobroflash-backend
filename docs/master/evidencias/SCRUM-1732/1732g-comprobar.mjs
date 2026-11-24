// SCRUM-1732g · cada línea quitada de docs/master/SCRUM-1732.md, ¿dónde sigue?
// Uso: node docs/master/evidencias/SCRUM-1732/1732g-comprobar.mjs <copia-ANTES> <fichero-DESPUÉS>
// Para cada línea que estaba ANTES y no está DESPUÉS (multiconjunto), dice si sigue en el
// fichero que queda o solo en 46af2e504 (la versión previa a ④, que f0a144571 reescribió).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [antes, despues] = process.argv.slice(2).map((p) => readFileSync(p, 'utf8').split(/\r?\n/));
const previa = execFileSync('git', ['show', '46af2e504:docs/master/SCRUM-1732.md'], { encoding: 'utf8' }).split(/\r?\n/);
const cuenta = (a) => a.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
const cd = cuenta(despues);
const quitadas = [];
for (const [l, n] of cuenta(antes)) for (let i = 0; i < n - (cd.get(l) || 0); i++) quitadas.push(l);
let enQueda = 0, soloPrevia = 0, enNinguna = 0;
for (const l of quitadas) {
  const d = despues.includes(l) ? 'SIGUE en el fichero' : previa.includes(l) ? 'SOLO en 46af2e504 (pre-④)' : 'EN NINGUNA';
  if (d.startsWith('SIGUE')) enQueda++; else if (d.startsWith('SOLO')) soloPrevia++; else enNinguna++;
  console.log(`${d} · ${l.slice(0, 110)}`);
}
console.log(`población: ${antes.length} líneas antes, ${despues.length} después, ${quitadas.length} quitadas · sigue=${enQueda} solo-pre4=${soloPrevia} ninguna=${enNinguna}`);
process.exit(quitadas.length === 0 ? 2 : enNinguna ? 1 : 0);

// SCRUM-1123f · las mutaciones que declara un guard, aplicadas con las MISMAS funciones del bucle
// principal de `scripts/meta-guard-mutaciones.mjs` (`mutacionesDeclaradas`, `correr`, `aplicarUna`),
// sólo para el guard que se le da. Restaura cada fichero (lo hace `aplicarUna`).
//   node arnes-mutaciones.mjs <raiz> <guard.test.mjs>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [raiz, guard] = process.argv.slice(2);
const M = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const codigo = fs.readFileSync(path.join(raiz, 'tests', guard), 'utf8');
const muts = M.mutacionesDeclaradas(codigo, guard);
const limpia = await M.correr(guard);
console.log(`${guard} · limpia: ${limpia.pasados.length} pasan · ${limpia.caidos.length} caen · ${muts.length} mutaciones`);
let vivas = 0;
for (const m of muts) {
  const r = await M.aplicarUna(m, guard, limpia);
  if (r.ok) vivas += 1;
  console.log(`  ${r.ok ? '✔ VIVA' : r.mudo ? '✖ MUDA' : r.muerto ? '☠ MUERTO' : '? CIEGA'} · ${m.cae}${r.ok ? '' : ` · ${r.mudo || r.muerto || r.ciego}`}`);
}
console.log(`vivas ${vivas} de ${muts.length}`);
process.exit(vivas === muts.length ? 0 : 1);

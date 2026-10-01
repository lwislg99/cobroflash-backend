// Corre las mutaciones declaradas de UN guard con las piezas de la casa (correr + aplicarUna).
// Uso: node uno.mjs <raiz> <guard.test.mjs> [fragmento del cae para filtrar]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [RAIZ, guard, filtro] = process.argv.slice(2);
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const muts = M.mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, 'tests', guard), 'utf8'), guard)
  .filter((m) => !filtro || m.cae.includes(filtro));
console.log(`POBLACION · ${guard} · ${muts.length} mutación(es)`);
const limpia = await M.correr(guard);
console.log(`LIMPIA · ${limpia.pasados.length} pasados · ${limpia.caidos.length} caídos · ${limpia.saltados.length} saltados · movidos ${limpia.movidos?.length || 0}`);
let n = 0;
for (const mut of muts) {
  n += 1;
  const r = await M.aplicarUna(mut, guard, limpia);
  const v = r.ok ? 'VIVA' : r.mudo ? 'MUDA' : r.muerto ? 'MUERTO' : 'CIEGA';
  console.log(`\n[${n}] ${v} · ${mut.fichero} · cae: ${mut.cae.slice(0, 90)}`);
  if (r.ok) console.log(`    colaterales ${r.colaterales} · pasada mutada: ${r.tras.pasados.length} pasados · ${r.tras.caidos.length} caídos`);
  else console.log('    ' + String(r.mudo || r.muerto || r.ciego).slice(0, 900));
}
console.log('\nEXIT=0');
process.exit(0);

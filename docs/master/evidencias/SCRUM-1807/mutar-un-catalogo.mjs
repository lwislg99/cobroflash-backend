// Driver de una vez: corre el catálogo MUTACIONES_QUE_ME_TUMBAN de UN test con aplicarUna.
// Uso: node mutar.mjs <raiz-del-worktree> <nombre.test.mjs>
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [raiz, guard] = process.argv.slice(2);
const mg = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const entrada = mg.censoDeDeclaraciones().find((c) => c.guard === guard);
if (!entrada) { console.log(`CIEGO: ${guard} no está en el censo`); process.exit(2); }
console.log(`${guard}: ${entrada.mutaciones.length} mutaciones, ${entrada.incompletas.length} incompletas`);
const limpia = await mg.correr(guard);
console.log(`base limpia: ${limpia.pasados.length} pasados, ${limpia.caidos.length} caídos, ${limpia.saltados.length} saltados`);
let caen = 0;
for (const mut of entrada.mutaciones) {
  const r = await mg.aplicarUna(mut, guard, limpia);
  console.log(`${r.ok ? 'CAE ' : 'NO CAE'} · ${mut.fichero} · ${mut.cae}${r.ok ? '' : ` · ${r.mudo || r.ciego || r.muerto}`}`);
  if (r.ok) caen += 1;
}
console.log(`RESULTADO: ${caen} de ${entrada.mutaciones.length} caen`);
process.exit(caen === entrada.mutaciones.length ? 0 : 1);

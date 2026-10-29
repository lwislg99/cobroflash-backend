// Driver mínimo: el mismo bucle que el meta-guard, sólo sobre los guards nombrados. Uso: node mutar.mjs <raíz> <guard>...
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = path.resolve(process.argv[2]);
process.chdir(raiz);
const mg = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const censo = mg.censoDeDeclaraciones();
const pedidos = process.argv.slice(3);
let vivas = 0, otras = 0, poblacion = 0;
for (const { guard, mutaciones, incompletas } of censo) {
  if (!pedidos.includes(guard)) continue;
  poblacion++;
  if (incompletas?.length) { console.log(`? ${guard} · ${incompletas.length} incompletas`); otras++; }
  const limpia = await mg.correr(guard);
  console.log(`limpia ${guard}: pasados=${limpia.pasados?.length} caidos=${limpia.caidos?.length} saltados=${limpia.saltados?.length}`);
  for (const mut of mutaciones) {
    const r = await mg.aplicarUna(mut, guard, limpia);
    const e = r.ok ? 'VIVA' : r.muerto ? 'MUERTO' : r.mudo ? 'MUDA' : 'CIEGA';
    if (r.ok) vivas++; else otras++;
    console.log(`${e} · ${mut.cae}${r.ok ? '' : ' · ' + (r.muerto || r.mudo || r.ciego)}`);
  }
}
console.log(`POBLACION guards=${poblacion} de ${pedidos.length} pedidos · vivas=${vivas} · no vivas=${otras}`);

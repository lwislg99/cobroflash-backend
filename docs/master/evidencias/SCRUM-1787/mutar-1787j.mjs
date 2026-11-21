// SCRUM-1787j · driver mínimo: el mismo bucle que el meta-guard (correr + aplicarUna), sólo sobre
// el guard de 728d. Copia de la forma de `docs/master/evidencias/SCRUM-1339/r-mutar.mjs`.
// Uso: node docs/master/evidencias/SCRUM-1787/mutar-1787j.mjs <raíz del árbol>
// Salida: 0 todas VIVAS · 1 alguna MUDA o MUERTA · 2 CIEGA o población vacía.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GUARD = 'scrum728d-viajes-de-la-reserva.test.mjs';
const raiz = path.resolve(process.argv[2] || '.');
process.chdir(raiz);
const mg = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const censo = mg.censoDeDeclaraciones();
let vivas = 0; let mudas = 0; let ciegas = 0; let poblacion = 0;
for (const { guard, mutaciones, incompletas } of censo) {
  if (guard !== GUARD) continue;
  if (incompletas?.length) { console.log(`? ${guard} · ${incompletas.length} incompletas`); ciegas++; }
  const limpia = await mg.correr(guard);
  console.log(`limpia ${guard}: pasados=${limpia.pasados?.length} caidos=${limpia.caidos?.length} saltados=${limpia.saltados?.length}`);
  for (const mut of mutaciones) {
    poblacion++;
    const r = await mg.aplicarUna(mut, guard, limpia);
    const e = r.ok ? 'VIVA' : r.muerto ? 'MUERTO' : r.mudo ? 'MUDA' : 'CIEGA';
    if (r.ok) vivas++; else if (r.ciego) ciegas++; else mudas++;
    console.log(`${e} · ${mut.cae}${r.ok ? '' : ` · ${r.muerto || r.mudo || r.ciego}`}`);
  }
}
console.log(`POBLACION mutaciones=${poblacion} · vivas=${vivas} · mudas=${mudas} · ciegas=${ciegas}`);
process.exitCode = poblacion === 0 || ciegas ? 2 : mudas ? 1 : 0;

// Banco de SCRUM-908b. Corre las mutaciones DECLARADAS de unos guards, N veces, y dice el
// veredicto de cada una. Replica el bucle del bloque principal de meta-guard-mutaciones.mjs.
// uso: node banco-908b.mjs <RAIZ> <guard1,guard2|ALL> <N>
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2];
const filtro = process.argv[3];
const N = Number(process.argv[4] || 1);
const mod = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const { censoDeDeclaraciones, correr, aplicarUna } = mod;

const censo = censoDeDeclaraciones().filter((c) => c.mutaciones.length
  && (filtro === 'ALL' || filtro.split(',').some((g) => c.guard.startsWith(g))));

console.log(`BANCO 908b · raiz=${RAIZ}`);
console.log(`poblacion: ${censo.length} guard(s) · ${censo.reduce((n, c) => n + c.mutaciones.length, 0)} declaracion(es) · N=${N}`);
if (!censo.length) { console.log('🔴 CIEGO: el filtro no casa con ningun guard declarante.'); process.exit(2); }
for (const c of censo) console.log(`   - ${c.guard}: ${c.mutaciones.length}`);

const tally = { viva: 0, muda: 0, ciega: 0, muerta: 0 };
for (let i = 1; i <= N; i += 1) {
  for (const { guard, mutaciones } of censo) {
    const limpia = await correr(guard);
    const base = `limpia[pass=${limpia.pasados.length} fail=${limpia.caidos.length} skip=${limpia.saltados.length} movidos=${limpia.movidos.length}]`;
    for (let k = 0; k < mutaciones.length; k += 1) {
      const mut = mutaciones[k];
      const r = await aplicarUna(mut, guard, limpia);
      let v = 'VIVA';
      let extra = '';
      if (!r.ok) {
        if (r.muerto) { v = 'MUERTA'; extra = String(r.muerto).slice(0, 400); tally.muerta += 1; }
        else if (r.mudo) { v = 'MUDA'; extra = String(r.mudo).slice(0, 700); tally.muda += 1; }
        else { v = 'CIEGA'; extra = String(r.ciego).slice(0, 700); tally.ciega += 1; }
      } else tally.viva += 1;
      console.log(`[${i}/${N}] ${guard} #${k + 1} -> ${v}  ${base}`);
      if (extra) console.log(`        ${extra.replace(/\n/g, '\n        ')}`);
    }
  }
}
console.log(`\nTOTAL N=${N} · vivas ${tally.viva} · MUDAS ${tally.muda} · ciegas ${tally.ciega} · muertas ${tally.muerta}`);

// Uso: node difver.mjs <bloque.xml> <fecha_publicacion vieja> <fecha_publicacion nueva> [cita...]
// Saca los parrafos de dos versiones de un bloque de la API de consolidada del BOE y lista los que entran y salen.
import fs from 'node:fs';
const [f, vieja, nueva, cf] = process.argv.slice(2);
const citas = cf ? JSON.parse(fs.readFileSync(cf, "utf8")) : [];
const x = fs.readFileSync(f, 'utf8');
const versiones = x.split('<version ').slice(1);
const norm = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[“”«»]/g, '"').replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1').trim();
const pars = (pub) => {
  const v = versiones.filter((t) => t.includes(`fecha_publicacion="${pub}"`));
  if (v.length !== 1) { console.log(`CIEGO: ${v.length} versiones con fecha_publicacion=${pub}`); process.exit(2); }
  return [...v[0].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => norm(m[1])).filter(Boolean);
};
const A = pars(vieja), B = pars(nueva);
const sa = new Set(A), sb = new Set(B);
console.log(`versiones en el bloque: ${versiones.length} · parrafos ${vieja}: ${A.length} · ${nueva}: ${B.length}`);
for (const p of A) if (!sb.has(p)) console.log('SALE  >>', p.slice(0, 400));
for (const p of B) if (!sa.has(p)) console.log('ENTRA >>', p.slice(0, 400));
const tA = A.join(' '), tB = B.join(' ');
for (const c of citas) { const n = norm(c); console.log(`cita «${n.slice(0, 50)}…» en ${vieja}: ${tA.includes(n)} · en ${nueva}: ${tB.includes(n)}`); }

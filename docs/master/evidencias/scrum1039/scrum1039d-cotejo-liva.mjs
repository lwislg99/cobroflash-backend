// Cotejo de las dos citas de CONTABILIDAD.md:100-101 contra la última versión consolidada del BOE (API).
// Control positivo: cada cita debe casar. Control negativo sembrado: la misma cita con una palabra cambiada NO debe casar.
// Bajada (SCRUM-1039d), en una carpeta fuera del árbol, con b = a7 y a20:
//   curl -s -H "Accept: application/xml" https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-1992-28740/texto/bloque/$b -o $b.xml
// Uso, desde esa carpeta: node <ruta>/scrum1039d-cotejo-liva.mjs <ruta>/docs/producto/CONTABILIDAD.md
import fs from 'fs';
const texto = f => {
  const x = fs.readFileSync(f, 'utf8');
  const vers = [...x.matchAll(/<version\b[^>]*>([\s\S]*?)<\/version>/g)];
  return [...vers.at(-1)[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).join(' ').replace(/\s+/g, ' ');
};
const md = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const cita = n => md[n - 1].match(/«([^»]+)»/)[1].replace(/\s+/g, ' ');
const casos = [['a7.xml', cita(100)], ['a20.xml', cita(101)]];
let ok = 0;
for (const [f, c] of casos) {
  const t = texto(f);
  const si = t.includes(c);
  const mutada = c.replace('impuesto', 'IMPUESTO_SEMBRADO');
  const no = !t.includes(mutada) && mutada !== c;
  console.log(f, '| cita', c.length, 'car | casa:', si, '| negativo sembrado no casa:', no);
  if (si && no) ok++;
}
console.log(`población: ${casos.length} citas · ${ok}/${casos.length} casan con control negativo`);
process.exit(ok === casos.length ? 0 : 1);

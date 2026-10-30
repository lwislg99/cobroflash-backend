// SCRUM-1039e · Cotejo de las citas de LIVA que J4 escribe en PREGUNTAS_ASESOR.md (Q-C2 y Q-C9) contra la última
// versión consolidada del BOE (API), y recuento de los números del art. 20.Uno.
// Cada cita tiene que estar LITERAL en el documento y en el bloque. Control negativo sembrado: la misma cita con una
// palabra cambiada NO debe casar en el bloque. Si un bloque no trae párrafos, sale CIEGO (2), no verde.
// Bajada, en una carpeta fuera del árbol, con b = a3 y a20:
//   curl -s -H "Accept: application/xml" https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-1992-28740/texto/bloque/$b -o $b.xml
// Uso, desde esa carpeta: node <ruta>/scrum1039e-cotejo-liva.mjs <ruta>/docs/legal/PREGUNTAS_ASESOR.md
import fs from 'fs';
const parrafos = f => {
  const x = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const vers = [...x.matchAll(/<version\b[^>]*>([\s\S]*?)<\/version>/g)];
  if (!vers.length) return [];
  return [...vers.at(-1)[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
};
const plano = ps => ps.join(' ').replace(/\s+/g, ' ');
const doc = fs.readFileSync(process.argv[2], 'utf8').replace(/\s+/g, ' ');
const casos = [
  ['a3.xml', 'El ámbito espacial de aplicación del impuesto es el territorio español, determinado según las previsiones del apartado siguiente'],
  ['a3.xml', 'en el Reino de España, Ceuta y Melilla'],
  ['a3.xml', 'En el Reino de España, Canarias'],
  ['a20.xml', 'Que su objeto principal sea la reconstrucción de las mismas, entendiéndose cumplido este requisito cuando más del 50 por ciento del coste total del proyecto de rehabilitación se corresponda con obras de consolidación o tratamiento de elementos estructurales, fachadas o cubiertas o con obras análogas o conexas a las de rehabilitación.'],
  ['a20.xml', 'Que el coste total de las obras a que se refiera el proyecto exceda del 25 por ciento del precio de adquisición de la edificación si se hubiese efectuado aquélla durante los dos años inmediatamente anteriores al inicio de las obras de rehabilitación o, en otro caso, del valor de mercado que tuviera la edificación o parte de la misma en el momento de dicho inicio.'],
];
const fuentes = Object.fromEntries(['a3.xml', 'a20.xml'].map(f => [f, parrafos(f)]));
for (const [f, ps] of Object.entries(fuentes)) if (!ps.length) { console.log(`CIEGO: ${f} sin párrafos (¿bajado?)`); process.exit(2); }
let ok = 0;
for (const [f, c] of casos) {
  const t = plano(fuentes[f]);
  const enBoe = t.includes(c), enDoc = doc.includes(c);
  const mutada = c.replace(/España|obras|coste|impuesto/, 'SEMBRADO');
  const neg = mutada !== c && !t.includes(mutada);
  console.log(f, '| cita', c.length, 'car | en el BOE:', enBoe, '| en el documento:', enDoc, '| negativo sembrado no casa:', neg);
  if (enBoe && enDoc && neg) ok++;
}
// Art. 20.Uno: los números entre «Uno.» y «Dos.» (el 13 viene escrito «13º.», sin punto antes de la º).
const ps = fuentes['a20.xml'];
const ini = ps.findIndex(p => p.startsWith('Uno.')), fin = ps.findIndex(p => p.startsWith('Dos.'));
let previo = 0; const numeros = [], suprimidos = [];
for (const p of ps.slice(ini + 1, fin)) {
  const m = p.match(/^(\d{1,2})\.?º/);
  if (m && +m[1] === previo + 1) { previo = +m[1]; numeros.push(previo); if (/^\d{1,2}\.?º\.? ?\(Suprimid[ao]\)/.test(p)) suprimidos.push(previo); }
}
const numOk = ini >= 0 && fin > ini && numeros.length === 28 && suprimidos.join() === '21,27';
console.log(`art. 20.Uno: ${numeros.length} números (1.º a ${numeros.at(-1)}.º), suprimidos: ${suprimidos.join(', ') || 'ninguno'} | esperado 28 y 21, 27: ${numOk}`);
console.log(`población: ${casos.length} citas · ${ok}/${casos.length} casan en BOE y documento con control negativo`);
process.exit(ok === casos.length && numOk ? 0 : 1);

// Mide lo que el veredicto guardado añade a la tanda: poblacion + huellas + juicio.
import path from 'node:path';
const raiz = process.argv[2];
const m = await import(new URL(`file:///${path.resolve(raiz, 'tests/_veredicto-mudez.mjs').replace(/\\/g, '/')}`));
const veces = [];
let r;
for (let i = 0; i < 5; i++) {
  const t = process.hrtime.bigint();
  r = m.juzgarVeredicto(m.poblacionMudez(raiz), (f) => m.huellaDe(raiz, path.join('tests', f)), m.huellaDe(raiz, m.RUTA_FILTRO), m.leerVeredicto(raiz));
  veces.push(Number(process.hrtime.bigint() - t) / 1e6);
}
console.log(`pasadas=${veces.length} ms=${veces.map((x) => x.toFixed(1)).join(',')} alDia=${r.alDia} poblacion=${r.poblacion}`);

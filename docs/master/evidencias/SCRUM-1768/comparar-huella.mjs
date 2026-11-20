// SCRUM-1768 · ¿la ficha dice y ofrece LO MISMO antes y después? node comparar-huella.mjs <carpeta con antes.json y despues.json>
// El formato MUEVE bloques («El trabajo» y «+ Nuevo presupuesto» a la columna lateral), así que el ORDEN del
// texto cambia a propósito. Se comparan MULTICONJUNTOS: las acciones visibles, las cifras en euros y las
// palabras del texto (en minúsculas: innerText aplica text-transform). Una pérdida o una ganancia, por pequeña
// que sea, sale nombrada. Población declarada: cuántas fichas y cuántas palabras se compararon.
import { readFileSync } from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const cargar = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const A = cargar('antes.json'); const D = cargar('despues.json');
const cuenta = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
const dif = (a, b) => { const ma = cuenta(a); const mb = cuenta(b); const out = [];
  for (const k of new Set([...ma.keys(), ...mb.keys()])) { const d = (mb.get(k) || 0) - (ma.get(k) || 0); if (d) out.push(`${d > 0 ? '+' : ''}${d} «${k}»`); }
  return out; };
const palabras = (t) => t.toLowerCase().split(/\s+/).filter(Boolean);
let fichas = 0; let pal = 0; let distintas = 0; const filas = [];
for (const pa of A.salida) {
  const pd = D.salida.find((x) => x.w === pa.w && x.quien === pa.quien);
  if (!pd) { filas.push(`${pa.w} ${pa.quien}: CIEGO (sin «después»)`); distintas++; continue; }
  if (!pd.local) { filas.push(`${pa.w} ${pa.quien}: CIEGO («después» no sirvió los ficheros locales)`); distintas++; continue; }
  for (const fa of pa.filas) {
    const fd = pd.filas.find((x) => x.id === fa.id);
    fichas++; pal += palabras(fa.textoFicha).length;
    const d = { acciones: dif(fa.acciones, fd.acciones), euros: dif(fa.euros, fd.euros), palabras: dif(palabras(fa.textoFicha), palabras(fd.textoFicha)) };
    const ok = !d.acciones.length && !d.euros.length && !d.palabras.length;
    if (!ok) distintas++;
    filas.push(`${pa.w} ${pa.quien} #${fa.id}: ${ok ? 'IDÉNTICA' : 'DISTINTA ' + JSON.stringify(d)} · desbordeX ${fa.desbordeX}→${fd.desbordeX} · fuera ${fd.fuera.length} · alto ${fa.alto}→${fd.alto} · errores ${pd.errores.length}`);
  }
}
console.log(filas.join('\n'));
console.log(`población: ${fichas} fichas, ${pal} palabras «antes» · distintas o ciegas: ${distintas}`);
process.exitCode = distintas ? 1 : 0;

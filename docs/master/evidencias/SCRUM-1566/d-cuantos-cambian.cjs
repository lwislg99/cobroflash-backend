// ¿En cuántos presupuestos cambia el total FIRMADO con D? Muestra con los conjuntos de 887b
// (cantidades, precios, dtos, tipos), con y sin descuento global, y mezclando tipos sin global.
// Uso (desde la raíz del árbol): SONDA_D=0 node --require <esta carpeta>/sonda-d.cjs <esta carpeta>/d-cuantos-cambian.cjs
const path = require('node:path');
const s = require(path.join(__dirname, 'sonda-d.cjs'));
const U = require(path.join(process.cwd(), 'dist/core/utils/utils.js'));
if (U.calcTotal !== s.viejo) throw new Error('CIEGO: corre con SONDA_D=0 (se compara viejo contra D a mano)');

let semilla = 1566;
const rand = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const qtys = [1, 2, 2.5, 3, 7, 11, 37, 0.75];
const precios = [9.99, 0.875, 24.95, 19.99, 42.35, 120, 4.19, 36.35, 1.005, 689, 58.33, 2.37, 0.01, 1000];
const dtos = [5, 10, 15, 33.33, 12.5, 50];
const tipos = [0.21, 0.10, 0.04, 0];
const globales = [0.01, 5, 25, 12.34, 99.99, 150];

function muestra(n, { global, mezcla }) {
  let cambian = 0, peor = 0, sube = 0, baja = 0, vistos = 0;
  for (let i = 0; i < n; i++) {
    const t = pick(tipos);
    const lines = [];
    const k = 1 + Math.floor(rand() * 4);
    for (let j = 0; j < k; j++) {
      const l = { concept: `L${j}`, qty: pick(qtys), price: pick(precios), tax: mezcla ? pick(tipos) : t };
      if (rand() < 0.5) l.dto = pick(dtos);
      lines.push(l);
    }
    const g = global ? pick(globales) : null;
    const viejo = s.viejo(lines, g);
    if (!(viejo > 0)) continue;
    vistos++;
    const d = Math.round((s.totalCanonico(lines, g) - viejo) * 100);
    if (d !== 0) { cambian++; if (d > 0) sube++; else baja++; peor = Math.max(peor, Math.abs(d)); }
  }
  return `${vistos} presupuestos · cambia el total firmado en ${cambian} (${(100 * cambian / vistos).toFixed(1)} %) · sube ${sube} · baja ${baja} · máx ${peor} cént.`;
}
// Control positivo: el caso de la sesión anterior tiene que contar como cambio.
const ctl = [{ concept: 'x', qty: 2.5, price: 36.35, tax: 0.04 }];
if (s.viejo(ctl) === s.totalCanonico(ctl)) throw new Error('CIEGO: el caso 94,51/94,52 no sale distinto');
console.log('un tipo, sin global      :', muestra(10000, { global: false, mezcla: false }));
console.log('tipos mezclados, sin glob:', muestra(10000, { global: false, mezcla: true }));
console.log('un tipo, con global      :', muestra(10000, { global: true, mezcla: false }));

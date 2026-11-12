// docs/master/evidencias/SCRUM-1566/sonda-d.cjs — SCRUM-1566 tramo (d), S1, 29-oct-2026
//
// MIDE D SIN CONSTRUIRLO: sustituye `calcTotal` EN MEMORIA por «el total sale de la cuenta canónica»
// (`calcVatBreakdown`). No toca ni `src/` ni `dist/`. Se carga con `node --require <esto>` desde la
// raíz de un árbol con `dist/` compilado.
//
//   SONDA_D=0 → cargada pero SIN sustituir (la base: mismo cargador, mismo proceso)
//   SONDA_D=1 → variante 1: base + cuota de `calcVatBreakdown` sobre las líneas con su dto; con
//               descuento global, el reparto del pie (`presentacionIva.ts:159-181`)
//   SONDA_D=2 → variante 2: `grossOfLines(lineasParaFacturar(...))`, el total de las MISMAS líneas que
//               se facturan (el global entra como línea negativa del tipo único)
const path = require('node:path');
const raiz = process.cwd();
const U = require(path.join(raiz, 'dist/core/utils/utils.js'));
const V = require(path.join(raiz, 'dist/modules/invoicing/domain/vat.service.js'));
const A = require(path.join(raiz, 'dist/modules/quotes/domain/apartados.js'));
const IL = require(path.join(raiz, 'dist/modules/invoicing/domain/invoiceLines.service.js'));

const r2 = (n) => Math.round(n * 100) / 100;

function totalCanonico(lines, descuentoGlobal) {
  const suman = A.lineasQueSuman(Array.isArray(lines) ? lines : []);
  const ef = suman.map((l) => ({ ...l, price: U.precioConDto(l.price, l.dto) }));
  const bd = V.calcVatBreakdown(ef);
  const g = Number(descuentoGlobal);
  const totC = Math.round(bd.base * 100);
  const globC = Number.isFinite(g) && g > 0 ? Math.min(Math.round(g * 100), totC) : 0;
  if (globC <= 0 || totC <= 0) return r2(bd.base + bd.cuota); // = grossOfLines de las líneas efectivas
  let acc = 0;
  let total = 0;
  bd.entries.forEach((e, i) => {
    const q = i === bd.entries.length - 1 ? globC - acc : Math.round((globC * Math.round(e.base * 100)) / totC);
    acc += q;
    const base = r2(e.base - q / 100);
    total += base + (e.causa ? 0 : r2(base * (e.rate / 100)));
  });
  return r2(total);
}

// Con varios tipos y global (bloqueado al crear: SCRUM-887 c.15697) cae a la variante 1.
function totalDeLoQueSeFactura(lines, descuentoGlobal) {
  const suman = A.lineasQueSuman(Array.isArray(lines) ? lines : []);
  const r = U.descuentoGlobalEnCentimos(suman, descuentoGlobal);
  if (r && r.tipos.length !== 1) return totalCanonico(lines, descuentoGlobal);
  if (r && r.aRepartir >= r.sumaBases) return 0;
  return IL.grossOfLines(IL.lineasParaFacturar({ lines: suman, discountGlobalAmount: descuentoGlobal ?? null }));
}

module.exports = { totalCanonico, totalDeLoQueSeFactura, viejo: U.calcTotal };
if (process.env.SONDA_D !== '0') {
  U.calcTotal = process.env.SONDA_D === '2' ? totalDeLoQueSeFactura : totalCanonico;
  if (U.calcTotal === module.exports.viejo) throw new Error('CIEGO: no se pudo sustituir calcTotal');
}

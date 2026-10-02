// SÓLO LEE. ¿Con qué frecuencia no cuadra el PAPEL de la factura? Uso: node sonda-papel-de-la-factura.cjs <árbol con dist/>
//
// Reproduce la ARITMÉTICA del PDF de factura tal como está escrita en `pdf.service.ts` (bucle de
// líneas :478-481 y bloque de totales :538-550), con el formateador REAL (`formatImporteEs`) y la
// cantidad REAL (`cantidadDeLinea`) de dist/. ⚠️ Es una COPIA de esa aritmética, no una llamada al
// PDF: no se genera ningún documento. Si `pdf.service.ts` cambia, esta sonda deja de medirlo.
//
// Y lo compara con el total que la ruta GUARDA en `Invoice.total` (`grossOfLines`, el de la huella).
const path = require('node:path');
const R = path.resolve(process.argv[2] || '.');
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const vat = require(path.join(R, 'dist/modules/invoicing/domain/vat.service.js'));
const il = require(path.join(R, 'dist/modules/invoicing/domain/invoiceLines.service.js'));

/** Lo que el formateador escribe, vuelto a céntimos: «1.234,56» → 123456. */
const cent = (n) => Math.round(Number(u.formatImporteEs(n).replace(/\./g, '').replace(',', '.')) * 100);

function papel(lines) {
  let sumaDeLineas = 0;                       // lo que un cliente suma mirando la columna TOTAL
  const vatMap = {}; let subtotal = 0;
  for (const l of lines) {
    const qty = vat.cantidadDeLinea(l.qty), price = Number(l.price) || 0, t = Number(l.tax) || 0;
    sumaDeLineas += cent(qty * price * (1 + t));           // :481 y :524
    const base = qty * price; subtotal += base;            // :542-543
    const k = `${(t * 100).toFixed(0)}%`; (vatMap[k] ??= { base: 0, vat: 0 }); vatMap[k].base += base; vatMap[k].vat += base * t;
  }
  const totalVat = Object.values(vatMap).reduce((a, b) => a + b.vat, 0);
  return {
    sumaDeLineas,
    total: cent(subtotal + totalVat),                      // :550 y :652
    baseMasCuotas: cent(subtotal) + Object.values(vatMap).reduce((a, g) => a + cent(g.vat), 0),
    guardado: Math.round(il.grossOfLines(lines) * 100),    // `Invoice.total`
  };
}

// ── control: los casos de S4 ──
for (const [n, lines] of [
  ['2 × 12,50 al 21 %', [{ qty: 1, price: 12.5, tax: 0.21 }, { qty: 1, price: 12.5, tax: 0.21 }]],
  ['2 × 7,25 al 21 %', [{ qty: 1, price: 7.25, tax: 0.21 }, { qty: 1, price: 7.25, tax: 0.21 }]],
  ['3 × 9,99 al 21 % (el de SCRUM-624)', [1, 2, 3].map(() => ({ qty: 1, price: 9.99, tax: 0.21 }))],
  ['1 × 100 al 21 % (control: debe cuadrar todo)', [{ qty: 1, price: 100, tax: 0.21 }]],
]) console.log(n.padEnd(46), JSON.stringify(papel(lines)));

// ── barrido: precios de 2 decimales entre 1,00 y 500,00, cantidad 1, generador determinista ──
let s = 20261002; const azar = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const N = 100000;
console.log(`\npoblación: ${N} facturas por fila · precios al azar (semilla fija) de 1,00 a 500,00 €, 2 decimales · cantidad 1`);
console.log('tipo  líneas | Σ líneas ≠ TOTAL impreso (máx) | TOTAL impreso ≠ guardado (máx) | base + cuotas impresas ≠ TOTAL impreso (máx)');
for (const tipos of [[0.21], [0.10], [0.21, 0.10]]) for (const k of [1, 2, 3, 5, 10]) {
  let a = 0, b = 0, c = 0, ma = 0, mb = 0, mc = 0;
  for (let i = 0; i < N; i++) {
    const lines = Array.from({ length: k }, (_, j) => ({ qty: 1, price: Math.round(100 + azar() * 49900) / 100, tax: tipos[j % tipos.length] }));
    const p = papel(lines);
    const da = Math.abs(p.sumaDeLineas - p.total), db = Math.abs(p.total - p.guardado), dc = Math.abs(p.baseMasCuotas - p.total);
    if (da) { a++; ma = Math.max(ma, da); } if (db) { b++; mb = Math.max(mb, db); } if (dc) { c++; mc = Math.max(mc, dc); }
  }
  const pc = (x) => `${(100 * x / N).toFixed(1)} %`.padStart(7);
  console.log(`${tipos.map((t) => t * 100).join('+').padEnd(6)}${String(k).padStart(4)}   | ${pc(a)} (${ma} cént.)`.padEnd(46) + `| ${pc(b)} (${mb} cént.)`.padEnd(33) + `| ${pc(c)} (${mc} cént.)`);
}

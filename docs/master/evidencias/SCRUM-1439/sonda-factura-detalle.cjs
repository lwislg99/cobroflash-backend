// SÓLO LEE. Detalle de los casos que no cuadran en sonda-factura.cjs.
const path = require('node:path');
const R = path.resolve(process.argv[2] || '.');
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const bp = require(path.join(R, 'dist/modules/quotes/domain/billingPlan.js'));
const il = require(path.join(R, 'dist/modules/invoicing/domain/invoiceLines.service.js'));
const vat = require(path.join(R, 'dist/modules/invoicing/domain/vat.service.js'));
function ver(nombre, lines, terms) {
  const quote = { lines, total: u.calcTotal(lines).toFixed(2), paymentTerms: terms, discountGlobalAmount: null, customBillingPlan: null };
  const plan = bp.resolveBillingPlan(quote); const reparto = bp.distributeStageAmounts(quote.total, plan);
  console.log(`\n== ${nombre}\n   línea ${JSON.stringify(lines[0])} · calcTotal crudo ${u.calcTotal(lines)} · Quote.total ${quote.total} · reparto ${JSON.stringify(reparto)}`);
  console.log(`   grossOfLines(líneas del presupuesto, sin repartir) = ${il.grossOfLines(il.lineasParaFacturar(quote))} · desglose del presupuesto ${JSON.stringify(vat.calcVatBreakdown(lines))}`);
  plan.forEach((_s, i) => {
    const sc = il.stageLinesReconciled(il.lineasParaFacturar(quote), plan, i, reparto[i]);
    const d = vat.calcVatBreakdown(sc);
    console.log(`   tramo ${i + 1}: objetivo ${reparto[i]} · línea ${JSON.stringify(sc.map((l) => ({ qty: l.qty, price: l.price })))} · grossOfLines ${il.grossOfLines(sc)} → Invoice.total ${il.grossOfLines(sc).toFixed(2)} · base ${d.base} cuota ${d.cuota}`);
  });
}
ver('A · 1,70 tecleado · 4 decimales · un tramo', [{ concept: 'x', qty: 1, price: 1.405, tax: 0.21 }], 'FULL_UPFRONT');
ver('B · 3,40 tecleado · 2 decimales (LO DE HOY) · dos tramos', [{ concept: 'x', qty: 1, price: 2.81, tax: 0.21 }], 'FIFTY_FIFTY');
ver('C · 1,43 tecleado · 4 decimales · dos tramos', [{ concept: 'x', qty: 1, price: Number((1.43 / 1.21).toFixed(4)), tax: 0.21 }], 'FIFTY_FIFTY');
// ¿Es cosa de importes pequeños? Tamaño por banda, 4 decimales, un tramo y dos.
for (const terms of ['FULL_UPFRONT', 'FIFTY_FIFTY']) for (const dec of [4, 2]) {
  const bandas = [[100, 10000], [10001, 100000], [100001, 300000]];
  const out = [];
  for (const [a, b] of bandas) {
    let mal = 0, mayor = 0; let ej = '';
    for (let cents = a; cents <= b; cents++) {
      const T = cents / 100; const lines = [{ concept: 'x', qty: 1, price: Number((T / 1.21).toFixed(dec)), tax: 0.21 }];
      const quote = { lines, total: u.calcTotal(lines).toFixed(2), paymentTerms: terms, discountGlobalAmount: null, customBillingPlan: null };
      const plan = bp.resolveBillingPlan(quote); const reparto = bp.distributeStageAmounts(quote.total, plan);
      const suma = plan.reduce((acc, _s, i) => acc + Math.round(Number(il.grossOfLines(il.stageLinesReconciled(il.lineasParaFacturar(quote), plan, i, reparto[i])).toFixed(2)) * 100), 0);
      const dif = suma - Math.round(Number(quote.total) * 100);
      if (dif !== 0) { mal++; if (Math.abs(dif) > Math.abs(mayor)) { mayor = dif; ej = `${quote.total}→${(suma / 100).toFixed(2)}`; } }
    }
    out.push(`${(a / 100).toFixed(0)}–${(b / 100).toFixed(0)} €: ${mal} de ${b - a + 1} (mayor desvío ${mayor} cént., ${ej})`);
  }
  console.log(`\n## suma de facturas ≠ total del presupuesto · ${terms} · ${dec} decimales\n   ` + out.join('\n   '));
}

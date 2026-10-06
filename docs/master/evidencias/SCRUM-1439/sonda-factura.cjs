// SÓLO LEE: ejecuta funciones puras de dist/ tal como las encadena quotes.routes.ts:533-559 al aceptar.
// No emite, no numera, no sella, no toca base ni red. Uso: node sonda-factura.cjs <árbol con dist/>
const path = require('node:path');
const R = path.resolve(process.argv[2] || '.');
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const bp = require(path.join(R, 'dist/modules/quotes/domain/billingPlan.js'));
const il = require(path.join(R, 'dist/modules/invoicing/domain/invoiceLines.service.js'));
const vat = require(path.join(R, 'dist/modules/invoicing/domain/vat.service.js'));
const c = (n) => Math.round(Number(n) * 100);

function facturar(lines, paymentTerms) {
  const quote = { lines, total: u.calcTotal(lines).toFixed(2), paymentTerms, discountGlobalAmount: null, customBillingPlan: null };
  const plan = bp.resolveBillingPlan(quote);
  const reparto = bp.distributeStageAmounts(quote.total, plan);
  const facturas = plan.map((_s, i) => {
    const scaled = il.stageLinesReconciled(il.lineasParaFacturar(quote), plan, i, reparto[i]);
    const amount = Number(il.grossOfLines(scaled).toFixed(2)); // lo que la ruta guarda en `total`
    const d = vat.calcVatBreakdown(scaled);
    return { amount, base: d.base, cuota: d.cuota, scaled };
  });
  return { quote, plan, reparto, facturas, desgloseQuote: vat.calcVatBreakdown(lines) };
}

// ── un caso a la vista ──
for (const [nombre, lines, terms] of [
  ['100 tecleado, 4 decimales, UN tramo', [{ concept: 'x', qty: 1, price: 82.6446, tax: 0.21 }], 'FULL_UPFRONT'],
  ['100 tecleado, 4 decimales, DOS tramos', [{ concept: 'x', qty: 1, price: 82.6446, tax: 0.21 }], 'FIFTY_FIFTY'],
  ['100 tecleado, 2 decimales (lo de hoy), DOS tramos', [{ concept: 'x', qty: 1, price: 82.64, tax: 0.21 }], 'FIFTY_FIFTY'],
  ['99,99 tecleado, 4 decimales, DOS tramos (impar)', [{ concept: 'x', qty: 1, price: Number((99.99 / 1.21).toFixed(4)), tax: 0.21 }], 'FIFTY_FIFTY'],
]) {
  const r = facturar(lines, terms);
  console.log(`\n== ${nombre} · presupuesto total ${r.quote.total} · desglose ${r.desgloseQuote.base} + ${r.desgloseQuote.cuota} · plan ${JSON.stringify(r.plan.map((s) => s.pct ?? s.percent ?? s.label))}`);
  r.facturas.forEach((f, i) => console.log(`   factura ${i + 1}: total ${f.amount.toFixed(2)} · base ${f.base} · cuota ${f.cuota} · base+cuota ${((c(f.base) + c(f.cuota)) / 100).toFixed(2)} · línea ${JSON.stringify(f.scaled.map((l) => ({ qty: l.qty, price: l.price, tax: l.tax })))}`));
  console.log(`   suma de las facturas: ${(r.facturas.reduce((a, f) => a + c(f.amount), 0) / 100).toFixed(2)}`);
}

// ── barrido ──
function barrido(nombre, dec, terms, hacerLinea) {
  let n = 0; const mal = { sumaNoEsTotal: 0, basMasCuotaNoEsTotalDeFactura: 0, sumaBasesNoEsBase: 0, sumaCuotasNoEsCuota: 0, totalNoEsTecleado: 0 }; const ej = {};
  for (let cents = 100; cents <= 300000; cents++) {
    const T = cents / 100; const lines = hacerLinea(T, dec); const r = facturar(lines, terms); n++;
    const apunta = (k, t) => { mal[k]++; if (!ej[k]) ej[k] = t; };
    if (c(r.quote.total) !== cents) apunta('totalNoEsTecleado', `${T}→${r.quote.total}`);
    const suma = r.facturas.reduce((a, f) => a + c(f.amount), 0);
    if (suma !== c(r.quote.total)) apunta('sumaNoEsTotal', `${T}: ${r.facturas.map((f) => f.amount).join('+')} ≠ ${r.quote.total}`);
    if (r.facturas.some((f) => c(f.base) + c(f.cuota) !== c(f.amount))) apunta('basMasCuotaNoEsTotalDeFactura', `${T}: ${r.facturas.map((f) => `${f.base}+${f.cuota}≠${f.amount}`).join(' | ')}`);
    if (r.facturas.reduce((a, f) => a + c(f.base), 0) !== c(r.desgloseQuote.base)) apunta('sumaBasesNoEsBase', `${T}: ${r.facturas.map((f) => f.base).join('+')} ≠ ${r.desgloseQuote.base}`);
    if (r.facturas.reduce((a, f) => a + c(f.cuota), 0) !== c(r.desgloseQuote.cuota)) apunta('sumaCuotasNoEsCuota', `${T}: ${r.facturas.map((f) => f.cuota).join('+')} ≠ ${r.desgloseQuote.cuota}`);
  }
  console.log(`\n## ${nombre} · ${terms} · precio a ${dec} decimales · ${n} importes`);
  for (const k of Object.keys(mal)) console.log(`   ${k.padEnd(30)} ${String(mal[k]).padStart(6)}${ej[k] ? '   p. ej. ' + ej[k] : ''}`);
}
const una = (tax, qty) => (T, dec) => [{ concept: 'x', qty, price: Number((T / qty / (1 + tax)).toFixed(dec)), tax }];
for (const terms of ['FULL_UPFRONT', 'FIFTY_FIFTY']) for (const dec of [4, 2]) barrido('cantidad 1, 21 %', dec, terms, una(0.21, 1));
barrido('cantidad 1, 10 %', 4, 'FIFTY_FIFTY', una(0.10, 1));
barrido('cantidad 3, 21 %', 4, 'FIFTY_FIFTY', una(0.21, 3));
barrido('cantidad 3, 21 %', 4, 'FULL_UPFRONT', una(0.21, 3));

// docs/master/evidencias/SCRUM-1451/sonda-1451-signo-del-reparto.cjs — SCRUM-1451 (S4, 22-oct-2026)
//
// ¿HACIA QUÉ LADO se separa la suma de las facturas de un presupuesto por tramos?
// SCRUM-1439 contó 3.808 de 299.901 «hasta 2 céntimos», pero sin el signo. Si cae POR DEBAJO de lo
// aceptado, el Trabajo se queda «Parcial» con 1-2 céntimos de deuda (sonda-1451-un-centimo-de-menos).
//
// La MISMA cadena y la MISMA población que `docs/master/evidencias/SCRUM-1439/sonda-factura-detalle.cjs`
// (funciones puras de `dist/`, encadenadas como `quotes.routes.ts` al aceptar): 1,00–3.000,00 € de
// total tecleado, cantidad 1, 21 %, precio = tecleado / 1,21 a 2 decimales. Sólo lee.
//
// CONTROL: el total de casos con diferencia tiene que ser 3.808 a dos tramos, que es lo que midió 1439.
// Si sale otra cifra, la cadena no es la misma y el signo no vale (salida 2).
//
// Uso: node docs/master/evidencias/SCRUM-1451/sonda-1451-signo-del-reparto.cjs [árbol con dist/]
const path = require('node:path');
const R = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', '..'));
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const bp = require(path.join(R, 'dist/modules/quotes/domain/billingPlan.js'));
const il = require(path.join(R, 'dist/modules/invoicing/domain/invoiceLines.service.js'));

const ESPERADO_1439 = 3808;
for (const terms of ['FIFTY_FIFTY', 'FULL_UPFRONT']) {
  const porDif = new Map();
  let ejemploAbajo = '';
  for (let cents = 100; cents <= 300000; cents++) {
    const T = cents / 100;
    const lines = [{ concept: 'x', qty: 1, price: Number((T / 1.21).toFixed(2)), tax: 0.21 }];
    const quote = { lines, total: u.calcTotal(lines).toFixed(2), paymentTerms: terms, discountGlobalAmount: null, customBillingPlan: null };
    const plan = bp.resolveBillingPlan(quote);
    const reparto = bp.distributeStageAmounts(quote.total, plan);
    const suma = plan.reduce((acc, _s, i) => acc + Math.round(Number(il.grossOfLines(il.stageLinesReconciled(il.lineasParaFacturar(quote), plan, i, reparto[i])).toFixed(2)) * 100), 0);
    const dif = suma - Math.round(Number(quote.total) * 100);
    if (dif !== 0) {
      porDif.set(dif, (porDif.get(dif) || 0) + 1);
      if (dif < 0 && !ejemploAbajo) ejemploAbajo = `presupuesto ${quote.total} € → facturas suman ${(suma / 100).toFixed(2)} € (precio ${lines[0].price})`;
    }
  }
  const total = [...porDif.values()].reduce((a, b) => a + b, 0);
  const abajo = [...porDif].filter(([d]) => d < 0).reduce((a, [, n]) => a + n, 0);
  const arriba = total - abajo;
  console.log(`\n## ${terms} · 299.901 importes`);
  console.log(`   con diferencia: ${total} · POR ENCIMA: ${arriba} · POR DEBAJO: ${abajo}`);
  console.log(`   por céntimos: ${[...porDif].sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d > 0 ? '+' : ''}${d}: ${n}`).join(' · ') || '(ninguna)'}`);
  if (ejemploAbajo) console.log(`   ejemplo por debajo: ${ejemploAbajo}`);
  if (terms === 'FIFTY_FIFTY' && total !== ESPERADO_1439) {
    console.error(`🔴 NO SUPE MIRAR: a dos tramos salen ${total} casos y 1439 midió ${ESPERADO_1439}`);
    process.exit(2);
  }
}

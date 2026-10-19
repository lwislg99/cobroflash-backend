// SÓLO LEE. SCRUM-624c · ¿cuántas facturas imprimen en el PDF un TOTAL distinto del que guardan, por plan
// de cobro, número de líneas, cantidad y tipos? Uso: node medir-total-por-tramos.cjs <árbol con dist/> [nReal] [nPorCelda]
//
// Lo que añade a `sonda-papel-de-la-factura.cjs` (2-oct): (1) el PDF de VERDAD y (2) las facturas POR TRAMOS.
//   · Fase 1: llama a `generateInvoicePdf` de dist/ con `PDFDocument.prototype.text` ESPIADO (sin tocar src/
//     ni dist/), lee el texto que sigue a «TOTAL:» y comprueba que la réplica de la fase 2 da EXACTAMENTE ese
//     texto en todas las facturas de la muestra. Si una sola difiere, se para: la réplica no vale.
//   · Fase 2: la réplica (pdf.service.ts, bloque de totales) sobre miles de facturas por celda.
// Las facturas salen del camino de emisión real: lineasParaFacturar → stageLinesReconciled con el objetivo de
// distributeStageAmounts(calcTotal) → grossOfLines, que es lo que se guarda en `Invoice.total`.
//
// ⚠️ `generateInvoicePdf` ESCRIBE el PDF en `<cwd>/storage/invoices`. Por eso este guion se cambia a un
// directorio temporal del sistema ANTES de cargar nada de dist/: nunca escribe dentro del repositorio.
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

if (process.argv.includes('--help') || process.argv.length < 3) {
  console.log('Uso: node medir-total-por-tramos.cjs <árbol con dist/> [nReal=300] [nPorCelda=3000]\nSólo lee dist/; los PDF van a un temporal del sistema.');
  process.exit(0);
}
const raiz = path.resolve(process.argv[2]);
const N_REAL = Number(process.argv[3] || 300);
const N_CELDA = Number(process.argv[4] || 3000);
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum624c-'));
process.chdir(temporal);
process.on('exit', () => { process.chdir(os.tmpdir()); fs.rmSync(temporal, { recursive: true, force: true }); });

const d = (p) => path.join(raiz, 'dist', p);
const PDFDocument = createRequire(d('index.js'))('pdfkit');
const textos = [];
const textoOriginal = PDFDocument.prototype.text;
PDFDocument.prototype.text = function (t, ...resto) { textos.push(String(t)); return textoOriginal.call(this, t, ...resto); };

const { generateInvoicePdf, fmtImporte } = require(d('modules/invoicing/infra/pdf/pdf.service.js'));
const { lineasParaFacturar, stageLinesReconciled, grossOfLines } = require(d('modules/invoicing/domain/invoiceLines.service.js'));
const { distributeStageAmounts } = require(d('modules/quotes/domain/billingPlan.js'));
const { calcTotal } = require(d('core/utils/utils.js'));
const { cantidadDeLinea } = require(d('modules/invoicing/domain/vat.service.js'));

/** La réplica del bloque de totales del PDF de factura (pdf.service.ts, «Agrupar IVA por tipo» y «TOTAL:»). */
function totalImpreso(lines) {
  const vatMap = {};
  let subtotal = 0;
  lines.forEach((l) => {
    const base = cantidadDeLinea(l.qty) * (Number(l.price) || 0);
    const t = Number(l.tax) || 0;
    subtotal += base;
    const key = `${(t * 100).toFixed(0)}%`;
    if (!vatMap[key]) vatMap[key] = { base: 0, vat: 0 };
    vatMap[key].base += base;
    vatMap[key].vat += base * t;
  });
  return fmtImporte(subtotal + Object.values(vatMap).reduce((a, b) => a + b.vat, 0));
}

let semilla = 20261019;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const PLANES = {
  unica: [{ index: 0, percentage: 1 }],
  '50/50': [{ index: 0, percentage: 0.5 }, { index: 1, percentage: 0.5 }],
  '30/40/30': [{ index: 0, percentage: 0.3 }, { index: 1, percentage: 0.4 }, { index: 2, percentage: 0.3 }],
};

function presupuesto({ nLineas, decimales, tipos }) {
  const lines = [];
  for (let k = 0; k < nLineas; k++) {
    const l = {
      concept: 'L' + k,
      qty: decimales ? Math.round((0.5 + azar() * 40) * 100) / 100 : 1 + Math.floor(azar() * 8),
      price: Math.round(azar() * 40000) / 100,
      tax: tipos[Math.floor(azar() * tipos.length)],
    };
    if (azar() < 0.1) l.dto = [5, 10, 15][Math.floor(azar() * 3)];
    lines.push(l);
  }
  return { lines, discountGlobalAmount: null };
}

/** Las facturas que la emisión real sacaría de ese presupuesto con ese plan (quotesAdmin.routes.ts, `tramoTrasEmitidas`). */
function facturas(quote, plan) {
  const quoteLines = lineasParaFacturar(quote);
  const objetivos = distributeStageAmounts(calcTotal(quote.lines, null), plan);
  return plan.map((s) => {
    const lines = stageLinesReconciled(quoteLines, plan, s.index, objetivos[s.index]);
    return { lines, guardado: grossOfLines(lines) };
  });
}

(async () => {
  // Control negativo: una línea entera al 21 % en factura única no puede descuadrar.
  const ctl = facturas({ lines: [{ concept: 'x', qty: 1, price: 100, tax: 0.21 }], discountGlobalAmount: null }, PLANES.unica)[0];
  if (totalImpreso(ctl.lines) !== fmtImporte(ctl.guardado)) { console.log('CONTROL NEGATIVO FALLA'); process.exit(4); }

  let validadas = 0, difReal = 0, ejemplo = null;
  for (let i = 0; i < N_REAL; i++) {
    const q = presupuesto({ nLineas: 1 + Math.floor(azar() * 12), decimales: azar() < 0.5, tipos: azar() < 0.5 ? [0.21] : [0.21, 0.10, 0.04] });
    const planNombre = Object.keys(PLANES)[Math.floor(azar() * 3)];
    for (const f of facturas(q, PLANES[planNombre])) {
      textos.length = 0;
      await generateInvoicePdf({ number: `T-${i}`, invoiceId: i, merchantId: 999999, merchant: { name: 'Banco' }, customer: { name: 'Cliente' }, currency: 'EUR', total: String(f.guardado), qrData: 'x', lines: f.lines, type: 'F1' });
      const iTotal = textos.lastIndexOf('TOTAL:');
      if (iTotal < 0) { console.log('CIEGO: el PDF real no ha escrito «TOTAL:»'); process.exit(2); }
      const impreso = textos[iTotal + 1].replace(/ EUR$/, '');
      if (impreso !== totalImpreso(f.lines)) { console.log('LA RÉPLICA NO ES EL PDF', { impreso, replica: totalImpreso(f.lines) }); process.exit(3); }
      validadas++;
      if (impreso !== fmtImporte(f.guardado)) { difReal++; if (!ejemplo) ejemplo = { plan: planNombre, lineas: f.lines.length, guardado: fmtImporte(f.guardado), impreso }; }
    }
  }
  if (difReal === 0) { console.log('CIEGO: la muestra real no ha producido NINGÚN descuadre; un 0 % de la fase 2 no valdría nada'); process.exit(5); }
  console.log(`FASE 1 · PDF real: ${validadas} facturas · la réplica da el mismo TOTAL en las ${validadas} · TOTAL impreso ≠ guardado en ${difReal}`);
  console.log('   primer caso real:', JSON.stringify(ejemplo));

  console.log('FASE 2 · plan | líneas | cantidad | tipos | facturas | TOTAL impreso ≠ guardado | máx.');
  for (const [planNombre, plan] of Object.entries(PLANES)) {
    for (const [tramo, [a, b]] of Object.entries({ '1-3': [1, 3], '4-10': [4, 10], '11-40': [11, 40] })) {
      for (const decimales of [false, true]) {
        for (const tipos of [[0.21], [0.21, 0.10, 0.04]]) {
          let n = 0, mal = 0, max = 0;
          for (let i = 0; i < N_CELDA; i++) {
            const q = presupuesto({ nLineas: a + Math.floor(azar() * (b - a + 1)), decimales, tipos });
            for (const f of facturas(q, plan)) {
              n++;
              const imp = totalImpreso(f.lines);
              if (imp !== fmtImporte(f.guardado)) {
                mal++;
                const c = Math.abs(Math.round(Number(imp.replace(/\./g, '').replace(',', '.')) * 100) - Math.round(f.guardado * 100));
                max = Math.max(max, c);
              }
            }
          }
          console.log(`  ${planNombre} | ${tramo} | ${decimales ? 'decimal' : 'entera'} | ${tipos.length === 1 ? '21 %' : '21/10/4 %'} | ${n} | ${(100 * mal / n).toFixed(2)} % | ${max} cént.`);
        }
      }
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });

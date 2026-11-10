// SÓLO LEE. SCRUM-1566 · expediente de los tres céntimos (1566 · 623 · 624 ②).
// Uso: node expediente-tres-centimos.cjs <árbol con dist/> [nPdfReal=300] [nPorPoblacion=4000]
//
// La pregunta: ¿las tres discrepancias se arreglan con UN cambio o con tres, y arreglar una descuadra otra?
// No se puede contestar cambiando el código (regla 38: es camino de emisión). Así que:
//   1. Se cargan de dist/ las funciones REALES (calcVatBreakdown, grossOfLines, pieDePresupuesto, calcTotal,
//      el camino de tramos y generateInvoicePdf). Nada de src/ ni de dist/ se modifica.
//   2. Se escribe una RÉPLICA de cada superficie con el redondeo como parámetro, y se exige que, con el
//      redondeo de hoy, la réplica dé EXACTAMENTE lo mismo que la función real (y que el PDF de verdad,
//      leído con `PDFDocument.prototype.text` espiado). Si una sola difiere, se para.
//   3. Los arreglos posibles se SIMULAN sobre esa réplica. Son hipótesis, no código: el día que se
//      construyan, se miden otra vez sobre el código de verdad.
//
// ⚠️ `generateInvoicePdf` ESCRIBE el PDF en `<cwd>/storage/invoices`: el guion se cambia a un temporal del
// sistema ANTES de cargar dist/ y lo borra al salir. Nunca escribe dentro del repositorio.
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

if (process.argv.includes('--help') || process.argv.length < 3) {
  console.log('Uso: node expediente-tres-centimos.cjs <árbol con dist/> [nPdfReal=300] [nPorPoblacion=4000]');
  process.exit(0);
}
const raiz = path.resolve(process.argv[2]);
const N_PDF = Number(process.argv[3] || 300);
const N_POB = Number(process.argv[4] || 4000);
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1566-'));
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
const { calcTotal, tipoEnPorcentaje } = require(d('core/utils/utils.js'));
const { calcVatBreakdown, cantidadDeLinea } = require(d('modules/invoicing/domain/vat.service.js'));
const { pieDePresupuesto } = require(d('modules/quotes/domain/presentacionIva.js'));

// ── LOS DOS REDONDEOS ─────────────────────────────────────────────────────────────────────────
// HOY: `Math.round(n * 100) / 100` (vat.service.ts:23, presentacionIva.ts:92, utils.ts calcTotal,
// invoiceLines.service.ts:147). En un empate de medio céntimo decide el binario: 22,5 × 0,21 = 4,72499…→ 4,72.
const R_HOY = (n) => Math.round(n * 100) / 100;
// SIMULADO: un redondeo decimal al medio céntimo hacia arriba (en valor absoluto). Es UN candidato para
// medir el efecto, no una propuesta de convención: cuál manda es de la asesoría.
const R_DEC = (n) => { const s = n < 0 ? -1 : 1; return s * Math.round(Number((Math.abs(n) * 100).toFixed(6))) / 100; };

// ── RÉPLICAS (con el redondeo como parámetro) ───────────────────────────────────────────────
/** calcVatBreakdown (vat.service.ts:56-92), sin `causa` (ninguna línea de aquí la lleva). */
function canon(lines, R) {
  const map = new Map();
  for (const l of lines) {
    const base = cantidadDeLinea(l.qty) * (Number(l.price) || 0);
    const t = Number(l.tax) || 0;
    const rate = tipoEnPorcentaje(t);
    const e = map.get(rate) || { rate, base: 0, cuota: 0 };
    e.base += base; e.cuota += base * t; map.set(rate, e);
  }
  const entries = [...map.values()].map((v) => ({ rate: v.rate, base: R(v.base), cuota: R(v.cuota) })).sort((a, b) => b.rate - a.rate);
  return { entries, base: R(entries.reduce((a, e) => a + e.base, 0)), cuota: R(entries.reduce((a, e) => a + e.cuota, 0)) };
}
/** grossOfLines (invoiceLines.service.ts:155): lo que se GUARDA en Invoice.total y va a ImporteTotal. */
const guardado = (lines, R) => { const b = canon(lines, R); return R(b.base + b.cuota); };
/** pieDePresupuesto sin descuentos (presentacionIva.ts:157-182): redondea la base del tipo y LUEGO la multiplica. */
function pieSinDto(lines, R) {
  const b = canon(lines, R);
  const filas = [{ etiqueta: 'Base imponible:', importe: R(b.base) }];
  for (const e of b.entries) { if (e.cuota === 0) continue; const c = R(e.base * (e.rate / 100)); if (c === 0) continue; filas.push({ etiqueta: `IVA ${e.rate}%:`, importe: c }); }
  return filas;
}
/** calcTotal sin descuento global (utils.ts:230): suma TODO sin redondear y redondea una vez. */
const totalPresupuesto = (lines, R) => R(lines.reduce((a, l) => a + Number(l.qty) * precioEfectivo(l) * (1 + (Number(l.tax) || 0)), 0));
const precioEfectivo = (l) => { const dto = Number(l.dto); const p = Number(l.price); return Number.isFinite(dto) && dto > 0 ? p * (1 - Math.min(100, dto) / 100) : p; };
/** El bloque de totales del PDF de factura (pdf.service.ts:546-664): `vatMap`, sin redondear hasta `fmt`. */
function pdfFacturaHoy(lines) {
  const vatMap = {}; let subtotal = 0;
  for (const l of lines) {
    const base = cantidadDeLinea(l.qty) * (Number(l.price) || 0); const t = Number(l.tax) || 0;
    subtotal += base; const key = `${(t * 100).toFixed(0)}%`;
    if (!vatMap[key]) vatMap[key] = { base: 0, vat: 0 };
    vatMap[key].base += base; vatMap[key].vat += base * t;
  }
  const tipos = Object.entries(vatMap).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  const totalVat = Object.values(vatMap).reduce((a, b) => a + b.vat, 0);
  return {
    base: fmtImporte(subtotal),
    filas: tipos.filter(([, g]) => tipos.length > 1 || g.vat !== 0).map(([r, g]) => `${r}=${fmtImporte(g.vat)}`),
    total: fmtImporte(subtotal + totalVat),
  };
}
/** ARREGLO A, SIMULADO: el bloque de totales del PDF de factura lee la canónica y el total guardado. */
function pdfFacturaA(lines, R) {
  const b = canon(lines, R);
  return {
    base: fmtImporte(b.base),
    filas: b.entries.filter((e) => b.entries.length > 1 || e.cuota !== 0).map((e) => `${e.rate}%=${fmtImporte(e.cuota)}`),
    total: fmtImporte(guardado(lines, R)),
  };
}
/** Lo que declara el registro fiscal (registro.builder.ts:315-332 y verifactu.service.ts:293-297), en el mismo formato. */
function xml(lines, R) {
  const b = canon(lines, R);
  return { base: fmtImporte(b.base), filas: b.entries.filter((e) => b.entries.length > 1 || e.cuota !== 0).map((e) => `${e.rate}%=${fmtImporte(e.cuota)}`), total: fmtImporte(guardado(lines, R)) };
}
/** La página de firma sin descuento (quoteDecisionLanding.routes.ts:493-498): filas de `calcVatBreakdown`. */
const paginaFilas = (lines, R) => canon(lines, R).entries.filter((e) => e.rate > 0).map((e) => `${e.rate}=${fmtImporte(e.cuota)}`);
/** El PDF del presupuesto sin descuento: filas de `pieDePresupuesto`. ARREGLO B, SIMULADO: la cuota de la canónica. */
const pdfPresupuestoFilas = (lines, R, B) => (B ? canon(lines, R).entries.filter((e) => e.cuota !== 0).map((e) => `${e.rate}=${fmtImporte(e.cuota)}`)
  : pieSinDto(lines, R).filter((f) => f.etiqueta !== 'Base imponible:').map((f) => `${f.etiqueta.replace(/^IVA |%:$/g, '')}=${fmtImporte(f.importe)}`));
const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
const cuadra = (doc) => Math.round(num(doc.base) * 100) + doc.filas.reduce((a, f) => a + Math.round(num(f.split('=')[1]) * 100), 0) === Math.round(num(doc.total) * 100);
const igual = (a, b) => a.base === b.base && a.total === b.total && a.filas.join('|') === b.filas.join('|');

// ── POBLACIÓN (la de SCRUM-624c, misma semilla y mismo generador) ────────────────────────────
let semilla = 20261022;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const PLANES = {
  unica: [{ index: 0, percentage: 1 }],
  '50/50': [{ index: 0, percentage: 0.5 }, { index: 1, percentage: 0.5 }],
  '30/40/30': [{ index: 0, percentage: 0.3 }, { index: 1, percentage: 0.4 }, { index: 2, percentage: 0.3 }],
};
function presupuesto({ nLineas, decimales, tipos, conDto = true }) {
  const lines = [];
  for (let k = 0; k < nLineas; k++) {
    const l = { concept: 'L' + k, qty: decimales ? Math.round((0.5 + azar() * 40) * 100) / 100 : 1 + Math.floor(azar() * 8), price: Math.round(azar() * 40000) / 100, tax: tipos[Math.floor(azar() * tipos.length)] };
    if (conDto && azar() < 0.1) l.dto = [5, 10, 15][Math.floor(azar() * 3)];
    lines.push(l);
  }
  return { lines, discountGlobalAmount: null };
}
/** Las facturas que la emisión real sacaría (quotesAdmin.routes.ts, `tramoTrasEmitidas`). `totalFirmado` es el
 *  objetivo del reparto: hoy `calcTotal`; en el arreglo D, SIMULADO, el de la canónica. */
function facturas(quote, plan, totalFirmado = calcTotal(quote.lines, null)) {
  const quoteLines = lineasParaFacturar(quote);
  const objetivos = distributeStageAmounts(totalFirmado, plan);
  return plan.map((s) => stageLinesReconciled(quoteLines, plan, s.index, objetivos[s.index]));
}
/** ARREGLO D, SIMULADO: el total del presupuesto (lo que se firma) sale de la canónica, no de `calcTotal`. */
const totalPresupuestoD = (quote, R) => guardado(lineasParaFacturar(quote), R);

(async () => {
  // ── 0 · LAS RÉPLICAS SON EL CÓDIGO (con el redondeo de hoy) ────────────────────────────────
  let compRep = 0;
  const comprobarReplicas = (q, fs_) => {
    const real = calcVatBreakdown(q.lines.map((l) => ({ ...l, price: precioEfectivo(l) })));
    const rep = canon(q.lines.map((l) => ({ ...l, price: precioEfectivo(l) })), R_HOY);
    if (JSON.stringify(real) !== JSON.stringify(rep)) throw new Error('RÉPLICA canon ≠ calcVatBreakdown ' + JSON.stringify({ real, rep }));
    if (totalPresupuesto(q.lines, R_HOY) !== calcTotal(q.lines, null)) throw new Error('RÉPLICA total ≠ calcTotal');
    if (!q.lines.some((l) => l.dto)) {
      const pr = pieDePresupuesto({ lineas: q.lines, modo: 'sumar', nombreImpuesto: 'IVA' }).filas;
      if (JSON.stringify(pr) !== JSON.stringify(pieSinDto(q.lines, R_HOY))) throw new Error('RÉPLICA pie ≠ pieDePresupuesto');
    }
    for (const lines of fs_) if (guardado(lines, R_HOY) !== grossOfLines(lines)) throw new Error('RÉPLICA guardado ≠ grossOfLines');
    compRep++;
  };

  // ── 1 · LA RÉPLICA DEL PDF DE FACTURA ES EL PDF (base, cada fila de IVA y TOTAL, leídos del papel) ──
  let pdfVal = 0;
  for (let i = 0; i < N_PDF; i++) {
    const q = presupuesto({ nLineas: 1 + Math.floor(azar() * 12), decimales: azar() < 0.5, tipos: azar() < 0.5 ? [0.21] : [0.21, 0.10, 0.04] });
    const plan = PLANES[Object.keys(PLANES)[Math.floor(azar() * 3)]];
    const fs_ = facturas(q, plan); comprobarReplicas(q, fs_);
    for (const lines of fs_) {
      textos.length = 0;
      await generateInvoicePdf({ number: `T-${i}`, invoiceId: i, merchantId: 999999, merchant: { name: 'Banco' }, customer: { name: 'Cliente' }, currency: 'EUR', total: String(grossOfLines(lines)), qrData: 'x', lines, type: 'F1' });
      const iBase = textos.lastIndexOf('Base imponible:'); const iTot = textos.lastIndexOf('TOTAL:');
      if (iBase < 0 || iTot < 0) { console.log('CIEGO: el PDF real no ha escrito «Base imponible:» o «TOTAL:»'); process.exit(2); }
      const filas = [];
      for (let k = iBase + 2; k < iTot; k++) { const m = /^IVA (\d+%):$/.exec(textos[k]); if (m) filas.push(`${m[1]}=${textos[k + 1].replace(/ EUR$/, '')}`); }
      const real = { base: textos[iBase + 1].replace(/ EUR$/, ''), filas: filas.sort((a, b) => parseFloat(b) - parseFloat(a)), total: textos[iTot + 1].replace(/ EUR$/, '') };
      const rep = pdfFacturaHoy(lines);
      if (!igual(real, rep)) { console.log('LA RÉPLICA NO ES EL PDF', JSON.stringify({ real, rep })); process.exit(3); }
      pdfVal++;
    }
  }
  console.log(`CONTROL · PDF de factura real: ${pdfVal} facturas, la réplica da la MISMA base, filas de IVA y TOTAL en las ${pdfVal}`);

  // ── 2 · CONTROL POSITIVO DEL EMPATE: el caso a mano de SCRUM-1444 tiene que salir ─────────
  const caso = [{ qty: 1, price: 22.5, tax: 0.21 }];
  const ch = canon(caso, R_HOY), cd = canon(caso, R_DEC);
  if (ch.entries[0].cuota !== 4.72 || cd.entries[0].cuota !== 4.73) { console.log('CONTROL POSITIVO FALLA: 22,50 al 21 %', ch, cd); process.exit(4); }
  console.log('CONTROL · 1 × 22,50 € al 21 %: hoy cuota 4,72 (empate mal resuelto) · redondeo decimal 4,73 · el comparador lo ve');

  // ── 3 · ESCENARIOS ─────────────────────────────────────────────────────────────────────────
  const ESC = {
    'hoy':                     { A: false, B: false, R: R_HOY },
    'sólo A (PDF factura ← canónica)': { A: true, B: false, R: R_HOY },
    'sólo B (pie presup. ← canónica)': { A: false, B: true, R: R_HOY },
    'sólo C (empate, en el motor)':    { A: false, B: false, R: R_DEC },
    'A + B':                   { A: true, B: true, R: R_HOY },
    'A + B + C':               { A: true, B: true, R: R_DEC },
    'A + B + C + D (total firmado ← canónica)': { A: true, B: true, R: R_DEC, D: true },
  };
  const POBS = [
    ['factura única · entera · 21 %', { plan: 'unica', a: 1, b: 10, decimales: false, tipos: [0.21] }],
    ['factura única · entera · 10 %', { plan: 'unica', a: 1, b: 10, decimales: false, tipos: [0.10] }],
    ['factura única · decimal · 21 %', { plan: 'unica', a: 1, b: 10, decimales: true, tipos: [0.21] }],
    ['factura única · decimal · 10 %', { plan: 'unica', a: 1, b: 10, decimales: true, tipos: [0.10] }],
    ['factura única · decimal · 21/10/4 %', { plan: 'unica', a: 1, b: 10, decimales: true, tipos: [0.21, 0.10, 0.04] }],
    ['tramos 50/50 · entera · 21 %', { plan: '50/50', a: 4, b: 10, decimales: false, tipos: [0.21] }],
    ['tramos 30/40/30 · decimal · 21/10/4 %', { plan: '30/40/30', a: 4, b: 10, decimales: true, tipos: [0.21, 0.10, 0.04] }],
  ];
  const pct = (x, n) => (100 * x / n).toFixed(1).replace('.', ',') + ' %';
  for (const [nombre, p] of POBS) {
    // La MISMA población para todos los escenarios: se genera una vez.
    const muestra = [];
    for (let i = 0; i < N_POB; i++) {
      const q = presupuesto({ nLineas: p.a + Math.floor(azar() * (p.b - p.a + 1)), decimales: p.decimales, tipos: p.tipos });
      const fs_ = facturas(q, PLANES[p.plan]);
      if (i < 200) comprobarReplicas(q, fs_);
      muestra.push({ q, fs_, fsD: facturas(q, PLANES[p.plan], totalPresupuestoD(q, R_DEC)) });
    }
    console.log(`\n## ${nombre} · ${N_POB} presupuestos · ${muestra.reduce((a, m) => a + m.fs_.length, 0)} facturas`);
    console.log('escenario | ①1566 página≠PDF presup. (IVA) | ②623 PDF factura≠XML | ③624 total impreso≠guardado | página presup. no cuadra consigo | PDF presup. no cuadra consigo | PDF factura no cuadra consigo | XML no cuadra consigo | presup.≠factura (IVA, única)');
    for (const [en, e] of Object.entries(ESC)) {
      let nq = 0, nf = 0, m1566 = 0, m623 = 0, m624 = 0, pagNo = 0, ppNo = 0, pdfNo = 0, xmlNo = 0, pf = 0, npf = 0;
      for (const { q, fs_: fsHoy, fsD } of muestra) {
        const fs_ = e.D ? fsD : fsHoy;
        const sinDto = !q.lines.some((l) => l.dto);
        if (sinDto) {
          nq++;
          if (paginaFilas(q.lines, e.R).join('|') !== pdfPresupuestoFilas(q.lines, e.R, e.B).join('|')) m1566++;
          const total = fmtImporte(e.D ? totalPresupuestoD(q, e.R) : totalPresupuesto(q.lines, e.R));
          const base = fmtImporte(canon(q.lines, e.R).base);
          if (!cuadra({ base, total, filas: paginaFilas(q.lines, e.R) })) pagNo++;
          if (!cuadra({ base, total, filas: pdfPresupuestoFilas(q.lines, e.R, e.B) })) ppNo++;
        }
        for (const lines of fs_) {
          nf++;
          const papel = e.A ? pdfFacturaA(lines, e.R) : pdfFacturaHoy(lines);
          const reg = xml(lines, e.R);
          if (!igual(papel, reg)) m623++;
          if (papel.total !== reg.total) m624++;
          if (!cuadra(papel)) pdfNo++;
          if (!cuadra(reg)) xmlNo++;
        }
        if (p.plan === 'unica' && sinDto) {
          npf++;
          const facturaFilas = (e.A ? pdfFacturaA(fs_[0], e.R) : pdfFacturaHoy(fs_[0])).filas.map((f) => f.replace('%=', '='));
          if (pdfPresupuestoFilas(q.lines, e.R, e.B).join('|') !== facturaFilas.filter((f) => !f.endsWith('=0,00')).join('|')) pf++;
        }
      }
      console.log(`${en} | ${pct(m1566, nq)} | ${pct(m623, nf)} | ${pct(m624, nf)} | ${pct(pagNo, nq)} | ${pct(ppNo, nq)} | ${pct(pdfNo, nf)} | ${pct(xmlNo, nf)} | ${npf ? pct(pf, npf) : '—'}`);
    }
  }
  console.log(`\nCONTROL · réplicas comprobadas contra las funciones reales en ${compRep} presupuestos (y sus facturas)`);
})().catch((e) => { console.error(e); process.exit(1); });

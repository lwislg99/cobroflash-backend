// docs/master/evidencias/SCRUM-624/papel-contra-xml-real.cjs — SCRUM-624d (arreglo A)
//
// EL PDF DE VERDAD CONTRA LO QUE DECLARA EL XML, sobre las siete poblaciones de SCRUM-1566.
//
// Diferencia con `evidencias/SCRUM-1566/expediente-tres-centimos.cjs`: aquél SIMULA el arreglo A con
// una réplica del bloque de totales. Éste NO simula nada: llama a `generateInvoicePdf` del `dist/` que
// se le pase, lee del papel la base, cada fila de IVA y el TOTAL, y los compara con lo que el registro
// declara (`calcVatBreakdown` de las líneas para base y cuotas, `Invoice.total` para el total:
// `verifactu.service.ts:293` y `:1155`). Se corre ANTES y DESPUÉS del arreglo con la MISMA población.
//
//   node <guion> <árbol con dist/> [presupuestos por población = 1000]
//
// Población: el generador de 624c/1566 (misma semilla, mismos planes, mismos parámetros por
// población). La secuencia de azar no depende de ningún resultado, así que antes y después ven las
// mismas facturas. Cada factura F1 guarda `grossOfLines(líneas)` (los cuatro caminos de tramos y la
// factura única). Y por cada F1 se mide su R1 tal como la arma `invoicesAdmin.routes.ts` (precio
// negado, total = −total de la original).
//
// CONTROLES: ① SUELO — si el papel no escribe «Base imponible:» o «TOTAL:», CIEGO (salida 2).
// ② POSITIVO SEMBRADO — en cada población, la primera factura se compara además contra un registro
// con el total desplazado 0,01: el comparador TIENE que verlo; si no, CIEGO (salida 2).
// ③ CERO — el papel contra sí mismo: 0 diferencias, o CIEGO (salida 2).
//
// ⚠️ `generateInvoicePdf` ESCRIBE el PDF bajo el cwd: el guion se cambia a un temporal y lo borra.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');

if (process.argv.length < 3) {
  console.log('uso: node papel-contra-xml-real.cjs <árbol con dist/> [presupuestos por población]');
  process.exit(1);
}
const raiz = path.resolve(process.argv[2]);
const N_POB = Number(process.argv[3] || 1000);

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum624d-'));
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
const { calcTotal, rotuloDeTipo } = require(d('core/utils/utils.js'));
const { calcVatBreakdown } = require(d('modules/invoicing/domain/vat.service.js'));

// ── LO QUE DECLARA EL REGISTRO, en el formato del papel ────────────────────────────────────────
function registro(lines, total) {
  const b = calcVatBreakdown(lines);
  return {
    base: fmtImporte(b.base),
    filas: b.entries.filter((e) => b.entries.length > 1 || e.cuota !== 0).map((e) => `${rotuloDeTipo(e.rate)}%=${fmtImporte(e.cuota)}`),
    total: fmtImporte(Number(total)),
  };
}

// ── LO QUE IMPRIME EL PAPEL ─────────────────────────────────────────────────────────────────────
let nPdf = 0;
async function papel(lines, total, type, i) {
  textos.length = 0;
  await generateInvoicePdf({ number: `P-${i}`, invoiceId: i, merchantId: 999999, merchant: { name: 'Banco' }, customer: { name: 'Cliente' }, currency: 'EUR', total: String(total), qrData: 'x', lines, type, rectifiesNumber: type === 'R1' ? 'P-orig' : null, zona: null });
  nPdf++;
  const iBase = textos.lastIndexOf('Base imponible:'); const iTot = textos.lastIndexOf('TOTAL:');
  if (iBase < 0 || iTot < 0) { console.log('CIEGO: el PDF real no ha escrito «Base imponible:» o «TOTAL:»'); process.exit(2); }
  const filas = [];
  for (let k = iBase + 2; k < iTot; k++) { const m = /^IVA ([\d,]+%):$/.exec(textos[k]); if (m) filas.push(`${m[1]}=${textos[k + 1].replace(/ EUR$/, '')}`); }
  return { base: textos[iBase + 1].replace(/ EUR$/, ''), filas, total: textos[iTot + 1].replace(/ EUR$/, '') };
}

const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
const cuadra = (doc) => Math.round(num(doc.base) * 100) + doc.filas.reduce((a, f) => a + Math.round(num(f.split('=')[1]) * 100), 0) === Math.round(num(doc.total) * 100);
const orden = (filas) => [...filas].sort();
const igual = (a, b) => a.base === b.base && a.total === b.total && orden(a.filas).join('|') === orden(b.filas).join('|');

// ── POBLACIÓN (la de SCRUM-624c / SCRUM-1566: misma semilla y mismo generador) ─────────────────
let semilla = 20261022;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const PLANES = {
  unica: [{ index: 0, percentage: 1 }],
  '50/50': [{ index: 0, percentage: 0.5 }, { index: 1, percentage: 0.5 }],
  '30/40/30': [{ index: 0, percentage: 0.3 }, { index: 1, percentage: 0.4 }, { index: 2, percentage: 0.3 }],
};
function presupuesto({ nLineas, decimales, tipos }) {
  const lines = [];
  for (let k = 0; k < nLineas; k++) {
    const l = { concept: 'L' + k, qty: decimales ? Math.round((0.5 + azar() * 40) * 100) / 100 : 1 + Math.floor(azar() * 8), price: Math.round(azar() * 40000) / 100, tax: tipos[Math.floor(azar() * tipos.length)] };
    if (azar() < 0.1) l.dto = [5, 10, 15][Math.floor(azar() * 3)];
    lines.push(l);
  }
  return { lines, discountGlobalAmount: null };
}
function facturas(quote, plan) {
  const quoteLines = lineasParaFacturar(quote);
  const objetivos = distributeStageAmounts(calcTotal(quote.lines, null), plan);
  return plan.map((s) => stageLinesReconciled(quoteLines, plan, s.index, objetivos[s.index]));
}
const POBS = [
  ['factura única · entera · 21 %', { plan: 'unica', a: 1, b: 10, decimales: false, tipos: [0.21] }],
  ['factura única · entera · 10 %', { plan: 'unica', a: 1, b: 10, decimales: false, tipos: [0.10] }],
  ['factura única · decimal · 21 %', { plan: 'unica', a: 1, b: 10, decimales: true, tipos: [0.21] }],
  ['factura única · decimal · 10 %', { plan: 'unica', a: 1, b: 10, decimales: true, tipos: [0.10] }],
  ['factura única · decimal · 21/10/4 %', { plan: 'unica', a: 1, b: 10, decimales: true, tipos: [0.21, 0.10, 0.04] }],
  ['tramos 50/50 · entera · 21 %', { plan: '50/50', a: 4, b: 10, decimales: false, tipos: [0.21] }],
  ['tramos 30/40/30 · decimal · 21/10/4 %', { plan: '30/40/30', a: 4, b: 10, decimales: true, tipos: [0.21, 0.10, 0.04] }],
];
const pct = (x, n) => (n ? (100 * x / n).toFixed(1).replace('.', ',') : '—') + ' %';

(async () => {
  console.log('población | tipo | facturas | PDF≠XML | TOTAL impreso≠guardado | PDF no cuadra consigo | XML no cuadra consigo | R1 guarda un total que no es Σ(base+cuota) de sus líneas');
  let cero = 0, sembrado = 0;
  for (const [nombre, p] of POBS) {
    const c = { F1: { n: 0, dif: 0, tot: 0, pdfNo: 0, xmlNo: 0 }, R1: { n: 0, dif: 0, tot: 0, pdfNo: 0, xmlNo: 0, incoherente: 0 } };
    for (let i = 0; i < N_POB; i++) {
      const q = presupuesto({ nLineas: p.a + Math.floor(azar() * (p.b - p.a + 1)), decimales: p.decimales, tipos: p.tipos });
      for (const lines of facturas(q, PLANES[p.plan])) {
        const total = grossOfLines(lines).toFixed(2);
        const negLines = lines.map((l) => ({ ...l, price: -(Number(l.price) || 0) }));
        const totalR1 = (-Number(total)).toFixed(2);
        for (const [tipo, ls, t] of [['F1', lines, total], ['R1', negLines, totalR1]]) {
          const k = c[tipo];
          const pap = await papel(ls, t, tipo, i);
          const reg = registro(ls, t);
          k.n++;
          if (!igual(pap, reg)) k.dif++;
          if (pap.total !== reg.total) k.tot++;
          if (!cuadra(pap)) k.pdfNo++;
          if (!cuadra(reg)) k.xmlNo++;
          if (!igual(pap, pap)) cero++;
          if (tipo === 'R1') {
            const bd = calcVatBreakdown(ls);
            if ((bd.base + bd.cuota).toFixed(2) !== Number(t).toFixed(2)) k.incoherente++;
          }
          if (i === 0 && tipo === 'F1' && k.n === 1) {
            const desplazado = registro(ls, (Number(t) + 0.01).toFixed(2));
            if (igual(pap, desplazado)) { console.log(`CIEGO: el comparador no ve un total desplazado 0,01 (${nombre})`); process.exit(2); }
            sembrado++;
          }
        }
      }
    }
    for (const tipo of ['F1', 'R1']) {
      const k = c[tipo];
      console.log(`${nombre} | ${tipo} | ${k.n} | ${pct(k.dif, k.n)} (${k.dif}) | ${pct(k.tot, k.n)} (${k.tot}) | ${pct(k.pdfNo, k.n)} (${k.pdfNo}) | ${pct(k.xmlNo, k.n)} (${k.xmlNo}) | ${tipo === 'R1' ? `${k.incoherente}` : '—'}`);
    }
  }
  if (cero !== 0) { console.log(`CIEGO: el papel contra sí mismo da ${cero} diferencias`); process.exit(2); }
  console.log(`CONTROL · cero: el papel contra sí mismo, 0 diferencias en ${nPdf} PDF`);
  console.log(`CONTROL · sembrado: el total desplazado 0,01 se ve en ${sembrado} de ${POBS.length} poblaciones`);
  console.log(`PDF generados: ${nPdf}`);
})().catch((e) => { console.log('CIEGO: el guion se cayó: ' + (e && e.stack || e)); process.exit(2); });

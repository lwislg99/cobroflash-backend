// SCRUM-1446h · ¿EL REPARTO DE 1446g ENTRA EN UNA F1 SIN TRAMOS? SÓLO MEDIR: no toca src/ ni ninguna base.
//
// 1446g (`importesDeLaColumnaSinIva`, pdf.service.ts) decide que una factura es «de tramo» si algún
// precio guardado lleva fracción de céntimo. Su sonda midió el control «sin tramos» con precios de
// dos decimales, así que ese 0 no habla de un precio con tres. Aquí:
//   ① LA PUERTA: ¿llega a `Invoice.lines` un precio con fracción de céntimo sin tramos? Se EJECUTAN
//      `CreateQuoteSchema` (lo que valida la API al crear el presupuesto) y `lineasParaFacturar`
//      (lo que convierte `Quote.lines` en `Invoice.lines`, el `dto` incluido).
//   ② EL PAPEL: la misma F1 sin tramos, con el `dist/` de main y con el de 1446g, con el PDF REAL
//      en memoria leído por el lector de la casa; y la población, con la función de cada `dist/`.
//
// Uso: node medir-sin-tramos.mjs <raíz con dist/ de main> <raíz con dist/ de 1446g>
// Sale 2 (CIEGO) si un PDF no se deja leer, si el dist de 1446g no trae la función, o si el caso
// sembrado no se mueve.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const [RAIZ_MAIN, RAIZ_RAMA] = process.argv.slice(2).map((r) => path.resolve(r));
if (!RAIZ_MAIN || !RAIZ_RAMA) { console.log('uso: <raíz main> <raíz 1446g>'); process.exit(2); }
const cargar = (raiz) => {
  const req = createRequire(path.join(raiz, 'package.json'));
  return {
    pdf: req(path.join(raiz, 'dist/modules/invoicing/infra/pdf/pdf.service.js')),
    lin: req(path.join(raiz, 'dist/modules/invoicing/domain/invoiceLines.service.js')),
    vat: req(path.join(raiz, 'dist/modules/invoicing/domain/vat.service.js')),
    utl: req(path.join(raiz, 'dist/core/utils/utils.js')),
    sch: req(path.join(raiz, 'dist/core/validation/schemas.js')),
  };
};
const MAIN = cargar(RAIZ_MAIN);
const RAMA = cargar(RAIZ_RAMA);
const { lineasDePdf } = await import('file://' + path.join(AQUI, 'tests/_texto-del-pdf.mjs').replace(/\\/g, '/'));
console.log(`main: importesDeLaColumnaSinIva ${typeof MAIN.pdf.importesDeLaColumnaSinIva} · 1446g: ${typeof RAMA.pdf.importesDeLaColumnaSinIva}`);
if (typeof RAMA.pdf.importesDeLaColumnaSinIva !== 'function') { console.log('CIEGO: el dist de 1446g no trae la función'); process.exit(2); }

const aCent = (s) => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100);
const impreso = (v) => aCent(RAMA.utl.formatImporteEs(v));
const suma = (xs) => xs.reduce((a, b) => a + b, 0);
const conFraccion = (lines) => lines.some((l) => { const c = l.price * 100; return Math.abs(c - Math.round(c)) > 1e-6; });
/** La columna de main (F1: cant × precio, SCRUM-1446e) y la de 1446g, en céntimos. */
const colMain = (lines) => lines.map((l) => impreso(l.qty * l.price));
const colRama = (lines) => { const r = RAMA.pdf.importesDeLaColumnaSinIva(lines); return lines.map((l, i) => impreso(r ? r[i] : l.qty * l.price)); };
const base = (lines) => Math.round(RAMA.vat.calcVatBreakdown(lines).base * 100);

// ── ① LA PUERTA ─────────────────────────────────────────────────────────────────────────────
console.log('\n① LA PUERTA (ejecutada)');
const presupuesto = (price, extra = {}) => ({ merchant_id: 1, customer_id: 1, currency: 'EUR', lines: [{ concept: 'X', qty: 1, price, tax: 0.21, ...extra }] });
for (const [p, que] of [[12.5, 'control +: 2 decimales'], [1.005, '3 decimales'], [0.0125, '4 decimales'], [1.00005, 'control −: 5 decimales']]) {
  const r = RAMA.sch.CreateQuoteSchema.safeParse(presupuesto(p));
  console.log(`  CreateQuoteSchema price=${p} (${que}): ${r.success ? 'ACEPTA' : 'RECHAZA · ' + r.error.issues.map((i) => i.message).join(' | ')}`);
}
for (const [dto, que] of [[undefined, 'control: sin dto'], [10, 'dto 10 % (entero, el paso del editor)'], [12.5, 'dto 12,5 % (2 decimales, lo que admite la API)']]) {
  const q = presupuesto(3.33, dto === undefined ? {} : { dto });
  const ok = RAMA.sch.CreateQuoteSchema.safeParse(q).success;
  const [l] = RAMA.lin.lineasParaFacturar({ ...q, discountGlobalAmount: null });
  console.log(`  3,33 € con ${que}: schema ${ok ? 'ACEPTA' : 'RECHAZA'} → Invoice.lines.price = ${l.price} · fracción de céntimo: ${conFraccion([l]) ? 'SÍ' : 'no'}`);
}

// ── ② EL PAPEL: población ───────────────────────────────────────────────────────────────────
let semilla = 14468;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const elige = (xs) => xs[Math.floor(azar() * xs.length)];
const linea = (price, extra = {}) => ({ concept: 'X', qty: elige([1, 1, 2, 3, 5]), price, tax: elige([0.21, 0.10]), ...extra });
const FAMILIAS = {
  'control: 2 decimales, sin dto': () => linea((100 + Math.floor(azar() * 49901)) / 100),
  'dto entero (5-33 %)': () => linea((100 + Math.floor(azar() * 49901)) / 100, { dto: elige([0, 5, 10, 15, 20, 25, 33]) }),
  'precio de 3 decimales (API)': () => linea((1 + Math.floor(azar() * 499999)) / 1000),
};
const POR_N = 4000;
const filas = [];
const muestras = [];
for (const [fam, nueva] of Object.entries(FAMILIAS)) {
  const f = { fam, facturas: 0, conFraccion: 0, hoyNoSuma: 0, cambian: 0, lineasMovidas: 0, despuesNoSuma: 0, movidasQueSumaban: 0, desvioMax: 0 };
  for (const n of [1, 2, 3]) {
    for (let k = 0; k < POR_N; k += 1) {
      const lines = RAMA.lin.lineasParaFacturar({ lines: Array.from({ length: n }, nueva), discountGlobalAmount: null });
      f.facturas += 1;
      if (conFraccion(lines)) f.conFraccion += 1;
      const m = colMain(lines); const r = colRama(lines); const b = base(lines);
      if (suma(m) !== b) f.hoyNoSuma += 1;
      if (suma(r) !== b) f.despuesNoSuma += 1;
      const mov = m.filter((c, i) => c !== r[i]).length;
      if (mov) { f.cambian += 1; f.lineasMovidas += mov; if (suma(m) === b) f.movidasQueSumaban += 1; if (muestras.length < 40) muestras.push(lines); }
      lines.forEach((l, i) => { f.desvioMax = Math.max(f.desvioMax, Math.abs(r[i] - l.qty * l.price * 100)); });
      // La FILA: ¿el importe impreso es cant × precio unitario impreso? (lo que c.20945 aceptó romper en un tramo)
      f.lineas = (f.lineas ?? 0) + lines.length;
      lines.forEach((l, i) => { const fila = Math.round(l.qty * impreso(l.price)); if (m[i] !== fila) f.filaMain = (f.filaMain ?? 0) + 1; if (r[i] !== fila) f.filaRama = (f.filaRama ?? 0) + 1; });
    }
  }
  filas.push(f);
}
console.log(`\n② POBLACIÓN (inventada, semilla 14468): ${POR_N} facturas × 1, 2 y 3 líneas por familia; cant. 1-5; 21 % y 10 %`);
console.log('familia | facturas | con fracción | hoy (main) no suma la base | 1446g cambia la columna | líneas movidas | movidas que hoy ya sumaban | con 1446g no suma | desvío máx. (cént.) | líneas | fila importe ≠ cant×precio: main · 1446g');
for (const f of filas) console.log(`${f.fam} | ${f.facturas} | ${f.conFraccion} | ${f.hoyNoSuma} | ${f.cambian} | ${f.lineasMovidas} | ${f.movidasQueSumaban} | ${f.despuesNoSuma} | ${f.desvioMax.toFixed(2)} | ${f.lineas} | ${f.filaMain ?? 0} · ${f.filaRama ?? 0}`);

// ── ② EL PAPEL: el PDF real, con cada dist ──────────────────────────────────────────────────
// Caso SEMBRADO (no tomado del árbol): 3,33 × 1 con dto 10 % + 3,33 × 1 con dto 10 %, al 21 %.
const sembrado = RAMA.lin.lineasParaFacturar({ lines: [{ concept: 'X', qty: 1, price: 3.33, tax: 0.21, dto: 10 }, { concept: 'X', qty: 1, price: 3.33, tax: 0.21, dto: 10 }], discountGlobalAmount: null });
const IMPORTE = '-?[\\d.]+,\\d{2}';
async function papel(mod, lines, j) {
  const { outPath } = await mod.pdf.generateInvoicePdf({
    number: `F-2026-QA1446H-${j}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA 1446h', legalName: 'QA 1446h SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total: RAMA.lin.grossOfLines(lines).toFixed(2), qrData: 'x',
    type: 'F1', lines: lines.map((l, i) => ({ ...l, concept: `L${i + 1}Z` })), zona: null,
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    if (!r.ok) { console.log(`CIEGO: no supe leer el PDF ${j}: ${r.motivo}`); process.exit(2); }
    const t = r.lineas.map((l) => l.texto);
    const col = t.map((s) => s.match(new RegExp(`^L\\d+Z.*,\\d{2}(?:[\\d,]+%|—)(${IMPORTE})$`))).filter(Boolean).map((x) => aCent(x[1]));
    const fila = t.filter((s) => /^L\d+Z/.test(s));
    const pie = t.filter((s) => /^(Base imponible|IVA|TOTAL)/i.test(s));
    if (col.length !== lines.length) { console.log(`CIEGO: el PDF ${j} no tiene ${lines.length} líneas`); process.exit(2); }
    return { col, fila, pie };
  } finally { fs.rmSync(outPath, { force: true }); }
}
const pm = await papel(MAIN, sembrado, 's-main');
const pr = await papel(RAMA, sembrado, 's-rama');
console.log(`\n② CASO SEMBRADO (2 × [3,33 con dto 10 %] al 21 %; Invoice.lines.price = ${sembrado[0].price}) · base ${base(sembrado)} cént.`);
console.log('  main  :', pm.fila.join(' ‖ '), '‖ pie:', pm.pie.join(' · '));
console.log('  1446g :', pr.fila.join(' ‖ '), '‖ pie:', pr.pie.join(' · '));
if (JSON.stringify(pm.col) === JSON.stringify(pr.col)) { console.log('CIEGO: el caso sembrado no se mueve'); process.exit(2); }

let calibrados = 0; let distintos = 0; let pieDistinto = 0;
for (const [j, lines] of muestras.entries()) {
  const a = await papel(MAIN, lines, `m${j}`); const b = await papel(RAMA, lines, `r${j}`);
  calibrados += 1;
  if (JSON.stringify(a.col) !== JSON.stringify(colMain(lines)) || JSON.stringify(b.col) !== JSON.stringify(colRama(lines))) distintos += 1;
  if (JSON.stringify(a.pie) !== JSON.stringify(b.pie)) pieDistinto += 1;
}
console.log(`\ncalibración: ${calibrados} facturas que 1446g cambia × 2 dist = ${calibrados * 2} PDF reales · columna distinta de la copia: ${distintos} · pie (base, IVA, TOTAL) distinto entre main y 1446g: ${pieDistinto}`);

// docs/master/evidencias/SCRUM-1446g/medir-tramos.mjs — SCRUM-1446g
//
// ¿Suma la columna sin IVA de una F1 por tramos la «Base imponible» del pie? Se corre ANTES y
// DESPUÉS del cambio con el mismo `dist/` que imprime el PDF:
//
//   node docs/master/evidencias/SCRUM-1446g/medir-tramos.mjs
//
// Lo que imprime la columna se toma de `importesDeLaColumnaSinIva` (exportada por el PDF desde
// 1446g) o, si no existe todavía (la base), de `cant × precio` tal cual, que es lo que la columna
// imprimía. La base, de `calcVatBreakdown`, la misma que imprime el pie. Y no se cree a sí misma:
// CALIBRA contra PDF reales generados con `generateInvoicePdf` y leídos con el lector de la casa.
//
// Población: la forma de la de jv-j1co (SCRUM-1446 c.20944): precios de 1,00 a 500,00, cantidad 1,
// un tipo, 2 y 3 líneas, 21 % y 10 %, planes 50/50, 30/70 y 30/40/30 → 56.000 tramos. Es la MISMA
// FORMA, no la misma población: su sonda no está en el repo. Precios con un LCG de semilla fija.
//
// Salida 0 = medido · 2 = CIEGO (calibración que no casa, controles que no se cumplen).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(RAIZ, 'package.json'));
const pdf = require(path.join(RAIZ, 'dist/modules/invoicing/infra/pdf/pdf.service.js'));
const { stageLinesReconciled, grossOfLines } = require(path.join(RAIZ, 'dist/modules/invoicing/domain/invoiceLines.service.js'));
const { distributeStageAmounts } = require(path.join(RAIZ, 'dist/modules/quotes/domain/billingPlan.js'));
const { calcTotal, formatImporteEs } = require(path.join(RAIZ, 'dist/core/utils/utils.js'));
const { calcVatBreakdown } = require(path.join(RAIZ, 'dist/modules/invoicing/domain/vat.service.js'));
const { lineasDePdf } = await import('file://' + path.join(RAIZ, 'tests/_texto-del-pdf.mjs').replace(/\\/g, '/'));

const conReparto = typeof pdf.importesDeLaColumnaSinIva === 'function';
const aCent = (s) => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100);
const impreso = (v) => aCent(formatImporteEs(v));
const suma = (xs) => xs.reduce((a, b) => a + b, 0);
/** Lo que imprime la columna de cada línea, en céntimos. */
function columna(lines) {
  const r = conReparto ? pdf.importesDeLaColumnaSinIva(lines) : null;
  return lines.map((l, i) => impreso(r ? r[i] : l.qty * l.price));
}
const base = (lines) => Math.round(calcVatBreakdown(lines).base * 100);

let semilla = 1446;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const precio = () => (100 + Math.floor(azar() * 49901)) / 100; // 1,00 … 500,00

const PLANES = {
  '50/50': [0.5, 0.5],
  '30/70': [0.3, 0.7],
  '30/40/30': [0.3, 0.4, 0.3],
};
const POR_COMBINACION = 2000; // × 2 tipos × 2 nº de líneas = 8.000 facturas por plan

const tramos = []; // { plan, lines }
const enteras = []; // el control a cero: las mismas facturas sin tramos
for (const [nombre, pcts] of Object.entries(PLANES)) {
  const plan = pcts.map((percentage, index) => ({ index, percentage, label: '' }));
  for (const tax of [0.21, 0.10]) {
    for (const n of [2, 3]) {
      for (let k = 0; k < POR_COMBINACION; k += 1) {
        const lines = Array.from({ length: n }, () => ({ qty: 1, price: precio(), tax }));
        enteras.push(lines);
        const objetivos = distributeStageAmounts(calcTotal(lines), plan);
        plan.forEach((_, i) => tramos.push({ plan: nombre, lines: stageLinesReconciled(lines, plan, i, objetivos[i]) }));
      }
    }
  }
}

// ── Calibración: 80 tramos repartidos por los tres planes, con su PDF de verdad ──────────────
const IMPORTE = '-?[\\d.]+,\\d{2}';
let calibrados = 0;
let distintos = 0;
for (let j = 0; j < 80; j += 1) {
  const t = tramos[Math.floor((j * tramos.length) / 80)];
  const { outPath } = await pdf.generateInvoicePdf({
    number: `F-2026-QA1446G-${j}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA 1446g', legalName: 'QA 1446g SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total: grossOfLines(t.lines).toFixed(2), qrData: 'x',
    type: 'F1', lines: t.lines.map((l, i) => ({ concept: `L${i + 1}Z`, ...l })), zona: null,
  });
  let textos;
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    if (!r.ok) { console.log(`CIEGO: no supe leer el PDF ${j}: ${r.motivo}`); process.exit(2); }
    textos = r.lineas.map((l) => l.texto);
  } finally { fs.rmSync(outPath, { force: true }); }
  const papel = textos.map((s) => s.match(new RegExp(`^L\\d+Z.*,\\d{2}(?:[\\d,]+%|—)(${IMPORTE})$`))).filter(Boolean).map((m) => aCent(m[1]));
  const pie = textos.map((s) => s.match(new RegExp(`^Base imponible:(${IMPORTE}) EUR$`))).filter(Boolean).map((m) => aCent(m[1]));
  if (papel.length !== t.lines.length || pie.length !== 1) { console.log(`CIEGO: el PDF ${j} no tiene ${t.lines.length} líneas y una base`); process.exit(2); }
  calibrados += 1;
  if (JSON.stringify(papel) !== JSON.stringify(columna(t.lines)) || pie[0] !== base(t.lines)) distintos += 1;
}

// ── La medición ──────────────────────────────────────────────────────────────────────────────
const filas = {};
let movidasQueHoySumaban = 0;
let desvioMax = 0; // |impreso − exacto| en céntimos
for (const t of tramos) {
  const f = (filas[t.plan] ??= { tramos: 0, hoyNoSuma: 0, noSuma: 0, cambiados: 0 });
  const hoy = t.lines.map((l) => impreso(l.qty * l.price));
  const col = columna(t.lines);
  const b = base(t.lines);
  f.tramos += 1;
  if (suma(hoy) !== b) f.hoyNoSuma += 1;
  if (suma(col) !== b) f.noSuma += 1;
  const cambia = col.some((c, i) => c !== hoy[i]);
  if (cambia) f.cambiados += 1;
  if (cambia && suma(hoy) === b) movidasQueHoySumaban += 1;
  t.lines.forEach((l, i) => { desvioMax = Math.max(desvioMax, Math.abs(col[i] - l.qty * l.price * 100)); });
}
const ceroEnteras = enteras.filter((ls) => suma(columna(ls)) !== base(ls)).length;
const cambiadasEnteras = enteras.filter((ls) => columna(ls).some((c, i) => c !== impreso(ls[i].qty * ls[i].price))).length;

// Control positivo: el tramo de 1446e ⑤ (2,11 + 3,33 al 21 %, segundo tramo al 50 %) hoy no suma.
const plan50 = [{ index: 0, percentage: 0.5, label: '' }, { index: 1, percentage: 0.5, label: '' }];
const deTramo = [{ qty: 1, price: 2.11, tax: 0.21 }, { qty: 1, price: 3.33, tax: 0.21 }];
const quinto = stageLinesReconciled(deTramo, plan50, 1, distributeStageAmounts(calcTotal(deTramo), plan50)[1]);
const quintoHoy = quinto.map((l) => impreso(l.qty * l.price));

console.log(`dist con reparto (importesDeLaColumnaSinIva): ${conReparto ? 'SÍ' : 'NO (la base)'}`);
console.log(`calibración: ${calibrados} PDF reales · ${distintos} distintos de esta aritmética`);
console.log(`población: ${tramos.length} tramos de ${enteras.length} facturas`);
for (const [p, f] of Object.entries(filas)) {
  const pc = (x) => ((100 * x) / f.tramos).toFixed(1).replace('.', ',');
  console.log(`  ${p.padEnd(8)} ${String(f.tramos).padStart(6)} tramos · hoy no suma ${f.hoyNoSuma} (${pc(f.hoyNoSuma)} %) · con esta columna no suma ${f.noSuma} · líneas movidas en ${f.cambiados}`);
}
console.log(`tramos que hoy suman y esta columna mueve: ${movidasQueHoySumaban}`);
console.log(`desvío máximo de una línea frente a su importe exacto: ${desvioMax.toFixed(3).replace('.', ',')} céntimos`);
console.log(`control a cero: las ${enteras.length} facturas SIN tramos · no suman ${ceroEnteras} · cambia alguna línea en ${cambiadasEnteras}`);
console.log(`control positivo (1446e ⑤): hoy ${quintoHoy.join(' + ')} = ${suma(quintoHoy)} sobre base ${base(quinto)} · esta columna ${columna(quinto).join(' + ')}`);

const hoyNoSumaTotal = Object.values(filas).reduce((a, f) => a + f.hoyNoSuma, 0);
if (distintos !== 0 || calibrados !== 80) { console.log('CIEGO: la aritmética no es lo que imprime el PDF'); process.exit(2); }
if (ceroEnteras !== 0 || cambiadasEnteras !== 0) { console.log('CIEGO: el control a cero no da cero'); process.exit(2); }
if (suma(quintoHoy) === base(quinto) || hoyNoSumaTotal === 0) { console.log('CIEGO: el control positivo no aparece'); process.exit(2); }
console.log('EXIT=0');

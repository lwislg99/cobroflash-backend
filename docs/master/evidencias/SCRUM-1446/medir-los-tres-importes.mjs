// SÓLO LEE Y EJECUTA. Los tres defectos de importes del PDF (SCRUM-1446, 1447 y 1448), medidos juntos.
//
//   node docs/master/evidencias/SCRUM-1446/medir-los-tres-importes.mjs <raíz del árbol, con dist/>
//   node docs/master/evidencias/SCRUM-1446/medir-los-tres-importes.mjs <raíz> --filas <fichero.json>
//
// Sin `--filas` genera los PDF DE VERDAD (`generateInvoicePdf` y `generateQuotePdf` de dist/), lee el
// papel con `tests/_texto-del-pdf.mjs` y cuenta. Con `--filas` clasifica facturas REALES: un JSON
// `[{ id, number, type, total, lines }]` sacado de una base por quien tenga permiso (ver el registro).
//
// No toca `src/`. No abre ninguna base. Los PDF se escriben en una carpeta temporal del sistema, no
// en el árbol: `invoicesDir` se resuelve contra el directorio del proceso, y por eso se cambia ANTES
// de cargar dist/.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const R = path.resolve(process.argv[2] || '.');
const iFilas = process.argv.indexOf('--filas');
const FICHERO_FILAS = iFilas > 0 ? path.resolve(process.argv[iFilas + 1]) : null;
if (!fs.existsSync(path.join(R, 'dist/lib/pdf.js'))) {
  console.log(`CIEGO: no hay dist/ en ${R}. Compila antes.`);
  console.log('EXIT=2');
  process.exit(2);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1446-'));
process.chdir(TMP);

const require = createRequire(path.join(R, 'x.js'));
const { generateInvoicePdf, generateQuotePdf } = require(path.join(R, 'dist/lib/pdf.js'));
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const vat = require(path.join(R, 'dist/modules/invoicing/domain/vat.service.js'));
const il = require(path.join(R, 'dist/modules/invoicing/domain/invoiceLines.service.js'));
const fi = require(path.join(R, 'dist/core/validation/fiscalInput.js'));
const te = require(path.join(R, 'dist/core/validation/tiposIvaEmitibles.js'));
const rb = require(path.join(R, 'dist/modules/fiscal/verifactu/registro.builder.js'));
const bp = require(path.join(R, 'dist/modules/quotes/domain/billingPlan.js'));
const { lineasDePdf } = await import(pathToFileURL(path.join(R, 'tests/_texto-del-pdf.mjs')).href);

const out = (...a) => console.log(...a);
const IMPORTE = '-?[\\d.]+,\\d{2}';
/** «1.234,56» → 123456 céntimos. */
const aCent = (s) => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100);
/** Lo que el formateador REAL escribe, vuelto a céntimos. */
const cent = (n) => aCent(u.formatImporteEs(n));
const eur = (c) => (c / 100).toFixed(2).replace('.', ',');
const conNombre = (lines) => lines.map((l, i) => ({ concept: `L${i + 1}Z`, ...l }));

let nPdf = 0;
async function leer(outPath) {
  const r = lineasDePdf(fs.readFileSync(outPath));
  fs.rmSync(outPath, { force: true });
  if (!r.ok) throw new Error(`CIEGO: no supe leer el PDF: ${r.motivo}`);
  nPdf += 1;
  return r.lineas.map((l) => l.texto);
}
function filasDe(textos) {
  const filas = [];
  for (const t of textos) {
    const m = t.match(new RegExp(`^(L\\d+Z).*,\\d{2}(\\d+%|—)(${IMPORTE})$`));
    if (m) filas.push({ linea: m[1], rotulo: m[2], total: aCent(m[3]) });
  }
  return filas;
}

/** El PAPEL de una factura: lo que imprime, leído del PDF generado. */
async function papelFactura(lines, total, extra = {}) {
  const { outPath } = await generateInvoicePdf({
    number: `F-QA1446-${nPdf}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total: String(total), qrData: 'x', type: 'F1',
    lines: conNombre(lines), ...extra,
  });
  const textos = await leer(outPath);
  const filas = filasDe(textos);
  const desglose = [];
  let totalImpreso = null; let base = null; let desdeElGuardado = false;
  for (const t of textos) {
    let m = t.match(new RegExp(`^TOTAL:(${IMPORTE}) EUR$`));
    if (m) totalImpreso = aCent(m[1]);
    m = t.match(new RegExp(`^Total: (${IMPORTE}) EUR$`));
    if (m) { totalImpreso = aCent(m[1]); desdeElGuardado = true; }
    m = t.match(new RegExp(`^Base imponible:(${IMPORTE}) EUR$`));
    if (m) base = aCent(m[1]);
    m = t.match(new RegExp(`^(?:\\d+%(${IMPORTE}) EUR)?IVA (\\d+%):(${IMPORTE}) EUR$`));
    if (m) desglose.push({ rotulo: m[2], base: m[1] ? aCent(m[1]) : null, cuota: aCent(m[3]) });
  }
  if (totalImpreso === null) throw new Error('CIEGO: no encuentro el TOTAL en el papel de la factura');
  return { filas, desglose, base, total: totalImpreso, desdeElGuardado, textos };
}

/** El PAPEL de un presupuesto. */
async function papelPresupuesto(lines, total, extra = {}) {
  const { outPath } = await generateQuotePdf({
    quoteId: 990000 + nPdf, quoteNumber: 1, merchant: { name: 'QA' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: String(total), lines: conNombre(lines), country: 'ES', ...extra,
  });
  const textos = await leer(outPath);
  const filas = filasDe(textos);
  const desglose = []; let totalImpreso = null; let base = null;
  for (const t of textos) {
    let m = t.match(new RegExp(`^Total presupuesto: (${IMPORTE}) EUR$`));
    if (m) totalImpreso = aCent(m[1]);
    m = t.match(new RegExp(`^Base imponible: (${IMPORTE}) EUR$`));
    if (m) base = aCent(m[1]);
    m = t.match(new RegExp(`^IVA (\\d+%): (${IMPORTE}) EUR$`));
    if (m) desglose.push({ rotulo: m[1], cuota: aCent(m[2]) });
  }
  if (totalImpreso === null) throw new Error('CIEGO: no encuentro el Total en el papel del presupuesto');
  return { filas, desglose, base, total: totalImpreso, textos };
}

/**
 * La ARITMÉTICA del PDF de factura, copiada (bucle de filas y bloque de totales de `pdf.service.ts`),
 * con el formateador y la cantidad reales. Sirve para CONTAR sobre poblaciones grandes; antes de
 * fiarse de ella se CALIBRA contra el PDF generado (sección 0). Si no coincide, la sonda aborta.
 */
function copia(lines) {
  let suma = 0; let subtotal = 0; const mapa = {}; const rotulos = [];
  for (const l of lines) {
    const q = vat.cantidadDeLinea(l.qty); const p = Number(l.price) || 0; const t = Number(l.tax) || 0;
    suma += cent(q * p * (1 + t));
    rotulos.push(t > 0 ? `${(t * 100).toFixed(0)}%` : '—');
    const b = q * p; subtotal += b;
    const k = `${(t * 100).toFixed(0)}%`;
    if (!mapa[k]) mapa[k] = { base: 0, vat: 0 };
    mapa[k].base += b; mapa[k].vat += b * t;
  }
  const totalVat = Object.values(mapa).reduce((a, g) => a + g.vat, 0);
  return { suma, total: cent(subtotal + totalVat), rotulos, claves: Object.keys(mapa) };
}
const guardadoFactura = (lines) => Math.round(il.grossOfLines(lines) * 100);
const L = (price, tax, qty = 1) => ({ qty, price, tax });

const ADMITIDOS = [...fi.TIPOS_IVA_ES_BP].map((b) => b / 10000).sort((a, b) => a - b);
const pct = (f) => `${String(Math.round(f * 10000) / 100).replace('.', ',')} %`;

// ════════════════════════════════════════════════════════════════════════════════════════════
if (FICHERO_FILAS) { await clasificarFilas(); out('EXIT=0'); process.exit(0); }

out(`POBLACION: árbol «${path.basename(R)}», con su dist/`);
out(`tipos admitidos por invalidTipoIva (leídos de TIPOS_IVA_ES_BP): ${ADMITIDOS.map(pct).join(' · ')}  [${ADMITIDOS.length}]`);

// ── 0 · CALIBRADO: la copia de la aritmética contra el PDF de verdad ─────────────────────────
out('\n══ 0 · CALIBRADO de la copia contra el PDF generado');
{
  let s = 1446; const azar = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const casos = [];
  for (let i = 0; i < 60; i++) {
    const k = 1 + Math.floor(azar() * 5);
    casos.push(Array.from({ length: k }, () => L(Math.round(1 + azar() * 49999) / 100, ADMITIDOS[Math.floor(azar() * ADMITIDOS.length)], 1 + Math.floor(azar() * 3))));
  }
  let distintos = 0;
  for (const c of casos) {
    const p = await papelFactura(c, '0.00'); const k = copia(c);
    const sumaPapel = p.filas.reduce((a, f) => a + f.total, 0);
    if (p.filas.length !== c.length || sumaPapel !== k.suma || p.total !== k.total
      || p.filas.map((f) => f.rotulo).join() !== k.rotulos.join()) distintos += 1;
  }
  out(`facturas generadas y leídas: ${casos.length} · la copia difiere del papel en: ${distintos}`);
  // control: una copia mal hecha tiene que diferir (se rompe a propósito sumando 1 céntimo)
  const c0 = casos[0]; const p0 = await papelFactura(c0, '0.00');
  out(`control (copia rota a propósito, +1 cént.): ${copia(c0).total + 1 !== p0.total ? 'difiere' : 'NO DIFIERE'}`);
  if (distintos !== 0) { out('CIEGO: la copia no reproduce el papel; los recuentos de abajo no valdrían.'); out('EXIT=3'); process.exit(3); }
}

// ── ① SCRUM-1446 · las líneas no suman el TOTAL a la vista ───────────────────────────────────
out('\n══ ① SCRUM-1446 · la columna TOTAL de las líneas no suma el TOTAL impreso');
out('— el PAPEL, generado (dos líneas iguales, cantidad 1):');
out('documento    | caso              | líneas impresas | suma a la vista | TOTAL impreso | diferencia');
for (const [nombre, c] of [
  ['2 × 0,50 al 21 %', [L(0.5, 0.21), L(0.5, 0.21)]],
  ['2 × 2,50 al 21 %', [L(2.5, 0.21), L(2.5, 0.21)]],
  ['2 × 12,50 al 21 %', [L(12.5, 0.21), L(12.5, 0.21)]],
  ['2 × 0,15 al 10 %', [L(0.15, 0.10), L(0.15, 0.10)]],
  ['2 × 7,25 al 21 %', [L(7.25, 0.21), L(7.25, 0.21)]],
  ['CONTROL 2 × 100 al 21 %', [L(100, 0.21), L(100, 0.21)]],
]) {
  const f = await papelFactura(c, il.grossOfLines(c).toFixed(2));
  const q = await papelPresupuesto(c, u.calcTotal(c).toFixed(2));
  for (const [doc, p] of [['factura', f], ['presupuesto', q]]) {
    const suma = p.filas.reduce((a, x) => a + x.total, 0);
    out(`${doc.padEnd(12)} | ${nombre.padEnd(23)} | ${p.filas.map((x) => eur(x.total)).join(' + ').padEnd(15)} | ${eur(suma).padStart(15)} | ${eur(p.total).padStart(13)} | ${suma - p.total} cént.`);
  }
}
out('— CUÁNTOS, por enumeración COMPLETA (copia calibrada): todos los pares de precios de 0,01 a 10,00 €, 2 líneas, cantidad 1');
out('tipo     | pares    | la columna no suma el TOTAL | máx. | TOTAL impreso ≠ guardado (③) | máx.');
const MAXP = 1000;
for (const t of ADMITIDOS) {
  const linea = []; for (let c = 1; c <= MAXP; c++) linea[c] = cent((c / 100) * (1 + t));
  let n = 0; let a = 0; let ma = 0; let b = 0; let mb = 0;
  for (let i = 1; i <= MAXP; i++) for (let j = i; j <= MAXP; j++) {
    n += 1;
    const base = i / 100 + j / 100;
    const total = cent(base + ((i / 100) * t + (j / 100) * t));
    const da = Math.abs(linea[i] + linea[j] - total);
    if (da) { a += 1; ma = Math.max(ma, da); }
    const g = Math.round((Math.round(base * 100) / 100 + Math.round(((i / 100) * t + (j / 100) * t) * 100) / 100) * 100);
    const db = Math.abs(total - g);
    if (db) { b += 1; mb = Math.max(mb, db); }
  }
  out(`${pct(t).padEnd(8)} | ${String(n).padStart(8)} | ${String(a).padStart(8)} (${(100 * a / n).toFixed(1)} %)`.padEnd(48) + `| ${ma}    | ${String(b).padStart(8)} (${(100 * b / n).toFixed(2)} %)`.padEnd(31) + `| ${mb}`);
}
out('  (el 0 % es el CONTROL A CERO: sin impuesto no hay redondeo que repartir)');

// ── ② SCRUM-1447 · el rótulo del tipo ────────────────────────────────────────────────────────
out('\n══ ② SCRUM-1447 · el tipo se redondea a entero');
out('— ¿qué tipos deja pasar el servidor? (ejecutado: invalidTipoIva y el portón tipoIvaNoEmitible)');
for (const t of [...ADMITIDOS, 0.095, 0.03, 0.07, 0.15, 0.20, 0.065, 0.052, 0.005, 0.105, 0.014]) {
  out(`  ${pct(t).padEnd(7)} validador: ${fi.invalidTipoIva(t) === null ? 'ADMITIDO ' : 'rechazado'} · portón de emisión: ${te.tipoIvaNoEmitible([{ tax: t }]) === null ? 'pasa' : 'no pasa'}`);
}
out('— el PAPEL y el REGISTRO, tipo a tipo (una línea de 100,00 €, generado y leído):');
out('tipo real | factura: fila · pie y cuota      | presupuesto: fila · pie y cuota · Total  | calcVatBreakdown.rate | registro VeriFactu (TipoImpositivo · Cuota)');
let falsos = { facturaFila: 0, facturaPie: 0, presuFila: 0, presuPie: 0, presuCuota: 0, desglose: 0, registro: 0 };
for (const t of ADMITIDOS) {
  const c = [L(100, t)];
  const real = `${String(Math.round(t * 10000) / 100)}%`;
  const f = await papelFactura(c, il.grossOfLines(c).toFixed(2));
  const q = await papelPresupuesto(c, u.calcTotal(c).toFixed(2));
  const bd = vat.calcVatBreakdown(c);
  let reg = '(0 %: no clasificable, lanza)';
  try { const d = rb.clasificarDetalleDesglose(bd.entries[0], 'QA'); reg = `${d.tipoImpositivo} · ${d.cuotaRepercutida}`; if (t > 0 && d.tipoImpositivo !== real.replace('%', '')) falsos.registro += 1; } catch { /* 0 % */ }
  const fp = f.desglose[0]; const qp = q.desglose[0];
  if (t > 0) {
    if (f.filas[0].rotulo !== real) falsos.facturaFila += 1;
    if (fp && fp.rotulo !== real) falsos.facturaPie += 1;
    if (q.filas[0].rotulo !== real) falsos.presuFila += 1;
    if (qp && qp.rotulo !== real) falsos.presuPie += 1;
    if (qp && qp.cuota !== Math.round(100 * t * 100)) falsos.presuCuota += 1;
    if (`${bd.entries[0].rate}%` !== real) falsos.desglose += 1;
  }
  out(`${pct(t).padEnd(9)} | ${f.filas[0].rotulo.padEnd(4)} · ${fp ? `IVA ${fp.rotulo}: ${eur(fp.cuota)}` : '(sin fila)'}`.padEnd(45)
    + `| ${q.filas[0].rotulo.padEnd(4)} · ${qp ? `IVA ${qp.rotulo}: ${eur(qp.cuota)}` : '(sin fila)'} · ${eur(q.total)}`.padEnd(42)
    + `| ${String(bd.entries[0].rate).padEnd(21)} | ${reg}`);
}
out(`RECUENTO sobre los ${ADMITIDOS.length - 1} tipos admitidos mayores que 0: rótulo falso en la fila de la factura ${falsos.facturaFila} · en el pie de la factura ${falsos.facturaPie} · en la fila del presupuesto ${falsos.presuFila} · en el pie del presupuesto ${falsos.presuPie} · CUOTA del pie del presupuesto calculada con otro tipo ${falsos.presuCuota} · calcVatBreakdown.rate ${falsos.desglose} · TipoImpositivo del registro ${falsos.registro}`);
{
  const c = [L(100, 0.075)];
  const xml = rb.buildDetallesDesgloseXml(vat.calcVatBreakdown(c).entries.map((e) => rb.clasificarDetalleDesglose(e, 'QA')));
  out('— el bloque que construye el registro para 100,00 € al 7,5 % (clasificarDetalleDesglose + buildDetallesDesgloseXml, ejecutados):');
  out(xml.split('\n').filter((x) => x.trim()).map((x) => '    ' + x.trim()).join('\n'));
  const c10 = [L(100, 0.10)];
  const d10 = rb.clasificarDetalleDesglose(vat.calcVatBreakdown(c10).entries[0], 'QA');
  out(`  control (10 %): TipoImpositivo ${d10.tipoImpositivo} · Cuota ${d10.cuotaRepercutida} → 100,00 × 10 % = 10,00, cuadra`);
}
out('— dos tipos en UNA fila: los pares de tipos admitidos');
{
  let pares = 0; let fundidosPdf = 0; let fundidosDesglose = 0;
  for (let i = 0; i < ADMITIDOS.length; i++) for (let j = i + 1; j < ADMITIDOS.length; j++) {
    pares += 1; const c = [L(100, ADMITIDOS[i]), L(100, ADMITIDOS[j])];
    if (copia(c).claves.length < 2) fundidosPdf += 1;
    if (vat.calcVatBreakdown(c).entries.length < 2) fundidosDesglose += 1;
  }
  out(`  pares: ${pares} · fundidos en el PDF: ${fundidosPdf} · fundidos en calcVatBreakdown: ${fundidosDesglose}`);
  const forzado = [L(100, 0.095), L(100, 0.10)];
  const p = await papelFactura(forzado, '0.00');
  out(`  control (9,5 % + 10 %, que el portón RECHAZA, metidos directamente en el generador): filas de desglose en el papel ${p.desglose.length} → ${p.desglose.map((d) => `IVA ${d.rotulo}: ${eur(d.cuota)}`).join(' | ')} · calcVatBreakdown: ${vat.calcVatBreakdown(forzado).entries.length} tramo(s)`);
}
out('— DONDE EL TIPO REDONDEADO NO SÓLO SE IMPRIME: SE USA PARA CALCULAR (7,5 % contra el control al 10 %)');
for (const t of [0.075, 0.10]) {
  const c = [L(100, t)];
  const q = await papelPresupuesto(c, u.calcTotal(c).toFixed(2));
  const qp = q.desglose[0];
  out(`  ${pct(t)} · presupuesto de 100,00: Base ${eur(q.base)} + IVA ${qp.rotulo} ${eur(qp.cuota)} = ${eur(q.base + qp.cuota)} · Total impreso ${eur(q.total)} · diferencia ${q.base + qp.cuota - q.total} cént.`);
  const conGlobal = u.calcTotal(c, 10);
  const esperado = Math.round((100 - 10) * (1 + t) * 100);
  out(`  ${pct(t)} · el mismo con 10,00 € de descuento global: calcTotal (lo que se FIRMA) ${eur(Math.round(conGlobal * 100))} · (100 − 10) × (1 + tipo) = ${eur(esperado)} · diferencia ${Math.round(conGlobal * 100) - esperado} cént.`);
  const paraFacturar = il.lineasParaFacturar({ lines: c, discountGlobalAmount: 10 });
  const neg = paraFacturar[0];
  out(`  ${pct(t)} · y al facturarlo: la línea «${neg.concept}» sale con tax ${neg.tax} · portón de emisión: ${te.tipoIvaNoEmitible(paraFacturar) ?? 'pasa'}`);
}

// ── ③ SCRUM-1448 · dos fuentes para «el total» ───────────────────────────────────────────────
out('\n══ ③ SCRUM-1448 · el TOTAL impreso (recalculado) contra el guardado (grossOfLines → Invoice.total)');
out('— el PAPEL, generado: se le pasa el guardado y se lee lo que imprime');
out('caso                                         | guardado | TOTAL impreso | diferencia');
const casos3 = [
  ['CONTROL 1 × 100 al 21 %', [L(100, 0.21)]],
  ['1 × 0,05 al 10 % + 1 × 0,05 al 21 %', [L(0.05, 0.10), L(0.05, 0.21)]],
  ['3 × 9,99 al 21 % (el de SCRUM-624)', [L(9.99, 0.21), L(9.99, 0.21), L(9.99, 0.21)]],
];
// el caso más pequeño de un solo tipo, y el más pequeño con dos, buscados y no supuestos
function menor(tipos) {
  for (let s = 2; s <= 400; s++) for (let i = 1; i < s; i++) {
    const c = [L(i / 100, tipos[0]), L((s - i) / 100, tipos[1 % tipos.length])];
    if (copia(c).total !== guardadoFactura(c)) return c;
  }
  return null;
}
for (const tipos of [[0.21], [0.10], [0.21, 0.10], [0.21, 0.04]]) {
  const c = menor(tipos);
  if (c) casos3.push([`el menor hallado · ${c.map((l) => `${eur(Math.round(l.price * 100))} al ${pct(l.tax)}`).join(' + ')}`, c]);
  else casos3.push([`(ninguno con 2 líneas ≤ 4,00 € en ${tipos.map(pct).join('+')})`, null]);
}
for (const [nombre, c] of casos3) {
  if (!c) { out(nombre); continue; }
  const g = guardadoFactura(c);
  const p = await papelFactura(c, (g / 100).toFixed(2));
  out(`${nombre.padEnd(44)} | ${eur(g).padStart(8)} | ${eur(p.total).padStart(13)} | ${p.total - g} cént.`);
}

out('— CUÁNTOS, por CLASE de factura, con las líneas que construyen las funciones REALES de dist/ (copia calibrada)');
out('clase                                                         | facturas | TOTAL impreso ≠ guardado | máx. | ejemplo');
async function clase(nombre, generador) {
  let n = 0; let d = 0; let m = 0; let ej = null;
  for (const c of generador()) {
    if (!c || c.length === 0) continue;
    n += 1; const k = copia(c).total; const g = guardadoFactura(c);
    if (k !== g) { d += 1; m = Math.max(m, Math.abs(k - g)); if (!ej) ej = c; }
  }
  let ejemplo = '—';
  if (ej) {
    const g = guardadoFactura(ej); const p = await papelFactura(ej, (g / 100).toFixed(2));
    ejemplo = `PDF generado: guardado ${eur(g)} · impreso ${eur(p.total)} · ${ej.map((l) => `${l.qty}×${l.price}@${l.tax}`).join(' ; ').slice(0, 70)}`;
  }
  out(`${nombre.padEnd(61)} | ${String(n).padStart(8)} | ${String(d).padStart(8)} (${n ? (100 * d / n).toFixed(2) : '0.00'} %)`.padEnd(101) + `| ${m}    | ${ejemplo}`);
}
const PRECIOS = []; for (let c = 100; c <= 50000; c += 37) PRECIOS.push(c / 100);
await clase('CONTROL A CERO · 1 línea, euros enteros, 21 %', function* () { for (let e = 1; e <= 1349; e++) yield [L(e, 0.21)]; });
await clase('1 línea, precio de 2 decimales, 21 %', function* () { for (const p of PRECIOS) yield [L(p, 0.21)]; });
await clase('2 líneas, 21 % + 10 %', function* () { for (let i = 0; i + 1 < PRECIOS.length; i++) yield [L(PRECIOS[i], 0.21), L(PRECIOS[PRECIOS.length - 1 - i], 0.10)]; });
for (const [rotulo, plan] of [['30/70', [0.3, 0.7]], ['50/50', [0.5, 0.5]], ['30/40/30', [0.3, 0.4, 0.3]]]) {
  await clase(`TRAMOS ${rotulo} · 1 línea al 21 % (stageLinesReconciled)`, function* () {
    const etapas = plan.map((percentage, index) => ({ index, percentage, label: '' }));
    for (const p of PRECIOS) {
      const lineas = [L(p, 0.21)];
      const objetivos = bp.distributeStageAmounts(u.calcTotal(lineas), etapas);
      for (let i = 0; i < plan.length; i++) yield il.stageLinesReconciled(lineas, etapas, i, objetivos[i]);
    }
  });
}
for (const dto of [5, 10, 15, 33]) {
  await clase(`DESCUENTO DE LÍNEA ${dto} % · 1 línea al 21 % (lineasParaFacturar)`, function* () {
    for (const p of PRECIOS) yield il.lineasParaFacturar({ lines: [{ ...L(p, 0.21), dto }], discountGlobalAmount: null });
  });
}
await clase('DESCUENTO GLOBAL de 10,00 € · 1 línea al 21 % (línea negativa)', function* () {
  for (const p of PRECIOS) if (p > 10) yield il.lineasParaFacturar({ lines: [L(p, 0.21)], discountGlobalAmount: 10 });
});
await clase('RECTIFICATIVA · las 2 líneas 21 % + 10 % con el precio negado', function* () {
  for (let i = 0; i + 1 < PRECIOS.length; i++) yield [L(-PRECIOS[i], 0.21), L(-PRECIOS[PRECIOS.length - 1 - i], 0.10)];
});

out('— la factura SIN líneas: de dónde sale su total');
{
  const p = await papelFactura([], '123.45');
  out(`  generado con lines = [] y total guardado 123,45 → imprime ${eur(p.total)} · ${p.desdeElGuardado ? 'del GUARDADO (rama «Total:»)' : 'recalculado'} · filas de línea en el papel: ${p.filas.length}`);
  const q = await papelFactura([L(100, 0.21)], '999.99');
  out(`  control: con una línea de 100 al 21 % y total guardado 999,99 → imprime ${eur(q.total)} (ignora el guardado)`);
}

out('— el PRESUPUESTO: el pie (Base + cuotas, de pieDePresupuesto) contra el Total impreso (el guardado, calcTotal)');
out('clase                                              | presupuestos | Base + cuotas ≠ Total | máx.');
async function clasePresu(nombre, generador) {
  let n = 0; let d = 0; let m = 0; let ej = null;
  const pie = require(path.join(R, 'dist/modules/quotes/domain/presentacionIva.js'));
  for (const [c, global] of generador()) {
    n += 1;
    const filas = pie.pieDePresupuesto({ lineas: c, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: global }).filas;
    const base = filas.find((f) => f.etiqueta === 'Base imponible:');
    const cuotas = filas.filter((f) => /^IVA \d+%:$/.test(f.etiqueta));
    const suma = cent(base.importe) + cuotas.reduce((a, f) => a + cent(f.importe), 0);
    const total = cent(u.calcTotal(c, global));
    if (suma !== total) { d += 1; m = Math.max(m, Math.abs(suma - total)); if (!ej) ej = [c, global]; }
  }
  let ejemplo = '';
  if (ej) {
    const q = await papelPresupuesto(ej[0], u.calcTotal(ej[0], ej[1]).toFixed(2), { discountGlobalAmount: ej[1] });
    ejemplo = ` | PDF generado: Base ${eur(q.base)} + ${q.desglose.map((x) => `IVA ${x.rotulo} ${eur(x.cuota)}`).join(' + ')} · Total ${eur(q.total)}`;
  }
  out(`${nombre.padEnd(50)} | ${String(n).padStart(12)} | ${String(d).padStart(8)} (${(100 * d / n).toFixed(2)} %)`.padEnd(88) + `| ${m}${ejemplo}`);
}
const modoSumar = (() => { try { return require(path.join(R, 'dist/modules/quotes/domain/presentacionIva.js')).leerModoIva(undefined).modo; } catch { return '?'; } })();
out(`  (modo por defecto de leerModoIva: «${modoSumar}»)`);
await clasePresu('CONTROL A CERO · 1 línea, euros enteros, 21 %', function* () { for (let e = 1; e <= 1349; e++) yield [[L(e, 0.21)], null]; });
await clasePresu('1 línea de 2 decimales, 21 %', function* () { for (const p of PRECIOS) yield [[L(p, 0.21)], null]; });
await clasePresu('2 líneas, 21 % + 10 %', function* () { for (let i = 0; i + 1 < PRECIOS.length; i++) yield [[L(PRECIOS[i], 0.21), L(PRECIOS[PRECIOS.length - 1 - i], 0.10)], null]; });
await clasePresu('1 línea con descuento de línea del 15 %, 21 %', function* () { for (const p of PRECIOS) yield [[{ ...L(p, 0.21), dto: 15 }], null]; });
await clasePresu('1 línea al 21 % con 10,00 € de descuento global', function* () { for (const p of PRECIOS) if (p > 10) yield [[L(p, 0.21)], 10]; });
await clasePresu('1 línea al 7,5 % (el tipo admitido con decimales)', function* () { for (const p of PRECIOS) yield [[L(p, 0.075)], null]; });

// ── el clasificador de filas reales, probado con filas fabricadas ────────────────────────────
out('\n══ el clasificador de FACTURAS REALES (`--filas`), probado aquí con filas fabricadas');
{
  const fabricadas = [
    { id: 1, number: 'LIMPIA', type: 'F1', total: '121.00', lines: [L(100, 0.21)] },
    { id: 2, number: 'COLUMNA', type: 'F1', total: '30.25', lines: [L(12.5, 0.21), L(12.5, 0.21)] },
    { id: 3, number: 'ROTULO', type: 'F1', total: '107.50', lines: [L(100, 0.075)] },
    // el menor caso de ③ hallado arriba: guarda 0,03 e imprime 0,04 (y su columna suma 0,03)
    { id: 4, number: 'TOTAL', type: 'F1', total: '0.03', lines: [L(0.02, 0.21), L(0.01, 0.10)] },
    { id: 5, number: 'SIN-LINEAS', type: 'F1', total: '50.00', lines: [] },
  ];
  const r = clasificar(fabricadas);
  const visto = `limpias ${r.limpias} · ① columna ${r.d1446} · ② rótulo ${r.d1447} · ③ total ${r.d1448} · sin líneas ${r.sinLineas}`;
  const esperado = 'limpias 1 · ① columna 2 · ② rótulo 1 · ③ total 1 · sin líneas 1';
  out(`  filas: ${r.n} · ${visto}`);
  out(`  esperado:  ${esperado} → ${visto === esperado ? 'COINCIDE' : 'NO COINCIDE: el clasificador no vale'}`);
}

out(`\nPDF generados y leídos en total: ${nPdf}`);
process.chdir(os.tmpdir());
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* Windows puede retenerla: es una carpeta temporal del sistema */ }
out('EXIT=0');

// ════════════════════════════════════════════════════════════════════════════════════════════
function clasificar(filas) {
  const r = { n: 0, limpias: 0, d1446: 0, d1447: 0, d1448: 0, sinLineas: 0, ejemplos: { d1446: [], d1447: [], d1448: [], sinLineas: [] }, tipos: {} };
  for (const f of filas) {
    r.n += 1;
    const lines = Array.isArray(f.lines) ? f.lines : [];
    if (lines.length === 0) { r.sinLineas += 1; if (r.ejemplos.sinLineas.length < 5) r.ejemplos.sinLineas.push(f.number); continue; }
    const k = copia(lines);
    let sucia = false;
    if (k.suma !== k.total) { r.d1446 += 1; sucia = true; if (r.ejemplos.d1446.length < 5) r.ejemplos.d1446.push(`${f.number}: suma ${eur(k.suma)} · TOTAL ${eur(k.total)}`); }
    const falsos = lines.filter((l) => { const t = Number(l.tax) || 0; return t > 0 && Number((t * 100).toFixed(0)) !== Math.round(t * 1e6) / 1e4; });
    for (const l of lines) { const c = pct(Number(l.tax) || 0); r.tipos[c] = (r.tipos[c] || 0) + 1; }
    if (falsos.length) { r.d1447 += 1; sucia = true; if (r.ejemplos.d1447.length < 5) r.ejemplos.d1447.push(`${f.number}: ${pct(Number(falsos[0].tax))} se imprime «${(Number(falsos[0].tax) * 100).toFixed(0)}%»`); }
    const g = Math.round(Number(f.total) * 100);
    if (k.total !== g) { r.d1448 += 1; sucia = true; if (r.ejemplos.d1448.length < 5) r.ejemplos.d1448.push(`${f.number}: guardado ${eur(g)} · impreso ${eur(k.total)}`); }
    if (!sucia) r.limpias += 1;
  }
  return r;
}
async function clasificarFilas() {
  const filas = JSON.parse(fs.readFileSync(FICHERO_FILAS, 'utf8').replace(/^﻿/, ''));
  out(`POBLACION: ${filas.length} filas de ${path.basename(FICHERO_FILAS)}`);
  if (!Array.isArray(filas) || filas.length === 0) { out('CIEGO: ninguna fila. Un cero aquí no diría nada.'); out('EXIT=2'); process.exit(2); }
  const control = clasificar([{ id: 0, number: 'CONTROL', type: 'F1', total: '30.25', lines: [L(12.5, 0.21), L(12.5, 0.21)] }]);
  out(`control del instrumento (una fila fabricada que NO cuadra): ① ${control.d1446} de 1`);
  const r = clasificar(filas);
  out(`limpias: ${r.limpias} · ① la columna no suma el TOTAL: ${r.d1446} · ② rótulo de tipo falso: ${r.d1447} · ③ TOTAL impreso ≠ guardado: ${r.d1448} · sin líneas: ${r.sinLineas}`);
  out(`tipos encontrados en las líneas: ${JSON.stringify(r.tipos)}`);
  for (const [k, v] of Object.entries(r.ejemplos)) if (v.length) out(`  ${k}: ${v.join(' | ')}`);
}

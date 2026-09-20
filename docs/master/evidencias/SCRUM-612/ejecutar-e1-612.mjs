// docs/master/evidencias/SCRUM-612/ejecutar-e1-612.mjs — SCRUM-612 (E-1) · jv-j1, 18-sep-2026
//
// LA MITAD QUE CORRE: llama a las funciones REALES del producto compiladas en `dist/` (tras
// `npm run build`), sin base de datos, sin red y sin tocar una línea de `src/` (regla 38: se
// ejecuta, no se modifica). Complementa a `medir-e1-612.mjs`, que sólo lee por AST.
//
// Uso:   node docs/master/evidencias/SCRUM-612/ejecutar-e1-612.mjs <raiz-del-repo> <carpeta-temporal-FUERA-del-árbol>
//
// ⚠️ Los PDF se escriben en `<carpeta-temporal>/storage/invoices/`: el generador los deja en
// `process.cwd()/storage/invoices` (`src/core/storage/dirs.ts`), así que el proceso se muda a la
// carpeta temporal ANTES de cargar `dist/`. Nada se escribe dentro del repositorio (SCRUM-824).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2] ?? '.');
const TMP = path.resolve(process.argv[3] ?? '');
if (!process.argv[3] || TMP.startsWith(RAIZ)) {
  console.error('Falta la carpeta temporal, o está DENTRO del repositorio. Se aborta sin hacer nada.');
  process.exit(2);
}
let fallos = 0;
const control = (nombre, ok, detalle = '') => { if (!ok) fallos++; console.log(`  control · ${nombre}: ${ok ? 'OK' : 'FALLA'}${detalle ? ` (${detalle})` : ''}`); };

// ── El entorno del sujeto se construye a mano (A21: un laboratorio que presta su entorno mide la suma).
const HEREDADAS = ['FORCE_COLOR', 'INVOICING_ES_ENABLED', 'SIF_ENABLED', 'AUTO_INVOICE_ON_PAID', 'AUTO_EMAIL_INVOICE_ON_PAID'];
console.log('ENTORNO (antes de limpiarlo):');
for (const k of HEREDADAS) console.log(`  ${k.padEnd(28)} ${k in process.env ? `PRESENTE (${k === 'FORCE_COLOR' ? process.env[k] : 'valor no impreso'})` : 'ausente'}`);
for (const k of HEREDADAS) delete process.env[k];
console.log('  → las cinco, BORRADAS del proceso: lo que sigue es el valor por DEFECTO del código.\n');

fs.mkdirSync(path.join(TMP, 'storage', 'invoices'), { recursive: true });
process.chdir(TMP);
const req = createRequire(path.join(RAIZ, 'package.json'));
const dist = (p) => req(path.join(RAIZ, 'dist', p));
const distEsViejo = fs.statSync(path.join(RAIZ, 'dist', 'core', 'flags.js')).mtimeMs < fs.statSync(path.join(RAIZ, 'src', 'core', 'flags.ts')).mtimeMs;
console.log(`dist/ más nuevo que src/core/flags.ts: ${distEsViejo ? 'NO — build viejo, no fiarse' : 'sí'}`);
if (distEsViejo) fallos++;

const { isFlagEnabled, FLAG_DEFAULTS } = dist('core/flags.js');
const { getEmissionMode, isDemoMerchant, DEMO_WATERMARK } = dist('modules/invoicing/domain/emission.service.js');
const { makeReceiptNumber, isReceiptNumber } = dist('modules/invoicing/domain/invoiceNumber.service.js');
const { config } = dist('core/config/env.js');

// ── 1 · Valores por defecto, EJECUTADOS ──────────────────────────────────────────────────────
console.log('\n1 · FLAGS, ejecutados con el entorno limpio');
const esReal = { id: 5000, email: 'fontanero@ejemplo.test', country: 'ES', flags: null };
console.log(`  FLAG_DEFAULTS.INVOICING_ES_ENABLED = ${FLAG_DEFAULTS.INVOICING_ES_ENABLED} · FLAG_DEFAULTS.SIF_ENABLED = ${FLAG_DEFAULTS.SIF_ENABLED}`);
console.log(`  isFlagEnabled('INVOICING_ES_ENABLED', merchant ES real) = ${isFlagEnabled('INVOICING_ES_ENABLED', { merchant: esReal })}`);
console.log(`  isFlagEnabled('SIF_ENABLED', merchant ES real)          = ${isFlagEnabled('SIF_ENABLED', { merchant: esReal })}`);
console.log(`  config.AUTO_INVOICE_ON_PAID = ${config.AUTO_INVOICE_ON_PAID} · config.AUTO_EMAIL_INVOICE_ON_PAID = ${config.AUTO_EMAIL_INVOICE_ON_PAID}`);

// ── 2 · El modo de emisión, caso a caso ──────────────────────────────────────────────────────
console.log('\n2 · getEmissionMode(), caso a caso');
const casos = [
  ['profesional español real, sin nada', esReal, 'receipt'],
  ['el mismo, con override en merchants.flags = true', { ...esReal, flags: { INVOICING_ES_ENABLED: true } }, 'fiscal'],
  ['el mismo, con override = false', { ...esReal, flags: { INVOICING_ES_ENABLED: false } }, 'receipt'],
  ['sin país guardado', { ...esReal, country: null }, 'receipt'],
  ['merchant demo (id 1)', { id: 1, email: 'x@y.test', country: 'ES', flags: null }, 'demo'],
  ['merchant demo por email', { id: 77, email: 'demo@yaqu.app', country: 'ES', flags: null }, 'demo'],
  ['profesional de Portugal', { ...esReal, country: 'PT' }, 'fiscal'],
];
for (const [nombre, m, esperado] of casos) {
  const modo = getEmissionMode(m);
  console.log(`  ${nombre.padEnd(52)} → ${modo.padEnd(8)} ${modo === esperado ? '' : `(esperaba ${esperado})`}`);
  if (modo !== esperado) fallos++;
}
process.env.INVOICING_ES_ENABLED = 'true';
const conEnv = getEmissionMode(esReal);
delete process.env.INVOICING_ES_ENABLED;
console.log(`  con la variable de entorno INVOICING_ES_ENABLED=true (la palanca GLOBAL) → ${conEnv}  · y al quitarla → ${getEmissionMode(esReal)}`);
control('la palanca global enciende a TODOS los españoles sin override', conEnv === 'fiscal');
const numero = makeReceiptNumber(new Date('2026-09-18T12:00:00Z'));
console.log(`  el número que da el modo justificante: ${numero} · isReceiptNumber → ${isReceiptNumber(numero)}`);
control('el formato J- se reconoce', isReceiptNumber(numero) === true && !isReceiptNumber('2026-CF-001'));

// ── 3 · Los dos PDF, generados por el generador REAL, y su texto extraído ────────────────────
console.log('\n3 · PDF generados con generateInvoicePdf() de dist/, en la carpeta temporal');
const { generateInvoicePdf } = dist('modules/invoicing/infra/pdf/pdf.service.js');

// Texto de un PDF de pdfkit: se inflan los flujos y se juntan las cadenas hex de los operadores
// de texto. Con las fuentes estándar, pdfkit escribe cada trozo como <hex> en un TJ.
function textoDelPdf(fichero) {
  const buf = fs.readFileSync(fichero);
  const bin = buf.toString('latin1');
  let out = '';
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(bin))) {
    const ini = m.index + m[0].length;
    const fin = bin.indexOf('endstream', ini);
    if (fin < 0) break;
    let datos = buf.subarray(ini, fin);
    try { datos = zlib.inflateSync(datos); } catch { /* no comprimido */ }
    const s = datos.toString('latin1');
    for (const h of s.matchAll(/<([0-9a-fA-F]+)>/g)) out += Buffer.from(h[1], 'hex').toString('latin1');
    out += '\n';
  }
  return out;
}
const base = {
  invoiceId: 999001,
  merchant: { name: 'Fontaneria Prueba SL', taxId: 'B00000000', address: 'Calle Falsa 1' },
  customer: { name: 'Cliente Prueba' },
  currency: 'EUR', total: '121.00', qrData: 'INV:prueba', createdAt: new Date('2026-09-18T12:00:00Z'),
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 21 }],
};
// La marca se decide IGUAL que en los tres llamadores reales (`isDemoMerchant(m) ? DEMO_WATERMARK : null`),
// pero con las funciones de dist/, no con un literal copiado aquí.
const marca = (m) => (isDemoMerchant(m) ? DEMO_WATERMARK : null);
const demo = { id: 1, email: 'demo@yaqu.app', country: 'ES' };
const pdfDemo = await generateInvoicePdf({ ...base, number: '2026-DEMO-001', merchantId: 1, type: 'F1', watermark: marca(demo) });
const pdfJust = await generateInvoicePdf({ ...base, number: numero, merchantId: 5000, type: 'JUST', watermark: marca(esReal) });
const tDemo = textoDelPdf(pdfDemo.outPath);
const tJust = textoDelPdf(pdfJust.outPath);
const tiene = (t, s) => t.replace(/\s+/g, ' ').includes(s);
console.log(`  PDF del demo        : ${path.basename(pdfDemo.outPath)} · ${fs.statSync(pdfDemo.outPath).size} bytes`);
console.log(`     «DEMO»: ${tiene(tDemo, 'DEMO')} · «no v…lida fiscalmente»: ${/no v.lida fiscalmente/.test(tDemo)} · «JUSTIFICANTE DE COBRO»: ${tiene(tDemo, 'JUSTIFICANTE DE COBRO')}`);
console.log(`  PDF del justificante: ${path.basename(pdfJust.outPath)} · ${fs.statSync(pdfJust.outPath).size} bytes`);
console.log(`     «DEMO»: ${tiene(tJust, 'DEMO')} · «no v…lida fiscalmente»: ${/no v.lida fiscalmente/.test(tJust)} · «JUSTIFICANTE DE COBRO»: ${tiene(tJust, 'JUSTIFICANTE DE COBRO')}`);
control('el extractor ve texto que SE SABE dibujado (el número de factura del demo)', tiene(tDemo, '2026-DEMO-001'));
control('el extractor ve «JUSTIFICANTE DE COBRO» en el justificante (control positivo)', tiene(tJust, 'JUSTIFICANTE DE COBRO'));
control('la marca de agua SALE en el PDF del demo', tiene(tDemo, 'DEMO') && /no v.lida fiscalmente/.test(tDemo));
control('la marca de agua NO sale en el del profesional real', !tiene(tJust, 'DEMO'));

console.log(`\nEXIT_PREVISTO=${fallos ? 1 : 0}  (fallos: ${fallos})`);
process.exitCode = fallos ? 1 : 0;

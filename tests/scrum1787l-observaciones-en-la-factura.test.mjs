// tests/scrum1787l-observaciones-en-la-factura.test.mjs — SCRUM-1787l
//
// Decisiones del fundador: SCRUM-1787 c.22345 (② pasa SOLO el pie, `docFooterText`, que el papel
// rotula «Observaciones»; ④ la R1 NO lo hereda; ⑤ cada factura de un presupuesto por tramos lo
// lleva) y c.22346 (ALTER `invoices.doc_footer_text` aplicado en staging y producción).
//
//   ① emitir con el texto → la fila lo lleva (congelado por `crearFacturaEmitida`, sin tocarla)
//   ② el PDF de factura pinta «Observaciones» y el texto (texto EXTRAÍDO del PDF)
//   ③ control: sin texto (null, '' o solo espacios) el PDF sale con las MISMAS líneas que sin el campo
//   ④ la ficha de factura pinta la sección «Observaciones» con el texto; sin texto, no hay sección
//   ⑤ la R1 no lo hereda: el objeto que la ruta de rectificar pasa a `crearFacturaEmitida` no lleva
//     `docFooterText` ni ningún spread (AST, sobre la RUTA de verdad; leído, no modificado)
//   ⑥ los TRES generadores del PDF de factura le pasan el campo de la fila (AST)
//
// Las rutas S1 que crean la factura desde un presupuesto NO se tocan aquí (carril de Luis): hasta
// que se aplique su diff (registro SCRUM-1787, tramo 1787l), el texto sólo llega si se le pasa a la
// emisión, que es lo que hace ①. Datos de EJEMPLO, ninguno real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { lineasDePdf } from './_texto-del-pdf.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    nombre: 'el PDF de factura no pinta las Observaciones',
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'if (!isReceipt && params.docFooterText && String(params.docFooterText).trim() !== \'\') {',
    a: 'if (false && params.docFooterText) {',
    cae: 'SCRUM-1787l ② el PDF de factura pinta «Observaciones» y el texto',
  },
  {
    nombre: 'la ficha de factura no pinta las Observaciones',
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: 'if (secObsFac) page.appendChild(secObsFac);',
    a: 'void secObsFac;',
    cae: 'SCRUM-1787l ④ la ficha de factura pinta la sección «Observaciones»',
  },
];

const TEXTO = 'ZZOBS Pago a 30 días.\nGarantía de 2 años en mano de obra.';

// ── ① la emisión congela el campo ───────────────────────────────────────────────────────────────
const { crearFacturaEmitida } = await import('../dist/modules/invoicing/domain/crearFacturaEmitida.js');
function txDeEjemplo() {
  const creadas = [];
  return {
    creadas,
    customer: { findFirst: async () => null },
    invoice: { findFirst: async () => null, create: async ({ data }) => { creadas.push(data); return { id: 99, ...data }; } },
  };
}
const CLIENTE = { customerName: 'Cliente QA', customerLegalName: null, customerTaxId: null, customerEmail: null, customerPhone: null };

test('SCRUM-1787l ① emitir con docFooterText lo guarda en la fila', async () => {
  const tx = txDeEjemplo();
  const f = await crearFacturaEmitida(tx, CLIENTE, {}, { merchantId: 71, customerId: 5, number: 'F1', total: '1', type: 'F1', docFooterText: TEXTO });
  assert.equal(tx.creadas.length, 1, '🔴 CIEGO: no se creó ninguna fila');
  assert.equal(tx.creadas[0].docFooterText, TEXTO);
  assert.equal(f.docFooterText, TEXTO);
  // control: sin el campo, la fila no lo inventa
  const tx2 = txDeEjemplo();
  await crearFacturaEmitida(tx2, CLIENTE, {}, { merchantId: 71, customerId: 5, number: 'F2', total: '1', type: 'F1' });
  assert.equal(tx2.creadas[0].docFooterText, undefined);
});

// ── ② ③ el PDF ───────────────────────────────────────────────────────────────────────────────────
async function lineasDelPdf(sufijo, extra) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1787L${sufijo}`, invoiceId: 1, merchantId: 1,
    merchant: { name: 'Emisor QA', taxId: 'B00000000' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '12.10', qrData: '', type: 'F1', zona: null, merchantCriterioCaja: null,
    lines: [{ concept: 'Mano de obra', qty: 1, price: 10, tax: 0.21 }],
    ...extra,
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
    const textos = r.lineas.map((l) => l.texto);
    assert.ok(textos.some((t) => t.includes('Mano de obra')), '🔴 CIEGO: el PDF leído no trae el concepto');
    return textos;
  } finally { fs.rmSync(outPath, { force: true }); }
}

test('SCRUM-1787l ② el PDF de factura pinta «Observaciones» y el texto (texto extraído)', async () => {
  const t = (await lineasDelPdf('a', { docFooterText: TEXTO })).join('\n');
  assert.match(t, /^Observaciones$/m);
  assert.match(t, /ZZOBS Pago a 30 días\./);
  assert.match(t, /Garantía de 2 años en mano de obra\./);
});

test('SCRUM-1787l ③ control: sin texto el PDF sale con las mismas líneas que sin el campo', async () => {
  const base = await lineasDelPdf('b', {});
  assert.ok(!base.includes('Observaciones'), '🔴 el PDF de hoy no debería llevar el rótulo');
  for (const [i, v] of [null, '', '   \n '].entries()) {
    const otra = (await lineasDelPdf(`b${i}`, { docFooterText: v }))
      .map((l) => l.replace(`QA1787Lb${i}`, 'QA1787Lb'));
    assert.deepEqual(otra, base, `docFooterText=${JSON.stringify(v)} cambia el PDF`);
  }
});

// ── ④ la ficha ───────────────────────────────────────────────────────────────────────────────────
const FACTURA = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 12.1, currency: 'EUR',
  createdAt: '2026-11-02T09:00:00.000Z', customerName: 'ZZCLIENTE Ejemplo', customer: { id: 1, name: 'ZZCLIENTE' },
  lines: [{ concept: 'ZZCONCEPTO alicatado', qty: 1, price: 10, tax: 0.21 }], rectifiedBy: [],
});
async function fichaCon(cambios) {
  const factura = { ...FACTURA, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  return todos(r.contenedor);
}
const textoDe = (n) => [n.textContent || '', ...(n.hijos || []).map(textoDe)].join(' ').replace(/\s+/g, ' ').trim();
const seccionObs = (nodos) => nodos.filter((n) => n.dataset && n.dataset.seccion === 'observaciones');

test('SCRUM-1787l ④ la ficha de factura pinta la sección «Observaciones» con el texto', async () => {
  const nodos = await fichaCon({ docFooterText: TEXTO });
  assert.ok(nodos.some((n) => (n.textContent || '').trim() === 'Conceptos'), '🔴 CIEGO: la ficha no pintó los conceptos');
  const sec = seccionObs(nodos);
  assert.equal(sec.length, 1, 'tiene que haber UNA sección de Observaciones');
  const h3 = todos(sec[0]).find((n) => n.tagName === 'H3');
  assert.equal(h3 && h3.textContent, 'Observaciones');
  assert.match(textoDe(sec[0]), /ZZOBS Pago a 30 días\./);
});

test('SCRUM-1787l ④ control: sin texto la ficha no pinta la sección', async () => {
  for (const v of [undefined, null, '', '  ']) {
    const nodos = await fichaCon({ docFooterText: v });
    assert.ok(nodos.some((n) => (n.textContent || '').trim() === 'Conceptos'), '🔴 CIEGO: la ficha no pintó los conceptos');
    assert.equal(seccionObs(nodos).length, 0, `docFooterText=${JSON.stringify(v)} pinta la sección`);
  }
});

// ── ⑤ ⑥ AST sobre el código de verdad ────────────────────────────────────────────────────────────
function fuente(rel) {
  return ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ts.ScriptTarget.Latest, true);
}
function llamadas(sf, nombre) {
  const out = [];
  (function v(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) out.push(n);
    ts.forEachChild(n, v);
  })(sf);
  return out;
}
const objetoArg = (call) => call.arguments.find((a) => ts.isObjectLiteralExpression(a));
const claves = (obj) => obj.properties.filter((p) => p.name).map((p) => p.name.getText());
const valorDe = (obj, k) => obj.properties.find((p) => p.name && p.name.getText() === k);

test('SCRUM-1787l ⑤ la R1 no hereda las Observaciones (la ruta de rectificar no pasa docFooterText)', () => {
  const sf = fuente('src/modules/system/app/routes/invoicesAdmin.routes.ts');
  const r1 = llamadas(sf, 'crearFacturaEmitida').map(objetoArg)
    .filter((o) => o && valorDe(o, 'type') && /'R1'/.test(valorDe(o, 'type').getText()));
  assert.equal(r1.length, 1, `🔴 CIEGO: esperaba UNA emisión de R1 en la ruta, hay ${r1.length}`);
  assert.ok(claves(r1[0]).includes('rectifiesId'), '🔴 CIEGO: la llamada hallada no es la rectificativa');
  assert.ok(!claves(r1[0]).includes('docFooterText'), 'la R1 hereda docFooterText');
  assert.equal(r1[0].properties.filter((p) => ts.isSpreadAssignment(p)).length, 0,
    'un spread en la R1 podría arrastrar docFooterText de la original');
});

test('SCRUM-1787l ⑥ los tres generadores del PDF de factura pasan docFooterText de la fila', () => {
  const sitios = ['src/lib/invoicing.ts', 'src/modules/system/app/routes/invoicesAdmin.routes.ts'];
  const objs = sitios.flatMap((s) => llamadas(fuente(s), 'generateInvoicePdf').map(objetoArg));
  assert.equal(objs.length, 3, `🔴 CIEGO: esperaba 3 llamadas a generateInvoicePdf, hay ${objs.length}`);
  for (const o of objs) {
    const p = valorDe(o, 'docFooterText');
    assert.ok(p, 'una llamada a generateInvoicePdf no pasa docFooterText');
    assert.match(p.getText(), /\b(inv|invoice)\.docFooterText\b/, 'docFooterText no sale de la fila de la factura');
  }
});

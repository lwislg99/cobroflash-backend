// tests/scrum1787aa-pdf-factura-filas-restantes.test.mjs — SCRUM-1787aa (T4, filas que quedan)
//
// QUÉ SE PIDE: de las 20 filas de la tabla de SCRUM-1787 c.22426, 1787w construyó la 1, 2, 5-10, 13 y
// 19. Las que quedan (3, 4, 11, 12, 14, 15, 16, 17, 18 y 20) NO dicen «igualar»: dicen «se queda
// igual» (NECESARIAS), «igual», «fuera de T4», «no se inventa» o «solo presupuesto». GO regla 40:
// c.22416; literales firmados: c.22428. Aquí no se cambia `src/`: se comprueba, con PDF REALES, que
// esas filas siguen como dice la tabla DESPUÉS del dibujo nuevo de 1787w (que movió todo alrededor).
//
// CÓMO SE MIDE: texto y posiciones leídos de PDF fabricados con los MISMOS datos que 1787v/1787w
// (`lineasDePdf`); fuentes y QR sobre los objetos del PDF. En el PDF la `y` crece hacia ARRIBA.
//
// ③④ fila 3 y 4: «Nº», «Fecha:», «Vence el», «Formas de pago:» siguen, en ese orden, entre el título y «Emisor:»
// ⑭ fila 14: el bloque «Observaciones» es igual en los dos PDF (texto, x y separación vertical)
// ⑮ fila 15: la factura no inventa cláusulas (control positivo: el presupuesto SÍ las pinta)
// ⑰ fila 17: con sello, QR y leyenda VERI*FACTU siguen; sin sello, ninguno de los dos
// ⑱ fila 18: con marca de agua demo se pinta; sin ella, no
// ⑳ fila 20: Helvetica y sin numerar, en los dos
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «Formas de pago» sube por encima de «Vence el»: el orden de la fila 3/4 se rompe.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "  if (params.dueDate) doc.text(`Vence el ${fechaLargaDeVencimiento(params.dueDate)}`, { align: 'right' });",
    a: "  if (params.dueDate) doc.text(`Vence el ${fechaLargaDeVencimiento(params.dueDate)}`, { align: 'right' }); doc.moveDown(3);",
    cae: 'SCRUM-1787aa ③④',
  },
  {
    // Las Observaciones de la factura se desplazan respecto a las del presupuesto.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '      .text(TITULO_OBSERVACIONES, M, doc.y, { width: W, align: \'left\' });',
    a: '      .text(TITULO_OBSERVACIONES, M + 8, doc.y, { width: W, align: \'left\' });',
    cae: 'SCRUM-1787aa ⑭',
  },
  {
    // La leyenda VERI*FACTU deja de pintarse con sello.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "        .text('Factura verificable en la sede electrónica de la AEAT', txX, qrY, { width: txW });",
    a: "        ; void txX;",
    cae: 'SCRUM-1787aa ⑰',
  },
  {
    // La marca de agua demo deja de pintarse.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '  drawWatermark();\n',
    a: '\n',
    cae: 'SCRUM-1787aa ⑱',
  },
];

const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { generateInvoicePdf, generateQuotePdf } = await imp('dist/modules/invoicing/infra/pdf/pdf.service.js');
const { calcTotal, precioConDto } = await imp('dist/core/utils/utils.js');

// ── Los MISMOS datos que `tests/scrum1787w-…` y `docs/master/evidencias/SCRUM-1787/1787v/` ──────────
const MERCHANT = {
  name: 'Fontanería Ejemplo', legalName: 'Fontanería Ejemplo SL', taxId: 'B00000000',
  address: 'Calle Inventada 1, 28000 Ciudad Ficticia',
};
const CLIENTE = { name: 'Cliente Ejemplo', taxId: '00000000T', email: 'cliente@ejemplo.invalid' };
const DIR_CLIENTE = { billingAddress: 'Calle Falsa 123', billingPostalCode: '28000', billingCity: 'Ciudad Ficticia' };
const DIR_UNA_LINEA = 'Calle Falsa 123, 28000, Ciudad Ficticia';
const LINEAS_PRESUPUESTO = [
  { concept: 'Sustitución de grifo\nGrifo monomando de cocina, incluye desmontaje del antiguo', qty: 1, price: 80, tax: 0.21 },
  { concept: 'Mano de obra', qty: 2, price: 35, tax: 0.21, dto: 10 },
  { concept: 'Material de fontanería', qty: 3, price: 12.5, tax: 0.10 },
];
const LINEAS_FACTURA = LINEAS_PRESUPUESTO.map(({ dto, ...l }) => ({ ...l, price: precioConDto(l.price, dto) }));
const total = String(calcTotal(LINEAS_PRESUPUESTO, null));
const OBS = 'Pago a 30 días.\nGarantía de 6 meses sobre la mano de obra.';

async function leer(gen) {
  const r = await gen;
  const buf = fs.readFileSync(r.outPath);
  fs.rmSync(r.outPath, { force: true });
  const l = lineasDePdf(buf);
  assert.ok(l.ok, `🔴 CIEGO: no supe leer el PDF: ${l.motivo}`);
  assert.ok(l.lineas.length > 10, `🔴 CIEGO: el PDF leído trae ${l.lineas.length} líneas`);
  return { buf, lineas: l.lineas };
}

const presupuesto = await leer(generateQuotePdf({
  quoteId: 917870001, quoteNumber: 1001, revision: 0,
  merchant: MERCHANT, customer: CLIENTE, currency: 'EUR', total,
  lines: LINEAS_PRESUPUESTO, country: 'ES', taxName: 'IVA', modoIva: null,
  docHeaderText: null, docFooterText: OBS,
  direccionObra: { modo: 'facturacion', personalizada: null, cliente: DIR_CLIENTE },
  clausulas: [{ id: 'g', titulo: 'Garantía', texto: 'Seis meses sobre la mano de obra.' }],
  clausulasExcluidas: [],
  validez: 'Válido hasta el 05 de diciembre de 2026',
  zona: 'Europe/Madrid',
}));

const PARAMS_FACTURA = {
  number: 'F-2026-0001', invoiceId: 1787, merchantId: 1787,
  merchant: MERCHANT, customer: CLIENTE, customerAddress: DIR_UNA_LINEA,
  currency: 'EUR', total, qrData: '', vfHash: null, type: 'F1', watermark: null,
  createdAt: new Date('2026-11-05T10:00:00.000Z'),
  lines: LINEAS_FACTURA, taxName: 'IVA',
  zona: 'Europe/Madrid', merchantCriterioCaja: null,
  docFooterText: OBS,
  dueDate: new Date('2026-12-05T22:59:59.000Z'), payMethods: ['card', 'bizum', 'transfer'],
};
const factura = await leer(generateInvoicePdf(PARAMS_FACTURA));
// Fila 17: datos de sello FABRICADOS (ningún registro real): URL de cotejo de ejemplo y huella de 64 hex.
const HUELLA = 'ab'.repeat(32);
const facturaSellada = await leer(generateInvoicePdf({
  ...PARAMS_FACTURA, qrData: 'https://ejemplo.invalid/cotejo?nif=B00000000&num=F-2026-0001', vfHash: HUELLA,
}));
// Fila 18: el texto que ponen los tres llamadores (`DEMO_WATERMARK`, emission.service.ts).
const { DEMO_WATERMARK } = await imp('dist/modules/invoicing/domain/emission.service.js');
const facturaDemo = await leer(generateInvoicePdf({ ...PARAMS_FACTURA, watermark: DEMO_WATERMARK }));

const textos = (d) => d.lineas.map((l) => l.texto);
const una = (d, pred, que) => {
  const hay = d.lineas.filter(pred);
  assert.equal(hay.length, 1, `🔴 esperaba UNA línea ${que}; hay ${hay.length}: ${JSON.stringify(hay.map((l) => l.texto))}`);
  return hay[0];
};
const imagenes = (buf) => (buf.toString('latin1').match(/\/Subtype\s*\/Image\b/g) || []).length;
const fuentes = (buf) => new Set((buf.toString('latin1').match(/\/BaseFont\s*\/[A-Za-z0-9+\-]+/g) || [])
  .map((s) => s.replace(/^\/BaseFont\s*\//, '').replace(/^[A-Z]{6}\+/, '')));

// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1787aa ③④ «Nº», «Fecha:», «Vence el» y «Formas de pago:» siguen, en orden, entre el título y «Emisor:»', () => {
  const titulo = una(factura, (l) => l.texto === 'FACTURA', 'con el título');
  const num = una(factura, (l) => l.texto === 'Nº F-2026-0001', 'con el número');
  const fecha = una(factura, (l) => l.texto === 'Fecha: 05/11/2026', 'con la fecha');
  const vence = una(factura, (l) => l.texto.startsWith('Vence el '), 'con «Vence el»');
  const pago = una(factura, (l) => l.texto === 'Formas de pago: Tarjeta, Bizum, Transferencia', 'con las formas de pago');
  const emisor = una(factura, (l) => l.texto.startsWith('Emisor: '), 'con «Emisor:»');
  const ys = [titulo, num, fecha, vence, pago, emisor].map((l) => l.y);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] < ys[i - 1], `🔴 orden roto en la cabecera de la factura: ${JSON.stringify(ys)}`);
  }
  // Las cuatro filas de la fila 3/4 van seguidas: ninguna separación pasa de una línea y media de 11 pt.
  for (const [a, b] of [[num, fecha], [fecha, vence], [vence, pago]]) {
    assert.ok(a.y - b.y < 20, `🔴 «${b.texto}» se ha separado de «${a.texto}» (${(a.y - b.y).toFixed(2)} pt)`);
  }
  // Y van alineadas a la derecha (no en la columna del emisor).
  for (const l of [fecha, vence, pago]) assert.ok(l.x > emisor.x + 100, `🔴 «${l.texto}» ya no va a la derecha (x=${l.x})`);
});

test('SCRUM-1787aa ⑭ el bloque «Observaciones» es igual en los dos PDF (texto, x y separación vertical)', () => {
  const bloque = (d, que) => {
    const r = una(d, (l) => l.texto === 'Observaciones', `«Observaciones» en ${que}`);
    return ['Pago a 30 días.', 'Garantía de 6 meses sobre la mano de obra.'].map((t) => {
      const l = una(d, (x) => x.texto === t, `«${t}» en ${que}`);
      return [l.texto, l.x.toFixed(2), (r.y - l.y).toFixed(2)];
    }).concat([[r.texto, r.x.toFixed(2), '0.00']]);
  };
  assert.deepEqual(bloque(factura, 'la factura'), bloque(presupuesto, 'el presupuesto'),
    '🔴 las Observaciones de la factura ya no son las del presupuesto');
});

test('SCRUM-1787aa ⑮ la factura no inventa cláusulas (control: el presupuesto SÍ las pinta)', () => {
  const tieneClausula = (d) => textos(d).some((t) => t.includes('Seis meses sobre la mano de obra.'));
  assert.ok(tieneClausula(presupuesto), '🔴 CIEGO: el presupuesto no pinta la cláusula sembrada');
  assert.ok(!tieneClausula(factura), '🔴 la factura pinta una cláusula: la fila 15 es «fuera de T4»');
});

test('SCRUM-1787aa ⑰ con sello, QR y leyenda VERI*FACTU siguen; sin sello, ninguno', () => {
  const t = textos(facturaSellada);
  for (const f of ['Factura verificable en la sede electrónica de la AEAT', 'VERI*FACTU — escanea el QR para verificarla (RD 1007/2023).']) {
    assert.ok(t.includes(f), `🔴 la factura sellada ha perdido «${f}»: ${JSON.stringify(t)}`);
  }
  assert.ok(t.some((x) => x.startsWith(`Huella: ${HUELLA.slice(0, 32)}`)), '🔴 la factura sellada ha perdido la huella');
  // El PNG del QR lleva su máscara de transparencia: 2 objetos imagen (medido el 24-nov); se pide ≥ 1.
  assert.ok(imagenes(facturaSellada.buf) >= 1, '🔴 la factura sellada no trae imagen (el QR)');
  // Sin sello (qrData vacío, SCRUM-1779d): ni QR ni leyenda.
  assert.equal(imagenes(factura.buf), 0, '🔴 la factura sin sello trae una imagen');
  assert.ok(!textos(factura).some((x) => x.includes('AEAT') || x.includes('VERI*FACTU')), '🔴 la factura sin sello habla de la AEAT');
});

test('SCRUM-1787aa ⑱ con marca de agua demo se pinta; sin ella, no', () => {
  assert.ok(DEMO_WATERMARK && DEMO_WATERMARK.length > 5, '🔴 CIEGO: no leí DEMO_WATERMARK');
  // A 42 pt la marca no cabe en una línea: el lector la da en DOS («DEMO — no válida » y «fiscalmente»,
  // medido el 24-nov). Se exige que las palabras de la marca salgan, en orden, en líneas que la factura
  // sin marca NO tiene.
  const extra = (d) => { const base = new Set(textos(factura)); return textos(d).filter((x) => !base.has(x)); };
  const pintada = extra(facturaDemo).join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(pintada, DEMO_WATERMARK, `🔴 la factura demo no pinta la marca de agua: ${JSON.stringify(extra(facturaDemo))}`);
  assert.ok(!textos(factura).some((x) => x.includes('DEMO')), '🔴 la factura sin marca pinta la marca');
});

test('SCRUM-1787aa ⑳ Helvetica y sin numerar, en los dos', () => {
  for (const [que, d] of [['presupuesto', presupuesto], ['factura', factura]]) {
    const f = fuentes(d.buf);
    assert.ok(f.size > 0, `🔴 CIEGO: no leí ninguna fuente en el ${que}`);
    for (const n of f) assert.match(n, /^Helvetica(-Bold|-Oblique|-BoldOblique)?$/, `🔴 el ${que} usa «${n}»`);
    assert.ok(!textos(d).some((x) => /^(Página|Pág\.)\s*\d|^\d+\s*\/\s*\d+$/.test(x)), `🔴 el ${que} numera páginas`);
  }
  // Las dos usan las MISMAS fuentes.
  assert.deepEqual([...fuentes(factura.buf)].sort(), [...fuentes(presupuesto.buf)].sort());
});

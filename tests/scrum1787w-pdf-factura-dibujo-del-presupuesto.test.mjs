// tests/scrum1787w-pdf-factura-dibujo-del-presupuesto.test.mjs — SCRUM-1787w (T4)
//
// QUÉ SE PIDE: el PDF de FACTURA con el dibujo del presupuesto. GO regla 40 del fundador en SCRUM-1787
// c.22416 («1-GO»); literales FIRMADOS en c.22428 («sí a todo»); tabla de diferencias en c.22426
// (jv-j1ic, evidencias en `docs/master/evidencias/SCRUM-1787/1787v/`).
//
// CÓMO SE MIDE: sobre el TEXTO y las POSICIONES leídos de dos PDF fabricados con los MISMOS datos que
// la medición de 1787v (`lineasDePdf`), y el dibujo (la banda verde) sobre los flujos de contenido
// descomprimidos. En el PDF la `y` crece hacia ARRIBA.
//
// ① la factura imprime cada literal firmado de c.22428 y ya no imprime los viejos
// ② conserva lo NECESARIO: número, «Fecha:», «Vence el», NIF, «Dirección:», «Formas de pago», base por tipo
// ③ cabecera de tabla y columnas iguales a las del presupuesto con los mismos datos (los dos PDF)
// ④ control: el PDF del presupuesto no cambia (huella de texto y posiciones medida ANTES del cambio)
// ⑤ la banda verde de marca ya no se pinta (y el control positivo: el verde SÍ se lee si se pinta)
// ⑥ lo NECESARIO con SIF encendido sigue en el fuente: leyenda VERI*FACTU y QR
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = 'src/modules/invoicing/infra/pdf/pdf.service.ts';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el rótulo viejo del total.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "'Total factura:'",
    a: "'TOTAL:'",
    cae: 'SCRUM-1787w ① la factura imprime los literales firmados de c.22428 y no los viejos',
  },
  {
    // Vuelve la banda verde de arriba.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '// SCRUM-1787w · sin banda de marca arriba',
    a: "doc.rect(0, 0, doc.page.width, 5).fill('#16a34a'); //",
    cae: 'SCRUM-1787w ⑤ la banda verde de marca ya no se pinta',
  },
];

const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { generateInvoicePdf, generateQuotePdf } = await imp('dist/modules/invoicing/infra/pdf/pdf.service.js');
const { calcTotal, precioConDto } = await imp('dist/core/utils/utils.js');

// ── Los MISMOS datos que `docs/master/evidencias/SCRUM-1787/1787v/generar-pdfs.mjs` ──────────────
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

const textos = (d) => d.lineas.map((l) => l.texto);
const una = (d, pred, que) => {
  const hay = d.lineas.filter(pred);
  assert.equal(hay.length, 1, `🔴 esperaba UNA línea ${que}; hay ${hay.length}: ${JSON.stringify(hay.map((l) => l.texto))}`);
  return hay[0];
};

/** Flujos de contenido descomprimidos (pdfkit los guarda con FlateDecode). */
function flujos(buf) {
  const s = buf.toString('latin1');
  const out = [];
  let i = 0;
  for (;;) {
    const a = s.indexOf('stream', i);
    if (a < 0) break;
    let ini = a + 6;
    if (s[ini] === '\r') ini++;
    if (s[ini] === '\n') ini++;
    const b = s.indexOf('endstream', ini);
    if (b < 0) break;
    const crudo = Buffer.from(s.slice(ini, b), 'latin1');
    try { out.push(zlib.inflateSync(crudo).toString('latin1')); } catch { out.push(crudo.toString('latin1')); }
    i = b + 9;
  }
  return out;
}
/** El verde de marca #16a34a (22, 163, 74) como operador de relleno de pdfkit. */
const VERDE_DE_MARCA = /0\.0862\d* 0\.6392\d* 0\.2901\d* scn/;

// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1787w ① la factura imprime los literales firmados de c.22428 y no los viejos', () => {
  const t = textos(factura);
  const firmados = [
    'Emisor: Fontanería Ejemplo SL',
    'NIF: B00000000',
    'Cliente: Cliente Ejemplo',
    'NIF: 00000000T',
    'Email: cliente@ejemplo.invalid',
    `Dirección: ${DIR_UNA_LINEA}`,
    'Detalle de la factura:',
  ];
  for (const f of firmados) assert.ok(t.includes(f), `🔴 la factura no imprime «${f}»: ${JSON.stringify(t)}`);
  assert.ok(t.some((x) => x.startsWith('Total factura:')), '🔴 la factura no imprime «Total factura:»');
  // Sin descuento global (la factura no lo tiene): ni «Suma de líneas» ni «Descuento».
  assert.ok(!t.some((x) => x.includes('Suma de líneas') || x.includes('Descuento')), '🔴 «Suma de líneas»/«Descuento» sin descuento global');
  for (const viejo of ['EMISOR', 'NIF/CIF:', 'CLIENTE', 'CONCEPTO', 'PRECIO UNIT']) {
    assert.ok(!t.some((x) => x.includes(viejo)), `🔴 la factura sigue imprimiendo «${viejo}»`);
  }
  assert.ok(!t.some((x) => /^TOTAL:/.test(x)), '🔴 la factura sigue imprimiendo «TOTAL:»');
});

test('SCRUM-1787w ② la factura conserva lo NECESARIO (número, fecha, vence, NIF, dirección, formas de pago, base por tipo)', () => {
  const t = textos(factura);
  for (const f of ['Nº F-2026-0001', 'Fecha: 05/11/2026', 'Formas de pago: Tarjeta, Bizum, Transferencia', 'NIF: 00000000T', 'Base imponible por tipo']) {
    assert.ok(t.includes(f), `🔴 la factura ha perdido «${f}»: ${JSON.stringify(t)}`);
  }
  assert.ok(t.some((x) => x.startsWith('Vence el ')), '🔴 la factura ha perdido «Vence el»');
  assert.ok(t.some((x) => x.startsWith('Dirección: ')), '🔴 la factura ha perdido «Dirección:»');
  assert.ok(t.some((x) => x.startsWith('Base imponible:')), '🔴 la factura ha perdido «Base imponible:»');
  for (const tipo of ['IVA 21%:', 'IVA 10%:']) assert.ok(t.some((x) => x.includes(tipo)), `🔴 falta la fila «${tipo}» del desglose`);
  // El título sigue siendo «FACTURA», encima del número.
  const titulo = una(factura, (l) => l.texto === 'FACTURA', 'con el título');
  assert.ok(titulo.y > una(factura, (l) => l.texto === 'Nº F-2026-0001', 'con el número').y);
});

test('SCRUM-1787w ③ cabecera de tabla y columnas iguales a las del presupuesto con los mismos datos', () => {
  // La cabecera sale en DOS líneas del lector: «Concepto» y, 12 pt más arriba según pdfkit, el resto
  // (`doc.y - 12`). Se compara la cabecera ENTERA: cada trozo con su texto, su x y su y relativa.
  const cabecera = (d, que) => {
    const c = una(d, (l) => l.texto === 'Concepto', `«Concepto» en ${que}`);
    return d.lineas.filter((l) => Math.abs(l.y - c.y) <= 14)
      .map((l) => [l.texto, l.x.toFixed(2), (l.y - c.y).toFixed(2)])
      .sort((a, b) => Number(a[1]) - Number(b[1]));
  };
  const cabQ = cabecera(presupuesto, 'el presupuesto');
  const cabF = cabecera(factura, 'la factura');
  // El lector junta los cuatro rótulos alineados a la derecha en UNA línea y en orden inverso
  // («IMPORTEIVA%PrecioCant.», medido el 23-nov; por qué invierte, sin medir): se exige cada rótulo.
  const juntos = cabQ.map((t) => t[0]).join('|');
  for (const r of ['Concepto', 'Cant.', 'Precio', 'IVA%', 'IMPORTE']) {
    assert.ok(juntos.includes(r), `🔴 CIEGO: la cabecera del presupuesto no trae «${r}»: ${juntos}`);
  }
  assert.deepEqual(cabF, cabQ, '🔴 la cabecera de la factura no es la del presupuesto (texto, orden o posición)');
  // Una fila con los mismos datos: mismo concepto, misma cantidad y mismo tipo, en la misma columna.
  const filaQ = una(presupuesto, (l) => l.texto.startsWith('Material de fontanería'), 'de fila en el presupuesto');
  const filaF = una(factura, (l) => l.texto.startsWith('Material de fontanería'), 'de fila en la factura');
  assert.equal(filaF.texto, filaQ.texto, '🔴 la fila no se pinta igual en los dos');
  assert.equal(filaF.x, filaQ.x);
  // La descripción de línea va en su propia línea, como en el presupuesto.
  // (a 9 pt y 240 de ancho se parte en dos líneas: se compara la primera, texto y x)
  const descQ = una(presupuesto, (l) => l.texto.startsWith('Grifo monomando'), 'con la descripción');
  const descF = una(factura, (l) => l.texto.startsWith('Grifo monomando'), 'con la descripción');
  assert.equal(descF.texto, descQ.texto);
  assert.equal(descF.x, descQ.x);
});

// Huella medida sobre el código ANTES del cambio (registro, tramo SCRUM-1787w).
const HUELLA_PRESUPUESTO = '7bc96b49a0e2686f0237ef3a31cfdafb82fcf26d0f23d450049c8d83ae27814a';
const huella = (lineas) => crypto.createHash('sha256')
  .update(JSON.stringify(lineas.map((l) => [l.x.toFixed(2), l.y.toFixed(2), l.texto])))
  .digest('hex');

test('SCRUM-1787w ④ control: el PDF del presupuesto no cambia (texto y posiciones)', () => {
  assert.equal(huella(presupuesto.lineas), HUELLA_PRESUPUESTO);
});

test('SCRUM-1787w ⑤ la banda verde de marca ya no se pinta', () => {
  // Control positivo SEMBRADO: el lector ve el verde cuando alguien lo pinta.
  const sembrado = flujos(Buffer.from('stream\n' + zlib.deflateSync(Buffer.from('0 0 595.28 5 re\n/DeviceRGB cs\n0.08627450980392157 0.6392156862745098 0.2901960784313726 scn')).toString('latin1') + '\nendstream', 'latin1'));
  assert.ok(sembrado.some((f) => VERDE_DE_MARCA.test(f)), '🔴 CIEGO: el lector no ve un verde sembrado');
  const f = flujos(factura.buf);
  assert.ok(f.some((x) => /\bTJ\b|\bTj\b/.test(x)), '🔴 CIEGO: no hay flujo de texto descomprimido');
  assert.ok(!f.some((x) => VERDE_DE_MARCA.test(x)), '🔴 la factura sigue pintando el verde de marca');
});

test('SCRUM-1787w ⑥ con SIF encendido, la leyenda VERI*FACTU y el QR siguen en el fuente', () => {
  const src = fs.readFileSync(path.join(RAIZ, FUENTE), 'utf8');
  assert.ok(src.includes("'Factura verificable en la sede electrónica de la AEAT'"));
  assert.ok(src.includes('doc.image(qrBuf, M, qrY, { width: qrSz });'));
});

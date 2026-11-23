// tests/scrum1787m-pdf-vence-y-formas-de-pago.test.mjs — SCRUM-1787m
//
// QUÉ SE PIDE (GO del fundador, regla 40: SCRUM-1787 c.22338 ③, «3-GO»): el PDF de FACTURA imprime
// `Vence el <fecha>` y las formas de pago CONGELADAS en la factura (`Invoice.dueDate` e
// `Invoice.payMethods`, de SCRUM-1787i). Literales firmados: `Vence el` (c.22325 ①) y `Formas de pago`
// con `Tarjeta` · `Bizum` · `Transferencia` (c.22345 ①), los mismos que pinta la ficha.
//
// CÓMO SE MIDE: sobre el TEXTO y las POSICIONES leídos del PDF fabricado (`lineasDePdf`), no sobre el
// fuente. En el PDF la `y` crece hacia ARRIBA.
//
// ① con vencimiento → una línea `Vence el dd/mm/aaaa`, debajo de `Fecha:` y por encima del emisor
// ② el día del vencimiento es el de la ZONA del negocio, como el de `Fecha:` (SCRUM-1470c)
// ③ con formas de pago → una línea `Formas de pago: Tarjeta, Bizum`, en el orden congelado
// ④ una clave desconocida no se pinta; si no queda ninguna conocida, no hay línea
// ⑤ sin vencimiento ni formas (ausentes, `null`, lista vacía) el PDF sale igual: mismas líneas, mismo
//    texto y mismas posiciones, y ninguno de los dos literales
// ⑥ con los dos datos, lo demás del documento no pierde ni gana texto: solo aparecen esas dos líneas
// ⑦ control: el PDF del PRESUPUESTO no lleva ninguno de los dos literales, aunque el presupuesto
//    tenga formas de pago
// ⑧ los llamadores de `generateInvoicePdf` pasan los dos campos DE LA FACTURA (leído en el fuente)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineasDePdf, extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El PDF deja de imprimir el vencimiento.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'if (params.dueDate) doc.text(',
    a: 'if (false) doc.text(',
    cae: 'SCRUM-1787m ① con vencimiento, el PDF imprime «Vence el» debajo de la fecha',
  },
  {
    // El PDF deja de imprimir las formas de pago.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'if (formasDePago.length) doc.text(',
    a: 'if (false) doc.text(',
    cae: 'SCRUM-1787m ③ con formas de pago, el PDF imprime «Formas de pago» con los literales firmados',
  },
];

const { generateInvoicePdf, generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');
const { calcTotal } = await import('../dist/core/utils/utils.js');
const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

const EMISOR = { name: 'Oficio Ficticio', legalName: 'Oficio Ficticio SL', taxId: 'B00000000', address: 'Calle Inventada 1, 28000 Ciudad Ficticia' };
const CLIENTE = { name: 'Cliente QA', email: 'cliente@ejemplo.invalid' };
// 22:59:59Z del 5 de diciembre = 23:59:59 en Madrid: el último segundo del día 5 allí.
const VENCE = new Date('2026-12-05T22:59:59.000Z');

let serie = 0;
async function lineasDeFactura(extra = {}) {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1787M${serie}`, invoiceId: 1787, merchantId: 1787,
    merchant: EMISOR, customer: CLIENTE, currency: 'EUR', total: '121.00', qrData: '', type: 'F1',
    createdAt: new Date('2026-11-05T10:00:00.000Z'),
    lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    zona: 'Europe/Madrid', merchantCriterioCaja: null,
    ...extra,
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    // El número de factura cambia en cada fabricación (el nombre del fichero sale de él): se quita de
    // la comparación sustituyéndolo, no saltándose la línea.
    return r.lineas.map((l) => ({ x: l.x, y: l.y, texto: l.texto.replace(`F-2026-QA1787M${serie}`, 'F-N') }));
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/** La única línea que contiene `trozo`. Cero o dos es CIEGO o defecto, y se dice cuál. */
function laLinea(lineas, trozo) {
  const l = lineas.filter((x) => x.texto.includes(trozo));
  assert.equal(l.length, 1, `🔴 «${trozo}» sale en ${l.length} líneas; esperaba 1`);
  return l[0];
}
const conLiteral = (lineas, literal) => lineas.filter((l) => l.texto.includes(literal));

test('SCRUM-1787m ① con vencimiento, el PDF imprime «Vence el» debajo de la fecha', async () => {
  const lineas = await lineasDeFactura({ dueDate: VENCE });
  const fecha = laLinea(lineas, 'Fecha: 05/11/2026'); // positivo: la fecha de expedición está y se lee
  const vence = laLinea(lineas, 'Vence el');
  assert.equal(vence.texto.trim(), 'Vence el 05/12/2026', '🔴 el vencimiento no sale con el formato de la fecha de expedición');
  assert.ok(vence.y < fecha.y, `🔴 «Vence el» (y=${vence.y}) no está debajo de «Fecha:» (y=${fecha.y})`);
  const emisor = laLinea(lineas, 'EMISOR');
  assert.ok(vence.y > emisor.y, `🔴 «Vence el» (y=${vence.y}) no está en la cabecera: cae a la altura del emisor (y=${emisor.y}) o por debajo`);
});

test('SCRUM-1787m ② el día del vencimiento es el de la zona del negocio, como el de la fecha', async () => {
  // 23:30Z del día 5 ya es día 6 en Madrid, y sigue siendo día 5 en UTC.
  const instante = new Date('2026-12-05T23:30:00.000Z');
  const madrid = await lineasDeFactura({ dueDate: instante, zona: 'Europe/Madrid' });
  assert.equal(laLinea(madrid, 'Vence el').texto.trim(), 'Vence el 06/12/2026');
  const sinZona = await lineasDeFactura({ dueDate: instante, zona: null });
  assert.equal(laLinea(sinZona, 'Vence el').texto.trim(), 'Vence el 05/12/2026');
});

test('SCRUM-1787m ③ con formas de pago, el PDF imprime «Formas de pago» con los literales firmados', async () => {
  const lineas = await lineasDeFactura({ dueDate: VENCE, payMethods: ['card', 'bizum'] });
  const formas = laLinea(lineas, 'Formas de pago');
  assert.equal(formas.texto.trim(), 'Formas de pago: Tarjeta, Bizum');
  assert.ok(formas.y < laLinea(lineas, 'Vence el').y, '🔴 las formas de pago no van debajo del vencimiento');
  assert.ok(formas.y > laLinea(lineas, 'EMISOR').y, '🔴 las formas de pago no están en la cabecera');
  // Las tres firmadas, en el orden en que se congelaron (no en el del diccionario).
  const tres = await lineasDeFactura({ payMethods: ['transfer', 'bizum', 'card'] });
  assert.equal(laLinea(tres, 'Formas de pago').texto.trim(), 'Formas de pago: Transferencia, Bizum, Tarjeta');
});

test('SCRUM-1787m ④ una clave desconocida no se pinta, y sin ninguna conocida no hay línea', async () => {
  const mezcla = await lineasDeFactura({ payMethods: ['cheque', 'card', 'constructor'] });
  assert.equal(laLinea(mezcla, 'Formas de pago').texto.trim(), 'Formas de pago: Tarjeta');
  for (const raro of [['cheque'], ['toString'], 'bizum', { card: true }, [null, 7]]) {
    const lineas = await lineasDeFactura({ payMethods: raro });
    assert.equal(conLiteral(lineas, 'Formas de pago').length, 0, `🔴 ${JSON.stringify(raro)} pinta la línea de formas de pago`);
    laLinea(lineas, 'Fecha: 05/11/2026'); // positivo: el documento se leyó
  }
});

test('SCRUM-1787m ⑤ sin vencimiento ni formas de pago, el PDF sale igual: texto y posiciones', async () => {
  const base = await lineasDeFactura();
  assert.ok(base.length >= 10, `🔴 CIEGO: la factura base solo tiene ${base.length} líneas`);
  laLinea(base, 'Fecha: 05/11/2026');
  assert.equal(conLiteral(base, 'Vence el').length, 0, '🔴 una factura sin vencimiento imprime «Vence el»');
  assert.equal(conLiteral(base, 'Formas de pago').length, 0, '🔴 una factura sin formas de pago imprime la línea');
  const variantes = [
    { dueDate: null, payMethods: null },
    { dueDate: undefined, payMethods: undefined },
    { dueDate: null, payMethods: [] },
    { payMethods: ['cheque'] },
  ];
  for (const v of variantes) {
    assert.deepEqual(await lineasDeFactura(v), base, `🔴 con ${JSON.stringify(v)} el PDF no es el de una factura sin esos datos`);
  }
});

test('SCRUM-1787m ⑥ con los dos datos solo aparecen esas dos líneas: el resto del texto es el mismo', async () => {
  const base = await lineasDeFactura();
  const con = await lineasDeFactura({ dueDate: VENCE, payMethods: ['card', 'bizum'] });
  assert.equal(con.length, base.length + 2, `🔴 esperaba ${base.length} + 2 líneas y hay ${con.length}`);
  const nuevas = (l) => l.texto.includes('Vence el') || l.texto.includes('Formas de pago');
  assert.deepEqual(con.filter((l) => !nuevas(l)).map((l) => l.texto), base.map((l) => l.texto),
    '🔴 al añadir las dos líneas se ha perdido o cambiado otro texto del documento');
  // Lo que queda POR ENCIMA de las dos líneas nuevas no se mueve.
  for (const trozo of ['FACTURA', 'Nº F-N', 'Fecha: 05/11/2026']) {
    assert.deepEqual(laLinea(con, trozo), laLinea(base, trozo), `🔴 «${trozo}» se ha movido`);
  }
});

test('SCRUM-1787m ⑦ control: el PDF del presupuesto no lleva ninguno de los dos literales', async () => {
  const linea = { concept: 'Revisión', qty: 1, price: 100, tax: 0.21 };
  const v = CreateQuoteSchema.safeParse({
    merchant_id: 71, customer_id: 71, currency: 'EUR', payMethods: ['card', 'bizum'],
    tiers: [
      { id: 'good', label: 'Básica', lines: [linea] },
      { id: 'better', label: 'Completa', lines: [linea] },
      { id: 'best', label: 'Integral', lines: [linea] },
    ],
  });
  assert.equal(v.success, true, 'CIEGO: el esquema rechaza el cuerpo, y lo que sigue no mediría el presupuesto');
  const tiers = v.data.tiers.map((t) => ({ ...t, total: calcTotal(t.lines, null) }));
  const q = {
    id: 1787, merchantId: 71, customerId: 71, status: 'sent', currency: 'EUR',
    total: tiers[0].total.toFixed(2), lines: tiers[0].lines, ivaModo: 'sumar', tiers,
    payMethods: ['card', 'bizum'], validUntil: VENCE,
    discountGlobalAmount: null, quoteNumber: 7, revision: 0,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date('2026-11-05T10:00:00.000Z'), updatedAt: new Date('2026-11-05T10:00:00.000Z'),
    merchant: { id: 71, name: 'Oficio', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Cliente' },
  };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  let r;
  try { r = extraerTextoPdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF DEL PRESUPUESTO: ${r.motivo}`);
  assert.ok(r.texto.includes('Revisión'), '🔴 CIEGO: el PDF del presupuesto no trae ni su concepto');
  assert.ok(!r.texto.includes('Vence el'), '🔴 el PDF del presupuesto imprime «Vence el»');
  assert.ok(!r.texto.includes('Formas de pago'), '🔴 el PDF del presupuesto imprime «Formas de pago»');
});

test('SCRUM-1787m ⑧ los llamadores del PDF de factura pasan el vencimiento y las formas DE LA FACTURA', () => {
  // Población: toda llamada a `generateInvoicePdf(` en `src/`, fuera del fichero que la define.
  const llamadas = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) { andar(ruta); continue; }
      if (!e.name.endsWith('.ts') || ruta.endsWith(path.join('infra', 'pdf', 'pdf.service.ts'))) continue;
      const fuente = fs.readFileSync(ruta, 'utf8');
      let i = 0;
      while ((i = fuente.indexOf('await generateInvoicePdf({', i)) !== -1) {
        const fin = fuente.indexOf('\n    });', i);
        const finCorto = fuente.indexOf('});', i);
        llamadas.push({ ruta: path.relative(RAIZ, ruta).replace(/\\/g, '/'), cuerpo: fuente.slice(i, fin === -1 ? finCorto : Math.max(fin, finCorto)) });
        i += 1;
      }
    }
  };
  andar(path.join(RAIZ, 'src'));
  // Suelo: el 23-nov-2026 son tres (dos en `src/lib/invoicing.ts` y la de regenerar). Menos es que el
  // patrón ha dejado de casar, no que haya menos llamadores.
  assert.ok(llamadas.length >= 1, `🔴 CIEGO: solo veo ${llamadas.length} llamadas a generateInvoicePdf en src/`); // 23-nov-2026, SCRUM-665e: de 3 a 1 por decisión del fundador (SCRUM-665 c.22379, con c.21182 y c.22358): queda un generador único, `ensureInvoicePdf`; el segundo se unificó y `regenerate-pdf` se retiró
  for (const { ruta, cuerpo } of llamadas) {
    // El objeto del que salen es el mismo que da `createdAt` a esa llamada: la factura.
    const factura = /createdAt:\s*(\w+)\.createdAt/.exec(cuerpo)?.[1];
    assert.ok(factura, `🔴 CIEGO: no sé de qué objeto sale la factura en ${ruta}`);
    assert.ok(cuerpo.includes(`dueDate: ${factura}.dueDate`), `🔴 ${ruta}: el PDF no recibe el vencimiento de la factura (${factura}.dueDate)`);
    assert.ok(cuerpo.includes(`payMethods: ${factura}.payMethods`), `🔴 ${ruta}: el PDF no recibe las formas de pago de la factura (${factura}.payMethods)`);
  }
});

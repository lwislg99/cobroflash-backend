// tests/scrum892-firma-vacia.test.mjs — SCRUM-892
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA FIRMA VACÍA NO ES UNA FIRMA.
//
// Medido en staging (SCRUM-882b, 16-sep-2026, 390 px): en «3 opciones» el recuadro de firma nacía
// oculto y se quedaba en 0×0. La cliente dibujaba sin ver nada, el navegador mandaba `data:,`
// (6 caracteres) y `POST /quote/:token/decision` respondía 200: guardaba «Aceptado con firma
// digital», SELLABA `evidenciaFirma` sobre esa nada y regeneraba el PDF. El panel decía «Firmado
// digitalmente · La firma va incluida en el PDF» y el PDF no llevaba ninguna imagen.
//
// Aquí van las tres mitades que se pueden medir sin navegador:
//   · el CRITERIO de «vacía» (`firmaTieneTrazo`), contra lienzos reales medidos en Chromium
//   · la RUTA de aceptación, en los dos modos (un precio y «3 opciones»)
//   · el PANEL: `GET /admin/quotes/:id` dice si la firma guardada tiene trazo
// La cuarta —que el recuadro tome tamaño al mostrarse— necesita navegador y vive en
// `scripts/guard-firma-con-tramos.mjs`.
//
// 🔴 POR QUÉ EL CRITERIO ES DE PÍXELES: medido, un lienzo VACÍO de 912×450 (densidad 3) ocupa
// 13.146 caracteres y una firma REAL a densidad 1 ocupa 5.770. Ningún umbral de longitud los separa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const FIRMAS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests', 'fixtures', 'scrum892-firmas.json'), 'utf8'));

const { firmaTieneTrazo, ERROR_FIRMA_VACIA, COPY_FIRMA_VACIA } = await import(DIST + 'modules/quotes/domain/firmaConTrazo.js');
const moduloPrisma = await import(DIST + 'core/db/prisma.js');

// ── el criterio ────────────────────────────────────────────────────────────────────────────

test('SCRUM-892 · SUELO: las muestras son las que creo (sin esto, los verdes no miden nada)', () => {
  for (const k of ['vacia-1x1', 'vacia-304x150', 'vacia-912x450', 'trazo-minimo-304x150', 'trazo-esquina-912x450', 'firma-390px-dpr1']) {
    assert.ok(String(FIRMAS[k]).startsWith('data:image/png;base64,'), `🔴 la muestra «${k}» no es un PNG del lienzo`);
  }
  assert.ok(FIRMAS['vacia-912x450'].length > FIRMAS['firma-390px-dpr1'].length,
    '🔴 la premisa del criterio ya no se cumple: un lienzo vacío grande era MÁS largo que una firma real');
});

test('SCRUM-892 · VACÍAS: lienzos sin trazo, `data:,` y lo que no es un PNG del lienzo', () => {
  const vacias = {
    'data:, (el lienzo 0×0 de «3 opciones»)': 'data:,',
    'cadena vacía': '',
    'vacía 1×1': FIRMAS['vacia-1x1'],
    'vacía 304×150': FIRMAS['vacia-304x150'],
    'vacía 912×450': FIRMAS['vacia-912x450'],
    'JPEG': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',
    'PNG cortado por la mitad': FIRMAS['firma-390px-dpr1'].slice(0, 2000),
    'número': 123,
  };
  for (const [nombre, valor] of Object.entries(vacias)) {
    assert.equal(firmaTieneTrazo(valor), false, `🔴 «${nombre}» se ha dado por firma con trazo`);
  }
  assert.equal(firmaTieneTrazo(null), false);
  assert.equal(firmaTieneTrazo(undefined), false);
});

test('SCRUM-892 · CON TRAZO: ninguna firma con trazo se rechaza, ni la de 1 px en la última esquina', () => {
  for (const k of ['trazo-minimo-304x150', 'trazo-esquina-912x450', 'firma-390px-dpr1']) {
    assert.equal(firmaTieneTrazo(FIRMAS[k]), true, `🔴 «${k}» tiene trazo y se ha dado por vacía`);
  }
});

// ── la ruta de aceptación ──────────────────────────────────────────────────────────────────

const routerDe = (mod) => mod.default?.default ?? mod.default;

async function invocar(rutaModulo, metodo, ruta, req) {
  const router = routerDe(await import(DIST + rutaModulo));
  assert.ok(Array.isArray(router?.stack), `🔴 no se pudo leer el router de ${rutaModulo}`);
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.[metodo]);
  assert.ok(capa, `🔴 no existe ${metodo.toUpperCase()} ${ruta} en ${rutaModulo}: el test no estaría invocando nada`);
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
    type() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

const QUOTE_ID = 99989201;
const TRAMOS = [
  { id: 'good', label: 'Básico', lines: [{ concept: 'Cuadro eléctrico', qty: 1, price: 380, tax: 0 }] },
  { id: 'better', label: 'Estándar', lines: [{ concept: 'Cuadro eléctrico', qty: 1, price: 590, tax: 0 }] },
];

/** `MANUAL` a propósito: sin plan de cobro no se emite factura y la prueba no depende de la serie. */
function presupuesto({ tramos = null, status = 'sent' } = {}) {
  return {
    id: QUOTE_ID, quoteNumber: 7, merchantId: 7, customerId: 2, status, currency: 'EUR',
    total: 590, lines: [{ concept: 'Cuadro eléctrico', qty: 1, price: 590, tax: 0 }], tiers: tramos,
    paymentTerms: 'MANUAL', decisionToken: 'a'.repeat(32), Invoice: [], validUntil: null,
    merchant: { id: 7, name: 'QA', country: 'ES' }, customer: { id: 2, name: 'Cliente QA' },
  };
}

/** Doble de `prisma.quote` que APUNTA cada escritura: lo que se vigila es que no haya ninguna. */
function doblarPrisma(quote) {
  const escrituras = [];
  moduloPrisma.prisma.quote = {
    findUnique: async () => quote,
    findFirst: async () => quote,
    update: async (a) => { escrituras.push(a.data); return { ...quote, ...a.data }; },
  };
  return escrituras;
}

const aceptar = (body) => invocar('modules/quotes/app/routes/quotes.routes.js', 'post', '/:token/decision', {
  params: { token: 'a'.repeat(32) },
  body: { decision: 'accept', ...body },
  headers: { 'user-agent': 'scrum892' },
  ip: '127.0.0.1',
  socket: {},
});

const pdfDelPresupuesto = () => path.join(RAIZ, 'storage', 'invoices', `QUOTE-${QUOTE_ID}.pdf`);

function exigirRechazo(resp, escrituras, quien) {
  assert.ok(resp, `🔴 ${quien}: el handler no respondió`);
  assert.equal(resp.code, 422,
    `🔴 ${quien}: respondió ${resp.code} y no 422. Una firma sin trazo se estaba aceptando como «Aceptado con ` +
    `firma digital», con la evidencia sellada sobre nada.\n  Cuerpo: ${JSON.stringify(resp.body).slice(0, 200)}`);
  assert.equal(resp.body?.error, ERROR_FIRMA_VACIA);
  assert.equal(resp.body?.message, COPY_FIRMA_VACIA, `🔴 ${quien}: el mensaje no es la constante declarada`);
  assert.deepEqual(escrituras, [], `🔴 ${quien}: rechazó pero ESCRIBIÓ en el presupuesto`);
}

test('SCRUM-892 · 🔴 ROJO: «3 opciones» con la firma `data:,` → 422 y no se escribe nada', async () => {
  const escrituras = doblarPrisma(presupuesto({ tramos: TRAMOS }));
  const resp = await aceptar({ comment: 'Aceptado con firma digital', signatureData: 'data:,', tierId: 'good' });
  exigirRechazo(resp, escrituras, '«3 opciones» + data:,');
});

test('SCRUM-892 · en TODOS los modos: un precio con un lienzo vacío de verdad (912×450), y la cadena vacía', async () => {
  let escrituras = doblarPrisma(presupuesto());
  exigirRechazo(await aceptar({ comment: 'Aceptado con firma digital', signatureData: FIRMAS['vacia-912x450'] }),
    escrituras, 'un precio + lienzo vacío');
  escrituras = doblarPrisma(presupuesto({ tramos: TRAMOS }));
  exigirRechazo(await aceptar({ signatureData: '', tierId: 'better' }), escrituras, '«3 opciones» + cadena vacía');
});

test('SCRUM-892 · POSITIVO: una firma con trazo se acepta igual que antes, en los dos modos, y se sella', async (t) => {
  t.after(() => fs.rmSync(pdfDelPresupuesto(), { force: true }));
  for (const [modo, extra] of [['un precio', {}], ['«3 opciones»', { tierId: 'good' }]]) {
    const escrituras = doblarPrisma(presupuesto({ tramos: extra.tierId ? TRAMOS : null }));
    const resp = await aceptar({ comment: 'Aceptado con firma digital', signatureData: FIRMAS['firma-390px-dpr1'], ...extra });
    assert.equal(resp?.code, 200, `🔴 ${modo}: una firma CON trazo se ha rechazado: ${JSON.stringify(resp?.body).slice(0, 200)}`);
    const aceptacion = escrituras.find((d) => d.status === 'accepted');
    assert.ok(aceptacion, `🔴 ${modo}: no se escribió la aceptación`);
    assert.equal(aceptacion.signatureUrl, FIRMAS['firma-390px-dpr1'], `🔴 ${modo}: la firma guardada no es la que llegó`);
    assert.ok(aceptacion.evidenciaFirma, `🔴 ${modo}: una firma con trazo tiene que quedar sellada`);
  }
});

test('SCRUM-892 · NEGATIVO: «Acepto sin firmar» (signatureData null) sigue valiendo, sin firma ni sello', async () => {
  const escrituras = doblarPrisma(presupuesto({ tramos: TRAMOS }));
  const resp = await aceptar({ comment: 'Aceptado desde enlace WhatsApp', signatureData: null, tierId: 'good' });
  assert.equal(resp?.code, 200, `🔴 aceptar sin firmar se ha roto: ${JSON.stringify(resp?.body).slice(0, 200)}`);
  const aceptacion = escrituras.find((d) => d.status === 'accepted');
  assert.ok(aceptacion);
  assert.equal(aceptacion.signatureUrl, undefined);
  assert.equal(aceptacion.evidenciaFirma, undefined);
});

test('SCRUM-892 · NEGATIVO: una aceptación YA guardada no se toca — responde como antes y no escribe', async () => {
  const escrituras = doblarPrisma(presupuesto({ tramos: TRAMOS, status: 'accepted' }));
  const resp = await aceptar({ signatureData: 'data:,', tierId: 'good' });
  assert.equal(resp?.code, 200);
  assert.equal(resp?.body?.status, 'already_accepted');
  assert.deepEqual(escrituras, []);
});

// ── el PDF ─────────────────────────────────────────────────────────────────────────────────

const imagenesDelPdf = (ruta) => (fs.readFileSync(ruta).toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;

test('SCRUM-892 · PDF: la firma con trazo lleva sus 2 imágenes (la firma y su máscara); `data:,` no lleva ninguna', async (t) => {
  const { generateQuotePdf } = await import(DIST + 'lib/pdf.js');
  const base = {
    quoteNumber: 7, merchant: { name: 'QA' }, customer: { name: 'Cliente QA' }, currency: 'EUR', total: '380.00',
    lines: [{ concept: 'Cuadro eléctrico', qty: 1, price: 380, tax: 0 }], signedAt: new Date(), country: 'ES',
  };
  const conTrazo = await generateQuotePdf({ ...base, quoteId: QUOTE_ID + 1, signatureData: FIRMAS['firma-390px-dpr1'] });
  const vacia = await generateQuotePdf({ ...base, quoteId: QUOTE_ID + 2, signatureData: 'data:,' });
  t.after(() => { fs.rmSync(conTrazo.outPath, { force: true }); fs.rmSync(vacia.outPath, { force: true }); });
  assert.equal(imagenesDelPdf(conTrazo.outPath), 2, '🔴 el PDF de una firma con trazo no lleva sus 2 imágenes (medido en el #5 de staging)');
  assert.equal(imagenesDelPdf(vacia.outPath), 0, 'la firma `data:,` no produce imagen: por eso la ruta ya no puede aceptarla');
});

// ── el panel ───────────────────────────────────────────────────────────────────────────────

async function detalleConFirma(signatureUrl) {
  const quote = { ...presupuesto({ status: 'accepted' }), signatureUrl, charge: null, billingPlan: null, customBillingPlan: null, discountGlobalAmount: null, revision: 1 };
  // Lo que no es el presupuesto responde VACÍO (null / [] / 0): aquí solo se mira la firma.
  const modelo = (propio = {}) => new Proxy(propio, {
    get: (o, k) => (k in o ? o[k] : async () => (String(k) === 'findMany' ? [] : String(k) === 'count' ? 0 : null)),
  });
  moduloPrisma.prisma.quote = modelo({ findFirst: async () => quote, findUnique: async () => quote, findMany: async () => [quote] });
  for (const m of ['whatsAppMessage', 'merchant', 'maintenancePlan', 'quoteAssignee']) {
    moduloPrisma.prisma[m] = modelo();
  }
  return invocar('modules/system/app/routes/quotesAdmin.routes.js', 'get', '/:id', {
    params: { id: String(QUOTE_ID) }, merchantId: 7, userRole: 'owner', query: {}, headers: {},
  });
}

test('SCRUM-892 · PANEL: `GET /admin/quotes/:id` dice `firmaConTrazo` con el MISMO criterio que la ruta', async () => {
  const vacia = await detalleConFirma('data:,');
  assert.equal(vacia?.code, 200, `🔴 el detalle no respondió 200: ${JSON.stringify(vacia?.body).slice(0, 200)}`);
  assert.equal(vacia.body.firmaConTrazo, false,
    '🔴 una fila guardada con `signatureUrl = "data:,"` se da por firmada: el panel diría «Firmado digitalmente»');
  const real = await detalleConFirma(FIRMAS['firma-390px-dpr1']);
  assert.equal(real.body.firmaConTrazo, true, '🔴 una firma con trazo se da por vacía en el panel');
});

test('SCRUM-892 · PANEL: la pastilla «Firmado digitalmente» depende de `firmaConTrazo`, no de que exista `signatureUrl`', () => {
  const codigo = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesDetailView.js'), 'utf8')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const i = codigo.indexOf('✅ Firmado digitalmente');
  assert.ok(i > 0, '🔴 no encuentro la pastilla en quotesDetailView.js: el test no estaría mirando nada');
  const condicion = codigo.lastIndexOf('if (', i);
  assert.match(codigo.slice(condicion, codigo.indexOf('{', condicion)), /quote\.firmaConTrazo === true/,
    '🔴 la pastilla vuelve a pintarse con solo `quote.signatureUrl`, que es verdadero también para `data:,`');
});

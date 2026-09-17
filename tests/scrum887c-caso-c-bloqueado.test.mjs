// tests/scrum887c-caso-c-bloqueado.test.mjs — SCRUM-887 · PR 3 (caso C: descuento GLOBAL + VARIOS tipos de IVA)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UN DESCUENTO GLOBAL CON VARIOS TIPOS DE IVA NO SE GUARDA, NO SE REVISA Y NO SE FACTURA
//
// Tras los PR 1 y 2, el único descuento que seguía cobrando de más era C: el C3 del electricista
// (21 % y 10 %, dto de línea y 25 € de global) firma 539,05 y se le cobraban 628,60, porque la
// factura no sabe repartir el global entre tipos sin una convención fiscal que nadie ha fijado.
//
// ── LA DECISIÓN (orquestador por delegación del fundador) ─────────────────────────────────────
//   15616/15620 · C no se improvisa: el editor no deja guardarlo hasta que la asesoría fije el reparto.
//   15697 · opción (A) COMPLETA, porque el bloqueo sólo en la pantalla se cuela por la API, por una
//           revisión y por los C que ya existen:
//     A1 · el editor no deja guardar un C (L1);
//     A2 · el servidor lo rechaza con 400 en `POST /quote/create` (L1) y en `/revisiones` (L2r);
//     A3 · un C que ya existe NO EMITE: las líneas salen a 0 y el portón de SCRUM-246 da su 409.
//          El profesional lee L2; el cliente que acepta, el copy público ya aprobado (L3).
//   15698 · L2 y L2r terminan con la única salida real: «Duplicar» (un firmado no se edita, y la
//           revisión hereda el global).
//
// Los literales se comparan ESCRITOS: son los firmados, y si alguien los reescribe tiene que ver
// este rojo y la firma que los respalda (docs/microcopy/2026-09-17-SCRUM-887-*).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const requiere = createRequire(import.meta.url);

const { calcTotal } = await import(DIST + 'core/utils/utils.js');
const piezas = await import(DIST + 'modules/invoicing/domain/invoiceLines.service.js');
const { grossOfLines, stageLinesReconciled, lineasParaFacturar } = piezas;
const { distributeStageAmounts } = await import(DIST + 'modules/quotes/domain/billingPlan.js');
const {
  exigirLineasFacturables, ERROR_SIN_LINEAS, COPY_PUBLICO_SIN_LINEAS,
} = await import(DIST + 'modules/invoicing/domain/lineasFacturables.js');
const moduloPrisma = await import(DIST + 'core/db/prisma.js');

const L1 = 'Un descuento global no se puede aplicar a un presupuesto con varios tipos de IVA. Quítalo o pon el descuento en cada línea.';
const L2 = 'No se puede facturar: este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.';
const L2R = 'No se puede crear una revisión: este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.';
const CODIGO = 'descuento_global_con_varios_iva';

/** C3 del electricista (SCRUM-883) tal cual: 21 % y 10 % + 25 € de global. EL caso C. */
const C3 = [
  { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
  { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.10 },
  { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
];
/** El mismo con todo al 21 %: caso B, que SÍ factura (control). */
const C3_UN_IVA = C3.map((l) => ({ ...l, tax: 0.21 }));

const PLANES = {
  entero: [{ index: 0, percentage: 1, label: 'full' }],
  '50/50': [{ index: 0, percentage: 0.5, label: 'a' }, { index: 1, percentage: 0.5, label: 'b' }],
};

// ═════════════════════════════════════════════════════════════════════════════════════════════
// A3 · LA PIEZA: un C no factura (líneas a 0 → portón de SCRUM-246)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-887c · 🔴 A3: un C deja las líneas a 0 y el portón de SCRUM-246 no emite, en todos los planes', () => {
  const quote = { lines: C3, discountGlobalAmount: 25, total: calcTotal(C3, 25).toFixed(2) };
  assert.equal(quote.total, '539.05', '🔴 CIEGO: el firmado de C3 no es el medido en SCRUM-883');
  assert.equal(piezas.tieneDescuentoGlobalConVariosIva(quote), true, '🔴 C3 no se reconoce como caso C');

  const lineas = lineasParaFacturar(quote);
  assert.equal(lineas.length, 3, '🔴 un C no debe ganar ni perder líneas');
  assert.deepEqual(lineas.map((l) => l.price), [0, 0, 0], `🔴 un C sigue facturando precios: ${JSON.stringify(lineas)}`);
  for (const [nombre, plan] of Object.entries(PLANES)) {
    for (let i = 0; i < plan.length; i++) {
      const ls = stageLinesReconciled(lineas, plan, i, distributeStageAmounts(quote.total, plan)[i]);
      assert.throws(() => exigirLineasFacturables(ls), (e) => e?.code === ERROR_SIN_LINEAS,
        `🔴 plan ${nombre}, tramo ${i}: un C emitiría ${grossOfLines(ls)} € (firmado 539,05)`);
    }
  }
});

test('SCRUM-887c · ✅ CONTROL: sin global, con global y un IVA, y con global sin base, NO es C', () => {
  const es = piezas.tieneDescuentoGlobalConVariosIva;
  assert.equal(es({ lines: C3, discountGlobalAmount: null }), false, '🔴 IVA mezclado SIN global no es C');
  assert.equal(es({ lines: C3_UN_IVA, discountGlobalAmount: 25 }), false, '🔴 un solo IVA con global es B, no C');
  assert.equal(es({ lines: [{ concept: '1. APARTADO', apartado: true }, ...C3_UN_IVA], discountGlobalAmount: 25 }), false,
    '🔴 una cabecera de apartado no es un tipo de IVA');
  // Y B sigue facturando lo firmado: el bloqueo no se ha llevado por delante al caso que sí funciona.
  const b = { lines: C3_UN_IVA, discountGlobalAmount: 25, total: calcTotal(C3_UN_IVA, 25).toFixed(2) };
  const [f] = PLANES.entero.map((_, i) => stageLinesReconciled(lineasParaFacturar(b), PLANES.entero, i, Number(b.total)));
  assert.equal(grossOfLines(f), 559.7, '🔴 el caso B ha dejado de cobrar lo firmado');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Las RUTAS · handler real + `prisma` de doble (patrón de scrum263)
// ═════════════════════════════════════════════════════════════════════════════════════════════

const routerDe = (mod) => mod.default?.default ?? mod.default;

async function invocar(rutaModulo, metodo, ruta, req) {
  const router = routerDe(await import(DIST + rutaModulo));
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.[metodo]);
  assert.ok(capa, `🔴 CIEGO: no existe ${metodo.toUpperCase()} ${ruta} en ${rutaModulo}`);
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

const MERCHANT = { id: 7, name: 'QA', country: 'ES', taxId: 'B12345678', invoiceSeriesPrefix: 'CF', approvalThreshold: null };
const CUSTOMER = { id: 2, name: 'Cliente QA', phone: '+34 600 000 887' };

/** Deja `prisma` con lo mínimo y ANOTA toda escritura: un rechazo tiene que llegar antes. */
function prismaDeDoble(quote, escrituras) {
  const anota = (nombre) => async () => { escrituras.push(nombre); throw new Error(`escritura no permitida: ${nombre}`); };
  const p = moduloPrisma.prisma;
  p.quote = {
    findFirst: async () => quote, findUnique: async () => quote, findMany: async () => [quote],
    update: anota('quote.update'), create: anota('quote.create'),
  };
  p.invoice = { findMany: async () => [], findFirst: async () => null, create: anota('invoice.create') };
  p.merchant = { findUnique: async () => MERCHANT };
  p.customer = { findFirst: async () => CUSTOMER };
  p.$transaction = anota('$transaction');
}

const quoteC = (extra = {}) => ({
  id: 7, merchantId: 7, customerId: 2, quoteNumber: 12, revision: 0, status: 'accepted', currency: 'EUR',
  lines: C3, discountGlobalAmount: 25, total: '539.05', Invoice: [], billingPlan: null, customBillingPlan: null,
  paymentTerms: 'FULL_UPFRONT', merchant: MERCHANT, customer: CUSTOMER, ...extra,
});

function exigirRechazo(resp, codigo, texto, escrituras, quien) {
  assert.ok(resp, `🔴 ${quien}: el handler no respondió`);
  assert.equal(resp.code, codigo, `🔴 ${quien}: respondió ${resp.code} — ${JSON.stringify(resp.body)}`);
  assert.equal(resp.body?.message, texto, `🔴 ${quien}: el mensaje no es el texto aprobado`);
  assert.deepEqual(escrituras, [], `🔴 ${quien}: escribió antes de rechazar: ${escrituras.join(', ')}`);
}

test('SCRUM-887c · 🔴 A2: POST /quote/create con un C → 400 con L1 y CERO escrituras', async () => {
  const escrituras = [];
  prismaDeDoble(null, escrituras);
  const resp = await invocar('modules/quotes/app/routes/quotes.routes.js', 'post', '/create', {
    merchantId: 7, params: {}, query: {}, headers: {},
    body: { merchant_id: 7, customer_id: 2, currency: 'EUR', lines: C3, discountGlobalAmount: 25 },
  });
  exigirRechazo(resp, 400, L1, escrituras, '/quote/create');
  assert.equal(resp.body.error, CODIGO, '🔴 /quote/create: el rechazo no lleva su código');
});

test('SCRUM-887c · ✅ CONTROL: POST /quote/create con el mismo presupuesto en UN IVA sí llega a guardar', async () => {
  const escrituras = [];
  prismaDeDoble(null, escrituras);
  await invocar('modules/quotes/app/routes/quotes.routes.js', 'post', '/create', {
    merchantId: 7, params: {}, query: {}, headers: {},
    body: { merchant_id: 7, customer_id: 2, currency: 'EUR', lines: C3_UN_IVA, discountGlobalAmount: 25 },
  }).catch(() => null);
  assert.ok(escrituras.includes('$transaction'), `🔴 CIEGO: sin C tampoco llega a guardar (${escrituras.join(', ') || 'nada'})`);
});

test('SCRUM-887c · 🔴 A2: POST /admin/quotes/:id/revisiones sobre un C → 400 con L2r y CERO escrituras', async () => {
  const escrituras = [];
  prismaDeDoble(quoteC({ signatureUrl: 'data:image/png;base64,FIRMA' }), escrituras);
  moduloPrisma.prisma.quote.findMany = async () => [{ id: 7, revision: 0, signatureUrl: 'data:image/png;base64,FIRMA' }];
  const resp = await invocar('modules/system/app/routes/quotesAdmin.routes.js', 'post', '/:id/revisiones',
    { params: { id: '7' }, body: {}, merchantId: 7, query: {}, headers: {} });
  exigirRechazo(resp, 400, L2R, escrituras, '/revisiones');
  assert.equal(resp.body.error, CODIGO, '🔴 /revisiones: el rechazo no lleva su código');
});

test('SCRUM-887c · 🔴 A3: facturar un C desde el panel → 409 con L2, en las TRES rutas del profesional', async () => {
  const casos = [
    ['modules/system/app/routes/quotesAdmin.routes.js', '/:id/invoice', { params: { id: '7' }, body: {} }, quoteC()],
    ['modules/system/app/routes/quotesAdmin.routes.js', '/:id/invoice-manual', { params: { id: '7' }, body: {} }, quoteC({ paymentTerms: 'MANUAL' })],
    ['modules/jobs/app/routes/jobs.routes.js', '/:id/collect-rest', { params: { id: '3' }, body: {} }, quoteC()],
  ];
  for (const [modulo, ruta, req, quote] of casos) {
    const escrituras = [];
    prismaDeDoble(quote, escrituras);
    const job = { id: 3, merchantId: 7, quoteId: 7, status: 'terminado', quote };
    moduloPrisma.prisma.job = { findFirst: async () => job, findUnique: async () => job, update: async () => { escrituras.push('job.update'); } };
    const resp = await invocar(modulo, 'post', ruta, { ...req, merchantId: 7, query: {}, headers: {} });
    exigirRechazo(resp, 409, L2, escrituras, ruta);
    assert.equal(resp.body.error, CODIGO, `🔴 ${ruta}: el rechazo no lleva su código`);
  }
});

test('SCRUM-887c · 🔴 A3: el CLIENTE que acepta un C lee el copy público ya aprobado (L3) y no se emite nada', async () => {
  const escrituras = [];
  // `status: 'sent'`: con 'accepted' la ruta corta por idempotencia (medido en scrum263).
  prismaDeDoble(quoteC({ status: 'sent', decisionToken: 'abc887', validUntil: null }), escrituras);
  // La aceptación SÍ se escribe (su firma vale); lo que no puede escribirse es la factura.
  moduloPrisma.prisma.quote.update = async () => quoteC({ status: 'accepted' });
  moduloPrisma.prisma.$transaction = async (cb) => {
    escrituras.push('$transaction');
    throw new Error('no debería abrir la transacción de emisión');
  };
  const resp = await invocar('modules/quotes/app/routes/quotes.routes.js', 'post', '/:token/decision',
    { params: { token: 'abc887' }, body: { decision: 'accept' }, query: {}, headers: {}, ip: '127.0.0.1' });
  assert.equal(resp?.code, 409, `🔴 C1: respondió ${resp?.code} — ${JSON.stringify(resp?.body)}`);
  assert.equal(resp.body.error, ERROR_SIN_LINEAS);
  assert.equal(resp.body.message, COPY_PUBLICO_SIN_LINEAS, '🔴 C1: el cliente no lee el copy público aprobado');
  assert.ok(!escrituras.includes('$transaction') && !escrituras.includes('invoice.create'),
    `🔴 C1: se intentó emitir: ${escrituras.join(', ')}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// A1 · EL EDITOR
// ═════════════════════════════════════════════════════════════════════════════════════════════

const quoteDescuentos = requiere(path.join(RAIZ, 'public/dashboard/js/quoteDescuentos.js'));

test('SCRUM-887c · 🔴 A1: la pieza del editor reconoce C igual que el servidor, y su texto es L1', () => {
  assert.equal(typeof quoteDescuentos.descuentoGlobalConVariosIva, 'function', '🔴 el editor no tiene con qué reconocer un C');
  assert.equal(quoteDescuentos.TEXTO_DESCUENTO_GLOBAL_VARIOS_IVA, L1, '🔴 el editor no dice L1');
  // Misma respuesta que el servidor en una muestra fija. Las líneas sin precio se excluyen: el
  // editor no las envía (`payloadLines`), así que nunca llegan a divergir.
  let s = 88703;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  let c = 0;
  for (let i = 0; i < 3000; i++) {
    const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, j) => {
      const l = { concept: `L${j}`, qty: pick([1, 2, 0.5, 7]), price: pick([10, 0.01, 99.99, 1000]), tax: pick([0.21, 0.10, 0.04, 0]) };
      if (rand() < 0.3) l.dto = pick([10, 50, 100]);
      if (rand() < 0.1) return { concept: 'CAB', apartado: true };
      return l;
    });
    const global = pick([null, 0, 0.01, 25, 5000]);
    const servidor = piezas.tieneDescuentoGlobalConVariosIva({ lines, discountGlobalAmount: global });
    const editor = quoteDescuentos.descuentoGlobalConVariosIva(lines, global);
    if (servidor) c++;
    assert.equal(editor, servidor, `🔴 caso ${i}: editor ${editor} y servidor ${servidor} — ${JSON.stringify({ lines, global })}`);
  }
  assert.ok(c > 300, `🔴 CIEGO: sólo ${c} casos C en la muestra`);
});

test('SCRUM-887c · 🔴 A1: el editor comprueba C ANTES de crear el presupuesto, y lo dice con setAlert', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8');
  const sf = ts.createSourceFile('quotesView.js', fuente, ts.ScriptTarget.Latest, true);
  const llamadas = [];
  (function rec(n) {
    if (ts.isCallExpression(n)) llamadas.push(n);
    n.forEachChild(rec);
  })(sf);
  const texto = (n) => n.expression.getText(sf);
  const crear = llamadas.filter((n) => texto(n) === 'createQuote');
  assert.equal(crear.length, 1, `🔴 CIEGO: esperaba UNA llamada a createQuote y hay ${crear.length}`);
  const comprueba = llamadas.filter((n) => /\.descuentoGlobalConVariosIva$/.test(texto(n)));
  assert.ok(comprueba.length >= 1, '🔴 el editor no comprueba el caso C');
  const antes = comprueba.filter((n) => n.getStart(sf) < crear[0].getStart(sf));
  assert.ok(antes.length >= 1, '🔴 el editor comprueba C DESPUÉS de crear el presupuesto');
  // El aviso usa el texto de la pieza, no una copia a mano.
  const avisa = llamadas.filter((n) => texto(n) === 'setAlert'
    && n.arguments.some((a) => /TEXTO_DESCUENTO_GLOBAL_VARIOS_IVA$/.test(a.getText(sf))));
  assert.ok(avisa.length >= 1 && avisa[0].getStart(sf) < crear[0].getStart(sf),
    '🔴 el editor no enseña L1 (desde la pieza) antes de crear el presupuesto');
});

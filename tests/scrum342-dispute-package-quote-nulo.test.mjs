// tests/scrum342-dispute-package-quote-nulo.test.mjs — SCRUM-342
//
// Fija LAS DOS CARAS de GET /admin/invoices/:id/dispute-package tras quitar el `as any` de
// `const quote = invoice.quote` (invoicesAdmin.routes.ts:143). El `as any` apagaba la null-safety de
// tsc justo en el camino por donde SCRUM-289 (factura suelta, quote = null) va a hacer circular
// facturas SIN presupuesto. Quitarlo no cambia el comportamiento en runtime —las guardas `quote?.`
// ya estaban—; lo que cambia es que ahora tsc caza un acceso no guardado (demostrado en el PR con una
// sonda: con `as any` compila, sin él → error TS18047 'quote is possibly null').
//
// ESTE test NO distingue `as any` de tipado (a runtime son idénticos, ese es el punto). Su trabajo es
// otro: demostrar que la cara CON presupuesto sigue renderizando igual y que la cara SIN presupuesto
// (quote = null) responde 200 y degrada a «—» en vez de reventar en 500. Es el guard de regresión de
// la null-safety que SCRUM-289 va a estrenar. DIENTES: si se rompe una guarda `quote?.` y la nula
// revienta, la cara B cae a 500 (ver el `catch` del handler) — demostrado en rojo en el PR.
//
// CÓMO (patrón de SCRUM-263/308): router REAL del `dist`, handler de negocio invocado con un `res` de
// doble y `prisma` SUSTITUIDO (mutando el objeto exportado). Sin BD, sin turno. Se salta `requireRole`
// porque se invoca solo el ÚLTIMO handler de la capa.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const RUTA = 'modules/system/app/routes/invoicesAdmin.routes.js';

const routerDe = (mod) => mod.default?.default ?? mod.default;

/** Invoca el handler de negocio (el último de la capa) de una ruta real y devuelve lo que respondió. */
async function invocar(rutaModulo, metodo, ruta, req) {
  const router = routerDe(await import(DIST + rutaModulo));
  assert.ok(Array.isArray(router?.stack),
    `🔴 no se pudo leer el router de ${rutaModulo}: sin su stack no se invoca nada (SUELO)`);
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.[metodo]);
  assert.ok(capa,
    `🔴 no existe ${metodo.toUpperCase()} ${ruta} en ${rutaModulo}. Si se renombró, este test dejaría ` +
    'de comprobar nada y pasaría en verde: por eso FALLA aquí (SUELO).');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; }, type() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

// Un presupuesto COMPLETO con todo lo que el paquete de disputa renderiza (firma, evidencia, canal).
const quoteCompleto = {
  id: 7, quoteNumber: 42, total: '250.00', currency: 'EUR',
  acceptedAt: new Date('2026-07-01T10:00:00Z'), decisionChannel: 'whatsapp',
  decisionComment: 'De acuerdo, adelante', signatureUrl: 'https://cdn.example/sig-7.png',
  evidence: { ts: '2026-07-01T10:00:00Z', ip: '203.0.113.9', ua: 'Mozilla', method: 'draw', typedName: null },
};

/** Una factura con `quote` puesto o a null (la factura suelta de SCRUM-289). */
const facturaCon = (quote) => ({
  id: 11, merchantId: 7, number: '2026-CF-0007', currency: 'EUR', status: 'paid',
  createdAt: new Date('2026-07-02T09:00:00Z'), paidAt: new Date('2026-07-03T12:00:00Z'),
  total: '250.00', quoteId: quote ? 7 : null, chargeId: 5,
  merchant: { name: 'QA', legalName: 'QA SL', taxId: 'B1234', address: 'Calle X 1' },
  customer: { id: 2, name: 'Cliente Final', phone: '34000000001', email: 'c@x.com' }, // rango imposible (SCRUM-262)
  charge: { id: 5, method: 'card', intentId: 'pi_1', reference: 'ref', status: 'succeeded' },
  quote,
});

const ORIG = {};
function sustituirPrisma(factura) {
  for (const k of ['invoice', 'whatsAppMessage']) ORIG[k] = moduloPrisma.prisma[k];
  moduloPrisma.prisma.invoice = { findFirst: async () => factura };
  moduloPrisma.prisma.whatsAppMessage = { findMany: async () => [] };
}
function restaurarPrisma() { for (const k of Object.keys(ORIG)) moduloPrisma.prisma[k] = ORIG[k]; }

const disputePackage = (id = '11') =>
  invocar(RUTA, 'get', '/:id/dispute-package', { params: { id }, merchantId: 7 });

// ─── CARA A · CON presupuesto: renderiza igual que siempre ────────────────────────────────────────
test('SCRUM-342 · dispute-package CON presupuesto → 200 y renderiza número, importe, firma y evidencia', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(facturaCon(quoteCompleto));
  const r = await disputePackage();
  assert.equal(r.code, 200, `esperaba 200 y fue ${r.code}: ${JSON.stringify(r.body).slice(0, 200)}`);
  const html = String(r.body);
  assert.match(html, /#42/, 'el número de presupuesto (#42) debe salir');
  assert.match(html, /250\.00 EUR/, 'el importe del presupuesto debe salir');
  assert.match(html, /class="sig"/, 'la firma (imagen) debe renderizarse cuando hay signatureUrl');
  assert.match(html, /203\.0\.113\.9/, 'la evidencia técnica (IP) debe salir');
});

// ─── CARA B · SIN presupuesto (factura suelta, quote = null): degrada, NO revienta ────────────────
test('SCRUM-342 · dispute-package SIN presupuesto (quote=null) → 200, «—» y NO revienta (SCRUM-289)', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(facturaCon(null));
  const r = await disputePackage();
  // Si una guarda `quote?.` se rompiera, el acceso a null lanzaría y el `catch` devolvería 500. 200 = degradó bien.
  assert.equal(r.code, 200, `la factura sin presupuesto NO debe reventar; esperaba 200 y fue ${r.code}: ${JSON.stringify(r.body).slice(0, 200)}`);
  const html = String(r.body);
  assert.match(html, /#—/, 'sin presupuesto, el número debe caer a «—»');
  assert.doesNotMatch(html, /class="sig"/, 'sin presupuesto NO debe haber imagen de firma');
  assert.match(html, /Documento de cobro/, 'el resto del paquete (datos de la factura) sigue renderizando');
});

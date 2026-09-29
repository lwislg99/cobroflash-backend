// tests/scrum1276-decision-no-reabre.test.mjs — SCRUM-1276
//
// 🔴 UN PRESUPUESTO DECIDIDO NO SE REABRE CON EL MISMO ENLACE (Parte L:398, «jamás reabrir»).
//
// Medido por la ruta real: un presupuesto ACEPTADO y facturado se RECHAZABA después — 200,
// `acceptedAt` borrado, historial «rechazado» y un WhatsApp «❌ rechazó» al profesional de un
// trabajo ya cobrado—; y uno rechazado se ACEPTABA. La comprobación de «ya decidido» solo cerraba el
// mismo sentido, y el `update` no llevaba condición de estado.
//
// Por la PUERTA: `POST /quote/:token/decision` de verdad (`dist`), base doblada por
// `_envio-doblado.mjs` y WhatsApp en dry-run (`__waDryRunOutbox`: no sale ni un byte). El doble de
// `quote.update` hace lo que hace Prisma con un `where` que no casa: lanza P2025. ⛔ Sin red ni base.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/quotes/app/routes/quotes.routes.js';
const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const TOKEN = 'b'.repeat(32);
const TEL_PRO = '34000001276'; // rango imposible (SCRUM-262)

function presupuesto(extra = {}) {
  return {
    id: 1276, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1276, revision: 0,
    decisionToken: TOKEN, validUntil: new Date(Date.now() + 10 * 86400000), paymentTerms: 'FULL_UPFRONT',
    tiers: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: new Date(), updatedAt: new Date(),
    // Modo `receipt` (ES sin facturación): el viaje no entra en la emisión, que no es de este ticket.
    merchant: { id: MERCHANT, name: 'Fontanería 1276', legalName: null, taxId: null, country: 'ES',
      whatsappPhone: TEL_PRO, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid' },
    customer: { id: CLIENTE, name: 'Cliente 1276', phone: '34000001277' },
    Invoice: [],
    ...extra,
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** La ruta, con una fila que RECUERDA lo escrito y un `update` fiel a Prisma con `where` de estado. */
function banco(inicial, { lecturaLenta = 0 } = {}) {
  const fila = presupuesto(inicial);
  const log = { updates: 0, eventos: [], escriturasAjenas: [] };
  const ajena = (nombre) => () => { log.escriturasAjenas.push(nombre); return {}; };
  inyectarBase({
    'quote.findUnique': async ({ where }) => {
      if (where.decisionToken === TOKEN) { const foto = copia(fila); await esperar(lecturaLenta); return foto; }
      if (where.id === fila.id) return { status: fila.status };
      return null;
    },
    'quote.update': ({ where, data }) => {
      const permitidos = where?.status?.in;
      if (Array.isArray(permitidos) && !permitidos.includes(fila.status)) {
        throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      }
      log.updates += 1;
      Object.assign(fila, copia(data));
      return copia(fila);
    },
    'customerEvent.create': ({ data }) => { log.eventos.push(data.type); return {}; },
    'invoice.update': ajena('invoice.update'), 'invoice.delete': ajena('invoice.delete'),
    'job.update': ajena('job.update'), 'job.delete': ajena('job.delete'),
  }, [RUTAS, LANDING, '../dist/modules/system/customerEvents.service.js']);
  globalThis.__waDryRunOutbox = [];
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:token/decision');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const decidir = async (body) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() {} };
    await h({ params: { token: TOKEN }, body, headers: {}, ip: '127.0.0.1', socket: {} }, res);
    await esperar(50); // los avisos y el historial son fire-and-forget
    return r;
  };
  const avisosAlPro = () => (globalThis.__waDryRunOutbox || []).filter((m) => m.to === TEL_PRO);
  return { fila, log, decidir, avisosAlPro };
}

// ── 1 y 2 · ACEPTADO (y facturado) + rechazar → nada cambia, nadie se entera ─────────────────────
test('🔴 SCRUM-1276 · 1-2 · aceptado y facturado + reject → 409, no cambia nada y el profesional no recibe nada', async () => {
  const b = banco({ status: 'accepted', acceptedAt: new Date('2026-09-20T10:00:00Z'), jobId: 55,
    Invoice: [{ id: 77, status: 'paid', total: '121.00' }] });
  const r = await b.decidir({ decision: 'reject', reason: 'me lo pienso' });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'quote_already_decided');
  // El texto es el N3 que la landing ya pinta para un aceptado (variante sin fecha), no uno nuevo.
  assert.equal(r.data.message, 'Ya aceptaste este presupuesto. El profesional te informará de los siguientes pasos.');
  assert.equal(b.fila.status, 'accepted', '🔴 un presupuesto ACEPTADO ha pasado a rechazado');
  assert.ok(b.fila.acceptedAt, '🔴 se ha borrado la fecha de aceptación');
  assert.equal(b.log.updates, 0);
  assert.deepEqual(b.log.eventos, [], '🔴 se ha apuntado un rechazo en el historial');
  assert.deepEqual(b.avisosAlPro(), [], '🔴 el profesional ha recibido «rechazó» de un trabajo ya cobrado');
  assert.deepEqual(b.log.escriturasAjenas, [], 'la factura y el Trabajo, intactos');
});

// ── 3 · RECHAZADO + aceptar → no se reabre ────────────────────────────────────────────────────────
test('🔴 SCRUM-1276 · 3 · rechazado + accept → 409, sigue rechazado y conserva su motivo', async () => {
  const b = banco({ status: 'rejected', rejectedAt: new Date('2026-09-20T10:00:00Z'), rejectionReason: 'Muy caro' });
  const r = await b.decidir({ decision: 'accept' });
  assert.equal(r.status, 409);
  assert.equal(b.fila.status, 'rejected', '🔴 un presupuesto RECHAZADO se ha reabierto como aceptado');
  assert.equal(b.fila.rejectionReason, 'Muy caro', '🔴 se ha borrado el motivo del rechazo');
  assert.deepEqual(b.log.eventos, []);
  assert.deepEqual(b.avisosAlPro(), []);
});

// ── 4 y 5 · el MISMO sentido sigue siendo idempotente (200) y no repite nada ─────────────────────
test('SCRUM-1276 · 4-5 · el mismo sentido sobre un estado decidido: 200 idempotente, sin aviso ni historial', async () => {
  const a = banco({ status: 'accepted', acceptedAt: new Date('2026-09-20T10:00:00Z') });
  const ra = await a.decidir({ decision: 'accept' });
  assert.equal(ra.status, 200);
  assert.equal(ra.data.status, 'already_accepted');
  assert.deepEqual([a.log.updates, a.log.eventos.length, a.avisosAlPro().length], [0, 0, 0]);

  const r = banco({ status: 'rejected', rejectedAt: new Date('2026-09-20T10:00:00Z') });
  const rr = await r.decidir({ decision: 'reject' });
  assert.equal(rr.status, 200);
  assert.equal(rr.data.status, 'already_rejected');
  assert.deepEqual([r.log.updates, r.log.eventos.length, r.avisosAlPro().length], [0, 0, 0]);
});

// ── 6 · CONTROL POSITIVO: sin esto, lo de arriba pasaría aunque la ruta rechazara todo ────────────
test('SCRUM-1276 · 6 · control: `sent` + accept y `sent` + reject siguen funcionando como hoy', async () => {
  const a = banco({});
  const ra = await a.decidir({ decision: 'accept' });
  assert.equal(ra.status, 200);
  assert.equal(a.fila.status, 'accepted');
  assert.deepEqual(a.log.eventos, ['quote_accepted']);
  assert.equal(a.avisosAlPro().length, 1, 'el profesional recibe su aviso de aceptación');

  const r = banco({});
  const rr = await r.decidir({ decision: 'reject', reason: 'caro' });
  assert.equal(rr.status, 200);
  assert.equal(r.fila.status, 'rejected');
  assert.deepEqual(r.log.eventos, ['quote_rejected']);
  assert.equal(r.avisosAlPro().length, 1);
});

test('SCRUM-1276 · control: un `draft` sigue decidible (J5: el enlace se copia cuando falla WhatsApp)', async () => {
  const b = banco({ status: 'draft' });
  const r = await b.decidir({ decision: 'accept' });
  assert.equal(r.status, 200);
  assert.equal(b.fila.status, 'accepted');
});

// ── 7 · DOS a la vez sobre el mismo `sent`: una gana, la otra no repite nada ─────────────────────
test('🔴 SCRUM-1276 · 7 · doble toque simultáneo: un solo aviso, una sola entrada en el historial', async () => {
  const b = banco({}, { lecturaLenta: 20 }); // las dos LEEN `sent` antes de que ninguna escriba
  const [x, y] = await Promise.all([b.decidir({ decision: 'accept' }), b.decidir({ decision: 'accept' })]);
  assert.deepEqual([x.status, y.status], [200, 200]);
  assert.equal(b.log.updates, 1, '🔴 las dos peticiones han escrito');
  assert.deepEqual(b.log.eventos, ['quote_accepted'], '🔴 historial duplicado');
  assert.equal(b.avisosAlPro().length, 1, '🔴 el profesional recibe el aviso dos veces');
});

test('🔴 SCRUM-1276 · 7 · aceptar y rechazar a la vez: gana uno y el otro NO lo pisa', async () => {
  const b = banco({}, { lecturaLenta: 20 });
  const [x, y] = await Promise.all([b.decidir({ decision: 'accept' }), b.decidir({ decision: 'reject' })]);
  assert.equal(b.log.updates, 1, '🔴 la segunda decisión ha pisado a la primera');
  assert.ok(['accepted', 'rejected'].includes(b.fila.status));
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  assert.equal(b.avisosAlPro().length, 1);
});

// ── La pantalla: el formulario de rechazo ya no se ofrece sobre un presupuesto decidido ───────────
test('🔴 SCRUM-1276 · GET /pay/quote/:token/reject sobre un ACEPTADO redirige a su estado, no pinta el formulario', async () => {
  const fila = presupuesto({ status: 'accepted', acceptedAt: new Date('2026-09-20T10:00:00Z'), merchant: { ...presupuesto().merchant, brandColor: null } });
  inyectarBase({ 'quote.findUnique': ({ where }) => (where.decisionToken === TOKEN ? copia(fila) : null),
    'quote.findFirst': ({ where }) => (where.decisionToken === TOKEN ? copia(fila) : null) }, [LANDING]);
  const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route && l.route.path === '/quote/:token/reject' && l.route.methods.get);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { redirect: null, body: '' };
  const res = { redirect(u) { r.redirect = u; return res; }, status() { return res; }, setHeader() { return res; }, send(b) { r.body = String(b); return res; } };
  await h({ params: { token: TOKEN } }, res);
  assert.equal(r.redirect, `/pay/quote/${TOKEN}`, '🔴 sobre un presupuesto aceptado se sigue ofreciendo «Enviar rechazo»');
  assert.ok(!/Enviar rechazo/.test(r.body));
});

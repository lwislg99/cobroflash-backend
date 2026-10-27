// A12.2 (EXT3 Ola 12) — Idempotencia de webhooks: el mismo evento DOS veces
// produce UN solo efecto, por proveedor.
//
//  · Stripe pagos + Connect: dedupe por event.id (LRU) — ambos webhooks
//    verifican firma con constructEvent y comparten el helper.
//  · Meta: dedupe por wamid (LRU) en el webhook entrante.
//  · Cadena de dinero (/webhooks/psp, adonde reenvía Connect): un
//    payment.confirmed duplicado NO re-paga — paidAt no cambia y el evento
//    queda registrado como duplicate (integración real, gateada).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import { URL_BANCO } from './_banco-libro.mjs'; // SCRUM-1599h: segundo destino (LIBRO_PG_URL), inerte con el gate de staging
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const DB = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('A12.2a: dedupe por event.id de Stripe (pagos y Connect comparten helper)', async () => {
  const { isDuplicateStripeEvent } = await import('../dist/modules/billing/app/routes/stripe.routes.js');
  const id = 'evt_test_' + crypto.randomBytes(8).toString('hex');
  assert.equal(isDuplicateStripeEvent(id), false, 'primera entrega: procesar');
  assert.equal(isDuplicateStripeEvent(id), true, 'reintento: ACK sin re-aplicar');
  // otros ids no se ven afectados
  assert.equal(isDuplicateStripeEvent(id + '-otro'), false);
});

test('A12.2b: dedupe por wamid de Meta (reintentos del webhook entrante)', async () => {
  const { isDuplicateWamid } = await import('../dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js');
  const id = 'wamid.test_' + crypto.randomBytes(8).toString('hex');
  assert.equal(isDuplicateWamid(id), false, 'primera entrega: procesar');
  assert.equal(isDuplicateWamid(id), true, 'reintento de Meta: ignorar');
  assert.equal(isDuplicateWamid(''), false, 'sin id no bloquea');
});

test('A12.2c: /webhooks/psp — payment.confirmed duplicado NO re-paga (integración)', { skip: !DB && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { internalHeaders } = await import('../dist/core/http/internalAuth.js'); // P0-SEC-1: /webhooks/psp exige el secreto interno
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // merchant + charge efímeros PROPIOS (P3-9, SCRUM-78: antes usaba el merchant
  // demo id=1 — SCRUM-42 lo quemó como placeholder inerte sin customers, esto
  // rompía el test con "Cannot read properties of null"). Sin invoice ligada:
  // probamos la idempotencia del charge, no la cadena de facturación completa.
  const stamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: { name: 'QA Webhook Idempotencia', country: 'ES', email: `qa-a12-2c-${stamp}@test.local`, onboardingCompleted: true },
  });
  const customer = await prisma.customer.create({
    data: { merchantId: merchant.id, name: 'Cliente QA A12.2c', phone: `34603${stamp % 1000000}` },
  });
  const charge = await prisma.charge.create({
    data: {
      merchantId: merchant.id, customerId: customer.id, concept: 'QA idempotencia',
      amount: '10.00', currency: 'EUR', method: 'card', status: 'pending',
    },
  });

  // SCRUM-1614 · la ruta escribe el «Pago recibido» del historial (ENT-3) SIN await: la fila llega DESPUÉS
  // de las dos respuestas (medido: 8 de 20 pasadas a solas). Si cae entre los borrados de la limpieza, el
  // customer.deleteMany tropieza con customer_events_customer_id_fkey; si cae después, la ruta se traga el
  // FK y el proceso aborta al salir. Se espera a ESA fila, por su condición, antes de limpiar. El tope no
  // sincroniza nada: sólo convierte «no llegó nunca» en un rojo con nombre en vez de un test colgado.
  let pagado = false;
  let historial = null;
  const esperarHistorial = () => (historial ??= (async () => {
    const tope = Date.now() + 15_000;
    for (;;) {
      const n = await prisma.customerEvent.count({ where: { customerId: customer.id, type: 'payment_received' } });
      if (n > 0) return n;
      if (Date.now() > tope) throw new Error('el «Pago recibido» del historial no llegó en 15 s');
      await new Promise((r) => setTimeout(r, 20));
    }
  })());

  try {
    const payload = {
      event: 'payment.confirmed', charge_id: charge.id, method: 'card',
      bank_ref: 'pi_qa_' + Date.now(), amount: 10, currency: 'EUR', ts: new Date().toISOString(),
    };
    const post = () => fetch(`${base}/webhooks/psp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...internalHeaders() }, body: JSON.stringify(payload),
    });

    const r1 = await post();
    assert.ok(r1.ok, `primer confirm falló: ${r1.status}`);
    const paid1 = await prisma.charge.findUnique({ where: { id: charge.id }, select: { status: true } });
    assert.equal(paid1.status, 'paid', 'el primer evento debe pagar');
    pagado = true;
    const events1 = await prisma.event.count({ where: { chargeId: charge.id, type: 'paid' } });

    const r2 = await post();
    assert.ok(r2.ok, `reintento debe ACKearse: ${r2.status}`);
    const paid2 = await prisma.charge.findUnique({ where: { id: charge.id }, select: { status: true } });
    assert.equal(paid2.status, 'paid', 'sigue paid, sin des-pagar ni duplicar');
    const dupMarked = await prisma.event.findFirst({
      where: { chargeId: charge.id, type: 'paid' },
      orderBy: { id: 'desc' },
    });
    const events2 = await prisma.event.count({ where: { chargeId: charge.id, type: 'paid' } });
    assert.equal(events2, events1 + 1, 'el duplicado queda REGISTRADO (no silencioso)');
    assert.equal((dupMarked.payload ?? {}).duplicate, true, 'y marcado como duplicate');
    assert.equal(await esperarHistorial(), 1, 'el historial lleva UN «Pago recibido»: el duplicado no añade otro');
    t.diagnostic('duplicado ACK + marcado duplicate, un solo efecto de pago ✓');
  } finally {
    if (pagado) await esperarHistorial().catch(() => {}); // si el try cayó antes, su error es el que se lee
    await prisma.event.deleteMany({ where: { chargeId: charge.id } });
    await prisma.reconciliation.deleteMany({ where: { chargeId: charge.id } }).catch(() => {});
    // por merchantId (no solo chargeId): ensureInvoiceForCharge puede dejar la factura
    // enlazada de formas que no siempre matchean chargeId, y bloquearía el borrado del customer (FK RESTRICT).
    await prisma.invoice.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.customerEvent.deleteMany({ where: { merchantId: merchant.id } }); // recordCustomerEvent (payment_received)
    await prisma.charge.delete({ where: { id: charge.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    server.close();
    await prisma.$disconnect();
  }
});

// SCRUM-1599h (diseño B de SCRUM-1599) · la mutación que tumba el caso de base, CATALOGADA en SCRUM-1599i.
// Va aparte de `MUTACIONES_QUE_ME_TUMBAN` a propósito: el job del meta-guard corre SIN base, el caso sale
// SALTADO en su pasada limpia y eso es CIEGO (PUERTA 1a), no un veredicto. La ejecuta, con el banco PGlite,
// `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs` (forma de SCRUM-1390e). Cada campo, LITERAL.
export const MUTACIONES_CON_BASE = [
  { fichero: "src/modules/billing/app/routes/psp.routes.ts", de: "if (charge.status === 'paid' && body.event === 'payment.confirmed') {", a: "if (false) {", cae: "A12.2c: /webhooks/psp — payment.confirmed duplicado NO re-paga" },
];

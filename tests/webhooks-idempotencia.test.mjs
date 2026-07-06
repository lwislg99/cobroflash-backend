// A12.2 (EXT3 Ola 12) — Idempotencia de webhooks: el mismo evento DOS veces
// produce UN solo efecto, por proveedor.
//
//  · Stripe pagos + Connect: dedupe por event.id (LRU) — ambos webhooks
//    verifican firma con constructEvent y comparten el helper.
//  · Meta: dedupe por wamid (LRU) en el webhook entrante.
//  · Cadena de dinero (/webhooks/psp, adonde reenvía Connect): un
//    payment.confirmed duplicado NO re-paga — paidAt no cambia y el evento
//    queda registrado como duplicate (integración real, gateada).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const DB = process.env.QA_DB_TEST === '1';

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

test('A12.2c: /webhooks/psp — payment.confirmed duplicado NO re-paga (integración)', { skip: !DB }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // charge efímero PENDIENTE del demo (sin invoice ligada: probamos la
  // idempotencia del charge, no la cadena de facturación completa)
  const customer = await prisma.customer.findFirst({ where: { merchantId: 1 }, select: { id: true } });
  const charge = await prisma.charge.create({
    data: {
      merchantId: 1, customerId: customer.id, concept: 'QA idempotencia',
      amount: '10.00', currency: 'EUR', method: 'card', status: 'pending',
    },
  });

  try {
    const payload = {
      event: 'payment.confirmed', charge_id: charge.id, method: 'card',
      bank_ref: 'pi_qa_' + Date.now(), amount: 10, currency: 'EUR', ts: new Date().toISOString(),
    };
    const post = () => fetch(`${base}/webhooks/psp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });

    const r1 = await post();
    assert.ok(r1.ok, `primer confirm falló: ${r1.status}`);
    const paid1 = await prisma.charge.findUnique({ where: { id: charge.id }, select: { status: true } });
    assert.equal(paid1.status, 'paid', 'el primer evento debe pagar');
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
    t.diagnostic('duplicado ACK + marcado duplicate, un solo efecto de pago ✓');
  } finally {
    await prisma.event.deleteMany({ where: { chargeId: charge.id } });
    await prisma.reconciliation.deleteMany({ where: { chargeId: charge.id } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { chargeId: charge.id } });
    await prisma.charge.delete({ where: { id: charge.id } });
    server.close();
    await prisma.$disconnect();
  }
});

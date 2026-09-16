// SCRUM-13 (COBROS-1) + SCRUM-28 (COBROS-2): Job.totalCobrado = SUMA DESDE CERO del
// `total` de las Invoices en estado 'paid' del Quote. Prueba los DOS caminos:
//   (1) webhook de pago → recalcJobCobradoForCharge (tarjeta/MP), suma e idempotencia
//   (2) cobro MANUAL real → updateInvoiceStatusAdmin (Bizum/transferencia) mueve el semáforo
// 1 tramo = 1 Invoice → sin doble conteo; suma desde cero → idempotente.
//
// ⚠️ GATEADO. Dos destinos (SCRUM-876):
//   QA_DB_TEST=1 npm run test:staging                     → staging, por `_staging-db.mjs` (igual que antes)
//   LIBRO_PG_URL=<banco loopback, base *_test> npm test   → el banco desechable que CI levanta para la tanda
//
// SCRUM-876 · el merchant es EFÍMERO (`withMerchant`). Antes era `MERCHANT_ID = 1`, el demo que
// SCRUM-42 quemó a propósito: sobre una base recién creada el primer `create` moría con
// `customers_merchant_id_fkey`, y el test no llegaba a mirar el cobro. Precedente: SCRUM-159.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// SCRUM-876 · el segundo destino NO afloja el primero: con `QA_DB_TEST=1` manda staging y esta
// variable ni se lee. Fail-closed: una URL que no sea loopback + `*_test` hace FALLAR el fichero,
// no saltarlo. Nunca se imprime la URL (SCRUM-226).
const URL_BANCO = process.env.QA_DB_TEST === '1' ? '' : (process.env.LIBRO_PG_URL || '');
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). Este test crea facturas: no se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';
const MARK = '(SCRUM-13 QA) cobro parcial';

test('SCRUM-13/28: totalCobrado = Σ Invoices paid — webhook + manual, idempotente', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { recalcJobCobradoForCharge, recalcJobCobradoForInvoice, estadoCobroFor } = await import('../dist/modules/jobs/domain/job.service.js');
  const { updateInvoiceStatusAdmin } = await import('../dist/modules/system/invoiceAdmin.js');

  // La limpieza la garantiza `withMerchant` (job, invoice, charge, quote y customer cuelgan del
  // merchant), también si un assert revienta a mitad.
  try {
    await withMerchant(prisma, { name: 'QA SCRUM-13', email: `qa-scrum13-${Date.now()}@test.local` }, async (merchant) => {
    const MERCHANT_ID = merchant.id;
    const customer = await prisma.customer.create({ data: { merchantId: MERCHANT_ID, name: 'QA SCRUM-13', notes: MARK } });
    const quote = await prisma.quote.create({ data: {
      merchantId: MERCHANT_ID, customerId: customer.id, total: '100.00', currency: 'EUR',
      lines: [], status: 'accepted', paymentTerms: 'FIFTY_FIFTY', internalNotes: MARK,
    } });
    // 2 tramos 50/50 (cada tramo = 1 Charge + 1 Invoice, como en prod):
    //   tramo A → ya cobrado por tarjeta (webhook): Invoice A 'paid'
    //   tramo B → pendiente; se cobrará MANUAL (Bizum) en el paso 2. El Charge B queda
    //             'pending' a propósito: el cobro manual NO toca el Charge (por eso SCRUM-28).
    const chargeA = await prisma.charge.create({ data: { merchantId: MERCHANT_ID, customerId: customer.id, concept: MARK, amount: '50.00', currency: 'EUR', method: 'card', status: 'paid' } });
    const chargeB = await prisma.charge.create({ data: { merchantId: MERCHANT_ID, customerId: customer.id, concept: MARK, amount: '50.00', currency: 'EUR', method: 'card', status: 'pending' } });
    const invA = await prisma.invoice.create({ data: { merchantId: MERCHANT_ID, customerId: customer.id, quoteId: quote.id, chargeId: chargeA.id, number: `J-QA13A-${Date.now()}`, total: '50.00', currency: 'EUR', pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', clientComment: MARK, status: 'paid' } });
    const invB = await prisma.invoice.create({ data: { merchantId: MERCHANT_ID, customerId: customer.id, quoteId: quote.id, chargeId: chargeB.id, number: `J-QA13B-${Date.now()}`, total: '50.00', currency: 'EUR', pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', clientComment: MARK, status: 'pending' } });
    const job = await prisma.job.create({ data: { merchantId: MERCHANT_ID, customerId: customer.id, quoteId: quote.id, status: 'terminado', totalAceptado: '100.00', totalCobrado: '0', notes: MARK } });

    // (1) WEBHOOK: tramo A cobrado (Invoice A 'paid') → 50 (Parcial)
    await recalcJobCobradoForCharge(chargeA.id);
    let j = await prisma.job.findUnique({ where: { id: job.id }, select: { totalCobrado: true } });
    assert.equal(Number(j.totalCobrado), 50, 'tras el 1er tramo (webhook), totalCobrado = 50 (Parcial)');
    assert.equal(estadoCobroFor(Number(j.totalCobrado), 100), 'Parcial', 'semáforo = Parcial con 50/100');

    // IDEMPOTENCIA webhook: mismo pago otra vez (webhook duplicado) → SIGUE 50, no 100
    await recalcJobCobradoForCharge(chargeA.id);
    j = await prisma.job.findUnique({ where: { id: job.id }, select: { totalCobrado: true } });
    assert.equal(Number(j.totalCobrado), 50, 'IDEMPOTENTE (webhook duplicado): sigue 50');

    // (2) COBRO MANUAL real (Bizum/transferencia): updateInvoiceStatusAdmin marca Invoice B
    //     'paid'. Await explícito del recálculo para determinismo (dentro es fire-and-forget);
    //     es idempotente (suma desde cero), no duplica.
    const upd = await updateInvoiceStatusAdmin(invB.id, 'paid', MERCHANT_ID);
    assert.equal(upd?.status, 'paid', 'sin regresión: updateInvoiceStatusAdmin marcó Invoice B como paid');
    await recalcJobCobradoForInvoice(invB.id);
    j = await prisma.job.findUnique({ where: { id: job.id }, select: { totalCobrado: true } });
    assert.equal(Number(j.totalCobrado), 100, 'tras cobro MANUAL del 2º tramo, totalCobrado = 100 (Pagado)');
    assert.equal(estadoCobroFor(Number(j.totalCobrado), 100), 'Pagado', 'semáforo = Pagado con 100/100');

    // IDEMPOTENCIA manual: re-marcar pagado (updateInvoiceStatusAdmin devuelve __unchanged) → sigue 100
    await updateInvoiceStatusAdmin(invB.id, 'paid', MERCHANT_ID);
    await recalcJobCobradoForInvoice(invB.id);
    j = await prisma.job.findUnique({ where: { id: job.id }, select: { totalCobrado: true } });
    assert.equal(Number(j.totalCobrado), 100, 'IDEMPOTENTE (manual re-marcado): sigue 100');
    assert.equal(estadoCobroFor(0, 100), 'Pendiente', 'semáforo = Pendiente con 0/100');

    console.log('✔ SCRUM-13/28: 50/Parcial (webhook) → idempotente → 100/Pagado (Bizum manual). Σ Invoices paid, desde cero.');
    });
  } finally {
    await prisma.$disconnect();
  }
});

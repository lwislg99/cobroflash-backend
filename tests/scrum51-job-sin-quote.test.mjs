// SCRUM-51: serializeJobDetail devuelve albaranes[] SIEMPRE (Job-owned vía jobId), también para
// un Job manual SIN quoteId. Antes el early-return del quote los dejaba invisibles (bug latente).
//   (a) Job SIN quoteId con un albarán → detail.albaranes tiene el albarán (invoices=[], charge=null).
//   (b) Regresión: Job CON quote + albarán → detail.albaranes sigue igual.
//
// ⚠️ GATEADO (crea/BORRA un merchant efímero; levanta la app):
//   QA_DB_TEST=1 npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-51: el detalle incluye albaranes[] en un Job sin quoteId (y sigue igual con quote)', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: { name: 'QA S51', country: 'ES', email: `qa-s51-${stamp}@test.local`, onboardingCompleted: true },
  });
  const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 51', phone: `34600${stamp % 1000000}` } });

  // (a) Job MANUAL sin quoteId + su albarán
  const jobSinQuote = await prisma.job.create({
    data: { merchantId: merchant.id, customerId: customer.id, status: 'pendiente_agendar', titulo: 'Manual sin quote' },
  });
  await prisma.albaran.create({
    data: { merchantId: merchant.id, jobId: jobSinQuote.id, numero: `ALB-QA51A-${stamp}`, lineas: [{ concepto: 'Visita', cantidad: 1, unidad: 'ud' }], estado: 'emitido' },
  });

  // (b) Job CON quote + su albarán (regresión)
  const quote = await prisma.quote.create({
    data: { merchantId: merchant.id, customerId: customer.id, total: '100.00', currency: 'EUR', lines: [], status: 'accepted' },
  });
  const jobConQuote = await prisma.job.create({
    data: { merchantId: merchant.id, customerId: customer.id, quoteId: quote.id, status: 'terminado', titulo: 'Con quote', totalAceptado: '100.00' },
  });
  await prisma.albaran.create({
    data: { merchantId: merchant.id, jobId: jobConQuote.id, numero: `ALB-QA51B-${stamp}`, lineas: [{ concepto: 'Obra', cantidad: 1, unidad: 'ud' }], estado: 'emitido' },
  });

  const mkCookie = async () => {
    const token = 'qa51-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  try {
    const cookie = await mkCookie();

    // (a) Job SIN quote → albaranes[] presente (bug SCRUM-51 corregido); invoices=[]/charge=null
    const detailSin = await (await fetch(`${base}/admin/jobs/${jobSinQuote.id}`, { headers: { cookie } })).json();
    assert.ok(Array.isArray(detailSin.albaranes) && detailSin.albaranes.length === 1, 'Job sin quote: el detalle incluye su albarán');
    assert.equal(detailSin.albaranes[0].numero, `ALB-QA51A-${stamp}`, 'es el albarán correcto');
    assert.deepEqual(detailSin.invoices, [], 'sin quote → sin facturas');
    assert.equal(detailSin.charge, null, 'sin quote → sin charge');

    // (b) Job CON quote → albaranes[] sigue presente (regresión)
    const detailCon = await (await fetch(`${base}/admin/jobs/${jobConQuote.id}`, { headers: { cookie } })).json();
    assert.ok(Array.isArray(detailCon.albaranes) && detailCon.albaranes.length === 1, 'Job con quote: albaranes[] sin regresión');
    assert.equal(detailCon.albaranes[0].numero, `ALB-QA51B-${stamp}`);

    console.log('✔ SCRUM-51: albaranes[] presente en Job sin quote y con quote.');
  } finally {
    await prisma.albaran.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.job.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.quote.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.authSession.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    server.close();
    await prisma.$disconnect();
  }
});

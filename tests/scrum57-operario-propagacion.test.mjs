// SCRUM-57: el detalle del Trabajo propaga la autoría del operario (job.operario, ya en el
// serializer tras SCRUM-22) también al `charge` y a cada `albaranes[]`. Cubre la propagación que
// entró en main (jobs.routes.ts:148/161) pero que no tenía test gateado. Owner (operario null) → null.
//
// ⚠️ GATEADO (crea/BORRA un merchant efímero; levanta la app):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60/64: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import http from 'node:http';

// `node:http` sin agente y no `fetch` (SCRUM-1218d): `fetch` contra un servidor propio puede
// abortar el proceso al salir (SCRUM-560). Devuelve lo que este fichero lee de la respuesta de `fetch`
// (status, headers.get, text, json) y, como el `redirect: 'manual'` de antes, no sigue redirecciones.
const pedirSinAgente = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const cabeceras = { ...headers };
  if (body !== undefined) cabeceras['content-length'] = Buffer.byteLength(body);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: cabeceras, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => ok({
      status: r.statusCode,
      headers: { get: (n) => { const v = r.headers[n.toLowerCase()]; return v === undefined ? null : [].concat(v).join(', '); } },
      text: async () => d,
      json: async () => JSON.parse(d),
    }));
  });
  req.on('error', mal);
  req.end(body);
});

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-57: operario:{id,name} propagado a job + charge + albaranes en el detalle (owner→null)', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: el merchant y TODO su montaje dentro de withMerchant; antes nacían fuera del
  // try, así que un fallo montando el operario, el cliente o el cobro los dejaba huérfanos.
  try {
    await withMerchant(prisma, { name: 'QA S57', email: `qa-s57-${stamp}@test.local` }, async (merchant) => {
  const operario = await prisma.teamMember.create({
    data: { merchantId: merchant.id, name: 'María García', email: `qa-s57-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });
  const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 57', phone: `34600${stamp % 1000000}` } });
  const charge = await prisma.charge.create({
    data: { merchantId: merchant.id, customerId: customer.id, concept: 'QA S57', amount: '100.00', currency: 'EUR', method: 'card', status: 'paid' },
  });
  // Quote creado por el operario + enlazado a su charge (para que el detalle exponga charge.operario).
  const quote = await prisma.quote.create({
    data: { merchantId: merchant.id, customerId: customer.id, total: '100.00', currency: 'EUR', lines: [], status: 'accepted', teamMemberId: operario.id, chargeId: charge.id },
  });
  const jobWith = await prisma.job.create({
    data: { merchantId: merchant.id, customerId: customer.id, quoteId: quote.id, status: 'terminado', titulo: 'Con operario', operarioId: operario.id },
  });
  await prisma.albaran.create({
    data: { merchantId: merchant.id, jobId: jobWith.id, numero: `ALB-QA57-${stamp}`, lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'h' }], estado: 'emitido' },
  });
  // Owner: Trabajo del propietario (operarioId null).
  const jobOwner = await prisma.job.create({
    data: { merchantId: merchant.id, customerId: customer.id, status: 'pendiente_agendar', titulo: 'Sin operario', operarioId: null },
  });

  const mkCookie = async () => {
    const token = 'qa57-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await pedirSinAgente(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };
  const expected = { id: operario.id, name: 'María García' };

    const cookie = await mkCookie();

    // Detalle del Trabajo CON operario → propagación a job + charge + albaranes
    const detail = await (await pedirSinAgente(`${base}/admin/jobs/${jobWith.id}`, { headers: { cookie } })).json();
    assert.deepEqual(detail.operario, expected, 'job.operario resuelto {id,name}');
    assert.ok(detail.charge, 'el detalle trae el charge (quote enlazado)');
    assert.deepEqual(detail.charge.operario, expected, 'charge.operario propagado');
    assert.ok(Array.isArray(detail.albaranes) && detail.albaranes.length === 1, 'un albarán en el detalle');
    assert.deepEqual(detail.albaranes[0].operario, expected, 'albaranes[].operario propagado');

    // Owner (operarioId null) → operario null
    const ownerDetail = await (await pedirSinAgente(`${base}/admin/jobs/${jobOwner.id}`, { headers: { cookie } })).json();
    assert.equal(ownerDetail.operario, null, 'Trabajo del propietario → operario null');

    console.log('✔ SCRUM-57: operario propagado a job + charge + albaranes; owner → null.');
    });
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});

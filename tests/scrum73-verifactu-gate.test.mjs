// SCRUM-73 — GET /admin/exports/verifactu.xml: gate a INVOICING_ES_ENABLED (reglas 24/26)
// + requireRole('admin') (S1, patrón SCRUM-54). El técnico→403 general ya lo cubre el
// recorrido de ADMIN_ONLY_ROUTES en tests/tenancy-permisos.test.mjs; aquí se blinda el
// caso ESPECÍFICO del ticket: con el flag OFF, CERO registros salen aunque existan
// facturas reales del merchant (regresión a prueba de reverts silenciosos).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-73: verifactu.xml — técnico 403, flag OFF sin registros, flag ON genera', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: el merchant y su montaje dentro de withMerchant; antes nacían fuera del try.
  try {
    await withMerchant(prisma, {
      name: 'QA VeriFactu Gate', taxId: `B${String(stamp).slice(-8)}`,
      email: `qa-vf-gate-${stamp}@test.local`,
    }, async (merchant) => {
  const tecnico = await prisma.teamMember.create({
    data: { merchantId: merchant.id, name: 'QA Técnico', email: `qa-vf-tec-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });
  const customer = await prisma.customer.create({
    // SCRUM-248: `taxId` OBLIGATORIO. Sin NIF, SCRUM-215 excluye la factura del registro
    // (AEAT 1189: una F1 sin `Destinatarios` se rechaza) y el export devuelve 409. Este test
    // dice simular «una factura F1 REAL con huella»: una F1 real lleva destinatario identificado.
    data: { merchantId: merchant.id, name: 'Cliente QA VF', taxId: 'A11111111', phone: `34602${stamp % 1000000}` },
  });
  // Factura F1 REAL con huella — si el gate se rompiera, esto es justo lo que se filtraría.
  const invoice = await prisma.invoice.create({
    data: {
      merchantId: merchant.id, customerId: customer.id, number: `2026-QA-${stamp % 1000}`,
      total: '121.00', currency: 'EUR', type: 'F1', status: 'paid',
      lines: [{ concept: 'Servicio QA', qty: 1, price: 100, tax: 0.21 }],
      // SCRUM-205: `sellado` porque este fixture YA escribe `vfHash` — el estado dice lo mismo
      // que la huella. Este test necesita una factura DENTRO de la cadena: es lo que exporta.
      vfHash: 'HASH_QA_TEST', vfPrevHash: '', vfEstado: 'sellado',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
    },
  });

  const mkCookie = async (teamMemberId = null) => {
    const token = 'qa73-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchant.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

    const cookieAdmin = await mkCookie(null);
    const cookieTecnico = await mkCookie(tecnico.id);
    const url = `${base}/admin/exports/verifactu.xml`;

    // 1) Técnico → 403 (requireRole('admin') corre ANTES de mirar el flag)
    const rTec = await fetch(url, { headers: { cookie: cookieTecnico } });
    assert.equal(rTec.status, 403, `técnico debería ser 403 y fue ${rTec.status}`);

    // 2) Admin, flag OFF (default hoy) → 404 neutro, CERO registros, aunque exista la factura F1 real.
    const rOff = await fetch(url, { headers: { cookie: cookieAdmin } });
    assert.equal(rOff.status, 404, `admin con flag OFF debería ser 404 y fue ${rOff.status}`);
    const bodyOff = await rOff.text();
    assert.doesNotMatch(bodyOff, /RegistroAlta/, 'con el flag OFF NO debe generarse ningún registro — SuministroInformacion.xsd:37: RegistroAlta es el ELEMENTO; RegistroFacturacionAlta es el TIPO y no aparece en el XML');
    assert.doesNotMatch(bodyOff, new RegExp(invoice.number), 'con el flag OFF la factura real no debe filtrarse en ningún body');

    // 3) Admin, flag ON (override por merchant — no toca el env global) → genera el XML real.
    await prisma.merchant.update({ where: { id: merchant.id }, data: { flags: { INVOICING_ES_ENABLED: true } } });
    const rOn = await fetch(url, { headers: { cookie: cookieAdmin } });
    assert.equal(rOn.status, 200, `admin con flag ON debería ser 200 y fue ${rOn.status}`);
    assert.match(rOn.headers.get('content-type') || '', /application\/xml/);
    const bodyOn = await rOn.text();
    assert.match(bodyOn, /RegistroAlta/, 'SuministroInformacion.xsd:37 — RegistroAlta es el ELEMENTO; RegistroFacturacionAlta es el TIPO y no aparece en el XML');
    assert.match(bodyOn, new RegExp(invoice.number), 'la factura real SÍ debe aparecer con el flag ON');
    });
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});

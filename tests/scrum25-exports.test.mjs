// SCRUM-25 (EXPORT-1) — parte A/C/D: gate admin de /admin/exports, CSVs nuevos
// (cobros/trabajos), base+IVA en facturas.csv, rango de fechas y audit.
//
// ⚠️ El ZIP (punto B) NO entra aquí: depende de la dependencia `archiver`, pendiente
// del OK del fundador (regla 36). Sus tests llegan con él.
//
// S1: exportar es acción de ADMIN — hoy un Operario podía bajarse clientes.csv con
// teléfonos y emails de TODOS los clientes finales.
//
// Datos EFÍMEROS propios con limpieza en el finally — nunca el seed demo (SCRUM-63).
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros; levanta la app in-process):
//   QA_DB_TEST=1 npm test
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-25: exports admin-only, CSVs nuevos, base+IVA, rango y audit', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const mkMerchant = (tag) =>
    prisma.merchant.create({
      data: { name: `QA S25 ${tag}`, country: 'ES', email: `qa-s25-${tag}-${stamp}@test.local`, onboardingCompleted: true },
    });
  const merchantA = await mkMerchant('A');
  const merchantB = await mkMerchant('B'); // vecino: sus datos NO pueden salir en el export de A

  const tecnicoA = await prisma.teamMember.create({
    data: {
      merchantId: merchantA.id, name: 'QA Tec S25',
      email: `qa-s25-tec-${stamp}@test.local`, role: 'tecnico', status: 'active',
    },
  });

  const custA = await prisma.customer.create({
    data: { merchantId: merchantA.id, name: 'Cliente S25 A', phone: '34600000025', email: 'cliente-s25@test.local' },
  });
  const custB = await prisma.customer.create({
    data: { merchantId: merchantB.id, name: 'VECINO NO DEBE SALIR', phone: '34699999999' },
  });

  // Factura de A con líneas 100 € + 21 % → base 100,00 · IVA 21,00 · total 121,00
  const numero = `${new Date().getFullYear()}-CF-${String(700 + (stamp % 90)).padStart(3, '0')}`;
  await prisma.invoice.create({
    data: {
      merchantId: merchantA.id, customerId: custA.id, number: numero,
      total: '121.00', currency: 'EUR', type: 'F1',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
      lines: [{ concept: 'Obra QA S25', qty: 1, price: 100, tax: 0.21 }],
    },
  });

  const chargeA = await prisma.charge.create({
    data: {
      merchantId: merchantA.id, customerId: custA.id, concept: 'Cobro QA S25',
      amount: '121.00', currency: 'EUR', method: 'bizum_manual', status: 'paid', reference: 'REF-S25',
    },
  });
  await prisma.charge.create({
    data: {
      merchantId: merchantB.id, customerId: custB.id, concept: 'COBRO VECINO',
      amount: '9999.00', currency: 'EUR', method: 'card', status: 'paid',
    },
  });

  const jobA = await prisma.job.create({
    data: {
      merchantId: merchantA.id, customerId: custA.id, status: 'en_curso',
      titulo: 'Trabajo QA S25', operarioId: tecnicoA.id,
      totalAceptado: '1000.00', totalCobrado: '250.00',
    },
  });

  const mkCookie = async (merchantId, teamMemberId = null) => {
    const token = 'qa25-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  const CSVS = ['customers.csv', 'invoices.csv', 'quotes.csv', 'expenses.csv', 'charges.csv', 'jobs.csv'];

  try {
    const cookieAdmin = await mkCookie(merchantA.id, null);
    const cookieTecnico = await mkCookie(merchantA.id, tecnicoA.id);
    const get = (path, cookie) => fetch(`${base}${path}`, { headers: { cookie } });

    // ── (A) S1: el TÉCNICO no exporta NADA ─────────────────────────────────
    for (const f of CSVS) {
      const res = await get(`/admin/exports/${f}`, cookieTecnico);
      assert.equal(res.status, 403, `FUGA S1: el técnico pudo bajarse ${f} (${res.status})`);
    }
    // y el admin sí
    for (const f of CSVS) {
      const res = await get(`/admin/exports/${f}`, cookieAdmin);
      assert.equal(res.status, 200, `el admin debe poder exportar ${f} (${res.status})`);
    }

    // ── BOM UTF-8 (que Excel lo abra bien) ─────────────────────────────────
    // OJO: Response.text() DESCARTA el BOM al decodificar (spec WHATWG), así que hay
    // que mirar los bytes crudos: EF BB BF.
    const bytes = Buffer.from(await (await get('/admin/exports/customers.csv', cookieAdmin)).arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf],
      'clientes.csv debe empezar con BOM UTF-8 (si no, Excel rompe los acentos)');
    const clientes = bytes.toString('utf8');

    // ── (C) facturas.csv con BASE e IVA desglosados ────────────────────────
    const facturas = await (await get('/admin/exports/invoices.csv', cookieAdmin)).text();
    const headerLine = facturas.split('\r\n')[0];
    assert.ok(headerLine.includes('Base') && headerLine.includes('IVA'), 'facturas.csv debe traer columnas Base e IVA');
    const facturaRow = facturas.split('\r\n').find((l) => l.includes(numero));
    assert.ok(facturaRow, 'la factura de QA debe aparecer');
    // SCRUM-86: los importes salen con COMA decimal (formato ES). Ver el contrato
    // completo en scrum86-csv-formato.test.mjs.
    assert.ok(facturaRow.includes('100,00') && facturaRow.includes('21,00') && facturaRow.includes('121,00'),
      `base/IVA/total mal desglosados: ${facturaRow}`);

    // ── (C) cobros.csv con paid_via ────────────────────────────────────────
    const cobros = await (await get('/admin/exports/charges.csv', cookieAdmin)).text();
    assert.ok(cobros.split('\r\n')[0].includes('paid_via'), 'cobros.csv debe exponer el método como paid_via');
    const cobroRow = cobros.split('\r\n').find((l) => l.includes('REF-S25'));
    assert.ok(cobroRow && cobroRow.includes('bizum_manual'), `falta el paid_via del cobro: ${cobroRow}`);

    // ── (C) trabajos.csv con operario y semáforo ───────────────────────────
    const trabajos = await (await get('/admin/exports/jobs.csv', cookieAdmin)).text();
    const jobRow = trabajos.split('\r\n').find((l) => l.includes('Trabajo QA S25'));
    assert.ok(jobRow, 'el trabajo de QA debe aparecer');
    assert.ok(jobRow.includes('QA Tec S25'), 'trabajos.csv debe traer el nombre del operario');
    assert.ok(jobRow.includes('750,00'), 'pendiente = 1000 - 250'); // SCRUM-86: coma decimal
    assert.ok(jobRow.includes('Parcial'), 'estado de cobro derivado (mismo semáforo que la app)');

    // ── TENANCY (regla 2): nada del merchant vecino ────────────────────────
    // ⚠️ El canario del importe se comprueba en LAS DOS grafías a propósito: al pasar a
    // coma decimal (SCRUM-86), un canario clavado en '9999.00' dejaría de coincidir nunca
    // y la comprobación de tenancy pasaría en vacío sin que nadie se enterase.
    for (const [f, body] of [['clientes', clientes], ['cobros', cobros], ['trabajos', trabajos]]) {
      assert.ok(!body.includes('VECINO NO DEBE SALIR') && !body.includes('COBRO VECINO')
        && !body.includes('9999,00') && !body.includes('9999.00'),
        `TENANCY ROTA: ${f}.csv incluye datos de otro merchant`);
    }

    // ── (C) el RANGO filtra de verdad (ventana pasada → sin filas) ─────────
    const vacio = await (await get('/admin/exports/customers.csv?from=2000-01-01&to=2000-12-31', cookieAdmin)).text();
    assert.ok(!vacio.includes('Cliente S25 A'), 'el rango de fechas debe filtrar en clientes.csv');

    // ── (D) AUDIT: cada descarga deja traza ────────────────────────────────
    const audits = await prisma.auditLog.findMany({
      where: { merchantId: merchantA.id, action: 'datos_exportados' },
      orderBy: { id: 'desc' },
    });
    assert.ok(audits.length > 0, 'exportar debe dejar registro datos_exportados');
    const ficheros = new Set(audits.map((a) => (a.meta || {}).fichero));
    for (const esperado of ['clientes.csv', 'facturas.csv', 'cobros.csv', 'trabajos.csv']) {
      assert.ok(ficheros.has(esperado), `falta traza de audit para ${esperado}`);
    }

    t.diagnostic(`gate S1 (${CSVS.length} CSVs · técnico 403) ✓ · base+IVA ✓ · paid_via ✓ · operario ✓ · tenancy ✓ · rango ✓ · audit ✓`);
  } finally {
    for (const m of [merchantA, merchantB]) {
      await prisma.auditLog.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.authSession.deleteMany({ where: { merchantId: m.id } });
      await prisma.job.deleteMany({ where: { merchantId: m.id } });
      await prisma.invoice.deleteMany({ where: { merchantId: m.id } });
      await prisma.charge.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.teamMember.deleteMany({ where: { merchantId: m.id } });
    }
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantA.id, merchantB.id] } } });
    server.close();
    await prisma.$disconnect();
  }
});

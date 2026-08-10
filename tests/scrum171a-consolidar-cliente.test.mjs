// SCRUM-171a — emitir la recapitulativa a ámbito CLIENTE (la mitad que SCRUM-70 dejó a medias).
//
// Un cliente factura por MES, no por Trabajo: sus albaranes del mes pueden venir de varios
// Trabajos y hasta hoy no había forma de facturarlos juntos. Sin este camino, SCRUM-171
// (periodicidad) no puede existir.
//
// Lo que se protege aquí, por orden de gravedad:
//   1. la ROTURA del art. 13 RD 1619/2012 — jamás una factura que mezcle dos meses naturales;
//   2. FAIL-CLOSED: si uno de los seleccionados no es elegible, no se emite NADA;
//   3. que un albarán a medias (SCRUM-170) NO entre — cobraría dos veces lo ya facturado;
//   4. tenancy: los partes de otro cliente o de otro merchant no existen para esta llamada.
import './_staging-db.mjs'; // SCRUM-60
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';
const LINEAS = [{ concepto: 'Mantenimiento mensual', cantidad: 2, unidad: 'h', precioUnitario: 50, tipoIva: 21 }];

test('SCRUM-171a: consolidar por CLIENTE cruzando Trabajos, con rotura por mes', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  try {
    await withMerchant(
      prisma,
      // Documento fiscal puro: con el flag OFF el merchant emitiría justificantes y la ruta
      // rechazaría (correctamente). El override vive en el merchant EFÍMERO (Parte P).
      {
        name: 'QA S171a', email: `qa-s171a-${stamp}@test.local`, country: 'ES', taxId: 'B12345678',
        flags: { INVOICING_ES_ENABLED: true },
      },
      async (merchant) => {
        const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S171a' } });
        const otro = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Otro cliente' } });

        const mkJob = (customerId, tipoOperacion = 'OPERACIONES_SUELTAS') => prisma.job.create({
          data: { merchantId: merchant.id, customerId, status: 'en_curso', titulo: 'T', tipoOperacion },
        });
        const mkAlb = (jobId, sufijo, fecha, extra = {}) => prisma.albaran.create({
          data: {
            merchantId: merchant.id, jobId, numero: `ALB-QA171-${sufijo}-${stamp % 100000}`,
            fecha: new Date(fecha), estado: 'firmado', modoValoracion: 'VALORADO', lineas: LINEAS, ...extra,
          },
        });

        // DOS Trabajos del MISMO cliente — el caso que la vía de Job no puede facturar junta.
        const jobA = await mkJob(customer.id);
        const jobB = await mkJob(customer.id);
        const enero1 = await mkAlb(jobA.id, 'A1', '2026-01-10T10:00:00Z');
        const enero2 = await mkAlb(jobB.id, 'B1', '2026-01-20T10:00:00Z');
        const febrero = await mkAlb(jobB.id, 'B2', '2026-02-05T10:00:00Z');

        const token = 'qa171a-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const verify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
        const cookie = (verify.headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

        const consolidar = (body) => fetch(`${base}/admin/albaranes/consolidar`, {
          method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });

        // ── EL CASO: 3 partes de 2 Trabajos y 2 meses → 2 facturas ────────
        const r = await consolidar({ customerId: customer.id, albaranIds: [enero1.id, enero2.id, febrero.id] });
        const b = await r.json();
        assert.equal(r.status, 201, `debía emitir; devolvió ${r.status} ${JSON.stringify(b)}`);
        assert.equal(b.facturas.length, 2,
          '🔴 ROTURA DEL ART. 13 ROTA: enero y febrero tienen que salir en facturas DISTINTAS');

        const enFacturas = await prisma.invoice.findMany({ where: { merchantId: merchant.id }, orderBy: { id: 'asc' } });
        assert.equal(enFacturas.length, 2);
        // La de enero lleva los DOS partes de enero, cada uno de un Trabajo distinto.
        const deEnero = enFacturas.find((f) => (f.albaranRefs || []).length === 2);
        assert.ok(deEnero, 'una de las facturas tiene que agrupar los dos partes de enero (de Trabajos distintos)');
        assert.equal(Number(deEnero.total), Number((2 * 2 * 50 * 1.21).toFixed(2)), 'el importe suma los dos partes');

        // Los albaranes quedan marcados: la vía de siempre (`invoiceId`) sigue significando lo mismo.
        for (const id of [enero1.id, enero2.id, febrero.id]) {
          const a = await prisma.albaran.findUnique({ where: { id } });
          assert.ok(a.invoiceId, `el parte ${a.numero} debe quedar marcado como facturado`);
        }

        // ── Re-facturar los mismos → 409, y sin emitir nada ───────────────
        const r2 = await consolidar({ customerId: customer.id, albaranIds: [enero1.id] });
        assert.equal(r2.status, 409, 'un parte ya facturado no se vuelve a facturar');
        assert.equal((await r2.json()).error, 'ya_facturado');
        assert.equal(await prisma.invoice.count({ where: { merchantId: merchant.id } }), 2, 'y no emitió de más');

        // ── FAIL-CLOSED: un no elegible tumba la selección ENTERA ─────────
        const jobUnico = await mkJob(customer.id, 'TRABAJO_UNICO');
        const deObra = await mkAlb(jobUnico.id, 'U1', '2026-03-01T10:00:00Z');
        const marzo = await mkAlb(jobA.id, 'A3', '2026-03-02T10:00:00Z');
        const r3 = await consolidar({ customerId: customer.id, albaranIds: [marzo.id, deObra.id] });
        const b3 = await r3.json();
        assert.equal(r3.status, 409, 'una obra única no se agrupa por meses');
        assert.equal(b3.error, 'obra_unica');
        assert.ok(Array.isArray(b3.descartados) && b3.descartados.length === 1,
          'se devuelven TODOS los descartados, para poder quitarlos de una vez');
        assert.equal(await prisma.invoice.count({ where: { merchantId: merchant.id } }), 2,
          '🔴 FAIL-CLOSED ROTO: se emitió el parte válido pese a que otro de la selección no lo era');

        // ── Un parte de OTRO cliente no entra (aunque sea del mismo merchant) ──
        const jobOtro = await mkJob(otro.id);
        const delOtro = await mkAlb(jobOtro.id, 'O1', '2026-03-03T10:00:00Z');
        const r4 = await consolidar({ customerId: customer.id, albaranIds: [marzo.id, delOtro.id] });
        assert.equal(r4.status, 409);
        assert.equal((await r4.json()).error, 'otro_cliente');

        // ── SCRUM-170: el parte a MEDIAS tampoco entra ────────────────────
        await prisma.albaranLineaFacturada.create({
          data: { merchantId: merchant.id, albaranId: marzo.id, lineaIndex: 0, invoiceId: enFacturas[0].id, cantidad: 1 },
        });
        const r5 = await consolidar({ customerId: customer.id, albaranIds: [marzo.id] });
        assert.equal(r5.status, 409,
          '🔴 DOBLE FACTURACIÓN: un parte con líneas ya facturadas no lleva `invoiceId`, así que sin ' +
          'su motivo propio se colaría entero en la recapitulativa.');
        assert.equal((await r5.json()).error, 'facturado_parcial');

        t.diagnostic(`2 facturas por rotura de mes · fail-closed · a medias fuera · ${b.facturas.map((f) => f.number).join(' + ')}`);
      },
    );

    // ── TENANCY entre merchants ──────────────────────────────────────────
    await withMerchant(prisma, { name: 'QA S171a A', email: `qa-s171aa-${stamp}@test.local` }, async (mA) => {
      await withMerchant(prisma, { name: 'QA S171a B', email: `qa-s171ab-${stamp}@test.local` }, async (mB) => {
        const cB = await prisma.customer.create({ data: { merchantId: mB.id, name: 'Cliente B' } });
        const jB = await prisma.job.create({ data: { merchantId: mB.id, customerId: cB.id, status: 'en_curso', titulo: 'B', tipoOperacion: 'OPERACIONES_SUELTAS' } });
        const aB = await prisma.albaran.create({
          data: { merchantId: mB.id, jobId: jB.id, numero: `ALB-QA171B-${stamp % 100000}`, estado: 'firmado', modoValoracion: 'VALORADO', lineas: LINEAS },
        });
        const token = 'qa171b-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({ data: { merchantId: mA.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
        const verify = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
        const cookieA = (verify.headers.get('set-cookie') || '').split(';')[0];

        const res = await fetch(`${base}/admin/albaranes/consolidar`, {
          method: 'POST', headers: { cookie: cookieA, 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: cB.id, albaranIds: [aB.id] }),
        });
        assert.equal(res.status, 404, '🔴 FUGA MULTI-TENANT: A ha podido consolidar sobre el cliente de B');
        assert.equal(await prisma.invoice.count({ where: { merchantId: mB.id } }), 0, 'y no emitió nada');
      });
    });
  } finally {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});

// SCRUM-127 (nace del recon de SCRUM-123) — requireActivePlan (el paywall de trial vencido)
// no tenía NINGÚN test. Había tests que confirman que el guard DEJA PASAR con plan vigente
// (scrum47, scrum49) pero ninguno que confirme que BLOQUEA cuando no lo está. Un paywall del
// que nadie ha comprobado que sea un paywall.
//
// Cubre las 4 rutas — y solo esas 4, verificado por grep contra app.ts/albaranes.routes.ts
// (SCRUM-123): POST /admin/albaranes/:id/enviar-whatsapp · POST /admin/albaranes/:id/
// enviar-para-firmar · POST /admin/quotes/:id/send-whatsapp · POST /quote/create.
//
// GUARDA DE PRESENCIA (criterio del día): por cada ruta se afirma PRIMERO que un merchant
// con plan VIGENTE pasa de verdad (éxito real, no solo "no 403") — antes de afirmar que el
// vencido no. Sin eso, un 403 en el caso "vencido" podría deberse a que la fixture de esa
// ruta nunca llegó a construirse bien, no a que el guard funcione.
//
// PROBADO EN ROJO: comentado temporalmente el `return res.status(403)...` de
// requireActivePlan en dist/core/http/authMiddleware.js y confirmado que los 4 asserts de
// "vencido → 403 trial_expired" fallan (y solo esos: los de "vigente → éxito" siguen en
// verde, como debe ser). Revertido antes de cerrar. Ver el PR para el log de la corrida roja.
//
// ⚠️ GATEADO (crea/BORRA merchants efímeros, genera PDFs reales, levanta la app):
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const FUTURA = () => new Date(Date.now() + 30 * 24 * 3600 * 1000);
const PASADA = () => new Date(Date.now() - 24 * 3600 * 1000);

test('SCRUM-127: requireActivePlan bloquea de verdad las 4 rutas gateadas (y solo con trial vencido)', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  let n = 0; // sufijo para no colisionar entre los 3 merchants del mismo test

  const mkCookie = async (merchantId) => {
    const token = 'qa127-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  // Monta, para un merchant dado, los 4 escenarios mínimos que cada ruta gateada necesita
  // para llegar a su lógica de negocio (no solo "no reventar"). Devuelve los ids.
  const montarFixtures = async (merchantId) => {
    const tag = `${stamp}-${n++}`;
    const customer = await prisma.customer.create({
      data: { merchantId, name: `Cliente ${tag}`, phone: `346${String(Date.now() + n).slice(-8)}` },
    });
    const job = await prisma.job.create({ data: { merchantId, customerId: customer.id, status: 'terminado', titulo: `Trabajo ${tag}` } });
    const albaranFirmado = await prisma.albaran.create({
      data: { merchantId, jobId: job.id, numero: `ALB-QA127F-${tag}`, lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'h' }], estado: 'firmado', signatureUrl: SIG, firmadoAt: new Date() },
    });
    const albaranEmitido = await prisma.albaran.create({
      data: { merchantId, jobId: job.id, numero: `ALB-QA127E-${tag}`, lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'h' }], estado: 'emitido' },
    });
    const quote = await prisma.quote.create({
      data: { merchantId, customerId: customer.id, status: 'draft', total: 100, currency: 'EUR', lines: [{ concept: 'Prueba', qty: 1, price: 100, tax: 0 }] },
    });
    return { customer, albaranFirmado, albaranEmitido, quote };
  };

  // Llama a las 4 rutas gateadas contra las fixtures de UN merchant y devuelve sus 4 status.
  const llamarLas4 = async (cookie, fx, merchantId) => {
    const rEnviarWa = await fetch(`${base}/admin/albaranes/${fx.albaranFirmado.id}/enviar-whatsapp`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    });
    const rEnviarFirmar = await fetch(`${base}/admin/albaranes/${fx.albaranEmitido.id}/enviar-para-firmar`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    });
    const rQuoteWa = await fetch(`${base}/admin/quotes/${fx.quote.id}/send-whatsapp`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    });
    const rQuoteCreate = await fetch(`${base}/quote/create`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId, customer_id: fx.customer.id, currency: 'EUR',
        lines: [{ concept: 'Prueba quote/create', qty: 1, price: 50, tax: 0 }],
      }),
    });
    return { rEnviarWa, rEnviarFirmar, rQuoteWa, rQuoteCreate };
  };

  try {
    // ── (1) GUARDA DE PRESENCIA: plan VIGENTE → las 4 deben pasar de verdad ──────────
    await withMerchant(prisma, { name: 'QA S127 vigente', email: `qa-s127-vigente-${stamp}@test.local`, planExpiresAt: FUTURA() }, async (merchantVigente) => {
      const fx = await montarFixtures(merchantVigente.id);
      const cookie = await mkCookie(merchantVigente.id);
      const r = await llamarLas4(cookie, fx, merchantVigente.id);

      assert.equal(r.rEnviarWa.status, 200, `enviar-whatsapp con plan vigente debe ser 200 (fue ${r.rEnviarWa.status}) — si esto falla, el problema es la fixture, no el guard`);
      assert.equal((await r.rEnviarWa.json()).ok, true);

      assert.equal(r.rEnviarFirmar.status, 200, `enviar-para-firmar con plan vigente debe ser 200 (fue ${r.rEnviarFirmar.status})`);
      assert.equal((await r.rEnviarFirmar.json()).ok, true);

      assert.equal(r.rQuoteWa.status, 200, `quotes send-whatsapp con plan vigente debe ser 200 (fue ${r.rQuoteWa.status})`);
      assert.equal((await r.rQuoteWa.json()).ok, true);

      assert.equal(r.rQuoteCreate.status, 201, `quote/create con plan vigente debe ser 201 (fue ${r.rQuoteCreate.status})`);
    });

    // ── (2) LO QUE EL TICKET PIDE: plan VENCIDO → las 4 deben cortar con 403 trial_expired ──
    await withMerchant(prisma, { name: 'QA S127 vencido', email: `qa-s127-vencido-${stamp}@test.local`, planExpiresAt: PASADA() }, async (merchantVencido) => {
      const fx = await montarFixtures(merchantVencido.id);
      const cookie = await mkCookie(merchantVencido.id);
      const r = await llamarLas4(cookie, fx, merchantVencido.id);

      for (const [nombre, res] of [
        ['enviar-whatsapp', r.rEnviarWa],
        ['enviar-para-firmar', r.rEnviarFirmar],
        ['quotes send-whatsapp', r.rQuoteWa],
        ['quote/create', r.rQuoteCreate],
      ]) {
        assert.equal(res.status, 403, `${nombre} con trial vencido debe ser 403 (fue ${res.status})`);
        const body = await res.json();
        assert.equal(body.error, 'trial_expired', `${nombre}: error debe ser trial_expired (fue ${body.error})`);
        assert.equal(body.redirect, '/dashboard/#plans', `${nombre}: debe indicar dónde renovar`);
      }
    });

    // ── (3) El guard es SOLO para trial: un plan de pago no se bloquea aunque su fecha
    // sea pasada (planExpiresAt en plan != trial no tiene ese significado). Una ruta basta:
    // es la MISMA condición compartida por las 4, no una comprobación por-ruta. ────────────
    await withMerchant(prisma, { name: 'QA S127 pro', email: `qa-s127-pro-${stamp}@test.local`, plan: 'pro', planExpiresAt: PASADA() }, async (merchantPro) => {
      const fx = await montarFixtures(merchantPro.id);
      const cookie = await mkCookie(merchantPro.id);
      const rQuoteCreate = await fetch(`${base}/quote/create`, {
        method: 'POST', headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantPro.id, customer_id: fx.customer.id, currency: 'EUR',
          lines: [{ concept: 'Prueba plan pro', qty: 1, price: 50, tax: 0 }],
        }),
      });
      assert.equal(rQuoteCreate.status, 201, `plan 'pro' con fecha pasada NO debe bloquear (fue ${rQuoteCreate.status}) — el paywall es solo para trial`);
    });

    console.log('✔ SCRUM-127: las 4 rutas con requireActivePlan pasan con plan vigente y cortan (403 trial_expired) con trial vencido; plan de pago no se bloquea.');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});

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
// SCRUM-270 · las 4 respuestas ya están en la mano cuando se assertea: se reportan las 4.
import { observarRespuesta, exigirTodas } from './_evidencia.mjs';

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

      // SCRUM-270 · las CUATRO ya están en la mano: se comprueban juntas y el fallo las lleva
      // todas. Antes se asserteaba una a una y la primera se llevaba por delante el dato que
      // decide el diagnóstico — «falla SOLO enviar-whatsapp» (cadena de esa ruta) frente a
      // «fallan las cuatro» (algo compartido: sesión, tenencia, la fila del merchant).
      const obs = [
        await observarRespuesta('enviar-whatsapp', r.rEnviarWa),
        await observarRespuesta('enviar-para-firmar', r.rEnviarFirmar),
        await observarRespuesta('quotes send-whatsapp', r.rQuoteWa),
        await observarRespuesta('quote/create', r.rQuoteCreate),
      ];
      const esperado = { 'quote/create': 201 };
      exigirTodas(
        obs,
        (o) => {
          const quiero = esperado[o.nombre] ?? 200;
          if (o.status !== quiero) return `esperaba ${quiero} y fue ${o.status}`;
          // El cuerpo también, y en la misma pasada: un 200 con `{"ok":false}` es un fallo que
          // el estado por sí solo daría por bueno.
          if (o.nombre !== 'quote/create' && !/"ok"\s*:\s*true/.test(o.cuerpo)) return `200 pero el cuerpo no dice ok:true`;
          return null;
        },
        'con plan VIGENTE las 4 rutas deben pasar de verdad — si fallan, el problema es la fixture, no el guard',
      );
    });

    // ── (2) LO QUE EL TICKET PIDE: plan VENCIDO → las 4 deben cortar con 403 trial_expired ──
    await withMerchant(prisma, { name: 'QA S127 vencido', email: `qa-s127-vencido-${stamp}@test.local`, planExpiresAt: PASADA() }, async (merchantVencido) => {
      const fx = await montarFixtures(merchantVencido.id);
      const cookie = await mkCookie(merchantVencido.id);
      const r = await llamarLas4(cookie, fx, merchantVencido.id);

      // SCRUM-270 · el bucle asserteaba DENTRO: la 2ª, 3ª y 4ª respuestas ya estaban recibidas y
      // no llegaban a imprimirse. Ahora se recorre para OBSERVAR y se falla una sola vez con las
      // cuatro delante — que es justo lo que separa «se escapó una ruta» de «el guard no corre».
      const obs = await Promise.all([
        observarRespuesta('enviar-whatsapp', r.rEnviarWa),
        observarRespuesta('enviar-para-firmar', r.rEnviarFirmar),
        observarRespuesta('quotes send-whatsapp', r.rQuoteWa),
        observarRespuesta('quote/create', r.rQuoteCreate),
      ]);
      exigirTodas(
        obs,
        (o) => {
          if (o.status !== 403) return `esperaba 403 y fue ${o.status}`;
          if (!/"error"\s*:\s*"trial_expired"/.test(o.cuerpo)) return `403 pero sin error trial_expired`;
          if (!/"redirect"\s*:\s*"\/dashboard\/#plans"/.test(o.cuerpo)) return `403 sin decir dónde renovar`;
          return null;
        },
        'con trial VENCIDO las 4 rutas deben cortar con 403 trial_expired',
      );
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

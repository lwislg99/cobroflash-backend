// A5.5 — Ciclo cero-plantillas: si el cliente ACABA de escribirnos (ventana de
// 24 h abierta, p. ej. solicitud del bot), el envío del presupuesto sale como
// TEXTO de sesión (type:'service', 0 €) y NO como plantilla quote_decision_es.
//
// ── CÓMO SE EJECUTA (SCRUM-157 / 159 / 166) ──────────────────────────────────
// Corre por `npm run test:staging:gated` — el runner `scripts/test-staging-gated.mjs`
// (SCRUM-157) setea A55_DB_TEST=1 + WHATSAPP_DRY_RUN=1 en su hijo aislado. NO corre por
// `npm run test:staging` (rutina, sin ese gate hasta que mergee la unificación de SCRUM-166)
// ni por el CI (`npm test`, ungated). En `npm test` normal aparece como SKIP y no toca nada.
//
// ── SCRUM-159 (①): fixture EFÍMERO propio ────────────────────────────────────
// Esta prueba estuvo ROJA hasta SCRUM-159 porque hacía findFirst de un cliente del seed demo
// id=1, que SCRUM-42 quemó (lo dejó como placeholder inerte). Por eso ahora crea su propio
// merchant + cliente EFÍMEROS (withMerchant): no depende del seed, no toca seed-staging.mjs
// (el id=1 sigue quemado) y sobrevive a un reset de staging. El merchant efímero NO es el demo,
// así que el lock V0-2 no aplica y ya NO hace falta DEMO_SAFE_NUMBERS (el runner sigue
// pasándolo; queda inerte). Lo que A5.5 prueba —ventana vs plantilla— es agnóstico al merchant;
// la demo-ness era fricción heredada, no lo que se verifica.
//
// ⚠️ LIMPIEZA (SCRUM-159): esta prueba escribe `whatsAppMessage` (WA-0b), tabla SIN FK. El
// borrado por merchantId de withMerchant la barre, pero un fallo sería MUDO (principio
// FK-Restrict, docs/QA/SUITE_REGRESION.md). Por eso la limpieza va en finally/withMerchant y
// la contraprueba es un CONTEO que GRITA tras el borrado, no un assert (que en un finally
// enmascararía el error real del test).
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando A55_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-159 (①)

const ENABLED = process.env.A55_DB_TEST === '1';

test('A5.5: ventana abierta → envío de presupuesto por SESIÓN (service), no plantilla', { skip: !ENABLED }, async () => {
  assert.equal(process.env.WHATSAPP_DRY_RUN, '1', 'este test exige WHATSAPP_DRY_RUN=1');

  const { prisma } = await import('../dist/core/db/prisma.js');
  const { recordInboundWaMessage } = await import('../dist/modules/messaging/domain/whatsappLog.service.js');
  const { sendWhatsAppWindowFirst } = await import('../dist/integrations/whatsapp.js');
  const { buildQuoteDecision } = await import('../dist/integrations/whatsappTemplates.js');

  let savedMerchantId;
  let failed = false;
  try {
    await withMerchant(prisma, { name: 'QA S159 a55', email: `qa-s159-a55-${Date.now()}@test.local` }, async (merchant) => {
      savedMerchantId = merchant.id;
      // Teléfono derivado de merchant.id (único por construcción, NO del reloj → sin el ciclo de
      // ~16,7 min que colisionaría). padStart(6): si merchant.id supera 999999 el teléfono crece
      // a 12 dígitos; sigue único, no bloquea, solo deja de tener 11. No pasa hoy; anotado por si llega.
      const TEST_PHONE = `34600${String(merchant.id).padStart(6, '0')}`;
      const customer = await prisma.customer.create({
        data: { merchantId: merchant.id, name: 'María García QA', phone: TEST_PHONE },
        select: { id: true, name: true },
      });

      // El log WA-0b es fire-and-forget en prod (a propósito): aquí esperamos con un retry corto
      // a que el INSERT aterrice antes de afirmar sobre él. Ya NO acumula ids para limpiar: de
      // eso se encarga withMerchant (barre whatsAppMessage por merchantId).
      const trackNew = async (since, expectMin = 0) => {
        let rows = [];
        for (let i = 0; i < 30; i++) {
          rows = await prisma.whatsAppMessage.findMany({
            where: { merchantId: merchant.id, customerId: customer.id, createdAt: { gte: since } },
            orderBy: { id: 'asc' },
          });
          if (rows.length >= expectMin) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        return rows;
      };

      const t0 = new Date();
      const template = buildQuoteDecision({
        customerName: customer.name || 'Cliente',
        businessName: 'Fontanería García S.L.',
        quoteNumber: 999,
        totalWithCurrency: '100.00 EUR',
        decisionToken: 'ff00ee11dd22cc33bb44aa55ff00ee11',
      });
      const windowText = 'Hola 👋 (texto de sesión A5.5 — test)';

      // ── Caso 1: SIN ventana → debe salir PLANTILLA ─────────────────────────
      const closed = await sendWhatsAppWindowFirst({
        to: TEST_PHONE,
        merchantId: merchant.id,
        customerId: customer.id,
        windowText,
        template,
        log: { customerId: customer.id },
      });
      assert.equal(closed.ok, true);
      assert.equal(closed.via, 'template', 'sin inbound reciente debe caer a plantilla');
      let rows = await trackNew(t0, 1);
      assert.equal(rows.filter((r) => r.type === 'template').length, 1, 'debe registrarse 1 fila template');

      // ── Caso 2: el cliente escribe (bot) → ventana abierta → SESIÓN ────────
      await recordInboundWaMessage(TEST_PHONE); // lo que hace el webhook con CUALQUIER entrante
      const open = await sendWhatsAppWindowFirst({
        to: TEST_PHONE,
        merchantId: merchant.id,
        customerId: customer.id,
        windowText,
        template,
        log: { customerId: customer.id },
      });
      assert.equal(open.ok, true);
      assert.equal(open.via, 'window', 'con inbound <24h debe salir por VENTANA');

      rows = await trackNew(t0, 3); // template + inbound + service
      const templates = rows.filter((r) => r.type === 'template');
      const services = rows.filter((r) => r.type === 'service');
      assert.equal(templates.length, 1, 'NO debe haberse añadido otra plantilla');
      assert.equal(services.length, 1, 'debe registrarse 1 fila service (sentVia=window)');
      assert.equal(services[0].templateName, 'quote_decision_es', 'la service guarda qué plantilla se ahorró (métrica A5.4)');
      assert.equal(Number(services[0].costEstimate), 0, 'coste 0 €');
    });
  } catch (e) {
    failed = true; // el test falló por su propia razón; el finally NO debe enmascararla
    throw e;
  } finally {
    // withMerchant ya borró el merchant + sus filas por merchantId (incluida whatsAppMessage, que
    // NO tiene FK). Contraprueba por CONTEO. DOS casos: si el test YA falló (failed) solo se GRITA
    // —lanzar aquí enmascararía el error real—; si fue BIEN y quedó basura, eso ES el fallo
    // (contaminaría el proceso siguiente del runner) y se lanza → ROJO. Un verde falso no lo mira
    // nadie. Si la consulta de conteo falla, "NO PUDE CONTAR" y null, NUNCA 0 (se leería como limpio).
    let waLeft = 0;
    const countOrNull = async (label, fn) => {
      try { return await fn(); }
      catch (e) { console.error(`🔴 SCRUM-159: NO PUDE CONTAR ${label} en la contraprueba — la verificación NO corrió; esto NO es "limpio": ${e?.message || e}`); return null; }
    };
    if (savedMerchantId != null) {
      waLeft = (await countOrNull('whatsAppMessage', () => prisma.whatsAppMessage.count({ where: { merchantId: savedMerchantId } }))) ?? 0;
      if (waLeft > 0) console.error(`🔴 SCRUM-159 LIMPIEZA INCOMPLETA: ${waLeft} whatsAppMessage del merchant efímero ${savedMerchantId} sobrevivieron (sin FK → fallo mudo) — contaminarían el proceso siguiente del runner.`);
    }
    // Conteo POSITIVO, SIEMPRE (no solo si >0): ver el conteo, no la ausencia de error.
    console.log(`✔ SCRUM-159 contraprueba de limpieza: whatsAppMessage=${waLeft} (merchant efímero ${savedMerchantId})`);
    await prisma.$disconnect().catch(() => {});
    // Solo si el test fue BIEN: la contaminación ES el fallo y debe ser ROJA. Con failed=true no se
    // lanza: el error original ya propaga intacto por el `throw e` del catch.
    if (!failed && waLeft > 0) {
      throw new Error(`SCRUM-159 LIMPIEZA INCOMPLETA: ${waLeft} whatsAppMessage del merchant efímero ${savedMerchantId} sobrevivieron; contaminarían el proceso siguiente del runner.`);
    }
  }
});

// SCRUM-50: el webhook entrante adaptado a los albaranes. Contra el webhook real, dry-run:
//   (1) «👍 Recibido» (msg.type='button', quick-reply de plantilla) → acuse digno, SIN menú.
//   (2) texto de un cliente SIN albarán reciente y sin presupuesto → mensaje clásico.
//   (3) texto de un cliente CON albarán reciente (WA-0b) → aviso al pro + acuse digno, NO el clásico.
//
// ⚠️ GATEADO (crea/BORRA un merchant efímero; levanta la app; dry-run):
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60/64: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

// ANTES de importar dist (config se congela al cargar). El fallback handleIncomingText
// (donde vive la PIEZA 3) corre directo con el bot OFF.
process.env.WHATSAPP_DRY_RUN = '1';
process.env.BOT_INBOUND_ENABLED = 'false';
// SCRUM-122: SCRUM-99 puso el webhook en fail-closed (rechaza sin X-Hub-Signature-256 válida);
// este test posteaba sin firmar y colaba solo porque, sin secreto configurado, el webhook
// ANTES aceptaba cualquier payload. Fijamos un secreto de prueba y firmamos cada POST (mismo
// HMAC-SHA256 que isValidSignature, ver whatsappIncoming.routes.ts).
process.env.WHATSAPP_APP_SECRET = 'wa-test-secret-scrum122';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-50: webhook — Recibido→acuse sin menú · texto sobre albarán→aviso+acuse · sin-albarán→clásico', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async () => {
  const { app } = await import('../dist/app.js');
  const { prisma } = await import('../dist/core/db/prisma.js');

  const outbox = [];
  globalThis.__waDryRunOutbox = outbox;
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const phone = `34600${stamp % 1000000}`;
  const proPhone = '34600111222';
  let seq = 0;
  const wamid = () => `wamid.s50.${stamp}.${++seq}`;
  const envelope = (msg) => ({ object: 'whatsapp_business_account', entry: [{ id: '0', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', messages: [msg] } }] }] });
  // SCRUM-122: firma HMAC-SHA256 del body EXACTO que viaja (mismo criterio que isValidSignature,
  // que valida contra req.rawBody — los bytes tal cual del body, no un re-stringify).
  const sign = (bodyStr) => 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(bodyStr).digest('hex');
  const post = (msg) => {
    const body = JSON.stringify(envelope(msg));
    return fetch(`${base}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(body) },
      body,
    });
  };
  const waitOutbox = async (minLen, ms = 6000) => { const t = Date.now(); while (outbox.length < minLen && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 100)); };
  const settle = () => new Promise((r) => setTimeout(r, 900));
  const textTo = (to) => outbox.filter((e) => e.kind === 'text' && e.to === to).map((e) => e.text);

  // SCRUM-113: el merchant y su cliente dentro de withMerchant; antes nacían fuera del try.
  try {
    await withMerchant(prisma, {
      name: 'QA S50', email: `qa-s50-${stamp}@test.local`, whatsappPhone: proPhone,
    }, async (merchant) => {
    const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 50', phone } });

    // (1) «👍 Recibido» (type button) → acuse, SIN menú genérico
    outbox.length = 0;
    await post({ from: phone, id: wamid(), type: 'button', button: { text: '👍 Recibido' } });
    await waitOutbox(1); await settle();
    assert.ok(textTo(phone).some((t) => /Gracias por confirmar/i.test(t)), 'acuse del «Recibido»');
    assert.ok(!outbox.some((e) => /presupuesto|men[úu]|Acepto/i.test(e.text || e.bodyText || '')), 'NO sale el menú genérico');

    // (2) texto SIN albarán reciente y sin presupuesto → mensaje clásico
    outbox.length = 0;
    await post({ from: phone, id: wamid(), type: 'text', text: { body: 'hola, una pregunta' } });
    await waitOutbox(1); await settle();
    assert.ok(textTo(phone).some((t) => /no tienes presupuestos pendientes/i.test(t)), 'mensaje clásico sin albarán');

    // (3) con un albarán ENVIADO reciente (WA-0b) → aviso al pro + acuse digno, NO el clásico
    await prisma.whatsAppMessage.create({
      data: { merchantId: merchant.id, customerId: customer.id, type: 'template', templateName: 'albaran_firmado_es', relatedType: 'albaran', relatedId: 1, status: 'sent' },
    });
    outbox.length = 0;
    await post({ from: phone, id: wamid(), type: 'text', text: { body: 'no puedo abrir el pdf del albarán' } });
    await waitOutbox(1); await settle();
    assert.ok(textTo(phone).some((t) => /Se lo hemos pasado a tu profesional/i.test(t)), 'acuse digno al cliente');
    assert.ok(textTo(proPhone).some((t) => /escrito sobre un albar[áa]n/i.test(t)), 'aviso al pro (notifyMerchantAlert)');
    assert.ok(!textTo(phone).some((t) => /no tienes presupuestos pendientes/i.test(t)), 'NO el mensaje clásico cuando hay albarán');

    console.log('✔ SCRUM-50: Recibido→acuse sin menú · sin-albarán→clásico · texto sobre albarán→aviso al pro + acuse.');
    });
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    delete globalThis.__waDryRunOutbox;
    await prisma.$disconnect();
  }
});

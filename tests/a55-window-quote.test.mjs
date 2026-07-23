// A5.5 — Ciclo cero-plantillas: si el cliente ACABA de escribirnos (ventana de
// 24 h abierta, p. ej. solicitud del bot), el envío del presupuesto sale como
// TEXTO de sesión (type:'service', 0 €) y NO como plantilla quote_decision_es.
//
// ⚠️ Este test toca la BD del .env (crea y BORRA sus propias filas de
// whatsapp_messages del merchant demo) y por eso está GATEADO: solo corre con
//   A55_DB_TEST=1 WHATSAPP_DRY_RUN=1 DEMO_SAFE_NUMBERS=34611000001 npm run test:staging
// (WHATSAPP_DRY_RUN evita cualquier llamada real a Meta; DEMO_SAFE_NUMBERS es
// necesario porque el merchant 1 es el demo y V0-2 bloquea destinos fuera de
// la lista — ese guard se mantiene activo A PROPÓSITO también en dry-run.)
// En `npm test` normal aparece como SKIP y no toca nada.
// ⚠️ P3-9 (SCRUM-78, 22-jul): igual que tenancy-permisos/webhooks-idempotencia, este
// test depende de un cliente seed en el merchant demo id=1 que SCRUM-42 quemó — hoy
// falla en staging ("cliente seed no encontrado"), NO corregido en SCRUM-78 (fuera de
// los 2 archivos pedidos; requiere decidir si migra a datos efímeros o a un fixture
// DEMO_SAFE_NUMBERS propio). Ver docs/BUGS.md P3-9.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando A55_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';

const ENABLED = process.env.A55_DB_TEST === '1';
const MERCHANT_ID = 1; // demo (regla 8)
const TEST_PHONE = '34611000001'; // María García (seed demo)

test('A5.5: ventana abierta → envío de presupuesto por SESIÓN (service), no plantilla', { skip: !ENABLED }, async () => {
  assert.equal(process.env.WHATSAPP_DRY_RUN, '1', 'este test exige WHATSAPP_DRY_RUN=1');

  const { prisma } = await import('../dist/core/db/prisma.js');
  const { recordInboundWaMessage } = await import('../dist/modules/messaging/domain/whatsappLog.service.js');
  const { sendWhatsAppWindowFirst } = await import('../dist/integrations/whatsapp.js');
  const { buildQuoteDecision } = await import('../dist/integrations/whatsappTemplates.js');

  const customer = await prisma.customer.findFirst({
    where: { merchantId: MERCHANT_ID, phone: { in: [TEST_PHONE, `+${TEST_PHONE}`] } },
    select: { id: true, name: true },
  });
  assert.ok(customer, 'cliente seed 34611000001 no encontrado (¿seed-demo aplicado?)');

  const createdIds = [];
  // El log WA-0b es fire-and-forget en prod (a propósito): aquí esperamos con
  // un retry corto a que el INSERT aterrice antes de afirmar sobre él.
  const trackNew = async (since, expectMin = 0) => {
    let rows = [];
    for (let i = 0; i < 30; i++) {
      rows = await prisma.whatsAppMessage.findMany({
        where: { merchantId: MERCHANT_ID, customerId: customer.id, createdAt: { gte: since } },
        orderBy: { id: 'asc' },
      });
      if (rows.length >= expectMin) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    rows.forEach((r) => { if (!createdIds.includes(r.id)) createdIds.push(r.id); });
    return rows;
  };

  const t0 = new Date();
  try {
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
      merchantId: MERCHANT_ID,
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
      merchantId: MERCHANT_ID,
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
  } finally {
    // Limpieza: SOLO las filas creadas por este test
    if (createdIds.length) {
      await prisma.whatsAppMessage.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
  }
});

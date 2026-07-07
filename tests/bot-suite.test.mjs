// A8.4 — Suite del BOT (BOT-1/K1): flujo COMPLETO contra el webhook real,
// simulando payloads de Meta, sin gastar un solo mensaje (WHATSAPP_DRY_RUN).
// Cubre: menú → ver presupuestos → pagar pendiente → pedir presupuesto →
// bordes A8.2 (wamid duplicado, doble tap, menú caducado, media) → handoff
// (con registro A8.3) → mudo 24 h → opt-out "BAJA" (J3).
//
// ⚠️ GATEADO (toca la BD del .env con datos del merchant demo y LIMPIA lo suyo):
//   BOT_SUITE_TEST=1 npm test   (el resto de envs las fija este archivo)
// En `npm test` normal aparece como SKIP y no toca nada.
import test from 'node:test';
import assert from 'node:assert/strict';

const ENABLED = process.env.BOT_SUITE_TEST === '1';
const MERCHANT_ID = 1;                 // demo (regla 8)
const TEST_PHONE = '34611000002';      // José Luis Martín (seed demo)
const PRO_PHONE = '629965893';         // whatsappPhone del merchant demo

// Estas DEBEN estar puestas ANTES de importar dist (config se congela al cargar)
process.env.WHATSAPP_DRY_RUN = '1';
process.env.BOT_INBOUND_ENABLED = 'true';
process.env.DEMO_SAFE_NUMBERS = `${TEST_PHONE},${PRO_PHONE},34${PRO_PHONE}`;

let wamidSeq = 0;
const wamid = () => `wamid.suite.${Date.now()}.${++wamidSeq}`;
const textMsg = (body, id = wamid()) => ({ from: TEST_PHONE, id, type: 'text', text: { body } });
const listMsg = (rowId, id = wamid()) => ({ from: TEST_PHONE, id, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: rowId, title: 'x' } } });
const mediaMsg = (type = 'image', id = wamid()) => ({ from: TEST_PHONE, id, type, [type]: { id: 'fake' } });
const locMsg = (id = wamid()) => ({ from: TEST_PHONE, id, type: 'location', location: { latitude: 40.4319, longitude: -3.7036, name: 'Chamberí, Madrid' } });
const metaEnvelope = (msg) => ({ object: 'whatsapp_business_account', entry: [{ id: '0', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', messages: [msg] } }] }] });

test('A8.4: suite completa del bot (webhook + dry-run)', { skip: !ENABLED }, async () => {
  const { app } = await import('../dist/app.js');
  const { prisma } = await import('../dist/core/db/prisma.js');

  const outbox = [];
  globalThis.__waDryRunOutbox = outbox;

  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (msg) => fetch(`${base}/webhooks/whatsapp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metaEnvelope(msg)),
  });

  // El webhook ACKea y procesa en background → esperar a que el buzón crezca
  const waitOutbox = async (minLen, ms = 6000) => {
    const t = Date.now();
    while (outbox.length < minLen && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 100));
    return outbox.length;
  };
  const last = () => outbox[outbox.length - 1];
  // Espera a que el buzón esté QUIETO (el handler de un paso puede seguir
  // enviando menú/avisos tras el primer mensaje y guardando sesión después)
  const settle = async (quietMs = 900, maxMs = 6000) => {
    const t = Date.now();
    let lastLen = outbox.length, lastChange = Date.now();
    while (Date.now() - t < maxMs) {
      await new Promise((r) => setTimeout(r, 120));
      if (outbox.length !== lastLen) { lastLen = outbox.length; lastChange = Date.now(); }
      else if (Date.now() - lastChange >= quietMs) break;
    }
  };
  const log = (step, ok, extra = '') => console.log(`${ok ? '✔' : '✖'} ${step}${extra ? ' — ' + extra : ''}`);

  const t0 = new Date();
  const customer = await prisma.customer.findFirst({
    where: { merchantId: MERCHANT_ID, phone: { in: [TEST_PHONE, `+${TEST_PHONE}`] } },
    select: { id: true },
  });
  assert.ok(customer, 'cliente seed no encontrado');
  const optOutBefore = await prisma.customer.findMany({
    where: { phone: { in: [TEST_PHONE, `+${TEST_PHONE}`] } }, select: { id: true, waOptOut: true },
  });
  // Sesiones previas del número fuera (estado limpio y reproducible)
  await prisma.botSession.deleteMany({ where: { phone: TEST_PHONE } });

  const MARKER = '(suite A8.4) fuga en la cocina de prueba';
  try {
    // FASE 3: purga de solicitudes MARKER (y sus adjuntos) de una ejecución previa
    // que hubiera crasheado, para que el paso 7 (imagen SIN solicitud → amable) sea
    // determinista (el cliente seed solo recibe solicitudes MARKER de esta suite).
    {
      const leftover = await prisma.quoteRequest.findMany({ where: { merchantId: MERCHANT_ID, description: MARKER }, select: { id: true } }).catch(() => []);
      if (leftover.length) await prisma.attachment.deleteMany({ where: { merchantId: MERCHANT_ID, entityType: 'quote_request', entityId: { in: leftover.map((r) => r.id) } } }).catch(() => {});
      await prisma.quoteRequest.deleteMany({ where: { merchantId: MERCHANT_ID, description: MARKER } }).catch(() => {});
    }

    // ── 1. "hola" → menú (lista con las 4 opciones) ─────────────────────────
    await post(textMsg('hola'));
    await waitOutbox(1);
    assert.equal(last()?.kind, 'list', 'el saludo debe responder con el MENÚ (lista)');
    assert.ok(last().rows.includes('bot_quotes') && last().rows.includes('bot_human'), 'menú con opciones K1');
    log('1 saludo → menú', true);

    // ── 2. Ver presupuestos ────────────────────────────────────────────────
    let len = outbox.length;
    await post(listMsg('bot_quotes'));
    await waitOutbox(len + 1);
    await settle();
    assert.ok(outbox.slice(len).some((m) => (m.text && /pendiente|presupuesto/i.test(m.text)) || m.kind === 'cta_url'), 'respuesta de presupuestos (texto o botón-enlace)');
    log('2 ver presupuestos', true);

    // ── 3. Pagar pendiente ─────────────────────────────────────────────────
    len = outbox.length;
    await post(listMsg('bot_pay'));
    await waitOutbox(len + 1);
    await settle();
    assert.ok(outbox.slice(len).some((m) => (m.text && /(al día|pendiente)/i.test(m.text)) || (m.kind === 'cta_url' && /Pagar/i.test(m.buttonText || ''))), 'respuesta de pagos (texto o botón Pagar)');
    log('3 pagar pendiente', true);

    // ── 4. Doble tap del MISMO botón (<90 s) → idempotente en silencio ─────
    await settle(); // deja terminar el paso 3 (menú extra + guardado de sesión)
    len = outbox.length;
    await post(listMsg('bot_pay'));
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(outbox.length, len, 'el doble tap no debe responder de nuevo');
    log('4 doble tap idempotente', true);

    // ── 5. wamid DUPLICADO (reintento de Meta) → ignorado ───────────────────
    const dupId = wamid();
    len = outbox.length;
    await post(textMsg('hola', dupId));
    await waitOutbox(len + 1);
    await settle();
    const afterFirst = outbox.length;
    await post(textMsg('hola', dupId)); // MISMO wamid
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(outbox.length, afterFirst, 'el reintento con el mismo wamid no duplica');
    log('5 dedupe wamid', true);

    // ── 6. Botón de menú CADUCADO/incoherente ───────────────────────────────
    len = outbox.length;
    await post(listMsg('bot_m_99999'));
    await waitOutbox(len + 2);
    const stale = outbox.slice(len).find((m) => m.kind === 'text');
    assert.ok(/caducó/i.test(stale?.text || ''), '"Ese menú ya caducó"');
    assert.ok(outbox.slice(len).some((m) => m.kind === 'list'), 'con menú fresco detrás');
    log('6 menú caducado', true);

    // ── 7. Media no soportada (imagen) ──────────────────────────────────────
    len = outbox.length;
    await post(mediaMsg('image'));
    await waitOutbox(len + 1);
    const media = outbox.slice(len).find((m) => m.kind === 'text');
    assert.ok(/solo entiendo texto/i.test(media?.text || ''), 'respuesta amable a media');
    log('7 media no soportada', true);

    // ── 8. Pedir presupuesto: validación + confirmación (A18) → QuoteRequest ─
    await settle(); // el paso 7 remata con menú — que no pise el last() de aquí
    await prisma.quoteRequest.deleteMany({ where: { merchantId: MERCHANT_ID, description: MARKER } });
    len = outbox.length;
    await post(listMsg('bot_request'));
    await waitOutbox(len + 1);
    assert.ok(/Cuéntame qué necesitas/i.test(last()?.text || ''), 'pregunta 1 (descripción)');

    // 8a. descripción BASURA "vale" → re-pregunta y B1: NO la trata como "Acepto"
    len = outbox.length;
    await post(textMsg('vale'));
    await waitOutbox(len + 1);
    assert.ok(/cuentas un poco más/i.test(last()?.text || ''), '8a desc basura → re-pregunta');
    assert.ok(!/aceptaci[oó]n|Perfecto|registrado tu/i.test(last()?.text || ''), '8a B1: "vale" mid-intake NO acepta presupuesto');

    // 8b. descripción válida → pregunta zona (A23: location_request con botón de ubicación)
    len = outbox.length;
    await post(textMsg(MARKER));
    await waitOutbox(len + 1);
    assert.equal(last()?.kind, 'location_request', '8b prompt de zona (botón ubicación)');
    assert.ok(/En qué zona/i.test(last()?.bodyText || ''), '8b pregunta 2 (zona)');

    // 8c. zona BASURA "ok" → re-pregunta zona (no avanza)
    len = outbox.length;
    await post(textMsg('ok'));
    await waitOutbox(len + 1);
    assert.ok(/Dime la zona/i.test(last()?.text || ''), '8c zona basura → re-pregunta');

    // 8d. zona válida → CONFIRMACIÓN con botones (aún NO crea la solicitud)
    len = outbox.length;
    await post(textMsg('Centro (suite)'));
    await waitOutbox(len + 1);
    assert.equal(last()?.kind, 'buttons', '8d muestra confirmación con botones');
    assert.ok(last().buttons.includes('bot_confirm_send') && last().buttons.includes('bot_confirm_edit'), '8d botones Enviar/Reescribir');
    assert.ok((last().bodyText || '').includes(MARKER.slice(0, 15)), '8d resumen incluye la descripción');
    assert.ok(!(await prisma.quoteRequest.findFirst({ where: { merchantId: MERCHANT_ID, description: MARKER } })), '8d aún NO creada (falta confirmar)');

    // 8e. Reescribir → reinicia; re-metemos descripción + zona → confirmación de nuevo
    len = outbox.length;
    await post(listMsg('bot_confirm_edit'));
    await waitOutbox(len + 1);
    assert.ok(/de nuevo|Cuéntame/i.test(last()?.text || ''), '8e reescribir → reinicia descripción');
    len = outbox.length; await post(textMsg(MARKER)); await waitOutbox(len + 1);
    len = outbox.length; await post(textMsg('Centro (suite)')); await waitOutbox(len + 1);
    assert.equal(last()?.kind, 'buttons', '8e vuelve a la confirmación');

    // 8f. Enviar → crea la solicitud + avisa al pro
    len = outbox.length;
    await post(listMsg('bot_confirm_send'));
    await waitOutbox(len + 1);
    const done = outbox.slice(len).find((m) => /¡Listo!/i.test(m.text || ''));
    assert.ok(done, '8f confirmación → ¡Listo!');
    const qr = await prisma.quoteRequest.findFirst({ where: { merchantId: MERCHANT_ID, description: MARKER } });
    assert.ok(qr, '8f QuoteRequest creado');
    assert.equal(qr.source, 'whatsapp_bot');
    assert.ok(outbox.slice(len).some((m) => m.to !== TEST_PHONE), '8f aviso al PRO enviado');
    log('8 pedir presupuesto (validación + confirmación) → QuoteRequest', true);

    // ── 8.2 (FASE 3 · MEDIA-1): foto entrante → se adjunta a la solicitud recién
    // creada y el bot confirma. En dry-run la descarga devuelve un buffer image/jpeg
    // simbólico; el Attachment se guarda de verdad en la BD (y se limpia al final).
    await settle();
    len = outbox.length;
    await post(mediaMsg('image'));
    await waitOutbox(len + 1);
    await settle();
    assert.ok(outbox.slice(len).some((m) => /Foto recibida/i.test(m.text || '')), '8.2 foto → "Foto recibida"');
    const att = await prisma.attachment.findFirst({ where: { merchantId: MERCHANT_ID, entityType: 'quote_request', entityId: qr.id, kind: 'photo' } });
    assert.ok(att, '8.2 Attachment (foto) creado y ligado a la solicitud');
    assert.ok(String(att.url).includes('/admin/attachments/'), '8.2 url de servido correcta');
    log('8.2 foto adjunta a la solicitud (FASE 3)', true);

    // ── 8g. Cancelar a mitad de captación → vuelve al menú, no crea nada ─────
    await settle();
    len = outbox.length;
    await post(listMsg('bot_request'));
    await waitOutbox(len + 1);
    len = outbox.length;
    await post(textMsg('cancelar'));
    await waitOutbox(len + 1);
    assert.ok(outbox.slice(len).some((m) => /lo dejamos/i.test(m.text || '')), '8g cancelar → salida');
    assert.ok(outbox.slice(len).some((m) => m.kind === 'list'), '8g vuelve al menú');
    log('8g cancelar a mitad de captación', true);

    // ── 8h. Compartir UBICACIÓN como zona (A23) → confirmación ──────────────
    await settle();
    len = outbox.length; await post(listMsg('bot_request')); await waitOutbox(len + 1);
    len = outbox.length; await post(textMsg('reparación urgente (suite loc)')); await waitOutbox(len + 1);
    assert.equal(last()?.kind, 'location_request', '8h prompt de zona con botón ubicación');
    len = outbox.length; await post(locMsg()); await waitOutbox(len + 1);
    assert.equal(last()?.kind, 'buttons', '8h ubicación compartida → confirmación');
    await post(textMsg('cancelar')); await settle(); // volver al menú, sin crear nada
    log('8h ubicación como zona', true);

    // ── 9. Handoff (botón) + registro A8.3 ──────────────────────────────────
    await settle(); // la solicitud remata avisando al pro
    len = outbox.length;
    await post(listMsg('bot_human'));
    await waitOutbox(len + 2);
    assert.ok(outbox.slice(len).some((m) => /le he avisado/i.test(m.text || '')), 'expectativa al cliente');
    assert.ok(outbox.slice(len).some((m) => m.to !== TEST_PHONE && /quiere hablar contigo/i.test(m.text || '')), 'aviso al pro con contexto');
    const sess = await prisma.botSession.findFirst({ where: { phone: TEST_PHONE }, orderBy: { id: 'desc' } });
    assert.equal(sess?.state, 'handoff', 'sesión en handoff (registro BO A8.3)');
    log('9 handoff + registro', true);

    // ── 10. Mudo 24 h tras handoff ──────────────────────────────────────────
    await settle(); // el handoff termina de avisar al pro y guardar sesión
    len = outbox.length;
    await post(textMsg('¿sigues ahí?'));
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(outbox.length, len, 'el bot debe estar MUDO tras handoff');
    log('10 mudo post-handoff', true);

    // ── 11. Opt-out "BAJA" (J3 — funciona incluso en handoff) ───────────────
    len = outbox.length;
    await post(textMsg('BAJA'));
    await waitOutbox(len + 1);
    assert.ok(/No te enviaremos más mensajes/i.test(last()?.text || ''), 'confirmación de baja');
    const after = await prisma.customer.findUnique({ where: { id: customer.id }, select: { waOptOut: true } });
    assert.equal(after?.waOptOut, true, 'waOptOut activado');
    log('11 BAJA (J3)', true);

    console.log(`\nSUITE OK — ${outbox.length} mensajes simulados, 0 llamadas a Meta.`);
  } finally {
    // ── Limpieza: SOLO lo creado por la suite ────────────────────────────────
    for (const c of optOutBefore) {
      await prisma.customer.update({ where: { id: c.id }, data: { waOptOut: c.waOptOut } }).catch(() => {});
    }
    // FASE 3: adjuntos (fotos) de las solicitudes MARKER creadas por la suite
    const markerReqs = await prisma.quoteRequest.findMany({ where: { merchantId: MERCHANT_ID, description: MARKER }, select: { id: true } }).catch(() => []);
    if (markerReqs.length) {
      await prisma.attachment.deleteMany({ where: { merchantId: MERCHANT_ID, entityType: 'quote_request', entityId: { in: markerReqs.map((r) => r.id) } } }).catch(() => {});
    }
    await prisma.quoteRequest.deleteMany({ where: { merchantId: MERCHANT_ID, description: MARKER } }).catch(() => {});
    await prisma.botSession.deleteMany({ where: { phone: TEST_PHONE } }).catch(() => {});
    await prisma.whatsAppMessage.deleteMany({
      where: { merchantId: MERCHANT_ID, customerId: customer?.id, type: 'inbound', createdAt: { gte: t0 } },
    }).catch(() => {});
    await prisma.customerEvent.deleteMany({
      where: { merchantId: MERCHANT_ID, customerId: customer?.id, createdAt: { gte: t0 }, type: { in: ['quote_requested', 'handoff'] } },
    }).catch(() => {});
    delete globalThis.__waDryRunOutbox;
    await new Promise((r) => server.close(r));
    await prisma.$disconnect().catch(() => {});
  }
});

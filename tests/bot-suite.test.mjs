// A8.4 — Suite del BOT (BOT-1/K1): flujo COMPLETO contra el webhook real,
// simulando payloads de Meta, sin gastar un solo mensaje (WHATSAPP_DRY_RUN).
// Cubre: menú → ver presupuestos → pagar pendiente → pedir presupuesto →
// bordes A8.2 (wamid duplicado, doble tap, menú caducado, media) → handoff
// (con registro A8.3) → mudo 24 h → opt-out "BAJA" (J3).
//
// ── CÓMO SE EJECUTA (SCRUM-157 / 159 / 166) ──────────────────────────────────
// Esta suite corre por `npm run test:staging:gated` — el runner
// `scripts/test-staging-gated.mjs` (SCRUM-157) setea BOT_SUITE_TEST=1 en su hijo
// aislado (líneas 63-65 de ese fichero). NO corre por `npm run test:staging`
// (rutina, sin ese gate hasta que mergee la unificación de SCRUM-166) ni por el
// CI (`npm test`, ungated). En `npm test` normal aparece como SKIP y no toca nada.
//
// ── SCRUM-159 (①): fixture EFÍMERO propio ────────────────────────────────────
// Esta suite estuvo ROJA hasta SCRUM-159 porque dependía de un cliente del seed
// demo id=1, que SCRUM-42 quemó (lo dejó como placeholder inerte). Por eso ahora
// crea su propio merchant + cliente EFÍMEROS (withMerchant): no depende del seed,
// no toca seed-staging.mjs (el id=1 sigue quemado) y sobrevive a un reset de staging.
//
// ⚠️ LIMPIEZA — NO es cosmética (SCRUM-159; runner de SCRUM-157). Esta suite corre
// ANTES del bloque de ~49 tests del runner, y ESCRIBE filas. Una fila que sobreviva
// ya no es suciedad propia: es entrada del proceso siguiente. Y el agravante es el
// principio FK-Restrict (docs/QA/SUITE_REGRESION.md): esta suite genera
// `whatsAppMessage` y `attachment`, que NO tienen FK — si el borrado por merchantId
// fallara, sería MUDO (exit 0, verde, basura dentro). Por eso:
//   a) toda la limpieza va en `finally` / withMerchant, nunca en el camino feliz
//      (un assert que revienta a mitad es justo cuando quedan filas);
//   b) las tablas SIN FK se comprueban EXPLÍCITAMENTE vacías tras el borrado;
//   c) la contraprueba de que limpia es un CONTEO tras la limpieza, no la ausencia de error.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando BOT_SUITE_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-159 (①)

const ENABLED = process.env.BOT_SUITE_TEST === '1';

// Se asignan DENTRO del test, desde merchant.id (efímero, único por construcción, NO del
// reloj → sin el ciclo de ~16,7 min que colisionaría en el lookup cross-merchant del bot).
// Módulo-scope porque los helpers de mensaje los leen en tiempo de llamada.
let MERCHANT_ID;
let TEST_PHONE;

// Estas DEBEN estar puestas ANTES de importar dist (config se congela al cargar)
process.env.WHATSAPP_DRY_RUN = '1';
process.env.BOT_INBOUND_ENABLED = 'true';
// SCRUM-122: el fail-closed de SCRUM-99 rechaza cualquier POST a /webhooks/whatsapp sin
// X-Hub-Signature-256 válida. Firmamos con un secreto de prueba (HMAC-SHA256).
process.env.WHATSAPP_APP_SECRET = 'wa-test-secret-scrum122';
// SCRUM-159: ya NO se fija DEMO_SAFE_NUMBERS — el merchant efímero no es el demo, así que el
// lock V0-2 no aplica (era fricción heredada). Su cobertura sigue en whatsappPolicy.test.mjs
// (unit) y scrum115-wa-fallo-registrado (sender): no se pierde nada al quitarla.

// GUARDA (SCRUM-159): un helper de mensaje llamado ANTES de asignar TEST_PHONE metería
// "undefined" en el teléfono → un webhook con basura que no casa nada y un fallo en una
// aserción lejana (media hora de diagnóstico). Que reviente aquí, ruidoso y en el sitio.
const reqPhone = () => {
  if (TEST_PHONE == null) {
    throw new Error('SCRUM-159: se usó un helper de mensaje antes de crear el merchant efímero (TEST_PHONE sin asignar).');
  }
  return TEST_PHONE;
};

let wamidSeq = 0;
const wamid = () => `wamid.suite.${Date.now()}.${++wamidSeq}`;
const textMsg = (body, id = wamid()) => ({ from: reqPhone(), id, type: 'text', text: { body } });
const listMsg = (rowId, id = wamid()) => ({ from: reqPhone(), id, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: rowId, title: 'x' } } });
const mediaMsg = (type = 'image', id = wamid()) => ({ from: reqPhone(), id, type, [type]: { id: 'fake' } });
const locMsg = (id = wamid()) => ({ from: reqPhone(), id, type: 'location', location: { latitude: 40.4319, longitude: -3.7036, name: 'Chamberí, Madrid' } });
const metaEnvelope = (msg) => ({ object: 'whatsapp_business_account', entry: [{ id: '0', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', messages: [msg] } }] }] });

test('A8.4: suite completa del bot (webhook + dry-run)', { skip: !ENABLED }, async () => {
  const { app } = await import('../dist/app.js');
  const { prisma } = await import('../dist/core/db/prisma.js');

  const outbox = [];
  globalThis.__waDryRunOutbox = outbox;

  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const sign = (bodyStr) => 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(bodyStr).digest('hex');
  const post = (msg) => {
    const body = JSON.stringify(metaEnvelope(msg));
    return fetch(`${base}/webhooks/whatsapp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(body) }, body,
    });
  };

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

  const MARKER = '(suite A8.4) fuga en la cocina de prueba';
  let savedMerchantId;
  let failed = false;
  try {
    // El merchant + cliente EFÍMEROS y TODO el flujo, dentro de withMerchant: su finally
    // (limpiarMerchant) borra el merchant y sus filas por merchantId — camino de FALLO
    // incluido (un assert que reviente a mitad NO deja huérfanos del merchant). Barre
    // whatsAppMessage, attachment, quoteRequest, customerEvent y customer (MODELOS_POR_MERCHANT).
    await withMerchant(prisma, { name: 'QA S159 bot', email: `qa-s159-bot-${Date.now()}@test.local` }, async (merchant, phones) => {
      MERCHANT_ID = merchant.id;
      savedMerchantId = merchant.id;
      // SCRUM-174: los teléfonos los GENERA withMerchant (fuente única, SCRUM-180) y los entrega
      // aquí; ya no se inventan. `cliente` = 34600… (entrante) · `pro` = 34601… (whatsappPhone).
      TEST_PHONE = phones.cliente;
      assert.ok(TEST_PHONE && MERCHANT_ID, 'fixture efímero no montado');

      // El merchant efímero LLEVA whatsappPhone A PROPÓSITO (SCRUM-159). Dos asertos lo exigen:
      //   · «8f aviso al PRO enviado»  · «9 handoff → aviso al pro con contexto»
      // Ambos comprueban que el PRO recibe el aviso, que el bot envía a merchant.whatsappPhone.
      // Sin él, ese envío no tiene destino y los dos fallan. NO es residuo del seed demo: es
      // cobertura de un comportamiento real del bot (avisar al pro). NO lo quites al limpiar
      // fixtures. `pro` va DISTINTO de `cliente` (34601 vs 34600) porque 8f asierta
      // `m.to !== TEST_PHONE`: si colisionaran, ese aserto pasaría SIN comprobar nada (verde falso
      // justo donde crees tener cobertura). Ambos salen del fixture — misma fuente, SCRUM-180.
      const PRO_PHONE = phones.pro;
      await prisma.merchant.update({ where: { id: merchant.id }, data: { whatsappPhone: PRO_PHONE } });

      const customer = await prisma.customer.create({
        data: { merchantId: MERCHANT_ID, name: 'José Luis Martín QA', phone: TEST_PHONE },
        select: { id: true },
      });

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
      // Determinista sin purga previa: el merchant es EFÍMERO, no tiene ninguna solicitud aún.
      len = outbox.length;
      await post(mediaMsg('image'));
      await waitOutbox(len + 1);
      const media = outbox.slice(len).find((m) => m.kind === 'text');
      assert.ok(/solo entiendo texto/i.test(media?.text || ''), 'respuesta amable a media');
      log('7 media no soportada', true);

      // ── 8. Pedir presupuesto: validación + confirmación (A18) → QuoteRequest ─
      await settle(); // el paso 7 remata con menú — que no pise el last() de aquí
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
      // simbólico; el Attachment se guarda de verdad en la BD (lo barre withMerchant).
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
    });
  } catch (e) {
    failed = true; // el test falló por su propia razón; el finally NO debe enmascararla
    throw e;
  } finally {
    // ── LIMPIEZA + CONTRAPRUEBA, TODO en el finally (SCRUM-159) ───────────────────
    // Corre en el camino de FALLO incluido (un assert que revienta a mitad es justo cuando
    // pueden quedar filas). DOS casos:
    //   · si el test YA falló (failed): solo se GRITA — lanzar aquí enmascararía el error real;
    //   · si el test fue BIEN y la limpieza dejó filas: eso ES el fallo (contaminaría el proceso
    //     siguiente del runner) y se lanza al final → ROJO. Un verde falso no lo mira nadie.
    //
    // withMerchant (limpiarMerchant) ya borró merchant + sus filas por merchantId (whatsAppMessage,
    // attachment, quoteRequest, customerEvent, customer) Y —desde SCRUM-174— barre botSession por
    // los PHONES que él mismo generó (cliente/pro), que es lo que alcanza las sesiones con
    // merchantId=null (nullable + sin FK). Aquí ya NO se limpia nada: solo se CONTRAPRUEBA que
    // todo quedó a cero. Un conteo > 0 significa que el fixture no barrió — y es rojo.
    let waLeft = 0, attLeft = 0, sessLeft = 0;
    // Si la CONSULTA de conteo falla, "NO PUDE CONTAR" y null — NUNCA 0: un 0 de error se leería
    // como "limpio". Se coalesce a 0 solo para el umbral (el grito ya avisó de que no se contó).
    const countOrNull = async (label, fn) => {
      try { return await fn(); }
      catch (e) { console.error(`🔴 SCRUM-159: NO PUDE CONTAR ${label} en la contraprueba — la verificación NO corrió; esto NO es "limpio": ${e?.message || e}`); return null; }
    };
    if (savedMerchantId != null) {
      waLeft = (await countOrNull('whatsAppMessage', () => prisma.whatsAppMessage.count({ where: { merchantId: savedMerchantId } }))) ?? 0;
      attLeft = (await countOrNull('attachment', () => prisma.attachment.count({ where: { merchantId: savedMerchantId } }))) ?? 0;
      if (waLeft > 0) console.error(`🔴 SCRUM-159 LIMPIEZA INCOMPLETA: ${waLeft} whatsAppMessage del merchant efímero ${savedMerchantId} sobrevivieron (sin FK → fallo mudo) — contaminarían el proceso siguiente del runner.`);
      if (attLeft > 0) console.error(`🔴 SCRUM-159 LIMPIEZA INCOMPLETA: ${attLeft} attachment del merchant efímero ${savedMerchantId} sobrevivieron.`);
    }
    if (TEST_PHONE) {
      sessLeft = (await countOrNull('botSession', () => prisma.botSession.count({ where: { phone: TEST_PHONE } }))) ?? 0;
      if (sessLeft > 0) console.error(`🔴 SCRUM-174 LIMPIEZA INCOMPLETA: ${sessLeft} botSession con phone ${TEST_PHONE} sobrevivieron — el barrido por phone del fixture (withMerchant) no las alcanzó.`);
    }
    // Conteo POSITIVO, SIEMPRE (no solo si >0): ver el conteo, no la ausencia de error. Un 0
    // silencioso se lee igual que "la contraprueba no corrió".
    console.log(`✔ SCRUM-159 contraprueba de limpieza: whatsAppMessage=${waLeft} · attachment=${attLeft} · botSession=${sessLeft} (merchant efímero ${savedMerchantId})`);
    delete globalThis.__waDryRunOutbox;
    await new Promise((r) => server.close(r));
    await prisma.$disconnect().catch(() => {});
    // Solo si el test fue BIEN: la contaminación ES el fallo y debe ser ROJA (no un console.error
    // perdido entre los tres procesos del runner). Con failed=true no se lanza: el error original
    // ya propaga intacto por el `throw e` del catch.
    if (!failed && (waLeft > 0 || attLeft > 0 || sessLeft > 0)) {
      throw new Error(`SCRUM-159 LIMPIEZA INCOMPLETA: wa=${waLeft} att=${attLeft} sess=${sessLeft} — filas del merchant efímero ${savedMerchantId} sobrevivieron; contaminarían el proceso siguiente del runner.`);
    }
  }
});

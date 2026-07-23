// SCRUM-100 (🔴 seguridad, guard de regresión — sin gate de BD, corre en `npm test` normal):
// red que impide que un refactor futuro reintroduzca el fail-open que tenían /webhooks/mp
// y /webhooks/whatsapp antes de SCRUM-99 (auditoría SCRUM-88, hallazgo #7). Guard D de la
// auditoría pide explícitamente "un test unitario que confirme que las 4 rutas de webhook
// comparten la misma forma de guard, para que un quinto webhook futuro no reintroduzca la
// asimetría". Para cada uno de los 4 (Stripe, Connect, MP, WhatsApp): sin secreto → RECHAZA;
// firma inválida → RECHAZA; firma válida → procesa.
//
// Dos niveles de test, no por descuido sino porque el status HTTP de cada webhook no
// refleja lo mismo:
//   - Stripe y Connect SÍ reflejan la decisión en el status HTTP (500 sin secreto, 400
//     firma inválida, 200 firma válida) → se testean con una petición HTTP real contra la
//     app completa (mismo patrón que A12.2c: app.listen(0) + fetch), usando un evento SIN
//     MANEJAR para que la rama "procesa" nunca toque Prisma.
//   - MP responde 200 a Mercado Pago SIEMPRE de inmediato, antes de validar nada (para
//     evitar reintentos) — su status HTTP no distingue rechazo de proceso. Por eso se
//     testea `checkMpWebhookAuth` (SCRUM-100, extraída de mpWebhook.routes.ts) directamente:
//     función pura, sin red ni BD.
//   - WhatsApp expone `isValidSignature` (ya exportada en SCRUM-100) — misma razón: función
//     pura, sin red ni BD, más directa que montar la petición HTTP completa.
//
// Puro respecto a BD: ninguno de estos tests crea, lee ni borra registros. No lleva el
// guard `_staging-db.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

// Necesario ANTES del primer import (dinámico) de dist/app.js: integrations/stripe.ts
// construye el cliente Stripe UNA SOLA VEZ al cargarse el módulo (null si falta la key,
// y entonces la ruta responde 501 antes de llegar a nuestro guard). La key es falsa — nunca
// se usa para llamar a la API real: constructEvent/generateTestHeaderString son
// criptografía puramente local, el patrón de test oficial documentado por Stripe.
process.env.STRIPE_SECRET_KEY ||= 'sk_test_' + 'f'.repeat(24);

let app, server, port, config, StripeSdk;

test.before(async () => {
  ({ config } = await import('../dist/core/config/env.js'));
  ({ app } = await import('../dist/app.js'));
  StripeSdk = (await import('stripe')).default;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;
});

test.after(() => {
  server.close(); // sin esperar: `--test-force-exit` cierra el proceso igualmente
});

// SCRUM-100: `fetch` (undici) descartado a propósito — encontrado depurando este mismo
// test. Con 3+ peticiones sobre el mismo `app.listen(0)`, sus conexiones (aun con
// `Connection: close`) dejaban el proceso en un estado que, bajo `--test-force-exit` en
// Windows, terminaba en un crash nativo de libuv (`Assertion failed:
// !(handle->flags & UV_HANDLE_CLOSING)`) — los resultados salían todos en verde, pero el
// fichero se marcaba como fallido igual. `node:http` con `agent:false` (sin pool de
// conexiones) no lo reproduce en ninguna combinación probada.
function postWebhook(path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'POST', agent: false, headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, json: () => Promise.resolve(JSON.parse(data)) }));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

// Cambia temporalmente una clave de `config` para el test y la restaura siempre (éxito o no).
async function withConfig(key, value, fn) {
  const original = config[key];
  config[key] = value;
  try {
    await fn();
  } finally {
    config[key] = original;
  }
}

// ── Stripe (plataforma) — HTTP real, status refleja la decisión ────────────────────────
test('Stripe: sin STRIPE_WEBHOOK_SECRET → RECHAZA (500)', () =>
  withConfig('STRIPE_WEBHOOK_SECRET', '', async () => {
    const res = await postWebhook('/webhooks/stripe', { 'stripe-signature': 't=1,v1=x' }, JSON.stringify({ id: 'evt_x' }));
    assert.equal(res.status, 500);
  }));

test('Stripe: secreto presente + firma inválida → RECHAZA (400)', () =>
  withConfig('STRIPE_WEBHOOK_SECRET', 'whsec_' + crypto.randomBytes(12).toString('hex'), async () => {
    const res = await postWebhook(
      '/webhooks/stripe',
      { 'stripe-signature': 't=1,v1=deadbeef' },
      JSON.stringify({ id: 'evt_x', type: 'test.unhandled' }),
    );
    assert.equal(res.status, 400);
  }));

test('Stripe: secreto + firma válida → procesa (200, evento sin manejar, nunca toca BD)', async () => {
  const secret = 'whsec_' + crypto.randomBytes(12).toString('hex');
  await withConfig('STRIPE_WEBHOOK_SECRET', secret, async () => {
    const testClient = new StripeSdk(process.env.STRIPE_SECRET_KEY);
    const payload = JSON.stringify({
      id: 'evt_' + crypto.randomBytes(6).toString('hex'),
      type: 'test.unhandled', // ninguna rama del handler lo reconoce → cae directo a `res.json({received:true})`
      data: { object: {} },
    });
    const header = testClient.webhooks.generateTestHeaderString({ payload, secret });
    const res = await postWebhook('/webhooks/stripe', { 'stripe-signature': header }, payload);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.received, true);
  });
});

// ── Stripe Connect — mismo patrón, secreto propio ───────────────────────────────────────
test('Stripe Connect: sin STRIPE_CONNECT_WEBHOOK_SECRET → RECHAZA (500)', () =>
  withConfig('STRIPE_CONNECT_WEBHOOK_SECRET', '', async () => {
    const res = await postWebhook('/webhooks/stripe-connect', { 'stripe-signature': 't=1,v1=x' }, JSON.stringify({ id: 'evt_x' }));
    assert.equal(res.status, 500);
  }));

test('Stripe Connect: secreto presente + firma inválida → RECHAZA (400)', () =>
  withConfig('STRIPE_CONNECT_WEBHOOK_SECRET', 'whsec_' + crypto.randomBytes(12).toString('hex'), async () => {
    const res = await postWebhook(
      '/webhooks/stripe-connect',
      { 'stripe-signature': 't=1,v1=deadbeef' },
      JSON.stringify({ id: 'evt_x', type: 'test.unhandled' }),
    );
    assert.equal(res.status, 400);
  }));

test('Stripe Connect: secreto + firma válida → procesa (200, evento sin manejar, nunca toca BD)', async () => {
  const secret = 'whsec_' + crypto.randomBytes(12).toString('hex');
  await withConfig('STRIPE_CONNECT_WEBHOOK_SECRET', secret, async () => {
    const testClient = new StripeSdk(process.env.STRIPE_SECRET_KEY);
    const payload = JSON.stringify({
      id: 'evt_' + crypto.randomBytes(6).toString('hex'),
      type: 'test.unhandled',
      data: { object: {} },
    });
    const header = testClient.webhooks.generateTestHeaderString({ payload, secret });
    const res = await postWebhook('/webhooks/stripe-connect', { 'stripe-signature': header }, payload);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.received, true);
  });
});

// ── Mercado Pago — función pura (el status HTTP siempre es 200, ver cabecera del archivo) ──
test('MP: sin MP_WEBHOOK_SECRET → checkMpWebhookAuth RECHAZA (no-secret)', async () => {
  const { checkMpWebhookAuth } = await import('../dist/modules/billing/app/routes/mpWebhook.routes.js');
  const result = checkMpWebhookAuth({ xSignature: 'ts=1;v1=x', xRequestId: 'r1', dataId: '123', secret: '' });
  assert.equal(result, 'no-secret');
});

test('MP: secreto presente + firma inválida (misma longitud, valor distinto) → RECHAZA (invalid)', async () => {
  const { checkMpWebhookAuth } = await import('../dist/modules/billing/app/routes/mpWebhook.routes.js');
  const wrongButSameLength = 'a'.repeat(64); // 64 hex = 32 bytes, igual que un HMAC-SHA256 real
  const result = checkMpWebhookAuth({ xSignature: `ts=1;v1=${wrongButSameLength}`, xRequestId: 'r1', dataId: '123', secret: 'mp-test-secret' });
  assert.equal(result, 'invalid');
});

test('MP: firma con v1 de longitud distinta a la esperada → RECHAZA sin lanzar (invalid)', async () => {
  // SCRUM-100: encontrado escribiendo este test — crypto.timingSafeEqual LANZA si los
  // buffers no miden lo mismo; un v1 corto/largo de un atacante no debe poder tirar una
  // excepción sin capturar. Fijado en mercadopago.ts (try/catch alrededor de timingSafeEqual).
  const { checkMpWebhookAuth } = await import('../dist/modules/billing/app/routes/mpWebhook.routes.js');
  const result = checkMpWebhookAuth({ xSignature: 'ts=1;v1=deadbeef', xRequestId: 'r1', dataId: '123', secret: 'mp-test-secret' });
  assert.equal(result, 'invalid');
});

test('MP: secreto presente + firma válida (misma fórmula que MP: HMAC-SHA256 de id/request-id/ts) → procesa (ok)', async () => {
  const { checkMpWebhookAuth } = await import('../dist/modules/billing/app/routes/mpWebhook.routes.js');
  const secret = 'mp-test-secret';
  const dataId = '123456789';
  const xRequestId = 'req-' + crypto.randomBytes(4).toString('hex');
  const ts = String(Math.floor(Date.now() / 1000));
  const message = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const result = checkMpWebhookAuth({ xSignature: `ts=${ts};v1=${v1}`, xRequestId, dataId, secret });
  assert.equal(result, 'ok');
});

// ── WhatsApp — función pura `isValidSignature` (exportada en SCRUM-100) ─────────────────
test('WhatsApp: sin WHATSAPP_APP_SECRET → isValidSignature RECHAZA (false)', () =>
  withConfig('WHATSAPP_APP_SECRET', '', async () => {
    const { isValidSignature } = await import('../dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js');
    const req = { headers: { 'x-hub-signature-256': 'sha256=whatever' }, rawBody: Buffer.from('{}') };
    assert.equal(isValidSignature(req), false);
  }));

test('WhatsApp: secreto presente + firma inválida → RECHAZA (false)', () =>
  withConfig('WHATSAPP_APP_SECRET', 'wa-test-secret', async () => {
    const { isValidSignature } = await import('../dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js');
    const req = { headers: { 'x-hub-signature-256': 'sha256=deadbeef' }, rawBody: Buffer.from('{"a":1}') };
    assert.equal(isValidSignature(req), false);
  }));

test('WhatsApp: secreto presente + firma válida → procesa (true)', () =>
  withConfig('WHATSAPP_APP_SECRET', 'wa-test-secret', async () => {
    const { isValidSignature } = await import('../dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js');
    const raw = Buffer.from(JSON.stringify({ entry: [] }));
    const sig = 'sha256=' + crypto.createHmac('sha256', 'wa-test-secret').update(raw).digest('hex');
    const req = { headers: { 'x-hub-signature-256': sig }, rawBody: raw };
    assert.equal(isValidSignature(req), true);
  }));

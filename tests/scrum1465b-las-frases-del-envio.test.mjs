// tests/scrum1465b-las-frases-del-envio.test.mjs — SCRUM-1465
//
// LO QUE LEE EL PROFESIONAL CUANDO EL WHATSAPP DE SU PRESUPUESTO NO SALE.
//
// `POST /admin/quotes/:id/send-whatsapp` contesta 200 `sent:false` con una frase en `message`, y
// tres pantallas la pintan tal cual (el presupuesto rápido, la ficha y la lista). Firmadas por el
// orquestador en SCRUM-1465 (c.18357, y D re-firmada en c.18371):
//
//   A · no se sabe si salió  (Meta dice que no, no contesta, o no llegamos a mandarlo)
//   C · tope diario del negocio
//   D · tope diario por cliente
//   E · el cliente está dado de baja
//
// La del CORREO que no sale (F) se comprueba en `scrum1465-lo-que-salio-salio`, que es donde está
// doblado el correo.
//
// Las tres reglas que este fichero sujeta:
//   1. EL TEXTO DE META NO LLEGA A LA PERSONA. Antes leía «(#131026) Message undeliverable».
//      Sigue viajando en `detail`, que no se pinta.
//   2. EN LA RAMA DONDE NO SE SABE, NO SE AFIRMA. Si Meta no contesta a tiempo el mensaje puede
//      haber salido; decir «no ha salido, reinténtalo» lo manda dos veces.
//   3. LA PALABRA DEL DOCUMENTO NO ESTÁ EN EL SERVIDOR. Ni «presupuesto» ni «cotización»: así no
//      hay género que concordar. «Hemos guardado tu …» lo pone la pantalla que acaba de guardar.
//
// 🔴 LO QUE NO CAMBIA, y está aquí como control para que nadie lo «arregle» de paso: el aviso de
// la cuenta demo sigue saliendo del diccionario compartido. Sólo se alcanza en el merchant 1.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El handler REAL de `dist/` con la base doblada (`_envio-doblado.mjs`). La baja y los topes pasan
// por los guards de verdad de `whatsapp.ts` (dry-run). Lo que contesta Meta NO se puede provocar en
// dry-run: ahí se dobla `sendWhatsAppWindowFirst` con la forma que devuelve su `catch`.
// ⚠️ Lo que provoca cada caso lo fabrica el caso. Lo que se mide es la frase de la ruta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTA = '../dist/modules/system/app/routes/quotesAdmin.routes.js';
const WA = '../dist/integrations/whatsapp.js';
const SERVICIO = '../dist/modules/quotes/domain/sendQuote.service.js';
const requiere = createRequire(import.meta.url);
const { SEND_FAILURE_MESSAGES } = requiere('../dist/lib/sendOutcome.js');

const TEL = '34000000001';
const A = 'No sabemos si el WhatsApp ha salido. Pregúntale a tu cliente antes de volver a enviarlo.';
const C = 'El WhatsApp no ha salido: has alcanzado el tope diario de mensajes. Vuelve a intentarlo mañana o envía el enlace por email.';
const E = 'El WhatsApp no ha salido: este cliente pidió no recibir tus mensajes por WhatsApp. Envíale el enlace por email o SMS.';
const D = 'El WhatsApp no ha salido: YaQu limita los mensajes diarios a un mismo cliente para no saturarlo. Vuelve a intentarlo mañana o envía el enlace por email.';

/**
 * Manda el presupuesto por la ruta. `meta` es lo que contestaría `sendWhatsAppWindowFirst`; sin
 * él, el envío pasa por los guards reales y acaba en el buzón del dry-run.
 */
async function enviar({ respuestas = {}, merchantId = MERCHANT, pais = 'ES', meta } = {}) {
  const quote = {
    id: 7, merchantId, customerId: CLIENTE, status: 'sent', quoteNumber: 12, total: '150.00', currency: 'EUR',
    decisionToken: 'tok-1465-de-laboratorio',
    merchant: { id: merchantId, name: 'Taller de prueba', legalName: null, country: pais },
    customer: { id: CLIENTE, name: 'Cliente de prueba', phone: TEL, mobile: null },
  };
  inyectarBase({ 'quote.findUnique': () => quote, ...respuestas }, [RUTA]);
  const fWa = requiere.resolve(WA);
  if (meta !== undefined) {
    const real = requiere(WA);
    requiere.cache[fWa] = { id: fWa, filename: fWa, loaded: true, exports: { ...real, sendWhatsAppWindowFirst: async () => meta } };
    delete requiere.cache[requiere.resolve(SERVICIO)];
    delete requiere.cache[requiere.resolve(RUTA)];
  }
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    const router = moduloDeDist(RUTA).default;
    const capa = router.stack.find((l) => l.route && l.route.path === '/:id/send-whatsapp' && l.route.methods.post);
    assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/send-whatsapp');
    const h = capa.route.stack[capa.route.stack.length - 1].handle;
    const r = { status: 200, cuerpo: null };
    const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
    await h(reqDeSesion({ rol: 'admin', merchantId, params: { id: '7' }, body: {}, headers: {} }), res);
    return { ...r, buzon };
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
    if (meta !== undefined) delete requiere.cache[fWa];
  }
}

/** Un envío que se intentó y no salió: 200, `sent:false`, y nada en el buzón. */
function noSalio(r, motivo) {
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, motivo);
  assert.equal(r.buzon.length, 0);
}

const laBaja = { 'customer.findMany': () => [{ phone: TEL, mobile: null }] };
const elTopeDelNegocio = { 'whatsAppMessage.count': (a) => (a?.where?.customerId ? 0 : 100) };
const elTopePorCliente = { 'whatsAppMessage.count': (a) => (a?.where?.customerId ? 3 : 0) };
const metaDiceQueNo = { ok: false, via: 'template', error: { error: { message: '(#131026) Message undeliverable', code: 131026 } } };
const metaNoContesta = { ok: false, via: 'template', error: 'timeout of 10000ms exceeded' };

test('SCRUM-1465 · frases · SUELO: sin nada que lo impida el WhatsApp sale y no hay frase de fallo', async () => {
  const r = await enviar();
  assert.equal(r.buzon.length, 1, '🔴 CIEGO: el mensaje no llega al buzón; los casos de abajo no medirían la ruta');
  assert.equal(r.cuerpo.sent, true);
  assert.equal(r.cuerpo.message, undefined);
});

test('SCRUM-1465 · frases · E: con el cliente dado de baja se lee la frase firmada', async () => {
  const r = await enviar({ respuestas: laBaja });
  noSalio(r, 'wa_opt_out');
  assert.equal(r.cuerpo.message, E);
});

test('SCRUM-1465 · frases · C: con el tope diario del negocio se lee la frase firmada', async () => {
  const r = await enviar({ respuestas: elTopeDelNegocio });
  noSalio(r, 'daily_cap');
  assert.equal(r.cuerpo.message, C);
});

test('SCRUM-1465 · frases · 🔴 A: Meta dice que no → la persona NO lee el texto de Meta', async () => {
  const r = await enviar({ meta: metaDiceQueNo });
  noSalio(r, 'whatsapp_send_failed');
  assert.equal(r.cuerpo.message, A);
  assert.ok(!r.cuerpo.message.includes('131026') && !r.cuerpo.message.includes('undeliverable'),
    '🔴 el texto de Meta, en inglés y con su código, ha llegado a la frase que lee el profesional');
  assert.deepEqual(r.cuerpo.detail, metaDiceQueNo.error, '🔴 el motivo de Meta se ha PERDIDO: tiene que seguir en `detail`');
});

test('SCRUM-1465 · frases · 🔴 A: Meta no contesta a tiempo → no se afirma que no salió ni se manda reintentar', async () => {
  const r = await enviar({ meta: metaNoContesta });
  noSalio(r, 'whatsapp_send_failed');
  assert.equal(r.cuerpo.message, A);
  assert.ok(!r.cuerpo.message.includes('timeout'), '🔴 el error de red crudo ha llegado a la persona');
  assert.ok(!/reintent/i.test(r.cuerpo.message),
    '🔴 se manda reintentar un envío que puede haber salido: el cliente lo recibiría dos veces');
});

test('SCRUM-1465 · frases · A: si no llegamos a mandarlo ya no se dice que «WhatsApp rechazó el envío»', async () => {
  const r = await enviar({ meta: { ok: false, via: 'template', reason: 'not_configured' } });
  noSalio(r, 'whatsapp_send_failed');
  // La frase entera, por identidad: antes aquí se leía «…WhatsApp rechazó el envío…», y WhatsApp
  // no había rechazado nada.
  assert.equal(r.cuerpo.message, A, '🔴 se culpa a WhatsApp de un envío que no llegó a intentarse');
});

test('SCRUM-1465 · frases · 🔴 las tres frases no llevan la palabra del documento, tampoco con un negocio de México', async () => {
  const leidas = [
    (await enviar({ respuestas: laBaja, pais: 'MX' })).cuerpo.message,
    (await enviar({ respuestas: elTopeDelNegocio, pais: 'MX' })).cuerpo.message,
    (await enviar({ meta: metaDiceQueNo, pais: 'MX' })).cuerpo.message,
  ];
  assert.deepEqual(leidas, [E, C, A], '🔴 la frase cambia con el país: algo la está componiendo con la palabra del documento');
  // Control del detector: ve la palabra de los dos países cuando está (SCRUM-237).
  assert.match('Hemos guardado tu presupuesto', /presupuesto|cotizaci/i);
  assert.match('Hemos guardado tu cotización', /presupuesto|cotizaci/i);
  for (const frase of leidas) {
    assert.doesNotMatch(frase, /presupuesto|cotizaci/i, `🔴 «${frase}» nombra el documento: con «la cotización» no concordaría`);
  }
});

test('SCRUM-1465 · frases · D: con el tope diario por cliente se lee la frase firmada, que dice de quién es el límite', async () => {
  const r = await enviar({ respuestas: elTopePorCliente });
  noSalio(r, 'customer_daily_cap');
  assert.equal(r.cuerpo.message, D);
  // El límite lo pone YaQu (`WA_CUSTOMER_DAILY_CAP`). La primera firma decía «WhatsApp no deja
  // mandarle más», y no era verdad.
  assert.match(r.cuerpo.message, /YaQu limita/);
});

test('SCRUM-1465 · frases · CONTROL: la cuenta demo sigue con la frase del diccionario', async () => {
  const r = await enviar({ merchantId: 1 });
  noSalio(r, 'demo_safe_numbers');
  assert.equal(r.cuerpo.message, SEND_FAILURE_MESSAGES.demo_safe_numbers);
});

// tests/scrum1478-la-factura-que-no-sale.test.mjs — SCRUM-1478
//
// 🔴 LO QUE LEE EL PROFESIONAL CUANDO UNA FACTURA NO SALE.
//
// Recordar un pago o mandar la factura por correo pueden no salir, y la ruta le dice por qué.
// Esas frases venían del diccionario compartido (`SEND_FAILURE_MESSAGES`), y dos no valían aquí:
//
//     tope diario → «…Vuelve a intentarlo mañana o envíalo por email.»   (un pronombre que apunta
//                    al documento: de una factura sería «envíala», y la palabra cambia con el país)
//     correo      → «No se pudo enviar el email. Puedes reintentarlo.»    (afirma que no salió; si el
//                    proveedor no contestó a tiempo puede haber salido, y reintentar lo duplica)
//
// Ahora la factura lee las frases firmadas para el presupuesto (SCRUM-1465), LETRA A LETRA. El
// diccionario no se toca. El último caso compara cada frase con las fichas de `docs/microcopy/`:
// si alguien cambia una letra en el código, eso ya es texto nuevo y este fichero lo dice.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Los handlers REALES de `dist/`, con la base doblada (`_envio-doblado.mjs`). El WhatsApp va por
// el dry-run de la casa: pasa todos los guards (baja, topes) y sólo se salta la llamada a Meta.
// El correo se dobla en su módulo, que es lo que la ruta importa. No sale nada a la red.
// ⚠️ Lo que NO mide: que el correo «puede haber salido» cuando el proveedor no contesta. Eso es
// del envío de correo (`enviarPorResend`, 10 s de espera) y aquí se da por medido en SCRUM-1465.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTA = '../dist/modules/system/app/routes/invoicesAdmin.routes.js';
const CORREO = '../dist/modules/messaging/domain/email.service.js';
const SERVICIO = '../dist/modules/billing/domain/invoiceWhatsApp.service.js';
const FRASES = '../dist/modules/invoicing/domain/envioQueNoSale.js';
const DICCIONARIO = '../dist/lib/sendOutcome.js';
const requiere = createRequire(import.meta.url);
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TOPE_DEL_NEGOCIO = 'El WhatsApp no ha salido: has alcanzado el tope diario de mensajes. Vuelve a intentarlo mañana o envía el enlace por email.';
const BAJA = 'El WhatsApp no ha salido: este cliente pidió no recibir tus mensajes por WhatsApp. Envíale el enlace por email o SMS.';
const CORREO_NO_SE_SABE = 'No sabemos si el email ha salido. Pregúntale a tu cliente antes de volver a enviarlo.';

/** Un pronombre pegado al verbo que apunta al documento: «envíalo», «envíala», «mándaselo»… */
const PRONOMBRE_AL_DOCUMENTO = /env[ií]al[oa]\b|m[aá]ndasel[oa]\b/i;
/** Una orden de volver a mandarlo. */
const MANDA_REINTENTAR = /reint[eé]nt|vuelve a enviar/i;

const factura = {
  id: 7, merchantId: MERCHANT, customerId: CLIENTE, number: 'F260007', status: 'pending', total: '419.87', currency: 'EUR',
  chargeId: 90, reminder7SentAt: null, reminder14SentAt: null,
  merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
  customer: { id: CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null, email: 'cliente@example.invalid' },
};
const COBRO = { 'charge.findUnique': () => ({ id: 90, receiptToken: 'tok-1478-de-laboratorio' }) };

/** Llama al handler de la ruta con la consola callada: los casos de fallo escriben en ella a propósito. */
async function llamar(camino) {
  const router = moduloDeDist(RUTA).default;
  assert.ok(router && Array.isArray(router.stack), '🔴 CIEGO: no encuentro el router de facturas');
  const capa = router.stack.find((l) => l.route && l.route.path === camino && l.route.methods.post);
  assert.ok(capa, `🔴 CIEGO: no encuentro POST ${camino}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body: {}, headers: {} }), res);
  } finally {
    console.error = error;
    console.warn = aviso;
  }
  return r;
}

async function recordar(respuestas = {}) {
  inyectarBase({ 'invoice.findFirst': () => factura, ...COBRO, ...respuestas }, [RUTA]);
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    return { ...(await llamar('/:id/send-reminder')), buzon };
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
}

async function enviarPorCorreo({ elCorreo = async () => ({}) } = {}) {
  const salieron = [];
  inyectarBase({ 'invoice.findFirst': () => factura }, [RUTA]);
  const fCorreo = requiere.resolve(CORREO);
  requiere.cache[fCorreo] = {
    id: fCorreo, filename: fCorreo, loaded: true,
    exports: { sendInvoiceEmail: async (a) => { const r = await elCorreo(a); salieron.push(a.invoiceId); return r; } },
  };
  try {
    return { ...(await llamar('/:id/send-email')), salieron };
  } finally {
    delete requiere.cache[fCorreo];
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RECORDATORIO DE PAGO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1478 · recordatorio · SUELO: el que hoy sale, sale igual y la ruta dice que salió', async () => {
  const r = await recordar();
  assert.equal(r.buzon.length, 1, '🔴 CIEGO: el mensaje no ha llegado al buzón de pruebas');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, true);
  assert.equal(r.cuerpo.error, undefined);
  assert.equal(r.cuerpo.message, undefined, '🔴 un envío que salió no lleva frase de fallo');
});

test('SCRUM-1478 · recordatorio · 🔴 con el tope diario alcanzado, la frase no lleva un pronombre que apunte al documento', async () => {
  const r = await recordar({ 'whatsAppMessage.count': () => 99999 });
  assert.equal(r.buzon.length, 0, '🔴 CIEGO: con el tope alcanzado no tenía que salir nada');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'daily_cap', 'el motivo para la máquina no cambia');
  assert.equal(PRONOMBRE_AL_DOCUMENTO.test(r.cuerpo.message), false,
    `🔴 el profesional lee «${r.cuerpo.message}»: «envíalo» apunta a «la factura»`);
  assert.equal(r.cuerpo.message, TOPE_DEL_NEGOCIO);
  // El positivo del detector: la frase del diccionario SÍ lleva el pronombre, y la expresión lo ve.
  const { SEND_FAILURE_MESSAGES } = moduloDeDist(DICCIONARIO);
  assert.equal(PRONOMBRE_AL_DOCUMENTO.test(SEND_FAILURE_MESSAGES.daily_cap), true,
    '🔴 CIEGO: la frase del diccionario ya no lleva «envíalo»; el detector de arriba no prueba nada');
});

test('SCRUM-1478 · recordatorio · con el cliente dado de baja, lee la frase de la baja y no sale nada', async () => {
  const r = await recordar({ 'customer.findMany': () => [{ phone: '34000000001', mobile: null }] });
  assert.equal(r.buzon.length, 0);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'wa_opt_out');
  assert.equal(r.cuerpo.message, BAJA);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL REENVÍO POR WHATSAPP — aquí el defecto era otro: no se decía el motivo
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// `sendInvoicePaymentRequest` contesta `whatsapp_send_failed` para CUALQUIER fallo del envío, y la
// ruta leía eso: con el cliente dado de baja o con el tope alcanzado, el profesional leía «No se
// pudo enviar por WhatsApp…» y no podía saber que su cliente había pedido no recibir sus mensajes.
//
// 🔴 El arreglo es ADITIVO, y los dos últimos casos fijan las dos mitades. `reason` SIGUE aplanado:
// lo lee `POST /admin/jobs/:id/collect-rest` (otro carril) y lo traduce con el diccionario, así que
// desaplanarlo cambiaría esa ruta. El motivo real viaja en un campo nuevo, `motivoDelEnvio`, que
// sólo lee esta ruta. Quien «limpie» el campo viejo rompe `collect-rest`: por eso está el test.

const BASE_REENVIO = { 'invoice.findUnique': () => factura, ...COBRO };
const DE_BAJA = { 'customer.findMany': () => [{ phone: '34000000001', mobile: null }] };
const TOPE_NEGOCIO = { 'whatsAppMessage.count': () => 99999 };
/** Sólo el recuento POR CLIENTE da el tope: el del negocio no, así que el que salta es el otro. */
const TOPE_CLIENTE = { 'whatsAppMessage.count': (a) => (a?.where?.customerId ? 99999 : 0) };
const TOPE_POR_CLIENTE = 'El WhatsApp no ha salido: YaQu limita los mensajes diarios a un mismo cliente para no saturarlo. Vuelve a intentarlo mañana o envía el enlace por email.';

async function reenviar(respuestas = {}) {
  inyectarBase({ ...BASE_REENVIO, ...respuestas }, [RUTA, SERVICIO]);
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    return { ...(await llamar('/:id/resend-whatsapp')), buzon };
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
}

/** El servicio a solas, como lo llama `collect-rest`: lo que devuelve, sin ruta por medio. */
async function elServicio(respuestas = {}) {
  inyectarBase({ ...BASE_REENVIO, ...respuestas }, [SERVICIO]);
  const { sendInvoicePaymentRequest } = moduloDeDist(SERVICIO);
  assert.equal(typeof sendInvoicePaymentRequest, 'function', '🔴 CIEGO: no encuentro sendInvoicePaymentRequest');
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    return { resultado: await sendInvoicePaymentRequest(7), buzon };
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
  }
}

test('SCRUM-1478 · reenvío · SUELO: el que hoy sale, sale igual, con su cobro y su enlace', async () => {
  const r = await reenviar();
  assert.equal(r.buzon.length, 1, '🔴 CIEGO: el mensaje no ha llegado al buzón de pruebas');
  assert.equal(r.status, 200);
  assert.deepEqual(r.cuerpo, { ok: true, sent: true, invoice_id: 7, charge_id: 90, pay_token: 'tok-1478-de-laboratorio', to: '34000000001' });
});

test('SCRUM-1478 · reenvío · 🔴 con el cliente dado de baja, el profesional lee que es una BAJA', async () => {
  const r = await reenviar(DE_BAJA);
  assert.equal(r.buzon.length, 0, '🔴 CIEGO: a un cliente dado de baja no tenía que salirle nada');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'wa_opt_out',
    `🔴 su cliente pidió no recibir sus mensajes y la ruta contesta «${r.cuerpo.error}»: «${r.cuerpo.message}»`);
  assert.equal(r.cuerpo.message, BAJA);
  // Lo que la pantalla necesita para ofrecer «Copiar enlace» sigue viniendo.
  assert.equal(r.cuerpo.charge_id, 90);
  assert.equal(r.cuerpo.pay_token, 'tok-1478-de-laboratorio');
});

test('SCRUM-1478 · reenvío · 🔴 con el tope diario del negocio, lee el tope y sin pronombre al documento', async () => {
  const r = await reenviar(TOPE_NEGOCIO);
  assert.equal(r.buzon.length, 0);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'daily_cap');
  assert.equal(r.cuerpo.message, TOPE_DEL_NEGOCIO);
});

test('SCRUM-1478 · reenvío · 🔴 con el tope por cliente, lee de quién es el límite', async () => {
  const r = await reenviar(TOPE_CLIENTE);
  assert.equal(r.buzon.length, 0);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'customer_daily_cap');
  assert.equal(r.cuerpo.message, TOPE_POR_CLIENTE);
});

test('SCRUM-1478 · servicio · el motivo REAL del envío viaja en `motivoDelEnvio`', async () => {
  const casos = [[DE_BAJA, 'wa_opt_out'], [TOPE_NEGOCIO, 'daily_cap'], [TOPE_CLIENTE, 'customer_daily_cap']];
  for (const [respuestas, motivo] of casos) {
    const { resultado, buzon } = await elServicio(respuestas);
    assert.equal(buzon.length, 0, `🔴 CIEGO: con ${motivo} no tenía que salir nada`);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.motivoDelEnvio, motivo);
  }
});

test('SCRUM-1478 · servicio · 🔴 `reason` SIGUE aplanado: es lo que lee collect-rest, y no cambia', async () => {
  const casos = [[DE_BAJA, 'wa_opt_out'], [TOPE_NEGOCIO, 'daily_cap'], [TOPE_CLIENTE, 'customer_daily_cap']];
  for (const [respuestas, motivo] of casos) {
    const { resultado } = await elServicio(respuestas);
    assert.equal(resultado.ok, false, `🔴 CIEGO: con ${motivo} el envío tenía que fallar`);
    assert.equal(resultado.reason, 'whatsapp_send_failed',
      `🔴 con ${motivo} el servicio contesta reason=«${resultado.reason}»: POST /admin/jobs/:id/collect-rest lo lee y `
      + 'empezaría a enseñar otra frase. Si eso se quiere, es otro ticket y de otro carril');
    assert.equal(resultado.chargeId, 90);
    assert.equal(resultado.payToken, 'tok-1478-de-laboratorio');
  }
  // El positivo: cuando sale, no hay ni motivo aplanado ni motivo real.
  const { resultado, buzon } = await elServicio();
  assert.equal(buzon.length, 1, '🔴 CIEGO: el envío que tenía que salir no ha salido');
  assert.deepEqual(resultado, { ok: true, chargeId: 90, payToken: 'tok-1478-de-laboratorio', to: '34000000001' });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CORREO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1478 · correo · SUELO: el que hoy sale, sale igual y la ruta dice que salió', async () => {
  const r = await enviarPorCorreo();
  assert.equal(r.salieron.length, 1, '🔴 CIEGO: el doble del correo no ha recibido el envío');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, true);
  assert.equal(r.cuerpo.to, 'cliente@example.invalid');
});

test('SCRUM-1478 · correo · 🔴 si el envío falla, la frase no afirma que no salió ni manda reintentar', async () => {
  const r = await enviarPorCorreo({ elCorreo: async () => { throw new Error('el proveedor de correo no contesta'); } });
  assert.equal(r.salieron.length, 0);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.sent, false);
  assert.equal(r.cuerpo.error, 'email_send_failed', 'el motivo para la máquina no cambia');
  assert.equal(MANDA_REINTENTAR.test(r.cuerpo.message), false,
    `🔴 el profesional lee «${r.cuerpo.message}»: si el correo salió, reintentar se lo manda dos veces al cliente`);
  assert.equal(r.cuerpo.message, CORREO_NO_SE_SABE);
  // El positivo del detector: la frase del diccionario SÍ manda reintentar, y la expresión lo ve.
  const { SEND_FAILURE_MESSAGES } = moduloDeDist(DICCIONARIO);
  assert.equal(MANDA_REINTENTAR.test(SEND_FAILURE_MESSAGES.email_send_failed), true,
    '🔴 CIEGO: la frase del diccionario ya no manda reintentar; el detector de arriba no prueba nada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS FRASES: NI UNA LETRA DISTINTA DE LAS FIRMADAS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1478 · cada frase de la factura está, letra a letra, en las fichas firmadas del presupuesto', () => {
  // Por la superficie que tiene consumidor (`falloDeEnvioDeFactura`), no por la tabla de dentro:
  // se le pregunta por TODOS los motivos de la casa y se queda con los que no leen el diccionario.
  const { falloDeEnvioDeFactura } = moduloDeDist(FRASES);
  const { SEND_FAILURE_MESSAGES } = moduloDeDist(DICCIONARIO);
  const motivos = Object.keys(SEND_FAILURE_MESSAGES);
  assert.ok(motivos.length >= 9, `🔴 CIEGO: el diccionario de la casa sólo trae ${motivos.length} motivos`);
  const frases = motivos.map((m) => [m, falloDeEnvioDeFactura(m).message]).filter(([m, frase]) => frase !== SEND_FAILURE_MESSAGES[m]);
  assert.deepEqual(frases.map(([motivo]) => motivo).sort(),
    ['customer_daily_cap', 'daily_cap', 'email_send_failed', 'wa_opt_out'],
    '🔴 la lista de motivos con frase propia ha cambiado: una frase más es un texto más, y pide firma');

  const dir = path.join(RAIZ, 'docs', 'microcopy');
  const fichas = fs.readdirSync(dir).filter((f) => /^2026-10-06-SCRUM-1465-.+\.md$/.test(f));
  assert.equal(fichas.length, 2, `🔴 CIEGO: esperaba las dos fichas de SCRUM-1465 y hay ${fichas.length}`);
  // Sólo las líneas de cita: es donde las fichas guardan el texto aprobado.
  const firmadas = new Set(fichas.flatMap((f) =>
    fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).filter((l) => l.startsWith('> ')).map((l) => l.slice(2).trim())));
  assert.ok(firmadas.size >= 5, `🔴 CIEGO: sólo he leído ${firmadas.size} frases firmadas en ${fichas.length} fichas`);

  for (const [motivo, frase] of frases) {
    assert.ok(firmadas.has(frase), `🔴 la frase de «${motivo}» no está letra a letra entre las ${firmadas.size} firmadas: «${frase}»`);
    assert.equal(PRONOMBRE_AL_DOCUMENTO.test(frase), false, `🔴 la frase de «${motivo}» lleva un pronombre que apunta al documento`);
  }
});

test('SCRUM-1478 · CONTROL: un motivo sin frase propia sigue leyendo el diccionario, y el contrato no cambia', () => {
  const { falloDeEnvioDeFactura } = moduloDeDist(FRASES);
  const { sendFailureBody, SEND_FAILURE_MESSAGES } = moduloDeDist(DICCIONARIO);
  assert.deepEqual(falloDeEnvioDeFactura('not_configured', { via: 'text' }), sendFailureBody('not_configured', { via: 'text' }));
  assert.equal(falloDeEnvioDeFactura('not_configured').message, SEND_FAILURE_MESSAGES.not_configured);
  // Con frase propia cambia SÓLO la frase: mismos campos, mismo motivo, mismo `sent`.
  const propia = falloDeEnvioDeFactura('daily_cap', { via: 'template', phone: '34000000001' });
  const deLaCasa = sendFailureBody('daily_cap', { via: 'template', phone: '34000000001' });
  assert.deepEqual({ ...propia, message: null }, { ...deLaCasa, message: null });
  assert.notEqual(propia.message, deLaCasa.message);
});

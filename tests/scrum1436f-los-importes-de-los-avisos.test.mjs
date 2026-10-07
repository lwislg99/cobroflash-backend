// tests/scrum1436f-los-importes-de-los-avisos.test.mjs — SCRUM-1436 (hallazgo 4, la parte de J2)
//
// 🔴 EL IMPORTE EN CRUDO: «1419.87 EUR» donde la casa escribe «1.419,87 €».
//
// `tests/scrum1436d-los-importes-en-crudo.test.mjs` cubre los cuatro sitios del carril J1. Aquí van
// los SIETE del carril J2, más la página que lee el cliente final al volver de Mercado Pago:
//
//   · cobro confirmado (`psp.routes.ts`): la línea del historial y las dos vías del aviso al
//     profesional (texto libre y variable de `merchant_alert_es`);
//   · Mercado Pago (`mpWebhook.routes.ts`): las mismas tres;
//   · «dice que te ha enviado … por Bizum» (`payBizum.routes.ts`): las dos vías del aviso, que
//     salen de una sola línea;
//   · `GET /pay/mp/:token/result` (`payMp.routes.ts`): el importe, en sus cuatro estados.
//
// El banco es el que escribió J1 y dejó propuesto en
// `docs/master/evidencias/SCRUM-1436/propuesto-j2-los-importes-de-los-avisos.test.mjs.txt`.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Los handlers REALES de `dist/`, con la base doblada y el WhatsApp en dry-run. Lo que se lee es
// lo que sale: la fila que se escribe en `customerEvent`, el HTML, y lo que cada ruta le pasa a
// `notifyMerchantPaid` / `notifyMerchantAlert` (el módulo real, envuelto para apuntar sus
// argumentos; el envío sigue ocurriendo y cae en el buzón).
//
// ⚠️ Ningún importe esperado está tecleado: sale de `formatMoneyEs`, que separa la cifra del
// símbolo con un espacio DURO (código 160) y uno tecleado no casa. El primer caso comprueba que
// ese helper sigue dando lo que este fichero cree.
//
// ⚠️ Lo que NO mide: que Meta acepte el valor en la variable de la plantilla. `disputes.service.ts`
// ya manda la salida de `formatMoneyEs` en esa misma variable (lo dejó escrito SCRUM-931).
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4436; // no es el 1: el demo tiene su propio freno de envío (V0-2)
const CLIENTE = 57;
const COBRO = 2436;
const FACTURA = 7;
const TEL_PRO = '34000001436'; // rango imposible (SCRUM-262)
const TEL_CLIENTE = '34000001437';
const TOTAL = '1419.87'; // cuatro cifras enteras: es donde `es-ES` no agrupa solo (SCRUM-743)
const NUMERO = 'F260007';
const DURO = String.fromCharCode(160);
const sinDuro = (s) => String(s).split(DURO).join(' ');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
/** El formato que se retira: cifra con punto decimal seguida del código de moneda. */
const CRUDO = /\d\.\d{1,2} [A-Z]{3}\b/;

const banco = { eventos: [], avisos: [], cobro: null, factura: null, pagoMp: null };

function reiniciar({ importe = TOTAL, moneda = 'EUR', numero = NUMERO } = {}) {
  banco.eventos = [];
  banco.avisos = [];
  banco.cobro = {
    id: COBRO, merchantId: M, customerId: CLIENTE, status: 'pending', amount: importe, currency: moneda,
    method: 'card', concept: 'Reparación', reference: null, intentId: null, receiptToken: 'tok_1436',
    customer: { id: CLIENTE, name: 'Cliente de prueba', phone: TEL_CLIENTE, mobile: null, email: null },
    merchant: { id: M, name: 'Taller de prueba', legalName: null, whatsappPhone: TEL_PRO, googleReviewUrl: null, country: 'ES' },
  };
  banco.factura = { id: FACTURA, merchantId: M, customerId: CLIENTE, number: numero, status: 'pending', total: importe, currency: moneda, chargeId: COBRO };
  banco.pagoMp = { status: 'approved', externalReference: `charge_${COBRO}`, amount: Number(importe), currency: moneda, method: 'card' };
}
reiniciar();

const doble = dobleDeLaBase({
  'customerEvent.create': (a) => { banco.eventos.push(a.data); return a.data; },
  'invoice.findUnique': () => ({ ...banco.factura }),
  'invoice.findFirst': () => ({ ...banco.factura }),
  'invoice.update': () => ({ ...banco.factura }),
  'charge.findUnique': () => ({ ...banco.cobro }),
  'charge.update': (a) => {
    const { reconciliations, ...datos } = a?.data ?? {};
    Object.assign(banco.cobro, datos);
    return { ...banco.cobro };
  },
  'merchant.findUnique': () => ({ ...banco.cobro.merchant, timezone: 'Europe/Madrid', email: null, notifyEmailOnPaid: false }),
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
for (const [r, exports] of [
  ['dist/lib/email.js', { sendInvoiceEmail: async () => {} }],
  ['dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async () => ({ id: FACTURA, number: banco.factura.number, status: 'issued', pdfUrl: '/x.pdf' }),
    ensureInvoicePdf: async () => ({ diskPath: null, pdfUrl: '/x.pdf' }),
    ensureChargeReceiptToken: async () => 'tok_1436',
  }],
  // Mercado Pago: ni firma real ni llamada a su API. Se mide lo que la ruta hace DESPUÉS.
  ['dist/integrations/mercadopago.js', {
    verifyMpWebhookSignature: () => true,
    getMpPayment: async () => ({ ...banco.pagoMp }),
  }],
]) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

// El módulo REAL de avisos al profesional, envuelto: apunta lo que cada ruta le pasa y lo ejecuta.
const fAvisos = rutaDe('dist/integrations/whatsappNotifications.js');
const avisosDeVerdad = requiere(fAvisos);
const apuntando = (nombre) => async (params) => {
  banco.avisos.push({ nombre, freeText: params.freeText, detail: params.detail });
  return avisosDeVerdad[nombre](params);
};
requiere.cache[fAvisos].exports = {
  ...avisosDeVerdad,
  notifyMerchantPaid: apuntando('notifyMerchantPaid'),
  notifyMerchantAlert: apuntando('notifyMerchantAlert'),
};

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const { formatMoneyEs } = requiere(rutaDe('dist/core/utils/utils.js'));
const { buildMerchantAlert, validateTemplateComponents } = requiere(rutaDe('dist/integrations/whatsappTemplates.js'));

const handlerDe = (modulo, metodo, ruta) => {
  const m = requiere(rutaDe(modulo));
  const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const pspH = handlerDe('dist/modules/billing/app/routes/psp.routes.js', 'post', '/');
const mpH = handlerDe('dist/modules/billing/app/routes/mpWebhook.routes.js', 'post', '/');
const bizumH = handlerDe('dist/modules/billing/app/routes/payBizum.routes.js', 'post', '/bizum/:token/claimed');
const resultadoMpH = handlerDe('dist/modules/billing/app/routes/payMp.routes.js', 'get', '/mp/:token/result');

/** Llama a un handler y devuelve lo que contestó, con el buzón de WhatsApp de esa llamada. */
async function llamar(handle, req) {
  const r = { statusCode: 200, cuerpo: null, html: null, buzon: [] };
  const res = {
    status(c) { r.statusCode = c; return res; },
    json(x) { r.cuerpo = x; return res; },
    type() { return res; },
    set() { return res; },
    setHeader() { return res; },
    send(x) { r.html = x; return res; },
    redirect() { return res; },
  };
  const antes = {
    AUTO_INVOICE_ON_PAID: config.AUTO_INVOICE_ON_PAID,
    AUTO_EMAIL_INVOICE_ON_PAID: config.AUTO_EMAIL_INVOICE_ON_PAID,
    MP_WEBHOOK_SECRET: config.MP_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN: config.MP_ACCESS_TOKEN,
  };
  // Los dos valores de Mercado Pago son relleno: la firma y la consulta del pago están dobladas.
  Object.assign(config, {
    AUTO_INVOICE_ON_PAID: true, AUTO_EMAIL_INVOICE_ON_PAID: false,
    MP_WEBHOOK_SECRET: 'relleno-de-test', MP_ACCESS_TOKEN: 'relleno-de-test',
  });
  globalThis.__waDryRunOutbox = r.buzon;
  try {
    await handle(req, res, (e) => { if (e) throw e; });
    await esperar(60); // los avisos son fire-and-forget
  } finally {
    delete globalThis.__waDryRunOutbox;
    Object.assign(config, antes);
  }
  return r;
}

/** El único aviso al profesional de la llamada; falla si no hubo exactamente uno. */
function elAviso(nombre) {
  assert.equal(banco.avisos.length, 1, `🔴 CIEGO: se esperaba un aviso al profesional y hubo ${banco.avisos.length}`);
  assert.equal(banco.avisos[0].nombre, nombre);
  return banco.avisos[0];
}
/** La única línea de historial con ese tipo; falla si no hay exactamente una. */
function elEvento(tipo) {
  const filas = banco.eventos.filter((e) => e.type === tipo);
  assert.equal(filas.length, 1, `🔴 CIEGO: se esperaba una línea «${tipo}» en el historial y hay ${filas.length}`);
  return filas[0];
}
/** El único mensaje que salió hacia ese teléfono; falla si no hay exactamente uno. */
function elMensajeA(buzon, telefono) {
  const suyos = buzon.filter((m) => m.to === telefono);
  assert.equal(suyos.length, 1, `🔴 CIEGO: a ${telefono} no le ha salido exactamente un mensaje (${suyos.length})`);
  return suyos[0];
}
const confirmar = () => llamar(pspH, { body: { event: 'payment.confirmed', charge_id: COBRO }, headers: {} });

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-1436f · SUELO: el helper da «1.419,87 €» con espacio duro, y el patrón del crudo distingue', () => {
  const bueno = formatMoneyEs(TOTAL, 'EUR');
  assert.equal(sinDuro(bueno), '1.419,87 €');
  assert.ok(bueno.includes(DURO), '🔴 `formatMoneyEs` ya no separa con espacio duro: revisa las comparaciones de este fichero');
  assert.ok(CRUDO.test('1419.87 EUR'), '🔴 CIEGO: el patrón no reconoce el formato que viene a retirar');
  assert.ok(CRUDO.test('419.8 EUR'), '🔴 CIEGO: el patrón no reconoce el importe sin su segundo decimal');
  assert.ok(!CRUDO.test(bueno), '🔴 el patrón del crudo casa con el formato bueno: no distingue nada');
  assert.ok(!CRUDO.test(formatMoneyEs(TOTAL, 'MXN')), '🔴 el patrón del crudo casa con el formato bueno fuera del euro');
});

// ═══ COBRO CONFIRMADO (psp.routes.ts) ════════════════════════════════════════════════════════

test('SCRUM-1436f · 🔴 cobro confirmado: el WhatsApp al profesional y el historial dicen «1.419,87 €»', async () => {
  reiniciar();
  const r = await confirmar();
  assert.equal(r.cuerpo?.ok, true, `🔴 CIEGO: el webhook no ha confirmado el cobro (${JSON.stringify(r.cuerpo)})`);
  const bueno = formatMoneyEs(TOTAL, 'EUR');
  const aviso = elAviso('notifyMerchantPaid');
  assert.equal(aviso.freeText, `💰 Pago recibido de Cliente de prueba: ${bueno}`);
  assert.equal(aviso.detail, `${bueno} · ${NUMERO}`);
  // Y lo que sale de verdad hacia el teléfono del profesional es ese texto.
  assert.equal(elMensajeA(r.buzon, TEL_PRO).text, aviso.freeText);
  assert.equal(elEvento('payment_received').detail, `${bueno} · Factura ${NUMERO}`);
  for (const t of [aviso.freeText, aviso.detail, elEvento('payment_received').detail]) {
    assert.ok(!CRUDO.test(t), `🔴 importe en crudo: «${t}»`);
  }
});

test('SCRUM-1436f · ✅ cobro confirmado: la FRASE no cambia, sólo la forma de la cifra', async () => {
  // El positivo: quitando el importe, lo que queda es letra por letra lo que ya había.
  const sinImporte = (s) => sinDuro(s).replace(/\d[\d.,]* (€|[A-Z]{3}(?![A-Za-z]))/g, '#');
  reiniciar();
  await confirmar();
  const aviso = elAviso('notifyMerchantPaid');
  assert.equal(sinImporte(aviso.freeText), '💰 Pago recibido de Cliente de prueba: #');
  assert.equal(sinImporte(aviso.detail), `# · ${NUMERO}`);
  assert.equal(sinImporte(elEvento('payment_received').detail), `# · Factura ${NUMERO}`);
  // Y el instrumento distingue: la frase vieja da el MISMO esqueleto, y una palabra de más, otro.
  assert.equal(sinImporte('💰 Pago recibido de Cliente de prueba: 1419.87 EUR'), sinImporte(aviso.freeText));
  assert.notEqual(sinImporte('💰 Pago recibido de Cliente de prueba: total 1419.87 EUR'), sinImporte(aviso.freeText));
});

test('SCRUM-1436f · ✅ cobro confirmado: al CLIENTE le sigue saliendo su confirmación, la misma', async () => {
  // El mensaje al cliente lo arregló SCRUM-931 y no es de este ticket: recibe el importe como
  // número y lo formatea él. El buzón apunta la plantilla y el destino, NO sus variables: este
  // caso ve que el envío sigue saliendo igual, no el importe que lleva dentro.
  reiniciar();
  const r = await confirmar();
  assert.deepEqual(elMensajeA(r.buzon, TEL_CLIENTE), { kind: 'template', to: TEL_CLIENTE, templateName: 'payment_confirmation_invoice_es' });
  assert.equal(r.buzon.length, 2, `🔴 del cobro confirmado salen dos mensajes (cliente y profesional), y han salido ${r.buzon.length}`);
});

test('SCRUM-1436f · la variable de la plantilla sigue pasando el validador de la casa', async () => {
  reiniciar();
  await confirmar();
  const plantilla = buildMerchantAlert({ customerName: 'Cliente de prueba', action: 'te ha pagado', detail: elAviso('notifyMerchantPaid').detail });
  assert.doesNotThrow(() => validateTemplateComponents(plantilla.templateName, plantilla.components));
});

test('SCRUM-1436f · ✅ un justificante se sigue llamando justificante en el historial', async () => {
  reiniciar({ numero: 'J-2026-0007' });
  await confirmar();
  assert.equal(elEvento('payment_received').detail, `${formatMoneyEs(TOTAL, 'EUR')} · Justificante J-2026-0007`);
});

test('SCRUM-1436f · fuera del euro sale el código de la moneda, no un € impostado', async () => {
  reiniciar({ moneda: 'MXN' });
  await confirmar();
  const bueno = formatMoneyEs(TOTAL, 'MXN');
  assert.ok(sinDuro(bueno).endsWith(' MXN'), '🔴 CIEGO: el helper ya no escribe el código fuera del euro');
  assert.equal(elAviso('notifyMerchantPaid').freeText, `💰 Pago recibido de Cliente de prueba: ${bueno}`);
});

// ═══ MERCADO PAGO (mpWebhook.routes.ts) ══════════════════════════════════════════════════════

test('SCRUM-1436f · 🔴 Mercado Pago: el aviso no pinta el número tal como lo manda el proveedor', async () => {
  reiniciar({ importe: '1419.80' }); // el proveedor manda 1419.8: salía «1419.8 EUR»
  const r = await llamar(mpH, { body: { type: 'payment', data: { id: 'mp-1436' } }, headers: {} });
  assert.equal(banco.cobro.status, 'paid', '🔴 CIEGO: el webhook de Mercado Pago no ha marcado el cobro');
  const bueno = formatMoneyEs('1419.80', 'EUR');
  const aviso = elAviso('notifyMerchantPaid');
  assert.equal(aviso.freeText, `💰 Pago recibido (Mercado Pago) de Cliente de prueba: ${bueno}`);
  assert.equal(aviso.detail, `${bueno} · ${NUMERO}`);
  assert.equal(elMensajeA(r.buzon, TEL_PRO).text, aviso.freeText);
  assert.equal(elEvento('payment_received').detail, `${bueno} · Factura ${NUMERO}`);
  for (const t of [aviso.freeText, aviso.detail, elEvento('payment_received').detail]) {
    assert.ok(!CRUDO.test(t), `🔴 importe en crudo: «${t}»`);
  }
});

// ═══ BIZUM (payBizum.routes.ts) ══════════════════════════════════════════════════════════════

test('SCRUM-1436f · 🔴 «dice que te ha enviado … por Bizum»: las dos vías del aviso, en formato de la casa', async () => {
  reiniciar();
  banco.cobro.method = 'bizum_manual';
  const r = await llamar(bizumH, { params: { token: 'tok_1436' }, body: {}, headers: {} });
  const bueno = formatMoneyEs(TOTAL, 'EUR');
  const aviso = elAviso('notifyMerchantAlert');
  assert.equal(aviso.freeText, `💸 Cliente de prueba dice que te ha enviado ${bueno} por Bizum. Confírmalo en tu panel de YaQu (cobro #${COBRO}).`);
  assert.equal(aviso.detail, `${bueno} · Confírmalo en tu panel de YaQu`);
  assert.equal(elMensajeA(r.buzon, TEL_PRO).text, aviso.freeText);
  assert.ok(!CRUDO.test(aviso.freeText) && !CRUDO.test(aviso.detail), `🔴 importe en crudo: «${aviso.freeText}» / «${aviso.detail}»`);
});

// ═══ LA PÁGINA DE RESULTADO DE MERCADO PAGO (payMp.routes.ts), que lee el CLIENTE FINAL ═══════

/** Lo que hay dentro de la caja del importe, hasta el salto que la separa del concepto. */
function importePintado(html) {
  const m = /<div class="amount"[^>]*>([\s\S]*?)<br/.exec(html);
  assert.ok(m, '🔴 CIEGO: la página no trae la caja del importe');
  return m[1];
}

for (const [estado, titulo] of [['paid', '¡Pago aprobado!'], ['failed', 'Pago rechazado'], ['pending', 'Pago en proceso'], ['expired', 'Cobro vencido']]) {
  test(`SCRUM-1436f · 🔴 /pay/mp/:token/result con el cobro «${estado}»: el cliente lee «1.419,87 €»`, async () => {
    reiniciar();
    banco.cobro.status = estado;
    const r = await llamar(resultadoMpH, { params: { token: 'tok_1436' }, query: {}, headers: {} });
    assert.ok(typeof r.html === 'string' && r.html.includes(titulo),`🔴 CIEGO: no ha salido la página del estado «${estado}»`);
    assert.equal(importePintado(r.html), formatMoneyEs(TOTAL, 'EUR'));
    assert.ok(!CRUDO.test(importePintado(r.html)), `🔴 importe en crudo en la página: «${importePintado(r.html)}»`);
  });
}

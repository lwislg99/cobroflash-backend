// tests/scrum1727b-resena-ventana-y-franja.test.mjs — SCRUM-1727b
//
// Decisión del fundador (SCRUM-1727 c.21744, sobre la pregunta de c.21742): la petición de reseña
// de Google tras un pago sale SOLO si la ventana de 24 h del cliente está abierta Y es entre las
// 09:00 y las 21:00 en la hora del negocio. Si no, no se manda (ni cola ni plantilla). La baja
// sigue cortándola como antes.
//
// Los handlers REALES de `dist/` (`psp.routes` y su gemelo `mpWebhook.routes`), con la base
// doblada, el WhatsApp en dry-run y el reloj fijado (sólo `Date`). Lo que se mide es el buzón del
// dry-run: si salió o no un botón-enlace a la URL de reseña del negocio.
//
// Cuatro casos por ruta: ventana cerrada · fuera de franja · dado de baja → NO sale; ventana
// abierta y en franja → SÍ sale (el control positivo, sin el cual los tres «no sale» podrían
// ser un banco que no manda nada).
process.env.WHATSAPP_DRY_RUN = '1';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 1727; // no es el 1: el demo tiene su propio freno de envío (V0-2)
const CLIENTE = 172;
const COBRO = 17270;
const FACTURA = 17;
const TEL_PRO = '34000001727'; // rango imposible (SCRUM-262)
const TEL_CLIENTE = '34000001728';
const RESENA = 'https://g.page/r/scrum1727b/review';
// Madrid en noviembre es UTC+1: 11:00Z son las 12:00 (dentro); 21:30Z son las 22:30 (fuera).
const EN_FRANJA = new Date('2026-11-12T11:00:00Z');
const FUERA_DE_FRANJA = new Date('2026-11-12T21:30:00Z');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const banco = { cobro: null, ventanaAbierta: false, dadosDeBaja: [], consultasDeVentana: 0 };

function reiniciar({ ventanaAbierta, dadosDeBaja = [] }) {
  banco.ventanaAbierta = ventanaAbierta;
  banco.dadosDeBaja = dadosDeBaja;
  banco.consultasDeVentana = 0;
  banco.cobro = {
    id: COBRO, merchantId: M, customerId: CLIENTE, status: 'pending', amount: '120.00', currency: 'EUR',
    method: 'card', concept: 'Reparación', reference: null, intentId: null, receiptToken: 'tok_1727b',
    customer: { id: CLIENTE, name: 'Cliente de prueba', phone: TEL_CLIENTE, mobile: null, email: null },
    merchant: {
      id: M, name: 'Taller de prueba', legalName: null, whatsappPhone: TEL_PRO, googleReviewUrl: RESENA,
      country: 'ES', timezone: 'Europe/Madrid',
    },
  };
}

const doble = dobleDeLaBase({
  'invoice.findUnique': () => ({ id: FACTURA, number: 'F261727', status: 'pending', chargeId: COBRO }),
  'invoice.findFirst': () => ({ id: FACTURA, number: 'F261727', status: 'pending', chargeId: COBRO }),
  'invoice.update': () => ({ id: FACTURA }),
  'charge.findUnique': () => ({ ...banco.cobro }),
  'charge.update': (a) => {
    const { reconciliations, ...datos } = a?.data ?? {};
    Object.assign(banco.cobro, datos);
    return { ...banco.cobro };
  },
  'merchant.findUnique': () => ({ ...banco.cobro.merchant, email: null, notifyEmailOnPaid: false }),
  // La ventana de 24 h: `isServiceWindowOpen` busca un ENTRANTE del cliente.
  'whatsAppMessage.findFirst': (a) => {
    if (a?.where?.type !== 'inbound') return null;
    banco.consultasDeVentana += 1;
    return banco.ventanaAbierta ? { id: 1 } : null;
  },
  // La baja: `isWaOptedOut` lista los clientes del comercio con `waOptOut = true`.
  'customer.findMany': (a) => (a?.where?.waOptOut === true ? banco.dadosDeBaja : []),
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
for (const [r, exports] of [
  ['dist/lib/email.js', { sendInvoiceEmail: async () => {} }],
  ['dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async () => ({ id: FACTURA, number: 'F261727', status: 'issued', pdfUrl: '/x.pdf' }),
    ensureInvoicePdf: async () => ({ diskPath: null, pdfUrl: '/x.pdf' }),
    ensureChargeReceiptToken: async () => 'tok_1727b',
  }],
  // Mercado Pago: ni firma real ni llamada a su API.
  ['dist/integrations/mercadopago.js', {
    verifyMpWebhookSignature: () => true,
    getMpPayment: async () => ({ status: 'approved', externalReference: `charge_${COBRO}`, amount: 120, currency: 'EUR', method: 'card' }),
  }],
]) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

const { config } = requiere(rutaDe('dist/core/config/env.js'));

const handlerDe = (modulo, metodo, ruta) => {
  const m = requiere(rutaDe(modulo));
  const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const pspH = handlerDe('dist/modules/billing/app/routes/psp.routes.js', 'post', '/');
const mpH = handlerDe('dist/modules/billing/app/routes/mpWebhook.routes.js', 'post', '/');

const PETICION = {
  psp: () => ({ body: { event: 'payment.confirmed', charge_id: COBRO }, headers: {} }),
  mp: () => ({ body: { type: 'payment', data: { id: 'mp_1727b' } }, query: {}, headers: {} }),
};
const HANDLER = { psp: pspH, mp: mpH };

/** Llama al webhook con el reloj en `ahora` y devuelve lo que salió por WhatsApp. */
async function pagar(ruta, ahora) {
  const r = { statusCode: 200, buzon: [] };
  const res = {
    status(c) { r.statusCode = c; return res; },
    json() { return res; }, type() { return res; }, set() { return res; },
    setHeader() { return res; }, send() { return res; }, sendStatus(c) { r.statusCode = c; return res; },
    redirect() { return res; }, end() { return res; },
  };
  const antes = {
    AUTO_INVOICE_ON_PAID: config.AUTO_INVOICE_ON_PAID,
    AUTO_EMAIL_INVOICE_ON_PAID: config.AUTO_EMAIL_INVOICE_ON_PAID,
    MP_WEBHOOK_SECRET: config.MP_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN: config.MP_ACCESS_TOKEN,
  };
  Object.assign(config, {
    AUTO_INVOICE_ON_PAID: true, AUTO_EMAIL_INVOICE_ON_PAID: false,
    MP_WEBHOOK_SECRET: 'relleno-de-test', MP_ACCESS_TOKEN: 'relleno-de-test',
  });
  globalThis.__waDryRunOutbox = r.buzon;
  mock.timers.enable({ apis: ['Date'], now: ahora });
  try {
    await HANDLER[ruta](PETICION[ruta](), res, (e) => { if (e) throw e; });
    await esperar(60); // los envíos son fire-and-forget
  } finally {
    mock.timers.reset();
    delete globalThis.__waDryRunOutbox;
    Object.assign(config, antes);
  }
  return r;
}

const resenas = (buzon) => buzon.filter((m) => m.kind === 'cta_url' && m.url === RESENA);
/** El pago llegó a confirmarse: sin esto, «no salió la reseña» podría ser un webhook que no hizo nada. */
function elPagoSeConfirmo(r) {
  assert.equal(banco.cobro.status, 'paid', `🔴 CIEGO: el cobro no pasó a pagado (status ${r.statusCode})`);
}

// ═══ SUELO ═══════════════════════════════════════════════════════════════════════════════
test('SCRUM-1727b · SUELO: los dos instantes caen a cada lado de la franja en Madrid', () => {
  const hora = (d) => Number(new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hour12: false, timeZone: 'Europe/Madrid' }).format(d)) % 24;
  assert.equal(hora(EN_FRANJA), 12);
  assert.equal(hora(FUERA_DE_FRANJA), 22);
});

// ═══ psp.routes.ts ═══════════════════════════════════════════════════════════════════════
test('SCRUM-1727b · PSP · CONTROL POSITIVO: ventana abierta y en franja → SÍ sale la reseña', async () => {
  reiniciar({ ventanaAbierta: true });
  const r = await pagar('psp', EN_FRANJA);
  elPagoSeConfirmo(r);
  const salidas = resenas(r.buzon);
  assert.equal(salidas.length, 1, `🔴 la reseña no salió con ventana y en franja (${salidas.length})`);
  assert.equal(salidas[0].to, TEL_CLIENTE);
});

test('SCRUM-1727b · PSP · ventana cerrada → NO sale la reseña', async () => {
  reiniciar({ ventanaAbierta: false });
  const r = await pagar('psp', EN_FRANJA);
  elPagoSeConfirmo(r);
  assert.ok(banco.consultasDeVentana > 0, '🔴 CIEGO: nadie preguntó por la ventana');
  assert.deepEqual(resenas(r.buzon), [], '🔴 la reseña salió con la ventana de 24 h cerrada');
});

test('SCRUM-1727b · PSP · fuera de franja (22:30 del negocio) → NO sale la reseña', async () => {
  reiniciar({ ventanaAbierta: true });
  const r = await pagar('psp', FUERA_DE_FRANJA);
  elPagoSeConfirmo(r);
  assert.deepEqual(resenas(r.buzon), [], '🔴 la reseña salió fuera de 09:00-21:00');
});

test('SCRUM-1727b · PSP · dado de baja → NO sale la reseña', async () => {
  reiniciar({ ventanaAbierta: true, dadosDeBaja: [{ phone: TEL_CLIENTE, mobile: null }] });
  const r = await pagar('psp', EN_FRANJA);
  elPagoSeConfirmo(r);
  assert.deepEqual(resenas(r.buzon), [], '🔴 la reseña salió a un cliente dado de baja');
});

// ═══ mpWebhook.routes.ts ═════════════════════════════════════════════════════════════════
test('SCRUM-1727b · MP · CONTROL POSITIVO: ventana abierta y en franja → SÍ sale la reseña', async () => {
  reiniciar({ ventanaAbierta: true });
  const r = await pagar('mp', EN_FRANJA);
  elPagoSeConfirmo(r);
  const salidas = resenas(r.buzon);
  assert.equal(salidas.length, 1, `🔴 la reseña no salió con ventana y en franja (${salidas.length})`);
  assert.equal(salidas[0].to, TEL_CLIENTE);
});

test('SCRUM-1727b · MP · ventana cerrada → NO sale la reseña', async () => {
  reiniciar({ ventanaAbierta: false });
  const r = await pagar('mp', EN_FRANJA);
  elPagoSeConfirmo(r);
  assert.ok(banco.consultasDeVentana > 0, '🔴 CIEGO: nadie preguntó por la ventana');
  assert.deepEqual(resenas(r.buzon), [], '🔴 la reseña salió con la ventana de 24 h cerrada');
});

test('SCRUM-1727b · MP · fuera de franja (22:30 del negocio) → NO sale la reseña', async () => {
  reiniciar({ ventanaAbierta: true });
  const r = await pagar('mp', FUERA_DE_FRANJA);
  elPagoSeConfirmo(r);
  assert.deepEqual(resenas(r.buzon), [], '🔴 la reseña salió fuera de 09:00-21:00');
});

test('SCRUM-1727b · MP · dado de baja → NO sale la reseña', async () => {
  reiniciar({ ventanaAbierta: true, dadosDeBaja: [{ phone: TEL_CLIENTE, mobile: null }] });
  const r = await pagar('mp', EN_FRANJA);
  elPagoSeConfirmo(r);
  assert.deepEqual(resenas(r.buzon), [], '🔴 la reseña salió a un cliente dado de baja');
});

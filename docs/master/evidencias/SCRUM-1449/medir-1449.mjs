// medir-1449.mjs — SCRUM-1449 · cuándo sale cada frase de `/pay/mp/:token`, EJECUTANDO la ruta real.
//
// Uso: node medir-1449.mjs <raíz del repo, con dist/ construido>
// No es un test: no registra casos. Imprime lo que la ruta contesta en cada situación.
// Base doblada, Mercado Pago doblado, WhatsApp en dry-run. No sale nada a la red.
process.env.WHATSAPP_DRY_RUN = '1';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '.');
const requiere = createRequire(pathToFileURL(path.join(RAIZ, 'tests', 'x.mjs')));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const { dobleDeLaBase } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_envio-doblado.mjs')).href);

const M = 4449;
const COBRO = 2449;
const banco = { cobro: null, mp: { falla: false, pago: null }, eventos: [], correos: 0 };
const cliente = ({ phone = null, email = null } = {}) => ({ id: 57, name: 'Cliente de prueba', phone, mobile: null, email });
function reiniciar({ status = 'pending', contacto = {}, mpDelMerchant = undefined } = {}) {
  banco.eventos = []; banco.correos = 0;
  banco.cobro = {
    id: COBRO, merchantId: M, customerId: 57, status, amount: '1419.87', currency: 'EUR', method: 'card',
    concept: 'Factura F260007', intentId: null, receiptToken: 'tok_1449', reference: null,
    customer: cliente(contacto),
    merchant: { id: M, name: 'Taller de prueba', legalName: null, whatsappPhone: null, googleReviewUrl: null, ...(mpDelMerchant ? { mpAccessToken: mpDelMerchant } : {}) },
  };
}

const doble = dobleDeLaBase({
  'charge.findUnique': () => (banco.cobro ? { ...banco.cobro } : null),
  'charge.update': (a) => { const { reconciliations, ...d } = a?.data ?? {}; Object.assign(banco.cobro, d); return { ...banco.cobro }; },
  'customerEvent.create': (a) => { banco.eventos.push(a.data); return a.data; },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
for (const [r, exports] of [
  ['dist/lib/email.js', { sendInvoiceEmail: async () => { banco.correos += 1; } }],
  ['dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async () => ({ id: 7, number: 'F260007', status: 'issued', pdfUrl: '/x.pdf' }),
    ensureChargeReceiptToken: async () => 'tok_1449',
  }],
  ['dist/integrations/mercadopago.js', {
    verifyMpWebhookSignature: () => true,
    getMpPayment: async () => ({ ...banco.mp.pago }),
    createMpPreference: async () => {
      if (banco.mp.falla) throw new Error('ECONNRESET (doblado)');
      return { checkoutUrl: 'https://mp.invalid/checkout', preferenceId: 'pref_1449' };
    },
  }],
]) { const f = rutaDe(r); requiere.cache[f] = { id: f, filename: f, loaded: true, exports }; }

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const handlerDe = (modulo, metodo, ruta) => {
  const m = requiere(rutaDe(modulo)); const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  if (!capa) throw new Error(`CIEGO: no encuentro ${metodo} ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const pagarH = handlerDe('dist/modules/billing/app/routes/payMp.routes.js', 'get', '/mp/:token');
const resultadoH = handlerDe('dist/modules/billing/app/routes/payMp.routes.js', 'get', '/mp/:token/result');
const webhookH = handlerDe('dist/modules/billing/app/routes/mpWebhook.routes.js', 'post', '/');

async function llamar(handle, req, conf = {}) {
  const r = { status: 200, cuerpo: null, tipo: null, redirige: null, buzon: [] };
  const res = {
    status(c) { r.status = c; return res; }, json(x) { r.cuerpo = x; return res; },
    send(x) { r.cuerpo = x; return res; }, setHeader(k, v) { if (/content-type/i.test(k)) r.tipo = v; return res; },
    redirect(a, b) { r.redirige = b ?? a; r.status = b ? a : 302; return res; },
  };
  const claves = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'AUTO_INVOICE_ON_PAID', 'AUTO_EMAIL_INVOICE_ON_PAID'];
  const antes = Object.fromEntries(claves.map((k) => [k, config[k]]));
  const mudo = console.error; console.error = () => {};
  Object.assign(config, conf);
  globalThis.__waDryRunOutbox = r.buzon;
  try { await handle(req, res, (e) => { if (e) throw e; }); await new Promise((s) => setTimeout(s, 60)); }
  finally { delete globalThis.__waDryRunOutbox; Object.assign(config, antes); console.error = mudo; }
  return r;
}
const esPagina = (c) => typeof c === 'string' && /<!doctype html>/i.test(c);
const parrafo = (c) => (String(c).match(/<p>([^<]*)<\/p>/) || [])[1] ?? null;
const fila = (...c) => console.log('| ' + c.join(' | ') + ' |');
const req = { params: { token: 'tok_1449' }, headers: {}, query: {} };
const RELLENO = 'relleno-de-test'; // no es una credencial: Mercado Pago está doblado

console.log('## A · GET /pay/mp/:token — qué decide el 503 y el 502\n');
fila('situación', 'estado HTTP', '¿página?', 'lo que lee el cliente');
fila('---', '---', '---', '---');
for (const [nombre, prep, conf] of [
  ['plataforma SIN token · merchant sin nada', {}, { MP_ACCESS_TOKEN: '' }],
  ['plataforma SIN token · merchant con `mpAccessToken` en la fila', { mpDelMerchant: RELLENO }, { MP_ACCESS_TOKEN: '' }],
  ['plataforma CON token · merchant sin nada', {}, { MP_ACCESS_TOKEN: RELLENO }],
  ['plataforma CON token · Mercado Pago no contesta', { }, { MP_ACCESS_TOKEN: RELLENO }, true],
]) {
  reiniciar(prep); banco.mp.falla = nombre.includes('no contesta');
  const r = await llamar(pagarH, req, conf);
  fila(nombre, r.status, esPagina(r.cuerpo) ? 'sí' : 'no (texto plano)', r.redirige ? `redirige a ${r.redirige}` : `«${r.cuerpo}»`);
}
banco.mp.falla = false;

console.log('\n## B · GET /pay/mp/:token/result — qué frase sale con cada estado del cobro\n');
fila('estado del cobro', 'frase', 'importe que pinta');
fila('---', '---', '---');
for (const status of ['pending', 'paid', 'failed', 'expired']) {
  reiniciar({ status });
  const r = await llamar(resultadoH, { ...req, query: { status: 'approved' } });
  const importe = (String(r.cuerpo).match(/<div class="amount">([^<]*)</) || [])[1];
  fila(status, `«${parrafo(r.cuerpo)}»`, `«${importe}»`);
}

console.log('\n## C · «Te notificaremos pronto»: qué recibe el cliente cuando el pago pendiente se resuelve\n');
fila('contacto del cliente', 'Mercado Pago dice', 'mensajes de WhatsApp al cliente', 'correos', 'estado final del cobro');
fila('---', '---', '---', '---', '---');
const TEL = '34000001449'; // rango imposible
for (const [nombre, contacto] of [
  ['teléfono y correo', { phone: TEL, email: 'cliente@ejemplo.invalid' }],
  ['sólo teléfono', { phone: TEL }],
  ['sólo correo', { email: 'cliente@ejemplo.invalid' }],
  ['ni teléfono ni correo', {}],
]) {
  for (const mpStatus of ['approved', 'rejected', 'pending']) {
    reiniciar({ contacto });
    banco.mp.pago = { status: mpStatus, externalReference: `charge_${COBRO}`, amount: 1419.87, currency: 'EUR', method: 'card' };
    const r = await llamar(webhookH, { body: { type: 'payment', data: { id: 'mp-1449' } }, headers: {} },
      { MP_ACCESS_TOKEN: RELLENO, MP_WEBHOOK_SECRET: RELLENO, AUTO_INVOICE_ON_PAID: true, AUTO_EMAIL_INVOICE_ON_PAID: true });
    fila(nombre, mpStatus, r.buzon.filter((m) => m.to === TEL).length, banco.correos, banco.cobro.status);
  }
}
console.log('\nPOBLACION: A=4 situaciones · B=4 estados · C=12 combinaciones');

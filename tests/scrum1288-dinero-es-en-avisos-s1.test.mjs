// tests/scrum1288-dinero-es-en-avisos-s1.test.mjs — SCRUM-1288 (los tres sitios de S1)
//
// 🔴 DINERO EN FORMATO INGLÉS: «1234.50 EUR» donde el panel entero dice «1.234,50 €». Mismo
// `toFixed(2)` + código de moneda a mano que arregló SCRUM-1277, en tres sitios más de S1:
//   · `POST /quote/create` → el WhatsApp al propietario «Nuevo presupuesto … pendiente de tu aprobación»;
//   · `sendQuoteWhatsAppToCustomer` (lo que llama «Enviar por WhatsApp») → la línea del HISTORIAL;
//   · `POST /admin/quotes/:id/send-email` → la línea del HISTORIAL.
// (Los dos del historial no son un WhatsApp: son el `detail` de `recordCustomerEvent`, que el panel
// pinta tal cual en la ficha del cliente. El inventario del ticket los contaba como avisos.)
//
// Se LEE lo que sale de verdad —el WhatsApp de `__waDryRunOutbox` y la fila que se escribe en
// `customerEvent`— con base doblada y WhatsApp en dry-run. ⛔ Sin red ni base. Importe con MILES,
// que es donde confunde el separador.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTAS_QUOTES = '../dist/modules/quotes/app/routes/quotes.routes.js';
const RUTAS_ADMIN = '../dist/modules/system/app/routes/quotesAdmin.routes.js';
const SEND = '../dist/modules/quotes/domain/sendQuote.service.js';
const EVENTOS = '../dist/modules/system/customerEvents.service.js';
const TEL_PRO = '34000001288'; // rango imposible (SCRUM-262)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const sinNbsp = (s) => String(s).replace(/ /g, ' ');

function manejador(router, metodo, ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta}`);
  return capa.route.stack[capa.route.stack.length - 1].handle;
}
function respuesta() {
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = j; return res; }, setHeader() { return res; } };
  return { r, res };
}

test('🔴 SCRUM-1288 · 1 · «pendiente de tu aprobación»: el WhatsApp al propietario dice 1.234,50 €', async () => {
  const eventos = [];
  inyectarBase({
    'authSession.findUnique': () => ({ type: 'session', expiresAt: new Date(Date.now() + 3600e3), teamMemberId: 9, teamMember: { id: 9, status: 'active' } }),
    'merchant.findUnique': () => ({ id: MERCHANT, name: 'Fontanería 1288', whatsappPhone: TEL_PRO, approvalThreshold: '100.00', country: 'ES',
      timezone: 'Europe/Madrid', quoteSeriesYear: null, nextQuoteNumber: 1 }),
    'customer.findFirst': () => ({ id: CLIENTE, merchantId: MERCHANT, name: 'Cliente 1288' }),
    '$executeRaw': () => 0, // el cerrojo de la serie (pg_advisory_xact_lock)
    'merchant.update': () => ({ id: MERCHANT }),
    'quote.create': ({ data }) => ({ id: 1288, ...data }),
    'customerEvent.create': ({ data }) => { eventos.push(data); return {}; },
  }, [RUTAS_QUOTES, EVENTOS]);
  globalThis.__waDryRunOutbox = [];
  const h = manejador(moduloDeDist(RUTAS_QUOTES).default, 'post', '/create');
  const { r, res } = respuesta();
  await h({
    body: { merchant_id: MERCHANT, customer_id: CLIENTE, currency: 'eur', lines: [{ concept: 'Cuadro', qty: 1, price: 1020.25, tax: 0.21 }] },
    merchantId: MERCHANT, headers: { cookie: 'pf_session=tok1288' },
  }, res);
  await esperar(50);
  const aviso = globalThis.__waDryRunOutbox.find((m) => m.to === TEL_PRO);
  assert.ok(aviso, `CIEGO: no salió el aviso de aprobación (status ${r.status} ${JSON.stringify(r.data)})`);
  assert.match(sinNbsp(aviso.text), / por 1\.234,50 € pendiente de tu aprobación/, `🔴 «${aviso.text}»`);
  assert.ok(!/\bEUR\b|\d\.\d{2}\b/.test(aviso.text), `🔴 formato inglés en «${aviso.text}»`);
});

test('🔴 SCRUM-1288 · 2 · enviar por WhatsApp: el historial dice 1.234,50 €', async () => {
  const eventos = [];
  inyectarBase({
    'quote.findUnique': () => ({ id: 7, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', quoteNumber: 12, total: '1234.50', currency: 'EUR',
      decisionToken: 'f'.repeat(32), merchant: { id: MERCHANT, name: 'Taller 1288', legalName: null }, customer: { id: CLIENTE, name: 'Cliente', phone: '34000001289' } }),
    'customer.findMany': () => [],
    'customerEvent.create': ({ data }) => { eventos.push(data); return {}; },
  }, [SEND, EVENTOS]);
  globalThis.__waDryRunOutbox = [];
  const { sendQuoteWhatsAppToCustomer } = moduloDeDist(SEND);
  const out = await sendQuoteWhatsAppToCustomer(7, MERCHANT);
  await esperar(50);
  assert.equal(out.ok, true, `CIEGO: el envío no llegó a escribir el historial (${JSON.stringify(out)})`);
  const fila = eventos.find((e) => e.type === 'quote_sent');
  assert.ok(fila, 'CIEGO: no se escribió la línea del historial');
  assert.equal(sinNbsp(fila.detail), '1.234,50 €', `🔴 el historial dice «${fila.detail}»`);
});

test('🔴 SCRUM-1288 · 3 · enviar por email: el historial dice 1.234,50 €', async () => {
  const eventos = [];
  const quote = { id: 8, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', quoteNumber: 13, total: '1234.50', currency: 'EUR',
    decisionToken: 'a'.repeat(32), customer: { name: 'Cliente', email: 'cliente@ejemplo.invalid' }, merchant: { name: 'Taller 1288', legalName: null, country: 'ES' } };
  inyectarBase({
    'quote.findFirst': () => quote,
    'quote.findUnique': () => quote,
    'customerEvent.create': ({ data }) => { eventos.push(data); return {}; },
  }, [RUTAS_ADMIN, EVENTOS, '../dist/modules/messaging/domain/email.service.js']);
  const h = manejador(moduloDeDist(RUTAS_ADMIN).default, 'post', '/:id/send-email');
  const { r, res } = respuesta();
  await h({ params: { id: '8' }, merchantId: MERCHANT, headers: {} }, res);
  await esperar(50);
  const fila = eventos.find((e) => e.type === 'quote_sent');
  assert.ok(fila, `CIEGO: no se escribió la línea del historial (status ${r.status} ${JSON.stringify(r.data)})`);
  assert.equal(sinNbsp(fila.detail), '1.234,50 €', `🔴 el historial dice «${fila.detail}»`);
});

// Control positivo: un aviso que YA salía bien (SCRUM-1277, «aceptó tu presupuesto») sigue igual.
// Sin esto, 1-3 pasarían aunque `formatMoneyEs` devolviera siempre lo mismo.
test('SCRUM-1288 · control: dos importes distintos salen distintos, y el de 1277 sigue diciendo 363,00 €', async () => {
  const { formatMoneyEs } = moduloDeDist('../dist/core/utils/utils.js');
  assert.notEqual(formatMoneyEs('1234.50', 'EUR'), formatMoneyEs('363.00', 'EUR'));
  assert.equal(sinNbsp(formatMoneyEs('363.00', 'EUR')), '363,00 €');
});

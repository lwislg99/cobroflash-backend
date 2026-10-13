// tests/scrum1514-el-reenvio-es-del-comercio.test.mjs — SCRUM-1514
//
// 🔴 UN COMERCIO NO REENVÍA LA FACTURA DE OTRO.
//
// `POST /admin/invoices/:id/resend-whatsapp` buscaba la factura sólo por `id`: con la sesión del
// comercio A y el id de una factura de B contestaba 200, le mandaba la plantilla de cobro al
// cliente de B y le devolvía a A su teléfono y el enlace de pago. `send-reminder`, la ruta de al
// lado, con la misma sesión y la misma factura daba 404. Medido en SCRUM-1512 y censado en
// SCRUM-1514 (191 rutas de /admin: ésta era la única frontera real que cruzaba).
//
// Ahora la ruta pasa el comercio de la sesión y el servicio lo pone en el `where`.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Los handlers REALES de `dist/` con la base doblada (`_envio-doblado.mjs`) y el dry-run de la
// casa para WhatsApp: no sale nada a la red. El doble de `invoice.findUnique` APLICA UNA SOLA
// COSA del `where`: el comercio. Si la consulta no lo lleva, entrega la factura sea de quien sea,
// que es lo que hace una base. Por eso el caso de la factura ajena cae sin el arreglo.
//
// ⚠️ Lo que NO mide: Postgres real, la app desplegada, ni las demás rutas de /admin (eso es el
// censo, `docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt --eje=comercio`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTA = '../dist/modules/system/app/routes/invoicesAdmin.routes.js';
const SERVICIO = '../dist/modules/billing/domain/invoiceWhatsApp.service.js';

const OTRO_COMERCIO = MERCHANT + 1;
const TELEFONO = '34000000001';
const ENLACE = 'tok-1514-de-laboratorio';

const facturaDe = (merchantId) => ({
  id: 7, merchantId, customerId: CLIENTE, number: 'F260007', status: 'pending', total: '419.87', currency: 'EUR',
  chargeId: 90, quoteId: null, stageLabel: null,
  merchant: { id: merchantId, name: 'Taller de prueba', legalName: null, country: 'ES' },
  customer: { id: CLIENTE, name: 'Cliente de prueba', phone: TELEFONO, mobile: null, email: 'cliente@example.invalid' },
});

/** Un banco con UNA factura, la 7, de `dueno`. Apunta cada consulta y cada escritura. */
function banco(dueno) {
  const consultas = [];
  const escrituras = [];
  const factura = facturaDe(dueno);
  const laFactura = (metodo) => (args) => {
    consultas.push({ metodo, where: args?.where });
    const w = args?.where || {};
    if (w.id !== factura.id) return null;
    // Lo único que el doble aplica: el comercio, y sólo si la consulta lo trae.
    if (w.merchantId !== undefined && w.merchantId !== factura.merchantId) return null;
    return factura;
  };
  const escribe = (nombre) => (args) => { escrituras.push({ nombre, where: args?.where }); return {}; };
  return {
    consultas, escrituras,
    respuestas: {
      'invoice.findUnique': laFactura('invoice.findUnique'),
      'invoice.findFirst': laFactura('invoice.findFirst'),
      'invoice.update': escribe('invoice.update'),
      'charge.findUnique': () => ({ id: 90, receiptToken: ENLACE }),
      'charge.update': escribe('charge.update'),
    },
  };
}

async function callado(fn) {
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    return { ...(await fn()), buzon };
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
  }
}

/** La ruta real, con una sesión de administrador de `sesion`, pidiendo la factura 7. */
async function reenviar({ sesion, dueno }) {
  const b = banco(dueno);
  inyectarBase(b.respuestas, [RUTA, SERVICIO]);
  const router = moduloDeDist(RUTA).default;
  assert.ok(router && Array.isArray(router.stack), '🔴 CIEGO: no encuentro el router de facturas');
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/resend-whatsapp' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/resend-whatsapp');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(c) { r.cuerpo = c; return res; } };
  const salida = await callado(async () => {
    await h(reqDeSesion({ rol: 'admin', merchantId: sesion, params: { id: '7' }, body: {}, headers: {} }), res);
    return r;
  });
  return { ...salida, ...b };
}

test('SCRUM-1514 · POSITIVO: el comercio que reenvía SU factura sigue mandando su plantilla', async () => {
  const r = await reenviar({ sesion: MERCHANT, dueno: MERCHANT });
  assert.equal(r.buzon.length, 1, '🔴 la petición legítima ya no manda nada: el arreglo lo ha roto todo');
  assert.equal(r.status, 200);
  assert.deepEqual(r.cuerpo, { ok: true, sent: true, invoice_id: 7, charge_id: 90, pay_token: ENLACE, to: TELEFONO });
  assert.equal(r.consultas.length, 1, '🔴 CIEGO: la ruta no ha buscado la factura por donde este banco mira');
});

test('SCRUM-1514 · 🔴 con la factura de OTRO comercio: 404, ni una plantilla, ni un dato, ni una escritura', async () => {
  const r = await reenviar({ sesion: MERCHANT, dueno: OTRO_COMERCIO });
  assert.ok(r.consultas.length >= 1, '🔴 CIEGO: la ruta no ha buscado la factura por donde este banco mira');
  assert.equal(r.buzon.length, 0, `🔴 ha salido ${r.buzon.length} mensaje al cliente de otro comercio`);
  assert.equal(r.status, 404, `🔴 la ruta contesta ${r.status} sobre la factura de otro comercio`);
  const texto = JSON.stringify(r.cuerpo);
  assert.ok(!texto.includes(TELEFONO), '🔴 la respuesta lleva el teléfono del cliente de otro comercio');
  assert.ok(!texto.includes(ENLACE), '🔴 la respuesta lleva el enlace de pago de otro comercio');
  assert.deepEqual(r.escrituras, [], '🔴 se ha escrito sobre la factura o el cobro de otro comercio');
});

test('SCRUM-1514 · una factura ajena y una que no existe contestan LO MISMO', async () => {
  const ajena = await reenviar({ sesion: MERCHANT, dueno: OTRO_COMERCIO });
  const b = banco(MERCHANT);
  inyectarBase({ ...b.respuestas, 'invoice.findUnique': () => null, 'invoice.findFirst': () => null }, [RUTA, SERVICIO]);
  const router = moduloDeDist(RUTA).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/resend-whatsapp' && l.route.methods.post);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(c) { r.cuerpo = c; return res; } };
  await callado(async () => {
    await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body: {}, headers: {} }), res);
    return r;
  });
  assert.equal(r.status, 404, '🔴 CIEGO: una factura que no existe ya no da 404');
  assert.equal(ajena.status, r.status);
  assert.deepEqual(ajena.cuerpo, r.cuerpo, '🔴 la respuesta delata que la factura existe y es de otro');
});

test('SCRUM-1514 · quien llama al servicio SIN comercio (la aceptación pública, el cobro del resto) sigue enviando', async () => {
  const b = banco(OTRO_COMERCIO);
  inyectarBase(b.respuestas, [SERVICIO]);
  const { sendInvoicePaymentRequest } = moduloDeDist(SERVICIO);
  assert.equal(typeof sendInvoicePaymentRequest, 'function', '🔴 CIEGO: no encuentro sendInvoicePaymentRequest');
  const r = await callado(async () => ({ resultado: await sendInvoicePaymentRequest(7) }));
  assert.equal(r.resultado.ok, true, `🔴 el envío sin sesión ha dejado de salir: ${r.resultado.reason}`);
  assert.equal(r.buzon.length, 1);
});

test('SCRUM-1514 · 🔴 si se pide «sólo de este comercio» y el comercio no viene, NO se busca sin él', async () => {
  const b = banco(OTRO_COMERCIO);
  inyectarBase(b.respuestas, [SERVICIO]);
  const { sendInvoicePaymentRequest } = moduloDeDist(SERVICIO);
  const r = await callado(async () => ({ resultado: await sendInvoicePaymentRequest(7, { merchantId: undefined }) }));
  assert.deepEqual(r.resultado, { ok: false, reason: 'invoice_not_found' });
  assert.equal(r.buzon.length, 0, '🔴 sin comercio en la sesión ha salido un mensaje');
  assert.deepEqual(b.escrituras, []);
});

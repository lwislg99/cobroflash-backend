// tests/scrum1532d-cancelar-cobro-ficha-y-reenvio.test.mjs — SCRUM-1532d (GO y literales: SCRUM-1532 c.22430;
// reparto: c.22435; la ruta, de J2: c.22441 / tramo 1532b)
//
// LA PARTE DE J1 DE «CANCELAR UN COBRO»:
//   ① la ficha de FACTURA pinta `Cancelar cobro` SOLO con el cobro `pending`, pide la confirmación
//     firmada y llama a `POST /admin/charges/:id/cancel`; con el cobro en cualquier otro estado, o sin
//     cobro, no se pinta. Para saberlo, el GET de la ficha lleva `estadoDelCobro` (solo lectura, regla 2);
//   ② el reenvío de la factura (`sendInvoicePaymentRequest`) NO reutiliza un cobro `cancelled`: crea
//     otro y la factura apunta al nuevo (decisión 2 de c.22430). Con el cobro `pending`, lo reutiliza
//     como hoy.
//
// CÓMO SE MIDE — nada doblado de lo que se mide:
//  · ① la vista REAL de `public/` en el banco de vistas (`_banco-vistas.mjs`), con su registro de
//    acciones; el clic y el `confirm` pasan por los oyentes que la vista registra;
//  · ② el servicio de `dist/` tal cual, y el POST a `/charges` sale de verdad hacia el router REAL de
//    `charges.routes.ts` montado en este proceso (mismo molde que scrum1787p). Solo se doblan la base
//    (`_envio-doblado.mjs`) y Meta (`WHATSAPP_DRY_RUN`, el buzón de laboratorio). Ningún envío real.
//
// Datos de EJEMPLO, ninguno real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiere = createRequire(import.meta.url);

// Literales FIRMADOS en SCRUM-1532 c.22430 (regla 39). Se copian de allí, no se escriben de nuevo.
const BOTON = 'Cancelar cobro';
const CONFIRMACION = '¿Cancelar este cobro? El cliente ya no podrá pagarlo con este enlace.';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El reenvío vuelve a reutilizar el cobro sin mirar su estado: el defecto de c.22441.
    fichero: 'src/modules/billing/domain/invoiceWhatsApp.service.ts',
    de: "if (cobroVigente?.status === 'cancelled') chargeId = null;",
    a: 'if (false) chargeId = null;',
    cae: 'SCRUM-1532d · ② cobro cancelado → el reenvío crea OTRO cobro y la factura apunta a él',
  },
  {
    // El botón se pinta con cualquier cobro, no solo con el pendiente.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "if (invoice.chargeId && invoice.estadoDelCobro === 'pending') {",
    a: 'if (invoice.chargeId) {',
    cae: 'SCRUM-1532d · ① con el cobro en otro estado, o sin cobro, no se pinta',
  },
  {
    // El clic cancela sin pedir confirmación.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: 'if (!window.confirm(CONFIRMAR_CANCELAR_COBRO)) return;',
    a: 'if (false) return;',
    cae: 'SCRUM-1532d · ① si el profesional dice que no, no se llama a la ruta',
  },
];

// ── ① la vista ────────────────────────────────────────────────────────────────────────────────
const BASE = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 133.1, currency: 'EUR',
  createdAt: '2026-11-02T09:00:00.000Z',
  customerName: 'ZZCLIENTE Reformas Ejemplo', customerTaxId: 'B12345678',
  customerPhone: '+34600000000', customerEmail: 'cliente@ejemplo.test',
  customer: { id: 1, name: 'ZZCLIENTE ficha viva' },
  lines: [{ concept: 'ZZCONCEPTO alicatado', qty: 1, price: 100, tax: 0.21 }],
  rectifiedBy: [],
});

async function ficha(cambios = {}, { confirma = true } = {}) {
  const factura = { ...BASE, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  const llamadas = [];
  const confirmaciones = [];
  banco.ctx.confirm = (texto) => { confirmaciones.push(texto); return confirma; };
  banco.ctx.fetch = async (u, opts = {}) => {
    llamadas.push({ url: String(u), method: (opts && opts.method) || 'GET' });
    if (/\/admin\/charges\/\d+\/cancel$/.test(String(u))) return { ok: true, json: async () => ({ ok: true, status: 'cancelled' }) };
    return { ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) };
  };
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const esBoton = (n) => String(n.tag || n.tagName || '').toLowerCase() === 'button';
  // El «⋯» (overflowMenu de api.js) pinta sus acciones al abrirse, en el documento: se abre como lo
  // abriría el profesional y se cuentan los botones de la ficha y los del menú.
  const disparador = todos(r.contenedor).find((n) => esBoton(n) && n.textContent === '⋯');
  if (disparador) await disparador.click();
  const vistos = new Set([...todos(r.contenedor), ...todos(banco.ctx.document.body)]);
  const botones = [...vistos].filter(esBoton);
  assert.ok(botones.length > 0, '🔴 CIEGO: la ficha no pinta ningún botón.');
  const cancelar = botones.filter((b) => b.textContent === BOTON);
  return { banco, botones, cancelar, llamadas, confirmaciones };
}

test('SCRUM-1532d · ① con el cobro pendiente la ficha pinta «Cancelar cobro»', async () => {
  const { cancelar, botones } = await ficha({ chargeId: 55, estadoDelCobro: 'pending' });
  assert.equal(cancelar.length, 1, `🔴 no hay UN botón «${BOTON}»: ${botones.map((b) => b.textContent).join(' | ')}`);
});

test('SCRUM-1532d · ① con el cobro en otro estado, o sin cobro, no se pinta', async () => {
  for (const estadoDelCobro of ['cancelled', 'paid', 'expired', 'failed', undefined, null]) {
    const { cancelar, botones } = await ficha({ chargeId: 55, estadoDelCobro });
    assert.ok(botones.length > 0, `🔴 CIEGO (${estadoDelCobro}): sin botones`);
    assert.equal(cancelar.length, 0, `🔴 con el cobro «${estadoDelCobro}» se pinta «${BOTON}».`);
  }
  const sinCobro = await ficha({ chargeId: null, estadoDelCobro: null });
  assert.equal(sinCobro.cancelar.length, 0, '🔴 sin cobro se pinta el botón.');
  // Una factura que no está pendiente no ofrece cancelar su cobro (el registro lo oculta).
  for (const status of ['paid', 'annulled']) {
    const otra = await ficha({ status, chargeId: 55, estadoDelCobro: 'pending' });
    assert.equal(otra.cancelar.length, 0, `🔴 en una factura «${status}» se pinta el botón.`);
  }
});

test('SCRUM-1532d · ① el clic pide la confirmación firmada y llama a la ruta de cancelar', async () => {
  const { cancelar, llamadas, confirmaciones } = await ficha({ chargeId: 55, estadoDelCobro: 'pending' });
  assert.equal(cancelar.length, 1, '🔴 CIEGO: no hay botón que pulsar.');
  await cancelar[0].click();
  await new Promise((ok) => setTimeout(ok, 20));
  assert.deepEqual(confirmaciones, [CONFIRMACION], '🔴 la confirmación no es la firmada en c.22430.');
  const posts = llamadas.filter((l) => l.method === 'POST');
  assert.deepEqual(posts.map((l) => l.url), ['/admin/charges/55/cancel'], '🔴 no llama a la ruta de cancelar de ESTE cobro.');
});

test('SCRUM-1532d · ① si el profesional dice que no, no se llama a la ruta', async () => {
  const { cancelar, llamadas, confirmaciones } = await ficha({ chargeId: 55, estadoDelCobro: 'pending' }, { confirma: false });
  await cancelar[0].click();
  await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(confirmaciones.length, 1, '🔴 CIEGO: no se pidió confirmación.');
  assert.equal(llamadas.filter((l) => l.method === 'POST').length, 0, '🔴 sin confirmar, se llamó a la ruta.');
});

// Leído del fuente: correr el GET pide base de datos. Se acota al handler de `router.get('/:id'`.
test('SCRUM-1532d · ① el GET de la ficha lleva `estadoDelCobro`, leído del cobro de ESTA factura y comercio', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  const ini = fuente.indexOf("router.get('/:id', ");
  assert.ok(ini > 0, '🔴 CIEGO: no encuentro el GET /:id.');
  const handler = fuente.slice(ini, fuente.indexOf('router.', ini + 10));
  assert.match(handler, /const estadoDelCobro = await estadoDelCobroDeLaFactura\(req\.merchantId!, invoice\.chargeId\)/, '🔴 el GET no lee el estado del cobro.');
  assert.match(handler, /const cuerpo = \{[^\n]*\bestadoDelCobro\b[^\n]*\};/, '🔴 `estadoDelCobro` no viaja en la respuesta.');
  assert.ok(fuente.includes('async function estadoDelCobroDeLaFactura'), '🔴 falta estadoDelCobroDeLaFactura.');
  const fn = fuente.slice(fuente.indexOf('async function estadoDelCobroDeLaFactura'));
  const cuerpoFn = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(cuerpoFn, /where: \{ id: chargeId, merchantId \}/, '🔴 la consulta no filtra por comercio (regla 2).');
  assert.doesNotMatch(cuerpoFn, /\.(update|updateMany|create|delete|upsert)\(/, '🔴 la lectura escribe.');
});

// ── ② el reenvío ──────────────────────────────────────────────────────────────────────────────
const SERVICIO = '../dist/modules/billing/domain/invoiceWhatsApp.service.js';
const RUTA_COBROS = '../dist/modules/billing/app/routes/charges.routes.js';

let routerActual = null;
const express = requiere('express');
const app = express();
app.use(express.json());
app.use('/charges', (req, res, next) => routerActual(req, res, next));
const servidor = http.createServer(app);
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
// ANTES de cargar `dist/`: `config` se congela al importarse, y `BASE_URL` es `PUBLIC_BASE_URL`.
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${servidor.address().port}`;
test.after(() => servidor.close());

const facturaBase = {
  id: 7, merchantId: MERCHANT, customerId: CLIENTE, number: 'F260007', status: 'pending', total: '419.87', currency: 'EUR',
  chargeId: 55, quoteId: null, stageLabel: null, payMethods: null,
  merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
  customer: { id: CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null, email: 'cliente@example.invalid' },
};

async function reenviar(estadoDelCobroViejo) {
  const creados = [];
  const facturasEscritas = [];
  const tokensPedidos = [];
  let posts = 0;
  inyectarBase({
    'invoice.findUnique': () => facturaBase,
    'invoice.update': (args) => { facturasEscritas.push(args); return { ...facturaBase, ...args.data }; },
    'quote.findUnique': () => null,
    'merchant.findUnique': () => ({ id: MERCHANT }),
    'charge.findFirst': (args) => (args.where.id === 55 ? { status: estadoDelCobroViejo } : null),
    'charge.create': (args) => { creados.push(args.data); return { id: 90, expiresAt: null, reference: 'R', status: 'pending' }; },
    'charge.findUnique': (args) => { tokensPedidos.push(args.where.id); return { id: args.where.id, receiptToken: `tok-1532d-${args.where.id}` }; },
  }, [SERVICIO, RUTA_COBROS, '../dist/lib/invoicing.js']);
  const router = moduloDeDist(RUTA_COBROS).default;
  assert.equal(typeof router, 'function', '🔴 CIEGO: no encuentro el router de /charges');
  routerActual = (req, res, next) => { posts++; return router(req, res, next); };
  const { sendInvoicePaymentRequest } = moduloDeDist(SERVICIO);
  assert.equal(typeof sendInvoicePaymentRequest, 'function', '🔴 CIEGO: no encuentro sendInvoicePaymentRequest');
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    const resultado = await sendInvoicePaymentRequest(facturaBase.id);
    return { resultado, creados, posts, facturasEscritas, tokensPedidos, buzon };
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
  }
}

test('SCRUM-1532d · ② cobro cancelado → el reenvío crea OTRO cobro y la factura apunta a él', async () => {
  const { resultado, creados, posts, facturasEscritas, tokensPedidos } = await reenviar('cancelled');
  assert.equal(posts, 1, '🔴 con el cobro cancelado no se pidió otro a /charges');
  assert.equal(creados.length, 1, '🔴 no se creó el cobro nuevo');
  assert.equal(resultado.ok, true, `el envío no salió: ${JSON.stringify(resultado)}`);
  assert.equal(resultado.chargeId, 90, '🔴 el envío no va con el cobro NUEVO');
  assert.deepEqual(facturasEscritas.map((a) => a.data), [{ chargeId: 90 }], '🔴 la factura no apunta al cobro nuevo');
  assert.ok(!tokensPedidos.includes(55), '🔴 el enlace se construyó con el token del cobro cancelado');
});

test('SCRUM-1532d · ② control: cobro pendiente → se reutiliza, como hoy', async () => {
  const { resultado, creados, posts, facturasEscritas, tokensPedidos } = await reenviar('pending');
  assert.equal(resultado.ok, true, `el envío no salió: ${JSON.stringify(resultado)}`);
  assert.equal(posts, 0, '🔴 con el cobro pendiente se pidió otro a /charges');
  assert.equal(creados.length, 0);
  assert.equal(facturasEscritas.length, 0, '🔴 se reescribió la factura');
  assert.equal(resultado.chargeId, 55);
  assert.deepEqual(tokensPedidos, [55], '🔴 CIEGO: el enlace no salió del cobro reutilizado');
});

test('SCRUM-1532d · ② control: los demás estados no pagables no cambian (solo `cancelled` entra en c.22430)', async () => {
  for (const estado of ['paid', 'expired', 'failed']) {
    const { posts, creados } = await reenviar(estado);
    assert.equal(posts, 0, `🔴 con el cobro «${estado}» se creó otro: fuera de lo decidido`);
    assert.equal(creados.length, 0);
  }
});

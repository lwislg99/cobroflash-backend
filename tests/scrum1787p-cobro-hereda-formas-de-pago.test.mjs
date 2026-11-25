// tests/scrum1787p-cobro-hereda-formas-de-pago.test.mjs — SCRUM-1787p (GO del fundador: SCRUM-1787 c.22362 «1-GO»)
//
// EL COBRO QUE CREA EL ENVÍO POR WHATSAPP DE LA FACTURA HEREDA LAS FORMAS DE PAGO CONGELADAS EN ELLA.
//
// 1787i congela en la factura suelta las formas de pago que eligió el profesional
// (`invoice.payMethods`). Pero el cliente no lee la factura: lee el COBRO (`charge.payMethods`,
// que la página de pago ya filtra en `payInvoice.routes.ts`). Y ese cobro lo crea
// `sendInvoicePaymentRequest` (`invoiceWhatsApp.service.ts`) con un POST a `/charges`, que antes
// sólo heredaba las del PRESUPUESTO de origen: una suelta no tiene presupuesto, así que el cliente
// veía todas las que el comercio tuviera activas, eligiera lo que eligiera el profesional.
//
// CÓMO SE MIDE — nada doblado de lo que se mide:
//  · el servicio de `dist/` tal cual;
//  · el POST a `/charges` sale de verdad (node-fetch) hacia un servidor de este proceso que monta
//    el router REAL de `/charges` (`charges.routes.ts`): su validación (`CreateChargeSchema`) y su
//    `prisma.charge.create` son los de producción. Se mira el `data.payMethods` que le llega a la base;
//  · sólo se doblan la base (`_envio-doblado.mjs`, sin estado) y Meta (`WHATSAPP_DRY_RUN`, el buzón
//    de laboratorio). Ningún envío real: el número sale del rango imposible (SCRUM-262).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const requiere = createRequire(import.meta.url);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El cobro deja de leer las formas congeladas en la factura: vuelve a lo de antes de 1787p.
    fichero: 'src/modules/billing/domain/invoiceWhatsApp.service.ts',
    de: 'CreateQuoteSchema.shape.payMethods.safeParse(invoice.payMethods)',
    a: 'CreateQuoteSchema.shape.payMethods.safeParse(undefined)',
    cae: 'SCRUM-1787p ① factura con [bizum] → el cobro nace con [bizum]',
  },
  {
    // La factura deja de MANDAR sobre el presupuesto: el de origen vuelve a ganar.
    fichero: 'src/modules/billing/domain/invoiceWhatsApp.service.ts',
    de: 'const formasDelCobro = facturaPayMethods ?? quotePayMethods;',
    a: 'const formasDelCobro = quotePayMethods ?? facturaPayMethods;',
    cae: 'SCRUM-1787p ② la factura manda sobre el presupuesto de origen',
  },
];

const SERVICIO = '../dist/modules/billing/domain/invoiceWhatsApp.service.js';
const RUTA_COBROS = '../dist/modules/billing/app/routes/charges.routes.js';

// ── El servidor de `/charges`: el router REAL, recargado en cada caso tras inyectar la base ──────
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
  chargeId: null, quoteId: null, stageLabel: null, payMethods: null,
  merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
  customer: { id: CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null, email: 'cliente@example.invalid' },
};

/**
 * Envía la factura por el camino real y devuelve lo que vio la base: los `charge.create` (con su
 * `data`), los POST que recibió `/charges` y el resultado del servicio.
 */
async function enviar(factura, { formasDelPresupuesto = null, comercio = { id: MERCHANT } } = {}) {
  const creados = [];
  let posts = 0;
  inyectarBase({
    'invoice.findUnique': () => factura,
    // SCRUM-1429d: el enlace cobro→factura es `updateMany` condicional sobre lo leído; casa si la factura sigue igual.
    'invoice.updateMany': (args) => ({ count: (args.where || {}).chargeId === (factura.chargeId ?? null) ? 1 : 0 }),
    'quote.findUnique': () => (formasDelPresupuesto ? { payMethods: formasDelPresupuesto } : null),
    'merchant.findUnique': () => comercio,
    'charge.create': (args) => { creados.push(args.data); return { id: 90, expiresAt: null, reference: 'R', status: 'pending' }; },
    'charge.findUnique': () => ({ id: 90, receiptToken: 'tok-1787p-de-laboratorio' }),
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
    const resultado = await sendInvoicePaymentRequest(factura.id);
    return { resultado, creados, posts, buzon };
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
  }
}

test('SCRUM-1787p ① factura con [bizum] → el cobro nace con [bizum]', async () => {
  const { resultado, creados, posts } = await enviar({ ...facturaBase, payMethods: ['bizum'] });
  assert.equal(posts, 1, '🔴 CIEGO: el servicio no llegó a pedir el cobro a /charges');
  assert.equal(resultado.ok, true, `el envío no salió: ${JSON.stringify(resultado)}`);
  assert.equal(creados.length, 1);
  assert.deepEqual(creados[0].payMethods, ['bizum']);
});

test('SCRUM-1787p ② la factura manda sobre el presupuesto de origen', async () => {
  const { creados } = await enviar({ ...facturaBase, quoteId: 31, payMethods: ['transfer'] }, { formasDelPresupuesto: ['card', 'bizum'] });
  assert.equal(creados.length, 1);
  assert.deepEqual(creados[0].payMethods, ['transfer']);
});

test('SCRUM-1787p ③ control: factura sin formas y sin presupuesto → el cobro sin selector, como hoy', async () => {
  for (const sinFormas of [null, undefined, []]) {
    const { resultado, creados, posts } = await enviar({ ...facturaBase, payMethods: sinFormas });
    assert.equal(posts, 1, `🔴 CIEGO (${JSON.stringify(sinFormas)}): no llegó a /charges`);
    assert.equal(resultado.ok, true);
    assert.equal(creados.length, 1);
    assert.equal(creados[0].payMethods, undefined, `con ${JSON.stringify(sinFormas)} el cobro no debe llevar selector`);
  }
});

test('SCRUM-1787p ④ control: factura sin formas que viene de presupuesto → hereda las del presupuesto, como hoy', async () => {
  const { creados } = await enviar({ ...facturaBase, quoteId: 31, payMethods: null }, { formasDelPresupuesto: ['card', 'bizum'] });
  assert.deepEqual(creados[0].payMethods, ['card', 'bizum']);
});

test('SCRUM-1787p ⑤ las preferencias del comercio no cambian el cobro: ni al crearlo ni después', async () => {
  // Al crearlo: lo que el comercio tenga configurado (aquí, sin Bizum ni IBAN) no recorta lo congelado.
  const { creados } = await enviar(
    { ...facturaBase, payMethods: ['bizum', 'transfer'] },
    { comercio: { id: MERCHANT, bizumPhone: null, iban: null } },
  );
  assert.deepEqual(creados[0].payMethods, ['bizum', 'transfer']);
  // Después: la factura ya tiene su cobro → el reenvío lo reutiliza y no crea otro.
  const otra = await enviar({ ...facturaBase, chargeId: 90, payMethods: ['bizum'] });
  assert.equal(otra.resultado.ok, true);
  assert.equal(otra.posts, 0, 'con cobro ya creado no se vuelve a pedir otro a /charges');
  assert.equal(otra.creados.length, 0);
});

test('SCRUM-1787p ⑥ una forma fuera del conjunto cerrado no viaja: el cobro sale como hoy', async () => {
  const { resultado, creados } = await enviar({ ...facturaBase, payMethods: ['efectivo'] });
  assert.equal(resultado.ok, true, 'una factura con un valor raro no debe quedarse sin enviar');
  assert.equal(creados[0].payMethods, undefined);
});

test('SCRUM-1787p ⑦ el cobro y el presupuesto aceptan el MISMO conjunto cerrado de formas de pago', () => {
  const { CreateQuoteSchema, CreateChargeSchema } = moduloDeDist('../dist/core/validation/schemas.js');
  const opciones = (esquema) => {
    let s = esquema;
    // optional → array(min) → enum
    while (s && !s.element && (s._def?.innerType || s.unwrap)) s = s._def?.innerType ?? s.unwrap();
    const elemento = s?.element;
    assert.ok(elemento && Array.isArray(elemento.options), '🔴 CIEGO: no sé leer las opciones del esquema');
    return [...elemento.options].sort();
  };
  const delPresupuesto = opciones(CreateQuoteSchema.shape.payMethods);
  const delCobro = opciones(CreateChargeSchema.shape.pay_methods);
  assert.ok(delPresupuesto.length > 0, '🔴 CIEGO: el conjunto del presupuesto salió vacío');
  assert.deepEqual(delCobro, delPresupuesto);
});

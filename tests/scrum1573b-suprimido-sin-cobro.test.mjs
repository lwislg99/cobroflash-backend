// tests/scrum1573b-suprimido-sin-cobro.test.mjs — SCRUM-1573b (J2)
//
// Un comercio SUPRIMIDO no ofrece ninguna vía de cobro (GO del fundador, SCRUM-1573 c.21057).
//
// Es el banco de SCRUM-1573a (`docs/master/evidencias/SCRUM-1573/banco-suprimido.mjs`) convertido
// en test, con la misma forma:
// ① El comercio suprimido NO se escribe a mano: se pasa un comercio normal por el `suprimirMerchant`
//    REAL contra una base en memoria. Lo que sale redactado es lo que el código redacta hoy.
// ② Las rutas que el censo de 1573a da como «ofrecen cobro» se levantan REALES, con dobles de
//    prisma, Stripe y MP en `require.cache` (el patrón de `scrum893`). Ni BD, ni red, ni claves.
// ③ Cada ruta se pide ANTES de suprimir —control positivo: tiene que ofrecer cobro, o el caso no
//    mide nada y cae— y DESPUÉS. Las 6 puertas de `/pay` contestan el 404 de siempre, byte a byte;
//    `/recibo` y `/cliente` se siguen sirviendo, sin botones de pago.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R = (p) => require_.resolve(`./dist/${p}.js`);
const R_PRISMA = R('core/db/prisma');
const R_STRIPE = R('integrations/stripe');
const R_MP = R('integrations/mercadopago');
// MP cae al token de PLATAFORMA si el comercio no trae el suyo (eso es SCRUM-1615, no esto). Para
// que la puerta llegue a pedir la preferencia ANTES de suprimir, un token falso por entorno, antes
// de cargar `config`; la preferencia la crea un doble.
process.env.MP_ACCESS_TOKEN = 'TEST-1573-falso';
const { suprimirMerchant } = require_(R('modules/system/domain/supresionMerchant.service'));
const { REDACTADO } = require_(R('modules/system/domain/anonimizarMerchant'));
const { documentNotFoundHtml } = require_(R('core/http/publicNotFound'));

// Mutaciones que lee `scripts/meta-guard-mutaciones.mjs` por AST. Cada campo, LITERAL.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/billing/domain/comercioSuprimido.ts', de: 'return m?.name === REDACTADO;', a: 'return false;', cae: 'GET /pay/card: un comercio suprimido no abre Checkout en su cuenta Connect' },
  { fichero: 'src/modules/billing/app/routes/payCard.routes.ts', de: '    if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml()); // SCRUM-1573b\n', a: '', cae: 'GET /pay/card: un comercio suprimido no abre Checkout en su cuenta Connect' },
  { fichero: 'src/modules/billing/app/routes/payBank.routes.ts', de: '  if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml()); // SCRUM-1573b\n', a: '', cae: 'GET /pay/bank: un comercio suprimido contesta el 404 de siempre' },
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: '  if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml()); // SCRUM-1573b\n', a: '', cae: 'GET /pay/mp: un comercio suprimido no crea preferencia de MP' },
  { fichero: 'src/modules/billing/app/routes/receipt.routes.ts', de: 'const puedeTarjeta = !comercioSuprimido(ch.merchant) && ', a: 'const puedeTarjeta = ', cae: 'GET /recibo: se sirve sin botones de pago' },
  { fichero: 'src/modules/system/app/routes/customerPortal.routes.ts', de: 'const puedeTarjeta = !comercioSuprimido(m) && ', a: 'const puedeTarjeta = ', cae: 'GET /cliente: se sirve sin botones de pago' },
];

// ── ① El comercio, y su supresión real ──────────────────────────────────────────────────────
// Un comercio ES con todo puesto: IBAN, Bizum, Connect activo y los flags encendidos POR COMERCIO
// (el override de `merchant.flags` gana al entorno: el caso no depende de cómo esté la máquina).
const comercio = () => ({
  id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
  taxId: 'B12345678', address: 'C/ Mayor 1', country: 'ES', logoUrl: null, timezone: null,
  iban: 'ES9121000418450200051332', clabe: null, bizumPhone: '+34000111222', whatsappPhone: '+34000111222',
  connectStatus: 'active', stripeAccountId: 'acct_TEST1573', status: 'active',
  flags: { PAYMENTS_CONNECT_ENABLED: true, BIZUM_MANUAL_ENABLED: true },
});
const cliente = () => ({ id: 3, merchantId: 42, name: 'Ana', email: 'ana@ejemplo.test', phone: '+34000000002', mobile: null,
  legalName: null, taxId: null, notes: null, portalToken: 'portal1573' });

async function suprimido() {
  const filas = { merchant: [comercio()], customer: [cliente()] };
  const db = new Proxy({}, {
    get: (_t, modelo) => ({
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const f of filas[modelo] ?? []) if (Object.entries(where).every(([k, v]) => f[k] === v)) { Object.assign(f, data); count++; }
        return { count };
      },
    }),
  });
  const r = await suprimirMerchant({ merchantId: 42, actor: { tipo: 'humano', teamMemberId: 9 }, db, auditar: async () => {} });
  assert.ok(r.ok, `la supresión real no terminó: ${r.motivo}`);
  return { merchant: filas.merchant[0], customer: filas.customer[0] };
}

// ── ② Los dobles y el levantador (patrón scrum893) ─────────────────────────────────────────
function poner(ruta, exports) { require_.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports }; }
function prismaDe(m, c) {
  const ch = {
    id: 7, receiptToken: 'tok1573', status: 'pending', amount: 250, currency: 'EUR', concept: 'Reparación de bajante',
    reference: 'REF-7', payMethods: null, intentId: null, createdAt: new Date(), paidAt: null, merchantId: m.id,
    merchant: m, customer: c, events: [], reconciliations: [],
  };
  const factura = { id: 11, number: 'F-2026-0001', status: 'pending', currency: 'EUR', total: 250, createdAt: new Date(),
    pdfUrl: null, lines: [], charge: { id: 7 }, chargeId: 7, merchant: m, customer: c };
  const tablas = {
    charge: { findUnique: async () => ch, findFirst: async () => ch, update: async () => ch },
    customer: { findUnique: async () => ({ ...c, merchant: m, merchantId: m.id }), findFirst: async () => ({ ...c, merchant: m }) },
    invoice: { findFirst: async () => null, findUnique: async () => null, findMany: async () => [factura] },
    quote: { findFirst: async () => null, findMany: async () => [] },
    event: { findFirst: async () => null, create: async () => ({ id: 1 }) },
    job: { findFirst: async () => null }, teamMember: { findFirst: async () => null },
  };
  return new Proxy(tablas, { get: (t, k) => t[k] ?? new Proxy({}, { get: () => async () => null }) });
}
async function pedir({ modulo, montaje, url, metodo = 'GET' }, m, c) {
  const espia = {};
  const ruta = R(modulo);
  delete require_.cache[ruta];
  poner(R_PRISMA, { prisma: prismaDe(m, c) });
  poner(R_STRIPE, { stripeEnabled: true, stripe: { checkout: { sessions: { create: async (_p, opts) => {
    espia.checkout = opts?.stripeAccount ?? 'PLATAFORMA';
    return { id: 'cs_test_1573', url: 'https://checkout.stripe.test/1573' };
  } } } } });
  poner(R_MP, { createMpPreference: async () => { espia.mp = true; return { preferenceId: 'pref1573', checkoutUrl: 'https://mp.test/1573' }; } });
  const express = require_('express');
  const app = express();
  app.use(montaje, require_(ruta).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const res = await new Promise((ok, mal) => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method: metodo, agent: false }, (r) => {
        let d = ''; r.setEncoding('utf8');
        r.on('data', (t) => { d += t; });
        r.on('end', () => ok({ status: r.statusCode, cuerpo: d, location: r.headers.location ?? null }));
      });
      req.on('error', mal); req.end();
    });
    return { ...res, ofrece: ofertas(res, espia), espia };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

// ── ③ Qué ofrece cada respuesta (los marcadores del banco de 1573a) ─────────────────────────
const OFERTAS = [
  ['IBAN', /Copiar IBAN/], ['tarjeta', /Pagar con tarjeta|Pagar ahora|\/pay\/card\//], ['Bizum', /Pagar por Bizum|\/pay\/bizum\/|Copiar móvil/],
  ['transferencia', /Transferencia bancaria|Pagar por transferencia|\/pay\/bank\//],
];
function ofertas(r, espia) {
  const o = [];
  if (r.status >= 300 && r.status < 400) o.push(`redirige a ${r.location}`);
  for (const [n, re] of OFERTAS) if (re.test(r.cuerpo)) o.push(n);
  if (espia.mp) o.push('preferencia de MP');
  if (espia.checkout) o.push(`Checkout de Stripe en ${espia.checkout}`);
  return o;
}

const S = await suprimido();
assert.equal(S.merchant.name, REDACTADO, 'la supresión real ya no redacta `name`: la señal A de comercioSuprimido dejó de valer');
assert.equal(S.merchant.stripeAccountId, 'acct_TEST1573', 'el banco supone que la supresión NO toca la cuenta Connect');

async function antesYDespues(ruta) {
  const antes = await pedir(ruta, comercio(), cliente());
  assert.ok(antes.ofrece.length > 0, `CIEGO: ${ruta.url} no ofrecía cobro ANTES de suprimir, así que el caso no mide nada`);
  const despues = await pedir(ruta, { ...S.merchant }, { ...S.customer });
  return { antes, despues };
}
async function puerta404(ruta) {
  const { despues } = await antesYDespues(ruta);
  assert.equal(despues.status, 404, `${ruta.url} tras suprimir: ${despues.status} · ofrece ${despues.ofrece.join(', ')}`);
  assert.equal(despues.cuerpo, documentNotFoundHtml(), `${ruta.url} tras suprimir no contesta el 404 de siempre`);
  assert.deepEqual(despues.ofrece, []);
}
async function paginaSinBotones(ruta) {
  const { despues } = await antesYDespues(ruta);
  assert.equal(despues.status, 200, `${ruta.url} tras suprimir tiene que seguir sirviéndose`);
  assert.deepEqual(despues.ofrece, [], `${ruta.url} tras suprimir ofrece: ${despues.ofrece.join(', ')}`);
}

const PAY = (m) => `modules/billing/app/routes/${m}.routes`;

test('GET /pay/invoice: un comercio suprimido contesta el 404 de siempre', () =>
  puerta404({ modulo: PAY('payInvoice'), montaje: '/pay', url: '/pay/invoice/tok1573' }));
test('GET /pay/bank: un comercio suprimido contesta el 404 de siempre', () =>
  puerta404({ modulo: PAY('payBank'), montaje: '/pay', url: '/pay/bank/tok1573' }));
test('GET /pay/card: un comercio suprimido no abre Checkout en su cuenta Connect', () =>
  puerta404({ modulo: PAY('payCard'), montaje: '/pay', url: '/pay/card/tok1573' }));
test('GET /pay/bizum: un comercio suprimido contesta el 404 de siempre', () =>
  puerta404({ modulo: PAY('payBizum'), montaje: '/pay', url: '/pay/bizum/tok1573' }));
test('POST /pay/bizum/claimed: un comercio suprimido contesta el 404 de siempre', () =>
  puerta404({ modulo: PAY('payBizum'), montaje: '/pay', url: '/pay/bizum/tok1573/claimed', metodo: 'POST' }));
test('GET /pay/mp: un comercio suprimido no crea preferencia de MP', () =>
  puerta404({ modulo: PAY('payMp'), montaje: '/pay', url: '/pay/mp/tok1573' }));
test('GET /recibo: se sirve sin botones de pago', () =>
  paginaSinBotones({ modulo: PAY('receipt'), montaje: '/recibo', url: '/recibo/tok1573' }));
test('GET /cliente: se sirve sin botones de pago', () =>
  paginaSinBotones({ modulo: 'modules/system/app/routes/customerPortal.routes', montaje: '/cliente', url: '/cliente/portal1573' }));

test('comercioSuprimido importa REDACTADO y no lo copia', () => {
  const fuente = path.join(RAIZ, 'src/modules/billing/domain/comercioSuprimido.ts');
  assert.ok(fs.existsSync(fuente), `CIEGO: no existe ${fuente}`);
  const src = fs.readFileSync(fuente, 'utf8');
  assert.match(src, /import \{ REDACTADO \} from '\.\.\/\.\.\/system\/domain\/anonimizarMerchant';/);
  assert.equal(src.includes(REDACTADO), false, 'el texto de redacción está copiado en comercioSuprimido.ts');
  // Positivo del recuento de arriba: el mismo `includes` SÍ lo ve en el fichero que lo declara.
  assert.ok(fs.readFileSync(path.join(RAIZ, 'src/modules/system/domain/anonimizarMerchant.ts'), 'utf8').includes(REDACTADO));
});

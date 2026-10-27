// docs/master/evidencias/SCRUM-1573/banco-suprimido.mjs — SCRUM-1573a (J2)
//
// ¿Qué ve el cliente final en cada ruta de cobro cuando su comercio YA ESTÁ SUPRIMIDO?
//
// ① El comercio suprimido NO se escribe a mano: se fabrica pasando un comercio normal por
//    `suprimirMerchant` REAL (`dist/modules/system/domain/supresionMerchant.service.js`) contra una
//    base en memoria. Lo que salga redactado es lo que el código redacta hoy, no lo que yo creo.
// ② Las 8 rutas que el censo (`censo-cobro-publico.mjs`) da como «ofrecen cobro» se levantan
//    REALES sobre un doble de prisma y otro de Stripe en `require.cache` — el patrón de
//    `tests/scrum893-solo-lo-que-puede-cobrar.test.mjs`. Ni BD, ni red, ni credenciales.
// ③ Cada ruta se pide DOS veces: ANTES de suprimir (control positivo: tiene que ofrecer cobro) y
//    DESPUÉS. Si el «antes» no ofrece nada, la fila sale CIEGA: el banco no estaría midiendo.
//
// Uso (con `dist/` compilado):   node docs/master/evidencias/SCRUM-1573/banco-suprimido.mjs
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R = (p) => require_.resolve(`./dist/${p}.js`);
const R_PRISMA = R('core/db/prisma');
const R_STRIPE = R('integrations/stripe');
const R_MP = R('integrations/mercadopago');
// MP lee `merchant.mpAccessToken` (columna que NO existe en el esquema) o, si no, el token de la
// PLATAFORMA. Para que la puerta llegue a pedir la preferencia se le da un token de plataforma
// falso por entorno, antes de cargar `config`, y la preferencia la crea un doble.
process.env.MP_ACCESS_TOKEN = 'TEST-1573-falso';
const { suprimirMerchant } = require_(R('modules/system/domain/supresionMerchant.service'));
const { REDACTADO } = require_(R('modules/system/domain/anonimizarMerchant'));

// ── ① El comercio, y su supresión real ──────────────────────────────────────────────────────
// Un comercio ES con todo puesto: IBAN, Bizum, Connect activo y los flags encendidos POR COMERCIO
// (el override de `merchant.flags` gana al entorno: la medición no depende de cómo esté la máquina).
const comercio = () => ({
  id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
  taxId: 'B12345678', address: 'C/ Mayor 1', country: 'ES', logoUrl: null, timezone: null,
  iban: 'ES9121000418450200051332', clabe: null, bizumPhone: '+34600111222', whatsappPhone: '+34600111222',
  connectStatus: 'active', stripeAccountId: 'acct_TEST1573', status: 'active',
  flags: { PAYMENTS_CONNECT_ENABLED: true, BIZUM_MANUAL_ENABLED: true },
});
const cliente = () => ({ id: 3, merchantId: 42, name: 'Ana', email: 'ana@ejemplo.test', phone: '+34611000000', mobile: null,
  legalName: null, taxId: null, notes: null, portalToken: 'portal1573' });

async function suprimido() {
  const filas = { merchant: [comercio()], customer: [cliente()] };
  const rastro = [];
  const db = new Proxy({}, {
    get: (_t, modelo) => ({
      updateMany: async ({ where, data }) => {
        const lista = filas[modelo] ?? [];
        let count = 0;
        for (const f of lista) if (Object.entries(where).every(([k, v]) => f[k] === v)) { Object.assign(f, data); count++; }
        return { count };
      },
    }),
  });
  const r = await suprimirMerchant({
    merchantId: 42, actor: { tipo: 'humano', teamMemberId: 9 }, db,
    auditar: async (entrada) => { rastro.push(entrada); },
  });
  if (!r.ok) throw new Error(`la supresión real no terminó: ${r.motivo}`);
  return { merchant: filas.merchant[0], customer: filas.customer[0], rastro };
}

// ── ② Los dobles y el levantador (patrón scrum893) ─────────────────────────────────────────
function poner(ruta, exports) { require_.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports }; }
function dobleStripe(espia) {
  return { stripe: { checkout: { sessions: { create: async (params, opts) => {
    espia.creada = true; espia.cuenta = opts?.stripeAccount ?? null; espia.email = params.customer_email ?? null;
    return { id: 'cs_test_1573', url: 'https://checkout.stripe.test/1573' };
  } } } }, stripeEnabled: true };
}
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
async function pedir({ modulo, montaje, url, metodo = 'GET', m, c, espia = {} }) {
  const ruta = R(modulo);
  delete require_.cache[ruta];
  poner(R_PRISMA, { prisma: prismaDe(m, c) });
  poner(R_STRIPE, dobleStripe(espia));
  poner(R_MP, { createMpPreference: async (p) => { espia.mp = p; return { preferenceId: 'pref1573', checkoutUrl: 'https://mp.test/1573' }; } });
  const express = require_('express');
  const app = express();
  app.use(montaje, require_(ruta).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await new Promise((ok, mal) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method: metodo, agent: false }, (r) => {
      let d = ''; r.setEncoding('utf8');
      r.on('data', (t) => { d += t; });
      r.on('end', () => ok({ status: r.statusCode, cuerpo: d, location: r.headers.location ?? null }));
    });
    req.on('error', mal); req.end();
  });
  await new Promise((r) => server.close(r));
  return res;
}

// ── ③ Qué ofrece cada respuesta ─────────────────────────────────────────────────────────────
const OFERTAS = [
  ['IBAN', /Copiar IBAN/], ['tarjeta', /Pagar con tarjeta|Pagar ahora|\/pay\/card\//], ['Bizum', /Pagar por Bizum|\/pay\/bizum\/|Copiar móvil/],
  ['transferencia', /Transferencia bancaria|Pagar por transferencia|\/pay\/bank\//],
];
function lee(r, espia) {
  const o = [];
  if (r.status >= 300 && r.status < 400) o.push(`redirige → ${r.location}`);
  for (const [n, re] of OFERTAS) if (re.test(r.cuerpo)) o.push(n);
  if (espia.mp) o.push(`preferencia MP (customerEmail=${JSON.stringify(espia.mp.customerEmail)})`);
  if (espia.creada) o.push(`checkout Stripe en ${espia.cuenta ?? 'PLATAFORMA'} (customer_email=${JSON.stringify(espia.email)})`);
  const red = r.cuerpo.split(REDACTADO).length - 1;
  return { o, red, status: r.status };
}

const RUTAS = [
  { n: 'GET /pay/invoice/:token', modulo: 'modules/billing/app/routes/payInvoice.routes', montaje: '/pay', url: '/pay/invoice/tok1573' },
  { n: 'GET /pay/bank/:token', modulo: 'modules/billing/app/routes/payBank.routes', montaje: '/pay', url: '/pay/bank/tok1573' },
  { n: 'GET /pay/card/:token', modulo: 'modules/billing/app/routes/payCard.routes', montaje: '/pay', url: '/pay/card/tok1573' },
  { n: 'GET /pay/bizum/:token', modulo: 'modules/billing/app/routes/payBizum.routes', montaje: '/pay', url: '/pay/bizum/tok1573' },
  { n: 'POST /pay/bizum/:token/claimed', modulo: 'modules/billing/app/routes/payBizum.routes', montaje: '/pay', url: '/pay/bizum/tok1573/claimed', metodo: 'POST' },
  { n: 'GET /pay/mp/:token', modulo: 'modules/billing/app/routes/payMp.routes', montaje: '/pay', url: '/pay/mp/tok1573' },
  { n: 'GET /recibo/:token', modulo: 'modules/billing/app/routes/receipt.routes', montaje: '/recibo', url: '/recibo/tok1573' },
  { n: 'GET /cliente/:token', modulo: 'modules/system/app/routes/customerPortal.routes', montaje: '/cliente', url: '/cliente/portal1573' },
];

const s = await suprimido();
console.log('COMERCIO FABRICADO POR suprimirMerchant REAL:');
for (const k of ['name', 'legalName', 'iban', 'bizumPhone', 'whatsappPhone', 'connectStatus', 'stripeAccountId', 'status', 'flags'])
  console.log(`  merchant.${k} = ${JSON.stringify(s.merchant[k])}`);
console.log(`  customer.email = ${JSON.stringify(s.customer.email)} · rastro: ${s.rastro.map((x) => x.action).join(', ')}`);

let ciegas = 0;
console.log('\nRUTA                              ANTES de suprimir                         | DESPUÉS de suprimir');
for (const ruta of RUTAS) {
  const ea = {}, ed = {};
  const a = lee(await pedir({ ...ruta, m: comercio(), c: cliente(), espia: ea }), ea);
  const d = lee(await pedir({ ...ruta, m: { ...s.merchant }, c: { ...s.customer }, espia: ed }), ed);
  const ciega = a.o.length === 0;
  if (ciega) ciegas++;
  console.log(`${ruta.n.padEnd(33)} ${String(a.status)} ${a.o.join(', ') || '—'}`);
  console.log(`${''.padEnd(33)} ${String(d.status)} ${d.o.join(', ') || '— nada'} · texto de redacción en la página: ${d.red}${ciega ? '  ⚠️ CIEGA (el «antes» no ofrece nada)' : ''}`);
}
console.log(`\nVEREDICTO DEL BANCO: ${ciegas ? `CIEGO en ${ciegas} de ${RUTAS.length}` : `${RUTAS.length} de ${RUTAS.length} con control positivo vivo`}`);
process.exitCode = ciegas ? 2 : 0;

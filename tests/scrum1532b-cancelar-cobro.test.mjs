// tests/scrum1532b-cancelar-cobro.test.mjs — SCRUM-1532b (J2, 23-nov-2026)
//
// CANCELAR UN COBRO: la única transición del máster `pending → cancelled`. GO, dos decisiones y tres
// textos firmados por el fundador en SCRUM-1532 c.22430. El plano es `docs/master/SCRUM-1532.md`.
//
// Lo que se prueba, todo EJECUTANDO dist/ con la base doblada (ni BD, ni red, ni staging):
//   ① la ruta `POST /admin/charges/:id/cancel` — el molde de «Anular factura»: sólo desde `pending`,
//      idempotente, 409 desde cualquier otro estado, el estado DENTRO del `where`, 404 de otro
//      comercio, 400 con un id que no cabe, 403 al operario;
//   ③ la cara pública: el recibo de un cobro cancelado dice el literal firmado y no ofrece pagar, y
//      las páginas de pago (selector, Bizum, transferencia, Mercado Pago) mandan al recibo;
//   ④ decisión 1: si entra dinero en un cobro cancelado, pasa a pagado igual que hoy;
//      decisión 2: cancelar NO escribe la factura (se queda pendiente de cobro).
//
// La fila de auditoría NO está: su literal es nuevo y vive en un fichero de S1 (audit.service.ts);
// pedido al orquestador, sin respuesta al empujar. Lo dice el registro.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { casosEscritos } from './_casos-escritos.mjs'; // SCRUM-1415 · un caso por fila, con su nombre escrito

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
process.env.INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'secreto-de-juguete-1532b';

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_ADMIN = require_.resolve('./dist/modules/billing/app/routes/chargesAdmin.routes.js');
const R_PSP = require_.resolve('./dist/modules/billing/app/routes/psp.routes.js');
const R_RECIBO = require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js');
const R_INVOICE = require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js');
const R_BIZUM = require_.resolve('./dist/modules/billing/app/routes/payBizum.routes.js');
const R_BANK = require_.resolve('./dist/modules/billing/app/routes/payBank.routes.js');
const R_MP = require_.resolve('./dist/modules/billing/app/routes/payMp.routes.js');

/** Los tres literales FIRMADOS en SCRUM-1532 c.22430, copiados de Jira. El de la UI es de J1. */
export const RECIBO_CANCELADO = 'Este cobro se ha cancelado.';

/** Mutaciones que este fichero tiene que tumbar (A3, SCRUM-1731). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: "where: { id, merchantId: req.merchantId, status: 'pending' },",
    a: 'where: { id, merchantId: req.merchantId },',
    cae: 'con `pending` y el comercio DENTRO del `where`',
  },
  {
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: "cancelled: { icon: '✕', title: 'Este cobro se ha cancelado.', cls: 'expired' },",
    a: '',
    cae: 'el recibo de un cobro cancelado',
  },
];

const MERCHANT = 4242;
const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

// ── ① LA RUTA ─────────────────────────────────────────────────────────────────────────────────
/** Ejecuta POST /:id/cancel con TODAS sus capas (también el `requireRole` de la ruta). */
async function cancelar({ estado, rol = 'admin', id = '7', existe = true, updateLanza = null }) {
  const llamadas = [];
  const modelo = (nombre) => new Proxy({}, {
    get: (_t, metodo) => async (args) => {
      llamadas.push({ q: `${nombre}.${String(metodo)}`, args });
      if (nombre === 'charge' && metodo === 'findFirst') return existe ? { id: Number(id), status: estado } : null;
      if (nombre === 'charge' && metodo === 'update') {
        if (updateLanza) throw updateLanza;
        return { id: Number(id), status: args.data.status };
      }
      return metodo === 'findMany' ? [] : null;
    },
  });
  poner(R_PRISMA, { prisma: new Proxy({}, { get: (_t, n) => modelo(String(n)) }) });
  delete require_.cache[R_ADMIN];
  const router = require_(R_ADMIN).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/cancel' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no existe POST /:id/cancel en chargesAdmin');
  const r = { status: 200, data: undefined };
  const res = new Proxy({}, {
    get: (_t, p) => {
      if (p === 'then') return undefined;
      if (p === 'status') return (s) => { r.status = s; return res; };
      if (p === 'json' || p === 'send') return (j) => { r.data = j; return res; };
      return () => res;
    },
  });
  const req = reqDeSesion({ rol, merchantId: MERCHANT, method: 'POST', params: { id }, query: {}, body: {}, teamMemberId: null });
  const callar = console.error; console.error = () => {};
  try {
    for (const l of capa.route.stack) {
      let siguio = false;
      await l.handle(req, res, () => { siguio = true; });
      if (!siguio) break;
    }
  } finally { console.error = callar; }
  return { ...r, llamadas };
}

test('SCRUM-1532b · ① desde `pending` cancela: escribe `cancelled` con `pending` y el comercio DENTRO del `where`', async () => {
  const r = await cancelar({ estado: 'pending' });
  assert.equal(r.status, 200);
  assert.equal(r.data?.status, 'cancelled');
  const lectura = r.llamadas.find((c) => c.q === 'charge.findFirst');
  assert.equal(lectura?.args?.where?.merchantId, MERCHANT, 'regla 2: se busca dentro del comercio de la sesión');
  const esc = r.llamadas.filter((c) => c.q === 'charge.update');
  assert.equal(esc.length, 1, 'una sola escritura');
  assert.deepEqual(esc[0].args.data, { status: 'cancelled' });
  assert.equal(esc[0].args.where.status, 'pending', '🔴 el estado va DENTRO del `where`: es la barrera que sujeta');
  assert.equal(esc[0].args.where.merchantId, MERCHANT);
});

const NO_PENDIENTES = ['paid', 'failed', 'expired', 'otro_que_no_existe'];
const desdeNoPendiente = casosEscritos(NO_PENDIENTES, (estado) => `SCRUM-1532b · ① desde \`${estado}\` → 409 y no escribe nada`, async (estado) => {
  const r = await cancelar({ estado });
  assert.equal(r.status, 409);
  assert.equal(r.data?.error, 'charge_not_pending');
  assert.equal(r.llamadas.filter((c) => /\.(update|updateMany|create|delete)/.test(c.q)).length, 0);
});
test('SCRUM-1532b · ① desde `paid` → 409 y no escribe nada', desdeNoPendiente(0));
test('SCRUM-1532b · ① desde `failed` → 409 y no escribe nada', desdeNoPendiente(1));
test('SCRUM-1532b · ① desde `expired` → 409 y no escribe nada', desdeNoPendiente(2));
test('SCRUM-1532b · ① desde `otro_que_no_existe` → 409 y no escribe nada', desdeNoPendiente(3));
desdeNoPendiente.todos();

test('SCRUM-1532b · ① idempotente: un cobro ya cancelado contesta 200 y no vuelve a escribir', async () => {
  const r = await cancelar({ estado: 'cancelled' });
  assert.equal(r.status, 200);
  assert.equal(r.data?.status, 'cancelled');
  assert.equal(r.data?.yaEstaba, true);
  assert.equal(r.llamadas.filter((c) => c.q === 'charge.update').length, 0);
});

test('SCRUM-1532b · ① si entre leer y escribir deja de estar `pending` (P2025) → el mismo 409', async () => {
  const r = await cancelar({ estado: 'pending', updateLanza: Object.assign(new Error('Record to update not found'), { code: 'P2025' }) });
  assert.equal(r.status, 409);
  assert.equal(r.data?.error, 'charge_not_pending');
});

test('SCRUM-1532b · ① de otro comercio → 404; id que no cabe → 400 sin consultar; operario → 403', async () => {
  const otro = await cancelar({ estado: 'pending', existe: false });
  assert.equal(otro.status, 404);
  assert.equal(otro.llamadas.filter((c) => c.q === 'charge.update').length, 0);
  const grande = await cancelar({ estado: 'pending', id: '2147483648' });
  assert.equal(grande.status, 400);
  assert.equal(grande.llamadas.length, 0);
  const tecnico = await cancelar({ estado: 'pending', rol: 'tecnico' });
  assert.equal(tecnico.status, 403, 'la ruta declara su rol, como garantía y anular factura');
  assert.equal(tecnico.llamadas.length, 0);
});

test('SCRUM-1532b · ④ decisión 2: cancelar NO toca la factura (se queda pendiente de cobro)', async () => {
  const r = await cancelar({ estado: 'pending' });
  assert.equal(r.status, 200, 'control positivo: la cancelación sí ocurrió');
  assert.deepEqual(r.llamadas.filter((c) => c.q.startsWith('invoice.')).map((c) => c.q), []);
  assert.deepEqual(r.llamadas.filter((c) => !c.q.startsWith('charge.')).map((c) => c.q), [],
    'ni factura, ni presupuesto, ni eventos: sólo el cobro');
});

// ── ④ DECISIÓN 1: dinero que entra en un cobro cancelado ───────────────────────────────────────
test('SCRUM-1532b · ④ decisión 1: un `payment.confirmed` sobre un cobro `cancelled` lo deja pagado, como hoy', async () => {
  const escrituras = [];
  const ch = { id: 7, merchantId: MERCHANT, status: 'cancelled', amount: 100, currency: 'EUR', customerId: null, receiptToken: 't' };
  const modelo = (nombre) => new Proxy({}, {
    get: (_t, metodo) => async (args) => {
      const q = `${nombre}.${String(metodo)}`;
      if (q === 'charge.findUnique') return ch;
      if (q === 'charge.update') { escrituras.push(args); return { ...ch, ...args.data }; }
      if (metodo === 'findMany') return [];
      if (metodo === 'count') return 0;
      if (metodo === 'updateMany' || metodo === 'deleteMany') return { count: 0 };
      if (metodo === 'findUnique' || metodo === 'findFirst') return null;
      return {};
    },
  });
  const base = new Proxy({}, { get: (_t, n) => (n === '$transaction' ? async (f) => (typeof f === 'function' ? f(base) : Promise.all(f)) : modelo(String(n))) });
  poner(R_PRISMA, { prisma: base });
  delete require_.cache[R_PSP];
  const router = require_(R_PSP).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no encuentro POST / en psp');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const res = new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : () => res) });
  const callar = [console.error, console.log, console.warn];
  console.error = console.log = console.warn = () => {};
  try {
    await h({ body: { event: 'payment.confirmed', charge_id: 7, method: 'card', amount: 100, currency: 'EUR' }, headers: {}, query: {}, params: {} }, res);
  } catch { /* lo que venga DESPUÉS de marcar pagado no es de este caso */ } finally { [console.error, console.log, console.warn] = callar; }
  const aPagado = escrituras.find((e) => e.data?.status === 'paid');
  assert.ok(aPagado, `🔴 el dinero que entra en un cobro cancelado debía dejarlo pagado (escrituras: ${JSON.stringify(escrituras.map((e) => e.data?.status))})`);
});

// ── ③ LA CARA PÚBLICA ─────────────────────────────────────────────────────────────────────────
async function pedirPublica(modulo, montaje, url, estado) {
  delete require_.cache[modulo];
  const m = {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test', country: 'ES',
    logoUrl: null, iban: 'ES9121000418450200051332', clabe: null, bizumPhone: '600000000', whatsappPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: { BIZUM_MANUAL_ENABLED: true }, timezone: 'Europe/Madrid',
  };
  const ch = {
    id: 7, merchantId: 42, receiptToken: 'tok1532', status: estado, amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), merchant: m,
    customer: { id: 3, name: 'Ana', email: null }, events: [], reconciliations: [],
  };
  poner(R_PRISMA, { prisma: {
    charge: { findUnique: async () => ch, findFirst: async () => ch, update: async () => ch },
    invoice: { findFirst: async () => null, findUnique: async () => null, findMany: async () => [] },
    quote: { findFirst: async () => null },
    event: { create: async () => ({ id: 1 }) },
    merchant: { findUnique: async () => m },
  } });
  const express = require_('express');
  const app = express();
  app.use(montaje, require_(modulo).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await new Promise((ok, mal) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method: 'GET', agent: false }, (r) => {
      let d = ''; r.setEncoding('utf8');
      r.on('data', (t) => { d += t; });
      r.on('end', () => ok({ status: r.statusCode, cuerpo: d, location: r.headers.location }));
    });
    req.on('error', mal);
    req.end();
  });
  await new Promise((r) => server.close(r));
  return res;
}

test('SCRUM-1532b · ③ el recibo de un cobro cancelado dice el literal firmado y no ofrece pagar', async () => {
  const pend = await pedirPublica(R_RECIBO, '/recibo', '/recibo/tok1532', 'pending');
  assert.equal(pend.status, 200);
  assert.match(pend.cuerpo, /pay-btn/, 'control positivo: el pendiente SÍ ofrece pagar');
  assert.ok(!pend.cuerpo.includes(RECIBO_CANCELADO), 'cero derivado: el pendiente no dice que está cancelado');
  const r = await pedirPublica(R_RECIBO, '/recibo', '/recibo/tok1532', 'cancelled');
  assert.equal(r.status, 200);
  assert.ok(r.cuerpo.includes(RECIBO_CANCELADO), `🔴 el recibo de un cobro cancelado no dice «${RECIBO_CANCELADO}»`);
  assert.doesNotMatch(r.cuerpo, /pay-btn/, 'ningún botón de pago');
  assert.ok(!r.cuerpo.includes('Pago pendiente'), 'no cae al «Pago pendiente» de un estado desconocido');
});

const PAGINAS = [
  ['selector', R_INVOICE, '/pay', '/pay/invoice/tok1532'],
  ['Bizum', R_BIZUM, '/pay', '/pay/bizum/tok1532'],
  ['transferencia', R_BANK, '/pay', '/pay/bank/tok1532'],
  ['Mercado Pago', R_MP, '/pay', '/pay/mp/tok1532'],
];
const paginaCancelada = casosEscritos(PAGINAS, ([nombre]) => `SCRUM-1532b · ③ la página de pago (${nombre}) de un cobro cancelado manda al recibo`, async ([, modulo, montaje, url]) => {
  const r = await pedirPublica(modulo, montaje, url, 'cancelled');
  assert.ok([302, 303].includes(r.status), `🔴 ${url} con el cobro cancelado contesta ${r.status}: sigue abierta`);
  assert.match(String(r.location), /\/recibo\/tok1532$/);
  const p = await pedirPublica(modulo, montaje, url, 'pending');
  assert.ok(!/\/recibo\/tok1532$/.test(String(p.location || '')), 'control: con el cobro pendiente no manda al recibo');
});
test('SCRUM-1532b · ③ la página de pago (selector) de un cobro cancelado manda al recibo', paginaCancelada(0));
test('SCRUM-1532b · ③ la página de pago (Bizum) de un cobro cancelado manda al recibo', paginaCancelada(1));
test('SCRUM-1532b · ③ la página de pago (transferencia) de un cobro cancelado manda al recibo', paginaCancelada(2));
test('SCRUM-1532b · ③ la página de pago (Mercado Pago) de un cobro cancelado manda al recibo', paginaCancelada(3));
paginaCancelada.todos();

// ── LA FALTA DECLARADA (SCRUM-1532 c.22435) ────────────────────────────────────────────────────
// La fila de auditoría necesita la clave `cobro_cancelado`, aprobada como clave interna, que añade S1
// en `src/modules/system/audit.service.ts`. Hasta entonces la ruta NO deja fila, y este caso lo dice
// en vez de callarlo. El día que la clave exista, cae: es la señal para 1532c (poner la fila).
test('SCRUM-1532b · FALTA DECLARADA: sin fila de auditoría hasta que exista la clave `cobro_cancelado` (→ 1532c)', async () => {
  const fs = await import('node:fs');
  const tipos = fs.readFileSync(path.join(RAIZ, 'src/modules/system/audit.service.ts'), 'utf8');
  assert.ok(tipos.includes("'factura_anulada'"), 'control positivo: leo la unión de acciones de verdad');
  assert.ok(!tipos.includes("'cobro_cancelado'"),
    '🔴 la clave `cobro_cancelado` ya existe: toca 1532c — la ruta tiene que dejar su fila y este caso pasa a exigirla');
  const r = await cancelar({ estado: 'pending' });
  assert.equal(r.status, 200);
  assert.equal(r.llamadas.filter((c) => c.q.startsWith('auditLog.')).length, 0, 'hoy no escribe auditoría, y se dice aquí');
});

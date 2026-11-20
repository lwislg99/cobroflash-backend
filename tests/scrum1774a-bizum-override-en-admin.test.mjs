// tests/scrum1774a-bizum-override-en-admin.test.mjs — SCRUM-1774a (J2)
//
// «¿BIZUM MANUAL DISPONIBLE PARA ESTE COMERCIO?» TIENE UNA SOLA RESPUESTA.
//
// `confirm-bizum` (`chargesAdmin.routes.ts`) pregunta con `isFlagEnabled('BIZUM_MANUAL_ENABLED',
// { merchant })` y a ese `merchant` le pide `flags`, así que ve el override por comercio
// (`merchants.flags`, precedencia merchant > país > env de `src/core/flags.ts`).
// `GET /admin/connect/status` llamaba a la MISMA función, pero su `select` no traía `flags`: la
// función recibía un comercio sin override y contestaba el global. Con el override ON y el global
// OFF, la tarjeta «Cobros» decía `bizumEnabled: false` y `confirm-bizum` aceptaba el cobro
// (SCRUM-1732 c.22174, hallazgo leído en el código por jv-j2d8).
//
// Se prueba la RUTA MONTADA (router real de `dist/` sobre express, sesión de `reqDeSesion`), no el
// handler sacado de `route.stack` (A10, SCRUM-1344). El doble de prisma devuelve SÓLO las columnas
// que pide el `select`, igual que Prisma: es lo que hace visible el defecto, porque la fila de la
// base SÍ tiene `flags`.
//
// ⚠️ Fuera de este test: `GET /admin/me` (`src/app.ts`, `bizumManualEnabled` y `bizumSinTelefono`)
// y `viasDeCobro` de `GET /admin/merchant` (`src/app.ts`) tienen el mismo defecto, pero `src/app.ts`
// es del carril S1 (contenedor): se dejan en SCRUM-1774 con fichero:línea, no se arreglan aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_CONNECT = require_.resolve('./dist/modules/payments/connect/connect.routes.js');
const R_CHARGES = require_.resolve('./dist/modules/billing/app/routes/chargesAdmin.routes.js');
const R_AXIOS = createRequire(R_CHARGES).resolve('axios');

const MERCHANT_ID = 2;

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/payments/connect/connect.routes.ts',
    de: "    select: { id: true, country: true, flags: true, connectStatus: true, stripeAccountId: true, bizumPhone: true, whatsappPhone: true, iban: true },\n",
    a: "    select: { id: true, country: true, connectStatus: true, stripeAccountId: true, bizumPhone: true, whatsappPhone: true, iban: true },\n",
    cae: '1774a ① · /admin/connect/status con override ON y global OFF dice bizumEnabled: true',
  },
  {
    fichero: 'src/modules/payments/connect/connect.routes.ts',
    de: "    bizumEnabled: isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant }),\n",
    a: "    bizumEnabled: isFlagEnabled('BIZUM_MANUAL_ENABLED'),\n",
    cae: '1774a ① · /admin/connect/status con override ON y global OFF dice bizumEnabled: true',
  },
];

function poner(ruta, exports) {
  require_.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports };
}

/** Lo que hace Prisma con `select`: sólo las columnas pedidas (y recursivo en relaciones). */
function proyectar(fila, select) {
  if (!select) return fila;
  const salida = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    if (typeof v === 'object' && v.select) salida[k] = fila[k] == null ? null : proyectar(fila[k], v.select);
    else salida[k] = fila[k];
  }
  return salida;
}

/** La fila del comercio TAL COMO ESTÁ EN LA BASE: con su columna `flags`. */
function filaComercio(flags) {
  return {
    id: MERCHANT_ID, country: 'ES', flags, timezone: 'Europe/Madrid',
    connectStatus: 'none', stripeAccountId: null, bizumPhone: '600000000', whatsappPhone: null, iban: null,
  };
}

function doblePrisma(flags) {
  const m = filaComercio(flags);
  return {
    merchant: {
      findUnique: async ({ where, select }) => (where.id === MERCHANT_ID ? proyectar(m, select) : null),
    },
    charge: {
      findFirst: async ({ where, select }) => {
        if (where.merchantId !== MERCHANT_ID) return null;
        // Cliente CON correo: así `envioDelDocumentoDelCobro` no espera al WhatsApp (3 s por llamada).
        const fila = {
          id: where.id, status: 'pending', amount: '100.00', currency: 'EUR', merchant: m,
          customer: { name: 'C', email: 'c@example.test', phone: null, mobile: null },
        };
        return proyectar(fila, select);
      },
    },
    whatsAppMessage: { findMany: async () => [] },
    quote: { findFirst: async () => null },
    invoice: { findFirst: async () => null },
  };
}

/** Petición por `node:http` con `agent: false` (SCRUM-1107b: nunca `fetch` sobre `listen(0)`). */
function peticion(puerto, { method, url, body }) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: '127.0.0.1', port: puerto, path: url, method, agent: false,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (t) => { data += t; });
        res.on('end', () => {
          let cuerpo = null;
          try { cuerpo = data ? JSON.parse(data) : null; } catch { /* null */ }
          resolve({ status: res.statusCode, cuerpo });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Monta los dos routers reales donde los monta `app.ts` y hace UNA petición con sesión de admin. */
async function pedir({ flags, method, url, body }) {
  const llamadasPsp = [];
  delete require_.cache[R_CONNECT];
  delete require_.cache[R_CHARGES];
  poner(R_PRISMA, { prisma: doblePrisma(flags) });
  // confirm-bizum encadena el post-pago por HTTP al propio servidor: aquí se apunta y no sale nada.
  const post = async (u, b) => { llamadasPsp.push({ u, b }); return { data: { ok: true } }; };
  poner(R_AXIOS, { __esModule: true, default: { post }, post });
  const express = require_('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MERCHANT_ID }));
    next();
  });
  app.use('/admin/connect', require_(R_CONNECT).default);
  app.use('/admin/charges', require_(R_CHARGES).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const r = await peticion(server.address().port, { method, url, body });
    return { ...r, llamadasPsp };
  } finally {
    await new Promise((r) => server.close(r));
    delete require_.cache[R_AXIOS];
  }
}

const statusConnect = (flags) => pedir({ flags, method: 'GET', url: '/admin/connect/status' });
const confirmBizum = (flags) => pedir({ flags, method: 'POST', url: '/admin/charges/7/confirm-bizum', body: {} });

// El global, APAGADO y explícito: el test no depende del entorno de quien lo corre.
const envPrevio = process.env.BIZUM_MANUAL_ENABLED;
test.before(() => { process.env.BIZUM_MANUAL_ENABLED = 'false'; });
test.after(() => {
  if (envPrevio === undefined) delete process.env.BIZUM_MANUAL_ENABLED;
  else process.env.BIZUM_MANUAL_ENABLED = envPrevio;
});

test('1774a ① · /admin/connect/status con override ON y global OFF dice bizumEnabled: true', async () => {
  const r = await statusConnect({ BIZUM_MANUAL_ENABLED: true });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.bizumEnabled, true,
    'el comercio tiene BIZUM_MANUAL_ENABLED: true en merchants.flags y la tarjeta «Cobros» dice que no: '
    + 'la ruta no le pasa `flags` a isFlagEnabled y contesta el global');
  // La columna se lee para decidir; no sale en la respuesta.
  assert.equal('flags' in r.cuerpo, false, 'la respuesta no debe llevar merchants.flags');
});

test('1774a ② · control negativo: override false con global OFF → bizumEnabled: false', async () => {
  const r = await statusConnect({ BIZUM_MANUAL_ENABLED: false });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.bizumEnabled, false);
});

test('1774a ③ · sin override, manda el global (OFF) → bizumEnabled: false', async () => {
  const r = await statusConnect({});
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.bizumEnabled, false);
});

test('1774a ④ · positivo: confirm-bizum con override ON ya pasa la puerta del flag (no 409 bizum_disabled)', async () => {
  const r = await confirmBizum({ BIZUM_MANUAL_ENABLED: true });
  assert.notEqual(r.cuerpo?.error, 'bizum_disabled', JSON.stringify(r.cuerpo));
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.llamadasPsp.length, 1, 'confirm-bizum encadena el post-pago una vez');
});

test('1774a ⑤ · confirm-bizum con override false → 409 bizum_disabled (la puerta existe)', async () => {
  const r = await confirmBizum({ BIZUM_MANUAL_ENABLED: false });
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo?.error, 'bizum_disabled');
  assert.equal(r.llamadasPsp.length, 0);
});

test('1774a ⑥ · las dos rutas dan la MISMA respuesta para el mismo comercio', async () => {
  for (const flags of [{ BIZUM_MANUAL_ENABLED: true }, { BIZUM_MANUAL_ENABLED: false }, {}]) {
    const s = await statusConnect(flags);
    const c = await confirmBizum(flags);
    const confirmVe = c.cuerpo?.error !== 'bizum_disabled';
    assert.equal(s.cuerpo.bizumEnabled, confirmVe, `discrepan con flags=${JSON.stringify(flags)}`);
  }
});

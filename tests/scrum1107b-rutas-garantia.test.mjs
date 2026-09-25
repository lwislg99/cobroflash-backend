// tests/scrum1107b-rutas-garantia.test.mjs — SCRUM-1107
//
// Las dos rutas nuevas de chargesAdmin.routes.ts, CORRIDAS de verdad (dist/, con un doble de
// prisma en require.cache — mismo mecanismo que SCRUM-893). Cubre lo que el módulo puro
// (scrum1107-retencion-garantia) no puede: la tenencia (regla 2), `requireRole('admin')`, y el
// invariante ② del encargo — el cobro de la liberación es un Charge NUEVO y
// `retencionGarantiaCobrada` pasa de NULL a fecha EN ESE MOMENTO, con las dos escrituras juntas.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_ROUTES = require_.resolve('./dist/modules/billing/app/routes/chargesAdmin.routes.js');

function poner(ruta, exports) {
  require_.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports };
}

/**
 * Petición por `node:http` con `agent: false` — NUNCA `fetch` aquí. Con varias peticiones de
 * undici sobre el mismo `listen(0)` el proceso revienta una aserción nativa de libuv al cerrar
 * (medido en este mismo fichero: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`,
 * reproducible en las dos primeras pasadas). Es el remedio ya escrito en SCRUM-100/560/809:
 * `agent: false` abre y cierra su propia conexión, sin pool que deje nada a medias.
 */
function peticion(puerto, { method = 'POST', url, body }) {
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
          try { cuerpo = data ? JSON.parse(data) : null; } catch { /* se deja null */ }
          resolve({ status: res.statusCode, cuerpo });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Levanta el router real con el doble de prisma puesto y `req.merchantId`/`req.userRole`
 * inyectados como lo haría el middleware de auth real (fuera de alcance aquí: SCRUM-1107 no
 * lo toca). */
async function pedir({ prisma, url, method = 'POST', body, userRole = 'admin', merchantId = 42 }) {
  delete require_.cache[R_ROUTES];
  poner(R_PRISMA, { prisma });
  const express = require_('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.merchantId = merchantId; req.userRole = userRole; next(); });
  app.use('/admin/charges', require_(R_ROUTES).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const puerto = server.address().port;
  try {
    return await peticion(puerto, { method, url, body });
  } finally {
    await new Promise((r) => server.close(r));
  }
}

// ── El doble de prisma para /garantia ────────────────────────────────────────────────────
function dobleDeclarar({ chargeExiste = true, merchantIdDelCargo = 42 } = {}) {
  const llamadas = { update: [] };
  return {
    prisma: {
      charge: {
        findFirst: async ({ where }) => {
          if (!chargeExiste || where.merchantId !== merchantIdDelCargo) return null;
          return { id: where.id };
        },
        update: async ({ where, data, select }) => {
          llamadas.update.push({ where, data });
          const salida = {};
          for (const k of Object.keys(select || {})) salida[k] = data[k] ?? null;
          return salida;
        },
      },
    },
    llamadas,
  };
}

test('SCRUM-1107 · 🔴 POST /:id/garantia — declara la retención, y la respuesta CUADRA con el total', async () => {
  const { prisma, llamadas } = dobleDeclarar();
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia',
    body: { total: 10000, porcentaje: 5, liberacion: '2027-09-23' },
  });
  assert.equal(r.status, 200, `🔴 CIEGO: ${JSON.stringify(r.cuerpo)}`);
  assert.equal(r.cuerpo.ok, true);
  assert.equal(r.cuerpo.importeRecibido, 9500);
  assert.equal(r.cuerpo.retencion.retencionGarantiaImporte, 500);
  assert.equal(r.cuerpo.retencion.retencionGarantiaPorcentaje, 5);
  assert.equal(r.cuerpo.retencion.retencionGarantiaCobrada, null,
    '🔴 al declarar, "cobrada" tiene que nacer NULL — si no, el aviso nace ya apagado');
  // El invariante, medido en la RESPUESTA de la ruta, no solo en el módulo puro.
  assert.equal(r.cuerpo.importeRecibido + r.cuerpo.retencion.retencionGarantiaImporte, 10000);
  assert.equal(llamadas.update.length, 1, '🔴 tiene que escribir exactamente una vez');
});

test('SCRUM-1107 · 🔴 regla 2: un cobro de OTRO merchant no se puede declarar (404, no 403 ni 500)', async () => {
  const { prisma } = dobleDeclarar({ merchantIdDelCargo: 99 }); // el cobro es de OTRO merchant
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia',
    body: { total: 10000, porcentaje: 5, liberacion: '2027-09-23' },
  });
  assert.equal(r.status, 404, `🔴 un cobro ajeno no debe verse ni de refilón: salió ${r.status}`);
});

test('SCRUM-1107 · un porcentaje fuera de rango se rechaza con 400, sin escribir nada', async () => {
  const { prisma, llamadas } = dobleDeclarar();
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia',
    body: { total: 10000, porcentaje: 0, liberacion: '2027-09-23' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error, 'porcentaje_invalido');
  assert.equal(llamadas.update.length, 0, '🔴 un 400 no puede haber escrito ya en la base');
});

test('SCRUM-1107 · sin `requireRole(admin)`, la ruta rechaza a un técnico (403)', async () => {
  const { prisma } = dobleDeclarar();
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia', userRole: 'tecnico',
    body: { total: 10000, porcentaje: 5, liberacion: '2027-09-23' },
  });
  assert.equal(r.status, 403, '🔴 un técnico no debería poder declarar una retención de dinero');
});

// ── El doble de prisma para /garantia/liberar ────────────────────────────────────────────
function dobleLiberar({ retencion = { retencionGarantiaPorcentaje: 5, retencionGarantiaImporte: 500, retencionGarantiaCobrada: null } } = {}) {
  const llamadas = { create: [], update: [], transaction: 0 };
  return {
    prisma: {
      charge: {
        findFirst: async ({ where }) => (where.merchantId !== 42 ? null : {
          id: where.id, customerId: 3, currency: 'EUR', ...retencion,
        }),
        create: async ({ data, select }) => {
          llamadas.create.push(data);
          const salida = { id: 999 };
          for (const k of Object.keys(select || {})) if (k !== 'id') salida[k] = data[k];
          return salida;
        },
        update: async ({ where, data }) => {
          llamadas.update.push({ where, data });
          return { id: where.id, ...data };
        },
      },
      $transaction: async (ops) => { llamadas.transaction += 1; return Promise.all(ops); },
    },
    llamadas,
  };
}

test('SCRUM-1107 · 🔴 EL INVARIANTE ②: liberar crea un Charge NUEVO y "cobrada" pasa de NULL a fecha, JUNTOS', async () => {
  const { prisma, llamadas } = dobleLiberar();
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia/liberar',
    body: { method: 'transfer', concept: 'Liberación garantía obra Ayuntamiento X' },
  });
  assert.equal(r.status, 200, `🔴 CIEGO: ${JSON.stringify(r.cuerpo)}`);
  assert.equal(r.cuerpo.ok, true);
  assert.ok(typeof r.cuerpo.chargeLiberacionId === 'number', '🔴 tiene que devolver el id del Charge nuevo');
  assert.ok(r.cuerpo.retencionGarantiaCobrada, '🔴 "cobrada" tiene que salir con fecha, no null');

  // El Charge nuevo lleva el importe RETENIDO (nadie mandó `importe`, cae al declarado).
  assert.equal(llamadas.create.length, 1);
  assert.equal(llamadas.create[0].amount, 500);
  assert.equal(llamadas.create[0].status, 'paid');
  assert.equal(llamadas.create[0].method, 'transfer');

  // Y el ORIGINAL se marca cobrado — las dos escrituras en la MISMA transacción.
  assert.equal(llamadas.update.length, 1);
  assert.ok(llamadas.update[0].data.retencionGarantiaCobrada instanceof Date);
  assert.equal(llamadas.transaction, 1,
    '🔴 las dos escrituras tienen que ir en UNA transacción, no en dos llamadas sueltas');
});

test('SCRUM-1107 · liberar SIN retención declarada se rechaza (409), sin crear ningún Charge', async () => {
  const { prisma, llamadas } = dobleLiberar({
    retencion: { retencionGarantiaPorcentaje: null, retencionGarantiaImporte: null, retencionGarantiaCobrada: null },
  });
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia/liberar',
    body: { method: 'transfer', concept: 'x' },
  });
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo.error, 'sin_retencion_declarada');
  assert.equal(llamadas.create.length, 0);
});

test('SCRUM-1107 · 🔴 EL APAGADO NO SE REPITE: liberar una retención YA cobrada se rechaza (409)', async () => {
  const { prisma, llamadas } = dobleLiberar({
    retencion: { retencionGarantiaPorcentaje: 5, retencionGarantiaImporte: 500, retencionGarantiaCobrada: new Date('2027-01-01') },
  });
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia/liberar',
    body: { method: 'transfer', concept: 'x' },
  });
  assert.equal(r.status, 409, '🔴 sin este rechazo, se podría crear un SEGUNDO Charge para el mismo dinero');
  assert.equal(r.cuerpo.error, 'ya_cobrada');
  assert.equal(llamadas.create.length, 0);
});

test('SCRUM-1107 · liberar sin `concept` se rechaza — ningún texto se inventa aquí (regla 39)', async () => {
  const { prisma } = dobleLiberar();
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia/liberar',
    body: { method: 'transfer' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error, 'concept_requerido');
});

test('SCRUM-1107 · liberar con un `method` fuera del vocabulario cerrado (PAID_VIA) se rechaza', async () => {
  const { prisma } = dobleLiberar();
  const r = await pedir({
    prisma, url: '/admin/charges/7/garantia/liberar',
    body: { method: 'criptomoneda', concept: 'x' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error, 'method_invalido');
});

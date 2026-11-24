// tests/scrum1818-activar-plan-solo-fundador.test.mjs — SCRUM-1818
//
// 🔴 EN EL ESTRENO DEL 20-NOV, el plan Equipo del piloto se activó editando a mano la celda
// `merchants.plan` en Railway. Los valores son estrictos (minúsculas, de `entitlements.ts`), y un
// nombre mal escrito NO falla: `getEntitlements` lo trata como trial (con un aviso en el log que
// nadie mira), así que la cuenta queda en 1 usuario EN SILENCIO.
//
// La pieza: `PUT /admin/plataforma/merchants/:id/plan`, solo-fundador, que escribe SOLO la columna
// `plan` y SOLO con un valor de `PLANES_CONOCIDOS`. Este test fija:
//   · LA PUERTA: es la de `platform-funnel` (SCRUM-1317 + SCRUM-102). Hacen falta las DOS cosas:
//     rol admin Y que el merchant de la sesión sea el dueño verificado de la plataforma. Un
//     merchant normal recibe 403 SIN que se escriba nada; un operario de la cuenta dueña también.
//   · EL VALOR: clave PROPIA de la lista, comparada EXACTA. «Equipo», «equipo », «empresa», «»,
//     «__proto__», un número o nada → 400 `plan_desconocido`. Nunca trial en silencio.
//   · LO QUE ESCRIBE: `update` con `data` = `{ plan }` y nada más (ni planExpiresAt, ni Stripe).
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// El router REAL de `dist/` con `prisma` doblado (el mecanismo de scrum1317). El doble responde
// `merchant.findUnique` POR ID y LANZA con cualquier otro modelo o método: una consulta que el
// banco no representa no puede contestar «nada» y dejar el test en verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const QUIEN_LLAMA = 42;
const OBJETIVO = 77;
const EL_DUENO = { id: QUIEN_LLAMA, email: 'duena-de-la-plataforma@example.com', isPlatformOwner: true };
const UN_MERCHANT = { id: QUIEN_LLAMA, email: 'taller@example.com', isPlatformOwner: false };
// Un merchant con el correo de la lista pero SIN la marca en la base: SCRUM-102 pide los dos factores.
const CORREO_SIN_MARCA = { id: QUIEN_LLAMA, email: EL_DUENO.email, isPlatformOwner: false };

let sesion = UN_MERCHANT;
let objetivo = { id: OBJETIVO, plan: 'trial' };
/** Cada llamada a la base, con sus argumentos. */
const llamadas = [];

const merchant = {
  findUnique: async (args) => {
    llamadas.push({ metodo: 'merchant.findUnique', args });
    const id = args?.where?.id;
    if (id === QUIEN_LLAMA) return sesion;
    if (objetivo && id === objetivo.id) return objetivo;
    return null;
  },
  update: async (args) => {
    llamadas.push({ metodo: 'merchant.update', args });
    return { ...objetivo, ...args.data };
  },
};
const prisma = new Proxy({}, {
  get: (_t, nombre) => {
    if (nombre === 'merchant') {
      return new Proxy(merchant, {
        get: (m, metodo) => {
          if (metodo in m) return m[metodo];
          throw new Error(`🔴 DOBLE CIEGO: merchant.${String(metodo)} no está representado — amplía el doble`);
        },
      });
    }
    throw new Error(`🔴 DOBLE CIEGO: la ruta toca prisma.${String(nombre)}; sólo debería tocar merchant`);
  },
});
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };

const { config } = require_('./dist/core/config/env.js');
const { PLANES_CONOCIDOS } = require_('./dist/core/entitlements.js');
const router = require_('./dist/modules/system/app/routes/planAdmin.routes.js').default;

function peticion(puerto, method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port: puerto, path: url, method, agent: false,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {} },
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

/** PUT con la sesión dada. Devuelve status, cuerpo y lo que tocó la base. */
async function cambiar({ rol = 'admin', como = EL_DUENO, id = OBJETIVO, body = { plan: 'equipo' } } = {}) {
  const express = require_('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.merchantId = QUIEN_LLAMA; req.userRole = rol; next(); });
  app.use('/admin/plataforma', router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const antes = llamadas.length;
  sesion = como;
  const logs = { info: console.info, error: console.error, warn: console.warn };
  const lineas = [];
  console.info = (...a) => lineas.push(a.join(' '));
  console.error = (...a) => lineas.push(a.join(' '));
  console.warn = (...a) => lineas.push(a.join(' '));
  try {
    const r = await peticion(server.address().port, 'PUT', `/admin/plataforma/merchants/${id}/plan`, body);
    return { ...r, base: llamadas.slice(antes), lineas };
  } finally {
    Object.assign(console, logs);
    sesion = UN_MERCHANT;
    await new Promise((r) => server.close(r));
  }
}
const escrituras = (r) => r.base.filter((l) => l.metodo === 'merchant.update');

const OWNER_ANTES = config.OWNER_EMAILS;
test.before(() => { config.OWNER_EMAILS = [EL_DUENO.email]; });
test.after(() => { config.OWNER_EMAILS = OWNER_ANTES; });
test.beforeEach(() => { objetivo = { id: OBJETIVO, plan: 'trial' }; });

// ── LA PUERTA ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1818 · 🔴 un merchant NORMAL (admin de su cuenta) recibe 403 y no se escribe nada', async () => {
  const r = await cambiar({ rol: 'admin', como: UN_MERCHANT });
  assert.equal(r.status, 403, `🔴 un merchant cualquiera cambia planes: ${r.status}`);
  assert.deepEqual(escrituras(r), [], '🔴 el 403 llega DESPUÉS de escribir');
  assert.equal(objetivo.plan, 'trial');
});

test('SCRUM-1818 · 🔴 el correo de la lista SIN la marca en la base tampoco pasa (SCRUM-102: los dos factores)', async () => {
  const r = await cambiar({ rol: 'admin', como: CORREO_SIN_MARCA });
  assert.equal(r.status, 403);
  assert.deepEqual(escrituras(r), []);
});

test('SCRUM-1818 · 🔴 un OPERARIO, también el de la cuenta dueña, recibe 403 antes de tocar la base', async () => {
  for (const como of [UN_MERCHANT, EL_DUENO]) {
    const r = await cambiar({ rol: 'tecnico', como });
    assert.equal(r.status, 403, `🔴 un operario (${como.email}) cambia planes: ${r.status}`);
    assert.deepEqual(r.base, [], '🔴 la puerta de rol no va delante: el operario ya consultó la base');
  }
});

test('SCRUM-1818 · un rol desconocido no pasa (allowlist, no denylist)', async () => {
  const r = await cambiar({ rol: 'comercial', como: EL_DUENO });
  assert.equal(r.status, 403);
  assert.deepEqual(r.base, []);
});

// ── EL CAMINO BUENO (y control de los 403 de arriba) ─────────────────────────────────────────

test('SCRUM-1818 · ✅ el fundador activa «equipo»: 200, y se escribe SOLO la columna plan del comercio pedido', async () => {
  const r = await cambiar({ body: { plan: 'equipo' } });
  assert.equal(r.status, 200, `🔴 CIEGO: el fundador no puede; los 403 de arriba no prueban nada (${r.status} ${JSON.stringify(r.cuerpo)})`);
  const w = escrituras(r);
  assert.equal(w.length, 1, 'una sola escritura');
  assert.deepEqual(w[0].args.where, { id: OBJETIVO }, 'escribe en el comercio de la URL, no en el de la sesión');
  assert.deepEqual(w[0].args.data, { plan: 'equipo' }, '🔴 escribe algo más que la columna plan');
  assert.deepEqual(r.cuerpo, { id: OBJETIVO, plan: 'equipo', antes: 'trial' });
  assert.ok(r.lineas.some((l) => l.includes('trial') && l.includes('equipo') && l.includes(String(OBJETIVO))),
    `queda una línea de log con el cambio: ${JSON.stringify(r.lineas)}`);
  assert.ok(!r.lineas.some((l) => l.includes('@')), '🔴 el log lleva un correo');
});

test('SCRUM-1818 · cada plan de PLANES_CONOCIDOS se acepta tal cual (la lista es la de entitlements, no otra)', async () => {
  assert.deepEqual([...PLANES_CONOCIDOS].sort(), ['equipo', 'founding', 'pro', 'trial'],
    '🔴 CIEGO: la lista de planes ha cambiado; revisa la microcopy del selector');
  for (const plan of PLANES_CONOCIDOS) {
    const r = await cambiar({ body: { plan } });
    assert.equal(r.status, 200, `«${plan}» se rechaza`);
    assert.deepEqual(escrituras(r)[0]?.args.data, { plan });
  }
});

// ── EL TYPO: nunca trial en silencio ─────────────────────────────────────────────────────────

const MAL_ESCRITOS = [
  ['mayúscula', { plan: 'Equipo' }],
  ['espacio detrás', { plan: 'equipo ' }],
  ['espacio delante', { plan: ' pro' }],
  ['un plan que no existe', { plan: 'empresa' }],
  ['vacío', { plan: '' }],
  ['heredado del prototipo', { plan: '__proto__' }],
  ['heredado del prototipo (2)', { plan: 'constructor' }],
  ['número', { plan: 1 }],
  ['null', { plan: null }],
  ['lista', { plan: ['equipo'] }],
  ['sin campo', {}],
];

for (const [que, body] of MAL_ESCRITOS) {
  test(`SCRUM-1818 · 🔴 typo (${que}) → 400 plan_desconocido, y NO se escribe`, async () => {
    const r = await cambiar({ body });
    assert.equal(r.status, 400, `🔴 ${JSON.stringify(body)} contestó ${r.status}`);
    assert.equal(r.cuerpo?.error, 'plan_desconocido');
    assert.deepEqual(r.cuerpo?.planes, [...PLANES_CONOCIDOS], 'el error dice cuáles existen');
    assert.deepEqual(escrituras(r), [], '🔴 se escribió un plan que no existe');
    assert.equal(objetivo.plan, 'trial');
  });
}

// ── EL COMERCIO ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-1818 · comercio inexistente → 404, sin escritura', async () => {
  objetivo = null;
  const r = await cambiar();
  assert.equal(r.status, 404);
  assert.equal(r.cuerpo?.error, 'merchant_not_found');
  assert.deepEqual(escrituras(r), []);
});

for (const id of ['abc', '1.5', '0', '-3', '077x']) {
  test(`SCRUM-1818 · id no válido «${id}» → 400, sin tocar la base después de la puerta`, async () => {
    const r = await cambiar({ id });
    assert.equal(r.status, 400, `«${id}» contestó ${r.status}`);
    assert.equal(r.cuerpo?.error, 'invalid_id');
    assert.deepEqual(escrituras(r), []);
  });
}

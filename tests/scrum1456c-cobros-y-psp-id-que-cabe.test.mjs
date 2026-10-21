// tests/scrum1456c-cobros-y-psp-id-que-cabe.test.mjs — SCRUM-1456c (J2, 20-oct)
//
// 🔴 EL MISMO DEFECTO DE SCRUM-1456, EN LAS RUTAS DE DINERO: un id que no cabe en la columna `Int`
// (`2147483648`, `99999999999999999999`) pasaba `Number.isInteger`, llegaba a la base y la ruta
// contestaba 500 donde toca 400. Son las cuatro que `docs/master/SCRUM-1456.md` dejó nombradas:
// `chargesAdmin.routes.ts` (confirmar Bizum, declarar garantía, liberarla) y `psp.routes.ts`.
// La forma es `cabeEnColumnaInt` (`src/core/validation/enteroDeColumna.ts`, de S1), tal cual.
//
// ── LA CONDICIÓN ② DEL FUNDADOR (c.18731): que nada reaccione distinto a un 400 que a un 500 ──
// · `chargesAdmin`: lo miden las pantallas, en `docs/evidencias/scrum1456/condicion2-cobros.mjs.txt`.
// · `psp`: NO lo llama Stripe. Está detrás de `requireInternalSecret` y lo llaman NUESTRAS rutas con
//   `axios.post`. Lo que Stripe ve es lo que contesta `stripe.routes.ts`, y eso se mide AQUÍ abajo:
//   con `/webhooks/psp` contestando 400 o 500, la ruta de Stripe contesta lo MISMO. El control
//   positivo es un 200, que sí cambia la respuesta.
//
// ── EL BANCO ── el de scrum1456 (y scrum1379b): cualquier consulta lanza si entre sus argumentos
// viaja un número que no cabe en un int4, que es lo que hacen Postgres y Prisma. Cada lectura lleva su
// SUELO: un id que cabe LLEGA a la base y no revienta, y sin él un 400 a todo pasaría igual.
// ⚠️ Se prueba el HANDLER, no la ruta montada (A10, SCRUM-1344): el montaje de `chargesAdmin` y de
// `psp` no cambia en este ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

// ── EL FALSO /webhooks/psp, ANTES DE CARGAR NADA DE dist/ (`config` se congela al importarse) ──
const falsoPsp = { estado: 500, recibidos: [] };
const servidorPsp = http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (t) => { cuerpo += t; });
  req.on('end', () => {
    falsoPsp.recibidos.push({ url: req.url, cuerpo });
    res.writeHead(falsoPsp.estado, { 'content-type': 'application/json' });
    res.end(JSON.stringify(falsoPsp.estado === 200 ? { ok: true } : { error: falsoPsp.estado === 400 ? 'invalid_charge_id' : 'internal_error' }));
  });
});
await new Promise((ok) => servidorPsp.listen(0, '127.0.0.1', ok));
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${servidorPsp.address().port}`;
const CLAVE_JUGUETE = 'sk_test_' + 'f'.repeat(24);
const WHSEC_JUGUETE = 'whsec_' + crypto.randomBytes(12).toString('hex');
process.env.STRIPE_SECRET_KEY = CLAVE_JUGUETE;
process.env.STRIPE_WEBHOOK_SECRET = WHSEC_JUGUETE;
process.env.INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'secreto-de-juguete-1456c';

const consultas = [];
let filas = {};
function cabe(n) {
  return Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;
}
function numerosDe(v, acc = []) {
  if (typeof v === 'number') acc.push(v);
  else if (v && typeof v === 'object' && !(v instanceof Date)) for (const x of Object.values(v)) numerosDe(x, acc);
  return acc;
}
function vacio(metodo) {
  if (metodo === 'findMany') return [];
  if (metodo === 'count') return 0;
  if (metodo === 'findUnique' || metodo === 'findFirst') return null;
  if (metodo === 'updateMany' || metodo === 'deleteMany') return { count: 0 };
  return {};
}
inyectarBase(new Proxy({}, {
  get: (_t, clave) => (args) => {
    const nombre = String(clave);
    consultas.push(nombre);
    const malo = numerosDe(args).find((n) => !cabe(n));
    if (malo !== undefined) throw new Error(`Unable to fit value ${malo} into a 32-bit signed integer`);
    return nombre in filas ? filas[nombre] : vacio(nombre.split('.').pop());
  },
}));

const COBROS = '../dist/modules/billing/app/routes/chargesAdmin.routes.js';
const PSP = '../dist/modules/billing/app/routes/psp.routes.js';

/** [módulo, verbo, ruta, dónde viaja el id, qué id] — una fila por lectura. */
const LECTURAS = [
  [COBROS, 'post', '/:id/confirm-bizum', 'params', 'id'],
  [COBROS, 'post', '/:id/garantia', 'params', 'id'],
  [COBROS, 'post', '/:id/garantia/liberar', 'params', 'id'],
  [PSP, 'post', '/', 'body', 'charge_id'],
];

function pedidor([modulo, verbo, ruta, donde, cual]) {
  const m = moduloDeDist(modulo);
  const router = m.default || m.router;
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[verbo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${verbo.toUpperCase()} ${ruta} en ${modulo}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  return async (valor) => {
    consultas.length = 0;
    filas = {};
    const r = { status: 200, data: undefined };
    const res = new Proxy({}, {
      get: (_t, p) => {
        if (p === 'then') return undefined;
        if (p === 'status') return (s) => { r.status = s; return res; };
        if (p === 'json' || p === 'send') return (j) => { r.data = j; return res; };
        return () => res;
      },
    });
    const params = { id: '7' };
    // psp exige un `event` válido para llegar al id; el resto de rutas no leen el cuerpo antes del id.
    const body = modulo === PSP ? { event: 'payment.confirmed' } : {};
    ({ params, body })[donde][cual] = valor;
    const callar = console.error; console.error = () => {};
    try {
      await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, method: verbo.toUpperCase(), params, query: {}, body, teamMemberId: null }), res);
    } finally { console.error = callar; }
    return { ...r, consultas: consultas.length };
  };
}

const nombreDe = ([modulo, verbo, ruta, donde, cual]) =>
  `${verbo.toUpperCase()} ${modulo === PSP ? 'webhooks/psp' : 'charges'} ${ruta} · \`${cual}\` (${donde})`;

test('SCRUM-1456c · el censo de este fichero: 4 lecturas (3 de chargesAdmin, 1 de psp), ninguna repetida', () => {
  assert.equal(LECTURAS.length, 4);
  assert.equal(new Set(LECTURAS.map((l) => l.join(' '))).size, 4);
});

const suelo = casosEscritos(LECTURAS, (l) => `SCRUM-1456c · ${nombreDe(l)} · SUELO: un id que cabe LLEGA a la base, y \`-1\` y \`0\` también`, async (l) => {
  const pedir = pedidor(l);
  for (const v of ['1', '2147483647', '-1', '0']) {
    const r = await pedir(v);
    assert.ok(r.consultas > 0, `🔴 CIEGO: con ${v} la ruta no ha consultado la base (status ${r.status})`);
    assert.equal(r.status, 404, `\`${v}\` cabe en la columna: se busca, no existe, 404 como antes (vino ${r.status})`);
  }
});
const caso = casosEscritos(LECTURAS, (l) => `SCRUM-1456c · ${nombreDe(l)} · 🔴 un id que no cabe en la columna → 400, sin tocar la base`, async (l) => {
  const pedir = pedidor(l);
  for (const v of ['99999999999999999999', '10000000000', '2147483648', '-2147483649', '1.5', 'abc']) {
    const r = await pedir(v);
    assert.equal(r.status, 400, `🔴 con ${v} responde ${r.status}: la ruta lo ha dejado pasar hasta la base`);
    assert.equal(r.consultas, 0, `🔴 con ${v} se lanzó una consulta`);
  }
});

test('SCRUM-1456c · POST charges /:id/confirm-bizum · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` también', suelo(0));
test('SCRUM-1456c · POST charges /:id/confirm-bizum · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(0));
test('SCRUM-1456c · POST charges /:id/garantia · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` también', suelo(1));
test('SCRUM-1456c · POST charges /:id/garantia · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(1));
test('SCRUM-1456c · POST charges /:id/garantia/liberar · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` también', suelo(2));
test('SCRUM-1456c · POST charges /:id/garantia/liberar · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(2));
test('SCRUM-1456c · POST webhooks/psp / · `charge_id` (body) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` también', suelo(3));
test('SCRUM-1456c · POST webhooks/psp / · `charge_id` (body) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(3));

// ═══ LA CONDICIÓN ② EN `psp`: LO QUE VE STRIPE ═══════════════════════════════════════════════
// La ruta de Stripe real (firma HMAC local, `express.raw` y router montados como en `src/app.ts`)
// recibe un `payment_intent.payment_failed` cuyo `charge_id` de metadatos no cabe, y lo reenvía al
// falso `/webhooks/psp`. Se compara su respuesta con el psp en 400, en 500 y —control— en 200.
test('SCRUM-1456c · ✅ condición ②: con /webhooks/psp en 400 o en 500, Stripe recibe LA MISMA respuesta (y con 200, otra)', async (t) => {
  const requiere = createRequire(import.meta.url);
  const { BASE_URL } = moduloDeDist('../dist/core/config/env.js');
  assert.equal(BASE_URL, process.env.PUBLIC_BASE_URL, '🔴 CIEGO: la ruta de Stripe no reenviaría al falso psp');
  const ruta = moduloDeDist('../dist/modules/billing/app/routes/stripe.routes.js');
  const express = requiere('express');
  const Stripe = requiere('stripe');
  const firmador = new Stripe(CLAVE_JUGUETE, { apiVersion: '2024-06-20' });
  const app = express();
  app.use('/webhooks/stripe', ruta.rawBody, ruta.router);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const emitir = async () => {
    const payload = JSON.stringify({
      id: `evt_1456c_${crypto.randomBytes(6).toString('hex')}`, type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_1456c', metadata: { charge_id: '2147483648' } } },
    });
    const firma = firmador.webhooks.generateTestHeaderString({ payload, secret: WHSEC_JUGUETE });
    const callar = console.error; console.error = () => {};
    // Con `node:http` y sin agente, no con `fetch` (SCRUM-560): con `fetch` el proceso moría al salir
    // (0xC0000409 en Windows con `--test-force-exit`) con los diez casos en verde. Medido el 21-oct en
    // este fichero: 4 de 4 pasadas, y 3 de 3 con este caso solo y SIN el arreglo de `src/`.
    try {
      return await new Promise((resolve, reject) => {
        const peticion = http.request({
          host: '127.0.0.1', port: srv.address().port, path: '/webhooks/stripe', method: 'POST', agent: false,
          headers: { 'content-type': 'application/json', 'stripe-signature': firma, 'content-length': Buffer.byteLength(payload) },
        }, (r) => { r.resume(); r.on('end', () => resolve({ status: r.statusCode })); });
        peticion.on('error', reject);
        peticion.end(payload);
      });
    } finally { console.error = callar; }
  };
  try {
    const vistos = {};
    for (const estado of [400, 500, 200]) {
      falsoPsp.estado = estado;
      falsoPsp.recibidos.length = 0;
      vistos[estado] = await emitir();
      assert.equal(falsoPsp.recibidos.length, 1, `🔴 CIEGO: con psp en ${estado} la ruta de Stripe no le reenvió nada`);
      assert.equal(falsoPsp.recibidos[0].url, '/webhooks/psp');
    }
    t.diagnostic(`lo que ve Stripe, por estado del psp: ${JSON.stringify(vistos)}`);
    assert.notDeepEqual(vistos[200], vistos[500], 'CONTROL: un psp en 200 tiene que cambiar lo que ve Stripe; si no, este test no ve nada');
    assert.deepEqual(vistos[400], vistos[500],
      `🔴 Stripe recibe cosas distintas con un 400 y con un 500 del psp: ${JSON.stringify(vistos)}. Cambiar el 500 por un 400 cambiaría lo que hace Stripe.`);
  } finally {
    await new Promise((ok) => srv.close(ok));
    await new Promise((ok) => servidorPsp.close(ok));
  }
});

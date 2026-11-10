// SCRUM-1565 · EL WEBHOOK DE STRIPE ESCRIBÍA `planExpiresAt: new Date(undefined * 1000)` — medido por EFECTO,
// por el router de producción, con el evento FIRMADO y SIN BASE.
//
// Desde la API de Stripe `2025-03-31`, `current_period_end` ya no viene en la raíz de la `Subscription`:
// vive en cada item (`items.data[].current_period_end`). La versión del payload la fija el ENDPOINT, no el
// `apiVersion` del cliente, y el endpoint de yaqu.app está en `2025-10-29.clover` (panel del fundador,
// SCRUM-809c). La ruta leía la raíz con un `as any` —el tipo del SDK 19 ya no tiene el campo— y el
// compilador no podía avisar. Prisma rechaza la fecha inválida ANTES de conectar
// (`docs/master/evidencias/SCRUM-1565/prisma-rechaza.cjs`), la ruta contesta 400 y Stripe reintenta algo
// que el reintento no arregla: el `update` ENTERO se pierde, no sólo la fecha.
//
// 🔵 LA RECETA ES LA DE S1 (SCRUM-809c), AUTORIZADA por el fundador (uuid 1c5a7185-…, 18-oct 18:35:52Z):
//    raíz, o si no está, los items; nunca una fecha inválida; sin fecha utilizable se guardan plan y
//    estado SIN tocar `planExpiresAt`, se deja constancia y se contesta 200.
//
// QUÉ SE DOBLA Y QUÉ NO: como en scrum1402 — la base y los dos testigos del primer pago. El doble de
// `merchant.update` REVIENTA ante una fecha inválida con el mensaje de Prisma (medido en la evidencia de
// arriba): sin eso, el doble aceptaría lo que la base real rechaza y el rojo de hoy no se vería.
// ⚠️ LÍMITE DECLARADO: el doble no tiene estado (`_envio-doblado.mjs`): se mide lo que se ESCRIBE.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import Stripe from 'stripe';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const CLAVE_JUGUETE = 'sk_test_' + 'f'.repeat(24);
const WHSEC_JUGUETE = 'whsec_' + crypto.randomBytes(12).toString('hex');
process.env.STRIPE_SECRET_KEY = CLAVE_JUGUETE;
process.env.STRIPE_WEBHOOK_SECRET = WHSEC_JUGUETE;

const M = 4565;
const visto = { escrituras: [] };

/** Lo que hace Prisma 6 con un `Date` inválido en `data`: lo rechaza antes de conectar (evidencia). */
function comoPrisma(args) {
  for (const [campo, v] of Object.entries(args?.data ?? {})) {
    if (v instanceof Date && Number.isNaN(v.getTime())) {
      throw new Error(`Invalid value for argument \`${campo}\`: Provided Date object is invalid. Expected Date.`);
    }
  }
}

const doble = dobleDeLaBase({
  'merchant.update': (args) => { comoPrisma(args); visto.escrituras.push(args); return { email: 'duena@example.invalid' }; },
  'gatewayEvent.create': () => ({}),
  'gatewayEvent.update': () => ({}),
});

function doblar(ruta, exportado) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports: exportado };
}
doblar('dist/core/db/prisma.js', { prisma: doble });
doblar('dist/modules/auth/domain/referral.service.js', { rewardReferralOnFirstPayment: async () => {} });
doblar('dist/modules/messaging/domain/lifecycle.service.js', { sendFirstPaymentEmail: async () => null });

const ruta = requiere(rutaDe('dist/modules/billing/app/routes/stripe.routes.js'));
const express = requiere('express');

const firmador = new Stripe(CLAVE_JUGUETE, { apiVersion: '2024-06-20' });
let servidor;
let puerto;

test.before(async () => {
  const app = express();
  app.use('/webhooks/stripe', ruta.rawBody, ruta.router); // la misma línea que `src/app.ts`
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  puerto = servidor.address().port;
});
test.after(() => { servidor?.close(); });

let nEvt = 0;
const idNuevo = () => `evt_scrum1565_${Date.now()}_${nEvt++}_${crypto.randomBytes(4).toString('hex')}`;

function pedir(payload, firma) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: puerto, path: '/webhooks/stripe', method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', 'stripe-signature': firma, 'content-length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { data += t; });
      res.on('end', () => resolve({ status: res.statusCode, cuerpo: data }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function emitir(tipo, objeto) {
  visto.escrituras = [];
  const id = idNuevo();
  const payload = JSON.stringify({ id, type: tipo, data: { object: objeto } });
  const firma = firmador.webhooks.generateTestHeaderString({ payload, secret: WHSEC_JUGUETE });
  const avisos = [];
  const original = { warn: console.warn, error: console.error, log: console.log };
  console.warn = (...a) => { avisos.push(a.map(String).join(' ')); };
  console.error = () => {};
  console.log = () => {};
  try {
    const res = await pedir(payload, firma);
    return { id, res, avisos, escrituras: visto.escrituras };
  } finally {
    Object.assign(console, original);
  }
}

const FIN = 1_900_000_000;
const OTRO_FIN = 1_900_086_400;
const item = (fin) => ({ id: 'si_scrum1565', object: 'subscription_item', ...(fin === undefined ? {} : { current_period_end: fin }) });

/** Una suscripción activa. `raiz`: la API vieja; `items`: la lista de `current_period_end` de sus items. */
const suscripcion = ({ raiz, items = [] } = {}, status = 'active') => ({
  id: 'sub_scrum1565', object: 'subscription', status,
  ...(raiz === undefined ? {} : { current_period_end: raiz }),
  items: { object: 'list', data: items.map(item) },
  metadata: { merchant_id: String(M), plan: 'pro' },
});

const BASE = { plan: 'pro', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_scrum1565' };
const EVENTOS = ['customer.subscription.updated', 'customer.subscription.created'];
const ESTADOS = ['active', 'trialing'];

// ═══ ✅ EL POSITIVO: LA API VIEJA (raíz) SIGUE ESCRIBIENDO LA MISMA FECHA ══════════════════════

test('SCRUM-1565 · ✅ payload con `current_period_end` en la RAÍZ (API vieja): se escribe esa fecha, igual que antes', async () => {
  let n = 0;
  for (const tipo of EVENTOS) {
    for (const status of ESTADOS) {
      const r = await emitir(tipo, suscripcion({ raiz: FIN }, status));
      assert.equal(r.res.status, 200, `${tipo} (${status}): ${r.res.cuerpo}`);
      assert.deepEqual(r.escrituras.map((e) => e.data), [{ ...BASE, planExpiresAt: new Date(FIN * 1000) }], `${tipo} (${status})`);
      assert.deepEqual(r.avisos, [], `${tipo} (${status}): con fecha no hay nada que avisar`);
      n += 1;
    }
  }
  assert.equal(n, 4, 'población: 2 eventos × 2 estados');
});

// ═══ 🔴 EL DEFECTO: EL PAYLOAD `clover` (fecha en los ITEMS) ═══════════════════════════════════

test('SCRUM-1565 · 🔴 payload `clover` (sin raíz, fecha en su ÚNICO item): contesta 200 y escribe la fecha del item', async () => {
  let n = 0;
  for (const tipo of EVENTOS) {
    for (const status of ESTADOS) {
      const r = await emitir(tipo, suscripcion({ items: [FIN] }, status));
      assert.equal(r.res.status, 200,
        `🔴 ${tipo} (${status}) con el payload de la API \`2025-10-29.clover\` NO SE HA APLICADO: ${r.res.cuerpo}\n`
        + 'Es el 400 que guarda el panel de Stripe (SCRUM-809c): el plan, el estado y la suscripción se pierden con la fecha.');
      assert.deepEqual(r.escrituras.map((e) => e.data), [{ ...BASE, planExpiresAt: new Date(FIN * 1000) }], `${tipo} (${status})`);
      n += 1;
    }
  }
  assert.equal(n, 4, 'población: 2 eventos × 2 estados');
});

test('SCRUM-1565 · 🔴 si vienen raíz e items, manda la raíz (es la que dio siempre la fecha)', async () => {
  const r = await emitir('customer.subscription.updated', suscripcion({ raiz: FIN, items: [OTRO_FIN] }));
  assert.equal(r.res.status, 200, r.res.cuerpo);
  assert.deepEqual(r.escrituras.map((e) => e.data), [{ ...BASE, planExpiresAt: new Date(FIN * 1000) }]);
});

// ═══ 🔴 SIN FECHA UTILIZABLE: SE GUARDA LO DEMÁS, SIN TOCAR `planExpiresAt`, Y SE DICE ════════════

// Lo que NO es una fecha de fin de periodo. Escrito, no derivado.
const SIN_FECHA = [
  ['sin raíz y sin items', {}],
  ['raíz null', { raiz: null }],
  ['raíz como texto', { raiz: '1900000000' }],
  ['raíz 0', { raiz: 0 }],
  ['raíz negativa', { raiz: -1 }],
  ['item sin el campo', { items: [undefined] }],
  ['item con texto', { items: ['abc'] }],
  ['dos items que no coinciden', { items: [FIN, OTRO_FIN] }],
];

test('SCRUM-1565 · 🔴 sin fecha utilizable: 200, se escriben plan, estado y suscripción SIN `planExpiresAt`, y UN aviso con el merchant y el evento', async () => {
  assert.equal(SIN_FECHA.length, 8, 'población: ocho payloads sin fecha');
  const fallos = [];
  for (const [nombre, forma] of SIN_FECHA) {
    const r = await emitir('customer.subscription.updated', suscripcion(forma));
    if (r.res.status !== 200) { fallos.push(`${nombre}: ${r.res.status} ${r.res.cuerpo.slice(0, 160)}`); continue; }
    const datos = r.escrituras.map((e) => e.data);
    // `undefined` es «Prisma no toca la columna» (medido en la evidencia); `null` la BORRARÍA (SCRUM-809).
    if (datos.length === 1 && datos[0].planExpiresAt !== undefined) fallos.push(`${nombre}: planExpiresAt = ${String(datos[0].planExpiresAt)}`);
    const avisoBueno = r.avisos.length === 1 && r.avisos[0].includes(`merchant ${M}`) && r.avisos[0].includes(r.id);
    if (JSON.stringify(datos) !== JSON.stringify([BASE]) || !avisoBueno) {
      fallos.push(`${nombre}: escribió ${JSON.stringify(datos)} · avisos ${JSON.stringify(r.avisos)}`);
    }
  }
  assert.deepEqual(fallos, [], `\n🔴 ${fallos.length} de ${SIN_FECHA.length}:\n${fallos.map((f) => `   · ${f}`).join('\n')}\n`);
});

test('SCRUM-1565 · ✅ CONTROL del doble: una fecha inválida en `data` revienta como en Prisma (si no, los rojos de arriba no medirían nada)', () => {
  assert.throws(() => comoPrisma({ data: { planExpiresAt: new Date(undefined * 1000) } }), /Provided Date object is invalid/);
  assert.doesNotThrow(() => comoPrisma({ data: { planExpiresAt: new Date(FIN * 1000) } }));
});

// ═══ 🔴 LA CONSECUENCIA EN EL PAYWALL, POR EL MIDDLEWARE REAL ══════════════════════════════════
// El doble no tiene estado, así que la cadena se encadena a mano: lo que escribe el pago `clover`,
// lo que deja la cancelación (SCRUM-809: NO toca `planExpiresAt`) y lo que hace `requireActivePlan`
// con el resultado. El caso «hoy» es la fecha que se quedaba al reventar el `update`: la del trial.
test('SCRUM-1565 · 🔴 paywall: quien paga con `clover` y cancela conserva el acceso hasta el fin del periodo; con la fecha que se quedaba hoy, 403 al instante', async () => {
  const pago = await emitir('customer.subscription.updated', suscripcion({ items: [FIN] }));
  assert.equal(pago.res.status, 200, pago.res.cuerpo);
  const fecha = pago.escrituras[0]?.data.planExpiresAt;
  assert.ok(fecha instanceof Date && fecha.getTime() === FIN * 1000, `el pago escribe el fin de periodo: ${String(fecha)}`);

  const baja = await emitir('customer.subscription.deleted', suscripcion({ items: [FIN] }, 'canceled'));
  assert.equal(baja.res.status, 200, baja.res.cuerpo);
  assert.ok(!('planExpiresAt' in baja.escrituras[0].data), 'la cancelación no toca la fecha (SCRUM-809)');
  assert.equal(baja.escrituras[0].data.plan, 'trial');

  const paywall = async (planExpiresAt) => {
    const { inyectarBase, moduloDeDist } = await import('./_envio-doblado.mjs');
    inyectarBase({
      'authSession.findUnique': () => ({
        type: 'session', expiresAt: new Date(Date.now() + 86_400_000), teamMember: null,
        merchant: { id: M, name: 'Sonda 1565', email: 'sonda-1565@test.local', plan: 'trial', planExpiresAt, onboardingCompleted: true, isPlatformOwner: false },
      }),
    }, ['../dist/core/http/authMiddleware.js', '../dist/modules/auth/domain/auth.service.js']);
    const { requireActivePlan } = moduloDeDist('../dist/core/http/authMiddleware.js');
    const r = { status: null, siguio: false };
    const res = { status(s) { r.status = s; return res; }, json() { return res; } };
    await requireActivePlan({ headers: { cookie: 'pf_session=sonda1565' } }, res, () => { r.siguio = true; });
    return r;
  };

  const conArreglo = await paywall(fecha);
  assert.equal(conArreglo.siguio, true, `🔴 quien canceló con el periodo pagado por delante NO entra (status ${conArreglo.status})`);
  const comoHoy = await paywall(new Date(Date.now() - 86_400_000)); // la fecha del trial, ya vencida
  assert.equal(comoHoy.status, 403, 'CONTROL: con la fecha que se quedaba al reventar, el paywall corta al instante');
});

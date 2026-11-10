// SCRUM-1402e · UN IMPAGO CON UN PLAN QUE NO EXISTE SE MARCA, Y EL PLAN NO SE TOCA — medido por EFECTO,
// por el router de producción, con el evento FIRMADO y SIN BASE (el mismo banco que SCRUM-1402).
//
// Con la opción A de SCRUM-1402 (#2222), un `customer.subscription.updated|created` en `past_due` o
// `unpaid` cuyo `metadata.plan` no existe NO escribía nada en la fila: YaQu no se enteraba del impago,
// no salía el aviso de pago pendiente y el merchant conservaba su plan. Era la consecuencia Ⓔ.3 del
// registro, y se le subió al fundador.
//
// 🔵 LA DECISIÓN ES DEL FUNDADOR Y SE PUEDE CITAR: SCRUM-1402, comentario 20651 (23-oct-2026), respuesta
//    literal «Marcar el impago»: el impago se marca y sale el aviso de pago pendiente que ya existe,
//    aunque el plan no se toque; el plan desconocido se sigue ignorando como hace la opción A.
//    Lo que NO cubre: ningún texto nuevo, ninguna transición de la Parte L que no exista.
//
// Por eso lo que se escribe es EXACTAMENTE `subscriptionStatus: 'past_due'`, el mismo estado que escribe
// el impago con un plan conocido (A10.2, Parte L). El aviso es el banner que ya pinta el panel cuando
// `/me` trae ese estado (`public/dashboard/js/app.js`, «A10.2 (Parte L): past_due → banner»): este
// fichero no pinta nada; mide que el campo que ese banner lee se escribe.
//
// ⚠️ LÍMITE DECLARADO: el doble de la base no tiene estado (lo dice `_envio-doblado.mjs`). «El plan no se
// toca» se mide como «la escritura no lleva la clave `plan`», no leyendo la fila después.
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

// Claves de JUGUETE, fijadas con `=` ANTES de cargar `dist/` (`config` se congela al importarse).
const CLAVE_JUGUETE = 'sk_test_' + 'e'.repeat(24);
const WHSEC_JUGUETE = 'whsec_' + crypto.randomBytes(12).toString('hex');
process.env.STRIPE_SECRET_KEY = CLAVE_JUGUETE;
process.env.STRIPE_WEBHOOK_SECRET = WHSEC_JUGUETE;

const M = 14025;
const OTRO = 14026;

// ── LA BASE DOBLADA ──────────────────────────────────────────────────────────────────────
const visto = { escrituras: [], masivas: [], registro: [] };
const limpiar = () => Object.assign(visto, { escrituras: [], masivas: [], registro: [] });

const doble = dobleDeLaBase({
  'merchant.update': (args) => { visto.escrituras.push(args); return { email: 'duena@example.invalid' }; },
  'merchant.updateMany': (args) => { visto.masivas.push(args); return { count: 0 }; },
  'gatewayEvent.create': (args) => { visto.registro.push(['create', args]); return {}; },
  'gatewayEvent.update': (args) => { visto.registro.push(['update', args]); return {}; },
});

function doblar(ruta, exportado) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports: exportado };
}
doblar('dist/core/db/prisma.js', { prisma: doble });
doblar('dist/modules/auth/domain/referral.service.js', { rewardReferralOnFirstPayment: async () => {} });
doblar('dist/modules/messaging/domain/lifecycle.service.js', { sendFirstPaymentEmail: async () => null });

const { PLANES_CONOCIDOS } = requiere(rutaDe('dist/core/entitlements.js'));
const ruta = requiere(rutaDe('dist/modules/billing/app/routes/stripe.routes.js'));
const express = requiere('express');

// ── EL WEBHOOK, POR HTTP Y CON FIRMA ─────────────────────────────────────────────────────
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
const idNuevo = () => `evt_scrum1402e_${Date.now()}_${nEvt++}_${crypto.randomBytes(4).toString('hex')}`;

/** `agent: false`, como manda SCRUM-560: sin pool, cada petición abre y cierra su conexión. */
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
  limpiar();
  const id = idNuevo();
  const payload = JSON.stringify({ id, type: tipo, data: { object: objeto } });
  const firma = firmador.webhooks.generateTestHeaderString({ payload, secret: WHSEC_JUGUETE });
  const avisos = [];
  const errores = [];
  const original = { warn: console.warn, error: console.error, log: console.log };
  console.warn = (...a) => { avisos.push(a.map(String).join(' ')); };
  console.error = (...a) => { errores.push(a.map(String).join(' ')); };
  console.log = () => {};
  try {
    const res = await pedir(payload, firma);
    return { id, res, avisos, errores, ...structuredClone({ escrituras: visto.escrituras, masivas: visto.masivas, registro: visto.registro }) };
  } finally {
    Object.assign(console, original);
  }
}

const suscripcion = (plan, status, merchant = M) => ({
  id: 'sub_scrum1402e', status, current_period_end: 1_900_000_000,
  metadata: { merchant_id: String(merchant), plan },
});

const TIPOS = ['customer.subscription.updated', 'customer.subscription.created'];
const IMPAGOS = ['past_due', 'unpaid'];
// Lo que NO existe, ESCRITO y no derivado (si se derivara de la lista del código, vaciarla dejaría esto
// verde). Los mismos nueve de SCRUM-1402: los de mano en el panel de Stripe y los heredados de Object.
const INVENTADOS = ['empresa', 'basic', 'Equipo', 'equipo ', 'PRO', ' pro', 'constructor', 'toString', '__proto__'];
const LEGITIMOS = ['trial', 'pro', 'founding', 'equipo'];

test('SCRUM-1402e · ✅ SUELO: ninguno de los inventados es un plan, y los legítimos son los de entitlements', () => {
  assert.equal(INVENTADOS.length, 9, 'población: nueve valores');
  assert.deepEqual(INVENTADOS.filter((p) => PLANES_CONOCIDOS.includes(p)), [], 'ninguno de los inventados está en la lista');
  assert.deepEqual([...PLANES_CONOCIDOS].sort(), [...LEGITIMOS].sort(),
    '🔴 la lista de `entitlements.ts` ha cambiado: se mira qué plan nace o muere y quién lo decidió (W3, regla 34).');
});

// ═══ 🔴 EL DEFECTO: EL IMPAGO CON PLAN DESCONOCIDO NO SE MARCABA ═══════════════════════════

test('SCRUM-1402e · 🔴 un impago (past_due, unpaid) con un plan que NO existe SE MARCA: escribe `past_due` y nada más, sin tocar el plan, y avisa del plan', async () => {
  let n = 0;
  const mal = [];
  for (const tipo of TIPOS) {
    for (const status of IMPAGOS) {
      for (const plan of INVENTADOS) {
        const r = await emitir(tipo, suscripcion(plan, status));
        n += 1;
        const escrito = JSON.stringify(r.escrituras);
        const esperado = JSON.stringify([{ where: { id: M }, data: { subscriptionStatus: 'past_due' } }]);
        if (escrito !== esperado) { mal.push(`${tipo} (${status}) ${JSON.stringify(plan)} → ${escrito}`); continue; }
        assert.equal(r.avisos.length, 1, `${tipo} (${status}) ${JSON.stringify(plan)}: el plan ignorado sigue avisando, una vez: ${JSON.stringify(r.avisos)}`);
        assert.ok(r.avisos[0].includes(JSON.stringify(plan)) && r.avisos[0].includes(`merchant ${M}`), r.avisos[0]);
        assert.deepEqual(r.errores, []);
      }
    }
  }
  assert.equal(n, 36, 'población: 2 eventos × 2 impagos × 9 valores');
  assert.deepEqual(mal, [],
    `\n🔴 EL IMPAGO DE UNA SUSCRIPCIÓN CON UN PLAN QUE NO EXISTE NO SE HA MARCADO COMO \`past_due\` (o ha tocado algo más). ${mal.length} de ${n}:\n`
    + mal.map((e) => `   · ${e}`).join('\n')
    + '\nDecisión del fundador (SCRUM-1402, comentario 20651, «Marcar el impago»): se marca, y el plan no se toca.\n');
});

// ═══ ✅ LOS CONTROLES ═════════════════════════════════════════════════════════════════════

test('SCRUM-1402e · ✅ control · un impago con un plan legítimo, igual que hoy: plan, `past_due` y la suscripción, sin un aviso', async () => {
  let n = 0;
  for (const tipo of TIPOS) {
    for (const status of IMPAGOS) {
      for (const plan of LEGITIMOS) {
        const r = await emitir(tipo, suscripcion(plan, status));
        n += 1;
        assert.deepEqual(r.escrituras, [{
          where: { id: M },
          data: { plan, subscriptionStatus: 'past_due', stripeSubscriptionId: 'sub_scrum1402e' },
        }], `🔴 ${tipo} (${status}) con «${plan}» ha cambiado`);
        assert.deepEqual(r.avisos, [], `${tipo} (${status}) con «${plan}»: no avisa`);
      }
    }
  }
  assert.equal(n, 16, 'población: 2 eventos × 2 impagos × 4 planes');
});

test('SCRUM-1402e · ✅ control · un plan que NO existe SIN impago (active, trialing) sigue sin escribir nada: el plan no cambia', async () => {
  let n = 0;
  for (const tipo of TIPOS) {
    for (const status of ['active', 'trialing']) {
      for (const plan of INVENTADOS) {
        const r = await emitir(tipo, suscripcion(plan, status));
        n += 1;
        assert.deepEqual(r.escrituras, [], `🔴 ${tipo} (${status}) con ${JSON.stringify(plan)} ha escrito: ${JSON.stringify(r.escrituras)}`);
        assert.equal(r.avisos.length, 1, 'y avisa, como la opción A');
      }
    }
  }
  assert.equal(n, 36);
  // El mismo emisor, sobre el caso que SÍ escribe: el «nada» de arriba no es un doble mudo.
  const control = await emitir('customer.subscription.updated', suscripcion('pro', 'active'));
  assert.equal(control.escrituras.length, 1, 'control positivo: con `pro` activo hay una escritura');
});

test('SCRUM-1402e · ✅ control · regla 2: el impago marca SOLO al merchant del evento; el otro no recibe nada', async () => {
  const a = await emitir('customer.subscription.updated', suscripcion('empresa', 'past_due', OTRO));
  assert.deepEqual(a.escrituras.map((e) => e.where), [{ id: OTRO }], `sólo el merchant ${OTRO}: ${JSON.stringify(a.escrituras)}`);
  assert.ok(!JSON.stringify(a.escrituras).includes(String(M)), `🔴 el merchant ${M} ha aparecido en una escritura que no era suya`);
  assert.deepEqual(a.masivas, [], '🔴 una escritura MASIVA en merchants: el impago de uno no toca a nadie más');
  const b = await emitir('customer.subscription.updated', suscripcion('empresa', 'past_due', M));
  assert.deepEqual(b.escrituras.map((e) => e.where), [{ id: M }], 'y al revés');
  assert.deepEqual(b.masivas, []);
});

test('SCRUM-1402e · ✅ control · la respuesta a Stripe no cambia: 200 y el mismo cuerpo que con un plan legítimo, y el evento queda PROCESADO', async () => {
  const conocido = await emitir('customer.subscription.updated', suscripcion('pro', 'past_due'));
  for (const status of IMPAGOS) {
    const r = await emitir('customer.subscription.updated', suscripcion('empresa', status));
    assert.equal(r.res.status, 200, r.res.cuerpo);
    assert.equal(r.res.cuerpo, conocido.res.cuerpo, 'el cuerpo es el mismo que con un plan legítimo');
    assert.deepEqual(r.registro.map(([op]) => op), ['create', 'update'], 'se abre el registro y se cierra');
    const cierre = r.registro[1][1].data;
    assert.ok(cierre.processedAt, `🔴 el evento no ha quedado procesado: ${JSON.stringify(cierre)}`);
    assert.equal('lastError' in cierre, false, 'y no se anota como error: Stripe no reintenta');
  }
  assert.equal(conocido.res.status, 200);
  assert.equal(conocido.res.cuerpo, JSON.stringify({ received: true }));
});

// ── LO QUE TIENE QUE TUMBAR ESTE FICHERO (lo ejecuta `npm run meta:mutaciones`) ──────────
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El comportamiento de antes (#2222): con el plan desconocido, el impago no escribe nada.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: '          await prisma.merchant.update({\n            where: { id: merchantId },\n            data: planConocido',
    a: '          if (planConocido) await prisma.merchant.update({\n            where: { id: merchantId },\n            data: planConocido',
    cae: 'con un plan que NO existe SE MARCA',
  },
  {
    // Se marca, pero se lleva la suscripción por delante: escribe algo más que el estado.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: "              : { subscriptionStatus: 'past_due' },",
    a: "              : { subscriptionStatus: 'past_due', stripeSubscriptionId: sub.id },",
    cae: 'con un plan que NO existe SE MARCA',
  },
  {
    // El plan legítimo deja de escribirse en el impago: el arreglo rompe lo que funcionaba.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: "              ? { plan: planId, subscriptionStatus: 'past_due', stripeSubscriptionId: sub.id }",
    a: "              ? { subscriptionStatus: 'past_due' }",
    cae: 'un impago con un plan legítimo, igual que hoy',
  },
];

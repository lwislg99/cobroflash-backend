// SCRUM-1402h · UNA SUSCRIPCIÓN SIN `metadata.plan` SE TRATA COMO UN PLAN QUE NO EXISTE — medido por EFECTO,
// por el router de producción, con el evento FIRMADO y SIN BASE (el mismo banco que SCRUM-1402 y 1402e).
//
// Lo midió 1402g (SCRUM-1402, comentario 20677): con `merchant_id` y SIN plan (sin la clave, o vacía),
// `customer.subscription.created|updated` no escribía NADA en ningún estado, porque toda la máquina de
// estados colgaba de `if (merchantId && planId)`. Se perdían callados el impago y la cancelación: un
// merchant cancelado en Stripe conservaba en YaQu el plan de pago y `active`.
//
// 🔵 LA DECISIÓN ES DEL FUNDADOR Y SE PUEDE CITAR: SCRUM-1402, comentario 20681 (23-oct-2026), respuesta
//    literal «B · Como plan desconocido»: el plan no se toca; el impago (`past_due`, el aviso que ya
//    existe) y la cancelación se aplican; la activación y la renovación quedan como hoy, con su línea en
//    el log. Ningún texto nuevo, ninguna transición nueva de la Parte L, la respuesta a Stripe no cambia.
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
const CLAVE_JUGUETE = 'sk_test_' + 'h'.repeat(24);
const WHSEC_JUGUETE = 'whsec_' + crypto.randomBytes(12).toString('hex');
process.env.STRIPE_SECRET_KEY = CLAVE_JUGUETE;
process.env.STRIPE_WEBHOOK_SECRET = WHSEC_JUGUETE;

const M = 14028;
const OTRO = 14029;

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
const idNuevo = () => `evt_scrum1402h_${Date.now()}_${nEvt++}_${crypto.randomBytes(4).toString('hex')}`;

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

// Las dos formas de «sin plan» que midió 1402g: sin la clave y con ella vacía.
const SIN_PLAN = [['sin la clave', {}], ['plan vacío', { plan: '' }]];
const suscripcion = (extra, status, merchant = M) => ({
  id: 'sub_scrum1402h', status, current_period_end: 1_900_000_000,
  metadata: { merchant_id: String(merchant), ...extra },
});

const TIPOS = ['customer.subscription.updated', 'customer.subscription.created'];
const IMPAGOS = ['past_due', 'unpaid'];
const CANCELACIONES = ['canceled', 'incomplete_expired'];
const CANCELADO = { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null };

// ═══ 🔴 EL DEFECTO: SIN PLAN NO SE MARCABA NI EL IMPAGO NI LA CANCELACIÓN ════════════════

test('SCRUM-1402h · 🔴 un impago SIN plan SE MARCA: escribe `past_due` y nada más, sin tocar el plan, y avisa', async () => {
  let n = 0;
  const mal = [];
  for (const tipo of TIPOS) {
    for (const status of IMPAGOS) {
      for (const [nom, extra] of SIN_PLAN) {
        const r = await emitir(tipo, suscripcion(extra, status));
        n += 1;
        const escrito = JSON.stringify(r.escrituras);
        const esperado = JSON.stringify([{ where: { id: M }, data: { subscriptionStatus: 'past_due' } }]);
        if (escrito !== esperado) { mal.push(`${tipo} (${status}) ${nom} → ${escrito}`); continue; }
        assert.equal(r.avisos.length, 1, `${tipo} (${status}) ${nom}: avisa una vez, como un plan desconocido: ${JSON.stringify(r.avisos)}`);
        assert.ok(r.avisos[0].includes(`merchant ${M}`), r.avisos[0]);
        assert.deepEqual(r.errores, []);
      }
    }
  }
  assert.equal(n, 8, 'población: 2 eventos × 2 impagos × 2 formas de «sin plan»');
  assert.deepEqual(mal, [],
    `\n🔴 EL IMPAGO DE UNA SUSCRIPCIÓN SIN PLAN NO SE HA MARCADO COMO \`past_due\` (o ha tocado algo más). ${mal.length} de ${n}:\n`
    + mal.map((e) => `   · ${e}`).join('\n')
    + '\nDecisión del fundador (SCRUM-1402, comentario 20681, «B · Como plan desconocido»).\n');
});

test('SCRUM-1402h · 🔴 una cancelación SIN plan SE APLICA: la misma escritura que con plan (`trial`, `canceled`, sin suscripción)', async () => {
  let n = 0;
  const mal = [];
  for (const tipo of TIPOS) {
    for (const status of CANCELACIONES) {
      for (const [nom, extra] of SIN_PLAN) {
        const r = await emitir(tipo, suscripcion(extra, status));
        n += 1;
        const escrito = JSON.stringify(r.escrituras);
        if (escrito !== JSON.stringify([{ where: { id: M }, data: CANCELADO }])) { mal.push(`${tipo} (${status}) ${nom} → ${escrito}`); continue; }
        assert.deepEqual(r.errores, []);
      }
    }
  }
  assert.equal(n, 8, 'población: 2 eventos × 2 cancelaciones × 2 formas de «sin plan»');
  assert.deepEqual(mal, [],
    `\n🔴 LA CANCELACIÓN DE UNA SUSCRIPCIÓN SIN PLAN NO SE HA APLICADO: YaQu seguiría dando lo que ya no se paga. ${mal.length} de ${n}:\n`
    + mal.map((e) => `   · ${e}`).join('\n')
    + '\nDecisión del fundador (SCRUM-1402, comentario 20681, «B · Como plan desconocido»).\n');
});

// ═══ ✅ LOS CONTROLES ═════════════════════════════════════════════════════════════════════

test('SCRUM-1402h · ✅ control · activar y renovar SIN plan siguen sin escribir nada, y lo dicen en el log', async () => {
  let n = 0;
  for (const tipo of TIPOS) {
    for (const status of ['active', 'trialing']) {
      for (const [nom, extra] of SIN_PLAN) {
        const r = await emitir(tipo, suscripcion(extra, status));
        n += 1;
        assert.deepEqual(r.escrituras, [], `🔴 ${tipo} (${status}) ${nom} ha escrito: ${JSON.stringify(r.escrituras)}`);
        assert.equal(r.avisos.length, 1, `${tipo} (${status}) ${nom}: su línea en el log`);
      }
    }
  }
  assert.equal(n, 8);
  // El mismo emisor, sobre el caso que SÍ escribe: el «nada» de arriba no es un doble mudo.
  const control = await emitir('customer.subscription.updated', suscripcion({ plan: 'pro' }, 'active'));
  assert.equal(control.escrituras.length, 1, 'control positivo: con `pro` activo hay una escritura');
});

test('SCRUM-1402h · ✅ control · con un plan legítimo, igual que hoy en activar, impago y cancelación, sin un aviso', async () => {
  const esperado = {
    active: (plan) => ({ plan, subscriptionStatus: 'active', stripeSubscriptionId: 'sub_scrum1402h', planExpiresAt: new Date(1_900_000_000 * 1000) }),
    past_due: (plan) => ({ plan, subscriptionStatus: 'past_due', stripeSubscriptionId: 'sub_scrum1402h' }),
    canceled: () => CANCELADO,
  };
  let n = 0;
  for (const tipo of TIPOS) {
    for (const status of Object.keys(esperado)) {
      for (const plan of ['pro', 'equipo']) {
        const r = await emitir(tipo, suscripcion({ plan }, status));
        n += 1;
        assert.deepEqual(r.escrituras, [{ where: { id: M }, data: esperado[status](plan) }], `🔴 ${tipo} (${status}) con «${plan}» ha cambiado`);
        assert.deepEqual(r.avisos, [], `${tipo} (${status}) con «${plan}»: no avisa`);
      }
    }
  }
  assert.equal(n, 12, 'población: 2 eventos × 3 estados × 2 planes');
});

test('SCRUM-1402h · ✅ control · sin `merchant_id` y sin plan no se escribe nada en ningún estado', async () => {
  let n = 0;
  for (const status of [...IMPAGOS, ...CANCELACIONES]) {
    const r = await emitir('customer.subscription.updated', { id: 'sub_scrum1402h', status, metadata: {} });
    n += 1;
    assert.deepEqual(r.escrituras, [], `🔴 ${status} sin merchant ha escrito: ${JSON.stringify(r.escrituras)}`);
    assert.equal(r.res.status, 200);
  }
  assert.equal(n, 4);
});

test('SCRUM-1402h · ✅ control · regla 2: la cancelación y el impago sin plan tocan SOLO al merchant del evento', async () => {
  for (const status of ['canceled', 'past_due']) {
    const a = await emitir('customer.subscription.updated', suscripcion({}, status, OTRO));
    assert.deepEqual(a.escrituras.map((e) => e.where), [{ id: OTRO }], `sólo el merchant ${OTRO}: ${JSON.stringify(a.escrituras)}`);
    assert.ok(!JSON.stringify(a.escrituras).includes(String(M)), `🔴 el merchant ${M} ha aparecido en una escritura que no era suya`);
    assert.deepEqual(a.masivas, [], '🔴 una escritura MASIVA en merchants');
  }
});

test('SCRUM-1402h · ✅ control · la respuesta a Stripe no cambia: 200, el mismo cuerpo que con plan, y el evento queda PROCESADO', async () => {
  const conocido = await emitir('customer.subscription.updated', suscripcion({ plan: 'pro' }, 'canceled'));
  assert.equal(conocido.res.status, 200);
  assert.equal(conocido.res.cuerpo, JSON.stringify({ received: true }));
  for (const status of [...IMPAGOS, ...CANCELACIONES, 'active']) {
    const r = await emitir('customer.subscription.updated', suscripcion({}, status));
    assert.equal(r.res.status, 200, r.res.cuerpo);
    assert.equal(r.res.cuerpo, conocido.res.cuerpo, 'el cuerpo es el mismo que con un plan legítimo');
    assert.deepEqual(r.registro.map(([op]) => op), ['create', 'update'], 'se abre el registro y se cierra');
    const cierre = r.registro[1][1].data;
    assert.ok(cierre.processedAt, `🔴 el evento no ha quedado procesado: ${JSON.stringify(cierre)}`);
    assert.equal('lastError' in cierre, false, 'y no se anota como error: Stripe no reintenta');
  }
});

// ── LO QUE TIENE QUE TUMBAR ESTE FICHERO (lo ejecuta `npm run meta:mutaciones`) ──────────
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El comportamiento de antes: la puerta vuelve a pedir plan, y sin él no se marca nada.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: '      if (Number.isInteger(merchantId)) {\n        // A10.2',
    a: '      if (Number.isInteger(merchantId) && planId) {\n        // A10.2',
    cae: 'una cancelación SIN plan SE APLICA',
  },
  {
    // Sólo la cancelación (la opción C): el impago sin plan vuelve a perderse.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: "        } else if (st === 'past_due' || st === 'unpaid') {",
    a: "        } else if (planId && (st === 'past_due' || st === 'unpaid')) {",
    cae: 'un impago SIN plan SE MARCA',
  },
  {
    // «Sin plan» pasa por un plan que existe: activar escribiría `plan: ''` en la fila.
    fichero: 'src/modules/billing/app/routes/stripe.routes.ts',
    de: '  if (PLANES_CONOCIDOS.includes(planId)) return true;',
    a: '  if (!planId || PLANES_CONOCIDOS.includes(planId)) return true;',
    cae: 'activar y renovar SIN plan siguen sin escribir nada',
  },
];

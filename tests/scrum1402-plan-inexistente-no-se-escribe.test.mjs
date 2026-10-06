// SCRUM-1402 · EL WEBHOOK DE STRIPE ESCRIBÍA EN `Merchant.plan` LO QUE VINIERA EN `metadata.plan` — medido por
// EFECTO, por el router de producción, con el evento FIRMADO y SIN BASE.
//
// `src/modules/billing/app/routes/stripe.routes.ts` es el único camino del producto que escribe el plan
// con un valor que no es un literal. Lo copiaba de `metadata.plan` con una sola comprobación: que no
// viniera vacío. `empresa`, `Equipo`, `equipo ` o `constructor` llegaban a la fila tal cual.
//
// 🔵 LA DECISIÓN ES DEL FUNDADOR Y SE PUEDE CITAR: SCRUM-1402, comentario 18019 (2-oct-2026), opción A,
//    respuesta literal «1-Ok A»: SE RECHAZA el cambio de plan y el merchant se queda con el que tenía.
//    Con una consecuencia obligatoria, también suya: el rechazo es RUIDOSO — el valor recibido entre
//    comillas, el merchant y la lista de planes que existen, con la forma del aviso de SCRUM-1342.
//
// 🔴 EL POSITIVO QUE MANDA, y por eso va PRIMERO en el fichero: un plan LEGÍTIMO se activa exactamente
//    igual que antes. Si un cliente que paga se queda sin plan, el arreglo es peor que el defecto.
//
// ⛔ LO QUE ESTE FICHERO NO DICE, y no hay que leérselo: que rechazar devuelva el dinero. No lo hace.
//    Un pago con un plan que no existe es alguien que ha pagado algo que no se le ha dado; lo resuelve
//    el fundador a mano, caso por caso. El código no lo adivina ni lo compensa: solo deja de callarlo.
//
// QUÉ SE DOBLA Y QUÉ NO. Se doblan la base y los dos efectos de fuera del primer pago (el premio al
// referido y el correo), que aquí sirven de testigos. NO se doblan la verificación de la firma
// (`stripe.webhooks.constructEvent`), el `express.raw` de la ruta, la idempotencia ni el router: la
// petición entra por HTTP, montada como en `src/app.ts` (`/webhooks/stripe`, `rawBody`, `router`).
// No viaja nada a Stripe: la firma es un HMAC local.
//
// ⚠️ LÍMITE DECLARADO: el doble de la base no tiene estado (lo dice `_envio-doblado.mjs`). «El merchant
// se queda con el que tenía» se mide aquí como «no se escribe NADA en su fila», no leyendo la fila.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import Stripe from 'stripe';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTA = 'src/modules/billing/app/routes/stripe.routes.ts';
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

// Claves de JUGUETE, fijadas con `=` ANTES de cargar `dist/` (`config` se congela al importarse): si
// el entorno trajera un secreto de verdad, la firma de aquí no casaría con él.
const CLAVE_JUGUETE = 'sk_test_' + 'f'.repeat(24);
const WHSEC_JUGUETE = 'whsec_' + crypto.randomBytes(12).toString('hex');
process.env.STRIPE_SECRET_KEY = CLAVE_JUGUETE;
process.env.STRIPE_WEBHOOK_SECRET = WHSEC_JUGUETE;

const M = 4402;

// ── LA BASE DOBLADA, Y LOS DOS TESTIGOS ──────────────────────────────────────────────────
const visto = { escrituras: [], registro: [], premios: 0, correos: 0 };
const limpiar = () => Object.assign(visto, { escrituras: [], registro: [], premios: 0, correos: 0 });

const doble = dobleDeLaBase({
  'merchant.update': (args) => { visto.escrituras.push(args); return { email: 'duena@example.invalid' }; },
  'gatewayEvent.create': (args) => { visto.registro.push(['create', args]); return {}; },
  'gatewayEvent.update': (args) => { visto.registro.push(['update', args]); return {}; },
});

function doblar(ruta, exportado) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports: exportado };
}
doblar('dist/core/db/prisma.js', { prisma: doble });
doblar('dist/modules/auth/domain/referral.service.js', {
  rewardReferralOnFirstPayment: async () => { visto.premios += 1; },
});
doblar('dist/modules/messaging/domain/lifecycle.service.js', {
  sendFirstPaymentEmail: async () => { visto.correos += 1; return null; },
});

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
const idNuevo = () => `evt_scrum1402_${Date.now()}_${nEvt++}_${crypto.randomBytes(4).toString('hex')}`;

/** `agent: false`, como manda SCRUM-560: sin pool, cada petición abre y cierra su conexión. */
function pedir(payload, firma) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: puerto, path: '/webhooks/stripe', method: 'POST', agent: false,
      headers: {
        'content-type': 'application/json',
        'stripe-signature': firma,
        'content-length': Buffer.byteLength(payload),
      },
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

/**
 * Emite UN evento firmado y devuelve lo que pasó mientras: la respuesta, lo que se escribió en la
 * fila del merchant, lo que se apuntó en el registro de eventos, los avisos (`console.warn`) y los
 * errores (`console.error`), y los dos testigos del primer pago.
 */
async function emitir(tipo, objeto, { id = idNuevo() } = {}) {
  limpiar();
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
    await new Promise((r) => setImmediate(r)); // el correo del primer pago va SIN `await` (SCRUM-475)
    return { id, res, avisos, errores, ...structuredClone({ escrituras: visto.escrituras, registro: visto.registro }), premios: visto.premios, correos: visto.correos };
  } finally {
    Object.assign(console, original);
  }
}

const checkout = (plan, extra = {}) => ({
  id: 'cs_scrum1402', mode: 'subscription', customer: 'cus_scrum1402',
  metadata: { merchant_id: String(M), ...(plan === undefined ? {} : { plan }) },
  ...extra,
});
const FIN = 1_900_000_000;
const suscripcion = (plan, status) => ({
  id: 'sub_scrum1402', status, current_period_end: FIN,
  metadata: { merchant_id: String(M), ...(plan === undefined ? {} : { plan }) },
});

// Los planes que tienen que seguir entrando. ESCRITOS, no derivados: si se derivaran de la lista del
// código, vaciar la lista dejaría este fichero verde sin haber activado ningún plan.
const LEGITIMOS = ['trial', 'pro', 'founding', 'equipo'];

// Lo que NO existe. Los dos primeros son los que documentó durante meses el comentario del esquema
// (SCRUM-1342); `Equipo`, `equipo ` y `PRO` son lo que escribe una mano en el panel de Stripe; los
// tres últimos existen por HERENCIA en cualquier objeto y son los que abrían el límite de usuarios.
const INVENTADOS = ['empresa', 'basic', 'Equipo', 'equipo ', 'PRO', ' pro', 'constructor', 'toString', '__proto__'];

/** El aviso del rechazo dice lo que la decisión exige. `quien` es para el mensaje del fallo. */
function exigeAvisoCompleto(r, plan, quien) {
  assert.equal(r.avisos.length, 1,
    `🔴 ${quien}: «${plan}» SE HA RECHAZADO EN SILENCIO (o no se ha rechazado). Un rechazo que no avisa es `
    + `peor que no rechazar: deja a alguien pagando sin que nadie se entere. Avisos: ${JSON.stringify(r.avisos)}`);
  const aviso = r.avisos[0];
  assert.ok(aviso.includes(JSON.stringify(plan)), `el aviso trae el valor RECIBIDO entre comillas (se ve un espacio de más): ${aviso}`);
  assert.ok(aviso.includes(`merchant ${M}`), `y dice de QUIÉN: ${aviso}`);
  assert.ok(aviso.includes(r.id), `y qué evento de Stripe fue, para poder ir a buscar el pago: ${aviso}`);
  for (const conocido of LEGITIMOS) assert.ok(aviso.includes(conocido), `y los planes que SÍ existen (falta «${conocido}»): ${aviso}`);
}

// ═══ ✅ EL POSITIVO QUE MANDA: LO LEGÍTIMO ENTRA IGUAL ═══════════════════════════════════

test('SCRUM-1402 · ✅ SUELO: los planes legítimos de este fichero son los de entitlements, ni uno más ni uno menos', () => {
  assert.equal(LEGITIMOS.length, 4, 'población: cuatro planes');
  assert.deepEqual([...PLANES_CONOCIDOS].sort(), [...LEGITIMOS].sort(),
    '🔴 la lista de `entitlements.ts` ha cambiado. No se arregla este test: se mira qué plan nace o muere y quién lo decidió (W3, regla 34).');
});

test('SCRUM-1402 · ✅ EL QUE MANDA · checkout.session.completed con un plan legítimo: se activa IGUAL, con su premio y su correo, y sin un aviso', async () => {
  for (const plan of LEGITIMOS) {
    const r = await emitir('checkout.session.completed', checkout(plan));
    assert.equal(r.res.status, 200, `${plan}: ${r.res.cuerpo}`);
    assert.deepEqual(r.escrituras, [{
      where: { id: M },
      data: { stripeCustomerId: 'cus_scrum1402', plan, subscriptionStatus: 'active' },
      select: { email: true },
    }], `🔴 UN CLIENTE QUE PAGA «${plan}» SE HA QUEDADO SIN SU PLAN. Eso es peor que el defecto que este ticket cierra.`);
    assert.equal(r.premios, 1, `${plan}: el premio al referido sale, como antes`);
    assert.equal(r.correos, 1, `${plan}: el correo de primer pago sale, como antes`);
    assert.deepEqual(r.avisos, [], `${plan}: un plan que existe no avisa`);
    assert.deepEqual(r.errores, [], `${plan}: ni deja errores`);
  }
});

test('SCRUM-1402 · ✅ EL QUE MANDA · customer.subscription.updated y .created (active, trialing) con un plan legítimo: se escribe IGUAL', async () => {
  let n = 0;
  for (const tipo of ['customer.subscription.updated', 'customer.subscription.created']) {
    for (const status of ['active', 'trialing']) {
      for (const plan of LEGITIMOS) {
        const r = await emitir(tipo, suscripcion(plan, status));
        assert.equal(r.res.status, 200, r.res.cuerpo);
        assert.equal(r.escrituras.length, 1, `🔴 ${tipo} (${status}) con «${plan}» NO HA ESCRITO EL PLAN: un cliente que paga se queda sin él`);
        assert.deepEqual(r.escrituras[0].where, { id: M });
        assert.deepEqual(r.escrituras[0].data, {
          plan, subscriptionStatus: 'active', stripeSubscriptionId: 'sub_scrum1402',
          planExpiresAt: new Date(FIN * 1000),
        });
        assert.deepEqual(r.avisos, [], `${tipo} (${status}) con «${plan}»: no avisa`);
        n += 1;
      }
    }
  }
  assert.equal(n, 16, 'población: 2 eventos × 2 estados × 4 planes');
});

test('SCRUM-1402 · ✅ EL QUE MANDA · un impago (past_due, unpaid) con un plan legítimo CONSERVA el plan, como antes', async () => {
  for (const status of ['past_due', 'unpaid']) {
    for (const plan of LEGITIMOS) {
      const r = await emitir('customer.subscription.updated', suscripcion(plan, status));
      assert.deepEqual(r.escrituras.map((e) => e.data), [
        { plan, subscriptionStatus: 'past_due', stripeSubscriptionId: 'sub_scrum1402' },
      ], `${status} con «${plan}»`);
      assert.deepEqual(r.avisos, []);
    }
  }
});

// ═══ 🔴 EL DEFECTO: UN PLAN QUE NO EXISTE NO SE ESCRIBE, Y SE DICE ═══════════════════════

test('SCRUM-1402 · 🔴 checkout.session.completed con un plan que NO existe: no se escribe NADA en el merchant, y deja UN aviso con el valor, el merchant y los planes que existen', async () => {
  assert.equal(INVENTADOS.length, 9, 'población: nueve valores');
  const escritos = [];
  for (const plan of INVENTADOS) {
    const r = await emitir('checkout.session.completed', checkout(plan));
    if (r.escrituras.length) escritos.push(`${JSON.stringify(plan)} → ${JSON.stringify(r.escrituras[0].data)}`);
  }
  assert.deepEqual(escritos, [],
    `\n🔴 EL WEBHOOK HA ESCRITO EN \`Merchant.plan\` UN PLAN QUE NO EXISTE. ${escritos.length} de ${INVENTADOS.length}:\n`
    + escritos.map((e) => `   · ${e}`).join('\n')
    + '\nDecisión del fundador (SCRUM-1402, comentario 18019, «1-Ok A»): se RECHAZA el cambio y el merchant se queda con el que tenía.\n');
  for (const plan of INVENTADOS) {
    const r = await emitir('checkout.session.completed', checkout(plan));
    exigeAvisoCompleto(r, plan, 'checkout.session.completed');
    assert.equal(r.res.status, 200, `a Stripe se le contesta 200: un 400 le haría reintentar tres días algo que no va a cambiar. ${r.res.cuerpo}`);
    assert.equal(r.premios, 0, `«${plan}»: no se premia al referido por una activación que no ha ocurrido`);
    assert.equal(r.correos, 0, `«${plan}»: no se le escribe «bienvenido» a quien no se le ha activado nada`);
  }
});

test('SCRUM-1402 · 🔴 customer.subscription.updated y .created (active, trialing) con un plan que NO existe: no se escribe NADA, y avisa', async () => {
  let n = 0;
  const escritos = [];
  for (const tipo of ['customer.subscription.updated', 'customer.subscription.created']) {
    for (const status of ['active', 'trialing']) {
      for (const plan of INVENTADOS) {
        const r = await emitir(tipo, suscripcion(plan, status));
        n += 1;
        if (r.escrituras.length) { escritos.push(`${tipo} (${status}) ${JSON.stringify(plan)} → ${JSON.stringify(r.escrituras[0].data)}`); continue; }
        exigeAvisoCompleto(r, plan, `${tipo} (${status})`);
        assert.equal(r.res.status, 200, r.res.cuerpo);
      }
    }
  }
  assert.equal(n, 36, 'población: 2 eventos × 2 estados × 9 valores');
  assert.deepEqual(escritos, [],
    `\n🔴 LA SUSCRIPCIÓN HA ESCRITO UN PLAN QUE NO EXISTE. ${escritos.length} de ${n}:\n` + escritos.map((e) => `   · ${e}`).join('\n') + '\n');
});

test('SCRUM-1402 · 🔴 un impago (past_due, unpaid) con un plan que NO existe tampoco lo escribe, y avisa', async () => {
  const escritos = [];
  for (const status of ['past_due', 'unpaid']) {
    for (const plan of INVENTADOS) {
      const r = await emitir('customer.subscription.updated', suscripcion(plan, status));
      if (r.escrituras.length) { escritos.push(`${status} ${JSON.stringify(plan)} → ${JSON.stringify(r.escrituras[0].data)}`); continue; }
      exigeAvisoCompleto(r, plan, `customer.subscription.updated (${status})`);
    }
  }
  assert.deepEqual(escritos, [],
    `\n🔴 EL IMPAGO HA ESCRITO UN PLAN QUE NO EXISTE. ${escritos.length} de ${2 * INVENTADOS.length}:\n` + escritos.map((e) => `   · ${e}`).join('\n') + '\n');
});

test('SCRUM-1402 · ✅ el rechazo NO es un fallo de entrega: el evento queda PROCESADO en el registro, sin error anotado (Stripe no reintenta)', async () => {
  const r = await emitir('customer.subscription.updated', suscripcion('empresa', 'active'));
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.escrituras, [], 'rechazado: no se escribe en el merchant');
  assert.deepEqual(r.registro.map(([op]) => op), ['create', 'update'], 'se abre el registro y se cierra: dos apuntes');
  const cierre = r.registro[1][1].data;
  assert.ok(cierre.processedAt, `🔴 el evento rechazado NO ha quedado como procesado: ${JSON.stringify(cierre)}`);
  assert.equal('lastError' in cierre, false, 'y no se anota como error');
  // El mismo registro, sobre el caso que SÍ escribe: el cierre de arriba no es un doble que contesta a todo igual.
  const control = await emitir('customer.subscription.updated', suscripcion('pro', 'active'));
  assert.deepEqual(control.registro.map(([op]) => op), ['create', 'update']);
  assert.equal(control.escrituras.length, 1, 'control positivo: con `pro`, entre los dos apuntes hay una escritura');
});

// ═══ 📌 LO QUE ESTE TICKET NO CAMBIA ═════════════════════════════════════════════════════

test('SCRUM-1402 · 📌 una CANCELACIÓN se aplica igual venga el plan que venga: escribe el literal `trial`, nunca el valor recibido', async () => {
  for (const plan of ['pro', 'empresa']) {
    for (const status of ['canceled', 'incomplete_expired']) {
      const r = await emitir('customer.subscription.updated', suscripcion(plan, status));
      assert.deepEqual(r.escrituras.map((e) => e.data), [
        { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null },
      ], `🔴 cancelar con «${plan}» (${status}) ha dejado de funcionar: quien cancela seguiría con su plan`);
    }
    const borrada = await emitir('customer.subscription.deleted', suscripcion(plan, 'canceled'));
    assert.deepEqual(borrada.escrituras.map((e) => e.data), [
      { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null },
    ], `customer.subscription.deleted con «${plan}»`);
  }
});

test('SCRUM-1402 · 📌 SIN `metadata.plan` sigue como estaba: ni escribe ni avisa (y la escucha oye). No es de este ticket, y no está decidido', async () => {
  // ⚠️ Esto NO es un visto bueno: una suscripción pagada que llega sin `metadata.plan` tampoco activa
  // nada y hoy no lo dice nadie. La decisión del fundador habla del plan que NO EXISTE, no del que NO
  // VIENE; queda reportado en `docs/master/SCRUM-1402.md` y aquí solo se fija que este ticket no lo mueve.
  for (const [tipo, objeto] of [
    ['checkout.session.completed', checkout(undefined)],
    ['checkout.session.completed', checkout('')],
    ['customer.subscription.updated', suscripcion(undefined, 'active')],
    ['customer.subscription.updated', suscripcion('', 'active')],
  ]) {
    const r = await emitir(tipo, objeto);
    assert.equal(r.res.status, 200);
    assert.deepEqual(r.escrituras, [], `${tipo} sin plan: no escribe`);
    assert.deepEqual(r.avisos, [], `${tipo} sin plan: no avisa`);
  }
  const control = await emitir('checkout.session.completed', checkout('empresa'));
  assert.equal(control.avisos.length, 1, 'control positivo: la misma escucha oye el aviso del plan que no existe');
});

test('SCRUM-1402 · 📌 la idempotencia por `event.id` no se ha tocado: la segunda entrega del mismo evento no vuelve a escribir', async () => {
  const id = idNuevo();
  const primera = await emitir('checkout.session.completed', checkout('pro'), { id });
  assert.equal(primera.escrituras.length, 1, 'la primera entrega escribe');
  const segunda = await emitir('checkout.session.completed', checkout('pro'), { id });
  assert.match(segunda.res.cuerpo, /"duplicate":true/, `la segunda se reconoce como duplicada: ${segunda.res.cuerpo}`);
  assert.deepEqual(segunda.escrituras, [], '🔴 un evento repetido ha vuelto a escribir en el merchant');
  assert.equal(segunda.premios, 0, 'y no repite el premio');
});

// ═══ 🔒 LA LISTA NO SE COPIA ═════════════════════════════════════════════════════════════

test('SCRUM-1402 · 🔒 el webhook no lleva su PROPIA lista de planes: toma la de entitlements, y el único plan que escribe por su nombre es `trial`', () => {
  const src = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // Por AST y no por texto: los comentarios del fichero nombran los planes para explicarse.
  const literales = [];
  const importados = [];
  let nodos = 0;
  (function walk(n) {
    nodos += 1;
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !ts.isImportDeclaration(n.parent)) literales.push(n.text);
    if (ts.isImportDeclaration(n) && /core\/entitlements$/.test(n.moduleSpecifier.text)) {
      for (const e of n.importClause?.namedBindings?.elements ?? []) importados.push(e.name.text);
    }
    ts.forEachChild(n, walk);
  })(sf);
  assert.ok(nodos > 500 && literales.length > 20, `🔴 CIEGO: ${nodos} nodos y ${literales.length} literales en ${RUTA}; así no se ha leído el fichero`);
  assert.ok(literales.includes('checkout.session.completed'), '🔴 CIEGO: el lector no ve un literal que está');

  assert.ok(importados.includes('PLANES_CONOCIDOS'),
    `🔴 EL WEBHOOK NO TOMA LA LISTA DE \`src/core/entitlements.ts\` (importa de allí: ${JSON.stringify(importados)}). `
    + 'Una segunda lista divergiría: es el defecto de SCRUM-1342 y de SCRUM-1401.');
  const nombrados = literales.filter((l) => LEGITIMOS.includes(l.trim().toLowerCase()));
  assert.deepEqual(nombrados, ['trial', 'trial'],
    `🔴 EL WEBHOOK NOMBRA PLANES POR SU CUENTA: ${JSON.stringify(nombrados)}. Los únicos literales de plan que le `
    + 'tocan son los dos `trial` de las dos puertas de cancelación (SCRUM-809). Cualquier otro es una lista copiada a mano.');
});

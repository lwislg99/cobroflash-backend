// SCRUM-1720 · EL AVISO DE FALLO DE MERCADO PAGO NO DEVUELVE A «failed» UN COBRO PAGADO.
//
// Es el cuarto camino de SCRUM-1292, el que su aceptación no nombraba (lo leyó jv-j4ay en SCRUM-1292
// c.21626). `mpWebhook.routes.ts`, rama `rejected`/`cancelled`, pone `status: 'failed'` dentro de un
// `if (charge.status === 'pending')`, pero su `update` iba con `where: { id: chargeId }` a secas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SE REPRODUJO, Y QUÉ NO (medido con este fichero ANTES de tocar `src/`, registro SCRUM-1720)
//
//   · ① y ② —un cobro YA `paid` recibe el aviso de fallo— NO caían: el `if` de entrada lee `paid` y no
//     escribe. A diferencia de `/webhooks/psp` en SCRUM-1292, aquí la primera barrera existía.
//   · ④ —la fila se LEE `pending` y alguien la paga entre la lectura y la escritura— SÍ caía: el
//     `update` sin condición pisaba el cobro pagado. Es el defecto del ticket: la barrera que de
//     verdad sujeta es la de dentro de la escritura, y faltaba.
//
// El arreglo es la MISMA forma que SCRUM-1292 (#2006) en `psp.routes.ts`: la lista compartida
// `ESTADOS_QUE_UN_FALLO_PUEDE_PISAR` dentro del `where`, y el P2025 reconocido con `esFilaQueNoCasa`.
//
// 🔴 EL DOBLE HACE CUMPLIR EL `where`, como el de SCRUM-1292: si trae `status` y la fila no casa,
// LANZA P2025, igual que la base. Un doble que sólo apuntara la llamada daría verde sin la barrera.
//
// Sólo LEE el camino de cobro (regla 38): la ruta compilada se monta con la base, la firma y la API
// de Mercado Pago dobladas. Ni red ni base.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/billing/app/routes/mpWebhook.routes.ts',
    de: 'where: { id: chargeId, status: { in: ESTADOS_QUE_UN_FALLO_PUEDE_PISAR } },',
    a: 'where: { id: chargeId },',
    cae: 'SCRUM-1720 · 🔴 ④ EL QUE DECIDE' },
  { fichero: 'src/modules/billing/app/routes/mpWebhook.routes.ts',
    de: 'if (!esFilaQueNoCasa(e)) throw e;',
    a: 'throw e;',
    cae: 'SCRUM-1720 · 🔴 ④ EL QUE DECIDE' },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const COBRO = 1720;
const banco = { cobro: null, actualizaciones: [], alEscribir: null, pagoMp: null };

function reiniciar(estadoInicial, mpStatus, { alEscribir = null } = {}) {
  banco.cobro = {
    id: COBRO, merchantId: 4720, customerId: null, status: estadoInicial, amount: '50.00',
    currency: 'EUR', method: 'card', intentId: null, customer: null, merchant: null,
  };
  banco.actualizaciones = [];
  banco.alEscribir = alEscribir;
  banco.pagoMp = { status: mpStatus, externalReference: `charge_${COBRO}`, amount: 50, currency: 'EUR', method: 'card' };
}

/** ¿Casa la fila con el `where`? Como Prisma: `id` exacto y `status` (literal o `{ in }`). */
function casa(where, fila) {
  if (where?.id !== undefined && where.id !== fila.id) return false;
  const s = where?.status;
  if (s === undefined) return true;
  if (typeof s === 'string') return s === fila.status;
  if (Array.isArray(s?.in)) return s.in.includes(fila.status);
  if (s?.not !== undefined) return s.not !== fila.status;
  return true;
}

const doble = dobleDeLaBase({
  'charge.findUnique': () => ({ ...banco.cobro }),
  'charge.update': (args) => {
    if (banco.alEscribir) banco.alEscribir(banco.cobro);
    if (!casa(args?.where, banco.cobro)) {
      const e = new Error('Record to update not found.');
      e.code = 'P2025';
      throw e;
    }
    banco.actualizaciones.push(args);
    const { events, reconciliations, ...datos } = args?.data ?? {};
    Object.assign(banco.cobro, datos);
    return { ...banco.cobro };
  },
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
for (const [r, exports] of [
  ['dist/lib/email.js', { sendInvoiceEmail: async () => {} }],
  ['dist/lib/invoicing.js', { ensureInvoiceForCharge: async () => null, ensureChargeReceiptToken: async () => 'tok_1720' }],
  // Mercado Pago: ni firma real ni llamada a su API. Se mide lo que la ruta hace DESPUÉS.
  ['dist/integrations/mercadopago.js', {
    verifyMpWebhookSignature: () => true,
    getMpPayment: async () => ({ ...banco.pagoMp }),
  }],
]) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const mod = requiere(rutaDe('dist/modules/billing/app/routes/mpWebhook.routes.js'));
const router = mod.default || mod;
const capa = router.stack?.find((l) => l.route?.path === '/' && l.route.methods.post);
const handle = capa?.route.stack.at(-1).handle;

/** Entrega el aviso de MP a la ruta REAL y devuelve lo que contestó y lo que gritó. */
async function entregar() {
  const r = { statusCode: null, cuerpo: null, errores: [] };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; } };
  const antes = { MP_WEBHOOK_SECRET: config.MP_WEBHOOK_SECRET, MP_ACCESS_TOKEN: config.MP_ACCESS_TOKEN };
  const errorDeVerdad = console.error;
  console.error = (...a) => { r.errores.push(a.map(String).join(' ')); };
  Object.assign(config, { MP_WEBHOOK_SECRET: 'relleno-de-test', MP_ACCESS_TOKEN: 'relleno-de-test' });
  try {
    await handle(
      { body: { type: 'payment', data: { id: 'mp-1720' } }, headers: { 'x-signature': 's', 'x-request-id': 'r' } },
      res, (e) => { if (e) throw e; },
    );
  } finally {
    console.error = errorDeVerdad;
    Object.assign(config, antes);
  }
  return r;
}

const inesperado = (r) => r.errores.filter((l) => l.includes('Error inesperado'));

// ── SUELO ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1720 · SUELO: la ruta compilada está montada y el doble hace cumplir el `where`', () => {
  assert.ok(handle, '🔴 CIEGO: no encuentro el POST / de `mpWebhook.routes`');
  // El doble tiene que distinguir: sin esto, ④ pasaría con un doble que escribe siempre.
  assert.equal(casa({ id: COBRO, status: { in: ['pending'] } }, { id: COBRO, status: 'paid' }), false);
  assert.equal(casa({ id: COBRO, status: { in: ['pending'] } }, { id: COBRO, status: 'pending' }), true);
  assert.equal(casa({ id: COBRO }, { id: COBRO, status: 'paid' }), true);
  assert.equal(casa({ id: COBRO + 1 }, { id: COBRO, status: 'pending' }), false);
});

// ── UN COBRO YA PAGADO ────────────────────────────────────────────────────────────────────

test('SCRUM-1720 · ① un cobro PAGADO recibe «rejected» de Mercado Pago y SIGUE pagado', async () => {
  reiniciar('paid', 'rejected');
  const r = await entregar();
  assert.equal(r.statusCode, 200, 'a Mercado Pago se le contesta 200 siempre, antes de procesar');
  assert.equal(banco.cobro.status, 'paid', `🔴 EL COBRO PAGADO HA RETROCEDIDO A «${banco.cobro.status}»`);
  assert.equal(banco.actualizaciones.length, 0, 'y ni siquiera se escribe');
  assert.deepEqual(inesperado(r), []);
});

test('SCRUM-1720 · ② un cobro PAGADO recibe «cancelled» de Mercado Pago y SIGUE pagado', async () => {
  reiniciar('paid', 'cancelled');
  await entregar();
  assert.equal(banco.cobro.status, 'paid', `🔴 EL COBRO PAGADO HA RETROCEDIDO A «${banco.cobro.status}»`);
  assert.equal(banco.actualizaciones.length, 0);
});

// ── EL CONTROL POSITIVO ───────────────────────────────────────────────────────────────────

test('SCRUM-1720 · ✅ ③ CONTROL POSITIVO: pending + «rejected» SÍ pasa a «failed»', async () => {
  // Sin éste, ①, ② y ④ pasarían aunque la ruta no escribiera nunca.
  reiniciar('pending', 'rejected');
  const r = await entregar();
  assert.equal(banco.cobro.status, 'failed', '🔴 el camino normal ha dejado de marcar el fallo');
  assert.equal(banco.actualizaciones.length, 1, 'y escribe exactamente una vez');
  assert.equal(banco.actualizaciones[0].data.events.create.type, 'failed', 'con su evento');
  assert.deepEqual(inesperado(r), []);
});

// ── LA SEGUNDA BARRERA ────────────────────────────────────────────────────────────────────

test('SCRUM-1720 · 🔴 ④ EL QUE DECIDE: se lee «pending», se paga antes de escribir, y SIGUE pagado', async () => {
  // El `if` de entrada ve «pending» y deja pasar; la fila está pagada cuando la base evalúa la
  // escritura. Con la condición sólo en el `if`, esto pisa el cobro pagado.
  reiniciar('pending', 'rejected', { alEscribir: (c) => { c.status = 'paid'; } });
  const r = await entregar();
  assert.equal(banco.cobro.status, 'paid',
    '🔴 LA CONDICIÓN NO ESTÁ EN LA ESCRITURA. El `if` vio «pending» y la fila ya estaba pagada al '
    + 'escribir: el aviso de fallo de Mercado Pago ha devuelto a «failed» un cobro cobrado.');
  assert.equal(banco.actualizaciones.length, 0, 'y no se escribió nada');
  assert.deepEqual(inesperado(r), [],
    '🔴 la negativa de la barrera ha caído en el `catch` de «Error inesperado»: se reconoce con '
    + '`esFilaQueNoCasa` y se dice, no se trata como un fallo cualquiera');
});

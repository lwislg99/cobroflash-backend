// SCRUM-1586 — el recordatorio de PRESUPUESTOS no reenvía si no puede guardar su candado.
//
// Decisión del fundador «A + E» (SCRUM-1508 c.20470, que dice que la parte de presupuestos es de
// S1): donde un recordatorio depende de su anotación, ESPERA a que se guarde; si no puede anotar,
// NO reenvía. Y la forma de SCRUM-1509 c.18881, elegida por el fundador: (a) se le pasa el
// cliente a `sendWhatsAppTemplate`, para que el tope por cliente y día se le aplique, y (b) el
// candado NO queda puesto cuando el tope bloquea el envío, para que se reintente.
//
// Es un FRENO a un envío que ya existe (regla 28): mismo mensaje, mismo destinatario, ninguna
// plantilla ni texto nuevo.
//
// El defecto (medido por J2 el 8-oct, SCRUM-1509 c.18879): `reminder.service.ts` enviaba y
// DESPUÉS escribía `reminderSentAt` con el error tragado. Con esa escritura rota, el cron HORARIO
// lo volvía a mandar: 48 plantillas en 48 h al mismo cliente (control sano: 1).
//
// Misma forma que facturas (SCRUM-1509j, `scrum1509j-recordatorio-de-facturas-no-reenvia`): prisma
// falso en memoria (el singleton de `core/db/prisma` lee `global.prisma`), WhatsApp en dry-run, y
// lo que sale se cuenta en `globalThis.__waDryRunOutbox`. Cada «pasada» es una llamada al cron.
import test from 'node:test';
import assert from 'node:assert/strict';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

process.env.WHATSAPP_DRY_RUN = '1';

const MID = 8;
const CID = 60;
const HORA = 60 * 60 * 1000;
const PASADAS = 48;

// ── estado de la base falsa, que cada caso reinicia ──────────────────────────────────────────
let presupuesto;
let fallos; // cuántas veces MÁS falla cada cosa: candado, liberar, token; y los bloqueos del canal
let cuenta;
let eventos;

const cliente = { id: CID, merchantId: MID, name: 'Cliente 1586', phone: telefonoDePrueba(15861), mobile: null, waOptOut: false };
const merchant = { id: MID, name: 'Taller 1586', logoUrl: null, whatsappPhone: telefonoDePrueba(15862), country: 'ES', timezone: null };

function reiniciar(f = {}) {
  presupuesto = {
    id: 900, merchantId: MID, customerId: CID, quoteNumber: 26001, status: 'sent',
    updatedAt: new Date(Date.now() - 2 * 24 * HORA), total: '121.00', currency: 'EUR',
    decisionToken: 'tok1586', reminderSentAt: null, customer: cliente, merchant,
  };
  // `topeCliente`: pasadas en las que el cliente YA lleva 3 plantillas hoy (WA_CUSTOMER_DAILY_CAP).
  fallos = { candado: 0, liberar: 0, token: 0, topeCliente: 0, deBaja: false, ...f };
  cuenta = { reservas: 0, liberaciones: 0, escriturasFallidas: 0, preguntasAlTopeDelCliente: 0 };
  eventos = [];
  globalThis.__waDryRunOutbox = [];
}

// Una escritura del candado: poner fecha (reservar/marcar) o volver a null (liberar).
function escribirCandado(data) {
  const libera = data.reminderSentAt === null;
  const clave = libera ? 'liberar' : 'candado';
  if (fallos[clave] > 0) {
    fallos[clave] -= 1;
    cuenta.escriturasFallidas += 1;
    throw new Error(`1586: la escritura del candado (${libera ? 'liberar' : 'poner'}) falla`);
  }
  if (libera) cuenta.liberaciones += 1; else cuenta.reservas += 1;
  presupuesto.reminderSentAt = data.reminderSentAt;
}

const porDefecto = {
  findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }),
  upsert: async () => ({ id: 1 }),
};
const modelos = {
  quote: {
    findMany: async ({ where }) => (
      presupuesto.status === where.status && presupuesto.reminderSentAt === null
        && presupuesto.updatedAt <= where.updatedAt.lte ? [presupuesto] : []
    ),
    // `ensureQuoteDecisionToken`: aquí falla el envío ANTES de llegar a WhatsApp (excepción).
    findUnique: async () => {
      if (fallos.token > 0) { fallos.token -= 1; throw new Error('1586: el token del presupuesto falla'); }
      return { decisionToken: presupuesto.decisionToken };
    },
    update: async ({ where, data }) => {
      if (where.id !== presupuesto.id) throw new Error('1586: update de otro presupuesto');
      if ('reminderSentAt' in data) escribirCandado(data);
      return presupuesto;
    },
    updateMany: async ({ where, data }) => {
      // regla 2: el candado sólo se toca con el comercio del presupuesto en el `where`.
      if (where.id !== presupuesto.id || where.merchantId !== presupuesto.merchantId) return { count: 0 };
      if (!('reminderSentAt' in data)) return { count: 0 };
      // condición de la reserva: sólo si el candado sigue como dice el `where`
      if ('reminderSentAt' in where && where.reminderSentAt === null && presupuesto.reminderSentAt !== null) return { count: 0 };
      escribirCandado(data);
      return { count: 1 };
    },
  },
  // la baja de WhatsApp (J3) se pregunta con `waOptOut: true`
  customer: {
    findFirst: async (a) => (a?.where?.waOptOut === true ? (fallos.deBaja ? cliente : null) : cliente),
    findUnique: async () => cliente,
    findMany: async (a) => (a?.where?.waOptOut === true ? (fallos.deBaja ? [cliente] : []) : [cliente]),
  },
  merchant: { findUnique: async () => merchant, findFirst: async () => merchant },
  customerEvent: { create: async (a) => { eventos.push(a?.data); return { id: 1 }; } },
  whatsAppMessage: {
    create: async () => ({ id: 1 }),
    findFirst: async () => null,
    // El tope por cliente sólo se pregunta si llega el cliente: aquí se ve si llega.
    count: async ({ where }) => {
      if (!where?.customerId) return 0;
      cuenta.preguntasAlTopeDelCliente += 1;
      if (fallos.topeCliente > 0) { fallos.topeCliente -= 1; return 3; }
      return 0;
    },
  },
};
global.prisma = new Proxy({}, {
  get: (_, m) => {
    if (m === '$transaction') return async (f) => (typeof f === 'function' ? f(global.prisma) : Promise.all(f));
    if (m === '$executeRaw') return async () => 0; // el cerrojo del tope de plantillas (SCRUM-1509g)
    if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
    return new Proxy({}, { get: (__, met) => (modelos[m] && modelos[m][met]) || porDefecto[met] });
  },
});

const ruido = [];
const { sendPendingReminders } = await import('../dist/modules/quotes/domain/reminder.service.js');

async function pasadas(n = PASADAS) {
  const log = console.log; const err = console.error; const warn = console.warn;
  console.log = () => {}; console.error = (...a) => ruido.push(a.join(' ')); console.warn = console.error;
  try {
    for (let i = 0; i < n; i += 1) {
      await sendPendingReminders();
      await new Promise((r) => setImmediate(r));
    }
  } finally { console.log = log; console.error = err; console.warn = warn; }
  return globalThis.__waDryRunOutbox.length;
}

test('CONTROL · todo sano: el recordatorio sale UNA vez y el candado queda puesto', async () => {
  reiniciar();
  assert.equal(await pasadas(), 1, 'el recordatorio legítimo tiene que seguir saliendo, una vez. ' +
    `Si sale 0, el banco no llega a enviar; lo que dijo el módulo: ${JSON.stringify([...new Set(ruido)].slice(0, 4))}`);
  assert.ok(presupuesto.reminderSentAt instanceof Date, 'con todo sano el candado queda puesto');
});

test('EL ROJO DE 1586 · candado roto siempre: NO reenvía (hoy, 48 en 48 pasadas horarias)', async () => {
  reiniciar({ candado: Infinity });
  const salieron = await pasadas();
  assert.equal(salieron, 0,
    `con el candado sin poder guardarse salieron ${salieron} en ${PASADAS} pasadas: si no puede anotar, no reenvía (c.20470)`);
  assert.ok(cuenta.escriturasFallidas > 0, 'precondición: la escritura del candado se intentó y falló');
});

test('CAMINO ① · la reserva falla UNA vez: no sale esa pasada y no hay duplicado (total = control)', async () => {
  reiniciar({ candado: 1 });
  assert.equal(await pasadas(1), 0, 'sin anotar, esa pasada no envía');
  const total = await pasadas(PASADAS - 1);
  assert.equal(total, 1, `una escritura fallida del candado dio ${total} envíos; sin duplicar tiene que ser 1`);
});

test('PIEZA (a) · el tope por cliente y día se le aplica: con 3 plantillas hoy, NO sale', async () => {
  reiniciar({ topeCliente: 1 });
  const primera = await pasadas(1);
  assert.ok(cuenta.preguntasAlTopeDelCliente > 0, '🔴 el envío no llevó el cliente: el tope por cliente no se evaluó');
  assert.equal(primera, 0, '🔴 el cliente ya llevaba 3 plantillas hoy y el recordatorio salió igual');
});

test('PIEZA (b) · bloqueado por el tope: el candado se libera y la pasada siguiente lo manda', async () => {
  reiniciar({ topeCliente: 1 });
  await pasadas(1);
  assert.equal(presupuesto.reminderSentAt, null, 'el tope lo bloqueó: el candado vuelve a null para reintentarse');
  const total = await pasadas(PASADAS - 1);
  assert.equal(total, 1, `bloqueado una vez por el tope: tiene que salir 1 en total, salieron ${total}`);
});

test('CAMINO ② · falla antes de llegar a WhatsApp (excepción): se libera y se reintenta', async () => {
  reiniciar({ token: 1 });
  assert.equal(await pasadas(1), 0);
  assert.equal(presupuesto.reminderSentAt, null, 'no salió: el candado vuelve a null');
  assert.equal(await pasadas(PASADAS - 1), 1, 'la pasada siguiente lo manda, una vez');
});

test('CAMINO ③ · bloqueado por el tope y liberar también falla: queda reservado y no se reenvía', async () => {
  reiniciar({ topeCliente: 1, liberar: Infinity });
  const total = await pasadas();
  assert.equal(total, 0, `con el candado sin poder liberarse salieron ${total}: se pierde ese aviso, no se repite`);
  assert.ok(presupuesto.reminderSentAt instanceof Date, 'el candado se queda puesto: no se puede anotar que no salió');
  assert.ok(ruido.some((l) => /no se pudo liberar/.test(l)), 'y la pérdida se dice en el log, no en silencio');
});

test('CONTROL · un bloqueo que NO se pasa solo (baja del canal): un intento, un aviso, y no se repite cada hora', async () => {
  reiniciar({ deBaja: true });
  assert.equal(await pasadas(), 0, 'a un cliente de baja no sale nada');
  assert.ok(presupuesto.reminderSentAt instanceof Date, 'el candado se queda: reintentar cada hora no lo arreglaría');
  assert.equal(eventos.filter((e) => e?.type === 'wa_send_failed').length, 1,
    'un solo aviso en la ficha, no uno por hora');
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Se vuelve al orden de antes: enviar sin reservar. Vuelve el bucle de 48 en 48.
    fichero: 'src/modules/quotes/domain/reminder.service.ts',
    de: 'if (!(await reservarCandado(quote.id, quote.merchantId))) continue;',
    a: 'if (false) continue;',
    cae: 'EL ROJO DE 1586',
  },
  {
    // El bloqueo por el tope no libera: el recordatorio legítimo se pierde para siempre.
    fichero: 'src/modules/quotes/domain/reminder.service.ts',
    de: 'if (reintentar) await liberarCandado(quote.id, quote.merchantId);',
    a: 'void 0;',
    cae: 'PIEZA (b)',
  },
  {
    // La reserva que no se pudo escribir «falla abierta»: se envía sin anotar y vuelve el bucle.
    fichero: 'src/modules/quotes/domain/reminder.service.ts',
    de: 'return false; // sin anotar no se envía',
    a: 'return true;',
    cae: 'EL ROJO DE 1586',
  },
  {
    // Se libera ante CUALQUIER fallo, como en facturas: un bloqueo que no se pasa solo se intenta
    // cada hora, con un aviso por hora en la ficha.
    fichero: 'src/modules/quotes/domain/reminder.service.ts',
    de: 'if (result.reason && BLOQUEOS_DEL_TOPE.has(result.reason)) reintentar = true;',
    a: 'reintentar = true;',
    cae: 'CONTROL · un bloqueo que NO se pasa solo',
  },
];

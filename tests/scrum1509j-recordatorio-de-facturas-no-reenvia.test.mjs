// SCRUM-1509j — el recordatorio de FACTURAS no reenvía si no puede guardar su candado.
//
// Decisión del fundador «A + E» (SCRUM-1508 c.20470, SCRUM-1509 c.20471): donde un recordatorio
// depende de su anotación, ESPERA a que se guarde; si no puede anotar, NO reenvía. Es un FRENO a
// un envío que ya existe (regla 28), no un envío nuevo: en el camino sano sale lo mismo, al mismo
// cliente y el mismo día.
//
// El defecto (medido por J2 el 8-oct, c.18886): `invoiceReminder` enviaba y DESPUÉS escribía
// `reminder7SentAt` / `reminder14SentAt` con el error tragado. Si esa escritura fallaba, la
// factura seguía «sin recordar» y el cron diario la volvía a mandar: 60 plantillas en 30 días
// para una factura (control sano: 2).
//
// El arreglo: el candado se RESERVA antes de enviar (`updateMany` condicionado a que siga a
// null). Tres caminos de fallo, cada uno con su caso:
//   ① la reserva falla           → no se envía (y nada que reenviar);
//   ② el envío falla             → la reserva se LIBERA y mañana se reintenta (SCRUM-116 intacto);
//   ③ el envío falla y liberar también → queda reservado: no se reenvía (se pierde ese aviso, y
//      lo dice el log). Es el coste aceptado de «si no puede anotar, se para».
//
// Sin base: prisma falso en memoria (el singleton de `core/db/prisma` lee `global.prisma`) y
// WhatsApp en dry-run; lo que sale se cuenta en `globalThis.__waDryRunOutbox`. Cada «pasada» es
// una llamada al cron; la factura tiene 30 días, así que entran el aviso de 7 y el de 14.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.WHATSAPP_DRY_RUN = '1';
process.env.NODE_ENV = 'test';

const MID = 7;
const CID = 50;
const DIA = 24 * 60 * 60 * 1000;
const PASADAS = 30;

// ── estado de la base falsa, que cada caso reinicia ─────────────────────────────────────────
let factura;
let fallos; // { candado: n|Infinity, liberar: n, envio: n } — cuántas veces más falla cada cosa
let cuenta;

const cliente = { id: CID, merchantId: MID, name: 'Cliente 1509j', phone: '34600111222', mobile: null, waOptOut: false };
const merchant = { id: MID, name: 'Taller 1509j', whatsappPhone: '34600999888', country: 'ES' };

function reiniciar(f = {}) {
  factura = {
    id: 800, merchantId: MID, customerId: CID, number: 'A-2026-0001', status: 'pending',
    createdAt: new Date(Date.now() - 30 * DIA), total: '100.00', currency: 'EUR',
    chargeId: 700, charge: { id: 700 }, customer: cliente, merchant, stageLabel: null,
    reminder7SentAt: null, reminder14SentAt: null,
  };
  fallos = { candado: 0, liberar: 0, envio: 0, ...f };
  cuenta = { reservas: 0, liberaciones: 0, escriturasFallidas: 0 };
  globalThis.__waDryRunOutbox = [];
}

const CANDADOS = ['reminder7SentAt', 'reminder14SentAt'];
const campoDe = (o) => CANDADOS.find((c) => o && c in o);

// Una escritura del candado: poner fecha (reservar/marcar) o volver a null (liberar).
function escribirCandado(data) {
  const campo = campoDe(data);
  const libera = data[campo] === null;
  const clave = libera ? 'liberar' : 'candado';
  if (fallos[clave] > 0) {
    fallos[clave] -= 1;
    cuenta.escriturasFallidas += 1;
    throw new Error(`1509j: la escritura del candado (${libera ? 'liberar' : 'poner'}) falla`);
  }
  if (libera) cuenta.liberaciones += 1; else cuenta.reservas += 1;
  factura[campo] = data[campo];
}

const porDefecto = {
  findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }),
  upsert: async () => ({ id: 1 }),
};
const modelos = {
  invoice: {
    findMany: async ({ where }) => {
      const campo = campoDe(where);
      if (!campo) return [];
      return factura.status === 'pending' && factura[campo] === null && factura.createdAt <= where.createdAt.lte ? [factura] : [];
    },
    update: async ({ where, data }) => {
      if (where.id !== factura.id) throw new Error('1509j: update de otra factura');
      if (campoDe(data)) escribirCandado(data);
      return factura;
    },
    updateMany: async ({ where, data }) => {
      if (where.id !== factura.id) return { count: 0 };
      const campo = campoDe(data);
      if (!campo) return { count: 0 };
      // condición de la reserva: sólo si el candado sigue como dice el `where`
      if (campo in where && where[campo] === null && factura[campo] !== null) return { count: 0 };
      escribirCandado(data);
      return { count: 1 };
    },
  },
  charge: {
    // El envío falla por aquí: sin token de recibo no hay mensaje (excepción → `false`).
    findUnique: async () => {
      if (fallos.envio > 0) { fallos.envio -= 1; throw new Error('1509j: el envío falla'); }
      return { id: 700, receiptToken: 'tokrecibo', merchantId: MID };
    },
    findFirst: async () => ({ id: 700, receiptToken: 'tokrecibo', merchantId: MID }),
  },
  // la baja de WhatsApp (J3) se pregunta con `waOptOut: true`: este cliente no está de baja
  customer: {
    findFirst: async (a) => (a?.where?.waOptOut === true ? null : cliente),
    findUnique: async () => cliente,
    findMany: async (a) => (a?.where?.waOptOut === true ? [] : [cliente]),
  },
  merchant: { findUnique: async () => merchant, findFirst: async () => merchant },
  customerEvent: { create: async () => ({ id: 1 }) },
  whatsAppMessage: { create: async () => ({ id: 1 }), count: async () => 0, findFirst: async () => null },
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
const { sendInvoicePaymentReminders } = await import('../dist/modules/billing/domain/invoiceReminder.service.js');

async function pasadas(n = PASADAS) {
  const log = console.log; const err = console.error; const warn = console.warn;
  console.log = () => {}; console.error = (...a) => ruido.push(a.join(' ')); console.warn = console.error;
  try {
    for (let i = 0; i < n; i += 1) {
      await sendInvoicePaymentReminders();
      await new Promise((r) => setImmediate(r));
    }
  } finally { console.log = log; console.error = err; console.warn = warn; }
  return globalThis.__waDryRunOutbox.length;
}

test('CONTROL · todo sano: salen los 2 avisos (7 y 14 días) y los dos candados quedan puestos', async () => {
  reiniciar();
  assert.equal(await pasadas(), 2, 'el recordatorio legítimo tiene que seguir saliendo, una vez cada aviso. ' +
    `Si sale 0, el banco no llega a enviar; lo que dijo el módulo: ${JSON.stringify([...new Set(ruido)].slice(0, 4))}`);
  assert.ok(factura.reminder7SentAt instanceof Date && factura.reminder14SentAt instanceof Date,
    'con todo sano los dos candados quedan puestos');
});

test('EL ROJO DE 1509b · candado roto siempre: NO reenvía (hoy, 60 en 30 pasadas)', async () => {
  reiniciar({ candado: Infinity });
  const salieron = await pasadas();
  assert.equal(salieron, 0,
    `con el candado sin poder guardarse salieron ${salieron} en ${PASADAS} pasadas: si no puede anotar, no reenvía (c.20471)`);
  assert.ok(cuenta.escriturasFallidas > 0, 'precondición: la escritura del candado se intentó y falló');
});

test('CAMINO ① · la reserva falla UNA vez: no sale esa pasada y no hay duplicado (total = control)', async () => {
  reiniciar({ candado: 2 });
  const salieron = await pasadas();
  assert.equal(salieron, 2,
    `una escritura fallida del candado dio ${salieron} envíos; sin duplicar tienen que ser los 2 del control`);
});

test('CAMINO ② · el envío falla: se libera la reserva y la pasada siguiente lo manda (SCRUM-116)', async () => {
  reiniciar({ envio: 1 });
  const primera = await pasadas(1);
  assert.equal(factura.reminder7SentAt, null, 'el envío de 7 días falló: su candado vuelve a null para reintentarse');
  const total = await pasadas(PASADAS - 1);
  assert.equal(total, 2, `envío fallido una vez: tienen que salir los 2 avisos en total, salieron ${total}`);
  assert.equal(primera, 1, 'en la primera pasada sale sólo el de 14 días');
});

test('CAMINO ③ · el envío falla y liberar también: queda reservado y no se reenvía', async () => {
  reiniciar({ envio: 1, liberar: Infinity });
  const total = await pasadas();
  assert.equal(total, 1,
    `con el envío fallido y el candado sin poder liberarse salieron ${total}: el de 7 días no se reintenta, sólo sale el de 14`);
  assert.ok(factura.reminder7SentAt instanceof Date, 'el candado de 7 días se queda puesto: no se puede anotar que no salió');
  assert.ok(ruido.some((l) => /no se pudo liberar/.test(l)), 'y la pérdida se dice en el log, no en silencio');
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Se vuelve al orden de antes: enviar sin reservar. Vuelve el bucle de 1509b.
    fichero: 'src/modules/billing/domain/invoiceReminder.service.ts',
    de: 'if (!(await reservarCandado(inv.id, campo))) continue;',
    a: 'if (false) continue;',
    cae: 'EL ROJO DE 1509b',
  },
  {
    // El envío fallido no libera: el aviso se pierde para siempre (lo que arregló SCRUM-116).
    fichero: 'src/modules/billing/domain/invoiceReminder.service.ts',
    de: 'await liberarCandado(inv.id, campo);',
    a: 'void 0;',
    cae: 'CAMINO ②',
  },
  {
    // La reserva que no se pudo escribir «falla abierta»: se envía sin anotar y vuelve el bucle.
    fichero: 'src/modules/billing/domain/invoiceReminder.service.ts',
    de: 'return false; // sin anotar no se envía',
    a: 'return true;',
    cae: 'EL ROJO DE 1509b',
  },
];

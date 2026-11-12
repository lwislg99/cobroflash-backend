// SCRUM-1436j — el recordatorio AUTOMÁTICO de pago decía «el pago del factura».
//
// Hallazgo 2 de SCRUM-1436. Texto FIRMADO en SCRUM-1436 c.18287 (cuenta de Luis; el fundador
// declaró en c.18734 que esa firma vale para el carril de Javier): «el artículo va DENTRO de la
// etiqueta» — «…el pago de la factura N…» / «…el pago del justificante N…». Es la misma forma que
// ya usa el recordatorio MANUAL (`invoicesAdmin.routes.ts`, SCRUM-1436b).
//
// Lo que se mide ejecutando el cron real (`sendInvoicePaymentReminders`, desde `dist/`), con una
// base falsa en memoria y WhatsApp en dry-run: lo que sale se lee en `globalThis.__waDryRunOutbox`.
// La factura tiene 30 días, así que en una pasada salen el aviso de 7 y el de 14 días.
//
// Tres sitios del fichero llevaban «del ${docLabel}»; sólo DOS llegan a enviarse:
//   · con cobro y la ventana abierta → el BOTÓN-ENLACE (`windowCta.bodyText`);
//   · sin cobro → el texto libre.
//   · `windowText` (con cobro) NO sale nunca desde este llamador: `sendWhatsAppWindowFirst` sólo lo
//     usa si no hay `windowCta`, y aquí siempre lo hay. Se corrige igual, pero ningún caso de este
//     fichero puede verlo, y se dice.
//
// Regla 28: no cambia CUÁNDO ni A QUIÉN. Los casos comprueban también la vía, el destinatario y
// cuántos mensajes salen, y el de ventana cerrada (plantilla de Meta, cuyo texto no es nuestro).
import test from 'node:test';
import assert from 'node:assert/strict';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

process.env.WHATSAPP_DRY_RUN = '1';

const MID = 7;
const CID = 51;
const DIA = 24 * 60 * 60 * 1000;
const TEL = telefonoDePrueba(14361);

const cliente = { id: CID, merchantId: MID, name: 'Cliente 1436j', phone: TEL, mobile: null, waOptOut: false };
const merchant = { id: MID, name: 'Taller 1436j', whatsappPhone: telefonoDePrueba(14362), country: 'ES' };

let factura;
let ventanaAbierta;

function reiniciar({ number, conCobro, ventana }) {
  factura = {
    id: 801, merchantId: MID, customerId: CID, number, status: 'pending',
    createdAt: new Date(Date.now() - 30 * DIA), total: '1419.87', currency: 'EUR',
    chargeId: conCobro ? 701 : null, charge: conCobro ? { id: 701 } : null,
    customer: cliente, merchant, stageLabel: null,
    reminder7SentAt: null, reminder14SentAt: null,
  };
  ventanaAbierta = ventana;
  globalThis.__waDryRunOutbox = [];
}

const CANDADOS = ['reminder7SentAt', 'reminder14SentAt'];
const campoDe = (o) => CANDADOS.find((c) => o && c in o);

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
    update: async ({ data }) => { const c = campoDe(data); if (c) factura[c] = data[c]; return factura; },
    updateMany: async ({ where, data }) => {
      const c = campoDe(data);
      if (where.id !== factura.id || !c) return { count: 0 };
      if (c in where && where[c] === null && factura[c] !== null) return { count: 0 };
      factura[c] = data[c];
      return { count: 1 };
    },
  },
  charge: {
    findUnique: async () => ({ id: 701, receiptToken: 'tokrecibo1436j', merchantId: MID }),
    findFirst: async () => ({ id: 701, receiptToken: 'tokrecibo1436j', merchantId: MID }),
  },
  customer: {
    findFirst: async (a) => (a?.where?.waOptOut === true ? null : cliente),
    findUnique: async () => cliente,
    findMany: async (a) => (a?.where?.waOptOut === true ? [] : [cliente]),
  },
  merchant: { findUnique: async () => merchant, findFirst: async () => merchant },
  customerEvent: { create: async () => ({ id: 1 }) },
  whatsAppMessage: {
    create: async () => ({ id: 1 }),
    count: async () => 0,
    // la ventana de 24 h: hay un mensaje ENTRANTE reciente sólo si el caso la abre
    findFirst: async (a) => (a?.where?.type === 'inbound' && ventanaAbierta ? { id: 99 } : null),
  },
};
global.prisma = new Proxy({}, {
  get: (_, m) => {
    if (m === '$transaction') return async (f) => (typeof f === 'function' ? f(global.prisma) : Promise.all(f));
    if (m === '$executeRaw') return async () => 0;
    if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
    return new Proxy({}, { get: (__, met) => (modelos[m] && modelos[m][met]) || porDefecto[met] });
  },
});

const ruido = [];
const { sendInvoicePaymentReminders } = await import('../dist/modules/billing/domain/invoiceReminder.service.js');
const { formatMoneyEs } = await import('../dist/core/utils/utils.js');
const IMPORTE = formatMoneyEs('1419.87', 'EUR');
const URGENCIA = '\nPor favor, complétalo a la mayor brevedad posible.';

async function unaPasada() {
  const log = console.log; const err = console.error; const warn = console.warn;
  console.log = () => {}; console.error = (...a) => ruido.push(a.join(' ')); console.warn = console.error;
  try {
    await sendInvoicePaymentReminders();
    await new Promise((r) => setImmediate(r));
  } finally { console.log = log; console.error = err; console.warn = warn; }
  return globalThis.__waDryRunOutbox;
}

// Lo que sale, en el orden en que el cron lo manda (primero 7 días, luego 14).
const textoDe = (e) => e.bodyText ?? e.text ?? '';

// Los textos ESPERADOS, enteros: sólo cambia el artículo; el resto, byte a byte como estaba.
const botonEsperado = (pagoDe, n, urg) =>
  `Hola Cliente 1436j 👋\nTe recordamos el pago pendiente ${pagoDe} ${n} por *${IMPORTE}* de parte de *Taller 1436j*.${urg}\n` +
  'Si ya lo has pagado, ignora este mensaje. ¡Gracias!';
const textoEsperado = (pagoDe, n, urg) =>
  `Hola Cliente 1436j 👋, te recordamos que tienes pendiente el pago ${pagoDe} *${n}* por *${IMPORTE}* de parte de *Taller 1436j*.\n${urg}\n` +
  'Si ya has realizado el pago, por favor ignora este mensaje. ¡Gracias!';

function comprobarEnvio(salida, via) {
  assert.equal(salida.length, 2,
    `tienen que salir los dos avisos (7 y 14 días) en una pasada; salieron ${salida.length}. Ruido: ${JSON.stringify([...new Set(ruido)].slice(0, 4))}`);
  for (const e of salida) {
    assert.equal(e.kind, via, `vía del envío: ${e.kind}`);
    assert.equal(e.to, TEL, 'el destinatario es el teléfono del cliente');
  }
}

test('SCRUM-1436j · FACTURA con cobro y ventana abierta: el botón dice «el pago pendiente de la factura»', async () => {
  reiniciar({ number: 'A-2026-0001', conCobro: true, ventana: true });
  const salida = await unaPasada();
  comprobarEnvio(salida, 'cta_url');
  assert.equal(textoDe(salida[0]), botonEsperado('de la factura', 'A-2026-0001', ''));
  assert.equal(textoDe(salida[1]), botonEsperado('de la factura', 'A-2026-0001', URGENCIA));
});

test('SCRUM-1436j · FACTURA sin cobro: el texto libre dice «el pago de la factura»', async () => {
  reiniciar({ number: 'A-2026-0002', conCobro: false, ventana: true });
  const salida = await unaPasada();
  comprobarEnvio(salida, 'text');
  assert.equal(textoDe(salida[0]), textoEsperado('de la factura', 'A-2026-0002', ''));
  assert.equal(textoDe(salida[1]), textoEsperado('de la factura', 'A-2026-0002', URGENCIA));
});

test('SCRUM-1436j · CONTROL · JUSTIFICANTE con cobro y ventana abierta: «del justificante», como ya salía', async () => {
  reiniciar({ number: 'J-2026-0007', conCobro: true, ventana: true });
  const salida = await unaPasada();
  comprobarEnvio(salida, 'cta_url');
  assert.equal(textoDe(salida[0]), botonEsperado('del justificante', 'J-2026-0007', ''));
  assert.equal(textoDe(salida[1]), botonEsperado('del justificante', 'J-2026-0007', URGENCIA));
});

test('SCRUM-1436j · CONTROL · JUSTIFICANTE sin cobro: «del justificante», como ya salía', async () => {
  reiniciar({ number: 'J-2026-0008', conCobro: false, ventana: true });
  const salida = await unaPasada();
  comprobarEnvio(salida, 'text');
  assert.equal(textoDe(salida[0]), textoEsperado('del justificante', 'J-2026-0008', ''));
  assert.equal(textoDe(salida[1]), textoEsperado('del justificante', 'J-2026-0008', URGENCIA));
});

test('SCRUM-1436j · CONTROL regla 28 · con cobro y ventana cerrada sale la plantilla, igual que antes', async () => {
  reiniciar({ number: 'A-2026-0003', conCobro: true, ventana: false });
  const salida = await unaPasada();
  comprobarEnvio(salida, 'template');
  for (const e of salida) assert.equal(e.templateName, 'payment_request_es');
});

test('SCRUM-1436j · ningún mensaje de los casos de arriba dice «del factura»', async () => {
  const vistos = [];
  for (const c of [
    { number: 'A-2026-0004', conCobro: true, ventana: true },
    { number: 'A-2026-0005', conCobro: false, ventana: true },
  ]) {
    reiniciar(c);
    vistos.push(...(await unaPasada()).map(textoDe));
  }
  assert.equal(vistos.length, 4, `población: 4 mensajes, salieron ${vistos.length}`);
  assert.equal(vistos.filter((t) => /pago (pendiente )?de la factura/.test(t)).length, 4,
    'control positivo: los 4 nombran «de la factura»');
  assert.deepEqual(vistos.filter((t) => t.includes('del factura')), []);
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el defecto en la etiqueta: «del factura» en todos los sitios a la vez.
    fichero: 'src/modules/billing/domain/invoiceReminder.service.ts',
    de: "isReceiptNumber(inv.number) ? 'del justificante' : 'de la factura'",
    a: "isReceiptNumber(inv.number) ? 'del justificante' : 'del factura'",
    cae: 'FACTURA con cobro y ventana abierta',
  },
  {
    // El justificante pierde su artículo: el control tiene que caer, no sólo el caso de factura.
    fichero: 'src/modules/billing/domain/invoiceReminder.service.ts',
    de: "isReceiptNumber(inv.number) ? 'del justificante' : 'de la factura'",
    a: "isReceiptNumber(inv.number) ? 'de la justificante' : 'de la factura'",
    cae: 'CONTROL · JUSTIFICANTE con cobro',
  },
];

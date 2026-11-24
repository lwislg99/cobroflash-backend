// tests/scrum1429c-dos-envios-dos-cobros.test.mjs — SCRUM-1429c (antecedente: sonda de S1 del 2-oct, SCRUM-1429 c.18152)
//
// 🔴 ESTO NO ES UN VERDE QUE BENDICE EL DOBLE COBRO. Es un TRINQUETE DE UN DEFECTO CONOCIDO.
//
// Lo leído (src/modules/billing/domain/invoiceWhatsApp.service.ts, `sendInvoicePaymentRequest`): lee
// `invoice.chargeId`; si no hay cobro, `POST ${BASE_URL}/charges` (ida y vuelta HTTP) y DESPUÉS
// `prisma.invoice.update({ chargeId })`, sin transacción ni condición. Dos envíos A LA VEZ de la misma
// factura leen los dos `chargeId = null`, crean DOS cobros pendientes y la factura se queda con el que
// escribe el último: el cliente recibe dos enlaces y el primero queda huérfano. Arreglarlo toca la
// creación de cobros (flujo de cobro en producción, STOP): este fichero NO lo arregla.
//
// CÓMO SE MIDE — molde de scrum1532d ②: el servicio de `dist/` tal cual; el POST a `/charges` sale de
// verdad hacia el router REAL de `charges.routes` montado en este proceso. Se doblan la base y Meta
// (`WHATSAPP_DRY_RUN`, buzón de laboratorio). Ningún envío real. La base doblada lleva ESTADO (la
// factura y los cobros que escribe el código se ven en la lectura siguiente), y el control «uno detrás
// de otro» demuestra que con ese estado el segundo envío reutiliza el cobro: el 2 de «a la vez» es la
// carrera, no un doble sin memoria.
//
// Las dos mitades del trinquete (A23 · 7):
//   · DECLARADO + defecto presente → verde, y dice que es un defecto conocido, no una conformidad.
//   · DECLARADO + un solo cobro vivo → ROJO: si es el arreglo, retira DEFECTO_CONOCIDO en el mismo cambio.
//   · RETIRADO + defecto presente  → ROJO.   · RETIRADO + un solo cobro vivo → verde.
//   · nada que medir (sin POST, sin cobro o un envío que no sale) → CIEGO, que es ROJO.
// Datos de EJEMPLO, ninguno real.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

/** 🔴 LA DECLARACIÓN DEL DEFECTO. Quien arregle SCRUM-1429 la retira EN EL MISMO CAMBIO. */
export const DEFECTO_CONOCIDO = {
  declarado: true,
  tickets: ['SCRUM-1429'],
  que: 'Dos envíos a la vez de la misma factura sin cobro crean dos cobros pendientes y la factura se queda con el último',
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Quitar la declaración con el defecto presente es esconderlo: cae.
    fichero: 'tests/scrum1429c-dos-envios-dos-cobros.test.mjs',
    de: '  declarado: true,\n  tickets:',
    a: '  declarado: false,\n  tickets:',
    cae: 'SCRUM-1429c · dos envíos a la vez de la misma factura siguen siendo el defecto declarado',
  },
];

const requiere = createRequire(import.meta.url);
const SERVICIO = '../dist/modules/billing/domain/invoiceWhatsApp.service.js';
const RUTA_COBROS = '../dist/modules/billing/app/routes/charges.routes.js';

let routerActual = null;
const express = requiere('express');
const app = express();
app.use(express.json());
app.use('/charges', (req, res, next) => routerActual(req, res, next));
const servidor = http.createServer(app);
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
// ANTES de cargar `dist/`: `config` se congela al importarse, y `BASE_URL` es `PUBLIC_BASE_URL`.
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${servidor.address().port}`;
test.after(() => servidor.close());

const facturaBase = {
  id: 7, merchantId: MERCHANT, customerId: CLIENTE, number: 'F260007', status: 'pending', total: '419.87', currency: 'EUR',
  chargeId: null, quoteId: null, stageLabel: null, payMethods: null,
  merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
  customer: { id: CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null, email: 'cliente@example.invalid' },
};

/** Dos envíos de la factura 7 (sin cobro), a la vez o uno detrás de otro. Devuelve lo que queda escrito. */
async function dosEnvios({ aLaVez }) {
  const factura = { chargeId: null };
  const cobros = new Map();
  const escrituras = [];
  let siguiente = 900;
  let posts = 0;
  const aplicar = (id, data) => { const c = cobros.get(id); if (c && data && data.status) c.status = data.status; return c; };
  inyectarBase({
    'invoice.findUnique': () => ({ ...facturaBase, chargeId: factura.chargeId }),
    'invoice.update': (args) => { escrituras.push(args.data); Object.assign(factura, args.data); return { ...facturaBase, ...factura }; },
    'invoice.updateMany': (args) => {
      if ('chargeId' in (args.where || {}) && args.where.chargeId !== factura.chargeId) return { count: 0 };
      escrituras.push(args.data); Object.assign(factura, args.data); return { count: 1 };
    },
    'merchant.findUnique': () => ({ id: MERCHANT }),
    'charge.create': (args) => { const c = { ...args.data, id: siguiente++, status: 'pending', expiresAt: null, reference: 'R' }; cobros.set(c.id, c); return c; },
    'charge.findFirst': (args) => { const c = cobros.get(args.where.id); return c ? { ...c } : null; },
    'charge.findUnique': (args) => { const c = cobros.get(args.where.id); return c ? { ...c, receiptToken: `tok-1429c-${c.id}` } : null; },
    'charge.update': (args) => aplicar(args.where.id, args.data),
    'charge.updateMany': (args) => ({ count: aplicar(args.where.id, args.data) ? 1 : 0 }),
  }, [SERVICIO, RUTA_COBROS, '../dist/lib/invoicing.js']);
  const router = moduloDeDist(RUTA_COBROS).default;
  assert.equal(typeof router, 'function', '🔴 CIEGO: no encuentro el router de /charges');
  routerActual = (req, res, next) => { posts++; return router(req, res, next); };
  const { sendInvoicePaymentRequest } = moduloDeDist(SERVICIO);
  assert.equal(typeof sendInvoicePaymentRequest, 'function', '🔴 CIEGO: no encuentro sendInvoicePaymentRequest');
  globalThis.__waDryRunOutbox = [];
  const [error, aviso] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    const resultados = aLaVez
      ? await Promise.all([sendInvoicePaymentRequest(facturaBase.id), sendInvoicePaymentRequest(facturaBase.id)])
      : [await sendInvoicePaymentRequest(facturaBase.id), await sendInvoicePaymentRequest(facturaBase.id)];
    const vivos = [...cobros.values()].filter((c) => c.status !== 'cancelled').map((c) => c.id);
    return { posts, creados: [...cobros.keys()], vivos, resultados, escrituras, chargeIdFinal: factura.chargeId };
  } finally {
    console.error = error;
    console.warn = aviso;
    delete globalThis.__waDryRunOutbox;
  }
}

/** DEFECTO · UNO · CIEGO · OTRO, por efecto: cobros vivos y con qué cobro salió cada envío. */
export function clasificar(m) {
  const enviados = m.resultados.map((r) => (r && r.ok ? r.chargeId : null));
  if (m.posts === 0 || m.creados.length === 0 || enviados.some((id) => id == null)) return 'CIEGO';
  if (m.vivos.length >= 2) return 'DEFECTO';
  if (m.vivos.length === 1 && enviados.every((id) => id === m.vivos[0]) && m.chargeIdFinal === m.vivos[0]) return 'UNO';
  return 'OTRO';
}

/** El veredicto del trinquete: `{ ok, motivo }`. */
export function juicio(m, declaracion) {
  const declarado = declaracion?.declarado === true;
  const estado = clasificar(m);
  const dato = `POST a /charges=${m.posts} · cobros creados [${m.creados}] · vivos [${m.vivos}] · enviados con `
    + `[${m.resultados.map((r) => (r && r.ok ? r.chargeId : `✗${r && r.reason}`))}] · factura.chargeId=${m.chargeIdFinal}`;
  if (estado === 'CIEGO') return { ok: false, estado, motivo: `CIEGO: ${dato}. No mido nada, y eso no es un verde.` };
  if (estado === 'OTRO') return { ok: false, estado, motivo: `Ni el defecto ni un solo cobro: ${dato}.` };
  if (estado === 'DEFECTO') {
    return declarado
      ? { ok: true, estado, motivo: `DEFECTO CONOCIDO, declarado (${declaracion.tickets.join(', ')}): ${dato}. No es conformidad.` }
      : { ok: false, estado, motivo: `Se retiró la declaración de SCRUM-1429 y siguen saliendo dos cobros: ${dato}.` };
  }
  return declarado
    ? { ok: false, estado, motivo: `Un solo cobro vivo: ${dato}. Si es el arreglo de SCRUM-1429, retira DEFECTO_CONOCIDO en este mismo cambio.` }
    : { ok: true, estado, motivo: `Declaración retirada y un solo cobro vivo: ${dato}.` };
}

test('SCRUM-1429c · dos envíos a la vez de la misma factura siguen siendo el defecto declarado', async (t) => {
  const m = await dosEnvios({ aLaVez: true });
  const v = juicio(m, DEFECTO_CONOCIDO);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1429c · control: uno detrás de otro, el segundo envío reutiliza el cobro (la base doblada tiene memoria)', async () => {
  const m = await dosEnvios({ aLaVez: false });
  assert.equal(clasificar(m), 'UNO', `🔴 sin carrera no sale UN cobro: ${juicio(m, undefined).motivo}`);
  assert.equal(m.posts, 1, '🔴 sin carrera se pidió más de un cobro a /charges');
});

// ── Controles SEMBRADOS: el positivo lo fabrica el propio test, no se toma prestado del árbol ──
const ok = (chargeId) => ({ ok: true, chargeId });
const DOS = { posts: 2, creados: [900, 901], vivos: [900, 901], resultados: [ok(900), ok(901)], chargeIdFinal: 901 };
const UNO = { posts: 2, creados: [900, 901], vivos: [900], resultados: [ok(900), ok(900)], chargeIdFinal: 900 };

test('SCRUM-1429c · control: las cuatro casillas del juicio, y CIEGO no es verde', () => {
  const dec = { declarado: true, tickets: ['SCRUM-1429'] };
  assert.deepEqual([clasificar(DOS), clasificar(UNO)], ['DEFECTO', 'UNO']);
  assert.deepEqual([
    juicio(DOS, dec).ok, juicio(UNO, dec).ok, juicio(DOS, { ...dec, declarado: false }).ok, juicio(UNO, undefined).ok,
  ], [true, false, false, true]);
  const ciegos = [{ ...DOS, posts: 0 }, { ...DOS, creados: [] }, { ...DOS, resultados: [ok(900), { ok: false, reason: 'x' }] }];
  for (const c of ciegos) {
    assert.equal(clasificar(c), 'CIEGO');
    assert.equal(juicio(c, dec).ok, false);
    assert.equal(juicio(c, undefined).ok, false);
  }
  assert.equal(juicio({ ...UNO, resultados: [ok(900), ok(901)] }, dec).ok, false, 'un solo cobro vivo y un envío con otro es OTRO, no verde');
});

// tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs — SCRUM-1732, opción C (decisión c.21824)
//
// Sin gate: ni BD, ni red, ni Meta. EJECUTA tres piezas reales de `dist/` —el webhook
// `POST /webhooks/psp` (`psp.routes`), `POST /admin/charges/:id/garantia` y `/:id/garantia/liberar`
// (`chargesAdmin.routes`, SCRUM-1107) y `leerLibroRegistro` con criterio de caja— contra una base en
// memoria CON ESTADO. Es el montaje de la medición de jv-j1em (c.21820), que se quedó fuera de git;
// aquí se rehace y se sube (A8: «si no está en git, no existe»).
//
// No toca `src/`, ni el esquema, ni ninguna base (regla 38 y 40): sólo LEE el camino de cobro y el
// libro. Lo de `Invoice.paidAt = new Date()` NO está aquí: es SCRUM-1735 (J2). Por eso este fichero
// no mira NUNCA el `paidAt` que el webhook escribe en la factura, y el libro se alimenta con una
// factura fabricada cuyo `paidAt` es el del cobro.
//
// 🔴 ESTO NO ES UN VERDE QUE BENDICE EL COMPORTAMIENTO DE HOY. Es un TRINQUETE DE CUATRO DEFECTOS
// CONOCIDOS del cobro parcial, todos sobre el MISMO caso: una factura F-1732 de 1.000 € (enlace de
// pago = un `Charge` de 1.000 €), el cliente paga 950 € por Bizum el 31-mar-2026 y retiene el 5 % de
// garantía de obra; meses después se libera la garantía (50 €).
//
//   (a) PAGADA AL 100 %. El webhook recibe `amount: 950`, no lo compara con nada y marca la factura
//       `paid`. Ni la factura ni el `Charge` (sigue en 1.000) guardan que entraron 950.
//   (b) LIBERACIÓN SIN ENLACE. La liberación crea un `Charge` de 50 € `paid` y hace 0 escrituras en
//       `invoice`. El único rastro es el `payload` de su evento, que apunta al CHARGE original
//       (`chargeOriginalId`), no a la factura.
//   (c) EL LIBRO DE CAJA DEVENGA EL 100 % DE GOLPE. Con la factura cobrada en el T1, el libro pone
//       base 826,45 y total 1.000 en el T1, y nada en ningún otro trimestre: la liberación no devenga
//       nunca (LIVA 163 terdecies: «por los importes efectivamente percibidos»).
//   (d) LOS COBROS SUMAN 1.050 POR UNA FACTURA DE 1.000. Los `Charge` pagados del cliente tras el
//       caso: el de 1.000 (no se rebaja) y el de 50.
//
// 🔵 QUÉ TENDRÁ QUE CAMBIAR CUANDO LLEGUE A (la tabla de cobros por factura, c.21824: decisión →
//    ALTER aditivo en las 3 bases → un PR, orden A5). El PR de A:
//    · retira de `DEFECTO_CONOCIDO` la entrada de cada hueco que arregle, EN EL MISMO CAMBIO;
//    · enseña a `baseConEstado` su modelo nuevo: hoy cualquier escritura a un modelo que no sea
//      `charge`, `invoice` o `event` se apunta en `otrasEscrituras` y cuenta como «cambio» en (a) y
//      (b) — eso es lo que pone este fichero en ROJO el día que A empiece a escribir filas;
//    · rehace la medida de (c): el libro de A leerá su tabla, y la base del libro de aquí no la
//      tiene. Lo que tiene que salir: 950/1.000 de la base en el T1-2026 y 50/1.000 en el trimestre
//      de la liberación (el IVA de lo retenido y su tope del 31-dic es pregunta 4 al asesor, c.21820);
//    · (d) puede seguir siendo cierto con A (los `Charge` no cambian): si A lo deja así a propósito,
//      lo dice su registro y la entrada se reescribe con el motivo; no se borra a secas.
//
// Cómo trabaja, por hueco (A23 · 7, igual que `scrum1730`):
//   · DECLARADO + defecto presente → verde, y dice que es un defecto conocido, no una conformidad.
//   · DECLARADO + el comportamiento cambió → ROJO: si es el arreglo (A), el mismo cambio retira su
//     declaración; si no, es un cambio del cobro o del libro sin decidir.
//   · RETIRADO + defecto presente → ROJO: retirar la declaración no es arreglarlo.
//   · RETIRADO + arreglado → verde: el trinquete ha cumplido; el test del arreglo es de quien lo haga.
//   · los controles positivos no salen → CIEGO, que es ROJO, nunca verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
// Por su efecto: pone `WHATSAPP_DRY_RUN=1` ANTES de cargar `dist/` (ni un byte hacia Meta).
import './_envio-doblado.mjs';
import { leerLibroRegistro } from '../dist/modules/invoicing/domain/libroRegistro.repo.js';
import { rangoTrimestre } from '../dist/modules/fiscal/modelo303/modelo303.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

/**
 * 🔴 LA DECLARACIÓN DE LOS CUATRO DEFECTOS. Quien arregle uno retira SU entrada en el mismo cambio
 * (`declarado: false` o borrándola). Mientras esté, cualquier cambio de ese comportamiento tumba esto.
 */
export const DEFECTO_CONOCIDO = {
  pagadaAlCien: { declarado: true,
    tickets: ['SCRUM-1732'],
    que: 'un Bizum de 950 € sobre un enlace de 1.000 € deja la factura pagada al 100 %, y nadie guarda que entraron 950' },
  liberacionSinEnlace: { declarado: true,
    tickets: ['SCRUM-1732'],
    que: 'la liberación de la garantía es un Charge suelto: 0 escrituras en invoice y su evento apunta al Charge original' },
  libroCienDeGolpe: { declarado: true,
    tickets: ['SCRUM-1732'],
    que: 'con criterio de caja, el libro devenga el 100 % de la factura en el trimestre del primer cobro y la liberación no devenga nunca' },
  cobrosSumanMas: { declarado: true,
    tickets: ['SCRUM-1732'],
    que: 'los Charge pagados del cliente suman 1.050 € por una factura de 1.000 €' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // (a) Un arreglo con la forma que tendría: el webhook no marca pagada la factura si el importe
    // notificado no llega al del cobro.
    fichero: 'src/modules/billing/app/routes/psp.routes.ts',
    de: '          if (puedeCobrarPorPasarela(linkedInvoice)) {',
    a: '          if (puedeCobrarPorPasarela(linkedInvoice) && !(body.amount !== undefined && body.amount < Number(updated.amount))) {',
    cae: 'SCRUM-1732 · (a) un Bizum de 950 € sigue dejando la factura pagada al 100 %: defecto declarado',
  },
  {
    // (b) La liberación pasa a escribir algo en la factura.
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '      prisma.charge.update({ where: { id: original.id }, data: datosParaMarcarCobrada(ahora) }),\n    ]);',
    a: "      prisma.charge.update({ where: { id: original.id }, data: datosParaMarcarCobrada(ahora) }),\n      prisma.invoice.updateMany({ where: { chargeId: original.id, merchantId: req.merchantId! }, data: { notes: 'garantia liberada' } as any }),\n    ]);",
    cae: 'SCRUM-1732 · (b) la liberación de la garantía sigue sin enlace a la factura: defecto declarado',
  },
  {
    // (c) La caja desconectada: el libro pasa a filtrar por emisión y el control (la factura sale en
    // el T1 POR SU COBRO y no en el T4 de... ) deja de distinguir → CIEGO.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: "  const campo = 'criterioCaja' in rango ? campoDeDevengo(rango.criterioCaja) : CAMPO_EMISION;",
    a: '  const campo = CAMPO_EMISION;',
    cae: 'SCRUM-1732 · (c) el libro de caja sigue devengando el 100 % en el trimestre del primer cobro: defecto declarado',
  },
  {
    // (d) La liberación deja de crear el Charge de 50 (escribe el importe en 0): la suma cambia.
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '          amount: importe,\n          currency: original.currency,',
    a: '          amount: 0,\n          currency: original.currency,',
    cae: 'SCRUM-1732 · (d) los cobros del cliente siguen sumando 1.050 € por una factura de 1.000 €: defecto declarado',
  },
  {
    // Se retira la declaración de (a) y el defecto sigue.
    fichero: 'tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs',
    de: 'DEFECTO_CONOCIDO = {\n  pagadaAlCien: { declarado: true,',
    a: 'DEFECTO_CONOCIDO = {\n  pagadaAlCien: { declarado: false,',
    cae: 'SCRUM-1732 · (a) un Bizum de 950 € sigue dejando la factura pagada al 100 %: defecto declarado',
  },
  {
    // Se retira la declaración de (c) y el defecto sigue.
    fichero: 'tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs',
    de: '  libroCienDeGolpe: { declarado: true,',
    a: '  libroCienDeGolpe: { declarado: false,',
    cae: 'SCRUM-1732 · (c) el libro de caja sigue devengando el 100 % en el trimestre del primer cobro: defecto declarado',
  },
];

// ── La base en memoria CON ESTADO ────────────────────────────────────────────────────────────
//
// `_envio-doblado.mjs` no tiene estado (lo dice su cabecera) y aquí hace falta: lo que el webhook
// escribe en el cobro y la factura lo tiene que leer la liberación de después. Así que este banco
// lleva el suyo, pequeño y sólo con lo que estas tres rutas usan. Lo que NO conoce no lo traga en
// silencio: toda escritura a otro modelo se apunta en `otrasEscrituras`, que es justo lo que A va
// a empezar a producir.

const MERCHANT = 1732;
const CLIENTE = 3;
const ESCRIBE = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

const escalares = (data) => Object.fromEntries(Object.entries(data || {})
  .filter(([, v]) => !(v && typeof v === 'object' && !(v instanceof Date) && ('create' in v || 'connect' in v))));

export function baseConEstado({ importeEnlace = '1000.00' } = {}) {
  const st = {
    charges: new Map([[1732, {
      id: 1732, merchantId: MERCHANT, customerId: CLIENTE, status: 'pending', amount: importeEnlace,
      currency: 'EUR', method: 'bizum_manual', reference: null, paidAt: null, intentId: null,
      retencionGarantiaPorcentaje: null, retencionGarantiaImporte: null,
      retencionGarantiaLiberacion: null, retencionGarantiaCobrada: null,
    }]]),
    invoice: { id: 1, merchantId: MERCHANT, number: 'F-1732', status: 'pending', total: '1000.00',
      customerId: CLIENTE, chargeId: 1732, quoteId: null, paidAt: null },
    eventos: [],
    escriturasInvoice: [],
    otrasEscrituras: [],
    siguienteId: 1733,
  };
  const eventosDe = (chargeId, data) => {
    const c = data?.events?.create;
    if (c) st.eventos.push({ chargeId, ...c });
  };
  const charge = {
    async findUnique({ where }) { const c = st.charges.get(where.id); return c ? { ...c } : null; },
    async findFirst({ where }) {
      const c = st.charges.get(where.id);
      if (!c || (where.merchantId !== undefined && where.merchantId !== c.merchantId)) return null;
      return { ...c, merchant: { timezone: 'Europe/Madrid' }, customer: null };
    },
    async update({ where, data }) {
      const c = st.charges.get(where.id);
      if (!c) { const e = new Error('Record to update not found.'); e.code = 'P2025'; throw e; }
      Object.assign(c, escalares(data));
      eventosDe(c.id, data);
      return { ...c, customer: null };
    },
    async create({ data }) {
      const c = { id: st.siguienteId++, ...escalares(data) };
      st.charges.set(c.id, c);
      eventosDe(c.id, data);
      return { ...c };
    },
    async findMany() { return [...st.charges.values()].map((c) => ({ ...c })); },
  };
  const casaFactura = (w = {}) => {
    const f = st.invoice;
    if (w.id !== undefined && w.id !== f.id) return false;
    if (w.chargeId !== undefined && w.chargeId !== f.chargeId) return false;
    if (Array.isArray(w.OR) && !w.OR.some((o) => casaFactura(o))) return false;
    if (w.status?.not !== undefined && f.status === w.status.not) return false;
    return true;
  };
  const invoice = {
    async findFirst({ where }) { return casaFactura(where) ? { ...st.invoice } : null; },
    async findUnique({ where }) { return casaFactura(where) ? { ...st.invoice } : null; },
    async findMany({ where } = {}) { return casaFactura(where) ? [{ ...st.invoice }] : []; },
  };
  for (const m of ESCRIBE) {
    invoice[m] = async (args) => {
      st.escriturasInvoice.push({ metodo: m, args });
      if (casaFactura(args?.where)) Object.assign(st.invoice, escalares(args?.data));
      return m.endsWith('Many') ? { count: 1 } : { ...st.invoice };
    };
  }
  const conocidos = {
    charge, invoice,
    event: { async create({ data }) { st.eventos.push(data); return { id: st.eventos.length }; } },
    merchant: { async findUnique() { return { id: MERCHANT, timezone: 'Europe/Madrid', criterioCaja: true }; } },
    quote: { async findFirst() { return null; }, async findMany() { return []; } },
  };
  const otro = (nombre) => new Proxy({}, {
    get: (_t, metodo) => async (args) => {
      if (ESCRIBE.has(String(metodo))) { st.otrasEscrituras.push({ modelo: nombre, metodo: String(metodo), args }); return {}; }
      if (metodo === 'findMany') return [];
      if (metodo === 'count') return 0;
      return null;
    },
  });
  const prisma = new Proxy({}, {
    get: (_t, prop) => {
      const n = String(prop);
      if (n === '$transaction') {
        return async (arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
      }
      if (n === 'then') return undefined;
      return conocidos[n] ?? otro(n);
    },
  });
  return { prisma, st };
}

function poner(ruta, exports) {
  const f = rutaDe(ruta);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

function cargarRutas(prisma) {
  poner('dist/core/db/prisma.js', { prisma });
  poner('dist/lib/email.js', { sendInvoiceEmail: async () => {} });
  // La factura ya existe (la emitió el enlace de pago): aquí no se emite ni se genera ningún PDF.
  poner('dist/lib/invoicing.js', {
    ensureInvoiceForCharge: async () => { throw new Error('SCRUM-1732: fuera del banco'); },
    ensureChargeReceiptToken: async () => 'tok_1732',
  });
  for (const m of [
    'dist/core/config/env.js', 'dist/modules/billing/domain/correoDeFacturaEnviado.js',
    'dist/modules/system/customerEvents.service.js', 'dist/integrations/whatsappNotifications.js',
    'dist/integrations/whatsapp.js', 'dist/modules/jobs/domain/job.service.js',
    'dist/modules/messaging/domain/merchantNotifications.js',
    'dist/modules/billing/app/routes/psp.routes.js', 'dist/modules/billing/app/routes/chargesAdmin.routes.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }
  const psp = requiere(rutaDe('dist/modules/billing/app/routes/psp.routes.js'));
  const capa = (psp.default || psp).stack?.find((c) => c.route?.methods?.post);
  const admin = requiere(rutaDe('dist/modules/billing/app/routes/chargesAdmin.routes.js'));
  return { webhook: capa?.route?.stack?.[0]?.handle ?? null, admin: admin.default || admin };
}

async function entregarWebhook(handle, cuerpo) {
  let salida = null;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(x) { salida = x; return this; } };
  await handle({ body: cuerpo }, res, (e) => { if (e) throw e; });
  return { status: res.statusCode, cuerpo: salida };
}

/** Petición por `node:http` con `agent: false` (por qué, en `scrum1107b`: undici + `listen(0)`). */
function peticion(puerto, url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: puerto, path: url, method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { data += t; });
      res.on('end', () => { let c = null; try { c = JSON.parse(data); } catch { /* null */ } resolve({ status: res.statusCode, cuerpo: c }); });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function pedirAdmin(router, url, body) {
  const express = requiere('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.merchantId = MERCHANT; req.userRole = 'admin'; next(); });
  app.use('/admin/charges', router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { return await peticion(server.address().port, url, body); } finally { await new Promise((r) => server.close(r)); }
}

/**
 * El caso entero, ejecutado: Bizum de `recibido` € con fecha declarada del 31-mar-2026 →
 * declarar la retención del 5 % sobre 1.000 → liberarla. Devuelve el estado de la base y cada paso.
 */
export async function correrElCaso({ recibido = 950, liberar = true } = {}) {
  const { prisma, st } = baseConEstado();
  const { webhook, admin } = cargarRutas(prisma);
  if (!webhook) return { ciego: 'no se encuentra el POST de `psp.routes`', st };
  const pago = await entregarWebhook(webhook, {
    event: 'payment.confirmed', charge_id: 1732, method: 'bizum_manual', bank_ref: 'b-1732',
    amount: recibido, currency: 'EUR', ts: '2026-03-31',
  });
  const facturaTrasPago = { ...st.invoice };
  const chargeTrasPago = { ...st.charges.get(1732) };
  const escriturasInvoiceTrasPago = st.escriturasInvoice.length;
  const otrasTrasPago = st.otrasEscrituras.length;
  let declarar = null;
  let liberacion = null;
  if (liberar) {
    declarar = await pedirAdmin(admin, '/admin/charges/1732/garantia', { total: 1000, porcentaje: 5, liberacion: '2026-11-01' });
    liberacion = await pedirAdmin(admin, '/admin/charges/1732/garantia/liberar', { method: 'bizum_manual', concept: 'Liberación garantía F-1732' });
  }
  return { pago, facturaTrasPago, chargeTrasPago, escriturasInvoiceTrasPago, otrasTrasPago, declarar, liberacion, st };
}

// ── Las cuatro medidas ──────────────────────────────────────────────────────────────────────

/** (a) ¿Un Bizum de 950 deja la factura pagada al 100 %? Control: con 1.000 la factura SÍ se paga. */
export async function medirPagada(recibido = 950) {
  const caso = await correrElCaso({ recibido, liberar: false });
  const control = await correrElCaso({ recibido: 1000, liberar: false });
  if (caso.ciego || control.ciego) return { estado: 'CIEGO', poblacion: caso.ciego || control.ciego };
  const poblacion = `webhook ${caso.pago.status} con amount=${recibido} · factura ${caso.facturaTrasPago.status} total ${caso.facturaTrasPago.total} · `
    + `Charge ${caso.chargeTrasPago.status} amount ${caso.chargeTrasPago.amount} · otras escrituras ${caso.otrasTrasPago} · `
    + `control amount=1000 → factura ${control.facturaTrasPago.status}`;
  // Control positivo: el pago completo tiene que marcar la factura y el cobro. Si no, la ruta no
  // escribe nada y el «pagada» de abajo no dice nada.
  if (control.facturaTrasPago.status !== 'paid' || control.chargeTrasPago.status !== 'paid' || caso.chargeTrasPago.status !== 'paid') {
    return { estado: 'CIEGO', poblacion };
  }
  // El defecto: 950 y 1.000 dejan la MISMA huella — factura pagada, Charge en 1.000, nada más escrito.
  const nadieGuarda950 = caso.otrasTrasPago === 0 && String(caso.chargeTrasPago.amount) === '1000.00'
    && caso.escriturasInvoiceTrasPago === control.escriturasInvoiceTrasPago;
  if (caso.facturaTrasPago.status === 'paid' && nadieGuarda950) return { estado: 'DEFECTO', poblacion };
  return { estado: 'CAMBIADO', poblacion };
}

/** (b) ¿Qué enlace queda entre el Charge de la liberación y la factura? */
export async function medirLiberacion() {
  const caso = await correrElCaso();
  if (caso.ciego) return { estado: 'CIEGO', poblacion: caso.ciego };
  const id = caso.liberacion?.cuerpo?.chargeLiberacionId;
  const nuevo = id ? caso.st.charges.get(id) : null;
  const evento = caso.st.eventos.find((e) => e.chargeId === id);
  const escriturasInvoice = caso.st.escriturasInvoice.length - caso.escriturasInvoiceTrasPago;
  const otras = caso.st.otrasEscrituras.length - caso.otrasTrasPago;
  const poblacion = `declarar ${caso.declarar?.status} · liberar ${caso.liberacion?.status} · Charge ${id ?? '—'} `
    + `${nuevo?.status ?? '—'} amount ${nuevo?.amount ?? '—'} · invoiceId ${nuevo?.invoiceId ?? 'ninguno'} · `
    + `escrituras en invoice ${escriturasInvoice} · otras ${otras} · payload ${JSON.stringify(evento?.payload ?? null)}`;
  // Control positivo: la liberación tiene que haber CREADO su cobro de 50, pagado.
  if (caso.liberacion?.status !== 200 || !nuevo || Number(nuevo.amount) !== 50 || nuevo.status !== 'paid') {
    return { estado: 'CIEGO', poblacion };
  }
  const soloAlCharge = evento?.payload?.chargeOriginalId === 1732 && evento?.payload?.invoiceId === undefined;
  if (escriturasInvoice === 0 && otras === 0 && nuevo.invoiceId === undefined && soloAlCharge) return { estado: 'DEFECTO', poblacion };
  return { estado: 'CAMBIADO', poblacion };
}

const MERCHANT_LIBRO = 7;
export function baseDelLibro(facturas) {
  const cumple = (v, f) => !f || ((!f.gte || (v && v >= f.gte)) && (!f.lte || (v && v <= f.lte)));
  return {
    invoice: { async findMany(args) {
      const w = args.where || {};
      return facturas.filter((f) => f.merchantId === w.merchantId && cumple(f.createdAt, w.createdAt) && cumple(f.paidAt, w.paidAt));
    } },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
  };
}

// La factura del caso, como la deja el cobro: emitida el 15-feb-2026, cobrada (950) el 31-mar-2026.
// Su `paidAt` es el del cobro A PROPÓSITO: el que escribe hoy el webhook es SCRUM-1735, no esto.
export const FACTURA_LIBRO = {
  id: 1, merchantId: MERCHANT_LIBRO, number: 'F-1732', createdAt: new Date(2026, 1, 15, 12), paidAt: new Date(2026, 2, 31, 12),
  type: 'F1', total: '1000.00', currency: 'EUR', status: 'paid', customerId: CLIENTE, quoteId: null, chargeId: 1732,
  albaranRefs: null, lines: [{ qty: 1, price: 826.45, tax: 0.21 }],
};

/** (c) ¿Qué devenga el libro de caja, trimestre a trimestre de 2026? */
export async function medirLibro(factura = FACTURA_LIBRO) {
  const q = {};
  for (const t of [1, 2, 3, 4]) {
    const libro = await leerLibroRegistro(baseDelLibro([factura]), { merchantId: MERCHANT_LIBRO, ...rangoTrimestre(2026, t), criterioCaja: true });
    q[t] = libro.asientos.filter((a) => a.numero === factura.number).map((a) => ({ base: a.base, total: a.total }));
  }
  // Control positivo SEMBRADO: la misma factura sin caja sale por emisión en el T1 (el libro la ve).
  const sinCaja = (await leerLibroRegistro(baseDelLibro([factura]), { merchantId: MERCHANT_LIBRO, ...rangoTrimestre(2026, 1) }))
    .asientos.some((a) => a.numero === factura.number);
  const con = [1, 2, 3, 4].filter((t) => q[t].length > 0);
  const poblacion = `1 factura de 1.000 (950 cobrados el 31-mar, 50 al liberar) · libro de caja 2026 · trimestres con asiento [${con}] · `
    + `T1 ${JSON.stringify(q[1])} · control sin caja en T1=${sinCaja}`;
  if (!sinCaja || con.length === 0) return { estado: 'CIEGO', poblacion };
  const t1 = q[1];
  if (con.join() === '1' && t1.length === 1 && t1[0].total === 1000 && t1[0].base === 826.45) return { estado: 'DEFECTO', poblacion };
  return { estado: 'CAMBIADO', poblacion };
}

/** (d) ¿Cuánto suman los Charge pagados del cliente tras el caso entero? */
export async function medirSuma() {
  const caso = await correrElCaso();
  if (caso.ciego) return { estado: 'CIEGO', poblacion: caso.ciego };
  const pagados = [...caso.st.charges.values()].filter((c) => c.customerId === CLIENTE && c.status === 'paid');
  const suma = pagados.reduce((s, c) => s + Number(c.amount), 0);
  const poblacion = `${caso.st.charges.size} Charge(s) · ${pagados.length} pagado(s) del cliente: [${pagados.map((c) => `${c.id}=${c.amount}`)}] · suma ${suma} · factura ${caso.st.invoice.total}`;
  // Control positivo: tiene que haber DOS cobros pagados (el del Bizum y el de la liberación).
  if (pagados.length !== 2) return { estado: 'CIEGO', poblacion };
  if (suma === 1050 && Number(caso.st.invoice.total) === 1000) return { estado: 'DEFECTO', poblacion };
  return { estado: 'CAMBIADO', poblacion };
}

/** El veredicto del trinquete de UN hueco: `{ ok, motivo }`. */
export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  const tickets = (declaracion?.tickets ?? ['SCRUM-1732']).join(', ');
  switch (medida.estado) {
    case 'CIEGO':
      return { ok: false, motivo: `CIEGO: los controles positivos no salen (${medida.poblacion}). No mido nada, y eso no es un verde.` };
    case 'DEFECTO':
      return declarado
        ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado (${tickets}): ${medida.poblacion}. No es conformidad.` }
        : { ok: false, motivo: `Se retiró la declaración y el defecto sigue: ${medida.poblacion}. Retirarla es parte del arreglo, no lo sustituye.` };
    default:
      return declarado
        ? { ok: false, motivo: `El comportamiento ha CAMBIADO con el defecto todavía declarado (${tickets}): ${medida.poblacion}. `
          + 'Si es la opción A de SCRUM-1732 (c.21824), retira su entrada de DEFECTO_CONOCIDO en este mismo cambio; si no, es un cambio del cobro o del libro sin decidir.' }
        : { ok: true, motivo: `Declaración retirada y arreglado: ${medida.poblacion}.` };
  }
}

const HUECOS = [
  ['pagadaAlCien', '(a) un Bizum de 950 € sigue dejando la factura pagada al 100 %', () => medirPagada()],
  ['liberacionSinEnlace', '(b) la liberación de la garantía sigue sin enlace a la factura', () => medirLiberacion()],
  ['libroCienDeGolpe', '(c) el libro de caja sigue devengando el 100 % en el trimestre del primer cobro', () => medirLibro()],
  ['cobrosSumanMas', '(d) los cobros del cliente siguen sumando 1.050 € por una factura de 1.000 €', () => medirSuma()],
];

for (const [clave, nombre, medir] of HUECOS) {
  test(`SCRUM-1732 · ${nombre}: defecto declarado`, async (t) => {
    const medida = await medir();
    t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
    const v = juicio(medida, DEFECTO_CONOCIDO[clave]);
    t.diagnostic(v.motivo);
    assert.equal(v.ok, true, `🔴 ${v.motivo}`);
  });
}

test('SCRUM-1732 · cada declaración vigente cita el ticket que la retira, y las cuatro existen', () => {
  assert.deepEqual(Object.keys(DEFECTO_CONOCIDO).sort(), HUECOS.map(([c]) => c).sort());
  for (const [hueco, d] of Object.entries(DEFECTO_CONOCIDO)) {
    if (d?.declarado !== true) continue;
    assert.deepEqual(d.tickets, ['SCRUM-1732'], `la declaración de ${hueco} tiene que citar SCRUM-1732`);
  }
});

// ── Los controles del propio instrumento: el positivo se SIEMBRA aquí, no se toma del árbol ─────

test('SCRUM-1732 · control: el banco apunta la escritura a un modelo que no conoce (lo que hará A)', async () => {
  const { prisma, st } = baseConEstado();
  await prisma.cobroDeFactura.create({ data: { invoiceId: 1, importe: 950 } });
  assert.equal(st.otrasEscrituras.length, 1, 'el banco tiene que apuntar la escritura a un modelo que no conoce');
});

test('SCRUM-1732 · control: una factura que el libro no ve deja (c) en CIEGO, no en verde', async () => {
  assert.equal((await medirLibro({ ...FACTURA_LIBRO, merchantId: 99 })).estado, 'CIEGO');
});

test('SCRUM-1732 · control: una factura cobrada por partes en dos trimestres se mide como CAMBIO', async () => {
  // Sembrado: si el libro pusiera la factura en otro trimestre (como haría A con la liberación), la
  // medida tiene que salir del DEFECTO.
  assert.equal((await medirLibro({ ...FACTURA_LIBRO, paidAt: new Date(2026, 10, 1, 12) })).estado, 'CAMBIADO');
});

test('SCRUM-1732 · control: las casillas del juicio', () => {
  const dec = { declarado: true, tickets: ['SCRUM-1732'] };
  const m = (estado) => ({ estado, poblacion: 'x' });
  assert.deepEqual([
    juicio(m('DEFECTO'), dec).ok, juicio(m('CAMBIADO'), dec).ok,
    juicio(m('DEFECTO'), { ...dec, declarado: false }).ok, juicio(m('CAMBIADO'), undefined).ok,
    juicio(m('CIEGO'), dec).ok, juicio(m('CIEGO'), undefined).ok,
  ], [true, false, false, true, false, false]);
});

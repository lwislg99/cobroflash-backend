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
import { reqDeSesion } from './_arnes-de-router.mjs';
import { leerLibroRegistro } from '../dist/modules/invoicing/domain/libroRegistro.repo.js';
import { rangoTrimestre } from '../dist/modules/fiscal/modelo303/modelo303.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

/**
 * 🔴 LA DECLARACIÓN DE LOS CUATRO DEFECTOS. Quien arregle uno retira SU entrada en el mismo cambio
 * (`declarado: false` o borrándola). Mientras esté, cualquier cambio de ese comportamiento tumba esto.
 */
//
// SCRUM-1732c (opción A, PR-1, c.21926 §⑤ y c.21928) · (a) y (b) RETIRADAS: los arregla la tabla
// `invoice_payments` (el webhook apunta 950; la liberación apunta su fila con el `invoice_id`), y sus
// casos pasan a exigir la fila. (d) se queda A PROPÓSITO, con su motivo.
// SCRUM-1732d (PR-2, U′ de c.22012) · (c) RETIRADA: el 303 devenga por los tramos de invoice_payments y el
// libro de expedidas lleva la factura entera en su expedición; su caso pasa a exigir el ARREGLO.
export const DEFECTO_CONOCIDO = {
  libroCienDeGolpe: { declarado: false,
    tickets: ['SCRUM-1732'],
    que: 'con criterio de caja, el libro devenga el 100 % de la factura en el trimestre del primer cobro y la liberación no devenga nunca' },
  cobrosSumanMas: { declarado: true,
    tickets: ['SCRUM-1732'],
    que: 'los Charge pagados del cliente suman 1.050 € por una factura de 1.000 €, A PROPÓSITO (c.21928 ②): Charge.amount es lo pedido; lo cobrado vive en invoice_payments, que suma 1.000' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // (a) El webhook deja de apuntar la fila de la factura enlazada: vuelve el defecto retirado.
    fichero: 'src/modules/billing/app/routes/psp.routes.ts',
    de: '          await cobroDeFactura(linkedInvoice.id); // SCRUM-1732',
    a: '          // mutado',
    cae: 'SCRUM-1732 · (a) un Bizum de 950 € apunta 950 en invoice_payments: arreglado por la opción A',
  },
  {
    // (b) La liberación deja de apuntar su fila contra la factura: vuelve el defecto retirado.
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '    if (factura) {\n      await apuntarCobroDeFactura(prisma, {',
    a: '    if (false as boolean) {\n      await apuntarCobroDeFactura(prisma, {',
    cae: 'SCRUM-1732 · (b) la liberación de la garantía apunta su fila contra la factura: arreglado por la opción A',
  },
  {
    // (c) La caja desconectada: el 303 vuelve a devengar por emisión y el control sembrado «cobrada
    // en el T2 → devenga en el T2» no sale → CIEGO.
    // SCRUM-1730h · reanclada: desde 1730f la caja la enciende `hayFacturaPorCaja`, no el vivo.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: '  const campo = preguntado && await hayFacturaPorCaja(db, rango.merchantId) ? CAMPO_COBRO : CAMPO_EMISION;',
    a: '  const campo = CAMPO_EMISION;',
    cae: 'SCRUM-1732 · (c) el 303 de caja devenga por los tramos de invoice_payments: arreglado por el PR-2',
  },
  {
    // (c) SCRUM-1732d · sustituye a «se retira la declaración de (c)», que murió con la declaración: el
    // libro de expedidas vuelve a anotar por cobro (sin `devengo`) y la factura deja de salir entera en el T1.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: '  const porDevengo = campo !== CAMPO_EMISION && rango.devengo === true && Object.keys(fecha).length > 0;',
    a: '  const porDevengo = campo !== CAMPO_EMISION && Object.keys(fecha).length > 0;',
    cae: 'SCRUM-1732 · (c) el 303 de caja devenga por los tramos de invoice_payments: arreglado por el PR-2',
  },
  {
    // (d) La liberación deja de crear el Charge de 50 (escribe el importe en 0): la suma cambia.
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '          amount: importe,\n          currency: original.currency,',
    a: '          amount: 0,\n          currency: original.currency,',
    cae: 'SCRUM-1732 · (d) los cobros del cliente siguen sumando 1.050 € por una factura de 1.000 €: defecto declarado',
  },
  {
    // (d) La tabla deja de sumar 1.000: la liberación apunta 0,01 €.
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '        importe, fechaCobro: ahora, fechaOrigen, metodo: method, tipo: \'liberacion_garantia\',',
    a: '        importe: 0.01, fechaCobro: ahora, fechaOrigen, metodo: method, tipo: \'liberacion_garantia\',',
    cae: 'SCRUM-1732 · (d) los cobros del cliente siguen sumando 1.050 € por una factura de 1.000 €: defecto declarado',
  },
  {
    // Se retira la declaración de (d) y la suma sigue igual.
    fichero: 'tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs',
    de: "  cobrosSumanMas: { declarado: true,",
    a: "  cobrosSumanMas: { declarado: false,",
    cae: 'SCRUM-1732 · (d) los cobros del cliente siguen sumando 1.050 € por una factura de 1.000 €: defecto declarado',
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
    pagos: [], // SCRUM-1732c · `invoice_payments`, con sus dos únicos
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
  // SCRUM-1732c · el modelo de la opción A. El único `(invoice_id, charge_id)` y el de `anula_id`
  // se hacen cumplir (P2002), y `findMany` entiende lo que usan los escritores.
  const invoicePayment = {
    async create({ data }) {
      if (data.chargeId != null && st.pagos.some((p) => p.invoiceId === data.invoiceId && p.chargeId === data.chargeId)) {
        const e = new Error('Unique constraint failed'); e.code = 'P2002'; throw e;
      }
      if (data.anulaId != null && st.pagos.some((p) => p.anulaId === data.anulaId)) {
        const e = new Error('Unique constraint failed'); e.code = 'P2002'; throw e;
      }
      const fila = { id: st.pagos.length + 1, anulaId: null, ...data };
      st.pagos.push(fila);
      return { ...fila };
    },
    async findMany({ where = {} } = {}) {
      const tipos = typeof where.tipo === 'string' ? [where.tipo] : where.tipo?.in;
      return st.pagos.filter((p) => (where.merchantId === undefined || p.merchantId === where.merchantId)
        && (where.invoiceId === undefined || p.invoiceId === where.invoiceId)
        && (where.chargeId === undefined || p.chargeId === where.chargeId)
        && (!tipos || tipos.includes(p.tipo))
        && (where.anuladaPor !== null || !st.pagos.some((a) => a.anulaId === p.id))).map((p) => ({ ...p }));
    },
  };
  const conocidos = {
    charge, invoice, invoicePayment,
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
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MERCHANT })); next(); });
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
  // SCRUM-1732c · ARREGLADO = la tabla guarda que entraron 950, contra la factura y el cobro.
  const filas = caso.st.pagos;
  if (caso.facturaTrasPago.status === 'paid' && filas.length === 1 && Number(filas[0].importe) === recibido
    && filas[0].invoiceId === 1 && filas[0].chargeId === 1732 && filas[0].tipo === 'cobro') {
    return { estado: 'ARREGLADO', poblacion: `${poblacion} · filas ${JSON.stringify(filas.map((f) => [f.invoiceId, f.chargeId, Number(f.importe), f.tipo]))}` };
  }
  const nadieGuarda950 = filas.length === 0 && caso.otrasTrasPago === 0 && String(caso.chargeTrasPago.amount) === '1000.00'
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
  // SCRUM-1732c · ARREGLADO = una fila `liberacion_garantia` de 50 contra la factura, con el cobro nuevo.
  const filaLib = caso.st.pagos.filter((f) => f.tipo === 'liberacion_garantia');
  if (filaLib.length === 1 && filaLib[0].invoiceId === 1 && filaLib[0].chargeId === id && Number(filaLib[0].importe) === 50) {
    return { estado: 'ARREGLADO', poblacion: `${poblacion} · fila liberacion_garantia invoiceId ${filaLib[0].invoiceId}` };
  }
  const soloAlCharge = evento?.payload?.chargeOriginalId === 1732 && evento?.payload?.invoiceId === undefined;
  if (filaLib.length === 0 && escriturasInvoice === 0 && otras === 0 && nuevo.invoiceId === undefined && soloAlCharge) return { estado: 'DEFECTO', poblacion };
  return { estado: 'CAMBIADO', poblacion };
}

const MERCHANT_LIBRO = 7;
export function baseDelLibro(facturas, filas = []) {
  const cumple = (v, f) => !f || ((!f.gte || (v && v >= f.gte)) && (!f.lte || (v && v <= f.lte)));
  return {
    invoice: { async findMany(args) {
      const w = args.where || {};
      return facturas.filter((f) => f.merchantId === w.merchantId && cumple(f.createdAt, w.createdAt) && cumple(f.paidAt, w.paidAt)
        && (!w.id?.in || w.id.in.includes(f.id)));
    } },
    // SCRUM-1732d · invoice_payments, que es lo que lee el devengo por tramos.
    invoicePayment: { async findMany({ where: w = {} }) {
      return filas.filter((p) => p.merchantId === w.merchantId && cumple(p.fechaCobro, w.fechaCobro)
        && (!w.invoiceId?.in || w.invoiceId.in.includes(p.invoiceId)));
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
  merchantCriterioCaja: true, // SCRUM-1730e: el congelado de la factura (c.21789 ③); hoy el libro lo ignora
};

// SCRUM-1732d · las filas del caso, como las deja el PR-1: 950 el 31-mar y la liberación (50) el 1-oct.
const filaDelCaso = (id, importe, fechaCobro, tipo) => ({ id, merchantId: MERCHANT_LIBRO, invoiceId: 1, importe, fechaCobro,
  fechaOrigen: 'declarada', metodo: 'bizum_manual', tipo, anulaId: null });
export const FILAS_LIBRO = [filaDelCaso(1, '950.00', new Date(2026, 2, 31, 12), 'cobro'), filaDelCaso(2, '50.00', new Date(2026, 9, 1, 12), 'liberacion_garantia')];

/** (c) ¿Qué devenga el 303 de caja, trimestre a trimestre de 2026? Y ¿dónde anota el libro de expedidas? */
export async function medirLibro(factura = FACTURA_LIBRO, filas = FILAS_LIBRO) {
  const q = {};
  const db = () => baseDelLibro([factura], filas);
  for (const t of [1, 2, 3, 4]) {
    // El libro que lee el 303 (`devengo: true`): los importes de los tramos del trimestre.
    const libro = await leerLibroRegistro(db(), { merchantId: MERCHANT_LIBRO, ...rangoTrimestre(2026, t), criterioCaja: true, devengo: true });
    q[t] = libro.asientos.filter((a) => a.numero === factura.number).map((a) => ({ base: a.base, total: a.total }));
  }
  // El libro de expedidas con caja (sin `devengo`): la factura entera en el T1, con sus cobros.
  const expedidas = (await leerLibroRegistro(db(), { merchantId: MERCHANT_LIBRO, ...rangoTrimestre(2026, 1), criterioCaja: true }))
    .asientos.find((a) => a.numero === factura.number);
  // Control positivo SEMBRADO: la misma factura sin caja sale por emisión en el T1 (el libro la ve).
  const sinCaja = (await leerLibroRegistro(db(), { merchantId: MERCHANT_LIBRO, ...rangoTrimestre(2026, 1) }))
    .asientos.some((a) => a.numero === factura.number);
  // Control positivo SEMBRADO de que la caja está ENCENDIDA: la misma factura cobrada entera el 20-may
  // devenga en el T2. Hace falta porque el caso se emite y se cobra en el T1: con la caja apagada (por
  // emisión) el T1 saldría igual (la mutación «caja desconectada» salió MUDA sin este control, 13-nov).
  const cobradaEnT2 = baseDelLibro([{ ...factura, paidAt: new Date(2026, 4, 20, 12) }], [filaDelCaso(3, '1000.00', new Date(2026, 4, 20, 12), 'cobro')]);
  const cajaEncendida = (await leerLibroRegistro(cobradaEnT2, { merchantId: MERCHANT_LIBRO, ...rangoTrimestre(2026, 2), criterioCaja: true, devengo: true }))
    .asientos.some((a) => a.numero === factura.number);
  const con = [1, 2, 3, 4].filter((t) => q[t].length > 0);
  const poblacion = `1 factura de 1.000 (950 cobrados el 31-mar, 50 al liberar el 1-oct) · 303 de caja 2026 · trimestres que devengan [${con}] · `
    + `T1 ${JSON.stringify(q[1])} · T4 ${JSON.stringify(q[4])} · expedidas T1 total=${expedidas?.total} cobros=${expedidas?.cobros?.length} · `
    + `control sin caja en T1=${sinCaja} · control caja encendida (cobrada en T2 → T2)=${cajaEncendida}`;
  if (!sinCaja || !cajaEncendida || con.length === 0) return { estado: 'CIEGO', poblacion };
  const t1 = q[1];
  if (con.join() === '1' && t1.length === 1 && t1[0].total === 1000 && t1[0].base === 826.45) return { estado: 'DEFECTO', poblacion };
  if (con.join() === '1,4' && t1[0].total === 950 && t1[0].base === 785.13 && q[4][0].total === 50 && q[4][0].base === 41.32
    && expedidas?.total === 1000 && expedidas?.cobros?.length === 2) return { estado: 'ARREGLADO', poblacion };
  return { estado: 'CAMBIADO', poblacion };
}

/** (d) ¿Cuánto suman los Charge pagados del cliente tras el caso entero? */
export async function medirSuma() {
  const caso = await correrElCaso();
  if (caso.ciego) return { estado: 'CIEGO', poblacion: caso.ciego };
  const pagados = [...caso.st.charges.values()].filter((c) => c.customerId === CLIENTE && c.status === 'paid');
  const suma = pagados.reduce((s, c) => s + Number(c.amount), 0);
  // SCRUM-1732c · lo COBRADO vive en `invoice_payments` (c.21928 ②): tiene que sumar la factura, en céntimos.
  const sumaTablaC = caso.st.pagos.filter((f) => f.invoiceId === 1).reduce((s, f) => s + Math.round(Number(f.importe) * 100), 0);
  const poblacion = `${caso.st.charges.size} Charge(s) · ${pagados.length} pagado(s) del cliente: [${pagados.map((c) => `${c.id}=${c.amount}`)}] · suma ${suma} · factura ${caso.st.invoice.total}`
    + ` · invoice_payments ${caso.st.pagos.length} fila(s), suman ${sumaTablaC / 100}`;
  // Control positivo: tiene que haber DOS cobros pagados (el del Bizum y el de la liberación).
  if (pagados.length !== 2) return { estado: 'CIEGO', poblacion };
  if (suma === 1050 && Number(caso.st.invoice.total) === 1000 && sumaTablaC === 100000) return { estado: 'DEFECTO', poblacion };
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

const HUECOS = ['libroCienDeGolpe', 'cobrosSumanMas'];

/** Un caso por hueco. El nombre va LITERAL en cada `test()` (SCRUM-1415: la tanda no pierde nombres). */
const juzgar = (clave, medir) => async (t) => {
  const medida = await medir();
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  const v = juicio(medida, DEFECTO_CONOCIDO[clave]);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
};

/** SCRUM-1732c · (a) y (b), retiradas: se exige el ARREGLO (la fila), no sólo que «cambió». */
const arreglado = (medir) => async (t) => {
  const medida = await medir();
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  assert.equal(medida.estado, 'ARREGLADO', `🔴 ${medida.estado}: ${medida.poblacion}`);
};
test('SCRUM-1732 · (a) un Bizum de 950 € apunta 950 en invoice_payments: arreglado por la opción A',
  arreglado(() => medirPagada()));
test('SCRUM-1732 · (b) la liberación de la garantía apunta su fila contra la factura: arreglado por la opción A',
  arreglado(() => medirLiberacion()));
test('SCRUM-1732 · (c) el 303 de caja devenga por los tramos de invoice_payments: arreglado por el PR-2',
  arreglado(() => medirLibro()));
test('SCRUM-1732 · (d) los cobros del cliente siguen sumando 1.050 € por una factura de 1.000 €: defecto declarado',
  juzgar('cobrosSumanMas', () => medirSuma()));

test('SCRUM-1732 · cada declaración vigente cita el ticket que la retira, y las dos que quedan existen', () => {
  assert.deepEqual(Object.keys(DEFECTO_CONOCIDO).sort(), [...HUECOS].sort());
  for (const [hueco, d] of Object.entries(DEFECTO_CONOCIDO)) {
    if (d?.declarado !== true) continue;
    assert.deepEqual(d.tickets, ['SCRUM-1732'], `la declaración de ${hueco} tiene que citar SCRUM-1732`);
  }
});

// ── Los controles del propio instrumento: el positivo se SIEMBRA aquí, no se toma del árbol ─────

test('SCRUM-1732 · control: el banco apunta la escritura a un modelo que no conoce', async () => {
  const { prisma, st } = baseConEstado();
  await prisma.modeloQueNoExiste.create({ data: { invoiceId: 1, importe: 950 } });
  assert.equal(st.otrasEscrituras.length, 1, 'el banco tiene que apuntar la escritura a un modelo que no conoce');
});

test('SCRUM-1732 · control: el banco conoce invoicePayment y hace cumplir su único', async () => {
  const { prisma, st } = baseConEstado();
  await prisma.invoicePayment.create({ data: { invoiceId: 1, chargeId: 1732, importe: 950, tipo: 'cobro' } });
  await assert.rejects(prisma.invoicePayment.create({ data: { invoiceId: 1, chargeId: 1732, importe: 950, tipo: 'cobro' } }), (e) => e.code === 'P2002');
  assert.deepEqual([st.pagos.length, st.otrasEscrituras.length], [1, 0]);
});

test('SCRUM-1732 · control: una factura que el libro no ve deja (c) en CIEGO, no en verde', async () => {
  assert.equal((await medirLibro({ ...FACTURA_LIBRO, merchantId: 99 })).estado, 'CIEGO');
});

test('SCRUM-1732 · control: sin filas, la factura vuelve al 100 % en el T1 y (c) lo ve como DEFECTO', async () => {
  // Sembrado: sin invoice_payments el devengo es el de siempre (c.21926 §①), que es el defecto de (c).
  assert.equal((await medirLibro(FACTURA_LIBRO, [])).estado, 'DEFECTO');
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

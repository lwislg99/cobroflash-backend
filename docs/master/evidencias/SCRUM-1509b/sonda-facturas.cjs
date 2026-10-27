// SCRUM-1509b - sonda sobre los modulos COMPILADOS (dist/) del recordatorio de FACTURAS.
// WhatsApp en dry-run (Meta no se toca) y un prisma falso en memoria: nada contra ninguna base.
// Todo lo que cuenta se lee en el DESTINO: el buzon de salida del dry-run (lo que habria ido a
// Meta), los `where` con que whatsapp.js pregunta el tope, y las filas que pide escribir.
//
// Uso: node sonda-facturas.cjs <dist> clave=valor ...
//   objeto=factura|presupuesto   (presupuesto: SOLO se ejecuta, es el control del instrumento)
//   candado=ok|roto              la escritura de reminder7SentAt / reminder14SentAt
//   registro=ok|roto             la escritura del registro de WhatsApp (whatsAppMessage.create)
//   facturas=N                   facturas pendientes del MISMO cliente
//   edad=D                       dias que tienen las facturas en la pasada 0
//   pasadas=P                    pasadas del cron (facturas: una al dia; presupuestos: una a la hora)
//   previas=K                    plantillas que ese cliente YA recibio hoy de ese comercio (dia 0)
//   previasComercio=K            plantillas que el comercio YA mando hoy a OTROS clientes (dia 0)
//   ventana=0|1                  1 = el cliente escribio hace menos de 24 h en cada pasada
//   cobro=1|0                    0 = factura sin cobro: rama de texto libre
//   mutar=no|sin-cliente         sin-cliente: el modulo se carga EN MEMORIA sin pasar el cliente
//                                (contrafactico; el fichero de dist no se toca)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const dist = path.resolve(process.argv[2] || '');
const P = { objeto: 'factura', candado: 'ok', registro: 'ok', facturas: '1', edad: '30', pasadas: '30', previas: '0',
  previasComercio: '0', ventana: '0', cobro: '1', mutar: 'no' };
for (const a of process.argv.slice(3)) {
  const i = a.indexOf('=');
  const k = a.slice(0, i);
  if (i < 1 || !(k in P)) { console.log('SONDA ROTA: argumento desconocido ' + a); process.exit(2); }
  P[k] = a.slice(i + 1);
}
const N = (k) => { const n = Number(P[k]); if (!Number.isInteger(n) || n < 0) { console.log('SONDA ROTA: ' + k); process.exit(2); } return n; };
process.env.WHATSAPP_DRY_RUN = '1';
process.env.NODE_ENV = 'test';

// -- reloj: la pasada 0 es HOY a las 10:00 (la hora del cron de facturas) ---------------------
const RealDate = Date;
const base = new RealDate(); base.setHours(10, 0, 0, 0);
let desfaseMs = 0;
const ahora = () => base.getTime() + desfaseMs;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(ahora()); else super(...a); }
  static now() { return ahora(); }
}
global.Date = FakeDate;

// -- base en memoria --------------------------------------------------------------------------
const MID = 7; const CID = 50;
const cliente = { id: CID, merchantId: MID, name: 'Cliente Sonda', phone: '34600111222', mobile: null, waOptOut: false };
const merchant = { id: MID, name: 'Taller Sonda', legalName: null, logoUrl: null, whatsappPhone: '34600999888', country: 'ES' };
const conCobro = P.cobro === '1';
const facturas = [];
for (let i = 0; i < N('facturas'); i += 1) {
  facturas.push({ id: 800 + i, merchantId: MID, customerId: CID, number: 'A-2026-000' + (i + 1), status: 'pending',
    createdAt: new RealDate(base.getTime() - N('edad') * 86400000), total: '100.00', currency: 'EUR',
    chargeId: conCobro ? 700 + i : null, charge: conCobro ? { id: 700 + i } : null, customer: cliente, merchant, stageLabel: null,
    reminder7SentAt: null, reminder14SentAt: null });
}
const presupuesto = { id: 900, merchantId: MID, customerId: CID, quoteNumber: 12, status: 'sent',
  createdAt: new RealDate(base.getTime() - 3 * 86400000), updatedAt: new RealDate(base.getTime() - 3 * 86400000),
  reminderSentAt: null, decisionToken: 'tokdecision', total: '100.00', currency: 'EUR', customer: cliente, merchant, validUntil: null };

const waLog = [];
const c = { candadoPedido: 0, candadoEscrito: 0, registroPedido: 0, registroEscrito: 0, filasSent: 0,
  topeClientePreguntado: 0, topeComercioPreguntado: 0, avisosEnFicha: 0 };
const clientesPreguntados = new Set();
const clientesEnFilaSent = new Set();
const motivosDeFallo = {};
let k = 0;
for (let i = 0; i < N('previas'); i += 1) waLog.push({ merchantId: MID, customerId: CID, type: 'template', waMessageId: 'previa.' + (k += 1), status: 'sent', createdAt: new RealDate(base.getTime() - 3600000) });
for (let i = 0; i < N('previasComercio'); i += 1) waLog.push({ merchantId: MID, customerId: 9000 + i, type: 'template', waMessageId: 'previa.' + (k += 1), status: 'sent', createdAt: new RealDate(base.getTime() - 3600000) });

const porDefecto = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }),
  upsert: async () => ({ id: 1 }), delete: async () => ({ id: 1 }), deleteMany: async () => ({ count: 0 }) };
const fallaCandado = P.candado === 'roto';
const fallaRegistro = P.registro === 'roto';

const modelos = {
  quote: {
    findMany: async ({ where }) => (presupuesto.status === 'sent' && (where.reminderSentAt !== null || presupuesto.reminderSentAt === null) ? [presupuesto] : []),
    findUnique: async () => presupuesto, findFirst: async () => presupuesto, updateMany: async () => ({ count: 0 }),
    update: async ({ data }) => {
      if ('reminderSentAt' in data) { c.candadoPedido += 1; if (fallaCandado) throw new Error('SONDA: la escritura del candado falla'); c.candadoEscrito += 1; }
      Object.assign(presupuesto, data); return presupuesto;
    },
  },
  invoice: {
    findMany: async ({ where }) => {
      const campo = 'reminder7SentAt' in where ? 'reminder7SentAt' : ('reminder14SentAt' in where ? 'reminder14SentAt' : null);
      if (!campo) return [];
      return facturas.filter((f) => f.status === 'pending' && f[campo] === null && f.createdAt <= where.createdAt.lte);
    },
    update: async ({ where, data }) => {
      const f = facturas.find((x) => x.id === where.id);
      if ('reminder7SentAt' in data || 'reminder14SentAt' in data) { c.candadoPedido += 1; if (fallaCandado) throw new Error('SONDA: la escritura del candado falla'); c.candadoEscrito += 1; }
      Object.assign(f, data); return f;
    },
  },
  charge: { findUnique: async () => ({ id: 700, receiptToken: 'tokrecibo', merchantId: MID }), findFirst: async () => ({ id: 700, receiptToken: 'tokrecibo', merchantId: MID }) },
  customer: { findMany: async (a) => (a && a.where && a.where.waOptOut === true ? [] : [cliente]), findFirst: async (a) => (a && a.where && a.where.waOptOut === true ? null : cliente), findUnique: async () => cliente },
  merchant: { findUnique: async () => merchant, findFirst: async () => merchant },
  customerEvent: { create: async () => { c.avisosEnFicha += 1; return { id: 1 }; } },
  whatsAppMessage: {
    create: async ({ data }) => {
      c.registroPedido += 1;
      if (data.status === 'sent') { c.filasSent += 1; clientesEnFilaSent.add(String(data.customerId)); }
      else motivosDeFallo[String(data.error).slice(0, 40)] = (motivosDeFallo[String(data.error).slice(0, 40)] || 0) + 1;
      if (fallaRegistro) throw new Error('SONDA: la escritura del registro de WhatsApp falla');
      c.registroEscrito += 1;
      waLog.push({ ...data, createdAt: new FakeDate() }); return { id: waLog.length };
    },
    // AQUI se ve si el destino evalua el tope por cliente: la pregunta lleva `customerId` o no la lleva.
    count: async ({ where }) => {
      if (where.type === 'template') {
        if (where.customerId != null) { c.topeClientePreguntado += 1; clientesPreguntados.add(String(where.customerId)); }
        else c.topeComercioPreguntado += 1;
      }
      return waLog.filter((r) => r.merchantId === where.merchantId && r.type === where.type
        && (where.customerId == null || r.customerId === where.customerId)
        && (!where.waMessageId || r.waMessageId != null)
        && r.createdAt >= where.createdAt.gte).length;
    },
    // la ventana de 24 h: abierta solo si se pide con ventana=1
    findFirst: async ({ where } = {}) => (P.ventana === '1' && where && where.type === 'inbound' ? { id: 1 } : null),
  },
};
global.prisma = new Proxy({}, { get: (_, m) => {
  if (m === '$transaction') return async (f) => (typeof f === 'function' ? f(global.prisma) : Promise.all(f));
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => (modelos[m] && modelos[m][met]) || porDefecto[met] });
} });

const logs = [];
console.error = (...a) => logs.push(a.join(' '));
console.warn = (...a) => logs.push(a.join(' '));
const hablar = console.log; console.log = () => {};
globalThis.__waDryRunOutbox = [];

// -- carga del modulo; con mutar=sin-cliente se compila EN MEMORIA una copia sin el cliente ----
const RUTA = { factura: 'modules/billing/domain/invoiceReminder.service.js', presupuesto: 'modules/quotes/domain/reminder.service.js' }[P.objeto];
if (!RUTA) { hablar('SONDA ROTA: objeto'); process.exit(2); }
const fichero = path.join(dist, RUTA);
let sustituciones = null;
function cargar() {
  if (P.mutar === 'no') return require(fichero);
  if (P.mutar !== 'sin-cliente' || P.objeto !== 'factura') { hablar('SONDA ROTA: mutar'); process.exit(2); }
  let src = fs.readFileSync(fichero, 'utf8');
  sustituciones = 0;
  // las dos formas con que la rama de plantilla pasa el cliente a sendWhatsAppWindowFirst
  src = src.replace(/merchantId: inv\.merchantId, \/\/ J3: respeta waOptOut\r?\n\s*customerId: inv\.customerId,/, (m) => { sustituciones += 1; return m.replace(/customerId: inv\.customerId,/, ''); });
  src = src.replace(/log: \{ customerId: inv\.customerId, relatedType: 'invoice'/, () => { sustituciones += 1; return "log: { relatedType: 'invoice'"; });
  if (sustituciones !== 2) { hablar('SONDA ROTA: la mutacion sustituyo ' + sustituciones + ' de 2; no se mide'); process.exit(2); }
  const m = new Module(fichero, module);
  m.filename = fichero; m.paths = Module._nodeModulePaths(path.dirname(fichero));
  m._compile(src, fichero);
  return m.exports;
}

(async () => {
  const mod = cargar();
  const pasar = P.objeto === 'factura' ? mod.sendInvoicePaymentReminders : mod.sendPendingReminders;
  const paso = P.objeto === 'factura' ? 86400000 : 3600000;
  const porPasada = [];
  for (let i = 0; i < N('pasadas'); i += 1) {
    desfaseMs = i * paso;
    const antes = globalThis.__waDryRunOutbox.length;
    await pasar();
    await new Promise((r) => setImmediate(r));
    porPasada.push(globalThis.__waDryRunOutbox.length - antes);
  }
  const buzon = globalThis.__waDryRunOutbox;
  const porClase = {};
  for (const e of buzon) porClase[e.kind] = (porClase[e.kind] || 0) + 1;
  hablar(JSON.stringify({ ...P,
    SALIERON: buzon.length, porClase, porPasada: porPasada.join(','),
    candadoPedido: c.candadoPedido, candadoEscrito: c.candadoEscrito,
    topeClientePreguntado: c.topeClientePreguntado, clientesPreguntados: [...clientesPreguntados],
    topeComercioPreguntado: c.topeComercioPreguntado,
    filasSentPedidas: c.filasSent, clientesEnFilaSent: [...clientesEnFilaSent],
    bloqueos: motivosDeFallo, avisosEnFicha: c.avisosEnFicha,
    registroPedido: c.registroPedido, registroEscrito: c.registroEscrito,
    facturasCon7: facturas.filter((f) => f.reminder7SentAt).length, facturasCon14: facturas.filter((f) => f.reminder14SentAt).length,
    sustituciones }));
  const otros = logs.filter((l) => !/SONDA|BLOQUEADO|omitido|error marcando|error 7d|error 14d|WA error|NO entregado|no registrado/.test(l));
  if (otros.length) hablar('  otros avisos (' + otros.length + '): ' + [...new Set(otros.map((l) => l.slice(0, 160)))].slice(0, 4).join(' || '));
})().catch((e) => { hablar('SONDA ROTA: ' + ((e && e.stack) || e)); process.exit(2); });

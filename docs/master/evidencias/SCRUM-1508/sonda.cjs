// SCRUM-1508 - sonda sobre los modulos COMPILADOS (dist/), con WhatsApp en dry-run (Meta no se toca)
// y un prisma falso en memoria. Lo unico que cambia entre CONTROL y CASO es que escritura falla.
// Uso: node sonda.cjs <dist> <sonda> <variante>
//   sonda: presupuesto | factura | tope
//   variante: control | candado | registro | ambos
const path = require('path');
const dist = path.resolve(process.argv[2]);
const sonda = process.argv[3];
const variante = process.argv[4];
process.env.WHATSAPP_DRY_RUN = '1';
process.env.NODE_ENV = 'test';

const fallaCandado = variante === 'candado' || variante === 'ambos';
const fallaRegistro = variante === 'registro' || variante === 'ambos';

// ── reloj: los modulos usan `new Date()`; se desplaza por pasada ─────────────────────────
const RealDate = Date;
let desfaseMs = 0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfaseMs); else super(...a); }
  static now() { return RealDate.now() + desfaseMs; }
}
global.Date = FakeDate;

// ── base en memoria ─────────────────────────────────────────────────────────────────────
const HACE = (dias) => new RealDate(RealDate.now() - dias * 86400000);
const cliente = { id: 50, merchantId: 7, name: 'Cliente Sonda', phone: '34600111222', mobile: null, waOptOut: false };
const merchant = { id: 7, name: 'Taller Sonda', legalName: null, logoUrl: null, whatsappPhone: '34600999888', country: 'ES' };
const presupuesto = { id: 900, merchantId: 7, customerId: 50, quoteNumber: 12, status: 'sent', createdAt: HACE(3), updatedAt: HACE(3),
  reminderSentAt: null, decisionToken: 'tokdecision', total: '100.00', currency: 'EUR', customer: cliente, merchant, validUntil: null };
const factura = { id: 800, merchantId: 7, customerId: 50, number: 'A-2026-0001', status: 'pending', createdAt: HACE(30), total: '100.00', currency: 'EUR',
  chargeId: 700, charge: { id: 700 }, customer: cliente, merchant, stageLabel: null, reminder7SentAt: null, reminder14SentAt: null };
const waLog = [];
const cuenta = { escriturasCandadoPedidas: 0, escriturasCandadoHechas: 0, registroPedidas: 0, registroHechas: 0 };

const porDefecto = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }),
  upsert: async () => ({ id: 1 }), delete: async () => ({ id: 1 }), deleteMany: async () => ({ count: 0 }) };

const modelos = {
  quote: {
    findMany: async ({ where }) => (presupuesto.status === 'sent' && (where.reminderSentAt !== null || presupuesto.reminderSentAt === null) ? [presupuesto] : []),
    findUnique: async () => presupuesto, findFirst: async () => presupuesto,
    updateMany: async () => ({ count: 0 }),
    update: async ({ data }) => {
      if ('reminderSentAt' in data) {
        cuenta.escriturasCandadoPedidas += 1;
        if (fallaCandado) throw new Error('SONDA: la escritura del candado falla');
        cuenta.escriturasCandadoHechas += 1;
      }
      Object.assign(presupuesto, data); return presupuesto;
    },
  },
  invoice: {
    findMany: async ({ where }) => {
      if (factura.status !== 'pending') return [];
      if ('reminder7SentAt' in where) return factura.reminder7SentAt === null && factura.createdAt <= where.createdAt.lte ? [factura] : [];
      if ('reminder14SentAt' in where) return factura.reminder14SentAt === null && factura.createdAt <= where.createdAt.lte ? [factura] : [];
      return [];
    },
    update: async ({ data }) => {
      if ('reminder7SentAt' in data || 'reminder14SentAt' in data) {
        cuenta.escriturasCandadoPedidas += 1;
        if (fallaCandado) throw new Error('SONDA: la escritura del candado falla');
        cuenta.escriturasCandadoHechas += 1;
      }
      Object.assign(factura, data); return factura;
    },
  },
  charge: { findUnique: async () => ({ id: 700, receiptToken: 'tokrecibo', merchantId: 7 }), findFirst: async () => ({ id: 700, receiptToken: 'tokrecibo', merchantId: 7 }) },
  customer: { findMany: async (a) => (a && a.where && a.where.waOptOut === true ? [] : [cliente]), findFirst: async (a) => (a && a.where && a.where.waOptOut === true ? null : cliente), findUnique: async () => cliente },
  merchant: { findUnique: async () => merchant, findFirst: async () => merchant },
  whatsAppMessage: {
    create: async ({ data }) => {
      cuenta.registroPedidas += 1;
      if (data.status === 'sent') { cuenta.salieron = (cuenta.salieron || 0) + 1; if (data.waMessageId == null) cuenta.sinId = (cuenta.sinId || 0) + 1; }
      if (fallaRegistro) throw new Error('SONDA: la escritura del registro de WhatsApp falla');
      cuenta.registroHechas += 1;
      waLog.push({ ...data, createdAt: new FakeDate() }); return { id: waLog.length };
    },
    count: async ({ where }) => waLog.filter((r) =>
      r.merchantId === where.merchantId && r.type === where.type
      && (!where.customerId || r.customerId === where.customerId)
      && (!where.waMessageId || r.waMessageId != null)
      && r.createdAt >= where.createdAt.gte).length,
    findFirst: async () => null, // sin entrante: la ventana de 24 h esta cerrada -> plantilla
  },
};
global.prisma = new Proxy({}, { get: (_, m) => {
  if (m === '$transaction') return async (f) => (typeof f === 'function' ? f(global.prisma) : Promise.all(f));
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => (modelos[m] && modelos[m][met]) || porDefecto[met] });
} });

const silencio = () => {};
const logs = { error: [], warn: [] };
console.error = (...a) => logs.error.push(a.join(' '));
console.warn = (...a) => logs.warn.push(a.join(' '));
const hablar = console.log; console.log = silencio;

const wa = require(path.join(dist, 'integrations/whatsapp.js'));
const dry = require(path.join(dist, 'integrations/whatsapp.js'));
// cuantos mensajes SALIERON: el modo dry-run los apunta; se cuenta por el resultado ok de la puerta real
let salieron = 0;
for (const fn of ['sendWhatsAppTemplate']) {
  const real = wa[fn];
  Object.defineProperty(wa, fn, { configurable: true, enumerable: true, writable: true, value: real });
}

(async () => {
  let pasadas = 0; const porPasada = [];
  const enviadasDry = () => {
    // el propio modulo guarda lo que habria mandado a Meta en dry-run
    const d = wa.dryRunSent || wa.getDryRunSent || null;
    return typeof d === 'function' ? d().length : null;
  };
  if (sonda === 'presupuesto') {
    const { sendPendingReminders } = require(path.join(dist, 'modules/quotes/domain/reminder.service.js'));
    pasadas = 48; // el cron corre cada hora: 48 pasadas = 2 dias
    for (let i = 0; i < pasadas; i += 1) { desfaseMs = i * 3600000; const a = cuenta.salieron || 0; await sendPendingReminders(); await new Promise((r) => setImmediate(r)); porPasada.push((cuenta.salieron || 0) - a); }
  } else if (sonda === 'factura') {
    const { sendInvoicePaymentReminders } = require(path.join(dist, 'modules/billing/domain/invoiceReminder.service.js'));
    pasadas = 30; // el cron corre una vez al dia: 30 pasadas = 30 dias
    for (let i = 0; i < pasadas; i += 1) { desfaseMs = i * 86400000; const a = cuenta.salieron || 0; await sendInvoicePaymentReminders(); await new Promise((r) => setImmediate(r)); porPasada.push((cuenta.salieron || 0) - a); }
  } else if (sonda === 'tope') {
    pasadas = 10; // diez plantillas al MISMO cliente el MISMO dia; el tope por cliente y dia es 3
    const { buildQuoteDecision } = require(path.join(dist, 'integrations/whatsappTemplates.js'));
    for (let i = 0; i < pasadas; i += 1) {
      const tpl = buildQuoteDecision({ customerName: 'Cliente Sonda', businessName: 'Taller Sonda', amount: '100,00 €', quoteToken: 'tokdecision', quoteNumber: 12, total: '100,00 €', token: 'tokdecision' });
      const r = await wa.sendWhatsAppTemplate({ to: cliente.phone, merchantId: 7, ...tpl, log: { customerId: 50, relatedType: 'quote', relatedId: 900 } });
      await new Promise((res) => setImmediate(res));
      porPasada.push(r.ok ? 'ok' : (r.reason || r.error));
    }
  }
  const bloqueos = logs.warn.concat(logs.error).filter((l) => /BLOQUEADO/.test(l)).length;
  hablar(JSON.stringify({ sonda, variante, pasadas,
    plantillasQueSalieron: cuenta.salieron || 0, sinIdDeMensaje: cuenta.sinId || 0, llamadasAlRegistro: cuenta.registroPedidas, filasQueQuedaron: cuenta.registroHechas,
    candadoPedido: cuenta.escriturasCandadoPedidas, candadoEscrito: cuenta.escriturasCandadoHechas,
    bloqueosPorTope: bloqueos, enDryRun: enviadasDry(), porPasada: porPasada.join(',') }));
  const otros = logs.error.filter((l) => !/SONDA|BLOQUEADO|omitido|error marcando|error 7d|error 14d/.test(l));
  if (otros.length) hablar('  otros errores (' + otros.length + '): ' + [...new Set(otros.map((l) => l.slice(0, 160)))].slice(0, 4).join(' || '));
})().catch((e) => { hablar('SONDA ROTA: ' + (e && e.stack || e)); process.exit(2); });

// tests/scrum1732c-escritores-invoice-payments.test.mjs — SCRUM-1732 opción A, PR-1 (c.21926 §②, c.21928)
//
// Sin gate: ni BD, ni red, ni Meta. EJECUTA los escritores REALES de `dist/` contra una base en
// memoria CON ESTADO que conoce `invoicePayment` (el único `(invoice_id, charge_id)` y el de
// `anula_id` incluidos), y mira la FILA que cada uno apunta en `invoice_payments`:
//
//   ① `/webhooks/psp`, la factura enlazada al cobro (marcado robusto, P0-3);
//   ② `/webhooks/psp`, la factura que devuelve `ensureInvoiceForCharge` (AUTO_INVOICE_ON_PAID);
//   ③ `confirm-bizum` con IMPORTE declarado (lo reenvía a psp con `fecha_origen`) y su texto 3;
//   ④ el aviso de Mercado Pago (`mpWebhook.routes`), con el importe que dice MP;
//   ⑤ `/garantia`: 409 sobre un cobro sin cobrar y 409 con el texto 7 si cobrado + retenido ≠ total;
//   ⑥ `/garantia/liberar` con FECHA declarada: fila `liberacion_garantia` con el `invoice_id`, texto 5;
//   ⑦ el marcado a mano (`updateInvoiceStatusAdmin`) y su des-pagar (fila de anulación, c.21928 ⑤);
//   ⑧ `/bulk-paid`: una fila por factura marcada;
//   ⑨ `/invoice/:id/paid-webhook`: NO se retira (scrum1455b/c miden más que ella), apunta su fila (c.21928 ⑥).
//
// ROJO PRIMERO: cada caso cae con el código de `main` (sin la tabla, ningún escritor apunta nada) y
// con su mutación de `MUTACIONES_QUE_ME_TUMBAN`. Los textos que se comparan son los FIRMADOS en
// SCRUM-1732 c.21928, copiados de Jira; el test los lee de las constantes exportadas Y del literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import './_envio-doblado.mjs'; // por su efecto: WHATSAPP_DRY_RUN=1 antes de cargar `dist/`
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/billing/app/routes/psp.routes.ts',
    de: '          await cobroDeFactura(linkedInvoice.id); // SCRUM-1732',
    a: '          // mutado',
    cae: 'SCRUM-1732c · ① psp, factura enlazada: apunta 950 con la fecha del cobro',
  },
  {
    fichero: 'src/modules/billing/app/routes/psp.routes.ts',
    de: '        importe: Number(body.amount ?? charge.amount),',
    a: '        importe: Number(charge.amount),',
    cae: 'SCRUM-1732c · ① psp, factura enlazada: apunta 950 con la fecha del cobro',
  },
  {
    fichero: 'src/modules/billing/app/routes/psp.routes.ts',
    de: '            await cobroDeFactura(invoiceId); // SCRUM-1732',
    a: '            // mutado',
    cae: 'SCRUM-1732c · ② psp, factura de ensureInvoiceForCharge: apunta su fila',
  },
  {
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '      amount: importeRecibido.importe, // SCRUM-1732: lo que entró, no lo pedido',
    a: '      amount: Number(charge.amount),',
    cae: 'SCRUM-1732c · ③ confirm-bizum con importe declarado: reenvía 950 y origen declarada',
  },
  {
    fichero: 'src/modules/billing/app/routes/mpWebhook.routes.ts',
    de: '          importe: Number(payment.amount ?? updated.amount),',
    a: '          importe: Number(updated.amount),',
    cae: 'SCRUM-1732c · ④ Mercado Pago: apunta el importe que dice MP, origen aviso',
  },
  {
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: "    if (charge.status !== 'paid') return res.status(409).json({ error: 'charge_not_paid' });",
    a: '    // mutado',
    cae: 'SCRUM-1732c · ⑤ /garantia: 409 sobre un cobro sin cobrar',
  },
  {
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '    if (cobradoC + (aCentimos(split.importeRetenido) ?? NaN) !== aCentimos(total)) {',
    a: '    if (false as boolean) {',
    cae: 'SCRUM-1732c · ⑤ /garantia: cobrado + retenido ≠ total da 409 con el texto 7 firmado',
  },
  {
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: '    const ahora = fecha.fecha;',
    a: '    const ahora = new Date();',
    cae: 'SCRUM-1732c · ⑥ /garantia/liberar con fecha declarada: fila liberacion_garantia con invoice_id',
  },
  {
    fichero: 'src/modules/system/invoiceAdmin.ts',
    de: "    } else if (status === 'pending' && existing.status === 'paid') {\n      await anularCobrosDeFactura(",
    a: "    } else if (false as boolean) {\n      await anularCobrosDeFactura(",
    cae: 'SCRUM-1732c · ⑦ marcado a mano: fila por el total, y des-pagar la anula sin borrar',
  },
  {
    fichero: 'src/modules/invoicing/app/routes/invoice.routes.ts',
    de: "      importe: Number(updated.total), fechaCobro: updated.paidAt ?? now, fechaOrigen: 'aviso', metodo: null, tipo: 'cobro',",
    a: "      importe: 0.01, fechaCobro: updated.paidAt ?? now, fechaOrigen: 'aviso', metodo: null, tipo: 'cobro',",
    cae: 'SCRUM-1732c · ⑨ /invoice/:id/paid-webhook: apunta su fila por el total (c.21928 ⑥)',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '    if (aMarcar.length) {',
    a: '    if (false as boolean) {',
    cae: 'SCRUM-1732c · ⑧ /bulk-paid: una fila por factura marcada, por el total',
  },
];

// ── La base en memoria CON ESTADO ────────────────────────────────────────────────────────────
const M = 1732;
const CLIENTE = 3;
const ESCRIBE = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const escalares = (data) => Object.fromEntries(Object.entries(data || {})
  .filter(([, v]) => !(v && typeof v === 'object' && !(v instanceof Date) && ('create' in v || 'connect' in v))));
const errorDe = (code, msg) => Object.assign(new Error(msg), { code });

const casaValor = (v, cond) => {
  if (cond === undefined) return true;
  if (cond === null || typeof cond !== 'object' || cond instanceof Date) {
    return cond instanceof Date ? v instanceof Date && v.getTime() === cond.getTime() : v === cond;
  }
  if ('not' in cond) return v !== cond.not;
  if (Array.isArray(cond.in)) return cond.in.includes(v);
  if (Array.isArray(cond.notIn)) return !cond.notIn.includes(v);
  return true;
};
const casaFila = (f, w = {}) => {
  for (const [k, cond] of Object.entries(w)) {
    if (k === 'OR') { if (!cond.some((o) => casaFila(f, o))) return false; continue; }
    if (k === 'anuladaPor') continue; // lo resuelve `invoicePayment.findMany`
    if (!casaValor(f[k], cond)) return false;
  }
  return true;
};

export function banco({ estadoCobro = 'pending', amount = '1000.00', chargeIdEnFactura = 1732, factura = {} } = {}) {
  const st = {
    charges: new Map([[1732, {
      id: 1732, merchantId: M, customerId: CLIENTE, status: estadoCobro, amount, currency: 'EUR',
      method: 'bizum_manual', reference: null, paidAt: estadoCobro === 'paid' ? new Date('2026-03-31T10:00:00Z') : null,
      intentId: null, retencionGarantiaPorcentaje: null, retencionGarantiaImporte: null,
      retencionGarantiaLiberacion: null, retencionGarantiaCobrada: null,
    }]]),
    invoices: new Map([[1, {
      id: 1, merchantId: M, number: 'F-1732', type: 'F1', status: 'pending', total: '1000.00', customerId: CLIENTE,
      chargeId: chargeIdEnFactura, quoteId: null, paidAt: null, paidVia: null, ...factura,
    }]]),
    pagos: [],
    siguienteCharge: 1733,
  };
  const chargeModel = {
    async findUnique({ where }) { const c = st.charges.get(where.id); return c ? { ...c, customer: null, merchant: { timezone: 'Europe/Madrid' } } : null; },
    async findFirst({ where }) {
      const c = st.charges.get(where.id);
      if (!c || !casaFila(c, { merchantId: where.merchantId })) return null;
      return { ...c, merchant: { timezone: 'Europe/Madrid', country: 'ES', flags: { BIZUM_MANUAL_ENABLED: true } }, customer: null };
    },
    async update({ where, data }) {
      const c = st.charges.get(where.id);
      if (!c || !casaFila(c, { status: where.status })) throw errorDe('P2025', 'Record to update not found.');
      Object.assign(c, escalares(data));
      return { ...c, customer: null, merchant: null };
    },
    async create({ data }) { const c = { id: st.siguienteCharge++, ...escalares(data) }; st.charges.set(c.id, c); return { ...c }; },
    async findMany({ where } = {}) { return [...st.charges.values()].filter((c) => casaFila(c, where)).map((c) => ({ ...c })); },
  };
  const invoiceModel = {
    async findFirst({ where } = {}) { const f = [...st.invoices.values()].find((x) => casaFila(x, where)); return f ? { ...f } : null; },
    async findUnique({ where } = {}) { const f = st.invoices.get(where.id); return f && casaFila(f, where) ? { ...f } : null; },
    async findMany({ where } = {}) { return [...st.invoices.values()].filter((x) => casaFila(x, where)).map((x) => ({ ...x })); },
    async update({ where, data }) {
      const f = [...st.invoices.values()].find((x) => casaFila(x, where));
      if (!f) throw errorDe('P2025', 'Record to update not found.');
      Object.assign(f, escalares(data));
      return { ...f };
    },
    async updateMany({ where, data }) {
      const fs = [...st.invoices.values()].filter((x) => casaFila(x, where));
      for (const f of fs) Object.assign(f, escalares(data));
      return { count: fs.length };
    },
    async count({ where } = {}) { return [...st.invoices.values()].filter((x) => casaFila(x, where)).length; },
  };
  const invoicePayment = {
    async create({ data }) {
      if (data.chargeId != null && st.pagos.some((p) => p.invoiceId === data.invoiceId && p.chargeId === data.chargeId)) {
        throw errorDe('P2002', 'Unique constraint failed on (invoice_id, charge_id)');
      }
      if (data.anulaId != null && st.pagos.some((p) => p.anulaId === data.anulaId)) throw errorDe('P2002', 'Unique constraint failed on (anula_id)');
      const fila = { id: st.pagos.length + 1, anulaId: null, ...data, importe: String(Number(data.importe).toFixed(2)) };
      st.pagos.push(fila);
      return { ...fila };
    },
    async findMany({ where = {} } = {}) {
      return st.pagos.filter((p) => casaFila(p, where)
        && (where.anuladaPor !== null || !st.pagos.some((a) => a.anulaId === p.id))).map((p) => ({ ...p }));
    },
  };
  const conocidos = {
    charge: chargeModel, invoice: invoiceModel, invoicePayment,
    merchant: {
      async findUnique() { return { id: M, timezone: 'Europe/Madrid', country: 'ES', flags: {} }; },
      async findFirst() { return { id: M, timezone: 'Europe/Madrid', country: 'ES', flags: {} }; },
    },
    quote: { async findFirst() { return null; }, async findMany() { return []; } },
  };
  const otro = new Proxy({}, {
    get: (_t, metodo) => async () => {
      if (ESCRIBE.has(String(metodo))) return {};
      if (metodo === 'findMany') return [];
      if (metodo === 'count') return 0;
      return null;
    },
  });
  const prisma = new Proxy({}, {
    get: (_t, prop) => {
      const n = String(prop);
      if (n === '$transaction') return async (arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
      if (n === 'then') return undefined;
      return conocidos[n] ?? otro;
    },
  });
  return { prisma, st };
}

// ── Montaje: UNA carga de `dist/` y una base que se cambia por caso ───────────────────────────
let actual = banco();
const prismaVivo = new Proxy({}, { get: (_t, p) => actual.prisma[p] });
const poner = (r, exports) => { const f = rutaDe(r); requiere.cache[f] = { id: f, filename: f, loaded: true, exports }; };
poner('dist/core/db/prisma.js', { prisma: prismaVivo });
poner('dist/lib/email.js', { sendInvoiceEmail: async () => {} });
let facturaQueAsegura = null;
poner('dist/lib/invoicing.js', {
  ensureInvoiceForCharge: async () => { if (!facturaQueAsegura) throw new Error('SCRUM-1732c: sin factura'); return { ...facturaQueAsegura }; },
  ensureChargeReceiptToken: async () => 'tok_1732c',
});
let pagoMp = null;
poner('dist/integrations/mercadopago.js', { verifyMpWebhookSignature: () => true, getMpPayment: async () => ({ ...pagoMp }) });
const axios = requiere('axios');
const reenvios = [];
axios.post = async (url, cuerpo) => { reenvios.push({ url, cuerpo }); return { status: 200, data: { ok: true } }; };

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const handleDe = (mod, ruta) => {
  const r = mod.default || mod;
  return r.stack?.find((l) => l.route?.path === ruta && l.route.methods.post)?.route.stack.at(-1).handle ?? null;
};
const psp = handleDe(requiere(rutaDe('dist/modules/billing/app/routes/psp.routes.js')), '/');
const mp = handleDe(requiere(rutaDe('dist/modules/billing/app/routes/mpWebhook.routes.js')), '/');
const chargesAdminMod = requiere(rutaDe('dist/modules/billing/app/routes/chargesAdmin.routes.js'));
const invoicesAdmin = requiere(rutaDe('dist/modules/system/app/routes/invoicesAdmin.routes.js'));
const bulkPaid = (invoicesAdmin.default || invoicesAdmin).stack?.find((l) => l.route?.path === '/bulk-paid' && l.route.methods.post)?.route.stack.at(-1).handle ?? null;
const { updateInvoiceStatusAdmin } = requiere(rutaDe('dist/modules/system/invoiceAdmin.js'));
const paidWebhook = handleDe(requiere(rutaDe('dist/modules/invoicing/app/routes/invoice.routes.js')), '/:id/paid-webhook');

async function llamar(handle, req) {
  let salida = null;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(x) { salida = x; return this; } };
  await handle(req, res, (e) => { if (e) throw e; });
  return { status: res.statusCode, cuerpo: salida };
}
function peticion(puerto, url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: puerto, path: url, method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      let data = ''; res.setEncoding('utf8'); res.on('data', (t) => { data += t; });
      res.on('end', () => { let c = null; try { c = JSON.parse(data); } catch { /* null */ } resolve({ status: res.statusCode, cuerpo: c }); });
    });
    req.on('error', reject); req.end(payload);
  });
}
async function pedirAdmin(url, body) {
  const express = requiere('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: M })); next(); });
  app.use('/admin/charges', chargesAdminMod.default || chargesAdminMod);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { return await peticion(server.address().port, url, body); } finally { await new Promise((r) => server.close(r)); }
}
async function conConfig(cambios, fn) {
  const antes = Object.fromEntries(Object.keys(cambios).map((k) => [k, config[k]]));
  Object.assign(config, cambios);
  try { return await fn(); } finally { Object.assign(config, antes); }
}
const webhookBizum = (amount, extra = {}) => ({ event: 'payment.confirmed', charge_id: 1732, method: 'bizum_manual',
  bank_ref: 'b-1732c', amount, currency: 'EUR', ts: '2026-03-31', ...extra });
const resumen = (st) => JSON.stringify(st.pagos.map(({ id, invoiceId, chargeId, importe, tipo, fechaOrigen, anulaId }) => ({ id, invoiceId, chargeId, importe, tipo, fechaOrigen, anulaId })));

// Los textos FIRMADOS (c.21928), copiados de Jira byte a byte.
const FIRMADO_3 = (c, t) => `✓ Bizum confirmado: has recibido ${c} de ${t}.`;
const FIRMADO_5 = (i, n) => `Garantía cobrada: ${i} de la factura ${n}.`;
const FIRMADO_7 = 'Lo cobrado más lo retenido no suma el total de la factura. Revisa el importe recibido antes de declarar la garantía.';

// ── SUELO ───────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1732c · SUELO: las cinco bocas compiladas están montadas y el banco hace cumplir los dos únicos', async () => {
  assert.ok(psp && mp && bulkPaid && typeof updateInvoiceStatusAdmin === 'function', '🔴 CIEGO: falta una boca en dist/');
  const { prisma, st } = banco();
  await prisma.invoicePayment.create({ data: { invoiceId: 1, chargeId: 9, importe: 1 } });
  await assert.rejects(prisma.invoicePayment.create({ data: { invoiceId: 1, chargeId: 9, importe: 1 } }), (e) => e.code === 'P2002');
  await prisma.invoicePayment.create({ data: { invoiceId: 1, chargeId: null, importe: 1 } });
  await prisma.invoicePayment.create({ data: { invoiceId: 1, chargeId: null, importe: 1, anulaId: 1 } });
  await assert.rejects(prisma.invoicePayment.create({ data: { invoiceId: 1, chargeId: null, importe: 1, anulaId: 1 } }), (e) => e.code === 'P2002');
  assert.equal(st.pagos.length, 3);
  assert.equal((await prisma.invoicePayment.findMany({ where: { invoiceId: 1, anuladaPor: null } })).length, 2, 'la fila anulada no sale viva');
});

// ── ① y ② · el webhook psp ──────────────────────────────────────────────────────────────────

test('SCRUM-1732c · ① psp, factura enlazada: apunta 950 con la fecha del cobro', async () => {
  actual = banco();
  const r = await llamar(psp, { body: webhookBizum(950) });
  const { st } = actual;
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal(st.invoices.get(1).status, 'paid', 'V1: la factura sigue pasando a paid con el primer cobro');
  assert.equal(st.pagos.length, 1, `🔴 filas: ${resumen(st)}`);
  const [f] = st.pagos;
  assert.deepEqual({ inv: f.invoiceId, ch: f.chargeId, imp: f.importe, tipo: f.tipo, origen: f.fechaOrigen, metodo: f.metodo, m: f.merchantId },
    { inv: 1, ch: 1732, imp: '950.00', tipo: 'cobro', origen: 'aviso', metodo: 'bizum_manual', m: M });
  assert.equal(f.fechaCobro.getTime(), st.charges.get(1732).paidAt.getTime(), 'la fila lleva la fecha del cobro, no el reloj');
  assert.equal(f.fechaCobro.toISOString().slice(0, 7), '2026-03');
  assert.equal(String(st.charges.get(1732).amount), '1000.00', 'c.21928 ②: Charge.amount sigue siendo lo pedido');
  // Un origen declarado por quien llama (confirm-bizum) se respeta; uno fuera del conjunto, no.
  actual = banco();
  await llamar(psp, { body: webhookBizum(950, { fecha_origen: 'declarada' }) });
  assert.equal(actual.st.pagos[0]?.fechaOrigen, 'declarada');
  actual = banco();
  await llamar(psp, { body: webhookBizum(950, { fecha_origen: 'inventado' }) });
  assert.equal(actual.st.pagos[0]?.fechaOrigen, 'aviso');
});

test('SCRUM-1732c · ② psp, factura de ensureInvoiceForCharge: apunta su fila', async () => {
  actual = banco({ chargeIdEnFactura: null });
  facturaQueAsegura = { id: 1, status: 'pending' };
  try {
    await conConfig({ AUTO_INVOICE_ON_PAID: true, AUTO_EMAIL_INVOICE_ON_PAID: false }, () => llamar(psp, { body: webhookBizum(1000) }));
  } finally { facturaQueAsegura = null; }
  const { st } = actual;
  assert.equal(st.invoices.get(1).status, 'paid', 'CIEGO: el camino de ensureInvoiceForCharge no marcó la factura');
  assert.equal(st.pagos.length, 1, `🔴 filas: ${resumen(st)}`);
  assert.deepEqual([st.pagos[0].invoiceId, st.pagos[0].chargeId, st.pagos[0].importe], [1, 1732, '1000.00']);
});

test('SCRUM-1732c · ①+② con la misma factura por los dos caminos: UNA fila (el único)', async () => {
  actual = banco();
  facturaQueAsegura = { id: 1, status: 'pending' };
  try {
    await conConfig({ AUTO_INVOICE_ON_PAID: true, AUTO_EMAIL_INVOICE_ON_PAID: false }, () => llamar(psp, { body: webhookBizum(950) }));
  } finally { facturaQueAsegura = null; }
  assert.equal(actual.st.pagos.length, 1, `🔴 el mismo cobro se apuntó dos veces: ${resumen(actual.st)}`);
});

// ── ③ · confirm-bizum ──────────────────────────────────────────────────────────────────────

test('SCRUM-1732c · ③ confirm-bizum con importe declarado: reenvía 950 y origen declarada', async () => {
  actual = banco();
  reenvios.length = 0;
  const r = await pedirAdmin('/admin/charges/1732/confirm-bizum', { importe: 950, fecha: '2026-03-31' });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  assert.equal(reenvios.length, 1, 'CIEGO: confirm-bizum no reenvió a psp');
  assert.equal(reenvios[0].cuerpo.amount, 950, `🔴 reenvió ${reenvios[0].cuerpo.amount}: lo pedido, no lo que entró`);
  assert.equal(reenvios[0].cuerpo.fecha_origen, 'declarada');
  assert.equal(r.cuerpo.importe_recibido, 950);
  const { formatMoneyEs } = requiere(rutaDe('dist/core/utils/utils.js'));
  const texto3 = FIRMADO_3(formatMoneyEs(950, 'EUR'), formatMoneyEs('1000.00', 'EUR'));
  assert.equal(r.cuerpo.message, texto3, 'texto 3 firmado (c.21928), literal');
  assert.equal((chargesAdminMod.TEXTO_BIZUM_PARCIAL)(formatMoneyEs(950, 'EUR'), formatMoneyEs('1000.00', 'EUR')), texto3);
});

test('SCRUM-1732c · ③ confirm-bizum: sin importe, lo pedido y sin texto parcial; más de lo pedido, 400', async () => {
  actual = banco();
  reenvios.length = 0;
  const entero = await pedirAdmin('/admin/charges/1732/confirm-bizum', {});
  assert.equal(entero.status, 200, JSON.stringify(entero.cuerpo));
  assert.equal(reenvios[0]?.cuerpo.amount, 1000);
  assert.equal(reenvios[0]?.cuerpo.fecha_origen, 'marcado');
  assert.equal(entero.cuerpo.message, undefined, 'el cobro entero conserva el aviso de siempre');
  for (const importe of [1000.01, 0, -5, 'mucho']) {
    actual = banco();
    reenvios.length = 0;
    const r = await pedirAdmin('/admin/charges/1732/confirm-bizum', { importe });
    assert.deepEqual([r.status, r.cuerpo?.error, reenvios.length], [400, 'importe_invalido', 0], `importe ${importe}`);
  }
});

// ── ④ · Mercado Pago ───────────────────────────────────────────────────────────────────────

test('SCRUM-1732c · ④ Mercado Pago: apunta el importe que dice MP, origen aviso', async () => {
  actual = banco({ chargeIdEnFactura: null });
  facturaQueAsegura = { id: 1, status: 'pending' };
  pagoMp = { status: 'approved', externalReference: 'charge_1732', amount: 950, currency: 'EUR', method: 'card' };
  try {
    await conConfig({ AUTO_INVOICE_ON_PAID: true, AUTO_EMAIL_INVOICE_ON_PAID: false, MP_WEBHOOK_SECRET: 'relleno', MP_ACCESS_TOKEN: 'relleno' },
      () => llamar(mp, { body: { type: 'payment', data: { id: 'mp-1732' } }, headers: { 'x-signature': 's', 'x-request-id': 'r' } }));
  } finally { facturaQueAsegura = null; }
  const { st } = actual;
  assert.equal(st.invoices.get(1).status, 'paid', 'CIEGO: MP no marcó la factura');
  assert.equal(st.pagos.length, 1, `🔴 filas: ${resumen(st)}`);
  assert.deepEqual([st.pagos[0].importe, st.pagos[0].fechaOrigen, st.pagos[0].tipo, st.pagos[0].chargeId, st.pagos[0].metodo],
    ['950.00', 'aviso', 'cobro', 1732, 'card']);
});

// ── ⑤ y ⑥ · la garantía ────────────────────────────────────────────────────────────────────

test('SCRUM-1732c · ⑤ /garantia: 409 sobre un cobro sin cobrar', async () => {
  actual = banco({ estadoCobro: 'pending' });
  const r = await pedirAdmin('/admin/charges/1732/garantia', { total: 1000, porcentaje: 5, liberacion: '2026-11-01' });
  assert.deepEqual([r.status, r.cuerpo?.error], [409, 'charge_not_paid']);
  assert.equal(actual.st.charges.get(1732).retencionGarantiaPorcentaje, null, 'no se declaró nada');
});

test('SCRUM-1732c · ⑤ /garantia: cobrado + retenido ≠ total da 409 con el texto 7 firmado', async () => {
  // 950 apuntados + 5 % de 1.000 = 1.000 → se declara.
  actual = banco();
  await llamar(psp, { body: webhookBizum(950) });
  const ok = await pedirAdmin('/admin/charges/1732/garantia', { total: 1000, porcentaje: 5, liberacion: '2026-11-01' });
  assert.equal(ok.status, 200, `control: 950 + 50 = 1.000 tiene que pasar · ${JSON.stringify(ok.cuerpo)}`);
  // 900 apuntados + 50 ≠ 1.000 → 409.
  actual = banco();
  await llamar(psp, { body: webhookBizum(900) });
  const mal = await pedirAdmin('/admin/charges/1732/garantia', { total: 1000, porcentaje: 5, liberacion: '2026-11-01' });
  assert.deepEqual([mal.status, mal.cuerpo?.error], [409, 'cobrado_mas_retenido_no_cuadra'], JSON.stringify(mal.cuerpo));
  assert.equal(mal.cuerpo.message, FIRMADO_7);
  assert.equal(chargesAdminMod.TEXTO_GARANTIA_NO_CUADRA, FIRMADO_7);
  assert.equal(actual.st.charges.get(1732).retencionGarantiaPorcentaje, null, 'con 409 no se declaró nada');
  // Un cobro de antes de la tabla (sin filas) vale su `amount`: 1.000 + 50 ≠ 1.000 → 409.
  actual = banco({ estadoCobro: 'paid' });
  const viejo = await pedirAdmin('/admin/charges/1732/garantia', { total: 1000, porcentaje: 5, liberacion: '2026-11-01' });
  assert.equal(viejo.status, 409);
});

test('SCRUM-1732c · ⑥ /garantia/liberar con fecha declarada: fila liberacion_garantia con invoice_id', async () => {
  actual = banco();
  await llamar(psp, { body: webhookBizum(950) });
  const dec = await pedirAdmin('/admin/charges/1732/garantia', { total: 1000, porcentaje: 5, liberacion: '2026-11-01' });
  assert.equal(dec.status, 200, JSON.stringify(dec.cuerpo));
  // Una fecha futura no se acepta (patrón de confirm-bizum).
  const futura = await pedirAdmin('/admin/charges/1732/garantia/liberar', { method: 'bizum_manual', fecha: '2099-01-01' });
  assert.equal(futura.status, 400, 'una fecha futura no libera nada');
  assert.equal(actual.st.pagos.length, 1, 'con 400 no se apuntó nada');
  const lib = await pedirAdmin('/admin/charges/1732/garantia/liberar', { method: 'bizum_manual', concept: 'Liberación garantía F-1732', fecha: '2026-11-10' });
  assert.equal(lib.status, 200, JSON.stringify(lib.cuerpo));
  const { st } = actual;
  const fila = st.pagos.find((p) => p.tipo === 'liberacion_garantia');
  assert.ok(fila, `🔴 la liberación no apuntó su fila: ${resumen(st)}`);
  assert.deepEqual([fila.invoiceId, fila.chargeId, fila.importe, fila.fechaOrigen], [1, lib.cuerpo.chargeLiberacionId, '50.00', 'declarada']);
  assert.equal(new Date(lib.cuerpo.retencionGarantiaCobrada).getTime(), fila.fechaCobro.getTime());
  assert.equal(fila.fechaCobro.toISOString().slice(0, 10), '2026-11-10', 'la fecha declarada, no el reloj (hoy es otro día)');
  const { formatMoneyEs } = requiere(rutaDe('dist/core/utils/utils.js'));
  assert.equal(lib.cuerpo.message, FIRMADO_5(formatMoneyEs(50, 'EUR'), 'F-1732'), 'texto 5 firmado (c.21928), literal');
  // La tabla suma lo que vale la factura: 950 + 50.
  const suma = st.pagos.reduce((s, p) => s + Math.round(Number(p.importe) * 100), 0);
  assert.equal(suma, 100000);
});

// ── ⑦ · el marcado a mano ──────────────────────────────────────────────────────────────────

test('SCRUM-1732c · ⑦ marcado a mano: fila por el total, y des-pagar la anula sin borrar', async () => {
  actual = banco();
  await updateInvoiceStatusAdmin(1, 'paid', M);
  assert.equal(actual.st.invoices.get(1).status, 'paid', 'CIEGO: el marcado a mano no marcó');
  assert.equal(actual.st.pagos.length, 1, `🔴 filas: ${resumen(actual.st)}`);
  assert.deepEqual([actual.st.pagos[0].importe, actual.st.pagos[0].fechaOrigen, actual.st.pagos[0].chargeId], ['1000.00', 'marcado', 1732]);
  // Un justificante se des-paga: su fila se anula con otra (append-only, c.21928 ⑤).
  actual = banco({ factura: { type: 'JUST', number: 'J-1' } });
  await updateInvoiceStatusAdmin(1, 'paid', M, undefined, new Date('2026-03-31T10:00:00Z'));
  assert.equal(actual.st.pagos[0]?.fechaOrigen, 'declarada');
  await updateInvoiceStatusAdmin(1, 'pending', M);
  const { st } = actual;
  assert.equal(st.invoices.get(1).status, 'pending');
  assert.equal(st.pagos.length, 2, `🔴 des-pagar no dejó su fila de anulación: ${resumen(st)}`);
  assert.deepEqual([st.pagos[1].tipo, st.pagos[1].anulaId, st.pagos[1].importe, st.pagos[1].chargeId], ['anulacion', 1, '1000.00', null]);
  assert.equal(st.pagos[0].importe, '1000.00', 'la fila original sigue ahí');
});

// ── ⑧ · el lote ────────────────────────────────────────────────────────────────────────────

test('SCRUM-1732c · ⑧ /bulk-paid: una fila por factura marcada, por el total', async () => {
  actual = banco();
  actual.st.invoices.set(2, { id: 2, merchantId: M, number: 'F-2', type: 'F1', status: 'pending', total: '120.50', chargeId: null, paidAt: null });
  actual.st.invoices.set(9, { id: 9, merchantId: 999, number: 'F-9', type: 'F1', status: 'pending', total: '7.00', chargeId: null, paidAt: null });
  const r = await llamar(bulkPaid, { merchantId: M, userRole: 'admin', teamMemberId: null, body: { ids: [1, 2, 9], paidAt: '2026-03-31' }, headers: {}, ip: '127.0.0.1', socket: {} });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  const { st } = actual;
  assert.deepEqual([st.invoices.get(1).status, st.invoices.get(2).status, st.invoices.get(9).status], ['paid', 'paid', 'pending'], 'CIEGO: el lote no marcó lo esperado');
  assert.deepEqual(st.pagos.map((p) => [p.invoiceId, p.importe, p.fechaOrigen, p.merchantId]).sort(),
    [[1, '1000.00', 'declarada', M], [2, '120.50', 'declarada', M]], `🔴 filas: ${resumen(st)}`);
});

// ── ⑨ · paid-webhook ───────────────────────────────────────────────────────────────────────

test('SCRUM-1732c · ⑨ /invoice/:id/paid-webhook: apunta su fila por el total (c.21928 ⑥)', async () => {
  assert.ok(paidWebhook, 'CIEGO: no encuentro POST /:id/paid-webhook');
  actual = banco();
  const r = await llamar(paidWebhook, { params: { id: '1' }, body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
  const { st } = actual;
  assert.equal(st.invoices.get(1).status, 'paid', 'CIEGO: no marcó la factura');
  assert.deepEqual(st.pagos.map((p) => [p.invoiceId, p.chargeId, p.importe, p.fechaOrigen, p.tipo]), [[1, 1732, '1000.00', 'aviso', 'cobro']], `🔴 filas: ${resumen(st)}`);
});

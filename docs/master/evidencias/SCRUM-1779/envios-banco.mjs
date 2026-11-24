// docs/master/evidencias/SCRUM-1779/envios-banco.mjs — SCRUM-1779a, punto 4 (SOLO LECTURA)
//
// PREGUNTA: con un comercio ES NO-demo (id 5304), INVOICING_ES_ENABLED ON por merchant y SIF_ENABLED
// OFF, ¿QUÉ SALE HACIA FUERA al emitir y al cobrar una F1 sellada? WhatsApp al cliente, correo al
// cliente y las páginas públicas (/pay/invoice/:token, /recibo/:token).
//
// BANCO: el de vias-banco.mjs y pdf-banco.mjs (`tests/_banco-emision-con-estado.mjs`). Encima corre
// `dist/` tal cual. Lo que ESTE script intercepta, sólo en la memoria de este proceso:
//   · `node-fetch` (la llamada interna POST /charges de sendInvoicePaymentRequest): se apunta y el
//     cobro se crea en el banco. No sale a la red.
//   · `enviarPorResend` (dist/integrations/enviarCorreo.js): se apunta lo que se pasaría a Resend
//     (destinatario, asunto, html, adjuntos). No sale a la red. RESEND_API_KEY lleva un valor
//     FALSO para que email.service tome la rama de Resend (si no, escribe un .eml a disco).
//   · `sendWhatsAppWindowFirst` (exports de dist/integrations/whatsapp.js): se ENVUELVE para apuntar
//     los parámetros (texto de ventana, botón, plantilla) y se llama a la ORIGINAL, que corre con
//     WHATSAPP_DRY_RUN=1 (lo pone el banco): pasa J3/V0-2/J7/J6 y no llama a Meta.
//   · CONTROL POSITIVO: el buzón dry-run `globalThis.__waDryRunOutbox` lo llena whatsapp.ts por su
//     cuenta (no mi envoltorio). Si mi captura dice «plantilla» y el buzón está vacío, la captura es CIEGA.
//   · El PDF: generador REAL (como pdf-banco.mjs) para que el ADJUNTO del correo sea el documento real.
//
// Se lanza con el cwd EN EL TEMPORAL DEL SISTEMA (invoicesDir/outboxDir = <cwd>/storage).
delete process.env.SIF_ENABLED;
delete process.env.INVOICING_ES_ENABLED;
delete process.env.AUTO_INVOICE_ON_PAID;
delete process.env.AUTO_EMAIL_INVOICE_ON_PAID;
process.env.RESEND_API_KEY = 'falso-del-banco-sin-red';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  banco, prisma, reiniciar as reiniciarBanco, requiere, rutaDe, asentar, M_ES, CLIENTE,
} from '../../../../tests/_banco-emision-con-estado.mjs';
import { lineasDePdf } from '../../../../tests/_texto-del-pdf.mjs';
const textoPdf = (buf) => { const r = lineasDePdf(buf); if (!r?.ok) throw new Error('lector de PDF sin texto'); return r.lineas.map((l) => l.texto).join('\n'); };

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
if (path.resolve(process.cwd()).toLowerCase().startsWith(RAIZ.toLowerCase())) {
  process.stderr.write('Se lanza con el cwd FUERA del árbol (<cwd>/storage recibe PDF).\n');
  process.exit(2);
}

const salida = [];
const di = (...x) => { const l = x.join(' '); salida.push(l); process.stdout.write(l + '\n'); };
let fallos = 0;
const comprueba = (ok, texto) => { if (!ok) fallos++; di(`${ok ? 'OK  ' : 'FALLO'} ${texto}`); };
const voces = { log: console.log, warn: console.warn, error: console.error };
const avisos = [];
console.log = () => {}; console.warn = (...a) => avisos.push(a.map(String).join(' ')); console.error = (...a) => avisos.push(a.map(String).join(' '));

const FISCAL = /verifactu|veri\*factu|aeat|agencia tributaria|hacienda|verificable|\bqr\b|huella|rd 1007|sede electr/i;
const fiscales = (t) => String(t ?? '').split(/\n/).filter((l) => FISCAL.test(l)).map((l) => l.trim());

// ── Intercepciones, ANTES de cargar los servicios ──────────────────────────────────────────────
const fetchs = [];
const fServicio = rutaDe('dist/modules/billing/domain/invoiceWhatsApp.service.js');
const fNodeFetch = createRequire(fServicio).resolve('node-fetch');
const fetchFalso = async (url, opts = {}) => {
  const cuerpo = opts.body ? JSON.parse(opts.body) : null;
  fetchs.push({ url: String(url).replace(/^https?:\/\/[^/]+/, '<BASE_URL>'), metodo: opts.method, cuerpo });
  if (/\/charges$/.test(String(url)) && opts.method === 'POST') {
    const id = 900 + banco.tablas.charge.length + 1;
    banco.tablas.charge.push({
      id, merchantId: cuerpo.merchant_id, customerId: cuerpo.customer_id, amount: cuerpo.amount,
      currency: cuerpo.currency, concept: cuerpo.concept, status: 'pending', receiptToken: null,
      method: null, payMethods: cuerpo.pay_methods ?? null, createdAt: new Date(), expiresAt: null,
    });
    return { ok: true, status: 201, json: async () => ({ id }) };
  }
  return { ok: false, status: 599, json: async () => ({}) };
};
fetchFalso.default = fetchFalso;
requiere.cache[fNodeFetch] = { id: fNodeFetch, filename: fNodeFetch, loaded: true, exports: fetchFalso };

const pdfReal = requiere(rutaDe('dist/modules/invoicing/infra/pdf/pdf.service.js'));
requiere.cache[rutaDe('dist/lib/pdf.js')].exports = { generateInvoicePdf: pdfReal.generateInvoicePdf, generateQuotePdf: pdfReal.generateQuotePdf };

const correos = [];
const modCorreo = requiere(rutaDe('dist/integrations/enviarCorreo.js'));
modCorreo.enviarPorResend = async (c) => {
  correos.push({
    to: c.to, subject: c.subject, from: c.from, origen: c.origen, html: c.html,
    adjuntos: (c.adjuntos ?? []).map((a) => ({ filename: a.filename, bytes: Buffer.from(a.content, 'base64').length, buf: Buffer.from(a.content, 'base64') })),
  });
  return { enviado: true, acuse: { id: 'acuse-del-banco' } };
};

const wa = [];
const modWa = requiere(rutaDe('dist/integrations/whatsapp.js'));
const winFirstOriginal = modWa.sendWhatsAppWindowFirst;
modWa.sendWhatsAppWindowFirst = async (p) => {
  const r = await winFirstOriginal(p);
  wa.push({ to: p.to, merchantId: p.merchantId, windowText: p.windowText, windowCta: p.windowCta, template: p.template, log: p.log, resultado: { ok: r.ok, via: r.via, reason: r.reason } });
  return r;
};
globalThis.__waDryRunOutbox = [];

// El banco sólo resuelve relaciones de `charge`; los servicios piden merchant/customer en `invoice`.
const modInvoice = prisma.invoice;
const fuOriginal = modInvoice.findUnique;
modInvoice.findUnique = async (a = {}) => {
  const f = await fuOriginal({ where: a.where });
  if (!f || !a.include) return f;
  return {
    ...f,
    merchant: banco.tablas.merchant.find((x) => x.id === f.merchantId) ?? null,
    customer: banco.tablas.customer.find((x) => x.id === f.customerId) ?? null,
    rectifies: f.rectifiesId ? { number: banco.tablas.invoice.find((x) => x.id === f.rectifiesId)?.number ?? null } : null,
  };
};

const { allocateInvoiceNumber } = requiere(rutaDe('dist/modules/invoicing/domain/invoiceNumber.service.js'));
const { crearFacturaEmitida } = requiere(rutaDe('dist/modules/invoicing/domain/crearFacturaEmitida.js'));
const { congelarCliente } = requiere(rutaDe('dist/modules/invoicing/domain/clienteCongelado.js'));
const { congelarEmisorDesdeFicha } = requiere(rutaDe('dist/modules/invoicing/domain/emisorCongelado.js'));
const { sellarTrasEmision } = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { sendInvoicePaymentRequest } = requiere(fServicio);
const { sendInvoiceEmail } = requiere(rutaDe('dist/modules/messaging/domain/email.service.js'));
const { sendPaymentConfirmationInvoice } = requiere(rutaDe('dist/integrations/whatsappNotifications.js'));
const { ensureChargeReceiptToken } = requiere(rutaDe('dist/lib/invoicing.js'));

const TELEFONO = '+34600000000';
const CORREO = 'clienta@ejemplo.invalid';

function reiniciar({ conTelefono = true } = {}) {
  reiniciarBanco();
  const m = banco.tablas.merchant.find((x) => x.id === M_ES);
  Object.assign(m, { flags: { INVOICING_ES_ENABLED: true }, llevaLibrosPorSii: false, taxId: 'B27000001', defaultCurrency: 'EUR' });
  Object.assign(banco.tablas.customer[0], {
    merchantId: M_ES, taxId: '12345678Z', legalName: 'Clienta de prueba SL', address: 'Calle 1, Lugo', tipoDestinatario: null,
    phone: conTelefono ? TELEFONO : null, mobile: null, email: CORREO, waOptOut: false,
  });
  for (const a of [fetchs, correos, wa, globalThis.__waDryRunOutbox]) a.length = 0;
}

async function emitirF1() {
  const m = banco.tablas.merchant.find((x) => x.id === M_ES);
  const cliente = await congelarCliente(prisma, M_ES, CLIENTE);
  const emisor = congelarEmisorDesdeFicha(m);
  const inv = await prisma.$transaction(async (tx) => {
    const number = await allocateInvoiceNumber(tx, M_ES, { camino: 'factura_suelta', rectifying: false, actor: { tipo: 'propietario' } });
    return crearFacturaEmitida(tx, cliente, emisor, {
      merchantId: M_ES, customerId: CLIENTE, quoteId: null, number, type: 'F1', total: '121.00', currency: 'EUR',
      lines: [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }],
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', registerId: null,
    });
  });
  await sellarTrasEmision(inv, m, prisma);
  await asentar();
  return banco.tablas.invoice.find((f) => f.id === inv.id);
}

const ajenasWa = () => banco.ajenas.filter((x) => x.startsWith('whatsAppMessage.'));

// Llama a un router de Express con req/res de mentira. Devuelve { status, html, redirect }.
async function pagina(router, url) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      set(k, v) { this.headers[k] = v; return this; }, setHeader(k, v) { this.headers[k] = v; return this; },
      status(c) { this.statusCode = c; return this; },
      send(b) { resolve({ status: this.statusCode, html: String(b) }); return this; },
      redirect(c, u) { resolve({ status: typeof c === 'number' ? c : 302, redirect: typeof c === 'number' ? u : c }); return this; },
      type() { return this; }, end(b) { resolve({ status: this.statusCode, html: String(b ?? '') }); return this; },
      sendFile(p) { resolve({ status: this.statusCode, archivo: p }); return this; },
    };
    const req = { method: 'GET', url, originalUrl: url, path: url, query: {}, headers: {}, get: () => undefined, header: () => undefined };
    router.handle(req, res, (err) => resolve({ status: 'next', error: err ? String(err?.message || err) : null }));
  });
}

di('# SCRUM-1779a · punto 4 — lo que sale hacia fuera (banco, dist de origin/main)');
di(`# fecha: ${new Date().toISOString()} · comercio ES ${M_ES} · INVOICING_ES_ENABLED ON (merchant) · SIF_ENABLED sin variable (OFF)`);
di(`# cliente fabricado: teléfono ${TELEFONO} (dry-run, no sale), correo ${CORREO}`);
di('');

// ── 1 · EMITIR + PEDIR EL COBRO: sendInvoicePaymentRequest ─────────────────────────────────────
reiniciar();
const f1 = await emitirF1();
di(`## 1 · sendInvoicePaymentRequest(${f1.id}) — llamado por quotes.routes.ts:734, jobs.routes.ts:1694, invoicesAdmin.routes.ts:723`);
di(`F1 ${f1.number} vfEstado=${f1.vfEstado} huella=${f1.vfHash ? 'sí' : 'no'} qr=${String(f1.qrData).slice(0, 45)}…`);
const r1 = await sendInvoicePaymentRequest(f1.id);
await asentar();
di(`resultado: ${JSON.stringify({ ok: r1.ok, reason: r1.reason, chargeId: r1.chargeId, to: r1.to, payToken: r1.payToken ? '<token>' : null })}`);
di(`fetch internos: ${fetchs.length} → ${JSON.stringify(fetchs.map((x) => ({ url: x.url, metodo: x.metodo, concept: x.cuerpo?.concept, amount: x.cuerpo?.amount })))}`);
di(`WhatsApp (envoltorio): ${wa.length} intento(s)`);
for (const w of wa) {
  di(`  to=${w.to} vía=${w.resultado.via} ok=${w.resultado.ok} plantilla=${w.template.templateName}`);
  di(`  variables de la plantilla: ${JSON.stringify(w.template.components)}`.replace(/[0-9a-f]{32}/g, '<token>'));
  di(`  texto de ventana (si la ventana estuviese abierta): ${JSON.stringify(w.windowText)}`.replace(/[0-9a-f]{32}/g, '<token>'));
  di(`  botón de ventana: ${JSON.stringify(w.windowCta)}`.replace(/[0-9a-f]{32}/g, '<token>'));
  di(`  menciones fiscales en lo que sale: ${JSON.stringify(fiscales([w.windowText, w.windowCta?.bodyText, w.windowCta?.buttonText, JSON.stringify(w.template.components)].join('\n')))}`);
}
di(`buzón dry-run de whatsapp.ts (CONTROL): ${JSON.stringify(globalThis.__waDryRunOutbox)}`);
di(`J6/A3.2 — llamadas del sender a whatsAppMessage (tabla del tope): ${JSON.stringify(ajenasWa())}`);
comprueba(r1.ok === true, 'sendInvoicePaymentRequest devuelve ok');
comprueba(fetchs.length === 1 && /\/charges$/.test(fetchs[0].url), '1 llamada interna POST /charges');
comprueba(wa.length === 1 && wa[0].template.templateName === 'payment_request_es', '1 intento WhatsApp, plantilla payment_request_es');
comprueba(globalThis.__waDryRunOutbox.length === 1 && globalThis.__waDryRunOutbox[0].templateName === 'payment_request_es',
  'CONTROL POSITIVO: el buzón dry-run de whatsapp.ts tiene la misma plantilla (la captura no es ciega)');
comprueba(ajenasWa().includes('whatsAppMessage.count') && ajenasWa().includes('whatsAppMessage.create'),
  'el envío pasa por reservarPlantilla (count del tope J6/A3.2 + create de la reserva)');
comprueba(correos.length === 0, 'este momento NO manda correo');
const tokenPago = banco.tablas.charge[0]?.receiptToken;

// ── 2 · CONTROL NEGATIVO: cliente sin teléfono ─────────────────────────────────────────────────
reiniciar({ conTelefono: false });
const f1b = await emitirF1();
const r2 = await sendInvoicePaymentRequest(f1b.id);
await asentar();
di('');
di('## 2 · CONTROL NEGATIVO: el mismo envío con el cliente sin teléfono');
di(`resultado: ${JSON.stringify({ ok: r2.ok, reason: r2.reason })} · WhatsApp ${wa.length} · buzón ${globalThis.__waDryRunOutbox.length} · fetch ${fetchs.length}`);
comprueba(r2.reason === 'customer_missing_phone' && wa.length === 0 && globalThis.__waDryRunOutbox.length === 0, 'sin teléfono: 0 intentos (la captura distingue envío de no-envío)');

// ── 3 · CORREO DE LA FACTURA: sendInvoiceEmail ─────────────────────────────────────────────────
reiniciar();
const f1c = await emitirF1();
di('');
di(`## 3 · sendInvoiceEmail(${f1c.id}) — llamado por psp.routes.ts:86/:257 y mpWebhook.routes.ts:151 (si AUTO_INVOICE_ON_PAID y AUTO_EMAIL_INVOICE_ON_PAID), invoicesAdmin.routes.ts:783 (botón), dev.routes.ts:83`);
let r3, e3 = null;
try { r3 = await sendInvoiceEmail({ invoiceId: f1c.id, toEmail: CORREO, toName: 'Clienta de prueba', prisma }); } catch (e) { e3 = String(e?.message || e); }
await asentar();
di(`resultado: ${JSON.stringify(r3 ?? { error: e3 })}`);
di(`correos (Resend interceptado): ${correos.length}`);
for (const c of correos) {
  const texto = c.html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  di(`  to=${c.to} from=${c.from} origen=${c.origen}`);
  di(`  asunto: ${JSON.stringify(c.subject)}`);
  di(`  cuerpo (texto del html): ${JSON.stringify(texto)}`);
  di(`  menciones fiscales en asunto+cuerpo: ${JSON.stringify(fiscales(c.subject + '\n' + texto.replace(/\. /g, '.\n')))}`);
  for (const a of c.adjuntos) {
    const t = textoPdf(a.buf);
    di(`  adjunto: ${a.filename} · ${a.bytes} B · empieza por %PDF: ${a.buf.subarray(0, 4).toString() === '%PDF'}`);
    di(`  menciones fiscales en el ADJUNTO: ${JSON.stringify(fiscales(t).map((l) => l.replace(/[0-9A-F]{64}/g, '<huella>')))}`);
  }
}
comprueba(!e3 && correos.length === 1, '1 correo a Resend (interceptado)');
comprueba(correos[0]?.adjuntos.length === 1 && correos[0].adjuntos[0].filename === `${f1c.number}.pdf`, 'adjunta el PDF de la factura');
comprueba(fiscales(correos[0]?.subject + '\n' + correos[0]?.html).length === 0, 'asunto y cuerpo del correo sin menciones fiscales');
comprueba(fiscales(textoPdf(correos[0]?.adjuntos[0]?.buf ?? Buffer.alloc(0))).length > 0, 'el adjunto SÍ lleva menciones fiscales (el PDF de pdf-banco)');

// ── 4 · CONFIRMACIÓN DE PAGO POR WHATSAPP: sendPaymentConfirmationInvoice ──────────────────────
// Con los parámetros que pasa psp.routes.ts:327-342 (y mpWebhook.routes.ts ~:205-219).
reiniciar();
const f1d = await emitirF1();
banco.tablas.charge.push({ id: 950, merchantId: M_ES, customerId: CLIENTE, amount: 121, currency: 'EUR', concept: `Factura ${f1d.number}`, status: 'paid', receiptToken: null, createdAt: new Date() });
const rt = await ensureChargeReceiptToken(950, prisma);
const r4 = await sendPaymentConfirmationInvoice({
  toPhone: TELEFONO, customerName: 'Clienta de prueba', merchantId: M_ES, customerId: CLIENTE,
  amount: 121, currency: 'EUR', documentNumber: f1d.number, businessName: 'Fontanería de Lugo', chargeId: 950, receiptToken: rt,
});
await asentar();
di('');
di('## 4 · sendPaymentConfirmationInvoice — llamado por psp.routes.ts:327 y mpWebhook.routes.ts (al confirmarse el pago)');
di(`resultado: ${JSON.stringify(r4)} · WhatsApp ${wa.length} · buzón ${JSON.stringify(globalThis.__waDryRunOutbox)}`);
for (const w of wa) {
  di(`  to=${w.to} vía=${w.resultado.via} plantilla=${w.template.templateName}`);
  di(`  variables: ${JSON.stringify(w.template.components)}`.replace(/[0-9a-f]{32}/g, '<token>'));
  di(`  texto de ventana: ${JSON.stringify(w.windowText)}`.replace(/[0-9a-f]{32}/g, '<token>'));
  di(`  menciones fiscales: ${JSON.stringify(fiscales([w.windowText, w.windowCta?.bodyText, JSON.stringify(w.template.components)].join('\n')))}`);
}
di(`J6/A3.2: ${JSON.stringify(ajenasWa())}`);
comprueba(wa.length === 1 && globalThis.__waDryRunOutbox[0]?.templateName === 'payment_confirmation_invoice_es', '1 intento, plantilla payment_confirmation_invoice_es (captura y buzón coinciden)');

// ── 5 · PÁGINAS PÚBLICAS ───────────────────────────────────────────────────────────────────────
di('');
di('## 5 · páginas públicas (router de Express con req/res de mentira)');
const quitarHtml = (h) => String(h ?? '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&[a-z]+;/g, ' ').split('\n').map((l) => l.trim()).filter(Boolean);
for (const [nombre, fRouter, url, preparar] of [
  ['/pay/invoice/:token (cobro pendiente, la del botón de payment_request_es)', 'dist/modules/billing/app/routes/payInvoice.routes.js', '/invoice/', () => {
    reiniciar();
    return emitirF1().then(async (f) => { await sendInvoicePaymentRequest(f.id); await asentar(); return banco.tablas.charge[0].receiptToken; });
  }],
  ['/recibo/:token (cobro pagado, evento invoiced → la factura)', 'dist/modules/billing/app/routes/receipt.routes.js', '/', async () => {
    reiniciar();
    const f = await emitirF1();
    await sendInvoicePaymentRequest(f.id); await asentar();
    const ch = banco.tablas.charge[0];
    Object.assign(ch, { status: 'paid', paidAt: new Date() });
    banco.tablas.event.push({ id: 1, chargeId: ch.id, type: 'invoiced', payload: { invoice_id: f.id }, ts: new Date() });
    // el PDF existe en disco (lo genera el correo / el BO); se pinta para que el enlace aparezca.
    await requiere(rutaDe('dist/lib/invoicing.js')).ensureInvoicePdf(f.id, prisma);
    return ch.receiptToken;
  }],
]) {
  try {
    const tok = await preparar();
    const router = requiere(rutaDe(fRouter)).default;
    const p = await pagina(router, url + tok);
    const lineas = quitarHtml(p.html);
    di(`### ${nombre}`);
    di(`  status=${p.status}${p.redirect ? ` redirect=${p.redirect}` : ''}${p.error ? ` error=${p.error}` : ''} · ${lineas.length} líneas de texto`);
    di(`  texto visible: ${JSON.stringify(lineas.map((l) => l.replace(/[0-9a-f]{32}/g, '<token>')))}`);
    di(`  enlaces: ${JSON.stringify([...String(p.html ?? '').matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/[0-9a-f]{32}/g, '<token>')).filter((h) => !h.endsWith('.css')))}`);
    di(`  menciones fiscales: ${JSON.stringify(fiscales(lineas.join('\n')))}`);
    comprueba(p.status === 200 && lineas.length > 0, `${nombre.split(' ')[0]} pinta (control: no es una página vacía)`);
  } catch (e) {
    di(`### ${nombre}: NO EJECUTADA en el banco — ${String(e?.message || e).slice(0, 200)}`);
  }
}

di('');
di(`AVISOS del dist (${avisos.length}): ${avisos.length ? avisos.map((a) => a.slice(0, 160)).join(' | ') : '(ninguno)'}`);
di('');
di(fallos ? `RESULTADO: ${fallos} comprobación(es) FALLAN` : 'RESULTADO: todas las comprobaciones OK');
fs.writeFileSync(path.join(AQUI, 'envios-salida.txt'), salida.join('\n') + '\n');
Object.assign(console, voces);
process.exitCode = fallos ? 1 : 0;

import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';

const app = express();

// ================== Stripe ==================
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any })
  : null;

// Evitar 304 por ETag en páginas HTML que deben refrescarse
app.disable('etag');

/**
 * IMPORTANTE: El webhook de Stripe requiere RAW BODY para validar la firma.
 * Debe declararse ANTES de app.use(express.json()).
 */
if (stripe) {
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const secret = process.env.STRIPE_WEBHOOK_SECRET as string;
      if (!secret) return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');

      const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);

      // Mapeo → /webhooks/psp
      if (event.type === 'checkout.session.completed') {
        const s = event.data.object as Stripe.Checkout.Session;
        const chargeId = Number(s.metadata?.charge_id);
        if (Number.isInteger(chargeId)) {
          await axios.post(`${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/webhooks/psp`, {
            event: 'payment.confirmed',
            charge_id: chargeId,
            method: 'card:stripe',
            bank_ref: s.payment_intent || 'pi_unknown',
            amount: (s.amount_total ?? 0) / 100,
            currency: (s.currency || 'eur').toUpperCase(),
            ts: new Date().toISOString(),
          }, { timeout: 10_000 });
        }
      } else if (event.type === 'payment_intent.payment_failed') {
        const pi = event.data.object as Stripe.PaymentIntent;
        const chargeId = Number(pi.metadata?.charge_id);
        if (Number.isInteger(chargeId)) {
          await axios.post(`${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/webhooks/psp`, {
            event: 'payment.failed',
            charge_id: chargeId,
            method: 'card:stripe',
            bank_ref: pi.id,
            ts: new Date().toISOString(),
          }, { timeout: 10_000 });
        }
      } else if (event.type === 'checkout.session.expired') {
        const s = event.data.object as Stripe.Checkout.Session;
        const chargeId = Number(s.metadata?.charge_id);
        if (Number.isInteger(chargeId)) {
          await axios.post(`${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/webhooks/psp`, {
            event: 'payment.expired',
            charge_id: chargeId,
            method: 'card:stripe',
            bank_ref: s.id,
            ts: new Date().toISOString(),
          }, { timeout: 10_000 });
        }
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error('Stripe webhook error:', e?.message || e);
      res.status(400).send(`Webhook Error: ${e?.message || e}`);
    }
  });
}

// Parser JSON (después del webhook de Stripe)
app.use(express.json());

// JSON inválido → 400
app.use((err: any, _req: any, res: any, next: any) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', details: err.message });
  }
  next(err);
});

// -------- Public: invoices & outbox --------
const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
const outboxDir = path.join(process.cwd(), 'public', 'outbox');
fs.mkdirSync(invoicesDir, { recursive: true });
fs.mkdirSync(outboxDir, { recursive: true });
app.use('/invoices', express.static(invoicesDir));
app.use('/outbox', express.static(outboxDir));

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3000);

// ================= Utils =================
function normalizePhone(input?: string | null): string {
  if (!input) return '';
  let p = String(input).trim();
  p = p.replace(/[\s\-()]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (!/^\d{8,15}$/.test(p)) return '';
  return p;
}

type QuoteLine = { concept: string; qty: number; price: number; tax?: number };

function calcTotal(lines: QuoteLine[]): number {
  const sum = lines.reduce((acc, l) => acc + l.qty * l.price * (1 + (l.tax ?? 0)), 0);
  return Math.round(sum * 100) / 100;
}

const CreateQuoteSchema = z.object({
  merchant_id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  currency: z.string().length(3),
  lines: z.array(z.object({
    concept: z.string().min(1),
    qty: z.number().positive(),
    price: z.number().nonnegative(),
    tax: z.number().min(0).max(1).optional(),
  })).min(1),
});

const AcceptQuoteSchema = z.object({
  evidence: z.object({
    wa_user_id: z.string().optional(),
    wamid: z.string().optional(),
    ip: z.string().optional(),
    user_agent: z.string().optional(),
    ts: z.string().optional(),
    note: z.string().optional(),
  }).partial().optional(),
  method_preference: z.enum(['bank', 'card']).optional().default('bank'),
  send: z.boolean().optional().default(true),
  to: z.string().optional(),
});

const CreateChargeSchema = z.object({
  merchant_id: z.number().int().positive(),
  concept: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
  }).optional(),
  expires_at: z.string().optional(),
  method_preference: z.enum(['bank', 'card']).optional().default('bank'),
  meta: z.record(z.string(), z.unknown()).optional(),
});

function makeReference() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CF-${ymd}-${rand}`;
}

function nextInvoiceNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const seq = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CF-INV-${y}${m}-${seq}`;
}

// -------- PDF helper ----------
async function generateInvoicePdf(params: {
  number: string; merchant: { name: string }; customer: { name: string };
  currency: string; total: string; qrData: string;
}) {
  const fileName = `${params.number}.pdf`;
  const outPath = path.join(invoicesDir, fileName);

  const qrPngBuffer = await QRCode.toBuffer(params.qrData, { type: 'png', width: 256 });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.fontSize(18).text('Factura', { align: 'right' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Número: ${params.number}`, { align: 'right' });
  doc.moveDown();

  doc.fontSize(12).text(`Emisor: ${params.merchant.name}`);
  doc.text(`Cliente: ${params.customer.name}`);
  doc.moveDown();

  doc.fontSize(14).text(`Total: ${params.total} ${params.currency}`);
  doc.moveDown();

  doc.image(qrPngBuffer, doc.x, doc.y, { width: 128 });
  doc.text('Escanea el QR para validar la factura', doc.x + 140, doc.y - 120);

  doc.moveDown(6);
  doc.fontSize(9).fillColor('#666').text('CobroFlash — Factura generada automáticamente', { align: 'center' });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { outPath, publicUrlPath: `/invoices/${fileName}` };
}

// ================= Health =================
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'cobroflash-backend', version: '0.1.0', db: 'up' });
  } catch {
    res.status(500).json({ ok: false, service: 'cobroflash-backend', db: 'down' });
  }
});

// Emitir a n8n si hay URL configurada
async function emitToN8n(kind: 'paid' | 'failed' | 'expired', payload: any) {
  const map = {
    paid: process.env.N8N_ONPAID_URL,
    failed: process.env.N8N_ONFAILED_URL,
    expired: process.env.N8N_ONEXPIRED_URL,
  } as const;

  const url = map[kind];
  if (!url) return;
  try {
    await axios.post(url, payload, {
      headers: process.env.N8N_TOKEN ? { Authorization: `Bearer ${process.env.N8N_TOKEN}` } : undefined,
      timeout: 10_000,
    });
  } catch (e: any) {
    console.error(`[n8n emit ${kind}]`, e?.message || e);
  }
}

// ================= Invoicing core =================
async function ensureInvoiceForCharge(chargeId: number, prisma: PrismaClient) {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: { customer: true, merchant: true, events: true },
  });
  if (!charge) throw new Error('charge_not_found');
  if (charge.status !== 'paid') throw new Error(`charge_not_paid:${charge.status}`);

  // 1) Evento 'invoiced' previo
  const prevInvEv = [...(charge.events || [])]
    .reverse()
    .find(e => e.type === 'invoiced' && (e as any).payload?.invoice_id);
  if (prevInvEv) {
    const existing = await prisma.invoice.findUnique({
      where: { id: (prevInvEv as any).payload.invoice_id as number },
    });
    if (existing) return existing;
  }

  // 2) Desde quote → invoice previa
  const quote = await prisma.quote.findFirst({ where: { chargeId: charge.id } });
  if (quote) {
    const existing = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
    if (existing) return existing;
  }

  // 3) Crear nueva
  const number = nextInvoiceNumber();
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

  const inv = await prisma.invoice.create({
    data: {
      merchantId: charge.merchantId,
      customerId: charge.customerId ?? (() => { throw new Error('missing_customer_in_charge'); })(),
      quoteId: quote?.id ?? null,
      number,
      total: charge.amount.toString(),
      currency: charge.currency.toUpperCase(),
      pdfUrl: `${baseUrl}/invoices/${number}.pdf`,
      qrData: `INV:${number}|AMOUNT:${charge.amount.toString()}|CUR:${charge.currency}|REF:${charge.reference ?? ''}`,
    },
  });

  const merchant = await prisma.merchant.findUnique({ where: { id: inv.merchantId } });
  const customer = await prisma.customer.findUnique({ where: { id: inv.customerId } });
  if (!merchant || !customer) throw new Error('missing_merchant_or_customer');

  const pdf = await generateInvoicePdf({
    number: inv.number,
    merchant: { name: merchant.name },
    customer: { name: customer.name },
    currency: inv.currency,
    total: inv.total.toString(),
    qrData: inv.qrData,
  });

  const updated = await prisma.invoice.update({
    where: { id: inv.id },
    data: { pdfUrl: `${pdf.publicUrlPath}` },
  });

  await prisma.event.create({
    data: { chargeId: charge.id, type: 'invoiced', payload: { invoice_id: updated.id } as any },
  });

  return updated;
}

async function sendInvoiceEmail(args: {
  invoiceId: number; toEmail: string; toName?: string; prisma: PrismaClient;
}) {
  const { invoiceId, toEmail, toName, prisma } = args;
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new Error('invoice_not_found');

  const from = process.env.EMAIL_FROM || 'CobroFlash <no-reply@cobroflash.local>';

  // SMTP real si hay SMTP_URL; si no, .eml en /public/outbox
  let transporter: nodemailer.Transporter;
  if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
  } else {
    transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
  }

  // Adjuntar el PDF
  const pdfUrl = inv.pdfUrl;
  const pdfPathInPublic = pdfUrl.startsWith('http') ? new URL(pdfUrl).pathname : pdfUrl;
  const pdfDiskPath = path.join(process.cwd(), 'public', decodeURIComponent(pdfPathInPublic.replace(/^\//, '')));

  const subject = `Tu factura ${inv.number}`;
  const html = `
    <p>Hola ${toName || ''},</p>
    <p>Adjuntamos la factura <b>${inv.number}</b>. También puedes verla aquí:</p>
    <p><a href="${inv.pdfUrl}">${inv.pdfUrl}</a></p>
    <p>Gracias,<br/>CobroFlash</p>
  `.trim();

  const mail = await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    html,
    attachments: [{ filename: `${inv.number}.pdf`, path: pdfDiskPath, contentType: 'application/pdf' }],
  });

  // Guardar .eml si es streamTransport
  // @ts-ignore
  if (mail?.message?.createReadStream) {
    // @ts-ignore
    const stream = mail.message.createReadStream();
    const file = path.join(outboxDir, `invoice-${inv.number}.eml`);
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(file);
      stream.pipe(ws);
      ws.on('finish', () => resolve());
      ws.on('error', reject);
    });
    return { ok: true, eml: `/outbox/invoice-${inv.number}.eml`, smtp: false };
  }

  return { ok: true, smtp: true };
}

// ================= PSP Webhook =================
const PSPWebhookSchema = z.object({
  event: z.enum(['payment.confirmed', 'payment.failed', 'payment.expired']),
  charge_id: z.union([z.string(), z.number()]),
  method: z.string().optional(),
  bank_ref: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  ts: z.string().optional(),
});

app.post('/webhooks/psp', async (req, res) => {
  try {
    const body = PSPWebhookSchema.parse(req.body);
    const chargeId = typeof body.charge_id === 'number' ? body.charge_id : Number(body.charge_id);
    if (!Number.isInteger(chargeId)) return res.status(400).json({ error: 'invalid_charge_id' });

    const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!charge) return res.status(404).json({ error: 'charge_not_found' });

    // Idempotentes
    if (charge.status === 'paid' && body.event === 'payment.confirmed') {
      await prisma.event.create({ data: { chargeId, type: 'paid', payload: { duplicate: true, body } as any } });
      // Auto-invoice/email opcional
      if (String(process.env.AUTO_INVOICE_ON_PAID).toLowerCase() === 'true' || process.env.AUTO_INVOICE_ON_PAID === '1') {
        try {
          const inv = await ensureInvoiceForCharge(chargeId, prisma);
          if ((String(process.env.AUTO_EMAIL_INVOICE_ON_PAID).toLowerCase() === 'true' || process.env.AUTO_EMAIL_INVOICE_ON_PAID === '1') && charge.customerId) {
            const cust = await prisma.customer.findUnique({ where: { id: charge.customerId } });
            if (cust?.email) await sendInvoiceEmail({ invoiceId: inv.id, toEmail: cust.email, toName: cust.name ?? '', prisma });
          }
        } catch (e) { console.error('auto-invoice/error duplicate', e); }
      }
      return res.json({ ok: true, status: 'already_paid' });
    }
    if (
      (charge.status === 'failed' && body.event === 'payment.failed') ||
      (charge.status === 'expired' && body.event === 'payment.expired')
    ) {
      return res.json({ ok: true, status: `already_${charge.status}` });
    }

    if (body.event === 'payment.confirmed') {
      const updated = await prisma.charge.update({
        where: { id: chargeId },
        data: {
          status: 'paid',
          method: body.method ?? charge.method,
          reference: body.bank_ref ?? charge.reference,
          events: { create: { type: 'paid', payload: body as any } },
          reconciliations: { create: { bankRef: body.bank_ref ?? 'n/a', matched: true } },
        },
        include: { customer: true },
      });

      // Auto-invoice/email opcional
      if (String(process.env.AUTO_INVOICE_ON_PAID).toLowerCase() === 'true' || process.env.AUTO_INVOICE_ON_PAID === '1') {
        try {
          const inv = await ensureInvoiceForCharge(updated.id, prisma);
          if ((String(process.env.AUTO_EMAIL_INVOICE_ON_PAID).toLowerCase() === 'true' || process.env.AUTO_EMAIL_INVOICE_ON_PAID === '1') && updated.customer?.email) {
            try { await sendInvoiceEmail({ invoiceId: inv.id, toEmail: updated.customer.email, toName: updated.customer.name ?? '', prisma }); }
            catch (e) { console.error('auto-email error', e); }
          }
        } catch (e) { console.error('auto-invoice error', e); }
      }

      const to = normalizePhone(updated.customer?.phone);
      await emitToN8n('paid', {
        to,
        charge_id: updated.id,
        reference: updated.reference ?? '',
        amount: body.amount ?? updated.amount.toString(),
        currency: body.currency ?? updated.currency,
        method: updated.method,
        bank_ref: body.bank_ref,
        merchant_id: updated.merchantId,
        customer_id: updated.customerId,
      });

      return res.json({ ok: true, status: 'paid' });
    }

    if (body.event === 'payment.failed') {
      await prisma.charge.update({
        where: { id: chargeId },
        data: { status: 'failed', events: { create: { type: 'failed', payload: body as any } } },
      });
      await emitToN8n('failed', { charge_id: chargeId });
      return res.json({ ok: true, status: 'failed' });
    }

    if (body.event === 'payment.expired') {
      await prisma.charge.update({
        where: { id: chargeId },
        data: { status: 'expired', events: { create: { type: 'expired', payload: body as any } } },
      });
      await emitToN8n('expired', { charge_id: chargeId });
      return res.json({ ok: true, status: 'expired' });
    }

    return res.status(400).json({ error: 'unhandled_event' });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('POST /webhooks/psp error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ================= Charges =================
app.post('/charges', async (req, res) => {
  try {
    const body = CreateChargeSchema.parse(req.body);
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

    const merchant = await prisma.merchant.findUnique({ where: { id: body.merchant_id } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    let customerId: number | undefined;
    if (body.customer) {
      const c = await prisma.customer.create({
        data: {
          name: body.customer.name,
          phone: body.customer.phone ? normalizePhone(body.customer.phone) : null,
          email: body.customer.email ?? null,
        },
      });
      customerId = c.id;
    }

    const reference = makeReference();
    const expiresAt = body.expires_at ? new Date(body.expires_at) : null;

    const charge = await prisma.charge.create({
      data: {
        merchantId: body.merchant_id,
        customerId: customerId ?? null,
        concept: body.concept,
        amount: body.amount.toFixed(2),
        currency: body.currency.toUpperCase(),
        method: body.method_preference === 'card' ? 'card' : 'bank',
        status: 'pending',
        expiresAt,
        reference,
        events: { create: { type: 'created', payload: { method_preference: body.method_preference, meta: body.meta ?? {} } as any } },
      },
      include: { customer: true, merchant: true },
    });

    const paybank_url = `${baseUrl}/pay/bank/${charge.id}`;
    const paycard_url = `${baseUrl}/pay/card/${charge.id}`;

    return res.status(201).json({
      id: charge.id,
      paybank_url,
      paycard_url,
      expires_at: charge.expiresAt,
      reference: charge.reference,
      status: charge.status,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('POST /charges error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/charges-smoke', (_req, res) => {
  res.json({ ok: true });
});

app.get('/charges', async (_req, res) => {
  const charges = await prisma.charge.findMany({ orderBy: { id: 'desc' }, take: 20 });
  res.json(charges.map(c => ({
    id: c.id, status: c.status, amount: c.amount.toString(),
    currency: c.currency, reference: c.reference, created_at: c.createdAt,
  })));
});

app.get('/charges/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { events: true, reconciliations: true, customer: true, merchant: true },
  });
  if (!charge) return res.status(404).json({ error: 'charge_not_found' });
  res.json({
    id: charge.id, status: charge.status, method: charge.method,
    amount: charge.amount.toString(), currency: charge.currency, reference: charge.reference,
    expires_at: charge.expiresAt, merchant_id: charge.merchantId, customer_id: charge.customerId,
    events: charge.events.map(e => ({ id: e.id, type: e.type, ts: e.ts })),
    reconciliations: charge.reconciliations.map(r => ({ id: r.id, bank_ref: r.bankRef, matched: r.matched, ts: r.ts })),
  });
});

// Envío por WhatsApp (vía n8n)
app.post('/charges/:id/send', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

    const charge = await prisma.charge.findUnique({ where: { id }, include: { customer: true, merchant: true } });
    if (!charge) return res.status(404).json({ error: 'charge_not_found' });
    if (charge.status !== 'pending') return res.status(409).json({ error: 'invalid_status', status: charge.status });

    const overrideRaw = typeof req.body?.to === 'string' ? req.body.to : '';
    const to = normalizePhone(overrideRaw) || normalizePhone(charge.customer?.phone || '');
    if (!to) return res.status(400).json({ error: 'missing_customer_phone' });

    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const payload = {
      kind: 'charge_request',
      charge_id: charge.id,
      to,
      customer_name: charge.customer?.name ?? '',
      amount: charge.amount.toString(),
      currency: charge.currency,
      concept: charge.concept,
      reference: charge.reference,
      paybank_url: `${baseUrl}/pay/bank/${charge.id}`,
      paycard_url: `${baseUrl}/pay/card/${charge.id}`,
    };

    const url = process.env.N8N_ONSEND_URL;
    if (url) {
      await axios.post(url, payload, { headers: process.env.N8N_TOKEN ? { Authorization: `Bearer ${process.env.N8N_TOKEN}` } : undefined, timeout: 10_000 });
    }

    await prisma.event.create({ data: { chargeId: charge.id, type: 'sent', payload: payload as any } });

    return res.json({ ok: true, status: 'sent', to });
  } catch (err: any) {
    console.error('POST /charges/:id/send error', err?.response?.data || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ================= Quotes =================
app.post('/quote/create', async (req, res) => {
  try {
    const body = CreateQuoteSchema.parse(req.body);
    const { merchant_id, customer_id, currency, lines } = body;

    const merchant = await prisma.merchant.findUnique({ where: { id: merchant_id } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
    if (!customer) return res.status(404).json({ error: 'customer_not_found' });

    const totalNum = calcTotal(lines);
    const quote = await prisma.quote.create({
      data: { merchantId: merchant_id, customerId: customer_id, status: 'draft', total: totalNum.toFixed(2), currency: currency.toUpperCase(), lines },
    });

    return res.status(201).json({ id: quote.id, status: quote.status, total: quote.total.toString(), currency: quote.currency });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('POST /quote/create error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/quote/:id/accept', async (req, res) => {
  try {
    const quoteId = Number(req.params.id);
    if (!Number.isInteger(quoteId)) return res.status(400).json({ error: 'invalid_quote_id' });

    const body = AcceptQuoteSchema.parse(req.body);
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { customer: true, merchant: true, charge: true } });

    if (!quote) return res.status(404).json({ error: 'quote_not_found' });
    if (!quote.customer || !quote.merchant) return res.status(400).json({ error: 'quote_missing_fk' });
    if (quote.status === 'accepted' && quote.chargeId && quote.charge) {
      return res.json({ ok: true, status: 'already_accepted', charge_id: quote.chargeId });
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const reference = makeReference();
    const totalStr = quote.total.toString();
    const method = body.method_preference === 'card' ? 'card' : 'bank';

    const newCharge = await prisma.charge.create({
      data: {
        merchantId: quote.merchantId,
        customerId: quote.customerId,
        concept: `Presupuesto #${quote.id}`,
        amount: totalStr,
        currency: quote.currency.toUpperCase(),
        method,
        status: 'pending',
        reference,
        events: { create: { type: 'created', payload: { from_quote: quote.id, method_preference: method } as any } },
      },
    });

    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted', acceptedAt: new Date(), evidence: body.evidence ?? {}, chargeId: newCharge.id },
    });

    let sent = false;
    if (body.send) {
      try {
        const override = body.to ? normalizePhone(body.to) : undefined;
        await axios.post(`${baseUrl}/charges/${newCharge.id}/send`, override ? { to: override } : {});
        sent = true;
      } catch (err) {
        console.error('Auto-send after accept failed:', (err as any)?.response?.data || err);
        sent = false;
      }
    }

    return res.json({
      ok: true, status: 'accepted', quote_id: quote.id, charge_id: newCharge.id, sent,
      paybank_url: `${baseUrl}/pay/bank/${newCharge.id}`, paycard_url: `${baseUrl}/pay/card/${newCharge.id}`,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('POST /quote/:id/accept error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ================= Invoice API =================
const IssueInvoiceSchema = z.object({ charge_id: z.number().int().positive() });

app.post('/invoice/issue', async (req, res) => {
  try {
    const { charge_id } = IssueInvoiceSchema.parse(req.body);
    const inv = await ensureInvoiceForCharge(charge_id, prisma);
    return res.json({
      id: inv.id, number: inv.number, pdf_url: inv.pdfUrl, currency: inv.currency,
      total: inv.total.toString(), quote_id: inv.quoteId ?? null, created_at: inv.createdAt,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    if (String(err.message || '').startsWith('charge_not_paid')) {
      const status = String(err.message).split(':')[1] || 'unknown';
      return res.status(409).json({ error: 'charge_not_paid', status });
    }
    if (err.message === 'charge_not_found') return res.status(404).json({ error: 'charge_not_found' });
    console.error('POST /invoice/issue error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ============== Recibo + Pago (HTML) ==============
function esc(v?: string | number | null) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[s]);
}

// GET /recibo/:id
app.get('/recibo/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  let charge = await prisma.charge.findUnique({
    where: { id },
    include: { customer: true, merchant: true, events: true, reconciliations: true }
  });
  if (!charge) { res.status(404).send('Cobro no encontrado'); return; }

  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

  // ---------- Fallback Stripe (sin webhooks) ----------
  try {
    const cardParam = (req.query as any).card;
    const sessId = (req.query as any).session_id;
    if (stripe && charge.status === 'pending' && cardParam === 'success' && typeof sessId === 'string' && sessId) {
      const s = await stripe.checkout.sessions.retrieve(sessId);
      if (s && (s.payment_status === 'paid' || s.status === 'complete')) {
        await axios.post(`${baseUrl}/webhooks/psp`, {
          event: 'payment.confirmed',
          charge_id: id,
          method: 'card:stripe',
          bank_ref: s.payment_intent || s.id,
          amount: (s.amount_total ?? 0) / 100,
          currency: (s.currency || 'eur').toUpperCase(),
          ts: new Date().toISOString(),
        }, { timeout: 10_000 });
        // refrescar datos tras marcar pagado
        charge = await prisma.charge.findUnique({
          where: { id },
          include: { customer: true, merchant: true, events: true, reconciliations: true }
        });
      }
    }
  } catch (e) {
    console.error('recibo/stripe-fallback error', (e as any)?.message || e);
  }
  // -----------------------------------------------------

  // Aseguramos de nuevo y congelamos referencia no nula
  if (!charge) { res.status(404).send('Cobro no encontrado'); return; }
  const ch = charge;

  // localizar invoice (por quote o por último evento 'invoiced')
  const quote = await prisma.quote.findFirst({ where: { chargeId: ch.id } });
  let invoice: any = null;
  if (quote) invoice = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
  if (!invoice) {
    const invEv = [...(ch.events || [])].reverse().find(e => e.type === 'invoiced' && (e as any).payload?.invoice_id);
    const invId = (invEv as any)?.payload?.invoice_id as number | undefined;
    if (invId) invoice = await prisma.invoice.findUnique({ where: { id: invId } });
  }

  const title = `Recibo #${ch.id} — CobroFlash`;

  const statusBadge =
    ch.status === 'paid'
      ? `<span style="background:#16a34a;color:#fff;padding:.15rem .5rem;border-radius:.5rem;">PAGADO</span>`
      : ch.status === 'failed'
      ? `<span style="background:#dc2626;color:#fff;padding:.15rem .5rem;border-radius:.5rem;">FALLIDO</span>`
      : ch.status === 'expired'
      ? `<span style="background:#6b7280;color:#fff;padding:.15rem .5rem;border-radius:.5rem;">EXPIRADO</span>`
      : `<span style="background:#f59e0b;color:#111;padding:.15rem .5rem;border-radius:.5rem;">PENDIENTE</span>`;

  const payBtns = ch.status === 'pending'
    ? `<a href="${baseUrl}/pay/bank/${ch.id}" style="display:inline-block;background:#111;color:#fff;padding:.6rem 1rem;border-radius:.6rem;text-decoration:none">Pagar por banco</a>
       <a href="${baseUrl}/pay/card/${ch.id}" style="display:inline-block;background:#2563eb;color:#fff;padding:.6rem 1rem;border-radius:.6rem;text-decoration:none">Pagar con tarjeta</a>`
    : '';

  const mailParam = typeof (req.query as any).mail === 'string' ? (req.query as any).mail : undefined;
  const emlParam  = typeof (req.query as any).eml === 'string' ? (req.query as any).eml : undefined;
  const mailBanner =
    mailParam === 'sent'  ? `<div style="background:#dcfce7;border:1px solid #16a34a;color:#166534;padding:.5rem .75rem;border-radius:.5rem;margin:.75rem 0">📧 Email enviado correctamente.</div>` :
    mailParam === 'saved' ? `<div style="background:#e0f2fe;border:1px solid #0284c7;color:#075985;padding:.5rem .75rem;border-radius:.5rem;margin:.75rem 0">📧 Email generado en <a href="${esc(emlParam||'')}" target="_blank">.eml</a> (modo dev).</div>` :
    '';

  // Bloque email
  const emailBlock = (invoice && ch.customer?.email)
    ? `<form method="post" action="${baseUrl}/dev/email-invoice/${ch.id}" style="margin-top:.5rem">
         <button style="background:#111;color:#fff;padding:.45rem .8rem;border-radius:.5rem;border:none;cursor:pointer">Enviar factura por email</button>
       </form>
       <small style="color:#6b7280">Se enviará a: ${esc(ch.customer!.email!)}</small>`
    : (invoice ? `<small style="color:#6b7280">Añade email al cliente para enviar la factura.</small>` : '');

  const invBlock = ch.status === 'paid'
    ? (invoice
        ? `<p><a href="${invoice.pdfUrl}" target="_blank">📄 Descargar factura (${esc(invoice.number)})</a></p>${emailBlock}`
        : `<form method="post" action="${baseUrl}/dev/issue-invoice/${ch.id}">
             <button style="background:#111;color:#fff;padding:.5rem .9rem;border-radius:.5rem;border:none;cursor:pointer">Generar factura</button>
           </form>`)
    : '';

  const simulateBlock = process.env.NODE_ENV !== 'production'
    ? `<details style="margin-top:1rem"><summary>🔧 Simulación (solo dev)</summary>
         <form method="post" action="${baseUrl}/dev/sim/pay/${ch.id}" style="margin-top:.5rem">
           <button style="background:#2563eb;color:#fff;padding:.4rem .8rem;border-radius:.4rem;border:none;cursor:pointer">Simular pago SCTinst</button>
         </form>
         <div style="display:flex;gap:.5rem;margin-top:.5rem">
           <form method="post" action="${baseUrl}/dev/sim/fail/${ch.id}">
             <button style="background:#dc2626;color:#fff;padding:.35rem .7rem;border-radius:.4rem;border:none;cursor:pointer">Simular fallo</button>
           </form>
           <form method="post" action="${baseUrl}/dev/sim/expire/${ch.id}">
             <button style="background:#6b7280;color:#fff;padding:.35rem .7rem;border-radius:.4rem;border:none;cursor:pointer">Simular expiración</button>
           </form>
         </div>
       </details>`
    : '';

  const eventsList = (ch.events || [])
    .sort((a,b)=>+new Date(a.ts)-+new Date(b.ts))
    .map(e => `<li>${esc(e.type)} · ${esc(new Date(e.ts).toLocaleString())}</li>`)
    .join('');

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;margin:0;padding:2rem;background:#f6f7f9;color:#111}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.25rem;max-width:720px;margin:0 auto;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .row{display:flex;gap:1rem;flex-wrap:wrap}
  .row > div{flex:1 1 240px}
  small{color:#6b7280}
  ul{padding-left:1.1rem}
  a{color:#2563eb}
</style>
</head>
<body>
  <div class="card">
    <h2 style="margin:.2rem 0">Recibo</h2>
    <p style="margin:.3rem 0">Cobro <b>#${ch.id}</b> ${statusBadge}</p>
    <div class="row" style="margin-top:.5rem">
      <div><small>Concepto</small><div>${esc(ch.concept)}</div></div>
      <div><small>Importe</small><div><b>${esc(ch.amount.toString())} ${esc(ch.currency)}</b></div></div>
      <div><small>Cliente</small><div>${esc(ch.customer?.name ?? '—')}</div></div>
    </div>

    <div style="margin:1rem 0;display:flex;gap:.75rem;align-items:center">
      ${payBtns}
      <a href="${baseUrl}/charges/${ch.id}">Ver JSON</a>
    </div>

    ${mailBanner}
    ${invBlock}
    ${simulateBlock}

    <hr style="margin:1rem 0;border:none;border-top:1px solid #e5e7eb"/>
    <small>Eventos</small>
    <ul>${eventsList || '<li>—</li>'}</ul>
  </div>
</body>
</html>`);
});

// GET /pay/bank/:id — demo
app.get('/pay/bank/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  const charge = await prisma.charge.findUnique({ where: { id } });
  if (!charge) return res.status(404).send('Cobro no encontrado');

  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pagar — Cobro ${id}</title>
<style>body{font-family:system-ui;margin:0;background:#f6f7f9;padding:2rem;color:#111}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.25rem;max-width:720px;margin:0 auto}
.btn{background:#111;color:#fff;padding:.6rem 1rem;border-radius:.6rem;border:none;cursor:pointer;text-decoration:none;display:inline-block}
a{color:#2563eb}
</style>
</head>
<body>
  <div class="card">
    <h2>Pago por banco</h2>
    <p>Vas a pagar <b>${esc(charge.amount.toString())} ${esc(charge.currency)}</b> (Cobro #${id}).</p>
    <p style="opacity:.8">* En producción: Pay-by-Bank / SEPA Inst o botón del PSP.</p>

    <form method="post" action="${baseUrl}/dev/sim/pay/${id}" style="margin:.75rem 0">
      <button class="btn">🔧 Simular pago SCTinst (dev)</button>
    </form>

    <p><a href="${baseUrl}/recibo/${id}">Volver al recibo</a></p>
  </div>
</body></html>`);
});

// === Pago con tarjeta (Stripe Checkout) ===
app.get('/pay/card/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  if (!stripe) {
    return res
      .status(501)
      .send('Stripe no está configurado. Define STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.');
  }

  const charge = await prisma.charge.findUnique({ where: { id }, include: { customer: true } });
  if (!charge) return res.status(404).send('Cobro no encontrado');
  if (charge.status !== 'pending') {
    return res.redirect(303, `/recibo/${id}`);
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const amountCents = Math.round(Number(charge.amount) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: charge.customer?.email || undefined,
    line_items: [{
      price_data: {
        currency: charge.currency.toLowerCase(),
        product_data: { name: charge.concept || `Cobro #${id}` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    // >>> importante: devolvemos el session_id para el fallback <<<
    success_url: `${baseUrl}/recibo/${id}?card=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/recibo/${id}?card=cancel`,
    metadata: { charge_id: String(id) },
  });

  // guardar evento informativo (útil para debugging)
  await prisma.event.create({ data: { chargeId: id, type: 'card_session_created', payload: { session_id: session.id } as any } });

  return res.redirect(303, session.url!);
});

// ============ Rutas DEV ============
app.post('/dev/sim/pay/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');
  try {
    await axios.post(`${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/webhooks/psp`, {
      event: 'payment.confirmed', charge_id: id, method: 'SCTinst', bank_ref: 'E2EID-DEV', currency: 'EUR'
    }, { timeout: 10_000 });
    res.redirect(303, `/recibo/${id}?r=${Date.now()}`);
  } catch (e:any) {
    console.error('dev/sim/pay error', e?.response?.data || e);
    res.status(500).send('Error simulando pago');
  }
});

app.post('/dev/sim/fail/:id', async (req, res) => {
  const id = Number(req.params.id);
  await axios.post(`${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/webhooks/psp`, {
    event: 'payment.failed', charge_id: id
  });
  res.redirect(303, `/recibo/${id}?r=${Date.now()}`);
});

app.post('/dev/sim/expire/:id', async (req, res) => {
  const id = Number(req.params.id);
  await axios.post(`${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/webhooks/psp`, {
    event: 'payment.expired', charge_id: id
  });
  res.redirect(303, `/recibo/${id}?r=${Date.now()}`);
});

// POST /dev/email-invoice/:chargeId → asegura factura y envía email
app.post('/dev/email-invoice/:chargeId', async (req, res) => {
  const chargeId = Number(req.params.chargeId);
  if (!Number.isInteger(chargeId)) return res.status(400).send('ID inválido');

  const charge = await prisma.charge.findUnique({ where: { id: chargeId }, include: { customer: true, events: true } });
  if (!charge) return res.status(404).send('Cobro no encontrado');

  const inv = await ensureInvoiceForCharge(chargeId, prisma);
  const email = charge.customer?.email;
  if (!email) return res.status(400).send('El cliente no tiene email');

  const result = await sendInvoiceEmail({ invoiceId: inv.id, toEmail: email, toName: charge.customer?.name || '', prisma });

  await prisma.event.create({ data: { chargeId, type: 'emailed', payload: { invoice_id: inv.id, to: email } as any } });

  const qs = result.smtp ? `mail=sent` : `mail=saved&eml=${encodeURIComponent(result.eml!)}`;
  res.redirect(303, `/recibo/${chargeId}?${qs}&r=${Date.now()}`);
});

// ---------------- Listen ----------------
app.listen(PORT, () => {
  console.log(`CobroFlash API listening on http://localhost:${PORT}`);
});

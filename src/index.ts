import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3000);

// --- Healthcheck (incluye ping a DB)
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'cobroflash-backend', version: '0.1.0', db: 'up' });
  } catch {
    res.status(500).json({ ok: false, service: 'cobroflash-backend', db: 'down' });
  }
});

// --- Helper: emitir a n8n si hay URL configurada
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

// --- Validación del webhook del PSP
const PSPWebhookSchema = z.object({
  event: z.enum(['payment.confirmed', 'payment.failed', 'payment.expired']),
  charge_id: z.union([z.string(), z.number()]), // acepta "2" o 2
  method: z.string().optional(),                // 'SCTinst' | 'SPEI' | 'Pix' | 'card'
  bank_ref: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  ts: z.string().optional(),                    // opcional (n8n puede poner $now)
});

// --- Webhook real
app.post('/webhooks/psp', async (req, res) => {
  try {
    const body = PSPWebhookSchema.parse(req.body);

    // Normalizar charge_id a number (tu schema usa Int autoincrement)
    const chargeId = typeof body.charge_id === 'number' ? body.charge_id : Number(body.charge_id);
    if (!Number.isInteger(chargeId)) {
      return res.status(400).json({ error: 'invalid_charge_id' });
    }

    const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!charge) return res.status(404).json({ error: 'charge_not_found' });

    // Idempotencia básica
    if (charge.status === 'paid' && body.event === 'payment.confirmed') {
      await prisma.event.create({
        data: { chargeId, type: 'paid', payload: { duplicate: true, body } as any },
      });
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
          reconciliations: {
            create: { bankRef: body.bank_ref ?? 'n/a', matched: true },
          },
        },
        include: { customer: true }, // <-- añade esto
      });
      

      await emitToN8n('paid', {
        charge_id: updated.id,
        to: updated.customer?.phone,   // <-- ya existe
        method: updated.method,
        reference: updated.reference,
        amount: body.amount ?? updated.amount.toString(),
        currency: body.currency ?? updated.currency,
        bank_ref: body.bank_ref,
        merchant_id: updated.merchantId,
        customer_id: updated.customerId
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
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'validation_error', details: err.errors });
    }
    console.error('POST /webhooks/psp error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ------------------------ CREATE CHARGE ------------------------
const CreateChargeSchema = z.object({
  merchant_id: z.number().int().positive(),
  concept: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3), // 'EUR', 'MXN', etc.
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
  }).optional(),
  expires_at: z.string().optional(),     // ISO 8601
  method_preference: z.enum(['bank', 'card']).optional().default('bank'),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// referencia legible para conciliación (ej. CF-20250923-AB12CD)
function makeReference() {
  const ymd = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.random().toString(36).slice(2,8).toUpperCase();
  return `CF-${ymd}-${rand}`;
}

app.post('/charges', async (req, res) => {
  try {
    const body = CreateChargeSchema.parse(req.body);
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

    // 1) validar merchant
    const merchant = await prisma.merchant.findUnique({ where: { id: body.merchant_id } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    // 2) crear customer si viene
    let customerId: number | undefined;
    if (body.customer) {
      const c = await prisma.customer.create({
        data: {
          name: body.customer.name,
          phone: body.customer.phone ?? null,
          email: body.customer.email ?? null,
        },
      });
      customerId = c.id;
    }

    // 3) crear charge pending + event 'created'
    const reference = makeReference();
    const expiresAt = body.expires_at ? new Date(body.expires_at) : null;

    const charge = await prisma.charge.create({
      data: {
        merchantId: body.merchant_id,
        customerId: customerId ?? null,
        concept: body.concept,
        amount: body.amount.toFixed(2),             // Prisma Decimal: acepta string
        currency: body.currency.toUpperCase(),
        method: body.method_preference === 'card' ? 'card' : 'bank',
        status: 'pending',
        expiresAt,
        reference,
        events: {
          create: {
            type: 'created',
            payload: {
              method_preference: body.method_preference,
              meta: body.meta ?? {},
            } as any,
          },
        },
      },
      include: { customer: true, merchant: true },
    });

    // 4) construir URLs (placeholder)
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
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'validation_error', details: err.errors });
    }
    console.error('POST /charges error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/charges-smoke', (_req, res) => {
  console.log('HIT /charges-smoke');
  res.json({ ok: true });
});



app.get('/charges', async (_req, res) => {
  const charges = await prisma.charge.findMany({ orderBy: { id: 'desc' }, take: 20 });
  res.json(charges.map(c => ({
    id: c.id, status: c.status, amount: c.amount.toString(),
    currency: c.currency, reference: c.reference, created_at: c.createdAt
  })));
});

app.get('/charges/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
  const charge = await prisma.charge.findUnique({
    where: { id }, include: { events: true, reconciliations: true, customer: true, merchant: true }
  });
  if (!charge) return res.status(404).json({ error: 'charge_not_found' });
  res.json({
    id: charge.id, status: charge.status, method: charge.method,
    amount: charge.amount.toString(), currency: charge.currency, reference: charge.reference,
    expires_at: charge.expiresAt, merchant_id: charge.merchantId, customer_id: charge.customerId,
    events: charge.events.map(e => ({ id: e.id, type: e.type, ts: e.ts })),
    reconciliations: charge.reconciliations.map(r => ({ id: r.id, bank_ref: r.bankRef, matched: r.matched, ts: r.ts }))
  });
});



// ------------------------ SEND CHARGE (WhatsApp via n8n) ------------------------
app.post('/charges/:id/send', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const charge = await prisma.charge.findUnique({
      where: { id },
      include: { customer: true, merchant: true },
    });

    if (!charge) return res.status(404).json({ error: 'charge_not_found' });
    if (charge.status !== 'pending') {
      return res.status(409).json({ error: 'invalid_status', status: charge.status });
    }
    if (!charge.customerId || !charge.customer?.phone) {
      return res.status(400).json({ error: 'missing_customer_phone' });
    }

    // payload para n8n
    const payload = {
      kind: 'charge_request',
      charge_id: charge.id,
      to: charge.customer.phone,               // E.164 recomendado
      customer_name: charge.customer.name ?? '',
      amount: charge.amount.toString(),
      currency: charge.currency,
      concept: charge.concept,
      reference: charge.reference,
      paybank_url: `${baseUrl}/pay/bank/${charge.id}`,
      paycard_url: `${baseUrl}/pay/card/${charge.id}`
    };

    // dispara a n8n (si está configurado)
    const url = process.env.N8N_ONSEND_URL;
    if (url) {
      await axios.post(url, payload, {
        headers: process.env.N8N_TOKEN ? { Authorization: `Bearer ${process.env.N8N_TOKEN}` } : undefined,
        timeout: 10_000,
      });
    }

    // registra el evento "sent"
    await prisma.event.create({
      data: { chargeId: charge.id, type: 'sent', payload: payload as any },
    });

    return res.json({ ok: true, status: 'sent', to: payload.to });
  } catch (err) {
    console.error('POST /charges/:id/send error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});



app.listen(PORT, () => {
  console.log(`CobroFlash API listening on http://localhost:${PORT}`);
});

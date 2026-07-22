// srcNew/modules/billing/app/routes/charges.routes.ts
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../../../../core/db/prisma';
import { CreateChargeSchema } from '../../../../core/validation/schemas';
import { normalizePhone, makeReference } from '../../../../core/utils/utils';
import { config, BASE_URL } from '../../../../core/config/env';
import { ensureChargeReceiptToken } from '../../../../lib/invoicing';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const body = CreateChargeSchema.parse(req.body);

    const merchant = await prisma.merchant.findUnique({ where: { id: body.merchant_id } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    let customerId: number | undefined;
    if (body.customer_id) {
      // Cliente existente: lo usamos tal cual (no duplicamos).
      customerId = body.customer_id;
    } else if (body.customer) {
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

    const methodPref = body.method_preference;
    const method = methodPref === 'card' ? 'card' : methodPref === 'mp' ? 'mp' : 'bank';

    const charge = await prisma.charge.create({
      data: {
        merchantId: body.merchant_id,
        customerId: customerId ?? null,
        concept: body.concept,
        amount: body.amount.toFixed(2),
        currency: body.currency.toUpperCase(),
        method,
        status: 'pending',
        expiresAt,
        payMethods: body.pay_methods ?? undefined, // A2.1: selector al crear (heredado del quote)
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

    const paybank_url = `${BASE_URL}/pay/bank/${charge.id}`;
    const paycard_url = `${BASE_URL}/pay/card/${charge.id}`;
    const paymp_url   = `${BASE_URL}/pay/mp/${charge.id}`;

    return res.status(201).json({
      id: charge.id,
      paybank_url,
      paycard_url,
      paymp_url,
      expires_at: charge.expiresAt,
      reference: charge.reference,
      status: charge.status,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /charges error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/-smoke', (_req, res) => {
  res.json({ ok: true });
});

router.get('/', async (_req, res) => {
  const charges = await prisma.charge.findMany({ orderBy: { id: 'desc' }, take: 20 });
  res.json(
    charges.map((c) => ({
      id: c.id,
      status: c.status,
      amount: c.amount.toString(),
      currency: c.currency,
      reference: c.reference,
      created_at: c.createdAt,
    })),
  );
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { events: true, reconciliations: true, customer: true, merchant: true },
  });
  if (!charge) return res.status(404).json({ error: 'charge_not_found' });

  res.json({
    id: charge.id,
    status: charge.status,
    method: charge.method,
    amount: charge.amount.toString(),
    currency: charge.currency,
    reference: charge.reference,
    expires_at: charge.expiresAt,
    merchant_id: charge.merchantId,
    customer_id: charge.customerId,
    events: charge.events.map((e) => ({
      id: e.id,
      type: e.type,
      ts: e.ts,
    })),
    reconciliations: charge.reconciliations.map((r) => ({
      id: r.id,
      bank_ref: r.bankRef,
      matched: r.matched,
      ts: r.ts,
    })),
  });
});

// Envío por WhatsApp (vía n8n)
router.post('/:id/send', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

    const charge = await prisma.charge.findUnique({
      where: { id },
      include: { customer: true, merchant: true },
    });
    if (!charge) return res.status(404).json({ error: 'charge_not_found' });
    if (charge.status !== 'pending') {
      return res.status(409).json({ error: 'invalid_status', status: charge.status });
    }

    const overrideRaw = typeof req.body?.to === 'string' ? req.body.to : '';
    const to = normalizePhone(overrideRaw) || normalizePhone(charge.customer?.phone || '');
    if (!to) return res.status(400).json({ error: 'missing_customer_phone' });

    // SCRUM-74: token OPACO del recibo público, NUNCA el chargeId (IDOR/RGPD).
    const receiptToken = await ensureChargeReceiptToken(charge.id, prisma);
    const payload = {
      kind: 'charge_request',
      charge_id: charge.id,
      to,
      customer_name: charge.customer?.name ?? '',
      amount: charge.amount.toString(),
      currency: charge.currency,
      concept: charge.concept,
      reference: charge.reference,
      // URL única que mandaremos por WhatsApp
      receipt_url: `${BASE_URL}/recibo/${receiptToken}`,
      // Campos opcionales para futuro
      paybank_url: `${BASE_URL}/pay/bank/${charge.id}`,
      paycard_url: `${BASE_URL}/pay/card/${charge.id}`,
    };

    const url = config.N8N_ONSEND_URL;
    if (url) {
      await axios.post(url, payload, {
        headers: config.N8N_TOKEN ? { Authorization: `Bearer ${config.N8N_TOKEN}` } : undefined,
        timeout: 10_000,
      });
    }

    await prisma.event.create({
      data: { chargeId: charge.id, type: 'sent', payload: payload as any },
    });

    return res.json({ ok: true, status: 'sent', to });
  } catch (err: any) {
    console.error('POST /charges/:id/send error', err?.response?.data || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

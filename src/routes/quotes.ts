import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { CreateQuoteSchema, AcceptQuoteSchema } from '../schemas';
import { calcTotal, makeReference, normalizePhone } from '../lib/utils';
import { BASE_URL } from '../config/env';

const router = Router();

router.post('/create', async (req, res) => {
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

router.post('/:id/accept', async (req, res) => {
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
        await axios.post(`${BASE_URL}/charges/${newCharge.id}/send`, override ? { to: override } : {});
        sent = true;
      } catch (err) {
        console.error('Auto-send after accept failed:', (err as any)?.response?.data || err);
        sent = false;
      }
    }

    return res.json({
      ok: true, status: 'accepted', quote_id: quote.id, charge_id: newCharge.id, sent,
      paybank_url: `${BASE_URL}/pay/bank/${newCharge.id}`, paycard_url: `${BASE_URL}/pay/card/${newCharge.id}`,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'validation_error', details: err.errors });
    console.error('POST /quote/:id/accept error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

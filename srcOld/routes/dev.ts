import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../db/prisma';
import { ensureInvoiceForCharge } from '../lib/invoicing';
import { sendInvoiceEmail } from '../lib/email';
import { BASE_URL } from '../config/env';

const router = Router();

router.post('/sim/pay/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');
  try {
    await axios.post(`${BASE_URL}/webhooks/psp`, {
      event: 'payment.confirmed', charge_id: id, method: 'SCTinst', bank_ref: 'E2EID-DEV', currency: 'EUR'
    }, { timeout: 10_000 });
    res.redirect(303, `/recibo/${id}?r=${Date.now()}`);
  } catch (e:any) {
    console.error('dev/sim/pay error', e?.response?.data || e);
    res.status(500).send('Error simulando pago');
  }
});

router.post('/sim/fail/:id', async (req, res) => {
  const id = Number(req.params.id);
  await axios.post(`${BASE_URL}/webhooks/psp`, {
    event: 'payment.failed', charge_id: id
  });
  res.redirect(303, `/recibo/${id}?r=${Date.now()}`);
});

router.post('/sim/expire/:id', async (req, res) => {
  const id = Number(req.params.id);
  await axios.post(`${BASE_URL}/webhooks/psp`, {
    event: 'payment.expired', charge_id: id
  });
  res.redirect(303, `/recibo/${id}?r=${Date.now()}`);
});

router.post('/issue-invoice/:chargeId', async (req, res) => {
  const chargeId = Number(req.params.chargeId);
  if (!Number.isInteger(chargeId)) return res.status(400).send('ID inválido');

  await ensureInvoiceForCharge(chargeId, prisma);
  res.redirect(303, `/recibo/${chargeId}?r=${Date.now()}`);
});

router.post('/email-invoice/:chargeId', async (req, res) => {
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

export default router;

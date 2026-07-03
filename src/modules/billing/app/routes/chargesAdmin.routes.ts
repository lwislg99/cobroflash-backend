// src/modules/billing/app/routes/chargesAdmin.routes.ts
// C1-4 — confirmación del PRO de un Bizum manual recibido ("Confirmar Bizum
// recibido", N5). El doble toque vive en la UI; aquí se valida tenant + estado
// y se dispara la MISMA cadena post-pago que un PSP (vía /webhooks/psp):
// charge.paid + paid_via='bizum_manual' → invoice.paid → WA/email/recibo.
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../../../../core/db/prisma';
import { BASE_URL } from '../../../../core/config/env';
import { isFlagEnabled } from '../../../../core/flags';

const router = Router();

router.post('/:id/confirm-bizum', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

    // Multi-tenant: el cobro debe ser del merchant de la sesión
    const charge = await prisma.charge.findFirst({
      where: { id, merchantId: req.merchantId },
      include: { merchant: true, customer: { select: { name: true } } },
    });
    if (!charge) return res.status(404).json({ error: 'not_found' });
    if (charge.status === 'paid') return res.json({ ok: true, status: 'already_paid' });
    if (charge.status !== 'pending') return res.status(409).json({ error: 'charge_not_pending' });

    if (!isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: charge.merchant })) {
      return res.status(409).json({ error: 'bizum_disabled' });
    }

    // Misma cadena post-pago que el PSP (P0-3: factura ligada → paid, WA, email)
    await axios.post(`${BASE_URL}/webhooks/psp`, {
      event: 'payment.confirmed',
      charge_id: id,
      method: 'bizum_manual',
      bank_ref: `bizum-manual-${Date.now()}`,
      amount: Number(charge.amount),
      currency: charge.currency,
      ts: new Date().toISOString(),
    }, { timeout: 10_000 });

    return res.json({ ok: true, status: 'paid', paid_via: 'bizum_manual' });
  } catch (err: any) {
    console.error('[POST /admin/charges/:id/confirm-bizum]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

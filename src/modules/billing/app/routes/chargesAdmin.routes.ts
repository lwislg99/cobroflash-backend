// src/modules/billing/app/routes/chargesAdmin.routes.ts
// C1-4 — confirmación del PRO de un Bizum manual recibido ("Confirmar Bizum
// recibido", N5). El doble toque vive en la UI; aquí se valida tenant + estado
// y se dispara la MISMA cadena post-pago que un PSP (vía /webhooks/psp):
// charge.paid + paid_via='bizum_manual' → invoice.paid → WA/email/recibo.
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../../../../core/db/prisma';
import { BASE_URL } from '../../../../core/config/env';
import { internalHeaders } from '../../../../core/http/internalAuth';
import { isFlagEnabled } from '../../../../core/flags';
import { resolverFechaDeCobro } from '../../domain/fechaDeCobro'; // SCRUM-397

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

    // SCRUM-397 · LA FECHA LA DICE QUIEN CONFIRMA, NO EL RELOJ.
    //
    // Éste es el único camino donde una PERSONA marca un cobro, y por tanto el único donde el
    // instante de proceso podía no ser el del dinero: un Bizum recibido el 31 de marzo y
    // confirmado el 2 de abril quedaba fechado en abril — **cruza de trimestre**, y con criterio
    // de caja es el euro declarado en el periodo que no toca.
    //
    // El criterio (futura no, hacia atrás sin límite) y sus dos textos son los APROBADOS el
    // 10-ago-2026 para el mismo problema en facturas: se reutilizan, no se inventan (regla 30).
    // Sin fecha, `ahora` — que no es el defecto: el defecto era no poder cambiarla.
    const fecha = resolverFechaDeCobro((req.body as any)?.paid_at ?? (req.body as any)?.fecha);
    if (!fecha.ok) return res.status(400).json({ error: fecha.error, message: fecha.message });

    // Misma cadena post-pago que el PSP (P0-3: factura ligada → paid, WA, email)
    await axios.post(`${BASE_URL}/webhooks/psp`, {
      event: 'payment.confirmed',
      charge_id: id,
      method: 'bizum_manual',
      bank_ref: `bizum-manual-${Date.now()}`,
      amount: Number(charge.amount),
      currency: charge.currency,
      // `ts` ya estaba en el esquema del webhook y no lo leía nadie. Ahora es la fecha del cobro.
      ts: fecha.fecha.toISOString(),
    }, { timeout: 10_000, headers: internalHeaders() });

    return res.json({ ok: true, status: 'paid', paid_via: 'bizum_manual', paid_at: fecha.fecha.toISOString() });
  } catch (err: any) {
    console.error('[POST /admin/charges/:id/confirm-bizum]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

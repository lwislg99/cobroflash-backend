// src/modules/maintenance/app/routes/maintenance.routes.ts — MANT-1 (A15.1)
// Alta del plan desde el toggle del presupuesto aceptado + cancelación.
// Todo tras flag MAINTENANCE_ENABLED (merchant opt-in, OFF): sin flag → 404.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../../../core/db/prisma';
import { isFlagEnabled } from '../../../../core/flags';
import { addMonths } from '../../domain/maintenance.service';
import { requireRole } from '../../../../core/http/authMiddleware'; // A12.4 (S1: default admin-only)

const router = Router();

async function maintenanceEnabled(merchantId: number): Promise<boolean> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, country: true, flags: true },
  });
  return !!merchant && isFlagEnabled('MAINTENANCE_ENABLED', { merchant });
}

const createSchema = z.object({
  customerId: z.number().int().positive(),
  quoteId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(120),
  intervalMonths: z.number().int().min(1).max(60),
});

// POST /admin/maintenance — crear el recordatorio (toggle al aceptar)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    if (!(await maintenanceEnabled(req.merchantId))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    }
    const { customerId, quoteId, title, intervalMonths } = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, merchantId: req.merchantId },
      select: { id: true },
    });
    if (!customer) return res.status(404).json({ error: 'customer_not_found' });
    if (quoteId) {
      const quote = await prisma.quote.findFirst({
        where: { id: quoteId, merchantId: req.merchantId },
        select: { id: true },
      });
      if (!quote) return res.status(404).json({ error: 'quote_not_found' });
      // Idempotencia suave: un plan ACTIVO por presupuesto es suficiente
      const existing = await prisma.maintenancePlan.findFirst({
        where: { merchantId: req.merchantId, quoteId, active: true },
      });
      if (existing) return res.status(200).json(serialize(existing));
    }

    const plan = await prisma.maintenancePlan.create({
      data: {
        merchantId: req.merchantId,
        customerId,
        quoteId: quoteId ?? null,
        title,
        intervalMonths,
        nextDueAt: addMonths(new Date(), intervalMonths),
      },
    });
    return res.status(201).json(serialize(plan));
  } catch (err) {
    console.error('[POST /admin/maintenance]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /admin/maintenance/:id — cancelar (active=false; nunca borrado físico)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (!(await maintenanceEnabled(req.merchantId))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const plan = await prisma.maintenancePlan.findFirst({
      where: { id, merchantId: req.merchantId },
    });
    if (!plan) return res.status(404).json({ error: 'not_found' });
    const updated = await prisma.maintenancePlan.update({
      where: { id: plan.id },
      data: { active: false },
    });
    return res.json(serialize(updated));
  } catch (err) {
    console.error('[DELETE /admin/maintenance/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

function serialize(p: {
  id: number; customerId: number; quoteId: number | null; title: string;
  intervalMonths: number; nextDueAt: Date; active: boolean; rejectedStreak: number;
}) {
  return {
    id: p.id,
    customerId: p.customerId,
    quoteId: p.quoteId,
    title: p.title,
    intervalMonths: p.intervalMonths,
    nextDueAt: p.nextDueAt,
    active: p.active,
    rejectedStreak: p.rejectedStreak,
  };
}

export default router;

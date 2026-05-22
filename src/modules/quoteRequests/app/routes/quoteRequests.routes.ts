// src/modules/quoteRequests/app/routes/quoteRequests.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';

const router = Router();

// GET /admin/quote-requests?status=pending|all
router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const where: any = { merchantId: req.merchantId };
    if (status !== 'all') where.status = status;

    const requests = await prisma.quoteRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
      take: 50,
    });

    return res.json(requests);
  } catch (err) {
    console.error('[GET /admin/quote-requests]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /admin/quote-requests/:id  { status: 'read' | 'done' }
router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const status = req.body?.status;
    if (!['read', 'done', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const existing = await prisma.quoteRequest.findFirst({
      where: { id, merchantId: req.merchantId },
    });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const updated = await prisma.quoteRequest.update({
      where: { id },
      data: { status },
    });
    return res.json(updated);
  } catch (err) {
    console.error('[PATCH /admin/quote-requests/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

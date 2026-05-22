// src/modules/templates/app/routes/templates.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';

const router = Router();

// GET /admin/templates — listar plantillas del merchant
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.quoteTemplate.findMany({
      where: { merchantId: req.merchantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        currency: true,
        lines: true,
        tiers: true,
        paymentTerms: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json(templates);
  } catch (err) {
    console.error('[GET /admin/templates]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/templates — crear plantilla
router.post('/', async (req, res) => {
  try {
    const name         = String(req.body?.name || '').trim();
    const currency     = String(req.body?.currency || 'EUR').slice(0, 3).toUpperCase();
    const lines        = req.body?.lines;
    const tiers        = req.body?.tiers ?? null;
    const paymentTerms = req.body?.paymentTerms ?? null;

    if (!name)                   return res.status(400).json({ error: 'name_required' });
    if (!Array.isArray(lines) || lines.length === 0)
      return res.status(400).json({ error: 'lines_required' });

    const template = await prisma.quoteTemplate.create({
      data: {
        merchantId: req.merchantId,
        name,
        currency,
        lines,
        tiers,
        paymentTerms,
      },
    });
    return res.status(201).json(template);
  } catch (err) {
    console.error('[POST /admin/templates]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /admin/templates/:id — actualizar (nombre o líneas)
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const existing = await prisma.quoteTemplate.findFirst({
      where: { id, merchantId: req.merchantId },
    });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const data: any = {};
    if (req.body?.name        != null) data.name         = String(req.body.name).trim();
    if (req.body?.currency    != null) data.currency      = String(req.body.currency).slice(0,3).toUpperCase();
    if (req.body?.lines       != null) data.lines         = req.body.lines;
    if (req.body?.tiers       != null) data.tiers         = req.body.tiers;
    if (req.body?.paymentTerms!= null) data.paymentTerms  = req.body.paymentTerms;

    const updated = await prisma.quoteTemplate.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    console.error('[PUT /admin/templates/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /admin/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const existing = await prisma.quoteTemplate.findFirst({
      where: { id, merchantId: req.merchantId },
    });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    await prisma.quoteTemplate.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /admin/templates/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

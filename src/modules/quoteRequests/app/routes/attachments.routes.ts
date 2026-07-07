// src/modules/quoteRequests/app/routes/attachments.routes.ts — MEDIA-1 (FASE 3)
// Sirve los bytes de un adjunto guardado en Postgres. Montado bajo /admin
// (requireAuth ya inyecta req.merchantId) → tenancy estricta por merchant.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';

const router = Router();

// GET /admin/attachments/:id — devuelve el binario (foto) con su content-type.
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const att = await prisma.attachment.findFirst({
      where: { id, merchantId: req.merchantId },
      select: { data: true, mime: true },
    });
    if (!att || !att.data) return res.status(404).json({ error: 'not_found' });

    res.setHeader('Content-Type', att.mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.send(Buffer.from(att.data)); // Uint8Array (bytea) → Buffer para Express
  } catch (err) {
    console.error('[GET /admin/attachments/:id]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

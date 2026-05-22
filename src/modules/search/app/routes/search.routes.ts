// src/modules/search/app/routes/search.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';

const router = Router();

const MAX_RESULTS = 5;

/**
 * GET /admin/search?q=text
 * Búsqueda global en clientes, presupuestos y facturas.
 * Devuelve hasta 5 resultados por categoría.
 */
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ customers: [], quotes: [], invoices: [] });

  const mid = req.merchantId;
  const contains = (field: string) => ({ contains: q, mode: 'insensitive' as const });

  try {
    const [customers, quotes, invoices] = await Promise.all([
      // Clientes: name, phone, email
      prisma.customer.findMany({
        where: {
          merchantId: mid,
          OR: [
            { name:  { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: MAX_RESULTS,
        orderBy: { updatedAt: 'desc' },
      }),

      // Presupuestos: ID numérico o nombre de cliente
      prisma.quote.findMany({
        where: {
          merchantId: mid,
          OR: [
            ...(Number.isInteger(Number(q)) ? [{ id: Number(q) }] : []),
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true, status: true, total: true, currency: true, createdAt: true,
          customer: { select: { name: true } },
        },
        take: MAX_RESULTS,
        orderBy: { createdAt: 'desc' },
      }),

      // Facturas: número, nombre de cliente
      prisma.invoice.findMany({
        where: {
          merchantId: mid,
          OR: [
            { number:   { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true, number: true, status: true, total: true, currency: true, createdAt: true,
          customer: { select: { name: true } },
        },
        take: MAX_RESULTS,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.json({ customers, quotes, invoices });
  } catch (err) {
    console.error('[GET /admin/search]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

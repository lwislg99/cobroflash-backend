// src/modules/search/app/routes/search.routes.ts
import { cabeEnColumnaInt } from '../../../../core/validation/enteroDeColumna'; // SCRUM-1379
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { numeroVisibleDelPresupuesto, numeroBuscado } from '../../../quotes/domain/revision'; // SCRUM-1483

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
  const porNumero = numeroBuscado(q);

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

      // Presupuestos: SU NÚMERO (el que el profesional ve) o nombre de cliente.
      // SCRUM-1483: se buscaba por `id`, la clave de la tabla, que es de toda la plataforma. Quien
      // tecleaba el «12» de su lista encontraba el presupuesto cuyo id es 12 — otro documento.
      prisma.quote.findMany({
        where: {
          merchantId: mid,
          OR: [
            ...(porNumero && cabeEnColumnaInt(porNumero.quoteNumber) ? [porNumero] : []),
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true, quoteNumber: true, revision: true,
          status: true, total: true, currency: true, createdAt: true,
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

    return res.json({
      customers,
      // SCRUM-1483: el número viaja HECHO (`numeroVisible`) y la secuencia en crudo NO viaja: con
      // ella en la mano el navegador compondría su propio número. El `id` sigue: abre la ficha.
      quotes: quotes.map(({ quoteNumber, revision, ...resto }) => ({
        ...resto,
        numeroVisible: numeroVisibleDelPresupuesto({ quoteNumber, revision }),
      })),
      invoices,
    });
  } catch (err) {
    console.error('[GET /admin/search]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

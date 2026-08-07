// src/modules/invoicing/app/routes/libroRegistro.routes.ts — SCRUM-296 (A6).
//
// Fichero NUEVO, y a propósito: el libro NO se cuelga de `invoicesAdmin.routes.ts`. Ese fichero
// es camino de emisión (allocateInvoiceNumber, applyVeriFactu), y la regla 38 permite LEERLO pero
// no tocarlo. Añadirle una ruta más no cambiaría el sellado, pero en un diff eso no se distingue:
// el libro vive aparte y se monta aparte.
//
// Solo lectura. Ni un `create`, ni un `update`.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { leerLibroRegistro } from '../../domain/libroRegistro.repo';

const router = Router();

/** Fecha del query string, o `undefined`. Nunca una fecha inventada. */
function fechaDe(valor: unknown): Date | undefined {
  if (typeof valor !== 'string' || valor === '') return undefined;
  const d = new Date(valor);
  // `new Date('lo que sea')` es `Invalid Date`, y compararla no lanza: filtraría por NADA y el
  // libro saldría vacío. Un libro vacío se lee como «no facturaste», así que un rango ilegible
  // tiene que ser `undefined` (todo el ejercicio), nunca un filtro silencioso.
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * GET /admin/libro-registro · el libro de facturas emitidas de ESTE merchant.
 *
 * `req.merchantId` lo inyecta `requireAuth` y viaja hasta las tres consultas del lector (regla 2).
 */
router.get('/', async (req, res) => {
  try {
    const libro = await leerLibroRegistro(prisma, {
      merchantId: req.merchantId,
      desde: fechaDe(req.query.desde),
      hasta: fechaDe(req.query.hasta),
    });
    return res.json(libro);
  } catch (err) {
    console.error('[GET /admin/libro-registro]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

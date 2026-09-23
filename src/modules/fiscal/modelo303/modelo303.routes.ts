// src/modules/fiscal/modelo303/modelo303.routes.ts — SCRUM-295 (A5).
//
// Solo lectura sobre facturas ya emitidas (regla 38): no compone números, no sella, no escribe.
// Y regla 24: esto se construye, no se enciende — el resultado lleva su aviso de «orientativo»
// dentro, y no hay pantalla todavía.
import { Router } from 'express';
import { prisma } from '../../../core/db/prisma';
import { leerModelo303 } from './modelo303.repo';
import { zonaDelMerchant, diaNaturalEn } from '../../../core/zonaDelMerchant'; // SCRUM-735

const router = Router();

/** Trimestre natural del `mes` (1-12). Es el del calendario, no una preferencia. */
function trimestreDe(mes: number): number {
  return Math.floor((mes - 1) / 3) + 1;
}

router.get('/', async (req, res) => {
  try {
    // SCRUM-735 (GO comentario 16573): «el año/trimestre EN CURSO» salía de
    // `ahora.getFullYear()/getMonth()` — el reloj del PROCESO (Railway va en UTC), no el del
    // merchant. En la madrugada española de cada cambio de trimestre (y de año) eso devolvía el
    // periodo ANTERIOR — medido en docs/master/SCRUM-735.md §4.
    const ahora = new Date();
    const zona = zonaDelMerchant(await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { timezone: true },
    }));
    const [anioNatural, mesNatural] = diaNaturalEn(ahora, zona).split('-').map(Number);
    const año = Number(req.query.year) || anioNatural;
    // Sin trimestre en la petición se usa el EN CURSO. No el anterior: quien abre esto en mayo
    // está mirando lo que lleva del 2T, y devolverle el 1T sin decirlo sería contestar a otra
    // pregunta. El periodo devuelto viaja siempre en `desde`/`hasta`.
    const trimestre = Number(req.query.quarter) || trimestreDe(mesNatural);

    return res.json(await leerModelo303(prisma, { merchantId: req.merchantId, año, trimestre }));
  } catch (err) {
    console.error('[GET /admin/modelo-303]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

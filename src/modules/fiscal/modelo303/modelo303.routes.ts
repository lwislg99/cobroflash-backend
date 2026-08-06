// src/modules/fiscal/modelo303/modelo303.routes.ts — SCRUM-295 (A5).
//
// Solo lectura sobre facturas ya emitidas (regla 38): no compone números, no sella, no escribe.
// Y regla 24: esto se construye, no se enciende — el resultado lleva su aviso de «orientativo»
// dentro, y no hay pantalla todavía.
import { Router } from 'express';
import { prisma } from '../../../core/db/prisma';
import { leerModelo303 } from './modelo303.repo';

const router = Router();

/** Trimestre natural del `mes` (0-11). Es el del calendario, no una preferencia. */
function trimestreDe(mes: number): number {
  return Math.floor(mes / 3) + 1;
}

router.get('/', async (req, res) => {
  try {
    const ahora = new Date();
    const año = Number(req.query.year) || ahora.getFullYear();
    // Sin trimestre en la petición se usa el EN CURSO. No el anterior: quien abre esto en mayo
    // está mirando lo que lleva del 2T, y devolverle el 1T sin decirlo sería contestar a otra
    // pregunta. El periodo devuelto viaja siempre en `desde`/`hasta`.
    const trimestre = Number(req.query.quarter) || trimestreDe(ahora.getMonth());

    return res.json(await leerModelo303(prisma, { merchantId: req.merchantId, año, trimestre }));
  } catch (err) {
    console.error('[GET /admin/modelo-303]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

// src/modules/fiscal/librosAeat/librosAeat.routes.ts — SCRUM-325 (E4).
//
// Fichero NUEVO y montado aparte, por el mismo motivo que el de A6: el camino de emisión no se
// toca ni se roza (regla 38). Aquí no hay un solo `create` ni `update`.
import { Router } from 'express';
import { prisma } from '../../../core/db/prisma';
import { leerLibroExpedidasDelTrimestre } from './librosAeat.repo';
import { csvLibroExpedidas, nombreFicheroExpedidas } from './librosAeatCsv';

const router = Router();

/** Entero del query string dentro de un rango, o `null`. Nunca un valor inventado por defecto. */
function enteroEntre(valor: unknown, min: number, max: number): number | null {
  if (typeof valor !== 'string' || valor === '') return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/**
 * `GET /admin/libros/expedidas.csv?año=2026&trimestre=3`
 *
 * ⚠️ AÑO Y TRIMESTRE SON OBLIGATORIOS, y es deliberado. El export de SCRUM-244 sin fechas
 * descarga TODO el histórico (medido en SCRUM-321 Q1); aquí eso sería peor que inútil: un fichero
 * que dice ser de un periodo y trae otro es justo la clase de documento que no se puede entregar.
 * Sin periodo legible → 400, y no se emite nada.
 */
router.get('/expedidas.csv', async (req, res) => {
  const año = enteroEntre(req.query['año'] ?? req.query.ano, 2000, 2100);
  const trimestre = enteroEntre(req.query.trimestre, 1, 4);
  if (año === null || trimestre === null) {
    return res.status(400).json({
      error: 'periodo_invalido',
      // Sin microcopy: el mensaje que vea el profesional lo aprueba el fundador (regla 30).
      detalle: '[PENDIENTE microcopy oficial]',
    });
  }

  const { filas } = await leerLibroExpedidasDelTrimestre(prisma as any, {
    merchantId: req.merchantId!,
    año,
    trimestre,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreFicheroExpedidas(año, trimestre)}"`);
  // Sin caché: un libro es una foto de un instante y dos descargas del mismo trimestre pueden
  // diferir legítimamente (una factura nueva del periodo). Servir una copia vieja sería mentir.
  res.setHeader('Cache-Control', 'no-store');
  return res.send(csvLibroExpedidas(filas));
});

export default router;

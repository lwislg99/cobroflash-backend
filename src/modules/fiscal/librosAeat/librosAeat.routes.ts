// src/modules/fiscal/librosAeat/librosAeat.routes.ts — SCRUM-325 (E4).
//
// Fichero NUEVO y montado aparte, por el mismo motivo que el de A6: el camino de emisión no se
// toca ni se roza (regla 38). Aquí no hay un solo `create` ni `update`.
import { Router } from 'express';
import { prisma } from '../../../core/db/prisma';
import { leerLibroExpedidasDelTrimestre, leerLibroRecibidasDelTrimestre } from './librosAeat.repo';
import {
  csvLibroExpedidas, nombreFicheroExpedidas, csvLibroRecibidas, nombreFicheroRecibidas,
} from './librosAeatCsv';

const router = Router();

/** Entero del query string, o `null`. Nunca un valor inventado por defecto. */
function entero(valor: unknown): number | null {
  if (typeof valor !== 'string' || valor === '') return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}

/**
 * El trimestre sí tiene rango, y no es arbitrario: **T1 a T4 es lo que hay**, y `rangoTrimestre`
 * recorta fuera de eso en silencio (`Math.min(4, Math.max(1, …))`), así que un T7 se convertiría
 * en T4 y el fichero diría ser de un periodo que no se pidió.
 *
 * ⚠️ EL AÑO NO LLEVA RANGO, y se quitó a conciencia (decisión del asesor, 7-ago-2026). El
 * 2000-2100 que había aquí me lo inventé yo: **una regla que nadie decidió acaba rechazando algo
 * legítimo**. Lo que aquel rango intentaba mal —proteger del error de dedo, 2062 por 2026— se
 * resuelve donde de verdad se nota: diciendo que el periodo salió VACÍO. Ver la cabecera
 * `X-Yaqu-Filas` de abajo.
 */
function trimestre(valor: unknown): number | null {
  const n = entero(valor);
  return n !== null && n >= 1 && n <= 4 ? n : null;
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
  const año = entero(req.query['año'] ?? req.query.ano);
  const tri = trimestre(req.query.trimestre);
  if (año === null || tri === null) {
    return res.status(400).json({
      error: 'periodo_invalido',
      // Microcopy APROBADA el 7-ago-2026.
      detalle: 'No reconozco ese periodo. Elige un trimestre (T1 a T4) y un año.',
    });
  }

  const { filas, miradas } = await leerLibroExpedidasDelTrimestre(prisma as any, {
    merchantId: req.merchantId!,
    año,
    trimestre: tri,
  });

  // 🔴 QUE EL PERIODO SALGA VACÍO NO PUEDE SER SILENCIOSO.
  //
  // Quien teclea 2062 en vez de 2026 recibe HOY el mismo fichero que quien no facturó ese
  // trimestre, y son cosas distintas. Es el defecto de siempre —dos situaciones producen la misma
  // pantalla— y aquí acaba en un CSV que se le enseña a un asesor.
  //
  // El fichero SE SIGUE ENTREGANDO: un libro vacío es una respuesta legítima y a veces es
  // justo lo que se necesita (constancia de que no se facturó). Lo que se añade es la SEÑAL, para
  // que la pantalla pueda decirlo. `miradas` viaja también: distingue «no hay en el periodo» de
  // «no había facturas que mirar» (ver el suelo de `exigirLibroLegible`).
  res.setHeader('X-Yaqu-Filas', String(filas.length));
  res.setHeader('X-Yaqu-Miradas', String(miradas));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreFicheroExpedidas(año, tri)}"`);
  // Sin caché: un libro es una foto de un instante y dos descargas del mismo trimestre pueden
  // diferir legítimamente (una factura nueva del periodo). Servir una copia vieja sería mentir.
  res.setHeader('Cache-Control', 'no-store');
  return res.send(csvLibroExpedidas(filas));
});

/**
 * `GET /admin/libros/recibidas.csv?año=2026&trimestre=3` — SCRUM-426.
 *
 * Mismo contrato que expedidas: periodo OBLIGATORIO, sin caché, y las dos cabeceras de señal.
 * Aquí NO se construye el libro ni se calcula nada: se llama al motor de A6 y se pinta.
 */
router.get('/recibidas.csv', async (req, res) => {
  const año = entero(req.query['año'] ?? req.query.ano);
  const tri = trimestre(req.query.trimestre);
  if (año === null || tri === null) {
    return res.status(400).json({
      error: 'periodo_invalido',
      // Microcopy APROBADA el 7-ago-2026 (la misma de expedidas: misma decisión, mismo texto).
      detalle: 'No reconozco ese periodo. Elige un trimestre (T1 a T4) y un año.',
    });
  }

  const { filas, miradas, avisos } = await leerLibroRecibidasDelTrimestre(prisma as any, {
    merchantId: req.merchantId!, año, trimestre: tri,
  });

  res.setHeader('X-Yaqu-Filas', String(filas.length));
  res.setHeader('X-Yaqu-Miradas', String(miradas));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreFicheroRecibidas(año, tri)}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.send(csvLibroRecibidas(filas, avisos));
});

export default router;

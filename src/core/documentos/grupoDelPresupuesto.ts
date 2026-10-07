// src/core/documentos/grupoDelPresupuesto.ts — SCRUM-1490
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL GRUPO DE REVISIONES DE UN PRESUPUESTO ES {NEGOCIO, AÑO DE LA SERIE, NÚMERO}.
//
// La serie de presupuestos es ANUAL (SCRUM-592): el 12 de 2026 y el 12 de 2027 son dos documentos.
// Hasta SCRUM-1490 el grupo se armaba por {negocio, número} en tres sitios, y el año se deducía
// del `createdAt` de cada fila. Para un original vale: se numera en la transacción que lo crea.
// Para una REVISIÓN no: es una fila nueva, con su fecha, y la `.1` de diciembre creada en enero
// salía con el nombre de otro documento. Con las dos secuencias en la tabla, leer el grupo lanzaba
// `RevisionesAmbiguas` y la ficha contestaba 500.
//
// Ahora el año está guardado en la fila (`Quote.seriesYear`). Lo escribe quien reserva el número
// y la revisión hereda el de su original.
//
// ── LA FILA VIEJA, Y POR QUÉ ESE `??` NO ES UN DEFECTO DISFRAZADO ────────────────────────
//
// Una fila anterior a la columna lleva `seriesYear` a NULL, y su año se lee de `createdAt` en la
// zona del negocio: la MISMA función que usó `allocateQuoteNumber` al numerarla. Es exacto para
// todo original, y para una revisión mientras su grupo tenga un solo original; eso deja de ser
// cierto el 1-ene-2027, y por eso existe el relleno (`scripts/rellenar-anio-de-la-serie.mjs`).
// El conjunto que se lee así es CERRADO: los cuatro caminos que escriben un presupuesto numerado
// guardan el año, y lo censa `tests/scrum1490-el-anio-de-la-serie.test.mjs`.
//
// ⚠️ Si un negocio declara su zona DESPUÉS de numerar, el año de sus filas viejas sin rellenar se
// leería con la zona nueva. Hoy nadie escribe `Merchant.timezone`; la pantalla que lo permita no
// debe salir antes del relleno (SCRUM-1490, «Con qué se cruza»).
import type { Prisma } from '@prisma/client';
import { zonaDelMerchant, diaNaturalEn, inicioDelDiaEn } from '../zonaDelMerchant';

type ConZona = { timezone?: string | null } | null | undefined;

/**
 * El año de la serie de un presupuesto: el guardado; si la fila es anterior a la columna, el de
 * su `createdAt` en la zona del negocio. Sin ninguno de los dos LANZA: «no pude mirar» no es un año.
 */
export function anioDeLaSerie(
  q: { seriesYear?: number | null; createdAt?: Date | string | null },
  merchant?: ConZona,
): number {
  if (q.seriesYear != null) return q.seriesYear;
  const d = q.createdAt ? new Date(q.createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) {
    throw new Error('anio_de_la_serie_ilegible: la fila no trae `seriesYear` ni un `createdAt` legible');
  }
  return Number(diaNaturalEn(d, zonaDelMerchant(merchant)).slice(0, 4));
}

/**
 * Las filas de ESE año de serie: las que lo guardan, y las viejas (NULL) creadas dentro de él en
 * la zona del negocio. Las dos ramas dicen lo mismo que `anioDeLaSerie`; si una cambia, la otra.
 */
export function whereDelAnio(anio: number, merchant?: ConZona): Prisma.QuoteWhereInput {
  const zona = zonaDelMerchant(merchant);
  return {
    OR: [
      { seriesYear: anio },
      {
        seriesYear: null,
        createdAt: { gte: inicioDelDiaEn(`${anio}-01-01`, zona), lt: inicioDelDiaEn(`${anio + 1}-01-01`, zona) },
      },
    ],
  };
}

/** El `where` del grupo de revisiones: {negocio, año de la serie, número}. */
export function whereDelGrupo(
  grupo: { merchantId: number; quoteNumber: number; anio: number },
  merchant?: ConZona,
): Prisma.QuoteWhereInput {
  return { merchantId: grupo.merchantId, quoteNumber: grupo.quoteNumber, ...whereDelAnio(grupo.anio, merchant) };
}

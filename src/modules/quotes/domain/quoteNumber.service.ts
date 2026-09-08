/**
 * Numeración de presupuestos — serie ANUAL correlativa por merchant (SCRUM-592, DOC-02).
 *
 * ── DE DÓNDE VIENE ──────────────────────────────────────────────────────────────────────
 *
 * El número visible era el `id` global de la tabla `quotes`, que delataba el volumen de la
 * plataforma (A1.2): el primer presupuesto de un merchant nuevo salía como «#47». Se cambió por
 * un contador propio, `quoteNumber`, y el `id` quedó SOLO para links/API — que es lo que hoy
 * permite renumerar sin romper ningún enlace.
 *
 * ── LO QUE CAMBIA EN SCRUM-592, Y POR QUÉ NO ES SÓLO EL FORMATO ─────────────────────────
 *
 * El formato pasa a `P260001`. Pero la serie ANUAL obliga a algo más profundo:
 *
 * 🔴 `{ increment: 1 }` DEJA DE SER SUFICIENTE. Ese increment es atómico y bastaba mientras el
 * contador sólo subía. Con reinicio anual hay que LEER el año de la serie y DECIDIR si el
 * siguiente es `nextQuoteNumber` o `1` — un read-then-write, que en READ COMMITTED no serializa:
 * dos creaciones simultáneas en el primer presupuesto del año leerían las dos «serie vacía» y
 * las dos escribirían el 1.
 *
 * Es exactamente lo que `allocateAlbaranNumber` ya dejó escrito al resolver SCRUM-234, con estas
 * palabras: «también tiene reinicio anual, así que también va con cerrojo y no con
 * `{ increment: 1 }`». Aquí se sigue esa decisión en vez de inventar otra: mismo
 * `pg_advisory_xact_lock`, mismo namespace (`SERIE_LOCK_NS`), misma forma.
 *
 * ── LA SEGUNDA RED, QUE NO ESTÁ Y SE DICE ───────────────────────────────────────────────
 *
 * `Invoice` y `Albaran` llevan `@@unique([merchantId, number])`; **`Quote` no lleva ninguna**.
 * O sea que hoy la correlatividad del presupuesto vive SÓLO en este fichero: un `INSERT` a mano
 * o un segundo camino que no pase por aquí duplicaría sin que nada lo impida. Está medido y
 * llevado a los dos fundadores como ticket propio — y va DESPUÉS de renumerar, porque una
 * restricción añadida antes puede fallar sobre datos que hoy duplican.
 *
 * 🔴 ESTE CÓDIGO NO DEPENDE DE QUE ESA RESTRICCIÓN EXISTA. El cerrojo es la garantía; el
 * `unique` sería la red por si alguien escribe un camino nuevo. Cuando llegue, aquí no hay que
 * tocar nada.
 */
import { Prisma } from '@prisma/client';
import { SERIE_LOCK_NS } from '../../invoicing/domain/invoiceNumber.service'; // SCRUM-234: un solo namespace
import {
  SERIES, formatoNumeroDocumento, secuenciaDelAnio, esNumeroNuevo,
} from '../../../core/documentos/formatoNumero';

/**
 * Display canónico del número de un presupuesto.
 *
 * 🔴 EL FALLBACK AL `id` GLOBAL SE RETIRA (SCRUM-592). Hasta hoy, un presupuesto sin
 * `quoteNumber` se pintaba como `#280` — el id de la tabla, o sea **el volumen de toda la
 * plataforma enseñado al profesional**, que es justo lo que A1.2 vino a esconder. Medido: en
 * staging hay uno así ahora mismo.
 *
 * Ahora un presupuesto sin número se dice SIN NÚMERO. Es información honesta: ese documento
 * está pendiente de la renumeración, y enseñar un id ajeno en su lugar no lo arregla — lo
 * disfraza. El texto no es microcopy nueva: es el guion que ya usan las listas para un dato que
 * falta.
 */
export const SIN_NUMERO = '—';

/**
 * 🔴 EL NÚMERO SE DERIVA, NO SE GUARDA — y no hay columna de texto para él.
 *
 * El DATO son dos: la secuencia (`quoteNumber`) y el año de su serie. `P260001` es la forma de
 * escribirlos. Guardar además el texto sería guardar el derivado junto al dato, que es
 * exactamente lo que ha mordido a esta casa varias veces esta semana: en cuanto los dos existen,
 * pueden discrepar, y entonces hay que decidir cuál manda.
 *
 * El AÑO sale de `createdAt`, y es correcto por construcción: la reserva del número ocurre
 * DENTRO de la misma transacción que crea la fila, así que `createdAt` es el instante en que se
 * numeró. No es una aproximación — es el mismo reloj.
 */
export function displayQuoteNumber(
  q: { quoteNumber?: number | null; createdAt?: Date | string | null },
): string {
  if (q.quoteNumber == null) return SIN_NUMERO;
  const d = q.createdAt ? new Date(q.createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return SIN_NUMERO;
  return formatoNumeroDocumento(SERIES.presupuesto, d.getFullYear(), q.quoteNumber);
}

/**
 * Reserva el siguiente número de la serie de presupuestos y avanza el contador.
 *
 * DEBE llamarse dentro de la misma transacción que crea el presupuesto: así, si el `create`
 * falla, la reserva se deshace con él y la serie no deja huecos.
 *
 * Devuelve las dos cosas —el número formateado y la secuencia— porque la fila guarda ambas: el
 * texto es lo que se enseña y se busca, y el entero es lo que hace posible ordenar y detectar
 * saltos sin volver a parsear.
 */
export async function allocateQuoteNumber(
  tx: Prisma.TransactionClient,
  merchantId: number,
  now = new Date(),
): Promise<{ numero: string; seq: number; year: number }> {
  // 🔴 PRIMERA SENTENCIA DE LA TRANSACCIÓN, igual que en albaranes y facturas. Serializa a los
  // que compiten por la MISMA serie (el namespace es fijo y la clave es el merchant), y se
  // suelta solo al terminar la transacción: no hay cerrojo que liberar a mano ni que se olvide.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;

  const year = now.getFullYear();
  const m = await tx.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, nextQuoteNumber: true, quoteSeriesYear: true },
  });
  if (!m) throw new Error('merchant_not_found');

  const seq = secuenciaDelAnio(
    { seriesYear: m.quoteSeriesYear, nextNumber: m.nextQuoteNumber }, year,
  );
  await tx.merchant.update({
    where: { id: merchantId },
    data: { quoteSeriesYear: year, nextQuoteNumber: seq + 1 },
  });
  return { numero: formatoNumeroDocumento(SERIES.presupuesto, year, seq), seq, year };
}

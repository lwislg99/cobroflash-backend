/**
 * Numeración de facturas — serie anual por merchant (Sprint SPAIN).
 *
 * Formato: `2026-CF-001` (año - prefijo del merchant - secuencia correlativa).
 * Al cambiar de año natural la secuencia vuelve a 1 (serie nueva), como exige
 * la práctica habitual del Reglamento de Facturación español (series por año).
 *
 * ÚNICO punto del backend que asigna números de factura: antes había 4 sitios
 * con 3 formatos distintos (CF000007, CF-00005 y un CF-INV aleatorio) que
 * además colisionaban entre merchants al ser `number` único global.
 */
import { Prisma } from '@prisma/client';
import { getEmissionMode } from './emission.service';

/**
 * Justificantes de cobro (V0-0): los merchants ES reales con `INVOICING_ES_ENABLED`
 * off NO consumen la serie fiscal — reciben una referencia `J-YYYYMMDD-XXXX` fuera
 * de toda serie de facturación ("sin numeración de factura", Parte M).
 */
export const RECEIPT_NUMBER_PREFIX = 'J-';

export function isReceiptNumber(number: string | null | undefined): boolean {
  return typeof number === 'string' && number.startsWith(RECEIPT_NUMBER_PREFIX);
}

export function makeReceiptNumber(now = new Date()): string {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${RECEIPT_NUMBER_PREFIX}${ymd}-${rand}`;
}

/** Formatea un número de la serie. `rectifying` usa la serie propia de rectificativas (R). */
export function formatInvoiceNumber(
  prefix: string | null | undefined,
  year: number,
  seq: number,
  rectifying = false,
): string {
  const p = (prefix ?? '').trim() || 'CF';
  return `${year}-${p}${rectifying ? '-R' : ''}-${String(seq).padStart(3, '0')}`;
}

/** Secuencia que toca emitir: si la serie guardada no es la del año en curso, empieza serie nueva en 1. */
export function resolveSeriesSeq(
  m: { invoiceSeriesYear: number | null; nextInvoiceNumber: number },
  year: number,
): number {
  return m.invoiceSeriesYear === year ? m.nextInvoiceNumber : 1;
}

/**
 * Reserva el siguiente número de la serie anual del merchant y avanza el contador.
 * DEBE llamarse dentro de la misma transacción que crea la factura, para que
 * un fallo en el create no deje huecos en la serie.
 *
 * `rectifying: true` usa la serie separada de rectificativas (2026-CF-R-001),
 * obligatoria legalmente. Ambas series comparten `invoiceSeriesYear`: al cambiar
 * de año se resetean LOS DOS contadores.
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  merchantId: number,
  opts: { rectifying?: boolean } = {},
  now = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const m = await tx.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      email: true,
      country: true,
      invoiceSeriesPrefix: true,
      nextInvoiceNumber: true,
      nextRectInvoiceNumber: true,
      invoiceSeriesYear: true,
    },
  });
  if (!m) throw new Error('merchant_not_found');

  const rect = !!opts.rectifying;

  // V0-0: merchant ES real sin INVOICING_ES_ENABLED → justificante, no factura.
  // No avanza NINGÚN contador de la serie fiscal. Las rectificativas no existen
  // para justificantes (solo rectifican facturas emitidas — regla 29).
  if (getEmissionMode(m) === 'receipt') {
    if (rect) throw new Error('invoicing_es_disabled');
    return makeReceiptNumber(now);
  }
  const sameYear = m.invoiceSeriesYear === year;
  const seq = rect
    ? (sameYear ? m.nextRectInvoiceNumber : 1)
    : resolveSeriesSeq(m, year);

  await tx.merchant.update({
    where: { id: merchantId },
    data: {
      invoiceSeriesYear: year,
      ...(rect
        ? { nextRectInvoiceNumber: seq + 1, ...(sameYear ? {} : { nextInvoiceNumber: 1 }) }
        : { nextInvoiceNumber: seq + 1, ...(sameYear ? {} : { nextRectInvoiceNumber: 1 }) }),
    },
  });
  return formatInvoiceNumber(m.invoiceSeriesPrefix, year, seq, rect);
}

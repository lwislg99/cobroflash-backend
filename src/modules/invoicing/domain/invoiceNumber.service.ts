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
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  merchantId: number,
  now = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const m = await tx.merchant.findUnique({
    where: { id: merchantId },
    select: { invoiceSeriesPrefix: true, nextInvoiceNumber: true, invoiceSeriesYear: true },
  });
  if (!m) throw new Error('merchant_not_found');

  const seq = resolveSeriesSeq(m, year);
  await tx.merchant.update({
    where: { id: merchantId },
    data: { nextInvoiceNumber: seq + 1, invoiceSeriesYear: year },
  });
  return formatInvoiceNumber(m.invoiceSeriesPrefix, year, seq);
}

/**
 * Numeración de albaranes — SCRUM-14 (ALBARAN-1).
 *
 * Formato: `ALB-2026-001` (prefijo fijo - año - secuencia correlativa por merchant).
 * Serie NO FISCAL e independiente de la de facturas (Parte L del master): jamás
 * pasa por getEmissionMode/VeriFactu ni por la serie J- de justificantes.
 * Clonado del patrón de invoiceNumber.service.ts: contador en Merchant, reserva
 * DENTRO de la transacción del create (sin huecos si el create falla) y reset
 * anual (albaranSeriesYear).
 */
import { Prisma } from '@prisma/client';

export const ALBARAN_NUMBER_PREFIX = 'ALB-';

export function isAlbaranNumber(numero: string | null | undefined): boolean {
  return typeof numero === 'string' && numero.startsWith(ALBARAN_NUMBER_PREFIX);
}

export function formatAlbaranNumber(year: number, seq: number): string {
  return `${ALBARAN_NUMBER_PREFIX}${year}-${String(seq).padStart(3, '0')}`;
}

/** Secuencia que toca emitir: serie de otro año → empieza serie nueva en 1. */
export function resolveAlbaranSeq(
  m: { albaranSeriesYear: number | null; nextAlbaranNumber: number },
  year: number,
): number {
  return m.albaranSeriesYear === year ? m.nextAlbaranNumber : 1;
}

/**
 * Reserva el siguiente número de la serie de albaranes del merchant y avanza el
 * contador. DEBE llamarse dentro de la misma transacción que crea el albarán.
 */
export async function allocateAlbaranNumber(
  tx: Prisma.TransactionClient,
  merchantId: number,
  now = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const m = await tx.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, nextAlbaranNumber: true, albaranSeriesYear: true },
  });
  if (!m) throw new Error('merchant_not_found');

  const seq = resolveAlbaranSeq(m, year);
  await tx.merchant.update({
    where: { id: merchantId },
    data: { albaranSeriesYear: year, nextAlbaranNumber: seq + 1 },
  });
  return formatAlbaranNumber(year, seq);
}

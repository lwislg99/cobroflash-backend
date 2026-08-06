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
import { SERIE_LOCK_NS } from '../../invoicing/domain/invoiceNumber.service'; // SCRUM-234: un solo namespace

export const ALBARAN_NUMBER_PREFIX = 'ALB-';

export function isAlbaranNumber(numero: string | null | undefined): boolean {
  return typeof numero === 'string' && numero.startsWith(ALBARAN_NUMBER_PREFIX);
}

export function formatAlbaranNumber(year: number, seq: number): string {
  return `${ALBARAN_NUMBER_PREFIX}${year}-${String(seq).padStart(3, '0')}`;
}

/**
 * 🔴 SCRUM-306 (C7) · LA TRAMPA QUE ESTA FUNCIÓN HEREDÓ, Y QUE AQUÍ SE CIERRA.
 *
 * La forma original era exactamente la de `resolveSeriesSeq` (facturas):
 *
 *     return m.albaranSeriesYear === year ? m.nextAlbaranNumber : 1;
 *
 * Con ella, **fijar el número sin fijar el año reinicia la serie en 1 en silencio**. Quien
 * escribiera `nextAlbaranNumber = 50` sin tocar `albaranSeriesYear` obtendría `ALB-2026-001`, no
 * el 50 — y ese 001 o revienta contra el índice único, o duplica una referencia que ya se le
 * enseñó a un cliente y que se cita en la factura recapitulativa.
 *
 * Hoy no es alcanzable porque **ninguna ruta edita el contador de albaranes**. Se cierra AHORA
 * porque el ticket de C7 pedía crear justo esa ruta: cerrarla después habría sido cerrarla tarde.
 *
 * ⚠️ EL CASO SE DISTINGUE POR EL AÑO NULO, NO POR EL CONTADOR. Un `albaranSeriesYear` de OTRO año
 * con el contador en 50 es el **reinicio anual legítimo** (1 de enero) y tiene que devolver 1. Lo
 * que no puede pasar es que el año esté **sin fijar** y el contador ya haya avanzado: eso no es una
 * serie nueva, es una serie a la que alguien le movió el número por debajo.
 *
 * Falla RUIDOSAMENTE en vez de caer al 1 por defecto — el suelo del propio ticket: un albarán con
 * un número de otra serie es un documento mal identificado, y mejor no crearlo que crearlo mal.
 *
 * 📌 HALLAZGO DE OTRO CARRIL (regla 9): `resolveSeriesSeq` (facturas) tiene la MISMA forma. Hoy no
 * es explotable porque su ruta (`app.ts`) escribe `nextInvoiceNumber` e `invoiceSeriesYear`
 * JUNTOS, siempre. No se toca aquí: es el camino de emisión (regla 38) y no es este ticket.
 */
export class AlbaranSerieSinAnioError extends Error {
  constructor(nextAlbaranNumber: number) {
    super(
      `El contador de albaranes está en ${nextAlbaranNumber} pero la serie no tiene año fijado. ` +
      'Se habría reiniciado en 1 en silencio.',
    );
    this.name = 'AlbaranSerieSinAnioError';
  }
}

/** Secuencia que toca emitir: serie de otro año → empieza serie nueva en 1. */
export function resolveAlbaranSeq(
  m: { albaranSeriesYear: number | null; nextAlbaranNumber: number },
  year: number,
): number {
  if (m.albaranSeriesYear === year) return m.nextAlbaranNumber;
  if (m.albaranSeriesYear == null && m.nextAlbaranNumber > 1) {
    throw new AlbaranSerieSinAnioError(m.nextAlbaranNumber);
  }
  return 1;
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
  // SCRUM-234 · misma carrera y mismo arreglo que `allocateInvoiceNumber`: read-then-write con
  // valor absoluto, que no serializa en READ COMMITTED. También tiene reinicio anual
  // (`albaranSeriesYear`), así que también va con cerrojo y no con `{ increment: 1 }`.
  // El albarán no es un documento fiscal, pero su serie se le muestra al cliente y se cita en
  // la factura recapitulativa: dos albaranes con el mismo número son dos referencias que no
  // distinguen a qué parte de la obra corresponde cada cosa.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;
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

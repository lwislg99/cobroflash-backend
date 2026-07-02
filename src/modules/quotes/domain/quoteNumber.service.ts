/**
 * Numeración de presupuestos — contador secuencial POR MERCHANT (A1.2).
 *
 * El número visible era el `id` global de la tabla `quotes`, que delataba el
 * volumen de la plataforma: el primer presupuesto de un merchant nuevo salía
 * como "#47". El número que ve el usuario es `quoteNumber` (1, 2, 3… por
 * merchant); el `id` global queda SOLO para links/API (/pay/quote/:id, botones
 * de plantilla WhatsApp) y nunca se muestra.
 *
 * Sin serie anual: el presupuesto no es un documento fiscal (la factura sí
 * la tiene — ver invoiceNumber.service.ts). El justificante J- tampoco se
 * toca: va deliberadamente fuera de toda serie (V0-0 / Parte M).
 */
import { Prisma } from '@prisma/client';

/**
 * Display canónico: "#3". Fallback al id global para quotes anteriores al
 * backfill (quoteNumber null).
 */
export function displayQuoteNumber(q: { quoteNumber?: number | null; id: number }): string {
  return `#${q.quoteNumber ?? q.id}`;
}

/**
 * Reserva el siguiente número de presupuesto del merchant y avanza el contador.
 * DEBE llamarse dentro de la misma transacción que crea el quote (mismo patrón
 * que allocateInvoiceNumber). El increment es atómico: dos creaciones
 * concurrentes no pueden recibir el mismo número.
 */
export async function allocateQuoteNumber(
  tx: Prisma.TransactionClient,
  merchantId: number,
): Promise<number> {
  const updated = await tx.merchant.update({
    where: { id: merchantId },
    data: { nextQuoteNumber: { increment: 1 } },
    select: { nextQuoteNumber: true },
  });
  return updated.nextQuoteNumber - 1;
}

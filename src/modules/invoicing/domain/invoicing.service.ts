// src/modules/invoicing/domain/invoicing.service.ts — SCRUM-17 (FISCAL-2)
// emitInvoice(): emisión de UNA factura DENTRO de una transacción, compartida entre la
// recapitulativa (FISCAL-2) y —cuando desbloquee— los anticipos/final (FISCAL-1, SCRUM-16).
//
// Política LAZY de PDF/QR (PENDING_PDF/PENDING_QR): VeriFactu + PDF se rellenan bajo demanda
// en `ensureInvoicePdf` (lib/invoicing.ts:54), igual que hoy hacen collect-rest / quoteAdmin /
// quotes.routes. Los justificantes (J-) NUNCA entran en VeriFactu: `allocateInvoiceNumber`
// decide la serie según `getEmissionMode`, y `isReceiptNumber` marca el tipo JUST (V0-0, regla 26).
//
// ⚠️ NO migra los 4 call-sites duplicados en este PR: dos de ellos (quotesAdmin.routes:192,
// invoicesAdmin R1) aplican VeriFactu INLINE; unificarlos a lazy cambiaría su comportamiento
// (regla 9 / decisión fundador). Se deja para un ticket aparte con su propia revisión.
import { Prisma } from '@prisma/client';
import { allocateInvoiceNumber, isReceiptNumber } from './invoiceNumber.service';
import type { ActorAudit } from '../../system/audit.service'; // SCRUM-207

export interface AlbaranRef {
  albaranId: number;
  numero: string;
  fecha: Date | string;
}

export interface EmitInvoiceInput {
  merchantId: number;
  customerId: number;
  total: string;              // Decimal(12,2) ya formateado ("218.90")
  currency: string;
  type?: string;              // default 'F1' (se fuerza 'JUST' si la serie sale J-); FISCAL-1 usará 'ANT'
  lines?: unknown;            // Invoice.lines Json — [{concept, qty, price, tax(fracción)}]
  albaranRefs?: AlbaranRef[]; // FISCAL-2: operaciones agrupadas
  quoteId?: number | null;
  stageLabel?: string | null;
  /** SCRUM-207 · OBLIGATORIO: quién emite. Los 2 llamadores de C7 son rutas de admin. */
  actor: ActorAudit;
}

/**
 * Crea la factura dentro de `tx` con número de serie asignado transaccionalmente. Política LAZY:
 * pdfUrl/qrData quedan en PENDING y VeriFactu se aplica al servir el PDF. Devuelve el Invoice creado.
 */
export async function emitInvoice(tx: Prisma.TransactionClient, input: EmitInvoiceInput) {
  const number = await allocateInvoiceNumber(tx, input.merchantId, {
    camino: 'C7', actor: input.actor,
  });
  return tx.invoice.create({
    data: {
      merchantId: input.merchantId,
      customerId: input.customerId,
      quoteId: input.quoteId ?? null,
      number,
      // V0-0 (regla 26): si la serie salió J- (merchant real sin INVOICING_ES_ENABLED) → JUST.
      type: isReceiptNumber(number) ? 'JUST' : (input.type ?? 'F1'),
      total: input.total,
      currency: input.currency,
      lines: (input.lines as any) ?? undefined,
      albaranRefs: (input.albaranRefs as any) ?? undefined,
      stageLabel: input.stageLabel ?? null,
      // LAZY: se rellenan bajo demanda en ensureInvoicePdf (VeriFactu + PDF).
      pdfUrl: 'PENDING_PDF',
      qrData: 'PENDING_QR',
      registerId: null,
    },
  });
}

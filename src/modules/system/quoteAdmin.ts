// src/modules/system/quoteAdmin.ts
import { prisma } from '../../core/db/prisma';
import { allocateInvoiceNumber, isReceiptNumber } from '../invoicing/domain/invoiceNumber.service';
import { buildBillingPlanView } from '../quotes/domain/billingPlanView'; // SCRUM-34
import { ensureQuoteDecisionToken } from '../quotes/domain/quoteToken.service'; // SCRUM-95

/**
 * Lista de presupuestos para el panel admin.
 */
export async function listQuotesAdmin(
  merchantId: number,
  search?: string,
  status?: string,
  dateFrom?: Date | null,
  dateTo?: Date | null,
  // SCRUM-148: filtro por AUTOR del presupuesto (`Quote.teamMemberId`), para el detalle por
  // miembro del hub de Equipo. `null` = los del PROPIETARIO (no tiene fila en team_members,
  // así que su autoría se guarda como null); `undefined` = sin filtrar. Distinguir null de
  // undefined es exactamente el motivo de no escribir aquí un `if (teamMemberId)`: con `0` o
  // `null` ese if es falso y el filtro "del propietario" se caería en silencio, devolviendo
  // TODOS los presupuestos del negocio bajo el nombre de una persona.
  teamMemberId?: number | null,
) {
  const where: any = { merchantId };

  if (teamMemberId !== undefined) where.teamMemberId = teamMemberId;

  if (status && status !== 'all') {
    where.status = status;
  }

  if (search && search.trim() !== '') {
    const s = search.trim();
    const maybeId = Number(s);

    where.OR = [
      // A1.2: el usuario busca por el número que VE (por merchant); el id global
      // se mantiene para no romper búsquedas antiguas.
      ...(Number.isFinite(maybeId) ? [{ id: maybeId }, { quoteNumber: maybeId }] : []),
      { customer: { name:  { contains: s, mode: 'insensitive' } } },
      { customer: { phone: { contains: s, mode: 'insensitive' } } },
    ];
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo)   where.createdAt.lte = dateTo;
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: true,
      charge: true,
    },
    orderBy: { id: 'desc' },
    take: 100,
  });

  return quotes.map((q) => {
    const primaryStatus =
      typeof q.status === 'string' ? q.status.toLowerCase() : 'draft';

    let derivedStatus = primaryStatus;

    if (primaryStatus === 'draft' && q.charge) {
      const cs =
        typeof q.charge.status === 'string'
          ? q.charge.status.toLowerCase()
          : '';

      if (cs === 'paid' || cs === 'succeeded') {
        derivedStatus = 'paid';
      } else if (cs === 'pending') {
        derivedStatus = 'pending';
      } else if (cs === 'expired') {
        derivedStatus = 'expired';
      }
    }

    return {
      id: q.id,
      number: q.quoteNumber ?? q.id, // A1.2: número visible por merchant (fallback pre-backfill)
      customerName: q.customer?.name ?? '—',
      customerPhone: q.customer?.phone ?? null,
      createdAt: q.createdAt,
      currency: q.currency ?? 'EUR',
      totalAmount: q.total,
      status: derivedStatus,
      method: q.charge?.method ?? null,
      chargeId: q.charge?.id ?? null,
      internalNotes: q.internalNotes ?? null,
    };
  });
}

/**
 * Detalle completo de un presupuesto para el panel admin.
 */
export async function getQuoteDetailAdmin(id: number, merchantId?: number) {
  // A12.1: scoping multi-tenant (regla 2) — un id ajeno = not found
  const quote = await prisma.quote.findFirst({
    where: { id, ...(merchantId != null ? { merchantId } : {}) },
    include: {
      merchant: true,
      customer: true,
      charge: true,
      Invoice: true,
    },
  });

  if (!quote) {
    throw new Error('quote_not_found');
  }

  // SCRUM-34: plan RESUELTO + siguiente tramo por CONTEO — la MISMA regla que usa
  // POST /admin/quotes/:id/invoice (plan[existingInvoices.length]) para que el label
  // de la UI nunca prometa un tramo distinto del que emitiría el endpoint.
  const planView = buildBillingPlanView(quote as any, (quote.Invoice || []).length);

  return {
    id: quote.id,
    number: quote.quoteNumber ?? quote.id, // A1.2: número visible por merchant
    // SCRUM-95: token opaco del enlace público (patrón payToken de Charge.receiptToken,
    // jobs.routes.ts:157) — lo consume la vista admin para el enlace "copiar" de fallback.
    payToken: await ensureQuoteDecisionToken(quote.id, prisma),
    status: quote.status,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,

    currency: quote.currency,
    total: quote.total,
    lines: quote.lines,
    pdfUrl: (quote as any).pdfUrl ?? null,
    signatureUrl: quote.signatureUrl ?? null,
    tiers: quote.tiers ?? null,
    selectedTierId: quote.selectedTierId ?? null,
    internalNotes: quote.internalNotes ?? null,
    
    merchant: {
      id: quote.merchant.id,
      name: quote.merchant.name,
      legalName: quote.merchant.legalName,
      taxId: quote.merchant.taxId,
      address: quote.merchant.address,
      whatsappPhone: quote.merchant.whatsappPhone,
      defaultCurrency: quote.merchant.defaultCurrency,
      logoUrl: quote.merchant.logoUrl,
    },

    customer: {
      id: quote.customer.id,
      name: quote.customer.name,
      phone: quote.customer.phone,
      email: quote.customer.email,
      notes: quote.customer.notes,
    },

    charge: quote.charge
      ? {
          id: quote.charge.id,
          status: quote.charge.status,
          method: quote.charge.method,
          amount: quote.charge.amount,
          currency: quote.charge.currency,
          expiresAt: quote.charge.expiresAt,
          reference: quote.charge.reference,
        }
      : null,

    invoices: quote.Invoice.map((inv) => ({
      id: inv.id,
      number: inv.number,
      total: inv.total,
      currency: inv.currency,
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt,
      status: inv.status,         // SCRUM-34: el front ya lo consumía sin viajar (CTAs viejos = SCRUM-35)
      stageLabel: inv.stageLabel, // SCRUM-34: etiqueta del tramo (custom); null en presets
    })),

    decision: {
      acceptedAt: quote.acceptedAt,
      rejectedAt: quote.rejectedAt,
      decisionChannel: quote.decisionChannel,
      decisionComment: quote.decisionComment,
      rejectionReason: quote.rejectionReason,
      paymentTerms: quote.paymentTerms,
      evidence: quote.evidence,
    },

    // SCRUM-34: plan de cobro resuelto para la UI (labels + % + importes exactos por
    // distributeStageAmounts) y siguiente tramo por conteo. hasCustomPlan distingue un
    // plan personalizado del default FULL_UPFRONT que resolveBillingPlan aplica a null.
    billingPlan: planView.billingPlan,
    nextStage: planView.nextStage,
    hasCustomPlan: planView.hasCustomPlan,
  };
}

/**
 * Marca un presupuesto como aceptado (solo estado, sin crear cobros).
 */
export async function acceptQuoteAdmin(
  quoteId: number,
  params: {
    channel?: 'backoffice' | 'whatsapp' | 'other';
    comment?: string;
    paymentTerms?: string;
    evidence?: any;
  } = {},
  merchantId?: number, // A12.1: scoping multi-tenant (regla 2)
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...(merchantId != null ? { merchantId } : {}) },
  });

  if (!quote) {
    throw new Error('quote_not_found');
  }

  if (quote.status === 'accepted') {
    return quote;
  }

  if (quote.status === 'rejected') {
    throw new Error('quote_already_rejected');
  }

  const now = new Date();

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: 'accepted',
      acceptedAt: now,
      rejectedAt: null,
      decisionChannel: params.channel ?? 'backoffice',
      decisionComment: params.comment ?? null,
      paymentTerms: params.paymentTerms ?? quote.paymentTerms,
      evidence: params.evidence ?? quote.evidence,
    },
  });

  return updated;
}

/**
 * Marca un presupuesto como rechazado.
 */
export async function rejectQuoteAdmin(
  quoteId: number,
  params: {
    channel?: 'backoffice' | 'whatsapp' | 'other';
    reason?: string;
    comment?: string;
    evidence?: any;
  } = {},
  merchantId?: number, // A12.1: scoping multi-tenant (regla 2)
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...(merchantId != null ? { merchantId } : {}) },
  });

  if (!quote) {
    throw new Error('quote_not_found');
  }

  if (quote.status === 'accepted') {
    throw new Error('quote_already_accepted');
  }

  if (quote.status === 'rejected') {
    return quote;
  }

  const now = new Date();

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: 'rejected',
      rejectedAt: now,
      acceptedAt: null,
      decisionChannel: params.channel ?? 'backoffice',
      rejectionReason: params.reason ?? null,
      decisionComment: params.comment ?? null,
      evidence: params.evidence ?? quote.evidence,
    },
  });

  return updated;
}

/**
 * Crear una factura 100% del presupuesto aceptado.
 * - Solo si status = accepted.
 * - Idempotente: si ya tiene factura, devuelve la existente.
 */
export async function createInvoiceFromQuoteAdmin(quoteId: number, merchantId?: number) {
  // A12.1: scoping multi-tenant (regla 2)
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...(merchantId != null ? { merchantId } : {}) },
    include: {
      merchant: true,
      customer: true,
      Invoice: true,
    },
  });

  if (!quote) {
    throw new Error('quote_not_found');
  }

  if (quote.status !== 'accepted') {
    throw new Error('quote_not_accepted');
  }

  if (!quote.merchant || !quote.customer) {
    throw new Error('quote_missing_fk');
  }

  if (quote.Invoice && quote.Invoice.length > 0) {
    return quote.Invoice[0];
  }

  const merchant = quote.merchant;

  const invoice = await prisma.$transaction(async (tx) => {
    const formattedNumber = await allocateInvoiceNumber(tx, merchant.id);
    return tx.invoice.create({
      data: {
        merchantId: merchant.id,
        customerId: quote.customerId,
        quoteId: quote.id,
        number: formattedNumber,
        type: isReceiptNumber(formattedNumber) ? 'JUST' : 'F1', // V0-0
        total: quote.total,
        currency: quote.currency,
        pdfUrl: 'PENDING',
        qrData: 'PENDING',       // 👈 requerido por Prisma
        registerId: null,        // 👈 opcional en tu schema
      },
    });
  });

  return invoice;
}

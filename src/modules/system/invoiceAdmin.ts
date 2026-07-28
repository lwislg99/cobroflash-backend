// src/modules/system/invoiceAdmin.ts
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { recalcJobCobradoForInvoice } from '../jobs/domain/job.service'; // SCRUM-28

// Listado para el BO (con filtros)
export async function listInvoicesAdmin(
  merchantId: number,
  status: string | 'all' = 'all',
  search?: string,
  dateFrom?: Date | null,
  dateTo?: Date | null,
) {
  const where: Prisma.InvoiceWhereInput = { merchantId };

  if (status && status !== 'all') {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search, mode: 'insensitive' } } },
      { customer: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as any).gte = dateFrom;
    if (dateTo)   (where.createdAt as any).lte = dateTo;
  }

  return prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      quote: { select: { id: true } },
    },
  });
}

// Detalle de una factura
export async function getInvoiceDetailAdmin(id: number, merchantId?: number) {
  // A21.3: scoping multi-tenant también en la LECTURA (regla 2)
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...(merchantId != null ? { merchantId } : {}) },
    include: {
      merchant: true,
      customer: true,
      quote: true,
      rectifies:   { select: { id: true, number: true } }, // original (si esta es R1)
      rectifiedBy: { select: { id: true, number: true } }, // rectificativa emitida (si existe)
    },
  });
  if (!invoice) return null;

  // SCRUM-97: el objeto Merchant/Customer completo se colaba entero en la respuesta —
  // IBAN/CLABE, ids de Stripe, estado de suscripción, flags internos del merchant; el
  // portalToken del customer (la llave de SU portal público) — a CUALQUIER rol, incluido
  // Técnico (esta ruta no lleva requireRole). Mismo recorte que ya usa
  // getQuoteDetailAdmin (quoteAdmin.ts): allowlist explícita, nunca el objeto Prisma
  // crudo. Ningún consumidor actual (frontend/route) leía los campos recortados.
  return {
    ...invoice,
    merchant: {
      id: invoice.merchant.id,
      name: invoice.merchant.name,
      legalName: invoice.merchant.legalName,
      taxId: invoice.merchant.taxId,
      address: invoice.merchant.address,
      whatsappPhone: invoice.merchant.whatsappPhone,
      defaultCurrency: invoice.merchant.defaultCurrency,
      logoUrl: invoice.merchant.logoUrl,
    },
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      phone: invoice.customer.phone,
      email: invoice.customer.email,
      notes: invoice.customer.notes,
    },
  };
}

// Cambiar estado (pending/paid/expired) manteniendo paidAt coherente.
// A21.3: SIEMPRE con merchantId (regla 2 multi-tenant — un id ajeno = null) y
// "deshacer pago" (→pending) SOLO pre-SIF: justificantes (J-…) o tipo JUST;
// una factura F1 real jamás se des-paga a mano — para eso está la R1 (regla 29).
export class UnpayNotAllowedError extends Error {}
export async function updateInvoiceStatusAdmin(
  id: number,
  status: string,
  merchantId?: number,
) {
  const existing = await prisma.invoice.findFirst({
    where: { id, ...(merchantId != null ? { merchantId } : {}) },
  });
  if (!existing) return null;

  // SCRUM-153 · UNA FACTURA ANULADA NO VUELVE. Encontrado al pintar el estado `annulled` en las
  // vistas: no había ninguna guarda sobre el estado ORIGEN, así que un `PATCH status:'paid'`
  // sobre una anulada la resucitaba como pagada — un documento fiscal dado de baja ante la AEAT
  // (con su registro de anulación sellado y encadenado) reapareciendo como cobrado, y sin que
  // nada lo delatara.
  //
  // No es una regla nueva: la Parte L declara `pending → annulled` y **no declara ninguna
  // transición que salga de `annulled`**. Esto solo hace cumplir lo que ya estaba escrito
  // (regla 27: los estados son cerrados; lo que no está declarado no existe).
  //
  // Va ANTES de la guarda de des-pagar porque es más fuerte: aquella depende del tipo de
  // documento, esta no admite excepción — ni siquiera para un justificante `J-`, porque anular
  // un justificante también deja su registro.
  if (existing.status === 'annulled' && status !== 'annulled') {
    throw new UnpayNotAllowedError(
      'Esta factura está ANULADA y su anulación ya está registrada: no puede volver a otro ' +
        'estado. Si la operación existió y hay que cobrarla, emite una factura nueva.',
    );
  }

  if (status === 'pending' && existing.status === 'paid') {
    const isReceipt = existing.type === 'JUST' || /^J-/i.test(existing.number || '');
    if (!isReceipt) {
      throw new UnpayNotAllowedError(
        'Una factura emitida no se des-paga: emite una rectificativa (R1).',
      );
    }
  }

  // Idempotencia: si ya está en ese estado, devolver sin tocar (ni re-auditar)
  if (existing.status === status) return { ...existing, __unchanged: true } as any;

  let paidAt = existing.paidAt;

  if (status === 'paid' && !existing.paidAt) {
    paidAt = new Date();
  } else if (status === 'pending') {
    paidAt = null;
  }
  // para 'expired' dejamos paidAt como esté

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status,
      paidAt,
    },
  });
  // SCRUM-28 (COBROS-2): el cobro MANUAL (Bizum/transferencia) también materializa
  // Job.totalCobrado. Reutiliza el núcleo de SCRUM-13 (suma Invoices paid, idempotente).
  // Fire-and-forget: un fallo aquí JAMÁS rompe el marcar-pagado (marca paid, permisos y
  // audit quedan intactos). Sin await, con .catch() como en los webhooks.
  recalcJobCobradoForInvoice(existing.id).catch((e) =>
    console.error('[invoiceAdmin] SCRUM-28 recalc totalCobrado:', e?.message || e),
  );
  return updated;
}

// Helpers específicos (por si quieres seguir usándolos)
export async function markInvoicePaidAdmin(id: number, merchantId?: number) {
  return updateInvoiceStatusAdmin(id, 'paid', merchantId);
}

export async function markInvoicePendingAdmin(id: number, merchantId?: number) {
  return updateInvoiceStatusAdmin(id, 'pending', merchantId);
}

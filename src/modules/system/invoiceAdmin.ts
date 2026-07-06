// src/modules/system/invoiceAdmin.ts
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';

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
  return prisma.invoice.findFirst({
    where: { id, ...(merchantId != null ? { merchantId } : {}) },
    include: {
      merchant: true,
      customer: true,
      quote: true,
      rectifies:   { select: { id: true, number: true } }, // original (si esta es R1)
      rectifiedBy: { select: { id: true, number: true } }, // rectificativa emitida (si existe)
    },
  });
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

  return prisma.invoice.update({
    where: { id },
    data: {
      status,
      paidAt,
    },
  });
}

// Helpers específicos (por si quieres seguir usándolos)
export async function markInvoicePaidAdmin(id: number, merchantId?: number) {
  return updateInvoiceStatusAdmin(id, 'paid', merchantId);
}

export async function markInvoicePendingAdmin(id: number, merchantId?: number) {
  return updateInvoiceStatusAdmin(id, 'pending', merchantId);
}

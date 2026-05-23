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
export async function getInvoiceDetailAdmin(id: number) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      merchant: true,
      customer: true,
      quote: true,
    },
  });
}

// Cambiar estado (pending/paid/expired) manteniendo paidAt coherente
export async function updateInvoiceStatusAdmin(
  id: number,
  status: string,
) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return null;

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
export async function markInvoicePaidAdmin(id: number) {
  return updateInvoiceStatusAdmin(id, 'paid');
}

export async function markInvoicePendingAdmin(id: number) {
  return updateInvoiceStatusAdmin(id, 'pending');
}

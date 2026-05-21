import { prisma } from '../../../core/db/prisma';

const MERCHANT_ID = 1;

export async function getHomeMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pendingInvoices, sentQuotes, paidThisMonth, recentQuotes] = await Promise.all([
    prisma.invoice.aggregate({
      where: { merchantId: MERCHANT_ID, status: 'pending' },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.quote.count({
      where: { merchantId: MERCHANT_ID, status: 'sent' },
    }),
    prisma.invoice.aggregate({
      where: {
        merchantId: MERCHANT_ID,
        status: 'paid',
        paidAt: { gte: startOfMonth },
      },
      _sum: { total: true },
    }),
    prisma.quote.findMany({
      where: { merchantId: MERCHANT_ID },
      include: { customer: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    pendingAmount: Number(pendingInvoices._sum.total ?? 0),
    pendingCount: pendingInvoices._count.id,
    quotesAwaiting: sentQuotes,
    collectedThisMonth: Number(paidThisMonth._sum.total ?? 0),
    recentActivity: recentQuotes.map((q) => ({
      type: 'quote' as const,
      id: q.id,
      status: q.status,
      customer: q.customer?.name ?? '—',
      total: Number(q.total),
      currency: q.currency,
      updatedAt: q.updatedAt,
    })),
  };
}

import { prisma } from '../../../core/db/prisma';

export async function getHomeMetrics(merchantId: number) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pendingInvoices, sentQuotes, paidThisMonth, recentQuotes, topCustomers, topServices] = await Promise.all([
    prisma.invoice.aggregate({
      where: { merchantId, status: 'pending' },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.quote.count({
      where: { merchantId, status: 'sent' },
    }),
    prisma.invoice.aggregate({
      where: { merchantId, status: 'paid', paidAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    prisma.quote.findMany({
      where: { merchantId },
      include: { customer: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    // Top 5 clientes por facturación total
    prisma.invoice.groupBy({
      by: ['customerId'],
      where: { merchantId, status: 'paid' },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    // Top 5 servicios más cotizados (desde líneas de quotes aceptados)
    prisma.quote.findMany({
      where: { merchantId, status: 'accepted' },
      select: { lines: true },
      take: 200,
    }),
  ]);

  // Enriquecer top clientes con nombre
  const customerIds = topCustomers.map((r) => r.customerId).filter(Boolean) as number[];
  const customerNames = customerIds.length
    ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
    : [];
  const nameMap = Object.fromEntries(customerNames.map((c) => [c.id, c.name]));

  // Calcular top servicios desde las líneas de quotes
  const conceptCount: Record<string, { count: number; revenue: number }> = {};
  for (const q of topServices) {
    const lines = Array.isArray(q.lines) ? q.lines as any[] : [];
    for (const l of lines) {
      const key = String(l.concept || '').trim();
      if (!key) continue;
      if (!conceptCount[key]) conceptCount[key] = { count: 0, revenue: 0 };
      conceptCount[key].count += 1;
      conceptCount[key].revenue += Number(l.qty || 1) * Number(l.price || 0);
    }
  }
  const topServicesArr = Object.entries(conceptCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data]) => ({ name, count: data.count, revenue: Math.round(data.revenue * 100) / 100 }));

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
    topCustomers: topCustomers.map((r) => ({
      customerId: r.customerId,
      name: r.customerId ? (nameMap[r.customerId] ?? '—') : '—',
      invoices: r._count.id,
      total: Number(r._sum.total ?? 0),
    })),
    topServices: topServicesArr,
  };
}

import { prisma } from '../../../core/db/prisma';

export async function getHomeMetrics(merchantId: number) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pendingInvoices, sentQuotes, paidThisMonth, recentQuotes, topCustomers, topServices, expensesThisMonth, pendingRequests] = await Promise.all([
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
    // Gastos del mes actual
    prisma.expense.aggregate({
      where: { merchantId, date: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    // Solicitudes de presupuesto pendientes
    prisma.quoteRequest.count({
      where: { merchantId, status: 'pending' },
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

  // ── Tendencias semanales + sparkline + tiempo de respuesta ──────────────
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);
  const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [quotesThisWeek, quotesLastWeek, collectedThisWeekAgg, collectedLastWeekAgg, last7Quotes, decidedRecent] = await Promise.all([
    prisma.quote.count({ where: { merchantId, status: { not: 'draft' }, createdAt: { gte: weekAgo } } }),
    prisma.quote.count({ where: { merchantId, status: { not: 'draft' }, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.invoice.aggregate({ where: { merchantId, status: 'paid', paidAt: { gte: weekAgo } }, _sum: { total: true } }),
    prisma.invoice.aggregate({ where: { merchantId, status: 'paid', paidAt: { gte: twoWeeksAgo, lt: weekAgo } }, _sum: { total: true } }),
    prisma.quote.findMany({ where: { merchantId, createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
    prisma.quote.findMany({
      where: { merchantId, status: { in: ['accepted', 'rejected'] }, createdAt: { gte: thirtyAgo } },
      select: { createdAt: true, acceptedAt: true, rejectedAt: true },
    }),
  ]);

  // Sparkline: cotizaciones por día en los últimos 7 días (índice 0 = hace 6 días, 6 = hoy)
  const sparkline = [0, 0, 0, 0, 0, 0, 0];
  for (const q of last7Quotes) {
    const dayIdx = 6 - Math.floor((now.getTime() - new Date(q.createdAt).getTime()) / 86_400_000);
    if (dayIdx >= 0 && dayIdx < 7) sparkline[dayIdx]++;
  }

  // Tiempo medio de respuesta (horas) sobre cotizaciones decididas en 30 días
  let avgResponseHours: number | null = null;
  const deltas = decidedRecent
    .map((q) => {
      const decidedAt = q.acceptedAt ?? q.rejectedAt;
      if (!decidedAt) return null;
      return (new Date(decidedAt).getTime() - new Date(q.createdAt).getTime()) / 3_600_000;
    })
    .filter((h): h is number => h !== null && h >= 0);
  if (deltas.length) avgResponseHours = Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;

  return {
    weekly: {
      quotesThisWeek,
      quotesLastWeek,
      collectedThisWeek: Number(collectedThisWeekAgg._sum.total ?? 0),
      collectedLastWeek: Number(collectedLastWeekAgg._sum.total ?? 0),
    },
    sparkline,
    avgResponseHours,
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
    expensesThisMonth: Number(expensesThisMonth._sum.amount ?? 0),
    expensesCount: expensesThisMonth._count.id,
    profitThisMonth: Number(paidThisMonth._sum.total ?? 0) - Number(expensesThisMonth._sum.amount ?? 0),
    pendingRequests,
    topCustomers: topCustomers.map((r) => ({
      customerId: r.customerId,
      name: r.customerId ? (nameMap[r.customerId] ?? '—') : '—',
      invoices: r._count.id,
      total: Number(r._sum.total ?? 0),
    })),
    topServices: topServicesArr,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// ANALYTICS — Funnel de conversión (ANA-1)
// ──────────────────────────────────────────────────────────────────────────

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

async function funnelForPeriod(merchantId: number, start: Date, end: Date) {
  const inPeriod = { gte: start, lt: end };

  const [sent, accepted, rejected, awaiting, invoiced, collected, decided] = await Promise.all([
    // Enviadas = cualquier quote que salió de borrador
    prisma.quote.count({ where: { merchantId, createdAt: inPeriod, status: { not: 'draft' } } }),
    prisma.quote.count({ where: { merchantId, createdAt: inPeriod, status: 'accepted' } }),
    prisma.quote.count({ where: { merchantId, createdAt: inPeriod, status: 'rejected' } }),
    prisma.quote.count({ where: { merchantId, createdAt: inPeriod, status: 'sent' } }),
    prisma.invoice.count({ where: { merchantId, createdAt: inPeriod, quoteId: { not: null } } }),
    prisma.invoice.count({ where: { merchantId, status: 'paid', paidAt: inPeriod } }),
    // Para tiempo medio de respuesta: quotes decididos en el periodo
    prisma.quote.findMany({
      where: {
        merchantId,
        status: { in: ['accepted', 'rejected'] },
        createdAt: inPeriod,
      },
      select: { createdAt: true, acceptedAt: true, rejectedAt: true },
    }),
  ]);

  // Tiempo medio de respuesta (horas) entre creación y decisión
  let avgResponseHours: number | null = null;
  const deltas = decided
    .map((q) => {
      const decidedAt = q.acceptedAt ?? q.rejectedAt;
      if (!decidedAt) return null;
      return (new Date(decidedAt).getTime() - new Date(q.createdAt).getTime()) / 3_600_000;
    })
    .filter((h): h is number => h !== null && h >= 0);
  if (deltas.length) {
    avgResponseHours = Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;
  }

  return { sent, accepted, rejected, awaiting, invoiced, collected, avgResponseHours };
}

export async function getFunnelMetrics(merchantId: number) {
  const cur = monthRange(0);
  const prev = monthRange(-1);

  const [current, previous, rejectedRows] = await Promise.all([
    funnelForPeriod(merchantId, cur.start, cur.end),
    funnelForPeriod(merchantId, prev.start, prev.end),
    prisma.quote.findMany({
      where: { merchantId, status: 'rejected', createdAt: { gte: cur.start, lt: cur.end } },
      select: { rejectionReason: true },
    }),
  ]);

  // Motivos de rechazo más frecuentes (mes actual)
  const reasonCount: Record<string, number> = {};
  for (const r of rejectedRows) {
    const reason = String(r.rejectionReason || '').trim() || 'Sin motivo';
    reasonCount[reason] = (reasonCount[reason] || 0) + 1;
  }
  const rejectionReasons = Object.entries(reasonCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  const acceptanceRate = current.sent > 0 ? Math.round((current.accepted / current.sent) * 100) : null;

  return { current, previous, rejectionReasons, acceptanceRate };
}

// ──────────────────────────────────────────────────────────────────────────
// ANALYTICS — Rentabilidad por servicio (ANA-2)
// ──────────────────────────────────────────────────────────────────────────

export async function getServiceMetrics(merchantId: number) {
  // Tomamos quotes que salieron de borrador (con decisión o pendientes)
  const quotes = await prisma.quote.findMany({
    where: { merchantId, status: { in: ['sent', 'accepted', 'rejected'] } },
    select: { status: true, lines: true },
    take: 1000,
    orderBy: { createdAt: 'desc' },
  });

  type Stat = { name: string; quoted: number; accepted: number; revenue: number; priceSum: number };
  const stats: Record<string, Stat> = {};

  for (const q of quotes) {
    const lines = Array.isArray(q.lines) ? (q.lines as any[]) : [];
    // Conceptos distintos dentro de un mismo quote (evita contar duplicados de línea)
    const seen = new Set<string>();
    for (const l of lines) {
      const name = String(l.concept || '').trim();
      if (!name) continue;
      if (!stats[name]) stats[name] = { name, quoted: 0, accepted: 0, revenue: 0, priceSum: 0 };
      if (!seen.has(name)) {
        stats[name].quoted += 1;
        if (q.status === 'accepted') stats[name].accepted += 1;
        seen.add(name);
      }
      const lineTotal = Number(l.qty || 1) * Number(l.price || 0);
      stats[name].priceSum += Number(l.price || 0);
      if (q.status === 'accepted') stats[name].revenue += lineTotal;
    }
  }

  const services = Object.values(stats)
    .map((s) => ({
      name: s.name,
      quoted: s.quoted,
      accepted: s.accepted,
      acceptanceRate: s.quoted > 0 ? Math.round((s.accepted / s.quoted) * 100) : 0,
      revenue: Math.round(s.revenue * 100) / 100,
      avgPrice: s.quoted > 0 ? Math.round((s.priceSum / s.quoted) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.quoted - a.quoted);

  return { services };
}

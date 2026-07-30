import { prisma } from '../../../core/db/prisma';
import { estadoCobroFor } from '../../jobs/domain/job.service'; // SCRUM-24: mismo semáforo que la lista de Trabajos
import { isFieldMember } from '../../../core/http/roleCapabilities'; // SCRUM-147
import { ensamblarMetricasEquipo } from './metricasEquipo'; // SCRUM-236

export async function getHomeMetrics(merchantId: number) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pendingInvoices, sentQuotes, paidThisMonth, recentQuotes, topCustomers, topServices, expensesThisMonth, pendingRequests] = await Promise.all([
    prisma.invoice.aggregate({
      where: { merchantId, status: 'pending' },
      _sum: { total: true },
      _count: { id: true },
    }),
    // A2.6 (Parte E): también el IMPORTE de los presupuestos vivos — el héroe
    // del Home es "dinero en juego" = pendiente de cobrar + esperando el sí.
    prisma.quote.aggregate({
      where: { merchantId, status: 'sent' },
      _sum: { total: true },
      _count: { id: true },
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
    quotesAwaiting: sentQuotes._count.id,
    awaitingAmount: Number(sentQuotes._sum.total ?? 0), // A2.6: € en presupuestos vivos
    collectedThisMonth: Number(paidThisMonth._sum.total ?? 0),
    recentActivity: recentQuotes.map((q) => ({
      type: 'quote' as const,
      id: q.id,
      quoteNumber: q.quoteNumber, // SCRUM-43: número por merchant (A1.2); el id global queda solo para navegar
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

// ──────────────────────────────────────────────────────────────────────────
// V0-3 — Funnel mínimo de PLATAFORMA (solo cuentas owner, vista BO)
// registro → 1ª quote → enviada → aceptada → cobrada, con atribución
// (acquisitionSource del registro), paid_via (charge.method al pagar) y
// quote_created_via ('text' | 'voice').
// ──────────────────────────────────────────────────────────────────────────

export async function getPlatformFunnel() {
  const [merchants, quoteAgg, sentAgg, acceptedAgg, paidCharges, viaAgg] = await Promise.all([
    prisma.merchant.findMany({
      select: { id: true, name: true, createdAt: true, acquisitionSource: true, plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quote.groupBy({ by: ['merchantId'], _count: { id: true } }),
    prisma.quote.groupBy({
      by: ['merchantId'],
      where: { status: { in: ['sent', 'accepted', 'rejected'] } },
      _count: { id: true },
    }),
    prisma.quote.groupBy({ by: ['merchantId'], where: { status: 'accepted' }, _count: { id: true } }),
    prisma.charge.groupBy({
      by: ['merchantId', 'method'],
      where: { status: 'paid' },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.quote.groupBy({ by: ['createdVia'], _count: { id: true } }),
  ]);

  const toMap = (rows: Array<{ merchantId: number; _count: { id: number } }>) =>
    new Map(rows.map((r) => [r.merchantId, r._count.id]));
  const quotesBy = toMap(quoteAgg);
  const sentBy = toMap(sentAgg);
  const acceptedBy = toMap(acceptedAgg);

  const collectedBy = new Map<number, { count: number; amount: number }>();
  const paidViaTotals: Record<string, { count: number; amount: number }> = {};
  for (const r of paidCharges) {
    const cur = collectedBy.get(r.merchantId) ?? { count: 0, amount: 0 };
    cur.count += r._count.id;
    cur.amount += Number(r._sum.amount ?? 0);
    collectedBy.set(r.merchantId, cur);
    const via = String(r.method || 'desconocido');
    if (!paidViaTotals[via]) paidViaTotals[via] = { count: 0, amount: 0 };
    paidViaTotals[via].count += r._count.id;
    paidViaTotals[via].amount += Number(r._sum.amount ?? 0);
  }

  const rows = merchants.map((m) => {
    const collected = collectedBy.get(m.id);
    return {
      id: m.id,
      name: m.name,
      registeredAt: m.createdAt,
      acquisitionSource: m.acquisitionSource ?? null,
      plan: m.plan,
      quotes: quotesBy.get(m.id) ?? 0,
      sent: sentBy.get(m.id) ?? 0,
      accepted: acceptedBy.get(m.id) ?? 0,
      collectedCount: collected?.count ?? 0,
      collectedAmount: Math.round((collected?.amount ?? 0) * 100) / 100,
    };
  });

  const steps = {
    registered: rows.length,
    firstQuote: rows.filter((r) => r.quotes > 0).length,
    sent: rows.filter((r) => r.sent > 0).length,
    accepted: rows.filter((r) => r.accepted > 0).length,
    collected: rows.filter((r) => r.collectedCount > 0).length,
  };

  const quoteCreatedVia = Object.fromEntries(
    viaAgg.map((v) => [String(v.createdVia ?? 'sin_dato'), v._count.id]),
  );

  // A9.2 (GTM-1): el cuadro de mando de la campaña — POR FUENTE de adquisición:
  // registros → activados (≥1 presupuesto) → con 1er cobro. Con 20 demos en
  // marcha responde "¿qué canal trae altas que ACABAN cobrando?".
  const bySourceMap = new Map<string, { registered: number; activated: number; collected: number }>();
  for (const r of rows) {
    const key = r.acquisitionSource || 'directo/sin dato';
    const agg = bySourceMap.get(key) ?? { registered: 0, activated: 0, collected: 0 };
    agg.registered += 1;
    if (r.quotes > 0) agg.activated += 1;
    if (r.collectedCount > 0) agg.collected += 1;
    bySourceMap.set(key, agg);
  }
  const bySource = [...bySourceMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.registered - a.registered);

  return { steps, paidVia: paidViaTotals, quoteCreatedVia, bySource, merchants: rows };
}

// ──────────────────────────────────────────────────────────────────────────
// ANALYTICS — Dashboard de equipo (ANA-3)
// ──────────────────────────────────────────────────────────────────────────

export async function getTeamMetrics(merchantId: number) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [merchant, members, monthQuotes, paidInvoices] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true, legalName: true } }),
    prisma.teamMember.findMany({
      where: { merchantId },
      select: { id: true, name: true, role: true, status: true },
    }),
    prisma.quote.findMany({
      where: { merchantId, status: { not: 'draft' }, createdAt: { gte: monthStart } },
      select: { teamMemberId: true, status: true, createdAt: true },
    }),
    // SCRUM-236: aquí había `quoteId: { not: null }`, que DESCARTABA en silencio toda factura
    // no nacida de un presupuesto — o sea todo el flujo de Trabajos (`albaranes.routes.ts` y
    // `recapitulativa.service.ts` fijan `quoteId: null` a pelo). Las filas por empleado no
    // sumaban el total y la pantalla no lo decía: el profesional no cuadraba los números y
    // dejaba de fiarse de TODA la pantalla, incluidos los que sí eran correctos.
    //
    // Ahora vienen TODAS y el reparto lo hace `desglosarPorEmpleado` (SCRUM-228), que lo no
    // atribuible lo hace VISIBLE en «Sin asignar» en vez de tirarlo. El `quote.teamMemberId`
    // se trae aquí en la misma consulta: la segunda query (`quoteOwners`, un `findMany` de
    // TODOS los presupuestos del merchant para armar un mapa a mano) sobra.
    prisma.invoice.findMany({
      where: { merchantId, status: 'paid', paidAt: { gte: monthStart } },
      select: { total: true, quoteId: true, quote: { select: { teamMemberId: true } } },
    }),
  ]);

  // SCRUM-236: el ensamblado (reparto incluido) vive en `metricasEquipo.ts` como funcion PURA,
  // para que el invariante «filas + Sin asignar = total» se pueda probar en centimos enteros y
  // sin BD. Aqui solo quedan las consultas. Lo que se borro y por que:
  //   · `ownerMap` + la consulta `quoteOwners` — hacian a mano lo que `desglosarPorEmpleado` ya
  //     hace, y ademas cargaban TODOS los presupuestos del merchant para armar el mapa.
  //   · `ensure(tm ?? 0)` — metia lo no atribuible en la clave 0, que es EL PROPIETARIO. Sumaba
  //     bien y mentia: le cargaba al dueno, en su pantalla, dinero que nadie sabe de quien es.
  return ensamblarMetricasEquipo({
    members,
    monthQuotes,
    paidInvoices,
    nombrePropietario: merchant?.legalName || merchant?.name || 'Tu (propietario)',
    weekAgo,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// SCRUM-24 (OPERARIO-3): resumen de supervisión POR OPERARIO para el admin.
// Agrega los Trabajos por `Job.operarioId` (AUTOR, congelado en SCRUM-52 — si el admin
// reasigna un Trabajo, el resumen lo sigue atribuyendo a quien lo originó). Aprovecha
// el índice (merchant_id, operario_id). Clona la estructura de getTeamMetrics (mapa de
// agregados + fila del propietario), pero aquí la fuente son los Jobs, no los Quotes.
// Solo Admin: el gate vive en la ruta (requireRole) — regla S3, nunca solo en el front.
// ──────────────────────────────────────────────────────────────────────────

export async function getOperariosMetrics(merchantId: number) {
  const [totales, abiertos, members, merchant] = await Promise.all([
    prisma.job.groupBy({
      by: ['operarioId'],
      where: { merchantId },
      _sum: { totalAceptado: true, totalCobrado: true },
      _count: { id: true },
    }),
    prisma.job.groupBy({
      by: ['operarioId'],
      where: { merchantId, status: { not: 'cerrado' } },
      _count: { id: true },
    }),
    prisma.teamMember.findMany({
      where: { merchantId },
      select: { id: true, name: true, role: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true, defaultCurrency: true } }),
  ]);

  // clave 0 = propietario (operarioId null), mismo convenio que getTeamMetrics
  const key = (id: number | null) => id ?? 0;
  const totalesBy = new Map<number, { aceptado: number; cobrado: number; total: number }>();
  for (const r of totales) {
    totalesBy.set(key(r.operarioId), {
      aceptado: Number(r._sum.totalAceptado ?? 0),
      cobrado: Number(r._sum.totalCobrado ?? 0),
      total: r._count.id,
    });
  }
  const abiertosBy = new Map<number, number>();
  for (const r of abiertos) abiertosBy.set(key(r.operarioId), r._count.id);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const currency = merchant?.defaultCurrency ?? 'EUR';

  const row = (id: number | null, nombre: string, role: string, status: string) => {
    const t = totalesBy.get(key(id)) ?? { aceptado: 0, cobrado: 0, total: 0 };
    const totalAceptado = round2(t.aceptado);
    const totalCobrado = round2(t.cobrado);
    return {
      operarioId: id,
      nombre,
      role,
      status,
      trabajos: t.total,
      abiertos: abiertosBy.get(key(id)) ?? 0,
      totalAceptado,
      totalCobrado,
      pendiente: round2(totalAceptado - totalCobrado),
      // mismo % que pinta la lista de Trabajos (jobsView) y mismo semáforo (job.service)
      progreso: totalAceptado > 0 ? Math.min(100, Math.round((totalCobrado / totalAceptado) * 100)) : 0,
      estadoCobro: estadoCobroFor(totalCobrado, totalAceptado),
    };
  };

  const list = [
    // fila del propietario (operarioId null): su nombre visible es el del NEGOCIO
    row(null, merchant?.name ?? 'Propietario', 'owner', 'active'),
    ...members.map((m) => row(m.id, m.name, m.role, m.status)),
  ];

  // Supervisión = dinero primero: el que más dinero tiene pendiente, arriba.
  list.sort((a, b) => b.pendiente - a.pendiente);

  return {
    currency,
    hasOperarios: members.length > 0,
    operarios: list,
  };
}

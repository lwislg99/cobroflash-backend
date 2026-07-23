import { prisma } from '../../../core/db/prisma';

export const EXPENSE_CATEGORIES = ['materiales', 'desplazamiento', 'herramientas', 'subcontrata', 'otros'] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface CreateExpenseInput {
  quoteId?: number | null;
  providerId?: number | null;
  concept: string;
  amount: number;
  currency?: string;
  category?: ExpenseCategory;
  date?: Date;
  notes?: string | null;
  receiptData?: string | null;
  // SCRUM-109: autoría — el técnico que registró el gasto (null = propietario). Inmutable:
  // no forma parte de updateExpense a propósito, mismo convenio que Job.operarioId (SCRUM-22).
  teamMemberId?: number | null;
}

export async function listExpenses(
  merchantId: number,
  opts: { quoteId?: number; month?: string; category?: string } = {}
) {
  const where: any = { merchantId };
  if (opts.quoteId) where.quoteId = opts.quoteId;
  if (opts.category) where.category = opts.category;
  if (opts.month) {
    const [y, m] = opts.month.split('-').map(Number);
    where.date = {
      gte: new Date(y, m - 1, 1),
      lt:  new Date(y, m, 1),
    };
  }
  return prisma.expense.findMany({
    where,
    include: {
      quote:    { select: { id: true } },
      provider: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });
}

export async function createExpense(merchantId: number, data: CreateExpenseInput) {
  return prisma.expense.create({
    data: {
      merchantId,
      quoteId:      data.quoteId     ?? null,
      providerId:   data.providerId  ?? null,
      concept:      data.concept,
      amount:       data.amount,
      currency:     data.currency    ?? 'EUR',
      category:     data.category    ?? 'otros',
      date:         data.date        ?? new Date(),
      notes:        data.notes       ?? null,
      receiptData:  data.receiptData ?? null,
      teamMemberId: data.teamMemberId ?? null,
    },
  });
}

export async function updateExpense(merchantId: number, id: number, data: Partial<CreateExpenseInput>) {
  const existing = await prisma.expense.findFirst({ where: { id, merchantId } });
  if (!existing) return null;
  return prisma.expense.update({ where: { id }, data });
}

export async function deleteExpense(merchantId: number, id: number) {
  const existing = await prisma.expense.findFirst({ where: { id, merchantId } });
  if (!existing) return false;
  await prisma.expense.delete({ where: { id } });
  return true;
}

export async function getExpenseSummary(merchantId: number, month?: string) {
  const now = new Date();
  const y = month ? Number(month.split('-')[0]) : now.getFullYear();
  const m = month ? Number(month.split('-')[1]) : now.getMonth() + 1;

  const [byCategory, total, quoteExpenses] = await Promise.all([
    prisma.expense.groupBy({
      by: ['category'],
      where: {
        merchantId,
        date: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: {
        merchantId,
        date: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
      },
      _sum: { amount: true },
    }),
    // Gastos sin asignar a ninguna cotización este mes
    prisma.expense.aggregate({
      where: {
        merchantId,
        quoteId: null,
        date: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    month: `${y}-${String(m).padStart(2, '0')}`,
    totalAmount: Number(total._sum.amount ?? 0),
    unassignedAmount: Number(quoteExpenses._sum.amount ?? 0),
    byCategory: byCategory.map((r) => ({
      category: r.category,
      amount: Number(r._sum.amount ?? 0),
      count: r._count.id,
    })),
  };
}

// Calcular margen de una cotización: ingresos - gastos asignados
export async function getQuoteMargin(merchantId: number, quoteId: number) {
  const [quote, expenses] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: quoteId, merchantId },
      select: { total: true, currency: true, status: true },
    }),
    prisma.expense.findMany({
      where: { quoteId, merchantId },
      select: { amount: true, concept: true, category: true },
    }),
  ]);

  if (!quote) return null;

  const revenue = Number(quote.total);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const margin = revenue - totalExpenses;
  const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

  return {
    revenue,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    marginPct,
    currency: quote.currency,
    expenses: expenses.map((e) => ({
      concept: e.concept,
      category: e.category,
      amount: Number(e.amount),
    })),
  };
}

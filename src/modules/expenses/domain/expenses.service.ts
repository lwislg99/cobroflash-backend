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
  const items = await prisma.expense.findMany({
    where,
    include: {
      quote:    { select: { id: true } },
      provider: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });

  // SCRUM-135: el gasto guarda `quoteId` (COTIZACIÓN), pero lo que el pro ve y entiende es el
  // TRABAJO. Se resuelve aquí, con UNA query para toda la página, en vez de que el front pida
  // /admin/jobs aparte: ese endpoint serializa hasta 200 trabajos con varias consultas cada uno
  // (N+1, ver SCRUM-58) y medido contra staging tardaba 2910 ms frente a 1270 ms de este — o
  // sea que la lista de gastos se quedaba esperando por un adorno. Aditivo: `job` se AÑADE al
  // item y `quote` sigue igual para quien ya lo leyera.
  const quoteIds = [...new Set(items.map((e) => e.quoteId).filter((id): id is number => id != null))];
  if (!quoteIds.length) return items.map((e) => ({ ...e, job: null }));

  const porQuote = await trabajosPorQuote(merchantId, quoteIds);
  return items.map((e) => {
    const j = e.quoteId != null ? porQuote.get(e.quoteId) : null;
    // `titulo` puede ser null en Jobs anteriores a SCRUM-10: el front cae a un texto neutro.
    return { ...e, job: j ? { id: j.id, titulo: j.titulo } : null };
  });
}

/**
 * SCRUM-195 (rebanada 1) · A qué TRABAJO pertenece cada uno de esos presupuestos.
 *
 * EL FALLO QUE CIERRA: antes se buscaba el Job por `Job.quoteId`, y con varios Quotes por Job
 * un gasto imputado a un presupuesto ADICIONAL no encontraba Trabajo — salía `job: null` y el
 * pro veía el gasto suelto, **sin ningún error**. La pertenencia se pregunta ahora por
 * `Quote.jobId`, que es el sentido que admite varios.
 *
 * VA EXTRAÍDA Y CON CLIENTE INYECTABLE a propósito: `listExpenses` usa el `prisma` global en 16
 * sitios, así que probar este punto de fallo desde fuera exigiría o inyectarlo entero —mucho más
 * cambio que el arreglo— o dejarlo sin red hasta la tanda gateada. Esto es el trozo pequeño que
 * de verdad hay que vigilar.
 *
 * SIGUE SIENDO COSTE CONSTANTE, que es el motivo de SCRUM-135: dos consultas por página (el
 * mapa quote→job y los títulos por id), nunca una por gasto.
 */
export async function trabajosPorQuote(
  merchantId: number,
  quoteIds: number[],
  prismaClient = prisma,
): Promise<Map<number, { id: number; titulo: string | null }>> {
  if (!quoteIds.length) return new Map();

  const quotes = await prismaClient.quote.findMany({
    where: { merchantId, id: { in: quoteIds } },
    select: { id: true, jobId: true },
  });
  const jobIdPorQuote = new Map<number, number>();
  for (const q of quotes) if (q.jobId != null) jobIdPorQuote.set(q.id, q.jobId);

  // Sentido viejo, mientras conviven (paso 1: `Job.quoteId` no se retira): los pares que
  // todavía no tiene el backfill. Sin esto, entre el despliegue y el backfill los gastos
  // perderían su Trabajo — el mismo fallo que este cambio cierra, en la otra ventana.
  const faltan = quoteIds.filter((id) => !jobIdPorQuote.has(id));
  if (faltan.length) {
    const legado = await prismaClient.job.findMany({
      where: { merchantId, quoteId: { in: faltan } },
      select: { id: true, quoteId: true },
    });
    for (const j of legado) if (j.quoteId != null) jobIdPorQuote.set(j.quoteId, j.id);
  }

  const ids = [...new Set(jobIdPorQuote.values())];
  if (!ids.length) return new Map();
  const jobs = await prismaClient.job.findMany({
    where: { merchantId, id: { in: ids } },
    select: { id: true, titulo: true },
  });
  const porId = new Map(jobs.map((j) => [j.id, j]));

  const salida = new Map<number, { id: number; titulo: string | null }>();
  for (const [quoteId, jobId] of jobIdPorQuote) {
    const j = porId.get(jobId);
    if (j) salida.set(quoteId, j);
  }
  return salida;
}

// SCRUM-135 (hallazgo 2): `quoteId` y `providerId` se escribían A PELO. La FK garantiza que
// la fila EXISTE, no que sea de este merchant → un gasto podía apuntar a la cotización de
// OTRO negocio (regla 2). Hoy la fuga era casi nula porque `listExpenses` solo devuelve
// `quote.id` (el número que ya habías tecleado), pero este mismo ticket ENSANCHA ese select
// para pintar el trabajo en el desplegable: sin este guard, eso pasa a ser lectura
// cross-tenant. Por eso la comprobación va aquí, en el DOMINIO, y no en la ruta: un futuro
// tercer llamador de createExpense no se la salta por olvido.
export class ExpenseRefError extends Error {
  constructor(public readonly code: 'quote_not_found' | 'provider_not_found') {
    super(code);
    this.name = 'ExpenseRefError';
  }
}

// MISMA respuesta para "no existe" y "no es tuya" a propósito: distinguirlas convertiría el
// endpoint en un oráculo para enumerar ids de otros merchants.
async function assertRefsOwned(merchantId: number, data: Partial<CreateExpenseInput>) {
  if (data.quoteId != null) {
    const quote = await prisma.quote.findFirst({
      where: { id: data.quoteId, merchantId },
      select: { id: true },
    });
    if (!quote) throw new ExpenseRefError('quote_not_found');
  }
  if (data.providerId != null) {
    const provider = await prisma.provider.findFirst({
      where: { id: data.providerId, merchantId },
      select: { id: true },
    });
    if (!provider) throw new ExpenseRefError('provider_not_found');
  }
}

export async function createExpense(merchantId: number, data: CreateExpenseInput) {
  await assertRefsOwned(merchantId, data);
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
  // SCRUM-135: el PUT comprobaba la tenencia del GASTO pero no la de las referencias NUEVAS.
  await assertRefsOwned(merchantId, data);
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

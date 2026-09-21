import { prisma } from '../../../core/db/prisma';
// SCRUM-944 (punto 2) · cómo se llama un Trabajo lo decide UNA función, y es esta. Gastos la llama;
// no la reescribe ni la adapta.
import { tituloDeTrabajo } from '../../jobs/domain/trabajoDirecto';

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
  /**
   * SCRUM-324 (E3) · el NIF del proveedor, capturado EN EL MOMENTO del gasto.
   *
   * No es un campo de `Expense`: vive en `Provider.taxId`, que es su sitio. Se acepta aquí porque
   * el usuario lo teclea en el almacén, con el ticket en la mano, y obligarle a ir antes a la ficha
   * del proveedor es pedirle que se acuerde por la noche — que es justo cuando ya no se acuerda.
   */
  nifProveedor?: string | null;
  /**
   * SCRUM-324 (E3) · EL DESGLOSE, que es lo que convierte un apunte en un ASIENTO.
   *
   * `amount` es el TOTAL con IVA (declarado en el censo de SCRUM-324). Sin `baseAmount` el libro de
   * facturas recibidas EXCLUYE el gasto (`libroRecibidas.ts:98`): las seis columnas llevaban desde
   * el 10-ago en las tres bases, con un lector que las lee y **nadie que las escribiera**.
   */
  baseAmount?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  providerInvoiceNumber?: string | null;
  providerInvoiceDate?: Date | null;
}

/**
 * SCRUM-964 · LAS COLUMNAS QUE LA LISTA DEVUELVE — TODAS MENOS `receipt_data`.
 *
 * LA VÍCTIMA: el profesional en la furgoneta. `listExpenses` pedía `include` sin `select`, o sea
 * TODAS las columnas, y `receipt_data` guarda la FOTO DEL TICKET entera como data-URI (tope
 * `FOTO_TECHO_DATAURI` = 1,5 MiB en `expensesView.js`). Medido con la sonda de solo lectura
 * `docs/prototipos/SCRUM-920/sonda-peso-lista-gastos.mjs`, sobre la ruta y el servicio REALES:
 *
 *     20 gastos × foto 1,50 MiB  ->  respuesta  30,00 MiB
 *     60 gastos × foto 1,50 MiB  ->  respuesta  90,01 MiB
 *    200 gastos × foto 1,50 MiB  ->  respuesta 300,03 MiB   (el `take` es 200)
 *
 * Son 300 MiB por abrir Gastos, con datos móviles, para pintar una tabla que NO enseña ninguna
 * foto: la lista solo las quiere para el modal de edición, de una en una.
 *
 * 🔴 ES UNA LISTA CERRADA A PROPÓSITO, Y POR ESO LLEVA GUARD. Un `select` explícito deja fuera
 * cualquier columna NUEVA de `Expense` sin decir nada — el defecto siguiente, con cara de
 * arreglo. `tests/scrum964-la-lista-no-carga-las-fotos.test.mjs` lee `prisma/schema.prisma` y
 * exige que el `select` que sale hacia la base sea EXACTAMENTE los escalares del modelo menos
 * `receiptData`: la columna nueva pone el guard en rojo y obliga a decidir, en vez de desaparecer
 * en silencio.
 *
 * ⚠️ SIN `export`, y es del censo de SCRUM-411: su único consumidor real está en este fichero. El
 * test lo mira donde importa —en los argumentos que `listExpenses` le manda a la base—, no en una
 * constante exportada para poder verla: un export que solo existe para el test es código que el
 * test se ha inventado, y entonces mide lo que él añadió.
 */
const CAMPOS_DE_LA_LISTA = {
  id: true,
  merchantId: true,
  quoteId: true,
  providerId: true,
  concept: true,
  amount: true,
  currency: true,
  category: true,
  date: true,
  notes: true,
  baseAmount: true,
  vatRate: true,
  vatAmount: true,
  vatDeducible: true,
  providerInvoiceNumber: true,
  providerInvoiceDate: true,
  teamMemberId: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
    // `select` y no `include`: `include` trae TODAS las columnas de `Expense` y la foto con ellas.
    select: {
      ...CAMPOS_DE_LA_LISTA,
      quote:    { select: { id: true } },
      provider: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });

  /**
   * SCRUM-964 · QUÉ GASTOS LLEVAN FOTO, SIN TRAERSE NI UNA.
   *
   * La pantalla necesita saber si HAY foto (para ofrecer verla), no la foto. Se pregunta con una
   * consulta que solo devuelve `id`, acotada a los gastos de ESTA página y filtrada por
   * `merchantId` (regla 2): **una consulta por página, nunca una por gasto** — el coste constante
   * que fijó SCRUM-135.
   *
   * ⚠️ `tieneFoto` dice que la columna NO es `null`. No promete que sea una imagen legible: eso lo
   * decide `GET /admin/expenses/:id/foto` al servirla, y por eso esa ruta tiene su propio código
   * de error. Un gasto se guarda con `receiptData: receiptData ? String(receiptData) : null`, así
   * que la cadena vacía ya llega como `null` y no cuenta como foto.
   */
  const idsConFoto = new Set<number>();
  if (items.length) {
    const conFoto = await prisma.expense.findMany({
      where: { merchantId, id: { in: items.map((e) => e.id) }, receiptData: { not: null } },
      select: { id: true },
    });
    for (const f of conFoto) idsConFoto.add(f.id);
  }

  // SCRUM-135: el gasto guarda `quoteId` (COTIZACIÓN), pero lo que el pro ve y entiende es el
  // TRABAJO. Se resuelve aquí, con UNA query para toda la página, en vez de que el front pida
  // /admin/jobs aparte: ese endpoint serializa hasta 200 trabajos con varias consultas cada uno
  // (N+1, ver SCRUM-58) y medido contra staging tardaba 2910 ms frente a 1270 ms de este — o
  // sea que la lista de gastos se quedaba esperando por un adorno. Aditivo: `job` se AÑADE al
  // item y `quote` sigue igual para quien ya lo leyera.
  const quoteIds = [...new Set(items.map((e) => e.quoteId).filter((id): id is number => id != null))];
  if (!quoteIds.length) return items.map((e) => ({ ...e, tieneFoto: idsConFoto.has(e.id), job: null }));

  const porQuote = await trabajosPorQuote(merchantId, quoteIds);
  // SCRUM-944 (punto 2) · `job.titulo` ya no es el campo crudo de la base: es el NOMBRE con el que
  // Trabajos presenta ese mismo Trabajo. Con `Job.titulo` a secas, los Trabajos sin título (10 de 13
  // en staging) llegaban a `null` y la pantalla los llamaba «Trabajo», mientras Trabajos decía
  // «Presupuesto #5 · María López»: dos nombres para lo mismo.
  const nombres = await nombresDeTrabajos(merchantId, [...porQuote.values()]);
  return items.map((e) => {
    const j = e.quoteId != null ? porQuote.get(e.quoteId) : null;
    if (!j) return { ...e, tieneFoto: idsConFoto.has(e.id), job: null };
    const nombre = nombres.get(j.id);
    return { ...e, tieneFoto: idsConFoto.has(e.id), job: { id: j.id, titulo: nombre !== undefined ? nombre : j.titulo } };
  });
}

/**
 * SCRUM-944 (punto 2) · el nombre de cada Trabajo, EL MISMO que le da la pantalla de Trabajos.
 *
 * NO decide nada: llama a `tituloDeTrabajo` (`jobs/domain/trabajoDirecto.ts`), que es quien decide, con
 * las mismas entradas que le da `serializeJob` — el título propio, el presupuesto ORIGINAL del Trabajo
 * (el de `Job.quoteId`; a falta de éste, el primero por id de los que tienen `Quote.jobId`) y su cliente.
 * Ojo: es el original y no el presupuesto al que se imputó el gasto; un gasto de un adicional se
 * presenta con el nombre del Trabajo, no con el número del adicional.
 *
 * Los Trabajos CON título no cuestan nada: `tituloDeTrabajo` devuelve ese título y no se consulta.
 * Para el resto, tres consultas por página —Trabajos, presupuestos y clientes—, nunca una por gasto
 * (el coste constante que fijó SCRUM-135). No se exporta: nadie de fuera la usa (`listExpenses` la llama
 * y su test entra por `listExpenses`), y un `export` sin consumidor lo caza `scrum411`.
 */
async function nombresDeTrabajos(
  merchantId: number,
  trabajos: Array<{ id: number; titulo: string | null }>,
  prismaClient = prisma,
): Promise<Map<number, string>> {
  const nombres = new Map<number, string>();
  const sinTitulo: number[] = [];
  // Varios presupuestos de un mismo Trabajo llegan como varias entradas: cada Trabajo se resuelve una vez.
  for (const t of new Map(trabajos.map((x) => [x.id, x])).values()) {
    if (t.titulo) nombres.set(t.id, tituloDeTrabajo({ titulo: t.titulo, jobId: t.id }));
    else sinTitulo.push(t.id);
  }
  if (!sinTitulo.length) return nombres;

  const jobs = await prismaClient.job.findMany({
    where: { merchantId, id: { in: sinTitulo } },   // regla 2
    select: { id: true, customerId: true, quoteId: true },
  });
  const quoteIds = jobs.map((j) => j.quoteId).filter((id): id is number => id != null);
  const [quotes, clientes] = await Promise.all([
    prismaClient.quote.findMany({
      where: { merchantId, OR: [{ id: { in: quoteIds } }, { jobId: { in: sinTitulo } }] },
      select: { id: true, jobId: true, quoteNumber: true },
      orderBy: { id: 'asc' },
    }),
    prismaClient.customer.findMany({
      where: { merchantId, id: { in: [...new Set(jobs.map((j) => j.customerId))] } },
      select: { id: true, name: true },
    }),
  ]);
  const cliente = new Map(clientes.map((c) => [c.id, c]));
  for (const j of jobs) {
    const original =
      (j.quoteId != null ? quotes.find((q) => q.id === j.quoteId) : undefined)
      ?? quotes.find((q) => q.jobId === j.id);
    nombres.set(j.id, tituloDeTrabajo({
      titulo: null,
      quote: original ? { id: original.id, quoteNumber: original.quoteNumber } : null,
      customer: cliente.get(j.customerId) ?? null,
      jobId: j.id,
    }));
  }
  return nombres;
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

// SCRUM-943 · la categoría se valida AQUÍ, en el dominio, por la misma razón que las referencias
// de arriba (SCRUM-135): un tercer llamador de createExpense/updateExpense no se la salta por
// olvido. Hasta hoy las rutas hacían `String(category)` y la escribían tal cual, así que la API
// aceptaba cualquier cadena. Una categoría que el producto no conoce no desaparece: se cuela en
// la base, cuenta en los totales bajo «Otros» y nadie la ve.
//
// No se normaliza ni se traduce nada: «materials» no se convierte en «materiales». Rechazar es
// arreglar el defecto; traducir lo taparía. Y las filas ya escritas no se tocan (saneo aparte).
function esCategoriaDeGasto(valor: unknown): valor is ExpenseCategory {
  return typeof valor === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(valor);
}

export class ExpenseCategoryError extends Error {
  readonly code = 'category_invalid' as const;
  constructor() {
    super('category_invalid');
    this.name = 'ExpenseCategoryError';
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
  // Sin categoría (`undefined`/`null`) sigue siendo «otros», como siempre; lo que se rechaza es una
  // categoría que llega y no es de las cinco.
  if (data.category != null && !esCategoriaDeGasto(data.category)) throw new ExpenseCategoryError();
  await assertRefsOwned(merchantId, data);
  const gasto = await prisma.expense.create({
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
      // SCRUM-324 (E3) · aquí se cierra la cadena. Hasta hoy estas cinco no las escribía NADIE.
      baseAmount:            data.baseAmount            ?? null,
      vatRate:               data.vatRate               ?? null,
      vatAmount:             data.vatAmount             ?? null,
      providerInvoiceNumber: data.providerInvoiceNumber ?? null,
      providerInvoiceDate:   data.providerInvoiceDate   ?? null,
    },
  });
  await guardarNifDelProveedor(merchantId, data);
  return gasto;
}

/**
 * El NIF va al PROVEEDOR, y solo si no tenía uno.
 *
 * No se pisa un NIF ya guardado: el de la ficha lo puso alguien mirando una factura, y el del
 * almacén se teclea de pie y con prisa. Si difieren, gana el que ya estaba — la diferencia no se
 * resuelve en silencio aquí.
 */
async function guardarNifDelProveedor(merchantId: number, data: Partial<CreateExpenseInput>) {
  const nif = (data.nifProveedor ?? '').trim();
  if (!nif || !data.providerId) return;
  await prisma.provider.updateMany({
    // El filtro por `merchantId` no es decorativo: un `updateMany` sin él se salta el multi-tenant.
    where: { id: data.providerId, merchantId, taxId: null },
    data: { taxId: nif },
  });
}

/**
 * SCRUM-937 · qué fue del NIF que tecleó el usuario, para que la respuesta lo DIGA.
 *
 * `guardarNifDelProveedor` tiene dos salidas mudas: sin proveedor no hay ficha donde dejarlo, y
 * si la ficha ya tenía otro gana el de la ficha. Las dos son correctas (SCRUM-324 E3) y las dos
 * se tragaban el dato sin avisar: el profesional creía haber completado su justificante.
 *
 * Se decide con lo que quedó en la ficha DESPUÉS de guardar, no con lo que se intentó: así el
 * resultado es un hecho y no una predicción. `null` = no se tecleó ningún NIF.
 */
export type DestinoDelNif = 'en_la_ficha' | 'sin_proveedor' | 'la_ficha_tiene_otro';

export function queFueDelNif(p: {
  nifTecleado?: string | null;
  providerId?: number | null;
  nifDeLaFicha?: string | null;
}): DestinoDelNif | null {
  const nif = (p.nifTecleado ?? '').trim();
  if (!nif) return null;
  if (!p.providerId) return 'sin_proveedor';
  // Mayúsculas y espacios no hacen de un NIF «otro»: el guardado es el recortado (arriba).
  const ficha = (p.nifDeLaFicha ?? '').trim();
  return ficha.toUpperCase() === nif.toUpperCase() ? 'en_la_ficha' : 'la_ficha_tiene_otro';
}

export async function updateExpense(merchantId: number, id: number, data: Partial<CreateExpenseInput>) {
  // En la edición `undefined` es «no lo toques»; cualquier otro valor tiene que ser de las cinco.
  if (data.category !== undefined && !esCategoriaDeGasto(data.category)) throw new ExpenseCategoryError();
  const existing = await prisma.expense.findFirst({ where: { id, merchantId } });
  if (!existing) return null;
  // SCRUM-135: el PUT comprobaba la tenencia del GASTO pero no la de las referencias NUEVAS.
  await assertRefsOwned(merchantId, data);
  // SCRUM-937 · la edición hace con el NIF lo mismo que el alta. El modal ya lo mandaba y aquí no
  // llegaba nunca: la otra puerta del mismo silencio. No es columna de `Expense`, así que se aparta
  // antes del `update` y va a la ficha del proveedor que el gasto tenga DESPUÉS de editarlo — si la
  // misma edición cambia de proveedor, al nuevo.
  const { nifProveedor, ...campos } = data;
  const actualizado = await prisma.expense.update({ where: { id }, data: campos });
  await guardarNifDelProveedor(merchantId, { providerId: actualizado.providerId, nifProveedor });
  return actualizado;
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

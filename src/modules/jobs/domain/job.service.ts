// src/modules/jobs/domain/job.service.ts — A13 (EXT3, JOB-1 · master Parte R)
// Trabajo MÍNIMO: feature de DINERO, no de organización. `terminado` es el
// trigger limpio del segundo tramo (V2: el resto JAMÁS se cobra solo).
// FSM (Parte L, regla 27 — estados CERRADOS):
//   pendiente_agendar → agendado(scheduledAt) → en_curso → terminado → cerrado
import { prisma } from '../../../core/db/prisma';
import { recordAudit } from '../../system/audit.service';

export const JOB_STATES = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'] as const;
export type JobState = (typeof JOB_STATES)[number];

// SCRUM-66 (TRABAJO-4): tipo de operación fiscal del Trabajo (enum CERRADO, patrón de
// ALBARAN_MODOS_VALORACION). OPERACIONES_SUELTAS = varias visitas al mismo cliente →
// recapitulativa mensual (art. 13 RD 1619/2012); TRABAJO_UNICO = una sola prestación →
// factura al concluir. Default TRABAJO_UNICO (el caso actual de YaQu). El motor de
// facturación que LO RESPETA es SCRUM-17; aquí solo se persiste la elección del pro.
export const JOB_TIPOS_OPERACION = ['OPERACIONES_SUELTAS', 'TRABAJO_UNICO'] as const;
export type JobTipoOperacion = (typeof JOB_TIPOS_OPERACION)[number];

// Transiciones permitidas (L es lineal; agendado puede re-agendarse a sí mismo
// cambiando la fecha, y volver a pendiente_agendar si se des-programa).
const TRANSITIONS: Record<JobState, JobState[]> = {
  pendiente_agendar: ['agendado'],
  agendado: ['agendado', 'pendiente_agendar', 'en_curso'],
  en_curso: ['terminado'],
  terminado: ['cerrado'],
  cerrado: [],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as JobState] || []).includes(to as JobState);
}

/**
 * Auto-creación al quote→accepted (idempotente: jobs.quote_id es UNIQUE).
 * Fire-and-forget en los call-sites: JAMÁS rompe el flujo de aceptación.
 */
export async function ensureJobForQuote(quoteId: number): Promise<void> {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      // SCRUM-10: además del contexto, el total (para congelarlo) y el nº + cliente (para el título).
      // SCRUM-52: teamMemberId = creador del presupuesto → autoría del operario en el Job.
      select: {
        id: true, merchantId: true, customerId: true, status: true,
        total: true, quoteNumber: true, teamMemberId: true,
        customer: { select: { name: true } },
      },
    });
    if (!quote || quote.status !== 'accepted') return;
    // SCRUM-52: idempotencia explícita — si el Job ya existe NO se re-crea ni se re-audita.
    // (antes: upsert con update {}; ahora guard + create para auditar solo en la creación
    // real). La constraint UNIQUE de quote_id + este try/catch cubren la carrera.
    const existing = await prisma.job.findUnique({ where: { quoteId: quote.id }, select: { id: true } });
    if (existing) return;
    // SCRUM-10: título propio con el criterio actual (nº de presupuesto + cliente).
    const num = quote.quoteNumber ?? quote.id;
    const titulo = `Presupuesto #${num}${quote.customer?.name ? ` · ${quote.customer.name}` : ''}`;
    const job = await prisma.job.create({
      data: {
        merchantId: quote.merchantId,
        customerId: quote.customerId,
        quoteId: quote.id,
        status: 'pendiente_agendar',
        // SCRUM-10: campos del contenedor "Trabajo". direccion sin fuente hoy → null.
        titulo,
        totalAceptado: quote.total, // Decimal(12,2): total del Quote congelado en el accept
        // totalCobrado = 0 por default (materializado; su lógica de sumar cobros = SCRUM-13)
        // SCRUM-52: autoría = creador del presupuesto (quote.teamMemberId), NO quien acepta
        // (suele ser admin). null (owner) → operarioId null.
        operarioId: quote.teamMemberId,
      },
    });
    // SCRUM-52: traza de autoría del operario en la creación del Trabajo (fire-and-forget,
    // como el resto de recordAudit). teamMemberId = operarioId (null = propietario).
    recordAudit({
      merchantId: quote.merchantId,
      teamMemberId: quote.teamMemberId,
      action: 'operario_asignado',
      entityType: 'job',
      entityId: job.id,
    });
  } catch (err: any) {
    console.error('[jobs] ensureJobForQuote omitido:', err?.message || err);
  }
}

/**
 * NÚCLEO (SCRUM-13 · madurado en SCRUM-28): materializa `Job.totalCobrado` = SUMA
 * DESDE CERO del `total` de las **Invoices en estado 'paid'** del Quote de ese Job.
 * La Invoice pagada es el denominador común de "cobrado" de TODOS los métodos:
 *   - tarjeta / Mercado Pago → el webhook marca la Invoice `paid` (`ensureInvoiceForCharge`)
 *   - Bizum / transferencia manual → `updateInvoiceStatusAdmin` marca la Invoice `paid`
 * 1 tramo = 1 Invoice → sin doble conteo. Idempotente por diseño (recalcula el total
 * ENTERO cada vez → un evento duplicado no cuenta dos veces). Best-effort: nunca lanza.
 */
/**
 * Los Quotes que pertenecen a un Job. **ÚNICO punto que cambia cuando llegue el 1:N**
 * (SCRUM-37 mecanismo 2): hoy `Job.quoteId` es `@unique`, así que la respuesta tiene como
 * mucho un elemento; con `Quote.jobId` pasará a ser un `findMany` y **nada más de este
 * fichero se entera**.
 *
 * Existe para que la agregación de dinero deje de estar escrita en términos de «el quote» —
 * ver el porqué en `recalcJobCobradoForJob`.
 */
export async function quotesDelJob(jobId: number, prismaClient = prisma): Promise<number[]> {
  const job = await prismaClient.job.findUnique({ where: { id: jobId }, select: { quoteId: true } });
  return job?.quoteId ? [job.quoteId] : [];
}

/**
 * NÚCLEO REAL: materializa `Job.totalCobrado` sumando las Invoices `paid` de **TODOS** los
 * quotes del Job.
 *
 * ⚠️ POR QUÉ SE SUMA POR JOB Y NO POR QUOTE — arreglado ANTES de que el bug pueda ocurrir
 * (SCRUM-37, recon del mecanismo 2). La versión anterior hacía:
 *
 *     const job = await prisma.job.findUnique({ where: { quoteId } });
 *     if (!job) return;                                              // ①
 *     const agg = await prisma.invoice.aggregate({ where: { quoteId, status:'paid' } });
 *     await prisma.job.update({ data: { totalCobrado: agg._sum.total ?? 0 } });   // ②
 *
 * Con 1:1 es correcto. En cuanto un Job tenga VARIOS quotes (presupuestos adicionales),
 * fallan las dos líneas y la segunda es destructiva:
 *
 *   ① **Silencio.** Un presupuesto adicional no tiene Job apuntándole (`Job.quoteId` sigue
 *      señalando al original) → `findUnique` da `null` → la función se va sin hacer nada.
 *      Cobrar el extra no movería el total, y nadie vería un error.
 *   ② **El total BAJA después de cobrar.** El `aggregate` sumaba solo las facturas de ESE
 *      quote y **sobrescribía**: cobrar un extra de 200 € sobre un Job con 3.000 € ya
 *      cobrados dejaba `totalCobrado = 200`.
 *
 * Es el patrón de SCRUM-141 y de `vat_default`: un agregado materializado que deja de cuadrar
 * con lo que agrega. Y aquí no es un dato feo en pantalla — es el número con el que el pro
 * sabe cuánto le deben.
 *
 * **Con 1:1 el resultado es IDÉNTICO al de antes** (la lista tiene un solo quote), así que
 * este cambio es seguro y verificable hoy; lo que hace es dejar la bomba desactivada de
 * antemano, en vez de tener que acordarse al abrir el schema.
 *
 * Sigue siendo idempotente por diseño (recalcula el total ENTERO cada vez → un evento
 * duplicado no cuenta dos veces) y best-effort: nunca lanza.
 */
export async function recalcJobCobradoForJob(jobId: number, prismaClient = prisma): Promise<void> {
  try {
    if (!Number.isInteger(jobId)) return;
    const quoteIds = await quotesDelJob(jobId, prismaClient);
    // Sin quotes no se toca el total: un Job manual (SCRUM-51) puede no tener ninguno, y
    // escribir 0 ahí borraría un cobro registrado por otra vía.
    if (quoteIds.length === 0) return;
    const agg = await prismaClient.invoice.aggregate({
      where: { quoteId: { in: quoteIds }, status: 'paid' },
      _sum: { total: true },
    });
    await prismaClient.job.update({ where: { id: jobId }, data: { totalCobrado: agg._sum.total ?? 0 } });
  } catch (err: any) {
    console.error('[jobs] recalcJobCobradoForJob:', err?.message || err);
  }
}

/**
 * Entrada por Quote: resuelve SU Job y delega en el núcleo por Job. Se conserva la firma
 * porque la usan los tres wrappers; lo que cambia es que ya no agrega en términos del quote.
 */
export async function recalcJobCobradoForQuote(quoteId: number, prismaClient = prisma): Promise<void> {
  try {
    if (!Number.isInteger(quoteId)) return;
    // Cuando llegue el 1:N este `findUnique` pasa a mirar `Quote.jobId`; el núcleo no cambia.
    const job = await prismaClient.job.findUnique({ where: { quoteId }, select: { id: true } });
    if (!job) return; // el Quote no tiene Job
    await recalcJobCobradoForJob(job.id, prismaClient);
  } catch (err: any) {
    console.error('[jobs] recalcJobCobradoForQuote:', err?.message || err);
  }
}

/** Wrapper para los webhooks de pago (SCRUM-13): resuelve el Quote desde el Charge (por
 * su Invoice o el charge principal) y llama al núcleo. NO duplica el cálculo. */
export async function recalcJobCobradoForCharge(chargeId: number): Promise<void> {
  try {
    if (!Number.isInteger(chargeId)) return;
    const inv = await prisma.invoice.findFirst({ where: { chargeId }, select: { quoteId: true } });
    let quoteId = inv?.quoteId ?? null;
    if (!quoteId) {
      const q = await prisma.quote.findFirst({ where: { chargeId }, select: { id: true } });
      quoteId = q?.id ?? null;
    }
    if (quoteId) await recalcJobCobradoForQuote(quoteId);
  } catch (err: any) {
    console.error('[jobs] recalcJobCobradoForCharge:', err?.message || err);
  }
}

/** Wrapper para el cobro MANUAL (SCRUM-28, Bizum/transferencia): resuelve el Quote desde
 * la Invoice marcada `paid` y llama al mismo núcleo. NO duplica el cálculo. */
export async function recalcJobCobradoForInvoice(invoiceId: number): Promise<void> {
  try {
    if (!Number.isInteger(invoiceId)) return;
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { quoteId: true } });
    if (inv?.quoteId) await recalcJobCobradoForQuote(inv.quoteId);
  } catch (err: any) {
    console.error('[jobs] recalcJobCobradoForInvoice:', err?.message || err);
  }
}

/**
 * SCRUM-13: semáforo de cobro derivado (lo pinta SCRUM-11). Regla del brief:
 *   cobrado <= 0                      → 'Pendiente'
 *   0 < cobrado < aceptado            → 'Parcial'
 *   cobrado >= aceptado (aceptado>0)  → 'Pagado'
 */
export function estadoCobroFor(cobrado: number, aceptado: number): 'Pagado' | 'Parcial' | 'Pendiente' {
  const c = Number(cobrado) || 0;
  const a = Number(aceptado) || 0;
  if (a > 0 && c >= a) return 'Pagado';
  if (c > 0) return 'Parcial';
  return 'Pendiente';
}

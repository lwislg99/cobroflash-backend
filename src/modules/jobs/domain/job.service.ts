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
 * Auto-creación al quote→accepted. Fire-and-forget en los call-sites: JAMÁS rompe el flujo de
 * aceptación.
 *
 * SCRUM-195 · LA IDEMPOTENCIA YA NO DESCANSA EN `jobs.quote_id UNIQUE`, y decirlo importa
 * porque ese `@unique` seguirá ahí hasta el paso 2 y se lee como si protegiera algo que no
 * protege: impide que dos Jobs reclamen el MISMO Quote, no que un Quote ADICIONAL fabrique un
 * segundo Job. Quien decide ahora es `Quote.jobId`.
 */
export async function ensureJobForQuote(quoteId: number, prismaClient = prisma): Promise<void> {
  try {
    const quote = await prismaClient.quote.findUnique({
      where: { id: quoteId },
      // SCRUM-10: además del contexto, el total (para congelarlo) y el nº + cliente (para el título).
      // SCRUM-52: teamMemberId = creador del presupuesto → autoría del operario en el Job.
      // SCRUM-195: `jobId` — la pertenencia, que es lo que decide si hay que crear Trabajo.
      select: {
        id: true, merchantId: true, customerId: true, status: true,
        total: true, quoteNumber: true, teamMemberId: true, jobId: true,
        customer: { select: { name: true } },
      },
    });
    if (!quote || quote.status !== 'accepted') return;


    // ─────────────────────────────────────────────────────────────────────────
    // SCRUM-195 (rebanada 1) · EL FALLO SILENCIOSO QUE ESTO CIERRA
    //
    // Hasta aquí la pertenencia se preguntaba SOLO por `Job.quoteId`. Con varios Quotes por
    // Job, un presupuesto ADICIONAL tiene un `quoteId` distinto del que el Job apunta, así que
    // el `findUnique` no encontraba nada y **se creaba un SEGUNDO Trabajo**: el pro veía dos
    // donde hay uno, con el dinero repartido entre ambos.
    //
    // Y no saltaba nada. El `@unique` de `Job.quoteId` no protege de esto: solo impediría que
    // DOS Jobs reclamaran el MISMO Quote, que no es lo que pasa aquí. Silencio completo.
    //
    // Ahora se pregunta primero por `Quote.jobId`, que es el sentido que admite varios.
    if (quote.jobId) return; // ya pertenece a un Trabajo (el original, o el suyo si es adicional)

    // Sentido VIEJO, mientras conviven (paso 1: `Job.quoteId` no se retira). Un par anterior al
    // backfill tiene Job pero el Quote todavía no lo sabe: no se crea nada y se ANOTA la
    // pertenencia, que es el backfill haciéndose solo por el camino caliente.
    const existing = await prismaClient.job.findUnique({ where: { quoteId: quote.id }, select: { id: true } });
    if (existing) {
      await prismaClient.quote.update({ where: { id: quote.id }, data: { jobId: existing.id } });
      return;
    }
    // ── SCRUM-317 (G2) · EL TRABAJO YA NO NACE LLAMÁNDOSE «Presupuesto #N» ──────────────
    //
    // Antes se autogeneraba `Presupuesto #<num> · <cliente>` y se guardaba en `Job.titulo`: el
    // objeto central del producto presentándose como una fase del presupuesto, que es justo la
    // tesis que nos separa de un facturador al uso.
    //
    // Ahora nace SIN título y lo pone el profesional si quiere (PATCH). Mientras no lo ponga, la
    // pantalla se titula con el CLIENTE — que siempre existe — y el presupuesto se queda como
    // documento de ORIGEN, no como nombre.
    //
    // ⚠️ Los Trabajos YA CREADOS conservan su título viejo: es una columna con datos, no un
    // cálculo. NO se hace backfill (decisión del fundador, 5-ago-2026), coherente con la regla
    // fechada del 2-ago: los datos de producción son de prueba y lo que importa es que los
    // registros NUEVOS nazcan bien.
    const job = await prismaClient.job.create({
      data: {
        merchantId: quote.merchantId,
        customerId: quote.customerId,
        quoteId: quote.id,
        status: 'pendiente_agendar',
        // SCRUM-10: campos del contenedor "Trabajo". direccion sin fuente hoy → null.
        // SCRUM-317: `titulo` tampoco se rellena al crear — lo pone el pro (PATCH), y mientras
        // no lo ponga la pantalla se titula con el cliente.
        totalAceptado: quote.total, // Decimal(12,2): total del Quote congelado en el accept
        // totalCobrado = 0 por default (materializado; su lógica de sumar cobros = SCRUM-13)
        // SCRUM-52: autoría = creador del presupuesto (quote.teamMemberId), NO quien acepta
        // (suele ser admin). null (owner) → operarioId null.
        operarioId: quote.teamMemberId,
      },
    });
    // SCRUM-195 · ANOTAR LA PERTENENCIA EN EL SENTIDO NUEVO. Sin esto la columna del paso 1
    // seguiría muerta: existe en el schema y en la base, y no la escribe nadie.
    //
    // NO va en transacción con el `create`, y es deliberado: si esta escritura fallara, el par
    // queda en el estado VIEJO (Job con `quoteId`, Quote sin `jobId`) — que es exactamente lo
    // que la mitad legada de `quotesDelJob` sabe resolver. Degrada al comportamiento de hoy, no
    // a uno roto. Meter una transacción aquí compraría atomicidad contra un fallo que no deja
    // daño, a cambio de que este camino —fire-and-forget y best-effort por diseño— pueda
    // bloquear filas del accept.
    await prismaClient.quote.update({ where: { id: quote.id }, data: { jobId: job.id } });

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
 * Los Quotes que pertenecen a un Job. **ÚNICO punto que resuelve la pertenencia**
 * (SCRUM-37 mec. 2 · SCRUM-195): la promesa de aquel comentario —«cuando llegue `Quote.jobId`
 * pasará a ser un `findMany` y nada más de este fichero se entera»— **ya está cumplida aquí**,
 * y por eso el resto del fichero no cambió al pasar al 1:N.
 *
 * Devuelve la UNIÓN de los dos sentidos mientras conviven; el porqué, dentro.
 *
 * Existe para que la agregación de dinero deje de estar escrita en términos de «el quote» —
 * ver el porqué en `recalcJobCobradoForJob`.
 */
export async function quotesDelJob(jobId: number, prismaClient = prisma): Promise<number[]> {
  // El Job va PRIMERO, y no es orden casual: de él sale el `merchantId` con el que se acota la
  // consulta de abajo. Sin eso, `quote.findMany({ where: { jobId } })` sería una lectura sin
  // ninguna comprobación de merchant — una excepción nueva al censo de SCRUM-243, y de las que
  // se pueden evitar en vez de declarar.
  const job = await prismaClient.job.findUnique({
    where: { id: jobId },
    select: { quoteId: true, merchantId: true },
  });
  if (!job) return [];

  // SCRUM-195 (rebanada 1) · LA PERTENENCIA SE LEE POR `Quote.jobId`, que es el sentido que
  // admite varios. Éste es el `findMany` que anunciaba el comentario de arriba.
  const porQuote = await prismaClient.quote.findMany({
    where: { jobId, merchantId: job.merchantId }, // regla 2: toda lectura filtra por merchant
    select: { id: true },
  });

  // ⚠️ Y ADEMÁS EL SENTIDO VIEJO, mientras los dos conviven (paso 1 del ticket: `Job.quoteId`
  // NO se retira). No es cinturón y tirantes: es lo que impide un fallo de DINERO durante la
  // ventana entre mergear esto y correr el backfill en cada base.
  //
  // Sin esta mitad, un Job cuyo Quote todavía no tiene `jobId` devolvería `[]`, y la agregación
  // sumaría CERO facturas pagadas: `totalCobrado` bajaría a 0 en un Job cobrado. El backfill de
  // producción lo ejecuta el fundador y no tiene por qué caer en el mismo momento que el
  // despliegue, así que la ventana existe de verdad.
  //
  // El PASO 2 (retirar `Job.quoteId`) es lo que borra esta mitad, y entonces `tsc` señala solo
  // lo que quede: ése es el ratchet, no la limpieza.
  const ids = new Set(porQuote.map((q) => q.id));
  if (job.quoteId) ids.add(job.quoteId);
  return [...ids];
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
    // SCRUM-195 (rebanada 1) · SE RESUELVE POR `Quote.jobId`, que es lo que anunciaba este
    // comentario. El fallo que cierra: con el `findUnique` por `Job.quoteId`, un ADICIONAL daba
    // `null` y la función se iba muda — cobrar el extra no movía el total del Trabajo.
    const quote = await prismaClient.quote.findUnique({ where: { id: quoteId }, select: { jobId: true } });
    let jobId = quote?.jobId ?? null;
    if (jobId == null) {
      // Sentido viejo, mientras conviven: par anterior al backfill. Misma razón que en
      // `quotesDelJob` — sin esto, durante la ventana previa al backfill se dejaría de
      // recalcular y el total se quedaría congelado tras un cobro.
      const job = await prismaClient.job.findUnique({ where: { quoteId }, select: { id: true } });
      jobId = job?.id ?? null;
    }
    if (jobId == null) return; // el Quote no tiene Job
    await recalcJobCobradoForJob(jobId, prismaClient);
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
export type EstadoCobro = 'Pagado' | 'Parcial' | 'Pendiente';

/**
 * SCRUM-363 · EL IMPORTE DE REFERENCIA contra el que se mide el cobro. `null` = **este Trabajo no
 * tiene eje de cobro**, y entonces no se puede afirmar nada sobre su dinero.
 *
 * El orden lo decidió el fundador:
 *   1. el total ACEPTADO, si existe y es > 0;
 *   2. si no, el total FACTURADO, si existe y es > 0;
 *   3. si no hay ninguno, no hay eje.
 *
 * El tercero es el que importa. Antes, sin importe de referencia, un Trabajo cobrado se quedaba
 * en «Parcial» PARA SIEMPRE: el pro cobraba, el dinero entraba, y el Trabajo seguía diciendo que
 * faltaba — y la pestaña «Pagado» no lo enseñaba nunca, así que perseguía un pago que ya tenía.
 * Y no es un caso raro: es el camino nuevo (Trabajos sin presupuesto, SCRUM-51; y la factura
 * suelta de A0 los multiplica).
 */
export function importeDeReferencia(aceptado: unknown, facturado?: unknown): number | null {
  const a = Number(aceptado);
  if (Number.isFinite(a) && a > 0) return a;
  const f = Number(facturado);
  if (Number.isFinite(f) && f > 0) return f;
  return null;
}

/**
 * El semáforo de cobro. `null` = sin eje: **no se pinta chip**, ni «Parcial» ni «Pendiente».
 *
 * ⚠️ NO se devuelve un estado intermedio ante la duda. «Parcial» es una AFIRMACIÓN sobre el
 * dinero de alguien, y afirmarla sin saber contra qué se compara es justo lo que produjo este
 * defecto. No pintar nada es verdad; pintar «Parcial» no lo es.
 */
export function estadoCobroFor(
  cobrado: number,
  aceptado: number,
  facturado?: number,
): EstadoCobro | null {
  const referencia = importeDeReferencia(aceptado, facturado);
  if (referencia === null) return null;
  const c = Number(cobrado) || 0;
  if (c >= referencia) return 'Pagado';
  if (c > 0) return 'Parcial';
  return 'Pendiente';
}

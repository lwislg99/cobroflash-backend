// src/modules/jobs/app/routes/jobs.routes.ts — A13.2/A13.3 (EXT3, JOB-1)
// Lista "Esta semana" + FSM + .ics por trabajo + "Cobrar el resto" (V2: el
// resto JAMÁS se cobra solo — SIEMPRE acción del pro). Merchant-scoped (regla 2).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { requireRole } from '../../../../core/http/authMiddleware'; // SCRUM-55 (S1: dinero = admin)
import { seesOnlyOwnJobs, seesAllJobs, adminOnlyJobField } from '../../../../core/http/roleCapabilities'; // SCRUM-147 / SCRUM-164
import { listExpenses } from '../../../expenses/domain/expenses.service'; // SCRUM-370: los gastos de ESTE Trabajo
import { canTransition, estadoCobroFor, importeDeReferencia, JOB_TIPOS_OPERACION } from '../../domain/job.service';
import { recordAudit, actorDeRequest, sobreFiscal, flagsFiscalesDe } from '../../../system/audit.service'; // SCRUM-66 · SCRUM-207 · SCRUM-206b
import { resolveBillingPlan, distributeStageAmounts, motivoSinTramo } from '../../../quotes/domain/billingPlan';
import { buildBillingPlanView } from '../../../quotes/domain/billingPlanView'; // SCRUM-34
// SCRUM-195 (rebanada 2): el CRITERIO (orden, cuál se cobra, cuánto queda) vive en su propio
// módulo para que el test use el MISMO y no una copia.
import { primeroConTramoPendiente, restanteDelTrabajo } from '../../domain/presupuestosDelTrabajo';
// SCRUM-651 (T2): el nucleo del Trabajo sin presupuesto, puro y probado sin base.
import { datosDeTrabajoDirecto, filaDeTrabajoDirecto, tituloDeTrabajo } from '../../domain/trabajoDirecto';
import { sendInvoicePaymentRequest } from '../../../billing/domain/invoiceWhatsApp.service';
import { allocateInvoiceNumber, isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service'; // SCRUM-173
import { allocateAlbaranNumber } from '../../domain/albaranNumber.service';
// SCRUM-358 (H3): el alta de albarán, idempotente.
import {
  normalizarClaveIdempotencia,
  tomarCerrojoDeSerie,
  compararAlta,
  ClaveIdempotenciaReutilizadaError,
  ERROR_CLAVE_REUTILIZADA,
  msgClaveReutilizada,
} from '../../domain/albaranIdempotencia';
// SCRUM-424 (G3): la dirección de la OBRA — el escritor que le faltaba al bloque DÓNDE del rail.
import {
  normalizarJobDireccion,
  albaranesConFirmaQueDependeDelTrabajo,
  ERROR_DIRECCION_SELLADA,
  MSG_DIRECCION_SELLADA,
} from '../../domain/jobDireccion';
// SCRUM-170: derivación del estado de cobro (parcial) — nunca un flag almacenado.
import { estadoCobroAlbaran, facturadoPorLinea, pendientePorLinea } from '../../domain/albaranFacturacion';
import { normalizarLugarEntrega } from '../../domain/albaranFirmante'; // SCRUM-424
import { emitirRecapitulativas } from '../../domain/recapitulativa.service'; // SCRUM-171a: emisión compartida
// SCRUM-423: el eje de ENTREGA (C6 · SCRUM-305) llega por fin a la pantalla. El cálculo NO se
// toca: esto sólo resuelve sus tres entradas con datos que este serializador ya tiene cargados.
import { entregaDelTrabajo, entregaParaVista } from '../../domain/entregaDelTrabajo';
import {
  ALBARAN_MODOS_VALORACION,
  serializeAlbaran,
  validarLineas,

  contarLineasDePresupuesto, // SCRUM-367
  validarConsolidacion,
  groupByRotura,
  type AlbaranModoValoracion,
} from '../../domain/albaran.service';
import { emitInvoice } from '../../../invoicing/domain/invoicing.service'; // SCRUM-17
import { getEmissionMode } from '../../../invoicing/domain/emission.service'; // SCRUM-17: gate fiscal
import { calcVatBreakdown } from '../../../invoicing/domain/vat.service'; // SCRUM-17: total con desglose IVA
import { stageLinesReconciled, grossOfLines } from '../../../invoicing/domain/invoiceLines.service'; // SCRUM-141: el total se deriva de las líneas
import { ensureChargeReceiptToken } from '../../../../lib/invoicing';
import { SEND_FAILURE_MESSAGES, type SendFailureReason } from '../../../../lib/sendOutcome'; // SCRUM-126
import { debeEstarEnLaCadena } from '../../../invoicing/domain/portonDocumento'; // SCRUM-206b
import { sellarTrasEmision } from '../../../invoicing/domain/selladoEstado'; // SCRUM-205
import { exigirLineasFacturables, esErrorSinLineas, ERROR_SIN_LINEAS, COPY_ADMIN_SIN_LINEAS } from '../../../invoicing/domain/lineasFacturables'; // SCRUM-246

const router = Router();

const jobInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  // quote via relation? Job no tiene relación Prisma declarada — se resuelve a mano
} as const;

// SCRUM-58: selects EXACTOS que ya usaba serializeJob por fila — se extraen para que la
// versión por lote y la de una sola fila no puedan divergir (mismos campos, misma forma).
const QUOTE_SELECT = {
  id: true, quoteNumber: true, total: true, currency: true,
  paymentTerms: true, customBillingPlan: true, // SCRUM-27: para resolver el plan efectivo
  lines: true, // SCRUM-141: el importe de cada tramo se deriva de las líneas (= lo que se emitirá)
  Invoice: { select: { id: true, status: true, total: true } },
} as const;
const CUSTOMER_SELECT = { id: true, name: true, phone: true } as const;

/**
 * SCRUM-58: resuelve quote + customer + operario de TODOS los jobs de una lista en 3
 * consultas, en vez de 3 por fila (N+1 de SCRUM-22). El detalle (1 job) no lo necesita y
 * sigue por el camino de siempre.
 *
 * La clave del operario incluye el merchantId a propósito: la consulta por fila iba
 * SCOPEADA al merchant del Job (regla 2, tenancy) y el lote tiene que conservar esa
 * semántica exacta — un `id in (...)` a secas resolvería operarios de otro merchant si dos
 * filas trajeran el mismo id.
 */
type JobRefs = {
  quotes: Map<number, any>;
  /**
   * SCRUM-195 (rebanada 2) · TODOS los presupuestos de cada Trabajo, precargados en lote.
   *
   * Va en el lote y no en una consulta por fila a propósito: la lista serializa hasta 200
   * Trabajos, y resolver la pertenencia dentro de `serializeJob` habría reintroducido el N+1
   * que SCRUM-58 quitó — medido allí en 2910 ms contra 1270 ms.
   */
  quotesPorJob: Map<number, any[]>;
  customers: Map<number, any>;
  operarios: Map<string, { id: number; name: string }>;
};
const operarioKey = (merchantId: number, operarioId: number) => `${merchantId}:${operarioId}`;

async function loadJobRefs(jobs: any[]): Promise<JobRefs> {
  const quoteIds = [...new Set(jobs.map((j) => j.quoteId).filter((v): v is number => v != null))];
  const customerIds = [...new Set(jobs.map((j) => j.customerId).filter((v): v is number => v != null))];
  const conOperario = jobs.filter((j) => j.operarioId != null);
  const operarioIds = [...new Set(conOperario.map((j) => j.operarioId as number))];
  const merchantIds = [...new Set(conOperario.map((j) => j.merchantId as number))];

  // SCRUM-195: el sentido NUEVO, en lote. `merchantId` acota la lectura (regla 2).
  const jobIds = jobs.map((j) => j.id).filter((v): v is number => v != null);
  const merchantsDeJobs = [...new Set(jobs.map((j) => j.merchantId).filter((v): v is number => v != null))];

  const [quotes, porJobId, customers, operarios] = await Promise.all([
    quoteIds.length
      ? prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: QUOTE_SELECT })
      : Promise.resolve([]),
    // Los adicionales, y los originales ya backfilleados. El sentido viejo de arriba se
    // mantiene mientras conviven: sin él, un par anterior al backfill perdería su presupuesto
    // en la lista — el mismo fallo que esto viene a cerrar, en la otra ventana.
    jobIds.length && merchantsDeJobs.length
      ? prisma.quote.findMany({
          where: { jobId: { in: jobIds }, merchantId: { in: merchantsDeJobs } },
          select: { ...QUOTE_SELECT, jobId: true },
        })
      : Promise.resolve([]),
    customerIds.length
      ? prisma.customer.findMany({ where: { id: { in: customerIds } }, select: CUSTOMER_SELECT })
      : Promise.resolve([]),
    operarioIds.length
      ? prisma.teamMember.findMany({
          where: { id: { in: operarioIds }, merchantId: { in: merchantIds } },
          select: { id: true, name: true, merchantId: true },
        })
      : Promise.resolve([]),
  ]);

  const porId = new Map<number, any>([...quotes, ...porJobId].map((q: any) => [q.id, q]));
  const quotesPorJob = new Map<number, any[]>();
  for (const j of jobs) {
    const suyos: any[] = [];
    const vistos = new Set<number>();
    // El ORIGINAL primero: define el alcance base, y ese orden lo usan tanto el detalle como
    // `collect-rest` para ser deterministas (§4 del ticket).
    if (j.quoteId != null && porId.has(j.quoteId)) { suyos.push(porId.get(j.quoteId)); vistos.add(j.quoteId); }
    for (const q of porJobId as any[]) {
      if (q.jobId === j.id && !vistos.has(q.id)) { suyos.push(q); vistos.add(q.id); }
    }
    quotesPorJob.set(j.id, suyos);
  }

  return {
    quotes: porId,
    quotesPorJob,
    customers: new Map(customers.map((c: any) => [c.id, c])),
    operarios: new Map(operarios.map((o: any) => [operarioKey(o.merchantId, o.id), { id: o.id, name: o.name }])),
  };
}

/**
 * SCRUM-195 (rebanada 2) · LOS PRESUPUESTOS DE UN TRABAJO, para el camino de LECTURA.
 *
 * Con `refs` sale del lote (lista); sin él consulta, que es lo que hacen el detalle y el update.
 * Devuelve el ORIGINAL primero y los adicionales después, por id: el orden es parte del
 * contrato — de él dependen el título, el plan base y a qué presupuesto va el siguiente tramo.
 *
 * Los DOS sentidos siguen vivos (paso 1: `Job.quoteId` no se retira). El nuevo responde por
 * `Quote.jobId`; el viejo cubre los pares que aún no tiene el backfill.
 */
async function quotesDeJob(job: any, refs?: JobRefs): Promise<any[]> {
  if (refs) return refs.quotesPorJob.get(job.id) ?? [];

  const [original, porJob] = await Promise.all([
    job.quoteId != null
      ? prisma.quote.findUnique({ where: { id: job.quoteId }, select: QUOTE_SELECT })
      : Promise.resolve(null),
    prisma.quote.findMany({
      where: { jobId: job.id, merchantId: job.merchantId }, // regla 2
      select: { ...QUOTE_SELECT, jobId: true },
    }),
  ]);

  const salida: any[] = [];
  const vistos = new Set<number>();
  if (original) { salida.push(original); vistos.add(original.id); }
  for (const q of porJob) if (!vistos.has(q.id)) { salida.push(q); vistos.add(q.id); }
  return salida;
}

/**
 * SCRUM-363 · lo FACTURADO del Trabajo: suma de las facturas de sus presupuestos.
 *
 * Es el segundo candidato a importe de referencia, y existe porque el primero puede no estar: un
 * Trabajo sin presupuesto (SCRUM-51) no tiene `totalAceptado`, pero si se le ha emitido factura,
 * ESA es la cifra contra la que su cobro significa algo.
 *
 * Se suman TODAS las facturas del presupuesto, incluidas las anuladas: aquí no se decide política
 * fiscal, solo si existe un eje contra el que medir. Afinarlo es otra decisión.
 */
function totalFacturadoDe(quotes: any[]): number {
  let total = 0;
  for (const q of quotes ?? []) {
    for (const inv of q?.Invoice ?? []) total += Number(inv?.total ?? 0);
  }
  return total;
}

async function serializeJob(job: any, refs?: JobRefs) {
  // SCRUM-58: con `refs` (lista) se lee del lote; sin él (detalle, update) se consulta como
  // siempre. Mismos selects en ambas ramas — ver QUOTE_SELECT/CUSTOMER_SELECT.
  // SCRUM-195 (rebanada 2): el Trabajo puede tener VARIOS presupuestos. `quote` sigue siendo el
  // ORIGINAL —define el alcance base, el título y la moneda—, pero el DINERO ya no se lee solo
  // de él: ver `remaining` abajo.
  const todosLosQuotes = await quotesDeJob(job, refs);
  const quote = todosLosQuotes[0] ?? null;
  const customer = refs
    ? refs.customers.get(job.customerId) ?? null
    : await prisma.customer.findUnique({ where: { id: job.customerId }, select: CUSTOMER_SELECT });
  // SCRUM-22 (read-path): autoría del operario. Resuelve el TeamMember de la Parte S1
  // por operarioId, SCOPEADO al merchant del Job (regla 2, tenancy). null = propietario.
  const operario = job.operarioId
    ? refs
      ? refs.operarios.get(operarioKey(job.merchantId, job.operarioId)) ?? null
      : await prisma.teamMember.findFirst({
          where: { id: job.operarioId, merchantId: job.merchantId },
          select: { id: true, name: true },
        })
    : null;

  // A13.3: ¿queda tramo pendiente? (plan según paymentTerms vs facturas emitidas)
  let remaining: { amount: number; currency: string } | null = null;
  let planView: ReturnType<typeof buildBillingPlanView> | null = null; // SCRUM-34
  if (quote) {
    // SCRUM-195 (rebanada 2) · `remaining` SUMA TODOS los presupuestos del Trabajo.
    //
    // EL FALLO QUE CIERRA: antes salía solo del original, así que un adicional aceptado y no
    // cobrado NO aparecía en «pendiente». El pro veía menos deuda de la que tiene — dinero
    // visible que no aparece, y sin ningún error.
    //
    // Cada presupuesto tiene su PROPIO plan (decisión 5 del ticket: el plan del extra es
    // independiente), así que lo correcto es sumar los restos, no recalcular un plan conjunto.
    const pendiente = restanteDelTrabajo(todosLosQuotes, resolveBillingPlan);
    if (pendiente > 0) {
      remaining = { amount: Math.round(pendiente * 100) / 100, currency: quote.currency };
    }
    // SCRUM-34: siguiente tramo + pendientes por el MISMO conteo que collect-rest (plan[emitted]).
    // ⚠️ `planView` sigue siendo el del ORIGINAL a propósito: es la vista del plan BASE, y
    // enseñar los planes de los adicionales es timeline multi-documento — rebanada 3, con su
    // microcopy. Lo que NO puede seguir mintiendo hoy es el importe pendiente, y ése ya suma.
    planView = buildBillingPlanView(quote, (quote.Invoice || []).length);
  }

  return {
    id: job.id,
    status: job.status,
    scheduledAt: job.scheduledAt,
    assignedUserId: job.assignedUserId,
    notes: job.notes,
    createdAt: job.createdAt,
    // SCRUM-10: campos del contenedor "Trabajo". Fallback a derivado para Jobs
    // anteriores (titulo/totalAceptado null) → sin cambiar el comportamiento visible.
    // 🔴 SCRUM-651 · el CRITERIO del titulo vive en `tituloDeTrabajo`, no aqui: en linea solo se
    // podia vigilar comparando texto, y un guard asi pasa en verde en cuanto alguien reescribe la
    // expresion sin cambiar el defecto. Medido en su tanda de rojos.
    titulo: tituloDeTrabajo({ titulo: job.titulo, quote, customer, jobId: job.id }),
    direccion: job.direccion ?? null,
    totalAceptado: job.totalAceptado != null ? Number(job.totalAceptado) : (quote ? Number(quote.total) : null),
    totalCobrado: Number(job.totalCobrado ?? 0),
    // SCRUM-13: semáforo de cobro derivado (SCRUM-11 lo pinta; aquí NO se hace UI).
    // totalCobrado lo materializa recalcJobCobradoForCharge en los webhooks de pago.
    // SCRUM-363 · el eje de cobro puede NO existir, y entonces esto vale `null` y no se pinta
    // chip. El importe FACTURADO es el segundo candidato del orden decidido: sale de las facturas
    // de los presupuestos del Trabajo, que ya están resueltas aquí — sin consulta nueva.
    estadoCobro: estadoCobroFor(
      Number(job.totalCobrado ?? 0),
      job.totalAceptado != null ? Number(job.totalAceptado) : (quote ? Number(quote.total) : 0),
      totalFacturadoDe(todosLosQuotes),
    ),
    // SCRUM-363 · el EJE, explícito. Viaja para que la interfaz no vuelva a derivarlo por su
    // cuenta: el listado decidía si pintar el chip con `aceptado > 0`, que era un SEGUNDO
    // criterio — y en cuanto el eje puede venir de lo facturado, los dos dejan de coincidir y el
    // mismo Trabajo sale «Pagado» en el detalle y sin chip en la lista. `null` = sin eje.
    importeReferencia: importeDeReferencia(
      job.totalAceptado != null ? Number(job.totalAceptado) : (quote ? Number(quote.total) : 0),
      totalFacturadoDe(todosLosQuotes),
    ),
    customer,
    // SCRUM-22: autoría del operario (creador del presupuesto, congelada en SCRUM-52).
    // operarioId crudo (paridad con assignedUserId) + operario resuelto para pintar el nombre.
    // La UI del detalle/timeline la consume aparte (jobDetailView.js, carril de Javier).
    operarioId: job.operarioId ?? null,
    operario: operario ? { id: operario.id, name: operario.name } : null,
    // SCRUM-66 (TRABAJO-4): tipo de operación fiscal (default para Jobs previos al campo).
    // El motor que lo respeta es SCRUM-17; aquí solo se lee/edita en el detalle.
    tipoOperacion: job.tipoOperacion ?? 'TRABAJO_UNICO',
    quote: quote
      ? { id: quote.id, number: quote.quoteNumber ?? quote.id, total: Number(quote.total), currency: quote.currency, paymentTerms: quote.paymentTerms }
      : null,
    remaining, // null = nada pendiente de facturar
    // SCRUM-34: para el label honesto del CTA (siguiente tramo vs resto). remaining NO cambia.
    nextStage: planView?.nextStage
      ? { label: planView.nextStage.label, amount: planView.nextStage.amount, currency: planView.nextStage.currency }
      : null,
    pendingStagesCount: planView?.pendingStagesCount ?? 0,
    hasCustomPlan: planView?.hasCustomPlan ?? false,
  };
}

// SCRUM-12: serializer del DETALLE (aditivo, solo lectura). Reutiliza serializeJob(job)
// para la base y AÑADE invoices[] + charge anidados, espejando la forma de
// getQuoteDetailAdmin (quoteAdmin.ts:141-160) con su PROPIO fetch (Job 1:1 Quote vía
// Job.quoteId; NO acopla a getQuoteDetailAdmin). GAP CERRADO: cada invoice expone
// status/paidAt/payToken (semáforo por tramo + link /pay/invoice/:token, SCRUM-85).
async function serializeJobDetail(job: any) {
  const base = await serializeJob(job);
  // SCRUM-12 (decisión 2): el detalle expone customer.email (fallback de correo del
  // "Reenviar por WhatsApp"). Aditivo, solo lectura; Customer.email ya existe (no es schema).
  // SCRUM-292 (A1): y `taxId`, para que la revisión ANTES de emitir sepa si falta el NIF. Aditivo y
  // de solo lectura, igual que el email: `Customer.taxId` ya existe y ya se edita desde la ficha.
  // No toca el camino de emisión (regla 38) — el tipo de factura lo sigue derivando quien lo
  // derivaba; esto solo permite preguntar por el dato que falta ANTES de llegar ahí.
  let customer: any = base.customer;
  if (customer && job.customerId) {
    const c = await prisma.customer.findUnique({
      where: { id: job.customerId },
      select: { email: true, taxId: true },
    });
    customer = { ...customer, email: c?.email ?? null, taxId: c?.taxId ?? null };
  }
  // SCRUM-14 (ADITIVO): albaranes del Trabajo para la sección "Albaranes" y el timeline de
  // Documentos. Documento NO fiscal — nada de importes. SCRUM-22: la autoría del Trabajo se
  // propaga a sus documentos (albarán), derivada de Job.operarioId ya resuelto en base.
  // SCRUM-51: los albaranes son del Trabajo (Job-owned vía jobId), INDEPENDIENTES del quote →
  // se cargan SIEMPRE, también para un Job manual sin quoteId (antes el early-return del quote
  // los dejaba invisibles en el detalle — bug latente de datos "desaparecidos").
  const albaranesRaw = await prisma.albaran.findMany({
    where: { merchantId: job.merchantId, jobId: job.id },
    orderBy: { createdAt: 'asc' },
  });
  // SCRUM-170: el estado de cobro y lo pendiente por línea se DERIVAN del libro de líneas
  // facturadas — ninguna columna los guarda. UN solo `findMany` para todos los albaranes del
  // Trabajo (patrón de SCRUM-58: un lote, no una consulta por fila).
  const libroJob = albaranesRaw.length
    ? await prisma.albaranLineaFacturada.findMany({
        where: { merchantId: job.merchantId, albaranId: { in: albaranesRaw.map((a) => a.id) } },
        select: { albaranId: true, lineaIndex: true, cantidad: true, invoiceId: true },
      })
    : [];
  const albaranes = albaranesRaw.map((a) => {
    const facturado = facturadoPorLinea(libroJob.filter((f) => f.albaranId === a.id));
    const lineas = (Array.isArray(a.lineas) ? a.lineas : []) as any[];
    return {
      ...serializeAlbaran(a),
      operario: base.operario,
      // `facturado` (invoiceId != null) sigue intacto en serializeAlbaran; esto lo COMPLETA con
      // los tres valores derivados: sin_facturar | parcial | facturado.
      //
      // ⚠️ SCRUM-372 · SE LLAMA IGUAL QUE EN EL DETALLE DEL ALBARÁN, Y ES EL PUNTO DEL TICKET.
      // Antes salía de aquí como `estadoCobro` y de `albaranes.routes.ts:575` como
      // `estadoFacturacion`, siendo la MISMA llamada. Y `estadoCobro` ya nombra otra cosa en este
      // mismo endpoint: el cobro del TRABAJO (`Pagado`/`Parcial`/`Pendiente`, línea 253).
      estadoFacturacion: estadoCobroAlbaran(lineas, facturado, a.invoiceId != null),
      pendientes: pendientePorLinea(lineas, facturado),
    };
  });

  // invoices[] y charge SÍ dependen de los presupuestos (tramos/cobro): un Job sin ninguno no
  // tiene → []/null.
  //
  // SCRUM-195 (rebanada 2) · SE PREGUNTA POR TODOS, no solo por `job.quoteId`. Antes las
  // facturas de un ADICIONAL no salían en el detalle: el pro no las veía, y no había error.
  // Y la condición de corte era `!job.quoteId`, que con 1:N es la pregunta equivocada — un
  // Trabajo manual (SCRUM-51) con un adicional colgado tiene `quoteId` null y SÍ tiene
  // facturas que enseñar.
  const quotesDelTrabajo = await quotesDeJob(job);
  // SCRUM-423 · el eje de ENTREGA viaja TAMBIÉN por esta salida temprana. Un Trabajo manual
  // (SCRUM-51) no tiene presupuesto contra el que medir, y eso es `sin_eje` — una respuesta, no un
  // fallo. Omitir el campo aquí dejaría a la pantalla sin poder distinguirlo de «no se pudo leer».
  if (quotesDelTrabajo.length === 0) {
    return {
      ...base, customer, invoices: [], charge: null, albaranes,
      entregaPendiente: entregaParaVista(entregaDelTrabajo([], albaranesRaw)),
    };
  }

  const detalles = await prisma.quote.findMany({
    where: { id: { in: quotesDelTrabajo.map((q) => q.id) }, merchantId: job.merchantId }, // regla 2
    select: {
      id: true,
      charge: { select: { id: true, status: true, method: true, amount: true, currency: true } },
      Invoice: {
        select: {
          id: true, number: true, total: true, currency: true, createdAt: true,
          pdfUrl: true, type: true, status: true, paidAt: true, chargeId: true, stageLabel: true, // SCRUM-27
          // SCRUM-319 (G4): el vínculo de la rectificativa con su original. Ya existía en el
          // modelo (`rectifies_id`, relación "Rectification") y NO llegaba a la pantalla del
          // Trabajo. Aditivo y de solo lectura: sin él la rectificativa se pinta como una fila
          // suelta que no dice a qué factura corrige, que es legalmente ilegible.
          rectifiesId: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // El ORIGINAL manda para `charge` (es el cobro base y el campo es singular en la API);
  // enseñar el de cada adicional es timeline multi-documento, o sea rebanada 3.
  const porIdDetalle = new Map(detalles.map((d) => [d.id, d]));
  const quote = porIdDetalle.get(quotesDelTrabajo[0].id) ?? null;
  // Las FACTURAS sí se juntan todas y se ordenan por fecha: son el dinero, y omitir las del
  // adicional es exactamente lo que este cambio viene a cerrar.
  const facturasDelTrabajo = quotesDelTrabajo
    .flatMap((q) => porIdDetalle.get(q.id)?.Invoice ?? [])
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // SCRUM-85: payToken (Charge.receiptToken) AÑADIDO para el link público /pay/invoice/:token
  // (IDOR/RGPD — ya no acepta el id numérico). chargeId se CONSERVA: lo sigue usando la
  // acción autenticada /admin/charges/:chargeId/confirm-bizum (no es superficie pública).
  const invoices = await Promise.all(facturasDelTrabajo.map(async (inv) => ({
    id: inv.id,
    number: inv.number,               // número visible de la factura/justificante
    total: Number(inv.total),         // Decimal(12,2) → Number (como serializeJob)
    currency: inv.currency,
    createdAt: inv.createdAt,
    pdfUrl: inv.pdfUrl,
    type: inv.type,                   // F1 | JUST | R1 (para el copy del timeline)
    status: inv.status,               // ← GAP CERRADO (semáforo por tramo)
    paidAt: inv.paidAt,               // ← GAP CERRADO
    chargeId: inv.chargeId,           // acción admin confirm-bizum (autenticada, NO es link público)
    payToken: inv.chargeId ? await ensureChargeReceiptToken(inv.chargeId, prisma) : null, // ← GAP CERRADO (link /pay/invoice/:token)
    stageLabel: inv.stageLabel,       // SCRUM-27: etiqueta del tramo (custom); null en presets
    rectifiesId: inv.rectifiesId,     // SCRUM-319 (G4): a qué factura rectifica (solo R1)
  })));

  const charge = quote?.charge
    ? {
        id: quote.charge.id,
        status: quote.charge.status,
        method: quote.charge.method,
        amount: Number(quote.charge.amount),
        currency: quote.charge.currency,
        operario: base.operario, // SCRUM-22: autoría del Trabajo propagada al cobro (regla 2, vía base)
      }
    : null;

  // SCRUM-423 · «qué queda por ENTREGAR», el eje que C6 construyó y que hasta hoy no salía de su
  // test. Sin consulta nueva: `quotesDelTrabajo` ya viene con `lines` (QUOTE_SELECT) y con el
  // ORIGINAL el primero, que es lo que `entregaDelTrabajo` necesita para decidir el eje y
  // `hayAdicionales`. Los albaranes van CRUDOS —`albaranesRaw`— y no los serializados: el cálculo
  // mira `lineas`, `estado` y `modoValoracion`, y el serializado no está obligado a conservarlos.
  const entrega = entregaParaVista(entregaDelTrabajo(quotesDelTrabajo, albaranesRaw));

  return { ...base, customer, invoices, charge, albaranes, entregaPendiente: entrega };
}

// GET /admin/jobs — lista para la vista "Esta semana" (simple, por fecha)
router.get('/', async (req, res) => {
  try {
    // SCRUM-23 (S1 roles · S3 filtrar en BACKEND): el técnico solo ve los Trabajos que
    // originó (operarioId = él; autoría inmutable de SCRUM-22). Admin/owner: sin cambio.
    // El filtro va en la QUERY, jamás ocultando en front datos ya enviados.
    // SCRUM-147: se pregunta por CAPACIDAD, no por igualdad a 'tecnico'. Era una DENYLIST y por
    // tanto fail-OPEN: cualquier rol que no fuera exactamente 'tecnico' se saltaba el filtro y
    // veía TODOS los Trabajos del merchant. `seesOnlyOwnJobs` complementa un allowlist de
    // 'admin', así que un rol desconocido queda RESTRINGIDO — misma lección que SCRUM-55 dejó
    // escrita en consolidar-albaranes (:470) y que aquí no se había aplicado.
    // SCRUM-467 · LOS DOS EJES, y NO son el mismo campo — lo declara el schema de `Job`:
    // `operarioId` es AUTORÍA (quien creó el presupuesto, congelada al aceptar — SCRUM-52) y
    // `assignedUserId` es QUIEN LO EJECUTA (SCRUM-10). Filtrar solo por el primero dejaba fuera
    // los Trabajos que a alguien le ASIGNAN: **asignar un trabajo no hacía que el técnico lo
    // viera**, y había 6 con `assignedUserId` escrito que no miraba nadie.
    // No se unifican los campos —son dos ideas distintas—: se filtra por LOS DOS.
    const where: {
      merchantId: number;
      operarioId?: number | null;
      OR?: Array<{ operarioId?: number | null; assignedUserId?: number | null }>;
    } = { merchantId: req.merchantId };
    const restringido = seesOnlyOwnJobs(req.userRole);
    if (restringido) where.OR = [{ operarioId: req.teamMemberId }, { assignedUserId: req.teamMemberId }];

    // SCRUM-148: ?operarioId=<id> | 'owner' → Trabajos de ESE operario, para el detalle por
    // miembro del hub de Equipo.
    //
    // ⚠️ EL FILTRO VA ENCIMA DEL ROW-LEVEL, NUNCA EN SU LUGAR. Para quien está restringido
    // (SCRUM-23/147) el `where.operarioId` ya está fijado a SÍ MISMO y el parámetro se
    // IGNORA por completo: si se asignara aquí, un técnico tendría, con un query param, la
    // llave para leer los Trabajos de un compañero — justo el agujero que SCRUM-23 cerró.
    // Ignorar en vez de responder 403 es deliberado: el hub que usa este parámetro es
    // admin-only, así que un restringido que lo mande no tiene caso de uso legítimo, y
    // devolverle SUS trabajos es una respuesta correcta y sin oráculo (no le dice si el
    // operario que preguntaba existe).
    if (!restringido) {
      const raw = req.query.operarioId;
      // 'owner' explícito: el propietario no tiene fila en team_members y sus Trabajos van con
      // operarioId null. Un parámetro vacío o un 0 accidental NO pueden significar "los del
      // propietario" por descuido; lo que no se entiende, no filtra.
      if (raw === 'owner') where.operarioId = null;
      else if (raw !== undefined && Number.isInteger(Number(raw))) where.operarioId = Number(raw);
    }
    const jobs = await prisma.job.findMany({
      where,
      orderBy: [{ scheduledAt: 'asc' }, { id: 'desc' }],
      take: 200,
    });
    // SCRUM-58: un solo lote para toda la lista → 3 consultas fijas en vez de 3 por fila.
    const refs = await loadJobRefs(jobs);
    const out = [];
    for (const j of jobs) out.push(await serializeJob(j, refs));
    return res.json(out);
  } catch (err: any) {
    console.error('[GET /admin/jobs]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/jobs/:id — DETALLE del Trabajo (SCRUM-12, solo lectura, aditivo).
// Tenancy idéntica al resto de handlers :id (findFirst { id, merchantId } → 404).
// ── SCRUM-651 (T2) · ABRIR UN TRABAJO SIN PRESUPUESTO ───────────────────────────────────
//
// LA PUERTA QUE FALTABA. Hasta hoy el ÚNICO creador de Trabajos era `ensureJobForQuote`, que
// arranca en `quote → accepted`: no había forma de meter una AVERÍA en el producto, que es el
// caso MÁS frecuente del primer cliente real. Nadie presupuesta una urgencia.
//
// ⚠️ La exigencia era DE HECHO, no del esquema: `Job.quoteId` ya era `Int?`. Cero cambios de
// schema, que es el freno duro del proyecto.
//
// 🔴 NO ES ADMIN-ONLY, y está medido: quien coge la avería es el técnico, en la calle. El gate
// por CAMPO del PATCH sigue intacto (`tipoOperacion`, `assignedUserId`, cerrar) — aquí no se
// escribe ninguno de esos, así que abrir la creación no abre nada de dinero ni de reparto.
router.post('/', async (req, res) => {
  try {
    const entrada = datosDeTrabajoDirecto(req.body);
    if (!entrada.ok) return res.status(400).json({ error: entrada.error });

    // regla 2 · el cliente tiene que ser DE ESTE merchant. Y se comprueba ANTES de crear: sin
    // esto, un `customerId` de otro merchant fabricaría un Trabajo que apunta fuera del inquilino
    // y que nadie podría ni ver ni borrar.
    const customer = await prisma.customer.findFirst({
      where: { id: entrada.datos.customerId, merchantId: req.merchantId },
      select: { id: true },
    });
    if (!customer) return res.status(404).json({ error: 'customer_not_found' });

    const job = await prisma.job.create({
      data: filaDeTrabajoDirecto(req.merchantId, entrada.datos, req.teamMemberId ?? null),
    });

    // ⚠️ SIN `recordAudit`, y es una AUSENCIA DECIDIDA, no un olvido: `AuditAction` es un conjunto
    // CERRADO (regla 27) y no tiene ninguna acción para «trabajo creado». Inventarla aquí sería
    // ampliar un enum cerrado sin pasar por el máster. Queda propuesto en `docs/master/SCRUM-651.md`.
    return res.status(201).json(await serializeJob(job));
  } catch (err: any) {
    console.error('[jobs] POST / falló:', err?.message || err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });
    // SCRUM-23: row-level por operario dentro del MISMO merchant. Un técnico no abre por
    // URL el Trabajo de otro → 404 (mismo patrón que la tenancy: no filtra existencia).
    // SCRUM-147: por capacidad (ver el comentario de GET /admin/jobs y roleCapabilities.ts).
    if (seesOnlyOwnJobs(req.userRole) && job.operarioId !== req.teamMemberId) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.json(await serializeJobDetail(job));
  } catch (err: any) {
    console.error('[GET /admin/jobs/:id]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/jobs/:id/gastos — SCRUM-370: LOS GASTOS DE ESTE TRABAJO.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * EL DEFECTO: QUIEN PUEDE CREAR ALGO NO PODÍA VOLVER A VERLO
 *
 * «+ Añadir gasto» se construyó **para el técnico** (SCRUM-135: compra material en la furgoneta y
 * lo registra sin llamar al jefe). Pero `GET /admin/expenses` es `requireRole('admin')` y su nav
 * está oculto, así que tras el toast de confirmación **el gasto desaparecía para él para
 * siempre**. No es que no se guardara —se guarda, con su `quoteId`—: es que su autor no podía
 * comprobarlo.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * POR QUÉ UNA RUTA POR TRABAJO Y NO ABRIR `GET /admin/expenses` AL TÉCNICO
 *
 * Abrir el listado global con `?quoteId=` habría dejado enumerar cotizaciones y ver los gastos de
 * CUALQUIER trabajo del merchant, incluidos los que no son suyos. Esta ruta cuelga del Trabajo, así
 * que hereda el mismo candado que `GET /admin/jobs/:id`: tenencia por `merchantId` **y** la regla
 * de SCRUM-147 —un técnico solo ve SUS Trabajos—. Se abre lo justo, y por el sitio que ya decide
 * quién puede mirar.
 *
 * ⚠️ ALCANCE DECLARADO, y el límite es del ticket vecino: **sin totales, sin márgenes y sin
 * comparar con el presupuesto**. Eso es rentabilidad por obra y tiene su propio camino
 * (`GET /admin/expenses/margin/:quoteId`, admin-only), que aquí NO se toca. Esto solo devuelve lo
 * que el usuario metió, para que pueda verlo.
 */
router.get('/:id/gastos', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });
    if (seesOnlyOwnJobs(req.userRole) && job.operarioId !== req.teamMemberId) {
      return res.status(404).json({ error: 'not_found' });
    }
    // Un Trabajo sin cotización no puede tener gastos vinculados: el gasto se ata por `quoteId`.
    // Lista VACÍA, no 404: «no tiene gastos» es una respuesta, no un error.
    if (job.quoteId == null) return res.json({ gastos: [] });
    const gastos = await listExpenses(req.merchantId!, { quoteId: job.quoteId });
    return res.json({ gastos });
  } catch (err: any) {
    console.error('[GET /admin/jobs/:id/gastos]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /admin/jobs/:id — { status?, scheduledAt?, notes?, assignedUserId? }
router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });

    // SCRUM-120: gate por CAMPO (no por ruta — status/scheduledAt/notes del día a día son del operario).
    // Admin-only por afectar a FACTURACIÓN/DINERO: `tipoOperacion` (bandera fiscal: recapitulativa mensual
    // vs. al concluir), `assignedUserId` (reparto del equipo, S1) y cerrar el Trabajo (`status:'cerrado'`:
    // única transición IRREVERSIBLE de la FSM y mata la vía de "Cobrar el resto"). FAIL-CLOSED: si un técnico
    // manda CUALQUIERA (aunque venga mezclado con campos legítimos), se rechaza ENTERO — nada de aplicar
    // parcial en zona fiscal. (La UI ya deshabilita estos controles para el técnico; esto es el candado real.)
    // SCRUM-164: la REGLA vive en roleCapabilities.ts, junto al resto de reglas de rol, y aquí
    // solo se aplica. Antes era un `if` suelto con la lista de campos escrita a mano dentro del
    // handler: el único gate de rol de todo src/ invisible para la derivación de
    // scrum55-admin-fail-closed (que reconoce el marcador que pone requireRole, y un `if` no lo
    // lleva). Sigue siendo gate por CAMPO —convertirlo en requireRole('admin') dejaría al
    // técnico sin tocar sus propios trabajos, que es lo que SCRUM-120 construyó—, pero ahora es
    // una función con nombre, probable sin BD y declarada en FIELD_LEVEL_ROLE_GATES.
    if (!seesAllJobs(req.userRole)) {
      const adminOnlyField = adminOnlyJobField(req.body);
      if (adminOnlyField) {
        return res.status(403).json({ error: 'forbidden', required_role: 'admin', field: adminOnlyField });
      }
    }

    const data: any = {};
    if (req.body?.status !== undefined) {
      const to = String(req.body.status);
      if (!canTransition(job.status, to)) {
        return res.status(409).json({ error: 'invalid_transition', from: job.status, to });
      }
      data.status = to;
      // Agendar exige fecha (L: agendado(scheduledAt)); si no llega, se conserva la existente
      if (to === 'agendado' && req.body?.scheduledAt === undefined && !job.scheduledAt) {
        return res.status(400).json({ error: 'scheduled_at_required' });
      }
      if (to === 'pendiente_agendar') data.scheduledAt = null; // des-programar
    }
    if (req.body?.scheduledAt !== undefined) {
      const d = req.body.scheduledAt ? new Date(String(req.body.scheduledAt)) : null;
      if (d && isNaN(d.getTime())) return res.status(400).json({ error: 'invalid_date' });
      data.scheduledAt = d;
    }
    if (req.body?.notes !== undefined) data.notes = String(req.body.notes || '').slice(0, 2000) || null;
    // ── SCRUM-317 (G2) · el pro pone NOMBRE al Trabajo ──────────────────────────────────
    //
    // `titulo` existía en el modelo desde SCRUM-10 y NINGUNA ruta lo escribía: se rellenaba solo
    // al crear el Job y se quedaba así para siempre (medido en SCRUM-309 §4). Abrirlo aquí es
    // todo lo que hacía falta — cero cambios de schema, que es el único freno duro del proyecto.
    //
    // NO es admin-only, y es deliberado: el nombre del Trabajo es una etiqueta operativa, no una
    // bandera fiscal ni de dinero. Un técnico que está en la obra es quien mejor sabe si esto es
    // «Reforma baño» o «Avería cocina». Las que sí son admin-only siguen donde estaban
    // (`ADMIN_ONLY_JOB_FIELDS`: tipoOperacion, assignedUserId, cerrar).
    //
    // Vacío → `null`, no cadena vacía: así «sin nombre» es UN solo estado y la pantalla no tiene
    // que distinguir `''` de `null` para decidir si pinta el separador.
    if (req.body?.titulo !== undefined) {
      data.titulo = String(req.body.titulo || '').trim().slice(0, 120) || null;
    }
    // ── SCRUM-424 (G3) · el pro escribe la DIRECCIÓN DE LA OBRA ──────────────────────────
    //
    // Misma puerta que abrió SCRUM-317 para `titulo`, por el mismo motivo y con el mismo coste:
    // el campo existe en el modelo desde SCRUM-10 y **ninguna ruta lo escribía**, así que el
    // bloque DÓNDE del rail —con su enlace a mapa, lo que ningún facturador tiene— estaba
    // construido y era INALCANZABLE. Abrirlo aquí es todo lo que hacía falta: cero schema.
    //
    // NO es admin-only, igual que `titulo`: adónde se va a trabajar es un dato operativo, no una
    // bandera fiscal ni de dinero, y el técnico que está en la obra es quien mejor lo sabe.
    //
    // 🔴 SALVO QUE ROMPA UNA FIRMA YA EMITIDA (regla 29). Ver `jobDireccion.ts`: los sobres v:1
    // calculan su `obra` desde `Job.direccion` Y LA LEEN EN VIVO al verificar, así que escribirla
    // hoy dejaría sin verificar un albarán firmado que nadie ha tocado. Se comprueba SOLO cuando
    // el valor CAMBIA de verdad —reenviar el mismo no toca nada y no merece una consulta— y se
    // corta ANTES del `update`, no después.
    if (req.body?.direccion !== undefined) {
      const nueva = normalizarJobDireccion(req.body.direccion);
      if (nueva !== (job.direccion ?? null)) {
        const albaranes = await prisma.albaran.findMany({
          where: { jobId: id, merchantId: req.merchantId! }, // regla 2: siempre por merchant
          select: { numero: true, evidenciaFirma: true },
        });
        const atados = albaranesConFirmaQueDependeDelTrabajo(albaranes);
        if (atados.length) {
          return res.status(409).json({
            error: ERROR_DIRECCION_SELLADA,
            message: MSG_DIRECCION_SELLADA,
            albaranes: atados,
          });
        }
        data.direccion = nueva;
      }
    }
    if (req.body?.assignedUserId !== undefined) {
      const uid = req.body.assignedUserId === null ? null : Number(req.body.assignedUserId);
      if (uid !== null) {
        const member = await prisma.teamMember.findFirst({ where: { id: uid, merchantId: req.merchantId } });
        if (!member) return res.status(400).json({ error: 'invalid_assignee' });
      }
      data.assignedUserId = uid;
    }
    // SCRUM-66 (TRABAJO-4): tipo de operación fiscal. Enum CERRADO (validación estricta);
    // editable siempre mientras el Job esté abierto (el candado real es SCRUM-17). Solo se
    // audita el CAMBIO real (no un PATCH que reenvía el mismo valor).
    let tipoOperacionElegido: string | null = null;
    if (req.body?.tipoOperacion !== undefined) {
      const t = String(req.body.tipoOperacion);
      if (!(JOB_TIPOS_OPERACION as readonly string[]).includes(t)) {
        return res.status(400).json({ error: 'invalid_tipo_operacion' });
      }
      if (t !== job.tipoOperacion) {
        data.tipoOperacion = t;
        tipoOperacionElegido = t;
      }
    }

    const updated = await prisma.job.update({ where: { id }, data });
    // SCRUM-66: traza de que la decisión fiscal la tomó el usuario (caveat del ticket).
    // teamMemberId = quien edita (null = propietario/admin). Fire-and-forget como el resto.
    if (tipoOperacionElegido) {
      recordAudit({
        merchantId: req.merchantId,
        teamMemberId: req.teamMemberId ?? null,
        action: 'tipo_operacion_elegido',
        entityType: 'job',
        entityId: id,
        meta: { tipoOperacion: tipoOperacionElegido },
      });
    }
    return res.json(await serializeJob(updated));
  } catch (err: any) {
    console.error('[PATCH /admin/jobs/:id]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /admin/jobs/:id/ics — "Añadir a mi calendario" (spec: .ics, NO OAuth)
router.get('/:id/ics', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });
    if (!job.scheduledAt) return res.status(409).json({ error: 'not_scheduled' });

    const s = await serializeJob(job);
    const dt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const start = new Date(job.scheduledAt);
    const end = new Date(start.getTime() + 2 * 3600_000); // bloque de 2 h por defecto
    const summary = `Trabajo: ${s.customer?.name || 'Cliente'}${s.quote ? ` · Presupuesto #${s.quote.number}` : ''}`;
    const escText = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YaQu//Jobs//ES',
      'BEGIN:VEVENT',
      `UID:job-${job.id}@yaqu.app`,
      `DTSTAMP:${dt(new Date())}`,
      `DTSTART:${dt(start)}`,
      `DTEND:${dt(end)}`,
      `SUMMARY:${escText(summary)}`,
      ...(job.notes ? [`DESCRIPTION:${escText(job.notes)}`] : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="trabajo-${job.id}.ics"`);
    return res.send(ics);
  } catch (err: any) {
    console.error('[GET /admin/jobs/:id/ics]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/jobs/:id/albaranes — SCRUM-14: crea un albarán en borrador colgando
// del Trabajo (un albarán por visita/entrega; el Trabajo acumula N). El número
// ALB-YYYY-NNN se reserva DENTRO de la transacción del create (sin huecos).
router.post('/:id/albaranes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });

    // SCRUM-257 · UN ALBARÁN NACE DE UN PRESUPUESTO (decisión 1 del fundador, 2-ago-2026).
    //
    // El guard formaliza un invariante que YA se cumple de facto: la única vía de creación de
    // `Job` en todo `src/` es `job.service.ts` al aceptar un presupuesto, y siempre fija
    // `quoteId`. No hay endpoint de trabajo manual, así que hoy no rompe ningún camino
    // alcanzable — lo que hace es cerrar la puerta antes de que alguien la abra sin mirar.
    //
    // Efecto lateral consciente y aceptado en el ticket: cierra el «trabajo manual» futuro que
    // `Job.quoteId` nullable dejaba preparado. Es coherente con la decisión 1, no un descuido.
    //
    // El `message` va porque sin él el dashboard enseñaría el código crudo — `apiRequest` cae al
    // identificador cuando no hay texto, que es el defecto que cerró SCRUM-275 en /login.html.
    if (!job.quoteId) {
      return res.status(409).json({
        error: 'job_without_quote',
        message: 'Este trabajo no tiene presupuesto; no se puede crear un albarán.',
      });
    }

    // SCRUM-65: modo de valoración al crear (default SIN_VALORAR = comportamiento de siempre).
    let modoValoracion: AlbaranModoValoracion = 'SIN_VALORAR';
    if (req.body?.modoValoracion !== undefined) {
      const m = String(req.body.modoValoracion);
      if (!ALBARAN_MODOS_VALORACION.includes(m as AlbaranModoValoracion)) {
        return res.status(400).json({ error: 'modo_valoracion_invalido' });
      }
      modoValoracion = m as AlbaranModoValoracion;
    }

    // Líneas iniciales opcionales; si llegan, se validan contra el modo (condición 4 del OK + SCRUM-65)
    let lineas: any[] = [];
    if (req.body?.lineas !== undefined) {
      // SCRUM-367: el rango de `quoteLineIndex` se valida contra el presupuesto REAL, no contra
      // lo que diga el cliente. Un enlace roto es peor que ninguno: C6 se lo creería.
      const nLineasQuote = await contarLineasDePresupuesto(job.id, req.merchantId!);
      const v = validarLineas(req.body.lineas, modoValoracion, nLineasQuote);
      if (!v.ok) return res.status(400).json({ error: 'lineas_invalidas', message: v.error });
      lineas = v.lineas;
    }
    const notas = req.body?.notas !== undefined ? String(req.body.notas || '').slice(0, 2000) || null : null;

    // SCRUM-424 · la fecha de entrega, con el MISMO criterio que el PATCH: admite vaciarse
    // (undefined o '' -> null, el documento puede no tenerla) y una ilegible NO se guarda como
    // hoy en silencio: se rechaza. Inventar una fecha de entrega es el defecto de SCRUM-397.
    let fechaEntregaAlCrear: Date | null = null;
    if (req.body?.fechaEntrega !== undefined && String(req.body.fechaEntrega ?? '').trim() !== '') {
      const d = new Date(String(req.body.fechaEntrega).trim());
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'invalid_date' });
      fechaEntregaAlCrear = d;
    }

    // ── SCRUM-358 (H3) · EL ALTA, IDEMPOTENTE ────────────────────────────────────────────
    //
    // La clave la acuña el CLIENTE al pulsar crear (una vez, y se persiste con el elemento de la
    // cola: si se acuñara otra vez al reintentar no habría idempotencia ninguna). Aquí solo se
    // valida y se pregunta al constraint. El porqué de cada decisión, en `albaranIdempotencia.ts`.
    const claveNorm = normalizarClaveIdempotencia(req.body?.claveIdempotencia);
    if (!claveNorm.ok) return res.status(400).json({ error: claveNorm.error, message: claveNorm.message });
    const clave = claveNorm.clave;

    const contenido = { jobId: job.id, modoValoracion, lineas, notas };
    let repetida = false;

    const albaran = await prisma.$transaction(async (tx) => {
      // 🔴 EL CERROJO SE TOMA ANTES DE MIRAR LA CLAVE. Es el mismo de la serie y la misma sección
      // crítica: si la comprobación viviera fuera, dos reintentos simultáneos pasarían los dos el
      // «no la he visto» y se llevarían DOS números.
      await tomarCerrojoDeSerie(tx, req.merchantId!);

      if (clave) {
        // La pregunta al CONSTRAINT, por el nombre que Prisma le da al índice: si el índice
        // cambiara de forma, esto no compilaría. No se captura el `P2002` — una sentencia fallida
        // aborta la transacción entera (ver el módulo).
        const yaExiste = await tx.albaran.findUnique({
          where: { merchantId_claveIdempotencia: { merchantId: req.merchantId!, claveIdempotencia: clave } },
        });
        if (yaExiste) {
          const cmp = compararAlta(
            { jobId: yaExiste.jobId, modoValoracion: yaExiste.modoValoracion, lineas: yaExiste.lineas, notas: yaExiste.notas },
            contenido,
          );
          if (!cmp.mismo) throw new ClaveIdempotenciaReutilizadaError(clave, yaExiste.numero, cmp.diferencias);
          // 🔴 SE DEVUELVE EL ORIGINAL Y **NO SE RESERVA NÚMERO**. Reservarlo aquí lo dejaría
          // consumido y sin documento: un hueco en la serie abierto por la propia idempotencia.
          repetida = true;
          return yaExiste;
        }
      }

      const numero = await allocateAlbaranNumber(tx, req.merchantId!);
      return tx.albaran.create({
        data: {
          merchantId: req.merchantId!,
          jobId: job.id,
          numero,
          modoValoracion,
          lineas,
          notas,
          // ── SCRUM-424 · LO QUE SE ESCRIBE AL CREAR SE PERDÍA EN SILENCIO ──────────────────
          //
          // El PATCH guarda `lugarEntrega` y `fechaEntrega` (albaranes.routes.ts:474-486) y este
          // create NO los escribía: **cero apariciones**. El campo está pintado, con su rótulo
          // aprobado, y lo que el profesional teclea al crear no llegaba a la fila.
          //
          // 🔴 Y NO ES «UN CAMPO MÁS»: `lugarEntrega` entra en el HASH DEL SOBRE v:2. Un albarán
          // creado y firmado sin él queda **SELLADO** sin él, y sellado no se edita (regla 29). No
          // es un dato que se pueda añadir después.
          //
          // Se lee IGUAL que en el PATCH —mismo helper, mismas reglas— en vez de inventar una
          // segunda forma: `normalizarLugarEntrega` (vacío → NULL, **nunca** el domicilio fiscal).
          // Dos formas de leer el mismo campo acaban divergiendo.
          lugarEntrega: normalizarLugarEntrega(req.body?.lugarEntrega),
          fechaEntrega: fechaEntregaAlCrear,
          claveIdempotencia: clave,
        },
      });
    });

    // 🔴 «CON CLAVE» Y «SIN CLAVE» NO PUEDEN DAR LA MISMA SALIDA, y por eso la respuesta lo dice.
    //
    // Un alta sin clave NO falla —los clientes de hoy no la mandan y los albaranes históricos no
    // la tienen— pero **tampoco puede pasar en silencio**: si el día de mañana la cola dejara de
    // enviarla por un fallo suyo, todo seguiría en verde y la idempotencia estaría apagada sin
    // que nadie lo notara. `idempotencia` es lo que distingue las tres situaciones.
    //
    // Y la REPETICIÓN devuelve **200, no 201**: se está entregando un albarán que ya existía, no
    // creando uno. Tampoco un 409 —eso le diría al profesional que salió mal algo que salió
    // bien—; el cuerpo es el albarán original, que es lo que la cola necesita para cerrar su
    // elemento.
    const idempotencia = !clave ? 'no_solicitada' : repetida ? 'repetida' : 'aplicada';
    return res.status(repetida ? 200 : 201).json({ ...serializeAlbaran(albaran), idempotencia });
  } catch (err: any) {
    // SCRUM-358: misma clave con contenido DISTINTO. No es un fallo del servidor: es que la
    // etiqueta está puesta a dos cosas, y hay que decirlo con los dos documentos delante.
    if (err instanceof ClaveIdempotenciaReutilizadaError) {
      return res.status(409).json({
        error: ERROR_CLAVE_REUTILIZADA,
        // El número del original va DENTRO del texto, no solo en el campo de al lado: el
        // profesional lee el mensaje, no el JSON (asesor, 11-ago-2026).
        message: msgClaveReutilizada(err.numeroOriginal),
        numeroOriginal: err.numeroOriginal,
        diferencias: err.diferencias,
      });
    }
    console.error('[POST /admin/jobs/:id/albaranes]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/jobs/:id/collect-rest — A13.3: EL momento de dinero.
// terminado + tramo pendiente → genera la factura del resto (misma maquinaria
// getNextBillingStage del accept) y envía payment_request. V2: SIEMPRE acción
// del pro; jamás automático.
// SCRUM-55 (absorbe SCRUM-54, D2): emitir factura + payment_request es dinero →
// admin. Era el objetivo ORIGINAL de SCRUM-54, cuyo fix acabó por error solo en
// consolidar-albaranes; esta se quedó abierta. Aquí se cierra con evidencia.
router.post('/:id/collect-rest', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });
    if (job.status !== 'terminado') {
      return res.status(409).json({ error: 'job_not_finished', message: 'Marca el trabajo como terminado para cobrar el resto.' });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SCRUM-195 (rebanada 2) · AQUÍ ESTABA LA TRAMPA, y merece leerse entera.
    //
    // Antes: `if (!job.quoteId) return 409 job_without_quote`, y luego el plan del quote
    // apuntado por `job.quoteId`. Con 1:N **ese guard NO salta**, porque `job.quoteId` sigue
    // apuntando al original. Así que la ruta cobraba el resto del ORIGINAL e ignoraba el
    // adicional: **fallaba de menos, callando**.
    //
    // Y el caso peor no era ése. Con el original YA cobrado entero y un adicional pendiente,
    // esta ruta devolvía `nothing_pending`: el pro no podía cobrar lo que le deben, y el
    // mensaje decía que no quedaba nada. Dinero real, con la puerta cerrada por un guard que
    // preguntaba por el objeto equivocado.
    //
    // Ahora se pregunta por el CONJUNTO. El 409 de «sin presupuesto» solo procede si el
    // Trabajo no tiene NINGUNO — que es lo que ese error siempre quiso decir.
    const quotesConPlan = await prisma.quote.findMany({
      where: {
        merchantId: req.merchantId, // regla 2
        OR: [{ jobId: job.id }, ...(job.quoteId != null ? [{ id: job.quoteId }] : [])],
      },
      include: { Invoice: { select: { id: true } } },
    });
    if (quotesConPlan.length === 0) return res.status(409).json({ error: 'job_without_quote' });

    // ORIGINAL primero, adicionales después por id: el orden es determinista a propósito —
    // «cobrar el resto» tiene que emitir siempre el mismo tramo si se pulsa dos veces.
    const conPendiente = primeroConTramoPendiente(quotesConPlan, job.quoteId, resolveBillingPlan);
    const ordenados = [
      ...quotesConPlan.filter((q) => q.id === job.quoteId),
      ...quotesConPlan.filter((q) => q.id !== job.quoteId).sort((a, b) => a.id - b.id),
    ];

    // Sin ninguno pendiente, el motivo se explica con el plan del ORIGINAL, que es el que el
    // pro reconoce (`no_billing_plan` vs `nothing_pending`, SCRUM-151).
    const quote = conPendiente ?? ordenados[0];
    const plan = resolveBillingPlan(quote); // SCRUM-27: custom o preset
    const emitted = (quote.Invoice || []).length;
    if (!conPendiente) {
      // SCRUM-151: con plan VACÍO (MANUAL/SIN_CONDICIONES) el mensaje de siempre mentía — no es
      // que no QUEDE tramo, es que nunca los hubo. Ahora también cambia el CÓDIGO en ese caso
      // (`no_billing_plan`), porque es otra condición; el de "ya se cobró todo" sigue siendo
      // `nothing_pending`, que es el de esta ruta desde siempre.
      //
      // ⚠️ `motivoSinTramo` devuelve {error, message}: aquí se ESPARCE. Pasarlo como
      // `message: motivoSinTramo(plan)` metía el objeto entero dentro del mensaje, y TypeScript
      // no lo veía porque el cuerpo del JSON es `any`.
      return res.status(409).json(motivoSinTramo(plan, 'nothing_pending'));
    }
    const stage = plan[emitted];
    const isCustomPlan = Array.isArray((quote as any).customBillingPlan) && (quote as any).customBillingPlan.length > 0;
    // SCRUM-141: líneas del tramo primero, importe DERIVADO de ellas (el total es consecuencia de
    // las líneas). Antes venía de `distributeStageAmounts` con las líneas escaladas aparte: el
    // desfase de redondeo acababa sellado en la huella VeriFactu. Ver invoiceLines.service.ts.
    const quoteLines = Array.isArray(quote.lines) ? (quote.lines as any[]) : [];
    const scaledLines = stageLinesReconciled(
      quoteLines, plan, stage.index, distributeStageAmounts(quote.total, plan)[stage.index],
    );
    const amount = grossOfLines(scaledLines);

    // SCRUM-246 · ANTES de pedir número. Si no hay nada que cobrar, no se emite y la serie
    // ni se entera: comprobarlo DESPUÉS obligaría a modificar una factura ya numerada o a
    // deshacerla, y deshacer es lo que crea el hueco que hay que justificar ante Hacienda.
    exigirLineasFacturables(scaledLines);

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(tx, quote.merchantId, {
        camino: 'C2', actor: actorDeRequest(req),
      });
      return tx.invoice.create({
        data: {
          merchantId: quote.merchantId,
          customerId: quote.customerId,
          quoteId: quote.id,
          number: invoiceNumber,
          type: isReceiptNumber(invoiceNumber) ? 'JUST' : 'F1', // V0-0 (regla 26)
          total: amount.toFixed(2),
          stageLabel: isCustomPlan ? stage.label : null, // SCRUM-27: etiqueta congelada (solo custom)
          currency: quote.currency,
          lines: scaledLines.length > 0 ? scaledLines : undefined,
          pdfUrl: 'PENDING_PDF',
          qrData: 'PENDING_QR',
          registerId: null,
        },
      });
    });

    // Enviar el enlace de cobro (payment_request / ventana-first A5.5)
    // ── SCRUM-206b · SELLAR AL EMITIR. Este camino NO sellaba en absoluto.
    //
    // Medido: de los 7 sitios que crean factura, este y el de `jobs.routes.ts` eran los ÚNICOS
    // sin sellado. Y no los cubría nada: la creencia razonable era que el sellado perezoso de
    // `ensureInvoicePdf` los recogía al pedir el PDF, pero lo que sigue a la emisión aquí es
    // `sendInvoicePaymentRequest`, y ese servicio NO toca el PDF ni el sellado (solo importa
    // `ensureChargeReceiptToken`). Así que la factura quedaba emitida, numerada y FUERA de la
    // cadena hasta que alguien, algún día, abriese su PDF. Si nadie lo abría, nunca entraba.
    //
    // Se sella DESPUÉS del commit y con el cliente global: `applyVeriFactu` lanza si recibe uno
    // de transacción, porque sellar dentro de la tx de emisión bifurca la cadena (SCRUM-173/177).
    //
    // ⚠️ POR QUÉ AQUÍ «registrar y seguir» SÍ es correcto, y en `lib/invoicing.ts` no lo era:
    // allí la continuación ENTREGABA un documento sin huella. Aquí no sale ningún byte — la
    // factura queda existiendo y sin sellar, y el portón de SCRUM-206 garantiza que no produzca
    // documento hasta que se selle. El número NO se revierte (regla 29): revertir es lo que
    // crearía el hueco en la serie que habría que justificar ante Hacienda.
    //
    // El merchant no viene en la consulta de este camino: se piden los dos campos que
    // decide el portón, y nada más.
    // SCRUM-205 · punto único de sellado: después del commit y ANTES de pedir el documento.
    // Este camino NO sellaba por su cuenta — se apoyaba en el sellado PEREZOSO de
    // `ensureInvoicePdf`, que es justo lo que este ticket quita. Sin esta línea la factura se
    // queda `pendiente_de_sellado` y la petición de cobro sale sin PDF.
    //
    // Si el merchant no se pudiera leer, NO se sella y NO se inventa nada: la factura sigue
    // pendiente. Eso no queda mudo — el siguiente paso pide el PDF y ahí salta
    // `invoice_pendiente_de_sellado`. El fallo se ve; lo que no puede pasar es sellar a ciegas.
    const merchantFiscal = await prisma.merchant.findUnique({
      where: { id: quote.merchantId },
      select: { country: true, taxId: true },
    });
              // No sale ningún documento de aquí: lo impide el portón de SCRUM-206.
    // ⚠️ El sellado pasa a `sellarTrasEmision` (SCRUM-205, punto unico). El arreglo de
    // SCRUM-206b no se pierde: este camino SIGUE sellando, solo que por la puerta comun,
    // que ademas registra el fallo por dentro. La llamada suelta a applyVeriFactu se va.
    if (merchantFiscal) await sellarTrasEmision(invoice, merchantFiscal, prisma);

    const sent = await sendInvoicePaymentRequest(invoice.id).catch((e) => {
      console.error('[jobs] collect-rest send:', e?.message || e);
      return { ok: false as const, reason: 'whatsapp_send_failed' as const };
    });

    // SCRUM-126: la factura SÍ se creó (ok:true siempre) — el envío es un efecto
    // secundario con su propio resultado, en un subobjeto con el mismo vocabulario que
    // el resto de los 9 endpoints (antes era un string 'sent'/'failed' sin explicar por
    // qué había fallado si fallaba).
    const waReason: SendFailureReason =
      sent.reason && sent.reason in SEND_FAILURE_MESSAGES ? (sent.reason as SendFailureReason) : 'whatsapp_send_failed';
    return res.json({
      ok: true,
      invoiceId: invoice.id,
      number: invoice.number,
      amount: Number(invoice.total),
      currency: invoice.currency,
      whatsapp: sent.ok
        ? { sent: true }
        : { sent: false, error: waReason, message: SEND_FAILURE_MESSAGES[waReason] },
    });
  } catch (err: any) {
    console.error('[POST /admin/jobs/:id/collect-rest]', err?.message || err);
    // SCRUM-246: no hay nada que cobrar. No se ha emitido NI consumido número, así que el
    // profesional arregla el presupuesto y vuelve — la serie sigue intacta.
    if (esErrorSinLineas(err)) {
      return res.status(409).json({ error: ERROR_SIN_LINEAS, message: COPY_ADMIN_SIN_LINEAS });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/jobs/:id/consolidar-albaranes — SCRUM-17 (FISCAL-2): factura recapitulativa con
// ROTURA por mes natural (art. 13 RD 1619/2012). Selección de albaranes firmados + VALORADO +
// no facturados de ESTE Job → N facturas (una por mes). ZONA DE DINERO: admin only + gate por
// getEmissionMode (sin variante justificante) + transacción atómica con guard anti-doble-consolidación.
// NADA se activa a merchants reales (latente tras INVOICING_ES_ENABLED; regla 24).
// Rol: emitir factura es acción de dinero → solo admin/propietario, nunca el técnico (S1).
// SCRUM-55: era `if (req.userRole === 'tecnico')` inline — DENYLIST, y por tanto
// fail-OPEN: cualquier rol futuro que no fuera 'tecnico' habría pasado. requireRole
// es allowlist (exige === 'admin') y además la red fail-closed puede verlo.
router.post('/:id/consolidar-albaranes', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    const job = await prisma.job.findFirst({ where: { id, merchantId: req.merchantId } });
    if (!job) return res.status(404).json({ error: 'not_found' });

    // Gate de modo: la recapitulativa es documento FISCAL puro — NO hay variante justificante J-.
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      // getEmissionMode necesita id/email/country/flags (Parte P); defaultCurrency para la
      // factura; taxId para el sellado VeriFactu de SCRUM-173 (entra en la huella).
      select: { id: true, email: true, country: true, flags: true, defaultCurrency: true, taxId: true },
    });
    if (!merchant) return res.status(404).json({ error: 'not_found' });
    if (getEmissionMode(merchant) === 'receipt') {
      return res.status(409).json({ error: 'consolidacion_no_disponible', message: 'La factura recapitulativa no está disponible en este modo.' });
    }

    // Selección del body, SCOPEADA a este Job (V1: 1 Job = 1 cliente; regla 2 tenancy).
    const rawIds: any[] = Array.isArray(req.body?.albaranIds) ? req.body.albaranIds : [];
    const ids: number[] = Array.from(new Set<number>(rawIds.map((x) => Number(x)).filter((n) => Number.isInteger(n))));
    if (ids.length === 0) return res.status(400).json({ error: 'seleccion_vacia', message: 'Selecciona al menos un parte de trabajo firmado.' });

    const albaranes = await prisma.albaran.findMany({ where: { id: { in: ids }, merchantId: req.merchantId, jobId: id } });
    if (albaranes.length !== ids.length) {
      return res.status(404).json({ error: 'albaran_no_encontrado', message: 'Alguno de los partes seleccionados no existe en este Trabajo.' });
    }

    // SCRUM-170: quién tiene ya líneas facturadas por la vía PARCIAL. Sin esta consulta, un
    // albarán a medias (que NO lleva `invoiceId`) entraría entero en la recapitulativa y se
    // cobraría dos veces lo ya facturado.
    const conParcial = new Set(
      (await prisma.albaranLineaFacturada.findMany({
        where: { merchantId: req.merchantId, albaranId: { in: ids } },
        select: { albaranId: true },
        distinct: ['albaranId'],
      })).map((r) => r.albaranId),
    );

    // Forma que consume el dominio puro (customerId del Job — 1 Job = 1 cliente).
    const consolidables = albaranes.map((a) => ({
      id: a.id, numero: a.numero, fecha: a.fecha, estado: a.estado,
      modoValoracion: a.modoValoracion, invoiceId: a.invoiceId, customerId: job.customerId,
      facturadoParcial: conParcial.has(a.id),
    }));
    const val = validarConsolidacion(consolidables, { tipoOperacion: job.tipoOperacion, customerId: job.customerId });
    if (!val.ok) {
      const status = (val.error === 'albaran_ya_facturado' || val.error === 'albaran_facturado_parcial' || val.error === 'consolidacion_no_aplica') ? 409 : 400;
      return res.status(status).json({ error: val.error, message: val.message });
    }

    const grupos = groupByRotura(consolidables);

    // SCRUM-171a: la emisión vive en `recapitulativa.service` y la comparten esta vía (ámbito
    // Job) y la de ámbito CLIENTE. Antes estaba escrita aquí dentro; copiarla para la segunda
    // vía habría dejado dos sitios que numeran, agrupan y sellan «casi igual», y el día que uno
    // se arregle el otro se queda con el fallo. La rotura del art. 13, la transacción única, el
    // guard anti-doble y el sellado fuera del commit son los mismos, byte a byte.
    const { facturas: created, sinSellar } = await emitirRecapitulativas(prisma, {
      merchantId: req.merchantId!,
      customerId: job.customerId,
      currency: merchant.defaultCurrency || 'EUR',
      taxId: merchant.taxId,
      actor: actorDeRequest(req),
      grupos: grupos.map((g) => ({
        mesLabel: g.mesLabel,
        albaranes: g.albaranes.map((a) => {
          const full = albaranes.find((x) => x.id === a.id)!;
          return { id: a.id, numero: a.numero, fecha: a.fecha, lineas: full.lineas };
        }),
      })),
    });

      // SCRUM-206 · antes esto respondía `ok: true` con `sinSellar` DENTRO. Un llamador que
      // mira `ok` —o el status 201— veía éxito, y el fallo era un campo que podía ignorar sin
      // enterarse: eso también es fail-open, solo que en la respuesta en vez de en el PDF. El
      // front, medido, no leía `sinSellar` en ningún sitio.
      //
      // El portón es por DOCUMENTO, no por tanda: las que se sellaron bien siguen su curso y no
      // se deshace nada (regla 29). Lo que cambia es que el fallo llega como fallo — 409, que
      // `apiRequest` convierte en excepción con `message` humano y `err.code`.
    if (sinSellar.length) {
      return res.status(409).json({
        ok: false, error: 'sellado_incompleto', message: 'Se emitieron las facturas, pero falló el registro VeriFactu de alguna. Revísalo antes de entregarlas.',
        facturas: created, sinSellar,
      });
    }

    return res.status(201).json({ ok: true, facturas: created });
  } catch (err: any) {
    if (err?.message === 'consolidacion_concurrente') {
      return res.status(409).json({ error: 'consolidacion_concurrente', message: 'Alguno de los partes se facturó a la vez desde otra sesión. Vuelve a intentarlo.' });
    }
    if (err?.message === 'consolidacion_no_disponible') {
      return res.status(409).json({ error: 'consolidacion_no_disponible', message: 'La factura recapitulativa no está disponible en este modo.' });
    }
    console.error('[POST /admin/jobs/:id/consolidar-albaranes]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

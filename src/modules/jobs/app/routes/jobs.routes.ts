// src/modules/jobs/app/routes/jobs.routes.ts — A13.2/A13.3 (EXT3, JOB-1)
// Lista "Esta semana" + FSM + .ics por trabajo + "Cobrar el resto" (V2: el
// resto JAMÁS se cobra solo — SIEMPRE acción del pro). Merchant-scoped (regla 2).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { requireRole } from '../../../../core/http/authMiddleware'; // SCRUM-55 (S1: dinero = admin)
import { seesOnlyOwnJobs, seesAllJobs, adminOnlyJobField } from '../../../../core/http/roleCapabilities'; // SCRUM-147 / SCRUM-164
import { canTransition, estadoCobroFor, JOB_TIPOS_OPERACION } from '../../domain/job.service';
import { recordAudit, actorDeRequest, sobreFiscal, flagsFiscalesDe } from '../../../system/audit.service'; // SCRUM-66 · SCRUM-207 · SCRUM-206b
import { resolveBillingPlan, distributeStageAmounts, motivoSinTramo } from '../../../quotes/domain/billingPlan';
import { buildBillingPlanView } from '../../../quotes/domain/billingPlanView'; // SCRUM-34
import { sendInvoicePaymentRequest } from '../../../billing/domain/invoiceWhatsApp.service';
import { allocateInvoiceNumber, isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service'; // SCRUM-173
import { allocateAlbaranNumber } from '../../domain/albaranNumber.service';
// SCRUM-170: derivación del estado de cobro (parcial) — nunca un flag almacenado.
import { estadoCobroAlbaran, facturadoPorLinea, pendientePorLinea } from '../../domain/albaranFacturacion';
import { emitirRecapitulativas } from '../../domain/recapitulativa.service'; // SCRUM-171a: emisión compartida
import {
  ALBARAN_MODOS_VALORACION,
  serializeAlbaran,
  validarLineas,
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

  const [quotes, customers, operarios] = await Promise.all([
    quoteIds.length
      ? prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: QUOTE_SELECT })
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

  return {
    quotes: new Map(quotes.map((q: any) => [q.id, q])),
    customers: new Map(customers.map((c: any) => [c.id, c])),
    operarios: new Map(operarios.map((o: any) => [operarioKey(o.merchantId, o.id), { id: o.id, name: o.name }])),
  };
}

async function serializeJob(job: any, refs?: JobRefs) {
  // SCRUM-58: con `refs` (lista) se lee del lote; sin él (detalle, update) se consulta como
  // siempre. Mismos selects en ambas ramas — ver QUOTE_SELECT/CUSTOMER_SELECT.
  const quote = job.quoteId
    ? refs
      ? refs.quotes.get(job.quoteId) ?? null
      : await prisma.quote.findUnique({ where: { id: job.quoteId }, select: QUOTE_SELECT })
    : null;
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
    const plan = resolveBillingPlan(quote); // SCRUM-27: custom o preset (Pendiente/semáforo cuadran con el plan real)
    const emitted = (quote.Invoice || []).length;
    if (emitted < plan.length) {
      const pct = plan.slice(emitted).reduce((a, s) => a + s.percentage, 0);
      remaining = { amount: Math.round(Number(quote.total) * pct * 100) / 100, currency: quote.currency };
    }
    // SCRUM-34: siguiente tramo + pendientes por el MISMO conteo que collect-rest (plan[emitted]).
    planView = buildBillingPlanView(quote, emitted);
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
    titulo: job.titulo ?? `Presupuesto #${quote ? (quote.quoteNumber ?? quote.id) : job.id}${customer?.name ? ` · ${customer.name}` : ''}`,
    direccion: job.direccion ?? null,
    totalAceptado: job.totalAceptado != null ? Number(job.totalAceptado) : (quote ? Number(quote.total) : null),
    totalCobrado: Number(job.totalCobrado ?? 0),
    // SCRUM-13: semáforo de cobro derivado (SCRUM-11 lo pinta; aquí NO se hace UI).
    // totalCobrado lo materializa recalcJobCobradoForCharge en los webhooks de pago.
    estadoCobro: estadoCobroFor(
      Number(job.totalCobrado ?? 0),
      job.totalAceptado != null ? Number(job.totalAceptado) : (quote ? Number(quote.total) : 0),
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
  let customer: any = base.customer;
  if (customer && job.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: job.customerId }, select: { email: true } });
    customer = { ...customer, email: c?.email ?? null };
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
      estadoCobro: estadoCobroAlbaran(lineas, facturado, a.invoiceId != null),
      pendientes: pendientePorLinea(lineas, facturado),
    };
  });

  // invoices[] y charge SÍ dependen del quote (tramos/cobro): un Job sin quote no tiene → []/null.
  if (!job.quoteId) return { ...base, customer, invoices: [], charge: null, albaranes };

  const quote = await prisma.quote.findUnique({
    where: { id: job.quoteId },
    select: {
      charge: { select: { id: true, status: true, method: true, amount: true, currency: true } },
      Invoice: {
        select: {
          id: true, number: true, total: true, currency: true, createdAt: true,
          pdfUrl: true, type: true, status: true, paidAt: true, chargeId: true, stageLabel: true, // SCRUM-27
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // SCRUM-85: payToken (Charge.receiptToken) AÑADIDO para el link público /pay/invoice/:token
  // (IDOR/RGPD — ya no acepta el id numérico). chargeId se CONSERVA: lo sigue usando la
  // acción autenticada /admin/charges/:chargeId/confirm-bizum (no es superficie pública).
  const invoices = await Promise.all((quote?.Invoice ?? []).map(async (inv) => ({
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

  return { ...base, customer, invoices, charge, albaranes };
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
    const where: { merchantId: number; operarioId?: number | null } = { merchantId: req.merchantId };
    const restringido = seesOnlyOwnJobs(req.userRole);
    if (restringido) where.operarioId = req.teamMemberId;

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
      const v = validarLineas(req.body.lineas, modoValoracion);
      if (!v.ok) return res.status(400).json({ error: 'lineas_invalidas', message: v.error });
      lineas = v.lineas;
    }
    const notas = req.body?.notas !== undefined ? String(req.body.notas || '').slice(0, 2000) || null : null;

    const albaran = await prisma.$transaction(async (tx) => {
      const numero = await allocateAlbaranNumber(tx, req.merchantId!);
      return tx.albaran.create({
        data: {
          merchantId: req.merchantId!,
          jobId: job.id,
          numero,
          modoValoracion,
          lineas,
          notas,
        },
      });
    });
    return res.status(201).json(serializeAlbaran(albaran));
  } catch (err: any) {
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
    if (!job.quoteId) return res.status(409).json({ error: 'job_without_quote' });

    const quote = await prisma.quote.findFirst({
      where: { id: job.quoteId, merchantId: req.merchantId },
      include: { Invoice: { select: { id: true } } },
    });
    if (!quote) return res.status(404).json({ error: 'quote_not_found' });

    const plan = resolveBillingPlan(quote); // SCRUM-27: custom o preset
    const emitted = (quote.Invoice || []).length;
    if (emitted >= plan.length) {
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
    const merchantFiscal = await prisma.merchant.findUnique({
      where: { id: quote.merchantId },
      select: { country: true, taxId: true },
    });
    if (merchantFiscal && debeEstarEnLaCadena(invoice.number, merchantFiscal)) {
      try {
        await applyVeriFactu(invoice, merchantFiscal.taxId!, prisma);
      } catch (e: any) {
        console.error('[jobs_collect_rest_C2] sellado VeriFactu falló en ' + invoice.number + ':', e?.message || e);
        recordAudit({
          merchantId: invoice.merchantId,
          action: 'sellado_fallido', entityType: 'invoice', entityId: invoice.id,
          meta: sobreFiscal({
            actor: { tipo: 'sistema', ref: 'jobs_collect_rest_C2' },
            flagsFiscales: flagsFiscalesDe(merchantFiscal as any),
            payload: {
              numero: invoice.number,
              errorMensaje: String(e?.message ?? e).slice(0, 300),
              puntoDeFallo: 'jobs_collect_rest_C2',
              // No sale ningún documento de aquí: lo impide el portón de SCRUM-206.
              pdfEntregadoIgual: false,
            },
          }),
        });
      }
    }

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

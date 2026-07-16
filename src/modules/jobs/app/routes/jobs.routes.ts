// src/modules/jobs/app/routes/jobs.routes.ts — A13.2/A13.3 (EXT3, JOB-1)
// Lista "Esta semana" + FSM + .ics por trabajo + "Cobrar el resto" (V2: el
// resto JAMÁS se cobra solo — SIEMPRE acción del pro). Merchant-scoped (regla 2).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { canTransition, estadoCobroFor } from '../../domain/job.service';
import { resolveBillingPlan, distributeStageAmounts } from '../../../quotes/domain/billingPlan';
import { buildBillingPlanView } from '../../../quotes/domain/billingPlanView'; // SCRUM-34
import { sendInvoicePaymentRequest } from '../../../billing/domain/invoiceWhatsApp.service';
import { allocateInvoiceNumber, isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { allocateAlbaranNumber } from '../../domain/albaranNumber.service';
import { serializeAlbaran, validarLineas } from '../../domain/albaran.service';

const router = Router();

const jobInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  // quote via relation? Job no tiene relación Prisma declarada — se resuelve a mano
} as const;

async function serializeJob(job: any) {
  const quote = job.quoteId
    ? await prisma.quote.findUnique({
        where: { id: job.quoteId },
        select: {
          id: true, quoteNumber: true, total: true, currency: true,
          paymentTerms: true, customBillingPlan: true, // SCRUM-27: para resolver el plan efectivo
          Invoice: { select: { id: true, status: true, total: true } },
        },
      })
    : null;
  const customer = await prisma.customer.findUnique({
    where: { id: job.customerId },
    select: { id: true, name: true, phone: true },
  });
  // SCRUM-22 (read-path): autoría del operario. Resuelve el TeamMember de la Parte S1
  // por operarioId, SCOPEADO al merchant del Job (regla 2, tenancy). null = propietario.
  const operario = job.operarioId
    ? await prisma.teamMember.findFirst({
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
// status/paidAt/chargeId (semáforo por tramo + link /pay/invoice/:chargeId).
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
  const albaranes = (
    await prisma.albaran.findMany({
      where: { merchantId: job.merchantId, jobId: job.id },
      orderBy: { createdAt: 'asc' },
    })
  ).map((a) => ({ ...serializeAlbaran(a), operario: base.operario }));

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

  const invoices = (quote?.Invoice ?? []).map((inv) => ({
    id: inv.id,
    number: inv.number,               // número visible de la factura/justificante
    total: Number(inv.total),         // Decimal(12,2) → Number (como serializeJob)
    currency: inv.currency,
    createdAt: inv.createdAt,
    pdfUrl: inv.pdfUrl,
    type: inv.type,                   // F1 | JUST | R1 (para el copy del timeline)
    status: inv.status,               // ← GAP CERRADO (semáforo por tramo)
    paidAt: inv.paidAt,               // ← GAP CERRADO
    chargeId: inv.chargeId,           // ← GAP CERRADO (link /pay/invoice/:chargeId)
    stageLabel: inv.stageLabel,       // SCRUM-27: etiqueta del tramo (custom); null en presets
  }));

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
    const jobs = await prisma.job.findMany({
      where: { merchantId: req.merchantId },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'desc' }],
      take: 200,
    });
    const out = [];
    for (const j of jobs) out.push(await serializeJob(j));
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

    const updated = await prisma.job.update({ where: { id }, data });
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

    // Líneas iniciales opcionales; si llegan, se validan (condición 4 del OK)
    let lineas: any[] = [];
    if (req.body?.lineas !== undefined) {
      const v = validarLineas(req.body.lineas);
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
router.post('/:id/collect-rest', async (req, res) => {
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
      return res.status(409).json({ error: 'nothing_pending', message: 'No queda ningún tramo por cobrar de este presupuesto.' });
    }
    const stage = plan[emitted];
    // SCRUM-27+32: importe del tramo del plan resuelto, reparto exacto (último = resto, céntimos enteros).
    const amount = distributeStageAmounts(quote.total, plan)[stage.index];
    const isCustomPlan = Array.isArray((quote as any).customBillingPlan) && (quote as any).customBillingPlan.length > 0;
    // TODO(SCRUM-16/17): reparto fino línea-a-línea del último tramo (≤1 cént. vs Invoice.total de SCRUM-32).
    const quoteLines = Array.isArray(quote.lines) ? (quote.lines as any[]) : [];
    const scaledLines = stage.percentage < 1
      ? quoteLines.map((l: any) => ({ ...l, price: Number(l.price) * stage.percentage }))
      : quoteLines;

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(tx, quote.merchantId);
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
    const sent = await sendInvoicePaymentRequest(invoice.id).catch((e) => {
      console.error('[jobs] collect-rest send:', e?.message || e);
      return { ok: false as const, reason: 'send_failed' };
    });

    return res.json({
      ok: true,
      invoiceId: invoice.id,
      number: invoice.number,
      amount: Number(invoice.total),
      currency: invoice.currency,
      whatsapp: sent.ok ? 'sent' : 'failed',
    });
  } catch (err: any) {
    console.error('[POST /admin/jobs/:id/collect-rest]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

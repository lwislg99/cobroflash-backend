// src/modules/quotes/app/routes/quotes.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import {
  CreateQuoteSchema,
  AcceptQuoteSchema,
  RejectQuoteSchema,
  type QuoteTier,
} from '../../../../core/validation/schemas';
import { calcTotal, normalizePhone, parseToken } from '../../../../core/utils/utils';
import { rateLimit } from '../../../../core/http/rateLimit';

function calcTierTotal(lines: Array<{qty: number; price: number; tax?: number}>): number {
  return Math.round(lines.reduce((s, l) => s + l.qty * l.price * (1 + (l.tax ?? 0)), 0) * 100) / 100;
}
import { sendWhatsAppText } from '../../../../integrations/whatsapp';
import { notifyMerchantAlert } from '../../../../integrations/whatsappNotifications';
import { resolveBillingPlan, distributeStageAmounts, validateCustomBillingPlan } from '../../domain/billingPlan';
import { allocateQuoteNumber, displayQuoteNumber } from '../../domain/quoteNumber.service';
import { isQuoteExpired } from '../../domain/expire.service';
import { sendMerchantQuoteAcceptedEmail } from '../../../messaging/domain/merchantNotifications';
import { getSession } from '../../../auth/domain/auth.service';

// Lee el teamMemberId de la sesión (si hay cookie válida) para atribuir el creador.
async function getCreatorTeamMemberId(req: any): Promise<number | null> {
  try {
    const match = String(req.headers.cookie || '').match(/pf_session=([^;]+)/);
    if (!match) return null;
    const session = await getSession(decodeURIComponent(match[1]));
    return session?.teamMemberId ?? null;
  } catch {
    return null;
  }
}

import { generateQuotePdf } from '../../../../lib/pdf';
import { sendInvoicePaymentRequest } from '../../../billing/domain/invoiceWhatsApp.service';
import { recordCustomerEvent } from '../../../system/customerEvents.service';
import { allocateInvoiceNumber, isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { stageLinesReconciled, grossOfLines } from '../../../invoicing/domain/invoiceLines.service'; // SCRUM-141: el total se deriva de las líneas
import { ensureJobForQuote } from '../../../jobs/domain/job.service';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service'; // SCRUM-206b
import { debeEstarEnLaCadena } from '../../../invoicing/domain/portonDocumento'; // SCRUM-206b
import { recordAudit, sobreFiscal, flagsFiscalesDe } from '../../../system/audit.service'; // SCRUM-206b
import { sellarTrasEmision } from '../../../invoicing/domain/selladoEstado'; // SCRUM-205
import { exigirLineasFacturables, esErrorSinLineas, COPY_PUBLICO_SIN_LINEAS } from '../../../invoicing/domain/lineasFacturables'; // SCRUM-246


const router = Router();

// SCRUM-95: rate limit por IP como defensa EN PROFUNDIDAD además del token opaco
// (Quote.decisionToken) — el token ya cierra el IDOR; esto acota además la velocidad
// de fuerza bruta/abuso masivo. P1-SEC-6 lo introdujo cuando accept/reject aún
// resolvían por id crudo; ahora las tres rutas de decisión (accept/reject/decision)
// lo comparten.
const decisionLimiter = rateLimit({ scope: 'quote_decision', max: 20, windowMs: 60_000 });

/**
 * POST /quote/create
 * Crea un presupuesto en estado DRAFT.
 */
router.post('/create', async (req, res) => {
  try {
    const body = CreateQuoteSchema.parse(req.body);
    const { merchant_id, customer_id, currency } = body;

    // P1-SEC-5: este endpoint estaba montado SOLO con requireActivePlan, que NO
    // autentica (sin sesión hace next()) y confiaba en el merchant_id del BODY →
    // permitía crear presupuestos SIN login y en la cuenta de OTRO merchant (con
    // aviso WhatsApp e incremento de numeración ajenos). Ahora exige requireAuth
    // (req.merchantId) y se fuerza que el merchant del body sea el de la sesión.
    if (req.merchantId == null || merchant_id !== req.merchantId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // Validar: se necesita lines O tiers (no los dos, no ninguno)
    if (!body.lines && !body.tiers) {
      return res.status(400).json({ error: 'validation_error', details: 'lines or tiers required' });
    }

    // SCRUM-27: si viene un plan de cobro personalizado, debe cuadrar (≥1 tramo,
    // etiquetas no vacías, % > 0, y suman 100% exacto). Mensaje es-ES digno.
    if (body.customBillingPlan != null) {
      const planCheck = validateCustomBillingPlan(body.customBillingPlan);
      if (!planCheck.ok) {
        return res.status(400).json({ error: 'invalid_billing_plan', message: planCheck.error });
      }
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: merchant_id } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    // Cliente SIEMPRE dentro del merchant autenticado (no adjuntar el cliente de otro).
    const customer = await prisma.customer.findFirst({ where: { id: customer_id, merchantId: req.merchantId } });
    if (!customer) return res.status(404).json({ error: 'customer_not_found' });

    // Calcular total: si hay tiers, usamos el "better" (o el de en medio)
    let totalNum: number;
    let tiersWithTotal: (QuoteTier & { total: number })[] | undefined;
    let canonicalLines: any[];

    if (body.tiers) {
      tiersWithTotal = body.tiers.map((t) => ({ ...t, total: calcTierTotal(t.lines) }));
      const betterTier = tiersWithTotal.find((t) => t.id === 'better') ?? tiersWithTotal[1];
      totalNum = betterTier.total;
      canonicalLines = betterTier.lines; // líneas del tier recomendado como referencia
    } else {
      canonicalLines = body.lines!;
      totalNum = calcTotal(canonicalLines);
    }

    // Atribuir el técnico que crea la cotización (null = propietario)
    const creatorTeamMemberId = await getCreatorTeamMemberId(req);

    // ENT-2: si un técnico crea una cotización por encima del umbral, requiere aprobación
    const threshold = merchant.approvalThreshold != null ? Number(merchant.approvalThreshold) : null;
    const needsApproval =
      creatorTeamMemberId != null && threshold != null && totalNum > threshold;
    const initialStatus = needsApproval ? 'pending_approval' : 'draft';

    // 1) Crear el presupuesto (A1.2: número por merchant asignado en la misma
    // transacción, para que un fallo en el create no queme el contador)
    const quote = await prisma.$transaction(async (tx) => {
      const quoteNumber = await allocateQuoteNumber(tx, merchant_id);
      return tx.quote.create({
        data: {
          merchantId: merchant_id,
          customerId: customer_id,
          quoteNumber,
          status: initialStatus,
          total: totalNum.toFixed(2),
          currency: currency.toUpperCase(),
          lines: canonicalLines,
          tiers: tiersWithTotal as any ?? undefined,
          paymentTerms: body.paymentTerms ?? null,
          customBillingPlan: body.customBillingPlan ?? undefined, // SCRUM-27: plan de tramos personalizado
          docFields: body.docFields ?? undefined, // A20.4: qué datos del cliente muestra el documento
          // A16.2: caducidad — default 30 días, editable al crear
          validUntil: body.validUntil ?? new Date(Date.now() + 30 * 86_400_000),
          teamMemberId: creatorTeamMemberId,
          createdVia: body.created_via ?? 'text', // V0-3: telemetría quote_created_via
          payMethods: body.payMethods ?? undefined, // A2.1: selector al crear
        },
      });
    });

    // Avisar al admin/propietario por WhatsApp si requiere aprobación
    if (needsApproval) {
      const adminPhone = normalizePhone(merchant.whatsappPhone);
      if (adminPhone) {
        sendWhatsAppText({
          to: adminPhone,
          merchantId: quote.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
          text: `📋 Nuevo presupuesto ${displayQuoteNumber(quote)} por ${totalNum.toFixed(2)} ${quote.currency} pendiente de tu aprobación antes de enviarlo al cliente. Revísalo en tu panel de YaQu.`,
        }).catch(() => {});
      }
    }

    // 2) Generar PDF
    try {
      const pdf = await generateQuotePdf({
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber, // A1.2
        merchant: {
          name: merchant.name, legalName: merchant.legalName,
          taxId: merchant.taxId, address: merchant.address,
          whatsappPhone: merchant.whatsappPhone,
          logoUrl: merchant.logoUrl,
        },
        customer: { name: customer.name, phone: customer.phone, email: customer.email, legalName: (customer as any).legalName, taxId: (customer as any).taxId }, // A20.4
        docFields: ((quote as any).docFields as any) ?? null, // A20.4
        currency: quote.currency,
        total: quote.total.toString(),
        lines: canonicalLines as any,
        tiers: tiersWithTotal,
        country: merchant.country,
      });

      await prisma.quote.update({
        where: { id: quote.id },
        data: { pdfUrl: pdf.publicUrlPath },
      });
    } catch (e) {
      console.error('Error generando PDF de presupuesto', e);
    }

    return res.status(201).json({
      id: quote.id,
      number: quote.quoteNumber, // A1.2: número visible (por merchant); el id queda para links/API
      status: quote.status,
      total: quote.total.toString(),
      currency: quote.currency,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /quote/create error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});


/**
 * POST /quote/:id/accept
 * Decisión del CLIENTE: acepta el presupuesto.
 * No crea cobros ni facturas, solo marca la decisión.
 */
router.post('/:token/accept', decisionLimiter, async (req, res) => {
  try {
    // SCRUM-95: token opaco (Quote.decisionToken), NUNCA el id autoincremental —
    // era la sexta puerta de la misma fuga (SCRUM-72/74/85/87/90). Token
    // ausente/malformado y token válido pero inexistente responden IGUAL (404
    // quote_not_found) para no distinguir "formato malo" de "no existe".
    const token = parseToken(req.params.token);

    const body = AcceptQuoteSchema.parse(req.body);

    const quote = token ? await prisma.quote.findUnique({
      where: { decisionToken: token },
      include: {
        merchant: { select: { id: true, email: true, name: true, notifyEmailOnQuoteAccepted: true } },
        customer: { select: { name: true } },
      },
    }) : null;

    if (!quote) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Idempotencia: si ya está aceptado devolvemos ok
    if (quote.status === 'accepted') {
      return res.json({
        ok: true,
        status: 'already_accepted',
        quote_id: quote.id,
      });
    }

    // Si ya estaba rechazado, no dejamos aceptarlo por esta vía
    if (quote.status === 'rejected') {
      return res.status(409).json({
        ok: false,
        error: 'already_rejected',
      });
    }

    const now = new Date();

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'accepted',
        acceptedAt: now,
        rejectedAt: null,
        decisionChannel: body.channel ?? 'whatsapp',
        decisionComment: body.comment ?? null,
        paymentTerms: body.paymentTerms ?? quote.paymentTerms,
        evidence: body.evidence ?? quote.evidence ?? {},
      },
    });

    // Email al merchant si tiene notificaciones de aceptación activadas
    if (quote.merchant?.notifyEmailOnQuoteAccepted && quote.merchant?.email) {
      sendMerchantQuoteAcceptedEmail({
        merchantEmail: quote.merchant.email,
        merchantName:  quote.merchant.name || 'Tu negocio',
        customerName:  quote.customer?.name || 'Cliente',
        quoteId: quote.quoteNumber ?? quote.id, // A1.2: solo display en el email
        total: Number(quote.total).toFixed(2),
        currency: quote.currency,
      }).catch(() => {});
    }

    return res.json({
      ok: true,
      status: 'accepted',
      quote_id: updated.id,
      accepted_at: updated.acceptedAt,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /quote/:id/accept error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /quote/:token/reject
 * Decisión del CLIENTE: rechaza el presupuesto.
 */
router.post('/:token/reject', decisionLimiter, async (req, res) => {
  try {
    // SCRUM-95: token opaco — ver nota en /:token/accept.
    const token = parseToken(req.params.token);

    const body = RejectQuoteSchema.parse(req.body);

    const quote = token ? await prisma.quote.findUnique({
      where: { decisionToken: token },
    }) : null;

    if (!quote) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Si ya estaba rechazado → idempotente
    if (quote.status === 'rejected') {
      return res.json({
        ok: true,
        status: 'already_rejected',
        quote_id: quote.id,
      });
    }

    // Si ya estaba aceptado → conflicto
    if (quote.status === 'accepted') {
      return res.status(409).json({
        ok: false,
        error: 'already_accepted',
      });
    }

    const now = new Date();

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'rejected',
        rejectedAt: now,
        acceptedAt: null,
        decisionChannel: body.channel ?? 'whatsapp',
        rejectionReason: body.reason ?? null,
        decisionComment: body.comment ?? null,
        evidence: body.evidence ?? quote.evidence ?? {},
      },
    });

    return res.json({
      ok: true,
      status: 'rejected',
      quote_id: updated.id,
      rejected_at: updated.rejectedAt,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /quote/:token/reject error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});



/**
 * POST /quote/:token/decision
 * Endpoint pensado para WhatsApp / n8n.
 *
 * Body:
 *  {
 *    "decision": "accept" | "reject",
 *    "comment": "texto opcional que escribe el cliente",
 *    "reason":  "opcional, motivo corto (ej. 'too_expensive')"
 *  }
 *
 * Efectos:
 *  - Actualiza el presupuesto con status, fechas y canal = 'whatsapp'
 *  - Si decision = accept → marca ACCEPTED y genera la siguiente factura
 *    según paymentTerms (FULL_UPFRONT o FIFTY_FIFTY).
 *
 * SCRUM-95 (🔴 la sexta puerta, la peor): esta ruta era pública, SIN auth y SIN
 * rate-limit, resolvía por Quote.id autoincremental (enumerable) y MUTABA estado
 * (aceptar/rechazar presupuestos ajenos) además de devolver NIF/dirección/teléfono
 * del profesional en el JSON. Ahora: token opaco (decisionLimiter compartido con
 * accept/reject) igual que las otras dos rutas de decisión.
 */
router.post('/:token/decision', decisionLimiter, async (req, res) => {
  try {
    // SCRUM-95: token opaco — ver nota en /:token/accept.
    const token = parseToken(req.params.token);

    const decision = String(req.body?.decision || '').toLowerCase();
    const comment = req.body?.comment ? String(req.body.comment) : undefined;
    const reason = req.body?.reason ? String(req.body.reason) : undefined;
    const signatureData = req.body?.signatureData ? String(req.body.signatureData) : null;
    const tierId = req.body?.tierId ? String(req.body.tierId) : null;

    if (!['accept', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'invalid_decision' });
    }

    // Cargamos el presupuesto con merchant, customer e invoices existentes
    const quote = token ? await prisma.quote.findUnique({
      where: { decisionToken: token },
      include: {
        merchant: true,
        customer: true,
        Invoice: true,
      },
    }) : null;

    if (!quote) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Si ya está aceptado/rechazado, devolvemos idempotente
    if (decision === 'accept' && quote.status === 'accepted') {
      return res.json({ ok: true, status: 'already_accepted' });
    }
    if (decision === 'reject' && quote.status === 'rejected') {
      return res.json({ ok: true, status: 'already_rejected' });
    }
    // A16.2: un presupuesto caducado no se decide (la landing ya muestra el
    // copy oficial N3; esto cubre carreras entre pasadas del cron)
    if (isQuoteExpired(quote)) {
      return res.status(410).json({
        error: 'quote_expired',
        message: 'Este presupuesto caducó. Pide uno actualizado al profesional.',
      });
    }

    let updatedQuote: any = quote;
    let createdInvoice: any = null;

    if (decision === 'accept') {
      // 1) Marcamos el presupuesto como ACCEPTED vía WhatsApp
      const now = new Date();

      // Si hay tiers y el cliente eligió uno, recalcular el total
      let tierTotal: string | undefined;
      let selectedLines: any[] | undefined;
      if (tierId && quote.tiers) {
        const tiers = quote.tiers as QuoteTier[];
        const chosen = tiers.find((t) => t.id === tierId);
        if (chosen) {
          tierTotal = calcTierTotal(chosen.lines).toFixed(2);
          selectedLines = chosen.lines;
        }
      }

      updatedQuote = await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: 'accepted',
          acceptedAt: now,
          decisionChannel: 'whatsapp',
          decisionComment: comment,
          rejectionReason: null,
          rejectedAt: null,
          ...(signatureData ? { signatureUrl: signatureData } : {}),
          ...(tierId ? { selectedTierId: tierId } : {}),
          ...(tierTotal ? { total: tierTotal } : {}),
          ...(selectedLines ? { lines: selectedLines } : {}),
        },
      });

      // ENT-3: historial
      recordCustomerEvent({
        merchantId: quote.merchantId,
        customerId: quote.customerId,
        type: 'quote_accepted',
        title: `Presupuesto ${displayQuoteNumber(quote)} aceptado por el cliente`,
        detail: signatureData ? 'Firmado digitalmente' : null,
      });

      // Regenerar PDF con firma si se adjuntó
      if (signatureData) {
        try {
          const merchant = quote.merchant;
          const customer = quote.customer;
          const pdf = await generateQuotePdf({
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber, // A1.2
            merchant: {
              name: merchant.name, legalName: merchant.legalName,
              taxId: merchant.taxId, address: merchant.address,
              whatsappPhone: merchant.whatsappPhone,
              logoUrl: merchant.logoUrl,
            },
            customer: { name: customer.name, phone: customer.phone, email: customer.email, legalName: (customer as any).legalName, taxId: (customer as any).taxId }, // A20.4
        docFields: ((quote as any).docFields as any) ?? null, // A20.4
            currency: quote.currency,
            total: quote.total.toString(),
            lines: quote.lines as any,
            signatureData,
            signedAt: now,
            country: merchant.country,
          });
          await prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl: pdf.publicUrlPath } });
        } catch (e) {
          console.error('[decision] Error regenerando PDF con firma:', e);
        }
      }

      // A13.1 (JOB-1): auto-creación del Trabajo al aceptar (idempotente, nunca rompe)
      ensureJobForQuote(quote.id).catch(() => {});

      // 2) Según paymentTerms, generamos la siguiente factura
      const existingInvoices = quote.Invoice || [];
      let paymentTerms = (quote as any).paymentTerms ?? null;

      // ✅ Si no hay condiciones de pago grabadas,
      // usamos FULL_UPFRONT como default
      if (!paymentTerms) {
        paymentTerms = 'FULL_UPFRONT';
      }

      // SCRUM-27: plan efectivo del Quote (custom si lo tiene, si no el preset); selección por
      // conteo igual que antes (misma semántica que getNextBillingStage).
      const plan = resolveBillingPlan(updatedQuote);
      const stage = plan[existingInvoices.length] ?? null;

      if (stage) {
        const isCustomPlan = Array.isArray((updatedQuote as any).customBillingPlan) && (updatedQuote as any).customBillingPlan.length > 0;

        // Copiar las líneas a la factura (la parte del tramo, ej. 50% en FIFTY_FIFTY).
        // Sin esto el PDF salía sin desglose y la huella VeriFactu con cuota IVA 0,00 (bug E2E V0-1).
        // updatedQuote (no quote): si el cliente eligió un tier, total y líneas ya son los del tier.
        // SCRUM-141: el importe se DERIVA de las líneas del tramo — el total de una factura es
        // consecuencia de sus líneas. Antes salía de `distributeStageAmounts` con las líneas
        // escaladas aparte, y el desfase de redondeo quedaba sellado en la huella VeriFactu.
        const quoteLines = Array.isArray(updatedQuote.lines) ? (updatedQuote.lines as any[]) : [];
        const scaledLines = stageLinesReconciled(
          quoteLines, plan, stage.index, distributeStageAmounts(updatedQuote.total, plan)[stage.index],
        );
        const invoiceAmount = grossOfLines(scaledLines);

        // SCRUM-246 · ANTES de pedir número. Si no hay nada que cobrar, no se emite y la serie
        // ni se entera: comprobarlo DESPUÉS obligaría a modificar una factura ya numerada o a
        // deshacerla, y deshacer es lo que crea el hueco que hay que justificar ante Hacienda.
        //
        // ⚠️ Aquí quien dispara es el CLIENTE FINAL, y él no puede arreglar un presupuesto sin
        // conceptos. Su aceptación ya está commiteada más arriba y sigue siendo válida: lo único
        // que no ocurre es la emisión. El copy lo dice sin pedirle que repita nada.
        exigirLineasFacturables(scaledLines);

        const invoice = await prisma.$transaction(async (tx) => {
          const invoiceNumber = await allocateInvoiceNumber(tx, quote.merchantId, {
            camino: 'C1',
            // Quien emite aquí NO es el pro: es el cliente final pulsando en WhatsApp.
            // `ref` nombra la VÍA, nunca el token (sería guardar una credencial).
            actor: { tipo: 'cliente_final', ref: 'quote_token' },
          });
          return tx.invoice.create({
            data: {
              merchantId: quote.merchantId,
              customerId: quote.customerId,
              quoteId: quote.id,
              number: invoiceNumber,
              type: isReceiptNumber(invoiceNumber) ? 'JUST' : 'F1', // V0-0
              total: invoiceAmount.toFixed(2),
              stageLabel: isCustomPlan ? stage.label : null, // SCRUM-27: etiqueta congelada (solo custom)
              currency: quote.currency,
              lines: scaledLines.length > 0 ? scaledLines : undefined,
              pdfUrl: 'PENDING_PDF',
              qrData: 'PENDING_QR',
              registerId: null,
            },
          });
        });

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
                  // No sale ningún documento de aquí: lo impide el portón de SCRUM-206.
    // ⚠️ El sellado pasa a `sellarTrasEmision` (SCRUM-205, punto unico). El arreglo de
    // SCRUM-206b no se pierde: este camino SIGUE sellando, solo que por la puerta comun,
    // que ademas registra el fallo por dentro. La llamada suelta a applyVeriFactu se va.
        // SCRUM-205 · punto único de sellado, después del commit.
        //
        // C1 lo dispara el CLIENTE FINAL, y eso es legítimo: el hecho que emite es que ACEPTE
        // el presupuesto, no que abra un PDF. Lo que el ticket corrige es lo segundo.
        // Este camino tampoco sellaba: dependía del sellado perezoso de `ensureInvoicePdf`.
        await sellarTrasEmision(invoice, quote.merchant, prisma);

        createdInvoice = invoice;


        

        


        // 3) Si las condiciones de pago son FULL_UPFRONT, enviamos la factura por
        // WhatsApp (payment_request_es). Llamada DIRECTA al servicio de dominio:
        // antes se hacía fetch a /admin/... que fallaba por falta de sesión.
        if (paymentTerms === 'FULL_UPFRONT' && createdInvoice) {
          sendInvoicePaymentRequest(createdInvoice.id).catch((err) => {
            console.error('[POST /quote/:id/decision] error enviando payment_request:', err);
          });
        }
      }

    } else {
      // decision === 'reject'
      updatedQuote = await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          acceptedAt: null,
          decisionChannel: 'whatsapp',
          rejectionReason: reason || comment || null,
          decisionComment: comment ?? null,
        },
      });

      // ENT-3: historial
      recordCustomerEvent({
        merchantId: quote.merchantId,
        customerId: quote.customerId,
        type: 'quote_rejected',
        title: `Presupuesto ${displayQuoteNumber(quote)} rechazado por el cliente`,
        detail: reason || comment || null,
      });
    }

    // Notificar al profesional por WhatsApp (J1: texto libre si la ventana 24 h está abierta;
    // si está cerrada, fallback a la plantilla merchant_alert_es). Fire-and-forget.
    {
      const customerName = quote.customer?.name || 'El cliente';
      const amount = `${Number(quote.total).toFixed(2)} ${quote.currency}`;
      const qNum = displayQuoteNumber(quote); // A1.2: número por merchant, no el id global
      const freeText = decision === 'accept'
        ? `✅ ${customerName} aceptó tu presupuesto ${qNum} por ${amount}`
        : `❌ ${customerName} rechazó el presupuesto ${qNum}. Motivo: ${reason || comment || 'Sin especificar'}`;
      notifyMerchantAlert({
        merchantId: quote.merchantId,
        merchantPhone: quote.merchant?.whatsappPhone,
        customerName,
        action: decision === 'accept' ? 'ha aceptado tu presupuesto' : 'ha rechazado tu presupuesto',
        detail: decision === 'accept' ? `${amount} · Presupuesto ${qNum}` : `Presupuesto ${qNum}`,
        freeText,
      }).catch((err) => console.error('[decision] Error notificando al merchant:', err));
    }

    // Nota: usamos `quote` (el original con include) para merchant / customer
    const merchant = quote.merchant;
    const customer = quote.customer;

    return res.json({
      ok: true,
      quote: {
        id: updatedQuote.id,
        status: updatedQuote.status,
        acceptedAt: updatedQuote.acceptedAt,
        rejectedAt: updatedQuote.rejectedAt,
        decisionChannel: updatedQuote.decisionChannel,
        decisionComment: updatedQuote.decisionComment,
        rejectionReason: updatedQuote.rejectionReason,
        paymentTerms: (updatedQuote as any).paymentTerms ?? null,
        total: updatedQuote.total,
        currency: updatedQuote.currency,
      },
      invoice: createdInvoice
        ? {
            id: createdInvoice.id,
            number: createdInvoice.number,
            total: createdInvoice.total,
            currency: createdInvoice.currency,
            pdfUrl: createdInvoice.pdfUrl,
            createdAt: createdInvoice.createdAt,
            status: createdInvoice.status,
          }
        : null,
      merchant: merchant
        ? {
            id: merchant.id,
            name: merchant.name || merchant.legalName || null,
            legalName: merchant.legalName,
            taxId: merchant.taxId,
            address: merchant.address,
            whatsappPhone: merchant.whatsappPhone,
            defaultCurrency: merchant.defaultCurrency,
          }
        : null,
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          }
        : null,
    });

  } catch (err) {
    console.error('[POST /quote/:token/decision] error', err);
    // SCRUM-246 · aquí lo lee el CLIENTE FINAL, no el profesional, y él no puede arreglar un
    // presupuesto sin conceptos. Su aceptación YA está commiteada más arriba y sigue valiendo:
    // lo único que no ha ocurrido es la emisión. Por eso el copy no le pide que repita nada.
    if (esErrorSinLineas(err)) {
      return res.status(409).json({ ok: false, error: 'factura_sin_lineas', message: COPY_PUBLICO_SIN_LINEAS });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});



export default router;

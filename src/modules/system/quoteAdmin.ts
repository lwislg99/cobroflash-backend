// src/modules/system/quoteAdmin.ts
import { prisma } from '../../core/db/prisma';
import { tagsParaPrisma } from './tagsDelCliente'; // SCRUM-595 (DOC-05): el MISMO mecanismo que CONT-07
import { allocateInvoiceNumber, isReceiptNumber } from '../invoicing/domain/invoiceNumber.service';
import { buildBillingPlanView } from '../quotes/domain/billingPlanView'; // SCRUM-34
import { ensureQuoteDecisionToken } from '../quotes/domain/quoteToken.service'; // SCRUM-95
import { numeroConRevision, vistaDeRevisiones } from '../quotes/domain/revision'; // SCRUM-655 (T6, fase B)

/**
 * SCRUM-606 (ALB-01) · EL TOPE DE ESTA LISTA, CON NOMBRE.
 *
 * Era un `100` suelto dentro del `findMany` y ahora se declara, porque hay un segundo lector que
 * necesita saberlo: el buscador de presupuestos de «Nuevo albarán» tiene que poder decirle al
 * profesional «hay más, afina la búsqueda» en vez de enseñar un recorte que parece el total.
 * Copiar el número allí habría sido el escalón 4 —duplicar con comentario—, y el día que este
 * `take` cambie el aviso mentiría sin que nada se entere.
 */
export const TOPE_LISTADO_QUOTES = 100;

/**
 * Lista de presupuestos para el panel admin.
 */
export async function listQuotesAdmin(
  merchantId: number,
  search?: string,
  status?: string,
  dateFrom?: Date | null,
  dateTo?: Date | null,
  // SCRUM-148: filtro por AUTOR del presupuesto (`Quote.teamMemberId`), para el detalle por
  // miembro del hub de Equipo. `null` = los del PROPIETARIO (no tiene fila en team_members,
  // así que su autoría se guarda como null); `undefined` = sin filtrar. Distinguir null de
  // undefined es exactamente el motivo de no escribir aquí un `if (teamMemberId)`: con `0` o
  // `null` ese if es falso y el filtro "del propietario" se caería en silencio, devolviendo
  // TODOS los presupuestos del negocio bajo el nombre de una persona.
  teamMemberId?: number | null,
) {
  const where: any = { merchantId };

  if (teamMemberId !== undefined) where.teamMemberId = teamMemberId;

  if (status && status !== 'all') {
    where.status = status;
  }

  if (search && search.trim() !== '') {
    const s = search.trim();
    const maybeId = Number(s);

    where.OR = [
      // A1.2: el usuario busca por el número que VE (por merchant); el id global
      // se mantiene para no romper búsquedas antiguas.
      ...(Number.isFinite(maybeId) ? [{ id: maybeId }, { quoteNumber: maybeId }] : []),
      { customer: { name:  { contains: s, mode: 'insensitive' } } },
      { customer: { phone: { contains: s, mode: 'insensitive' } } },
    ];
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo)   where.createdAt.lte = dateTo;
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: true,
      charge: true,
    },
    orderBy: { id: 'desc' },
    take: TOPE_LISTADO_QUOTES, // SCRUM-606: el mismo número que lee el aviso de «hay más»
  });

  return quotes.map((q) => {
    const primaryStatus =
      typeof q.status === 'string' ? q.status.toLowerCase() : 'draft';

    let derivedStatus = primaryStatus;

    if (primaryStatus === 'draft' && q.charge) {
      const cs =
        typeof q.charge.status === 'string'
          ? q.charge.status.toLowerCase()
          : '';

      if (cs === 'paid' || cs === 'succeeded') {
        derivedStatus = 'paid';
      } else if (cs === 'pending') {
        derivedStatus = 'pending';
      } else if (cs === 'expired') {
        derivedStatus = 'expired';
      }
    }

    return {
      id: q.id,
      number: q.quoteNumber ?? q.id, // A1.2: número visible por merchant (fallback pre-backfill)
      customerName: q.customer?.name ?? '—',
      customerPhone: q.customer?.phone ?? null,
      createdAt: q.createdAt,
      currency: q.currency ?? 'EUR',
      totalAmount: q.total,
      status: derivedStatus,
      method: q.charge?.method ?? null,
      chargeId: q.charge?.id ?? null,
      internalNotes: q.internalNotes ?? null,
      // 🔴 SCRUM-595 (DOC-05) · EL QUINTO ESLABON, Y AQUI ES EL QUE MAS FACIL SE PIERDE.
      //
      // Esto NO es un `select` de Prisma: es una proyeccion A MANO. La consulta trae la fila
      // entera y lo que no se copie aqui NO SALE, aunque la columna exista y aunque el guardado
      // haya funcionado. Sin esta linea, el profesional escribiria la etiqueta, la lista se
      // recargaria sin ella, volveria a escribirla — y la tanda seguiria VERDE, porque el dato SI
      // estaria en la base. El defecto seria MUDO. Es el aviso de SCRUM-580, buscado ANTES.
      //
      // ⚠️ Y la FACTURA no lo necesita: `listInvoicesAdmin` devuelve `findMany` sin `select`, asi
      // que alli la columna sale sola. El quinto eslabon NO es simetrico entre los dos documentos.
      tags: q.tags ?? null,
    };
  });
}

/**
 * SCRUM-595 (DOC-05) · LAS ETIQUETAS DE UN PRESUPUESTO.
 *
 * Mismo mecanismo que el cliente: la decision es `normalizarTags` y la ortografia del NULL es
 * `tagsParaPrisma` — las dos compartidas, ninguna reescrita aqui.
 *
 * 🔴 LA TENENCIA VIVE EN EL `WHERE`, no en un `if` de JavaScript (regla 2). Es el mismo patron
 * que `PUT /:id/notes`: con `updateMany` acotado, un id ajeno no escribe nada y devuelve 0 — no
 * hace falta leer antes para comprobar de quien es, y por tanto no hay hueco entre la lectura y
 * la escritura.
 *
 * Devuelve cuantas filas ha tocado: 0 significa «no es tuyo o no existe», y el llamador lo
 * traduce a 404. Un `ok: true` sobre cero filas le diria al profesional que ha guardado algo.
 */
export async function setQuoteTags(merchantId: number, id: number, tags: unknown): Promise<number> {
  const valor = tagsParaPrisma(tags);
  // `undefined` es «no toques el campo», y esta ruta existe justo para tocarlo: si llegara aqui,
  // escribir seria inventarse una intencion. No pasa —la ruta valida antes—, pero un 0 es una
  // respuesta y `undefined` no lo es.
  if (valor === undefined) return 0;
  const r = await prisma.quote.updateMany({ where: { id, merchantId }, data: { tags: valor } });
  return r.count;
}

/**
 * Detalle completo de un presupuesto para el panel admin.
 */
export async function getQuoteDetailAdmin(id: number, merchantId?: number) {
  // A12.1: scoping multi-tenant (regla 2) — un id ajeno = not found
  const quote = await prisma.quote.findFirst({
    where: { id, ...(merchantId != null ? { merchantId } : {}) },
    include: {
      merchant: true,
      customer: true,
      charge: true,
      Invoice: true,
    },
  });

  if (!quote) {
    throw new Error('quote_not_found');
  }

  // SCRUM-34: plan RESUELTO + siguiente tramo por CONTEO — la MISMA regla que usa
  // POST /admin/quotes/:id/invoice (plan[existingInvoices.length]) para que el label
  // de la UI nunca prometa un tramo distinto del que emitiría el endpoint.
  const planView = buildBillingPlanView(quote as any, (quote.Invoice || []).length);

  // ── SCRUM-655 (T6, fase B) · QUÉ REVISIONES HAY Y CUÁL ESTÁ VIGENTE ───────────────────────
  // El «.1» de «P2004226.1» es una REVISIÓN, y vive en su columna: el número base no cambia.
  // El grupo es {merchantId, quoteNumber}. 🔴 Y `quoteNumber` NULO NO ES UNA CLAVE: agrupar por
  // null metería en el mismo saco a todos los presupuestos sin numerar del merchant, que no tienen
  // nada que ver entre sí. Sin número, un presupuesto es su propio grupo — y eso es la verdad, no
  // un apaño: sin número no hay «P2004226» del que ser la revisión.
  const hermanas = quote.quoteNumber != null
    ? await prisma.quote.findMany({
        where: { merchantId: quote.merchantId, quoteNumber: quote.quoteNumber },
        select: { id: true, quoteNumber: true, revision: true, status: true,
                  signatureUrl: true, total: true, createdAt: true },
        orderBy: { revision: 'asc' },
      })
    : [{ id: quote.id, quoteNumber: quote.quoteNumber, revision: quote.revision,
         status: quote.status, signatureUrl: quote.signatureUrl,
         total: quote.total, createdAt: quote.createdAt }];

  const base = String(quote.quoteNumber ?? quote.id);
  const comoFila = (q: { id: number; revision: number; signatureUrl: string | null }) => ({
    id: q.id,
    numero: base,
    revision: q.revision,
    // «FIRMADO» se deriva de `signatureUrl`, NO de `acceptedAt` — el MISMO criterio que el libro
    // registro (`libroRegistro.repo.ts`) y el embudo de métricas: aceptar y firmar no son lo mismo.
    // Y el trazo NO VIAJA: `signatureUrl` es un data-URI con la firma del cliente y de aquí sale
    // sólo el booleano.
    firmado: q.signatureUrl != null,
  });
  // Toda la regla vive en el dominio: el suelo de ceguera y el «dos vigentes no es una respuesta».
  const vista = vistaDeRevisiones(comoFila(quote), hermanas.map(comoFila));
  const porId = new Map(hermanas.map((q) => [q.id, q]));
  const revisiones = vista.revisiones.map((r) => ({
    id: r.id,
    revision: r.revision,
    numero: numeroConRevision(r),
    status: porId.get(r.id)!.status,
    firmado: r.firmado,
    total: porId.get(r.id)!.total,
    createdAt: porId.get(r.id)!.createdAt,
    vigente: r.esVigente,
  }));

  return {
    id: quote.id,
    number: quote.quoteNumber ?? quote.id, // A1.2: número visible por merchant
    // SCRUM-655 (T6, fase B). `number` NO se toca: un presupuesto sin revisiones sale exactamente
    // como salía —enumerado y sin «.0»—, y todo lo que ya lo consume sigue leyendo lo mismo.
    revision: quote.revision,
    numeroConRevision: vista.numero,
    revisiones,
    vigenteId: vista.vigenteId,
    // SCRUM-95: token opaco del enlace público (patrón payToken de Charge.receiptToken,
    // jobs.routes.ts:157) — lo consume la vista admin para el enlace "copiar" de fallback.
    payToken: await ensureQuoteDecisionToken(quote.id, prisma),
    status: quote.status,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,

    currency: quote.currency,
    total: quote.total,
    lines: quote.lines,
    pdfUrl: (quote as any).pdfUrl ?? null,
    signatureUrl: quote.signatureUrl ?? null,
    tiers: quote.tiers ?? null,
    selectedTierId: quote.selectedTierId ?? null,
    internalNotes: quote.internalNotes ?? null,
    // 🔴 SCRUM-595 · EL QUINTO ESLABON, SEGUNDA VEZ. El detalle es OTRA proyeccion explicita, y
    // se buscaron LAS DOS: sin esta linea la lista ensenaria las etiquetas y la ficha del
    // presupuesto saldria sin ellas, que es la misma perdida muda en otra pantalla.
    tags: quote.tags ?? null,
    
    merchant: {
      id: quote.merchant.id,
      name: quote.merchant.name,
      legalName: quote.merchant.legalName,
      taxId: quote.merchant.taxId,
      address: quote.merchant.address,
      whatsappPhone: quote.merchant.whatsappPhone,
      defaultCurrency: quote.merchant.defaultCurrency,
      logoUrl: quote.merchant.logoUrl,
    },

    customer: {
      id: quote.customer.id,
      name: quote.customer.name,
      phone: quote.customer.phone,
      email: quote.customer.email,
      notes: quote.customer.notes,
    },

    charge: quote.charge
      ? {
          id: quote.charge.id,
          status: quote.charge.status,
          method: quote.charge.method,
          amount: quote.charge.amount,
          currency: quote.charge.currency,
          expiresAt: quote.charge.expiresAt,
          reference: quote.charge.reference,
        }
      : null,

    invoices: quote.Invoice.map((inv) => ({
      id: inv.id,
      number: inv.number,
      total: inv.total,
      currency: inv.currency,
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt,
      status: inv.status,         // SCRUM-34: el front ya lo consumía sin viajar (CTAs viejos = SCRUM-35)
      stageLabel: inv.stageLabel, // SCRUM-34: etiqueta del tramo (custom); null en presets
    })),

    decision: {
      acceptedAt: quote.acceptedAt,
      rejectedAt: quote.rejectedAt,
      decisionChannel: quote.decisionChannel,
      decisionComment: quote.decisionComment,
      rejectionReason: quote.rejectionReason,
      paymentTerms: quote.paymentTerms,
      evidence: quote.evidence,
    },

    // SCRUM-34: plan de cobro resuelto para la UI (labels + % + importes exactos por
    // distributeStageAmounts) y siguiente tramo por conteo. hasCustomPlan distingue un
    // plan personalizado del default FULL_UPFRONT que resolveBillingPlan aplica a null.
    billingPlan: planView.billingPlan,
    nextStage: planView.nextStage,
    hasCustomPlan: planView.hasCustomPlan,
  };
}

/**
 * Marca un presupuesto como aceptado (solo estado, sin crear cobros).
 */
export async function acceptQuoteAdmin(
  quoteId: number,
  params: {
    channel?: 'backoffice' | 'whatsapp' | 'other';
    comment?: string;
    paymentTerms?: string;
    evidence?: any;
  } = {},
  merchantId?: number, // A12.1: scoping multi-tenant (regla 2)
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...(merchantId != null ? { merchantId } : {}) },
  });

  if (!quote) {
    throw new Error('quote_not_found');
  }

  if (quote.status === 'accepted') {
    return quote;
  }

  if (quote.status === 'rejected') {
    throw new Error('quote_already_rejected');
  }

  const now = new Date();

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: 'accepted',
      acceptedAt: now,
      rejectedAt: null,
      decisionChannel: params.channel ?? 'backoffice',
      decisionComment: params.comment ?? null,
      paymentTerms: params.paymentTerms ?? quote.paymentTerms,
      evidence: params.evidence ?? quote.evidence,
    },
  });

  return updated;
}

/**
 * Marca un presupuesto como rechazado.
 */
export async function rejectQuoteAdmin(
  quoteId: number,
  params: {
    channel?: 'backoffice' | 'whatsapp' | 'other';
    reason?: string;
    comment?: string;
    evidence?: any;
  } = {},
  merchantId?: number, // A12.1: scoping multi-tenant (regla 2)
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...(merchantId != null ? { merchantId } : {}) },
  });

  if (!quote) {
    throw new Error('quote_not_found');
  }

  if (quote.status === 'accepted') {
    throw new Error('quote_already_accepted');
  }

  if (quote.status === 'rejected') {
    return quote;
  }

  const now = new Date();

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: 'rejected',
      rejectedAt: now,
      acceptedAt: null,
      decisionChannel: params.channel ?? 'backoffice',
      rejectionReason: params.reason ?? null,
      decisionComment: params.comment ?? null,
      evidence: params.evidence ?? quote.evidence,
    },
  });

  return updated;
}

/**
 * SCRUM-149: aquí vivía `createInvoiceFromQuoteAdmin`, RETIRADA (código muerto).
 *
 * Estaba importada en `quotesAdmin.routes.ts` pero ninguna ruta la llamaba, y si se hubiera
 * cableado habría emitido una factura con DOS defectos fiscales:
 *   · SIN copiar las líneas → `calcVatCuotaTotal` da 0,00 → la huella VeriFactu se sellaba
 *     declarando CERO IVA repercutido sobre un importe que sí lo lleva. Es el mismo "bug E2E
 *     V0-1" que la ruta viva (`POST /admin/quotes/:id/invoice`) documenta como ya corregido:
 *     se arregló en el camino vivo y quedó fosilizado en este.
 *   · Ignorando el plan de tramos (`total: quote.total` completo), saltándose SCRUM-27/32/141.
 *
 * NO se conserva "por si acaso": es un arma cargada. El caso que podría haberla justificado
 * —facturar un Trabajo con condiciones MANUAL/SIN_CONDICIONES, hoy no facturable por ninguna
 * vía— es un GAP REAL reconocido (SCRUM-150), y cuando toque se construye bien desde cero, no
 * resucitando algo que nace con el bug dentro.
 *
 * El guard que impide que esto vuelva a poder pasar vive en `applyVeriFactu`
 * (`invoicing/domain/verifactu.service.ts`): una factura sin líneas ya no se puede sellar.
 */

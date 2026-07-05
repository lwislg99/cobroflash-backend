// src/modules/maintenance/domain/maintenance.service.ts — MANT-1 (EXT3 Ola 15)
// Master Parte R: mantenimientos recurrentes tras flag MAINTENANCE_ENABLED (OFF,
// merchant opt-in). Tres piezas:
//   1) proponer al ACEPTAR: línea que matchea categoría mantenible del gremio →
//      toggle "Crear recordatorio de mantenimiento" (intervalo prefijado editable);
//   2) ciclo del cron (diario 10h): plan vencido → quote DRAFT (origin='maintenance')
//      → WhatsApp AL PRO (jamás directo al cliente) con [Aprobar y enviar]
//      [Posponer 30d] [Cancelar plan]; aprobar = flujo normal de envío;
//   3) anti-spam LITERAL de la spec: 1 propuesta/cliente/90d · respeta waOptOut ·
//      horas tranquilas · 2 rechazos seguidos → el plan se pausa solo.
import { prisma } from '../../../core/db/prisma';
import { isFlagEnabled } from '../../../core/flags';
import { sendWhatsAppButtons, sendWhatsAppText } from '../../../integrations/whatsapp';
import { sendQuoteWhatsAppToCustomer } from '../../quotes/domain/sendQuote.service';
import { recordCustomerEvent } from '../../system/customerEvents.service';
import { normalizePhone, formatMoneyEs, maskPhone } from '../../../core/utils/utils';
import { allocateQuoteNumber } from '../../quotes/domain/quoteNumber.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const PROPOSAL_COOLDOWN_DAYS = 90; // 1 propuesta/cliente/90d (spec literal)
const POSTPONE_DAYS = 30;
const MAX_REJECTED_STREAK = 2; // 2 rechazos seguidos → pausa

// Semillas del master (Parte R, MANT-1) — el PRO siempre puede editar intervalo.
type MaintSeed = { match: RegExp; title: string; intervalMonths: number };
export const MAINTAINABLE_SEEDS: Record<string, MaintSeed[]> = {
  climatizacion: [
    { match: /aire\s*acondicionado|a\/?a\b|split|clima/i, title: 'Revisión de A/A pre-verano', intervalMonths: 12 },
    { match: /caldera/i, title: 'Revisión de caldera pre-invierno', intervalMonths: 12 },
  ],
  fontanero: [
    { match: /termo|calentador/i, title: 'Revisión de termo/calentador', intervalMonths: 12 },
    { match: /descalcificador/i, title: 'Mantenimiento del descalcificador', intervalMonths: 6 },
    { match: /caldera/i, title: 'Revisión de caldera pre-invierno', intervalMonths: 12 },
  ],
  electricista: [
    { match: /cuadro/i, title: 'Revisión del cuadro eléctrico', intervalMonths: 24 },
  ],
  cerrajero: [
    { match: /cerradura|bomb[ií]n|puerta/i, title: 'Engrase y ajuste de cerradura', intervalMonths: 24 },
  ],
  pintor: [
    { match: /pintura|pintar/i, title: 'Repaso de pintura', intervalMonths: 36 },
  ],
  reformista: [
    { match: /reforma|obra|baño|cocina/i, title: 'Visita post-obra (garantía)', intervalMonths: 12 },
  ],
};

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

type QuoteLine = { concept?: string; price?: number | string; qty?: number | string; tax?: number | string };

// 1) ¿Alguna línea del presupuesto matchea una categoría mantenible del gremio?
export function suggestMaintenance(
  trade: string | null | undefined,
  lines: unknown,
): { title: string; intervalMonths: number; matchedConcept: string; line: QuoteLine } | null {
  const seeds = trade ? MAINTAINABLE_SEEDS[trade] : undefined;
  if (!seeds || !Array.isArray(lines)) return null;
  for (const raw of lines as QuoteLine[]) {
    const concept = String(raw?.concept ?? '').trim();
    if (!concept) continue;
    for (const seed of seeds) {
      if (seed.match.test(concept)) {
        return { title: seed.title, intervalMonths: seed.intervalMonths, matchedConcept: concept, line: raw };
      }
    }
  }
  return null;
}

// Horas tranquilas (anti-spam de la spec): el ciclo solo propone entre 9 y 21h
// (hora española). El cron corre a las 10h; esto protege ejecuciones manuales.
export function isQuietHoursMadrid(now: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hour12: false, timeZone: 'Europe/Madrid' }).format(now),
  );
  return hour < 9 || hour >= 21;
}

// 2) Ciclo del cron — diario 10h. Devuelve un resumen para logs/tests.
export async function runMaintenanceProposals(now: Date = new Date()): Promise<{
  due: number; proposed: number; skipped: string[];
}> {
  const skipped: string[] = [];
  if (isQuietHoursMadrid(now)) {
    return { due: 0, proposed: 0, skipped: ['quiet_hours'] };
  }

  const due = await prisma.maintenancePlan.findMany({
    where: { active: true, nextDueAt: { lte: now } },
    orderBy: { nextDueAt: 'asc' },
    take: 50,
  });
  let proposed = 0;

  for (const plan of due) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: plan.merchantId },
      select: { id: true, name: true, country: true, flags: true, whatsappPhone: true, trade: true },
    });
    if (!merchant || !isFlagEnabled('MAINTENANCE_ENABLED', { merchant })) {
      skipped.push(`plan ${plan.id}: flag_off`);
      continue;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: plan.customerId },
      select: { id: true, name: true, phone: true, waOptOut: true, merchantId: true },
    });
    if (!customer || customer.merchantId !== plan.merchantId) {
      skipped.push(`plan ${plan.id}: customer_gone`);
      continue;
    }
    // Respeta waOptOut: sin canal con el cliente el ciclo no propone (si vuelve, se retoma).
    if (customer.waOptOut) {
      skipped.push(`plan ${plan.id}: wa_opt_out`);
      continue;
    }

    // 1 propuesta/CLIENTE/90d — cuenta cualquier plan del mismo cliente.
    const lastForCustomer = await prisma.maintenancePlan.aggregate({
      where: { merchantId: plan.merchantId, customerId: plan.customerId, lastProposedAt: { not: null } },
      _max: { lastProposedAt: true },
    });
    const last = lastForCustomer._max.lastProposedAt;
    if (last && now.getTime() - last.getTime() < PROPOSAL_COOLDOWN_DAYS * DAY_MS) {
      const resumeAt = new Date(last.getTime() + PROPOSAL_COOLDOWN_DAYS * DAY_MS);
      await prisma.maintenancePlan.update({ where: { id: plan.id }, data: { nextDueAt: resumeAt } });
      skipped.push(`plan ${plan.id}: customer_cooldown_90d`);
      continue;
    }

    // Quote DRAFT desde las líneas del plan: la línea mantenible del presupuesto
    // origen (mismo precio); si no hay origen, línea con el título a precio 0
    // (borrador SIEMPRE editable — el pro aprueba antes de que salga nada).
    let line: QuoteLine = { concept: plan.title, qty: 1, price: 0, tax: 0 };
    if (plan.quoteId) {
      const src = await prisma.quote.findUnique({ where: { id: plan.quoteId }, select: { lines: true } });
      const match = suggestMaintenance(merchant.trade, src?.lines);
      if (match?.line) line = { ...match.line, concept: `${plan.title}` };
    }
    const price = Number(line.price ?? 0) * Number(line.qty ?? 1);

    const draft = await prisma.$transaction(async (tx) => {
      const quoteNumber = await allocateQuoteNumber(tx, plan.merchantId);
      return tx.quote.create({
        data: {
          merchantId: plan.merchantId,
          customerId: plan.customerId,
          quoteNumber,
          status: 'draft',
          origin: 'maintenance', // A15.3: métrica € por origen
          total: price.toFixed(2),
          currency: 'EUR',
          lines: [line] as any,
          createdVia: 'maintenance', // V0-3: telemetría
        },
      });
    });
    const quoteNumber = draft.quoteNumber;

    // WhatsApp AL PRO (jamás al cliente): botones de respuesta con plan+draft.
    const proPhone = normalizePhone(merchant.whatsappPhone);
    let waNote = 'sin teléfono del pro';
    if (proPhone) {
      const result = await sendWhatsAppButtons({
        to: proPhone,
        merchantId: plan.merchantId,
        bodyText:
          `🔧 Toca ${plan.title.toLowerCase()} de ${customer.name}.\n` +
          `¿Enviar presupuesto de ${formatMoneyEs(price)}?`,
        buttons: [
          { id: `mant_ok_${plan.id}_${draft.id}`, title: 'Aprobar y enviar' },
          { id: `mant_later_${plan.id}_${draft.id}`, title: 'Posponer 30d' },
          { id: `mant_cancel_${plan.id}_${draft.id}`, title: 'Cancelar plan' },
        ],
      });
      waNote = result.ok
        ? 'WA al pro enviado'
        : `WA al pro falló (${(result as { reason?: string }).reason || 'meta_error'}) — el borrador queda en Presupuestos`;
    }

    await prisma.maintenancePlan.update({
      where: { id: plan.id },
      data: {
        lastProposedAt: now,
        // Checkpoint de reintento: si el pro no contesta, el 90d/cliente manda.
        nextDueAt: new Date(now.getTime() + PROPOSAL_COOLDOWN_DAYS * DAY_MS),
      },
    });

    recordCustomerEvent({
      merchantId: plan.merchantId,
      customerId: plan.customerId,
      type: 'maintenance_proposed',
      title: `🔧 Propuesta de mantenimiento: ${plan.title}`,
      detail: `Borrador #${quoteNumber} creado (${formatMoneyEs(price)}) · ${waNote}`,
    });

    proposed += 1;
    console.log(`[maintenance] plan ${plan.id} → draft #${quoteNumber} (${waNote})`);
  }

  return { due: due.length, proposed, skipped };
}

// 3) Respuesta del PRO a los botones (webhook). El teléfono del emisor debe ser
// el whatsappPhone del merchant dueño del plan — nadie más maneja el ciclo.
export async function handleMaintenanceButton(
  fromPhone: string,
  action: 'ok' | 'later' | 'cancel',
  planId: number,
  draftQuoteId: number,
): Promise<boolean> {
  const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
  if (!plan) return false;

  const merchant = await prisma.merchant.findUnique({
    where: { id: plan.merchantId },
    select: { id: true, country: true, flags: true, whatsappPhone: true },
  });
  if (!merchant) return false;
  const proPhone = normalizePhone(merchant.whatsappPhone);
  if (!proPhone || normalizePhone(fromPhone) !== proPhone) {
    console.warn(`[maintenance] botón de ${maskPhone(fromPhone)} ignorado: no es el pro del plan ${planId}`);
    return false;
  }
  if (!isFlagEnabled('MAINTENANCE_ENABLED', { merchant })) return false;

  const draft = await prisma.quote.findFirst({
    where: { id: draftQuoteId, merchantId: plan.merchantId, origin: 'maintenance' },
  });

  const replyToPro = (text: string) =>
    sendWhatsAppText({ to: proPhone, text, merchantId: plan.merchantId }).catch(() => null);

  if (action === 'ok') {
    if (!draft) {
      await replyToPro('Ese borrador ya no existe (¿lo gestionaste desde el panel?).');
      return true;
    }
    const result = await sendQuoteWhatsAppToCustomer(draft.id, plan.merchantId);
    await prisma.maintenancePlan.update({
      where: { id: plan.id },
      data: { rejectedStreak: 0, nextDueAt: addMonths(new Date(), plan.intervalMonths) },
    });
    if (result.ok) {
      await replyToPro(`✅ Presupuesto #${draft.quoteNumber ?? draft.id} enviado al cliente. Próxima revisión: en ${plan.intervalMonths} meses.`);
    } else {
      await replyToPro(`⚠️ No se pudo enviar por WhatsApp (${result.reason}). El borrador sigue en tu panel de Presupuestos para reintentarlo.`);
    }
    return true;
  }

  if (action === 'later') {
    const streak = plan.rejectedStreak + 1;
    const paused = streak >= MAX_REJECTED_STREAK;
    await prisma.maintenancePlan.update({
      where: { id: plan.id },
      data: {
        rejectedStreak: streak,
        active: paused ? false : plan.active,
        nextDueAt: new Date(Date.now() + POSTPONE_DAYS * DAY_MS),
      },
    });
    if (draft && draft.status === 'draft') {
      await prisma.quote.delete({ where: { id: draft.id } }).catch(() => null);
    }
    await replyToPro(
      paused
        ? '⏸ Pospuesto. Tras dos aplazamientos seguidos el plan queda en pausa — no se vuelve a proponer solo.'
        : `⏸ Pospuesto ${POSTPONE_DAYS} días.`,
    );
    return true;
  }

  // cancel
  await prisma.maintenancePlan.update({ where: { id: plan.id }, data: { active: false } });
  if (draft && draft.status === 'draft') {
    await prisma.quote.delete({ where: { id: draft.id } }).catch(() => null);
  }
  await replyToPro('✔️ Plan de mantenimiento cancelado.');
  return true;
}

// A15.3 — € COBRADOS con origin='maintenance' en el mes dado (justificantes/
// facturas pagadas cuyas quotes nacieron del ciclo).
export async function maintenanceEurInMonth(merchantId: number, monthStart: Date): Promise<number> {
  const monthEnd = addMonths(monthStart, 1);
  const rows = await prisma.invoice.findMany({
    where: {
      merchantId,
      status: 'paid',
      paidAt: { gte: monthStart, lt: monthEnd },
      quote: { origin: 'maintenance' },
    },
    select: { total: true },
  });
  return rows.reduce((acc, r) => acc + Number(r.total), 0);
}

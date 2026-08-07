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
import { recordCustomerEvent, existeEventoDePlan } from '../../system/customerEvents.service';
import { normalizePhone, formatMoneyEs, maskPhone } from '../../../core/utils/utils';
import { allocateQuoteNumber } from '../../quotes/domain/quoteNumber.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const PROPOSAL_COOLDOWN_DAYS = 90; // 1 propuesta/cliente/90d (spec literal)
const POSTPONE_DAYS = 30;
const MAX_REJECTED_STREAK = 2; // 2 rechazos seguidos → pausa

// ── SCRUM-394 · EL AVISO DE QUE EL PLAN NO SE PROPONE ────────────────────────────────────────
//
// **APROBADO por el fundador el 7-ago-2026**, con la condición de verificar cada afirmación contra
// el mecanismo antes de escribirla. Las tres se verificaron:
//
//   · «no recibe mensajes de WhatsApp» — `whatsapp.ts:251-253` bloquea el envío a un número con
//     `waOptOut` para ese merchant y devuelve `wa_opt_out`. Es el canal, no el cliente.
//   · «el mantenimiento sigue vivo» — cierto, y **solo lo es porque NO se reprograma**: el plan
//     queda `active: true` con `nextDueAt` en el pasado, así que el `where` del cron lo recoge
//     otra vez al día siguiente. Si esta rama pasara a reprogramar, esta frase dejaría de ser
//     cierta y hay que reescribirla.
//   · «tendrás que llegar a él por otra vía» — el opt-out es del canal de WhatsApp; nada impide
//     llamarle. Por eso se le dice: la alternativa existe y es suya.
//
// ⚠️ Es información del CLIENTE, y el sujeto de las dos frases es el MANTENIMIENTO, no él. No se
// reprocha nada ni se le atribuye intención: se dice qué pasa con su plan y qué puede hacer.
const EVENTO_SIN_CANAL = 'maintenance_sin_canal';
const TITULO_SIN_CANAL = 'Mantenimiento no propuesto';
const DETALLE_SIN_CANAL =
  'Este cliente no recibe mensajes de WhatsApp. El mantenimiento sigue vivo: si quieres '
  + 'proponérselo, tendrás que llegar a él por otra vía.';

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
/**
 * Dependencias del aviso, inyectables y **con default al real**: en producción nadie las pasa.
 *
 * Es el patrón que la casa ya declara (`tests/_audit-log-sync.mjs:66`, `_merchant-fixture.mjs:332`:
 * «va por parámetro con default al real… así un test puede inyectar un doble y comprobar que el
 * REGISTRO ocurre, sin BD y sin gate»). Aquí hace falta por lo mismo: lo que SCRUM-394 tiene que
 * demostrar es que **queda un evento**, y eso es un EFECTO, no una decisión. Sin esto, la garantía
 * principal del ticket viviría fuera de `npm test`, detrás de un turno de staging.
 */
export type DepsAviso = {
  recordCustomerEvent: typeof recordCustomerEvent;
  existeEventoDePlan: typeof existeEventoDePlan;
};

const DEPS_REALES: DepsAviso = { recordCustomerEvent, existeEventoDePlan };

/**
 * SCRUM-394 · El aviso de que un plan vencido no se propone porque su cliente no tiene canal.
 *
 * Vive APARTE del bucle a propósito, y no por estilo: el encargo dice que no se toque el mecanismo
 * de propuesta, así que lo que se extrae es **solo esta rama**. El bucle la llama y sigue igual.
 *
 * @returns `true` si ha registrado el aviso; `false` si el episodio ya estaba avisado.
 */
export async function avisarPlanSinCanal(
  plan: { id: number; merchantId: number; lastProposedAt: Date | null },
  customerId: number,
  deps: DepsAviso = DEPS_REALES,
): Promise<boolean> {
  // UNA VEZ POR EPISODIO, no una por ejecución: un cron diario grabando lo mismo llenaría la ficha
  // del cliente de entradas idénticas. El episodio se cierra solo cuando el plan vuelve a
  // proponerse —o sea, cuando el cliente vuelve—, y eso es justo lo que marca `lastProposedAt`:
  // los avisos anteriores quedan detrás y un opt-out posterior vuelve a avisar, porque ya es otro
  // episodio. `lastProposedAt` solo se LEE aquí; el anti-spam no se toca.
  const yaAvisado = await deps.existeEventoDePlan(
    plan.merchantId, customerId, EVENTO_SIN_CANAL, plan.id, plan.lastProposedAt,
  );
  if (yaAvisado) return false;
  await deps.recordCustomerEvent({
    merchantId: plan.merchantId,
    customerId,
    type: EVENTO_SIN_CANAL,
    title: TITULO_SIN_CANAL,
    detail: DETALLE_SIN_CANAL,
    // `planId` en `meta` es lo que permite distinguir episodios de dos planes del mismo cliente
    // sin añadir una columna: el schema es territorio del fundador.
    meta: { planId: plan.id },
  });
  return true;
}

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
    // ── SCRUM-394 · NO SE PROPONE, PERO SE DICE ──────────────────────────────────────────
    //
    // Respeta waOptOut: sin canal con el cliente el ciclo no propone (si vuelve, se retoma).
    // Eso era correcto y sigue igual. Lo que fallaba es que **no se decía**: el plan quedaba
    // `active` con `nextDueAt` en el pasado, saltándose cada día, y el único rastro era el
    // `skipped` que va al LOG DEL CRON — que el profesional no ve jamás. Dos situaciones muy
    // distintas —«todavía no le toca» y «se paró por el opt-out de otro»— producían la misma
    // bandeja vacía.
    //
    // 🔴 EL `continue` NO SE TOCA, Y NO ES PEREZA. Se estudió reprogramar `nextDueAt` como hace
    // la rama del cooldown tres líneas más abajo, y **no encaja**, por dos motivos medidos:
    //
    //   1. El cooldown caduca SOLO, por tiempo: `resumeAt = last + 90d` es calculable. El
    //      opt-out caduca cuando el cliente vuelve a darse de alta — un evento externo e
    //      impredecible. No hay `resumeAt` que calcular.
    //   2. Reprogramar rompería la propiedad que este comentario declara. Hoy «si vuelve, se
    //      retoma» es cierto PRECISAMENTE porque `nextDueAt` se queda en el pasado y el cron
    //      reevalúa el plan cada día. Con una fecha futura, el plan dormiría hasta ella aunque
    //      el cliente volviera al día siguiente: se retrasaría el ciclo del profesional por una
    //      decisión del cliente **que ya se había revertido**.
    //
    // Así que el plan sigue vivo y lo que se añade es la VOZ, con el mecanismo que este mismo
    // bucle ya usa cuando sí propone: un `CustomerEvent`, que el profesional lee en la ficha de
    // ese cliente (`customersAdmin.routes.ts` → `customerDetailView.js`).
    //
    // ⚠️ Es CONSULTABLE, no una notificación: solo lo ve quien entra en esa ficha. Que se entere
    // sin ir a buscarlo es superficie nueva y otro ticket (no hay pantalla de planes: las rutas
    // de mantenimiento solo tienen POST y DELETE).
    if (customer.waOptOut) {
      await avisarPlanSinCanal(plan, customer.id);
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

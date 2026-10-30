import { prisma } from '../../../core/db/prisma';
import { sendWhatsAppTemplate, MOTIVO_TOPE_NO_COMPROBABLE } from '../../../integrations/whatsapp';
import { buildQuoteDecision } from '../../../integrations/whatsappTemplates';
import { recordCustomerEvent } from '../../system/customerEvents.service';
import { canalDeWhatsApp } from '../../../core/contacto/canalDeWhatsApp'; // SCRUM-590 (CONT-19)
import { ensureQuoteDecisionToken } from './quoteToken.service'; // SCRUM-95

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Los bloqueos que SE PASAN SOLOS: el tope de plantillas (por cliente o por comercio, y el que no se
 * pudo comprobar) vuelve a tener hueco al día siguiente. SCRUM-1509 c.18881 (b): con ellos el
 * candado NO se queda puesto, y el recordatorio se reintenta en la pasada siguiente. Ninguno ha
 * llegado a Meta: `sendWhatsAppTemplate` los corta antes.
 *
 * ⚠️ «No salió» no basta para reintentar, y por eso no se libera ante cualquier fallo como en
 * facturas: este cron es HORARIO y el lote coge 50 sin orden. Un bloqueo que no se pasa solo (la
 * baja, el demo, sin credenciales, plantilla rechazada) liberado cada hora ocuparía el lote para
 * siempre y escribiría un aviso por hora en la ficha. Y un error de Meta sin respuesta puede haber
 * SALIDO: reintentarlo cada hora es el bucle que este ticket cierra, por otra puerta. Esos se quedan
 * como antes: un intento, un aviso.
 */
const BLOQUEOS_DEL_TOPE: ReadonlySet<string> = new Set(['customer_daily_cap', 'daily_cap', MOTIVO_TOPE_NO_COMPROBABLE]);

export async function sendPendingReminders(): Promise<void> {
  const cutoff = new Date(Date.now() - REMINDER_AFTER_MS);

  const quotes = await prisma.quote.findMany({
    where: {
      status: 'sent',
      reminderSentAt: null,
      updatedAt: { lte: cutoff },
    },
    include: {
      // SCRUM-590 (CONT-19): el select TRAE EL MÓVIL. Sin esta línea el resolvedor lo recibiría
      // undefined y el recordatorio se iría al fijo — en silencio y sin fallar nada.
      customer: { select: { name: true, phone: true, mobile: true } },
      merchant: { select: { name: true, logoUrl: true } },
    },
    take: 50, // procesar en lotes
  });

  if (!quotes.length) return;

  console.log(`[reminder] ${quotes.length} cotización(es) sin respuesta >24h`);

  // SCRUM-1586 (fundador, «A + E», SCRUM-1508 c.20470; forma de SCRUM-1509 c.18881): el candado se
  // RESERVA ANTES de enviar. Antes se escribía DESPUÉS, con el error tragado: si esa escritura
  // fallaba, el presupuesto seguía «sin recordar» y este cron HORARIO lo volvía a mandar (48
  // plantillas en 48 h al mismo cliente, SCRUM-1509 c.18879). Si no se puede anotar, no se envía.
  // Misma forma que facturas (SCRUM-1509j, `invoiceReminder.service.ts`).
  for (const quote of quotes) {
    const phone = canalDeWhatsApp(quote.customer);
    if (!phone) {
      await markReminded(quote.id);
      continue;
    }

    if (!(await reservarCandado(quote.id, quote.merchantId))) continue;

    const customerName = quote.customer?.name || 'Cliente';
    const merchantName = quote.merchant?.name || 'Tu proveedor';
    // Qué se hace con el candado al acabar. Por defecto se queda puesto: como antes, un intento.
    let reintentar = false;

    try {
      // Reusa quote_decision_es como recordatorio (estructura en whatsappTemplates.ts)
      // SCRUM-95: token opaco — el envío inicial ya debería haberlo creado, pero
      // ensureQuoteDecisionToken es idempotente/perezosa: lo genera si por lo que sea no existe.
      const decisionToken = await ensureQuoteDecisionToken(quote.id, prisma);
      const result: { ok: boolean; reason?: string; error?: unknown } = await sendWhatsAppTemplate({
        to: phone,
        merchantId: quote.merchantId, // J3: respeta waOptOut
        // SCRUM-1586 · SCRUM-1509 c.18881 (a): con el cliente, el tope por cliente y día se le evalúa.
        log: { customerId: quote.customerId, relatedType: 'quote', relatedId: quote.id },
        ...buildQuoteDecision({
          customerName,
          businessName: merchantName,
          quoteNumber: quote.quoteNumber ?? quote.id, // A1.2: número visible por merchant
          amount: Number(quote.total), // SCRUM-931: en bruto; la forma la da el builder
          currency: quote.currency,
          decisionToken, // SCRUM-95: token opaco, no el id global
        }),
      });

      if (result.ok) {
        console.log(`[reminder] OK → quote #${quote.id}`); // SCRUM-101: sin nombre del cliente en el log; el id ya identifica el registro
      } else {
        console.error(`[reminder] WA error → quote #${quote.id}:`, result.error ?? result.reason);
        // A20.5 (J5): el fallo del cron queda REGISTRADO y visible en el BO (360)
        recordCustomerEvent({
          merchantId: quote.merchantId,
          customerId: quote.customerId,
          type: 'wa_send_failed',
          title: '⚠️ Recordatorio de presupuesto no entregado por WhatsApp',
          detail: `Presupuesto #${quote.quoteNumber ?? quote.id} · el enlace sigue activo — envíaselo por email o SMS desde el detalle`,
        });
        if (result.reason && BLOQUEOS_DEL_TOPE.has(result.reason)) reintentar = true;
      }
    } catch (err: any) {
      // Una excepción sale ANTES de Meta (token, baja, plantilla): `sendWhatsAppTemplate` captura la
      // llamada a Meta y devuelve. No salió nada, así que se reintenta en la pasada siguiente.
      console.error(`[reminder] excepción → quote #${quote.id}:`, err?.message);
      reintentar = true;
    }

    if (reintentar) await liberarCandado(quote.id, quote.merchantId);
  }
}

/**
 * Pone el candado SI sigue libre, y dice si lo ha puesto. `false` = no se envía: o no se pudo
 * escribir (la base falla) o ya lo había puesto otra pasada (dos instancias del cron). Filtra por
 * `merchantId` además del id (regla 2): el cron recorre todos los comercios.
 */
async function reservarCandado(quoteId: number, merchantId: number): Promise<boolean> {
  try {
    const { count } = await prisma.quote.updateMany({
      where: { id: quoteId, merchantId, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    return count === 1;
  } catch (e: any) {
    console.error(`[reminder] no se pudo reservar el candado de quote #${quoteId}; NO se envía (SCRUM-1586):`, e?.message);
    return false; // sin anotar no se envía
  }
}

/**
 * El envío no salió por un bloqueo que se pasa solo: el candado vuelve a null y la pasada siguiente
 * lo reintenta. Si tampoco se puede escribir eso, se queda puesto y ese recordatorio NO se reenvía:
 * es el lado seguro de «si no puede anotar, se para» (c.20470), y se dice aquí.
 */
async function liberarCandado(quoteId: number, merchantId: number): Promise<void> {
  try {
    await prisma.quote.updateMany({
      where: { id: quoteId, merchantId, reminderSentAt: { not: null } },
      data: { reminderSentAt: null },
    });
  } catch (e: any) {
    console.error(`[reminder] no se pudo liberar el candado de quote #${quoteId}; ese recordatorio NO se reintentará (SCRUM-1586):`, e?.message);
  }
}

/** Sin canal no hay envío: se marca para no volver a mirarlo. Si falla, no sale nada igualmente. */
async function markReminded(quoteId: number) {
  await prisma.quote.update({
    where: { id: quoteId },
    data: { reminderSentAt: new Date() },
  }).catch((e) => console.error(`[reminder] error marcando quote #${quoteId}:`, e?.message));
}

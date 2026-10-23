/**
 * Recordatorios automáticos de facturas impagadas.
 *
 * - Día 7:  primera notificación suave ("no olvides pagar")
 * - Día 14: segunda notificación más urgente
 *
 * Se usa la plantilla payment_request_es (ya aprobada en Meta) cuando la
 * factura tiene un charge con URL de pago. Si no, se envía un texto libre.
 *
 * ⚠️ CORREGIDO (SCRUM-116): este comentario decía «el cron ejecuta esto cada hora». Es
 * FALSO — corre UNA VEZ AL DÍA a las 10:00 (`cron.schedule('0 10 * * *')`, core/cron/cron.ts).
 * No es una errata inocente: sobre esa cifra se diseñó mal la política de reintentos de este
 * mismo ticket, hasta que se leyó el cron. Un comentario que afirma un hecho sobre el
 * comportamiento del sistema no se ejecuta nunca, así que nada lo desmiente: verifícalo
 * contra el código antes de diseñar sobre él.
 *
 * `reminder7SentAt` / `reminder14SentAt` son los candados de idempotencia. Desde SCRUM-116
 * significan **«se envió»**, no «se intentó»: si el envío falla NO se marcan, y el cron
 * vuelve a intentarlo en la pasada del día siguiente. Esa cadencia diaria ES el backoff —
 * no hace falta contador ni espaciado.
 */
import { prisma } from '../../../core/db/prisma';
import { sendWhatsAppWindowFirst, sendWhatsAppText } from '../../../integrations/whatsapp';
import { buildPaymentRequest } from '../../../integrations/whatsappTemplates';
import { formatMoneyEs } from '../../../core/utils/utils';
import { canalDeWhatsApp } from '../../../core/contacto/canalDeWhatsApp'; // SCRUM-590 (CONT-19)
import { BASE_URL } from '../../../core/config/env';
import { isReceiptNumber, appendStageLabel } from '../../invoicing/domain/invoiceNumber.service';
import { recordCustomerEvent } from '../../system/customerEvents.service';
import { ensureChargeReceiptToken } from '../../../lib/invoicing';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function sendInvoicePaymentReminders(): Promise<void> {
  const now   = new Date();
  const cut7  = new Date(now.getTime() - 7  * DAY_MS);
  const cut14 = new Date(now.getTime() - 14 * DAY_MS);

  // ── Recordatorios de 7 días ─────────────────────────────────────────────
  const toRemind7 = await prisma.invoice.findMany({
    where: {
      status: 'pending',
      createdAt: { lte: cut7 },
      reminder7SentAt: null,
      // SCRUM-116: el opt-out se filtra AQUÍ, no se trata como un fallo de envío. Enviar a
      // quien se dio de baja no es «reintentar de más»: es un problema legal (J3). Además,
      // resolverlo en la consulta mantiene honesto el candado — `reminderXSentAt` sigue
      // significando «se envió» y no hay que marcarlo en falso para evitar el reintento.
      // SCRUM-590 (CONT-19): «tiene canal» pasa a ser «tiene ALGUNO de los dos». Con solo
      // phone: { not: null } un cliente que únicamente tenga móvil quedaría fuera del lote
      // y no recibiría NUNCA su recordatorio, sin que nada lo dijera.
      customer: { OR: [{ phone: { not: null } }, { mobile: { not: null } }], waOptOut: false },
    },
    include: {
      customer: true,
      merchant: { select: { name: true, whatsappPhone: true } },
      charge: true,
    },
    take: 50,
  });

  // ── Recordatorios de 14 días ────────────────────────────────────────────
  const toRemind14 = await prisma.invoice.findMany({
    where: {
      status: 'pending',
      createdAt: { lte: cut14 },
      reminder14SentAt: null,
      // reminder7SentAt puede ser null si el cliente no tiene WA → no bloquear el de 14d
      customer: { OR: [{ phone: { not: null } }, { mobile: { not: null } }], waOptOut: false }, // SCRUM-116 (J3) + SCRUM-590 (CONT-19), ver arriba
    },
    include: {
      customer: true,
      merchant: { select: { name: true, whatsappPhone: true } },
      charge: true,
    },
    take: 50,
  });

  const total7  = toRemind7.length;
  const total14 = toRemind14.length;
  if (!total7 && !total14) return;

  console.log(`[invoiceReminder] ${total7} recordatorio(s) 7d, ${total14} recordatorio(s) 14d`);

  // SCRUM-1509j (fundador, «A + E», SCRUM-1508 c.20470): el candado se RESERVA ANTES de enviar.
  // Antes se escribía DESPUÉS, con el error tragado: si esa escritura fallaba, la factura seguía
  // «sin recordar» y el cron la volvía a mandar cada día (60 plantillas en 30 días, SCRUM-1509b).
  // Si no se puede anotar, no se envía. Y SCRUM-116 sigue: si el envío falla, la reserva se
  // libera y la factura vuelve a entrar mañana.
  for (const [lote, campo, day] of [[toRemind7, 'reminder7SentAt', 7], [toRemind14, 'reminder14SentAt', 14]] as const) {
    for (const inv of lote) {
      if (!(await reservarCandado(inv.id, campo))) continue;
      if (await sendReminderWA(inv, day)) continue;
      await liberarCandado(inv.id, campo);
    }
  }
}

type Candado = 'reminder7SentAt' | 'reminder14SentAt';

/**
 * Pone el candado SI sigue libre, y dice si lo ha puesto. `false` = no se envía: o no se pudo
 * escribir (la base falla) o ya lo había puesto otra pasada (dos instancias del cron).
 */
async function reservarCandado(id: number, campo: Candado): Promise<boolean> {
  try {
    const { count } = await prisma.invoice.updateMany({
      where: { id, [campo]: null },
      data: { [campo]: new Date() },
    });
    return count === 1;
  } catch (e: any) {
    console.error(`[invoiceReminder] no se pudo reservar ${campo} de inv #${id}; NO se envía (SCRUM-1509j):`, e?.message);
    return false; // sin anotar no se envía
  }
}

/**
 * El envío falló: devuelve el candado a null para que mañana se reintente (SCRUM-116). Si
 * tampoco se puede escribir eso, el candado se queda puesto y ese aviso NO se reenvía: es el
 * lado seguro de «si no puede anotar, se para» (SCRUM-1509j), y se dice aquí.
 */
async function liberarCandado(id: number, campo: Candado): Promise<void> {
  try {
    await prisma.invoice.updateMany({
      where: { id, [campo]: { not: null } },
      data: { [campo]: null },
    });
  } catch (e: any) {
    console.error(`[invoiceReminder] no se pudo liberar ${campo} de inv #${id}; ese aviso NO se reintentará (SCRUM-1509j):`, e?.message);
  }
}

/**
 * Envía un recordatorio y dice SI SALIÓ.
 *
 * ⚠️ Antes devolvía `void`: sabía el resultado (`result.ok`), lo logueaba… y lo tiraba. El
 * bucle que llama no tenía con qué decidir, así que marcaba el candado siempre. Devolver el
 * desenlace es la mitad estructural del arreglo de SCRUM-116 — sin esto no hay `if` posible.
 *
 * @returns `true` solo si el mensaje salió de verdad.
 */
async function sendReminderWA(
  inv: {
    id: number;
    merchantId: number;
    customerId: number;
    number: string;
    total: { toString(): string };
    currency: string;
    chargeId: number | null;
    charge: { id: number } | null;
    customer: { name: string; phone: string | null; mobile?: string | null } | null; // SCRUM-590 (CONT-19)
    merchant: { name: string } | null;
    stageLabel: string | null; // SCRUM-33
  },
  day: 7 | 14,
): Promise<boolean> {
  const phone = canalDeWhatsApp(inv.customer);
  if (!phone) return false; // sin teléfono no hay envío: no se marca (SCRUM-116)

  const customerName  = inv.customer?.name  || 'Cliente';
  const merchantName  = inv.merchant?.name  || 'tu proveedor';
  // SCRUM-931 · la forma de la casa, UNA vez. Este fichero era el caso más claro del defecto: el
  // texto de ventana (abajo) mandaba `419.87 EUR` y el botón de ventana, en la rama de al lado,
  // `419,87 €`. Mismo recordatorio, mismo cliente, mismo día: dos formatos según la rama.
  const importe       = formatMoneyEs(inv.total, inv.currency);
  const chargeId      = inv.chargeId ?? inv.charge?.id ?? null;
  // Regla 24/26: un J-… es un JUSTIFICANTE — el copy propio nunca dice "factura" pre-SIF
  const docLabel      = isReceiptNumber(inv.number) ? 'justificante' : 'factura';
  const urgency       = day === 14 ? '\nPor favor, complétalo a la mayor brevedad posible.' : '';

  try {
    if (chargeId) {
      // SCRUM-85: token OPACO del cobro (Charge.receiptToken) — NUNCA el chargeId en la URL pública.
      const payToken = await ensureChargeReceiptToken(chargeId, prisma);
      // A5.2 ventana-first: si el cliente interactuó hace <24 h el recordatorio
      // viaja como texto gratis; si no, plantilla payment_request_es (botón de pago).
      const result = await sendWhatsAppWindowFirst({
        to: phone,
        merchantId: inv.merchantId, // J3: respeta waOptOut
        customerId: inv.customerId,
        windowText:
          `Hola ${customerName} 👋\n` +
          `Te recordamos que tienes pendiente el pago del ${docLabel} ${appendStageLabel(inv.number, inv.stageLabel)} ` +
          `por ${importe} de parte de ${merchantName}.${urgency}\n` +
          `Paga de forma segura desde aquí 👇\n` +
          `${BASE_URL}/pay/invoice/${payToken}\n` +
          `Si ya lo has pagado, ignora este mensaje. ¡Gracias!`,
        // A23: en ventana → botón-enlace "Pagar ahora" (sin URL cruda, dinero es-ES)
        windowCta: {
          bodyText:
            `Hola ${customerName} 👋\n` +
            `Te recordamos el pago pendiente del ${docLabel} ${appendStageLabel(inv.number, inv.stageLabel)} por *${importe}* de parte de *${merchantName}*.${urgency}\n` +
            `Si ya lo has pagado, ignora este mensaje. ¡Gracias!`,
          buttonText: 'Pagar ahora',
          url: `${BASE_URL}/pay/invoice/${payToken}`,
        },
        // SCRUM-33: sin variable nueva en la plantilla Meta — el label viaja dentro
        // del valor de invoiceNumber (ya es una variable propia de la plantilla).
        template: buildPaymentRequest({
          customerName,
          businessName: merchantName,
          invoiceNumber: appendStageLabel(inv.number, inv.stageLabel),
          amount: Number(inv.total.toString()), // SCRUM-931: en bruto; la forma la da el builder
          currency: inv.currency,
          urlToken: payToken,
        }),
        log: { customerId: inv.customerId, relatedType: 'invoice', relatedId: inv.id },
      });
      if (result.ok) {
        console.log(`[invoiceReminder] ✓ ${day}d vía ${result.via} → inv #${inv.number}`); // SCRUM-101: sin nombre del cliente
        return true;
      } else {
        console.error(`[invoiceReminder] WA error ${day}d → inv #${inv.number}:`, result.error || result.reason);
        // A20.5 (J5): el fallo del cron queda REGISTRADO y visible en el BO (360)
        recordCustomerEvent({
          merchantId: inv.merchantId,
          customerId: inv.customerId,
          type: 'wa_send_failed',
          title: `⚠️ Recordatorio de cobro (${day} días) no entregado por WhatsApp`,
          detail: `${docLabel} ${inv.number} · el enlace sigue activo — envíaselo por email o SMS desde el detalle`,
        });
        return false; // SCRUM-116: NO se marca el candado → mañana se reintenta
      }
    } else {
      // Sin charge → texto libre (solo entrega dentro de ventana 24h)
      // SCRUM-116: esta rama loguéaba «✓ texto» SIN MIRAR el retorno, y no registraba el
      // fallo — la misma función tenía una rama honesta (plantilla) y otra que se felicitaba.
      const result = await sendWhatsAppText({
        to: phone,
        merchantId: inv.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
        text: `Hola ${customerName} 👋, te recordamos que tienes pendiente el pago del ${docLabel} *${inv.number}* por *${importe}* de parte de *${merchantName}*.\n${urgency}\nSi ya has realizado el pago, por favor ignora este mensaje. ¡Gracias!`,
      });
      if (result?.ok) {
        console.log(`[invoiceReminder] ✓ texto ${day}d → inv #${inv.number}`); // SCRUM-101: sin nombre del cliente
        return true;
      }
      console.error(`[invoiceReminder] texto ${day}d NO entregado → inv #${inv.number}:`, (result as any)?.error || (result as any)?.reason);
      // Mismo rastro que la rama de plantilla: el fallo se ve en el 360 del cliente (A20.5/J5).
      recordCustomerEvent({
        merchantId: inv.merchantId,
        customerId: inv.customerId,
        type: 'wa_send_failed',
        title: `⚠️ Recordatorio de cobro (${day} días) no entregado por WhatsApp`,
        detail: `${docLabel} ${inv.number} · el enlace sigue activo — envíaselo por email o SMS desde el detalle`,
      });
      return false;
    }
  } catch (err: any) {
    console.error(`[invoiceReminder] excepción ${day}d → inv #${inv.number}:`, err?.message);
    return false; // SCRUM-116: una excepción NO es un envío — no se marca el candado
  }
}

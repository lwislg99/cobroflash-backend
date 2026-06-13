// WA-0b (master J4) — Log y estados de entrega de mensajes de WhatsApp.
// TOLERANTE: si la tabla `whatsapp_messages` aún no existe en prod (db push pendiente),
// cada función captura el error y la app sigue funcionando (patrón ENT-3). Así el código
// se puede desplegar ANTES de aplicar la migración, sin romper el envío de mensajes.
import { prisma } from '../../../core/db/prisma';

// Coste estimado por plantilla Utility en España (tarifas Meta 2026, master J1 ~0,023 €).
// Los service messages (dentro de ventana 24h) son gratis.
export const WA_UTILITY_COST_ES = 0.023;

export type WaMsgType = 'template' | 'service';
export type WaRelatedType = 'quote' | 'invoice' | 'charge';

export interface RecordWaMessageInput {
  merchantId: number;
  customerId?: number | null;
  type: WaMsgType;
  templateName?: string | null;
  waMessageId?: string | null;
  status?: string;            // default 'sent' al registrar un envío OK
  error?: string | null;
  relatedType?: WaRelatedType | null;
  relatedId?: number | null;
  costEstimate?: number | null;
}

/** Registra un mensaje enviado (o fallido). Fire-and-forget: nunca lanza. */
export async function recordWaMessage(input: RecordWaMessageInput): Promise<void> {
  try {
    await prisma.whatsAppMessage.create({
      data: {
        merchantId: input.merchantId,
        customerId: input.customerId ?? null,
        type: input.type,
        templateName: input.templateName ?? null,
        waMessageId: input.waMessageId ?? null,
        status: input.status ?? 'sent',
        error: input.error ?? null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        costEstimate:
          input.costEstimate ??
          (input.type === 'template' ? WA_UTILITY_COST_ES : 0),
      },
    });
  } catch (err: any) {
    // Tabla aún no migrada en prod, u otro fallo: no romper el flujo de envío
    console.error('[WA-0b] recordWaMessage omitido:', err?.message || err);
  }
}

const STATUS_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };

/**
 * ¿Debe aplicarse la transición de `current` a `next`? `failed` siempre se aplica;
 * el resto solo avanza (un `delivered` que llega tras un `read` no degrada el estado,
 * y Meta puede entregar los callbacks fuera de orden). Pura → testeable sin BD.
 */
export function shouldApplyStatus(current: string, next: string): boolean {
  if (next === 'failed') return true;
  const cur = STATUS_RANK[current] ?? -1;
  const nxt = STATUS_RANK[next] ?? -1;
  return nxt > cur;
}

/**
 * Actualiza el estado de un mensaje por su waMessageId (webhook `statuses` de Meta).
 * Nunca retrocede el estado, salvo `failed`, que siempre se registra.
 */
export async function updateWaMessageStatus(
  waMessageId: string,
  status: string,
  error?: string | null,
): Promise<void> {
  if (!waMessageId) return;
  try {
    const existing = await prisma.whatsAppMessage.findUnique({
      where: { waMessageId },
      select: { id: true, status: true },
    });
    if (!existing) return; // mensaje no logueado (p. ej. enviado antes de WA-0b)

    if (!shouldApplyStatus(existing.status, status)) return;

    await prisma.whatsAppMessage.update({
      where: { waMessageId },
      data: { status, error: error ?? null },
    });
  } catch (err: any) {
    console.error('[WA-0b] updateWaMessageStatus omitido:', err?.message || err);
  }
}

/** Estado de entrega del último mensaje WhatsApp de un documento (chip de entrega, J4). */
export async function getDeliveryStatus(
  merchantId: number,
  relatedType: WaRelatedType,
  relatedId: number,
): Promise<{ status: string; templateName: string | null; at: Date } | null> {
  try {
    const last = await prisma.whatsAppMessage.findFirst({
      where: { merchantId, relatedType, relatedId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, templateName: true, updatedAt: true },
    });
    return last ? { status: last.status, templateName: last.templateName, at: last.updatedAt } : null;
  } catch (err: any) {
    console.error('[WA-0b] getDeliveryStatus omitido:', err?.message || err);
    return null;
  }
}

/** Extrae el waMessageId (wamid.*) de la respuesta de Meta al enviar. */
export function extractWaMessageId(data: any): string | null {
  return data?.messages?.[0]?.id ?? null;
}

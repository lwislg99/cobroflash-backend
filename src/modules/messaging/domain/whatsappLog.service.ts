// WA-0b (master J4) — Log y estados de entrega de mensajes de WhatsApp.
// TOLERANTE: si la tabla `whatsapp_messages` aún no existe en prod (db push pendiente),
// cada función captura el error y la app sigue funcionando (patrón ENT-3). Así el código
// se puede desplegar ANTES de aplicar la migración, sin romper el envío de mensajes.
import { prisma } from '../../../core/db/prisma';
import { normalizePhone } from '../../../core/utils/utils';

// Coste estimado por plantilla Utility en España (tarifas Meta 2026, master J1 ~0,023 €).
// Los service messages (dentro de ventana 24h) son gratis.
export const WA_UTILITY_COST_ES = 0.023;

// 'template' = plantilla pagada · 'service' = texto/interactivo en ventana (0 €) ·
// 'inbound' = mensaje ENTRANTE del cliente (A5.2: abre/renueva la ventana de 24 h)
export type WaMsgType = 'template' | 'service' | 'inbound';
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

// ── A5.2 · Ventana de servicio de 24 h (estrategia de coste ~0, Ola 5) ──────
// Cada mensaje ENTRANTE (texto, tap de quick reply/lista, audio…) abre o renueva la
// ventana de 24 h de ese número. Se registra una fila `type:'inbound'` por CADA
// merchant que tenga ese teléfono como cliente: el número de WhatsApp es compartido,
// así que la ventana es del PAR número↔cliente, no de un merchant concreto.

/** Margen de seguridad: tratamos la ventana como abierta solo hasta 23,5 h (no 24)
 *  para no intentar textos al filo del cierre; si aun así falla, hay fallback a plantilla. */
export const WA_WINDOW_SAFETY_MS = 23.5 * 3600 * 1000;

/** Registra un entrante del cliente (fire-and-forget: nunca lanza). */
export async function recordInboundWaMessage(rawPhone: string): Promise<void> {
  try {
    const phone = normalizePhone(rawPhone);
    if (!phone) return;
    // Mismo patrón de variantes que la identidad del bot (BD puede guardar con "+")
    const customers = await prisma.customer.findMany({
      where: { phone: { in: [phone, `+${phone}`] } },
      select: { id: true, merchantId: true },
    });
    if (!customers.length) return; // número sin cliente asociado: nada que abrir
    await prisma.whatsAppMessage.createMany({
      data: customers.map((c) => ({
        merchantId: c.merchantId,
        customerId: c.id,
        type: 'inbound',
        status: 'received',
        costEstimate: 0,
      })),
    });
  } catch (err: any) {
    console.error('[A5.2] recordInboundWaMessage omitido:', err?.message || err);
  }
}

/** ¿Está abierta la ventana de servicio con este cliente? (último inbound < 23,5 h) */
export async function isServiceWindowOpen(
  merchantId: number,
  customerId: number,
  now = new Date(),
): Promise<boolean> {
  try {
    const since = new Date(now.getTime() - WA_WINDOW_SAFETY_MS);
    const last = await prisma.whatsAppMessage.findFirst({
      where: { merchantId, customerId, type: 'inbound', createdAt: { gte: since } },
      select: { id: true },
    });
    return !!last;
  } catch (err: any) {
    console.error('[A5.2] isServiceWindowOpen omitido:', err?.message || err);
    return false; // ante la duda: plantilla (la entrega manda sobre el ahorro)
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

// ── J8 · Métricas de coste y entrega (F2-spec) ──────────────────────────────
// Por merchant/mes: enviados/entregados/leídos/fallidos + coste €; por plantilla:
// tasa de entrega; alerta si la tasa de entrega de los últimos 7 días < 90 %.
// La tabla guarda el ÚLTIMO estado de cada mensaje; el funnel se deriva: read⊃delivered⊃sent.

export interface WhatsAppMetrics {
  month: { sent: number; delivered: number; read: number; failed: number; total: number; costEur: number };
  byTemplate: Array<{ templateName: string; enviados: number; entregados: number; deliveryRate: number | null }>;
  alert: { active: boolean; deliveryRate7d: number | null; sample: number };
  // A5.4: plantilla (pagada) vs ventana (0 €) — el ahorro es argumento de venta interno
  channel: { templateToday: number; windowToday: number; windowMonth: number; savedEurMonth: number };
}

export const DELIVERED_OR_MORE = new Set(['delivered', 'read']);
export const SENT_OR_MORE = new Set(['sent', 'delivered', 'read']);

/** Pura (testeable): funnel derivado + coste a partir de filas {status, costEstimate}.
 *  `costEstimate` acepta number, Prisma Decimal o string (se normaliza con Number(String())). */
export function aggregateWaRows(
  rows: Array<{ status: string; costEstimate?: number | { toString(): string } | null }>,
) {
  const m = { sent: 0, delivered: 0, read: 0, failed: 0, total: rows.length, costEur: 0 };
  for (const r of rows) {
    if (r.status === 'failed') m.failed++;
    if (r.status === 'read') m.read++;
    if (DELIVERED_OR_MORE.has(r.status)) m.delivered++;
    if (SENT_OR_MORE.has(r.status)) m.sent++;
    m.costEur += Number(String(r.costEstimate ?? 0));
  }
  m.costEur = Math.round(m.costEur * 1000) / 1000;
  return m;
}

export async function getWhatsAppMetrics(merchantId: number, now = new Date()): Promise<WhatsAppMetrics> {
  const empty: WhatsAppMetrics = {
    month: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0, costEur: 0 },
    byTemplate: [],
    alert: { active: false, deliveryRate7d: null, sample: 0 },
    channel: { templateToday: 0, windowToday: 0, windowMonth: 0, savedEurMonth: 0 },
  };
  try {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const rows = await prisma.whatsAppMessage.findMany({
      where: { merchantId, type: 'template', createdAt: { gte: monthStart } },
      select: { status: true, templateName: true, costEstimate: true, createdAt: true },
    });

    // A5.4: envíos por ventana (type:'service', 0 €) del mes — cada uno es una
    // plantilla que NO se pagó (ventana-first A5.2/A5.3)
    const windowRows = await prisma.whatsAppMessage.findMany({
      where: { merchantId, type: 'service', createdAt: { gte: monthStart } },
      select: { createdAt: true },
    });
    const channel = {
      templateToday: rows.filter((r) => r.createdAt >= dayStart).length,
      windowToday: windowRows.filter((r) => r.createdAt >= dayStart).length,
      windowMonth: windowRows.length,
      savedEurMonth: Math.round(windowRows.length * WA_UTILITY_COST_ES * 1000) / 1000,
    };

    const m = aggregateWaRows(rows); // funnel + coste del mes
    const perTpl: Record<string, { enviados: number; entregados: number }> = {};
    let week = { enviados: 0, entregados: 0 };

    for (const r of rows) {
      const s = r.status;
      const tpl = r.templateName || '(desconocida)';
      if (!perTpl[tpl]) perTpl[tpl] = { enviados: 0, entregados: 0 };
      if (SENT_OR_MORE.has(s)) perTpl[tpl].enviados++;
      if (DELIVERED_OR_MORE.has(s)) perTpl[tpl].entregados++;

      if (r.createdAt >= weekAgo) {
        if (SENT_OR_MORE.has(s)) week.enviados++;
        if (DELIVERED_OR_MORE.has(s)) week.entregados++;
      }
    }

    const byTemplate = Object.entries(perTpl).map(([templateName, t]) => ({
      templateName,
      enviados: t.enviados,
      entregados: t.entregados,
      deliveryRate: t.enviados > 0 ? Math.round((t.entregados / t.enviados) * 100) : null,
    })).sort((a, b) => b.enviados - a.enviados);

    const rate7d = week.enviados > 0 ? Math.round((week.entregados / week.enviados) * 100) : null;
    // Alerta solo con muestra significativa (≥10 envíos en 7 días) para no avisar en vacío
    const alert = {
      active: rate7d !== null && week.enviados >= 10 && rate7d < 90,
      deliveryRate7d: rate7d,
      sample: week.enviados,
    };

    return { month: m, byTemplate, alert, channel };
  } catch (err: any) {
    console.error('[WA-0b/J8] getWhatsAppMetrics omitido:', err?.message || err);
    return empty;
  }
}

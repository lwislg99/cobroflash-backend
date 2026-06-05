// src/modules/system/customerEvents.service.ts
// ENT-3: historial de comunicaciones/actividad por cliente.
// Tanto el registro como el listado son tolerantes a fallos: si la tabla
// customer_events todavía no existe (antes de aplicar `prisma db push` en prod),
// no rompen el flujo principal.
import { prisma } from '../../core/db/prisma';

export type CustomerEventInput = {
  merchantId: number;
  customerId: number | null | undefined;
  type: string;
  title: string;
  detail?: string | null;
  meta?: any;
};

/** Registra un evento. Fire-and-forget: nunca lanza. */
export async function recordCustomerEvent(e: CustomerEventInput): Promise<void> {
  if (!e.customerId) return;
  try {
    await (prisma as any).customerEvent.create({
      data: {
        merchantId: e.merchantId,
        customerId: e.customerId,
        type: e.type,
        title: e.title,
        detail: e.detail ?? null,
        meta: e.meta ?? undefined,
      },
    });
  } catch (err: any) {
    console.error('[customerEvent] no registrado:', err?.message || err);
  }
}

/** Lista los eventos de un cliente (más recientes primero). Devuelve [] si falla. */
export async function listCustomerEvents(merchantId: number, customerId: number, take = 50) {
  try {
    return await (prisma as any).customerEvent.findMany({
      where: { merchantId, customerId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  } catch {
    return [];
  }
}

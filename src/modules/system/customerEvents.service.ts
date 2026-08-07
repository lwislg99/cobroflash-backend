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

/**
 * ¿Ya hay un evento de este tipo para este PLAN desde `desde`? (SCRUM-394)
 *
 * Sirve para registrar **una vez por episodio** en vez de una vez por ejecución del cron: un cron
 * diario grabando lo mismo llenaría la ficha del cliente de entradas idénticas, que es spam de otra
 * clase — y lo pagaría el profesional, que dejaría de leer su propia ficha.
 *
 * ⚠️ EL FILTRO POR PLAN SE HACE EN MEMORIA, y es deliberado. `meta` es un `Json` y Postgres sabe
 * consultarlo (`meta: { path: ['planId'] }`), pero eso ata este código al motor y falla distinto
 * cuando `meta` es `null`. Los eventos candidatos son pocos —un cliente tiene pocos planes y este
 * tipo se escribe una vez por episodio— así que traerlos y filtrarlos aquí es más barato de
 * entender y no depende del dialecto.
 *
 * 🔴 Y SI LA CONSULTA FALLA, DEVUELVE `false` — o sea, «no lo he visto, regístralo». La asimetría
 * es la del ticket: el defecto que se está arreglando es que el plan se para EN SILENCIO, así que
 * equivocarse hacia un evento duplicado cuesta una línea repetida en una ficha; equivocarse hacia
 * el silencio cuesta exactamente el defecto que veníamos a cerrar.
 */
export async function existeEventoDePlan(
  merchantId: number,
  customerId: number,
  type: string,
  planId: number,
  desde: Date | null | undefined,
): Promise<boolean> {
  try {
    const eventos = await (prisma as any).customerEvent.findMany({
      where: { merchantId, customerId, type, ...(desde ? { createdAt: { gt: desde } } : {}) },
      select: { meta: true },
      take: 50,
    });
    return eventos.some((e: any) => e?.meta && Number(e.meta.planId) === planId);
  } catch (err: any) {
    console.error('[customerEvent] no se pudo comprobar el episodio:', err?.message || err);
    return false; // hacia «regístralo», nunca hacia el silencio
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

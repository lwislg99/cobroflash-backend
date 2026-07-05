// src/modules/quotes/domain/expire.service.ts — A16.2 (EXT3 Ola 16)
// Presupuestos que caducan: sent + validUntil pasado → status 'expired'.
// El cron horario lo aplica; la landing N3 muestra el copy oficial de caducado
// y la decisión (aceptar/rechazar) queda bloqueada. Nada se borra jamás.
import { prisma } from '../../../core/db/prisma';
import { recordCustomerEvent } from '../../system/customerEvents.service';

export async function expireQuotes(now: Date = new Date()): Promise<number> {
  const stale = await prisma.quote.findMany({
    where: { status: 'sent', validUntil: { not: null, lt: now } },
    select: { id: true, merchantId: true, customerId: true, quoteNumber: true, validUntil: true },
    take: 200,
  });
  if (!stale.length) return 0;

  for (const q of stale) {
    await prisma.quote.update({ where: { id: q.id }, data: { status: 'expired' } });
    recordCustomerEvent({
      merchantId: q.merchantId,
      customerId: q.customerId,
      type: 'quote_expired',
      title: `⏳ Presupuesto #${q.quoteNumber ?? q.id} caducado`,
      detail: 'El cliente verá "pide uno actualizado" si abre el enlace. Duplícalo para reactivarlo.',
    });
  }
  console.log(`[expire] ${stale.length} presupuesto(s) sent → expired`);
  return stale.length;
}

// La landing y las decisiones usan esta única verdad (defensa entre pasadas del cron).
export function isQuoteExpired(q: { status?: string | null; validUntil?: Date | string | null }): boolean {
  if (q.status === 'expired') return true;
  if (q.status !== 'sent' || !q.validUntil) return false;
  return new Date(q.validUntil).getTime() < Date.now();
}

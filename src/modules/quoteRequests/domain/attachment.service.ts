// src/modules/quoteRequests/domain/attachment.service.ts — MEDIA-1 (FASE 3)
// Persistencia de adjuntos (hoy fotos) en Postgres (columna `data` bytea) al no
// haber R2. El modelo Attachment abstrae el backend: cambiar a R2 luego solo
// afecta a este servicio (guardar el binario fuera y dejar `url` apuntando ahí).
import { prisma } from '../../../core/db/prisma';

/**
 * Guarda una foto adjunta a una solicitud de presupuesto. Crea la fila con los
 * bytes y fija `url` a la ruta de servido `/admin/attachments/:id` (tenancy).
 */
export async function saveQuoteRequestPhoto(params: {
  merchantId: number;
  quoteRequestId: number;
  buffer: Uint8Array;
  mime: string;
}) {
  const { merchantId, quoteRequestId, buffer, mime } = params;
  const att = await prisma.attachment.create({
    data: {
      merchantId,
      entityType: 'quote_request',
      entityId: quoteRequestId,
      kind: 'photo',
      url: '', // se completa con el id justo debajo
      // Prisma tipa Bytes como Uint8Array<ArrayBuffer>; normalizamos por si llega un Buffer.
      data: new Uint8Array(buffer),
      mime,
    },
    select: { id: true },
  });
  const url = `/admin/attachments/${att.id}`;
  await prisma.attachment.update({ where: { id: att.id }, data: { url } });
  return { id: att.id, url };
}

/**
 * Lista los adjuntos de una solicitud SIN los bytes (solo metadatos para la
 * galería del BO). Filtra por merchant (multi-tenant).
 */
export async function listQuoteRequestAttachments(merchantId: number, quoteRequestId: number) {
  return prisma.attachment.findMany({
    where: { merchantId, entityType: 'quote_request', entityId: quoteRequestId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, url: true, kind: true, mime: true, createdAt: true },
  });
}

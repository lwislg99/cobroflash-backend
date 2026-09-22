// src/modules/system/domain/historialWhatsAppDelCliente.ts — SCRUM-1062 (CRM-19)
//
// QUÉ WHATSAPP SE LE HAN ENVIADO A UN CLIENTE, para su ficha. SOLO LECTURA: no manda nada, no
// toca plantillas ni `src/integrations/whatsapp.ts` (canal de J2). `WhatsAppMessage` ya guarda el
// estado de cada mensaje (SCRUM-WA-0b); esto es la primera vez que se lee POR CLIENTE en vez de
// por documento.
//
// 🔴 NO SE ENSEÑA TEXTO DE CONVERSACIÓN, porque no se guarda: la tabla solo tiene tipo, plantilla,
// estado y el documento relacionado. Enseñar lo que hay no es un recorte de este ticket — es todo
// lo que existe.
//
// `merchantId` en la consulta del cliente Y en la de los mensajes (regla 2): sin la segunda, un
// `customerId` que casara por número dejaría ver mensajes de un cliente de OTRO merchant.
import { prisma } from '../../../core/db/prisma';

const MENSAJES_POR_PAGINA = 20;

export interface OpcionesWhatsApp {
  /** Id del último mensaje de la página anterior. */
  despuesDe?: number | null;
}

/** `null` si el cliente no es de este merchant (la ruta responde 404). */
export async function historialWhatsAppDelCliente(
  merchantId: number,
  customerId: number,
  op: OpcionesWhatsApp = {},
) {
  const cliente = await prisma.customer.findFirst({
    where: { id: customerId, merchantId },
    select: { id: true, waOptOut: true },
  });
  if (!cliente) return null;

  const pagina = await prisma.whatsAppMessage.findMany({
    where: { merchantId, customerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: MENSAJES_POR_PAGINA + 1, // uno de más para saber si hay página siguiente, sin contar
    ...(op.despuesDe ? { cursor: { id: op.despuesDe }, skip: 1 } : {}),
    select: {
      id: true, type: true, templateName: true, status: true, error: true,
      relatedType: true, relatedId: true, createdAt: true,
    },
  });
  const hayMas = pagina.length > MENSAJES_POR_PAGINA;
  const mensajes = pagina.slice(0, MENSAJES_POR_PAGINA);

  return {
    // La baja de WhatsApp es del CLIENTE, no del mensaje: se enseña una vez, no por fila.
    waOptOut: cliente.waOptOut,
    mensajes,
    ...(hayMas ? { siguiente: mensajes[mensajes.length - 1].id } : {}),
  };
}

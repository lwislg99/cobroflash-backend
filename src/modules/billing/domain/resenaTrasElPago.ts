// SCRUM-1727b · ¿Puede salir AHORA la petición de reseña de Google tras un pago?
//
// Decisión del fundador (SCRUM-1727 c.21744, sobre la pregunta de c.21742): la reseña se manda
// SOLO si la ventana de 24 h del cliente está abierta Y es entre las 09:00 y las 21:00 en la hora
// del negocio. Si falta cualquiera de las dos, NO se manda: ni se encola ni pasa a plantilla.
// La baja (waOptOut) no se mira aquí: la sigue cortando `sendWhatsAppCtaUrl`, como antes.
//
// Regla 28: esto RESTRINGE un envío que ya existía (`psp.routes.ts` y `mpWebhook.routes.ts`);
// no crea ninguno. Las dos puertas son las de la casa, no unas propias:
//   · la ventana, `isServiceWindowOpen` — la misma que usa `sendWhatsAppWindowFirst`;
//   · la franja, `isQuietHours` (J6 del máster, «automatismos 09:00-21:00 hora del merchant»)
//     con la zona de `zonaDelMerchant`, que es el único sitio donde se resuelve.
import { isServiceWindowOpen } from '../../messaging/domain/whatsappLog.service';
import { isQuietHours } from '../../maintenance/domain/maintenance.service';
import { zonaDelMerchant } from '../../../core/zonaDelMerchant';

export type MotivoSinResena = 'fuera_de_franja' | 'ventana_cerrada' | 'no_comprobable';

/** `null` = puede salir. Si no, el motivo por el que NO sale. */
export async function motivoParaNoPedirResena(p: {
  merchantId: number;
  customerId: number | null | undefined;
  merchant: { timezone?: string | null } | null | undefined;
  ahora?: Date;
}): Promise<MotivoSinResena | null> {
  const ahora = p.ahora ?? new Date();
  // Lo llaman dos webhooks de cobro: un throw aquí reventaría la respuesta y el proveedor
  // reintentaría el pago. Ante la duda, NO se manda (la reseña es lo prescindible).
  try {
    if (isQuietHours(ahora, zonaDelMerchant(p.merchant))) return 'fuera_de_franja';
    // Sin cliente no hay ventana que mirar: se trata como cerrada (no se manda).
    if (!p.customerId) return 'ventana_cerrada';
    if (!(await isServiceWindowOpen(p.merchantId, p.customerId, ahora))) return 'ventana_cerrada';
    return null;
  } catch {
    return 'no_comprobable';
  }
}

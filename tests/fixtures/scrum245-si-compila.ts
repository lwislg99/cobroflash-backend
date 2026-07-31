// FIXTURE DE SCRUM-245 FASE 2 — el CONTROL NEGATIVO: esto SÍ tiene que compilar.
//
// Un tipo que no deja pasar lo legítimo se acaba puenteando con `as any`, así que la mitad que
// prueba que el tipo NO estorba vale tanto como la que prueba que atrapa.
import { sendWhatsAppButtons, sendWhatsAppCtaUrl, sendWhatsAppList } from '../../src/integrations/whatsapp';

/** Con merchant: el caso normal. */
export async function conMerchant(to: string, merchantId: number) {
  return sendWhatsAppButtons({ to, bodyText: 'hola', buttons: [{ id: 'a', title: 'A' }], merchantId });
}

/** Sin merchant, DECLARANDO por qué: uno de los cinco legítimos. */
export async function sinMerchantDeclarado(to: string) {
  return sendWhatsAppList({
    to, bodyText: '¿de qué negocio?', buttonText: 'Elegir', rows: [{ id: 'm_1', title: 'Uno' }],
    sinMerchant: 'seleccion-de-negocio',
  });
}

/** Y con el resto de opcionales, para que el tipo no estorbe a lo que ya existía. */
export async function conLog(to: string, merchantId: number) {
  return sendWhatsAppCtaUrl({
    to, bodyText: 'b', buttonText: 'Ver', url: 'https://yaqu.app', merchantId,
    log: { customerId: 1, relatedType: 'quote', relatedId: 2 },
  });
}

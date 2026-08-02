// FIXTURE DE SCRUM-245 FASE 2 — ESTE FICHERO NO TIENE QUE COMPILAR. Es el rojo del ticket.
//
// No entra en el build: `tsconfig.json` tiene `include: ['src']`. Lo compila a propósito, y solo
// él, `tests/scrum245-tipo-obliga-declarar.test.mjs`, que EXIGE que `tsc` falle aquí.
import { sendWhatsAppButtons, sendWhatsAppTemplate } from '../../src/integrations/whatsapp';

/** (1) Omitir las dos: es el olvido que este ticket viene a hacer imposible. */
export async function olvidarlo(to: string) {
  return sendWhatsAppButtons({ to, bodyText: 'hola', buttons: [{ id: 'a', title: 'A' }] });
}

/** (2) Poner las DOS: si esto colara, volveríamos a no saber cuál manda. */
export async function ponerLasDos(to: string) {
  return sendWhatsAppButtons({
    to, bodyText: 'hola', buttons: [{ id: 'a', title: 'A' }],
    merchantId: 1,
    sinMerchant: 'remitente-desconocido',
  } as any as { to: string; bodyText: string; buttons: Array<{ id: string; title: string }>; merchantId: number; sinMerchant: 'remitente-desconocido' });
}

/** (3) SCRUM-245 FASE 3: una PLANTILLA no puede eximirse del freno del demo. Ni intentarlo. */
export async function eximirUnaPlantilla(to: string) {
  return sendWhatsAppTemplate({
    to, templateName: 'x', merchantId: 1,
    exentoDelDemo: 'respuesta-a-entrante',
  });
}

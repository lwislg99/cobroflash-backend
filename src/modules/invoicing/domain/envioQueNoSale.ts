// src/modules/invoicing/domain/envioQueNoSale.ts — SCRUM-1478
//
// LO QUE LEE EL PROFESIONAL CUANDO UNA FACTURA NO SALE por WhatsApp o por correo.
//
// Hasta aquí esas frases salían del diccionario compartido `SEND_FAILURE_MESSAGES`
// (`src/lib/sendOutcome.ts`), que leen nueve envíos. Dos de ellas no valían para la factura:
//
//   · «…o envíalo por email»: un pronombre que apunta al documento («la factura»), y la palabra
//     cambia con el país.
//   · «No se pudo enviar el email. Puedes reintentarlo.»: afirma que no salió. El envío de correo
//     contesta lo mismo si el proveedor dice que no que si no contesta a tiempo, y en el segundo
//     caso puede haber salido: reintentar le manda la factura dos veces al cliente.
//
// El diccionario NO se toca: lo que cambie ahí lo leen el albarán, el parte, el equipo y soporte.
// Las frases se componen aquí, como hizo el presupuesto en su ruta (SCRUM-1465).
//
// 🔴 NINGUNA ES TEXTO NUEVO. Son, letra a letra, las firmadas para el presupuesto
// (`docs/microcopy/2026-10-06-SCRUM-1465-*.md`); que valgan también para la factura es la
// decisión registrada en `docs/microcopy/` con este ticket. Cambiar una sola letra aquí es
// redactar, y pide firma. Lo vigila `tests/scrum1478-la-factura-que-no-sale.test.mjs`, que las
// compara con esas fichas.
import { sendFailureBody, type SendFailureReason } from '../../../lib/sendOutcome';

/** Un motivo que no está aquí sigue leyendo la frase del diccionario compartido. */
const ENVIO_DE_FACTURA_NO_SALIO: Readonly<Partial<Record<SendFailureReason, string>>> = Object.freeze({
  wa_opt_out: 'El WhatsApp no ha salido: este cliente pidió no recibir tus mensajes por WhatsApp. Envíale el enlace por email o SMS.',
  daily_cap: 'El WhatsApp no ha salido: has alcanzado el tope diario de mensajes. Vuelve a intentarlo mañana o envía el enlace por email.',
  // El límite es de YaQu (`WA_CUSTOMER_DAILY_CAP`), y la frase lo dice.
  customer_daily_cap: 'El WhatsApp no ha salido: YaQu limita los mensajes diarios a un mismo cliente para no saturarlo. Vuelve a intentarlo mañana o envía el enlace por email.',
  email_send_failed: 'No sabemos si el email ha salido. Pregúntale a tu cliente antes de volver a enviarlo.',
});

/**
 * El cuerpo de «se intentó y no salió» para una FACTURA: el de la casa (`sendFailureBody`, mismo
 * contrato y mismo código de motivo), con la frase de la factura cuando el motivo tiene una.
 */
export function falloDeEnvioDeFactura(reason: SendFailureReason, extra: Record<string, unknown> = {}) {
  const propia = ENVIO_DE_FACTURA_NO_SALIO[reason];
  return sendFailureBody(reason, propia ? { ...extra, message: propia } : extra);
}

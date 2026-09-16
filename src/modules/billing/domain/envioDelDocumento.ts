// src/modules/billing/domain/envioDelDocumento.ts — SCRUM-885 (P-CONT-1)
//
// ¿LE HA LLEGADO AL CLIENTE EL DOCUMENTO DEL COBRO? Los HECHOS, no la decisión.
//
// Al cobrar, `psp.routes.ts` manda la factura por email SOLO si el cliente tiene email, y la
// confirmación de pago por WhatsApp (con «Ver documento») SOLO si tiene número. Sin ninguno de
// los dos el documento no sale, y hasta SCRUM-885 no quedaba nada que lo dijera.
//
// Aquí se juntan los tres hechos que ya están guardados —el flag, el email del cliente y la fila
// del WhatsApp del cobro— y NADA MÁS: no se envía, no se escribe, no hay schema. Si hay que avisar
// lo decide UNA regla, la del dashboard (`public/dashboard/js/avisoDocumentoSinEnviar.js`), que
// es la que pinta el toast y la fila de la factura y la que importa el test. Decidirlo también
// aquí sería la segunda copia que acaba discrepando.

import { config } from '../../../core/config/env';
import { SENT_OR_MORE } from '../../messaging/domain/whatsappLog.service';

/**
 * 'enviado'     → alguna fila del WhatsApp del cobro dice enviado o más (`SENT_OR_MORE`).
 * 'no_enviado'  → se intentó y ninguna fila dice enviado o más: `failed`, o un `queued` que no
 *                 avanzó. También si Meta lo marca fallido DESPUÉS, por el webhook de estado: la
 *                 fila se reescribe y esto se relee.
 * 'sin_intento' → no hay fila.
 * 'en_curso'    → sólo en la respuesta de «Confirmar Bizum»: el WhatsApp va sin `await` en psp y
 *                 aún no ha vuelto. No es un fallo, así que no avisa; la fila del trabajo, que se
 *                 relee, dirá lo que acabe pasando.
 */
export type EstadoWhatsappDelDocumento = 'enviado' | 'no_enviado' | 'sin_intento' | 'en_curso';

export type EnvioDelDocumento = {
  /** El envío automático al cobrar está encendido (AUTO_INVOICE_ON_PAID y AUTO_EMAIL_INVOICE_ON_PAID). */
  autoEmail: boolean;
  clienteTieneEmail: boolean;
  whatsapp: EstadoWhatsappDelDocumento;
};

/** Las dos condiciones con las que psp manda el documento por email al cobrar. */
export function envioAutomaticoEncendido(): boolean {
  return config.AUTO_INVOICE_ON_PAID === true && config.AUTO_EMAIL_INVOICE_ON_PAID === true;
}

export function estadoWhatsappDeFilas(estados: ReadonlyArray<string | null | undefined>): Exclude<EstadoWhatsappDelDocumento, 'en_curso'> {
  if (estados.length === 0) return 'sin_intento';
  return estados.some((e) => SENT_OR_MORE.has(String(e))) ? 'enviado' : 'no_enviado';
}

export function envioDelDocumento(args: {
  clienteEmail: string | null | undefined;
  estadosWhatsapp: ReadonlyArray<string | null | undefined>;
  enCurso?: boolean;
}): EnvioDelDocumento {
  const whatsapp = estadoWhatsappDeFilas(args.estadosWhatsapp);
  return {
    autoEmail: envioAutomaticoEncendido(),
    clienteTieneEmail: String(args.clienteEmail ?? '').trim() !== '',
    whatsapp: whatsapp === 'sin_intento' && args.enCurso ? 'en_curso' : whatsapp,
  };
}

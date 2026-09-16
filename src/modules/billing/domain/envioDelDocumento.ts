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
 * 'no_enviado'  → se intentó y ninguna fila dice enviado o más ni sigue en cola a tiempo: `failed`,
 *                 o un `queued` con más de `MINUTOS_EN_COLA_SIN_SABER` (atascado: no puede quedarse
 *                 callado para siempre). También si Meta lo marca fallido DESPUÉS, por el webhook
 *                 de estado: la fila se reescribe y esto se relee.
 * 'sin_intento' → no hay fila.
 * 'en_curso'    → TODAVÍA NO SE SABE, y no es un fallo, así que no avisa:
 *                 · una fila `queued` de menos de `MINUTOS_EN_COLA_SIN_SABER` (corrección del
 *                   orquestador, 16-sep: avisar ahí sería casi siempre una falsa alarma);
 *                 · en la respuesta de «Confirmar Bizum», el WhatsApp que psp lanza sin `await` y
 *                   aún no ha dejado fila.
 *                 La fila del trabajo, que se relee, dirá lo que acabe pasando.
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

/** Pasado este tiempo en cola, un WhatsApp cuenta como no enviado (orquestador, 16-sep-2026). */
export const MINUTOS_EN_COLA_SIN_SABER = 10;

export type FilaWhatsappDelDocumento = { status: string | null | undefined; createdAt: Date | string | null | undefined };

export function estadoWhatsappDeFilas(filas: ReadonlyArray<FilaWhatsappDelDocumento>, ahora: Date = new Date()): EstadoWhatsappDelDocumento {
  if (filas.length === 0) return 'sin_intento';
  if (filas.some((f) => SENT_OR_MORE.has(String(f.status)))) return 'enviado';
  const limite = ahora.getTime() - MINUTOS_EN_COLA_SIN_SABER * 60_000;
  // Sin fecha legible no se puede decir que siga a tiempo: cuenta como atascada.
  const enColaATiempo = filas.some((f) => f.status === 'queued' && f.createdAt != null && new Date(f.createdAt).getTime() > limite);
  return enColaATiempo ? 'en_curso' : 'no_enviado';
}

export function envioDelDocumento(args: {
  clienteEmail: string | null | undefined;
  filasWhatsapp: ReadonlyArray<FilaWhatsappDelDocumento>;
  enCurso?: boolean;
}): EnvioDelDocumento {
  const whatsapp = estadoWhatsappDeFilas(args.filasWhatsapp);
  return {
    autoEmail: envioAutomaticoEncendido(),
    clienteTieneEmail: String(args.clienteEmail ?? '').trim() !== '',
    whatsapp: whatsapp === 'sin_intento' && args.enCurso ? 'en_curso' : whatsapp,
  };
}

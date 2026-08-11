// src/integrations/enviarCorreo.ts — SCRUM-406
//
// UN CORREO SUELTO, Y LA RESPUESTA HONESTA A «¿SALIÓ?».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ DEVUELVE `enviado` Y NO SIMPLEMENTE `void`
//
// Lo que este módulo existe para impedir es un formulario que diga «Lo hemos recibido» cuando no ha
// salido nada. Eso sería **peor que el `mailto:` que sustituye**: el `mailto:` al menos deja el
// correo delante del profesional, escrito, para que lo mande por su cuenta.
//
// Por eso hay dos cosas que aquí NO se hacen:
//
//   1. **No se traga la excepción en silencio.** Si Resend falla, `enviado: false` sube hasta la
//      pantalla.
//   2. 🔴 **No se cuenta como enviado el transporte de mentira.** Sin `RESEND_API_KEY` y sin
//      `SMTP_URL`, `createMailer()` usa `streamTransport`, que escribe el correo **en un buffer en
//      memoria** y devuelve éxito. Un `sendMail` que resuelve bien contra un buffer es exactamente
//      la forma que tiene «no configurado» de disfrazarse de «enviado».
//
// ⚠️ HAY SEIS COPIAS MÁS DE ESTE POST EN EL ÁRBOL —`auth.service`, `email.service` ×2,
// `lifecycle.service`, `merchantNotifications`, `weeklyDigest`— y ninguna es reutilizable: cada una
// arma su propio documento. **No se migran aquí** (regla 37: ni es mi zona, ni me bloquea, ni cabe
// en este PR); queda reportado en `docs/master/SCRUM-406.md`. Este módulo es genérico a propósito,
// para que la séptima no vuelva a nacer suelta.
import axios from 'axios';
import { config } from '../core/config/env';
import { maskEmail } from '../core/utils/utils';
import { createMailer } from './mailer';

export interface CorreoSuelto {
  to: string;
  subject: string;
  html: string;
  /** A quién contesta el que le dé a «responder». */
  replyTo?: string | null;
  /** Adjuntos en el formato de Resend (`content` en base64). */
  adjuntos?: { filename: string; content: string }[];
  /** Remitente distinto del de la casa. Solo si el llamador tiene motivo. */
  from?: string;
  /** Para el log estructurado: de qué emisor viene. */
  origen?: string;
  /** Timeout propio (el PDF adjunto tarda más que un aviso de texto). */
  timeoutMs?: number;
}

/**
 * 🔴 EL ACUSE DEL PROVEEDOR — lo que hasta SCRUM-475 se tiraba a la basura.
 *
 * Resend contesta a cada POST con un `id`. **Las SIETE llamadas del árbol lo descartaban**: la
 * respuesta era una sentencia suelta y el valor se perdía. Sin ese id no se puede volver a
 * preguntar por un correo concreto, ni cruzar «lo mandamos» con «rebotó»; y una entrega fallida
 * llega igual de callada que una que salió.
 */
export interface AcuseProveedor {
  /** El identificador del proveedor. `null` si contestó sin él — que también es un dato. */
  id: string | null;
  /** El cuerpo tal cual, por si hace falta mirarlo. NO se persiste: esta fase no crea tabla. */
  crudo: unknown;
}

export interface ResultadoCorreo {
  enviado: boolean;
  /** Por qué no salió. Para el log y para el test — al profesional le llega el texto aprobado. */
  motivo?: 'sin_transporte' | 'sin_destino' | 'fallo_envio';
  via?: 'resend' | 'smtp';
  /** El acuse del proveedor. `null` por SMTP, que no da ninguno. */
  acuse?: AcuseProveedor | null;
}

/**
 * 🔴 EL ÚNICO POST A RESEND DE TODO EL ÁRBOL.
 *
 * Existe aparte de `enviarCorreo` porque hay llamadores —`email.service`— que tienen su PROPIO
 * respaldo (el `.eml` del outbox de dev, SCRUM-76) y no pueden delegar la política entera sin
 * perderlo. Lo que no puede haber es un segundo `axios.post` a `api.resend.com`, y el guard de
 * `tests/scrum475-un-solo-emisor.test.mjs` **cuenta las apariciones**: si el número sube, sale rojo.
 *
 * ⚠️ Devuelve el acuse. Es la mitad del ticket: quien envía tiene que poder decir QUÉ envío fue.
 */
export async function enviarPorResend(c: CorreoSuelto): Promise<ResultadoCorreo> {
  try {
    const r = await axios.post(
      'https://api.resend.com/emails',
      {
        from: c.from || config.EMAIL_FROM,
        to: [c.to],
        subject: c.subject,
        html: c.html,
        ...(c.replyTo ? { reply_to: [c.replyTo] } : {}),
        ...(c.adjuntos && c.adjuntos.length ? { attachments: c.adjuntos } : {}),
      },
      {
        headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: c.timeoutMs || 10_000,
      },
    );
    const cuerpo = (r as { data?: unknown })?.data ?? null;
    const id = cuerpo && typeof cuerpo === 'object' && typeof (cuerpo as { id?: unknown }).id === 'string'
      ? (cuerpo as { id: string }).id
      : null;
    // Log ESTRUCTURADO, y con el destinatario enmascarado: un correo es un dato personal y los
    // logs de Railway los lee cualquiera con acceso al panel.
    console.log('[correo]', JSON.stringify({
      evento: 'enviado', via: 'resend', id, origen: c.origen || null,
      to: maskEmail(c.to), asunto: c.subject,
    }));
    return { enviado: true, via: 'resend', acuse: { id, crudo: cuerpo } };
  } catch (e) {
    console.error('[correo]', JSON.stringify({
      evento: 'fallo', via: 'resend', origen: c.origen || null,
      to: maskEmail(c.to), error: (e as { message?: string })?.message || String(e),
    }));
    return { enviado: false, motivo: 'fallo_envio' };
  }
}

export async function enviarCorreo(c: CorreoSuelto): Promise<ResultadoCorreo> {
  if (!c.to || !c.to.trim()) return { enviado: false, motivo: 'sin_destino' };

  if (config.RESEND_API_KEY) return enviarPorResend(c);

  if (config.SMTP_URL) {
    try {
      await createMailer().sendMail({
        from: c.from || config.EMAIL_FROM,
        to: c.to,
        subject: c.subject,
        html: c.html,
        ...(c.replyTo ? { replyTo: c.replyTo } : {}),
        ...(c.adjuntos && c.adjuntos.length
          ? { attachments: c.adjuntos.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64') })) }
          : {}),
      });
      // SMTP no da acuse: `acuse: null` lo dice, en vez de fingir un id.
      console.log('[correo]', JSON.stringify({
        evento: 'enviado', via: 'smtp', id: null, origen: c.origen || null,
        to: maskEmail(c.to), asunto: c.subject,
      }));
      return { enviado: true, via: 'smtp', acuse: null };
    } catch (e) {
      console.error('[correo]', JSON.stringify({
        evento: 'fallo', via: 'smtp', origen: c.origen || null,
        to: maskEmail(c.to), error: (e as { message?: string })?.message || String(e),
      }));
      return { enviado: false, motivo: 'fallo_envio' };
    }
  }

  // Ni Resend ni SMTP: no hay por dónde salir. Se dice, no se disfraza.
  return { enviado: false, motivo: 'sin_transporte' };
}

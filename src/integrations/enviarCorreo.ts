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
import { createMailer } from './mailer';

export interface CorreoSuelto {
  to: string;
  subject: string;
  html: string;
  /** A quién contesta el que le dé a «responder». */
  replyTo?: string | null;
}

export interface ResultadoCorreo {
  enviado: boolean;
  /** Por qué no salió. Para el log y para el test — al profesional le llega el texto aprobado. */
  motivo?: 'sin_transporte' | 'sin_destino' | 'fallo_envio';
  via?: 'resend' | 'smtp';
}

export async function enviarCorreo(c: CorreoSuelto): Promise<ResultadoCorreo> {
  if (!c.to || !c.to.trim()) return { enviado: false, motivo: 'sin_destino' };

  if (config.RESEND_API_KEY) {
    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: config.EMAIL_FROM,
          to: [c.to],
          subject: c.subject,
          html: c.html,
          ...(c.replyTo ? { reply_to: [c.replyTo] } : {}),
        },
        { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10_000 },
      );
      return { enviado: true, via: 'resend' };
    } catch (e) {
      console.error('[enviarCorreo] Resend:', (e as { message?: string })?.message || e);
      return { enviado: false, motivo: 'fallo_envio' };
    }
  }

  if (config.SMTP_URL) {
    try {
      await createMailer().sendMail({
        from: config.EMAIL_FROM,
        to: c.to,
        subject: c.subject,
        html: c.html,
        ...(c.replyTo ? { replyTo: c.replyTo } : {}),
      });
      return { enviado: true, via: 'smtp' };
    } catch (e) {
      console.error('[enviarCorreo] SMTP:', (e as { message?: string })?.message || e);
      return { enviado: false, motivo: 'fallo_envio' };
    }
  }

  // Ni Resend ni SMTP: no hay por dónde salir. Se dice, no se disfraza.
  return { enviado: false, motivo: 'sin_transporte' };
}

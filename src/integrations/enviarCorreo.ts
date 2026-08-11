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
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-475 · LA SÉPTIMA ERA ÉSTA, Y LA CAZÓ EL CENSO — no una revisión a mano
//
// Las seis copias de arriba se cablearon en SCRUM-475 (rama `scrum-475-constancia-correo`) para
// que dejaran de tirar lo que contesta el proveedor. Este fichero nació DESPUÉS de aquel censo,
// en otra rama, y entró en `main` tirando la respuesta como las demás. Al traer `main` aquí, el
// guard de SCRUM-475 —que exige CERO respuestas descartadas y se deriva del árbol, no de una
// lista— cayó solo diciendo `enviarCorreo.ts:50`. Por eso el guard se deriva y no se enumera:
// una lista escrita a mano no habría sabido que existía este fichero.
//
// El contrato de SCRUM-406 (`enviado` / `motivo` / `via`) NO cambia: la pantalla de soporte sigue
// leyendo lo mismo. `constancia` se AÑADE al lado, para que el día que exista la tabla haya qué
// guardar. Hoy nadie la persiste todavía, y eso se dice en vez de aparentarlo.
import axios from 'axios';
import { config } from '../core/config/env';
import { createMailer } from './mailer';
// Mismo salto que `integrations/whatsapp.ts` → `modules/messaging/domain/whatsappLog.service`:
// el canal hermano ya lo hace, y es su embudo el que este ticket copia.
import { constanciaDeEnvio, constanciaDeFallo, type Constancia } from '../modules/messaging/domain/constanciaCorreo';

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
  /**
   * SCRUM-475 · qué CONSTA de este correo. Se añade sin tocar los tres campos de arriba.
   *
   * ⚠️ `aceptado_*` NO es «entregado»: mientras el proveedor no lo confirme por un aviso, lo que
   * consta es que lo aceptó. Decir «entregado» aquí sería inventar el dato que este ticket existe
   * para no inventar.
   */
  constancia: Constancia;
}

export async function enviarCorreo(c: CorreoSuelto): Promise<ResultadoCorreo> {
  if (!c.to || !c.to.trim()) {
    return { enviado: false, motivo: 'sin_destino', constancia: constanciaDeFallo({ message: 'destinatario sin email' }) };
  }

  if (config.RESEND_API_KEY) {
    try {
      // 🔴 `const respuesta =` — ahí venía el identificador del mensaje y se tiraba al suelo. Es
      // lo ÚNICO con lo que se puede reconocer este correo cuando llegue su rebote.
      const respuesta = await axios.post(
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
      return { enviado: true, via: 'resend', constancia: constanciaDeEnvio(respuesta) };
    } catch (e) {
      console.error('[enviarCorreo] Resend:', (e as { message?: string })?.message || e);
      return { enviado: false, motivo: 'fallo_envio', constancia: constanciaDeFallo(e) };
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
      // SMTP no devuelve identificador del proveedor: se dice que no consta, no se fabrica uno.
      return { enviado: true, via: 'smtp', constancia: constanciaDeEnvio(null) };
    } catch (e) {
      console.error('[enviarCorreo] SMTP:', (e as { message?: string })?.message || e);
      return { enviado: false, motivo: 'fallo_envio', constancia: constanciaDeFallo(e) };
    }
  }

  // Ni Resend ni SMTP: no hay por dónde salir. Se dice, no se disfraza.
  return {
    enviado: false,
    motivo: 'sin_transporte',
    constancia: constanciaDeFallo({ message: 'sin RESEND_API_KEY ni SMTP_URL: no se envió' }),
  };
}

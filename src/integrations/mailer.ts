// src/integrations/mailer.ts
import nodemailer from 'nodemailer';
import { config } from '../core/config/env';

/**
 * Transporte base para emails que NO son factura/presupuesto (magic-link, resumen
 * semanal, notificaciones al merchant). Con `SMTP_URL` usa SMTP real; sin él,
 * `streamTransport` (buffer) — en dev el email no sale a ningún sitio, solo evita
 * romper el flujo.
 *
 * NOTA (SCRUM-76): el antiguo helper `saveEml` se ELIMINÓ — era código muerto (0 callers)
 * y además su `createReadStream` nunca se ejecutaba con `buffer:true` (devuelve un Buffer),
 * así que "parecía" que guardaba un .eml de evidencia y no guardaba nada.
 */
export function createMailer() {
  if (config.SMTP_URL) {
    return nodemailer.createTransport(config.SMTP_URL);
  }
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
}

// A6.4 — Layout compartido de email: la MISMA marca en todos los correos
// (magic link, invitación, presupuesto, justificante/factura…).
// Email-safe: una sola columna, estilos inline, sin fuentes externas ni
// imágenes remotas (los clientes de correo las bloquean). Un email cutre
// delata al producto; este no lo es.

const BRAND = '#16a34a';
const BRAND_DARK = '#15803d';
const INK = '#0f1c17';
const BODY = '#3f4a45';
const MUTED = '#6b756f';
const BG = '#f6f7f5';
const BORDER = '#e7e9e5';

/** Escape mínimo para interpolar nombres/asuntos en el HTML del email. */
export function escEmail(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface EmailLayoutOpts {
  /** Encabezado corto dentro de la tarjeta (p. ej. "Tu presupuesto está listo"). */
  heading?: string;
  /** Contenido en HTML (párrafos <p>). El layout pone tipografía y colores base. */
  bodyHtml: string;
  /** CTA única (Regla de Una Sola Voz): botón verde de marca. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Línea pequeña bajo el CTA (p. ej. caducidad del enlace). */
  footnote?: string;
}

/** Envuelve el contenido en la plantilla de marca. Devuelve el HTML completo. */
export function renderEmailLayout(opts: EmailLayoutOpts): string {
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 6px"><tr><td style="border-radius:999px;background:${BRAND}">
           <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 30px;border-radius:999px;background:${BRAND};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">${opts.ctaLabel}</a>
         </td></tr></table>
         <p style="margin:0 0 6px;text-align:center;font-size:12px;color:${MUTED};word-break:break-all">Si el botón no funciona, copia este enlace:<br/><a href="${opts.ctaUrl}" style="color:${BRAND_DARK}">${opts.ctaUrl}</a></p>`
      : '';

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${BG}">
  <div style="display:none;max-height:0;overflow:hidden">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <!-- Cabecera de marca -->
        <tr><td style="padding:0 6px 14px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;height:34px;border-radius:50%;background:${BRAND};color:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:800;font-size:13px;text-align:center;vertical-align:middle">YQ</td>
            <td style="padding-left:9px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:800;font-size:19px;color:${INK}">YaQu</td>
          </tr></table>
        </td></tr>
        <!-- Tarjeta -->
        <tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:28px 26px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BODY};font-size:14.5px;line-height:1.6">
          ${opts.heading ? `<h1 style="margin:0 0 14px;font-size:19px;line-height:1.3;color:${INK};letter-spacing:-.01em">${opts.heading}</h1>` : ''}
          ${opts.bodyHtml}
          ${cta}
          ${opts.footnote ? `<p style="margin:16px 0 0;font-size:12.5px;color:${MUTED}">${opts.footnote}</p>` : ''}
        </td></tr>
        <!-- Pie -->
        <tr><td style="padding:16px 6px 0;text-align:center;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED}">
          Enviado con <a href="https://yaqu.app" style="color:${BRAND_DARK};text-decoration:none;font-weight:600">YaQu</a> — presupuestos, firma y cobro por WhatsApp<br/>
          <a href="https://yaqu.app/privacidad" style="color:${MUTED}">Privacidad</a> · <a href="https://yaqu.app/terminos" style="color:${MUTED}">Términos</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

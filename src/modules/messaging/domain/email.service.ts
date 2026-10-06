// src/modules/messaging/domain/email.service.ts
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { outboxDir, invoicesDir } from '../../../core/storage/dirs';
import { config, BASE_URL } from '../../../core/config/env';
import { ensureInvoicePdf } from '../../../lib/invoicing';
import { ensureQuoteDecisionToken } from '../../quotes/domain/quoteToken.service'; // SCRUM-95
import { renderEmailLayout, escEmail } from './emailLayout';
import { formatMoneyEs } from '../../../core/utils/utils'; // SCRUM-931: el TERCER canal, misma forma
import { enviarPorResend } from '../../../integrations/enviarCorreo'; // SCRUM-475: el emisor unico
// SCRUM-508: la clase de correo sale del vocabulario cerrado, no de un literal a mano.
import { CLASES_DE_CORREO, registrarEnvio } from './registroDeEnvios';
// SCRUM-1243: la constancia del fallo previo a Resend, con la misma forma que la de Resend.
// SCRUM-1299: y la del respaldo SMTP, con la misma forma que `enviarCorreo` por SMTP.
import { constanciaDeEnvio, constanciaDeFallo } from './constanciaCorreo';
import { portalUrlDelCliente } from '../../system/customerAdmin'; // SCRUM-967b
import { getLocale } from '../../../core/i18n/locales';
import { numeroQueImprimeElPapel } from '../../quotes/domain/revision'; // SCRUM-1444

/**
 * Envía la factura al cliente con el PDF adjunto.
 * En producción usa **Resend** (HTTP API) — antes usaba nodemailer/SMTP y, sin
 * SMTP_URL, solo escribía un .eml a disco sin enviar nada (la factura no llegaba).
 * El PDF se asegura/genera bajo demanda (ensureInvoicePdf) y se adjunta en base64.
 */
export async function sendInvoiceEmail(args: {
  invoiceId: number;
  toEmail: string;
  toName?: string;
  prisma: PrismaClient;
}) {
  const { invoiceId, toEmail, toName, prisma } = args;
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new Error('invoice_not_found');

  // Regla 24/26: J-… = justificante de cobro, el copy jamás dice "factura"
  const isJust = inv.number.startsWith('J-');

  // 🔴 SCRUM-501 · EL CONTEXTO DE LA FILA. Este emisor lo sabe todo —tiene la factura leída— y
  // es el que responde a la pregunta que motiva la tabla: «¿se le envió la factura F-2026-014 y
  // cuándo?». `kind` distingue el justificante de la factura porque el copy también lo
  // distingue (reglas 24/26) y una fila que los mezclara no podría contestarla.
  //
  // SCRUM-1243 · UNA sola constante para los DOS sitios que escriben la fila de este correo: el
  // fallo previo a Resend (abajo) y `enviarPorResend`. Dos literales iguales divergen.
  const registro = {
    merchantId: inv.merchantId,
    kind: isJust ? CLASES_DE_CORREO.justificante : CLASES_DE_CORREO.factura,
    customerId: inv.customerId ?? null,
    relatedType: 'invoice',
    relatedId: inv.id,
  };

  // Asegura el PDF en disco (genera si está PENDING o se perdió) y lo lee.
  //
  // 🔴 SCRUM-1243 · EL FALLO QUE NI SIQUIERA LLEGA A RESEND TAMBIÉN DEJA FILA. Si el PDF no se puede
  // generar o leer, esto revienta ANTES de `enviarPorResend`, que es quien escribe la fila del
  // envío. Sin fila, el aviso de Cobros (SCRUM-1235) no sale: el cliente ha pagado, no tiene su
  // factura y el profesional no se entera. GO del fundador: SCRUM-1243, comentario 17582.
  //
  // ⚠️ EL DISCRIMINANTE ES EL SITIO, NO EL MENSAJE. Este `try` envuelve SOLO la preparación del
  // adjunto: el envío a Resend queda FUERA, así que su fallo no pasa por este `catch` y no se
  // escribe dos veces (la suya ya la deja `enviarPorResend`). Nada aquí mira el texto del error:
  // cualquier excepción de esta etapa deja su fila, se llame como se llame.
  //
  // ⚠️ Solo con un transporte que escriba también el «salió»: Resend y, desde SCRUM-1299, el SMTP.
  // El outbox `.eml` de dev (ni Resend ni SMTP) sigue sin escribir nada, y una fila de fallo sin su
  // «salió» se quedaría avisando para siempre.
  //
  // `registrarEnvio` no lanza ni se cuelga (SCRUM-501): la excepción que sube es la de siempre, y
  // los llamadores la siguen viendo igual.
  let pdfBase64: string;
  try {
    const { diskPath } = await ensureInvoicePdf(invoiceId, prisma);
    const leido = fs.existsSync(diskPath) ? fs.readFileSync(diskPath).toString('base64') : null;
    // SCRUM-76: tras SCRUM-72 (D3) se quitó el botón "Ver documento" → el ADJUNTO es la ÚNICA vía de
    // entrega del documento fiscal al cliente. Si no hay PDF, NO enviamos una factura mutilada en
    // silencio: fallamos RUIDOSAMENTE para que el caller (webhook/admin) lo registre y se pueda
    // reenviar tras arreglar la causa. Vale para TODAS las ramas (Resend y fallback SMTP/outbox).
    if (!leido) throw new Error('invoice_pdf_unavailable');
    pdfBase64 = leido;
  } catch (e) {
    if (config.RESEND_API_KEY || config.SMTP_URL) {
      await registrarEnvio({ contexto: registro, to: toEmail, constancia: constanciaDeFallo(e) });
    }
    throw e;
  }

  const docLabel = isJust ? 'justificante de cobro' : 'factura';
  const from = config.EMAIL_FROM;
  const subject = `Tu ${docLabel} ${inv.number}`;
  // A6.4: layout de marca compartido (emailLayout.ts)
  const html = renderEmailLayout({
    heading: `Tu ${docLabel} está listo`,
    bodyHtml: `<p style="margin:0 0 8px">Hola${toName ? ` <strong>${escEmail(toName)}</strong>` : ''},</p>
<p style="margin:0">Te adjuntamos tu ${docLabel} <strong>${escEmail(inv.number)}</strong> en PDF.</p>`,
    // SCRUM-72 (D3): se quita el botón "Ver documento". Enlazaba al estático público
    // /invoices/*.pdf, que exponía facturas ajenas por nombre enumerable. El PDF sigue
    // viajando ADJUNTO (abajo), así que el cliente conserva su documento.
    footnote: 'Guárdalo para tus registros. Si tienes cualquier duda, responde a este correo.',
  });

  // ── Producción: Resend (HTTP API) con adjunto base64 ──────────────────────
  //
  // SCRUM-475 · el POST propio se retira y se llama al emisor único. Se usa `enviarPorResend` y NO
  // `enviarCorreo` a propósito: este emisor tiene su PROPIO respaldo debajo —el `.eml` del outbox
  // de dev (SCRUM-76)—, y delegar la política entera se lo llevaría por delante.
  //
  // 🔴 Y ahora el acuse del proveedor SALE de aquí: `acuseId` viaja al llamador. Antes la respuesta
  // era una sentencia suelta y su id se perdía, así que no había forma de volver a preguntar por
  // este envío concreto.
  if (config.RESEND_API_KEY) {
    const r = await enviarPorResend({
      to: toEmail,
      subject,
      html,
      from,
      origen: 'factura',
      timeoutMs: 15_000,
      // 🔴 SCRUM-501 · el contexto de la fila: la constante de arriba (SCRUM-1243, la misma que usa
      // el fallo previo a Resend).
      registro,
      // pdfBase64 garantizado no-null por el guard de arriba → el adjunto SIEMPRE viaja.
      adjuntos: [{ filename: `${inv.number}.pdf`, content: pdfBase64 }],
    });
    if (!r.enviado) throw new Error('no se pudo enviar la factura por email');
    return { ok: true, resend: true, acuseId: r.acuse?.id ?? null };
  }

  // ── Dev / sin RESEND: SMTP si hay SMTP_URL; si no, .eml en /public/outbox ──
  const transporter: nodemailer.Transporter = config.SMTP_URL
    ? nodemailer.createTransport(config.SMTP_URL)
    : nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });

  // 🔴 SCRUM-1299 · EL SMTP TAMBIÉN DEJA FILA, en sus dos desenlaces y con la forma de `enviarCorreo`
  // por SMTP: éxito → `aceptado_sin_identificador` (SMTP no da acuse), fallo → `fallo_envio` y la
  // MISMA excepción sube. Sin esto, el aviso de Cobros (SCRUM-1235) no veía nunca un fallo por aquí.
  // El outbox `.eml` (sin `SMTP_URL`) queda FUERA a propósito: cambiar lo que devuelve afecta a sus
  // cuatro llamadores y es otra decisión (docs/master/SCRUM-1299.md).
  let mail: unknown;
  try {
    mail = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      // pdfBase64 garantizado no-null → el adjunto SIEMPRE viaja también en el fallback SMTP/outbox.
      attachments: [{ filename: `${inv.number}.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }],
      html,
    });
  } catch (e) {
    if (config.SMTP_URL) {
      await registrarEnvio({ contexto: registro, to: toEmail, constancia: constanciaDeFallo(e) });
    }
    throw e;
  }

  // SCRUM-76: streamTransport + buffer:true devuelve `message` como Buffer → el `createReadStream`
  // de antes NUNCA se ejecutaba (outbox muerto). Se escribe el Buffer directamente al .eml.
  if (Buffer.isBuffer((mail as any)?.message)) {
    const file = path.join(outboxDir, `invoice-${inv.number}.eml`);
    fs.writeFileSync(file, (mail as any).message);
    return { ok: true, eml: `/outbox/invoice-${inv.number}.eml`, smtp: false };
  }

  await registrarEnvio({ contexto: registro, to: toEmail, constancia: constanciaDeEnvio(null) });
  return { ok: true, smtp: true };
}

/**
 * A2.3 — Envía el PRESUPUESTO al cliente por email (Resend): asunto con el
 * número por merchant (A1.2), botón al enlace público /pay/quote/:token (donde
 * firma/acepta) y el PDF adjunto si está en disco (fs de Railway es efímero:
 * el link es lo fiable, el adjunto es bonus).
 */
export async function sendQuoteEmail(args: { quoteId: number; prisma: PrismaClient }) {
  const { quoteId, prisma } = args;
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      merchant: { select: { name: true, legalName: true, country: true } },
      customer: { select: { name: true, email: true } },
    },
  });
  if (!quote) throw new Error('quote_not_found');
  const toEmail = quote.customer?.email;
  if (!toEmail) throw new Error('customer_missing_email');

  const business = quote.merchant?.legalName || quote.merchant?.name || 'Tu proveedor';
  // SCRUM-1444 · el número del PAPEL que este correo lleva adjunto: una revisión es `#12.1`, no `#12`.
  const displayNum = `#${numeroQueImprimeElPapel(quote)}`;
  // SCRUM-931 · el TERCER canal. El ticket hablaba de WhatsApp, pero el mismo presupuesto sale
  // también por correo, y salía con el mismo `419.87 EUR` — y en el sitio más visible del mensaje
  // (26 px, negrita, centrado). Arreglar sólo WhatsApp habría movido la divergencia de canal.
  const total = formatMoneyEs(quote.total, quote.currency);
  // SCRUM-95: token opaco (Quote.decisionToken), NUNCA el id — sexta puerta de la
  // misma fuga (SCRUM-72/74/85/87/90).
  const decisionToken = await ensureQuoteDecisionToken(quoteId, prisma);
  const payUrl = `${BASE_URL}/pay/quote/${decisionToken}`;
  // SCRUM-967b · el portal del cliente, que hasta aquí no viajaba en ningún envío. Va en el CORREO
  // porque llega a un solo destinatario —el propio cliente—; en la página del presupuesto NO va,
  // que contesta a cualquiera que tenga su enlace. Texto firmado: docs/microcopy/2026-09-21-SCRUM-967-*.
  // Best-effort: el presupuesto importa más que su enlace de portal. Si no hay token, no hay frase.
  const portalUrl = quote.customerId
    ? await portalUrlDelCliente(quote.merchantId, quote.customerId).catch(() => null)
    : null;
  const presupuestos = getLocale(quote.merchant?.country).quotePlural.toLowerCase();

  // PDF adjunto solo si sigue en disco. SCRUM-72: la ruta se deriva de la constante
  // `invoicesDir` + el nombre CANÓNICO del generador (QUOTE-<id>.pdf), NO del string de
  // `quote.pdfUrl` — que ahora apunta al endpoint auth y antes al estático. Derivarlo del
  // string rompía el adjunto en silencio al cambiar el esquema.
  let pdfBase64: string | null = null;
  try {
    const disk = path.join(invoicesDir, `QUOTE-${quote.id}.pdf`);
    if (fs.existsSync(disk)) pdfBase64 = fs.readFileSync(disk).toString('base64');
  } catch { /* sin adjunto */ }

  const subject = `Tu presupuesto ${displayNum} de ${business}`;
  // A6.4: layout de marca compartido (emailLayout.ts). El importe va en tinta
  // (Regla del Importe), nunca en verde.
  const html = renderEmailLayout({
    heading: 'Tu presupuesto está listo',
    bodyHtml: `<p style="margin:0 0 8px">Hola${quote.customer?.name ? ` <strong>${escEmail(quote.customer.name)}</strong>` : ''},</p>
<p style="margin:0 0 14px"><strong>${escEmail(business)}</strong> te ha preparado el presupuesto <strong>${escEmail(displayNum)}</strong>.</p>
<p style="margin:0;text-align:center;font-size:26px;font-weight:800;color:#0f1c17;letter-spacing:-.02em">${escEmail(total)}</p>`,
    ctaLabel: 'Ver y firmar presupuesto',
    ctaUrl: payUrl,
    bajoElBotonHtml: portalUrl
      ? `Todos tus ${escEmail(presupuestos)} y pagos con ${escEmail(business)} están en <a href="${portalUrl}" style="color:#15803d">tu portal de cliente</a>.`
      : undefined,
    footnote: 'Podrás revisarlo, firmarlo con el dedo desde el móvil o hacer preguntas.',
  });

  // SCRUM-501 · el presupuesto también deja fila, con su cliente y su documento. SCRUM-1299: UNA
  // constante para los dos sitios que la escriben (Resend y el respaldo SMTP), como en la factura.
  const registro = {
    merchantId: quote.merchantId,
    kind: CLASES_DE_CORREO.presupuesto,
    customerId: quote.customerId ?? null,
    relatedType: 'quote',
    relatedId: quote.id,
  };

  // SCRUM-475 · emisor único, y el acuse sale hacia el llamador. Mismo motivo que en la factura
  // para usar `enviarPorResend`: debajo vive el respaldo propio del outbox de dev.
  if (config.RESEND_API_KEY) {
    const r = await enviarPorResend({
      to: toEmail,
      subject,
      html,
      origen: 'presupuesto',
      timeoutMs: 15_000,
      // SCRUM-501 · la constante de arriba (SCRUM-1299, la misma que usa el respaldo SMTP).
      registro,
      // En el presupuesto el adjunto es best-effort: el CTA al enlace /pay/quote es la vía fiable.
      adjuntos: pdfBase64
        ? [{ filename: `presupuesto-${(quote as any).quoteNumber ?? quote.id}.pdf`, content: pdfBase64 }]
        : undefined,
    });
    if (!r.enviado) throw new Error('no se pudo enviar el presupuesto por email');
    return { ok: true, resend: true, acuseId: r.acuse?.id ?? null };
  }

  // Dev sin Resend: SMTP o .eml a outbox (mismo patrón que sendInvoiceEmail)
  const transporter: nodemailer.Transporter = config.SMTP_URL
    ? nodemailer.createTransport(config.SMTP_URL)
    : nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
  // 🔴 SCRUM-1299 · el SMTP deja fila en sus dos desenlaces, igual que en `sendInvoiceEmail`. El
  // outbox `.eml` queda fuera, por el mismo motivo.
  let mail: unknown;
  try {
    mail = await transporter.sendMail({
      from: config.EMAIL_FROM,
      to: toEmail,
      subject,
      html,
      // SCRUM-76 (defecto 2): el fallback también adjunta el PDF si está en disco — antes salía SIN
      // adjunto, incoherente con el path Resend. En el presupuesto el adjunto es best-effort: el CTA
      // al enlace /pay/quote es la vía fiable de entrega, así que aquí NO se falla si el PDF no está.
      attachments: pdfBase64
        ? [{ filename: `presupuesto-${(quote as any).quoteNumber ?? quote.id}.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }]
        : [],
    });
  } catch (e) {
    if (config.SMTP_URL) {
      await registrarEnvio({ contexto: registro, to: toEmail, constancia: constanciaDeFallo(e) });
    }
    throw e;
  }
  // SCRUM-76: Buffer directo al .eml (mismo fix que sendInvoiceEmail; el createReadStream estaba muerto).
  if (Buffer.isBuffer((mail as any)?.message)) {
    const file = path.join(outboxDir, `quote-${quote.id}.eml`);
    fs.writeFileSync(file, (mail as any).message);
    return { ok: true, eml: `/outbox/quote-${quote.id}.eml`, smtp: false };
  }
  await registrarEnvio({ contexto: registro, to: toEmail, constancia: constanciaDeEnvio(null) });
  return { ok: true, smtp: true };
}

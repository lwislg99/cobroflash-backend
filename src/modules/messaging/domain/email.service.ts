// src/modules/messaging/domain/email.service.ts
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { outboxDir, invoicesDir } from '../../../core/storage/dirs';
import { config, BASE_URL } from '../../../core/config/env';
import { ensureInvoicePdf } from '../../../lib/invoicing';
import { renderEmailLayout, escEmail } from './emailLayout';

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

  // Asegura el PDF en disco (genera si está PENDING o se perdió) y lo lee.
  const { diskPath, pdfUrl } = await ensureInvoicePdf(invoiceId, prisma);
  const pdfBase64 = fs.existsSync(diskPath) ? fs.readFileSync(diskPath).toString('base64') : null;

  // Regla 24/26: J-… = justificante de cobro, el copy jamás dice "factura"
  const isJust = inv.number.startsWith('J-');
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
  if (config.RESEND_API_KEY) {
    await axios.post(
      'https://api.resend.com/emails',
      {
        from,
        to: [toEmail],
        subject,
        html,
        attachments: pdfBase64 ? [{ filename: `${inv.number}.pdf`, content: pdfBase64 }] : undefined,
      },
      { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    return { ok: true, resend: true };
  }

  // ── Dev / sin RESEND: SMTP si hay SMTP_URL; si no, .eml en /public/outbox ──
  const transporter: nodemailer.Transporter = config.SMTP_URL
    ? nodemailer.createTransport(config.SMTP_URL)
    : nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });

  const mail = await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    html,
    attachments: pdfBase64
      ? [{ filename: `${inv.number}.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }]
      : [],
  });

  // @ts-ignore — streamTransport: guardar .eml para inspección en dev
  if (mail?.message?.createReadStream) {
    // @ts-ignore
    const stream = mail.message.createReadStream();
    const file = path.join(outboxDir, `invoice-${inv.number}.eml`);
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(file);
      stream.pipe(ws);
      ws.on('finish', () => resolve());
      ws.on('error', reject);
    });
    return { ok: true, eml: `/outbox/invoice-${inv.number}.eml`, smtp: false };
  }

  return { ok: true, smtp: true };
}

/**
 * A2.3 — Envía el PRESUPUESTO al cliente por email (Resend): asunto con el
 * número por merchant (A1.2), botón al enlace público /pay/quote/:id (donde
 * firma/acepta) y el PDF adjunto si está en disco (fs de Railway es efímero:
 * el link es lo fiable, el adjunto es bonus).
 */
export async function sendQuoteEmail(args: { quoteId: number; prisma: PrismaClient }) {
  const { quoteId, prisma } = args;
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      merchant: { select: { name: true, legalName: true } },
      customer: { select: { name: true, email: true } },
    },
  });
  if (!quote) throw new Error('quote_not_found');
  const toEmail = quote.customer?.email;
  if (!toEmail) throw new Error('customer_missing_email');

  const business = quote.merchant?.legalName || quote.merchant?.name || 'Tu proveedor';
  const displayNum = `#${(quote as any).quoteNumber ?? quote.id}`;
  const total = `${Number(quote.total).toFixed(2)} ${quote.currency}`;
  const payUrl = `${BASE_URL}/pay/quote/${quote.id}`;

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
    footnote: 'Podrás revisarlo, firmarlo con el dedo desde el móvil o hacer preguntas.',
  });

  if (config.RESEND_API_KEY) {
    await axios.post(
      'https://api.resend.com/emails',
      {
        from: config.EMAIL_FROM,
        to: [toEmail],
        subject,
        html,
        attachments: pdfBase64 ? [{ filename: `presupuesto-${(quote as any).quoteNumber ?? quote.id}.pdf`, content: pdfBase64 }] : undefined,
      },
      { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    return { ok: true, resend: true };
  }

  // Dev sin Resend: SMTP o .eml a outbox (mismo patrón que sendInvoiceEmail)
  const transporter: nodemailer.Transporter = config.SMTP_URL
    ? nodemailer.createTransport(config.SMTP_URL)
    : nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
  const mail = await transporter.sendMail({ from: config.EMAIL_FROM, to: toEmail, subject, html });
  // @ts-ignore — streamTransport: guardar .eml para inspección en dev
  if (mail?.message?.createReadStream) {
    // @ts-ignore
    const stream = mail.message.createReadStream();
    const file = path.join(outboxDir, `quote-${quote.id}.eml`);
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(file);
      stream.pipe(ws);
      ws.on('finish', () => resolve());
      ws.on('error', reject);
    });
    return { ok: true, eml: `/outbox/quote-${quote.id}.eml`, smtp: false };
  }
  return { ok: true, smtp: true };
}

// src/modules/messaging/domain/email.service.ts
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { outboxDir } from '../../../core/storage/dirs';
import { config, BASE_URL } from '../../../core/config/env';
import { ensureInvoicePdf } from '../../../lib/invoicing';

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

  const from = config.EMAIL_FROM;
  const subject = `Tu factura ${inv.number}`;
  const html = `
    <p>Hola ${toName || ''},</p>
    <p>Adjuntamos tu factura <b>${inv.number}</b> en PDF.</p>
    <p>También puedes verla aquí: <a href="${BASE_URL}${pdfUrl}">${inv.number}.pdf</a></p>
    <p>Gracias,<br/>YaQu</p>
  `.trim();

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

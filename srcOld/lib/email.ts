import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { outboxDir } from './dirs';
import { config } from '../config/env';

export async function sendInvoiceEmail(args: {
  invoiceId: number;
  toEmail: string;
  toName?: string;
  prisma: PrismaClient;
}) {
  const { invoiceId, toEmail, toName, prisma } = args;
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new Error('invoice_not_found');

  const from = config.EMAIL_FROM;

  // SMTP real si hay SMTP_URL; si no, .eml en /public/outbox
  let transporter: nodemailer.Transporter;
  if (config.SMTP_URL) {
    transporter = nodemailer.createTransport(config.SMTP_URL);
  } else {
    transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true });
  }

  // Adjuntar el PDF
  const pdfUrl = inv.pdfUrl;
  const pdfPathInPublic = pdfUrl.startsWith('http') ? new URL(pdfUrl).pathname : pdfUrl;
  const pdfDiskPath = path.join(process.cwd(), 'public', decodeURIComponent(pdfPathInPublic.replace(/^\//, '')));

  const subject = `Tu factura ${inv.number}`;
  const html = `
    <p>Hola ${toName || ''},</p>
    <p>Adjuntamos la factura <b>${inv.number}</b>. También puedes verla aquí:</p>
    <p><a href="${inv.pdfUrl}">${inv.pdfUrl}</a></p>
    <p>Gracias,<br/>CobroFlash</p>
  `.trim();

  const mail = await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    html,
    attachments: [{ filename: `${inv.number}.pdf`, path: pdfDiskPath, contentType: 'application/pdf' }],
  });

  // Guardar .eml si es streamTransport
  // @ts-ignore
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

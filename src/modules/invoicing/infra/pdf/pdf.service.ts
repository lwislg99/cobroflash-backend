// src/modules/invoicing/infra/pdf/pdf.service.ts
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { invoicesDir } from '../../../../core/storage/dirs';

export async function generateInvoicePdf(params: {
  number: string;
  merchant: { name: string };
  customer: { name: string };
  currency: string;
  total: string;
  qrData: string;
}) {
  const fileName = `${params.number}.pdf`;
  const outPath = path.join(invoicesDir, fileName);

  const qrPngBuffer = await QRCode.toBuffer(params.qrData, {
    type: 'png',
    width: 256,
  });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.fontSize(18).text('Factura', { align: 'right' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Número: ${params.number}`, { align: 'right' });
  doc.moveDown();

  doc.fontSize(12).text(`Emisor: ${params.merchant.name}`);
  doc.text(`Cliente: ${params.customer.name}`);
  doc.moveDown();

  doc.fontSize(14).text(`Total: ${params.total} ${params.currency}`);
  doc.moveDown();

  doc.image(qrPngBuffer, doc.x, doc.y, { width: 128 });
  doc.text(
    'Escanea el QR para validar la factura',
    doc.x + 140,
    doc.y - 120,
  );

  doc.moveDown(6);
  doc
    .fontSize(9)
    .fillColor('#666')
    .text('CobroFlash — Factura generada automáticamente', {
      align: 'center',
    });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { outPath, publicUrlPath: `/invoices/${fileName}` };
}

/**
 * Generar PDF de PRESUPUESTO.
 * Usa el ID de quote para el nombre de fichero: QUOTE-<id>.pdf
 */
export async function generateQuotePdf(params: {
  quoteId: number;
  merchant: {
    name: string | null;
    legalName?: string | null;
    taxId?: string | null;
    address?: string | null;
    whatsappPhone?: string | null;
  };
  customer: {
    name: string | null;
    phone?: string | null;
    email?: string | null;
  };
  currency: string;
  total: string;
  lines: Array<{
    concept: string;
    qty: number;
    price: number;
    tax: number;
  }>;
}) {
  const fileName = `QUOTE-${params.quoteId}.pdf`;
  const outPath = path.join(invoicesDir, fileName); // usamos la misma carpeta /invoices

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // Cabecera
  doc.fontSize(18).text('Presupuesto', { align: 'right' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Presupuesto #${params.quoteId}`, { align: 'right' });
  doc.moveDown();

  // Datos empresa / cliente (muy sencillos de momento)
  const merchantName =
    params.merchant.legalName || params.merchant.name || '—';
  doc.fontSize(12).text(`Emisor: ${merchantName}`);
  if (params.merchant.taxId) doc.text(`NIF: ${params.merchant.taxId}`);
  if (params.merchant.address) doc.text(params.merchant.address);
  if (params.merchant.whatsappPhone)
    doc.text(`WhatsApp ${params.merchant.whatsappPhone}`);
  doc.moveDown();

  doc.text(`Cliente: ${params.customer.name || '—'}`);
  if (params.customer.phone) doc.text(`Tel: ${params.customer.phone}`);
  if (params.customer.email) doc.text(`Email: ${params.customer.email}`);
  doc.moveDown();

  // Tabla simple de líneas
  doc.fontSize(12).text('Detalle del presupuesto:');
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .text('Concepto', 50, doc.y, { continued: true, width: 240 })
    .text('Cant.', 300, doc.y, { continued: true, width: 40 })
    .text('Precio', 350, doc.y, { continued: true, width: 70 })
    .text('IVA%', 430, doc.y, { continued: true, width: 40 })
    .text('Total', 480, doc.y, { width: 80 });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown(0.3);

  params.lines.forEach((l) => {
    const lineTotal = l.qty * l.price * (1 + l.tax);
    doc
      .fontSize(10)
      .text(l.concept, 50, doc.y, { continued: true, width: 240 })
      .text(l.qty.toString(), 300, doc.y, { continued: true, width: 40 })
      .text(l.price.toFixed(2), 350, doc.y, { continued: true, width: 70 })
      .text((l.tax * 100).toFixed(0) + '%', 430, doc.y, {
        continued: true,
        width: 40,
      })
      .text(lineTotal.toFixed(2), 480, doc.y, { width: 80 });
    doc.moveDown(0.2);
  });

  doc.moveDown();

  doc.fontSize(12).text(`Total presupuesto: ${params.total} ${params.currency}`, {
    align: 'right',
  });

  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillColor('#666')
    .text(
      'Presupuesto generado automáticamente por PresuFácil — válido salvo indicación en contrario.',
      { align: 'center' },
    );

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { outPath, publicUrlPath: `/invoices/${fileName}` };
}

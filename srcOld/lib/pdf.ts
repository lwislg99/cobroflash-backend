import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { invoicesDir } from './dirs';

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

  const qrPngBuffer = await QRCode.toBuffer(params.qrData, { type: 'png', width: 256 });

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
  doc.text('Escanea el QR para validar la factura', doc.x + 140, doc.y - 120);

  doc.moveDown(6);
  doc.fontSize(9).fillColor('#666').text('CobroFlash — Factura generada automáticamente', { align: 'center' });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { outPath, publicUrlPath: `/invoices/${fileName}` };
}

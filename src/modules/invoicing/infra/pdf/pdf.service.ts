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
  signatureData?: string | null;    // base64 PNG data URL — se añade al PDF si está presente
  signedAt?: Date | null;
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

 


 // --- helpers tabla (para no descuadrar con textos largos) ---
const X0 = 50;
const W_CONCEPT = 240;
const X_QTY = 300;
const W_QTY = 40;
const X_PRICE = 350;
const W_PRICE = 70;
const X_VAT = 430;
const W_VAT = 40;
const X_TOTAL = 480;
const W_TOTAL = 80;

const PAGE_BOTTOM = doc.page.height - doc.page.margins.bottom;

// Inserta "puntos de corte" en palabras MUY largas sin espacios (wwwwww...)
function softBreakLongTokens(input: string, chunk = 18) {
  if (!input) return '';
  // rompe tokens largos (secuencias sin espacios) insertando \u200B (zero-width space)
  return input.replace(/\S{25,}/g, (tok) => {
    const parts: string[] = [];
    for (let i = 0; i < tok.length; i += chunk) parts.push(tok.slice(i, i + chunk));
    return parts.join('\u200B');
  });
}

function drawTableHeader() {

  const y = doc.y;

  doc
    .fontSize(10)
    .text('Concepto', X0, doc.y, { width: W_CONCEPT })
    .text('Cant.', X_QTY, doc.y - 12, { width: W_QTY, align: 'right' })
    .text('Precio', X_PRICE, doc.y - 12, { width: W_PRICE, align: 'right' })
    .text('IVA%', X_VAT, doc.y - 12, { width: W_VAT, align: 'right' })
    .text('Total', X_TOTAL, doc.y - 12, { width: W_TOTAL, align: 'right' });

  doc.moveDown(0.3);
  doc.moveTo(X0, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown(0.3);
}

drawTableHeader();


params.lines.forEach((l) => {
  const lineTotal = l.qty * l.price * (1 + l.tax);

  const concept = softBreakLongTokens(String(l.concept || '').trim());

  const parts = concept.split('\n').map((s) => s.trim()).filter(Boolean);
  const title = parts[0] || '';
  const desc = parts.slice(1).join('\n'); // puede tener varias líneas

  const qty = String(l.qty ?? '');
  const price = Number.isFinite(l.price) ? l.price.toFixed(2) : '';
  const vat = Number.isFinite(l.tax) ? (l.tax * 100).toFixed(0) + '%' : '';
  const total = Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : '';

  const y0 = doc.y;

  // 🔎 calcular alturas ANTES de dibujar
  doc.font('Helvetica-Bold').fontSize(10);
  const hTitle = doc.heightOfString(title, { width: W_CONCEPT });

  doc.font('Helvetica').fontSize(9);
  const hDesc = desc ? doc.heightOfString(desc, { width: W_CONCEPT }) : 0;

  const rowH = Math.max(12, hTitle + (desc ? 2 : 0) + hDesc) + 6;

  // ✅ salto de página ANTES de pintar
  if (y0 + rowH > PAGE_BOTTOM) {
    doc.addPage();
    doc.font('Helvetica').fontSize(12).fillColor('black').text('Detalle del presupuesto:');
    doc.moveDown(0.5);
    drawTableHeader();
  }

  const y = doc.y; // nuevo y0 real tras posible addPage

  // ✅ pintar título + descripción (sin duplicar)
  doc.font('Helvetica-Bold').fontSize(10).fillColor('black')
    .text(title, X0, y, { width: W_CONCEPT });

  let yAfter = y + hTitle;

  if (desc) {
    yAfter += 2;
    doc.font('Helvetica').fontSize(9).fillColor('#444')
      .text(desc, X0, yAfter, { width: W_CONCEPT });
    doc.fillColor('black'); // reset
    yAfter += hDesc;
  }

  // columnas numéricas alineadas a la primera línea (y)
  doc.font('Helvetica').fontSize(10).fillColor('black')
    .text(qty, X_QTY, y, { width: W_QTY, align: 'right' })
    .text(price, X_PRICE, y, { width: W_PRICE, align: 'right' })
    .text(vat, X_VAT, y, { width: W_VAT, align: 'right' })
    .text(total, X_TOTAL, y, { width: W_TOTAL, align: 'right' });

  // avanzar el cursor al final de la fila
  doc.y = y + rowH;
});



doc.moveDown();

// ✅ Aseguramos que el "Total" se calcula desde el margen izquierdo
const CONTENT_X = X0;                // 50
const CONTENT_W = 560 - X0;          // 510 (hasta el borde derecho de tu tabla)

// Total (sin partirse raro)
doc.fontSize(12).text(
  `Total presupuesto: ${params.total} ${params.currency}`,
  CONTENT_X,
  doc.y,
  { width: CONTENT_W, align: 'right' },
);

doc.moveDown(2);

// Sección firma digital (si existe)
if (params.signatureData) {
  try {
    const base64 = params.signatureData.replace(/^data:image\/\w+;base64,/, '');
    const imgBuffer = Buffer.from(base64, 'base64');
    const signDate = params.signedAt
      ? params.signedAt.toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });

    // Salto de página si no cabe
    if (doc.y + 120 > PAGE_BOTTOM) doc.addPage();

    doc.moveTo(CONTENT_X, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('black').text('Firma del cliente:', CONTENT_X, doc.y);
    doc.moveDown(0.3);
    doc.image(imgBuffer, CONTENT_X, doc.y, { width: 180, height: 70, fit: [180, 70] });
    doc.moveDown(5);
    doc.fontSize(8).fillColor('#444')
      .text(`Firmado digitalmente por ${params.customer.name || 'el cliente'} el ${signDate}`, CONTENT_X, doc.y);
    doc.moveDown(0.5);
  } catch (e) {
    // Si la imagen falla, continuamos sin firma
  }
}

// Footer centrado bien (con ancho fijo)
doc.moveDown(1);
doc
  .fontSize(9)
  .fillColor('#666')
  .text(
    'Presupuesto generado automáticamente por PresuFácil — válido salvo indicación en contrario.',
    CONTENT_X,
    doc.y,
    { width: CONTENT_W, align: 'center' },
  );


  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { outPath, publicUrlPath: `/invoices/${fileName}` };
}

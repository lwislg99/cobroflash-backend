// src/modules/invoicing/infra/pdf/pdf.service.ts
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { invoicesDir } from '../../../../core/storage/dirs';
import { getLocale } from '../../../../core/i18n/locales';

export async function generateInvoicePdf(params: {
  number: string;
  merchant: { name: string; legalName?: string | null; taxId?: string | null; address?: string | null };
  customer: { name: string };
  currency: string;
  total: string;
  qrData: string;
  vfHash?: string | null;   // si presente → sección VeriFactu en el PDF
  createdAt?: Date | null;
}) {
  const fileName = `${params.number}.pdf`;
  const outPath = path.join(invoicesDir, fileName);

  const isVeriFactu = !!params.vfHash;

  const qrPngBuffer = await QRCode.toBuffer(params.qrData, { type: 'png', width: 256 });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const MARGIN = 50;
  const PAGE_W = doc.page.width - MARGIN * 2;

  // ── Cabecera ──────────────────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').text('FACTURA', { align: 'right' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor('#555')
    .text(`Nº ${params.number}`, { align: 'right' });
  if (params.createdAt) {
    const d = params.createdAt;
    const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    doc.text(`Fecha: ${dateStr}`, { align: 'right' });
  }
  doc.fillColor('black').moveDown();

  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + PAGE_W, doc.y).strokeColor('#e5e7eb').stroke();
  doc.strokeColor('black').moveDown(0.5);

  // ── Emisor / Cliente ──────────────────────────────────────────────────
  const emisorName = params.merchant.legalName || params.merchant.name;
  doc.fontSize(11).font('Helvetica-Bold').text('Emisor');
  doc.font('Helvetica').fontSize(10).text(emisorName);
  if (params.merchant.taxId) doc.text(`NIF/CIF: ${params.merchant.taxId}`);
  if (params.merchant.address) doc.text(params.merchant.address);
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(11).text('Cliente');
  doc.font('Helvetica').fontSize(10).text(params.customer.name);
  doc.moveDown();

  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + PAGE_W, doc.y).strokeColor('#e5e7eb').stroke();
  doc.strokeColor('black').moveDown(0.5);

  // ── Total ─────────────────────────────────────────────────────────────
  doc.fontSize(14).font('Helvetica-Bold')
    .text(`Total: ${params.total} ${params.currency}`, { align: 'right' });
  doc.moveDown(1.5);

  // ── Sección QR / VeriFactu ────────────────────────────────────────────
  const qrY = doc.y;
  const qrSize = 100;

  doc.image(qrPngBuffer, MARGIN, qrY, { width: qrSize });

  const textX = MARGIN + qrSize + 16;
  const textW = PAGE_W - qrSize - 16;

  if (isVeriFactu) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#166534')
      .text('Factura Verificable — VeriFactu', textX, qrY, { width: textW });
    doc.font('Helvetica').fontSize(9).fillColor('#555')
      .text('Escanea el QR para verificar esta factura en la sede electrónica de la AEAT.', textX, doc.y, { width: textW });
    doc.moveDown(0.4);
    const hashShort = params.vfHash!.slice(0, 32) + '…';
    doc.fontSize(8).fillColor('#888')
      .text(`Huella: ${hashShort}`, textX, doc.y, { width: textW });
    doc.fillColor('black');
  } else {
    doc.fontSize(9).font('Helvetica').fillColor('#555')
      .text('Escanea el QR para validar la factura.', textX, qrY + 10, { width: textW });
    doc.fillColor('black');
  }

  doc.y = Math.max(doc.y, qrY + qrSize + 8);
  doc.moveDown(1);

  // ── Footer ────────────────────────────────────────────────────────────
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + PAGE_W, doc.y).strokeColor('#e5e7eb').stroke();
  doc.strokeColor('black').moveDown(0.5);
  doc.fontSize(8).fillColor('#9ca3af')
    .text('Factura generada automáticamente por PresuFácil.', { align: 'center' });
  if (isVeriFactu) {
    doc.text('Sistema de facturación verificable conforme al RD 1007/2023 (VeriFactu).', { align: 'center' });
  }

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
  signatureData?: string | null;
  signedAt?: Date | null;
  country?: string | null;
  tiers?: Array<{ id: string; label: string; description?: string; lines: any[]; total: number; recommended?: boolean }> | null;
}) {
  const fileName = `QUOTE-${params.quoteId}.pdf`;
  const outPath = path.join(invoicesDir, fileName); // usamos la misma carpeta /invoices

  const locale = getLocale(params.country);
  const QUOTE_LABEL = locale.quote; // "Presupuesto" o "Cotización"

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // Cabecera
  doc.fontSize(18).text(QUOTE_LABEL, { align: 'right' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`${QUOTE_LABEL} #${params.quoteId}`, { align: 'right' });
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

  // ===== MODO TIERS: Good/Better/Best =====
  if (params.tiers && params.tiers.length > 0) {
    doc.fontSize(12).text('Opciones disponibles:', { underline: true });
    doc.moveDown(0.5);

    const tierW = 155;
    const tierGap = 10;
    const startX = 50;

    params.tiers.forEach((tier, idx) => {
      const x = startX + idx * (tierW + tierGap);
      const yStart = doc.y;

      // Caja del tier
      doc.rect(x, yStart, tierW, 14).fill(tier.recommended ? '#22c55e' : '#f3f4f6');
      doc.fillColor(tier.recommended ? '#ffffff' : '#374151')
        .fontSize(9).font('Helvetica-Bold')
        .text(tier.label + (tier.recommended ? ' ★' : ''), x + 4, yStart + 3, { width: tierW - 8, align: 'center' });

      doc.fillColor('black').font('Helvetica').fontSize(8);
      let lineY = yStart + 18;
      if (tier.description) {
        doc.text(tier.description, x + 4, lineY, { width: tierW - 8 });
        lineY += 12;
      }
      tier.lines.forEach((l: any) => {
        const lineTotal = (l.qty * l.price * (1 + (l.tax ?? 0))).toFixed(2);
        const text = `${l.concept} × ${l.qty}`;
        doc.text(text, x + 4, lineY, { width: tierW - 8 });
        lineY += 10;
        doc.text(`${lineTotal} ${params.currency}`, x + 4, lineY, { width: tierW - 8, align: 'right' });
        lineY += 12;
      });

      // Total del tier
      doc.rect(x, lineY, tierW, 14).fill(tier.recommended ? '#dcfce7' : '#e5e7eb');
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9)
        .text(`Total: ${tier.total.toFixed(2)} ${params.currency}`, x + 4, lineY + 3, { width: tierW - 8, align: 'center' });

      doc.fillColor('black').font('Helvetica');
    });

    doc.moveDown(14);
    doc.fontSize(9).fillColor('#6b7280')
      .text('El cliente puede elegir la opción que mejor se adapte a sus necesidades.', { align: 'center' });
    doc.fillColor('black').moveDown(1);

  } else {
  // ===== MODO CLÁSICO: líneas normales =====
  doc.fontSize(12).text(`Detalle del ${locale.quoteVerb}:`);
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
    doc.font('Helvetica').fontSize(12).fillColor('black').text(`Detalle del ${locale.quoteVerb}:`);
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

  } // fin else modo clásico

// Total y footer (valores literales para evitar scope de else)
const CONTENT_X = 50;
const CONTENT_W = 510;

// Total (sin partirse raro)
doc.fontSize(12).text(
  `Total ${locale.quoteVerb}: ${params.total} ${params.currency}`,
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
    if (doc.y + 120 > doc.page.height - doc.page.margins.bottom) doc.addPage();

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
    `${QUOTE_LABEL} generado automáticamente por PresuFácil — válido salvo indicación en contrario.`,
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

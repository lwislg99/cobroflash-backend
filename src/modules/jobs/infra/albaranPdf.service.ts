// src/modules/jobs/infra/albaranPdf.service.ts — SCRUM-14 (ALBARAN-1)
// PDF del albarán / parte de trabajo. ARCHIVO SEPARADO del PDF fiscal a propósito
// (regla 24): aquí JAMÁS hay QR, serie fiscal, importes ni la palabra "factura"
// (solo el pie legal "no constituye factura" definido en el brief). Clona el
// patrón visual de generateQuotePdf (pdfkit, A4, tokens cálidos de DESIGN.md).
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { albaranesDir } from '../../../core/storage/dirs';
import { loadLogoBuffer } from '../../invoicing/infra/pdf/pdf.service';
import type { AlbaranLinea } from '../domain/albaran.service';

export async function generateAlbaranPdf(params: {
  merchantId: number; // SCRUM-48: prefija el nombre de archivo (mata la colisión entre merchants)
  numero: string;
  fecha: Date;
  version: number;
  merchant: {
    name: string | null;
    legalName?: string | null;
    taxId?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    whatsappPhone?: string | null;
  };
  customerName: string | null;
  obra: string | null; // Job.direccion || Job.titulo
  lineas: AlbaranLinea[];
  notas?: string | null;
  signatureData?: string | null; // data-URI (solo si estado firmado)
  firmadoAt?: Date | null;
}): Promise<{ outPath: string }> {
  // SCRUM-48: la serie ALB- solo es única POR merchant (@@unique([merchantId, numero]));
  // sin el prefijo, dos merchants con ALB-2026-001 se pisaban el PDF en disco.
  const fileName = `${params.merchantId}-${params.numero}.pdf`;
  const outPath = path.join(albaranesDir, fileName);

  // Tokens de DESIGN.md adaptados a papel (mismos del PDF de factura)
  const INK = '#0f1c17';
  const BODY = '#3f4a45';
  const MUTED = '#6b756f';
  const BORDER = '#e7e9e5';
  const BG = '#f6f7f5';
  const BRAND = '#16a34a';

  const logoBuf = await loadLogoBuffer(params.merchant.logoUrl);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const M = 50;
  const W = doc.page.width - M * 2;

  // Banda de marca fina (membrete, patrón drawBrandBand del PDF fiscal)
  function brandBand() {
    const px = doc.x, py = doc.y;
    doc.save();
    doc.rect(0, 0, doc.page.width, 5).fill(BRAND);
    doc.restore();
    doc.fillColor('#000');
    doc.x = px; doc.y = py;
  }
  brandBand();
  doc.on('pageAdded', brandBand);

  function fmtDate(d: Date | null | undefined) {
    return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  }
  function fmtQty(v: number) {
    return v.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  }

  // ── Cabecera: logo izquierda, título derecha ─────────────────────────────
  const hY = doc.y;
  if (logoBuf) {
    try { doc.image(logoBuf, M, hY, { height: 40, fit: [110, 40] }); } catch { /* logo inválido */ }
  }
  doc.fontSize(16).font('Helvetica-Bold').fillColor(INK)
    .text('ALBARÁN / PARTE DE TRABAJO', M, hY, { width: W, align: 'right' });
  doc.fontSize(11).font('Helvetica').fillColor(MUTED)
    .text(`Albarán ${params.numero}`, { width: W, align: 'right' })
    .text(`Fecha: ${fmtDate(params.fecha)} · Versión ${params.version}`, { width: W, align: 'right' });
  doc.fillColor('#000');
  doc.y = Math.max(doc.y, hY + (logoBuf ? 46 : 0));
  doc.moveDown(1);

  // ── Emisor / Cliente / Obra ──────────────────────────────────────────────
  const merchantName = params.merchant.legalName || params.merchant.name || '—';
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK).text(`Emisor: `, { continued: true })
    .font('Helvetica').fillColor(BODY).text(merchantName);
  if (params.merchant.taxId) doc.fillColor(BODY).text(`NIF: ${params.merchant.taxId}`);
  if (params.merchant.address) doc.fillColor(BODY).text(params.merchant.address);
  if (params.merchant.whatsappPhone) doc.fillColor(BODY).text(`WhatsApp ${params.merchant.whatsappPhone}`);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fillColor(INK).text('Cliente: ', { continued: true })
    .font('Helvetica').fillColor(BODY).text(params.customerName || '—');
  if (params.obra) {
    doc.font('Helvetica-Bold').fillColor(INK).text('Obra: ', { continued: true })
      .font('Helvetica').fillColor(BODY).text(params.obra);
  }
  doc.fillColor('#000');
  doc.moveDown(1);

  // ── Tabla de líneas (concepto · cantidad · unidad — SIN precios) ────────
  const colConceptoW = W * 0.62;
  const colCantW = W * 0.18;
  const colUnidadW = W * 0.20;
  const rowPad = 6;

  function tableHeader() {
    const y = doc.y;
    doc.save();
    doc.rect(M, y, W, 20).fill(BG);
    doc.restore();
    doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED);
    doc.text('CONCEPTO', M + rowPad, y + 6, { width: colConceptoW - rowPad * 2 });
    doc.text('CANTIDAD', M + colConceptoW, y + 6, { width: colCantW - rowPad, align: 'right' });
    doc.text('UNIDAD', M + colConceptoW + colCantW + rowPad, y + 6, { width: colUnidadW - rowPad * 2 });
    doc.y = y + 24;
    doc.fillColor('#000').font('Helvetica');
  }

  tableHeader();
  if (params.lineas.length === 0) {
    doc.fontSize(10).fillColor(MUTED).text('Sin líneas.', M + rowPad, doc.y);
    doc.moveDown(0.5);
  }
  for (const l of params.lineas) {
    // Salto de página con recabecera si no cabe la fila
    if (doc.y + 26 > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
      tableHeader();
    }
    const y = doc.y;
    doc.fontSize(10).fillColor(BODY);
    doc.text(l.concepto, M + rowPad, y, { width: colConceptoW - rowPad * 2 });
    const rowH = Math.max(doc.y - y, 14);
    doc.text(fmtQty(l.cantidad), M + colConceptoW, y, { width: colCantW - rowPad, align: 'right' });
    doc.text(l.unidad || '—', M + colConceptoW + colCantW + rowPad, y, { width: colUnidadW - rowPad * 2 });
    doc.y = y + rowH + rowPad;
    doc.moveTo(M, doc.y - rowPad / 2).lineTo(M + W, doc.y - rowPad / 2).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.strokeColor('#000').lineWidth(1);
  }
  // Las celdas dejan doc.x en la última columna → sin este reset, Notas y el bloque
  // de firma salían alineados a la derecha y truncados (hallazgo suite v1.3, 13-jul).
  doc.x = M;
  doc.moveDown(1);

  // ── Notas ────────────────────────────────────────────────────────────────
  if (params.notas) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text('Notas:');
    doc.font('Helvetica').fillColor(BODY).text(params.notas, { width: W });
    doc.fillColor('#000');
    doc.moveDown(1);
  }

  // ── Bloque de firma (solo si firmado) — patrón del PDF del presupuesto ──
  if (params.signatureData) {
    try {
      const base64 = params.signatureData.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer = Buffer.from(base64, 'base64');
      const signDate = (params.firmadoAt ? new Date(params.firmadoAt) : new Date())
        .toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });

      if (doc.y + 130 > doc.page.height - doc.page.margins.bottom) doc.addPage();

      doc.moveTo(M, doc.y).lineTo(M + W, doc.y).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.strokeColor('#000').lineWidth(1);
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text('Conformidad del cliente:');
      doc.moveDown(0.3);
      doc.image(imgBuffer, M, doc.y, { width: 180, height: 70, fit: [180, 70] });
      doc.moveDown(5);
      doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(`Firmado el ${signDate}`);
      doc.fillColor('#000');
      doc.moveDown(0.5);
    } catch {
      // Si la imagen de firma falla, el PDF sale sin el bloque (no aborta)
    }
  }

  // ── Pie legal (texto EXACTO del brief §1.4) ──────────────────────────────
  if (doc.y + 50 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.moveDown(1);
  doc.fontSize(9).fillColor(MUTED).text(
    'Documento no fiscal — no constituye factura. Generado con YaQu · yaqu.app',
    M,
    doc.y,
    { width: W, align: 'center' },
  );

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { outPath };
}

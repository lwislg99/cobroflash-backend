// src/modules/jobs/infra/albaranPdf.service.ts — SCRUM-14 (ALBARAN-1) + SCRUM-65/67
// PDF del albarán / parte de trabajo. ARCHIVO SEPARADO del PDF fiscal a propósito
// (regla 24): aquí JAMÁS hay QR, serie fiscal ni la palabra "factura" en el título
// (solo la leyenda legal que la nombra para descartarla). Clona el patrón visual
// de generateQuotePdf (pdfkit, A4, tokens cálidos de DESIGN.md).
// SCRUM-65 (albarán VALORADO): puede llevar precios — sigue SIN validez fiscal
// (docs/legal/INVESTIGACION_ALBARANES.md §1.3). SCRUM-67: rotulación legal reforzada
// en AMBOS modos (fechas de emisión Y entrega, receptor, referencia al Trabajo).
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { albaranesDir } from '../../../core/storage/dirs';
import { loadLogoBuffer } from '../../invoicing/infra/pdf/pdf.service';
import type { AlbaranLinea, AlbaranModoValoracion, FirmaEvidencia } from '../domain/albaran.service';
import { COPY, etiquetaCalidad, decodificarCalidad } from '../domain/albaranFirmaCopy';

export async function generateAlbaranPdf(params: {
  merchantId: number; // SCRUM-48: prefija el nombre de archivo (mata la colisión entre merchants)
  numero: string;
  fecha: Date;              // fecha de entrega/ejecución (cuenta para el mes natural, SCRUM-17)
  emisionAt: Date;          // SCRUM-67: fecha de emisión del documento (Albaran.createdAt)
  version: number;
  modoValoracion: AlbaranModoValoracion;
  merchant: {
    name: string | null;
    legalName?: string | null;
    taxId?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    whatsappPhone?: string | null;
  };
  customer: { name: string | null; legalName?: string | null; taxId?: string | null };
  // SCRUM-300 (C5): DÓNDE y CUÁNDO se entregó, campos PROPIOS del albarán.
  // 🔴 SUELO: si vienen vacíos se imprimen vacíos («No se pidió al firmar» en los antiguos).
  // JAMÁS se sustituyen por el domicilio fiscal del emisor ni por el del cliente: una dirección
  // equivocada en un documento de entrega es peor que ninguna, porque se firma sin mirarla.
  lugarEntrega: string | null;
  fechaEntrega: Date | null;
  referenciaTrabajo: string | null; // SCRUM-67: Job.titulo (referencia al Trabajo/presupuesto origen)
  // SCRUM-300 (C5): quién firmó y en calidad de qué (null en todo lo firmado antes de la tarea).
  firmadoPorNombre?: string | null;
  firmadoPorCalidad?: string | null;
  lineas: AlbaranLinea[];
  totales: { base: number; cuota: number; total: number } | null; // solo en modo VALORADO
  notas?: string | null;
  signatureData?: string | null; // data-URI (solo si estado firmado)
  firmadoAt?: Date | null;
  // SCRUM-68: evidencias de firma para el certificado. ⚠️ ip/ua vienen en el objeto pero
  // NO se pintan (solo hash/firmante/canal/sello temporal). Ver bloque "Certificado".
  evidencia?: FirmaEvidencia | null;
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
  function fmtMoney(v: number) {
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  const valorado = params.modoValoracion === 'VALORADO';

  // ── Cabecera: logo izquierda, título derecha ─────────────────────────────
  const hY = doc.y;
  if (logoBuf) {
    try { doc.image(logoBuf, M, hY, { height: 40, fit: [110, 40] }); } catch { /* logo inválido */ }
  }
  doc.fontSize(16).font('Helvetica-Bold').fillColor(INK)
    .text('ALBARÁN / PARTE DE TRABAJO', M, hY, { width: W, align: 'right' });
  doc.fontSize(11).font('Helvetica').fillColor(MUTED)
    .text(`Albarán ${params.numero} · Versión ${params.version}`, { width: W, align: 'right' })
    // SCRUM-67: fecha de EMISIÓN del documento y fecha de ENTREGA/EJECUCIÓN por separado
    // (esta última es la que cuenta para el mes natural de la recapitulativa, SCRUM-17).
    .text(`Emitido: ${fmtDate(params.emisionAt)} · Entrega/ejecución: ${fmtDate(params.fecha)}`, { width: W, align: 'right' });
  doc.fillColor('#000');
  doc.y = Math.max(doc.y, hY + (logoBuf ? 46 : 0));
  doc.moveDown(1);

  // ── Emisor / Receptor / Obra / Referencia ────────────────────────────────
  const merchantName = params.merchant.legalName || params.merchant.name || '—';
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK).text(`Emisor: `, { continued: true })
    .font('Helvetica').fillColor(BODY).text(merchantName);
  if (params.merchant.taxId) doc.fillColor(BODY).text(`NIF: ${params.merchant.taxId}`);
  if (params.merchant.address) doc.fillColor(BODY).text(params.merchant.address);
  if (params.merchant.whatsappPhone) doc.fillColor(BODY).text(`WhatsApp ${params.merchant.whatsappPhone}`);
  doc.moveDown(0.5);
  // SCRUM-67: receptor "ídem" (snapshot) — nombre + NIF si el cliente lo tiene registrado
  // (Customer.legalName/taxId, A20.4). No hay domicilio de cliente en el modelo hoy (el
  // propio PDF de factura fiscal tampoco lo imprime); se añade cuando exista la fuente.
  doc.font('Helvetica-Bold').fillColor(INK).text('Receptor: ', { continued: true })
    .font('Helvetica').fillColor(BODY).text(params.customer.legalName || params.customer.name || '—');
  if (params.customer.taxId) doc.fillColor(BODY).text(`NIF: ${params.customer.taxId}`);
  // SCRUM-300 (C5): LUGAR y FECHA de entrega. Se pintan SIEMPRE en un albarán firmado —también
  // cuando faltan— porque el hueco callado se lee como un fallo nuestro. `firmadoAt` distingue
  // «firmado sin estos datos» (los de antes de la tarea) de un borrador que aún puede rellenarlos.
  const firmado = !!params.firmadoAt;
  if (params.lugarEntrega || firmado) {
    doc.font('Helvetica-Bold').fillColor(INK).text(`${COPY.lugarEntrega.label}: `, { continued: true })
      .font('Helvetica').fillColor(params.lugarEntrega ? BODY : MUTED)
      .text(params.lugarEntrega || COPY.noSePidio);
  }
  if (params.fechaEntrega || firmado) {
    doc.font('Helvetica-Bold').fillColor(INK).text(`${COPY.fechaEntrega.label}: `, { continued: true })
      .font('Helvetica').fillColor(params.fechaEntrega ? BODY : MUTED)
      .text(params.fechaEntrega ? fmtDate(params.fechaEntrega) : COPY.noSePidio);
  }
  if (params.referenciaTrabajo) {
    doc.font('Helvetica-Bold').fillColor(INK).text('Referencia: ', { continued: true })
      .font('Helvetica').fillColor(BODY).text(params.referenciaTrabajo);
  }
  doc.fillColor('#000');
  doc.moveDown(1);

  // ── Tabla de líneas ───────────────────────────────────────────────────────
  // SIN_VALORAR: concepto · cantidad · unidad (sin precios, como siempre).
  // VALORADO (SCRUM-65): + precio unitario e importe por línea. SIN desglose de
  // cuota de IVA por tipo (a propósito: no debe leerse como una factura).
  const colConceptoW = valorado ? W * 0.36 : W * 0.62;
  const colCantW = valorado ? W * 0.12 : W * 0.18;
  const colUnidadW = valorado ? W * 0.12 : W * 0.20;
  const colPrecioW = W * 0.18;
  const colImporteW = W * 0.22;
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
    if (valorado) {
      doc.text('PRECIO UD.', M + colConceptoW + colCantW + colUnidadW, y + 6, { width: colPrecioW - rowPad, align: 'right' });
      doc.text('IMPORTE', M + colConceptoW + colCantW + colUnidadW + colPrecioW, y + 6, { width: colImporteW - rowPad, align: 'right' });
    }
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
    if (valorado && l.precioUnitario !== undefined && l.precioUnitario !== null) {
      const importe = Number(l.precioUnitario) * Number(l.cantidad);
      doc.text(fmtMoney(l.precioUnitario), M + colConceptoW + colCantW + colUnidadW, y, { width: colPrecioW - rowPad, align: 'right' });
      doc.text(fmtMoney(importe), M + colConceptoW + colCantW + colUnidadW + colPrecioW, y, { width: colImporteW - rowPad, align: 'right' });
    }
    doc.y = y + rowH + rowPad;
    doc.moveTo(M, doc.y - rowPad / 2).lineTo(M + W, doc.y - rowPad / 2).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.strokeColor('#000').lineWidth(1);
  }
  // Las celdas dejan doc.x en la última columna → sin este reset, Notas y el bloque
  // de firma salían alineados a la derecha y truncados (hallazgo suite v1.3, 13-jul).
  doc.x = M;
  doc.moveDown(1);

  // ── Totales orientativos (solo VALORADO) — base + total, SIN desglose de cuota ──
  if (valorado && params.totales) {
    doc.font('Helvetica').fontSize(10).fillColor(BODY)
      .text(`Base: ${fmtMoney(params.totales.base)}`, M, doc.y, { width: W, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK)
      .text(`Total: ${fmtMoney(params.totales.total)}`, M, doc.y, { width: W, align: 'right' });
    doc.fillColor('#000').font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('Importes orientativos; el IVA y la factura se emitirán conforme a la normativa vigente.', M, doc.y, { width: W, align: 'right' });
    doc.fillColor('#000');
    doc.moveDown(1);
  }

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
      // SCRUM-300 (C5): QUIÉN firmó, debajo del trazo. Sin esto teníamos la mejor firma del
      // mercado y guardábamos un garabato anónimo, que no identifica a nadie.
      doc.fontSize(9).font('Helvetica-Bold').fillColor(INK)
        .text(`${COPY.firmadoPorNombre.label}: `, { continued: true })
        .font('Helvetica').fillColor(params.firmadoPorNombre ? BODY : MUTED)
        .text(params.firmadoPorNombre || COPY.noSePidio);
      // Un `id` que no reconocemos NO se pinta: `etiquetaCalidad` devuelve null y aquí se calla.
      // Antes esto imprimía la cadena "null" en el documento firmado.
      const etiqueta = etiquetaCalidad(params.firmadoPorCalidad);
      if (etiqueta) {
        const { textoLibre } = decodificarCalidad(params.firmadoPorCalidad!);
        doc.fontSize(8).font('Helvetica').fillColor(MUTED)
          .text(textoLibre ? `${etiqueta} · ${textoLibre}` : etiqueta);
      }
      doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(`Firmado el ${signDate}`);
      doc.fillColor('#000');
      doc.moveDown(0.5);
    } catch {
      // Si la imagen de firma falla, el PDF sale sin el bloque (no aborta)
    }
  }

  // ── Certificado de evidencias (SCRUM-68 · solo si hay firma sellada) ──────
  // Prueba QUIÉN firmó, CUÁNDO (reloj del servidor), por qué CANAL y sobre qué CONTENIDO
  // (hash SHA-256 canónico, no del PDF). ⚠️ NUNCA se imprime ip/ua (dato personal): quedan
  // solo en la BD para requerimiento legal. La fuerza probatoria final la valora el juez.
  if (params.evidencia && params.evidencia.contentHash) {
    const ev = params.evidencia;
    if (doc.y + 120 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.moveDown(0.8);
    const boxY = doc.y;
    const sello = new Date(ev.firmadoAt).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const canalTxt = ev.canal === 'remoto' ? 'Firma remota (enlace por WhatsApp)' : 'Firma presencial (in situ)';
    const rows: Array<[string, string]> = [
      ['Firmante', ev.firmante || 'Cliente'],
      ['Sello temporal', `${sello} (hora del servidor)`],
      ['Canal', canalTxt],
      ['Integridad', `SHA-256: ${ev.contentHash}`],
    ];
    doc.fontSize(9).font('Helvetica-Bold').fillColor(INK).text('Certificado de evidencias de la firma', M, boxY);
    doc.moveDown(0.3);
    for (const [k, v] of rows) {
      const y = doc.y;
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(MUTED).text(k, M, y, { width: 90 });
      doc.fontSize(7.5).font('Helvetica').fillColor(BODY).text(v, M + 92, y, { width: W - 92 });
      doc.moveDown(0.15);
    }
    doc.moveDown(0.2);
    doc.fontSize(6.5).font('Helvetica-Oblique').fillColor(MUTED).text(
      'El hash certifica la integridad del contenido firmado (no del archivo PDF). YaQu conserva ' +
      'evidencias técnicas adicionales asociadas a esta firma, disponibles a requerimiento legal. ' +
      'La valoración de su fuerza probatoria corresponde a la autoridad competente.',
      M, doc.y, { width: W },
    );
    doc.fillColor('#000');
    doc.moveDown(0.5);
  }

  // ── Pie legal (SCRUM-67 · texto EXACTO del brief, en AMBOS modos) ─────────
  if (doc.y + 50 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.moveDown(1);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text(
    'Documento sin validez fiscal. No es una factura.',
    M, doc.y, { width: W, align: 'center' },
  );
  doc.fontSize(8).font('Helvetica').fillColor(MUTED).text(
    'Generado con YaQu · yaqu.app',
    M, doc.y, { width: W, align: 'center' },
  );

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { outPath };
}

// src/modules/invoicing/infra/pdf/pdf.service.ts
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { invoicesDir } from '../../../../core/storage/dirs';
import { cantidadDeLinea } from '../../domain/vat.service'; // SCRUM-504: una sola cantidad
import { getLocale } from '../../../../core/i18n/locales';
import { formatImporteEs } from '../../../../core/utils/utils'; // SCRUM-636: el sitio unico
import { nombreParaDocumento } from '../../../../core/documentos/nombreParaDocumento'; // SCRUM-577
import { partirConceptoYDescripcion } from './conceptoLinea'; // SCRUM-603 (DOC-13)
// SCRUM-656 (T7): CÓMO se presenta el IVA de un PRESUPUESTO y sus cláusulas de cierre. El
// cálculo sigue siendo `calcVatBreakdown`; estos módulos solo deciden qué se pinta.
import { pieDePresupuesto, leerModoIva } from '../../../quotes/domain/presentacionIva';
import { clausulasParaDocumento } from '../../../quotes/domain/clausulas';

/**
 * Un importe, con sus dos decimales. SCRUM-604 (DOC-14) · RESUELTO en SCRUM-636.
 *
 * ⚠️ ESTE BLOQUE DECÍA LO CONTRARIO Y SE REESCRIBE EN VEZ DE BORRARSE. Decía que `fmtImporte` y el
 * `fmt` de dentro de la factura «no se han unificado A PROPÓSITO», y declaraba —bien— que la misma
 * expresión estaba copiada en seis sitios más y que **no existía un formateador de dinero
 * compartido en `src/`**. Las dos cosas ya no son ciertas, y dejarlas escritas mandaría a quien las
 * lea a resolver un problema que ya está resuelto.
 *
 * Lo que pasó: SCRUM-604 dijo «la factura NO se toca» y `scrum604b` vigiló la divergencia, que era
 * lo que se podía hacer entonces. SCRUM-636 midió lo que aquello ocultaba — que
 * `toLocaleString('es-ES')` NO agrupa los enteros de cuatro cifras (CLDR), así que el documento
 * escribía `1000,00` y `12.345,67`, incoherente consigo mismo justo en la banda del importe
 * corriente de un trabajo— y el fundador decidió la convención española en LOS CINCO sitios.
 *
 * El sitio único es `formatImporteEs` (`core/utils/utils.ts`), el mismo algoritmo que SCRUM-436
 * fijó para el front: medido, 10/10 salidas idénticas sobre los valores de borde de SCRUM-625.
 */
/**
 * SCRUM-623 · El rótulo de la columna de BASES del desglose por tipo.
 *
 * La FORMA la decidió el fundador (una fila por tipo, con su base y su cuota); la PALABRA no
 * está escrita, y no me toca escribirla (regla 30). Sale con marcador A PROPÓSITO: es la única
 * forma de que nadie encienda por descuido un rótulo sin firmar en un documento fiscal.
 *
 * ⚠️ SE VE EN EL PDF. Sólo en facturas de MÁS DE UN TIPO, y hoy eso no llega a un cliente real:
 * `INVOICING_ES_ENABLED` está OFF para merchants ES (regla 24) y la demo lleva marca de agua.
 * Aun así, esto hay que apagarlo escribiendo la palabra, no dejándolo correr.
 */
export const MARCADOR_MICROCOPY_DESGLOSE = '[PENDIENTE microcopy oficial]';

/**
 * SCRUM-593 (DOC-03) · El título del bloque FINAL del documento.
 *
 * ✅ APROBADO por el fundador el 2-sep-2026: «Observaciones», literal y sin variantes, en los tres
 * documentos. **NO lleva marcador**: marcar texto firmado obligaría a refirmarlo.
 */
export const TITULO_OBSERVACIONES = 'Observaciones';

/**
 * SCRUM-593 (DOC-03) · EL BLOQUE DE CABECERA NO LLEVA RÓTULO. Decisión del fundador, 2-sep-2026.
 *
 * Aquí vivía un `MARCADOR_MICROCOPY_CABECERA_DOC` esperando a que se firmara un rótulo. Lo que se
 * firmó fue **que no hay rótulo**: en el documento se imprime sólo el texto del profesional. El
 * rótulo aprobado —«Añadir texto en el documento»— es del FORMULARIO, no del papel, y por eso vive
 * en `public/dashboard/js/textoDelDocumento.js` y no aquí.
 *
 * ⚠️ EL PDF QUEDA ASIMÉTRICO A PROPÓSITO: arriba, texto sin rótulo; abajo, «Observaciones» con el
 * suyo. Es lo pedido, no un descuido — queda registrado en `docs/master/SCRUM-593.md` para que
 * dentro de seis meses nadie lo lea como incoherencia y lo «arregle».
 */

/**
 * SCRUM-623 (enmienda) · EL NOMBRE DEL IMPUESTO ES UN DATO, NO UNA CONSTANTE DE LA MAQUETA.
 *
 * Canarias es mercado, y un profesional canario NO repercute IVA: repercute **IGIC**, con tipos
 * propios. En Ceuta y Melilla, **IPSI**. Si el nombre estuviera grabado en la forma del
 * desglose, abrirle la puerta después obligaría a rehacer el bloque de totales de un documento
 * ya emitido — caro, y con la regla 29 delante. Hoy sale gratis: se recibe por parámetro.
 *
 * 🔴 Y POR QUÉ ESTE VALOR NO SE RESUELVE AQUÍ, que es la parte que importa:
 *
 * Existe `locale.vatName` (`core/i18n/locales.ts`), que ya vale `IGV` en Perú y que el desglose
 * del PRESUPUESTO de este mismo fichero ya consume. **NO se reutiliza, y no es por capricho:
 * está indexado por PAÍS, y Canarias es `ES`.** Resolver el nombre desde el país le daría `IVA`
 * a un canario — o sea, una forma que PARECE neutral y no lo es, que es justo lo que no puede
 * pasar. Y medido: `Merchant` no tiene ningún campo de territorio fiscal; su única columna
 * geográfica es `country`. Con el dato de hoy, QUÉ IMPUESTO APLICA NO ES RESOLUBLE.
 *
 * Así que esto abre la puerta y no la cruza: la MAQUETA queda neutral y quien sepa el impuesto
 * lo pasa. Mientras nadie lo pase, el papel sale exactamente igual que hasta hoy.
 *
 * ⚠️ Este valor por defecto es el de la España peninsular y NO es una decisión fiscal: es lo
 * que el documento ya imprimía. El día que alguien resuelva el territorio, se pasa y ya está.
 */
export const NOMBRE_IMPUESTO_POR_DEFECTO = 'IVA';

export function fmtImporte(v: number): string {
  // SCRUM-636 · DELEGA en el sitio único del dinero. Lo que había aquí NO era una política: era un
  // artefacto de CLDR. `toLocaleString('es-ES')` no agrupa los enteros de CUATRO cifras, así que
  // este documento escribía `1000,00` y `12.345,67` — incoherente CONSIGO MISMO, y fallando justo
  // en la banda 1.000–9.999 €, que es el importe corriente de un trabajo. Medido en SCRUM-636.
  return formatImporteEs(v);
}

/** Descarga el logo del merchant como Buffer para PDFKit.
 *  Acepta URL http/https o data URIs base64.
 *  Devuelve null si falla (no aborta la generación del PDF).
 *  Exportada (SCRUM-14): la reutiliza el PDF del albarán (albaranPdf.service). */
export async function loadLogoBuffer(logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    if (logoUrl.startsWith('data:')) {
      const b64 = logoUrl.split(',')[1];
      if (!b64) return null;
      return Buffer.from(b64, 'base64');
    }
    if (logoUrl.startsWith('http')) {
      const resp = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 5_000 });
      return Buffer.from(resp.data);
    }
    // Ruta local (empieza por /)
    if (logoUrl.startsWith('/')) {
      const filePath = path.join(process.cwd(), 'public', logoUrl);
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    }
  } catch {
    // logo no cargado — continuar sin él
  }
  return null;
}

export async function generateInvoicePdf(params: {
  number: string;
  // SCRUM-72: id para la URL del endpoint auth y merchantId para el nombre de fichero
  // (la serie es única POR merchant → sin el prefijo, dos merchants con "2026-CF-001"
  // se pisaban el PDF en disco).
  invoiceId: number;
  merchantId: number;
  // A2.4: datos del emisor completos (teléfono/email opcionales)
  merchant: { name: string; legalName?: string | null; taxId?: string | null; address?: string | null; logoUrl?: string | null; phone?: string | null; email?: string | null };
  // SCRUM-577 (CONT-04) · `legalName` ENTRA AQUÍ, y hasta hoy no estaba.
  //
  // 🔴 Medido antes de tocar: este tipo NO lo llevaba, así que **la factura sólo podía imprimir
  // `name`** — mientras el PDF de presupuesto sí prefería la denominación legal desde su
  // `legalName || name`. O sea, la asignación estaba al revés de lo que el ticket daba por hecho:
  // «la factura quiere la denominación legal».
  //
  // Opcional a propósito: quien no lo pase sigue funcionando exactamente igual que antes.
  customer: { name: string; legalName?: string | null; email?: string | null; phone?: string | null };
  currency: string;
  total: string;
  qrData: string;
  vfHash?: string | null;
  createdAt?: Date | null;
  lines?: Array<{ concept: string; qty: number; price: number; tax: number }> | null;
  type?: string | null;            // 'F1' (default) | 'R1' rectificativa | 'JUST' justificante (V0-0)
  rectifiesNumber?: string | null; // nº de la factura original (solo R1)
  watermark?: string | null;       // texto diagonal en cada página (demo: "DEMO — no válida fiscalmente")
  stageLabel?: string | null;      // SCRUM-33: etiqueta del tramo (SCRUM-27), null en presets — se omite si no hay
  // SCRUM-623 (enmienda) · el NOMBRE del impuesto que se repercute: `IVA`, `IGIC` (Canarias),
  // `IPSI` (Ceuta y Melilla), `IGV`… Viene de FUERA porque la maqueta no puede saberlo: ver
  // `NOMBRE_IMPUESTO_POR_DEFECTO`. Sin él, el documento sale exactamente como hasta hoy.
  taxName?: string | null;
}) {
  const fileName = `${params.merchantId}-${params.number}.pdf`; // SCRUM-72
  const outPath  = path.join(invoicesDir, fileName);
  const isVF     = !!params.vfHash;
  // V0-0: justificante de cobro — sin numeración de factura, sin QR, copy sin "factura"
  const isReceipt = params.type === 'JUST';
  const hasLines = Array.isArray(params.lines) && params.lines.length > 0;

  const [qrBuf, logoBuf] = await Promise.all([
    isReceipt ? Promise.resolve(null) : QRCode.toBuffer(params.qrData, { type: 'png', width: 200 }),
    loadLogoBuffer(params.merchant.logoUrl),
  ]);

  // A2.4: tokens de DESIGN.md adaptados a papel — neutros CÁLIDOS (nunca el
  // gris azulado de oficina) y el verde de marca como acento escaso.
  const INK    = '#0f1c17';
  const BODY   = '#3f4a45';
  const MUTED  = '#6b756f';
  const BORDER = '#e7e9e5';
  const BG     = '#f6f7f5';
  const BRAND  = '#16a34a';

  const doc    = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // A2.4: banda de marca fina arriba de cada página (membrete premium, sobrio)
  function drawBrandBand() {
    const px = doc.x, py = doc.y;
    doc.save();
    doc.rect(0, 0, doc.page.width, 5).fill(BRAND);
    doc.restore();
    doc.fillColor('#000');
    doc.x = px; doc.y = py;
  }
  drawBrandBand();
  doc.on('pageAdded', drawBrandBand);

  // Marca de agua diagonal (V0-0: facturas del merchant demo) — bajo el contenido,
  // en cada página del documento.
  function drawWatermark() {
    if (!params.watermark) return;
    const px = doc.x, py = doc.y;
    doc.save();
    doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.font('Helvetica-Bold').fontSize(42).fillColor('#dc2626').opacity(0.13)
      .text(params.watermark, 0, doc.page.height / 2 - 24, { width: doc.page.width, align: 'center' });
    doc.opacity(1);
    doc.restore();
    doc.fillColor('#000');
    doc.x = px; doc.y = py;
  }
  drawWatermark();
  doc.on('pageAdded', drawWatermark);

  const M   = 50;
  const W   = doc.page.width - M * 2;   // 495
  const PB  = doc.page.height - M;      // bottom boundary

  function hLine(y?: number, color = BORDER) {
    const yy = y ?? doc.y;
    doc.moveTo(M, yy).lineTo(M + W, yy).strokeColor(color).lineWidth(0.5).stroke();
    doc.strokeColor('#000').lineWidth(1);
  }

  // SCRUM-636 · la copia de la FACTURA delega tambien. Era el mismo cuerpo que `fmtImporte`
  // —`scrum604b` lo vigilaba— y ahora los dos salen del sitio unico.
  function fmt(v: number) {
    return fmtImporte(v);
  }

  function dateStr(d: Date | null | undefined) {
    if (!d) return '—';
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  // ── 1. CABECERA SUPERIOR ─────────────────────────────────────────────────
  const headerY = doc.y;

  // Logo a la izquierda (si existe)
  if (logoBuf) {
    try {
      doc.image(logoBuf, M, headerY, { height: 44, fit: [120, 44] });
    } catch { /* logo inválido, ignorar */ }
  }

  // Título "FACTURA" / "FACTURA RECTIFICATIVA" / "JUSTIFICANTE DE COBRO" + Nº/Ref + Fecha
  const isRect = params.type === 'R1';
  const docTitle = isReceipt ? 'JUSTIFICANTE DE COBRO' : isRect ? 'FACTURA RECTIFICATIVA' : 'FACTURA';
  // SCRUM-623 (enmienda) · una sola vez y desde fuera. Tres sitios de este documento lo usan;
  // tres copias volverían a divergir, y la que divergiera sería la que nadie mira.
  const impuesto = params.taxName || NOMBRE_IMPUESTO_POR_DEFECTO;
  doc.fontSize(isRect || isReceipt ? 17 : 22).font('Helvetica-Bold')
    .fillColor(isRect ? '#dc2626' : INK)
    .text(docTitle, M, headerY, { width: W, align: 'right' });
  doc.fontSize(10).font('Helvetica').fillColor(MUTED)
    .text(isReceipt ? `Ref. ${params.number}` : `Nº ${params.number}`, { align: 'right' });
  doc.text(`Fecha: ${dateStr(params.createdAt)}`, { align: 'right' });
  if (isRect && params.rectifiesNumber) {
    doc.text(`Rectifica a la factura Nº ${params.rectifiesNumber}`, { align: 'right' });
  }
  // SCRUM-33: etiqueta del tramo (Anticipo/Hito 1/…), solo si existe (null en presets).
  if (params.stageLabel) {
    doc.text(params.stageLabel, { align: 'right' });
  }
  doc.fillColor('#000');

  // Avanzar por debajo del logo (si lo hay) o del texto
  doc.y = Math.max(doc.y, headerY + (logoBuf ? 50 : 0));
  doc.moveDown(0.5);

  hLine();
  doc.moveDown(0.6);

  // ── 2. EMISOR / CLIENTE (dos columnas) ────────────────────────────────────
  const colY   = doc.y;
  const colW   = (W / 2) - 10;
  const col2X  = M + colW + 20;

  // Columna izquierda: emisor (A2.4: datos completos, con teléfono/email)
  const emisor = params.merchant.legalName || params.merchant.name;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED).text('EMISOR', M, colY);
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text(emisor, { width: colW });
  doc.font('Helvetica').fontSize(9).fillColor(BODY);
  if (params.merchant.taxId)  doc.text(`NIF/CIF: ${params.merchant.taxId}`, { width: colW });
  if (params.merchant.address) doc.text(params.merchant.address, { width: colW });
  if (params.merchant.phone)  doc.text(params.merchant.phone, { width: colW });
  if (params.merchant.email)  doc.text(params.merchant.email, { width: colW });

  // Columna derecha: cliente (posicionado desde colY)
  const clientY = colY;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED).text('CLIENTE', col2X, clientY, { width: colW });
  const clientTextY = clientY + 16;
  // SCRUM-577: el nombre sale del SITIO UNICO, el mismo criterio que ya usaba el presupuesto.
  // 🔴 El respaldo es `params.customer.name` y no `'—'`: aqui `name` es OBLIGATORIO en el tipo,
  // asi que un cliente SIN legalName imprime EXACTAMENTE lo que imprimia antes. Ese es el
  // control que manda en un cambio del camino de emision.
  const nombreCliente = nombreParaDocumento(params.customer, params.customer.name);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text(nombreCliente, col2X, clientTextY, { width: colW });
  doc.font('Helvetica').fontSize(9).fillColor(BODY);
  let cy = clientTextY + 14;
  if (params.customer.email) { doc.text(params.customer.email, col2X, cy, { width: colW }); cy += 13; }
  if (params.customer.phone) { doc.text(params.customer.phone, col2X, cy, { width: colW }); }

  // Avanzar cursor por debajo de ambas columnas
  doc.y = Math.max(doc.y, cy + 16);
  doc.fillColor('#000').moveDown(0.4);
  hLine();
  doc.moveDown(0.5);

  // ── 3. TABLA DE LÍNEAS ────────────────────────────────────────────────────
  if (hasLines) {
    const lines = params.lines!;

    // Anchos de columnas
    const XC  = M;      const WC  = 210;  // concepto
    const XQ  = XC+WC+4; const WQ = 40;  // cant
    const XP  = XQ+WQ+4; const WP = 72;  // precio unit
    const XIV = XP+WP+4; const WIV= 44;  // IVA%
    const XT  = XIV+WIV+4; const WT = W - (XT - M); // total línea

    // Cabecera tabla
    doc.rect(M, doc.y, W, 16).fill(BG);
    const thY = doc.y + 4;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
    doc.text('CONCEPTO',    XC,  thY, { width: WC });
    doc.text('CANT.',       XQ,  thY, { width: WQ,  align: 'right' });
    doc.text('PRECIO UNIT', XP,  thY, { width: WP,  align: 'right' });
    doc.text(`${impuesto} %`, XIV, thY, { width: WIV, align: 'right' });
    doc.text('TOTAL',       XT,  thY, { width: WT,  align: 'right' });
    doc.y += 16;
    hLine(doc.y, BORDER);
    doc.fillColor(INK);

    // Filas
    lines.forEach((l, i) => {
      const qty    = cantidadDeLinea(l.qty); // SCRUM-504
      const price  = Number(l.price) || 0;
      const taxR   = Number(l.tax)   || 0;
      const lineTotal = qty * price * (1 + taxR);
      const bg = i % 2 === 0 ? '#fff' : BG;

      // ── SCRUM-603 (DOC-13): el concepto y su DESCRIPCIÓN, separados ──────────────────
      // La descripción viaja dentro del concepto, detrás de un salto de línea (lo compone el
      // editor cuando el profesional marca «Incluir descripción en el PDF»). Hasta hoy esta
      // tabla imprimía el concepto ENTERO de una vez: la descripción salía —el salto se
      // respeta— pero con el MISMO tamaño y peso, así que no se leía como una descripción.
      // El PDF de presupuesto ya la separaba; la partición es ahora la MISMA función para los
      // dos (`conceptoLinea.ts`), no una segunda copia.
      const { titulo: cTitulo, descripcion: cDesc } = partirConceptoYDescripcion(l.concept);
      const tituloVisible = cTitulo || '—';

      // Calcular altura de fila. La descripción se mide CON SU PROPIO tamaño: medirla con el
      // del concepto dejaría la fila corta y el texto se pisaría con la de abajo.
      doc.font('Helvetica').fontSize(9);
      const conceptH = doc.heightOfString(tituloVisible, { width: WC });
      doc.fontSize(8);
      const descH = cDesc ? doc.heightOfString(cDesc, { width: WC }) : 0;
      doc.fontSize(9);
      const rowH = Math.max(20, conceptH + (cDesc ? 2 + descH : 0) + 8);

      // Salto de página si no cabe
      if (doc.y + rowH > PB - 80) { doc.addPage(); hLine(); }

      const rowY = doc.y;
      doc.rect(M, rowY, W, rowH).fill(bg);
      doc.fillColor(BODY);

      doc.font('Helvetica').fontSize(9);
      doc.text(tituloVisible, XC, rowY + 4, { width: WC });
      if (cDesc) {
        // Menor tamaño y tinta suave — el MISMO gris que el profesional ya ve en la vista
        // previa del editor (`quotesView.js` la pinta con `#6b756f`), para que el documento no
        // le enseñe otra cosa distinta de la que le prometió la pantalla.
        doc.fontSize(8).fillColor(MUTED)
          .text(cDesc, XC, rowY + 4 + conceptH + 2, { width: WC });
        doc.fontSize(9).fillColor(BODY);
      }
      doc.text(fmt(qty),              XQ,  rowY + 4, { width: WQ,  align: 'right' });
      doc.text(fmt(price),            XP,  rowY + 4, { width: WP,  align: 'right' });
      doc.text(taxR > 0 ? `${(taxR*100).toFixed(0)}%` : '—', XIV, rowY + 4, { width: WIV, align: 'right' });
      doc.font('Helvetica-Bold')
        .text(fmt(lineTotal),         XT,  rowY + 4, { width: WT,  align: 'right' });
      doc.font('Helvetica');

      doc.y = rowY + rowH;
      hLine(doc.y, BORDER);
    });

    doc.moveDown(0.4);

    // ── 4. TOTALES ────────────────────────────────────────────────────────
    // Agrupar IVA por tipo
    type VatGroup = { base: number; vat: number };
    const vatMap: Record<string, VatGroup> = {};
    let subtotal = 0;
    lines.forEach((l) => {
      const qty  = cantidadDeLinea(l.qty); // SCRUM-504
      const p    = Number(l.price) || 0;
      const t    = Number(l.tax)   || 0;
      const base = qty * p;
      subtotal += base;
      const key = `${(t*100).toFixed(0)}%`;
      if (!vatMap[key]) vatMap[key] = { base: 0, vat: 0 };
      vatMap[key].base += base;
      vatMap[key].vat  += base * t;
    });
    const totalVat = Object.values(vatMap).reduce((a, b) => a + b.vat, 0);
    const grandTotal = subtotal + totalVat;

    const totalsX = M + W / 2;
    const totalsW = W / 2;

    doc.rect(totalsX, doc.y, totalsW, 1).fill('#e2e8f0');
    doc.moveDown(0.3);

    // Subtotal
    const ty0 = doc.y;
    doc.fontSize(9).font('Helvetica').fillColor(BODY)
      .text('Base imponible:', totalsX, ty0, { width: totalsW * 0.6 })
      .text(fmt(subtotal) + ' ' + params.currency, totalsX + totalsW * 0.6, ty0, { width: totalsW * 0.4, align: 'right' });
    doc.moveDown(0.4);

    // ═══════════════════════════════════════════════════════════════════════════════════
    // 🔴 SCRUM-623 · UNA FILA POR TIPO, CON SU BASE Y SU CUOTA.
    //
    // LO QUE PASABA, medido leyendo el TEXTO del PDF (instrumento de SCRUM-604):
    //
    //     Base imponible: 105,00   IVA 21%: 12,60   TOTAL: 117,60
    //
    // El total CUADRA y el cliente paga bien. Lo que no se puede es cuadrarlo DESDE EL PAPEL:
    // 105 × 21 % = 22,05, no 12,60. Faltan 9,45 € que el documento no explica, porque la
    // segunda base —45 € al 0 %— no aparecía por ninguna parte.
    //
    // ⚠️ Y EL ENUNCIADO EXACTO NO ES «imprime una sola fila». Medido, son DOS defectos:
    //   ① `if (g.vat === 0) return` SALTABA el tipo cuya cuota es cero (0 %, exento, suplido),
    //      así que su base desaparecía del papel aunque estuviera sumada en «Base imponible».
    //   ② Y aun con dos tipos que SÍ tienen cuota —21 % y 10 %— se imprimían dos cuotas y UNA
    //      sola base agregada: tampoco se sabe qué base va con qué tipo.
    // O sea que la propiedad que falla en TODOS los casos mixtos es: **las BASES no se
    // imprimen por tipo**. Es lo que arregla esto.
    //
    // ── DE DÓNDE SALEN LAS CIFRAS, Y POR QUÉ NO DE `calcVatBreakdown` ──────────────────
    // 🛑 Existe `calcVatBreakdown` (vat.service), que YA devuelve `{rate, base, cuota}` por tipo
    // y que alimenta el libro, el modelo 303 y el XML de VeriFactu. Lo natural sería consumirla
    // aquí y borrar este mapa. NO SE HACE, y no es pereza: MEDIDO sobre 4.006 combinaciones,
    // **cambiaría alguna cifra impresa en 547 de ellas** (un céntimo en la cuota y en el total),
    // porque aquella redondea base y cuota POR SEPARADO y ésta no redondea hasta `fmt`.
    // Cambiar una cifra de una factura no es este ticket. Queda escrito en docs/master/SCRUM-623.md.
    //
    // Así que las cifras salen del MISMO `vatMap` de arriba, que ya venía acumulando `base` por
    // tipo sin imprimirla nunca. **Ni una operación aritmética nueva.**
    //
    // ── UN SOLO TIPO: EXACTAMENTE COMO HASTA HOY ──────────────────────────────────────
    // El desglose sólo aparece cuando hay MÁS DE UN TIPO. Con uno solo el papel ya era
    // reconstruible (base × tipo = cuota) y no había nada que arreglar; tocarlo sería mover algo
    // que estaba bien. Eso incluye la factura íntegramente al 0 %: sigue sin fila de IVA.
    //
    // ── Y POR QUÉ ESTA FORMA SIRVE A LAS DOS RESPUESTAS DE SCRUM-619 ──────────────────
    // Sigue abierta la pregunta a la asesoría de si el suplido va DENTRO de la base imponible
    // (hoy, como una base al 0 %) o FUERA (que es lo que dice `suplidos.ts`). Este bloque está
    // cerrado sobre TIPOS IMPOSITIVOS, no sobre la naturaleza de la línea:
    //   · si va DENTRO → el suplido ES la fila del 0 %, y «Base imponible» lo incluye;
    //   · si va FUERA  → esa fila desaparece de aquí y el suplido baja a una línea PROPIA fuera
    //     del bloque. La forma del bloque no cambia: tiene una fila menos.
    // 🔴 POR ESO LA FILA SE ROTULA POR SU TIPO Y NUNCA COMO «suplido». Si se etiquetara por la
    // naturaleza, la respuesta «FUERA» rompería la maqueta. Y además hoy el dato NO distingue un
    // suplido de una exención: los dos son una línea al 0 % (medido en SCRUM-619).
    // ═══════════════════════════════════════════════════════════════════════════════════
    const tiposDeIva = Object.entries(vatMap);

    if (tiposDeIva.length <= 1) {
      tiposDeIva.forEach(([rate, g]) => {
        if (g.vat === 0) return;
        const vy = doc.y;
        doc.text(`${impuesto} ${rate}:`, totalsX, vy, { width: totalsW * 0.6 })
          .text(fmt(g.vat) + ' ' + params.currency, totalsX + totalsW * 0.6, vy, { width: totalsW * 0.4, align: 'right' });
        doc.moveDown(0.4);
      });
    } else {
      // El rótulo de la columna de bases es TEXTO NUEVO y no me toca escribirlo (regla 30). Va
      // como marcador y UNA sola vez: la fila la describen el tipo y el importe, que son dato.
      doc.text(MARCADOR_MICROCOPY_DESGLOSE, totalsX, doc.y, { width: totalsW });
      doc.moveDown(0.3);

      // Orden descendente por tipo, igual que `calcVatBreakdown`, para que dos documentos con
      // las mismas líneas en distinto orden no salgan con las filas cambiadas de sitio.
      const wTipo = totalsW * 0.11;
      const wBase = totalsW * 0.32;
      const wRot  = totalsW * 0.21;
      const wCuota = totalsW * 0.32;
      [...tiposDeIva]
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .forEach(([rate, g]) => {
          const vy = doc.y;
          doc.text(rate, totalsX, vy, { width: wTipo })
            .text(fmt(g.base) + ' ' + params.currency, totalsX + wTipo, vy, { width: wBase, align: 'right' })
            .text(`${impuesto} ${rate}:`, totalsX + wTipo + wBase + 4, vy, { width: wRot })
            .text(fmt(g.vat) + ' ' + params.currency, totalsX + wTipo + wBase + 4 + wRot, vy, { width: wCuota, align: 'right' });
          doc.moveDown(0.4);
        });
    }

    // Total final — el momento del dinero (Regla del Importe: Tinta, grande,
    // con el acento de marca en la regla superior; el verde nunca en la cifra)
    doc.rect(totalsX, doc.y, totalsW, 2).fill(BRAND);
    doc.moveDown(0.35);
    const tfY = doc.y;
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK)
      .text(isReceipt ? 'TOTAL COBRADO:' : 'TOTAL:', totalsX, tfY, { width: totalsW * 0.6 })
      .text(fmt(grandTotal) + ' ' + params.currency, totalsX + totalsW * 0.6, tfY, { width: totalsW * 0.4, align: 'right' });
    doc.fillColor('#000');
    doc.moveDown(1.5);

  } else {
    // Fallback: sin líneas → solo el total
    doc.fontSize(14).font('Helvetica-Bold')
      .text(`Total: ${fmt(Number(params.total))} ${params.currency}`, { align: 'right' });
    doc.moveDown(1.5);
  }

  // ── 5. VERIFACTU QR (nunca en justificantes — V0-0) ──────────────────────
  if (!isReceipt && qrBuf) {
    if (doc.y + 120 > PB) doc.addPage();

    const qrY   = doc.y;
    const qrSz  = 90;

    doc.image(qrBuf, M, qrY, { width: qrSz });

    const txX = M + qrSz + 14;
    const txW = W - qrSz - 14;

    if (isVF) {
      // Leyenda EXACTA exigida por el RRSIF para sistemas VERI*FACTU (auditoría S1-A)
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#166534')
        .text('Factura verificable en la sede electrónica de la AEAT', txX, qrY, { width: txW });
      doc.font('Helvetica').fontSize(8).fillColor('#555')
        .text('VERI*FACTU — escanea el QR para verificarla (RD 1007/2023).', txX, doc.y, { width: txW });
      const hashShort = params.vfHash!.slice(0, 32) + '…';
      doc.fontSize(7).fillColor('#888')
        .text(`Huella: ${hashShort}`, txX, doc.y + 2, { width: txW });
    } else {
      doc.fontSize(8).font('Helvetica').fillColor('#555')
        .text('Escanea el QR para validar la factura.', txX, qrY + 6, { width: txW });
    }

    doc.y = Math.max(doc.y, qrY + qrSz + 8);
    doc.fillColor('#000').moveDown(0.8);
  }

  // ── 6. FOOTER ────────────────────────────────────────────────────────────
  hLine();
  doc.moveDown(0.4);
  // x/width explícitos: los totales dejan el cursor en la media columna derecha
  if (isReceipt) {
    // A2.4: pie oficial del sprint doc — claro y con dignidad, jamás "factura"
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BODY)
      .text('Justificante de cobro — este documento acredita el cobro recibido.', M, doc.y, { width: W, align: 'center' });
    doc.fontSize(7.5).font('Helvetica').fillColor(MUTED)
      .text('No constituye una factura. Generado con YaQu · yaqu.app', M, doc.y, { width: W, align: 'center' });
  } else {
    doc.fontSize(7.5).font('Helvetica').fillColor(MUTED)
      .text('Factura generada automáticamente por YaQu · yaqu.app', M, doc.y, { width: W, align: 'center' });
    if (isVF) {
      doc.text('Sistema de facturación verificable conforme al RD 1007/2023 (VeriFactu).', M, doc.y, { width: W, align: 'center' });
    }
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  // SCRUM-72: ya no es una URL pública. Se persiste en Invoice.pdfUrl la ruta del
  // endpoint AUTENTICADO, que es la que enlaza el dashboard (cookie de sesión).
  return { outPath, publicUrlPath: `/admin/invoices/${params.invoiceId}/pdf` };
}

/**
 * Generar PDF de PRESUPUESTO.
 * Usa el ID de quote para el nombre de fichero: QUOTE-<id>.pdf
 */
export async function generateQuotePdf(params: {
  quoteId: number;
  // A1.2: número visible por merchant (el fichero sigue nombrándose con el id
  // global para no romper pdfUrl existentes). Si falta, se muestra el id.
  quoteNumber?: number | null;
  merchant: {
    name: string | null;
    legalName?: string | null;
    taxId?: string | null;
    address?: string | null;
    whatsappPhone?: string | null;
    logoUrl?: string | null;
  };
  customer: {
    name: string | null;
    phone?: string | null;
    email?: string | null;
    // A20.4: cliente empresa
    legalName?: string | null;
    taxId?: string | null;
  };
  // A20.4: qué datos del cliente se muestran (null/undefined = todos los presentes)
  docFields?: { name?: boolean; phone?: boolean; taxId?: boolean; email?: boolean } | null;
  // SCRUM-593 (DOC-03) · los dos textos libres del documento. MULTILÍNEA: los saltos se respetan
  // (PDFKit los honra en `doc.text`), que es lo que exige SCRUM-655 (T6). Opcionales: sin ellos
  // el documento sale EXACTAMENTE como hasta hoy.
  docHeaderText?: string | null;
  docFooterText?: string | null;
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
  // SCRUM-647 · el NOMBRE del impuesto, igual que en la factura (SCRUM-623): un DATO, no una
  // constante de la maqueta. Sin él, el documento sale como hasta hoy.
  taxName?: string | null;
  // SCRUM-656 (T7) · CÓMO se presenta el IVA en ESTE presupuesto: `sumar` pinta el desglose,
  // `no_incluido` no pinta ninguna cuota y añade la leyenda. Ausente = como salía hasta hoy.
  modoIva?: string | null;
  // Las cláusulas de cierre del MERCHANT y las que este presupuesto excluye. El texto lo escribe
  // el profesional; aquí solo se pintan.
  clausulas?: Array<{ id: string; titulo: string; texto: string }> | null;
  clausulasExcluidas?: string[] | null;
  tiers?: Array<{ id: string; label: string; description?: string; lines: any[]; total: number; recommended?: boolean }> | null;
}) {
  // SCRUM-72: quoteId es el id GLOBAL (autoincrement) → ya único entre merchants, no hace
  // falta prefijo. El fichero vive en storage/invoices (fuera de public/), como la factura.
  const fileName = `QUOTE-${params.quoteId}.pdf`;
  const outPath = path.join(invoicesDir, fileName);

  const locale = getLocale(params.country);
  // ═══════════════════════════════════════════════════════════════════════════════════
  // SCRUM-647 · UN SOLO CRITERIO PARA EL NOMBRE DEL IMPUESTO, Y ES EL DE LA FACTURA.
  //
  // Este documento tenía LOS DOS A LA VEZ: la tabla de líneas con `IVA%` grabado y el bloque
  // de totales resolviéndolo por `locale.vatName`. El mismo papel, dos criterios — y es el que
  // más se envía: va por WhatsApp y es el primero que ve el cliente.
  //
  // 🔴 Y EL QUE SE VA ES `locale.vatName`, no el otro. Está indexado por PAÍS, y Canarias es
  // `ES`: un canario repercute IGIC y aquello le pondría «IVA». Dejarlo como respaldo dentro
  // del documento sería meter el defecto por la puerta de atrás.
  //
  // ⚠️ PERO NO SE BORRA SIN MÁS, y esto se midió antes de tocarlo: los tres llamantes SÍ pasan
  // `country`, y `locale.vatName` vale `IGV` en Perú. Quitarlo a secas habría hecho que un
  // presupuesto peruano dejara de decir IGV — una regresión en un mercado que el registro
  // declara. Así que la resolución por país NO desaparece: **se sube al llamante**, donde el
  // país ya está a la vista y donde SCRUM-646 la sustituirá el día que exista el territorio.
  // El documento deja de decidir; quien sabe, pasa.
  // ═══════════════════════════════════════════════════════════════════════════════════
  const impuesto = params.taxName || NOMBRE_IMPUESTO_POR_DEFECTO;
  const QUOTE_LABEL = locale.quote; // "Presupuesto" o "Cotización"

  const logoBuf = await loadLogoBuffer(params.merchant.logoUrl);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // ── Cabecera: logo izquierda, título derecha ─────────────────────────────
  const M = 50;
  const W = doc.page.width - M * 2;
  const hY = doc.y;

  if (logoBuf) {
    try { doc.image(logoBuf, M, hY, { height: 40, fit: [110, 40] }); }
    catch { /* logo inválido */ }
  }

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a')
    .text(QUOTE_LABEL, M, hY, { width: W, align: 'right' });
  doc.fontSize(11).font('Helvetica').fillColor('#64748b')
    .text(`${QUOTE_LABEL} #${params.quoteNumber ?? params.quoteId}`, { align: 'right' });
  doc.fillColor('#000');

  doc.y = Math.max(doc.y, hY + (logoBuf ? 46 : 0));
  doc.moveDown(0.6);

  // Datos empresa / cliente (muy sencillos de momento)
  const merchantName =
    params.merchant.legalName || params.merchant.name || '—';
  doc.fontSize(12).text(`Emisor: ${merchantName}`);
  if (params.merchant.taxId) doc.text(`NIF: ${params.merchant.taxId}`);
  if (params.merchant.address) doc.text(params.merchant.address);
  if (params.merchant.whatsappPhone)
    doc.text(`WhatsApp ${params.merchant.whatsappPhone}`);
  doc.moveDown();

  // A20.4: el pro elige qué datos del cliente van en el documento (docFields;
  // null = todos los presentes, comportamiento de siempre). Cliente empresa:
  // razón social manda sobre el nombre, y el NIF sale si se pide.
  const show = (k: 'name' | 'phone' | 'taxId' | 'email') =>
    !params.docFields || params.docFields[k] !== false;
  // SCRUM-577: misma regla, mismo sitio unico. El respaldo `'—'` se conserva: es lo que este
  // documento imprimia cuando no habia ninguno de los dos, y unificarlo cambiaria lo impreso.
  const clientDisplay = nombreParaDocumento(params.customer, '—');
  if (show('name')) doc.text(`Cliente: ${clientDisplay}`);
  if (show('taxId') && params.customer.taxId) doc.text(`NIF: ${params.customer.taxId}`);
  if (show('phone') && params.customer.phone) doc.text(`Tel: ${params.customer.phone}`);
  if (show('email') && params.customer.email) doc.text(`Email: ${params.customer.email}`);
  doc.moveDown();

  // ── SCRUM-593 (DOC-03) · TEXTO LIBRE bajo la cabecera ─────────────────────────────────────
  // Va DESPUÉS de los datos del cliente y ANTES del detalle: es texto del documento, no de una
  // línea. Se pinta sólo si lo hay, para que un documento sin él salga byte a byte como siempre.
  if (params.docHeaderText && String(params.docHeaderText).trim() !== '') {
    // SIN RÓTULO (fundador, 2-sep-2026): sólo el texto. Se conserva `fontSize(10)` para que el
    // bloque tenga el mismo cuerpo que tenía, y `Helvetica` normal porque ya no hay título que
    // destacar.
    doc.fontSize(10).font('Helvetica').text(String(params.docHeaderText));
    doc.moveDown();
  }

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
        const lineTotal = fmtImporte(l.qty * l.price * (1 + (l.tax ?? 0)));
        const text = `${l.concept} × ${l.qty}`;
        doc.text(text, x + 4, lineY, { width: tierW - 8 });
        lineY += 10;
        doc.text(`${lineTotal} ${params.currency}`, x + 4, lineY, { width: tierW - 8, align: 'right' });
        lineY += 12;
      });

      // Total del tier
      doc.rect(x, lineY, tierW, 14).fill(tier.recommended ? '#dcfce7' : '#e5e7eb');
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9)
        .text(`Total: ${fmtImporte(tier.total)} ${params.currency}`, x + 4, lineY + 3, { width: tierW - 8, align: 'center' });

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
    .text(`${impuesto}%`, X_VAT, doc.y - 12, { width: W_VAT, align: 'right' })
    .text('Total', X_TOTAL, doc.y - 12, { width: W_TOTAL, align: 'right' });

  doc.moveDown(0.3);
  doc.moveTo(X0, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown(0.3);
}

drawTableHeader();


params.lines.forEach((l) => {
  const lineTotal = l.qty * l.price * (1 + l.tax);

  const concept = softBreakLongTokens(String(l.concept || '').trim());

  // SCRUM-603: la partición se COMPARTE con el bloque de la FACTURA. Aquí vivía LA copia
  // original; al llevarla también a la factura habría habido DOS, y dos listas que se
  // sincronizan a mano divergen (la familia de SCRUM-617/620/625/627).
  const { titulo: title, descripcion: desc } = partirConceptoYDescripcion(concept);

  const qty = String(l.qty ?? '');
  const price = Number.isFinite(l.price) ? fmtImporte(l.price) : '';
  const vat = Number.isFinite(l.tax) ? (l.tax * 100).toFixed(0) + '%' : '';
  const total = Number.isFinite(lineTotal) ? fmtImporte(lineTotal) : '';

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

/**
 * ── DESGLOSE DEL PRESUPUESTO · SCRUM-604 (DOC-14) ────────────────────────────────────────
 *
 * Hasta hoy este documento imprimía UNA sola línea —«Total presupuesto: 117.60 EUR»— y nada
 * más: sin base imponible y sin cuota. El PDF de FACTURA sí las pinta desde su bloque
 * «4. TOTALES»; el de presupuesto no. Esto construye lo que faltaba.
 *
 * 🔴 LAS FILAS SON DATOS, NO DIBUJO, y es el requisito explícito del encargo: la maqueta tiene
 * que admitir una CUARTA fila sin rehacerse. Está la pregunta abierta de si el suplido va
 * DENTRO de la base imponible (como hoy) o FUERA, sumándose aparte — y esa segunda hipótesis
 * necesita una fila propia (`desgloseConSuplidos` ya devuelve el campo `suplidos`, «fuera de la
 * base, dentro del total»). Aquí NO se construye: falta su etiqueta, que es del fundador. Pero
 * añadirla el día que se decida es empujar una entrada a este array, no tocar el pintado.
 *
 * MICROCOPY · CERO TEXTO NUEVO (regla 30). Los tres rótulos salen de sitios ya aprobados:
 *   · «Base imponible:» — el MISMO literal del bloque de totales de la factura.
 *   · el del impuesto   — `params.taxName`, resuelto arriba (SCRUM-647). Antes salía de
 *     `locale.vatName`, que resuelve por PAÍS y por tanto miente en Canarias.
 *                         Es MÁS correcto que el de la factura, que lo lleva escrito a mano.
 *   · «Total <quoteVerb>:» — el rótulo que este documento YA imprimía. No se toca.
 *
 * ⚠️ HEREDA A PROPÓSITO EL DEFECTO ① DE LA FACTURA: las filas con cuota CERO no se pintan, así
 * que una base al 0 % (el caso del suplido) no aparece en el desglose. Se hace igual que la
 * factura porque el encargo dice «construye la forma de TRES conceptos que hay hoy», y
 * divergir aquí inventaría una segunda forma de documento. El defecto es de SCRUM-623 y ahora
 * está en los DOS documentos: cuando se arregle, hay que arreglarlo en los dos.
 *
 * ⚠️ EL TOTAL SIGUE SALIENDO DE `params.total` —el guardado—, no de la suma de las líneas. Es
 * el comportamiento que este documento ya tenía y no se cambia aquí (en la factura es al revés,
 * y eso es el defecto ② / SCRUM-624). Si el guardado y la suma se separasen, este bloque no
 * cuadraría a la vista; hoy no se ha visto separarse.
 */
const lineasParaDesglose = Array.isArray(params.lines) ? params.lines : [];
const filasDeTotales: Array<{ etiqueta: string; importe: number }> = [];
// SCRUM-656 (T7) · las filas y la leyenda las decide el DOMINIO, no la maqueta. El cálculo
// sigue siendo `calcVatBreakdown` —dentro de `pieDePresupuesto`— y aquí no se suma nada: esta
// función solo pinta lo que le den. Es lo que impide que «una funcioncita para el IVA del pie»
// se convierta en la tercera copia de la aritmética (la segunda fue `calcTierTotal`, SCRUM-655).
const modoDelDocumento = leerModoIva(params.modoIva).modo;
const pie = pieDePresupuesto({
  lineas: lineasParaDesglose as any,
  modo: modoDelDocumento,
  nombreImpuesto: impuesto,
});
filasDeTotales.push(...pie.filas);

for (const fila of filasDeTotales) {
  doc.fontSize(10).text(
    `${fila.etiqueta} ${fmtImporte(fila.importe)} ${params.currency}`,
    CONTENT_X,
    doc.y,
    { width: CONTENT_W, align: 'right' },
  );
}

// Total (sin partirse raro)
doc.fontSize(12).text(
  `Total ${locale.quoteVerb}: ${fmtImporte(Number(params.total))} ${params.currency}`,
  CONTENT_X,
  doc.y,
  { width: CONTENT_W, align: 'right' },
);

// 🔴 SCRUM-656 · LA LEYENDA DEL MODO «IVA NO INCLUIDO», bajo el total y solo en ese modo.
// No es decoración: en ese modo el documento NO afirma cuánto será el impuesto, así que sin la
// leyenda el cliente lee el total como el precio final. Es lo que dice su presupuesto real.
if (pie.leyenda) {
  doc.fontSize(10).fillColor('#444').text(
    pie.leyenda,
    CONTENT_X,
    doc.y,
    { width: CONTENT_W, align: 'right' },
  );
  doc.fillColor('black');
}

doc.moveDown(2);

// ── SCRUM-593 (DOC-03) · OBSERVACIONES ──────────────────────────────────────────────────────
// El bloque FINAL, tras los totales y antes de la firma. El rótulo está aprobado (2-sep-2026) y
// va sin marcador. Alineado a la izquierda a propósito: los totales van a la derecha, y un texto
// libre en esa columna se leería como parte de la suma.
if (params.docFooterText && String(params.docFooterText).trim() !== '') {
  doc.fontSize(10).font('Helvetica-Bold').fillColor('black')
    .text(TITULO_OBSERVACIONES, CONTENT_X, doc.y, { width: CONTENT_W, align: 'left' });
  doc.font('Helvetica')
    .text(String(params.docFooterText), CONTENT_X, doc.y, { width: CONTENT_W, align: 'left' });
  doc.moveDown(1);
}

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

// ── SCRUM-656 (T7) · LAS CLÁUSULAS DE CIERRE ─────────────────────────────────────────
// Del MERCHANT, menos las que este presupuesto excluya. El texto lo escribe el profesional;
// aquí solo se pinta.
//
// 🔴 CON LA CONFIGURACIÓN VACÍA NO SE ABRE NADA: ni sección, ni título, ni un hueco. Un bloque
// «CONDICIONES» sin cláusulas dentro es peor que no ponerlo, y un título sin texto debajo
// —«GARANTÍA» y nada— se lee como que la garantía existe pero no dice cuál. Ausente y vacío no
// son lo mismo, y `clausulasParaDocumento` ya descarta las que no tienen las dos cosas.
const clausulasDelDocumento = clausulasParaDocumento(params.clausulas, params.clausulasExcluidas);
if (clausulasDelDocumento.length > 0) {
  if (doc.y + 80 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.moveDown(1);
  for (const c of clausulasDelDocumento) {
    if (doc.y + 60 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.fontSize(9).fillColor('black').text(c.titulo.toUpperCase(), CONTENT_X, doc.y, { width: CONTENT_W });
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor('#444').text(c.texto, CONTENT_X, doc.y, { width: CONTENT_W, align: 'justify' });
    doc.moveDown(0.6);
  }
  doc.fillColor('black');
}

// Footer centrado bien (con ancho fijo)
doc.moveDown(1);
doc
  .fontSize(9)
  .fillColor('#666')
  .text(
    `${QUOTE_LABEL} generado automáticamente por YaQu — válido salvo indicación en contrario.`,
    CONTENT_X,
    doc.y,
    { width: CONTENT_W, align: 'center' },
  );


  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  // SCRUM-72: ídem factura — Quote.pdfUrl guarda la ruta del endpoint AUTENTICADO
  // GET /admin/quotes/:id/pdf, no una ruta estática pública.
  return { outPath, publicUrlPath: `/admin/quotes/${params.quoteId}/pdf` };
}

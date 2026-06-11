/**
 * VeriFactu — Reglamento de Facturación España (RD 1007/2023 / RTSF)
 *
 * Implementa la cadena de huellas SHA-256 y la URL de QR para el portal
 * de verificación de la AEAT. Solo se aplica a merchants con country='ES'
 * y taxId configurado.
 *
 * Spec: https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Facturacion/
 *       Sistema_Informacion_Verifactu/REGLAMENTO_VERIFACTU.pdf
 */
import crypto from 'crypto';
import { prisma as defaultPrisma } from '../../../core/db/prisma';
import { calcVatCuotaTotal } from './vat.service';
import { isReceiptNumber } from './invoiceNumber.service';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateES(d: Date): string {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatTimestampES(d: Date): string {
  return `${formatDateES(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * Calcula la huella SHA-256 de una factura per spec RTSF art. 12.
 * Campos concatenados con '|': NIF | Serie | Fecha | TipoFactura |
 *   CuotaTotal | ImporteTotal | HuellaAnterior | FechaHoraHuella
 */
export function computeVeriFactuHash(params: {
  nif: string;
  serie: string;
  fecha: string;       // DD-MM-YYYY
  tipoFactura: string; // 'F1' = factura completa estándar
  cuotaTotal: string;  // suma de cuotas IVA (MVP = '0.00')
  importeTotal: string;
  prevHash: string;    // '0' si es la primera factura del emisor
  timestamp: string;   // DD-MM-YYYY HH:MM:SS
}): string {
  const input = [
    params.nif,
    params.serie,
    params.fecha,
    params.tipoFactura,
    params.cuotaTotal,
    params.importeTotal,
    params.prevHash,
    params.timestamp,
  ].join('|');
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex').toUpperCase();
}

/**
 * Construye la URL que codifica el QR de verificación AEAT.
 * https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR
 */
export function buildVeriFactuQrUrl(params: {
  nif: string;
  serie: string;
  fecha: string;   // DD-MM-YYYY
  importe: string; // N.NN
}): string {
  const qs = new URLSearchParams({
    nif:       params.nif,
    numserie:  params.serie,
    fecha:     params.fecha,
    importe:   params.importe,
  });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?${qs.toString()}`;
}

/**
 * Aplica VeriFactu a una factura:
 *  1. Obtiene la huella de la factura anterior del mismo merchant
 *  2. Calcula la nueva huella
 *  3. Persiste vfHash, vfPrevHash y qrData en el Invoice
 *
 * Devuelve los valores calculados para usarlos en la generación del PDF.
 */
export async function applyVeriFactu(
  invoice: {
    id: number;
    number: string;
    total: { toString(): string };
    createdAt: Date;
    merchantId: number;
    type?: string | null; // 'F1' (default) | 'R1' rectificativa
  },
  taxId: string,
  prismaClient = defaultPrisma,
): Promise<{ vfHash: string; vfPrevHash: string; qrUrl: string }> {
  // V0-0: un justificante de cobro (J-…) no es una factura — jamás entra en la
  // cadena de huellas VeriFactu. Los call-sites capturan y siguen sin QR.
  if (isReceiptNumber(invoice.number)) {
    throw new Error('receipt_document_not_invoiceable');
  }

  // Última factura del merchant que ya tenga huella (excluye la actual)
  const prev = await prismaClient.invoice.findFirst({
    where: {
      merchantId: invoice.merchantId,
      vfHash: { not: null },
      id: { not: invoice.id },
    },
    orderBy: { createdAt: 'desc' },
    select: { vfHash: true },
  });

  const prevHash = prev?.vfHash ?? '0';
  const fecha = formatDateES(invoice.createdAt);
  const timestamp = formatTimestampES(new Date());
  const importeTotal = Number(invoice.total.toString()).toFixed(2);

  // Cuota total de IVA real desde las líneas de la factura (0.00 si no tiene líneas)
  const full = await prismaClient.invoice.findUnique({
    where: { id: invoice.id },
    select: { lines: true },
  });
  const cuotaTotal = calcVatCuotaTotal(
    Array.isArray(full?.lines) ? (full!.lines as any[]) : null,
  ).toFixed(2);

  const vfHash = computeVeriFactuHash({
    nif: taxId,
    serie: invoice.number,
    fecha,
    tipoFactura: invoice.type === 'R1' ? 'R1' : 'F1',
    cuotaTotal,
    importeTotal,
    prevHash,
    timestamp,
  });

  const qrUrl = buildVeriFactuQrUrl({ nif: taxId, serie: invoice.number, fecha, importe: importeTotal });

  await prismaClient.invoice.update({
    where: { id: invoice.id },
    data: { vfHash, vfPrevHash: prevHash, qrData: qrUrl },
  });

  console.log(`[verifactu] invoice=${invoice.number} hash=${vfHash.slice(0, 16)}…`);
  return { vfHash, vfPrevHash: prevHash, qrUrl };
}

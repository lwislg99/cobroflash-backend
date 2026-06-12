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

/**
 * FechaHoraHusoGenRegistro: ISO 8601 con huso explícito (ej. 2024-01-01T19:20:30+01:00),
 * como exige la spec de huella de la AEAT. Usa el huso del sistema; el MISMO valor
 * que entra en la huella debe remitirse luego en el registro XML (S1-C lo persistirá).
 */
export function formatFechaHoraHuso(d: Date): string {
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzMin);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
}

/**
 * Huella SHA-256 del registro de facturación de ALTA — conforme a la Orden
 * HAC/1177/2024 y al doc AEAT "Especificaciones para la generación de la huella"
 * (auditado en S1-A, ver docs/AUDITORIA_RRSIF.md).
 *
 * Cadena de entrada EXACTA (campo=valor unidos por '&', valores con trim):
 *   IDEmisorFactura=…&NumSerieFactura=…&FechaExpedicionFactura=dd-mm-aaaa
 *   &TipoFactura=…&CuotaTotal=…&ImporteTotal=…&Huella=…(vacío si 1er registro)
 *   &FechaHoraHusoGenRegistro=ISO8601-con-huso
 * → SHA-256 sobre UTF-8 → 64 hex MAYÚSCULAS.
 *
 * Vector de prueba oficial (doc AEAT): la cadena de ejemplo con NIF 89890001K
 * produce 3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60
 * (blindado en tests/verifactu.test.mjs).
 */
export function computeVeriFactuHash(params: {
  nif: string;
  serie: string;       // NumSerieFactura completo (ej. 2026-CF-001)
  fecha: string;       // FechaExpedicionFactura DD-MM-YYYY
  tipoFactura: string; // 'F1' | 'R1' (catálogo AEAT)
  cuotaTotal: string;  // con punto decimal, 2 decimales
  importeTotal: string;
  prevHash: string;    // huella del registro anterior; '' (VACÍO) si es el primero
  timestamp: string;   // FechaHoraHusoGenRegistro ISO 8601 con huso
}): string {
  const input =
    `IDEmisorFactura=${params.nif.trim()}` +
    `&NumSerieFactura=${params.serie.trim()}` +
    `&FechaExpedicionFactura=${params.fecha.trim()}` +
    `&TipoFactura=${params.tipoFactura.trim()}` +
    `&CuotaTotal=${params.cuotaTotal.trim()}` +
    `&ImporteTotal=${params.importeTotal.trim()}` +
    `&Huella=${params.prevHash.trim()}` +
    `&FechaHoraHusoGenRegistro=${params.timestamp.trim()}`;
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

  // S1-A: el PRIMER registro del emisor lleva huella anterior VACÍA (no '0')
  const prevHash = prev?.vfHash ?? '';
  const fecha = formatDateES(invoice.createdAt);
  const timestamp = formatFechaHoraHuso(new Date());
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

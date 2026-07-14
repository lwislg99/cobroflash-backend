// src/modules/jobs/domain/albaran.service.ts — SCRUM-14 (ALBARAN-1)
// Dominio del albarán / parte de trabajo (documento NO FISCAL, Parte L del master):
// transiciones borrador→emitido→firmado, validación del shape de lineas (condición 4
// del OK del fundador), serialización y regeneración del PDF bajo demanda (el disco
// de Railway es efímero — mismo patrón que ensureInvoicePdf).
import path from 'path';
import fs from 'fs';
import { prisma } from '../../../core/db/prisma';
import { albaranesDir } from '../../../core/storage/dirs';
import { generateAlbaranPdf } from '../infra/albaranPdf.service';

export const ALBARAN_ESTADOS = ['borrador', 'emitido', 'firmado'] as const;
export type AlbaranEstado = (typeof ALBARAN_ESTADOS)[number];

// Parte L: borrador → emitido → firmado. Firmar exige emitido (la UI no ofrece
// firmar un borrador); firmado es TERMINAL y congela el documento.
export function canTransitionAlbaran(from: string, to: string): boolean {
  if (from === 'borrador' && to === 'emitido') return true;
  if (from === 'emitido' && to === 'firmado') return true;
  return false;
}

export interface AlbaranLinea {
  concepto: string;
  cantidad: number;
  unidad: string;
}

/**
 * Valida el shape de `lineas` (condición 4 del OK): array de
 * {concepto: string no vacío, cantidad: number > 0, unidad: string}.
 * Devuelve la lista normalizada (trim) o un string de error para el 400.
 */
export function validarLineas(input: unknown): { ok: true; lineas: AlbaranLinea[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'lineas debe ser un array' };
  if (input.length > 200) return { ok: false, error: 'máximo 200 líneas por albarán' };
  const out: AlbaranLinea[] = [];
  for (let i = 0; i < input.length; i++) {
    const l = input[i] as any;
    const concepto = typeof l?.concepto === 'string' ? l.concepto.trim() : '';
    const cantidad = Number(l?.cantidad);
    const unidad = typeof l?.unidad === 'string' ? l.unidad.trim() : null;
    if (!concepto) return { ok: false, error: `línea ${i + 1}: concepto vacío` };
    if (concepto.length > 300) return { ok: false, error: `línea ${i + 1}: concepto demasiado largo (máx. 300)` };
    if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false, error: `línea ${i + 1}: cantidad debe ser un número > 0` };
    if (cantidad > 1_000_000) return { ok: false, error: `línea ${i + 1}: cantidad fuera de rango` };
    if (unidad === null) return { ok: false, error: `línea ${i + 1}: unidad debe ser texto (ud, m, m², h…)` };
    if (unidad.length > 40) return { ok: false, error: `línea ${i + 1}: unidad demasiado larga (máx. 40)` };
    out.push({ concepto, cantidad, unidad });
  }
  return { ok: true, lineas: out };
}

/** Forma que viaja al front (lista en el detalle del Trabajo y respuestas de las rutas). */
export function serializeAlbaran(a: any) {
  return {
    id: a.id,
    jobId: a.jobId,
    numero: a.numero,
    fecha: a.fecha,
    lineas: Array.isArray(a.lineas) ? a.lineas : [],
    estado: a.estado,
    version: a.version,
    firmadoAt: a.firmadoAt,
    notas: a.notas,
    pdfUrl: a.pdfUrl,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/**
 * Garantiza que el PDF del albarán existe en disco y devuelve su ruta (patrón
 * ensureInvoicePdf: Railway pierde el disco en cada deploy → regenerar si falta).
 * `force` = regenerar SIEMPRE (tras firmar, para incrustar el bloque de firma).
 */
export async function ensureAlbaranPdf(albaranId: number, force = false): Promise<{ diskPath: string; pdfUrl: string; numero: string }> {
  const albaran = await prisma.albaran.findUnique({ where: { id: albaranId } });
  if (!albaran) throw new Error('albaran_not_found');

  // SCRUM-48: nombre prefijado con merchantId (mata la colisión entre merchants) y pdfUrl
  // apuntando al endpoint AUTENTICADO (ya no hay estático público /albaranes).
  const fileName = `${albaran.merchantId}-${albaran.numero}.pdf`;
  const diskPath = path.join(albaranesDir, fileName);
  const pdfUrl = `/admin/albaranes/${albaran.id}/pdf`;

  if (!force && albaran.pdfUrl === pdfUrl && fs.existsSync(diskPath)) {
    return { diskPath, pdfUrl, numero: albaran.numero };
  }

  const [merchant, job] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: albaran.merchantId },
      select: { name: true, legalName: true, taxId: true, address: true, logoUrl: true, whatsappPhone: true },
    }),
    prisma.job.findUnique({ where: { id: albaran.jobId } }),
  ]);
  const customer = job
    ? await prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true } })
    : null;

  await generateAlbaranPdf({
    merchantId: albaran.merchantId,
    numero: albaran.numero,
    fecha: albaran.fecha,
    version: albaran.version,
    merchant: merchant ?? { name: '—', legalName: null, taxId: null, address: null, logoUrl: null, whatsappPhone: null },
    customerName: customer?.name ?? null,
    obra: job?.direccion || job?.titulo || null,
    lineas: (Array.isArray(albaran.lineas) ? albaran.lineas : []) as unknown as AlbaranLinea[],
    notas: albaran.notas,
    signatureData: albaran.signatureUrl,
    firmadoAt: albaran.firmadoAt,
  });

  if (albaran.pdfUrl !== pdfUrl) {
    await prisma.albaran.update({ where: { id: albaranId }, data: { pdfUrl } });
  }
  return { diskPath, pdfUrl, numero: albaran.numero };
}

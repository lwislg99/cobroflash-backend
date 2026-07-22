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

// SCRUM-65: SIN_VALORAR (hoy, sin precios) | VALORADO (líneas con precio+IVA).
// El albarán VALORADO sigue SIN validez fiscal (docs/legal/INVESTIGACION_ALBARANES.md
// §1.3): no devenga IVA, no sustituye a la factura. Editable solo en 'borrador'.
export const ALBARAN_MODOS_VALORACION = ['SIN_VALORAR', 'VALORADO'] as const;
export type AlbaranModoValoracion = (typeof ALBARAN_MODOS_VALORACION)[number];

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
  // SCRUM-65: solo presentes en modo VALORADO (undefined/null en SIN_VALORAR).
  // precioUnitario en la MISMA unidad decimal que Quote.lines[].price (no céntimos).
  // tipoIva en TANTO POR CIENTO entero (21/10/4/0) — distinto de Quote.lines[].tax,
  // que es la fracción 0.21 (convención propia del albarán, fijada en el brief).
  precioUnitario?: number;
  tipoIva?: number;
}

/**
 * Valida el shape de `lineas` (condición 4 del OK original + SCRUM-65): array de
 * {concepto: string no vacío, cantidad: number > 0, unidad: string} + en modo
 * VALORADO exige precioUnitario/tipoIva en TODAS las líneas; en SIN_VALORAR los
 * rechaza si llegan. Devuelve la lista normalizada (trim) o un mensaje de error humano.
 */
export function validarLineas(
  input: unknown,
  modoValoracion: AlbaranModoValoracion = 'SIN_VALORAR',
): { ok: true; lineas: AlbaranLinea[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'lineas debe ser un array' };
  if (input.length > 200) return { ok: false, error: 'máximo 200 líneas por albarán' };
  const valorado = modoValoracion === 'VALORADO';
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

    const tienePrecio = l?.precioUnitario !== undefined && l?.precioUnitario !== null && l?.precioUnitario !== '';
    const tieneIva = l?.tipoIva !== undefined && l?.tipoIva !== null && l?.tipoIva !== '';
    const linea: AlbaranLinea = { concepto, cantidad, unidad };

    if (!valorado) {
      if (tienePrecio || tieneIva) {
        return { ok: false, error: `línea ${i + 1}: este albarán es SIN_VALORAR — no puede llevar precio ni IVA` };
      }
    } else {
      if (!tienePrecio) return { ok: false, error: `línea ${i + 1}: falta el precio unitario (albarán valorado)` };
      if (!tieneIva) return { ok: false, error: `línea ${i + 1}: falta el tipo de IVA (albarán valorado)` };
      const precioUnitario = Number(l.precioUnitario);
      const tipoIva = Number(l.tipoIva);
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        return { ok: false, error: `línea ${i + 1}: el precio unitario debe ser un número ≥ 0` };
      }
      if (precioUnitario > 1_000_000) return { ok: false, error: `línea ${i + 1}: precio unitario fuera de rango` };
      if (!Number.isFinite(tipoIva) || tipoIva < 0 || tipoIva > 100) {
        return { ok: false, error: `línea ${i + 1}: el tipo de IVA debe ser un número entre 0 y 100` };
      }
      linea.precioUnitario = precioUnitario;
      linea.tipoIva = tipoIva;
    }
    out.push(linea);
  }
  return { ok: true, lineas: out };
}

/**
 * Totales orientativos del albarán VALORADO — SCRUM-65. Aritmética en ENTEROS DE
 * CÉNTIMOS (regla de la casa): se redondea una vez por línea (importe = precio×cantidad,
 * cuota = importe×IVA%) y se suman céntimos, nunca floats acumulados. Sin desglose por
 * tipo de IVA (a propósito: un albarán valorado NO simula el desglose de una factura).
 */
export function calcAlbaranTotales(lineas: AlbaranLinea[] | null | undefined): {
  baseCents: number;
  cuotaCents: number;
  totalCents: number;
  base: number;
  cuota: number;
  total: number;
} {
  let baseCents = 0;
  let cuotaCents = 0;
  for (const l of Array.isArray(lineas) ? lineas : []) {
    if (l.precioUnitario === undefined || l.precioUnitario === null) continue; // SIN_VALORAR o línea sin precio
    const lineaBaseCents = Math.round(Number(l.precioUnitario) * Number(l.cantidad) * 100);
    const lineaCuotaCents = Math.round(lineaBaseCents * (Number(l.tipoIva || 0) / 100));
    baseCents += lineaBaseCents;
    cuotaCents += lineaCuotaCents;
  }
  const totalCents = baseCents + cuotaCents;
  return {
    baseCents, cuotaCents, totalCents,
    base: baseCents / 100, cuota: cuotaCents / 100, total: totalCents / 100,
  };
}

/** Forma que viaja al front (lista en el detalle del Trabajo y respuestas de las rutas). */
export function serializeAlbaran(a: any) {
  const lineas = Array.isArray(a.lineas) ? a.lineas : [];
  const modoValoracion: AlbaranModoValoracion = a.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR';
  return {
    id: a.id,
    jobId: a.jobId,
    numero: a.numero,
    fecha: a.fecha,
    modoValoracion,
    lineas,
    // SCRUM-65: totales orientativos, solo con contenido real en modo VALORADO
    // (evita que el front reimplemente la aritmética de céntimos).
    totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null,
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
    ? await prisma.customer.findUnique({ where: { id: job.customerId }, select: { name: true, legalName: true, taxId: true } })
    : null;

  const modoValoracion: AlbaranModoValoracion = albaran.modoValoracion === 'VALORADO' ? 'VALORADO' : 'SIN_VALORAR';
  const lineas = (Array.isArray(albaran.lineas) ? albaran.lineas : []) as unknown as AlbaranLinea[];

  await generateAlbaranPdf({
    merchantId: albaran.merchantId,
    numero: albaran.numero,
    fecha: albaran.fecha,
    emisionAt: albaran.createdAt, // SCRUM-67: fecha de emisión ≠ fecha de entrega/ejecución
    version: albaran.version,
    modoValoracion,
    merchant: merchant ?? { name: '—', legalName: null, taxId: null, address: null, logoUrl: null, whatsappPhone: null },
    customer: customer
      ? { name: customer.name, legalName: customer.legalName, taxId: customer.taxId }
      : { name: null, legalName: null, taxId: null },
    obra: job?.direccion || null,
    referenciaTrabajo: job?.titulo || null, // SCRUM-67: referencia al Trabajo/presupuesto origen
    lineas,
    totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null,
    notas: albaran.notas,
    signatureData: albaran.signatureUrl,
    firmadoAt: albaran.firmadoAt,
  });

  if (albaran.pdfUrl !== pdfUrl) {
    await prisma.albaran.update({ where: { id: albaranId }, data: { pdfUrl } });
  }
  return { diskPath, pdfUrl, numero: albaran.numero };
}

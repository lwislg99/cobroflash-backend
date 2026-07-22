// src/modules/exports/domain/exportData.ts — SCRUM-25 (EXPORT-1)
// Builders PUROS de los CSV del paquete S4. Extraídos aquí para que las rutas sueltas
// (/admin/exports/*.csv) y el paquete ZIP (/admin/exports/datos.zip) produzcan
// EXACTAMENTE lo mismo: si el asesor cruza el CSV suelto con el del ZIP, cuadran.
//
// Cada builder devuelve { header, rows } ya escapados; quien llama decide si lo envía
// como respuesta (sendCsv) o lo mete en el ZIP (csvBody).
import { prisma } from '../../../core/db/prisma';
import { calcVatBreakdown } from '../../invoicing/domain/vat.service';
import { estadoCobroFor } from '../../jobs/domain/job.service';

export interface Rango { from: Date | null; to: Date | null }
export interface CsvData { header: string[]; rows: string[] }

// ── Formato CSV (SCRUM-86) — OPTIMIZADO PARA ESPAÑA, no universal ─────────
// Excel usa el "separador de lista" del sistema, no una coma fija: con configuración
// regional ES espera `;`, así que un CSV separado por comas se abría ENTERO en la
// columna A. Y con `100.00` tampoco reconocía los importes como número.
//
// ⚠️ NO es un formato universal. De los 6 países del máster (locales.ts) esto encaja en
// ES, CO, AR, PE y CL (coma decimal), pero NO en MÉXICO, que usa punto decimal como
// EE. UU. — allí el formato correcto sería justo el anterior. Hoy no hay merchants MX
// (LATAM es F3), así que se opta por lo que sirve al mercado real. Si algún día entra
// MX, esto pasa a depender del locale del merchant.
export const CSV_SEPARADOR = ';';

export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  // OJO: ya NO se entrecomilla por coma. Con decimal español la coma aparece en TODOS
  // los importes, y entrecomillarlos ("1234,50") hace que Excel los lea como TEXTO.
  if (s.includes(CSV_SEPARADOR) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(CSV_SEPARADOR);
}

/**
 * Importe para CSV: coma decimal y SIN punto de miles (`1234,50`).
 * No se usa `formatMoneyEs`: mete símbolo de moneda y separador de miles, y el punto de
 * miles es la causa nº 1 de que Excel vuelva a interpretar el importe como texto.
 */
export function csvNum(n: unknown): string {
  const v = Number(n ?? 0);
  return (Number.isFinite(v) ? v : 0).toFixed(2).replace('.', ',');
}

/** Cuerpo completo del CSV: BOM UTF-8 (para que Excel no rompa los acentos) + CRLF. */
export function csvBody({ header, rows }: CsvData): string {
  return '﻿' + [csvRow(header), ...rows].join('\r\n');
}

/** `where` común: siempre acotado al merchant (regla 2) + rango opcional sobre `campo`. */
function whereRango(merchantId: number, { from, to }: Rango, campo = 'createdAt', extra: any = {}) {
  const where: any = { merchantId, ...extra };
  if (from || to) {
    where[campo] = {};
    if (from) where[campo].gte = from;
    if (to) where[campo].lte = to;
  }
  return where;
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

// ── clientes.csv ──────────────────────────────────────────────────────────
export async function buildClientes(merchantId: number, rango: Rango): Promise<CsvData> {
  const customers = await prisma.customer.findMany({
    where: whereRango(merchantId, rango),
    orderBy: { createdAt: 'asc' },
  });
  return {
    header: ['Nombre', 'Razón social', 'NIF/CIF', 'Teléfono', 'Email', 'Notas', 'Baja WhatsApp', 'Alta'],
    rows: customers.map((c) => csvRow([
      c.name,
      (c as any).legalName ?? '',
      (c as any).taxId ?? '',
      c.phone ?? '',
      c.email ?? '',
      c.notes ?? '',
      c.waOptOut ? 'Sí' : 'No',
      dia(c.createdAt),
    ])),
  };
}

// ── facturas.csv ──────────────────────────────────────────────────────────
// Base e IVA desglosados con calcVatBreakdown sobre las líneas CONGELADAS de la
// factura. Sin líneas → base = total e IVA = 0: no se inventa un tipo impositivo.
export async function buildFacturas(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const invoices = await prisma.invoice.findMany({
    where: whereRango(merchantId, rango, 'createdAt', status !== 'all' ? { status } : {}),
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true, email: true } } },
  });
  return {
    header: ['Número', 'Fecha', 'Cliente', 'Email cliente', 'Base', 'IVA', 'Total', 'Moneda', 'Estado', 'Pagada en', 'VeriFactu'],
    rows: invoices.map((inv) => {
      const lines = Array.isArray(inv.lines) ? (inv.lines as any[]) : [];
      const vat = lines.length ? calcVatBreakdown(lines) : null;
      const total = Number(inv.total);
      return csvRow([
        inv.number,
        dia(inv.createdAt),
        inv.customer?.name ?? '',
        inv.customer?.email ?? '',
        csvNum(vat ? vat.base : total),
        csvNum(vat ? vat.cuota : 0),
        csvNum(total),
        inv.currency,
        inv.status,
        inv.paidAt ? dia(inv.paidAt) : '',
        inv.vfHash ? 'Sí' : 'No',
      ]);
    }),
  };
}

// ── cobros.csv ────────────────────────────────────────────────────────────
// `paid_via` = charge.method (regla 22). Es lo que el asesor cruza con el banco.
export async function buildCobros(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const charges = await prisma.charge.findMany({
    where: whereRango(merchantId, rango, 'createdAt', status !== 'all' ? { status } : {}),
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true } } },
  });
  return {
    header: ['Cobro #', 'Fecha', 'Cliente', 'Concepto', 'Importe', 'Moneda', 'Método (paid_via)', 'Estado', 'Cobrado en', 'Referencia'],
    rows: charges.map((ch) => csvRow([
      ch.id,
      dia(ch.createdAt),
      ch.customer?.name ?? '',
      ch.concept,
      csvNum(ch.amount),
      ch.currency,
      ch.method,
      ch.status,
      // El cobro no guarda paidAt: cuando está pagado, updatedAt es el momento del cobro.
      ch.status === 'paid' ? dia(ch.updatedAt) : '',
      ch.reference ?? '',
    ])),
  };
}

// ── trabajos.csv ──────────────────────────────────────────────────────────
// Job no declara relaciones en Prisma: cliente y operario se resuelven a mano, en
// 2 consultas y no una por fila (mismo patrón que jobs.routes/serializeJob).
export async function buildTrabajos(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const [jobs, customers, members] = await Promise.all([
    prisma.job.findMany({
      where: whereRango(merchantId, rango, 'createdAt', status !== 'all' ? { status } : {}),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.findMany({ where: { merchantId }, select: { id: true, name: true } }),
    prisma.teamMember.findMany({ where: { merchantId }, select: { id: true, name: true } }),
  ]);
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const operarioName = new Map(members.map((m) => [m.id, m.name]));

  return {
    header: ['Trabajo #', 'Título', 'Estado', 'Cliente', 'Operario', 'Fecha prevista', 'Total aceptado', 'Total cobrado', 'Pendiente', 'Estado de cobro', 'Alta'],
    rows: jobs.map((j) => {
      const aceptado = j.totalAceptado != null ? Number(j.totalAceptado) : 0;
      const cobrado = Number(j.totalCobrado ?? 0);
      return csvRow([
        j.id,
        j.titulo ?? '',
        j.status,
        customerName.get(j.customerId) ?? '',
        // operarioId null = propietario (SCRUM-22): se deja vacío, no se inventa nombre
        j.operarioId != null ? (operarioName.get(j.operarioId) ?? '') : '',
        j.scheduledAt ? dia(j.scheduledAt) : '',
        csvNum(aceptado),
        csvNum(cobrado),
        csvNum(Math.round((aceptado - cobrado) * 100) / 100),
        estadoCobroFor(cobrado, aceptado),   // mismo semáforo que la app
        dia(j.createdAt),
      ]);
    }),
  };
}

// ── presupuestos.csv ──────────────────────────────────────────────────────
export async function buildPresupuestos(merchantId: number, rango: Rango, status = 'all'): Promise<CsvData> {
  const quotes = await prisma.quote.findMany({
    where: whereRango(merchantId, rango, 'createdAt', status !== 'all' ? { status } : {}),
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { name: true, email: true, phone: true } } },
  });
  return {
    header: ['ID', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Total', 'Moneda', 'Estado', 'Aceptada en', 'Condiciones de pago'],
    rows: quotes.map((q) => csvRow([
      q.id,
      dia(q.createdAt),
      q.customer?.name ?? '',
      q.customer?.email ?? '',
      q.customer?.phone ?? '',
      csvNum(q.total),
      q.currency,
      q.status,
      q.acceptedAt ? dia(q.acceptedAt) : '',
      (q as any).paymentTerms ?? '',
    ])),
  };
}

// ── Empaquetado del ZIP: constantes y decisiones PURAS ────────────────────

/**
 * Tope de facturas por paquete. ⚠️ PROVISIONAL — ajustarlo aquí y solo aquí.
 *
 * ⚠️ ANTES DE SUBIRLO, LEE ESTO: acota TRES cosas a la vez, no solo el tiempo. Es fácil
 * razonar "Railway da 15 minutos, el proxy no es el límite" y subirlo… engordando la
 * memoria del navegador sin darse cuenta.
 *
 * 1) TIEMPO (time-to-first-byte). Medido en SCRUM-25 §7, caso malo (ningún PDF en disco,
 *    como tras cada deploy por el fs efímero), contra staging por WAN:
 *      · 774 ms por factura de media (p95 1,5 s) — el 99,8 % es `ensureInvoicePdf`;
 *        la compresión fueron 24 ms de 15.500.
 *      · 100 facturas ≈ 77 s · 300 ≈ 232 s **sin enviar un solo byte** (el paquete solo
 *        puede transmitirse cuando ya sabe si está completo, para poder nombrarse).
 *    Es un TECHO: medido con la BD remota y ~2 s de latencia por consulta; en producción
 *    app y BD comparten región y debería caer bastante.
 *
 * 2) MEMORIA DEL NAVEGADOR. La card descarga con `fetch` + blob (para poder avisar de que
 *    el paquete salió incompleto), así que el ZIP entero pasa por RAM antes de guardarse.
 *    El peso lo domina el LOGO del merchant: `loadLogoBuffer` lo incrusta tal cual en CADA
 *    PDF (`doc.image` no recomprime; el `fit` es geometría), y el logo pesa ~150 KB.
 *      · sin logo: PDF ~5 KB → 100 facturas ≈ 0,5 MB (medido: 20 facturas = 79 KB)
 *      · con logo: PDF ~155 KB → 100 facturas ≈ 15 MB, con pico ~30 MB (respuesta + blob)
 *    A 500 facturas serían ~77 MB: ahí un Android de gama media (matriz del máster) sí
 *    sufre. El ZIP no ayuda — PNG/JPEG ya vienen comprimidos.
 *
 * 3) UX. Con 15 min de plataforma el riesgo no es fallar, es PARECER roto. La card avisa
 *    del tope antes de pulsar (GET /datos.zip/info) y bloquea el botón mientras genera.
 *
 * 100 mantiene la espera en el entorno del minuto y la memoria en ~15 MB en el peor caso.
 * El arreglo de verdad (asíncrono) es SCRUM-83; su escalera: ajustar tope → paralelizar
 * render → asíncrono. Cuando se mida en producción, este número se sube o se retira —
 * pero recalculando también (2), no solo (1).
 */
export const MAX_FACTURAS_ZIP = 100;

export interface EntregaZip {
  completo: boolean;
  /** Nombre del fichero: dice la verdad SIN que haya que abrir nada. */
  nombreZip: string;
  /** Contenido de AVISO-PAQUETE-INCOMPLETO.txt, o null si el paquete está completo. */
  avisoTxt: string | null;
  /** Líneas que van ARRIBA del LEEME (vacío si está completo). */
  cabeceraLeeme: string[];
}

/**
 * Decide cómo se ENTREGA el paquete según los PDF que hayan fallado. Pura a propósito:
 * es la lógica que evita que una entrega para una inspección parezca completa sin serlo,
 * y se testea directa, sin BD ni gate (no se toca `ensureInvoicePdf`, que es fiscal).
 */
export function resolverEntregaZip(p: { total: number; fallidos: string[]; fecha: string }): EntregaZip {
  const { total, fallidos, fecha } = p;
  if (fallidos.length === 0) {
    return { completo: true, nombreZip: `yaqu-datos-${fecha}.zip`, avisoTxt: null, cabeceraLeeme: [] };
  }
  const lista = fallidos.join(', ');
  return {
    completo: false,
    nombreZip: `yaqu-datos-INCOMPLETO-${fecha}.zip`,
    avisoTxt: [
      'PAQUETE INCOMPLETO',
      '',
      `Faltan ${fallidos.length} de ${total} facturas: no se pudo generar su PDF.`,
      `Facturas afectadas: ${lista}`,
      '',
      'No uses este paquete como entrega completa sin volver a generarlo. Los datos de esas',
      'facturas SÍ están en csv/facturas.csv; lo que falta es el PDF.',
    ].join('\n'),
    cabeceraLeeme: [
      `*** PAQUETE INCOMPLETO — faltan ${fallidos.length} de ${total} PDF de factura ***`,
      `Facturas sin PDF: ${lista}`,
      'No lo entregues como paquete completo sin volver a generarlo. Ver AVISO-PAQUETE-INCOMPLETO.txt.',
      '',
    ],
  };
}

/** Las 5 tablas del paquete S4 (el ticket no incluye gastos ni fees). */
export const CSV_PAQUETE = [
  { nombre: 'clientes.csv', build: buildClientes },
  { nombre: 'facturas.csv', build: buildFacturas },
  { nombre: 'cobros.csv', build: buildCobros },
  { nombre: 'trabajos.csv', build: buildTrabajos },
  { nombre: 'presupuestos.csv', build: buildPresupuestos },
] as const;

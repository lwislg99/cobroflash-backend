// src/modules/invoicing/domain/finalInvoice.service.ts — SCRUM-141 (FISCAL-1a)
//
// MOTOR PURO de la FACTURA FINAL con deducción de documentos ya emitidos: dado el total de la
// operación y las facturas previas (anticipos/tramos ya facturados), produce las líneas de la
// final — las positivas de la operación completa MÁS una línea NEGATIVA por cada documento
// descontado — y las referencias que la hacen auditable (`Invoice.deductsRefs`).
//
// SIN BD, SIN Express: se prueba entero en `npm test` normal (tests/scrum141-factura-final).
//
// ── POR QUÉ UNA LÍNEA NEGATIVA POR TIPO DE IVA, Y NO UNA POR FACTURA ────────────────────────
// Un documento descontado puede llevar varios tipos (21/10/4/0 — modelo multi-IVA de SCRUM-65 y
// SCRUM-17). Si se dedujera su total en una sola línea habría que elegir UN tipo, y el desglose
// del 303 saldría mal: se estaría restando cuota de un tipo que no corresponde. Se descompone el
// documento con `calcVatBreakdown` y se emite una negativa POR TIPO, así la deducción neutraliza
// exactamente la cuota que aquel documento repercutió. `calcVatBreakdown` ya soporta importes en
// negativo (blindado en tests/vat.test.mjs desde el sprint SPAIN) — no hace falta nada nuevo.
//
// ── LO QUE ESTE MOTOR NO DECIDE (es SCRUM-142/16b, bloqueado por el dictamen P1) ────────────
// CUÁNDO se emite una final, ni cuándo nace un anticipo, ni con qué fecha de devengo. Aquí solo
// vive la ARITMÉTICA de la compensación, que es idéntica sea cual sea la respuesta del asesor.
// Por eso este fichero se puede escribir hoy y aquello no.
import { calcVatBreakdown, type VatLine, cantidadDeLinea } from './vat.service';
import { grossOfLines, type InvoiceLine } from './invoiceLines.service';

/** Documento ya emitido que la final descuenta (tramo/anticipo previo del mismo presupuesto). */
export interface DeductibleDoc {
  id: number;
  number: string;
  /** Fecha de emisión del documento descontado (art. 6.1: la final debe identificarlo). */
  fecha: Date | string;
  /** Total BRUTO del documento (`Invoice.total`). Se usa si no hay líneas con las que desglosar. */
  total: number | string;
  /** Líneas del documento — de aquí sale el desglose por tipo de IVA. */
  lines?: unknown;
}

/** Entrada de `Invoice.deductsRefs`: lo que hace auditable la compensación (expediente fiscal §P5). */
export interface DeductRef {
  invoiceId: number;
  number: string;
  fecha: string;
  base: number;
  cuota: number;
  /** true = el documento no tenía líneas y se dedujo su total sin desglose de IVA (ver abajo). */
  sinDesglose?: boolean;
}

export interface FinalInvoiceResult {
  /** Líneas de la final: las positivas de la operación + las negativas de cada deducción. */
  lines: InvoiceLine[];
  /** Referencias de los documentos descontados → `Invoice.deductsRefs`. */
  deductsRefs: DeductRef[];
  /** Total BRUTO neto de la final (puede ser 0,00 si ya se anticipó el 100 % — expediente §P3). */
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toISODate(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

/**
 * Construye la factura final: líneas de la operación completa + deducción de lo ya facturado.
 *
 * `total` NO se recalcula de las líneas positivas: se pasa explícito (el `Quote.total` congelado)
 * y de él se resta el bruto de las deducciones. Así el importe de la final es exactamente
 * "lo que vale la obra menos lo ya facturado", sin que un redondeo intermedio lo desplace.
 */
export function buildFinalInvoice(params: {
  lines: InvoiceLine[];
  total: number | string;
  deducted: DeductibleDoc[];
}): FinalInvoiceResult {
  const operacion = Array.isArray(params.lines) ? params.lines.map((l) => ({ ...l })) : [];
  const docs = Array.isArray(params.deducted) ? params.deducted : [];

  const negativas: InvoiceLine[] = [];
  const deductsRefs: DeductRef[] = [];

  for (const doc of docs) {
    const docLines = Array.isArray(doc.lines) ? (doc.lines as VatLine[]) : null;
    const fecha = toISODate(doc.fecha);
    const fechaCorta = fecha.slice(0, 10);

    if (docLines && docLines.length > 0) {
      const bd = calcVatBreakdown(docLines);
      // Una negativa POR TIPO de IVA: neutraliza exactamente la cuota que ese documento repercutió.
      for (const e of bd.entries) {
        negativas.push({
          concept: `Menos anticipo facturado ${doc.number} (${fechaCorta})${bd.entries.length > 1 ? ` — IVA ${e.rate} %` : ''}`,
          qty: 1,
          price: -e.base,
          tax: e.rate / 100,
        });
      }
      deductsRefs.push({ invoiceId: doc.id, number: doc.number, fecha, base: bd.base, cuota: bd.cuota });
      continue;
    }

    // Documento SIN líneas (facturas legacy anteriores a que se copiaran las líneas): no hay con
    // qué desglosar el IVA. Se deduce el total como base a 0 % y se MARCA en la referencia
    // (`sinDesglose`) en vez de inventar un tipo: un tipo adivinado descuadraría el 303 en
    // silencio, y esto lo deja visible para quien audite.
    const bruto = round2(Number(doc.total) || 0);
    negativas.push({
      concept: `Menos anticipo facturado ${doc.number} (${fechaCorta}) — sin desglose de IVA`,
      qty: 1,
      price: -bruto,
      tax: 0,
    });
    deductsRefs.push({ invoiceId: doc.id, number: doc.number, fecha, base: bruto, cuota: 0, sinDesglose: true });
  }

  const lines = [...operacion, ...negativas];
  const deducidoBruto = round2(negativas.reduce((s, l) => {
    const qty = cantidadDeLinea(l.qty); // SCRUM-504
    const price = Number(l.price) || 0;
    return s + qty * price * (1 + (Number(l.tax) || 0));
  }, 0));

  return { lines, deductsRefs, total: round2(Number(params.total) + deducidoBruto) };
}

/** Bruto real que suman las líneas de una final — para verificar el cuadre contra `total`. */
export { grossOfLines };

// src/modules/invoicing/domain/libroRegistro.ts — SCRUM-296 (A6) · el LIBRO DE REGISTRO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ ES Y POR QUÉ NO ES UNA TABLA MÁS
//
// El libro de facturas emitidas es lo primero que pide un asesor. Cualquier facturador lo tiene.
// Lo que ningún facturador puede hacer es **enlazar cada asiento con su presupuesto, su albarán y
// su cobro**, porque no tiene los tres objetos atados. Aquí sí: es la trazabilidad completa de un
// euro, desde que se presupuestó hasta que entró.
//
// ⚠️ ES SOLO LECTURA sobre facturas YA EMITIDAS. No toca el camino de emisión (regla 38, que lo
// permite explícitamente para leer): no compone números, no reserva nada, no escribe.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO, Y AQUÍ NO ES UNA FORMALIDAD
//
// Un libro vacío **no se lee como «no encontré nada»: se lee como «no facturaste nada»**, y eso
// ante Hacienda no es un hueco, es una afirmación. Por eso el resultado lleva SIEMPRE `miradas`:
// cuántas facturas se examinaron. Cero asientos con `miradas: 0` significa «no había»; cero
// asientos con `miradas: 40` significa **que algo está roto**, y quien lo consuma puede
// distinguirlo. Sin ese número, las dos cosas se leen igual de tranquilizadoras.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS IMPORTES NO SE COERCIONAN NUNCA (familia SCRUM-271)
//
// `Number('')` es `0` y `Number([])` es `0`. Un total ilegible convertido en `0,00 €` es un
// asiento que **afirma** que esa factura no cobró nada — y en un libro de registro eso es peor
// que no tener la fila. Un importe que no se puede leer sale como `null` y se cuenta aparte, con
// su número de factura delante.
import { calcVatBreakdown } from './vat.service';

/** Lo que el libro necesita de cada factura. Deliberadamente poco: esto solo LEE. */
export interface FacturaParaLibro {
  merchantId: number;
  number: string | null;
  createdAt: Date | string | null;
  type: string | null;
  total: unknown;
  currency: string | null;
  status: string | null;
  customerId: number | null;
  quoteId: number | null;
  chargeId: number | null;
  albaranRefs: unknown;
  lines: unknown;
}

export interface AsientoLibro {
  numero: string;
  fecha: string | null;
  tipo: string | null;
  clienteId: number | null;
  base: number | null;
  cuota: number | null;
  total: number | null;
  moneda: string | null;
  estado: string | null;
  /** ⚠️ `true` = el importe no se pudo leer. NO es cero: es «no se sabe». */
  importeIlegible: boolean;
  /** La trazabilidad del euro: de dónde viene y dónde acabó. */
  enlaces: {
    presupuestoId: number | null;
    albaranes: { albaranId: number | null; numero: string | null }[];
    cobroId: number | null;
  };
}

export interface LibroRegistro {
  asientos: AsientoLibro[];
  /** Cuántas facturas se examinaron. Es lo que distingue «no había» de «no supe leer». */
  miradas: number;
  /** Filas descartadas por no ser de este merchant. Se cuentan, nunca se tiran en silencio. */
  ajenas: number;
  /** Filas sin número: no son asiento (el número ES la identidad fiscal), pero se declaran. */
  sinNumero: number;
  /** Números de las facturas cuyo importe no se pudo leer. */
  importesIlegibles: string[];
}

/** Lee un importe SIN coercionar. Devuelve `null` si no es un número utilizable. */
function importe(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (Array.isArray(valor)) return null; // `Number([])` es 0 — familia SCRUM-271
  if (typeof valor === 'object' && typeof (valor as any).toString === 'function') {
    // Prisma `Decimal`: su `toString` es exacto; `Number()` directo también funcionaría, pero
    // pasar por el texto evita depender de la representación interna.
    const n = Number((valor as any).toString());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function refsDeAlbaran(valor: unknown): { albaranId: number | null; numero: string | null }[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((r) => r && typeof r === 'object')
    .map((r: any) => ({
      albaranId: typeof r.albaranId === 'number' ? r.albaranId : null,
      numero: typeof r.numero === 'string' ? r.numero : null,
    }));
}

/**
 * Construye el libro. Puro: recibe las facturas ya leídas y no toca la base.
 *
 * ⚠️ FILTRA POR MERCHANT AQUÍ TAMBIÉN, aunque la consulta ya lo haga. No es desconfianza
 * decorativa: el guard de tenencia de SCRUM-243 tiene un agujero conocido (SCRUM-348), así que
 * apoyarse solo en él dejaría el aislamiento de este libro colgando de algo que ya se sabe
 * incompleto. Y lo que se filtra **se cuenta** (`ajenas`): un descarte silencioso en un documento
 * fiscal es indistinguible de un dato que nunca existió.
 */
export function construirLibroRegistro(params: {
  facturas: readonly FacturaParaLibro[];
  merchantId: number;
}): LibroRegistro {
  const asientos: AsientoLibro[] = [];
  const importesIlegibles: string[] = [];
  let ajenas = 0;
  let sinNumero = 0;

  for (const f of params.facturas) {
    if (f.merchantId !== params.merchantId) { ajenas += 1; continue; }
    if (typeof f.number !== 'string' || f.number === '') { sinNumero += 1; continue; }

    const total = importe(f.total);
    const desglose = calcVatBreakdown(Array.isArray(f.lines) ? (f.lines as any[]) : []);
    // La base y la cuota salen del MISMO cálculo que usa la emisión: recomputarlas aquí con otra
    // fórmula sería un segundo sitio calculando lo mismo, y el libro acabaría cuadrando consigo
    // mismo en vez de con las facturas.
    const tieneLineas = Array.isArray(f.lines) && f.lines.length > 0;

    if (total === null) importesIlegibles.push(f.number);

    asientos.push({
      numero: f.number,
      fecha: f.createdAt instanceof Date
        ? f.createdAt.toISOString()
        : (typeof f.createdAt === 'string' ? f.createdAt : null),
      tipo: f.type ?? null,
      clienteId: typeof f.customerId === 'number' ? f.customerId : null,
      base: tieneLineas ? desglose.base : null,
      cuota: tieneLineas ? desglose.cuota : null,
      total,
      moneda: f.currency ?? null,
      estado: f.status ?? null,
      importeIlegible: total === null,
      enlaces: {
        presupuestoId: typeof f.quoteId === 'number' ? f.quoteId : null,
        albaranes: refsDeAlbaran(f.albaranRefs),
        cobroId: typeof f.chargeId === 'number' ? f.chargeId : null,
      },
    });
  }

  return {
    asientos,
    miradas: params.facturas.length,
    ajenas,
    sinNumero,
    importesIlegibles,
  };
}

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
  /** Opcional a propósito: sin `id` el asiento se construye igual, solo pierde los albaranes vivos. */
  id?: number;
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
  /**
   * SCRUM-295 (A5) · el desglose POR TIPO de la misma factura, en porcentaje (21, 10, 4, 0…).
   *
   * ⚠️ Sale de la MISMA llamada a `calcVatBreakdown` que `base` y `cuota` de arriba — no de una
   * segunda pasada. Es lo que permite que el modelo 303 se construya SOBRE el libro en vez de
   * volver a agregar por su cuenta: si el 303 y el libro contasen por caminos distintos, un día
   * dirían cifras distintas y el profesional tendría dos documentos oficiales contradictorios
   * sin saber cuál miente.
   */
  porTipo: { tipo: number; base: number; cuota: number }[];
  total: number | null;
  moneda: string | null;
  estado: string | null;
  /** ⚠️ `true` = el importe no se pudo leer. NO es cero: es «no se sabe». */
  importeIlegible: boolean;
  /** La trazabilidad del euro: de dónde viene, qué se entregó a cambio y dónde acabó. */
  enlaces: {
    presupuestoId: number | null;
    /**
     * `true` = ese presupuesto tiene FIRMA. `null` = esta factura no viene de un presupuesto.
     *
     * ⚠️ Se deriva de `Quote.signatureUrl`, NO de `acceptedAt`: aceptar y firmar no son lo
     * mismo, y en un libro que se le enseña a un tercero el enlace tiene que apuntar a la
     * prueba, no a la intención. El motivo largo está en `libroRegistro.repo.ts`.
     */
    presupuestoFirmado: boolean | null;
    /** Los albaranes SELLADOS en la factura (`albaranRefs`): lo que el documento dice. */
    albaranes: { albaranId: number | null; numero: string | null }[];
    /**
     * Albaranes que apuntan hoy a esta factura y NO estaban en el sello. No se añaden a la
     * lista de arriba —la factura emitida dice lo que dice, regla 29— pero tampoco se ocultan:
     * un descuadre entre el documento sellado y la relación viva es exactamente lo que un
     * libro de registro tiene que dejar ver.
     */
    albaranesNoSellados: number;
    cobroId: number | null;
  };
}

/** Un albarán que apunta HOY a la factura (relación viva), frente a los sellados en ella. */
export interface AlbaranVivo {
  albaranId: number;
  numero: string | null;
}

export interface LibroRegistro {
  asientos: AsientoLibro[];
  /** Cuántas facturas se examinaron. Es lo que distingue «no había» de «no supe leer». */
  miradas: number;
  /** Filas descartadas por no ser de este merchant. Se cuentan, nunca se tiran en silencio. */
  ajenas: number;
  /** Filas sin número: no son asiento (el número ES la identidad fiscal), pero se declaran. */
  sinNumero: number;
  /**
   * SCRUM-389 · el IMPORTE de esas filas sin número, no solo cuántas son.
   *
   * Lo pide Informes: su cuadro declara «N facturas sin desglose (total X €) no incluidas». Sin
   * este número, unificar los dos agregadores obligaría a Informes a enseñar un recuento sin su
   * importe — y un «hay 3 facturas fuera» sin decir cuánto dinero es no se puede revisar a mano,
   * que es exactamente lo que ese aviso pide que hagas.
   */
  sinNumeroImporte: number;
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
  /** Ids de presupuesto CON firma. Lo calcula quien lee la base; aquí solo se consulta. */
  presupuestosFirmados?: Iterable<number>;
  /** Albaranes que apuntan hoy a cada factura, por id de factura. */
  albaranesVivos?: ReadonlyMap<number, readonly AlbaranVivo[]>;
}): LibroRegistro {
  const asientos: AsientoLibro[] = [];
  const importesIlegibles: string[] = [];
  const firmados = new Set<number>(params.presupuestosFirmados ?? []);
  let ajenas = 0;
  let sinNumero = 0;
  let sinNumeroImporte = 0;

  for (const f of params.facturas) {
    if (f.merchantId !== params.merchantId) { ajenas += 1; continue; }
    if (typeof f.number !== 'string' || f.number === '') {
      sinNumero += 1;
      // El importe se acumula solo si se puede LEER: un total ilegible no suma cero (familia
      // SCRUM-271), se queda fuera y ya lo cuenta `sinNumero`.
      const suyo = importe(f.total);
      if (suyo !== null) sinNumeroImporte += suyo;
      continue;
    }

    const total = importe(f.total);
    const desglose = calcVatBreakdown(Array.isArray(f.lines) ? (f.lines as any[]) : []);
    // La base y la cuota salen del MISMO cálculo que usa la emisión: recomputarlas aquí con otra
    // fórmula sería un segundo sitio calculando lo mismo, y el libro acabaría cuadrando consigo
    // mismo en vez de con las facturas.
    const tieneLineas = Array.isArray(f.lines) && f.lines.length > 0;

    if (total === null) importesIlegibles.push(f.number);

    const presupuestoId = typeof f.quoteId === 'number' ? f.quoteId : null;
    const sellados = refsDeAlbaran(f.albaranRefs);
    const vivos = typeof f.id === 'number' ? (params.albaranesVivos?.get(f.id) ?? []) : [];
    // Un albarán vivo cuenta como «no sellado» si su id no está entre los del sello. Se compara
    // por id, no por número: el número es texto del merchant y puede cambiar de forma.
    const idsSellados = new Set(sellados.map((r) => r.albaranId).filter((n) => n !== null));
    const noSellados = vivos.filter((v) => !idsSellados.has(v.albaranId)).length;

    asientos.push({
      numero: f.number,
      fecha: f.createdAt instanceof Date
        ? f.createdAt.toISOString()
        : (typeof f.createdAt === 'string' ? f.createdAt : null),
      tipo: f.type ?? null,
      clienteId: typeof f.customerId === 'number' ? f.customerId : null,
      base: tieneLineas ? desglose.base : null,
      cuota: tieneLineas ? desglose.cuota : null,
      // Mismo `desglose`, misma llamada: el 303 suma ESTO, así que no hay dos caminos que puedan
      // divergir. Sin líneas la lista va vacía — no cero, vacía: «no se puede desglosar» y
      // «desglosa a cero» son cosas distintas, y el 303 tiene que poder separarlas.
      porTipo: tieneLineas
        ? desglose.entries.map((e) => ({ tipo: e.rate, base: e.base, cuota: e.cuota }))
        : [],
      total,
      moneda: f.currency ?? null,
      estado: f.status ?? null,
      importeIlegible: total === null,
      enlaces: {
        presupuestoId,
        // `null` cuando no hay presupuesto: «no viene de uno» y «viene de uno sin firmar» son
        // cosas distintas, y un `false` para las dos las haría indistinguibles.
        presupuestoFirmado: presupuestoId === null ? null : firmados.has(presupuestoId),
        albaranes: sellados,
        albaranesNoSellados: noSellados,
        cobroId: typeof f.chargeId === 'number' ? f.chargeId : null,
      },
    });
  }

  return {
    asientos,
    miradas: params.facturas.length,
    ajenas,
    sinNumero,
    sinNumeroImporte: Math.round(sinNumeroImporte * 100) / 100,
    importesIlegibles,
  };
}

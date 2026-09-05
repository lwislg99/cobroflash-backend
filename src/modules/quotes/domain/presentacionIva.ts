// src/modules/quotes/domain/presentacionIva.ts — SCRUM-656 (T7, sprint Tecnosel)
//
// CÓMO PRESENTA EL IVA UN PRESUPUESTO. **Dos modos, y ninguna aritmética nueva.**
//
// ── LO MEDIDO EN SUS DOCUMENTOS REALES ────────────────────────────────────────────────────
// En los papeles de la empresa el IVA aparece de dos formas en los presupuestos, y en ninguna
// de las dos hay IVA por línea:
//
//   IRVE ............ TOTAL 987,00 € + la leyenda «IVA. NO INCLUIDO» — ni siquiera lo calcula
//   Escuela Arte .... TOTAL 550,00 · 21% IVA 115,50 · TOTAL IVA INCLUIDO 665,50
//
// Lo decide el profesional AL CREAR el presupuesto, según el cliente que tenga delante — por eso
// la casilla vive en el formulario y no en Configuración.
//
// ⛔ Y MUERE AHÍ: EN LA FACTURA NO HAY OPCIÓN. Una factura lleva base, cuota y total SIEMPRE,
// porque lo exige el reglamento de facturación. Este módulo vive en `modules/quotes/` a
// propósito: nada de aquí puede alcanzar el camino de emisión.
//
// ── 🔴 POR QUÉ AQUÍ NO SE CALCULA NADA, Y ES LA MITAD DEL TICKET ──────────────────────────
// Tocar totales invita a escribir «una funcioncita para el IVA del pie». Esta casa ya pagó esa
// tentación: `calcTierTotal` era UNA SEGUNDA COPIA de `calcTotal` y se habría quedado sumando
// `undefined` mientras la buena ya sabía saltarse las cabeceras de apartado (SCRUM-655).
//
// Así que el desglose lo sigue haciendo `calcVatBreakdown`, la primitiva de siempre, y este
// módulo **solo decide QUÉ FILAS SE PINTAN**. El modo no cambia ni un céntimo: cambia lo que el
// documento enseña. Si un día hiciera falta otra aritmética, se amplía la primitiva en su sitio.
import { calcVatBreakdown, type VatLine } from '../../invoicing/domain/vat.service';

/**
 * Los dos modos, CERRADOS (regla 27). Un modo libre deja meter un `'sin_iva'` que nadie pinta y
 * el documento sale mudo sin que falle nada.
 */
export const MODOS_IVA = ['sumar', 'no_incluido'] as const;
export type ModoIva = (typeof MODOS_IVA)[number];

/**
 * EL MODO POR DEFECTO ES `sumar`, y no es una preferencia: es **lo que el documento hace hoy**.
 * El PDF de presupuesto ya pinta «Base imponible / IVA 21% / Total» desde SCRUM-623. Poner
 * `no_incluido` por defecto cambiaría en silencio todos los presupuestos de todos los merchants
 * que no han elegido nada — y quitarle el IVA a un documento que lo llevaba es justo el tipo de
 * cambio que nadie pidió.
 */
export const MODO_IVA_POR_DEFECTO: ModoIva = 'sumar';

/** La leyenda del modo `no_incluido`. Es lo que dice su documento, no una redacción nuestra. */
export const LEYENDA_IVA_NO_INCLUIDO = 'IVA NO INCLUIDO';

export function esModoIva(valor: unknown): valor is ModoIva {
  return typeof valor === 'string' && (MODOS_IVA as readonly string[]).includes(valor);
}

/**
 * Lee el modo guardado. Un valor DESCONOCIDO cae al de por defecto **y se puede saber**: devuelve
 * también si hubo que caer, para que quien lo use pueda decirlo en vez de tragárselo.
 *
 * `null`/`undefined` NO es un valor desconocido: es «este presupuesto es anterior a la casilla»,
 * que es el caso de todos los que ya existen. Ésos salen como salían.
 */
export function leerModoIva(valor: unknown): { modo: ModoIva; reconocido: boolean } {
  if (valor === null || valor === undefined) return { modo: MODO_IVA_POR_DEFECTO, reconocido: true };
  if (esModoIva(valor)) return { modo: valor, reconocido: true };
  return { modo: MODO_IVA_POR_DEFECTO, reconocido: false };
}

/** Una fila del pie de totales, ya resuelta: rótulo e importe. */
export interface FilaDeTotal {
  etiqueta: string;
  importe: number;
}

export interface PieDePresupuesto {
  /** Las filas ANTERIORES al total. Vacío en `no_incluido`. */
  filas: FilaDeTotal[];
  /** La leyenda que va bajo el total, o `null` si el modo no lleva ninguna. */
  leyenda: string | null;
}

/**
 * EL PIE DE TOTALES DE UN PRESUPUESTO, según su modo.
 *
 *   `sumar`       → Base imponible · una fila por tipo con cuota · (el Total lo pinta el PDF)
 *   `no_incluido` → NINGUNA fila de impuesto, y la leyenda «IVA NO INCLUIDO» bajo el total
 *
 * 🔴 EN `no_incluido` NO SE CALCULA EL IVA Y NO SE PINTA NINGUNA CUOTA. No es que se oculte una
 * cifra que existe: es que ese documento **no afirma** cuánto será el impuesto. Pintar una cuota
 * «por si acaso» convertiría una oferta sin IVA en una oferta con IVA a los ojos del cliente.
 *
 * ⚠️ El desglose sale de `calcVatBreakdown`, la misma primitiva que usan la factura y el libro.
 * Aquí no se suma, no se redondea y no se multiplica nada.
 */
/** Dos decimales, sin elegir convención nueva: es la que ya usa `calcVatBreakdown`. */
function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * La línea con su `dto` YA aplicado al precio. Devuelve una línea normal, así que todo lo que
 * viene después —`calcVatBreakdown` incluido— no sabe que hubo un descuento, que es justo lo
 * que permite no tocar el motor fiscal.
 */
function aplicarDtoDeLinea(l: VatLine): VatLine {
  const dto = Number((l as unknown as Record<string, unknown>).dto);
  if (!Number.isFinite(dto) || dto <= 0) return l;
  const price = Number((l as unknown as Record<string, unknown>).price);
  if (!Number.isFinite(price)) return l;
  return { ...l, price: price * (1 - Math.min(100, dto) / 100) } as VatLine;
}

export function pieDePresupuesto(params: {
  lineas: VatLine[] | null | undefined;
  modo: ModoIva;
  /** `IVA`, `IGIC`… lo resuelve quien pinta (SCRUM-647): aquí solo se rotula. */
  nombreImpuesto: string;
  /** SCRUM-594 · el descuento global del documento, en EUROS. Ausente = no hay. */
  descuentoGlobal?: number | string | null;
}): PieDePresupuesto {
  if (params.modo === 'no_incluido') {
    return { filas: [], leyenda: LEYENDA_IVA_NO_INCLUIDO };
  }

  const lineas = Array.isArray(params.lineas) ? params.lineas : [];
  if (lineas.length === 0) return { filas: [], leyenda: null };

  // ── 🔴 SCRUM-594 (DOC-04) · LOS DESCUENTOS, Y POR QUÉ ENTRAN COMO PRECIO YA EFECTIVO ────
  //
  // `calcVatBreakdown` NO SE TOCA. De él cuelgan el libro registro, el modelo 303 y el XML de
  // VeriFactu (20 importadores), y cuál de las cuatro convenciones de redondeo del árbol debe
  // mandar está en la asesoría con SCRUM-619, 623 y 624. Así que el descuento de línea se
  // aplica ANTES, sobre el precio, y aquí llega una línea normal: el motor fiscal ni se entera.
  //
  // El descuento GLOBAL sí se resta después, porque va en euros y no cabe en un precio unitario.
  // Se prorratea proporcional a la base de cada tipo —la única forma que no elige favorecer a
  // nadie— y el ÚLTIMO tipo absorbe el céntimo que sobra, para que la suma de los repartos sea
  // EXACTAMENTE el importe que el cliente firmó. Es conservación aritmética, no una convención.
  //
  // ⚠️ REGLA DEL PRESUPUESTO, QUE NO ES DOCUMENTO FISCAL. Antes de que un descuento llegue a una
  // FACTURA, este prorrateo va a la asesoría con SCRUM-619, 623 y 624.
  const efectivas = lineas.map((l) => aplicarDtoDeLinea(l));
  const bd = calcVatBreakdown(efectivas);

  const sinDescuento = calcVatBreakdown(lineas as VatLine[]).base;
  const descuentoLineas = redondear2(sinDescuento - bd.base);
  const globalPedido = Number(params.descuentoGlobal);
  const global = Number.isFinite(globalPedido) && globalPedido > 0
    ? Math.min(redondear2(globalPedido), bd.base)
    : 0;

  const filas: FilaDeTotal[] = [];
  // 🔴 SIN DESCUENTO, EL BLOQUE ES EXACTAMENTE EL DE ANTES. Ni una fila de más, ni un rótulo
  // distinto: un presupuesto anterior a este ticket tiene que salir idéntico. Los flags
  // «activable» no llevan columna (regla 27) — el dato ES el flag.
  if (descuentoLineas > 0 || global > 0) {
    filas.push({ etiqueta: 'Suma de líneas:', importe: sinDescuento });
    if (descuentoLineas > 0) filas.push({ etiqueta: 'Descuento:', importe: -descuentoLineas });
    if (global > 0) filas.push({ etiqueta: 'Descuento global:', importe: -global });
  }
  filas.push({ etiqueta: 'Base imponible:', importe: redondear2(bd.base - global) });

  // El reparto del global entre tipos, en CÉNTIMOS para que conserve el importe exacto. El
  // último absorbe la diferencia; sin eso, la suma de lo descontado no sería la firmada.
  const totalCents = Math.round(bd.base * 100);
  const globalCents = Math.round(global * 100);
  let acumulado = 0;
  const quitaDelTipo = bd.entries.map((e, i) => {
    if (globalCents <= 0 || totalCents <= 0) return 0;
    const cents = i === bd.entries.length - 1
      ? globalCents - acumulado
      : Math.round((globalCents * Math.round(e.base * 100)) / totalCents);
    acumulado += cents;
    return cents / 100;
  });

  bd.entries.forEach((e, i) => {
    // Heredado de SCRUM-623 y de la factura: una fila con cuota CERO no se pinta. Se mantiene
    // igual en los dos documentos a propósito — divergir aquí inventaría una segunda forma de
    // documento, y el defecto (una base al 0 % que no aparece) es de los DOS.
    if (e.cuota === 0) return;
    // La cuota de este tipo, sobre su base YA descontada de la parte de global que le tocó.
    const cuota = redondear2((e.base - quitaDelTipo[i]) * (e.rate / 100));
    if (cuota === 0) return;
    filas.push({ etiqueta: `${params.nombreImpuesto} ${e.rate}%:`, importe: cuota });
  });
  return { filas, leyenda: null };
}

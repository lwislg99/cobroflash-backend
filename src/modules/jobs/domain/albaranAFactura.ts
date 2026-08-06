// src/modules/jobs/domain/albaranAFactura.ts — SCRUM-290 (A0.4)
//
// EL CASADOR: qué se factura de un albarán firmado, a qué precio, y qué NO se factura.
//
// ── LA REGLA, QUE NO ES UNA PREFERENCIA ─────────────────────────────────────────────────────
//
//   CANTIDADES del albarán · PRECIOS del presupuesto firmado.
//
// Lo que se entregó lo dice el albarán; lo que cuesta lo dice **lo que el cliente firmó**. Sacar
// el precio de cualquier otro sitio —del catálogo, de la última factura, preguntándoselo al
// profesional— es facturar un importe que el cliente **no aceptó**. Ésta es además la ventaja del
// producto: el albarán sigue SIN precios (decisión del fundador del 2-ago, viva), y aun así no hay
// que retecleaar nada en obra, porque el presupuesto firmado está detrás.
//
// ── LO AÑADIDO EN OBRA NO SE FACTURA. DISPARA UN PRESUPUESTO ADICIONAL ──────────────────────
//
// No es cautela nuestra, lo manda la ley y por eso está aquí y no en la pantalla:
//   · **Consumidor** (el 90 % de la clientela de un gremio): el presupuesto aceptado es
//     VINCULANTE y la factura debe coincidir con él; los trabajos nuevos exigen aceptación
//     POR ESCRITO, y el consumidor puede rechazarlos.
//   · **Empresa o autónomo**: art. 1593 CC admite autorización verbal o tácita — pero el criterio
//     por defecto sigue siendo el estricto (ver `TIPO_DESTINATARIO_POR_DEFECTO` abajo).
//
// La solución cómoda —«entran a 0 € y se avisa»— se descartó **por incorrecta**: convertiría a
// YaQu en la herramienta que produce la factura MAYOR que el presupuesto, que es justo el supuesto
// por el que se abren la mitad de las reclamaciones de consumo.
//
// Y nada se descarta en silencio: lo que no se factura sale NOMBRADO, con su motivo, para que
// acabe en un adicional que se firma. Descartar callando en un documento que alguien firma es el
// defecto de SCRUM-271.
//
// ⚠️ Este módulo NO emite: clasifica. Devuelve qué es facturable y qué no, y **quien emita
// decidirá con eso**. Funciones puras — sin Prisma, sin red, sin reloj — para que el criterio se
// pueda probar sin levantar la app (misma razón que `presupuestosDelTrabajo.ts`, SCRUM-195).

/** Línea de albarán tal y como vive en `Albaran.lineas` (Json). */
export interface LineaAlbaranEntrada {
  concepto?: unknown;
  cantidad?: unknown;
  unidad?: unknown;
  /** SCRUM-367: índice de la línea del presupuesto de la que salió. Ausente = añadida en obra. */
  quoteLineIndex?: unknown;
}

/**
 * Línea de presupuesto tal y como vive en `Quote.lines` (Json).
 *
 * ⚠️ `tax` es una FRACCIÓN (0.21), no un porcentaje. El albarán usa la convención contraria
 * (`tipoIva` entero: 21). Aquí no hay que convertir nada —el precio y el impuesto salen del
 * PRESUPUESTO, que ya viene en fracción— y decirlo importa: la conversión existe en tres sitios
 * del árbol (`albaranes.routes.ts:852`, `albaran.service.ts:191`, `recapitulativa.service.ts:83`)
 * y copiarla aquí por inercia metería un IVA cien veces mayor.
 */
export interface LineaPresupuesto {
  concept?: unknown;
  qty?: unknown;
  price?: unknown;
  tax?: unknown;
}

export interface LineaFacturableDelAlbaran {
  /** índice dentro de `Albaran.lineas` */
  lineaIndex: number;
  /** índice dentro de `Quote.lines` */
  quoteLineIndex: number;
  concepto: string;
  /** DEL ALBARÁN: lo que de verdad se entregó */
  cantidad: number;
  /** DEL PRESUPUESTO: lo que el cliente firmó */
  precioUnitario: number;
  /** DEL PRESUPUESTO, fracción (0.21) */
  tax: number;
}

export type MotivoNoFacturable =
  | 'no_estaba_en_el_presupuesto'   // añadida en obra: sin `quoteLineIndex`
  | 'linea_del_presupuesto_no_existe' // apunta a un índice que el presupuesto no tiene
  | 'exceso_sobre_lo_presupuestado' // se entregó MÁS de lo aceptado: el exceso no está firmado
  | 'sin_cantidad';                 // cantidad ausente o <= 0: no hay nada que facturar

export interface LineaNoFacturable {
  lineaIndex: number;
  concepto: string;
  cantidad: number;
  unidad: string;
  motivo: MotivoNoFacturable;
  /** Solo en `exceso_sobre_lo_presupuestado`: cuánto sobra respecto de lo firmado. */
  exceso?: number;
}

export interface Casacion {
  facturables: LineaFacturableDelAlbaran[];
  /** Lo que NO se factura, nombrado y con motivo. Alimenta el presupuesto ADICIONAL. */
  paraAdicional: LineaNoFacturable[];
  /** Cuántas líneas traía el albarán. El suelo lo necesita: 0 casadas de 0 ≠ 0 casadas de 7. */
  lineasDelAlbaran: number;
}

/**
 * SCRUM-69 · `null` = cliente NUNCA CLASIFICADO → se trata como PARTICULAR.
 *
 * No se inventa aquí: es la convención que ya sigue `pendientesFacturar.service.ts:16`, y el
 * motivo es el mismo — **equivocarse hacia el lado estricto no le cuesta un procedimiento a
 * nadie**. Nunca se escribe ese valor de vuelta a la BD: es criterio de cálculo, no un dato.
 */
export const TIPO_DESTINATARIO_POR_DEFECTO = 'PARTICULAR' as const;

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : NaN;
};
const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Casa las líneas del albarán con las del presupuesto firmado.
 *
 * `yaFacturado` permite entregar en varias veces (obra por fases, que es el caso normal): mapa
 * `quoteLineIndex → cantidad ya facturada`. Sin él, dos albaranes del mismo presupuesto
 * facturarían dos veces lo mismo.
 *
 * NO decide si se puede emitir — eso es `motivosParaNoEmitir`. Aquí solo se clasifica.
 */
export function casarLineas(
  lineasAlbaran: LineaAlbaranEntrada[] | null | undefined,
  lineasPresupuesto: LineaPresupuesto[] | null | undefined,
  yaFacturado: Map<number, number> | Record<number, number> = {},
): Casacion {
  const albaran = Array.isArray(lineasAlbaran) ? lineasAlbaran : [];
  const presupuesto = Array.isArray(lineasPresupuesto) ? lineasPresupuesto : [];
  const yaLeido = (i: number): number => {
    const v = yaFacturado instanceof Map ? yaFacturado.get(i) : (yaFacturado as any)?.[i];
    const n = num(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const facturables: LineaFacturableDelAlbaran[] = [];
  const paraAdicional: LineaNoFacturable[] = [];

  albaran.forEach((l, lineaIndex) => {
    const concepto = texto(l?.concepto);
    const unidad = texto(l?.unidad);
    const cantidad = num(l?.cantidad);
    const idx = num(l?.quoteLineIndex);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      paraAdicional.push({ lineaIndex, concepto, cantidad: 0, unidad, motivo: 'sin_cantidad' });
      return;
    }

    // AÑADIDA EN OBRA. Es el caso que dispara el adicional, y el que la ley obliga a tratar así.
    if (!Number.isInteger(idx) || idx < 0) {
      paraAdicional.push({ lineaIndex, concepto, cantidad, unidad, motivo: 'no_estaba_en_el_presupuesto' });
      return;
    }
    const origen = presupuesto[idx];
    if (!origen) {
      // El índice apunta fuera. NO se factura «por si acaso»: sin línea de origen no hay precio
      // firmado, y sin precio firmado no hay nada que cobrar.
      paraAdicional.push({ lineaIndex, concepto, cantidad, unidad, motivo: 'linea_del_presupuesto_no_existe' });
      return;
    }

    const precioUnitario = num(origen.price);
    const tax = num(origen.tax);
    if (!Number.isFinite(precioUnitario)) {
      paraAdicional.push({ lineaIndex, concepto, cantidad, unidad, motivo: 'linea_del_presupuesto_no_existe' });
      return;
    }

    // ── ENTREGAR MÁS DE LO PRESUPUESTADO ES TRABAJO NO ACEPTADO ────────────────────────────
    // El ticket nombra el caso de entregar DE MENOS (3 de 10, se factura 3). El de más no lo
    // nombra, y la decisión que se toma aquí es la ESTRICTA: se factura hasta lo firmado y **el
    // exceso va al adicional**, no a la factura.
    //
    // Motivo: facturar 12 de 10 al precio aceptado produce exactamente lo que la regla prohíbe
    // —una factura mayor que el presupuesto— aunque el precio unitario sí estuviera firmado. La
    // cantidad también forma parte de lo que el cliente aceptó.
    const presupuestada = num(origen.qty);
    const disponible = Number.isFinite(presupuestada)
      ? Math.max(0, presupuestada - yaLeido(idx))
      : cantidad; // presupuesto sin cantidad declarada: no hay techo que aplicar
    const aFacturar = Math.min(cantidad, disponible);

    if (aFacturar > 0) {
      facturables.push({
        lineaIndex, quoteLineIndex: idx, concepto: concepto || texto(origen.concept),
        cantidad: aFacturar, precioUnitario, tax: Number.isFinite(tax) ? tax : 0,
      });
    }
    const exceso = cantidad - aFacturar;
    if (exceso > 0) {
      paraAdicional.push({
        lineaIndex, concepto, cantidad: exceso, unidad,
        motivo: 'exceso_sobre_lo_presupuestado', exceso,
      });
    }
  });

  return { facturables, paraAdicional, lineasDelAlbaran: albaran.length };
}

/**
 * EL SUELO, Y ES LA PARTE SERIA DE ESTE FICHERO.
 *
 * Devuelve los motivos por los que **NO se puede emitir**. Vacío = adelante.
 *
 * Una factura con CERO líneas es un documento fiscal emitido que no dice nada — y una factura
 * emitida **no se edita ni se borra** (regla 29): el error queda para siempre y solo se corrige
 * con una rectificativa. Así que «el casador no encontró nada» tiene que **parar la emisión**, no
 * producir un documento vacío.
 *
 * Y distingue los dos ceros, que es justo lo que un contador solo no puede hacer:
 *   · albarán SIN líneas            → no hay nada que facturar (y el albarán está mal)
 *   · albarán CON líneas y 0 casadas → el casador no casó NADA: o falta el presupuesto, o
 *                                      `quoteLineIndex` no se escribió. Nunca se factura vacío.
 */
export function motivosParaNoEmitir(c: Casacion, hayPresupuesto: boolean): string[] {
  const motivos: string[] = [];
  if (!hayPresupuesto) {
    motivos.push(
      'este albarán no tiene un presupuesto firmado detrás: sin él no hay precios aceptados por el cliente, y no se puede facturar nada',
    );
  }
  if (c.lineasDelAlbaran === 0) {
    motivos.push('el albarán no tiene ni una línea: no hay nada entregado que facturar');
  } else if (c.facturables.length === 0) {
    motivos.push(
      `el albarán tiene ${c.lineasDelAlbaran} línea(s) y NINGUNA casa con el presupuesto. Emitir aquí produciría una factura vacía, que es un documento fiscal que no dice nada y que la regla 29 impide corregir borrándolo`,
    );
  }
  return motivos;
}

/**
 * Cuánto se ha facturado ya de CADA LÍNEA DEL PRESUPUESTO, sumando TODOS los albaranes del
 * Trabajo. Devuelve el mapa que come `casarLineas`.
 *
 * ⚠️ EL LIBRO NO ESTÁ EN ESA UNIDAD, y ahí está la trampa. `AlbaranLineaFacturada` guarda
 * `(albaranId, lineaIndex)` — el índice de la línea del **ALBARÁN**, no del presupuesto. Dos
 * albaranes distintos tienen su propio `lineaIndex` 0, y los dos pueden apuntar a la MISMA línea
 * del presupuesto. Sumar por `lineaIndex` a secas mezclaría líneas que no tienen nada que ver.
 *
 * Por eso hay que traducir albarán a albarán antes de sumar. Y por eso esto no se resuelve con un
 * `groupBy` en la consulta: la traducción vive en el Json de cada albarán.
 *
 * Sin esto, una obra por fases factura DOS VECES lo mismo — y la segunda factura ya no se puede
 * borrar (regla 29).
 */
export function yaFacturadoPorLineaDePresupuesto(
  albaranes: Array<{ id: number; lineas: unknown }>,
  libro: Array<{ albaranId: number; lineaIndex: number; cantidad: unknown }>,
): Map<number, number> {
  const porAlbaran = new Map<number, LineaAlbaranEntrada[]>();
  for (const a of albaranes) porAlbaran.set(a.id, Array.isArray(a.lineas) ? (a.lineas as LineaAlbaranEntrada[]) : []);

  const acumulado = new Map<number, number>();
  for (const apunte of libro) {
    const lineas = porAlbaran.get(apunte.albaranId);
    if (!lineas) continue; // apunte de un albarán que no nos han pasado: no se inventa a qué línea va
    const idx = num(lineas[apunte.lineaIndex]?.quoteLineIndex);
    if (!Number.isInteger(idx) || idx < 0) continue; // línea sin origen: nunca salió del presupuesto
    const cantidad = num(apunte.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    acumulado.set(idx, (acumulado.get(idx) ?? 0) + cantidad);
  }
  return acumulado;
}

/** Base imponible de lo facturable, en la misma unidad decimal que `Quote.lines[].price`. */
export function baseDeFacturables(facturables: LineaFacturableDelAlbaran[]): number {
  return facturables.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
}

/**
 * Total con impuestos, redondeado a céntimo POR LÍNEA.
 *
 * El redondeo por línea y no sobre el total no es un detalle: es lo que ya hace
 * `albaran.service.ts:191`, y dos formas de redondear la misma factura dan importes distintos.
 */
export function totalDeFacturables(facturables: LineaFacturableDelAlbaran[]): string {
  let cents = 0;
  for (const l of facturables) {
    const baseCents = Math.round(l.cantidad * l.precioUnitario * 100);
    cents += baseCents + Math.round(baseCents * (Number(l.tax) || 0));
  }
  return (cents / 100).toFixed(2);
}

/** Las líneas en la forma que espera `Invoice.lines` — `{concept, qty, price, tax}`. */
export function lineasParaFactura(facturables: LineaFacturableDelAlbaran[]): Array<{
  concept: string; qty: number; price: number; tax: number;
}> {
  return facturables.map((l) => ({
    concept: l.concepto, qty: l.cantidad, price: l.precioUnitario, tax: l.tax,
  }));
}

// src/modules/jobs/domain/albaranFacturacion.ts
//
// SCRUM-170 (FACT-2c) · FACTURACIÓN PARCIAL POR CANTIDAD SERVIDA.
//
// LA REGLA QUE MANDA AQUÍ, Y DE DÓNDE VIENE
// -----------------------------------------
// SCRUM-17 decidió que «Facturado» se DERIVA (`invoiceId != null`) y nunca es un flag que
// alguien pone a mano, citando la queja documentada de DELSOL: albaranes que se quedan
// «pendientes» después de facturarse y hay que arreglar uno a uno. El ticket de este trabajo
// proponía un estado `PARCIALMENTE_FACTURADO` almacenado en `Albaran.estado` — y eso rompía
// justo esa regla, además de mezclar dos ejes que no son el mismo:
//
//   · `Albaran.estado` = ciclo del DOCUMENTO (borrador → emitido → firmado). Parte L, cerrada.
//   · estado de COBRO  = cuánto de lo servido se ha facturado ya. No es un estado del documento.
//
// Un albarán firmado puede estar sin facturar, a medias o entero, y seguirá firmado en los tres
// casos. Por eso el estado de cobro se CALCULA aquí a partir del libro de líneas facturadas
// (`AlbaranLineaFacturada`) y no se guarda en ninguna columna: no hay nada que se pueda quedar
// desincronizado, y anular una factura no obliga a decrementar ningún contador — basta con dejar
// de contar sus filas.
//
// PURO: no toca Prisma. Recibe las líneas y las cantidades ya leídas.

/** Línea de un albarán tal como vive en el Json (SCRUM-65). */
export interface LineaAlbaran {
  concepto?: string;
  cantidad?: number | string;
  unidad?: string;
  precioUnitario?: number | string;
  tipoIva?: number | string;
}

/**
 * Los tres valores del eje de cobro, EN RUNTIME y no solo en el tipo (SCRUM-301).
 *
 * El tipo se deriva de esta lista, no al revés: un eje que solo existe como unión de TypeScript
 * desaparece al compilar, así que cualquier pantalla que quisiera pintar «una pestaña por valor»
 * tendría que enumerarlos a mano — y una lista escrita a mano no avisa de lo que le falta. Con la
 * constante, añadir un valor aquí lo hace aparecer solo donde se derive, y `tsc` obliga a tratarlo.
 */
export const ESTADOS_COBRO = ['sin_facturar', 'parcial', 'facturado'] as const;
export type EstadoCobro = (typeof ESTADOS_COBRO)[number];

export interface PendienteLinea {
  index: number;
  concepto: string;
  unidad: string | null;
  servida: number;
  facturada: number;
  pendiente: number;
  precioUnitario: number;
  tipoIva: number;
}

/** Tres decimales: las unidades de obra se sirven fraccionadas (horas, m², kg). */
function red3(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

/**
 * Suma por línea de lo ya facturado. La entrada es el libro tal cual sale de la BD; cada fila
 * dice qué factura se llevó qué cantidad de qué línea.
 *
 * `facturasExcluidas` existe para la anulación (regla 29: una factura emitida no se borra, se
 * anula): al excluir sus filas, la cantidad vuelve a estar pendiente sin haber tocado ningún
 * contador ni haber reescrito historia.
 */
export function facturadoPorLinea(
  libro: Array<{ lineaIndex: number; cantidad: number | string | { toString(): string }; invoiceId: number }>,
  facturasExcluidas: ReadonlySet<number> = new Set(),
): Map<number, number> {
  const out = new Map<number, number>();
  for (const fila of libro) {
    if (facturasExcluidas.has(fila.invoiceId)) continue;
    const previo = out.get(fila.lineaIndex) || 0;
    out.set(fila.lineaIndex, red3(previo + Number(fila.cantidad.toString())));
  }
  return out;
}

/**
 * Qué queda por facturar de cada línea. Es la vista que necesita la pantalla y la que valida
 * la emisión: nadie puede facturar más de lo que se sirvió.
 */
export function pendientePorLinea(
  lineas: LineaAlbaran[],
  facturado: Map<number, number>,
): PendienteLinea[] {
  return (Array.isArray(lineas) ? lineas : []).map((l, index) => {
    const servida = red3(Number(l?.cantidad) || 0);
    const facturada = red3(facturado.get(index) || 0);
    return {
      index,
      concepto: String(l?.concepto || '').trim(),
      unidad: l?.unidad ? String(l.unidad) : null,
      servida,
      facturada,
      // Nunca negativo: si por lo que sea se facturó de más, lo que la pantalla tiene que decir
      // es «no queda nada», no un número en rojo que invite a corregirlo a mano.
      pendiente: red3(Math.max(0, servida - facturada)),
      precioUnitario: Number(l?.precioUnitario) || 0,
      tipoIva: Number(l?.tipoIva) || 0,
    };
  });
}

/**
 * El estado de cobro del albarán, DERIVADO. Tres valores y ninguno se guarda:
 *   · `sin_facturar` — no se ha facturado nada de él;
 *   · `parcial`      — algo se facturó y algo queda (es el vocabulario nuevo de la Parte L);
 *   · `facturado`    — no queda nada pendiente.
 *
 * `facturadoEntero` es la compatibilidad con la vía de siempre: la consolidación de SCRUM-17
 * marca `Albaran.invoiceId` al facturar el albarán COMPLETO. Un albarán marcado así está
 * facturado aunque no tenga libro (los que existían antes de este ticket).
 */
export function estadoCobroAlbaran(
  lineas: LineaAlbaran[],
  facturado: Map<number, number>,
  facturadoEntero = false,
): EstadoCobro {
  if (facturadoEntero) return 'facturado';
  const filas = pendientePorLinea(lineas, facturado);
  if (filas.length === 0) return 'sin_facturar';
  const algoFacturado = filas.some((f) => f.facturada > 0);
  if (!algoFacturado) return 'sin_facturar';
  return filas.every((f) => f.pendiente === 0) ? 'facturado' : 'parcial';
}

export interface PeticionLinea { index: number; cantidad: number }

/**
 * Valida lo que se pide facturar contra lo que queda. FAIL-CLOSED: si una sola línea de la
 * petición no cuadra, no se emite NADA — media factura correcta sigue siendo una factura que
 * no se puede editar ni borrar (regla 29).
 */
export function validarPeticionParcial(
  peticion: PeticionLinea[],
  pendientes: PendienteLinea[],
): { ok: true; lineas: PendienteLinea[] } | { ok: false; error: string; message: string } {
  if (!Array.isArray(peticion) || peticion.length === 0) {
    return { ok: false, error: 'seleccion_vacia', message: 'Indica qué cantidad quieres facturar de al menos una línea.' };
  }
  const vistos = new Set<number>();
  const elegidas: PendienteLinea[] = [];
  for (const p of peticion) {
    const index = Number(p?.index);
    const cantidad = red3(Number(p?.cantidad));
    if (!Number.isInteger(index) || index < 0 || index >= pendientes.length) {
      return { ok: false, error: 'linea_no_encontrada', message: 'Alguna de las líneas seleccionadas no existe en este parte.' };
    }
    // Repetir la misma línea en la petición sumaría dos veces sin que nadie lo note: se rechaza
    // en vez de sumarlas, porque lo segundo adivina la intención de quien manda los datos.
    if (vistos.has(index)) {
      return { ok: false, error: 'linea_repetida', message: 'Hay una línea repetida en la selección.' };
    }
    vistos.add(index);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { ok: false, error: 'cantidad_invalida', message: 'Las cantidades a facturar tienen que ser mayores que cero.' };
    }
    const p2 = pendientes[index];
    if (cantidad > p2.pendiente) {
      return {
        ok: false,
        error: 'cantidad_excede_pendiente',
        message: `De "${p2.concepto || 'esa línea'}" solo quedan ${p2.pendiente} por facturar.`,
      };
    }
    elegidas.push({ ...p2, pendiente: cantidad }); // `pendiente` aquí = lo que se va a facturar
  }
  return { ok: true, lineas: elegidas };
}

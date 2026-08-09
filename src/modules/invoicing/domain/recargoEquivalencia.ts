// src/modules/invoicing/domain/recargoEquivalencia.ts — SCRUM-294 (A3)
//
// EL RECARGO DE EQUIVALENCIA, CALCULADO APARTE Y SIN TOCAR NADA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA MEDICIÓN QUE DECIDE EL TICKET: ¿CAMBIA LA BASE, O ES UN IMPUESTO MÁS SOBRE ELLA?
//
// La respuesta no sale de la memoria: sale del **XSD de la AEAT que está en este repo**
// (`src/modules/fiscal/verifactu/xsd/SuministroInformacion.xsd`, `DetalleDesglose`):
//
//     <element name="TipoImpositivo"              minOccurs="0"/>
//     <element name="BaseImponibleOimporteNoSujeto"/>
//     <element name="CuotaRepercutida"            minOccurs="0"/>
//     <element name="TipoRecargoEquivalencia"     minOccurs="0"/>   ← hermanos
//     <element name="CuotaRecargoEquivalencia"    minOccurs="0"/>   ← de los de arriba
//
// **No existe ninguna `BaseRecargo`.** El recargo cuelga de la MISMA base imponible: es un
// impuesto MÁS sobre ella, no una base distinta. Y en las rectificativas pasa igual
// (`CuotaRecargoRectificado` junto a `BaseRectificada`/`CuotaRectificada`).
//
// **Consecuencia, y es la que permite entregar esto hoy:** el recargo NO obliga a modificar
// `calcVatBreakdown`. La base y la cuota de IVA salen exactamente igual con recargo que sin él,
// así que los 16 consumidores de esa función —uno de ellos `registro.builder.ts`, que manda
// `entrada.base.toFixed(2)` literal al XML sellado— **no tienen nada que aprender** (regla 38).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTE MÓDULO NO LO LLAMA NADIE TODAVÍA, Y ES DELIBERADO
//
// Enchufarlo a la emisión sí toca el camino de emisión, por dos sitios y con nombre:
//
//   ① EL TOTAL. `Invoice.total = grossOfLines() = base + cuota`. Con recargo, lo que el cliente
//      paga es `base + cuota + recargo`. Cambiar ese total cambia **el número que se sella**.
//   ② EL XML. El desglose tendría que llevar `TipoRecargoEquivalencia` y
//      `CuotaRecargoEquivalencia`, y eso es `registro.builder.ts`.
//
// Las dos cosas son STOP y necesitan GO del fundador con el diff delante. Además, el recargo es
// **condición de QUIÉN COMPRA** (`docs/diseno/bloque-a.md` § A3: «que el recargo esté en el
// cliente y no en la factura es correcto»), así que vive en la ficha del cliente — un campo de
// schema que hoy no existe y que no se pone por iniciativa propia (SCRUM-383).
//
// Esto es, igual que `retencionIrpf.ts` (A2), un hueco estructurado con su mecanismo dentro.

/** Dos decimales, medio arriba. El MISMO redondeo que `round2` en `vat.service`. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Los tipos de recargo, atados a su tipo de IVA.
 *
 * ⚠️ LOS PORCENTAJES ESTÁN **PENDIENTES DE CONFIRMACIÓN DEL ASESOR** (pregunta añadida a
 * `docs/legal/PREGUNTAS_ASESOR.md`). No salen de ningún documento del repo: el XSD da la FORMA
 * (un tipo y una cuota por tramo), no los valores. Se dejan aquí porque el mecanismo tiene que
 * poder probarse, pero **cerrados y en un solo sitio**: el día que el asesor los confirme o los
 * corrija, se cambia una línea y todo lo demás sigue igual.
 *
 * Un tipo libre dejaría meter un 5,3 que no existe; y un tipo de IVA sin recargo conocido NO se
 * aproxima con el más parecido: se declara desconocido (misma regla que el 303 con las casillas).
 */
export const RECARGO_POR_TIPO_IVA: Readonly<Record<number, number>> = Object.freeze({
  21: 5.2,
  10: 1.4,
  4: 0.5,
});

export type ResultadoRecargo =
  | { ok: true; tipoIva: number; tipoRecargo: number; base: number; cuota: number }
  | { ok: false; motivo: 'tipo_iva_sin_recargo_conocido' | 'base_ilegible'; detalle: string };

/**
 * El recargo de UN tramo del desglose. **Sobre la misma base que el IVA**, nunca sobre la cuota
 * ni sobre el total.
 *
 * La base entra YA REDONDEADA (es el contrato de `calcVatBreakdown`) y no se vuelve a tocar:
 * redondear dos veces mueve céntimos, y un céntimo de más en un impuesto hay que explicárselo a
 * alguien.
 */
export function calcularRecargo(base: unknown, tipoIva: unknown): ResultadoRecargo {
  const b = typeof base === 'number' ? base : Number(base);
  // `Number('')` es 0 y `Number([])` es 0 (familia SCRUM-271): una base ilegible NO se convierte
  // en cero, porque un recargo de 0,00 € se lee como «este cliente no lleva recargo».
  if (base === null || base === undefined || base === '' || Array.isArray(base) || !Number.isFinite(b)) {
    return { ok: false, motivo: 'base_ilegible', detalle: `base no utilizable: ${JSON.stringify(base)}` };
  }
  const iva = typeof tipoIva === 'number' ? tipoIva : Number(tipoIva);
  const tipoRecargo = Number.isFinite(iva) ? RECARGO_POR_TIPO_IVA[iva] : undefined;
  if (tipoRecargo === undefined) {
    return {
      ok: false,
      motivo: 'tipo_iva_sin_recargo_conocido',
      detalle: `el tipo de IVA ${JSON.stringify(tipoIva)} no tiene recargo conocido; no se aproxima con el más parecido`,
    };
  }
  return { ok: true, tipoIva: iva, tipoRecargo, base: b, cuota: round2(b * (tipoRecargo / 100)) };
}

/** Un tramo del desglose, tal y como lo devuelve `calcVatBreakdown` (leído, nunca importado). */
export interface TramoDesglose { rate: number; base: number; cuota: number }

export interface RecargoDeLaFactura {
  /** Un resultado POR TRAMO, en el mismo orden que llegó el desglose. */
  tramos: ResultadoRecargo[];
  /** La suma de lo que SÍ se pudo calcular. */
  total: number;
  /** Los tramos que no se pudieron calcular. Se cuentan; nunca se tiran en silencio. */
  sinCalcular: string[];
}

/**
 * El recargo de una factura entera, tramo a tramo.
 *
 * ⚠️ Si un tramo no se puede calcular, el total **no lo incluye** y el motivo sale en
 * `sinCalcular`. Sumar cero por un tramo desconocido produciría un recargo más bajo que el real,
 * y ese número acaba en una factura que alguien cobra.
 */
export function calcularRecargoDeFactura(tramos: readonly TramoDesglose[]): RecargoDeLaFactura {
  const resultados = (Array.isArray(tramos) ? tramos : []).map((t) => calcularRecargo(t?.base, t?.rate));
  return {
    tramos: resultados,
    total: round2(resultados.reduce((a, r) => a + (r.ok ? r.cuota : 0), 0)),
    sinCalcular: resultados.filter((r): r is Extract<ResultadoRecargo, { ok: false }> => !r.ok).map((r) => r.detalle),
  };
}

/**
 * EL SUELO. ¿Este cliente lleva recargo de equivalencia?
 *
 * Tres valores, no dos: **«no se pudo leer» NO es «no lleva recargo»**. Emitir sin el recargo de
 * quien lo lleva es un defecto MUDO —la factura sale, se cobra, y el proveedor se come el recargo
 * que tenía que haber repercutido—, así que quien no pueda leer la configuración tiene que
 * pararse, no continuar tranquilo.
 *
 * ⚠️ `false` significa «declarado que NO», y es distinto de `null`/`undefined`, que significa
 * «no hay dato». Esa diferencia es todo el suelo.
 */
export function leerRecargoDelCliente(config: unknown):
  | { ok: true; aplica: boolean }
  | { ok: false; motivo: string } {
  if (config === null || config === undefined) {
    return { ok: false, motivo: 'no se ha podido leer si el cliente está en recargo de equivalencia' };
  }
  if (config === true || config === false) return { ok: true, aplica: config };
  return { ok: false, motivo: `valor de recargo de equivalencia no reconocido: ${JSON.stringify(config)}` };
}

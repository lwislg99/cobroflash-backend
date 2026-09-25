// src/modules/fiscal/modelo303/casillas.ts — SCRUM-295 (A5) · el mapa de casillas del modelo 303.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS NÚMEROS DE CASILLA NO SE INVENTAN AQUÍ. PROCEDENCIA: `docs/diseno/bloque-a.md`, A5.
//
// Ese documento fija el mapeo del IVA devengado en régimen general:
//   «21 % → 07-09, 10 % → 04-06, 4 % → 01-03, TOTAL casilla 27»
// y cada tripleta es (base imponible, tipo %, cuota), en ese orden.
//
// Un número de casilla escrito de memoria es una declaración falsa con aspecto de dato. Si el
// mapeo cambia, cambia PRIMERO en ese documento y luego aquí — nunca al revés.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ SOLO RÉGIMEN GENERAL, Y SOLO LO QUE SE PUEDE CLASIFICAR CON CERTEZA
//
// Aquí NO hay casillas para exentas (E1..E6), no sujetas (N1/N2) ni inversión del sujeto pasivo
// (S2), y su ausencia es deliberada: hoy la factura no guarda esa calificación (SCRUM-212), así
// que meter una operación en una de esas casillas sería ADIVINARLA. Un `ClaveRegimen` adivinado
// es una declaración falsa.
//
// La regla que sí se puede sostener con el dato que hay: **una línea con tipo > 0 lleva IVA
// repercutido, luego es sujeta y no exenta**; no se puede repercutir IVA sobre una operación
// exenta o no sujeta. Todo lo demás —tipo 0, o un tipo sin casilla en el modelo— queda SIN
// CLASIFICAR y se declara. No se coloca en la casilla más probable.
export interface TripletaCasilla {
  /** Tipo de IVA en porcentaje, tal y como lo produce `calcVatBreakdown` (21, 10, 4). */
  tipo: number;
  /** Casilla de la BASE imponible. */
  base: number;
  /** Casilla del TIPO (el porcentaje en sí). */
  tipoCasilla: number;
  /** Casilla de la CUOTA. */
  cuota: number;
}

/**
 * Las tres tripletas del régimen general, en el orden del impreso (4 % primero).
 *
 * Procedencia: `docs/diseno/bloque-a.md` § A5.
 */
export const TRIPLETAS: readonly TripletaCasilla[] = Object.freeze([
  Object.freeze({ tipo: 4,  base: 1, tipoCasilla: 2, cuota: 3 }),
  Object.freeze({ tipo: 10, base: 4, tipoCasilla: 5, cuota: 6 }),
  Object.freeze({ tipo: 21, base: 7, tipoCasilla: 8, cuota: 9 }),
]);

/** Casilla del TOTAL de cuota devengada. Procedencia: `docs/diseno/bloque-a.md` § A5. */
export const CASILLA_TOTAL_CUOTA_DEVENGADA = 27;

/** La tripleta de un tipo, o `null` si ese tipo no tiene casilla en este mapeo. */
export function tripletaDe(tipo: number): TripletaCasilla | null {
  return TRIPLETAS.find((t) => t.tipo === tipo) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1063b · IVA DEDUCIBLE Y RESULTADO. PROCEDENCIA: el formulario oficial, LEÍDO.
//
// Orden HAC/27/2026, Anexo III (sustituye el Anexo I de EHA/3786/2008), página 1 del impreso:
//   https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_7.png
// La 45 y la 46 las transcribió SCRUM-1039b (`docs/master/SCRUM-1039.md` §1): «Total a deducir
// (29+31+33+35+37+39+41+42+43+44)» y «Resultado régimen general (27-45)». QUÉ va en la 28/29 y en
// la 30/31 no lo transcribió: se leyó en la misma imagen el 25-sep-2026 (`docs/master/SCRUM-1063.md`):
//   28/29 «Por cuotas soportadas en operaciones interiores corrientes»
//   30/31 «Por cuotas soportadas en operaciones interiores con bienes de inversión»
//
// ⚠️ Las demás que suman en la 45 (importaciones 32-35, intracomunitarias 36-39, rectificación
// 40/41, 42-44) NO se rellenan: nada en `Expense` dice que un gasto sea ninguna de esas cosas.
export interface ParCasilla {
  /** Casilla de la BASE. */
  base: number;
  /** Casilla de la CUOTA. */
  cuota: number;
}

/** Operaciones interiores CORRIENTES (28/29). */
export const CASILLAS_DEDUCIBLE_CORRIENTES: ParCasilla = Object.freeze({ base: 28, cuota: 29 });

/** Operaciones interiores con BIENES DE INVERSIÓN (30/31). Hoy siempre vacías: no hay dato. */
export const CASILLAS_DEDUCIBLE_BIENES_INVERSION: ParCasilla = Object.freeze({ base: 30, cuota: 31 });

/** «Total a deducir». */
export const CASILLA_TOTAL_A_DEDUCIR = 45;

/** «Resultado régimen general (27-45)». */
export const CASILLA_RESULTADO_REGIMEN_GENERAL = 46;

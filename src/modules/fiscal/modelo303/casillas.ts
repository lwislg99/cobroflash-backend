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

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1063c · EL «RESULTADO». PROCEDENCIA: el formulario oficial, LEÍDO como imagen.
//
// Orden HAC/27/2026, Anexo III, página 3 del impreso, recuadro «Resultado»:
//   https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_9.png
// Leído el 24-oct-2026 (`docs/master/SCRUM-1063.md`, tramo 1063c):
//   64 «Suma de resultados (46 + 58 + 76)»
//   65 el «%» de «Atribuible a la Administración del Estado», y 66 su importe
//   68 «Exclusivamente para sujetos pasivos que tributan conjuntamente a la Administración del
//      Estado y a las Haciendas Forales. Resultado de la regularización anual.»
//   69 «Resultado de la autoliquidación (66 + 77 - 78 + 68 + 108)»
//   70 «Resultado a ingresar correspondiente a la anterior autoliquidación o liquidación
//      administrativa del ejercicio y período objeto de la autoliquidación»
//   71 «Resultado (69 - 70 + 109 - 112)»
// ⚠️ NO HAY CASILLA 67 en este impreso: las cuotas a compensar son la 110, la 78 y la 87. Por eso
// la lista de vacías no la lleva: escribirla sería inventar una casilla.
//
// Decisión del fundador (SCRUM-1063 c.20717): la 64 = 46 (la 58 es del simplificado y la 76 una
// regularización que YaQu no calcula) y de la 65 a la 71 VACÍAS, con su motivo como dato.

/** «Suma de resultados (46 + 58 + 76)». */
export const CASILLA_SUMA_DE_RESULTADOS = 64;

/** Las casillas del «Resultado» entre la 65 y la 71 que existen en el impreso, vacías y por qué. */
export const CASILLAS_RESULTADO_VACIAS = Object.freeze([
  Object.freeze({ casilla: 65, motivo: 'porcentaje_atribuible_no_consta' as const }),
  Object.freeze({ casilla: 66, motivo: 'depende_de_la_65' as const }),
  Object.freeze({ casilla: 68, motivo: 'regularizacion_anual_foral_no_consta' as const }),
  Object.freeze({ casilla: 69, motivo: 'depende_de_la_66' as const }),
  Object.freeze({ casilla: 70, motivo: 'autoliquidacion_anterior_no_consta' as const }),
  Object.freeze({ casilla: 71, motivo: 'depende_de_la_69' as const }),
]);

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1064c · LOS RÓTULOS. PROCEDENCIA: el impreso, LEÍDO como imagen el 24-oct-2026.
//
// Decisión del fundador (SCRUM-1064 c.20780): transcripción LITERAL del Anexo III de la Orden
// HAC/27/2026, SIN la fórmula entre paréntesis («Total cuota devengada», no «Total cuota devengada
// (152 + …)»). Viajan en `GET /admin/modelo-303` para que la pantalla no los copie a mano.
//   página 1: https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_7.png
//   página 3: https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_9.png
//
// ⚠️ Las 01–09 NO tienen rótulo propio en el impreso: son tres filas de la llave «Régimen general»
// (que abarca también la 150, la 165 y la 153), bajo «IVA devengado», y lo que las distingue es la
// COLUMNA. Por eso cada rótulo lleva su `columna`, tal y como la escribe la cabecera del impreso.
// ⚠️ La 70 lleva en el impreso una llamada «(*)» a una nota al pie; aquí va sin ella.
export interface RotuloCasilla {
  casilla: number;
  /** El texto de la fila en el impreso, sin la fórmula entre paréntesis. */
  rotulo: string;
  /** La cabecera de la columna, cuando la fila tiene varias casillas. */
  columna?: string;
  /** Página del Anexo III donde se lee. */
  pagina: 1 | 3;
}

const REGIMEN_GENERAL = 'Régimen general';
const DEDUCIBLE_CORRIENTES = 'Por cuotas soportadas en operaciones interiores corrientes';
const DEDUCIBLE_BIENES_INVERSION = 'Por cuotas soportadas en operaciones interiores con bienes de inversión';
const ATRIBUIBLE_AL_ESTADO = 'Atribuible a la Administración del Estado';

// SCRUM-1064d · decisión del fundador (SCRUM-1064 c.20823, punto c): como las tres filas llevan el
// mismo rótulo, las 01–09 se rotulan «Régimen general · {tipo} %», y el tipo sale del dato de la
// fila (`TRIPLETAS`), no de un literal: si la fila cambia de tipo, su rótulo cambia con ella.
const filasRegimenGeneral = TRIPLETAS.flatMap((t) => {
  const rotulo = `${REGIMEN_GENERAL} · ${t.tipo} %`;
  return [
    Object.freeze({ casilla: t.base, rotulo, columna: 'Base imponible', pagina: 1 as const }),
    Object.freeze({ casilla: t.tipoCasilla, rotulo, columna: 'Tipo %', pagina: 1 as const }),
    Object.freeze({ casilla: t.cuota, rotulo, columna: 'Cuota', pagina: 1 as const }),
  ];
});

export const ROTULOS_303: readonly RotuloCasilla[] = Object.freeze([
  ...filasRegimenGeneral,
  Object.freeze({ casilla: 27, rotulo: 'Total cuota devengada', pagina: 1 as const }),
  Object.freeze({ casilla: 28, rotulo: DEDUCIBLE_CORRIENTES, columna: 'Base', pagina: 1 as const }),
  Object.freeze({ casilla: 29, rotulo: DEDUCIBLE_CORRIENTES, columna: 'Cuota', pagina: 1 as const }),
  Object.freeze({ casilla: 30, rotulo: DEDUCIBLE_BIENES_INVERSION, columna: 'Base', pagina: 1 as const }),
  Object.freeze({ casilla: 31, rotulo: DEDUCIBLE_BIENES_INVERSION, columna: 'Cuota', pagina: 1 as const }),
  Object.freeze({ casilla: 45, rotulo: 'Total a deducir', pagina: 1 as const }),
  Object.freeze({ casilla: 46, rotulo: 'Resultado régimen general', pagina: 1 as const }),
  Object.freeze({ casilla: 64, rotulo: 'Suma de resultados', pagina: 3 as const }),
  Object.freeze({ casilla: 65, rotulo: ATRIBUIBLE_AL_ESTADO, columna: '%', pagina: 3 as const }),
  Object.freeze({ casilla: 66, rotulo: ATRIBUIBLE_AL_ESTADO, pagina: 3 as const }),
  Object.freeze({ casilla: 68, rotulo: 'Exclusivamente para sujetos pasivos que tributan conjuntamente a la Administración del Estado y a las Haciendas Forales. Resultado de la regularización anual.', pagina: 3 as const }),
  Object.freeze({ casilla: 69, rotulo: 'Resultado de la autoliquidación', pagina: 3 as const }),
  Object.freeze({ casilla: 70, rotulo: 'Resultado a ingresar correspondiente a la anterior autoliquidación o liquidación administrativa del ejercicio y período objeto de la autoliquidación', pagina: 3 as const }),
  Object.freeze({ casilla: 71, rotulo: 'Resultado', pagina: 3 as const }),
]);

// SCRUM-1063f · LA S2 DEL EMISOR. PROCEDENCIA: el impreso y las instrucciones, LEÍDOS.
//
// Orden HAC/27/2026, Anexo III, página 3 del impreso, recuadro «Información adicional»:
//   https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_9.png
//   122 «Operaciones sujetas con inversión del sujeto pasivo» — una sola cifra, SIN cuota.
// Instrucciones de la AEAT para 2026 (02 a 12 y 2T a 4T), leídas el 24-oct-2026:
//   https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026/instrucciones-02-12-2t-4t-2026.html
//   «122 Operaciones sujetas con inversión del sujeto pasivo: se hará constar el importe total, en
//   el período objeto de declaración, de: […] Las entregas de bienes y prestaciones de servicios
//   realizadas a que se refiere el artículo 84 Uno. 2º a), c), d), e), f) y g) de la Ley.»
// Es la del que EMITE la operación (la 12/13 es la del que la recibe y autorrepercute). Es
// información adicional: no suma en la 27 ni en el resultado.
//
// Decisión del fundador (SCRUM-1063 c.20768): la base de la S2 del emisor va a la 122.

/** «Operaciones sujetas con inversión del sujeto pasivo» (Información adicional, sin cuota). */
export const CASILLA_INVERSION_SUJETO_PASIVO = 122;

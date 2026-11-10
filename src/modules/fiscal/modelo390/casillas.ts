// src/modules/fiscal/modelo390/casillas.ts — SCRUM-1077 · las casillas del modelo 390.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS NÚMEROS DE CASILLA NO SE INVENTAN AQUÍ. PROCEDENCIA: el formulario oficial, LEÍDO.
//
// Orden EHA/3111/2009 (aprueba el 390), consolidada en el BOE (BOE-A-2009-18472), Anexo I:
//   «Se sustituye por el que figura como anexo IV de la Orden HAC/27/2026, de 22 de enero, según
//   establece su art. 3. […] Téngase en cuenta que será aplicable por primera vez a la
//   declaración-resumen anual correspondiente al ejercicio 2026, según establece la disposición
//   final única.2 de la citada Orden.»
// El Anexo IV es una IMAGEN (9 páginas, `1761_16563944_13.png` a `_21.png`). Método de SCRUM-1039b:
// `curl` del BOE y lectura visual, el 24-oct-2026. Las de 33/34, 64 y 65 ya las había transcrito
// SCRUM-1039b (`docs/master/SCRUM-1039.md` §2); las demás se leyeron ahora en las mismas páginas.
//
// Se guardan como TEXTO y con el cero delante cuando el impreso lo lleva («01», no 1): es la
// etiqueta del impreso, no una cantidad (convención de `fiscal/retenciones/casillas.ts`).
//
// ⚠️ SOLO EL EJERCICIO 2026 EN ADELANTE: el impreso de antes no se ha leído, y sus casillas no se
// suponen iguales. Si el impreso cambia, cambia PRIMERO el registro de SCRUM-1077 y luego aquí.

/** Primer ejercicio al que se aplica el impreso leído (disposición final única.2 de HAC/27/2026). */
export const PRIMER_EJERCICIO_DEL_IMPRESO = 2026;

const IMAGEN = (pag: number) => `https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_${pag}.png`;

/** De dónde sale cada casilla, para que viaje con el borrador. */
export const FUENTE_390 = `Orden HAC/27/2026, Anexo IV (sustituye el Anexo I de EHA/3111/2009) · ${IMAGEN(14)} · ${IMAGEN(15)} · ${IMAGEN(16)} · ${IMAGEN(17)} · ${IMAGEN(19)}`;

export interface TripletaDevengado390 {
  tipo: number;
  base: string;
  cuota: string;
}

/**
 * Pág. 2 (`_14.png`) · «5. Operaciones realizadas en régimen general» · «IVA devengado» ·
 * «Régimen ordinario»: 4 % → 01/02 · 10 % → 03/04 · 21 % → 05/06.
 *
 * Las mismas tres tasas que el 303 sabe colocar (`modelo303/casillas.ts`). Las filas de 0, 2, 5 y
 * 7,5 % (700/701, 667/668, 702/703, 669/670) NO se rellenan: lo que el 303 no coloca va a su
 * «sin clasificar», y aquí sale igual, declarado.
 */
export const TRIPLETAS_DEVENGADO_390: readonly TripletaDevengado390[] = Object.freeze([
  Object.freeze({ tipo: 4, base: '01', cuota: '02' }),
  Object.freeze({ tipo: 10, base: '03', cuota: '04' }),
  Object.freeze({ tipo: 21, base: '05', cuota: '06' }),
]);

/** Pág. 2 · 33/34 «Total bases y cuotas IVA». */
export const CASILLAS_TOTAL_DEVENGADO_390 = Object.freeze({ base: '33', cuota: '34' });

/**
 * Pág. 2 bis (`_15.png`) · 47 «Total cuotas IVA y recargo de equivalencia
 * (34 + 664 + 692 + 36 + 666 + 694 + 600 + 602 + 42 + 44 + 46)». El recargo no se rellena (el 303
 * tampoco lo pone en su 27), así que hoy 47 = 34.
 */
export const CASILLA_TOTAL_CUOTAS_Y_RECARGO_390 = '47';

/**
 * Pág. 3 (`_16.png`) · «IVA deducible» · 48/49 «Total bases imponibles y cuotas deducibles en
 * operaciones interiores de bienes y servicios corrientes». Es la suma del 28/29 del 303.
 *
 * ⚠️ El impreso desglosa esas operaciones por tipo (4 % → 190/191, 10 % → 603/604, 21 % →
 * 605/606…), y el 303 no: da el total. Sacar el desglose sería volver a leer los gastos, un
 * segundo cálculo. No se rellenan, y el borrador dice por qué.
 */
export const CASILLAS_DEDUCIBLE_CORRIENTES_390 = Object.freeze({ base: '48', cuota: '49' });

/** Pág. 3 · 50/51 «… operaciones interiores de bienes de inversión». Vacías, como la 30/31 del 303. */
export const CASILLAS_DEDUCIBLE_BIENES_INVERSION_390 = Object.freeze({ base: '50', cuota: '51' });

/** Pág. 4 (`_17.png`) · 64 «Suma de deducciones (49 + 513 + 51 + 521 + … + 63 + 522)». */
export const CASILLA_SUMA_DEDUCCIONES_390 = '64';

/** Pág. 4 · 65 «Resultado régimen general (47 - 64)». */
export const CASILLA_RESULTADO_REGIMEN_GENERAL_390 = '65';

/**
 * 84 «Suma de resultados», 86 «Resultado de la liquidación anual» y 95 «Total resultados a ingresar
 * en las autoliquidaciones del ejercicio»: transcritas por SCRUM-1039b (§2), no releídas aquí.
 * NO se rellenan. Son las del 390 que corresponden a las 64-71 del 303, y el 303 las deja vacías.
 */
export const CASILLAS_SIN_RELLENAR_390: readonly string[] = Object.freeze(['84', '86', '95']);

/**
 * SCRUM-1077c · Pág. 6 (`_19.png`) · «10. Volumen de operaciones» · 125 «Operaciones sujetas con
 * inversión del sujeto pasivo». Una sola cifra, sin cuota. Es la base de la S2 del EMISOR, como
 * suma de las cuatro 122 del 303 (decisión del fundador, SCRUM-1077 c.20833). La 27/28 y la 77 son
 * las del destinatario, que autorrepercute: no son ésta.
 *
 * Instrucciones de la AEAT de 2025, pág. 22 (las de 2026 no existían el 24-oct-2026; cuando salgan,
 * se cotejan): «125 Operaciones sujetas con inversión del sujeto pasivo: se hará constar, el importe
 * total de: […] Las entregas de bienes y prestaciones de servicios realizadas a que se refiere el
 * artículo 84 Uno. 2º a), c), d), e), f) y g) de la Ley.» La factura no guarda la letra, así que
 * entra toda S2 (riesgo aceptado en c.20833).
 *
 * La misma página tiene la 99 y la 108 (la 108 suma la 125; la 99 la excluye). NO se rellenan: la
 * decisión no las abre.
 */
export const CASILLA_INVERSION_SUJETO_PASIVO_390 = '125';

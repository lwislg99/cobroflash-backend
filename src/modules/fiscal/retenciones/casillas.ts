// src/modules/fiscal/retenciones/casillas.ts — SCRUM-1066c · las casillas del 111 y del 115.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS NÚMEROS DE CASILLA NO SE INVENTAN AQUÍ. PROCEDENCIA: el formulario oficial, LEÍDO.
//
// Las órdenes remiten el impreso a un anexo que es una IMAGEN, no texto (SCRUM-1066b: 0 «casilla»
// en el articulado). Método de SCRUM-1039b: `curl` del BOE y lectura visual del PNG, hecha dos
// veces por separado el 23-oct-2026. Transcripción completa, con tamaños y lo no leído:
// `docs/master/evidencias/scrum1066/casillas-111-115.md`.
//
// Se guardan como TEXTO y con el cero delante cuando el impreso lo lleva («07», no 7): es la
// etiqueta del impreso, no una cantidad. El 115 las imprime sin cero («1»…«5»).
//
// Si el impreso cambia, cambia PRIMERO esa evidencia y luego aquí, nunca al revés.

/**
 * Orden EHA/586/2011, Anexo I, página 1:
 *   https://www.boe.es/datos/imagenes/disp/2011/66/04948_001.png
 * Consolidado sin sustitución del anexo («Texto inicial publicado el 18/03/2011»).
 */
export const FUENTE_111 = 'Orden EHA/586/2011, Anexo I, pág. 1 · https://www.boe.es/datos/imagenes/disp/2011/66/04948_001.png';

/**
 * Orden de 20-nov-2000, Anexo II (euros), página 1:
 *   https://www.boe.es/datos/imagenes/disp/2000/285/21430_005.png
 */
export const FUENTE_115 = 'Orden de 20-nov-2000, Anexo II, pág. 1 · https://www.boe.es/datos/imagenes/disp/2000/285/21430_005.png';

/**
 * 111 · «II. Rendimientos de actividades económicas» · «Rendimientos dinerarios»:
 *   07 «N.º de perceptores» · 08 «Importe de las percepciones» · 09 «Importe de las retenciones».
 *
 * Es el ÚNICO bloque que se rellena. Los demás —I trabajo (01-06), II en especie (10-12),
 * III premios (13-18), IV aprovechamientos forestales (19-24), V derechos de imagen (25-27)— no
 * tienen dato en YaQu: no hay nóminas (`TeamMember` es una cuenta de acceso, SCRUM-1066) ni pagos
 * en especie. Se dejan fuera, y la población cubierta lo declara.
 */
export const CASILLAS_111_ACTIVIDADES_DINERARIAS = Object.freeze({ perceptores: '07', importe: '08', retenciones: '09' });

/** 111 · 28 «Suma de retenciones e ingresos a cuenta (03+06+09+12+15+18+21+24+27)». */
export const CASILLA_111_SUMA_RETENCIONES = '28';

/**
 * 111 · 29 «A deducir (exclusivamente en caso de autoliquidación complementaria)» y
 * 30 «Resultado a ingresar (28 – 29)». La complementaria no está construida: la 29 va a 0.
 */
export const CASILLA_111_A_DEDUCIR = '29';
export const CASILLA_111_RESULTADO = '30';

/**
 * 115 · «Retenciones e ingresos a cuenta»:
 *   1 «N.º de perceptores» · 2 «Base de las retenciones e ingresos a cuenta» ·
 *   3 «Retenciones e ingresos a cuenta» · 4 «A deducir (exclusivamente en caso de declaración
 *   complementaria)» · 5 «Resultado a ingresar (3 - 4)».
 */
export const CASILLAS_115 = Object.freeze({
  perceptores: '1', base: '2', retenciones: '3', aDeducir: '4', resultado: '5',
});

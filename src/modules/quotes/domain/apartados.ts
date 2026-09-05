// src/modules/quotes/domain/apartados.ts — SCRUM-655 (T6, sprint Tecnosel)
//
// LOS APARTADOS DE UN PRESUPUESTO: UNA LÍNEA MARCADA COMO CABECERA, EN EL MISMO ARRAY.
//
// ── POR QUÉ UNA LÍNEA Y NO UN ARRAY DE APARTADOS (decisión del fundador) ──────────────────
// `Quote.lines` es PLANO y todos sus consumidores lo recorren. Un array de apartados con líneas
// dentro cambia la forma para TODOS y rompe el caso simple. Una línea de cabecera es ADITIVA: el
// que no sepa de apartados ve una línea más. Y encaja con lo que es — «1. APARTADO» es
// literalmente un renglón del documento.
//
// ── 🔴 LAS CABECERAS NO SUMAN, Y HOY NO ERA «NO SUMAN»: ERA NaN ───────────────────────────
// Medido antes de tocar nada, con el `calcTotal` real:
//
//     calcTotal([{concept:'Mano de obra', qty:2, price:100}])                 →  200
//     calcTotal([{concept:'1. APARTADO'}, {concept:'Mano de obra', …}])       →  NaN
//
// `undefined * undefined` es `NaN`, y `NaN` contamina la suma entera. O sea que una cabecera sin
// esta pieza no deja el total igual: **deja el presupuesto sin total**. Por eso el filtrado vive
// aquí y `calcTotal` lo consume, en vez de repetir el criterio.
//
// ── LA NUMERACIÓN ES DERIVADA DE LA POSICIÓN, NUNCA SE TECLEA ─────────────────────────────
// Si se tecleara, dos líneas acabarían con el mismo `1.02` y «quítame la 1.03» dejaría de tener
// respuesta. Derivada, mover una línea recoloca los números solos y **dos líneas no pueden
// compartir número**: cada una sale del par (apartado, posición dentro del apartado).

// ⚠️ SIN `export`, y a propósito (SCRUM-411): de fuera solo entraban su test. La garantía de
// que el front marca con la MISMA clave se prueba por COMPORTAMIENTO —marcar con la clave del
// front y comprobar que el total la salta—, que es más fuerte que comparar dos cadenas.
/** La clave de la marca dentro de la línea. La MISMA que usa `quoteApartados.js` en el front. */
const MARCA_APARTADO = 'apartado';

/** Línea de presupuesto tal y como viaja en `Quote.lines` (Json): admite claves extra. */
export type LineaPresupuesto = {
  concept?: unknown;
  qty?: unknown;
  price?: unknown;
  tax?: unknown;
  [clave: string]: unknown;
};

/**
 * ¿Es una cabecera de apartado? **Solo el booleano `true` cuenta.**
 *
 * Un `'sí'`, un `1` o un `'true'` no se interpretan: la casilla escribe booleanos y adivinar aquí
 * sería inventar el criterio en un segundo sitio. Mismo trato que `esSuplido` (SCRUM-500).
 */
function esApartado(linea: unknown): boolean {
  if (linea === null || typeof linea !== 'object') return false;
  return (linea as Record<string, unknown>)[MARCA_APARTADO] === true;
}

/**
 * Las líneas que SÍ entran en cualquier suma: todas menos las cabeceras.
 *
 * Es la única puerta por la que un total puede mirar las líneas de un presupuesto con apartados.
 */
export function lineasQueSuman<T extends LineaPresupuesto>(lineas: readonly T[] | null | undefined): T[] {
  return (Array.isArray(lineas) ? lineas : []).filter((l) => !esApartado(l));
}

// ── 🔴 Y LA NUMERACIÓN **NO** ESTÁ AQUÍ, A PROPÓSITO ──────────────────────────────────────
//
// Vive en `public/dashboard/js/quoteApartados.js`, y en un solo sitio. Hoy su ÚNICO consumidor es
// la pantalla: el PDF ya está resuelto por otro camino (SCRUM-603) y no se toca, y el presupuesto
// viaja por WhatsApp como ENLACE —`concept` no aparece ni una vez en `whatsapp.ts`—, así que no
// hay un tercer canal que servir.
//
// Escribirla también aquí daría DOS implementaciones de la misma numeración para que una de las
// dos no la llamara nadie: un módulo de dominio inalcanzable (el trinquete de SCRUM-411) y, peor,
// dos copias que divergen. Lo único que comparten front y dominio es la MARCA, y hay un test que
// falla si las dos cadenas dejan de ser la misma.

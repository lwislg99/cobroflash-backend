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

// ── SCRUM-1807 (tramo c) · LOS CAPÍTULOS: EL RECORRIDO CABECERA → SUBPARTIDAS, EN UN SITIO ──
//
// Antes lo hacían por su cuenta el PDF del presupuesto (`generateQuotePdf`, SCRUM-1786f1) y el
// portal del cliente (`filasConTotalDelApartado`, SCRUM-1786g): el portal lo COPIÓ del PDF porque
// allí vivía dentro de una función y no se podía importar (deuda declarada en SCRUM-1786 c.22329).
// Ahora los dos lo leen de aquí.
//
// Lo que se comparte es SÓLO el recorrido. La cifra del total la pone cada consumidor, porque
// cada uno suma lo que pinta encima y no es lo mismo (c.22389: no se igualan): el PDF, la columna
// IMPORTE sin IVA; el portal, las líneas con IVA.
//
// EL CRITERIO, el que ya tenían los dos: una cabecera abre un capítulo y sus líneas son las que la
// siguen hasta la próxima cabecera. Las líneas de ANTES de la primera cabecera no son de ningún
// apartado: forman un capítulo con `cabecera: null`, que no lleva total. Una cabecera seguida de
// otra es un capítulo con `lineas: []`. Sin cabeceras sale un único capítulo sin cabecera con
// todas las líneas, y sin líneas, ninguno. Las líneas son las MISMAS referencias que entraron.

/** Un capítulo: una cabecera de apartado (o `null`, para lo que va antes de la primera) y sus líneas. */
export type Capitulo<T> = { cabecera: T | null; lineas: T[] };

/** Las líneas de un presupuesto agrupadas en capítulos, en el orden en que vienen. */
export function capitulos<T>(lineas: readonly T[] | null | undefined): Capitulo<T>[] {
  const salida: Capitulo<T>[] = [];
  let abierto: Capitulo<T> | null = null;
  for (const l of Array.isArray(lineas) ? lineas : []) {
    if (esApartado(l)) {
      abierto = { cabecera: l, lineas: [] };
      salida.push(abierto);
    } else if (abierto) {
      abierto.lineas.push(l);
    } else {
      abierto = { cabecera: null, lineas: [l] };
      salida.push(abierto);
    }
  }
  return salida;
}

// ── SCRUM-1807 (tramo d) · ¿ESTE APARTADO SE ENSEÑA AGRUPADO? ─────────────────────────────────
//
// La elección vive en la CABECERA (`agrupado: true`, SCRUM-1786 P3 ✅) y la deja pasar
// `QuoteLineSchema`. Sin la clave, desglosado: así se leen todas las cabeceras guardadas antes de
// que existiera, y no se rellena nada hacia atrás (SCRUM-1786.md §3.5).

/** La clave de la elección dentro de la cabecera. La MISMA que deja pasar `QuoteLineSchema`. */
const MARCA_AGRUPADO = 'agrupado';

/**
 * ¿Va agrupado el capítulo que abre esta cabecera? **Sólo el booleano `true`, y sólo en una
 * cabecera.** En una línea normal la clave no significa nada, y `null` —lo que va antes de la
 * primera cabecera— no es un apartado. Mismo trato que `esApartado`: no se adivina.
 */
export function esAgrupado(cabecera: unknown): boolean {
  if (!esApartado(cabecera)) return false;
  return (cabecera as Record<string, unknown>)[MARCA_AGRUPADO] === true;
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

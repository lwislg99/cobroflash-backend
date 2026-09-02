// src/modules/quotes/domain/clausulas.ts — SCRUM-656 (T7, sprint Tecnosel)
//
// LAS CLÁUSULAS DE CIERRE DE UN PRESUPUESTO: DEL MERCHANT, NO DEL PRESUPUESTO.
//
// ── QUÉ SON ──────────────────────────────────────────────────────────────────────────────
// Sus presupuestos cierran con tres bloques idénticos en todos: GARANTÍA (dos años, con sus
// exclusiones), ALCANCE y PLAZO DE VALIDEZ. La de ALCANCE es la que más vale de las tres:
//
//     «no incluye los trabajos de albañilería, carpintería, pintura y en general, cualquier
//      concepto o elemento no especificado en la oferta»
//
// Es la frase que evita la discusión, y se aprende después de que te pidan pintar gratis una
// pared que picaste tú.
//
// ── POR QUÉ SON DEL MERCHANT Y SE ESCRIBEN UNA VEZ ────────────────────────────────────────
// Escribirlas en cada presupuesto es como se pierden: el día que alguien tiene prisa no las
// pone, y ése es justo el presupuesto que acaba en discusión. Se guardan en Configuración y
// salen en todos.
//
// ⛔ EL TEXTO LO ESCRIBE EL MERCHANT, NO NOSOTROS. Aquí se construye la CAJA. Copiar las de un
// cliente a otro sería ponerle una garantía que no ha dado — y una garantía es una obligación
// jurídica, no un adorno del pie del documento (regla 30).

/** Una cláusula del merchant. `id` es lo que permite quitarla de UN presupuesto sin borrarla. */
export interface Clausula {
  id: string;
  titulo: string;
  texto: string;
}

/**
 * ¿Es una cláusula pintable? Necesita **título y texto**.
 *
 * 🔴 AUSENTE Y VACÍA NO SON LO MISMO, y es el suelo de este módulo. Una cláusula con el título
 * puesto y el texto en blanco pintaría un **título huérfano** —«GARANTÍA» y debajo nada—, que en
 * un documento que el cliente firma se lee como que la garantía existe y no dice cuál. Y una con
 * texto y sin título saldría como un párrafo suelto sin encabezar. Las dos se descartan.
 */
export function esClausulaPintable(c: unknown): c is Clausula {
  if (c === null || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  return typeof x.titulo === 'string' && x.titulo.trim() !== ''
    && typeof x.texto === 'string' && x.texto.trim() !== '';
}

/**
 * Las cláusulas que van EN ESTE documento: las del merchant, menos las excluidas en este
 * presupuesto concreto.
 *
 * ⚠️ EXCLUIR NO ES BORRAR. Quitar la de garantía de un presupuesto no puede tocar la
 * configuración del merchant: el siguiente presupuesto tiene que volver a llevarla. Por eso la
 * exclusión viaja en el presupuesto —una lista de `id`— y esta función solo FILTRA.
 *
 * Con la configuración VACÍA devuelve `[]`, y quien pinte no debe abrir ninguna sección: un
 * bloque «CONDICIONES» sin cláusulas dentro es peor que no ponerlo.
 */
export function clausulasParaDocumento(
  delMerchant: readonly unknown[] | null | undefined,
  excluidas: readonly unknown[] | null | undefined,
): Clausula[] {
  const fuera = new Set(
    (Array.isArray(excluidas) ? excluidas : []).map((x) => String(x)),
  );
  return (Array.isArray(delMerchant) ? delMerchant : [])
    .filter(esClausulaPintable)
    .filter((c) => !fuera.has(String(c.id)))
    .map((c) => ({ id: String(c.id), titulo: c.titulo.trim(), texto: c.texto.trim() }));
}

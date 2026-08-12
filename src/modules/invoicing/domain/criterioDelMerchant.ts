// src/modules/invoicing/domain/criterioDelMerchant.ts — SCRUM-294 (fase C)
//
// EL ÚLTIMO CABLE: llevar el criterio de caja DEL MERCHANT hasta el libro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE YA ESTABA HECHO, Y POR QUÉ ESTE FICHERO ES TAN CORTO
//
// La fase B dejó el enganche: `libroRegistro.repo.ts` acepta `criterioCaja` dentro del rango y,
// **si la clave viene**, manda `campoDeDevengo()`. Si no viene, el libro se comporta como siempre —
// por fecha de emisión—. Aquí no se decide nada de devengo: eso es fase B, cerrada. Aquí solo se
// decide **si se le pasa la pregunta o no**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 TRES ESTADOS NATIVOS, Y NO SE COLAPSAN
//
// La columna es `boolean NULL` **sin default**, así que hay tres cosas distintas:
//
//   · `true`  → el negocio DECLARA que está acogido al RECC → el libro devenga por cobro.
//   · `false` → el negocio DECLARA que no → el libro devenga por emisión.
//   · `NULL`  → **nadie lo ha preguntado todavía.** No es «declara que no».
//
// `false` y `NULL` acaban hoy en la misma fecha —no hay otra posible sin una declaración—, pero
// **no recorren el mismo camino**: `false` pasa por `campoDeDevengo()`, o sea que se EVALÚA una
// declaración; `NULL` **no pasa la clave**, así que no se evalúa nada. La diferencia es observable
// —los dos producen cargas distintas— y hay un test que lo fija. El día que el devengo cambie para
// `false`, `NULL` no lo seguirá, que es exactamente lo que significa «no consta».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL SUELO: UNA LECTURA QUE FALLA NO SE DEGRADA A «SIN CRITERIO DE CAJA»
//
// «Sin criterio de caja» es el caso de la mayoría de los merchants, y por eso es el peor sitio
// posible para degradar: si un fallo de lectura se convirtiera en «no tiene RECC», el merchant
// acogido declararía por emisión —liquidando IVA que aún no ha cobrado— y **el resultado se
// parecería al de todos los demás**, así que nadie lo notaría nunca.
//
// Por eso «no pude leer el merchant» LANZA, y se distingue de «leí el merchant y no consta». Son
// dos cosas distintas y solo una de ellas es normal.

/** Lo que hace falta del merchant. Nada más: este módulo no conoce el resto de la fila. */
export interface MerchantParaCriterio {
  criterioCaja?: boolean | null;
}

/**
 * Lo que se le añade al rango del libro.
 *
 * Objeto **VACÍO** = no se pregunta, y el libro hace lo de siempre (fecha de emisión).
 * Con `criterioCaja` = se pregunta, y manda la declaración del negocio.
 *
 * @throws si el merchant no se pudo leer. NO devuelve `{}`: ver el suelo, arriba.
 */
export function criterioParaElLibro(
  merchant: MerchantParaCriterio | null | undefined,
): { criterioCaja?: boolean } {
  if (merchant === null || merchant === undefined) {
    throw new Error(
      'no se ha podido leer el merchant para decidir el criterio de caja. NO se continúa como si ' +
      'no lo tuviera: «sin criterio de caja» es el caso de la mayoría, así que degradar a él ' +
      'escondería el fallo para siempre — el merchant acogido al RECC declararía como todos los ' +
      'demás y nadie lo notaría.',
    );
  }

  const declarado = merchant.criterioCaja;

  // NO CONSTA. La clave no viaja: al libro no se le da una declaración que nadie ha hecho.
  if (declarado === null || declarado === undefined) return {};

  // Y un valor que no es booleano tampoco se interpreta: se deja pasar TAL CUAL para que
  // `campoDeDevengo()` —que ya sabe rechazarlo— lance. Traducirlo aquí sería decidir dos veces.
  return { criterioCaja: declarado };
}

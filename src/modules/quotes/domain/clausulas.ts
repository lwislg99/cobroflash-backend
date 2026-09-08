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

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA ESCRITURA (SCRUM-656 fase B) — lo que la pantalla de Configuración manda a guardar
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tope de cláusulas. No es una limitación de producto: es que un pie de página tiene fondo.
 *
 * ⚠️ NO SE EXPORTA (SCRUM-411): su único consumidor es `normalizarClausulasParaGuardar`, aquí
 * dentro. Exportarlo «para el test» añade superficie pública que nadie usa y el censo de huérfanos
 * lo contaría como entregado. Se prueba por la SUPERFICIE: se le pasan más cláusulas de las que
 * caben y se cuenta lo que sale.
 */
const MAX_CLAUSULAS = 10;

/**
 * 🔴 EL `id` ES LO ÚNICO QUE NO PUEDE CAMBIAR, y por eso se conserva y no se recalcula.
 *
 * La exclusión de un presupuesto es una lista de `id` guardada en `quotes.clausulas_excluidas`.
 * Si al reeditar la configuración los `id` se reasignaran —por posición, por hash del texto—, los
 * presupuestos que excluían la 2ª pasarían a excluir OTRA cláusula, o ninguna. Y no se rompería
 * nada visible: saldría un PDF con una cláusula que el profesional había quitado a propósito.
 *
 * Por eso: si la entrada trae un `id` no vacío, **se respeta tal cual**. Solo se inventa uno para
 * las cláusulas nuevas, y se inventa único.
 */
function idEstable(bruto: unknown, yaUsados: Set<string>): string {
  const dado = typeof bruto === 'string' ? bruto.trim() : '';
  if (dado !== '' && !yaUsados.has(dado)) return dado;
  // Nueva (o con el id repetido, que es lo mismo de peligroso): uno que no choque con ninguno.
  let n = yaUsados.size + 1;
  while (yaUsados.has(`c${n}`)) n += 1;
  return `c${n}`;
}

/**
 * Lo que la pantalla manda → lo que se guarda en `merchants.clausulas_presupuesto`.
 *
 * ⚠️ Se descarta lo que no es pintable **al guardar y no solo al pintar**. Guardar una cláusula
 * con el texto vacío deja en Configuración una fila que el profesional ve y que en el PDF no sale
 * nunca: el producto le estaría mintiendo en su propia pantalla de ajustes.
 *
 * ⛔ NO se traduce, no se corrige y no se rellena: el texto lo escribe el merchant (regla 30). Una
 * garantía es una obligación jurídica, no un adorno del pie del documento.
 */
export function normalizarClausulasParaGuardar(entrada: unknown): Clausula[] {
  const filas = Array.isArray(entrada) ? entrada : [];
  const usados = new Set<string>();
  const salida: Clausula[] = [];

  for (const bruto of filas) {
    if (salida.length >= MAX_CLAUSULAS) break;
    if (bruto === null || typeof bruto !== 'object') continue;
    const x = bruto as Record<string, unknown>;
    const titulo = typeof x.titulo === 'string' ? x.titulo.trim() : '';
    const texto = typeof x.texto === 'string' ? x.texto.trim() : '';
    if (titulo === '' || texto === '') continue;   // el mismo criterio que `esClausulaPintable`
    const id = idEstable(x.id, usados);
    usados.add(id);
    salida.push({ id, titulo, texto });
  }
  return salida;
}

/**
 * 🔴 EL SUELO DE LA LECTURA: distinguir «no ha configurado ninguna» de «no supe leerlas».
 *
 * En pantalla las dos son una lista vacía y significan lo contrario: la primera es un merchant que
 * todavía no ha escrito sus condiciones —correcto, y el PDF no abre ninguna sección—; la segunda es
 * una columna con JSON roto, y ahí el PDF está saliendo SIN las condiciones que el profesional cree
 * que lleva. Nadie se entera hasta que un cliente discute la garantía.
 *
 * `null`/ausente → `{ ok: true, clausulas: [] }` (no ha configurado ninguna).
 * Cualquier otra cosa que no sea un array → `{ ok: false }`, y quien pinte tiene que DECIRLO.
 */
export function leerClausulasDelMerchant(bruto: unknown):
  | { ok: true; clausulas: Clausula[] }
  | { ok: false; motivo: 'ilegible' } {
  if (bruto === null || bruto === undefined) return { ok: true, clausulas: [] };
  if (!Array.isArray(bruto)) return { ok: false, motivo: 'ilegible' };
  return { ok: true, clausulas: (bruto as unknown[]).filter(esClausulaPintable).map((c) => ({
    id: String(c.id), titulo: c.titulo.trim(), texto: c.texto.trim(),
  })) };
}

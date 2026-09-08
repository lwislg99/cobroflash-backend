// src/modules/invoicing/infra/pdf/conceptoLinea.ts — SCRUM-603 (DOC-13)
//
// EL CONCEPTO DE UNA LÍNEA Y SU DESCRIPCIÓN, SEPARADOS. Una sola vez.
//
// ── POR QUÉ EXISTE ESTE FICHERO ──────────────────────────────────────────────
// La descripción de una línea NO viaja en un campo propio: viaja **dentro del concepto**,
// detrás de un salto de línea. Lo decide el editor de presupuestos cuando el profesional marca
// «Incluir descripción en el PDF» (`quotesView.js`):
//
//     conceptForPdf = `${conceptForPdf}\n${desc}`;
//
// El PDF de PRESUPUESTO ya sabía partirlo y pintar la descripción más pequeña. El de FACTURA
// no: imprimía el concepto entero de una vez, así que la descripción salía —el salto de línea
// se respeta— pero **con el mismo tamaño y el mismo peso que el concepto**, indistinguible.
//
// 🔴 Y LA REGLA QUE OBLIGA A EXTRAERLO (SCRUM-604): había UNA copia de esta partición, en el
// bloque del presupuesto. Escribirla otra vez en el de la factura habría hecho DOS, y dos copias
// que hay que sincronizar a mano divergen — es la familia de 617/620/625/627. Así que se saca
// aquí y la usan los dos. **Copias antes: 1. Copias después: 0.**
//
// El ALBARÁN no la usa todavía, y no por olvido: su línea es `{concepto, cantidad, unidad}` y
// **no tiene descripción que partir** (`albaran.service.ts`). El día que la tenga, la función ya
// está y no habrá que escribirla por tercera vez.

/** El concepto de una línea, separado de su descripción. */
export interface ConceptoLinea {
  /** La primera línea: lo que va grande. Nunca `null` — si no hay nada, cadena vacía. */
  titulo: string;
  /** El resto, tal cual, conservando sus saltos. Cadena vacía si no hay descripción. */
  descripcion: string;
}

/**
 * Parte un concepto en título y descripción por el PRIMER salto de línea.
 *
 * Reglas, y cada una está probada:
 *   · sin salto de línea → todo es título y la descripción es `''`. Es el caso de la inmensa
 *     mayoría de las líneas, y tiene que salir EXACTAMENTE como salía antes.
 *   · varias líneas → la primera es el título y **todo el resto es la descripción**, con sus
 *     saltos dentro. No se recorta a la segunda línea: la descripción de un producto puede tener
 *     dos párrafos y perder el segundo sería perder texto del documento.
 *   · líneas en blanco intermedias → se descartan las VACÍAS, no las que tienen contenido. Un
 *     `\n\n` de más no debe abrir un hueco en un documento que el cliente recibe.
 *   · `null`, `undefined` o un no-texto → título vacío, descripción vacía. Nunca `undefined`
 *     circulando hacia el pintado.
 */
export function partirConceptoYDescripcion(texto: unknown): ConceptoLinea {
  const bruto = typeof texto === 'string' ? texto : '';
  const partes = bruto.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    titulo: partes[0] ?? '',
    descripcion: partes.slice(1).join('\n'),
  };
}

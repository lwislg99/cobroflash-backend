// src/core/documentos/sinMarcadorPendiente.ts — SCRUM-903
//
// UN MARCADOR DE MICROCOPY SIN ESCRIBIR NO LLEGA AL PAPEL. FALLA ANTES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, Y POR QUÉ FALLAR ES LO BLANDO
//
// 🔒 Una pantalla mal rotulada se arregla y se recarga. Un PDF mal rotulado ya está en el móvil
// de un cliente, y ahí no llega ningún despliegue. Es la regla 29 por el otro lado: lo emitido no
// se reescribe — con la diferencia de que esto no sería una decisión, sería un accidente.
//
// Medido en SCRUM-903, DOS caminos imprimen hoy un marcador en un documento:
//   · `pdf.service.ts` · `generateInvoicePdf` → el rótulo de la cabecera del desglose de IVA,
//     sólo en facturas con MÁS DE UN tipo impositivo.
//   · `albaranPdf.service.ts` → «en calidad de» del firmante, cuando el id guardado no es
//     ninguno de los seis válidos. **Este segundo no estaba en el ticket como camino impreso**:
//     venía clasificado como respuesta de API, y `etiquetaCalidad` acaba en el papel.
//
// Y el PDF del albarán se GUARDA en disco (`ensureAlbaranPdf` sólo regenera con `force`), así que
// lo que se imprima una vez se queda impreso.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTO **NO** HACE, Y ES DELIBERADO
//
// ⛔ No escribe el texto que falta. Ese texto es del fundador (regla 30 / A7), se propone y se
//    para. **Un marcador sustituido por una frase plausible es peor que el marcador**: el
//    marcador se ve, y una frase razonable puesta por una sesión parece aprobada.
// ⛔ No toca ningún documento ya emitido (regla 29).
//
// Lo único que hace es cambiar QUIÉN se entera: hoy se entera el cliente que recibe el papel,
// y a partir de aquí se entera quien genera el documento. Un fallo lo ve un desarrollador.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Las formas del marcador que hay en el árbol, **por VALOR y no por nombre**.
 *
 * 🔴 Y ÉSA ES LA LECCIÓN DE SU CENSO: el mismo marcador vive bajo CINCO nombres distintos
 * (`MARCADOR_MICROCOPY_DESGLOSE`, `PENDIENTE`, `MICROCOPY_PENDIENTE_290`,
 * `MICROCOPY_PENDIENTE_308`, `MARCA_PENDIENTE`). Un censo calibrado a un nombre se deja fuera los
 * otros cuatro — y en SCRUM-903 el nombre que se quedaba fuera era justo el del PDF.
 * Se mira el TEXTO que se va a imprimir, que es lo único que el cliente llega a ver.
 */
export const RE_MARCADOR_PENDIENTE = /\[PENDIENTE[^\]]*\]/;

/** ¿Este texto lleva dentro un marcador sin escribir? */
export function llevaMarcadorPendiente(valor: unknown): boolean {
  return typeof valor === 'string' && RE_MARCADOR_PENDIENTE.test(valor);
}

/**
 * El filtro de todo texto que va a un documento. Devuelve el texto tal cual, y **lanza** si lleva
 * un marcador sin escribir.
 *
 * `donde` no es decoración: el fallo lo va a leer alguien que no estaba aquí cuando se escribió, y
 * «microcopy_sin_firmar» a secas obliga a buscar por todo el árbol cuál de los sitios fue.
 *
 * ⚠️ NO se traga `null` ni `undefined` convirtiéndolos en texto: quien pinta decide si un hueco se
 * imprime vacío o no se imprime, y eso es suyo. Aquí sólo pasan de largo.
 */
export function textoParaDocumento<T>(valor: T, donde: string): T {
  if (llevaMarcadorPendiente(valor)) {
    throw new Error(
      `microcopy_sin_firmar: ${donde} iba a imprimir un marcador de microcopy pendiente `
      + `(${String(valor)}). El documento NO se genera: un marcador impreso ya no se puede `
      + `recuperar del móvil del cliente. Escribe el texto (lo firma el fundador, regla 30) o `
      + `decide que ese rótulo no se pinta.`,
    );
  }
  return valor;
}

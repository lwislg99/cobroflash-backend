// src/modules/jobs/domain/albaranSerie.ts — SCRUM-306 (C7) · la serie de ALBARANES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// NO HAY UN SEGUNDO MECANISMO, Y ESO ES LA TAREA
//
// Este módulo **importa** `huecosDeLaSerie` (A4/SCRUM-291) y `formatAlbaranNumber` /
// `resolveAlbaranSeq` (la numeración que ya existe). No copia ninguno de los tres, no cambia sus
// firmas y no mueve código suyo.
//
// Escribir un detector propio sería el defecto de SCRUM-240 —«no eran dos constructores, era uno
// escrito dos veces»— y duplicaría además la decisión que sostiene A4: **componer en vez de
// parsear**. Dos copias de esa idea envejecen por separado, y la que envejece no avisa: tranquiliza.
//
// ⚠️ NO SE UNIFICAN LOS GENERADORES, y no por comodidad. `allocateInvoiceNumber` exige `camino` y
// `actor` y arrastra `getEmissionMode`/VeriFactu; `allocateAlbaranNumber` existe precisamente para
// NO pasar por ahí (Parte L: serie no fiscal e independiente). Unificarlos metería el albarán
// dentro del camino de emisión, que es justo lo que la regla 38 protege. Lo que sí comparten —el
// `pg_advisory_xact_lock` y su `SERIE_LOCK_NS`— ya estaba compartido antes de este ticket.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ALBARÁN AVISA, NO BLOQUEA
//
// Un albarán **no es un documento fiscal**: la AEAT no le exige secuencialidad sin saltos como a la
// factura. Copiar aquí el rigor de A4 sería convertir una recomendación en una prohibición, y eso
// estorba sin proteger de nada. Por eso este módulo devuelve un DIAGNÓSTICO y nadie lo usa para
// impedir una creación.
import { huecosDeLaSerie, type HuecosDeSerie } from '../../invoicing/domain/huecosSerie';
import { formatAlbaranNumber, resolveAlbaranSeq } from './albaranNumber.service';

/**
 * Compone un número de albarán con la firma que espera `huecosDeLaSerie`.
 *
 * La serie de albaranes no tiene prefijo configurable (ver la entrada de SCRUM-306: exigiría una
 * columna nueva y las migraciones están congeladas) ni serie de rectificativas, así que los dos
 * parámetros se ignoran a propósito — y se ignoran AQUÍ, en un solo sitio, en vez de deformar la
 * firma común.
 */
export function componerNumeroAlbaran(
  _prefijo: string | null | undefined,
  año: number,
  seq: number,
  _rectificativas: boolean,
): string {
  return formatAlbaranNumber(año, seq);
}

/**
 * Los huecos de la serie de albaranes de un año. PURO: no consulta la base.
 *
 * Es el MISMO barrido de A4, con la composición del albarán. Un hueco aquí es **información**, no
 * un error: quien lo pinte lo enseña y no impide nada.
 */
export function huecosDeAlbaranes(numeros: readonly string[], año: number): HuecosDeSerie {
  return huecosDeLaSerie(numeros, null, año, false, componerNumeroAlbaran);
}

/**
 * El número que saldría AHORA, para enseñarlo antes de crear nada.
 *
 * Usa `resolveAlbaranSeq` y `formatAlbaranNumber` —las MISMAS que usa `allocateAlbaranNumber`—, así
 * que la vista previa no puede enseñar un número distinto del que se va a emitir. Calcularlo aparte
 * es como se acaba enseñando una cosa y emitiendo otra.
 *
 * ⚠️ PROPAGA `AlbaranSerieSinAnioError`. Si el contador se movió sin fijar el año, la vista previa
 * **falla en vez de enseñar `ALB-2026-001`**: enseñar ese número sería confirmarle al profesional
 * el reinicio silencioso justo antes de que ocurra.
 */
export function vistaPreviaAlbaran(
  m: { albaranSeriesYear: number | null; nextAlbaranNumber: number },
  año: number,
): string {
  return formatAlbaranNumber(año, resolveAlbaranSeq(m, año));
}

// src/modules/invoicing/domain/huecosSerie.ts — SCRUM-291 (A4) · los HUECOS de la serie.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ HACE Y POR QUÉ EXISTE
//
// El competidor pone dos avisos en gris sobre la numeración. Un aviso que no comprueba nada
// solo reparte la culpa: si luego falta un número, ya te lo habían dicho. Esto COMPRUEBA — dice
// qué números faltan, con su nombre.
//
// ⚠️ NO TOCA EL CAMINO DE EMISIÓN (regla 38). Este módulo **importa** `formatInvoiceNumber` y no
// modifica nada de `invoiceNumber.service.ts`: ni una firma, ni un export nuevo, ni código
// movido. `allocateInvoiceNumber` y su `pg_advisory_xact_lock` quedan intactos — son lo único
// que hoy impide que un hueco real llegue a existir, y aquí solo se MIRA lo ya emitido.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO SE PARSEA EL NÚMERO — y es la decisión que sostiene todo
//
// Lo natural sería una expresión regular que extraiga el `seq` de `2026-CF-001`. Se descarta: esa
// expresión sería **una copia del formato**, y una copia se queda vieja. El día que la serie
// admita otros dígitos o otro formato (el bloque que aún espera GO), el detector seguiría
// leyendo bien y diría «no hay huecos» sobre una serie que ya no entiende. Un censo que se queda
// viejo no avisa: tranquiliza.
//
// Así que se hace al revés: se **COMPONEN** los números esperados con `formatInvoiceNumber`, la
// MISMA función que los compuso al emitirlos, y se pregunta cuáles no están. Si mañana cambia el
// formato, cambia en un sitio y esto lo sigue solo.
//
// EFECTO SECUNDARIO QUE RESULTÓ SER UN HALLAZGO: como se compone con el prefijo ACTUAL, un
// número emitido con un prefijo ANTERIOR no casa con nada — y sale reportado aparte, como
// `ajenos`. Eso es exactamente el daño que SCRUM-291 (④) impide hacia adelante: si un merchant
// ya cambió el prefijo con facturas emitidas, aquí se ve.
import { formatInvoiceNumber } from './invoiceNumber.service';

/**
 * Tope de seguridad del barrido. No es una preferencia: sin él, un número emitido con otro
 * prefijo haría que el bucle no terminara nunca buscando una coincidencia imposible.
 * 10.000 facturas en un año de un merchant de oficios es varios órdenes por encima de lo real.
 */
export const MAX_SEQ_BARRIDO = 10_000;

export interface HuecosDeSerie {
  /** Cuántos números de esta serie hay emitidos. */
  emitidos: number;
  /** El `seq` más alto que se ha podido casar. 0 si no se casó ninguno. */
  ultimoSeq: number;
  /** Los números que FALTAN entre el 1 y el último emitido. Vacío = serie correlativa. */
  huecos: string[];
  /**
   * Emitidos que NO casan con ningún número componible con el prefijo actual. Señal de que la
   * serie se emitió con OTRO prefijo — el daño que ④ impide hacia adelante.
   */
  ajenos: string[];
  /** `true` si el barrido se cortó por el tope. El resultado es entonces PARCIAL y se dice. */
  truncado: boolean;
}

/**
 * Los huecos de UNA serie (la ordinaria o la de rectificativas) de un año.
 *
 * @param numeros  Los números YA EMITIDOS que se van a examinar. Puro: no consulta la base.
 * @param prefijo  El prefijo con el que se componen los esperados.
 * @param año      El año de la serie.
 * @param rectificativas  `false` = serie ordinaria (F1); `true` = la de rectificativas (R1),
 *                        que lleva contador propio (`nextRectInvoiceNumber`) y por eso se mira
 *                        aparte: mezclarlas inventaría huecos que no existen.
 * @param componer  SCRUM-306 (C7) · CÓMO se compone un número esperado. Por defecto,
 *                  `formatInvoiceNumber` — el comportamiento de siempre, byte a byte.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * SCRUM-306 · POR QUÉ UN PARÁMETRO Y NO UN SEGUNDO DETECTOR
 *
 * Los albaranes necesitan lo mismo: saber qué números faltan. Escribir un detector propio sería
 * el defecto de SCRUM-240 —«no eran dos constructores, era uno escrito dos veces»— y además
 * duplicaría la decisión que sostiene este módulo: **componer en vez de parsear**. Dos copias de
 * esa idea envejecen por separado, y la que envejece no avisa: tranquiliza.
 *
 * La extensión es ADITIVA: el parámetro es opcional y su valor por defecto es exactamente lo que
 * hacía antes, así que las llamadas de factura no cambian ni una letra. Hay control positivo con
 * facturas en el guard: si al generalizar se rompiera el caso viejo, cae ahí.
 */
export function huecosDeLaSerie(
  numeros: readonly string[],
  prefijo: string | null | undefined,
  año: number,
  rectificativas = false,
  componer: (
    prefijo: string | null | undefined,
    año: number,
    seq: number,
    rectificativas: boolean,
  ) => string = formatInvoiceNumber,
): HuecosDeSerie {
  const emitidos = new Set(numeros);
  const casados = new Set<string>();
  const faltan: { seq: number; numero: string }[] = [];
  let ultimoSeq = 0;
  let truncado = false;

  // Se compone hacia arriba hasta haber casado TODOS los emitidos. El corte no es «hasta N» —no
  // se sabe cuál es N sin parsear— sino «hasta que no quede ninguno por casar».
  for (let seq = 1; seq <= MAX_SEQ_BARRIDO; seq += 1) {
    if (casados.size === emitidos.size) break;
    const esperado = componer(prefijo, año, seq, rectificativas);
    if (emitidos.has(esperado)) {
      casados.add(esperado);
      ultimoSeq = seq;
    } else {
      faltan.push({ seq, numero: esperado });
    }
    if (seq === MAX_SEQ_BARRIDO) truncado = true;
  }

  // Solo es HUECO lo que falta POR DEBAJO del último emitido. Lo de más arriba no falta: es que
  // la serie todavía no ha llegado. Una alarma sobre el futuro sería una alarma inventada — y con
  // el barrido truncado (algún emitido no casó) esto es lo que impide reportar miles de falsos.
  const huecos = faltan.filter((h) => h.seq < ultimoSeq).map((h) => h.numero);

  return {
    emitidos: emitidos.size,
    ultimoSeq,
    huecos,
    ajenos: [...emitidos].filter((n) => !casados.has(n)).sort(),
    truncado,
  };
}

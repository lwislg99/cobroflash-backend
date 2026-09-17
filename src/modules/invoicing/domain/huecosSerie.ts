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
// 🔴 REGLA 38 · SE IMPORTAN DOS COSAS QUE YA ESTABAN EXPORTADAS (`CORTE_FORMATO_F` y su tipo,
// `invoiceNumber.service.ts:216` y `:224`). NO se ha añadido un export, ni cambiado una firma, ni
// movido código del camino de emisión: por eso este arreglo NO es STOP. Si hubiera hecho falta
// exportar algo de allí, se paraba.
import { formatInvoiceNumber, CORTE_FORMATO_F, type CorteDeFormato } from './invoiceNumber.service';

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
    emitidaEn?: Date | null,
  ) => string = formatInvoiceNumber,
  corte: CorteDeFormato = CORTE_FORMATO_F,
): HuecosDeSerie {
  const emitidos = new Set(numeros);
  const casados = new Set<string>();
  const faltan: { seq: number; testigo: Date | null | undefined }[] = [];
  let ultimoSeq = 0;
  let truncado = false;
  /** El lado del corte del último número que SÍ casó, para nombrar los huecos con su formato. */
  let ultimoTestigo: Date | null | undefined;

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 SCRUM-881 · LOS DOS LADOS DEL CORTE, PORQUE AQUÍ NO SE SABE LA FECHA
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  //
  // Este detector recibe NÚMEROS, no facturas: no tiene la fecha de emisión de ninguno. Y desde
  // SCRUM-780 el formato depende de esa fecha (`2026-CF-001` antes del corte, `F260001` desde el
  // corte). Componía sin fecha, o sea SIEMPRE en formato viejo, así que toda factura emitida
  // después del 7-sep-2026 no casaba con nada y salía por `ajenos`.
  //
  // Medido el 17-sep-2026 antes de tocar nada, con `dist/` y una serie de tres:
  //     emitidas F260001, F260002, F260003 → ajenos 3 de 3 · ultimoSeq 0 · truncado true
  // Y el control de que no estaba roto en general: la misma serie ANTES del corte casaba entera.
  //
  // 🔒 LA SOLUCIÓN NO ES PARSEAR. Sigue componiéndose —esa es la decisión que sostiene el módulo—
  // pero se compone para LOS DOS LADOS del corte y se acepta el que esté. Sin fecha no se puede
  // saber a cuál pertenece un `seq`, y eso se declara en vez de adivinarse.
  //
  // ⚠️ SE ACEPTAN LOS DOS, NO «EL NUEVO». Tras el corte la serie F nace de cero (SCRUM-780 §②),
  // así que un mismo año puede tener `2026-FG-004` y `F260001` a la vez. Quedarse con un solo
  // formato por `seq` mandaría el otro a `ajenos`, que es el mismo defecto con el signo cambiado.
  //
  // ⚠️ Y ES ADITIVO PARA QUIEN INYECTA SU `componer`: `componerNumeroAlbaran` recibe cuatro
  // parámetros e ignora el quinto, así que devuelve lo mismo para los dos testigos, el `Set` los
  // funde en uno y el barrido de albaranes queda BYTE A BYTE como estaba.
  const testigos: (Date | null | undefined)[] = corte.desde ? [undefined, corte.desde] : [undefined];

  // Se compone hacia arriba hasta haber casado TODOS los emitidos. El corte no es «hasta N» —no
  // se sabe cuál es N sin parsear— sino «hasta que no quede ninguno por casar».
  for (let seq = 1; seq <= MAX_SEQ_BARRIDO; seq += 1) {
    if (casados.size === emitidos.size) break;
    // ⚠️ La forma `const esperado = componer(…)` se conserva A PROPÓSITO: `scrum291 ①` comprueba
    // ESE TEXTO para asegurar que el bucle usa el compositor recibido y no parsea por su cuenta.
    // Al pasar a dos candidatos la reescribí como un `map` en una línea y ese guard se puso rojo
    // —el invariante seguía intacto, pero él mira la forma—. Se arregla el código, no el guard
    // (regla 41): es más barato conservar la forma que relajar al que vigila.
    const candidatos = testigos.map((t) => {
      const esperado = componer(prefijo, año, seq, rectificativas, t);
      return { numero: esperado, testigo: t };
    });
    const presentes = candidatos.filter((c) => emitidos.has(c.numero));
    if (presentes.length) {
      for (const c of presentes) casados.add(c.numero);
      ultimoSeq = seq;
      ultimoTestigo = presentes[presentes.length - 1].testigo;
    } else {
      // El hueco se NOMBRA con el formato del ÚLTIMO que sí casó: es la serie en la que falta.
      // Antes de casar ninguno se usa el primer testigo, que es el formato de siempre — y da
      // igual, porque un hueco sólo se reporta si está por debajo de un `seq` ya casado.
      faltan.push({ seq, testigo: ultimoTestigo });
    }
    if (seq === MAX_SEQ_BARRIDO) truncado = true;
  }

  // Solo es HUECO lo que falta POR DEBAJO del último emitido. Lo de más arriba no falta: es que
  // la serie todavía no ha llegado. Una alarma sobre el futuro sería una alarma inventada — y con
  // el barrido truncado (algún emitido no casó) esto es lo que impide reportar miles de falsos.
  const huecos = faltan
    .filter((h) => h.seq < ultimoSeq)
    .map((h) => componer(prefijo, año, h.seq, rectificativas, h.testigo));

  return {
    emitidos: emitidos.size,
    ultimoSeq,
    huecos,
    ajenos: [...emitidos].filter((n) => !casados.has(n)).sort(),
    truncado,
  };
}

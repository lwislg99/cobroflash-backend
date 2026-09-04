/**
 * src/core/documentos/formatoNumero.ts — SCRUM-592 (DOC-02)
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * EL NÚMERO QUE VE EL PROFESIONAL: `[LETRA][AA][NNNN]`, serie ANUAL y correlativa.
 *
 *     Presupuesto  P   → P260001      (antes: `#26`, `#28`, `#32`)
 *     Albarán      AB  → AB260001     (antes: `ALB-2026-006`)
 *
 * ── LA VÍCTIMA ──────────────────────────────────────────────────────────────────────────
 *
 * Los presupuestos de un profesional salían `#26`, `#28`, `#32`: con saltos y sin serie. Medido
 * en `yaqu_dev_javier` el 4-sep-2026, el merchant 1 tenía `[1, 13, 14, 15, 16]` — **faltan del 2
 * al 12**. Cuando su cliente le pregunta por «el presupuesto 32», él no puede decir de cuántos
 * es ni de qué año, y una lista así no es defendible ante nadie.
 *
 * ── POR QUÉ UN SITIO ÚNICO Y NO UNA PLANTILLA EN CADA SERVICIO ──────────────────────────
 *
 * Porque son DOS series con la misma forma, y dos plantillas separadas divergen: basta con que
 * una rellene a 4 y la otra a 3 para que el profesional tenga dos formatos en la misma pantalla.
 * Es el mismo criterio que `formatImporteEs` (SCRUM-636), donde ese defecto ya se pagó.
 *
 * 🔴 LA FACTURA NO ENTRA AQUÍ, y no es un olvido. Su formato es `2026-CF-001` con **prefijo por
 * merchant** (`Merchant.invoiceSeriesPrefix`), que es un campo real y configurable: migrarla a
 * `F260001` lo perdería. Y su numeración es CAMINO DE EMISIÓN — leerlo no es STOP, cambiarlo sí.
 * Queda fuera hasta que se resuelva el expediente del justificante, que hoy se define «sin
 * numeración de factura».
 * ═════════════════════════════════════════════════════════════════════════════════════════

/** Las letras de serie que existen. Cerrado a propósito: una serie nueva se DECIDE, no se cuela. */
export const SERIES = {
  presupuesto: 'P',
  albaran: 'AB',
} as const;

export type Serie = typeof SERIES[keyof typeof SERIES];

/** Los dígitos del contador. Cuatro: 9.999 documentos al año por merchant, y desborda legible. */
export const DIGITOS_SECUENCIA = 4;

/**
 * `[LETRA][AA][NNNN]` — p. ej. `P260001`.
 *
 * 🔴 EL AÑO VA A DOS CIFRAS Y LA SECUENCIA A CUATRO, y el orden importa: con el año delante, un
 * listado ordenado como texto queda ordenado como cronología. Con la secuencia delante, no.
 *
 * ⚠️ QUÉ PASA AL DESBORDAR: a partir de 10.000 el número CRECE en vez de truncarse
 * (`P2610000`). Truncar daría dos documentos con el mismo número, que es lo único inaceptable
 * aquí; un número más largo sólo es más feo. Está probado.
 */
export function formatoNumeroDocumento(serie: Serie, year: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new RangeError(`secuencia inválida: ${seq}. La serie empieza en 1, nunca en 0.`);
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    throw new RangeError(`año fuera de rango: ${year}.`);
  }
  const aa = String(year % 100).padStart(2, '0');
  return `${serie}${aa}${String(seq).padStart(DIGITOS_SECUENCIA, '0')}`;
}

/**
 * Lo contrario: de `P260001` a sus partes. `null` si no es un número de este formato.
 *
 * Hace falta para RENUMERAR sin repetir el trabajo —un documento ya convertido se reconoce y se
 * deja en paz— y para que un guard pueda comprobar la serie sin volver a escribir el patrón.
 */
export function parseNumeroDocumento(
  numero: string | null | undefined,
): { serie: Serie; year: number; seq: number } | null {
  if (typeof numero !== 'string') return null;
  // Las letras salen de SERIES, no de una lista escrita otra vez: si nace una serie, esto la
  // reconoce sin tocarse. Las más largas van primero — `AB` antes que `A`— para que una serie
  // futura de una letra no le robe el prefijo a otra de dos.
  const letras = Object.values(SERIES).sort((a, b) => b.length - a.length);
  for (const s of letras) {
    if (!numero.startsWith(s)) continue;
    const resto = numero.slice(s.length);
    if (!new RegExp(`^\\d{2}\\d{${DIGITOS_SECUENCIA},}$`).test(resto)) continue;
    const aa = Number(resto.slice(0, 2));
    const seq = Number(resto.slice(2));
    if (!Number.isInteger(seq) || seq < 1) return null;
    return { serie: s as Serie, year: 2000 + aa, seq };
  }
  return null;
}

/** ¿Este número ya está en el formato nuevo? Es la pregunta que hace la renumeración. */
export function esNumeroNuevo(numero: string | null | undefined): boolean {
  return parseNumeroDocumento(numero) !== null;
}

/**
 * La secuencia que toca emitir, con REINICIO ANUAL.
 *
 * Extraído para poder probar el cambio de año FIJANDO LA FECHA, en vez de esperar a enero de
 * 2027. Es la misma forma que `resolveAlbaranSeq` (SCRUM-14), que ya hacía esto para su serie.
 *
 * 🔴 EL CASO QUE NO PUEDE PASAR EN SILENCIO: un contador avanzado (`> 1`) sin año de serie
 * significa que hubo documentos numerados ANTES de que existiera la serie anual. Devolver 1
 * repetiría números ya usados. Se devuelve el contador tal cual y quien llame decide: al
 * renumerar es lo correcto, porque la renumeración reasigna todo el año de golpe.
 */
export function secuenciaDelAnio(
  estado: { seriesYear: number | null; nextNumber: number },
  year: number,
): number {
  if (estado.seriesYear === year) return estado.nextNumber;
  if (estado.seriesYear == null && estado.nextNumber > 1) return estado.nextNumber;
  return 1;
}

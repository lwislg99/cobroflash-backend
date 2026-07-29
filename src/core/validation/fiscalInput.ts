// SCRUM-217 · VALIDACIÓN FISCAL DE ENTRADA — fail-closed en la puerta, no en el emisor.
//
// Estos cuatro huecos no están incumplidos hoy, pero **no hay ningún bug entre el producto y
// ellos**: basta un dato de entrada normal. Se cierran ahora que `INVOICING_ES_ENABLED` está OFF
// y no hay nada emitido — después, cada uno sería una factura que corregir hacia atrás.
//
// PUROS a propósito (mismo criterio que `invalidPublicBaseUrl`): devuelven el motivo del rechazo
// o `null`, sin tocar `req`, `process.env` ni la BD. Así se prueban con el valor exacto que hoy
// pasa, que es lo que exige el ticket.
//
// ⚠️ NO tocan `verifactu.service.ts`. El emisor ya tiene sus propios guards (SCRUM-149, 173, 177);
// esto es la capa de antes, para que un dato inválido no llegue nunca a construir un registro.

/**
 * 1152 · El sistema no existe antes del 28-10-2024 (entrada en vigor de la Orden de VERI*FACTU).
 * Una factura con fecha anterior es un registro que la AEAT rechaza, así que un export de un
 * ejercicio anterior no puede producir registros válidos: o está vacío, o miente.
 */
export const ANIO_MINIMO_FISCAL = 2024;

/**
 * 1124 · Tipos de IVA admitidos en España, en PUNTOS BÁSICOS (21 % = 2100).
 *
 * En puntos básicos y no en fracciones a propósito: `tax` viaja como fracción (0,21) y comparar
 * flotantes por igualdad es el camino corto a que 0,07 + 0,005 no sea 0,075. Con enteros la
 * comparación es exacta.
 *
 * Incluye los tipos con ventana temporal (2 %, 5 %, 7,5 %) porque una factura puede rectificar
 * una operación de aquel periodo. La ventana la valida la AEAT; aquí solo se cierra la puerta a
 * los tipos que NO EXISTEN, que es el agujero — hoy pasa un 15 %.
 *
 * ⚠️ ESPAÑA. El día que entre LATAM (F3), esto deja de ser una constante y pasa a depender del
 * país del merchant. Está en UN sitio para que ese día sea un cambio, no una cacería.
 */
export const TIPOS_IVA_ES_BP: ReadonlySet<number> = new Set([0, 200, 400, 500, 750, 1000, 2100]);

/**
 * 1130 / 1287 · Caracteres que la AEAT prohíbe en `NumSerieFactura`. El resto debe ser ASCII
 * imprimible (32-126). El prefijo de serie del merchant acaba DENTRO de ese campo, así que su
 * charset es el mismo — y hoy no se valida en absoluto.
 */
const PROHIBIDOS_SERIE = ['"', "'", '<', '>', '='];

/** ¿El año pedido para un export fiscal es un año que este sistema puede representar? */
export function invalidAnioFiscal(valor: unknown, ahora = new Date()): string | null {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(n)) return `no es un año válido: ${String(valor)}`;
  if (n < ANIO_MINIMO_FISCAL) {
    return `${n} es anterior a ${ANIO_MINIMO_FISCAL}: VERI*FACTU entró en vigor el 28-10-2024 `
      + 'y no hay registros válidos antes de esa fecha';
  }
  const maximo = ahora.getFullYear();
  if (n > maximo) return `${n} es un año futuro (el ejercicio en curso es ${maximo})`;
  return null;
}

/** ¿El tipo impositivo (fracción: 0,21 = 21 %) es uno de los que existen en España? */
export function invalidTipoIva(fraccion: unknown): string | null {
  const n = typeof fraccion === 'number' ? fraccion : Number(fraccion);
  if (!Number.isFinite(n)) return `no es un número: ${String(fraccion)}`;
  if (n < 0 || n > 1) return `fuera de rango (0 a 1): ${n}`;
  const bp = Math.round(n * 10000);
  if (!TIPOS_IVA_ES_BP.has(bp)) {
    const admitidos = [...TIPOS_IVA_ES_BP].map((b) => `${b / 100} %`).join(', ');
    return `${bp / 100} % no es un tipo de IVA español. Admitidos: ${admitidos}`;
  }
  return null;
}

/** ¿El prefijo de serie cabe dentro de `NumSerieFactura` sin que la AEAT lo rechace? */
export function invalidPrefijoSerie(valor: unknown): string | null {
  if (typeof valor !== 'string') return `no es texto: ${String(valor)}`;
  const v = valor.trim();
  if (!v) return 'está vacío';
  if (v.length > 10) return `demasiado largo (${v.length} caracteres, máximo 10)`;
  const prohibido = PROHIBIDOS_SERIE.find((c) => v.includes(c));
  if (prohibido) {
    return `contiene ${prohibido}, que la AEAT no admite en el número de factura `
      + `(prohibidos: ${PROHIBIDOS_SERIE.join(' ')})`;
  }
  for (const ch of v) {
    const code = ch.codePointAt(0)!;
    if (code < 32 || code > 126) {
      return `contiene un carácter no admitido (${JSON.stringify(ch)}): solo ASCII imprimible`;
    }
  }
  return null;
}

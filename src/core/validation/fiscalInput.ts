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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-291 (A4) · LA SERIE ES INMUTABLE UNA VEZ EMITIDA SU PRIMERA FACTURA
//
// EL DEFECTO, medido y VIVO: el prefijo de serie es editable desde Configuración
// (`settingsView.js:490` → `PUT /admin/merchant`) y **nada comprobaba si ya había facturas
// emitidas**. `invalidPrefijoSerie` solo mira el charset que admite la AEAT (SCRUM-217), y
// `merchantAdmin.ts` no consultaba `Invoice` ni una vez.
//
// Consecuencia: un merchant con 40 facturas `2026-CF-001…040` cambia el prefijo a `FAC` y la
// siguiente sale `2026-FAC-041`. Mismo año, misma serie, dos prefijos distintos — y la
// correlatividad que la AEAT exige dentro de una serie deja de existir. No se puede deshacer:
// una factura emitida no se edita (regla 29), así que el daño queda dentro del registro.
//
// POR QUÉ SE BLOQUEA Y NO SE AVISA: lo que se impide aquí es IRREVERSIBLE. Un aviso que deja
// pasar reparte la culpa y no evita nada — y esto no es una preferencia del profesional sobre
// su propio negocio, es un requisito de forma del registro fiscal.
//
// ⚠️ ESTO NO TOCA EL CAMINO DE EMISIÓN (regla 38). Vive en la validación de Configuración:
// decide si se admite un CAMBIO DE AJUSTE, no cómo se compone un número. `allocateInvoiceNumber`
// y su `pg_advisory_xact_lock` quedan intactos — son lo único que hoy impide un hueco real.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * De todos los números de factura de un merchant, los que pertenecen a LA SERIE FISCAL del año
 * dado. Puro: recibe los números ya leídos, no toca la base.
 *
 * Se decide por el NÚMERO y no por `createdAt`, porque el número **es** la identidad fiscal del
 * documento (el `id` de la BD no lo es) y es lo que la serie tiene que dejar correlativo.
 *
 * Quedan fuera los JUSTIFICANTES (`J-…`): no van en la serie fiscal ni en VeriFactu, así que
 * contarlos bloquearía el cambio de prefijo a quien todavía no ha emitido ninguna factura.
 */
export function numerosDeLaSerie(numeros: readonly (string | null | undefined)[], año: number): string[] {
  const marca = `${año}-`;
  return numeros
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .filter((n) => !n.startsWith('J-'))
    .filter((n) => n.startsWith(marca));
}

/**
 * ¿Se bloquea este cambio de prefijo? Puro y sin base de datos.
 *
 * Solo bloquea el CAMBIO REAL: reenviar el mismo prefijo (que es lo que hace el formulario de
 * Configuración cada vez que se guarda cualquier otro campo) no es tocar la serie y no puede
 * dejar al profesional sin poder guardar su dirección.
 */
export function bloqueoCambioDeSerie(params: {
  prefijoActual: string | null | undefined;
  prefijoNuevo: string | null | undefined;
  numerosDeLaSerie: readonly string[];
}): { bloqueado: true; emitidas: number; ejemplo: string } | { bloqueado: false } {
  const actual = (params.prefijoActual ?? '').trim();
  const nuevo = (params.prefijoNuevo ?? '').trim();
  if (!nuevo || nuevo === actual) return { bloqueado: false };
  const emitidas = params.numerosDeLaSerie.length;
  if (emitidas === 0) return { bloqueado: false };
  // El ejemplo es el número MÁS ALTO ya emitido: es el que hace ver el salto que se evita.
  const ejemplo = [...params.numerosDeLaSerie].sort()[emitidas - 1];
  return { bloqueado: true, emitidas, ejemplo };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-313 (D2) · «¿POR QUÉ NÚMERO VAS?» — LA CONTINUIDAD DE LA NUMERACIÓN
//
// Un autónomo que ya factura no se cambia de programa porque el nuevo sea más bonito. No se
// cambia porque **romper la serie le da miedo con Hacienda**. Preguntarle por dónde va, y
// continuarlo, es la barrera de cambio hecha polvo.
//
// SE PREGUNTA EN EL ALTA y no en Configuración: quien viene de otro programa no entra en
// Configuración el primer día — entra, hace un presupuesto, y descubre el problema cuando ya ha
// emitido tres facturas mal numeradas. La pregunta se hace cuando la respuesta todavía sirve.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LOS DOS CAMPOS VAN JUNTOS O NO VAN. Ésta es la trampa del ticket, y es fiscal.
//
// `resolveSeriesSeq` (`invoiceNumber.service.ts:80`) decide así:
//
//     return m.invoiceSeriesYear === year ? m.nextInvoiceNumber : 1;
//
// O sea que fijar `nextInvoiceNumber = 42` **sin** fijar `invoiceSeriesYear` al año en curso NO
// continúa la serie: la reinicia en 1, en silencio. El profesional creería ir por la 42 y su
// primera factura saldría `2026-CF-001` — un número que **ya usó en su programa anterior**.
// Duplicar un número emitido es peor que dejar un hueco, y es justo lo que D2 viene a evitar.
//
// Por eso esta función devuelve **el par entero o un rechazo**, nunca medio ajuste.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Tope de lo que se admite como «último número». Por encima es un dedazo, no una serie. */
export const MAX_NUMERO_SERIE = 999_999;

export type ArranqueSerie =
  | { ok: true; nextInvoiceNumber: number; invoiceSeriesYear: number }
  | { ok: false; motivo: 'numero_invalido' | 'numero_fuera_de_rango' | 'choca_con_emitidas'; detalle?: { ultimoEmitido: string } };

/**
 * Con qué número y en qué año arranca la serie de este merchant.
 *
 * @param vieneDeOtroSitio  Lo que contestó a «¿ya has facturado este año?».
 * @param ultimoNumero      El número de su última factura en el programa anterior. Se ignora si
 *                          no viene de otro sitio.
 * @param año               El año en curso.
 * @param numerosDeLaSerie  Lo YA emitido con nosotros. Si hay algo, mandan ellos: no se puede
 *                          declarar un arranque por debajo de lo emitido (eso es el choque).
 */
export function arranqueDeSerie(params: {
  vieneDeOtroSitio: boolean;
  ultimoNumero?: unknown;
  año: number;
  numerosDeLaSerie: readonly string[];
}): ArranqueSerie {
  const { vieneDeOtroSitio, año } = params;
  const emitidas = params.numerosDeLaSerie.length;

  // ── CONTROL NEGATIVO: «No, empiezo ahora» NO hereda nada ────────────────────────────────
  // Arranca en 1 del año en curso, que es lo que ya hace el sistema por defecto. Se devuelve
  // explícito en vez de «no tocar nada» para que el llamador escriba SIEMPRE el par completo:
  // dejar `invoiceSeriesYear` a null y el contador a 1 es un estado que también se resetea, y
  // «no hice nada» no es lo mismo que «arranca en 1 de este año».
  if (!vieneDeOtroSitio) {
    return { ok: true, nextInvoiceNumber: 1, invoiceSeriesYear: año };
  }

  const n = typeof params.ultimoNumero === 'number' ? params.ultimoNumero : Number(params.ultimoNumero);
  if (!Number.isInteger(n) || n < 1) return { ok: false, motivo: 'numero_invalido' };
  if (n >= MAX_NUMERO_SERIE) return { ok: false, motivo: 'numero_fuera_de_rango' };

  // ── EL CHOQUE (A4, SCRUM-291): no se declara por debajo de lo ya emitido ────────────────
  // Si ya hemos emitido, el arranque declarado tiene que quedar POR ENCIMA. Declarar la 42 con
  // la 50 emitida repetiría ocho números que ya existen — y una factura emitida no se edita.
  if (emitidas > 0) {
    const ultimo = [...params.numerosDeLaSerie].sort()[emitidas - 1];
    return { ok: false, motivo: 'choca_con_emitidas', detalle: { ultimoEmitido: ultimo } };
  }

  // Continuar por la SIGUIENTE, no por la que él dio: si su última fue la 41, la nuestra es la 42.
  return { ok: true, nextInvoiceNumber: n + 1, invoiceSeriesYear: año };
}

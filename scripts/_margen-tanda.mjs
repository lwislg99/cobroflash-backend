// scripts/_margen-tanda.mjs — SCRUM-265: el margen de cada hijo de la tanda.
//
// ── EL PROBLEMA ───────────────────────────────────────────────────────────────
// El bloque QA terminó en ~28 min con un límite de 30. Nadie lo sabía: se descubrió de
// casualidad, persiguiendo otra cosa. Un hijo que acaba al 93 % de su límite y sale VERDE es
// indistinguible de uno que acaba al 10 %, porque el recibo solo guardaba
// `{exit, tests, pass, fail}` y la duración se imprimía en consola y se tiraba.
//
// Y subir el límite «a ojo» no arregla eso: deja el margen igual de invisible, solo que más
// ancho. Lo que hacía falta primero era MEDIRLO.
//
// ── CRUDO EN EL RECIBO, DERIVADO EN PANTALLA ──────────────────────────────────
// Se guardan `durMs` y `limiteMs`. El porcentaje se calcula al leer. Guardar solo el % pierde
// información y no se puede recomponer; guardar los dos permite calcular cualquier cosa después.
// Pero la CONSOLA sí imprime el porcentaje: un dato que no se ve por defecto es otra vez el dato
// que nadie mira, que es justo el defecto que este ticket viene a cerrar.
//
// ── POR QUÉ ESTE MÓDULO EXISTE (y no vive dentro del runner) ─────────────────
// `test-staging-gated.mjs` se ejecuta ENTERO al importarlo: es un script, no una librería. Un
// test que lo importara lanzaría una tanda. Sacando aquí las piezas puras se pueden ejercitar en
// `npm test` sin BD, sin turno y sin lanzar nada — que es la única forma de que este código
// tenga red (SCRUM-161: un artefacto que no corre en `npm test` no existe).

/**
 * SCRUM-265 · el margen de UN hijo, en crudo.
 * @param {number} t0Ms      instante en que se lanzó (Date.now())
 * @param {number} limiteMs  límite EFECTIVO de ese hijo (incluye GATED_CHILD_TIMEOUT_MS si lo hay)
 * @param {number} [ahoraMs] inyectable para poder probarlo sin depender del reloj
 */
export function medirMargen(t0Ms, limiteMs, ahoraMs = Date.now()) {
  return { durMs: Math.max(0, ahoraMs - t0Ms), limiteMs };
}

/**
 * Porcentaje del límite consumido. `null` si no se puede calcular (sin margen, o límite ≤ 0):
 * mejor un hueco declarado que un 0 que se lee como «tardó nada».
 */
export function porcentajeDeLimite(margen) {
  if (!margen || typeof margen.durMs !== 'number' || typeof margen.limiteMs !== 'number') return null;
  if (!(margen.limiteMs > 0)) return null;
  return Math.round((margen.durMs / margen.limiteMs) * 100);
}

/** Lo que se añade a la línea de consola de cada hijo. Vacío si no hay margen que enseñar. */
export function textoDeMargen(margen) {
  const pct = porcentajeDeLimite(margen);
  if (pct === null) return '';
  return ` · ${pct}% del límite`;
}

/**
 * ¿El hijo murió por agotar su límite?
 *
 * Vive aquí, y no inline en el runner, para que la rama del timeout se pueda probar con un
 * resultado REAL de `spawnSync` desde un test — que es el caso que motiva el ticket entero y el
 * más fácil de dar por bueno sin verlo.
 *
 * Los tres síntomas, MEDIDOS en Windows (no supuestos): al vencer el límite `spawnSync` mata al
 * hijo con `killSignal` y devuelve `status=null`, `signal='SIGTERM'` y `error.code='ETIMEDOUT'`.
 */
export function esAbortadoPorTiempo(res) {
  if (!res) return false;
  return res.error?.code === 'ETIMEDOUT' || (res.status === null && res.signal != null);
}

/**
 * ── EL CASO DEL HIJO QUE NO ARRANCÓ, DECLARADO ────────────────────────────────
 *
 * `null` significa **no llegó a lanzarse** (la tanda abortó antes de su turno: turno perdido,
 * preflight en rojo…). Un hijo que SÍ se lanzó tiene SIEMPRE su entrada con los dos números,
 * incluso si murió por timeout o crasheó — porque `durMs` se puede medir en cuanto `spawnSync`
 * devuelve, pase lo que pase.
 *
 * O sea que no existe el estado intermedio «arrancó pero no sé cuánto tardó», y por eso NO hace
 * falta un cero que signifique dos cosas: el hueco es `null` y lo medido es un objeto. Se
 * distinguen por su forma, no por su valor.
 */
export const MARGEN_SIN_ARRANCAR = null;

/** Mapa inicial: todos los hijos declarados, ninguno arrancado todavía. */
export function margenesVacios(claves) {
  return Object.fromEntries(claves.map((c) => [c, MARGEN_SIN_ARRANCAR]));
}

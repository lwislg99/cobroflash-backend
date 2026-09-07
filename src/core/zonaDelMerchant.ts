// src/core/zonaDelMerchant.ts — SCRUM-643 (fase ③)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CALENDARIO EN EL QUE VIVE UN MERCHANT — y NADA MÁS
//
// Tres cálculos fiscales preguntan «¿a qué día, o a qué mes natural, pertenece este instante?»:
// la rotura por mes natural del art. 13, el semáforo del plazo del art. 13.2 y el corte
// «hasta el día X». Los tres lo resolvían con `getFullYear()`/`getMonth()`/`setHours()`, o sea
// con el RELOJ DEL PROCESO — y el proceso de Railway va en UTC mientras la península va en
// UTC+1/+2. Medido: un albarán del día 1 a las 00:30 hora española caía en la recapitulativa
// del MES ANTERIOR.
//
// El error no fue elegir la hora local: fue suponer que «local» sería un solo sitio. Dentro de
// `ES` hay DOS husos —península y Canarias—, así que `merchants.country` tampoco sirve.
//
// 🔴 POR QUÉ UN SOLO MÓDULO Y NO TRES ARREGLOS: es la lección de `_navegador.mjs`,
// `nombreParaDocumento.ts` y `conceptoLinea.ts`. Si la decisión no vive en un sitio, el
// siguiente la copia o la inventa — y aquí «la inventa» significa volver a leer el reloj del
// proceso, que es exactamente el defecto que este módulo existe para cerrar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⛔ LO QUE ESTE MÓDULO NO HACE, Y NO ES UN OLVIDO: EL IMPUESTO
//
// `timezone` responde **«¿en qué calendario vive este merchant?»**. NO responde «¿qué impuesto
// repercute?». Son dos datos distintos y coinciden geográficamente en Canarias, que es
// justamente lo que los hace fáciles de confundir:
//
//   · un merchant canario  → `Atlantic/Canary`  Y  IGIC
//   · uno peninsular       → `Europe/Madrid`    Y  IVA
//   · Ceuta y Melilla      → el huso de la PENÍNSULA  Y  IPSI
//
// Esa tercera fila es la que rompe la tentación: **la relación no es biyectiva**, así que
// derivar el impuesto de la zona nace roto en dos territorios españoles. El régimen es
// SCRUM-646 y **no sale de aquí**. Si algún día alguien necesita el impuesto, que NO lo pida a
// este módulo: no lo sabe y no debe aprenderlo.
//
// (Y hay un motivo más, medido por S1: `locale.vatName` —el mecanismo que YA existe para el
// nombre del impuesto— está indexado POR PAÍS, y Canarias es `ES`. Ese eje ya es el
// equivocado; convertir la zona horaria en su fuente metería el mismo defecto por otra puerta.)
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Qué zona se usa cuando el merchant no ha declarado la suya.
 *
 * **UTC, y es la decisión A del fundador (2-sep-2026): es EXACTAMENTE lo que el sistema hacía
 * antes de existir esta columna**, porque el proceso de Railway corre en UTC. Así, un merchant
 * sin declarar no ve ningún cambio que no haya pedido.
 *
 * 🔴 NO es `Europe/Madrid`, y esa es la diferencia entera de este ticket: caer a la península
 * por comodidad declararía peninsular a un canario, y **Canarias es mercado**. Un valor por
 * defecto que afirma algo que nadie ha dicho es el defecto que se evitó también en el schema
 * (columna nullable, SIN `@default`).
 */
export const ZONA_POR_DEFECTO = 'UTC';

/**
 * La zona de un merchant. **Único sitio del producto donde se resuelve**: quien la necesite,
 * que llame aquí en vez de leer el campo y decidir por su cuenta.
 *
 * Una zona guardada que `Intl` no reconozca cae también al valor por defecto: un dato corrupto
 * no debe tumbar la bandeja, y el resultado es el mismo que si no se hubiera declarado.
 */
export function zonaDelMerchant(merchant: { timezone?: string | null } | null | undefined): string {
  const declarada = merchant?.timezone;
  if (typeof declarada !== 'string' || declarada.trim() === '') return ZONA_POR_DEFECTO;
  return zonaValida(declarada.trim()) ? declarada.trim() : ZONA_POR_DEFECTO;
}

/** ¿`Intl` reconoce esta zona? Se pregunta al motor, no a una lista a mano que se desfasaría. */
export function zonaValida(zona: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

// ── El reloj, explícito ────────────────────────────────────────────────────────────────────
// Sin librerías: `Intl.DateTimeFormat` con `timeZone` a mano y `Date.UTC`. Es el método ya
// probado en SCRUM-630 (2/2) y SCRUM-640, y el que hace que estos cálculos dejen de depender de
// la máquina donde corren.

const FORMATEADORES = new Map<string, Intl.DateTimeFormat>();
function formateador(zona: string): Intl.DateTimeFormat {
  let f = FORMATEADORES.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    FORMATEADORES.set(zona, f);
  }
  return f;
}

interface Pared { y: number; m: number; d: number; hh: number; mm: number; ss: number }

/** El reloj de PARED que marca `zona` en ese instante. */
function pared(ts: number, zona: string): Pared {
  const p: Record<string, string> = {};
  for (const x of formateador(zona).formatToParts(new Date(ts))) p[x.type] = x.value;
  return {
    y: Number(p.year), m: Number(p.month), d: Number(p.day),
    hh: Number(p.hour) % 24, mm: Number(p.minute), ss: Number(p.second),
  };
}

function desfase(ts: number, zona: string): number {
  const p = pared(ts, zona);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - ts;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** El día natural (`YYYY-MM-DD`) al que pertenece un instante EN esa zona. */
export function diaNaturalEn(instante: Date, zona: string): string {
  const p = pared(instante.getTime(), zona);
  return `${p.y}-${dos(p.m)}-${dos(p.d)}`;
}

/** El mes natural (`YYYY-MM`) al que pertenece un instante EN esa zona — la rotura del art. 13. */
export function mesNaturalEn(instante: Date, zona: string): string {
  return diaNaturalEn(instante, zona).slice(0, 7);
}

/**
 * El instante en que `zona` marca ese reloj de pared. Se itera porque el desfase depende del
 * propio instante (horario de verano): con una sola pasada, una fecha del cambio de hora
 * quedaría desplazada.
 */
function instanteDe(y: number, m: number, d: number, hh: number, mm: number, ss: number, zona: string): number {
  const objetivo = Date.UTC(y, m - 1, d, hh, mm, ss);
  let ts = objetivo;
  for (let i = 0; i < 3; i++) ts = objetivo - desfase(ts, zona);
  return ts;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-749 · UN DÍA QUE NO EXISTE NO SE INVENTA: SE RECHAZA.
 *
 * `Date.UTC(y, m - 1, d, …)` **normaliza en silencio**, y estas dos funciones se apoyaban en él
 * sin mirar. Medido el 6-sep-2026, con el merchant en `Europe/Madrid` y el MISMO resultado con el
 * proceso en UTC y en `Europe/Madrid`:
 *
 *     '2026-02-31'  →  fin del día 2026-03-03T22:59:59.999Z     ← el 31 de febrero es 3 de marzo
 *     '2026-06-31'  →  fin del día 2026-07-01T21:59:59.999Z
 *     '2026-13-01'  →  fin del día 2027-01-01T22:59:59.999Z
 *
 * Y dónde se ve, con el filtro REAL de consolidación (`seleccionarConsolidablesDeCliente`):
 *
 *     hasta «2026-02-28» → corte 2026-02-28T22:59:59.999Z   ENTRAN: [ALB-…001]
 *     hasta «2026-02-31» → corte 2026-03-03T22:59:59.999Z   ENTRAN: [ALB-…001, ALB-…002]
 *
 * `ALB-…002` es del **2 de marzo** y se cuela en una factura que el profesional acotó a febrero.
 * La ruta `GET /consolidables` pasa `req.query.hasta` **sin validar el formato**.
 *
 * ── POR QUÉ RECHAZAR, Y NO AVISAR NI NORMALIZAR DECLARÁNDOLO ────────────────────────────────
 * La doctrina de la casa: **un valor por defecto plausible es peor que un valor imposible**. Una
 * fecha normalizada es el valor plausible perfecto — existe, es del mismo mes casi siempre, y
 * nadie la eligió.
 *
 * ⛔ «Devolver el valor y un aviso» reproduce el defecto: en JavaScript nada obliga a mirar un
 *    aviso, y el estado de hoy ya es «el valor, con un aviso que nadie escribió».
 * ⛔ «Normalizar declarándolo» sigue emitiendo una fecha que nadie eligió; una línea de log no
 *    para la factura equivocada, y esta ruta no lee logs.
 *
 * Rechazar es lo único que no se puede ignorar por construcción. Y es barato AHORA: dos
 * llamadores de producto, los dos en el mismo fichero.
 *
 * ⚠️ LO QUE ESTO **NO** RESUELVE, y no lo decide esta sesión: la ruta convierte cualquier throw en
 * `500 internal_error`, que le dice al profesional «se ha roto el servidor» cuando lo que pasa es
 * que ese día no existe. Contestarle bien pide un 400 con su texto, y ese texto es microcopy.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
function componentesDelDia(diaISO: string): { y: number; m: number; d: number } {
  const partes = String(diaISO).split('-');
  const [y, m, d] = partes.map(Number);
  const bienFormado = partes.length === 3
    && [y, m, d].every((n) => Number.isInteger(n))
    && partes[0].length === 4;
  // Que EXISTA se comprueba con el ida y vuelta: `Date.UTC` normaliza, así que si lo que sale no
  // son los mismos componentes que entraron, el día no existía.
  const t = bienFormado ? Date.UTC(y, m - 1, d) : NaN;
  const vuelta = Number.isFinite(t) ? new Date(t) : null;
  const existe = vuelta !== null
    && vuelta.getUTCFullYear() === y && vuelta.getUTCMonth() === m - 1 && vuelta.getUTCDate() === d;
  if (!existe) {
    throw new RangeError(
      `dia_inexistente: "${diaISO}" no es un dia del calendario. No se normaliza a otro dia: `
      + 'una fecha plausible que nadie eligio es peor que un rechazo (SCRUM-749).',
    );
  }
  return { y, m, d };
}

/**
 * ¿`YYYY-MM-DD` es un día del calendario? La pregunta en forma de predicado, para quien tenga que
 * contestarle al profesional ANTES de llegar a la primitiva. Deriva de la misma comprobación: no
 * hay aquí una segunda tabla de meses que se pueda quedar atrás.
 */
export function diaExiste(diaISO: string): boolean {
  try {
    componentesDelDia(diaISO);
    return true;
  } catch {
    return false;
  }
}

/** El PRIMER instante del día `YYYY-MM-DD` en esa zona. Lanza si ese día no existe. */
export function inicioDelDiaEn(diaISO: string, zona: string): Date {
  const { y, m, d } = componentesDelDia(diaISO);
  return new Date(instanteDe(y, m, d, 0, 0, 0, zona));
}

/**
 * El ÚLTIMO instante del día `YYYY-MM-DD` en esa zona — «hasta el 31» incluye el 31 entero.
 * Lanza si ese día no existe.
 */
export function finDelDiaEn(diaISO: string, zona: string): Date {
  const { y, m, d } = componentesDelDia(diaISO);
  return new Date(instanteDe(y, m, d, 23, 59, 59, zona) + 999);
}

/**
 * Días de calendario entre dos días naturales ya resueltos (`YYYY-MM-DD`). No lleva zona a
 * propósito: cuando los dos extremos son días, restarlos ya no depende de ningún reloj.
 * Devuelve `NaN` si alguno no es un día legible — quien llame decide qué hacer con eso.
 */
export function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = Date.parse(`${desdeISO}T00:00:00Z`);
  const b = Date.parse(`${hastaISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}

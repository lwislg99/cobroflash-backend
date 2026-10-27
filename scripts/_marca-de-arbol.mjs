// scripts/_marca-de-arbol.mjs — SCRUM-808
//
// LA PIEZA UNICA. Ver la cabecera del bloque de abajo.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SALIDA_NO_RESTAURADO = 3;
const MANIFIESTO = 'en-vuelo.json';

/**
 * Devuelve cada pieza a sus BYTES originales y lo VERIFICA leyendo el disco otra vez. Devuelve la
 * lista de las que no cuadraron — vacía si todo volvió a su sitio.
 *
 * No traga fallos de escritura: si una pieza no se puede escribir, revienta. Un restaurador que
 * devuelve «todo bien» porque no pudo ni intentarlo es peor que no tenerlo.
 */
export function restaurarYVerificar(piezas) {
  const sinRestaurar = [];
  for (const p of piezas) {
    fs.writeFileSync(p.abs, p.ORIGINAL);
    if (Buffer.compare(fs.readFileSync(p.abs), p.ORIGINAL) !== 0) sinRestaurar.push(p.ruta);
  }
  return sinRestaurar;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-808 · LA MARCA EN DISCO — porque el `finally` NO es una promesa.
 *
 * QUÉ PASABA, reproducido antes de tocar nada: se lanza la pasada, se mata a mitad, y el fichero
 * mutado **se queda en el árbol**. El `finally` que restaura no llega a correr, porque una
 * terminación no es un final: es una ausencia de final. Ocurrió DOS VECES el 6-sep-2026, a dos
 * sesiones distintas (SCRUM-801 y SCRUM-784), y las dos veces se cazó porque a alguien se le
 * ocurrió mirar `git status`. Eso es vigilancia por costumbre, no por mecanismo.
 *
 * Y lo que lo hace grave: **matar la pasada es la conducta correcta** —se mata para no medir
 * sobre un árbol caducado, que es lo que la casa pide—. El instrumento castigaba la conducta que
 * él mismo exige.
 *
 * ── POR QUÉ NO BASTA CON ATRAPAR LA SEÑAL, Y ESTÁ MEDIDO ───────────────────────────────────
 * Se sondeó este entorno con un proceso que escuchaba `SIGINT`, `SIGTERM`, `SIGHUP`, `SIGBREAK`
 * y `SIGQUIT`, más `exit` y `beforeExit`. Al matarlo **no se ejecutó NINGUNO**: en Windows la
 * terminación no entrega señal atrapable. Un remedio que sólo escuchara señales habría parecido
 * protección sin serlo, justo en la máquina donde el defecto ocurrió las dos veces.
 *
 * ── Y TAMPOCO SALVA UN VIGILANTE EXTERNO. También medido, antes de montarlo: un hijo
 * `detached` + `unref()` que vigilaba al padre **murió con él** — se termina el árbol de procesos
 * entero, y su registro dejó de crecer en el mismo instante. O sea: en esta máquina **nada que
 * viva dentro del proceso moribundo puede devolver el árbol**. Por eso la reparación NO es
 * instantánea: la hace **la siguiente invocación**, y `--solo-censo` la hace en ~1 s.
 *
 * Así que hay DOS capas, y la que salva es la segunda:
 *   ① las señales, para donde SÍ llegan (Ctrl+C en terminal, `kill` en CI POSIX);
 *   ② **la marca**: antes de escribir la mutación se deja en disco una copia BYTE A BYTE de cada
 *      pieza original y un manifiesto; al restaurar bien, se borra. Si el proceso muere sin
 *      borrarla, **la marca sobrevive** y la siguiente pasada la encuentra y repara — o denuncia.
 *
 * Vive en `.cache/`, que `.gitignore` ya ignora: la marca NO puede ensuciar el árbol que protege.
 * Y guarda los BYTES, no una referencia a git: el árbitro son los bytes de disco y no el blob
 * (un fichero normalizado tiene el blob limpio y CR en la copia de trabajo, SCRUM-570).
 * ── Y POR QUÉ ESTO ES UNA PIEZA Y NO DOS COPIAS ────────────────────────────────────────────
 * `censo-mudez` tiene el defecto IDÉNTICO, y encima sobre `tests/_guard-texto.mjs`, que está
 * VERSIONADO: un resto suyo no se queda en un fichero cualquiera, se queda en un guard que otro
 * mergearía sin mirar. Reproducido: matándolo a mitad, el fichero queda con una línea que
 * ESCRIBE EN `stderr` en cada llamada al filtro, y lo usan decenas de guards.
 *
 * Así que la red no se le copia: **se le da ésta**. Dos implementaciones del mismo remedio son
 * la regla 2, y dentro de seis meses una de las dos está rota sin que nadie lo sepa.
 *
 * 🔴 CADA HERRAMIENTA TIENE SU CARPETA Y SU LISTA `enVuelo`, y no hay estado compartido en este
 * módulo: dos marcas en el mismo sitio se pisarían, y una lista común haría que la red de una
 * intentara devolver las piezas de la otra. Por eso `dir` y `enVuelo` son argumentos, sin valor
 * por defecto que los una.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Dónde vive la marca de una herramienta. `.cache/` ya está en `.gitignore`. */
export function marcaDe(nombre) {
  return path.join(RAIZ, '.cache', nombre);
}

/**
 * 🔴 EL SUELO QUE NO DEPENDE DE VOLVER A LANZAR LA HERRAMIENTA: todas las marcas HUÉRFANAS del
 * árbol —marca presente y el proceso que la dejó ya muerto— con las piezas que siguen mutadas.
 *
 * Barre `.cache/` entero, así que una herramienta NUEVA que adopte la marca queda vigilada sin
 * tocar esto. Una marca de una pasada VIVA no es un defecto y no sale.
 */
export function marcasHuerfanas(raizCache = path.join(RAIZ, '.cache')) {
  if (!fs.existsSync(raizCache)) return [];
  const out = [];
  for (const nombre of fs.readdirSync(raizCache).sort()) {
    const manifiesto = path.join(raizCache, nombre, MANIFIESTO);
    if (!fs.existsSync(manifiesto)) continue;
    let datos = null;
    try { datos = JSON.parse(fs.readFileSync(manifiesto, 'utf8')); } catch { /* ilegible */ }
    if (!datos) { out.push({ herramienta: nombre, ilegible: true, sucias: [] }); continue; }
    let viva = false;
    try { process.kill(datos.pid, 0); viva = true; } catch { viva = false; }
    if (viva) continue; // hay una pasada trabajando: no es un defecto
    const sucias = [];
    const ajenas = []; // SCRUM-1178 · difiere, y NO es una mutación apuntada: el remedio no la pisará
    for (const p of datos.piezas || []) {
      const e = estadoDePieza(p);
      if (e === 'original') continue;
      sucias.push(p.ruta);
      if (e === 'ajena') ajenas.push(p.ruta);
    }
    if (sucias.length) out.push({ herramienta: nombre, ilegible: false, sucias, ajenas, pid: datos.pid, cuando: datos.cuando });
  }
  return out;
}

/**
 * CAPA ① · las señales. **No salvan en Windows** —medido: al matar el proceso no se ejecuta
 * ninguna, ni `exit`— pero sí en un terminal POSIX y en CI, que es donde `kill` entrega señal de
 * verdad. Se instalan una sola vez y sólo si hay algo que proteger.
 *
 * El manejador es SÍNCRONO a propósito: dentro de `exit` no corre nada asíncrono, y una
 * restauración que devuelve el control antes de haber escrito no restaura nada.
 */
export function redDeSeguridad(salir, enVuelo, dir) {
  return function devolver(motivo) {
    if (!enVuelo.length) return false;
    const piezas = enVuelo.map((p) => p.ruta);
    let sinRestaurar;
    try {
      sinRestaurar = restaurarYVerificar(enVuelo);
    } catch (e) {
      // 🔴 AQUÍ NO SE REVIENTA. `restaurarYVerificar` sí revienta a propósito en el camino normal
      // —un restaurador que traga fallos de escritura es peor que ninguno—, pero esto corre
      // dentro de un manejador de señal y de `exit`: una excepción ahí sale como un volcado sin
      // nombre de fichero, que es justo la denuncia que el ticket exige que NO falte.
      sinRestaurar = [`${piezas.join('` y `')} (${e.message})`];
    }
    enVuelo.length = 0;
    if (sinRestaurar.length) {
      console.error(`\n🔴🔴 ${motivo} Y NO PUDE RESTAURAR \`${sinRestaurar.join('` y `')}\`. `
        + 'EL ÁRBOL SE QUEDA SUCIO — MÍRALO A MANO.');
      console.error(`   Los bytes originales siguen en \`${dir}\`.`);
      salir(SALIDA_NO_RESTAURADO);
      return true;
    }
    console.error(`\n⚠️ ${motivo} Devuelto a su sitio: \`${piezas.join('` y `')}\`.`);
    borrarMarca(dir);
    return true;
  };
}

/** Engancha la red a las señales y a `exit`. Separado de `redDeSeguridad` para que se pueda
 *  ejercitar la restauración sin ensuciar los manejadores del proceso que corre los tests. */
export function instalarRedDeSeguridad(salir, enVuelo, dir) {
  const devolver = redDeSeguridad(salir, enVuelo, dir);
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    try { process.on(s, () => { devolver(`Me han parado (${s}).`); salir(SALIDA_NO_RESTAURADO); }); }
    catch { /* la plataforma no la conoce: no es un fallo, es que ahí no existe */ }
  }
  process.on('exit', () => { devolver('El proceso terminó con una mutación puesta.'); });
  return devolver;
}

/** Deja en disco la copia de cada pieza y el manifiesto. Se llama ANTES de escribir la mutación. */
export function marcarEnVuelo(piezas, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const apuntes = piezas.map((p, i) => {
    const copia = path.join(dir, `pieza-${i}.bin`);
    fs.writeFileSync(copia, p.ORIGINAL);
    return { ruta: p.ruta, abs: p.abs, copia, mutaciones: [] };
  });
  fs.writeFileSync(path.join(dir, MANIFIESTO),
    JSON.stringify({ pid: process.pid, cuando: new Date().toISOString(), piezas: apuntes }, null, 2));
  return apuntes;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-1178 · LA MARCA APUNTA QUÉ ESCRIBE, NO SÓLO QUÉ HABÍA.
 *
 * Hasta aquí la marca guardaba el ORIGINAL y nada más, y `restaurarDesdeMarca` devolvía la copia
 * en cuanto los bytes diferían. «Difiere» no distingue «mi mutación sigue puesta» de «alguien
 * trabajó encima después»: con una marca huérfana VIEJA, el remedio que propone `guards:entrada`
 * REVERTÍA el fichero. Medido en `wt-s3-1293`: una marca del 1-oct habría devuelto `homeView.js`
 * a 75.033 B con `main` en 85.825 B. Sin un error: no falla, obedece.
 *
 * Por eso cada escritura de una mutación se APUNTA antes de hacerse (la huella de sus bytes), y
 * la restauración sólo escribe si lo que hay es EXACTAMENTE una de ellas. Lo demás es AJENO y no
 * se pisa — tampoco con una marca del formato de antes, que no sabe qué escribió: fail-closed.
 *
 * Va ANTES de `writeFileSync` a propósito: si el proceso muere entre los dos, lo que hay es el
 * original (nada que hacer); al revés, la mutación quedaría puesta sin apuntar y se denunciaría
 * como ajena, sin repararse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function apuntarMutacion(dir, abs, bytes) {
  const man = path.join(dir, MANIFIESTO);
  const datos = JSON.parse(fs.readFileSync(man, 'utf8'));
  const p = (datos.piezas || []).find((x) => x.abs === abs);
  if (!p) throw new Error(`\`${abs}\` no está en la marca de \`${dir}\`: no se puede apuntar su mutación`);
  const h = huella(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8'));
  p.mutaciones = [...(p.mutaciones || []).filter((x) => x !== h), h];
  fs.writeFileSync(man, JSON.stringify(datos, null, 2));
}

function huella(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Qué hay hoy en el sitio de una pieza: `original` (coincide con su copia), `mutada` (es una de
 * las mutaciones apuntadas: se puede devolver) o `ajena` (otra cosa, o no existe, o no se puede
 * leer: no se toca). Fail-closed: lo que no se sabe es `ajena`, nunca `mutada`.
 */
function estadoDePieza(p) {
  let copia;
  let actual;
  try { copia = fs.readFileSync(p.copia); } catch { return 'ajena'; }
  try { actual = fs.readFileSync(p.abs); } catch { return 'ajena'; }
  if (Buffer.compare(actual, copia) === 0) return 'original';
  return Array.isArray(p.mutaciones) && p.mutaciones.includes(huella(actual)) ? 'mutada' : 'ajena';
}

/** Retira la marca. Sólo se llama cuando la restauración ha CUADRADO por bytes. */
export function borrarMarca(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * ¿Quedó una mutación puesta de una pasada anterior? Repara, y dice qué encontró.
 *
 * Devuelve `{ habia, reparadas, sucios, cuando }`:
 *   · `habia` false  → no había marca. El caso normal, y NO se dice nada (control positivo: una
 *      pasada sana no puede empezar a denunciar).
 *   · `reparadas`    → ficheros que estaban mutados y se han devuelto a sus bytes.
 *   · `sucios`       → los que NO se han podido devolver. Ésos son el suelo: el llamante tiene
 *      que salir con código distinto de cero NOMBRÁNDOLOS.
 *
 * 🔴 Una pieza que ya coincide con su copia NO se cuenta como reparada: el `finally` sí corrió y
 * la marca quedó huérfana por otro motivo. Contarla haría que una pasada sana gritara.
 */
/**
 * ¿Sigue vivo el proceso que dejó la marca? `kill(pid, 0)` no manda ninguna señal: sólo pregunta.
 * `EPERM` significa que EXISTE y no es mío, o sea vivo; `ESRCH`, que no existe.
 */
export function procesoVivo(pid, matar = process.kill.bind(process)) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { matar(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-754 · UNA MARCA DE UN PROCESO VIVO NO ES «UNA PASADA ANTERIOR»: ES UNA EN VUELO.
 *
 * Este restaurador nació (SCRUM-808) para devolver el árbol que dejó puesto **una pasada que
 * murió**. Su propio texto lo dice: «¿quedó una mutación puesta de una pasada ANTERIOR?». Pero no
 * lo comprobaba: reparaba cualquier marca que encontrase, viva o muerta.
 *
 * ── LO QUE ESO PROVOCABA, REPRODUCIDO Y DISCRIMINADO (7-sep-2026) ───────────────────────────
 * `scrum765` declara una mutación que abre la puerta de entrada SIEMPRE. Con ella puesta, el
 * `import` que su sonda hace del meta-guard **ejecuta el bloque principal dentro del test**, y lo
 * primero que hace ese meta-guard ANIDADO es llamar aquí… encontrando la marca de la pasada de
 * FUERA, que está viva y midiendo. Le devolvía la mutación a sus bytes originales **en pleno
 * vuelo**, y el veredicto de fuera se emitía sobre un árbol ya restaurado.
 *
 * Medido con las dos mitades, que es lo que lo convierte en causa y no en sospecha:
 *
 *     marca en disco: SÍ → 🔴 la mutación VUELVE A LOS BYTES ORIGINALES a mitad de medición
 *     marca en disco: NO →    la mutación SIGUE PUESTA — nadie la toca
 *
 * Determinista: 3 repeticiones, 1 VIVA + 4 CIEGA idénticas. Y hasta hoy era INVISIBLE, porque
 * quien restauraba lo hacía con los bytes buenos y `git status` no veía nada.
 *
 * ⛔ NO se arregla dejando de reparar: eso devolvería el árbol sucio de SCRUM-808. Se arregla
 * preguntando lo que aquel comentario ya afirmaba sin comprobarlo — si el dueño sigue vivo.
 *
 * ⚠️ HUECO DECLARADO: si el sistema reutiliza el pid de una pasada muerta, esta marca dejará de
 * repararse. No se silencia: sale como `enVuelo` con su pid y su hora, y el llamante lo dice.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function restaurarDesdeMarca(dir, vivo = procesoVivo) {
  const manifiesto = path.join(dir, MANIFIESTO);
  if (!fs.existsSync(manifiesto)) return { habia: false, reparadas: [], sucios: [] };

  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(manifiesto, 'utf8'));
  } catch (e) {
    // 🔴 Una marca ILEGIBLE no se borra ni se ignora: es la peor de las tres: hubo una pasada
    // muerta y no se sabe qué dejó puesto. Se denuncia como sucio SIN nombre de fichero, que es
    // exactamente lo que se sabe.
    return { habia: true, reparadas: [], sucios: [`(marca ilegible en ${dir}: ${e.message})`] };
  }

  // 🔴 «OTRA pasada viva», no «una pasada viva»: una marca con MI propio pid es mía, y mía la
  // puedo reparar —es lo que hace el banco de pruebas de SCRUM-808, que fabrica la marca y la
  // repara dentro del mismo proceso—. Lo que no se toca es la de un proceso AJENO que sigue vivo.
  if (datos.pid !== process.pid && vivo(datos.pid)) {
    return {
      habia: true, enVuelo: true, reparadas: [], sucios: [],
      cuando: datos.cuando, pid: datos.pid,
      piezas: (datos.piezas || []).map((p) => p.ruta),
    };
  }

  const reparadas = [];
  const sucios = [];
  const ajenos = [];
  for (const p of datos.piezas || []) {
    try {
      const copia = fs.readFileSync(p.copia);
      const estado = estadoDePieza(p);
      if (estado === 'original') continue;
      if (estado === 'ajena') {
        // 🔴 SCRUM-1178 · no es una mutación que esta marca apuntara: o alguien trabajó encima
        // después, o la marca es de antes de las huellas y no sabe qué escribió. No se adivina.
        ajenos.push(p.ruta);
        sucios.push(`${p.ruta} (NO lo piso: lo que hay no es el original ni ninguna mutación que `
          + `esta marca apuntara. Si lo de ahora es lo bueno, borra la marca \`${dir}\`; si no, la `
          + `copia de entonces está en \`${p.copia}\`)`);
        continue;
      }
      fs.writeFileSync(p.abs, copia);
      if (Buffer.compare(fs.readFileSync(p.abs), copia) !== 0) { sucios.push(p.ruta); continue; }
      reparadas.push(p.ruta);
    } catch (e) {
      sucios.push(`${p.ruta} (${e.message})`);
    }
  }
  // La marca sólo se retira si NO queda nada sucio: mientras quede, es la evidencia.
  if (!sucios.length) borrarMarca(dir);
  return { habia: true, reparadas, sucios, ajenos, cuando: datos.cuando, pid: datos.pid };
}

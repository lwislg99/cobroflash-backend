// scripts/_turno-nota.mjs — SCRUM-249 · la NOTA LOCAL del turno. SCRUM-258 · una por SESIÓN.
//
// EL HUECO (SCRUM-249): `soltarLock` solo suelta si la marca coincide EXACTAMENTE con la que se
// escribió, y esa marca lleva dentro el id de quien la tomó. Entre `tomar` y `soltar` el proceso es
// otro, así que quien suelta no puede recomponerla: o se recuerda, o se pasa a mano con `--marca`.
//
// `turno-staging.mjs` ya la recordaba. **El runner gateado NO**, y por eso el 30-jul una tanda que
// murió de forma anómala dejó el turno secuestrado 30 minutos. Este módulo existe para que los DOS
// escriban y lean la MISMA nota.
//
// Vive aparte a propósito: `_staging-lock.mjs` declara en su cabecera que no importa nada —es
// lógica pura más una capa de BD con el cliente inyectado, y por eso sus tests corren sin BD ni
// red—, y meterle `node:fs` rompería esa propiedad para guardar un fichero temporal.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-258 · «LA MISMA NOTA» ERA LA MISMA PARA TODA LA MÁQUINA
//
// La ruta era fija: `%TEMP%\yaqu-turno-staging.json`. Un fichero por EQUIPO, no por sesión. Dos
// sesiones en el mismo portátil se pisaban la nota, y el enunciado del ticket describe la mitad
// benigna —la primera se queda soltando a mano—. **La otra mitad es peor, y no hace falta que
// caduque nada:**
//
//   1. B lanza su tanda (turno libre) → `guardarNota` escribe la marca de B, encima de la de A.
//   2. A, en el mismo equipo, ejecuta `turno:soltar` por costumbre o desde un script de limpieza.
//   3. `leerNota` le devuelve la marca de B. El marcador de la BD ES el de B, así que coincide.
//   4. **A suelta el turno VIVO de B**, en silencio, con la tanda de B corriendo. El turno queda
//      libre para un tercero y dos sesiones escriben sobre la misma base — el desastre exacto que
//      SCRUM-188 existe para impedir, entrando por el fichero que era «una comodidad».
//
// LA RUTA SE DERIVA DE LA SESIÓN, y esa identidad ya existe desde SCRUM-253: `host` + un token del
// árbol de trabajo. NO sale de una variable de entorno ni de nada que el humano tenga que exportar
// — una ruta que depende de que alguien se acuerde de algo es la misma clase de fallo que 253 le
// quitó al dueño, con otro disfraz.
//
// Y ADEMÁS LA NOTA SE DESCRIBE A SÍ MISMA: guarda de quién es, y `leerNota` no devuelve una marca
// ajena aunque se la encuentre en su ruta. La ruta derivada hace el choque improbable; comprobar
// el dueño hace que un choque no sirva de nada. Dos barreras, porque lo que hay al otro lado es
// soltarle el turno a otra sesión mientras escribe.
//
// TODO best-effort: la nota es una COMODIDAD. Lo que garantiza que el turno se libera sigue siendo
// el TTL, y lo que dice si está vivo es el compromiso publicado (SCRUM-249). Si la nota se pierde,
// queda `soltar --marca` y queda el TTL.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { dueñoActual, tokenDeSesion } from './_identidad-sesion.mjs';

/**
 * La ruta de la nota de ESTA sesión. El token sale del árbol de trabajo (SCRUM-253): dos worktrees
 * dan ficheros distintos, y los procesos de una misma sesión dan el mismo sin exportar nada.
 *
 * ⚠️ NO se reutiliza el nombre viejo (`yaqu-turno-staging.json`) ni se migra: mientras haya
 * sesiones corriendo código anterior, ese fichero sigue siendo suyo. Tocarlo desde aquí sería
 * pisar a quien todavía lo usa — literalmente el defecto que este ticket cierra.
 */
export function ficheroNota(desde = process.cwd()) {
  return path.join(os.tmpdir(), `yaqu-turno-staging-${tokenDeSesion(desde)}.json`);
}

/** Guarda la marca propia. Nunca lanza: que falle no puede tumbar una tanda que ya tiene el turno. */
export function guardarNota({ marca, db }) {
  try {
    fs.writeFileSync(ficheroNota(), JSON.stringify({ marca, db, dueño: dueñoActual() }), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve la marca recordada, o null si no hay nota legible **o si la nota no es de esta sesión**.
 *
 * Lo segundo es la segunda barrera: la ruta ya es propia, pero una nota escrita por otro —un
 * fichero heredado, un `%TEMP%` compartido entre usuarios— no puede convertirse en «suelta esto».
 * Sin dueño anotado (nota escrita por código anterior) también devuelve null: no saber de quién es
 * una marca es razón suficiente para no soltar con ella.
 */
export function leerNota() {
  try {
    const j = JSON.parse(fs.readFileSync(ficheroNota(), 'utf8'));
    if (typeof j?.marca !== 'string') return null;
    if (j?.dueño !== dueñoActual()) return null;
    return j.marca;
  } catch {
    return null;
  }
}

/** Borra la nota de esta sesión. Silencioso: si no estaba, no ha pasado nada. */
export function borrarNota() {
  try { fs.unlinkSync(ficheroNota()); } catch { /* da igual */ }
}

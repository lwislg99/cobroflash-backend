// scripts/_turno-nota.mjs — SCRUM-249 · la NOTA LOCAL del turno.
//
// EL HUECO: `soltarLock` solo suelta si la marca coincide EXACTAMENTE con la que se escribió, y
// esa marca lleva el PID dentro (`idDeSesion(host, pid)`). Entre `tomar` y `soltar` el PID cambia,
// así que quien suelta no puede recomponerla: o se recuerda, o se pasa a mano con `--marca`.
//
// `turno-staging.mjs` ya la recordaba. **El runner gateado NO**, y por eso el 30-jul una tanda que
// murió de forma anómala dejó el turno secuestrado 30 minutos: no había forma de soltarlo sin
// leer el marcador de la BD y pasarlo a mano. Con el TTL de 45 min, eso bloquea a todos ese rato.
//
// Este módulo existe para que los DOS escriban y lean la MISMA nota. Vive aparte a propósito:
// `_staging-lock.mjs` declara en su cabecera que no importa nada —es lógica pura más una capa de
// BD con el cliente inyectado, y por eso sus tests corren sin BD ni red—, y meterle `node:fs`
// rompería esa propiedad para guardar un fichero temporal.
//
// TODO best-effort: la nota es una COMODIDAD. El mecanismo que de verdad garantiza que el turno
// se libera sigue siendo el TTL, y el que dice si está vivo es el compromiso publicado en el
// contexto (SCRUM-249). Si la nota se pierde, queda `soltar --marca` y queda el TTL.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export const FICHERO_NOTA = path.join(os.tmpdir(), 'yaqu-turno-staging.json');

/** Guarda la marca propia. Nunca lanza: que falle no puede tumbar una tanda que ya tiene el turno. */
export function guardarNota({ marca, db }) {
  try {
    fs.writeFileSync(FICHERO_NOTA, JSON.stringify({ marca, db }), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** Devuelve la marca recordada, o null si no hay nota legible. */
export function leerNota() {
  try {
    const j = JSON.parse(fs.readFileSync(FICHERO_NOTA, 'utf8'));
    return typeof j?.marca === 'string' ? j.marca : null;
  } catch {
    return null;
  }
}

/** Borra la nota. Silencioso: si no estaba, no ha pasado nada. */
export function borrarNota() {
  try { fs.unlinkSync(FICHERO_NOTA); } catch { /* da igual */ }
}

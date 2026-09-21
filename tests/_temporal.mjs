// tests/_temporal.mjs — SCRUM-864 · UN DIRECTORIO TEMPORAL QUE SE BORRA PASE LO QUE PASE.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE CIERRA
//
// `fs.mkdtempSync(...)` crea el directorio y **nadie lo borra si el test no llega al final**. Un
// `assert` que falla salta el `rmSync` del camino feliz, y el directorio se queda. Medido el
// 16-sep-2026 (SCRUM-858, de rebote): **24.740 restos nuestros** entre 55.229 entradas de TMPDIR.
//
// 🔴 Y NO ES LA CAUSA DE LA TANDA LENTA, que conviene decirlo aquí para que nadie vuelva por ese
// camino: la misma sesión lo midió creando directorios hermanos sobre poblaciones de 0 a 55k y el
// coste sube **×1,3**; la tanda lenta iba **×40**. Esto es basura nuestra que crece sola, no una
// explicación. Confundir las dos cosas manda a alguien a limpiar un directorio en vez de a buscar
// la causa.
//
// ── POR QUÉ `process.on('exit')` Y NO UN `finally` NI UN HOOK DEL RUNNER ──────────────────────
//
// Las tres formas funcionan; la diferencia es **dónde hay que acordarse de ponerlas**:
//
//   · `try { … } finally { rm }`  — hay que envolver el cuerpo. En 27 sitios eso es 27
//     reestructuraciones, y cada una es una oportunidad de equivocarse.
//   · `t.after(...)`              — sólo sirve dentro de un test con su contexto. Media docena de
//     los sitios medidos están en helpers de módulo y en `scripts/`, donde no hay `t`.
//   · `process.on('exit')`        — vale en los tres sitios y **la llamada no cambia de forma**:
//     donde ponía `fs.mkdtempSync(...)` ahora pone `temporal(...)`. Una línea, sin envolver nada.
//
// ⚠️ LO QUE ESTO **NO** CUBRE, y se dice en vez de prometerlo: un `SIGKILL` no ejecuta ningún
// manejador de `exit`, así que un proceso matado a lo bruto seguirá dejando su directorio. Es el
// mismo límite que ya tiene documentado el instrumento de mutaciones de la casa. Para lo que sí
// pasa por aquí —un test que falla, un `throw` a mitad, un `process.exit(n)`— la limpieza corre.
//
// ⛔ Sin dependencias (regla 36) y sin estado ni flag nuevos (27): es un registro en memoria del
//    propio proceso, no una configuración.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Lo creado por ESTE proceso y aún sin borrar. */
const pendientes = new Set();
let enganchado = false;

function limpiarTodo() {
  for (const dir of pendientes) {
    // `force: true` para que un directorio ya borrado a mano no rompa la salida del proceso: esto
    // es limpieza, y una limpieza que puede tumbar la tanda es peor que la basura que quita.
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* no hay nada que hacer */ }
  }
  pendientes.clear();
}

/**
 * Crea un directorio temporal y **se compromete a borrarlo** al terminar el proceso.
 *
 * @param {string} prefijo  el mismo que se le pasaba a `mkdtempSync`, p.ej. `'yaqu-176b-'`.
 * @returns {string} la ruta del directorio, igual que `mkdtempSync`.
 */
export function temporal(prefijo = 'yaqu-') {
  if (!enganchado) {
    // `exit` corre en la salida normal Y en `process.exit(n)` — que es como sale el runner con
    // `--test-force-exit`. Los otros dos son por si el proceso muere por señal atendible.
    process.on('exit', limpiarTodo);
    process.on('SIGINT', () => { limpiarTodo(); process.exit(130); });
    process.on('SIGTERM', () => { limpiarTodo(); process.exit(143); });
    enganchado = true;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
  pendientes.add(dir);
  return dir;
}

/**
 * Borra uno ANTES de que acabe el proceso, para quien no quiera esperar (un bucle que crea
 * muchos). No hace falta llamarla: lo de arriba ya se encarga. Es un atajo, no una obligación.
 */
export function borrarTemporal(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya no está */ }
  pendientes.delete(dir);
}

/** Cuántos quedan vivos ahora mismo. Existe para que un test pueda AFIRMAR sobre el mecanismo. */
export function temporalesPendientes() {
  return [...pendientes];
}

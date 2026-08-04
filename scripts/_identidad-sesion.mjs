// scripts/_identidad-sesion.mjs — SCRUM-253 · QUIÉN es el dueño de un turno de staging.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PREGUNTA QUE RESUELVE, Y POR QUÉ NO ES LA DE SCRUM-266
//
// Sobre el mismo lock hay DOS preguntas distintas, y confundirlas es lo que ha producido los
// dos defectos de esta semana:
//
//     ¿sigue VIGENTE?  → caducidad → `decidirVigencia()`  (SCRUM-266)
//     ¿es MÍO?         → propiedad → esto                 (SCRUM-253)
//
// SCRUM-266 arregló la primera y dejó la puerta escrita así:
//
//     if (vigencia.vigente) return { ok: false, motivo: 'ocupado' }
//
// Sin mirar de quién es. O sea que **tu propio turno vivo te bloquea a ti**: haces
// `turno:tomar` para sostener la base, lanzas la tanda, y el runner se da `exit 5` contra sí
// mismo. La herramienta que SCRUM-232 hizo para poder inspeccionar el turno sin lanzar una
// tanda impedía justo lo siguiente que ibas a hacer.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PROBLEMA DE VERDAD: «MISMO DUEÑO» NO PUEDE SIGNIFICAR «MISMA MÁQUINA»
//
// La identidad era `host.PID` (`idDeSesion(os.hostname(), process.pid)`), y ahí está el bug:
// **el PID cambia entre los procesos de una misma sesión**. El `turno:tomar` es un proceso y
// el runner es otro, así que una sesión no se reconoce a sí misma.
//
// La tentación es quitar el PID y quedarse con el host. **Eso sería exactamente SCRUM-258**:
// dos sesiones distintas del mismo equipo pasarían a ser «el mismo dueño» y adoptarían el
// turno la una de la otra — las dos escribiendo sobre la misma base, que es el desastre que
// SCRUM-188 existe para impedir. Aflojar la identidad hasta que el bug desaparezca hace
// desaparecer también el mecanismo.
//
// Así que la identidad tiene que distinguir SESIÓN de MÁQUINA. Lo que se necesita es algo que:
//
//     ① dos procesos de la MISMA sesión compartan **automáticamente**, sin que nadie exporte
//        nada a mano — porque si depende de un copia-y-pega, se olvida y el bug vuelve; y
//     ② dos sesiones CONCURRENTES de la misma máquina **no** puedan compartir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DECISIÓN: LA SESIÓN ES **DÓNDE** TRABAJA, NO QUIÉN LA EJECUTA
//
// El identificador es `host` + un token derivado de la **raíz del árbol de trabajo** (el
// worktree). Cumple las dos condiciones sin pedirle nada al humano:
//
//   ① El `turno:tomar`, el runner y los hijos que el runner lanza corren todos desde el mismo
//      directorio (`spawnSync` sin `cwd` hereda el del padre, comprobado), así que los tres
//      calculan el MISMO id sin exportar ni copiar nada.
//   ② Dos sesiones concurrentes trabajan en worktrees distintos — es regla dura de esta casa
//      («worktree PROPIO siempre; jamás trabajes en main»), no una costumbre.
//
// **Y NO ES UNA CONVENCIÓN QUE ME ESTÉ CREYENDO:** el árbol de trabajo YA es la unidad que dos
// sesiones concurrentes no pueden compartir, y no por este ticket. `dist/` es del árbol; el
// recibo de la tanda es `.claude/evidencia-tanda.json`, relativo al árbol; y SCRUM-182 existe
// precisamente para DELATAR que los artefactos de un árbol se movieron bajo los pies de una
// tanda. Dos tandas en el mismo directorio ya se destrozan mutuamente el `dist/` y el recibo.
// Esta identidad no crea esa frontera: **le pone nombre a una que ya estaba**.
//
// POR QUÉ NO EL PID: cambia entre procesos de la misma sesión. Es el bug.
// POR QUÉ NO EL HOST SOLO: es la máquina. Es SCRUM-258.
// POR QUÉ NO UNA VARIABLE DE ENTORNO (`YAQU_LOCK_DUENO`): dos motivos, y el segundo es el que
//   decide. (a) Hay que acordarse de exportarla, y quien toma el turno a mano y no lo hace se
//   ve a sí mismo como ajeno — que es el hueco que la sesión 4 dejó anotado en SCRUM-260 y que
//   este ticket cierra. (b) Una identidad que se DECLARA se puede AFIRMAR: cualquiera podría
//   escribir el id de otra sesión y adoptar su turno vivo. Una identidad se deriva de un hecho,
//   no se pide por parámetro. Es la misma lección que SCRUM-266: no supongas un dato que puedes
//   leer.
//
// ⚠️ LÍMITE DECLARADO: si dos personas trabajaran de verdad en el MISMO directorio a la vez, se
// verían como la misma sesión y se adoptarían el turno. No se defiende contra eso porque en ese
// escenario el turno no es lo primero que se rompe: ya estarían pisándose `dist/`, el recibo y
// el cliente de Prisma. La frontera es el árbol; si se cruza, no hay identidad que salve nada.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// La COMPOSICIÓN del id (y su charset seguro) sigue viviendo en el módulo del turno: es la
// misma cadena que acaba dentro del marcador de la base, así que la regla de qué caracteres
// admite tiene que estar donde está la regla del marcador. Aquí se decide QUÉ se compone.
import { idDeSesion } from './_staging-lock.mjs';

/**
 * La raíz del árbol de trabajo: se sube desde `desde` hasta encontrar un `.git` (directorio en
 * el checkout principal, FICHERO en un worktree enlazado — los dos valen y los dos identifican
 * un árbol distinto).
 *
 * Se hace subiendo por el sistema de ficheros y NO con `git rev-parse --show-toplevel` a
 * propósito: esto lo llama `tests/_staging-db.mjs`, que se importa en 35 ficheros de test, y
 * lanzar un proceso `git` por cada uno cuesta tiempo real en cada tanda. Además así no depende
 * de que `git` esté en el PATH del entorno que corre los tests.
 *
 * @returns {string|null} ruta absoluta, o null si no hay árbol identificable.
 */
export function raizDeTrabajo(desde = process.cwd()) {
  let actual = path.resolve(desde);
  for (;;) {
    if (fs.existsSync(path.join(actual, '.git'))) return actual;
    const padre = path.dirname(actual);
    if (padre === actual) return null; // llegamos a la raíz del volumen
    actual = padre;
  }
}

/**
 * El token que identifica la SESIÓN. Hash corto de la raíz del árbol: estable entre procesos
 * (①) y distinto por worktree (②). Va hasheado y no en claro porque el id viaja dentro del
 * marcador de la base, y ahí una ruta absoluta sería a la vez ruido, información del disco de
 * alguien y un problema de charset (`RE_MARCA_SEGURA`); el hex siempre es representable.
 *
 * SIN ÁRBOL, FAIL-SAFE: si no se encuentra raíz, se cae al PID. Eso hace que dos procesos NO
 * se reconozcan entre sí, o sea que **se conserva exactamente el comportamiento de hoy**: no
 * se adopta nada y el turno bloquea. Degradar hacia «no adoptar» es lo correcto — el error
 * caro de este mecanismo es adoptar lo que no es tuyo, no dejar de adoptar lo que sí.
 */
export function tokenDeSesion(desde = process.cwd()) {
  const raiz = raizDeTrabajo(desde);
  if (!raiz) return `p${process.pid}`;
  return crypto.createHash('sha1').update(raiz).digest('hex').slice(0, 10);
}

/**
 * El dueño que esta sesión usa para tomar, adoptar y reconocer turnos. Uno solo, para que las
 * cuatro herramientas que preguntan «¿es mío?» no puedan contestar cosas distintas — que es
 * literalmente lo que pasaba (ver el guard de `tests/scrum253-adopcion.test.mjs`).
 */
export function dueñoActual({ host = os.hostname(), desde = process.cwd() } = {}) {
  return idDeSesion(host, tokenDeSesion(desde));
}

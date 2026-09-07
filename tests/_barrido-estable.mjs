// tests/_barrido-estable.mjs — SCRUM-740
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN BARRIDO LEE UN FICHERO QUE YA NO ESTÁ, Y REVIENTA. NO ES CULPA DE NADIE: ES ACOPLAMIENTO.
//
// `readdirSync` da una FOTO. Entre esa foto y el `readFileSync` de cada entrada pasa tiempo, y
// en ese hueco otro test del mismo `npm test` puede haber borrado el fichero. El barrido muere
// con ENOENT y el rojo sale INTERMITENTE, que es la peor forma de salir: con nueve worktrees
// vivos se lee como «el rojo ajeno de siempre» y nadie lo mira.
//
// MEDIDO (SCRUM-740): 4 tests escriben DENTRO de `tests/` y 6 barren ese árbol leyéndolo. El
// producto —24 pares— es la lista de colisiones posibles. No es un par que se pisa: es una clase.
//
// ── POR QUÉ SE ARREGLA EL LADO DEL BARRIDO Y NO EL DE LOS ESCRITORES ────────────────────────
// Porque los escritores NO PUEDEN dejar de escribir ahí. Los cuatro son AUTOPRUEBAS: fabrican
// un fichero sintético con el defecto que su guard busca, para verlo salir en rojo. El fichero
// TIENE que estar dentro del árbol que el guard barre — moverlo a `tmpdir` no arregla la carrera,
// desactiva el control positivo. Comprobado en `scrum206b:180`, que lo dice en su comentario.
//
// ── 🔴 EL SUELO, QUE ES LA MITAD QUE IMPORTA ────────────────────────────────────────────────
// «Tolerar un fichero que desaparece» se convierte con una línea de más en «tolerar un árbol
// vacío», y entonces el guard pasa en verde sin haber mirado nada. Dos reglas, y las dos están
// aquí y no en cada llamador:
//
//   ① SÓLO se traga `ENOENT`. Un permiso denegado, un directorio en vez de fichero o un disco
//      lleno SIGUEN siendo fallos. Un `catch` pelado —que ya existe en `scrum393:107`— se los
//      come todos y no distingue «desapareció» de «no supe leer».
//   ② Se CUENTA lo leído de verdad, no lo listado. El suelo que cada barrido ya tenía mira
//      `readdir`, así que sobreviviría a que TODAS las lecturas fallaran. `exigirCorpusLeido`
//      mira el otro número.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';

/** Lo que ha desaparecido bajo los pies durante esta ejecución, para poder decirlo. */
const desaparecidos = [];
let leidos = 0;

/**
 * Lee un fichero que salió de un `readdirSync`. Devuelve su contenido, o `null` si desapareció
 * entre la foto y la lectura.
 *
 * 🔴 SÓLO tolera `ENOENT`. Cualquier otro error se relanza: «no está» y «no supe leerlo» son
 * cosas distintas, y confundirlas es como un guard se queda mudo sin que nadie se entere.
 */
export function leerSiSigueAhi(ruta, codificacion = 'utf8') {
  try {
    const contenido = fs.readFileSync(ruta, codificacion);
    leidos++;
    return contenido;
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      desaparecidos.push(String(ruta));
      return null;
    }
    throw e;
  }
}

/** Qué ha pasado durante el barrido: cuántos se leyeron y cuáles se esfumaron. */
export function informeDelBarrido() {
  return { leidos, desaparecidos: [...desaparecidos] };
}

/** Sólo para los tests de este helper: vuelve a empezar la cuenta. */
export function reiniciarBarrido() {
  desaparecidos.length = 0;
  leidos = 0;
}

/**
 * 🔴 EL SUELO. `n` es cuántos ficheros se LEYERON de verdad, no cuántos listó `readdir`.
 *
 * Sin esto, tolerar el ENOENT es una puerta abierta: si un día el barrido apuntara a un
 * directorio equivocado, todas las lecturas darían `null`, la lista de infracciones saldría
 * vacía y el guard pasaría en verde declarándose sano. «No hay defectos» y «no supe mirar» son
 * el mismo verde con significados opuestos.
 */
export function exigirCorpusLeido(n, minimo, contexto) {
  if (n >= minimo) return;
  const info = informeDelBarrido();
  throw new Error(
    `🔴 CORPUS VACÍO O CASI (${contexto}): se leyeron ${n} ficheros y el suelo son ${minimo}.\n`
    + '  Esto NO es «no hay defectos»: es que el barrido no está mirando lo que cree. Tolerar\n'
    + '  que un fichero desaparezca (SCRUM-740) no puede convertirse en tolerar un árbol vacío.\n'
    + `  Desaparecidos durante el barrido: ${info.desaparecidos.length}`
    + (info.desaparecidos.length ? '\n    · ' + info.desaparecidos.slice(0, 5).join('\n    · ') : ''),
  );
}

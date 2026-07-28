// tests/_guard-texto.mjs — helper compartido para GUARDS QUE MIRAN TEXTO.
import fs from 'node:fs'; // SCRUM-193: `leerFuente` LEE, no solo filtra
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE (decisión del fundador, 28-jul-2026)
//
// Un guard que busca un literal en un fichero se caza a sí mismo, porque el sitio natural
// donde se escribe ese literal es **el comentario que explica por qué está prohibido**. Pasó
// TRES VECES en una sola sesión, cada una en un ticket distinto:
//
//   · SCRUM-176 — el hook bloqueaba `git commit -m "…nunca ejecutes db push…"`. El guard
//     miraba el JSON entero del tool call, así que casaba la prosa del mensaje.
//   · SCRUM-168 — el test que impedía que volviera `--depth=0` salió rojo contra la CABECERA
//     del propio workflow, donde ese literal aparece para explicar que no se use.
//   · SCRUM-3 — el assert de «el selector no le habla al pagador del fee» casó el «0,9 %» de
//     un comentario que explicaba la decisión del fundador.
//
// La conclusión, y no es casualidad: **escribir el porqué al lado del guard hace que el guard
// se cace a sí mismo.** Cuanto mejor documentas la regla, más te bloquea el mecanismo que la
// defiende — que es literalmente el enunciado de SCRUM-176, repetido a otra escala.
//
// LA REGLA, desde hoy: **un guard de texto mira LÍNEAS EJECUTABLES por defecto, no el
// fichero.** Si de verdad hace falta mirar también los comentarios, se dice en el test y se
// justifica ahí mismo — es la excepción, no el punto de partida.
//
// Y cuando lo que se protege es lo que LEE UN HUMANO (una etiqueta, un microcopy), mejor aún:
// mira los literales que se renderizan, no el fuente. Ver `TEXTOS_AL_CLIENTE` en
// tests/scrum3b-selector-bizum.test.mjs como ejemplo.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el fuente sin las líneas de comentario. Cubre las tres formas que usa este repo:
 * `//` (JS/TS), `#` (YAML/shell) y los bloques `/* … *\/` (JSDoc y cabeceras largas).
 *
 * NO es un parser: no distingue un `//` dentro de un string de un comentario de verdad. Es
 * deliberado — un parser aquí sería más código que lo que vigila, y el caso que importa (el
 * literal escrito en la prosa que explica la prohibición) queda cubierto. Lo que no cubre
 * queda dicho aquí en vez de descubrirse en un rojo raro.
 */
export function soloEjecutable(fuente) {
  const sinBloques = fuente.replace(/\/\*[\s\S]*?\*\//g, '');
  return sinBloques
    .split('\n')
    .filter((l) => !/^\s*(\/\/|#)/.test(l))
    .join('\n');
}

/**
 * SCRUM-193 · LEER UN FICHERO YA FILTRADO. **Este es el camino por defecto.**
 *
 * POR QUÉ HIZO FALTA, aunque la regla y `soloEjecutable` ya existían: mordió una CUARTA vez
 * después de escribirlas. Que una regla exista no basta si no es el camino corto — mientras
 * `fs.readFileSync` sea lo primero que uno teclea, el filtrado depende de acordarse, y
 * acordarse falla. Aquí se invierte la comodidad: leer devuelve YA filtrado, y quedarse con
 * los comentarios exige pedirlo (`{ conComentarios: true }`) y justificarlo donde se pide.
 *
 * No añade capacidad —hace lo mismo que `readFileSync` + `soloEjecutable`—; lo que cambia es
 * cuál de las dos cosas es la fácil de escribir.
 */
export function leerFuente(ruta, { conComentarios = false } = {}) {
  // ⚠️ MARKDOWN NO. En .md el # es un ENCABEZADO, no un comentario: filtrar se comeria la
  // mitad del documento y el guard pasaria a mirar un texto que no existe — verde falso del
  // peor tipo. Se para en vez de adivinar; para leer un .md se pide explicitamente.
  if (/.(md|markdown)$/i.test(ruta) && !conComentarios) {
    throw new Error(
      `leerFuente: ${ruta} es Markdown y ahi el # es un encabezado, no un comentario. ` +
      "Usa leerFuente(ruta, { conComentarios: true }) — en un .md no hay codigo que separar.",
    );
  }
  const texto = fs.readFileSync(ruta, 'utf8');
  return conComentarios ? texto : soloEjecutable(texto);
}

/**
 * Los literales de cadena que aparecen en el fuente — útil cuando lo que se vigila es lo que
 * acaba en pantalla y no el código que lo rodea.
 */
export function literalesDeCadena(fuente) {
  return [...soloEjecutable(fuente).matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)]
    .map((m) => m[1] ?? m[2])
    .filter(Boolean);
}

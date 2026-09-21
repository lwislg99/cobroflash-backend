// tests/_cita-declarada.mjs — SCRUM-921d
//
// UNA CITA DECLARADA DENTRO DE UN BANCO NO AFIRMA, igual que una negación no afirma.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ HACE FALTA
//
// Los censos de firmas de SCRUM-921 miran la FORMA, no la intención: si la forma atribuye una
// aprobación a quien tiene potestad, cuenta como afirmación de autorización. Y un banco que
// documenta ese defecto tiene que ESCRIBIR la forma para enseñarla. Medido el 17-sep-2026 (SCRUM-921c
// bis): una línea de `scrum921c-…` que reproducía entre comillas la marca de `jobRailBlocks.js`
// para ilustrarla entró en el censo de la fase a como la afirmación número 28 y paró el CI. Se
// esquivó con una perífrasis, y eso no escala:
//
//     🔒 Si cada test que documenta el defecto engorda el censo que lo mide, el instrumento se
//        alimenta solo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA, ENTERA
//
//   1. Lo que va entre `[[cita]]` y `[[/cita]]` no se lee: ni afirma, ni niega, ni respalda.
//      El censo juzga su unidad de lectura como si lo citado no estuviera.
//   2. Sólo dentro de un BANCO, que es un fichero bajo `tests/`. En `src/`, `public/`,
//      `scripts/` y `docs/` el delimitador no hace nada y la afirmación se sigue acusando.
//   3. El par abre y cierra DENTRO de la misma unidad de lectura del censo que lo aplica: el
//      bloque contiguo en la fase a, el bloque de comentario en la fase c. Un `[[cita]]` sin su
//      cierre no tapa nada, y nunca se estira al resto del fichero.
//   4. Exacto y en minúscula. `[[CITA]]` o `[cita]` no son el delimitador.
//
// Todo lo que falla, falla ACUSANDO: un delimitador mal puesto deja la línea a la vista y el
// trinquete la nombra. No hay manera de equivocarse en silencio hacia el lado del «pasa».
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ES UNA REGLA DE FORMA Y NO UNA LISTA
//
// No hay ficheros exentos por nombre. «Lo de mi fichero no cuenta» es un agujero con nombre
// propio: exime todo lo que ese fichero diga, también lo que diga en serio. El delimitador exime
// una frase, queda a la vista en el diff, y cualquiera puede usarlo y cualquiera puede verlo.
//
// Y es el MISMO eje que las negaciones, no uno paralelo. La fase c ya decide que una marca
// negada no se acusa porque no afirma; una cita que enseña la forma tampoco afirma. Los dos
// censos aplican esta regla en el mismo punto donde ya deciden si la frase afirma.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO RESUELVE, DICHO AQUÍ
//
// Un delimitador puesto alrededor de una afirmación REAL la esconde. Eso no lo puede impedir una
// regla de forma, igual que la de las negaciones no impide escribir «no» delante de una firma de
// verdad. Lo que sí hace es que esconderla exija escribir `[[cita]]` en un banco, a la vista en
// el diff, y nunca en producción, donde no vale.

export const ABRE = '[[cita]]';
export const CIERRA = '[[/cita]]';
const PAR = /\[\[cita\]\][\s\S]*?\[\[\/cita\]\]/g;

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CANARIO: una cita de verdad, en un banco de verdad, que los dos censos leen.
//
// La línea de abajo es la cita que motivó la regla, y su bloque no lleva ticket ni ruta A
// PROPÓSITO. Si la regla se rompe (si `esBanco` deja de reconocer `tests/`, o `sinCitas` deja
// de borrar), la cita pasa a contar como afirmación sin respaldo y los DOS trinquetes suben en
// uno, nombrando este fichero. Sin canario, la regla sólo se probaría con casos de laboratorio,
// y un control que sólo corre fuera del árbol no controla el árbol.
//
// ⛔ No le añadas un ticket ni una ruta: dejaría de ser canario, porque la cobaya se exculparía
// sola. Hay un test que lo comprueba.

// [[cita]] Rótulos APROBADOS por el fundador (regla 30): CLIENTE · DÓNDE · DINERO [[/cita]]
export function esBanco(fichero) {
  return /^tests\//.test(String(fichero).replace(/\\/g, '/'));
}

/**
 * La unidad de lectura con lo citado borrado. Cada carácter del par, delimitadores incluidos,
 * pasa a espacio, y los saltos de línea se conservan: la línea N sigue siendo la línea N y
 * ninguna posición se mueve.
 *
 * Sin un par completo devuelve EL MISMO texto. Es lo que garantiza que un fichero sin
 * delimitador se juzgue exactamente igual que antes de esta regla, y hay un test que lo
 * comprueba sobre el árbol entero, fichero a fichero.
 */
export function sinCitas(texto) {
  return String(texto).replace(PAR, (m) => m.replace(/[^\n]/g, ' '));
}

/** Lo que un censo LEE de `texto` en `fichero`: sin lo citado si es un banco, entero si no. */
export function loQueSeLee(texto, fichero) {
  return esBanco(fichero) ? sinCitas(texto) : texto;
}

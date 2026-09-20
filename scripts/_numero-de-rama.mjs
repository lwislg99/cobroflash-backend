// scripts/_numero-de-rama.mjs — SCRUM-829
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL NÚMERO DE TICKET DE UN NOMBRE DE RAMA. UNA SOLA REGLA, Y EN UN SITIO.
//
// ── EL DEFECTO, medido el 8-sep-2026 ────────────────────────────────────────────────────────
// `revert-1192-scrum-824b-el-vigia-que-no-deja-pasar` —un nombre que GENERA GITHUB SOLO al pulsar
// «Revert» en un PR— recibía DOS respuestas dentro del mismo censo:
//
//     agruparRamas  (con `numeroDeClave`, /SCRUM-(\d+)/i)   →  824
//     poblacionDe   (con `numeroDeRama`,  anclada)          →  null
//
// Tres sesiones lo reportaron el mismo día por separado. No era una rama rara: era una FORMA de
// nombre que el instrumento no sabía leer, y que va a aparecer MÁS, no menos, ahora que
// `pr-automatico.yml` abre los PR solos.
//
// ── 🔴 LA CAUSA: UN LECTOR DE CLAVES APLICADO A UN NOMBRE DE RAMA ───────────────────────────
// `numeroDeClave` existe para leer una CLAVE DE JIRA (`SCRUM-304`), donde buscar la subcadena es
// lo correcto porque la cadena entera ES la clave. Aplicado a un nombre de rama —texto libre que
// escribe una persona, o GitHub— la subcadena encuentra `scrum-824` EN MEDIO de otra cosa y
// contesta con aplomo. Es el mismo error que casa `con iva` dentro de `sin iva`: el emparejador
// no está mal, está aplicado a la pregunta equivocada.
//
// 🔒 Un lector de claves y un lector de nombres no son el mismo lector aunque acierten en los
// casos fáciles. Los casos fáciles son justo donde no se nota.
//
// ── LA DECISIÓN (SCRUM-829) ─────────────────────────────────────────────────────────────────
// ① GANA LA ANCLADA. Esta es la de SCRUM-738, movida aquí sin tocarle ni un carácter al patrón.
// ② UN `revert-…` SE DECLARA «SIN TICKET» (`null`), no se resuelve al ticket revertido. Motivo:
//    una rama de revert **no es trabajo del ticket, es su deshacer**. Atribuírsela haría que el
//    censo dijera «SCRUM-824 tiene rama viva» cuando lo que hay es la marcha atrás de SCRUM-824 —
//    peor que no decir nada, porque parece un dato. Y `agruparRamas` ya promete por escrito que
//    las que no llevan número van a `sinNumero` y **no se descartan en silencio**.
//
// ── POR QUÉ ESTE FICHERO EXISTE, Y NO VIVE EN NINGUNO DE LOS DOS ────────────────────────────
// 🔴 Es una HOJA: no importa nada. `censo-tablero-vs-arbol.mjs` ya documenta un ciclo de imports
// que hoy es benigno (`_rastro-del-ticket` → `_censo-alcanzabilidad` → `censo-tablero-vs-arbol`),
// y `_censo-reparto.mjs` está DENTRO de ese ciclo. Si `_censo-reparto` importara la regla de
// `censo-tablero-vs-arbol`, lo cerraría de verdad. La alternativa —copiar el patrón a un segundo
// sitio— es la que produjo este ticket.
//
// ── IMPACTO MEDIDO ANTES DE CAMBIARLO ───────────────────────────────────────────────────────
// Sobre las 104 ramas del remoto + las refs locales + el literal del ticket (106 nombres) el
// 8-sep-2026: **cambia de número exactamente 1**, el `revert-…`, de 824 a `null`. Ninguna rama
// legítima se mueve, así que esto no reparte ningún trabajo de otra manera.

/**
 * El número de ticket de un NOMBRE DE RAMA, o `null` si el nombre no es de un ticket.
 *
 * ⛔ ANCLADO Y CON DELIMITADOR, y las dos cosas hacen falta:
 *   · anclado (`^`) → `revert-1192-scrum-824b-…` da `null`, no 824. Un `scrum-` en medio de un
 *     nombre no dice que la rama sea de ese ticket.
 *   · con delimitador (`-` o FIN DEL NOMBRE) → `scrum-72-x` da 72 y `scrum-727-x` da 727, no 72.
 *   · la letra opcional es una FASE del mismo ticket: `scrum-684b-…` da 684, no otro número.
 *   · y la fase puede llevar CORTE: `scrum-915e1-…` da 915. La letra es la fase, los dígitos que
 *     la siguen son el corte dentro de ella.
 *
 * 🔴 SCRUM-804h (20-sep-2026) · LA FASE PUEDE LLEVAR NÚMERO DETRÁS. `main` volvió a quedarse con
 * su check obligatorio en rojo (run 35533496437, `soloEnGit: [ 'scrum-915e1-documento-vivo' ]`) y
 * con seis PR sin poder mergear: la partición de SCRUM-915 en siete cortes nombra sus ramas
 * `scrum-915e1-…`, `scrum-915e2-…`, y aquí la fase era UN SOLO carácter. Es el MISMO borde que
 * cerró 804f tres días antes, en esta misma línea, y se cierra igual —en la regla, no renombrando
 * la rama— por el motivo que 804f dejó escrito: la siguiente rama con esa forma lo traería otra vez.
 *
 * ⛔ Se ensancharon los DÍGITOS, no la letra. `[a-z]+` también habría arreglado `915e1` y habría
 * roto una decisión de 804f que nadie pidió relajar: `scrum-72bb → null`, «dos letras no son una
 * fase». Con `[a-z]?\d*` las cuatro afirmaciones de identidad de 804f siguen intactas.
 *
 * 🔴 Y NO RE-ATRIBUYE A NADIE, por construcción: `0*` come los ceros y `\d+` es voraz, así que el
 * grupo 1 se lleva la tirada ENTERA de dígitos. Partirla dejaría al `\d*` delante de un dígito,
 * que no es `-` ni fin, así que ninguna partición alternativa casa. Ensanchar el sufijo sólo puede
 * convertir un `null` en ESE MISMO número, nunca un número en otro. Medido igualmente sobre los
 * refs del 20-sep en `tests/scrum804h-la-fase-con-corte.test.mjs`: 0 re-atribuidas.
 *
 * 🔴 SCRUM-804f (17-sep-2026) · EL FIN DEL NOMBRE TAMBIÉN DELIMITA. Hasta hoy el delimitador era
 * SÓLO el `-`, y una rama sin slug (`scrum-904`, PR #1423) salía `null`: el censo decía SIN RASTRO
 * de un ticket con rama viva, el control de SCRUM-804 —que sí la da por canónica— se puso rojo, y
 * con él el check obligatorio de `main` para todos los PR. El `-` existía para que `scrum-72` no
 * casara con el principio de `scrum-727-x`, y eso lo garantiza igual `$`: `\d+` es voraz. Medido
 * sobre los 831 nombres de rama del 17-sep: cambia de número exactamente 1, `scrum-904`.
 *
 * ⚠️ NO sirve para leer una clave de Jira. Para eso está `numeroDeClave`, y son preguntas
 * distintas: ahí la cadena entera ES la clave; aquí es texto libre que rodea a la clave.
 */
export function numeroDeRama(nombre) {
  const m = /^scrum-0*(\d+)[a-z]?\d*(?:-|$)/.exec(String(nombre ?? '').trim());
  return m ? Number(m[1]) : null;
}

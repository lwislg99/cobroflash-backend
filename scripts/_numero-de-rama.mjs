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
 *   · con delimitador (`-` final) → `scrum-72-x` da 72 y `scrum-727-x` da 727, no 72.
 *   · la letra opcional es una FASE del mismo ticket: `scrum-684b-…` da 684, no otro número.
 *
 * ⚠️ NO sirve para leer una clave de Jira. Para eso está `numeroDeClave`, y son preguntas
 * distintas: ahí la cadena entera ES la clave; aquí es texto libre que rodea a la clave.
 */
export function numeroDeRama(nombre) {
  const m = /^scrum-0*(\d+)[a-z]?-/.exec(String(nombre ?? '').trim());
  return m ? Number(m[1]) : null;
}

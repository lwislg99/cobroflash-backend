# SCRUM-1537 · Los dos cotejos de la Parte L: el límite de la flecha existía y se quitó; el del literal se declara

**Medido contra:** `origin/main` = `254a697924c99bdf85eb06c95ee439a4a013aa67` · 2026-10-13T12:06:04Z (hora de GitHub)

A9: comprobación → `tests/scrum1537-los-dos-cotejos.test.mjs`

Sesión `jv-j6h`, puesto J6. La entrega entera, con sus tablas y lo que NO se midió, está en Jira:
SCRUM-1537, comentario 19364. Aquí va lo que hace falta sin abrir Jira.

## En corto

- **④ No hay tercer cotejo.** `grep -i cotejo` en `scripts/`, `tests/` y `src/` da 8 ficheros; en los 47
  `tests/_censo-*`, 0. Sólo `cotejo.cjs` y `cotejo-once.cjs` leen la Parte L.
- **① El límite de la flecha de `cotejo-once.cjs` EXISTÍA**, medido con valores sembrados en memoria sobre
  los 7 campos que lee en modo flechas: sin flecha, visto en 0 de 7; con flecha, en 7 de 7.
- **③ `cotejo-once.cjs` está al día y no se retira:** su población son los 11 estados que `cotejo.cjs`
  nombra y no coteja. Ahora lee los valores sin flecha, sus positivos son sembrados y coteja
  `Merchant.status` y `EmailMessage.status`. Sobre `main` pasó de EXIT=2 («INSTRUMENTO NO FIABLE» desde
  el merge de SCRUM-1529c, porque su positivo era un defecto del árbol que ese día se arregló) a EXIT=0.
- **② El límite del literal de `cotejo.cjs` se DECLARA** (`LIMITE_DEL_LITERAL`, con motivo, quién lo
  retira y prueba). De 8 formas de escribir sembradas ve 3, avisa de 2 y calla ante 3. Las 2 de las que
  avisa pasan a ser hallazgo (`ESCRITURA_SIN_LEER`) en los campos sin cierre, que son 3 de 19.

## Lo que queda nombrado y no se tocó

Son decisiones de estado o del esquema, no de este ticket: `Merchant.subscriptionStatus` (el máster manda
`trial` y `expired` sin fuente en el código), `Charge.status` (`cancelled`, decisión ⑥b), el comentario de
`WhatsAppMessage.status` en el esquema (no nombra `received`) y `VfSubmission.status` (sin máquina).

## Lo que no se midió

La tanda completa; si alguna de las 4 escrituras opacas sobre los delegados de los 3 campos sin cierre
escribe de verdad el campo; las transiciones; y un valor del máster sin flecha escrito con más de una
palabra entre las comillas, que `cotejo-once.cjs` cuenta como «sin leer» y no coteja.

## Errores propios

- Crucé los 200k de contexto sin avisar en el punto: medí a 131k y la medida siguiente fue 232k.
- Declaré dos veces `sinLeer` dentro de `juzgar`: el instrumento no cargaba y cayeron los 20 casos. Lo
  cazó la primera pasada del test, antes de cualquier commit con ese cambio.
- Un parche de `siembra-literal.cjs` lanzado por consola falló a medias y la medición corrió con la
  versión anterior; rehecho con la herramienta de edición y vuelto a correr.

## Cómo se repite

    node docs/master/evidencias/SCRUM-1537/siembra-once.cjs
    node docs/master/evidencias/SCRUM-1537/siembra-literal.cjs
    node docs/master/evidencias/SCRUM-1537/escrituras-opacas.cjs
    node docs/master/evidencias/scrum1500c/cotejo-once.cjs
    node --test tests/scrum1537-los-dos-cotejos.test.mjs

Las salidas `*-ANTES.txt` de esa carpeta son del instrumento sin tocar, sobre `254a69792`.

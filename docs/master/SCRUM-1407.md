# SCRUM-1407 · CRUCE DE CARRIL (`area-j2`, lo hace J5b) · El registro de SCRUM-1397 se pone al día con un anexo fechado

**Medido contra:** `origin/main` = `bbe633acb852b1aaca413df4c5ebef76f1291e6c` · 2026-10-02T03:15:20Z

2-oct-2026 · **J5b** (puesto J5, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
El trabajo es de `area-j2`: J2b había parado por contexto y el orquestador lo repartió fuera de carril,
declarándolo en el ticket.

A9: aviso → A10 «Un dato copiado de un registro lleva la fecha en que se midió, no la de hoy.» — no se pudo comprobar: que un registro se quedó viejo al mergear su rama sólo lo vería un guard nuevo, y este ticket es de sólo `docs/`.

## Ⓐ Qué se toca

Dos ficheros, los dos de `docs/master/`:

- `docs/master/SCRUM-1397.md`: una marca al final del párrafo «SIN CORRER al empujar» (añadida al final
  de una línea que ya existía: ninguna línea se mueve) y la sección «Anexo de SCRUM-1407», al final.
- Este registro.

Nada de `src/`, `tests/`, `prisma/` ni workflows. `docs/YAQU_MASTER.md` no se toca. Del registro de
SCRUM-1397 no se ha borrado ni reescrito ninguna frase.

## Ⓑ La premisa del ticket, medida antes de escribir

El ticket nació diciendo que el registro de SCRUM-1397 afirmaba que el banco de mutaciones nunca corrió.
Leído el fichero entero en `origin/main`, eso era verdad a medias:

- El párrafo de J2a («SIN CORRER al empujar») dice que el banco estaba «sin ejecutar ni una vez».
- Unas líneas más abajo, el tramo «Lo corrido después, por J2b» ya recogía el primer 18 de 18, y avisaba
  de que lo de arriba «se queda como lo dejó: dice cómo estaba al empujar».

Quien leyera sólo el primer párrafo se equivocaba; quien leyera el tramo siguiente, no. Lo que el
registro NO recogía, y es lo que el anexo añade, eran tres cosas: la repetición del banco sobre
`9e47c9f9`, que los cinco rojos se arreglaron, y que el ticket entró en `main`. Se lo dije al orquestador
antes de escribir y reescribió el ticket.

## Ⓒ De dónde sale cada dato del anexo

| dato | quién lo midió | dónde |
|---|---|---|
| el merge de #2121, su hora y sus dos sha | yo | `gh pr view 2121` |
| qué commit sirve producción | yo | `https://yaqu.app/version`, cabecera `Date` 03:13:40 GMT |
| `9e47c9f9` toca dos ficheros de `tests/` | yo | `git show --stat` |
| conclusión y horas del obligatorio sobre `9e47c9f9` | yo | `gh run view 36957895689` |
| ese obligatorio leído por nombre, y sus `ausentes=17` | J2b | SCRUM-1397 comentario 18025 |
| el banco repetido, 18 de 18, contra PGlite | J2b | SCRUM-1397 comentario 18025 |
| quién aplicó el arreglo y la respuesta literal de Javier | el orquestador | SCRUM-1397 comentario 18026, y el mensaje del commit |
| 1.050 de 1.050 y 900 de 900 por las otras puertas | J2a | el propio registro, sección Ⓒ |

Lo que yo NO he hecho: repetir el banco (muta `src/`), leer por nombre el obligatorio de `9e47c9f9`, ni
ver nada en `yaqu.app` con sesión de Técnico.

## Ⓓ Lo que pregunté antes de escribir, y por qué

El encargo decía que el arreglo se aplicó «con el fundador decidiendo entre las dos vías». Eso vivía sólo
en el canal entre sesiones, y una atribución así en `docs/` sin sitio donde leerla es justo lo que vigila
`tests/scrum921-firmas-con-respaldo.test.mjs`. Pregunté dónde constaba. No constaba: el orquestador lo
publicó entonces (SCRUM-1397 comentario 18026), con el literal, que además dice otra cosa que el
encargo: la respuesta fue «El que consideres mejor», o sea que se delegó la elección. El anexo cita el
literal y el comentario.

## Ⓔ Lo que me salió mal

- **Un control positivo que no medía.** Al coger el ticket comprobé que no hubiera rama remota
  `scrum-1407*` y puse de control `scrum-1342*`, que dio 0: esa rama ya estaba borrada tras su merge. Un
  control que da 0 no dice que la búsqueda vea. Repetido contando todas las cabezas remotas (155) al
  lado del 0 de `scrum-1407*`.
- **La «hora de GitHub» de mi primera entrega de hoy no se leyó.** Pedí `/rate_limit` desde Git Bash, que
  reescribe la barra inicial como ruta de Windows; el fallo iba a un `2>/dev/null` y la línea salió
  vacía. Las horas que di entonces venían de los campos de la API de GitHub (`createdAt`, `mergedAt`), no
  de esa llamada. Aquí va sin la barra, y el ancla sale de `node scripts/equipo/ancla.mjs`.

## Ⓕ Lo corrido

Ficheros sueltos, uno a uno, con 4.998 MB libres al empezar. Ninguna tanda, ningún proceso muerto.

| qué | resultado |
|---|---|
| `scrum267`, `scrum1294`, `scrum525d` (los tres que pide el ticket) | 26 tests · 26 pasan · 0 saltan |
| `scrum859`, `scrum1306`, los dos `scrum514`, `scrum921`, `scrum921c`, `scrum237`, `scrum976`, `scrum710b`, `scrum534d` | 104 tests · 104 pasan · 0 saltan |
| `npm run guards:entrada` | 12 guards · 132 tests · verde en 10,8 s |

Al guard de la A9 se le preguntó además por estos dos registros, por su propia función: ve 2 anclas en
el de SCRUM-1397 y 1 en éste, las tres bajo norma. Quitando la línea `A9:` nueva da 1 fallo en cada
fichero, y cambiando una palabra de la frase de A10, también 1. O sea, que el verde es de un guard que
mira estas líneas.

Que no se ha movido ninguna línea del registro de SCRUM-1397: el diff tiene dos tramos, uno que cambia
la línea 217 por sí misma y otro que añade 80 líneas después de la 301.

NO corrido: la tanda dirigida, la completa y el build (no cambia ni `src/` ni `tests/`). El juez es el
obligatorio del CI, que no he leído: lo lee el orquestador.

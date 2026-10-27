# SCRUM-1628 · `carriles.mjs de tests/*` decía «nadie lo reclama» para cualquier test

## S0 · SCRUM-1628 · el test de un ticket sale NO-PUDE-MIRAR, con la regla y dónde mirar

**Medido contra:** `origin/main` = `0fc4e30b8ff8c2ed2ed688fc16bb8d6f4e957cfb` · 2026-10-27T18:28:49Z (hora de GitHub, cabecera `Date:`; S0, por encargo del orquestador de Luis. Al cerrar, main iba 7 commits por delante, `aaad2d7eb`, ninguno en estos ficheros)
A9: comprobación → `tests/scrum1628-de-ve-la-regla-del-test-de-un-ticket.test.mjs`

**El defecto, reproducido antes de tocar nada:** `node scripts/carriles.mjs de tests/scrum1621-latido-vigia-de-main-y-tanda.test.mjs`
→ «sin fila en §3: nadie lo reclama», con salida 0. `dos-equipos.md:171` («`tests/`: el test de un ticket» → «el
puesto que trabaja el ticket») no produce regla: `_carriles.mjs` sólo convierte RUTAS, y esa fila no tiene ninguna
detrás del «`tests/`:». El instrumento no la veía y contestaba como si no existiera.

**La elección: la ② del ticket (distinguir), no la ① (aplicar la regla).** El dueño que da `:171` es el puesto que
trabaja el ticket, y eso es la etiqueta `area-…` de Jira, que la tabla no tiene y el instrumento no lee (tampoco la
cerradura, que lee `.claude/carriles.json` sin red). Sacarlo del nombre, del autor de git o de la cabecera del
registro es justo lo que la propia tabla descarta («No se reparte por el nombre […] ni por quién lo tocó», §3.3).
Aplicar la ① sin Jira sería inventar el dueño. Así que `de` dice lo que sabe y lo que no:

    tests/scrum1621-… → NO-PUDE-MIRAR: sin fila de ruta, pero es el test de SCRUM-1621, y docs/equipo/dos-equipos.md:171
    («el test de un ticket» → el puesto que trabaja el ticket) lo da al puesto que trabaja ese ticket. Cuál es no está
    en la tabla: es la etiqueta area-… de SCRUM-1621 en Jira. NO quiere decir «nadie lo reclama».

con **salida 2** (la de NO-PUDE-MIRAR del propio script) si alguna de las rutas preguntadas cae ahí.

**Lo construido:**
- `scripts/_carriles.mjs`: `filasSinRuta(texto)` (las filas «directorio: descripción» sin ruta) y
  `testDeTicket(rel, texto)` (un `tests/scrumNNN…` + la fila «el test de un ticket», buscada por su texto). Sin esa
  fila en la tabla devuelve `null`: no inventa una regla que la tabla ya no dice.
- `scripts/carriles.mjs de`: la línea nueva y la salida 2. Una ruta con fila sigue contestando su fila (gana la fila).
- Lo generado (`carriles.json`, `rules/`) NO cambia: `carriles.mjs comprobar` → IGUAL a la tabla.

**Medido sobre todo el repo** (7791 ficheros, `de` de `origin/main` contra el de la rama, en lotes de 150; driver de un
solo uso, fuera del árbol):

| población | ficheros | resultado |
|---|---|---|
| fuera de `tests/` | 6007 | 6007 iguales, **0 distintos** (control negativo) |
| `tests/` con fila de ruta | 13 | iguales |
| `tests/` sin fila y sin número de ticket en el nombre | 257 | iguales: siguen «nadie lo reclama» (control positivo) |
| `tests/scrumNNN…` sin fila | 1514 | pasan de «nadie lo reclama» a NO-PUDE-MIRAR con su ticket |
| otro cambio | 0 | — |

**El test, visto en rojo** (commit del arreglo `64d4dc8b3da06ab899f68ce96fa37c0a5318fb78` ANTES de inyectar; cada
inyección se apartó commiteándola en una cabeza suelta y volviendo a ese commit, sin `restore`):
1. `scripts/carriles.mjs` de `origin/main` (el defecto) → cae «el rojo de partida» (6/7).
2. «todo test tiene dueño» (`testDeTicket` casa cualquier `tests/…`) → caen el CONTROL POSITIVO y el censo (5/7).
3. la regla sin anclar a `tests/` en el nombre → cae sólo el censo: el prefijo de la fila sigue protegiendo lo de fuera.
   Con el prefijo quitado también → cae además el CONTROL NEGATIVO (5/7).
Sin inyectar: 7/7, y con `scrum1295`, `1295b`, `1480e`, `1480f`, 26/26.

**Guards dirigidos:** 700, 719, 850, 1349, 710b, 824, 836, 419, 702, 237, 976, 1415, 1387, 1185, 411, 812, 273 →
214 de 215. Cae `scrum836` porque este árbol no tiene `dist/` (sus anclas apuntan a `dist/…/pdf.service.js`): es del
entorno, no de esta rama. Suite entera: NO CORRIDA.

**Aceptación 4, los tres ficheros que la S0 dejó «sin dueño» (1480i), revisados con la regla:**

| fichero | ¿lo cubre `:171`? | lectura |
|---|---|---|
| `tests/_salida-entera.mjs` | no: es un ayudante, no el test de un ticket | hueco REAL de la tabla |
| `tests/scrum1610b-salida-cortada-sale-ciega.test.mjs` | sí: SCRUM-1610, con `area-j6` | artefacto del instrumento: era J6 por la regla |
| `tests/scrum765-la-puerta-y-el-suelo.test.mjs` | sí, pero SCRUM-765 no lleva etiqueta de área | la regla calla: hueco real |

Desde SCRUM-1610 c.21189 los tres tienen fila de J6 (SCRUM-1610c, rama aparte), así que ya no queda pregunta para
Javier.

**Lo que esto NO arregla, y se dice:** los 52 ficheros de `tests/banco-scrumNNN/` (15 directorios) llevan número de ticket en el nombre
del DIRECTORIO, no del fichero, y siguen «nadie lo reclama». La fila `:169` da a S3 «bancos e instrumentos», pero su
patrón es sólo `_banco-*`. Es una pregunta de la tabla (¿de S3 o del ticket?), no de este instrumento, y no la
decide esta rama.

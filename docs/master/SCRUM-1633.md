# SCRUM-1633 · `carriles.mjs de` afirmaba el dueño de ficheros que no existen

## S0 · SCRUM-1633 · una ruta que no existe sale NO-PUDE-MIRAR, sin nombrar puesto

**Medido contra:** `origin/main` = `eafca9fe1` · 2026-10-29T17:34:19Z (hora de GitHub, cabecera `Date:`; S0, por encargo del orquestador de Luis)
A9: comprobación → `tests/scrum1633-de-dice-si-la-ruta-no-existe.test.mjs`

**El defecto, reproducido antes de tocar nada** (los dos primeros los midió S3 a las ~10:25Z; S0 los repitió a las 17:3xZ):

| ruta (NO existe) | contestaba | salida |
|---|---|---|
| `public/dashboard/js/inventado-xyz-1630.js` | `S2 (puesto) · dos-equipos.md:152` | 0 |
| `zzz-inventado/no-existe-1630.txt` | `sin fila en §3: nadie lo reclama` | 0 |
| `public/dashboard/js/jobsVieww.js` (errata de `jobsView.js`, que es de **S4**) | `S2 (puesto)` | 0 |
| `src/modules/fiscal/nada-inventado.ts` | `J1 (puesto) · dos-equipos.md:117` | 0 |
| `tests/no-existe-scrum1295.test.mjs` | `sin fila en §3: nadie lo reclama` | 0 |

La causa: `de` sólo casaba la ruta contra los patrones de la tabla, y un patrón (`public/**`) casa igual con una
ruta mal escrita. No miraba si el fichero existía.

### Qué cambia

- `scripts/carriles.mjs`: la respuesta por ruta sale de `respuestaDe(rel, { mapa, tabla, existe, nueva })`, exportada.
  Una ruta que no está en `git ls-files` **ni** en disco contesta
  `NO-PUDE-MIRAR: esa ruta no existe (ni en git ls-files ni en disco). ¿Una errata? No digo de quién sería: si la vas a CREAR, node scripts/carriles.mjs de --nueva <ruta>.`
  y deja la salida en **2**. No nombra ningún puesto.
- `de --nueva <ruta>`: para quien va a crear el fichero. Contesta lo que diría la tabla, con la marca
  `RUTA NUEVA (hoy no existe) · ` en la misma línea. Sobre un fichero que sí existe, `--nueva` no cambia nada.
- Un fichero que existe en disco y aún no está en git (el que se está escribiendo) contesta normal.

**Cambios en tests que ya existían, y por qué no relajan nada:** dos tests daban como bueno el defecto que este
ticket quita, porque preguntaban por rutas que no existen esperando un dueño:
- `tests/scrum1628-…`: `tests/_un-ayudante-que-no-existe-1628.mjs` esperaba «nadie lo reclama» con 0. Ahora se
  pregunta con `--nueva` y se exige la marca `RUTA NUEVA`. El huérfano que sí existe sigue igual.
- `tests/scrum1480e-…`: `scripts/__un-script-que-nace-hoy__.mjs` (un script que «nace hoy») esperaba `SIN CERRADURA`
  y el aviso de la fila general. Ahora se pregunta con `--nueva`; el aviso y su criterio se exigen igual.
- `tests/scrum1295b-…` pedía `uso: de <ruta>` en el mensaje de uso: el mensaje nuevo lo sigue diciendo literal.

### Aceptación → dónde se ve

| aceptación (literal, abreviada) | dónde se ve |
|---|---|
| 1. `de public/dashboard/js/inventado-xyz-1630.js` deja de contestar «S2» | `tests/scrum1633-…`, «una ruta que no existe sale NO-PUDE-MIRAR con salida 2, y no nombra ningún puesto» |
| 2. `de zzz-inventado/no-existe-1630.txt` deja de contestar «nadie lo reclama» | el mismo caso |
| 3. CONTROL POSITIVO: `settingsView.js` sigue dando J3 (contenedor) con su fila, y los demás reales no cambian | `tests/scrum1633-…`, «CONTROL POSITIVO» y «muestra de todo el repo POR LA CLI» (1 de cada 40 ficheros, ~197, cada uno con su fila) |
| 4. CONTROL del huérfano de verdad: existe, sin fila, sigue huérfano y distinto de «no existe» | `tests/scrum1633-…`, «CONTROL del huérfano de verdad» |
| 5. Los tests de carriles siguen en verde | 5 ficheros (`scrum1633`, `scrum1628`, `scrum1295b`, `scrum1480e`, `scrum1295-carriles`): **30 de 30**, 0 fail, 0 skipped |

### Cómo se midió

- **Rojo antes del arreglo**, con el test commiteado y `respuestaDe` extraída sin cambio de comportamiento
  (`4154530e0880072924daae274d65fb65ff1623d8`): 21 tests, **4 fail**, los cuatro de 1633 que miden el comportamiento
  (no existe → 2; varias rutas; `--nueva`; fichero en disco). Los de control pasaban ya, como deben.
- **Verde con el arreglo:** 30 de 30 en los cinco ficheros de carriles.
- El primer censo que escribí recorría el repo entero con `respuestaDe` (18 s) y era una tautología: la existencia
  salía de la misma lista que recorría. Lo quité; la muestra por la CLI mide lo que puede fallar (la ruta tecleada
  normalizada a la del repo).

### Hermano: SCRUM-1628

Mirados juntos, como pedía el encargo: **no es la misma causa.** 1628 era una REGLA de la tabla que el instrumento no
sabía leer (el test de un ticket), y ya está en `main` (#2977, #2980). 1633 es que no miraba si la ruta existía. Lo
que comparten es la familia: los dos contestaban algo con salida 0 donde no sabían.

### Lo que NO se ha hecho

- `dos-equipos.md` §3.3 («Cómo nace la fila de un fichero de scripts/») no nombra `--nueva`. No lo toco aquí: el propio
  mensaje de `de` lo dice en el momento en que se pregunta, que es el camino por defecto.

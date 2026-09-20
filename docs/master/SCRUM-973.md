# SCRUM-973 · el PR nacía llamándose «Merge remote-tracking branch…»

**Fecha:** 20-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b` · 2026-09-20T20:17:42Z (GitHub)
**Rama:** `scrum-973-titulo-del-pr` · **Worktree:** `wt-973`

Expediente CORTO: arreglo de una línea del bucle de CI, sin dinero, sin fiscal y sin schema (norma
de la tanda del 20-sep, «rigor proporcional al cambio»).

## ① El defecto, con población

`.github/workflows/pr-automatico.yml` titulaba el PR con **`git log -1 --pretty=%s`**: el **último**
commit de la rama. Y el último commit de una rama viva suele ser el **merge de `main`** que hay que
hacer antes de empujar (regla de la casa: mergear, nunca rebasar).

Medido el 20-sep-2026 sobre los **100 últimos PR del repositorio**: **10 salieron titulados
«Merge remote-tracking branch 'origin/main' into scrum-…»** y alguien fue a renombrarlos a mano.

    #1546  20-sep   #1539  20-sep   #1521  18-sep   #1505  18-sep   #1503  18-sep
    #1502  18-sep   #1497  18-sep   #1495  18-sep   #1463  17-sep   #1462  17-sep

Tres seguidos el 18-sep. No es un caso raro: es lo que pasa siempre que una rama vive más de unas
horas, que aquí son casi todas.

## ② Lo hecho

    TITULO="$(git log --reverse --no-merges --pretty=%s origin/main..HEAD | head -n 1)"
    if [ -z "$TITULO" ]; then TITULO="$RAMA"; …aviso… ; fi

El **primer commit propio** de la rama es el que dice de qué va el trabajo, y es el mismo que ya
encabeza la lista del cuerpo del PR —que se compone con `--reverse` justo por eso—. Los merges se
saltan: un merge nunca describe el trabajo, sólo dice que se trajo `main`.

**SUELO:** si por delante de `main` **sólo hay merges** (la rama rehecha, cuyo commit propio ya
entró por otra vía), no hay nada que citar y se usa el **nombre de la rama**, que dice más que
«Merge remote-tracking branch…», con un `::warning` para que conste. Lo que **no** se hace es
volver a `git log -1`: eso es exactamente el defecto.

### ⚠️ Y un hueco que se cierra de paso, en la misma línea

El workflow ya comprobaba que **el cuerpo** del PR no llevara la mención que despierta a Claude,
porque el cuerpo lo compone `git log` — texto que escribe otra persona. **El título sale de la
misma fuente y no se comprobaba.** Un commit titulado con la mención abría un PR que despertaba a
una sesión que nadie llamó, por la puerta del título. Ahora el espejo mira **título y cuerpo**.
Va aquí y no en un ticket aparte porque es **la misma línea que este arreglo toca** (norma de la
tanda: no abrir un ticket por cada hallazgo).

## ③ El rojo, y se verificó fallando

`tests/scrum973-titulo-del-pr.test.mjs` fabrica un repositorio de verdad en el temporal del SISTEMA
(SCRUM-824) con **la forma exacta del caso** —un commit propio y encima el merge de `main`— y corre
**el mismo comando de git que lleva el workflow, leído del propio fichero**. Si alguien cambia esa
línea, el test corre la línea nueva: no hay dos copias que puedan divergir.

    contra el pr-automatico.yml de origin/main:   7 tests · 3 pass · 4 fail
    con el arreglo:                               7 tests · 7 pass · 0 fail

Los cuatro que caen son los que tienen que caer: el verde del comando, el control negativo, el
suelo y el espejo del título.

⚠️ **Un test que sólo mirara el texto del YAML** diría que todo está bien con un comando que no
hace lo que promete — y ése es justo el error que trajo este ticket.

## ④ Los controles

- **POSITIVO / NEGATIVO:** ganar el caso del merge no puede perder el caso de todos los días. Con
  una rama **sin** merge encima, el título sigue siendo el commit propio (ahí el mecanismo viejo y
  el nuevo coinciden, y **por eso este caso nunca avisó**).
- **SUELO del banco:** antes de juzgar nada, el test comprueba que su repositorio fabricado
  reproduce el caso (el último commit **es** el merge, y hay 2 commits por delante de `main`). Un
  banco que no monta el caso da un verde que no vale.
- **CONTROL POR EFECTO, y es el bueno:** en un `push`, GitHub ejecuta el workflow **de la rama
  empujada**. Así que este PR lo abre el bot con **esta** versión, y su título dice qué lógica
  corrió: los commits de la rama son `[el arreglo, el expediente]`, distintos entre sí a propósito.
  Con el mecanismo viejo el PR se llamaría **«SCRUM-973: expediente…»**; con el nuevo, **«SCRUM-973:
  el título del PR sale del primer commit propio…»**. Predicción escrita **antes** de empujar.

## ⑤ Lo que NO se ha tocado, y una cosa que NO me toca

- No se toca el cuerpo del PR, ni el armado del auto-merge, ni el clasificador de SCRUM-828, ni la
  puerta de SCRUM-839e («sólo una persona abre PR»).
- Nada de `src/` ni `public/` (S5 no toca producto).
- 🔴 **La norma NO la escribo yo.** El ticket pide dejar escrito que en este repositorio **el PR lo
  abre el bot y `gh pr create` rebota con «already exists»** — lo que hay que hacer es **editarle el
  cuerpo al PR que ya existe** (`gh pr edit <n> --body-file`). Pero `docs/equipo/00-normas-comunes.md`
  **tiene un solo dueño, la Sesión 0**, y su propia cabecera dice que quien descubra una norma «la
  escribe en SU informe y se la reporta a la Sesión 0» — con el motivo medido de que cuatro manos en
  ese fichero dieron el PR #1214 y tres tickets parados. Así que el texto va aquí, listo para que lo
  pegue su dueña:

  > **A—· El PR lo abre el bot, no tú.** Al empujar una rama, `pr-automatico.yml` abre el PR y le
  > arma el auto-merge. `gh pr create` rebota con «a pull request for branch … already exists», que
  > **no es un error tuyo**: lo que se hace es **editarle el cuerpo y el título al PR que ya
  > existe** (`gh pr edit <n> --title … --body-file …`). Si empujas y creas el PR muy seguido, sí te
  > deja crearlo a ti y el bot le arma el auto-merge después. Desde SCRUM-973 el título lo pone con
  > el **primer commit propio** de la rama, no con el último.

  Lo descubrió sola cada sesión que lo pisó: a mí me pasó hoy con el PR #1540 y, según el
  orquestador, a otras dos el mismo día.

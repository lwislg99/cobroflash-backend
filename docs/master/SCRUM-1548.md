# SCRUM-1548 ① · El guard del catálogo decía VERDE donde el primer padre de HEAD no es main: ahora dice CIEGO

**Medido contra:** `origin/main` = `82a61cd7c05c0f3ab4cbdf4aff55076d3b337822` · 2026-10-14T03:05:28Z

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`

Sesión `jv-j6e`, puesto J6, lanzada por el orquestador del equipo de Javier (`cobroflash-backend-2e`).
Etiquetas del ticket leídas en Jira antes de empezar: `area-j6`, `equipo-javier`, `calidad`,
`instrumentos`, `listo-para-construir`. **Sólo el apartado ①.** El ② (`scrum1387` a `guards:entrada`)
NO se ha hecho. No se toca ningún workflow, ni `src/`, ni el esquema, ni ninguna base, ni ninguna lista
de excepciones.

⚠️ El hook de inicio dijo SIN IDENTIDAD. Se construyó con la orden escrita del orquestador, que lo
tiene medido y abierto en SCRUM-1549.

## En corto

- **El falso verde existe, visto corriendo** antes de tocar nada: mismo árbol de ficheros, exit 1 en
  main y exit 0 en la rama que lo trajo con `git merge`.
- **Lo que se ha construido:** `leerHistoria` compara el corte que sale de la historia con el corte de
  main, que va escrito por identidad (`CORTE_EN_MAIN`, el sha entero de `bc5fa21ee`). Si no coinciden,
  o si no hay corte, lo dice por `ciego`, el canal que ya tenía. El test ya convertía `ciego` en rojo.
- **No pone ningún rojo nuevo en CI:** comprobado en cinco PR abiertos, no razonado (② abajo).
- **No ensancha la ceguera:** en main, en dos merges de CI y en la cabeza de una rama que trajo main
  con merge DESPUÉS del corte, decide igual que antes (③).

## ① El rojo primero: la receta del ticket, antes del arreglo

Worktree aparte, fuera del árbol de la sesión, ya quitado (sin `--force`). ⚠️ La receta se corrió
contra `cb30885dd` y no contra el main de hoy: en `82a61cd7c` (PR #2413) el banco que salía nuevo ya
está registrado, así que hoy main y la rama darían los dos exit 0 y la reproducción no distinguiría nada.

    git worktree add --detach <ruta> cb30885dd69c4df7f33d3a0066fed93698926857
    git checkout --detach 1d338a5ae8afa6166282c28e7a8c818c5375a856
    git commit --allow-empty -m "rama propia (simulacion SCRUM-1548)"
    git merge --no-ff --no-edit cb30885dd69c4df7f33d3a0066fed93698926857     # -> b043b2a3a
    node --test --test-reporter=tap tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs

| árbol | guard de antes | guard de ahora |
|---|---|---|
| `cb30885dd` a pelo | exit 1 · 146 ficheros · 59 bancos · 35 fuera · 34 heredados · **1 nuevo** · corte `bc5fa21ee` | exit 1 · los mismos números · el mismo banco nombrado |
| rama con merge local (`b043b2a3a`) | **exit 0** · 146 · 59 · 35 fuera · **35 heredados · 0 nuevos** · corte `b043b2a3a` | **exit 1 · CIEGO** |

Lo que dice ahora en el segundo, literal: «CIEGO: con la historia de git de este árbol no sé qué banco
es nuevo (el corte sale b043b2a3a y el de la línea principal es bc5fa21ee: el primer padre de este árbol
no es la línea principal (una rama anterior al guard que la trajo con `git merge`), así que todo lo que
vino en ese merge parecería heredado. Aquí no se puede saber; CI lo mide sobre la línea principal). No he
mirado nada.»

Los textos dicen «línea principal» y no el nombre de la rama a propósito: en la primera redacción
`scrum723` (censo de referencias móviles, en `guards:entrada`) cazó los dos ficheros, porque cuenta
toda cadena que nombre la rama en un fichero que llama a git. Aquí no se compara contra ninguna
referencia móvil, así que se cambió la redacción y no se tocó su lista declarada.

Coincide con lo que midió jv-j1d (su merge fue `72c425e2c`; el sha cambia porque el commit vacío lleva
otra hora, los recuentos son los mismos).

## ② El comentario 19526 del orquestador: comprobado, se cumple

Decía, razonado: «el ① no pone ningún rojo nuevo en CI, porque el primer padre de `refs/pull/N/merge`
es main». Medido el 14-oct-2026 sobre los PR abiertos que tenían ref de merge: **5 de 5**.

| PR | merge | primer padre | ¿en la línea de primer padre de main? | 2.º padre = cabeza del PR | merges dentro de la rama |
|---|---|---|---|---|---|
| #2412 | `ca58b121d` | `cb30885dd` | sí | sí | 0 |
| #2411 | `beddc7bc2` | `cb30885dd` | sí | sí | 0 |
| #2410 | `224c71e1e` | `82a61cd7c` | sí | sí | 1 |
| #2409 | `96be0c18e` | `cb30885dd` | sí | sí | 1 |
| #2392 | `65551712f` | `82a61cd7c` | sí | sí | 1 |

Y `ci.yml` sólo arranca en `pull_request` contra main y en `push` a main, y ningún `actions/checkout`
de `.github/workflows/` lleva `ref:` propio: no hay ningún job que pruebe la cabeza de la rama.

⚠️ Lo que esto NO dice: tres de las cinco refs de merge tenían como primer padre un main que ya no era
la punta (`cb30885dd`). GitHub las recalcula cuando quiere. Para este guard da igual —cualquier commit
de la línea de main posterior al corte vale—, pero no es «el main de ahora».

## ③ El negativo: donde se podía juzgar, se sigue juzgando

Los dos ficheros de este PR copiados encima de cada árbol, en el worktree aparte:

| árbol | veredicto | población |
|---|---|---|
| mi rama, nacida de `82a61cd7c` | exit 0 | 148 · 60 bancos · 34 fuera · 34 heredados · 0 nuevos · corte `bc5fa21ee` (idéntico al de antes del cambio) |
| `cb30885dd` a pelo | exit 1, por 1 nuevo | 146 · 59 · 35 · 34 · 1 · corte `bc5fa21ee` |
| merge de CI del #2410 (`224c71e1e`) | exit 0 | 150 · 61 · 34 · 34 · 0 · corte `bc5fa21ee` |
| merge de CI del #2409 (`96be0c18e`) | exit 1, por 1 nuevo | 146 · 59 · 35 · 34 · 1 · corte `bc5fa21ee` |
| cabeza de la rama del #2410 (`a9b3273d4`), que trajo main con merge pero nació DESPUÉS del corte | exit 1, por 1 nuevo | 148 · 60 · 35 · 34 · 1 · corte `bc5fa21ee` |

Ninguno sale ciego. Los tres rojos nombran el mismo banco, `docs/master/evidencias/SCRUM-1544`, que es
el que arregló el #2413 y que esos tres árboles todavía no llevan: son rojos de verdad, no del cambio.

La última fila es la que acota el arreglo: **no toda rama que sigue A4 queda ciega**, sólo la que nació
antes de `bc5fa21ee`. Si el corte de main está en la línea de primer padre, lo anterior a él es la
línea de main y lo posterior es posterior en cualquier topología.

## ④ Los controles que se quedan en el test

- `SCRUM-1548 · un corte que no es el de la línea principal es CIEGO…`: la función pura, con el sha del merge local
  medido, con `null`, y el negativo con el corte de main.
- `SCRUM-1548 · una historia de verdad con otro corte que el de la línea principal sale CIEGA por el canal de siempre`:
  **sembrado**, con git de verdad en un repositorio fabricado en el temporal de la familia de fixtures
  (`temporalDeFixtureGit`). No se presta de ninguna rama ni banco real.
- El negativo del canal es el test del árbol, que en main y en el merge de CI exige `ciego === null`.
- Dos mutaciones nuevas en `MUTACIONES_QUE_ME_TUMBAN`. A mano, las cinco declaradas: **5 de 5 muertas**,
  cada una tumba el test que nombra, y el árbol quedó igual después (`git status` + `git diff --stat`).

## Límites, declarados

- **`CORTE_EN_MAIN` es un sha escrito, no derivado.** Lo único que se puede derivar aquí es el primer
  padre de HEAD, que es lo que se juzga; `origin/main` no existe en todos los jobs de CI. Si el sha
  estuviera mal, el guard diría CIEGO en main y en todos los PR: no puede fallar callado.
- **El repositorio sembrado no reproduce la forma del merge**: cualquier repositorio fabricado tiene
  otro sha. Prueba que `leerHistoria` pregunta; la forma del merge está medida en ① y no vive en el test.
- **Una rama anterior al corte que traiga main verá este guard en ROJO en local** (CIEGO) y verde en
  CI. Es lo que el ticket pide; quien corra la tanda entera en una rama así lo va a ver.
- **Sin medir:** cuántas ramas abiertas están hoy en esa configuración, y si alguna vez entró un banco
  por esta puerta. Lo segundo no se deduce de no haberlo visto.
- De paso, y dicho: se quitó del test el «sin comitear todavía» y el comentario de la línea 132 que el
  ticket señalaba como falso; desde ahora, si no hay corte, es CIEGO.

## Mi fallo en esta sesión

Pasé dos veces código de node por un heredoc de bash y las dos se comió las barras invertidas (un
`\n` dentro de un literal y una expresión regular). El primero dejó el test con un error de sintaxis,
que se vio al correrlo: exit 1 con 1 test en vez de 8. No generaliza a nada que un guard pueda mirar;
el recuento de tests lo delató.

## SCRUM-1548b · ② `scrum1387` entra en `guards:entrada` (la derivación del c.19533 se midió y no cabe)

**Medido contra:** `origin/main` = `c30729832c18b65c3793917ca836868e6cfdaa6e` · 2026-10-14T04:06:55Z

A9: aviso → A10 «Un criterio que casa por la forma de la frase casa con una convención que nadie acordó: calibrado sobre una muestra, grita o calla con la siguiente.» — no se pudo comprobar: el filtro que falló era mío y de usar y tirar (una medición, no código del repo); no hay instrumento de la casa que lea cómo filtra una sonda de sesión

Sesión `jv-j6f`, puesto J6, equipo de Javier. Etiquetas del ticket leídas en Jira al arrancar:
`area-j6`, `equipo-javier`, `listo-para-construir`. El hook de inicio dijo «SIN IDENTIDAD»
(SCRUM-1549); se construyó con la orden del orquestador `cobroflash-backend-2e`.

### En corto

- **Se construyó la variante (c)**: una entrada más en `GUARDS` de `scripts/guards-entrada.mjs`
  (`tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`) y `MINIMO` de 13 a 14, igual que hizo
  SCRUM-1417 con el decimotercero. Nada más en ese fichero.
- **La derivación del c.19533 se MIDIÓ antes de construirla y no cabe** en el plazo de 90 s (Jira,
  comentario 19540). El orquestador decidió (c) con esa medición delante.

### ⚠️ El fichero no tiene dueño, y el cambio es aditivo

`node scripts/carriles.mjs de scripts/guards-entrada.mjs` → **SIN CERRADURA**: sólo lo cubre la fila
general de `scripts/`. Su ticket creador, SCRUM-414, no lleva ninguna etiqueta en Jira, así que el
criterio de `docs/equipo/dos-equipos.md` §3.3 calla: **sin puesto**. En git: 12 commits, 10 de la cuenta
de Luis y 2 de la de Javier (`git shortlog -sn c30729832 -- scripts/guards-entrada.mjs`). Dentro del fichero no hay ninguna marca de propiedad. Por eso el cambio
es el mínimo: una línea de lista con su motivo, y el suelo que la protege. Sin reestructurar ni
renombrar nada. El orquestador se lo pasa al equipo de Luis.

### Lo que cuesta, medido

| pasada (este árbol, 12 núcleos) | guards | tests | tiempo | salida |
| --- | --- | --- | --- | --- |
| antes del cambio, árbol limpio | 13 | 158 | 14,2 s | 0 |
| A · con el cambio, árbol limpio | 14 | 166 | 13,6 s | 0 |

`scrum1387` añade 8 tests. La diferencia de tiempo queda dentro del ruido de la máquina; en CI ese
fichero tardó 0,44 s (medido por `jv-j6c`, enunciado del ticket). La población de `scrum1387` en la
pasada A imprime el corte `bc5fa21ee (2026-10-14T02:04:37Z)`, que es el de la línea principal: esta
rama nace de `c30729832` y no trae nada por merge, así que su verde vale.

### El rojo, con un banco SEMBRADO (no prestado del árbol)

Banco fabricado `docs/master/evidencias/__sembrado-scrum1548__/mutar.mjs`, con una lista propia
(`const LISTA = [{ de: "x", a: "y" }];`) y sin nombrar el catálogo. Sin comitear. Se borró después.

| pasada | guards | salida | qué dice |
| --- | --- | --- | --- |
| B · sembrado, CON el cambio | 14 | **1** | «1 hallazgo · 0 ciegos», y el rojo nombra `__sembrado-scrum1548__/mutar.mjs` |
| C · sembrado, SIN el cambio | 13 | **0** | «13 guards de entrada en verde»: el falso verde de `jv-j6c` |

Para la pasada C se quitó el cambio con `git apply -R` de su propio parche, y se volvió a poner con
`git apply`. Después, `git status` sólo enseñaba `scripts/guards-entrada.mjs`.

### Lo que se descubrió al medir la derivación, y vale más que el arreglo

1. 🔵 **La derivación YA EXISTE, y es de S3**: `scripts/_tests-que-cubren.mjs` (SCRUM-1363) contesta
   «he tocado estos ficheros: ¿qué tests me pueden caer?», con el diff contra la base de la rama
   (`tocadosDeLaRama`). Se lanza con `npm run tanda:dirigida`. **Lo que falta no es construirla: es
   que alguien la corra.** Esa pregunta no es de este ticket ni de este equipo.
2. 🔴 **«Sin gate» leído del TEXTO no garantiza «sin `dist` ni base».** De los 122 ficheros que la
   regla del c.19533 sacaba para el diff de #2410, cayeron 90 tests, todos de bancos del panel y
   todos por entorno: este árbol no tiene `dist/`. Ya lo decía la cabecera de SCRUM-976: «leer el
   texto del fichero no basta para saberlo».
3. **La regla del c.19533 sacaba 122 ficheros como MÍNIMO en cualquier PR**: todo PR toca su
   `docs/master/SCRUM-N.md`, y 122 tests sin gate nombran `docs/master`. Tardaron 90,3 s y 105,8 s
   ellos solos. La variante sin `docs/master` sacaba 24 y 49 ficheros: 50,7 s y 80,9 s, más los ~14
   de la base. Medido sobre los diffs `<merge>^1...<merge>^2` de los 12 últimos merges de la línea
   principal. Las cifras enteras, en el comentario 19540.

### Mi fallo

El primer filtro de «sin gate» de la medición buscaba `dist/` en el TEXTO del test, y dejó fuera a
`scrum1387` porque su línea 3 dice «ni `dist/`» en un comentario. Con ese filtro, la medición
«demostraba» que la derivación no cazaba el caso de `jv-j6c`. **No lo cazó un control mío: lo cazó la
contradicción con un caso conocido** (el c.19533 dice que `scrum1387` nombra esa carpeta). Se
corrigió quitando los comentarios antes de buscar. Es la misma familia que el punto 2 de arriba.

Y uno menor: la cabecera del comentario 19540 dice «~04:40Z»; Jira lo registró a las 04:02Z.

### Pasado a mano antes de empujar

`tests/scrum1387`, `scrum237`, `scrum976`, `scrum267` y `scrum1294`, más todos los que importan
`scripts/guards-entrada.mjs` (`scrum711`, `scrum928`, `scrum928b`, `scrum1349`, `scrum1327`,
`scrum812`, `scrum702`, `scrum775`, `scrum1153`, `scrum1289`), y además `scrum723` y `scrum1480f`:
17 ficheros, **151 de 151, 0 saltados**, salida 0, TAP de 79.790 B, sin «TANDA SIN VEREDICTO».

### Lo que NO se ha medido

- La tanda completa en local, y `npm run tanda:dirigida` (el árbol no tiene `dist/`).
- El tiempo de `guards:entrada` en CI con 14 guards: lo juzga `scrum976` en el obligatorio.

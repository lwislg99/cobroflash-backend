# SCRUM-1639 · filas que abren otra pantalla y no se alcanzaban con teclado

**Medido contra:** `origin/main` = `c93f26a765313ce7834ecf276ddc3c09673527cc` · 2026-10-29T18:25:53Z

A9: aviso → cicatriz S2 «Edité un fichero de otro carril porque el encargo lo nombraba: el encargo dice qué tocar, no de quién es» — no se pudo comprobar: el aviso del carril llega después de la edición; lo que lo impide es correr `carriles.mjs de` antes, y eso no lo mide ningún guard

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin tokens, clases ni texto nuevos: el anillo
es el `--ring` de `tokens.css:71` por el `:focus-visible` global (`styles.css:143`).

Puesto S2. Rama `scrum-1639-filas-con-teclado`, worktree `s2-29oct-1639`. Carril medido con
`node scripts/carriles.mjs de …` ANTES de comitear: `expensesView.js` y `quotesDetailView.js` → S2
(`dos-equipos.md:152`); `styles.css` → S2 (contenedor); **`teamView.js` → J3 (`dos-equipos.md:145`)**.

### Lo que se arregla (2 de las 4) y lo que se pide (2 de las 4)

| # | sitio | dueño | qué se hizo |
|---|---|---|---|
| 1 | Gastos, `expensesView.js` `filaDeGasto` | S2 | el bloque del concepto (`.gasto-que`) es `role="button"` + `tabindex="0"` + Intro/Espacio → abre el gasto |
| 2 | Equipo, trabajos del operario, `teamView.js:438` | **J3** | NO tocado (A20). Receta abajo |
| 3 | Equipo, presupuestos del operario, `teamView.js:464` | **J3** | NO tocado (A20). Receta abajo |
| 4 | ficha del presupuesto, tarjeta de factura, `quotesDetailView.js` | S2 | el resumen (`<p>` con número, total y fecha) es `role="button"` + `tabindex="0"` + Intro/Espacio → abre la factura |

**Decisión declarada — por qué el activable es el bloque de DENTRO en 1 y 4, y no la fila:** las dos filas
contienen controles (Gastos: el enlace del trabajo y el «⋯»; factura pendiente: «Marcar como pagada» y su
selector). Un `role="button"` no puede contener controles: el lector de pantalla los aplanaría dentro del
nombre del botón. El bloque de texto no contiene ninguno y su nombre accesible es su propio texto: **ningún
`aria-label`, cero texto nuevo** (el `aria-label` de `homeView.js:680` no se copia: sería texto nuevo).

**`role="listitem"` de Gastos (aceptación 4):** se queda, con este motivo: su contenedor es `role="list"`
(`expensesView.js:399`), y una lista sólo admite `listitem` como hijos; si la fila pasara a `button`, la lista
quedaría rota para quien la oye. El test lo fija.

**El ratón no cambia:** los dos `click` siguen en la fila entera (`fila`, `div.invoice-item`); el teclado se
suma, no sustituye. El test lo comprueba con el clic subiendo desde el bloque.

**El anillo:** en 1 y 4 nadie pisa el `:focus-visible` global (ni `.gasto-que` ni el `<p>` llevan sombra
propia). La trampa de `.customers-card` (`styles.css:2562-2565`) es de las dos filas de J3: va en su receta.

### Receta para J3 (las dos de `teamView.js`)

Las dos tarjetas no contienen controles, así que la tarjeta entera es el botón, como `homeView.js:678`/`:700-702`:
`card.setAttribute('role','button')`, `card.setAttribute('tabindex','0')` y un `keydown` con `Enter` y `' '` que
hace `preventDefault()` y llama a lo mismo que el `click`. Sin `aria-label` (el nombre sale del texto).
Anillo: son `.customers-card`, que pisa el `:focus-visible` global → hace falta
`.customers-card[role="button"]:focus-visible { outline: none; box-shadow: var(--ring); }` en `styles.css`
(contenedor de S2: J3 añade su bloque marcado, o lo pide). Al arreglarlo, el techo de
`tests/scrum1639-filas-con-teclado.test.mjs` (`TECHO = { 'teamView.js': 2 }`) CAE y se baja a `{}` en su PR.

### De paso (sin ticket, como pedía el encargo): el anillo escrito a mano

`styles.css` escribía `0 0 0 3px rgba(34,197,94,.30)` literal en vez de `var(--ring)` en **cuatro** sitios,
no dos: `.quote-plantilla-chip:focus-visible` y `.quote-line__ajustes:focus-visible` (los dos del encargo),
`.quote-ajustes-campos select/input:focus` y `.quote-line input:focus` (éste con espacios dentro del
`rgba`, que mi primer `grep` no vio y el test sí). Mismo valor, así que nada cambia en pantalla. El test
lo fija sobre `styles.css` sin comentarios. `.semaforo-accion` (`var(--ring, <literal>)`) ya usa el token.

### El censo (aceptación 5): `tests/_censo-filas-sin-teclado.mjs`

AST de TypeScript sobre los 97 ficheros de `public/dashboard/js/`. Fila que navega = `X.addEventListener('click', H)`
con `H` llevando a `renderAppView('<vista>')` (directo o por una función del fichero). Si `X` nace `<button>`/`<a>`,
es nativa. Si no, tiene teclado cuando la MISMA función registra un `keydown` o crea un nativo cuyo clic va a la
MISMA vista.

| árbol | navegan | nativas | con teclado | nacimiento desconocido (no se juzgan) | sin teclado |
|---|---|---|---|---|---|
| `origin/main` | 54 | 34 | 4 | 12 | **4**: `expensesView.js:458`, `quotesDetailView.js:1051`, `teamView.js:438`, `:464` |
| esta rama | 54 | 34 | 6 | 12 | **2**: las dos de `teamView.js` (J3) |

Coincide con las cuatro del ticket. Tres errores del censo medidos y corregidos al calibrarlo (cada uno con su
caso): una función que PINTA la ficha entera contiene el `renderAppView` de sus filas, y «Marcar como pagada» la
llama para recargar → contaba como «abre la factura» (ahora una función navega sólo por lo suyo, no por sus
anidadas); el destino tiene que ser el mismo; y `customersView.js:771` salía sin teclado porque su
«📊 Historial» nace con un ayudante local `createElement('button', …)` (añadido a las formas de nacer).
LO QUE NO VE: delegación en `document`, los 12 de nacimiento desconocido, el orden real del tabulador y el lector
de pantalla.

### Rojo primero y mutaciones

`tests/scrum1639-filas-con-teclado.test.mjs`, 7 casos. Base 7/7. Con los tres ficheros de `origin/main`: 3/7 (caen
Gastos, ficha, censo y anillo). Las 6 de `MUTACIONES_QUE_ME_TUMBAN` caen cada una en su caso (mutador del job,
con el fichero guardado en memoria, no restaurado desde HEAD).

### Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| 1. Tab, Intro, Espacio y anillo | casos de Gastos y ficha (role, tabindex, Intro, Espacio, `preventDefault`); anillo = `:focus-visible` global sin pisar. **Sólo 2 de 4**: las de J3, pedidas |
| 2. El ratón igual | los dos casos 🔵 de control |
| 3. Cero texto nuevo | ningún literal ni `aria-label` añadido |
| 4. `listitem` con motivo | arriba; el test lo fija |
| 5. Guard que cuenta | el censo: 4 → 2, techo exacto de J3 en las dos direcciones |
| Visto en yaqu.app | pendiente hasta que entre en `main` (Gastos y la ficha de un presupuesto con factura, con teclado) |

## SCRUM-1639b · el rojo de #3009: un filtro de comentarios propio (2-nov-2026, misma rama `scrum-1639-filas-con-teclado`)

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T19:45:37Z

A9: comprobación → `tests/scrum700-filtros-de-comentario.test.mjs`

Error propio del puesto: para quitar los comentarios del CSS, el caso del anillo del test usaba su propio
`.replace(/\/\*[\s\S]*?\*\//g, '')` en vez del sitio único. `scrum700` lo cazó en el obligatorio (92 > 91 ficheros
con filtro propio). Ahora usa `soloCodigo` (`tests/_solo-codigo.mjs`), como `scrum962g` sobre el mismo `styles.css`.
De paso, el número de línea que da el aviso vuelve a ser el de verdad: `soloCodigo` deja las líneas donde están,
y el `replace` las desplazaba en cuanto había un bloque `/* */` de varias líneas. El guard no se ha tocado.

**Skill UI:** no cargada · sólo cambia un test; este tramo no toca ningún fichero de `public/`.

**Control del caso**, con un guion fuera del árbol que siembra y restaura `styles.css` desde HEAD (comprobado
idéntico al acabar):

| siembra | fallos (esperados) |
|---|---|
| ninguna (base) | 0 (0) |
| un anillo a mano como CÓDIGO | 1 (1) |
| el mismo anillo dentro de un comentario de varias líneas | 0 (0) |

**Main metido:** `70eefc40c`, sin conflictos. Lo que la rama cambia respecto a `main` siguen siendo sus 7 ficheros.

# SCRUM-1639c · las dos tarjetas de la ficha del operario (Equipo) se abren con teclado (24-nov-2026, J3)

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T11:40:31Z

A9: aviso → cicatriz J3 «Tercera vez que corro un test de vistas en un árbol anidado sin el dist construido» — no se pudo comprobar: qué tiene construido el árbol antes de una tanda no deja rastro que un test lea; lo paró otra vez leer el texto del rojo antes de contarlo

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin tokens, clases ni texto nuevos: el anillo es `var(--ring)`.

Puesto J3, rama `scrum-1639c-teclado-en-equipo`. Carril medido antes de escribir: `teamView.js` → J3 (`dos-equipos.md:145`;
la excepción de S1 es sólo el clic de «+ Añadir miembro», que no se toca); `styles.css` → S2 **contenedor**: J3 añade
SOLO su bloque, marcado `J3:` (`.claude/rules/carril-s2.md`).

| qué | esperado | visto |
|---|---|---|
| tarjeta de trabajo del operario (`teamView.js`, `abrirTrabajo`) | `role="button"` + `tabindex="0"` + Intro/Espacio con `preventDefault()` → `jobs-detail` | caso 5 verde |
| tarjeta de presupuesto del operario (`abrirPresupuesto`) | ídem → `quotes-detail` | caso 5 verde |
| el ratón | el mismo destino que antes | caso 6 (🔵 control) verde |
| el anillo | `.customers-card[role="button"]:focus-visible { box-shadow: var(--ring) }`: sin él, `.customers-card` pisa el global | caso 6 verde |
| texto nuevo | ninguno, sin `aria-label` (el nombre es el texto de la tarjeta) | diff sin literales visibles |

Patrón COPIADO de #3009 (`expensesView.js`, `que.setAttribute('role','button')`…) y de la receta de S2 de arriba. La tarjeta
entera es el botón porque, a diferencia de Gastos y de la factura, no contiene ningún control.

**Techo del censo (trinquete APRETADO, no aflojado):** `TECHO = { 'teamView.js': 2 }` → `{}`. Medido con
`tests/_censo-filas-sin-teclado.mjs` sobre los 98 ficheros de `public/dashboard/js/`:

| árbol | ficheros | navegan | nativas | con teclado | desconocidas | sin teclado |
|---|---|---|---|---|---|---|
| `origin/main` | 98 | 58 | 38 | 6 | 12 | **2** (`teamView.js:457`, `:483`) |
| esta rama | 98 | 58 | 38 | 8 | 12 | **0** |

Las 58 que navegan siguen siendo 58: el cero sale de que las dos GANAN teclado, no de que el censo deje de verlas.

**Rojo primero:** con `teamView.js` y `styles.css` de `main` caen los casos 5, 6 y 7 (role=null; sin regla de anillo;
censo 2 ≠ techo 0); los otros 6 verdes. Con el arreglo, 9/9.

Mutaciones: catálogo → `tests/scrum1639-filas-con-teclado.test.mjs` (la de `teamView.js`: Espacio quitado en la tarjeta
del presupuesto; ancla única, tumba sólo el caso 5, fichero restaurado idéntico).

**Sin hacer (por contexto: pasé el tope de 160k del encargo):** las capturas 1280/390 con el foco visible; los vecinos
1562, 1415, 854, 719 y los demás que nombran `teamView`. Corridos: el test de arriba, `guards:entrada`, 1294, 267, 811c
y `tsc -p .` con tipos. Visto en yaqu.app: pendiente hasta que entre en `main`.
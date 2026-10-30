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

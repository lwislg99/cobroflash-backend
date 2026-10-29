# SCRUM-1588 · Categoría «Alquiler de local» en los gastos (cruce desde SCRUM-1066e)

El ticket va en DOS mitades y ninguna lo cierra sola: S1 el servidor (`EXPENSE_CATEGORIES`), S2 la pantalla. Lo cierra el orquestador cuando entren las dos.

## S2 · la pantalla (rama `scrum-1588b-alquiler-de-local-pantalla`)

**Medido contra:** `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29` · 2026-10-29T09:57:54Z (cabecera `Date:` de GitHub al escribir esto)

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin componentes nuevos: una entrada más en el mapa de rótulos y una variante más de una píldora que ya existía.

A9: sin fallo que generalice — la firma se leyó en su comentario de Jira (SCRUM-1066 c.20497), no en el encargo ni en la descripción de SCRUM-1588.

Puesto S2, worktree `s2-29oct-1588`. Carril: `node scripts/carriles.mjs de` → `expensesView.js` S2 (puesto, `dos-equipos.md:152`) · `styles.css` S2 (contenedor, `dos-equipos.md:150`).

### La firma, en su fuente

SCRUM-1066 c.20497 (23-oct-2026, transcrita por el orquestador del equipo J): «1. **Rótulo FIRMADO** de la categoría (Javier: elige la A): **«Alquiler de local»**.» Clave interna `alquiler` (c.20485), que el profesional no ve. Ningún otro texto.

### El cambio

- `public/dashboard/js/expensesView.js`: `alquiler: { label: 'Alquiler de local' }` en `CATEGORY_LABELS`, con la cita en la misma línea, **antes de `otros`** (el comodín sigue siendo la última opción). De ese mapa salen la píldora de cada fila, el KPI «Mayor categoría» (`categoriaDe`) y las opciones del formulario de alta (`:151`) y de edición (`:800`). El comentario de cabecera decía «Los cinco colores»: ahora «Los colores».
- `public/dashboard/css/styles.css`: `.gasto-cat--alquiler { background: var(--brand-tint); color: var(--brand-tint-ink); }`, junto a las otras cinco.

**Decisión mía, declarada (el color):** las cinco píldoras de siempre son hex sueltos (azul, ámbar, violeta, rojo) y `otros` el neutro con tokens. DESIGN.md no fija colores de categoría. Usé el único par de tokens de `tokens.css` declarado para badges (`--brand-tint` / `--brand-tint-ink`, «fondos de realce suaves (badges)»): #047857 sobre #ecfdf5, ≈ 5,5:1, pasa AA. Es la única familia con token que no usa ya otra categoría. No inventa un color nuevo. Si se prefiere otro, es una línea.

### El test (`tests/scrum1588-alquiler-de-local-en-pantalla.test.mjs`, 4 casos, por efecto)

Saca por AST `CATEGORY_LABELS`, `categoriaDe` y `catPill` de la vista y los ejecuta en una caja de arena.

- ① `categoriaDe('alquiler')` → `{ clave: 'alquiler', label: 'Alquiler de local' }`, y su píldora.
- ② el formulario lo ofrece, y «Otros» sigue la última.
- ③ control: `subcontrata`, `otros` y una clave desconocida no cambian.
- ④ la regla `.gasto-cat--alquiler` existe y usa los dos tokens, que existen en `tokens.css`.

**Rojo primero:** con `expensesView.js` y `styles.css` de `origin/main` caen ①, ② y ④; pasa el control ③. Con el cambio, 4 de 4.

### Lo que NO está y por qué

- **Hasta que entre la mitad de S1, guardar un gasto con «Alquiler de local» da `category_invalid`** (`expenses.service.ts`): el formulario ya la ofrece y la ruta todavía la rechaza. No es un defecto de esta mitad; es el orden de llegada. Si esta rama entra antes que la de S1, durante ese intervalo la opción falla al guardar con el error de siempre.
- **En yaqu.app: NO MIRADO.** Sin la mitad de S1 no se puede crear un gasto de alquiler en producción, y la aceptación 3 (selector + píldora en la fila) pide los dos. Se mira cuando entren las dos.
- `GET /admin/expenses/categories` sigue sin consumidor en el front (`scripts/_sin-consumir-declarados.json`): la lista vive copiada en `CATEGORY_LABELS`. No se toca aquí; esa nota dice que conectarla obliga a retirar la copia en el mismo cambio.

## 29-oct-2026 (2) · S2 · el obligatorio de #2984 en rojo: la firma se leía «por grupo»

**Medido contra:** `origin/main` = `e9888aa2357f172b985b2c7b08646a386edb96a1` · 2026-10-29T11:04:19Z

A9: comprobación → `tests/scrum1157-censo-convenio-microcopy.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`; cambio de comentario y de forma del literal, ningún texto visible cambia).

Run 40857297693 (punta `ccc0105a7`): 12 932 tests, **4 ✖**, leídos en el log del job antes de tocar nada:
`scrum1157` ① y ③, `scrum1215g` y `scrum1215i`. Una sola causa, **nuestra**: la firma iba al final de la línea
de `alquiler`, cuyo valor es un objeto (`{ label: … }`). El censo (`_censo-convenio-microcopy.mjs`) se la pasa a
`label` como firma **de grupo** («APROBADO POR GRUPO, sin nombrar»), y además, al ver un comentario de convenio
dentro de `CATEGORY_LABELS`, metía el objeto entero en el censo: las cinco etiquetas de siempre (Materiales,
Desplazamiento, Herramientas, Subcontrata, Otros) salían NUEVAS sin firma.

**Arreglo:** la firma en la línea del propio `label`, con la forma que el censo lee:
`label: 'Alquiler de local', // APROBADO por Javier el 23-oct-2026 (SCRUM-1066 c.20497, opción A)`. El literal no
cambia. Censo: **0 nuevas · 0 que sobran · 34 acusadas · 176 por grupo**. Ningún guard tocado.

**Hallazgo, no arreglado:** esas cinco etiquetas de `CATEGORY_LABELS` no tienen firma encontrada (ni en
`docs/microcopy/` ni en `SCRUM-920`/`944`/`1066`). El censo no las ve porque su objeto no lleva comentario de
convenio, igual que en `main`. Va a quien reparte.

**Población corrida** (`main` mezclado, `dist` con `tsc --noCheck`): 22 ficheros de gastos y censo, 211 tests,
209 ✔ · 0 ✖ · 2 saltados; y 8 de firmas/procedencia (1502h, 387, 553, 601, 718, 719, 921, 921c), 102/102.
## S1 · el servidor (rama `scrum-1588-alquiler-en-las-categorias`)

**Medido contra:** `origin/main` = `503f0d86ac8dceb9dbce6ecc57e049a46092a70c` · 2026-10-29T10:28:09Z (cabecera `Date:` de GitHub al escribir esto)

A9: sin fallo que generalice — las tres cosas que la sesión anterior de S1 dejó medidas en su traspaso (sin DDL, `scrum943` con la lista a mano, el front cae a «Otros») se volvieron a medir aquí antes de usarlas.

Puesto S1, worktree `wt-s1-1588`. Carril: `node scripts/carriles.mjs de` → `expenses.service.ts` S1 (puesto, `dos-equipos.md:136`) · `prisma/schema.prisma` sin fila (sólo cambia un comentario) · `tests/scrum943-…` es el test de la ruta de gastos de S1 (SCRUM-943, cerrado, sin etiqueta de área).

### Por qué urgía

`POST /admin/expenses` con `category: 'alquiler'` daba 400 `category_invalid` (`isExpenseCategory`, `expenses.service.ts`), así que el borrador del modelo 115 de J1 (SCRUM-1066e, ya en `main`: `modelo303.ts` y `retencionesPracticadas.ts` leen `alquiler`) no tenía ningún gasto que leer.

### El cambio

- `src/modules/expenses/domain/expenses.service.ts`: `'alquiler'` en `EXPENSE_CATEGORIES`, **antes de `otros`** (el mismo orden que la pantalla de S2). Clave interna decidida en SCRUM-1066 c.20479 / c.20485.
- `prisma/schema.prisma`: el **comentario** de `Expense.category` pasa a `…|subcontrata|alquiler|otros`. **Sin DDL**: `node scripts/preview-migracion.mjs --desde <schema de origin/main>` → «sin cambios pendientes», con su control positivo (33 tablas). `Expense.category` es `String` libre (SCRUM-1066 c.20485).
- **Ningún texto visible**: el rótulo «Alquiler de local» lo pone S2.

**Consecuencia mecánica, declarada:** `tests/scrum943-la-categoria-se-valida.test.mjs` escribe la lista de válidas A MANO (`VALIDAS`) y la compara con la respuesta de `category_invalid` (`deepEqual(r.data.categories, VALIDAS)`); al añadir la categoría caía. Se añade `alquiler` a `VALIDAS`, y nada más: su bucle de «las válidas entran» pasa así a cubrirla también. Los títulos de sus casos siguen diciendo «cinco»: no se tocan (nombres de test).

**Segunda consecuencia, declarada — y la tiene que deshacer quien entre después:** `tests/scrum1194d-trinquete-vocabulario-ofrecido.test.mjs` (la forma de SCRUM-1136: una ruta acepta un valor que ninguna pantalla llamadora ofrece) sale PARCIAL en `POST /admin/expenses` y `PUT /admin/expenses/:id`, `faltan [alquiler]`, porque la pantalla es la mitad de S2. El guard da dos salidas: arreglar la pantalla en su carril o declarar el par con su motivo en el mismo PR. Se declaran los DOS pares en `DECLARADOS`, con motivo «TRANSITORIO (SCRUM-1588)». El guard no se toca. 🔴 **Cuando entre la rama de S2 (`scrum-1588b-…`), su trinquete «no baja en silencio» caerá en esas dos líneas: se quitan, y es consecuencia mecánica.** Si entra antes la de S2, esta rama las quita al mezclar `main`.

### El test (`tests/scrum1588-alquiler-en-las-categorias.test.mjs`, 5 casos)

Rutas y servicio de `dist/`, base doblada con `_envio-doblado.mjs` (el banco de `scrum943`).

| aceptación (literal) | dónde se ve |
|---|---|
| 1. `GET /admin/expenses/categories` (…) incluye `alquiler` → se ve en un test de S1 | `tests/scrum1588-alquiler-en-las-categorias.test.mjs`, caso «aceptación 1» |
| 2. Crear un gasto con `category: 'alquiler'` da 2xx, no `category_invalid` → test de S1 | mismo fichero, caso «aceptación 2» (201 y la escritura lleva `alquiler`) |
| 3. En yaqu.app, pantalla de gastos: el selector ofrece «Alquiler de local» y la fila muestra su píldora | NO HECHO aquí → S2, rama `scrum-1588b-alquiler-de-local-pantalla`; se mira en yaqu.app cuando entren las dos |

Además: la edición a `alquiler` entra (misma validación en el dominio) y, negativo, `Alquiler`, `ALQUILER`, ` alquiler`, `alquiler de local` y `rent` siguen dando `category_invalid`.

**Rojo primero:** con `alquiler` quitado del `dist` compilado caen 3 de 5 (aceptación 1, aceptación 2 y la edición); pasan el suelo y el negativo. Con el cambio, 5 de 5. Vecinos (23 ficheros que leen gastos o `EXPENSE_CATEGORIES`, incluidos `scrum1066e` y `scrum1500`): 194 tests, 184 pass, 0 fail, 10 saltados (gateados).

### Lo que NO está

- **En yaqu.app: NO MIRADO.** Es servidor; la aceptación 3 pide las dos mitades en producción.
- `GET /admin/expenses/categories` sigue sin consumidor en el front (lo dice el tramo de S2): no se toca aquí.

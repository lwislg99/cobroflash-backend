# SCRUM-1588 · Categoría «Alquiler de local» en los gastos (cruce desde SCRUM-1066e)

El ticket va en DOS mitades y ninguna lo cierra sola: S1 el servidor (`EXPENSE_CATEGORIES`), S2 la pantalla. Lo cierra el orquestador cuando entren las dos.

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

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
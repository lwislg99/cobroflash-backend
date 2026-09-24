# SCRUM-1008 · La ficha del artículo: SKU, referencia del proveedor y unidad

**Fecha:** 24-sep-2026 · **Carril:** S1 (servidor/importes) · **Rama:** `scrum-1008-ficha-articulo-sku-unidad-familia`

**Medido contra:** `origin/main` = `f8059041` (Merge pull request #1749, `scrum-1110-sobre-soap-prueba-aeat`)

## Origen

Hallazgo POR DENTRO de Contasimple (com. 16436/16451, S0 · SCRUM-1002): «Nuevo producto o
servicio» trae Familia/Subfamilia, Tipo de unidad, Código de producto (SKU), Referencia proveedor,
entre otros. `Product` no tenía código propio, ni la referencia con la que EL PROVEEDOR llama al
artículo (distinta de `providerId`, que es la relación), ni unidad — medido: la unidad SÍ existe
en el documento (`AlbaranLinea.unidad`) pero no en el artículo.

Triage s4-22b (22-sep): **SÍ, construir.** PEQUEÑO/MEDIANO, aditivo, no toca `src/modules/invoicing`
ni el sellado. Reetiquetado `area-s0` → `area-s1`.

## Qué se construye

Tres columnas nulables y aditivas en `Product`, mismo patrón que `itemKind` (SCRUM-609): ausente
= nadie lo ha rellenado, no un valor por defecto que nadie ha decidido. Texto libre, SIN lista
cerrada (a diferencia de `itemKind`): un SKU o una unidad son del profesional, no un vocabulario
que YaQu tenga que decidir.

```sql
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sku" TEXT,
ADD COLUMN     "supplier_ref" TEXT,
ADD COLUMN     "unit" TEXT;
```

Aditiva: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL (`node scripts/preview-migracion.mjs`).
`docs/sql/deriva-prod.sql` regenerado (`node scripts/generar-sql-deriva.mjs`, 465 → 468 columnas).

**Wiring:**
- `products.service.ts` — `createProduct`/`updateProduct` leen y escriben las tres columnas.
- `products.routes.ts` — `POST /` y `PUT /:id` validan con `textoOpcional` (trim, tipo texto,
  longitud máxima: 60 para `sku`/`supplierRef`, 40 para `unit`, igual que `AlbaranLinea.unidad`).
  El PUT sólo toca la columna si la clave viaja (mismo criterio que `description`/`cost`).
- `productsView.js` — tres campos nuevos en el alta y en el modal de edición. Rótulos propuestos:
  «SKU», «Referencia del proveedor», «Unidad» — **PENDIENTES DE FIRMA** (regla 39). No hay
  clientes reales en producción hoy; se propone el literal y se pide confirmación antes del
  primer merchant real.
- `listProducts`/`getProductById` (sin `select`, con `include`) devuelven las tres columnas sin
  cambio de código — ya contabilizadas en el suelo de `scrum860-trinquete-del-select`.
- `searchProducts` (el autocompletado de la línea del presupuesto) **NO** se toca: ver reducción
  de alcance abajo.

## 🔴 Reducción de alcance declarada

**NO se precarga la unidad en ninguna línea de documento**, aunque la propuesta original lo
mencionaba. Medido antes de construirlo: el único sitio con un campo `unidad` real hoy es
`AlbaranLinea`, y su editor (`buildAlbEditor`, `jobDetailView.js`) no tiene selector de catálogo
— añadírselo es una superficie nueva (UI + microcopy con firma, regla 39), no una precarga de un
campo que ya existe. Añadir `unidad` a `Quote.lines` (Json, sin ALTER) tendría el mismo problema
del lado contrario. Se deja para un ticket propio, con su propia decisión de qué documento y qué
firma.

**Familia/subfamilia tampoco se construye** — el propio ticket ya lo declaraba aparte: «Familia =
opcional y AL FINAL (es el árbol lo que pesa)».

## Verificado

- `node scripts/preview-migracion.mjs --desde <schema de origin/main>` → aditiva, sin DROP.
- Build limpio (`npm run build`) tras `prisma generate`.
- `tests/scrum1008-ficha-articulo.test.mjs` (8 tests, nuevo): `textoOpcional` (ausente → null,
  recorta espacios, rechaza no-texto, respeta el límite), wiring por AST en las dos rutas,
  `createProduct`/`updateProduct` escriben lo esperado (mock de Prisma, mismo mecanismo que
  `scrum635`). Verificado en ROJO quitando la validación de `sku` en `POST /` antes de restaurarla.
- `scrum698-vistas-que-no-se-miden.test.mjs`: `renderProductsView` 166 → 176 (+10, identificado
  por identidad: `div.quote-form-row` + 3×(`div.field` + `label` + `input`) del alta; el modal de
  edición no cuenta, se construye perezosamente).
- Suite de productos (`scrum860`, `scrum365`, `scrum635`, `scrum661b`, `scrum609`, `scrum609b`,
  `scrum339`) y el lote de vistas/DOM del catálogo: 56 + 194 tests, 0 regresiones.
- Suite completa: 8245 tests, 4 fallos — los 4 PRE-EXISTENTES y ajenos a esta rama (`scrum910d`
  falla igual en `origin/main` limpio; `scrum939b`×3 dependiente de la ruta de `gh`, ya
  documentado en SCRUM-917 com. 16190).

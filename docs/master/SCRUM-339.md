# SCRUM-339 · el importador de productos: recuento que miente, filas silenciosas, round-trip roto

**Fecha:** 5-ago-2026 · **Carril:** B (corrección + deuda técnica) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `0d049878d61e0d3bbfe9d4033d2778007f15b0b0` · 2026-08-05T04:17:04+01:00

## Lo arreglado (los 4 puntos), alineado al contrato que YA existe
El importador (`importProductsCsv`) no tenía un solo test y devolvía `{ inserted, skippedDuplicates }`.
Se **alinea con el contrato de POST /admin/customers/import** (`customersAdmin.routes.ts:78-126`):
`{ created, skipped, errors, errorList }`. No se inventa contrato nuevo.

1. **🔴 El recuento que mentía.** `skippedDuplicates` solo contaba el choque `P2002`; el duplicado
   normal (`findFirst`, :131) hacía `continue` mudo. **Medido en el código de hoy:** 4 filas todas
   duplicadas → `{"inserted":0,"skippedDuplicates":0}` (el «0 y 0»). Ahora el `findFirst`-existe hace
   `skipped++` → 4 duplicadas → `created 0 · skipped 4`.
2. **Filas tiradas en silencio → ahora se reportan.** nombre vacío / precio no numérico o ≤0 / IVA
   fuera de 0..1 pasan por `anota()` → `errors++` + `errorList` (capado a 10, como clientes).
3. **🔴 El ida y vuelta con nuestro propio export.** (a) `escapeCsv` ahora entrecomilla `;` (el
   separador del export, :78/:88) — antes solo `,`/`\n`/`"`. (b) el importador parsea con `parseCsvLine`,
   que **honra comillas** (`"a; b"` es UNA celda), en vez de `split(delimiter)` a pelo. Antes un `;` en
   el nombre desplazaba las columnas: el precio se leía de la celda equivocada y la fila caía muda.
4. **El BOM sin guardia.** `importProductsCsv` quita un `﻿` inicial. Latente (el `.trim()` de la
   ruta ya lo mordía, U+FEFF es whitespace) pero el servicio se defiende solo, sin depender del llamador.

## Verificación
- **Rojo por el mecanismo sobre el bug REAL (sin inyectar):** los 6 tests del servicio corridos contra
  el código de hoy caen; y la medición directa da `{"inserted":0,"skippedDuplicates":0}` para N filas
  todas duplicadas. Verde después.
- **Round-trip del `;`:** `exportProductsCsv` → `importProductsCsv` de un producto con `;` en el nombre →
  `created 1`, nombre entero, precio de la celda correcta. (Hoy: caía, y además el BOM saltaba `invalid_header`.)
- **Dos caras:** un CSV bueno importa igual (`created N`, `isActive`/`vat` bien leídos).
- **Control negativo:** un duplicado cuenta como `skipped`, NO como `error` (la clasificación es específica).
- **Contrato:** test que exige `created/skipped/errors/errorList` y prohíbe el viejo `inserted/skippedDuplicates`.
- **Cero tests tocaban `importProductsCsv`:** ahora hay 6 (servicio) + 3 (microcopy).

## Frontend (mínimo) y microcopy (regla 30)
`productsView.js` se recablea al contrato nuevo. «Insertados»/«Duplicados omitidos» son feedback
EXISTENTE reusado (no microcopy nueva — misma excepción que declara SCRUM-283). El rótulo de errores SÍ
es nuevo → va con el marcador **`[PENDIENTE microcopy oficial]`** hasta que el fundador apruebe el texto.
Guard `tests/scrum339-microcopy-import.test.mjs` (espejo de SCRUM-283): falla si ese rótulo deja de ser
el marcador, con inyección (un texto plausible lo tumba) y control negativo (un cambio ajeno no).
El helper muerto `productsView.js:347` se recableó a `data.created` (leía el campo eliminado; trampa quitada).

## Lo NO tocado (reportado, regla 9)
- **Permisos:** `POST /admin/products/import` (:174) y `POST /admin/products/load-catalog` (:22) **no
  llevan `requireRole`** (el `/export` sí, :162). Están en PENDIENTE_CLASIFICAR tanda 3 → se reporta, no se toca.
- **Microcopy oficial:** el rótulo de errores (marcador, arriba). Lo aprueba el fundador.
- `prisma/schema.prisma` y el camino de emisión.
- **Saltos de línea embebidos:** `parseCsvLine` honra comillas dentro de una línea, pero el CSV se sigue
  troceando por `\n` antes; un valor con `\n` embebido queda fuera de alcance (no está en los 4 puntos).

## 🔴 Hallazgo de OTRO carril (rojo en main AHORA, NO arreglado aquí — regla 9)
`tests/scrum289-censo-origen-factura.test.mjs:160` («el censo no describe sitios que ya no existen»)
**falla en main `0d04987`, antes de tocar 339.** Causa medida: **mi propio SCRUM-343** (mergeado,
`19afc10`, confirmado ancestro de main) unificó `/expenses.csv` por `buildGastos` y **quitó** el
`prisma.expense.findMany` de `exports.routes.ts`; el censo de SCRUM-289 aún nombra ese sitio
(`src/modules/exports/app/routes/exports.routes.ts::expense.findMany#1`) y su trinquete lo caza. Es
un choque de orden de merge (en su día 343 salió con la suite en verde). **Arreglo (carril 289, NO aquí):**
quitar esa entrada del censo/baseline de 289. Puedo hacerlo en rama aparte si lo autorizas.

## Ficheros
- `src/modules/products/domain/products.service.ts` — `escapeCsv` (`;`), `parseCsvLine` (nuevo), `importProductsCsv` (contrato + BOM + parseo + reporte).
- `src/modules/products/app/routes/products.routes.ts` — `/import` devuelve el contrato alineado.
- `public/dashboard/js/productsView.js` — recableado al contrato + marcador de microcopy.
- `tests/scrum339-importador-productos.test.mjs` (6) · `tests/scrum339-microcopy-import.test.mjs` (3).

**Suite: antes 1362 · 1294 pass · 1 fail (el de SCRUM-289, pre-existente) · 67 skip → después 1371 ·
1303 pass · 1 fail (el MISMO de SCRUM-289) · 67 skip** (+9 tests, +9 pass; 0 fallos nuevos por 339).

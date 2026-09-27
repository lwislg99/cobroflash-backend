# SCRUM-1187 · El detalle del presupuesto devuelve su cabecera y su pie (mitad de servidor de SCRUM-1186)

**Medido contra:** `origin/main` = `0a10475c144763982b7b9d535bbaa14718843ee8` · 2026-09-27T17:34:27Z

**Escribe:** Sesión 1 (S1) · **Rama:** `scrum-1187-quote-textos-doc` · **Carril:** S1 (servidor).
La mitad de front (copiar al duplicar, precargar, borrador) es de S2 en SCRUM-1186.

## El defecto

Regresión abierta por SCRUM-1174: el presupuesto ya guarda `docHeaderText` y `docFooterText`
(`quotes.routes.ts`) y el PDF los pinta (`presupuestoParaPdf.ts`), pero `GET /admin/quotes/:id`
sirve `getQuoteDetailAdmin` (`src/modules/system/quoteAdmin.ts`), una proyección EXPLÍCITA que no
los incluía. «⎘ Duplicar» copia lo que devuelve ese GET, así que el duplicado salía sin cabecera ni
pie, sin avisar.

## El cambio

Dos líneas en la proyección, `docHeaderText` y `docFooterText` con `?? null`, junto a
`discountGlobalAmount` — el mismo patrón y el mismo motivo que SCRUM-888d. Aditivo: no se quita ni
cambia nada de lo que ya devolvía. Sin cambio de esquema (las columnas ya existen). La consulta ya
llevaba `include` sin `select`, así que los dos campos ya venían de la base; faltaba sólo sacarlos.

**Para S2 (SCRUM-1186):** los campos son `quote.docHeaderText` y `quote.docFooterText` (`null` = vacío).

## Prueba

`tests/scrum1187-detalle-con-textos-doc.test.mjs` (banco de 888d: la función con `prisma` de doble,
sin puerto):
- **Rojo antes** (medido, sin la línea): `🔴 el detalle no trae la cabecera: «Duplicar» la perdería (undefined)`.
- **Verde después:** 3/3. Con textos los devuelve; sin textos, la clave existe y vale `null`.
- **Regla 2:** el doble sólo contesta si la consulta pide el presupuesto para SU merchant; pedido
  desde otro merchant da `quote_not_found` y la consulta lleva el `merchantId` de quien pregunta.
- Tests que ya miraban `quoteAdmin`/`getQuoteDetailAdmin` (14 ficheros): 145 pasan, 0 fallan, 2 saltados (preexistentes).

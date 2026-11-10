# SCRUM-1159 · 44 px en los controles de forma de cobro, medidos en Edge real

**Medido contra:** `origin/main` = `180e19746b2c3b38bc953d81ec23d1c7c4019249` · 2026-10-23T10:11:34Z (hora de GitHub al escribir: 2026-10-23T10:18:07Z)
A9: sin fallo que generalice — la medición sale verde a la primera y sólo añade un instrumento de evidencia; el hueco que destapa (el `<select>` fuera de `INTERACTIVOS`) es de la casa y va abajo como hallazgo, no como fallo mío

Puesto J2 (`jv-j2z`) · rama `scrum-1159-forma-de-cobro-44`. Encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`). **Carril J2** (pantallas de pagos, `dos-equipos.md` §11bis según el enunciado). **No se
toca código del producto:** sólo este registro y `docs/master/evidencias/SCRUM-1159/medir.mjs`.

## PASO 0

Sin commits en `origin/main` con «SCRUM-1159» (el único que casa es el PR #1159, de SCRUM-814), sin rama
`scrum-1159*` en el remoto y sin registro. Jira: descripción y su único comentario (c.17188, S2, 26-sep), leídos
enteros el 23-oct. La rama viva de 44 px de Luis (#2692, `scrum-962f-editor-cuatro-44`) no toca `cobrosView.js` ni
`selectorMetodoCobro.js` (lista de ficheros del PR).

## Población

Declarada antes de medir, no deducida del resultado:

- **Cobros** — los botones de filtro por método (`public/dashboard/js/cobrosView.js:511-515`, `role="tab"`,
  `b.style.minHeight = '44px'` en línea): «Todos» + los cubos del arranque, que el instrumento saca de `cubosDeMetodo`
  importada de `dist` (la misma función que sirve el arranque). Hoy son 6: Todos · Bizum · tarjeta · transferencia ·
  efectivo · Método no registrado.
- **Ficha de factura pendiente** — el `<select>` de `public/dashboard/js/selectorMetodoCobro.js:58`
  (`#metodo-cobro-factura`, `sel.style.minHeight = '44px'` en línea).

6 + 1 controles × 3 anchos = **21 mediciones**.

## Cómo se midió

`node docs/master/evidencias/SCRUM-1159/medir.mjs` — Edge vía `puppeteer-core`, página pintada por el PRODUCTO
(`scripts/_banco-lista.mjs`: los scripts de `public/dashboard/index.html` en su orden, sólo `apiRequest` doblado, con
las muestras de `scripts/_datos-del-censo.mjs`), y el árbitro de la casa (`__areaDeToque` de
`scripts/_medidor-de-toque.mjs`: quién recibe el toque por `elementsFromPoint`, no la caja). **No** el mini-DOM
serializado, como pide c.17188.

## Resultado — cumplen los 21

| Superficie | 320 px | 390 px | 1280 px |
|---|---|---|---|
| Cobros, 6 filtros | caja 44 · toque 44,9 | caja 44 · toque 44,9 | caja 44 · toque 44,9 |
| Factura, `<select>` de método | caja 44 · toque 45 | caja 44 · toque 45 | caja 44 · toque 45 |

`RESUMEN · mediciones declaradas 21 · cortas 0 · ciegas 0` · salida 0.

## Controles

- **Positivo SEMBRADO** (no prestado del árbol): en cada página el instrumento siembra un gemelo sin el `minHeight`
  en línea —`button.btn-sm.btn-ghost[role=tab]` en la barra de filtros y `select.form-control` junto al real—. Salió
  corto en las 6 páginas: **30,9 px** (botón) y **22 px** (select).
- **Sin semilla** (`--sin-semilla`): salida **2**, `ciegas 6` — el instrumento dice CIEGO, no verde.
- **Mutación** (`--mutar`, quita el `minHeight` en línea de los 21 reales): salida **1**, `cortas 21` — los filtros
  bajan a caja 30 / toque 30,9. **La pieza que trabaja es el estilo en línea**, y no hay regla CSS que la respalde.
- **Población**: si el número de controles no es el declarado, la página sale CIEGO.

## Lo que NO se midió

- El mismo `<select>` en la ficha de presupuesto (`quotesDetailView.js:1098`): la muestra del censo trae el
  presupuesto sin facturas (`invoices: []`), así que no se pinta. Es la misma función, con el mismo estilo en línea;
  **no medido**, no «igual».
- yaqu.app: no medido allí (pide sesión). La medida es del árbol `180e19746`, que es lo desplegado según el encargo.

## Hallazgos de paso (no se arreglan aquí)

1. El único corto que el censo (`npm run censo:tactil-panel`) da en Cobros a 929 y 390 **no es de forma de cobro**:
   es el enlace al documento de la fila, «factura F-2026-0021» (`cobrosView.js:618`), con **17 px** de toque en Edge
   real. Fuera del alcance de este ticket (sólo los controles de forma de cobro).
2. `INTERACTIVOS` de `scripts/_medidor-de-toque.mjs:52` no incluye `select`: el `<select>` de método —y cualquier
   otro desplegable del panel— no lo mide ni `guard:objetivo-tactil` ni `censo:tactil-panel`. Aquí se midió añadiéndolo
   a mano en el instrumento.

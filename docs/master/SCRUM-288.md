# SCRUM-288 · A0.2 — ¿se puede casar una línea de albarán con su línea de presupuesto? (informe)

**Fecha:** 5-ago-2026 · **Carril:** B (QA/medición) · **Gate:** sin gate

**Medido contra:** `origin/main` = `cc417b41d3ffe6cd208ef38df8c0732ebbb2822d` · 2026-08-05T00:06:37+01:00

> ⚠️ Informe puro: **no construye, no toca `schema.prisma`, no abre tickets** (regla 38: leer el
> camino de emisión no es STOP; aquí no se modifica). Re-medido contra el árbol de HOY, no repetido
> por fe de SCRUM-257. **SUELO:** `modoValoracion`/`VALORADO` aparece **76** veces en `src/` → la
> derivación LEE el árbol; los gates concretos van citados abajo.

## 🔴 Resultado que decide A0.4
**Hoy NO existe ningún enlace estructural entre una línea de albarán y su línea de presupuesto.** La
única vía de cruce es **coincidencia de TEXTO del concepto**, y ni eso es limpio (las dos estructuras
usan claves distintas). A0.4 —«casar cada línea del albarán con su línea del presupuesto»— **no tiene
base fiable hoy**; se apoyaría en un cruce difuso por texto.

---

## 1 · ¿Qué hay HOY exactamente? (textual)
- **`Albaran.lineas`** — `prisma/schema.prisma:774`: `Json  // [{concepto, cantidad, unidad,
  precioUnitario?, tipoIva?}]`. Modo en `modoValoracion` (`:773`, default `'SIN_VALORAR'`).
- **`AlbaranLinea`** — `src/modules/jobs/domain/albaran.service.ts:30-40`:
  `{ concepto: string; cantidad: number; unidad: string; precioUnitario?: number; tipoIva?: number }`.
  Los comentarios `:34-37`: `precioUnitario`/`tipoIva` **solo en VALORADO** (null/undefined en
  SIN_VALORAR); **`tipoIva` es % ENTERO (21/10/4/0)**, mientras que `Quote.lines[].tax` es la
  **FRACCIÓN (0.21)** — convención distinta a propósito.
- **`Quote.lines`** — `prisma/schema.prisma:296`: `Json`. **`QuoteLine`** — `src/core/utils/utils.ts:61`:
  `{ concept: string; qty: number; price: number; tax?: number }`.
- **Enlace por línea:** `grep quoteLineIndex|quoteLineId|origenLinea|lineRef` en `src/`+`prisma/` =
  **NINGUNO**. El único índice-de-línea del árbol es `AlbaranLineaFacturada.lineaIndex`
  (`schema:826`), que apunta a `Albaran.lineas` y a una **factura** (`invoiceId`), **no a un quote**.
- → **La única vía de cruce es el TEXTO del concepto**, y con roce: claves distintas (`concepto`
  ES vs `concept` EN) e IVA en convenciones distintas. **Es un resultado, no un fracaso.**

## 2 · ¿Qué haría falta para casarlas de forma fiable? — (i) SOLO CÓDIGO (confirmado, no migración)
- `Albaran.lineas` es `Json` (`schema:774`): añadir una propiedad `quoteLineIndex` (u origen) al
  objeto de cada línea **NO es migración de esquema**.
- Es **(i) solo código**, tocando **`validarLineas`** (`albaran.service.ts`) + el punto donde se
  fijan las líneas — porque `validarLineas` **RECONSTRUYE** cada línea al tipo `AlbaranLinea` (5
  campos, `:30-40`) y **descarta cualquier campo extra**: un `quoteLineIndex` que no esté en el tipo
  se perdería en la primera edición. **Confirmo lo que midió SCRUM-257: (i), no migración** — y lo
  confirmo POR MEDICIÓN (Json + `validarLineas` es donde vive el shape), no por fe.
- Matiz: **(i)** vale para el índice-en-Json. Un **FK RELACIONAL** (una tabla, estilo
  `AlbaranLineaFacturada`) sería **(iii) migración**. **Ninguna es (ii)** «campo nullable de
  esquema»: el índice viviría en el Json, no en una columna.

## 3 · Las líneas añadidas en obra — CÓMO se distinguen de las prellenadas
- **No hay prellenado del presupuesto.** Al crear el albarán (`jobs.routes.ts:510-516`) las líneas
  salen de `req.body.lineas` (lo que teclea el pro) o quedan vacías; el job exige un quote (`:495`)
  pero las líneas **NO se copian de `quote.lines`**. No existe un conjunto «prellenado desde el
  presupuesto».
- Y **no hay marcador de origen por línea** (ver Q1). → **On-site y prellenada son INDISTINGUIBLES**:
  (a) no hay mecanismo que copie líneas del quote al albarán, y (b) no hay campo que marque «esta vino
  del presupuesto». **Consecuencia:** hoy **no se puede saber qué líneas necesitan presupuesto
  adicional** (SCRUM-195) — no hay ninguna señal que las separe.

## 4 · ¿Sirven `facturar-parcial` y `consolidar` como base? — NO tal cual (exigen VALORADO)
- **`facturar-parcial`** (`albaranes.routes.ts:624`): `if (albaran.modoValoracion !== 'VALORADO')` →
  **EXIGE VALORADO**. El precio sale del **ALBARÁN** (`price: l.precioUnitario`, `:664`); la cantidad,
  del pendiente del albarán (`qty: l.pendiente`, `:663`). **No toca el quote.**
- **`consolidar`/recapitulativa** (`recapitulativa.service.ts:75-95`): también usa `precioUnitario`
  del albarán (`:82`) → **VALORADO**; `quoteId: null` (`:95`). **No toca el quote.**
- → Ambos asumen que **el precio vive en el ALBARÁN (VALORADO)**. A0.4 quiere el precio del
  **PRESUPUESTO** (albarán SIN_VALORAR). **NO reutilizables tal cual: el origen del precio es
  incompatible.** Lo reutilizable es la **contabilidad de cantidad servida/pendiente**
  (`AlbaranLineaFacturada`, el libro por línea); el precio necesitaría un camino NUEVO desde el quote.

## 5 · ¿Qué se rompería si un albarán `SIN_VALORAR` pasara a facturable? (derivado)
- Guardas que hoy asumen «SIN_VALORAR = no facturable»:
  - `facturar-parcial` bloquea `modoValoracion !== 'VALORADO'` (`albaranes.routes.ts:624`).
  - El precio es **siempre** `l.precioUnitario` del albarán (`facturar-parcial:664`,
    `recapitulativa:82`) — que en SIN_VALORAR **no existe**.
  - `validarLineas` **RECHAZA** `precioUnitario`/`tipoIva` en SIN_VALORAR (`albaran.service.ts:72-75`)
    → un albarán SIN_VALORAR **no puede almacenar precio**.
- → Si SIN_VALORAR pasara a facturable **vía el quote**, rompen: (a) el gate `:624`; (b) el origen
  del precio (`l.precioUnitario` es null → habría que tomarlo del quote); (c) la premisa de toda la
  cadena «el precio vive en el albarán». No es un cambio de un sitio: es **cambiar de dónde sale el
  precio**.

## 6 · La cantidad parcial — ¿algún sitio asume facturada = presupuestada? (derivado)
- En los caminos **ALBARÁN→factura** la cantidad sale **siempre del albarán**: `facturar-parcial`
  `qty: l.pendiente` (`:663`); `recapitulativa` `qty: l.cantidad` (`:81`). **Ninguno asume que la
  cantidad facturada = la presupuestada.**
- El único sitio que factura la cantidad del **quote** es el ciclo **QUOTE→factura** (collect-rest,
  `jobs.routes.ts:581` lee `quote.lines`), pero ese es el ciclo del presupuesto, **no** el parcial
  del albarán de A0.4.
- → Para A0.4 (cantidad del albarán, precio del quote), la **cantidad ya está bien** (albarán-driven,
  `pendiente`); el punto incompatible es el **precio** (Q4).

## Síntesis para A0.4
No hay enlace estructural línea↔línea (solo texto del concepto, difuso, con claves e IVA distintos).
Añadirlo es **(i) código** (`validarLineas` + el mapper), **no migración** — confirmado midiendo. Pero
además: las líneas del albarán **no se prellenan del quote** y **no llevan origen** → distinguir
prellenada de obra es imposible hoy (Q3). Y los caminos de facturación existentes **exigen VALORADO**
(precio en el albarán); A0.4 necesita el precio del quote → **camino nuevo de precio** (la cantidad ya
es albarán-driven). Todo esto **decide** que A0.4, tal como está diseñado, **no se sostiene sobre lo
que hay hoy** sin al menos ese código nuevo.

# SCRUM-343 · gastos.csv: dos cabeceras distintas y un comentario que decía que coincidían

**Fecha:** 5-ago-2026 · **Carril:** B (consistencia de datos / export) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `f3dc977bc33abdb437a85cc0d5b6139f7d404a9a` · 2026-08-05T00:45:57+01:00

## Medición (confirmada por contenido, no por confianza — SCRUM-321 la midió en E0 anoche)
`gastos.csv` se generaba por dos caminos con cabeceras **distintas**:

- **ZIP** — `buildGastos`, [exportData.ts:320] — **9 columnas**:
  `Fecha · Concepto · Categoría · Importe · Moneda · Proveedor · Presupuesto ID · Registrado por · Notas`
- **Suelto** — `GET /admin/exports/expenses.csv`, [exports.routes.ts:695] — **8 columnas**:
  `Fecha · Concepto · Categoría · Importe · Moneda · Proveedor · Presupuesto ID · Notas`

**Qué falta:** el suelto NO tenía `Registrado por` (el autor del gasto, `teamMember`); ni siquiera
consultaba `teamMember`. **Por qué divergió:** el suelto es el camino viejo (SCRUM-138: «hasta ahora
los gastos SOLO existían como descarga suelta»); cuando 138 metió gastos en el paquete con `buildGastos`,
ese builder AÑADIÓ la 9ª columna y no rellenó el suelto. **La trampa:** el comentario de `buildGastos`
(exportData.ts:299) afirmaba «Mismas columnas que el CSV suelto, para que las dos descargas cuadren
entre sí» — mentía desde el día que se añadió la 9ª. Quien lo leía se fiaba y no comprobaba.

## Arreglo — unificado por el builder compartido (una sola fuente)
Sigue el patrón que este mismo fichero ya usa para trabajos (`CAMPO_FECHA_TRABAJOS`, SCRUM-108:
«ESTA CONSTANTE ES LA ÚNICA FUENTE… derivado, nunca escrito a mano en dos sitios»).

- `GET /expenses.csv` ahora llama a **`buildGastos`** en vez de su cabecera+filas a mano. Con eso el
  suelto gana `Registrado por` y ambas descargas nacen del MISMO código: no pueden divergir.
- `buildGastos` recibe un `category?` opcional (filtro que solo tiene el suelto, `?category=materiales`).
  El ZIP no lo pasa → `undefined` = `'all'` → no filtra: **comportamiento del paquete intacto** (aditivo).
- El comentario mentiroso (exportData.ts:299) se reescribió para decir lo que el código hace: este
  builder es la única fuente, lo usan los dos caminos, y el guard cae si divergen.

## 🔴 El guard (lo que de verdad cierra esto) — DERIVADO de las dos fuentes
`tests/scrum343-cabecera-gastos-unica.test.mjs`: falla si las dos cabeceras dejan de ser idénticas.
- **Cabecera del ZIP** = `buildGastos(...).header` (lo que `construirCsvsDelPaquete` mete como gastos.csv).
- **Cabecera del suelto** = se INVOCA el handler real `GET /expenses.csv` (patrón SCRUM-263, sin BD/turno)
  y se parsea la 1ª línea del CSV que emite.
- **NO hay lista escrita a mano** en el assert: escribir las 9 columnas sería la cuarta lista sin guard
  (el test pasaría verde contra su propia copia). Se comparan las dos cabeceras derivadas con `deepEqual`.
- **SUELO:** si el derivador NO saca una cabecera de gastos real de alguno de los dos caminos (vacía, o
  sin las columnas ancla `Fecha`/`Importe`), FALLA — dos vacíos no pueden pasar por «coinciden».

**Rojo por el mecanismo (sobre el bug REAL, sin inyectar nada):** el guard corrido contra el código
ANTES del arreglo falla con la divergencia real — `ZIP (9)` vs `suelto (8)`, falta `Registrado por`.
Verde después. **Control negativo:** cambiar la cabecera compartida (en `buildGastos`) mueve a LOS DOS
caminos juntos → siguen idénticos → el guard **NO cae** (solo cae ante divergencia, no ante cambio
coordinado). Demostrado en dist y restaurado con build.

## Las dos caras (runtime, no solo que el test pase)
Segundo test: con un gasto de muestra, ZIP y suelto producen un CSV **alineado** (tantos campos como
columnas) y el suelto **ya lleva** `Registrado por` relleno con el autor. Las dos descargas siguen
produciendo un CSV válido después del cambio.

## Medido pero NO arreglado (los dos avisos de la descripción — decide el fundador)
1. **`plansView.js:57`** — el rótulo **«cobros»** enlaza a `/admin/exports/invoices.csv` (que audita como
   `facturas.csv`), no a `/admin/exports/charges.csv` (que SÍ es cobros y existe). Es **ambiguo**: o el
   rótulo debe decir «facturas» (renombre → microcopy, regla 30, lo aprueba el fundador — NO lo escribo)
   o el enlace debe apuntar a `charges.csv` (arreglo funcional). No lo toco; lo decides tú.
2. **`charges.csv` y `jobs.csv`** se generan (rutas `/admin/exports/charges.csv` y `/jobs.csv`, y van en
   `datos.zip`) pero **NO tienen entrada de UI en ninguna vista** (public/ solo enlaza expenses, invoices,
   quotes, customers.csv y datos.zip — confirmado por barrido). Es el patrón de la casa otra vez
   (generado sin entrypoint): exponerlos o dejar de generarlos lo decides tú. **No construyo la entrada.**

## Fuera de alcance (NO tocado)
`prisma/schema.prisma`, el camino de emisión, los otros builders (`buildClientes` tiene DOS criterios a
propósito — SCRUM-104, no se unifica), y los dos avisos de arriba.

## Ficheros
- `src/modules/exports/domain/exportData.ts` — `buildGastos` gana `category?` (aditivo) + comentario corregido.
- `src/modules/exports/app/routes/exports.routes.ts` — `/expenses.csv` usa `buildGastos` (import + llamada).
- `tests/scrum343-cabecera-gastos-unica.test.mjs` — el guard (derivado) + las dos caras.

**Suite: antes 1347 · 1280 pass · 0 fail** → **después 1349 · 1282 pass · 0 fail · 67 skip** (+2 tests, +2 pass).

[exportData.ts:320]: ../../src/modules/exports/domain/exportData.ts
[exports.routes.ts:695]: ../../src/modules/exports/app/routes/exports.routes.ts

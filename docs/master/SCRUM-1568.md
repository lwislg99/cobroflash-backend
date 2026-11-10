# SCRUM-1568 · portal del cliente: la línea del presupuesto se pinta con su descuento, y el apartado vacío

**Medido contra:** `origin/main` = `77ce98573b1b5e090dfcf7754c4e7960bc63b85a` · 2026-10-27T15:31:47Z (cabecera `Date` de GitHub)

A9: aviso → cicatriz J2 «copié `fetch` de una sonda que corre en un proceso hijo a un test que corre en el propio proceso, y con `--test-force-exit` el fichero salió 0xC0000409 con sus 4 casos en verde» — no se pudo comprobar: la regla «`node:http` con `agent: false`, nunca `fetch`» (SCRUM-1204) vive en comentarios y ningún guard la hace cumplir (10 ficheros de `tests/` llevan `await fetch(`; medido con `grep -l`)

Lo escribe J2 (`jv-j2bl`). Decisión del fundador: SCRUM-1568 c.21043; carril J2: c.21060 (`node scripts/carriles.mjs de src/modules/system/app/routes/customerPortal.routes.ts` → J2, `dos-equipos.md:125`).

## Qué cambia

`src/modules/system/app/routes/customerPortal.routes.ts`, **sólo la tarjeta del PRESUPUESTO**. Cada línea ya no se pinta como `qty||1 × price||0 × (1+tax)`, sino con `importeDeLineaDelPresupuesto`:

- **la línea va con su descuento** (c.21043, punto 1). No hay una cuenta nueva: es `calcTotal([l])`, el mismo término (`precioConDto` × IVA) con el que se guarda `quote.total`;
- **una cabecera de apartado sale vacía** (c.21043, punto 2). Se reconoce por su marca, con `lineasQueSuman`.

No hay fila «Descuento» ni ningún texto nuevo, y las clases y el marcado son los mismos.

**Lo que NO es igual que en la página de firma y en el PDF, y no se ha tocado:** esas dos superficies pintan la línea en NETO (`qty × price`, sin `dto` y sin IVA) y cuadran en el pie. El portal no tiene pie y pinta la línea con IVA desde antes de este ticket. La decisión pide la línea con descuento, sin texto nuevo, así que la línea sigue llevando IVA y ahora suma el total. El enunciado pedía «la misma cuenta que la página de firma o el PDF», pero ninguna de las dos aplica el `dto` en la línea. La cuenta de la casa que sí lo aplica es la del total.

## Medido

- **Rojo primero**, contra `main`: el ejemplo del ticket (2 × 100 € al 21 % con un 10 % de descuento) pinta la línea a 242,00 € con el total a 217,80 €, y el apartado a «0,00 €». Caen 3 casos de 4; el que pasa es el control positivo (1 + 3 = 4).
- **Verde después:** `tests/scrum1568-portal-linea-con-descuento.test.mjs`, 4 de 4, tres pasadas con `--test-force-exit`. El test pide la ruta real con un Prisma de mentira. Lo esperado sale de `calcTotal`, no de un literal. El cuarto caso suma las líneas de un presupuesto con apartado, dos descuentos y dos tipos de IVA, y comprueba que dan el total.
- **Mutaciones**, con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` sobre las dos de `MUTACIONES_QUE_ME_TUMBAN`: **2 de 2 tumban su caso**. Después, el árbol queda con el mismo diff.
- **Build con tipos** (`tsc -p .`, sin `--noCheck`): salida 0.

## Sin medir, o fuera

- **Descuento GLOBAL** (`discountGlobalAmount`): si un presupuesto lo lleva, las líneas siguen sumando más que el total, porque el global no es de ninguna línea. Decir dónde está la resta exige una fila o un texto, y eso pide firma (regla 39). No se ha tocado.
- **La tarjeta de FACTURA** no se ha tocado. Sus líneas salen de `lineasParaFacturar`, que ya les escribe el precio con el `dto` aplicado (`invoiceLines.service.ts:113`). El `:378` del enunciado era el total del presupuesto (leído en `main` del 19-oct), no la factura. Además, esa zona la toca SCRUM-1573b.
- **Una línea que no es apartado y llega sin `qty` o sin `price`** salía con `qty||1` y `price||0`. Ahora sale vacía, como en la página de firma (`importeDeLinea`, SCRUM-1442). Es una forma que `calcTotal` ya no sabe sumar (da NaN), así que el total de ese presupuesto tampoco existe.
- **No se ha verificado en yaqu.app.** Ver el portal de un cliente pide su token, y no lo tengo.
- **Suite entera en local: NO CORRIDA** (orden del orquestador: la cola de CI está saturada). Los guards que sí se corrieron están en el comentario de Jira.

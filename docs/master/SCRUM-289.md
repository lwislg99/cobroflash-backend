# SCRUM-289 · A0.3 — censo de los sitios que asumen origen (incremento 1, sin entrypoint)

**Fecha:** 5-ago-2026 · **Carril:** A (núcleo fiscal) · **Gate:** sin gate — no hay superficie nueva

**Medido contra:** `origin/main` = `f1a8ca507d6df9d530976c3a00289e051014fb0a` · 2026-08-05T04:10:15+01:00

**Suite en esa base:** 1349 tests · 1282 pass · **0 fail** · 67 skip · `npm test` exit **0**
**Suite con este cambio:** 1360 tests · 1293 pass · **0 fail** · 67 skip · exit **0** (+11 = los 11 de este guard)

> **ALCANCE: este incremento NO construye el botón.** Sin entrypoint, sin UI, sin microcopy, sin
> flag. `prisma/schema.prisma` intacto. A0.3 es UI y dispara AB6; eso es el incremento 2. Aquí se
> hace la parte peligrosa, que es la que no necesita pantalla: **un botón encima de sitios que se
> degradan en silencio entrega una factura que parece bien y no lo está.**

## Qué entra

- `tests/_censo-origen-factura.mjs` — analizador **AST** + el censo de los 24 sitios, leídos uno a uno.
- `tests/scrum289-censo-origen-factura.test.mjs` — suelo, control positivo, 3 rojos, 3 controles
  negativos y el guard con trinquete (11 tests).

## Método, y el fallo que tuvo el método

Población declarada: llamadas del ORM a `invoice` y `expense` que devuelven o cuentan una
**POBLACIÓN** (`findMany`/`findFirst`/`count`/`aggregate`/`groupBy`/`updateMany`/`deleteMany`).
`expense` entra porque el margen se calcula por `quoteId`.

AST y no `grep`, por lo de siempre: `quoteId` sale en 32 ficheros y un guard de texto se caza a sí
mismo en el comentario que explica la prohibición (SCRUM-176/168/3/193).

🔴 **La primera versión del analizador daba 18 sitios y NO veía el que motiva el ticket.** El
embudo filtra así:

```ts
const soloDePresupuesto = { quoteId: { not: null } };
client.invoice.count({ where: { merchantId, createdAt: inPeriod, ...soloDePresupuesto } })
```

Dentro del `where` no aparece `quoteId` por ningún lado: aparece `soloDePresupuesto`. Buscar el
identificador en el subárbol devolvía **limpia** justo la consulta que excluye las facturas sueltas
del embudo. Con los spread resueltos contra las declaraciones del mismo fichero —y **OPACO** cuando
no se pueden resolver, fallando cerrado— salen **24**. El control positivo del test fija ese caso
para que no se vuelva a perder.

## Los cuatro sitios que el ticket manda mirar

| informe | dónde | veredicto |
|---|---|---|
| **Rendimiento del equipo** | `metrics.service.ts:434` | **TRATADO** — SCRUM-236 ya quitó el `quoteId: { not: null }`; lo no atribuible se ve en «Sin asignar» en vez de tirarse |
| **Funnel de conversión** | `metrics.service.ts:203-204` | **POBLACIÓN** — excluye a propósito y **de forma simétrica** en las dos etapas; la asimetría era el bug que cerró SCRUM-236. Correcto por diseño |
| **Margen por trabajo** | `expenses.service.ts:185` (`getQuoteMargin`) | 🔴 **HUECO declarado** — el margen solo existe por presupuesto: una suelta no da un número malo, **no aparece** |
| **Rentabilidad por servicio** | `metrics.service.ts:265` (`getServiceMetrics`) | fuera de la población: arranca de `quote.lines` y su `revenue` nunca fueron facturas. No entra al censo, y se dice para que el cero no se lea como «no hay» |

Y el P&L (`reports.routes.ts:28`), que es lo más cercano a «margen» a nivel de informe, **también
está tratado**: trae todas las pagadas y usa `quoteId` para separar «no atribuible» de «del
propietario» (SCRUM-228).

## Reparto de los 24

**CLAVE 4** (el origen es la clave de búsqueda de un registro, no un filtro de población) ·
**POBLACIÓN 5** (la población es «lo nacido de un presupuesto», y está escrito) ·
**TRATADO 2** · **PROYECCIÓN 5** (solo arrastran el quote en el select; el null ya está guardado —
SCRUM-287, y el `as any` lo quitó SCRUM-342) · **OPACO 6** (el `where` no es literal; leídos a
mano, no atan al origen) · **HUECO 2**.

## Los dos huecos: declarados, NO tapados

El ticket exige tapar todos los (b) «y el que se quede fuera se declara con su motivo». Estos dos se
declaran:

1. **`getQuoteMargin`** (`expenses.service.ts:185`) — el margen se calcula por `quoteId`. Una
   factura suelta no tiene margen.
2. **Gastos por cliente** (`customersAdmin.routes.ts:153`) — se atribuyen **solo** vía
   `quote.customerId`; `Expense` no tiene `customerId`. Un gasto sin presupuesto no llega nunca a
   su cliente.

**Motivo de no taparlos aquí, y es el mismo para los dos: son PREEXISTENTES.** Ya afectan al flujo
de albaranes/recapitulativa, que fija `quoteId: null` a pelo — la factura suelta ensancha el hueco,
no lo abre. Y taparlos es **cambiar el modelo de atribución de gastos**, que ni es este incremento
ni cabe en él (regla 37: solo se arregla dentro si es la misma zona **y** bloquea **y** cabe).

## El (b) de n8n: fuera del censo por población, y sin tapar

`invoice.routes.ts:119-137` sale sin `merchant` ni `customer` con el quote null. **No entra en este
censo** y no es un olvido: este analizador mide **poblaciones**, y eso es un camino de lectura de un
registro suelto — otra pregunta, ya medida en SCRUM-287. Sigue sin clasificarse como (a) o (b)
porque depende del consumidor de n8n, **que no está en el árbol**. Taparlo sin saber qué es sería
inventarse la respuesta.

## Verificación

- **Rojo por el mecanismo, en el árbol REAL** (no un fixture): inyectado un
  `prisma.invoice.count({ where: { merchantId, quoteId: { not: null } } })` en `metrics.service.ts`,
  el guard falla nombrando `metrics.service.ts::invoice.count#3 (línea 540)` con su atadura. Revertido
  → verde. No es un `SyntaxError`: es el mecanismo.
- **Rojo por spread**: el mismo caso escrito como en el árbol (`...soloDePresupuesto`) también cae.
- **Rojo por opacidad**: un spread que no se puede resolver **no se da por limpio**.
- **Controles negativos (3)**: una consulta de facturas sin origen **no** salta; un **comentario**
  con `where: { quoteId: { not: null } }` dentro **no** salta (la trampa del guard de texto); y
  `prisma.job.findMany({ where: { quoteId } })` **no** salta (la población está acotada).
- **Suelo**: si el analizador no encuentra sitios, falla; y el control positivo exige ver el embudo.
- **Trinquete**: si el censo nombra un sitio que ya no existe, falla.

## Avisos

- **Dominio:** fiscal/invoicing es **carril A** (ASESOR.md §6) y esta entrega la firma el carril B.
  La regla §4.2 no es «no tocar», es **avisar**: queda avisado aquí y en el PR.
- **Zona roja:** entra en `/tests/`, que está en la lista de `ASESOR.md` §4 y en `CODEOWNERS`.
- **Lo que NO se toca:** `prisma/schema.prisma`, el botón «Nueva factura», la microcopy, el flag
  `INVOICING_ES_ENABLED` y la presentación de la pantalla de factura (B2).

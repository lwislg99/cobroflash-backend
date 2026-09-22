# SCRUM-1035 · Las cifras del cliente cuentan TODOS sus documentos, no solo los últimos 20

**Medido contra:** `origin/main` = `aa60dfad423f175a47efe21b0713a6e1ea71426e` · 2026-09-21T18:25:16Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1035-cifras-del-cliente-todas` · **Carril:** S1 · CRM Ola 1 · solo lectura (dinero: no toca cobros, estados ni facturas). Aviso D1 de ficheros de J2 dejado en el ticket antes de tocar.

## Paso 0 (leído en `origin/main`, y reproducido por el test con 25 documentos)
`GET /admin/customers/:id/detail` (`customersAdmin.routes.ts`): `quote.findMany` e `invoice.findMany` con `take: 20`, y `stats.totalQuotes/acceptedQuotes/totalBilled/totalPaid` salían de esas filas. La KPI «Pendiente de cobro» además se sumaba en el navegador (`customerDetailView.js`) sobre las mismas 20. Un cliente con 25 facturas veía cifras de 20.

## Lo que cambia
- Servidor: `count` y `aggregate` en la base, siempre con `customerId` + `merchantId` (`propios`): totalQuotes, acceptedQuotes, totalBilled (todas), totalPaid (`paid`), y nuevos `totalPending`/`pendingCount` (`pending`). Las listas `quotes`/`invoices` siguen en 20 (la pestaña de documentos).
- Cliente: `customerDetailView.js` usa `stats.totalPending`/`pendingCount` cuando llegan (con caída al cálculo anterior si no). Sin texto nuevo, sin esquema.
- `totalPending` es el sitio que reutilizará SCRUM-1043 («quién me debe»): un solo cálculo.

## El juez: `tests/scrum1035-cifras-del-cliente-todos-sus-documentos.test.mjs` (sin banco)
Handler real sobre un mini-Prisma en memoria que respeta `where`/`take`/`aggregate`: 25 facturas (10 pagadas de 100 €, 15 pendientes de 50 €) y 23 presupuestos → 1.750 / 1.000 / 750 / 15 / 23 / 9; la lista sigue en 20; otro merchant (con 7.777 € propios sobre el mismo cliente) no suma nada y no ve la ficha. Mutaciones (3, en rojo; restaurado, verde): cifras otra vez sobre las 20 · sin `merchantId` · pendiente sin filtro de estado.

## Límite
Los agregados de Prisma se probaron contra un doble, no contra Postgres; su semántica (`_sum`, `_count`, `count`) es la estándar y la consulta no cambia de tabla ni de índice (filtra por `customerId`+`merchantId`, como las listas).

# SCRUM-1031 · los tres fallos de la ficha del cliente, medidos EN STAGING

**22-sep-2026 · medido sobre `origin/main` `b8e3f81a61344f5cfa94184be9e31c45c1270cdd`** (tip de main en el
momento de la sonda; staging servía exactamente ese commit — `/version` lo confirma).

Sonda: `sonda.mjs` (este directorio). Crea un cliente `ZZZ PRUEBA 1031 …` y hasta 21 presupuestos en
el merchant QA Staging, mide, y borra. La primera pasada no pudo borrar el cliente por una restricción
de FK (un cliente con presupuestos no se puede borrar por la API); se limpió con `limpiar-1031.mjs`
(Prisma directo, scoped por nombre) — 21 presupuestos + 1 cliente borrados, control final: 0 restantes.

## A. `GET /admin/customers/duplicados` capturada por `/:id`

**OCURRE 🔴.** `customersAdmin.routes.ts:45` registra `router.get('/:id', …)` ANTES que
`router.get('/duplicados', …)` en `:75`. El comentario de `:67-69` («Va ANTES de `/:id` a propósito»)
describe una intención que el código no cumple: el orden real es `/:id` primero.

Medido:
```
GET /admin/customers/duplicados?phone=34000009999 → 400 {"error":"invalid_id"}
```
`/:id` intenta `Number('duplicados')` → `NaN` → 400 sin `next()`. La ruta `/duplicados` nunca se
alcanza. El aviso de cliente duplicado (SCRUM-578, CONT-05 punto c) no puede salir nunca.

## B. `PATCH /admin/customers/:id` (NIF desde el Trabajo) sin ruta

**OCURRE 🔴.** `jobDetailView.js:3058-3060` manda `PATCH /admin/customers/:id` para guardar el NIF
capturado en el flujo de un Trabajo. `customersAdmin.routes.ts` solo declara `router.put('/:id', …)`
(`:129`); no hay ningún `router.patch('/:id', …)`.

Medido sobre un cliente de prueba real (id 3933):
```
PATCH /admin/customers/3933 {"taxId":"B12345678"} → 404 {"error":"not_found"}
PUT   /admin/customers/3933 {"taxId":"B12345678"} → 400 {"error":"validation_error"}  (control: la
      ruta SÍ existe y procesa — el 400 es porque el payload mínimo no cumple el resto del schema,
      no porque falte la ruta)
```
El guardado del NIF desde la ficha 360 de un Trabajo falla siempre con 404.

## C. Las cifras (stats) con más de 20 documentos

**NO OCURRE ✔ — ya arreglado (SCRUM-1035).** `customersAdmin.routes.ts:296-321` calcula
`stats.totalQuotes`/`totalBilled`/`totalPaid` con `prisma.quote.count()` / `prisma.invoice.aggregate()`
SOBRE TODOS los documentos del cliente; el `take: 20` (`:302`, `:308`) es SOLO para las listas de la
pestaña «documentos», no para las cifras (comentario explícito en `:296-297`).

Medido creando 21 presupuestos sobre un cliente de prueba (id 3934, borrado al final):
```
presupuestos creados = 21
GET /admin/customers/3934/detail →
  stats.totalQuotes = 21   (cuenta los 21)
  quotes.length      = 20   (la lista sigue capada, como se espera para la pestaña)
```
El ticket lo dedujo del commit `6db52e16`; SCRUM-1035 ya lo corrigió antes de esta medición.

## Recomendación

- A y B: abrir ticket de arreglo (no tocan camino de emisión fiscal; es CRM/`src/modules/system`).
  Aceptación del propio SCRUM-1031 pide abrir estos tickets — hecho, ver comentario en Jira.
- C: cerrar sin acción — ya arreglado, con evidencia corriendo.

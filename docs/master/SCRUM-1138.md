# SCRUM-1138 — Falta PATCH /admin/customers/:id

**Sesión 1 · 25-sep-2026 · rama `scrum-1138-patch-customers-id`**

**Medido contra:** `origin/main` = `bf4d82c68cc74c390af36f92c90cdb915e8c31e8` · 2026-09-25T20:58:50+02:00

## PASO 0 (medido antes de tocar código)

Confirmado hoy, corriendo: `customersAdmin.routes.ts` solo registraba `router.put('/:id', …)`,
nunca `router.patch`. `jobDetailView.js` manda el NIF con `apiRequest('/admin/customers/${id}',
{ method: 'PATCH', body: JSON.stringify({ taxId: nif }) })` antes de emitir — 404 silencioso, el
NIF nunca se guarda.

## Hecho

`customerUpdateSchema` ya es `customerCreateSchema.partial()` (`schemas.ts:658`): el `PUT`
existente YA se comporta como una edición parcial, así que no hay una semántica de «reemplazo
total» que perder al aceptar también `PATCH`. Es el mismo patrón que ya usan `jobs.routes.ts`,
`albaranes.routes.ts`, `partes.routes.ts` y `quoteRequests.routes.ts` (PATCH en `/:id`).

- `customersAdmin.routes.ts`: el cuerpo del antiguo `router.put('/:id', …)` se saca a
  `actualizarClienteHandler` (un único handler, no dos copias) y se registra en
  `router.put('/:id', …)` y `router.patch('/:id', …)`.
- `adminRouteDeclarations.ts`: nueva entrada `PATCH /admin/customers/:id` en `TECNICO_ALLOWED`,
  mismo motivo que el `PUT` de al lado (SCRUM-55 exige declarar rol en toda ruta `/admin` nueva).

## Verificación — rojo antes / verde después (medido, no narrado)

`tests/scrum1138-patch-customers.test.mjs`, mismo patrón que `scrum1057-duplicados-antes-de-id`
(despacha una petición de mentira A TRAVÉS del router real, `prisma.customer` mutado, sin BD):

1. Con `router.patch('/:id', …)` comentado: el test del caso cae — `notMatched: true` (exactamente
   el 404 silencioso del ticket).
2. Restaurado: 3/3 verde — el PATCH llega a `updateCustomer`/`prisma.customer.updateMany` con el
   `taxId` y el `merchantId` correctos; el PUT sigue funcionando igual (control); un id inválido
   sigue dando 400 con ambos verbos.

`guards:entrada`: 112/112 verde. Regresión en los tests hermanos de la misma ruta
(`scrum1057-duplicados-antes-de-id`, `scrum292-nif-antes-de-emitir`): 13/13 verde.

**Hallazgo propio durante la verificación:** este worktree nació con `node_modules` sin
`read-excel-file` instalada (declarada en `package.json`/`package-lock.json`, nunca bajada a
disco) — el mismo problema que reporté en SCRUM-1048, y que aquí bloqueaba directamente cargar
`customersAdmin.routes.ts` en el test. `npm install` lo sincronizó (dependencia YA aprobada en el
lockfile, no una nueva) — SOLO en este worktree, node_modules dejó de ser un junction al checkout
compartido; no toca el `node_modules` de otras sesiones. Con eso, la suite completa pasó de fallar
en cascada a 8352 tests con 4 rojos — 3 eran de este cambio (arreglados: censo de roles SCRUM-55,
anclaje por línea en mi propio test, registro de máster) y 1 (`scrum910d`) es un crash de proceso
ajeno (Gemini/rate limit), no reproducido aquí a propósito por presión de tiempo — se reporta, no
se investiga en esta tanda.

## No toca

Camino de emisión, ningún documento, ningún libro. Solo la ruta de clientes (lectura+escritura de
ficha, ya existente vía PUT) y su declaración de rol.

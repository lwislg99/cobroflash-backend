# SCRUM-370 · el gasto que el técnico no podía volver a ver

**Fecha:** 9-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `227657b227e1223d3e4f1b6f6306533c76fb8213` · 2026-08-09T20:34:25+02:00

## La premisa estaba a medias, y la mitad falsa importa

El ticket decía «guarda un gasto que luego no se ve en ninguna parte». Medido: **el gasto SÍ se
guarda** (`Expense.quoteId`) y **sí se ve** en la vista de Gastos. No se pierde nada.

El defecto real es más pequeño y más feo: «+ Añadir gasto» se construyó **para el técnico**
(SCRUM-135, el alta rápida desde la furgoneta), y al técnico se le oculta el nav de Gastos **y**
`GET /admin/expenses` es `requireRole('admin')`. Su propia API se lo negaba: tras el toast, el
gasto que acababa de meter desaparecía para él **para siempre**.

## Lo construido

`GET /admin/jobs/:id/gastos` — los gastos de ESE Trabajo, con el mismo candado que
`GET /admin/jobs/:id`: tenencia por `merchantId` **y** la regla de SCRUM-147 (un técnico solo ve
SUS Trabajos). Declarada en `TECNICO_ALLOWED` con su porqué: **la red fail-closed de SCRUM-55 la
rechazó hasta que se declaró**, que es exactamente para lo que existe.

**Por qué por el Trabajo y no abriendo `GET /admin/expenses?quoteId=`:** por el listado global, un
técnico podría enumerar cotizaciones y ver gastos de obras que no son suyas. Se abre lo justo, y
por el sitio que ya decide quién puede mirar.

## El límite con el ticket vecino, vigilado

**Sin totales, sin márgenes, sin comparar con el presupuesto.** Eso es rentabilidad por obra y
sigue en `GET /admin/expenses/margin/:quoteId`, admin-only y sin tocar. Hay un test que prohíbe las
palabras `margin`, `margen`, `total`, `rentabilidad` y `presupuestado` en el handler, con respaldo
de la negación (SCRUM-237), y otro que comprueba que **el listado global sigue siendo admin-only**.

## Guard

`tests/scrum370-gastos-del-trabajo.test.mjs` — 5 tests: suelo (la ruta existe y está declarada),
control negativo (el Trabajo ajeno da 404 y la comprobación va ANTES de leer nada), lista vacía en
vez de 404 cuando el Trabajo no tiene cotización, y los dos del límite.

## ⚠️ Pendiente, declarado

**La pantalla no está**: esto es solo el backend. Pintar la lista en la ficha del Trabajo es lo que
falta para que el técnico lo vea de verdad, y necesita microcopy (regla 30) — el rótulo de la
sección y qué se enseña de cada gasto.

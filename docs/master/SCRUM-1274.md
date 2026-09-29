# SCRUM-1274 — El presupuesto que nace desde un Trabajo, enganchado a ese Trabajo

**Medido contra:** `origin/main` = `8eaee4ac18dc8096cedc8a603aa99b372d0861bb` · 2026-09-29T10:21:27Z

Carril S2 (pantalla) · rama `scrum-1274-adicional-con-trabajo` · sesión `s2-29a`. Sale del barrido de
las piezas de S2 del censo SCRUM-1185.

## El defecto

«Hacer presupuesto», el hueco de un Trabajo sin presupuesto aceptado (`jobDetailView.js`), abría
`quotes-new` sin estado: ni el Trabajo ni el cliente. El presupuesto nacía suelto. Al aceptarlo,
`ensureJobForQuote` no encontraba ningún Trabajo y creaba OTRO, así que quedaban dos Trabajos para la misma
obra, con el dinero repartido entre los dos. El servidor ya sabía engancharlo con `job_id` (SCRUM-195,
`quotes.routes.ts`); el front nunca lo mandaba.

## Lo construido (solo pantalla; sin ALTER y sin tocar el servidor)

- `jobDetailView.js`: «Hacer presupuesto» navega con `template: { deTrabajo: { jobId, customerId } }`.
- `quotesView.js`: lee `template.deTrabajo`, deja elegido el cliente del Trabajo y **no restaura el
  borrador guardado** (traería otro cliente y otras líneas). `job_id` viaja en `POST /quote/create`
  **solo si el cliente elegido sigue siendo el del Trabajo**: el servidor comprueba el negocio, no el
  cliente, y un presupuesto de otro cliente no es de esta obra.
- **Por qué dentro de `template` y no en un cuarto argumento:** la firma
  `renderQuotesView(container, template, documentoSuelto)` la fijan SCRUM-140 y la garantía de la regla
  29 de SCRUM-600b. Tocar la firma habría sido rebajar esos guards. Sin `lines`, `template` no carga nada de
  plantilla (ni líneas ni aviso).
- Censo SCRUM-286: `job_id` pasa a `VIAJAN_SIN_PINTARSE` (es contexto, no un ajuste del profesional).
- Censo SCRUM-1185: `cuerpo · POST /quote/create::job_id` pasa a `retiradas`.

## Barrido del censo 1185, carril S2 (mismo PR)

25 piezas S2 en `origin/main`, no 35. Seis tienen ya ticket propio: SCRUM-1182 (4) y SCRUM-1183 (2). Las
otras 19:

- **Función y además defecto:** `job_id`. Es este ticket.
- **Función, en otro ticket:** los 4 campos de `PUT /admin/templates/:id` (no se puede editar una
  plantilla, solo renombrarla), que van a la parte C de SCRUM-1188.
- **Aparcado** (decisión de producto): `accept::evidence` y `reject::evidence`.
- **Premisa falsa:** `homeView.js::appHomePrefs`, que se escribe y se LEE en el mismo fichero.
- **Resto técnico** (9), cada uno con su motivo en el JSON. Dos van con aviso:
  - `PATCH /admin/jobs/:id::assignedUserId`: **no conectar**. Daría dos fuentes de «quién ejecuta el
    Trabajo».
  - `GET /admin/expenses/categories`: es gemela de `CATEGORY_LABELS` (`expensesView.js`).

## Tests

`tests/scrum1274-presupuesto-desde-el-trabajo.test.mjs`. Recorre la ficha REAL del Trabajo → «Hacer
presupuesto» → el editor REAL → «Generar» → el POST real → `CreateQuoteSchema` (dist) → `ensureJobForQuote`
(dist) con una base de mentira que cuenta los Trabajos creados al aceptar.

- Desde el Trabajo, al aceptar se crean **0** Trabajos nuevos.
- Control negativo: desde cero, sin Trabajo de origen, se crea **1**.
- Si el profesional cambia de cliente, `job_id` no viaja.
- Rojo por mutación: con la `jobDetailView.js` de `main` cae el viaje, y con la `quotesView.js` de `main`
  también.
- Vecinos (`quotesView`, `jobDetailView`, `app.js`, los dos censos): 1826/1881, 0 fallos. Los 55 saltados
  son de staging (`QA_DB_TEST`, `LIBRO_PG_URL`, `A55`, `BOT_SUITE`).

**NO VERIFICADO en yaqu.app:** la cuenta QA no tiene trabajos.

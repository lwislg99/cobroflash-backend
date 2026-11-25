# SCRUM-1818 · cambiar el plan de un comercio sin tocar Railway

## Parte S2 · SCRUM-1818b · 25-nov-2026 · S2 · selector de plan en el funnel de plataforma

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:29:35Z
A9: comprobación → `tests/scrum1818b-selector-de-plan.test.mjs`
Mutaciones: catálogo → `tests/scrum1818b-selector-de-plan.test.mjs`
**Skill UI:** cargada · ANTES de tocar la vista. Checklist AB6 sobre el diff: inventario AB3 (`select.input`,
`btn-secondary btn-sm`, `showToast`), cero `style=` nuevos en JS (la celda «Plan» conserva el suyo; el control se
monta por DOM). Una regla nueva en `styles.css` (bloque S2 `.funnel-plan`): selector y botón a 44 px de toque,
juntos y envolviendo si no caben. Botón deshabilitado hasta elegir un plan DISTINTO y durante el PUT. Capturas
antes/después medidas a 390 y 1280.

Rama `scrum-1818b-selector-plan`, desde `origin/main`. Encargo del orquestador (pieza ④, 25-nov-2026). El
servidor lo hace S1 en paralelo (rama `scrum-1818-activar-plan-servidor`, sin mergear). Esta parte NO depende de
su merge para construirse, pero SÍ para la prueba de punta a punta. ⚠️ Esa rama de S1 también crea ESTE
fichero: quien mergee el segundo junta las dos partes (add/add, sin solapes). [Escrito por la sesión, no por Luis.]

**Contrato consumido** (leído en la rama de S1, `src/modules/system/app/routes/planAdmin.routes.ts`, punta
`247eb29ac`, sin tocarla): `PUT /admin/plataforma/merchants/:id/plan` con `{ plan }` → 200 `{ id, plan, antes }`
· 400 `invalid_id` / `plan_desconocido` · 403 `forbidden` · 404 `merchant_not_found` · 500. La puerta de
fundador vive en el servidor. El id de cada comercio ya viaja en `GET /admin/metrics/platform-funnel`
(`metrics.service.ts`, `rows[].id`).

**Qué entra.**
- `public/dashboard/js/reportsView.js` (S2), tarjeta «Funnel de plataforma»:
  - se quita el `slice(0, 15)`: salen TODOS los comercios;
  - la celda «Plan» de cada fila lleva un `select` con los cuatro valores literales y «Cambiar plan»;
  - `window.confirm` con el literal firmado → `PUT` → `showToast` de éxito o del error que toque, nunca el
    texto del servidor (SCRUM-644);
  - con «Cancelar» en la confirmación, o con fallo, el selector vuelve al plan actual.
- `public/dashboard/css/styles.css` (contenedor S2): bloque `.funnel-plan`.
- `tests/scrum1818b-selector-de-plan.test.mjs` (nuevo, banco de vistas).
- `scripts/capturas-1818b-selector-plan.mjs` (nuevo, con su fila S2 en `dos-equipos.md` §3 y `carriles.mjs
  generar` → `comprobar` IGUAL) y `docs/master/evidencias/SCRUM-1818b/` (8 capturas).

**Literales** (SCRUM-1656 c.22694, byte a byte; cero textos más):
- opciones: `trial` · `pro` · `founding` · `equipo`;
- aria-label: «Plan de {nombre}»;
- botón: «Cambiar plan»;
- confirmación: «¿Cambiar el plan de {nombre} de {actual} a {nuevo}? Solo cambia el plan dentro de YaQu: no toca
  Stripe ni cobra nada.»;
- éxito: «Plan de {nombre}: {nuevo}.»;
- 400: «Ese plan no existe. Los que hay: trial, pro, founding, equipo.»;
- 403: «Solo la cuenta del fundador puede cambiar planes.»;
- 404: «Ese comercio ya no existe.»;
- otro: «No se pudo cambiar el plan. Inténtalo otra vez.»

**Rojo primero, medido** (resumen del runner): sin el código, `ℹ tests 5 · pass 0 · fail 5`. El primer rojo
lleva su CIEGO: el comercio 1 sí se ve y el 20 no, así que el rojo es el tope y no una tarjeta sin pintar. Con
el código: **5/5**.

**Mutaciones** (pasada única, guion fuera del árbol): base 5/5; las **4** del catálogo **mueren** (tope de 15 ·
confirmación saltada · PUT con el plan viejo · literal del 403 borrado).

**Regresión dirigida:** 705 ficheros de `tests/` que leen `reportsView`, `styles.css`, `public/dashboard/js`,
`apiRequest(`, trinquetes o microcopy, en lotes de 250 (la lista entera no cabe en una línea de órdenes de
Windows): 6340 tests · 6308 pass · 27 skip · **5 fail, ninguno de esta rama**:
- `scrum1340` (en `scrum811c`): el registro de SCRUM-1852 en `main`, que cura el orquestador (#3440);
- `scrum1199` ×2: este worktree no tiene `node_modules` propio y `createRequire` no encuentra `express`;
- `scrum498`: el cliente de Prisma COMPARTIDO no casa con el esquema (`_prisma-client-guard.mjs` en rojo:
  columnas de `Invoice` «falta en el cliente»). Lo coordina el orquestador, §10; esta rama no toca esquema;
- `scrum763`: `dist/` compilado en otra rama; tras recompilar, verde.

**Capturas** (`node scripts/capturas-1818b-selector-plan.mjs`, salida 0): 8 de 8, con 20 comercios.
- DESPUÉS: 20 filas; selector y botón de 44 px, dentro de la ventana, también en la última fila. A 390 se apilan
  (`[142,346,103,44]` / `[142,396,106,44]`); a 1280 van en línea (`[594,424,103,44]` / `[703,424,106,44]`). Sin
  desborde de página (la tabla conserva su scroll horizontal) ni errores de consola.
- CONTROL POSITIVO: ANTES hay 15 filas y ningún selector.

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| quitar el slice(0,15) | `tests/scrum1818b-selector-de-plan.test.mjs`, primer caso; `ultima-fila-despues-1280.png` |
| selector de plan por comercio + botón | mismo test, primer y segundo caso; `primera-fila-despues-390.png` |
| microcopy firmada byte a byte | mismo test, casos 2-5 (opciones, aria-label, confirmación, éxito, 400/403/404/otro) |
| skill yaqu-premium-ui antes de tocar la vista | la línea **Skill UI** de arriba |
| prueba de punta a punta con el servidor de S1 | NO HECHO → depende del merge de la rama de S1; después, en yaqu.app (regla 42) |

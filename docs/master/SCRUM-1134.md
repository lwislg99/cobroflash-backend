# SCRUM-1134 · Beneficio "sobre la base" en Informes

**Rama:** `scrum-1134-beneficio-sobre-la-base` sobre `origin/main` `24123060d733af2aa4c7517b481358896c843b4f`.
**Fecha:** 2026-09-25 18:35 UTC (`gh api -i zen`).

## Qué encontró la auditoría

SCRUM-1047 (CON-06) se cerró Finalizada el 22-sep con el servidor calculando
`revenueBase`, `revenueWithVat`, `revenueSinDesglose`, `expensesBase`,
`expensesWithVat`, `expensesSinClasificar` y `profitBase` (`/admin/reports/pl`,
dentro de `totals`), pero `reportsView.js` seguía leyendo solo los 4 campos
viejos (`revenue`, `expenses`, `profit`, `maintenance`). El profesional seguía
viendo el beneficio mezclado con IVA.

## Qué se construyó

- `public/dashboard/js/reportsView.js`: selector "Con IVA / Sobre la base" en
  la tarjeta de Informes, con el lenguaje visual heredado de
  `.customers-tabs`/`.customers-tab` (AB3 — el control "uno de N" que ya
  existe, no un componente nuevo).
- Las 3 tarjetas KPI (Ingresos/Gastos/Beneficio) cambian entre
  `revenue/expenses/profit` y `revenueBase/expensesBase/profitBase` según el
  modo. El KPI de mantenimientos (aditivo, A15.3) solo se muestra en "Con IVA".
- Aviso (`.alert.warning`, ya existente en el sistema) cuando
  `revenueSinDesglose.count > 0` o `expensesSinClasificar.count > 0`: dice
  cuántas facturas/gastos y cuánto importe quedan fuera del cálculo sobre la
  base — regla 7 (sin claims fiscales): lo que se excluye se declara, nunca se
  calla ni se suma a la base.
- Aditivo real: si el backend no manda los campos nuevos (`tieneBase === false`),
  se pinta exactamente como antes, sin pestañas.

## Verificado

- `npm run test` (subset relevante: scrum739, scrum698, scrum743, scrum755,
  scrum764, scrum697, scrum228, scrum236) — 75/75 verdes, 0 skip. Build
  completo (`npm run build`) bloqueado en este worktree por una dependencia
  no instalada en el `node_modules` compartido (`read-excel-file`, de
  `src/modules/system/domain/importarClientes.service.ts`, fichero de J2 —
  no es de este ticket ni de este carril, no se toca; probado que `dist/`
  compilado ya existía vía junction y los tests corren contra él sin
  recompilar).
- Montaje real con el banco de vistas (`tests/_banco-vistas.mjs`,
  `renderReportsView`), con datos de servidor reales (incl.
  `revenueSinDesglose`/`expensesSinClasificar` > 0): las 2 pestañas aparecen,
  el clic cambia los 3 valores KPI y el `aria-pressed`, la nota de "sin
  desglose" aparece con el texto y los importes correctos y desaparece en
  modo "Con IVA". Probado también el fallback sin campos base: cero pestañas,
  comportamiento idéntico al anterior.
- Skill `yaqu-premium-ui` cargada antes de tocar UI. Checklist AB6: cero
  tokens/colores nuevos (reutiliza `.customers-tab`, `.kpi-card`,
  `.alert.warning`), objetivo táctil 44px heredado del componente, foco
  visible heredado, `aria-pressed` correcto.

## Hueco declarado

No se ha verificado en navegador real (yaqu.app) por no tener acceso a uno en
esta sesión — solo banco DOM + tests. Recomendado un QA visual antes de
cerrar el ticket en Jira.

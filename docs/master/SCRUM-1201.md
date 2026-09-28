# SCRUM-1201 — Retirar `getNextBillingStage` y `getStageAmount` (billingPlan.ts)

**Medido contra:** `origin/main` = `2bb2857144d7c80ee80bc780390d31f9ac8cfc7c` · 2026-09-28T13:59:13Z

Carril S1. Origen: censo de lo construido y sin consumir de S0 (SCRUM-1185).

## PASO 0 — premisa de S0, re-medida por S1

- `git grep -E "getNextBillingStage|getStageAmount" origin/main -- . ':!docs'`: fuera de
  `billingPlan.ts` solo aparecen su propio test (`tests/billingPlan.test.mjs`), las dos listas de
  declarados (`scripts/_sin-consumir-declarados.json`, `tests/_huerfanos-declarados.mjs`), dos
  COMENTARIOS (`jobs.routes.ts:1347`, `quotes.routes.ts:660`) y un nombre en la lista de
  «segundos cálculos prohibidos» de `scrum888g`. Cero llamadores en `src/`, `public/`, `scripts/`.
- `git log -S "getNextBillingStage(" -- src`: creada en `5142388b` (2025-11-26), último uso
  quitado en `48570d8e` (SCRUM-27, pagos flexibles).
- `git log -S "getStageAmount(" -- src`: creada en `31438a0a` (SCRUM-32); `48570d8e` (SCRUM-27)
  la dejó sin uso: el importe de cada tramo sale de `distributeStageAmounts(total, resolveBillingPlan(q))`.

La premisa cuadra con el árbol.

## Cambio

- `src/modules/quotes/domain/billingPlan.ts`: fuera las dos funciones. No cambia ningún camino
  vivo: `distributeStageAmounts`, `getBillingPlan` y `resolveBillingPlan` quedan igual.
- `scripts/_sin-consumir-declarados.json`: las dos claves pasan de `declaradas` a `retiradas`, con motivo.
- `tests/_huerfanos-declarados.mjs`: fuera sus dos entradas `MOTOR_EN_ESPERA` (el export ya no existe).
- `tests/billingPlan.test.mjs`: el caso «el 2º tramo es el RESTO» se prueba sobre
  `distributeStageAmounts` (misma aserción, mismos importes); nuevo caso que falla si alguna de
  las dos vuelve a exportarse.
- `scrum888g` sigue nombrando `getStageAmount` en su lista de prohibidos: es inocuo y se deja.

## Verificación

`npm run build` limpio; `billingPlan`, `scrum411`, `scrum494`, `scrum710b`, `scrum844b`,
`scrum1185`, `scrum888g`: 98/98. La tanda completa la corre el CI del PR.

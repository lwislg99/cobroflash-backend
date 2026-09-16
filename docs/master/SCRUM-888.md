# SCRUM-888 · La página de firma no enseña el importe de la señal

**Medido contra:** `origin/main` = `e7f155755446b2a848688cd59ba25c8d9bb9fb26` · 2026-09-16T20:53:10+02:00
**Rama:** `scrum-888g-senal-en-la-firma` · **Estado:** EN PR — ROJO (test-first). El defecto está
documentado y medido; el arreglo del código todavía no está en esta rama.

## SCRUM-888g (punto 7 de SCRUM-888)

**El defecto, medido en staging el 16-sep-2026** (presupuesto #4 del merchant QA, borrador):

- Condiciones `paymentTerms: 'MANUAL'` + plan propio `Señal 30 % / Resto al terminar 70 %`, total
  970,23 €. La página `/pay/quote/:token` pintaba la píldora de condiciones con el código crudo
  «MANUAL» y **ningún 291,07 €** — que es exactamente lo que se emitió como señal al aceptar el #6,
  con las mismas líneas. El cliente firma sin saber cuánto paga.
- **Causa:** `termsLabel` (`quoteDecisionLanding.routes.ts`) sólo conoce `FIFTY_FIFTY` y
  `FULL_UPFRONT`, devuelve cualquier otro código TAL CUAL, e ignora `customBillingPlan`.
- Y el camino normal del editor es peor: un plan propio se guarda con `paymentTerms: null`
  (`quotesView.js`, opción «CUSTOM»), y con `null` la página no pinta NINGUNA condición.

**La regla del arreglo (ya fijada en el test):** el importe de la señal sale de la MISMA función
que el cobro. Nada de un segundo cálculo — el importe esperado en el test se recompone
LITERALMENTE con lo que hace la emisión al aceptar (`resolveBillingPlan` →
`stageLinesReconciled` → `grossOfLines`), no con lo que pinte la página. Si la página calculara
por su cuenta y divergiera en un céntimo, el test cae.

## Commits (esta sesión, sólo ROJO)

| sha | qué |
|---|---|
| `78c01676` | ROJO — la firma con señal (plan propio, MANUAL/`null`) no enseña el importe |
| `71e25e58` | ROJO ampliado — planes de serie (FIFTY_FIFTY/FULL_UPFRONT) con importe, tiers con porcentaje (sin importe: aún no hay uno verdadero), MANUAL/SIN_CONDICIONES sin plan pintan igual que sin condiciones, ningún código interno visible, y el guard AST de «sin segundo cálculo» |

`tests/scrum888g-senal-en-la-firma.test.mjs` — 18 rojos por aserción medidos en CI (más los
controles ✅ que ya pasan: SUELO, «sin señal ni plan la página no cambia», la política de señal
de V8). No toca `psp.routes.ts` ni el camino de emisión: sólo lee (regla 38).

## Pendiente (fuera de esta rama)

El arreglo de `quoteDecisionLanding.routes.ts` (y de `quotesView.js` para que un plan propio no
se guarde con `paymentTerms: null`) que pone estos 18 en verde.

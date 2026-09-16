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

---

# APÉNDICE · SCRUM-888g · el arreglo: la página de firma enseña cada tramo con su importe

**Medido contra:** `origin/main` = `7cab3165369cfd29eadced8e5cb59ab447fe4867` · 2026-09-16T18:30:05Z (cabecera `Date:` de GitHub); rama al día contra `f12c1574681338e0d5940815e1ff6622210b3ed5` · 2026-09-16T19:17:39Z
**Rama:** `scrum-888g-senal-en-la-firma` · **Carril:** Sesión 3 · **Formato firmado:** SCRUM-888 comentario 15624

> El cliente firmaba un presupuesto con señal del 30 % leyendo «MANUAL» donde tenía que leer cuánto
> iba a pagar al aceptar.

## PASO 0 · Reproducido en staging (solo lectura)

Presupuesto **#4** del merchant `qa@staging.yaqu` (id 1875, borrador): `paymentTerms: 'MANUAL'`,
`customBillingPlan` = Señal 30 % / Resto al terminar 70 %, total 970,23, 0 facturas. Su página
`/pay/quote/:token`:

| | lo que pinta |
|---|---|
| píldora de condiciones | **«MANUAL»** |
| importes de la página | 689,00 · 54,51 · 58,33 · 801,84 · 168,39 · 970,23 — **ningún 291,07** |

El **#6** (id 1877, mismas líneas y plan, aceptado) emitió su señal por **291,07** (`stageLabel`
«Señal»). `buildBillingPlanView` sobre las líneas de los dos da `[291.07, 679.16]`.

**De dónde sale «MANUAL»:** `termsLabel` (`quoteDecisionLanding.routes.ts:179-183` en main) sólo
conocía `FIFTY_FIFTY` y `FULL_UPFRONT`, devolvía cualquier otro código tal cual e ignoraba
`customBillingPlan`. Y el caso del editor era peor: un plan propio se guarda con `paymentTerms: null`
(`quotesView.js`, opción «CUSTOM») y con null la página no pintaba **ninguna** condición.

## ROJO · empujado primero

`tests/scrum888g-senal-en-la-firma.test.mjs`. El importe esperado **no** sale de la función de la
página: se recompone con los pasos de la emisión al aceptar (`resolveBillingPlan` →
`stageLinesReconciled(lines, plan, i, distributeStageAmounts(total, plan)[i])` → `grossOfLines`), y
el suelo exige que dé 291,07 como en staging.

- `78c01676fabe4ecfcbc3b2f08dcbc9b936af6e52` — primer rojo: 6 de 10 caían.
- `71e25e5850334aa13b42f439e68577f70d3614d9` — rojo ampliado con lo decidido (planes de serie con
  importe, tiers con porcentaje, MANUAL/SIN_CONDICIONES sin plan igual que null): **16 de 27 caían**.
  Es el primer push de la rama.

## ARREGLO

`condicionesDePago` sustituye a `termsLabel`: pide los tramos a `buildBillingPlanView(quote, 0)`
(`emittedCount` 0 porque la página sólo se firma en draft/sent), nombra los de serie con los textos
que ya decía la píldora y los propios con los del profesional, y pinta importe o —con tiers—
porcentaje. Sin plan que pintar, sin píldora. Un tramo de serie sin nombre aprobado deja la página
sin píldora antes que enseñar su etiqueta interna.

## Mutaciones — cada una en rojo

Sobre `dist/`, cada mutación casando **una** vez, `dist/` restaurado y comprobado por hash:

| mutación | fallan |
|---|---|
| M1 · la página calcula el importe como `total × %` | 1 (FIFTY_FIFTY: 485,12 dos veces) |
| M2 · enseña la etiqueta interna del tramo de serie | 8 |
| M3 · importe también con tiers | 3 |
| M4 · sin condiciones se resuelve a pago completo | 3 |
| M5 · ignora el plan propio | 3 |
| M6 · MANUAL sin plan pinta el código | 6 |
| AST · un `distributeStageAmounts` en el fuente de la página | 1 |

⚠️ M1 **no** la caza el plan 30/70 del ticket: con esas líneas `total × %` redondea igual (291,07 y
679,16). La caza el caso FIFTY_FIFTY, y el AST caza cualquier llamada a las funciones de reparto.
Una aritmética escrita a mano con otras cifras que coincidieran en los casos del test **no** se
vería: el test lo dice en su cabecera y no se afirma más.

## POSITIVO · sin señal ni plan, idéntica a main

Medido renderizando con el `dist/` de main (`fa5ffa72`, sin cambios en la página ni en sus
dependencias frente a `origin/main`) y con el de la rama: sin condiciones, `MANUAL` sin plan y
`SIN_CONDICIONES` sin plan dan **el mismo HTML byte a byte** que main sin condiciones, con y sin
tiers. Control: `FULL_UPFRONT` sí difiere (lleva importe, por decisión).

## Visual · 360 y 390 px

Banco = HTML **real** de la firma del #4 servida por staging, con la píldora sustituida;
`chrome-headless-shell` directo, midiendo `scrollWidth` y la caja de la píldora contra la tarjeta.

| caso | 360 | 390 |
|---|---|---|
| real (291,07 / 679,16) | 1 línea, dentro | 1 línea, dentro |
| importes de 6 cifras | 2 líneas, dentro | 2 líneas, dentro |
| tres tramos de nombre largo | 3 líneas, dentro | 3 líneas, dentro |
| nombre de tramo de 58 caracteres sin espacios | 🔴 **desbordaba a 405 px** | 🔴 **405 px** |

El último lo abre este cambio (la píldora pasa a llevar texto del profesional), así que entra aquí
(regla 37): `.terms-badge` gana `max-width: 100%; overflow-wrap: anywhere`. Tras el cambio, **los
cuatro casos dentro y sin scroll horizontal** en los dos anchos. ⚠️ La medida visual **no** corre en
`npm test`: queda como evidencia de esta rama, no como guard.

## Declarado, no tocado

- **`quotes.routes.ts:343` · leído en código, no medido.** El PUT guarda
  `paymentTerms: body.paymentTerms ?? quote.paymentTerms`; el editor manda `null` con un plan
  propio, así que un presupuesto que pasa de MANUAL a plan propio **conservaría** «MANUAL». Puede
  explicar el #4 de staging; no se comprobó. Sin ticket, por decisión del orquestador: este arreglo
  lee el plan propio sea cual sea `paymentTerms`, y el efecto visible desaparece.
- **Camino de emisión intacto:** el diff no toca `quotes.routes.ts`, `billingPlan.ts`,
  `billingPlanView.ts` ni `invoiceLines.service.ts`; el test sólo los importa y los ejecuta.
- **Sin schema.**

## SCRUM-887 entró en main mientras esta rama corría en CI

El primer CI del arreglo (run 35140347955, sobre `f1aeb9887dc3204cdbbb32560a3f7d3dbbc9934d`) cayó con
el fichero entero en rojo, **suelo incluido**: `lineasParaFacturar: el presupuesto llega sin
`discountGlobalAmount` cargado`. SCRUM-887 (#1369, merge `7000a0cffe284fc99c669af2ba27e74ab9cb78c9`) hizo
que la emisión y `buildBillingPlanView` facturen `lineasParaFacturar(quote)` —el dto de línea
aplicado— y exijan `discountGlobalAmount` cargado. No era el arreglo: era la fixture.

- La fixture lleva `discountGlobalAmount: null` (en la página real `loadQuote` usa `include`, que
  trae todas las columnas escalares, así que el campo llega siempre).
- La recomposición de la emisión en el test pasa a `lineasParaFacturar(q)`, **igual que
  `quotes.routes.ts:650`** en main.
- Caso nuevo: **con dto de línea** la píldora enseña la señal con el dto aplicado, con control de que
  el dto mueve el importe (si no lo moviera, el caso no distinguiría nada).

Con eso la página siguió sin tocarse: sigue pidiéndolo todo a `buildBillingPlanView`, y por eso
heredó el cambio de SCRUM-887 sin una línea propia — que es justo lo que pedía el «sin segundo cálculo».

## Sobre la entrada anterior

La escribió `claude[bot]` sobre esta rama (`63156546`, 19:06Z) mientras el rojo corría en CI, y se
conserva tal cual. Su «Pendiente» nombra también `quotesView.js` (que un plan propio no se guarde
con `paymentTerms: null`): **no se toca**. Lo decidido es que la página lea el plan propio sea cual
sea `paymentTerms`, y con eso el `null` del editor deja de esconder las condiciones. Sus «18 rojos
en CI» y los 16 de la pasada local del fichero cuentan el mismo commit `71e25e58` con distinto recuento de
subtests; no se ha conciliado la diferencia.

La entrada P3-META-859 que añadió a `docs/BUGS.md` dice que `meta-guard` es un check
**obligatorio**: por lo medido en SCRUM-876 el único obligatorio es `build + tests`. No se corrige
aquí (otro carril): se señala.

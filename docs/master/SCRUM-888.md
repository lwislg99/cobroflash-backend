# SCRUM-888 · Punto 7 (rama 888g): la página de firma enseña el importe de la señal

**Medido contra:** `origin/main` = `7cab3165369cfd29eadced8e5cb59ab447fe4867` · 2026-09-16T18:30:05Z (cabecera `Date:` de GitHub); rama al día contra `e7f155755446b2a848688cd59ba25c8d9bb9fb26` · 2026-09-16T18:56:09Z
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

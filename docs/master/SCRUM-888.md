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
| M5 · ignora el plan propio | 3 (4 tras sumar el caso con dto de línea; las demás, iguales) |
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

## SCRUM-888b (punto 2 de SCRUM-888) · teclear un descuento no redibujaba el editor

**Medido contra:** staging `4b88ab67` (PASO 0) y `origin/main` `7c1f259e` (rojo), 17-sep-2026.
**Rama:** `scrum-888b-vista-previa-descuentos` · **Alcance decidido por el orquestador:** A + B.

**PASO 0 en staging** (editor nuevo, una línea de 8 × 24,95 € al 21 %, tecleando; 390 y 1280 px dan lo mismo):

| paso | total grande | vista previa |
|---|---|---|
| sin descuentos | 241,52 € | 241,52 € |
| dto de línea 15 % tecleado en su hoja (abierta y cerrada) | **241,52 €** | **241,52 €** |
| descuento global 25 € (también tras 6,5 s y un Tab) | 175,04 € | **241,52 €** |

**Causa** (`public/dashboard/js/quotesView.js`):

- **A** · el `input` del descuento global solo llamaba a `recalcTotals()`: ni `renderPreview()` ni `scheduleDraftSave()`.
- **B** · el dto de línea (`dtoInput`) **no tenía ningún oyente**. Cantidad, precio e IVA llaman a `onChange`;
  el dto no. De ahí salía el 539,05 € de SCRUM-883: el global recalculó y de paso recogió el dto de línea.

**Arreglo:** A llama a lo mismo que cualquier campo del dinero (recalcular, redibujar, borrador); B escucha
`input` con el MISMO `onChange` de la línea. Solo front, sin textos, sin servidor.

**Rojo y verde:** `npm run guard:descuento-redibuja` (panel real, `/admin/*` simulado, tecleo real a 390 y
1280 px). Contra `7c1f259e`: rojo en los dos anchos (dto: nada se mueve; global: 175,04 frente a 241,52; el
borrador no se guarda). Con el arreglo: 205,29 = 205,29 tras el dto y 175,04 = 175,04 tras el global, y el
borrador se guarda en cada paso. Mutantes (quitar B; quitar `renderPreview` de A): rojo en el guard y en
`tests/scrum888b-descuento-redibuja.test.mjs`.

**Fuera de este PR (decidido):**

- **C** · las FILAS de la vista previa hacen su propia cuenta sin dto (`totalLine = cant × precio × (1+IVA)`),
  mientras la fila del editor sí lo aplica. Siguen en 241,52 € con el dto puesto. Va con el punto 1, después
  del PR 2 de SCRUM-887.
- **Punto 3** (duplicar pierde el global): necesita servidor. `GET /admin/quotes/:id` no devuelve
  `discountGlobalAmount` (medido en staging: la clave no está) y `duplicateQuote` no lo pasa.
- **Hallazgo sin ticket:** el borrador del editor (`saveDraft`) no guarda ni el dto de línea ni el descuento
  global. Se guarda al tocarlos (ahora sí), pero sin ellos: al recuperar el borrador vuelven vacíos. Ya pasaba
  antes de este PR al tocar otro campo después de un descuento.

# SCRUM-888d · PR de servidor: el descuento global en el detalle (puntos 1 y 3) y la página de firma (punto 1)

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T14:03:57Z (hora del commit de main)
**Rama:** `scrum-888d-servidor-descuentos` · **Carril:** Sesión 1 · **Firma:** SCRUM-888 comentario 15788 · **Estado:** listo en local, sin empujar (va detrás del PR 3 de SCRUM-887).

## Qué cambia

- **`GET /admin/quotes/:id` devuelve `discountGlobalAmount`** (`null` si no hay). Lo medía la Sesión 2 en staging e437a51f: las líneas traían `dto` y el global no. Es precio, no margen: lo ve quien ve el total, y SCRUM-597 sigue verde.
- **Punto 3 (Duplicar):** en el servidor no hay ninguna ruta de duplicar. «⎘ Duplicar» (`quotesDetailView.js:1172`) lee ese GET y arma la plantilla en el front, así que la parte de servidor era solo el campo. Pasarlo a la plantilla es de la Sesión 2.
- **Punto 1 · página de firma** (`quoteDecisionLanding.routes.ts`): con descuento, el bloque de totales sale de `pieDePresupuesto`, la cuenta del pie del PDF: «Suma de líneas», «Descuento», «Descuento global» (los rótulos de SCRUM-594 sin los dos puntos), «Base imponible» e «IVA (x%)». Sin descuento se queda el camino de antes: `pieDePresupuesto` redondea la cuota sobre la base del tipo y `calcVatBreakdown` la acumula línea a línea, así que pasar todo por el pie habría movido céntimos de páginas que estaban bien. Aprobación en `docs/microcopy/2026-09-17-SCRUM-888-descuentos-en-la-firma.md`.

## Verificación

- **Rojo del GET** `551ac3566f8af2eeb306e3f590e8891f2c8815fd`, por la app real (HTTP, banco de SCRUM-597): el detalle respondía 200 con las líneas y su `dto`, pero sin la clave. **Arreglo** `0035fcb92c4131aed44623c6faf6833bf35a0860`.
- **Rojo de la firma** `ee76f08f5507a9bc935e20f3fbda7db176cf4628`: C3-B firmaba 559,70 y la página sumaba Base 539,49 + IVA 113,29 = 652,78; C3 firmaba 539,05 y la página sumaba 628,60. **Arreglo** `8cc2ac948a6d373ecf4fb4d08241a90a1dc2792e`: C3-B suma 462,56 + 97,14 = **559,70**; C3 suma 462,56 + 57,71 + 18,78 = **539,05**; y lo mismo con solo el descuento de línea y con solo el global.
- **Positivo:** huella sha256 de 8 páginas SIN descuento (C1 con el céntimo del punto 4, C2, C4, dto 0 y global «0.00», todo al 0 %, modo «IVA no incluido», tiers y sin líneas), congelada con el código anterior: idéntica byte a byte tras el arreglo.
- **Mutantes**, cada uno compilado y revertido (recompilando también al revertir): la firma ignora el global → 1 rojo · la firma pasa TODO por el pie → 1 (la huella) · la firma vuelve a la cuenta sin descuentos → 1 · el IVA con el rótulo del PDF → 1 · el GET sin el campo → 1. Revertido: 3/3.

## Huecos, dichos

- **Modo «IVA no incluido»:** la página sigue siempre en «sumar», como antes (condición (c) de la firma).
- **Presupuesto con descuento y todo al 0 %:** la página enseña ahora el bloque (Suma de líneas, Descuento…, Base imponible) sin fila de IVA. Antes no había bloque porque la cuota era 0. La etiqueta de la cabecera no cambia («Total del presupuesto»).
- No se ha mirado la página renderizada en un navegador (ni a 390 px ni a 1280 px): se verifica en staging tras el merge.

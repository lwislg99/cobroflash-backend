# SCRUM-887 · Con descuentos el cliente pagaba más de lo que firmó

**Medido contra:** `origin/main` = `364e7d3a267d8babc49a92244168dc12096ce996` · 2026-09-16T18:13:05Z (tabla y rojo) · suite final tras mergear `origin/main` = `e7f155755446b2a848688cd59ba25c8d9bb9fb26` · 2026-09-16T18:58:50Z
**Rama:** `scrum-887-cobro-descuentos` · **Estado:** PR 1 (caso A) mergeado (#1369, 16-sep 19:24Z). PR 2 (B) en `scrum-887b-descuento-global`, parado antes de empujar el arreglo (toca el cobro). Pendientes: PR 3 (bloqueo de C en el editor, literal por firmar), PR 4 (D2, literal por firmar).

Nace de SCRUM-883 (recorrido del electricista en staging): firma 539,05 €, cobro 628,60 €.

## PASO 0 · la acotación de SCRUM-594 tenía decisión firmada

Los dos tests que afirmaban «la factura ignora el `dto`» (`scrum594…:334`, `scrum600b…:374`)
colgaban de **«DECISIONES CERRADAS · 3-sep-2026 · no reabrir»** (comentario de SCRUM-594): la
propagación del descuento a la factura esperaba a la asesoría. Se paró y se preguntó. Decisión
(SCRUM-887, comentarios **15616** y **15620**, orquestador con delegación expresa del fundador):

| caso | qué | decisión |
|---|---|---|
| A | descuento POR LÍNEA | se aplica en factura y cobro — **este PR** |
| B | descuento GLOBAL, un solo IVA | se aplica como línea negativa del mismo IVA — PR 2 |
| C | descuento GLOBAL, IVA mezclado | la acotación SE MANTIENE; el editor no deja guardarlo — PR 3 |

## La fuente: NO es `pieDePresupuesto` (medido, 40.000 casos)

| | casos | `calcTotal` ≠ pie | hoy: cobro ≠ firmado | con el dto al precio |
|---|---|---|---|---|
| sin descuento | 10.000 | **1.498** | 110 | 110 (máx. 1 cént.) |
| A · un IVA | 10.000 | 2.016 | **9.618** | 116 (máx. 1 cént.) |
| A · IVA mezclado | 10.000 | 3.734 | **9.668** | 126 (máx. 2 cént.) |
| B · global un IVA | 10.000 | 1.950 | **9.449** | — (PR 2) |

`calcTotal` redondea la suma una vez; `calcVatBreakdown` redondea base y cuota por tipo. Hacer
fuente al pie movería céntimos de presupuestos SIN descuento. Decidido (①): **objetivo = total
firmado**, la factura sale de sus líneas con la reconciliación de SCRUM-141, con el `dto` aplicado
al precio antes de entrar. Coste aceptado: 1-2 céntimos en ~1,2 %, la tasa que ya existe sin descuento.

## Qué cambia

Una pieza, `lineasParaFacturar` (`invoiceLines.service.ts`): precio efectivo con `precioConDto`
(la misma función de `calcTotal`) y **sin la clave `dto`** —dejarla invita a aplicarla dos veces—.
Con descuento global devuelve las líneas **tal cual** (B y C no cambian en este PR).
`discountGlobalAmount` es obligatorio: un `select` que no lo cargue lanza, no aplica a ciegas.

Censo por AST de quién convierte `Quote.lines` en factura — **seis caminos + la vista**, todos por la pieza:
C1 aceptación del cliente (`quotes.routes`) · `quotesAdmin` tramo y factura entera · «cobrar el
resto» (`jobs.routes`) · C6 (`lib/invoicing.ts`) · C7 albarán (`albaranes.routes`, casador) ·
`billingPlanView`. Fuera por diseño: recapitulativa y parcial de albarán (precios del albarán).

**NO cambia:** `calcVatBreakdown`, `reconcileToTarget`, el sellado, el PDF de factura, la
numeración (el sello de `scrum291` sigue intacto: ningún hash de emisor tocado), el schema,
ningún documento emitido (regla 29).

## Verificación

- **Rojo primero**, commit `448bc5ac4367ce80d94d6731d8a8ff77d60c0dc6` (empujado antes del
  arreglo): C3 con un IVA firma 589,95 y cobraba **652,78**; muestra A, caso 1897: 22.578,84 → 45.069,70.
- **Arreglo** `8814a78425f717624683a8e8687e59ff922a1dfe`: C3 cobra 589,95 en los planes entero,
  50/50 y 30/70; muestra fija A (semilla 887): peor 1 cént., **18 y 14** de 2.000 distintos
  frente a **18** sin descuento (techos que solo bajan).
- **Positivo:** huella sha256 de 10.000 presupuestos sin descuento × 3 planes (importe, base y
  cuota de 50.000 facturas) congelada con el código anterior — idéntica tras el arreglo.
- **Negativo:** C3 original (IVA mezclado + 25 € global) sigue cobrando 628,60.
- **Mutantes en `src/` real**, cada uno compilado y revertido: albarán sin la pieza → 3 rojos ·
  la pieza conserva `dto` → 1 · aplica con global → 1 (el negativo) · vista con líneas crudas → 3 ·
  un factor 1,0004 sin dto → 4 (entre ellos la huella) · la pieza no aplica nada → 6. Revertido: 39/39.
- **Suite completa con este registro dentro:** 7.113 tests · 7.003 pass · **0 fail** · 110 skipped.

## Suelo y huecos, dichos

- **De extremo a extremo emite UN camino** (albarán → `invoice.create`, banco de SCRUM-290): precio
  10,00 en vez de 12,50 − 20 %, total 36,30. **Los otros cinco no se ejecutaron** por su handler: los
  cubren el test de dominio y el guard AST de procedencia (con control sembrado).
- **No verificado en staging ni en yaqu.app**: toca tras el merge (C3-A aceptado → cobro 589,95).
- Los dobles de Prisma de 141/263/290/597/885 no traían `discountGlobalAmount` (la fila real sí):
  se les añade `null`.
- La factura imprime el **precio unitario neto**, sin fila de descuento. Es lo que llega a sus líneas.
- Una línea con `dto: 100` factura 0: si todas lo están, el portón de SCRUM-246 da 409 (antes se
  cobraba a tarifa). No se relaja nada.

## Para el PR 2 (B), a decidir antes de escribir

- **Albarán (C7) con descuento global:** una factura PARCIAL de albarán tendría que llevarse
  «una parte» del global — eso es un reparto, que es justo lo que la decisión excluye. Propuesta:
  que C7 con global no emita la línea negativa y lo diga, hasta decidirlo.
- El rótulo de la línea negativa: el presupuesto ya enseña **«Descuento global»**
  (`presentacionIva.ts`, fila del pie) → se reutiliza ese literal.

---

# PR 2 · caso B (descuento global, un solo IVA)

**Medido contra:** `origin/main` = `018d18075c4aefb276dd21a47e1ba2186be630ad` · 2026-09-17T08:07:12Z
**Rama:** `scrum-887b-descuento-global` · **Estado:** rojo empujado; arreglo `ab2a6275f180db168524a134d57cabfd87154ce2` comiteado en local, **sin empujar** (toca el cobro: STOP con el diff por caminos).

## PASO 0 · deuda del PR 1: C3-A en staging (hecho)

- Staging servía `018d18075c4aefb276dd21a47e1ba2186be630ad` (`GET /version`). Turno de staging LIBRE en `railway` (`turno-staging.mjs estado`); todo por la API, ninguna escritura directa en la base.
- C3-A = C3 con dto de línea y todo al 21 %, sin global. Presupuesto **#1879** (cliente 3927, merchant QA 2): creado → WhatsApp en dry-run → aceptado por el enlace del cliente (`POST /quote/:token/decision`, «Aceptado desde enlace WhatsApp»). `acceptedAt` del servidor **2026-09-17T08:15:35Z**.
- **Resultado:** justificante `J-20260917-5L2N` con total **589,95**; `/pay/invoice` pinta «Importe a pagar **589,95 €**» y `/pay/bank` **589,95 €** (cabecera `Date` 2026-09-17T08:15:51Z). Lo firmado era 589,95: **cuadra**.
- Script: el de la sesión (scratchpad, efímero); el secreto se leyó en runtime y no se imprimió. La página de firma NO se leyó con fiabilidad (una regex sacó 539,49, que es la base sin dto: D3, fuera de este PR).

## Decisiones (orquestador, 17-sep-2026 10:10 CEST)

1. Rótulo de la línea negativa: **«Descuento global»**, el literal de la fila del pie (`presentacionIva.ts`, «Descuento global:» sin los dos puntos). Un test compara los dos.
2. **Albarán con descuento global: NO emite.** Rechazo con código propio `albaran_con_descuento_global`, ANTES de leer el libro y de pedir número. Ni a precio bruto ni con reparto. El literal del rechazo va con el marcador `[PENDIENTE microcopy oficial]` de la ruta hasta que se firme (propuesta abajo).
3. **Aceptado, al registro:** `dto: 100` deja la línea a 0 € y, si todas lo están, el portón de SCRUM-246 da 409. Correcto: no hay nada que cobrar.
4. **Pregunta para el asesor antes de SIF-1:** la factura del caso A lleva el precio unitario ya descontado y ninguna fila de descuento. ¿Vale así o debe figurar el descuento?

## Qué cambia

`lineasParaFacturar` con global y **un solo tipo** (los tipos y el importe salen de `descuentoGlobalEnCentimos`, la función que se ha EXTRAÍDO de `calcTotal` para que la usen los dos): las líneas con su dto aplicado y, **al final**, `{ concept: 'Descuento global', qty: 1, price: −g, tax: tipo }`, con `g` = el global en céntimos limitado a la suma de bases redondeadas línea a línea: **el mismo límite, de la misma función**. La extracción no cambia la aritmética de `calcTotal`: diferencial de 200.000 casos (con cabeceras, valores ilegibles y globales raros) contra el `dist` anterior, **0 distintos**; el control que sí difiere (global ×1,01) da 20.000 de 20.000. IVA mezclado (C): sin cambios. Nueva `tieneDescuentoGlobal(quote)`: una sola lectura para la pieza y el albarán, y sigue lanzando si falta `discountGlobalAmount`.

Albarán (`convertir-en-factura`): con global, 409 antes de cualquier escritura. `facturar-parcial` y la recapitulativa no cambian (precios del albarán, fuera por diseño desde el PR 1).

**NO cambia:** `calcTotal`, `calcVatBreakdown`, `reconcileToTarget`, el sellado, la numeración, el PDF, el schema, ninguna aceptación ni factura ya emitida.

## Verificación

- **Rojo** `22adc3e50fc4fc2b7444bb852085d55f1a6273df`, empujado 2026-09-17T08:25:57Z (cabecera `Date` de GitHub) antes del arreglo. Con el código de main: **6 rojos**. C3-B firma **559,70** y cobraría **652,78**; muestra B, caso 1107: firma 22.501,63 y cobraría 44.935,01; el albarán intenta emitir (llega a `$transaction`). El control (albarán sin global llega a emitir) sale verde.
- **Arreglo:** C3-B cobra 559,70 en los planes entero, 50/50 y 30/70, y la vista del plan promete lo mismo que se emite. Muestra B (semilla 8870, 2.000 casos, un IVA, global de 0,01 a 150 €, sin los que firman 0 €): peor 1-2 céntimos; distintos **24 · 29 · 43** (entero · 50/50 · 30/70) frente a **23 · 31 · 39** con las MISMAS líneas sin global. Son techos que solo bajan.
- **Mutantes en `src/` real**, cada uno compilado y revertido: sin línea negativa → 5 rojos · un céntimo de más en el descuento → 3 · aplica también a C → 1 (el negativo de 887) · tipo fijo al 21 % → 2 · rótulo distinto → 1 · línea negativa al principio → 2 · albarán sin rechazo → 1. Revertido: 17/17.
- **Trinquetes que saltaron con la primera versión** (sin tocar importes): 411 (el rótulo exportado sin llamador → deja de exportarse), 624 (la pieza mezclaba dos formas de redondear → la agrupación va a `utils.ts`, que ya las mezclaba) y 619 (la línea creada tiene la firma de cuatro claves → se DECLARA: la crea, no estrecha una entrante, como las negativas de `finalInvoice`).
- **Positivo:** la huella de 10.000 presupuestos sin descuento de `scrum887` sigue idéntica, y el caso A también.
- **Negativo:** C3 original (IVA mezclado + 25 €) sigue cobrando 628,60, como antes: su test no cambia, solo el título, que ya no nombra a B.

- **Por camino, C3-B (firmado 559,70):** C1 aceptación 652,78 → **559,70** · tramos 50/50 (`quotesAdmin` y «cobrar el resto») 326,40 + 326,40 = 652,80 → **279,85 + 279,85** · factura entera 652,78 → **559,70** · C6 652,78 → **559,70** · `billingPlanView` promete lo mismo que se emite · C7 albarán: antes facturaba a precio bruto (3 × 24,95 = 90,57), ahora **409**. El caso C (IVA mezclado) sigue firmando 539,05 y cobrando 628,60.
- **Suite completa con el arreglo y este registro:** 7.195 tests · 7.085 pass · **0 fail** · 110 skipped.

## Abierto: se pregunta, no se decide aquí

- **Un global que se come TODA la base** firma 0 € y la factura sale con +X y −X: bruto 0. El portón de SCRUM-246 **no lo para**, porque las líneas no son cero. Antes se facturaba a precio bruto (peor), pero una factura de 0 € tampoco debería emitirse. ¿Se rechaza igual que `dto: 100`?
- **La reconciliación ajusta la última línea, y ahora esa línea es el descuento:** en el plan entero, 110 de 2.000 casos de la muestra B, hasta ±0,05 € de precio. Es el mismo ajuste que ya se aceptó en SCRUM-141 sobre la última línea de producto. Si la línea negativa va la primera, el descuento queda exacto y el ajuste pasa a un producto, con el mismo número de casos distintos (medido: 18/25/37 contra 20/25/38 en la muestra del prototipo).
- **Literal propuesto** para `albaran_con_descuento_global`: «Este parte no se puede facturar: su presupuesto lleva un descuento global, y ese descuento no se reparte entre partes. Factura el presupuesto desde el Trabajo.» Sin firmar, no entra.
# APÉNDICE · PR 2 (B) · con descuento global y un IVA, lo cobrado ≠ lo firmado

**Medido contra:** `origin/main` = `018d18075c4aefb276dd21a47e1ba2186be630ad` · 2026-09-17T08:39:50Z (hora del commit del bot `9ff07948`)
**Rama:** `scrum-887b-descuento-global` · **Estado:** EN PR — ROJO (test-first). El defecto está
documentado y medido; el arreglo del código todavía no está en esta rama.

## Commits (esta sesión, sólo ROJO)

| sha | qué |
|---|---|
| `22adc3e5` | ROJO — caso B (global, un solo IVA): el cobro no coincide con lo firmado en ningún plan, la pieza `lineasParaFacturar` no añade la línea negativa, la vista del plan de cobro no promete lo mismo que se emite, y el albarán (C7) con global emite en vez de rechazar con 409 |

`tests/scrum887b-descuento-global.test.mjs` — la decisión del orquestador (17-sep-2026, tabla de
la cabecera de este fichero, punto B): con global y un solo IVA sale **una línea negativa del
mismo IVA, rotulada «Descuento global»** (el literal que ya pinta el pie del presupuesto) y
reconciliada como el caso A. El caso C (IVA mezclado) se mantiene fuera; su test vive en
`tests/scrum887-*` y no se toca. El albarán (C7) con global **no emite** — es un reparto del
global, justo lo excluido — y lo dice con un código propio (`albaran_con_descuento_global`) y
CERO escrituras antes de rechazar.

## Pendiente (fuera de esta rama)

> Actualización 17-sep-2026 (sesión del PR 2): el arreglo ya existe, en `ab2a6275f180db168524a134d57cabfd87154ce2`, comiteado en local y SIN empujar hasta el GO del dinero. Detalle en la sección «PR 2 · caso B» de arriba.

El arreglo de `lineasParaFacturar` (añadir la línea negativa con global de un solo IVA) y del
handler `POST /:id/convertir-en-factura` (rechazo 409 con descuento global) que pone estos rojos
en verde.

## PR 2 · segunda vuelta (orquestador, 17-sep-2026 11:06 CEST · SCRUM-887 comentario 15675)

**Medido contra:** `origin/main` = `8c354ff3404fb2a093d14b30414bc1a8e564c46a` · 2026-09-17T09:07:08Z (hora del commit de main; integrado con merge, sin rebase)

Las tres preguntas abiertas de arriba quedan **decididas**:

1. **Literal del albarán**, firmado con una corrección: «albaranes» en vez de «partes», y el nombre real de la acción de facturar del Trabajo, que es «💰 Cobrar el resto» (`jobNextAction.js`). Queda: «Este albarán no se puede facturar: su presupuesto lleva un descuento global, que no se reparte entre albaranes. Cobra el resto desde el Trabajo.» Va en `message` del 409 `albaran_con_descuento_global` (`COPY_ALBARAN_CON_DESCUENTO_GLOBAL`), con su aprobación en `docs/microcopy/2026-09-17-SCRUM-887-albaran-con-descuento-global.md`. La pantalla es de SCRUM-895.
2. **(a) Un global que se come toda la base no emite.** Las líneas salen a 0, como con `dto: 100`, y el portón de SCRUM-246 da su 409 antes de pedir número. El criterio es el de la pieza (el global llega a la suma de bases), no «firma 0,00»: por redondeo, esos presupuestos firman −0,02 a +0,02 € (medido en 200.000 casos al azar: 31.821 así; 24.318 firman 0,00, 5.062 −0,01, 2.357 +0,01, 69 −0,02 y 15 +0,02). No se cobra ninguno.
3. **(b) La línea «Descuento global» sale exacta.** Es la forma más pequeña: la línea va la PRIMERA. `reconcileToTarget` ajusta la última línea, así que el ajuste cae en un producto, como sin descuento. La reconciliación, que sirve a todas las facturas, no se toca. Coste: la factura enseña el descuento antes que los productos. Muestra B (2.000 casos, ahora excluyendo por el criterio de la pieza): distintos **23 · 31 · 43** con la línea la primera, **25 · 31 · 44** si fuera al final, **21 · 30 · 40** con las mismas líneas sin global; peor 1-2 céntimos en los tres.

C3-B tras el arreglo, plan entero: `Descuento global 1 × −25` · `Punto de luz 8 × 21,2075` · `Base de enchufe 11 × 17,991` · `Boletín 1 × 120`. Por camino: C1 652,78 → **559,70** · tramos 50/50 326,40 + 326,40 → **279,85 + 279,85** · factura entera y C6 652,78 → **559,70** · la vista del plan promete lo mismo · albarán **409** con el literal. C (IVA mezclado) sigue firmando 539,05 y cobrando 628,60.

- **Rojo 2** `867482fbf60bb76f1b8b8252590e611337ad504a` (sin empujar: el GO lo da el fundador): 4 rojos. El descuento de la muestra salía ajustado (−150 → −149,999), el global total emitía +X −X, la línea iba al final y el albarán llevaba el marcador.
- **Arreglo** `b4dfc1bdf221e4a6a849c58478ba67d9e478050d`. Mutantes: descuento al final → 3 rojos · sin rechazo del global total → 1 · rechazo con el marcador → 1. Revertido: 18/18.
- **Automerge:** el #1383 lo tiene activado. Empujar esta rama la pone en verde y la despliega. Además, desde el push de claude[bot] (`9ff07948`) el CI está parado en `action_required` con 0 jobs (SCRUM-900). Al empujar hay que comprobar que arranca con jobs.

## PR 2 · verificación en producción (17-sep-2026)

- Push `071579d694cb63f57a72f89007f8e79eaee75452` a las 09:56:10Z, con el GO del fundador escrito en el chat de la sesión y ls-remote justo antes. El CI del #1383 arrancó con jobs (SCRUM-900 confirmado: el push de una persona lo desbloquea).
- Merge automático a las **10:03:26Z** → `f3ab211d54fb4b04129498985b6a78079cf78448`, con el meta-guard aún en curso: acabó en success (run 35207809289). Staging y yaqu.app sirven ese sha.
- **Staging, C3-B nuevo:** presupuesto #1881 (firmado 559,70), aceptado por el enlace del cliente a las 10:05:26Z. Justificante `J-20260917-UYIC`, total **559,70**. Líneas: `Descuento global 1 × −25 (21 %)` · `Punto de luz 8 × 21,2075` · `Base de enchufe 11 × 17,991` · `Boletín 1 × 120`. `/pay/invoice` pinta «Importe a pagar **559,70 €**» y `/pay/bank` 559,70 € (cabecera `Date` 10:05:27Z).
- Visto de paso, fuera de este ticket: la página de firma sigue pintando las líneas sin dto, base 539,49 e IVA 113,29 bajo un total de 559,70 (D3 de SCRUM-883, punto 1 de SCRUM-888).

# PR 3 · caso C (descuento global + varios tipos de IVA): no se guarda, no se revisa, no se factura

**Medido contra:** `origin/main` = `e48c18d57fd495d8929cd983733e18c2ac057e64` · 2026-09-17T10:20:37Z (hora del commit de main; integrado con merge, sin rebase)
**Rama:** `scrum-887c-bloquear-caso-c` · **Estado:** listo en local, sin empujar hasta la confirmación del orquestador por el canal (autorización del fundador en el chat de la sesión, 17-sep).

## Decisión (orquestador por delegación del fundador)

- **15697 · opción (A) completa.** El bloqueo solo en el editor se cuela por la API, por las revisiones y por los C que ya existen. La opción (B), repartir el global por tipo en proporción a la base, va como pregunta a la asesoría; la (C), pasarlo a descuento por línea, queda descartada.
- **15698 · L2 y L2r** terminan con la única salida que existe: un presupuesto firmado no se edita y su revisión HEREDA el global, así que se duplica. Hoy «Duplicar» pierde el global (D6 de SCRUM-883, punto 3 de SCRUM-888); aquí no importa, porque el texto pide ponerlo en cada línea.

## Qué cambia

- **A3 · la pieza:** con C, `lineasParaFacturar` deja las líneas a 0 y el portón de SCRUM-246 no emite. El cliente que acepta lee `COPY_PUBLICO_SIN_LINEAS`, ya aprobado (L3). Las tres rutas del profesional (`/admin/quotes/:id/invoice`, `/invoice-manual` y `/admin/jobs/:id/collect-rest`) preguntan antes `tieneDescuentoGlobalConVariosIva` y responden **409 `descuento_global_con_varios_iva`** con L2, sin haber escrito nada.
- **A2 · el servidor:** `POST /quote/create` responde **400** con L1; `POST /admin/quotes/:id/revisiones` responde **400** con L2r (`RevisionNoCreable` antes de `quote.create`).
- **A1 · el editor:** `quotesView.js` comprueba C antes de `createQuote` y avisa con `setAlert` y L1. La pieza `quoteDescuentos.descuentoGlobalConVariosIva` copia la agrupación del SERVIDOR (no la de `totalesConDescuento`, que salta las líneas sin precio). Comparada con el servidor en 3.000 casos: 0 discrepancias.
- **Textos:** `src/modules/quotes/domain/descuentoGlobalConVariosIva.ts`. L2 y L2r componen su remedio desde UNA constante. Aprobaciones en `docs/microcopy/2026-09-17-SCRUM-887-descuento-global-varios-iva-{editor,facturar}.md`; la de L2/L2r registra también sus partes fijas, que es lo que cruza el guard SCRUM-514 (precedente: SCRUM-894).
- **El negativo de `scrum887`** dejó de afirmar que C cobraba 628,60: afirmarlo protegía de improvisar un reparto mientras no hubo decisión, pero con la decisión tomada congelaba el cobro de más. Ahora afirma que C no se reparte y no se factura.

## Verificación

- **Rojo** `d3eb5f157dbae88030dc0900803676f226b92d0d`, sin empujar, contra main `f3ab211d`: **9 rojos**. `/quote/create` y `/revisiones` llegaban a escribir (`$transaction`, `quote.create`); `/invoice` llegaba a `$transaction`, o sea que un C se emitía; el cliente no leía L3; el editor no reconocía C.
- **Arreglo** `89860c71c25628a7ecbdabc8091834f499261599`. **Mutantes en src y public**, cada uno aplicado y revertido: la pieza reparte C como B → 3 rojos · el predicado nunca ve C → 5 · `/quote/create` sin rechazo → 1 · revisión sin rechazo → 1 · revisión con 409 en vez de 400 → 1 · collect-rest sin su rechazo → 1 · el editor cuenta las cabeceras → 1 · el editor no avisa → 1. Revertido: 27/27. En los dos mutantes del front salió además un rojo de A3, que era del instrumento: el script no recompilaba `dist` tras revertir el mutante anterior. Recompilado, desaparece.
- **Sin cambios:** los casos A y B (C3-B sigue en 559,70), y la huella de 10.000 presupuestos sin descuento.

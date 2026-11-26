# SCRUM-1805 · La factura que nace de un presupuesto congela sus Observaciones y sus formas de pago

## SCRUM-1805 (puntos 2 y 3) · S1 · construido

**Medido contra:** `origin/main` = `734b017583bb0afc4cfca5079691060784f726f0` · 2026-11-25T13:28:34Z (hora de GitHub; sesión S1 del relevo del 25-nov, por encargo del `orquestador`). A las 13:50:18Z main iba 8 commits por delante (`2ab4549bd`), y ninguno toca los ficheros de este tramo (`git diff --stat` desde la merge-base sobre ellos: vacío).

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`
(Mi guion de mutación de un solo uso, fuera del árbol, dio las cuatro primeras mutaciones por VIVAS con el test en rojo: cotejaba el nombre en la salida TAP, que escapa `#` como `\#`, y los nombres llevan `#1`…`#4`. Lo vi porque el código de salida era 1 en los cuatro y el veredicto decía VIVE; corregí el instrumento, no el test, y las cuatro murieron. El meta-guard de la casa no tiene ese clavo: lee los eventos de `run()` de `node:test`, sin reporter, desde SCRUM-745.)

Mutaciones: catálogo → `tests/scrum1805-congelar-desde-presupuesto.test.mjs`

**El GO.** Nominal, en SCRUM-1656 **c.22782**: un PR, rama `scrum-1805-congelar-desde-presupuesto`, un commit por tramo, y exactamente estos literales. Decisiones de fondo:
- SCRUM-1787 **c.22345** — ② el PIE (Observaciones) pasa a la factura y la cabecera NO; ④ la R1 NO hereda las Observaciones; ⑤ cada factura de un presupuesto por tramos lleva las Observaciones.
- SCRUM-1787 **c.22404** (b: la lista del presupuesto se congela tal cual) y **c.22429** (los cinco caminos de S1 llaman al ayudante igual).
- **1787l**: la columna `Invoice.docFooterText` (`prisma/schema.prisma:899`) y su pintado en el PDF.

**La duda (a) del tramo anterior, resuelta con el literal.** La pregunta ⑤ de c.22345 dice textualmente «En un presupuesto que se factura por tramos, ¿cada factura lleva las Observaciones? Recomiendo que sí.» y la respuesta del fundador fue «5-Sí»: SCRUM-1787 c.22345, pregunta ⑤ literal + respuesta 5-Sí (verificado en Jira por el orquestador, 25-nov). Por eso #4 (cobrar el resto) también lleva `docFooterText`. El literal en el repo era solo «1-Sí 2-Solo pie 3-GO 4-No 5-Sí» (`docs/master/SCRUM-1787.md:551`), y «cada tramo» era paráfrasis: se paró ahí y se pidió el texto, que llegó con el encargo de este tramo.

| commit | tramo | qué |
|---|---|---|
| `60b73652717415ae71eaf6761c0543b3fb85ef87` | ① Observaciones | `docFooterText: quote.docFooterText ?? null, // SCRUM-1787l (c.22345 ②⑤): las Observaciones; la cabecera NO` detrás de `stageLabel` en #1 C3 (`quotesAdmin.routes.ts`, `/:id/invoice`), #2 C4 (`/:id/invoice-manual`), #3 C1 (`quotes.routes.ts`, `/:token/decision`) y #4 C2 (`jobs.routes.ts`, `/:id/collect-rest`) |
| `bb88377cb076aa4533d5eae305760e2aa0756065` | ② formas #1–#4 | `payMethods: formasDePagoACongelar({ presupuesto: quote, merchant: quote.merchant, importe: Number(<importe>), moneda: quote.currency.toUpperCase() }) ?? undefined, // SCRUM-1805 (c.22404, c.22429)` con `<importe>` = #1 `tramo.invoiceAmount` · #2 `invoiceAmount` · #3 `invoiceAmount` · #4 `tramo.amount`, y el import del ayudante en los tres ficheros |
| (este) | ③ #5 C7 | `albaranes.routes.ts`, `/:id/convertir-en-factura`: la misma llamada con `presupuesto: quote, merchant, importe: Number(total), moneda: merchant.defaultCurrency \|\| 'EUR'`; `payMethods: true` en el `select` del presupuesto, y en el del comercio SOLO los cinco campos de `ComercioParaFormasDePago` (`billing/app/routes/formasDePagoActivas.ts:28`) que faltaban: `iban`, `clabe`, `bizumPhone`, `connectStatus`, `stripeAccountId` (`id`, `country`, `flags` y `whatsappPhone` ya estaban) |

El import va en la MISMA línea que el import de la emisión de cada fichero (`crearFacturaEmitida` / `emitInvoice`), como ya hace `invoicesAdmin.routes.ts:76`: así no se corre ninguna línea por encima de las de la emisión. El ayudante es de J1 (`src/modules/invoicing/**`): se importa, no se toca.

**Rojo primero, por tramo** (`tests/scrum1805-congelar-desde-presupuesto.test.mjs`, banco `_banco-emision-con-estado.mjs`):

| tramo | sin el código | con el código |
|---|---|---|
| ① | 5 de 6 en rojo (las cuatro de Observaciones; la de la R1 sale CIEGA porque su original sale de #1) | 6/6 |
| ② | 4 de 12 en rojo (las cuatro de formas; los controles de la suelta y el cobro, verdes) | 12/12 |
| ③ | 2 de 14 en rojo (#5 sin la lista del presupuesto; los `select` sin los campos nombrados) | 14/14 |

Mutaciones: 11 en el catálogo del test (4 de ①, 4 de ②, 3 de ③: la llamada y cada `select`); las 11 mueren, cada una tumbando el caso que su `cae` nombra.

**Qué mide el test y qué no.** De cada camino se lee por AST, en el fuente de hoy, el objeto que la ruta pasa a la emisión; se transpila, se evalúa con las variables de la ruta en ese punto y se emite con `crearFacturaEmitida` / `emitInvoice` DE VERDAD (`dist/`) sobre el banco; se lee la fila escrita. Una variable que el objeto use y el test no conozca lanza. Por camino: con lista → esa lista (`['card']`, que el comercio no tiene activa); sin lista → las activas para el importe de esa factura (`['bizum', 'transfer']` a 121 €). En #1–#4 el presupuesto se lee con `include` y sin `select` (comprobado por AST: viene la fila entera). En #5 los dos `select` leídos se EJECUTAN como proyección, con control negativo (con los de antes, la lista se pierde y la transferencia no sale) y comprobando que solo se añadió lo nombrado. Controles: la R1 de una factura con Observaciones no las copia (c.22345 ④); la factura suelta conserva su expresión de 1787s; la factura tras cobrar sigue dando la lista del cobro antes que la del presupuesto. **No mide** las puertas previas de cada manejador (firma, token, cobro, WhatsApp, casación del albarán): el manejador no se monta entero; cada una tiene su test.

**Medidos y fuera del alcance** (GO c.22782 (b)): `facturar-parcial` (`albaranes.routes.ts`, `emitInvoice` sin presupuesto), `recapitulativa.service.ts` y `facturaDesdeParte.ts` se quedan como están.

**Tanda** (`npm test` entera, en este árbol con el código de los tres tramos): 14.550 tests · 14.347 pass · 18 fail · 185 saltados. De los 18: 12 de `scrum267` y 1 de `scrum854` eran este registro todavía sin ancla ni commit, y 1 de `scrum976` era `guards:entrada` cayendo por lo mismo; 1 de `scrum1415` eran mis dos bucles de nombre construido (desenrollados con `casosEscritos` en el commit ③); 2 de `scrum1726` D1 son de ambiente (ICU de Node 24.8 en esta máquina pinta «, 0:30»; no tocan nada de este diff); 1 de `scrum351` es de ambiente (29 `node_modules` de OTROS worktrees que no resuelven: ENOENT). Tras el ancla y el desenrollado: este test + 1415 + 267 + 1294 + 525d → 46/46.

**Ningún guard de anclas del camino saltó**: el import va en la línea del import de la emisión y las líneas nuevas van dentro del objeto de la emisión, así que nada por encima de ellas se ha corrido; `scrum525d` verde.

# SCRUM-1805 ① · S2 · el editor en modo factura (1787k + 1787f)

**Medido contra:** `origin/main` = `13e5bb69532b7d56d8d0be4b8386210aa2e5202b` · 2026-11-26T21:26:01Z (relevo de S2 del 26-nov noche; rama `scrum-1805-editor-modo-factura`, con `origin/main` mezclado en `02757484d`).

A9: sin fallo que generalice — el tropiezo de esta tanda fue de mi guion de capturas (dejaba abierto el autocompletado del concepto porque salía del campo antes de que su búsqueda contestara); lo cazó la propia captura, se corrigió en el guion y el informe mide ahora `autocompletadoAbierto: false`.

Mutaciones: catálogo → `tests/scrum1805-editor-modo-factura.test.mjs` (6 en `MUTACIONES_QUE_ME_TUMBAN`; resultado abajo). Además, `tests/scrum600e-condiciones-contra-el-emisor.test.mjs` lleva sus rojos DENTRO (①, ②, ②b, ③, ④, ⑤ y ⑥, cada uno mutando un solo lado en memoria), y el rojo-primero del test propio sobre los dos ficheros de `origin/main` dio 8 de 9 en rojo: el que queda verde es el control del presupuesto, que tiene que estarlo en los dos.

**Skill UI:** cargada · en el relevo, DESPUÉS de construir (el tramo A+B lo construyó mi antecesora; yo la cargué al ver el rojo de `scrum811c` en `guards:entrada`) y pasado el checklist AB6 sobre el diff: cero clases nuevas, cero `style=` nuevos, cero textos nuevos fuera de los firmados; el campo «Vence el» abierto mide 47 px de alto y su «Cambiar»/«Listo» 44 px, dentro del ancho a 390 y 1280 (`venceAbierto` en la medida, `captura-1805-vence-abierto-{390,1280}.png`); mismos estilos que «Válido hasta» (ninguno de los dos lleva clase propia).

**El GO.** Plan aprobado por el orquestador; decisión de fondo SCRUM-1787 **c.22325** (① «Vence el» firmado · ② la factura lleva paso Condiciones con formas de pago, vencimiento y ajustes, y SIN «Condiciones de pago» · ③ GO de regla 40 a `dueDate`/`payMethods`, que entraron con 1787i) y **c.22338 ①** (descripción y descuento de la línea, 1787k). Texto firmado del resumen: SCRUM-1656, delegación c.21978, **registro nº 13** — «<formas elegidas> · vence el <fecha corta>», y sin vencimiento solo «<formas elegidas>». **Decisión (a):** la descripción viaja como clave propia (`description`); NO se pega al `concept`, que es lo que se sella.

| commit | tramo | qué |
|---|---|---|
| `881935468361e6c279911c44e674f626cda81b2f` | A + B (código) | `cuerpoDelDocumentoSuelto.js`: `description` y `dto` por línea (el `dto` con el criterio de `descuentoParaPayload`: vacío, ilegible o ≤ 0 no viaja; > 100 → 100; coma decimal) y un tercer parámetro `condiciones` (`payMethods`, `dueDate`) que sin él deja el cuerpo idéntico. `quotesView.js`: descripción y «Dto. %» en la hoja de la línea también en la factura (y al cargar plantilla); paso «3 Condiciones» en la factura con la fila de formas de pago, «Vence el» (control propio `#invoice-due-date`, +30 días en la zona del negocio con la pieza de SCRUM-633, fin del día como `validUntil`) y la fila «Ajustes del documento» subida desde «Revisar y emitir»; sin la fila de cobro ni la caducidad; «Revisar y emitir» pasa a ser el 4 |
| (este) | guards + test + registro | los guards de la spec vieja, adaptados SIN bajar la vara (abajo), el test propio, las capturas y un comentario de `refrescarPasos` que decía que la factura no cuelga Condiciones |

**Guards de la spec vieja, re-anclados (regla 41: se adapta lo que la decisión cambió, no se relaja).**
- `scrum600e` + `_condiciones-vs-emisor.mjs`: la puerta era la del bloque entero; ahora son DOS, la de la fila de cobro y la de la caducidad, y el ROJO ① las abre las dos y sigue exigiendo los MISMOS tres campos nombrados (`paymentTerms`, `customBillingPlan`, `validUntil`). El andamio nuevo (fila de Ajustes, pie del paso) va a `NO_SON_CAMPOS` con su motivo. Los dos controles que sólo la factura cuelga de Condiciones —«Vence el» → `dueDate` y el IVA por defecto → `lineas[].tax`— NO se esconden ahí: van a un mapa propio, `SOLO_EN_EL_SUELTO`, y se miden con la regla ① como los demás. Tres rojos nuevos lo prueban: sin `dueDate` en el schema ni en el validador, «Vence el» cae (④); si deja de colgarse, su excepción sobra (⑤); si se colgara también en el presupuesto, cae (⑥). El POSITIVO pasa de `[]` a exactamente `['payMethodsWrapper']`.
- `scrum600b`: el cuerpo congelado de SCRUM-867 se sigue exigiendo BYTE A BYTE con «Vence el» vacío; un caso nuevo exige que el cuerpo por defecto sea el congelado más `dueDate` al final y nada más. «Condiciones» deja la lista de prohibidos y entran en su lugar, por rótulo propio, «Condiciones de pago», «Válido hasta» y la nota de caducidad; el paso se vigila por identidad (uno, con «Formas de pago que verá el cliente» y «Vence el»).
- `scrum600g` ④: la factura lleva ahora `['Condiciones', 'Ajustes del documento']`, y se exige que NO traiga «Condiciones de pago», «Válido hasta» ni «Dirección de la obra», con su suelo en el presupuesto.
- `scrum286-bloques-orden` (2): el literal de la caducidad lleva ahora su guarda `if (!esDocumentoSuelto)`.
- `scrum632` (en `881935468`): la descripción se pinta en la factura y viaja como clave propia; el concepto intacto.

**Test propio** `tests/scrum1805-editor-modo-factura.test.mjs` (9): el compositor (reglas del `dto`, descripción con concepto intacto, condiciones que sólo viajan si hay algo), y la pantalla montada en el banco de vistas: descripción y «Dto. %» viajan · formas marcadas y vencimiento viajan (fin del día) · «Vence el» vacío = sin clave · el resumen firmado del paso, con fecha y sin ella · numeración 3/4 · el presupuesto no cambia (sin «Vence el», con «Condiciones de pago» y «Válido hasta»).

**Capturas** (yaqu.app, cuenta +qa, `quotesView.js` y `cuerpoDelDocumentoSuelto.js` servidos desde el árbol por interceptación; datos de EJEMPLO; nada se emite). Guion: `docs/master/evidencias/SCRUM-1805/captura-1805-editor-factura.mjs` · medida: `captura-1805-medida.json` · fotos `captura-1805-condiciones-abierto-{390,1280}.png` y `captura-1805-condiciones-cerrado-{390,1280}.png`. En los dos anchos: resumen `💳 Tarjeta · 📲 Bizum · vence el 26/12/2026` (la cuenta +qa no tiene la transferencia configurada: su casilla nace sin marcar), pasos 3 y 4, 0 errores de página, sin desborde lateral, y la única escritura (`POST /admin/entorno`) interceptada.

**Visto en las capturas y declarado:** en la factura aparece ahora la guía del paso, «Ya van puestas las de siempre. Cámbialas sólo si este cliente es distinto.» — texto ya existente del presupuesto, no nuevo; se consulta al orquestador antes del push si vale para la factura.

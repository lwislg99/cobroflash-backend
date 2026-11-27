# SCRUM-1807 · apartados del presupuesto

**Skill UI:** cargada (tramo e, `yaqu-premium-ui`)

## SCRUM-1807e · el apartado en el EDITOR (S2, 25-nov-2026)

**Skill UI:** cargada
**Medido contra:** `origin/main` = `724f33f69039a1f6de55f4ea3cde791790b110bb` · 2026-11-25T14:29:46Z
A9: comprobación → `tests/scrum794-un-solo-anadir-linea.test.mjs`
A9: comprobación → `tests/scrum632-los-dos-cortes-de-la-linea.test.mjs`
Mutaciones: catálogo → `tests/scrum1807e-editor-apartados.test.mjs`

Puesto S2. Rama `scrum-1807e-editor-apartados`. Skill `yaqu-premium-ui` cargada antes de tocar la pantalla. Ficheros: `public/dashboard/js/quotesView.js`, `public/dashboard/js/quoteApartados.js` y `public/dashboard/css/styles.css`, los tres del carril S2.

**Decisiones y textos.** SCRUM-1786 c.22269 firma P2 (el «Salón» es el apartado que ya existe, SCRUM-655), P3 (el modo se elige por apartado) y los literales «Total del apartado», «Mostrar al cliente:», «Desglosado», «Agrupado» y «Varios». SCRUM-1656 c.22787 firma la opción A y el botón «+ Añadir apartado». El orquestador precisó dónde va «Varios»: en la COLUMNA de IVA, sólo en agrupado; con un único tipo, ese tipo («21 %»: es un valor, no un texto). El resto de rótulos ya existían en esta pantalla: «Concepto», «Descripción», «↑  Subir», «↓  Bajar», «🗑️  Eliminar línea», «Acciones de la línea» y «Arrastra para reordenar». No hay ni un texto más.

### Lo medido antes de construir (la premisa estaba rota)

El ticket decía «editor: descripción, subtotal y selector». **El editor no tenía apartados.** `quotesView.js` sólo nombraba la marca en un comentario («este editor no crea cabeceras»), y en `src/` sólo la conoce la puerta (`schemas.ts`). Ninguna pantalla creaba una cabecera, y las que llegaban por la API se perdían al duplicar (BUGS.md, entrada SCRUM-1807e). Se paró y se preguntó. **Opción A** (elegida): firmar el botón y construir el tramo entero. Descartadas: **B**, conservar y pintar sin poder crear, que deja la pantalla sin uso porque ninguna cabecera nace en la UI; y **C**, aparcar el tramo, que deja vivo el defecto de duplicar.

### Qué hace

| pieza | dónde | qué |
|---|---|---|
| «+ Añadir apartado» | `quotesView.js` | secundario, detrás de «+ Añadir línea». La cabecera nace al final de la lista y el foco va a su concepto. No sale en el documento suelto, cuyo emisor no lleva cabeceras |
| la cabecera | `addApartado` | una tarjeta `.quote-line--apartado` de la MISMA lista y la MISMA rejilla que una línea, así que Subir, Bajar, el arrastre y `syncLinesOrder` la mueven sin saber nada de ella. Lleva concepto, el selector «Mostrar al cliente:» (sin la clave = Desglosado, como en SCRUM-1807d), la columna de IVA, «Total del apartado», «⋯» y la descripción a todo lo ancho |
| el total | `resumenDeApartados` (pura) | la suma de lo que ENSEÑA cada fila del editor, CON IVA (c.22389: «cada vista suma como sus líneas»). Ninguna cuenta nueva: las cifras entran ya hechas |
| la columna de IVA | `ivaDelApartado` (pura) | en agrupado, «Varios» si sus líneas llevan varios tipos y el tipo si sólo llevan uno. En desglosado queda vacía, pero el hueco se conserva (como `.is-de-siempre`, SCRUM-915h). Un renglón en blanco no aporta su tipo |
| lo que viaja | `cabeceraParaPayload` (pura) | `{concept, apartado: true}`, más `description` y `agrupado: true` sólo si los hay (ausente ≠ vacío). Con «Incluir descripción en el PDF», la descripción va además pegada al concepto, como en una línea (SCRUM-603) |
| conservar | `addLine`, borrador, «Guardar plantilla», `cargarPlantilla` | `addLine` despacha a `addApartado` si llega `apartado: true`. Eso cubre «Duplicar», el borrador, las plantillas y la IA |
| lo que NO cuenta una cabecera | `lineasQueCobran()` | la propuesta de descuento pactado, la vista previa, «Continuar», «al menos una línea válida», el documento suelto y el suelo de «Eliminar línea». Si se borra la última línea que cobra y quedan cabeceras, nace un renglón en blanco: nunca queda una lista de sólo títulos |

Quitar una cabecera NO borra sus líneas: pasan al apartado de arriba, o a ninguno.

### Capturas (yaqu.app, cuenta QA, mis tres ficheros servidos por interceptación; datos de EJEMPLO)

Guion: `docs/master/evidencias/SCRUM-1807/captura-1807e-editor.mjs`. Medida: `captura-1807e-medida.json`. Fotos: `captura-1807e-editor-390.png`, `-1280.png` y `-1920.png`. Las escrituras se interceptan: la única fue `POST /admin/entorno`, que no llegó a prod. Errores de página: 0. Desborde lateral: no, en los tres anchos.

| ancho | «Varios» (caja) | chip «IVA 10 %» de una línea (caja) | Total del apartado |
|---|---|---|---|
| 390 | 46 · 298 × 44 | 46 · 298 × 44 | 231,00 € y 12.099,99 € |
| 1280 (el editor mide 544 px: va plegado) | 306 · 518 × 44 | 306 · 518 × 44 | igual |
| 1920 (fila única) | **853 · 168 × 44** | **853 · 168 × 44** | igual |

**La columna de IVA cuadra al píxel con la del chip en los tres anchos.** Lo enseñaron las capturas, en tres vueltas, y no la lectura del código:
1. Con el paso «Conceptos» CERRADO, «+ Añadir apartado» asomaba en su cabecera. Se añadió a la lista `.quote-paso.is-cerrado … { display: none }`. La captura lo mide (`botonConPasoCerrado: false`).
2. A 1920, «TOTAL DEL APARTADO» ensanchaba su columna y la fila corría 18 px. Ahora tiene un tope de 96 px, sólo en la fila única.
3. Después se pasaba 28 px al otro lado, porque le faltaba el asa «⠿» que tiene la línea. Se le puso (la misma pieza y el mismo texto), y de paso la cabecera se arrastra.

### El test (`tests/scrum1807e-editor-apartados.test.mjs`)

El banco de vistas monta el editor de verdad, lee lo que pinta y captura el cuerpo del POST /quote/create. Ocho casos: «Duplicar» conserva las dos cabeceras con su modo y su descripción · rótulos firmados, ni una coma más · el total suma lo que enseñan las filas · «Varios», el tipo único, y nada en desglosado · el POST lleva las cabeceras en su sitio · CONTROL: sin apartados, el POST no lleva ninguna clave nueva · «+ Añadir apartado», con el borrador que la guarda y la devuelve · las piezas puras.

**Rojo primero:** sobre los tres ficheros de `origin/main`, 1 de 8. El que pasa es el control. Con el cambio, 8 de 8.

**Mutaciones** (`correr` + `aplicarUna`, base limpia 8 / 0 / 0): **6 de 6 CAEN** sobre `main`, y 7 de 7 con la pila (abajo). Son: sin el despacho de `addLine` · la cabecera sale del POST · «Varios» se cambia por la lista de tipos · el total no suma · el borrador pierde el modo · `agrupado` no viaja.

### Vecinos (tanda dirigida: 203 ficheros que nombran el editor, la pieza o la hoja)

Primera pasada: 1.745 de 1.755, con 9 caídos. Se arregló el CÓDIGO, nunca un aserto (regla 41):
- `scrum229`: un segundo `lines.forEach` en `recalcTotals`. Las cabeceras se apuntan en el mismo recorrido y se pintan después, desde su propia lista.
- `scrum632`: su ancla de texto («appendChild» de la descripción de la LÍNEA) encontraba antes la de la cabecera. La variable de la cabecera se llama ahora `descApartadoTd`, y el comentario ya no repite el ancla.
- `scrum794`: su suelo se lee con la línea literal `if (lines.length === 1) {`. Se queda intacta, y el caso de las cabeceras va en una rama aparte, delante.
- `scrum697` y `scrum698`: cuentan los nodos que monta el editor, y hay uno más, 267 → 268. **Re-anclados por IDENTIDAD**, con su línea fechada, igual que 1716b, 1144 y 1180: es el `button.quote-add-apartado`. Sin cabeceras no se monta nada más.
- `scrum1340`: pedía este registro con la skill declarada. Es éste.

Después, los cinco ficheros y el nuevo, en verde. 🔴 La tanda dirigida corrió con el `dist/` de antes de regenerar el cliente de Prisma (el orquestador lo regeneró a mitad). Esos 203 ficheros no los he vuelto a correr enteros: los seis que cayeron sí. La suite entera la corre el check obligatorio.

### Lo que NO hace, y queda declarado

- **La vista previa** («Así lo verá el cliente») no pinta los apartados: sigue enseñando las líneas que cobran. Sería un quinto sitio que agrupa (PDF, firma, portal, editor) y no está en este tramo.
- **APILADA sobre el tramo d de S1** (`scrum-1807-apartados-s1`, #3446, OPEN a las 14:50Z). Lo decidió el orquestador: empujar sobre `main` habría abierto una ventana en la que se elige «Agrupado» y la puerta lo borra en silencio. Con la pila, el test cierra el viaje entero, porque el cuerpo del POST pasa por `CreateQuoteSchema` (el `dist/` de la rama) y conserva `[true, false]`. Por eso hay una 7.ª mutación, la de S1 («la puerta deja de declarar `agrupado`»), y también CAE: **7 de 7**. El registro de S1 y éste se juntaron sin conflicto. Con la pila, verdes también `scrum1807c/d/g` y `scrum619`.
- **Stash e3d8e53c** («s2-1807e-rojo-primero-versiones-de-main»): es la copia de recuperación del rojo-primero, con las versiones de `main` de los tres ficheros. Se queda hasta que 1807 se cierre, y entonces se tira (por decisión del orquestador, la misma política que con los de 1825).
- **En móvil, «Varios» va solo.** Sin la palabra «IVA» delante, como sí la lleva el chip de una línea («IVA 10 %»). Ponérsela sería texto nuevo, así que lo dejo como observación para el fundador.
- No se ha visto en yaqu.app con la rama en `main`: eso es la r42, después del merge.
# SCRUM-1807 · apartados del presupuesto: la parte de S1 (tramos c, d y g)

Hijo de SCRUM-1786. Decisiones y literales firmados: SCRUM-1786 c.22269 (P1–P5 y los tres textos), c.22329 y c.22389. Encargo del orquestador (`orquestador`), con cinco condiciones: ① el tramo c es un refactor y el PDF del presupuesto y el portal tienen que salir idénticos byte a byte; ② el tramo d va sin esquema; ③ el tramo g lleva sólo literales firmados; ④ el PDF de FACTURA ni se mira (P4, regla 40); ⑤ los literales se piden si no están en main. Rama `scrum-1807-apartados-s1`, un tramo por commit.

## SCRUM-1807c · `capitulos()`: el recorrido cabecera → subpartidas, en un sitio (25-nov-2026)

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:26:26Z
A9: sin fallo que generalice — tramo nuevo sobre `main` al día; el refactor se midió antes y después y no rompió nada que hubiera que contar.
Mutaciones: catálogo → `tests/scrum1807c-capitulos.test.mjs`

Puesto S1. En `origin/main` no había ninguna rama `scrum-1807*` (`git ls-remote --heads`).

**La deuda que se paga (c.22329).** El PDF del presupuesto (`generateQuotePdf`, SCRUM-1786f1) y el portal del cliente (`filasConTotalDelApartado`, SCRUM-1786g) hacían cada uno su recorrido de cabecera a subpartidas. El portal lo había COPIADO del PDF, porque allí vivía dentro de la función y no se podía importar.

**Qué cambia en `src`:**

| fichero | cambio |
|---|---|
| `src/modules/quotes/domain/apartados.ts` | **nuevo** `capitulos(lineas)` → `[{ cabecera, lineas }]`, y el tipo `Capitulo<T>`. Usa el mismo `esApartado` que `lineasQueSuman`: la marca es sólo el booleano `true` |
| `src/modules/invoicing/infra/pdf/pdf.service.ts` | sólo en `generateQuotePdf`: el `forEach` con `apartadoAbierto` pasa a ser `for … of capitulos()`, y el cuerpo de la fila pasa, sin cambiar una letra, a `pintarFila(l)`. `pintarTotalDelApartado` no se toca. El PDF de FACTURA no se ha abierto (condición ④) |
| `src/modules/system/app/routes/customerPortal.routes.ts` | `filasConTotalDelApartado` recorre `capitulos()` en vez de su copia |

**Lo que se comparte es SÓLO el recorrido.** La cifra la sigue poniendo cada consumidor. El PDF suma la columna IMPORTE sin IVA (`calcVatBreakdown(...).base`) y el portal suma las líneas con IVA (`calcTotal`), porque c.22389 decidió no igualarlas.

**El criterio, el que ya tenían los dos.** Una cabecera abre un capítulo, y sus líneas son las que la siguen hasta la próxima cabecera. Lo que va antes de la primera cabecera es un capítulo con `cabecera: null`, sin total. Dos cabeceras seguidas dan un capítulo con `lineas: []`, que sigue pintando su «Total del apartado» de 0,00, igual que antes. Sin cabeceras sale un solo capítulo sin cabecera. Las líneas son las mismas referencias que entraron.

### Condición ①: idéntico byte a byte, medido

Guion: `docs/master/evidencias/SCRUM-1807/comparar-antes-despues.cjs`. Carga los dos `dist/`, el de `origin/main` `77c000dea` antes del cambio (copiado fuera del árbol) y el de la rama. Congela el reloj, porque PDFKit escribe la fecha de creación. Compara el sha256 del PDF de `generateQuotePdf` y el del HTML de `GET /portal/:token`, que se sirve con el Prisma de mentira de scrum1786g. Lo corrí sobre 77c000d; entre 77c000d y `7592c8c` `main` no tocó ninguno de estos ficheros (`git diff --stat` vacío).

| caso | PDF | portal |
|---|---|---|
| control: el mismo `dist` dos veces | IGUAL | IGUAL |
| control: un carácter distinto en una línea | DISTINTO | DISTINTO |
| sin apartados | IDÉNTICO `eea2d3ff68caee96` | IDÉNTICO `56daa5241a287aad` |
| dos apartados (el caso de 1786f1/g) | IDÉNTICO `4935f0278d6487c0` | IDÉNTICO `9cfd5ceb12a7e24b` |
| líneas antes de la primera cabecera y un apartado vacío (con `dto`) | IDÉNTICO `14c626a97a4ed8ed` | IDÉNTICO `2b8922437e80c964` |
| cabecera al final | IDÉNTICO `8fc3a1226d822bab` | IDÉNTICO `6e01f733ea9a2edf` |
| 60 filas en seis apartados (varios saltos de página) | IDÉNTICO `e727337ad685a67d` | IDÉNTICO `0959d58020f348b7` |

Para no estar comparando una cosa consigo misma: los tres compilados difieren entre los dos `dist` por hash, y el nuevo lleva `capitulos`.

### El test (`tests/scrum1807c-capitulos.test.mjs`)

El oráculo es el bucle de `filasConTotalDelApartado` tal y como estaba en `77c000dea`, copiado letra a letra. Sólo cambia la cifra: en vez de calcularla, guarda la lista de líneas que se habría sumado. El recorrido nuevo se compara con él por IDENTIDAD de referencia, en 10 casos escritos (con marcas que no son `true`, líneas `null` y apartados vacíos) y en 500 secuencias generadas con semilla fija. El test exige que más de 300 de ellas lleven cabecera, para no medir a ciegas. También prueba la entrada que no es lista y la forma del resultado.

**Rojo primero.** Con el `dist` de `main`, 0 de 4 (`capitulos` no existía). Compilado: 4 de 4. Junto a `scrum1786f1`, `scrum1786g`, `scrum1786b` y `scrum655`: 40 de 40.

**Mutaciones**, corridas con `aplicarUna` del meta-guard (`scripts/meta-guard-mutaciones.mjs`). Las seis caen y el árbol queda restaurado y verificado por el propio instrumento:

| catálogo | mutante | resultado |
|---|---|---|
| `scrum1807c` | se pierden las líneas de antes de la primera cabecera | CAE |
| `scrum1807c` | una cabecera no cierra la anterior y arrastra sus líneas | CAE |
| `scrum1786g` | el último apartado (el de 2 líneas) se queda sin total | CAE |
| `scrum1786g` | el total arrastra las líneas de los apartados anteriores | CAE |
| `scrum1786f1` | la fila «Total del apartado» desaparece | CAE (su catálogo no se ha tocado) |
| `scrum1786f1` | el total deja fuera su última línea | CAE (su catálogo no se ha tocado) |

**🔴 El catálogo de `scrum1786g` (carril J2) se ha REAPUNTADO, no rebajado.** Sus dos mutaciones citaban texto literal del bucle que el refactor quita (`if (abierto) filas.push(…)`), y una cita que ya no existe deja la declaración «caducada». Siguen siendo las mismas dos formas de fallar, ahora escritas sobre el código nuevo: una en `customerPortal.routes.ts` y la del arrastre en `apartados.ts`, que es donde vive ahora. No se ha tocado ningún aserto de ese test, sólo su catálogo y la línea de «deuda» de su cabecera. El de `scrum1786f1` sigue valiendo tal cual, porque `pintarTotalDelApartado` no cambia.

**La tanda entera en local NO terminó.** Claude Code la cortó porque la máquina se quedó sin memoria. Llegó a 10.477 `ok` y 4 `not ok`. Tres son los de esta máquina, que ya salen en SCRUM-1818.md: `scrum1726` D1 ×2 (el ICU de las fechas) y `scrum351` (junctions de `node_modules` rotas en otros árboles). El cuarto, `scrum534b-documentos-fantasma`, cayó a nivel de FICHERO a los 138 s, sin ningún subtest nombrado, en plena falta de memoria. Corrido solo, da 10 de 10. Lo que no llegó a correr lo corre el check obligatorio. Esto no es una tanda verde. `npm run guards:entrada`: 16 guards, en verde.

**Lo que esto NO hace.** No cambia ni una cifra ni un píxel: es la condición ①, y está medida. Tampoco toca la página de firma (eso es el tramo g) ni el PDF de factura.

## SCRUM-1807d · la clave `agrupado` en la cabecera, sin esquema (25-nov-2026)

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:52:27Z
A9: sin fallo que generalice — tramo nuevo sobre la misma rama, con `main` al día (0 commits por detrás); el trinquete de SCRUM-619 saltó como está diseñado para saltar, y se le dio la decisión que pide.
Mutaciones: catálogo → `tests/scrum1807d-agrupado-en-la-cabecera.test.mjs`

Puesto S1, relevo de la sesión que hizo el tramo c. **Decisión:** SCRUM-1786 c.22269, P3 ✅ (se elige POR APARTADO, en su cabecera, dentro del JSON de `Quote.lines`) y P4 ✅ (la factura sale siempre desglosada). **Sin esquema:** `prisma/schema.prisma` no se ha abierto; no ha asomado ningún ALTER.

**Qué cambia en `src`:**

| fichero | cambio |
|---|---|
| `src/core/validation/schemas.ts` | `QuoteLineSchema` declara `agrupado: z.boolean().optional()`. Sin esto, `z.object` la borraba en silencio (medido: rojo del primer caso). `.optional()` y sin `.default(false)`: una cabecera guardada antes no la lleva, y sale sin ella |
| `src/modules/quotes/domain/apartados.ts` | nuevo `esAgrupado(cabecera)`: `true` sólo si es una cabecera (`esApartado`) y la clave es el booleano `true`. Es lo que leerá el tramo g |
| `src/core/utils/utils.ts` | el tipo `QuoteLine` gana `agrupado?: boolean` (sólo tipo) |

**Ningún texto nuevo.** Un valor que no es booleano lo rechaza zod con su error de siempre, como ya pasa con `apartado`. Tampoco se toca un importe: la clave sólo vive en una cabecera, y las cabeceras no suman (`lineasQueSuman`). El test lo comprueba con `calcTotal`, con y sin la clave.

**🔴 Lo que NO hace, y queda como propuesta.** Una línea que NO es cabecera y trae `agrupado: true` pasa la puerta, y no significa nada, porque `esAgrupado` sólo la mira en una cabecera. Rechazarla, como se rechaza una cabecera con importes, pide un mensaje nuevo, y eso es texto que se firma (regla 39). Así que no se ha construido: va al orquestador.

### El test (`tests/scrum1807d-agrupado-en-la-cabecera.test.mjs`)

Mira tres cosas. Primero, que la clave **viaja**: la puerta la deja pasar, también con `false` y también en el modo de tres opciones. Segundo, que **se guarda**: el handler real de `POST /quote/create` (base doblada con `_envio-doblado.mjs`, WhatsApp en dry-run) se la pasa a `quote.create`. Tercero, que **se relee**: esa fila, después de pasar por `JSON`, recorrida con `capitulos()` + `esAgrupado()`, da `[true, false]` para los dos apartados. Y la **compatibilidad**: una cabecera sin la clave vale y sale sin ella.

**Rojo primero.** Con el `dist` de la punta del tramo c (`1a0b9d314`): 1 de 5. El que pasa es el de compatibilidad, que es el control y tiene que estar verde antes y después. Compilado: 5 de 5. Junto a `scrum1807c`, `scrum655`, `scrum1786g` y `scrum1786f1`: 35 de 35.

**Mutaciones**, con `aplicarUna` del meta-guard (driver de una vez, base limpia 5 pasados / 0 caídos / 0 saltados). Las cuatro caen:

| mutante | resultado |
|---|---|
| la puerta deja de declarar `agrupado` | CAE |
| `.default(false)`: el silencio se convierte en dato | CAE |
| `esAgrupado` con `Boolean(…)`: se adivina | CAE |
| `esAgrupado` mira también las líneas que no son cabecera | CAE |

**🔴 El trinquete de SCRUM-619 (`tests/scrum619-vocabulario-de-linea.test.mjs`) saltó, como debe.** Cayeron dos casos: «el vocabulario del PRESUPUESTO no crece sin que alguien decida» y «la divergencia, nombrada». Su mensaje pide decidir qué hace la factura con la clave, escribirlo y actualizar la lista. Es lo que hicieron SCRUM-655, 661, 594 y 632. La decisión no la toma esta sesión, la tomó el fundador: **P4 ✅**, la factura sale siempre desglosada. Va escrita en su bloque, y `agrupado` entra en `VOC_PRESUPUESTO` y en `DIVERGENCIA`. No se ha tocado ningún aserto, y la puerta de la factura suelta no se ha abierto (regla 40). Después: 8 de 8.

**Guards que leen `tests/` entero** (262, 409, 1415, 1344, 850, 850b, 754, 765, 1294): 93 de 93.

## SCRUM-1807g · la página de firma: «Total del apartado» y el apartado agrupado que se despliega (25-nov-2026)

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:59:38Z
A9: sin fallo que generalice — el único tropiezo fue del test. Su extractor de filas partía por `<tr` y se comía el `<`, así que la comprobación de «sin texto nuevo» leyó el atributo `class` como texto. Lo enseñó el propio aserto, con el texto delante, y se arregló en el extractor. Por eso el rojo del caso agrupado se tomó con ese extractor, y la prueba de que el caso caza el defecto son sus dos mutaciones (abajo).
Mutaciones: catálogo → `tests/scrum1807g-firma-total-del-apartado.test.mjs`

Puesto S1. Fichero: `src/modules/system/app/routes/quoteDecisionLanding.routes.ts` (S1) y su hoja `quoteDecisionEstilo.ts`. El portal (`customerPortal.routes.ts`, J2) no se toca.

**Decisiones:** SCRUM-1786 c.22269 (literal `Total del apartado`; P3, el modo por apartado; **P5 ✅**: en agrupado, el cliente puede desplegar las subpartidas en la página de firma) y c.22389 («cada vista suma como sus líneas: el portal CON IVA, el PDF SIN IVA. No se iguala»). Literales recibidos del orquestador, que los citó de Jira, porque esta sesión no tiene Rovo.

### La cifra: SIN IVA, y por qué (lo medido antes de construir)

El orquestador había decidido CON IVA, como el portal, y puso una condición: medir antes qué pintan las líneas. **Medido:** la columna «Importe» de esta página es NETA. Es `importeDeLinea` (`quoteDecisionLanding.routes.ts:197`, `qty × price`), sin IVA y sin `dto`, y la pinta la tabla en `:268-277`, cuyo comentario PC-B dice que la suma de las líneas es la Base imponible. Así que, por c.22389, el total del apartado es la base de sus líneas: `calcVatBreakdown(líneas del apartado).base`. Es la misma primitiva que el PDF del presupuesto (1786f1), y no `calcTotal`, como el portal, cuya columna va con IVA. El orquestador lo confirmó antes del push. El test no comprueba una cifra suelta, sino un invariante: **cada «Total del apartado» suma las celdas que el cliente tiene encima**. Lo prueba también con `dto` de línea, con céntimos, con líneas antes de la primera cabecera (no llevan total) y con un apartado vacío (0,00, como el PDF).

### Qué pinta

| apartado | filas |
|---|---|
| sin la clave (desglosado, lo de siempre) | la cabecera, sus líneas y debajo `Total del apartado` con el total en la columna Importe |
| `agrupado: true` (tramo d) | UNA fila: un `<details>` cuyo `<summary>` es el icono, el concepto que escribió el profesional y el total. Desplegado, enseña las subpartidas con su cantidad y su importe (P5) |
| líneas antes de la primera cabecera, o presupuesto sin apartados | como siempre, fila a fila, sin total |

El recorrido es `capitulos()` (tramo c), y el agrupado lo decide `esAgrupado()` (tramo d). **Ningún texto nuevo:** el único indicio de que se despliega es el triángulo del navegador. El test lo comprueba: quitados conceptos, cantidades, importes e iconos, en la fila agrupada no queda nada. Estilo: nueve clases nuevas al final de la hoja de la firma, con los mismos colores y bordes que ya usa la tabla, sin `style=` (SCRUM-1646d). El test exige una regla `.clase {` para cada una. El resumen, que es lo que se toca para desplegar, mide 44 px de alto (AB6), y el foco lo pone la regla `:focus-visible` que ya tenía la hoja.

**Sin apartados, la página es byte a byte la de antes:** lo comprueba la huella de `scrum888d` (8 casos, sha256 tomado con el código anterior), que sigue en verde.

**Captura** (banco `docs/master/evidencias/SCRUM-1807/servir-firma-1807g.mjs`: la ruta REAL del `dist`, con un Prisma de mentira y datos de EJEMPLO; Playwright a 390 px):
`captura-1807g-firma-plegado-390.png` y `captura-1807g-firma-desplegado-390.png`. Mirada: Baño agrupado = 728,50 € (320 + 180,50 + 228), plegado en una fila y desplegado con sus tres subpartidas; Cocina desglosada con «Total del apartado» 10.089,99 €, y un importe de 9.999,99 € que no se recorta. El único error de consola es el `favicon.svg`, que es del banco (no sirve `public/`).

### El test (`tests/scrum1807g-firma-total-del-apartado.test.mjs`)

Usa el banco de `scrum1442b`: el `GET /pay/quote/:token` real, con `prisma.quote.findUnique` doblado, y se lee el HTML. Tiene 5 casos. **Rojo primero** con el `dist` del tramo d: 2 de 5. Los dos verdes son los controles (sin apartados no sale nada nuevo, y lo que escribe el profesional sale escapado). Compilado: 5 de 5.

**Mutaciones** (`aplicarUna`, driver de una vez `docs/master/evidencias/SCRUM-1807/mutar-un-catalogo.mjs`, base limpia 5 / 0 / 0). Las cuatro caen y el árbol queda restaurado:

| mutante | resultado |
|---|---|
| la fila «Total del apartado» desaparece | CAE |
| el total suma CON IVA (base + cuota, la cifra del portal) | CAE |
| se ignora `agrupado`: el apartado sale desglosado | CAE |
| el desplegable no trae las subpartidas | CAE |

**Vecinos:** los 32 ficheros que ya leen la página de firma o su hoja, más `scrum1807c/d`, `scrum655`, `scrum1786g`, `scrum1786f1` y `scrum619`: 279 de 279 en 37 ficheros.

**Lo que NO hace:** las tarjetas de opciones (`renderTierCards`) no pintan ni total del apartado ni agrupado. Es lo mismo que hizo el PDF en 1786f1, que sólo tocó el modo clásico. La descripción de la cabecera no sale en la fila agrupada, porque esta página no pinta descripciones de línea en ningún sitio. El PDF de FACTURA no se ha abierto (P4, regla 40). Falta verlo en yaqu.app: se verá después del merge.

## SCRUM-1807e (2) · «+ Añadir apartado» va DETRÁS de «+ Añadir descuento» (S2, 26-nov-2026)

**Skill UI:** cargada
**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T16:42:09Z
A9: comprobación → `scripts/guard-915h-conceptos-limpios.mjs`

**Qué salió mal (A9).** Empujé #3456 con «+ Añadir apartado» montado ENTRE «+ Añadir línea» y «+ Añadir descuento», y el comentario del propio código lo decía. SCRUM-915h exige el descuento PEGADO a «+ Añadir línea» (`add.nextElementSibling === dto`), y el job «guards de navegador (fuera de la tanda)» lo cazó: run 45635626766, job 139280164609, `guard:conceptos-limpios` rojo(1) «descuento-junto -> «+ Añadir descuento» no va justo detrás de «+ Añadir línea»». No corrí los guards de navegador del editor antes del push; `guards:entrada` no los incluye.

**La cura, en el código, no en el guard:** el botón se sigue creando donde estaba (el clic se ata más abajo, `quotesView.js`), pero se MONTA justo detrás de `dtoGlobalWrap`, con la misma condición `!esDocumentoSuelto`. Nada más cambia: ni nodos (268, `scrum697`/`scrum698` intactos; solo su comentario), ni texto, ni CSS.

| medida | antes (CI, sobre 368753893) | después (local, sobre f31f2b11c) |
|---|---|---|
| `guard:conceptos-limpios` | rojo(1) · descuento-junto | verde · 5 de 5 casos · `junto=true` |
| `tests/scrum1807e-editor-apartados.test.mjs` | — | 8/8 |
| `tests/scrum697-un-solo-render.test.mjs` · `scrum698` | — | 9/9 · 11/11 |

**El otro rojo de #3456 no es de este tramo:** `tests/scrum553-etiquetas-pegadas.test.mjs` cae (22 extractores con el `>` pegado, tope 20) por dos líneas de `tests/scrum1807g-firma-total-del-apartado.test.mjs` (:92 `<tbody>`, :177 `<script>`), que vienen del PR de S1 #3446 (`scrum-1807-apartados-s1`, apilado debajo). Se cura en su rama; aquí entra con el siguiente merge de esa rama.
## SCRUM-1807g-cura · el test de 1807g, sin extractores con el `>` pegado (27-nov-2026)

**Medido contra:** `origin/main` = `246e5b8eeb33b70de41d009bb5615cd645fe3141` · 2026-11-27T09:10:30Z
A9: comprobación → `tests/scrum553-etiquetas-pegadas.test.mjs`

El CI del PR #3446 (run 45961179052, cabeza `8162293fd`) cayó en UN test: `not ok 10085 - SCRUM-553 · 🔴 el número de etiquetas con el `>` pegado NO SUBE`, con 22 extractores contra un tope de 20. Los dos que sobraban eran de esta rama: `tests/scrum1807g-firma-total-del-apartado.test.mjs:92` (`'<tbody>'`) y `:177` (`'<script>alert(2)'`). El diagnóstico fue de S2 y lo he comprobado en el TAP del artifact `tanda-tap`. La cura va en el test y el guard no se toca: `:92` pasa a `/<tbody[^>]*>([\s\S]*?)<\/tbody>/` y `:177` pasa a `!/<script[^>]*>alert\(2\)/.test(t)`, así que si el concepto sale sin escapar la comprobación sigue fallando. En local pasan `scrum1807g` + `scrum553` (21/21), guards:entrada y los 5 de árbol entero. El tropiezo: el tramo g se empujó sin pasar `scrum553`, que no está en guards:entrada y sólo corre en la tanda completa del CI.
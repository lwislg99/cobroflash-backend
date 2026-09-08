# SCRUM-600 · DOC-10 · Los dos fronts del documento, y los OCHO que nadie sujetaba

**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-24T18:20:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance entregado:** el censo del PASO 0 (derivado del código, dentro de la suite), **la red que
sujeta F7–F14** —que no existía— y la propuesta de forma con su motivo escrito. **La unificación
NO se ha codificado, y el motivo no es de tiempo: está bloqueada por microcopy que no existe y que
la regla 30 prohíbe inventar.** El bloqueo está cuantificado abajo.

---

## 1 · PASO 0 — el censo, derivado del código

Artefacto: `tests/_censo-dos-fronts.mjs` (puro) + `tests/scrum600-un-solo-front-documento.test.mjs`.
Corre en `npm test`, así que no caduca con este informe.

**Los dos fronts, y son dos ficheros distintos:**

| | presupuesto | factura |
|---|---|---|
| fichero | `public/dashboard/js/quotesView.js` (3.060 líneas) | `public/dashboard/js/nuevaFacturaModal.js` (231) |
| forma | **PÁGINA** (`renderQuotesView`, dos tarjetas) | **MODAL** (`openNuevaFacturaModal`, 560 px) |
| ruta propia | sí — `case 'quotes-new'` (`app.js:271`) | **no**: se abre desde un botón (`invoicesView.js:174`) |
| controles de formulario (derivado) | **32** | **10** |

**Censo B — capacidades. El inventario está escrito a mano; el veredicto lo deriva un detector
sobre el AST.** Se dice así de claro a propósito: una lista escrita a mano presentada como
derivada es el engaño que SCRUM-311 cazó en el guard de SCRUM-271.

| | capacidad | presupuesto | factura |
|---|---|---|---|
| F7 | vista previa en vivo, al lado del formulario | ✅ | ❌ |
| F8 | suplido de primera clase (la marca viaja en la línea) | ✅ | ❌ |
| F9 | coste y margen (markup por línea) | ✅ | ❌ |
| F10 | la comisión se declara en el propio formulario | ✅ | ❌ |
| F11 | Sugerir con IA + Usar plantilla, en primer plano | ✅ | ❌ |
| F12 | el selector de formas de pago dice QUÉ FALTA | ✅ | ❌ |
| E1 | los cuatro bloques en orden de decisión | ✅ | ❌ |
| E2 | condiciones de pago (select de plazos) | ✅ | ❌ |
| E3 | fecha propia del documento | ✅ | ❌ |
| E4 | qué datos del cliente salen en el documento | ✅ | ❌ |
| E5 | estado del documento en el panel derecho | ✅ | ❌ |
| E6 | autoguardado de borrador | ✅ | ❌ |
| E7 | guardar las líneas como plantilla | ✅ | ❌ |
| E8 | reordenar líneas (arrastre + mover) | ✅ | ❌ |

**14 a 0.** El SUELO del encargo —«si ya comparten front, decláralo y para»— **no se dispara**: lo
que dicen las capturas del fundador y lo que dice el código coinciden.

Un «no» repetido catorce veces es sospechoso de instrumento ciego, así que va con su suelo: el
censo A **sí ve** el modal (10 controles con sus rótulos). El escáner mira; lo que no hay, no hay.

---

## 2 · 🔴 EL HALLAZGO GRANDE — los OCHO estaban SUELTOS

El encargo pide romper uno a propósito y comprobar que algo cae nombrándolo. Se rompieron **los
ocho**, uno por uno, sobre `main` limpio, corriendo la tanda **completa** (3.934 tests) tras cada
rotura:

| | rotura | tanda completa | veredicto |
|---|---|---|---|
| F7 | se quita `rightCard.appendChild(previewBox)` | fail=**0** | nadie lo caza |
| F8 | se quita `suplido:` del objeto que se envía | fail=**0** | nadie lo caza |
| F9 | se quita `markupTd.appendChild(markupInput)` | fail=**0** | nadie lo caza |
| F10 | se quita `payMethodsWrapper.appendChild(pmFee)` | fail=**0** | nadie lo caza |
| F11 | se quita `linesHeader.appendChild(useTemplateBtn)` | fail=**0** | nadie lo caza |
| F12 | se quita `payMethodsWrapper.appendChild(pmNote)` | fail=**0** | nadie lo caza |
| F13 | `if (f.jobId != null)` → `if (false)` | fail=1 | **el que cae es el guard de CRLF** (SCRUM-533) |
| F14 | se quita `doc.image(imgBuffer, …)` del bloque de firma | fail=1 | **el que cae es el guard de CRLF** |

Los dos `fail=1` **no cuentan**: `albaranesView.js` (386 CR en disco) y `albaranPdf.service.ts`
(364) llevan CRLF, así que cualquier modificación suya despierta a SCRUM-533. Ese guard no dice
nada de la función — habría saltado igual cambiando un espacio.

**CONTROL POSITIVO, porque ocho ceros seguidos no distinguen «nadie lo vigila» de «no supe
mirar».** Se cambió el texto aprobado de la acción primaria del modal de factura y cayó
`SCRUM-289b · MICROCOPY`, nombrándolo. El banco sabe dar rojo.

### Por qué se podían perder sin que nadie se enterase

Las seis del formulario viven **dentro de una función de 3.038 líneas** que `node:test` no puede
importar: es un script de navegador. Lo dejaron escrito `quoteMargen.js` y `quoteSuplido.js` al
nacer —«lo único que se le puede exigir es la FORMA de su fuente»— y por eso lo que sí está
probado es lo que alguien **sacó** a función pura (el margen, el suplido). Lo que se quedó dentro
no lo prueba nadie: **un `appendChild` de menos no rompe nada, no lanza nada y no cambia ningún
número.** La pantalla simplemente sale sin eso.

F13 y F14 es peor, porque ahí sí hay tests (`albaran.test.mjs`, `pdfs.test.mjs`): comprueban que
el PDF **se genera**, no que **lleve el trazo dentro**.

### La red, y lo que aprendió de sus propios rojos

`tests/scrum600-un-solo-front-documento.test.mjs` sujeta los ocho por AST —no por `grep`, que da
verde con la línea comentada (SCRUM-515)— y cada detector lleva **control negativo dentro**: se le
quita el ancla a una copia en memoria y se exige que cambie de respuesta.

Ese control negativo cazó **dos detectores míos malos antes de que llegaran a nadie**, y las dos
lecciones valen para toda esta clase de guard:

1. **F8 era tautológico.** «Existe la clave `suplido` en algún literal» seguía diciendo que sí con
   el envío mutilado: la clave también está en el snapshot del borrador. La población no era «el
   fichero», era **el objeto que se envía**. Apretado a `lineaParaPayload(...)`.
2. **F13 cazaba el borrado pero no la DESACTIVACIÓN.** Con `if (false)` la llamada seguía en el
   árbol y la red daba verde. Ahora exige que la llamada cuelgue de la condición que la hace
   alcanzable. *Un detector estático caza que algo se borre, no que se apague — y apagar es la
   forma barata de perder una función.*

**Verificación de la red:** rotas otra vez las ocho con el mismo banco, **las ocho caen ahora y
cada una se nombra**. Antes: 0 de 8.

---

## 3 · La forma propuesta — UN front con descriptor de tipo, no dos vistas sobre piezas

**Propuesta: `renderQuotesView(container, opciones)` con un DESCRIPTOR congelado, una fila por
tipo de documento, que concentre TODO lo que difiere.** No dos vistas sobre piezas compartidas.
Tres motivos, y el segundo es el que decide:

**a) No hay piezas que compartir.** `renderQuotesView` es **una** función de 3.038 líneas donde
todo son variables de cierre: `lines`, `currentMerchant`, `pmChecks`, `dfChecks`, `validInput`,
`paymentSelect`, `linesBody`… `renderPreview()` lee doce directamente. «Extraer piezas» es
convertir ~30 cierres en parámetros: eso no es compartir, es reescribir el fichero — y la regla 4
prohíbe el rediseño total.

**b) 🔴 Partir en piezas ROMPERÍA los censos que ya existen, y en silencio.**
`tests/_orden-pintado-presupuesto.mjs` deriva el esqueleto del formulario como *«los `appendChild`
que NO están dentro de una función anidada»*. Y `quotesView.js:338` deja escrito, con su motivo,
que los cuatro bloques se escriben **enteros y sin factoría** justo para que ese censo los siga
viendo. Una factoría metería los `appendChild` dentro de una función y **el censo dejaría de ver
el formulario sin fallar**. Un descriptor no toca el esqueleto: sólo cambia qué texto y qué
destino recibe cada ranura.

**c) Dos vistas = el defecto de AGENTS.md.** Dos copias que hay que sincronizar a mano divergen —
allí divergieron siete veces (SCRUM-569). Y este repositorio ya tiene la versión pequeña del
mismo bug: **hay DOS selectores de cliente**, y `nuevaFacturaModal.js` lo declara como deuda desde
que nació. Con un descriptor la divergencia es **imposible por construcción**, que gana a un guard
que la vigila.

Lo que **no vale**, y el encargo lo dice: copiar `quotesView.js` y editarlo. Eso son dos fronts
otra vez.

---

## 4 · Lo que DIFIERE de verdad, y hay que declararlo — dieciséis, no tres

| # | difiere | presupuesto | factura |
|---|---|---|---|
| 1 | contenedor | página, dos tarjetas | modal 560 px |
| 2 | ruta | `quotes-new` | ninguna: no se enlaza, no se recarga, no se vuelve |
| 3 | endpoint | `createQuote(...)` | `POST /admin/invoices` |
| 4 | campos que viajan | **10** | **2** (`customerId`, `lines`) |
| 5 | **fecha propia** | `Válido hasta` = caduca la OFERTA (+30 d) | necesita **cuándo hay que pagar** — otro concepto |
| 6 | estados | `DRAFT` / `pending_approval`, con panel de estado | ninguno en el front |
| 7 | acción final | `Generar presupuesto` — **reversible** | `Emitir factura` — **irreversible (regla 29)** |
| 8 | borrador | autoguardado + `Limpiar formulario` | no puede tenerlo sin cambiar el modelo |
| 9 | después de crear | modal con PDF/WhatsApp/email/seguir editando | cierra, toast, recarga la lista |
| 10 | gate | ninguno | `modoDocumentoSuelto` (`factura`/`justificante`/`no`) |
| 11 | fiscal | ninguno | numeración de serie + sellado VeriFactu |
| 12 | condiciones de pago | 4 opciones + tramos personalizados | no aplican: ya está emitida |
| 13 | IVA | `IVA por defecto (%)` por documento + por línea | sólo por línea |
| 14 | suplido | marca + fuerza `tax: 0` | **el servidor descarta la clave** (ver §5) |
| 15 | selector de cliente | `<select>` con todos, precargado | buscador con `?search=` + debounce 250 ms |
| 16 | ámbito del fichero | global `renderQuotesView` | todo prefijado `nf` para no chocar en `window` |

---

## 5 · 🛑 LOS DOS BLOQUEOS. Ninguno es de tiempo

### BLOQUEO A · el microcopy no existe, y las DOS salidas están cerradas

**Medido por AST (literales, no comentarios): 33 literales de `quotesView.js` dicen
«presupuesto»,** y unos 28 llegan a la pantalla. Cada uno es una ranura que el descriptor necesita
en versión FACTURA: el título, el subtítulo, «Añade los conceptos que vas a presupuestar»,
«Estado del presupuesto», el vacío del panel, `Presupuesto #N`, «Total presupuesto» (dos veces),
«Presupuesto creado en borrador», «Error generando presupuesto: », la coletilla del PDF…

De todos ellos, el modal de factura aporta **texto aprobado para cinco o seis** (SCRUM-289b:
«Nueva factura», «Emitir factura», «Emitiendo…», «Factura emitida», sus dos errores). **El resto
no existe.** Y las dos salidas están cerradas:

* escribirlo → **regla 30** y ⛔ explícito del encargo;
* sacarlo con `[PENDIENTE …]` → **rojo mecánico**. El trinquete de SCRUM-402 sólo admite hoy seis
  ficheros (`exportView`, `libroRegistro`, `patronDetalleAcciones`, `semaforoFiscal`,
  `settingsSubmenus`, `settingsView`, uno cada uno). `quotesView.js` y `nuevaFacturaModal.js`
  están **fuera del censo**, y su R4b impide que un fichero que salió vuelva a entrar.

**Lo que hace falta del fundador:** las ~25 ranuras en versión factura. Y por delante de todas, la
que el encargo ya marca `[copy: fundador]`: **la etiqueta del vencimiento**.

### BLOQUEO B · el vencimiento no tiene dónde guardarse, y F8 se pierde en el servidor

Los dos salen de `validarFacturaSuelta` (`src/modules/invoicing/domain/facturaSuelta.ts:101`), que
**reconstruye cada línea** con exactamente `{ concept, qty, price, tax }`:

* **no hay campo de fecha** en el contrato: el vencimiento no es sólo una etiqueta que falta, es un
  dato que hoy no cabe;
* **la clave `suplido` se descarta**. El `tax: 0` sí sobrevive, así que en la factura F8 llegaría
  **a medias**: sin IVA, pero sin la marca.

Ampliar ese contrato es **camino de emisión** (reglas 29/38): `POST /admin/invoices` numera serie y
sella VeriFactu. **Es STOP, y además podría tocar `prisma/schema.prisma`, que es dominio del
fundador.** No se ha tocado nada: se declara y se para.

---

## 6 · Lo que queda hecho, y lo que no

**Hecho:** el censo (en la suite, no en este informe) · la red de los ocho, con control positivo y
negativo y probada rota · la forma propuesta con su motivo medido · las dieciséis diferencias.

**No hecho, con su motivo:** la unificación (bloqueo A) · el vencimiento (bloqueos A y B) · los
ganchos del punto 5 para 593/596/595/605/594 — son ranuras del descriptor, y el descriptor no se
puede cerrar sin los textos.

**Nada de esto es irreversible.** No se ha tocado `quotesView.js`, ni `nuevaFacturaModal.js`, ni el
schema, ni el camino de emisión, ni `INVOICING_ES_ENABLED`. Los dos ficheros nuevos son de tests.

## Tests que introduce esta entrada

* `tests/scrum600-un-solo-front-documento.test.mjs` — el censo del PASO 0 y la red de F7–F14.

---

# APÉNDICE · 24-ago-2026 · LA LISTA DE RANURAS (decisión del fundador: opción 1)

**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-24T20:05:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

## 🔴 EL NÚMERO EXACTO, y el «~25» era mío y estaba mal

| | |
|---|---|
| ranuras VISIBLES del front del presupuesto | **128** |
| de ellas, **nombran el documento** (grupo A, derivado) | **26 posiciones · 24 textos distintos** |
| dependen del documento SIN nombrarlo (grupo B, a mano) | **1** |
| **decisiones que esperan al fundador** | **25 textos** (24 derivados + 1 declarado) |
| las demás | **102** — no nombran el documento: sirven a los dos tal cual |

Las 26 posiciones dan 24 textos porque hay **dos parejas** que comparten texto: «Generar
presupuesto» (el botón y su restauración tras enviar) y el vacío del panel de estado, que sale
dos veces de la **misma** constante. Se decide una vez cada uno.

**La lista está FIJADA EN LA SUITE**, no en este documento:
`tests/scrum600-un-solo-front-documento.test.mjs`. Si alguien toca un rótulo del presupuesto, la
tabla de abajo deja de ser cierta **y el test cae nombrándolo** — un informe no se vuelve a leer.
Probado en rojo con tres roturas: cambiar un texto, borrar una ranura y romper la frase dentro de
un bloque de HTML. Las tres caen.

### Dos fugas del censo, medidas y tapadas — y por qué se cuentan

El número empezó siendo **23** y subió dos veces al arreglar el instrumento. Queda escrito porque
las dos fugas son la misma clase de error:

1. **Rótulos ENVUELTOS.** `cabeceraModal({ titulo: … })` no asigna a `textContent`: el texto viaja
   como propiedad hasta el constructor compartido. Se perdía el título del modal posterior.
2. **Rótulos tras una CONSTANTE.** `resultBox.innerHTML = STATUS_EMPTY_HTML` asigna un
   identificador. Se perdía el vacío del panel de estado — y es justo el idioma de la casa para el
   microcopy aprobado (`NF_ACCION_PRIMARIA`, `NF_TITULO_BLOQUE`).

Un censo que no sigue la envoltura ni la constante **no dice «hay ranuras que no veo»: dice un
número más pequeño.** Es la forma en que un censo miente sin fallar.

## GRUPO A · las 26 posiciones derivadas

Identificador = `fichero:línea:vía`, derivado del árbol. La línea es la del sha de arriba.
La columna «hoy en la factura» dice **no existe** con esas palabras cuando el modal no tiene nada.

| # | identificador | hoy en el presupuesto | hoy en la factura | veredicto |
|---|---|---|---|---|
| 1 | `quotesView.js:44:textContent` | `Crear presupuesto` | `Nueva factura` (título del modal) | **DISTINTO** · nombra el documento. **Ya hay texto aprobado**: sólo hay que confirmar si el título del modal sirve como título de página |
| 2 | `quotesView.js:51:textContent` | `Genera un presupuesto con varias líneas, calcula los totales y envía el link de pago por WhatsApp.` | no existe | **DISTINTO** · describe el flujo del presupuesto (mandar un enlace para que el cliente **acepte**). La factura ya está emitida y su alta está gateada por `modoDocumentoSuelto`: el flujo que describiría no es ése |
| 3 | `quotesView.js:97:cabeceraModal(titulo)` | `Presupuesto #${n} generado` | no existe | **DISTINTO** · «generado» no vale para un documento irreversible (regla 29) |
| 4 | `quotesView.js:106:textContent` | `Revisa el PDF del presupuesto antes de enviarlo por WhatsApp al cliente.` | no existe | **NO SÉ DECIDIRLO** · «revísalo antes de enviar» significa otra cosa cuando el documento ya está numerado y sellado: revisarlo **no permite corregirlo**. Es decisión de producto antes que de redacción |
| 5 | `quotesView.js:122:title` | `PDF Presupuesto #${n}` | no existe | **DISTINTO** · nombra el documento |
| 6 | `quotesView.js:225:setAlert` | `Presupuesto enviado por email.` | no existe | **DISTINTO** · nombra el documento |
| 7 | `quotesView.js:267:setAlert` | `Presupuesto enviado por WhatsApp.` | no existe | **DISTINTO** · nombra el documento |
| 8 | `quotesView.js:455:textContent` | `Solo presupuesto (facturación manual)` | no existe | **NO SÉ DECIDIRLO** · es una opción del select de condiciones de pago, y en una factura ya emitida **la ranura entera puede no existir** (diferencia 12). Si desaparece no hay texto que escribir: primero se decide si el bloque aplica |
| 9 | `quotesView.js:576:textContent` | `Pasada esta fecha el presupuesto caduca solo y el cliente verá "pide uno actualizado".` | no existe | **DISTINTO** · es la nota de B1: describe **caducidad de una oferta**, no vencimiento de un pago |
| 10 | `quotesView.js:675:textContent` | `Añade los conceptos que vas a presupuestar.` | no existe | **DISTINTO** · el verbo es del presupuesto |
| 11 | `quotesView.js:689:title` | `Describe el trabajo y Claude sugiere las líneas del presupuesto` | no existe | **DISTINTO** · nombra el documento |
| 12 | `quotesView.js:865:textContent` | `Generar presupuesto` (acción primaria) | `Emitir factura` (`NF_ACCION_PRIMARIA`) | **DISTINTO** · **ya hay texto aprobado**: confirmar. Y no es cosmético — generar es reversible, emitir no lo es |
| 13 | `quotesView.js:899:textContent` | `Estado del presupuesto` | no existe | **NO SÉ DECIDIRLO** · nombra el documento, pero además **la factura no tiene estados en su front** (diferencia 6): puede que el panel entero no aplique |
| 14 | `quotesView.js:911:innerHTML [const]` | `📄 Genera el presupuesto y aquí verás su número, el estado y si se ha enviado.` | no existe | **NO SÉ DECIDIRLO** · es el vacío del panel de 13: depende de la misma decisión |
| 15 | `quotesView.js:915:innerHTML [const]` | *(misma constante que 14)* | no existe | — se decide con 14 |
| 16 | `quotesView.js:930:innerHTML` | `<strong>Presupuesto #${n}</strong>` | no existe | **DISTINTO** · nombra el documento |
| 17 | `quotesView.js:1171:innerHTML` | `Total presupuesto` (KPI anclado) | no existe | **DISTINTO** · nombra el documento |
| 18 | `quotesView.js:1455:innerHTML` | `Total presupuesto` (pie de la vista previa) | no existe | **DISTINTO** · mismo texto que 17, misma decisión |
| 19 | `quotesView.js:1466:textContent` | `Presupuesto válido durante 30 días salvo indicación en contrario.` | no existe | **NO SÉ DECIDIRLO** · 🔴 es la coletilla legal impresa en el documento. En una factura una frase de ese sitio puede ser **afirmación fiscal** (reglas 7/17): antes de redactar nada hay que decidir si ahí va algo |
| 20 | `quotesView.js:2588:title` | `Añadir una línea con "${c}" (en ${n} presupuestos)` | no existe | **NO SÉ DECIDIRLO** · la señal de frecuencia se **deriva de `Quote.lines`** (SCRUM-162). Si en factura sale de otra población, el texto miente sobre los datos del profesional. Se decide la población, después el texto |
| 21 | `quotesView.js:2594:textContent` | `en ${n} presupuestos` | no existe | **NO SÉ DECIDIRLO** · es el par de 20 |
| 22 | `quotesView.js:2639:innerHTML` | `Elige una plantilla para cargar sus líneas en el presupuesto actual.` | no existe | **DISTINTO** · nombra el documento |
| 23 | `quotesView.js:2707:innerHTML` | `Dale un nombre a esta plantilla para reutilizarla en futuros presupuestos.` | no existe | **DISTINTO** · nombra el documento |
| 24 | `quotesView.js:2782:setAlert` | `Plantilla "${t}" cargada — completa los datos del cliente y genera el presupuesto.` | no existe | **DISTINTO** · nombra el documento y el verbo |
| 25 | `quotesView.js:3020:new Error` | `Respuesta inesperada al crear presupuesto.` | no existe | **DISTINTO** · nombra el documento. Llega a pantalla por el `catch` que lo concatena |
| 26 | `quotesView.js:3057:textContent` | `Generar presupuesto` (al restaurar el botón) | `Emitir factura` | — se decide con 12 |

**Reparto:** 0 «SIRVE EL MISMO» · 16 «TIENE QUE SER DISTINTO» · 8 «NO SÉ DECIDIRLO» · 2 que se
deciden con su pareja.

### 🔴 Por qué NINGUNA sale «SIRVE EL MISMO», y no es que no lo intentara

**Es una tautología de mi propio criterio y hay que decirlo:** el grupo A se define como «los
textos que dicen *presupuesto*», y un texto que dice *presupuesto* no puede salir tal cual en una
factura. Buscar un «SIRVE EL MISMO» aquí dentro era imposible por construcción.

Los «SIRVE EL MISMO» están **fuera** de esta tabla, y son la mayoría: **las otras 102 ranuras
visibles** —«Cliente», «Líneas», «Condiciones», «Envío», «+ Añadir línea», «Vista previa del
documento», «Formas de pago que verá el cliente», «Datos del cliente en el documento», los avisos
de error, los `aria-label`…— **no nombran el documento y sirven a los dos sin tocarlas.** Ésa es la
buena noticia del censo: de 128 ranuras, **hay que decidir 25**.

Con una salvedad honesta: que una ranura no nombre el documento **no demuestra** que sirva a los
dos. Demuestra que el criterio derivado no encuentra motivo para separarla. El contraejemplo es
justo el grupo B.

## GRUPO B · lo que el criterio derivado NO puede ver — 1 ranura, escrita a mano y marcada

| id | identificador | hoy en el presupuesto | hoy en la factura | veredicto |
|---|---|---|---|---|
| B1 | `quotesView.js:566:textContent` | `Válido hasta` | no existe | **TIENE QUE SER DISTINTO** · el presupuesto marca **cuándo caduca la oferta**; la factura necesita **cuándo hay que pagar**. Son conceptos distintos (DOC-15 / SCRUM-605) |

**Por qué está aparte:** no contiene la raíz «presupuest», así que ninguna búsqueda por texto la
encuentra. La puse a mano y lo digo. **Su nota SÍ está en el grupo A** (fila 9), y no se repite
aquí: contarla dos veces rompería el total.

Y sirve de **calibración**, como pedía el encargo: si mi criterio hubiera dicho «SIRVE EL MISMO»
sobre esta ranura, no distinguiría lo que tiene que distinguir. Dice DISTINTO.

**🔴 B1 tiene además el bloqueo B encima:** aunque el fundador escriba hoy la etiqueta,
`validarFacturaSuelta` **no tiene campo donde guardar la fecha**. El texto solo no desbloquea esta
ranura.

## Límites declarados de este censo

* **No sigue constantes compuestas.** `NF_TITULO_BLOQUE.cliente` es un acceso a propiedad y queda
  fuera por decisión: resolverlo pediría análisis de alcance, y atribuir un texto equivocado a una
  ranura es peor que no verla. Afecta al inventario de la **factura**, no al grupo A.
* **La columna 3 la empareja una persona.** Qué ranura de la factura corresponde a cuál del
  presupuesto es juicio mío, no derivación. El inventario de las 23 ranuras de la factura sí es
  derivado.
* **Las 4 filas que son bloques de HTML** (17, 18, 22, 23) llevan además marcado y estilos que no
  son microcopy. Lo fijado es la **frase**, no el bloque: así el guard no cae por un cambio de
  estilo.

## ¿Queda algo de DOC-10 construible SIN el copy?

**De DOC-10, no.** Todo lo que queda —la página, la ruta, el descriptor, los ganchos del punto 5—
desemboca en pintar texto que no existe. Es parada declarada, no medio front esperando textos.

**Fuera de DOC-10 pero para DOC-10, sí queda UNA cosa, y es la otra mitad de la verificación que
el encargo exige** («crear una factura por el camino nuevo produce el mismo resultado que hoy»):

> **Una caracterización de lo que HOY guarda `POST /admin/invoices`.** Medido: `scrum289b` cubre
> el gate, la tenencia, la regla 29, el microcopy y que la validación acepta/rechaza — pero **no
> fija la forma del resultado**, y en particular **no deja constancia de que las claves de más se
> descartan**. Eso importa mucho aquí: el front unificado enviará más campos de los que la factura
> admite, y hoy el servidor los tira **en silencio** (es cómo se pierde la marca de suplido, F8).

**Riesgo de hacerlo antes de tener las 25: bajo, y acotado.** Sólo **LEE** el camino de emisión, que
la regla 38 declara expresamente que **no es STOP**; se hace sobre las funciones puras del dominio
(`validarFacturaSuelta`, `calcVatBreakdown`), así que no necesita base de datos ni turno de
staging; y **no toca `quotesView.js`**, que es el fichero que este encargo protege.

El único riesgo real es de orden: si el fundador acaba decidiendo que la factura cambia lo que
guarda, la caracterización habría fijado un comportamiento que va a cambiar. Pero eso **también es
útil** —sería el rojo que avisa de que DOC-10 dejó de ser un cambio de front—, que es exactamente
lo que el encargo pedía vigilar.

**No se ha construido: se propone.** No estaba en el encargo de esta tanda.

# APÉNDICE · 8-sep-2026 · DOC-10 CODIFICADO — la factura suelta usa la página del presupuesto

**Medido contra:** `origin/main` = `b521d0a7` · rama `scrum-600b-la-factura-usa-el-front`.

> ⚠️ Esa referencia es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Lo que cambia respecto al informe del 24-ago:** aquel paró declarando DOS bloqueos. El de
**emisión** sigue en pie y aquí no se toca — y resulta que es el que DECIDE el alcance. El de
**microcopy** se ha reducido a dos rótulos, los ha firmado el asesor derivando, y con eso la
página se ha podido codificar.

---

## 1 · OBLIGACIÓN 0 — el punto de partida, medido antes de tocar

**No estaba hecho ni a medias.** Lo previo de SCRUM-600 (`beab60d1`, ya en `main`) era el censo y
la red de F7–F14; el front seguía siendo dos ficheros y dos formas.

Y los dos bloqueos seguían **vivos en el árbol**, no sólo en el informe:

* `validarFacturaSuelta` (`facturaSuelta.ts`) sigue reconstruyendo cada línea como
  `{concept, qty, price, tax}`: **sin campo de fecha y descartando `suplido`**;
* en `docs/microcopy/` **no hay ninguna aprobación para DOC-10** (7 ficheros, ninguno del ticket).

### La tabla ANTES / DESPUÉS, montando las pantallas (no leyéndolas)

| | modal (ANTES) | página · documento suelto (DESPUÉS) | página · presupuesto |
|---|---|---|---|
| forma | modal 560 px | **PÁGINA**, dos tarjetas | PÁGINA, dos tarjetas |
| ruta propia | **no** (sólo un botón) | **sí** — `invoices-new`, en `HASH_VIEWS` | `quotes-new` |
| nodos pintados | 26 | **159** | 263 |
| **controles pintados** | **12** | **22** | 46 |

| capacidad | modal | doc suelto | presupuesto |
|---|---|---|---|
| vista previa en vivo (F7) | ❌ | ✅ | ✅ |
| bloque Cliente · bloque Líneas | ❌ | ✅ | ✅ |
| total destacado (KPI) | ❌ | ✅ | ✅ |
| Sugerir con IA (F11) | ❌ | ✅ | ✅ |
| Condiciones · Envío · panel de estado | ❌ | ❌ | ✅ |
| plantillas (F11) · borrador · dirección de obra · IVA por documento | ❌ | ❌ | ✅ |

---

## 2 · 🔴 LA REGLA QUE DECIDE QUÉ SE PINTA, Y NO ES UNA LISTA DE GUSTOS

> **Un control aparece en modo documento suelto si y sólo si su dato SOBREVIVE al emisor.**

`validarFacturaSuelta` admite `customerId` + líneas de `{concept, qty, price, tax}` y **descarta
el resto en silencio** — medido y fijado en SCRUM-616. Así que condiciones de pago, envío,
dirección de la obra, IVA por documento, descuentos, coste y suplido **no se pintan**: pedirlos
sería recoger datos que el servidor tira sin decírselo al profesional, que es **peor** que el
modal estrecho que se sustituye.

El caso que lo ilustra es el **suplido** (F8): el `tax: 0` sobrevive y la MARCA no, así que
quedaría guardado como una línea normal al 0 %, indistinguible de una exención legítima. Sin
error, sin aviso y sin diferencia de importe.

**Ampliar lo que la factura admite es camino de emisión (reglas 29/38) y puede tocar
`prisma/schema.prisma`.** Es STOP: se declara y se para. **No se ha tocado.**

---

## 3 · La microcopy: de 25 decisiones a 2, y las 2 firmadas derivando

**El alcance forzado por el emisor reduce el bloqueo A casi entero**: la mayoría de las ranuras
pendientes pertenecen a bloques que ya no se pintan. Quedaban **dos**, las dos el mismo rótulo:
el KPI del total y el pie de la vista previa, hoy «Total presupuesto».

> ✅ **FIRMA DEL ASESOR (7-sep-2026), derivando y no inventando.** Modo documento suelto →
> **«Total»**, que es el rótulo con el que `invoiceDetailView.js` ya destaca el total de una
> factura. **No entra palabra nueva en el árbol.** Precedente: SCRUM-776. Queda **sujeta a
> revisión del fundador**; si veta «Total» a secas es un cambio de una línea.
>
> El presupuesto **no cambia**: sigue diciendo «Total presupuesto», byte a byte.

**Y ni un literal más.** Lo que necesitaba texto nuevo se ha **omitido y declarado**:

| se omite | por qué | qué haría falta |
|---|---|---|
| **plantillas** (usar y guardar) | sus dos hojas dicen «…en el presupuesto actual» y «…futuros presupuestos» | esas dos frases, firmadas |
| **coletilla legal** del pie del PDF | en un documento fiscal una frase ahí puede ser afirmación fiscal (reglas 7/17) | decidir **si va algo**, antes que redactarlo |
| **subtítulo** de la página | describe el flujo de mandar un enlace para que el cliente acepte | — |
| **pista** del bloque de líneas | «que vas a presupuestar»: el verbo es del presupuesto | — |
| **tooltip** de Sugerir con IA | nombra el documento; el botón se queda, con su rótulo neutro | — |

---

## 4 · La verificación, y CADA UNA probada en rojo

`tests/scrum600b-la-factura-usa-el-front.test.mjs` **monta las dos pantallas** en el banco de
SCRUM-417 y las conduce: teclea, pulsa y recoge lo que sale por la red.

### 🔴 EL CONTROL QUE DECIDE — mismo cuerpo, byte a byte

Misma entrada en las dos pantallas (`cliente 7`, «Mano de obra» × 2 a 50 €):

```
PÁGINA → POST /admin/invoices {"customerId":7,"lines":[{"concept":"Mano de obra","qty":2,"price":50,"tax":0.21}]}
MODAL  → POST /admin/invoices {"customerId":7,"lines":[{"concept":"Mano de obra","qty":2,"price":50,"tax":0.21}]}
IGUALES BYTE A BYTE ✅
```

Y lo que **queda guardado**, por las funciones puras del servidor (regla 38: sólo LEE):
`[{concept:'Mano de obra', qty:2, price:50, tax:0.21}]` · total **121.00**.

**Divergencia imposible, no vigilada:** el cuerpo lo compone `cuerpoDelDocumentoSuelto.js`, y hay
un guard que exige que **cada pantalla lo llame UNA vez** y no componga por su cuenta.

### 🔴 Con `INVOICING_ES_ENABLED` en su valor por defecto, la página no dice «factura»

Montada en modo justificante: **cero ranuras** con la palabra. **Control positivo:** la MISMA
página en modo factura dice «factura» en **exactamente dos** sitios, y son los dos rótulos
aprobados (SCRUM-289b): «Nueva factura» y «Emitir factura». Sin ese control, el verde de arriba
lo daría también una pantalla en blanco.

### Los tres rojos, medidos

| rotura a propósito | cae | nombrando |
|---|---|---|
| vuelve la dirección de la obra al documento suelto | ✅ | «no dice factura EN NINGÚN SITIO» (su opción dice «…de FACTURACIÓN») |
| «3. Condiciones» deja de pintarse también en el presupuesto | ✅ | «EL PRESUPUESTO NO PIERDE NADA» |
| la página compone el cuerpo por su cuenta | ✅ | «EL CONTROL QUE DECIDE» |

Árbol restaurado tras cada rotura: `Buffer.compare` = 0, CR = 0.

---

## 5 · 🔴 LOS HALLAZGOS — los cinco que sólo se ven MONTANDO la pantalla

Ninguno vivía en una ranura que el censo marcara como pendiente: vivían en piezas que se pintan y
ya. **Leyendo el código, los cinco salían verdes.**

1. el selector de **dirección de la obra**, cuya opción dice «Utilizar dirección de **FACTURACIÓN**»
   — o sea la palabra prohibida, en la pantalla de un justificante;
2. el rótulo **«IVA del presupuesto»**;
3. la pista **«Añade los conceptos que vas a presupuestar.»**;
4. el **tooltip** de Sugerir con IA;
5. 🔴 la peor: la **vista previa imprimía «Pago 100% al aceptar el presupuesto.»** — una condición
   que **nadie había elegido** (el bloque ya no se pinta, así que el selector conservaba su valor
   de fábrica), en el papel que ve el cliente del profesional.

### Y dos más, que son del instrumento y **anteriores a esta rama**

* **El extractor de ranuras no bajaba a las ramas de un ternario.** La lista que el fundador tenía
  delante decía **27 posiciones / 25 textos** y son **29 / 27**: se le escapaban los dos `setAlert`
  del alta («📋 Presupuesto enviado a un administrador para aprobación.» y «Presupuesto creado en
  borrador.»). Se arregla el instrumento; **no se baja el número**.
* **Un envoltorio mío escondió dos rótulos firmados.** Al meter el error del alta en un traductor,
  el censo de SCRUM-601 dejó de ver los dos textos de `errorAlEmitir()`: **16 → 14** literales
  dependientes del flag. Los textos seguían siendo correctos y seguían llegando a la pantalla; lo
  que se perdía era **quien los mira**. Se corrigió la FORMA —el respaldo vuelve a escribirse
  pegado a su sumidero— en vez de ensanchar el guard. Vuelve a 16.

---

## 6 · Lo que NO se ha hecho, con su motivo

* **El vencimiento** (B1 / DOC-15): sigue sin dónde guardarse. Es bloqueo de EMISIÓN, no de texto.
* **Suplido, coste, descuentos, condiciones, envío** en el documento suelto: lo mismo.
* **Plantillas y coletilla legal**: esperan microcopy del fundador (§3).
* **`nuevaFacturaModal.js` se queda en el árbol y deja de tener puerta.** No es descuido: es la
  referencia contra la que `scrum600b` comprueba la equivalencia, y lo que
  `guard:caja-documento-suelto` sigue midiendo en navegador. Borrarlo es decisión aparte.
* **Nada de producción ni staging.** Ni schema, ni camino de emisión, ni `INVOICING_ES_ENABLED`.

## Tests que introduce esta entrada

* `tests/scrum600b-la-factura-usa-el-front.test.mjs` — 12 tests: los dos suelos, el control que
  decide con su control negativo, lo que se guarda, divergencia imposible, «no dice factura» con
  su control positivo, el presupuesto intacto, lo que el emisor no puede guardar, y regla 29 (×2).

---

# APÉNDICE · 8-sep-2026 · SCRUM-600c · ¿CUÁNTO FALTA? LAS DOS PANTALLAS COMO CONJUNTOS

**Medido contra:** `origin/main` = `2f123b7071d148bc93b87a42354f52ede8bef065` · 8-sep-2026

**Este apéndice NO construye nada.** Mide y para. Ni una línea de `public/`, `src/` ni
`prisma/` — el árbol de trabajo lo confirma abajo.

**LA PREGUNTA:** 600 y 600b están mergeados. El ticket pedía que la factura reutilizara el front
del presupuesto **entero** —vista previa en vivo, plantillas, condiciones, formas de pago, datos
del cliente en el documento y envío—. Nadie había medido cuánto queda.

---

## 0 · QUIÉNES SON LAS DOS PANTALLAS, HOY

No se dan por sabidas: se derivan del router.

| | ruta del panel | entrada | fichero |
|---|---|---|---|
| **PRESUPUESTO** | `quotes-new` | `renderQuotesView(cont, template)` | `public/dashboard/js/quotesView.js:22` |
| **FACTURA** | `invoices-new` | `renderDocumentoSueltoView(cont)` | `public/dashboard/js/quotesView.js:4426` |

Y `renderDocumentoSueltoView(container)` es, literal, `renderQuotesView(container, null, true)`
(`quotesView.js:4427`). **Son el MISMO fichero y la MISMA función.** Lo que las separa es el
tercer argumento, que dentro se llama `esDocumentoSuelto` (`:53`) y actúa en **29 sitios**.

> ⚠️ **El par que mide `tests/_censo-dos-fronts.mjs` ya no es este par.** Aquel censo compara
> `quotesView.js` contra `nuevaFacturaModal.js`, que era la pareja de ANTES de 600b. Sigue siendo
> válido para lo que mide; no es el instrumento de esta pregunta.

---

## 1 · CÓMO SE MIDIÓ, Y POR QUÉ NO LEYENDO

Las dos pantallas se **MONTAN** en el banco de vistas (`tests/_banco-vistas.mjs`) y se enumera lo
que de verdad aparece en el DOM. No se lee el código y se deduce.

El motivo no es de gusto: **el propio historial de este ticket lo dice** — el commit `286ea50d`
se llama «la verificacion, y los CINCO defectos que solo se ven montando». Y una lista de puertas
`if (!esDocumentoSuelto)` habría dado un número **redondo y falso**, porque hay cosas que faltan
sin pasar por ninguna puerta (§5, el envío).

**Unidad de medida:** cada rótulo visible —`h1..h4`, `label`, `button`, `legend`, `summary`,
`th`, más `.quote-block-title`, `.preview-section-title` y `.field-label`— con la **región** a la
que pertenece, sacada de su ancestro (`.quote-block` titulado, o la tarjeta). La clave de
comparación es `región ▸ texto`, así que dos rótulos iguales en bloques distintos no se
confunden.

### 🔴 EL SUELO, y su resultado

| | bloques titulados | rótulos | montaje |
|---|---|---|---|
| presupuesto | 4 | **63** | 264 nodos · sin error · 0 rechazos |
| factura | 2 | **33** | 157 nodos · sin error · 0 rechazos |

Umbral: menos de 3 secciones en cualquiera de las dos ⇒ instrumento roto. **✅ Las dos lo pasan
con holgura.** Y las dos montan limpias: si alguna hubiera reventado, el número sería del fallo y
no de la pantalla.

### 🔴 EL INSTRUMENTO ESTUVO CIEGO, Y SE ARREGLÓ ANTES DE PUBLICAR NADA

La primera pasada dio 60 y 32 rótulos, y **«📋 Usar plantilla» y «✨ Sugerir con IA» no salían en
NINGUNA de las tres listas** — ni en «en las dos», ni en «falta», ni en «sobra». Desaparecían.

Causa: los dos botones ponen su rótulo con **`innerHTML`**, y el parser del mini-DOM
(`_banco-vistas.mjs:416`) sólo crea nodos a partir de `<etiqueta>`. Un `innerHTML` de **texto
plano** no deja hijos **ni** `textContent`: sólo `_html`. En un navegador de verdad esos botones
tienen texto.

Es el defecto más caro que puede tener un censo: **un hueco del instrumento se lee igual que una
ausencia del producto**, y aquí escondía justo una de las seis capacidades que nombra el ticket.
Se corrigió el barrido (respaldo a `_html` cuando no hay texto y el `_html` no lleva marcado) y se
comprobó **en positivo** que los dos botones aparecen. Los números de arriba son los de después.

⚠️ **Es hueco del BANCO, no del producto**, y queda reportado sin arreglar (regla 37): lo mismo le
pasará a cualquier otra vista que rotule con `innerHTML`.

---

## 2 · ① LAS QUE ESTÁN EN LAS DOS — 19

```
  (bloque sin título) ▸ Limpiar formulario
  1. Cliente          ▸ 1. Cliente
  1. Cliente          ▸ Cliente
  2. Líneas           ▸ 2. Líneas
  2. Líneas           ▸ Concepto · Cantidad · Precio · IVA 21 %
  2. Líneas           ▸ IVA por defecto (%)
  2. Líneas           ▸ + Añadir línea
  2. Líneas           ▸ Total —
  2. Líneas           ▸ ⋯
  2. Líneas           ▸ ✨ Sugerir con IA
  ▸ PANEL DERECHO     ▸ Vista previa del documento
  ▸ PANEL DERECHO     ▸ Cliente · Concepto · Cant. · Precio · Total
```

**Lo que 600b sí dejó puesto, y es real:** el bloque de cliente, el cuadernillo de líneas entero
con su IVA por defecto y sus ajustes, la sugerencia con IA, y **la vista previa en vivo**.

---

## 3 · ② LAS QUE ESTÁN SOLO EN PRESUPUESTO — 32 · **ESTO ES LO QUE FALTA DE 600**

Cada una con el sitio que la apaga. Todas las líneas son de `public/dashboard/js/quotesView.js`
salvo donde se diga.

### Bloque «3. Condiciones» — NO LLEGA A LA PANTALLA (puerta `:419`)

| rótulo | nace en | dato que lleva |
|---|---|---|
| 3. Condiciones | `:420` | — |
| Condiciones de pago | `:635` | `Quote.paymentTerms` |
| + Añadir tramo | `:687` | `Quote.tiers` · `Quote.selectedTierId` |
| Válido hasta | `:773` | `Quote.validUntil` |
| 7 días · 14 días · 30 días | `quoteAtajosVencimiento.js:63` (`DIAS_ATAJO`) y `:136` (`rotuloDeAtajo`) | `Quote.validUntil` |

### Bloque «4. Envío» — NO LLEGA A LA PANTALLA (puerta `:427`)

| rótulo | nace en | dato que lleva |
|---|---|---|
| 4. Envío | `:428` | — |
| Datos del cliente en el documento | `:1119` | `Quote.docFields` |
| Nombre · Razón social · Nombre comercial · NIF · Email · Teléfono | `:1160-1161` y alrededor | `Quote.docFields` |
| Formas de pago que verá el cliente | `:880` | `Quote.payMethods` |
| 🏦 Transferencia · 💳 Tarjeta · 📲 Bizum | idem | `Quote.payMethods` |
| Incluir descripción en el PDF | `:625` | campo del documento |
| «acepto la propuesta» *(marcador `[PENDIENTE microcopy oficial]`)* | `:1000` | forma de pago del cliente (SCRUM-586) |

### Sueltas, fuera de bloque

| rótulo | puerta | dato que lleva |
|---|---|---|
| Dirección de la obra | `:510` y `:528` (rótulo en `quoteDireccionObra.js:63`) | `shippingAddress` · `shippingAddressMode` |
| IVA del presupuesto | `:607` (rótulo `:587`) | `Quote.ivaModo` |
| 📋 Usar plantilla | `:1280` (rótulo `:1271`) | sólo LÍNEAS |
| 💾 Guardar como plantilla | `:1623` (rótulo `:1610`) | sólo LÍNEAS |
| Descuento global · + Añadir descuento | `:1460` (rótulos `:1439` · `:1432`) | `discountGlobalAmount` |
| «acepto la propuesta» *(marcador)* | `:1507` (rótulo `:1490`) | descuento propuesto (SCRUM-587) |
| Crear presupuesto *(título)* / Generar presupuesto *(acción)* | `:78` · `:1600` | — *(renombrados, ver §4)* |
| Estado del presupuesto | `:1655` | estado del presupuesto |
| *(caja de estado, sin rótulo propio)* | `:1659` | número, estado y si se envió |
| Condiciones de pago **en la vista previa** | `:2356` | `Quote.paymentTerms` |
| *(pie de la vista previa)* | `:2505` | coletilla del documento |

### 🔴 Y TRES QUE EL MONTAJE NO PUEDE VER — detrás del botón `⋯`

`abrirHojaAjustes()` (`:3044`) sólo se abre al pulsar (`:3505`), así que **ningún barrido de
montaje las alcanza**. Se completan con el censo de puertas, y se declaran como lo que son:

| rótulo | puerta | por qué está apagado, según el código |
|---|---|---|
| Suplido | `:3431` | el validador descarta la clave `suplido`: quedaría como línea al 0 %, **indistinguible de una exención legítima** |
| Coste | `:3442` | `costeUnitario` se descarta; y no sale en el papel, así que nadie lo echaría de menos |
| Dto. % de línea | `:3457` | `dto` no pasa del validador: cambiaría el importe que el profesional espera |

---

## 4 · ③ LAS QUE ESTÁN SOLO EN FACTURA — 2, Y **NO SON SECCIONES**

```
  ▸ IZQUIERDA ▸ Nueva factura        (título,  quotesView.js:78)
  (sin bloque) ▸ Emitir factura      (acción,  quotesView.js:1600)
```

Son **los MISMOS dos controles** que en presupuesto dicen «Crear presupuesto» y «Generar
presupuesto», con el nombre del documento. No hay ni una sección que la factura tenga y el
presupuesto no.

> ⚠️ **El montaje enseña la voz «factura», y en producción se lee «justificante».**
> `rotulosDelDocumento.tituloModal()` decide por `window.appDocumentoSuelto` (`app.js:38`), que el
> banco nunca fija porque no sirve `/me`; sin él cae a la voz «factura». Un merchant español real
> está **en modo justificante**, así que hoy esa pantalla se titula **«Nuevo justificante»** y su
> botón dice **«Emitir justificante»** (`rotulosDelDocumento.js:74-75`). **Ningún rótulo se toca**
> — SCRUM-825 está parado. Se declara para que nadie lea esta tabla como una discrepancia.

---

## 5 · 🔴 EL ENVÍO NO ESTÁ EN NINGUNA DE LAS TRES LISTAS, Y ES EL HUECO MAYOR

El ticket nombra **ENVÍO** entre las seis. No aparece arriba porque **no falta por una puerta**:
falta por un `return`.

* El envío de verdad —WhatsApp, email y PDF— vive en `openQuoteModal()` (`quotesView.js:117`),
  que se abre en **`:4381`**.
* La rama de la factura es `if (esDocumentoSuelto) { … }` en **`:4182`**, y termina con
  **`return` en `:4218`**.
* Los dos están **dentro del mismo** `submitBtn.addEventListener("click", …)`. Comprobado, no
  supuesto.

⇒ **La factura hace `return` 163 líneas antes de llegar al envío.** Lo que hace en su lugar es
`showToast(…)` y `renderAppView("invoices")`: emite y se va al listado.

Esto **no lo veía ninguno de mis dos instrumentos**: el montaje no llega (es post-submit) y el
censo de las 29 puertas tampoco (no hay puerta, hay salida anticipada). Sólo sale leyendo el flujo.

**Y no está bloqueado por datos:** las rutas gemelas **YA EXISTEN** —
`invoicesAdmin.routes.ts:562` (`/:id/resend-whatsapp`) y `:613` (`/:id/send-email`). Lo que falta
es la hoja de front y su microcopy.

⚠️ Un detalle medido que quien lo construya necesita: el alta devuelve
`{ok, factura:{id, number, total, currency}, veriFactu}` (`invoicesAdmin.routes.ts:176`) — **sin
`pdfUrl`**, que es lo que `openQuoteModal` pide. Y hoy el front **descarta la respuesta entera**.

---

## 6 · LAS SEIS QUE NOMBRA EL TICKET, UNA A UNA

| | capacidad | estado |
|---|---|---|
| 1 | **Vista previa en vivo** | ✅ **ESTÁ** — falta sólo el pie (`:2505`) y las condiciones dentro de la previa (`:2356`) |
| 2 | **Plantillas** | ❌ falta (usar `:1280`, guardar `:1623`) |
| 3 | **Condiciones** | ❌ falta el bloque entero (`:419`) |
| 4 | **Formas de pago** | ❌ falta (dentro del bloque 4, `:427`) |
| 5 | **Datos del cliente en el documento** | ❌ falta (dentro del bloque 4, `:427`) |
| 6 | **Envío** | ❌ falta entero (§5) |

**Una de seis.**

---

## 7 · QUÉ TAMAÑO TIENE CADA HUECO — se copia, o no tiene dónde guardarse

Esto es lo que decide el trabajo que queda, y **se midió en la fuente**, no en los comentarios:
`validarFacturaSuelta` (`src/modules/invoicing/domain/facturaSuelta.ts:101`) devuelve
**exactamente** `{customerId, lineas:[{concept, qty, price, tax}]}`. **Todo lo demás del cuerpo se
cae en silencio.**

### 🟢 GRUPO A · bloque suelto — se copia, no necesita dato nuevo

| qué | por qué cabe |
|---|---|
| **Plantillas** (usar y guardar) | mueven **líneas**, y la factura ya guarda líneas |
| **Envío** | las rutas ya existen (§5); es hoja de front |
| Pie de la vista previa | es texto pintado, no dato guardado |

**Bloqueo real de este grupo: MICROCOPY, no datos.** El código lo dice de sí mismo en `:1280`: la
hoja de plantillas dice «…en el presupuesto actual», y se retiraron las dos juntas porque «dejar
"Usar" sin "Guardar" sería media función». Se enciende **cuando el fundador firme esas frases**
(regla 30).

### 🟡 GRUPO B · la columna existe, falta quien la escriba

| qué | columna | estado |
|---|---|---|
| Dirección de la obra | `Invoice.shippingAddress` · `shippingAddressMode` | existen desde SCRUM-602, **nadie las escribe** — y está declarado allí |
| Descuento global | `Invoice.discountGlobalAmount` | existe, **sin usar**, declarado en el propio schema |

🛑 **Es STOP del fundador**: escribirlas obliga a tocar `emitInvoice` o los `invoice.create`, y
**modificar el camino de emisión** es STOP (CLAUDE.md AA1.4). Leerlo no lo es (regla 38); esto no
es leerlo.

### 🔴 GRUPO C · no hay dónde guardarlo — cambio de `prisma/schema.prisma`

Campos que **`Quote` tiene y `Invoice` NO** (derivado comparando los dos modelos):

| qué falta en pantalla | campo que necesitaría |
|---|---|
| Condiciones de pago | `paymentTerms` |
| Tramos | `tiers` · `selectedTierId` |
| Válido hasta (y los atajos 7/14/30) | `validUntil` |
| IVA del documento | `ivaModo` |
| Formas de pago que verá el cliente | `payMethods` |
| Datos del cliente en el documento | `docFields` |
| Textos de cabecera y pie | `docHeaderText` · `docFooterText` |
| Suplido · Coste · Dto. de línea | viajan dentro de `lines`, y el validador los descarta |

🛑 **`prisma/schema.prisma` es dominio exclusivo del fundador.** Este apéndice lo **lee** y no
propone ALTER: la propuesta es un encargo aparte.

> Esto **confirma medido** lo que §6 de la entrada original dejó escrito («el vencimiento sigue
> sin dónde guardarse; suplido, coste, descuentos, condiciones, envío, lo mismo»). No lo
> contradice: lo cuantifica y le pone los campos con nombre.

---

## 8 · 🔴 VEREDICTO: **FALTA LA MITAD** — y por el lado largo

Los tres recuentos apuntan al mismo sitio, y ninguno se apoya en el otro:

* **bloques titulados:** 2 de 4 · faltan **«3. Condiciones»** y **«4. Envío»** enteros
* **rótulos:** 19 comunes · **32 sólo en presupuesto** · 2 sólo en factura *(y esos 2 son los
  mismos controles renombrados)*
* **capacidades del ticket:** **1 de 6** — sólo la vista previa en vivo

**Lo hecho es el esqueleto: cliente, líneas, previa, IA, y el cuerpo compartido.** Lo que falta es
**todo lo que rodea al documento**: qué condiciones lleva, hasta cuándo vale, qué datos del cliente
salen impresos, cómo se cobra, y **cómo llega al cliente**.

**Y el reparto del trabajo restante no es parejo:**

* **3 huecos se desbloquean con una FIRMA** (plantillas y envío: microcopy). Cero schema.
* **2 necesitan escritor en el camino de emisión** (dirección de obra, descuento global) — STOP.
* **8 necesitan columnas que no existen** — STOP, y del fundador.

Dicho de otro modo: **lo barato son las plantillas y el envío**, y el envío es además la única de
las seis que el ticket nombra y que el backend ya sabe hacer.

---

## 9 · HALLAZGOS APARTE (reportados, NO arreglados — regla 37)

1. **`nuevaFacturaModal.js` está MUERTO y sigue viajando al navegador.** Nadie llama a
   `openNuevaFacturaModal` en todo `public/` — medido. Y sigue cargándose en
   `public/dashboard/index.html:295` y precacheado en `public/sw.js:82`: **266 líneas que se
   descargan y no se pueden alcanzar**. La entrada original lo dejó a propósito («es la referencia
   contra la que `scrum600b` comprueba la equivalencia») — **eso justifica que siga en el árbol,
   no que se siga SIRVIENDO**. Decisión aparte, y hay que tomarla.
2. **Hueco del banco de vistas:** `innerHTML` con texto plano no deja `textContent` (§1). Cualquier
   censo por montaje es ciego a esos rótulos, y no lo dice.
3. **`tests/_censo-dos-fronts.mjs` mide un par que ya no es el par** (§0). No está roto; está
   desapuntado respecto de la pregunta de hoy.

---

## 10 · LO QUE ESTE APÉNDICE NO HA HECHO

* **Ni una línea de `public/`, `src/` ni `prisma/`.** El aporte de la rama sobre `main` es este
  fichero y nada más.
* **Ningún rótulo** nuevo, movido ni renombrado (regla 30). SCRUM-825 sigue parado.
* **Cero producción y cero staging.** Ninguna base tocada.
* **No se propone el ALTER** del grupo C: es del fundador, y se para aquí.

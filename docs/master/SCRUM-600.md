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

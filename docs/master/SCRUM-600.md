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

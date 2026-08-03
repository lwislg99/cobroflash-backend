# SCRUM-264 · MICROCOPY-SIN-LINEAS: los dos textos aprobados, y el copy que no llegaba a la pantalla

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** microcopy de superficie pública — **aprobado por
el fundador el 3-ago-2026** (regla 30). Las tres piezas de código no tienen gate.

## 1 · Los textos oficiales

**Profesional** (`COPY_ADMIN_SIN_LINEAS`):

> No se puede facturar: este presupuesto no tiene ningún concepto con precio. Añade lo que vas a cobrar.

**Motivo de la elección:** es **la voz que el producto ya usa para esta misma regla**. El aviso
`ROJO_SIN_LINEAS` del semáforo fiscal (`public/dashboard/js/semaforoFiscal.js`) dice «No se puede
emitir: esta factura no tiene ningún concepto.» + «Añade al menos una línea con su importe.».
Mismo patrón —qué pasa, dos puntos, qué hacer— para que el profesional no lea dos voces distintas
sobre lo mismo. Ese hermano estaba más cerca que los que se buscaron primero, y encontrarlo es lo
que hizo la decisión fácil.

**Cliente final** (`COPY_PUBLICO_SIN_LINEAS`):

> Hemos recibido tu aceptación. El profesional tiene que terminar de detallar el presupuesto; te enviaremos la factura en cuanto lo haga.

**Motivo:** dice lo mismo más corto **y más claro** — «te enviaremos la factura» es concreto donde
«te llegará» no lo era: un futuro sin sujeto deja al cliente sin saber si esperar o reclamar. Este
copy **no desafinaba** con su registro (su hermano real es el aviso de SCRUM-234 en la misma
respuesta, que abre igual), así que **solo se acorta, no se reescribe**: al cliente no se le manda
hacer nada porque no puede hacer nada.

## 2 · 🔴 El copy público no llegaba a la pantalla (hallazgo, y por eso el ticket creció)

`POST /quote/:token/decision` respondía el 409 con **las dos cosas**: el código en `error` y el
texto humano en `message`. La landing leía **`data.error`**, así que lo que el cliente veía en
rojo, bajo la firma que acababa de dibujar, era literalmente:

> **factura_sin_lineas**

**Aprobar el texto no lo habría arreglado**, porque el texto viajaba bien y nadie lo leía. Es el
peor sitio del producto para enseñar un identificador interno: al otro lado no hay un profesional
que sepa interpretarlo.

**Y es SCRUM-151 a medio cerrar.** `public/dashboard/js/api.js:35-37` documenta ese mismo arreglo
**para el dashboard** —«cualquier endpoint sin `message` acababa mostrándole al usuario un
identificador interno»—. La landing pública se quedó fuera. Ahora lee
`data.message || data.error || 'Error al procesar.'`: **cambia la prioridad, no lo que se muestra
cuando no hay copy** — para los endpoints antiguos que solo mandan código, el código crudo sigue
siendo mejor que un mensaje genérico, porque al menos se puede buscar.

**Se arregla también el camino de RECHAZAR** (`:754`), misma pantalla y mismo defecto: su tipo
`DecisionApiError` ya declaraba `message?` y nadie lo leía. Arreglar solo el de aceptar habría
dejado la landing medio arreglada, que es exactamente cómo se llega a esta clase de hueco.

## 3 · La quinta ruta del portón, que se escapó del recuento de SCRUM-263

`POST /admin/invoices/:id/rectify` (`invoicesAdmin.routes.ts:731`) llama al portón de SCRUM-246,
pero su `catch` devolvía `500 internal_error`. Rectificar una factura sin importe daba «API 500:
internal_error» — un error mudo justo cuando el profesional intenta **corregir** algo, y con el
arreglo en su mano sin saberlo. La R1 es además el único instrumento con el que se corrige una
factura ya emitida (regla 29).

**Cómo se escapó, que es la lección y no la anécdota:** ese fichero **importaba
`esErrorSinLineas` y `COPY_ADMIN_SIN_LINEAS` y no usaba ninguno de los dos**. Los tenía delante.
Un import sin usar no lo caza `tsc` con esta configuración, y el recuento de 263 se hizo buscando
dónde se **respondía** el copy — y mirar la respuesta solo encuentra las rutas que ya lo hacían
bien. El guard AST de SCRUM-246 sí ve las cinco llamadas. El test de 263 pasa de cuatro rutas a
**cinco**, en el mismo fichero, para que el contrato siga viviendo en un solo sitio.

## 4 · El guard de jerga estaba MAL ANCLADO (decisión del fundador)

La versión anterior prohibía una lista de palabras que incluía **«línea»**. «Línea» es **la palabra
del propio producto**: el botón del editor dice «Añadir línea» en cuatro pantallas (`quotesView`,
`homeView`, `jobDetailView`, `aiQuoteAssistant`) y los mensajes hermanos la usan. El guard empujaba
contra el vocabulario que el usuario lee todos los días, y para pasarlo había que escribir peor.

> **Prohibir una palabra que el usuario ve en un botón no protege a nadie: fuerza un sinónimo peor.**

Re-anclado a lo que el usuario **no ve nunca**: identificadores de código, códigos de estado HTTP,
literales de programación y nombres internos del sistema (incluidos los fiscales que la regla 26
aparta del cliente). **Las tres primeras reglas son estructurales**, no una lista que crece a mano,
así que cazan también el identificador que nadie ha escrito todavía. Con `VOCABULARIO_DEL_PRODUCTO`
declarado y visible, y un test que falla si «línea» sale de ahí — el primer paso para volver a
prohibirla.

## 5 · Los rojos, uno por cambio

- **Landing:** con el código anterior, la expresión real extraída del bundle devolvía
  `factura_sin_lineas` en vez del copy. 2 de 3 en rojo. El test **ejecuta** la expresión sobre el
  cuerpo real del 409 en vez de buscar texto: un guard de texto pasa en verde con la expresión
  escrita al revés y se caza a sí mismo en el comentario que la explica.
- **Rectify:** `respondió 500 en vez de 409`, cuerpo `{"error":"internal_error"}`. 1 de 6.
- **Guard re-anclado:** verde con el ancla nueva y **rojo al volver a apretarla** — metiendo
  «línea» como si fuera jerga, el control «Añade al menos una línea con concepto y precio» cae.

Suite completa: **1101 tests, 0 fallos**.

## 6 · Hallazgo reportado, NO arreglado (regla 9 — otro carril)

**`public/login.html:84` es la tercera superficie pública con el mismo defecto**, y ahí SCRUM-151
está sin empezar por los dos lados: el front pinta `data.error` a pelo **y** `POST /auth/login`
(`auth.routes.ts:20,28`) responde `{error:'invalid_email'}` / `{error:'internal_error'}` **sin
`message` ninguno**. Un usuario que se equivoca al teclear su correo en la página de acceso lee
**«invalid_email»**. Arreglarlo pide tocar los dos lados y es dominio de auth, no de invoicing.
`public/register.html:100` **sí** está bien (`data.message || msgs[data.error] || …`).

Barrido completo de las nueve páginas públicas renderizadas en servidor: las **únicas** que
pintaban un código crudo eran los dos caminos de `quoteDecisionLanding`, ya arreglados aquí.

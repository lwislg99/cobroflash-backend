# SCRUM-302 · C2: el patrón de detalle aplicado al albarán — la ley, la tabla y las tres premisas

**Fecha:** 5-ago-2026 · **Carril:** A (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `c711b7968777f29fd00fcddae69c2ba8489c576a` · 2026-08-05T14:48:06+02:00
**Tanda:** 1622 tests, 1555 pass, 0 fail (el resto, gateados a staging)

> **Entregado en dos pasos:** primero la ley compartida, la tabla y sus guards —sin los cuales la
> página se habría escrito sobre tres premisas de las que **dos son falsas**—; después la página.

## Una sola ley, que era el riesgo que el encargo nombró

La maquinaria del patrón (destinos, reglas, resolutor, marcador de microcopy) vivía dentro de
`invoiceActionsRegistry.js`. Se ha extraído a **`patronDetalleAcciones.js`**, y ahora la usan
**los dos** documentos: la factura sigue con sus guards de B2 en verde (20/20 sin tocarlos) y el
albarán declara **solo su tabla**.

Si el albarán se hubiera llevado su copia, hoy habría dos registros del mismo hecho — el defecto de
las dos listas que esta casa lleva toda la semana pagando. Hay un **suelo** que lo vigila: si algún
registro vuelve a definir su propio `destinoEfectivo`, rojo.

*(El resolutor conserva la semántica de B2 —`con-chargeId`/`sin-chargeId`— **y** admite la forma
genérica `ctx[cuando]` que necesita el albarán. Y una condición que nadie sabe responder se
**oculta**: el patrón entero se apoya en que la primaria sea de fiar.)*

## Las tres premisas, medidas — y dos desmienten al enunciado

**1 · El estado NO se llama «Enviado».** Son `borrador | emitido | firmado`, derivado del schema
(`estado String @default("borrador")`) y de `ALBARAN_ESTADOS`. El test **deriva los estados del
modelo** y los compara con la tabla: una columna inventada haría que ninguna transición cuadre.
Y «enviado para firmar» **existe, pero es un derivado** (`enviadoParaFirmaAt != null && estado ===
'emitido'`), no un estado — lo dice el propio schema.

**2 · «Facturado» no es un estado.** Es un derivado de **tres** valores —`sin_facturar`,
`parcial`, `facturado`— calculado contra `AlbaranLineaFacturada`. **Aplanarlo pierde el
parcial, que en una obra por fases es el caso normal.** Por eso no es columna de la tabla sino
**contexto**: la acción de facturar solo ocupa la primaria si queda algo pendiente. Con el albarán
ya facturado del todo —o sin contexto— se oculta, en vez de ofrecer un botón que no hace nada.

**3 · Las líneas del albarán no se pueden casar con las del presupuesto.** `AlbaranLineaFacturada`
referencia `lineaIndex` (el índice dentro del Json del **albarán**) e `invoiceId`; del
presupuesto, **nada**. Así que **no se construye ninguna vista de «albarán vs presupuesto»**, y hay
un test que se pone rojo si mañana aparece esa referencia — no para prohibirla, sino para que la
decisión se rehaga en vez de seguir asumiéndose.

## Verificado en rojo

- **Segunda primaria** en `emitido` → caen 2 tests, nombrando el estado.
- **«Enviado» metido como estado** → caen 4, con «la tabla usa estados que el modelo no tiene».
- **El guard de SCRUM-237 me cazó a mí**: mi `doesNotMatch` sobre `function destinoEfectivo` no
  tenía hermano positivo, así que habría sido verde para siempre aunque la regex estuviera rota. Se
  añadió el respaldo —el patrón **sí** casa en la ley compartida— en vez de silenciarlo.

## La página

`albaranDetailView.js` + vista `albaran-detail`. Pinta **desde el registro**: crea los botones con
su handler y los coloca donde la tabla diga — una primaria, hasta dos secundarias, el resto al «⋮».
La vista no decide nada del patrón.

**Endpoint nuevo, porque no existía:** `GET /admin/albaranes/:id`. El albarán solo se leía dentro
del detalle del Trabajo, y una página propia tiene que poder cargarse sola (enlace directo,
recarga, «atrás»). Devuelve el albarán, lo que el rail enseña, y el estado de facturación
**derivado con sus tres valores**, calculado con las mismas piezas que `facturar-parcial`.

**Rol declarado (S1):** va a `TECNICO_ALLOWED` con su motivo. Negarle al operario **leer** el parte
mientras puede rellenarlo, emitirlo y firmarlo sería incoherente: es la misma pantalla de su
trabajo de campo, solo que ahora tiene página.

**El rail es de solo lectura** — Trabajo, cliente, dirección, facturación y cuántas líneas quedan
por facturar. Y lo que **no** enseña tampoco es olvido: ninguna comparación con las líneas del
presupuesto, porque no hay campo que las ate.

**El traslado desde la fila:** ya no es una duplicación transitoria — está hecho, y lo que no se
movió tiene razón escrita y guard. Ver más abajo.

## Cuatro guards ajenos me cazaron, y los cuatro tenían razón

Ninguno era ruido, y los cuatro apuntaban a defectos que se habrían visto en producción y no en la
suite:

1. **Nombres duplicados en scripts clásicos.** Puenteé la ley con un `const destinoEfectivo` en el
   registro de factura: dos `const` con el mismo nombre comparten ámbito léxico → **SyntaxError en
   parseo**, el segundo fichero no se ejecuta y su pantalla desaparece **sin 500 ni log**. Es el
   caso de `copyRojo` (SCRUM-210). Ahora no se re-declaran: en el navegador ya son globales.
2. **El service worker no precacheaba los tres ficheros nuevos.** La primera visita sin cobertura
   se habría quedado sin esas pantallas, y con red no se nota nada.
3. **SCRUM-55 · ruta sin rol.** El endpoint nuevo no declaraba ninguno; ahora está en
   `TECNICO_ALLOWED` con su motivo escrito, en vez de aparcado en la lista de pendientes.
4. **SCRUM-128 · envío sin comprobar el resultado, dos veces.** Un WhatsApp responde 200 aunque
   Meta lo rechace. Escondí la comprobación primero en un `post` genérico y luego en un `enviar()`,
   y el guard cazó las dos: mide la distancia entre la RUTA y la comprobación. Ahora va **en el
   sitio de la llamada** — y es mejor código, porque quien lee el handler la ve.

## RÓTULOS — aplicados, y ninguno redactado aquí (regla 30)

Viven en un solo sitio, `ROTULOS_ALBARAN` (`albaranDetailView.js`). Cuatro los aprobó el fundador
para este ticket; los otros cinco se reutilizan **letra por letra** de la fila del Trabajo, que es
de donde estas acciones se mudan — reutilizar un rótulo aprobado no es redactarlo.

| id | rótulo | procedencia | dónde sale |
|---|---|---|---|
| `btnEmitir` | Emitir | fila del Trabajo | primaria en **borrador** |
| `btnEnviarFirmar` | Enviar para firmar | fila del Trabajo | primaria en **emitido** |
| `btnFacturar` | Facturar lo entregado | **aprobado aquí** | primaria en **firmado**, solo si queda pendiente |
| `btnFirmarAqui` | Firmar aquí mismo | **aprobado aquí** | secundaria en **emitido** |
| `btnPdf` | PDF | fila del Trabajo | secundaria en los tres |
| `btnWhatsApp` | Enviar por WhatsApp | fila del Trabajo | secundaria en **firmado** |
| `btnEditarLineas` | Editar líneas | fila del Trabajo | secundaria en **borrador** |
| `btnFoto` | 📷 Añadir foto | fila del Trabajo | «⋮» en los tres |
| `btnVerTrabajo` | Ver trabajo | **aprobado aquí** | «⋮» en los tres |

Y el enlace de la fila del Trabajo a esta ficha: **Ver albarán** (aprobado aquí).

> ⚠️ Una medición ajena sobre `c711b79` dijo que cinco de los nueve «ya estaban aplicados en
> main». Comprobado antes de tocar nada: las cadenas **existían en el árbol**, pero en la
> **página** los nueve botones pintaban el marcador `[PENDIENTE]`. Existir en un fichero y estar
> aplicado en la pantalla no son el mismo hecho. `btnPdf` es el que más chirría del grupo
> reutilizado —«PDF» a secas, heredado de una fila estrecha, junto a rótulos que son frases—; si
> el fundador lo quiere distinto, es una línea en `ROTULOS_ALBARAN`.

## EL TRASLADO DESDE LA FILA: HECHO, PERO NO ENTERO — Y CON MECANISMO

La fila del Trabajo era una barra de acciones y ahora es una **entrada**. Se han ido Emitir,
Firmar, PDF, Enviar para firmar, Enviar por WhatsApp y Añadir foto. Se han borrado también sus
constructores (`pdfBtn`, `fotoBtn`): un constructor que ya no llama nadie es código que se pudre
y hace creer que la fila todavía ofrece esas acciones.

**Firmar y la foto se implementaron DE VERDAD en la página** para poder irse de la fila. No es
alcance de más: sin eso, «Firmar aquí mismo» habría sido un botón que promete firmar y te manda a
otra pantalla a buscar otro botón. El pad de firma ya era global y el endpoint de fotos ya existía
— misma mecánica, otra superficie.

**Lo que NO se ha ido, y no es olvido: «Editar líneas» y «Facturar parte».** Su mecanismo
(`openAlbEditorSheet`, `openFacturarParcialSheet`) vive **anidado dentro de
`renderJobDetailView`** — medido: columna 2, no son globales. Desde la página solo se puede
NAVEGAR hasta ellos. Borrarlos de la fila no los movería: los dejaría **inalcanzables desde los
dos sitios**, y los dos botones de la página pasarían a ser callejones sin salida. Sacarlos es su
propio ticket, y el de facturar toca el camino del dinero (regla 37: no se hace de paso).

Eso no se queda en un comentario. `PUENTES_A_LA_FILA` declara el contrato y
`tests/scrum302-sin-callejones.test.mjs` lo verifica **derivándolo del AST de la página**: qué
acciones navegan de verdad, que estén todas declaradas, y que la fila conserve el botón de cada
una. `btnVerTrabajo` está exento y declarado: navegar **es** su función — la diferencia entre un
destino y un callejón.

> El primer intento de ese guard **no se puso rojo** al borrar `acts.appendChild(editBtn())`:
> comprobaba que existiera un `mkBtn` que llamara al mecanismo, y `editBtn` seguía *declarado*.
> Un botón creado y nunca añadido al DOM no existe para el pro — el mismo fallo que el guard dice
> cazar, escondido dentro del cazador. Ahora exige las dos cosas: que exista y que llegue a la
> pantalla.

## VALIDADO EN NAVEGADOR — los tres estados, con Tab de verdad

Banco con los ficheros REALES servidos por HTTP, Chrome headless por CDP, y **código de salida**:
nadie tiene que leer la salida para saber si pasó. 48 comprobaciones, `$? = 0`.

- Tab **de verdad** (`Input.dispatchKeyEvent`), no `.focus()`: `:focus-visible` distingue
  precisamente entre las dos cosas.
- Lo pintado se contrasta contra el **registro**, derivado en el propio navegador.
- El «⋮» se abre con **Enter** y se recorre con flechas (Tab lo cierra a propósito: es un menú).
  Sin esto, las acciones del overflow serían inalcanzables sin ratón.

## Lo que NO cubre

- **AB6 · matriz de dispositivos: hueco declarado.** El banco corre en un solo tamaño.
- **HALLAZGO AJENO — el anillo de foco no se pinta en NINGÚN botón primario del dashboard.**
  Medido con control (`btn btn-primary` pelado, sin nada de C2, falla igual): `.btn-primary`
  (`styles.css:412`) declara su propia `box-shadow` de reposo con la **misma especificidad** que
  la regla global `:focus-visible` (`styles.css:94`) y va **después** en el fichero, así que gana
  por orden de fuente. Afecta a todo el dashboard, es anterior a este ticket y es CSS global →
  **se reporta, no se arregla aquí** (reglas 9 y 37). Siguiente acción concreta: subir la
  especificidad de la regla de foco y medirlo con el mismo banco.
  El banco lo lleva como **excepción declarada y visible**, nunca como silencio: exige anillo en
  las no-primarias y **imprime** las primarias que se lo saltan.
  (Cuidado al medirlo: leer el estilo calculado en t=0 devuelve el valor de partida interpolado
  de la transición y hace pasar por «sin anillo» a un botón que sí lo tiene 350 ms después.)
- **El «⋮» degrada**: si `overflowMenu` no estuviera cargado, los botones se pintan sueltos en vez
  de perderse.

## Ficheros

`public/dashboard/js/patronDetalleAcciones.js` (nuevo — la ley) ·
`public/dashboard/js/invoiceActionsRegistry.js` (deja de definirla y delega) ·
`public/dashboard/js/albaranActionsRegistry.js` (nuevo — la tabla) ·
`public/dashboard/js/albaranDetailView.js` (nuevo — la página) ·
`src/modules/jobs/app/routes/albaranes.routes.ts` (`GET /:id`) ·
`src/core/http/adminRouteDeclarations.ts` (el rol, con motivo) ·
`public/dashboard/js/app.js` · `public/dashboard/index.html` · `public/sw.js` ·
`public/dashboard/js/jobDetailView.js` (la fila recortada: el enlace + los dos puentes) ·
`tests/scrum302-patron-albaran.test.mjs` (8) ·
`tests/scrum302-sin-callejones.test.mjs` (4, nuevo — el contrato con la fila) ·
`tests/scrum274-shell-alineado.test.mjs` (+1: toda entrada del SHELL resuelve a un fichero).

---

# SCRUM-302 · CONTINUACIÓN (5-ago-2026) · Duplicar: la clasificación y su guard

**Medido contra:** `origin/main` = `425301c8ddc79ad20e8605b49194f608ecdf339c` · 2026-08-05T22:32:02+01:00

> **ENTREGA PARCIAL Y DECLARADA.** Esto es el **mecanismo** de Duplicar, no la acción completa:
> falta el endpoint y el botón. Se paró aquí a propósito, en un punto medible, porque el guard del
> campo nuevo vale más que la acción entera sin él.

## El ticket estaba a medias, no «por hacer»

La página **ya estaba en `main`** (`albaranDetailView.js`, 286 líneas, con sus dos guards y su ruta,
PRs **#453** y **#457**). Jira decía «Tareas por hacer». Tercer ticket seguido con ese desfase:
**el `ls-remote` manda sobre Jira**.

## 🔴 Por qué es una clasificación y no una lista

El ticket pide «test explícito de que no se copia la firma». Ese test hace falta y está — pero
**solo sabe lo que hoy se nos ocurrió enumerar**. El fallo que da miedo es otro:

> Dentro de tres meses alguien añade un campo a `Albaran`. El duplicado se lo lleva **en silencio**.
> Si ese campo es evidencial, hemos fabricado un documento que **afirma algo que no pasó**.

El guard **deriva los 19 campos del modelo** y falla cuando aparece uno **SIN CLASIFICAR**. La
pregunta se le hace a quien añade el campo, en el momento en que lo añade — el único momento en que
alguien sabe la respuesta: *¿esto DESCRIBE EL TRABAJO (viaja) o es UN HECHO QUE OCURRIÓ (no viaja)?*

| Cubo | Campos |
|---|---|
| **Viajan** (5) | `merchantId` · `jobId` · `modoValoracion` · `lineas` · `notas` |
| **No viajan** (14) | `id` · `numero` · `fecha` · `estado` · `version` · `signatureUrl` · `firmadoAt` · `firmaToken` · `enviadoParaFirmaAt` · `evidenciaFirma` · `pdfUrl` · `createdAt` · `updatedAt` · `invoiceId` |

Cada uno con **su** motivo, no uno por grupo: cuando alguien discuta un campo concreto, hace falta
la razón de ése.

## Se construye SUMANDO, no copiando y borrando

`datosDuplicado` parte de `{}` y añade los del cubo que viaja. **Restar deja pasar lo que nadie se
acordó de restar.** Test propio con un campo inventado que no está en el modelo: si se copiara el
origen, aparecería.

`prisma/schema.prisma` **solo se lee**. El `numero` lo reserva `allocateAlbaranNumber` dentro de la
transacción, que es quien sabe hacerlo sin huecos. Las **fotos** no son un campo —son filas que
apuntan al albarán—, así que no copiarlas es no hacer nada; hay test de que sigue siendo así, porque
«no hacer nada» deja de ser cierto en cuanto alguien escriba el código que las copia.

## Los dos rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Un campo NUEVO en el modelo sin clasificar (`selloAeat`) | 🔴 «HAY CAMPOS DE `Albaran` SIN CLASIFICAR: **selloAeat**» |
| 2 | `signatureUrl` pasa al cubo que viaja | 🔴 «EL DUPLICADO SE LLEVA LA FIRMA DEL CLIENTE… falsificar un documento» |

El 1 es el que importa: **caza por nombre un campo que no existía cuando se escribió el guard.**
`schema.prisma` se restauró y se comprobó con `git status` que quedó intacto.

## Mediciones ordenadas por el fundador, hechas ANTES de construir

**① `Job.direccion` no tiene NI UN escritor.** 17 menciones en `src/`, todas `select:` o tipo; 10 en
`public/`, todas lecturas. El schema lo dice (`schema.prisma:671`). Consecuencia **distinta en cada
pantalla**: el rail del Trabajo (`jobRailBlocks.js:77`) hace `if (!direccion) return null`; el del
albarán (`albaranDetailView.js:272`) usa `valor ?? '—'` y **pinta la fila con un guion para todos los
merchants reales**. → separado a **SCRUM-374**, cuyo fondo es mayor: `buildFirmaEvidencia` lleva
meses sellando `obra: null`.

**② La tabla de cuatro estados del ticket NO coincide con el registro**, en cuatro puntos.
**Decisión: manda `albaranActionsRegistry.js`** — está construido sobre la corrección de que
«Enviado» y «Facturado» no son estados del enum. *Manda el que sabe más.*

**③ Los tres bloques `← C5`** (`FECHAS`, `LUGAR DE ENTREGA`, `FIRMADO POR`) esperan a SCRUM-300 y su
migración. **No se tocan.**

## Hueco declarado

**«Convertir en factura» NO se pinta.** Su mecanismo es **A0.4 = SCRUM-290**, sin construir. El
ticket lo exige así: *«un botón que no hace nada es peor que ninguno»*. Y no se inventa un segundo
camino a factura: `btnFacturar` (facturar parte) ya existe y es otra cosa — dos caminos a factura
sería SCRUM-240 otra vez.

## 🔴 Un comentario que caducó, y la regla que sale de ahí

La cabecera de `scrum302-patron-albaran.test.mjs` afirmaba: «las líneas del albarán NO se pueden
casar con las del presupuesto: no hay campo que las ate». **Dejó de ser cierto con SCRUM-367**:
`AlbaranLinea.quoteLineIndex` existe (`albaran.service.ts:56`), se conserva al editar (`:128-149`),
se valida contra el rango real (`jobs.routes.ts:664-667`) y lo escribe el prellenado
(`jobDetailView.js:313`).

**El test nunca midió eso**: mide el modelo `AlbaranLineaFacturada`, donde efectivamente no hay
referencia al presupuesto, y sigue verde con razón. Lo que caducó fue el COMENTARIO, que afirmaba
algo del sistema entero mientras el test comprobaba un rincón. Costó una decisión tomada sobre una
premisa falsa.

> **Un comentario que afirma un HECHO DEL SISTEMA caduca cuando el sistema cambia, y nadie lo
> revisa porque no está en ninguna suite. Un comentario que describe LO QUE MIDE EL TEST DE AL
> LADO no puede caducar sin que el test caiga.**

La premisa 3 se ha reescrito para decir qué mide, con la fecha y el ticket que la invalidaron.

## Duplicar, terminado

| Pieza | Dónde |
|---|---|
| Endpoint | `POST /admin/albaranes/:id/duplicar` (`albaranes.routes.ts`) |
| Registro | `btnDuplicar` en `overflow` en los TRES estados |
| Vista | botón con `MICROCOPY_PENDIENTE` (regla 30) |
| Rol | declarado en `adminRouteDeclarations.ts` con su motivo |

**El número se reserva DENTRO de la transacción**, con `allocateAlbaranNumber` — mismo patrón que
el alta, no uno nuevo. Fuera, dos duplicados simultáneos se llevarían el mismo `ALB-YYYY-NNN`, y un
número de albarán repetido no es un problema de interfaz: es un problema de documento. **Tiene su
rojo**: sacada la reserva fuera, el test cae nombrando la carrera.

El botón navega **al duplicado**, no al original: quedarse en el de ayer haría pensar que no ha
pasado nada.

### Los tres rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Campo NUEVO sin clasificar (`selloAeat`) | 🔴 «HAY CAMPOS DE `Albaran` SIN CLASIFICAR: **selloAeat**» |
| 2 | `signatureUrl` al cubo que viaja | 🔴 «SE LLEVA LA FIRMA DEL CLIENTE… falsificar un documento» |
| 3 | La reserva del número FUERA de la transacción | 🔴 «la reserva del número NO ocurrió dentro de `$transaction`» |

Los tres con `npm run build` limpio antes de creerse el rojo, y `prisma/schema.prisma` restaurado y
comprobado con `git status` tras el rojo 1.

## Lo que queda del ticket

**PRESUPUESTO ORIGEN enlazado**, en el rail y lejos de las líneas. Y el motivo es **más fino que el
que teníamos**, ahora que la premisa caducada está corregida: no es que no haya vínculo línea a
línea —lo hay, `quoteLineIndex`—, es que **el que hay no cubre todos los casos**: no existe en modo
`VALORADO`, solo lo pone el prellenado, y el índice no sabe de qué presupuesto es. Así que el enlace
del rail es **del DOCUMENTO**, no de las líneas, y no puede presentarse como si lo fuera.

**FOTOS — MEDIDO (5-ago-2026): el camino de lectura EXISTE. No es hueco.**

| Pieza | Dónde |
|---|---|
| Subir | `POST /:id/fotos` (`albaranes.routes.ts:648`) |
| Listar | `GET /:id/fotos` (`albaranes.routes.ts:704`) |
| Servir el binario | `GET /admin/attachments/:id`, montado en `app.ts:423` y **con su rol declarado** en `adminRouteDeclarations.ts:111` |
| Precedente funcionando | `jobDetailView.js:1728` **ya las pinta**: `img.src = /admin/attachments/${f.id}` |

> **Conclusión: se puede construir sin abrir camino nuevo.** No hay que inventar endpoint, ni ruta,
> ni forma de servir el binario: las tres existen y hay una pantalla usándolas hoy. Lo único que
> falta es pintarlas en el rail de esta página.

Queda escrito aquí para que la siguiente sesión **no vuelva a medir lo mismo**.

Ficheros: `src/modules/jobs/domain/albaranDuplicado.ts` (nuevo) ·
`src/modules/jobs/app/routes/albaranes.routes.ts` (el endpoint) ·
`src/core/http/adminRouteDeclarations.ts` (el rol, con motivo) ·
`public/dashboard/js/albaranActionsRegistry.js` (`btnDuplicar` en overflow) ·
`public/dashboard/js/albaranDetailView.js` (el botón) ·
`tests/scrum302-duplicar.test.mjs` (7, nuevo) ·
`tests/scrum302-patron-albaran.test.mjs` (la premisa 3, reescrita).

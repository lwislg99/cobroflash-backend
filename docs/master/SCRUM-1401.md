# SCRUM-1401 · Ocho comentarios del esquema dejan de enumerar valores y nombran quién los decide

**Medido contra:** `origin/main` = `938c73a6b1a18627d064891827a5729ab302bef3` · 2026-10-07T17:09:37Z (hora de GitHub)

A9: aviso → A10 «Un barrido que busca dónde se escribe un campo no ve el objeto que se construye en otro fichero: se cruza con el nombre del campo.» — no se pudo comprobar: es una regla de cómo se escribe un censo por AST, y no hay un instrumento de la casa que compare dos censos entre sí

Sesión J5 (`jv-j5`, 7-oct, equipo de Javier), ticket de `area-j5`.

## Ⓐ Qué se toca

`prisma/schema.prisma`: **9 líneas, y sólo su comentario** (8 propuestas; la primera ocupa dos
líneas). `git diff --numstat` da `9 9`. Ningún campo, ningún tipo, ningún `@default`. Ninguna línea
cambia de sitio. `src/`, `tests/` y `public/` no se tocan.

**La firma cubría diez y se ha usado para ocho.** El primer commit llevaba las diez (11 líneas) y el
obligatorio cayó: las dos de `EmailMessage` (líneas 1563 y 1571) salen del PR. El motivo, en la sección
«SCRUM-1401b» de abajo. Las cifras de este tramo son las del PR tal como queda.

**La firma.** El esquema se lee (regla 40) y un comentario suyo es el fichero. Las diez líneas se
presentaron al fundador redactadas en SCRUM-1401, comentario 18779, y las firmó: comentario 18780,
respuesta literal «Sí firmo», con cuatro condiciones (dejan de enumerar; donde no hay lista cerrada
la línea lo dice; ni un campo; el preview dice «sin cambios»). La firma la transcribió el
orquestador (`cobroflash-backend-90`); yo la leí en Jira antes de editar, no se la oí al fundador.
Las líneas entran letra por letra como están en el 18779.

## Ⓑ Los controles que mandan

| control | resultado |
|---|---|
| El esquema de antes y el de después, quitando de cada línea lo que va tras `//`, comparados línea a línea | 1.834 líneas los dos · 0 difieren (control: enteras difieren 9) · repetido tras sacar las dos de `EmailMessage` |
| `node scripts/preview-migracion.mjs --desde <esquema de antes>` | «control positivo: la herramienta responde (33 tablas)» · «sin cambios pendientes» · sale 0 (`evidencias/scrum1401/preview-migracion.txt`) |
| retornos de carro y BOM en el esquema tras editar | 0 y no |

El preview no se pudo correr dentro del worktree: no tiene `node_modules` y la herramienta lo dijo
(«LA HERRAMIENTA NO RESPONDE», sale 1), que es lo que tiene que hacer. Se corrió con el MISMO guion
y el esquema nuevo copiados a una carpeta temporal fuera del repo, enlazada al `node_modules` de
`cobroflash-jv5` (Prisma 6.18.0, la versión de `package.json`). No es la ruta de la casa: lo declaro.

## Ⓒ Lo medido: los catorce no eran catorce iguales

El censo de SCRUM-1342 (36 comentarios que enumeran con «|», 14 que divergen) se repitió sobre el
esquema de `965e3d05`: 36 otra vez, y las líneas de los catorce sin moverse. Cada uno se midió contra
lo que el código ESCRIBE en la columna, por AST sobre los 319 `.ts` de `src/` (0 sin parsear), y
contra el máster (Partes J4, K1, L y MEDIA-1). Instrumentos y salidas en `evidencias/scrum1401/`:

    node docs/master/evidencias/scrum1401/escrituras.cjs <raíz con src/> <ruta a node_modules/typescript>
    node docs/master/evidencias/scrum1401/llamadas.cjs   <raíz con src/> <ruta a node_modules/typescript>

Controles de los dos: `Merchant.plan` da 6 escrituras; un campo, un modelo y una función inventados
dan 0.

| clase | cuántos | líneas |
|---|---|---|
| A · sólo el comentario estaba atrasado: 8 se corrigen aquí; 1563 y 1571 NO entran (SCRUM-1401b) | 10 | 70+72, 580, 672, 892, 1138, 1198, 1277, 1409, 1563, 1571 |
| B · no diverge del máster: no se toca | 1 | 1412 |
| C · el código escribe un valor que el máster no recoge: PARADO, cambio de máster | 2 | 1270, 1274 |
| D · no es el comentario, es comportamiento: fuera del ticket | 1 | 1157 |

Qué escribe el código en cada una de las diez (el detalle «hoy / código / propuesta», en el 18779):

| línea | campo | lo que decía | lo que escribe el código | quién decide |
|---|---|---|---|---|
| 70+72 | `Merchant.subscriptionStatus` | dos comentarios que se contradecían | lo mismo que la Parte L; el valor de la línea 70 no lo escribe nadie | Parte L y `stripe.routes.ts` |
| 580 | `Quote.origin` | un valor que nadie escribe | un solo escritor, y la revisión lo copia | `maintenance.service.ts`, `revision.ts` |
| 672 | `Quote.createdVia` | dos valores | cuatro, desde tres sitios | `schemas.ts`, `maintenance.service.ts`, `revision.ts` |
| 892 | `Invoice.type` | dos tipos | los tres de la unión | `TipoDocumento` |
| 1138 | `BotSession.state` | seis estados | los siete del máster | Parte K1 |
| 1198 | `CustomerEvent.type` | ocho valores | 17 (15 por 21 llamadas, 2 directos); sobran 2, faltan 11 | nadie: el campo es `string` abierto |
| 1277 | `WhatsAppMessage.relatedType` | tres | los cinco de la unión | `WaRelatedType` |
| 1409 | `Attachment.entityType` | dos, uno sin construir | dos, uno que no estaba | `attachment.service.ts`, `albaranes.routes.ts` |
| 1563 | `EmailMessage.kind` | cuatro y «...» | nueve | `CLASES_DE_CORREO` · **NO entra, sigue como estaba** |
| 1571 | `EmailMessage.relatedType` | tres | dos | `email.service.ts` · **NO entra, sigue como estaba** |

**El bot no era el caso de la regla 27.** El ticket y la ficha lo traían como «un estado que el máster
no tiene». El máster sí recoge el séptimo estado (Parte K1, línea 374, cambio A18 del 7-jul). Código y
máster coinciden; sólo el comentario se había quedado corto.

**El caso de la regla 27 es `WhatsAppMessage`, y no entra aquí.** Para el mensaje entrante el código
escribe un `type` y un `status` (`whatsappLog.service.ts:80-81`) que ni la Parte J4 ni la Parte L
recogen: la palabra del `status` aparece 0 veces en el máster (control: «delivered», 4). Y al revés, el
primer estado de la Parte L no lo escribe ninguna línea de `src/` (es sólo el `@default` de la tabla),
aunque `envioDelDocumento.ts:56` lo lee. Líneas 1270 y 1274 sin tocar; lo decide el fundador.

**Línea 1157 (`QuoteTemplate.paymentTerms`), fuera.** `templates.routes.ts:40` y `:79` guardan lo que
llegue en el cuerpo sin validar. Leído, no ejecutado. Corregir el comentario sin decidir si se valida
sería documentar un hueco.

## Ⓓ De paso, sin arreglar

- **El censo de SCRUM-1342 comparaba el comentario con el código, nunca con el máster.** Por eso dio por
  bueno `QuoteRequest.status`: comentario y código coinciden entre sí, y la Parte L dice otra máquina de
  estados. Los otros 19 que dio por buenos están sin cotejar con la Parte L.
- La misma lista atrasada vive en dos comentarios de `src/`: `registroDeEnvios.ts` (el `relatedType` del
  contexto de envío) y `metrics.service.ts:380`.

Los dos tickets (el de `WhatsAppMessage` y el de `QuoteRequest` con los 19) los abre el orquestador.

## Ⓔ Lo que me salió mal

- **Mi primer barrido no vio dos escrituras.** Buscaba la propiedad dentro de la llamada de Prisma, o en
  un fichero que nombrara al modelo. No vio el `createdVia` de `revision.ts` (el objeto se construye en
  un fichero que no nombra al modelo) ni una llamada a `recordCustomerEvent` hecha por alias en
  `maintenance.service.ts`. Los cazó un recuento por el nombre del campo, no el instrumento. Las dos
  salidas de `evidencias/` son un SUELO: la del 1198 da 20 llamadas y son 21.
- **La base se movió mientras medía.** Medí sobre `965e3d05` y construí sobre `938c73a6`. Entre los dos,
  en lo que este ticket mira, sólo cambió `src/modules/payments/disputes.service.ts`, que tiene una de las
  21 llamadas. No repetí el barrido: ninguna de las diez líneas enumera, así que no dependen de él.

## Ⓕ Lo que NO se ha hecho

- Nada se ha ejecutado contra una base: es AST y lectura.
- La parte ⑤ del ticket (las líneas `MAPA[clave] ?? defecto`) está CLASIFICADA en «SCRUM-1401b» y sin
  arreglar: es comportamiento.
- Las líneas 1157, 1270, 1274 y 1412 siguen como estaban. Y la 1563 y la 1571, también.
- No se corrió la tanda completa ni la dirigida (el worktree no tiene `node_modules`): la da el
  obligatorio del CI. En local, sólo los guards de registro que se citan en la entrega.

## Aceptación → dónde se ve

El ticket no trae una lista bajo «Aceptación»; trae «Lo que pide», y es lo que se usa.

| lo que pide (literal) | dónde se ve |
|---|---|
| ① Clasificar los 14 por consecuencia, no por número | sección Ⓒ de este registro |
| ② Decidir qué hace el comentario, y decidirlo UNA vez para todos | `prisma/schema.prisma`, 9 líneas: remiten a quien decide (firma: comentario 18780). Las dos de `EmailMessage`: NO HECHO → ticket que abre el orquestador de Javier (SCRUM-1401b) |
| ③ Las dos de `Merchant.subscriptionStatus` (70 y 72): una se va | `prisma/schema.prisma:70` y `:72` |
| ④ Re-medir los TRES sin verificar (1198, 1409, 1412) | sección Ⓒ y `evidencias/scrum1401/` |
| ⑤ Clasificar las 15 líneas de `MAPA[clave] ?? defecto` | sección «SCRUM-1401b» de este registro y `docs/master/evidencias/scrum1401/mapa-defecto-*.txt` (clasificadas; arreglarlas es otro tramo) |
| ⑥ nada de código cambia de comportamiento | sección Ⓑ: 0 líneas difieren sin comentarios y el preview dice «sin cambios» |

---

# SCRUM-1401b · Entran ocho de las diez firmadas, y la parte ⑤ clasificada con su rojo ejecutado

**Medido contra:** `origin/main` = `51d763211c6b71807eb7ead6bdf4b7fe718a7f5c` · 2026-10-07T17:25:28Z

A9: comprobación → `tests/scrum475-schema-vs-sql.test.mjs`

Sesión J5 (`jv-j5`, 7-oct tarde, relevo de la que escribió el tramo de arriba), equipo de Javier.

## Ⓖ El rojo, y por qué entran ocho

El primer commit de esta rama (`9d9db025`) llevaba las diez propuestas. Su obligatorio cayó (run
37657412776, sobre el merge con `938c73a6`): 10.997 tests, 10.903 pasan, **1 cae**, 93 saltan.

Cae «SCRUM-475 · el modelo de `schema.prisma` es el de la entrada de máster, línea a línea». Ese caso
compara el `model EmailMessage` del esquema con el bloque de código de `docs/master/SCRUM-475.md`,
línea a línea y **con los comentarios dentro**. Las propuestas de las líneas 1563 y 1571 cambiaban dos
comentarios de ese modelo.

**No lo vimos antes de empujar, ni la sesión anterior ni yo.** No se corrió ninguna tanda en local, y
nadie buscó quién mide el esquema **como texto** (se miró quién lo importa y qué DDL produce). El guard
hizo lo que tenía que hacer: por eso la línea A9 de este tramo es una comprobación y no un aviso.

**La decisión** (orquestador del equipo de Javier, `cobroflash-backend-90`, 7-oct, por el canal): las
líneas 1563 y 1571 salen del PR y vuelven a como están en `main`. Sus motivos, tal como los dio:

- cambiar el bloque de `SCRUM-475.md` para que el cambio pase sería cambiar lo que el guard exige
  (regla 41); el guard no está equivocado;
- la firma del comentario 18780 dice «estos diez comentarios, nada más»: no autoriza reescribir la
  entrada de máster aprobada de otro ticket;
- el propio guard lo dice: «Reportar, no arreglar».

**La firma cubría diez y se ha usado para ocho.** No se han perdido dos: se han dejado fuera a
propósito. El segundo commit sólo devuelve esas dos líneas (comprobado: el diff contra `938c73a6` ya no
tiene ningún tramo en `EmailMessage`, `--numstat` da `9 9`) y repite los controles de Ⓑ.

**Lo que queda dicho y sin hacer:** la misma lista atrasada vive en TRES sitios (el comentario del
esquema, el bloque de `SCRUM-475.md` y un comentario de `registroDeEnvios.ts`), y el guard obliga a que
dos de ellos coincidan. El ticket lo abre el orquestador.

Lo demás del obligatorio de `9d9db025`, por nombre (pasan/caen): SCRUM-1294 4/0 · SCRUM-267 50/0 ·
SCRUM-525d 8/0 · SCRUM-921 8/0 · SCRUM-859 6/0 · SCRUM-1342 13/0. Control con un nombre inventado: 0.

## Ⓗ La parte ⑤: `MAPA[clave] ?? defecto`, censada por AST

El ticket contaba 15 líneas, por texto. Por AST, sobre `src/` de `6536e63e` (319 ficheros `.ts`, 0 sin
parsear, 2.444 expresiones `??` o `||`):

| qué | cuántas |
|---|---|
| expresiones `X[k] ?? d` o `X[k] \|\| d` | 64 |
| · sobre una lista, con índice numérico (no les afecta) | 21 |
| · con la clave escrita como literal (`req.headers['user-agent']`) | 11 |
| · **sobre un mapa, con clave que no es un literal** | **32** |
| y con una propiedad detrás (`X[k]?.p ?? d`), sobre mapa | 1 |

Controles del censo: `SINONIMOS_UNIDAD` da 1; `BY_PLAN` da 0 (SCRUM-1342 ya lo arregló: hoy sólo
queda nombrado en un comentario, y por texto sí sale) y un mapa inventado da 0.

    node docs/master/evidencias/scrum1401/mapa-defecto-censo.cjs <raíz con src/> <ruta a node_modules/typescript> --todos
    node docs/master/evidencias/scrum1401/mapa-defecto-rojo.cjs  <raíz con dist/, src/ y node_modules/>

**El rojo se ejecutó**: 17 bancos, 204 casos. Cada banco llama al código real (el `dist/` compilado
de ese `src/`, o las líneas exactas del fichero transpiladas) con una clave conocida, una desconocida
—que fija el defecto— y los 12 nombres propios de `Object.prototype`. «Viva» = el resultado NO es el del
defecto.

### Las que importan: la clave no la controlamos y el resultado cambia (3)

| sitio | quién pone la clave | vivas | qué pasa |
|---|---|---|---|
| `quoteDecisionLanding.routes.ts:911` (`REASON_LABELS`, página pública de rechazo) | el cliente final, en el formulario | 12 de 12 | la etiqueta sale función u objeto; tras el JSON de la línea 933, en 11 el motivo se pierde y en 1 se guarda un texto de objeto |
| `metrics.service.ts:315` (`reasonCount`) | el cliente final: el motivo lo guarda la API pública de decisión (`quotes.routes.ts:354` y `:729`) | 12 de 12 | el recuento de ese motivo deja de ser un número (11) o el motivo desaparece de la lista (1); sale en los informes del profesional |
| `ai.service.ts:195` (`SINONIMOS_UNIDAD`) | el modelo de IA, sobre el dictado | 2 de 12 | la línea sugerida del albarán sale sin unidad, o con un objeto por unidad; las otras diez las mata el paso a minúsculas |

**Ninguna de las tres toca dinero ni el camino de emisión.** El precedente de SCRUM-1342 saltaba un
límite de plan; aquí lo peor es un motivo de rechazo perdido, una cifra de informe estropeada para un
profesional y una unidad vacía en una sugerencia. Para las dos primeras hace falta tener el enlace de
un presupuesto de ese profesional.

### La clave no la controlamos, y aun así NO cambia nada (6)

| sitio | quién pone la clave | vivas | por qué |
|---|---|---|---|
| `whatsappLog.service.ts:119` (`STATUS_RANK[next]`) | Meta | 0 de 12 | la comparación con algo que no es número da falso, igual que el defecto. Es aritmética, no diseño |
| `parteDictado.ts:313` (`BLOQUES`, dos veces) | el modelo de IA | 0 de 12 | devuelve una función, pero quien llama sólo compara con dos valores |
| `tradeCatalogs.ts:141` (`TRADE_CATALOGS`, dos veces) | el profesional (el oficio, por el cuerpo de la petición) | 0 de 12 | la clave lleva pegado el país; sólo cambia si el PAÍS guardado fuera una cadena fabricada (1 de 12, forzándolo) |
| `locales.ts:39` (`LOCALES`) | el país del profesional | 0 de 12 | el paso a mayúsculas mata los doce |

### La clave es nuestra: defensa en profundidad (23)

Ejecutadas (9): con la clave heredada el resultado cambia, pero la clave sale de una columna que
escribe nuestro código, o está validada en la puerta. `whatsappLog.service.ts:118`,
`job.service.ts:31` (lanza `TypeError`), `publicProfile.service.ts:52` (el oficio lo cierra un `enum`
en `schemas.ts`), `customerPortal.routes.ts:35` y `:36`, `payMp.routes.ts:98` y `:107` (el título que
se pinta es el del defecto), `receipt.routes.ts:267`, `botFlow.service.ts:630`.

Leídas, sin ejecutar (14): `internalAuth.ts:33` y `schemaCheckAuth.ts:63` (la clave es una constante),
`albaranContenidoFuentes.ts:184`, `albaranesListado.ts:127` y `:130`, `albaranVerificacion.ts:571`,
`metrics.service.ts:169`, `borradoMerchant.ts:251`, `stripePrices.ts:29` y `:45`,
`atestiguamiento.ts:159` y `:160` (dos expresiones en cada una). Y la de la propiedad detrás,
`metodoDeCobro.ts:189`: el `?.clave` la deja en el defecto.

Cuatro de estos sitios están en páginas de pago, en el precio de la suscripción o en las evidencias
fiscales (`payMp`, `receipt`, `stripePrices`, `atestiguamiento`). En los cuatro la clave es nuestra. No
se ha tocado ninguno.

## Ⓘ Lo que NO se ha medido

- **Que las columnas de estado sólo las escriba nuestro código** está leído por el origen del dato, no
  censado: no se han recorrido todas las escrituras de `charge.status`, `job.status` ni del estado del
  presupuesto.
- **Los bancos 9 y 10 ejecutan las líneas exactas, no la ruta entera.** El paso por la API de decisión
  (`String(req.body.reason)`) está leído y reproducido a mano en el banco, no ejecutado con una petición.
- **Las lecturas SIN defecto** (`MAPA[clave]` a secas, 95 sobre mapa) quedan fuera de la forma que pide
  el ticket. Están listadas con `--todos` y sin clasificar. Tres tienen clave de fuera y habría que
  mirarlas con el mismo banco: `firmaResend.ts:269` (el evento lo manda Resend), y
  `metrics.service.ts:75` y `:350` (el concepto de la línea lo escribe el profesional).
- Nada se ha corrido contra una base ni contra producción. No se ha arreglado nada.
- La tanda completa en local sigue sin correrse: la da el obligatorio.

## Ⓙ Lo que me salió mal

- **Empujé a ciegas de un guard que lee el esquema como texto** (lo de Ⓖ). La pregunta que faltó:
  antes de tocar un fichero, quién lo mide como texto, no sólo quién lo importa.
- **Mi primer recuento de la parte ⑤ fue por texto y daba 34 líneas**, con la de la página pública
  FUERA: usa `||` y yo buscaba `??`. Lo sustituyó el AST antes de salir de la sesión.
- **Un banco del rojo no arrancó a la primera** (recortaba líneas del fichero con expresiones regulares
  y dejaba un `return` suelto); el guion entero salía con 1 y sin tabla, y se rehízo leyendo tres tramos
  exactos.

## Aceptación → dónde se ve (lo que cambia respecto al tramo de arriba)

| lo que pide (literal) | dónde se ve |
|---|---|
| ② Decidir qué hace el comentario, y decidirlo UNA vez para todos | `prisma/schema.prisma`, 9 líneas. Las dos de `EmailMessage`: NO HECHO → ticket que abre el orquestador de Javier |
| ⑤ Clasificar las 15 líneas de `MAPA[clave] ?? defecto` | sección Ⓗ y `docs/master/evidencias/scrum1401/mapa-defecto-censo.txt` y `mapa-defecto-rojo.txt` |
| ⑤ (su segunda frase) Arreglarlas no entra aquí | NO HECHO, a propósito → las tres vivas, a decisión del orquestador de Javier |

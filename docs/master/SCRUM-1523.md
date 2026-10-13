# SCRUM-1523 · Censo del justificante: qué nombra cada sitio, y cuáles siguen trabajando

**Medido contra:** `origin/main` = `0472952cd2c54e1c336170fa502ca902e6fda8cf` · 2026-10-13T00:05:55Z

A9: comprobación → `docs/master/evidencias/SCRUM-1523/censo.mjs`

13-oct-2026 · **J4** (sesión `jv-j4`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J4. El encargo es la descripción de SCRUM-1523, leída entera en Jira; no tenía comentarios.]

**Es MEDICIÓN.** No se ha tocado `src/`, `public/`, `tests/`, `scripts/` ni `prisma/`. Ninguna base.
Ningún ticket transicionado. Lo único nuevo es este registro y su carpeta de evidencias.

## 0 · Lo que tumba medio ticket, antes que el censo

**El lector de `J-` NO es código muerto: se dejó a propósito, con firma, hace quince días.**

- `src/modules/invoicing/domain/invoiceNumber.service.ts:75-78` lo dice al lado de la constante: el
  generador se retiró (SCRUM-1027 lo dejó sin llamador, SCRUM-825 lo borró con la firma del
  comentario 17446) y *«se queda SÓLO el reconocedor, porque los justificantes ya emitidos siguen en
  la base y se tienen que poder identificar (regla 29)»*.
- `docs/master/SCRUM-825.md`, apéndice «D1 y D2 EJECUTADAS», apartado «Qué se queda, a propósito»:
  `isReceiptNumber` y `RECEIPT_NUMBER_PREFIX`, el tipo `'JUST'` como dato, el filtro de la lista, **el
  PDF de lo emitido** y el modo `receipt`.
- `tests/scrum1027-atajo-flag-off-sin-documento.test.mjs:211-215` lo **exige**: si desaparece el
  reconocedor o el prefijo, cae con el mensaje «los justificantes YA EMITIDOS dejan de reconocerse».

**SCRUM-1523 es, en su mayor parte, la decisión D1 de SCRUM-825 con otro número.** Aquel expediente
ya censó esta población (57 ficheros con su vocabulario, 34 rótulos), el fundador firmó «1-Sí a las 3»
sobre D1, D2 y D4, y de D1 se ejecutó el generador (servidor) y la rama del panel (SCRUM-1257c).
Lo que quedó sin ejecutar son las seis sub-preguntas de D1, y son las mismas que este ticket reabre.
⚠️ El comentario 17446 **no lo he abierto en Jira**: lo cito por el registro, que el 29-sep otra
sesión dice haber cotejado.

## 1 · ¿Hay justificantes en alguna base? — lo que sé y lo que NO sé

No he tocado ninguna base, y sin tocarla **no puedo saber cuántos hay hoy**. Lo que hay escrito:

| fuente | qué dice | fecha | ¿lo medí yo? |
|---|---|---|---|
| `src/modules/system/invoiceAdmin.ts:27` y `tests/scrum442…:39` | 44 de 55 documentos de producción no eran facturas | 10-ago-2026 | no |
| `tests/scrum413-tipo-factura-cerrado.test.mjs:23` | en producción, 44 `JUST` y 5 `F1` con número `J-` | sin fecha en la línea | no |
| `docs/master/SCRUM-825.md` (apéndice 21-sep, §4) | en dev quedan filas `JUST` (merchant 18) | 21-sep-2026 | no |
| memoria de ESTA máquina (no está en el repo ni la he visto en Jira) | el fundador contó en producción: una sola clase, `JUST`, 2 filas, ninguna sellada; cero `F1` con `J-` | 1-oct-2026 | no |

Las cuatro dicen que **hay justificantes guardados**; discrepan en cuántos (44 contra 2), y esa
discrepancia sigue sin explicar. **Ninguna dice cero.** Mientras exista una sola fila, todo lector
de la tabla de abajo es alcanzable: abrir su `/recibo`, descargar su PDF, reenviar su correo,
recordarle el pago.

La consulta que lo cierra es de sólo lectura y la pasa el fundador, no una sesión, en las tres bases:
cuántas filas de `invoices` tienen `type = 'JUST'` o un número que empieza por `J-`, y cuántas de
ellas siguen `pending`.

## 2 · El censo — instrumento y controles

`docs/master/evidencias/SCRUM-1523/censo.mjs` (sólo lee; clasifica cada aparición por el nodo del AST
de TypeScript que la contiene). Salidas guardadas al lado.

| | `src` | `tests` | `public` | `scripts` |
|---|---|---|---|---|
| población: ficheros de código seguidos por git | 323 | 1.492 | 98 | 290 |
| ficheros con «justificante» | **46** | 105 | 19 | 14 |
| apariciones | 162 | 543 | 102 | 72 |
| en comentario / cadena / identificador / otro | 118 / 19 / 25 / 0 | 225 / 235 / 74 / 9 | 83 / 10 / 9 / 0 | 37 / 31 / 2 / 2 |
| ficheros donde SÓLO aparece en comentarios | 26 | 31 | 12 | 4 |

- **Positivo SEMBRADO** (lo fabrica el instrumento en un temporal): 5 apariciones, 2 en comentario, 2
  identificadores y 1 en plantilla → `VISTO`. **Quitado** (`--sin-siembra`): `CIEGO`, salida 2.
- **Cero derivado**: la palabra del revés, «etnacifitsuj», por el mismo motor y la misma población → 0.
- **Positivo del árbol**: `src/modules/invoicing/infra/pdf/pdf.service.ts` sale, con 5 comentarios y
  2 cadenas (las líneas 401 y 712).
- **Segunda sonda**: el recuento a pelo coincide con el del AST en los cuatro árboles (0 discrepancias).

**El ticket dice 45 y son 46** (`git grep -il`). Y no se han clasificado: `docs/` (265 ficheros,
1.429 apariciones) ni `prisma/` (2 ficheros, 2 apariciones; una leída, `schema.prisma:915`, comentario).

## 3 · Los 46 de `src/`, clasificados LEYENDO

### 3.0 · Cuatro NO son de este ticket: es el justificante de un GASTO

`expenses/domain/justificante.ts`, `expenses/domain/lecturaTicket.ts`,
`expenses/app/routes/expenses.routes.ts`, `expenses/domain/expenses.service.ts`. Hablan del ticket o
factura **que recibe** el profesional (¿deduce IVA?). Vivo, y sin relación con el documento de cobro.
**Quedan 42.**

### 3.1 · ⓐ Texto que vería alguien — 19 cadenas leídas, 14 son texto

**Dos se pintan SIEMPRE, sin mirar ninguna fila. Son las únicas con víctima hoy:**

| dónde | texto | quién lo ve |
|---|---|---|
| `exports/domain/exportData.ts:615` | «facturas/  N de M PDF de factura/justificante» | el LÉEME del export de datos, en todo export |
| `system/app/routes/invoicesAdmin.routes.ts:435` | «PDF del presupuesto firmado y del justificante: disponibles desde el panel…» | la hoja de evidencia de una disputa, en toda hoja |

**Doce sólo salen si la fila leída es un justificante YA guardado** (por `type === 'JUST'` o por el
número). No se alcanzan con un documento nuevo; sí con uno viejo:

| dónde | texto | condición |
|---|---|---|
| `invoicing/infra/pdf/pdf.service.ts:401` | «JUSTIFICANTE DE COBRO» (título del PDF) | `params.type === 'JUST'` (`:318`) |
| `invoicing/infra/pdf/pdf.service.ts:712` | «Justificante de cobro — este documento acredita el cobro recibido.» | la misma |
| `billing/app/routes/receipt.routes.ts:106` | «justificante» (página pública `/recibo`) | tipo `JUST` o número `J-` (`:105`) |
| `messaging/domain/email.service.ts:91` | «justificante de cobro» (asunto y cuerpo del correo) | `inv.number.startsWith('J-')` (`:39`) |
| `billing/domain/invoiceWhatsApp.service.ts:76` y `:102` | «Justificante» / «justificante» | `isReceiptNumber` |
| `billing/domain/invoiceReminder.service.ts:141` | «justificante» (recordatorio) | `isReceiptNumber` |
| `system/app/routes/invoicesAdmin.routes.ts:790` | «…el pago del justificante…» (recordatorio manual) | `isReceiptNumber` |
| `system/app/routes/invoicesAdmin.routes.ts:908` | «Este documento es un justificante, no una factura fiscal…» | al anular un `J-` pendiente |
| `billing/app/routes/payInvoice.routes.ts:48` | «Justificante NNN» | `isReceiptNumber` |
| `billing/app/routes/psp.routes.ts:319` y `mpWebhook.routes.ts:216` | «Justificante NNN» (campo `detail`) | `isReceiptNumber` |

Y una condicional a un recuento: `fiscal/evidencias/paquete.ts:190`, «Si emitiste justificantes de
cobro, no aparecen aquí…», sólo cuando el libro dejó fuera alguno (`:267`).

⚠️ **No leído:** a qué pantalla llega el campo `detail` de `psp` y `mpWebhook`, ni el cuerpo entero
de cada mensaje. La condición sí.

### 3.2 · ⓑ Ramas inalcanzables con CUALQUIER dato — 11 sitios

No dependen de lo que haya en la base: el número que comprueban acaba de salir de
`allocateInvoiceNumber`, que en modo `receipt` lanza (`invoiceNumber.service.ts:448`) y si no devuelve
`formatInvoiceNumber` (`:161-178`: empieza por la serie `F` o por el año, nunca por `J-`).

- **Seis escritores del tipo**, `type: isReceiptNumber(n) ? 'JUST' : …`: `lib/invoicing.ts:432`,
  `invoicing/domain/invoicing.service.ts:115`, `jobs/app/routes/jobs.routes.ts:1543`,
  `quotes/app/routes/quotes.routes.ts:641`, `system/app/routes/quotesAdmin.routes.ts:355` y `:648`.
- **El parámetro `esJustificante`** de `auditar` (`invoiceNumber.service.ts:414-431`): su única
  llamada le pasa `false` (`:491`).
- **Cuatro cinturones** que rechazan un `J-` recién reservado: `jobs/app/routes/albaranes.routes.ts:1321`
  y `:1603`, `jobs/domain/recapitulativa.service.ts:118`, `system/app/routes/invoicesAdmin.routes.ts:197`.

⚠️ **No leído, sitio por sitio:** que en los seis escritores la variable venga de
`allocateInvoiceNumber`. Los seis ficheros lo importan; `scrum1027` lo afirma del emisor.
🔴 **Y uno está sujeto a propósito:** `tests/scrum1027…:188` exige que el escritor del emisor siga.

### 3.3 · ⓒ Tipos y constantes — 6

| dónde | qué | estado |
|---|---|---|
| `invoicing/domain/facturaSuelta.ts:83` | `ModoDocumentoSuelto` ofrece `'justificante'` | **muerto**: la función (`:85-89`) sólo devuelve `'no'` o `'factura'` |
| `invoicing/domain/invoiceNumber.service.ts:86` | `RECEIPT_NUMBER_PREFIX = 'J-'` | **vivo como lector**; nadie lo escribe |
| `invoicing/domain/tipoDocumento.ts:52` | `TipoDocumento = 'F1' \| 'R1' \| 'JUST'` | vivo: clasifica filas guardadas como «no declarable» |
| `messaging/domain/registroDeEnvios.ts:91` | `CLASES_DE_CORREO.justificante` | dato histórico: lo lee `cobros.service.ts:152` |
| `invoicing/domain/libroRegistro.ts:128` | campo `justificantesFuera` | vivo: recuento del filtro |
| `invoicing/domain/emission.service.ts:10` | modo `'receipt'` | **vivo: es la puerta de la regla 24** |

**El ticket dice que `RECEIPT_NUMBER_PREFIX` tiene «su definición y un lector». Es literal, y engaña:**
ese lector es `isReceiptNumber`, con **43 usos en código en 19 ficheros**; hay además tres `'J-'`
escritos a mano (`core/validation/fiscalInput.ts:165`, `email.service.ts:39` y la propia constante) y
un `/^J-/` en `system/invoiceAdmin.ts:261`. **Cinco ficheros llevan el concepto sin la palabra** y no
están entre los 46: `invoicing/domain/portonDocumento.ts`, `quotes/app/routes/quotes.routes.ts`,
`system/quoteAdmin.ts`, `messaging/domain/weeklyDigest.service.ts`,
`system/app/routes/quoteDecisionLanding.routes.ts`.

### 3.4 · Lectores sobre filas guardadas — vivos mientras haya una

`receipt.routes.ts:105` · `pdf.service.ts:318` · `email.service.ts:39` ·
`invoicing/domain/verifactu.service.ts:252` y `:469` (un `J-` no se sella) ·
`invoicing/domain/selladoEstado.ts:75` · `invoicing/domain/portonDocumento.ts:84` ·
`invoicing/domain/libroRegistro.repo.ts:96` (fuera del libro de expedidas) ·
`system/invoiceAdmin.ts:44` (fuera del listado de facturas) y `:261` ·
`system/app/routes/invoicesAdmin.routes.ts:905` (no se anula) y `:1070` (no se rectifica) ·
`core/validation/fiscalInput.ts:165`.

**Estos son «la razón de que algo funcione hoy»:** quitan el justificante guardado de la cadena
fiscal, del libro y de la lista de facturas, e impiden rectificarlo o anularlo como si fuera factura.

### 3.5 · ⓓ Comentarios — 118 apariciones; 26 ficheros sólo tienen eso

No los he juzgado uno a uno. **Leídos y caducados** (afirman en presente algo que SCRUM-1027 quitó):

- `invoicing/domain/emission.service.ts:4` y `:34` — «'receipt' → justificante de cobro».
- `lib/invoicing.ts:432` — «justificante si ES real sin flag».
- `invoicing/domain/invoicing.service.ts:7-8` — «`allocateInvoiceNumber` decide la serie… marca el tipo JUST».
- `exports/app/routes/exports.routes.ts:527` — «los merchants ES reales emiten justificantes (J-)».
- `messaging/domain/lifecycle.service.ts:260` — «post-pago es justificante hasta SIF-1».
- `system/app/routes/invoicesAdmin.routes.ts:132-133` y `:195` — «el profesional español real sí puede
  crear su documento suelto, solo que es un justificante».
- `system/invoiceAdmin.ts:25` — cita por posición una línea que «escribe `'JUST'`» y ya no está ahí.

**Leídos y correctos** (cuentan la retirada o describen el lector): `facturaSuelta.ts:30-47` y `:66-82`,
`invoiceNumber.service.ts:75-78` y `:438-447`, `albaranes.routes.ts:1379` y `:1468-1479`.

### 3.6 · ⓔ Tests que fijan el comportamiento — sí hay, y lo mantienen a propósito

82 ficheros de `tests/` llevan el vocabulario en código. **Abiertos por sus aserciones, doce:**

| test | qué sujeta |
|---|---|
| `scrum1027-atajo-flag-off-sin-documento` `:188`, `:211`, `:214` | el escritor del emisor, el reconocedor y el prefijo **tienen que seguir** |
| `scrum442-facturas-sin-justificantes` `:35` | el filtro `type: { not: 'JUST' }` del listado |
| `scrum608-tipo-de-documento-en-la-cabecera` `:159` | el PDF de un `JUST` abre con «JUSTIFICANTE DE COBRO» |
| `pdfs` `:54` | el PDF de la serie J sale sin QR y con su copy |
| `scrum1436b-el-recordatorio-nombra-por-el-numero` `:75` | a un `J-` el recordatorio lo llama «justificante» (cita el comentario 18287) |
| `scrum844d-quien-entra-en-la-cadena` `:88` | un justificante no entra en la cadena fiscal |
| `scrum1232-libro-sin-justificantes`, `scrum1252-…`, `scrum413-…` | fuera del libro; el 303 sí cuenta su IVA; tipo no declarable |
| `scrum346-justificante-suelto`, `scrum396-referencia-justificante` | ya vueltos del revés: fijan que NO se emite |
| `scrum825-rama-justificante-retirada` | el panel ya no tiene la rama |

**Los otros 70 no los he abierto.** `scrum1436b` es de la semana pasada: se firmó un texto con la
palabra «justificante» días antes de la frase del fundador que abre este ticket. El comentario 18287
no lo he leído.

## 4 · Propuesta — se escribe, no se ejecuta

**Paso 0 · contar.** La consulta de §1, por el fundador, en las tres bases. Todo lo demás depende de
si da cero.

**Lo que NO depende del recuento:**

1. **Los dos textos que se pintan siempre** (§3.1): `exportData.ts:615` y `invoicesAdmin.routes.ts:435`.
   Son los únicos con víctima hoy. Cambiar el literal es regla 39: literal exacto y firma.
2. **El valor `'justificante'` de `ModoDocumentoSuelto`** (§3.3): es lo que le ofreció a J6 un estado
   que no existe. Carril de J1.
3. **Los comentarios caducados** de §3.5. Carriles de J1, J2 y J3.
4. **Las once ramas inalcanzables** de §3.2. Son camino de emisión: STOP y GO (reglas 38 y 40), y
   `scrum1027:188` cambia en el mismo PR, con la decisión citada (regla 41).

**Lo que SÍ depende:**

- **Si el recuento da cero en las tres bases:** los lectores de §3.4 y los doce textos condicionados
  no protegen nada, y D1 de SCRUM-825 se puede ejecutar entera, con los tests de §3.6 cambiando en el
  mismo PR que la decisión.
- **Si queda alguna fila:** la regla 29 impide tocarla. Entonces «sólo habrá facturas» vale hacia
  adelante, y hay que decidir qué ve quien abre un justificante viejo. **Ésa es la pregunta al
  fundador, y es de producto, no de código.**

**Y este ticket debería enlazarse con SCRUM-825**, no decidirse aparte: las seis sub-preguntas de su
D1 siguen abiertas y son éstas.

## 5 · Lo que salió mal aquí

La primera pasada del instrumento dio **33 apariciones «otro»** en `src/`: los bloques `/** */` son
nodos del AST y no trivia, así que no caían en comentario. Lo delató una línea de documentación que
salió bajo «usos en código». Arreglado, y **la siembra lleva ahora un bloque de ésos**: sin el arreglo
da `CIEGO`. Por eso la línea A9 de arriba apunta al instrumento.

## 6 · Lo que NO se ha hecho

- Ninguna base consultada. El número de justificantes guardados **no lo sé**.
- `public/` (19 ficheros), `scripts/` (14) y `docs/` (265): contados, no clasificados.
- 70 de los 82 tests con el vocabulario en código: sin abrir.
- Los comentarios 17446 (SCRUM-825) y 18287: citados por lo que dice el repositorio, sin abrir en Jira.
- Ninguna tanda completa. Sólo los comprobadores de registro, tras escribir esto.

# SCRUM-1523b · El PDF que dice «JUSTIFICANTE DE COBRO»: sale sólo de una fila guardada, y qué lee el usuario

**Medido contra:** `origin/main` = `9358f02b14e9648f1ab65fbdacf6464d50728242` · 2026-10-13T10:28:39Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1523b/camino-del-pdf.mjs`

13-oct-2026 · sesión `jv-j1f` (carril J1, facturas y PDF; equipo de Javier), por encargo del orquestador
(`cobroflash-backend-2e`). [Escrito por una sesión. No es firma del fundador ni del orquestador.]
El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); seguí, como manda la ficha del 13-oct.

**Es MEDICIÓN.** No se ha tocado `src/`, `public/`, `tests/`, `scripts/` ni `prisma/`. Ninguna base.
Ningún ticket transicionado. Lo nuevo es este tramo y `docs/master/evidencias/SCRUM-1523b/`.

## b0 · Lo que ya estaba hecho, reproducido — y lo que el encargo daba por cierto y no lo es

El tramo de arriba (J4, PR #2342) ya contestaba medio encargo. **Reproducido hoy** con su mismo
instrumento sobre `9358f02b1`: `src` da 46 ficheros y 162 apariciones (118 comentario / 19 cadena /
25 identificador), y `public` 19 ficheros y 102: **idéntico** salvo los caracteres leídos. `scripts`
baja de 14 a 13 ficheros porque `scripts/e2e-critico.mjs` ya no existe.

**El encargo decía «un documento que un cliente final puede tener en la mano con un nombre que el
producto ya no emite». Medido, es otra cosa:** el producto no puede fabricar hoy un documento NUEVO
con ese título; lo que hace es volver a pintar, con el código de hoy, un justificante que se emitió
antes de SCRUM-1027. El título no es un resto que se cuela en facturas: es el nombre con el que ese
papel se entregó. Y son 46 ficheros, no 45, de los que 4 son del justificante de un GASTO (§3.0).

## b1 · El PDF: qué camino lo genera y cuándo sale el título — EJECUTADO

El título es un literal local de `generateInvoicePdf` (`pdf.service.ts:401`), gobernado por
`params.type === 'JUST'` (`:318`). Tiene **tres llamadas** en todo `src/`, y las tres le pasan el
`type` **de la fila guardada**, nunca uno calculado: `lib/invoicing.ts:123` (`ensureInvoicePdf`),
`lib/invoicing.ts:285` (`ensureInvoiceForCharge`) y `invoicesAdmin.routes.ts:1219` (`regenerate-pdf`).

`docs/master/evidencias/SCRUM-1523b/camino-del-pdf.mjs` llama a `ensureInvoicePdf` de `dist/` con un
Prisma de mentira que devuelve UNA fila fabricada, comercio español con NIF y el flag sin encender, y
lee la primera línea del PDF que sale (5 casos ejecutados, 5 leyeron su fila):

| fila guardada | ¿sale PDF? | primera línea |
|---|---|---|
| A · `JUST` + número `J-` + `no_aplica` (**la siembra**) | sí | «JUSTIFICANTE DE COBRO» |
| B · `F1` sellada, con huella | sí | «FACTURA» |
| C · `JUST` + `J-` + `pendiente_de_sellado` (el valor por defecto del esquema) | **no**: `invoice_pendiente_de_sellado` | — |
| D · `F1` con número `J-` + `no_aplica` | sí | **«FACTURA»**, con «Escanea el QR para validar la factura.» y sin huella |
| E · `JUST` con número de factura, sin huella | **no**: `invoice_sin_sellar` | — |

Controles: positivo SEMBRADO (la fila A) `VISTO`; quitado (`--sin-siembra`) dice `CIEGO` y sale 2; cero
derivado (el título del revés) 0 apariciones en los 3 PDF que salen.

**Cuándo sale, entonces:** sólo con una fila ya guardada que tenga a la vez tipo `JUST`, número `J-` y
`vfEstado = no_aplica`. Ningún escritor de hoy produce esa fila (§3.2). Y sale **cada vez que el fichero
falta del disco**, no una vez: `ensureInvoicePdf` regenera si no existe (`:79`), y
`tests/scrum608…:17-21` tiene medido que el disco de producción es efímero.

🔴 **De paso, la fila D.** Si existe una fila `F1` con número `J-` (`tests/scrum413…:23` dice que en
producción había 5; la memoria de esta máquina dice que el 1-oct el fundador contó cero), su PDF abre
diciendo «FACTURA», con un QR que no verifica nada y sin sello: el portón la deja pasar por el número y
el título la llama factura por el tipo. **No sé si existe alguna**: es el mismo recuento de §1.

## b2 · ¿Se puede llegar desde una pantalla? — LEÍDO, no pulsado en un navegador

Sí, si la fila existe; y no por la lista de Facturas, que la esconde en los dos lados
(`invoiceAdmin.ts:44`, `invoicesView.js:81`). Las puertas, leídas:

- **El profesional**, a la ficha del documento (`invoice-detail`) desde: Cobros (`cobrosView.js:617-628`),
  la ficha del cliente (`customerDetailView.js:593`), el buscador (`globalSearch.js:243`), el bloque
  DINERO del Trabajo (`jobRailBlocks.js:157` → `jobDetailView.js:89`) y «🧾 Ver justificante» en el
  presupuesto (`quotesDetailView.js:326`). Allí, «Descargar PDF» abre `GET /admin/invoices/:id/pdf`
  (`invoiceDetailView.js:360` → `invoicesAdmin.routes.ts:1281`).
- **El cliente final**, sin sesión: `GET /recibo/:token/pdf` (`receipt.routes.ts:498`), con el enlace
  que recibió en su día.
- **Sin pantalla:** el correo que adjunta el PDF (`email.service.ts:76`) y el ZIP del export
  (`exports.routes.ts:201`).

**«Existe en el código» sí; «se puede llegar» depende de un dato que nadie ha medido:** cuántas filas
`JUST` hay y con qué `vfEstado`. Con cero filas, ninguna puerta lleva al título. Con el estado por
defecto, la puerta existe y devuelve error (caso C).

## b3 · Qué LEE alguien y qué no — la separación

`src/` sin los 4 de gastos: 42 ficheros, 137 apariciones. `public/`: 19 ficheros, 102.

| | lo lee alguien | no lo lee nadie |
|---|---|---|
| `src/` | **15 cadenas** | 122: 107 en comentario, 13 identificadores, 2 valores |
| `public/` | **7 cadenas** | 95: 83 en comentario, 9 identificadores, 3 valores |

**Las 22 que se leen, por urgencia:**

1. **Se pintan SIEMPRE, haya o no justificantes — 2.** Las de §3.1: el LÉEME del export
   (`exportData.ts:615`) y la hoja de evidencia de una disputa (`invoicesAdmin.routes.ts:435`).
   Son las únicas con víctima sin condición.
2. **Sólo ante una fila guardada — 19.** Las 12 de §3.1 en servidor (PDF ×2, `/recibo`, correo,
   WhatsApp ×2, recordatorio ×2, anulación, página de pago, `detail` ×2) y **las 7 de `public/`, que
   el tramo de arriba no clasificó**: «Justificante de cobro», «Detalle y acciones del justificante.»
   y la insignia «JUSTIFICANTE» (`invoiceDetailView.js:93`, `:94`, `:138`); el `title` del botón de la
   reclamación (`:537`); el rótulo «Justificante» de la pila del Trabajo (`jobDetailView.js:24`);
   «🧾 Ver justificante» (`quotesDetailView.js:326`); y «No se pudo enviar el justificante al cliente
   por email.» (`cobrosView.js:73`).
3. **Sólo ante un recuento — 1.** `paquete.ts:190`.

**Tres de las 19 llevan firma escrita en el propio código:** `quotesDetailView.js:326` e
`invoiceDetailView.js:537` citan SCRUM-1257 comentario 17444 («un `J-` antiguo conserva su rótulo»), y
`cobrosView.js:73` cita SCRUM-1235 comentario 17384. Las dos son firmas del orquestador por delegación,
del 28-sep, **anteriores** a la frase del fundador que abre este ticket. No las he abierto en Jira.

Fuera de JavaScript, `public/` tiene una sola aparición, en un comentario (`dashboard/index.html:299`):
ni la landing ni las páginas legales lo nombran.

## b4 · Los que no ve el usuario: ¿alguno MIENTE?

Criterio, y su límite: juzgado por la línea y como mucho la vecina, no por el bloque entero.
«Miente» = afirma en presente que hoy se emite o se recibe un justificante.

**`src/`, 11 sitios.** Los 8 de §3.5, más tres: `billing/app/routes/receipt.routes.ts:103` («el
documento es FACTURA (post-SIF) o JUSTIFICANTE (pre-SIF)»), `invoiceNumber.service.ts:326-327` («se
audita también el justificante», de un parámetro que sólo recibe `false`) y
`invoicing/domain/modoVisible.ts:8-9` y `:42` («qué documento sale —factura, factura con marca de agua
o justificante—»).

**`public/`, 4 sin corrección al lado:** `app.js:394-396` («con el flag en su valor por defecto emite
JUSTIFICANTES»), `settingsView.js:1305-1306` («el documento es un justificante de cobro»),
`jobsCierreTrabajo.js:58` («recibe un JUSTIFICANTE, no una factura») e `invoiceDetailView.js:90`.
Otros dos bloques dicen lo mismo **y llevan debajo su corrección fechada**, así que no engañan a quien
lee hasta el final: `app.js:45-46` (corregido en `:55`) y `rotulosDelDocumento.js:7-46` (en `:49`).

**Un nombre que miente sin afirmar nada: «modo justificante».** Es como se llama al modo `receipt`,
en el que hoy no sale ningún documento. Lo lleva una función viva, `enModoJustificante()`
(`jobDetailView.js:140`, 6 usos), y al menos 17 comentarios: en `src/`, `albaranes.routes.ts:1263` y
`:1463`, `jobs.routes.ts:1637` y `:1650` y `whatsappTemplates.ts:202`; en `public/`, 12 líneas de
`albaranAccion.js`, `jobNextAction.js`, `jobsView.js`, `quotesDetailView.js`, `quotesView.js` y
`cuerpoDelDocumentoSuelto.js`. La función hace lo correcto (calla textos en `receipt`); el nombre
describe un modo que ya no existe. Es la misma invitación que el valor muerto de §3.3.

**Y un test:** el mensaje de `tests/scrum608…:159` dice que el justificante «es el documento del flag
apagado». La aserción es buena (fija el PDF de lo guardado); el porqué dejó de ser verdad.

## b5 · Qué haría falta para cambiarlo — propuesta, NO ejecutada

**Recomiendo no cambiar el título del PDF.** Tres motivos medidos: sólo lo lleva un papel que se
entregó con ese nombre; el disco efímero haría que el mismo documento saliera mañana con otro nombre
que la copia que el cliente ya guardó; y la firma 17444 ya decidió para dos textos hermanos que un `J-`
antiguo conserva su rótulo. Si el fundador decide eso mismo para el PDF, no hay literal que firmar.

**Si decide que la palabra desaparezca también de lo guardado**, hace falta, en un solo PR:
- GO de emisión (regla 40): `pdf.service.ts:401` y `:712` están en el camino de emisión.
- Firma de los literales (regla 39). Propuesta, sin escribir en el código: título **«RECIBO DE COBRO»**
  y pie **«Recibo de cobro — este documento acredita el cobro recibido.»** No puede ser «FACTURA»:
  sería un claim fiscal sobre un documento sin sello (reglas 7 y 17).
- Los otros 18 textos condicionados, con la misma palabra, o el mismo cobro se llamará de dos maneras
  entre el PDF, el correo, el WhatsApp y el panel. Tres de ellos tienen firma previa que habría que
  revocar citándola.
- `tests/scrum608…:159`, `tests/pdfs…:54` y `tests/scrum1436b…:75` cambian en el mismo PR, con la
  decisión citada (regla 41).

**Lo que sí propongo cambiar, y no depende de ningún recuento — los 2 que se pintan siempre:**
- `exportData.ts:615` → **«facturas/  N de M PDF de factura»**. ⚠️ Sin medir: si el ZIP incluye los
  PDF de filas `JUST`; si los incluye, el texto de hoy es exacto para quien las tenga.
- `invoicesAdmin.routes.ts:435` → **«PDF del presupuesto firmado y de la factura: disponibles desde el
  panel (se adjuntan a la respuesta de la disputa).»**, y «del justificante» sólo si el documento es
  un `J-` antiguo, que es la regla ya firmada en 17444 para el botón que abre esa hoja.

**Sin firma de texto, carril J1:** el valor `'justificante'` de `ModoDocumentoSuelto` (§3.3) y los
comentarios de b4 que caen en `invoicing/`, `lib/invoicing.ts`, `invoicesAdmin.routes.ts` e
`invoiceAdmin.ts`. Los demás son de J2, J3 y S1/S2: se reportan, no se arreglan desde aquí.

## b6 · Lo que salió mal aquí

La primera pasada del instrumento dio `CIEGO` en sus cinco casos (guardada en
`salida-primera-pasada-ciega.txt`): di por hecho que el lector de PDF de la casa devolvía una cadena y
devuelve un objeto con `ok`. Lo paró la siembra, que es para lo que está: sin ella habría leído tres
«NO SALE» falsos junto a dos verdaderos. Ahora un PDF ilegible se declara y no cuenta como «no sale».

## b7 · Lo que NO se ha hecho

- Ninguna base: no sé si hay filas `JUST`, cuántas, ni con qué `vfEstado`. De eso depende todo b2.
- Ninguna ruta por HTTP ni ninguna pantalla en un navegador: las puertas de b2 están leídas.
- `ensureInvoiceForCharge` y `regenerate-pdf` no se ejecutaron; sí se leyó que pasan `inv.type`.
- Los comentarios de b4 no están juzgados uno a uno con su bloque; el resto de los 83 de `public/`,
  `scripts/` (13 ficheros), `docs/` y 70 tests siguen sin clasificar.
- Por concepto y no por palabra: «recibo» sale en 88 líneas de `src/` y `public/` y «comprobante» en 1.
  Contadas, sin clasificar: no sé cuántas son texto que alguien lee.
- Los comentarios 17444, 17384, 17446 y 18287: citados por lo que dice el repositorio, sin abrir.
- Ninguna tanda completa. Sólo los comprobadores de registro, tras escribir esto.

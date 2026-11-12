# SCRUM-1547 · El censo de datos personales sólo ve los nombres que conoce: medición y propuesta

**Medido contra:** `origin/main` = `d8c441b9402cb21ea892afdf72f07b006294ba88` · 2026-11-12T11:00:42Z (hora de GitHub; la medición se hizo sobre `4eea7720b`, y entre los dos no cambia ninguno de los cuatro ficheros medidos)
A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: el trinquete es una PROPUESTA y este tramo no lo construye; hasta que entre, una columna personal con un nombre nuevo sigue saliendo verde

Puesto J6 (`jv-j6dz`) · rama `scrum-1547-datos-personales-por-esquema`. Encargo del orquestador (`cobroflash-backend-a0`):
**medir y proponer, no construir.** Sólo docs. Nada de `prisma/schema.prisma` ni de `anonimizarMerchant.ts` se ha tocado:
se han LEÍDO.

## PASO 0 · ¿está ya arreglado?

**En parte.** SCRUM-1569 (20 y 21-oct, `55265d9f2`, `7e1298833`, `af4900719`) ensanchó el censo de `tests/_censo-datos-personales.mjs`
de NOMBRE EXACTO a **núcleo**: la última palabra en camelCase (`contactName` → «name», `billingCity` → «city»). Es la
opción (a) del ticket, y sólo para doce núcleos en inglés. **La opción (b) —clasificar TODA columna— no la ha hecho nadie**
(`git log -S` de `NO_PERSONALES`/`noPersonal`: 0 commits; ninguna rama ni PR con 1547).

**El defecto sigue hoy, medido con siembra:** cuatro columnas fabricadas EN MEMORIA dentro de `model Customer`, pasadas por
la función de la casa (`camposPersonalesDelSchema`), sin tocar el fichero:

| columna sembrada | ¿la ve el censo? |
|---|---|
| `recipientMsisdn String?` (un teléfono) | 🔴 no |
| `dni String?` | 🔴 no |
| `contactoNombre String?` | 🔴 no |
| `signerFullName String?` | 🟢 sí (núcleo «name») |

Con la siembra, el censo pasa de 66 a 67: ve una de cuatro.

## La población

`prisma/schema.prisma` (105.417 B): **33 modelos** (25 con `merchantId`) y **224 columnas `String`/`String?`**.
Contraste del lector: `grep` da también 33 y 224.

**Alcance: los 33 modelos, no sólo los de `merchantId`.** Medido por qué: `Merchant` no lleva `merchantId` (21 columnas sin ver)
y `VfFlujoObligado.obligadoNif` es el NIF del profesional en un modelo sin `merchantId`. Filtrar por inquilino dejaría fuera justo esos.

| cubo | columnas |
|---|---:|
| ya las ve el censo (vocabulario o núcleo) | **66** — 21 en `CAMPOS_PERSONALES`, 42 en `SIN_DECIDIR`, 3 en `FUERA_DE_ANONIMIZADO` |
| 🔴 personales y FUERA del censo | **21** |
| 🟡 dudosas (las decide el fundador) | **23** |
| no personales | **114** |
| **suma** | **224** = total |

## El criterio, y su control

**El criterio no es mío: es el de la casa**, escrito en `tests/_censo-datos-personales.mjs:39-41`: una columna es personal si
«identifica o localiza a una persona», y el texto libre «escrito por una persona sobre otra» también. Añado sólo lo que el
RGPD ya dice: una IP y un `userAgent` son identificadores en línea (cdo. 30), y una firma manuscrita es de quien firma.
**Dudosa** = puede llevar un dato personal según cómo se use (texto libre del profesional, referencias de pago, URL de un PDF
con datos del cliente, XML fiscal). **La clasificación es MANUAL, columna a columna**; ningún patrón la decide.

**Control positivo:** las cuatro sembradas salen personales con este criterio, y tres de ellas el censo no las ve. Y una del árbol
que lo es por definición: `albaran.firmadoPorNombre` («el nombre de quien firma») sale personal y el censo no la ve.
**Control del barrido de coste** (abajo): sale `toPhone`, que SCRUM-529 añadió el 14-oct.
**No medido:** si otra persona clasificaría igual las 23 dudosas; nadie ha repetido la clasificación.

### 🔴 Las 21 personales que el censo no ve

| columna | por qué es personal |
|---|---|
| `albaran.firmadoPorNombre` · `parteTrabajo.firmadoPorNombre` · `parteTrabajo.firmadoTecnicoNombre` | nombre de quien firma (cliente o técnico) |
| `albaran.signatureUrl` · `parteTrabajo.signatureUrl` · `parteTrabajo.signatureTecnicoUrl` · `quote.signatureUrl` | firma manuscrita |
| `albaran.lugarEntrega` · `parteTrabajo.obra` | un domicilio |
| `albaran.notas` · `parteTrabajo.notas` | «notes» en español: el vocabulario sólo lo lee en inglés |
| `quote.decisionComment` · `quote.rejectionReason` · `invoice.clientComment` | texto libre que escribe el cliente |
| `quoteRequest.description` · `quoteRequest.zone` | lo que cuenta y dónde está quien pide presupuesto |
| `legalAcceptance.ip` · `legalAcceptance.userAgent` · `auditLog.ip` | identificadores en línea |
| `vfSubmission.obligadoNif` · `vfFlujoObligado.obligadoNif` | el NIF del profesional («taxId» con otro nombre); camino fiscal, 17.3.b |

🔵 **El patrón que las explica casi todas:** el vocabulario está en inglés salvo `direccion`, y los modelos más nuevos
(`Albaran`, `ParteTrabajo`) nombran en español: `notas`, `firmadoPorNombre`, `obra`. **Un núcleo más no lo arregla**: el
siguiente modelo traerá otra palabra.

### 🟡 Las 23 dudosas

`merchant.slug` (suele salir del nombre del negocio) · `merchant.googleReviewUrl` · `merchant.stripeCustomerId` (seudónimo en un
tercero) · `customer.internalRef` · `charge.concept` · `charge.reference` y `reconciliation.bankRef` (en una transferencia llevan
el nombre del ordenante) · `quote.docHeaderText` · `quote.docFooterText` · `albaran.docHeaderText` · `quote.pdfUrl` ·
`invoice.pdfUrl` · `albaran.pdfUrl` (el PDF lleva los datos del cliente) · `invoice.qrData` (el QR VeriFactu lleva el NIF del
emisor) · `vfSubmission.registroXml` (NIF y nombre de emisor y destinatario) · `expense.concept` · `expense.receiptData` (la lectura
del ticket) · `customerEvent.title` · `customerEvent.detail` · `job.titulo` · `maintenancePlan.title` · `attachment.url` (fotos de
obra, documentos) · `parteTrabajo.referencia`.

Cuatro de ellas (`invoice.qrData`, `vfSubmission.registroXml`, y los dos `pdfUrl` de documento sellable) caen en la pregunta que
ya espera al asesor fiscal (SCRUM-1264): la misma de `EN_DOCUMENTO_SELLABLE` en `scrum497`.

### Las 114 no personales, por modelo

Estados, tipos y modos (`status`, `type`, `kind`, `estado`…), monedas, identificadores técnicos y de pasarela (`stripeAccountId`,
`waMessageId`, `providerId` —éste ya lo razona `anonimizarMerchant.ts`—), tokens, huellas (`vfHash`…), números de documento,
URLs del propio sistema y configuración. Por modelo (salida del script, no a mano): merchant 18 · invoice 14 · quote 10 ·
parteTrabajo 7 · product 6 · albaran 6 · charge 5 · whatsAppMessage 5 · emailMessage 5 · vfSubmission 5 · customer 4 ·
gatewayEvent 4 · expense 3 · job 3 · attachment 3 · authSession 2 · quoteRequest 2 · quoteTemplate 2 · teamMember 2 ·
legalAcceptance 2 · auditLog 2 · event 1 · botSession 1 (`state`, estados cerrados de K1) · customerEvent 1 · vfFlujoObligado 1.
**Suma 114.** ⚠️ Error propio: la primera versión de este desglose la escribí a mano y decía quote 11 y albaran 8 (sumaba 117,
no 114). Lo cazó volver a sacarlo con el script; la cifra que vale es ésta.

## La propuesta: un trinquete de clasificación TOTAL

Es la opción (b) del ticket. El censo deja de decidir qué mira por el nombre: **mira todas las columnas de texto, y cada una
tiene que estar declarada.**

1. `tests/_censo-datos-personales.mjs` gana `columnasDeTexto(schemaText)` (las 224, de los 33 modelos) y una tabla declarada
   `NO_PERSONALES = { 'modelo.campo': motivo }`. El vocabulario y los núcleos **se quedan** como lo que son: una ayuda que
   pre-clasifica como personal, no la puerta.
2. `tests/scrum497-dato-personal-no-sobrevive.test.mjs` gana un caso: **toda** columna de texto es personal (vocabulario, núcleo o
   la lista nueva `PERSONALES_DECLARADAS`) **o** está en `NO_PERSONALES` con motivo. Una columna nueva sin declarar → ROJO, con
   el mismo mensaje de tres salidas que ya da hoy el caso de `sinClasificar`.
3. Las personales declaradas entran en el reparto de siempre: o `CAMPOS_PERSONALES` o `SIN_DECIDIR` con su pregunta. **Ninguna
   pasa a anonimizarse en este ticket**: eso es supresión de datos de clientes, STOP (AA1.4), y es del fundador.
4. Visto en rojo primero con SIEMBRA (las cuatro de arriba), nunca con una columna del árbol (SCRUM-1537). Y el caso
   comprueba que, quitando la siembra, el instrumento vuelve a verde y no a ciego.

**Cuántas hay que clasificar hoy: 158** (224 − 66). De ellas, 114 van a `NO_PERSONALES`; para no escribir 114 frases, el motivo
puede ser una constante por familia (como `EN_DOCUMENTO_SELLABLE`), pero **la clave va columna a columna**: un patrón por
nombre en el lado «no personal» abre el mismo agujero por el otro lado. Las 21 personales y las 23 dudosas van a `SIN_DECIDIR`:
el trinquete de `scrum497` subiría de **42 a 86**, y ése es su número real.

**El coste que el ticket pide decir:** cada columna `String` nueva pone en rojo `scrum497` hasta que alguien la declara. Medido en
`origin/main` del 12-oct al 12-nov: **8 commits** tocaron el esquema y **7 líneas** `String` nacieron (5 se quitaron):
`category type status kind relatedType activityKind toPhone`. Es una línea de declaración al mes, y la única personal (`toPhone`)
es justo la que el ticket echó en falta.

### De quién es cada fichero (`node scripts/carriles.mjs de`, 12-nov)

| fichero | carril |
|---|---|
| `tests/_censo-datos-personales.mjs` | sin fila en §3: nadie lo reclama |
| `tests/scrum497-dato-personal-no-sobrevive.test.mjs` | «el test de un ticket» → el puesto que trabaja el ticket (`dos-equipos.md:171`) |
| `src/modules/system/domain/anonimizarMerchant.ts` | **J3** (`dos-equipos.md:128`) — no lo toca esta propuesta |
| `docs/master/SCRUM-1547.md` | quien trabaja el ticket |

## Fuera de esta medición, dicho

- **Las 30 columnas `Json`** no las mira el censo (filtra `String` a propósito, por los falsos positivos de su cabecera). Al menos
  `parteTrabajo.tecnicos` es, según su propio comentario del esquema, un «array de nombres». Candidatas a mirar: `botSession.data`,
  `quote.evidenciaFirma`, `albaran.evidenciaFirma`, `event.payload`, `auditLog.meta`, `customerEvent.meta`. **No clasificadas.**
  El trinquete propuesto puede crecer a ellas en un segundo paso; meterlas en éste mezcla dos decisiones.
- El cabo ④ del ticket (el paquete de disputa de `invoicesAdmin.routes.ts` lee la fila sin `select`): **no lo he mirado.**
- Suite entera local: NO CORRIDA (sólo docs). Las dos sondas de esta medición viven en el temporal del trabajo y no se suben:
  son lectura, y el trinquete propuesto es lo que las sustituye.

# SCRUM-1547 · 1547b — el trinquete de clasificación TOTAL, construido

**Medido contra:** `origin/main` = `0a843ce7e39555effe203549cb1c60c37472eabf` · 2026-11-12T11:13:49Z (hora de GitHub; la rama se puso al día con `git merge origin/main`, y entre `d8c441b94` y éste no cambia ninguno de los cinco ficheros de este tramo)
A9: comprobación → `tests/scrum497-dato-personal-no-sobrevive.test.mjs`

Puesto J6 (`jv-j6ea`) · rama `scrum-1547b-trinquete-clasificacion`. Encargo del orquestador (`cobroflash-backend-a0`), sobre las
decisiones del fundador de c.21607: (b), los 33 modelos, las 44 a `SIN_DECIDIR` y el trinquete de 42 a 86. **No se anonimiza
nada:** `anonimizarMerchant.ts` (J3) no se ha tocado, y `prisma/schema.prisma` sólo se ha leído (regla 40).

## Qué hay

| pieza | dónde |
|---|---|
| `columnasDeTexto(schema)`: las columnas `String`/`String?` de todos los modelos, sin filtrar por nombre. Es ahora el ÚNICO lector del esquema del censo: `camposPersonalesDelSchema` filtra sobre ella | `tests/_censo-datos-personales.mjs` |
| `NO_PERSONALES`: 114 claves, **columna a columna**, con el motivo por familia (estado, moneda, secreto, id externo, huella…) | el mismo |
| `clasificarTodas(…)`: personal o no personal; y tres listas que tienen que salir vacías: `sinDeclarar`, `enLasDos` y `fantasmas` (declaraciones de columnas que el esquema ya no tiene) | el mismo |
| las 44 en `SIN_DECIDIR`, cada una con su pregunta; trinquete **86** | `tests/scrum497-dato-personal-no-sobrevive.test.mjs` |
| tres casos nuevos: SIEMBRA, AUTOPRUEBA de `columnasDeTexto`, y «toda columna de texto está DECLARADA» | el mismo |

**Población, medida con el propio instrumento:** 224 columnas de texto en 33 modelos = 110 personales (66 por nombre + 44
declaradas) + 114 no personales. `sinDeclarar`, `enLasDos` y `fantasmas` salen vacíos. El caso tiene un suelo de 200: un esquema
que no se lee da «0 sin declarar» igual que uno limpio.

## 🔵 Un cambio sobre la propuesta de c.21601, dicho

La propuesta pedía una lista `PERSONALES_DECLARADAS` aparte. **No la he hecho:** las 44 tenían que estar ya en `SIN_DECIDIR` con su
pregunta, y una segunda lista con las mismas 44 claves son dos anclas para la misma comprobación (A10). Aquí, **estar en un cubo
del reparto** (`CAMPOS_PERSONALES`, `FUERA_DE_ANONIMIZADO` o `SIN_DECIDIR`) **es** declararla personal. Para eso `repartir` cuenta
también las declaradas en un cubo, y no sólo las que ve por nombre; si no, `albaran.notas` estaría en `SIN_DECIDIR` y no contaría
en el trinquete. Lo prueba la mutación ③ de abajo.

## Rojo primero, con SIEMBRA

Cuatro columnas fabricadas EN MEMORIA dentro de `model Customer` (`recipientMsisdn`, `dni`, `contactoNombre`, `signerFullName`).
Ninguna existe en el esquema, y el caso lo comprueba antes de sembrar (SCRUM-1537: el positivo no se toma prestado del árbol).
- Las tres sin núcleo salen en `sinDeclarar`: rojo. `signerFullName` (núcleo «name») sale como personal y cae por la otra
  puerta, «ninguna columna personal sin clasificar»: las dos no se pisan.
- **Positivo:** declarada en `NO_PERSONALES` o en `SIN_DECIDIR`, la misma columna deja de caer.
- Si no se encuentra `model Customer {` donde sembrar, el caso sale CIEGO con su mensaje, no verde.

## Mutaciones — el catálogo de la casa

Declaradas en `MUTACIONES_QUE_ME_TUMBAN` de scrum497 y pasadas por `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, con
una pasada base sin mutar antes. **4 de 4 VIVAS**; el árbol, restaurado por la propia pieza (`git status` limpio de mutaciones):

| mutación | cae |
|---|---|
| ① quitar `merchant.trade` de `NO_PERSONALES` | «toda columna de texto… DECLARADA» |
| ② `columnasDeTexto` vuelve a filtrar por nombre (el defecto de este ticket) | SIEMBRA (+3 de rebote) |
| ③ `repartir` deja de contar las declaradas en un cubo | TRINQUETE 86 |
| ④ `fantasmas` deja de calcularse | SIEMBRA |

## Corrido, y lo que no

- `scrum497`: 19/19 en verde. Lo dicen los recuentos del TAP, 19 tests y 19 pass, no la salida.
- Los guards de suite y de registro (`scrum237`, `scrum976`, `scrum1387`, `scrum1387d`, `scrum1387f`, `scrum267`, `scrum273`,
  `scrum1294`): el resultado va en el comentario de Jira de este tramo, que se escribe después de correrlos.
- `dist/` compilado con `tsc --noCheck`. No toco `src/`, así que no hacía falta compilar con tipos.
- **Suite entera local: NO CORRIDA** (orden del encargo: hoy hay diez sesiones y la cola de CI está saturada). Hace de tanda el
  check obligatorio.

## Dudas mías, NO decididas y sin cambiar nada

Sigo la clasificación de c.21601. Hay cuatro de las 114 que yo miraría otra vez, porque un texto de error puede citar el número
o el correo al que no se pudo enviar: `whatsAppMessage.error`, `emailMessage.error`, `gatewayEvent.lastError` y
`vfSubmission.lastError`. Siguen en `NO_PERSONALES`: moverlas a `SIN_DECIDIR` sube el trinquete, y eso le toca decidirlo al
fundador. Las 30 columnas `Json` siguen fuera (c.21607: segundo paso).

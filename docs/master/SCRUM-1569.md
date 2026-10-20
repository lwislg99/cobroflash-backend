# SCRUM-1569 · El censo de datos personales no distinguía «fuera a propósito» de «invisible»

**Medido contra:** `origin/main` = `e0c32fb5297e0ea98383d9f983ed8abfa67553c2` · 2026-10-20T09:50:25Z (hora de GitHub al escribir: 2026-10-20T10:07:12Z)
A9: comprobación → `tests/scrum497-dato-personal-no-sobrevive.test.mjs`

Puesto J4 (`jv-j4b`) · árbol `j4b-1569-censo-ciego` · rama `scrum-1569-censo-ciego`. Encargo del orquestador del
equipo de Javier (`cobroflash-backend-09`). Parte de la medición de `jv-j3a` en SCRUM-1569 c.20092, que **no** se ha
repetido salvo para comprobar las cifras.

## Lo que entra en esta rama, y lo que no

| punto | estado |
|---|---|
| ② el censo casa por **núcleo** además de por nombre exacto | hecho: `tests/_censo-datos-personales.mjs` (`NUCLEOS_PERSONALES`, `nucleoDe`) |
| ③ las columnas que ninguna familia lee: recuento y lista | hecho: abajo y en `evidencias/SCRUM-1569/` |
| ① `customerSite.contactName` se anonimiza | **NO HECHO en esta rama** → una línea en `anonimizarMerchant.ts`, carril **J3**. Decidido; la mete J3 en su commit |

### Por qué ① no va aquí

`src/modules/system/domain/anonimizarMerchant.ts` es de **J3** (`node scripts/carriles.mjs de`, `dos-equipos.md:128`).
El orquestador declaró la excepción por mensaje; el literal que dio, para que conste:

> El orquestador del equipo de Javier (`cobroflash-backend-09`) autoriza el **20-oct-2026** a la sesión **J4 `jv-j4b`** a modificar `src/modules/system/domain/anonimizarMerchant.ts`, carril **J3**, **sólo** para añadir la entrada `customerSite` a `CAMPOS_PERSONALES` en SCRUM-1569. Ningún otro cambio en ese fichero. Cruce dentro del equipo de Javier; el reparto de puestos lo hace el orquestador.

La cerradura `.claude/hooks/carril.mjs` la rechazó (salida 2): un cruce se declara en §3.4 de
`docs/equipo/dos-equipos.md`, y ese fichero es de la **S0**, del otro equipo. Un segundo cruce para tapar el primero
no se hace, y escribir el fichero por Bash para que el hook no lo vea es rodear el candado. El orquestador decidió:
② y ③ aquí, ① en un commit de J3, y ha pedido a la S0 una vía para los cruces internos (c.20101).

**La dependencia es un guard, no un mensaje.** `customerSite.contactName` está en `SIN_DECIDIR` con el motivo
«DECIDIDO, falta la línea». El día que J3 meta `customerSite: ['phone', 'contactName']`, la columna pasa a cubierta,
el trinquete baja de 45 a 44 y `scrum497` se pone **ROJO** con el mensaje de qué hacer: quitar esa entrada y poner 44.
Medido abajo (rojo R3).

## El rojo primero: el nombre se queda en claro y la supresión dice `ok=true`

Banco con la receta de `jv-j3a` (SCRUM-914, tramo J3): PGlite en memoria fuera del repo, DDL de
`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma` (33 `CREATE TABLE` = 33 modelos) y un
traductor mínimo del cliente de Prisma a SQL. Dos comercios con un sitio cada uno, los siete campos de texto llenos;
se suprime el A y el B es el vecino. `dist` de `origin/main` compilado con `tsc --noCheck`. Banco y salidas en
`docs/master/evidencias/SCRUM-1569/`.

| campo de `customer_sites` | A en `origin/main` | A con la línea de J3 (simulada en el `.js`) | B (vecino), en los dos |
|---|---|---|---|
| `contact_name` («Luis el portero») | **EN CLARO** | redactado | intacto |
| `phone` | redactado | redactado | intacto |
| `name`, `address`, `city`, `postal_code`, `province`, `country` | en claro | **en claro (control negativo)** | intacto |

`suprimirMerchant` sale `ok=true` en los dos casos. En `main` se redacta del sitio solo `phone`
(`updateMany pedidos: … customerSite:phone …`).

## Los siete campos de `CustomerSite`, uno a uno (pregunta del orquestador)

| campo | en `main`, antes de esta rama | con esta rama |
|---|---|---|
| `phone` | cubierto (`CAMPOS_PERSONALES`) | igual |
| `name` | FUERA con motivo: «el nombre del SITIO que el profesional elige («Piso 3ºB»), no el de una persona» | igual — ⛔ no se toca, lo decide un jefe |
| `address` | `SIN_DECIDIR` con su pregunta (el instrumento funcionando, no un defecto) | igual |
| `contactName` | **en ninguno, y el censo en verde** | visible; `SIN_DECIDIR` «decidido, falta la línea» |
| `city`, `postalCode`, `province`, `country` | **en ninguno, y el censo en verde** | visibles; `SIN_DECIDIR` con la pregunta de `address` |

## ② El vocabulario: de lista de nombres a familias

Un **núcleo** es la última palabra del nombre en camelCase, en frontera de mayúscula: lo que la columna ES.
`NUCLEOS_PERSONALES` = las ocho familias de las 14 palabras (`email`, `phone`, `name`, `taxId`, `address`,
`direccion`, `notes`, `iban`) + el domicilio en trozos (`city`, `postalCode`, `province`, `country`). Es
**aditivo**: `VOCABULARIO_PERSONAL` no pierde ninguna entrada y sigue mandando para lo que no es un núcleo, así
que la línea `serialNumber` de la rama de J3 (SCRUM-914) entra sin tocar el mecanismo.

| medida | antes | después |
|---|---|---|
| población: columnas `String`/`String?` (misma expresión que el censo) | 224 | 224 |
| columnas que el censo ve | 34 | **64** (34 + 21 por núcleo + 9 de domicilio) |
| trinquete `SIN_DECIDIR` | 16 | **45** (+19 que no veía, +9 de domicilio, +`contactName`) |
| `FUERA_DE_ANONIMIZADO` | 3 | 4 (+`whatsAppMessage.templateName`) |
| `CAMPOS_PERSONALES` | sin cambios | sin cambios |

**Ensanchar, no abrir (el control del orquestador).** Con una subcadena entran `nameSearch` y `shippingAddressMode`;
por núcleo, no (su núcleo es `Search` y `Mode`). `templateName` **sí** entra en la población, porque su núcleo es
`name`, y queda declarado FUERA con su motivo («el nombre de la PLANTILLA de Meta…»). Lo dejé así a propósito y no
lo excluí con una regla: una excepción escrita se revisa; una regla que lo calla es la invisibilidad que este
ticket quita.

**Las 19 que no veía** van al trinquete con su pregunta, ninguna a `CAMPOS_PERSONALES`: `customer.billingAddress`,
`quote.shippingAddress`, y las **17** de `invoice` (12) y `albaran` (5), con una sola pregunta escrita una vez
(`EN_DOCUMENTO_SELLABLE`): regla 29, y espera al asesor (SCRUM-1264). ⛔ No se toca cómo se anonimiza una factura:
sólo dejan de ser invisibles.

**Dos cifras de c.20092 corregidas** (las publicó el orquestador como suyas): las «176 sin mirar» eran **166**
(224 − 34 − 24), y las de `invoice`/`albaran` eran **18**, no 14 (13 + 5; 17 si se quita `invoice.shippingAddressMode`).

### Los rojos, con el código quieto en `7e1298833f2937a73e656c4f457049caceab0f68`

| # | inyección | resultado de `scrum497` (14 tests) |
|---|---|---|
| R1 | el censo de `origin/main` (sólo nombre exacto) | 5 ✖, entre ellos «SIEMBRA… `contactName`» con «el censo NO VE `customerSite.contactName`» y «CONTROL POSITIVO del domicilio». Y «ninguna columna SIN CLASIFICAR» sale **verde**: es la ceguera, medida |
| R2 | el núcleo convertido en subcadena (`git diff -U0` impreso: `campo.toLowerCase().includes(…)`) | 2 ✖: «CONTROL NEGATIVO del núcleo» («`nameSearch` casa como dato personal») y «sin clasificar» |
| R3 | la línea de J3 en `dist` (`customerSite: ['phone', 'contactName']`) | 1 ✖: el TRINQUETE, «da 44 pendientes» — la dependencia salta |
| R4 | anonimizar de más en `dist` (`customerSite: ['phone', 'city']`) | 2 ✖: «…NADA MÁS» («redacta `customerSite.city` y nadie lo ha decidido») y el trinquete |
| — | sin inyección | 14 ✔ |

Cada inyección se deshizo con `git restore --source=HEAD`, o copiando de vuelta el `.js` (`cmp` igual), y después
`git status --porcelain` limpio.

## ③ Lo que ninguna familia lee: 157 columnas, sin clasificar

**224** de texto − **64** que el censo ve − **3** que el núcleo excluye a propósito = **157**. Lista entera en
`evidencias/SCRUM-1569/las-157-que-ninguna-familia-lee.txt`, y las 166 de c.20092 en `las-166-sin-familia.txt`.
**Su cero no está medido.** Las que por su NOMBRE parecen de una persona, sin clasificarlas (lo decide un jefe):

- `customer.mobile` — un teléfono del cliente, al lado de `customer.phone`, que sí se redacta
- `merchant.clabe` — una cuenta bancaria (México), hermana de `merchant.iban`
- `legalAcceptance.ip`, `legalAcceptance.userAgent`, `auditLog.ip`
- `albaran.firmadoPorNombre`, `albaran.firmadoPorCalidad`, `albaran.signatureUrl`, `albaran.notas`, `albaran.lugarEntrega`
- `parteTrabajo.firmadoPorNombre`, `parteTrabajo.firmadoTecnicoNombre`, `parteTrabajo.firmadoPorCalidad`,
  `parteTrabajo.signatureUrl`, `parteTrabajo.signatureTecnicoUrl`, `parteTrabajo.notas`, `parteTrabajo.obra`
- `quote.signatureUrl`, `quote.decisionComment`, `quote.rejectionReason`, `invoice.clientComment`
- `customerEvent.title`, `customerEvent.detail`, `quoteRequest.description`, `quoteRequest.zone`
- `vfSubmission.obligadoNif`, `vfFlujoObligado.obligadoNif`, `vfSubmission.registroXml`
- `whatsAppMessage.error`, `emailMessage.error` (los rebotes traen la dirección dentro: ya lo dice `registroDeEnvios.ts`)
- `botSession.state`, `job.titulo`, `maintenancePlan.title`, `attachment.url`, `expense.receiptData`

⚠️ El vocabulario era **medio bilingüe**: tenía `direccion`, pero no `notas` ni `nombre`, y las dos aparecen arriba en
documentos que pueden estar sellados. **Límite declarado** en el test: `surname`, `nif` o `dni` tampoco casan.

## Lo que se ha corrido

Sobre la punta `17fa0a409ef949a2179ca281e2a51eea3207d35a`, en esta máquina (`dist` con `tsc --noCheck`: el cliente de
Prisma compartido va por detrás del esquema, le faltan `Merchant.activityKind` y `Quote.archivedAt`):

| qué | población | resultado |
|---|---|---|
| `scrum497` | 14 tests | 14 ✔ |
| a mano: scrum497, 192, 237, 976, 267, 1294, 244 (×6), 440, 1295 | 134 tests | 131 ✔ · 2 ✖ (mi cicatriz mal formada, corregida y repetida: `scrum1294` 4/4 ✔; el ④ de 976 cae por lo mismo, por arrastrar `guards:entrada`) · 1 saltado |
| `npm run guards:entrada` | 15 guards | EXIT=0 |
| los 5 de árbol entero que sólo corren en CI (SCRUM-1560) | 38 tests | 38 ✔ |
| la tanda entera, `'tests/*.test.mjs'` | 11.981 tests | 11.803 ✔ · **22 ✖** · 156 saltados · EXIT=1 |
| **línea base**: los 11 ficheros de esos 22 rojos, en un worktree limpio de `origin/main` e0c32fb5 con su propio `dist` | 115 tests | 22 ✖ en los dos árboles, **el mismo conjunto, nombre a nombre** (`diff` vacío), y es el de la tanda |

Los 22 son del cliente de Prisma de esta máquina (scrum222, 235, 245, 252, 385, 461, 471, 475, 733, 1199,
1298b), no de esta rama. No se ha esperado el CI (orden del encargo).

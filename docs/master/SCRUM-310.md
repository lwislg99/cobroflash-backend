# SCRUM-310 · D0 — las seis preguntas, medidas

**Fecha:** 4-ago-2026 · **Carril:** D (alta e importación) · **Gate:** sin gate — es un informe
**Medido contra:** `origin/main` = `cc417b41d3ffe6cd208ef38df8c0732ebbb2822d` · 2026-08-04T23:49:29+01:00
**Suite en esa base:** 1342 tests · 1275 pass · **0 fail** · 67 skip · `npm test` exit **0**

> **ALCANCE: esta tarea NO construye.** Cero código de producción, cero rutas, cero UI, cero
> tickets, `prisma/schema.prisma` intacto. Lo único que entra en el repo es este documento.
> Las mediciones derivadas se hicieron con scripts desechables **con suelo declarado**; ninguno
> se incorpora a la suite, porque un guard nuevo sería construir (ver «lo que falta por guardar»).

---

## Índice de veredictos

| # | pregunta | veredicto |
|---|---|---|
| 6 | El alta entera | **[MEDIDO]** — D es un **ONBOARDING**, no un importador |
| 1 | Importador de productos | **[MEDIDO]** — existe y está cableado; el `[SUPUESTO]` era correcto |
| 2 | Importador de clientes | **[MEDIDO]** — **existe**; la respuesta `[MEDIDO]` del ticket era falsa |
| 3 | `wipeDemo` hoy | **[MEDIDO]** — omite **11** modelos; el mecanismo completo ya existe sin usar |
| 4 | Plantillas de gremio | **[MEDIDO]** — hay catálogo; las capturas **no** salen de él |
| 5 | El checklist actual | **[MEDIDO]** — lista a mano, marcado derivado |

---

## P6 · EL ALTA ENTERA — [MEDIDO]

### Cuántos campos y cuáles obligatorios

La pantalla de alta pide **3 campos**: `name`, `email`, `country`
([public/register.html:28,32,36](../../public/register.html)). En servidor se validan **dos**
([auth.routes.ts:41-42](../../src/modules/auth/app/routes/auth.routes.ts)): `name` no vacío y
`email` que *contenga* `@` — no valida formato. `country` no se valida y cae a `'ES'` (`:36`).

**No se pide NIF.** Ni en el alta ni en el wizard posterior. `taxId` solo existe como campo
obligatorio del formulario de Configuración ([settingsView.js:65](../../public/dashboard/js/settingsView.js)),
otra pantalla y otro momento.

El alta crea ([auth.service.ts:294-306](../../src/modules/auth/domain/auth.service.ts)) un
Merchant con `plan:'trial'`, `planExpiresAt: +14 días`, `status:'active'`, `referralCode` y
`acquisitionSource`. **Nada más**: ni productos, ni plantillas, ni `trade`.

### ¿Se pide tarjeta? — No

En ningún punto. Y **esto corrige una premisa del ticket**: la comparación presenta el «sin
tarjeta repetido tres veces» como decisión que el competidor tiene y nosotros no. Medido, YaQu
ya lo dice **seis veces** en superficie pública — `register.html:23` y `:53`,
`index.html:42,319,478`, `precios.html:88`. Lo que YaQu **no** dice en ninguna parte es
**cuántos campos son** ni **cuánto se tarda**, que es lo que ellos sí prometen.

### Cuánto se tarda de cero a dentro — [MEDIDO en pasos] · [NO SE PUEDE MEDIR HOY en segundos]

1. `POST /auth/register` con 3 campos (`register.html:90`)
2. **No entra.** Sale «Revisa tu email y haz clic en el enlace» y redirige a `/login.html` a los 4 s (`:93-96`)
3. Se mandan **dos** correos: bienvenida (`auth.service.ts:309`) + magic link (`:311`)
4. El enlace vive **15 min** y es de un solo uso (`auth.service.ts:11`, `verifyMagicLink:210`)
5. `GET /auth/verify` → cookie 30 días → `/dashboard/` (`auth.routes.ts:71-72`)
6. Primera carga: si `!onboardingCompleted`, wizard de **3 pasos** (`app.js:375`, `onboardingView.js:77-171`)

**Los segundos no son medibles desde el árbol** y no se estiman: dependen de la latencia de
Resend y del filtro de spam del destinatario, que no están en el repo.

🔴 **El paso que sí es medible es el que manda.** Ellos prometen «30 segundos, solo email y NIF».
Nosotros pedimos **menos datos** (2 obligatorios, y sin NIF) pero metemos **un salto a la bandeja
de entrada** que su copy no tiene. La fricción no está en nuestro formulario.

### Qué se puede hacer con el perfil incompleto

**Sí se puede crear un presupuesto con el NIF vacío.** `CreateQuoteSchema`
([schemas.ts:31-52](../../src/core/validation/schemas.ts)) no menciona `taxId` y no hay guard en
el camino de creación. `taxId` solo gobierna el camino fiscal —`portonDocumento.ts:84`,
`selladoEstado.ts:72`, `exports.routes.ts:540`— todos con la forma `country==='ES' && !!taxId`.
Sin NIF, el documento tras el pago es un justificante de cobro, que es exactamente lo que ya
dice el checklist de Configuración (`settingsView.js:606`).

El wizard es **saltable de un clic en cualquier paso** («Saltar por ahora», `onboardingView.js:254`)
→ `POST /admin/onboarding/complete` marca `onboardingCompleted:true` (`app.ts:508`) **y no vuelve
a salir nunca**.

### Qué pasa al acabar la prueba — y no es lo que dice el correo

El bloqueo es `requireActivePlan` ([authMiddleware.ts:55-74](../../src/core/http/authMiddleware.ts)):
403 `trial_expired` + `redirect:'/dashboard/#plans'`.

**Está montado en 4 sitios, de 95 rutas de escritura**: `app.ts:257` (`/quote/create`),
`app.ts:333` (`/admin/quotes/:id/send-whatsapp`), `albaranes.routes.ts:571` y `:588`. No existe
ningún `.use(requireActivePlan)`.

*Suelo de esta derivación:* las 95 se contaron por invocaciones `app|router.(post|put|patch|delete)(`
en todo `src/`; si el conteo diera 0 el barrido estaría roto y la conclusión sería nula.

Avisa antes: día 3 (si no ha enviado ninguna cotización), día 7 y día 12 (`lifecycle.service.ts`).

🔴 **El correo del día 12 dice «perderías el acceso a tu panel».** Medido, el panel no se pierde:
facturar, cobrar, clientes, productos, gastos, informes y equipo siguen funcionando. Lo único que
caduca es **crear presupuestos** y **enviar por WhatsApp presupuestos y albaranes**. El claim es
más duro que el código.

Y el correo del día 3 dice «tu catálogo, lo tienes precargado por oficio» — solo es cierto si el
usuario completó el paso 2 del wizard con un oficio ≠ «otro».

### Veredicto: D es un ONBOARDING

El alta ya es **más ligera** que la del competidor en datos. La fricción está en tres sitios
medidos: el salto al email, un wizard que se salta de un clic y no vuelve, y un catálogo vacío
para quien lo salta. Un importador sirve al profesional que **migra** con su tarifario en la
mano — camino minoritario, y ya medio construido. **D1 primero no mueve la aguja del alta.**

### 🔴 El acoplamiento P6 ↔ P1: el callejón sin salida de `trade`

`trade` se captura en **un solo sitio de todo el producto**: el paso 1 del wizard
([onboardingView.js:91](../../public/dashboard/js/onboardingView.js)). **No es editable en
ninguna otra pantalla** — no está entre los 25 campos de Configuración (censo de SCRUM-284), y
`app.ts:419` solo lo LEE. `POST /admin/products/load-catalog` lo exige
([products.routes.ts:30-31](../../src/modules/products/app/routes/products.routes.ts) → 400
`trade_required`).

Consecuencia medida: **quien salta el wizard se queda sin oficio para siempre.** El botón de
rescate del estado vacío de Productos («📚 Cargar el catálogo de mi gremio», `productsView.js:379`)
llama a `load-catalog` con `body: {}` (`:394`) → cae en `trade_required` → muestra «No se pudo
cargar el catálogo» (`:400`), que no dice qué pasa ni cómo arreglarlo. **No hay forma de
arreglarlo desde la interfaz.**

Eso es lo que de verdad deja catálogos vacíos. No la falta de importador.

---

## P1 · IMPORTADOR DE PRODUCTOS — [MEDIDO]

**Existe, entero y cableado.** El `[SUPUESTO]` del ticket era correcto. Botón «⬆ Importar CSV»
(`productsView.js:45`), input `accept=".csv,text/csv"` (`:50`), `POST /admin/products/import`
(`products.routes.ts:174`) → `importProductsCsv`
([products.service.ts:96-189](../../src/modules/products/domain/products.service.ts)).

### Qué acepta y en qué formato

- **No es subida de fichero.** El navegador lee con `file.text()` y manda el CSV **entero como
  string dentro de un JSON** `{csv}` (`productsView.js:592-599`). Tope real
  `express.json({limit:'2mb'})` (`app.ts:120-121`): un CSV grande da **413**, no un error de importación.
- Delimitador **adivinado de la primera línea**: `;` si la cabecera lo contiene, si no `,` (`:103`).
- Cabecera obligatoria: **`name` y `price`** (`:106,108,112`); si falta una → `invalid_header`/400.
- Opcionales: `description`, `vat` (0..1), `isactive` (`true/1/si/sí` vs `false/0/no`).
- **Sin tope de filas.** Un `findFirst` + un `create` **por fila, secuencial y sin transacción** (`:131,165`).

### Qué hace con las filas ilegibles: las tira en silencio

| L | descarte | ¿se cuenta? |
|---|---|---|
| 123 | nombre vacío | **no** |
| 126 | precio no numérico o ≤ 0 | **no** |
| 153 | `vat` fuera de 0..1 | **no** |
| 137 | ya existe (mismo `nameSearch`) | **no** |
| 181 | duplicado por choque UNIQUE (P2002) | sí |

🔴 **`skippedDuplicates` solo cuenta el camino de carrera (P2002)**; el camino normal —el
`findFirst` de `:131`— hace `continue` sin sumar. Un CSV de 100 filas todas duplicadas enseña
**«Insertados: 0 · Duplicados omitidos: 0»** (`productsView.js:604`).

🔴 Un fichero vacío o de una sola línea devuelve **200 con `inserted: 0`** (`:99-101`).

### Qué le falta

1. **El ida y vuelta con nuestro propio export está roto.** `exportProductsCsv` escribe con `;`
   (`:78,88`) pero `escapeCsv` solo entrecomilla si el campo lleva `,`, `\n` o `"` (`:72`) —
   **no si lleva `;`**. Y el importador parte por `split(delimiter)` sin honrar comillas (`:120`).
   Un producto con `;` en el nombre desplaza columnas al reimportar (el precio se lee de la celda
   equivocada → NaN → fila tirada en silencio); uno con salto de línea parte el registro en dos
   (`:97`). **Exportar y reimportar no es idempotente.**
2. **BOM sin guardia en servidor** (latente, no vivo): el export antepone `﻿` (`:92`) y el
   importador no lo quita → la primera celda sería `﻿name` → `invalid_header`. Hoy no se ve
   porque `Blob.text()` decodifica quitando el BOM. Cualquier cliente que no sea ese navegador lo pisa.
3. **Ninguna fila descartada se reporta.**
4. **Cero tests.** Nada toca `importProductsCsv` ni `/admin/products/import`.
5. **Permisos abiertos y ya declarados como duda:** ni `import` ni `load-catalog` llevan
   `requireRole`; están en `PENDIENTE_CLASIFICAR` con `tanda: 3` y la duda escrita —
   *«Reescribe el tarifario en bloque → admin»*
   ([adminRouteDeclarations.ts:154-155](../../src/core/http/adminRouteDeclarations.ts)). Hoy
   **un Técnico puede reescribir el tarifario por CSV pero no puede exportarlo** (`GET /export`
   sí lleva `requireRole('admin')`, `products.routes.ts:162`). Se reporta, no se toca (regla 9).

---

## P2 · IMPORTADOR DE CLIENTES — [MEDIDO] · la respuesta del ticket era FALSA

> El ticket dice `[MEDIDO]`: *«la pantalla de Clientes solo tiene Exportar CSV y + Nuevo cliente.
> **No hay importar**»*.

Medido hoy: **`POST /admin/customers/import` existe**
([customersAdmin.routes.ts:78-126](../../src/modules/system/app/routes/customersAdmin.routes.ts)),
está cableado desde [csvImport.js:128](../../public/dashboard/js/csvImport.js), y el botón lo
monta [customersView.js:58](../../public/dashboard/js/customersView.js). No es un mecanismo sin
disparador: **es un importador completo, con modal, vista previa y desglose de errores.**

### Qué acepta

- **Fichero .csv/.txt por click o arrastrando, o pegando el contenido en un textarea** (`csvImport.js:23-31`).
- Cabeceras **en español con alias y normalización de acentos/ñ/espacios** (`:149-158`):
  `nombre|name|cliente` · `telefono|phone|tel|movil|mobile` · `email|correo|mail` ·
  `notas|notes|nota|observaciones`. Solo `nombre` es obligatorio (`:159`).
- Separador `;` o `,`, adivinado de la cabecera (`:148`).
- Tope **500 filas**, con error tipado `too_many_rows` (`customersAdmin.routes.ts:84`).
- Dedup por **teléfono O email** (`:100-110`).

### Qué hace con las filas que no puede leer

**Las cuenta y las enseña, dos veces.** Antes de importar, la vista previa dice
«N clientes válidos · M filas sin nombre (se omitirán)» (`csvImport.js:99-101`) y pinta hasta 25
filas en una tabla. Después, la respuesta es `{created, skipped, errors, errorList}` con los 10
primeros errores (`customersAdmin.routes.ts:121`) y el toast enseña los tres números (`csvImport.js:135`).

### Comparación campo a campo — lo que decide si D1 arregla o rehace

| capacidad | CLIENTES | PRODUCTOS |
|---|---|---|
| honra comillas en el CSV | **sí** — máquina de estados `csvSplitLine` (`csvImport.js:184-194`) | **no** — `split()` crudo (`products.service.ts:120`) |
| cabeceras en español + alias | **sí** (`:149-158`) | **no** — solo `name`/`price` |
| vista previa antes de importar | **sí** (`:103-118`) | **no** |
| pegar contenido, no solo fichero | **sí** (`:29-31`) | **no** |
| reporta filas descartadas | **sí** — `created/skipped/errors/errorList` | **no** |
| tope de filas declarado | **sí** — 500 tipado | **no** |
| dónde se parsea | **cliente** (manda filas ya estructuradas) | **servidor** (manda el CSV crudo) |
| tests | 0 | 0 |
| `requireRole` | no (PENDIENTE_CLASIFICAR, tanda 3) | no (ídem) |

🔴 **Conclusión para D1: ARREGLA, no rehagas.** Todo lo que le falta al de productos ya está
escrito en el árbol, y además en funciones genéricas y reutilizables —`csvParseRows`,
`csvSplitLine`, `findIdx`, `cell` (`csvImport.js:145-194`)— que no saben nada de clientes.
D1 es mover productos al patrón de clientes, no inventar un importador.

**Con una decisión real dentro, que no es trámite:** el de clientes parsea en el **navegador** y
el de productos en el **servidor**. Unificar hacia el cliente da todo lo de la tabla gratis pero
deja el parseo **fuera del alcance de la suite** (hoy es el único de los dos testeable sin
navegador, aunque no tenga ni un test). Unificar hacia el servidor obliga a portar `csvSplitLine`
y a inventar el reporte de errores. **No lo decide esta tarea.**

### ¿Hay otro camino de importación sin botón? — No

Barrido derivado sobre todo `src/`: `createMany` aparece **2 veces**
(`albaranes.routes.ts:688`, `whatsappLog.service.ts:76`) y ninguna es una importación; rutas que
leen un array del body hay **4** (`albaranes:192`, `jobs:714`, `customersAdmin:81`,
`invoicesAdmin:233`) y las tres que no son la de clientes reciben **arrays de IDs** para operar
sobre registros existentes, no altas. **Los dos únicos importadores son los dos que ya tienen botón.**

*Suelo:* si el barrido devolviera 0 coincidencias en ambos patrones estaría roto — devuelve 2 y 4.

**Pero el patrón de la casa sí aparece dos veces en este informe, en otro sitio:** `borrarMerchant`
(P3) y `load-catalog` inalcanzable sin `trade` (P6).

---

## P3 · `wipeDemo` HOY — [MEDIDO], derivado del DMMF

**No se ha repetido por fe.** Medido hoy sobre `cc417b41`, con la lista de modelos derivada de
`Prisma.dmmf.datamodel` **por nombre de campo** (`merchantId`), nunca por el de la columna.

> ⚠️ **La trampa, confirmada:** de los **21** modelos con `merchantId`, **2 no** mapean a
> `merchant_id` — `Quote` e `Invoice` guardan la columna en camelCase. Derivar por convención de
> columna los perdería **en silencio**. El módulo `portabilidadCompleta.ts:27-37` ya lo declara y
> mi derivación lo reprodujo exactamente: `Quote(merchantId)`, `Invoice(merchantId)`.

*Suelos declarados:* la derivación falla en rojo si devuelve <15 modelos (la lista real es 21) y
si el parseo de `wipeDemo` encuentra 0 `deleteMany` (encuentra 12). Sin los dos suelos, «0
omitidos» y «no supe mirar» serían el mismo número.

### El cuadre

```
modelos con merchantId (DMMF) ......... 21
  de esos, wipeDemo borra ............. 10
  de esos, wipeDemo OMITE ............. 11
wipeDemo borra además, sin merchantId .. 2   (event, reconciliation — cuelgan de Charge)
total llamadas deleteMany .............. 12
```

### Los once omitidos, hoy

`Albaran` · `AlbaranLineaFacturada` · `Attachment` · `AuditLog` · `AuthSession` · `Job` ·
`LegalAcceptance` · `MaintenancePlan` · `Provider` · `QuoteTemplate` · `TeamMember`
([seed-demo.mjs:131-146](../../scripts/seed-demo.mjs))

**Son exactamente los once que nombró SCRUM-244**, más de cien commits después. La medición de
entonces sigue siendo cierta — pero ahora está medida, no heredada. Y el «~10-12 modelos» de
entonces ya es preciso: **12 llamadas, de las cuales 10 son modelos con tenencia propia**.

**Y sigue sin guard.** Ningún test vigila la cobertura de `wipeDemo`; el guard hermano
(`tests/scrum241-backup-tablas.test.mjs:12`) dice literalmente que de las dos listas sin guard
cerró la del backup y dejó esta. Es la última que queda.

### ¿Se puede atar al guard derivado que ya usan `borrarMerchant` y SCRUM-192/172?

**Sí — y más que eso: el mecanismo completo ya existe y no lo llama nadie.**

[`borrarMerchant`](../../src/modules/system/domain/borradoMerchant.ts) ya hace, hoy, todo lo que
a `wipeDemo` le falta:

- `ORDEN_BORRADO_MERCHANT` (`:42-66`) cubre **20 de los 21** modelos, en orden de FK.
- `FUERA_DEL_BARRIDO_GENERICO` (`:74-80`) declara el 21.º con su motivo: `botSession` tiene
  `merchantId` **nullable** (SCRUM-174), así que un `deleteMany({where:{merchantId}})` no toca las
  filas de primer contacto — **se barre por teléfono**. `wipeDemo` hace lo mismo (`:143`) pero por
  prefijo `346110000`, que solo vale para el demo.
- `COLGADOS_DE_CHARGE` (`:96-101`) declara los dos que **el guard derivado no puede ver** porque no
  tienen `merchantId`: `event` y `reconciliation`. Su FK es RESTRICT, así que si sobreviven el
  borrado de `charge` **falla**.
- Devuelve `{borradas, errores}` por modelo (`:103-108`, `:166-168`): **un borrado parcial se ve**.
- Está guardado por `tests/scrum192-borrado-merchant.test.mjs` (exige que todo modelo derivado esté
  en el orden o declarado fuera) y `tests/scrum244-colgados-de-otro-modelo.test.mjs`.

🔴 **Y ninguna ruta lo llama** — el propio fichero lo dice (`:112`): *«hoy no lo llama ninguna
ruta (a propósito: exponerlo es otra decisión)»*. Es el patrón de la casa otra vez.

**Respuesta a la precondición de D3:** no hace falta un guard nuevo, ni ampliar `wipeDemo`. Hace
falta **una decisión** y **un matiz**:

- La decisión: D3 debería llamar al mecanismo derivado y guardado, no al de `seed-demo`.
- El matiz, que es real: `borrarMerchant` **borra también el merchant** (`:166`). «Eliminar datos
  de ejemplo» quiere vaciar la cuenta y **conservarla**. Eso es un parámetro, no un mecanismo nuevo
  — pero es un cambio en un fichero de borrado, y va con OK del fundador.
- Y `botSession` seguiría necesitando la lista de teléfonos (`opciones.telefonosBot`), que para una
  cuenta real no es un prefijo: es lo que haya conversado. Hueco declarado, no resuelto.

**Poner un botón sobre `wipeDemo` tal y como está hoy entrega once tablas sucias.** Confirmado.

---

## P4 · LAS PLANTILLAS DE GREMIO — [MEDIDO] · y las capturas no salen de donde el ticket cree

**Sí hay catálogo**, y es un artefacto de primera: `data/catalogs/{gremio}.json`, con schema
propio, cargador ([catalogLoader.ts](../../src/core/data/catalogLoader.ts)) y un consumidor
(`POST /admin/products/load-catalog`).

| gremio | items | plantillas |
|---|---|---|
| cerrajeria | 25 | 3 |
| climatizacion | 25 | 4 |
| electricidad | 27 | 5 |
| fontaneria | 28 | 4 |
| pintura | 25 | 4 |
| reformas | 25 | 4 |
| **total** | **155** | **24** |

Cada item trae `nombre`, `unidad`, `precioOrientativo{min,max}` y `categoria`; el fichero trae
`gremio`, `status`, `version` y `_nota`.

*Suelo:* si cualquier catálogo devolviera 0 items la lectura estaría rota; los seis devuelven ≥25.

### 🔴 Pero los literales de las capturas NO están en el catálogo

Medidos uno a uno:

| literal de la captura | dónde vive |
|---|---|
| «Punto de agua nuevo» | **solo** `scripts/seed-video.mjs:568` |
| «Cambio de termo 80L» | **solo** `scripts/seed-video.mjs:566` |
| «Desatasco con máquina» | `seed-video.mjs:567` **y** `data/catalogs/fontaneria.json` |
| «Mano de obra oficial de 1ª (hora)» | **solo** `scripts/seed-video.mjs:116` |
| «Desplazamiento (zona sur de Madrid)» | **solo** `scripts/seed-video.mjs:118` |
| «Llave de paso 1/2"» | **solo** `scripts/seed-video.mjs:112` |

**Cinco de seis salen únicamente de [`scripts/seed-video.mjs`](../../scripts/seed-video.mjs)**, que
su propia cabecera describe como *«V0-6: cuenta realista para grabar el vídeo comercial (60 s)»*.
O sea: **las capturas muestran el seed del vídeo, no el catálogo ni el demo.** El ticket plantea
la disyuntiva como «¿seed-demo o catálogo?» y la respuesta es «ninguno de los dos».

### Hay TRES listas a mano del mismo gremio, y ninguna deriva del catálogo

| fuente | entradas `{name: …}` | ¿usa el catálogo? |
|---|---|---|
| `scripts/seed-demo.mjs` | 15 | **no** |
| `scripts/seed-video.mjs` | 48 | **no** |
| `data/catalogs/fontaneria.json` | 28 items + 4 plantillas | *es* el catálogo |

Barrido: **ningún script de `scripts/` menciona `data/catalogs` ni `getCatalogFile`.** El catálogo
lo consume solo la ruta `load-catalog`.

### Decisión para D3: REUTILIZA

El contenido ya existe, con precios etiquetados como orientativos y plantillas por gremio para los
seis oficios. Crear más sería la cuarta lista del mismo gremio.

**Y enlaza con P6:** «precargar por gremio» ya está construido y es barato — el que no es barato es
el camino para llegar. `load-catalog` es idempotente (no hace nada si el merchant ya tiene ≥2
productos, `products.routes.ts:33-36`) y exige `trade`, que **solo se puede fijar en el paso del
wizard que se salta de un clic**. El trabajo de D3 no es el contenido: es el acceso.

---

## P5 · EL CHECKLIST ACTUAL — [MEDIDO] · lista a mano, marcado derivado

Vive en `renderSetupChecklist`
([homeView.js:195-241](../../public/dashboard/js/homeView.js)). Es **mitad y mitad**, y la mitad
que importa para ampliarlo es la primera:

- **Los seis pasos son un array escrito a mano** (`:201-208`). No derivan de nada.
- **El `done` de cada uno SÍ deriva del estado real**, uno por uno:

| # | paso | `done` se deriva de |
|---|---|---|
| 1 | Añade tu logo | `!!merchant.logoUrl` |
| 2 | Configura cómo cobras | `!!(merchant.iban \|\| merchant.bizumPhone)` |
| 3 | Conecta tu WhatsApp | `!!merchant.whatsappPhone` |
| 4 | Enlace de reseñas de Google | `!!merchant.googleReviewUrl` |
| 5 | Completa NIF y dirección | `!!(merchant.taxId && merchant.address)` |
| 6 | Crea tu primer presupuesto | `data.recentActivity.length > 0` |

- El contador `4/6` es `steps.filter(s=>s.done).length + '/' + steps.length` (`:224`): **derivado
  del array**, así que añadir un paso mueve el denominador solo.
- Se oculta entero cuando los seis están hechos (`:211`) y **no lo ve un Técnico** (`:198`).

### Lo que hay que saber para ampliarlo sin romperlo

1. **El paso 6 no mide lo que dice.** `recentActivity` son los **5 presupuestos más recientes del
   merchant sin filtro de estado ni de fecha** (`metrics.service.ts:27-32`, `where:{merchantId}`,
   `orderBy updatedAt desc`, `take:5`). O sea que **un borrador creado y abandonado marca «Crea tu
   primer presupuesto» como hecho**. No caduca —no hay ventana temporal— así que no se desmarca
   solo, pero el verde puede ser falso.
2. **La lista a mano es el mismo fallo mudo de SCRUM-284, en un segundo sitio.** Un ajuste nuevo en
   Configuración **no aparece aquí**, y no hay ningún guard que lo avise. Si D amplía el checklist,
   la pregunta no es qué pasos añadir: es si esta lista debe seguir siendo a mano.
3. **Ampliarlo es barato y seguro:** el contador, el pintado y el «Ir →» derivan todos del array
   (`:224,227-236`), así que un paso nuevo solo necesita su `label`, su `done` y su `action`.

---

## Lo que este informe cambia del diseño de la epic

1. **D no es un bloque de importación con onboarding al lado.** Es un onboarding, y la importación
   es una pieza dentro. El orden D1→D4 debería reflejarlo.
2. **D1 arregla, no construye.** Los dos importadores existen; uno es bueno y el otro no. El trabajo
   es portar el bueno, con una decisión declarada (cliente vs servidor) que no es de trámite.
3. **D3 tiene dos precondiciones distintas y ninguna es la que el ticket suponía:** el contenido ya
   existe (P4) y el mecanismo de borrado también (P3). Lo que falta en ambos casos es **el camino**.
4. **El callejón de `trade`** (P6) bloquea a la vez el catálogo precargado y la recuperación desde
   Productos. Es el defecto más barato de arreglar y el que más desbloquea.

## Lo que falta por guardar — y por qué no se hizo aquí

Esta tarea es un informe y no construye, así que **ninguna de las mediciones de arriba quedó como
guard en la suite**. Lo que queda declarado, para quien lo recoja:

- **`wipeDemo` sigue sin guard de cobertura** (P3) — es la última de las listas que SCRUM-244 y
  SCRUM-241 dejaron abiertas, y ya ha derivado once modelos.
- **Los dos importadores tienen cero tests** (P1, P2).
- **El checklist de Inicio no tiene guard** contra la Configuración real (P5).

---

## Preguntas contestadas y su forma

Las seis van `[MEDIDO]` con ancla de fichero y línea. La única parte marcada
**`[NO SE PUEDE MEDIR HOY]`** es **el tiempo en segundos de cero a dentro** (P6): depende de la
entrega de Resend y del filtro de spam del destinatario, que no están en el repo y no se estiman.

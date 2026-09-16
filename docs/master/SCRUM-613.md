# SCRUM-613 · Cinco mediciones que desbloquean el lote del 24-ago

**Fecha:** 24-ago-2026 · **Carril:** medición · **Gate:** sin gate — no entra código, no entra test

**Medido contra:** `origin/main` = `9b49190a7ab81be5c88a32b7745623ac78c8354f` · 2026-08-24T12:02:35+01:00

**Paso 0.** No existía rama ni worktree con este número: `git ls-remote --heads origin` completo, sin
filtrar, 24-ago-2026. `docs/master/SCRUM-613.md` no existía. Se trabajó en `cobroflash-backend` sobre
rama propia `scrum-613-cinco-mediciones`, nacida de `origin/main`. Los tres documentos del 24-ago
declaran «NO SE HA ABIERTO EL REPOSITORIO»; esto es lo que se ve al abrirlo.

**Lo que NO se ha hecho, y es la mitad del encargo:** no se ha arreglado nada. Ni la normalización
del teléfono, ni el botón «Borrar», ni el desglose del PDF, ni los duplicados de clientes que ya
existen. No se ha tocado `prisma/schema.prisma`, ni ningún flag, ni se ha creado ningún ticket.

---

## 1 · P-CONT-4 — qué valores tiene HOY «Tipo de cliente» *(desbloquea SCRUM-574 · CONT-01)*

**Son dos preguntas y las dos tienen respuesta distinta.**

**(a) Lo que el ESQUEMA permite.** Tres capas, y no dicen lo mismo:

| capa | qué admite | ancla |
|---|---|---|
| Postgres | **cualquier texto, o NULL** | `data_type=text`, `is_nullable=YES`, `column_default=null`, **sin CHECK** — medido por `information_schema` |
| Prisma | `String?` — sin enum, sin `@default` | `prisma/schema.prisma:189` → `tipoDestinatario String? @map("tipo_destinatario")` |
| API | **solo NULL, PARTICULAR o EMPRESARIO** | `src/core/validation/schemas.ts:248` → `z.enum(['PARTICULAR','EMPRESARIO']).nullable().optional()` |

La ausencia de `@default` es deliberada y está razonada en el propio schema: `null` = «nunca
clasificado», que no es lo mismo que «clasificado como particular».

**(b) Los valores REALES en la tabla.** Medido en lectura pura (`SELECT ... GROUP BY`, ni un INSERT ni
un UPDATE) contra las dos bases alcanzables desde un árbol de trabajo:

| base | filas en `customers` | reparto de `tipo_destinatario` |
|---|---|---|
| `acela.proxy.rlwy.net/railway` (STAGING) | 4 | **NULL → 4** |
| `acela.proxy.rlwy.net/yaqu_dev_javier` (DESARROLLO) | 11 | **NULL → 11** |

Las 15 filas llevan NULL. **Cero valores fuera del trío.** El recuento total va delante del reparto a
propósito: un reparto de una base vacía se lee igual que un reparto sin clasificar, y aquí las bases
no están vacías.

**PRODUCCIÓN NO SE HA MEDIDO, y no por olvido:** en este árbol no hay credencial de producción y no
la puede haber (regla 3, verificado hoy con `node scripts/comprobar-claves-bd.mjs`: las tres claves
apuntan a donde prometen y ninguna a producción). Lo que sí se puede afirmar de producción sin
tocarla es esto, y es derivado, no supuesto:

**NINGÚN CAMINO DE CÓDIGO PUEDE ESCRIBIR UN TERCER VALOR.** Censo completo de escrituras sobre
`tipoDestinatario` en `src/`, `public/`, `scripts/` y `prisma/` — son **dos**, las dos con la misma
lista cerrada de tres opciones, y las dos pasan por el `z.enum` de arriba, que devuelve 400 ante
cualquier otra cosa:

- `public/dashboard/js/customersView.js:297` — modal de alta/edición
- `public/dashboard/js/customerDetailView.js:365` — ficha 360, mismo trío

Ni el importador CSV, ni el bot de WhatsApp, ni el alta por `charges` lo escriben nunca: los tres
dejan la columna en NULL (ver el censo de altas en la medición 3). **Consecuencia para CONT-01:** si
en producción apareciera un tercer valor, no habría salido del producto — sólo de un SQL a mano.

**«Sin clasificar» NO es un valor almacenado**, es cómo se pinta el NULL:
`public/dashboard/js/customersView.js:172` y `customerDetailView.js:314`.

---

## 2 · P-CONT-5 — ¿existe ya una exportación de clientes? *(afecta a SCRUM-583 · CONT-10)*

**SÍ EXISTE, Y ADEMÁS ES ALCANZABLE.** Por dos caminos distintos, ninguno de ellos en la lista de
Clientes.

**① CSV suelto de la cartera.** `GET /admin/exports/customers.csv`
→ `src/modules/exports/app/routes/exports.routes.ts:412`, montado en
`src/app.ts:583` con `requireRole('admin')`, servido por
`src/modules/exports/domain/exportData.ts::buildClientes`. Ocho columnas: nombre, razón social,
NIF/CIF, teléfono, email, notas, baja de WhatsApp y fecha de alta.

**ALCANZABLE PARA UN MERCHANT NUEVO:** botón de descarga en
`public/dashboard/js/reportsView.js:53`, dentro de la vista **Informes**, que tiene su entrada de
barra lateral en `public/dashboard/index.html:131` (`data-view="reports"`) y se despacha sin ninguna
puerta de rol en `public/dashboard/js/app.js:284`.

**② `clientes.csv` dentro del paquete.** `datos.zip` y `portabilidad.zip`
(`exports.routes.ts:134` y `:748`); el dataset `clientes` es uno de los seis de
`src/modules/exports/domain/seleccionExport.ts:19`. Alcanzable desde Configuración › Tus datos
(`public/dashboard/js/settingsView.js:940`); esa vista salió de la barra a propósito y su
alcanzabilidad la vigila `tests/scrum420-barra-lateral.test.mjs`.

**EL INSTRUMENTO SE COMPROBÓ ANTES DE FIARSE DE ÉL.** El censo es derivado: se enumeraron las **11**
rutas de `exports.routes.ts` y se cruzó cada una contra las referencias en `public/`. Control
positivo con el MISMO instrumento sobre la importación, que existe seguro:
`public/dashboard/js/customersView.js:56` → `public/dashboard/js/csvImport.js:213` →
`POST /admin/customers/import` (`src/modules/system/app/routes/customersAdmin.routes.ts:121`). El
instrumento encuentra las dos direcciones; el «sí» de la exportación no es un artefacto de mirar mal.

**El hallazgo real, entonces, NO es «falta la exportación»:** es que está en Informes y en
Configuración, y no donde se busca. R11 de `docs/RUNBOOKS.md` está cubierto hoy.

---

## 3 · P-CONT-6 — dónde está la validación del teléfono *(dimensiona SCRUM-578 · CONT-05)*

**EN NINGUNO DE LOS DOS.** Ni cliente ni servidor validan ni normalizan el teléfono en el alta de
cliente. Confirmado con el código delante, que es lo que se pedía.

**CLIENTE — no valida.** `public/dashboard/js/customersView.js:155` construye el campo del teléfono
con el mismo `createField` genérico que el resto; `createField` (línea 10) monta un
`<input type="text">` **sin `pattern`, sin `required`, sin `maxlength`**. El envío
(`customersView.js::onModalSubmit`, línea 287) sólo hace `.trim()` y sólo comprueba una cosa: que el
nombre no esté vacío. La ficha 360 es igual: `customerDetailView.js:300`, sin atributo de validación.

**El rótulo del campo ES una instrucción para el humano, no una regla.** Confirmado: es texto de
`<label>` y no tiene ningún mecanismo detrás.

**SERVIDOR — no valida ni normaliza.** `src/core/validation/schemas.ts:237` →
`phone: z.string().min(5).optional()`: lo único exigido es longitud ≥ 5. Un número con prefijo y
espacios (13 caracteres) y el mismo número sin prefijo (9) pasan los dos, y también pasaría `abcde`.
Y `src/modules/system/customerAdmin.ts::createCustomer` (línea 44) hace
`data: { ...data, merchantId, portalToken }` — **el teléfono entra en la BD tal cual llegó.**

**LA NORMALIZACIÓN EXISTE, y ese es el punto.** `src/core/utils/utils.ts::normalizePhone` (línea 30)
quita espacios, guiones, paréntesis, el `+` inicial y el `00`, y devuelve cadena vacía si no cuadra
`^\d{8,15}$`. Está importada en **20 ficheros**. Censo de las **cuatro** altas de `Customer` del
producto, que es lo que decide el alcance de CONT-05:

| alta | ¿normaliza? | ancla |
|---|---|---|
| alta al crear un cobro | **SÍ** | `src/modules/billing/app/routes/charges.routes.ts:27` |
| QR de WhatsApp | **SÍ**, aguas arriba | `src/modules/whatsappBot/domain/botFlow.service.ts:264`; el `phone` viene de `normalizePhone(from)` (líneas 148 y 282) |
| **el formulario de Clientes** | **NO** | `src/modules/system/customerAdmin.ts:45` — spread crudo |
| importador CSV | **NO** | `src/modules/system/domain/importarClientes.service.ts:205`; el valor sale de la celda tal cual (línea 190) |

El importador arrastra además el defecto al deduplicar: busca el duplicado por igualdad literal de
`phone` (`importarClientes.service.ts:200`), así que las dos formas del mismo número no se reconocen.

**Y el fix que registra `docs/SPRINT_DEMO_READY_EXT.md` («identidad tolera teléfonos con "+"») es
exactamente eso: una TOLERANCIA en la LECTURA, no una normalización en la escritura.** Se ve en
`botFlow.service.ts:191`, `:260` y `:315`, que buscan al cliente por las DOS formas a la vez. El
camino de identificar a quien escribe ya está trabajando alrededor del defecto.

**Los dos clientes con el mismo nombre y el mismo día de alta son el comportamiento del código**, no
una anomalía. No se han tocado ni auditado (decisión expresa del fundador).

---

## 4 · P-DOC-5 — qué hace «Borrar» con un producto ya referenciado *(desbloquea SCRUM-609 · CAT-01)*

**LA TERCERA DE LAS TRES: lo permite, y el documento guarda copia de los datos.** Leído del código;
no se ha borrado nada ni se ha tocado producción.

**Borra de verdad, y sin comprobar nada.**
`src/modules/products/domain/products.service.ts::deleteProduct` (línea 268) comprueba la tenencia y
llama a `prisma.product.delete` — **DELETE físico**, sin comprobación de referencias, sin caer al
`isActive` que el propio modelo ya tiene. La ruta
(`src/modules/products/app/routes/products.routes.ts:276`) no añade ninguna puerta. En pantalla:
`public/dashboard/js/productsView.js:456` (botón `btn-danger`) y `:483`, cuya única barrera es un
`confirm()` del navegador.

**No rompe ninguna referencia porque NO HAY NINGUNA REFERENCIA QUE ROMPER.** Y esto está medido, no
supuesto:

- **En el esquema:** ningún modelo tiene `productId`. `Product` sólo aparece como relación inversa en
  `Merchant` (`prisma/schema.prisma:113`) y en `Provider` (`:645`). Ni `Invoice`, ni `Quote`, ni
  `Albaran` apuntan a un producto.
- **En el código:** censo insensible a mayúsculas de `productid|product_id` sobre `src/`, `public/` y
  `prisma/` → **5 apariciones, todas en `public/dashboard/js/quotesView.js`**, y todas son
  `conceptInput.dataset.pfProductId`, un atributo del DOM en el editor de presupuestos. Las cinco son
  **asignaciones**: nadie lo lee nunca, así que no sale del navegador. **Control positivo del mismo
  instrumento:** `providerId` → 39 apariciones. El cero no es ceguera.
- **Lo que sí viaja:** el catálogo entra en el presupuesto por **autocompletado de texto**
  (`GET /admin/products/autocomplete`, `products.routes.ts:130`), y la línea que se manda lleva
  concepto, cantidad, precio, margen, IVA y la marca de suplido (`quotesView.js:974`). Sin id.
- **Y el documento se queda con su copia:** `Invoice.lines` es `Json?`, documentado en
  `prisma/schema.prisma:427` como líneas de detalle copiadas del Quote o del Charge al crear la
  factura.

**Regla 29 NO está en riesgo por esta vía:** borrar un producto no puede alterar una factura emitida,
porque la factura nunca dependió del producto. Lo que se pierde al borrar es el catálogo hacia
adelante, no el documento hacia atrás.

---

## 5 · P-DOC-2 — ¿desglosa el IVA la landing del cliente? *(dimensiona SCRUM-604 · DOC-14)*

**SÍ. LA LANDING LO DESGLOSA Y EL PDF NO.**

**LA LANDING SÍ.** `src/modules/system/app/routes/quoteDecisionLanding.routes.ts::renderQuoteDetail`
(línea 286), montado en `src/app.ts:133` sobre `/pay`. El bloque de totales (líneas 328-336) pinta la
base imponible y una fila por cada tipo de IVA con su cuota, calculadas con `calcVatBreakdown`. Es
condicional a que **haya cuota**: sin cuota no se desglosa nada, decisión razonada en el propio
fichero (SCRUM-212: una cuota 0 no es una exención, y afirmarlo sería un claim fiscal derivado de un
importe). La columna de líneas enseña el NETO, para que líneas + IVA cuadre con el total.

**EL PDF NO.** `src/modules/invoicing/infra/pdf/pdf.service.ts::generateQuotePdf` (línea 381). Su
único bloque de totales es la línea 642, una sola fila con el total y la divisa — que es exactamente
lo que se ve en el PDF del presupuesto #32. **Medición dura:** el texto «Base imponible» aparece
**UNA sola vez en todo el fichero de 701 líneas**, en la línea 286, **dentro de
`generateInvoicePdf`**. En el bloque `generateQuotePdf` (381-701) hay **cero** apariciones de «Base
imponible», `vatMap`, `subtotal` o `totalVat`. Sí tiene columna de IVA por línea (línea 561): lo que
falta es el **agregado**.

**EL MÁSTER, LEÍDO CON CUIDADO, NO ESTÁ INCUMPLIDO.** «total con IVA desglosado (ES)» está en
**N1**, y N1 es `/pay/quote/:id` — la **LANDING** (`docs/YAQU_MASTER.md:409`, dentro de la parte N,
landing del cliente final). Esa exigencia está **cumplida**. El máster no especifica el contenido del
PDF de presupuesto en ninguna parte. Existe un precedente cercano y decidido en su día: el PDF del
albarán valorado lleva bloque de totales base + total **sin desglose de cuota**
(`docs/YAQU_MASTER.md:631`, SCRUM-67).

**Consecuencia para DOC-14: es sólo el PDF, y no arrastra un incumplimiento del máster vivo.**

---

## Hallazgos de rebote — una línea cada uno, ninguno arreglado

- `GET /admin/exports/fees.csv` y `GET /admin/exports/jobs.csv` existen y tienen **0 enlaces** en `public/`: construidos y no alcanzables desde la interfaz (patrón de `tests/scrum411-exports-inalcanzables.test.mjs`).
- `/admin/products` se monta **sin `requireRole('admin')`** (`src/app.ts:504`), así que el borrado del catálogo lo alcanza también un técnico; el borrado de clientes sí lo exige (`customersAdmin.routes.ts:230`).
- `phone: z.string().min(5)` acepta cualquier texto de 5 caracteres: la validación de longitud no es una validación de teléfono.
- El importador CSV de clientes deduplica por igualdad literal de `phone` (`importarClientes.service.ts:200`), así que importar la misma cartera con y sin prefijo la duplica.
- El catálogo tiene ya un «Desactivar» sobre `isActive` (`productsView.js:451`) que convive con el borrado físico.

---

## Recuento de la suite

`npm test` sobre esta rama, 24-ago-2026:

**total 3934 · pass 3857 · fail 0 · skipped 77 · duration 62,1 s**

Los 77 saltos DECLARAN su motivo, y el «0 fallos» no los incluye:

| saltos | motivo declarado |
|---|---|
| 65 | `sin QA_DB_TEST=1 · npm run test:staging:gated` |
| 9 | `sin LIBRO_PG_URL` (banco local / desechable) |
| 1 | `sin BOT_SUITE_TEST=1` |
| 1 | `sin A55_DB_TEST=1` |
| 1 | EPERM de Windows creando un enlace a fichero (el mismo mecanismo lo cubre un control positivo portable que sí corre) |

Uno de los gateados es el de la propia medición 2: el que prueba los CSV de export contra base. La
exportación de clientes existe y es alcanzable; su prueba de integración sólo corre en la tanda
gateada.

# SCRUM-1787a · Facturas iguales que presupuestos: medición lado a lado, clasificación y plan por tramos (no se construye)

**Medido contra:** `origin/main` = `e24f2828ed68d0159d53e546fe6fb25903f79972` · 2026-11-21T05:00:17Z

A9: sin fallo que generalice — el único error propio fue de los datos de ejemplo del guion (IVA de las líneas del presupuesto puesto como 21 en vez de 0,21: la ficha pintó «2.100 %»); se cazó mirando la captura antes de darla por buena, se corrigió en el guion con su comentario y se repitió la pasada; no es un defecto del producto ni de un instrumento compartido.

Carril J1 (solo documentos y evidencias: nada en `src/`, `public/` ni `prisma/`). Encargo del orquestador J (`cobroflash-backend-87`), 21-nov-2026, sesión `jv-j1gu`. Orden del fundador, literal en la descripción del ticket. Concreción del fundador en c.22300 (la FICHA de factura es la pantalla prioritaria). Medición y preguntas publicadas en Jira **c.22301**.

## Hallazgos principales

1. **El editor ya es uno.** La factura suelta abre el editor del presupuesto en modo recortado: `public/dashboard/js/quotesView.js:26` (`renderQuotesView`), bandera `:70`, entrada `:6067`. El cuerpo que se manda sólo lleva cliente + concepto/cantidad/precio/IVA (`cuerpoDelDocumentoSuelto.js:57`).
2. 🔴 **El PDF de la factura no imprime el NIF ni la dirección del cliente**: el tipo `customer` de `generateInvoicePdf` no los tiene (`src/modules/invoicing/infra/pdf/pdf.service.ts:383`), bloque del cliente `:551-557` (nombre, correo, teléfono). El del presupuesto sí imprime el NIF (`:1016`). El dato existe (`prisma/schema.prisma:783`, `customerTaxId`). RD 1619/2012 art. 6.1 d) y e) los pide en factura completa, con excepciones (BOE no releído hoy). Camino de emisión → GO aparte.
3. **La ficha de factura no muestra líneas** (`invoiceDetailView.js`: 0 apariciones de `lines`); la del presupuesto sí (`quotesDetailView.js:700`).

## La ficha (pantalla prioritaria, c.22300): bloque a bloque

| bloque del presupuesto | dónde | en la factura hoy | equivalente propuesto | textos a firmar |
|---|---|---|---|---|
| Cabecera «Presupuesto #N» + PDF / Duplicar / Volver | `quotesDetailView.js:102,120,126` | «Factura» sin número + «← Volver a facturas» (`invoiceDetailView.js:38,45`); el PDF está abajo, en Acciones (`:358`) | título con el número de serie; PDF y Volver arriba. Duplicar: no tiene sentido igual (una emitida no se copia: sería «nueva factura con estas líneas») | título y subtítulo; si se quiere, el de «duplicar» |
| ESTADO + chip WhatsApp + TOTAL grande | `:286-332` | ya igual (`invoiceDetailView.js:150-166`, mismas clases) | nada | — |
| Línea de progreso Creada → Enviada → Aceptada → Facturada → Cobrada | `:1589-1602` | no hay | **Emitida → Enviada → Cobrada** (y estado final Rectificada / Anulada) — los estados son CERRADOS (Parte L): pintar los que ya existen, no inventar | «Emitida», «Enviada», «Cobrada» |
| SIGUIENTE PASO (botones del paso que toca) | `:393-396` | «ACCIONES» con botones del registro (`:287`, `:350-355`) | renombrar y ordenar: primero lo que toca (Enviar / Marcar cobrada) | el rótulo «Siguiente paso» en la factura |
| CLIENTE (nombre, teléfono, correo) | `:593` | «DATOS» con cliente y fecha (`:222`) | columna CLIENTE con nombre, NIF, dirección, teléfono, correo (los congelados de la factura) | rótulos NIF y Dirección |
| DECISIÓN (condiciones de pago) | `:604` | no hay; el bloque «Cobro» de SCRUM-285 está dentro del resumen | columna **COBRO**: forma de pago, fecha de cobro | rótulo «Cobro» y sus filas |
| Marcar aceptado / rechazado | bajo Cliente | — | su equivalente es «Anular / Rectificar», que ya existe (`:705`) y se queda (regla 29) | — |
| CONCEPTOS | `:700` | no hay | tabla de líneas igual (sólo lectura) | — (mismos rótulos) |

Carril: `invoiceDetailView.js` es **J1** y sólo pinta datos ya guardados: no toca emisión. Es el tramo más barato y el que pide el fundador.

## Resto de pantallas (detalle en c.22301)

Editor (filas 1-6), factura desde presupuesto (7), lista (10-11), PDF (12-15), envío (16-17) y página del cliente (18): tabla completa con fichero:línea y clasificación NECESARIA / NO NECESARIA en Jira c.22301. Carriles medidos con `node scripts/carriles.mjs de`: `quotesView.js`, `cuerpoDelDocumentoSuelto.js`, `quotesDetailView.js`, `quotesListView.js` → S2; `quotesAdmin.routes.ts`, `email.service.ts`, `quoteDecisionLanding.routes.ts` → S1; `invoiceDetailView.js`, `invoicesView.js`, `pdf.service.ts`, `invoicesAdmin.routes.ts`, `invoiceLines.service.ts`, `invoiceWhatsApp.service.ts` → J1; `payInvoice.routes.ts` → J2.

## Plan por tramos

- **T0 (GO de emisión):** NIF y dirección del cliente en el PDF de la factura (`pdf.service.ts`, J1).
- **T1 (J1, sin emisión):** la ficha de factura con la forma de la del presupuesto (tabla de arriba). Textos a firmar antes.
- **T2:** editor completo en la factura (S2 + J1; crear con esos datos toca emisión → GO).
- **T3:** factura desde presupuesto conserva pie de texto, descuento global y forma de pago (S1 + emisión → GO).
- **T4:** PDF de factura con el dibujo del presupuesto (J1, emisión → GO).
- **T5:** página de pago y correo con las líneas (J2 + S1; textos a firmar).

## Capturas (código real de main, datos de EJEMPLO, sin red)

`evidencias/SCRUM-1787/ficha-lado-a-lado-escritorio.png` y `ficha-lado-a-lado-movil.png`: presupuesto a la izquierda, factura a la derecha. Guion: `evidencias/SCRUM-1787/guion/capturas.js` — `public/` servido en estático en 127.0.0.1:5787, contexto con `serviceWorkers: 'block'`, `/admin/*` contestado por el guion, cada foto exige `.detail-total-amount` visible. Última pasada: 0 peticiones fuera de 127.0.0.1:5787; 2 escrituras (`POST /admin/entorno`, que manda el panel al arrancar), contestadas por el guion sin servidor. Las dos capturas, miradas una a una.

## NO medido

Editor, lista, PDF y página del cliente sin captura (no cabían en el contexto; su comparación es por código). Si las cabeceras de apartado llegan a `Invoice.lines` al facturar: un subagente lo afirmó y mi grep en `invoiceLines.service.ts` no lo confirma. Factura desde albarán y desde parte más allá de sus rutas. Ningún dato real ni base. BOE no releído. Suite entera: no corrida (solo docs; el orquestador pidió guards de docs y `guards:entrada`).

# SCRUM-1787c · La dirección del cliente congelada en la factura: DDL propuesto y diseño (solo docs; se construye en 1787d, después del ALTER)

**Medido contra:** `origin/main` = `41b0e031083b02c35e1a4cf74c4e71756f4d20f5` · 2026-11-21T05:20:39Z (cabecera `Date:` de `gh api -i zen`)

A9: sin fallo que generalice — un guion temporal mío pasado por heredoc de bash perdió una barra invertida y no llegó a correr (SyntaxError); se reescribió con la herramienta de escritura, que es lo que ya dice la memoria del equipo «No pasar texto a node por bash», y no cambió ningún resultado.

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1787/preview-ddl-1787c.mjs`

Carril J1, sesión `jv-j1gx`. Nada en `src/`, `public/` ni `prisma/` (regla 40: el esquema se LEE). **Decisión de partida:** SCRUM-1787 c.22305, literal de Javier **«ok»** a «¿Guardamos la dirección del cliente en cada factura al emitirla?» (A5 ①). GO del PDF con NIF y dirección: c.22303 ①; rótulos firmados `NIF` y `Dirección`: c.22303 ③.

## ① Los campos

Los del cliente hoy, `prisma/schema.prisma:434-438` (`model Customer`, SCRUM-579): `billingAddress`, `billingCity`, `billingPostalCode`, `billingProvince`, `billingCountry`, todos `String?` sin `@default`. La factura congela hoy cinco hermanos, `:781-785` (`customerName`…`customerPhone`, SCRUM-729). Líneas PROPUESTAS en `model Invoice`, detrás de `customerPhone` (`:785`):

    customerBillingAddress    String? @map("customer_billing_address")
    customerBillingCity       String? @map("customer_billing_city")
    customerBillingPostalCode String? @map("customer_billing_postal_code")
    customerBillingProvince   String? @map("customer_billing_province")
    customerBillingCountry    String? @map("customer_billing_country")

Se conserva `Billing` en el nombre: el comentario del cliente (`:424-425`) dice que ese prefijo es lo que impide confundirla con la dirección de la OBRA (`shippingAddress`, `:842`, SCRUM-602). Nullable y sin default por el mismo motivo que en el cliente (`:428-433`).

## ② El DDL

`docs/sql/scrum-1787-direccion-cliente.sql`, marcado PROPUESTO. Sacado OFFLINE por `docs/master/evidencias/SCRUM-1787/preview-ddl-1787c.mjs` (`previewMigracion({ schema, desde })` sobre copias en un temporal fuera del árbol; salida en `preview-ddl-1787c.salida.txt`): control de la herramienta ok · 1 sentencia (`ALTER TABLE "invoices"` con 5 `ADD COLUMN … TEXT`) · destructivas 0 · lista blanca de `scripts/_aplicar-sql-dev.mjs` 1 permitida / 0 rechazadas, y `revisar()` sobre el `.sql` entero (verificación comentada incluida): `ok: true` · control negativo (actual → actual) `sin_cambios` · control positivo SEMBRADO (DROP fabricado de `customerEmail` en la factura): destructivas 1, rechazadas 1 (y `revisar()` de ese DROP: `ok: false`). **Quitado el sembrado** (cambiando su línea por `const sembrado = propuesto;` con `sed` en una copia, borrada después): sale 2, «CIEGO (un control no se cumple)». Esquema idéntico en `e24f2828` y `41b0e031` (`git diff --quiet`: 0).

## ③ Verificación después del ALTER

En el mismo `.sql`, comentada: `current_database()` + `information_schema.columns` de `invoices` con los cinco nombres. Esperado: **5 filas**, `text`, `is_nullable = YES`, y el nombre de la base en cada una. 0 filas = no aplicado en ESA base; menos de 5 = a medias.

## ④ Dónde se congela al emitir

Hoy TODO pasa por `src/modules/invoicing/domain/clienteCongelado.ts` (J1): `congelarCliente` `:154` (su `select` `:167` trae los cinco y NO la dirección), `congelarDesdeFicha` `:129`, `congelarParaRectificativa` `:193`. `crearFacturaEmitida.ts:65` (J1) derrama el objeto entero en `tx.invoice.create`. Censo con `grep -E '\b(congelarCliente|congelarParaRectificativa|congelarDesdeFicha|emitInvoice|crearFacturaEmitida)\('` sobre `src/` (30 líneas, leídas una a una; quitadas las 5 definiciones):

| origen | congela en | emite en | cliente | carril |
|---|---|---|---|---|
| suelta (`POST /admin/invoices`) | `invoicesAdmin.routes.ts:194` `congelarDesdeFicha(customer)` | `:184` `emitInvoice` | ya leído, `select` `:157` SIN `billing*` → hay que añadirlos | J1 |
| rectificativa R1 | `invoicesAdmin.routes.ts:1200` `congelarParaRectificativa` | `:1220` | hereda de la original | J1 |
| cobro (`Charge`) | `src/lib/invoicing.ts:382` `congelarDesdeFicha(ch.customer)` | `:424` | ya leído entero (`include: { customer: true }`, comentario `:374`) | J1 |
| desde presupuesto (admin) | `quotesAdmin.routes.ts:325` | `:363` | `congelarCliente` lo lee | S1 |
| desde presupuesto, entera | `quotesAdmin.routes.ts:647` | `:656` | `congelarCliente` | S1 |
| desde presupuesto (público) | `quotes.routes.ts:623` | `:658` | `congelarCliente` | S1 |
| trabajo | `jobs.routes.ts:1599` | `:1634` | `congelarCliente` | S1 |
| albarán | `albaranes.routes.ts:1416` | `:1421` `emitInvoice` | `congelarCliente` | S1 |
| parcial (albarán) | `albaranes.routes.ts:1698` | `:1703` | `congelarCliente` | S1 |
| recapitulativa | `recapitulativa.service.ts:78` | `:109` | `congelarCliente` | S1 |
| parte (1780c) | — | — | NO EXISTE en main (0 `partes/:id/facturar` en `src/`); nacerá con `congelarCliente` | J1 (1780b) |

**Consecuencia:** cambiando `clienteCongelado.ts` (J1) y el `select` de `invoicesAdmin.routes.ts:157` (J1), las siete bocas de S1 congelan la dirección **sin tocar sus ficheros**. Carriles con `node scripts/carriles.mjs de` el 21-nov.

🔴 **La trampa:** el MISMO `ClienteCongelado` se derrama también en el ALBARÁN: `albaranes.routes.ts:1021` → `datosDeAlbaranEmitido` (`src/modules/jobs/domain/albaranEmision.ts:74-75`, `{ estado, ...cliente }`), y `albaranes` NO tendrá las columnas nuevas. Añadir los cinco al tipo `ClienteCongelado` (`:73`) y a `CAMPOS_CONGELADOS` (`:86`) rompería la emisión del albarán y el censo de `tests/scrum841-el-escritor-del-albaran.test.mjs` (lee `CAMPOS_CONGELADOS`). **Diseño propuesto:** un tipo aparte `DireccionCongelada` con su lista `CAMPOS_DIRECCION_CONGELADOS`; `congelarCliente`/`congelarDesdeFicha` devuelven `ClienteCongelado & DireccionCongelada`; `crearFacturaEmitida` pide ese tipo; `datosDeAlbaranEmitido` coge SÓLO los cinco por nombre (hoy derrama todo, y TypeScript deja pasar propiedades de más en un spread).

**Lectura:** la dirección se lee SIEMPRE de las columnas de la factura, nunca de la ficha viva, también cuando `congelado: false` (`clienteDelDocumento` `:215`): c.22305 «las facturas ya emitidas se quedan sin dirección». **R1:** hereda la de la original tal cual (NULL si la original es anterior a 1787d); sólo si la original es anterior a SCRUM-729 (`customerName` NULL) congela la ficha viva, como hoy los cinco.

## ⑤ Qué pinta el PDF

`generateInvoicePdf` (`src/modules/invoicing/infra/pdf/pdf.service.ts:366`, J1): el tipo `customer` (`:383`) sólo tiene `name`, `legalName`, `email`, `phone`; el bloque CLIENTE (`:551-556`) pinta nombre, correo y teléfono. El presupuesto sí pinta `NIF:` (`:1016`). Llamadores, los tres con `clienteDelDocumento`: `src/lib/invoicing.ts:123` (cliente `:133`), `:289` (`:296`), `invoicesAdmin.routes.ts:1338` (`:1356`). 1787d: ampliar `ClienteDelDocumento` con `taxId` (ya está) y la dirección, el tipo `:383` con `taxId` y la dirección, y dos líneas en el bloque con los rótulos firmados `NIF` y `Dirección` (c.22303 ③). `verifactu.service.ts:1131` también lee `clienteDelDocumento`, pero el XML no lleva domicilio: no se toca.

## ⑥ Plan del test (1787d; rojo primero, contra la RUTA montada en `app`)

| caso | espera |
|---|---|
| emitir suelta con cliente con dirección | la fila `invoices` lleva los cinco `customer_billing_*` = los de la ficha |
| cambiar después la dirección del cliente | la factura y su PDF conservan la vieja |
| factura «anterior» (cinco hermanos llenos, dirección NULL) con ficha que sí tiene dirección | el PDF NO pinta dirección (no cae a la viva) |
| PDF de una emitida con NIF y dirección | el texto del PDF lleva `NIF` y `Dirección` con sus valores |
| R1 de una original con dirección, y ficha cambiada | la R1 lleva la de la original |
| emitir un albarán | sigue 200 y no escribe nada de dirección (`datosDeAlbaranEmitido` sólo los cinco) |
| censo: cada boca de la tabla ④ | pasa por `congelarCliente`/`congelarDesdeFicha`/`congelarParaRectificativa` (ampliar el de `tests/scrum729-el-escritor-del-cliente.test.mjs`) |

Mutaciones previstas para su `MUTACIONES_QUE_ME_TUMBAN` (no existen todavía): quitar `billing*` del `select` de `congelarCliente` (cae el 1º); lector que cae a la ficha viva (cae el 3º); R1 que congela la ficha de hoy (cae el 5º); quitar las dos líneas del PDF (cae el 4º); `datosDeAlbaranEmitido` que vuelve a derramar todo (cae el 6º).

## ⑦ Huellas que saltarán en 1787d y su vía

| guard | por qué salta | cómo se recongela |
|---|---|---|
| `tests/scrum523d-version-del-sif.test.mjs` | `clienteCongelado.ts` está en `HUELLAS_CONGELADAS` (`:90`); `crearFacturaEmitida.ts` no está | en el mismo PR, pegando la huella que trae su mensaje, citando c.22305 (precedente: comentario `:75-78`) |
| `tests/scrum603b-descripcion-en-el-albaran.test.mjs` y `tests/scrum723-guard-contra-su-base.test.mjs` | cambia el cuerpo de `generateInvoicePdf` frente a la base de la rama | entrada nueva en `CAMBIOS_AUTORIZADOS` de `tests/_cambios-autorizados-de-la-factura.mjs`, generada con `docs/master/evidencias/SCRUM-1446d/huellas.mjs` (nunca a mano), firma c.22303 ① |
| `tests/scrum222-deriva-arranque.test.mjs` | `docs/sql/deriva-prod.sql` se genera del esquema | `node scripts/generar-sql-deriva.mjs` en el mismo PR; sus casos gateados contra staging necesitan el ALTER aplicado antes |
| `tests/scrum291-series-huecos.test.mjs` | **no salta**: hashea sólo `invoiceNumber.service.ts` y mira que no haya `model Serie` | — |

⚠️ 1788a (jv-j1gv) toca la misma función del PDF: el par base → disco de 603b/723 depende de cuál entre antes; la segunda regenera su entrada. A las 05:20Z no había ninguna rama `scrum-1788*` en el remoto.

## NO medido (1787c)

Ninguna base: no sé si alguna tiene ya las columnas. No corrí ningún test de `src/` ni la tanda del banco de emisión: el plan ⑥ no está probado, sólo leído. No miré cómo arman hoy sus datos los tests de 729 ni si el banco desechable emite una suelta por la ruta. Suite entera: no corrida (solo docs).

# SCRUM-1787d · La factura congela al emitir la dirección de facturación del cliente, y su PDF imprime NIF y dirección

**Medido contra:** `origin/main` = `c10a80edd301ed2a320f758f33fcd5814991c850` · 2026-11-21T06:15:22Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`
A9: aviso → cicatriz J1 «Leí en la R1 una columna nueva de su factura original sin mirar los bancos que crean una R1 con un `tx` falso» — no se pudo comprobar: los propios bancos ya caen (lo cazó el obligatorio de #3302: 1763 y 624y con 500); lo que falló fue no correrlos antes de empujar, y qué bancos construyen una R1 no lo enumera ningún guard.
A9: aviso → cicatriz J1 «Le dije al orquestador que el trinquete estaba en 97 antes de leer el resultado de la edición, que el clasificador de permisos había denegado» — no se pudo comprobar: un mensaje entre sesiones no pasa por ningún guard del repositorio.

Los dos fallos que cubre: (jv-j1gz) el código se escribió ANTES del test rojo; el rojo se sacó después con las dos mutaciones del catálogo pasadas por `aplicarUna`, y el meta-guard es lo que dice MUDA si una mutación declarada no tumba su test. (jv-j1hb) el catálogo heredado declaraba `buscar`/`poner` en vez de `de`/`a`, y `cae: '①'`; `aplicarUna` lo devolvió CIEGO («el ancla no está…: la declaración caducó») sin mutar nada.

Mutaciones: catálogo → `tests/scrum1787d-direccion-y-nif-en-factura.test.mjs`

Decisiones: GO del PDF y literales `NIF` / `Dirección` en c.22303, cuya respuesta literal es «1-Sí GO · 2-Ok sí · 3-Firmo · 4-Sí»; guardar la dirección, c.22305; ALTER aplicado en staging y producción y el albarán sin dirección, c.22311. Vía J1 pura (orquestador J): `crearFacturaEmitida` lee la dirección DENTRO de su transacción (`direccionCongelada.ts`, filtrando por `merchantId`); el albarán, `congelarCliente` y los 7 llamadores de S1 no cambian. La R1 hereda la dirección de su original (NULL si es anterior). Las facturas ya emitidas se quedan sin dirección (regla 29).

## Hecho

- Esquema: 5 columnas `customerBilling*` en `Invoice`. ALTER en dev aplicado por jv-j1gz (`yaqu_dev_javier`, 5 filas `text`/`YES`); staging y producción, el fundador (c.22311).
- PDF de factura: `NIF:` y `Dirección:` desde las columnas de la factura, en sus 3 llamadores (`src/lib/invoicing.ts` x2, `invoicesAdmin.routes.ts`).
- Huellas: `docs/sql/deriva-prod.sql` regenerado con `scripts/generar-sql-deriva.mjs` (545 columnas). 603b/723: DOS pares en `tests/_cambios-autorizados-de-la-factura.mjs` con firma c.22303, salidos de `docs/master/evidencias/SCRUM-1446d/huellas.mjs`: uno con la base en main sin 1788a y otro con la base en 1788a (PR #3301, sin mergear al medir), porque la rama lleva 1788a dentro y cualquiera de los dos puede entrar primero.
- `CAMPOS_DIRECCION_CONGELADOS`: jv-j1hb lo declaró en `tests/_huerfanos-declarados.mjs`; **corregido por el relevo (jv-j1hc):** ya NO se exporta desde `src/` ni está declarado en scrum411 (export sin consumidor en `src/`, scrum1185; decisión del orquestador). Hoy vive sólo dentro de `tests/scrum1787d-direccion-y-nif-en-factura.test.mjs`, derivado de `direccionDeLaFactura({})`.
- Bancos con tx falso, SIN tocar ninguna aserción: `scrum729-el-escritor-del-cliente` (añadido `customer.findFirst` y el emisor en su hueco: desde SCRUM-665 llamaba con los datos en el hueco del emisor), `scrum771` (`customer.findFirst` dentro del tx), `scrum1260b` (`customer.findFirst` → null), `scrum308-caracterizacion-rectify` y `scrum308-bloqueo-rectify` (`invoice.findFirst` → la misma original, para la R1).
- 21-nov-2026 · `docs/legal/AUDITORIA_CAMINO_EMISION.md`: 4 coordenadas recolocadas en sitio, sin mover líneas (scrum525d): `schema.prisma:949-950`→`957-958`, `:1887`→`:1895`, `invoicing.ts:104`/`:265`→`:105`/`:267`. Las movió el propio esquema (+8) y el PDF de esta rama.
- Mutaciones por `aplicarUna`, una por proceso: «no congela la dirección» tumba ① (+3 colaterales: ① regla 2, ②, ③); «el PDF no pinta el NIF» tumba ④. Las dos VIVAS; `git status` sin cambios en `src/` tras cada pasada.

## Verde medido

- Los 4 rojos heredados (222, 603b, 723, 729) + 1787d + 1446d: verdes; 2 saltos gateados de 222 (`QA_DB_TEST`/`LIBRO_PG_URL`).
- Los 13 ficheros que llaman a `crearFacturaEmitida` + 308 x2 + 729 x2: 168/168, 0 fail, 0 skip.

## NO hecho / NO medido

- Capturas del PDF: NO hechas (tope de contexto). Lo que hay es la extracción de texto del PDF fabricado en el test ④.
- Suite entera y tramos de emisión: NO corridos (orden del orquestador: la entera la corre el obligatorio). Corrida solo la dirigida de arriba y `guards:entrada`.
- `scrum728d`: su cifra de viajes dentro del cerrojo queda desfasada en silencio (F1 7→8, R1 6→7) porque simula el `create`; no lo he cambiado.
- Ni staging ni producción (no tocados).

## Relevo de #3302 (jv-j1hc y jv-j1hd, 21-nov-2026, sobre `origin/main` `8de57b45ac4b20bfe14c1d54b37ea47cadc02a32`)

- jv-j1hc arregló 11 de los 12 rojos del obligatorio (detalle y causas en SCRUM-1787 c.22323): `invoice.findFirst` y `customer.findFirst` en los `tx` falsos de 1763, 624y y 347 (ninguna aserción tocada); en `generateInvoicePdf` la dirección viaja en `customerAddress`, hermano de `customer`, para que el llamador siga escribiendo `customer: clienteDelDocumento(` (scrum577), con las huellas de 603b/723 recalculadas por `evidencias/SCRUM-1446d/huellas.mjs`; fuera el export sin consumidor (scrum1185); el test de 1787d pasa del merchant 1 al 71 (scrum409); las 5 columnas `invoice.customerBilling*` en `SIN_DECIDIR` con `EN_DOCUMENTO_SELLABLE`; ficha de mudez regenerada (scrum1395b).
- jv-j1hd: el trinquete de `tests/scrum497-dato-personal-no-sobrevive.test.mjs` pasa de 92 a 97 con su nota fechada, por la decisión del fundador de SCRUM-1787 c.22322 («1-Ok sí»). Nada más del guard. Queda ABIERTA para el fundador (c.22322): si la dirección congelada se redacta en una supresión de datos.
- `scrum728d` **sigue pendiente, medido:** sus cifras (F1 8 viajes / 7 dentro del cerrojo; R1 7) son literales escritos a mano en `tests/scrum728d-viajes-de-la-reserva.test.mjs`, y `conElCreateDelLlamador` (`tests/_viajes-de-la-reserva.mjs`) suma un +1 fijo por el `create`. El guard espía `allocateInvoiceNumber`, no `crearFacturaEmitida`, así que no ve la lectura de `direccionCongelada.ts` y sigue verde con el número viejo. No es un número derivado por su mecanismo: no se toca (regla 41). El viaje real, según el diseño de jv-j1gz, es uno más (F1 9 / 8 dentro; R1 8): sin medir con un espía de `crearFacturaEmitida`.

# SCRUM-1787b · Ficha de factura con la forma de la ficha del presupuesto (construida)

**Medido contra:** `origin/main` = `41b0e031083b02c35e1a4cf74c4e71756f4d20f5` · 2026-11-21T05:22:07Z

A9: aviso → cicatriz J1 «Un botón nuevo en la cabecera de la ficha de factura lo vigilan scrum283 y scrum600d: se mira el censo ANTES de diseñarlo, no después» — no se pudo comprobar: lo comprueban ya esos dos guards (cayeron a la primera); lo que falló fue que el plan de c.22307 lo dio por posible, y ningún guard mira un plan escrito en Jira.

Mutaciones: catálogo → `tests/scrum1787b-ficha-de-factura-como-presupuesto.test.mjs`

**Skill UI:** cargada

Decisión y firma: SCRUM-1787 c.22303 (literales `Emitida` · `Enviada` · `Cobrada` · `Siguiente paso` · `Cobro` · `NIF`; sin «Duplicar»). Plan: c.22307. Entrega: c.22312.

Qué cambia, solo en `public/dashboard/js/invoiceDetailView.js` (J1) y en un bloque `/* J1: SCRUM-1787b */` de `public/dashboard/css/styles.css`:
- Título «Factura <número>» («Justificante de cobro <número>» en un justificante). Volver va en `.detail-head-acciones`, y no hay «Duplicar».
- Línea de progreso Emitida → Enviada → Cobrada, con clases y sin `style=`. El último paso es «ANULADA» si la factura está anulada y «RECTIFICATIVA» si es R1.
- «Acciones» pasa a ser «Siguiente paso» (`.detail-next`), colgado del resumen. El marcador del fuente sigue en su sitio por scrum597.
- «Datos» pasa a ser Cliente (Cliente, NIF, Teléfono, Email; congelados si la factura lo está, regla de 1576b) + Cobro (Método, Pagada, Rectifica a, Rectificada por). Si Cobro no tiene filas, no se pinta.
- Conceptos: la tabla del presupuesto, con los helpers compartidos sin tocarlos.

**NO HECHO, y por qué:**
- **La cabecera NO lleva PDF.** `tests/scrum283-censo-acciones-factura.test.mjs` solo admite `btnBack` como navegación de la cabecera, y `tests/scrum600d-el-envio-tras-emitir.test.mjs` fija los rótulos de envío («📄 PDF» sería microcopy de factura sin firmar). Para moverlo hay que decidir por escrito: `btnPdf` del registro a la cabecera, el censo 283 y el rótulo. Decisión del orquestador J: se queda en «Siguiente paso».
- **«Dirección»:** la factura no la guarda (c.22304/c.22305). Llega en 1787d.

**Evidencias:** `docs/master/evidencias/SCRUM-1787/1787b-ficha-{pendiente,cobrada,anulada}-{escritorio,movil}.png`, generadas con `docs/master/evidencias/SCRUM-1787/guion/capturas-1787b.js` (datos de EJEMPLO, SW bloqueado y DOM exigido antes de cada captura).

**Verde:** el test nuevo da 10/10. Lo vi ROJO primero (8 de 10; los 2 que pasaban eran los controles), y las dos mutaciones de catálogo lo tumban. Dirigida de 42 ficheros (los guards de c.22307 y los del encargo): 370/370, 0 fail, 0 skip.

**NO medido:**
- La suite entera y la tanda de guards de navegador: no me cabían en el contexto.
- «Enviada» no sabe del envío por correo, porque la vista no recibe ese dato.
- En móvil, la tabla de Conceptos deja Precio, IVA y Total fuera de vista. No he mirado si a la del presupuesto le pasa lo mismo.

# SCRUM-1787e · En móvil, la tabla de Conceptos de la ficha de factura se apila (Precio, IVA y Total a la vista)

**Medido contra:** `origin/main` = `be85bc71640bb7a8e8af969e2717d233a223e161` · 2026-11-21T05:44:27Z

A9: aviso → cicatriz J1 «Escribí el arreglo de la tabla antes del test rojo que pedía el encargo; el rojo lo saqué después devolviendo el arreglo con `git apply -R` del parche guardado» — no se pudo comprobar: el orden en que una sesión escribe test y arreglo no queda en el diff, y ningún guard lo ve.

Mutaciones: catálogo → `tests/scrum1787e-conceptos-en-movil.test.mjs`

Orden del fundador: SCRUM-1787 c.22314 («2-Ok sí»). Rama `scrum-1787e-conceptos-en-movil`, nacida de `scrum-1787b-ficha-de-factura` (PR #3299, sin mergear al empezar).

## Lo medido (sonda `evidencias/SCRUM-1787/guion/sonda-1787e.js`, datos de EJEMPLO, `serviceWorkers: 'block'`)

`public/` de este árbol servido con `guion/servidor-estatico.mjs` en 127.0.0.1:5788 (el 5787 lo ocupaba el servidor de OTRO árbol: medir contra él habría sido medir otro código). Primera línea con importe; `visibles` = celdas enteras dentro de la ventana y de la tabla; `carril` = px escondidos tras el scroll propio de la tabla. 0 peticiones fuera de 127.0.0.1.

| vista · anchura | antes | después |
|---|---|---|
| factura · 390 px | 2 de 5 · carril 197 px · página 0 | **5 de 5** · carril 0 · página 0 |
| presupuesto · 390 px | 2 de 5 · carril 197 px · página 0 | igual (no se toca: S2) |
| factura · 1280 px | 5 de 5 | 5 de 5, mismas coordenadas (control) |
| presupuesto · 1280 px | 5 de 5 | igual |

Causa: la regla global de ≤768 px `.table { display:block; overflow-x:auto }` con `white-space:nowrap` en las celdas: la tabla scrollea en su propio carril y nada avisa de que hay más columnas. Capturas: `evidencias/SCRUM-1787/1787e-{antes,despues}-{factura,presupuesto}-{movil,escritorio}.png`, miradas.

## El arreglo (solo `invoiceDetailView.js` y el bloque J1 de `styles.css`)

A ≤640 px (el umbral de `.table--cards-mobile` y `.table--stack-mobile`), la tabla `.j1-fac-conceptos` oculta la cabecera y cada línea es una rejilla: el concepto a todo el ancho y Cant., Precio, IVA y Total debajo, en cuatro columnas, cada uno con su rótulo por `::before { content: attr(data-label) }`. El `data-label` se LEE de la cabecera de la propia tabla: ningún texto nuevo. Sin `style=` ni `on*=`. Escritorio: ninguna regla de la clase fuera del `@media`.

Test: `tests/scrum1787e-conceptos-en-movil.test.mjs` — rojo 3/3 con el arreglo quitado (`git apply -R`), verde 3/3 con él. Suelos: el banco ve ≥3 filas de 5 celdas; el parser ve `.j1-prog-paso`; ≥5 reglas de la clase.

## Para Luis (S2): el presupuesto tiene el mismo defecto

`quotesDetailView.js:703-707` pinta la misma tabla (`table.className = 'table'`, cabecera Concepto/Cant./Precio/IVA/Total) y a 390 px enseña 2 de 5 columnas, con 197 px tras el scroll de la tabla (captura `1787e-antes-presupuesto-movil.png`). El arreglo literal, el mismo que el de la factura:

1. `table.className = 'table quote-conceptos-tabla';` y, tras el `innerHTML` de la cabecera, `const rotulos = [...table.querySelectorAll('thead th')].map((th) => th.textContent);`; en cada fila con importe, `[...tr.children].forEach((td, k) => { if (k > 0) td.dataset.label = rotulos[k]; });`.
2. En el bloque S2 de `styles.css`, dentro de `@media (max-width: 640px)`, las seis reglas del bloque J1 `SCRUM-1787e` cambiando `.j1-fac-conceptos` por `.quote-conceptos-tabla`.
3. De paso: el `<th style="text-align:right">Total</th>` de `:707` es un `style=` en `innerHTML` (CSP); en la factura va a la clase `j1-fac-col-total`.

## NO medido

- La suite entera: no la pasé, por orden del orquestador (la pasa el obligatorio).
- El aspecto con un concepto muy largo o importes de 9.999,99 € en las cuatro columnas a 320 px.

# SCRUM-1787g · La ficha de factura, mirada por un guard de navegador (①) · los viajes de 728d, medidos y pendientes (②)

**Medido contra:** `origin/main` = `8de57b45ac4b20bfe14c1d54b37ea47cadc02a32` · 2026-11-21T19:45:26Z

A9: comprobación → `scripts/guard-ficha-de-factura.mjs`

A9: aviso → A10 «El catálogo de mutaciones juzga por nombre de test: un guard de navegador no lo tiene, y su rojo vive en un guion de evidencias o no vive en ninguna parte.» — no se pudo comprobar: `aplicarUna` (scripts/meta-guard-mutaciones.mjs) exige un caso de `node --test` en verde en la pasada limpia, y ningún mecanismo de la casa muta un `guard:*` de navegador; el rojo de éste queda en un guion «una vez».

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1787/mutar-1787g.mjs`

Encargo del orquestador J (`cobroflash-backend-ba`) a J6 (`jv-j6fa`), el 21-nov-2026. Por orden del orquestador (19:4xZ), se empuja ① SOLO; ② va a un relevo con lo medido aquí.

## ① El guard: `npm run guard:ficha-de-factura`

`scripts/guard-ficha-de-factura.mjs`, con la forma de los `guard:*` de la casa (puppeteer-core, `_navegador.mjs`, `_servidor.mjs`, `recorrerCasos` y `veredictoDe` de `_hallazgos-y-ciegos.mjs`). Monta el PANEL REAL (`/dashboard/index.html#invoice-detail/1`) y una factura de EJEMPLO que contesta el propio banco por `/admin/invoices/1`; el resto de `/admin/*`, vacío. Service worker desactivado (`setBypassServiceWorker`, lo que en Playwright es `serviceWorkers:'block'`). Seis casos: pendiente, cobrada y anulada, a 390 y a 1280 px.

| aceptación (encargo) | dónde se ve |
|---|---|
| a 390 px no hay scroll horizontal de página | `scripts/guard-ficha-de-factura.mjs` · `MEDIR` (desborde con el clip quitado, ver abajo) |
| a 390 px la tabla de conceptos enseña sus 5 datos | ídem · cada celda de la primera línea, dentro de la ventana y sin que la esconda un contenedor con scroll propio |
| en los tres estados se ve la línea de progreso | ídem · `.j1-prog` y sus 3 pasos, a los dos anchos |
| en escritorio está «Siguiente paso» | ídem · `.detail-next`; el rótulo se LEE de `invoiceDetailView.js`, no se copia |
| patrón y runner de la casa | `package.json` (`guard:ficha-de-factura`) · `tests/_guards-de-navegador-declarados.mjs` · lo corre `guards:visuales` en `.github/workflows/ci.yml`: `fueraDeLaTanda()` da 42 guards y lo incluye (control: también `guard:contraste`) |
| rojo primero | `docs/master/evidencias/SCRUM-1787/mutar-1787g.mjs`: base 0; 3 de 3 mutaciones caen con salida 1 |

**Verde:** los 6 casos y las 3 siembras del control positivo, salida 0.

**Rojo** (el guion, sobre el árbol de esta rama; restaura y compara bytes):

| mutación | salida | lo que nombra |
|---|---|---|
| sin el bloque `@media` de 1787e (lo que había antes de #3300) | 1 | en los 3 estados a 390: los 5 datos de la línea fuera de la ventana (concepto 35…454 px, total 632…710 px, de 390) |
| `.j1-prog { display:none` | 1 | la línea de progreso mide 0×0, en los 6 casos |
| `actionsSec.className = 'detail-next-x'` | 1 | «Siguiente paso» no existe, en los 3 casos de escritorio |

**Hallazgo de paso — el criterio «sin scroll horizontal» se cumple SIEMPRE.** `public/dashboard/css/styles.css:495` dice `html, body { overflow-x: clip; }`: la página del panel nunca hace scroll horizontal, y lo que se sale por la derecha se CORTA sin barra. Mi primera versión medía `scrollWidth − clientWidth` y era ciega: la cazó su propio control positivo (un elemento sembrado de 2000 px y el detector diciendo 0 px). Ahora el desborde se mide quitando el clip un instante y reponiéndolo. No es un defecto de la ficha (hoy no desborda); es que la frase del encargo, medida al pie de la letra, no podía caer.

**Control positivo sembrado** (no prestado del árbol): en una página de 390 aparte, después de medir, se siembran un elemento de 2000 px, la tabla dentro de una caja de 150 px con scroll y la línea de progreso escondida. Si un detector no ve lo suyo, el guard sale 2 (no supe medir). Comprobado: con el detector de scroll ciego salió 2, no 0.

**Error mío:** el guard lo escribí contra el código ya arreglado y lo vi VERDE antes de verlo ROJO; el rojo lo saqué después mutando. El orden no queda en el diff.

## ② `tests/scrum728d-viajes-de-la-reserva.test.mjs` · MEDIDO, NO CONSTRUIDO (va a relevo)

Lo que sé, leído en `tests/_viajes-de-la-reserva.mjs` y el test:

- `espiarReserva` sólo pasa un `tx` falso a `allocateInvoiceNumber` (`dist/modules/invoicing/domain/invoiceNumber.service.js`). Todo lo que la emisión lea o escriba FUERA de esa función, dentro de la misma transacción, no lo ve.
- `conElCreateDelLlamador` suma `+1` fijo (el `invoice.create`) y `espiarReserva` suma `+2`/`+1` fijos a lo contado. Las cifras F1 8 / dentro del cerrojo 7 / R1 7 son literales.
- Por eso #3302 (SCRUM-1787d), que añade una lectura en `direccionCongelada.ts` dentro de la tx de emisión, sube la cifra real y el guard NO cae (lo midió jv-j1hd, SCRUM-1787 c.22326).
- El control «🔴 ROJO: añadir UN viaje» de ese test siembra el viaje DENTRO del doble de `allocateInvoiceNumber` (`viajeExtra`), así que demuestra que el contador cuenta lo que espía, no que espíe el sitio correcto.

NO medido: la cifra que dará con #3302 (hace falta espiar la tx completa de `crearFacturaEmitida`, o derivarla); ni el arreglo ni su rojo. Lo que queda para el relevo: hacer que el guard cuente la transacción entera (o derive la cifra de lo que mide y la compare con una declarada), sembrar una lectura extra en la tx fuera de `allocateInvoiceNumber` y verlo caer, y medir —no elegir— el número nuevo.

## NO medido (1787g)

- 320 px, conceptos de varias líneas, importes de 9.999,99 € y la factura R1 (sólo F1 en los tres estados).
- El guard en CI: lo dirá el job de `guards:visuales` de este PR.
- La suite entera, en local, por tramos (`tanda-entera-por-tramos.mjs`, 15 de 15, uno por comando): 1.742 ficheros, 14.075 casos, **10 rojos, ninguno de esta rama**. 8 son del cliente de Prisma COMPARTIDO, que a esa hora llevaba `Invoice.customerBillingAddress` (el esquema de #3302) sin estar en el `schema.prisma` de main: `_prisma-client-guard` salió 1 nombrándolo. Son scrum235 (4), el censo de producción (1), scrum461 (2) y scrum733 (1: el generador escribe 545 columnas frente a 540, que son las 5 `customerBilling*`). Los otros 2 son de scrum1298b (latido), en el tramo 3; aislado sale 8/8 en este árbol y 8/8 en un árbol limpio de `origin/main`. Por el camino, la tanda cazó dos defectos MÍOS que arreglé: scrum1392 (las listas del guard nacían dentro del caso) y scrum1603 (el banco medía sin la letra de la casa: ahora usa `_hojas-del-panel`). Los tramos 1 a 3 y 5 corrieron antes de esos dos arreglos; después volví a pasar 1392, 1603, 1313, 1320, 1327, 1336, 737, 258 y 711 (69 + 30 casos, 0 fallos) y el guion de mutaciones (3 de 3 caen).

# SCRUM-1787h · La página de pago de la factura enseña sus líneas, como la del presupuesto

**Medido contra:** `origin/main` = `c27b1dc2513f6abe8ea28f84ad596e0d6aa66b91` · 2026-11-21T19:58:52Z

A9: aviso → cicatriz J2 «edité la ruta de la página de pago antes de cargar la skill `yaqu-premium-ui`, que el encargo ponía antes de la primera edición; la cargué antes de tocar el CSS» — no se pudo comprobar: qué skill se ha cargado antes de un Edit no lo ve ningún hook del repositorio.

Mutaciones: catálogo → `tests/scrum1787h-pago-con-lineas.test.mjs`

Decisión del fundador: SCRUM-1787 c.22327 («1-Sí», pregunta 6 de c.22301). Carril J2 (`payInvoice.routes.ts`, `pagoEstilo.ts`). Sin emisión, sin esquema, sin texto nuevo.

## Lo que había

`GET /pay/invoice/:token` pintaba el importe del cobro, el concepto del cobro y «Factura <nº»>, sin líneas. La factura se buscaba por `chargeId` SOLO: una factura de otro comercio con el mismo `chargeId` habría puesto aquí su número (el control de comercio del test cayó contra el código de antes).

## El cambio

- La factura se lee con `where: { chargeId, merchantId: charge.merchantId }` y trae `number`, `total` y `lines` (las de la factura EMITIDA; nada se escribe).
- `detalleDeLaFactura` pinta, entre el importe y «Elige cómo pagar», la tabla y el desglose de `renderQuoteDetail` (`quoteDecisionLanding.routes.ts`, S1, sólo leído): cabecera «Concepto · Cant. · Importe», importe de línea = cantidad × precio, y las filas de `pieDePresupuesto` («Base imponible», «IVA (21%)»; con descuento de línea, «Suma de líneas» y «Descuento»), con el mismo cambio de rótulo de la página del presupuesto. Ningún rótulo nuevo.
- 🔴 Sólo se pinta si CUADRA: base + IVA = total de la factura, y total de la factura = importe del cobro. Si no (suplidos, otro motor de redondeo —SCRUM-624—, un cobro parcial), una tabla debajo de «Importe a pagar» diría otra cifra, y explicarlo pediría un texto sin firmar: la página queda como antes. Es decisión mía, y la digo en la entrega.
- No lleva el icono por línea de la página del presupuesto (`lineIcon` es privado de un fichero de S1; copiarlo era una segunda copia del criterio). Ni la columna «Precio»: la página del presupuesto no la tiene.
- CSS en la hoja `factura` de `pagoEstilo.ts` (servida desde 'self', sin `style=`), con las medidas de `.lines-table`/`.totals-block` de `quoteDecisionEstilo.ts` y las variables de esa hoja.

## Evidencia

- Test: `tests/scrum1787h-pago-con-lineas.test.mjs`, ruta REAL con dobles que filtran por el `where`. ROJO antes del cambio (2 de 4: sin tabla; y la factura de otro comercio se colaba), VERDE después (4 de 4).
- Mutaciones (`docs/master/evidencias/SCRUM-1787/pago-con-lineas/mutar.mjs`, `aplicarUna`): quitar `${detalleHtml}` tumba el caso de las tres líneas; quitar `merchantId` del `where` tumba el control de comercio. Árbol limpio después.
- Capturas en local, código real, datos de EJEMPLO (`pago-con-lineas/servir.mjs`): `pago-con-lineas/movil-390.png` y `pago-con-lineas/escritorio-1280.png`. Miradas: el concepto largo envuelve y los importes quedan alineados; 165,00 + 34,65 = 199,65.

## NO medido

- Cuántas facturas reales cuadran (y por tanto enseñarán líneas): sin base, no lo he intentado.
- La página en yaqu.app: se ve tras el merge y el despliegue.
- Una factura con apartados o con descuento de línea en el navegador (el código las trata como la página del presupuesto; el test no las lleva).

# SCRUM-1787f · Vencimiento y formas de pago de la factura: DDL propuesto y diseño (solo docs; se construye en el sprint siguiente, después del ALTER)

**Medido contra:** `origin/main` = `8de57b45ac4b20bfe14c1d54b37ea47cadc02a32` · 2026-11-21T19:39:01Z (cabecera `Date:` de `gh api -i zen`)

A9: sin fallo que generalice — el diff para Luis lo tenía pensado reutilizando `validWrapper` con el rótulo cambiado, y al leer el guard de 600e antes de escribirlo vi que ése sale rojo con la columna `due_date` (⑤); no llegó a ningún fichero, y lo que lo cazó ya existe: el propio guard, que cae al construir.

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1787/preview-ddl-1787f.mjs`

Carril J1, sesión `jv-j1he`. Nada en `src/`, `public/` ni `prisma/` (regla 40: el esquema se LEE). **Decisión de partida:** SCRUM-1787 c.22325, literal de Javier **«1-Sí 2-Sí 3-GO»** a las tres preguntas de c.22324: ① la factura lleva fecha de vencimiento, rótulo `Vence el` («se confirma al construir»); ② el paso «Condiciones» de la factura lleva formas de pago, vencimiento y ajustes del documento, y NO «Condiciones de pago»; ③ GO (regla 40) para recibir y congelar al emitir las formas de pago y el vencimiento, y A5 ① para el ALTER del vencimiento.

## ① El vencimiento: NO existe hoy

- `model Invoice` (`prisma/schema.prisma:775-997`) no tiene ningún campo de vencimiento. El propio esquema lo avisa en `model Charge` (`:484-489`): `expiresAt @map("vencimiento")` es hasta cuándo vale UN enlace de pago, no la factura (SCRUM-605, SCRUM-722).
- **El estado «vencida» no sale de ninguna fecha.** Es `status = 'expired'` (`:862`), lo pinta `api.js:1192` (`VENCIDA`) y lo filtra `invoicesView.js:407`, pero sólo lo escribe el profesional a mano: `PUT /admin/invoices/:id/status` (`invoicesAdmin.routes.ts:644`, acepta `pending|paid|expired` en `:652`) → `invoiceAdmin.ts:287` («para 'expired' dejamos paidAt como esté»). No hay cron que lo ponga: los `'expired'` de `src/` por fecha son de presupuestos (`expire.service.ts:2-17`) y de cobros.
- Conclusión: **hace falta ALTER.** El vencimiento nuevo NO cambia ese estado (los estados son CERRADOS, Parte L): pasarlo a `expired` solo al llegar la fecha sería cambio de máster.

## ② Las formas de pago: el presupuesto y el cobro las guardan; la factura no

- **Presupuesto:** `Quote.payMethods Json? @map("pay_methods")` (`schema.prisma:670-672`). El editor las pinta en `quotesView.js:1228-1264` («Formas de pago que verá el cliente», tres casillas `card|bizum|transfer`), `selectedPayMethods()` `:1267` devuelve `undefined` si van todas, y viajan en `:5943`. Validación: `schemas.ts:258`.
- **Cobro:** `Charge.payMethods` (`schema.prisma:493-495`), lo escribe `charges.routes.ts:63` desde `pay_methods`.
- **Página de pago de la factura** (`payInvoice.routes.ts`, J2): lee SÓLO `charge.payMethods` (`:104-107`; `null` = todas las activas). No lee la factura.
- **Quién le pone las formas al cobro de una factura:** un solo sitio, `invoiceWhatsApp.service.ts:56-85` (J1), al ENVIAR, no al emitir. Si la factura tiene `quoteId` lee `quote.payMethods` en ese momento (`:60-64`); si no, no manda nada (`:80`) y el cliente ve todas. Otro creador de cobros (`chargesAdmin.routes.ts:260`) no es de facturas.
- **La factura suelta** (`POST /admin/invoices`) no tiene presupuesto: hoy no tiene DÓNDE guardar las formas de pago. Y el guard de 600e ya lo sabía: `tests/_asignacion-bloques-presupuesto.mjs:60` asigna `payMethods` al bloque `blockConditions`, y `tests/_condiciones-vs-emisor.mjs:350-354` pone rojo cualquier control de ese bloque que se pinte en el documento suelto sin columna en `model Invoice` ni clave que sobreviva a `validarFacturaSuelta`.
- Conclusión: **congelar las formas de pago (③ GO) necesita una columna en `invoices`.** El ALTER firmado nombra sólo el vencimiento, así que va aparte y comentado: pregunta 1.

## ③ El DDL

`docs/sql/scrum-1787-vencimiento.sql`, marcado PROPUESTO. Sacado OFFLINE por `docs/master/evidencias/SCRUM-1787/preview-ddl-1787f.mjs` (`previewMigracion({ schema, desde })` sobre copias en un temporal fuera del árbol, una propuesta cada vez; salida en `preview-ddl-1787f.salida.txt`). Líneas PROPUESTAS en `model Invoice`, detrás de `stageLabel` (`:876`):

    dueDate       DateTime? @map("due_date")       ← A, firmada
    payMethods    Json?     @map("pay_methods")    ← B, pendiente de ✅

`DateTime?` y no `@db.Date`: es el tipo de su hermano del presupuesto (`Quote.validUntil`, `:597`) y el esquema no usa `@db.Date` en ningún modelo (0 en `grep "@db.Date\b"`). `payMethods` es el mismo `Json?` y el mismo nombre de columna que `quotes` y `charges`.

| control | A · `due_date` | B · `pay_methods` |
|---|---|---|
| la herramienta respondió | ok | ok |
| DDL | `ALTER TABLE "invoices" ADD COLUMN "due_date" TIMESTAMP(3);` | `ALTER TABLE "invoices" ADD COLUMN "pay_methods" JSONB;` |
| destructivas | 0 | 0 |
| lista blanca de `_aplicar-sql-dev.mjs` | 1 permitida · 0 rechazadas | 1 · 0 |

Control negativo (actual → actual): `sin_cambios`. Control positivo SEMBRADO (DROP fabricado de `clientComment` en la factura): destructivas 1, rechazadas 1. **Quitado el sembrado** (su línea cambiada por `const sembrado = propuestoA;` con `sed` en una copia, borrada después): sale 2, «CIEGO (un control no se cumple)». `revisar()` sobre el `.sql` entero: `ok: true`, 1 permitida (la de A; la de B va comentada y no cuenta).

## Verificación después del ALTER

En el mismo `.sql`, comentada: `current_database()` + `information_schema.columns` de `invoices` con `due_date` y `pay_methods`. Esperado: **1 fila** (`due_date`, `timestamp without time zone`, `YES`) si sólo se aplicó A; **2** si también B (`pay_methods`, `jsonb`, `YES`). 0 filas = no aplicado en ESA base.

## ④ Dónde se recibe y dónde se congela

**Recibir (sólo la factura suelta, que es la única que nace del editor):**

| pieza | qué cambia | carril |
|---|---|---|
| `src/modules/invoicing/domain/facturaSuelta.ts:114` `validarFacturaSuelta` | acepta `payMethods` (mismo `z.enum(['card','bizum','transfer']).min(1)` que `schemas.ts:258`; ausente = NULL = todas) y `dueDate` (fecha válida, ausente = NULL); devuelve los dos en `val` | J1 |
| `src/modules/system/app/routes/invoicesAdmin.routes.ts:184-196` | pasa `val.dueDate` y `val.payMethods` a `emitInvoice` | J1 |
| `src/modules/invoicing/domain/invoicing.service.ts:109-125` `emitInvoice` | dos entradas OPCIONALES más en `EmitInvoiceInput` → `dueDate: input.dueDate ?? null`, `payMethods: input.payMethods ?? undefined` | J1 |
| `src/modules/invoicing/domain/crearFacturaEmitida.ts:65` | nada: `DatosDeFacturaEmitida` (`:44`) sale de `Prisma.InvoiceUncheckedCreateInput`, así que los dos campos entran solos con el `prisma generate` | J1 |

**Los demás caminos NO reciben nada nuevo y escriben NULL** (no hay pantalla que mande vencimiento ni formas): desde presupuesto `quotesAdmin.routes.ts:363` y `:656`, `quotes.routes.ts:658`, trabajo `jobs.routes.ts:1634`, albarán `albaranes.routes.ts:1421`, parcial `:1703`, recapitulativa `recapitulativa.service.ts:109` (los siete, S1); cobro `src/lib/invoicing.ts:424` (J1, el cobro ya lleva sus formas); parte `facturaDesdeParte.ts:139` (J1); R1 `invoicesAdmin.routes.ts:1220` (J1). Carriles con `node scripts/carriles.mjs de` el 21-nov.

**Cómo llegan las formas al cliente sin tocar a S1 ni a J2:** en `invoiceWhatsApp.service.ts:58-64` (J1), el cobro hereda `invoice.payMethods` si es un array, y si es NULL, `quote.payMethods` como hoy. Las facturas desde presupuesto siguen leyendo las del presupuesto (como hoy, en el momento del envío); congelarlas también al emitir pediría tocar los tres ficheros S1 de arriba, y c.22325 no lo pide. `payInvoice.routes.ts` (J2) no cambia: ya lee `charge.payMethods`.

🔴 **El vencimiento NO va a `Charge.expiresAt`**: ése cierra el enlace de pago, y una factura vencida se tiene que poder seguir pagando.

## ⑤ Lo que tiene que hacer Luis (S2) en el editor

Hoy la puerta es `quotesView.js:553`: `if (!esDocumentoSuelto) leftCard.appendChild(blockConditions);`. El paso tiene tres filas: `filaCobro` (`:577`, condiciones de pago y tramos), `filaPagos` (`:600`, formas de pago) y `filaValidez` (`:623`, «Válido hasta»). Los ajustes del documento suelto viven hoy en el último paso (`ajustesSuelto`, `:932`, SCRUM-915g). Diff propuesto, en prosa porque no se escribe en `public/`:

1. Colgar `blockConditions` también en el documento suelto (quitar el `if` de `:553`), y NO colgar en él `filaCobro` (`if (!esDocumentoSuelto) blockConditions.appendChild(filaCobro);` en `:579`): c.22325 ② quita «Condiciones de pago».
2. «Vence el»: en el documento suelto, `filaValidezTitulo.textContent` (`:631`) y `validLabel.textContent` (`:1125`) dicen `Vence el`; el valor por defecto es la pregunta 2.
3. Ajustes del documento: c.22325 ② los pone en el paso Condiciones; hoy el suelto los tiene en «Revisar y emitir» (915g). Moverlos es de S2.
4. Paso «Revisar y emitir» pasa a ser el 4 también en el suelto (`data-numero`).
5. `cuerpoDelDocumentoSuelto.js:42`: un tercer parámetro opcional `condiciones` → el cuerpo lleva además `payMethods` (si no van todas) y `dueDate` (`new Date(validInput.value + "T23:59:59").toISOString()`, la misma conversión que `validUntil` en `quotesView.js:5975`). Sin el tercer parámetro, el cuerpo sale EXACTAMENTE como hoy (`tests/scrum632-los-dos-cortes-de-la-linea.test.mjs:127` lo llama con dos).
6. La llamada de `quotesView.js:5692` pasa `{ payMethods: selectedPayMethods(), dueDate: … }`.

⚠️ **Los guards que deciden la forma, leídos y no corridos:** `tests/scrum600e-condiciones-contra-el-emisor.test.mjs` mapea `validWrapper` → `validUntil` (`_asignacion-bloques-presupuesto.mjs:58`): con la columna llamada `due_date`, reutilizar `validWrapper` en el suelto le sale ROJO ①. Las dos salidas honradas son un control propio del suelto asignado a `dueDate` en `CAMPO_A_BLOQUE` (que también lee `tests/scrum286-bloques-orden.test.mjs`), o enseñarle al guard qué campo guarda cada control en cada modo. Las dos tocan un guard (A23): se decide al construir, nunca relajándolo (regla 41). Y `payMethodsWrapper` → `payMethods` sale verde sólo con B aplicada.

## ⑥ Qué pintan la ficha y el PDF

- **PDF de la factura** (`generateInvoicePdf`, `pdf.service.ts`, J1): `Vence el {fecha larga}` debajo del número, igual que «Válido hasta el …» del presupuesto (`pdf.service.ts:986-988`). La frase llega COMPUESTA, en la zona del profesional, por un `vencimiento.ts` gemelo de `src/modules/quotes/domain/validez.ts` (rótulo `:35`, frase `:75`). Con `due_date` NULL, el PDF sale EXACTAMENTE como hoy. Cambia el cuerpo de `generateInvoicePdf`: entrada en `CAMBIOS_AUTORIZADOS` (603b/723), como en 1787c ⑦.
- **Ficha de factura** (`invoiceDetailView.js`, J1): la misma frase `Vence el {fecha}` en la cabecera de 1787b, sólo si consta.
- **Formas de pago: ni en la ficha ni en el PDF.** No hay rótulo firmado para ellas en la factura, y la ficha y el PDF del presupuesto tampoco las pintan (0 en `quotesDetailView.js`, 0 en `pdf.service.ts`). El cliente las ve donde paga.
- Rótulo firmado: sólo `Vence el` (c.22325 ①). El resto de la frase es la fecha.

## ⑦ Plan del test (rojo primero, contra la RUTA montada en `app`)

| caso | espera |
|---|---|
| `POST /admin/invoices` con `dueDate` y `payMethods: ['bizum']` | la fila `invoices` lleva `due_date` y `pay_methods = ["bizum"]` |
| el mismo cuerpo sin los dos | `due_date` NULL, `pay_methods` NULL: la factura de hoy, sin cambios |
| `payMethods: []` o `['cheque']` | 400 ANTES de pedir número (la serie no se entera, como SCRUM-246) |
| `dueDate: 'no-es-fecha'` | 400 antes de pedir número |
| enviar por WhatsApp la factura suelta con `["bizum"]` | el cobro creado lleva `payMethods = ["bizum"]` |
| factura desde presupuesto (`pay_methods` NULL) | el cobro sigue heredando `quote.payMethods` |
| PDF con `due_date` | el texto lleva `Vence el` y la fecha larga en la zona del profesional; sin `due_date`, el PDF no cambia |
| `cuerpoDelDocumentoSuelto(c, filas)` con dos parámetros | el cuerpo es el de hoy, byte a byte |

Mutaciones previstas para su `MUTACIONES_QUE_ME_TUMBAN` (no existen todavía): quitar `dueDate` del paso a `emitInvoice` (cae el 1º); `invoiceWhatsApp` sin leer `invoice.payMethods` (cae el 5º); validar después de pedir número (cae el 3º); quitar la línea del PDF (cae el 7º).

## Preguntas para el fundador — ✅/❌

1. **¿Aplicamos también la columna de las formas de pago (B)?** Sin ella, la factura suelta no puede guardar las que elijas en el paso «Condiciones», y el cliente vería siempre todas. Recomiendo que sí: c.22325 ③ pide congelarlas.
2. **¿Qué fecha sale puesta en «Vence el»?** En el presupuesto «Válido hasta» sale a 30 días. Recomiendo vacía (sin vencimiento si no lo pones), para no poner un plazo que no has decidido.

## NO medido (1787f)

Ninguna base: no sé si alguna tiene ya estas columnas. No corrí ningún test de `src/` ni de `public/`: el plan ⑦ y lo de los guards de ⑤ están leídos, no probados. No miré cómo pinta la cabecera de 1787b una línea más en móvil.

# SCRUM-1787l · Las Observaciones del presupuesto pasan a la factura: la factura no tiene dónde guardarlas, DDL propuesto (solo docs; se construye después del ALTER)

**Medido contra:** `origin/main` = `ccb69008b5aaa80d3f7cb712be77ce025c146238` · 2026-11-21T21:43:19Z (cabecera `Date:` de `gh api -i zen`)

A9: aviso → cicatriz J1 «Leí el camino de emisión (`pdf.service.ts`, `crearFacturaEmitida.ts`) sin cargar la skill `yaqu-verifactu-sif`, que el encargo marcaba OBLIGATORIA; la segunda vez tras SCRUM-1771a» — no se pudo comprobar: no la cargué después porque paré antes de construir, y qué skill se ha cargado antes de leer un fichero no lo ve ningún guard del repositorio.

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1787/preview-ddl-1787l.mjs`

Carril J1, sesión `jv-j1hj`, rama `scrum-1787l-notas-del-presupuesto-a-la-factura`. Nada en `src/`, `public/` ni `prisma/` (regla 40: el esquema se LEE). **Decisión de partida:** SCRUM-1787 c.22338 ②, respuesta literal del fundador **«1-Sí 2-Sí 3-GO»** a «¿Al facturar un presupuesto se pasan a la factura sus notas o el texto del pie? Las cláusulas de aceptación no pasarían.» Contexto: c.22301, filas 6 y 7. **Paro en el punto 3 del encargo: hace falta ALTER.**

## ① Los textos del presupuesto: cuál es nota y cuál es cláusula

| texto | dónde se guarda | qué pinta el PDF del presupuesto | ¿pasa a la factura? |
|---|---|---|---|
| Texto del pie | `Quote.docFooterText` (`prisma/schema.prisma:616`, `doc_footer_text`) | bloque final con el rótulo **`Observaciones`** (`pdf.service.ts:1410-1415`, `TITULO_OBSERVACIONES` `:62`, aprobado el 2-sep-2026 «en los tres documentos», `:59`) | **SÍ** (c.22338 ②: «notas o texto del pie») |
| Texto de cabecera | `Quote.docHeaderText` (`schema.prisma:615`) | bajo la cabecera, sin rótulo (`pdf.service.ts:1065-1069`) | **sin decidir**: pregunta 1 |
| Notas internas | `Quote.internalNotes` (`schema.prisma:703`, «nunca visibles al cliente») | no se imprimen | NO: son privadas |
| Cláusulas de cierre (aceptación) | en el COMERCIO, no en el presupuesto: `Merchant.clausulasPresupuesto` (`schema.prisma:197`, SCRUM-656); el presupuesto sólo guarda las que excluye, `Quote.clausulasExcluidas` (`:754`) | tras las Observaciones (`pdf.service.ts:1521-1525`, `clausulasParaDocumento`) | **NO** (c.22338 ②) |

Todo lo de esta tabla lo pinta `generateQuotePdf` (`pdf.service.ts:920`). En el editor, cabecera y pie salen juntos de `quotesView.js:1582` y viajan en `:5966` (S2, sólo leído).

## ② La factura NO tiene campo de texto libre → hace falta ALTER

`model Invoice` (`prisma/schema.prisma:775-1005`): sus campos de texto son cliente y emisor congelados, `number`, dirección de obra, `currency`, `pdfUrl`, `qrData`, `registerId`, `status`, `paidVia`, `clientComment` (`:883`, el comentario del CLIENTE al pagar) y `stageLabel` (`:884`, la etiqueta del tramo); `lines`, `tags`, `albaranRefs`, `deductsRefs` son `Json`; el resto son de VeriFactu. **Ninguno es un texto del profesional para el cliente.** Meter el pie en `lines`, `tags` o `stageLabel` sería inventar un uso (regla 27). El propio esquema lo dice en el comentario de SCRUM-593 (`:612-614`): «LA FACTURA NO LOS TIENE, y no es un olvido» — por SCRUM-665: `ensureInvoicePdf` regenera el PDF con el código de hoy y un bloque nuevo cambiaría facturas ya emitidas. **Con la columna nullable esa objeción no se activa:** las emitidas se quedan a NULL, y el bloque sólo se pinta con texto (como en el presupuesto, `:1410`), así que una regenerada sale igual que hoy.

## ③ El DDL

`docs/sql/scrum-1787-observaciones-factura.sql`, marcado PROPUESTO. Sacado OFFLINE por `docs/master/evidencias/SCRUM-1787/preview-ddl-1787l.mjs` (`previewMigracion({ schema, desde })` sobre copias en un temporal fuera del árbol; salida en `preview-ddl-1787l.salida.txt`). Línea PROPUESTA en `model Invoice`, detrás de `stageLabel` (`:884`), con el mismo nombre y tipo que su hermano del presupuesto:

    docFooterText String?   @map("doc_footer_text") @db.Text

| control | resultado |
|---|---|
| la herramienta respondió | ok |
| DDL | `ALTER TABLE "invoices" ADD COLUMN "doc_footer_text" TEXT;` |
| destructivas | 0 |
| lista blanca de `_aplicar-sql-dev.mjs` | 1 permitida · 0 rechazadas |
| control negativo (actual → actual) | `sin_cambios` |
| control positivo SEMBRADO (DROP fabricado de `clientComment` en la factura) | destructivas 1, rechazadas 1 |
| quitado el sembrado (su línea cambiada por `const sembrado = propuesto;` con `sed` en una copia, borrada después) | sale 2, «CIEGO (un control no se cumple)» |

Verificación después del ALTER, comentada en el mismo `.sql`: 1 fila (`doc_footer_text`, `text`, `YES`); 0 filas = no aplicado en ESA base.

## ④ Dónde se congela al emitir, y qué es de quién

- **S1 (Luis):** la factura desde presupuesto nace en DOS rutas de `src/modules/system/app/routes/quotesAdmin.routes.ts`, y el encargo sólo nombraba la primera: `POST /:id/invoice` (`:232`, por tramos; `crearFacturaEmitida` en `:363-375`) y `POST /:id/invoice-manual` (`:561`, el documento entero; `:656-668`). Las dos leen el presupuesto con `include` (`:239-246` y `:568-571`), así que `quote.docFooterText` ya está cargado: no hace falta tocar las consultas.
- **J1 (emisión, GO c.22338):** `crearFacturaEmitida` (`src/modules/invoicing/domain/crearFacturaEmitida.ts:60-70`) hace `tx.invoice.create({ data: { ...datos, … } })` y su tipo `DatosDeFacturaEmitida` (`:45-48`) es `InvoiceUncheckedCreateInput` menos cliente, emisor y dirección: **con la columna en el esquema, el texto se congela sin tocar esa función**. Lo que sí es J1: el PDF de factura (`generateInvoicePdf`, mismo fichero) y la ficha (`invoiceDetailView.js`), que lo pintan con el rótulo `Observaciones`. Ningún texto nuevo.
- La huella y el XML no cambian: no llevan texto libre.

**Diff literal para Luis (S1)**, a aplicar en el PR de construcción, después del ALTER:

```diff
--- a/src/modules/system/app/routes/quotesAdmin.routes.ts
+++ b/src/modules/system/app/routes/quotesAdmin.routes.ts
@@ crearFacturaEmitida(tx, clienteCongelado, emisorCongelado, {
         stageLabel: isCustomPlan ? tramo.stage.label : null, // SCRUM-27: etiqueta congelada (solo custom)
+        docFooterText: quote.docFooterText ?? null, // SCRUM-1787l (c.22338 ②): las Observaciones del presupuesto; las cláusulas NO
         currency: quote.currency,
@@ return crearFacturaEmitida(tx, clienteCongeladoEntera, emisorCongeladoEntera, {
         stageLabel: null, // no es un tramo: es el documento entero
+        docFooterText: quote.docFooterText ?? null, // SCRUM-1787l (c.22338 ②): las Observaciones del presupuesto; las cláusulas NO
         currency: quote.currency,
```

Pregunta abierta para el plan: si un presupuesto por tramos se factura en varias facturas, con este diff **cada una** lleva las Observaciones (pregunta 4).

## ⑤ Plan del test (rojo primero, contra la RUTA montada en `app`)

| caso | espera |
|---|---|
| facturar un presupuesto con `docFooterText` | la fila `invoices` lleva `doc_footer_text` igual; el PDF lleva `Observaciones` y el texto; la ficha también |
| el mismo presupuesto con cláusulas de cierre en el comercio | ni el PDF de la factura ni la fila llevan el título ni el texto de ninguna cláusula |
| control: presupuesto sin pie | `doc_footer_text` NULL y el PDF de factura igual que hoy |

Huellas que saltarán al construir, por su vía: `tests/scrum222-deriva-arranque.test.mjs` (`node scripts/generar-sql-deriva.mjs`) y la entrada de `generateInvoicePdf` en `CAMBIOS_AUTORIZADOS` (603b/723), con cita a c.22338, como 1787c ⑦.

## Preguntas para el fundador — ✅/❌

1. **¿Pasa también el texto de CABECERA del presupuesto?** c.22338 dice «notas o texto del pie». Recomiendo que NO por ahora: sólo el pie, que es lo que firmaste.
2. **¿Aplicamos el ALTER de `doc_footer_text` (A5 ①)?** Es aditivo, nullable y sin default; las facturas ya emitidas no cambian.
3. **¿La rectificativa (R1) hereda las Observaciones de su factura original?** Recomiendo que NO: es otro documento, y lo que diga el original ya no aplica.
4. **Un presupuesto cobrado por tramos da varias facturas: ¿llevan TODAS las Observaciones?** Recomiendo que sí: cada factura es un documento que el cliente lee suelto.

## NO medido (1787l)

Ninguna base: no sé si alguna tiene ya `invoices.doc_footer_text`. No corrí ningún test de `src/` ni de `public/`: el plan ⑤ está leído, no probado. No miré la factura desde albarán ni desde parte (¿deben llevar las `notas` del albarán?): fuera del GO. No cargué la skill `yaqu-verifactu-sif` (ver la línea A9).

# SCRUM-1787l (construcción) · Las Observaciones del presupuesto en la factura: columna, PDF y ficha

**Medido contra:** `origin/main` = `ccb69008b5aaa80d3f7cb712be77ce025c146238` · 2026-11-21T21:52:38Z (cabecera `Date:` de `gh api -i zen`)

**Skill UI:** no cargada · la ficha reutiliza tal cual la sección de Observaciones de la ficha del presupuesto (`detail-section` + `quote-doc-texto`, rótulo y pintado de `textoDelDocumento.js`), sin CSS ni texto nuevo; la confieso en la línea A9.

A9: aviso → cicatriz J1 «Edité `invoiceDetailView.js` sin cargar la skill `yaqu-premium-ui`, obligatoria antes de tocar UI; lo cazó `scrum811c` al correr la dirigida» — no se pudo comprobar: qué skill se ha cargado antes de un Edit no lo ve ningún hook del repositorio.

Mutaciones: catálogo → `tests/scrum1787l-observaciones-en-la-factura.test.mjs`

Carril J1, sesión `jv-j1hl`. Decisión: SCRUM-1787 c.22345, literal **«1-Sí 2-Solo pie 3-GO 4-No 5-Sí»**; ALTER aplicado en staging y producción, c.22346.

| aceptación | dónde se ve |
|---|---|
| esquema `Invoice.docFooterText` (`doc_footer_text`) | `prisma/schema.prisma`; dev aplicado con `aplicar-sql-dev.mjs --go`: antes 0 filas, después 1 (`text`, `YES`), control `stage_label` 1 |
| la emisión congela el campo (spread de `datos`, `crearFacturaEmitida` sin tocar) | `tests/scrum1787l-observaciones-en-la-factura.test.mjs` ① |
| PDF de factura: «Observaciones» + texto, sólo con texto, nunca en justificantes | ② y ③ (null, '' y espacios dan las MISMAS líneas que sin el campo) |
| ficha de factura: misma sección que el presupuesto | ④ y su control |
| la R1 no hereda (c.22345 ④) | ⑤ (AST de la ruta de rectificar: sin `docFooterText` ni spread) |
| los tres generadores del PDF pasan el campo de la fila | ⑥; `docFooterText` es obligatorio en `generateInvoicePdf` (no compila sin él) |
| las rutas que crean la factura desde presupuesto lo pasan | NO HECHO → S1 (Luis): diff de abajo |

**Diff para Luis (S1) — TRES rutas, no dos.** Al construir apareció una tercera: `src/modules/quotes/app/routes/quotes.routes.ts:658` (camino C1, el cliente acepta desde WhatsApp y se emite el tramo). Por c.22345 ⑤ cada tramo lleva las Observaciones, así que las tres llevan la misma línea, detrás de `stageLabel`:

```diff
+        docFooterText: quote.docFooterText ?? null, // SCRUM-1787l (c.22345 ②⑤): las Observaciones; la cabecera NO
```

en `quotesAdmin.routes.ts` `/:id/invoice` y `/:id/invoice-manual`, y en `quotes.routes.ts` (C1). Hasta que entre, el texto sólo llega si alguien lo pasa a la emisión.

Huellas por su vía: `tests/_cambios-autorizados-de-la-factura.mjs` (603b/723, con `huellas.mjs`, firma c.22345); `docs/sql/deriva-prod.sql` regenerado (`generar-sql-deriva.mjs`, 222); tres coordenadas de `docs/legal/AUDITORIA_CAMINO_EMISION.md` movidas a donde está hoy su testigo (525d: `schema.prisma:964-965`, `:1902`, `invoicing.ts:268`). La línea nueva de `src/lib/invoicing.ts` va ANTES de `merchantCriterioCaja` para no dejar ciega la mutación de `scrum1240d`.

Y `TITULO_OBSERVACIONES` entra en `AMBITO_DECLARADO` de `tests/scrum723-guard-contra-su-base.test.mjs`, con su motivo (lo pide el propio guard: es un nombre, no un número).

Corrido: el test nuevo 7/7 (rojo primero en ②, ④ y ⑥); la dirigida de 21 ficheros dio 219/230 con 7 rojos, todos huellas de esta rama, arreglados por su vía; `guards:entrada` salida 0 (170 ✔); `tsc -p .` salida 0.

**NO medido:** staging y producción (no los toqué; el ALTER es de c.22346); yaqu.app; la factura desde albarán o parte; 1787i (no está en main); la dirigida NO se repitió tras arreglar las huellas (orden del orquestador: basta el test y `guards:entrada`); las dos mutaciones del catálogo NO las corrí con `aplicarUna`; la suite entera la corre el obligatorio.

## Relevo jv-j1hn (23-nov-2026 03:25Z, `origin/main` = `90e8e3774f86ff6ef393e7f25f0c6bdedb95765e`) · los tres rojos del run 44956622872

A9: comprobación → `tests/scrum593c-todas-las-puertas-del-documento.test.mjs`

Decisión: SCRUM-1787 c.22353, literal **«1-Sí»**. Carril de SCRUM-593 sin etiqueta area-: indeterminable (labels vacías en Jira el 23-nov); la cerradura no paró la escritura, y el orquestador dio el «sigue».

- ① `scrum593c`: el último caso ya no prohíbe todo `docFooterText` en `src/lib/invoicing.ts`. Por AST, en las 3 llamadas a `generateInvoicePdf` de la emisión (`invoicing.ts` ×2, `invoicesAdmin.routes.ts` ×1), `docFooterText` sólo puede ser `inv.`/`invoice.docFooterText`, y `docHeaderText` sigue prohibido. Nota fechada en el test con la cita a c.22353. Control positivo en su `MUTACIONES_QUE_ME_TUMBAN`: pasar `(inv as any).quote?.docFooterText` → VIVA con `aplicarUna` (base 6/6).
- ② `scrum409`: el fixture del PDF de `scrum1787l` pasa de `merchantId: 1` a `71`.
- ③ `scrum1547`: primero PARADO. `quote.docFooterText` está en `SIN_DECIDIR` de `tests/scrum497-dato-personal-no-sobrevive.test.mjs`, y declarar `invoice.docFooterText` igual tumbaba el trinquete de SCRUM-497 («da 98 pendientes y eran 97»): había que mover un número escrito a mano. Pregunta en c.22359; decisión del fundador en c.22360, literal **«1-Ok sí»**. Hecho: `invoice.docFooterText` entra en `SIN_DECIDIR` (`EN_DOCUMENTO_SELLABLE`) y el trinquete pasa de 97 a 98 con nota fechada que cita c.22360. Nada más del guard.

Mutaciones de 1787l con `aplicarUna`: las dos VIVAS (base 7/7). Dirigida tras ③ (593c, 409, 497, 1787l, 1787d, 1779d, 523d, 291, 603b, 723, 222, 525d y 1294): 125 casos, 123 ok, 0 rojos, 2 saltados declarados (los gateados de 222). `guards:entrada` salida 0 (15 guards). `tsc -p .` salida 0, cliente regenerado en `node_modules` propio y guard ✔.

Fallo propio: al retirar la prueba de ③ mi edición se comió un salto de línea; lo cazó `git diff` y lo devolví antes del commit.

**NO medido:** la suite entera (no corrida: el encargo prohíbe los tramos; la corre el obligatorio); yaqu.app; staging y producción.
# SCRUM-1787k · La factura suelta acepta por línea la descripción y el descuento, con la función del camino desde presupuesto

**Medido contra:** `origin/main` = `ccb69008b5aaa80d3f7cb712be77ce025c146238` · 2026-11-21T21:55:47Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `tests/scrum1787k-suelta-con-descripcion-y-descuento.test.mjs`

Mutaciones: catálogo → `tests/scrum1787k-suelta-con-descripcion-y-descuento.test.mjs`

Decisiones: GO de regla 40 en SCRUM-1787 c.22338 ① («1-Sí»). Medición en c.22339. Confirmación del diseño en c.22341 («1-Ok precio final»): el descuento se aplica al precio, no se guarda y no se enseña.

## Qué se midió (1787k)

- La suelta sólo dejaba pasar `concept`, `qty`, `price`, `tax` y `causa` (`facturaSuelta.ts`, `validarFacturaSuelta`).
- En el presupuesto el descuento es la clave `dto`: un porcentaje de 0 a 100 con dos decimales como máximo (`src/core/validation/schemas.ts`). Se aplica al precio unitario antes del IVA con `precioConDto` (`src/core/utils/utils.ts`) y no se redondea en la línea: redondea `calcVatBreakdown`, por tipo.
- El camino desde presupuesto ya existía (SCRUM-887): `lineasParaFacturar` (`invoiceLines.service.ts`) aplica el `dto` al precio y quita la clave. `Invoice.lines` guarda el precio neto; `description` viaja.
- Desglose, huella y XML leen `qty`, `price` y `tax`. El PDF de factura ya pinta la descripción cuando va en el `concept` tras un salto de línea (`partirConceptoYDescripcion`). La ficha calcula con `importeDeLinea(qty, price, l.dto, tax)`: un `dto` guardado junto a un precio ya neto se aplicaría dos veces.

## Qué se construyó (1787k)

Un solo fichero de `src/`: `src/modules/invoicing/domain/facturaSuelta.ts`. La ruta `invoicesAdmin.routes.ts` no cambia.

- `validarFacturaSuelta` valida `description` y `dto` con los validadores de la línea del presupuesto, leídos de `CreateQuoteSchema` (`schemas.ts` es de S1 y no se toca). Ausente o `null`: la clave no viaja.
- Las líneas salen por `lineasParaFacturar({ lines, discountGlobalAmount: null })`, la misma función del camino desde presupuesto. Una línea sin `dto` sale siendo el mismo objeto que antes.
- Un `dto` o una `description` inválidos dan 400 `lineas_invalidas` con el mensaje YA servido de su campo («Cada línea necesita un precio válido.» y «Cada línea necesita un concepto.»). Ningún texto nuevo.
- No se construyó pintar el descuento (c.22341) ni se tocó el PDF ni la ficha: la descripción sale por el mecanismo que ya existía.

## El fallo propio (A9)

La primera versión devolvía como `message` el del validador del presupuesto, y para un descuento de 150 era de zod y en inglés («Too big: expected number to be <=100»): un texto que habría llegado a la pantalla sin firma. Lo vi imprimiendo los cuatro mensajes antes de empujar, no por un test. Ahora el caso ④ del test exige el mensaje ya servido de cada campo.

## Verde, con población (1787k)

- Rojo primero, con el código sin tocar: 5 casos, 3 caen (①, ② y ④) y los dos controles pasan. Con el cambio: 5 de 5.
- Dirigida (1779d, 1787b/d/e/h/k, 178, 290, 523d, 291, 603b, 723, 347, 389, 222, 525d, 729, 1763, 624y y los 14 ficheros que nombran la suelta): 36 ficheros, 322 casos, 316 pasan, 0 caen, 6 saltos.
- Emisión y árbol entero (165 ficheros que nombran la emisión, la suelta o el esquema del presupuesto, más 35 guards de árbol entero; 194 distintos, en dos comandos): 1.916 casos, 1.903 pasan, 0 caen, 13 saltos.
- `npm run guards:entrada`: salida 0. `tsc -p .` con tipos: salida 0.
- Mutaciones, con `aplicarUna` (arnés `docs/master/evidencias/SCRUM-1123f/arnes-mutaciones.mjs`): 2 de 2 vivas; `git status` vacío después y `dist/` con el código de vuelta.

## Para Luis (S2): el editor

Dos ficheros suyos, sin tocar aquí. El servidor ya acepta las dos claves; mientras el editor no las mande, nada cambia.

`public/dashboard/js/cuerpoDelDocumentoSuelto.js`, en `cuerpoDelDocumentoSuelto`:

```diff
-      lines.push({
+      var linea = {
         concept: concept,
         qty: Number(f.cantidad),
         price: Number(precioEscrito),
         tax: Number(f.iva) / 100,
-      });
+      };
+      var descripcion = String(f.descripcion == null ? '' : f.descripcion).trim();
+      if (descripcion) linea.description = descripcion;
+      var dtoEscrito = String(f.dto == null ? '' : f.dto).trim();
+      if (dtoEscrito) linea.dto = Number(dtoEscrito);
+      lines.push(linea);
```

`public/dashboard/js/quotesView.js`, modo suelto (tres sitios):

```diff
 // el campo del descuento, en los ajustes de la línea
-    if (!esDocumentoSuelto) ajustesCampos.appendChild(dtoTd);
+    ajustesCampos.appendChild(dtoTd);

 // al volver a pintar las líneas
-      const descripcion = esDocumentoSuelto ? undefined : l.description;
-      const dto = esDocumentoSuelto ? undefined : l.dto;
+      const descripcion = l.description;
+      const dto = l.dto;

 // al emitir
             precio: line.priceInput.value,
             iva: line.vatInput.value,
+            descripcion: line.descInput ? line.descInput.value : '',
+            dto: line.dtoInput ? line.dtoInput.value : '',
```

Tres cosas que el diff no resuelve y decide S2: el servidor quiere `dto` como NÚMERO con dos decimales como máximo (una cadena da 400); para que la descripción se VEA en el PDF y en la ficha tiene que ir además en el `concept` tras un salto de línea, como hace el presupuesto con «incluir descripción»; y el campo de la descripción hoy puede estar escondido en el modo suelto por otra línea que no he buscado.

## NO medido (1787k)

- La ruta montada: lo ejecutado es el validador y las funciones del dominio; el caso ⑤ LEE en el fuente que la ruta emite `val.lineas`.
- El navegador, ninguna base, el PDF generado con una descripción (lo cubren los tests de SCRUM-603, que no cambié) y la suite entera en local (la corre el obligatorio, por orden del orquestador).
- El suplido, el coste y el descuento global: fuera de este tramo.
- 🔴 `jv-j1hh` tiene en una rama local sin empujar (1787i, c.22344) otro cambio sobre `validarFacturaSuelta` y sobre la ruta: las dos ramas tocan el mismo fichero y quien entre segundo tendrá que unirlas a mano.

# SCRUM-1787j · `scrum728d` cuenta la transacción ENTERA de la emisión (relevo del ② de 1787g)

**Medido contra:** `origin/main` = `ccb69008b5aaa80d3f7cb712be77ce025c146238` · 2026-11-21T21:44:22Z

A9: aviso → cicatriz J6 «Fui a cambiar en local las cifras escritas a mano de un guard para medir la mutación antes de que llegara la firma que el encargo exigía, y me paró el clasificador de permisos» — no se pudo comprobar: lo paró el clasificador de permisos de la sesión, que no vive en el repositorio.

Mutaciones: catálogo → `tests/scrum728d-viajes-de-la-reserva.test.mjs`

Encargo del orquestador J (`cobroflash-backend-ba`) a J6 (`jv-j6fb`), el 21-nov-2026. Cifras firmadas por el fundador en SCRUM-1787 c.22343 («1-Ok sí»), a partir de la tabla de c.22340.

## El mudo, demostrado

Con el guard de `origin/main`, una lectura de más sembrada con `aplicarUna` en `crearFacturaEmitida.ts`, justo después de `congelarDireccionAlEmitir`, **no lo tumbaba**: 2 de 2 MUDAS, con 9 de 9 en verde con la mutación y sin ella (guion `docs/master/evidencias/SCRUM-1787/mutar-1787j.mjs`, sobre el commit `af6788de81501c3ec4d460ac7be0c14edd062a68`). La causa: el doble sólo se le pasaba a `allocateInvoiceNumber`, y `conElCreateDelLlamador` sumaba un `+1` fijo por el `invoice.create`.

## El arreglo (sólo `tests/`; nada en `src/`)

- `tests/_viajes-de-la-reserva.mjs`: el `tx` falso es un `Proxy`. **Cualquier** `tx.<modelo>.<método>` se apunta como un viaje; la lista de respuestas sólo decide qué devuelve. Un `tx.$…` que no sabe contar da `CensoCiego`.
- `espiarEmision`: en la F1 corre `emitInvoice` real; en la R1, `allocateInvoiceNumber` y luego `crearFacturaEmitida`, en el orden de la `$transaction` de `invoicesAdmin.routes.ts`. Exige exactamente un `invoice.create`. Se quita `conElCreateDelLlamador`.
- Caso nuevo `SCRUM-1787j · LO QUE LA EMISIÓN HACE DENTRO DEL CERROJO…`: las sentencias de la emisión menos las de la reserva (que tienen que ser su prefijo) se comparan con `DESPUES_DE_LA_RESERVA`, declarada sentencia a sentencia: F1 `customer.findFirst`, `invoice.create`; R1 `invoice.findFirst`, `invoice.create`.
- Cifras, con nota fechada que cita c.22343 (nada más del guard): F1 8 → 9, dentro del cerrojo 7 → 8, R1 7 → 8, caso ROJO 9 → 10 y 8 → 9.

Medido sobre esta rama: F1 = cerrojo · merchant.findUnique · invoice.findMany · merchant.update · auditLog.create · **customer.findFirst** · invoice.create (+ BEGIN/COMMIT = 9). R1 = cerrojo · merchant.findUnique · merchant.update · auditLog.create · **invoice.findFirst** · invoice.create (= 8). Es el precio que ya declaraba `direccionCongelada.ts`.

| aceptación (encargo) | dónde se ve |
|---|---|
| con una lectura extra en la tx de emisión, el guard de hoy NO cae | `docs/master/evidencias/SCRUM-1787/mutar-1787j.mjs` sobre `af6788de`: 2 de 2 MUDAS |
| con la lectura sembrada cae; sin ella, verde | catálogo de `tests/scrum728d-viajes-de-la-reserva.test.mjs` (una lectura en `crearFacturaEmitida`, otra en `emitInvoice`): 2 de 2 VIVAS; limpia 10/10; `git status` vacío después |
| el número se mide, no se elige | las cifras salen de `espiarEmision`; firmadas en c.22343 |

## NO medido (1787j)

- La mutación de `emitInvoice` contra el guard viejo (sólo pasé la de `crearFacturaEmitida`).
- En la R1 se reproduce el orden de la ruta: una tercera llamada dentro de esa `$transaction` no se vería.
- Los demás caminos que llaman a `crearFacturaEmitida` (desde presupuesto, albarán, parte) no se cuentan uno a uno.
- Los títulos de dos casos siguen diciendo «hace 8 viajes» y «hace 7». La firma dice «nada más del guard», así que no los he tocado.
- La suite entera en local: la corre el obligatorio (orden del orquestador).

# SCRUM-1787i · La factura suelta congela vencimiento y formas de pago, y la ficha pinta «Vence el» y «Formas de pago»

**Medido contra:** `origin/main` = `ccb69008b5aaa80d3f7cb712be77ce025c146238` · 2026-11-21T21:57:37Z

A9: comprobación → `tests/scrum525d-anclas-que-apuntan.test.mjs`

Mutaciones: catálogo → `tests/scrum1787i-vencimiento-y-formas-de-pago.test.mjs`

**Skill UI:** no cargada · jv-j1hk la cargó DESPUÉS de escribir la fila `Formas de pago` (la cazó `scrum811c` en `guards:entrada`), y revisó el cambio contra ella: una fila más con `addDefRow` en el bloque «Cobro» que ya existe, sin clases, estilos ni tokens nuevos. Del checklist AB6 no hay capturas ni matriz de dispositivos: no medidas.

Decisiones del fundador: SCRUM-1787 c.22325 ③ (GO de regla 40: recibir y congelar al emitir), c.22331 (guardar las formas de pago; «Vence el» por defecto a 30 días), c.22345 ① (literales firmados `Formas de pago` · `Tarjeta` · `Bizum` · `Transferencia`) y c.22349 (mover las tres expectativas de `scrum600e`). Carril J1. Construido por `jv-j1hh` (commits `59cdd240e` y `d0e4e00f1`, traspaso en c.22344) y terminado por `jv-j1hk`.

## El cambio

- `prisma/schema.prisma`: `dueDate` (`due_date`) y `payMethods` (`pay_methods`) en `model Invoice`, con el ALTER de `docs/sql/scrum-1787-vencimiento.sql` aplicado antes en dev (A y B; verificación en `docs/master/evidencias/SCRUM-1787/verificar-1787i.mjs`). Staging y producción los aplica el fundador.
- `facturaSuelta.ts`: el validador acepta `dueDate` (ausente, `null` o fecha) y `payMethods` con el conjunto del presupuesto (`CreateQuoteSchema.shape.payMethods`, sin segunda lista). Lo que no vale se rechaza antes de pedir número, con código y sin texto. `vencimientoDeLaSuelta`: ausente → expedición + 30 días.
- `invoicesAdmin.routes.ts` pasa los dos campos a `emitInvoice`, que los escribe en el mismo INSERT. Los demás orígenes escriben NULL.
- `invoiceDetailView.js`, bloque «Cobro»: `Vence el` con la fecha congelada, y `Formas de pago` con un literal firmado por cada forma congelada, separados por «, » como «Rectificada por» en el mismo bloque. Las dos filas solo salen si hay dato; una clave fuera del conjunto no se pinta en crudo.
- `tests/scrum600e-condiciones-contra-el-emisor.test.mjs`: sus tres expectativas escritas a mano dependían de que la factura no guardara formas de pago. Se cambian con la firma de c.22349 y una nota fechada en cada una: lo que sobrevive al emisor, `payMethods` como único campo de «3. Condiciones» con columna, y 3 campos en vez de 4 en ROJO ①. Nada más del guard.
- `docs/sql/deriva-prod.sql` se regenera con `scripts/generar-sql-deriva.mjs` (547 columnas). Las tres coordenadas de `docs/legal/AUDITORIA_CAMINO_EMISION.md` que movieron estas líneas se actualizan en su sitio, con nota fechada.

## Evidencia

- `tests/scrum1787i-vencimiento-y-formas-de-pago.test.mjs`: **11/11**. Rojo primero (jv-j1hh, c.22344): 8 de 9 contra el código sin tocar. Los dos casos ⑨ de `Formas de pago` los cae su mutación.
- Mutaciones con el `aplicarUna` de la casa (`docs/master/evidencias/SCRUM-1787/vencimiento/mutar.mjs`): **3 de 3 vivas** (emisión sin `dueDate` → ①; sin fila `Vence el` → ⑧; sin fila `Formas de pago` → ⑨). Después, `git status` solo con los cambios del ticket.
- Batería dirigida de c.22344 + 1787i (27 ficheros): 336 casos, 327 pass, 5 fail y 4 skip (gateados por QA_DB_TEST), y la suma da 336. Los 5 fail eran 222 (deriva), 525d (coordenadas) y 600e ×3; arreglados como se cuenta arriba y vueltos a correr en verde.
- Build con tipos (`tsc -p .`): salida 0.

## Error propio (A9)

Al actualizar las coordenadas de la auditoría escribí la nota de por qué se movían con los nombres de las columnas entre comillas invertidas, y `scrum525d` los leyó como testigos nuevos del ancla: un rojo más. Lo cazó el propio guard, y la nota quedó en prosa. Por eso la línea A9 apunta a ese test.

Segundo error: escribí la fila de la ficha sin haber cargado antes `yaqu-premium-ui`, que CLAUDE.md pide antes de tocar UI. Lo cazó `tests/scrum811c-skill-ui-declarada.test.mjs`, y queda declarado arriba como «no cargada». Ese guard pide que se declare, no comprueba el orden.

## NO hecho (espera decisión)

- Que el cobro de la factura herede `invoice.payMethods` (`invoiceWhatsApp.service.ts`). Sin eso, lo guardado todavía no cambia lo que ve el cliente al pagar.
- El editor que manda los dos campos (S2, Luis: `quotesView.js` / `cuerpoDelDocumentoSuelto.js`), el PDF y la página de pago.

## NO medido

- La ruta montada en `app`: el caso ⑦ la lee en el fuente; lo que se ejecuta es el validador y `emitInvoice` contra una transacción fabricada.
- La suite entera en local: la corre el obligatorio.
- El navegador y yaqu.app: se ven tras el merge y el despliegue. Staging y producción: no tocados.
- El texto de c.22349: lo cito por el mensaje del orquestador, no lo he leído en Jira.

## Merge con main (relevo jv-j1hm, 2026-11-23T03:20:10Z, sobre `origin/main` = `90e8e3774f86ff6ef393e7f25f0c6bdedb95765e`)

A9: comprobación → `tests/scrum1787k-suelta-con-descripcion-y-descuento.test.mjs`

El merge chocó con 1787k en `validarFacturaSuelta` y se juntaron las dos: las líneas salen por `lineasParaFacturar` (1787k) y el resultado lleva `dueDate` y `payMethods` (1787i); quitar una mitad en `dist/` tumba este test o `tests/scrum1787i-vencimiento-y-formas-de-pago.test.mjs` (sin 1787i: 4 caen; sin 1787k: 3 caen; base 16/16), mutación hecha una vez y sin guion en git, así que no cuenta como evidencia repetible.

## Segundo merge con main (relevo jv-j1ht, 2026-11-23T03:58:22Z, sobre `origin/main` = `d5bec9526fe9165e38598f6eb054d0717e788740`)

A9: comprobación → `tests/scrum525d-anclas-que-apuntan.test.mjs`

Tres conflictos con 1787l (#3308), los tres derivados. `prisma/schema.prisma`: en `model Invoice` se quedan las tres columnas (`dueDate`, `payMethods` de 1787i y `docFooterText` de 1787l), sin elegir lado. `docs/sql/deriva-prod.sql`: regenerado con `scripts/generar-sql-deriva.mjs` sobre el esquema unido (548 columnas). `docs/legal/AUDITORIA_CAMINO_EMISION.md`: anclas recolocadas en sitio (eslabón 4 → `schema.prisma:970-971`, eslabón 8 → `:1908`). Con la ancla vieja del eslabón 4 (963-964), 525d cae 1 de 8; con la nueva, 8 de 8; mutación hecha una vez y sin guion en git. Ninguna aserción cambia.

## Rojo de SCRUM-700 tras el merge de main `141baada` (relevo jv-j1hu, 2026-11-23T05:48:03Z, sobre `origin/main` = `141baada7559c8ab18bd9a572383a40d3d5b6164`)

A9: comprobación → `tests/scrum700-filtros-de-comentario.test.mjs`

El test ⑦ de 1787i limpiaba la ruta con un filtro propio (`.replace(/\/\/.*/, '')`) en vez del de la casa, y el censo de SCRUM-700 lo contó como el octavo filtro que ciega (run 45113237157, censo 7). Ahora usa `soloEjecutable` de `tests/_guard-texto.mjs` (`almohadillaEsComentario: false`, es TypeScript). El censo (7) no se toca (SCRUM-1787 c.22377). Verde: `scrum700` + `scrum1787i`, 16 de 16 en 2 ficheros. El fallo es del puesto: el filtro de la casa existía y el guard que lo exige también; lo cazó el guard en CI, que es su sitio.

# SCRUM-1787p · El cobro del envío por WhatsApp de la factura hereda sus formas de pago congeladas

**Medido contra:** `origin/main` = `d5bec9526fe9165e38598f6eb054d0717e788740` · 2026-11-23T03:59:03Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `tests/scrum1787p-cobro-hereda-formas-de-pago.test.mjs`

Mutaciones: catálogo → `tests/scrum1787p-cobro-hereda-formas-de-pago.test.mjs`

**GO:** SCRUM-1787 c.22362 («1-GO», flujo de cobro). Sesión jv-j1hs (J1). Rama `scrum-1787p-cobro-hereda-formas-de-pago`, nacida de 1787i (#3311, `a9b26ff4`) y con `origin/main` mergeado.

**Medición.** ① El cobro lo crea `sendInvoicePaymentRequest` (`src/modules/billing/domain/invoiceWhatsApp.service.ts`, J1) con un POST interno a `/charges`; antes solo le pasaba las formas del PRESUPUESTO de origen, así que una factura suelta (sin presupuesto) creaba un cobro sin selector y el cliente veía todas. ② Otros caminos: en `src/` hay dos `prisma.charge.create`, el de `/charges` (su único llamador por `fetch` es este servicio) y la liberación de la garantía de obra (`chargesAdmin.routes.ts`, nace PAGADO: no es un enlace de pago). Los tres que envían la factura (reenvío `invoicesAdmin.routes.ts`, aceptación pública `quotes.routes.ts`, `collect-rest` de `jobs.routes.ts`) llaman a este mismo servicio, y si la factura ya tiene cobro lo reutilizan. Correo y portal no crean cobro. ③ `charge.payMethods` y `quote.payMethods` aceptan el mismo conjunto (`card`, `bizum`, `transfer`), pero escrito DOS veces en `src/core/validation/schemas.ts` (S1): el cambio no añade una tercera, valida con `CreateQuoteSchema.shape.payMethods`, y el caso ⑦ del test cae si las dos listas divergen.

**Cambio.** Si `invoice.payMethods` pasa esa validación y no está vacío, el cobro nace con esas formas; si no, exactamente lo de antes (las del presupuesto o ninguna). Una forma fuera del conjunto no bloquea el envío: sale como antes. Sin texto nuevo, sin esquema, la página de pago (J2) no cambia.

**Merge con main.** Conflicto en `prisma/schema.prisma` con 1787l: se quedan las tres columnas de la factura (`dueDate`, `payMethods`, `docFooterText`); `prisma generate` en `node_modules` propio + guard ✔; `docs/sql/deriva-prod.sql` regenerado (548 columnas); anclas de `docs/legal/AUDITORIA_CAMINO_EMISION.md` recolocadas en sitio (970-971 y 1908).

**Error mío.** La segunda mutación salió MUDA con `aplicarUna`: había puesto la prioridad «la factura manda» en dos sitios (no leer el presupuesto si la factura tiene formas, y el orden del spread), y quitar uno no cambiaba nada. Lo dejé en un solo punto (`formasDelCobro`) y las dos mutaciones caen.

**NO medido:** la suite entera en local (la corre el obligatorio, por orden del orquestador) · navegador, yaqu.app, staging y producción · ningún envío real (Meta en `WHATSAPP_DRY_RUN`).

**Y un fallo mío encima (jv-j1hu):** empujé ese arreglo (`ad1a14ce0`) sin correr `tests/scrum719-el-suelo-de-los-doce.test.mjs`, y lo tumbaba dos veces: la llamada nueva a `soloEjecutable` no tenía suelo (SCRUM-1395 ②) y el test no tenía ficha en `tests/_veredicto-mudez.json` (SCRUM-1395b ①). Lo cacé en la rama de 1787m, antes de que lo dijera CI. Ahora es `ejecutableDe` con ancla `origen: 'C7-suelta'`, y la ficha sale de `npm run censo:mudez -- --escribir` (1 medido, VIVO). Coste: un segundo empujón a 1787i y a 1787p. El guard existía y el aviso también (cambiar un test que filtra = correr 719); falló correrlo, y eso ningún test lo puede obligar.

# SCRUM-1787m · El PDF de factura imprime «Vence el» y «Formas de pago» con lo congelado en la factura

**Medido contra:** `origin/main` = `d5bec9526fe9165e38598f6eb054d0717e788740` · 2026-11-23T04:01:47Z

A9: comprobación → `tests/scrum525d-anclas-que-apuntan.test.mjs`

Mutaciones: catálogo → `tests/scrum1787m-pdf-vence-y-formas-de-pago.test.mjs`

Decisión del fundador: SCRUM-1787 c.22338 ③ («3-GO», regla 40: el PDF de factura muestra «Vence el» y las formas de pago). Literales firmados: `Vence el` (c.22325 ①) y `Formas de pago` con `Tarjeta` · `Bizum` · `Transferencia` (c.22345 ①), los mismos de la ficha. Carril J1. Construido por `jv-j1hp` sobre la rama de 1787i (`a9b26ff40`, PR #3311), que trae las columnas.

**Qué cambia**

- `src/modules/invoicing/infra/pdf/pdf.service.ts`, solo `generateInvoicePdf`: dos parámetros nuevos y obligatorios (`dueDate` y `payMethods`; un llamador que no los pase no compila) y dos líneas en la cabecera, a la derecha, debajo de `Fecha:`. `Vence el dd/mm/aaaa` usa la misma función de fecha que `Fecha:` (el día en la zona del negocio, SCRUM-1470c) y solo sale si la factura tiene vencimiento. `Formas de pago: Tarjeta, Bizum` nombra cada forma congelada, en su orden, y solo sale si queda alguna conocida: una clave que no sea `card`, `bizum` o `transfer` no se pinta. `generateQuotePdf` no se toca.
- Los llamadores: medido, hacía falta. `generateInvoicePdf` no recibe la factura sino sus campos sueltos, así que los tres llamadores (dos en `src/lib/invoicing.ts` y el de regenerar en `invoicesAdmin.routes.ts`, los tres de J1) pasan `dueDate` y `payMethods` de la fila de la factura. Nada sale del comercio ni del presupuesto (regla 29).
- `tests/_cambios-autorizados-de-la-factura.mjs`: una entrada con las huellas de `docs/master/evidencias/SCRUM-1446d/huellas.mjs` y la cita de c.22338. Ningún número escrito a mano.

**Cómo se ve que una factura sin estos datos sale igual**

`docs/master/evidencias/SCRUM-1787/pdf-vence/lineas.mjs` fabrica la misma factura y da la huella de sus líneas (texto y posición). Sin vencimiento ni formas de pago: 15 líneas y huella `5a4ceaa8c7689611829f3249539428f656aac98a77e67be1d7ac4f61d4eeb009` antes del cambio y después. Con los dos datos: 17 líneas. El caso ⑤ del test lo sujeta dentro del código nuevo (ausentes, `null`, lista vacía y clave desconocida dan las mismas líneas); la comparación contra el código anterior es la de ese guion, hecha una vez. El PDF fabricado con los dos datos está en `docs/master/evidencias/SCRUM-1787/pdf-vence/1787m-con-datos.pdf` y se leyó: las dos líneas salen bajo `Fecha:`, sin pisar el emisor.

**Medido**

- Rojo primero: con el test escrito y el código sin tocar, 7 de 8 caían. Uno de los siete (⑦, el control del presupuesto) caía por un error del propio banco y no por el defecto: ver abajo.
- `tsc -p .` con tipos: salida 0. `node_modules` propio, `prisma generate` y guard del cliente ✔.
- Dirigida del encargo (19 ficheros, cada prefijo con al menos uno: 1787m, 1787i, 1787d, 1788a, 1779d, 178, 290, 523d, 291, 603b, 723, 347, 525d, 1157, 1215, 1415, 262): 147 casos, 145 pasan, 0 caen, 2 saltos; 145 + 2 = 147.
- Mutaciones con el `aplicarUna` de la casa (`docs/master/evidencias/SCRUM-1787/pdf-vence/mutar.mjs`): 2 de 2 vivas (sin la línea del vencimiento cae ①; sin la de las formas de pago cae ③). Después, `git status` solo con los cambios del ticket.

**Errores míos (A9)**

- Añadí una línea nueva en el primer llamador de `src/lib/invoicing.ts` y moví de la 267 a la 268 la puerta que cita `docs/legal/AUDITORIA_CAMINO_EMISION.md`. Lo cazó `tests/scrum525d-anclas-que-apuntan.test.mjs`. Se arregló en el código: los dos campos van en la línea que ya existía y el documento no se toca.
- Declaré el diccionario de literales fuera de la función y cambió el ámbito que vigila `scrum723`. Se metió dentro de `generateInvoicePdf`; la lista declarada del guard no se toca.
- El banco del control ⑦ fabricaba un presupuesto con una sola opción y el esquema pide tres: el caso caía por su propio suelo (CIEGO), no por el defecto. Corregido antes del cambio.

**NO medido**

- Los tramos de emisión de la suite y la suite entera en local: los corre el obligatorio (orden del orquestador del 23-nov).
- Los 2 saltos de la dirigida, gateados por base de datos.
- Captura en PNG: el navegador de la sesión bloquea `file:`. Queda el PDF fabricado.
- Los tres llamadores con una factura real: se leyó el fuente (caso ⑧), no se emitió ni se regeneró ninguna. Navegador, yaqu.app, staging y producción.

**Merge con la rama de 1787i ya al día (`cf9f6e1c9`, con main `d5bec9526` y 1787l dentro)**

Cuatro conflictos, los cuatro con 1787l (#3308, Observaciones) y resueltos con los dos lados: el tipo de `generateInvoicePdf` lleva `docFooterText` y, detrás, `dueDate` y `payMethods`; los dos llamadores en conflicto pasan los tres campos; y el catálogo de cambios autorizados lleva la entrada de 1787l y, detrás, la de 1787m. Las huellas de la entrada de 1787m se volvieron a sacar con `huellas.mjs` después del merge: su `de` es ahora el `a` de 1787l. Las cifras de «Medido» de arriba (147 casos, la huella de 15 líneas) son de antes del merge, contra `90e8e377`; lo que se repitió después está en el comentario de entrega de Jira. El párrafo «Segundo merge con main» de 1787i, que git dejó detrás de este tramo, se devolvió a su sitio sin cambiarle una letra.

## Rojos de SCRUM-586 y SCRUM-836 tras el merge de main `141baada` (relevo jv-j1hu, 2026-11-23T05:54:28Z, sobre `origin/main` = `141baada7559c8ab18bd9a572383a40d3d5b6164`)

A9: comprobación → `tests/scrum836-ancla-de-mutacion-viva.test.mjs`

Mutaciones: catálogo → `tests/scrum586-forma-de-pago-por-cliente.test.mjs`

Run 45113232031 (#3316). **586** (`payMethods` NO llega al PDF) prohibía la palabra en todo el camino del PDF, y 1787m la metió a propósito. Decisión del fundador, SCRUM-1787 c.22377 (regla 41): se distingue `invoice.payMethods` (congelado al emitir; GO c.22338 ③) de `quote.payMethods` y de la preferencia del comercio, que siguen prohibidas. El test ⑧ ahora lo mide por AST: fuera de `generateInvoicePdf` la palabra sigue a cero en los cinco ficheros, y dentro sólo vale `params.payMethods` o su firma. Caso nuevo: cada llamada a `generateInvoicePdf` de `src/` (población derivada; 3 hoy) pasa `<x>.payMethods` del mismo objeto que da `merchantCriterioCaja`, columna que sólo tiene la factura. Nota fechada en el test que cita c.22377. Tres mutaciones nuevas en su catálogo (⑦ el PDF recibe las del presupuesto en `src/lib/invoicing.ts`, ⑧ la del comercio en `invoicesAdmin.routes.ts`, ⑨ el PDF del presupuesto las pinta): con `aplicarUna`, 9 de 9 VIVAS. **836**: la mutación de `scrum1240d` sobre `src/lib/invoicing.ts` llevaba un `de` que 1787m cambió (puso `dueDate` y `payMethods` en esa línea para no mover el ancla :267 de la auditoría). Se reancla al texto nuevo; muta lo mismo (`inv.merchantCriterioCaja` → `inv.merchant.criterioCaja`) y promete lo mismo: con `aplicarUna`, 5 de 5 VIVAS. Las de 1787m, 2 de 2 VIVAS. `git status` sin cambios en `src/` tras cada pasada. Verde: 12 ficheros (700, 586, 836, 1240d, 1787m, 1787i, 603b, 723, 523d, 291, 1294, 745), 128 de 128. El fallo es del puesto: los dos rojos los dio CI y no una tanda local antes del empujón de 1787m; si allí se corrieron 586 y 836, no lo he medido.

# SCRUM-1787n · La lista de facturas con las columnas, el orden y los rótulos de la lista de presupuestos

**Medido contra:** `origin/main` = `d5bec9526fe9165e38598f6eb054d0717e788740` · 2026-11-23T03:55:05Z (cabecera `Date:` de `gh api -i zen`)

A9: aviso → A10 «Una operación que no se ejecutó se lee exactamente igual que un éxito.» — no se pudo comprobar: el guion de capturas leía la fase de un global (`globalThis.__fase1787`) que el MCP de Playwright no conserva entre llamadas; la pasada «después» salió con nombre «antes» y pisó las fotos ANTES sin dar error. Lo cacé al ver el nombre en la salida, recuperé las ANTES del commit `b4c2cb610f6168a92eba7d9144bfa6d38d6442e0` y el guion ahora deduce la fase de lo que pinta (rótulo «Importe»); un test no puede obligar a un guion de evidencias a no depender de estado del MCP.

Mutaciones: catálogo → `tests/scrum1787n-lista-de-facturas-como-presupuestos.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`); de `DESIGN.md` y la Parte AB solo consulté lo que uso (clases ya existentes: `cell-date`, `cell-amount`, `cell-id`, `cell-status`; ningún token nuevo), no los leí enteros.

**La orden:** SCRUM-1787, descripción («igual, o solamente lo estrictamente necesario diferente, que presupuestos»); clasificación en c.22301 fila 10: diferencia necesaria, sólo el número de serie (art. 6.1 a).

## Columna a columna (antes → después)

| presupuestos (`quotesListView.js:156-163`, S2, sólo leído) | facturas antes (`invoicesView.js:491-498`) | facturas después |
|---|---|---|
| — | casilla del lote | casilla del lote (se QUEDA: es una función) |
| ID | Nº factura | Nº factura (`rotulosDelDocumento.columnaNumero()`; NECESARIA) |
| Cliente | Cliente | Cliente |
| Fecha (dd/mm/aa, hh:mm; visible en móvil, `cell-date`) | Total | Fecha, con la clase y el formato de presupuestos |
| Importe | Estado | Importe (rótulo de `quotesListView.js:159`) |
| Estado | Fecha (solo escritorio, dd/mm/aaaa) | Estado (los de la factura, Parte L: sin cambios) |
| Método | — | Método (`paidVia` con `etiquetaMetodoCobro`, la etiqueta de la ficha `invoiceDetailView.js:309-310`; sin cobro, «—» como presupuestos) |
| Etiquetas | Etiquetas | Etiquetas |
| Acciones | (cabecera vacía) | Acciones (rótulo de `quotesListView.js:163`) |

Dato de la API: `paidVia` ya viaja (`GET /admin/invoices` devuelve la fila entera, `invoicesAdmin.routes.ts:84-97`). Nada en `src/`. Ningún texto nuevo: los cuatro rótulos son los que ya sirve `quotesListView.js`, y el del método, `paidViaEtiquetas.js`.

## Lo que se queda distinto, y por qué

- La casilla del lote: función (marcar pagadas en bloque), orden del encargo. La miran scrum845 y el control ④ del test.
- «Ver detalle» con `btn-ghost` (presupuestos lleva `btn-secondary`): lo exige `tests/scrum1562g-facturas-con-teclado.test.mjs` («pesa como mirar, no como actuar», SCRUM-1562 c.21125). Regla 41: no se toca. Si el fundador lo quiere igual, es decisión sobre 1562.
- «hace N días» bajo el número en las pendientes (A18.2): se deja; es dato de cobro. Pregunta abierta abajo.
- Los estados (Parte L).

## Escritorio: el corte de línea

Con una columna más, a 1280 px el número de serie, el importe, la fecha y la píldora de estado se partían en dos líneas («PENDIENT/E», «F2026-/0010»). Bloque J1 en `public/dashboard/css/styles.css`, junto al de 1787b: `.j1-fac-lista` con `white-space:nowrap` en esas cuatro celdas. Sin tokens nuevos.

## Anclas que el cambio dejó viejas (tests de tickets J1 sobre este fichero)

- `tests/scrum1756j-panel-j1-sin-style-en-linea.test.mjs:100`: el «ahora» de `j1-fac-col-total` pasa de «Total» a «Importe». Sigue exigiendo la clase en lugar del `style=`.
- `tests/scrum1562g-facturas-con-teclado.test.mjs:39`: la mutación «la tabla cuadra» quita `<th>Acciones</th>` en vez de `<th></th>`. Verificada VIVA.

## Evidencias

`evidencias/SCRUM-1787/1787n-listas-{antes,despues}-{escritorio,movil}.png` (presupuestos a la izquierda, facturas a la derecha). Guion `evidencias/SCRUM-1787/guion/capturas-1787n.js`: `public/` de este árbol servido con `guion/servidor-estatico.mjs 5789`, `serviceWorkers: 'block'`, `/admin/*` contestado por el guion con datos de EJEMPLO; 0 peticiones fuera de 127.0.0.1:5789; las únicas escrituras, `POST /admin/entorno` del arranque del panel, contestadas por el guion. Cabeceras leídas del DOM en cada pasada. Las cuatro fotos, miradas.

## Test y mutaciones

`tests/scrum1787n-lista-de-facturas-como-presupuestos.test.mjs` pinta las DOS listas en `_banco-vistas.mjs` y compara (no copia la referencia). Antes del cambio: 3 rojos (①②③) y el control ④ verde; después, 4/4. Con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`: sus 3 mutaciones VIVAS y las 5 de 1562g VIVAS; árbol limpio después (`git status`).

Dirigida (50 ficheros: los que nombran `invoicesView` + 283, 600d, 1562g, 1773, 836, 719, 1294, 267, 273, 525d, 854): ver la entrega en Jira con su recuento.

## NO medido

- La suite entera: la corre el obligatorio (orden del orquestador).
- 710b, 1157/1215/1415, 700 y la tanda de guards de navegador: no corridos.
- yaqu.app: no verificado (no está desplegado).
- Tablet y Android/iPhone reales (matriz AB6): sólo 1280 y 390 px en Chromium.
- El nombre del cliente aún se parte en dos líneas en escritorio cuando es largo (texto libre, igual que en presupuestos con menos ancho).

## Para el fundador ✅/❌

1. ¿«Ver detalle» con el mismo peso que en presupuestos? Hoy lo impide 1562g (firma de c.21125).
2. ¿Se quita «hace N días» bajo el número de la factura pendiente, para que sea igual que presupuestos?
# SCRUM-1787o · «Enviada» de la ficha de factura sabe también del envío por correo

**Medido contra:** `origin/main` = `d5bec9526fe9165e38598f6eb054d0717e788740` · 2026-11-23T03:50:55Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `tests/scrum1787o-enviada-tambien-por-correo.test.mjs`

**Skill UI:** cargada

Mutaciones: catálogo → `tests/scrum1787o-enviada-tambien-por-correo.test.mjs`

Encargo del orquestador J a jv-j1hr. Defecto medido por jv-j1gy en c.22312. Medición previa en SCRUM-1787 c.22364. Literal «Enviada» firmado en c.22303 ③: no hay texto nuevo.

## Qué se midió (1787o)

- La ficha decidía «Enviada» solo con el WhatsApp (`waDelivery.status` y `envioDocumento.whatsapp`, `public/dashboard/js/invoiceDetailView.js`).
- Todo correo de factura pasa por `sendInvoiceEmail` (`src/modules/messaging/domain/email.service.ts`, carril S1, solo leído), que deja una fila en `email_messages` por intento con `relatedType: 'invoice'` y `relatedId` = la factura: el automático al cobrar (`psp.routes.ts`), MercadoPago (`mpWebhook.routes.ts`) y el botón manual (`invoicesAdmin.routes.ts`). El evento `emailed` de `correoDeFacturaEnviado.ts` solo lo escribe psp: no ve el envío manual.
- El GET de la ficha no devolvía ese dato. La tabla y su índice `(relatedType, relatedId)` ya existen: sin esquema.

## Qué se construyó (1787o)

- `correoDelDocumentoSalio` en `src/modules/billing/domain/envioDelDocumento.ts`: cuentan `aceptado_sin_confirmacion`, `aceptado_sin_identificador`, `entregado` y `reclamado`; no cuentan `fallo_envio` ni `rebotado` (igual que el WhatsApp que Meta marca fallido después), ni un estado fuera del embudo.
- `GET /admin/invoices/:id` devuelve `correoEnviado`, leído de las filas de esa factura con `merchantId` (regla 2). Solo lectura; la emisión no se toca.
- La línea de progreso marca «Enviada» si salió por WhatsApp O por correo.

## El fallo propio (A9)

Mi primer driver de `aplicarUna` le pasó a `correr` la ruta con `tests/` delante: la pasada limpia salió 0 pasados y 1 caído, y las dos mutaciones salieron CIEGAS, no verdes. El propio instrumento lo dijo. Además mi primera regex del test ② cortaba en la llave de `{ id: req.merchantId }` y daba un rojo falso con el código ya escrito. Ninguno de los dos generaliza más allá de lo que el instrumento ya caza.

## Verde, con población (1787o)

- Test nuevo: rojo visto antes del código (4 de 6 caen; los 2 controles en verde), después 6/6.
- Mutaciones con `aplicarUna` (limpia 6/6): las dos tumban su test.
- Dirigida antes del merge con main: 115 ficheros, 1021 casos, 1014 pass, 6 skip, 1 fail (scrum854, que pedía este tramo).
- Build con tipos antes del merge: salida 0. Después del merge: 2 errores, los dos por `Invoice.docFooterText` (columna de 1787l que trajo main) que el cliente de Prisma compartido no tiene; `_prisma-client-guard.mjs` lo nombra. No regenero: mi `node_modules` cuelga del compartido (A1).

## NO medido (1787o)

- La suite entera NO la corrí: no me cabía en el contexto (aviso al orquestador a 185k; OK suyo para empujar y que la corra el obligatorio).
- Ninguna fila real de `email_messages`: nada contra staging ni producción. Que Resend reescriba `aceptado_*` a `rebotado` lo leí en `registroDeEnvios.ts`, no lo vi pasar.
- El handler del GET se comprueba leyendo el fuente, no corriéndolo (pediría base): si alguien sacara la llamada del handler, el test ② lo caza; si la consulta devolviera filas de otra factura, solo lo cazaría el texto del `where`.
- Ni capturas ni guards de navegador: el cambio no toca CSS ni textos.

# SCRUM-1787r · Prueba en STAGING: «Vence el» sí, «Formas de pago» no (la pantalla no las manda)

**Medido contra:** `origin/main` = `4d408128ddd116764359d286918e759247189fd7` · 2026-11-23T09:01:48Z (cabecera `Date:` de `gh api -i zen`)

A9: aviso → cicatriz J1 «Le pasé a Playwright MCP un fichero con el secreto del login de test de staging dentro (`filename`), creyendo que así no salía en el chat; la herramienta devuelve el código que ejecuta y el secreto quedó en el transcript, y hubo que pedir rotarlo» — no se pudo comprobar: la salida de una herramienta MCP no pasa por ningún guard del repositorio, y un filtro por el valor de las variables `*_SECRET` sería un hook de sesión, que no es de este puesto

**Orden:** SCRUM-1787 c.22390 punto 2 («2-Que lo pruebe una sesión»). Sesión jv-j1hx (J1), solo docs. Comentario de entrega: c.22398. **Lo medido es STAGING** (`yaqu-staging-production`, `/health` = `4d408128…`, que contiene `0b2f6451a`), **no yaqu.app**: el login de test solo existe en staging. Cuenta QA (comercio id 2). Turno de `railway` tomado a las 09:02:59Z y soltado a las 09:09:06Z. Flags del comercio leídos antes y después y sin tocar: override `INVOICING_ES_ENABLED=true`, `SIF_ENABLED=false`.

**Qué se hizo.** Desde el panel (Nueva factura → Cliente → Conceptos → Revisar y emitir) se emitió F260004 (id 1979): cliente «Cliente QA sin avisos» (id 3936, sin teléfono ni correo) y una línea de 100 € + 21 %. Respuesta 201, `veriFactu:false`. Durante la emisión solo hubo `POST /admin/invoices`, `GET /admin/invoices/1979` y `GET /admin/team`: ningún envío.

| qué | resultado |
|---|---|
| Ficha · «Vence el» | ✅ «23 dic 2026»; `dueDate` 2026-12-23T09:06:14Z = `createdAt` + 30 días |
| Ficha · «Formas de pago» | ❌ no sale: `payMethods = null` |
| PDF (texto extraído con `tests/_texto-del-pdf.mjs`, 16 líneas) | ✅ «Fecha: 23/11/2026» y «Vence el 23/12/2026» · ❌ sin «Formas de pago» |
| Página pública de pago | página de pago no vista: exige pulsar Enviar por WhatsApp |
| Control: F260003 (21-nov, anterior a 1787i) | ✅ sin «Vence el» ni «Formas de pago»: la columna COBRO no se pinta |

**Hallazgo.** Hoy ninguna factura emitida desde la pantalla lleva formas de pago. 1787i las congela solo si el cuerpo las trae (`facturaSuelta.ts:230`), sin defecto, y el editor que las manda es la parte de S2, pendiente: el editor de staging no tiene paso «Condiciones». El comercio QA tiene IBAN y móvil Bizum, y no tiene Connect. El defecto «las del comercio» es 1787s (GO en c.22397).

**Página de pago.** El cobro de una factura suelta solo lo crea `sendInvoicePaymentRequest` (`POST /admin/invoices/:id/resend-whatsapp`): sin teléfono corta antes de crear el cobro, y con teléfono intenta el envío. El orquestador decidió no enviar. #3323 (1787q, «Vence el» en la página de pago) estaba OPEN cuando medí staging (09:01Z) y se mergeó a las 09:04:00Z (`mergedAt` de GitHub). No he medido si staging lo sirve ya.

**Evidencias** (`docs/master/evidencias/SCRUM-1787/1787r/`), revisadas una a una:
- `01-ficha-1280.png`: ficha de F260004, COBRO · «Vence el 23 dic 2026», sin formas de pago.
- `02-ficha-390.png`: la misma ficha a 390, centrada en CLIENTE/COBRO. La primera toma la tapaba el aviso «Hay una versión nueva de YaQu» y la rehice.
- `03-F260004.pdf`: el PDF (2.376 B).
- `04-control-F260003-1280.png`: F260003 sin columna COBRO.

**Errores míos.** ① El secreto del login de test de staging quedó en el transcript local de mi sesión, por la cicatriz de arriba. No está en git, Jira ni ningún fichero comiteado, y se ha pedido al fundador que lo rote. ② Crucé los 200k (200.250) con un tope de encargo de 180k: cicatriz J1 del 23-nov.

**NO hecho / NO visto:** yaqu.app; la página de pago; una imagen del PDF renderizado (Chromium sin interfaz no pinta PDF); la segunda factura por API con `payMethods`, que autorizó el orquestador y DENEGÓ el clasificador de permisos antes de ejecutarse (no se emitió nada); los logs de staging (dry-run de WhatsApp). La suite entera no la he corrido: cambio solo de docs; corrí `guards:entrada` y la corre el obligatorio.

# SCRUM-1787q · La página de pago de la factura dice «Vence el» y la fecha

**Medido contra:** `origin/main` = `0b2f6451af74f2142cf27e18c9a4c42fb56c1e65` · 2026-11-23T08:20:48Z (cabecera `Date:` de `gh api -i zen`)

A9: sin fallo que generalice — el único tropiezo fue un guion de evidencias copiado con `sed` que conservó en su comentario de uso la ruta del de 1787h; lo vi al leer la salida y lo corregí antes de correrlo. La premisa errónea del encargo («el mismo formato de fecha que la página ya usa»: la página de pago no pintaba ninguna fecha) se dice abajo, no es un fallo del puesto.

**Skill UI:** cargada

Mutaciones: catálogo → `tests/scrum1787q-pago-vence-el.test.mjs`

Encargo del orquestador J a jv-j2dv (J2). Literal «Vence el» firmado en SCRUM-1787 c.22325 ①; ya lo pintan la ficha (1787i) y el PDF (1787m). Lectura de la factura en la página de pago: la de 1787h (c.22334). No hay texto nuevo.

## Qué se construyó (1787q)

- `payInvoice.routes.ts` (J2): la consulta de la factura del cobro (ya filtrada por `chargeId` y `merchantId` del cobro desde 1787h) lee también `dueDate`. Si consta, debajo de la referencia («Reparación de bajante · Factura F-…») va `Vence el <fecha>` con la misma clase `subline`. Sin `dueDate`, o sin factura, no se pinta nada. Nunca se lee del presupuesto. Sin CSS nuevo, sin `style=` ni manejadores en línea (CSP de 1723/1773).
- **Formato de la fecha.** El encargo pedía «el mismo formato que la página ya usa», y la página de pago NO pintaba ninguna fecha (medido: `grep` de `toLocaleDateString`/`DateTimeFormat` en el fichero, 0). Se tomó el de la otra página pública de la misma familia, el recibo (`receipt.routes.ts`, «Pagado el …»): `es-ES`, día de dos cifras, mes largo, año, en la zona del negocio (`zonaDelMerchant`). Sale «Vence el 21 de diciembre de 2026». La ficha usa mes corto («21 dic 2026») y el PDF `21/12/2026`: son tres formatos para la misma fecha, y aquí se eligió el de la página pública hermana.

## Evidencias (1787q)

- Capturas con datos de EJEMPLO, código real, en local, sin base: `docs/master/evidencias/SCRUM-1787/pago-vence/movil-390.png` y `escritorio-1280.png`, servidas por `pago-vence/servir.mjs`. Miradas: la línea sale centrada, en gris de `subline`, entre la referencia y la tabla de líneas; sin desbordes a 390 px.
- Mutación por el `aplicarUna` de la casa: `docs/master/evidencias/SCRUM-1787/pago-vence/mutar.mjs`. Quitar `${venceHtml}` tumba el caso «una factura con vencimiento» (`ok: true`) y también el de la zona (1 colateral); el árbol quedó igual después (`git diff --stat` comparado antes y después).

## Test (1787q)

`tests/scrum1787q-pago-vence-el.test.mjs`, ruta real contra dobles: ROJO 2 de 5 antes del cambio (los dos que piden «Vence el»), VERDE 5 de 5 después. Casos: con `dueDate` sale «Vence el 21 de diciembre de 2026» dentro del bloque del importe y una sola vez; en `America/New_York` sale el 20 (zona del negocio); sin `dueDate` (null y ausente) o sin factura, no sale, con positivo de que la factura sí se leyó; la factura de OTRO comercio con el mismo cobro no presta su vencimiento; un token que no es de ningún cobro da 404 sin fecha ni número.

## NO medido (1787q)

- En yaqu.app: no visto; se ve tras el merge y el despliegue, con una factura suelta emitida después de 1787i (las anteriores tienen `dueDate` NULL y no enseñan nada, como debe ser).
- Cuántas facturas reales llevan `dueDate`: nada contra staging ni producción.
- El correo y el recibo no se tocan; el recibo no dice «Vence el» (ya está pagado).

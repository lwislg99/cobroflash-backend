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

Los dos fallos que cubre: (jv-j1gz) el código se escribió ANTES del test rojo; el rojo se sacó después con las dos mutaciones del catálogo pasadas por `aplicarUna`, y el meta-guard es lo que dice MUDA si una mutación declarada no tumba su test. (jv-j1hb) el catálogo heredado declaraba `buscar`/`poner` en vez de `de`/`a`, y `cae: '①'`; `aplicarUna` lo devolvió CIEGO («el ancla no está…: la declaración caducó») sin mutar nada.

Mutaciones: catálogo → `tests/scrum1787d-direccion-y-nif-en-factura.test.mjs`

Decisiones: GO del PDF y literales `NIF` / `Dirección` en c.22303, cuya respuesta literal es «1-Sí GO · 2-Ok sí · 3-Firmo · 4-Sí»; guardar la dirección, c.22305; ALTER aplicado en staging y producción y el albarán sin dirección, c.22311. Vía J1 pura (orquestador J): `crearFacturaEmitida` lee la dirección DENTRO de su transacción (`direccionCongelada.ts`, filtrando por `merchantId`); el albarán, `congelarCliente` y los 7 llamadores de S1 no cambian. La R1 hereda la dirección de su original (NULL si es anterior). Las facturas ya emitidas se quedan sin dirección (regla 29).

## Hecho

- Esquema: 5 columnas `customerBilling*` en `Invoice`. ALTER en dev aplicado por jv-j1gz (`yaqu_dev_javier`, 5 filas `text`/`YES`); staging y producción, el fundador (c.22311).
- PDF de factura: `NIF:` y `Dirección:` desde las columnas de la factura, en sus 3 llamadores (`src/lib/invoicing.ts` x2, `invoicesAdmin.routes.ts`).
- Huellas: `docs/sql/deriva-prod.sql` regenerado con `scripts/generar-sql-deriva.mjs` (545 columnas). 603b/723: DOS pares en `tests/_cambios-autorizados-de-la-factura.mjs` con firma c.22303, salidos de `docs/master/evidencias/SCRUM-1446d/huellas.mjs`: uno con la base en main sin 1788a y otro con la base en 1788a (PR #3301, sin mergear al medir), porque la rama lleva 1788a dentro y cualquiera de los dos puede entrar primero.
- `CAMPOS_DIRECCION_CONGELADOS` declarado en `tests/_huerfanos-declarados.mjs` como `VOCABULARIO_DEL_MODULO`, igual que `CAMPOS_CONGELADOS` y `CAMPOS_CONGELADOS_EMISOR` (scrum411).
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

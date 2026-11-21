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

# SCRUM-1787h · La página de pago de la factura enseña sus líneas, como la del presupuesto

**Medido contra:** `origin/main` = `8de57b45ac4b20bfe14c1d54b37ea47cadc02a32` · 2026-11-21T19:46:21Z

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

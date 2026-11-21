# SCRUM-1780

## SCRUM-1780a · Qué ruta serviría hoy para «+ Nueva factura» desde un parte firmado (medición, solo lectura)

**Puesto:** J1 (jv-j1fz) · **Rama:** `scrum-1780a-factura-desde-el-parte-medida` · 20-nov-2026
**Medido contra:** `origin/main` = `7f5ea0138d9c7ca683ec903114940cff37613a60` · 2026-11-20T17:39:27Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J1 «Mi censo de quién llama a `emitInvoice` contó la DEFINICIÓN como una llamada (5 en vez de 4) y un comentario como una escritura de `estado` en el parte; lo vi al leer la salida línea a línea, no por ningún control» — no se pudo comprobar: un censo de un solo uso no pasa por ningún guard del repositorio

Solo docs. `src/`, `public/` y `prisma/schema.prisma` se LEEN (reglas 38 y 40); nada contra staging ni
producción. La pantalla del parte es de S2/S4 (Luis): aquí se dice dónde iría el botón, no se toca.
El literal («+ Nueva factura») lo propone el ticket y lo firma el fundador (regla 39).

**Cómo se midió.** Leyendo el código de `origin/main` (árbol a 0 commits de main) y con el censo
`docs/master/evidencias/SCRUM-1780/censo-rutas-factura.mjs` (lee `src/`, sin base ni red; sale 2 si
falta un control positivo). Su salida, en `censo-rutas-factura.salida.txt` del mismo directorio:
población 368 ficheros `.ts`, cuatro controles positivos presentes. **NO medido:** no se ejecutó
ninguna ruta (ni `dist/` ni banco local: el encargo lo pedía y lo dejé fuera por presupuesto de
contexto; todo lo de abajo es «leído en el código», no «ejecutado»); no se releyeron SCRUM-915, 1097
ni 1732 c.22216 en Jira — se citan por lo que dice la descripción de SCRUM-1780.

### ① Rutas que HOY crean una factura a partir de algo que no es un presupuesto

| ruta | qué recibe | qué factura sale | ¿crea `Charge`? | gate |
|---|---|---|---|---|
| `POST /admin/albaranes/:id/facturar-parcial` (`albaranes.routes.ts:1340`) | un **`Albaran`** firmado y valorado + líneas/cantidades | F1 vía `emitInvoice`, origen `C7-parcial` (`:1421`), libro `AlbaranLineaFacturada` en la misma tx | no | `getEmissionMode(merchant) === 'receipt'` → 409 `facturacion_no_disponible` |
| `POST /admin/albaranes/:id/convertir-en-factura` (`albaranes.routes.ts:1537`) | un **`Albaran`** | F1 vía `emitInvoice`, origen `C7-albaran` (`:1703`) | no | igual (`receipt` → 409) |
| recapitulativa (`recapitulativa.service.ts:109`) | albaranes del mes | F1, origen `C7-recapitulativa` | no | — (no leído en esta tanda) |
| `POST /admin/invoices` (`invoicesAdmin.routes.ts:116`), **factura suelta** | `customerId` + `lines[{concept,qty,price,tax}]` (`facturaSuelta.ts`) | F1 vía `emitInvoice`, origen `C7-suelta`, `quoteId: null`, **sin trabajo ni parte** | no | `modoDocumentoSuelto(merchant) === 'no'` → 409 |

Censo: `emitInvoice(tx, …)` tiene **4** llamadas y ninguna de las cuatro está en un fichero que cree
`Charge` (los dos `charge.create` viven en `billing/`). Las de presupuesto (`quotesAdmin` invoice /
invoice-manual y `jobs.routes.ts` collect-rest) no pasan por `emitInvoice` (usan `crearFacturaEmitida`
/ `allocateInvoiceNumber`) y exigen `quote.status === 'accepted'`: no sirven para un parte.

### ② Del parte firmado a la factura: qué tiene, qué exige, qué le falta a cada candidata

**Qué es «parte» en el esquema:** `ParteTrabajo` (`schema.prisma:1705`), no `Albaran` (`:1514`) ni `Job`.
Es lo que abre 915b/c (`GET /admin/partes/:id`). Lleva `jobId?`, `customerId?`, `lineas` JSON
`[{id?, bloque, unds, descripcion, precioUnitario?, tipoIva?}]` (IVA **por línea**), `estado`
`borrador | firmado | facturado`. **No lleva** retención de garantía (`retencionGarantiaPorcentaje`
vive en `Charge`, `schema.prisma:531`) ni ningún enlace a factura (no hay `invoiceId`).

**`facturado` está declarado y no se escribe:** `ESTADOS_PARTE` lo incluye (`parteTrabajo.ts:78`) y
`puedeEditarPrecios` cierra los precios con él (`:420`), pero las tres escrituras de `estado` en
`partes.routes.ts` son `'borrador'` (`:483`) y `estadoTrasFirmar(...)` (`:783`, `:871`), que sólo pasa
de `borrador` a `firmado` (`parteTrabajo.ts:523`). 0 líneas con `estado: 'facturado'` en `src/`.
Ninguna ruta de partes contiene «factur»/«invoice» (0 de 5 POST/PATCH/PUT).

| candidata | ¿sirve tal cual? | qué le falta |
|---|---|---|
| `convertir-en-factura` / `facturar-parcial` del albarán | **no**: recibe un `Albaran`, no un `ParteTrabajo` | todo el modelo. El camino que SÍ existe es indirecto: parte firmado → «nuevo albarán» (SCRUM-1740, precarga concepto y cantidad, SIN precios) → valorar → firmar el albarán → convertir. Tres pasos y una segunda firma |
| factura suelta `POST /admin/invoices` | **casi**: acepta cliente + líneas con IVA por línea | (a) el editor la abre SIN plantilla: `renderDocumentoSueltoView` llama a `renderQuotesView(container, null, true)` (`quotesView.js:6067`); (b) la plantilla de 915b NO lleva precios ni IVA (lee el parte del técnico; `parteDetailView.js:902-904`) — los precios de la oficina salen de `GET /admin/partes/:id/oficina`; (c) **no enlaza** la factura con el parte ni con el trabajo, y el parte se queda `firmado`: el botón seguiría ofreciéndose y el mismo parte se puede facturar N veces |
| presupuesto → factura (`quotesAdmin`) | no | exige un presupuesto aceptado |

### ③ Propuesta (sin construir)

**B — recomendada, pieza de servidor (camino de emisión: GO del fundador, reglas 38/40):**
`POST /admin/partes/:id/facturar`, gemela de `convertir-en-factura` y llamadora de `emitInvoice`, no
vía nueva:
- `requireRole('admin')`; 409 si el parte no está `firmado`, si alguna línea no tiene `precioUnitario`
  o `tipoIva`, o si `getEmissionMode(merchant) === 'receipt'` (mismo gate que el albarán).
- Cliente: `parte.customerId ?? job.customerId`, congelado con `congelarCliente` antes de la tx.
- Líneas: `descripcion`/`unds`/`precioUnitario`/`tipoIva` del parte, con `exigirLineasFacturables` y
  `exigirTiposDeIvaEmitibles` ANTES de pedir número.
- En la MISMA tx que `emitInvoice`: `parteTrabajo.updateMany({ where: { id, estado: 'firmado' }, data:
  { estado: 'facturado' } })` y abortar si cuenta 0 — primera escritura de un estado que el máster ya
  declara (no se inventa ninguno) y cierre de la doble facturación.
- Sellado fuera de la tx con `sellarTrasEmision`, como las otras cuatro.
- **Cobro:** nace SIN `Charge`, como las cuatro llamadoras de hoy.

Lo que toca del camino de emisión: un valor nuevo en `OrigenC7` (`invoiceNumber.service.ts:63`, p. ej.
`'C7-parte'`) — es un cambio de tipo del emisor. Y, si se quiere el enlace parte→factura además del
estado, una columna nueva (`ALTER` aditivo, A5) o reutilizar `albaranRefs` (sería guardar un parte
donde dice albarán: no lo recomiendo).

**A — sin servidor:** el botón abre `invoices-new` con plantilla (cliente + líneas con precio e IVA de
`/oficina`). Requiere que la página del documento suelto acepte plantilla (front de S4/S2) y deja los
dos defectos de (c): parte sin `facturado` y facturable N veces. Sólo como provisional y con la doble
facturación aceptada por escrito.

### ④ Dónde iría el botón (S2/S4, para Luis)

| sitio | fichero:línea | gate que ya existe |
|---|---|---|
| detalle del parte firmado, junto a «+ Nuevo presupuesto» | pintado `parteDetailView.js:815` (`pintarHacerPresupuesto`, `:971`), atado `:1892` (`atarHacerPresupuesto`, `:982`) | `plantillaDelPresupuesto` (`firmadoYSinFacturar`, `:944`) — vale tal cual si el servidor llega a escribir `facturado` |
| fila del parte firmado en la lista de Partes de la ficha del trabajo | `jobDetailView.js:1966` (`botonPresupuestoDelParte`), insertado en `:2033` | `p.estado !== 'firmado'` y `isTecnico` |
| modo del merchant | `app.js:64` (`window.appDocumentoSuelto`) y `app.js:415` (el `case 'invoices-new'` que ya falla cerrado) | regla 24: con el flag en OFF el botón no se pinta (sin estado deshabilitado, así no hay texto nuevo que firmar) |

Texto: `atajoNuevo.js:38` ya rotula `invoices: "Nueva factura"` y `invoicesView.js:304` lo usa en el
botón de Facturas; si esa entrada consta firmada no lo he comprobado. La forma con «+» es la del ticket.

### Preguntas para el fundador (✅/❌)

1. ¿Opción B (ruta nueva que emite y marca el parte `facturado`), con GO para tocar `OrigenC7`?
2. ¿La factura del parte nace sin cobro (como la suelta y las del albarán)?
3. ¿Hace falta enlace parte→factura además del estado (columna nueva, ALTER aditivo)?
4. ¿Exige las DOS firmas (`firmasCompletas`) o basta `firmado`?
5. Literal «+ Nueva factura»: ¿firmado?

## SCRUM-1780b · Diseño y esquema de la factura desde el parte (solo docs; se construye en 1780c, después del ALTER)

**Puesto:** J1 (jv-j1ga) · **Rama:** `scrum-1780b-ddl-y-diseno-factura-desde-parte` (lleva dentro, por merge, la de 1780a: PR #3278 aún sin mergear) · 20-nov-2026
**Medido contra:** `origin/main` = `7f5ea0138d9c7ca683ec903114940cff37613a60` · 2026-11-20T17:59:09Z (cabecera `Date:` de `gh api -i zen`)
A9: sin fallo que generalice — dos tropiezos de consola sin efecto: pasé a Jira un `cloudId` deducido del dueño del repositorio (falló y lo leí con `getAccessibleAtlassianResources`) y abrí `src/modules/albaranes/`, la ruta del encargo, que no existe (la buena es `src/modules/jobs/app/routes/albaranes.routes.ts`); los dos dieron error a la vista, ninguno dio un dato falso

**Decisiones de partida (SCRUM-1780 c.22237, literal de Javier «1-Go · 2-Sí · 3-Ok · 4-Firmado»):** ① GO a la
ruta B con un valor nuevo de `OrigenC7`; ② nace SIN cobro; ③ enlace parte → factura con columna nueva, ALTER
aditivo; ④ basta `firmado`. Botón firmado: `+ Nueva factura` (c.22230). Aquí NO se toca `src/` ni
`prisma/schema.prisma` (reglas 38 y 40, orden A5). Todo lo de abajo está **leído en el código, no ejecutado**,
salvo el preview del DDL, que sí se corrió.

### ① Esquema: `ParteTrabajo.invoiceId`, no `Invoice.parteId`

Línea propuesta en `model ParteTrabajo` (detrás de `contenidoVersion`) y su índice (delante de `@@map`):

    invoiceId         Int?      @map("invoice_id")
    @@index([merchantId, invoiceId])

Sin `@relation`, como `Albaran.invoiceId` (`schema.prisma`, modelo `Albaran`: anulable, sin FK, con
`@@index([merchantId, invoiceId])`) y como `Customer.companyId` (decisión del fundador del 8-sep-2026: «servicio de
borrado, no cascadas»). Por qué en el parte y no en la factura:

| criterio | `ParteTrabajo.invoiceId` | `Invoice.parteId` |
|---|---|---|
| precedente en el esquema | el mismo que `Albaran.invoiceId` | ninguno igual |
| quién lo escribe | la ruta, en la misma tx, fuera de `emitInvoice` | `emitInvoice` (cambiar `EmitInvoiceInput`: más camino de emisión que el GO) o un UPDATE sobre una factura recién emitida (regla 29) |
| borrado (`borradoMerchant`: `parteTrabajo` antes que `invoice`) | nadie apunta al parte: sigue cierto lo de SCRUM-674 | la factura quedaría apuntando a un parte borrado |
| doble facturación | `updateMany` condicionado a `invoiceId: null` | haría falta un índice único sobre `invoices` |

**Qué pasa al borrar** (leído en `origin/main`, no ejecutado): **parte** → no hay ninguna ruta que lo borre (0
`parteTrabajo.delete*` en `src/`); sólo `borradoMerchant` (gateado OFF) y el barrido del demo, que lo borran antes que
la factura: la factura ni se entera. **Factura** → nunca (regla 29); el barrido del demo la borra después del parte.
**Cliente** → `Invoice.customer` es relación requerida sin `onDelete` (Restrict): un cliente con factura no se borra; el
parte no lleva FK al cliente (como hoy). Una FK con CASCADE borraría el parte al borrar la factura, y con SET NULL lo
volvería facturable: ninguna se crea.

**DDL:** `docs/sql/scrum-1780-parte-facturado.sql`, marcado PROPUESTO. Sacado OFFLINE por
`docs/master/evidencias/SCRUM-1780/preview-ddl-1780b.mjs` (`previewMigracion({ schema, desde })` sobre copias en un
temporal fuera del árbol; salida en `preview-ddl-1780b.salida.txt`): control de la herramienta ok · 2 sentencias
(`ADD COLUMN "invoice_id" INTEGER` y `CREATE INDEX "partes_trabajo_merchant_id_invoice_id_idx"`) · destructivas 0 ·
lista blanca de `scripts/_aplicar-sql-dev.mjs` 2 permitidas / 0 rechazadas (y `revisar()` sobre el `.sql` entero:
`ok: true`) · control negativo (actual → actual) `sin_cambios` · control positivo SEMBRADO (un DROP fabricado de
`notas`): destructivas 1, rechazadas 1. **NO medido:** que quitar el sembrado deje el guion en CIEGO (sale 2 por
construcción, no lo corrí) y ninguna base: no sé si alguna tiene ya la columna.

### ② La ruta: `POST /admin/partes/:id/facturar` (se construye en 1780c)

Gemela de `convertir-en-factura` (`albaranes.routes.ts:1537`). En orden:

1. **Auth y rol:** `requireAuth` (lo pone `mountAdmin`, `app.ts:618`) + `requireRole('admin')`. Mismo rol que
   `convertir-en-factura` (`:1537`) y que `GET /admin/partes/:id/oficina` (`partes.routes.ts:369`), que es donde viven
   los precios: el técnico no ve precios (`lineasParaElTecnico`). Pregunta ✅/❌ abajo.
2. **Tenancy:** la misma consulta que `findParte` (`partes.routes.ts:89`: `cabeEnColumnaInt(id)` y `where { id,
   merchantId }`), hecha DENTRO de `facturaDesdeParte.ts` porque `findParte` no se exporta y su fichero es de S1;
   con rol admin, la rama de `seesOnlyOwnJobs` no aplica → 400 `invalid_id` / 404 `not_found`.
3. **Precondiciones, 409 con CÓDIGO y sin `message`** (los textos son de pantalla, regla 39):
   `parte_no_firmado` (estado ≠ `firmado`; `facturado` también cae aquí) · `parte_ya_facturado` (`invoiceId != null`) ·
   `parte_sin_cliente` (`parte.customerId ?? job.customerId` nulo) · `parte_sin_precio` (alguna línea sin
   `precioUnitario` o sin `tipoIva`, con los índices de línea en `lineas: [...]` como diagnóstico).
4. **Gate:** `getEmissionMode(merchant) === 'receipt'` → 409 `facturacion_no_disponible`, igual que el albarán
   (`albaranes.routes.ts:1578`). Corrección al encargo: `exigirDocumentoEmitible` NO está en las rutas del
   albarán; vive en el ENVÍO (`src/lib/invoicing.ts:104` y `:263`), así que la factura del parte lo pasa al enviarse.
5. **Cliente y emisor congelados** antes de la tx: `congelarCliente(prisma, merchantId, customerId)` y
   `congelarEmisorDesdeFicha(merchant)`.
6. **Líneas:** cada línea del parte → `{ concept: descripcion, qty: unds, price: precioUnitario, tax: tipoIva }`; total
   con `calcVatBreakdown` (como el albarán, no con `totalesPorBloque` del parte); `exigirLineasFacturables` y
   `exigirTiposDeIvaEmitibles` ANTES de `emitInvoice` (son los dos portones que exige por llamada
   `tests/scrum778-la-lista-cableada.test.mjs`). El concepto va SIN prefijo: el albarán antepone
   «Albarán N (fecha): …», y un prefijo «Parte …» sería texto nuevo en la factura (regla 39): pregunta abajo.
7. **Una tx:** `emitInvoice(tx, { …, type: 'F1', quoteId: null, origen: 'C7-parte', actor: actorDeRequest(req),
   clienteCongelado, emisorCongelado })`; `isReceiptNumber` → abortar; y
   `tx.parteTrabajo.updateMany({ where: { id, merchantId, estado: 'firmado', invoiceId: null }, data: { estado:
   'facturado', invoiceId: inv.id } })` → si `count !== 1`, se lanza y la tx entera (número incluido) se deshace →
   409 `parte_ya_facturado`. Es la primera escritura de un estado que `ESTADOS_PARTE` ya declara (no se inventa ninguno).
8. **Después de la tx:** `sellarTrasEmision` (como las otras cuatro llamadoras). **Sin `Charge`** (decisión ②): el cobro
   nace al enviarla, como el reenvío (`resend-whatsapp`).
9. **Auditoría:** la de `emitInvoice` (`meta.camino = 'C7-parte'` y `actor`, `invoicing.service.ts:105`), la misma que
   lleva `convertir-en-factura`, que no escribe otra. 201 `{ ok, factura: { id, number, total, currency }, veriFactu }`.
10. **`OrigenC7`:** `'C7-parte'` en el tipo y en `ORIGENES_C7` (`invoiceNumber.service.ts:63` y `:70`), y en el
    comentario del censo (`:47`). `tests/scrum347-origen-de-la-factura.test.mjs` exige tipo = constante y un llamador
    por origen: con la ruta nueva siguen cuadrando 5 = 5.

**`quoteId: null`**: la del parte no se ata al presupuesto del trabajo (como la suelta). **NO medido:** si un trabajo
con presupuesto facturado Y parte facturado factura dos veces lo mismo; es una pregunta de producto, abajo.

### ③ Plan del test (1780c; rojo primero, contra la RUTA montada en `app`, no contra el handler suelto)

| caso | espera |
|---|---|
| parte del comercio B pedido por A | 404 y 0 facturas nuevas |
| parte en `borrador` | 409 `parte_no_firmado` |
| una línea sin `precioUnitario` / sin `tipoIva` | 409 `parte_sin_precio` |
| parte sin cliente | 409 `parte_sin_cliente` |
| facturar dos veces (secuencial y dos a la vez) | 201 y 409 `parte_ya_facturado`; sigue habiendo UNA factura y el contador fiscal avanza 1 |
| flag OFF (`getEmissionMode` → `receipt`) | 409 `facturacion_no_disponible` y el parte sigue `firmado` sin `invoiceId` |
| técnico | 403 |
| caso feliz | F1 con las N líneas del parte (concepto, unidades, precio, IVA por tipo), `origen 'C7-parte'` en la auditoría, 0 `Charge`, y el parte en `facturado` con `invoiceId` = la factura |

Mutaciones planeadas para el catálogo `MUTACIONES_QUE_ME_TUMBAN` del test de 1780c (no existen todavía):
«quitar `merchantId` del where» (cae el 404), «quitar la transición a `facturado`» (cae el caso feliz y el doble),
«quitar `invoiceId: null` del where del `updateMany`» (cae la doble facturación). Más los guards que ya miran
`OrigenC7` y las bocas de `emitInvoice`: `tests/scrum347-origen-de-la-factura.test.mjs`,
`tests/scrum778-la-lista-cableada.test.mjs` y `tests/scrum771-el-emisor-no-valida-el-tipo.test.mjs`.

### ④ Carriles (`node scripts/carriles.mjs de`, 20-nov 17:58Z)

| fichero | dueño | en 1780c |
|---|---|---|
| `src/modules/jobs/app/routes/partes.routes.ts` | **S1** (Luis), por `src/**` | sólo el montaje de la ruta (≈ 10 líneas) → cruce declarado en `dos-equipos.md` §3.4 o lo escribe S1 |
| `src/modules/jobs/app/routes/albaranes.routes.ts` · `src/modules/jobs/domain/parteTrabajo.ts` | S1 | se LEEN |
| `src/modules/invoicing/domain/invoiceNumber.service.ts` | J1 | `'C7-parte'` |
| `src/modules/invoicing/domain/facturaDesdeParte.ts` (nuevo) | J1 (`--nueva`) | la lógica: precondiciones, líneas, tx |
| `prisma/schema.prisma` · `docs/sql/…` | sin fila en §3 | la línea, en el PR de 1780c, tras el ALTER |
| `src/app.ts` | S1 (contenedor) | no se toca: `/admin/partes` ya está montado |

**Decisión del orquestador J (20-nov, por mensaje; la deja también en Jira):** la lógica y el test del ticket van en
J1 (`facturaDesdeParte.ts` y su test en `tests/`). El montaje en `partes.routes.ts` **no lo escribe J1**: lo escribe
S1 (Luis) en un PR suyo, o entra con un cruce en §3.4 de `dos-equipos.md` que declaren los dos jefes. Las tres líneas
propuestas, literales (la primera con los `import` del fichero; las otras dos junto a las demás `router.post`):

    import { facturarParte } from '../../../invoicing/domain/facturaDesdeParte'; // SCRUM-1780c (J1)
    // SCRUM-1780c · factura desde el parte firmado (GO del fundador, SCRUM-1780 c.22237); la lógica es de J1
    router.post('/:id/facturar', requireRole('admin'), facturarParte);

### Preguntas para el fundador (✅/❌)

1. **Rol:** ¿solo **admin** (como `convertir-en-factura` y como la pantalla de precios)? Recomiendo ✅.
2. **Concepto de la línea:** ¿la descripción del parte TAL CUAL (sin texto nuevo)? Recomiendo ✅. ❌ = dame el literal del prefijo.
3. **Trabajo con presupuesto:** ¿se puede facturar el parte aunque el trabajo tenga un presupuesto ya facturado? (no medido cuántos casos hay).
4. **Anular la factura del parte:** ¿el parte se queda `facturado` (lo que hace el diseño: nada lo devuelve) o vuelve a ser facturable? Lo segundo es una transición nueva (Parte L).

## SCRUM-1780c · Factura desde el parte firmado: construida (`facturaDesdeParte.ts`), sin montar (el montaje es de S1)

**Medido contra:** `origin/main` = `60a1260b8bb8c30d7db35ba2f34d987e0d8c7b38` · 2026-11-20T18:13:03Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J1 «El encargo pedía rojo primero y escribí `facturaDesdeParte.ts` ANTES que su test; el único rojo previo fue que faltaba `dist/`, que no prueba nada del comportamiento, y lo que sí lo prueba son las mutaciones del catálogo y una sonda que quitó la comprobación de la reclamación» — no se pudo comprobar: el orden en que se escriben dos ficheros del mismo commit no lo ve ningún guard
Mutaciones: catálogo → `tests/scrum1780c-factura-desde-parte.test.mjs`

Sesión `jv-j1gd` (J1). Decisiones que se aplican, leídas en Jira: GO de la ruta y del origen nuevo (c.22237 ①), la factura nace sin cobro (②), enlace con columna nueva (③), basta `firmado` (④); solo admin, concepto tal cual, se factura aunque el trabajo tenga un presupuesto facturado y al anular el parte se queda `facturado` (c.22244 ①-④). Diseño: c.22242 / tramo 1780b.

### ① A5 ② en dev (staging y producción los aplicó el fundador, c.22244)

`node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-1780-parte-facturado.sql` primero sin `--go` (ensayo: 2 sentencias de forma conocida, `ADD COLUMN` y `CREATE INDEX`) y después con `--go` (salida 0). Sonda de solo lectura con `information_schema.columns` y `pg_indexes`, sin imprimir la URL:

| momento | `current_database()` | columna `invoice_id` | índice `partes_trabajo_merchant_id_invoice_id_idx` | control positivo (`merchant_id` existe) |
|---|---|---|---|---|
| antes | `yaqu_dev_javier` | 0 filas | 0 filas | 1 |
| después | `yaqu_dev_javier` | `integer`, `is_nullable YES` | `CREATE INDEX … USING btree (merchant_id, invoice_id)` | 1 |

El preview offline (`preview-migracion.mjs --desde` el esquema de `HEAD`) da exactamente las dos sentencias del `.sql`, veredicto aditiva. `generate` desde este árbol (`node_modules` propio, `npm run topologia`) y `_prisma-client-guard.mjs` ✔.

### ② Qué se construyó

- `prisma/schema.prisma`: `invoiceId Int? @map("invoice_id")` y `@@index([merchantId, invoiceId])` en `ParteTrabajo`, sin `@relation`.
- `src/modules/invoicing/domain/invoiceNumber.service.ts`: `OrigenC7` y `ORIGENES_C7` con `'C7-parte'`.
- `src/modules/invoicing/domain/facturaDesdeParte.ts` (nuevo): `facturarParteDeMerchant` (dominio) y `facturarParte` (handler). Errores por código y sin `message`: `invalid_id`, `not_found`, `parte_no_firmado`, `parte_ya_facturado`, `parte_sin_cliente`, `parte_sin_precio`, `facturacion_no_disponible`, más los dos portones que ya existían (`factura_sin_lineas`, `tipo_iva_no_emitible`).
- **Una diferencia con el diseño de 1780b, y por qué:** en la tx, el `updateMany` condicionado (`estado 'firmado'` e `invoiceId null`, exactamente 1 fila) va ANTES de `emitInvoice`, no después, y deja el parte en `facturado`; el `invoiceId` se escribe tras emitir, en la misma tx. Así una segunda petición simultánea se queda en el cerrojo de fila, toca 0 filas y sale sin consumir número de serie. El rollback lo sigue haciendo Postgres si `emitInvoice` falla. La comprobación previa a la tx mira solo el estado: el `invoiceId: null` vive en el WHERE (si no, esa condición sería redundante y su mutación no tumbaría nada).
- No se crea `Charge`. Sellado con `sellarTrasEmision` después de la tx, como la gemela; no se toca `selladoEstado.ts` (lo de SCRUM-1779d se hereda tal cual). Auditoría: la de `emitInvoice` (`meta.camino` = `C7-parte`).

### ③ Las tres líneas que debe escribir S1 en `src/modules/jobs/app/routes/partes.routes.ts` (literal de c.22242)

```ts
import { facturarParte } from '../../../invoicing/domain/facturaDesdeParte'; // SCRUM-1780c (J1)
// SCRUM-1780c · factura desde el parte firmado (GO del fundador, SCRUM-1780 c.22237); la lógica es de J1
router.post('/:id/facturar', requireRole('admin'), facturarParte);
```

Hasta entonces la ruta NO existe en la app y el botón de S2 no tiene a qué llamar.

### ④ El test y lo que NO prueba

`tests/scrum1780c-factura-desde-parte.test.mjs`, 11 casos, sobre `_banco-emision-con-estado.mjs` (`emitInvoice` de `dist/` de verdad; la tabla `parteTrabajo` la pone el test, porque el banco es de S3). El handler va montado en un **router de prueba** con el mismo `requireRole('admin')`: el test sigue verde con la ruta sin montar (A10, SCRUM-1344). Casos: caso feliz (F1, líneas tal cual con el IVA en fracción, total 118,25, 0 Charge, `C7-parte` en la auditoría, parte `facturado` con su `invoiceId`), comercio B → 404, borrador → 409, sin precio / sin IVA → 409, sin cliente (nulo o de otro comercio) → 409, doble secuencial y simultánea → 409 con UNA factura y el contador +1, firmado con factura ya enlazada → 409 (lo para el WHERE), flag OFF → 409 con el parte intacto, técnico → 403, trabajo con presupuesto facturado → se factura.
Sonda de una vez (sin guion en git, por eso no cuenta como mutación): con la comprobación `reclamado.count !== 1` desactivada en `dist/`, caen la simultánea y la de factura ya enlazada (9/11); `dist/` restaurado y comparado con `cmp`.
**No medido:** la carrera contra Postgres de verdad (el banco no aísla ni deshace; aquí no hay base desechable); ninguna pantalla; la suite entera.

## SCRUM-1780d · Relevo de 1780c: 523d recongelado sin subir la versión y los otros cuatro rojos (sesión jv-j1ge, J1)

**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-20T18:35:25Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum525d-anclas-que-apuntan.test.mjs`

Mi fallo: al fechar las dos citas movidas puse en la nota un término entre acentos graves, y el guard lo tomó como testigo de la coordenada; lo cazó él mismo en la dirigida y quité el término. Y la primera versión de esta línea `A9:` llevaba la explicación detrás de la ruta: la tumbó `guards:entrada` (scrum1294).

Relevo de `jv-j1gd` desde su commit local `323390f35598bc0623f267aa37d7edf63080f57f` (no estaba en el remoto). El `merge --ff-only` del encargo no podía avanzar: mi rama nacía en `fea1c000` (main), que no es antecesor de `323390f35`; monté la rama en `323390f35` y le hice `git merge origin/main` (sin conflictos). Decisiones que aplico, leídas en Jira: SCRUM-1780 c.22249 (orquestador J, 18:32Z): NO se sube `VERIFACTU_VERSION`; se recongela `invoiceNumber.service.ts` por el matiz SCRUM-1585 c.21290, con el GO de regla 40 de c.22237.

| rojo (mensaje literal, abreviado) | arreglo |
|---|---|
| scrum523d «Has cambiado el camino de emisión sin subir VERIFACTU_VERSION … `invoiceNumber.service.ts` — cambia» | recongelada SOLO esa huella (`65ff392f155d005b` → `703674abecd33799`, la que imprimió el mensaje), con la cita «SCRUM-1780 c.22237 por SCRUM-1585 c.21290» en su línea y en el comentario de `HUELLAS_CONGELADAS`. `VERSION_CONGELADA` sigue en `1.0.0`; las otras 14 huellas, idénticas a las recalculadas. Diff del fichero frente a main: solo `'C7-parte'` en `OrigenC7` y `ORIGENES_C7` |
| scrum347 «el tipo declara 5 orígenes y emitInvoice tiene 4 llamadores medidos» | declarado el 5.º llamador (`facturaDesdeParte.ts`, `C7-parte`) en el suelo y en el mínimo del censo, con su ticket. El censo sigue derivado del AST y la prueba «cada camino usa un origen distinto» sigue igual |
| scrum1185 «Hay piezas NUEVAS que nada consume … `facturaDesdeParte.ts::facturarParte`» | declarada en `scripts/_sin-consumir-declarados.json` (carril J1, SCRUM-1780): la monta S1 en `partes.routes.ts` |
| scrum222 «docs/sql/deriva-prod.sql no coincide con el schema actual» | regenerado con `node scripts/generar-sql-deriva.mjs` (540 columnas) |
| scrum525d «2 ancla(s) RESUELVEN pero apuntan a otra cosa» (`AUDITORIA_CAMINO_EMISION.md:35` y `:40`) | `invoiceNumber.service.ts:335→336` y `schema.prisma:1882→1887`, en sitio y con la nota fechada «cita puesta al día el 20-nov-2026, SCRUM-1780c» |

`scrum1294` (transitorio según j1gd): verde en la dirigida. `censo:mudez --escribir`: 1 ficha re-medida (scrum347), sigue VIVO.

**Verificado:** `prisma generate` en mi `node_modules` propio y guard del cliente ✔; `tsc -p .` con tipos, salida 0; dirigida de 40 ficheros (los cinco, `scrum1780c-*`, 1027/289b/346/207/emission, albarán, 836, 700, 710b, 719, 1294, 267, 273, 854, 391, 475, 1310b, 1610d, 290, 1740, 1673, 841, 257, 606): 422 casos, 414 pasan, 7 saltados (gateados), 1 caía (525d, el de la línea A9) y tras el arreglo 8/8. La suite entera y `guards:entrada`, en el comentario de entrega de Jira.
**No medido:** ninguna base (no toqué ninguna); la carrera contra Postgres de verdad; ninguna pantalla. La ruta sigue sin montar: las tres líneas de `partes.routes.ts` son de S1.

### STOP · sin empujar: la suite entera saca un rojo que pide cambio de máster

Tramos 1-5 de 15 (`tanda-entera-por-tramos.mjs`): `tests/scrum1500-el-cotejo-contra-el-master.test.mjs`, caso «SCRUM-1500b · EL PARADO no es un agujero», cae con «hay una escritura literal de `facturado` en src/: el motivo de la excepción ya no es verdad» (corrido suelto: 30 casos, 29 pasan, 1 falla). Lo provoca `facturaDesdeParte.ts`, que escribe `estado: 'facturado'`. La Parte L del máster (`docs/YAQU_MASTER.md:403`) fija `ParteTrabajo.estado` como `borrador | firmado`, «SIN `facturado`», por la decisión ② del fundador en SCRUM-1529 c.19228, y la excepción de `PARADOS` (`docs/master/evidencias/scrum1500/cotejo.cjs`) dice que la retira SCRUM-1535 quitando `facturado` de `ESTADOS_PARTE`. El GO de c.22237 aprueba lo contrario (escribir `firmado → facturado`). Arreglarlo es tocar la Parte L (estados cerrados, cambio de máster) o el guard (regla 41): ninguna de las dos es mía. Los otros rojos de los tramos (1289b, 1298b, 1471b) pasan sueltos: ambiente (la TEMP de la sesión lleva un espacio) o intermitencia; ninguno toca ficheros de esta rama. Tramos 6-15: sin correr.

### B1 · decisión del fundador «1-Ok vamos con la B» (literal relayado por el orquestador J, 20-nov ~18:55Z; lo publica él en SCRUM-1780)

El parte se queda `firmado`; «facturado» es `invoiceId` no nulo (sin cambio de máster; la Parte L sigue `borrador | firmado`). En `facturaDesdeParte.ts`: se emite primero y se enlaza después con `updateMany` where `{ id, merchantId, estado: 'firmado', invoiceId: null }` → `{ invoiceId }`; si `count ≠ 1`, `throw` y la tx deshace factura y número. La precomprobación pasa de `estado === 'facturado'` a `invoiceId != null`. Test: caso feliz y presupuesto ya facturado esperan `firmado` + `invoiceId`; mutación 2 = quitar la escritura de `invoiceId`; mutación 3 = quitar la precomprobación (la de quitar `invoiceId: null` del WHERE solo la ve la simultánea). Verificado: `tsc -p .` 0; 10 ficheros (1780c, 1500, 523d, 347, 1185, 525d, 222, 719, 836, 1610d) = 135 casos, 132 pasan, 3 saltados, 0 fallan.
**NO HECHO (traspaso):** ① la simultánea va `skip` declarado: falta escribirla contra el Postgres desechable de la casa (gate de scrum814 o el que toque) — el banco en memoria no deshace la tx; ② las mutaciones NO se han corrido con el meta-guard (lo paré a los 600 s y dejó MUTADO `src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts`, carril J2, una línea `decisionChannel: 'pendiente_de_confirmar'` en la línea 487: NO está en el commit; hay que restaurarlo desde HEAD en `cobroflash-jv-j1ge` antes de nada); ③ tramos 6-15 de la suite y `guards:entrada` sobre esto; ④ el empujón: `git push origin HEAD:scrum-1780c-factura-desde-parte`.

## SCRUM-1780e · Tercer relevo de 1780c: la simultánea bajo Postgres, las mutaciones sobre B1 y el empujón (sesión jv-j1gh, J1)

**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-20T19:07:02Z (cabecera `Date:` de `gh api -i zen`)
A9: sin fallo que generalice — la lista de la dirigida la armé con un `sed` que casó también la cadena vacía y añadió un argumento `tests/` a secas: dio un «not ok 1 - tests» que no era de ningún test; lo separé por su error (`MODULE_NOT_FOUND` sobre la carpeta) y por la población (32 ficheros, 356 casos), que es lo que ya pide A3
Mutaciones: catálogo → `tests/scrum1780c-factura-desde-parte.test.mjs`

Los tres relevos de 1780c, en orden: **jv-j1gd** construyó la ruta (tramo 1780c, commit local `323390f35`); **jv-j1ge** recongeló 523d, arregló 347/1185/222/525d, paró por 1500b y construyó **B1** (tramo 1780d, commit local `f8759325c932e06d31d69cca80368d3fa882835c`); **jv-j1gh** (este tramo) parte de ese commit, que ya contiene `origin/main` `fea1c000` (el `git merge origin/main` sale «Already up to date»), y no trae el fichero mutado sin commitear que quedó en el árbol de jv-j1ge (`whatsappIncoming.routes.ts`): ese fichero no está en ningún commit de esta rama.

**B1 (SCRUM-1780 c.22252):** el parte se queda `firmado` (Parte L intacta) y «facturado» es `invoiceId` no nulo. Se emite y después se enlaza con `updateMany` sobre `{ id, merchantId, estado: 'firmado', invoiceId: null }`; si no toca exactamente una fila, `throw` y la tx deshace factura y número.

### ① La simultánea, contra Postgres: `tests/scrum1780c-simultanea-postgres.test.mjs`

Gateada por `LIBRO_PG_URL` (loopback y base `*_test`, el mismo portón que `scrum1150c`; con una URL que no lo cumpla el fichero lanza y no toca nada). **Dónde corre:** `.github/workflows/ci.yml` pone `LIBRO_PG_URL` en el paso «Tests (incluidos los de banco desechable)» del job `test` («build + tests (con banco desechable)»), con el esquema sacado de `prisma/schema.prisma`; ese es el único check que exige el ruleset de `main` (`gh api repos/…/rules/branches/main`, leído el 20-nov). **En esta máquina NO corre:** no hay ningún Postgres (ni puerto 5432/55432 escuchando, ni `psql`, ni docker): sale SKIP con su motivo declarado. Su verde lo dirá el run del obligatorio, no este registro.

Cómo provoca la carrera, sin esperarla: una tercera transacción bloquea la fila del parte con `FOR UPDATE`; las dos peticiones leen el parte sin factura y entran en su tx; el retén no se suelta hasta que `pg_blocking_pids` ve a las DOS esperando detrás de él (una en la fila del parte, la otra en el cerrojo de serie detrás de la primera). Si no llegan a esperar las dos, el caso cae diciendo que no hubo carrera. Exige: un 201 y un 409 `parte_ya_facturado`, UNA factura del comercio, el parte `firmado` con el `invoiceId` de la ganadora, y el contador de serie subido exactamente uno (`resolveSeriesSeq` de antes + 1).

En el banco en memoria, el caso `skip` de jv-j1ge se sustituye por su mitad determinista, **«lectura vieja»**: el parte se lee sin factura y, al enlazar, ya tiene la de otra petición. Solo lo para el WHERE del enlace (la precomprobación no lo ve).

### ② Mutaciones sobre B1, una a una con `aplicarUna` (no el censo entero)

Driver de una vez: importa `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (el script solo arranca si se ejecuta directamente) y aplica una declaración por proceso. Pasada limpia: 11 pasan, 0 caen, 0 saltados. `git status` después de cada una: solo mis dos ficheros de test.

| mutación (declarada en `MUTACIONES_QUE_ME_TUMBAN`) | veredicto | casos que caen |
|---|---|---|
| quitar `merchantId` de la búsqueda del parte | MUERE | comercio B → 404 |
| quitar la escritura de `invoiceId` (`data: {}`) | MUERE | caso feliz · doble secuencial · trabajo con presupuesto ya facturado |
| quitar la precomprobación `invoiceId != null` | MUERE | doble secuencial · factura ya enlazada |
| quitar `invoiceId: null` del WHERE del enlace (nueva) | MUERE | lectura vieja |

Quitar `merchantId` del WHERE del **enlace** no se declara: el `id` ya viene de una búsqueda con tenencia, así que esa mutación no cambia el comportamiento y saldría muda por construcción.

### ③ Verificado

- `node_modules` propio (`npm run topologia`), `prisma generate` en él y guard del cliente ✔; `tsc -p .` con tipos, salida 0.
- Los dos ficheros de 1780c: 12 casos, 11 pasan, 1 saltado (la simultánea, sin `LIBRO_PG_URL`).
- Dirigida del encargo (32 ficheros: `scrum1780c-*`, 1500, 523d, 347, 1185, 222, 525d, 1027, 289b, 346, 207×3, `emission`, `albaran`, 836, 700, 710b, 719, 1294, 267, 273, 854, 391, 475×6, 1310b): 356 casos, 349 pasan, 7 saltados (gateados), 0 fallan.
- `censo:mudez --escribir`: sin cambios en `tests/_veredicto-mudez.json`.

**No medido:** la simultánea contra Postgres (aquí no hay base; la corre el obligatorio); ninguna base del proyecto (no toqué ninguna); ninguna pantalla. **La ruta sigue sin montar:** las tres líneas de `partes.routes.ts` (tramo 1780c ③) son de S1 (Luis).

## SCRUM-1780f · Cuarto relevo de 1780c: scrum411 por decisión del fundador, y la suite entera saca cuatro rojos más (sesión jv-j1gl, J1)

**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-21T04:12:50Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `scripts/tanda-entera-por-tramos.mjs`

- **scrum411:** `MODULOS_DOMINIO_INALCANZABLES_MAX` 4 → 5 con su línea fechada, por la decisión del fundador «1-A ok» (SCRUM-1780 c.22257). Rojo visto antes (25 casos, 1 falla: «5 módulos y el tope es 4»), verde después (25/25). Baja a 4 el PR de S1 que monte la ruta.
- **scrum1289b** (rojo del tramo 3 de j1gh): es la trampa del TEMP con espacio (SCRUM-1772). Con el TEMP de la sesión, 7/9; con `TEMP=C:\tmp\j1gl`, 9/9.
- La suite entera (15 tramos, 1.731 ficheros, TEMP sin espacio) sacó **cinco rojos que la dirigida de los relevos anteriores no tenía**:
  - `scrum389`: `facturaDesdeParte.ts` llama a `calcVatBreakdown` sin clasificar → clasificado DOCUMENTO con su motivo (es lo que pide el propio guard). 4/4.
  - `scrum860`: la lectura del parte iba sin `select` → arreglado el CÓDIGO (`select` de las cinco columnas que usa). La mutación 1 del catálogo se re-ancló al `where` nuevo; las 4 MUEREN otra vez con `aplicarUna`, árbol limpio tras cada una.
  - `scrum921c`: una marca «el fundador decidió (c.22252)» sin `SCRUM-<n>` en `tests/scrum1780c-simultanea-postgres.test.mjs` → añadido `SCRUM-1780`. 16/16.
  - `scrum932` (4 casos): AMBIENTE. Este árbol tiene un `.env` con claves de base; apartado durante la corrida, 12/12; con él, 8/12. No toca ficheros de la rama.
  - 🔴 **`scrum291` «el camino de emisión sigue INTACTO»:** congela la huella de `invoiceNumber.service.ts` (`0651d863…` → `8c507415…`, el mismo cambio `'C7-parte'` que 523d recongeló por c.22249) y dice «Tocarlo exige GO del fundador con el diff delante (regla 38)». **STOP: no lo recongelo sin esa decisión.**
  - 🔴 **`scrum619` «no aparece un estrechamiento NUEVO»:** `facturaDesdeParte.ts` reconstruye la línea con `{concept, qty, price, tax}`. La `LineaParte` trae además `id`, `bloque` y `datosNoRespaldados`; ninguna está en el vocabulario de la factura, así que no se pierde nada facturable. Declararlo en `ESTRECHAMIENTOS` lo **bloqueó el clasificador de permisos**; no lo he rodeado.
- `tsc -p .` con tipos, salida 0. Dirigida (20 ficheros): 195 casos, 186 pasan, 7 saltados, **2 fallan (291 y 619)**. `guards:entrada` 15/15; los 5 de árbol entero, 38/38.

**Sin empujar.** Falta: la decisión sobre 291 y 619 → aplicarlas → `git merge origin/main` (main va 16 commits por delante a las 04:12Z) → los tramos otra vez → UN empujón `git push origin HEAD:scrum-1780c-factura-desde-parte`.

## SCRUM-1780g · Quinto relevo de 1780c: merge de main (1779d), 291 y 619 por decisión del fundador, y el empujón (sesión jv-j1gp, J1)

**Medido contra:** `origin/main` = `53cde1aa49e8b8235b6b562f9a81bb6d175ac571` · 2026-11-21T05:18:46Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum189-citas-con-destino.test.mjs`

- **Merge** de `origin/main` sobre `1ea83c38` (jv-j1gl). Antes, `git diff origin/main -- src/modules/invoicing/domain/invoiceNumber.service.ts`: solo `'C7-parte'` en `OrigenC7`/`ORIGENES_C7` y el comentario de la lista. Dos conflictos:
  - `tests/scrum523d-version-del-sif.test.mjs`: los dos párrafos se conservan (1779d y 1780c). `selladoEstado.ts` toma la huella de main (`ac1bda6897b46219`). La de `invoiceNumber.service.ts` se puso a la de main y el guard cayó nombrando SOLO ese fichero; se pegó la que imprimió (`703674abecd33799`), con las citas c.22237, c.22249 y c.22280.
  - `docs/legal/AUDITORIA_CAMINO_EMISION.md:40`: la línea de main (`selladoEstado.ts:199`, de 1779d) con la cita del esquema de 1780c (`prisma/schema.prisma:1887`, medida en el árbol fusionado).
- **scrum291** (SCRUM-1780 c.22280, «1-Sí»): rojo visto (`leído: 8c507415…`) → `EMISOR_SHA256` = `8c507415731900d0e774d850d0c023b31d26b6892ab51ba268681ba41ac031e8`, con su bloque fechado. Nada más del guard.
- **scrum619** (c.22280, «2-Sí»): rojo visto («SITIO NUEVO … facturaDesdeParte.ts») → `'src/modules/invoicing/domain/facturaDesdeParte.ts': 1` en `ESTRECHAMIENTOS` con el motivo y la cita. Nada más del guard. El clasificador de permisos no bloqueó ninguna de las dos ediciones.
- **Error mío, cazado por la suite:** en el comentario nuevo de 291 escribí «GO de regla 40 de c.22237», y `scrum189` cayó en el tramo 8 (una cita numerada sin su fichero). Cambiado MI texto, no el guard; 17/17.
- `prisma generate` en el `node_modules` propio, guard del cliente ✔. `tsc -p .` con tipos: salida 0, dos veces (tras cada merge).
- **Suite entera** (15 tramos, sobre `17bb5378`, TEMP `C:\tmp\j1gp`): 1.733 ficheros · 14.023 tests · 13.834 pass · **4 fail, los cuatro de `scrum932`** (AMBIENTE: el `.env` del árbol; 8/12 con él, 12/12 apartándolo y restaurándolo). Resumen de la pasada: ROJO solo por esos cuatro.
- Main se movió 12 commits; volví a mergear (sin conflictos; `invoicesAdmin.routes.ts` y un test de 1779f, ninguno mío). Sobre ese merge: dirigida de 19 ficheros, 170 casos, 165 pasan, 5 saltados (gateados), 0 fallan; `guards:entrada` 15/15; los 185 ficheros que lista `guards:entrada`, 1.637 casos, 4 fallan (los mismos de `scrum932`). **No he repetido la suite entera sobre el segundo merge.**
- **No medido:** la simultánea contra Postgres (en esta máquina sale SKIP; la corre el CI).

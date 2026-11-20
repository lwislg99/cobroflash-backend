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

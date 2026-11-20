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

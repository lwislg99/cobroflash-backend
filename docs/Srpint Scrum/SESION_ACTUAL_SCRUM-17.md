# SCRUM-17 · FISCAL-2 — Factura recapitulativa (consolidar albaranes del mismo mes natural)

> **Estado: RECON hecho (17-jul-2026, contra `main` c24e5d5) + AGENDA FISCAL P6-P10 pendiente de dictamen.**
> Gobierna: `docs/YAQU_MASTER.md` (reglas 24/27/29) + ticket SCRUM-17 + este doc. Compañero de
> `SESION_ACTUAL_SCRUM-16.md` (FISCAL-1: anticipos; mismo modelo Invoice, misma agenda de asesor).
> Fase F3, POST-SIF: **nada se activa a merchants reales sin SIF-1 8/8 + dictamen archivado**.
> Todo el alcance V1 nace LATENTE tras `INVOICING_ES_ENABLED=OFF`.
> Base legal: art. 13 RD 1619/2012 — la recapitulativa solo agrupa operaciones del **MISMO MES
> NATURAL** (límite legal duro, no preferencia). Un trabajo de 3 meses se cierra con
> anticipos/certificaciones + final (FISCAL-1), no con una recapitulativa gigante.

---

## 1 · Estado del terreno (recon, rutas:líneas verificadas)

### Albaranes hoy
- Modelo `Albaran` (`prisma/schema.prisma:644-669`): `merchantId`, `jobId`, `numero`
  (`ALB-YYYY-NNN`, serie no fiscal por merchant), **`fecha`** (visita/entrega, `default(now)`,
  **EDITABLE en borrador**), `lineas Json`, `estado borrador|emitido|firmado` (FSM
  `albaran.service.ts:17-21`; firmado = terminal/congelado), `firmadoAt`, `firmaToken`/
  `enviadoParaFirmaAt` (SCRUM-49), `pdfUrl`.
- **NO hay campo "facturado"/"consolidado"** → hay que añadirlo (aditivo, §3).
- **Mes natural**: la candidata es `Albaran.fecha` (fecha de la operación); `firmadoAt` es la
  firma, no la operación. `fecha` editable en borrador → hay que congelarla (P7).
- **Cliente**: el albarán NO tiene `customerId` — llega vía `Job.customerId`.
- **🚨 IVA/precios: NO existen** — `lineas = {concepto, cantidad, unidad}` SIN precio ni IVA,
  deliberado en SCRUM-14 (documento NO fiscal; el PDF presume "sin importes"). Es EL hueco del
  ticket: la recapitulativa necesita base+IVA por línea (P8).

### Generación de factura desde varios albaranes
- `Invoice.lines Json?` acepta cualquier array → recapitulativa = `invoice.create` con las líneas
  de N albaranes concatenadas (concepto prefijado `Albarán ALB-… (fecha)`), en el patrón
  transaccional canónico `allocateInvoiceNumber` + create + `applyVeriFactu`, HOY duplicado en 4
  call-sites: `quotesAdmin.routes.ts:168-197`, `jobs.routes.ts:354-372`, `quoteAdmin.ts:317`,
  `lib/invoicing.ts:207`.
- **`invoicing.service.ts` existe VACÍO (0 líneas)** = sitio natural del `emitInvoice(...)`
  compartido con FISCAL-1 (ver "Relación con la 16").

### Validación dura (patrón de la casa a seguir)
- `validarLineas` (`albaran.service.ts:34-52`): función PURA → `{ok:false, error: 'mensaje humano
  con la línea exacta'}` → ruta responde `400 {error:'codigo_snake', message}`; y el patrón 409
  con mensaje (`albaran_locked`, `albaranes.routes.ts:169`).
- Propuesta: `validarConsolidacion(albaranes[])` pura en el mismo service — códigos
  `mes_natural_mixto` (año+mes de `fecha`), `iva_mixto`, `cliente_mixto`,
  `albaran_ya_facturado`, `albaran_no_firmado`. Pura = testeable sin BD (patrón billingPlan).

### Anti doble facturación
- Aditivo **`Albaran.invoiceId Int?`** (+ `@@index([merchantId, invoiceId])`), fijado DENTRO de
  la transacción de la recapitulativa con guard de concurrencia (`updateMany where invoiceId:null`;
  si `count` < seleccionados → rollback). Re-consolidar → 409 `albaran_ya_facturado`.
- El badge "Facturado" en UI se DERIVA de `invoiceId != null` (patrón "esperando firma" de
  SCRUM-49, `schema.prisma:655-658`) → **la FSM de la Parte L no se toca** (regla 27).

### Frontend (jobDetailView.js)
- Sección Albaranes: `public/dashboard/js/jobDetailView.js:234-353`. Botón **"Consolidar en
  factura"** a nivel de sección junto a "+ Nuevo albarán" (`:256`) → modo selección con checkbox
  en tarjetas de albaranes firmados y no facturados, agrupados por mes; confirmación en
  modal/drawer del inventario AB3 (mes, nº de albaranes, total). Las tarjetas ya renderizan
  acciones por estado (`:236`, firmado → PDF `:452` + envío WA SCRUM-47 `:453`) — encaja sin
  rediseño (una pantalla).

### Relación con SCRUM-16 (FISCAL-1)
- Comparten el tramo final de emisión completo: serie + create + VeriFactu + PDF + **refs a
  documentos origen** (anticipos descontados / albaranes agrupados — mismo shape
  `{id, numero, fecha, importe}`). Propuesta: `invoicing.service.ts` nace con UN
  `emitInvoice({merchantId, customerId, type, lines, refs, quoteId?, jobId?})` que usan ambas
  y al que migran gradualmente los 4 call-sites duplicados.

### Sorpresas del recon
1. **Albaranes sin precios ni IVA** (deliberado, SCRUM-14) → decisión previa a todo (P8):
   (a) precios/IVA opcionales en la línea del albarán (¿sigue siendo "no fiscal" si no se
   imprimen?) o (b) valorar las líneas EN el paso de consolidación (editor al agrupar).
2. **"Clientes distintos" es casi trivial hoy**: un Job = un cliente; solo muerde si se amplía
   a consolidar entre varios Jobs del mismo cliente (decisión de alcance).
3. **`Albaran.fecha` editable en borrador** → el mes natural se puede maquillar; congelarla
   al emitir o firmar (P7).
4. **VeriFactu no tiene TipoFactura "recapitulativa"**: `registro.builder.ts:131` es genérico;
   seguiría siendo F1 con el periodo/operaciones referenciados (¿DescripcionOperacion?). Ni
   `SIF_SPEC_NOTES.md` ni el máster mencionan "recapitulativa" hoy → cerrar en la spec SIF (P9).
5. Regla 29 abre pregunta nueva: R1 de una recapitulativa → ¿albaranes liberados o ligados? (P10).

---

## 2 · AGENDA FISCAL — dictamen del asesor P6-P10 (checklist; se suman a P1-P5 de SCRUM-16)

- [ ] **P6 · Plazo y destinatario:** ¿fecha límite de expedición de la recapitulativa (¿antes
      del día 16 del mes siguiente al de las operaciones?) y ¿exige NIF completo del
      destinatario (Destinatarios en el registro VeriFactu)?
- [ ] **P7 · Qué fecha define el mes natural** de cada operación: ¿`Albaran.fecha`
      (visita/entrega)? ¿Congelada en qué momento (al emitir / al firmar)? ¿O `firmadoAt`?
- [ ] **P8 · Valoración de los albaranes:** ¿puede el albarán llevar precios/IVA internos y
      seguir siendo documento no fiscal (sin imprimirlos), o los importes deben nacer SOLO en
      la factura (valorar al consolidar)?
- [ ] **P9 · VeriFactu:** TipoFactura de la recapitulativa (¿F1 con el periodo y las
      operaciones en `DescripcionOperacion`?) y forma exacta de referenciar las operaciones
      agrupadas en el registro de alta.
- [ ] **P10 · Anulación:** R1 de una recapitulativa → ¿los albaranes quedan LIBERADOS para
      re-consolidar (`invoiceId → null`) o LIGADOS a la anulación?

**Salida esperada:** dictamen escrito archivado en `docs/legal/` ANTES de activar nada a reales
(mismo expediente que P1-P5 de FISCAL-1). Sin dictamen no se codifica la política, solo la
mecánica latente.

## 3 · Alcance V1 previsto (LATENTE tras `INVOICING_ES_ENABLED=OFF`; ajustar al dictamen)

1. **Schema (aditivo):** `Albaran.invoiceId Int?` + índice · `Invoice.albaranRefs Json?`
   (`[{albaranId, numero, fecha}]` — paralelo al `deductsIds` de FISCAL-1) · lo que salga de P8
   (precios en línea de albarán o tabla de valoración al consolidar).
2. **Dominio:** `validarConsolidacion()` pura (mes natural, IVA homogéneo, cliente único, solo
   firmados no facturados) + `emitInvoice(...)` compartido en `invoicing.service.ts` (sirve a
   FISCAL-1 y FISCAL-2).
3. **Endpoint:** `POST /admin/jobs/:id/consolidar-albaranes` — tenancy, validación → 400/409 con
   mensaje claro, transacción (número + create + `updateMany` con guard `invoiceId:null`),
   VeriFactu solo en modo `fiscal`. **En modo `receipt` la acción NI SE OFRECE** (la
   recapitulativa es documento fiscal puro: sin flag no existe variante justificante).
4. **UI** detrás del flag (visible solo en demo/watermark): botón + selector por mes + badge
   "Facturado" derivado.
5. **Tests:** caso límite del ticket (2 albaranes de meses distintos → RECHAZA), IVA mixto →
   rechaza, doble consolidación concurrente → solo una gana, caso feliz con referencias.
6. **Fuera de V1:** activación a reales (post-SIF + dictamen), consolidar entre varios Jobs,
   cambios en R1.

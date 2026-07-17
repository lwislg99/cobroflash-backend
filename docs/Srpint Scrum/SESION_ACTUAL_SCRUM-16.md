# SCRUM-16 · FISCAL-1 — Factura de anticipo con IVA + descuento en la final ("lo del trimestre")

> **Estado: RECON hecho (17-jul-2026, contra `main` 7abde23) + AGENDA FISCAL pendiente de dictamen.**
> Gobierna: `docs/YAQU_MASTER.md` (V3, reglas 24/26/29/32) + ticket SCRUM-16. Fase F2-tardía,
> POST-SIF: **nada se activa a merchants reales sin (a) SIF-1 8/8 y (b) dictamen del asesor
> archivado (regla 32)**. Todo el alcance V1 nace LATENTE tras `INVOICING_ES_ENABLED=OFF`.
> Base legal: art. 75.Dos Ley 37/1992 (el IVA del anticipo se devenga AL COBRO y entra en el
> modelo 303 del trimestre del cobro).

---

## 1 · Estado del terreno (recon, rutas:líneas verificadas)

### Modelo de factura hoy
- `Invoice` (`prisma/schema.prisma:277-325`): `number` único POR merchant, `total Decimal(12,2)`,
  `lines Json?` (el IVA vive en las líneas como `tax` fracción, no como campo), `status
  pending|paid|expired`, `paidAt`, `stageLabel` (SCRUM-27), `chargeId?`/`quoteId?`, campos
  VeriFactu `vfHash`/`vfPrevHash`. **Ya hay `type`**: `F1` | `R1` (con `rectifiesId` + relación
  `Rectification`) | `JUST` (justificante). **NO existe tipo "anticipo"** ni vínculo
  "final→anticipos descontados".
- Numeración (`src/modules/invoicing/domain/invoiceNumber.service.ts`): serie anual por merchant
  `2026-CF-001`, serie separada de rectificativas `2026-CF-R-001`, justificantes `J-YYYYMMDD-XXXX`
  fuera de serie. `allocateInvoiceNumber` (:60) = único asignador, transaccional.
- Relación con Job/cobros: Invoice→Quote; el Job llega por `Job.quoteId`. **Cada tramo del plan
  emite SU PROPIA Invoice parcial** (no hay "factura del trabajo"); `Job.totalCobrado` = suma de
  Invoices `paid` (SCRUM-28).

### Flag `INVOICING_ES_ENABLED`
- `src/core/flags.ts:16` (default OFF; ES-only :31-34; precedencia merchant > país > env > default).
- `getEmissionMode()` (`emission.service.ts:36-41`): ES real sin flag = `receipt` (justificante),
  demo id=1 = `demo` (watermark), flag ON = `fiscal`.
- Respeto en código: `allocateInvoiceNumber` devuelve `J-` sin tocar la serie fiscal en modo
  receipt y LANZA `invoicing_es_disabled` si se intenta R1 (:86-89); `type:'JUST'` vía
  `isReceiptNumber` en los call-sites; VeriFactu jamás a justificantes; rectify bloquea
  justificantes (`invoicesAdmin.routes.ts:533`).

### IVA
- `src/modules/invoicing/domain/vat.service.ts` — `calcVatBreakdown(lines)`: agrupa por tipo
  (21/10/4/0), devuelve `{entries, base, cuota}` y **soporta líneas en NEGATIVO** (blindado en
  `tests/vat.test.mjs`) → las líneas de deducción de anticipos salen gratis en cálculo.
  Consumers: hash VeriFactu (CuotaTotal), exports, informes 303, landing decisión; el PDF pinta
  desglose por tipo (`pdf.service.ts:248`).

### Cobros/tramos (de dónde sale el importe del anticipo)
- Plan: `resolveBillingPlan(quote)` (custom/preset) + `distributeStageAmounts` (céntimos exactos,
  último absorbe el resto — SCRUM-32). Emisión por conteo `plan[existingInvoices.length]` en
  `POST /admin/quotes/:id/invoice` (`quotesAdmin.routes.ts:147-186`) y
  `POST /admin/jobs/:id/collect-rest` (`jobs.routes.ts:322-372`), con `scaledLines` al % del tramo.
- **`TODO(SCRUM-16/17)` ya sembrado** en los dos call-sites (`quotesAdmin.routes.ts:162`,
  `jobs.routes.ts:348`): reparto fino línea-a-línea del último tramo (≤1 cént.).
- Momento del cobro (devengo): `Invoice.paidAt` (webhooks tarjeta/MP, confirm-bizum, marcado
  manual). `Charge` no tiene fecha de pago propia.

### "Factura final" hoy
- **NO existe factura final consolidada**: el último tramo es otra parcial (collect-rest). Camino
  legacy Charge→Invoice por el total en `src/lib/invoicing.ts:207-223`. El "descuenta anticipos"
  no tiene hoy dónde engancharse — punto de diseño central del ticket.

### Regla 29 (inmutabilidad) — garantizada así
- Ninguna ruta edita/borra facturas; solo `status` con whitelist (`invoicesAdmin.routes.ts:266`),
  envíos, `rectify` y `regenerate-pdf` (archivo, no datos).
- Des-pagar vetado para facturas reales (`invoiceAdmin.ts:75-81`, `UnpayNotAllowedError`; solo
  justificantes). Anulación = solo R1 (líneas en negativo, serie R, no rectificable 2×, auditada
  `anular_factura`). Cadena `vfHash`/`vfPrevHash` = integridad de la serie.

### Sorpresas del recon
1. **Medio SCRUM-16 ya existe**: cada tramo YA emite factura parcial con IVA, importe exacto y
   `stageLabel`. PERO la Invoice nace `pending` ANTES del cobro (es el vehículo del cobro) →
   fecha de emisión ≠ fecha de devengo (75.Dos = al cobro). Matiz clave para el asesor (P1).
2. No hay factura final por el total: el modelo actual es "suma de parciales" (opción b); el
   ticket pide anticipos + final con deducción (opción a). Decisión con el asesor.
3. `invoicing.service.ts` existe VACÍO (0 líneas) — sitio natural de la lógica nueva.
4. `calcVatBreakdown` con negativos → deducciones casi gratis.

---

## 2 · AGENDA FISCAL — dictamen del asesor (regla 32; checklist, llevar TODAS)

- [ ] **P1 · Momento de emisión de la factura de anticipo:** ¿al generar el cobro del tramo
      (hoy la Invoice nace `pending` antes de cobrar) o SOLO al confirmarse el cobro (75.Dos:
      devengo al cobro)? Si es al cobro: ¿qué documento viaja antes con el enlace de pago
      (pro-forma/justificante)? ¿Y qué fecha manda para el 303: emisión, cobro (`paidAt`) o un
      `devengoAt` congelado?
- [ ] **P2 · Serie:** ¿anticipos en la MISMA serie anual que las F1 (`2026-CF-…`) o serie propia
      (tipo `2026-CF-A-…`, como ya se hace con las R)?
- [ ] **P3 · Factura final a 0 €:** si el 100 % se anticipó en tramos, ¿es obligatoria una
      factura final consolidada a 0 € con las deducciones (referenciando nº y fecha de cada
      anticipo) o basta con los anticipos?
- [ ] **P4 · Rectificación cruzada:** si se rectifica (R1) un anticipo YA deducido en una final
      emitida, ¿cómo se refleja? (¿R1 también de la final? ¿regla de bloqueo?).
- [ ] **P5 · Leyenda y menciones mínimas:** texto legal exacto de la leyenda "factura de
      anticipo — art. 75.Dos LIVA" y referencias obligatorias en la final (nº + fecha + base +
      cuota de cada anticipo descontado, ¿algo más?).

**Salida esperada:** dictamen escrito archivado en `docs/legal/` ANTES de activar nada a reales
(regla 32). Sin dictamen no se codifica la política, solo la mecánica latente.

## 3 · Alcance V1 previsto (LATENTE tras `INVOICING_ES_ENABLED=OFF`; ajustar al dictamen)

1. **Schema (aditivo):** `Invoice.type` admite `'ANT'` (anticipo) · `Invoice.deductsIds Json?`
   en la final (`{invoiceId, number, fecha, base, cuota}` por anticipo descontado; alternativa:
   tabla puente) · `Invoice.devengoAt DateTime?` (fecha de devengo congelada, según P1) ·
   opcional `Invoice.jobId Int?`.
2. **Emisión de anticipo:** el flujo de tramos actual marca `type:'ANT'` en tramos no-finales
   cuando el modo es `fiscal`; leyenda 75.Dos en PDF (texto según P5). En modo `receipt`
   (ES real, flag OFF) el comportamiento actual NO cambia ni un byte.
3. **Factura final:** acción nueva en el Job terminado → Invoice `F1` con líneas del total +
   **líneas NEGATIVAS por cada anticipo facturado** (nº y fecha en el concepto), IVA solo sobre
   lo pendiente (`calcVatBreakdown` ya lo resuelve). Según P3, también la final a 0 €.
4. **Guardas y pruebas:** el flag ya bloquea a reales vía `allocateInvoiceNumber`; validación en
   demo (watermark) para verlo visualmente; tests con el caso 50/50 del ticket (anticipo 100 € →
   final 200 € − 100 € con IVA solo del resto) + el caso 30/40/30 de céntimo impar; de paso,
   cerrar los dos `TODO(SCRUM-16/17)` del reparto línea-a-línea.
5. **Fuera de V1:** activación a reales (post-SIF + dictamen), UI para reales, cambios en R1.

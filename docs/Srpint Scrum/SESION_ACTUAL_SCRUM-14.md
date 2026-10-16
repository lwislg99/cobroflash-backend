# TAREA ACTIVA — SCRUM-14 · ALBARAN-1: partes de trabajo/albaranes NO fiscales colgando del Trabajo (V1)

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md` + el ticket Jira **SCRUM-14** (sus comentarios contienen las decisiones del fundador del 13-jul). NO dependas del chat.
> Flujo (AA1.2): `git checkout main && git pull` → rama **`scrum-14-albaranes`** → commits de feature + commit APARTE de docs/máster, TODOS en la rama → PR a `main` → merge del fundador. Transiciones de Jira a Finalizada: SOLO el asesor.
> 🚨 DOS ZONAS SENSIBLES: (1) **CAMBIO DE SCHEMA** (dominio del fundador: diff preview + OK antes de aplicar, siempre aditivo); (2) el albarán es NO FISCAL — su PDF y su UI JAMÁS dicen "factura", ni llevan QR, ni serie J-, ni pasan por getEmissionMode/VeriFactu (regla 24 intocable).

---

## DECISIONES DEL FUNDADOR (13-jul, en el ticket — NO reabrir)
- Gate F3 de validación con gremios: OMITIDO conscientemente (documentado).
- **SIN precios**: líneas = concepto/cantidad/unidad. Nada de importes en el albarán.
- **Firma OPCIONAL**: se puede emitir sin firma; "firmado" es estado superior. Firma el cliente **en el móvil del pro** (canvas reutilizado). Sin página pública ni link remoto.
- **SIN WhatsApp en V1**: solo PDF descargable. Ninguna plantilla Meta nueva.
- **Editable hasta firmar, congelado después**: `version` Int + traza en AuditLog.
- **Un albarán por visita/entrega**; el Trabajo acumula N.
- **Estados: `borrador | emitido | firmado`** → propuesta de cambio de máster (Parte L, regla 27) en el commit de docs ANTES del código.

## 0. CONTEXTO REAL DEL REPO (del reconocimiento 12-jul — confírmalo, no lo re-descubras)
- No existe nada de albarán en schema/src. Entidad NUEVA.
- **Job** (`schema.prisma:545-569`): contenedor natural; sin relaciones Prisma declaradas (estilo de la casa: `jobId Int` + resolución manual como `jobs.routes.ts:16`).
- **Invoice** (`schema.prisma:273-321`): patrón de documento (number, lines Json, pdfUrl, `@@unique([merchantId, number])`).
- **Numeración**: clonar `invoiceNumber.service.ts` (contador en Merchant, reserva transaccional, líneas 60-105).
- **Attachment** (`schema.prisma:612-625`): polimórfico; fotos = `entityType:'albaran'` (string nuevo, sin tocar schema).
- **AuditLog** (`schema.prisma:594-607`): la traza de versiones.
- **PDF**: `pdf.service.ts` con pdfkit; clonar `generateQuotePdf` (:367, bloque de firma :637-643); almacenamiento `public/…` servido estático; **regeneración bajo demanda obligatoria** (disco Railway efímero): clonar `ensureInvoicePdf` (`lib/invoicing.ts:18`).
- **Firma**: canvas + `signatureUrl` (data-URI) + `evidence` del flujo de decision (`quoteDecisionLanding.routes.ts:420`, `quotes.routes.ts:452-495`). Se reutiliza el patrón, NO el flujo público.
- **jobDetailView**: timeline "Documentos" en cliente (:137-173); patrón de re-fetch tras acción (:185). `serializeJobDetail` (`jobs.routes.ts:87-137`) devuelve base + invoices[].
- `sendWhatsAppDocument` es código muerto — NO usarlo, NO revivirlo.

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

### 1.1 Schema (ADITIVO — 🚨 STOP: diff preview al fundador antes de aplicar)
Modelo `Albaran`: `{id, merchantId Int, jobId Int, numero String, fecha DateTime, lineas Json, estado String @default("borrador"), version Int @default(1), signatureUrl String?, firmadoAt DateTime?, notas String?, pdfUrl String?, createdAt, updatedAt}` + `@@unique([merchantId, numero])` + `@@index([merchantId, jobId])`. En Merchant: `nextAlbaranNumber Int @default(1)` (+ año de serie si clonas el patrón anual). Nada se modifica ni borra; solo se añade. Aplicación con `db push` (mecanismo de la casa) tras el OK.

### 1.2 Numeración
`albaranNumber.service.ts` clonando `allocateInvoiceNumber`: formato **`ALB-YYYY-NNN`**, serie propia POR MERCHANT, reserva dentro de la transacción del create, reset anual si clonas el patrón. Test de correlatividad y de tenancy (exigidos por el ticket).

### 1.3 Endpoints (todos bajo auth admin, tenancy SIEMPRE por merchantId)
- `POST /admin/jobs/:id/albaranes` → crea borrador (asigna numero transaccional; `lineas` iniciales opcionales).
- `PATCH /admin/albaranes/:id` → editar lineas/notas/fecha SOLO si estado != 'firmado' → `version++` + AuditLog (qué cambió, cuándo). Si firmado → 409 `albaran_locked`.
- `POST /admin/albaranes/:id/emitir` → estado borrador→emitido (idempotente si ya emitido).
- `POST /admin/albaranes/:id/firmar` → body con firma base64 (mismo formato que decision) → `signatureUrl` + `firmadoAt` + estado 'firmado' + regenerar PDF con bloque de firma. Firmado = congelado.
- `GET /admin/albaranes/:id/pdf` → `ensureAlbaranPdf` (regenera si falta) → sirve el PDF.
- Fotos: reutilizar el flujo Attachment existente con `entityType:'albaran'`.
- `serializeJobDetail`: añadir `albaranes[]` (numero, fecha, estado, version, firmadoAt, pdfUrl) — ADITIVO.

### 1.4 PDF (`generateAlbaranPdf` + `ensureAlbaranPdf`)
Clonar el patrón de `generateQuotePdf`: cabecera del merchant (logo/banda), título **"ALBARÁN / PARTE DE TRABAJO"**, numero + fecha, datos del cliente y dirección del Trabajo, tabla de líneas SIN columna de precio (concepto/cantidad/unidad), notas, bloque de firma si `signatureUrl`, y pie: **"Documento no fiscal — no constituye factura. Generado con YaQu · yaqu.app"**. Prohibido: QR, serie J-, la palabra "factura" como título, importes.

### 1.5 UI (`jobDetailView.js`)
Sección **"Albaranes"** entre Documentos (:140) y Cobros (:178): lista (numero · fecha · estado · vN) + botones por estado: borrador → [Editar líneas] [Emitir]; emitido → [PDF] [Firmar] [Editar líneas]; firmado → [PDF] (nada más). "Firmar" abre el canvas (componente extraído del de decision) en el dispositivo del pro. Crear: botón "+ Nuevo albarán". Los albaranes aparecen también como eventos 📋 en el timeline de Documentos. Re-fetch tras cada acción (patrón :185). Copy EXACTO de estados en UI: "Borrador", "Emitido", "Firmado" — nada más (regla 30; los textos de botones aquí definidos son los canónicos).

### 1.6 Docs (commit APARTE, ANTES del código de estados)
Máster: (a) Parte L: estados del Albarán `borrador|emitido|firmado` + la entidad; (b) anotar en la línea del cajón F3 (~441) que ALBARAN-1 se construyó el 13-jul por decisión del fundador con el gate omitido (referencia al comentario de Jira); (c) numeración ALB- como serie NO fiscal independiente.

### 1.7 E2E AUTOMATIZADO (sección estándar nueva — parte del DONE)
- Prerequisito: el seed NO crea Jobs (las quotes se aceptan por Prisma directo sin `ensureJobForQuote`, `quotes.routes.ts:498`). Añadir al seed la creación de Jobs para las quotes aceptadas (o invocar ensureJobForQuote).
- Suite → v1.3, asserts nuevos: crear albarán desde el Trabajo → `ALB-2026-001` y el segundo `-002` (correlativo); editar borrador → version 2 visible; emitir; PDF sin "factura"/QR/precios; firmar (canvas) → estado Firmado + PDF con firma; editar firmado → bloqueado (409/UI); foto adjunta visible; tenancy: el albarán no aparece para otro merchant.
- Tras el merge del fundador: re-seed + suite v1.3 completa vía Playwright MCP + reporte.

**NO INCLUYE:** WhatsApp/plantillas Meta, página pública, precios/valoración, integración con cobros/facturación, tocar Invoice/Charge/webhooks, relaciones Prisma nuevas en Job, R2/almacenamiento externo.

## 5. 🚨 STOP CONDITIONS (AA1.4)
- **STOP 1 — Schema:** diff completo de `schema.prisma` al fundador ANTES de aplicar `db push`. Aditivo o no se aplica.
- **STOP 2 — Plan:** con el schema aprobado, enseña el plan de archivos + endpoints + los textos del PDF antes de codificar el grueso. (Un solo STOP combinado si prefieres: schema + plan juntos.)
- Si algo te empuja a tocar facturación, dinero, webhooks o WhatsApp → PARA.
- Hallazgos → reporte, no arreglo (regla 9).

## 6. DEFINICIÓN DE HECHO (Gate)
- Schema aditivo aplicado con OK del fundador; `db push` en staging y prod tras merge.
- Flujo completo en staging vía suite v1.3 (Playwright MCP) en verde: crear → editar (v2) → emitir → PDF limpio → firmar → congelado → foto → tenancy → numeración correlativa.
- E2E humano del fundador en yaqu.app: crear un albarán real en un Trabajo, firmarlo con el dedo, descargar el PDF y comprobar que un fontanero lo entendería.
- `npm run build` + `npm test` verdes (con los tests nuevos de numeración/tenencia/lock).
- PR con descripción; commit de docs/máster aparte; merge del fundador.

## 8. JIRA
Al abrir el PR: SCRUM-14 → "En revisión" con plan, diffs aplicados, tests, enlace del PR y resultado de la suite v1.3. NO transicionar a Finalizada (eso es del asesor tras el E2E humano).

## 9. ENTREGA
STOP 1+2 (schema + plan + textos PDF) → tras OK: archivos y por qué, tests y salida, resultado suite v1.3 con evidencia, checklist del E2E humano para el fundador, hallazgos aparte.

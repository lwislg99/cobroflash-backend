> ⚠️ Escrito bajo el protocolo anterior. Las reglas de proceso vigentes están en `docs/ASESOR.md`, que manda sobre lo que diga este documento.

# SESION_ACTUAL_SCRUM-72.md — Brief
**SCRUM-72 · 🔴 SEGURIDAD/RGPD · PDFs de factura Y presupuesto públicos y enumerables**
Carril B (Javier, delegado por Luis) · Prioridad **Highest** · Bloquea a SCRUM-25 · Nace del recon de SCRUM-25.
Estado: **v1.0 — APROBADO por el fundador con alcance ampliado y corrección de rumbo (§2).** Listo para ejecutar.

---

## 1. Cabecera

**Gobierna:** `YAQU_MASTER.md` (S3 seguridad, S4 RGPD, regla 16 conservación) + **el patrón de SCRUM-48** (léelo antes: es el mismo fix, ya hecho para albaranes) + ticket SCRUM-72.

**Flujo:** `git pull` → rama `scrum-72-pdfs-privados` → PLAN+diff al asesor → un commit → PR → lo revisa Luis → **mergeas y cierras tú**.

**🚨 ZONAS SENSIBLES:**
- 🚨 **`app.ts`** (quitar el mount estático) y **`dirs.ts`** = zona roja compartida → anúncialo en el ticket antes de commitear. *Luis confirma que SCRUM-68 no toca `email.service.ts`, así que no hay colisión ahí.*
- 🛑 **NO se toca el contenido ni la generación del PDF, ni nada de VeriFactu/fiscal.** Solo **dónde se guarda** y **cómo se sirve**. Si el arreglo empuja a tocar lógica fiscal → PARA.
- 🚨 Mergear = **deploy a producción** (Railway auto-deploy desde `main`).

---

## 2. Decisiones del fundador (cerradas — no reabrir)

**D1 — Alcance ampliado ✅:** entran **facturas Y presupuestos** (comparten `invoicesDir`, se mueven juntos).

**D2 — ❌ NO al token HMAC.** *Razón del fundador:* añadir otra superficie pública con otro esquema de tokens **mientras cerramos una fuga** es meter riesgo nuevo. Si algún día se quiere acceso web del cliente, va por el **portal que YA existe** (`/cliente/:token` con `portalToken`), no por un esquema nuevo.

**D3 — Se QUITA el botón "Ver documento" del email al cliente.** El mismo email **ya adjunta el PDF** (`email.service.ts:56`), así que el cliente **conserva el documento**. Los emails ya enviados pierden el botón, no el archivo. Coste real ≈ 0: **no hay clientes reales todavía**.

**D4 — `pdfUrl` legacy fuerza regeneración** (patrón SCRUM-48): no se confía en el valor persistido; si apunta al esquema viejo, se regenera y se resuelve al servir.

**D5 — `chargeId` enumerable → TICKET APARTE.** Termina de verificarlo; si `Charge.id` es autoincremental, `/recibo/:chargeId/pdf` es enumerable → **ticket propio** (mismo patrón). **NO entra en la 72.**

---

## 3. Contexto real (del recon — confírmalo, no lo re-descubras)

- **El mount:** `app.ts:116` `app.use('/invoices', express.static(invoicesDir))` **y** `app.ts:123` `app.use(express.static(publicDir))`. Como `invoicesDir = public/invoices`, **quitar solo la 116 NO arregla nada** — el estático general los seguiría sirviendo. Mover a `storage/` los saca de ambos. *(Verificado en el recon.)*
- **Nombres enumerables:** `invoiceNumber.service.ts:40` → `2026-CF-001`, `-002`…
- **Regeneración:** `ensureInvoicePdf(invoiceId, prisma)` (`invoicing.ts:18`) → migrar es gratis, el fs de Railway es efímero.
- **Endpoint auth ya existente:** `GET /admin/invoices/:id/pdf` (`invoicesAdmin.routes.ts:683`).
- **El email:** `email.service.ts:43` `ctaUrl: ${BASE_URL}${pdfUrl}` ← el botón a quitar. `:56` adjunta el PDF (se mantiene). `:122-123` lee PDFs de **presupuesto** de ese dir para adjuntarlos.
- **URL absoluta persistida:** `invoicing.ts:219` guarda `pdfUrl` como `${BASE_URL}/invoices/{number}.pdf`.
- **Presupuestos:** `pdf.service.ts:361,683` devuelven `publicUrlPath: /invoices/${fileName}`; `quotes.routes.ts:174` lo guarda en `quote.pdfUrl`.
- **Ruta de recibo (NO se toca aquí):** `/recibo/:id/pdf` (`receipt.routes.ts:403`) es pública por diseño y usa `ensureInvoicePdf`. Sigue funcionando tras el movimiento. Su posible enumerabilidad → D5, ticket aparte.

---

## 4. Alcance EXACTO

1. **`dirs.ts`:** `invoicesDir` → **`storage/invoices`** (fuera de `public/`), patrón SCRUM-48.
2. **`app.ts:116`:** eliminar el mount estático de `/invoices`. *(El general de `:123` se queda: ya no alcanza los PDFs.)*
3. **Nombre de archivo con `merchantId`** — mata también la **colisión entre merchants** (hoy dos merchants con `2026-CF-001` se pisan el PDF; mismo defecto de integridad que tenía albaranes).
4. **`pdfUrl` legacy → regeneración (D4):** al servir, no confiar en el valor persistido; si es del esquema viejo, regenerar con `ensureInvoicePdf` y resolver la ruta al vuelo.
5. **Email (`email.service.ts`):** **quitar el `ctaUrl` / botón "Ver documento"**. **MANTENER el adjunto** (`:56`) — es lo que garantiza que el cliente conserva su documento.
6. **⚠️ Presupuestos:** actualizar `pdf.service.ts:361,683` y verificar que **el adjunto de presupuesto del email (`:122-123`) sigue leyendo bien** tras el movimiento. **Punto crítico:** si algún sitio construye la ruta de disco a partir del **string de `pdfUrl`** (en vez de la constante de `dirs.ts`), moverlo **rompe el adjunto en silencio**. Búscalo explícitamente.
7. **Servir siempre** por el endpoint auth+tenancy existente.

---

## 5. Fuera de alcance

- ❌ Token HMAC / nuevo esquema de acceso público (D2).
- ❌ Acceso web del cliente a la factura (si se quiere algún día → portal existente `/cliente/:token`).
- ❌ `chargeId` enumerable → ticket aparte (D5).
- ❌ Contenido/generación del PDF, VeriFactu, cualquier lógica fiscal.
- ❌ Migrar ficheros existentes (D4: se regeneran).

---

## 6. STOP conditions

- 🛑 Si el fix empuja a tocar lógica fiscal/VeriFactu → PARA.
- 🛑 Si al mover el dir se rompe el **adjunto** del email (factura o presupuesto) → PARA y reporta: el adjunto es lo que sostiene la D3.
- 🛑 `app.ts` / `dirs.ts` zona roja → anunciar en el ticket antes de commitear.
- 🛑 Si aparece otro flujo de cara al cliente que dependa del estático (no detectado en el recon) → PARA y reporta.

---

## 7. Tests

Datos efímeros propios + limpieza en `finally`. **Nunca seed demo** (lección SCRUM-63).

- **Estático muerto:** `GET /invoices/2026-CF-001.pdf` (nombre viejo) → **404**.
- **Estático muerto (nombre nuevo):** `GET /invoices/<merchantId>-2026-CF-001.pdf` → **404**.
- **Tenancy:** `GET /admin/invoices/:id/pdf` de **otro merchant** → 404.
- **Feliz:** `GET /admin/invoices/:id/pdf` propio → 200, y **regenera** con el nombre nuevo si falta.
- **Legacy (D4):** invoice con `pdfUrl` absoluto viejo en BD → al servir, regenera y responde 200 (no 404 ni fichero viejo).
- **Presupuesto:** su PDF tampoco es accesible por estático → 404.
- **🔒 ASSERT DE REGRESIÓN (el que blinda esto para siempre):** que **ningún mount estático exponga los PDFs** — el test debe **fallar si alguien reintroduce** el mount o devuelve el dir a `public/`.
- *(Ojo al montar los tests: `/recibo/:id/pdf` sigue siendo pública **por diseño** y debe seguir en 200. No la confundas con una fuga.)*
- Registrar en `package.json` si creas fichero. Sección en `SUITE_REGRESION.md`.

---

## 8. Definición de Hecho

- `npm run build` + `QA_DB_TEST=1 npm test` contra **STAGING** en verde (el fallo `A12.2c`/SCRUM-63 es preexistente y ajeno).
- PR con descripción; **anuncio de zona roja** (`app.ts`/`dirs.ts`) en el ticket; lo revisa Luis; **mergeas y cierras tú**.
- **Verificación humana en yaqu.app tras el deploy:** (a) `yaqu.app/invoices/<un-numero-real>.pdf` → **404**; (b) descarga de factura desde el dashboard admin → **OK**; (c) email de factura → **llega con el PDF adjunto** y sin botón roto.
- Hallazgos → ticket aparte (regla 9). **Desbloquea SCRUM-25.**

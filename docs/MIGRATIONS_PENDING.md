# Migraciones de schema pendientes de aplicar a producción

> El deploy de Railway **NO** aplica el schema automáticamente (start = `node dist/index.js`).
> Hay que correr `prisma db push` manualmente contra la BD de producción **antes** (o justo
> al desplegar) de que el código use la nueva tabla/columna.

## SCRUM-66 · `jobs.tipo_operacion` (varias sueltas vs trabajo único) — ✅ APLICADO en prod (2026-07-22)

`prisma db push` aplicado a **STAGING** (`acela.proxy.rlwy.net`) y a **PRODUCCIÓN**
(`autorack.proxy.rlwy.net:40654`) el **2026-07-22**, ambos con host-check + preview `migrate diff`,
**SIN `--accept-data-loss`** (Prisma no lo pidió = confirmación de que no había pérdida de datos).
El de prod, **autorizado por el fundador** (GO explícito tras el preview) vía el sentinel de un solo
uso del hook `guard-dangerous` (`.claude/allow-db-push`), aplicado tras el merge del **PR #43**.
Verificación post-push en ambos: `migrate diff` → **"empty migration"** (BD en sync). 100 % aditivo,
una sola columna **NOT NULL con default** → los Jobs existentes quedan en `TRABAJO_UNICO` sin backfill:
```sql
ALTER TABLE "jobs" ADD COLUMN "tipo_operacion" TEXT NOT NULL DEFAULT 'TRABAJO_UNICO';
```
`Job.tipoOperacion` (`OPERACIONES_SUELTAS|TRABAJO_UNICO`): distingue varias operaciones sueltas
(recapitulativa mensual, art. 13) de un trabajo único (factura al concluir). El código lo lee/escribe
en `PATCH /admin/jobs/:id` y lo expone en `serializeJob` → aplicado tras el merge para cerrar la
ventana de P2022 del auto-deploy. El motor que RESPETA la bandera es SCRUM-17 (aún no construido).

---

## SCRUM-68 · `albaranes.evidencia_firma` (evidencias probatorias de la firma) — ✅ APLICADO en prod (2026-07-22)

`prisma db push` aplicado a **STAGING** (`acela.proxy.rlwy.net`) el **2026-07-22**, con host-check +
preview `migrate diff`, **SIN `--accept-data-loss`**. Post-push staging: `migrate diff` → **"empty
migration"**. 100 % aditivo, una sola columna **nullable sin default** (no hay UNIQUE → `db push`
NO pide `--accept-data-loss`):
```sql
ALTER TABLE "albaranes" ADD COLUMN "evidencia_firma" JSONB;
```
Guarda `{ v, canal(remoto|in_situ), firmadoAt, ip, ua, tokenId, firmante, hashAlg, contentHash }` al
firmar. El `contentHash` es SHA-256 del **contenido canónico** del albarán (no del PDF). ⚠️ `ip`/`ua`
son datos personales → viven SOLO en esta columna; NUNCA se exponen (serializer, PDF y HTML público
los omiten — cubierto por test).

**PROD: ✅ APLICADO** (2026-07-22, justo tras el merge del **PR #38**). `prisma db push` contra
`autorack.proxy.rlwy.net:40654` con host-check + preview `migrate diff` (una sola sentencia
`ADD COLUMN evidencia_firma JSONB`) y **GO explícito del fundador** vía el sentinel de un solo uso del
hook `guard-dangerous` (`.claude/allow-db-push`), **SIN `--accept-data-loss`** (Prisma no lo pidió =
confirmación de que era 100 % aditivo). Resultado: *"Your database is now in sync"* en 6,68 s.
Verificación post-push: `migrate diff` → **"empty migration"** (BD en sync). Se aplicó de inmediato tras
el merge para cerrar la ventana de P2022: los handlers de firma escriben `evidenciaFirma` en cada firma.

---

## SCRUM-49 · `albaranes.firma_token` + `enviado_para_firma_at` (firma remota) — ✅ APLICADO en prod (2026-07-16)

`prisma db execute` (NO `db push`) aplicado a **STAGING** (`acela.proxy.rlwy.net`) y a **PRODUCCIÓN**
(`autorack.proxy.rlwy.net`) el **2026-07-16**, con host-check + preview `migrate diff`, **SIN
`--accept-data-loss`**. Verificación post en ambos: `migrate diff` → **"empty migration"** (BD en
sync). El de prod, **autorizado por el fundador** (GO explícito tras el preview), aplicado justo tras
el merge para cerrar la ventana de P2022 del auto-deploy. 100 % aditivo:
```sql
ALTER TABLE "albaranes" ADD COLUMN "enviado_para_firma_at" TIMESTAMP(3),
                        ADD COLUMN "firma_token" TEXT;
CREATE UNIQUE INDEX "albaranes_firma_token_key" ON "albaranes"("firma_token");
```
**Por qué `db execute` y no `db push`:** `db push` exigía `--accept-data-loss` por el **falso
positivo del UNIQUE sobre columna nueva** — Prisma no puede verificar en tiempo de diff que no haya
duplicados en `firma_token`, aunque la columna nace toda `NULL` (0 duplicados posibles). El flag está
vetado (regla 3/AA2), así que se aplica el SQL auditado vía `db execute` (**mismo patrón que el
`@unique` de `merchants.slug` en el lote EXT3**, ver abajo). El SQL es idéntico al del preview.

**PROD: ✅ APLICADO** (2026-07-16, justo tras el merge). El código referencia `firmaToken`/
`enviadoParaFirmaAt` (los handlers de albarán hacen `findFirst`/`findUnique` sin `select` → `RETURNING`
todas las columnas), así que se aplicó de inmediato para cerrar la ventana de P2022 del auto-deploy.
Token opaco (128 bits) para la página pública `/albaran/:token`.

---

## SCRUM-52 · `jobs.operario_id` + índice (base de SCRUM-22) — ✅ APLICADO en prod (2026-07-15)

`prisma db push` aplicado a **STAGING** (`acela.proxy.rlwy.net`) y a **PRODUCCIÓN**
(`autorack.proxy.rlwy.net:40654`) el **2026-07-15**, ambos con host-check + preview
`migrate diff` mostrado al fundador, **SIN `--accept-data-loss`** (100 % aditivo; Prisma
no lo pidió = confirmación de que no había pérdida de datos). El de prod, **autorizado por
el fundador** (GO explícito tras el preview) vía el sentinel de un solo uso del hook
`guard-dangerous` (`.claude/allow-db-push`). Test gateado `tests/scrum52-operario.test.mjs`
verde contra staging (poblado operarioId + audit `operario_asignado` + índice en `pg_indexes`).
Verificación post-push en prod: `migrate diff` → **"empty migration"** (BD en sync). Preview exacto:
```sql
ALTER TABLE "jobs" ADD COLUMN "operario_id" INTEGER;
CREATE INDEX "jobs_merchant_id_operario_id_idx" ON "jobs"("merchant_id", "operario_id");
```
Columna nullable (null = propietario) + índice compuesto `(merchant_id, operario_id)`;
documento NO fiscal (regla 24).

---

## SCRUM-14 · ALBARAN-1: tabla `albaranes` + contadores en `merchants` — ✅ APLICADO en prod (2026-07-13)

`prisma db push` aplicado a **STAGING** el 13-jul-2026 y a **PRODUCCIÓN** el 13-jul-2026
tras el merge del PR #8, ambos **autorizados por el fundador** (preview `migrate diff`
enseñado en cada caso; el de prod se ejecutó SIN `--accept-data-loss` por orden expresa —
con diff aditivo no hace falta, y si Prisma pidiera confirmación sería señal de diff
inesperado → abortar). Verificación post-push en prod: `migrate diff` → **empty migration**.
100 % aditivo; el preview mostró exactamente:
```sql
ALTER TABLE "merchants" ADD COLUMN "albaran_series_year" INTEGER,
                        ADD COLUMN "next_albaran_number" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "albaranes" (…);  -- + índices (merchant_id,job_id) y UNIQUE (merchant_id,numero)
```
Documento NO fiscal (regla 24): fuera de VeriFactu.

---

## FASE 3 · MEDIA-1: `attachments.data/mime` — ✅ APLICADO en prod (2026-07-07)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (eligió backend
"Postgres ahora" para las fotos del bot). 100 % aditivo, 2 columnas nullable; preview con
`migrate diff` mostró exactamente:
```sql
ALTER TABLE "attachments" ADD COLUMN "data" BYTEA,
                          ADD COLUMN "mime" TEXT;
```
Almacenamiento de fotos entrantes de WhatsApp en Postgres (bytea) al no haber R2; el modelo
`Attachment` abstrae el backend (migrar a R2 luego = plug-in). Aplicado ANTES de pushear el
código de FASE 3. `db push` → "Your database is now in sync" en 6,68 s.

---

## A3.1 · BOT-1: `bot_sessions` + `quote_requests.zone/source` — ✅ APLICADO en prod (2026-07-03)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (respuesta explícita
"Sí, aplica el db push"). 100 % aditivo; post-push `migrate diff` → "empty migration":
- `CREATE TABLE bot_sessions` (sesiones del bot K1: phone, merchant_id, state, data, expires_at +24h) + índice (phone, expires_at)
- `ALTER TABLE quote_requests ADD COLUMN zone TEXT, ADD COLUMN source TEXT`
El bot queda inerte hasta `BOT_INBOUND_ENABLED=true` (Railway, acción fundador).

---

## A2.1 · Connect/Bizum/payMethods — ✅ APLICADO en prod (2026-07-03)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (respuesta explícita
"Sí, aplica el db push" al diff mostrado). 100 % aditivo, 5 operaciones; post-push verificado
`migrate diff` → "empty migration":
```sql
ALTER TABLE "merchants" ADD COLUMN "stripe_account_id" TEXT,
                        ADD COLUMN "connect_status" TEXT NOT NULL DEFAULT 'none',
                        ADD COLUMN "bizum_phone" TEXT;
ALTER TABLE "quotes"    ADD COLUMN "pay_methods" JSONB;
ALTER TABLE "charges"   ADD COLUMN "pay_methods" JSONB;
```
Soporta CONNECT-1 (C1-0..C1-2), Bizum manual (C1-4) y el selector de métodos por
presupuesto/cobro. Aplicado ANTES de pushear el código (commits A2.1–A2.3).

---

## A1.2 · `quotes.quote_number` + `merchants.next_quote_number` — ✅ APLICADO en prod (2026-07-02)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** (sprint DEMO-READY,
OK explícito tras preview). Aplicó SIN `--accept-data-loss` (Prisma no lo pidió = confirmación
de que era 100 % aditivo). Diff previsualizado, 2 operaciones:
```sql
ALTER TABLE "merchants" ADD COLUMN "next_quote_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "quotes"    ADD COLUMN "quote_number"      INTEGER;
```
Numeración de presupuestos POR MERCHANT (el id global delataba el volumen de la plataforma:
el primer presupuesto de un merchant nuevo salía "#47"). Aplicado ANTES de pushear el código.
Post-deploy: backfill con `scripts/backfill-quote-numbers.mjs --apply` (dry-run primero).

---

## WA-0b · tabla `whatsapp_messages` — ✅ APLICADO en prod (2026-06-13)

`prisma db push` aplicado contra Railway, **autorizado por el fundador** ("dame OK para el
push"). 100 % aditivo (tabla nueva + 3 índices, sin ALTER/DROP). Post-push: `migrate diff`
→ "empty migration" (BD en sync). El log de entrega de WhatsApp y el chip ya operan sobre
datos reales en cuanto haya envíos.

---

## V0-3 · `merchants.acquisition_source` + `quotes.created_via` — ✅ APLICADO en prod (2026-06-12)

`prisma db push` aplicado contra Railway, **autorizado por el usuario** (además pre-autorizó
los db push 100% aditivos del resto del sprint VALIDA-0, siempre con preview verificado).
Diff previsualizado, 2 operaciones aditivas nullable:
```sql
ALTER TABLE "merchants" ADD COLUMN "acquisition_source" TEXT;
ALTER TABLE "quotes" ADD COLUMN "created_via" TEXT;
```
Post-push verificado: `migrate diff` → "empty migration" (BD en sync). Aplicado ANTES de
pushear el código de V0-3.

---

## J3 · `customers.wa_opt_out` (baja de WhatsApp) — ✅ APLICADO en prod (2026-06-11)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway), **autorizado por el
usuario** (vía sentinel del hook guard-dangerous). Diff previsualizado con `migrate diff`,
100% aditivo (una sola operación):
```sql
ALTER TABLE "customers" ADD COLUMN "wa_opt_out" BOOLEAN NOT NULL DEFAULT false;
```
Aplicado ANTES de pushear el código de J3 (el código referencia `waOptOut`; en orden
inverso Prisma habría dado P2022 en prod).

Verificación post-push pendiente en yaqu.app: editar un cliente marcando "Baja de
WhatsApp" y comprobar que el envío de presupuesto a ese cliente devuelve `reason: wa_opt_out`.

---

## SPAIN-2 · Factura rectificativa — ✅ APLICADO en prod (2026-06-10)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway), autorizado por el usuario.
Diff previsualizado con `migrate diff`, 100% aditivo:
- `ALTER TABLE invoices ADD COLUMN type TEXT NOT NULL DEFAULT 'F1'` (F1 | R1)
- `ALTER TABLE invoices ADD COLUMN rectifies_id INTEGER` (nullable, FK self a invoices.id, ON DELETE SET NULL)
- `ALTER TABLE merchants ADD COLUMN next_rect_invoice_number INTEGER NOT NULL DEFAULT 1` (serie R)

---

## SPAIN-1 · Serie anual de facturación — ✅ APLICADO en prod (2026-06-10)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway), autorizado por el usuario.
Diff previsualizado con `migrate diff` y confirmado seguro (3 operaciones, sin pérdida de datos):
- `ALTER TABLE merchants ADD COLUMN invoice_series_year INTEGER` (nullable, aditivo)
- `DROP INDEX invoices_number_key` (unique global de `number` — colisionaba entre merchants con el mismo prefijo)
- `CREATE UNIQUE INDEX invoices_merchantId_number_key ON invoices(merchantId, number)` (la serie es del emisor)

El create del índice compuesto no podía fallar: no existían duplicados `(merchantId, number)`
(el unique global previo lo garantizaba). Nadie consulta facturas por `number` solo (verificado por grep).

---

## ENT-3 · `CustomerEvent` (historial de comunicaciones) — ✅ APLICADO en prod (2026-06-05)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway). Diff confirmado
solo aditivo (CREATE TABLE customer_events + 2 índices + 2 FKs, sin DROP/ALTER).
Verificado: `customerEvent.count()` = 0. Instrucciones abajo conservadas como referencia.

---

### (Referencia) ENT-3 · `CustomerEvent`

**Commit del código:** ver feat(enterprise) ENT-3.
**Tabla nueva:** `customer_events` (modelo `CustomerEvent` en `prisma/schema.prisma`).
**Solo aditivo** (no toca tablas existentes): seguro con `db push`.

El código es tolerante: si la tabla aún no existe, `recordCustomerEvent` y
`listCustomerEvents` capturan el error y la app sigue funcionando (no se registra
ni se muestra historial hasta aplicar el push).

### Cómo aplicar (con la DATABASE_URL de PRODUCCIÓN)

```bash
# 1) Apuntar a la BD de prod (NO usar la de dev). Por ejemplo, temporalmente:
#    set DATABASE_URL=postgresql://...autorack.proxy.rlwy.net.../railway   (la real de Railway)
# 2) Aplicar el schema (sin TTY, como exige este entorno):
npx prisma db push --accept-data-loss
# 3) En Windows, si el DLL queda bloqueado tras el push: matar node y:
npx prisma generate
```

> Nota: `--accept-data-loss` aquí es seguro porque el cambio es **solo añadir** la tabla
> `customer_events`; no elimina ni altera columnas existentes. Verificar el diff antes si hay dudas.

### Verificación post-push
- En el dashboard, abrir la ficha 360 de un cliente con actividad (envía un presupuesto,
  acéptalo, etc.) → debe aparecer la sección "Actividad reciente".
- `GET /admin/customers/:id/detail` debe devolver `events: [...]`.

---

## 5-jul-2026 — A6.7 Home personalizable (APLICADA ✅)

```sql
ALTER TABLE "merchants" ADD COLUMN "home_prefs" JSONB;
```

- Aditiva y anulable; aprobada por el fundador en sesión (AskUserQuestion) y aplicada
  con `npx prisma db push` tras preview del diff. Default lógico: todo visible
  (null = sin preferencias).

### Verificación post-push
- Home → botón "Personalizar" → desmarcar un bloque → Guardar → recargar: el bloque
  sigue oculto (persistencia en BD, no en el navegador).

---

## 5-jul-2026 — A10.1 evidencia legal (APLICADA ✅)

```sql
CREATE TABLE "legal_acceptances" (id, merchant_id, team_member_id NULL, doc_key, version, ip NULL, user_agent NULL, created_at);
CREATE INDEX ON legal_acceptances(merchant_id, doc_key);
```

- Aditiva; aprobada por el fundador en sesión (AskUserQuestion, EXT3 A10.1).
- Evidencia de aceptación del ALCANCE BETA (regla 25): version = hash del texto
  servido en /legal/alcance-beta → texto nuevo del asesor invalida aceptaciones.

### Verificación post-push
- Planes → "Quiero mi plaza founding" → modal con iframe del alcance + checkbox
  → aceptar → fila en legal_acceptances → checkout continúa. Sin aceptar: 412.

---

## 5-jul-2026 — LOTE EXT3 completo (APLICADO ✅, una aprobación)

```sql
ALTER TABLE merchants ADD subscription_status, slug (+unique), slug_changed_at, profile_zones, profile_years;
ALTER TABLE quotes    ADD origin, valid_until, doc_fields;
ALTER TABLE customers ADD legal_name, tax_id;
CREATE TABLE jobs (A13) · maintenance_plans (A15) · audit_log (A11.1) · attachments (Ola 19) + índices;
```

- 0 DROPs, todo aditivo; aprobado por el fundador en sesión (AskUserQuestion, EXT3).
- Aplicado vía `prisma db execute` con el SQL del diff AUDITADO (0 sentencias destructivas,
  14 aditivas): `db push` exigía --accept-data-loss por el falso positivo del UNIQUE sobre
  la columna slug recién creada (todo NULL — sin duplicados posibles) y ese flag está vetado.
- Todo nace INERTE: cada ola cablea su pieza; attachments espera credenciales R2.

---

## 6-jul-2026 — merchants.flags (APLICADO ✅)

```sql
ALTER TABLE "merchants" ADD COLUMN "flags" JSONB;
```

- Aditiva, 0 DROPs; aprobada por el fundador (AskUserQuestion, A14.3) — la aprobación
  del lote EXT3 no la cubría y el clasificador exigió (con razón) un OK fresco.
- Mecanismo Parte P de overrides POR merchant ({FLAG_NAME: bool}); lo lee core/flags.ts
  (precedencia merchant > país > env > default). Escritura solo manual/fundador.
- Primer uso: PUBLIC_PROFILE_ENABLED=true SOLO en demo (id=1). Ningún otro merchant
  tiene flags (verificado count=0).

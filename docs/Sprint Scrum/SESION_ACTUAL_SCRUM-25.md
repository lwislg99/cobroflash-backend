> ⚠️ Escrito bajo el protocolo anterior. Las reglas de proceso vigentes están en `docs/ASESOR.md`, que manda sobre lo que diga este documento.

# SESION_ACTUAL_SCRUM-25.md — Brief
**SCRUM-25 · EXPORT-1 · Base de datos descargable (ZIP: facturas PDF+XML + CSVs)**
Carril B (Javier) · labels `dev2`, `export`, `legal`, `datos` · Fase F2 · Última de la cola del carril B.
Estado: **v1.0 — DESBLOQUEADA** (SCRUM-72 cerrada). Alcance revisado tras el re-recon del 22-jul: parte del trabajo ya la hicieron SCRUM-72 y SCRUM-73.
⚠️ **Precondición para implementar (no para planificar): OK de Luis a la dependencia `archiver`** (regla 36).

---

## 1. Cabecera

**Gobierna:** `YAQU_MASTER.md` (**S4** export/RGPD, **S1** exports = ❌ Técnico, **S2** audit, **regla 16** conservación fiscal, **regla 24** XML solo post-SIF) + ticket SCRUM-25 + `DESIGN.md`.

**Flujo:** `git pull` → rama `scrum-25-export-zip` → PLAN+diff al asesor → un commit → PR → lo revisa Luis → **mergeas y cierras tú**.

**🚨 ZONAS SENSIBLES:**
- 🚨 **`app.ts`** (gate del router) y **`adminOnlyRoutes.ts`** → zona roja aditiva, anunciar en el ticket.
- 🚨 **`settingsView.js`** es de facto del carril A → **anunciar en el ticket** antes de tocarlo (§4.2). No es un veto: solo coordinación.
- 🚨 **`audit.service.ts`** (literal nuevo en `AuditAction`) → módulo system, anunciar.
- 🛑 **Zona fiscal:** NO se toca el generador de XML ni su lógica. Solo se **reutiliza** el gate ya existente. Si algo empuja a tocar VeriFactu → PARA.
- 🚨 **`archiver`**: NO instalar sin el OK explícito de Luis (regla 36).

---

## 2. Qué ha cambiado desde el recon original (leer antes que nada)

**✅ Ya resuelto por otros — NO lo rehagas:**
1. **`verifactu.xml` ya está gateado** (SCRUM-73): `requireRole('admin')` + `isFlagEnabled('INVOICING_ES_ENABLED', { merchant })` → 404 neutro antes de tocar BD, y está en `ADMIN_ONLY_ROUTES`. **La frontera fiscal que había que diseñar ya existe: se reutiliza tal cual.**
2. **PDFs fuera de `public/`** (SCRUM-72): `invoicesDir = storage/invoices`. **Desaparece el bloqueante**: generar los PDFs para el ZIP ya no los publica.

**❌ Sigue pendiente:** el gate admin de los 4 CSVs, y todo el alcance funcional (ZIP, CSVs nuevos, rango, front, audit).

---

## 3. Decisiones (cerradas — no reabrir)

**D1 — El gate admin de `/admin/exports` ENTRA en SCRUM-25.** No es hallazgo ajeno: el DONE del ticket ya exige *"Solo Admin puede exportar (regla S1)"*. Y sería incoherente gatear el ZIP dejando abiertos los CSVs que exponen los mismos datos. Hoy un Operario puede bajarse `customers.csv` (con teléfono y email de todos los clientes), `invoices.csv`, `expenses.csv` y `quotes.csv`.

**D2 — `settingsView.js` lo toca el carril B, anunciándolo en el ticket.** Crear una vista nueva para un solo botón sería peor. Luis lo revisa en el PR.

**D3 — El XML reutiliza el patrón de SCRUM-73**, no se diseña nada nuevo: `isFlagEnabled(...)` → si OFF, el ZIP se genera **sin** la carpeta del XML, en silencio y sin error.

**D4 — `archiver` es la librería recomendada**, pendiente del OK de Luis. Streaming real (`.pipe(res)`, backpressure resuelto). `jszip` descartada: carga todo en memoria.

---

## 4. Contexto real del repo (del re-recon — confírmalo, no lo re-descubras)

**Infra CSV ya resuelta y reutilizable** (`exports.routes.ts`): `csvEscape`/`csvRow` :11-21 · `parseDateFilter` :23 · `sendCsv` :30 con **BOM UTF-8 + CRLF** → el requisito "abre en Excel sin romperse" **ya está cubierto**, no lo reinventes.

**Endpoints existentes:** `/customers.csv` :42 (sin rango) · `/invoices.csv` :68 (from/to/status, **sin desglose base/IVA** :87) · `/expenses.csv` :306 · `/quotes.csv` :349 · `/fees.csv` :112 (gate `isOwnerEmail`) · `/verifactu.xml` :188 (✅ gateado).

**PDFs:** `ensureInvoicePdf(invoiceId, prisma)` regenera bajo demanda y devuelve el `diskPath` en `storage/invoices`. **Nunca leer `pdfUrl` crudo.**

**Audit:** `recordAudit` (`audit.service.ts:23`) ya acepta todo lo necesario; falta el literal en el union `AuditAction`.

**Desglose IVA:** `calcVatBreakdown` **ya está importado** en `exports.routes.ts` → resolver base/IVA es reutilizar, no crear.

---

## 5. Alcance EXACTO V1

**A) Seguridad (D1) — primero, es 1 línea:**
- `requireRole('admin')` al montar `/admin/exports` (`app.ts:285`) + entradas de las rutas en `ADMIN_ONLY_ROUTES` → la suite A12.4 pasa a exigir 403 al Técnico automáticamente.

**B) Endpoint del ZIP:**
- `GET /admin/exports/datos.zip?from&to` — admin-only + en `ADMIN_ONLY_ROUTES`.
- **Streaming obligatorio:** `archive.pipe(res)` y cada PDF con `createReadStream` sobre el `diskPath` de `ensureInvoicePdf`, **uno a uno**. ⛔ Nunca `readFileSync` ni acumular en un buffer.
- Estructura del paquete (según el ticket):
  - `/facturas/` → PDFs + (si `INVOICING_ES_ENABLED`) el XML VeriFactu reutilizando el gate de SCRUM-73; **omitido limpio si OFF**.
  - `/csv/` → `clientes.csv`, `cobros.csv`, `trabajos.csv`, `presupuestos.csv`, `facturas.csv`.

**C) CSVs — reutilizar los builders existentes** (extraer a funciones puras para no duplicar lógica):
- **Nuevos:** `cobros.csv` (con `paid_via`, fecha, método) y `trabajos.csv`.
- **Enriquecer** `facturas.csv` con **base e IVA desglosados** vía `calcVatBreakdown` (lo pide el DONE).
- **Rango de fechas global** aplicado a todo; añadir `from/to` a `customers.csv`, que hoy no lo acepta.

**D) Audit (S2):** literal `datos_exportados` en `AuditAction` + `recordAudit({ merchantId, teamMemberId, action, meta: { rango, ficheros }, ip })`.

**E) Front:** en Configuración, card **"Descargar mis datos"** con selector de rango. Solo Admin (la sección ya es admin-only). Vanilla, `DESIGN.md`, digno 390/1280. **Sin copy inventado** (regla 30): textos descriptivos y neutros.

---

## 6. Fuera de V1

- ❌ RGPD de supresión/anonimizado (S4) · export programado · R2/almacenamiento externo.
- ❌ Tocar el generador de XML o cualquier lógica fiscal (solo se reutiliza el gate).
- ❌ `fees.csv` en el ZIP: es interno de plataforma (`isOwnerEmail`), no del merchant.

---

## 7. ⚠️ Riesgo a resolver en el PLAN: tiempo de generación

`ensureInvoicePdf` **renderiza** el PDF si falta. Un merchant con cientos de facturas → cientos de renders en una sola petición HTTP → **riesgo de timeout** (el streaming resuelve la memoria, **no el tiempo total**).

**A decidir en el PLAN y reportar:** ¿se exige rango de fechas obligatorio? ¿se cap­a el número de documentos? ¿se acepta el riesgo en V1 dado que no hay clientes reales? **Recomendación del asesor:** medir con el dataset de staging y, si el tiempo se dispara, exigir rango o capar en V1 y anotar el export asíncrono como ticket futuro. **No lo decidas en silencio: repórtalo.**

---

## 8. STOP conditions

- 🛑 **No instalar `archiver`** sin el OK explícito de Luis (regla 36). Si no ha llegado → PARA y reporta.
- 🛑 Si algo empuja a tocar el generador de XML, VeriFactu o flags fiscales → PARA.
- 🛑 Zona roja (`app.ts`, `adminOnlyRoutes.ts`, `audit.service.ts`, `settingsView.js`) → anunciar en el ticket antes de commitear.
- 🛑 Si el ZIP tentara a cargar PDFs en memoria → PARA y replantea con streaming.

---

## 9. Tests

Datos efímeros propios + limpieza en `finally`. **Nunca seed demo** (lección SCRUM-63). Contra **staging**.

- **Técnico → 403** en `/admin/exports/datos.zip` **y en los 4 CSVs** (lo cubre A12.4 al añadirlos a `ADMIN_ONLY_ROUTES`).
- **Tenancy (regla 2):** el ZIP de un merchant no contiene datos de otro.
- **Contenido:** el ZIP trae las entradas esperadas (`/csv/*.csv` y `/facturas/*.pdf`).
- **Flag fiscal:** con `INVOICING_ES_ENABLED` **OFF** → el ZIP se genera **sin** XML y **sin error**; con ON → lo incluye.
- **CSV:** BOM UTF-8 presente; `facturas.csv` trae base e IVA; el rango de fechas filtra de verdad.
- **Audit:** exportar deja registro `datos_exportados`.
- Registrar el fichero en `package.json` (bug P3-7) + sección en `SUITE_REGRESION.md` (§7 Operarios ya existe; crea la que toque sin duplicar numeración).

---

## 10. Definición de Hecho

- `npm run build` + `QA_DB_TEST=1 npm test` contra staging en verde (el fallo `A12.2c`/SCRUM-63 es preexistente y ajeno).
- PR con descripción + anuncio de zona roja; lo revisa Luis; **mergeas y cierras tú**.
- **Verificación humana en yaqu.app:** descargar el ZIP como admin → se abre, los CSVs se ven bien en Excel, los PDFs se abren, y los datos **cuadran con lo que muestra la app**. Con sesión de Técnico → 403.
- Capturas 390/1280 de la card de Configuración.
- Hallazgos → ticket aparte (regla 9).

# TAREA ACTIVA — SCRUM-49 · ALBARAN-3: firma REMOTA del albarán por WhatsApp (V1)

> Gobierna: `docs/YAQU_MASTER.md` + el ticket **SCRUM-49** + este brief. NO dependas del chat.
> Flujo: `git checkout main && git pull` → rama(s) según §0.5 → PR (lo crea Luis a mano, NO uses gh) → merge de Luis → suite QA.
> 🚨 ZONA SENSIBLE: superficie PÚBLICA nueva (`/albaran/:token`) + envío a cliente + schema. Guards completos y token opaco obligatorios. Toca `jobDetailView.js` (carril A = Luis; cambios mínimos).

---

## DECISIONES DEL FUNDADOR (16-jul, aplicadas — NO reabrir)
1. **FSM: OPCIÓN A — sin tocar la máquina de estados ni el máster.** El "esperando firma" es un DERIVADO (`enviadoParaFirmaAt != null && estado === 'emitido'`), como `Job.remaining`. NO se añade el estado `enviado_firma`. NO se toca la Parte L, `canTransitionAlbaran`, ni la regla 27. La firma remota es la transición `emitido → firmado` que YA existe.
2. **Evidencia: basta `ts + firma` (signatureUrl + firmadoAt).** SIN IP/UA. Coherente con cómo firma hoy el presupuesto (que tampoco captura IP/UA en su path público). NO se añade `evidence Json?`. Si algún día se refuerza, se hace para presupuesto Y albarán a la vez, como decisión propia — no aquí.
3. **Tope 3/día (J6): se RESPETA.** Si el cliente ya recibió 3 plantillas hoy, el auto-envío de la copia firmada se bloquea (customer_daily_cap) PERO **la firma se completa igual** (el albarán queda firmado en la plataforma). Degradar con dignidad: la copia se puede reenviar con el botón manual de la 47 más tarde. NUNCA dar excepción al tope (es lo que salva el número de un ban de Meta).
4. **Copy `albaran_para_firmar_es`** (Approved, verificar en Manager antes de cerrar el builder):
   Cuerpo: "Hola {{1}} 👋 {{2}} te envía el parte de trabajo {{3}} para que lo revises y lo firmes. Puedes hacerlo desde el botón de aquí abajo, te llevará un momento. ¡Gracias!"
   Pie: "Enviado con YaQu". Botón URL "Ver y firmar" → https://yaqu.app/albaran/{{token}}. Vars: {{1}}=cliente, {{2}}=negocio, {{3}}=nº albarán.

## 0. CONTEXTO REAL (del recon 16-jul — confírmalo, no lo re-descubras)
- **Molde de la página pública**: hay que COMBINAR DOS moldes — la página/firma de `quoteDecisionLanding.routes.ts` (renderPage HTML server-side :31, canvas SIG_JS :350-426, `getSignatureData()` → toDataURL :420, submit POST :597) + el TOKEN OPACO de `customerPortal.routes.ts` (:219-222 `findUnique({where:{portalToken}})`, generado con `crypto.randomBytes(16).toString('hex')` en `customerAdmin.ts:7`, patrón `ensurePortalToken` :39). El presupuesto usa id crudo (`/pay/quote/:id`) — NO es el molde del token.
- Routers públicos se montan ANTES de requireAuth (`app.ts:80-81`). El nuevo `/albaran` va ahí.
- **Firma del albarán ya existe**: `albaranes.routes.ts POST /:id/firmar` guarda `signatureUrl` + `firmadoAt` y regenera PDF (`ensureAlbaranPdf(id, true)`). La firma remota reutiliza esta misma transición.
- **Envío de la 47 está INLINE** en `albaranes.routes.ts` (endpoint enviar-whatsapp). Hay que extraerlo a servicio (ver §1.5).
- `buildAlbaranFirmado` existe (47). `buildAlbaranParaFirmar` NO existe — hay que crearlo (espejo con `urlButton(token)` en vez de header de documento).
- `Albaran` (schema:644-662) NO tiene token. `jobId` es Int suelto (sin relación Prisma) → para el render público resolver job+merchant+customer a mano (como `ensureAlbaranPdf`).

## 0.5 EMPAQUETADO (schema)
La 49 necesita 2 campos aditivos en `Albaran` (carril A, tu dominio). Como es TODO tu carril, van en el MISMO PR de la 49 (no PR de schema aparte — no hay otro carril esperando). 🚨 STOP schema igualmente: preview + host-check antes del db push, y el db push a PROD va en el orden correcto (schema antes/junto al deploy).

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

### 1.1 Schema (aditivo, Albaran) — 🚨 STOP, enséñame el diff
```
firmaToken         String?   @unique @map("firma_token")   // opaco crypto.randomBytes(16).hex; null hasta enviar a firma
enviadoParaFirmaAt DateTime? @map("enviado_para_firma_at")  // opción A: deriva "esperando firma"
```
Sin `evidence` (decisión 2). Preview + db push staging → mi OK → prod.

### 1.2 Builder + spec J7 (whatsappTemplates.ts)
- `buildAlbaranParaFirmar(vars, token)`: espejo de `buildAlbaranFirmado` pero con botón URL dinámico (`urlButton`) apuntando al token, SIN header de documento.
- Registrar `albaran_para_firmar_es` en `WA_TEMPLATE_SPECS`: `{expectedVarCount: 3, hasUrlButton: true}` — encaja en la forma actual, SIN extensión del validador.

### 1.3 Refactor de la 47 a servicio reutilizable (§1.5 abajo) — hacerlo ANTES del auto-envío
Extraer la lógica inline del endpoint enviar-whatsapp de la 47 a un servicio `sendAlbaranFirmadoWhatsApp(albaranId)` que: resuelve teléfono/customerId, sube PDF → media_id, envía plantilla con guards completos. El botón manual de la 47 pasa a llamar a ese servicio (comportamiento idéntico, solo se mueve el código). Así el auto-envío (§1.6) lo reutiliza sin duplicar.

### 1.4 Envío "para firmar" (servicio + botón)
- Servicio/handler `enviarAlbaranParaFirmar(albaranId)`: genera `firmaToken` perezosamente si no existe (patrón `ensurePortalToken`), setea `enviadoParaFirmaAt = now()`, y llama `sendWhatsAppTemplate(albaran_para_firmar_es)` con guards completos (merchantId + log{customerId, relatedType:'albaran', relatedId}). Requiere estado `emitido` (si no, 409).
- **Botón en el albarán EMITIDO** (`jobDetailView.js`, rama emitido junto a [Firmar] local): **"Enviar para firmar"**. Rol: `requireActivePlan` sin `requireRole` (coherente con la 47, S1 técnico ✓). NO está en el SHELL del SW → sin bump.
- Endpoint: `POST /admin/albaranes/:id/enviar-para-firmar`.

### 1.5 Página pública `/albaran/:token` (router nuevo, montado antes de requireAuth)
- `GET /albaran/:token`: `findUnique({where:{firmaToken}})` → 404 si no existe/null. Render server-side (molde de `quoteDecisionLanding`): cabecera del documento (nombre del negocio, nº albarán, trabajo — resolver job+merchant+customer a mano), vista del albarán y canvas de firma. Sin auth. Tokens DESIGN.md.
- `POST /albaran/:token/firmar`: valida token → transición `emitido → firmado` (reutiliza la lógica de `POST /:id/firmar`: guarda `signatureUrl` del canvas + `firmadoAt`, regenera PDF con firma). Sin IP/UA (decisión 2).
- Tras firmar: dispara el **auto-envío** (§1.6).
- 🚨 Superficie pública: el token es la ÚNICA llave; nada de exponer id/numero. findUnique por firmaToken, no por id.

### 1.6 Auto-envío de la copia firmada (tras firma remota)
- Al completarse `POST /albaran/:token/firmar`, llamar `sendAlbaranFirmadoWhatsApp(albaranId)` (el servicio del §1.3).
- Es envío AUTOMÁTICO: pasa por `sendWhatsAppTemplate` con merchantId (del albarán, no de sesión) + log{customerId,...} → cumple regla 28 (pasa por la tabla WA-0b) y los topes A3.2/J6 automáticamente. NO hace falta tabla nueva.
- **Degradación digna (decisión 3)**: si el guard J6 corta (customer_daily_cap), la firma YA está guardada y el PDF regenerado; el auto-envío falla en silencio controlado (log del intento), la página muestra al cliente "Albarán firmado correctamente" igualmente. NO revertir la firma por un fallo de envío. El pro puede reenviar con el botón de la 47.

## 2. LO QUE NO INCLUYE
- NO se añade el estado `enviado_firma` a la FSM (decisión 1). NO se toca el máster.
- NO IP/UA / `evidence Json?` (decisión 2).
- NO excepción al tope 3/día (decisión 3).
- NO se toca la ventana 24h ni el bot (SCRUM-50).
- Sin Invoice/Charge/webhooks nuevos.

## 3. 🚨 STOP CONDITIONS (AA1.4)
- Enséñame el **diff del schema** (2 campos) antes del db push. Preview + host-check. Sin `--accept-data-loss`.
- Enséñame el **diff del router público `/albaran/:token`** (GET+POST) antes de cerrarlo — es superficie pública nueva, la reviso.
- Confírmame el **copy Approved** verificado en Manager antes de fijar `buildAlbaranParaFirmar`.
- Si algo empuja a tocar la FSM/máster, la ventana 24h, o a dar excepción al tope → PARA (son decisiones ya tomadas o son la 50).

## 4. E2E AUTOMATIZADO (suite → v1.7)
Asserts (gateado): token válido → render 200; token inválido/inexistente → 404; firma remota `emitido → firmado` (guarda firma, regen PDF); auto-envío dry-run tras firma (WA-0b relatedType:'albaran'); **tope 3/día bloquea el auto-envío pero la firma persiste** (degradación); enviar-para-firmar sobre no-emitido → 409; tenancy (token de un merchant no filtra datos de otro). Tras merge: re-seed + suite v1.7 vía Playwright MCP + reporte.

## 5. DEFINICIÓN DE HECHO (Gate)
- Schema (2 campos) aplicado en prod (orden correcto). Builder + spec J7. Servicio de envío firmado (refactor 47). Envío para-firmar + botón. Página pública GET+POST. Auto-envío con degradación.
- build + test verdes; suite v1.7 verde vía MCP.
- E2E humano de Luis: enviar "para firmar" a un cliente (tu número), abrir el link en el móvil, firmar, y ver que llega la copia firmada (con un cliente "limpio" que no haya tocado el tope 3/día).
- PR con descripción; SCRUM-49 a "En revisión" → Finalizada tras verificación.

## 6. JIRA
Al abrir PR: SCRUM-49 → "En revisión" con plan, diffs, tests, suite. NO transicionar a Finalizada (lo hace el asesor tras tu E2E).

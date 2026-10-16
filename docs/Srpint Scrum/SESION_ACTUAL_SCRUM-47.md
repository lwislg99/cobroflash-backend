# TAREA ACTIVA — SCRUM-47 · ALBARAN-2: enviar el albarán FIRMADO por WhatsApp (V1: copia firmada manual)

> Gobierna: `docs/YAQU_MASTER.md` + el ticket **SCRUM-47** + `docs/SPEC_SCRUM47_ALBARAN_FIRMADO_WA.md` (spec previa; este brief manda donde difieran). NO dependas del chat.
> Flujo: `git checkout main && git pull` → rama **`scrum-47-enviar-albaran-wa`** → PR (lo crea Luis a mano, NO uses gh) → merge de Luis → suite QA. Transición a Finalizada: SOLO el asesor.
> 🚨 ZONA SENSIBLE: WhatsApp/envío a cliente (AA1.4). Guards completos obligatorios. Y toca `jobDetailView.js` (zona del carril A = Luis; Javier NO la toca, sin colisión, pero es archivo con historia — cambios mínimos y localizados).

---

## DECISIONES DEL FUNDADOR (15-jul, aplicadas — NO reabrir)
1. **V1 = SOLO la copia firmada** (`albaran_firmado_es`). El "enviar para firmar" (`albaran_para_firmar_es`) queda DIFERIDO a SCRUM-49 (necesita la página pública `/albaran/:token` que aún no existe). No se implementa su call-site aquí.
2. **Siempre plantilla en V1** (no documento de sesión en ventana abierta). NO se toca ni revive `sendWhatsAppDocument` (coherente con la nota de SCRUM-14 de no revivirlo). El ahorro de la ventana 24h se hará en SCRUM-50.
3. **Envío MANUAL** con botón en el albarán firmado (nada automático).
4. `jobDetailView.js` lo toca el carril A (Luis) en este PR. Sin coordinación de parón con Javier (él está en operarios).
5. El manejo del quick reply «👍 Recibido» (inbound + acuse) es **SCRUM-50**, fuera de aquí.
6. **media_id obligatorio** (no link): SCRUM-48 eliminó el estático público; Meta no puede descargar una URL con auth.

## 0. CONTEXTO REAL (del recon 15-jul — confírmalo, no lo re-descubras)
- `sendWhatsAppTemplate` (whatsapp.ts:88-224) acepta `components`; para header de documento el caller pasa `{type:'header', parameters:[{type:'document', document:{id: <media_id>, filename}}]}`. No hay builder hoy.
- `uploadWhatsAppMedia` NO existe (solo `downloadWhatsAppMedia`, :61). Hay que crearla.
- Nombre de PDF en disco (SCRUM-48): `${merchantId}-${numero}.pdf` (albaranPdf.service.ts:35), servido solo por `GET /admin/albaranes/:id/pdf`. El bug de colisión de nombres YA está resuelto por la 48 (la nota §2 de la spec está obsoleta).
- Guards de `sendWhatsAppTemplate` (cadena completa, :101-207): credenciales, DEMO_SAFE_NUMBERS (V0-2), J3 opt-out, A3.2 tope diario, J6 tope cliente/día, J7, dry-run, log WA-0b.
- `WA_TEMPLATE_SPECS` + `validateTemplateComponents` (whatsappTemplates.ts:28-67): la spec es `{expectedVarCount, hasUrlButton}`; el validador ignora headers hoy.
- Endpoint albaranes: `albaranes.routes.ts` (montado en app.ts:223), `findAlbaran` con tenancy (:29-34), `firmar` (:107-142).
- UI de tarjetas de albarán: `jobDetailView.js:326-418`; estado firmado hoy muestra solo `[PDF]` (:418). `jobDetailView.js` NO está en el SHELL del SW → sin bump de CACHE_NAME.

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

### 1.1 `uploadWhatsAppMedia()` (whatsapp.ts) — nuevo, ~40 líneas
Espejo de `downloadWhatsAppMedia`: `POST /{PHONE_NUMBER_ID}/media` multipart (file + `type=application/pdf` + `messaging_product=whatsapp`) → `{id}`. **Guard de dry-run**: en dry-run NO llama a Meta, devuelve un media_id simulado y lo registra (igual que el resto de la cadena dry-run). Manejo de error claro si Meta falla.

### 1.2 Registro de plantilla + validador (whatsappTemplates.ts) — incluye SCRUM-59
- Registrar `albaran_firmado_es`: `{expectedVarCount: 3, hasUrlButton: false, hasDocumentHeader: true}` (flag nuevo `hasDocumentHeader`). El quick-reply «Recibido» NO va como componente en el envío → no rompe el check de botón.
- **Extender `validateTemplateComponents` (SCRUM-59)**: cuando `hasDocumentHeader:true`, exigir que el componente `header` de tipo `document` con `id` (media_id) NO vacío esté presente. Falla local y temprano en vez de en Meta (#132012).
- `buildAlbaranFirmado(vars, mediaId, filename)`: construye los `components` (header documento + body con las 3 vars). **Verificar el copy Approved en Meta byte a byte** antes de fijar el orden de variables.
- NO registrar `albaran_para_firmar_es` aquí (es de la 49).

### 1.3 Endpoint `POST /admin/albaranes/:id/enviar-whatsapp` (albaranes.routes.ts) — nuevo
- `findAlbaran` con tenancy (merchantId de la sesión). 404 si no es suyo.
- **Exige `albaran.estado === 'firmado'`** → 409 `albaran_no_firmado` si no (patrón de los otros handlers).
- Resuelve destinatario: `albaran.jobId → job.customerId → customer.phone` (y `customerId` para el log). Si falta teléfono → 422 claro.
- Flujo: `ensureAlbaranPdf(id)` → leer bytes del `diskPath` → `uploadWhatsAppMedia` → `buildAlbaranFirmado` → `sendWhatsAppTemplate({ merchantId, to, components, log:{ customerId, relatedType:'albaran', relatedId: albaran.id } })`.
- Pasa por TODA la cadena de guards (el endpoint solo debe aportar merchantId + to + log; los guards hacen el resto).
- Respuesta: éxito con el resultado del envío (o el dry-run), o el error del guard que haya cortado (opt-out, tope, etc.) de forma legible para la UI.
- **Rol**: coherente con S1 — ¿quién puede enviar? Un envío al cliente es acción de gestión; si S1 lo restringe a admin, gatéalo con `requireRole` como en SCRUM-54. Confírmalo contra S1 en el recon del código antes de decidir.

### 1.4 UI — botón en `jobDetailView.js` (cambio mínimo y localizado)
- En la tarjeta del albarán **firmado** (:418, donde hoy solo hay `[PDF]`), añadir botón **"Enviar por WhatsApp"** junto al PDF (patrón `resend-whatsapp` de invoices, :542-548).
- Al pulsar → llama al endpoint → feedback (enviando… / enviado / error legible). Re-fetch tras la acción (patrón existente).
- Copy del botón: **"Enviar por WhatsApp"** (o el canónico que use invoices para su reenvío — reutiliza, no inventes microcopy, regla 30).
- NADA más de `jobDetailView.js` se toca.

### 1.5 Spec doc — actualizar (mismo PR)
Actualizar `docs/SPEC_SCRUM47_ALBARAN_FIRMADO_WA.md`: media_id obligatorio (no link), bug de colisión ya resuelto por la 48 (nota §2 obsoleta), path por `storage/albaranes/`, y marcar el alcance V1 = solo copia firmada (para-firmar diferido a la 49).

## 2. LO QUE NO INCLUYE
- `albaran_para_firmar_es` y su call-site (→ SCRUM-49).
- Documento de sesión / fallback ventana 24h (→ SCRUM-50). NO revivir `sendWhatsAppDocument`.
- Manejo del quick reply «Recibido» / inbound (→ SCRUM-50).
- Tocar Invoice/Charge/webhooks/schema. Sin db push.

## 3. 🚨 STOP CONDITIONS (AA1.4)
- Antes de escribir el envío: confírmame el **rol requerido** (S1) para el endpoint y el **copy Approved** verificado en Meta.
- Enséñame el diff del **endpoint + builder** antes de dar por cerrado el envío (es zona de dinero-adyacente: mensaje a cliente).
- Si algo empuja a tocar `sendWhatsAppDocument`, la ventana 24h, o la 2ª plantilla → PARA (es otra tarea).
- Hallazgos → reporte, no arreglo (regla 9).

## 4. E2E AUTOMATIZADO (suite → v1.6)
- Asserts: enviar-whatsapp sobre albarán NO firmado → 409; sobre firmado → dry-run OK con media_id simulado y 0 envíos reales (WhatsAppMessage refleja el intento con type de plantilla, sin wamid real); tenancy (albarán de otro merchant → 404); J7 con hasDocumentHeader y media_id vacío → falla local (SCRUM-59).
- Tras merge: re-seed + suite v1.6 vía Playwright MCP + reporte.

## 5. DEFINICIÓN DE HECHO (Gate)
- `uploadWhatsAppMedia` + builder + endpoint + botón + validador J7 extendido + spec actualizada.
- build + test verdes (tests nuevos: builder, J7 header, endpoint dry-run, tenancy, 409).
- Suite v1.6 en verde vía MCP.
- E2E humano de Luis: con las plantillas ya aprobadas y (si es posible) un número de prueba, enviar un albarán firmado y ver que llega el PDF al WhatsApp. Si no hay número de prueba a mano, validar el dry-run + logs.
- PR con descripción; SCRUM-47 a "En revisión"; cerrar SCRUM-59 como cubierto dentro de este PR.

## 6. JIRA
Al abrir PR: SCRUM-47 → "En revisión" con plan, diffs, tests, resultado de suite. Comentar en SCRUM-59 que va cubierto aquí. NO transicionar a Finalizada.

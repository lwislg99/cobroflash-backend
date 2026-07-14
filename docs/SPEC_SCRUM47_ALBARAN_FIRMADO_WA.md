# SPEC SCRUM-47 (ALBARAN-2) — plantillas `albaran_firmado_es` + `albaran_para_firmar_es` (Utility)

> **Estado (14-jul-2026): AMBAS plantillas ENVIADAS A REVISIÓN en Meta por el fundador**
> (copys FINALES aprobados, §1 y §1b). **Código NO implementado** — se escribe cuando Meta
> apruebe (la aprobación es el camino crítico y ya está lanzada). Decisiones del fundador:
> opción **(a)** cabecera de documento para el firmado · envío **MANUAL** con botón en el
> albarán (nada automático) · segunda plantilla **(b)** con botón de URL para FIRMAR a
> distancia (página pública `/albaran/:token` = SCRUM-49) · **fallback de ventana 24h
> obligatorio en ambos envíos (§7, SCRUM-50)**.
> Al implementarse: fusionar §1/§1b en `docs/WHATSAPP_TEMPLATES.md` (§6/§7) y crear los
> builders en `src/integrations/whatsappTemplates.ts`. Crear/tocar plantillas = stop condition
> AA1.4 (acción de Luis en Meta). GATE del ticket: ≥2 de 3 gremios confirman "se lo mando por WhatsApp".

---

## 1 · La plantilla (para crear en Meta EXACTAMENTE así)

- **Nombre:** `albaran_firmado_es`
- **Categoría:** UTILITY (en el Manager en español: **"Servicio"** — jamás Marketing; si Meta la reclasifica, apelar)
- **Idioma:** Spanish (`es`)
- **Cabecera:** tipo **Documento** (se sube un PDF de MUESTRA al crearla — usar un albarán demo SIN datos reales)
- **Cuerpo — 3 variables (en orden), NINGUNA al inicio ni al final (Meta rechaza {{N}} en los extremos):**
  1. `{{1}}` = nombre del cliente
  2. `{{2}}` = nº de albarán (p. ej. `ALB-2026-001`)
  3. `{{3}}` = obra (dirección del trabajo; fallback: título del trabajo)
- **Texto FINAL (aprobado por el fundador y ENVIADO a revisión de Meta el 14-jul-2026):**
  > Hola {{1}} 👋
  > Aquí tienes tu parte de trabajo {{2}} ya firmado, correspondiente a {{3}}.
  > Guárdalo para tu archivo. ¡Gracias por confiar en nosotros!
- **Pie:** `Enviado con YaQu`
- **Botones — 1 quick reply (CONFIRMADO por el fundador, estrategia de coste A5.1):**
  «👍 Recibido» — el tap abre la ventana de 24 h y cualquier mensaje posterior del ciclo sale a 0 €.
  El webhook entrante debe manejar ese button-reply con elegancia (acuse, jamás el menú genérico) —
  **SCRUM-50 §2**. (Sin botón de URL dinámica: el PDF ya viaja en la cabecera.)
- **Muestras enviadas a la revisión de Meta (español/EUR):** `{{1}}` = `María García` · `{{2}}` = `ALB-2026-001` ·
  `{{3}}` = `C/ Mayor 12, Alcorcón` · documento de muestra = PDF de albarán demo.

Nota sobre `{{3}}` (por qué el copy dice "correspondiente a"): hoy `Job.direccion` es casi siempre
`null` (SCRUM-10 no le dio fuente) y el fallback real es `Job.titulo` ("Presupuesto #3 · Cliente QA");
"correspondiente a {{3}}" lee bien con ambos. Elegido por el fundador frente a "del trabajo en {{3}}".

## 1b · La SEGUNDA plantilla: `albaran_para_firmar_es` (para crear en Meta EXACTAMENTE así)

Caso de uso: el cliente NO está en la obra (o se fue sin firmar) → el pro le manda el albarán
para **verlo y firmarlo a distancia** desde su móvil, en la página pública con token del
albarán (**SCRUM-49**; la plantilla puede aprobarse ANTES de que exista la página).

- **Nombre:** `albaran_para_firmar_es`
- **Categoría:** UTILITY ("Servicio"; si Meta la reclasifica a Marketing, apelar)
- **Idioma:** Spanish (`es`)
- **Cabecera:** **SIN cabecera** (ni documento ni texto — el albarán se ve en la página del botón)
- **Cuerpo — 3 variables (en orden), NINGUNA al inicio ni al final:**
  1. `{{1}}` = nombre del cliente
  2. `{{2}}` = nombre del negocio (merchant)
  3. `{{3}}` = nº de albarán (p. ej. `ALB-2026-001`)
- **Texto ENVIADO a revisión de Meta (14-jul-2026):**
  > Hola {{1}} 👋
  > {{2}} te ha preparado el parte de trabajo {{3}} para que lo revises y lo firmes.
  > Tócalo en el botón de abajo para verlo y firmarlo desde tu móvil.
  ⚠️ Verificar BYTE A BYTE contra lo que quede Approved en el Manager antes de escribir el
  builder (si Meta pidió retoques en la revisión, ESTE doc se actualiza al texto aprobado).
- **Pie:** `Enviado con YaQu`
- **Botones — 1 (URL dinámica):**
  - Texto: `Ver y firmar`
  - URL base: `https://yaqu.app/albaran/{{1}}` → la variable del botón (independiente de las del
    cuerpo) = **token OPACO de la página pública del albarán** (SCRUM-49). JAMÁS el id ni el
    número (`ALB-…` es adivinable; el token debe ser irrecuperable por fuerza bruta, patrón
    del portal `/cliente/:token`).
- **Muestras enviadas a la revisión de Meta:** `{{1}}` = `María García` · `{{2}}` = `Fontanería López` ·
  `{{3}}` = `ALB-2026-001` · URL de muestra del botón con un token de ejemplo.

Implicación de flujo (para el brief de código): "firmado a distancia" = transición
`emitido → firmado` desde la página pública con la MISMA evidencia que el presupuesto
(ts/IP/UA + canvas) — extensión de la Parte L acordada en SCRUM-49; el lock de congelado
y el PDF con firma son los de SCRUM-14 sin cambios.

## 2 · Qué necesita la Meta Cloud API (verificado contra el código y la API v23)

**Al CREAR la plantilla** (Manager, lo hace Luis): la cabecera de documento exige subir un PDF de
muestra en el editor (via API sería un `header_handle` de la Resumable Upload API — con el Manager no hace falta).

**Al ENVIAR la plantilla** (código futuro): el componente `header` admite DOS formas de dar el PDF:
```json
{ "type": "header", "parameters": [ { "type": "document",
    "document": { "id": "<MEDIA_ID>", "filename": "ALB-2026-001.pdf" } } ] }
```
o bien `"document": { "link": "https://…/ALB-2026-001.pdf", "filename": "…" }` (Meta descarga la URL, debe ser HTTPS pública).

**DECISIÓN PROPUESTA: usar `media_id` (subida previa), NO `link`.** Motivos:
- Los PDFs de albarán hoy se sirven **públicos y ENUMERABLES**: `app.ts:114` monta `/albaranes`
  como estático ANTES del auth y `albaranPdf.service.ts:32` nombra el archivo `${numero}.pdf`
  (`ALB-2026-001.pdf` es adivinable → datos del cliente + firma expuestos a cualquiera). Con `link`
  cimentaríamos esa superficie; con `media_id` podemos CERRARLA en el futuro sin romper el envío.
- ⚠️ **Bug latente detectado en el recon (registrar aparte, no es de este ticket):** el nombre de
  archivo NO incluye el merchant → dos merchants con `ALB-2026-001` se PISAN el PDF en
  `albaranesDir` (la serie es única solo por merchant, `@@unique([merchantId, numero])`).
- Mecánica del `media_id`: `POST /{PHONE_NUMBER_ID}/media` (multipart: `file` + `type=application/pdf` +
  `messaging_product=whatsapp`) → `{ id }`. Válido 30 días; documentos hasta 100 MB (los albaranes pesan KB).
  Subir en el momento del envío (no cachear ids).

## 3 · Estado del código hoy (qué falta)

- **`sendWhatsAppDocument` (whatsapp.ts:517, código muerto):** NO sirve para esta opción — envía un
  *service message* `type:'document'` (solo ventana 24 h abierta, 0 €), no una plantilla. Para la
  opción (a) puede seguir muerto. (Uso futuro opcional: variante ventana-first del envío del albarán
  a coste 0 cuando el cliente acaba de escribir — extensión de `sendWhatsAppWindowFirst`, hoy solo texto/cta.)
- **Falta `uploadWhatsAppMedia()`** en whatsapp.ts (espejo de `downloadWhatsAppMedia`, con dry-run).
- **`whatsappTemplates.ts`:** falta `WA_TEMPLATES.albaranFirmado`, su entrada en `WA_TEMPLATE_SPECS`
  (3 vars, sin botón URL, **+ flag nuevo `hasDocumentHeader`**), un helper `documentHeader()` y el
  builder `buildAlbaranFirmado()`.
- **`validateTemplateComponents` (J7) HOY IGNORA las cabeceras** — hay que extenderla para exigir el
  header de documento cuando `hasDocumentHeader` (si no, un media_id vacío solo fallaría en Meta con #132012).
  Ojo: una plantilla NO registrada en `WA_TEMPLATE_SPECS` devuelve `null` = **no se valida** → registrar la spec es
  obligatorio para que J7 muerda.
- **Falta el call-site:** `POST /admin/albaranes/:id/enviar-whatsapp` + botón en la tarjeta del albarán
  FIRMADO de `jobDetailView.js` (patrón del `resend-whatsapp` de invoices). `jobDetailView.js` NO está
  en el SHELL del service worker → sin bump de `CACHE_NAME`.

## 4 · Guards — el envío pasa por TODOS (confirmado leyendo `sendWhatsAppTemplate`, whatsapp.ts:88-224)

| Guard | Dónde | ¿Aplica al nuevo envío? |
|---|---|---|
| Credenciales (`not_configured`) | whatsapp.ts:101 | ✅ automático |
| Dry-run staging (`WHATSAPP_DRY_RUN=1`) | whatsapp.ts:165 (tras TODOS los guards) | ✅ automático — la suite E2E lo cubre |
| Demo seguro V0-2 (`DEMO_SAFE_NUMBERS`) | whatsapp.ts:107 | ✅ **si el call-site pasa `merchantId`** |
| Baja del canal J3 (`waOptOut`) | whatsapp.ts:113 | ✅ si pasa `merchantId` |
| Tope diario por merchant A3.2 (`WA_DAILY_TEMPLATE_CAP`) | whatsapp.ts:126 | ✅ si pasa `merchantId` |
| Tope por cliente/día J6 (`WA_CUSTOMER_DAILY_CAP`) | whatsapp.ts:141 | ✅ **si el call-site pasa `log.customerId`** |
| Validación de spec J7 (#132000/#132001) | whatsapp.ts:158 | ✅ **solo si se registra la spec** (+ extensión header) |
| Log WA-0b (`WhatsAppMessage`) | whatsapp.ts:169/207 | ✅ si pasa `merchantId` (+ `log.relatedType:'albaran'`, `relatedId`) |

Requisito de implementación: el endpoint DEBE llamar con `merchantId`, `log: { customerId, relatedType: 'albaran', relatedId }`.
Anti-spam J6 tabla de envíos automáticos (regla 28): NO aplica — el envío es MANUAL por decisión del fundador; los topes diarios sí operan igualmente.

## 5 · Pasos en Meta Business Manager — ✅ EJECUTADO por el fundador (14-jul-2026)

**Ambas plantillas (`albaran_firmado_es` §1 y `albaran_para_firmar_es` §1b) están ENVIADAS
A REVISIÓN** con los copys FINALES, pie `Enviado con YaQu`, quick reply «👍 Recibido» (solo
la primera), botón `Ver y firmar` → `https://yaqu.app/albaran/{{1}}` (solo la segunda) y las
muestras de §1/§1b. Queda:
1. **Esperar el Approved** (plazo típico minutos-días; contar SEMANAS). Si Meta reclasifica
   cualquiera a Marketing → apelar (precedente: P3-3).
2. Al aprobarse cada una: verificar el texto Approved **byte a byte** contra §1/§1b (si Meta
   forzó retoques, actualizar ESTE doc), registrar la spec en código (J7) y fusionar en
   `docs/WHATSAPP_TEMPLATES.md` §6/§7.
3. Si alguna es RECHAZADA: anotar el motivo aquí, corregir y reenviar (cambio de plantilla =
   acción del fundador, AA1.4).

## 6 · Código que faltará después (estimación, NO escrito)

| Pieza | Archivo | Tamaño aprox. |
|---|---|---|
| `uploadWhatsAppMedia()` con dry-run | `src/integrations/whatsapp.ts` | ~40 líneas |
| Spec + `documentHeader()` + `buildAlbaranFirmado()` + extensión J7 headers | `src/integrations/whatsappTemplates.ts` | ~50 líneas |
| Tests del builder + validación header | `tests/whatsappTemplates.test.mjs` | ~30 líneas |
| `POST /admin/albaranes/:id/enviar-whatsapp` (tenancy, exige `firmado`, teléfono, upload→send) | `albaranes.routes.ts` | ~50 líneas |
| Botón "Enviar por WhatsApp" en albarán firmado + estados | `jobDetailView.js` | ~30 líneas |
| Docs (§6 de WHATSAPP_TEMPLATES.md) + suite v1.5 (assert dry-run del envío) | docs | — |

Total: **~1 día con tests**, desacoplado de la aprobación de Meta (que es el camino crítico y por eso se lanza primero).
(Con §1b y §7 se añaden: builder `buildAlbaranParaFirmar()` + spec J7 con botón URL (~20 líneas),
call-site "Enviar para firmar" en el albarán EMITIDO (~40 líneas — depende de la página SCRUM-49),
y el helper ventana-first del §7.)

## 7 · REQUISITO: fallback de ventana 24h en AMBOS envíos (SCRUM-50 — obligatorio en el brief de código)

Antes de gastar una plantilla (~0,023 €), el envío comprueba si hay **ventana de servicio de
24 h abierta** con ese cliente (patrón A5.5 ventana-first, ya operativo en `quote_decision_es`
vía `sendWhatsAppWindowFirst`):

- **Ventana ABIERTA → mensaje de sesión (0 €):**
  - `albaran_firmado_es` → **documento de sesión** con el PDF: aquí revive
    `sendWhatsAppDocument` (`whatsapp.ts:517`, hoy código muerto) — necesita el mismo
    `media_id`/link del §2 y pasar por TODOS los guards del §4.
  - `albaran_para_firmar_es` → **texto de sesión** con el enlace `/albaran/:token`
    (extensión de `sendWhatsAppWindowFirst`; copy de sesión = cambio de master K1 si se
    redacta nuevo).
  - En ambos casos se registra en WA-0b como `type:'service'` + `templateName` de la
    plantilla equivalente (métrica A5.4), `relatedType:'albaran'`.
- **Ventana CERRADA → plantilla** (§1/§1b), con la cadena completa de guards (§4).
- **Detección de la ventana**: confirmar en el brief cómo se detecta hoy (SCRUM-50 §1);
  si no hay tracking de última interacción entrante del cliente, añadirlo ADITIVO.
- **Quick reply «👍 Recibido»** (§1): el webhook lo recibe como button-reply → acuse elegante,
  jamás el menú genérico del bot; considerar marcar "recibido por el cliente" en el albarán
  (SCRUM-50 §2). Mensajes de texto entrantes sobre albaranes → SCRUM-50 §3 (mínimo: aviso al
  pro vía `merchant_alert_es`).
- El envío sigue siendo **MANUAL** (decisión del fundador) → la tabla anti-spam J6/regla 28
  no aplica; los topes diarios (A3.2/J6) operan igual.

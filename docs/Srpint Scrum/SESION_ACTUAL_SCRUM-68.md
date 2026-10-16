# TAREA ACTIVA — SCRUM-68 · Evidencias probatorias reforzadas en la firma del albarán

> Gobierna: `docs/YAQU_MASTER.md` + el ticket **SCRUM-68** + `docs/legal/INVESTIGACION_ALBARANES.md` + este brief. NO dependas del chat.
> Flujo: `git checkout main && git pull` → rama `scrum-68-evidencias-firma` → PR (lo crea Luis a mano, NO uses `gh`) → merge de Luis → suite QA.
> Zona: albaranes + **router público `/albaran/:token`** (🚨 superficie pública) + **schema** (🚨 STOP) + **datos personales** (🚨 privacidad).
> **INDEPENDIENTE de SCRUM-65/66/17** — puede ir en paralelo. Solo cuida el solape si otra rama toca `albaranPdf.service.ts`.

## POR QUÉ ESTA TAREA (contexto de negocio, no solo técnico)
El albarán firmado es el **principal activo del profesional para cobrar un impago**. España es el país europeo con más pagos fuera de plazo entre empresas (media de 95 días, INE 2024), y el procedimiento monitorio (arts. 812 ss LEC) admite **albaranes de entrega firmados** como principio de prueba.

Pero la jurisprudencia es clara en los dos sentidos: un albarán no reconocido **no pierde toda su eficacia** (AP León 19/12/2005; AP Madrid 14/06/2005; AP Huelva 12/04/2019 — se valora junto al resto de prueba), **pero se anula cuando se acredita que la firma es falsa**. Es decir: **la fortaleza probatoria depende de poder demostrar autenticidad e integridad.**

Marco: eIDAS (Reglamento UE 910/2014, art. 25.1) + Ley 6/2020 — no se puede negar efecto jurídico ni admisibilidad a una firma electrónica por no ser cualificada. **Las evidencias capturadas son lo que eleva la firma de "simple" hacia "avanzada".**

**Hoy YaQu solo guarda `firmadoAt` (timestamp) + `signatureUrl` (canvas).** Esta tarea añade el resto.

## 1. ALCANCE EXACTO

### 1.1 Schema (aditivo) — 🚨 STOP, enséñame el diff
- `Albaran.evidenciaFirma Json?` — objeto con las evidencias (estructura en §1.2). Nullable; los albaranes ya firmados se quedan sin él (no se migran).
- Nada más. Sin `--accept-data-loss`, preview + host-check.

### 1.2 Qué se captura al firmar (ambos caminos)
Se rellena en **los dos puntos de firma**: `POST /admin/albaranes/:id/firmar` (in situ, con sesión) y `POST /albaran/:token/firmar` (remota, pública).

```
{
  "firmadoEn": "<ISO timestamp del SERVIDOR, no del cliente>",
  "canal": "IN_SITU" | "WHATSAPP_REMOTO",
  "ip": "<IP de la petición>",
  "userAgent": "<UA del navegador>",
  "tokenId": "<identificador del token usado, solo en remoto>",
  "nombreDeclarado": "<nombre que teclea el firmante, si se le pide>",
  "hashDocumento": "<SHA-256 hex, ver §1.3>",
  "version": 1
}
```
- **El timestamp es del servidor**, nunca del cliente (un cliente puede mentir).
- `tokenId`: identificador o hash del token, **NO el token en claro** (sigue siendo la llave de la página pública).
- Si algún dato no está disponible, se guarda `null` — nunca se inventa.

### 1.3 El hash: resolver la mordida de cola
**Problema:** si el hash es del PDF y luego el PDF incluye el hash impreso, el hash cambia. No se puede.

**Solución (hazlo así):** el hash es del **contenido canónico**, no del archivo:
1. Construir un objeto JSON canónico y determinista con: `merchantId`, `albaranId`, `numero`, `version`, `fecha`, `lineas` (en orden), `notas`, `firmadoEn`, y el **`signatureUrl` (data-URI de la firma)**.
2. Serializar con claves ordenadas y sin espacios, y calcular **SHA-256** en hex.
3. Guardar ese hash en `evidenciaFirma.hashDocumento`.

Así el hash **es estable y se puede imprimir en el PDF**, y permite demostrar después que ni el contenido ni la firma se han alterado. Documenta en el código la función canónica (será la que haya que reproducir para verificar en el futuro).

### 1.4 Bloque de evidencias en el PDF (`albaranPdf.service.ts`)
En el PDF del albarán **firmado**, junto/bajo el bloque de firma existente, añadir un bloque discreto y legible:
```
Firmado electrónicamente
Fecha y hora: 17/07/2026 12:34:05 (hora peninsular)
Canal: enlace enviado por WhatsApp
Referencia de integridad (SHA-256): a1b2c3…  [primeros 16-24 caracteres]
Documento firmado conforme al Reglamento (UE) 910/2014 (eIDAS) y la Ley 6/2020.
```
- **NO imprimir la IP ni el user-agent** en el PDF (§1.5).
- Si `evidenciaFirma` es null (albarán firmado antes de esta tarea), el PDF se comporta como hoy — sin bloque.

### 1.5 🚨 Privacidad (obligatorio, no opcional)
La **IP y el user-agent son datos personales** (RGPD).
- Se guardan **solo** en `evidenciaFirma` (backend), con la finalidad legítima de acreditar la firma.
- **NUNCA se exponen**: ni en el PDF, ni en el HTML de la página pública `/albaran/:token`, ni en ninguna respuesta de API que el cliente final pueda ver. Solo son visibles para el comerciante dueño del albarán (y ni siquiera hace falta mostrarlos en UI en esta tarea).
- **Añadir la mención a la política de privacidad**: en la página pública de firma, una línea discreta tipo *"Al firmar se registran la fecha, la hora y datos técnicos de la conexión con la única finalidad de acreditar la firma."* con enlace a la política si existe.
- Si hay un documento de política de privacidad en el repo o en la web, actualízalo; si no, **repórtalo como hallazgo** (regla 9) para que se cree el ticket.

### 1.6 Verificación (pequeño, alto valor)
Función interna `verificarEvidencia(albaranId)` que recalcula el hash canónico y lo compara con el almacenado → `{ ok: true }` o `{ ok: false, motivo }`. Sin endpoint público en esta tarea; solo la función + su test. Es la que algún día sostiene un "verificar autenticidad" de cara al juez.

## 2. LO QUE NO INCLUYE
- Sellado de tiempo cualificado (TSA) ni firma cualificada — otra liga, otro ticket.
- Geolocalización del firmante (mencionada en la investigación como opcional) → **diferida**, reportar como ticket si se quiere.
- UI para que el comerciante vea las evidencias en el dashboard → diferida.
- Endpoint público de verificación → diferido.
- Nada de facturación, precios ni consolidación (65/66/17).

## 3. 🚨 STOP CONDITIONS
- **Diff del schema** antes del db push.
- **Diff del router público** `albaranPublic.routes.ts` — es superficie abierta a internet y estamos tocando su POST de firma. Quiero verlo.
- Si algo empuja a exponer IP/UA hacia fuera → PARA.
- Hallazgos → reporte (regla 9).

## 4. TESTS
- Puros: la función canónica es **determinista** (mismo input → mismo hash) y **sensible** (cambiar una línea, la firma o el número cambia el hash); `verificarEvidencia` detecta manipulación.
- Gateado: firma in situ y firma remota rellenan `evidenciaFirma` con canal correcto, timestamp de servidor, hash presente; el HTML público **no** contiene la IP; el PDF firmado muestra el bloque de evidencias y **no** muestra IP/UA; albarán legacy sin evidencias → PDF sin bloque, sin romper.
- Suite: assert de que la página pública no filtra IP/UA (junto al assert existente de que no filtra teléfono/email).

## 5. DEFINICIÓN DE HECHO
- Schema aplicado (staging → mi OK → prod, orden correcto). Captura en ambos caminos de firma. Hash canónico + `verificarEvidencia`. Bloque en PDF. Privacidad respetada.
- build + test verdes; suite verde vía MCP.
- E2E humano: firmar un albarán por WhatsApp y comprobar que el PDF trae el bloque de evidencias con fecha, canal y referencia de integridad.
- PR con descripción; SCRUM-68 a "En revisión".

## 6. JIRA
Al abrir PR: SCRUM-68 → "En revisión" con diffs, tests y nota de lo diferido (TSA, geoloc, UI, endpoint de verificación). NO transicionar a Finalizada.

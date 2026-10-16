# TAREA ACTIVA — SCRUM-45 · Cache-busting de estáticos del dashboard (V1: B+C)

> Gobierna: `docs/YAQU_MASTER.md` + el ticket **SCRUM-45** + este brief. NO dependas del chat.
> Flujo: `git checkout main && git pull` → rama `scrum-45-cache-busting` → PR (lo crea Luis a mano, NO uses gh) → merge de Luis → suite QA.
> 🚨 ZONA SENSIBLE: service worker (afecta a usuarios con la PWA instalada). Ver §3.

## CONTEXTO (del recon 16-jul — ya verificado en main)
- **El culpable NO es el HTTP:** Express sirve estáticos con `Cache-Control: public, max-age=0` + ETag (revalidación barata, 304s). `app.disable('etag')` (app.ts:87) NO afecta a `express.static` (serve-static hace su propio ETag). El HTTP puro ya revalida bien.
- **El culpable ES el service worker:** `sw.js` cachea un SHELL de 16 entradas (incluido `/dashboard/` HTML) con estrategia **cache-first SIN revalidación** (sw.js:48-51). Eso anula el `max-age=0`. Como el HTML está en el SHELL, se congela el índice → el incidente del `signaturePad` (el HTML viejo cacheado ni referenciaba el script nuevo). `CACHE_NAME='yaqu-v3'` se sube A MANO cada deploy (v2 el 8-jul, v3 el 14-jul por SCRUM-46).
- **SHELL desalineado:** 16 entradas precacheadas vs 28 scripts reales en index.html → conviven SHELL viejo + resto nuevo = el bug.
- **Caso "pestaña abierta durante el deploy":** el JS ya está en memoria; NO lo arregla ni HTTP ni SW ni ?v=. Solo un chequeo de versión + aviso (opción C).
- **BUILD_ID disponible gratis:** Railway inyecta `RAILWAY_GIT_COMMIT_SHA` en el entorno. `BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA ?? String(Date.now())` capturado al arrancar cubre prod/staging/dev sin configurar nada. (`/health` hoy devuelve version '0.1.0' hardcodeada y desincronizada → unificar de paso.)

## DECISIÓN DEL FUNDADOR (16-jul): enfoque V1 = B + C
- **B — SW network-first** para HTML/JS/CSS (red primero, caché runtime como fallback offline). Mata la reincidencia (SW congelado), el bump manual y el desalineamiento del SHELL de golpe.
- **C — endpoint `/version` + toast "hay versión nueva"** (poll suave con BUILD_ID). Cubre el caso "pestaña abierta durante el deploy".
- **A (versionar los 28 `<script>` con ?v=hash) NO se hace en V1** — es gold standard de performance, pero los 304 ya son baratos; queda como V2 opcional. NO tocar cómo se sirven los estáticos.

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

### 1.1 B — Service worker network-first (`sw.js`)
- Cambiar la estrategia de fetch para HTML/JS/CSS de **cache-first** a **network-first**: intenta red primero; si responde, sirve y actualiza la caché runtime; si la red falla (offline), sirve desde caché. Las peticiones a la API siguen como están (no tocar su manejo).
- El SHELL precacheado pasa a ser solo **fallback offline** → el desalineamiento 16≠28 deja de morder. Aun así, **regenerar/alinear la lista del SHELL** (o precachear en runtime) en este PR para no dejar deuda.
- **Bump final** `CACHE_NAME` a `yaqu-v4` (el último bump manual; a partir de aquí network-first evita necesitarlo).
- Mantener `skipWaiting` + `clients.claim` (ya verificado en SCRUM-46) para que el SW nuevo tome control en la siguiente carga.

### 1.2 C — Endpoint `/version` + aviso de recarga
- **`BUILD_ID`**: capturar al arrancar `const BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA ?? String(Date.now())`.
- **Ruta pública `GET /version`**: devuelve `{ version: BUILD_ID }`. Unificar `/health` para que use el mismo BUILD_ID (mata el '0.1.0' hardcodeado).
- **Cliente (`app.js`)**: al cargar, guarda el BUILD_ID actual; hace un **poll suave** (p.ej. cada 60-120s, y/o al recuperar foco de la pestaña) a `/version`; si el BUILD_ID cambió respecto al de arranque → muestra un **toast no intrusivo** con botón de recarga. No forzar recarga automática (respeta lo que el usuario esté haciendo).
- **Copy del toast (K1, aprobado por el fundador):**
  - Texto: **"Hay una versión nueva de YaQu. Recarga para actualizar."**
  - Botón: **"Recargar"** (hace `location.reload()`).

## 2. LO QUE NO INCLUYE
- NO versionar los `<script src>` con ?v=hash (opción A → V2 futura). No tocar el serving de estáticos de Express.
- Sin schema, sin flags.
- No tocar el manejo de la API en el SW.

## 3. 🚨 STOP CONDITIONS (AA1.4)
- Enséñame el **diff de `sw.js`** antes de cerrar — el service worker afecta a usuarios con la PWA instalada; quiero ver el cambio de estrategia y que el fallback offline se conserva. (Nota: es seguro — el navegador re-chequea `sw.js` por bytes en cada navegación e ignora su caché; el flujo bump→reinstalación→skipWaiting+claim ya se verificó en vivo en SCRUM-46, así que el cambio se auto-propaga en la siguiente carga de cada usuario.)
- Hallazgos → reporte (regla 9).

## 4. E2E / SUITE (→ v1.9/v2.0 si toca)
- Verificación del comportamiento: tras un "deploy simulado" (cambio de BUILD_ID), un cliente con la pestaña abierta recibe el toast; una recarga trae la versión nueva sin Ctrl+Shift+R. Parte de esto es difícil de automatizar en la suite (requiere dos versiones), así que el gate real es:
- Test de la ruta `/version` (devuelve un BUILD_ID no vacío) + `/health` unificado.
- Tras merge: verificación humana (ver §5).

## 5. DEFINICIÓN DE HECHO (Gate)
- `sw.js` network-first + bump v4 + SHELL alineado. `/version` con BUILD_ID + `/health` unificado. Poll + toast en `app.js` con el copy aprobado.
- build + test verdes.
- **E2E humano de Luis** (esta es la prueba real): con la app abierta, hacer un deploy (o merge) → aparece el toast "Hay una versión nueva" → pulsar Recargar trae la versión nueva. Y verificar que tras un deploy normal ya NO hace falta Ctrl+Shift+R para ver cambios (el bug original muerto).
- PR con descripción; SCRUM-45 a "En revisión" → Finalizada tras verificación.

## 6. JIRA
Al abrir PR: SCRUM-45 → "En revisión" con diffs, plan, y nota de que A queda como V2. NO transicionar a Finalizada.

# TAREA ACTIVA — SCRUM-57 · UI del operario (autoría) en el detalle del Trabajo

> Gobierna: `docs/YAQU_MASTER.md` + el ticket **SCRUM-57** + este brief. NO dependas del chat.
> Flujo: `git checkout main && git pull` → rama `scrum-57-ui-operario-detalle` → PR (lo crea Luis a mano, NO uses gh) → merge de Luis → suite QA.
> Zona: `jobDetailView.js` (carril A, tu dominio). Cambio pequeño de UI. Sin dinero/fiscal. Sin schema. Sin STOPs de zona sensible.

## CONTEXTO (del recon de reconciliación 16-jul — ya verificado en main)
La 22 dejó el serializer del operario en main; parte del render se perdió con una rama que no entró. Estado real:
- ✅ EN MAIN: `serializeJob` expone `operario:{id,name}|null` (jobs.routes.ts:83). `serializeJobDetail` propaga la misma autoría al charge (:148) y a cada albarán (:161). **Aditivo, pero SIN test gateado que lo cubra** → hay que añadirlo aquí.
- ❌ FALTA: el render en `jobDetailView.js` (no existe ningún "Responsable:"/"Operario:" ni consumo de `job.operario` en la UI — el core de esta tarea).
- ❌ FALTA: el fallback del caso owner (`operario == null`). ⚠️ `window.appUserName` NO sirve: es el nombre del USUARIO LOGUEADO (para un técnico, su propio nombre), no el del negocio. Fuente fiable = `/admin/merchant` → `name`.
- La spec `SPEC_RENDER_operario_SCRUM-22.md` NO existe en main, pero la SUITE (§7 paso 33) la referencia → referencia colgante a arreglar.
- El doble "## 6" de la suite YA está resuelto (PR #23 renumeró Operarios a §7) → nada que hacer ahí.
- `jobDetailView.js` NO está en el SHELL del SW → sin bump de CACHE_NAME.

## DECISIONES DEL FUNDADOR (16-jul, aplicadas)
1. **Fallback owner: opción (a) frontend-only** — `jobDetailView` hace `apiRequest('/admin/merchant')` y usa `.name` para el "Responsable: {negocio}" cuando `operario == null`. Sin tocar backend (la 22 ya hizo el serializer).
2. **Test gateado de la propagación albarán/charge: SÍ**, en esta tarea (cubre el código vivo sin verde de las líneas 148/161).
3. **Referencia colgante: NO recrear el doc huérfano.** El render se define aquí (en este brief + el PR) y se actualiza la línea §7 paso 33 de la SUITE para que apunte a SCRUM-57, matando la referencia a la spec perdida.

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

### 1.1 Chip "Responsable" en la cabecera del detalle (`jobDetailView.js`)
- Añadir en la cabecera del Trabajo (la zona de resumen `sumSec` ~:95-119, o bajo el título en `headLeft` ~:52-54 — elige lo más natural visualmente) una línea/chip: **"Responsable: {nombre}"**.
- Fuente del nombre:
  - Si `job.operario` no es null → `job.operario.name`.
  - Si `job.operario == null` (propietario) → nombre del NEGOCIO, obtenido de `/admin/merchant` (`apiRequest('/admin/merchant').name`). Cachea el valor si ya se hace un fetch equivalente en el detalle; si no, un request es aceptable.
- Estilo: usa los tokens/estética existentes del detalle (chip o línea discreta, coherente con estado/total). Nada estridente.
- NO tocar el SHELL del SW (no aplica; jobDetailView no está listado).

### 1.2 Test gateado de la propagación del operario
- Nuevo o extendido gateado que asserte: `job.operario` (ya cubierto), **`charge.operario`** (:148) y **`albaranes[].operario`** (:161) — hoy sin cobertura. Caso con operario y caso owner (null).
- Reutiliza el patrón de `scrum22-operario-readpath.test.mjs`.

### 1.3 Matar la referencia colgante de la SUITE
- Actualizar `docs/QA/SUITE_REGRESION.md` §7 paso 33: sustituir la referencia a `SPEC_RENDER_operario_SCRUM-22.md` (perdida) por la descripción del render real: chip "Responsable: {operario|negocio}" en la cabecera del detalle, definido en SCRUM-57. Sin crear doc nuevo.

## 2. LO QUE NO INCLUYE
- Sin schema (nada nuevo; el serializer ya está).
- Sin backend nuevo (fallback owner vía endpoint existente `/admin/merchant`).
- No tocar `homeView.js` ni la lista de Trabajos (esto es solo el DETALLE).
- No recrear el doc de spec huérfano.

## 3. STOP CONDITIONS
- Ninguna de zona sensible (es UI de tu carril). Si algo empujara a tocar schema, serializer de otro carril, o el SHELL del SW → PARA y reporta.
- Hallazgos → reporte (regla 9).

## 4. E2E / SUITE (→ v1.9 si toca asserts)
- Gateado: la propagación operario (job/charge/albaranes) verde. 
- Suite: si el §7 paso 33 pasa a asertar el chip visible, actualizar el número de versión. Tras merge: re-seed + suite vía MCP + reporte.

## 5. DEFINICIÓN DE HECHO (Gate)
- Chip "Responsable" en el detalle (operario o fallback negocio). Test gateado de la propagación verde. Referencia colgante de la suite arreglada.
- build + test verdes; suite verde vía MCP.
- E2E humano opcional: abrir un Trabajo con operario asignado y otro sin (owner) y ver el chip correcto en cada uno.
- PR con descripción; SCRUM-57 a "En revisión" → Finalizada tras verificación.

## 6. JIRA
Al abrir PR: SCRUM-57 → "En revisión" con diffs, tests, resultado de suite. NO transicionar a Finalizada.

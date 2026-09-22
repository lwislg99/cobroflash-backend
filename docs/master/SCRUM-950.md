# SCRUM-950 · La política de privacidad (§5) nombra a Anthropic y no a Google, que es quien la hace hoy

**Fecha:** 22-sep-2026 (reconfirmación) · **Carril:** J4 (legal y cumplimiento) · **Gate:** sin gate — **NO SE APLICA NADA de esto** (regla 39: texto de cliente lo firma un jefe)
**Medido contra:** `origin/main` = `f319add31e4e414ab9e9a70e10bc179dc13996c9` · 2026-09-22T08:17:47Z

> ⛔ **ESTA ENTRADA NO TOCA `public/privacidad.html`.** Propone; firma un jefe. La propuesta y su
> medición nacieron el 21-sep-2026 en el comentario de Jira de SCRUM-950 (id 16198, J4, sobre
> `origin/main` = `92100e4fc018e59a948a0e9fccd898ae2d613963`). Esta entrada solo la trae al repo
> (regla A8: un ticket, un fichero en `docs/master/`) y reconfirma que sigue vigente hoy — **no
> repite la medición desde cero.**

## PASO 0 — ¿sigue midiendo lo mismo hoy?

Comparado `92100e4f...` (cuando se propuso) contra `f319add3...` (hoy): **cero diferencias** en
`src/modules/ai/domain/ai.service.ts`, `src/modules/expenses/domain/lecturaTicket.ts`,
`public/privacidad.html` y `tests/scrum302-rotulos-completos.test.mjs`. La única pieza que se movió
en medio, `docs/legal/PREGUNTAS_ASESOR.md`, ganó una pregunta nueva (P17, sobre supresión de datos
del cliente final) que **no toca proveedores de IA** — no cambia nada de lo de abajo.

## Qué proveedor usa YaQu hoy — medido en código, no en el ticket

* `src/modules/ai/domain/ai.service.ts:1-6,39-53` — comentario del propio fichero: *"Proveedor:
  Gemini (tier gratuito) por defecto; Claude como fallback solo si Gemini no está configurado pero
  sí ANTHROPIC_API_KEY. Decisión del fundador (6-jul-2026)"*. `aiComplete` (sugerencias de
  presupuesto) llama primero a `geminiComplete` si `isGeminiConfigured()`, y solo si NO lo está, cae
  a `anthropic.messages.create`. **Anthropic sigue siendo un encargado VIVO** (rama de fallback
  real, no código muerto), no uno a sustituir.
* `src/modules/expenses/domain/lecturaTicket.ts:9-13,37` — la lectura de fotos de tickets de gasto
  (SCRUM-912) llama **directo** a `geminiCompleteConModelo`, nunca a `aiComplete`: *"la condición del
  fundador para 912 es Gemini gratis y SIN respaldo (SCRUM-934 cerrado): si falta la clave, esto
  falla con* `gemini_not_configured` *y no gasta un céntimo"*. Sin fallback a Claude, nunca.
* `docs/master/SCRUM-912.md:26` ya lo señalaba: *"Hallazgo previo, NO de 912:* `public/privacidad.html`
  *§5 nombra a Anthropic como encargado de la IA y no nombra a Google, que la hace desde el
  6-jul."*
* `public/privacidad.html:81` dice hoy: *"Anthropic — asistencia de IA para redactar presupuestos
  (sin uso de tus datos para entrenar modelos; transferencia internacional)."* — Google no aparece
  en ningún punto de §5.

**Conclusión:** son DOS encargados hoy, con alcance distinto — Google (Gemini) por defecto en
presupuestos y en exclusiva en lectura de tickets; Anthropic (Claude) como respaldo real en
presupuestos. La política de §5 solo nombra a uno de los dos, y no es el que más se usa.

## Comprobación de bloqueo — antes de proponer el literal

* No está en `MICROCOPY_BLOQUEADA` (`tests/scrum302-rotulos-completos.test.mjs`; única clave:
  `btnConvertirFactura`).
* No hay ninguna pregunta abierta sobre proveedores de IA en `docs/legal/PREGUNTAS_ASESOR.md`
  (807 líneas + P17 nueva, ninguna toca esto).
* **No hay bloqueo del asesor sobre este texto.** Es corregible con una frase que sale de lo ya
  medido, sin esperar dictamen.

## El literal — listo para firmar, sustituye `public/privacidad.html:81`

> `<li><strong>Google (Gemini)</strong> — asistencia de IA para redactar presupuestos y para leer
> el texto de las fotos de tickets de gasto que subes (importe, IVA, NIF del proveedor); es el
> proveedor por defecto desde el 6-jul-2026 (transferencia internacional).</li>`
> `<li><strong>Anthropic (Claude)</strong> — asistencia de IA para redactar presupuestos, como
> proveedor de respaldo si Google no está disponible (sin uso de tus datos para entrenar modelos;
> transferencia internacional).</li>`

**Lo que NO hace esta propuesta:** sustituir Anthropic por Google. Los dos son encargados reales
hoy, con alcance distinto, y el literal los nombra a los dos.

## Lo que NO cubre

* ⛔ No se ha tocado `public/privacidad.html` — regla 39, lo firma un jefe; lo construye J3 cuando
  esté firmado.
* No se ha vuelto a auditar el resto de la política de privacidad, solo §5 (el alcance de este
  ticket).
* Esta entrada no repite el análisis del 21-sep: lo reconfirma contra `origin/main` de hoy y lo
  trae al registro de máster que faltaba.

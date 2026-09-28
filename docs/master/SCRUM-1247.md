# SCRUM-1247 · El asistente de IA dice que escribe Claude, y por defecto escribe Gemini

**Medido contra:** `origin/main` = `7ddab7d83ed9cc6c7c4b18e9d780f641c56fe1a6` · 2026-09-28T20:13Z (J4, jv-j4)

**Puesto:** J4 (legal y privacidad). **Encargo:** del orquestador `jv-orquestador`, 28-sep-2026 por la
noche. **Qué es esto:** medición y propuesta de texto. **Nada de lo de abajo está firmado** (regla 39).
No toca `src/`, ni `public/`, ni la política publicada.

## 1. Quién redacta de verdad (EJECUTADO, no leído)

El camino único es `aiComplete` (`src/modules/ai/domain/ai.service.ts:33`). Por él pasan las cuatro
funciones de IA: `suggestQuoteLines`, `suggestAlbaranLines`, `generateQuoteMessage` y
`suggestLineasDeParte`. Se cargó `dist/` compilado de este `origin/main` en un proceso con dos dobles:
un `fetch` que apunta el host y un cliente de Anthropic (`require.cache` de `dist/integrations/claude.js`)
que apunta la llamada. Ninguna llamada sale a la red. Del entorno del proceso se quitaron todas las
`DATABASE_URL*`.

Así se lanzó la sonda: un proceso por escenario, con `GEMINI_API_KEY` y `ANTHROPIC_API_KEY` puestas o
vacías.

```js
globalThis.fetch = async (url, init) => { llamadas.push({ host: new URL(String(url)).host, … }); … };
require.cache[<dist/integrations/claude.js>] = { exports: { anthropic: { messages: { create: async (p) => { llamadas.push({ via: 'anthropic-sdk', model: p.model }); … } } } } };
await require('dist/modules/ai/domain/ai.service.js').generateQuoteMessage({ customerName: 'CLIENTE-MARCA', … });
```

**Población:** 6 escenarios con `generateQuoteMessage` y 3 con `suggestQuoteLines`, este último con un
doble de `prisma` para el catálogo.

| Claves puestas | Resultado | Quién recibe la llamada |
|---|---|---|
| solo `GEMINI_API_KEY` | `MSG-GEMINI` | `generativelanguage.googleapis.com` |
| solo `ANTHROPIC_API_KEY` | `MSG-CLAUDE` | SDK de Anthropic, modelo `claude-opus-4-7` |
| **las dos** | `MSG-GEMINI` | **solo Google**. Anthropic, 0 llamadas |
| ninguna | error `ai_not_configured` | nadie |
| las dos, y Google responde 429 | error `gemini_rate_limited` | Google, 3 veces (3 modelos). **Anthropic, 0** |
| solo Gemini, y Google responde 429 | error `gemini_rate_limited` | Google, 3 veces |
| `suggestQuoteLines`, solo Gemini / las dos / solo Anthropic | líneas | Google / Google / Anthropic |

**Control positivo:** los dos sumideros registran al menos una llamada (fila 1 y fila 2). El
instrumento ve los dos caminos, así que el «Anthropic, 0» de las filas 3 y 5 es una medición, no
ceguera.

**Conclusión:**
- **Por defecto redacta Google (Gemini).** Anthropic solo entra si `GEMINI_API_KEY` está vacía y
  `ANTHROPIC_API_KEY` no lo está.
- **No hay respaldo en tiempo de ejecución.** Si Google falla (cuota, error, caída), la petición falla.
  No pasa a Anthropic.
- Lo que va a Google, literal en la sonda:
  - `generateQuoteMessage`: `Cliente: <nombre del cliente final>`, profesional, concepto y total.
  - `suggestQuoteLines`: país, moneda, catálogo (hasta 40 productos con precio) y la descripción libre.
- **Qué claves tiene Railway en producción, NO lo he medido.** Ni puedo ni debo leer secretos. Hay un
  indicio, que no es prueba: el propio front de producción (`/dashboard/js/aiQuoteAssistant.js`,
  descargado hoy) remite a `GEMINI_API_KEY`.

## 2. Censo por PALABRA: dónde está el rótulo

Barrido de `Claude|Anthropic|anthropic` y de `Gemini|GEMINI|Google` en `public/` entero (landing,
dashboard y páginas públicas). El mismo barrido en `src/`, que incluye el bot y los mensajes: ahí no
hay ninguna cadena que el usuario vea. Además, `IA` en todos los `.html` de `public/`.

**Control:** el barrido encuentra `privacidad.html:79` (Anthropic), que se sabe que está.

| # | Dónde | Texto | ¿Lo ve alguien hoy? |
|---|---|---|---|
| **R1** | `public/dashboard/js/aiQuoteAssistant.js:15` · cuerpo del modal «Sugerir con IA» | «Describe el trabajo con tus propias palabras y Claude sugerirá las líneas del presupuesto usando tu catálogo de productos.» | **Sí.** El modal lo abren `quotesView.js:4475` y `homeView.js:1010`. Servido hoy por yaqu.app (`curl`, 12.856 B) |
| **R2** | `public/dashboard/js/quotesView.js:1595` · `title` del botón «✨ Sugerir con IA» | «Describe el trabajo y Claude sugiere las líneas del presupuesto» | **Sí**, al pasar el ratón (no en «documento suelto»). Servido hoy (`curl`, 304.383 B). **Lo fija un test:** `tests/scrum600-un-solo-front-documento.test.mjs:209` |
| **R3** | `public/dashboard/js/aiQuoteAssistant.js:190` · modal «Mensaje WhatsApp con IA» | «Claude redactará un mensaje personalizado para enviar a … junto con el presupuesto.» | **No.** `openAiMessageModal` no tiene ninguna llamada en el repo, y la ruta `/admin/ai/quote-message` está declarada `ruta-inalcanzable` en `scripts/_sin-consumir-declarados.json` (S0, SCRUM-1185). Su destino (enchufar o retirar) es **SCRUM-1182** |
| — | `public/privacidad.html:79` | fila de Anthropic | Ya cubierta por la propuesta L1–L6 (SCRUM-1196b) |
| — | `public/index.html` (landing, 2 sitios) | «O se lo dictas a la IA», «con IA» | Sin marca. **Nada que corregir** |
| — | `quotesView.js:4472` | «sugeridas por Claude» | Es un comentario. No se ve |

⚠️ **Corrección a la premisa del encargo:** el texto citado (`:190`) es precisamente el único de los
tres que **nadie ve hoy**. El defecto sigue vivo, pero en R1 y R2, que dicen lo mismo con otras
palabras. **Víctima hoy:** el profesional que abre «Sugerir con IA» lee que su descripción la trata
Claude, y la trata Google.

## 3. Cruce con mi propuesta L1–L6 (SCRUM-1196b, en `main` por #1918, sin firmar)

**Sí, dos literales hay que retocarlos.** No los edito: los propongo aquí. La política publicada
**no se toca**.

**L2: la medición la contradice.** Decía «solo como proveedor de respaldo si Google no está
disponible». La sonda (fila 5) prueba que, si Google no está disponible, **no hay respaldo**: la
petición falla. Anthropic solo entra si YaQu **no tiene configurada** la clave de Google. Así, «no
disponible» describe un mecanismo que no existe.

> **L2′ (propuesta, sin firmar):**
> `<li><strong>Anthropic (Claude)</strong> — la misma asistencia de IA para presupuestos y partes, solo si YaQu no tiene configurado a Google como proveedor de IA (transferencia internacional).</li>`

⚠️ **Decisión que no es mía:** si Railway no tiene `ANTHROPIC_API_KEY`, Anthropic no recibe nada y
L2′ nombra a un encargado que no se usa. Nombrarlo sin usarlo no oculta nada, pero es una fila de más.
**Quien vea las variables de Railway** decide si L2′ entra o se quita (y entonces ninguna fila de
Anthropic).

**L1: cita una función que nadie puede usar hoy.** L1 incluye «el mensaje que acompaña a un
presupuesto», que es `generateQuoteMessage`. Mi propio censo de 1196 se apoyaba ahí para decir «puede
recibir el nombre de tu cliente». Esa función no tiene botón (R3, SCRUM-1182). El nombre del cliente
**sí puede** llegar a Google hoy, pero por otra vía: dentro de la descripción libre o del dictado, si
el profesional lo escribe (la sonda de `suggestQuoteLines` manda la descripción literal).

> **L1′ (propuesta, sin firmar):**
> `<li><strong>Google (Gemini)</strong> — asistencia de IA para redactar presupuestos y partes de trabajo a partir de lo que escribes o dictas (que puede incluir datos de tu cliente, como su nombre, si los mencionas) y de tu catálogo, y para leer el texto de las fotos de tickets de gasto que subes; es el proveedor de IA por defecto (transferencia internacional).</li>`

Si SCRUM-1182 decide **enchufar** el mensaje, hay que volver a meter «y el mensaje que acompaña a un
presupuesto (recibe el nombre de tu cliente, el concepto y el total)». **Eso es lo que se vigila al
cerrar 1182.**

**L3–L6: sin cambios.** Esto no toca Cloudflare, el logo ni la fecha.

## 4. Propuesta de texto para R1, R2 y R3 (SIN FIRMAR)

El profesional necesita saber **qué** se manda y que va a **un tercero**. La marca es secundaria, y
nombrarla ata el texto a la configuración: si cambia la clave, el texto miente otra vez, que es
justamente el defecto de hoy. Por eso recomiendo la **opción A**. La decisión del tono es del
orquestador o de Javier.

**Opción A: sin marca, dice qué sale y adónde (recomendada)**

| # | Literal propuesto |
|---|---|
| R1 | «Describe el trabajo con tus propias palabras y la IA te sugerirá las líneas del presupuesto usando tu catálogo. Lo que escribas aquí y tu catálogo se envían a nuestro proveedor de IA (lo tienes en la política de privacidad); no incluyas datos de tu cliente que no hagan falta.» |
| R2 | «Describe el trabajo y la IA te sugiere las líneas del presupuesto» |
| R3 | Solo si 1182 lo enchufa: «La IA redactará un mensaje para enviar a ${nombre} junto con el presupuesto. Para eso, su nombre, el concepto y el total se envían a nuestro proveedor de IA.» Si 1182 lo retira, R3 desaparece con él |

**Opción B: con la marca real**

| # | Literal propuesto |
|---|---|
| R1 | «Describe el trabajo con tus propias palabras y Gemini, la IA de Google, te sugerirá las líneas del presupuesto usando tu catálogo. Lo que escribas aquí y tu catálogo se envían a Google.» |
| R2 | «Describe el trabajo y Gemini (Google) te sugiere las líneas del presupuesto» |
| R3 | (si se enchufa) «Gemini, la IA de Google, redactará un mensaje para enviar a ${nombre} junto con el presupuesto. Su nombre, el concepto y el total se envían a Google.» |

⚠️ La opción B solo es verdad mientras Railway tenga `GEMINI_API_KEY`. Con la A, el único texto que
tiene que seguir la configuración es la política (L1′/L2′), y ahí es donde se nombra al encargado.

**Para quien lo construya (J3), no es decisión mía:**
- Si cambia R2, `tests/scrum600-un-solo-front-documento.test.mjs:209` fija el literal viejo. Se
  actualiza **con el texto firmado**: eso es cambiar el código y su expectativa a la vez, no relajar un
  guard (regla 41).
- R1 lleva un enlace implícito a la política. Si se enlaza, `privacidad.html` es la ruta.

## 5. Hallazgo de otro carril (se reporta, no se arregla)

`aiQuoteAssistant.js:74` y `:245`: cuando la IA no está configurada, al **profesional** se le dice
«La IA no está configurada. Añade GEMINI_API_KEY (gratis) en Railway.». Es una instrucción de operador
que ve un cliente de pago, y además revela el proveedor por una puerta lateral. Es microcopy de
producto, no legal: aquí solo queda anotado.

## Suelo (lo que NO dice esta medición)

- No mide qué claves hay en Railway. «Por defecto» significa **por el código**, no «en producción está
  demostrado».
- No se ha visto el modal en un navegador con sesión: R1 y R2 se dan por visibles por sus llamadas en
  el código servido hoy, no por una captura.
- El censo es por palabra (`Claude`, `Anthropic`, `Gemini`, `Google`, `IA`). Si alguna pantalla nombra
  al proveedor con otra palabra, no lo ve.

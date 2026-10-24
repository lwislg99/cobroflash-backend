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

---

# SCRUM-1247b · El texto firmado, aplicado (J3)

**Medido contra:** `origin/main` = `e5acad15ffbe6ce2bfbbb38b40987519b44b43f6` · 2026-09-28T20:20:05Z

**Puesto:** J3 (jv-j3). **Encargo:** del orquestador (`cobroflash-backend-3c`), con el texto firmado en
**SCRUM-1247 comentario 17425**: opción A. La rama sale del commit de J4 (`3569156e`, el expediente de
arriba) para anexar esta sección en el mismo fichero y no crear un segundo `SCRUM-1247.md` que
chocase con el suyo (A8: un fichero por ticket, se anexa).

## Qué cambia

| ranura | fichero | antes | ahora (firmado, 17425) |
|---|---|---|---|
| R1 | `public/dashboard/js/aiQuoteAssistant.js`, `openAiSuggestModal` | «…y Claude sugerirá las líneas del presupuesto usando tu catálogo de productos.» | «Describe el trabajo con tus propias palabras y la IA te sugerirá las líneas del presupuesto usando tu catálogo. Lo que escribas aquí y tu catálogo se envían a nuestro proveedor de IA (lo tienes en la política de privacidad); no incluyas datos de tu cliente que no hagan falta.» |
| R2 | `public/dashboard/js/quotesView.js`, `aiBtn.title` | «Describe el trabajo y Claude sugiere las líneas del presupuesto» | «Describe el trabajo y la IA te sugiere las líneas del presupuesto» |

Registro de microcopy: `docs/microcopy/2026-09-28-SCRUM-1247-rotulo-ia.md`, con la línea de firma que cita 17425.

## 🔴 Lo que se ve como un guard tocado y NO es una relajación (regla 41)

`tests/scrum600-un-solo-front-documento.test.mjs` fija R2 con `===` en su lista `RANURAS_A`. Esa
entrada **cambia de literal en el mismo commit que el código**, al texto firmado en 17425. La ranura
sigue fijada con `===`, el recuento de ranuras no cambia y el test sigue cayendo si alguien toca el
rótulo. Se cambia el código y su expectativa a la vez: no se afloja nada.

## Rojo primero

`tests/scrum1247-rotulo-ia-no-nombra-proveedor.test.mjs`, comiteado solo y en rojo (`a923fc66`): **4 de
4 fallan** contra el código de antes. Los fallos enseñan los textos viejos saliendo: R1 «…y Claude
sugerirá las líneas…» y R2 «Describe el trabajo y Claude sugiere las líneas del presupuesto». Con el
cambio: 4 de 4 en verde, y 26 de 26 junto con scrum600 y scrum709.

El test mira R1 **dentro de `openAiSuggestModal`**, cortado donde empieza `openAiMessageModal`. No mira
el fichero entero, porque en él vive R3 («Claude redactará…»), que no es de este ticket. Lleva un
control positivo: el patrón de marca (`Claude|Anthropic|Gemini|Google`) sí caza el texto viejo.

**Error propio, corregido antes de empujar:** el commit en rojo buscaba el párrafo con `<p style="…">`, con el `>` pegado a un atributo, y la suite entera lo cazó (`scrum553`, tope 20 y salían 21). Se arregló el test, no el guard: ahora es `<p\b[^>]*>`. Pasada sobre el texto viejo, la regex nueva sigue sacando «…y Claude sugerirá…», así que el rojo sigue siendo válido. El registro también se llevó un byte 0x08 al escribir la regex (cazado por `scrum942`), y se corrigió.

**Suite entera** (`node --test 'tests/*.test.mjs'`, tras `prisma generate` y `npm run build`): 8912 tests, 8778 pasan, **0 fallan**, 134 saltados. Los saltos son los que piden base, que este árbol no tiene.

## ⛔ Lo que no se ha tocado

- R3, `openAiMessageModal` («Claude redactará un mensaje personalizado…»): de SCRUM-1182, sin firmar.
- `src/modules/ai/`: nada.
- L1′/L2′ de la política de privacidad: son del fundador.
- El hallazgo del §5 (`aiQuoteAssistant.js:74` y `:245`, «Añade GEMINI_API_KEY (gratis) en Railway»):
  sigue igual, porque no hay texto firmado para él.

## Suelo

- Los literales se comprobaron en el `origin/main` del ancla antes de tocarlos: R1 en
  `aiQuoteAssistant.js:15` y R2 en `quotesView.js:1595`, los dos tal como los citó J4.
- Mientras tanto `main` no ha tocado ninguno de los tres ficheros de código y test, y la rama mergea
  limpia sobre el ancla (`git merge-tree`).
- No se ha visto en un navegador con sesión: el modal pide iniciar sesión, y este árbol no tiene base.
  Se verifica en yaqu.app cuando entre.

---

# SCRUM-1247e · Q1 construido: sin clave de Gemini no hay IA, y nada sale a Anthropic (S1)

**Medido contra:** `origin/main` = `063a4ec3538d52842ffa94410ff90b163ef99055` · 2026-10-24T12:49:23Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1247e-ia-sin-segundo-proveedor.test.mjs`

[S1, equipo de Luis. La decisión: c.20779, Q1 «Sí, quitarlo».]

**La premisa, leída en este árbol.** `ai.service.ts:42-53` era lo que dice la decisión: si faltaba
`GEMINI_API_KEY` y había `ANTHROPIC_API_KEY`, `aiComplete` mandaba la petición a Anthropic
(`claude-opus-4-7`). ⚠️ **No era un respaldo ante FALLO**: con Gemini configurado y caído, ya no caía a
Anthropic (lo midió J4 el 28-sep, §1). Era una elección por configuración. Y había una segunda mitad que
la decisión no nombra y hay que quitar a la vez: `isAiConfigured()` (`:29`) también contaba
`ANTHROPIC_API_KEY`. Quitar sólo el bloque habría dejado las rutas diciendo «configurada» y fallando
dentro.

**El arreglo.** Fuera el bloque y la mitad de `isAiConfigured`; sólo Gemini. `src/integrations/claude.ts`
se queda sin ningún importador (era el único) y se retira. **No se toca** `package.json`
(`@anthropic-ai/sdk` sigue como dependencia, ya sin uso en `src/`) ni `config.ANTHROPIC_API_KEY`
(`core/config/env.ts:103`): quitarlos es limpieza, no la decisión, y lo decide quien reparte.

**El test, por efecto:** tres procesos hijos con su entorno y `fetch` interceptado. Control positivo:
con `GEMINI_API_KEY` la sonda VE la petición a `googleapis.com`. Con sólo `ANTHROPIC_API_KEY`:
`isAiConfigured()` = false, `generateQuoteMessage` falla con `ai_not_configured` y CERO peticiones.

| qué | resultado |
|---|---|
| el test, con el arreglo | 3/3 |
| el MISMO test contra el compilado de `927bda7ab` (código de antes) | cae SÓLO el caso central: `isAiConfigured()` = `true` con sólo la clave de Anthropic; los otros dos, verdes |
| vecinos: los 89 ficheros de `tests/` que nombran el servicio, sus rutas, `integrations/` o los censos de huérfanos | 829 tests · 824 pass · 0 fail · 5 skip (gates) |

**¿Se queda el usuario sin mensaje cuando no hay IA?** Leído en el código, no ejecutado en pantalla:

- «Sugerir con IA» (presupuesto): 503 `ai_not_configured` → la pantalla pinta su propio texto
  (`aiQuoteAssistant.js:74`, R4). Es el que firmó Q2 y construye S2.
- Dictado del parte: 200 con la propuesta vacía y sus avisos (`partes.routes.ts:857`); se sigue a mano.
- 🔴 **Voz del albarán** (`jobDetailView.js:2836`, con `VOICE_ALBARAN_ENABLED`): pinta
  `mensajeParaPersona(e, …)`, que da prioridad al `data.message` del servidor (`api.js:333`). Ese mensaje
  es `ai.routes.ts:11`: «El asistente de IA no está configurado. Añade GEMINI_API_KEY (gratis) en
  Railway.» — una instrucción de operador, al profesional. Es el mismo defecto que Q2 en otra ranura, y
  la firma de Q2 es para `aiQuoteAssistant.js:74`, no para ésta. **No lo escribo: es texto (regla 39).**
  Propuesta: el mismo literal ya firmado en Q2. `ai.routes.ts:28` (`ai_bad_key`, «Revísala en Railway»)
  tiene la misma forma.

**De paso, sin arreglar:** `scripts/voice-eval.mjs:6` pide «ANTHROPIC_API_KEY y BD en .env» para el uso
local; desde aquí, la clave que hace falta es `GEMINI_API_KEY`.

---

# SCRUM-1247c · Re-medición: qué ve el profesional, qué sale al proveedor y qué dice la política (J4)

**Medido contra:** `origin/main` = `25920fe4b1e0848c5ce33f8cb7a01ccf7157b7e0` · 2026-10-24T10:26Z (J4, jv-j4ab)

**Encargo:** del orquestador `cobroflash-backend-95`, 24-oct-2026. Solo medir y preguntar. La medición
completa y las preguntas Q1–Q5 para el fundador están en **SCRUM-1247, comentario 20740**. Aquí va el
resumen. Nada de lo de abajo está firmado (regla 39). No se toca `src/`, ni `public/`, ni la política.
Producción sirve el mismo sha (`/health`, cabecera `Date: Sat, 24 Oct 2026 10:26:43 GMT`).

## Lo que ya no es como dice el ticket

- R1 (`aiQuoteAssistant.js:15`) y R2 (`quotesView.js:1720`, antes `:1595`) **ya no nombran a Claude**.
  Llevan el texto firmado en c.17425, que entró por #1925/#1929 y lo fija
  `tests/scrum1247-rotulo-ia-no-nombra-proveedor.test.mjs`.
- L1′/L2′ (§3) los dejó sin objeto **SCRUM-1154**: firma del fundador en c.17576, commit `bfd23a1ca`.
  La política solo nombra a Google (Gemini) (`privacidad.html:80`) y Anthropic tiene 0 menciones. Lo
  fija `tests/scrum1154-google-encargado.test.mjs`.
- «¿Hay `ANTHROPIC_API_KEY` en Railway?»: el registro de 1154 dice «ni siquiera está puesta». **No lo he
  medido.** Es un dato copiado, con fecha del 30-sep.

## Lo que sigue vivo

| # | Dónde | Hoy | Carril |
|---|---|---|---|
| R3 | `aiQuoteAssistant.js:190` | «Claude redactará…». No tiene llamada (`openAiMessageModal`: 0 en `public/` y `src/`) y depende de SCRUM-1182 | S2 |
| R4 | `aiQuoteAssistant.js:74` | «La IA no está configurada. Añade GEMINI_API_KEY (gratis) en Railway.». **Se ve** con `ai_not_configured`. Ningún test la fija | S2 |
| Camino a Anthropic | `src/modules/ai/domain/ai.service.ts:42-53` | Sin `GEMINI_API_KEY`, los datos van a Anthropic, que la política ya no nombra. «Si se enciende, vuelve a firma» (1154) **no tiene mecanismo** | S1 |

## Qué sale: sonda AST sobre el `user` de cada llamada

Sonda de un solo uso, fuera del repo, con el compilador de TypeScript. Control positivo SEMBRADO: un
fichero fabricado con `aiComplete({ user: \`S: ${p.SEMBRADO_1247}\` })`. Con él, 7 llamadas con carga;
solo él, 1; sin ficheros, 0.

- `suggestQuoteLines` (`:139`): país, moneda y **catálogo (hasta 40 productos activos con nombre y precio,
  siempre)**, más la descripción que escribe el profesional.
- `suggestAlbaranLines` (`:368`, solo con `VOICE_ALBARAN_ENABLED`): lo mismo; el catálogo, solo en
  modo VALORADO.
- `suggestLineasDeParte` (`:415`): solo el dictado.
- `generateQuoteMessage` (`:397`, sin botón): nombre del cliente final, profesional, concepto y total.
- Ticket de gasto (`lecturaTicket.ts:305-315`): la imagen, solo a Gemini. **Esta fila no la midió la
  sonda.** La llamada va por la variable `completar` y la sonda casaba por nombre de función. Se leyó en
  el código, cruzando por `geminiCompleteConModelo`.

Nada sale hasta que el profesional pulsa.

## Suelo

- Railway no se ha medido.
- No se ha visto el modal con sesión: la visibilidad sale de las llamadas en el código servido.
- El censo es por palabra.
- Suite local: NO CORRIDA (solo docs). El obligatorio se lee en CI.
- El comentario 20740 lleva una errata de formato: un acento grave escapado en la línea del control
  positivo. No cambia ningún dato.

A9: aviso → A10 «Un barrido que busca dónde se escribe un campo no ve el objeto que se construye en otro fichero: se cruza con el nombre del campo.» — no se pudo comprobar: la sonda AST casaba por nombre de función y no vio la llamada del ticket hecha por la variable `completar`; es de un solo uso y vive fuera del repo, y lo cazó cruzar con el `grep` de los importadores de `integrations/gemini`

## SCRUM-1247d · el error «IA no configurada» del modal pasa al texto firmado (Q2, c.20779)

[Anexado por S2, equipo de Luis, el 24-oct-2026 (Date: Sat, 24 Oct 2026 12:43:59 GMT), sobre `origin/main`
`927bda7ab44b604d81bca8c453663e7fc6f6cda9`. Encargo del orquestador de Luis. Carril: `aiQuoteAssistant.js` → S2
(`dos-equipos.md:152`).]

**Skill UI:** cargada (yaqu-premium-ui). Sólo cambia el literal de un aviso que ya existía.

A9: comprobación → `tests/scrum1247d-ia-no-disponible.test.mjs`

### La firma, citada

SCRUM-1247 **c.20779** (24-oct-2026, la transcribe el orquestador del equipo de Javier): «Q2: FIRMADO (regla 39),
literal: «El asistente de IA no está disponible ahora mismo. Rellena las líneas a mano.» Sustituye a «La IA no está
configurada. Añade GEMINI_API_KEY (gratis) en Railway.» (`aiQuoteAssistant.js:74`). Es S2 (Luis).»

### ¿Es `:74` de verdad el sitio? Comprobado antes de escribir

- `POST /admin/ai/suggest-quote` contesta 503 `{error:'ai_not_configured'}` cuando no hay IA (`ai.routes.ts`,
  `aiUnavailable`); `api.js:299-302` pone el cuerpo en `err.data`; `:73` lo distingue. Es alcanzable.
- Es el ÚNICO sitio visible de ese fallo en `public/` (`git grep` de `ai_not_configured` y `GEMINI`). Su gemelo
  `:245` es R3 (`openAiMessageModal`, 0 llamadas): Q4 dice esperar a SCRUM-1182, y no se toca.
- ⚠️ **No es la única SALIDA de fallo:** los otros seis códigos (`ai_rate_limited`, `ai_cap`, `ai_bad_key`,
  `ai_provider_error`, `ai_could_not_parse`, `internal_error`) caen en el genérico de `:75` y el `message` del
  servidor se tira. Fuera de la firma; no se tocan. El orquestador lo sube como ticket aparte con esta medida.
- Encaja con Q1 (S1): sin la clave de Gemini, la respuesta sigue siendo `ai_not_configured`, que es lo que `:74` recoge.

### Medido

- `tests/scrum1247d-ia-no-disponible.test.mjs`, por EFECTO: abre el modal en el banco de vistas, escribe una descripción,
  pulsa «Generar sugerencias» y lee el aviso pintado. ① 503 `ai_not_configured` → el texto firmado, sin «GEMINI» ni
  «Railway» · ② CONTROL: 502 `ai_provider_error` → el genérico, no el firmado. **2 de 2.**
- **Rojo primero:** con el `aiQuoteAssistant.js` de `origin/main` cae ① y el control ② aguanta.
- **Mutaciones** (`docs/master/evidencias/scrum1247d/mutar-1247d.mjs <raiz> origin/main`): las 2 del catálogo tumban ①.
- yaqu.app: con la IA configurada en producción, este aviso no sale. Para verlo habría que quitar la clave; no lo he
  intentado. Lo que se puede mirar en prod es que el JS servido lleva el literal.
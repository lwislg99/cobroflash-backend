# SCRUM-1856 · el dictado no cae entero por un 503 de Google

**Medido contra:** `origin/main` = `92df30d4d9c469d74f842ec596ea0a865ae6cebe` · 2026-11-25T13:12:22Z

A9: sin fallo que generalice — rojo-primero visto, cura y test en el mismo tramo; nada salió mal que pida una norma.

**Skill UI:** no aplica (solo servidor). **Microcopy:** ninguna: cero texto que vea el usuario. El motivo de pantalla es el **tramo (b)**, pendiente de firma, y aquí NO se toca.

## SCRUM-1856a · tramo (a), solo servidor (S1; decisión c.22780)

### Qué pasaba (PASO 0: reproducido)

Lo vio el fundador en la captura de Railway (producción, 25-nov-2026, 09:00–09:07 CET, **ocho pares**):

    [gemini:gemini-2.5-flash] HTTP 503: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.
    [POST /admin/partes/:id/dictado] ia: gemini_http_error

`geminiCompleteConModelo` (`src/integrations/gemini.ts`) solo saltaba de modelo con 429, 404 o respuesta vacía. Un 503 caía en el `throw e` del bucle: el dictado entero se perdía con los otros dos modelos de la lista libres. Además: el 429 calculaba sus `quotaId` y no los logueaba (solo viajaban dentro del error), y «el modelo contestó y el saneador no sacó líneas» (`ai.service.ts` `suggestLineasDeParte`, los dos `return` del final; `parteDictado.ts` `sanearDictadoDelParte`, el `cuantas === 0`) no dejaba ninguna línea en el log.

### La cura

| pieza | dónde |
|---|---|
| ① 500/502/503/504 (`gemini_http_error` con ese `httpStatus`) saltan al siguiente modelo, como un 429. Al saltar se loguea qué modelo no contestó y por qué. Si fallan todos, el error es **el mismo de antes** (`gemini_http_error`, 503): la pantalla no cambia | `gemini.ts`: `HTTP_TRANSITORIOS`, `esTransitorio`, bucle de `geminiCompleteConModelo` |
| ② el 429 escribe sus `quotaId` en el log (o que el cuerpo no los trae) | `gemini.ts`, rama 429 de `callGeminiModel` |
| ③ el vacío del saneador deja UNA línea `[ai:dictado]` con el modelo, la forma (`sin_json` / `json_invalido` / `lista`), los elementos y la longitud. **Ni el dictado ni la respuesta van al log** | `ai.service.ts` `suggestLineasDeParte` (con `aiCompleteConModelo`, que solo añade el nombre del modelo a `aiComplete`) |

`parteDictado.ts` es una función pura y **no se toca**: el log se pone en quien la llama, que conoce el modelo. Regla 40: `gemini.ts` no es camino de emisión; el dictado escribe partes, pero el resto del camino solo se ha LEÍDO.

### Medición

Test: `tests/scrum1856a-salto-con-503.test.mjs` (12 casos; `fetch` simulado, código real de `dist/`; el 503 lleva el mensaje literal de la captura y el test comprueba que el log sale igual que en Railway).

| | antes de la cura (base = esta rama sin `src/`) | después |
|---|---|---|
| test nuevo | 2 pass / **10 fail** (los 2 que pasan son los CONTROLES: un 400 no salta; un dictado con líneas no loguea el vacío). Los cuatro de salto caen con `Error: gemini_http_error` en el primer modelo | 12 / 12 |
| vecinos: 49 ficheros de `tests/` que nombran `gemini`, `ai.service`, `parteDictado` o `dictado`, + los 5 de árbol entero de SCRUM-1560 + `scrum1185` + `scrum411` = 56 ficheros | — | 467 tests · 466 pass · 0 fail · 1 skip |
| `npm run guards:entrada` | — | 17 guards, salida 0 |

`scrum1185` cazó antes del push una primera versión en la que `aiComplete` pasaba por `geminiCompleteConModelo` y dejaba `geminiComplete` sin consumidor: se arregló el código (`aiComplete` sigue como estaba; sólo el dictado usa la variante con modelo), no el guard.

**No medido:** contra Google de verdad (no hay clave en esta sesión, regla 9); en yaqu.app, hasta el merge.

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| el 503 (y 5xx transitorios) entran en la lista de SALTO DE MODELO | `tests/scrum1856a-salto-con-503.test.mjs` (503 + 500/502/504; control 400) |
| loguear los quotaId del 429 | ídem, caso «el 429 deja en el log su quotaId» |
| loguear el caso hoy SILENCIOSO | ídem, cuatro formas del vacío + control |
| CERO texto de usuario; el motivo de pantalla NO se toca | ídem, «con TODOS en 503 … el error es el MISMO de antes» y `motivo === 'sin_lineas_reconocidas'` |
| fixture con el 503 literal de los logs | ídem, `LOG_503_DE_RAILWAY` |

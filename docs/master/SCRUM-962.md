# SCRUM-962 · Detalle del Trabajo: 8 de 14 controles por debajo de los 44 px de AB6

**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T09:12:53Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`). Rama creada de nuevo sobre `origin/main` ya con SCRUM-1033/1034 mergeados (PR #1648), tras montar el trabajo por error sobre una rama sin mergear todavía y recolocarlo con `git stash` + `checkout -B`.
**Rama:** `scrum-962-controles-44px`.
**Microcopy:** ninguna nueva. No se ha tocado ningún literal (regla del ticket).

## Paso 0: el defecto existía hoy

`node scripts/guard-detalle-trabajo-917.mjs` sobre el árbol sin tocar: 7 de 14 controles por debajo de 44 px en tres de los cuatro casos (PAGADO, A MEDIAS, COBRADO DE MÁS) y 6 de 10 en SIN PRESUPUESTO — la allowlist `DEUDA_44PX` que dejó SCRUM-917h. Con la lista de nombres y tamaños (forzando el guard con un techo imposible para que la imprima): `button«Trabajos» 43.7×18.6` (la miga), `button«+ Añadir gasto» 110.5×30.0`, `button«+ Nuevo albarán» 120.9×30.0`, `input«» 13.0×13.0` (la casilla «Incluir precios en el parte»), `button«Parte de trabajo» 116.9×30.0`, `button«Cambiar» 71.3×30.0`, `a«Abrir en mapa» 84.0×20.1`. Los cuatro `.btn-sm` miden 30 px de alto: **es el mismo `.btn-sm` que ya señalaba el hermano SCRUM-786** (30,8-31,0 px).

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/css/styles.css` | `.detail-miga-link`: `min-height:44px; min-width:44px` (le faltaban las dos — con solo la altura medía 43,7 de ancho). `.detail-rail-linea a, .detail-rail-enlace--suelto`: el enlace «Abrir en mapa» del bloque DÓNDE es un enlace SUELTO que se había quedado fuera de la regla de 44px que sí llevan los enlaces de `.detail-rail-linea`. `.job-toolbar-btn-44` (clase nueva, **opt-in**): `min-height:44px`. `valoradoLabel` (inline, ya existía): +`min-height:44px` — mismo patrón que `.quote-line__suplido label`. |
| `public/dashboard/js/jobDetailView.js` | Los 4 botones (`+ Nuevo albarán`, `Parte de trabajo`, `+ Añadir gasto`, `Cambiar`) ganan la clase `job-toolbar-btn-44` además de sus clases de siempre. |
| `scripts/guard-detalle-trabajo-917.mjs` | `DEUDA_44PX` baja de `{7,7,6,7}` a `{1,1,1,1}` (las dos mitades del trinquete: no sube, y la bajada real se declara con su motivo — no se cierra en falso). |
| `scripts/guard-objetivo-tactil.mjs` | Censo INDEPENDIENTE del mismo problema (SCRUM-542/787/791), con su propio suelo: `distintosEsperados` de `renderJobDetailView` baja de 5 a 1, y se retiran del array `EXCEPCIONES_791` las tres entradas que ya no aplican (`BUTTON.btn-ghost.btn-sm`, `BUTTON.btn-secondary.btn-sm`, `BUTTON.detail-miga-link`) — las detectó el propio guard como SOBRANTE/CADUCA al correrlo tras el arreglo, no se adivinaron. |

## Por qué NO se toca `.btn-sm` en general

Es la causa compartida con **SCRUM-786** (hermano, citado por el propio 962). Cambiar `.btn-sm` globalmente tocaría decenas de pantallas fuera del alcance de este ticket y del PASO 0 que lo midió. Se optó por una clase de **opt-in** (`.job-toolbar-btn-44`) aplicada solo a los 4 controles de esta pantalla — reportado, no arreglado en el sitio compartido.

## Por qué la casilla («Incluir precios en el parte», 13×13) se queda como deuda declarada, no arreglada

Mismo patrón que `.quote-line__suplido` (styles.css, con su propio comentario extenso): el checkbox nativo se deja pequeño **a propósito** y es la ETIQUETA la que lleva el área de 44 px — ya se la dimos (`min-height:44px` en `valoradoLabel`). Agrandar el `<input>` en sí (lo único que este guard mide) contradiría ese patrón ya establecido y aceptado en el repo. El ticket queda vivo con 1 (antes 6-7), no se cierra en falso — mismo criterio que el propio SCRUM-962 pedía para SCRUM-917g.

## Verificado en rojo (por EFECTO, midiendo cada paso)

Cada fix se verificó viendo bajar el recuento real del guard (forzado con un techo imposible para ver la lista completa de "pequeños" en cada paso): 7/7/6/7 → (fix migas+mapa+4 botones) → 2/2/2/2 (quedaba solo `button«Trabajos» 43.7×44.0` por 0,3 px de ancho + la casilla) → (min-width en la miga) → 1/1/1/1 (solo la casilla). Restaurada la allowlist al valor final, el guard vuelve a verde con «DEUDA HEREDADA declarada, ni sube ni baja» en los 4 casos × 2 anchuras (92/92).

## Segundo guard, encontrado al correr `guards:visuales` (dos censos independientes del mismo hallazgo)

`guard:objetivo-tactil` (SCRUM-542/787/791) vigila el MISMO problema con su propio censo, separado de `guard-detalle-trabajo-917.mjs`. Al arreglar los controles, ese guard salió en rojo por CIEGO (esperaba seguir viendo 5 objetivos cortos y solo encontró 1) y por dos EXCEPCIONES SOBRANTES + una CADUCA. Se corrigió `distintosEsperados: 5 → 1` y se retiraron las tres excepciones que el propio guard señaló como ya cumplidas — confirmación cruzada, por un instrumento que no toqué yo, de que el arreglo es real y no un artefacto de `guard-detalle-trabajo-917.mjs`.

## Pendiente

Verificar en yaqu.app a 1280 y 390 px (los cuatro botones de la barra de documentos, «Cambiar» del tipo de trabajo, la miga «Trabajos ›» y «Abrir en mapa» del bloque DÓNDE). Reportar SCRUM-786 como posible cierre conjunto si decide tocar `.btn-sm` en general.

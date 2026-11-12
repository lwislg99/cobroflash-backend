# SCRUM-1654 · La otra puerta que pierde opciones (Usar plantilla) y un aviso que nadie ha visto nunca

**Medido contra:** `origin/main` = `5986d520a77dc7076ad86ea656e1550ee75c7215` · 2026-11-10T17:18:20Z

A9: sin fallo que generalice — sólo medida; ningún código cambiado

**Skill UI:** no cargada · entrega de sólo medida: no se toca ninguna pantalla, componente ni CSS

## SCRUM-1654 · S2, 10-nov-2026: las dos mitades, MEDIDAS; no se construye nada

### ① «Usar plantilla» y las opciones: el sumidero es el mismo, la puerta NO existe hoy

| hecho | dónde |
|---|---|
| Duplicar y «📋 Usar» de Plantillas acaban en el MISMO sitio, que ignora `tiers` | `quotesView.js:5107-5133` (`loadInitialData`; lo dice el comentario de `:5130`) |
| Duplicar sale de la ficha con `tiers` y la marca `soloLaRecomendada` | `quotesDetailView.js:1526-1533` |
| «📋 Usar» de Plantillas pasa el objeto de la API tal cual, sin marca | `templatesView.js:118` |
| Hay una TERCERA puerta: el botón «📋 Usar plantilla» del editor, que tampoco mira `tiers` | `quotesView.js:4874` → `cargarPlantilla`, `:4732` |
| **Ninguna pantalla guarda `tiers` en una plantilla**: el editor no los manda, a propósito | `quotesView.js:5053-5056` (PUT) y `:5068-5071` (POST) |
| El catálogo de oficio crea plantillas sin `tiers` | `products.routes.ts:135-143` |
| El único camino que escribe `tiers` en una plantilla es `POST/PUT /admin/templates` llamado a mano | `templates.routes.ts:51-65`, `:94-97` (SCRUM-1545c) |
| En producción: cuenta QA 1 plantilla (#38, `tiers` null); demo 0 plantillas | `GET /admin/templates`, 10-nov 17:13Z |

**Conclusión.** No es la misma causa que en el duplicado. En el duplicado el presupuesto de 3 opciones lo crea el
propio producto (presupuesto rápido, `homeView.js:1441-1455`) y el editor tira dos. Por plantilla, el sumidero es el
mismo, pero **un profesional no puede tener hoy una plantilla con opciones**: ninguna pantalla la crea. La premisa
del ticket («el que llega por plantilla cree que tiene copiadas sus tres opciones») no se da por ninguna puerta del
producto. Además el literal de 1651 no valdría ni adaptado: en una plantilla, `lines` y `tiers` se guardan por
separado (`templates.routes.ts:59-66`), así que lo que carga el editor no tiene por qué ser «la recomendada».

**No se construye el aviso.** Sería código para una población que hoy vale cero, con un texto por firmar. Pasa a
ser real el día que una pantalla guarde opciones en una plantilla (el editor de opciones, SCRUM-1545). Ese mismo
cambio tiene que arreglar las TRES puertas a la vez: restaurar las opciones, no avisar de que se pierden.

### ② El aviso «Plantilla … cargada»: SÍ se pinta, y dura ~110 ms

| hecho | dónde |
|---|---|
| Se pinta al cargar la plantilla, antes de los `await` | `quotesView.js:5133` |
| Con plantilla `templatePending = true` → no se restaura borrador → `draftRestored` sigue `false` | `quotesView.js:5190-5204` |
| Tras `await Promise.all(...)` lo vacía | `quotesView.js:5205` (`setAlert(null, "")`) |
| **En producción** (build `5986d520a`, cuenta QA, plantilla #38): visible de 181 a 293 ms a 1280 y de 263 a 383 ms a 390, luego vacío | sonda `sondas-s2/plantilla-1654.mjs -` (fuera de git), observador de mutaciones |

Control del instrumento: la sonda escribe «CIEGO» porque no vio «Cargando datos…». No está ciega: ese texto se
sustituye en la MISMA tarea síncrona (`:5099` → `:5133`), antes de que el observador corra. El control positivo
real es que el observador sí ve el aviso de la plantilla aparecer y desaparecer. Arreglar el rótulo de la sonda
queda para la próxima vez que se use.

**Recomendación de S2: RETIRARLO.** Motivo, visto en pantalla a 390: al llegar por «Usar» se ve el paso
«1 Cliente», con «¿Para quién es el presupuesto?» y «Elige un cliente para seguir». La mitad «completa los datos
del cliente» ya la dice la pantalla. La otra mitad (que la plantilla se cargó) la cuenta el total de abajo, que
ya sale con el importe. Encenderlo empujaría el formulario hacia abajo a 390 con un texto que nadie ha visto ni
firmado. Si se retira, el commit dirá que se retira **porque no era visible**. Nada aplicado: lo decide el
orquestador.

Fuera de este ticket, sin tocar: el aviso de `cargarPlantilla` (`:4744`, botón del editor) sí queda en pantalla,
porque esa puerta no pasa por `loadInitialData`.

## SCRUM-1654 ② · S2, 10-nov-2026 ~17:30Z (Date: GitHub): se RETIRA el aviso que no era visible

**Skill UI:** no cargada · se borra una línea que no pintaba nada que se viera; ni tokens, ni clases, ni maquetación.

Decisiones del orquestador (encargo a S2, 10-nov-2026, sesión de relevo): ① NO se construye (población cero; el
mapa de las tres puertas queda como requisito de aceptación de SCRUM-1545, c.21406) y ② se retira el aviso.

**Antes de tocar, medido qué limpia el vaciado de `:5205`** (`if (!draftRestored) setAlert(null, "")`): dentro de
`loadInitialData` (`:5097`) los `setAlert` son `:5099` «Cargando datos…» (se pinta al empezar), `:5133` el de la
plantilla, `:5202` el del borrador restaurado (y entonces `:5205` no corre) y `:5218` el error (en el `catch`,
después). O sea: `:5205` es el que QUITA «Cargando datos…» cuando no hay borrador. Sirve a más cosas → **se queda**.
Lo único que se retira es `:5133`, la línea que pintaba el aviso; no la alimentaba nada más (`template.name` sólo
se usaba ahí; `templatePending` sigue haciendo falta en `:5193`).

| qué | dónde |
|---|---|
| aviso retirado | `public/dashboard/js/quotesView.js` (antes `:5133`), con comentario de por qué en su sitio |
| censo de ranuras de SCRUM-600 | `tests/scrum600-un-solo-front-documento.test.mjs`: sale su fila de `RANURAS_A`; 31 → 30 posiciones, 29 → 28 textos, con la línea de historia |
| visible en producción | **nada cambia**: el aviso vivía ~110 ms y quedaba vacío (medido en yaqu.app, tramo de arriba). Por eso no pide firma |

Se retira **porque no era visible**, no porque sobrara: si algún día se quiere avisar de que una plantilla se
aplicó, será un texto nuevo con su firma (regla 39) y un sitio donde no lo borre la carga.

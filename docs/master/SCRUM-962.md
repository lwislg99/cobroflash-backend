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

---

## Tramo 962b (S2, 22-oct-2026) · ¿Cómo eligió su población el censo de los 44 px? Y qué se le escapó

**SÓLO LECTURA. No se ha arreglado ningún control** (encargo del orquestador, comentario 20052 del ticket: el contenedor de Configuración es de **J3** — `node scripts/carriles.mjs de public/dashboard/js/settingsView.js` → `J3 (contenedor) · docs/equipo/dos-equipos.md:146`).
**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún CSS; sólo se mide.
**Medido contra:** `origin/main` = `9839aa6c2baee741f6a38de4e99c7fc29a3fe807`, worktree fijado a esa punta (`rev-list --count HEAD..origin/main` = 0). Hora de GitHub (`gh api -i zen`): 2026-10-22 09:44 GMT.
**Producción NO sirve esto:** está congelada en `fe65a8b7` (dato del orquestador, 09:12Z). Todo lo de abajo está **medido con el árbol de `origin/main` servido en local**, no en yaqu.app.
**Rama:** `scrum-962b-poblacion-del-censo-44`.

A9: sin fallo que generalice — el «36 px» que S2 apuntó de paso el 19-oct sale hoy 38,0/38,9 y sólo en dos `select`; se corrige aquí con la medida, y la lección («un alto se mide, no se deduce») ya está escrita.

### El censo del que se habla

`scripts/censo-objetivo-tactil-panel.mjs` (`npm run censo:tactil-panel`, SCRUM-787), el que corre en cada PR en el job informativo de guards de navegador. Corrido hoy tal cual: **29 vistas, 28 medidas, 1 no medida (`renderPartesOficinaView`), 0 sondas fallidas, 72 elementos distintos por debajo de 44 px**, y en Configuración **1 corto** (`Copiar link`, 30,5–30,8 px) a cada anchura.

⚠️ **Matiz a la hipótesis del encargo:** el censo **nunca dijo «0» en Configuración** — dijo 1. Pero la hipótesis de fondo **es cierta**: los selectores de Configuración no estaban en su población, y no por casualidad (abajo).

### ① Cómo elige su población — lo que declara y lo que no

| eje | qué hace | ¿lo declara? |
|---|---|---|
| **qué pantallas** | las `render*View` que publica el banco (`tests/_banco-vistas.mjs`), montadas con los datos de `_datos-del-censo.mjs` | **sí** (cabecera, «LA POBLACIÓN SE DERIVA») |
| **qué es un «control»** | `INTERACTIVOS` de `scripts/_medidor-de-toque.mjs:52`: `a[href], button, [role="button"], summary, input[type="submit"], input[type="button"], input[type="checkbox"]`. **Fuera: `select`, `textarea`, `input` de texto, búsqueda, fecha, número, color y `radio`** | **no.** Lo importa sin decir qué deja fuera. El comentario de `INTERACTIVOS` cuenta que se le añadieron las casillas (SCRUM-782) porque «un selector incompleto es la misma ceguera que una página no visitada», y el selector sigue incompleto |
| **qué estado de la pantalla** | **sólo el del montaje.** Lo que está en `display:none` (las 8 pestañas de Configuración que no son la primera, pasos del editor, menús) cae en la columna `sinPintar` y **no se cuenta como corto ni como «no medido»** | **no.** `sinPintar` sale como número en una columna; no entra en `NO MEDIDAS` ni en el exit 2 |
| **con qué datos** | el comercio de muestra es `{ id, name }` (`_datos-del-censo.mjs:119-120`, que ya avisa: «claves completas SIN medir») | sí, el contrato; **no** que una tarjeta entera no se pinte por ello: `renderPublicProfileCard` (`settingsView.js:1507`) se retira si no hay `slug`, y la pestaña «Tu página pública» sale vacía |
| **contra qué mínimo** | `MINIMO_TACTIL` (44) **a las dos anchuras**, también a 929 | **no**, y contradice `minimoPara()` del mismo fichero (`_medidor-de-toque.mjs:75`: 36 por encima de 768, decisión del fundador del 15-sep, DESIGN.md §5) |
| **la sonda** | un `<button>` de 12 px por superficie | sí — pero **la sonda es un botón**, y un botón siempre está en el selector: **prueba que la superficie se mide, no que la población esté completa**. Un `<select>` de 20 px no lo habría cazado nunca |

Medido: **de los 36 `<select>` pintados al montar en las 28 superficies (las dos anchuras), 0 están en el selector del censo.**

### ② Configuración, pestaña por pestaña

**Dos instrumentos, y coinciden:** (a) el mismo banco serializado del censo, abriendo cada pestaña como hace `pintarNav` (`settingsView.js:143-145`: un panel en `flex`, el resto `none`); (b) la vista **viva** con los scripts del índice (`scripts/_banco-lista.mjs`), **pulsando** cada pestaña. Las cifras de (a) y (b) difieren en ≤0,5 px. La tabla es la de (b), con un comercio completo (`slug`, `publicProfileEnabled`) y `appModoEmision='fiscal'` para que se pinten la pestaña pública y Cumplimiento. **Alto = área de toque** con el árbitro del censo (`__areaDeToque`), no la caja CSS; la caja va aparte.

| pestaña | control | rótulo | caja @390 | toque @390 | toque @929 | ¿llega a 44 a 390? | ¿en la población del censo? |
|---|---|---|---|---|---|---|---|
| (fuera de paneles) | button | · Presupuestos por WhatsApp… (lista de «qué te falta») | 161.6 | 162.6 | 85.9 | sí | no · los datos de muestra no la pintan |
| (fuera de paneles) | button | · Cobro por transferencia o Bizum… | 181 | 181 | 85.8 | sí | no · los datos de muestra no la pintan |
| (fuera de paneles) | button | · Cobros con tarjeta… | 64.3 | 64.9 | 65 | sí | no · los datos de muestra no la pintan |
| (fuera de paneles) | button | · Datos fiscales… | 122.9 | 123.8 | 85.9 | sí | no · los datos de muestra no la pintan |
| (fuera de paneles) | button[role=tab] ×9 | Empresa … Equipo | 44 | 44.8 | 45 | sí | sí |
| (fuera de paneles) | button | Guardar cambios | 44 | 44.5 | 44.5 | sí | sí |
| (fuera de paneles) | input[text] | ref-link (enlace de «Invita y gana») | 41 | 41.8 | 42 | **NO** | no · el selector no incluye input |
| (fuera de paneles) | button | Copiar link | 30 | 30.7 | 30.5 | **NO** | sí |
| empresa | input[text] ×6 | Nombre comercial, Razón social, NIF/CIF, Dirección fiscal, Teléfono WhatsApp, Moneda | 44.5 | 45–45.5 | 45–45.5 | sí | no · el selector no incluye input |
| empresa | select ×4 | Criterio de caja, ¿SII?, ¿País Vasco o Navarra?, País | 44.5 | 45–45.5 | 45–45.5 | sí | no · el selector no incluye select |
| facturacion | input[text] | Prefijo de serie de facturas | 44.5 | 45 | 45.5 | sí | no · el selector no incluye input |
| facturacion | **select** | **Retención de IRPF** | **38** | **38.9** | **38.9** | **NO** | no · el selector no incluye select |
| facturacion | **select** | **¿Qué tipo de actividad tienes?** | **38** | **38.9** | **38.9** | **NO** | no · el selector no incluye select |
| facturacion | button | Añadir condición | 21 | 22 | 22 | **NO** | no · pestaña oculta al montar |
| cobro | input[text] ×3 | IBAN, CLABE, Bizum | 44.5 | 45–45.5 | 45–45.5 | sí | no · el selector no incluye input |
| avisos | input[text] | enlace de reseñas de Google | 44.5 | 45 | 45.5 | sí | no · el selector no incluye input |
| avisos | input[checkbox] ×3 | email al pagar · email al aceptar · resumen semanal | 16 | 17 | 17 | **NO** | no · pestaña oculta al montar |
| avisos | button | Vista previa | 30 | 30.8 | 30.5 | **NO** | no · pestaña oculta al montar |
| publica | a | yaqu.app/p/… ↗ | 17 | 18 | 18 | **NO** | no · los datos de muestra no la pintan |
| publica | input ×3 | slug, zonas, años de experiencia | 44.5–45 | 45–46 | 45–45.9 | sí | no · el selector no incluye input |
| publica | button | Guardar página (`btn btn-primary btn-sm`) | 30 | 30.5 | 31 | **NO** | no · los datos de muestra no la pintan |
| publica | select ×3 | QR: Formato, Tamaño, Color | 44 | 44.7–44.9 | 44.6–44.8 | sí | no · el selector no incluye select |
| publica | a | ⬇ Descargar QR (`btn-sm`) | 30 | 30.9 | 30.6 | **NO** | no · los datos de muestra no la pintan |
| marca | button | ⬆ Subir logo | 30 | 30.5 | 30.6 | **NO** | no · pestaña oculta al montar |
| marca | input[color] | color de marca (`style="height:38px"` en línea) | 38 | 38.7 | 39 | **NO** | no · el selector no incluye input |
| marca | button | Sin color (por defecto) | 30 | 30.7 | 31 | **NO** | no · pestaña oculta al montar |
| datos | button | Descargar datos | 44 | 44.8 | 45 | sí | no · pestaña oculta al montar |
| cumplimiento | — | **ningún control**: sólo la pastilla del modo y su párrafo (`settingsView.js:207-228`) | — | — | — | — | (mirado con `appModoEmision='fiscal'`: **no hay nada**, no «no pude mirar») |
| equipo | input[checkbox] | Enseñar la foto del técnico al cliente | 16 | 17 | 17 | **NO** | no · pestaña oculta al montar |
| equipo | input[number] | umbral de aprobación | 44.5 | 45 | 45 | sí | no · el selector no incluye input |

**Configuración: 53 controles · 16 cortos · el censo veía 1 de los 16** (`Copiar link`).

**Sobre los «36 px» que se apuntaron el 19-oct:** medido hoy son **38,0 de caja / 38,9 de toque**, y **sólo los dos de Facturación**. Los otros siete `select` de Configuración (cuatro de Empresa, tres del QR) llegan a 44. Mismo `class="input"` y distinta altura: la diferencia la pone el envoltorio, no la clase (no he medido qué regla). Los 36 del 19-oct se midieron en yaqu.app con otra rama servida; no los he vuelto a medir allí (producción congelada).

### ③ La cifra, en todo el panel

Mismo banco, mismas 28 superficies, mismo árbitro; población ampliada a `select`, `textarea`, `input` no ocultos y `role=tab/switch/radio/menuitem`, y Configuración con sus nueve pestañas abiertas. **Control positivo:** con la población del censo, este medidor da **exactamente los 72** del censo. Dos sondas por superficie, estado y anchura (el botón de 12 px del censo y un `<select>` de 20 px): **0 fallidas en 74 estados**.

| criterio | el censo dice | hay de verdad | se le escapan |
|---|---|---|---|
| **A · < 44 px a cualquiera de las dos anchuras** (la vara del censo) | **72** | **114** (111 del banco + 3 de «Tu página pública» con datos completos) | **42** — 39 + 3 |
| **B · DESIGN.md §5 tal cual:** 44 en móvil, 36 en escritorio, `btn-sm` exento | 8 de sus 72 | **45** (44 + el enlace de la página pública) | **37** |

Las dos cifras dicen cosas distintas, y las dos hacen falta:
- **El censo se queda corto de población:** de los 39 que se le escapan en el banco, **31 por el selector** (29 son campos: 11 `select`, 8 de texto, 6 de fecha, 2 de número, 1 búsqueda, 1 color; más 2 `radio` de 17 px en Productos) y **8 por estar en una pestaña oculta** (todos de Configuración).
- **Y se pasa en su propia población:** **51 de sus 72 sólo son cortos a 929**, donde la regla escrita pide 36; y **33 de sus 72 son `btn-sm`**, la excepción deliberada de DESIGN.md §5. Contra la regla tal cual, de sus 72 quedan **8**.

Fuera del censo y cortos, por pantalla (banco, criterio A):

| pantalla | control | rótulo | toque @390 | toque @929 | por qué no estaba |
|---|---|---|---|---|---|
| Albaranes | input[search] | Buscar albaranes | 37 | 37 | el selector no lo incluye |
| Albaranes | select | Facturación | 39 | 39 | el selector no lo incluye |
| Customer360 | input[text] | administrador | 36.9 | 36.9 | el selector no lo incluye |
| Customers | input[text] | Buscar por nombre, teléfono, email o ref | 37 | 37 | el selector no lo incluye |
| Customers | select ×2 | Todos / Empresas / Personas | 39 | 39 | el selector no lo incluye |
| Export | input[date] ×2 | Desde · Hasta | 38.8 | 38.9 | el selector no lo incluye |
| Export | input[number] | Año | 36.7 | 37 | el selector no lo incluye |
| Export | select | Trimestre | 38.7 | 39 | el selector no lo incluye |
| FacturasRecibidas | input[number] | Año | 36.6 | 36.6 | el selector no lo incluye |
| FacturasRecibidas | select | Trimestre | 38.6 | 38.6 | el selector no lo incluye |
| InvoiceDetail | input[text] | (sin rótulo) | 36.9 | 36.9 | el selector no lo incluye |
| Invoices | input[text] | Buscar por nº, cliente… | 37 | 37 | el selector no lo incluye |
| Invoices | select | (sin rótulo) | 39 | 39 | el selector no lo incluye |
| Invoices | input[date] ×2 | (sin rótulo) | 39 | 39 | el selector no lo incluye |
| Products | input[text] | Buscar producto… | 37 | 37 | el selector no lo incluye |
| Products | input[radio] ×2 | Producto · Servicio | 17 | 17 | el selector no lo incluye |
| QuoteDetail | input[text] | (sin rótulo) | 36.8 | 36.9 | el selector no lo incluye |
| QuoteRequests | select | (filtro de solicitudes) | 33.5 | 34 | el selector no lo incluye |
| QuotesList | input[text] | Buscar por cliente, ID o teléfono… | 37 | 37 | el selector no lo incluye |
| QuotesList | select | (sin rótulo) | 39 | 39 | el selector no lo incluye |
| QuotesList | input[date] ×2 | (sin rótulo) | 39 | 39 | el selector no lo incluye |
| Reports | select | (sin rótulo) | 34 | 34 | el selector no lo incluye |
| Settings | 12 | los de la tabla ② (sin los 3 de la página pública) | | | 4 por selector, 8 por pestaña oculta |

⚠️ **Las casillas y los `radio` de 17 px** pueden tener el área en su ETIQUETA (el patrón de `.quote-line__suplido` y de 1559g/1265). El árbitro mide el `<input>`, como ya hace el censo con las casillas: si una etiqueta las cubre, ese corto es del instrumento y no de la pantalla. No lo he separado.

### Lo que sigue SIN mirar (no es cero)

- **112 controles del selector ampliado no pintados al montar** en 8 superficies (@390): Presupuestos 55, Documento suelto 22, Configuración 20 (ésos sí, abiertos arriba), Clientes 5, Facturas 5, Trabajo 3, Productos 1, Lista de presupuestos 1. Son pasos del editor, menús «⋯» y estados que no he abierto.
- **`renderPartesOficinaView`**: 12 nodos con los datos de muestra; ni el censo ni yo la medimos.
- **Lo que no es una `render*View`**: modales y diálogos que se montan aparte, `onboardingView.js`, login/registro. Fuera de la población del banco, del censo y de esta medida.
- **Ramas que dependen de datos:** el comercio de muestra es `{id, name}`. Sólo he completado Configuración (y ahí aparecieron 4 botones de la lista de «qué te falta» y la pestaña pública entera); el resto de pantallas sigue con el contrato mínimo.

### Para repartir (no se ha tocado nada)

- **Configuración (J3):** ~~los 16~~ → **separados en el tramo 962b (2), más abajo: 4 defectos seguros + 1 discutible.** Las 4 casillas y el campo de sólo lectura son artefactos del medidor; los 6 `btn-sm` están exentos por DESIGN.md §5.
- **El censo (S3, `scripts/` es su carril):** tres decisiones que no son mías: ① ampliar `INTERACTIVOS` (o un selector propio del censo) a campos de formulario, con DESIGN.md §5 delante — hoy las «Inputs / Fields» no tienen altura escrita, sólo el «targets ≥44px» de §6; ② abrir los estados ocultos o, como mínimo, contar `sinPintar` como «no medido»; ③ medir 929 contra `minimoPara()` y separar `btn-sm` (la cifra de 72 mezcla tres cosas).

### Cómo se reproduce

Los guiones están en `docs/master/evidencias/scrum962b/` (sólo leen; reciben la raíz del repo y el fichero de salida por argumento):

    node docs/master/evidencias/scrum962b/censo-ampliado.mjs <raiz> <tmp>/ampliado.json      # banco serializado, 28 superficies + 9 pestañas
    node docs/master/evidencias/scrum962b/lentes.mjs <tmp>/ampliado.json                      # criterios A y B
    node docs/master/evidencias/scrum962b/fuera.mjs <tmp>/ampliado.json                       # la lista de los que se escapan
    node docs/master/evidencias/scrum962b/configuracion-viva.mjs <raiz> <tmp>/viva.json       # Configuración viva, pulsando pestañas
    node docs/master/evidencias/scrum962b/tabla-viva.mjs <tmp>/viva.json <tmp>/viva-datos-del-censo.json

(`configuracion-viva.mjs` lleva el comercio completo; para la columna «¿en la población del censo?» hace falta una segunda pasada con el comercio `{id, name}` del censo, que es el segundo argumento de `tabla-viva.mjs`.)

### Tramo 962b (2) · los 16 de Configuración, separados: pantalla, regla o instrumento

**Pedido por el orquestador** tras la entrega: «de los 16, cuáles son defecto de pantalla y cuáles artefacto del medidor», ordenados por gravedad real. Mismo árbol (`9839aa6c`); `origin/main` avanzó 12 commits mientras tanto y **ninguno toca** `settingsView.js`, `styles.css`, `_medidor-de-toque.mjs` ni `_banco-lista.mjs` (`git diff --stat`, vacío).

**Cómo:** Configuración viva (`_banco-lista.mjs`), pestaña a pestaña, a 390 y 929. Para cada control corto, sus etiquetas asociadas (`el.labels`), el área de toque de cada etiqueta con el mismo árbitro, y un **clic de ratón REAL** en el punto de la etiqueta más alejado del control que siga perteneciéndole: ¿cambia el estado? (`docs/master/evidencias/scrum962b/dieciseis.mjs`). Salen los mismos 16 a las dos anchuras.

A9: sin fallo que generalice — mi medidor tuvo dos defectos (el ancho del elemento pisaba el de la ventana; las marcas `data-etiq` no se limpiaban entre pestañas y Avisos leía la etiqueta de Facturación); los cazó el control (16 esperados, 0 medidos; «sin punto» en 3 de 4 casillas iguales) antes de dar ninguna cifra.

**Los 16, por gravedad:**

| # | pestaña | control | toque @390 | veredicto | por qué |
|---|---|---|---|---|---|
| 1 | facturacion | **«Añadir condición»** (`<button>` nativo, sin clase, `font-size:13px`, `settingsView.js:1115`) | **22** | 🔴 **DEFECTO de pantalla** | Botón suelto, sin etiqueta, sin estilo de la casa. **Es el MISMO elemento que el defecto 3 del comentario 20052** («sale sin estilo de botón»): un solo arreglo cierra los dos |
| 2 | publica | enlace `yaqu.app/p/… ↗` | **18** | 🟠 **DEFECTO discutible** | Está EN LÍNEA dentro de una frase («Tu página está **activa**: …», `settingsView.js:1534`). WCAG 2.5.8 exime los enlaces en línea; DESIGN.md §6 dice «targets ≥44px» sin esa excepción. Lo decide quien firma la regla, no la medida |
| 3 | marca | selector de color (`input[type=color]`, `style="height:38px"` en línea, `settingsView.js:809`) | **38,7** | 🔴 **DEFECTO de pantalla** | Sin etiqueta asociada; la altura está escrita a mano en el propio control |
| 4 | facturacion | `select` **Retención de IRPF** | **38,9** | 🔴 **DEFECTO de pantalla** | Su etiqueta (`for=`, 21 px, ENCIMA) enfoca el `select` al pulsarla, pero no lo continúa: es otro objetivo, no el mismo más grande. Y los otros 7 `select` de la misma pantalla dan 44 |
| 5 | facturacion | `select` **¿Qué tipo de actividad tienes?** | **38,9** | 🔴 **DEFECTO de pantalla** | Igual que el 4 (y es bloque de S2 en contenedor de J3: `settingsView.js:458-486`) |
| 6 | publica | «Guardar página» (`btn btn-primary btn-sm`) | 30,5 | ⚪ **EXENTO por la regla escrita** · ⚠️ con duda | `btn-sm` está exento en DESIGN.md §5. Pero la exención vale **porque una acción primaria nunca usa la variante pequeña** (SCRUM-412), y éste es un `btn-primary btn-sm` que guarda la tarjeta: **posible choque con esa frontera**. Decisión, no medida |
| 7 | (fuera de paneles) | «Copiar link» (`btn btn-primary btn-sm`) | 30,7 | ⚪ **EXENTO** · ⚠️ con duda | Mismo caso que el 6 (tarjeta «Invita y gana») |
| 8 | avisos | «Vista previa» (`btn-ghost btn-sm`) | 30,8 | ⚪ **EXENTO por la regla escrita** | `btn-sm` secundario |
| 9 | publica | «⬇ Descargar QR» (`btn btn-secondary btn-sm`) | 30,9 | ⚪ **EXENTO** | ídem |
| 10 | marca | «⬆ Subir logo» (`btn btn-secondary btn-sm`) | 30,5 | ⚪ **EXENTO** | ídem |
| 11 | marca | «Sin color (por defecto)» (`btn-secondary btn-sm`) | 30,7 | ⚪ **EXENTO** | ídem |
| 12 | avisos | casilla «Recibir email cuando un cliente paga» | 17 | 🔵 **ARTEFACTO del medidor** | La ENVUELVE su `<label>` de **62,4 px** de toque, y un clic real en la etiqueta, lejos de la casilla, la **marca**. El dedo tiene 62 px; el medidor mide sólo el `<input>` |
| 13 | avisos | casilla «… acepta un presupuesto» | 17 | 🔵 **ARTEFACTO** | etiqueta envolvente 83,5 px · clic real ACTIVA |
| 14 | avisos | casilla «Recibir resumen semanal» | 17 | 🔵 **ARTEFACTO** | etiqueta envolvente 82,5 px · clic real ACTIVA |
| 15 | equipo | casilla «Enseñar la foto del técnico» | 17 | 🔵 **ARTEFACTO** | etiqueta envolvente 62,4 px · clic real ACTIVA |
| 16 | (fuera de paneles) | `#ref-link` (campo `readonly` que muestra el enlace de «Invita y gana») | 41,8 | 🔵 **ARTEFACTO de MI selector** (dudoso) | No es un control: es un campo de sólo lectura; la acción es «Copiar link» (el 7). Lo metió mi selector ampliado (`input` no oculto). Le faltan 2,2 px, por si alguien lo quiere contar |

**Resumen de los 16:** 🔴 **4 defectos de pantalla** (1, 3, 4, 5) · 🟠 **1 discutible** (2) · ⚪ **6 exentos por DESIGN.md §5**, dos de ellos (6, 7) con duda sobre la frontera de SCRUM-412 · 🔵 **5 artefactos del medidor** (4 casillas + el campo de sólo lectura).
⇒ **A J3 van 4 seguros + 1 a decidir**, no 16. Los 6 `btn-sm` no son defecto según la regla escrita: si se quiere cambiar la regla, es otra conversación. Los defectos 2 y 3 del comentario 20052 siguen aparte: el 3 es el mismo elemento que el nº 1 de esta tabla, y el 2 (colocación del rótulo de IRPF) no se mide en píxeles de toque.

**Y esto alcanza a las cifras de ③ y al censo.** El árbitro mide el `<input>`, nunca `input ∪ su etiqueta`. Así que **toda casilla o `radio` con etiqueta envolvente sale corta aunque no lo sea**: aquí, 4 de 4. En el panel hay más del mismo tipo, y **no las he comprobado una a una**: los 2 `radio` de Productos (17 px) de mi lista, y en la población del propio censo `INPUT.inv-row-check` y un `INPUT` de 14 px. Son candidatas a artefacto, **sin medir**.

**El hallazgo de método, escrito como regla:** **un control positivo que usa un caso de DENTRO de la población no prueba la población.** La sonda del censo es un `<button>`, y un botón siempre está en el selector: prueba que la superficie se mide, nunca que la población esté completa. Para probar la población, la sonda tiene que ser de una clase que el selector podría dejar fuera (aquí, un `<select>`).

**Banco:** `dist/` compilado con `tsc` en el worktree (sale 1 error de tipos en `src/modules/system/merchantAdmin.ts:147` por el cliente de Prisma compartido desfasado — `activityKind`; no afecta al front y `dist/` se emite igual). **No se ha corrido `prisma generate`** ni la suite.

---

## Tramo 962c (S2, 22-oct-2026) · El editor de presupuestos: lo que no se pinta al montar

**SÓLO LECTURA. No se ha arreglado nada.** Encargo del orquestador: de los 112 controles que no se pintan al arrancar la pantalla (tramo 962b), los 55 del editor de presupuestos, porque es donde el profesional pasa el día. Mismo método que 962b (2): **primero se separa el artefacto del defecto con un clic real, y después se dan cifras.**
**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún CSS; sólo se mide.
**Medido contra:** `origin/main` = `0077bd1d51a7cb64b1c18d85781117b71936fd38`, fusionado en la rama (`c7c1c736c`) y **servido en local**. Hora de GitHub: 2026-10-22 10:14 GMT. `origin/main` avanzó después 2 commits (`808af5b44`) y **ninguno toca `public/`, `_medidor-de-toque.mjs` ni `_banco-lista.mjs`**. **Producción sigue congelada en `fe65a8b7`: nada de esto se ha visto en yaqu.app.**
**Rama:** `scrum-962c-editor-presupuestos-44`, apilada sobre `scrum-962b-poblacion-del-censo-44` (PR #2668, abierto), porque escribe en el mismo registro.

A9: sin fallo que generalice — dos defectos de mi recorrido, cazados antes de dar cifras: una segunda línea vacía desordenó el «Continuar» (el paso 3 se midió en el 2; lo delató el listado), y la prueba del radio daba «no activa» cuando el radio ya estaba marcado (ahora mira que quede marcado tras el clic).

### Cómo se recorre

Con la vista **viva** (`scripts/_banco-lista.mjs`) y **como el profesional**: cada estado se alcanza pulsando lo que la pantalla ofrece, con clics de ratón reales. Los pasos del editor no se pueden abrir «a mano» sin falsear el estado (`abrirPaso`, `quotesView.js:5362`, no salta hacia delante un paso incompleto). **28 estados a cada anchura (390 y 929), todos alcanzados:**
1. **Cliente:** el arranque; el menú «⋯» de la página; el alta de cliente; «Ver documento»; con cliente elegido.
2. **Conceptos:** con una línea escrita; el menú «⋯» de la línea; los ajustes de la línea (IVA, coste, descripción, descuento); «📋 Ver las 5» (modal de plantillas); «✨ Sugerir con IA»; el descuento global. Con plantillas guardadas y conceptos frecuentes, salen sus accesos rápidos.
3. **Condiciones:** las 4 filas abiertas una a una (cobro, formas de pago, validez, ajustes del documento) y la dirección de obra personalizada.
4. **Revisar**, y su menú «⋯».

**Datos:** un cliente con **descuento pactado** (`dtoPorDefecto: 10`) y **forma de pago pactada** (`payMethodsPorDefecto: ['bizum']`), para que salgan las dos propuestas («Aplicar a las líneas», «Aplicar»). **Las dos salieron.**

**Medida:** todo el documento menos la barra lateral, porque el menú «⋯» se cuelga de `document.body` (`api.js:1307-1321`). Mismo árbitro que el censo (`__areaDeToque`), con el selector ampliado de 962b.

**Prueba de la etiqueta:** a cada corto con etiqueta asociada se le mide el área de la etiqueta y se le da un **clic real en el punto de la etiqueta más alejado del control**. ¿Lo activa (marca la casilla o el radio, o enfoca el campo)?
- Si la etiqueta mide ≥44 y lo activa, el dedo tiene la etiqueta: **artefacto del medidor**.
- En un `<select>`, enfocarlo no prueba que el desplegable se abra: **dudoso**.

### Las cifras

**109 controles distintos** en los 28 estados. Lo que el censo mide (los del arranque y dentro de su selector) son 68. **33 bajan de 44 a alguna anchura:**

| veredicto | cuántos | qué son |
|---|---|---|
| ✅ **cumplen DESIGN.md §5** (≥44 a 390 y ≥36 a 929) | **21** | `Atrás` / `Ver documento` / `Continuar` / `Generar presupuesto` y los botones de los modales: 44,5–45 a 390, 36,5–37 a 929. Los ítems de los menús «⋯»: 51,7–52,2 a 390, 42–42,7 a 929 |
| 🔵 **artefacto del medidor** | **3** | los radios **Empresa / Persona** del alta de cliente (17 px; etiqueta envolvente de 44,7/44,8 que los marca) y **Descuento global** (21,6 px; etiqueta envolvente de 44,6 que lo enfoca) |
| 🟠 **dudoso** → 🔴 **DEFECTO** (resuelto en 962d) | **1** | el `select` **IVA %** de los ajustes de la línea: 21,8 px; su etiqueta envolvente de 44,6 lo enfoca, pero **NO abre el desplegable** (toque real medido en 962d). Son **7** defectos, no 6 |
| 🔴 **defecto** | **8 filas = 6 controles** | abajo. Los tres «Cerrar» son la misma pieza |

**Los defectos, por gravedad real.** La gravedad la da el objetivo EFECTIVO: el control o, si su etiqueta lo activa, la etiqueta.

| # | control | objetivo efectivo @390 | dónde | carril | por qué es defecto |
|---|---|---|---|---|---|
| 1 | radio **«Razón social»** | **20,4** (radio 17; etiqueta envolvente 20,4 que sí lo marca) | Condiciones › Ajustes del documento | **S2** · `quotesView.js` (~:1500) | la etiqueta lo activa pero es tan baja como el radio |
| 2 | radio **«Nombre comercial»** | **20,4** | ídem | **S2** · ídem | ídem |
| 3 | casilla **«Incluir descripción en el PDF»** | **21,1** (casilla 17; etiqueta 21,1) | ídem | **S2** · `quotesView.js:960` | ídem |
| 4 | **«?» (Guía de inicio)** de la cabecera de los modales | **26,6–26,9** | **los 5 modales del editor**: alta de cliente, Ver documento, ajustes de línea, plantillas, IA | **S2** · `modalHeader.js` (`cabeceraModal`, `.modal-ayuda`) | botón suelto, sin etiqueta |
| 5 | **«×» (Cerrar)** de la misma cabecera | **30,6–31,0** | los mismos 5 modales | **S2** · `modalHeader.js` (`.modal-close`) | ídem |
| 6 | casilla **«Baja de WhatsApp»** del alta de cliente | **41,3** (casilla 14; etiqueta envolvente 41,3 que sí la marca) | alta de cliente (modal) | **J2** · `customersView.js:1532` | le faltan 2,7 px a la etiqueta: el menos grave |

⚠️ **Mi deduplicación entre estados fusiona los «?» y los «×» que no llevan `id`** (alta, Ver documento, ajustes de línea). Por eso salen 3 filas de «Cerrar» y 1 de «?» en la tabla del guion. Medidos estado a estado, son **5 «?» (26,6–26,9) y 5 «×» (30,6–31,0)**: 10 apariciones de **una sola pieza**, `cabeceraModal`. Y esa pieza se usa en más modales del panel que no he medido.

**Lo que esto dice del censo, en esta pantalla:**
- De los 6 defectos reales del editor, el censo **no ve ninguno**: 5 están ocultos al arrancar y los dos radios ni siquiera entran en su selector.
- De lo que sí ve al arrancar, marcaría como cortos **2** botones (`Ver documento` y `Continuar`, 37 px a 929) que **cumplen** la regla de escritorio.

**Lo que es de S2 y lo que no:** 5 de los 6 defectos son de **S2** (`quotesView.js` y `modalHeader.js`); uno es de **J2** (`customersView.js`). El CSS de todos vive en `styles.css`, que es contenedor de S2. **Nada de `src/`.**

**Los «55» del encargo:** salen del banco serializado (tramo 962b, selector ampliado, 390). La misma pantalla, viva y con sus datos, tiene **52** controles ocultos al arrancar (`editor-inventario.mjs`). No he perseguido la diferencia de 3: banco y vista viva montan con datos distintos.

### Sin mirar (no es cero)

- **«Elegir un sitio guardado»:** sin sitios guardados en el dato, el botón no abre nada.
- **Las cláusulas del presupuesto** (`clausulasWrap`), que sólo salen con cláusulas guardadas en el comercio.
- **Lo que hay después de «Generar presupuesto»**: no lo he pulsado, porque es un POST.
- **Un borrador abierto para editar**, y el alta rápida desde la opción del `<select>` de clientes.
- **El documento suelto** (`renderDocumentoSueltoView`, 22 ocultos en 962b): comparte este código con `esDocumentoSuelto`, pero no lo he recorrido.
- **Las candidatas de 962b (2):** los 2 radios de Productos, `INPUT.inv-row-check` y un `INPUT` de 14 px. No caían de camino y **no están medidas**. Pista fuerte, sin medir: los radios de Productos salen de `switchTipoArticulo.js` con la misma clase `segmented-input` que los de `switchFormaJuridica.js`, y éstos han salido **artefacto** aquí (Empresa/Persona, etiqueta 44,7).

### Cómo se reproduce

    node docs/master/evidencias/scrum962c/editor-inventario.mjs <raiz> 390                  # qué está oculto al montar y quién lo oculta
    node docs/master/evidencias/scrum962c/editor-recorrido.mjs <raiz> <tmp>/editor.json [--listar]
    node docs/master/evidencias/scrum962c/editor-analisis.mjs <tmp>/editor.json [--md]

---

## Tramo 962d (S2, 22-oct-2026) · ARREGLO: el «?» y el «×» de la cabecera de los modales, a 44 px de toque

**Autorizado por el orquestador** tras 962c («① `modalHeader.js`: el «?» y el «×». Un componente, el de más alcance»).
**Skill UI:** cargada (`yaqu-premium-ui`). DESIGN.md §5 manda: 44 en móvil y 36 en escritorio. Aquí se dan 44 a todas las anchuras porque el área no se ve. **Una pieza, no un rediseño:** no cambia ningún token, color ni medida visible.
**Microcopy:** ninguna. No se ha tocado ningún literal.
**Medido contra:** rama `scrum-962d-cabecera-modal-44`, apilada sobre 962c, con `origin/main` = `fa9cb22e8` fusionado (`b87380cb1`; ese merge no trae nada en `public/`). **Servido en local.** Hora de GitHub: 2026-10-22 10:28 GMT. **Producción sigue congelada en `fe65a8b7`: no se ha visto en yaqu.app.**

A9: sin fallo que generalice — tres defectos de mis medidores, cazados por su control antes de dar cifras: medía el modal a mitad de su animación de entrada (el centro «no era suyo»); la sonda, colgada detrás del «×», la tapaba el área nueva; y el menú «⋯» de escritorio se cerraba con mi `scrollIntoView` (se cierra al desplazar). Los tres se dicen en sus guiones.

### Primero, el DUDOSO de 962c: es DEFECTO

El `select` «IVA %» de los ajustes de la línea (21,8 px), con móvil emulado (390, táctil) y el árbitro `select.matches(':open')` (`docs/master/evidencias/scrum962d/select-iva-abre.mjs`):
- **Control positivo:** un toque directo en el `select` lo abre (`:open` = true).
- **Toque en la etiqueta:** la enfoca (`activeElement` = el `select`), pero **NO la abre** (`:open` = false).

⇒ El dedo no tiene la etiqueta: **son 7 defectos en el editor, no 6.** El séptimo es de S2 (`quotesView.js`, modal de ajustes de línea, ~:3915) y va en el lote ②.

### El arreglo

**Sólo `public/dashboard/css/styles.css`** (contenedor de S2; bloque marcado `S2:`). **`modalHeader.js` no se toca:** la pieza ya pinta el «?» y el «×» como hijos directos de `.modal-header`, que es lo que la regla nombra.
- `.modal-header > .modal-ayuda` y `.modal-header > .modal-close` pasan a `position: relative`.
- Cada uno lleva un `::before` de **44×44**, absoluto y centrado en vertical.
- El del «×» se ancla a **su izquierda**, así que crece hacia la derecha, sobre los 24 px de margen interior de la cabecera.
- El del «?» se ancla a **su derecha**, así que crece hacia la izquierda, sobre el hueco del título.
- **Ninguno crece hacia el otro.**
- **Acotado a `.modal-header >`:** `api.js:902` reutiliza `.modal-close` a 24 px en la tostada de error, y ahí un área que se sale taparía la página.

**Alcance real:** `cabeceraModal` se llama en **28 sitios de 17 ficheros**. Son **28 «?» y 25 «×»**: tres cabeceras van sin cierre (`customerDetailView.js:877`, `:1063`; `quotesView.js:152`).

### ANTES y DESPUÉS, medido con el mismo guion

**① Banco de la pieza real** (`cabecera-banco.mjs`: `modalHeader.js` y `styles.css` reales; 4 variantes × 320/390/929; sonda de 12 px cazada en las tres anchuras, antes y después):

| | antes | después |
|---|---|---|
| alto de la cabecera (corto / medio / largo @320·@390·@929 / sin cierre) | 50 / 50 / 119,2·94,4·69,6 / 46 | **50 / 50 / 119,2·94,4·69,6 / 46** (idéntico) |
| alto del título | 24,8 (largo: 99,2 · 74,4 · 49,6) | **idéntico** |
| caja visible «?» / «×» | 28,1×26 / 30×30 | **idéntica** |
| **área de toque «?»** (ancho×alto) | 27,5×26 (28,5 a 929) | **43,5×44** (44,5 sin cierre; el ,5 de menos es el paso de 0,5 px del medidor) |
| **área de toque «×»** | 30×30 | **44×44** |
| el punto entre los dos es de… | el «×» | el «×» (sin cambio) |
| el borde de arriba del primer campo del cuerpo, ¿sigue siendo suyo? | sí | **sí** |

**Capturas de la cabecera, píxel a píxel** (`comparar-png.mjs`):
- **A 320 y 390, las 8 son IDÉNTICAS** (0 píxeles distintos).
- A 929 la captura **no es determinista ni con el mismo CSS**: dos ANTES seguidos difieren hasta 191/255 en un caso, por el desenfoque del fondo del modal. ANTES/DESPUÉS difiere como mucho en **2/255** de canal, por debajo del ruido. **No se ve distinto.**

**② Los 5 modales VIVOS del editor** (`cabecera-viva.mjs`, abiertos con clics reales, 390 y 929; 10 de 10 abiertos):

| modal | cabecera antes → después | «?» área antes → después | «×» área antes → después |
|---|---|---|---|
| alta de cliente · Ver documento · ajustes de línea · plantillas · IA (los 5, a 390) | 50 → **50** | 27,5×26 → **43,5×44** | 30×30 → **44×44** |
| los mismos 5, a 929 | 50 → **50** | 28,5×26 → **43,5×44** | 29,5–30×30 → **44×44** |

### El test

`tests/scrum962d-cabecera-modal-44.test.mjs` (sin gate, corre en cada PR) vigila cuatro cosas:
- ① que exista el `::before` de 44×44, absoluto, con su padre relativo;
- ② que cada uno crezca hacia fuera de la pareja;
- ③ que esté acotado a `.modal-header >`;
- ④ que la pieza siga pintando los dos botones como hijos directos (banco de vistas).

**Probado en rojo con 6 mutaciones, y mueren las 6** (`mutar-962d.mjs`; restaura desde HEAD y se niega con cambios sin comitar):
- la BASE, que es el CSS de antes del arreglo;
- sin `position: relative`;
- el `::before` a 40 px;
- el «×» creciendo hacia el «?»;
- el `::before` sin acotar;
- la pieza envolviendo el «?» en un `div`.

**Tests relacionados:** los **85 ficheros** que leen `styles.css` o tocan la cabecera de los modales, corridos a la vez: **775 pass · 0 fail · 0 skipped**. No se ha corrido la suite completa (sin turno, y 1,7–3,4 GB libres frente al umbral de 2.200 MB).

**Trinquete:** ninguno que mover. Ni `censo:tactil-panel` ni `guard:objetivo-tactil` miran modales (es justo lo que encontró 962b).

**Pendiente:** verlo en yaqu.app cuando producción se descongele, a 390 y 1280, en un modal cualquiera: el «×» y el «?» tienen que responder hasta 7 px por encima y por debajo de su dibujo.

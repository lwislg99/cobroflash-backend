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

- **Configuración (J3):** los 2 `select` de Facturación (38,9), «Añadir condición» (22), las 4 casillas de Avisos/Equipo (17), «Vista previa», «Subir logo», «Sin color», el color de marca (38,7), «ref-link» (41,8), «Copiar link», «Guardar página» y «Descargar QR» (30–31), y el enlace a la página pública (18). Junto a los dos defectos de colocación/estilo ya anotados en el comentario 20052.
- **El censo (S3, `scripts/` es su carril):** tres decisiones que no son mías: ① ampliar `INTERACTIVOS` (o un selector propio del censo) a campos de formulario, con DESIGN.md §5 delante — hoy las «Inputs / Fields» no tienen altura escrita, sólo el «targets ≥44px» de §6; ② abrir los estados ocultos o, como mínimo, contar `sinPintar` como «no medido»; ③ medir 929 contra `minimoPara()` y separar `btn-sm` (la cifra de 72 mezcla tres cosas).

### Cómo se reproduce

Los guiones están en `docs/master/evidencias/scrum962b/` (sólo leen; reciben la raíz del repo y el fichero de salida por argumento):

    node docs/master/evidencias/scrum962b/censo-ampliado.mjs <raiz> <tmp>/ampliado.json      # banco serializado, 28 superficies + 9 pestañas
    node docs/master/evidencias/scrum962b/lentes.mjs <tmp>/ampliado.json                      # criterios A y B
    node docs/master/evidencias/scrum962b/fuera.mjs <tmp>/ampliado.json                       # la lista de los que se escapan
    node docs/master/evidencias/scrum962b/configuracion-viva.mjs <raiz> <tmp>/viva.json       # Configuración viva, pulsando pestañas
    node docs/master/evidencias/scrum962b/tabla-viva.mjs <tmp>/viva.json <tmp>/viva-datos-del-censo.json

(`configuracion-viva.mjs` lleva el comercio completo; para la columna «¿en la población del censo?» hace falta una segunda pasada con el comercio `{id, name}` del censo, que es el segundo argumento de `tabla-viva.mjs`.)

**Banco:** `dist/` compilado con `tsc` en el worktree (sale 1 error de tipos en `src/modules/system/merchantAdmin.ts:147` por el cliente de Prisma compartido desfasado — `activityKind`; no afecta al front y `dist/` se emite igual). **No se ha corrido `prisma generate`** ni la suite.

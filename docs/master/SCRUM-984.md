# SCRUM-984 · Del presupuesto aceptado al albarán con UN botón (y la tabla dice lo mismo que la pantalla)

**Medido contra:** `origin/main` = `b980a38201357492e8a30b97076f5b49bb17154d` · 2026-09-21T12:34:02Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`). El Paso 0 y el diseño se midieron antes, sobre `092ccb5a4742ba8c7cc4b1c47b7c62303d713f76` (12:05Z–12:30Z); `main` avanzó 16 commits sin tocar ninguno de los ficheros de este PR (comprobado con `git diff` de mis siete ficheros contra la punta pre-merge: vacío).
**Rama:** `scrum-984-presupuesto-aceptado-al-albaran`
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-984-del-presupuesto-al-albaran.md` (firma delegada, SCRUM-984 comentario 16105).

## Paso 0: el defecto existía hoy

Sobre `092ccb5a`: la ficha del presupuesto aceptado (`quotesDetailView.js`, «Siguiente paso») ofrecía «Cobrar ahora» / «Ver justificante» / «Ver cobro pendiente» y **ningún camino al albarán**; y `GET /admin/quotes/:id` **no devolvía ningún dato de Trabajo** (`getQuoteDetailAdmin` es una proyección explícita, `quoteAdmin.ts:218-309`). El registro (`quoteActionsRegistry.js`) declaraba `btnCrearTrabajo` como primaria de `accepted` mientras la pantalla nunca lo pintó, y el Trabajo ya nace al aceptar (`ensureJobForQuote`, desde el 5-jul-2026).

## Dos mediciones que corrigen el enunciado (gana la medición, y se dice)

1. **NO se usa `Quote.jobId`, aunque el ticket lo proponía.** ALB-01 ya decidió (`presupuestosParaAlbaran.ts`) que un presupuesto es elegible ⇔ hay un Trabajo con `Job.quoteId` = él: un ADICIONAL (SCRUM-195) cuelga del Trabajo del original por `Quote.jobId`, pero `quoteLineIndex` significa «índice en las líneas de `Job.quoteId`» y en ningún otro sitio; ofrecerle el albarán prellenaría un enlace roto (el que SCRUM-367/684 declararon peor que ninguno). El detalle contesta con **la misma función que el buscador** (`filasParaElegirPresupuesto`) y la misma tenencia del técnico (`esSuyoElTrabajo`, SCRUM-849).
2. **«Sin Trabajo: el texto aprobado» no se puede cumplir: no existe.** Los dos motivos del buscador (`sin_trabajo`, `trabajo_no_visible`) siguen con `[PENDIENTE microcopy oficial]`, y `sin_presupuesto` dice lo contrario. Sin texto firmado que lo explique, el botón **no se pinta** (canon de SCRUM-823). Si se firma un literal, la pantalla pasa a deshabilitar-y-decir.

## Lo que cambia

| fichero | qué |
|---|---|
| `src/modules/jobs/domain/albaranOrigenDelPresupuesto.ts` (nuevo) | `albaranOrigenDelPresupuesto({merchantId, quoteId, number, userRole, teamMemberId})` → `{elegible, jobId, motivo}`. Solo LEE (`job.findMany` filtrado por merchant y presupuesto). Cliente inyectable, como `ensureJobForQuote`. |
| `src/modules/system/app/routes/quotesAdmin.routes.ts` | `GET /admin/quotes/:id` añade el campo **aditivo** `albaranOrigen`. Sin esquema, sin ruta nueva. No toca el camino de emisión. |
| `public/dashboard/js/quotesDetailView.js` | En `accepted`, botón **secundario** «Nuevo albarán» (rótulo de `atajoNuevo.textoDe('albaranes')`, sin literal nuevo) solo si `albaranOrigen.elegible === true` y hay `jobId`. El clic llama `renderAppView('jobs-detail', { jobId, altaAlbaran: { quoteId } })`: **la misma llamada que `albaranesView.js:150`**; no crea nada, el alta sigue en `openAlbCrearSheet`. Los dos botones que esta pantalla pinta y la tabla declara (`btnCobrar`, `btnNuevoAlbaran`) llevan `data-accion` con el id de su fila, para que el guard compare por identidad y no por texto. |
| `public/dashboard/js/quoteActionsRegistry.js` | Opción R (firmada, 16105): sale `btnCrearTrabajo`; entran `btnCobrar` (primaria, «Cobrar ahora») y `btnNuevoAlbaran` (secundaria, «Nuevo albarán»); `btnWhatsApp` de `accepted` pasa a «⋮» (2 secundarias: PDF y albarán). Corregido el comentario «el único sitio donde nace el Trabajo». 12 − 1 + 2 = **13** filas. |
| `tests/scrum421-registro-presupuesto.test.mjs` | «los trece rótulos», con `btnCobrar` y `btnNuevoAlbaran` en vez de `btnCrearTrabajo`. Nada más se aflojó. |

## El juez: `tests/scrum984-del-presupuesto-al-albaran.test.mjs` (23 pruebas)

| grupo | qué exige |
|---|---|
| servidor (7) | admin con Trabajo de origen → elegible y a cuál; **el adicional no es elegible**; otro merchant no cuenta y el `where` lleva merchant y presupuesto; técnico dueño por los tres ejes / ajeno → `trabajo_no_visible` sin id / sin identidad no es dueño / rol desconocido no es admin; la ruta cablea la función y `albaranOrigen` viaja en el `cuerpo` (**por AST**); el dominio usa la función del buscador y no lee `Quote` |
| pantalla (9, banco de vistas) | con origen: UN botón secundario con el rótulo firmado; el clic navega con la llamada de ALB-01 y **no hace ninguna petición ni escritura**; sin origen no se pinta ni se dice nada (con el positivo «Cobrar ahora»); sin el campo (servidor viejo) no revienta; `jobId` nulo o respuesta contradictoria (`elegible:false` con `jobId`) fallan cerrados; solo en `accepted` (5 estados negativos + el positivo); con factura pendiente/pagada el albarán sigue |
| tabla = pantalla (2) | cada botón de `accepted` que declara su fila (`data-accion`) está en la tabla, en su destino, con su clase y su rótulo; la columna `accepted` de la tabla es exactamente la firmada |
| opción R (3) | `btnCrearTrabajo` ya no existe (tabla, rótulos, comentario caducado); la opción tal cual firmada; misma lista en tabla y rótulos (13) y la ley (1 primaria, 2 secundarias) se cumple |
| texto (2) | la pantalla no escribe «Nuevo albarán» (lo lee de `atajoNuevo`); el registro de microcopy lleva la línea de la firma delegada con su comentario |

**Suelos:** el doble de `job.findMany` respeta el `where` (comprobado antes de los negativos); la ficha monta > 60 nodos y pinta «Cobrar ahora» (si no, «el botón nuevo no se pinta» sería «no se pinta nada»); el bucle de cinco estados lleva su positivo.

## Verificado en rojo (BASE 32/32; punta `89edc939000275fc551dba26bbb1a713d6275ccf`)

Quince mutaciones sobre el árbol comiteado, cada una con el `git diff --numstat` a la vista (`1 1`), `npm run build` antes de cada mutante de `src/` **y otra vez tras restaurarlo**, y `git restore --source=HEAD` comprobado con `git status --porcelain`. **15/15 caen**, cada una en su test:

| mutación | cae |
|---|---|
| ruta: el `cuerpo` pierde `albaranOrigen` | cableado por AST |
| dominio: `where` sin merchant / sin presupuesto | multi-tenant (los dos) |
| dominio: el técnico ve todo / cualquier técnico es dueño | técnico |
| vista: ya no mira `elegible` / ya no mira `jobId` | contradicción / `jobId` nulo |
| vista: el albarán pasa a primaria | UN botón secundario · tabla = pantalla |
| vista: el clic pierde `altaAlbaran` | el toque navega |
| vista: rótulo escrito a mano | rótulo firmado |
| vista: «Cobrar ahora» sin `data-accion` | 5 (suelo incluido) |
| vista: el bloque también en `sent` | solo en `accepted` |
| registro: vuelve `btnCrearTrabajo` | 5 (tabla = pantalla, columna, inexistencia…) |
| registro: WhatsApp otra vez secundaria (3) | columna · opción R · ley |
| registro: rótulo «Cobrar ya» | 421 · tabla = pantalla · opción R |

**Error propio, con su corrección:** la primera pasada de mutaciones no reconstruía `dist` tras restaurar los mutantes de dominio, así que M5–M11 arrastraron el `dist` de M13 y cada uno mostraba un rojo AJENO («el técnico solo aterriza…»). Los veredictos no cambiaban (cada mutante tenía su propio test rojo) pero la medición estaba contaminada; se repitió entera con rebuild tras cada restauración y salen limpias (1 caído por mutante, salvo los que tocan varias aserciones).

## Divergencias previas tabla ↔ pantalla que este ticket NO resuelve (declaradas, no arregladas)

En `accepted` la tabla dice «Descargar PDF» (secundaria) y la pantalla pinta «📄 PDF» en la cabecera; la tabla pone `btnDuplicar` en «⋮» y la pantalla lo pinta en la cabecera; `btnWhatsApp` en «⋮» y la pantalla no lo ofrece en `accepted`. Cada una necesita una decisión de producto (rótulo o destino), no un arreglo de paso. El test las congela (`la columna accepted… es EXACTAMENTE la firmada`) para que crezcan a la vista.

## Lo que NO se hizo

- **No se ha comprobado en staging/yaqu.app** (el cambio se ve solo con un presupuesto aceptado que tenga Trabajo de origen); queda para después del despliegue. Lo medido es el DOM ejecutado en el banco de vistas y el clic, no una captura AB6.
- El botón usa `btn-secondary btn-sm`, como sus vecinos de «Siguiente paso»; el tamaño táctil de `.btn-sm` es una decisión abierta del fundador (SCRUM-786), no de este ticket.
- Sin texto para «presupuesto sin Trabajo» (ver arriba): el botón se oculta.

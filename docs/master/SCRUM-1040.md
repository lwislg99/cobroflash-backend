# SCRUM-1040 (CON-04) · Ver en pantalla las facturas recibidas

**Fecha:** 22-sep-2026 · **Carril:** facturación (excepción del día: J5 en carril fiscal, ver
`docs/equipo/orquestador.md` §11bis A20 — el área normal de J5 sigue siendo Competencia y producto)
**Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `6bca74e55d4ad193debd03cd95223f8390080ad4` · 2026-09-22T22:44:05Z

## Qué es, y qué NO es

Las facturas que el profesional **RECIBE de sus proveedores** — no las que emite. El libro de A6
(SCRUM-296) y E4 (SCRUM-325) ya construía este dato y lo servía como descarga (`librosAeat.routes.ts`,
`GET /admin/libros/recibidas.csv`, SCRUM-426), pero no había pantalla: el autónomo no podía mirar
lo que va a entregarle a su gestor sin bajarse el fichero.

**No es el camino de emisión fiscal.** Solo lectura sobre `Expense` (gastos), sin sello, sin
`INVOICING_ES_ENABLED` de por medio: es el propio profesional mirando sus propios números como
borrador, aclaración del orquestador en SCRUM-1012 (21-sep-2026).

## Lo que se construyó

1. **Ruta nueva de lectura**, `GET /admin/libros/recibidas.json?año=&trimestre=` en
   `librosAeat.routes.ts` — **no se tocó `/recibidas.csv`**, ni una línea. Mismo contrato de
   periodo (año y trimestre obligatorios, mismo 400 con el mismo texto) y el **mismo motor**
   (`leerLibroRecibidasDelTrimestre`, ya existente): la pantalla y la descarga CSV llaman a la
   misma función con el mismo `db`, así que dan el mismo conjunto de filas por construcción, no
   por casualidad (aceptación 5).
2. **Pantalla nueva**, `public/dashboard/js/facturasRecibidasView.js`, junto a «Libro de registro»
   en el menú (`data-view="facturas-recibidas"`), con selector de año/trimestre (mismo par que la
   descarga CSV de emitidas en `exportView.js`, prerrellenado con el trimestre EN CURSO),
   tabla (Fecha, Proveedor, NIF, Base, IVA, Total) y totales al pie del periodo mostrado.
3. **Wiring**: `app.js` (`case 'facturas-recibidas'` + `HASH_VIEWS`), `index.html` (botón de menú +
   `<script>`), `public/sw.js` (SHELL de precache — la lección de SCRUM-274/453: un fichero nuevo
   sin precachear falla en la primera visita sin red).

## Las tres situaciones que no se pueden confundir

Mismo criterio que `libroRegistroView.js` (SCRUM-296): un periodo sin gastos y un lector que no
supo mirar producen el mismo libro vacío, y significan lo contrario.

| situación | qué se pinta |
|---|---|
| la carga falla | aviso de error, ni una fila |
| miró N gastos, salieron 0 asientos | «el libro no cuadra», con el número |
| miró 0 | «todavía no tienes facturas recibidas en este periodo» — aquí sí es la verdad (aceptación 4) |
| falta `miradas` en la respuesta | se trata como fallo |

## Los gastos sin clasificar (aceptación 6, caso d de SCRUM-1037)

Un gasto sin `baseAmount` no es un asiento (decisión ya tomada en A6/SCRUM-426) y **no se oculta**:
el motor ya declara `avisosLibroRecibidas` — microcopy **APROBADA por el fundador el 10-ago-2026**
— y esta pantalla los pinta **tal cual llegan del servidor**, sin reescribirlos. Qué se hace con
esos gastos lo decide SCRUM-1037, no este ticket.

## Los totales al pie

Suman `base`, `cuota` (IVA) y `total` de las filas mostradas, **ignorando `null`** (A5/A6: un hueco
no es un cero). Si NINGUNA fila trae una cifra en una columna, esa celda del total sale «—», nunca
`0,00 €` — el mismo criterio que ya usa el resto del libro para un importe que no consta.

## Microcopy (regla 30)

Título, rótulo de menú, estado vacío y aviso de descuadre van con `[PENDIENTE microcopy oficial]`
delante: nadie los ha aprobado. Las cabeceras de columna (Fecha, Proveedor, NIF, Base, IVA, Total)
son los términos que impone la propia aceptación del ticket — mismo criterio que «Fecha»/«Base»/
«IVA»/«Total» en el libro de emitidas, que tampoco llevan marcador. Los dos avisos del motor
(«formato provisional» y el de gastos sin clasificar) son la microcopy ya aprobada el 10-ago-2026 y
se reutilizan sin reescribir. Sin claims: en ningún texto nuevo aparece «oficial», «AEAT» ni
«Hacienda» (aceptación 7).

## Verificado

* **17 tests nuevos** de pantalla (`tests/scrum1040-pantalla-facturas-recibidas.test.mjs`): las tres
  situaciones, columnas, totales (con y sin cifras), el aviso de excluidos, y el cableado
  (`case`, `HASH_VIEWS`, menú, script) — comprobado EJECUTANDO la vista sobre un DOM de mentira
  (regla 36: sin dependencias nuevas), no leyendo el fuente.
* **5 tests nuevos** de servidor (`tests/scrum1040-facturas-recibidas-servidor.test.mjs`): el
  contrato de periodo idéntico al de `/recibidas.csv`, `Cache-Control: no-store`, la ruta JSON y el
  CSV dando el MISMO conjunto de filas contra el mismo `db` falso, aislamiento por merchant (regla
  2), y que la ruta no toca el camino de emisión.
* **Regresión**: `scrum325-libros-por-periodo`, `scrum426-libro-recibidas`, `scrum296-*` (57 tests)
  y `scrum274-shell-alineado` / `scrum453-precache-con-huella` (16 tests) en verde tras el cambio.
* **Los diez trinquetes/censos que una pantalla y un `<script>` nuevos disparan**, medidos en rojo y
  cerrados en el mismo commit: SCRUM-420 (rótulo de barra, SIN marcador — §④ lo prohíbe), SCRUM-402
  y SCRUM-755 (censo de microcopy pendiente, +1 sitio cada uno), SCRUM-553 (regex con hueco para
  atributos, no pegadas al `>`, en mis propios tests), SCRUM-601 (`aPelo` 154→156: «factura» no
  depende del flag porque describe lo RECIBIDO, no lo emitido), SCRUM-628 (cobertura visual, sigue
  en 0 sin cubrir), SCRUM-662/670/417 (`SCRIPTS_DEL_DASHBOARD`), SCRUM-713c (estilos en línea desde
  JS, ver más abajo), SCRUM-819 (17→18 destinos de menú), SCRUM-821 (lista histórica congelada +1).
* `npm run build` limpio.
* **`npm test` completo**: corrido dos veces tras el merge con `origin/main` y en verde (una antes
  del refactor de CSS de SCRUM-713c, con esa única familia en rojo y ya cerrada arriba; ver el
  «error propio» de abajo para el segundo rojo que ese mismo `npm test` sacó). La tercera pasada,
  ya con todo cerrado, la mató la propia protección de memoria del entorno a mitad de camino —no el
  código— y no se ha vuelto a lanzar por indicación expresa de no reintentarla sin que se pida. En
  su lugar: cada familia de test tocada se corrió suelta y en verde (batches de 24, 63, 114 y 221
  tests en distintas rondas) y el guard que parsea los 97 `.js` de `public/` (control de amplitud,
  no de comportamiento) también en verde.
* **Fuera de mi alcance, medido y NO tocado**: `scrum476-reconciliar-censos` (topología de
  `node_modules` entre worktrees) sale en rojo con este worktree ad-hoc (`../wt-scrum1040`) creado
  para esta tanda — no lo dispara ningún cambio de código de este ticket, y no lo he verificado
  contra un checkout limpio por falta de tiempo. `scrum939b-trinquete-de-las-skills` (una ruta de
  `gh.exe` que el censo de una skill declara «falsa» y en esta máquina ya existe) es anterior a esta
  rama y no tiene relación con facturas ni con el dashboard. Los dos se reportan, no se arreglan
  aquí (son de otro carril).

## Un error propio, confesado

Mi primer intento de comparar la ruta JSON contra el CSV como CONJUNTO tenía un filtro de líneas
que buscaba `/^\d+ gastos/` (plural) para descartar el aviso de excluidos del recuento de filas de
datos — y ese aviso, con `sinClasificar === 1`, sale en SINGULAR («1 gasto…», `avisosLibroRecibidas`
lo pluraliza de verdad). El test contaba esa línea como una fila de datos y fallaba con «2 !== 1».
No era el producto: era mi propio filtro heurístico. Corregido a `/^\d+ gastos? sin datos de IVA/`.

## Lo que NO cubre — declarado

* **Sin GO explícito de J1 en un comentario de este ticket.** El texto de SCRUM-1040 pide «revisión
  de J1 (decisión D6 resuelta: sí) mediante comentario en este ticket antes de tocar»; al medir
  (PASO 0) el ticket tenía 0 comentarios. La decisión D6 SÍ está tomada — comprobado en SCRUM-1012,
  comentario del orquestador (21-sep-2026): «D6 SÍ» para Contabilidad — y el encargo de esta tanda
  vino del propio orquestador de mi equipo autorizando construir sin GO adicional mientras no se
  tocara el camino de emisión (no lo toca: solo lee `Expense` vía el motor ya existente de A6/E4).
  Queda declarado para que quien cierre el ticket decida si hace falta el comentario formal antes
  de mergear.
* **Sin matriz de dispositivos ni capturas.** Comprobado el contrato del DOM (con datos y vacío),
  no una captura real a 390 px — esta máquina no tiene Playwright instalado en este worktree.
* **`INVOICING_ES_ENABLED` / regla 24**: esta pantalla no depende del flag ni lo consulta — es
  lectura de los propios gastos del profesional, no un documento que sale de casa. Si algún día
  se decide lo contrario, es cambio de alcance, no un olvido de este ticket.
* **No se ha corrido contra Postgres.** Igual que A6/E4, el aislamiento por merchant se prueba con
  un `db` falso en memoria (esta máquina no tiene Postgres); el gate `LIBRO_PG_URL` sigue siendo el
  camino para probarlo contra una base real, y no se ha tocado.

## Sin un solo estilo en línea (regla 4)

La primera versión escribía `style.cssText` a mano (mismo patrón que `libroRegistroView.js`), y el
trinquete SCRUM-713c —que prohíbe CUALQUIER `style.cssText` nuevo desde JS, no solo un techo— lo
cazó. Se sacaron los 11 sitios a `styles.css` (`.fr-*`, con su comentario) y el selector de periodo
pasó a reutilizar `.data-card-toolbar` (AB3), que ya es el componente de la casa para una barra de
filtros. El trinquete de estilos sigue en su techo de 340, sin subir.

## Ficheros

* `src/modules/fiscal/librosAeat/librosAeat.routes.ts` — ruta nueva `GET /recibidas.json` (aditiva).
* `public/dashboard/js/facturasRecibidasView.js` (nuevo) — la pantalla.
* `public/dashboard/js/app.js` · `public/dashboard/index.html` · `public/sw.js` — menú, deep-link y precache.
* `public/dashboard/css/styles.css` — clases `.fr-*` nuevas; el periodo reutiliza `.data-card-toolbar`.
* `scripts/guard-rastro-del-menu.mjs` — `MINIMO_DESTINOS` 17 → 18 (SCRUM-819).
* `tests/_banco-vistas.mjs` — `facturasRecibidasView.js` entra en `SCRIPTS_DEL_DASHBOARD` (SCRUM-662/670/417).
* `tests/_barra-lateral.mjs` — `facturas-recibidas` entra en `ANADIDAS_DECLARADAS` (SCRUM-420).
* `tests/scrum402-marcador-no-se-pinta.test.mjs` · `tests/scrum755-el-contador-que-cuadro-solo.test.mjs`
  — `facturasRecibidasView.js` entra en los dos censos de microcopy pendiente, con 1 sitio cada uno.
* `tests/scrum601-copy-del-documento-vs-flag.test.mjs` — `aPelo` 154 → 156 (el «factura» de
  `recuento()` no depende del flag: es lo que RECIBE el profesional, no lo que él emite).
* `tests/scrum628-cobertura-visual-del-dashboard.test.mjs` — cubre la vista nueva; el trinquete de
  cobertura sigue en 0.
* `tests/scrum819-el-menu-deja-rastro.test.mjs` — 17 → 18 destinos de menú.
* `tests/scrum713c-trinquete-de-estilos-en-js.test.mjs` — sin cambios de fichero, verificado en verde
  (el techo de 340 no sube: los 11 sitios nuevos se sacaron a CSS antes de tocar este número).
* `tests/scrum821-la-lista-que-decide-que-se-mira.test.mjs` — el fixture histórico de «sin foto»
  gana `facturas-recibidas` junto a sus seis originales, con su motivo (6 → 7).
* `tests/scrum1040-facturas-recibidas-servidor.test.mjs` (5, sin gate).
* `tests/scrum1040-pantalla-facturas-recibidas.test.mjs` (17, sin gate).

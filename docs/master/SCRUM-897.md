# SCRUM-897 · El banco de vistas apilaba cada `innerHTML` sobre la pintada anterior

**Medido contra:** `origin/main` = `018d18075c4aefb276dd21a47e1ba2186be630ad` · 2026-09-17T08:36:52Z (cabecera `Date` de GitHub)
**Recomprobado tras mezclar `origin/main`** = `1e7d6de20a94bc67cad1dd8b04f00acfb8ec1507` (merge `a5a72df9f3ccaddd2ee02051cd3072102f0a9ec9`) · 2026-09-17T08:45:16Z: los 4 ficheros tocados, 31/31 verdes, y las cifras con su contador siguen en 237/166/69/109.
**Rama:** `scrum-897-banco-reemplaza-innerhtml` · **Carril:** Sesión 3 (bancos) · **Estado:** EN PR

Nace de SCRUM-889: la Sesión 2 lo vio al cerrar y no lo arregló en su PR (regla 37).

## PASO 0 · reproducido corriendo, con dos sondas independientes

- **Sonda 1, el banco:** `pintarVista(cargarDashboard(RAIZ), vista)` y `todos(contenedor)`, el mismo contador que usan los tests.
- **Sonda 2, Edge sin mini-DOM:** `puppeteer-core` con `_navegador.mjs`. Carga los scripts de `dashboard/index.html` en su orden, `fetch` responde `{}` a todo (igual que el banco), pinta la vista en un `div` dentro del documento y cuenta `[c, ...c.querySelectorAll('*')]`.

| Vista | Banco (main) | Edge, elementos | Banco − Edge por etiqueta |
|---|---|---|---|
| renderQuotesView | 261 (251 elementos + 10 `#text`) | 227 | **DIV +6 · SPAN +9 · STRONG +9 = 24** |
| renderProductsView | 166 | 166 | idéntico |
| renderCustomersView | 69 | 69 | idéntico |
| renderHomeView | 109 | 143 | el banco se queda **corto** en 34: otra infidelidad (ver Hallazgos) |

**Por identidad**, sobre el árbol de main: los 24 son las **3 pintadas anteriores** de `.quote-totals` (24 hijos cuando su último marcado declara 6 → DIV 6 · SPAN 6 · STRONG 6) y de `.quote-total-kpi` (8 hijos cuando declara 2 → SPAN 3 · STRONG 3). Las tres pintadas son idénticas a la última. Coincide etiqueta a etiqueta con la diferencia medida en Edge.

**Causa** (`tests/_banco-vistas.mjs`, setter de `innerHTML`): solo vaciaba con `''`. Con marcado hacía `n.hijos.push(...)` encima de lo que había. Además, los nodos quitados conservaban `_padre` y su `id` seguía en `reg.porId`, a diferencia de `removeChild` (SCRUM-444).

## A12 · censo de lo que mide sobre el banco, antes de tocar

- **Consumidores:** 90 ficheros de `tests/` importan `_banco-vistas`, `_pagina-panel` o `_banco-lista`, y 54 cuentan nodos con `todos()`/`.nodos`. Además hay 14 scripts: 6 son `guard:*` de navegador; `_pagina-panel.mjs` **serializa el árbol del banco** para Edge, así que el defecto también llegaba a esos guards.
- **Trinquetes con cifra del banco:** `scrum697` (CONTROL NEGATIVO, `renderQuotesView` 261) y `scrum698` (CONTROL POSITIVO: 261/166/69/109; CONTROL NEGATIVO: 261).
- **Línea base de los 90 consumidores** sobre main: **833 tests, 833 verdes**.

## ROJO · `tests/scrum897-repintar-reemplaza.test.mjs`

Comiteado antes del arreglo: `65e189bddcf1c78b4bfbc2222cfba09453abdff9`. Con el banco de main caen los 3 tests:

1. Tras repintar, el contenedor tiene 3 hijos cuando su marcado declara 1. La pintada vieja se encuentra con `querySelector`, `getElementById` y conserva `parentNode`. El control positivo exige que lo nuevo SÍ esté.
2. Al vaciar a su abuelo, el `id` de un nieto colgado a mano sigue registrado. Un `id` redeclarado debe resolver al nodo nuevo.
3. En la vista real de presupuestos, `.quote-totals` y `.quote-total-kpi` deben tener solo su última pintada, con Edge = 1 `.quote-totals`. SUELO: si la vista no monta o deja de pintar esos contenedores con `innerHTML`, el test dice «NO PUDE MIRAR» y no da un cero.

Una trampa que apareció al escribirlo: el primer SUELO elegía el primer `.quote-block`, que no se repinta, y daba «no pude mirar». Se corrigió eligiendo por clase exacta.

## Arreglo

Commit `5a777d443e444adfc3feff408e593bab862f098c`. Antes de pintar, el setter suelta todos los hijos: les quita el padre y desregistra los `id` de **todo su subárbol**. Así `''` y marcado siguen el mismo camino.

**Mutantes** (cada uno, en el fichero real, restaurado con `git checkout`), los 4 muertos:

| Mutante | Cae |
|---|---|
| no soltar `_padre` | test 1 · «sigue creyendo que tiene padre» |
| no desregistrar `id` | tests 1 y 2 |
| desregistrar solo los hijos directos | test 2 · «un id de un nieto» |
| volver a vaciar solo con `''` | tests 1 y 3 |

## Después del arreglo · las cifras RECALCULADAS, no deducidas

Mismo contador sobre el árbol arreglado: `renderQuotesView` **237** (237 distintos), `renderProductsView` 166, `renderCustomersView` 69, `renderHomeView` 109. En el CONTROL NEGATIVO de 698 los dos montajes (con `datos` propios y desnudo) dan 237. Edge: 227 elementos = 237 − 10 `#text`, y presupuestos, productos y clientes quedan **idénticos a Edge etiqueta a etiqueta**.

Consumidores con el arreglo: 833 tests, 829 verdes, **4 rojos**, uno a uno:

| Test | Motivo | Qué se hace |
|---|---|---|
| scrum697 · CONTROL NEGATIVO | 261 → 237 | cifra recalculada, anotada con la identidad de los 24 |
| scrum698 · CONTROL POSITIVO | quotes 261 → 237; las otras tres, sin cambios | ídem |
| scrum698 · CONTROL NEGATIVO | 261 → 237 en los dos montajes | ídem |
| scrum889 · «la línea se GUARDA … y el parte se relee» | **era un falso verde**: el único `input.parte-linea-desc` con `.value === 'Cambio de diferencial'` era la **fila tecleada**, que la vista ya había repintado y el banco seguía apilando (medido: 4 inputs con el banco de main; 2 con el arreglo) | mira el atributo `value` del marcado repintado y exige además que no quede ninguna fila `data-nueva-desc`; esa condición cae con el banco de main |

## Suite completa y guards de navegador

- `npm test` sobre `5a777d44` (antes del merge): 7.191 tests · 7.080 verdes · 110 saltados · **1 rojo**, SCRUM-854 «esta rama trae su entrada de registro»: faltaba este expediente.
- Los 6 `guard:*` de navegador que se apoyan en el banco (`albaranes-con-acciones`, `escalera-por-estado`, `lista-trabajos`, `objetivo-tactil`, `portal-en-la-ficha`, `rastro-del-menu`), sobre el árbol arreglado: **los 6 con exit 0**. Comparados con los mismos 6 sobre main (`018d1807`, también exit 0) y sin las líneas de tiempos, cambia **una sola línea**: en `objetivo-tactil`, la excepción ya declarada «+ Añadir descuento» (`.btn-sm`) pasa de 29,7 a 29,8 px. Es el editor de presupuesto, que `_pagina-panel.mjs` serializa desde el banco y que ya no lleva las pintadas duplicadas; sigue siendo la misma excepción, sin tocar su lista.

## Hallazgos (regla 37: se reportan, no se arreglan aquí)

1. **El banco no copia el atributo `value` a la propiedad al parsear.** En el navegador, un `<input value="X">` recién parseado tiene `.value === 'X'`; en el banco, `''`. `REFLEJADOS` excluye `value` a propósito por lo que pasa *después* de escribir, pero al parsear el navegador sí lo refleja. Es lo que obligó a leer el atributo en scrum889.
2. **`renderHomeView`: el banco pinta 109 y Edge 143** (DIV −3 · BUTTON −9 · SPAN −22 …). Es una infidelidad en sentido contrario, sin diagnosticar.
3. **`set textContent`** vacía los hijos pero no desregistra sus `id` ni les quita el padre: la misma clase de defecto que este ticket, por otra puerta.

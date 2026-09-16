# SCRUM-352 · El bump táctil alcanza a las variantes escritas sin la base

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `f734e33d2df6afc67380e7933db87f01383fed63` · 2026-08-05T15:49:27+01:00

> Parte de la rama de SCRUM-368 (anillo de foco), ya mergeada en ese `main`. Rebasado sobre el
> `main` resultante, sufijo `-rebasada`, sin `--force`.

## La decisión y su motivo

**Manda el CSS.** `styles.css:376-377` declara por escrito que `.btn-primary`/`.btn-secondary`/etc.
«también funcionan solas», y el bump táctil de `@media (max-width:768px)` solo alcanzaba a `.btn`.
El comentario o se cumple o se borra, y borrarlo sería rebajar el documento para que cuadre con la
implementación — justo lo que SCRUM-368 prohíbe en su punto 1. Además cierra **la clase entera de
fallo**: arreglar los tres sitios de markup deja el cuarto para el mes que viene; arreglar el CSS
hace que el cuarto nazca bien.

Hay precedente dentro del propio archivo: `styles.css:997-1002` ya enumera
`.qq-modal .btn, .qq-modal .btn-primary, .qq-modal .btn-secondary { min-height: 44px }`. Alguien se
topó con esto antes y lo parcheó **local a un modal** en vez de en la base. Este cambio hace
redundante ese parche.

## El impacto, censado antes de tocar nada

Censo derivado del árbol (AST + atributos `class` literales), con suelo por forma y suelo de
cobertura:

| | |
| --- | --- |
| Conjuntos de clases con alguna clase de botón | **235** |
| — con la base `.btn` | 50 |
| — **sin** la base | **185**, en **27 ficheros** |

**Pero solo 46 de esos 185 crecen.** Los otros **139 llevan `btn-sm`** y siguen midiendo 30 px.
Ese matiz es el hallazgo que cambió la forma del arreglo, y no salía de leer el ticket.

Los 46 que pasan de 36 a 44, por fichero: `csvImport` 7 · `quotesDetailView` 6 · `quotesView` 6 ·
`jobDetailView` 4 · `admin.html` 3 · `aiQuoteAssistant` 3 · `plansView` 3 · `settingsView` 3 ·
`exportView` 2 · `nuevaFacturaModal` 2 · `reportsView` 2 · `teamView` 2 · `expensesView` 1 ·
`quotesListView` 1 · `templatesView` 1.

## El `:not(.btn-sm)` no es un caso especial: evita una asimetría medida

La forma directa del bump —añadir las variantes al selector sin más— **rompe la promesa por el
otro lado**. Medido en navegador antes de escribir nada en el repo:

| Clase escrita | hoy | bump directo | bump con `:not(.btn-sm)` |
| --- | --- | --- | --- |
| `btn-primary` | 36 | **44** | **44** |
| `btn btn-primary` | 44 | 44 | 44 |
| `btn-primary btn-sm` | 30 | **44** ⚠ | 30 |
| `btn btn-primary btn-sm` | 30 | 30 | 30 |

Con el bump directo, `btn-primary btn-sm` mediría 44 y su gemelo `btn btn-primary btn-sm` seguiría
en 30: exactamente lo contrario de «funcionan solas», y afectando a los **139** sitios más
numerosos del censo.

El mecanismo: `.btn { min-height:44px }` **pierde** contra `.btn.btn-sm` (0,2,0) y por eso un botón
pequeño sigue pequeño. Una variante suelta compite contra `.btn-sm` (0,1,0) declarado **antes**, y
ganaría por orden. El `:not(.btn-sm)` **reproduce esa derrota**, nada más.

## ¿Rompe el layout en algún sitio?

Medido a 360 y 390 px sobre los contenedores reales, con las animaciones terminadas:

| Contenedor | alto antes → después | ¿desborda? | ¿cambian las filas? |
| --- | --- | --- | --- |
| Pie de modal (`nuevaFacturaModal`) | 56 → 64 | no | no (1) |
| Pie con 3 rótulos largos | 100 → 116 | no | no (2 antes y después) |
| Fila de tabla | 94,81 → 102,81 | no | no (1) |
| Cabecera de modal | 56 → 64 | no | no (1) |
| `qq-modal` | **108 → 108, sin cambios** | no | no (2) |
| Barra de acciones | 36 → 44 | no | no (1) |

**Ningún desbordamiento, ningún scroll horizontal de página, ningún cambio en el número de filas.**
El `flex-wrap` que SCRUM-350 puso en `.modal-footer` absorbe el crecimiento, que era la duda
concreta: comprobado, no supuesto. El `qq-modal` no se mueve porque ya tenía su bump local.

Un caso que conviene saber: `reportsView.js:918` ya forzaba `style.cssText = 'min-height:44px'` a
mano, con el comentario «Objetivo táctil ≥44 px (AB6)». Es el mismo defecto parcheado inline. El
bump lo hace redundante; **no se ha tocado** (fuera de alcance).

## Las dos caras, por hash de píxeles

36 casillas (3 anchos × 12 combinaciones de clases), capturadas con el CSS de `main` y con el
cambio, comparadas hash a hash:

- **Cambian 8**: las 4 variantes sueltas sin modificador (`btn-primary`, `btn-secondary`,
  `btn-danger`, `btn-ghost`), a 360 y 390, de 36 a 44.
- **Idénticas 28**, byte a byte: `btn btn-primary` sigue en 44 **con los mismos píxeles**, todos
  los `btn-sm` siguen en 30, `btn-lg` sigue en 44, y **el escritorio entero no cambia**.

## El guard

`tests/scrum352-target-tactil-variantes.test.mjs` + `_censo-target-tactil.mjs` +
`_censo-clases-de-boton.mjs`.

**La aserción central es «sola == con base», no «todas ≥ 44».** «Todas ≥ 44» es falso (los
`btn-sm` miden 30 a propósito) y además habría dado **verde a la asimetría** de arriba. La promesa
del comentario es de simetría, así que la simetría es lo que se vigila.

- **Deriva todo del CSS**: variantes y modificadores salen del árbol (un modificador es una clase
  que el CSS escribe pegada a la base, `.btn.btn-sm`). Simula la cascada de `min-height` con
  especificidad, orden y media queries, incluido `:not()`.
- **Suelos**: si no hay variantes o falta `btn-sm` entre los modificadores, falla. Si alguna
  combinación no resuelve altura, falla. En el censo del front, las **cuatro formas** de escribir
  clases deben seguir reconociéndose, y ningún fichero que nombre una clase puede quedarse sin
  conjuntos (suelo de cobertura).
- **Rojo por el mecanismo**, verificado sobre el fichero: revertida la regla, cae nombrando las
  cuatro clases y el selector ganador de cada una. Y hay un segundo rojo específico: quitado el
  `:not(.btn-sm)`, detecta la asimetría y comprueba que es **solo** de los `btn-sm`.
- **Controles negativos**: el escritorio a 36 px no salta, y los `btn-sm` a 30 px tampoco.

> **El suelo de cobertura se ganó en el camino.** La primera versión del analizador no resolvía
> `className = <ternario>` y dejaba fuera `albaranDetailView.js:256`, donde las tres ramas son
> botones. El suelo lo cazó y se arregló **el analizador**, no el test.

## El hallazgo de fondo: ya estaba parcheado a mano en dos sitios que no se conocían

Los dos apuntes de regla 9 de abajo, juntos, dicen algo más grande que cada uno por separado:

- `styles.css:997-1002` lo arreglaba **dentro de `qq-modal`**, enumerando
  `.qq-modal .btn, .qq-modal .btn-primary, .qq-modal .btn-secondary { min-height: 44px }`.
- `reportsView.js:918` forzaba `style.cssText = 'min-height:44px'` **inline**, con el comentario
  «Objetivo táctil ≥44 px (AB6)».

> **Dos personas distintas encontraron el mismo problema, lo arreglaron en su rincón y ninguna
> subió a la causa. Eso no es un defecto de CSS: es lo que pasa cuando el arreglo local es más
> barato que entender por qué.**

Ninguno de los dos parches es incorrecto en su sitio, y ninguno dejó rastro que llevara al
siguiente hasta la causa común. Por eso el defecto sobrevivió a dos arreglos: cada uno resolvía
**su** pantalla y dejaba las otras 44 intactas, sin que nada se pusiera rojo. Es también la razón
de que el censo tuviera que ser derivado: los sitios que un arreglo local no toca no aparecen en
ningún sitio hasta que alguien los cuenta.

Los dos parches quedan **redundantes** con este cambio y **no se han tocado** (ver abajo).

## Lo que NO entra

- **El contraste (3,3:1).** Puede exigir mover el verde de marca: identidad, **regla 30**, y
  `DESIGN.md` dice que la marca es luminosa, nunca oscura, así que subirlo oscureciendo choca con
  una regla escrita. Sigue abierto en SCRUM-368.
- **El escritorio a 36 px NO es un defecto.** `DESIGN.md` pide «≥44 px **en móvil**»; con ratón, 36
  cumple. Que SCRUM-368 midiera 36 en escritorio y lo leyera como defecto global es la parte de ese
  ticket que esta medición corrige — y hay un **control negativo** que se pone rojo si alguien
  «arregla» el escritorio por error.
- **Los `btn-sm` a 30 px en móvil** no cumplen los 44 de `DESIGN.md`, pero **eso ya pasaba** con
  `.btn.btn-sm` y no es una regresión de este cambio. Se reporta y no se arregla (**regla 9**):
  decidir si un botón pequeño puede medir 30 en móvil es una pregunta de diseño, no de cascada.

## Estado de SCRUM-352

Sus tres sitios (`nuevaFacturaModal.js`, `jobDetailView.js`, `quotesView.js`) **quedan cubiertos
sin tocar su markup**: escriben `btn-primary`/`btn-secondary` sueltas y ahora miden 44 en móvil.
El censo confirma además que **no eran tres sino 46** los que crecían, así que arreglar los tres
sitios habría dejado 43 fuera. La pregunta de fondo del propio ticket —«¿tres instancias o el
CSS?»— queda resuelta por el CSS, que es lo que cierra la clase de fallo.

## AB6 — hueco declarado

Capturas a 360 y 390 px, antes y después, en `.playwright-mcp/` (sin trackear):
`352-{ANTES,DESPUES}-layout-{360,390}.png`.

**El pase por matriz de dispositivos reales es HUMANO y sigue sin hacerse.** Aquí importa
especialmente: el cambio es de **objetivo táctil**, y un target de 44 px se juzga con un dedo, no
con un `getBoundingClientRect`. Chromium headless dice que las cajas miden 44; si el dedo sigue
fallando, eso solo se ve en un teléfono.

## Reglas

Regla 4 (vanilla, un componente) · Regla 30 (no se toca el verde ni la microcopy) · Regla 9
(reportado y no arreglado: contraste, `btn-sm` a 30 px, el parche inline de `reportsView`).

# SCRUM-417 · «Descargar datos»: el test que CARGA la pantalla, no el que mira el router

**Fecha:** 10-ago-2026 · **Carril:** guards (frontend) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `8f01d8b2c76f4658d65619438118268b8cdf7463` · 2026-08-10T16:03:03+01:00
**Tanda:** 2555 tests · 2481 pass · **0 fail** · 74 gateados · `npm test` exit **0**

## PASO 0 — medido antes de tocar una línea

### La ENTRADA: hoy hay UN solo camino

| paso | dónde |
|---|---|
| el profesional pulsa | `settingsView.js:815` · `renderDescargarDatosCard` → `window.renderAppView('export')` |
| el router | `app.js:320` · `case 'export':` → `renderExportView(viewContainer)` (y solo si `appUserRole === 'admin'`; si no, cae a Inicio) |
| el fichero servido | `dashboard/index.html:256` · `<script src="./js/exportView.js">`, **script clásico**, y precacheado en `sw.js:55` |
| entrada de barra lateral | **ninguna** — la retiró SCRUM-420, `data-view="export"` da 0 coincidencias en `index.html` |

**Eso es lo que sube el precio del defecto**, y por eso este ticket existe: no hay segundo camino que
lo disimule. Si esa pantalla revienta, la funcionalidad está perdida para el usuario.

### El MECANISMO: existe entero, y NO se rehace

`public/dashboard/js/exportView.js`, **332 líneas**, publica `window.renderExportView` (`:332`). La
página la construyó SCRUM-244 y sigue ahí: selección de conjuntos (`#export-datasets`), ZIP con
rango de fechas (`#btn-export-zip`), portabilidad (`#btn-portabilidad`) y el libro.

### 🔴 Y EL DEFECTO DEL ENUNCIADO YA ESTÁ ARREGLADO EN `main` — medido, no supuesto

```
node --check public/dashboard/js/exportView.js   →  exit 0
node --test tests/public-js-parsea.test.mjs      →  2 tests, 0 fail (50 ficheros, suelo ≥40)
```

Lo arregló **`d5cd3b7c`** (Luis, PR #590, 10-ago 15:03): un comentario con backticks **dentro** del
template literal de `container.innerHTML`; el primer backtick cerraba la plantilla y lo que seguía
se parseaba como código (`SyntaxError: Unexpected identifier 'style'`). Al servirse como script
clásico, el navegador **descartaba el fichero entero** y la pantalla no se renderizaba. Ese commit
trajo además el guard derivado que lo habría cazado.

**Así que el punto 1 del encargo —«el arreglo del parseo»— no tiene trabajo: no hay nada roto que
arreglar.** Se dice en vez de inventar un arreglo para justificar el ticket. Lo que sí faltaba, y es
el punto 2, es el control que separa esto de un arreglo ciego.

## Lo que se construye

`tests/_banco-vistas.mjs` — un banco que **monta el dashboard como lo monta el navegador** y
`tests/scrum417-descargar-datos-carga.test.mjs` (10) que abre «Descargar datos» con él.

**No comprueba que exista su `case` en el router.** Eso ya lo hace SCRUM-420, y es el escalón que se
queda corto: *una pantalla que revienta al abrirse pasa el test de composición y le falla al
profesional igual*. Y tampoco se queda en `node --check`: **parsear no es ejecutar, y ejecutar no es
pintar** — son tres escalones y hoy estaban cubiertos el primero y ninguno más.

### 🔴 LAS TRES VECES QUE ESTE BANCO DIO ROJO Y EL ROJO ERA SUYO

Es la parte útil de la entrega, porque es la diferencia entre un banco y una fábrica de falsos
hallazgos. Las tres versiones anteriores «encontraron defectos» en `exportView.js` que **no
existen**:

| # | qué dijo el banco | qué pasaba de verdad |
|---|---|---|
| 1 | `Cannot read properties of null (reading 'appendChild')` en `:136` | el mini-DOM devolvía `null` en todo `getElementById`. La vista pinta con `innerHTML` y luego busca por id — que es lo que funciona en el navegador con el contenedor en el documento. **El DOM de mentira tiene que resolver los `id` del marcado asignado.** |
| 2 | `ERROR_NO_ES_FICHERO is not defined` en `:185` | se cargaba `exportView.js` **solo**. Es un `const` de nivel superior de `api.js`, y los scripts clásicos **comparten script scope**. **Hay que cargar los `<script src>` de `index.html` en orden y en un solo contexto.** |
| 3 | «la vista no publica su función de render» | `window` era un objeto aparte del global. En el navegador **`window` ES el global**, así que un `function` de nivel superior queda publicado. **`ctx.window = ctx`.** |

> **Un banco infiel no mide de menos: mide OTRA COSA.** Y su rojo se lee exactamente igual que un
> hallazgo — el primero de los tres venía con número de línea y todo. Los tres controles negativos
> del test fijan las tres correcciones, para que ninguna se pierda al tocar el banco.

## Verificado

### En rojo, sobre el árbol REAL — tres inyecciones, comprobadas EN DISCO

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | se reintroduce el defecto histórico (un backtick dentro del template) | 🔴 «hay ficheros que el navegador DESCARTA al cargarlos · **js/exportView.js — SyntaxError: Unexpected identifier 'style'** · js/exportView.js:120» |
| **R2** | el lector de `<script src>` se ciega | 🔴 «**BANCO CIEGO: solo 0 `<script src>` leídos** de dashboard/index.html (esperaba ≥40)» |
| **R3** | se renombra `id="export-datasets"` en el marcado | 🔴 «la pantalla «Descargar datos» **REVIENTA al abrirse** … TypeError: Cannot read properties of null (reading 'appendChild')» |

Las tres abortan si el reemplazo no llega al fichero, que es la forma de la casa desde SCRUM-420:
*una mutación que no llega al fichero produce un verde que parece un guard de sobra*. **R2 volvió a
caer en eso al primer intento** —el patrón que iba a sustituir no casaba— y el aborto lo dijo en vez
de dejarlo pasar por verde.

### En la suite, cada tanda — porque una inyección solo prueba el guard el día que se escribe

Dos fixtures de rojo que corren siempre: el **defecto histórico reproducido** (backtick dentro del
template) y un **símbolo inexistente** —el modo de fallo que `node --check` NO ve, porque parsea
perfectamente y revienta al correr—. El segundo exige además que el mensaje **nombre** el símbolo.

### Controles negativos

Una vista sintética sana **no** da rojo (un banco que falla con todo es tan inútil como uno que pasa
con todo) · el mini-DOM registra los `id` del marcado · `window` es el global.

### El suelo

«Todo carga bien» y «no encontré nada que cargar» son el mismo verde: un banco vacío pinta cero
pantallas rotas con la misma cara que un dashboard sano. Suelo: **≥40 scripts** leídos de
`index.html` (hoy **48**, y los 48 se ejecutan sin excepción) y `js/exportView.js` entre ellos.

## Huecos declarados

* **Solo se cubre `export`, y el hueco tiene su propia prueba.** El banco sirve `{}` a `apiRequest`.
  A `export` le vale —no pinta datos al abrirse: 20 nodos, **0 ids sin resolver**— pero otras vistas
  esperan formas concretas (listas, objetos con campos) y darían un rojo **del fixture**, no del
  código. Medido en el barrido: de 12 vistas probadas, 7 pintan y 5 fallan **por la forma de los
  datos**. Extender el banco con un fixture por vista es otro trabajo; **lo que cuesta es el
  fixture, no el banco** — el banco ya está.
  El test lo sostiene con un suelo del propio hueco: si `renderTeamView` dejara de fallar, el hueco
  se habría cerrado solo y hay que volver a mirarlo.
* **El DOM es de mentira.** No hay layout, ni CSS, ni eventos reales: esto dice si la pantalla se
  monta, **no si se ve bien**. AB6 sigue siendo humano.
* **No se pulsa nada.** Que el ZIP se genere y se descargue no lo mide este banco.
* **`node --check` sigue haciendo falta**: cubre los 50 `.js` de `public/`, también los que este
  banco no monta.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión (se ha leído `app.js` y `exportView.js`, no se ha
modificado ninguno) · ningún `.env` · **ni una línea de `exportView.js`**, que es la consecuencia de
que el PASO 0 dijera que no hay nada roto. Cero microcopy nueva.

## Ficheros

* `tests/_banco-vistas.mjs` (nuevo) — el banco: carga en orden de navegador, un contexto, `window`
  global, mini-DOM que resuelve los `id` del marcado.
* `tests/scrum417-descargar-datos-carga.test.mjs` (nuevo, 10) — suelos, positivo, dos rojos de
  fixture, tres controles negativos y el suelo del hueco declarado.

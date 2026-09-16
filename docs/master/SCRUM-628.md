# SCRUM-628 · COBERTURA-VISUAL: el verde de los guards visuales no decía sobre qué pantallas miraba

**Fecha:** 16-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `026677a1bd8260ce073648680a8eb7d7003f4b39` · 2026-09-16T05:20:00+01:00
**Tanda:** 6909 tests, 6799 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 826 ficheros · exit 0 — con tope duro, medida DESPUÉS del último cambio.

> **Un guard que termina sin hallazgos y no dice sobre qué miró es indistinguible de uno que no
> miró nada.**

## Los dos números del censo

| | |
| --- | --- |
| ficheros de guard `guard:*` | **20** |
| vistas del dashboard (`*View.js`) | **27** |
| de ésas, **nombradas por algún guard** | **7** |
| 🔴 **DIFERENCIA: sin cubrir** | **20** |

Y ahora el verde lo imprime, que es el entregable principal:

```
población: 20 guards visuales · 27 vistas del dashboard · 7 nombradas por algún guard · 20 SIN CUBRIR
la más grande sin cubrir: jobDetailView.js (3002 líneas)
```

Es la norma **A3** aplicada a los guards de navegador: *un cero no significa «está limpio»,
significa «no he mirado»*. Hasta hoy los guards pasaban en verde y nadie sabía que el dashboard
—donde el profesional vive todo el día— no lo miraba ninguno.

## ⚠️ El enunciado del ticket, matizado y medido

«El dashboard entero no tiene ninguno» **no es exacto**: **10 de los 20** guards tocan alguna ruta
del dashboard. Pero casi siempre cargando su `styles.css` **dentro de una página sintética**
(`/__caja-avisos.html`, `/__caja-semaforo.html`…), y eso ejercita el CSS, no la vista.

Por eso la unidad de este censo **no es «¿toca una ruta del dashboard?» sino «¿algún guard nombra
esta VISTA?»** — que es la pregunta que se corresponde con lo que un profesional abre. Con la
unidad del ticket el número habría sido 10 y habría sonado mejor de lo que es.

⚠️ **Y el criterio es deliberadamente GENEROSO:** cuenta como cubierta que un guard **nombre** el
fichero, aunque no lo ejercite. Se elige así a propósito: un criterio generoso que aun así deja
**20 fuera** es más difícil de discutir que uno estricto. Si mañana se afina, el número sólo puede
empeorar.

## La vista cubierta, y su criterio — que sale del censo, no de la intuición

**`jobDetailView.js` · 3.002 líneas · la más grande de las 20 que hoy no mira nadie**, y es el
detalle del Trabajo.

El criterio vive en `laQueMasPesaSinCubrir()` y se puede volver a ejecutar: **tamaño en líneas,
entre las que el índice enlaza** —una vista que el índice no carga no la abre nadie—. No es «la más
importante», que no se puede medir: es **la más grande de las desatendidas**, que sí.

🔴 **Y la elección no se queda apuntando a un árbol viejo:** hay un test que cae el día que otra
vista pase a ser la más grande sin cubrir, obligando a rehacer el criterio en vez de reescribir el
nombre a mano.

**⛔ No se hacen las 27.** Construirlas en una tanda sería adivinar cuáles importan, y el ticket lo
prohíbe expresamente.

## Verificado en rojo

**🔴 EL QUE DECIDE** — se rompe la vista de verdad (el render lanza al entrar), comprobando que la
mutación **ENTRÓ** y restaurando **byte a byte** contra los bytes de disco:

```
mutación aplicada · ¿ENTRÓ? SÍ, el fichero cambió
not ok 4 - SCRUM-628 · 🔴 EL QUE DECIDE: el detalle del Trabajo SE MONTA, y pinta su contenedor
    🔴 LA VISTA DEL DETALLE DE TRABAJO NO SE MONTA: la vista no publica `renderJobDetailView`
# pass 5 · fail 1
RESTAURADO byte a byte: ✅ idéntico
```

**✅ POSITIVO, y DISCRIMINA** — en esa misma pasada, el test de las vistas que **ya** se vigilaban
(`customersView`, `quotesView`) **siguió pasando**. Eso es lo que acredita que el rojo era de la
vista rota y no del banco: si el banco se hubiera roto, «la vista está mal» y «el banco no monta
nada» habrían dado el mismo rojo.

**⚠️ Por IDENTIDAD, no por subcadena** — el aserto cuenta **nodos del árbol pintado**, no
`includes` sobre el HTML. Es la lección de ayer: `includes('btn-primary')` pasaba porque la página
también pinta `btn-primary btn-sm`, y el guard aprobaba por una razón distinta de la que creía.

**SUELO** — cero vistas o cero guards sale **CIEGO**, no verde; y `cubiertas + sinCubrir` tiene que
sumar el total, para que el censo no pueda perder pantallas por el camino.

**Trinquete** — las 20 sin cubrir están declaradas: si el número **sube**, alguien añadió una vista
sin guard y el rojo la nombra; si **baja**, también cae, para que la mejora quede **anotada** en vez
de pasar desapercibida.

## Lo que NO cubre

* **26 vistas siguen sin guard propio.** Este ticket entrega el censo, el que el verde lo diga, y
  **una** cubierta como prueba de que el camino funciona.
* **La vista se ejercita en el banco (JSDOM), no en navegador.** Comprueba que **monta y pinta**,
  que es justo lo que hoy no comprobaba nadie; no comprueba contraste, tamaño táctil ni CLS — eso
  son los `guard:*` de navegador, que viven fuera de la tanda.
* **No se ha tocado ningún guard existente**, así que ninguno ha podido dejar de cazar lo suyo.
* **No se toca UI**: se lee la vista, no se modifica. `src/` y `public/` quedan intactos.

## Ficheros

* `scripts/_cobertura-visual.mjs` — el censo, con el criterio de elección escrito dentro.
* `tests/scrum628-cobertura-visual-del-dashboard.test.mjs` — la población declarada, el trinquete,
  la vista cubierta y sus controles.

---

# APÉNDICE · 16-sep-2026 · SCRUM-628b · FASE b: cinco vistas más, y el censo que no veía su propia cobertura

**Fecha:** 16-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `99ea4b5e370b103738714b584d70f570d3a60c02` · 2026-09-16T06:37:11+01:00
**Tanda:** 6943 tests, 6833 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 829 ficheros · exit 0 — con tope duro, medida DESPUÉS del último cambio y DESPUÉS de recompilar el merge.

> **Un censo que no reconoce la cobertura que se le acaba de añadir no mide la cobertura.**

## 🔴 Lo primero que apareció: el 20 de la fase a estaba INFLADO

Al medir esta fase, `laQueMasPesaSinCubrir()` seguía señalando **`jobDetailView.js`** — la vista
que la fase a acababa de cubrir.

El defecto estaba en mi propio censo: contaba una vista como cubierta sólo si un `guard:*`
**nombraba** su fichero, y **no veía los tests de la tanda que la MONTAN** con `pintarVista`. Así
que su trinquete se habría quedado clavado en 20 para siempre, **pareciendo estable**.

Arreglado el censo para mirar también los tests: **las sin cubrir no eran 20, eran 11.** Había
**nueve vistas que ya ejercitaban tests anteriores** y nadie las estaba contando.

⚠️ **Es lo contrario del matiz de la fase a, y por eso se dice igual de claro:** allí el número
sonaba mejor de lo que era; aquí sonaba **peor**. Las dos veces el problema era la unidad de medida.

## 🔴 Y el criterio nuevo se pasó de generoso — medido y descartado

La primera versión del arreglo contaba cualquier literal `renderX` dentro de un fichero que
importara `pintarVista`. Con eso las sin cubrir bajaban de 11 a **2**, y ese 2 no era cobertura:

```
renders por llamada LITERAL a pintarVista              : 14
renders por literal en fichero con pintarVista (ancho) : 28
de los 14 de diferencia, se montaban de verdad         : 5   ← los de esta fase
los otros 9                                            : sólo se nombraban
```

**Es el defecto de SCRUM-511 dentro de mi propio instrumento:** contar menciones en vez de usos. Se
vuelve al criterio **estricto** —la llamada `pintarVista(x, 'renderXView')`— y **el precio de la
precisión lo paga el test**: cada vista se monta con su nombre escrito en la llamada. Más verboso
y comprobable.

## Las cinco de esta fase, por el criterio ya derivado

No se eligen por intuición: son las cinco mayores de las 11 que quedaban, por
`laQueMasPesaSinCubrir()` en cascada. **Cuántas** es decisión de coste —todas montan y el coste
marginal es un test más—; **cuáles**, no.

| vista | líneas |
| --- | --- |
| `homeView.js` | 1.381 |
| `quotesDetailView.js` | 1.342 |
| `productsView.js` | 1.176 |
| `jobsView.js` | 982 |
| `invoicesView.js` | 919 |

## El trinquete BAJA, y está comprobado ejecutado

```
antes (fase a, declarado) : 20 sin cubrir   ← inflado por el censo ciego
tras arreglar el censo    : 11 sin cubrir
tras cubrir estas cinco   :  6 sin cubrir
```

Y el verde lo dice solo:

```
población: 20 guards visuales · 27 vistas del dashboard · 21 nombradas por algún guard · 6 SIN CUBRIR
```

Quedan seis, por orden: `expensesView` (576), `providersView` (475), `libroRegistroView` (360),
`plansView` (267), `parteOficinaView` (228), `quoteRequestsView` (161).

## Verificado en rojo — las cinco, una a una

Se rompe cada vista de verdad (se renombra su `render`), comprobando que **la mutación ENTRÓ** y
restaurando **byte a byte**:

```
homeView.js            mutación ENTRÓ: sí · cae «🔴 homeView.js SE MONTA y pinta su contenedor»
quotesDetailView.js    mutación ENTRÓ: sí · cae «🔴 quotesDetailView.js SE MONTA…»
productsView.js        mutación ENTRÓ: sí · cae «🔴 productsView.js SE MONTA…»
jobsView.js            mutación ENTRÓ: sí · cae «🔴 jobsView.js SE MONTA…»
invoicesView.js        mutación ENTRÓ: sí · cae «🔴 invoicesView.js SE MONTA…»
   ✅ positivo (banco sano) sigue pasando: SÍ  ×5
   restaurado byte a byte: ✅  ×5
```

**El positivo DISCRIMINA en las cinco:** el test de las vistas ya vigiladas siguió pasando en cada
pasada, así que el rojo era de la vista rota y no del banco. Sin eso, «la vista está mal» y «el
banco no monta nada» darían el mismo rojo.

⚠️ **Por identidad, no por `includes`:** los asertos cuentan **nodos del árbol pintado**. Es la
lección de `btn-primary`, que casaba también `btn-primary btn-sm`.

**Y el censo ve la regresión:** al romper una vista caen también el trinquete y el test de
«cubiertas que vuelven a pendientes» — la cobertura perdida se nota, no se escapa.

## Un cambio de diseño en el trinquete

El test que ataba la elección a un NOMBRE fijo (`jobDetailView.js`) **cayó en cuanto esa vista
quedó cubierta** — hizo su trabajo. Pero anclar al nombre de la candidata obliga a reescribirlo
cada fase, que es el defecto de SCRUM-663: *un valor que alguien tiene que actualizar a mano.*
Ahora se ata la propiedad que no caduca — **lo cubierto sigue cubierto** — y cuál es la siguiente
candidata va al diagnóstico, no a un aserto.

## Lo que NO cubre

* **Seis vistas siguen sin cubrir**, nombradas arriba y con su orden ya derivado.
* Las vistas se ejercitan en el **banco (JSDOM)**: comprueban que **montan y pintan**, no contraste
  ni tamaño táctil ni CLS — eso son los `guard:*` de navegador, fuera de la tanda.
* **`src/` y `public/` intactos:** las vistas se leen, no se tocan.

---

# APÉNDICE · 16-sep-2026 · SCRUM-628c · FASE c: las seis que quedaban, y el trinquete a CERO

**Fecha:** 16-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `a9a1a3382fa74008e7da6da9611289b0ce6165ce` · 2026-09-16T09:40:24+01:00
**Tanda:** 6988 tests, 6878 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 833 ficheros · exit 0 — con tope duro, medida DESPUÉS del último cambio y DESPUÉS de recompilar el merge.

> **Un trinquete en cero no sobra: es lo único que impide que entre la siguiente sin vigilar.**

## El trinquete, cerrado

```
población: 20 guards visuales · 27 vistas del dashboard · 27 nombradas por algún guard · 0 SIN CUBRIR
```

| fase | sin cubrir |
| --- | --- |
| a (declarado) | 20 ← inflado por el censo ciego |
| a (censo arreglado) | 11 |
| b | 6 |
| **c** | **0** |

Las seis de esta fase, por el mismo criterio derivado: `expensesView` (576), `providersView`
(475), `libroRegistroView` (360), `plansView` (267), `parteOficinaView` (228), `quoteRequestsView`
(161).

## 🔴 Y por tercera vez, el detector sólo veía la forma que yo tenía en la cabeza

Con las seis montando, el censo seguía diciendo **2 sin cubrir** — y eran exactamente
`plansView.js` y `quoteRequestsView.js`, **las dos únicas que se montan con datos propios**:

```js
pintarVista(cargarDashboard(RAIZ, { datos }), 'renderPlansView')
```

El reconocedor exigía `pintarVista(<sin comas>, 'renderX')`, y ese primer argumento lleva comas y
paréntesis. **Estaban cubiertas y el censo no las veía.** Ahora el criterio es la **cercanía** al
nombre de la llamada (ventana de 160 caracteres), que no depende de cómo se escriban los
argumentos.

Es la tercera vez en este módulo — primero no veía los tests, luego contaba menciones, ahora sólo
la llamada simple. Queda escrito en el propio fichero para que la cuarta se note antes.

## ⚠️ Dos vistas necesitan la forma de su ruta, y NO es un defecto del producto

`plansView` y `quoteRequestsView` revientan con la respuesta `{}` que el banco da por defecto,
porque sus rutas devuelven una **lista**. Comprobado leyendo el consumidor, no suponiendo:
`buildPlansHtml({ currentPlan, planExpiresAt, plans, founding })` desestructura, y
`quoteRequestsView` **ya defiende** `null` y lista vacía (`if (!requests || requests.length === 0)`)
— lo que no espera es un objeto. Darles su forma es usar el banco bien, no taparles nada.

## 🔴 El control que justifica NO borrar el trinquete en cero

En cero deja de medir deuda y pasa a ser una **puerta**. Que sepa seguir subiendo hay que
comprobarlo **ejecutándolo**: un trinquete en cero que no sabe subir y uno que ya no existe se leen
exactamente igual.

Se escribe una vista sintética en el directorio real y se borra en `finally`:

```
antes: 0 sin cubrir
con la vista intrusa: 1 sin cubrir, y la NOMBRA (__scrum628cIntrusaView.js)
tras borrarla: 0 — el árbol queda como estaba
```

## Verificado en rojo — las seis, una a una

```
expensesView.js         ENTRÓ:sí · cae SU test:SÍ · positivo sigue verde:SÍ · restaurado ✅
providersView.js        ENTRÓ:sí · cae SU test:SÍ · positivo sigue verde:SÍ · restaurado ✅
libroRegistroView.js    ENTRÓ:sí · cae SU test:SÍ · positivo sigue verde:SÍ · restaurado ✅
plansView.js            ENTRÓ:sí · cae SU test:SÍ · positivo sigue verde:SÍ · restaurado ✅
parteOficinaView.js     ENTRÓ:sí · cae SU test:SÍ · positivo sigue verde:SÍ · restaurado ✅
quoteRequestsView.js    ENTRÓ:sí · cae SU test:SÍ · positivo sigue verde:SÍ · restaurado ✅
```

**El positivo discrimina en las seis:** las vistas ya vigiladas siguieron montando en cada pasada,
así que el rojo era de la vista rota y no del banco.

⚠️ **Por identidad:** los asertos cuentan **nodos del árbol pintado**, no `includes` sobre HTML.

## Lo que NO cubre

* Las 27 se ejercitan en el **banco (JSDOM)**: comprueban que **montan y pintan**. Contraste,
  tamaño táctil y CLS siguen siendo los `guard:*` de navegador, fuera de la tanda. **Cobertura de
  montaje al 100 %, no cobertura visual completa** — y la diferencia importa.
* **`src/` y `public/` intactos:** las vistas se leen, no se tocan. La vista sintética del control
  se borra en `finally` y el test comprueba que el árbol queda como estaba.

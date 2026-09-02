# SCRUM-670 · Un solo extractor de los `<script>` del índice

**Fecha:** 2-sep-2026 · **Carril:** higiene de guards · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `c438ffa168657c5e0fd160429abb529716f3b5be` · 2026-09-02T14:05:00Z

> SCRUM-662 unificó la LISTA de scripts del dashboard —quiénes son— y cerró una clase entera de
> conflictos de merge. Este ticket unifica la LECTURA. Mientras haya seis lecturas del mismo
> fichero, la lista de uno no es la lista de otro y el problema sólo cambia de forma.

---

## 1 · PASO 0

### ENTRADA

**No hay entrada de usuario: este ticket no toca producto.** Y conviene decirlo con esas palabras
en vez de inventar una pantalla.

La **víctima no es un profesional de hoy: es la próxima vista que alguien añada.** Su «entrada» es
`public/dashboard/index.html`, y lo que le pasa al llegar depende de qué extractor la lea.

### MECANISMO · existe, y ése era el problema — existía SEIS veces

| quién lee `index.html` | con qué regex | para qué |
| --- | --- | --- |
| `tests/_banco-vistas.mjs` | `<script src="./X"></script>` | cargar y ejecutar las vistas |
| `tests/dashboard-colision-declaraciones.test.mjs` | `<script src="./js/X"></script>` | orden de carga y choques de declaraciones |
| `tests/scrum274-shell-alineado.test.mjs` | `<script[^>]+src\s*=\s*"X"` | atar el SHELL de `sw.js` al índice |
| `tests/scrum274-huella-estaticos.test.mjs` | un **recuento** `<script[^>]+src\s*=` | suelo del sellado con huella |
| `tests/scrum301-albaranes-seccion.test.mjs` | ambas comillas, sin comentarios | que la vista de albaranes esté cableada |
| `tests/_carga-de-pagina.mjs` | ambas comillas, sin comentarios | qué carga cada una de las nueve páginas |

El motor existía por sextuplicado. **El trabajo no era construir: era dejar UNO.**

---

## 2 · La tabla que lo decidió

Medida el 2-sep-2026 **antes de escribir una línea**. Cada columna es un extractor; cada fila, una
forma de `<script>` que el navegador acepta sin rechistar:

| forma | banco | colisión | shell | huella | scrum301 | carga-pág | **debe ser** |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| normal | 1 | 1 | 1 | 1 | 1 | 1 | **1** |
| `defer` | 0 | 0 | 1 | 1 | 1 | 1 | **1** |
| `defer` delante del `src` | 0 | 0 | 1 | 1 | 1 | 1 | **1** |
| un atributo de más | 0 | 0 | 1 | 1 | 1 | 1 | **1** |
| espacio antes del `>` | 0 | 0 | 1 | 1 | 1 | 1 | **1** |
| partida en dos líneas | 0 | 0 | 1 | 1 | 1 | 1 | **1** |
| comillas simples | 0 | 0 | 0 | 1 | 1 | 1 | **1** |
| `type="module"` | 0 | 0 | 1 | 1 | 1 | 1 | *aparte* |
| remoto (`https://…`) | 0 | 0 | 1 | 1 | 1 | 1 | *aparte* |
| **COMENTADO** (no se carga) | 1 | 1 | 1 | 1 | 0 | 0 | **0** |
| inline (sin `src`) | 0 | 0 | 0 | 0 | 0 | 0 | **0** |

**Dos filas hacen daño, y en direcciones opuestas:**

* **`defer` y compañía.** El banco de vistas y el guard de colisiones ven **0**. Esa vista deja de
  cargarse y de vigilarse **en silencio**, mientras el guard del shell sí la ve y la exige en
  `sw.js`. No es hipótesis: **SCRUM-559 midió que `defer` en UNO solo dejaba 16/16 en verde** con
  ese fichero fuera de toda vigilancia. Aquel ticket arregló el síntoma (umbral → recuento
  exacto); la causa es esta regex.
* **COMENTADO — hallazgo nuevo de este ticket.** Cuatro de los seis lo cuentan, y el navegador
  **no lo carga**: el banco intentaría ejecutar un fichero que nadie pide y el guard del shell lo
  exigiría en el precache. SCRUM-301 ya lo había medido en rojo por su cuenta («comentar la
  etiqueta la dejaba en verde») y era uno de los dos que acertaban.

Y una tercera lección de forma: ante **comillas simples**, tres extractores daban cero **a la vez**.
Un cero unánime parece una confirmación y es el síntoma.

---

## 3 · Qué se construyó

`tests/_scripts-de-la-pagina.mjs` — **el único sitio del repo donde se lee un `<script>`**.

`scriptsDeLaPagina(html)` es **pura** (no lee disco, para que sus controles se ejerciten con
corpus sintético) y clasifica en vez de devolver una lista plana:

| cubo | qué es | por qué separado |
| --- | --- | --- |
| `clasicos` | `src` local sin `type=module`, **en orden** | la población de verdad |
| `modulos` | `type="module"` | **no comparten ámbito global**: meterlos en el guard de colisiones lo haría acusar en falso |
| `remotos` | `https://…`, `//…` | ni se cargan en el banco ni se precachean |
| `aplazados` | `defer` / `async` | el navegador **no** los ejecuta en el orden del documento; el banco sí lo haría |
| `inline` | `<script>` sin `src` | no es población |
| `ilegibles` | apertura **con `src`** que no se sabe leer | **ceguera declarada**, no un total menor |

`cegueraDelExtractor(res, minimo, donde)` junta los dos modos de callar que esto existe para
impedir: **no ver** población donde debe haberla, y **no saber leer** algo y contarlo de menos.
Ambos devuelven un rojo que NOMBRA.

**Los seis consumidores derivan de él y ninguno conserva regex propia**, con trinquete por AST
(`grep` se cazaría a sí mismo: SCRUM-176/168).

### Decisiones de forma, y por qué

* **Se unificó hacia el extractor ANCHO, no hacia el estrecho.** Unificar hacia abajo habría
  vuelto ciego al guard del shell, que hoy sí ve el `defer`. Ensanchar no cambia la población de
  hoy —**71 antes y 71 después**— sólo deja de perder la de mañana.
* **`src` sin comillas** (`<script src=./js/x.js>`, HTML válido) también se lee: no lo veía
  **ninguno** de los seis.
* **`type="module"` sale de los clásicos.** Hoy hay 0; el día que entre el primero, un test lo
  dice con su motivo en vez de que se cuele y cambie lo que miden tres guards a la vez.

---

## 4 · Evidencia

### Rojo POR EL MECANISMO, sobre el índice REAL (mutación + post-condición)

Commiteado en verde antes de mutar; cada mutación revertida con `git status` vacío como
post-condición.

| mutación sobre `index.html` | resultado | qué habrían visto las regex viejas |
| --- | --- | --- |
| `defer` en `exportView.js` | los 3 consumidores lo **siguen viendo** (37 pass); sólo salta el aviso «ha entrado un `<script defer>`» | banco **69** · colisión **69** · shell **70** — los dos primeros lo perdían |
| etiqueta partida en dos líneas | **38 pass, 0 fail** | banco **69** |
| comillas simples | **38 pass, 0 fail** | banco **69** · colisión **69** · shell **69** — **los tres a la vez** |
| `<script>` COMENTADO | **4 guards caen nombrando `exportView.js`** («FALTAN en el índice», «EL SHELL PRECACHEA SCRIPTS QUE EL DASHBOARD YA NO CARGA») | banco **70** · shell **70** — lo seguían contando |
| `<script src>` sin valor (ilegible) | **3 guards caen**: «EL EXTRACTOR NO SABE LEER ESTAS ETIQUETAS, y llevan `src`: `<script src>`» | se habría contado como inline y el total habría bajado en silencio |

La última fila es el **ROJO 3** del carril: ante una forma desconocida el guard **cae nombrándola**;
lo que no puede pasar —devolver un número menor y callarse— ya no es expresable.

### Suelo

* Con **cero** población, `cegueraDelExtractor` devuelve «EXTRACTOR CIEGO» diciendo cuántos
  esperaba. Y su **suelo del suelo**: con la población buena no acusa, para que no sea un rojo
  permanente ni un `null` constante.
* El trinquete por AST exige encontrar la regex del canónico: si no ve **ninguna** en ningún sitio,
  «nadie la duplica» sería cierto por ceguera.

### Control negativo

**Reordenar los `<script>` del índice no toca la población.** Se reordena el marcado de verdad
—cada etiqueta por la de la posición simétrica—, no una lista en memoria.

🔴 **Y este control me mordió al probarlo, así que queda escrito:** reordenando el HTML **crudo**,
una etiqueta COMENTADA entra en el baile y sale de dentro del comentario; entonces la población sí
cambia y el control caería acusando de algo que no ha pasado. Se reordena sobre el marcado **sin
comentarios**. Un negativo que se rompe con un `<!-- -->` en el índice es un futuro rojo por nada.

### Verde

`npm test` completo **después del último cambio**, worktree limpio, `main` mezclado dentro, Prisma
regenerado y `dist/` reconstruido desde este worktree. `npm run guards:entrada` verde.

---

## 5 · La línea gratis: el comentario de `sw.js`

Pedía añadir los scripts al SHELL «en el mismo orden que el HTML». **Medido: falso.** Las dos
listas coinciden en los **71** nombres —cero faltan, cero sobran, cero duplicados— y **difieren en
9 posiciones**; la primera es la 34, `albaranActionsRegistry.js` en el índice donde el SHELL tiene
`invoiceDetailView.js`.

Y da igual, que es lo que había que escribir: **el precache descarga, no ejecuta.** El orden de
ejecución lo fijan las dependencias declaradas del índice.

> El «71» se **remidió** después de mezclar `main`: cuando lo medí por primera vez eran 70, y
> `main` trajo `quoteApartados.js` y `jobNuevoModal.js` en medio. Un derivado no se hereda de un
> informe propio de hace una hora, ni siquiera del mío.

---

## 6 · Huecos declarados

* **`tests/scrum214-semaforo-sin-llamadores.test.mjs` NO se ha reconectado**, a propósito: su
  `assert.match(index, /<script src="\.\/js\/semaforoFiscal\.js"><\/script>/)` pregunta por **un
  fichero concreto**, no por la población, y su otra regex extrae los `<script>` **inline**, que es
  otra pregunta. Queda el mismo riesgo de forma —un `defer` ahí lo haría fallar—, pero es un falso
  **rojo**, no un falso verde: ruidoso, no silencioso. Fuera del carril de hoy.
* **`recursosDe` de `_carga-de-pagina.mjs` sigue leyendo los `<link .css>` con regex propia.** Este
  ticket es de `<script>`; las hojas tienen el mismo patrón de riesgo y nadie lo ha medido.
* **El extractor no parsea HTML**: un `>` dentro del valor de un atributo cortaría la apertura. No
  se ha visto en el árbol y añadir un parser sería una dependencia nueva (regla 36). Si aparece,
  cae en `ilegibles` en vez de contarse de menos, que es el modo de fallo que se eligió.

---

## 7 · Trinquete de SCRUM-553 · `TOPE` 23 → 21

Este ticket retira las dos últimas regex con el `>` **pegado** que quedaban en los extractores del
índice (`tests/_banco-vistas.mjs` y `tests/dashboard-colision-declaraciones.test.mjs`). El propio
trinquete lo pidió con estas palabras: «han bajado a 21, baja `TOPE` a ese número». **Baja por
ARREGLO, no por medición**, y es el mismo defecto que ese fichero existe para frenar, cazado en su
versión más cara.

---

## Tests que introduce esta entrada

* `tests/scrum670-un-solo-extractor.test.mjs` — 12 pruebas: las ocho formas que el navegador carga,
  los tres rojos del carril (`defer` y partido **end-to-end sobre `scriptsDelDashboard`**, comillas
  simples, ilegible), el comentado, el reparto en cubos, los dos suelos, el estado de hoy del
  índice, el negativo de reordenación y el trinquete por AST.
* `tests/_scripts-de-la-pagina.mjs` — `scriptsDeLaPagina`, `rutaDelDashboard`,
  `cegueraDelExtractor`, `sinComentarios`.

---

# SCRUM-670 · Tres regex leían el mismo índice y coincidían por casualidad

**Fecha:** 2-sep-2026 · **Carril:** higiene de guards · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `283143b4701f75835888e82c25f41ad34e916655` · 2026-09-02T15:40:00+02:00

> ⚠️ **Este ticket se hizo DOS VECES a la vez.** La entrada de arriba es la que entró en `main`
> y la que gobierna; ésta es la medición de la otra rama, que llegó a la misma causa por su
> cuenta. Se conservan las dos porque **los números y los casos no son los mismos**, y dos
> mediciones independientes que coinciden en el diagnóstico valen más que una.
>
> **Lo que NO se conserva es el código**: el extractor de esta rama
> (`tests/_scripts-del-indice.mjs`) y su test se han retirado en el merge. Mantener dos fuentes
> únicas habría sido reproducir el defecto del ticket una capa más arriba — y la de `main` es
> más completa: separa clásicos de `type="module"` (que NO comparten ámbito global, así que el
> guard de colisiones no debe mirarlos), anota `defer`/`async`, y distingue «no tiene src» de
> «hay un src que no sé leer».

## 1 · Las tres, con fichero y línea, y qué considera cada una «un script»

| dónde | patrón | qué exige |
| --- | --- | --- |
| `tests/dashboard-colision-declaraciones.test.mjs:40` | `/<script src="\.\/js\/([^"]+)"><\/script>/g` | `src` **lo primero**, ruta `./js/`, comillas dobles y `</script>` **pegado** |
| `tests/_banco-vistas.mjs:323` | `/<script src="\.\/([^"]+)"><\/script>/g` | lo mismo, sin exigir `js/` |
| `tests/scrum274-shell-alineado.test.mjs:115` | `/<script[^>]+src\s*=\s*"([^"]+)"/gi` | admite atributos antes del `src`; **no** mira el cierre; comillas dobles |

Y una cuarta que solo cuenta: `tests/scrum274-huella-estaticos.test.mjs:56` — `/<script[^>]+src\s*=/gi`.
Buscando por el árbol apareció **una quinta**: `tests/scrum301-albaranes-seccion.test.mjs:341`, con
comillas simples admitidas; y una sexta comprobación de presencia en
`tests/scrum214-semaforo-sin-llamadores.test.mjs:130`.

**Sobre el índice de hoy las cuatro dan 71.** No están de acuerdo: **el índice está escrito de una
sola manera**.

## 2 · La divergencia, con el caso real escrito

```
<script src="./js/pruebaDefer.js" defer></script>

  71  dashboard-colision   🔴 NO lo ve
  71  _banco-vistas        🔴 NO lo ve
  72  scrum274-shell       sí
  72  scrum274-huella      sí
```

Y lo que se rompe no es un número: **el guard de colisiones deja de parsear ese fichero** y sigue
diciendo «cero colisiones», mientras el del service worker sí lo exige en el precache.

### 🔴 Pero el caso peor no es `defer`: es el CERO UNÁNIME

```
<script src='./js/soloYo.js'></script>      →   0  ·  0  ·  0
```

Con `defer` las tres **discrepan**, y una discrepancia se acaba viendo. Con **comillas simples** las
tres coinciden **en cero**: tres extractores independientes de acuerdo en que ahí no hay ningún
script, con el script delante.

> **Un cero unánime es el resultado más convincente y más falso que puede dar este sistema.** Nadie
> duda de un consenso.

Es la causa de lo que SCRUM-559 trató como síntoma: allí un `defer` en un solo script dejaba 16/16
en verde con ese fichero fuera de toda vigilancia, y se subieron los umbrales a recuento exacto.
El recuento exacto no salva del cero unánime.

## 3 · Una sola fuente — y no una cuarta regex

`tests/_scripts-del-indice.mjs`. **Si tres expresiones regulares sobre el mismo fichero divergen, el
arreglo no es escribir la definitiva: es dejar de leer HTML con expresiones regulares.**

Es un **recorrido de caracteres** de la etiqueta `<script>`: lee el nombre, recorre los atributos,
respeta comillas dobles, simples o ninguna, y termina en el `>` sin comillas abiertas. De ahí salen
gratis cinco cosas que antes eran casos especiales:

- el `src` en cualquier posición entre los atributos;
- `defer`, `async`, `type` y cualquier atributo suelto;
- la etiqueta **partida en varias líneas**;
- comillas simples o sin comillas;
- no hace falta que `</script>` vaya pegado, ni que exista.

**Seis lectores, una fuente.** Los cuatro extractores, el de `scrum301` y la comprobación de
presencia de `scrum214` preguntan ya a la misma función. Y la lista de SCRUM-662 se contrasta contra
**ese** extractor: si no, el problema solo cambiaba de forma.

## 4 · El suelo de ceguera, en la fuente

`scriptsDelIndiceOFalla` **lanza** si la lista sale vacía, y el mensaje lo dice: *un cero no es «no
hay scripts», es «no supe leerlo»*. Va en la fuente y no en cada consumidor, para que ninguno tenga
que acordarse.

Y el contraste que lo hace útil: sobre el documento de **comillas simples** —donde las tres regex
dan cero— el suelo **no** se dispara, porque ahí sí hay un script y la fuente lo ve. Un suelo que
salta con datos buenos acaba desactivado.

## 5 · Un trinquete para la cuarta regex

Si mañana alguien vuelve a escribirse la suya sobre este índice, cae **nombrado**. Se mira el código
sin comentarios, línea a línea, y **no** cuenta el extractor de scripts EN LÍNEA (`(?![^>]*\bsrc=)`)
— ésa es otra población, la de los `<script>` sin `src`, y la pregunta es distinta. No es una
exención por fichero.

Mi primera versión del detector acusó a **cinco**, y tres eran falsos: miraba el fichero entero, así
que marcaba a quien hace un `replace` con una cadena literal (`scrum378`) o a quien escribe «<script
src» dentro de un mensaje de error (los dos de `scrum274`). Un detector que acusa a los sanos se
desactiva.

## 6 · El trinquete que BAJA

`SCRUM-553` (etiquetas con el `>` pegado): **23 → 22**. Bajan al llevar los lectores a la fuente
única — las regex que exigían `></script>` pegado eran justo las que perdían el `defer` y las
comillas simples. Se ajusta en el mismo commit que lo arregla.

## 7 · Lo que NO se ha tocado

El **orden** de los scripts en el índice (hay dependencias declaradas) · `prisma/schema.prisma` ·
`scripts/guards-visuales.mjs`.
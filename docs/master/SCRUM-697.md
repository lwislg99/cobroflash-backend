# SCRUM-697 · El banco de vistas contaba dos veces el mismo nodo

**Fecha:** 2-sep-2026 · **Carril:** banco de vistas (tests) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `21a1920ba82e04be66cc8fd98c0d04d36066b845` · 2026-09-02T23:49:23+01:00

**Tanda:** **4.821 pruebas · 4.737 en verde · 0 fallos · 84 saltadas** — con `main` ya mergeado
dentro, medida DESPUÉS del último cambio de código **y en esta máquina**, que es un matiz que
este ticket aprendió por las malas (ver abajo).

---

## 🔴 LO PRIMERO: EL DEFECTO NO ERA EL QUE PONÍA EN EL TICKET

El hallazgo —mío, del cierre de SCRUM-584— decía: *«el banco pinta la vista de clientes DOS
VECES en una sola llamada: 16 `<th>` para 8 columnas»*. **Se midió antes de tocar nada, y era
otra cosa.**

| lo que se midió | resultado |
|---|---|
| ¿el banco llama dos veces a la vista? | **no** — instrumentada, `llamadas = 1` |
| ¿la vista se repinta sola al cargar? | **no** — crea **una** tabla |
| ¿hay dos tablas? | **no**: `tablas[0] === tablas[1]` da **`true`** |

**Eran el MISMO NODO, recorrido dos veces.** Y eso cambiaba de quién era el ticket: no había que
parar a preguntar por producto, porque **en el navegador de un profesional no pasa nada de esto**.

## PASO 0

**ENTRADA.** No hay entrada de usuario: esto no está en ninguna pantalla. Se llega por
`tests/_banco-vistas.mjs` → `pintarVista(banco, 'renderCustomersView')` → `todos(contenedor)`,
que es como cuentan las sesiones. Se dice con esas palabras porque **la víctima no es un
profesional: son las mediciones**.

**MECANISMO — existía, y estaba incompleto en un punto.** El banco ya tenía las cuatro
inserciones (`appendChild`, `append`, `insertBefore`, `prepend`), `removeChild` que desregistra
el id, `parentNode`, `children` y `remove()`. Lo que **no** tenía es que **insertar MUEVE**.

## La causa, en una frase

En el navegador, `appendChild` **desengancha** el nodo de donde estuviera: un nodo está en un
sitio, no en dos. Aquí las cuatro inserciones sólo hacían `push`/`unshift` y reasignaban
`_padre`, así que el nodo quedaba en **las dos listas de hijos a la vez** y todo recorrido pasaba
dos veces por él y por toda su descendencia.

Lo destapa `customersView`, que hace **DOM de manual perfectamente legítimo**: mete la tabla en
el `table-scroll` (l. 183) y luego la mueve al `data-card` (l. 207). Medido: **60 nodos recorridos
para 41 distintos — 19 de más**, y de ahí salían los «16 `<th>` para 8 columnas».

## 🔴 Por qué no es cosmética

**No producía rojos falsos: producía MEDICIONES falsas**, que es de donde salen los verdes
falsos. Tres sesiones han contado hoy sobre esa vista. Y el modo de fallo más probable era el
peor de todos: **alguien ve un test pedir 8, lo ve caer con 16, y lo «arregla» poniendo 16** —
fosilizando el defecto **dentro de la aserción**, donde ya no parece un defecto sino una
constante.

Por eso el arreglo va **en el banco** y no se rodea desde la vista ni desde el test. Es lo que
ese fichero lleva escrito desde SCRUM-444: *«un banco infiel hace que el test mida el banco y no
el producto»*.

## ⚠️ La trampa del arreglo, y por qué tiene test propio

Desenganchar **no puede hacerse con `removeChild`**, aunque parezca lo mismo: `removeChild`
**desregistra el id** a propósito (SCRUM-444), porque en el navegador `getElementById` no
encuentra lo que ya no está en el documento. Pero **mover no es quitar**: el nodo sigue en el
documento. Si el desenganche borrase el id, **toda vista que mueva un nodo con id lo perdería en
silencio** — un defecto peor que el que se venía a quitar.

Se desengancha **por identidad** y sin tocar `reg.porId`. Y hay un test que fija las dos mitades:
mover **no** borra el id, y `removeChild` **sí** lo sigue borrando.

## El censo: ¿una vista o todas?

**Sin lista a mano** — las vistas se derivan de lo que el banco publica, porque una lista
envejece el día que entra una vista nueva y nadie se entera de que no está vigilada.

| | |
|---|---|
| vistas publicadas | **24** |
| con nodos contados de más | **1** (`renderCustomersView`) |
| que no llegan a montarse | **6**, por huecos ajenos a este ticket — se declaran, no se esconden |

**Es un caso; la causa es del banco.** Se arregla en el banco, y las cuatro inserciones a la vez:
si sólo se corrigiera `appendChild`, la próxima vista que use `prepend` traería el mismo síntoma
con otra cara y costaría otro ticket entenderlo.

## El fan-out, medido y no supuesto

Se guardó el **TAP entero antes** de tocar una línea y se comparó con el de después, test a test:

| | |
|---|---|
| cambiados de estado | **0** |
| perdidos | **0** |
| nuevos | **9** (los de este ticket) |

**Ningún test dependía del número duplicado**, así que no hay ninguno que «ajustar» — que era el
riesgo explícito del encargo.

## El rojo, probado por el mecanismo — cuatro mutaciones con post-condición

Cada mutación comprueba que ha cambiado **ese** fichero y a **esa** línea antes de creerse el rojo.

| se rompe a propósito | cae |
|---|---|
| se le quita el desenganche a `appendChild` (el defecto original, tal cual) | «recorre CADA NODO UNA VEZ», «da 1, no 2», el censo **y** «`appendChild` MUEVE» |
| se le quita **sólo a `prepend`** (la cara que aún no había aparecido) | «`insertBefore`, `append` y `prepend` mueven IGUAL» |
| se desengancha **con `removeChild`** | «mover un nodo NO le borra el `id`» |
| el desenganche compara por **parecido** en vez de por identidad | «no se lleva a sus hermanos por delante» |

### 🔴 Y una mutación encontró un defecto EN MI PROPIO TEST

La cuarta **no caía**. El motivo: el control negativo ponía dos hermanos **nuevos** en un padre y
comprobaba que seguían siendo dos — pero `desengancha` sólo actúa cuando el nodo **ya tiene
padre**, así que aquella versión **no llegaba a ejecutar el filtro**. Era una regla que siempre
pasa. Ahora el nodo que se mueve viene **con padre y con un hermano igual al lado**, que es el
caso en el que un filtro por parecido se llevaría por delante a quien nadie tocó. Con esa
mutación, cae.

## El control positivo, y va primero

Si tras el arreglo el recuento de tablas bajara a **0**, no se habría quitado un duplicado: se
habría roto el montaje. «No hay duplicados» es verdad en un contenedor vacío, así que sin este
test el del defecto no probaría nada. Se comprueba que la vista **se monta**, que produce más de
20 nodos y que la cabecera «Teléfono» **está**.

## Una decisión que hubo que tomar: los rechazos huérfanos

`reportsView` falla **dentro de un `async` que nadie espera** (pide datos que el banco no sirve),
y ese rechazo **tumba el proceso entero**: una sola vista sin alimentar impedía censar las otras
veintitrés. **Es preexistente** — el mismo `TypeError` mató la primera medición de este ticket,
antes de tocar una línea del banco.

No se pudo resolver envolviendo la vista, porque la promesa que rechaza **no pasa por
`pintarVista`**. Se apartan los oyentes de rechazo **mientras dura el censo** y se devuelven en
un `finally`, **apuntando cada rechazo** y declarándolo con un tope. Lo que se aparta es el
veredicto automático del runner, no la medición — y hay un aserto que comprueba que **los
oyentes se devuelven**, porque si no, a partir de ahí un fallo async de cualquier otro test
pasaría desapercibido.

---

## 🔴 EL SUELO NO SE SUBE, Y NO ES UN OLVIDO

Este ticket subió el suelo a **4814** y **el CI de su propio PR lo tumbó**: *4805 corridos contra
un suelo de 4814*, con **cero `fail`**. Nueve tests desaparecidos, tanda verde. Era la primera vez
que ese guard cantaba de verdad, y cantó en el caso exacto para el que se construyó.

**Se midió antes de tocar el número**, con la misma técnica que este ticket usó para el fan-out:
TAP entero de `main` solo contra TAP entero de `main` + esta rama, nombre a nombre.

| | ejecuciones | nombres únicos |
|---|---|---|
| `main` solo | **4812** | 4796 |
| `main` + esta rama | **4821** | 4805 |

**Tests de `main` que faltan en el mezclado: CERO.** Los nueve que aparecen son los nueve de este
ticket. **4812 + 9 = 4821, exacto.**

Y eso descarta las tres causas que el propio guard enumera —fichero renombrado, `import` a vacío,
tests borrados— y también la cuarta que se propuso: **si algún test generase casos a partir de lo
que recorre el banco, el mezclado habría dado MENOS de `main`+9**, y da exactamente `main`+9. El
arreglo de este ticket no le ha quitado casos a nadie.

#### Lo que era: el suelo se declara donde no se evalúa

Sobre **el mismo árbol**, esta máquina (Windows) cuenta **4814** y el runner (Ubuntu) cuenta
**4805**. Nueve de diferencia que son **de entorno, no de cobertura**.

Medido y descartado por el camino: `LIBRO_PG_URL` usa `{ skip: … }`, así que sus tests **se crean
igual** y no cambian el recuento; y correr con `CI=true GITHUB_ACTIONS=true` da **4821 igual**. De
dónde salen exactamente los nueve **no está demostrado** y por eso no se escribe aquí como dato:
haría falta el TAP del runner, que el CI guarda como artefacto `tanda-tap`.

Y no es un descubrimiento de hoy — estaba escrito en el repo, en
`tests/scrum476-reconciliar-censos.test.mjs:78-80`:

> *«el mismo género de defecto que **tumbó el suelo en el CI**: dar por universal algo que es de
> esta máquina.»*

Es la **regla 3** —el entorno no es un sujeto válido— aplicada a un guard.

#### Por qué queda en 4798, el de `main`

**El suelo es un MÍNIMO, no un espejo del total.** Subirlo es opcional y no obliga a nada: esta
rama **añade** nueve tests, así que el total sube y el 4798 de `main` sigue siendo cierto. Con eso
el PR pasa **sin apagar ninguna alarma** y sin escribir un número que hoy no sabemos medir.

🔴 **Y la lección, que es lo que hay que llevarse:** 4766 y 4798 pasaron **porque tenían holgura,
no porque estuvieran bien medidos**. Este ticket lo dejó a **margen 0** y se comió el colchón. La
próxima sesión que lo suba a ras se lleva el mismo mordisco. **El problema no es el número: es
dónde se mide el suelo** — y eso es un ticket aparte, no éste.

> El fichero queda **byte a byte** como en `main`, y eso se comprueba por el **sha del blob**
> (`6081c7e3c63f7f7acf9a26ad57be8356c0b941ca` en los dos lados), no leyéndolo por encima.

## Ficheros

`tests/_banco-vistas.mjs` (la función `desengancha` y las cuatro inserciones) ·
`tests/scrum697-un-solo-render.test.mjs` (**nuevo**, 9 tests) ·
esta entrada. **`scripts/_suelo-de-la-tanda.mjs` NO se toca** — y el porqué está abajo.

**No se ha tocado:** ningún fichero de producto — ni `customersView.js`, ni CSS, ni rutas ·
`prisma/schema.prisma` · ningún test existente se ha «ajustado» a un número · sin dependencias
nuevas (regla 36).

## Estado del árbol

* Rama nacida de `origin/main`, sin apilar sobre nada.
* `npm run guards:entrada` en verde. Cero CR en disco (medido por BYTES).
* **El suelo queda como en `main` (4798), sin tocar** — comprobado por sha del blob. El porqué
  está arriba: no es un olvido.

## Los huecos que declaro

1. **No he comprobado en navegador real** que la tabla acabe donde el arreglo dice. Es DOM
   estándar y el banco ahora lo imita, pero la afirmación «en el navegador `appendChild` mueve»
   la tomo del estándar, no de una medición mía en Chrome.
2. **Las 6 vistas que no se montan siguen sin medirse.** El censo las declara y vigila que no
   crezcan, pero de esas seis no puede afirmar que no repitan nodos.
3. **La comparación del fan-out es por NOMBRE de test**, y hay nombres repetidos entre ficheros
   (4767 nombres únicos para 4783 tests). Un cambio de estado en dos tests homónimos que se
   compensaran no se vería; que salgan 0 cambiados y 0 perdidos lo hace muy improbable, pero es
   una limitación del instrumento y no de la medida.
4. **No he medido si otros bancos** (`_censo-…`, los de HTML) tienen el mismo hueco. Este ticket
   es del banco de vistas.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `customersView.js` mete la tabla en el `div.table-scroll` (l. 183) y acto seguido la MUEVE al `data-card` (l. 207), así que el envoltorio de scroll queda vacío y la tabla acaba fuera de él: en el navegador el `table-scroll` no envuelve nada.
* Seis vistas del panel (`renderAlbaranDetailView`, `renderPlansView`, `renderQuoteRequestsView`, `renderSettingsView`, `renderTeamView`, `renderTemplatesView`) no llegan a montarse en el banco por datos que dan por hechos, así que hoy ninguna medición del banco puede afirmar nada sobre ellas.
* `renderReportsView` dispara su carga sin esperarla, y su rechazo huérfano tumba el proceso entero de cualquier test que la monte junto a otras.

# SCRUM-764 · El margen negativo se ve

**Fecha:** 6-sep-2026 · **Carril:** producto / catálogo (CAT-01) · **Gate:** sin gate — aritmética sin DOM, AST y lectura de CSS; las medidas de píxel y color son de navegador, fuera de `npm test`
**Medido contra:** `origin/main` = `50312d327c0f7ddcf8a0670ab54c46407a7bba9d` · 2026-09-06T22:36:05+01:00
**Tanda:** 5723 tests, 5621 pass, 0 fail, 102 skipped (salida 0)

`margenDesde(150, 100)` devuelve **−50** y la ficha del catálogo lo enseñaba con la misma tinta que
un 30 %. El profesional coge un artículo, el precio final queda por debajo del coste, y nada en la
pantalla se lo dice: firma perdiendo dinero y se entera al facturar.

---

## 1. El rojo, provocado en la pantalla y no en la función

Navegador real (Edge), CSS real, los **84 scripts** del dashboard en su orden real —la lista se
deriva de `public/dashboard/index.html`, no se escribe a mano— y la ficha abierta pulsando
«Editar» en su fila, como el profesional. Lo único simulado es `fetch`.

| artículo | coste / precio | margen que ve | color del texto | fondo | borde | avisos |
|---|---|---|---|---|---|---|
| Termo 80 L | 70 / 100 | `30` | `rgb(15,28,23)` | `rgb(255,255,255)` | `rgb(231,233,229)` | — |
| **Caldera de gas** | **150 / 100** | **`-50`** | `rgb(15,28,23)` | `rgb(255,255,255)` | `rgb(231,233,229)` | — |
| Detector de humos | 300 / 1000 | `70` | `rgb(15,28,23)` | `rgb(255,255,255)` | `rgb(231,233,229)` | — |
| Mano de obra | — / 45 | *(vacío)* | `rgb(15,28,23)` | `rgb(255,255,255)` | `rgb(231,233,229)` | — |

Y el texto visible de la ficha era **la misma cadena en los cuatro**:

```
Editar producto ? × Esto es Producto Servicio Nombre * Precio * Coste Margen %
Proveedor — Sin proveedor — Descripción Cancelar Guardar
```

**Confirmado: la ficha no dice nada.** La premisa del ticket resiste, y ahora es una medida.
La lista tampoco: pinta precio y coste (`Caldera de gas — 100,00 € — 150,00 €`) pero no margen.

> **Dos instrumentos se descartaron por el camino, y se dice por qué.** El banco de vistas monta
> la pantalla y encuentra la fila, pero **no puede abrir esta ficha**: `cablearTipoArticulo` pone
> `name` como CAMPO y no como atributo, y el matcher de SCRUM-634 se planta a propósito. No es un
> defecto de producto y no se tocó `_banco-vistas.mjs`, que es compartido. Y el primer intento en
> navegador cargaba los scripts en una página sintética: uno de los 84 reescribe el `body` y
> `#app` desaparecía. Se fue a la página de verdad.

---

## 2. El censo: ¿el margen vive en un sitio o en cuatro?

Por AST sobre el árbol entero (**1.392 ficheros** `.js`/`.mjs`/`.ts`, sin `tests/` ni `scripts/`),
con tres preguntas distintas porque un margen puede vivir de tres maneras: la **aritmética** (una
división cuyo numerador es una resta), el **cableado** (llamadas a `margenDesde`/`precioDesde`/
`autocompletar`) y la **pintura** (literales que dicen «margen»).

**El cableado da DOS ficheros y sólo dos:** `margenCatalogo.js` (él mismo) y `productsView.js`, con
dos llamadas — `:386` al abrir la ficha y `:519` en el autocompletado. **El margen del catálogo
vive en un sitio.**

La pintura da once, y ahí es donde había que mirar con cuidado, porque la palabra se comparte:

| dónde | qué margen es | ¿el mismo? |
|---|---|---|
| `quoteMargen.js` (SCRUM-229) | el **markup** sobre el precio base de la línea | **No.** Su propio comentario lo dice: *«NO es beneficio real ni coste por línea — fuera de alcance por decisión explícita del fundador»* |
| `quotesDetailView.js` | ingresos − gastos del trabajo, calculado en el servidor | No: otra magnitud, otro origen |
| `reportsView.js` | beneficio/ingresos por mes | No |
| `exportView.js`, `plansView.js` | rótulos | No |

Y la pregunta (A), la de la forma aritmética, resultó **ruido**: casa con cualquier `(a−b)/c`,
fechas incluidas (`(now − createdAt) / 86_400_000`). Se declara como lo que es —un suelo, no una
respuesta—; quien decidió fue el cableado.

**Conclusión: no son cuatro. Es uno, y el arreglo va en la ficha.**

---

## 3. La decisión: se AVISA, no se impide — y el tratamiento ya estaba decidido

**No se rechaza.** Vender por debajo del coste es una decisión legítima del profesional: una oferta
gancho, un trabajo que se quiere ganar. Rechazarlo dejaría catálogos reales sin poder guardarse,
que es exactamente el motivo por el que el coste **no** es obligatorio (SCRUM-609 midió 8 de 8
productos de desarrollo sin coste). Es un **ÁMBAR**, no un rojo irreversible: la doctrina de la
casa dice que un ámbar jamás se bloquea — se avisa.

**Se avisa pintándolo en rojo.** El daño no es el número: es que sea silencioso.

🔴 **Y el tratamiento NO se estrena aquí.** `quotesDetailView.js:947-961` ya pinta en rojo el
margen negativo del trabajo:

```js
const positive = data.margin >= 0;
const marginColor = positive ? 'var(--brand)' : 'var(--red-600)';
… background:${positive ? 'var(--brand-tint)' : 'var(--red-50)'}
```

Esto no propone una política nueva: **pone al catálogo de acuerdo con una que ya está en
producción.** Por eso no hace falta ni un texto nuevo (regla 30) y la obligación 4 va por su camino
feliz: sólo color. (`reportsView.js:243` hace lo mismo con el *beneficio*; su columna **Margen**,
en cambio, se queda neutra — se deja anotado, no se toca: es otro carril.)

---

## 4. Lo construido

| fichero | qué |
|---|---|
| `margenCatalogo.js` | `bajoCoste(margen)` — la REGLA, junto a la aritmética y sin DOM |
| `productsView.js` | `pintarMargen(campo)` + sus **tres** llamadas |
| `styles.css` | `.field input.catalogo-margen--bajo-coste` y su `:focus` |

**La regla vive en el módulo, no en la vista**, por lo mismo que la fórmula: si cada pantalla
decide qué cuenta como «va mal», acaban decidiéndolo distinto. Y `null` **no es «va mal», es «no se
sabe»**: sin coste no hay rojo, o un catálogo entero sin costes saldría avisando de algo que nadie
ha calculado.

**Tres llamadas y no una**, porque el campo cambia en tres sitios y en los tres puede quedarse
mintiendo: al **abrir** la ficha (el valor lo escribe la vista, no el teclado), en **`aplicar`**
del autocompletado —y siempre, no sólo al escribir, o un margen que pasa a positivo se queda rojo
para siempre— y al **limpiar** el alta, porque vaciar el campo no le quita la clase.

---

## 5. Los tres controles, medidos

### 🔴 EL QUE DECIDE — Caldera de gas, 150/100, margen −50

| | ANTES | DESPUÉS |
|---|---|---|
| clase | *(sin clase)* | `catalogo-margen--bajo-coste` |
| color del texto | `rgb(15,28,23)` | **`rgb(153,27,27)`** |
| fondo | `rgb(255,255,255)` | **`rgb(254,242,242)`** |
| borde | `rgb(231,233,229)` | **`rgb(220,38,38)`** |

### ✅ POSITIVO — un margen normal sigue igual

30 % y 70 % salen con `rgb(15,28,23)` sobre blanco y borde `rgb(231,233,229)`, **sin clase**:
idénticos a antes. «Mano de obra», sin coste y con el margen vacío, tampoco se marca.

En el formulario vivo, tecleando:

```
coste 150 + precio 100 -> margen "-50"   y lleva la clase: true
sube el precio a 200   -> margen "25"    el rojo SE QUITA:  true
margen TECLEADO a mano -30               se pinta igual:    true
vuelve a 40                              se despinta:       true
```

### ✅ NEGATIVO — el techo del imposible POR ARRIBA sigue vivo

```
precioDesde(150, 120) -> null      precioDesde(150, 100) -> null
precioDesde(150,  60) -> 375       margen 100 tecleado -> el precio NO se toca
```

---

## 6. AB6

- **Contraste.** El primer intento fue `--red-600` (= `--danger`, `#dc2626`) sobre `--red-50`, que
  es lo que hace `quotesDetailView`. Medido: **4,41**, y AA para texto normal pide **4,5**. Se
  quedaba corto. Allí funciona porque su cifra es texto grande (AA pide 3,0); aquí es un `<input>`
  de 15 px. Se cambió a **`--danger-ink`** (`#991b1b`), que ya está en `tokens.css` — ningún token
  nuevo — y da **7,6**. El medidor llevaba su control: negro sobre blanco = 21.
- **A 390 px la caja no se mueve:** `{w:324, h:44.5, x:33, y:632.55}` antes y después, byte a byte.
  El campo ya mide **44,5 px** de alto, así que cumple los 44 de AB6; la clase sólo cambia color,
  `border-color` y fondo, y no toca el grosor del borde.
- **El foco sigue viéndose:** hay regla `:focus` propia, porque el `border-color` rojo le ganaría
  al del anillo justo en el campo que avisa.
- `guard:objetivo-tactil` en verde tras el cambio (suelos 7 y 6).

---

## 7. Los tests, y el rojo de cada uno

Nueve, en `npm test`, sin gate. Y **cuatro mutaciones declaradas, las cuatro VIVAS** con la
maquinaria oficial (`meta-guard-mutaciones.mjs`).

| test | qué caza |
|---|---|
| `EL QUE DECIDE: 150/100 sale marcado` | el defecto del ticket, exacto |
| `cualquier margen negativo` | bordes derivados del criterio (`< 0`), no una lista |
| `POSITIVO: un margen normal NO se marca` | el aviso que sale siempre, que es no avisar. Y **el cero va aparte**: vender AL coste no es perder dinero |
| `«no se sabe» NO es «va mal»` | que un catálogo sin costes salga en rojo |
| `NEGATIVO: el techo por arriba` | que el suelo nuevo se coma el techo viejo |
| `la vista PINTA en los tres sitios` | por AST: que falte una de las tres llamadas |
| `la regla la decide el MÓDULO` | que la vista se copie el `< 0` y acaben decidiendo distinto |
| `EL QUE ME CAZÓ A MÍ: llega a AA` | el 4,41. Lee los tokens de `tokens.css`, no hexadecimales escritos en el test, y lleva **control negativo del umbral**: `--danger` tiene que SEGUIR sin pasar |
| `la clase existe en el CSS` | una clase que no pinta nada, y el `:focus` que falta |

### 🔴 Un hallazgo del contrato de mutaciones, y se deja escrito

La mutación evidente del control negativo —`if (m >= 100)` → `if (m >= 100000)`— salió **MUDA**. Y
la otra, `if (denom <= 0)`, **también**. No era que el test no mirara: **las dos guardas son
mutuamente redundantes** —para `m ≥ 100`, `1 − m/100` es siempre ≤ 0— así que ninguna mutación de
una sola línea puede tumbar el techo. La declarada quita **las dos a la vez**, que es la única
forma de que el defecto exista.

No se ha tocado el módulo: quitar una de las dos es un cambio que nadie ha pedido y la duplicidad
no hace daño. Queda dicho para que no se lea como cobertura de más.

---

## 8. Lo que este ticket NO ha tocado

Ningún literal (aquí sólo hay color). `quotesView` — SCRUM-794 acaba de mergearse y no se pisa.
El detector de sobrantes del guard táctil, que tiene su propio ticket. `_banco-vistas.mjs`, aunque
su hueco sea el que obligó a cambiar de instrumento. La columna **Margen** de `reportsView`, que se
queda neutra con beneficio negativo: es otro carril y se reporta, no se arregla (regla 9).
---
---

# APÉNDICE · La segunda pantalla: la columna Margen de Informes

**Fecha:** 6-sep-2026 (misma rama, reabierta) · **Gate:** sin gate
**Medido contra:** `origin/main` = `5af8e7e9cdcd15ac90eb9b8a1473737872b6625c` · 2026-09-06T23:20:04+01:00
**Tanda:** 5741 tests, 5639 pass, 0 fail, 102 skipped (salida 0)

> El apartado 8 de arriba decía que la columna Margen de `reportsView` se queda neutra con
> beneficio negativo, y que se reportaba sin arreglar. El asesor lo devuelve a esta misma rama:
> es el mismo defecto en otra pantalla, la decisión ya está firmada y el token ya existe.

## A1 · El rojo, provocado otra vez en la pantalla

Mismo instrumento que la ficha: Edge real, CSS real, los scripts del dashboard, y se llega a
Informes pulsando su botón del menú. Un año con meses buenos y malos en el mismo informe, para que
el control positivo y el que decide salgan del mismo montaje.

| mes | beneficio | color del beneficio | MARGEN | color del margen |
|---|---|---|---|---|
| Ene | 7.000,00 | `rgb(21,128,61)` verde | 70 % | `rgb(107,117,111)` gris |
| Feb | 2.400,00 | verde | 30 % | gris |
| **Mar** | **−2.000,00** | **`rgb(220,38,38)` ROJO** | **−50 %** | **`rgb(107,117,111)` GRIS** |
| Abr | 0,00 | verde | 0 % | gris |
| **May** | **−900,00** | **`rgb(220,38,38)` ROJO** | **−100 %** | **`rgb(107,117,111)` GRIS** |
| TOTAL | 6.500,00 | verde | 24 % | `rgb(51,60,55)` |

**Confirmado, y es peor que «neutra»:** el Beneficio **sí** avisa. En la fila de marzo hay un
número rojo justo al lado de un `−50 %` en gris, y un gris pegado a un rojo se lee como que ese
porcentaje está bien. El TOTAL del año no traía color ninguno.

## A2 · 🔴 Y sí: Informes calcula el margen POR SU CUENTA. Mi censo se quedó corto

`reportsView.js:242` hace `Math.round(m.profit / m.revenue * 100)` y **no usa
`margenCatalogo.js`**. O sea que en el árbol hay **dos** cálculos de margen porcentual, en vistas
distintas y con la misma convención —`(ingresos − gastos) / ingresos` es la misma forma que
`(precio − coste) / precio`—, cada uno por su lado.

**Por qué el censo del apartado 2 no lo vio, exactamente:**

- La pregunta **(B)** era «quién llama a `margenDesde`/`precioDesde`/`autocompletar`». Informes no
  llama a ninguna: se lo calcula. Invisible para esa pregunta **por construcción**.
- La pregunta **(A)** era «quién tiene una división cuyo numerador es una RESTA». Aquí el
  numerador es `m.profit`, que **ya viene restado del servidor**: la resta no está en este
  fichero. El detector sintáctico no podía verla. De `reportsView` sólo cazó la línea 187,
  `(value − prev) / Math.abs(prev)`, que es la variación interanual y no el margen.
- La pregunta **(C)** **sí** vio el rótulo `<th>Margen</th>` (línea 228), y ahí falló la lectura y
  no el instrumento: lo clasifiqué como «otra magnitud» y no comprobé si además se calculaba en la
  vista. Se calculaba.

La conclusión del apartado 2 —«no son cuatro, es uno»— **era falsa para el margen porcentual**. Lo
cierto es: el margen **del catálogo** vive en un sitio; el **porcentaje de margen** se calcula en
dos, y desde hoy los dos comparten al menos el CRITERIO. Unificar también la **aritmética** no
procede: Informes recibe sus cifras ya agregadas del servidor y `margenDesde` pide el coste y el
precio de un artículo — son dos entradas distintas para la misma fórmula.

## A3 · Lo construido, y una desviación que se declara

| fichero | qué |
|---|---|
| `reportsView.js` | `marginColor` en la fila del mes · `totalMarginColor` en la del TOTAL |

La **regla** es la del módulo: `window.margenCatalogo.bajoCoste(…)`, en las dos. Ninguna
comparación nueva y ningún literal.

**⚠️ DESVIACIÓN DECLARADA: no se usa la clase `catalogo-margen--bajo-coste`, y no es por
comodidad.** Se midió en la página viva: se inyectó una regla
`td.margen--bajo-coste{color:var(--danger-ink)}` y se le puso la clase a la celda del `−50 %`.

```
antes:     "rgb(107, 117, 111)"
conClase:  "rgb(107, 117, 111)"
enLinea:   "text-align:right;color:var(--neutral-500)"
gana:      false
```

**La clase pierde:** un `style=` en línea gana a cualquier selector sin `!important`. Y las cinco
celdas de esa tabla se colorean en línea —`profitColor`, dos líneas más arriba, es la vecina—, así
que ése es el idioma del fichero. Se comparte lo que importa: **el mismo token y la misma regla**.

## A4 · Los tres controles

### 🔴 EL QUE DECIDE

| celda | ANTES | DESPUÉS |
|---|---|---|
| Mar, `−50 %` | `rgb(107,117,111)` | **`rgb(153,27,27)`** |
| May, `−100 %` | `rgb(107,117,111)` | **`rgb(153,27,27)`** |
| TOTAL de un año en pérdidas, `−300 %` | `rgb(51,60,55)` | **`rgb(153,27,27)`** |

### ✅ POSITIVO

`70 %`, `30 %` y `0 %` siguen en `rgb(107,117,111)`; el TOTAL de un año bueno (`24 %`) sigue en
`rgb(51,60,55)`; y el mes sin actividad sigue pintando `—` en gris. Idénticos a antes.

El **cero** y el **`—`** son los dos bordes que no se tiñen, y no por casualidad: `bajoCoste(0)` es
`false` porque trabajar a precio de coste no es perder dinero, y `bajoCoste(null)` es `false`
porque «no se sabe» no es «va mal».

### ✅ AB6 · CONTRASTE MEDIDO AQUÍ, NO HEREDADO

En la ficha el fondo era `--danger-bg`. **Aquí la celda es transparente** y detrás está la tabla o,
en la fila del total, `--neutral-50`. Son fondos distintos, así que la cifra se vuelve a medir —que
es exactamente lo que no hice la primera vez, y por eso salió un 4,41:

```
control negro sobre blanco: 21
Mar     -50%   rgb(153,27,27) sobre rgb(255,255,255)  ->  8.31  CUMPLE AA
May    -100%   rgb(153,27,27) sobre rgb(255,255,255)  ->  8.31  CUMPLE AA
TOTAL  -300%   rgb(153,27,27) sobre rgb(247,248,246)  ->  7.80  CUMPLE AA
```

## A5 · Tests y mutaciones

Cuatro tests más —**13** en el fichero— y **dos mutaciones más: seis, y las seis VIVAS**.

| test | qué caza |
|---|---|
| `Informes decide con el MÓDULO` | por AST, que vuelva a compararse `< 0` en la vista. Exige **DOS** llamadas: la del mes y la del TOTAL |
| `las dos celdas usan --danger-ink` | el token flojo, y con **control positivo**: el gris `--neutral-500` sigue siendo la otra rama |
| `el módulo carga ANTES que Informes` | que un merge reordene el índice |
| `AB6 sobre SUS PROPIOS FONDOS` | heredar la cifra de otra pantalla, que es justo lo que falló con `--danger` a 4,41 |

## A6 · Lo que queda dicho y no se toca

- ~~La dependencia de carga `margenCatalogo.js` → `reportsView.js` **es real y no está declarada**
  en `DEPENDENCIAS_DE_CARGA`.~~ **RESUELTO** (7-sep-2026): el asesor estrechó la prohibición
  —seguía vetado arreglar el matcher de SCRUM-634, no declarar una dependencia real que ya se
  cumple— y la línea está puesta. Se mezcló `main` justo antes de tocar el fichero compartido
  (sin cambios: blob `3bc6d1f6`), se volvió a medir el orden (**284 < 335**, los mismos números) y
  **la línea se probó EN ROJO**: moviendo `margenCatalogo.js` detrás de `reportsView.js` en el
  índice, `scrum662-lista-de-scripts` cae nombrando la pareja con `posAntes: 70, posDespues: 69`.
  `index.html` restaurado byte a byte. Una línea, nada más de ese fichero.
- Las dos condiciones redundantes del techo siguen las dos, como estaban.
- `quotesView`, el detector de sobrantes y `_banco-vistas.mjs`: sin tocar. Ningún literal nuevo.

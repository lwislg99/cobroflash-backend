# SCRUM-675 · Una ventana fija no lee el código: lee los primeros N caracteres de donde estaba

**Fecha:** 15-sep-2026 · **Carril:** instrumentos · **Gate:** medición + arreglo (instrumento, `src/` intacto)

**Medido contra:** `origin/main` = `02cd719292c189570b32938bdaa5a54f728d3e24` · 2026-09-15T14:50:41Z
**Rama:** `scrum-675-ancla-por-identidad`
**Preámbulo (A1):** `prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** al ramificar.

> **Obligación 0:** sin rama remota, sin commit en `main`, sin expediente → causa **(a)**.
> ⛔ **No se sube ningún tope ni se relaja ningún guard** (regla 41) · `src/` intacto (regla 38) ·
> ningún estado ni flag nuevo · ninguna dependencia.

---

## 1 · 🔴 LO PRIMERO: EL TICKET HA ENVEJECIDO EN SU EJEMPLO

El encargo lo pedía explícitamente — *«mide el margen HOY; si ya no son 152, lo primero que
entregas es el número nuevo»*. Medido:

| | ticket (2-sep) | **hoy (15-sep)** |
|---|---|---|
| el caso nombrado: censo de SCRUM-647 | ventana fija, margen **152** | ✅ **ya arreglado — lee por identidad** |
| margen vivo más ajustado que queda | — | **644** (`scrum370`, ventana 1400) |

`tests/scrum647-presupuesto-tambien-neutral.test.mjs` ya delimita
`t.slice(i, t.indexOf('Total', i) + 'Total'.length)` — **ancla por identidad**, que es la salida
**A** del propio ticket. Y su comentario lo dice:

> *«`IGIC` ocupa un carácter más que `IVA`. Un `slice` de longitud fija cortaba la…»*

**El ejemplo está cerrado; la tesis no.** Por eso esta tanda ataca la familia y no el caso.

---

## 2 · La población: 26 ventanas, 21 que pueden cegar, **2 que ciegan EN VERDE**

Censo por AST sobre `tests/` y `scripts/` (nunca `grep`: `.slice(0, 120)` aparece también dentro
de cadenas y comentarios).

```
VENTANAS FIJAS (>= 100 caracteres): 26
  · que solo TRUNCAN para imprimir (inocuas) .......: 5
  · 🔴 que ACOTAN UNA BUSQUEDA (pueden cegar) ......: 21
  · 🔴🔴 de esas, con CEGUERA SILENCIOSA ............: 2
```

### 🔴 La distinción que no estaba en el ticket, y es el hallazgo

No todas las ventanas ciegan igual:

| assert sobre la ventana | si el símbolo sale fuera | |
|---|---|---|
| `assert.match(bloque, /X/)` | el guard **CAE** | frágil, pero su ceguera es **ruidosa**: alguien se entera |
| `assert.doesNotMatch(bloque, /X/)` | el guard **PASA en verde** | 🔴🔴 **ceguera silenciosa** — la que muerde |

**Las dos silenciosas, medidas:**

* `tests/scrum338-carga-de-catalogo-no-muda.test.mjs:87` — ventana 1800
* `tests/scrum819-el-menu-deja-rastro.test.mjs:83` — ventana 700

### 🔴🔴 Y una de ellas ya está pasando por vacío

Medido sobre el árbol real: el `assert.doesNotMatch(bloque, /throw\s|reject\(/)` de `scrum338`
busca un `throw` que **no existe en todo el fichero**. Ese assert **no puede distinguir** «el
código está bien» de «la ventana no llega»: pasa por vacío hoy, y seguiría pasando si mañana
alguien metiera un `throw` a 2.000 caracteres del ancla.

Es la respuesta a la pregunta 2 del encargo —*«¿hay alguno que ya esté ciego ahora mismo?»*— y no
estaba en el ticket.

---

## 3 · El arreglo: por identidad, y con suelo

`tests/_bloque-por-identidad.mjs` delimita el bloque por su **estructura** —desde el ancla hasta
que se cierran sus llaves—, no por una distancia. Un comentario dentro ya no lo desborda: **el
bloque acaba donde acaba**.

* 🔴 **No se sube ningún tope.** Pasar 1800 a 3600 compra tiempo y reproduce el defecto con otro
  número en tres meses — es literalmente lo que prohíbe la regla 41.
* 🔴 **Si no puede delimitar, LANZA** (`BloqueNoDelimitableError`) en vez de devolver «lo que
  pillé». Es la salida **B** del ticket puesta como **suelo de la A**: si el ancla estructural
  fallara algún día, el guard grita en vez de callarse.
* ⚠️ **Las llaves dentro de cadenas y comentarios no cierran el bloque.** Sin eso, una `}` en un
  mensaje de texto cortaría antes de tiempo y volveríamos a leer de menos — el mismo defecto con
  otra cara. Está en el control ⑤.

### Lo que la ventana acotaba, y que el arreglo no puede reintroducir

El ticket avisa: *«hay que saber QUÉ se quería excluir antes de sustituirla»*. La ventana existía
para **no leer de más** y confundir una aparición lejana con la relevante. El control ④ lo fija:
un `throw` en la función **vecina** NO entra en el bloque. Si entrara, habríamos cambiado un guard
ciego por uno que acusa de más.

---

## 4 · Los controles

| # | control |
|---|---|
| ① | **SUELO**: hay ventanas que examinar y el delimitador delimita |
| ② | 🔴 **EL QUE DECIDE**: con ventana fija el símbolo empujado pasa en verde; por identidad, se ve |
| ③ | 🔴 **MUTACIÓN**: volver a la ventana fija devuelve la ceguera — y se comprueba que **entró** |
| ④ | ✅ **POSITIVO**: sigue cazando la violación real, no dispara sobre limpio, y **no se come al vecino** |
| ⑤ | ✅ **NO SE CALLA**: sin ancla o sin cierre, lanza con mensaje accionable |

### 🔴 EL ROJO, sobre el árbol real

Mutado el delimitador para que vuelva a `slice(i, i + 1800)`:

```
not ok 2 - 🔴 ② con ventana fija el símbolo empujado pasa EN VERDE; por identidad, se ve
  error: '🔴 EL DEFECTO DE SCRUM-675 SIGUE: delimitando por identidad, el `throw` TIENE que estar
          dentro del bloque. Si no está, el ancla estructural no alcanza y el guard seguiría ciego.'
not ok 3 - 🔴 ③ MUTACIÓN: volver a la ventana fija devuelve la ceguera
    🔴 el arreglo no ve el símbolo: entonces no arregla nada
# pass 0 · fail 5
```

Fuente **restaurada byte a byte** (`Buffer.compare === 0`, 5243 = 5243).

---

## 5 · 🔴 Dos errores propios de esta tanda, declarados

### 5.1 · Moví el árbol bajo mi propia tanda en marcha (SCRUM-182), y es reincidencia

La primera pasada de `npm test` dio **2 fallos en `SCRUM-267`** — el guard que comprueba el ancla
de las entradas de `docs/master/`. **No era el guard ni el código: era yo.** Lancé la suite en
segundo plano y **después** escribí este mismo fichero y corrí `git add -A`; el guard mira las
entradas contra la base de la rama, así que le cambié el suelo mientras medía.

Corrido aislado: **10/10**. Re-corrida la suite: **6727 · 0 fallos**.

Es la lección de SCRUM-182 —*nunca muevas el árbol bajo tu propia tanda en marcha*— y la había
cometido antes. Queda escrito porque **un verde que se obtiene repitiendo la tanda sin decir por
qué falló la primera es un verde prestado**.

> ⚠️ **Y la explicación de arriba es la MÁS PROBABLE, no una medición — se dice así en vez de
> venderla como cierta.** En la segunda pasada también edité este fichero mientras corría, y esa
> vez pasó. La diferencia que queda en pie es que en la primera hubo además un `git add -A`
> (cambio de índice) y en la segunda sólo una edición de un fichero ya indexado. **Demostrarlo
> exigiría reproducir el fallo a propósito**, y eso es otra tanda: lo medido es que aislado da
> 10/10 y que con el árbol quieto la suite entera da 0 fallos.

⚠️ Y hay un detalle que la hace más fácil de repetir: `npm run guards:entrada` **pasó 22/22** en
ese mismo momento. Los dos miran lo mismo y dieron distinto, porque uno corrió con el árbol quieto
y el otro no. **Dos instrumentos que discrepan no se promedian: se mira cuál tenía el suelo firme.**

### 5.2 · Un defecto de mi propio censo, corregido y declarado

Su control positivo decía *«NO cuenta el truncado de 120: 🔴 lo cuenta»* — y **el control estaba
mal formulado, no el censo**: usé un truncado de 120 que está **por encima** de mi propio umbral
de 100, y además comprobaba lo que no era (que no se contara como *ventana*, en vez de que no se
contara como *peligrosa*). Corregido: ahora el sintético lleva un truncado de 80 (bajo el umbral)
y otro de 300 que **sí** entra como ventana pero **no** como peligrosa, que es la distinción real.

---

## 6 · Lo que esta tanda NO hace

1. **No reancla las 21 una por una.** Se entrega el mecanismo y el censo que dice cuáles son;
   migrarlas es trabajo por guard y cada una tiene su ancla. **Las 2 silenciosas son por dónde
   empezar**, y están nombradas con fichero y línea.
2. **No toca `src/`** ni ningún guard ajeno: esto es instrumento (regla 38).
3. **No sube ningún tope** (regla 41).

## 7 · Los bancos

`docs/master/evidencias/scrum675/censo-de-ventanas-fijas.mjs` (+ `salida-censo.txt`) — la
población, con suelo y control positivo corregido.
`docs/master/evidencias/scrum675/margen-de-hoy.mjs` (+ `salida-margen.txt`) — el margen real y la
comprobación de que el caso del ticket ya está arreglado.

---

# APÉNDICE · SCRUM-675 (fase b) · Las ciegas, reancladas — y el censo de la fase a corregido

**Fecha:** 15-sep-2026 · **Rama:** `scrum-675b-reanclar-las-21`

**Medido contra:** `origin/main` = `d66326721f4bae7237236b04cf7da96cb2741c4d` · 2026-09-15T15:21:17Z

> ⚠️ **Esta fase depende de la a y ramifica desde ella**, no desde `main`: el mecanismo
> (`tests/_bloque-por-identidad.mjs`) todavía no está mergeado. Si la fase a se revierte, ésta se
> va con ella. Se dice en vez de disimularlo.

---

## b.1 · 🔴 EL CENSO DE LA FASE a CONTABA DE MÁS, Y LO CORRIJO YO

Aquel censo dio **21 ventanas «que pueden cegar»** sin preguntar lo que lo decide todo:

> **¿el texto sobre el que se abre la ventana viene YA LIMPIO de comentarios?**

`leerFuente(ruta, { ancla })` y `soloEjecutable()` (SCRUM-719) **quitan los comentarios** antes de
devolver el texto. Sobre un texto así, **escribir un comentario no empuja nada** — la fragilidad
que este ticket persigue no existe. Re-censado:

```
VENTANAS QUE DECIDEN (las 21 de la fase a, re-examinadas): 21
  · sobre texto YA LIMPIO -> un comentario NO las ciega:  5
  · 🔴 sobre el fichero CRUDO -> un comentario SI las ciega: 16
```

**Y de las 2 «ciegas silenciosas» de la fase a, sólo UNA lo era.** Medido a mano antes de creerme
el censo:

| | cómo lee | veredicto |
|---|---|---|
| `scrum819:83` | `leerFuente(..., {ancla})` → **sin comentarios** | ✅ **no es ciega** — su bloque real son **401** caracteres contra una ventana de **700**: la ventana es más grande que el bloque |
| `scrum338:87` | `fuente(VISTA)` → **fichero crudo** | 🔴 **ciega de verdad** |

> **Cómo se destapó, porque es la parte instructiva:** medí `scrum819` sobre el fichero crudo y me
> salió que dos de sus `assert.match` **no estaban en la ventana**… pero el test pasa hoy. Dos
> cosas que no pueden ser ciertas a la vez. **Gana el instrumento sólo después de comprobar el
> instrumento**: estaba midiendo un texto que ese test no lee nunca.

## b.2 · La ciega real, reanclada — y NO destapa nada

`tests/scrum338-carga-de-catalogo-no-muda.test.mjs` vigila que el `save` del paso 3 del wizard no
propague el error de la carga de catálogo.

* **Lo que debía vigilar:** el `save` entero. Mide **2399 caracteres**; la ventana leía **1800**.
  **599 caracteres nunca se miraron**, y como su aserto es `doesNotMatch`, un `throw` ahí habría
  pasado en verde.
* **Reanclado** a `bloqueDesde(bloqueDesde(s, '// ── Paso 3 ─'), 'save: async () => {')`.
  El ancla del paso 3 es **única** (1 aparición) y el bloque **no se come al Paso 4** (comprobado).
* **¿Destapa algo al empezar a ver? NO.** No hay `throw` ni `reject` en el `save`. Su verde de hoy
  **ya significa algo**, que antes no.

### 🔴 EL CONTROL QUE DISTINGUE CIEGO DE MUDO, ejecutado

Inyectado un `throw` **a 2091 caracteres** del `apiRequest` — o sea, en el hueco que la ventana de
1800 no alcanzaba:

```
CON EL REANCLAJE:      not ok 3 — 🔴 el paso ahora propaga el error y bloquea el onboarding
CON LA VENTANA FIJA:   ok 3  ·  # pass 6 · fail 0      ← 🔴 LA CEGUERA, EN VERDE
```

**Ése es el rojo que este ticket existía para tener.** El guard no ha pasado de ciego a mudo: ve
lo que debe ver y cae cuando debe caer. `public/dashboard/js/onboardingView.js` **restaurado byte
a byte** (verificado con `git status`: sin cambios).

## b.3 · Las 16 restantes: por qué NO se reanclan en bloque, medido

El encargo decía *«reanclarlas con el mecanismo es una»*. **Medido: no lo es, y conviene decirlo
antes que entregar 16 reanclajes a ojo.**

Cada ventana necesita **su propia ancla**, y esa ancla depende de **qué vigila ese guard**: el
`save` de un paso, el cuerpo de una función, un bloque de UI. No hay transformación mecánica que
la derive — elegirla es exactamente el juicio que el mecanismo **no** puede automatizar. Aplicarlo
sin ese juicio produciría bloques que se comen al vecino, que es el defecto contrario y el que
acaba con el guard relajado.

**Entrega honesta: 1 de 16 reanclada** (la única con ceguera silenciosa, que era el defecto vivo),
**15 pendientes con su lista, su fichero y su línea** en `salida-censo-v2.txt`. Ninguna de las 15
es ciega silenciosa: sus asertos son `match`, así que si su símbolo sale de la ventana **caen**
—ruidosas, no mudas—. Eso las hace deuda, no defecto vivo.

## b.4 · El árbol quieto

Ver §7 del cuerpo principal: horas de inicio y fin de la tanda, declaradas.

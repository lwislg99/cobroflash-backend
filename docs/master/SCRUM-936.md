# SCRUM-936 · El `+1` de `tocable` NO es constante — y por eso PARO

**Medido contra:** `origin/main` = `7340d33116c5ab168aa7c5a67abee02813014cf8` · 2026-09-17T21:10:56+01:00
**Rama:** `scrum-936`

> 🔴 **PARO EN ①, Y ES LO QUE EL ENCARGO MANDA HACER.** «Es un desplazamiento CONSTANTE, así que
> debería ser una línea. **SI RESULTA SER MÁS, PARA Y DILO:** entonces no es el defecto que
> describe el ticket y estarías arreglando otra cosa con su nombre.»
>
> Resulta ser más. **No he tocado ni una línea del medidor.**

---

## Lo que medí ayer, y por qué se leía como «+1 constante»

Ayer calibré el árbitro con elementos **aislados** y salió +1 en los cinco tamaños (20, 43, 44, 45,
100). De ahí el enunciado de este ticket, que escribí yo. **Los cinco casos tenían algo en común
que no vi: ninguno tenía otro elemento interactivo pegado debajo.**

## ① DÓNDE ESTÁ EL SOBRANTE — medido, no deducido

Se le preguntó al barrido por sus bordes crudos (`top`, `bottom`) contra la caja (`r.top`,
`r.bottom`), en vez de por su resultado:

    id    caja   r.top    top      sobraArriba   r.bottom  bottom    sobraAbajo   tocable
    h43   43     40       39,016   0,984         83        82,996    -0,004       43,98
    h44   44     113      112,016  0,984         157       156,996   -0,004       44,98
    h45   45     187      186,016  0,984         232       231,996   -0,004       45,98
    vacio 44     262      261,016  0,984         306       305,996   -0,004       44,98
    lh    44     410      409,016  0,984         454       453,996   -0,004       44,98

**El sobrante NO está repartido: está todo arriba.** 0,984 px por encima de la caja, y abajo cero.

Y **no es el texto**: el botón vacío y el de `line-height` fijo dan exactamente lo mismo. El valor
0,984 tampoco es ruido — es `1 − 1/64`, la resolución de LayoutUnit de Chromium. **La región que
recibe el toque empieza un píxel por encima de la caja.**

## 🔴 LA MEDICIÓN QUE TUMBA LA PREMISA: dos botones pegados

    id    caja   sobraArriba   sobraAbajo   tocable
    h44   44     0,984         -0,004       44,98     ← aislado
    pegA  44     0,984         -0,988       43,996    ← con pegB pegado DEBAJO
    pegB  44     0,984         -0,004       44,98     ← con pegA pegado ENCIMA

**`pegA` mide 44,0, no 45.** Su vecino de abajo le come el píxel que a los demás les sobra: la
región de `pegB` empieza en `306 − 0,98 = 305,02`, dentro de la caja de `pegA`.

    región de toque de un elemento ≈ [ caja.top − 1 , caja.bottom ]

    · sin nada interactivo debajo  →  tocable = caja + 1     (sobra 1)
    · con un interactivo pegado    →  tocable = caja          (el vecino se lo come)

**El `+1` depende del vecino, no del elemento.** No es constante.

### Por qué una línea de `−1` sería peor que el defecto

Restar 1 sin mirar al vecino **descontaría un píxel que esos elementos no tienen**, y convertiría
en incumplidores a los que hoy miden bien:

| caso | hoy | con `−1` | verdad |
|---|---|---|---|
| aislado de 44 | 45 ❌ | **44** ✅ | 44 |
| **pegado, de 44** | 44 ✅ | **43** ❌ | 44 |

Y los pegados no son un caso raro: son **exactamente el grupo B de SCRUM-786** — los 15 botones de
«Bizum / tarjeta / transferencia», las filas de «Editar / Portal / 📊 Historial», las pestañas de
filtro. El arreglo de una línea haría fallar en falso justo donde el problema real duele más.

> 🔒 Un desplazamiento que depende del vecino no se corrige con una constante. Corregirlo con una
> constante es cambiar un sesgo conocido por uno que nadie ha medido.

## ② LO QUE NO SE PUEDE RE-MEDIR TODAVÍA

El encargo pedía re-medir lo declarado conforme entre 44 y 45. **No lo hago, y digo por qué:** sin
un criterio corregido que yo me crea, re-medir sería publicar una segunda cifra tan desplazada como
la primera. La cifra de daño real sólo se puede dar después de decidir qué es lo correcto para un
elemento pegado — y eso es una decisión, no una medición.

Lo que sí queda medido y es el tamaño del hueco: **de los 84 elementos por debajo de 44 en
SCRUM-786, ninguno está cerca del umbral** (todos rondan los 30), así que **la lista de aquel
ticket no cambia**. El sesgo importa para lo que se aprobó, no para lo que se suspendió.

## ③ QUIÉN MÁS CONSUME EL ÁRBITRO

**Población barrida: 1.215 ficheros `.mjs`** de `scripts/` y `tests/`.

| consumidor | qué hace con `tocable` |
|---|---|
| `scripts/censo-objetivo-tactil-panel.mjs` | `cumple: m.tocable >= MIN` |
| `scripts/guard-objetivo-tactil.mjs` | `cumple: m.tocable >= MIN` |
| `scripts/guard-a11y-landing.mjs` | `cumple: m.tocable >= min` |

**Tres**, y los tres comparan contra el mínimo. Un árbitro desplazado los desplaza a los tres — y
uno de ellos (`guard-a11y-landing`) vigila la **landing pública**, que no entró en SCRUM-786.

## ④ LA SONDA: por qué NO la dejo como test todavía

Es la mitad del ticket y estoy de acuerdo con el motivo —el defecto vivió porque nadie le
preguntaba su umbral al medidor—, pero **una sonda que afirme «44 exactos dan 44» falla HOY** sobre
un elemento aislado. Dejarla verde exigiría escribir en ella el sesgo que aún no sabemos corregir,
y entonces congelaría el defecto en lugar de cazarlo.

**Va cuando haya criterio.** Y el criterio es la pregunta que te devuelvo.

---

## LA PREGUNTA QUE DECIDE, Y ES TUYA

Un elemento aislado de 44 px **se puede pulsar** desde 1 px por encima de su caja. Un elemento con
vecino pegado, no.

* Si AB6 mide **lo que el dedo puede acertar**, `tocable` casi acierta hoy y lo que falta es
  descontar el píxel sólo cuando nadie lo reclama.
* Si AB6 mide **lo que el usuario VE que puede pulsar**, entonces el píxel de más nunca debió
  contar y el árbitro tiene que anclarse a la caja.

**Las dos son defendibles y dan listas distintas.** No la elijo yo: decide qué mide AB6 y el arreglo
sale solo.

---

## Errores propios (A9)

**El enunciado de este ticket es mío y era incompleto.** Ayer escribí «+1 constante a cualquier
tamaño» habiendo probado **cinco elementos aislados y ninguno pegado**. Cinco casos que sólo varían
en una dimensión no son cinco controles: son el mismo control cinco veces. Lo que lo destapó fue
preguntar por los **bordes crudos** en vez de por el resultado — la misma diferencia que en
SCRUM-732 entre contar cadenas y comparar conjuntos.

---

## Lo que NO se ha tocado

⛔ **Ni una línea de `_medidor-de-toque.mjs`.**
⛔ **Ni un píxel de CSS.** ⛔ **El umbral sigue en 44** (regla 41).
⛔ Ninguna dependencia (36). Vanilla (4). Ningún texto (30).

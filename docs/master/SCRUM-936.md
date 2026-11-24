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

---

# SCRUM-936b · Lo que acierta el dedo: medición y arreglo PROPUESTO — paro por contexto sin escribirlo

**Medido contra:** `origin/main` = `6fbcde28651d2eed9190ced9efbc7663d8cdac7a` · 2026-11-24T11:54:03Z
**Rama:** `scrum-936b-tocable-lo-que-acierta-el-dedo` · carril J6 · sesión `jv-j6fo` · Jira c.22600

A9: aviso → cicatriz J6 «Crucé el umbral de aviso de contexto sin medirme en el cruce: medí al arrancar y no volví a medir hasta después de un barrido ancho.» — no se pudo comprobar: la misma cicatriz otra vez; medí al acabar el arranque (103.771) y no volví a medir hasta 147.068, ya pasado el tope de 145k del encargo y sin el arreglo escrito; ningún hook de este árbol para a una sesión al cruzar su tope.

**Decisión que aplica:** SCRUM-936 c.22578 (fundador, 24-nov-2026, elección «Lo que acierta el dedo»): AB6 mide el área que responde al toque (con su relleno), no el borde pintado. Deshace la pregunta de este registro de septiembre.

## Qué · esperado · visto

| qué | esperado | visto |
|---|---|---|
| ¿`tocable` es una función o hay copias? | una | **una**: `scripts/_medidor-de-toque.mjs`, `FUENTE_MEDIDOR`, `tocable: +(bottom - top)` en la línea 134. Población: 2.292 `.mjs` de `scripts/` y `tests/`; 20 nombran `tocable`; 13 importan el medidor (5 scripts, 8 tests). |
| carril del medidor | sin cerradura | fila general de `scripts/`, sin dueño declarado (`node scripts/carriles.mjs de scripts/_medidor-de-toque.mjs`). `censo-objetivo-tactil-panel.mjs` es **S3** y `guard-hojas-del-trabajo-44.mjs` es **S4**: solo importan el medidor, el arreglo no los toca. |
| qué ata hoy la fuente del medidor | — | `tests/scrum562-arbitro-de-toque.test.mjs` exige 5 literales (el árbitro `arriba.closest(SEL) === el`, `let top = cy, bottom = cy;`, `const afinar = (bueno, malo)` y los dos controles). El arreglo propuesto los conserva. |
| arreglo escrito y probado | sí | **NO.** Paré a 147.068 de contexto (tope del encargo: 145k para empujar). |

## Por qué el +1 depende del vecino — modelo, NO comprobado en navegador

`elementsFromPoint(x, y)` se comporta como una ventana de 1 px que **baja** desde `y`, y gana el
interactivo pintado más tarde de los que toca. Encaja con los siete casos de septiembre de arriba:

- aislado: región medida `(top − 1 + 1/64, bottom)` → caja + 1 (el 0,984 de arriba, el −0,004 de abajo);
- con un interactivo posterior pegado debajo (`pegA`): la ventana que cruza el borde la gana el vecino,
  región `(top − 1 + 1/64, bottom − 1]` → caja (el −0,988 de abajo).

## Arreglo propuesto, NO aplicado

En `FUENTE_MEDIDOR`, la línea del `return` (la caja `r` ya está en el ámbito):

```diff
-    return { caja: +r.height.toFixed(1), tocable: +(bottom - top).toFixed(1) };
+    // SCRUM-936b · c.22578: el área que responde al toque, con su relleno. La ventana de 1 px de
+    // elementsFromPoint añade arriba un píxel que no existe y deja que el vecino de abajo se coma el último.
+    const alto = Math.min(bottom + 1, r.bottom) - Math.max(top, r.top);
+    return { caja: +r.height.toFixed(1), tocable: +alto.toFixed(1) };
```

Con los datos de septiembre: h43 → **43, corto** · h44 aislado → 44 · `pegA` → 44 · `pegB` → 44 ·
48 → 48 · tapado por arriba (`.cta-band::after`) → sin cambio. Calculado, no medido.

🔴 **Riesgo sin medir:** recortar a la caja deja fuera un área ampliada a propósito con un
pseudo-elemento. Las descripciones de `censo:arbitro-de-toque` y `guard:a11y-landing` en
`package.json` dicen que `.announce a::after` amplía su propia área (SCRUM-543): leído, no medido.
Con el recorte, ese enlace mediría su caja y `guards:visuales` podría salir rojo. Variante si pasa:
recortar solo el borde que cae a menos de 1 px de la caja (el píxel fantasma de arriba y el que el
vecino se come abajo), y dejar el resto como lo mide el árbitro. Cuál de las dos, lo dice el navegador.

## Veredictos que cambian

**Sin medir.** No he corrido ningún guard con el medidor nuevo porque el medidor nuevo no existe.

## Lo que falta, para quien siga

1. Test rojo primero, con navegador (`lanzarNavegador` de `scripts/_navegador.mjs`): h43 corto;
   h44 aislado y `pegA` dan 44 los dos; control positivo 48 conforme; y el caso `.announce a::after`.
2. Aplicar la variante que el navegador dé por buena.
3. `npm run guards:visuales` y `npm run censo:tactil-panel`: la lista de objetivos que pasan a cortos,
   por pantalla, va aquí como hallazgos. Si sale rojo un guard del obligatorio, se para (regla 41).

---

# SCRUM-936c · Relevo de 936b: paro otra vez por contexto, sin test ni arreglo — y con una restricción nueva

**Medido contra:** `origin/main` = `e7be8c3d897e266cd26c80815065476ec2cc8f99` · 2026-11-24T12:05:51Z
**Rama:** `scrum-936c-medidor-lo-que-acierta-el-dedo` · carril J6 · sesión `jv-j6fp`

A9: aviso → cicatriz J6 «Crucé el umbral de aviso de contexto sin medirme en el cruce: medí al arrancar y no volví a medir hasta después de un barrido ancho.» — no se pudo comprobar: tercera vez en el mismo ticket; medí 103.466 al acabar el arranque y lo dije, pero la siguiente medida fue 139.207, ya pasado el tope de 135k del encargo, tras leer el medidor, scrum562 y el clasificador; ningún hook de este árbol avisa al cruzar.

**Decisión que aplica:** SCRUM-936 c.22578 (elección «Lo que acierta el dedo»), la misma de 936b. No la he releído en Jira: el encargo lo prohibía.

## Qué · esperado · visto

| qué | esperado | visto |
|---|---|---|
| test con navegador en rojo | escrito y rojo | **NO escrito.** |
| medidor arreglado | sí | **NO tocado.** `scripts/_medidor-de-toque.mjs` sigue como en main. |
| ¿cabe el arreglo «exacto» en el árbitro? | — | **No sin tocar un guard** (abajo). Leído en el código, no corrido. |

## La restricción que 936b no vio: el clasificador de scrum562

`tests/scrum562-arbitro-de-toque.test.mjs` clasifica CADA llamada a `elementsFromPoint` de nuestro
código con `clasificar()` de `scripts/censo-arbitro-de-toque.mjs` (ventana de 3 líneas antes y 7 después) y
tumba las clases `PERTENENCIA` y `OTRO`. Sólo pasan `TOPE` (`…)[0]`), `POSICION` y `SINGULAR`.

El arreglo que quita el píxel fantasma en TODOS los bordes —también el de arriba de un `::after` que
amplía el área— necesita «el primero de la pila en `y` que también esté en la pila de `y − 1 + 1/64`»
(las dos ventanas de 1 px). Eso es una consulta de pertenencia a la segunda pila: sale `OTRO` (con `Set`
y `.has`) o `PERTENENCIA` (con `.includes`). Enseñarle al clasificador que `.has` vale abriría la puerta
al idioma malo disfrazado (`new Set(pila).has(el)`), así que **no es un arreglo: es aflojar el guard (regla 41)**.

Lo que queda dentro de las reglas, con lo que cada uno hace (calculado sobre los datos de septiembre, no medido):

| caso | hoy | diff de j6fo (recorte a la caja) | variante (recortar solo a menos de 1 px de la caja) |
|---|---|---|---|
| h43 aislado | 44,0 ✅ (falso) | 43 ❌ | 43 ❌ |
| h44 aislado | 45,0 | 44 ✅ | 44 ✅ |
| h44 con vecino pegado debajo | 44,0 | 44 ✅ | 44 ✅ |
| 48 | 49,0 | 48 ✅ | 48 ✅ |
| enlace de 20 con `::after` a 44 | 45,0 | **20 ❌ (falso)** | **45,0** ✅ (sigue el +1 en el área ampliada) |

La variante no da el área ampliada exacta: le deja el píxel fantasma de arriba. Un `::after` que amplía a
43,5 saldría 44,5 y conforme. **Si eso se acepta, o si se abre el clasificador, es una decisión: no la tomo.**

## Mecanismo probable (leído de memoria del código de Chromium, NO comprobado)

`HitTestLocation` de un punto lleva una caja de 1×1 (`RectForPoint`), y `Intersects` compara contra esa caja
y no contra el punto (hay un FIXME que lo dice). Por eso el punto `y` «toca» lo que empieza en `(y, y+1)`.
Encaja con 0,984 = 1 − 1/64 de septiembre si la coordenada se redondea hacia abajo a LayoutUnit.

## Lo que falta, para quien siga (orden)

1. Decidir con el orquestador: variante (acepta el +1 en áreas ampliadas) o abrir el clasificador (STOP de regla 41).
2. Test rojo primero. ⚠️ No comprobé dónde exporta `lanzarNavegador` `scripts/_navegador.mjs`: mi `grep` cortó en 8 líneas.
3. Lo de 936b ③ y ④, sin cambios.

⛔ No he tocado `scripts/`, `tests/`, `public/` ni `.claude/`.

---

# SCRUM-936d · La variante de c.22615, medida antes de aplicarla: el defecto no sale hoy, y PARO sin tocar el medidor

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24 (hora de GitHub en el comentario de Jira)
**Rama:** `scrum-936d-variante-del-medidor` · carril J6 · sesión `jv-j6fr`

A9: comprobación → `tests/scrum936d-variante-del-medidor.test.mjs`

**Decisión que aplica:** SCRUM-936 c.22615, «Variante, sin tocar el vigía (Recomendado)». No la he releído en Jira: el encargo lo prohibía.

## Qué · esperado · visto

| qué | esperado | visto |
|---|---|---|
| test nuevo, contra el medidor de HOY | ROJO (h43 → 44, h44 → 45, 48 → 49, según los datos de septiembre de este registro) | **VERDE.** h43 → **43** · h44 aislado → **44** · h44 con vecino pegado debajo → **44** · 48 → **48** · enlace de 20 con `::after` a 44 → **45**. Las cinco cajas, las sembradas, y el árbitro alcanza a las cinco (sin `error`). |
| lo mismo con las cajas en posición fraccionaria (separadores de 100,3 px) | — | idéntico: 43 · 44 · 44 · 48 · 45. Una pasada, sonda no comiteada. |
| variante aplicada | sí | **NO.** El medidor de hoy ya da lo que la variante quería en los cuatro botones; aplicarla sería cambiar código sin defecto medido (A2). `scripts/_medidor-de-toque.mjs` sigue como en main. |
| `guards:visuales`, `censo:tactil-panel` | lista de cortos nuevos | **No corridos:** sin cambio en el medidor no puede haber cortos nuevos. |

Población: 1 navegador (el que resuelve `resolverNavegador` en esta máquina; arranque 0,5 s), 1 banco fabricado por el test, 5 objetivos, 2 pasadas.

## Lo que esto dice, y lo que no

- El +1 en un botón normal (aislado o con vecino) **no se reproduce hoy** en este navegador. Lo que sí sale es el +1 en el área ampliada con `::after`: el «resto conocido» de c.22615 es, hoy, **lo único** que queda del defecto.
- **Sin medir:** por qué septiembre daba +1 en botones (otro navegador, otra versión, otro banco con texto). No lo sé.
- El test fija los cinco valores: si el +1 vuelve a los botones, cae en h43/h44/48; si el resto desaparece, cae en el enlace.
- ⚠️ Es el primer test de `tests/` que arranca un navegador real: si no hay navegador, salta con su motivo; si lo hay y no arranca, `lanzarNavegador` sale con 3 y el fichero cae. Sin medir en el job de CI.
- Decisión para el fundador: ¿se cierra la variante como innecesaria, o se quiere el +1 del área ampliada quitado (eso abre el clasificador de scrum562, regla 41)?

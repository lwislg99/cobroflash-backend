# SCRUM-794 · Un solo «+ Añadir línea», y la prueba de que uno basta

**Fecha:** 6-sep-2026 · **Carril:** UI / editor de presupuesto · **Gate:** sin gate — banco de vistas y AST; las medidas de píxel son de navegador, fuera de `npm test`
**Medido contra:** `origin/main` = `95be56e4dd523b45d3046bda8cf09578ff953ab8` · 2026-09-06T21:26:35+01:00
**Tanda:** 5697 tests, 5601 pass, 0 fail, 96 skipped (salida 0)

> **Es la SEGUNDA tanda y las dos se dicen.** La rama nació de `ff4e1c4a`; con el trabajo ya hecho,
> `main` se había movido y traía **SCRUM-791**, que mete el editor de presupuesto dentro del guard
> táctil — o sea, mi misma pantalla. Se mezcló ANTES de medir. La primera tanda (sobre `ff4e1c4a`)
> dio 5679/5587/0/92; ésta es la de después del merge. El guard de SCRUM-791 se volvió a correr
> entero después, y **saltó**: eso tiene su apartado al final.

En la sección **«2. Líneas»** del editor había **dos botones «+ Añadir línea»**: uno suelto en la
cabecera de la sección y otro a ancho completo debajo de la última línea. Mismo rótulo, misma
función — los dos colgaban de `addLineAndFocus`. El fundador firmó **quedarse con el de abajo**.

---

## 1. Antes de borrar: ¿era el de arriba el único camino en algún estado?

Ésta era la pregunta que había que contestar, y no es retórica: **SCRUM-792 acababa de encontrar el
mismo defecto por la otra cara.** Allí las dos vías de «seleccionar todo» se ocultaban a la vez por
debajo de 640 px y la función quedaba inalcanzable. Borrar un duplicado sin mirar es cómo se llega
a eso. Se comprobó por partida doble.

**① El estado de CERO líneas no existe.** Dos garantías, las dos en el código:

| garantía | dónde | qué impide |
|---|---|---|
| `LINEAS_CUADERNILLO = 3` + `dibujarCuadernillo()` al montar | `quotesView.js` | que el editor arranque vacío |
| `if (lines.length === 1) { …vaciar…; return; }` en el botón de borrar | `quotesView.js` | que se pueda vaciar la lista a mano |

Por eso la primera obligación del encargo —«mide qué se ve con CERO líneas»— se contesta
**declarando que esa población NO es alcanzable**, en vez de devolver un cero que no distingue
«no hay» de «no supe llegar». No se llega ni montando ni borrando.

**② Ninguno de los dos botones era condicional.** Los dos `appendChild` estaban en el cuerpo del
montaje, fuera de todo `if`, bucle o ternario. Comprobado **por AST** sobre el árbol del fuente, no
por `grep`: un `grep` no sabe si una llamada está dentro de una rama.

Las dos cosas quedan vigiladas por test, y no como comentario: si mañana alguien quita el suelo o
mete el botón dentro de un `if`, este ticket vuelve a estar sobre la mesa.

---

## 2. Lo medido, en navegador y con el árbitro de la casa

Edge + `puppeteer-core`, y **el árbitro es `elementsFromPoint`, no la caja CSS** (`__areaDeToque`,
SCRUM-782): un botón puede tener la caja grande y estar tapado, o tenerla pequeña y llegar a 44 px
por el `::before`. Dos anchuras × dos poblaciones de líneas.

### Cuántos hay, pintados Y alcanzables

| | 929 px / 3 líneas | 929 px / 4 líneas | 390 px / 3 líneas | 390 px / 4 líneas |
|---|---|---|---|---|
| **ANTES** | 2 | 2 | 2 | 2 |
| **DESPUÉS** | **1** | **1** | **1** | **1** |

Exactamente uno en las cuatro. **No salió cero**, que era la condición de parada del encargo.

### Y el que queda cumple AB6

| botón | caja | área de toque 929 | área de toque 390 |
|---|---|---|---|
| `button.btn.btn-secondary` — el BORRADO | 120,6 × 36 | **36,8** ❌ | 36,8 ❌ |
| `button.btn-ghost.quote-add-line` — el que QUEDA | 839 × 44 | **44,9 / 44,5** ✅ | **44,6 / 44,7** ✅ |

🔴 **El que se borró era el que NO cumplía.** No es una casualidad afortunada que convenga contar:
lo mismo lo midió SCRUM-791 por su cuenta y le salió el mismo 36,8, y por eso lo tenía en su lista
de excepciones. El duplicado que sobraba era además el peor de los dos.

### Y añade línea de verdad

Pulsado en navegador: 3 → 4 y 4 → 5 líneas. También en el banco, dentro de la suite.

---

## 3. El control positivo del encargo NO se sostiene, y aquí está por qué

El encargo pedía: *«la fila de plantillas, el selector de cliente y "Sugerir con IA" no se mueven ni
un píxel»*. **Se cumple en uno de los tres. En los otros dos es imposible por construcción**, y no
por haber tocado de más.

`linesHeader` es **una fila flex**, y sus hijos son —en este orden— el texto de ayuda, el botón
borrado, **«✨ Sugerir con IA»** y **«📋 Usar plantilla»**. Dos de los tres sujetos del control eran
**hermanos directos** del botón que el fundador mandó borrar, dentro del mismo contenedor. Quitar un
hijo de una fila flex mueve a los que quedan: no hay forma de borrar ese botón y que no se muevan,
salvo no borrarlo.

| sujeto | 929 px | 390 px |
|---|---|---|
| **selector de cliente** | `top 215,2 · left 45` → **igual** ✅ | `top 228,1 · left 33` → **igual** ✅ |
| «✨ Sugerir con IA» | `left 574,3 → 475,1` · `top 445,2 → 442,2` | `left 238,1 → 33` · `top 649,2 → 642,2` |
| «📋 Usar plantilla» | `left 771 → 771` · `top 445,2 → 442,2` | `left 33 → 244` · `top 692,2 → **642,2**` |

El sujeto que el encargo protegía de verdad —**el selector de cliente, que es SCRUM-756 y va a otra
sesión**— no se ha movido ni un píxel en ninguna de las dos anchuras. La sección 1 no se ha tocado.

Y el movimiento de los otros dos **a 390 px es una mejora medida, no un daño**: antes la fila no
cabía y «Usar plantilla» bajaba a una segunda línea (`top` 649,2 y 692,2, 43 px de separación);
ahora los dos van a `642,2` — **una fila en vez de dos**, y la sección entera 50 px más corta en
móvil.

---

## 4. Dos trinquetes de la casa saltaron. Se DECIDEN, no se ensanchan

### ① El recuento de nodos (SCRUM-697/698): 263 → 262

Es **la primera vez que ese número baja**, y por eso la decisión se escribe entera en los dos
guards. Protocolo de la casa: el delta se identifica **por identidad sobre el árbol montado**, nunca
restando. Montado el árbol de antes, el botón borrado tiene un subárbol de **1 nodo** —`textContent`
en el banco es una propiedad y no un hijo, así que no arrastra ningún `#TEXT`— y el que se queda
sigue ahí con su subárbol de 1. El delta entero es el botón borrado; el resto de la pantalla y las
otras tres vistas, intactas.

### ② El suelo de objetivos táctiles de SCRUM-791: 8 → 7

Este saltó **después del merge**, y es el trinquete haciendo exactamente su trabajo: la pantalla
dejó de pintar uno de los objetivos censados y el guard se negó a dar verde. El que falta **va
nombrado**, y nombrado midiendo: se corrió el mismo guard sobre el árbol de antes (`ff4e1c4a`) y
allí salían **dos** excusados con el mismo selector, `BUTTON.btn.btn-secondary` — «+ Añadir línea» y
«Limpiar formulario», los dos a 36,8 px. Ahora sólo queda el segundo.

```
ANTES     ⚠️ EXCEPCIÓN 36.8px · BUTTON.btn.btn-secondary «+ Añadir línea»
          ⚠️ EXCEPCIÓN 36.8px · BUTTON.btn.btn-secondary «Limpiar formulario»
          ✅ suelo de renderQuotesView: 8 objetivos cortos DISTINTOS (el censo midió 8)

DESPUÉS   🔴 CIEGO · renderQuotesView: he encontrado 7 objetivos cortos DISTINTOS y el censo
             de SCRUM-787 midió 8. Faltan 1 […]
```

### 🔴 Y de paso, un motivo caducado que el detector no puede ver

La excepción de `BUTTON.btn.btn-secondary` **nombraba dos víctimas y una acaba de dejar de
existir**. El detector de sobrantes de ese guard mira **el selector**, no el motivo: como «Limpiar
formulario» sigue midiendo 36,8 px, la excepción sigue haciendo falta y **nada habría avisado** de
que su motivo señala a un botón borrado. Es la avería que ese fichero persigue —*«una excepción que
ya no hace falta es una mentira con antigüedad»*— por la cara que su mecanismo no cubre.

Se corrige a mano y se deja dicho (regla 37: misma zona que toco, me bloquea, cabe en el PR). **No
se propone ensanchar el detector**: que compare motivos contra los textos medidos es una decisión de
otro carril, y este ticket no la firma.

---

## 5. Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/js/quotesView.js` | −1 botón: `addLineBtn`, su `className`, su `textContent`, su `appendChild` y su `addEventListener`. Nada más. |
| `tests/scrum794-un-solo-anadir-linea.test.mjs` | **nuevo** · 5 tests + 2 mutaciones declaradas |
| `tests/scrum697-un-solo-render.test.mjs` | 263 → 262 con el nodo identificado por identidad |
| `tests/scrum698-vistas-que-no-se-miden.test.mjs` | ídem, en sus dos controles |
| `scripts/guard-objetivo-tactil.mjs` | suelo 8 → 7 con el objetivo nombrado + el motivo caducado |

**Ningún literal nuevo.** Aquí se borra un botón, no se escribe texto (regla 30). Un test lo vigila:
el rótulo «+ Añadir línea» tiene que aparecer **exactamente una vez** en el código ejecutable.

---

## 6. Los tests, y el rojo de cada uno

Los cinco corren en `npm test`, sin gate.

| test | qué caza |
|---|---|
| `EL QUE DECIDE: hay EXACTAMENTE UN «+ Añadir línea», y es el de abajo` | cero (se fue la única forma de añadir) y dos (volvió el duplicado). Con **suelo**: si el editor monta 0 líneas, es CIEGO y lo dice |
| `y AÑADE LÍNEA de verdad al pulsarlo` | que el que queda sea un botón muerto |
| `el estado de CERO LÍNEAS no existe` | que alguien quite el cuadernillo o el suelo de «al menos una línea» — y entonces hay que volver a medir este ticket |
| `el botón que queda NO es condicional` | por **AST**: que el `appendChild` se meta en un `if` y aparezcan estados sin ningún botón |
| `el de ARRIBA no vuelve, y ningún literal nuevo` | el regreso de `addLineBtn` y un segundo literal igual. Lleva **hermano del token** (SCRUM-237): el detector reconoce su propia forma antes de que su «no aparece» valga algo |

**Las dos mutaciones declaradas salieron VIVAS**, ejecutadas con la maquinaria oficial
(`meta-guard-mutaciones.mjs`), no con una copia:

```
declaraciones leidas por AST: 2
pasada limpia: 5 verdes, 0 rojos
VIVA | colaterales: 2 | cae: EL QUE DECIDE: hay EXACTAMENTE UN «+ Añadir línea», y es el de abajo
VIVA | colaterales: 0 | cae: el estado de CERO LÍNEAS no existe: hay cuadernillo al montar y suelo al borrar
restaurado (sin addLineBtn, con el suelo): true
```

---

## 7. Lo que este ticket NO ha tocado

La sección 1 (Cliente) y «+ Nuevo cliente» — es **SCRUM-756** y va a otra sesión, al mismo fichero
(dos sesiones sobre un fichero es SCRUM-774). El IVA por defecto, las plantillas y las condiciones.
Ningún literal. `.btn-sm`, `EXCEPCIONES_PANEL` y las superficies de SCRUM-791 salvo el suelo que mi
borrado movió y el motivo que mi borrado dejó falso.

## 8. Lo que queda abierto, y de quién es

El botón que se queda cumple AB6, pero **`BUTTON.btn.btn-secondary` sigue a 36,8 px** por
«Limpiar formulario», y con él los otros grupos que SCRUM-787 destapó (57 de 76 son `.btn-sm`).
Eso no es de este ticket: **es la decisión del fundador sobre el botón base**, y la excepción sigue
declarada con su motivo y con quién la retira.

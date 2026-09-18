# SCRUM-909 · Editor de presupuestos: el CONCEPTO se quedaba sin ancho y su rótulo se salía de la caja

**Medido contra:** `origin/main` = `8b3f26d2cc3a3d1d1de03e1119a38dc0c94d97d7` · 2026-09-17T20:06:21Z
**Rama:** `scrum-909-rotulos-que-se-pisan` · Carril front (Sesión 2).

Nace del PASO 0 de SCRUM-888 punto 2. Sólo CSS: no toca ni un fichero de `src/`, ni emisión, ni dinero.

## PASO 0 — el defecto existe hoy, y el enunciado se quedaba corto

El ticket decía «a 1280 px». Medido **en el DOM renderizado** —no en la hoja de estilos— con el
panel real abierto en `#quotes-new` y una línea escrita (Pieza QA 909 · 8 · 24,95 €):

| ventana | columna CONCEPTO | rótulo «Concepto» (necesita 72 px) | fila |
| --- | --- | --- | --- |
| 390 px | 298,0 px | cabe | el pliegue de móvil, sano |
| 768 px | **69,9 px** | caja de 70 → se sale | |
| 1024 px | **53,9 px** | caja de 54 → se sale | |
| 1180 px | **0,0 px** | caja de 0 → se sale | **DESBORDA de lado** |
| 1280 px | **0,0 px** | caja de 0 → se sale | **DESBORDA de lado** |
| 1366 px | **0,0 px** | caja de 0 → se sale | **DESBORDA de lado** |
| 1440 px | **9,6 px** | caja de 10 → se sale | |
| 1600 px | 106,7 px | cabe, pero es más estrecho que «Precio» (120 px) | |
| 1920 px | 301,0 px | de acuerdo | |
| 2560 px | 689,6 px | de acuerdo | |

**Dos cosas que el enunciado no sabía:**

1. **No es «a 1280 px»: la banda rota va de 768 a 1600**, o sea todo el escritorio menos los
   monitores grandes — y dentro están los portátiles de **1366 y 1440**, que es donde de verdad
   trabaja la gente.
2. **A 1180, 1280 y 1366 px la fila DESBORDABA de lado.** Eso incumple, literalmente, el contrato
   que la Parte AB3 le escribió a este componente: *«un solo DOM, cero scroll lateral en cualquier
   anchura»*. Nadie lo había medido.

Y una tercera, que explica por qué el ancho de ventana no servía de umbral: **de 1280 a 1440 px de
ventana la columna del concepto sólo creció 9,6 px.** El ancho de la línea no lo decide el
navegador: lo decide el reparto entre el editor y la vista previa.

## Qué pasaba

`grid-template-columns: minmax(0, 3fr) 90px 120px 168px minmax(96px, auto) auto` en el `@media
(min-width: 768px)`. Las cinco columnas fijas suman 546 px y sus huecos 60 px: **606 px antes de
que el concepto ocupe nada**. En cuanto la línea medía menos que eso, **el `0` del `minmax` le daba
permiso al concepto para desaparecer**, y desaparecía. Un `<span>` no recorta, así que el rótulo se
pintaba fuera de su caja, encima de la columna de al lado — que es lo que se ve y lo que el ticket
llamó «se pisan».

## Arreglo — la línea se pliega según lo que mide ELLA, no la ventana

Tres estados, y **ninguno inventa lenguaje nuevo**: los tres ya existían en esta pantalla.

| línea | reparto | de dónde sale |
| --- | --- | --- |
| < 640 px | rejilla de móvil, números en pares | la regla base, intacta |
| 640 – 880 px | **concepto arriba a todo lo ancho**, números en una fila debajo | el pliegue del móvil, aplicado al escritorio |
| ≥ 880 px | fila única, la densidad de SCRUM-139 F4 | lo de hoy, con `minmax(180px, 3fr)` |

La condición se le pregunta a la línea con `@container` sobre `.quote-lines`, no a la ventana con
`@media`:

    🔒 Referenciar por posición caduca. Referenciar por identidad no.

**Y los umbrales no se eligen, se calculan** de la propia rejilla:

- los cinco campos numéricos miden 90 + 120 + 168 + 96 + 72 = **546 px**, y sus cuatro huecos
  **48 px** → **594 px** es lo que necesita una fila de números; más el relleno de la tarjeta
  (24 px) → 618 px. Se deja en **640**.
- para volver a la fila única hace falta además un mínimo REAL de 180 px de concepto y el quinto
  hueco: 594 + 12 + 180 + 24 = 810 px. Se deja en **880**, con ~70 px de margen para que el chip de
  ajustes pueda crecer («IVA 21 % · Margen 15 %» es más largo que «IVA 21 %») sin que la fila
  vuelva a desbordar.

`container-type: inline-size` es CSS de la casa: ni build, ni framework, ni dependencia (AB6). No
afecta a la hoja de ajustes, que cuelga de `document.body` y es `position: fixed` — comprobado, y
además `guard:descuento-redibuja` la abre a 1280 px en cada PR. Y si un navegador no entendiera
`@container`, todo cae a la rejilla de móvil: más alta, pero **entera** — nunca al concepto
invisible de antes.

**Lo que NO se toca:** el ancho fijo del chip de ajustes (SCRUM-139 F4: con `auto`, una línea con
margen ensanchaba su columna y descuadraba las columnas entre filas), el pliegue de la línea vacía
(F2), y el borde discontinuo reservado a «+ Añadir línea» (SCRUM-133).

## Rojo, positivo y negativo

`npm run guard:rotulos-de-la-linea` — guard de navegador, 10 anchuras declaradas.

- **Rojo contra `8b3f26d2`** (commit `5aeebba5`): **7 de 10** anchuras.
- **Con el arreglo:** **10 de 10 de acuerdo.** El concepto pasa de 0 px a 458–713 px en la banda
  rota, y el móvil se queda exactamente como estaba (298 px).

Lo que exige, y por qué cada cosa:

- 🔴 **A** · cada rótulo CABE en su caja (`scrollWidth <= clientWidth`).
- 🔴 **B** · el concepto es el campo **más ancho** de la línea. No es gusto: es el contrato de AB3,
  «concepto a ancho completo (protagonista)».
- ⛔ **C** · NEGATIVO: sin scroll lateral en ninguna anchura (AB3).
- ✅ **D** · POSITIVO: a 390 px el concepto sigue ocupando la línea entera. El arreglo no puede
  pagarse rompiendo el móvil, que es donde trabaja el profesional.

### 🔴 Por qué este guard NO compara los rectángulos de los dos rótulos

Es lo primero que uno escribe al leer «los rótulos se pisan». Y está mal:

    UN GUARD POR INTERSECCIÓN DE CAJAS SALE **VERDE** CONTRA ESTA PANTALLA ROTA.

Medido: a 1280 px las cajas de «Concepto» y «Cantidad» **no se cruzan** — hay 12 px de hueco entre
columnas. Lo que se cruza es el TEXTO, que se desborda de una caja de 0 px. Un guard verde sobre la
pantalla rota no es un guard flojo: **es un guard que miente en la dirección peligrosa, porque da
permiso para cerrar.** Por eso se mide el ANCHO DE LA COLUMNA y si el RÓTULO CABE.

### Por qué no hay red de Node, dicho a propósito

Lo único que un test sobre el fuente podría mirar es si la hoja de estilos dice tal o cual cosa, y
eso es un **proxy** del defecto, no el defecto: el defecto es un número que sólo existe cuando el
navegador resuelve la rejilla. Es exactamente el caso que `docs/equipo/sesion-2.md` usa para
defender que estos guards existan — el fuente se lee bien y la pantalla está rota.

## Errores propios

- La primera versión de la sonda midió **sin teclear**, y a 390 px devolvió ceros en todo. No era
  «está limpio»: era que el editor **pliega la línea vacía a propósito**
  (`.quote-line--vacia:not(:focus-within)`). *Un cero es «no he mirado».*
- El POSITIVO de 390 px comparaba contra `clientWidth`, que incluye el relleno, y **se ponía rojo
  contra una pantalla sana** (298 px dentro de «una línea de 322»). Lo cazó el propio guard en su
  primera pasada. Se mide contra el ancho de CONTENIDO.
- Y el primer arreglo —plegar sólo el concepto— dejó el desbordamiento lateral de 1180/1280/1366 en
  pie, porque la fila de números **sola** necesita 594 px y ahí sólo hay 458. Lo destapó el guard,
  no la lectura: de ahí el tercer estado.

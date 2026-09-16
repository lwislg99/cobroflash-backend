# SCRUM-350 · `.modal-footer` envuelve en vez de desbordar

**Fecha:** 5-ago-2026 · **Carril:** UI (componente compartido) · **Gate:** ninguno

**Medido contra:** `origin/main` = `74c6270f7f8ede9faedc8aa81c7951ee4d1e4a58` · 2026-08-05T05:38:32+01:00

**Suite en esa base:** 1406 tests · 1339 pass · **0 fail** · 67 skip
**Suite con este cambio:** 1418 tests · 1351 pass · **0 fail** · 67 skip · exit **0** (+12)

> `prisma/schema.prisma` intacto. Sin BD, sin red, sin producción: el cambio es una declaración
> de CSS y el guard es estático.

## El defecto no era el rótulo

SCRUM-289 lo dejó declarado y sin arreglar a propósito: el pie de su modal se salía a 390 px con
el marcador `[PENDIENTE microcopy oficial]` (29 caracteres), y ajustar el layout contra un texto
que va a ser sustituido es optimizar para lo que no se queda.

Lo que se queda es el contenedor. `.modal-footer` es `display:flex` **sin `flex-wrap`**, y los
botones traen `white-space: nowrap` (`styles.css`, bloque `.btn*`). O sea: **ni el texto del
botón parte, ni la fila se parte**. No hay ninguna vía por la que el contenido ceda, así que lo
que no cabe se sale.

Y se sale **por la izquierda**, porque el pie alinea a `justify-content: flex-end`. Eso importa
más de lo que parece: un desbordamiento a la derecha deja rastro en `scrollWidth` y a veces una
barra; éste no deja ninguno de los dos. El botón se va fuera de la pantalla y **no hay scroll que
lo alcance**.

## El censo va primero porque el arreglo es compartido

Una línea de CSS aquí alcanza a todos los modales del dashboard a la vez. La pregunta que decide
si el cambio es seguro no es «¿se arregla el que se rompe?» sino «¿cuáles hay?».

Censo **derivado por AST** (`tests/_censo-modal-footer.mjs`), no una lista a mano. Este repo
escribe los pies de **tres formas distintas**, y una lista basada en cualquiera de ellas habría
perdido las otras enteras:

| forma | cómo se escribe | pies |
|---|---|---|
| `plantilla` | HTML dentro de un template literal | 5 |
| `createElement` | `document.createElement('div')` + `.className` | 4 |
| `helper` | `createElement(tag, clase, texto)` propio de la vista | 1 |

**10 pies**, en 9 ficheros. El censo resuelve identificadores (`NF_PENDIENTE` → el marcador de 29
caracteres) y ternarios (`${isEdit ? 'Guardar cambios' : 'Añadir gasto'}` → la rama larga, que es
la que decide el ancho).

## El caso peor es el REAL, y se mide en píxeles

Contar caracteres no mide un ancho. Los diez pies se montaron en **Edge real con el CSS de
verdad** (servidor estático efímero sobre `public/`, sin BD ni auth ni servidor de la app) dentro
de su modal auténtico —clase y `style` en línea incluidos— y se midieron a 390 y 360 px.

Holgura a 360 px (x del primer botón − borde útil del pie):

| pie | holgura |
|---|---|
| `nuevaFacturaModal.js:171` | **−137 px** ← el único roto |
| `homeView.js:723` | 0 px |
| `customerDetailView.js:326`, `customersView.js:189`, `expensesView.js:319` | 82 px |
| `jobDetailView.js:1054` | 103 px |
| `productsView.js:125`, `providersView.js:61` | 136 px |
| `quotesView.js:163` | 180 px |
| `quotesView.js:1939` | 251 px |

El roto: primer botón en **x = −83** a 390 px y **x = −113** a 360 px.

## El arreglo

Una declaración: `flex-wrap: wrap` en `.modal-footer`. Y lo que la hace segura en un componente
compartido es que **es un no-op cuando los botones caben en una línea**.

## Las dos caras, probadas con hashes y no con «se ve igual»

Las 20 capturas (10 pies × 2 anchos) antes y después, comparadas por SHA-256:

**18 idénticas byte a byte. Las 2 que cambian son las del pie roto.**

Incluye los dos casos que más riesgo tenían de moverse: `homeView` (0 px de holgura, y además el
único con reglas propias — el bloque `.qq-modal` de `styles.css`) y `customerDetailView` (el más
justo de los ordinarios). Los dos, idénticos.

## Verificación

| qué | cómo |
|---|---|
| Censo completo | AST, tres formas, con **suelo por forma**: si un detector deja de reconocer la suya, el conteo baja y cae |
| Nada fuera del censo | guard de **cobertura**: barre el repo buscando el token y falla si aparece en un fichero que el censo no mira. «Encontré 10» y «no hay un 11º donde ni miro» son dos preguntas |
| El arreglo sigue puesto | se **parsean las declaraciones** de la regla, no se busca texto |
| **La otra cara** | las otras cuatro declaraciones (`display`, `justify-content`, `gap`, `padding`) se fijan, y `flex-direction` se exige ausente: son las que decidían el aspecto de los nueve que ya cabían |
| **Probado en rojo** | quitada la línea del fichero real, cae **ese** test y solo ése (11 pass / 1 fail) |
| **Rojo del censo** | con la clase renombrada en una fuente, el conteo baja de 10 a 9; quitando un botón, ese pie pasa de 2 a 1 |
| Control negativo (texto) | el comentario que explica el arreglo **contiene la cadena `flex-wrap`**: se comprueba que el guard no la acepta como si fuera la declaración |
| Control negativo (`@media`) | un `flex-wrap` metido solo dentro de `max-width: 639px` **no** cuenta: dejaría el componente roto fuera de esa ventana |
| Control negativo (censo) | `.modal-share` también es flex y ya lleva `flex-wrap: wrap`; no se cuela como pie |
| Control negativo (banco) | con el arreglo puesto, un botón imposible de encajar **sigue** dando «1 fuera»: el 0 de después es una medición, no un detector averiado |

## Dos defectos que cazó la casa, no una revisión

1. **Un verde falso, y era el mío.** La primera tanda del banco dio «no desborda» en los diez.
   Lo delató una incoherencia interna: `nuevaFacturaModal` marcaba **2 filas de botones con
   `flex-wrap: nowrap`**, que es imposible, y `alto = 22 px` con `.btn` en `min-height: 36px`.
   La página se montaba con `setContent()`, cuya URL base es `about:blank`: `/tokens.css` y
   `/dashboard/css/styles.css` no resolvían y **se pintaba sin CSS**. Sin hoja de estilos,
   `.modal-footer` es un `display:block` con botones en línea — y los botones en línea envuelven
   solos. El defecto era invisible por construcción, en la dirección cómoda. El banco se sirve
   ahora por HTTP y **arranca con un suelo propio**: si `.modal-footer` no computa `display:flex`
   y `padding: 0px 24px 20px`, para y no informa.

2. **`scrollWidth` no veía el desbordamiento.** Con `justify-content: flex-end` el contenido se
   sale por la izquierda, y `scrollWidth` solo mide por la derecha: decía `false` con el botón a
   83 px fuera de la pantalla. La medición se hace con los **rectángulos** de cada botón contra
   el borde del modal.

Y un tercero, de precisión del censo: una tabla plana por fichero mezclaba variables homónimas.
`quotesView.js` tiene dos modales y las dos funciones llaman `modal` a su contenedor, así que el
pie de la línea 163 salía con la clase del de la 1939 (`quote-ajustes-modal`, otro `max-width`) y
se habría medido sobre un modal que no es. El censo indexa por **la función que declara** cada
variable.

## Lo que este ticket NO arregla, dicho

- **El límite que queda.** Si algún día un rótulo suelto es más ancho que el pie, envolver la
  fila no lo salva: `.btn*` lleva `white-space: nowrap` y el botón no parte su texto. **Hoy no
  pasa** — el botón más ancho mide 220 px y el hueco a 360 px es de 312. Es el caso que fabrica
  el control negativo del banco.
- **Nota para quien aterrice la microcopy de SCRUM-289 (regla 30):** cuando el marcador se
  sustituya por el rótulo oficial, **hay que volver a mirar ese pie**. Que quepa con un texto
  concreto no arregla el contenedor; lo que sí lo arregla es esto, y por eso el orden importa —
  el rótulo final puede caber o no, y en ambos casos el pie ya no se sale.

## 🔴 Hallazgo (otro carril, se reporta y no se arregla — regla 9)

**Los botones de tres pies no reciben el target táctil de 44 px.** `styles.css:1466` sube
`.btn { min-height: 44px }` en móvil, pero algunas vistas escriben sus botones como
`class="btn-primary"` / `class="btn-secondary"` **sin la clase `btn`**, y se quedan en 36 px.
Medido a 390 px, altura real de cada botón:

| pie | clase | alto |
|---|---|---|
| `nuevaFacturaModal.js:171` | `btn-secondary` / `btn-primary` | **36 px** |
| `jobDetailView.js:1054` | `btn-secondary` / `btn-primary` | **36 px** |
| `quotesView.js:1939` | `btn-primary` | **36 px** |
| los otros siete pies | `btn btn-*` | 44 px |

Es el checklist AB6 («targets ≥44 px»), no este ticket: arreglarlo cambia el alto de esos
modales, que es justo lo que este PR se compromete a no tocar. Medido, no deducido — el primer
borrador de esta nota culpaba a «`quotesView`» entera, y la medición enseñó que su otro pie
(`:163`) sí lleva `btn` y sí llega a 44.

---

**HUECO PENDIENTE (humano, del fundador, por bloque):** la **matriz de dispositivos reales**
(Android gama media / iPhone / tablet, V0-5). No se finge y no se da por hecha: estas capturas
salen de un navegador de escritorio redimensionado a 390 y 360 px, que no sustituye a un
dispositivo real.

# SCRUM-368 · Anillo de foco visible en `.btn-primary` (y la medición que separa 352 de 368)

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `7503c894d45c8b3f55c6debc6eb12822c56a4191` · 2026-08-05T15:35:29+01:00

> **Re-anclado.** La medición se hizo primero contra `1ef584cb6f16dad91bbb20fa33d7ad4d62e9165c`
> (2026-08-05T15:10:25+01:00) y `main` avanzó 3 commits mientras corría. Ninguno toca
> `styles.css`, `tokens.css` ni los ficheros de este trabajo, pero el ancla de arriba es la de la
> suite y del navegador **contra el `main` resultante del rebase**. Rama: sufijo `-rebasada`,
> sin `--force`.

---

## Primero: SCRUM-352 y SCRUM-368 daban el mismo número con causas incompatibles

Los dos decían **36 px**. SCRUM-352 lo achacaba **al markup** (tres sitios escriben
`btn-primary` sin la clase `btn`, que es la que sube el target en móvil) — o sea, el CSS estaría
bien. SCRUM-368 lo achacaba **a la clase compartida**, y lo aisló creando botones limpios fuera
del modal — o sea, el CSS estaría mal. **Ninguno de los dos declaraba a qué ancho midió.**

Medido en navegador real (Chromium, CSS de producción servido con el mismo orden de hojas que
`public/dashboard/index.html`), con botones limpios fuera de todo modal:

| Clase escrita | 360 px | 390 px | escritorio 1280 px |
| --- | --- | --- | --- |
| `btn btn-primary` (bien escrito) | **44 px** | **44 px** | **36 px** |
| `btn-primary` (sin `btn`) | **36 px** | **36 px** | **36 px** |
| `btn` (base sola) | **44 px** | **44 px** | **36 px** |

**Los dos tickets aciertan en una parte y ninguno describe el defecto entero.**

- **352 acierta**: `btn btn-primary` bien escrito **sí** da 44 px en móvil, y `btn-primary` a
  secas da 36. Su causa raíz es real y sus tres sitios están mal escritos.
- **368 acierta**: la clase compartida **sí** da 36 px… **en escritorio**, donde la media query
  no aplica. Su aislamiento fue correcto; lo que le falta es el ancho.
- **En qué NO coinciden**: 368 concluye «afecta a todo el producto» a partir de una medición que,
  a 360/390 px, da 44 px para el markup bien escrito. Esa generalización no se sostiene **para el
  tamaño**. A la inversa, 352 dice «el CSS estaría bien» y tampoco: el CSS declara por escrito
  (`styles.css:376-377`) que las variantes «también funcionan solas», pero el bump móvil de la
  línea 1473 solo alcanza a `.btn`. **El CSS promete algo que no cumple.**

El mecanismo, entonces, es uno: `.btn, .btn-primary, .btn-secondary, .btn-danger, .btn-ghost`
comparten `min-height: 36px` (línea 395), y dentro de `@media (max-width: 768px)` solo
`.btn { min-height: 44px }` (línea 1473). Quien no escriba `btn` se queda fuera del bump.

> **Ni el tamaño ni el contraste se tocan aquí.** El tamaño depende de qué manda —`DESIGN.md` o
> el CSS— y el contraste (3,3:1 frente a 4,5:1 de WCAG AA) puede exigir mover el verde de marca,
> que es identidad y decisión del fundador (**regla 30**), y choca con la regla escrita de que la
> marca es luminosa, nunca oscura. **Lo que sí sale aquí es el foco**, que es lo único de los dos
> tickets que no discute nadie.

---

## El foco: medido con Tab REAL, no con `.focus()`

El comentario de SCRUM-368 ya avisaba de que `.focus()` no siempre dispara `:focus-visible`. Se
confirmó en el camino: llamando `.focus()` sobre `.btn-danger` el navegador **no** activa
`:focus-visible` y el elemento parece no tener anillo. Con `Tab` real, sí lo tiene.

Se midió además **por píxeles**, no por `getComputedStyle`: se captura cada parada en reposo y
enfocada y se comparan los bytes. Dos razones, las dos aprendidas midiendo:

1. **Es el criterio del usuario.** «Hay anillo» significa que la pantalla cambia, no que una
   propiedad tenga cierto valor.
2. **`getComputedStyle` miente durante la transición.** Los botones llevan
   `transition: … box-shadow .15s`, y leer justo tras el `Tab` devuelve el valor interpolado —en
   headless, a veces el inicial. La primera pasada dio «sin anillo» para `.btn-secondary`,
   `.btn-danger` y `.btn-ghost`, que sí lo tienen. Se corrigió forzando frames reales
   (`requestAnimationFrame` doble) y esperando a que asiente.

**Resultado, 9 paradas de tabulación a 390 px** — las 3 sin anillo eran `.btn-primary`:

| Parada | `:focus-visible` | Píxeles cambian |
| --- | --- | --- |
| `.btn.btn-primary` | true | **NO** |
| `.btn-primary` (sin `btn`) | true | **NO** |
| `.qq-modal .modal-footer .btn-primary` | true | **NO** |
| `.btn.btn-secondary` · `.btn.btn-danger` · `.btn.btn-ghost` · `.btn` · `.input` · `<a href>` | true | sí (6/6) |

## El mecanismo

`:focus-visible { outline: none; box-shadow: var(--ring) }` (`styles.css:94`) es global y de
especificidad **(0,1,0)**. `.btn-primary` (línea 412) declara su sombra de reposo con la **misma**
especificidad y aparece **después** en el archivo: gana la de reposo, y como el `outline` global
ya está anulado, en foco no cambia un solo píxel.

`.qq-modal .modal-footer .btn-primary` (línea 995) gana además **por especificidad (0,3,0)**, así
que necesita línea propia. Sin ella, el botón principal del modal de presupuesto rápido se queda
igual de invisible aunque el suelto ya esté arreglado. **Esto no se dedujo: se descubrió midiendo
ese caso en el navegador.**

No es un error de escritura de nadie: es una trampa que el CSS deja puesta para cualquier clase
que declare `box-shadow` propio.

## El arreglo

```css
.btn-primary:focus-visible { box-shadow: var(--shadow-btn), var(--ring); }
.qq-modal .modal-footer .btn-primary:focus-visible { box-shadow: var(--shadow-brand), var(--ring); }
```

Dos decisiones, las dos para **no** decidir nada de identidad (regla 30):

- **Suma, no sustituye.** El anillo se añade a la sombra de reposo de cada contexto, así que el
  botón enfocado sigue teniendo el mismo cuerpo que sin foco.
- **Reutiliza `--ring`.** Es el mismo token que ya enseñan las otras 6 paradas. Un anillo propio
  —otro color, otro grosor— sería un cambio de aspecto de marca, y eso no lo decide una sesión.

## Las dos caras, por hash de píxeles

36 casillas (2 anchos × 9 paradas × reposo/foco), capturadas con el CSS de `main` y con el
parche, y comparadas hash a hash:

- **Cambiaron 6**: `btn-primary`, `btn-primary` sin `btn` y el del `qq-modal`, **enfocados**, a
  360 y a 390.
- **Idénticas 30**, byte a byte — incluido **el reposo de los propios primarios**: el botón sin
  foco no cambió nada.

## El guard

`tests/scrum368-anillo-foco-primario.test.mjs` + `tests/_censo-anillo-foco.mjs`. No busca texto:
**simula la cascada** del `box-shadow` para un `<button class="btn X">` en `:focus-visible`, que
es la misma pregunta que resuelve el navegador, contestada sobre el CSS real.

- **Deriva del árbol.** Las clases de botón son las que aparecen **agrupadas con `.btn`** en algún
  selector: `btn-danger`, `btn-ghost`, `btn-primary`, `btn-secondary`, `btn-sm`. Una variante
  nueva escrita junto a `.btn` entra sola, y hay un test que lo comprueba inyectando una.
- **Los contextos también se derivan.** Si el CSS le da `box-shadow` a un botón dentro de un
  ancestro concreto, ese contexto se evalúa aparte. Así aparece el caso del `qq-modal`.
- **Suelo.** Si el analizador no encuentra ninguna clase de botón, **falla**. «Todo cumple» y «no
  supe mirar» son el mismo verde. Segundo suelo: si desaparece la regla global `:focus-visible`,
  también falla, porque entonces el guard estaría midiendo el vacío.
- **Rojo por el mecanismo.** Quitado el anillo del fichero, cae nombrando **la clase y el
  contexto**: `.btn-primary → gana '.btn-primary' con box-shadow: 0 1px 2px rgba(5,46,22,.18)` y
  `.btn-primary (dentro de '.qq-modal .modal-footer')`. Verificado sobre el fichero, no solo en
  memoria.
- **Control negativo.** `.btn-secondary`, que siempre tuvo anillo, no salta.

> **El suelo se ganó en el camino.** La primera versión del analizador no reconocía el selector
> `:focus-visible` a secas (no tiene clases) y daba por ciegas a `.btn-secondary`, `.btn-danger`,
> `.btn-ghost` y `.btn-sm`. El navegador decía lo contrario, y el navegador es el árbitro: se
> arregló **el analizador**, no el test.

## Estado de los dos tickets

- **SCRUM-368** — el foco queda **cerrado**. Tamaño y contraste siguen **abiertos**: el primero
  espera a la decisión de qué manda (`DESIGN.md` o el CSS), el segundo a la del verde de marca.
  La conclusión «36 px afecta a todo el producto» necesita el matiz del ancho: en móvil, el
  markup bien escrito da 44.
- **SCRUM-352** — sigue **abierto y es correcto**: sus tres sitios (`nuevaFacturaModal.js:171`,
  `jobDetailView.js:1054`, `quotesView.js:1939`) escriben la clase mal y se quedan en 36 px a 360
  y 390. Su propia pregunta de fondo —arreglar tres instancias o llevar el bump a las variantes en
  el CSS— sigue en pie, y ahora tiene los números para decidirla.

## AB6 — hueco declarado

Capturas de la sesión a 360 y 390 px, antes y después, en `.playwright-mcp/` (sin trackear):
`ANTES-foco-{360,390}.png`, `DESPUES-foco-{360,390}.png`, `ANTES-tamano-{360,390}.png`.

**El pase por matriz de dispositivos reales es HUMANO y sigue sin hacerse.** Se declara como
hueco, y aquí pesa más de lo habitual: el propio SCRUM-368 señala que llevamos semanas cerrando
tickets de interfaz con este hueco abierto y que **éste es el tipo de defecto que ese hueco
esconde**. El foco se ha medido en Chromium headless; **Safari/iOS decide `:focus-visible` con su
propia heurística** y es donde más conviene mirar.


# ═══ SEGUNDA ENTREGA · CONTRASTE ═══

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:02:32+01:00

> Segunda entrega del mismo ticket. La primera cerró el FOCO (arriba); ésta mide el CONTRASTE,
> aplica las dos salidas que no tocan identidad y deja el guard. El tamaño lo cerró SCRUM-352.

## 🔴 EL HALLAZGO QUE VA AL FUNDADOR: dos reglas escritas de la casa se contradicen

> **No existe un verde MÁS CLARO que cumpla AA con texto blanco.** Para 4,5:1 contra blanco hace
> falta una luminancia relativa **≤ 0,175**, y **todo verde que la alcanza es más oscuro que
> `--brand`**. Aclarar el verde **empeora** el contraste, no lo mejora.
>
> `DESIGN.md` dice que la marca es **luminosa, nunca oscura**. WCAG AA con texto blanco exige lo
> contrario. **Las dos reglas escritas no pueden cumplirse a la vez en el botón primario.**

Medido, no razonado. `--brand` `#16a34a` tiene luminancia 0,2159, por encima del máximo de 0,175:

| Verde | Ratio con blanco | ¿Más claro que `--brand`? |
| --- | --- | --- |
| `--brand` `#16a34a` | **3,30** | — |
| `--brand-bright` `#22c55e` | 2,28 | sí → **peor** |
| `#4ade80` | 1,74 | sí → **peor** |
| `#86efac` | 1,40 | sí → **peor** |
| `--brand-700` `#15803d` | 5,02 ✅ | **no, es más oscuro** |

Esto **cierra una puerta que todo el mundo daba por abierta**. Cualquiera que en el futuro proponga
«pues buscamos un verde más claro» se va a encontrar con que no existe, y ahora está medido con el
umbral exacto. Hay un test que lo comprueba y que se pondría rojo si el cálculo cambiara.

**No es un detalle de CSS: es una decisión de identidad.** O el botón primario deja de cumplir AA
con texto blanco, o `DESIGN.md` cambia, o el texto del botón deja de ser blanco/pequeño.

---

## Cómo se midió

384 nodos de texto en **9 páginas reales**, cargadas en Edge vía `puppeteer-core`. Para cada uno:
color computado y **fondo efectivo real** (subiendo por ancestros y componiendo transparencias).

> **El censo estático del CSS se probó primero y se descartó.** Daba `.sidebar-logo-text` en
> **1,00** (blanco sobre blanco) porque no sabía que ese texto vive dentro del sidebar oscuro, y
> componía mal los `rgba()`. También marcaba `.nav-item.active` y `.nav-subitem.active` como
> fallos, cuando medidos en su contenedor real dan **5,89** y **6,51**. Adivinar ancestros no
> funciona: **el navegador es el árbitro**.

## Lo que se encontró: 71 nodos bajo AA, 9 pares distintos

Tres problemas concentraban casi todo:

| | Par | Ratio | Nodos |
| --- | --- | --- | --- |
| **A** | blanco sobre `--brand` (botón primario) | **3,30** | 10 |
| **B** | `--brand` como **texto** sobre blanco (enlaces, eyebrows) | **3,30** | 10 |
| **C** | `--muted` sobre `--bg` (metadatos) | **4,44** | 31 |

**B no estaba en el ticket.** El verde falla **dos veces** —como fondo con blanco encima y como
color de texto sobre blanco— y nadie lo había mirado por el segundo lado.

## Lo aplicado

### C · `--muted` `#6b756f` → `#6a746e`

Falla por **0,06**. Basta **−1 por canal**: 4,51 sobre `--bg` y 4,84 sobre `--surface`, e
indistinguible a ojo. **No es color de marca**: es un neutro cálido. Arregla 31 nodos en 8 páginas.

### B1 · el verde de TEXTO es `--brand-tint-ink` `#047857`

`tokens.css:15` **ya lo describía** como «texto sobre `--brand-tint`». El token existía y estaba
documentado para esto; solo hacía falta **separar el rol**:

> `--brand` es el verde de **FONDO**. `--brand-tint-ink` es el verde de **TEXTO**.

**El verde de marca no se mueve un dígito.** Ratios: **5,48** sobre `--surface`, **5,10** sobre
`--bg`. Aplicado en los cuatro sitios que la medición señaló: `.eyebrow` (landing), los enlaces de
`privacidad.html` y `terminos.html`, y `.home-hero-ok` y `.detail-rail-enlace` del dashboard.

**No se tocaron** `.nav-item.active` ni `.nav-subitem.active`: medidos en su contenedor real
cumplen (5,89 y 6,51). Los marcaba el censo estático, no el navegador.

**Resultado: de 71 nodos bajo AA a 23.**

## Lo que NO se ha aplicado: A, el botón primario

Pendiente de decisión con las capturas delante (`.playwright-mcp/A-{login,landing}-{ACTUAL,A1,A2}-390.png`):

| Salida | Ratio | ¿Pasa? | Qué cambia |
| --- | --- | --- | --- |
| **A1** · texto a ≥18,66 px bold | 3,30 | ✅ (umbral 3,0) | **ningún color**; el botón crece de 46 a 50 px |
| **A2** · texto en `--brand-ink` | **4,52** | ✅ | el verde no se toca, pero **se lee peor** |
| A3 · fondo `--brand-700` | 5,02 | ✅ | **oscurece la marca** |
| A4 · borde | **no cambia el ratio del texto** | — | 1.4.11 (3:1) ya se cumple: 3,07 |

> **Observación visual, no medida:** A2 cumple 4,52 y en las capturas **se lee peor** que el blanco
> actual. WCAG mide luminancia, no legibilidad entre dos tonos del mismo matiz. El número solo
> engañaría aquí.

## El guard

**`npm run guard:contraste`** — mide en navegador, como se midió el defecto.

- **Páginas derivadas** del árbol de `public/`: una página nueva entra sola.
- **SUELO**: aborta si mide menos de **50 nodos** con texto. Cero fallos con la página en blanco no
  es «todo cumple», es «no supe mirar».
- **Los gradientes no se aprueban ni se suspenden.** 13 nodos caen sobre fondo con degradado; un
  degradado no tiene *un* ratio, tiene un rango distinto en cada píxel. Se **listan** como no
  medibles, con su página y su clase, para que se sepa que existen y por qué no llevan número.
- **Rojo por el mecanismo**, verificado: degradado `--body` a `#a8b0ac`, el guard cae nombrando el
  par (`rgb(168,176,172)` sobre `rgb(246,247,245)`), **las páginas** y las clases.
- **Control negativo**: restaurado el token, vuelve a verde y el par desaparece del informe.
- **Las excepciones caducan**: si un par de `CONOCIDOS` deja de ocurrir, el guard **también falla**,
  para que se borre. Una excepción que sobrevive a su causa deja de ser una nota y pasa a ser un
  permiso. Verificado inyectando una que no ocurre.

**`tests/scrum368-contraste-tokens.test.mjs`** — la red que sí corre en `npm test`. No es el censo
estático que se descartó: no adivina ancestros, comprueba **pares de tokens explícitos**. Existe
porque el guard de navegador necesita Edge y vive fuera de la suite; sin esto, alguien podría mover
`--muted` y no enterarse hasta que alguien se acordara de correr el guard a mano.

### Hueco declarado

Las vistas del dashboard que se generan por JS con datos de sesión **no** están en la medición
directa. **No invalida el resultado**, porque los colores que fallan son **tokens compartidos**
(`--brand`, `--muted`): cualquier uso hereda su ratio por construcción. Pero una combinación que
solo exista dentro de una vista con datos no la cazaría este guard.

## Lo reportado y no arreglado (regla 9)

- **`admin.html`**, tema oscuro: 8 nodos en 4,17. Superficie interna del fundador.
- **`--muted` sobre `#eaf6ee`** (verde claro de una sección del landing): 4,36. Ese fondo no es un
  token sino un color local; el ajuste de `--muted` se calculó contra `--bg` y `--surface`.
- **Dos mockups del landing** que imitan la UI de WhatsApp (3,21 y 2,32): decorativos.

Los cinco están en `CONOCIDOS` del guard, con motivo, y el guard avisa si alguno desaparece.

## Nota de método

El analizador de SCRUM-258 cazó este script nuevo: `document` y `getComputedStyle` aparecían como
identificadores sin declarar. **Se cambió el código, no el censo** —se toman de `globalThis` dentro
de la función que corre en el navegador— porque el residuo de ese guard no debe crecer para
acomodar código nuevo.


# ═══ TERCERA ENTREGA · A1 MEDIDO Y PARADO, Y EL GUARD DE LAS DOS MITADES ═══

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:02:32+01:00

> Tercera entrega del ticket. La primera cerró el FOCO, la segunda el CONTRASTE de `--muted` y
> del verde como texto. Ésta mide el alcance de **A1** (texto grande en el botón primario), **para
> antes de aplicarlo** por lo que encontró, arregla el landing y deja el guard vigilando las dos
> mitades del motivo por el que un par pasa.

## 🔴 La salida al choque entre reglas fue LA TIPOGRAFÍA, y no el color

La segunda entrega dejó medido que `DESIGN.md` («la marca es luminosa, nunca oscura») y WCAG AA
con texto blanco **no pueden cumplirse a la vez** en el botón primario: para 4,5:1 hace falta
luminancia ≤ 0,175, y todo verde que la alcanza es más oscuro que `--brand`.

**A1 disuelve el choque sin romper ninguna de las dos reglas**, porque no toca el color:

> El texto grande y grueso (≥18,66 px con peso ≥700) tiene umbral **3:1** por SC 1.4.3 de la
> propia norma. No es mover la portería: la norma lo permite porque **es cierto** que el texto
> grande y grueso se lee con menos contraste. Es una **vía de conformidad**, no una excusa.
>
> **La marca sigue siendo luminosa y el botón cumple.** Que la salida a un choque entre `DESIGN.md`
> y AA fuera la tipografía y no el color es el hallazgo de este ticket.

**A2 queda descartada** por lo que un ratio no mide: con `--brand-ink` el ratio sube a 4,52 pero
el texto casi se funde con el fondo y el botón deja de leerse como el botón primario. Un CTA que
nadie distingue es peor para todo el mundo, **incluida la persona con baja visión a la que se
intentaba ayudar**. 4,52 en un botón que no encuentras es peor que 3,30 en uno que sí.

## Condición 1 · El alcance de A1, medido antes de tocar el CSS

68 rótulos reales de botón primario extraídos del front (AST + plantillas), instanciados a
**390 px** en sus dos contenedores habituales —pie de modal con «Cancelar» al lado, y ancho
completo—: **136 botones medidos**.

| | |
| --- | --- |
| Rótulos de botón primario en el front | **68** |
| — de esos, `btn-sm` | **28** |
| — de esos, `btn-lg` | 1 |
| — normales | 39 |
| Botones que **cambian de nº de líneas** | **0** (llevan `white-space: nowrap`: no envuelven, se salen) |

### El cepo de SCRUM-352 se repite, y la misma acotación lo resuelve

| Clase escrita | hoy | A1 amplia | A1 con `:not(.btn-sm)` |
| --- | --- | --- | --- |
| `btn btn-primary` | 13,5px/600 | 18,66px/700 | 18,66px/700 |
| `btn-primary` (sin `btn`) | 13,5px/600 | 18,66px/700 | 18,66px/700 |
| `btn btn-primary btn-sm` | 12,5px/600 | 12,5px/**700** | 12,5px/600 |
| `btn-primary btn-sm` (sin `btn`) | 12,5px/600 | **18,66px/700** ⚠ | 12,5px/600 |

Con la regla amplia, `btn-primary btn-sm` salta a 18,66 px mientras su gemelo con base se queda
en 12,5: **la misma asimetría de SCRUM-352, sobre los mismos 139 conjuntos sin base**. El motivo
también es el mismo: `.btn.btn-sm` es (0,2,0) y gana, pero `.btn-sm` a secas es (0,1,0) y pierde
por orden. `:not(.btn-sm)` reproduce esa derrota y devuelve la simetría.

⚠ **Efecto lateral a decidir:** la regla acotada también sube `btn btn-primary btn-lg` de 15 px a
18,66 px, porque `:not(.btn-sm)` empata en especificidad con `.btn.btn-lg` y gana por orden. Es
1 rótulo del censo.

## 🛑 PARADA · dos rótulos desbordan a 390 px

**No se ha tocado el CSS.** Ninguno de los dos se arregla acortando el rótulo: **la copy es del
fundador**.

| Rótulo | Ancho con A1 | Qué pasa | Dónde |
| --- | --- | --- | --- |
| «Solo disponible tras aceptar el presupuesto» | **409,9 px** | se sale de la pantalla de 390 en pie de modal; **recorta** el texto a ancho completo | `quotesDetailView.js:772` |
| «Así de fácil. Pruébalo con tus datos →» | **359,5 px** | se sale del pie de modal | `landing-demo.js:106` |

Dos datos que ayudan a decidir:

- El primero es un **botón deshabilitado** (`btnInvoice.disabled = true`): no es una acción, es un
  cartel que explica por qué no se puede facturar todavía. Un botón que nadie va a pulsar quizá no
  necesita el objetivo táctil ni la tipografía de un CTA.
- El segundo es el **CTA de la demo del landing**, ya con clase propia (`idemo-cta`).

Ambos caben hoy: solo desbordan **al aplicar A1**.

## Condición 2 · El guard afirma LAS DOS MITADES

> **Regla general, porque volverá a hacer falta: un aprobado que depende de un tamaño de letra hay
> que vigilarlo JUNTO con ese tamaño de letra. Si no, el guard comprueba la mitad de la razón por
> la que pasa.**

Un par que pasa con 3,30 sobre umbral 3,0 tiene **0,30 de margen, y se lo da la letra**. El guard
lleva ahora una lista `POR_TEXTO_GRANDE` donde cada par declara que cumple por esa vía, y sobre el
nodo **real y medido en navegador** afirma las dos cosas: `ratio ≥ 3,0` **Y** `font-size ≥ 18,66px`
**Y** `font-weight ≥ 700`.

Hoy vigila un caso real que ya existía: el «Qu» del logotipo de `precios.html` (verde de marca
sobre el lienzo, 20 px/800, ratio **3,07**). Con texto normal necesitaría 4,5 y no llega; cumple
**solo** porque es grande y grueso.

**Verificado con dos rojos independientes**, cada uno tocando una sola cosa y dejando el color
intacto:

| Mutación | Resultado |
| --- | --- |
| 20 px → **16 px** (peso y color sin tocar) | ✖ *«la TIPOGRAFÍA ya no da derecho al umbral de 3:1 (mide 16px/800)»* — ratio sigue en 3,07 |
| peso 800 → **400** (tamaño y color sin tocar) | ✖ *«la TIPOGRAFÍA ya no da derecho al umbral de 3:1 (mide 20px/400)»* — ratio sigue en 3,07 |

En los dos casos el mensaje nombra **la tipografía, no el color**, y explica las dos salidas:
recuperar la letra, o subir a 4,5:1 que es el umbral sin la vía. Restaurado el fichero, vuelve a
verde (control negativo).

## El landing arreglado: `--muted` sobre el verde de sección

Era un fallo en **la página que ven los desconocidos**, no un «conocido». Costaba una declaración:
`--tintbg` era `#eaf6ee`, un verde de realce **local y más apagado** que el canónico. Se unifica
con `--brand-tint`, que ya existe:

| | ratio con `--muted` |
| --- | --- |
| `#eaf6ee` (antes) | 4,36 ❌ |
| `#ecfdf5` = `--brand-tint` (ahora) | **4,60** ✅ |

Remedido en navegador: **14 nodos sobre ese fondo, ninguno falla**. Y todo lo que ya se leía ahí
mejora (`--ink` 15,78→16,63; `--body` 8,31→8,76; `--brand-tint-ink` 4,94→5,21). Una duplicidad de
color menos, además.

## Los `CONOCIDOS`, ahora con motivo y no solo con el hecho

Quedan **cuatro** (era cinco; el del landing se ha arreglado):

- **`admin.html`** (8 nodos, 4,17): consola interna del fundador, sin ruta desde el producto, con
  paleta oscura de Tailwind que no es la nuestra. **Si algún día se abre a merchants, deja de ser
  aceptable y hay que quitarlo de la lista** — así está escrito en el guard.
- **Los dos mockups de WhatsApp** (3,21 y 2,32): **imitación deliberada de una interfaz ajena, no
  es nuestra paleta.** El teal del avatar y el gris de la marca de hora están copiados de WhatsApp
  para que el visitante lo reconozca de un vistazo. El motivo lleva un **⚠ NO LO "ARREGLES"**
  explícito: si se cambian, el mockup deja de parecerse a WhatsApp y pierde su única razón de estar.
- **Blanco sobre el verde de marca** (10 nodos, 3,30): el botón primario, pendiente de A1.

## Los tres casos de «el navegador es el árbitro», juntos

Tres veces en este ticket un analizador estático dio por malo algo que el navegador aprueba, o al
revés. Los tres, en el mismo sitio para que se lean juntos:

| Caso | Censo estático | Navegador |
| --- | --- | --- |
| `.sidebar-logo-text` | **1,00** (blanco sobre blanco) | vive en el sidebar oscuro: cumple |
| `.nav-item.active` | fallo | **5,89** — el fondo `rgba()` hay que componerlo |
| `.nav-subitem.active` | fallo | **6,51** — ídem |

Ninguno se tocó. La regla que sale de aquí: **cuando el analizador y la realidad discrepan, el roto
es el analizador** — y se distingue de «no ajustes el guard a tu código» por una prueba concreta:
si la forma que el analizador no ve la acabas de introducir tú, se cambia el código; si llevaba ahí
desde antes, se arregla el analizador.

## AB6 — hueco declarado

`.playwright-mcp/368-landing-tintbg-390.png`. La matriz de dispositivos reales sigue siendo humana
y sin hacer. Aquí importa para A1: **un texto de 18,66 px se juzga leyéndolo al sol**, no midiendo
su caja.


## Reglas (las tres entregas)

Regla 4 (vanilla, un componente) · **Regla 30: el verde de marca NO se ha tocado en ninguna de
las tres entregas** · Regla 9 (reportado y no arreglado: el botón primario a 3,30 —A1 medido y
**PARADO** por dos rótulos que desbordan—, `admin.html` y los dos mockups de WhatsApp) · Regla 37.

> **La copy no se toca.** Los dos rótulos que desbordan con A1 no se han acortado: es microcopy
> del fundador (regla 30) y acortarla para que quepa sería resolver un problema de diseño por la
> puerta de atrás.

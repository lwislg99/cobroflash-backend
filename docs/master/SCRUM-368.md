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



# ═══ CUARTA ENTREGA · A1 APLICADO, LA EXENCIÓN NORMATIVA Y EL RESIDUO CONTADO ═══

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:02:32+01:00

## La norma, verificada en la fuente y no citada de memoria

Comprobado en `w3.org` (SC 1.4.3 y su *Understanding*). La excepción **«Incidental»** dice:

> «Text or images of text that are part of an **inactive user interface component** […] have no
> contrast requirement.»

Y el *Understanding* lo dice sin rodeos:

> «User Interface Components that are not available for user interaction (**e.g., a disabled
> control in HTML**) are not required to meet contrast requirements.»

**Dice exactamente lo que el fundador dijo que decía.** Un botón `disabled` no tiene requisito de
contraste — no por conveniencia nuestra, sino porque la norma lo exime.

> ⚠️ **Y de paso corrige algo nuestro.** La misma lista trae la excepción **«Logotypes»**: «Text
> that is part of a logo or brand name has no contrast requirement.» El «Qu» de `precios.html`
> que la tercera entrega puso a vigilar en `POR_TEXTO_GRANDE` **es parte del logotipo**, así que
> está exento y no necesitaba esa vía. Se deja vigilado igualmente —es más estricto que la norma
> y no cuesta nada—, pero queda dicho que su motivo real es otro.

## A1 aplicado: cuatro superficies, no una

El botón primario no vive en un sitio. Cada superficie carga su propio CSS:

| Superficie | Hojas | Dónde se aplicó A1 |
| --- | --- | --- |
| Dashboard | `tokens.css` + `styles.css` | `.btn-primary:not(.btn-sm)` |
| Login / Register | `tokens.css` + `auth.css` | `.btn` (16px → 18,66px) |
| Landing | `tokens.css` + estilos propios | `.btn-primary` y `.btn-lg` |
| Precios | `tokens.css` + estilos propios | `.cta` (16px → 18,66px) |

El `:not(.btn-sm)` solo hace falta en el dashboard, que es donde existen las variantes.

**Un caso que solo apareció midiendo:** en el landing, `.btn-lg{font-size:16px}` se declara
**después** de `.btn-primary` y con la misma especificidad, así que ganaba y dejaba los botones
grandes en 16 px — sin cumplir. Subido también a 18,66.

### `btn-lg`: entra

Medido su único nodo del dashboard («Guardar cambios», `settingsView.js:501`) en pie de modal a
390 px: **192,8 px de ancho, no recorta, no se sale**. Y la incoherencia que señaló el fundador
queda resuelta: era grande de acolchado, no de letra.

### El CTA de la demo: copy aprobada, y una corrección de mi medición

Aplicada la microcopy del fundador: **«Pruébalo con tus datos →»**.

| | ancho con A1 |
| --- | --- |
| «Así de fácil. Pruébalo con tus datos →» | 339,0 px |
| **«Pruébalo con tus datos →»** | **275,6 px** |

Espacio disponible en su contenedor real: 375 px.

> **Corrección:** la tercera entrega dio ese rótulo como «se sale del pie de modal». Ese dato
> estaba mal: lo medí en un **pie de modal genérico**, que no es el contenedor de este CTA. En su
> sitio real cabían las dos versiones. **La copy nueva es mejor por el motivo del fundador —un
> botón dice qué pasa al pulsarlo, no aplaude la demo— no por ancho.**

> **Hallazgo aparte:** `index.html` carga **solo** `/js/atribucion.js` y no tiene ni una mención de
> `idemo`. **Nadie carga `landing-demo.js`**, aunque `docs/SPRINT_DEMO_READY_EXT.md` lo da por
> «publicada» y `atribucion.js:136` y un test asumen que existe y añade su CTA. Reportado, sin
> arreglar (regla 9).

## La exención por componente inactivo, medida en el DOM

No es una lista de excepciones: es una condición sobre el **estado real del nodo**
(`el.disabled`, `[disabled]`, `fieldset:disabled`, `[aria-disabled="true"]`). «Este nodo, porque
está inactivo», no «este nodo, porque lo pusimos en la lista». **Caduca sola por construcción.**

Verificado con el par real (blanco sobre el verde de marca), cambiando **solo** el atributo:

| | Resultado |
| --- | --- |
| `<button disabled>` | ✔ verde — declarado como exento, con su ratio 3,30 a la vista |
| el mismo, **sin** `disabled` | ✖ **rojo** — vuelve al censo |

## 🔴 La prueba encontró un agujero en el guard, y lo arregló

La primera vez que se probó la caducidad, **el guard siguió en verde**. El motivo: `CONOCIDOS`
comparaba **por par de colores**, así que un nodo NUEVO que reutilizara dos colores ya listados
entraba sin que nada avisara. La excepción se escribió para unos nodos concretos y acabaría
amparando a cualquiera.

Arreglado: cada conocido declara **cuántos nodos** aporta, y el guard falla si el par **gana** o
**pierde** nodos. Verificado colando un `.btn-primary` de 13 px en el landing:

```
✖ UN PAR CONOCIDO HA GANADO NODOS: rgb(255, 255, 255) sobre rgb(22,163,74)
   esperados 2, medidos 3
   ejemplos: … · /index.html .btn.btn-primary «Solo disponible tras aceptar»
   La excepción se escribió para los nodos que había, no para los que vengan.
```

> Sin la prueba que pidió el fundador, este agujero habría entrado con el guard en verde. **Una
> excepción por par de colores no es una excepción: es un permiso para ese par en cualquier sitio.**

## 🔴 EL RESIDUO, que es lo que queda vivo del ticket

A1 salva los botones grandes y **deja suspendidos los pequeños**. No es un olvido: a un botón
pequeño no se le puede poner letra de 18,66 px sin dejar de ser pequeño.

### Nodos bajo AA después de A1, en las 9 páginas medidas

| | Públicas | Tras login |
| --- | --- | --- |
| **Nodos bajo AA (reales)** | **4** | **8** |
| — de ellos, `btn-sm` primarios | 0 | 0 |
| Sobre gradiente (no medibles) | 3 | 11 |
| Exentos por componente inactivo | 0 | 0 |

Los 4 públicos son **mockups decorativos del landing** que imitan la interfaz de WhatsApp
(`send-btn`, `tnum-b`, `wa-av`, y la marca «YaQu» dentro de una burbuja de chat). Los 8 de tras el
login son todos de `admin.html`, la consola interna.

### Los `btn-sm` primarios: 28, todos tras el login

Las páginas estáticas no los contienen —viven en las vistas JS del dashboard—, así que su cuenta
sale del censo derivado del front:

| | |
| --- | --- |
| Rótulos de botón primario con `btn-sm` | **28** |
| — en páginas **públicas** | **0** |
| — **tras el login** | **28** |

Con `12,5px/600` no tienen derecho al umbral de 3,0: les toca **4,5** y están en **3,30**.

Repartidos por vista: `invoiceDetailView` 3 · `quotesListView` 3 · `settingsView` 3 ·
`customersView` 2 · `invoicesView` 2 · `jobDetailView` 2 · `productsView` 2 · `quotesDetailView` 2 ·
`templatesView` 2 · `aiQuoteAssistant` 1 · `customerDetailView` 1 · `expensesView` 1 · `homeView` 1 ·
`quoteRequestsView` 1 · `signaturePad` 1 · `teamView` 1.

> **La decisión que queda no es de CSS.** Ninguna sesión puede resolverla, porque la medición ya
> demostró que **no hay tercera salida**: no existe un verde más claro que cumpla (haría falta
> luminancia ≤ 0,175 y `--brand` está en 0,2159), y uno más oscuro rompe la regla escrita de que
> la marca es luminosa. Así que: **o se toca `--brand`, o se acepta por escrito que los 28 botones
> pequeños del dashboard no cumplen AA.** Ninguna de las dos la decide una sesión.

## Observación reportada y no arreglada (regla 9)

`quotesDetailView.js:772` — `btnInvoice.textContent = 'Solo disponible tras aceptar el
presupuesto'` con `btnInvoice.disabled = true`. **Es un cartel disfrazado de botón**: un control
inactivo que lleva dentro la explicación de por qué no se puede pulsar. Funciona y está exento de
contraste por la norma, pero un texto explicativo no es la etiqueta de una acción. No se toca aquí.

## AB6 — hueco declarado

La matriz de dispositivos reales sigue siendo humana y sin hacer. Para A1 pesa: **un texto de
18,66 px se juzga leyéndolo al sol**, no midiendo su caja.



# ═══ QUINTA ENTREGA · LA TERCERA SALIDA, MEDIDA ═══

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:02:32+01:00

## 🔴 «No hay tercera salida» era una conclusión sobre el TOKEN, no sobre el COMPONENTE

La cuarta entrega concluyó que solo cabían dos caminos: tocar `--brand` o aceptar los botones
pequeños. **Esa conclusión era correcta sobre el espacio que se buscó, y el espacio era más
estrecho que la frase.** Se midieron verdes *más claros* para el fondo con texto blanco; nunca se
evaluó **usar otro token de la familia como fondo del componente pequeño**.

El contraste es simétrico: si `--brand-tint-ink` `#047857` da 5,48 como TEXTO sobre blanco,
**blanco sobre `#047857` da 5,48 también**. Y ese token ya existe y ya se usa en el producto.

### La candidata, medida en navegador (no calculada)

| | color | fondo | tamaño | umbral | ratio | ¿AA? |
| --- | --- | --- | --- | --- | --- | --- |
| `btn-primary btn-sm` **hoy** | blanco | `--brand` `#16a34a` | 12,5px/600 | 4,5 | **3,30** | ❌ |
| `btn-primary btn-sm` **candidata** | blanco | `--brand-tint-ink` `#047857` | 12,5px/600 | 4,5 | **5,48** | ✅ |
| `btn-primary` grande (A1, sin tocar) | blanco | `--brand` | 18,66px/700 | 3,0 | 3,30 | ✅ |

**Cumple sin tocar `--brand` y sin inventar ningún color.** Captura a 390 px con los dos
conviviendo —en tarjeta y en fila de tabla—: `.playwright-mcp/368-candidata-btnsm-390.png`.

**Observación visual (no medida):** parece un sistema, no un error. El tono oscuro se lee como
«acción de la misma familia, subordinada», y de hecho **refuerza** la jerarquía: el grande sigue
mandando. En la fila de tabla también funciona.

### ¿Lo prohíbe `DESIGN.md` leído literal? — La respuesta tiene dos mitades

**La regla que se citó NO lo prohíbe.** Y lo dice el propio documento:

- La frase es del apartado de personalidad: «Es un producto **luminoso, nunca oscuro**» (l. 86).
- El *Don't* literal acota a la base: «nada de **modo oscuro como base**» (l. 206).
- Y `DESIGN.md` **prescribe** una superficie oscura: la navegación lleva «**Fondo Tinta muy
  oscuro**, texto blanco a baja opacidad» (l. 185).

Un componente pequeño con un tono más oscuro de la familia no es «modo oscuro como base». **La
lectura del fundador es correcta.**

**Pero hay otra línea, que no se citó, y ésa sí choca de frente:**

> **Buttons → Primary:** «fondo Verde Confianza (**#16a34a**), texto blanco, peso 700, padding
> 12px 20px» (l. 159)
>
> y en los tokens de componente: `button-primary.backgroundColor: "{colors.brand}"` (l. 57-58).

Eso no es una regla de sensación: es la **especificación del componente**, con el hex escrito.
Un `btn-primary` con otro fondo la contradice mientras siga llamándose primario. La salida
limpia sería declarar en `DESIGN.md` una variante pequeña con su propio fondo — pero eso es
**cambiar el documento**, y no lo hace una sesión (regla 30).

**Y un tercer dato, que juega A FAVOR de la candidata y que nadie había puesto sobre la mesa:**

> **La Regla de Una Sola Voz.** «El verde de marca ocupa ≤10% de cualquier pantalla… **Una
> pantalla = un botón verde primario**» (l. 123), reforzada en los *Do*: «usar un solo botón
> Verde Confianza por pantalla» (l. 196).

Hoy hay **35 sitios** con `btn-primary btn-sm` además de los primarios normales, así que hay
pantallas con varios botones verdes: **la Regla de Una Sola Voz ya se incumple**. Sacar los
pequeños del verde de marca no solo arregla el contraste — **acerca el producto a una regla
escrita que hoy no cumple**.

## El residuo, contado y con contador

`tests/scrum368-residuo-btn-sm.test.mjs`, en `npm test`.

| | |
| --- | --- |
| Sitios con `btn-primary btn-sm` | **35** |
| — en páginas **públicas** | **0** |
| — **tras el login** | **35** |

> ⚠ **35 sitios, no 28.** El 28 de la cuarta entrega contaba **rótulos distintos**; éste cuenta
> **conjuntos de clases**, o sea sitios donde se escribe la combinación. Varios comparten rótulo.
> El número que responde a «cuántos botones no cumplen» es **35**.

El test vigila tres cosas y cae si el residuo **sube o baja** (bajar es una mejora que hay que
anotar, no un verde silencioso). Tiene **suelo** (si el censo se queda ciego, falla), **control
negativo** (un `btn-secondary btn-sm` es 17,52:1 y no cuenta) y un test aparte que exige que
**ninguno esté en superficie pública** — que es la razón por la que el residuo se puede aceptar.

**Rojo verificado** añadiendo un `btn-primary btn-sm` más: *«el residuo de contraste era 35 y
ahora es 36»*, nombrando fichero y línea.

> **Un residuo aceptado sin contador se convierte en un residuo creciente.** Por eso el contador
> entra decida lo que decida el fundador: si se aplica la candidata, baja a 0 y el test lo dice.

## Observaciones que se quedan escritas (regla 9)

- **`quotesDetailView.js:772`** — `btnInvoice.textContent = 'Solo disponible tras aceptar el
  presupuesto'` con `btnInvoice.disabled = true`. **Un cartel disfrazado de botón**: un control
  inactivo cuya etiqueta es la explicación de por qué no se puede pulsar. No tiene víctima hoy
  —está exento por la norma y se lee—, así que **no abre ticket**: queda anotado aquí.
- **`landing-demo.js` no es alcanzable hoy** → **SCRUM-376**. `index.html` carga solo
  `atribucion.js` y no menciona `idemo` ni una vez. La microcopy aprobada en la cuarta entrega
  **se aplicó a código que ningún visitante ve**; el cambio no hace daño y se deja como está.
  · ⚠️ **Actualizado el 5-ago-2026 (SCRUM-376): el fichero se RETIRÓ**, así que ese «se deja como
    está» ya no aplica — la copy aprobada se fue con él. La medición de la tabla de arriba
    (`landing-demo.js:106`, 359,5 px) sigue siendo cierta de cuando se hizo: se conserva como
    registro, no como estado actual.

## El hallazgo de método de la noche

> **«Una excepción por par de colores no es una excepción: es un permiso para ese par en
> cualquier sitio.»**

Y cómo apareció importa tanto como la frase: **la prueba de caducidad salió verde la primera
vez**, y en vez de darla por buena se fue a ver por qué. Sin esa prueba, el guard entraba en
verde vigilando un permiso abierto.

Ese mismo patrón se repitió dos veces más en la sesión, las dos con pruebas que **no probaban lo
que parecían**: un botón inyectado en `login.html` que no reproducía el par (esa página no carga
`styles.css`), y una inyección con `replace('export', …)` sobre un fichero **que no tiene**
`export`. Las dos salieron «verdes» sin haber ejercitado nada. La regla que queda:

> **Una prueba de rojo que sale verde no es una prueba superada: es una prueba que no se ha
> ejecutado. Antes de creerse el verde, hay que comprobar que la mutación llegó a aplicarse.**



# ═══ SEXTA ENTREGA · LA ENMIENDA PROPUESTA Y EL CENSO DE LAS OTRAS VARIANTES ═══

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:02:32+01:00

**Nada aplicado al CSS.** La enmienda es una **propuesta**; la decisión espera a la captura.

---

## 📝 ENMIENDA PROPUESTA A `DESIGN.md` — no aplicada

### Qué cambia, exactamente

En **Buttons** (l. 157-163), donde hoy se lee:

> **Primary:** fondo Verde Confianza (#16a34a), texto blanco, peso 700, padding 12px 20px.

se añadiría una línea, y **solo** una:

> **Primary (small):** fondo Verde Tinta Medio (`--brand-tint-ink`, **#047857**), texto blanco.
> La variante pequeña del botón primario **no** usa el Verde Confianza.

Y en los tokens de componente (l. 55-64), junto a `button-primary`:

```yaml
  button-primary-small:
    backgroundColor: "{colors.brand-tint-ink}"
    textColor: "{colors.surface}"
```

**Lo que NO cambia:**

- `--brand` **#16a34a** no se toca. Sigue siendo el Verde Confianza.
- El **botón primario normal** no se toca: fondo `--brand`, texto blanco.
- El **botón grande** (`btn-lg`) no se toca.
- Ninguna otra variante (`secondary`, `ghost`, `danger`) se toca.
- La paleta no gana ningún color: `--brand-tint-ink` **ya existe** en `tokens.css` y ya se usa en
  el producto (es el verde de texto desde la segunda entrega de este ticket).

### La medición que lo motiva

| | ratio | ¿AA? |
| --- | --- | --- |
| `btn-primary btn-sm` hoy (blanco sobre `--brand`) | **3,30** | ❌ (umbral 4,5) |
| `btn-primary btn-sm` propuesto (blanco sobre `--brand-tint-ink`) | **5,48** | ✅ |

Medido en navegador, no calculado. Y **no hay alternativa por el lado claro**: para 4,5:1 con
texto blanco hace falta luminancia **≤ 0,175**, y `--brand` está en **0,2159**. Todo verde que
cumpla es más oscuro que el de marca; aclarar **empeora** (`--brand-bright` da 2,28).

Al botón pequeño no se le puede aplicar la salida del grande —texto de 18,66 px— **sin dejar de
ser pequeño**. Por eso necesita una respuesta propia.

### Y lo que hace que esto sea enmendar y no rebajar

`DESIGN.md` tiene una regla con nombre que **hoy no se cumple**:

> **La Regla de Una Sola Voz** (l. 123): «El verde de marca ocupa ≤10% de cualquier pantalla…
> **Una pantalla = un botón verde primario**», reforzada en los *Do* (l. 196): «usar un solo
> botón Verde Confianza por pantalla».

Hoy hay **35 sitios** con `btn-primary btn-sm` **además** de los primarios normales, así que hay
pantallas con varios botones en Verde Confianza. Sacar los pequeños del verde de marca **reduce
el número de voces por pantalla**: acerca el producto a una regla que el documento ya exige.

> **Esta enmienda hace que `DESIGN.md` describa un producto MÁS coherente que el actual, no que
> describa el actual.** No rebaja el listón para que cuadre con lo que hay: mueve lo que hay
> hacia una regla escrita que hoy se incumple, y de paso arregla el contraste. Si la única
> motivación fuera el contraste, la salida honesta sería aceptar los 35 y dejarlo escrito.

**Decisión del fundador (regla 30).** Ninguna sesión enmienda el sistema de diseño.

---

## ③ Las otras variantes pequeñas: qué pasa si se aplica la candidata

### El dato que decide

**Hoy, en las cuatro variantes, hacerse pequeño NO cambia el color.** Medido:

| Variante | Grande | Pequeño | ¿Mismo color? |
| --- | --- | --- | --- |
| `btn-primary` | blanco sobre `#16a34a` · 3,30 | blanco sobre `#16a34a` · 3,30 | **sí** |
| `btn-secondary` | tinta sobre blanco · 17,52 | tinta sobre blanco · 17,52 | **sí** |
| `btn-ghost` | apagado sobre blanco · 4,77 | apagado sobre blanco · 4,77 | **sí** |
| `btn-danger` | rojo sobre rojo claro · 4,41 | rojo sobre rojo claro · 4,41 | **sí** |

`btn-sm` es hoy **puramente dimensional**: cambia `font-size`, `padding` y `min-height`, y nada
más. Esa es una regla implícita que el sistema cumple 4 de 4.

**Con la candidata, `btn-primary` sería la única variante en la que el tamaño cambia el color.**

| | conjuntos | ¿mantiene la regla «pequeño = mismo color»? |
| --- | --- | --- |
| `btn-secondary btn-sm` | 66 | sí |
| `btn-ghost btn-sm` | 43 | sí |
| **`btn-primary btn-sm`** | **35** | **NO — sería la excepción** |
| `btn-danger btn-sm` | 7 | sí |
| `btn-sm` solo | 1 | sí |
| **Total con `btn-sm`** | **152** | 117 la mantienen, 35 la rompen |

**Ninguna otra variante queda más oscura ni más clara que su hermana grande**: las tres restantes
no se tocan y siguen idénticas al grande. La incoherencia no es que otras variantes se descuadren
—no lo hacen—: es que **el significado de `btn-sm` dejaría de ser uniforme**. Hoy quiere decir
«el mismo botón, más pequeño»; después querría decir eso para tres variantes y «otro color
además» para una.

Eso puede ser aceptable —la enmienda lo declararía por escrito, que es justo lo que lo separa de
una incoherencia— pero **es lo que se compra**, y conviene comprarlo sabiéndolo. No se arregla
aquí.

### 🔴 Hallazgo aparte, que no venía en ninguna pregunta

**`btn-danger` da 4,41:1 — por debajo de AA — en grande Y en pequeño.** Rojo `#dc2626` sobre su
fondo `--red-50`. No había aparecido antes porque el guard de navegador mide páginas HTML
estáticas y `btn-danger` solo vive en vistas del dashboard generadas por JS.

| | |
| --- | --- |
| Conjuntos con `btn-danger` | **7** |
| — en páginas públicas | **0** |
| — tras el login | **7** |

Le faltan **0,09**. Es otro color de estado, no el verde de marca, así que no arrastra la decisión
de identidad. **Reportado y no arreglado** (regla 9): no estaba en el encargo y esta noche se
cierra, no se abre.

Por completitud: `btn-ghost` pasa por **0,27** (4,77 contra 4,5). Cumple, pero con poco margen —
cualquier retoque del gris apagado lo tumbaría, y el contador de tokens de
`tests/scrum368-contraste-tokens.test.mjs` lo vigila.

---

## ① El contador del residuo: por qué es aceptable, no solo cuánto es

`tests/scrum368-residuo-btn-sm.test.mjs` cuenta **35 sitios**, y trae un test aparte cuyo motivo
está escrito en el propio fichero:

> **`NINGÚN btn-sm primario está en una página pública`** — «Es lo que acota el daño: el residuo
> vive detrás del login, no en la cara que ve un desconocido. Si eso deja de ser cierto, la
> decisión de aceptarlo cambia de peso.»

Esa es la pieza que hace **aceptable** el residuo, y por eso es un test y no una nota: el día que
un botón primario pequeño aparezca en el landing, la razón por la que se aceptaron los 35 deja de
valer, y el guard lo dice antes de que nadie tenga que acordarse.

El contador cae **si sube o si baja** —bajar es una mejora que hay que anotar, no un verde
silencioso—, con suelo y control negativo.

---

## Método

Lo que salió de esta sesión sube a **`docs/METODO_YAQU.md`**, con sus casos reales:

1. **La mutación que no llegó a aplicarse** — con los dos casos: el `replace('export', …)` sobre
   un fichero sin `export`, y el botón inyectado en `login.html`, que no carga `styles.css` y por
   tanto nunca reprodujo el par que se quería medir.
2. **La excepción escrita más ancha que su caso** — el permiso por par de colores.
3. **El medidor que no llegó a ejecutarse** — el `| tail`, el analizador ciego, el CLI que no se
   reconoce.
4. **No se mide mientras algo se mueve.**
5. **El navegador es el árbitro**, y la prueba que lo separa de «no ajustes el guard a tu código».



# ═══ SÉPTIMA ENTREGA · CANDIDATA APLICADA, ENMIENDA Y TRINQUETE ═══

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:02:32+01:00

> 🛑 **368 NO CIERRA con esta entrega.** La condición ③ —capturar tres pantallas reales
> pobladas— **no se ha cumplido**. Detalle al final, sin adornos.

## 🔴 El hallazgo real del ticket: eran EL MISMO defecto

Vista la captura, el fundador aprobó la candidata y dio el motivo, que es más grande que el
arreglo:

> En A, el pequeño y el grande son el **mismo verde** con el **mismo peso**, y **compiten**: la
> tarjeta tiene dos voces y ninguna manda. En B aparece una escalera —relleno oscuro › contorno ›
> texto plano— y el grande gana sin discusión. En C, en fila de tabla, el oscuro se lee mejor
> sobre blanco.

> **La candidata no es un parche de contraste que además no molesta. El defecto de contraste y el
> incumplimiento de la Regla de Una Sola Voz eran EL MISMO defecto, y se arreglan con el mismo
> cambio.**

Por eso el trinquete vigila **el fondo** y no el ratio: quien devuelva un primario pequeño al
verde de marca rompe las dos cosas a la vez.

## Lo aplicado

**CSS** (`styles.css`): `.btn-primary.btn-sm { background: var(--brand-tint-ink); }` y su hover.
`--brand` no se toca; el primario normal y el grande, tampoco.

**Enmienda de `DESIGN.md`**, escrita **por token y no por hex**:

- En **Buttons**, una línea nueva: **Primary (small)** — fondo `{colors.brand-tint-ink}`, texto
  blanco, con los dos motivos (3,30 → **5,48**, y la competencia entre pequeño y grande).
- En los tokens de componente: `button-primary-sm.backgroundColor: "{colors.brand-tint-ink}"`.
- Y una nota bajo **la Regla de Una Sola Voz** que dice que **se incumplía en 35 sitios** y que
  esta enmienda **acerca el producto a lo que el documento ya exigía en esa línea**.

> El hex `#16a34a` escrito a mano en la especificación del primario (l. 159) es **la razón por la
> que este cambio necesitó enmienda**: un valor literal en la spec es una segunda fuente de verdad
> esperando a derivar. La línea nueva no repite el error. **La vieja se deja como está** —cambiarla
> no estaba en el encargo—, pero queda señalada.

## El guard cambió de pregunta: de contador a trinquete

`tests/scrum368-residuo-btn-sm.test.mjs` ya no cuenta un residuo aceptado. Ahora afirma:

> **ningún `btn-primary btn-sm` usa `--brand` de fondo.**

Simula la cascada de `background` para `<button class="btn btn-primary btn-sm">` y exige que gane
`var(--brand-tint-ink)`. **Rojo verificado** —con la mutación **confirmada aplicada** antes de
creerse el resultado (§1 de `METODO_YAQU.md`)—: devolver el fondo a `--brand` cae listando los
**35 sitios con fichero y línea**.

Y trae:

- **La otra cara:** el primario **normal** debe seguir con `--brand`. Si alguien extendiera la
  enmienda al grande, estaría cambiando la identidad sin decirlo.
- **Control negativo:** `secondary`, `ghost` y `danger` pequeños **no** pueden recibir fondo
  propio. `btn-sm` sigue siendo dimensional en todas salvo en el primario, que es **la única
  excepción y está declarada en `DESIGN.md`**.
- **`DESIGN.md` declara el componente, y por token:** el test falla si desaparece
  `button-primary-sm` o si el fondo se escribe con el hex a mano.
- **La otra cara pública:** el test de «ninguno en superficie pública» se queda, con el motivo
  actualizado — ya no justifica un residuo, ahora **afirma que el cambio no toca lo que ve un
  desconocido**.

### Un motivo muerto, retirado

El par blanco-sobre-verde de `CONOCIDOS` decía «el botón primario, decisión del fundador
pendiente». **Eso ya no aplica**: el grande cumple por texto grande y el pequeño por el token
nuevo. Los 2 nodos que quedan son **mockups del landing** (`.send-btn`, `.tnum-b`), y así está
escrito ahora. Vigilar el motivo viejo habría sido vigilar un motivo muerto.

> El `btn-primary btn-sm` **nunca estuvo** en `POR_TEXTO_GRANDE`, así que no había excepción de
> tipografía que retirarle: pasa con 5,48 por la vía normal, sin excepción ninguna.

## 🛑 ③ NO CUMPLIDO — las tres pantallas reales

**No se han conseguido las capturas de `invoiceDetailView`, `quotesListView` y `settingsView`
pobladas.**

Lo que sí se hizo: un banco que carga **los 42 scripts reales del dashboard** (sin `app.js`, que
redirige a login sin sesión) y llama a las funciones de vista reales — `renderQuotesListView`,
`renderInvoiceDetailView`, `renderSettingsView`. **El markup y el CSS son los del producto.**

Lo que falló: **los datos**. La API no existe en ese banco y el interceptor no acertó el contrato
de cada vista, así que las tres renderizan **su estado de error o vacío**:

| Vista | Resultado | Primarios pequeños |
| --- | --- | --- |
| `quotesListView` | estado vacío + «Error cargando presupuestos» | 1 |
| `invoiceDetailView` | 7 nodos, no llegó a montar | 0 |
| `settingsView` | estructura completa + «API 404: Not Found» | 0 |

**Esas capturas no valen para lo que se pidió.** Se pidió ver si seis botones se leen como un
sistema, y en tres estados vacíos no hay seis botones. Entregarlas como «pantallas reales» sería
el mismo error contra el que avisó el encargo —una superficie que no es la que usa el
profesional— con otro disfraz.

Lo único que sí muestra algo útil es `quotesListView`: el `+ Crear presupuesto` grande en verde
de marca **y** el `🚀 Crear mi primer presupuesto` pequeño en verde oscuro, en la misma pantalla
real. Se lee como escalera. Pero es **una** convivencia, no seis.

**La vía que sí funcionaría** es la que ya existe en el repo: `scripts/capture-demo.mjs`, que
conduce Edge con `CAPTURE_PROFILE` (un perfil con sesión real del dashboard) contra un backend
con la BD sembrada (`scripts/seed-demo.mjs`). Eso es levantar backend y base de datos — no se
hizo por cuenta propia.



## 📌 CÓMO SE CIERRA ③ — instrucciones para la próxima sesión

Es lo único que falta para cerrar SCRUM-368. Está escrito con detalle **para que nadie tenga que
redescubrirlo ni volver a pedir permiso**.

### Lo que hay que conseguir

Capturas a **390 px** de **tres pantallas reales y POBLADAS** —`invoiceDetailView`,
`quotesListView` y `settingsView`, las tres con 3 sitios de `btn-primary btn-sm` cada una— con la
candidata aplicada. La pregunta que contestan: **con seis botones en pantalla, ¿sigue leyéndose
como un sistema o parece un error?**

Si en alguna chirría → **parar y enseñarla**, no arreglarla por cuenta propia.

### ❌ Lo que NO sirve, y no hace falta reintentar

Se montó un banco (`__/vistas.html`) que carga **los 42 scripts reales del dashboard** —todos
menos `app.js`, que redirige a `/login.html` cuando no hay sesión— y llama a las funciones
globales `renderQuotesListView`, `renderInvoiceDetailView`, `renderSettingsView`. Las vistas
**existen y se montan**: 22 funciones `render*View` quedan disponibles en `window`.

**El markup y el CSS son los reales. Lo que falla son los DATOS.** Con `page.route` devolviendo
JSON inventado no se acierta el contrato de cada vista, y las tres salen así:

| Vista | Resultado | Primarios pequeños |
| --- | --- | --- |
| `quotesListView` | estado vacío + «Error cargando presupuestos» | 1 |
| `invoiceDetailView` | 7 nodos — no llegó a montar | 0 |
| `settingsView` | estructura completa + «API 404: Not Found» | 0 |

Se afinó el stub una vez (se descubrió que `/admin/quotes` devuelve un **array plano** con campos
`id, number, customerName, customerPhone, status, totalAmount, currency, createdAt, method`) y
**siguió sin poblar**. Cada vista tiene su contrato y son varios por vista. **Acertarlos a ciegas
no es el camino.**

### ✅ La vía buena, y está AUTORIZADA

`scripts/capture-demo.mjs`, que ya existe en el repo y hace exactamente esto: conduce Edge por CDP
con `puppeteer-core`, viewport móvil real, contra una base sembrada.

```
CAPTURE_BASE=http://127.0.0.1:3000 \
CAPTURE_PROFILE=<dir con perfil que tenga la sesión del dashboard> \
node scripts/capture-demo.mjs
```

Pasos:

1. **Levantar el backend en local** — `npm run dev`, que carga `.env.local` con prioridad (BD
   local y `DISABLE_CRONS=true`).
2. **Sembrar la base** con `scripts/seed-demo.mjs` (merchant demo id=1, `demo@yaqu.app`, regla 8).
3. **Conseguir la sesión** visitando `/auth/verify?token=<magic_link>` una vez con ese mismo
   perfil de Edge; el token se acuña en BD (`authSession` type `magic_link`). Está explicado en la
   cabecera de `capture-demo.mjs`.
4. Capturar `#quotes-list`, `#invoices` → detalle, y `#settings` a 390 px.

> **AUTORIZADO POR EL FUNDADOR (5-ago-2026): levantar backend local con base sembrada.** Es local,
> no toca nada de fuera. **La próxima sesión no tiene que volver a pedir permiso para esto.**

⚠️ `CAPTURE_BASE` por defecto apunta a `https://yaqu.app` (**producción**). Hay que ponerlo al
local: el CSS de la candidata no está desplegado, así que contra producción se capturaría el
producto viejo.

### El único dato con producto de verdad que sí salió

En **`quotesListView`**, con su código real, conviven en la misma pantalla:

- **`+ Crear presupuesto`** — primario normal, grande, en **verde de marca** `rgb(22,163,74)`
- **`🚀 Crear mi primer presupuesto`** — primario pequeño, en **verde oscuro** `rgb(4,120,87)`

**Y se lee como escalera**: el grande manda y el pequeño se subordina, que es justo el efecto que
motivó la aprobación de la candidata. Captura en `.playwright-mcp/368-real-quotesListView-390.png`.

**Es UNA convivencia real, no seis botones.** No cierra ③ —lo que se pidió es ver si el sistema
aguanta con seis— pero es **el primer dato con producto de verdad** y apunta en la buena dirección.


## Reglas (las siete entregas)

Regla 4 (vanilla, un componente) · **Regla 30: el verde de marca NO se ha tocado en ninguna de
las siete entregas** · Regla 9 (reportado y no arreglado: el botón primario a 3,30 —A1 medido y
**PARADO** por dos rótulos que desbordan—, `admin.html` y los dos mockups de WhatsApp) · Regla 37.

> **La copy no se toca.** Los dos rótulos que desbordan con A1 no se han acortado: es microcopy
> del fundador (regla 30) y acortarla para que quepa sería resolver un problema de diseño por la
> puerta de atrás.


# ═══ OCTAVA ENTREGA · ③ EN PANTALLA: TRES REALES, LA CUARTA DECIDE, Y LA QUE NO SE PUDO ═══

**Medido contra:** `origin/main` = `5843684c98e8f8a1b1cef1c3334fc4a094f84d19` · 2026-08-05T23:08:16+01:00

> **Re-anclado.** `main` avanzó a `f96309b3fc58167507d610683c23e8f5072f80ce`
> (2026-08-05T23:32:44+01:00) mientras corría esto: SCRUM-375, que toca `invoicesView.js`,
> `scrum373`/`scrum375` y su entrada. **No toca ninguno de los ficheros medidos aquí**
> (`styles.css`, `tokens.css`, `DESIGN.md`, ni las cuatro vistas capturadas). El ancla de arriba
> es la del rebase y la del navegador. Rama `scrum-368-a1-texto-grande`, punta
> `7d47d4635956df099f6781ee0febd24f07528991`, pila rebasada **sin `--force`**.

## La premisa de la autorización no se cumplía, y se midió antes de usarla

La séptima entrega dejó escrito: «AUTORIZADO: levantar backend local con base sembrada. **Es
local, no toca nada de fuera.**» Medido en la máquina antes de tocar nada:

| | |
| --- | --- |
| Postgres escuchando en 5432 | **no** |
| `psql` / `pg_ctl` / `initdb` en el PATH | **no** |
| Docker / `docker-compose` | **no** |
| `.env.local` en alguno de los 4 worktrees | **no** |

**No hay ninguna base local en esta máquina.** Los `.env` apuntan a `acela/railway` (**staging**,
en b3/b1/b2) y `acela/yaqu_dev_javier` (**dev**, en el checkout principal). La autorización se
había escrito para un supuesto que no existe, así que la salida se preguntó en vez de suponerse.

**Decisión del fundador:** `yaqu_dev_javier`, con censo de solo lectura primero y siembra solo si
estaba vacío. **Staging NO se toca** —b1 la necesita esa noche para la migración de C5 y b2 está
viva— y **producción tampoco, ni en lectura**.

> El guard de `seed-demo` compara `SEED_DEMO_CONFIRM` con el **HOST**, y `acela` aloja staging Y
> dev (RUNBOOKS:294). Por sí solo no distingue una de otra. La llamada se envolvió afirmando
> **la base**, no el host, antes de dejar ejecutar nada.

## 🔴 LOS DOS SEMBRADORES ESTÁN ROTOS CONTRA `main` (regla 9: reportado, no arreglado)

Ninguno de los dos puede ejecutarse hoy. No es de este ticket y no se arregla aquí (regla 37: es
otra zona), pero **cualquiera que siga las instrucciones de la séptima entrega se los encuentra**.

| Fichero | Defecto | Origen |
| --- | --- | --- |
| `scripts/seed-demo.mjs:45` | importa `./_wipe-demo.mjs`, **que no existe en `main`** | SCRUM-314 (`cbc2880`) mudó el barrido a `src/modules/system/domain/barridoDemo.ts` y **borró el `.mjs` sin actualizar el import** |
| `scripts/seed-demo.mjs:244` · `scripts/seed-video.mjs:456` | llaman `allocateInvoiceNumber(tx, id, {}, at)`; `opts.camino` y `opts.actor` son **obligatorios** | SCRUM-207 cerró el contrato de emisión y los sembradores no lo siguieron |

El primero mata el proceso en el `resolve`, antes de tocar la base. El segundo revienta a mitad,
**después** de que el barrido haya borrado. Aquí no hubo daño porque el censo previo ya había
medido el merchant 1 **a cero**; con datos dentro, ese orden los habría perdido.

> **El arreglo del primero es una línea** (`from '../dist/modules/system/domain/barridoDemo.js'`).
> El del segundo **NO lo es**: elegir el `camino` (`C1`…`C7`) y el `actor` de una factura sembrada
> es semántica fiscal que acaba en `AuditLog`, y eso no lo decide una sesión de capturas.

## Cómo se pobló, entonces: por el CAMINO REAL DEL PRODUCTO

Sin inventar ninguna semántica fiscal — no se llamó a `allocateInvoiceNumber` ni se eligió
`camino`/`actor`: eso lo pone la ruta del producto cuando toca.

```
POST /quote/create               → 4 presupuestos (no son documento fiscal)
POST /admin/quotes/:id/accept    → acepta 2; con cada uno nace su Trabajo (ensureJobForQuote)
POST /admin/onboarding/complete  → cierra el asistente (tapaba las 3 pantallas)
```

Resultado en dev: **5 presupuestos · 2 Trabajos · 7 clientes · 8 productos**. Las vistas se
dispararon con el **router real** (`renderAppView`), no con un banco de scripts.

## 🛑 ① `invoiceDetailView` NO SE PUDO CAPTURAR — y el motivo no es de este ticket

`GET /admin/invoices` devuelve **500** contra dev. Confirmado en el log del backend, no deducido:

```
The column `invoices.vf_estado` does not exist in the current database.
🚨 [schema] DERIVA: COLUMNAS que faltan (1): invoices.vf_estado (Invoice.vfEstado)
```

Arreglarlo es un **`db push` a dev** — STOP de schema, y justo la zona donde b1 migraba esa
noche. **No se tocó.** ① queda pendiente de que dev tenga el esquema al día.

## Lo que sí se capturó, con su censo medido en pantalla

`.playwright-mcp/368-S3-{2,3,4}-*-390.png`, 390×844 @2x, backend local contra dev.

> **La captura afirma qué CSS se está sirviendo antes de disparar**, porque `CAPTURE_BASE` apunta
> por defecto a **producción**, donde esta hoja no está desplegada: allí la foto habría salido
> bien **por el motivo equivocado**. Medido en cada pasada:
> `btn-primary btn-sm` = `rgb(4,120,87)` ✔ · `btn-primary` = `rgb(22,163,74)` a 18,66px/700 ✔.

| Pantalla | Botones verdes VISIBLES | tamaño | tipografía |
| --- | --- | --- | --- |
| ② `quotesListView` | `+ Crear presupuesto` — **marca** | 219×44 | 18,66px/700 |
| ③ `settingsView` | `Guardar cambios` — **marca** | 204×44 | 18,66px/700 |
| | `Copiar link` — **oscuro** | 89×30 | 12,5px/600 |
| ④ `jobDetailView` | `+ Nuevo albarán` — **oscuro** | 123×30 | 12,5px/600 |

### ¿Se lee como un sistema? **Sí, en las tres.** Con dos matices que no son de color

- **③ es la única convivencia real de las tres.** El grande y brillante manda; el pequeño oscuro
  se lee como la acción **de su tarjeta**, no como un botón estropeado. Y coincide en tono con
  los enlaces `Completar →`, que ya usaban `--brand-tint-ink` como texto desde la segunda
  entrega: **el oscuro se lee como familia, no como excepción**.
- **④ invierte la premisa, y aun así aguanta.** El CTA del héroe es el único botón *relleno* de
  la pantalla, contra un `+ Añadir gasto` de contorno: **manda sin discusión**. Pero manda
  **porque no tiene competencia**, no porque sea subordinado. Medido en la fuente: los tres
  `btn-primary` en verde de marca de esa vista (`:1186`, `:1270`, `:1450`) viven **dentro de
  modales**, que la tapan. En la pantalla base **no hay ni un verde de marca**.
- **② no ejercita la pregunta.** Con 5 presupuestos reales no aparece ningún primario pequeño:
  `✓ Aprobar` exige estado `pending_approval` (`quotesListView.js:242`). Una sola voz en
  pantalla — que es lo que `DESIGN.md` pide, pero no es la prueba que se buscaba.

## 🛑 LO QUE CHIRRÍA EN ④, y no se ha tocado

Las dos son de **tamaño y rótulo**, no de color, y las dos estaban ahí antes de la candidata.

1. **La acción principal de la pantalla es un objetivo táctil de 30 px a 390 px.**
   `jobDetailView.js:527` escribe `'btn-primary btn-sm'` **sin la clase base `btn`**, que es la
   que sube a 44 px en móvil — el mecanismo exacto de SCRUM-352. Medido: **123×30**. El CTA del
   héroe es el botón más importante del Trabajo y el más pequeño de pulsar de su fila.
2. **`+ Nuevo albarán` sale DOS VECES en la misma pantalla**: como CTA del héroe (relleno oscuro,
   arriba) y otra vez en la sección ALBARANES (contorno, abajo). Mismo rótulo, dos pesos. El
   héroe replica la acción de la sección en vez de distinguirse de ella.

**Ninguna se arregla aquí**: (1) es SCRUM-352 y (2) toca microcopy y jerarquía de una vista
(regla 30 + regla 37).

## El falso negativo que casi entra en el informe

La primera pasada capturó ④ con un `setTimeout` fijo y el censo dijo **«ningún botón verde
visible»**. Era mentira: la vista **no había terminado de montarse**. Se cambió el sleep por
**espera a DOM estable** (mismo largo 4 veces seguidas) y el CTA apareció.

> Es **METODO §4** («no se mide mientras algo se mueve») en su versión de captura, y también §3:
> el medidor no llegó a ejecutarse del todo. **Un cero de un censo que no terminó de mirar es
> indistinguible de un cero de verdad** — y este iba camino de reportarse como hallazgo.

## Higiene

Backend local parado, `.env.local` borrado, puente temporal de `_wipe-demo.mjs` retirado
(nunca entró en el diff: `git status` limpio antes y después). **Producción no se tocó ni en
lectura. Staging no se tocó.** Dev queda liberada.

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

## Reglas (las dos entregas)

Regla 4 (vanilla, un componente) · **Regla 30: el verde de marca NO se ha tocado en ninguna de
las dos entregas** · Regla 9 (reportado y no arreglado: el botón primario a 3,30, `admin.html`,
los mockups del landing) · Regla 37.

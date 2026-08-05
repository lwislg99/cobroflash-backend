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

## Reglas

Regla 4 (vanilla, un componente) · Regla 30 (no se toca el verde ni la microcopy) · Regla 9
(reportado y no arreglado: tamaño y contraste) · Regla 37.

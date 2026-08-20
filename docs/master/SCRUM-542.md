# SCRUM-542 · los 44 px de AB6, y el objetivo que la caja CSS escondía

**Medido contra:** `origin/main` = `bb721a852110117d0af17d6c8e07ba59488ead6b` · 2026-08-20T11:33:32+01:00
(la rama nació de `634b4fe1`; `main` se movió con la entrada de SCRUM-559 y se mezcló antes de cerrar)

> **20-ago-2026 · cambia comportamiento en la landing pública: cinco reglas de CSS.
> Ni una palabra de copy. `#todo` —lo único publicado que toca `.p-link`— no se mueve un píxel,
> y está medido, no afirmado.**

## Lo que el encargo daba por sabido, y lo que salió al comprobarlo

| lo que decía el ticket | lo medido |
|---|---|
| `.p-link` toca **tres** secciones | **dos**: `#gremios` (tapada) y `#todo` (publicada) |
| los 12 `.p-link` son objetivos de toque | **6 sí y 6 no.** Son dos cosas distintas con la misma clase |
| el logo mide 34 px y hay que arreglarlo | **ya lo arregló SCRUM-543** (`.logo{min-height:44px}`) |
| «Ver planes →» mide 24 px | **ya lo arregló SCRUM-543** con un `::after` de −12/+12 |
| 5 elementos sin medir | los 5, medidos y explicados (abajo) |

Nada de esto invalidaba el ticket: **el trabajo de fondo estaba, y ha aparecido uno más grave que
ninguno de los listados.**

## Los 12 `.p-link` NO son la misma cosa, y por eso la regla va sobre `a`

```
#gremios (hidden, en propuesta)   <a class="p-link" href="/register.html">Empezar gratis →</a>   ×6
#todo    (publicada)              <span class="p-link">Ver más →</span>                          ×6
```

Los seis de `#todo` no tienen `href`, ni `role`, ni `tabindex`, **ni un solo manejador en el JS**
(`grep -rn "p-link" public/js/` → cero). No son objetivos de toque: AB6 no les aplica. Subirlos a
44 px alargaría seis tarjetas publicadas sin que nadie ganase nada.

Por eso la regla es `.prod a.p-link{min-height:44px}` y no `.prod .p-link`. **Comprobado, no
supuesto:** `#todo` mide 897,8 px a 1280 y 1940 px a 360 antes y después, y sus seis tarjetas
siguen midiendo 258 y 250 px respectivamente.

> 🟡 **PARA EL FUNDADOR (regla 30, propongo y paro).** Que esos seis `<span>` *parezcan* enlaces
> —color de marca, negrita, flecha «Ver más →»— y no lleven a ningún sitio es un defecto distinto
> del de este ticket, y arreglarlo es decidir a dónde van o retirar la flecha: las dos cosas son
> copy o comportamiento. Se deja escrito, no tocado.

## EL QUE NADIE HABÍA VISTO: la decoración se comía el botón principal

`.cta-band::after` es un círculo decorativo de 420×420 px, `position:absolute`, **sin
`pointer-events:none`**. A 360 px la sección es más alta y el círculo alcanza el botón:

```
.cta-band .btn-primary   caja CSS 61,8 px   ·   área que respondía al toque 41,5 px
```

Los 20 px de arriba del CTA principal de la landing no respondían. **A 1280 no se veía** porque
ahí el círculo cae por encima del botón. El `position:relative` que la línea de al lado le pone al
botón **no basta**: un pseudo-elemento del padre se pinta *después* de los hijos, así que gana
igual.

No lo cazó ningún censo anterior por una razón concreta: el idioma de la casa era
`elementsFromPoint(x,y).includes(el)`, y **eso da por bueno un elemento tapado por otro** —sigue
en la pila, pero el toque se lo lleva el de encima.

## Antes → después, medido en Edge

| objetivo | 1280 antes → después | 360 antes → después |
|---|---|---|
| nav ×3 (`a.t`) | 41 → **45** | oculto (`max-width:820px`) |
| «Volver a empezar» | 28 → **44** | 28 → **44** |
| pie ×5 | 17,5 → **44** | 17,5 (4 medibles) → **44** (5) |
| `a.p-link` ×6 (#gremios) | 22 → **44** | 22 → **44** |
| CTA `.cta-band` | ya cumplía | **41,5 → 61,8** |
| **veredicto** | 14/29 → **29/29** | 12/25 → **25/25** |

A 360, uno de los cinco del pie ni siquiera era medible antes: «Todo en uno» se partía en dos
renglones y su centro caía **entre** las dos cajas de línea, donde el punto pertenece al `<div>`
padre. Al dejar de ser una caja en línea deja de partirse, y además el pie se lee mejor.

## Lo que cuesta, en píxeles

| | 1280 | 360 |
|---|---|---|
| `footer` | +18,4 | +36,8 |
| `#probar` | igual | +15,4 |
| `header` (nav) | **igual** | **igual** |
| `.cta-band` | **igual** | **igual** |
| `#todo` | **igual** | **igual** |
| página entera | +19 | +52 |

El nav no se mueve porque la píldora sólo se ve al pasar por encima y el `.nav-in` tiene alto fijo
de 64 px; `.cta-band` no se mueve porque `pointer-events` no cambia lo que se pinta. Las capturas
`before-nav-1280.png` y `after-nav-1280.png` son **idénticas byte a byte**.

## Los 5 «sin medir» del encargo, resueltos

- **4 botones de la maqueta del móvil** (`.iscreen .ibtn`): `visibility:hidden` — la maqueta
  enseña una pantalla cada vez. Sus cajas ya son de 49 px. **No es un defecto.**
- **«Ver planes →»**: la barra `#announce` nace `hidden` y su CSS la deja `visibility:hidden`
  (ocupa sitio, no recibe toque). Destapada, cumple: la arregló SCRUM-543.

## El instrumento: `npm run guard:objetivo-tactil`

Censo **derivado del DOM**, no lista escrita a mano: `guard-a11y-landing.mjs` vigila dos táctiles
apuntados a mano y eso sólo protege lo que alguien recordó apuntar. Aquí se le pregunta al
navegador qué hay que se pueda pulsar, para que **lo que se añada mañana también se mida**.

Cuatro cosas hacen que su verde signifique algo:

1. **Hace `scrollIntoView`.** `elementsFromPoint` sólo ve el viewport, y el pie —donde estaban los
   peores— queda debajo. Sin scroll el censo devuelve cero y **ese cero parece limpieza cuando es
   ceguera**. Lleva un control que lo demuestra en cada pasada: *sin scroll 0 enlaces de pie, con
   scroll 5.* Si las dos cifras coincidieran, el guard lo diría en vez de aprobar.
2. **El árbitro es «qué activaría el dedo aquí»**: `elementsFromPoint(x,y)[0].closest(INTERACTIVOS) === el`.
   Acierta con los hijos (el `<span class="ar">` pertenece a su enlace) y deja de mentir con los
   solapes. Es lo que destapó el defecto del CTA.
3. **Afina el borde por bisección.** 🔴 Sin eso el medidor **miente por defecto**: el primer
   barrido, a saltos de 0,5 px, leyó 43,5 en un enlace del pie que mide 44,0 exactos, y eso se lee
   como un defecto de CSS que no existe. Un cuantizador tosco convierte un aprobado justo en un
   suspenso inventado.
4. **El suelo falla con nombres.** No basta con «encontré alguno»: hay una lista de conocidos
   (logo, los 3 del nav, «Volver a empezar», los 5 del pie, «Ver planes →», los 6 de `#gremios`) y
   si falta alguno el guard dice **que no supo mirar**, no que todo está bien.

### `DESTAPAR`: dónde entro en propuesta, y por qué

El guard destapa `#announce` y `#gremios` **en el DOM de una pestaña de usar y tirar**.
`public/index.html` no se toca: el `hidden` sigue en el fichero y en producción. Es el mismo
recurso que ya usa `guard-a11y-landing.mjs` con su campo `destapar`.

Se destapa porque si no, no se mide: **un táctil de 22 px dentro de una sección tapada no es un
táctil correcto, es un defecto con fecha de estreno**, y el día que la sección se publique ya nadie
va a volver a mirar. Si mañana `#gremios` desaparece, el guard no pasa en silencio: dice que su
destapar declarado ya no existe.

## Verificación

**Rojo por el mecanismo**, inyectado sobre disco con el commit `c794c3e9` ya hecho:

| inyección | el guard | reversión |
|---|---|---|
| ① pie a `min-height:30px` (**visible en el CSS**) | cae (exit 1) y nombra los 5 del pie en los dos anchos: `✖ 31px < 44 · [footer] A «Cómo funciona» (caja CSS 30px)` | `Buffer.compare` contra `HEAD:public/index.html` = **0** |
| ② quitar `pointer-events:none` (**invisible en el CSS: la caja no cambia**) | cae y nombra: `✖ 42.1px < 44 · A.btn.btn-primary.btn-lg «Empezar gratis» (caja CSS 61.8px)` | `Buffer.compare` = **0** |

**Control positivo:** en las dos inyecciones, los objetivos denunciados fuera de la familia
inyectada son **0**. No salta todo: salta lo que se rompió.

> ⚠️ La primera pasada de la demostración se dio a sí misma por «mal calibrada» en 9 líneas. Era
> un fallo **del comprobador**, no del guard: exigía la línea de `30px` y las otras nueve dicen
> `31` por subpíxel, todas del pie y todas esperadas. Corregido a comparar por familia.

**Suite completa:** `3823 tests · 3746 pass · 0 fail · 77 skipped` (sobre el estado ya mezclado
con `bb721a85`). No salió el abort intermitente de scrum334 (SCRUM-560) en ninguna de las dos
pasadas.

**Censo de SCRUM-553:** mi test nuevo entró en él con un `<a href="/x">` literal dentro de su
corpus de control, y subió el reparto de 20 ficheros a 21. **No se relajó el guard:** se cambió el
corpus por uno sólo de CSS, que además controla mejor porque lleva dentro los casi-aciertos (el
padding viejo del nav, un `min-height` de 44 suelto en otra regla).

## Lo que NO se ha tocado

- Ni una palabra de copy (regla 30).
- Ningún `hidden` ni ningún marcador de propuesta, en el fichero.
- `scripts/censo-anclas-bloque-f.mjs` (SCRUM-555) ni los suelos de otros guards (SCRUM-559).
- Los 6 `<span class="p-link">` de `#todo`, que quedan como estaban.

## Ficheros

| fichero | qué |
|---|---|
| `public/index.html` | las 5 reglas de CSS, cada una con su comentario y su medición |
| `scripts/guard-objetivo-tactil.mjs` | el guard de navegador (nuevo) |
| `tests/scrum542-objetivo-tactil.test.mjs` | la red que sí corre siempre: 14 tests |
| `package.json` | `guard:objetivo-tactil` + su `//comentario` |
| `docs/capturas/scrum-542/` | antes/después de nav (1280), `#probar`, `.cta-band` y pie (360) |

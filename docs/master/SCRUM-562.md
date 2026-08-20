# SCRUM-562 · el instrumento daba por bueno lo que otro elemento tapa

**Medido contra:** `origin/main` = `9f25dab94118e256e16512a612ed0e9044718839` · 2026-08-20T12:31:26+01:00
(la rama nació de `34ad98cc`; `main` se movió con SCRUM-560, SCRUM-563 y SCRUM-542b y se mezcló antes de cerrar)

> **20-ago-2026 · instrumentación. NO cambia ni un píxel de la landing: el único fichero de
> producto que se toca es `public/index.html`, y sólo durante la demostración, revertido byte a
> byte. No se toca copy, ni `hidden`, ni marcadores.**

## El defecto, y la única prueba que lo demuestra

```js
const toca = (y) => document.elementsFromPoint(cx, y).includes(el);
```

Pregunta **«¿está el elemento en la pila?»**, y contesta que sí aunque haya otra cosa **encima**
tapándolo. Su fallo va en la dirección cómoda: **produce verdes.**

Como es invisible en el CSS, la única forma de saber si la migración compra algo es taparlo a
propósito. Se añadió una franja decorativa sobre el logo, y se pasó **la misma página** por las
dos versiones del guard de SCRUM-543:

| | veredicto |
|---|---|
| `origin/main` (idioma viejo) | `✔ el logo: 44.5px tocables (caja 44px)` · **exit 0** |
| migrado | `✖ el logo: área tocable 24px < 44 (AB6)` · **exit 1** |

El instrumento viejo no sólo aprueba: **devuelve exactamente el mismo número que sin nada
encima.** No es que midiera mal el tapado; es que el tapado no existe para él.

## 🔴 NO ERA UN DEFECTO, ERAN DOS — y el segundo no estaba en el ticket

El bucle viejo expandía **desde los bordes de la caja** y sólo hacia fuera:

```js
let top = r.top, bottom = r.bottom;
while (toca(top - 0.5)) top -= 0.5;      // sólo crece
```

Nunca encogía. Con eso, un elemento tapado por arriba **seguía devolviendo el alto de su caja
aunque el árbitro fuese el correcto**: la medida sólo podía sobre-reportar. **Migrar sólo el
árbitro no habría arreglado nada.** Por eso el medidor nuevo expande **desde el centro**,
partiendo de un punto del que ya ha comprobado que le pertenece.

## `scripts/_medidor-de-toque.mjs` · un solo sitio donde se mide

Tener dos copias en línea es lo que dejó que el guard de SCRUM-543 y el de SCRUM-542 midieran
distinto durante dos días. Ahora los dos cuelgan del mismo módulo, y hay un test que lo exige.

Las cinco piezas que hacen que una medida valga, con su porqué escrito al lado:

1. **El árbitro** — `elementsFromPoint(x,y)[0].closest(SEL) === el`. Acierta con los hijos (el
   `<span>` de dentro de un enlace pertenece a su enlace) y deja de mentir con los solapes.
2. **Desde el centro**, no desde los bordes (arriba).
3. **Afinado por bisección** (≈0,01 px). Sin él, un objetivo de 44,0 exactos se lee 43,5 por
   cuantización de 0,5 y se denuncia un defecto de CSS que no existe. Medido en SCRUM-542.
4. **Control positivo** del propio detector: el centro TIENE que pertenecerle.
5. **Control negativo**: 400 px más abajo no puede seguir siendo suyo.

## Qué mediciones pasadas cuelgan del idioma viejo — se LISTAN, no se corrigen

Medido enfrentando las dos versiones sobre la página limpia, no deducido:

| medición histórica | ¿la afecta el idioma? |
|---|---|
| «el logo medía **34 px**» (SCRUM-543) | **No.** Es la caja (`getBoundingClientRect`), no el área de toque. |
| ««Ver planes →», **24**» (SCRUM-543) | **No.** También es la caja — el propio comentario lo dice. |
| el veredicto «recibe el dedo en 44» tras el arreglo | **Sí, el número.** El instrumento viejo daba logo 44,5 y «Ver planes» 46,1–46,6; el correcto da **45** y **47,1–47,6**. La diferencia es el afinado, no el árbitro: **ningún veredicto se da la vuelta.** |
| nav 40,9 · «Volver a empezar» 28,5 · pie 17,5 (SCRUM-542, S2) | **No.** Reproducidos con los dos idiomas y coinciden: nada los tapaba. |
| «0 táctiles a 360» del primer censo de S2 | **No.** Era falta de scroll, otro defecto distinto. |
| el CTA de `.cta-band` a 360 px | **Sí, y éste es el caro.** El idioma viejo lo daba por bueno; con el árbitro correcto son **41,5 px sobre una caja de 61,8**. Mi propia primera sonda de SCRUM-542 usaba `.includes` y **tampoco lo vio**. |

Y dos afirmaciones de SCRUM-543 que **eran razonadas, no medidas**, porque su instrumento no podía
medirlas: *«esa franja se la comía el header, que se pinta después»* y *«el área invadiría el
header y robaría toques al botón primario»*. Las dos hablan de tapado. Hoy sí se pueden medir, y
el resultado es que la geometría actual está bien (47,1 px). Se deja escrito que su origen fue un
argumento.

> ⚠️ Y una deriva de documentación, que se **lista y no se toca** (⛔ del encargo): el comentario
> de `.announce a::after` dice «anclado a la caja (−10/+10 sobre 24 px = 44)», y el CSS que hay
> debajo pone `top:-12px;bottom:-12px` sobre una caja de 23,6. La cuenta escrita no es la que
> corre.

## El censo ① · clasifica por LA PREGUNTA, no por la sintaxis

`npm run censo:arbitro-de-toque`. Derivado del árbol, no de una lista.

**`elementsFromPoint(...).includes(el)` no está mal siempre: está mal para «¿se puede pulsar?».**
Cuando la pregunta es «¿qué hay **debajo** de este elemento?» —contraste, superposiciones— la
posición en la pila es justo el dato que hace falta.

| zona | usos | clases |
|---|---|---|
| nuestro código | **2** | los dos `TOPE` (correctos) |
| vendido (`.claude/skills`, `.agents/skills`) | 12 | 8 `POSICION`, 4 `SINGULAR` |

Los 12 de `impeccable` son `findIndex` + `slice` para mirar lo que hay debajo y analizar
contraste. **Marcarlos habría sido pedir que se «arreglase» código que hace lo correcto**, y un
censo que grita de más se acaba ignorando. Están además gobernadas por hash en `skills-lock.json`
(regla 36): se miden, se declaran, no se tocan.

**Sesgo del clasificador, a propósito:** lo que no encaja sale como `OTRO`, nunca como `TOPE`. Un
clasificador que ante la duda dice «correcto» convierte cada caso raro en un aprobado silencioso —
el mismo fallo que este ticket viene a quitar. Hay un test que lo comprueba.

### La trampa de la autorreferencia, dos veces

La primera versión buscaba el **nombre** y se contaba a sí misma 8 veces (las expresiones
regulares del clasificador lo llevan dentro), más las citas de los comentarios, la del
`assert.match` que comprueba que el guard lo menciona, y la del `<style>` de la landing: **14 usos
donde había 2.** Se arregló exigiendo una **llamada de verdad** (`algo.elementsFromPoint(`) y
vaciando los comentarios de bloque conservando los saltos de línea.

Y volvió a picar en mi propio fichero de tests, cuyos corpus sintéticos son llamadas escritas en
cadenas. Se esquiva **por construcción** (`'document.elements' + 'FromPoint'`) y no con una lista
de exclusión, porque excluir el fichero entero taparía también un uso malo escrito ahí algún día.

**Lo que el censo no ve, dicho:** una llamada indirecta (`const f = document.elementsFromPoint`).
No hay ninguna hoy.

## El censo ② · pseudo-elementos que pueden comerse un toque

| clase | nº |
|---|---|
| EN FLUJO (no se superponen) | 12 |
| PROTEGIDO (`pointer-events:none`) | 2 |
| AMPLÍA SU PROPIA ÁREA | 2 |
| 🟡 **CANDIDATO** | **5** |

Los cinco: `.hero`, `.beat-label .pulse`, `.phone`, `.iphone`, `.price-card li` — todos en
`public/index.html`.

**No es un veredicto**: hoy el guard de navegador dice 29/29 y 25/25, así que ninguno tapa nada.
Es un mapa de dónde mirar, que es barato y no lo hacía nadie: cualquier objetivo que se coloque
mañana bajo uno de ellos se rompería en silencio.

> ⛔ **Y NO se les pone `pointer-events:none` por si acaso.** `.announce a::after` es un
> pseudo-elemento posicionado y sin la propiedad **a propósito**: amplía el área del enlace de
> 23,6 a 47 px (SCRUM-543). Quitárselo rompería un arreglo bueno. Por eso la clase se decide por
> **de quién cuelga**: si cuelga de algo pulsable amplía su propia área; si cuelga de un
> contenedor, se pone por encima de lo que haya. Hay un test que exige que esa clase siga
> reconociéndose — si desapareciera, el día que alguien mire los candidatos le pedirían romper el
> arreglo de «Ver planes →».

**Hueco declarado:** el censo mira 8 ficheros públicos; el guard de navegador sólo mide
`index.html`. Los candidatos de otras páginas públicas no tendrían árbitro. Hoy los cinco están en
`index.html`, así que no hay hueco efectivo — pero lo habrá el día que aparezca uno fuera.

## Verificación

**Rojo por el mecanismo**, con el commit `e591591e` ya hecho, dos inyecciones sobre `index.html`:

| inyección | viejo | nuevo |
|---|---|---|
| ① `.nav::after` tapa 30 px sobre el logo | `✔ 44.5px` **exit 0** | `✖ el logo: área tocable 24px < 44` **exit 1** |
| ② quitar `pointer-events:none` a `.cta-band::after` | — | `✖ 42.1px < 44 · A.btn.btn-primary.btn-lg (caja CSS 61.8px)` |

La ② prueba además que el refactor al medidor común **no perdió** la detección que SCRUM-542 había
ganado.

**Control positivo:** en las dos, objetivos denunciados fuera del tapado = **0**.
**Reversión:** `Buffer.compare` contra el blob = **0** en las dos, `git status` limpio.
**Suelo:** control del scroll en cada pasada del guard derivado — *sin scroll 0 enlaces de pie,
con scroll 5*. Y el censo se declara ciego si no encuentra llamadas o no encuentra CSS.

**Suite:** `3891 tests · 3814 pass · 0 fail · 77 skipped` (ya mezclado con `9f25dab9`). Sin el
abort de scrum334: lo arregló SCRUM-560, que entró mientras tanto.

## Los tests de 542 y 543 cazaron mi propio refactor

Tres casos fallaron al mover las piezas al módulo común. **Sus comprobaciones siguen al mecanismo
a su sitio nuevo**; borrarlas porque «ya no están aquí» habría dejado de vigilar justo lo que se
acababa de centralizar. Y el de SCRUM-543 gana una nueva que antes no tenía sentido: que el idioma
malo **no vuelva** a su código.

## Cruce con S3, declarado

`scrum-542b-quitar-ver-mas` (los seis «Ver más →» de `#todo`) entró en `main` durante este
trabajo. **No se ha tocado esa zona.** Tras mezclar, el censo derivado sigue viendo **35**
elementos interactivos: los `<span class="p-link">` que S3 retiró nunca fueron táctiles, que es
exactamente lo que midió SCRUM-542 al decidir no estirarlos.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/_medidor-de-toque.mjs` | el medidor único, con sus cinco piezas y su porqué (nuevo) |
| `scripts/censo-arbitro-de-toque.mjs` | los dos censos (nuevo) |
| `scripts/guard-a11y-landing.mjs` | migrado al medidor común |
| `scripts/guard-objetivo-tactil.mjs` | migrado al medidor común |
| `tests/scrum562-arbitro-de-toque.test.mjs` | 16 tests |
| `tests/scrum542-…` · `tests/scrum543-…` | las comprobaciones siguen al mecanismo |
| `package.json` | `censo:arbitro-de-toque` + su `//comentario` |

# SCRUM-611 · El tipo de IVA de la línea se elige, no se teclea

**Fecha:** 2-sep-2026 · **Carril:** documento (línea) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `fbc4a67080fe10b40cf1f28d8f34b661612edf2d` · 2026-09-02T12:42:27+01:00

**Tanda:** 4312 tests, 4233 pass, 0 fail, 79 skipped

---

## 🔴 LA MEDICIÓN QUE DECIDIÓ LA FORMA — y sin ella el arreglo habría movido dinero

Antes de escribir una línea: **hoy el campo es texto libre**, y le llegan valores que **no son
tipos españoles**.

| de dónde viene | qué puede traer |
|---|---|
| `products.routes.ts:47` → `locale.defaultVat` en el catálogo por gremio | **0,16 · 0,18 · 0,19** (MX · PE/CL · CO) |
| el «IVA por defecto» del documento (`quotesView.js:385`) | otro campo **libre**, sin acotar |
| plantillas y líneas de la IA | `tax` en fracción, sin acotar |

**Un selector CERRADO tendría que hacer algo con un 16 %.** Y cualquier cosa que no sea enseñarlo
—ajustarlo al vecino, dejarlo en blanco, caer al 21— **cambia el IVA de una línea sin que nadie lo
pida**. Eso es dinero, no maquetación.

> **Por eso el selector NO es cerrado:** los cuatro tipos españoles van SIEMPRE, y el valor de la
> línea **también** si no es ninguno de ellos. Nada se ajusta, nada se pierde.

**✅ Y esto contesta la pregunta del encargo —«si no se puede, PARA Y DILO»— con la misma forma que
SCRUM-623: se puede la FORMA, no la RESOLUCIÓN.**

| | ¿hoy? |
|---|---|
| que el tipo **se elija** de una lista, con el 21/10/4/0 a mano | **SÍ** — construido |
| saber **qué juego de tipos** le toca a este merchant (IVA / IGIC / IPSI) | **NO** — es SCRUM-646, y necesita un dato que no existe |

No hizo falta parar: la lista española sirve hoy porque **no excluye a nadie**. El día que entre el
IGIC se cambia la lista, en un solo sitio, sin tocar la vista.

---

## Lo construido

`public/dashboard/js/tiposDeIva.js` — **la lista, en UN SOLO SITIO**, y las funciones puras que la
usan. El campo de la línea pasa de `<input type=number>` a `<select>`.

* `TIPOS_ES = [21, 10, 4, 0]` — declarado como **el juego español**, no como «los tipos».
* `opciones(valor)` → los cuatro, **más el valor si no es ninguno**, en orden descendente.
* `ponerValor(select, v)` → **añade la opción si falta** y luego asigna. Es la pieza que hace que
  sustituir el `<input>` no cambie nada: los **seis** sitios que escribían `vatInput.value` siguen
  pudiendo escribir cualquier número.

### ⛔ `locale.defaultVat` NO se cablea, y hay guard

Está indexado por PAÍS y **Canarias es `ES`**: le daría 21 a un canario. Y además toma 0,16 · 0,18 ·
0,19, que **ni siquiera son tipos españoles** — o sea que como fuente de esta lista tampoco sirve.
Un test comprueba que la palabra no aparece en el código del módulo (y otro comprueba que **sí**
aparece en su comentario: el suelo de que la prohibición está escrita).

### El valor por defecto es EL DE HOY

La cascada no se ha tocado: `initial.vat` → `initial.tax` → el defecto del documento. Un test fija
las tres ramas **y** que ya no quede ningún `vatInput.value =` a pelo — porque con un `<select>` un
valor que no sea opción deja el control **en blanco**, y la línea perdería su tipo en silencio.

### Un detalle que no era obvio: `change` **y** `input`

Un `<select>` avisa por `change`; el `<input>` que había avisaba por `input`. Se escuchan **los
dos**, porque hay código que dispara `input` a mano (el autocompletado de producto) y quitarle ese
oyente lo habría dejado sin recalcular **sin que nada fallara**.

---

## 📋 El rótulo: NO hay microcopy nueva, y por eso el censo NO sube

El encargo pedía que el rótulo fuera con marcador y declarar la subida. **No procede, y prefiero
decirlo a inventarme una subida:**

* la etiqueta del campo sigue siendo **«IVA %»**, que ya estaba aprobada y **no cambia**;
* las opciones son **números pelados** —exactamente lo que enseñaba el `<input>`—, que son dato.

Poner un marcador ahí **sustituiría copy aprobada por un provisional**, que es peor que no tocarla.
El intento del encargo —que no me invente una palabra— se cumple entero: no hay ninguna palabra
nueva. **Si el fundador quiere otro rótulo, entra con marcador y entonces sí sube el censo.**

---

## El control

| dirección | resultado |
|---|---|
| **NEGATIVO · una línea que nadie toca** | la cascada intacta y los seis escritores por `ponerValor`; un tipo fuera de la lista se **conserva** (16 · 18 · 19 · 7 · 5,5 comprobados) |
| el selector ofrece 21 · 10 · 4 · 0 | y no duplica uno que ya está |
| el 0 % | sigue siendo un tipo **legítimo**, no «sin especificar» |
| coma decimal | `10,5` se sigue admitiendo, como hacía el `<input>` |

### Los rojos

| inyección | qué cae |
|---|---|
| ① el selector se vuelve **cerrado** | «un tipo QUE NO ES ESPAÑOL se conserva» |
| ② alguien vuelve a escribir `.value` a pelo | «el valor por defecto es EL DE HOY» |
| ③ la lista se repite en la vista | «la lista está en UN SOLO SITIO» |

Reversión de las tres: `Buffer.compare === 0`, 0 CR.

**Por qué los tests que pasan, pasan:** las cuatro primeras comprobaciones ejercitan `opciones` y
`normalizar`, que viven **sin DOM** justo para que la suite pueda ejecutarlas.

🔴 **Y lo que estos controles NO pueden cazar, dicho:** son de fuente y de regla, no de pantalla.
Si alguien dejara el `<select>` sin insertar en el DOM, o lo pusiera detrás de un `display:none`,
**todos seguirían verdes**. Que el desplegable se vea y que elegir recalcule el total **necesita
navegador y es del fundador**.

---

## Frontera con las otras dos sesiones

* **`pdf.service.ts` NO se ha tocado.** No hizo falta: el tipo elegido viaja por el mismo campo de
  siempre (`vat` de la línea), así que el papel lo recibe sin cambiar nada.
* **El PRECIO de la línea (S2, CAT-02) no se toca**, ni la cabecera ni las observaciones del pie
  (S3, DOC-03). Comprobado sobre el diff: todas las líneas añadidas a `quotesView.js` son del tipo
  de IVA o comentario de este ticket.

## Lo que NO cubre

1. **No se construye el IGIC ni se resuelve el territorio** (SCRUM-646).
2. **No se acota nada en el backend**: el `vat` de la línea sigue siendo libre en el servidor. El
   selector es una ayuda de la pantalla, no una validación — y acotarlo detrás rompería las líneas
   que hoy llevan 16, 18 o 19.
3. **La verificación visual** es del fundador.

## Ficheros

* `public/dashboard/js/tiposDeIva.js` — **nuevo**, la lista y sus funciones puras.
* `public/dashboard/js/quotesView.js` — el campo pasa a `<select>`; los seis escritores por
  `ponerValor`; oyente de `change`.
* `tests/scrum611-tipo-iva-elegible.test.mjs` — **nuevo**, 8 tests.
* `public/dashboard/index.html` · `public/sw.js` · `SCRIPTS_DEL_DASHBOARD` **66 → 67**, RECONTADO.

## HALLAZGOS FUERA DE ALCANCE

* **El «IVA por defecto» del documento sigue siendo un campo libre** (`quotesView.js:385`). Es el
  hermano de este ticket y no entraba en el encargo: si el de la línea se elige, teclear el del
  documento se queda a medias.
* Se mantiene el de SCRUM-647: **`locale.defaultVat` estampa el tipo por país en el catálogo**
  (`products.routes.ts:47`), que es lo que mete 16 · 18 · 19 en juego.

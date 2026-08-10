# SCRUM-392 · el guard de SCRUM-386 vigilaba una REDACCIÓN, no un contrato

**Fecha:** 6-ago-2026 · **Carril:** S3 · **Gate:** guard arreglado y probado en los dos sentidos

**Medido contra:** `origin/main` = `c6546bc19b9366a397127c7ea8c9704883f69697` · 2026-08-07T16:55:14Z

> El ancla de arriba es la de la **resolución** (7-ago, ver el último apartado). La entrega original
> de S3 se midió contra `origin/main` = `f56f49038ab9fbeb2e1a21bc2eb9ec0958c48877` ·
> 2026-08-06T14:26:21+02:00, y todo lo que va hasta ese apartado es suyo y se conserva intacto.

> **Un guard que hace imposible una clase entera de cambio legítimo no vigila un contrato:
> congela una redacción.**

## Cómo apareció

Al rebasar C5 (SCRUM-300) sobre este `main`, el editor del albarán necesitaba una precarga nueva
—`direccionSugerida`— en uno de los dos pasos de contexto de `buildAlbEditor`. En cuanto se añadió,
`tests/scrum386-hojas-fuera.test.mjs` se puso **rojo ante un cambio correcto**:

```js
const pasos = (CODIGO.match(/\{ cur, refresh, setStatus \}\)/g) || []).length;
assert.equal(pasos, 2, '🔴 esperaba DOS pasos de contexto …');
```

El contador cuenta el **literal exacto**. Añadir una propiedad a cualquiera de los dos pasos lo
rompe. No había forma de escribir el cambio que dejara el guard verde.

## Por qué NO aplica «quién introdujo la forma», que es la regla que parecía tocar

`docs/METODO_YAQU.md` («EL NAVEGADOR ES EL ÁRBITRO») fija la prueba que separa *no ajustes el guard
a tu código* de *arregla el analizador*:

> * Si la forma que el analizador no ve **la acabas de introducir tú** → se cambia **el código**.
> * Si **llevaba ahí desde antes** → se arregla **el analizador**.

Aquí la forma nueva la introdujo C5, así que la lectura literal mandaba cambiar el código. **Y aun
así la regla no aplica**, porque su premisa no se cumple: esa prueba supone que el guard vigila una
PROPIEDAD que la forma nueva viola. Este no vigilaba ninguna propiedad — vigilaba una cadena de
caracteres. La señal que lo distingue, y sirve para la próxima vez:

> **Si no existe NINGUNA forma de escribir el cambio legítimo que deje el guard verde, el problema
> es del guard.** Un contrato admite muchas redacciones; una redacción solo se admite a sí misma.

## Y ya se había equivocado antes, en la misma dirección

Está escrito en el propio fichero: la **primera** versión buscaba la llamada entera con un regex
multilínea (`buildAlbEditor\(bodyEl,[^;]*?\}, \{ cur…`) y salía **roja con el código correcto**,
porque `[^;]*?` no cruza los `;` del cuerpo del objeto de opciones. El arreglo de aquella fue contar
el literal — que es la segunda equivocación, la misma familia un paso más allá. Dos intentos, los
dos vigilando la ortografía.

Es la familia de SCRUM-381: *un guard que fija una ruta sin resolverla vigila la ortografía, no el
cableado.* Aquí: **un guard que congela un literal de llamada vigila la redacción, no el contrato.**

## Lo que vigila ahora

Por AST, no por literal. El hecho que hay que sostener es que **cada llamada recibe un contexto que
CONTIENE al menos `cur`, `refresh` y `setStatus`** — las tres que el cuerpo desestructura, y cuya
ausencia no la caza el compilador: llega `undefined` y revienta al usarla. Pasa el CI y falla en la
obra.

* Se localizan por AST las llamadas a las funciones que reciben contexto y su **posición** de
  argumento (`buildAlbEditor` → 4.º, `openAlbEditorSheet` → 2.º).
* Si el argumento es un **objeto literal**, se leen sus claves y se exige el superconjunto.
* Si es un **identificador** (`…, ctx)`), es un **reenvío**: el contexto viene de más arriba y ya se
  validó en su origen. Se reconoce como tal en vez de darlo por ausente.
* **SUELO:** si el escáner encuentra menos de 3 llamadas, **falla declarándose ciego**. «No supe
  mirar» y «está bien» dan el mismo número y significan lo contrario.

## Los DOS rojos, que solo valen juntos

Por separado ninguno distingue contrato de redacción: el de quitar lo pasaría también un guard que
congela literales, y el de añadir lo pasaría un guard que no mira nada. **Nueve mutaciones, con la
inyección verificada en disco y el fichero restaurado idéntico:**

| Mutación | Esperado | Resultado |
| --- | --- | --- |
| quitar `refresh` del paso de EDITAR | 🔴 | cae **nombrando** «refresh», con línea |
| quitar `cur` del paso de CREAR | 🔴 | cae **nombrando** «cur», con línea |
| quitar el contexto entero del paso de crear | 🔴 | `hay llamadas SIN contexto: buildAlbEditor:1348` |
| el reenvío de la hoja al editor desaparece | 🔴 | `hay llamadas SIN contexto: buildAlbEditor:2218` |
| renombrar la **declaración** de `buildAlbEditor` | 🔴 | lo caza otro test del fichero (vuelve dentro de `renderJobDetailView`) |
| renombrar las **llamadas** (el suelo, a propósito) | 🔴 | `ESCÁNER CIEGO: esperaba al menos 3 llamadas…` |
| **añadir `direccionSugerida`** (el caso real de C5) | ✅ verde | verde |
| **añadir** una propiedad cualquiera | ✅ verde | verde |
| **reordenar** las tres claves | ✅ verde | verde |

⚠️ El quinto se anota tal cual porque **el rojo salió por otro mecanismo**, no por el suelo nuevo:
renombrar la declaración deja las llamadas intactas, así que el escáner las sigue viendo. Por eso se
añadió el sexto, que ataca el suelo de verdad. Un rojo que sale por donde no esperabas no es el rojo
que querías probar.

**Suite:** 2033 tests · 1965 pass · **0 fail** · 68 skip.

## 🔴 COLISIÓN PENDIENTE — `scrum-386-sacar-sheets` está viva y reintroduce el defecto

Medido el 6-ago-2026: la rama `scrum-386-sacar-sheets` (`f3302089`) **no está en `main`** y toca
este mismo fichero. Amplía el guard para `openFacturarParcialSheet` **conservando la técnica del
literal**, y añade uno más:

```js
const pasoFacturar = (CODIGO.match(/openFacturarParcialSheet\(alb, \{ refresh, setStatus \}\)/g) || []).length;
```

Si esa rama se mergea **después** de SCRUM-392, el defecto vuelve y con más superficie. Si se mergea
antes, este arreglo tiene que cubrir también los pasos de esa hoja. **Es una decisión de ORDEN DE
MERGE, y es del fundador** — aquí solo queda medida y escrita.

> ### ⏳ RESUELTA — la colisión de arriba ya no está pendiente (anotado el 7-ago-2026)
>
> **La medición de S3 era correcta el 6-ago y sigue siendo cierta como registro fechado**; lo que ha
> caducado es su tiempo verbal. Se anota al lado en vez de reescribirla, que es la regla de
> `docs/METODO_YAQU.md`: *un registro de lo que se MIDIÓ no caduca; una afirmación sobre el estado
> ACTUAL, sí.*
>
> **Medido el 7-ago-2026:** `f330208` **SÍ está en `origin/main`**
> (`git merge-base --is-ancestor f3302089 origin/main` → cierto), entró por el **PR #512**
> (`2990719`, 6-ago) y su rama ya no existe en `origin`. O sea: **se mergeó ANTES**, que es la
> segunda de las dos ramas que S3 dejó abiertas — y por tanto se aplica su propia frase, *«este
> arreglo tiene que cubrir también los pasos de esa hoja»*.
>
> Y encima llegó un tercer mordisco después: **SCRUM-292** (`5854334`) añadió `customer` al contexto
> de esa misma hoja, así que la técnica del literal que traía `scrum-386-sacar-sheets` ya habría
> estado rota al entrar. En `main` se parcheó con un regex más laxo (`[^}]*\brefresh\b[^}]*`), que
> es el tercer intento de vigilar una redacción.

## La resolución del conflicto (7-ago-2026) — y el agujero que dejó al descubierto

Los dos lados eran correctos y ninguno bastaba, así que **no se eligió uno**: el conflicto era por
MOVIMIENTO. De `main` venía la cobertura de `openFacturarParcialSheet` (y el tercer caso, el de
`customer`); de la rama venía el mecanismo bueno, el escáner AST.

**🔴 EL AGUJERO, que es lo que de verdad entrega esta resolución.** Quedarse con la rama tal cual
**borraba** la comprobación de `openFacturarParcialSheet` **sin que nada se pusiera rojo**: esa
función no estaba en su tabla `RECIBEN_CTX`, y el suelo de entonces —`pasos.length >= 3`— se
satisfacía de sobra con las tres llamadas de las otras dos funciones. Un suelo que cuenta el TOTAL
no nota que un sumando ha desaparecido.

> **Un escáner que sustituye a otro tiene que cubrir todo lo que cubría el anterior, y eso no lo
> dice ningún test que no se escriba a propósito.**

Es la **4ª lección** del bloque de comentarios del test, y la más cara de las cuatro: las tres
anteriores eran falsos rojos (molestos, visibles); ésta era un falso VERDE.

### Lo que cambia respecto a la entrega de S3

| | Antes (S3) | Ahora |
| --- | --- | --- |
| Funciones censadas | 2 | **3** — entra `openFacturarParcialSheet` |
| Posición del argumento | tabla a mano | **derivada por AST** del parámetro llamado `ctx` |
| Claves exigidas | lista GLOBAL `['cur','refresh','setStatus']` | **derivadas del cuerpo de CADA función**, resolviendo los reenvíos |
| Suelo | total `>= 3` | total `>= 4` **+ por FUNCIÓN** (cada una tiene que aparecer en el censo) |

**Por qué las claves NO podían seguir siendo globales, y es el detalle que lo decide:**
`openFacturarParcialSheet` desestructura `const { refresh, setStatus } = ctx;` — **sin `cur`**.
Meterla en el censo con la lista global la habría puesto ROJA con el código CORRECTO: la cuarta
equivocación de la misma familia, cometida al arreglar las tres primeras.

**Y el contrato se resuelve TRANSITIVAMENTE, que no es un adorno:** `openAlbEditorSheet` no
desestructura nada, solo reenvía su `ctx` a `buildAlbEditor`. Derivar solo de su cuerpo le habría
dado un contrato VACÍO y el paso del botón «Editar líneas» habría dejado de comprobarse — el mismo
defecto de esta resolución, en versión silenciosa.

### Medido en `public/dashboard/js/jobDetailView.js` (no supuesto)

| Función | Posición de `ctx` | Su cuerpo desestructura | Contrato efectivo |
| --- | --- | --- | --- |
| `buildAlbEditor` (`:1715`) | **3** de 4 — `(box, alb, opciones = {}, ctx = {})` | `:1719` `const { cur, refresh, setStatus } = ctx;` | `cur, refresh, setStatus` |
| `openAlbEditorSheet` (`:2059`) | **1** de 2 — `(alb, ctx)` | *nada* — reenvía `ctx` a `buildAlbEditor` (`:2097`) | `cur, refresh, setStatus` (heredado) |
| `openFacturarParcialSheet` (`:2117`) | **1** de 2 — `(alb, ctx)` | `:2121` `const { refresh, setStatus } = ctx;` | `refresh, setStatus` |

Pasos de contexto en el árbol: **4** — literales en `:1240` (crear), `:1331` (editar desde la fila)
y `:1365` (facturar parcial, que lleva además `customer`), más el reenvío de `:2097`.

### Los cuatro rojos de la resolución, ejecutados y con la inyección verificada en disco

| Mutación | Esperado | Resultado |
| --- | --- | --- |
| **R1** · quitar `refresh` del paso de `openFacturarParcialSheet` | 🔴 | cae **nombrando** `openFacturarParcialSheet`, línea 1365 y «refresh» |
| **R2** · quitar `cur` del paso de crear | 🔴 | cae **nombrando** «cur», línea 1227 |
| **R3** · añadir `pruebaAditiva` a **cada uno** de los 3 pasos, por separado | ✅ verde ×3 | 13/13 en los tres |
| **R4** · renombrar `openAlbEditorSheet` (declaración **y** llamadas) | 🔴 el SUELO | `ESCÁNER CIEGO en: openAlbEditorSheet` |

**R1 es la prueba de esta resolución**: es la que demuestra que el agujero está tapado. Contra el
lado de la rama tal cual, R1 salía **verde**.

⚠️ En R4 caen además otros cuatro tests del fichero. Se anota porque S3 dejó escrita justo esa
trampa —*«un rojo que sale por donde no esperabas no es el rojo que querías probar»*— y por eso el
mensaje del SUELO se extrajo por separado, para ver que cae **él** y no solo sus vecinos.

# SCRUM-378 · Cada página carga lo que su propio código necesita — y para las nueve, no solo el dashboard

**Fecha:** 5-ago-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `f96309b3fc58167507d610683c23e8f5072f80ce` · 2026-08-05T23:41:54+01:00

**Tanda:** 1807 tests, 1740 pass, 0 fail, 67 skipped

## El defecto que lo motiva

S3 inyectó un `.btn-primary` en `login.html` para provocar un rojo. **`login.html` no carga
`styles.css`**, así que el botón nunca tuvo fondo verde y **la prueba no podía fallar**. Una página
que no carga lo que das por hecho que carga.

Con éste van tres de la misma forma en una noche (`landing-demo.js`, `METODO_YAQU.md` sin
referenciar, y esto), y el patrón es siempre el mismo: **el mecanismo existe y el sitio donde tenía
que actuar no lo tiene delante**.

## Lo que ya estaba cubierto, y no se toca

El guard de **SCRUM-274/302** compara `sw.js` ↔ `dashboard/index.html` en los dos sentidos **y**
comprueba que lo listado existe en disco. Contesta bien su pregunta. Lo que **no** pregunta —ni
tiene por qué— es si una página carga lo que su propio código necesita, ni mira las otras ocho
páginas. Éste se suma; aquél no se ha tocado.

## 🔴 Tres cubos, y el tercero es el que salva al guard de sí mismo

Por cada cosa que el código de una página invoca:

| | | Veredicto |
| --- | --- | --- |
| ① | la define un `<script src>` que ESA página carga | OK |
| ② | la define algún fichero del repo, pero esa página no lo carga | **ROJO** |
| ③ | no la define NADIE en el repo y no es de plataforma | **ROJO, y es peor** |

**El cubo ③ no es celo: tapa un agujero que habría puesto el guard verde en su caso peor.** Si el
conjunto «globales que define el repo» se deriva de lo que existe, borrar entero el fichero que
define algo lo saca del conjunto — y la página que lo invoca **dejaría de comprobarse**. Un conjunto
definido por lo que EXISTE no puede detectar lo que DEJÓ de existir.

## Por qué aquí sí hay una lista a mano, y por qué es legítima

`PLATAFORMA` (los globales del navegador) está escrita a mano, que es justo lo que esta casa evita.
La diferencia está en **quién la mueve**:

* es **externa y estable** — no cambia cuando cambia nuestro código, así que no puede quedarse corta
  por algo que hagamos nosotros;
* **lo nuestro se DERIVA** del árbol en cada tanda, porque eso sí cambia con cada fichero nuevo.

Si algún día falta un nombre de plataforma, el síntoma es un rojo del cubo ③ con un nombre que
cualquiera reconoce (`structuredClone`) — molesto, pero **nunca un verde falso**.

## Lo que mide, y lo que deliberadamente no

* **JS**: solo llamadas con identificador desnudo (`foo(...)`), que son las que revientan con
  `ReferenceError`. `window.foo(...)` **no** cuenta: en este repo va casi siempre tras un
  `if (window.foo)`, que es dependencia BLANDA, y marcarla daría falsos rojos.
* **CSS**: solo el cubo ②. Una clase que **nadie** estiliza suele ser un ancla de JS
  (`.inv-row-check`), no un defecto; lo que sí lo es —y es el caso de `login.html`— es usar una clase
  que **alguien** estiliza y no cargar su hoja.

## 🔴 El analizador nació ciego, y el rojo lo dijo antes de que llegara al repo

La primera versión solo miraba los `<link>`, y **acusó a cinco páginas sanas**: `index.html`,
`precios.html`, `admin.html`, `privacidad.html` y `terminos.html` no cargan `styles.css` — **llevan
su CSS en un `<style>` inline** (la landing, 148 clases; admin, 37).

Un guard que se estrena señalando a quien no tiene culpa se desactiva en el segundo PR. Se midió
antes de darlo por bueno y el analizador aprendió a leer el `<style>` de la propia página.

## Verificado en rojo

Cuatro sabotajes, todos **en memoria sobre el árbol real**, y cada uno comprueba primero que **su
mutación llegó a aplicarse** — un sabotaje que no muta nada produce un verde que parece una prueba:

| Sabotaje | Sale rojo |
| --- | --- |
| **El `.btn-primary` de S3 en `login.html`** | el caso que motivó el ticket |
| Quitar el `<script>` de `jobActionsRegistry.js` de `index.html` | cubo ②, nombrando `destinoAccionTrabajo` |
| **Borrar el FICHERO entero** `jobActionsRegistry.js` | **cubo ③**, nombrando el global huérfano |
| Control negativo: una clase que nadie estiliza | **no** pone rojo el guard |

Más el **suelo**: si el barrido no ve ≥9 páginas, ≥200 globales derivados, ≥40 `<script src>` o ≥20
globales invocados en el dashboard, falla — «todo cargado» y «no supe mirar» no pueden ser el mismo
verde.

El tercero es el que pidió el asesor y el que prueba que el cubo ③ no es decorativo: **sin él, el
guard se pondría verde exactamente cuando la dependencia desaparece del todo.**

## Censo de las nueve páginas (para decisión del asesor)

| Página | `<script src>` | `<link .css>` | `<style>` | clases inline |
| --- | --- | --- | --- | --- |
| `dashboard/index.html` | 43 | 2 | 0 | 0 |
| `index.html` (landing) | 1 | 1 | 1 | 148 |
| `login.html` | 1 | 2 | 0 | 0 |
| `precios.html` | 1 | 1 | 1 | 16 |
| `register.html` | 0 | 2 | 0 | 0 |
| `admin.html` | 0 | **0** | 1 | 37 |
| `privacidad.html` | 0 | **0** | 1 | 7 |
| `terminos.html` | 0 | **0** | 1 | 7 |
| `dashboard/products.html` | **0** | **0** | **0** | **0** |

**`admin.html` no es el caso que temíamos**: no carga hojas porque **se estiliza sola** con 37 clases
inline. Igual `privacidad` y `terminos`.

**`products.html` sí es el único con cero de todo**, y medido resulta ser **un redirector de 12
líneas**: `<meta http-equiv="refresh" content="0; url=./index.html#products">`. No lo enlaza nadie
en el árbol. No necesita ni script ni hoja — pero que no lo enlace nadie es dato para el asesor, no
conclusión mía.

## Lo que NO cubre

* **No sigue `import`/`export`**: los ficheros del dashboard son scripts clásicos. Un módulo ESM con
  sus propias dependencias no se analiza.
* **No resuelve alcances de verdad**: un nombre declarado en CUALQUIER función del fichero se
  considera declarado. Es una sobreaproximación **en la dirección segura** (no inventa rojos), a
  costa de poder callar un uso libre en otro ámbito.
* **No mira `window.foo(...)`**, por lo dicho arriba.
* **No comprueba el ORDEN de carga** —que el registry venga antes que quien lo usa—, que hoy sostiene
  un comentario en `index.html:209`.
* **No entra en el CSS de terceros ni en estilos inline por atributo** (`style="…"`).

## Ficheros

* `tests/_carga-de-pagina.mjs` — **nuevo**. El analizador: los tres cubos, la lista externa y la
  derivación del árbol.
* `tests/scrum378-carga-por-pagina.test.mjs` — **nuevo**, 7 tests (2 del guard, 4 rojos, 1 suelo).

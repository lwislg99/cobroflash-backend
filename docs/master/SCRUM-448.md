# SCRUM-448 · Cobros afirmaba «no hay cobros» mientras cargaba

**Fecha:** 10-ago-2026 · **Carril:** B (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `e171c752f61231bec77dc2c22ecc7f82167d964c` · 2026-08-10T19:46:55+01:00
**Tanda:** 2789 tests · 2715 pass · **0 fail** · 74 gateados · `npm test` exit **0** · `guards:entrada` 17/17

> 🔴 **DEPENDENCIA DE ORDEN DE MERGE:** esta rama sale de `scrum-362-banco-sin-cobertura`, **no de
> `main`**, porque el escenario «acepta y no entrega» —lo único con lo que se puede probar esto—
> vive ahí y todavía no está en `main`. **362 primero, 448 después.**

## El defecto

Un profesional con mala cobertura abre Cobros, la petición se queda en el aire, y la pantalla le
afirma **«Todavía no hay cobros registrados.»** Cierra tranquilo: no le debe nadie nada, según
nosotros.

**No era el texto: faltaba un estado.** SCRUM-285 separó con cuidado los dos vacíos —«no hay
ninguno» y «tu filtro los esconde»— y el tercero, **«todavía no lo sabemos»**, caía en el primero,
porque `datos` está vacío antes de que llegue la respuesta y `pintarFilas()` se llamaba igual.

Lo encontró **el banco de SCRUM-362 en su primer uso**, con el escenario «acepta y no entrega». No
lo cazó ningún test de los míos: todos le daban a la pantalla datos ya fabricados.

## PASO 0

**a) ¿Estaba hecho?** No: `docs/master/SCRUM-448.md` no existe en `main` y ningún commit lo cita.

**b) ¿Cobros distinguía ya el estado de carga?** **No.** Medido en `main`: `pintarFilas()` se llama
**antes** de `apiRequest`, con `datos = []`, así que entra por la rama de «sin cobros». La premisa
se sostiene.

**ENTRADA.** `Cobros` en la barra → `case 'cobros'` → `renderCobrosView` → `apiRequest('/admin/cobros')`.

**MECANISMO.** Los dos estados vacíos y el aviso de error **ya existen y están aprobados**. Lo que
falta es el tercer estado, no texto nuevo.

### El censo: ¿a cuántas pantallas más les pasa? — **a UNA, y así se contó**

No por lectura: **ejercitando cada vista** con el escenario colgado y mirando si afirma un vacío.
De **10 vistas que el banco consigue pintar**:

* **1 afirma un vacío con la petición en el aire**: `renderCobrosView` → «Todavía no hay cobros registrados.»
* **9 no afirman nada**: `customers`, `albaranes`, `jobs`, `quotesList`, `templates`, `expenses`,
  `home`, `team`, `quoteRequests`.
* **2 el banco no las pinta** y quedan sin medir: `invoices` y `products` (hueco de SCRUM-417).

**El alcance no cambia: es una pantalla.** El número lleva su cómo — y su límite: las dos que el
banco no monta **no están medidas**, no están declaradas sanas.

## Lo que se construye

Un tercer estado —`estado`, con tres valores nombrados— y **cero microcopy nueva**:

* mientras no se sabe, `pintarFilas()` **sale sin pintar ningún vacío**: la tabla se queda muda. Ni
  «no hay cobros» ni «tu filtro los esconde» — las dos son afirmaciones sobre datos que no han
  llegado;
* cuando llega, se pinta lo de siempre;
* cuando falla, el aviso de siempre.

### 🔴 El caso que decide el diseño: ¿y si no llega NUNCA?

Es lo que hace una red que acepta y no entrega: la promesa **no resuelve ni rechaza**, así que sin
plazo ni el `then` ni el `catch` corren jamás y la tabla se quedaría muda para siempre. **Un
indicador de carga eterno tampoco sirve:** no miente, pero deja al profesional sin saber qué hacer.

Al vencer el plazo se dice **lo mismo que cuando falla**, con el texto ya aprobado en SCRUM-285 —
*«No hemos podido cargar los cobros. Vuelve a intentarlo.»*—, porque para quien mira **es el mismo
hecho**: no están sus datos y puede reintentar.

### El plazo: DIEZ segundos — decisión del fundador

De dónde sale, porque si no no vale: **no hay p95 de `/admin/cobros` en producción y no se
inventa**. Sale del umbral clásico de 10 s a partir del cual una persona deja de creer que el
sistema trabaja y empieza a creer que está roto. Es una **referencia general, no un dato nuestro**,
y así queda escrito aquí y en el código.

Va hacia abajo y no hacia arriba porque **los dos fallos no cuestan igual**: un plazo corto de más
saca el aviso y la respuesta llega luego —molesto, y **recuperable**—; uno largo de más deja la
tabla muda, sin información ninguna, y **de ahí el profesional no sale**.

En **una constante con nombre y en un sitio**, porque este número va a cambiar en cuanto midamos y
cambiarlo tiene que ser cambiar una línea. Hay test de que son 10000, de que la constante aparece
exactamente tres veces y de que no hay otro número de plazo suelto.

### 🔴 Número de secuencia: solo pinta la ÚLTIMA petición lanzada

Aquí **no se introduce `AbortController`** —es SCRUM-451, otro carril—, y la consecuencia directa es
que **la petición vencida sigue viva y va a llegar**. Sin contador:

* t=10 s vence → se pinta el aviso;
* se relanza → t=11 s llega la segunda y pinta la lista buena;
* t=13 s llega la primera y **pinta encima una lista más vieja**, sin que nada lo diga.

Es el defecto que nadie ve hasta que muerde, y tiene test propio. El contador vive **fuera del
render** para que dos renders de la misma pantalla tampoco puedan pisarse.

### Y el dato gana al mensaje

Si la respuesta llega tarde **y es la última lanzada**, se pinta y **sustituye al aviso**. Lo que
vence **nunca** se cuenta como «no hay cobros»: eso es el defecto entero de este ticket, y colarlo
por la puerta del plazo sería reintroducirlo.

### 🔴 El agujero que apareció al añadir el plazo, y por qué hay TRES estados y no dos

Con una sola bandera `cargado`, el aviso ponía `cargado = true`… y entonces **pulsar un filtro
volvía a llamar a `pintarFilas()` con la lista vacía y la pantalla decía otra vez «no hay cobros»**.
El defecto de este ticket, reintroducido por su propio arreglo. Se cierra con un estado nombrado
—`'cargando' | 'listo' | 'sin-respuesta'`— para que **no haya combinación que caiga en el vacío por
descarte**, y con su test.

## 🔴 EL HUECO QUE SE DECLARA Y NO SE TAPA

**Sin `AbortController`, la petición vencida SE SIGUE DESCARGANDO ENTERA aunque ya no pinte: gasta
los datos del profesional y ocupa la conexión, en el peor sitio posible.** El plazo de aquí decide
**qué se enseña**, no corta nada. **El plazo que corta de verdad es SCRUM-451, no éste.**

## Verificado

**El test que decide lleva su control positivo DENTRO:** con la petición en vuelo se comprueba que
la pantalla **sí ha pintado** su título y sus filtros —si no pintara nada, «no afirma» sería cierto
y no significaría nada— y que **no afirma** ninguno de los dos vacíos.

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | vuelve el pintado del vacío durante la carga | 🔴 «con la petición **TODAVÍA EN EL AIRE** la pantalla afirma que no hay cobros. Le está diciendo al profesional que **no le debe nadie nada** cuando lo único cierto es que no lo sabemos» |
| **R2** | el escenario deja de colgar (SUELO) | 🔴 «la petición no se quedó en el aire (1 resueltas · 0 colgadas): **el escenario no se ha montado** y este test estaría aprobando la pantalla sin haberla puesto nunca sin cobertura» |
| **R3** | desaparece el plazo | 🔴 «pasado el plazo la pantalla **sigue muda**… dejar al profesional mirando una tabla vacía sin decirle nada no es mejor que mentirle: **es no contestarle**» |
| **R4** | se quita el guard de secuencia | 🔴 «la respuesta de una petición **VIEJA** ha pintado. Con una más nueva en marcha, eso sustituye datos buenos por datos peores y el profesional se queda mirando una lista vieja **sin saberlo**» |
| **R5** | el aviso bloquea al dato tardío | 🔴 «la respuesta llegó tarde y la pantalla **sigue con el aviso**. El dato gana al mensaje: si los cobros están, se enseñan» |
| **R6** | el aviso no se repinta al filtrar | 🔴 «un clic en un filtro ha convertido **«no sabemos» en «no hay»**. El defecto de este ticket, reintroducido por la puerta del plazo» |
| **R7** | otro número de plazo suelto | 🔴 «hay otro número de plazo **fuera de la constante**. El plazo vive en UN sitio porque va a cambiar en cuanto midamos» |

Las siete con **post-condición**: cambió el fichero que digo, y la cadena ya no está —o, cuando la
mutación **envuelve** en vez de borrar, que el envoltorio esté en el disco—. Una inyección que no
llega al fichero es una prueba **no ejecutada**, no una superada. Y cada rojo cae en **su** test y
en ninguno más: un rojo que tira media suite no dice qué se rompió.

**R7 nació rojo por mi culpa y eso también se cuenta:** el escáner se cazaba a sí mismo en la
declaración de la constante. Corregido descontando comentarios **y** la propia línea de la
declaración, y vuelto a probar en rojo con un `10000` suelto de verdad.

**Los otros dos estados, con test propio** — son los que más fácil se rompen al tocar esto: sin
ningún cobro sigue diciendo lo suyo · con un filtro que no casa (pulsándolo de verdad) sigue
diciendo lo suyo, y **no dice «no hay cobros»**.

**Control negativo del plazo:** si la respuesta llega a tiempo, el aviso **no aparece después** ni
se lleva por delante los datos que el profesional ya está leyendo.

**No se ha convertido el texto de hoy en aserción** en ninguna parte: lo que se afirma es lo que la
pantalla **no** debe decir, y los dos textos que sí se comprueban son los aprobados en SCRUM-285.

## Lo que este ticket cambia del banco, y por qué

`pintarVista` hacía `await r` sobre la promesa de la vista, y eso **colgaba el test para siempre**
en cuanto la vista era `async` y esperaba una petición que no vuelve — o sea, en el escenario que el
banco existe para poder montar. **El propio banco no podía usar su escenario.** Ahora espera la
vista **o** unos ticks, lo que pase antes, y deja la vista **a medio pintar**: que es exactamente lo
que hay que mirar. No es una tolerancia; es la única forma de observar un estado que por definición
no termina.

## Lo que NO cubre

* **`invoicesView` y `productsView` no están medidas.** El banco no las pinta (hueco de SCRUM-417),
  así que **no se sabe** si afirman un vacío mientras cargan. No se declaran sanas.
* **La petición vencida se sigue descargando entera**: aquí no se corta. Ver el hueco de arriba.
* **No se ha visto en un navegador.** Lo verificado es la lógica de estados en el banco.
* **Solo se arregla Cobros.** Las otras nueve no lo necesitan hoy; nada impide que una nueva nazca
  con el defecto, y **no hay guard que lo impida** — sería un censo de estados de carga, y es otro
  carril.

## Ficheros

* `public/dashboard/js/cobrosView.js` — el tercer estado, el plazo de 10 s y el nº de secuencia.
* `tests/scrum448-cobros-estado-de-carga.test.mjs` (nuevo, 9).
* `tests/_banco-vistas.mjs` — `pintarVista` deja de colgarse con vistas `async` sin respuesta.
* `tests/_banco-red.mjs` — escenario `llegaTarde(ms, datos)`: la red que **tarda pero entrega**,
  que es lo único con lo que se puede probar «el dato gana al mensaje». «Tardó» y «no llegó» se
  parecen mucho desde fuera y son dos cosas distintas.

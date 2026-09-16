# SCRUM-451 · El plazo de red vive en un sitio, y corta

**Fecha:** 10-ago-2026 · **Carril:** B (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `2e12c2f784615db647a5f35d18ebfeafe6f69c07` · 2026-08-10T20:57:01+01:00
**Tanda:** 2820 tests · 2746 pass · **0 fail** · 74 gateados · `npm test` exit **0** · `guards:entrada` 17/17

## La víctima

Un profesional con mala cobertura abre cualquier pantalla que no sea Cobros, la petición se queda
en el aire, y la pantalla **espera para siempre**. Ni datos, ni error, ni nada: se queda mirando.

## PASO 0

**a) ¿Estaba hecho?** No: `docs/master/SCRUM-451.md` no existe en `main`, no hay rama `scrum-451-*`
en el remoto y el único commit que cita el número es el de SCRUM-448 nombrándolo como pendiente.

**b) ¿Sigue siendo cierta la premisa?** Sí, medido sobre `origin/main`: **cero** `AbortController`
—el único acierto era la palabra dentro de un comentario mío—, **cero** `signal`, y el plazo de
10 s vivía dentro de `cobrosView.js` (`COBROS_PLAZO_MS`, 2 usos).

**ENTRADA.** `public/dashboard/js/api.js:6` → `apiRequest(path, options)`. La segunda puerta es
`descargarBinario` (`api.js:155`), con su propio `fetch`.

**MECANISMO.** El motor estaba: SCRUM-448 dejó escrito el porqué del número y el patrón. Esto es
**darle superficie**, no rehacerlo.

## Lo que se decide MIDIENDO: ¿un plazo para todo, o por tipo?

Censo por AST sobre `public/dashboard/js` entero (51 ficheros leídos):

| población | cuántas | qué se hace |
|---|---|---|
| **GET «pelados»** por `apiRequest` | **58** | plazo de 10 s **y aborto** |
| **Mutaciones** por `apiRequest` (POST 56 · PATCH 10 · PUT 8 · DELETE 4) | **78** | **nada. PARADO** |
| Descargas pesadas por `descargarBinario` (ZIP de portabilidad, XML VeriFactu) | 4 | **nada**: no pasan por `apiRequest` |
| **`fetch` a pelo**, fuera de `api.js` | **37** en 9 ficheros | **nada, y no pueden subir** |

Cero GET con `headers` o `body`: por eso dos peticiones a la misma ruta son **la misma petición**,
sin ambigüedad, y se pueden compartir.

### 🔴 Por qué las mutaciones se quedan fuera — y esto es un STOP, no una omisión

Abortar un GET no cuesta nada: es idempotente y se vuelve a pedir. **Abortar una mutación es otra
cosa**: el servidor ha podido procesarla ya, el profesional ve un error, lo repite, y **sale una
segunda factura**. Eso es dinero y es el camino de emisión. **No se decide aquí: se propone al
fundador.** Las 78 siguen exactamente como estaban, y hay un test que impide que el corte se cuele
sin decidirlo.

Y el ZIP de evidencias tampoco: **no se le pone un plazo a ojo**. Un ZIP y un listado de cobros no
aguantan lo mismo, y esa medición no la tenemos.

## Lo que se construye

**① El plazo, en `api.js`, en una constante con nombre.** `PLAZO_RED_MS = 10000`. El número es el
que ya decidió el fundador en SCRUM-448 y por lo mismo: no hay p95 de estas rutas y no se inventa;
es el umbral clásico a partir del cual una persona deja de creer que el sistema trabaja y empieza a
creer que está roto. **Referencia general, no dato nuestro.**

**② Con `AbortController`** — lo que 448 dejó fuera a propósito y declaró como hueco. **El plazo
cubre también el cuerpo:** `fetch` vuelve con las cabeceras y el cuerpo se sigue bajando después,
así que un plazo que muriera al resolver el `fetch` dejaría vivo justo lo que gasta los datos.

**③ Número de secuencia por ruta… que COMPARTE en vez de descartar.** Descartar la vieja en
silencio era lo primero que pensé, y está medido que habría sido una avería nueva: **22 rutas se
piden desde más de un sitio** —`/admin/jobs/{}` desde 7, `/admin/merchant` desde 6,
`/admin/metrics/home` desde 2 en la misma vista—. Descartar dejaría a un llamador legítimo esperando
para siempre. Al que se quedó atrás se le entrega **el resultado de la más nueva**: nadie se queda
sin respuesta y nadie pinta datos viejos.

**④ `cobrosView` se queda sin plazo y sin contador propios.** El guard de SCRUM-448 **no se borra,
se reapunta**: allí comprueba ahora que esa vista **no se ha quedado con el suyo** ni con un
`setTimeout`; aquí, que la constante es única y que **ninguna vista del panel tiene un plazo propio**.

**⑤ El banco monta `invoicesView` y `productsView`.** Su `querySelector` era `() => null` fijo. Lo
peor no era que faltara: **mentía en silencio** —un `null` fijo es indistinguible de «ese nodo no
existe»—, y por eso SCRUM-448 tuvo que declarar esas dos sin medir. Ahora resuelve, y **lo que no
sabe resolver lo anota** en `reg.selectoresNoSoportados` en vez de callarse.

## 🔴 El plazo NO BASTA, y el número lo dice

Que `apiRequest` rechace no hace hablar a una vista que no trata el rechazo. Ejercitando **cada
vista del dispatch** (censo derivado de SCRUM-433) con la petición colgada:

* **13 dicen algo** al vencer: `home`, `customers`, `quotes-list`, `reports`, `templates`,
  `quote-requests`, `jobs`, `cobros`, `albaranes`, `libro-registro`, `expenses`, `plans`, `team`.
* **4 siguen MUDAS**: `invoices`, `products`, `providers`, `export`. Las tres primeras porque
  **cargan con `fetch` a pelo** y el camino común no las toca.
* **5 no se pueden medir**: `quotes-new`, `quotes-detail` y `jobs-detail` no publican su función;
  `albaran-detail` y `settings` revientan en el banco por métodos del DOM que el mini-DOM no tiene
  (`prepend`, `insertAdjacentHTML`). **No se declaran sanas.**

Que el camino común corte es la **condición** para arreglar esas 4, no el arreglo. No se arreglan
aquí porque **cada una necesita su texto y la microcopy la aprueba el asesor** (regla 30): un
mensaje genérico donde había uno concreto es un empeoramiento, no una unificación.

## Verificado

**Seis rojos por el MECANISMO**, cada uno con post-condición (cambió el fichero que digo y la cadena
ya no está):

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | fuera el plazo del camino común | 🔴 «NINGUNA vista dice nada al vencer el plazo… estas **18 se quedan esperando para siempre**: home, customers, quotes-list, …» — **nombra las vistas**, no dice «falta el plazo» |
| **R2** | fuera la guarda de secuencia | 🔴 «la respuesta de una petición **VIEJA** ha pintado» |
| **R3** | el plazo se aplica también a las mutaciones | 🔴 «se ha abortado una **MUTACIÓN**… sale una segunda factura» |
| **R4** | se descarta la vieja en silencio | 🔴 «al llamador que se quedó atrás se le ha entregado la respuesta VIEJA, o ninguna» |
| **R5** | el `finally` corre antes de bajar el cuerpo | 🔴 «el cuerpo se entregó pese al plazo: el corte solo llegaba a las cabeceras» |
| **R6** | un `fetch` a pelo nuevo | 🔴 «han aparecido 1 `fetch` nuevos a pelo (38 sobre un techo de 37)» + el reparto por fichero |

**🔴 Y un verde bajo mutación que era mío, no del test.** Quitar el `await` de `return res.json()`
**no** ponía nada en rojo, y yo había escrito en un comentario que ese `await` era lo que mantenía
vivo el plazo durante el cuerpo. Era falso: lo que lo sostiene es el `await` de `_enviar`, porque
`_pedir` encadena su promesa igual. El comentario decía un mecanismo que no existe —peor que no
decir nada—; **corregido, y probado en rojo con la mutación que sí lo rompe.**

**Control negativo:** una petición **lenta pero normal** por debajo del plazo (30 ms contra 300) no
se aborta, se pinta, y no saca ningún aviso. Sin esto el plazo es un generador de falsas alarmas y
acaba subido a 60 s por alguien harto, que es como muere un mecanismo.

**Control de no pasarse:** una **mutación** no lleva plazo, no se aborta, y no termina sola.

**Suelos, por separado** —un cero agregado tapa otro—: ficheros leídos ≥ 40 · llamadas a
`apiRequest` ≥ 100 · reparto por método no degenerado · **cero llamadas de método desconocido** ·
el escenario tiene que haber colgado de verdad · el dispatch tiene que dar ≥ 20 vistas · ≥ 10 vistas
medidas · y **al menos una tiene que hablar**, o «las mudas no suben» sería verdad sin significar nada.

**El banco tuvo que arreglarse para poder medir esto, y es la mitad del trabajo:**

* **obedece el `signal`.** Un `fetch` de mentira que lo ignora entrega su respuesta igual después de
  abortar: con eso, «la petición vencida deja de descargarse» saldría **verde estuviera o no
  enchufado el `AbortController`». `reg.abortadas` y `reg.cuerposEntregados` lo hacen observable.
* **dos escenarios nuevos**: `cuerpoLento` (cabeceras rápidas + cuerpo lento, el único que distingue
  un plazo que corta de uno que lo parece) y `porLlamada` (sin **dos respuestas distintas** no se
  puede montar una carrera: «pintó la vieja» y «no pintó la vieja» serían el mismo texto).
* **representa las etiquetas sin atributos** al asignar `innerHTML`. Antes se las saltaba, y un
  `card.innerHTML = '<div>…</div>'` seguido de `card.querySelector('div')` devolvía `null`: la vista
  reventaba por un hueco del banco, no del producto.

## Lo que NO cubre

* **Las 78 mutaciones no tienen plazo.** Está parado a propósito y necesita decisión del fundador.
* **Los 37 `fetch` a pelo se saltan el plazo entero.** No se arreglan aquí —nueve ficheros, otro
  carril— pero **no pueden crecer**: trinquete con techo 37.
* **4 vistas siguen mudas** tras vencer. Necesitan microcopy aprobada, una por una.
* **5 vistas no se han podido medir.** No se declaran sanas.
* **Cero reintentos automáticos**, a propósito: un reintento silencioso sobre un POST no es
  idempotente.
* **No se ha visto en un navegador.** Lo verificado es la lógica en el banco.
* ⚠️ **Un texto que no es microcopy aprobada pero puede acabar leyéndose.** El error del plazo lleva
  `message: 'la petición ha superado el plazo de red'`. No inventa copy de producto —se marca
  `sinRed` y `vencido`, como hizo SCRUM-404—, pero hay vistas que enseñan `err.message` tal cual.
  Hoy en ese caso enseñan `Failed to fetch`, en inglés; ahora enseñarán esa frase. Es la misma clase
  que el `'fallo de red'` que ya vivía en este fichero. **Si el asesor quiere otra, es una línea.**

## Ficheros

* `public/dashboard/js/api.js` — el plazo, el aborto y la secuencia por ruta.
* `public/dashboard/js/cobrosView.js` — se queda sin plazo y sin contador propios.
* `tests/scrum451-plazo-de-red.test.mjs` (nuevo, 11).
* `tests/_censo-peticiones-panel.mjs` (nuevo) — censo por AST de `apiRequest` y `fetch` a pelo.
* `tests/_banco-red.mjs` — obedece el `signal`; `cuerpoLento` y `porLlamada`.
* `tests/_banco-vistas.mjs` — `querySelector`/`querySelectorAll`/`closest` de verdad, atributos que
  se guardan, etiquetas sin atributos representadas, y registro de selectores no soportados.
* `tests/scrum448-cobros-estado-de-carga.test.mjs` — reapuntado, no borrado.

## Un caso de SCRUM-448 se queda SIN CASO, y se dice

«El dato gana al mensaje» existía **porque** la petición vencida seguía viva y llegaba tarde. Con el
aborto **ya no llega**. La regla no se incumple: se queda vacía **por la puerta buena**, que es la
que 448 declaró como hueco. Su test ahora defiende lo que sigue siendo verdad y sigue importando —al
vencer se avisa, no se dice «no hay cobros», y la petición **se corta de verdad**.

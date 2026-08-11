# SCRUM-357 · H1 — que el profesional sepa qué lleva encima

**Medido contra:** `origin/main` = `8371d1b9870a1d09e2d58653d64b33b4a817dc1d` · 2026-08-11T21:44:49+01:00

**Carril:** H (albarán sin red) · **Rama:** `scrum-357-que-sepa-que-lleva` · **Cierra H1**
**Gate:** el mecanismo corre en `npm test`; la caja, en `npm run guard:caja-avisos` (Edge, fuera de
la suite por la misma decisión de SCRUM-368/469: la suite no arranca un navegador).

---

## PASO 0 — la premisa, medida antes de construir nada

SCRUM-460 dejó la precarga devolviendo **tres** resultados y su propio comentario escribió el
encargo de este ticket: *«El resultado se GUARDA, no se pinta: los tres valores —precargué N, no
había nada, no supe mirar— son lo que H2 va a leer»*.

**Consumidores de `window.precargaUltimoResultado` el 11-ago-2026: CERO.**

| dónde | qué era |
|---|---|
| `app.js:665`, `:666`, `:669`, `:670` | el propio productor: dos asignaciones y sus dos `return` |
| `app.js:485` | un comentario de SCRUM-469 que lo cita como patrón |
| `docs/master/SCRUM-460.md:139`, `SCRUM-469.md:73`,`:167` | las dos entradas que ya lo declaraban pendiente |

Cinco apariciones en código, **ninguna es una lectura**. El producto sabía qué llevaba el móvil al
sótano y el profesional no. Separar tres estados en una variable que no lee nadie deja al pro
**exactamente igual de ciego** que haberlos colapsado, con el coste de haberlos separado.

**Búsqueda por contenido, no por número** (218 → 220 cabezas remotas, listado completo): ninguna
rama tiene un consumidor. `precargaUltimoResultado` aparece en **1 fichero** en `main` y en las
ramas que ya llevan `main` dentro, en ninguna en más. No hay duplicado.

---

## 🔴 La regla que separa el segundo del tercero, y es el ticket entero

> **«No había nada que llevarte» y «no hemos podido prepararlo» dejan al profesional IGUAL —en el
> sótano, sin albarán— y significan lo contrario.**

- El **segundo** es tranquilo y **correcto**. Con los números de producción del 10-ago (42 trabajos,
  **0 agendados hoy o mañana**, 1 tocado en la última semana) es el caso **normal**, no el raro.
- El **tercero** es una **avería nuestra** y tiene que sonar a eso.

Se separan por **texto y por canal**, y lo segundo importa: si alguien colapsa dos textos por
descuido, el color y el rol siguen diciendo cosas distintas.

| estado | microcopy **aprobada** (regla 30, literal) | componente |
|---|---|---|
| `PRECARGADO` | «Llevas {n} albaranes listos para firmar sin cobertura.» · singular «Llevas 1 albarán listo…» | `.alert ok` + `role="status"` |
| `NADA_QUE_PRECARGAR` | «No hay nada que llevarte: no tienes trabajos abiertos ni agendados.» | `.alert info` + `role="status"` |
| `NO_SE_PUDO` | «No hemos podido preparar tus albaranes. Vuelve a entrar con cobertura.» | `.alert warning` + `role="alert"` |

Nada de esto estrena componente: las tres variantes ya existen en `.alert` (Parte AB).

---

## 🔴 El suelo — y no es una formalidad de cierre

**Todo lo que no se reconozca es el TERCERO.** Un estado que no es ninguno de los tres, un `null`,
basura — y también **un `PRECARGADO` con un `n` que no es entero ≥ 1**: «Llevas 0 albaranes listos»
sería el aviso más peligroso de los tres, porque *afirma que va preparado*. El barato de equivocarse
es éste: un falso «no hemos podido» cuesta que el pro vuelva a entrar con cobertura; un falso «no
hay nada» cuesta el albarán.

### La única excepción, y por qué no contradice el suelo

`undefined` **no** es «no se sabe»: es **«la medida todavía no ha llegado»**. La precarga sale sin
`await` desde `app.js` para no bloquear el arranque, así que la home puede montarse antes. Pintar el
tercero en ese hueco daría un fallo **parpadeante en cada carga**, que es la forma más rápida de
enseñar a ignorar el aviso.

Y para que ese hueco no pudiera quedarse abierto **para siempre**, se cerró el único caso en que lo
hacía: `precargarSiTocaAhora` devolvía `null` **en silencio** cuando `window.precargarAlbaranes` no
existía, y entonces la variable no llegaba a tener valor nunca. Ahora anota `NO_SE_PUDO` — no tener
ni precargador es el fallo **más** grave de los tres, y era el único que se quedaba mudo.

El límite de frecuencia (5 min) **no** se toca: ahí el resultado anterior sigue siendo la última
medida válida, y pisarlo con un «no se pudo» convertiría una espera en un fallo que no ha ocurrido.

---

## ⚠️ Dónde me aparto del encargo, dicho y no escondido

El encargo mandaba copiar el patrón de SCRUM-469, **«título y cuerpo como dos campos»**. **No se
copia esa parte, y sí las otras dos.**

Aquel aviso son dos campos porque **el asesor aprobó dos campos**. Los tres de aquí los aprobó como
**una frase cada uno**. Partirlos para parecerse al vecino sería reescribir microcopy aprobada, y la
regla 30 es dura mientras que «dos campos» era la forma de *aquel* texto, no una norma de la casa.
Además, la medida en navegador de SCRUM-469 ya **desmintió** que partir sea lo que hace caber: a 390
y a 320 px aquel aviso ocupaba lo mismo partido que sin partir.

Lo que sí se copia es lo que importa: **fuente única** (el texto vive en `estadoFirma.js`, no en
quien mide), `.alert` del inventario, y **la caja medida con el CSS real ejecutando la pantalla**.

**Quien mide no pinta.** `almacenLocal.js` precarga y no publica ni un `window.TEXTO_*` —comprobado
y con guard en el fichero de tests—; es la misma frontera que `tests/scrum360-desalojo.test.mjs`
impone a `resistenciaAlmacen.js`, **cumplida en vez de relajada**.

---

## La caja, MEDIDA EN EDGE ejecutando la pantalla

`npm run guard:caja-avisos`, 11-ago-2026. No es aritmética y no es una copia del marcado: los avisos
se pintan con **la función del producto** y con los estados que publica `almacenLocal.js`.

```
390 px · caja del .alert 366 px (útil 338 px de texto)
         precarga · LO QUE LLEVAS     42 px · 1 línea  · 52 car.
         precarga · NO HAY NADA       63 px · 2 líneas · 67 car.
         precarga · NO SE PUDO        63 px · 2 líneas · 70 car.
320 px · caja del .alert 296 px (útil 268 px de texto)
         precarga · LO QUE LLEVAS     63 px · 2 líneas · 52 car.
         precarga · NO HAY NADA       63 px · 2 líneas · 67 car.
         precarga · NO SE PUDO        63 px · 2 líneas · 70 car.
```

Ninguno desborda, ninguno se sale de la pantalla, y la página no scrollea en horizontal a ninguno de
los dos anchos.

**Y antes de dar un número, el guard comprueba que la página medida es la que creo** —ya nos pasó
dos veces esta semana—: que `.alert` computa 13,5 px, que el texto en pantalla es el literal que
publica `estadoFirma.js`, y que el **control negativo** de 400 caracteres sin cortar **sí** se caza.
Si algo de eso falla, no da un número: dice que no supo mirar.

### Por qué SCRUM-357 entra en el guard que ya existía

Un segundo script habría sido otra copia del servidor que lee del disco, de los suelos y del control
negativo — y **la copia que se queda vieja es siempre la que nadie ejecuta**. Se añaden nodos a la
misma página. **No se ha relajado ni una comprobación de las que ya había**; las de SCRUM-469 siguen
tal cual y en verde.

---

## Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/js/estadoFirma.js` | `TEXTO_PRECARGA` (fuente única), `textoDeLoQueLlevas(n)`, `pintarPrecarga(resultado)` |
| `public/dashboard/js/homeView.js` | la caja `#home-precarga` y `pintarPrecargaEnHome()`, llamada desde `renderHomeView` |
| `public/dashboard/js/app.js` | `anotarPrecarga()`: el resultado se guarda **y se pinta**; y «no hay precargador» deja de ser mudo |
| `tests/scrum357-que-lleva-encima.test.mjs` | 13 tests: suelo del banco, los dos positivos, el control que decide, cuatro suelos y tres rojos por el mecanismo |
| `scripts/guard-caja-avisos.mjs` | los tres avisos nuevos, medidos con los mismos suelos y el mismo control negativo |

La caja va **detrás** de las de firmas pendientes y desalojo: aquéllas hablan de trabajo que puedes
**perder** y ésta de trabajo que puedes **hacer**, y una pérdida se lee antes que una capacidad.
Tampoco lleva `data-home-block` — que el pro pueda ocultar desde «Personalizar» el único sitio donde
se le dice que baja con las manos vacías sería devolverle el fallo mudo que este ticket cierra.

A diferencia de sus dos vecinos, **este aviso sí habla cuando todo va bien**: «no hay nada que
llevarte» es información que el profesional necesita **antes** de bajar, no ruido.

---

## 🔴 El rojo por el mecanismo, ejercitado sobre código ya commiteado

Los tres se probaron quitando el mecanismo y devolviéndolo con el editor —nunca `git checkout --`—,
y el árbol quedó restaurado bit a bit (`git diff` vacío).

| lo que se rompió | qué cae | qué dice |
|---|---|---|
| quitar `pintarPrecargaEnHome()` de `renderHomeView` | 1 test | *«🔴 EL PROFESIONAL NO SABE QUÉ LLEVA ENCIMA: `renderHomeView` no llama a `pintarPrecargaEnHome`… La función existiría y no la dispararía nadie.»* |
| que `app.js` vuelva a tirar el resultado | 2 tests | *«🔴 EL PROFESIONAL NO SABE QUÉ LLEVA ENCIMA. `app.js` precarga, guarda los tres resultados y no se los enseña a nadie… Es el fallo mudo contra el que existe el bloque H entero.»* |
| que el tercero caiga en el segundo | **5 tests** | *«🔴 NO SE PUDO MIRAR Y SE LE DICE QUE NO TIENE TRABAJO. Es la mentira tranquilizadora exacta que separó los tres estados en SCRUM-460, colándose por la pantalla.»* |

---

## Huecos declarados

1. **`fake-indexeddb` es un doble.** Se demuestra que **nuestro** código precarga, mide y dice lo que
   lleva; no que un iPhone en un sótano se comporte así. Eso es H7 y la matriz humana de
   `docs/QA_MASTER.md`.
2. **La cifra de producción no se ha reproducido.** «38 de 51» y «0 agendados hoy o mañana» son
   medidas del fundador y de SCRUM-460; aquí se citan, no se remiden — no hay acceso a producción
   desde esta sesión y no se ha buscado.
3. **El aviso no dice CUÁLES albaranes lleva.** Dice cuántos. Enseñar la lista es otra pantalla y
   otra microcopy que habría que aprobar; no se ha inventado.
4. **`TEXTO_SIN_ESPACIO_PARA_FIRMA` sigue aprobado y sin consumidor** (SCRUM-469 lo vigila). Este
   ticket no cablea el tope de `hayEspacioParaOtraFirma`: sigue siendo trabajo de quien lo haga.
5. **La precarga sigue dependiendo de que el pro traiga la app al frente con cobertura** antes de
   bajar. Esto no cambia ese límite —lo declaró SCRUM-460— sino que lo hace **visible**: ahora el
   profesional sabe que no lleva nada en vez de suponer que sí.

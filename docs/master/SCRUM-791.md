# SCRUM-791 · Las dos superficies del panel que el censo propuso, dentro del guard

**Fecha:** 6-sep-2026 · **Carril:** AB6 / objetivo táctil · **Gate:** sin gate — guard de navegador, fuera de `npm test`
**Medido contra:** `origin/main` = `61e9aea466ccf08ab315f446de92338ae2ca0268` · 2026-09-06T13:18:15+01:00
**Tanda:** 5664 tests, 5572 pass, 0 fail, 92 skipped (salida 0) — la SEGUNDA; la primera salió en rojo, ver abajo

> Nace de SCRUM-787, que censó el panel entero —**76 objetivos cortos distintos**, de los que 57
> son `.btn-sm`— y propuso vigilar **dos**, no dieciocho. El asesor aceptó las dos y sus motivos.

---

## Qué entra, y por qué éstas

| superficie | cortos distintos | por qué |
|---|---|---|
| `renderQuotesView` | **8** | es la pantalla que más se usa: el presupuesto en 30 segundos es el producto entero |
| `renderJobDetailView` | **6** | tiene **los dos peores del árbol** —14,0 px una casilla y 19,6 px la miga «Trabajos»— y se usa **de pie en obra**, con una mano y guantes |

**`renderSettingsView` NO entra aunque tenga más (10):** es configuración —se toca sentado y una
vez— y arrastra **9 nodos «sin pintar»** que nadie ha mirado. Un guard sobre una población que no
se sabe leer entra ciego. Entra el día que alguien mire esos nueve.

Las otras dieciséis siguen **medidas** (`npm run censo:tactil-panel`) y **sin vigilar**, a
propósito: medir es barato, vigilar se paga en cada PR.

## Aditivo: lo que ya funcionaba no se toca

* `scripts/_pagina-panel.mjs` gana `paginaDeVista(raiz, nombreFn, …)`. **`paginaDeClientes` no se
  toca**: necesita seleccionar una fila con el mecanismo del producto para que la barra del móvil
  exista, y eso es suyo.
* El guard gana un **bucle aparte** con sus dos superficies. El de la landing y el de Clientes,
  con sus `EXCEPCIONES_PANEL`, quedan intactos.
* `paginaDeVista` lleva **suelo de nodos**: una vista que monta pero pinta cuatro nodos no es una
  superficie medida, y devuelve `aviso` en vez de un árbol vacío. Es la lección de las ocho vistas
  sin fixture de SCRUM-787.

## Las excepciones, ACOTADAS A SU SUPERFICIE

Metidas en la lista compartida excusarían el mismo selector en **cualquier** pantalla —incluida una
que aparezca mañana—, y eso no es declarar una deuda: es bajar el umbral. Cada superficie declara
las suyas, con su motivo y quién las retira.

**`renderQuotesView`** — 5 selectores · `BUTTON.btn-ghost.btn-sm` (29,5–30,8) ·
`BUTTON.btn-ghost.btn-sm.quote-header-btn` (30,8) · `BUTTON.btn.btn-primary` (36,8) ·
`BUTTON.btn.btn-secondary` (36,8) · `INPUT` (17,0).

**`renderJobDetailView`** — 5 selectores · `BUTTON.btn-ghost.btn-sm` (30,7–30,9) ·
`BUTTON.btn-secondary.btn-sm` (30,6–30,9) · `BUTTON.btn-primary` (37,0) ·
`BUTTON.detail-miga-link` (**19,6**) · `INPUT` (**14,0**).

**Los tres grupos de SCRUM-787 están escritos en los motivos**, porque son **tres decisiones y no
una**: `.btn-sm` (clase compartida), el **botón base a 36–37 px** (que tampoco llega a AB6), y
**casillas y migas a 14–20 px** (que no son cuestión de una clase, sino de darles área ahí).

Y van bajo el **detector de sobrantes que mira LAS DOS ANCHURAS**, no una: `BUTTON.btn-ghost.btn-sm`
cumple a 390 y no a 929, y comprobarlo por anchura ya costó un falso rojo en Clientes.

## Verificado

### 🔴 El que decide: el guard REENCUENTRA lo que midió el censo

```
✅ suelo de renderQuotesView: 8 objetivos cortos DISTINTOS (el censo de SCRUM-787 midió 8).
✅ suelo de renderJobDetailView: 6 objetivos cortos DISTINTOS (el censo de SCRUM-787 midió 6).
```

Se cuentan elementos **distintos** (selector + texto), no mediciones: el mismo botón medido a dos
anchuras es **uno**. Confundirlo fue el error del dato de partida de SCRUM-787 —los «13» de
Clientes eran 11 contados dos veces—, y por eso el suelo se escribió así.

**Provocado:** pidiéndole a Quotes que reencuentre **9**, el guard se declara ciego y falla:

```
🔴 CIEGO · renderQuotesView: he encontrado 8 objetivos cortos DISTINTOS y el censo de SCRUM-787
   midió 9. Faltan 1: … Un verde aquí diría que la pantalla está cubierta cuando no lo está.
```

### ✅ La sonda: 4 de 4

Un botón de 12 px inyectado en cada superficie y cada anchura tiene que salir corto. Las cuatro
cazadas (`sonda: ✅ cazada`). Va en una página aparte servida **en memoria**: no se toca ningún
fichero del árbol.

**Provocado:** subiendo la sonda a 60 px —o sea, haciéndola cumplir— el guard falla **4 veces**,
una por superficie y anchura:

```
🔴 SUPERFICIE NO MEDIDA · renderQuotesView @929px: la sonda de 12 px sale como que CUMPLE los
   44 px. El medidor no está midiendo lo que cree.
```

Las dos mutaciones restauradas con `Buffer.compare = 0`.

### ✅ Contraste: la landing y Clientes no se mueven

Salida del guard **antes** y **después**, descontando la línea de arranque del navegador:
**las 86 líneas de LANDING + CLIENTES son idénticas**. Y el `diff` lleva su control positivo:
con una diferencia inyectada, la ve.

## El coste — aislado, y con las pasadas contadas

⚠️ **No doy el total de `censo:guards-navegador` como si fuera comparable.** Hoy se han medido
241,4 s, ~139 s y 343,7 s en la misma máquina sin tocar nada; ese número está abierto como defecto
propio. Aquí se mide **`guard:objetivo-tactil` AISLADO**.

**Primer intento — tres pasadas seguidas de cada configuración:**

| | pasada 1 | pasada 2 | pasada 3 |
|---|---|---|---|
| antes (2 superficies) | 25 075 ms | 24 676 ms | **8 545 ms** |
| después (4 superficies) | 9 693 ms | 9 101 ms | 8 333 ms |

**Ese cuadro no vale, y lo digo en vez de escoger la fila que me conviene:** la dispersión DENTRO
de una misma configuración (25,1 s → 8,5 s) es mayor que cualquier diferencia entre las dos. Es el
mismo defecto de los totales, reproducido en el guard aislado — y el patrón (las primeras pasadas
lentas) apunta a calentamiento.

**Segundo intento — descartando una pasada de calentamiento y ALTERNANDO A/B/A/B:**

| ronda | antes (2 superficies) | después (4 superficies) |
|---|---|---|
| 1 | 5 242 ms | 8 452 ms |
| 2 | 5 199 ms | 8 138 ms |

Con el calentamiento fuera, las dos configuraciones son estables (±43 ms y ±314 ms) y la
diferencia se lee: **+2,9 a +3,3 s** por las dos superficies nuevas, que son **8 páginas más**
(2 superficies × 2 anchuras × [medición + sonda]). Del orden de **1,5 s por superficie**.

**Cuatro pasadas cronometradas en el segundo intento; seis en el primero. Diez en total.**

## Lo que NO se ha hecho

* ⛔ **Ni un botón arreglado.** Los 76 siguen a decisión del fundador, y ahora sabe que son **tres
  decisiones**.
* ⛔ Ni las otras dieciséis superficies.
* ⛔ Ni `EXCEPCIONES_PANEL` de Clientes.
* ⛔ Ni `customersView`, `productsView` o `providersView`.
* ⛔ Ni un literal.

## Huecos declarados

1. **`renderJobDetailView` mide 6 de 11 interactivos**: 5 quedan «sin pintar» (caja 0×0) con estos
   datos. El guard los cuenta y los dice, pero **no están medidos**. Es el mismo tipo de hueco que
   los 9 de Settings, sólo que más pequeño.
2. **Sin JS vivo**: `_pagina-panel.mjs` sirve marcado serializado. Se mide geometría, no
   comportamiento. Un objetivo que crezca al enfocar no se ve.
3. **Datos de muestra fijos.** Las dos superficies se miden con el fixture del censo; otra forma de
   datos podría pintar más objetivos.
4. **El coste se ha medido en esta máquina y con el calentamiento descartado A MANO.** No hay
   mecanismo que lo garantice en CI, y el defecto del total sigue abierto.

## 🔴 Un guard de la casa me cazó, y tenía razón

Escribí en el borrador de esta entrada que **no hacía falta mirar el solape** «porque no se añade
un guard nuevo, se amplía uno». **Era falso, y la tanda lo dijo:**

```
🔴 ha cambiado el conjunto de guards cuyo destino NO se puede derivar.
   +   'guard:objetivo-tactil'
```

Ampliar el guard **cambió su destino**: sigue midiendo `/` con un `goto` literal —por eso sigue
contando en el `5×/index.html`— pero las dos superficies nuevas se sirven desde rutas virtuales
elegidas **en un bucle** (`${PUERTO}${s.ruta}`), y de una variable no se deriva ningún destino.

Se **declara**, como ya hicieron `caja-semaforo` y `caja-documento-suelto`, para que ese hueco no
se lea como «no solapa». **Medido:** `/__quotes` y `/__jobdetail` no las sirve ningún otro guard
(control positivo del grep: `/__panel` sí aparece, y sólo en este fichero).

## Ficheros

| fichero | qué |
|---|---|
| `scripts/_pagina-panel.mjs` | **+** `paginaDeVista`, con suelo de nodos. `paginaDeClientes` intacta |
| `scripts/guard-objetivo-tactil.mjs` | **+** las dos superficies, sus excepciones acotadas, la sonda y el suelo que reencuentra el censo |
| `docs/master/SCRUM-791.md` | **nuevo** · esta entrada |

# SCRUM-439 · censo de las cuatro ramas que Jira da por finalizadas — ¿está el PARCHE o está la FUNCIÓN?

**Medido contra:** `origin/main` = `6b333edd501f5eaa2f3276b026128010781c3d01` · 2026-08-10T17:59:32+01:00

**10-ago-2026** · sesión 1 · **CENSO: no se ha mergeado ninguna rama, no se ha tocado Jira, no se
ha arreglado nada de lo encontrado.**

## El veredicto, en una línea

**Las cuatro funciones ESTÁN en `main`.** Ninguna de las cuatro ramas hay que recuperarla, y
ninguna víctima está sufriendo hoy nada de esto. Lo que `git cherry` señalaba era exactamente lo
que el ticket sospechaba: **inequivalencia de parche, no ausencia de función.**

| # | ticket | cherry | tamaño de la rama | ¿está la FUNCIÓN? | por qué camino llegó |
|---|---|---|---|---|---|
| 459 | **SCRUM-284** submenús | `+1` | 13 fich · 928+/255− | ✅ **SÍ** | commit `6d8e0f04` *«SCRUM-284: Configuracion troceada en diez submenus, colocando desde el mapa»* |
| 480 | **SCRUM-368** texto grande | `+2` | 15 fich · 1923+/17− | ✅ **SÍ** | commit `3ceae556` *«SCRUM-368: contraste AA — --muted y el verde de TEXTO, y el guard en navegador»* |
| 545 | **SCRUM-405** descarga | `+1` | 6 fich · 373+/88− | ✅ **SÍ** | por su propia rama **`-rebasada`**, que `cherry` da **`+0`**: está entera en `main` |
| 486 | **SCRUM-381** sembradores | `+1` | 10 fich · 1154+/12− | ✅ **SÍ** | los cuatro ficheros del ticket están en `main` y sus tests corren |

> **La lección del ticket, confirmada:** `cherry` mide patch-id. En los cuatro casos el trabajo
> entró por **otro commit del mismo ticket** (rehecho o rebasado), así que el parche no coincide y
> la función está. **Un `+1` de `cherry` no es una funcionalidad que falte: es una pregunta.**

## Las cuatro preguntas, contestadas contra el producto

### 1 · SCRUM-284 — ¿existen hoy los diez submenús? **SÍ, y enumerados**

`public/dashboard/js/settingsSubmenus.js` los declara como conjunto cerrado:

```
empresa · facturacion · numeracion · cobro · avisos ·
publica · marca · datos · cumplimiento · equipo
```

Son **diez**, contados uno a uno y no por longitud. Y **cada uno lleva a algo**: los 45 tests de
`scrum284-*` en `main` lo afirman por tres caminos —*«ningún campo de Configuración se queda sin
sitio»*, *«ninguna asignación apunta a un submenú que no existe»* y *«ningún submenú se queda sin
campos salvo que esté declarado vacío»*—. Los rótulos están **aprobados** (5-ago-2026) y fijados
carácter a carácter.

### 2 · SCRUM-368 — ¿coinciden `.btn-primary` y `DESIGN.md`? **SÍ, y hay guard que los cruza**

`DESIGN.md:170` dice que la variante pequeña del primario **no usa el Verde Confianza** (con 12,5px
daría 3,30:1, por debajo de AA). Los tres tests de `scrum368-*` en `main` lo vigilan y están verdes:

* *«TRINQUETE: el fondo del btn-primary pequeño NO es el verde de marca»*
* *«el primario NORMAL y el grande siguen con el verde de marca»*
* *«el verde de marca sobre blanco sigue SIN cumplir AA — y está medido, no olvidado»*

No es que «parezca que coinciden»: hay un guard que cae si dejan de hacerlo.

### 3 · SCRUM-381 — ¿qué prometía, y está? **El actor `semilla`, y SÍ**

Prometía *«el actor `semilla`, y un sembrador que se niega a arrancar contra producción»*. En `main`
están `scripts/seed-demo.mjs`, `tests/scrum381-semilla.test.mjs`,
`tests/scrum381-scripts-cargables.test.mjs` y `docs/master/SCRUM-381.md`. Sus tests afirman
*«NINGÚN fichero de `src/` escribe el actor `semilla`»* y *«el valor EXISTE y solo lo escriben los
sembradores»*.

### 4 · SCRUM-405 — ¿está la descarga verificada del portal cautivo? **SÍ, y es su test literal**

`public/dashboard/js/api.js:67` — *«SCRUM-405 · LA ÚNICA FORMA DE DESCARGAR UN FICHERO»*. Y el test
que contesta la pregunta con sus mismas palabras:

> *«🔴 R1: un 200 con `text/html` (portal cautivo) NO produce descarga»* — verde en `main`.

Con su control positivo (*«las tres descargas legítimas siguen funcionando»*) y su guard de
población (*«NADIE llama a `.blob()` fuera de la forma común»*).

## Las siete ramas que nadie había medido — **las siete al día**

Mismo instrumento, `git cherry origin/main <rama>`:

| rama | commits sin equivalente |
|---|---|
| `scrum-388-censo-contra-main-rebasada` | **0** de 3 |
| `scrum-388-censo-contra-main-rebasada-2` | **0** de 4 |
| `scrum-388-censo-contra-main-rebasada-3` | **0** |
| `scrum-388-diagnostico-al-fallar` | **0** |
| `scrum-368-anillo-foco-primario-rebasada` | **0** |
| `scrum-368-contraste-texto-y-guard-rebasada` | **0** de 1 |
| `cola-370-377-380-368` | **0** |

Ninguna esconde trabajo. Las cuatro últimas no tienen siquiera diferencia de árbol con `main`.

## Y el censo COMPLETO del remoto, que nadie había pedido pero sale gratis

Pasado el mismo instrumento a **las 171 ramas del remoto**: **38 tienen algún commit sin
equivalente** y **133 no tienen nada pendiente**. Las de más volumen, aparte de las cuatro del
ticket: `scrum-205-206-sellado` (`+6`), `scrum-300-firmado-por` (`+5`),
`scrum-37b-agregacion-por-job` (`+5`), `scrum-215-destinatarios` (`+3`). **No se han abierto**:
quedan medidas y listadas para que la decisión sea del fundador.

⚠️ Y el mismo aviso que gobierna este ticket vale para ellas: **`+N` no significa función ausente.**
Cada una necesita su pregunta contra el producto antes de tocarla.

## 🔴 Lo que NO pude medir, declarado

**El banco de vistas no puede pintar `renderSettingsView`.** Al cargarla revienta en
`renderReferralCard` (`settingsView.js:1222`): `copyBtn` sale `null` porque el mini-DOM no resuelve
ese `getElementById`. **Es una limitación del banco, no un defecto del producto** — el propio
`_banco-vistas.mjs` documenta esa clase de falso hallazgo en su cabecera («las tres veces que este
banco dio rojo y el rojo era suyo»).

Así que el veredicto de los diez submenús **no está medido abriendo la pantalla en el banco**, sino
por el conjunto cerrado + los 45 tests que cruzan campos, asignaciones y submenús. Es una evidencia
fuerte, pero **no es la pantalla**, y se dice en vez de presentarla como si lo fuera.

## Lo que NO se ha hecho

**Ninguna rama mergeada.** Ningún ticket tocado en Jira. Nada de lo encontrado arreglado — incluido
el marcador de microcopy vivo de SCRUM-405, que se reporta y se deja.

## Instrumentos

`git cherry origin/main <rama>` (patch-id) · `git cat-file -e origin/main:<ruta>` (presencia real de
fichero en el remoto) · `node --test` sobre los tests de cada ticket en `main` ·
`tests/_banco-vistas.mjs` (intentado, con su límite declarado arriba).

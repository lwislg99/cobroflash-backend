# SCRUM-836 · ANCLA-QUE-SOBREVIVE: el meta-guard llevaba 7 días ciego, y su rojo no bloqueaba

**Fecha:** 15-sep-2026 · **Carril:** B (guard) · **Gate:** fase ① sin gate; fase ② PENDIENTE del fundador
**Medido contra:** `origin/main` = `47f9180fe84b03db4badac03eea05969cdcfb4f2` · 2026-09-15T10:35:49+01:00
**Tanda:** 6704 tests, 6594 pass, 0 fail, 110 skipped · 230 s · exit 0 — medida DESPUÉS del último cambio, con tope duro.

> **Una alarma que suena donde nadie está obligado a escucharla no es una alarma.**

## Lo que el ticket promete, ENTERO — y qué queda

| | promete | estado |
| --- | --- | --- |
| **①** | reparar el ancla de la mutación → `ciegas 0` | ✅ **hecho — pero por `faebb1e6` en `main`, no aquí: ver «la carrera»** |
| **②** | el meta-guard pasa a check **OBLIGATORIO**, y su rojo bloquea el auto-merge | 🔴 **NO ES CÓDIGO** — ver abajo |

Y lo que ya había en `main` con este número, medido antes de tocar nada — **ninguna de las dos
fases**:

* `836b` (PR #1216) — **sólo documentación**: 9 líneas de comentario en `pr-automatico.yml`
  explicando que el filtro `scrum-*` deja fuera las ramas `claude/pr-*`. No tocó mecanismo.
* `836c` (PRs #1218, #1219) — dos frases al canon de `docs/equipo/sesion-5.md`. Nada del meta-guard.

## El defecto

El 8-sep-2026 a las 09:24, `278a8bd7` (SCRUM-824b) partió en dos un `if` de
`scripts/_ritmo-de-despliegue.mjs`. **El cambio era correcto** — aquel `||` producía un rojo
intermitente en CI, que entrena a relanzar la tanda y es peor que un rojo fijo. Pero la mutación ③
de `scrum716` estaba anclada al texto exacto de esa línea, y el texto dejó de existir:

```
vivas 165 · mudas 0 · ciegas 1 · ficheros muertos 0
🔴 CIEGO: scrum716-ritmo-de-despliegue.test.mjs · el ancla no está en `scripts/_ritmo-de-despliegue.mjs`
```

## Lo que se midió

* **Desde cuándo**, datado con `git log -S` sobre el texto exacto del ancla y no deducido del
  ticket: nació en `935115cb` (7-sep 03:02) y murió en `278a8bd7` (8-sep 09:24). **Siete días.**
* **Qué entró mientras tanto:** **54 PRs y 218 commits** en `main`. Y **ninguno** tocó el fichero
  vigilado ni su guard, así que la ceguera **no se iba a curar sola**.
* **Cuánto se dejó de vigilar, acotado:** `ciegos` se apunta **por mutación**, dentro del bucle
  `for (const mut of mutaciones)`. Se perdió **1 de 167**; las otras cuatro de ese mismo guard
  siguieron ejerciéndose. El meta-guard **no aborta** ante una ciega: la descarta y sigue.
* **Y no estaba tapando un guard muerto:** tras reparar, la mutación sale **VIVA**, no muda — el
  test que debe caer ejercita `'1788742571305'`, `'no-soy-un-sha'`, `''`, `null`…

## 🔴 LA CARRERA: dos arreglos del mismo defecto, y el que gana NO es el mío

Mientras se trabajaba esto, **el ancla de `scrum716` se arregló también en `main`**, por otra vía.
Los hechos, datados, porque el orden es lo único que lo explica:

| | |
| --- | --- |
| `faebb1e6` · **9-sep 08:04Z** · `claude[bot]` | re-ancló DOS mutaciones caducadas (`scrum716` y `scrum738`). Es la ejecución automática que el propio ticket 836 cuenta en su origen. |
| **15-sep 09:14** | se mide `origin/main` = `319bbd99`. `faebb1e6` **NO es ancestro suyo**: el ancla estaba caducada de verdad, y la medición de este trabajo era correcta. |
| **15-sep, durante la tanda** | `main` avanza **103 commits** y `faebb1e6` entra por fin. |

**Por qué tardó seis días en entrar** y no es anécdota: ese commit vive en una rama
`claude/pr-1211-…`, y el filtro `scrum-*` de `pr-automatico.yml` **no le abre PR** — exactamente lo
que `836b` documentó el 9-sep. El aviso estaba escrito; lo que faltaba era que alguien lo mergease.

**Se resuelve el conflicto a favor de `main`**, y a propósito: su arreglo ya está mergeado, funciona
y tumba el guard igual. **Pisar trabajo ajeno ya integrado, para poner el propio, no es un criterio
técnico.** Lo que va en este PR es lo que no colisiona con nadie: la red que faltaba.

### La propuesta que SÍ queda escrita, sin aplicarse

El ancla que queda en `main` es `if (TODO_DIGITOS.test(s) && LONGITUDES_DE_RELOJ.has(s.length))
return null;`. Cumple su función **y conserva la fragilidad que causó esto**: está atada a la forma
de una línea de filtro, y un filtro es justo lo que se reescribe al afinarlo.

La alternativa que se construyó y se midió era anclar a **la identidad de `shaLegible`** —su
cabecera y su normalización, que son su contrato— insertando un `return s;` que corta la función
antes de cualquier filtro: sobrevive a que los filtros cambien, se añadan o se reordenen. Está
comprobada (ancla única, `node --check` sobre el fichero mutado, mutación VIVA). **No se aplica
aquí** porque hacerlo sería deshacer el arreglo de otro. Queda propuesta, no impuesta.

### La red que faltaba, y dónde faltaba

Lo que falló **no fue la detección**: el meta-guard lo dijo desde el minuto uno. Falló **quién lo
decía** — un job que tarda minutos y **no bloquea** el auto-merge, cuyo rojo se leía como
«6 of 7 checks passed». Por eso se añade `tests/scrum836-ancla-de-mutacion-viva.test.mjs`, que
comprueba **la mitad barata** —que el `de` de cada mutación exista hoy, byte a byte, en su
fichero— **sin mutar y sin correr tests**, dentro de `npm test`, que sí bloquea.

⚠️ **No sustituye al meta-guard y lo dice en su cabecera:** un ancla presente puede salir MUDA
igual, y eso sólo se sabe ejecutándola.

## 🔴 La fase ②: por qué NO se entrega, y qué hace falta

El auto-merge espera al **check obligatorio**, y esa lista vive en la **protección de rama de
GitHub** — no está versionada en el repositorio (no hay ruleset en `.github/`) y `gh` no está
instalado a propósito, porque el PR lo abre el fundador. **No es algo que una sesión pueda hacer
desde el código.**

Lo que hay que hacer, con el nombre exacto tal y como lo publica `ci.yml`:

> Settings → Branches (o Rulesets) → `main` → **Require status checks to pass** →
> añadir **`meta-guard · los guards caen cuando deben`**

Y su verificación, que el ticket exige y también es del fundador: provocar un PR con el meta-guard
en rojo y comprobar que **no se mergea**. Hay precedente de cómo hacerlo limpio, canonizado por
`836c` a partir de SCRUM-834: *un control que introduce un defecto a propósito se diseña por su
limpieza, no por su resultado* — rama borrada, PR cerrado **sin mergear**, y comprobado aparte que
ni el commit ni el fichero llegaron a `main`.

## 🔴 Lo que el guard nuevo cazó el día que nació — y no se lo inventó nadie

Nada más entrar en la tanda, con `main` recién mezclado, **acusó a otra mutación caducada que
llevaba mergeada desde hoy**:

```
scrum850-la-poblacion-del-instrumento.test.mjs → scripts/_invocaciones-de-la-tanda.mjs
    el ancla `de` no está en el fichero
```

**Y no había cambiado el código: había cambiado la SANGRÍA.** La declaración pedía SEIS espacios y
el fichero tiene CUATRO; el resto de la línea, idéntico byte a byte. Se reancla **sin la
indentación** —el texto sin margen aparece 1 sola vez en el fichero— porque anclar incluyendo el
margen es anclar a cómo está formateado hoy, que es lo primero que cambia. Cabía en el PR, es la
misma zona y ponía mi guard en rojo: las tres de la regla 37.

> Un caso cazado el primer día no prueba que el guard sea bueno, pero sí que el problema **no era
> de un solo sitio**. Eran dos, y el segundo nadie lo estaba mirando.

### ⚠️ HALLAZGO de otro carril, medido y NO arreglado (regla 9)

Las **tres** declaraciones de `scrum850` tienen además el `cae` caducado: **ninguno de los tres
nombres corresponde a un test suyo**, así que el meta-guard no puede medirlas ni con el `de` bien.
Medido con control, no supuesto — `paso()` sobre la pasada limpia de cada guard:

```
scrum716 · 7 declaraciones → paso(): true  ×7      ← control: así se ve una sana
scrum850 · 3 declaraciones → paso(): false ×3      ← las tres, inservibles
```

Arreglarlo exige decidir qué test debe tumbar cada mutación, y eso es diseño del guard ajeno. **Se
reporta con su medida y no se toca.**

## Verificado en rojo

⚠️ Los controles ① y ② se ejecutaron **antes** de que entrara `faebb1e6`, sobre el ancla por
identidad que este trabajo construyó. Quedan aquí porque son la medida que demuestra que el defecto
existía y que el meta-guard sabe distinguir las tres respuestas — no porque ese ancla vaya en el PR.

**① El meta-guard, pasada completa** (`npm run meta:mutaciones`, exit 0):

```
✔ scrum716-ritmo-de-despliegue.test.mjs · una lectura ilegible da NO SE SABE, no un veredicto a medias
vivas 167 · mudas 0 · ciegas 0 · ficheros muertos 0
```

Antes de tocar nada la misma pasada daba `vivas 165 · ciegas 1`. Y la mutación sale **VIVA**, no
muda: el guard sí caza el defecto que promete: no se estaba tapando un guard muerto.

**② El control positivo que exige el ticket**, con la función REAL del meta-guard (`aplicarUna`),
sin pagar otra pasada entera:

```
ANCLA NUEVA  → ✔ VIVA (el guard cae con la mutación)
ANCLA VIEJA  → ✔ CIEGO · el ancla no está en `scripts/_ritmo-de-despliegue.mjs`: la declaración caducó
```

Sabe volver a ponerse ciego: **no se ha apagado**.

**②bis · El ancla que SÍ queda** (la de `faebb1e6`), medida aparte con `aplicarUna`, porque adoptar
el arreglo de otro sin comprobarlo sería fiarse en vez de medir. Las **siete** declaraciones de
`scrum716` tumban su guard:

```
1..7  ✔ VIVA   (ninguna ciega, ninguna muda)
```

**③ El guard nuevo, roto a propósito sobre el árbol real** (ancla devuelta a la forma caducada):

```
not ok 5 - SCRUM-836 · 🔴 NINGUNA mutación declarada tiene el ancla caducada
    scrum716-ritmo-de-despliegue.test.mjs → scripts/_ritmo-de-despliegue.mjs
        el ancla `de` no está en el fichero
# pass 4 · fail 1
RESTAURADO byte a byte: ✅ idéntico
```

## Lo que NO cubre

* **La fase ② no está hecha**, y hasta que lo esté **este mismo arreglo puede volver a caducar sin
  que nadie lo pare**: el rojo seguirá sin bloquear. Es la mitad que más protege del ticket.
* El guard nuevo cubre **el ancla ausente**, no la mutación muda ni el fichero muerto. Eso sigue
  siendo trabajo de `meta:mutaciones`, que se ejecuta y cuesta minutos.
* **No se toca `RE_ANCLA` de nadie, ni se relaja ningún guard, ni se apaga ninguna mutación** — las
  tres cosas que el ticket prohíbe expresamente.

## Ficheros

* `tests/scrum850-la-poblacion-del-instrumento.test.mjs` — el ancla reanclada SIN la sangría.
* `tests/scrum836-ancla-de-mutacion-viva.test.mjs` — la red en la tanda que sí bloquea.

---

# APÉNDICE · 15-sep-2026 · SCRUM-836d · El otro extremo de la declaración: el `cae` caducado

**Fecha:** 15-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `5e0817eb093154075575efdc899f4c55419207ef` · 2026-09-15T15:44:12+01:00
**Tanda:** 6725 tests, 6615 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 806 ficheros · 260 s · exit 0 — con tope duro, medida DESPUÉS del último cambio.

> **Una mutación que nombra un test que no existe afirma una cobertura que no hay.**

## El defecto, y por qué es la otra mitad del mismo

Una declaración tiene DOS extremos y los dos caducan. La entrega anterior cerró el `de` —el texto
anclado en el fichero que se muta—. Queda el `cae`: el nombre del test que la mutación debe tumbar.
Si ese test se renombra, o nunca existió, `meta:mutaciones` **no puede medir la mutación** y sale
CIEGO exactamente igual — sólo que el guard sigue pareciendo cubierto.

Se reportó como hallazgo de otro carril y **el fundador mandó cerrarlo**: se decide midiendo.

## Los DOS censos, con su población

**Población: 178 mutaciones declaradas en 58 guards.**

| pregunta | qué mide | fallan |
| --- | --- | --- |
| **(a)** ¿EXISTE el test que el `cae` nombra? | barato, por AST, sin ejecutar nada | **4** |
| **(b)** ¿CAE de verdad al aplicar la mutación? | caro: aplicar y correr el guard | **0** ⟵ *ver abajo* |

Las 4 de (a): **3 de `scrum850`** y **1 de `scrum850b`**, las dos mergeadas ese mismo día.

🔴 **Y (b) da 0 sobre esas mismas 4, que es el dato que cambia el diagnóstico:** no eran mutaciones
sin cobertura. **Las cuatro tumbaban tests de verdad.** Sólo el nombre estaba mal — que es
precisamente lo que hace este defecto difícil de ver: el fichero parece cubierto y lo está; lo que
no funciona es el mecanismo que lo comprueba.

### ⚠️ 2 NO EVALUABLES, declaradas y NO acusadas

`scrum785` construye los nombres de sus tests (`` test(`SCRUM-785 · 🔴 ${quien}: …`) ``) y sus dos
declaraciones **son correctas**. El lector por AST no puede resolver una plantilla, y **no poder
leer algo no es prueba de que esté mal**: van en su propio cubo. Contarlas como huérfanas sería
acusar a quien no hizo nada mal — el defecto que SCRUM-757 cerró para el otro lector.

## Cómo se decidió cada `cae` — midiendo, no adivinando

Se aplicó cada mutación y se miró **qué caía**. Con dos cautelas, las dos del encargo:

* **¿ENTRÓ la mutación?** Se comprueba que el fichero CAMBIA tras el `replace`. Una mutación que no
  entra y una cobertura que no existe dan exactamente la misma salida.
* **Restauración byte a byte** contra los bytes de DISCO en `finally`, verificada con
  `Buffer.compare` (SCRUM-570 / SCRUM-808).

| declaración | qué cayó al aplicarla | `cae` nuevo |
| --- | --- | --- |
| `scrum850` · tubería | 2 tests | `el detector ve cada forma que se come el código` |
| `scrum850` · `//comentarios` | 2 tests | `ninguna invocación de la tanda descarta su código de salida` |
| `scrum850` · comentario `#` | 1 test | `el último tramo y los comentarios NO se marcan` |
| `scrum850b` · `&` | 1 test | `el censo VE el \`&\` — era el hueco` |

**Ninguna se rellenó con un nombre plausible.** Si alguna no hubiera tumbado nada, el hallazgo
habría sido que esa mutación no está cubierta, y se habría dicho.

**Confirmado por el camino caro**, que es el que decide: con `aplicarUna` del meta-guard, las cuatro
pasan de **CIEGAS a VIVAS**.

## 🔴 Lo que este guard NO mira, y va escrito en su cabecera

Sólo contesta **(a)**. La **(b)** exige aplicar cada mutación y correr su guard entero — es lo que
hace `meta:mutaciones`, cuesta minutos y vive en su propio job; duplicarlo aquí convertiría
`npm test` en el meta-guard.

Es una **criba barata, no un veredicto de cobertura**. Se dice porque *un instrumento que no declara
lo que no mira se lee como si lo mirara todo*, y eso convierte una criba en una falsa garantía.

Y el criterio de comparación es **el del meta-guard, no uno propio**: `paso()` usa `includes`, así
que al `cae` le basta ser **subcadena** del nombre de un test. Comparar por igualdad denunciaría
declaraciones que el meta-guard acepta — un guard que contradice al que vigila.

## Verificado en rojo

* 🔴 **EL QUE DECIDE** · un `cae` que nombra un test inexistente **cae**, nombrando fichero y
  declaración, y **acusa a la huérfana, no a la sana** que tiene al lado.
* 🔴 **MUTACIÓN** · con la comprobación apagada, el mismo banco **no acusa a nadie**: el verde falso
  vuelve. El rojo depende de la comprobación y no de otra cosa.
* ✅ **POSITIVO** · las declaraciones sanas siguen pasando, y **basta con UN test** y con una
  subcadena. Si exigiera que cada mutación tumbase varios, se volvería inservible y lo relajarían.
* ⚠️ **NO EVALUABLE** · un guard con nombres construidos no se acusa **y tampoco se calla**: queda
  declarado aparte.
* **SUELO** · el censo exige ≥54 declaraciones (el suelo del propio meta-guard) antes de dar
  veredicto. Cero huérfanas sobre cero declaraciones es ceguera, no salud.

## Lo que NO cubre

* **(b) sigue sin estar en la tanda**, a propósito y con su motivo. Un `cae` vivo no prueba que el
  test caiga.
* **No se toca `scrum785`**: sus declaraciones son correctas y el problema es del lector.
* La **fase ②** del ticket (el meta-guard como check obligatorio) **sigue en la mesa del fundador**,
  intacta. Y la propuesta de anclar `scrum716` por identidad sigue **propuesta, no aplicada**.

## Ficheros

* `tests/scrum836-ancla-de-mutacion-viva.test.mjs` — `nombresDeTest` y `caesHuerfanos`, con sus
  cinco controles.
* `tests/scrum850-la-poblacion-del-instrumento.test.mjs` — los tres `cae`, medidos.
* `tests/scrum850b-las-formas-que-mienten.test.mjs` — el cuarto.

---

# SCRUM-836e · La línea de FORMATO de `shaLegible`, vigilada otra vez: la ③b de `scrum716`

**Medido contra:** `origin/main` = `38fc6815b7678650c1e96995500b72a8b5705c7c` · 2026-09-15T15:09:33Z
**Rama:** `scrum-836e-la-linea-de-formato` · **Carril:** `tests/` (Sesión 3) · **Decisión:** del orquestador, 15-sep-2026, opción (b)

> Re-anclar por UNA de las dos líneas en que se partió un filtro cura el ciego y deja la otra sin
> nadie que la tumbe. El meta-guard no puede verlo: no hay ancla caducada que acusar, hay una
> ausencia.

⏱ Las horas de esta sección son **de GitHub**: el reloj de esta máquina va 334 s adelantado
(medido el 15-sep-2026 contra la cabecera `Date:` de la API).

## 0 · Por qué `836e`

El encargo decía `scrum-836b-<slug>`. Los sufijos, medidos contra los PR en cualquier estado el
15-sep-2026:

| sufijo | de quién |
|---|---|
| `836b` | `scrum-836b-filtro-de-rama-escrito` — PR #1216 |
| `836c` | `scrum-836c-canon-sesion-5` — PR #1218 y #1219 |
| `836d` | `scrum-836d-el-cae-caducado` — PR #1294, el apéndice de **justo encima** |

Los tres están citados en este mismo fichero. `836d` estaba **libre** cuando se comprobó por primera
vez: el #1294 se abrió a las 14:52Z del 15-sep-2026, con esta rama todavía en local. Por eso se
volvió a mirar antes de empujar, y por eso `836e`.

## 1 · El hueco, con el lector oficial del meta-guard

| | `origin/main` | esta rama |
|---|---|---|
| declaraciones legibles de `scrum716` | 7 | **8** |
| cojas | 0 | 0 |
| declaraciones que apagan la línea del **reloj** | 1 | 1 — la ③ de main, intacta byte a byte |
| declaraciones que apagan la línea de **formato** (`if (!ES_SHA.test(s)) return null;`) | **0** | **1** — la ③b |

Antes de SCRUM-824b el ancla de la ③ apagaba el filtro **entero**. `faebb1e6` la re-ancló sólo por
el reloj, y su propio comentario lo dice: «no el filtro de formato (`ES_SHA`) que sigue vivo». Vivo
en el código y **sin vigilar**. El «②bis» de la primera entrada —las siete declaraciones de
`scrum716` tumban su guard— es cierto y lo sigue siendo: lo que faltaba era la octava.

La propuesta de anclar a la identidad de `shaLegible` cubriría las dos líneas a la vez. La ③b no la
impide: si algún día se adopta, la ③ y la ③b se funden en ella.

## 2 · EN ROJO, y la entrada que lo tumba

Con la mutación puesta, contra el test que declara («una lectura ilegible da NO SE SABE, no un
veredicto a medias»), anotando **con qué entrada** cae:

| mutación | ¿cae? | entrada que lo tumba |
|---|---|---|
| **③b** · formato → `if (false) return null;` | 🔴 **VIVA** | `""` — la cadena vacía |
| ③ de main · reloj (control) | 🔴 VIVA | `1788742571305` — el epoch de `env.ts` |

Pasada limpia antes y después: 17/17. Fichero restaurado y verificado **byte a byte**, con copia de
los bytes fuera del worktree y sin `git stash` (A15).

**La entrada es lo que prueba que la ③b mira SU línea.** Si cayera por el epoch, estaría repitiendo
el rojo de la ③. Medido **tres veces**, una por cada `main` mezclado (`8b9b0d9b`, `f5720e41`,
`38fc6815`), y la última sobre el árbol final: el mismo resultado las tres.

## 3 · Verificación

| | |
|---|---|
| lector oficial | 7 → **8** declaraciones, 0 cojas, el ancla de la ③b presente **una** vez |
| `scrum716` · `745` · `753` · `737` · `810b` · `836` · `267` · `711` · `850` · `850b` | **109/109** |
| `guards:entrada` | **22/22** |
| `meta-guard --solo-censo` | 58 guards · **179** declaraciones |
| **meta-guard entero** · base `f5720e41` | **`vivas 175 · mudas 0 · ciegas 4 · ficheros muertos 0`** — la ③ y la ③b, las dos **VIVAS** · 16:44:30 → 17:02:07 |
| tanda completa | **6748 tests · 6638 pass · 0 fail · 0 cancelled** · 110 skipped, aparte · 231 s · exit 0 — con esta sección ya dentro · 15:10:17Z → 15:14:29Z |

**El número se predijo antes de correrlo**, y por eso vale como control: CI sobre `f5720e41` (run
`34982320622`) dio `vivas 174 · mudas 0 · ciegas 4`, 178 declaraciones, y la rama añade una. Salió
exactamente `vivas 175 · mudas 0 · ciegas 4`, y los cuatro ciegos eran **los mismos** de `main`.

## 4 · Los 4 ciegos de esa pasada ya no están en `main`

Eran `scrum850` ×3 y `scrum850b` ×1, y el orquestador los dejó en el carril de Javier. **Los cerró
el #1294** (el apéndice de encima) corrigiendo sus `cae`, y entró en `main` mientras la pasada local
corría. Esta rama no los ha tocado.

No se repitió la pasada entera sobre `38fc6815`, y se dice: **la población no ha cambiado** —179
declaraciones en los dos árboles, medido con `--solo-censo`— y lo único que cambió en ellas son esos
cuatro `cae`. Lo que se espera del job del meta-guard en el PR es, por tanto,
**`vivas 179 · mudas 0 · ciegas 0`**. Un número distinto diría que algo no es lo que se cree.

## 5 · La historia de la rama, sin reescribir nada empujado

La rama nació como `scrum-836-el-ancla-de-scrum716`, partiendo la ③ en ③a + ③b. Antes de empujarla
entró en `main` el #1212 con `faebb1e6`, que es la ③a. Decisión (b): **merge** de `main` dentro
—nunca rebase—, quedándose con la ③ de main y añadiendo sólo la ③b.

Se renombró **dos veces** antes de su primer push (`836b` → `836d` → `836e`), y su historia local se
rehízo con `git commit-tree` para que ningún commit llevara un sufijo ajeno: **mismos padres**, y
árboles que sólo difieren en la etiqueta del comentario de la ③b, comprobado commit a commit. Nada
de eso había llegado al remoto.

## ⛔ No tocado

`scripts/_ritmo-de-despliegue.mjs` · `scripts/meta-guard-mutaciones.mjs` · la ③ de main (idéntica
byte a byte) y las otras seis declaraciones de `scrum716` · `scrum850` y `scrum850b` · ninguna rama
`claude/*` · ningún stash.

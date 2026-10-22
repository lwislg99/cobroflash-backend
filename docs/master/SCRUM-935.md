# SCRUM-935 · EL TECHO DEL META-GUARD: el CI de `main` no se cancelaba, se le acababa el tiempo

**Fecha:** 20-sep-2026 · **Carril:** Sesión 5 (automatización) · **Gate:** sin gate
**Medido contra:** `origin/main` = `cd0739d3bf36952e4c379fa306cf4eef6964bfce` · 2026-09-20T14:31:34+00:00
**Tanda:** 7.735 tests · **7.621 pass · 3 fail · 111 skipped** — los 3 son de `scrum939b` (skills),
ajenos a esta rama: la tanda de SCRUM-954, anterior a ella, ya traía esos mismos 3. Hubo un 4.º en
la primera pasada, mío, y está contado abajo. **No he vuelto a medirlos sobre un árbol limpio**:
me apoyo en la tanda de 954 y lo digo en vez de afirmarlo.

## El defecto

El enunciado del ticket (17-sep) decía que el CI de `main` se cancelaba el 86 % de las veces y
señalaba a `concurrency.cancel-in-progress`. **La primera mitad es cierta; la causa, sólo en
parte.** Medido hoy: el job que muere es SIEMPRE el mismo —`meta-guard · los guards caen cuando
deben`— y muere a los 10 min 14-15 s contra su `timeout-minutes: 10`.

Y la forma en que muere es la que envenena todo lo demás: **un timeout de job GitHub lo reporta
como `cancelled`, no como `failure`**. El run entero queda «cancelado», que es justo la palabra
que hace pensar en la concurrencia. Dos causas distintas con el mismo síntoma.

    🔒 Dos causas que dejan la misma palabra en el tablero se cuentan juntas hasta que alguien
       separa la población.

## Lo que se midió

**POBLACIÓN declarada:** 100 runs de `ci.yml`, **97** con el job `meta-guard` medible, ventana
**17-sep 21:09:10Z → 20-sep 14:03:43Z** (64,9 h). 34 logs de job descargados, **0 ciegos**.
Instrumentos y salidas completas en `docs/master/evidencias/scrum935/`.

### 1 · La muestra estaba CENSURADA por el propio techo

De las 97 pasadas, sólo **14 llegaron al final** (8:03 … 9:57, la peor a **3 segundos** del
techo). Las otras **58 murieron EN el techo**. Sacar «cuánto tarda» de las 14 supervivientes da
una media que no existe: es exactamente el sesgo de medir a los que pasaron el corte.

    🔒 Un techo no sólo corta el trabajo: corta la medición, y lo que queda parece que cabe.

Los 58 se des-censuraron con el **perfil real de una pasada completa**. Se puede porque el log
imprime **una línea por mutación con su hora**, así que de cada pasada muerta se sabe en qué
punto exacto del trabajo la mataron. Se cruza por NOMBRE de mutación (no por posición) contra el
perfil acumulado de una pasada de 307 mutaciones, y sale lo que habría durado:

| | duración del job |
|---|---|
| mínimo | 8:03 |
| p50 | **11:06** |
| p75 | 12:38 |
| p90 | 12:40 |
| p95 | 13:06 |
| máximo | **14:16** |

**20 de 34 por encima de los 10 min.** No es que rozara el techo: la mitad ya vivía al otro lado.

⚠️ Y una corrección propia: la primera proyección fue **lineal** (segundos por mutación × total) y
daba p50 13:14. Está mal y sobrestima, porque **el coste por mutación no es uniforme**: las
últimas del recorrido (`scrum951d`, `utils`, `vigia-atascados`) cuestan 0,3 s y las del medio 2-3
s. La proyección por perfil corrige eso. Las dos salidas se guardan, la mala también
(`salida-2-descensura-lineal.txt`), porque la diferencia entre 13:14 y 11:06 es el error que
habría entrado en el expediente si nadie mira la forma de la curva.

### 2 · Por qué un techo fijo se vuelve a cruzar solo

La duración del job es **N mutaciones × 1,6-2,5 s**, y las dos mitades se mueven:

* **N crece.** 275 declaradas el 17-sep → **307** el 18-sep. Cada guard nuevo que declara su
  mutación le suma ~2 s a TODOS los PR, para siempre. SCRUM-954 dejó tres a propósito.
* **El runner varía.** Con la MISMA N, el runner más lento medido tarda un **60 %** más que el
  más rápido.

Por eso el presupuesto no se pone «en lo que tarda»: se pone donde quepan las dos cosas.

### 3 · Lo que subir el techo NO arregla

De las 83 cancelaciones, **58 son el techo y 25 son la concurrencia**. Repartido por evento —y
esto es lo que corrige al enunciado del ticket—:

| evento | n | el techo explica | legibles hoy | legibles al quitar el techo |
|---|---|---|---|---|
| `pull_request` | 53 | **91 %** de las cancelaciones | 13 % | **92 %** |
| `push` a `main` | 44 | **43 %** | 16 % | **52 %** |

**El meta-guard de los PR llevaba semanas sin poder leerse (13 %).** La puerta que todo el mundo
cree tener abierta en cada PR estaba, de hecho, cerrada.

En `main` la otra mitad sigue siendo el `cancel-in-progress` del propio ticket, **que aquí no se
toca**: es una decisión de coste del fundador y el ticket la deja reservada a él.

    🔴 Que nadie lea «935 hecho» como «main ya no se cancela». En main pasa del 16 % al 52 %.

### 4 · El coste, que era la pregunta del fundador

Preguntado: si dejamos que 58 pasadas más lleguen al final, ¿cuántos minutos de runner al mes, y
se pagan?

* **Máquina:** +2 min facturables por run afectado (hoy el job muere a 615 s → 11 min facturados;
  con presupuesto llegaría a ~730 s → 13 min). Al ritmo de merges de esta ventana, **≈ +1.290
  min/mes**.
* **Dinero: CERO, y medido, no supuesto.** `GET /actions/runs/<id>/timing` devuelve
  `billable.UBUNTU.total_ms = 0` en **los 97 runs** (la respuesta cruda de uno, en
  `timing-crudo-de-un-run.json`). El repositorio es **PÚBLICO** (`gh repo view` → `visibility:
  PUBLIC`) y **todos los jobs de todos los workflows usan `runs-on: ubuntu-latest`**, el runner
  estándar, que en repositorio público no se factura.
* Lo que sí cuesta de verdad es **espera**: los checks de un PR tardarán ~2 min más en concluir, y
  el auto-merge espera a que concluyan.

## La decisión, y por qué

**`timeout-minutes: 10` → `30`** en el job `meta-mutaciones`. Aprobada por el orquestador con la
medición delante.

Por qué 30 y no 15: 15 es 1,05× el máximo medido hoy (14:16) y, al ritmo al que crece N, se
volvería a cruzar en semanas — sería repetir este ticket. 30 es **2,1×** el máximo de hoy, deja
sitio al crecimiento, y no es un número raro en este fichero: el job `trinquete-zona`, en el
mismo workflow, ya tiene 45.

### ⚠️ SUBIR EL TIEMPO NO HACE EL TRABAJO MÁS RÁPIDO

Es presupuesto, no mejora. **El día que este job vuelva a acercarse a los 30 min, lo que toca es
MEDIR** —qué mutación se ha vuelto cara, si hay que repartir el job en dos, si alguna declaración
sobra— **no regalar otro minuto.** Un techo que se sube cada vez que se toca es un techo que no
existe.

Y eso **no se queda escrito aquí y ya**, porque escrito en un expediente es una frase:

    🔒 «Si vuelve a acercarse al techo, hay algo que medir» escrito sólo en el expediente es una
       frase, no un mecanismo. Una prohibición sin mecanismo es una frase (A10).

Se añade un paso **`if: always()`** al final del job que:

* deja **SIEMPRE** en el resumen del job cuánto tardó y qué porcentaje del presupuesto gastó —para
  que la próxima medición de esta serie no tenga que bajarse 34 logs para saberlo;
* **AVISA** (`::warning` de Actions) al pasar de **20 min**, o sea 2/3 del presupuesto y bastante
  por encima del máximo de hoy, con el texto de que eso no se arregla subiendo el techo;
* si no llega a haber marca de arranque, **dice «NO PUDE MIRAR»** en vez de callar (suelo: un cero
  silencioso se lee igual que un verde);
* **avisa, no veta.** Un veto por lentitud sería inestable —el mismo árbol tarda un 60 % más en un
  runner lento— y un guard que cae por sorteo enseña a desconfiar de los rojos (canon de
  `sesion-5.md`). El escalón de «un aviso que nadie mira» es SCRUM-963, no éste.

La marca de arranque se toma en un paso **anterior** y no dentro del paso de las mutaciones: si
`meta:mutaciones` falla, ese paso no llega a escribir nada, y es justo entonces cuando interesa
saber cuánto llevaba. Una medición que sólo existe cuando todo va bien no mide nada.

## Verificado en rojo

El aviso no se leyó: **se ejercitó**, con el `run:` extraído del propio `ci.yml` y corrido en
bash, en tres casos (`salida-6-aviso-tres-casos.txt`, `probar-aviso.sh`):

| caso | montaje | esperado | medido |
|---|---|---|---|
| **positivo** | `META_INICIO` a 1.300 s (>1.200) | avisa | avisa (1 `::warning`) · resumen al 72 % |
| **negativo** | `META_INICIO` a 100 s | NO avisa | 0 avisos · resumen al 5 % |
| **suelo** | sin `META_INICIO` | «no pude mirar» | lo dice, en stdout y en el resumen |

Más `bash -n` sobre **los 5** pasos con `run:` del job: 0 rotos.

⚠️ **Segundo error propio: la tanda me cazó a mí.** La primera pasada completa salió 7.735 · 7.620
pass · **4 fail** · 111 skip. Tres son los de `scrum939b`, ajenos y conocidos. El cuarto era mío:
`SCRUM-533 · los ficheros que TOCA ESTA RAMA no llevan ni un CR en disco` (en
`tests/scrum480-fin-de-linea.test.mjs`), con **8 de mis ficheros de evidencia en CRLF**. La causa
está escrita en las trampas del puesto y la pisé igual: **la redirección `>` de PowerShell escribe
CRLF**, y siete de esas salidas se capturaron así. Arreglado pasándolos a LF con node y
**contando** los CR después (0 de 0), no releyéndolos. Ni se tocó `.gitattributes` ni se añadió
excepción: eso sería apagar la alarma justo cuando suena por algo que he hecho yo.

⚠️ **Primer error propio, y lo cazó el control, no yo.** La primera pasada dio el caso «suelo» en rojo
sobre un paso sano: mi aserción buscaba «NO PUDE MIRAR» en **stdout**, y ahí va el `::warning`
con otra grafía mientras la frase va al **resumen del job**. No era un hallazgo, era la aserción
mirando otro sitio. Queda escrito en el propio banco.

## Lo que NO cubre

* **No valida el YAML.** En esta máquina no hay parser (ni `js-yaml` ni `yaml` en `node_modules`,
  ni `pyyaml` en Python 3.13). `verificar-ci.mjs` lee por líneas e indentación y lo declara. La
  validación de verdad la da **GitHub por efecto**: si el fichero no parsea, el workflow no
  arranca y el PR se queda sin checks — y eso se mira al empujar.
* **No arregla `main`.** Ver §3: en `main` la mitad de las cancelaciones siguen siendo la
  concurrencia, reservada al fundador.
* **No hace el job más rápido.** Ver arriba, dos veces.
* **La proyección es una proyección.** Asume que una pasada cortada habría seguido el mismo perfil
  relativo que una completa. Las pasadas del 17-18 sep tenían 275-301 mutaciones y la referencia
  307, así que su orden no es idéntico; por eso se cruza por nombre y no por posición. La cifra
  que **no** es proyección es ésta: 58 de 97 pasaron de 600 s, y eso está medido, no estimado.
* **No se subieron los logs crudos** de Actions: llevan secuencias de escape (medido: 8 bytes de
  control en uno solo) y A22 los prohíbe en el árbol. Va el **perfil derivado en TSV**, que es lo
  que usa la des-censura, con 0 bytes de control como todo lo demás de la carpeta.

## Ficheros

* `.github/workflows/ci.yml` — `timeout-minutes: 10` → `30` en `meta-mutaciones`, con la medición
  en el comentario; paso nuevo de marca de arranque; paso nuevo `if: always()` que mide y avisa; y
  se corrige el comentario «tarda unos segundos (medido: 4 s con las dos mutaciones declaradas
  hoy)», que era verdad el día que se escribió y hoy erraba por dos órdenes de magnitud.
* `docs/master/evidencias/scrum935/` — los siete instrumentos, sus salidas con población y `EXIT=`,
  los datos de los 97 runs, los dos perfiles en TSV y el `/timing` crudo que demuestra el 0.

## SCRUM-935b · el CI de `main` deja de cancelarse (opción B, decisión 16227)

21-sep-2026 17:28Z (GitHub) · medido sobre `origin/main` `b6cde0517649d991a1b08eabb50017a81a03acfb` · S5 (`s5-21h`).

**Qué:** `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` en `ci.yml`. Las ramas de PR siguen igual; `main` deja de matar el run en curso. GitHub sigue sustituyendo al run PENDIENTE (comentario 16149, punto 3): se esperan ~21 veredictos de 38, no 38 de 38. Coste en dinero 0; tiempo de main +11-34 % (modelo de 16149).

**Rojo → arreglo → positivo → negativo**
* ROJO (`56c73bef9623d4d1e43d99f9b5288d404b5daeeb`, guard solo): `tests/scrum935b-main-no-cancela.test.mjs` sobre `ci.yml` sin tocar → 4 pass · 1 fail (el de `main`).
* ARREGLO (`d307605d4a3891c672f9e34edd2b2ab33b10ef9f`): 5 pass · 0 fail.
* POSITIVO (PR sigue cancelando), con inyección aplicada (`git diff --numstat` = 1/1 en cada una): `cancel-in-progress: false` → cae el test de PR; `group: ci-${{ github.sha }}` → cae el mismo. Revertido con `git restore --source=HEAD`, `git status --porcelain` vacío, 5/5 otra vez. Vuelta a `true` → cae el ROJO.
* NEGATIVO (qué comprueba el CI y cuánto dura): quitando comentarios, `ci.yml` antes y después tiene 257 líneas y **la única diferencia es la de `cancel-in-progress`**. Ni un job, paso, `timeout-minutes` ni evento tocado.

**El guard evalúa, no busca texto:** resuelve la expresión para los dos únicos refs en los que corre el CI (`refs/heads/main`, `refs/pull/N/merge`), y una forma que no sabe evaluar lanza (no da verde). Población fijada: `pull_request` y `push` solo a `[main]`. Control de instrumento: el valor viejo (`true`) evaluado da «cancela en main».

**Cómo se mide el efecto tras el merge (no se da por hecho):** en las horas siguientes, `gh run list --workflow ci.yml --event push --branch main` y contar `cancelled`. Esperado: los `cancelled` que queden son pendientes sustituidos (sin `startedAt`), no runs con jobs a medias. Si siguen muriendo runs con jobs en curso, la línea no surtió efecto.

**Ficheros:** `.github/workflows/ci.yml` (la línea y dos comentarios), `tests/scrum935b-main-no-cancela.test.mjs`, este apartado.

## SCRUM-935c · por qué el meta-guard vuelve al techo: medición y propuesta (no construida)

**Medido contra:** `origin/main` = `c47288f7e82fb9dea4473f71e161a3836ac788f3` · 2026-10-21T14:31:09Z
J6 (`jv-j6t`, equipo de Javier) · **sólo mide y propone**: `scripts/meta-guard-mutaciones.mjs` es de S3,
`tests/scrum813-trinquete-de-zona.test.mjs` y SCRUM-1494 son de S5, y `ci.yml` es de S5 y del fundador.
Aquí no se toca ninguno. Jira no conectó en toda la sesión (`CONNECT_TIMEOUT` del MCP): el ticket NO se leyó.

**El encargo:** el job meta-guard del run 39610056116 (PR #2640) dijo «1508 s · 83 % del presupuesto».
Medido: **el 83 % es un superviviente.** Desde el 16-oct el job **muere en el techo de 30 min**.

### 1 · La serie (población declarada)

`muestrear-runs.mjs`: de cada día entre el 20-sep y el 21-oct, 4 runs de `ci.yml` repartidos en la lista
del día (la API da 100 por página: en los días con más de 100, la muestra sale de los 100 más recientes)
y, de 2 de ellos, el log entero. **104 runs**: 46 logs COMPLETOS, 20 jobs `cancelled`, 19 sin el job
(saltado), 19 sin log bajado. Los 6 días sin runs (3-5 y 10-12 oct) los da así la API: no lo crucé.
Controles del analizador, sembrados (`salida-controles-sembrados.tsv`): un log cortado sale CORTADO, uno
vacío sale CIEGO, uno con una línea de resultado de más sale NO-CASA y el real sale COMPLETO. En los 46,
las líneas de resultado suman exactamente `vivas + mudas + ciegas + muertos`.

| fecha | N (mutaciones) | fase de mutación | s/mutación |
|---|---|---|---|
| 20-sep | 310 | 577-698 s | 1,86-2,25 |
| 1-oct | 418 | 1.146 s | 2,74 |
| 6-oct | 510 | 1.337 s | 2,62 |
| 14-oct | 589 | 1.602 s | 2,72 |
| 15-oct | 593 | 1.634 s | 2,76 |
| 19-oct | 615 | 1.732 s | 2,82 |
| 21-oct | 622 | 1.646 s | 2,65 |

* **N se ha duplicado en 31 días** (310 → 622, unas 10 mutaciones al día). El coste por mutación del
  runner va de 1,8 a 2,8 s, sin tendencia: es el sorteo del runner, que ya midió el tramo de arriba.
* 🔴 **En el techo:** 7 jobs `cancelled` con el paso a 1.769-1.779 s, **todos desde el 16-oct** (3 el
  16, 2 el 18, 2 el 20: dos de ellos son `push` a `main`). Desde el 16-oct, de los 14 jobs muestreados que
  llegaron al final o al techo, **7 murieron en el techo**. Un job cortado no llega a su resumen: es
  CIEGO, no lento. jv-j3u midió lo mismo sobre otra población (1.029 runs, 128 cortes; PR #2648): mi
  muestra lo confirma por separado, y no copio su cifra.

### 2 · Coste por guard y desde qué commit

El instrumento corre los guards **en serie**: una pasada limpia del fichero y otra **del fichero entero
por cada mutación**, y cada resultado sale en el log con su hora. Así que el coste de un guard es
`(mutaciones + 1) × lo que tarda en cargarse y correr su fichero` (`analizar.mjs` → `guards-<run>.tsv`).

Último log completo (run 39605052252, 21-oct, 622 mutaciones, 162 guards, 1.646 s): **los 10 guards más
caros suman 761 s (el 46 %)**, y `scrum813-trinquete-de-zona` sola **286 s (el 17 %)**.

Descomposición 20-sep → 21-oct (`salida-comparar-20sep-21oct.txt`, normalizada por el runner con la
mediana de 49 guards que no cambiaron): base 691 s **+ 639 s de 69 guards nuevos** (279 mutaciones)
**+ 286 s de que la MISMA mutación tarde más** + 31 s de mutaciones nuevas en guards viejos = 1.646 s
(cuadra con lo medido).

**Los 286 s son casi enteros de UN commit.** `scrum813` costaba unos 45 s (22 mutaciones a ~2 s) hasta el
15-oct y **~285 s (26 a ~11 s)** desde el 17-oct. Entre medias entró el merge de #2486
(`574e538065dd51f45cfdca078b3787d7f32fbb5a`, 16-oct 11:18:48Z, SCRUM-1494c «el hijo de zona corta por
test y por pared»). Ese PR añadió un banco sembrado de cuelgues con una pared de 4 s y su repesca, **y lo
corre en el nivel superior del módulo**: se paga en CADA carga del fichero, y el meta-guard lo carga 27
veces. **A/B en local, 3 pasadas por lado** (`salida-ab-813-y-carga.txt`): 1,84-1,91 s antes del merge,
11,44-11,62 s después. Un patrón de nombre que no casa con ningún test sigue tardando 11,2 s: el coste
está en la carga, no en los tests.

**Los otros siete caros siguen otro patrón** (`salida-cae-vs-lento.txt`). Cargan en 0,07-0,4 s, y casi
todo su tiempo es UN test lento (el 83-97 % del fichero: comandos reales, esperas). **23 de sus 25
mutaciones declaran como `cae` otro test que tarda ≤ 2,6 s**, pero cada una paga el fichero entero:
`scrum976` (6 × 16 s), `scrum710b` (5 × 16 s), `scrum853c`, `scrum775`, `scrum1007-1011-1026`, `scrum858b`
y `scrum959b`. Sólo la 3.ª de `scrum858b` (8,7 s) y la 2.ª de `scrum775` (4,8 s) apuntan a su test lento.

### 3 · Propuesta (para S3 y S5, vía el orquestador; no la construyo)

No se sube el techo, que lo dice el propio aviso. Cifras sobre el runner del run 39605052252:

| | qué | de quién | cuánto quita | qué cuesta |
|---|---|---|---|---|
| A | sacar el banco de «cortados» de SCRUM-1494c a su PROPIO fichero de test, con sus 4 mutaciones | S5 | **~190 s** (`scrum813`: 286 → ~94: 23 cargas a ~2 s + 5 a ~9,5 s) | nada en lo que mide; un fichero más |
| B | en la pasada MUTADA, correr sólo el test `cae` (la limpia sigue entera) | S3 | **~300 s** en los 7 medidos (estimado: tiempo local de cada `cae` escalado a CI); el resto de los 162, SIN MEDIR | pierde el recuento de colaterales (hoy informativo: «ninguno cambia un veredicto») y estrecha el diagnóstico de corte de SCRUM-1321 a un test |
| C | partir el job en `k` trozos equilibrados por el coste medido de cada guard (`guards-<run>.tsv`), con `k = ⌈coste / 900 s⌉` (hoy 2) | S3 (argumento de trozo) + S5/fundador (`ci.yml`) | la mitad del reloj por trozo (~823 s + ~30 s de arranque) | un runner más por PR |
| D | la comprobación que lo habría parado el 16-oct: el instrumento imprime `limpia × (mutaciones + 1)` por guard y avisa, NOMBRÁNDOLO, del que pase de 60 s | S3 | 0 s: no recorta, **nombra** | — |

* **A + B ≈ 490 s**: 1.646 → ~1.150 s, y ~1.230 s con el runner más lento visto (2,82 s/mut). Con +10
  mutaciones al día (~26 s/día), eso vuelve a los 1.800 s en **unas 3 semanas**. Por eso A y B solos no
  bastan, y C lleva su `k` DERIVADO del coste: un número fijo de trozos es otro techo fijo.
* **Lo que cubre los 128 cortes de jv-j3u es A (o C) YA:** sin A, un runner por encima de ~2,9 s por
  mutación (1.800 / 622) se come el techo con N=622, y el más lento visto ya va a 2,82. Con A, ese mismo
  runner queda en ~1.550 s. B y D no lo cubren solos.
* ⚠️ Ni A ni B están medidos en CI: son estimaciones con tiempos de Windows. La de A está anclada al A/B
  de arriba y a los logs de CI del 15 y del 17-oct (45 s → 285 s). La de B sólo a tiempos locales.

**Discrepancia con la medición de jv-j3u, dicha y no resuelta:** él da `scrum813` de 11 a 26 mutaciones y
de 29 a 284 s. En mis logs tiene 11 hasta el 2-oct, **22 desde el 6-oct** y 26 desde el 17-oct; el salto
de coste por mutación es el del 16-oct en los dos. Puede ser la fecha de referencia de cada uno: no lo crucé.

**Evidencias:** `docs/master/evidencias/SCRUM-935c/` — los instrumentos (`muestrear-runs.mjs`,
`analizar.mjs`, `comparar.mjs`, `tests-lentos.mjs`, `cae-vs-lento.mjs`), la serie (`serie-104-runs.tsv`),
cuatro perfiles por guard (20-sep, 15-oct, 17-oct y 21-oct) y las salidas. Los logs crudos NO entran:
llevan secuencias de escape (A22) y caducan a los 90 días; los perfiles `.tsv` son lo que queda de ellos.

A9: aviso → cicatriz J6 «Medí el coste de un fichero de test quitándole tests con un filtro de nombre, y el coste estaba en la carga del módulo: el filtro no lo toca» — no se pudo comprobar: es un hábito al aislar dónde se va el tiempo, y lo cazó medir la carga sola; un instrumento que lo impida tendría que ser el de S3 (propuesta D)

## SCRUM-935d · propuesta A construida: el banco de cortados sale de `scrum813`

**Medido contra:** `origin/main` = `9839aa6c2baee741f6a38de4e99c7fc29a3fe807` · hora real 2026-10-22T09:32Z
(cabecera `Date:` de GitHub) · S5, equipo de Luis · rama `scrum-935-banco-cortados-fuera-813`.

A9: comprobación → `tests/scrum810-el-suelo-a-la-primera.test.mjs`

**Error propio:** construí la mudanza sin mirar antes quién cuenta las declaraciones POR fichero. Lo vi
después de escribir el código y antes de empujar: el control positivo de `scrum810` habría puesto en rojo el
obligatorio. Se probó en los dos sentidos (abajo).

**Carril:** `scrum813` es de S5. Lo dicen este registro (935c, «`tests/scrum813-…` y SCRUM-1494 son de
S5») y `dos-equipos.md:171` («el test de un ticket → el puesto que trabaja el ticket»).
`scripts/carriles.mjs de` contesta «sin fila» para cualquier `tests/*.test.mjs`, también para los que
no existen, así que no decide nada aquí. El fichero nuevo NO se llama `_banco-*` a propósito: ese
patrón es de S3.

**Qué:** el banco sembrado de cuelgues de SCRUM-1494c (pared de 4 s; corre en el NIVEL SUPERIOR del
módulo) y sus tres tests pasan a `tests/scrum1494-cortados-de-zona.test.mjs`, con las DOS mutaciones
cuyo `cae` los necesita (㉓ y ㉔). Las otras dos de 1494 (㉕ y ㉖) se quedan en `scrum813`: sus tests
son de datos fabricados (`medidaFalsa`, `entrada`) y no miran el banco. Llevarlas al fichero nuevo
haría que el banco se pagara 5 veces en vez de 3. Los nombres de los tests no cambian, así que los
`cae` casan igual.

Se comprobó que el fichero editado es el que SE CARGA: `meta-guard-mutaciones.mjs:342` lista
`tests/*.test.mjs` del árbol con `readdirSync`, y las medidas de abajo se tomaron sobre esas rutas.

**Antes y después, en local** (Windows, node v24.8.0, `node --test` de un fichero suelto, 3 pasadas):

| fichero | antes | después |
|---|---|---|
| `scrum813-trinquete-de-zona` | 13,16 · 11,89 · 11,91 s · 48 tests | 6,72 (la primera, en frío) · 3,36 · 2,58 s · 45 tests |
| `scrum1494-cortados-de-zona` | — | 10,69 · 10,08 · 10,27 s · 3 tests |

Todo en verde, 0 fallos, 0 saltos. El «antes» casa con el A/B de J6 (11,44-11,62 s).

**El meta-guard DE VERDAD, sobre estos dos guards.** Un arnés fuera del árbol llama a las MISMAS
funciones del bucle principal de `scripts/meta-guard-mutaciones.mjs` (`mutacionesDeclaradas`, `correr`,
`aplicarUna`), sólo para los guards que se le dan. Corrió una vez por lado, en la misma máquina y en la
misma hora, con el árbol limpio al acabar (`git status` sin cambios en `tests/` ni `scripts/`):

| | mutaciones | vivas | limpia | total |
|---|---|---|---|---|
| ANTES: `scrum813` de main (`8ad167195`) | 26 | 26 | 14,0 s | **370,1 s** |
| DESPUÉS: `scrum813` | 24 | 24 | 4,3 s | 136,3 s |
| DESPUÉS: `scrum1494-cortados-de-zona` | 2 | 2 | 11,5 s | 36,4 s |
| DESPUÉS, los dos | 26 | 26 | | **172,7 s** |

**197 s menos en local, con 26 de 26 vivas antes y después.** La máquina iba cargada (otras sesiones):
por mutación, `scrum813` tardó 2,9-9,8 s, cuando suelto carga en 2,6-3,4 s. Por eso la cifra vale como
comparación ANTES/DESPUÉS en la misma pasada, no como lo que tardará el CI. Lo del CI se lee en el resumen
del job meta-guard del primer run tras el merge: el paso `if: always()` de 935 imprime la duración.

**El suelo contra main, y el cruce de carril.** `scripts/_suelo-contra-main.mjs` cuenta las declaraciones
POR fichero, y `scrum813` baja de 26 a 24: contadas con `lecturaDeDeclaraciones`, el lector real, sobre la
base y sobre esta rama (base 26 · ahora 24 · fichero nuevo 2). Se añade UNA línea a `RETIRADAS_A_PROPOSITO`.
🔴 **Cruce de carril declarado:** ese fichero es de S3. La línea la redactó S3 para este PR (vía el
orquestador, 22-oct). Su `motivo` decía ㉕ ㉖; se corrigió a ㉓ ㉔, que son las que se mudan, y S3 lo
confirmó. Va en el MISMO PR que la bajada, no antes, porque una retirada sólo exime mientras está pendiente
frente a la base de fusión (SCRUM-1173): S3 lo midió en 6 escenarios (la línea sola primero: 14/15; juntas:
15/15).

| `scrum810` | resultado |
|---|---|
| CON la línea | 6/6 |
| SIN la línea (`git diff --numstat` = 0/1, restaurado con `git restore`) | 5/6: cae «CONTROL POSITIVO: con el árbol tal cual, el suelo CALLA», con `scrum813-trinquete-de-zona.test.mjs: 26 → 24` |

⚠️ **Lo que el suelo NO comprueba (hallazgo de S3):** la lista no distingue mudanza de retirada. El suelo
recorre sólo los guards de la BASE y el fichero nuevo no está en ella. Una mudanza cuyo destino no llevara
los `cae` saldría igual de verde. Ésta sí los lleva (lo dice el arnés de arriba: ㉓ y ㉔ VIVAS en
`scrum1494`), pero eso lo mide esta pasada, no el instrumento. S3 lo cierra después de este PR.

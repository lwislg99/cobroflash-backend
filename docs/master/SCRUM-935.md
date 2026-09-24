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
# SCRUM-1100 · El meta-guard muere mutando un fichero al azar — reproducido en negativo, causa sin cerrar

**Fecha:** 23-sep-2026 · **Carril:** J4 (asignación puntual del orquestador, fuera de mi área habitual —
lo declaro por A20; el encargo lo justificó él con «tú lo viste desde dentro») · **Gate:** ninguno —
diagnóstico, no toca código.
**Medido contra:** `origin/main` = `af1134ad1311ab6839c00a192181a56b8a3eeafa` · 2026-09-23T17:08:35Z

## El encargo

`meta-guard · los guards caen cuando deben` cayó en PR #1730 (mío, docs-only) con `vigia-atascados.
test.mjs` como «FICHERO MUERTO». El orquestador midió que el MISMO job cayó también, con firmas
DISTINTAS, en al menos 4 PR más esa hora (mías dos, de J1 una — `scrum859-identidad-y-motivo-cerrado.
test.mjs`, MUDO 9/7, dos veces — y una tercera vez `vigia-atascados` otra vez, FICHERO MUERTO). Está
bloqueando **SCRUM-870** (firmado por Javier), que J1 tiene verificado por contenido con este check
como único rojo. Se me pidió: 1) reproducirlo, no razonarlo; 2) nombrar la causa; 3) decidir sin
ensanchar la lista para que pase.

## PASO 0 — ¿el defecto está en el fichero que cae?

**NO, con control positivo.** Repliqué el ciclo exacto que hace el meta-guard sobre
`tests/vigia-atascados.test.mjs` —`correr()` limpio + `aplicarUna()` de sus 5 mutaciones
declaradas, mutar/medir/restaurar byte a byte— importando las funciones reales de
`scripts/meta-guard-mutaciones.mjs` (nada reescrito), **40 rondas seguidas, en esta máquina
(Windows, Node 24.18.0)**: **200/200 mutaciones vivas, 0 muertas, 0 ciegas, 0 mudas.** Script en
`docs/master/evidencias/scrum1100/repro-vigia-atascados.mjs` (ver «Ficheros»).

J1 midió lo mismo por su lado sobre `scrum859...`: 20/20 en local, y ese fichero **opera entero en
memoria sobre un `.md`, sin tocar disco ni red** — el mismo veredicto por un camino distinto.

**Conclusión de esta parte, con dos sondas independientes:** el defecto no vive en el contenido de
ninguno de los dos ficheros señalados. Buscarlo ahí es perseguir un síntoma que cambia de sitio.

## Por qué no pude reproducir la caída (y qué SÍ mide esto)

Las 40 rondas locales son un CONTROL NEGATIVO, no una réplica del entorno real: esta máquina no
tiene Docker (trampas del puesto) y el runner real es `ubuntu-latest` — lo digo como límite, no lo
callo. Lo que sí pude hacer con lo que hay:

### 1 · Los tiempos del log real no cuadran con el perfil conocido

SCRUM-935 (mergeado hoy mismo, S5) midió el coste por mutación de una pasada sana: **1,6-2,5 s**,
bajando a 0,3 s en las últimas del recorrido (cita textual: «las últimas del recorrido (scrum951d,
utils, vigia-atascados) cuestan 0,3 s»). En el log de mi PR #1730 (`gh run view --log-failed`,
timestamps por línea), calculé los huecos entre líneas consecutivas: **14 huecos ≥ 8 s, tres de
ellos ≥ 20 s** — 10-100× el coste esperado. Datos en
`docs/master/evidencias/scrum1100/huecos-1730.txt`.

⚠️ **Corrijo aquí mi propia primera lectura, antes de que se lea como más limpia de lo que es:**
los huecos NO están concentrados al final — los hay también muy pronto (línea 13-15, a los 3-4 min
de arrancar el job). Eso pesa CONTRA una lectura de «se agota algo monótonamente hacia el final» y
a favor de un jitter del runner repartido por toda la pasada (CPU/IO compartidos de la VM, sin
relación con qué guard esté corriendo en ese instante). Lo dejo escrito con el dato en contra
delante, no lo escondo porque estorbe a la hipótesis del punto 3.

### 2 · Los dos ficheros que han caído corren TARDE en el mismo proceso largo

`vigia-atascados.test.mjs` y `scrum859-identidad-y-motivo-cerrado.test.mjs` están, los dos, cerca
del final del barrido alfabético de las ~320 declaraciones (`censoDeDeclaraciones` recorre por
nombre de fichero). Un proceso Node que lleva 10+ minutos vivo y ha abierto/cerrado recursos
cientos de veces no es el mismo proceso que acaba de arrancar: si hay algo que se ACUMULA dentro de
una sola pasada, tiene más ocasiones de manifestarse cerca del final que al principio. Esto encaja
con los dos casos reales y con que mi control local (que SÍ corre entero, 40 veces, sin acumular
nada entre rondas porque cada ronda es su propio proceso) salga limpio.

### 3 · Candidato concreto, LEÍDO en el código, no inferido: `abrirObservacion` (scripts/_arbol-quieto.mjs:450)

`correr()` (meta-guard-mutaciones.mjs:630) llama `abrirObservacion(RAIZ)` en CADA invocación —dos
por mutación, una limpia + una mutada—, y eso abre **7 `fs.watch(dir, {recursive:true}, cb)`**
(uno por familia: tests/scripts/src/public/prisma/docs/dist, `_arbol-quieto.mjs:133-149`) que se
cierran al final de esa misma invocación (`vigia.cerrar()`, línea 685 de meta-guard-mutaciones.mjs).
Para 320 declaraciones eso son **~2.000-4.000 aperturas/cierres de watchers recursivos en UN SOLO
proceso Node de 11-14 minutos**.

El propio fichero **ya documenta, medido por quien lo escribió**, que este mecanismo **«no entrega
— CI de Linux, medido»** (`_arbol-quieto.mjs:443`) y por eso existe la huella antes/después como
capa obligatoria — el `fs.watch` es sólo un acompañante opcional desde ese ticket (SCRUM-754b). Lo
que ese comentario NO dice es si «no entrega» significa que la llamada `watch()` **lanza siempre**
en Linux (entonces no queda ningún objeto vivo y esto no aplica) o si crea el watcher y luego
**no dispara eventos de forma fiable** (entonces el descriptor de inotify queda abierto igual, y
`fs.watch` en Node es un `EventEmitter`: si llegase un evento `'error'` asíncrono —p. ej. `ENOSPC`,
el código exacto que Linux usa para «se acabaron los watchers de inotify»— y nadie tiene un
`.on('error', …)` puesto sobre el objeto que devuelve `watch()` (no lo tiene: `_arbol-quieto.
mjs:141-143` sólo pasa el callback de cambios, no un manejador de error), Node **lanza y mata el
proceso entero** — que es exactamente la forma de «FICHERO MUERTO: `node:test` no ha reportado ni
un nombre de test».

**No pude verificar cuál de las dos** sin una máquina Linux (esta no tiene Docker ni WSL con este
árbol montado). Lo dejo como hipótesis con mecanismo nombrado, no como causa cerrada.

### 4 · El propio instrumento no puede confirmar ni descartar esto — y ESO sí es un hecho, no una hipótesis

`correr()` ya captura el error real de cualquier `test:fail`, incluida la muerte del fichero
(`errores[nombre] = {nombre: causa?.name, code: causa?.code, mensaje}`, meta-guard-mutaciones.
mjs:671-680) — **pero el mensaje de `aplicarUna()` para el caso `muerto` (líneas 993-1004) nunca lo
imprime.** El texto que llega a CI dice «no se sabe si HABRÍA caído» cuando el propio proceso, un
momento antes, SÍ guardó el `code` y el `name` del error que mató al fichero. Es la razón de fondo
por la que esta ronda de 4-5 incidentes reales tiene 3 firmas distintas sin poder compararse entre
sí: nadie puede leer si el `ENOSPC` de mi hipótesis está o no, porque el dato existe y no se enseña.

## Decisión (paso 3 del encargo)

**No es un test.** Los dos ficheros señalados pasan limpios con control positivo (40/20 rondas). No
se toca `vigia-atascados.test.mjs` ni `scrum859-identidad-y-motivo-cerrado.test.mjs`, y no se saca
ninguno de la tanda del meta-guard (regla 41 — apagar la alarma no es arreglarla).

**Si es del meta-guard, el candidato con mecanismo nombrado es `abrirObservacion`/`abrirVigilancia`
en `scripts/_arbol-quieto.mjs`**, no el guard que le toca en suerte estar corriendo cuando se agota
lo que sea que se agota. Antes de tocar ESE código hace falta lo que esta sesión no puede dar:

1. **Barato y de bajo riesgo — hacerlo hablar primero.** Que `aplicarUna()` incluya
   `tras.errores[guard]` (nombre, code, mensaje) en el texto de `muerto`. Una línea, no cambia
   ningún veredicto, y el próximo «FICHERO MUERTO» real dirá `ENOSPC`, `EMFILE`, otra cosa, o
   confirmará que no hay error capturado (lo que apuntaría a un `SIGKILL`/OOM externo, no a un
   `fs.watch`). Sin esto, cualquier arreglo que se intente es a ciegas.
2. Con esa cita en mano, confirmar en un runner real (`ubuntu-latest`, vía un workflow de un solo
   uso o `act`) si `fs.watch({recursive:true})` sobre estas 7 familias lanza siempre, nunca, o a
   veces en Linux — y si «a veces», si el número de veces que ya se ha llamado en el proceso
   correlaciona con cuándo empieza a fallar.
3. Esto es escribir y desplegar código (`scripts/`, `.github/workflows/`) — **fuera de mi puesto**
   (J4 no construye código). Lo dejo listo para quien lo tome; por dónde va S5, que es quien tiene
   SCRUM-935 (el ticket hermano de esta misma pieza del CI, mergeado hoy) recién medido.

## Mientras tanto — lo que SÍ puede hacer cualquiera hoy, y no es tocar el guard

Las tres caídas reales que tenemos medidas (mis dos PR, la de J1) se arreglaron con un **rerun**.
No es una explicación —una moneda cargada también sale cara si la tiras dos veces—, pero es la
mitigación de menor riesgo mientras se decide el punto 1: si SCRUM-870 sigue bloqueada sólo por
este check, un rerun es razonable pedirlo antes de escalar más.

## Lo que NO cubre esta entrada

* No arregla nada en `scripts/` ni en `.github/workflows/`: eso es código, y no es mi puesto.
* No confirma la hipótesis de `ENOSPC`/`fs.watch` — la nombro con su mecanismo exacto y digo
  explícitamente que no la pude verificar, para que nadie la lea como cerrada.
* No mide si hay TAMBIÉN contención cruzada entre PR distintos (hardware compartido): los jobs de
  este repo corren en `runs-on: ubuntu-latest` (confirmado, los 13 workflows), que son VM aisladas
  por job en GitHub-hosted — no comparten CPU/RAM entre jobs de PR distintos por diseño estándar de
  Actions. Si la hipótesis de «6 runs simultáneos» del equipo apunta a otra cosa (límite de
  concurrencia de la cuenta, rate-limit de la API de GitHub), es una vía distinta a la que yo
  audité y no la descarto ni la confirmo aquí.
* No repite el barrido completo de 320 declaraciones bajo carga artificial: lo intenté diseñar
  (`docs/master/evidencias/scrum1100/`) y lo descarté a medio camino porque ejecutar varios guards
  en paralelo sobre EL MISMO árbol dispara la propia protección anti-movimiento del instrumento
  («el árbol se movió bajo mis pies» → CIEGO), que es un mecanismo real y correcto pero mide otra
  cosa que la contención de recursos entre procesos aislados. No until publiqué esa medición a
  medias para no hacerla pasar por lo que no es.

## Ficheros

* `docs/master/evidencias/scrum1100/repro-vigia-atascados.mjs` — script de reproducción (40
  rondas), importa las funciones reales de `meta-guard-mutaciones.mjs`, no reescribe nada.
* `docs/master/evidencias/scrum1100/huecos-1730.txt` — huecos entre timestamps del log real de
  PR #1730, con el máximo y su ubicación.

---

# SCRUM-1100b · Dos arreglos del INSTRUMENTO — habla primero, y deja de acusar a un guard sano

**Medido contra:** `origin/main` = `c3031d8929b268ed37a13b7674f81785aa61a9ed` · 2026-09-26T12:42:06Z

S3 · rama `scrum-1100-meta-guard-ciego-no-mudo` · worktree `wt-s3-26-instrumentos`.

**Carril: S3 (instrumentos).** Retoma el punto 1 de J4 (§ arriba, «Barato y de bajo riesgo — hacerlo
hablar primero») y aplica la segunda propuesta de SCRUM-908c §⑦, que ya estaba escrita y esperando
a S3. **No confirma ni descarta ninguna de las dos hipótesis de causa** (ni el `fs.watch`/`inotify`
de J4, ni el `forceExit`/backpressure de stdout de SCRUM-908c): sólo arregla dos sitios donde el
INSTRUMENTO mentía o callaba, con evidencia FRESCA de que ambos siguen vivos en `main` hoy.

## 0 · PASO 0 — el defecto existe HOY, medido en `main`, no en una rama

Antes de tocar nada: 58 runs de `ci.yml` en push a `main`, 24-sep 13:42Z → 26-sep 07:49Z (ver
SCRUM-935, misma sesión). Job `meta-guard`: **23 success · 13 failure · 22 sin job**. De los 13
`failure`, leídos uno a uno por su log (`gh api .../jobs/<id>/logs --allow-escape-sequences`):

| causa | jobs | firma |
|---|---|---|
| `scrum859-identidad-y-motivo-cerrado.test.mjs` · MUDO | **10** | idéntica las 10 veces: «NO APARECE… Recuento: 9 pasados · 7 caídos · 0 saltados. Y en la LIMPIA: 20 pasados · 0 caídos.» |
| `scrum853-avisador-solo-obligatorio.test.mjs` · CIEGAS (varios tests no aparecen en la LIMPIA) | 2 | exit 2 |
| `scrum853-avisador-solo-obligatorio.test.mjs` · FICHERO MURIÓ AL MUTAR | 1 | exit 2, «EL FICHERO MURIÓ AL MUTAR» |

**El recuento MUDO es EXACTAMENTE el mismo en las 10 pasadas** — no gotea al azar: es la misma cola
de eventos que se pierde siempre. Esto es la mutación nº 2 de `scrum859` que SCRUM-908/908b/908c ya
investigó a fondo (hipótesis: `forceExit: true` + backpressure de stdout en pipes de Linux). **No
he añadido nada a esa investigación** — la evidencia de arriba la CONFIRMA con población fresca
(10/13 fallos reales de los últimos dos días, 100 % la misma firma), y es la razón por la que decido
no re-investigar el mecanismo: ya está investigado por tres sesiones anteriores con acceso a los
logs de CI, y sigue **sin reproducirse de forma controlada** (SCRUM-908c-2, §④).

## 1 · Arreglo ①: SALTADO y NO APARECE son CEGUERA, no MUDEZ (propuesta 2 de SCRUM-908c §⑦)

`aplicarUna()` metía las tres causas de `porQueNoCayo` por la misma puerta: `resultado.mudo`. Eso
hacía que la muda de `scrum859` (NO APARECE, un evento perdido) contara en «GUARDS MUDOS — pasan en
verde sobre el defecto que dicen vigilar» — acusando a un guard SANO de estar inerte cuando el
instrumento no llegó a mirar.

**Arreglo:** nueva función pura `esCegueraNoMudez(donde)`, que reconoce `SALTADO` y `NO APARECE`
como ceguera. Sólo «corrió y pasó» sigue siendo `mudo` (mudez de verdad: el aserto vio la mutación
y no la cazó). El código de salida cambia de `SALIDA_MUDO` a `SALIDA_CIEGO` para estos casos, que es
lo correcto: el CIEGO dice «no medí», el MUDO dice «medí y el guard no sirve», y son cosas distintas
con arreglos opuestos.

**Rojo → verde:** test nuevo en `tests/scrum908-la-muda-se-explica.test.mjs` (⑤). Verificado a mano
que el test cae si `esCegueraNoMudez` se rompe (mutación temporal a `return false`, restaurada
después, `git status` limpio) y ahora vive declarada en `MUTACIONES_QUE_ME_TUMBAN` para
`meta:mutaciones`.

⛔ **Esto NO arregla la pérdida de eventos.** Sólo dice la verdad sobre lo que pasó: el meta-guard
seguirá sin poder marcarse obligatorio mientras exista esta pérdida (SCRUM-908 sigue abierto), pero
al menos dejará de imprimir «GUARDS MUDOS» sobre un guard que nadie ha podido juzgar.

## 2 · Arreglo ②: el error que mató al fichero YA estaba guardado (propuesta 1 de J4, §1100 arriba)

`correr()` captura `tras.errores[nombre]` de cada `test:fail` (SCRUM-788), incluida la muerte del
propio fichero. El mensaje de `muerto` decía siempre «no se sabe si HABRÍA caído», tapando un dato
que el proceso, un instante antes, ya tenía. J4 lo señaló como la razón de fondo por la que las
firmas de las caídas reales «no se pueden comparar entre sí»: el `code` (`ENOSPC`, `EMFILE`,
`SIGKILL`…) que distinguiría la hipótesis del `fs.watch` de un OOM externo estaba capturado y mudo.

**Arreglo:** nueva función `errorDelFicheroMuerto(resultado, guard, dir)`, hermana de
`murioElFichero` pero que además devuelve el error capturado (o `null`, explícitamente, si no hay
uno — no se inventa una causa). El mensaje de `muerto` ahora incluye una línea «→ lo que murió con
él: `<nombre>` · `<code>` · `<mensaje>`», o dice explícitamente que no hay error capturado (lo que
por descarte apunta a un `SIGKILL`/OOM externo).

**Rojo → verde:** test nuevo en `tests/scrum784-el-cuarto-veredicto.test.mjs` (①bis), con positivo
(error guardado bajo la ruta del fichero muerto se recupera), y dos negativos (sin error guardado no
se inventa uno; el error de OTRO fichero no se le atribuye a éste). Mutación declarada añadida a
`MUTACIONES_QUE_ME_TUMBAN`. Verificado el rojo con la mutación puesta y quitada.

## 3 · Verificación conjunta

`tests/scrum908-la-muda-se-explica.test.mjs`: 5/5. `tests/scrum784-el-cuarto-veredicto.test.mjs`:
5/5. `guards:entrada`: 112/112 (11,3 s de 90). `npm run build` sin errores. `src/` intacto, ningún
suelo bajado, ninguna mutación declarada excluida — regla 41: el meta-guard sigue evaluando las
mismas ~320 declaraciones, sólo cambia CÓMO se clasifica y CUÁNTO cuenta un veredicto ya existente.

## 4 · Lo que esto NO hace, y quién lo hace

* **No arregla la pérdida de eventos de `scrum859`** (SCRUM-908/908b/908c, hipótesis del backpressure
  de stdout con `forceExit`). Necesita un runner Linux real y experimentación que ya han intentado
  tres sesiones sin éxito concluyente (SCRUM-908c-2 §④: incluso un caso calibrado a 2,4× la
  capacidad medida del transporte no reprodujo la pérdida en la corrida más reciente).
* **No confirma ni descarta el `fs.watch`/`inotify` de J4** para el caso `vigia-atascados`/`scrum853`.
  Sigue sin verse ninguna caída de `vigia-atascados` en la ventana medida hoy (§0): el síntoma
  «FICHERO MUERTO» de esta ventana es de `scrum853`, no de `vigia-atascados`, y no se ha investigado
  si comparte mecanismo.
* **No marca el meta-guard obligatorio.** Ese criterio (SCRUM-836 ②) sigue sin cumplirse: la próxima
  vez que salga rojo por esto, el mensaje dirá CIEGO (con el error, si lo hay) en vez de MUDO, y eso
  es lo que cambia hoy.
* **Deliberadamente NO se aplicó** el arreglo del `--import` bloqueante propuesto en SCRUM-908c §⑦
  (forzar stdout síncrono en el hijo). Es una hipótesis sin demostrar, aplicarla afecta a las ~320
  mutaciones de cada pasada del meta-guard, y las tres sesiones que sí tenían acceso a Linux CI para
  probarla no lo consiguieron cerrar. Aplicarla a ciegas desde una máquina Windows que no puede
  verificarla sería exactamente lo que A2 prohíbe (medir antes de construir).

---

# SCRUM-1100c · El próximo corte se explica solo — `test:summary` como prueba directa

**Medido contra:** `origin/main` = `cbb30708590011f79b1f392f322c4d264eab537c` · 2026-09-26T ~16:15Z
(worktree `wt-s3-1153-censo-entorno`, rama `scrum-1100c-el-resumen-explica-el-corte`).

**Decisión del orquestador (S3):** no reproducir el mecanismo (tres sesiones de J6 con acceso a
Linux CI ya lo intentaron y no lo cerraron; repetirlo desde Windows sin esa evidencia repite el
mismo callejón). En su lugar, **instrumentar `correr()` para que la PRÓXIMA vez que el corte
ocurra de verdad en CI, se explique con un dato directo en vez de una lista de sospechas.**

## Qué se añadió

`node:test`'s `run()` emite `test:summary` como el ÚLTIMO evento de cada fichero, con el recuento
que el propio runner hizo de sí mismo (`counts.tests/passed/failed/skipped`, verificado en vivo con
una sonda de 3 casos — ver `diagnosticoDeCorte`). Si la hipótesis de SCRUM-908c es cierta —el hijo
pierde la cola de stdout al llamar `process.exit()` (`forceExit: true`) antes de vaciarla—, el
resumen es justo lo último en la cola: su AUSENCIA es una prueba directa del corte, no una lectura
de nombres que aparecen o no.

`correr()` ahora captura ese evento y devuelve `resumen` (los `counts` de node:test), `duracionMs` y
`timeoutMs`. Nueva función pura `diagnosticoDeCorte(tras)`, FAIL-CLOSED (si `tras` no trae los campos
nuevos, lo DICE — «NO EVALUABLE» — en vez de inventar un veredicto):

* **SIN resumen** → confirma que la salida se cortó ANTES de terminar (pérdida de eventos, no
  cambio de título), y avisa si la duración quedó pegada al timeout de 300000 ms (podría ser el
  timeout, no el corte de stdout).
* **CON resumen pero `counts.tests` no cuadra** con lo que este script acumuló → se perdió algo
  ANTES del resumen, no al final: mismo mecanismo, otro punto de corte.
* **CON resumen y cuadra** → el fichero terminó con normalidad; si el test buscado no aparece, la
  pregunta deja de ser «¿se cortó la salida?» y pasa a ser «¿cambió el título?».

Se enchufa en `aplicarUna()`, sólo para la causa «NO APARECE» (la única de las tres donde
`test:summary` da evidencia directa; SALTADO ya tiene causa conocida — QA_DB_TEST — y añadir esto
ahí sería ruido).

## Verificado, no asumido

* Semántica de `counts.tests` de `node:test` (Node 24.20) comprobada con una sonda de 3 casos
  (1 pass, 1 skip, 1 fail): `tests` cuenta las tres, y existe un campo `failed` (no documentado en
  los tipos de `@types/node` instalados, pero presente en tiempo de ejecución).
* Smoke test real: `correr('scrum908-la-muda-se-explica.test.mjs')` devuelve `resumen`/`duracionMs`
  poblados y `diagnosticoDeCorte` dice «CUADRAN» sobre una pasada limpia real (no fabricada).
* Fail-closed comprobado: pasando un `tras` sin los campos nuevos (una llamada anterior a este
  cambio), `diagnosticoDeCorte` devuelve «NO EVALUABLE» en vez de una conclusión inventada.
* `tests/scrum908-la-muda-se-explica.test.mjs` (5/5) y `tests/scrum784-el-cuarto-veredicto.test.mjs`
  (5/5) siguen verdes sin tocarlos. `guards:entrada` 112/112. `npm run build` sin errores. No se
  corrió la tanda completa (7,7k) por presupuesto de contexto de la tanda.

## Lo que esto NO hace

* **No arregla la pérdida de eventos ni confirma su causa.** Es puramente diagnóstico: la próxima
  vez que `scrum859` (o cualquier otro) salga «NO APARECE» en CI real, el mensaje dirá si el resumen
  llegó o no, en vez de dejarlo para que alguien vuelva a investigar desde cero.
* **No toca `forceExit` ni el `--import` bloqueante** (sigue siendo hipótesis sin demostrar, A2).
* **SCRUM-836 (marcar el meta-guard obligatorio) sigue aparcado.** Con esta instrumentación no
  cambia la tasa de fallo — sigue siendo del orden del 36 % de los runs donde el job llega a
  arrancar (13 de 36 de 58 corridas medidas por S5 el 26-sep; las otras 22 son «pendiente
  sustituido», reemplazadas por GitHub antes de empezar). Condición de reapertura dejada en Jira.

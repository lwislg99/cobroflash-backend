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

# SCRUM-1527 · La tanda que se cuelga: 7 veces en 437, siempre entre `scrum445` y `scrum447`, y el punto fijo es el NOMBRE, no los 992 KB

**Medido contra:** `origin/main` = `6ca2fb6516b2ae72b1a2dad065840feb9a9cc495` · 2026-10-13T05:30:51Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1527/medir.mjs`

J6 (sesión `jv-j6b`, equipo de Javier), por encargo del orquestador `cobroflash-backend-2e`. Es
medición: no toca `src/`, ni `tests/`, ni `scripts/`, ni ningún workflow, ni ningún tiempo de
espera. El ticket no se transiciona. **La causa NO está encontrada**, y se dice aquí arriba para
que nadie lea el resto como un diagnóstico.

## En corto

- **Población:** las 600 últimas ejecuciones de `ci.yml` (del 2026-10-01T17:01Z al
  2026-10-13T05:14Z). 597 completadas; 139 sin job obligatorio (casi todas `push` canceladas antes
  de crearlo); **462 jobs** «build + tests (con banco desechable)», de los que **3 logs ya no se
  pueden bajar** (HTTP 404, 215 B cada uno). Quedan **459 logs leídos**. De ellos **437 llegan al
  punto** (se ve `scrum447` o se cuelgan) y 22 se cancelaron antes.
- **«TANDA SIN VEREDICTO» sale en 7 de esos 459.** Los dos conocidos están entre los 7 (control
  positivo) y ninguno de los 339 verdes lo lleva (cero derivado).
- **Los 7 se paran en el mismo sitio POR NOMBRE:** lo último que llega es el último caso de
  `scrum445-cobros-sin-duplicar` (3 veces) o el último de `scrum446-cabecera-modal` (4 veces). Del
  fichero siguiente no llega ni un caso. Ningún cuelgue en ningún otro punto de los ~1.300 ficheros.
- **Los 992 KB NO son el punto fijo.** Los 7 pesan de 891.508 a 995.698 B y llevan de 5.390 a
  5.948 casos, creciendo con la fecha. Los ficheros nuevos (`scrum1xxx`) ordenan ANTES de
  `scrum446`, así que el mismo sitio pesa más cada día. Dos tandas de la misma mañana pesan casi lo
  mismo porque el árbol era casi el mismo, no porque el cuelgue elija un byte.
- **Los ~912 s de silencio tampoco son firma.** Son el tope del detector (900 s) más su sondeo
  (cada 15 s): los 7 dan entre 900 y 915. Cualquier cuelgue, en cualquier sitio, daría esa cifra.
- **No es que esos ficheros sean lentos.** En los 430 logs donde pasan, entre el último caso de un
  fichero y el primero del siguiente hay como máximo 597 ms. O tardan menos de un segundo, o no
  llegan nunca: no hay ni un caso intermedio.

## ① Los siete

| job | rama | aviso (hora del log) | bytes del log | casos que pasan | silencio | lo último que llegó | no llega nada de |
|---|---|---|---|---|---|---|---|
| 112295210122 | `scrum-1464b-…` | 2026-10-06T13:48:43Z | 891.508 | 5.390 | 903 s | último de `scrum446` | `scrum447` |
| 112435237313 | `scrum-1485-…` | 2026-10-06T18:51:02Z | 921.462 | 5.572 | 905 s | último de `scrum446` | `scrum447` |
| 112906403918 | `scrum-1498-…` | 2026-10-07T17:05:22Z | 957.741 | 5.757 | 912 s | último de `scrum446` | `scrum447` |
| 113216097886 | `scrum-1513b-…` | 2026-10-08T08:34:18Z | 975.016 | 5.830 | 902 s | último de `scrum445-cobros-sin-duplicar` | `scrum446` |
| 115064831385 | `scrum-1520-…` | 2026-10-13T00:30:58Z | 995.698 | 5.948 | 900 s | último de `scrum445-cobros-sin-duplicar` | `scrum446` |
| 115068271610 | `scrum-1500h-…` (#2345) | 2026-10-13T00:44:59Z | 992.258 | 5.933 | 910 s | último de `scrum446` | `scrum447` |
| 115134364145 | `scrum-1519c-…` (#2350) | 2026-10-13T05:07:16Z | 992.509 | 5.929 | 915 s | último de `scrum445-cobros-sin-duplicar` | `scrum446` |

En los 7 caen 0 casos antes del cuelgue. El detalle, con sha y nombre completo de rama, en
`docs/master/evidencias/SCRUM-1527/colgados.json`.

El de 975.016 B del 8-oct es el que la ficha del día citaba como ejemplo de tanda colgada: es el
mismo fenómeno, cinco días antes.

## ② Los controles

- **Tamaño antes de contar.** Los 3 logs de 215 B son el cuerpo de un 404, no un log. Mi primer
  recuento los daba por «logs con contenido» (462): lo delató la línea `conCeroLineasDeCaso=3` del
  propio instrumento, y los otros dos instrumentos los dejan fuera por tamaño. La población buena
  es 459.
- **Positivo.** Los jobs 115068271610 (#2345) y 115134364145 (#2350) salen en la búsqueda.
- **Calibración del contador.** Mi recuento de casos que pasan sobre esos dos logs da 5.933 y
  5.929, las mismas cifras que midieron J5 y J1 por su cuenta. El contador ancla el símbolo al
  inicio del caso, detrás del sello de hora.
- **Cero derivado.** 339 verdes, 0 con el aviso, 0 sin línea de recuento. Sus tamaños: de
  1.595.234 a 1.802.077 B (mediana 1.719.486).
- **Cuelgues que el detector no llegaría a decir.** El job tiene un tope de 25 min y el detector
  necesita 15 de silencio: un cuelgue tardío saldría como job cancelado a los 25 min, sin aviso.
  De los 39 cancelados, el más largo duró 11 min 42 s. No hay ninguno así en la ventana.

## ③ La pata que no depende de cuántas veces se repite

El aviso del encargo era justo: «se repite en el mismo sitio» con dos casos no separa nada. Aquí
son 7 de 7 y no 2 de 2, pero la conclusión no descansa en eso. Descansa en tres cosas que no son
un recuento de repeticiones:

1. **El mismo blob sale entero en 430 de 437 jobs**, y siempre en menos de 0,6 s (hueco
   `scrum445b`→`scrum446`: máximo 597 ms; `scrum446`→`scrum447`: máximo 393 ms; `scrum447`→
   `scrum448`: máximo 513 ms). Así que NO es un fichero que tarde: es bimodal.
2. **Lo que hacen esos ficheros no puede esperar a nada.** `scrum447` sólo importa módulos de
   node y lee `tests/` y `scripts/` de forma síncrona; `scrum446` lee `public/dashboard/js` igual.
   No hay un `await`, un servidor, un hijo ni un temporizador. Y en los 7 casos el fichero
   «colgado» no llega a escribir ni su primer caso.
3. **El peso se mueve y el nombre no.** 891 KB → 995 KB en una semana, mismo par de ficheros.

Lo que sale de ahí: **la causa no está en lo que comprueban `scrum446` ni `scrum447`.** Está en
cómo arranca o cómo termina un proceso de fichero en ese punto de la tanda, o en algo que corre a
la vez. Cuál de las dos, no lo he medido.

## ④ Lo que NO he medido

- **La causa.** No la tengo.
- **Qué proceso es el que no termina.** El aviso dice «el que no ha terminado es el SIGUIENTE», y
  eso es una deducción del orden de salida, no una observación. Con lo que hay en el log no puedo
  separar «el siguiente nunca escribió» de «el anterior escribió todos sus casos y su proceso no
  cerró». Los candidatos son tres: `scrum445-cobros-sin-duplicar`, `scrum446` y `scrum447`.
- **Qué pasó con los ficheros posteriores.** Su salida se retiene por orden y se pierde al matar
  la tanda. No sé si habían acabado.
- **Linux.** En local (Windows, node v24.18.0), 120 pasadas de `scrum446` + `scrum447` juntos: 120
  completas, 0 colgadas, máximo 1,6 s. Es otra máquina, otro sistema y sin el resto de la tanda al
  lado: no dice que no se reproduzca, dice que así no.
- **Antes del 1-oct.** La ventana son 600 ejecuciones. «El primero es del 6-oct» quiere decir «el
  primero de la ventana».
- **Los TAP guardados** de los colgados (artefacto `tanda-tap`, 7 días): no los he abierto.

## ⑤ Lo que miré y no separa nada

| corte | llegan al punto | colgados |
|---|---|---|
| 1-oct y 2-oct | 158 | 0 |
| 6-oct a 9-oct | 260 | 4 |
| 13-oct | 19 | 3 |
| imagen `ubuntu-24.04` 20260927.320.1 | 311 | 3 |
| imagen `ubuntu-24.04` 20261004.327.1 | 126 | 4 |
| evento `pull_request` | 344 | 7 |
| evento `push` | 93 | 0 |

Node es 24.21.0 en los 437. La imagen del runner no lo explica: se cuelga con las dos. «0 de 158
antes del 6-oct» y «0 de 93 en push» parecen cortes y no lo son: con una tasa del 1,6 %, sacar
cero en 158 pasa una vez de cada trece, y en 93, casi una de cada cuatro. Lo de hoy (3 de 19) sí es más
alto que lo anterior (4 de 418), pero con 3 casos no lo doy por tendencia.

## ⑥ El paso siguiente, que no es mío

Lo que contestaría la pregunta de ④ sin tocar el tope: que el vigía, **antes de matar el árbol**,
escriba qué procesos siguen vivos y en qué estado (`ps` con padre, estado, tiempo y argumentos).
Con eso el próximo cuelgue dice solo si hay un `node` de fichero vivo, cuál, y si está parado o
esperando. Es un cambio en `scripts/tanda-con-veredicto.mjs`, que es carril de S5: se propone, no
se hace aquí. No sube ningún tiempo de espera ni cambia ningún código de salida.

## Cómo se repite esta medición

Los cinco instrumentos están en `docs/master/evidencias/SCRUM-1527/`. No hay `jq` ni Python: son
node.

    gh run list --workflow ci.yml --limit 600 --json databaseId,event,headBranch,headSha,status,conclusion,createdAt,number > runs.json
    node docs/master/evidencias/SCRUM-1527/bajar.mjs runs.json logs      # jobs.json + un log por job
    node docs/master/evidencias/SCRUM-1527/medir.mjs jobs.json logs medida.json
    node docs/master/evidencias/SCRUM-1527/rafaga.mjs medida.json logs   # huecos entre ficheros
    node docs/master/evidencias/SCRUM-1527/entorno.mjs medida.json logs  # por día, imagen, node, evento
    node docs/master/evidencias/SCRUM-1527/bucle.mjs . 120               # el intento en local

Los logs pesan cientos de MB y GitHub los borra a los 90 días: no van al repositorio. Van
`colgados.json` (los 7) y `verdes-job-bytes-pasan-total.txt` (los 339 verdes: job, bytes, casos
que pasan y total declarado).

---

# SCRUM-1527b · Por qué se cuelga: no son 7 sino 12, en TRES sitios, y el nombre fijo sólo lo es por temporadas

**Medido contra:** `origin/main` = `9358f02b14e9648f1ab65fbdacf6464d50728242` · 2026-10-13T10:49:48Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1527/1527b/pasos2.mjs`

J6 (sesión `jv-j6f`, equipo de Javier), por encargo del orquestador `cobroflash-backend-2e`. Sólo
medición: no toca `src/`, `tests/`, `scripts/`, workflows ni ningún tiempo de espera. El ticket no
se transiciona. Al escribir, `origin/main` ya iba por `b9ecf641065f2616b0d019fa398f7f1c21f4e8d6`;
lo medido son logs de CI y el árbol de `9358f02b1`.

**La causa NO está encontrada.** Lo que sigue cambia el encuadre del tramo anterior, descarta
siete cosas y deja una hipótesis sin probar. Cada apartado dice lo medido y lo no medido.

## ① No son 7: son 12 desde el 17-sep, y en tres sitios distintos

**Población:** las 2.400 últimas ejecuciones de `ci.yml` (2026-09-17T13:54Z a 2026-10-13T10:32Z);
2.002 jobs «build + tests (con banco desechable)» contando reintentos (1.351 `success`, 395
`failure`, 256 `cancelled`). **Filtro barato:** paso «Tests» en `failure` y de 900 s o más. Salen
11, y entre 600 y 900 s no hay ninguno (los 385 fallos corrientes duran de 182 a menos de 600 s):
el corte es limpio. Los 11 logs se bajaron y los 11 llevan «TANDA SIN VEREDICTO».

- **Control positivo:** los 7 conocidos tienen que salir. La primera pasada dio **5 de 7**: los
  otros dos estaban en ejecuciones que luego se relanzaron a verde, y yo sólo había mirado las
  fallidas y las canceladas. Con las `success` dentro (`pasos2.mjs`) salen 7 de 7.
- **El duodécimo no lleva aviso:** el job `109503839889` (29-sep) se CANCELÓ a los 938 s de paso,
  con 792 s de silencio tras el último caso de `scrum475-constancia-correo`: el mismo sitio que el
  colgado del 26-sep. El detector no llegó a hablar porque lo cancelaron antes de los 900 s.
- **No medido:** de los 256 cancelados sólo abrí ese (el único con el paso de 600 s o más). Un
  cuelgue cancelado antes de los 10 min no lo ve este filtro. Nada anterior al 17-sep.

| fecha | job | node | último fichero que entrega | no llega nada de |
|---|---|---|---|---|
| 22-sep 23:04Z | 106973511384 | 24.20.0 | `scrum615-plazo-con-null` | `scrum616-que-guarda-la-factura` |
| 23-sep 10:20Z | 107138394330 | 24.21.0 | `scrum615-plazo-con-null` | `scrum616-que-guarda-la-factura` |
| 23-sep 10:59Z | 107150234705 | 24.20.0 | `scrum615-plazo-con-null` | `scrum616-que-guarda-la-factura` |
| 26-sep 06:21Z | 108352556918 | 24.21.0 | `scrum475-constancia-correo` | `scrum475-firma-del-webhook` |
| 29-sep 16:22Z | 109503839889 (cancelado) | 24.21.0 | `scrum475-constancia-correo` | `scrum475-firma-del-webhook` |
| 6-oct a 13-oct | los 7 de arriba | 24.21.0 | `scrum445-cobros-sin-duplicar` (3) · `scrum446` (4) | `scrum446` (3) · `scrum447` (4) |

**Lo que esto corrige:** «siempre entre `scrum445` y `scrum447`» es cierto del 6 al 13 de octubre
y falso antes. El sitio aguanta días y luego se muda: 22–23 sep, 26–29 sep, 6–13 oct. Entre el
29-sep y el 6-oct no hay ninguno.

**Qué NO es lo que fija el sitio (`indice.mjs`, medido sobre 10 de los 11 con aviso: el del 23-sep
10:59Z apareció después y no lo pasé):** la posición en la lista (567, 570, 465 y de 679 a 734 sobre
968 a 1.307 ficheros) ni los ficheros que quedan por detrás (401 a 574). Tampoco el tiempo desde el
arranque de la tanda (de 149 a 212 s en los 7 de octubre, con el mismo par de ficheros), la versión
de node (24.20.0 y 24.21.0) ni la imagen del runner (cuatro distintas).

## ② Los ficheros POSTERIORES siguieron corriendo: se cuelga UNO, no la tanda

Era un «no medido» del tramo anterior. El log del job trae al final el del Postgres del servicio,
que es un testigo que no pasa por la salida ordenada de `node --test`. En **11 de 11** colgados con
aviso hay un error de clave duplicada de `scrum809` (`evt_scrum809_…`) entre 2 y 4 min DESPUÉS de la
última línea de la tanda (`testigo-pg.mjs`). `scrum809` ordena muy por detrás de cualquiera de los
tres sitios. Así que el proceso padre no está bloqueado y los demás ficheros se siguen lanzando: lo
que no termina es un fichero, y su silencio tapa a los 400–570 que van detrás.

- **Control:** en los 59 verdes bajados el mismo error sale, a una mediana de 202 s del punto.
- **No medido:** si los posteriores acabaron TODOS. Sólo sé que la tanda llegó al menos a `scrum809`.
- **El ritmo no separa** (`ritmo.mjs`): tras el corte, los colgados tardan en llegar a `scrum809`
  casi lo mismo que los verdes (cociente 0,99 a 1,10 en los 7 de octubre; verdes 0,84 a 1,08). Con
  un hueco de concurrencia perdido esperaba bastante más. No lo doy por prueba de que el hueco esté
  libre: no he medido la concurrencia real del runner ni si el tramo lo marca la CPU.

## ③ Lo único que los 12 tienen en común, y es hipótesis, no causa

En los 12, la última ráfaga antes del silencio la ABRE un fichero de censo síncrono y pesado, que
sale tras retener la salida entre 2,4 y 10,8 s (`ultima-rafaga.mjs`):

- sitio 615: `scrum615-plazo-con-null`, tres casos de 1,7 a 4,6 s. Es además el último que entrega.
- sitio 475: `scrum475-constancia-correo`, casos de 1,1 a 2,0 s. También es el último que entrega.
- sitio 445–447: `scrum419-ci-declara-lo-que-no-corre`, casos de 1,6 a 2,8 s. Abre la ráfaga, y el
  corte llega 263 o 269 líneas después, **entre 50 y 570 ms más tarde**.

En los verdes, la ráfaga que suelta `scrum419` acaba justo en `scrum445`/`scrum446` en 11 de 59
(19 %); en los colgados de octubre, en 5 de 7 (`frontera.mjs`).

🔴 **Por qué NO lo doy por hallazgo:** todo corte va precedido de una ráfaga, y no he calculado
cuántas veces saldría esto por azar. Probé la versión fuerte («se cuelga el fichero que está en la
frontera cuando termina `scrum419`») y es FALSA como condición suficiente: en verdes esa frontera
cae entre `scrum438` y `scrum451` y no se cuelga nadie, y en 2 de los 7 el corte llega a `scrum446`
con la frontera en `scrum442`/`scrum443`. Queda como pista: el cuelgue vive pegado a la salida de
un proceso que ha estado segundos sin soltar el hilo.

## ④ «El siguiente nunca escribió» o «el anterior no cerró»: el log NO puede separarlo, y por qué

Leído en el runner de node (fuente de la v24.18.0 local; CI corre 24.20/24.21, **no cotejado**):

- El padre da un fichero por acabado cuando llegan DOS cosas: el `exit` del hijo y el cierre de su
  salida. Mientras no llegan, lo de los siguientes se queda en memoria aunque hayan terminado.
- `--test-force-exit` SÍ baja a cada hijo. El hijo, al acabar, espera a que su informe se despegue
  de la salida y entonces llama a `process.exit()`.

Y medido en los logs: un fichero de casos síncronos entrega **todo de golpe o nada**. `scrum446`
escribe sus 5 líneas en 4 ms o menos, con casos de 40 a 90 ms. En los verdes, `scrum447` llega de 15
a 46 ms detrás del último de `scrum446`, con sus dos casos de 150 ms separados 2 ms: ya estaba
terminado y retenido, y lo suelta el CIERRE de `scrum446`.

Consecuencia: en los 4 casos «llega todo `scrum446`, nada de `scrum447`» caben igual «`scrum446`
entregó y su proceso no cerró» y «`scrum447` no llegó a entregar»; y en los 3 «nada de `scrum446`»,
igual «`scrum445b` no cerró» y «`scrum446` no entregó». `scrum446` es el único que sale en las dos
lecturas de los dos casos. **No he podido decidir cuál**, y con lo que guarda hoy CI no se puede:
el TAP corta en el mismo sitio (misma cola ordenada) y el vigía no guarda nada de procesos.

## ⑤ Descartado, con qué

| candidato | cómo se descarta |
|---|---|
| Bucle infinito en `soloEjecutable` (lo usa `scrum446`) | leído entero: el índice avanza en todas las ramas |
| Un FIFO o fichero especial en `tests/`, `scripts/` o `public/dashboard/js` | 0 `mkfifo`/`mknod` en `tests/` y `scripts/`; control positivo: la misma búsqueda encuentra `symlinkSync` en 9 ficheros |
| Una señal de parada desde otro test | 0 `SIGSTOP`/`SIGTSTP` en `tests/` y `scripts/` |
| Los tres ficheros abren algo que no cierran | `scrum446` y `scrum447`: sólo `node:fs` síncrono. `scrum445b` importa `dist/…/cobros.service.js`: **no medido** si deja un manejador vivo |
| El padre bloqueado (tubería llena, bucle) | ② |
| Índice fijo, tiempo fijo, versión de node, imagen | ① |
| Que el fin de `scrum419` baste para colgar | ③ |

## ⑥ Qué guarda el vigía

`scripts/tanda-con-veredicto.mjs` guarda los últimos 4.000 caracteres de la salida y el pid del
hijo. De procesos, nada: al cumplirse el tope escribe el aviso y mata el grupo. Lo que dice el
aviso («el que no ha terminado es el SIGUIENTE») es una frase fija, no una lectura.

## ⑦ Windows, otra vez, y por qué sigue sin valer

`ventana.mjs`: `scrum419` más los 22 ficheros de `scrum438` a `scrum458`, con
`node --test --test-force-exit --test-concurrency=3`, node v24.18.0. **100 pasadas completas de
100, 0 colgadas**, máximo 14,3 s (al escribir esto; lanzadas 150). Es otro sistema y otra versión:
dice que así no, no que no se reproduzca. **Linux no se ha medido:** en esta máquina no hay WSL ni
Docker, y lanzarlo en CI pide tocar un workflow, que no es mío.

## ⑧ Lo que falta, por orden de lo que más separa

1. **Quién está vivo cuando se cumple el tope.** Es la propuesta del tramo anterior (carril S5), y
   con lo de ④ se puede afinar qué tiene que escribir el vigía ANTES de matar: por cada descendiente,
   pid, padre, estado, tiempo de CPU dos veces con un segundo entre medias, y argumentos. Con eso
   se lee de una vez (a) qué fichero es, (b) si gira o duerme, y (c) si NO queda ningún proceso de
   fichero vivo, que también es una respuesta: entonces el fallo está en la cuenta del padre.
2. **Un bucle en Linux de los ficheros de los tres sitios** (`scrum615-plazo-con-null`,
   `scrum475-constancia-correo`, `scrum419` con su ventana), con la concurrencia del runner.
3. Cotejar ④ contra la fuente de node 24.21.0, y medir la concurrencia real del runner.

## Errores míos en este tramo

- Crucé los 200k de contexto sin avisar: medí 86.158 al acabar la lectura de arranque y no volví a
  medir hasta 298.340. La ficha pedía avisar a 200k.
- El primer control positivo de ① dio 5 de 7 y lo arreglé antes de contar; va dicho arriba.
- Durante media sesión trabajé la hipótesis «lo dispara el fin de `scrum419`» antes de medir la
  frontera en verdes, que la tumbó como condición suficiente.
- El obligatorio del push de este tramo (job 115258635622, PR #2366) salió ROJO y la sesión que empujó
  ya estaba cerrada: 1 caso de 11.179, `scrum622`, por `1527b/huecos.mjs:11`, que rotulaba «verde»
  todo log sin el aviso. El guard tenía razón: un log sin aviso puede ser rojo o cancelado (el del
  29-sep de ① lo es). Arreglado en el fichero, que ahora dice «sin aviso»; el guard no se toca.
  Lo leyó y lo arregló la sesión `jv-j6h`. Este registro no cita la salida de `huecos.mjs` en ningún sitio (buscado por nombre).

## Cómo se repite

Los instrumentos están en `docs/master/evidencias/SCRUM-1527/1527b/` (node, sin `jq` ni Python).
Los logs no van al repositorio.

    gh run list --workflow ci.yml --limit 2400 --json databaseId,event,headBranch,headSha,status,conclusion,createdAt > runs.json
    node pasos.mjs && node pasos2.mjs                 # paso «Tests» de cada job; candidatos por duración
    node candidatos.mjs ../colgados.json              # control positivo contra los 7 conocidos
    node bajar7.mjs ../colgados.json ../verdes-job-bytes-pasan-total.txt logs && node bajar2.mjs ../verdes-job-bytes-pasan-total.txt logs 45
    node testigo-pg.mjs logs                          # ②
    node ritmo.mjs logs                               # ② el ritmo
    node ultima-rafaga.mjs logs && node frontera.mjs logs   # ③
    node indice.mjs <raíz del árbol>                  # ① la posición
    node ventana.mjs <raíz del árbol> 150 3 ventana.log     # ⑦

---

# SCRUM-1527c · El que no completa es SIEMPRE el siguiente, y no es un fichero: en 8 colgadas decisivas salen cuatro distintos

**Medido contra:** `origin/main` = `3c25452545a3b7092fb284df8a57b4f203f7a8a8` · 2026-10-14T08:17:30Z (hora de lectura del fetch)

A9: aviso → A10 «Antes de llamar mecanismo a lo que has visto, di sobre cuántos elementos lo mediste: un instante no es un régimen.» — no se pudo comprobar: lo que falló aquí (1527b leyó «el sitio aguanta días» y «un fichero común a las dos lecturas» en 12 casos) es un criterio de lectura, y ningún test distingue un régimen de una coincidencia

J6 (sesión `jv-j6l`, equipo de Javier), por encargo del orquestador `cobroflash-backend-2e`. Sólo
medición: no toca `src/`, `tests/`, `scripts/`, ningún workflow ni ningún tiempo de espera. El
ticket no se transiciona. **La causa NO está encontrada.** Lo que sí cambia: se cierra la pregunta
de 1527b §④, y con ella se caen dos lecturas de 1527b.

## En corto

- **Población:** 16 colgadas desde el 17-sep (las 12 de 1527b + 4 nuevas, abajo). 15 llevan aviso
  y se leyeron enteras; la cancelada del 29-sep no lleva aviso y estos instrumentos no la leen.
- **8 de las 15 son decisivas** y en las 8 el que no completa es el fichero **SIGUIENTE** al último
  entregado. El vigía tenía razón con su frase fija; 1527b §④ («no se puede decidir») queda resuelto
  para esas 8.
- **Pero no es un fichero:** en esas 8 el que no completa es `scrum446` (4), `scrum447` (1),
  `scrum616` (1) y `scrum615-plazo-con-null` (2). Dentro del MISMO sitio cambia de fichero.
  Se cae «`scrum446` es el único que sale en las dos lecturas» (1527b §④) como pista de culpable.
- **El sitio no «aguanta días»:** el 13-oct hubo uno en `scrum445`→`scrum446` (12:14Z) y otro en
  `scrum615`→`scrum616` (12:48Z), con 34 minutos entre medias. Contradice 1527b §①: dos números,
  «22–23 sep, 26–29 sep, 6–13 oct» de 1527b frente a dos sitios el mismo día aquí.
- **§⑧ de 1527b:** el paso 1 (que el vigía escriba quién vive) y el 2 (bucle en Linux) NO los he
  podido ejecutar, y el porqué va en ④. El 3 (cotejo con node 24.21.0) está hecho y es el que abrió
  todo lo anterior.

## ① Las cuatro nuevas

Filtro barato de 1527b (`1527b/pasos.mjs` + `pasos2.mjs`, sin cambiar) sobre las ejecuciones de
`ci.yml` creadas desde 2026-10-13T10:32:31Z hasta 2026-10-14T08:07:46Z: 172 ejecuciones, 165
completadas, **131 jobs obligatorios** (95 `success`, 30 `failure`, 6 `cancelled`). Paso «Tests» en
`failure` y de 900 s o más: **4**. Entre 600 y 900 s: 0. Cancelados: 5, el más largo de 491 s.
Los 4 logs llevan «TANDA SIN VEREDICTO» y pesan de 1.005.746 a 1.271.213 B (los verdes de 1527, de
1,6 a 1,8 MB: no es el mismo fenómeno, como avisaba el encargo).

| job | creado | último fichero entregado | no llega nada de |
|---|---|---|---|
| 115290677611 | 13-oct 12:14Z | `scrum445-cobros-sin-duplicar` | `scrum446` |
| 115305001172 | 13-oct 12:48Z | `scrum615-plazo-con-null` | `scrum616-que-guarda-la-factura` |
| 115728094402 | 14-oct 07:09Z (run 38526531948) | `scrum615-pedir-tipo-destinatario` | `scrum615-plazo-con-null` |
| 115735116377 | 14-oct 07:29Z (run 38528703912, intento 1) | `scrum615-pedir-tipo-destinatario` | `scrum615-plazo-con-null` |

Los dos de hoy son los del encargo. Los 4: node 24.21.0, imagen 20261004.327.1. Las dos de hoy son
de ANTES de que entrara `scripts/tuberia-bloqueante.mjs` (#2429, mergeado 07:47:56Z): lo de abajo
no dice nada de cómo se comporta la tanda con la tubería bloqueante.

- **Testigo de 1527b §② repetido** (`1527b/testigo-pg.mjs`, sin cambiar): 4 de 4 con el error de
  `scrum809` en el Postgres entre 2 y 3 min después del corte. Los posteriores siguen corriendo.
- **El TAP corta en el mismo sitio** (era un «no medido» de 1527 §④): artefacto `tanda-tap` del run
  38526531948, 2.025.480 B, sin NUL; su último caso es el `ok 7812` del mismo
  «el módulo no escribe NI UN texto de producto propio». Uno, no todos.
- **Huérfanos al cerrar el job:** 0 líneas «Terminate orphan process» en los 4. No separa nada: el
  vigía mata el grupo con SIGKILL antes, y no tengo un control positivo de que el runner las escriba.

## ② Lo que dice la fuente de node 24.21.0 (el paso 3 de §⑧)

Bajada de `nodejs/node` en las etiquetas v24.21.0 (CI) y v24.18.0 (esta máquina):

- `runTestFile` es **idéntica** en las dos (126 líneas). Espera `once(child, 'exit')` **y**
  `finished(child.stdout)`; el `stderr` no cuenta. 1527b §④ queda cotejado.
- El bloque de `--test-force-exit` del hijo (`test.js`, raíz) es idéntico: espera el `unpipe` de
  cada destino de reporter y llama a `process.exit()`.
- `FileTest.addToReport` (idéntico, 29 líneas): lo que llega de un hijo que no es el primero de la
  cola se mete en `#reportBuffer`; ese búfer sólo se vacía cuando **ese mismo hijo** manda otro
  mensaje siendo ya el primero, o cuando el fichero **completa** (`report()`).
- `kExecutionOrderedEvents` = `test:enqueue`, `test:dequeue`, `test:complete` (+ `test:log` en
  24.21): esos eventos van al reporter **sin pasar por la cola**. Es la base de la propuesta de ④.
- La única diferencia en el runner que toca la lectura de mensajes: `fullMessageSize` pasa a
  `>>> 0` (sin signo). Sólo cambia algo con mensajes de 2 GB o más.

**Medido en local** (Windows, node v24.18.0; `1527c/` es reproducible):

- Fichero `e` (un caso de 2 s) y `f` (caso rápido, caso de 6 s, caso rápido): `✔ f1` acaba en el
  segundo 0 y sale en el 6, junto con `f2` y `f3`, aunque `f` era el primero desde el segundo 2.
  **3 de 3.**
- Un fichero solo, caso rápido y caso de 3 s: el rápido sale en vivo, 3 s antes. Control: lo que
  retiene es la cola, no el reporter.

## ③ La cascada: por qué 8 de 15 deciden

Si un fichero completa y los siguientes ya estaban completos esperando turno, el padre los suelta
todos en el mismo tick. Así que, si la primera línea del último fichero entregado llega a una
fracción de milisegundo de la última del anterior, ese fichero no se imprimió en vivo: **estaba
COMPLETO**, y el que no completa es el siguiente. Lo contrario (que la soltara un mensaje propio
justo en ese instante) pide que su último mensaje caiga en esa misma décima de milisegundo, y en las
8 a la vez.

`1527c/frontera-final.mjs` y `1527c/cascada.mjs` sobre los 15 logs con aviso:

- **Cascada, 8:** hueco de **0,06 a 0,14 ms**. Ejemplo que no admite otra lectura: en 115305001172,
  tres casos de `scrum615-plazo` que duraron 5.266, 3.777 y 4.325 ms salen en los mismos 2 ms que
  los de `scrum615-pedir`; la ráfaga entera son 79 casos que sumaron 15.786 ms, impresos en 11,9 ms.
- **Sin separar, 7:** hueco de **47,86 ms a 10,8 s** (los tres de septiembre, el del 26-sep y tres
  del 6–7 oct). Ahí al último lo soltó su propio cierre o su propio último mensaje, y con lo que
  guarda el log no se distingue cuál.

No hay nada entre 0,14 y 47 ms: el umbral de 5 ms de `cascada.mjs` no decide ninguno. El detalle,
fichero a fichero, en `1527c/clasificados.json`.

| no completa (en las 8 decisivas) | veces | sitio |
|---|---|---|
| `scrum446-cabecera-modal` | 4 | 445–447 |
| `scrum447-byte-invisible-en-patrones` | 1 | 445–447 |
| `scrum616-que-guarda-la-factura` | 1 | 615–616 |
| `scrum615-plazo-con-null` | 2 | 615–616 |

**Lo que descarta:** que se cuelgue un fichero concreto por lo que hace. `scrum446` y `scrum447` sólo
leen con `fs` síncrono; `scrum616` importa tres módulos de `dist/`; `scrum615-plazo` hace un
`await import` de `dist/` y un censo de varios segundos. Cuatro ficheros sin nada en común, y en
el mismo sitio cambia cuál. Refuerza 1527 §③ (la causa no está en lo que comprueban) y retira la
pista de 1527b §④.

**Lo que NO descarta ni mide:** si el proceso del que no completa sigue vivo, si llegó a arrancar,
o si salió y el padre no se enteró (falta el `exit` o falta el fin de su `stdout`). Eso es justo lo
que pide el paso 1 de §⑧, y ahora sabemos a QUÉ fichero mirar.

## ④ Lo que no he podido ejecutar, y la decisión que hace falta

- **§⑧.1 (que el vigía escriba quién vive):** `scripts/tanda-con-veredicto.mjs` es de S5
  (`node scripts/carriles.mjs de …`), y el encargo prohíbe tocar guards y workflows. Además, en la
  rama de un PR no sirve: a 16 en ~2.130 jobs, harían falta cientos de pasadas para ver una.
- **§⑧.2 (bucle en Linux):** en esta máquina no hay WSL ni Docker (medido hoy otra vez), y
  `gh codespace` responde 403 sin el permiso `codespace`. Lanzarlo en CI pide un workflow.
- **Una segunda vía para §⑧.1 que no toca el vigía**, medida en local (5 de 5): un tercer reporter
  (`1527c/eventos.mjs`) que escriba `test:dequeue` y `test:complete` en el momento. Con un fichero
  que entrega su caso y no cierra (`b.mjs`) delante de otro que sí (`c.mjs`), escribe
  `complete FICHERO c.mjs` mientras `spec` sigue reteniendo `✔ c1`, y escribe `complete caso b1`
  sin `complete FICHERO b.mjs`. En CI diría, al cortar, qué ficheros arrancaron, cuáles acabaron
  sus casos y cuál no completó. **No dice** si el proceso gira o duerme: para eso sigue haciendo
  falta lo de §⑧.1.
  ⚠️ Si se lleva a CI, a un FICHERO y no a la salida estándar: los posteriores siguen corriendo
  (§②), sus eventos reiniciarían el reloj de silencio del vigía y el job llegaría a sus 25 min sin
  aviso.
- Las dos vías tocan carril de S5 (`.github/workflows/**` o el vigía). 1527 no tiene etiquetas en
  Jira: **dueño y carril los deciden el fundador con Luis.**

## ⑤ Lo que miré y no separa

| corte | resultado |
|---|---|
| diferencias del runner entre 24.18.0 y 24.21.0 | sólo `>>> 0` en el tamaño de mensaje, etiquetas, aislamiento `none` |
| huérfanos al cerrar el job | 0 en 4, sin control positivo |
| tasa en la ventana nueva | 4 de 131 jobs frente a 12 de ~2.000; con 4 casos no lo doy por tendencia |
| búsqueda web de un fallo conocido de node con `--test-force-exit` | nada que case |

## Errores míos en este tramo

- Antes de medir la cascada di por buena, en mi cabeza, la lectura de 1527b («el fichero común a
  las dos lecturas») y la extendí al sitio 615 con `scrum615-plazo` como culpable. La cascada la
  tumbó media hora después. No llegó a ningún texto, pero estuve a punto de escribirla como pista.
- Bajé el primer log sin `--allow-escape-sequences` y salió de 0 B; lo vi por el tamaño antes de
  leer nada.
- Un bucle de `grep` con la ruta sin comillas (la carpeta lleva un espacio) dio errores en vez de
  recuentos; repetido con comillas.

## Cómo se repite

    gh run list --workflow ci.yml --limit 500 --json databaseId,event,headBranch,headSha,status,conclusion,createdAt > todas.json
    # filtrar createdAt > 2026-10-13T10:32Z a runs.json; luego, en esa carpeta:
    node 1527b/pasos.mjs && node 1527b/pasos2.mjs          # candidatos (sin cambiar)
    gh api --allow-escape-sequences repos/lwislg99/cobroflash-backend/actions/jobs/<job>/logs > logs/<job>.log
    node 1527b/testigo-pg.mjs logs                         # ① el testigo
    node 1527c/cascada.mjs logs                            # ③ la última ráfaga
    node 1527c/frontera-final.mjs logs logs-viejos         # ③ el hueco que decide
    # ④ los de control viven como `.mjs.txt` (como `.mjs` registrarían tests que la tanda no corre: SCRUM-708)
    D=$(mktemp -d) && for f in a b c; do cp 1527c/$f.mjs.txt $D/$f.mjs; done && cp 1527c/eventos.mjs $D/ && cd $D && \
      node --test --test-reporter=spec --test-reporter-destination=stdout \
        --test-reporter=./eventos.mjs --test-reporter-destination=stdout a.mjs b.mjs c.mjs   # (corta con timeout: b no cierra)

---

# SCRUM-1527e · Desde #2429, 0 colgadas en 372 jobs; y la variante E (el mensaje partido) queda descartada como mecanismo en el node de CI

**Medido contra:** `origin/main` = `f4cac4820bf65d7cc737ed3a7672e423a7fc1547` · 2026-10-20T15:22:37Z (hora de lectura del fetch)

A9: comprobación → `docs/master/evidencias/SCRUM-1527/1527e/jobs-con-reintento.mjs`

J6 (sesión `jv-j6a`, equipo de Javier), por encargo del orquestador `cobroflash-backend-09`. Sólo
medición: no toca `src/`, `tests/`, `scripts/`, ningún workflow ni ningún tiempo de espera. El
ticket no se transiciona. **La causa NO está encontrada.**

## En corto

- **§⑧.1 (que el vigía escriba quién vive) y §⑧.2 (bucle en Linux) siguen SIN ejecutar.** El
  vigía es carril de S5 y este encargo prohíbe tocarlo; en esta máquina sigue sin haber WSL
  («no está instalado», medido hoy) ni Docker. Lo que sí he podido ejecutar está aquí abajo, y
  sólo separa una cosa: descarta un mecanismo.
- **Población:** 696 ejecuciones de `ci.yml` desde el 13-oct 04:00Z (GitHub declara 696), 545 jobs
  «build + tests» con reintentos. **Después de #2429 (14-oct 07:47:56Z): 372 jobs con paso «Tests»
  y 0 con «TANDA SIN VEREDICTO»**, 0 con el paso de 900 s o más (el más largo, 681 s), y 0 cuelgues
  escondidos en los 12 cancelados que podían esconder uno (②). Antes del corte, 5 de 160, los mismos de 1527d.
- **«Hoy ha vuelto a pasar» no lo encuentro.** La última ejecución de `ci.yml` es de las
  2026-10-20T11:32:31Z, y entre el 14-oct 07:29Z y esa hora no hay ninguna tanda con el aviso ni
  ningún paso de 900 s. Si el encargo se refería a un job concreto, ese job no está en esta
  población, o no es una colgada (por ejemplo, el rojo de `scrum1405c`, que sí tiene veredicto y es
  SCRUM-1405).
- **Esto NO prueba que #2429 lo haya curado** (③): ya hubo un hueco sin cuelgues más largo que este
  sin arreglo de por medio.
- **Descartado:** la variante E de SCRUM-1520 (el hijo sale con un mensaje partido y el padre se
  queda esperando) no puede ser la colgada de CI (④). En la versión de node de CI no cuelga
  (6 pasadas de 6), y donde sí cuelga (v24.8.0, 3 de 3) lo hace girando en el PADRE, que es justo lo
  contrario de lo que se ve en CI (1527b §②: los ficheros posteriores siguen corriendo).

## ① El recuento de 1527d, a más de 100 jobs

Lo pedía `SCRUM-1496.md:477` («recontar sobre más de 100 jobs»), y Luis lo dejó en 0 de 42
(c.19716). Instrumento de 1527d **sin cambiar**: `s3-reproduce-hoy.mjs 2026-10-13T04:00:00Z <carpeta>
2026-10-14T07:47:56Z --de-cache`. La primera pasada SIN caché murió a mitad: un HTTP 502 de GitHub en
la ejecución 39071288778, y el instrumento no reintenta ni escribe nada. La lista la hace ahora
`1527e/jobs-con-reintento.mjs`, con el mismo filtro y los mismos campos: reintenta cada consulta (hubo
3 con 502) y sale 2 si las ejecuciones leídas no son las que declara GitHub. El recuento sigue
siendo el de 1527d.

| tramo | jobs con paso «Tests» | con «TANDA SIN VEREDICTO» | paso de 900 s o más |
|---|---|---|---|
| antes de #2429 (13-oct 04:00Z → 14-oct 07:47:56Z) | 160 | **5** | 5 |
| después de #2429 (→ última ejecución, 20-oct 11:32:31Z) | **372** | **0** | 0 |

- **Control positivo:** el colgado conocido 115134364145 sale con su aviso.
- **Tamaño antes de contar:** 175 logs bajados (los candidatos de 600 s o más), el menor de 992.509
  B. Ninguno por debajo de 1.000 B y ningún CIEGO.
- **El corte de duración ya no es limpio, y no hace falta:** después de #2429 una tanda sana tarda
  590 s de mediana (p90 630, máximo 681), así que 167 de 372 son candidatos. Se leyeron todos.
  Ninguno lleva el aviso.
- Salida entera: `1527e/salida-recuento.txt`. Lista: `1527e/jobs.json`.

## ② El hueco del filtro: un cuelgue que se cancela antes de los 900 s

Lo declaraba Luis en c.19651: con el job a 25 min y tandas de ~600 s, un cuelgue podía acabar
`cancelled` y sin aviso. Además, cualquier push nuevo cancela el job de su rama. El filtro de 1527d
no ve ninguno de los dos.

`1527e/cancelados.mjs` lee los jobs cancelados después del corte con el paso «Tests» sin terminar
y de 300 s o más (**12**). Mide la cola: los segundos entre el último caso y la línea de
cancelación del runner. El silencio sano se mide en la misma población: el hueco más largo entre
dos casos en las **115** tandas enteras (`success`, 600 s o más) es de **102 s**.

- **Resultado:** las 12 colas van de 0 a 83 s. Ninguna pasa de 102 s.
- **Control positivo:** el mismo instrumento sobre el único colgado cancelado conocido (29-sep, job
  109503839889, 1527b §①) da **792 s** de cola, la cifra que midió 1527b por otra vía, y lo marca.
- **Lo que no ve:** un cuelgue cancelado menos de ~102 s después de empezar no se distingue de un
  silencio sano. Tampoco los cancelados de menos de 300 s (22 de los 35 con paso).
- Salida: `1527e/salida-cancelados.txt`, con la pasada del control al final.

## ③ Por qué 0 de 372 no es una cura

| tasa supuesta | de dónde | P(0 en 372) |
|---|---|---|
| 3,13 % (5/160) | la ventana de 1527d | 0,0007 % |
| 0,75 % (16/~2.130) | desde el 17-sep, 1527c | **6,05 %** |

La primera es la tasa de un racimo (1527c, y c.19651 lo avisa: cinco cuelgues en dos rachas de 34 y
20 min). La que no depende de dónde se corta es la segunda, y con ella sacar 0 sale una vez de cada
16. Y hay un dato que pesa más que la cuenta: **entre el 29-sep 16:22Z y el 6-oct 13:48Z no hubo
ningún cuelgue en 685 ejecuciones de `ci.yml`** (~536 jobs, a 545/696 jobs por ejecución), sin
ningún arreglo por medio. El silencio de ahora lleva **495 ejecuciones**: todavía es más corto que
uno que ya se acabó solo. Control de la consulta por rango: del 17-sep 13:54Z al 13-oct 10:32Z
devuelve 2.398 ejecuciones, y 1527b leyó 2.400 en esa ventana.

Con 0 de 372, la cota superior al 95 % de la tasa de ahora es del 0,80 %, y el 0,75 % de antes cabe
dentro. **El recuento no separa «#2429 lo curó» de «racha sin cuelgues».** Lo separará una ventana
más larga que la de 685 ejecuciones, o un cuelgue.

## ④ La variante E: por qué no es el mecanismo de la colgada de CI

La pista de c.19642 (Luis): en el banco de SCRUM-1520 (`la-cola-que-cae.mjs`), la variante E (el
informe del hijo se corta a mitad de un mensaje, y el hijo sale) cuelga al padre 2 de 2 con node
v24.8.0. En v24.18.0 no cuelga. La v24.21.0 de CI no estaba probada. Si E fuera el mecanismo, la
tubería bloqueante de #2429 (que impide justo ese corte) explicaría el 0 de ①.

**Medido, con los binarios oficiales** (zip de nodejs.org, sha256 cotejado con `SHASUMS256.txt`),
Windows 11, el banco sin cambiar:

| node | pasadas | E se cuelga | controles del banco |
|---|---|---|---|
| v24.21.0 (CI) | 6 | **0**: sale 1, «sólo se ve que cae el FICHERO» | 7 de 7 en las 6 |
| v24.8.0 | 3 | **3**: `ETIMEDOUT` a los 180 s | 7 de 7 en las 3 |

**Por qué, en la fuente** (`lib/internal/test_runner/runner.js` bajado por etiqueta):

- En v24.8.0, `#drainRawBuffer()` es `while (this.#rawBuffer.length > 0) this.#processRawBuffer();`.
  Con un mensaje partido, `#processRawBuffer` no consume nada y el bucle no termina. Es un bucle
  **síncrono dentro del padre**.
- Desde v24.18.0 hay una guarda: si una vuelta no cambia ni la longitud ni el tamaño del búfer,
  emite el primer byte como `test:stdout` y avanza (`prevBufferSize`, en la :392 de 24.18.0 y en la
  :412 de 24.20.0; v24.21.0 :420). **No está** en 24.10, 24.11, 24.12, 24.13, 24.14, 24.15, 24.16 ni
  24.17. **Está** en 24.18, 24.20 y 24.21. Las 16 colgadas medidas (1527b, 1527c) corrieron en 24.20.0 o 24.21.0.
- **Medido en el proceso colgado** (v24.8.0, pasada 2): el padre `node --test` pasa de 19,1 a
  24,25 s de CPU en 5 s (un núcleo entero) y no le queda ningún hijo de fichero vivo.

**Lo que descarta, por dos lados independientes:**

1. En la versión de CI, un mensaje partido no cuelga (6 de 6, y la guarda está en la fuente).
2. Aunque colgara, colgaría el PADRE girando, y un padre girando no lanza más ficheros. En CI se
   siguen lanzando: 1527b §② (11 de 11) y 1527c ① (4 de 4) ven a `scrum809` escribir en el Postgres
   minutos después del corte.

Consecuencia para ③: si el silencio de ahora fuera la cura, el mecanismo que cura #2429 **no es E**,
y sigue sin nombre. La tubería bloqueante cambia más cosas que el corte: por ejemplo, cómo escribe el
hijo mientras el padre no lee. Eso **no lo he medido**.

**Lo que no mide:** Linux. Pero lo que decide E es JavaScript del runner, y es el mismo en los dos
sistemas. Lo que sí depende del sistema es si el corte llega a ocurrir, y eso es SCRUM-1405, no esto.
Salida: `1527e/salida-banco-E.txt`. Huérfanos tras las 9 pasadas: 0 procesos del node bajado, con
la sonda probada en positivo (ve 5 `node.exe` del sistema).

## ⑤ Lo que miré y no separa

| corte | resultado |
|---|---|
| recuento después de #2429 | 0 de 372, pero dentro de lo que ya dio una racha sin arreglo (③) |
| cancelados después de #2429 | 0 de 12 con cola larga; ciego por debajo de ~102 s y de 300 s (②) |

## ⑥ Lo que falta, por orden de lo que más separa

1. **§⑧.1 de 1527b, sin cambios:** que el vigía escriba quién vive antes de matar. Sigue siendo lo
   único que contesta en el PRÓXIMO cuelgue. Es carril de S5 y el dueño lo decide el fundador con
   Luis (1527c ④). Con ③ hay un matiz: si #2429 lo hubiera curado, ese próximo cuelgue no llegará
   nunca, y el vigía no tendría nada que contar.
2. **Repetir ① cuando el silencio pase de ~700 ejecuciones** desde el 14-oct 07:47:56Z (al ritmo de
   esta semana, ~80 al día: hacia el 23-oct). Si sigue en 0, el silencio es más largo que cualquiera
   medido desde el 17-sep. Si aparece uno, es población nueva y la pregunta de ③ queda contestada.
   Las dos órdenes, abajo.
3. §⑧.2 (bucle en Linux), igual que antes: sin WSL ni Docker aquí, y en CI pide un workflow.

## Errores míos en este tramo

- Lancé el recuento grande SIN caché antes de saber que el instrumento muere con un 5xx, y perdí
  todas las consultas de esa pasada (no medí cuánto tardó). Lo hice después de dos canarios que salieron bien, pero un canario corto no
  da con un 502. La lista ahora la hace `jobs-con-reintento.mjs`, que reintenta y además comprueba
  el `total_count`.
- La primera versión de `cancelados.mjs` metía un job cancelado cuyo paso «Tests» había acabado en
  `success` (117751462298). No puede esconder un cuelgue. Lo cazó su propia línea CIEGO («sin línea
  de cancelación»), y el filtro ahora lo excluye.
- Un `sed` para quitar la ruta de mi máquina de `salida-banco-E.txt` estaba mal escrito y no cambió
  nada. Lo vi en el `grep` de comprobación de detrás y lo arreglé con el editor.
- El encargo decía que el registro tenía «DOS tramos»; tenía tres (1527c incluido). Lo leí entero
  antes de empezar.
- Repetí la cicatriz de J6 del 13-oct (SCRUM-1539): no me medí el contexto hasta antes de empujar, y
  ya iba por 229.284 (`usage` de mi jsonl), por encima del aviso de 200k.
- `scrum622` cae 2 de 12 en este árbol, que no tiene `dist/` (`ERR_MODULE_NOT_FOUND`). Cae igual
  con mis cambios guardados aparte, así que no es de este diff; su CENSO (el caso que cazó a 1527b)
  pasa con los dos `.mjs` nuevos dentro.

## Cómo se repite

    node docs/master/evidencias/SCRUM-1527/1527e/jobs-con-reintento.mjs 2026-10-13T04:00:00Z <carpeta>
    node docs/master/evidencias/SCRUM-1527/s3-reproduce-hoy.mjs 2026-10-13T04:00:00Z <carpeta> 2026-10-14T07:47:56Z --de-cache   # ①
    node docs/master/evidencias/SCRUM-1527/1527e/cancelados.mjs <carpeta>/jobs.json <carpeta> 2026-10-14T07:47:56Z 300          # ②
    gh api 'repos/lwislg99/cobroflash-backend/actions/workflows/ci.yml/runs?created=2026-09-29T16:22:00Z..2026-10-06T13:48:00Z&per_page=1' --jq .total_count   # ③
    # ④ con el node.exe del zip oficial de cada versión (v24.21.0 y v24.8.0), en una carpeta propia:
    <node-de-esa-version> docs/master/evidencias/SCRUM-1520/la-cola-que-cae.mjs    # la línea «E» del RESUMEN

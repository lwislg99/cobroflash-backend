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

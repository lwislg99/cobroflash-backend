# SCRUM-1335 · Los «ausentes» del trinquete de zona no son de la zona: son casos que no llegan

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:02:22Z
(J6 del equipo de Javier, sesión `jv-j6f`; encargo del orquestador `cobroflash-backend-5b`. Sólo lectura
de logs de CI: ni un test, guard, script ni workflow tocado.)

A9: sin fallo que generalice — entrega de sólo lectura; mis dos tropiezos (un log vacío y una extracción que dio 0) los delató el recuento al lado, y van contados en «Mis errores»

## En corto

1. **El job que pedía el ticket pasó.** Run nuevo, job `110207211633`, rama ya arreglada
   (`72e790ac`): verde, **9.402 pruebas en Kiritimati y 9.402 en Midway**, ninguna en repesca.
2. **Pero no es «un intermitente de un fichero».** En **114** jobs de zona medidos, **53 (46 %)**
   perdieron casos de algún fichero en alguna de las dos pasadas. Casi siempre el job sale verde
   igual, porque la repesca no lo confirma; sale **rojo** cuando la pérdida se repite también a solas.
   Los **7 rojos de hoy** de ese job son todos de esta forma, y **dos son de `main`**.
3. **No es la zona.** En los 7 rojos el cambio es siempre `pass ↔ ausente`, nunca `pass ↔ fail`, y va
   en las dos direcciones: 4 veces falta en Midway y 3 en Kiritimati.
4. **«19 en la tanda, 30 a solas» no son la misma magnitud.** 19 son los casos que faltaron en la
   pasada de Midway de la tanda. 30 son las claves que cambiaron entre las dos pasadas del fichero a
   solas, en cualquier dirección. El guion los imprime juntos («confirma 30 de 19»).
5. **Causa: NO demostrada.** No reproducido en local (0 de 120). La hipótesis y el experimento que la
   separaría están en §⑤; ninguno de los dos está hecho.

## ① El job del run nuevo

| | run viejo `36807859456` | run nuevo `36811462260` |
|---|---|---|
| job | `110196119194` | `110207211633` |
| cabeza | `ba86ead0` | `72e790ac` |
| resultado | rojo | **verde** |
| pruebas Kiritimati / Midway | 9.321 / 9.302 | 9.402 / 9.402 |
| ficheros en repesca (sin canarios ni la censada) | `vigia-atascados` «confirma 30 de 19» | ninguno |

9.321 − 9.302 = 19: los 19 «ausentes» son exactamente la diferencia de recuento entre las dos
pasadas. No hubo ninguna clave de más en Midway.

## ② La población: no es un fichero ni un día

Instrumento: `evidencias/SCRUM-1335/tabla.mjs` y `resumen.mjs`, sobre el log de cada job
«trinquete · ningún test nuevo mide la zona de la máquina».

Dos muestras: los **últimos 100 runs** de `ci.yml` al medir (30-sep 22:36Z → 1-oct 04:01Z) y **100
runs más antiguos** en cuatro páginas salteadas (22, 28 y 29-sep). Entre las dos, 137 jobs de zona:
21 cancelados, **116 no cancelados**, de los que **114** traen las dos pasadas medidas (los otros 2:
un log vacío y un job que cayó antes de medir).

| día | jobs medidos | con casos perdidos | rojos | Node |
|---|---|---|---|---|
| 22-sep | 18 | 9 | 1 | 24.20.0 y 24.21.0 |
| 28-sep | 16 | 4 | 0 | 24.21.0 |
| 29-sep | 11 | 5 | 0 | 24.21.0 |
| 30-sep | 11 | 5 | 0 | 24.21.0 |
| 1-oct | 58 | 30 | 7 | 24.21.0 |
| **total** | **114** | **53 (46 %)** | **8** | |

«Con casos perdidos» = algún fichero que no es canario ni censada entró en la repesca. El rojo del
22-sep (`a41c59f9`) lleva además un caso de `scrum980` confirmado 1 de 1, que puede ser otra cosa: no
lo cuento como de esta forma. Los 7 del 1-oct sí lo son (`direcciones.txt`).

**Ya pasaba el 22-sep y con Node 24.20.0**: no lo trajo la imagen del runner de esta semana ni un
commit de anoche.

Ficheros que salen, por número de jobs (de 53): `vigia-atascados` 21 · `scrum834` 13 · `scrum524b` 13 ·
`scrum237` 6 · `scrum853`, `scrum931`, `scrum649` y `scrum454` 4 cada uno · `scrum312` 3 · y ocho más
con 1 o 2. Son 17 ficheros distintos. La lista entera, con sus casos, en `resumen.txt`.

## ③ Dónde cae el hueco dentro del fichero

`orden.mjs` casa los nombres «ausentes» del log con el orden de los casos en el fuente.

| job | fichero | casos | ausentes | posición |
|---|---|---|---|---|
| `110196119194` | `vigia-atascados` | 64 | 19 | **36 a 54**: bloque seguido, en medio |
| `110185005492` | `vigia-atascados` | 64 | 22 | 43 a 64: la cola |
| `110186137556` | `vigia-atascados` | 64 | 6 | 59 a 64: la cola |
| `110186236745` | `scrum834` | 53 | 9 | 45 a 53: la cola |
| `110213649929` | `scrum834` | 53 | 11 | 43 a 53: la cola |
| `110195238163` | `scrum1262` | 6 por regex | 10 nombres | 5 de los 6 casados: casi el fichero entero |

Siempre un **bloque seguido**, nunca casos salteados. En 4 de 6 es la cola del fichero; en el del
ticket es un bloque intermedio, con los diez últimos casos presentes. `tests/vigia-atascados.test.mjs`
no lee reloj ni entorno y sus casos son síncronos: un caso que no se ejecuta en una zona y sí en la
otra no encaja con lo que hace el fichero. Lo que encaja es que el caso corrió y **su resultado no
llegó** a quien cuenta.

⚠️ Límite: la lista que imprime el job son sólo las claves **confirmadas** (las de la tanda que además
cambiaron a solas). En el job del ticket coinciden con las 19 de la tanda; en los demás puede haber
habido más ausentes en la tanda de los que salen aquí.

## ④ Por qué a veces es rojo, y qué dice «30 de 19»

Leído en `scripts/trinquete-de-zona.mjs` y `scripts/_trinquete-de-zona-hijo.mjs`:

- El hijo corre la tanda con `run({ files, forceExit: true, concurrency })` y guarda un veredicto por
  clave `fichero::nombre`. Una clave que está en una pasada y no en la otra vale `ausente`, y
  `cambianDeVeredicto` la trata como un cambio más.
- La repesca vuelve a medir cada fichero candidato **a solas** en las dos zonas y da por confirmada
  toda clave que **vuelva a cambiar**, sin mirar en qué dirección ni con qué veredicto.
- La línea que imprime es `confirma <cambios a solas> de <candidatos de la tanda>`: dos conjuntos
  distintos, sin cruzar. Por eso puede decir «30 de 19» o «37 de 22».

Así que el job sale rojo cuando el mismo fichero pierde casos **dos veces** —en la tanda y a solas— y
los huecos se solapan. Con `vigia-atascados` la pérdida se repitió a solas en 4 de los 21 jobs en que
salió.

**El trinquete entonces anuncia «hay pruebas que dependen de la zona» sobre algo que no lo es**, y
manda fijar la zona del test. No hay nada que fijar.

## ⑤ La causa: lo que NO sé

- **No reproducido en local.** `bucle.mjs`: el mismo hijo, el mismo fichero a solas, 60 pasadas por
  zona → 64 claves en las 120. Windows, Node 24.18.0. El CI es Linux con 24.20/24.21: este cero no
  descarta nada.
- 🔴 **Hipótesis mía, de IA, sin demostrar:** el resultado de cada caso viaja del proceso del
  fichero al de `run()` por una tubería, y con `forceExit: true` el proceso sale sin esperar a que
  se vacíe. Encaja con que casi siempre falte **la cola**. **No encaja** con el bloque intermedio del
  job del ticket. No he leído el código de Node que lo haría: es un recuerdo, no una medición.
- **El experimento que la separa** (no hecho; toca un workflow, así que pide GO y afecta a los dos
  equipos): rama desechable que corra `bucle.mjs` en el runner, unas 200 pasadas del fichero a solas,
  con `forceExit` puesto y quitado. Es la forma del experimento de SCRUM-1281.
- **Sin medir, y es lo que más importa:** si la tanda **obligatoria** (`build + tests`, que también
  fuerza la salida) pierde casos igual. Ahí un `pass` perdido sólo baja el recuento, y nadie compara
  el recuento entre runs.

## ⑥ Lo que propongo, sin construir

El guion y los workflows no son de este puesto; va al dueño por el orquestador.

1. **Que `ausente` deje de valer como veredicto de zona.** Un caso que pasa en una zona y no aparece
   en la otra, sin ningún `fail`, es una **medida incompleta**, no un hallazgo. Hoy se confirma con
   que vuelva a cambiar; debería exigir, al menos, el mismo veredicto en la misma zona.
2. **Que el job diga cuándo perdió casos**, aunque salga verde: hoy 45 de 53 jobs con pérdida
   salieron verdes y nadie lo vio.
3. **No** sacar ningún fichero de la tanda ni censar estos casos como dependientes de la zona
   (regla 41): no lo son.

## Mis errores

- La primera descarga de logs salió **vacía con salida 1** (`gh` se niega a escribir secuencias de
  escape sin `--allow-escape-sequences`). Lo dijo el recuento de bytes impreso al lado.
- Una extracción de nombres dio **«ausentes: 0»** en cinco jobs que tenían entre 6 y 22: el patrón
  miraba la línea equivocada. Lo delató que el cero contradecía al log.
- El `resumen.mjs` cuenta «8 rojos» de esta forma; uno (22-sep) no lo puedo afirmar y lo aparto en §②.

## Reproducir

    # ids y logs: gh api repos/<repo>/actions/workflows/ci.yml/runs → /runs/<id>/jobs → /jobs/<id>/logs
    node docs/master/evidencias/SCRUM-1335/tabla.mjs   <jobs.tsv> <carpeta de logs>
    node docs/master/evidencias/SCRUM-1335/resumen.mjs <jobs.tsv> <logs> <jobs2.tsv> <logs2>
    node docs/master/evidencias/SCRUM-1335/orden.mjs   tests/vigia-atascados.test.mjs <lista de ausentes>
    node docs/master/evidencias/SCRUM-1335/bucle.mjs   <raíz> tests/vigia-atascados.test.mjs 60 <carpeta temporal>

Los ids de los 137 jobs están en `jobs-ultimos-100-runs.tsv` y `jobs-muestra-antigua.tsv`. Los logs
(unos 6 MB) no se suben: GitHub los conserva y se bajan por id.

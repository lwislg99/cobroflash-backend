# SCRUM-1405 · `--test-force-exit` SÍ es la causa de los casos perdidos: el hijo sale con su informe a medio escribir

**Medido contra:** `origin/main` = `7779b0cbd473bc1a14e75308ce740ddc4e1e74cb` · 2026-10-02T05:55:42Z (J3c del equipo de Javier, sesión `jv-j3c`; es el commit sobre el que corrió el experimento, y la hora es la del run completo. Al escribir esto, a las 08:05:46Z de GitHub, `origin/main` iba por `5d7aaebc41d71d24102a4852c1de04059d9ac559`, 23 commits por delante; ninguno toca `package.json`, `scripts/` ni `.github/`.)

A9: aviso → cicatriz J3 «Añadí un contador a un instrumento con un parche pasado por un heredoc, la expresión perdió una barra y el contador dio 0 en 200 pasadas: un contador nuevo se prueba contra una entrada fabricada que tenga lo que cuenta, antes de lanzar el lote.» — no se pudo comprobar: es un guion de evidencias que corre fuera de la tanda; lo que queda es el control positivo que ahora lleva (un TAP fabricado con un rojo de fichero) y la repetición de las celdas afectadas

**El encargo** (orquestador `cobroflash-backend-5b`, 2-oct-2026): confirmar si el flag es la causa, con
el testigo dentro del test, decir qué tienen los 18 ficheros que pierden y qué cuesta quitarlo. **Este
ticket mide y propone. No toca `ci.yml`, ni el script `test` de `package.json`, ni nada de `area-s5`.**

## En corto

- **Sí, es el flag, y ya no es una correlación.** La tanda entera, sobre un árbol con rojos: con el
  flag **13 de 16** tandas pierden casos; sin él **0 de 16**. Si el flag no influyera, ese reparto
  saldría 1 vez de cada 620.310 (Fisher exacto, una cola). El del 1-oct eran 3 de cada 100.
- **Los casos que faltan SE EJECUTARON, todos.** En la cobaya con testigo: 53.433 casos ausentes en
  2.400 pasadas con el flag, los 53.433 con su línea de testigo, y siempre la cola. Sin el flag, 0 en 600.
- **El mecanismo, medido:** con el flag, el proceso de cada fichero hace `process.exit()` con bytes de
  su informe todavía sin escribir en la tubería hacia el padre. En Linux esa tubería no es bloqueante;
  node sólo la pone bloqueante en Windows. **Con la tubería bloqueante y el flag puesto: 0 de 12 tandas
  y 0 de 200 pasadas de cobaya pierden.**
- **Los 18 ficheros que pierden son los que más escriben.** Los 18 están entre los 46 primeros de 1.201
  por bytes escritos hacia el padre; los 6 primeros de la lista son de los 18.
- **El veredicto no se pierde, se pierde el nombre.** Con rojos en la cola, la tanda salió con 1 las
  52 veces. Cuando el caso rojo se pierde, el fichero entero sale en rojo por su ruta: 131 de 131.
- **Lo que el flag compra, también medido:** un test que cae antes de cerrar un servidor no termina
  nunca sin el flag (6 de 6), y con él sale con 1 (6 de 6). En verde, sin el flag ninguna de 18 tandas
  se colgó; la mediana fue de 486 s frente a 416 s.
- **No se elige salida.** Abajo van las tres del ticket con lo que cuesta cada una. Las tres cambian lo
  que ejecuta el obligatorio, así que las tres son del fundador.

## ⓪ La hipótesis, escrita ANTES de medir

Está en Jira, c.18036, a las 05:46Z, antes del primer run. Es de IA y entonces no estaba demostrada:

> El hijo de cada fichero manda sus eventos al padre por una tubería; en Linux esa tubería no es
> bloqueante (node sólo la pone bloqueante en Windows) y con el flag el hijo hace `process.exit()` sin
> esperar a que se vacíe lo encolado.

Con cuatro predicciones que la podían tumbar:

| # | predicción | qué salió |
|---|---|---|
| 1 | Los casos ausentes sí se ejecutaron | **Sí.** 53.433 de 53.433 (§②) |
| 2 | Pierden los que escriben mucho de un tirón sin soltar el bucle: «síncronos» sería el rasgo | **A medias.** Lo que decide es cuánto escribe el fichero, no que sea síncrono: la cobaya que suelta el bucle en cada caso pierde menos (18 y 40 de 100), pero pierde (§②, §③) |
| 3 | En la salida del hijo quedan bytes sin escribir justo en las pasadas que pierden | **Sí.** 195 de 195 pasadas con ausentes tenían bytes pendientes; ninguna perdió sin tenerlos (§②) |
| 4 | Con la tubería bloqueante no se pierde nada aun con el flag | **Sí.** 0 de 200 en la cobaya, 0 de 12 tandas enteras (§①, §②) |

## Dónde corrió, y con qué permiso

En un workflow nuevo y aparte (SCRUM-1339 c.17951 ①), que vive sólo en la rama `exp-1405-force-exit`.
La rama no empieza por `scrum-`: el bot no le abre PR. Se dispara sólo con un push a esa rama. No es
check de ningún PR, no es requerido y no entra en `main`. Es el camino de `exp-1384`, del equipo de
Luis. El disparador lo confirmó el orquestador por mensaje el 2-oct; consta en c.18036. La copia del
workflow completo está en `evidencias/SCRUM-1405/exp-1405.yml.txt`, por si la rama se borra.

GitHub `ubuntu-latest`, 4 hilos, node v24.21.0. El repositorio es público: los minutos no cuestan y
los logs los lee cualquiera. No llevan ningún secreto.

| run | commit de la rama | qué corrió |
|---|---|---|
| `36970275624` | `86b68f3a` | ensayo: una tanda por brazo, cobaya de 15 pasadas, reales de 4 |
| `36971139768` | `26d3280f` | **el completo:** 52 tandas en cinco brazos, cobaya de 100, reales de 30 |
| `36971399803` | `20c7a157` | sólo las celdas R y S de la cobaya (lo que el flag compra) |
| `36973388518` | `1d23a899` | sólo las celdas G, H y Q, repetidas con el contador arreglado (§Mis errores) |

Los cuatro runs salieron `success`: el paso de la tanda no falla nunca a propósito, guarda su código
de salida en un fichero. Ningún job murió ni se canceló.

## ① La tanda entera, con rojos sembrados (run `36971139768`)

El mismo comando que `npm test` sin repetir el build. Antes de lanzarla, cada runner siembra cinco
ficheros en su copia (`sembrar-rojos.mjs`): uno pequeño con un rojo, uno de 80 casos con testigo y el
rojo en el último, y copias de `scrum834`, `vigia-atascados` y `scrum524b` con un rojo añadido al
final. Los originales no se tocan. Eso da 8 rojos fijos: los 5 sembrados y 3 guards del árbol que los
ven (`SCRUM-812`, `SCRUM-824`, `SCRUM-838`).

| brazo | tandas | pierden, por recuento | pierden, por la señal de nombres | `# tests` | salida | segundos (mín–mediana–máx) |
|---|---|---|---|---|---|---|
| con el flag | 16 | **13** | 9 | de 10.223 a 10.302 | 1 las 16 | 317–416–489 |
| sin el flag | 16 | **0** | 0 | 10.302 las 16 | 1 las 16 | 302–486–516 |
| con el flag y tubería bloqueante | 12 | **0** | 0 | 10.302 las 12 | 1 las 12 | 281–360–483 |
| con el flag y sonda | 6 | 4 | 3 | de 10.220 a 10.302 | 1 las 6 | 289–462–476 |
| sin el flag y sonda | 2 | 0 | 0 | 10.302 las 2 | 1 las 2 | 487–487–492 |

- **Dos sondas que no comparten método.** «Por recuento» es `# tests` por debajo del máximo de las 52
  (10.302). «Por la señal» es la de 1339d, que nombra los casos y es un suelo: no ve los nombres
  construidos en bucle. Discrepan en 5 tandas (4 del brazo con el flag y 1 del de sonda), y en las 5
  la señal se queda corta, como estaba medido. Ninguna tanda con el recuento lleno tiene ausentes.
- **Si el flag no influyera:** 13 de 16 contra 0 de 16 saldría 1 vez de cada 620.310. Por la señal,
  9 de 16 contra 0 de 16, 1 de cada 2.452. El control del instrumento: sobre el 4 de 6 contra 0 de 6
  del 1-oct da 3,03 de cada 100, que es la cifra que dio J3a.
- **Tubería normal contra bloqueante, las dos con el flag:** 13 de 16 contra 0 de 12, 1 de cada 66.861.
- Faltan 363 casos por recuento en las 13 tandas del brazo con el flag.
- **Pierden los de siempre y dos nuevos.** `vigia-atascados`, `scrum1262`, `scrum454`, `scrum1323`,
  `scrum237`, `scrum286`, `scrum931` son de los 18. `scrum1344` (dos veces) y `scrum853` no lo eran:
  son el 10.º y el 7.º de la lista de los que más escriben (§③).

### El veredicto: los rojos

- **La salida fue 1 en las 52.** Ninguna tanda con rojos salió con 0, en ningún brazo.
- 44 de 52 tandas traen el mismo conjunto de 8 rojos. Las otras 8 son 6 del brazo con el flag y 2 del
  brazo con el flag y sonda. Sin el flag y con tubería bloqueante: 30 de 30 con los 8.
- **En esas 8, lo que falta es el caso rojo sembrado en una cola, y lo que aparece en su sitio es el
  fichero entero en rojo, por su ruta** (`not ok … tests/zz1405-….test.mjs`, `exitCode: 1`,
  `error: 'test failed'`). Tantos ficheros de más como casos de menos, en las 8.
- O sea: **se pierde qué caso cayó y con qué mensaje; no se pierde que el fichero cayó.** El código de
  salida del proceso del fichero llega aunque su informe no llegue.

### El testigo, dentro de la tanda

El fichero sembrado de 80 casos dejó sus 80 líneas de testigo en las 52 tandas. Con el flag, en 4 de
22 tandas el TAP trae menos de 80 (66, 69, 71 y 77): casos ejecutados y no informados. En los otros
tres brazos, 80 de 80 en las 30.

## ② La cobaya: un fichero, N pasadas, con el testigo dentro (run `36971139768`)

`cobaya.mjs` genera el fichero de test fuera del árbol y lo lanza con `node --test`. Cada caso escribe
una línea en un fichero testigo con una escritura síncrona antes de terminar. 100 pasadas por celda,
sin carga y con un proceso de carga por hilo. La cobaya «grande» son 80 casos síncronos que escriben
336 KB por fichero; va en 4 copias a la vez salvo donde se dice.

| celda | flag | sin carga: pierden | con carga: pierden |
|---|---|---|---|
| A · grande | con | **98** de 100 | **97** de 100 |
| B · grande | sin | **0** de 100 | **0** de 100 |
| C · grande, tubería bloqueante | con | **0** de 100 | **0** de 100 |
| D · grande, con sonda | con | 98 de 100 | 97 de 100 |
| K · grande, con sonda | sin | 0 de 100 | 0 de 100 |
| J · grande, una sola copia | con | 64 de 100 | 62 de 100 |
| E · grande, suelta el bucle en cada caso | con | 18 de 100 | 40 de 100 |
| F · pequeña (10 casos, 13,6 KB) | con | 0 de 100 | 0 de 100 |
| P · pequeña, con sonda | con | 0 de 100 | 0 de 100 |
| L · 80 casos, 98 KB | con | 99 de 100 | 96 de 100 |
| M · 80 casos, 118 KB | con | 99 de 100 | 96 de 100 |
| N · 80 casos, 159 KB | con | 98 de 100 | 93 de 100 |
| O · 80 casos, 219 KB | con | 89 de 100 | 94 de 100 |

- **«No se ejecutó» o «se ejecutó y no informó»: lo segundo, siempre.** En las celdas con el flag y
  tubería normal: 2.400 pasadas, 1.664 con casos ausentes, 53.433 casos ausentes, **53.433 con su
  línea de testigo y 0 sin ella**. Las 1.664 son la cola del fichero.
- **El testigo sabe decir las dos cosas** (c.17951, control ②). La celda I corta el proceso en el caso
  40 con `process.exit(0)`: en 200 pasadas, 8.000 ejecutados sin informe y 8.000 **no ejecutados**.
  Ninguna pasada salió ciega: el testigo nunca estuvo vacío.
- **Los bytes pendientes** (sonda, celdas D, L, M, N y O con las dos cargas): 195 pasadas de D con
  ausentes, las 195 con bytes sin escribir al salir; ninguna celda tiene una pasada con ausentes y sin
  pendientes. Lo pendiente nunca pasó de 65.506 B, que es lo que cabe en una tubería de Linux.
- **La dosis no es fina.** Entre 13,6 KB (0 de 400) y 98 KB (195 de 200) no hay celdas. Lo que cabe
  entero en la tubería no se pierde; por encima se pierde casi siempre.
- **Sin carga y con un solo fichero también se pierde** (J: 64 de 100). La carga no es condición.

### Seis ficheros reales, a solas y sin tocarlos (30 pasadas por celda)

| fichero | con el flag, sin carga | con el flag, con carga | sin el flag (60 pasadas) |
|---|---|---|---|
| `scrum834-puerta-avisador-rojo` (53 casos) | 23 de 30 | 23 de 30 | 0 |
| `vigia-atascados` (64) | 26 de 30 | 25 de 30 | 0 |
| `scrum524b-trinquete-de-la-tabla` (41) | 7 de 30 | 15 de 30 | 0 |
| `scrum1262-la-baja-corta-todas-las-vias` (35) | 6 de 30 | 8 de 30 | 0 |
| `scrum237-negacion-respaldada` (8) | 0 de 30 | 1 de 30 | 0 |
| `scrum1216b-numero-de-arranque` (9) | 0 de 30 | 0 de 30 | 0 |

Sin el flag: 360 pasadas, 0 por debajo de su máximo. `scrum1216b` no perdió ni murió en ninguna de
sus 120 pasadas en Linux. Su muerte medida en SCRUM-1332 es de Windows, y allí la causaba el propio
flag junto a `fetch` (7 de 40 con el flag, medido por J3e; 0 de 65 sin él, por J3d); se arregló
pidiendo con `node:http`.

## ③ Qué tienen los 18

La sonda (`sonda.mjs`) se carga con `--import` en cada proceso de fichero y apunta, al salir, cuántos
bytes ha escrito hacia el padre. Brazo con el flag y sonda, 6 tandas, 1.201 ficheros de `tests/` sin
contar los sembrados.

- Un fichero escribe 15.530 B de mediana. El percentil 99 son 54.943 B. Sólo 9 pasan de 65.536.
- **Los 18 de SCRUM-1339e están todos entre los 46 primeros.** 7 entre los 10 primeros, 14 entre los
  25 primeros, y los puestos 1 a 6 son suyos: `vigia-atascados` (109.622 B), `scrum834` (97.367),
  `scrum524b` (89.326), `scrum1262` (75.116), `scrum454` (73.775), `scrum1350` (71.655).
- Si fueran 18 ficheros cualesquiera, caer todos entre los 46 primeros pasaría 1 vez de cada 10^27.
  ⚠️ El 46 lo pone el peor de los 18, así que la cifra está elegida después de mirar; sirve para decir
  que no es azar, no como probabilidad exacta.
- **Lo que no tienen en común es lo que se buscaba por `grep`.** No es que sean síncronos, ni que
  abran nada: al salir no tienen nada vivo aparte de sus tuberías. Es que **declaran muchos casos** y
  cada caso son más de 1.200 B de informe (98.220 B los 80 casos de la celda L).
- Y predice: los dos ficheros que perdieron aquí sin ser de los 18 son el 7.º y el 10.º de la lista.

## El mecanismo, en el código de node que corría

`codigo-de-node.mjs` imprime los trozos del node del propio runner (v24.21.0; el local, v24.18.0,
dice lo mismo). Están en `evidencias/SCRUM-1405/ensayo-36970275624/codigo-de-node-en-el-runner.txt`.

1. `lib/internal/test_runner/runner.js`: el corredor le pasa `--test-force-exit` a cada hijo.
2. `lib/internal/test_runner/test.js`, la rama `this.config.forceExit`: cuando acaba el último test del
   fichero, espera a que cada destino de reportero emita `unpipe`, llama a su `close` si lo tiene, y
   hace `process.exit()`. En el hijo el destino es la salida estándar, que no tiene `close`: no espera
   a que lo ya aceptado se haya escrito.
3. `lib/net.js`: la tubería de la salida estándar se pone bloqueante sólo si `isWindows`. En Linux lo
   que no cabe se encola, y `process.exit()` lo tira.

Eso explica por qué J6f sacó 0 de 120 en Windows, por qué se pierde siempre la cola, y por qué pierden
los que más escriben.

**Está abierto en node:** `nodejs/node#64833`, «--test-force-exit with concurrency silently loses test
verdicts», abierta el 30-jul-2026, con dos PR de arreglo sin mergear. ⚠️ Leída el 2-oct por un resumen
de la página, no entera; no he comprobado en qué versión entraría el arreglo.

## ④ Qué cuesta quitarlo

**Lo que el flag compra.** `docs/QA/SUITE_REGRESION.md`, punto 2, lo dice desde julio: sin él, un
fichero que falla puede dejar el proceso colgado. Medido en la cobaya (run `36971399803`): un caso que
abre un servidor http y cae antes de cerrarlo.

| | sin carga | con carga |
|---|---|---|
| sin el flag | 3 de 3 no terminan (matadas a los 20 s) | 3 de 3 no terminan |
| con el flag | 3 de 3 salen con 1 | 3 de 3 salen con 1 |

**Cuántos ficheros no terminan solos hoy, en verde:** ninguno. 18 tandas sin el flag, las 18 llegaron
a su resumen con 10.302 casos. Con rojos que no dejan nada abierto, tampoco.

**Cuánto tarda:** mediana de 486 s sin el flag contra 416 s con él, 16 tandas por brazo. Los rangos se
solapan casi enteros (302–516 y 317–489). Por fichero, la sonda dice de dónde sale: 22 ficheros viven
más de 1 s más sin el flag y 5 más de 5 s (`scrum362`, `scrum1285`, `scrum448` y `scrum1249` unos 10 s
cada uno; `scrum444`, 5 s). La suma de las vidas sube 66,6 s, repartida entre los hilos.

**Qué corta el flag al salir.** Con el flag, 283 de 1.206 ficheros tienen algo vivo en el instante de
salir aparte de sus tuberías: operaciones de disco en curso en 180, un servidor TCP en 24, un
temporizador en 24, un socket en 18, un proceso hijo en 4. Sin el flag, 1. **Eso no son 283 ficheros
que no cierran:** sin el flag terminan todos; son cosas a medio cerrar cuando el flag corta.

**Lo que NO he medido:** cuántos ficheros reales se quedarían colgados si uno de sus tests cayera.
Habría que hacer caer cada test. Por texto, 67 ficheros de `tests/` abren un servidor en su propio
código y 9 de ellos no tienen `after`, `afterEach` ni `finally`; 207 importan un ayudante de banco,
servidor o arnés. Es un `grep`, no un censo por AST: dice el tamaño de la zona, no cuántos se cuelgan.

**Y un cuelgue hoy tiene tope.** `scripts/tanda-con-veredicto.mjs` mata la tanda a los 15 minutos de
silencio y sale con 3 (SCRUM-858). Leído, no ejecutado aquí. Sin el flag, un rojo de ésos dejaría de
ser un rojo con nombre en segundos y pasaría a ser «tanda sin veredicto» un cuarto de hora después.

## ⑤ Las tres salidas del ticket, con su coste. No se elige.

Las tres cambian lo que ejecuta `npm test`, y por tanto el obligatorio: **las tres son STOP y las
decide el fundador.** Aquí va lo medido de cada una.

**A · Quitar el flag y arreglar los que no cierran.**
- A favor, medido: 0 de 18 tandas pierden; 0 de 600 pasadas de cobaya; ninguna se colgó en verde.
- Coste medido: unos 70 s más de mediana por tanda, con rangos solapados.
- Coste no medido, y es el grande: un test que cae antes de cerrar lo que abrió cuelga la tanda hasta
  el tope de 15 minutos y pierde su nombre. La cobaya lo hace 6 de 6. Cuántos ficheros reales están
  expuestos no se sabe; la zona son 67 por texto.
- Toca: el script `test` de `package.json`, la línea de la carrera de tramos de `ci.yml`, `CLAUDE.md`,
  `docs/RUNBOOKS.md` y `docs/QA/SUITE_REGRESION.md`, que prescriben el flag.

**B · Quitarlo sólo del reportero TAP.**
- Tal como está escrita, **no existe**: la pérdida ocurre antes de cualquier reportero, entre el
  proceso del fichero y el corredor. Medido: en las 22 tandas con el flag, el reportero `spec` y el
  TAP traen exactamente los mismos casos del fichero testigo; discrepan en 0 de 52.
- Lo más parecido sería que el flag lo llevara el corredor y no sus hijos. `node --test` no lo ofrece:
  se lo pasa a cada hijo él mismo. Haría falta un corredor propio sobre `run()`. No lo he construido ni
  medido, y sería tocar el camino del obligatorio.

**C · Conservar el flag y esperar a que el informe se haya escrito.**
- Medido en su forma más simple: poner bloqueante la tubería de salida de cada hijo, que es lo que
  node ya hace en Windows. 0 de 12 tandas pierden, 0 de 200 pasadas de cobaya, los 8 rojos en las 12,
  salida 1, y no tarda más (360 s de mediana).
- Coste: se hizo con un módulo cargado por `--import` que llama a `process.stdout._handle.setBlocking`,
  una pieza interna de node que puede cambiar sin aviso. Se carga en todo proceso de node que lance la
  tanda, no sólo en los ficheros de test. 12 tandas y una mañana no son una garantía.
- Toca: `NODE_OPTIONS` del paso de tests de `ci.yml` o el script `test`. Y habría que decidir si
  `sonda.mjs` sale de `evidencias/` y pasa a ser código de la casa, con su test.
- Variante sin tocar nada: esperar al arreglo de node (`#64833`). Coste: no tiene fecha.

**Lo que ya hay y no depende de ninguna:** la señal de nombres de 1339d avisa en cada run, y esta
medición le da el porqué. Y una cosa que cambia cómo se lee el riesgo: **lo que se pierde en un verde
son informes de casos que corrieron; un caso que cae sigue dando rojo por el código de salida de su
fichero.** En esta medición ningún rojo se convirtió en verde.

## Lo que NO sé

- **Un árbol, una mañana, un tipo de runner, una versión de node.** El del 1-oct era otro árbol y
  otra tarde y dijo lo mismo; siguen siendo dos.
- El umbral exacto. `scrum237` y `scrum931` escriben menos de 64 KB y pierden a veces: la tubería no
  tiene que estar vacía cuando el fichero empieza su tirón final. No lo he medido.
- Por qué `scrum237` perdía el fichero entero en 1339e (4 veces) y aquí sólo la cola.
- Windows: no medido aquí. Lo que hay es el 0 de 120 de J6f y el código de node.
- Cuántos ficheros reales se colgarían al caer sin el flag (§④).
- Si la tubería bloqueante tiene efectos que 12 tandas no enseñan.
- El contenido entero de la incidencia de node y de sus PR.

## Mis errores

- **Un contador ciego.** Añadí a la cobaya el recuento de «rojos de fichero» con un parche pasado a
  `node` por un heredoc. La expresión perdió una barra (`d+` en vez de `\d+`) y el contador dio 0 en
  las 200 pasadas de la celda Q del run `36971139768`. Lo cazó que la tanda entera sí enseñaba el rojo
  de fichero y la cobaya decía 0. Arreglado, con un control positivo sobre un TAP fabricado, y las
  celdas G, H y Q repetidas en el run `36973388518`: 131 de 131. La trampa del heredoc estaba escrita
  en el traspaso de J3a y en la memoria; la repetí.
- **La predicción 2 era más estrecha que el mecanismo.** Dije «síncronos»; soltar el bucle no salva.
- **El primer resumen de los ficheros reales medía contra el máximo del brazo.** En el ensayo,
  `scrum834` con el flag perdió en sus 4 pasadas y el resumen decía «3 por debajo de su máximo (34)»,
  cuando el fichero tiene 53. Ahora el máximo es el del fichero, juntando sus dos brazos.
- La señal de nombres dio 9 de 16 y la di por buena un rato; el recuento decía 13. Van las dos.

## Lo que no está en git, y reproducir

Los 52 TAP y sus logs (203 MB) son artefactos del CI y caducan a los 7 días. En git está todo lo que
salió de ellos: `evidencias/SCRUM-1405/run-36971139768/` (`salida-analizar.txt`, `tandas.tsv`,
`rojos.tsv`, `sonda-por-fichero.tsv`, la señal de cada tanda en `senal/`, y las filas de la cobaya y de
los reales), más las carpetas de los otros tres runs.

    E=docs/master/evidencias/SCRUM-1405
    node $E/cobaya.mjs <carpeta de fuera, sin espacios> --pasadas 20          # en Linux; en Windows no pierde
    node $E/analizar.mjs <carpeta de fuera> 36971139768                       # baja los artefactos y saca las tablas
    node --no-deprecation $E/codigo-de-node.mjs                               # el código del node que tengas

Para repetir el experimento entero: un push a la rama `exp-1405-force-exit` con el workflow de
`exp-1405.yml.txt`. ⛔ Esa rama no se mergea a `main`.

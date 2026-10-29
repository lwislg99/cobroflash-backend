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

# APÉNDICE · 14-oct-2026 · SCRUM-1405c · La salida C, construida (J3f)

**Medido contra:** `origin/main` = `6c5b3ad61fcce65bcedaad61499afa0a97167e73` · 2026-10-14T07:35:41Z (J3f del equipo de Javier, sesión `jv-j3f`, lanzada por el orquestador `cobroflash-backend-2e`. La tanda local corrió sobre `540ff2d83`; el primer obligatorio, sobre la mezcla con `main` de las 07:19Z, y lo que entró después en `main` es sólo `docs/`, `tests/` de otros tickets y `scripts/_sin-fila-declarados.json`.)

A9: comprobación → `tests/scrum1405c-tuberia-bloqueante.test.mjs`

**La autorización, leída en Jira y no en el encargo:** SCRUM-1405 c.19584, 14-oct-2026, el fundador:
**«Ok la C»**. Autoriza conservar `--test-force-exit` y poner bloqueante la tubería de salida de cada
hijo, tocando `NODE_OPTIONS` del paso de tests de `ci.yml` **o** el script `test`. NO autoriza la A
(quitar el flag) ni la B. Cualquier otro cambio en `ci.yml` sigue siendo STOP.

## Qué se ha construido

| fichero | qué |
|---|---|
| `scripts/tuberia-bloqueante.mjs` | el módulo: si la salida estándar es una tubería, la pone bloqueante con `process.stdout._handle.setBlocking(true)`; si no puede, **lanza** |
| `package.json`, script `test` | `--import=./scripts/tuberia-bloqueante.mjs` detrás de `--test`. **`--test-force-exit` sigue** |
| `tests/scrum1405c-tuberia-bloqueante.test.mjs` | ① cableado · ② alcance · ③ la alarma de la pieza interna · ④ el rojo primero |
| `scripts/_sin-fila-declarados.json` | el bloque del módulo nuevo (SCRUM-1480f): sin fila en §3.3 hasta que la S0 se la dé |

**`ci.yml` no se toca.** Se eligió el script `test` y no `NODE_OPTIONS`: así lo cargan sólo el
corredor y sus hijos, no cada proceso de node del job (ni `npm run build`, ni lo que lance un test).
Y el CI corre `npm test`: el obligatorio lo hereda sin tocar el workflow.

## Las cuatro condiciones del encargo

**1 · El rojo primero.** ⚠️ **En esta máquina NO se puede ver.** Es Windows, y node ya pone ahí la
tubería bloqueante: la cobaya (4 copias de 80 casos, ~330 KB por fichero, con el flag) pierde **0 de
30 pasadas** sin el módulo, y 0 de 30 **también forzando `setBlocking(false)`**. No hay WSL ni Docker.
Así que el rojo se mide donde existe: el caso ④ corre la cobaya **en el mismo proceso, primero sin el
módulo y después con él**, 4 pasadas por brazo, y exige que sin él se pierda algo y con él nada. En
Windows se salta, y **no por la plataforma sino por una medición**: un hijo sin el módulo escribe 1 MiB
de un tirón a una tubería y dice cuánto le queda pendiente (aquí, 0).

🔴 **En Linux, el rojo SÍ se vio, y se fue**: primer obligatorio de este PR (#2429, run `38527348767`,
job `115731464284`, ubuntu, 07:21:57Z), dentro de la tanda y en el mismo proceso. **Sin el módulo, la
cobaya perdió en 4 de 4 pasadas** (faltaron 20, 30, 10 y 20 de 320 casos); **con el módulo, 0 de 4**
(320 de 320 las cuatro). Salida 0 en las ocho. Es una corrida: se suma a las 12 tandas y 200 pasadas
de §① y §②, no las sustituye.

Lo que sí se ha visto aquí: el camino del ④
forzado en Windows sale **CIEGO** (320 de 320 informados en los dos brazos), que es lo que tiene que
decir cuando no hay rojo que ver.

**2 · 🔴 La alarma si la pieza interna desaparece.** El módulo decide si la salida es una tubería por
API pública (`fs.fstatSync` e `instanceof net.Socket`; en Windows `fstat` de una tubería no dice nada,
medido, por eso van las dos) y **sólo después** pide la pieza interna. Si no está, o devuelve error,
lanza: el proceso no arranca y el fichero sale en rojo con «SCRUM-1405c · la salida estándar es una
tubería y este node ya no ofrece…». En una tanda eso tumba **todos** los ficheros: ruidoso. Además el
caso ③ ALARMA arranca un proceso con el módulo en cada tanda y cae si no puede.
Visto caer, con el defecto sembrado y no prestado del árbol:
- sin `setBlocking` → grita · sin `_handle` → grita · `setBlocking` devolviendo -22 → grita;
- control negativo: salida a fichero y sin la pieza → no grita (ahí node ya escribe síncrono).

Mutaciones del módulo y del script, las cuatro vistas en rojo y el árbol restaurado (`cmp`):

| mutación | qué cae |
|---|---|
| el módulo nunca actúa | ② y los cuatro de ③ que no son el negativo |
| sin la pieza devuelve en vez de lanzar | los dos sembrados de «sin la pieza» |
| el script `test` sin el `--import` | ① y ② |
| el script `test` sin `--test-force-exit` | ① |

**3 · `sonda.mjs` NO sale de `evidencias/`.** Decidido: la C sólo necesita poner la tubería
bloqueante, y eso es lo que se ha extraído, con su test. La sonda mide (bytes pendientes, recursos
vivos al salir) y escribe un fichero por proceso: cargarla en cada hijo de la tanda sería meter un
instrumento que nadie lee. Se queda como evidencia del experimento.

**4 · El alcance, declarado y MEDIDO (caso ②).** Lo cargan el proceso `node --test` y **cada hijo
que lanza por fichero** (el corredor les pasa su `execArgv`). **NO** lo cargan los procesos que un
test lance por su cuenta, ni el envoltorio `tanda-con-veredicto.mjs`, ni `npm run build`. Es **más
estrecho** que lo medido en §⑤, donde iba por `NODE_OPTIONS` y lo cargaba todo proceso: los hijos por
fichero, que son los que perdían, lo reciben igual; los nietos ya no. Si el alcance cambia, ② cae.
- Un `node --test` que un test lance dentro (`scrum928b`, `scrum858b`…) **sigue sin el módulo**.
- **Las tres copias del flag que nombró S3 en c.18373** (`scripts/meta-guard-mutaciones.mjs`,
  `scripts/_trinquete-de-zona-hijo.mjs`, `scripts/censo-guards-gateados.mjs`) **siguen perdiendo**:
  la autorización es para el script `test` o el `NODE_OPTIONS` del paso de tests, y no las cubre.

## La tanda completa, en local (Windows, node v24.18.0)

`node scripts/tanda-con-veredicto.mjs node --test --test-force-exit --import=./scripts/tuberia-bloqueante.mjs 'tests/*.test.mjs'`,
con `dist/` emitido con `tsc --noCheck`: **11.428 tests · 11.250 pasan · 26 caen · 152 saltan**,
salida 1, log de 1.442.231 B, **0 «TANDA SIN VEREDICTO»**.
- **3 de los 26 eran míos y están arreglados** en el código, no en los guards: `scrum702` (leía
  `process.platform`; ahora el ④ decide por una medición), `scrum864c` y `scrum824` (el temporal salía
  por una fábrica; ahora es `mkdtempSync(path.join(os.tmpdir(), …))` con `finally`).
- **Los otros 23 no dependen del módulo:** los 12 ficheros que los dan, corridos con y sin él, dan
  **los mismos 23 casos en rojo** (134 tests, 108 pasan, en los dos brazos). Son del worktree:
  `express` y el CLI de Prisma no están en su `node_modules`, y la ruta corta `JAVIER~1`.
- ⚠️ **No he repetido la tanda entera después de los tres arreglos.** Sí los cuatro ficheros
  implicados juntos: 31 tests, 0 caen.

## Lo que NO sé

- **Linux.** Que la C arregla la pérdida sigue siendo lo de §① y §② (12 tandas, 200 pasadas, una
  mañana) más lo que diga el ④ en el obligatorio de este PR. Una corrida más no es una garantía.
- Si los nietos de la tanda (un `node --test` dentro de un test) pierden: no lo he medido, y no los cubre.
- Una pasada accidental mía de la tanda entera sin el módulo dio 25 rojos y no 23, y no guardé los
  nombres (abajo). NO PUDE MIRAR qué eran los 2 de más.

## Mis errores

- **Repetí la cicatriz de J3 del 2-oct, en el mismo ticket.** La expresión de la sonda del ④ pasó por
  un heredoc y perdió la barra (`(d+)` en vez de `(\d+)`). Lo cazó el propio test: la sonda sin
  respuesta sale «NO PUDE MIRAR» en vez de saltarse el caso. La cicatriz estaba escrita y no lo
  impidió; lo paró que el `null` del instrumento es rojo.
- **El primer módulo sólo miraba `fstat`**, y en Windows `fstat` de una tubería da los cuatro `is*` en
  `false`: habría hecho NADA en silencio. Lo vi midiéndolo antes de usarlo. Ahora mira también el objeto.
- **Mi primera cobaya pasaba el mismo fichero cuatro veces**; node lo cuenta una, y los tres brazos
  «perdían» 240 casos. Lo delató que los tres brazos daban lo mismo.
- **Corrí la tanda local sobre la base vieja, no sobre la mezcla.** El primer obligatorio cayó con UN
  rojo, mío: `scrum1480f` (un fichero nuevo de `scripts/` sin fila en `dos-equipos.md` §3.3), un guard
  que mi base no tenía. Tanda de 11.435 tests, 11.345 pasan, 1 cae, 0 «TANDA SIN VEREDICTO», log de
  1.861.023 B. Arreglado por la salida que el propio guard da al equipo de Javier: declarado en
  `scripts/_sin-fila-declarados.json` con su ticket; la S0 le da fila. Por eso hay dos empujones y
  no uno. «CI prueba el MERGE, no la rama» (A10) ya estaba escrito.
- **Mi comparación de los rojos ajenos corrió la tanda entera sin querer:** un `sed` falló, la lista
  quedó vacía, y `node --test` sin ficheros lo corre todo. La repetí con un guion que se niega a correr
  con la lista vacía.
---

## Tramo de J6j · 14-oct-2026 · el testigo dentro de UN fichero real (`scrum834`)

**Medido contra:** `origin/main` = `11ca1e05f2e211a0a4eddf8941eaf738c6df98e5` · 2026-10-14T06:55:57Z (sesión `jv-j6j`, equipo de Javier, por encargo del orquestador `cobroflash-backend-2e`. Es la base de la rama del experimento y la hora es la del arranque del run `38525138304`. Al escribir esto `origin/main` iba por `76c29b57c871584b04c8206c11571f9c56c9d699`, que no toca ni `tests/scrum834-*` ni `scripts/puerta-avisador-rojo.mjs`.)

A9: aviso → cicatriz J6 «Parcheé mi propio guion con un script de node pasado por un heredoc que calculaba las posiciones antes de sustituir, y dejó el fichero roto» — no se pudo comprobar: lo cazó node al no compilar, pero un parche que compile y caiga en el sitio equivocado no lo caza nadie

**El hueco que cierra.** Lo de arriba decía «los casos que faltan SE EJECUTARON» con el testigo en una
cobaya fabricada; los seis ficheros reales se midieron sin tocar, por `# tests`. Para ellos, «se
ejecutaron» salía del mecanismo, no de un testigo suyo. Aquí UNO real lleva el testigo dentro.

**Respuesta: sí, en `scrum834`, todos.** 400 pasadas con el flag y el testigo: 310 con casos ausentes,
**5.460 casos ausentes, los 5.460 con su testigo de «empecé», 0 sin él**, siempre la cola. Sin el flag:
400 pasadas y 0 ausentes. Ninguna pasada salió ciega.

### Cómo

- **El testigo.** En la copia desechable del runner cambia UNA línea del fichero real, la del
  `import test from 'node:test'`, por un envoltorio de `test` en una sola línea (no se mueve ninguna
  otra): apunta `DECLARADO <nombre>` al declarar el caso e `INICIO <nombre>` al entrar en su cuerpo, con
  `appendFileSync` a un fichero aparte. **No escribe ni un byte en la tubería cuya pérdida se mide.** El
  fichero se restaura al acabar, con su sha256 comprobado (IGUAL en las dos pasadas del run), y el paso
  final del job comprueba `git status` vacío. En `main` y en la rama de entrega, `tests/` no cambia.
- **Por nombre, no por recuento.** Ausente es lo declarado según el testigo que no sale en el TAP de
  primer nivel. 53 declarados en las 800 pasadas con testigo, los mismos que las 53 líneas `test(` del
  texto. Los casos que sí informan casan nombre a nombre con su testigo: 0 informados sin testigo.
- **Dónde corrió.** Un workflow nuevo y aparte (SCRUM-1339 c.17951 ①) que sólo existe en la rama
  `exp-1405-testigo-en-fichero-real`: se dispara con un push a esa rama, no es check de ningún PR y no se
  mergea. Copia en `evidencias/SCRUM-1405/exp-1405-j6j.yml.txt`. GitHub `ubuntu-latest`, 4 hilos, node
  v24.21.0. No toca `ci.yml`, ni el script `test`, ni `--test-force-exit`, ni nada de `area-s5`.

### Los controles, antes de medir el real (los mismos `instrumentar()` y analizador)

| control | qué es | qué dio (10 pasadas cada uno, 5 con el flag y 5 sin él, en el run y en local) |
|---|---|---|
| presente | 10 casos verdes | 0 ausentes, 10 con testigo |
| corte | 10 casos, el 5.º hace `process.exit(0)` | 10 ausentes por pasada: 5 CON testigo (empezaron) y **5 SIN testigo (los 6 a 10, no corrieron)** |
| ciego | el mismo fichero instrumentado sin decirle dónde apuntar | la pasada sale **CIEGA**, no «0 sin testigo» |
| lector | un TAP fabricado con `#` y `\` escapados y un `# SKIP` | lo lee bien |

El testigo dice las dos cosas: en el corte salen 50 «se ejecutó y no informó» y 50 «no se ejecutó».
Si algún control falla, el guion sale con 1 y no mide el real.

### El real, run `38525138304` (200 pasadas por brazo, los tres brazos intercalados)

| brazo | carga | pasadas | con ausentes | casos ausentes | con testigo | **sin testigo** | salida |
|---|---|---|---|---|---|---|---|
| con el flag, con testigo | 0 | 200 | 148 | 2.790 | 2.790 | **0** | 0 las 200 |
| con el flag, con testigo | 4 | 200 | 162 | 2.670 | 2.670 | **0** | 0 las 200 |
| sin el flag, con testigo | 0 | 200 | 0 | 0 | – | 0 | 0 las 200 |
| sin el flag, con testigo | 4 | 200 | 0 | 0 | – | 0 | 0 las 200 |
| con el flag, **sin tocar** | 0 | 200 | 170 (por `# tests`) | 2.845 | sin testigo: no se puede juzgar | – | 0 las 200 |
| con el flag, **sin tocar** | 4 | 200 | 160 (por `# tests`) | 2.363 | sin testigo: no se puede juzgar | – | 0 las 200 |

- **El testigo no se come su objeto** (la objeción de c.17951): el fichero instrumentado pierde en
  148 y 162 de 200, el mismo fichero sin tocar en 170 y 160, en las mismas máquinas e intercalados. No lo
  he contrastado con una prueba estadística; la diferencia sin carga va en la dirección de «pierde algo
  menos», y el veredicto no depende de ella.
- El primer caso ausente cae entre el 15.º y el 53.º; la forma es «cola» en las 310.
- **La salida fue 0 en las 1.200 pasadas**, también en las que perdieron casos: en verde la pérdida no
  deja ningún rastro en el código de salida. Es lo que ya decía el registro (sólo un rojo lo deja).

### Lo que NO dice

- **Es UN fichero de 18.** Para los otros 17, «se ejecutaron» sigue saliendo del mecanismo y de la
  cobaya, no de un testigo suyo. Lo que cambia es que la afirmación ya tiene un fichero real medido
  detrás, y en él no hay excepción en 5.460.
- El testigo dice «empecé», no «terminé en verde». Que los ausentes pasaran no lo dice el testigo: lo
  dice que la salida fue 0 (un rojo da salida 1, 131 de 131 arriba).
- Un tipo de runner, una mañana y una versión de node, como arriba. Windows no pierde (5 pasadas en
  local con los tres brazos: 0 ausentes); allí el testigo no tiene nada que contar.
- `scrum834` lo ejecuta este guion a solas, no dentro de la tanda.

**Evidencias:** `evidencias/SCRUM-1405/j6j-testigo-real.mjs` (el guion) y `j6j-run-38525138304/`
(las dos salidas, `controles.tsv`, `real-pasadas-carga{0,4}.tsv` con una fila por pasada, y
`real-ausentes-sin-testigo-carga{0,4}.tsv`, que sólo traen la cabecera porque no hay ninguno). Para
repetirlo: `node $E/j6j-testigo-real.mjs <carpeta de fuera> --en-sitio --pasadas 200` desde la raíz de
una copia DESECHABLE, en Linux. ⛔ La rama `exp-1405-testigo-en-fichero-real` no se mergea a `main`.

**Mis errores.** Parcheé mi propio guion con un script de node pasado por un heredoc que buscaba las
posiciones antes de sustituir: el fichero quedó roto y lo cazó node al no compilar. La trampa del
heredoc estaba en la memoria; la repetí. Lo arreglé con el editor y volví a pasar los controles.

# APÉNDICE · 21-oct-2026 · SCRUM-1405d · El caso ④ afirma la pérdida MEDIDA, no cero (J3n)

**Medido contra:** `origin/main` = `fe65a8b7fca8b1e42448c8134e26d880d96b9ba7` · 2026-10-21T12:16:04Z (sesión `jv-j3n`, equipo de Javier, por encargo del orquestador `cobroflash-backend-5f`. `scripts/tuberia-bloqueante.mjs` y el caso ④ no cambian en `main` desde `f13e8664a`: el código medido es el mismo en toda la ventana.)

A9: comprobación → `tests/scrum1405c-tuberia-bloqueante.test.mjs`

**Decisión:** SCRUM-1405 c.20140, el fundador, 21-oct-2026: «Ok vamos con la B». Que el test afirme lo que el código logra, con su cifra y su fecha; ni perseguir el cero (A) ni dejar de bloquear (C).

## La medición

Población: los **497** runs de `ci.yml` creados entre el merge de #2429 (14-oct 07:59Z) y el 20-oct 15:35Z. 134 sin el job obligatorio, 47 cancelados, 0 en curso, **316 con veredicto**, 316 logs bajados (de 1.856.720 a 1.989.518 B; ninguno corto). De esos 316, **302** traen las dos listas de ④ (264 en verde, 38 en rojo) y **14 lo saltaron** (abajo). A diferencia de SCRUM-1428 (§26.1 de `para-javier.md`), se bajan **también los verdes**: contar sólo los logs rojos es contar sólo los jobs en los que el módulo perdió.

| | CON el módulo | SIN el módulo |
|---|---|---|
| pasadas que pierden | **41 de 1.208 (3,4 %)** | 1.196 de 1.208 (99,0 %) |
| ↳ 1.ª mitad / 2.ª mitad (151 jobs cada una) | 20 de 604 (3,3 %) / 21 de 604 (3,5 %) | 600 / 596 de 604 |
| máximo que pierde una pasada (de 320) | **15** (15 en cada mitad) | 52 |
| pasadas que pierden en un mismo job | 0 en 264 · 1 en 35 · **2 en 3** · nunca 3 ni 4 | 3 en 12 · 4 en 290 · nunca 2 o menos |
| jobs con el total CON < total SIN | 302 de 302 | |

Por día, las pasadas CON que pierden van del 1,4 % al 4,2 % con 18 a 71 jobs por día; las dos cifras que el test afirma (15 y 2) son las mismas en las dos mitades. La §26.1 decía «con el módulo pierde exactamente 1 pasada de cada 4»: era la cifra de los 10 logs ROJOS, no del módulo. Sobre todos los jobs es 1 de cada 29.

## Qué afirma ahora el caso ④

- Sin cambios: el brazo SIN módulo tiene que perder (si no, CIEGO) y toda pasada sale con 0.
- El brazo CON módulo: **ninguna pasada pierde más de 15 de 320, y no pierden más de 2 de las 4 pasadas**. Las dos cifras están en `CON_MAX_POR_PASADA` y `CON_MAX_PASADAS_QUE_PIERDEN`, con la población y la fecha en el comentario de al lado. El título ya no dice «con él, ninguno».
- Caso nuevo, «④ el juez», que corre en TODA tanda (también en Windows, donde ④ se salta): las tres peores filas reales CON módulo pasan; el brazo SIN módulo de dos jobs reales cae — entre ellos `0,10,8,7` (job `117751198316`), el único de 302 cuyas cuatro pasadas SIN módulo quedan en 15 o menos, que cae por la segunda cifra —; y los bordes, derivados de las constantes, caen uno por encima.

**Visto en rojo.** Las cuatro mutaciones del juez van declaradas en el propio test (`MUTACIONES_QUE_ME_TUMBAN`), así que el meta-guard las repite en cada PR: sin el tope de pasadas, el tope por pasada a 52, vuelta al «ninguno» y un juez que no mira nada. Las cuatro anclas salen inequívocas con `ambiguedadDelAncla` del propio meta-guard. Aplicadas como las aplica él (`replace(de, a)`, banco fuera del árbol, salida en `j3n-1405d/mutar-salida.txt`): la base sin mutar da 9 tests, 8 pasan, 0 caen, 1 saltado; con cada una de las cuatro cae «④ el juez» (7 pasan, 1 cae), y el fichero queda restaurado byte a byte.

## Lo que NO dice, y lo que no he medido

- **El test deja de caer a diario, pero no es imposible que caiga.** Con 3,4 % por pasada y pasadas independientes, que pierdan 3 de 4 sale una vez de cada ~6.600 jobs (calculado, no medido); que una pasada pierda 16 o más no ha pasado en 1.208, lo que no dice que no pueda pasar. Si cae, se mide otra vez: no se sube la cifra.
- **Por qué el máximo es 15:** sin medir. Encaja con que 15 informes de ~4 KB son lo que cabe en una tubería de 64 KiB, pero es hipótesis.
- **La mutación de verdad (el módulo sin efecto, en Linux) no la he corrido:** no hay Linux en esta máquina y la ficha prohíbe un workflow nuevo. Lo que hace sus veces es el brazo SIN módulo de los jobs reales, que el juez tumba en 302 de 302 por la segunda cifra.
- **Una constante subida a mano no la caza ningún caso:** los bordes salen de la constante. Lo que la protege es la regla 41 y este registro.
- **De paso, sin arreglar:** en **14 de los 316** jobs de Linux el caso ④ **se saltó** — la sonda de 1 MiB dijo «0 bytes pendientes» y el caso se declaró en una máquina bloqueante. Esos 14 jobs no midieron nada y salieron en verde. Es del mismo fichero y del mismo carril; no lo he tocado porque cambia cuándo corre ④ y no es lo que se decidió en c.20140.

## Mis errores

- Pasé un `node -e` por bash para calibrar el lector y bash se comió la barra de un `replace(/\\/g…)` (y el heredoc de este mismo registro se comió otra al escribir esta línea; corregida con el editor): la tercera vez en este ticket (cicatrices de J3 del 2 y del 14-oct). Lo cazó que no compiló; lo rehíce como un modo `--log` del propio guion.
- El primer listado de los 14 saltados salía con `undefined` en la columna del obligatorio (leía `ob` y la columna se llama `obligatorio`). Corregido en `analiza-4.mjs` y la salida regenerada.
- Subí primero mi banco de mutación (`mutar.mjs`) a evidencias con su lista propia, y `scrum1387` (y con él `guards:entrada` de `scrum976`) lo tumbó en la mini-tanda: un banco nuevo tiene que usar el catálogo del meta-guard. Las mutaciones pasaron al test y el banco salió del árbol. La primera versión de las anclas, además, era ambigua (sin la sangría, y una citada dos veces); lo dijo `ambiguedadDelAncla`, no yo.
- El encargo pedía el registro en `docs/master/SCRUM-1405d.md`. En `docs/master/` hay 0 ficheros con sufijo de letra y A8 dice que se anexa sección al del número: va aquí.

## Reproducir

`E=docs/master/evidencias/SCRUM-1405/j3n-1405d` · `node $E/censo-4.mjs 2026-10-14T07:48:00Z <carpeta de logs FUERA del árbol> censo.tsv` (con `gh` autenticado; antes corre sus 4 controles fabricados y se para si uno falla; calibrado contra el log del job `117734088229`, que da `14,10,27,31` / `0,0,11,0` como la §24) · `node $E/analiza-4.mjs $E/censo.tsv` · las mutaciones, con `npm run meta:mutaciones`.

# APÉNDICE · 27-oct-2026 · SCRUM-1405f · ¿Se ha vuelto a saltar ④ desde que entró SCRUM-1574? (J3, solo medir)

**Medido contra:** `origin/main` = `ce1111a68d00d2063bc6bb369ce71d2124c3547f` · 2026-10-27T15:38:52Z (sesión `jv-j3bw`, equipo de Javier, por encargo del orquestador `cobroflash-backend-8b`. La ventana medida va del merge de #2638, `b10c9b6ca`, 21-oct 13:18:39Z, al último run listado, 27-oct 15:27:49Z; el censo corrió de 15:30:19Z a 15:38:17Z. `decidirCuarto` y el caso ④ no cambian en `main` en toda la ventana.)

A9: sin fallo que generalice — el único tropiezo fue un 502 de GitHub que tumbó la primera pasada del censo; salió con código 1 y sin tabla, no con un verde, y el guion ya reintenta.

**Decisión que lo pide:** SCRUM-1405 c.21058, el fundador, 27-oct: se ratifica `decidirCuarto` (SCRUM-1574) y, antes de cerrar, se mide en cuántos obligatorios desde `b10c9b6ca` ha corrido ④ y en cuántos se ha saltado, con el motivo literal. «Si no se salta sin motivo, 1405 se cierra.»

## La medición

Población: los **687** runs de `ci.yml` creados en la ventana (409 `pull_request`, 278 `push`). 208 no tienen el job obligatorio, 36 lo tienen cancelado, 2 seguían en curso al listar, **441 con veredicto** (373 success, 68 failure). Se bajaron los 441 logs, verdes incluidos (de 64.576 a 2.250.760 B; mediana 2.061.481). Tabla por job: `evidencias/SCRUM-1405/j3bw-1405f/censo.tsv`.

| ④ en el job obligatorio | jobs | push | PR |
|---|---|---|---|
| **corrió y pasó** | **440** | 72 | 368 |
| corrió y cayó | 0 | | |
| **se saltó** | **0** | | |
| sin veredicto de ④ (CIEGO) | 1 | | 1 |
| **total** | **441 de 441** | | |

- **Saltos: 0.** Ni con el motivo de `decidirCuarto` («NO MEDIDO: …») ni con otro, ni sin motivo. El motivo viejo de antes de 1574 tampoco aparece.
- **El CIEGO** es el job `121899227131` (`scrum-1446g-tramos-mayor-resto`, 26-oct 22:56Z): log de 64.576 B, la tanda no llegó a correr porque `tsc` no compiló (`error TS2345` en `pdf.service.ts`). No dice nada de ④.
- **Lo que 1574 cambió, visto en el CI:** en **27** de los 440 la sonda dejó **0 bytes** pendientes — antes de 1574 esos 27 se habrían saltado como los 14 de 1405d —; en los 27 el brazo SIN módulo perdió, así que `decidirCuarto` dio «medir» y ④ juzgó el brazo CON. En los otros 413 la sonda dejó 1.048.576 B.
- **Resumen de la tanda:** en 439 de los 441 `tests = pass + fail + skipped + cancelled + todo` cuadra. Los dos que no tienen resumen: el CIEGO de arriba y el job `119769715166` (`scrum-962c-editor-presupuestos-44`, 22-oct), una tanda con «TANDA SIN VEREDICTO» y 1.409.303 B — colgada —, en la que ④ sí corrió y pasó antes del corte.
- **El brazo SIN módulo perdió en los 440** (la condición de «medir» se cumple en todos).

## De paso, sin tocar: el brazo CON pierde más que cuando se midió la cifra

Sobre los 440, el brazo CON módulo da **1.760 pasadas, 137 pierden (7,8 %)**; en 1405d eran 41 de 1.208 (3,4 %). El máximo por pasada es **15**, justo el tope (`CON_MAX_POR_PASADA`); pierden 2 pasadas en **14** jobs (en 1405d, 3 de 302), y nunca 3. Ninguna pasada pasó de los topes, así que ④ no cayó ni una vez. ⚠️ **Sin medir por qué** ha subido; no es lo que pide c.21058 y no lo he tocado. Si la tendencia sigue, ④ va a empezar a caer por el tope de pasadas, y la regla 41 dice que entonces se mide otra vez, no se ensancha.

## El instrumento, interrogado

- **No reusé `j3n-1405d/censo-4.mjs` tal cual:** su `leer` busca el mensaje de rojo de 1405c («SIGUE perdiendo casos»), que 1405d cambió; no copia el motivo de un salto; y un log vacío le sale «ausente». `censo-f.mjs` copia su forma (población, bajar también los verdes) y cambia el lector.
- **Anclado al inicio del caso** (`✔`/`✖`/`﹣` tras la hora del runner y el nombre exacto de ④): el símbolo dentro del nombre de otro test no cuenta (control ⑤).
- **Siete controles fabricados** que tienen que salir antes de bajar nada: pasa · salto con el motivo literal de `decidirCuarto` · salto con un motivo viejo · cae por CIEGO · el símbolo dentro de otro nombre · **log vacío → CIEGO** · resumen que no suma.
- **El motivo literal se deriva del test, no se teclea:** se sacó `decidirCuarto` del fichero real (sin tocarlo) y su motivo casa con la expresión del censo; el de CIEGO no casa (control negativo).
- **Positivo en cada log:** el caso «③ ALARMA», del mismo fichero y anterior a ④, tiene que estar. Quitado a mano de un log real, el lector dice CIEGO, no «corrió». Estuvo en 440 de 441 (el que falta es el CIEGO).
- ⚠️ **Lo que lee es el `spec` del log del job, no el TAP:** el TAP del obligatorio va a un fichero del runner que no sale en el log. El `spec` imprime el `# motivo` de cada salto, que es lo que se pide.

## 1405 cerrable

**1405 cerrable: sí, porque** en los 441 obligatorios con veredicto desde `b10c9b6ca` ④ se saltó **0 veces** (ni sin motivo ni con un motivo que `decidirCuarto` no produce), corrió en 440, y el único sin veredicto es un job cuyo build no compiló. Queda abierto, para quien cierre, el aviso de arriba: el brazo CON pierde el doble que el 21-oct y roza los dos topes.

## Reproducir

`E=docs/master/evidencias/SCRUM-1405/j3bw-1405f` · `node $E/censo-f.mjs 2026-10-21T13:18:39Z <carpeta de logs FUERA del árbol> censo.tsv` (con `gh` autenticado; corre antes sus 7 controles y se para si uno falla; sólo conserva los logs que no son un ④ en verde) · `node $E/analiza-f.mjs $E/censo.tsv` (salida en `analiza-salida.txt`).

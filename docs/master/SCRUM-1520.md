# SCRUM-1520 · Un caso que cae en la cola perdida deja la tanda en ROJO: se pierde el nombre, no el veredicto — y ya estaba medido en Linux

**Medido contra:** `origin/main` = `0472952cd2c54e1c336170fa502ca902e6fda8cf` · 2026-10-13T00:09:56Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1520/la-cola-que-cae.mjs`

J6 (sesión `jv-j6`, equipo de Javier), por encargo del orquestador `cobroflash-backend-2e`. Es
medición: no toca `src/`, ni `tests/`, ni `scripts/`, ni ningún workflow. El ticket no se transiciona.

## En corto

- **La respuesta es ROJO.** Un caso que cae y cuyo resultado viaja en la cola perdida del informe
  deja la tanda en rojo. Se pierde **qué caso** cayó; no se pierde **que algo cayó**.
- **Ya estaba medido en Linux, y el ticket decía que no.** `docs/master/SCRUM-1405.md` §① (J3c,
  2-oct-2026, runner de GitHub, node v24.21.0): la tanda entera con 8 rojos sembrados, por el mismo
  envoltorio y los mismos reporters. Salida 1 en 52 tandas de 52. En las 8 donde el caso rojo
  sembrado se perdió con la cola, el fichero entero salió rojo por su ruta. En la cobaya, 131 de 131.
  Hoy no he vuelto a ejecutar nada en Linux: esa cifra es de aquel registro, con su fecha.
- **Lo que añade hoy esta medición, en local:** de dónde sale el código de salida (del proceso de
  cada fichero, no de leer el TAP), y qué pieza lo sostiene (quitándola, sale verde).
- **Hay una ruta que sí da verde, y no es la cola perdida:** un fichero cuyo proceso se va con
  `exit(0)` a mitad. Los casos de detrás no corren y la tanda sale 0. Medido aquí; cuánto se da en
  el árbol real, sin medir.

## ① De dónde sale el código de salida

Leído en `ci.yml`, en `package.json`, en `scripts/tanda-con-veredicto.mjs` y en la fuente del
corredor que lleva dentro el binario (`process.binding('natives')`, node v24.18.0):

| eslabón | de dónde saca su código |
|---|---|
| el paso de CI: `npm test > >(tee …) 2>&1` | de `npm test`. No hay tubería: `tee` va por sustitución de proceso |
| `npm test` | del último tramo de su script, el envoltorio |
| `tanda-con-veredicto.mjs` | del proceso `node --test` (`process.exitCode = codigo ?? 1`). Lee la salida sólo para subir a 3 (silencio) o a 4 (salió 0 sin línea de recuento). Nunca baja un rojo |
| `node --test`, el padre | sale con 1 si algún fichero o caso contó como caído. Un fichero cuenta como caído por dos caminos independientes |
| camino A: el informe | llega un `test:fail` por la tubería del hijo |
| camino B: el proceso | el hijo sale con un código distinto de 0, o por una señal (`runner.js`, `if (code !== 0 \|\| signal !== null)`) |
| el hijo (un fichero) | pone su código a 1 al emitir su resumen, en su propia memoria, antes de salir. No depende de que lo escrito llegue |

La cola perdida se lleva el camino A. El camino B no pasa por la tubería.

Desde el commit de SCRUM-1405 (`7779b0cb`) hasta `origin/main` de hoy: 0 cambios en `ci.yml`, en el
envoltorio, en `_reporters-de-node-options.mjs` y en `_huella-de-la-caida.mjs`; el script `test` de
`package.json` es el mismo, letra a letra.

## ② El experimento, en local

`evidencias/SCRUM-1520/la-cola-que-cae.mjs`. Un fichero sembrado de 27 casos y un vecino de 5, por
la cadena real (envoltorio, `node --test --test-force-exit`, `spec` a la salida y `tap` a fichero).
Una precarga corta el informe del hijo donde se le dice: lo que el hijo escribe ya no llega al padre.
Windows, node v24.18.0. Salida entera en `salida-la-cola-que-cae.txt`.

| | qué se siembra | salida | qué se ve |
|---|---|---|---|
| A | nada, sin corte | 0 | 32 tests de 32 |
| B | cae el 22, sin corte | 1 | el caso, por nombre, en los dos reporters |
| C | cae el 22; el corte cae ENTRE dos casos, antes del 22 | **1** | sólo el fichero, por su ruta (`exitCode: 1`) |
| D | cae el 21b; el corte cae DENTRO del caso 21 (llega su inicio, no su resultado) | **1** | sólo el fichero |
| E | cae el 22; el corte parte en dos el mensaje del fallo | **1** | sólo el fichero |
| F | cae el 22; el fallo llega y se pierde lo de detrás | 1 | el caso, por nombre |
| J | cae el 22; no llega nada del informe del fichero | **1** | sólo el fichero |
| G | el corte de C, **quitando la siembra** | 0 | 29 tests de 32, sin entrada de fichero |
| H | como C, y el hijo forzado a salir con 0 | **0** | nada. 29 tests, todo verde |
| I | sin corte; el proceso se va con `exit(0)` en el 21 y el 22 habría caído | **0** | nada. 6 tests |
| K | como I, soltando el bucle en cada caso | **0** | nada. 25 tests, sin entrada de fichero |

Por `npm test` y bash, con la redirección de `ci.yml`: A 0, B 1, C 1. Lo mismo.

- **G es la firma que midió J4 en #2303** (SCRUM-1339 c.18989): verde, menos tests de los
  declarados, los que faltan son la cola, y el fichero no tiene entrada propia.
- **H dice qué pieza trabaja.** Mismo corte y mismo caso caído que C; lo único que cambia es el
  código de salida del hijo, y el rojo desaparece sin dejar rastro. No es una ruta real: es la
  prueba de que el rojo de C, D, E y J lo sostiene el camino B y nada más.
- **En las once, los casos que el padre no vio se ejecutaron** salvo en I y K: cada cuerpo apunta
  su número en un fichero aparte al empezar. 27 de 27 en nueve variantes; 21 de 27 en I y en K.

## ③ La ruta que sí da verde: el proceso que se va antes de tiempo

I y K no pierden informe: el proceso del fichero sale con 0 antes de llegar al caso que caería.
`node --test` no lo distingue de un fichero que terminó bien. En K el log es indistinguible del de
G: menos tests, sin entrada de fichero, todo verde.

Lo que separa una cosa de la otra **no está en el log**. Está en si se repite:

- una salida a mitad escrita en el código corta **siempre** en el mismo caso;
- la cola perdida corta unas veces sí y otras no. Es lo que midió J4 para los 18 de #2303: los dos
  ficheros montan 55 de 55 y 26 de 26 en seis pasadas locales, y cinco obligatorios vecinos con los
  mismos declarados registran los 11.082.

Eso es una lectura mía sobre datos de J4, no una medición de hoy. Y vale para esos dos ficheros, no
para los otros cinco obligatorios con ausentes, que no he abierto.

28 de los 1.307 ficheros de `tests/` contienen el texto `process.exit(`. Es un recuento de texto: no
he separado llamadas de comentarios ni de guiones que el test lanza aparte. No es un censo.

## ④ Los tres síntomas, por separado

| síntoma | qué dice esta medición | qué no |
|---|---|---|
| ① 6 de 11 obligatorios verdes con ausentes | si en esas colas hubiera caído un caso, el fichero habría salido rojo (② C, D, E, J; SCRUM-1405 en Linux) | no he leído esos seis logs. No sé si el corte de cada uno es cola perdida o salida a mitad |
| ② corte DENTRO de un caso y corte ENTRE dos | los dos cortes dan rojo si lo perdido es un fallo (C y D) | la causa de cada corte sigue sin medir. No los he agrupado |
| ③ la tanda colgada de #2318 | salió `failure` por el envoltorio (silencio, salida 3): no es un verde | no la he reproducido ni he buscado su causa. Es otra cosa |

## Lo que NO he medido

- **Nada en Linux, hoy.** Lo de Linux es SCRUM-1405, del 2-oct, sobre un árbol y una mañana.
- **El corte de verdad.** Aquí la cola se tira a propósito; en el runner se pierde al salir el
  proceso. Lo que mido es qué hace el padre con un informe al que le falta la cola.
- **Node v24.21.0**, que es el del runner. He leído y ejecutado v24.18.0.
- **Si el padre pierde su propia cola.** `node --test` también sale con `--test-force-exit`. Si le
  faltara su resumen y saliera 0, el envoltorio sube a 4; con rojos, sale 1 igual. No lo he provocado.
- **Qué entró en los seis obligatorios.** No hace falta revisarlos por esta vía: ninguna de las dos
  mediciones encuentra un rojo convertido en verde por la cola. Por la vía de ③, sí queda abierto.

## Mis errores

- **Conté texto.** `spec` repite cada caído en su sección final; mi primer recuento dio 33 nombres
  con resultado sobre 32 tests. Lo cazó el control de la suma del propio banco, que salió con 2 y
  dijo que la tabla no valía. Arreglado en el guion: se cuenta antes de esa sección.
- **Dos capas escribían en el mismo fichero de testigos:** «54 de 27» en la pasada por npm. Cada
  capa tiene ya el suyo.
- **Empecé a construir antes de buscar si estaba medido.** Encontré SCRUM-1405 leyendo el
  meta-guard, con el banco ya escrito. La búsqueda por concepto iba antes.

## Reproducir

    E=docs/master/evidencias/SCRUM-1520
    node $E/la-cola-que-cae.mjs --por-npm      # 11 variantes + 3 por npm; sale 0 con 8 controles de 8
    node $E/la-cola-que-cae.mjs --sin-siembra  # la prueba del banco: nadie cae y tiene que salir 2

No pide `dist/`. Escribe sólo en el temporal del sistema.

# SCRUM-1520b · Los cinco obligatorios que faltaban: en los cinco el corte SALTA de sitio y el mismo fichero sale completo en los jobs vecinos — es cola perdida, no una salida escrita en el código

**Medido contra:** `origin/main` = `fc4c714a96779cfc3d5249aa0b448f5f89a8a0a8` · 2026-10-13T00:29:51Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1520/b-los-cinco.mjs`

**El encargo** (orquestador del equipo de Javier, `cobroflash-backend-2e`, 13-oct; sesión `jv-j6`,
relevo). De los seis obligatorios del 8-oct con nombres ausentes, los 18 de #2303 ya estaban leídos.
Faltaban #2300, #2301, #2304, #2305 y #2306: leer sus logs por nombre y contestar, para cada uno, si
el corte cae siempre en el mismo caso o salta. **Es medición: no he tocado `src/`, `tests/`,
`scripts/`, ningún workflow, el meta-guard, `scrum859` ni `scrum267`, y el ticket no se transiciona.**
Entran esta sección y tres ficheros `b-*` en evidencias. El hook de arranque dijo «SIN IDENTIDAD»
(SCRUM-1498): seguí, como manda la ficha común.

## En corto

- **En los cinco, el corte salta.** Los cinco obligatorios pierden nombres en cuatro ficheros, y los
  cuatro salen COMPLETOS, con el mismo blob, en la mayoría de los otros diez jobs de esa noche.
  Donde se cortan, se cortan en casos distintos.
- **Eso es cola perdida.** Una salida escrita en el código de un test no puede dejar el mismo
  fichero completo en 8, 9 o 10 jobs de 11. Por esta puerta no hay nada que revisar en `main`.
- **La ficha del encargo traía el criterio al revés,** y lo digo antes de que alguien lea «salta» y
  mande revisar. Decía «si cae siempre en el mismo, es cola perdida; si salta, puede ser la segunda
  puerta». La entrega anterior (c.19151, §4) dice lo contrario y es lo que sostiene el mecanismo:
  la salida escrita en el código corta SIEMPRE en el mismo caso; la cola perdida, unas veces sí y
  otras no. Leído con la ficha al pie de la letra, este resultado pediría mirar qué entró en `main`.
  No lo pide.
- **Lo que «salta» no descarta:** una salida a mitad que no fuera fija (que dependiera de una
  carrera). En los cuatro ficheros no hay texto de salida de proceso, y eso es un recuento de texto
  que no sigue imports ni procesos hijos.
- **No he medido si los casos ausentes se ejecutaron en estos jobs.** El log no lo dice. Lo midió
  SCRUM-1405 el 2-oct en otra tanda (53.433 de 53.433); aquí no se ha repetido.

## ① Los cinco, uno por uno

Los 11 jobs corrieron árboles que declaran lo mismo (11.005 llamadas, 1.292 ficheros) y los cinco
ficheros de la tabla tienen UN solo blob en las 11 cabezas, igual que en su base. «Completo en»
cuenta los otros jobs de esa noche donde ese mismo blob informó de todos sus casos.

| obligatorio | ausentes | fichero | corte aquí | el mismo fichero en los otros 10 | ¿salta? |
|---|---|---|---|---|---|
| #2300 | 2 | `scrum524b-trinquete-de-la-tabla` | desde el 40 de 41, ENTRE dos casos | completo en 8; cortado en #2301 (desde 33) y #2304 (desde 36) | sí |
| #2301 | 9 | `scrum524b-trinquete-de-la-tabla` | desde el 33 de 41, ENTRE | completo en 8; cortado en #2300 (40) y #2304 (36) | sí |
| #2304 | 6 | `scrum524b-trinquete-de-la-tabla` | desde el 36 de 41, ENTRE | completo en 8; cortado en #2300 (40) y #2301 (33) | sí |
| #2304 | 1 | `scrum834-puerta-avisador-rojo` | el 53 de 53, DENTRO (inicio sin resultado) | completo en 9; cortado en #2306 (desde 38) | sí |
| #2304 | 25 | `vigia-atascados` | desde el 40 de 64, DENTRO (inicio sin resultado en el 40) | completo en los 10 | sí |
| #2305 | 18 | `scrum1456-ids-que-no-caben-en-la-columna` | desde el 38 de 55, ENTRE | completo en 9; cortado en #2303 (desde 44, DENTRO) | sí |
| #2306 | 16 | `scrum834-puerta-avisador-rojo` | desde el 38 de 53, ENTRE | completo en 9; cortado en #2304 (el 53, DENTRO) | sí |

- **Los 18 de #2305 no son los 18 de #2303.** La cifra coincide y el contenido no: #2303 pierde 12 de
  `scrum1456` y 6 de `scrum176`; #2305 pierde 18 de `scrum1456` y nada más. Era la pregunta que el
  tramo 1339m dejó abierta.
- **#2304 son tres ficheros y tres cortes distintos** en la misma tanda: uno ENTRE y dos DENTRO.
- **El mismo fichero cambia de tipo de corte de un job a otro:** `scrum1456` corta DENTRO en #2303 y
  ENTRE en #2305; `scrum834`, DENTRO en #2304 y ENTRE en #2306. El tipo de corte no es una propiedad
  del fichero.
- **No agrupo los cuatro ficheros por causa.** Lo que tienen en común está medido (forma de cola, sin
  entrada de fichero, el corte se mueve). La causa de cada corte no la he medido en ninguno.

## ② Cómo se leyó, y con qué controles

`b-los-cinco.mjs` lee los 11 logs ya bajados y los blobs de git; no ejecuta ningún test. Salida:
`b-salida-los-cinco.txt`.

- **Tamaño antes de contar.** Los 11 logs pesan entre 1.778.728 y 1.783.467 B. El de #2303 pesa
  1.781.097 B, la cifra del tramo 1339m. Ninguno lleva «TANDA SIN VEREDICTO».
- **La suma.** En el paso de la tanda, ✔ + ✖ + ﹣ anclados da «ℹ tests» en 11 de 11, y cada marca da
  su línea del resumen (pass, fail, skipped). Fail es 0 en los 11.
- **El cruce.** Lo que saco del reporter `spec` es lo que la señal sacó del TAP: 55 de 55 celdas
  (5 ficheros × 11 jobs), 9 cortadas y 46 completas. Y la suma de lo dictado da el registro de la
  señal en los 11.
- **El cero.** Cada nombre real con 8 hex de su sha1 detrás: 0 apariciones en las 55 celdas.
- **El positivo, sembrado.** Sobre el log de #2298 (0 ausentes) se quitan las 3 últimas líneas de
  resultado de un fichero: dice «COLA desde 53». Con `--sin-siembra` dice CIEGO y sale 2
  (`b-salida-sin-siembra.txt`).
- **El positivo del «0 de texto de salida».** El mismo patrón encuentra 31 de 1.292 tests en esa
  cabeza. En los cinco ficheros, 0.

## ③ Lo que NO sé y lo que NO he hecho

- **Si los casos ausentes se ejecutaron en estos jobs.** Es lo único que separaría del todo las dos
  puertas, y estos logs no lo traen.
- **El discriminador no lo he visto decir «FIJO» sobre un caso real.** No conozco en CI un fichero
  que salga a mitad con 0; la variante K de la entrega anterior es fabricada y local. Sí lo he
  probado contra lo ya clasificado: los dos ficheros de #2303 salen «SALTA».
- **CI corre el merge, no la cabeza.** Leo el blob de la cabeza y compruebo que es el de la base. El
  árbol del merge no lo tengo.
- **En la ventana vieja de 1339b, `scrum524b` cortó ocho veces en la posición 10 de 12** y dos en la
  12 (otro blob; `evidencias/SCRUM-1339/b-faltan-por-fichero.tsv`). No he medido en cuántos runs de aquella ventana salió
  completo, así que no sé si allí saltaba. Con el blob de hoy, 40, 33 y 36.
- No he ejecutado los cinco ficheros en local, ni nada en Linux. No he bajado los artefactos TAP.
- No he mirado más allá de esos 11 PR, ni el cuelgue de #2318.

## Mis errores

- **Mi primera suma salió 20 de más en los 11 logs, y la cazó el control de la suma, no yo.** Anclé
  la marca al inicio del caso, como pedía la ficha, y no basta: 20 líneas por log empiezan por «✔» y
  las imprime un test por su salida («✔ 1 saludo → menú»). Un resultado acaba siempre en su duración.
- **El arreglo perdió los 93 saltados.** Pedí «# SKIP» detrás de la duración y un salto lleva su
  motivo, no esa palabra. También lo cazó la suma.
- **Pasé texto con acentos por un heredoc de bash** para parchear el lector, con la trampa escrita en
  la ficha. Falló con error y no escribió nada; lo rehíce con la herramienta de edición.
- La tabla de ① no dependió de ninguno de los tres: el cruce con la señal coincidía 55 de 55 desde
  la primera pasada. Lo que estaba mal era el control.

## Reproducir

    E=docs/master/evidencias/SCRUM-1520
    # los 11 logs, fuera del árbol, como pr<N>-job<ID>.log (los ids están en b-salida-los-cinco.txt):
    gh api --allow-escape-sequences repos/lwislg99/cobroflash-backend/actions/jobs/<ID>/logs > <carpeta>/pr<N>-job<ID>.log
    node $E/b-los-cinco.mjs . <carpeta>                # sale 0
    node $E/b-los-cinco.mjs . <carpeta> --sin-siembra  # tiene que salir 2 y decir CIEGO

No pide `dist/`. No toca el árbol.

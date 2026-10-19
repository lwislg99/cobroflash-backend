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

# SCRUM-1520c · El obligatorio de las dos entregas salió ROJO y nadie lo había leído: dos caídos, los dos por el banco de la primera, ninguno por la medición

**Medido contra:** `origin/main` = `dfda86d65b8de9594b59b277fd38ea0ac3eda93a` · 2026-10-13T04:43:50Z (hora de GitHub)

A9: comprobación → `tests/scrum708-el-fichero-que-no-corre.test.mjs`

J6 (sesión `jv-j6`, segundo relevo; equipo de Javier), por encargo del orquestador
`cobroflash-backend-2e`. Carril a mano: sólo `docs/master/SCRUM-1520.md` y
`docs/master/evidencias/SCRUM-1520/`. No he tocado `src/`, `tests/`, `scripts/`, ningún workflow, el
meta-guard, `scrum859` ni `scrum267`, y el ticket no se transiciona.

## En corto

- **La medición de los cinco ya estaba hecha y entregada** (tramo 1520b, Jira c.19159) cuando
  arranqué. No la he repetido. El árbol estaba limpio y empujado: `HEAD` = remoto = `7e73ee831`.
- **Lo que las dos entregas dejaron «SIN LEER» estaba en rojo.** El obligatorio de #2344 y el de
  #2348 salieron `FAILURE`. Con el auto-merge armado, ninguna de las dos habría entrado en `main`:
  el registro de SCRUM-1520 NO está en `main` a la hora del ancla.
- **Los dos caídos son del banco de la primera entrega,** no de lo medido:
  `scrum708` (las dos siembras registran tests y `npm test` no las ejecuta) y `scrum864c`
  (`la-cola-que-cae.mjs:48` creaba un temporal que no borraba nadie).
- **Arreglado en la evidencia, sin tocar ningún instrumento.** Las siembras pasan a `.txt` y sólo son
  `.mjs` dentro del temporal; el temporal sale de `temporal()`. El banco da lo mismo: 8 controles
  de 8, y sin siembra dice CIEGO y sale 2.

## ① El obligatorio de #2348, leído por nombre

Job `115070389248`, cabeza `7e73ee831`. Log de 1.810.288 B (uno completo ronda 1,78 MB) y sin
«TANDA SIN VEREDICTO».

| | cuenta |
|---|---|
| ✔ con su duración al final | 11.047 |
| ✖ con su duración, antes de la sección «failing tests» | 2 |
| ﹣ con su duración | 93 |
| suma | 11.142 |
| «ℹ tests» declarado | 11.142 (pass 11.047 · fail 2 · skipped 93) |

Los dos, por nombre:

- `SCRUM-708 · 🔴 NINGÚN fichero registra tests fuera de lo que la tanda ejecuta` — nombra
  `evidencias/SCRUM-1520/siembra-cola.mjs` y `siembra-vecino.mjs`.
- `SCRUM-864c · 🔴 ③ NINGÚN temporal nuevo nace sin borrarse` — nombra
  `evidencias/SCRUM-1520/la-cola-que-cae.mjs:48`, `SIN_LIMPIEZA`.

El obligatorio de #2344 (cabeza `e34daaf5`) también está en `FAILURE`. **Su log no lo he bajado:** que
sean los mismos dos es lo esperable, porque lleva los mismos tres ficheros, y no está medido.

El job del meta-guard de #2348 (`115070389216`) salió con 2: 519 vivas, 0 mudas, **1 ciega**, en
`scrum859` (faltan 4 de sus 20 tests en la pasada mutada). En #2344, con los mismos ficheros, ese job
salió verde. No lo he tocado ni investigado: es la familia de SCRUM-1339 y no es mi carril. No sé si
ese job es obligatorio para el merge.

## ② El arreglo

| qué | antes | ahora |
|---|---|---|
| las dos siembras | `siembra-cola.mjs`, `siembra-vecino.mjs` | `siembra-cola.txt`, `siembra-vecino.txt`; el banco las copia al temporal con su nombre `.mjs` |
| el temporal del banco | `mkdtempSync(…)` sin borrado | `temporal('scrum1520-')`, de `tests/_temporal.mjs` |

El `.txt` no es un invento: `evidencias/SCRUM-1339/d-banco-de-nombres.txt` es código de `node:test`
guardado así y está en `main`. Una siembra que cae a propósito no puede entrar en el patrón de la
tanda, que es la otra salida que ofrece el mensaje de `scrum708`.

Comprobado en local (Windows, node v24.18.0):

- `scrum708` + `scrum864c`: 10 de 10, 0 saltados. Con el estado viejo devuelto a propósito (una
  siembra con extensión `.mjs` y un `mkdtempSync` suelto en la carpeta): 8 de 10, y los dos que caen
  son los dos del obligatorio, por nombre.
- El banco, `--por-npm`: sale 0, 8 controles de 8, las 14 líneas del resumen iguales a las de
  `salida-la-cola-que-cae.txt`. `--sin-siembra`: sale 2 y dice CIEGO.
- Temporales `scrum1520-*` en la máquina después de mis dos pasadas: los mismos 4 de antes, fechados
  entre la 01:06 y la 01:09 hora local (la sesión anterior). Mis pasadas no dejaron ninguno. Esos 4
  no los he borrado.

Las dos salidas guardadas (`salida-la-cola-que-cae.txt`, `salida-sin-siembra.txt`) son las de la
primera entrega y no las he regenerado: cambian el sello de tiempo y la ruta del temporal, no la tabla.

## Lo que NO he medido

- **El obligatorio de este empujón.** Se lee después de empujar; lo que salga va al comentario de
  Jira, no aquí.
- El log de #2344. La tanda completa en local, no corrida. Nada en Linux.
- Nada nuevo sobre los cinco obligatorios del 8-oct: lo que dice el tramo 1520b sigue como estaba,
  con sus propios «no sé».

## Mis errores

- **Mi lector contó 4 caídos donde el resumen declara 2,** y lo cazó la suma, no yo: 11.144 contra
  11.142. `spec` repite cada caído en su sección final. Es el mismo error que la primera entrega
  dejó escrito en este registro (33 sobre 32), que yo había leído media hora antes.
- **La ficha me daba la medición por pendiente y estaba entregada cuatro horas antes.** Lo vi en el
  `git log` antes de construir nada, porque la ficha mandaba medir el árbol lo primero.

## Reproducir

    rm -f "${TMPDIR:-/tmp}/1520c.tap"
    node --test --test-force-exit --test-reporter=tap --test-reporter-destination="${TMPDIR:-/tmp}/1520c.tap" \
         tests/scrum708-el-fichero-que-no-corre.test.mjs tests/scrum864c-el-temporal-no-vuelve.test.mjs
    grep -E "^# (tests|pass|fail|skipped)" "${TMPDIR:-/tmp}/1520c.tap"     # 10 · 10 · 0 · 0
    node docs/master/evidencias/SCRUM-1520/la-cola-que-cae.mjs --por-npm  # sale 0, 8 controles de 8

# SCRUM-1520d · La puerta que quedaba abierta: dos formas SÍ dan verde con un caso que cae, el árbol las usa CERO veces, y un guard la cierra

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T08:07:01Z (hora de GitHub)

A9: comprobación → `tests/scrum1520d-nada-calla-un-caido.test.mjs`

S3 (equipo de Luis), por encargo del orquestador del 14-oct («SCRUM-1520 · ¿puede un obligatorio
en verde esconder un test que cae?»). Toca `tests/` (un ayudante y un guard, carril S3) y
`docs/master/`. No toca `src/`, `scripts/`, ningún workflow ni ningún guard ajeno.

## En corto

- **Sí puede, por dos formas, y ninguna es la cola perdida.** Medido con la cadena de `npm test`
  de HOY, que desde el 14-oct 07:47Z lleva `--import=./scripts/tuberia-bloqueante.mjs` (SCRUM-1405c,
  #2429), y sólo en local: un `process.exit(0)` a mitad del fichero, y un caso marcado `todo`. En
  las dos, la tanda sale 0 con un caso que cae.
- **El árbol de hoy las usa CERO veces** en el proceso de un test de la tanda. Población: los
  1.338 `tests/*.test.mjs` (1.337 más el guard de este tramo), 188 ayudantes de `tests/` (con el
  suyo) y 387 ficheros de fuera de `tests/` a los que
  la tanda llega por imports relativos (`scripts/`, `dist/`, `.claude/hooks/`).
- **Desde este tramo, un guard de la tanda lo mantiene en cero**:
  `tests/scrum1520d-nada-calla-un-caido.test.mjs`. Visto en rojo con tres violaciones reales.
- **Lo que NO es una puerta:** `process.exitCode = 0` por sí solo. La tanda sale 1, porque el
  informe del caído llega igual. Sólo callaría junto con la cola perdida, y esa la cierra 1405c.

## ① Las tres formas, con la cadena de hoy

`evidencias/SCRUM-1520/d-tres-siembras.mjs`. Cada siembra se lanza sola por
`tanda-con-veredicto.mjs → node --test --test-force-exit --import=./scripts/tuberia-bloqueante.mjs`.
Windows, node v24.8.0. Salida en `d-salida-tres-siembras.txt`.

| | qué se siembra | salida | ℹ tests | pass | fail | todo |
|---|---|---|---|---|---|---|
| R | el caso 3 cae, sin más (control positivo) | 1 | 3 | 2 | 1 | 0 |
| X | `process.exit(0)` en el caso 2; el 3 cae | **0** | 1 | 1 | 0 | 0 |
| C | `process.exitCode = 0` en un `after`; el 3 cae | 1 | 3 | 2 | 1 | 0 |
| T | el caso 3 cae y lleva `{ todo: true }` | **0** | 3 | 2 | 0 | 1 |
| T2 | el caso 3 llama a `t.todo()` y cae | **0** | 3 | 2 | 0 | 1 |

X es la variante I del tramo 1520 ②, ahora con la tubería bloqueante en la cadena. T y T2 no los
había medido nadie: el caso cae, el corredor lo cuenta como TODO y no como caído.

## ② El censo del árbol

`evidencias/SCRUM-1520/d-la-ruta-que-calla.mjs` (el censo vive en `tests/_la-ruta-que-calla.mjs`,
que comparte con el guard). AST de TypeScript, no texto. Salida en `d-salida-la-ruta-que-calla.txt`.

| dónde | hallazgos | pueden callar un caído en el proceso de un test |
|---|---|---|
| los 1.338 ficheros de la tanda | 0 | 0 |
| 188 ayudantes y arneses de `tests/` | 17 (`exit`) | 0: 16 no los importa ningún test (se lanzan como programa); 1 está en su bloque de programa |
| 387 ficheros de fuera, importados por la tanda | 119 (`exit`/`exitCode`) | 0 |

De los 119 de fuera, los que corren en el proceso del test son cuatro `exit` dentro de funciones
EXPORTADAS (`scripts/_navegador.mjs:76` y `:440`, `scripts/_servidor.mjs:73`,
`scripts/meta-guard-mutaciones.mjs:1404`). Salen con 2, 3, 4 y 3 (`SALIDA_NO_ENCONTRADO`,
`SALIDA_NO_ARRANCA`, `SALIDA_SIN_SERVIDOR`, `SALIDA_NO_RESTAURADO`): ponen el fichero en ROJO, no
lo callan. Los demás están en un bloque de programa o en una función no exportada que sólo llama
ese bloque. Esto último lo he leído en `scripts/equipo/sesion.mjs`. En los otros no.

Controles: 9 positivos sembrados, uno por forma, y 5 ceros (la forma dentro de una cadena, de una
plantilla o de un comentario; un `exit(1)`; y un método propio que se llama `todo`). Sobre el
árbol: el `exit(0)` conocido de `tests/_meta-de-laboratorio.mjs` tiene que salir, y los
`b.todo()` de `scrum1367b`, no. Con `--sin-siembra` dice CIEGO y sale 2
(`d-salida-sin-siembra-la-ruta.txt`). Como referencia, el texto da otra cosa: 54 ficheros de
`tests/` contienen «process.exit(» y 783 la palabra «todo». No es un censo.

## ③ El guard, en rojo antes que en verde

Commit de todo el árbol antes de inyectar: `2b6054499121726b3cf13505eb81f1e72fb04cb3`. Una
inyección cada vez, con su `git diff --numstat`, y se restaura con `git restore --source=HEAD`:

| inyección | numstat | guard | qué nombra |
|---|---|---|---|
| `test(` → `test.todo(` en un caso de `scrum1424-ya-esta` | `1 1` | sale 1, 1 caído | `tests/scrum1424-ya-esta.test.mjs:29 · .todo(…)` |
| `process.exit(0);` dentro de ese caso | `1 1` | sale 1, 1 caído | `…:29 · exit(0) · dentro de «SCRUM-1424 · YA ESTÁ…»` |
| `exit(SALIDA_NO_ENCONTRADO)` → `exit(0)` en `scripts/_navegador.mjs` | `1 1` | sale 1, 1 caído | `scripts/_navegador.mjs:76 · exit(0) · en la función rutaDelNavegador() · EXPORTADA` |

Después, `git status --porcelain` vacío. En verde: 3 de 3, en 11,3 s. Es lo que tarda en
analizar unos 1.900 ficheros.

## ④ ¿Se pierde un caso que FALLA, o sólo los que pasan? Recontado, no heredado

El orquestador lo preguntó el 14-oct. Se pierde su NOMBRE y no su VEREDICTO. He vuelto a pasar el
banco del tramo 1520, `la-cola-que-cae.mjs --por-npm`, en esta máquina (Windows, node v24.8.0).
Salida en `d-salida-recuento-de-la-cola.txt`, con 8 controles de 8.

| variante | J6, 13-oct (node v24.18.0) | yo, 14-oct (node v24.8.0) |
|---|---|---|
| B · cae, sin corte | 1 | 1 |
| C · cae; corte ENTRE dos casos | 1 | 1 |
| D · cae; corte DENTRO del caso | 1 | 1 |
| E · cae; el corte parte en dos el MENSAJE del fallo | 1 | **cuelga**: `spawnSync ETIMEDOUT` a los 180 s, 2 pasadas de 2 |
| F · el fallo llega y se pierde lo de detrás | 1 | 1 |
| H · como C, y el hijo sale con 0 | 0 | 0 |
| J · no llega nada del informe | 1 | 1 |

- **Ninguna variante con un caído sale 0.** La excepción es H, que es la pieza quitada a
  propósito. El rojo lo sostiene el código de salida del hijo, como dijo el tramo 1520 ①.
- **E no sale verde, pero tampoco sale 1 en este node:** el padre se queda esperando el resto
  de un mensaje que no llega. En una tanda, eso lo dice el envoltorio a los 900 s («TANDA SIN
  VEREDICTO», salida 3): un `failure`, no un verde. Con node v24.18.0 J6 midió 1. CI corre
  v24.21.0, que no he probado. **No he medido si esto tiene que ver con los cuelgues de
  SCRUM-1527** (un fichero que no termina y su silencio). Lo dejo dicho allí como pista, no
  como causa.
- **Tampoco uso el «4 de 6 tandas pierden casos con el flag»** de SCRUM-1405: es suyo y no lo he
  vuelto a medir. Desde el 14-oct la tubería es bloqueante (1405c), y si sigue perdiendo lo
  dirá la señal de nombres de los próximos obligatorios.

## Lo que NO he medido

- **Linux.** No he lanzado ninguna sonda en CI, y es una decisión, no un olvido: un PR en rojo
  despierta a `@claude` por `avisador-rojo.yml`, que no exceptúa los borradores, y uno en verde
  con rama `scrum-**` se arma y se mergea solo (`pr-automatico.yml`). El código de salida del
  corredor sale de `runner.js` y no depende del sistema (tramo 1520 ①). Eso es lectura, no medida.
  Y el node de esta máquina (v24.8.0) es más viejo que el de CI (v24.21.0): ④ ya enseña una
  variante que cambia con la versión.
- **Si la cola perdida ha desaparecido con 1405c.** #2429 entró a las 07:47:56Z. A la hora del
  ancla no hay obligatorios después: la señal de nombres de los próximos lo dirá.
- **Qué NO cubre el guard:** un `exit(<expresión>)` fuera de la tanda cuyo valor pueda ser 0 (no
  resuelve constantes); una función no exportada que llama una exportada; imports con ruta
  calculada (`import(pathToFileURL(join(…)))`), que no se siguen; un `dist/` sin compilar, que deja
  esos ficheros fuera (en el árbol medido estaban los 205).
- **Que la llamada se alcance.** Un `exit(0)` en una rama que nunca corre cuenta igual.

## Mis errores

- **Mi primera regla de `todo` casaba el NOMBRE del método** y contó 26 `b.todo()` en
  `scrum1367b`, `scrum1367c` y `scrum1430`. Es un método de un banco que devuelve la salida, y no
  marca nada como pendiente. Lo cacé leyendo la lista, no con un control. Es el defecto de la
  ficha de mi puesto, «casaba el literal en vez de seguir la variable». Ahora es un cero sembrado
  y un cero sobre el árbol.
- **Mi primer reconocedor de «bloque de programa» sólo sabía `process.argv[1]`** y dio 50 `exit`
  «al importar» que no lo eran (`ejecutadoDirectamente(import.meta.url)`, `esPrincipal`, `esCli`…).
  Si lo hubiera convertido en guard así, habría salido rojo sobre un árbol sano. Lo reconoce ahora
  por nombre cuando la función es importada, y eso es una suposición: va dicha en el ayudante.

## Reproducir

    E=docs/master/evidencias/SCRUM-1520
    node $E/d-tres-siembras.mjs                    # sale 0; R=1, X/T/T2=0, C=1
    node $E/d-la-ruta-que-calla.mjs                # sale 0; «PUEDEN CALLAR …: 0»
    node $E/d-la-ruta-que-calla.mjs --sin-siembra  # tiene que salir 2 y decir CIEGO
    node --test --test-force-exit tests/scrum1520d-nada-calla-un-caido.test.mjs   # 3 de 3

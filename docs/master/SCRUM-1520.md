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

# SCRUM-1538 · «19 de 56 rojos en main» no existía: son 19 ejecuciones de UN job, y las 19 son ciegas

**Medido contra:** `origin/main` = `eebc104d9e955cdd67b31ad2d24a50cc9b849a7b` · 2026-10-13T12:23:00Z

A9: aviso → A10 «Un instrumento declara su población, no sólo su resultado.» — no se pudo comprobar: la cifra «19 de 56» vivía en los mensajes del orquestador al fundador y no en el árbol, y ningún test lee esos mensajes

**Quién midió y quién escribe.** Midió la sesión `jv-j3l` (entrega en Jira, comentario 19367 de
SCRUM-1538). Este registro lo escribe su relevo, `jv-j3m`, **sin volver a medir nada**: las cifras son
las de sus cuatro guiones y sus salidas, que entran en este mismo PR tal como estaban en su commit
local `9f8d90800acd5b7bf5b765173616071e0009a10f` (rama `scrum-1538-los-rojos-de-main`, nunca empujada).
El ancla de arriba es el `main` y la hora de SU medición, no los de hoy. Al escribir, `main` iba 17
commits por delante (`9308125e7c7885fb9568fcd633ad8dc1fa021eba`); lo único que se miró en esos 17 es
que no tocan `tests/scrum1350-latido.test.mjs`, `tests/bot-suite.test.mjs` ni `scripts/equipo/latido.mjs`.

**Este PR sólo trae medición:** el registro y `docs/master/evidencias/SCRUM-1538/`. No arregla ninguno
de los rojos, y no toca `tests/`, `scripts/`, `src/`, ningún workflow ni ningún número.

## El titular

El orquestador llevaba días diciendo «19 de 56 en rojo en `main`». **Esa cifra no describe nada que
exista**, y falla en tres niveles a la vez:

| nivel | lo que la frase daba a entender | lo medido |
|---|---|---|
| qué se cuenta | 19 jobs de 56 | 19 **ejecuciones**, de 56 ejecuciones acabadas |
| de qué | de `main` entero | de **UN solo job**: el de las mutaciones («meta-guard · los guards caen cuando deben»), en `push` a `main` |
| en qué estado | en rojo | **0 con algún guard mudo** (el único rojo de verdad de ese job) y **19 CIEGAS**: el job perdió la cola de un informe y lo dijo saliendo con 2 |

Y no llevaba ventana: «56» son las ejecuciones creadas hasta las 06:20Z del 13-oct (la ventana del
comentario 19236 de SCRUM-1339, de donde salió la cifra). Con la ventana entera de este censo, la misma
cuenta da **20 de 63**. El control de cero, con el nombre del job al revés, da 0
(`d-salida-cabos.txt`, apartado ①).

## La ventana, y la población

**2026-10-06T13:43:02Z → 2026-10-13T12:10:00Z.** Sin ventana un recuento no es un número.

| qué | cuánto | cómo se sabe que está entero |
|---|---|---|
| commits de `main` (primer padre) | 158 | 158 de 158 consultados por sha, 0 fallos |
| runs con rama `main` | 824 | 823 del listado por día (declarados = traídos los 8 días) + 1 que sólo salió por sha |
| ejecuciones de job (todos los intentos) | 1.045 | 824 de 824 runs con sus jobs leídos, **0 sin leer** |
| logs bajados | 389 | de 18.231 a 1.808.809 B, 0 por debajo de 1.000 B; las otras 656 ejecuciones no tienen log que pedir (saltadas, sin acabar, o verdes de otro workflow) |
| jobs distintos | 11 | 9 hablan de `main` (la lista `JOBS_DE_MAIN` del vigía: 9 de 9 aparecen); 2 son reactivos y van aparte |

## La tabla

| qué | cuánto | sobre cuánto |
|---|---|---|
| Jobs que hablan de `main` | **9** | 9 de 9 de la lista del vigía |
| Ejecuciones de esos 9 jobs | **592** | los estados suman 592 |
| VERDE, afirmado por su log | **354** | 384 ejecuciones de los 6 jobs de CI |
| VERDE sólo por la conclusión de GitHub (log no bajado; `VERDE*` en las salidas) | **208** | las 208 de los 3 jobs que no son de CI |
| ROJO | **3** | 592 |
| CIEGO | **21** | 592 |
| COLGADA | **5** | 592 |
| CORRIENDO | **1** | 592 |
| Lo que GitHub llama `failure` | **24** | de ellas, ROJO 3 y CIEGO 21 |
| Grupos de causa de los rojos | **3**, uno por rojo | 3 rojos |
| Rojos de otro momento de `main` | **1** | 3 rojos |
| Rojos vivos en la punta medida | **2** | 3 rojos |
| Sin clasificar | **5 colgadas + 1 run sin jobs + 6 de un workflow reactivo** | ver «Lo que no se pudo clasificar» |

### Por job, en ejecuciones

| job | ejecuciones | VERDE | ROJO | CIEGO | COLGADA | CORRIENDO | lo que le pone GitHub |
|---|---|---|---|---|---|---|---|
| CI / build + tests (con banco desechable) | 64 | 62 | 2 | 0 | 0 | 0 | success 62 · failure 2 |
| CI / guards de navegador (fuera de la tanda) | 64 | 64 | 0 | 0 | 0 | 0 | success 64 |
| CI / meta-guard · los guards caen cuando deben | 64 | 43 | 0 | 20 | 0 | 1 | success 43 · failure 20 · in_progress 1 |
| CI / trinquete · ningún test nuevo mide la zona de la máquina | 64 | 59 | 0 | 0 | 5 | 0 | success 59 · cancelled 5 |
| CI / vigía del despliegue (informativo) | 64 | 63 | 1 | 0 | 0 | 0 | success 63 · failure 1 |
| CI / constancia del ALTER (informativo) | 64 | 63 | 0 | 1 | 0 | 0 | success 63 · failure 1 |
| Conflicto de registro / resolver | 154 | 154* | 0 | 0 | 0 | 0 | success 154 |
| Vigía de PR atascados / vigilar | 26 | 26* | 0 | 0 | 0 | 0 | success 26 |
| Vigía del despliegue / vigia | 28 | 28* | 0 | 0 | 0 | 0 | success 28 |
| **suma** | **592** | **354 + 208*** | **3** | **21** | **5** | **1** | failure 24 |

`*` = verde sólo por la conclusión de GitHub: su log no se bajó.

### Por commit: en cuántos de los 158 dio veredicto cada job

| job de `push` | con veredicto | % | VERDE | ROJO | CIEGO | COLGADA | CORRIENDO | sin clasificar | último verde |
|---|---|---|---|---|---|---|---|---|---|
| build + tests | 64 | 40,5 | 62 | 2 | 93 | 0 | 0 | 1 | 2 commits por detrás de la punta |
| guards de navegador | 64 | 40,5 | 64 | 0 | 93 | 0 | 0 | 1 | 2 |
| meta-guard | 43 | 27,2 | 43 | 0 | 113 | 0 | 1 | 1 | 8 |
| trinquete de zona | 59 | 37,3 | 59 | 0 | 93 | 5 | 0 | 1 | 2 |
| vigía del despliegue (informativo) | 64 | 40,5 | 63 | 1 | 93 | 0 | 0 | 1 | 2 |
| constancia del ALTER (informativo) | 63 | 39,9 | 63 | 0 | 94 | 0 | 0 | 1 | 2 |
| Conflicto de registro | 154 | 97,5 | 154* | 0 | 4 | 0 | 0 | 0 | 0 |

Cada fila suma 158. **En 93 commits no corrió ningún job de CI:** 92 runs cancelados sin arrancar, de 0
a 60 s después de crearse el run del commit siguiente (GitHub sustituye al que espera en la cola del
grupo; es la decisión de SCRUM-935b), y 1 en cola al medir. Por eso «verde en `main`» es de dos commits
atrás y sólo cubre cuatro de cada diez. Los dos jobs de cron se miden en horas: 26 y 28 ejecuciones,
con un hueco mayor de 10,6 h y 11,3 h entre dos seguidas.

## Los 3 rojos, uno por causa

| | job y cuándo | qué cae | la pata, que no depende de cuántas veces se repite | ¿de otro `main`? |
|---|---|---|---|---|
| ① | build + tests · 6-oct 19:39:34Z · job 112472123541 · commit `282225174` · 10.725 + 1 + 98 = 10.824 | `SCRUM-1378 · leerTrabajos no saca PR de children…` (`tests/scrum1350-latido.test.mjs`) | El test exige que la fila entera no contenga «1681», y la fila lleva una marca de tiempo: `actualizado=1791316817877.9614`, que lo contiene (y fuera de ese número no aparece). Con el mismo blob del test y el mismo `src/`, pasa en 3 de 3; con sólo el mismo blob, en 9 de 9 | **No.** El fichero cambió después (3 commits, su blob en la punta es otro), pero **el test es el mismo**: 12 líneas, sha256 `2594a8b681ab` en el commit del rojo y en la punta. No hay arreglo en `main` |
| ② | build + tests · 13-oct 07:37:22Z · job 115185474035 · commit `9358f02b1` · 11.110 + 1 + 93 = 11.204 | `A8.4: suite completa del bot (webhook + dry-run)` (`tests/bot-suite.test.mjs`): `'menu' !== 'handoff'` | Con el mismo blob del test y el mismo `src/`, pasa en 9 de 9; con sólo el mismo blob, en 44 de 44 | **No.** Mismo blob en la punta, 0 commits lo tocan después |
| ③ | vigía del despliegue (informativo) · 7-oct 06:25:16Z · job 112661659895 | producción 4 commits y 10,1 h por detrás de `main` | no es de código | **Sí.** La ejecución siguiente, 18 min después, dice «al-dia» |

**El ① es de otro carril.** El test prueba `scripts/equipo/latido.mjs`; `scripts/equipo/` es de S5
(`docs/equipo/dos-equipos.md` §3), y SCRUM-1378 se titula «S5 · LATIDO…». Está en «Finalizada» y **sin
etiquetas de equipo ni de área** (leído el 13-oct a las 12:53Z). No se toca desde aquí: se reporta. El
test volverá a caer cada vez que el reloj traiga «1681» dentro de la marca de tiempo.

**El ② sigue SIN EXPLICAR.** Lo único medido es que cae con el mismo test y el mismo `src/` con los que
pasa. Hay una hipótesis de la sesión `jv-j3j`, que sólo vive en su traspaso y en un mensaje al
orquestador: que cuatro tests que antes saltaban por falta de banco (SCRUM-47, 49, 50 y 68) hubieran
empezado a correr —de 93 saltos a 89— y uno dejara estado. Nació de otra caída del mismo caso, en un
PR, a las 11:46Z (comentario 19334 de SCRUM-1339). **Esa hipótesis no explica este rojo: cayó con 93
saltos**, la misma cifra que los verdes de alrededor. ⚠️ Lo que consta es la CIFRA de saltos del log;
que sean los mismos 93 casos no se ha leído. Y en 19 de las otras 63 ejecuciones de la ventana el caso
«no aparece»: la salida no dice por qué, y no se ha mirado.

## Los 21 ciegos, y por qué no se pudo mirar

- **20 · el job de las mutaciones, cola perdida.** No pudo juzgar `scrum859` en 15 ejecuciones,
  `vigia-atascados` en 4 y `scrum813` en 1. La pata se cumple en 20 de 20: con el mismo blob del guard y
  el mismo del instrumento, sale juzgado ENTERO en 48, 59 y 58 ejecuciones. **0 mudas en las 63** con
  resumen, y las marcas contadas dan las «vivas» del resumen en 63 de 63.
- **1 · constancia del ALTER**, 13-oct 05:45:59Z, job 115152523396: «NO PUDE PREGUNTAR: producción
  responde 503».

## Las 5 colgadas

El trinquete de zona, 5 veces entre el 6-oct 14:02Z y el 7-oct 23:41Z (jobs 112314349590,
112432961307, 112472123426, 112931567843 y 113072953269). GitHub las da por `cancelled`: las cortó su
techo de 45 min después de callar entre 2.171 y 2.663 s, con 0 o 1 de las 2 zonas medidas; la zona más
lenta de los 59 verdes tarda 547 s. Cuatro de las cinco llevan el mismo blob del instrumento, que sale
verde en otras 56. Después de la última, 38 de 38 en verde, y ningún commit de `main` toca
`scripts/trinquete-de-zona.mjs`, `ci.yml` ni `scripts/tanda-con-veredicto.mjs`. **Causa SIN MEDIR.**

## Lo que no se pudo clasificar, y no se reparte

- 1 run de CI en `failure` **sin ningún job** (run 37654882700, 7-oct 16:48Z, commit `965e3d053`) y un
  `startup_failure` del avisador 11 min después. No hay log que leer.
- 6 `failure` de «Claude Code» (reactivo: lo dispara un comentario, no un commit). Los 6 dicen
  `is_error:true`. Causa no leída.
- Las 5 colgadas, y el porqué del rojo ②.

## Dos verdes que conviene saber cómo son

- 39 de los 62 verdes de build + tests pierden nombres de casos (cola perdida). Las marcas ancladas dan
  el resumen en 64 de 64, y ninguno lleva «TANDA SIN VEREDICTO».
- El vigía del despliegue salió verde POR DISEÑO a las 11:20:14Z del 13-oct con producción 20 commits y
  95,8 h por detrás; el siguiente, a las 11:50Z, dice «al-dia».

## Controles del instrumento

- **Sembrado:** 18 casos fabricados por el propio guion (entre ellos una tanda verde con la cruz y
  «TANDA SIN VEREDICTO» dentro de un NOMBRE que pasa): 18 de 18 en su estado. Vaciados con
  `--sin-siembra`, dice CIEGO y sale con 3 (`c-salida-control-al-reves.txt`).
- **Cero derivado:** el nombre de un job al revés da 0 donde el real da 390.
- **Tamaño antes de contar:** los 389 logs, 0 por debajo de 1.000 B.
- **Dos caminos para la población:** el listado por día y el sha de cada commit (añadió 1 run).

## Aceptación → dónde se ve

El ticket no trae una lista bajo la palabra «Aceptación»: van los cinco puntos de su encargo.

| lo que pide el ticket | dónde se ve |
|---|---|
| ① Censar los jobs de `main`, con la ventana declarada | `docs/master/evidencias/SCRUM-1538/a-salida-listar.txt` y `c-salida-clasificar.txt` (bloques ①) |
| ② Clasificar en los cuatro estados, y por cada ciego, por qué | `docs/master/evidencias/SCRUM-1538/c-salida-clasificar.txt` (bloque ②) y `c-ejecuciones.tsv` |
| ③ Agrupar los rojos por causa medida, con una pata que no dependa de la repetición | `docs/master/evidencias/SCRUM-1538/c-salida-clasificar.txt` (③a, ③b, ③c) y `d-salida-cabos.txt` |
| ④ Separar los rojos de otro `main` | las líneas «④ ¿de otro main?» de `c-salida-clasificar.txt`; `d-salida-cabos.txt` ② y ⑤ |
| ⑤ Decir cuáles no se pudieron clasificar | bloque ⑤ de `c-salida-clasificar.txt`; `d-salida-cabos.txt` ③ y ④ |
| Todo recuento con control positivo sembrado | `docs/master/evidencias/SCRUM-1538/c-salida-control-al-reves.txt` |
| Por qué cae A8.4 | NO HECHO → sin dueño todavía; lo decide el orquestador de Javier |
| Por qué se colgó el trinquete cinco veces | NO HECHO → sin dueño todavía; lo decide el orquestador de Javier |

## Lo que NO se ha medido

- Nada ejecutado: todo es lectura de la API de GitHub y de 389 logs.
- Los logs de los 3 jobs que no son de CI (208 ejecuciones): van por la conclusión de GitHub.
- La pata del job de las mutaciones no incluye el fichero que cada guard muta.
- Los runs de los PR: esto mide `main`.
- Lo anterior al 6-oct 13:43Z, y lo posterior al 13-oct 12:10Z.
- De SCRUM-1339, `jv-j3l` leyó los 7 comentarios de ese día, no los 31 anteriores.
- **El relevo no ha vuelto a pasar ningún guion.** Los 389 logs (132 MB) y `a-poblacion.json` no están
  en git: vivían en la carpeta temporal del trabajo `afd12689`. Se rehacen con `a-listar.mjs` y
  `b-bajar.mjs` (unas 1.400 llamadas a `gh`).

## Los errores, de quien midió y de quien escribe

De `jv-j3l`, dichos por ella en el comentario 19367: cruzó los 200k de contexto sin avisar (160.775 al
arrancar, 289.486 en la siguiente medida), y por eso entregó sin registro; pasó un parche por bash y la
expresión perdió las barras (lo vio al releer, antes de correrla); y su primer ancla de la cruz contaba
17 marcas de más por log, que cazó el control de la suma (0 de 64).

De `jv-j3m`, al escribir este registro: van en la entrega de Jira, que se escribe después de este fichero.

## De paso

Nada arreglado de paso. El rojo ① cae en un fichero de otro carril: se reporta y no se toca.

## SCRUM-1538c · las dos causas «sin dueño»: A8.4 ya tenía dueño y arreglo, y las colgadas se fueron solas el 14-oct

**Medido contra:** `origin/main` = `0adcc1b2ff90af4aa0f0d43ef710da4c8d65a163` · 2026-10-21T13:59:17Z

A9: aviso → A10 «Un carácter que no se ve no lo caza una revisión: lo caza un recuento.» — no se pudo comprobar: mi primer control de retornos de carro sobre las salidas fue `od -c | grep`, contó 741 y eran 0 por bytes; es cómo leo una salida en mi consola, no algo del árbol que un test pueda mirar (el CR comiteado ya lo vigila `tests/scrum480-fin-de-linea.test.mjs`)

Sesión `jv-j3u`, puesto J3 (CI e instrumentos), por encargo del orquestador `cobroflash-backend-5f`, que
asignó a J3 las dos filas «NO HECHO → sin dueño» de arriba. Jira no respondía (el conector daba
`CONNECT_TIMEOUT`): **no he leído el ticket ni sus comentarios**; todo sale del repo y de la API de GitHub.
El hook de inicio dijo «SIN IDENTIDAD» (SCRUM-1498): se siguió con la orden escrita del orquestador.
La rama es `scrum-1538c-…` y no `1538b`: el sufijo `b` ya lo usó #2384 (`scrum-1538b-el-registro`).

**Sólo medición.** No toca `tests/`, `scripts/`, `src/` ni ningún workflow. Los guiones y sus salidas, en
`docs/master/evidencias/SCRUM-1538c/` (los 356 logs, unos 230 MB, se quedan fuera: se rehacen con
`e-listar.mjs` y `f-bajar.mjs`).

### La población

Ventana **2026-10-06T13:43:02Z → 2026-10-21T13:59:17Z**: la de arriba, alargada hasta hoy, y **con los PR**
(arriba sólo se midió `main`). **1.029 runs del workflow CI** (61 tramos de 6 h, declarados = traídos en los
61). De los 806 que no son un verde limpio de un solo intento se leyeron sus 3.456 ejecuciones de job; se
bajaron 356 logs, **0 por debajo de 1.000 B** (`e-salida-listar.txt`, `f-salida-bajar.txt`). Los lectores
pasan antes por 6 casos sembrados (6 de 6; sin ellos salen CIEGO), y en los 175 rojos con resumen la suma
pass + fail + skipped + cancelled + todo da el total declarado en 175 de 175 (`g-salida.txt`).

### La tabla

| causa | ocurrencias | evidencia | dueño propuesto | ¿sin tocar workflows? |
|---|---|---|---|---|
| ① A8.4 cae con `'menu' !== 'handoff'`: el bot guardaba `handoff` DESPUÉS de enviar, y el paso 9 leía la sesión antes del UPDATE | **4**, todas el 13-oct: 07:37Z (`main`, job 115185474035, el rojo ② de arriba), 11:24Z (PR, job 115271284880), 13:57Z (PR, job 115337104180), 15:42Z (`main`, job 115391241077) | `g-salida.txt` ②. La causa no es mía: la halló `jv-j3d` (SCRUM-1543 c.19551) y la arregló J2 en SCRUM-1543, #2426, merge `b010b6a71` del 14-oct 07:19:47Z (`docs/master/SCRUM-1543.md`) | **J2, ya hecho.** Nada que repartir | sí (fue bot + test) |
| ①bis A8.4 cae con `NoMedido` (la espera de 26 mensajes vence) | 1: 21-oct 12:29Z, PR `scrum-1509h-veinte-por-hora`, job 119222039233 | `g-salida.txt` ② | SCRUM-1509i, ya en `main`. **Posterior a la ventana de 1538: no explica sus rojos** | sí |
| ② trinquete de zona cortado por su techo (45 min) | **23**: 5 en `main` (los cinco de arriba) + 18 en PR, del 6-oct 14:02Z al 14-oct 08:57Z | `g-salida.txt` ③: 10 colgadas en la 1.ª zona y 13 en la 2.ª; las 23 dejan 3 procesos node huérfanos | **S5, ya hecho:** SCRUM-1494c (#2486, `574e53806`, 16-oct 11:18Z) corta por test y por pared, y NOMBRA lo cortado | sí (fue el hijo y su test) |
| ③ la tanda de `build + tests` sin veredicto (`TANDA SIN VEREDICTO`, 905 s callada) | **10**, todas en PR, del 6-oct 18:31Z al 14-oct 07:29Z | `g-salida.txt` ①. El fichero sin acabar es el siguiente al último que llegó, y son **cuatro distintos**: `scrum446-cabecera-modal` 4 · `scrum447-byte-invisible-en-patrones` 3 · `scrum615-plazo-con-null` 2 · `scrum616-que-guarda-la-factura` 1 | **nadie: 0 desde el 14-oct** (abajo). Si vuelve, J3 | — |
| ④ **NUEVA, fuera de la ventana de 1538:** el meta-guard agota su techo de 30 min | **128** cortes a ≥ 29 min, del 15-oct 17:50Z a hoy; 26 en `main`. **0 de los 128 llegan a su resumen** | `g-salida.txt` ④, `i-salida.txt` | **J6** (el meta-guard y sus mutaciones), con S5, que amplió el test que pesa: **cruza de equipo** | **sí, en principio:** el tiempo lo ponen el catálogo de mutaciones y el test, no el techo |

### ① A8.4: lo que añade esta medición al arreglo de 1543

- **Antes:** 4 caídas de esta firma, las 4 el 13-oct (1543 contaba 4 en 65 logs).
- **Después del merge de 1543:** **0** caídas de esta firma en los 100 rojos de `build + tests` posteriores
  (población: los 185 rojos de la ventana, todos leídos), sobre **333** `build + tests` con veredicto desde
  el 14-oct 09:00Z. Y A8.4 **corrió y pasó en 15 de 15** de los últimos verdes posteriores al arreglo: no
  saltó, y un verde con A8.4 saltado no diría nada de A8.4 (`h-salida.txt` ②).
- **Sin medir:** por qué las 4 caen el mismo día y ninguna antes en la ventana (6 al 12-oct).

### ② y ③ las colgadas: qué estaba corriendo, y en qué coinciden

- **El trinquete no deja dicho qué fichero se colgó:** su hijo sólo imprime una línea por zona. Lo que dice
  el log: en qué zona (10 en la 1.ª, sin ninguna acabada; 13 en la 2.ª, con la 1.ª acabada en 300-523 s,
  cuando una zona entera tarda 464-564 s en los verdes de control) y que al cortar quedan 3 node vivos.
  **Qué fichero, no lo dice ninguno de los 23.** Es lo que arregla 1494c, que todavía no ha visto un cuelgue
  de verdad (lo dice su registro).
- **La tanda sí nombra lo último que llegó**, y el que no acaba es el siguiente en orden (los cuatro
  «últimos» son el último `test(` de su fichero). Que sean **cuatro ficheros distintos**, uno de ellos un
  guard estático de un modal, dice que **no es un test concreto que se cuelgue**.
- **En qué coinciden las dos familias: en cuándo se acaban.** La última colgada de la tanda es de las
  07:29:56Z del 14-oct y la última del trinquete, de las 08:57:18Z. Desde las 09:00Z: **0 de 315**
  trinquetes acabados y **0 de 333** `build + tests` con veredicto (`h-salida.txt` ①). 1494c entró dos días
  DESPUÉS, así que **no es lo que las quitó**. Esa mañana entraron, entre otros, #2426 (1543, 07:19:47Z) y
  #2429 (SCRUM-1405c, tubería bloqueante, 07:47:56Z); **ninguno está medido como causa**, y el último
  trinquete colgado es de un PR cuya mezcla ya llevaba 1405c. **La causa de las colgadas sigue SIN MEDIR**;
  lo medido es que llevan 7 días sin aparecer en 648 ejecuciones.

### ④ el meta-guard: medido por qué

- **Cuándo empieza:** los dos primeros cortes son de la **propia rama de SCRUM-1494** (15-oct 17:50Z y
  16-oct 11:07Z); el tercero, el push de su merge a `main` (16-oct 11:18:52Z); después, casi todo run.
- **Dónde está el tiempo** (`i-salida.txt`, los 10 primeros verdes del 6-7 oct contra los 10 últimos del
  19-21 oct): el paso de mutaciones pasa de **1.233 s** de media a **1.595 s** (+362).
  `scrum813-trinquete-de-zona` pasa de **29 s a 284 s** (+254): de 11 líneas de veredicto a 26, y de ~2,6 s
  a ~11 s cada una (cada mutación vuelve a correr el fichero, que desde 1494c lleva casos con pared de
  segundos). Los 24 ficheros que entran suman +205 s; el resto, −97.
- **Por qué no se ve:** sólo `build + tests` es obligatorio (ruleset de `main`, leído hoy), así que estos
  128 cortes no bloquean nada. En la mayoría de sus runs desde el 16-oct, el meta-guard no dice si los guards
  caen cuando deben.
- **No he arreglado nada:** no es un test de mi carril ni un arreglo de una línea.

### De paso, sin número

El rojo más repetido de la ventana es `scrum1405c` caso ④ (**63** caídas, 13 en `main`, del 14-oct
07:47:59Z al 21-oct 12:24:54Z). No era el encargo; lo atiende SCRUM-1405d (#2634, `1e00b1b9d`, 21-oct
12:43:49Z), de J3. No he mirado si ha vuelto a caer después.

### Aceptación → dónde se ve

| lo que pide el encargo | dónde se ve |
|---|---|
| Por qué cae A8.4 (fila «NO HECHO» de arriba) | `docs/master/SCRUM-1543.md` (la causa y el arreglo) y `docs/master/evidencias/SCRUM-1538c/g-salida.txt` ② + `h-salida.txt` ② (que no ha vuelto) |
| Por qué se colgó el trinquete cinco veces | NO HECHO → el log no lo dice; lo que se ve está en `docs/master/evidencias/SCRUM-1538c/g-salida.txt` ③ y `h-salida.txt` ①. Si vuelve, lo nombra 1494c |
| Tabla causa → ocurrencias → evidencia, con dueño y si se arregla sin workflows | la tabla de este tramo |

### Lo que NO se ha medido

- **Nada ejecutado:** lectura de la API de GitHub y de 356 logs.
- Los 223 runs verdes limpios van por la conclusión de GitHub: de ellos no se bajó ningún log.
- Las 4 caídas de A8.4 del 13-oct no se han reproducido; su causa es la de 1543, que también dice que no
  pudo ver en CI que fuera esa carrera.
- Qué colgaba la tanda y el trinquete, y qué lo quitó el 14-oct.
- El meta-guard por mutación: sólo por fichero. Ni cuánto bajaría con cada arreglo posible.
- Los workflows que no son CI. Jira, entero.

### Mis errores

- El control de CR de la línea A9. Y medí mi contexto al acabar el arranque (118.971), pero **no** al acabar
  de leer Jira, porque Jira no respondió: esa segunda cifra no existe.

## SCRUM-1538d · qué dejó de colgar las tandas el 14-oct: la tanda, con #2429 (1405c) dentro de la base; el trinquete, nada de lo que cambió ese día

**Medido contra:** `origin/main` = `7b176514255877d4b3e85029b8a3a4ad1bcd881f` · 2026-10-21T14:48:36Z

A9: aviso → cicatriz J3 «Medí mi contexto a 184.389 sin haberlo medido al acabar el arranque, que era la orden escrita del prompt.» — no se pudo comprobar: cuándo se mide una sesión es orden del prompt y ningún test del árbol la ve

Sesión `jv-j3v`, puesto J3, por encargo del orquestador `cobroflash-backend-5f`. Jira no respondía (el
conector de Atlassian dio `CONNECT_TIMEOUT`): **no he leído el ticket**; todo sale del repo y de la API de
GitHub. El hook de inicio dijo «SIN IDENTIDAD» (SCRUM-1498): seguí con la orden escrita. La rama nació de
la de #2648 (`fbd51095a`) y, cuando #2648 entró (14:41:28Z), se puso al día con `git merge origin/main`.

**Sólo medición.** No toca `tests/`, `scripts/`, `src/` ni workflows. Guiones y salidas en
`docs/master/evidencias/SCRUM-1538d/`: `a-cabeceras.mjs` (baja los primeros 64 KB del log de cada job, con
`Range`, y saca runner, imagen, node, acciones y la BASE de `main` que se probó — el `Merge <rama> into
<base>` del checkout en un PR, el propio sha en un push) y `b-tasas.mjs` (tasas, rachas y los commits de
`main` que entraron alrededor del corte). Los dos llevan siembra: con `--sin-siembra` salen CIEGO (exit 4),
comprobado. Población: el listado de `e-listar.mjs` de 1538c, re-ejecutado (1.029 runs del 6-oct 13:43Z al
21-oct 13:59Z; una llamada falló, run 39244881162 del 19-oct, fuera de la ventana que decide) + los jobs
de los 211 runs limpios hasta las 11:18Z del 16-oct (entrada de 1494c). **984 jobs juzgados, 984 cabeceras
leídas, 0 sin base identificable, las 33 colgadas encontradas** (`a-salida.txt`, `a-jobs-con-cabecera.tsv`).

### Qué NO cambió (descartado para las dos familias)

| | valor en las 33 colgadas | valor después del corte | veredicto |
|---|---|---|---|
| runner | `2.337.0` | `2.337.0` (todos los 984) | no cambió |
| node | `24.21.0` | `24.21.0` (todos) | no cambió |
| `actions/checkout`, `actions/setup-node` | `11d5960a…`, `49933ea5…` | los mismos (todos) | no cambiaron |
| imagen `ubuntu-24.04` | `20260927.320.1` (6 trinquete, 2 tanda) y `20261004.327.1` (17 y 8) | `20261004.327.1` hasta el 15-oct 16:46Z; `20261012.334.1` **desde el 14-oct 16:00Z** | **no explica el corte:** la imagen nueva llega 7 h después de las 09:00Z, y en esas horas, con la MISMA imagen de las colgadas, 0 de 38 trinquetes y 0 de 55 tandas colgaron. Débil por tamaño (con la tasa de esa imagen, ver 0 tiene p ≈ 0,13 y 0,27), pero la hora no casa |
| `ci.yml`, `scripts/trinquete-de-zona.mjs`, `_trinquete-de-zona*.mjs`, `tanda-con-veredicto.mjs` | — | ningún commit de `main` les toca del 5 al 16-oct salvo `package.json` | ver abajo |
| los cuatro tests donde paraba la tanda (`scrum446`, `447`, `615`, `616`) | — | ningún commit desde el 5-oct | descartados como «se arregló el test» |

`package.json` sí cambió cinco veces en la ventana; cuatro son líneas de scripts sueltos (`e2e:critico`,
`parados`, `guard:modo-en-ajustes`, un comentario). **La única que cambia cómo corre algo de CI es #2429**.

### La tanda (`build + tests`): #2429 es el primer commit de `main` tras la última base que colgó

- Última colgada: 14-oct 07:29:56Z, base `6c5b3ad61` (#2761 en primer padre). El commit **siguiente** de
  `main` es `e2be1c9fd` = merge de #2429 (07:47:56Z), que añade `--import=./scripts/tuberia-bloqueante.mjs`
  al `test` de `package.json`: lo carga la tanda de CI (`npm test`) y cada hijo de `node --test`.
- Por base, en la ventana: **sin #2429, 10 colgadas de 369; con #2429, 0 de 138** (y 0 de 333 hasta el
  21-oct según `h-salida.txt` de 1538c). Con la tasa de antes (2,5 %), ver 0 en 331 tiene p ≈ 2,2·10⁻⁴;
  con la de 13-oct→corte (3,7 %), 4,3·10⁻⁶ (`b-salida.txt`). La racha limpia más larga antes del corte fue
  de 78 jobs; después, 331 y sigue.
- 06:00-09:00Z del 14-oct: 2 colgadas y 12 limpias **sin** #2429 en la base; 0 colgadas y 28 limpias **con** él.
- 🔴 **Lo que no se puede separar con estos datos:** contenido y hora van juntos. Desde las 07:48Z toda tanda
  lleva #2429 (un PR se mezcla con el `main` del momento), y ningún job posterior probó una base anterior.
  Así que «lo quitó #2429» y «lo quitó algo del mundo a esa hora» dan la misma tabla. Lo que sí se mide: el
  módulo **sigue en `main`** (leído hoy en `package.json`), así que tampoco hay una retirada que lo refute.
  **El mecanismo (cómo una tubería no bloqueante deja a `node --test` callado 905 s) NO está medido**;
  1405c midió nombres perdidos, no cuelgues. Separarlo pide repetir la tanda sin el `--import` sobre una base
  vieja muchas veces (a ~3 % por tanda, decenas): **no lo he hecho**, es una carrera de CI y no era el encargo.

### El trinquete: #2429 no le llega y su última colgada ya lo llevaba

- El trinquete corre `node scripts/trinquete-de-zona.mjs`, que lanza `_trinquete-de-zona-hijo.mjs` con
  `spawnSync(process.execPath, [HIJO, …])` y éste usa `run({ forceExit: true })`: **no pasa por `npm test`
  y no lleva el `--import`** (leído en `e2be1c9fd`). Y la última colgada (14-oct 08:57:18Z, job
  115768210763) probó la base `ebe2b932c` (#2769), que **contiene** #2429 (`git merge-base --is-ancestor`).
  #2429 queda descartado para esta familia, por código y por contraejemplo; #2426 (1543) también, por base.
- **El trinquete no se apagó el 14-oct: ya se había apagado casi del todo el 13.** Por día: 6-oct 7 de 36,
  7-oct 7 de 75, 8-oct 6 de 56, 9-oct 0 de 25; **del 10 al 12 no hubo CI**; 13-oct 2 de 116 (las dos antes
  de las 07:30Z), 14-oct 1 de 114. Antes del corte la racha limpia más larga es **149, del 13-oct 07:30Z al
  14-oct 08:57Z**: la colgada de las 08:57Z es la única en 150 jobs. La tasa cae del 12 % (6-8 oct) al 1,6 %
  (13-oct→corte) **sin ningún cambio en sus scripts, en `ci.yml`, en el runner, en node ni en la imagen**.
  Con el 1,6 %, ver 0 en 313 tiene p ≈ 6,2·10⁻³: el silencio de después sí es un cambio, pero el grande fue
  entre el 8 y el 13, sobre el que la base sólo dice que las de esos días son anteriores a #2676-#2693.
- «Las dos familias paran a la vez» (tramo 1538c) **es cierto por la última colgada y engañoso por la
  tasa**: la tanda pasa de 3,7 % a 0 en la mañana del 14; el trinquete pasa de 12 % a 1,6 % entre el 8 y el
  13, y tiene un rezagado el 14 a las 08:57. **No hay ninguna causa medida que explique las dos.**

### Respuesta al encargo

| candidato | ¿tanda? | ¿trinquete? |
|---|---|---|
| #2429 (1405c, `--import` de la tubería bloqueante) | **compatible:** primer commit tras la última base colgada; 10/369 sin él, 0/138 con él; mecanismo y separación de la hora SIN MEDIR | **descartado:** no llega a sus procesos, y su última colgada lo llevaba |
| #2426 (1543) y todo `main` hasta #2761 | descartado (bases con colgada) | descartado (hasta #2769) |
| imagen del runner `20261012.334.1` | no casa con la hora (llega a las 16:00Z) | ídem |
| runner, node, acciones, `ci.yml`, scripts del trinquete y de la tanda, los 4 tests | no cambiaron | no cambiaron |
| algo del 8 al 13-oct | — | **SIN MEDIR**: es donde cae el trinquete, y ningún cambio de entorno ni de sus scripts lo explica |

**¿Volverán?** La tanda: si la causa es #2429, sólo si alguien lo quita; eso no está medido. El trinquete:
no sé qué lo quitó, así que no sé si vuelve; desde 1494c (16-oct) si cuelga, nombra el fichero.

### Lo que NO se ha medido

- Nada ejecutado fuera de lectura: API de GitHub (cabeceras de 984 logs, 64 KB cada una) y git local.
- Las 10 colgadas de la tanda no se re-derivan aquí: son las 10 `COLGADA` de `g-clasificar.mjs` de 1538c
  (los 10 logs de `build-failure` de menos de 1,3 MB de su `f-bajados.tsv`); sus ids van copiados en los
  guiones. Las de después del corte se dan por 0 sobre la medición de 1538c (`h-salida.txt`), no re-leída.
- La carga de GitHub, la hora del día, la máquina física y el contenido de los ~1.000 ficheros de test.
- Por qué el trinquete cae entre el 8 y el 13-oct. Jira, entero.

### Mis errores

- **No me medí al acabar la lectura de arranque**, que era la orden. La primera cifra es de ya entrado el
  trabajo: 184.389 (usage del último turno del jsonl). Está en la línea A9 de arriba.
- Mi primera pasada de `b-tasas.mjs` ordenaba los jobs por su hora de ARRANQUE y los runs limpios por la de
  CREACIÓN: la colgada de las 08:57:18Z arrancó a las 09:08Z y salía «1 colgada después del corte». Ahora
  todo va por la hora de creación del run, como en 1538c. Y la primera ventana de `a-cabeceras.mjs` empezaba
  el 12-oct: la imagen vieja (`320.1`) salía con «6 colgadas de 6», un 100 % que era sólo que no había bajado
  sus limpias; con la ventana entera son 6 de 91.

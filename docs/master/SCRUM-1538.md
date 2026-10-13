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

# SCRUM-1496 · Censo de los abiertos de `equipo-javier`: 36 de 57 tienen algo en `main`, 21 no tienen nada, 0 sin mirar

**Medido contra:** `origin/main` = `e883e586d11298ca09d58cd3fa89937b7b0549bd` · 2026-10-07T15:51:15Z

A9: aviso → cicatriz J3 «Escribí un guion en una carpeta de otro carril antes de mirar de quién era: la regla del carril se me cargó DESPUÉS de crear el fichero, y nada lo paró.» — no se pudo comprobar: el hook de carril existe y no saltó al crear un fichero nuevo en `scripts/equipo/`; por qué no saltó no lo he medido, y arreglarlo es del carril S5

J3 (jv-j3), por encargo del orquestador del equipo de Javier. **Es LECTURA: no se ha cerrado, transicionado ni
editado ningún ticket, y no se ha tocado `src/`, ni tests, ni guards, ni workflows.** Tampoco se ha leído el
enunciado de ninguno de los 57: eso es del orquestador (A13). Esto es la foto; decidir es suyo.

## Qué se midió, y con qué

Para cada ticket de la consulta
`project = SCRUM AND labels = "equipo-javier" AND statusCategory != Done AND key >= SCRUM-1300`
(57 claves, `totalCount` 57, `hasNextPage: false`, 57 únicas, de SCRUM-1304 a SCRUM-1481; 29 «En curso»,
26 «Tareas por hacer», 2 «Acción del fundador»; foto tomada el 7-oct-2026 hacia las 15:45Z y guardada en
`docs/master/evidencias/SCRUM-1496/foto-jira-2026-10-07.tsv`), tres hechos:

| columna | qué cuenta | quién lo mide |
|---|---|---|
| commits | commits de `main` que llevan SU número por delante en el asunto (no los de otro ticket que lo citan) | `mirar()` de `scripts/equipo/ya-esta.mjs` (SCRUM-1424/1454), sobre `censarTicket` (SCRUM-388) |
| PR mergeado | PR mergeados cuya RAMA es del ticket, por dos sondas: `gh pr list --state merged` y la primera línea de `main` («Merge pull request #N from …/rama», o «… (#N)» si entró aplastado) | la capa de este ticket + `numeroDeRama` (SCRUM-829) |
| registro | `docs/master/SCRUM-<n>[letra].md` en ese commit de `main` | `mirar()` |

**No se escribió un censo nuevo.** El instrumento ya existía: `scripts/equipo/ya-esta.mjs` contesta por varios
tickets con los mismos tres valores que pedía el encargo, y lo de SCRUM-1259
(`scripts/abierto-con-trabajo-en-main.mjs`) cruza con Jira. A `ya-esta` le faltaban dos cosas para esta tabla: no
llama a `gh` (no tiene columna de PR) y no cita líneas del registro. Eso, y la forma de tabla con el número de
control dentro de la misma pasada, es lo único que añade
`docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs`. Vive en evidencias y no en `scripts/equipo/` porque esa
carpeta es del carril S5.

## El comando para repetirlo

    node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs --jira docs/master/evidencias/SCRUM-1496/foto-jira-2026-10-07.tsv --ref e883e586d11298ca09d58cd3fa89937b7b0549bd --lineas <fichero fuera del árbol>

Con `--ref` repite ESTA medición (todo lo de git sale de ese commit; lo de `gh` no se puede fijar, y para eso está
la segunda sonda). Sin `--ref` mide contra `origin/main` de ese momento, que resuelve una sola vez. Para una foto
nueva de Jira: un TSV `clave<TAB>estado` con lo que devuelva la consulta de arriba. Tarda unos 70 s con 58 números.
Sale 0 si se miró todo y el control salió a cero, y 2 si algo no se pudo mirar o el control no salió a cero.

## Los controles, corridos

| control | qué tenía que pasar | qué pasó |
|---|---|---|
| número inventado, SCRUM-9999, dentro de la misma pasada | tres ceros, «NADA EN MAIN» | commits 0 · PR 0 · registro 0 → NADA EN MAIN |
| los cuatro que el orquestador encontró a mano (1322, 1316, 1304, 1315) | «ALGO EN MAIN» los cuatro | los cuatro ALGO EN MAIN |
| un ticket REAL puesto de control (`--control 1304`) | el instrumento se declara inválido, salida 2 | «EL INSTRUMENTO NO MIDE: la tabla de abajo no vale», salida 2 |
| una referencia que no existe (`--ref no-existe-esta-ref`) | «NO HE PODIDO MIRAR», salida 2 | eso mismo, salida 2 |
| `gh` fuera del PATH | la columna de PR no se lee como cero por esa sonda | lo dice en la cabecera y en cada fila («PR sólo por los merges de main (gh no contestó)»); la columna la da la segunda sonda y la salida es 0 |
| la misma tabla sobre tres bases (`8857fa29`, `531489aa`, `e883e586`; `main` se movió tres veces mientras medía) | las mismas 58 filas | idénticas en las columnas de hecho y en el veredicto (`diff` vacío); las 192 líneas citadas, iguales byte a byte (`cmp`) |

## Lo que salió

**36 ALGO EN MAIN · 21 NADA EN MAIN · 0 NO HE PODIDO MIRAR**, sobre 57.

«ALGO EN MAIN» **no es «hecho»**: dice que hay trabajo con su número dentro. «NADA EN MAIN» **no es «sin hacer»**: puede estar hecho bajo otro número que no lo nombra; eso no lo ve este
instrumento ni el de la casa.

La columna «líneas "queda"» cuenta las líneas del registro que casan con `NO HECHO`, `falta`, `pendiente`,
`sin medir` o `decisión` (sin distinguir mayúsculas; una línea cuenta una vez aunque lleve dos palabras). Las 192
están, con fichero, número de línea y texto entero, en `docs/master/evidencias/SCRUM-1496/lineas-e883e586.tsv`.

| ticket | Jira | commits | PR mergeado | registro | VEREDICTO | líneas «queda» | notas |
|---|---|---|---|---|---|---|---|
| SCRUM-1304 | Tareas por hacer | 8 | 0 | SCRUM-1304.md | **ALGO EN MAIN** | 4 | PR de OTRA rama que lo nombra en el título: #2053 · --grep literal: 9 · 1 commit(s) de OTRO ticket lo citan · evidencias: docs/master/evidencias/scrum1304/ (3) |
| SCRUM-1310 | Acción del fundador | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1311 | Tareas por hacer | 3 | #2036 | SCRUM-1311.md | **ALGO EN MAIN** | 2 |  |
| SCRUM-1313 | En curso | 3 | #2038 | SCRUM-1313.md | **ALGO EN MAIN** | 2 | PR de OTRA rama que lo nombra en el título: #2075 · --grep literal: 5 · 1 commit(s) de OTRO ticket lo citan |
| SCRUM-1314 | Acción del fundador | 0 | 0 | 0 | **NADA EN MAIN** |  | sin registro propio; lo nombran: SCRUM-1315.md |
| SCRUM-1315 | Tareas por hacer | 2 | #2031 | SCRUM-1315.md | **ALGO EN MAIN** | 2 |  |
| SCRUM-1316 | Tareas por hacer | 2 | #2035 | SCRUM-1316.md | **ALGO EN MAIN** | 3 |  |
| SCRUM-1319 | Tareas por hacer | 3 | #2040 | SCRUM-1319.md | **ALGO EN MAIN** | 4 | --grep literal: 2 |
| SCRUM-1320 | Tareas por hacer | 4 | #2046 | SCRUM-1320.md | **ALGO EN MAIN** | 4 |  |
| SCRUM-1321 | En curso | 10 | #2043 | SCRUM-1321.md | **ALGO EN MAIN** | 6 | --grep literal: 8 · evidencias: docs/master/evidencias/scrum1321/ (13) |
| SCRUM-1322 | En curso | 4 | #2041 | SCRUM-1322.md | **ALGO EN MAIN** | 10 | --grep literal: 3 |
| SCRUM-1323 | En curso | 8 | #2044 | SCRUM-1323.md | **ALGO EN MAIN** | 3 | --grep literal: 6 |
| SCRUM-1324 | En curso | 11 | #2047 | SCRUM-1324.md | **ALGO EN MAIN** | 3 | --grep literal: 8 · evidencias: docs/master/evidencias/SCRUM-1324/ (8) |
| SCRUM-1327 | En curso | 10 | #2061 | SCRUM-1327.md | **ALGO EN MAIN** | 1 | --grep literal: 9 · evidencias: docs/master/evidencias/scrum1327/ (25) |
| SCRUM-1328 | En curso | 4 | #2070 | SCRUM-1328.md | **ALGO EN MAIN** | 2 | --grep literal: 3 · evidencias: docs/master/evidencias/scrum1328/ (21) |
| SCRUM-1329 | En curso | 6 | #2052 | SCRUM-1329.md | **ALGO EN MAIN** | 3 | --grep literal: 4 |
| SCRUM-1330 | Tareas por hacer | 14 | #2053 | SCRUM-1330.md | **ALGO EN MAIN** | 3 | --grep literal: 12 · 1 commit(s) de OTRO ticket lo citan · evidencias: docs/master/evidencias/scrum1330/ (3) |
| SCRUM-1331 | En curso | 15 | #2058 | SCRUM-1331.md | **ALGO EN MAIN** | 4 | --grep literal: 13 · evidencias: docs/master/evidencias/scrum1331/ (8) |
| SCRUM-1332 | En curso | 4 | #2059 | SCRUM-1332.md | **ALGO EN MAIN** | 4 | --grep literal: 3 · evidencias: docs/master/evidencias/scrum1332/ (19) |
| SCRUM-1335 | En curso | 7 | #2055 #2226 | SCRUM-1335.md | **ALGO EN MAIN** | 12 | --grep literal: 5 · evidencias: docs/master/evidencias/SCRUM-1335/ (13) · evidencias: docs/master/evidencias/SCRUM-1335b/ (4) |
| SCRUM-1336 | En curso | 17 | #2116 | SCRUM-1336.md | **ALGO EN MAIN** | 4 | evidencias: docs/master/evidencias/scrum1336/ (100) |
| SCRUM-1339 | En curso | 27 | #2066 #2114 #2118 #2123 | SCRUM-1339.md | **ALGO EN MAIN** | 41 | --grep literal: 26 · evidencias: docs/master/evidencias/SCRUM-1339/ (89) |
| SCRUM-1341 | En curso | 1 | #2112 | SCRUM-1341.md | **ALGO EN MAIN** | 2 | PR de OTRA rama que lo nombra en el título: #2062 · --grep literal: 3 · 1 commit(s) de OTRO ticket lo citan |
| SCRUM-1344 | En curso | 3 | #2119 | SCRUM-1344.md | **ALGO EN MAIN** | 1 | --grep literal: 4 · 2 commit(s) de OTRO ticket lo citan · evidencias: docs/master/evidencias/scrum1344/ (14) |
| SCRUM-1345 | En curso | 5 | #2069 | SCRUM-1345.md | **ALGO EN MAIN** | 6 | PR de OTRA rama que lo nombra en el título: #2117 · --grep literal: 7 · 1 commit(s) de OTRO ticket lo citan · evidencias: docs/master/evidencias/SCRUM-1345/ (22) |
| SCRUM-1346 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  | --grep literal: 2 · sin registro propio; lo nombran: SCRUM-1341.md SCRUM-1390.md SCRUM-1397.md SCRUM-1403.md |
| SCRUM-1347 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  | sin registro propio; lo nombran: SCRUM-1390.md |
| SCRUM-1387 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  | sin registro propio; lo nombran: SCRUM-1394.md |
| SCRUM-1389 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1390 | En curso | 7 | #2115 | SCRUM-1390.md | **ALGO EN MAIN** | 10 | --grep literal: 9 · 2 commit(s) de OTRO ticket lo citan |
| SCRUM-1391 | En curso | 6 | #2117 | 0 | **ALGO EN MAIN** | sin registro | --grep literal: 5 · evidencias: docs/master/evidencias/SCRUM-1391/ (29) · sin registro propio; lo nombran: SCRUM-1345.md SCRUM-1394.md |
| SCRUM-1392 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1393 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1394 | Tareas por hacer | 5 | #2120 | SCRUM-1394.md | **ALGO EN MAIN** | 0 | --grep literal: 4 · evidencias: docs/master/evidencias/SCRUM-1394/ (8) |
| SCRUM-1395 | En curso | 6 | #2224 | SCRUM-1395.md | **ALGO EN MAIN** | 7 | --grep literal: 5 · evidencias: docs/master/evidencias/scrum1395/ (8) |
| SCRUM-1396 | En curso | 0 | 0 | 0 | **NADA EN MAIN** |  | rama VIVA sin mergear: scrum-1396-censo-mkdtemp-por-variable (+1) |
| SCRUM-1401 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  | sin registro propio; lo nombran: SCRUM-1400.md |
| SCRUM-1402 | En curso | 8 | #2222 | SCRUM-1402.md | **ALGO EN MAIN** | 5 | --grep literal: 6 · evidencias: docs/master/evidencias/scrum1402/ (3) |
| SCRUM-1403 | En curso | 9 | #2130 | SCRUM-1403.md | **ALGO EN MAIN** | 6 | --grep literal: 8 |
| SCRUM-1404 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  | sin registro propio; lo nombran: SCRUM-1397.md |
| SCRUM-1405 | En curso | 12 | #2131 | SCRUM-1405.md | **ALGO EN MAIN** | 7 | --grep literal: 11 · evidencias: docs/master/evidencias/SCRUM-1405/ (96) |
| SCRUM-1406 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  | sin registro propio; lo nombran: SCRUM-1402.md |
| SCRUM-1408 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1410 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1446 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  | --grep literal: 1 · sin registro propio; lo nombran: SCRUM-624.md |
| SCRUM-1447 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1448 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1449 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1455 | En curso | 3 | 0 | SCRUM-1455.md | **ALGO EN MAIN** | 9 | PR de OTRA rama que lo nombra en el título: #2223 · --grep literal: 4 |
| SCRUM-1456 | En curso | 6 | #2223 | SCRUM-1456.md | **ALGO EN MAIN** | 5 | 1 commit(s) de OTRO ticket lo citan |
| SCRUM-1457 | En curso | 0 | 0 | SCRUM-1457.md | **ALGO EN MAIN** | 8 | --grep literal: 1 |
| SCRUM-1470 | En curso | 5 | 0 | SCRUM-1470.md | **ALGO EN MAIN** | 7 | PR de OTRA rama que lo nombra en el título: #2220 · --grep literal: 6 |
| SCRUM-1471 | En curso | 0 | 0 | SCRUM-1471.md | **ALGO EN MAIN** | 2 | PR de OTRA rama que lo nombra en el título: #2220 · --grep literal: 4 · 3 commit(s) de OTRO ticket lo citan |
| SCRUM-1472 | En curso | 5 | #2220 | SCRUM-1472.md | **ALGO EN MAIN** | 0 | --grep literal: 3 · 2 commit(s) de OTRO ticket lo citan |
| SCRUM-1477 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1478 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-1481 | Tareas por hacer | 0 | 0 | 0 | **NADA EN MAIN** |  |  |
| SCRUM-9999 (control) |  | 0 | 0 | 0 | **NADA EN MAIN** |  | --grep literal: 1 · sin registro propio; lo nombran: SCRUM-1395.md SCRUM-1474.md SCRUM-925.md |

## El tablero contra el árbol, en las dos direcciones

| Jira dice | el árbol dice | cuántos | cuáles |
|---|---|---|---|
| Tareas por hacer | ALGO EN MAIN | 8 | 1304 1311 1315 1316 1319 1320 1330 1394 |
| En curso | ALGO EN MAIN | 28 | 1313 1321 1322 1323 1324 1327 1328 1329 1331 1332 1335 1336 1339 1341 1344 1345 1390 1391 1395 1402 1403 1405 1455 1456 1457 1470 1471 1472 |
| En curso | NADA EN MAIN | 1 | 1396 (tiene una rama VIVA sin mergear, `scrum-1396-censo-mkdtemp-por-variable`, +1 commit) |
| Tareas por hacer | NADA EN MAIN | 18 | 1346 1347 1387 1389 1392 1393 1401 1404 1406 1408 1410 1446 1447 1448 1449 1477 1478 1481 |
| Acción del fundador | NADA EN MAIN | 2 | 1310 1314 |

Los ocho de la primera fila son donde el tablero dice «sin empezar» y el árbol dice que hay trabajo dentro:
son los que un reparto leído de Jira volvería a encargar. Tres de los cuatro que encontró el orquestador a mano
están ahí (1304, 1315, 1316); el cuarto, 1322, está «En curso».

Tres filas de «ALGO EN MAIN» se sostienen con MENOS de tres columnas, y se dice cuáles:

- **SCRUM-1457 y SCRUM-1471: sólo el registro.** Cero commits suyos y cero PR de rama suya. Su trabajo entró en el
  PR de un hermano (#2223, rama de 1456; #2220, rama de 1472) con commits que llevan por delante el número del
  hermano. Es la trampa de A17 vista desde el censo: tres tickets en una rama dejan dos sin rastro propio.
- **SCRUM-1391: sin registro propio.** 6 commits, PR #2117 y 29 ficheros en `docs/master/evidencias/SCRUM-1391/`;
  lo que hay escrito de él está dentro de `SCRUM-1345.md` y `SCRUM-1394.md`.
- **SCRUM-1304, 1455 y 1470: sin PR de rama suya.** Entraron por la rama de otro (#2053, #2223, #2220), que los
  nombra en el título.

## SCRUM-1335: la etiqueta dice una cosa y el dueño es otro

Sale en la consulta porque lleva `equipo-javier` y `area-j6`. Según el orquestador, el comentario 18387 de Luis lo
asignó a su S3 el 6-oct sin cambiar las etiquetas. Se ha censado (es lectura) y **no se le ha tocado nada**. Lo que
dice el árbol: 7 commits, PR #2055 y #2226, registro `SCRUM-1335.md`. El dato del dueño real no lo he medido yo: es
del orquestador.

## Las dos sondas, y dónde discrepan

El encargo traía tres comandos literales. Pasaron a ser la segunda sonda, y la discrepancia va en la columna de
notas de cada fila. Lo medido:

- **`git log --grep="SCRUM-<n>"` no pasa el control del número inventado: da 1 para SCRUM-9999**
  (`9e47c9f9a`, un commit de SCRUM-1397 que lo lleva en el cuerpo). Busca también en el CUERPO del commit, así
  que cuenta a otro ticket que cita éste (1346 da 2 y 1446 da 1, sin un solo commit suyo). Y distingue mayúsculas,
  así que NO cuenta los «Merge pull request … /scrum-<n>-…». Por las dos cosas, en 32 de las 57 filas (y en la
  del control) su número no coincide con el de commits propios, unas veces por más y otras por menos.
- **`grep "SCRUM-<n>.md"` y los registros con letra: un borde que anuncié SIN medir, y su población es CERO.** Le
  dije al orquestador que ese patrón «no ve `SCRUM-1339e.md`». Medido después sobre `e883e586`: en `docs/master/`
  hay 1.042 registros `SCRUM-<n>.md` y **ninguno** `SCRUM-<n><letra>.md` (las partes con letra se ANEXAN al
  registro del número, A8). El patrón es frágil en teoría y hoy no pierde nada. El error es mío: di por población
  un caso que no existe.
- **Mi segunda sonda de PR estaba ciega a los PR aplastados.** La primera versión sólo leía commits de merge, y
  SCRUM-1341 salió con «gh dice #2112 y los merges de main ninguno»: #2112 entró aplastado (un commit de un solo
  padre cuyo asunto acaba en «(#2112)»). Lo cazó la discrepancia entre las dos sondas. Ahora lee también esa
  forma, y en la pasada final las dos coinciden en las 58 filas.
- **`gh pr list` llega a su tope de 1.000** (del #1239 al #2260): no ve PR anteriores. Para esta población no
  importa (el PR más antiguo que aparece es el #2031), pero para tickets viejos la que manda es la sonda de
  `main`, que lee 2.187 PR desde el #1. La cabecera de la salida lo avisa.

## Lo que NO se ha hecho y lo que NO se ha medido

- No se ha leído el enunciado ni los comentarios de ninguno de los 57: «ALGO EN MAIN» no dice si el ticket está
  terminado, y la columna de líneas es para decidir cuáles mirar primero, no un veredicto.
- No se ha buscado por CONTENIDO: un ticket hecho bajo otro número que no lo nombra sale «NADA EN MAIN».
- Un PR de varios tickets cuyo título no escribe «SCRUM-» delante de cada número (el #2223 dice «1455, 1456 y
  1457») no se ve como «lo nombra en el título» para los que van sin prefijo: por eso 1457 no lleva esa nota.
- La columna de líneas cuenta TEXTO: «falta» casa con «faltan» y con «faltaba», y en SCRUM-1339 (41 líneas) es el
  propio tema del ticket, que va de casos que faltan en un informe. Un número alto ahí no dice «queda más».
- La capa no tiene tests propios: el encargo era de lectura y no tocar tests. Lo que la sostiene son los seis
  controles de arriba, corridos a mano. Sus cuatro funciones puras (`lineasQueQuedan`, `prDelMerge`,
  `prDelAplastado`, `veredictoDeFila`) están exportadas para quien quiera atarlas.
- El hook de carril no me paró al crear un fichero nuevo en `scripts/equipo/` (S5). Lo moví antes de comitear. Por
  qué no saltó no lo he medido; se lo paso al orquestador.
- Nada que ver en yaqu.app: no cambia nada de lo que se sirve.

## Aceptación → dónde se ve

| lo pedido | dónde se ve |
|---|---|
| Una fila por ticket con commits, PR mergeado, registro y veredicto de tres valores | `docs/master/evidencias/SCRUM-1496/salida-e883e586.md` y la tabla de arriba |
| Para los de «ALGO EN MAIN», las líneas del registro citadas, no resumidas | `docs/master/evidencias/SCRUM-1496/lineas-e883e586.tsv` (192) y la sección de abajo (las 24 de «NO HECHO») |
| El número inventado sale a cero en las tres columnas | segunda línea de la tabla de controles; fila `SCRUM-9999 (control)` |
| El comando exacto para repetirlo | sección «El comando para repetirlo» |
| Buscar primero si ya existía un censo | sección «Qué se midió, y con qué» |
| Script reutilizable en `scripts/` | NO HECHO → `scripts/equipo/` es del carril S5; la capa queda en evidencias y moverla se le pide a su dueña |

## Las 24 líneas que dicen «NO HECHO», citadas

Literales, cortadas a 230 caracteres donde lleva «[…]»; la línea entera está en el TSV.

- `docs/master/SCRUM-1316.md:208` — ## Ⓖ Lo que sigue abierto en el ticket (no hecho aquí)
- `docs/master/SCRUM-1319.md:22` — ¦ **S1-D** ¦ «S1-D ✅ DECIDIDO 2026-09-16 (fundador): la representación…» ¦ «S1-D ~~✅~~ 🟡 NO HECHO — la VÍA está DECIDIDA 2026-09-16 (fundador): la representación…», con la decisión **entera y sin tocar**, y una nota fechada que d […]
- `docs/master/SCRUM-1319.md:35` — S1-0 🟡 · S1-0b ✅ · S1-A ✅ · S1-B ✅ · S1-C ✅ · S1-D ~~✅~~ 🟡 NO HECHO · S1-E 🟡 · S1-F ⏳ · S1-G ⏳ · S1-H 🟡
- `docs/master/SCRUM-1335.md:119` — - **El experimento que la separa** (no hecho; toca un workflow, así que pide GO y afecta a los dos
- `docs/master/SCRUM-1395.md:141` — ¦ ⑥ La línea que sale SIEMPRE: «N guards mirados · K mudos» ¦ **NO HECHO en esa unidad** → la línea del caso ① dice «N llaman al filtro · K sin suelo», que es lo que se puede medir en la tanda. «K mudos» sólo lo dicta `censo:mudez […]
- `docs/master/SCRUM-1455.md:27` — ¦ `:549` ¦ `PUT /:id/status` ¦ NO HECHO → al fundador (SCRUM-1456 c.18414) ¦
- `docs/master/SCRUM-1455.md:28` — ¦ `:593` ¦ `POST /:id/pay` ¦ NO HECHO → al fundador (c.18414) ¦
- `docs/master/SCRUM-1455.md:29` — ¦ `:614` ¦ `POST /:id/unpay` ¦ NO HECHO → al fundador (c.18414) ¦
- `docs/master/SCRUM-1455.md:30` — ¦ `:873` ¦ `POST /:id/annul` ¦ NO HECHO → al fundador (c.18414: camino de sellado) ¦
- `docs/master/SCRUM-1455.md:31` — ¦ `:1025` ¦ `POST /:id/rectify` ¦ NO HECHO → al fundador (c.18414: camino de sellado) ¦
- `docs/master/SCRUM-1455.md:32` — ¦ `:309` ¦ `POST /:id/payment-anomaly` ¦ NO HECHO: c.18414 no la nombra en ninguna de sus dos listas, así que no está autorizada ¦
- `docs/master/SCRUM-1455.md:33` — ¦ `:1188` ¦ `POST /:id/regenerate-pdf` ¦ NO HECHO → al fundador (c.18414: camino de sellado) ¦
- `docs/master/SCRUM-1455.md:35` — ¦ `:698` ¦ `POST /:id/send-email` ¦ **NO HECHO, aunque c.18414 lo autoriza**: hoy contesta 200 con `sent: false`, no 500, y pasarlo a 400 cambia lo que hace la pantalla. La condición del GO era parar si algo reaccionaba ¦
- `docs/master/SCRUM-1455.md:37` — ¦ `invoicing/app/routes/invoice.routes.ts:63` ¦ `POST /:id/paid-webhook` ¦ NO HECHO → al fundador (c.18414: webhook) ¦
- `docs/master/SCRUM-1456.md:48` — ¦ `customersAdmin.routes.ts` `:600` (`DELETE /:id`) y `:638` (`POST /:id/fusionar`) — datos de clientes ¦ 2 ¦ 3 ¦ **NO HECHO → al fundador** (c.18414: datos de clientes) ¦
- `docs/master/SCRUM-1456.md:49` — ¦ `chargesAdmin.routes.ts` `:34` `:117` `:167` (confirmar Bizum, garantía, liberar garantía) — flujo de cobro ¦ 3 ¦ 3 ¦ **NO HECHO, y es decisión mía** (Ⓗ): el orquestador las autoriza en c.18414, pero son flujo de cobro y la para […]
- `docs/master/SCRUM-1456.md:50` — ¦ `psp.routes.ts:36` — el webhook interno del cobro; es la ÚNICA de las seis de webhook que lleva el id a la base ¦ 1 ¦ 1 ¦ **NO HECHO → al fundador** (c.18414: dinero real) ¦
- `docs/master/SCRUM-1456.md:162` — - **`chargesAdmin`, NO hecho, y es decisión mía.** Confirmar un Bizum y la garantía son flujo de cobro.
- `docs/master/SCRUM-1457.md:18` — ¦ `system/app/routes/supresion.routes.ts:34` ¦ `prisma.merchant.findUnique`, detrás del flag `MERCHANT_DELETE_ENABLED` y de la comparación con `req.merchantId` ¦ NO HECHO → al fundador (SCRUM-1456 c.18414: borrado de datos) ¦
- `docs/master/SCRUM-1457.md:19` — ¦ `billing/app/routes/stripe.routes.ts:97` ¦ `prisma.merchant.update` (suscripción nueva) ¦ NO HECHO → **decisión**, abajo ¦
- `docs/master/SCRUM-1457.md:20` — ¦ `stripe.routes.ts:139` ¦ `prisma.merchant.update` (`customer.subscription.*`) ¦ NO HECHO → **decisión**, abajo ¦
- `docs/master/SCRUM-1457.md:21` — ¦ `stripe.routes.ts:177` ¦ `prisma.merchant.update` (`customer.subscription.deleted`) ¦ NO HECHO → **decisión**, abajo ¦
- `docs/master/SCRUM-1470.md:66` — ¦ 2. Decidido por J1 con su jefe qué día imprime el PDF de la FACTURA, y escrito en este ticket. ¦ NO HECHO → el fundador, por el orquestador de Javier. Este ticket no se cierra: se parte. ¦
- `docs/master/SCRUM-1471.md:53` — ¦ 2. La fecha del presupuesto y de la factura en el portal es la misma que imprime su PDF. ¦ Presupuesto: el mismo test, «SCRUM-1471 · la fecha del presupuesto en el portal…» (el PDF del presupuesto no imprime fecha de creación; s […]

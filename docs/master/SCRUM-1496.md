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

## 14-oct-2026 · SCRUM-1496c · De los que tienen algo en `main`, cuáles están TERMINADOS: 41 de 132

**Medido contra:** `origin/main` = `76c29b57c871584b04c8206c11571f9c56c9d699` · 2026-10-14T06:55:34Z

A9: aviso → cicatriz J3 «Di por TERMINADO un control porque el orquestador lo esperaba así, antes de aplicarle el criterio que aplicaba a los otros 131: lo deshice al ver que el mismo hueco dejaba a otros en LE FALTA ALGO.» — no se pudo comprobar: decidir si un hueco es una parte del enunciado o una decisión de quien cierra es un juicio; lo que queda es que el criterio está escrito antes de leer y los controles no van en él

J3 (`jv-j3h`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-2e`). **Es LECTURA.** No
se ha cerrado, transicionado ni etiquetado ningún ticket, y no se ha tocado `src/`, ningún test, guard o
workflow, ninguna base de datos ni el esquema. El hook de inicio dijo **SIN IDENTIDAD**; es SCRUM-1549 y se
construyó con la orden escrita del orquestador.

La pregunta del fundador era: «¿por qué no le damos caña y bajamos ese número?». La respuesta: **de los 132
abiertos con algo en `main`, 41 están terminados y solo les falta cerrarse. A 91 les falta algo. 0 sin
mirar.** Y de esos 91 hay 8 a los que solo les falta una decisión o una verificación del propio orquestador.

### La población, otra vez

- **Jira, 06:54Z.** Misma consulta que en SCRUM-1550 (`project = SCRUM AND labels = "equipo-javier" AND
  statusCategory != Done`), dos páginas, `hasNextPage: false`: **172** abiertos, 172 claves únicas
  (97 «Tareas por hacer», 53 «En curso», 19 «Acción del fundador», 3 «En revisión»). Frente a la foto de
  las 03:31Z entran 1543, 1551, 1552, 1553 y 1554, y no sale ninguno. Foto con etiquetas en
  `docs/master/evidencias/SCRUM-1496c/foto-jira-2026-10-14T0654Z.tsv`.
- **El censo por número**, con el mismo instrumento (`docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs
  --ref 76c29b57c…`), en 5 min: **132 ALGO EN MAIN · 40 NADA EN MAIN · 0 NO HE PODIDO MIRAR**. El control
  SCRUM-9999 sale con las tres columnas a cero. Están en `tabla-por-numero-76c29b57c.md` y en
  `lineas-76c29b57c.tsv` (973 líneas «queda» citadas). **La población de este tramo son los 132**, no los
  128 de las 03:31Z.

### Cómo se decidió, y no es un censo nuevo

No hay instrumento que decida «terminado»: eso es leer el enunciado. Las tres columnas las da el censo de
siempre (arriba). Lo que se añadió es la LECTURA. Once lectores, uno por lote de 12, leyeron cada ticket con
el mismo criterio, escrito antes de empezar y guardado tal cual en
`docs/master/evidencias/SCRUM-1496c/criterio-de-lectura.md`. El criterio: descripción y comentarios enteros;
las partes, una por una; cada parte verificada por EFECTO en `76c29b57c` (fichero:línea), no por el merge;
un «NO HECHO» / falta / pendiente / sin medir del registro sobre una parte del encargo, o una decisión
pedida sin rastro de que se tomó, hace que NO esté terminado; una rama viva sin mergear con trabajo pedido
tampoco (regla 42). **Los controles del orquestador NO iban en el criterio**: los lectores no sabían qué
tenía que salir. La salida de los once, sin retocar, está en `veredictos-por-lote.md` (132 filas).

### Los controles, corridos

| control | tenía que salir | salió | |
|---|---|---|---|
| SCRUM-9999 | no aparece | no está en la foto de Jira; en el censo, tres ceros | ✅ |
| SCRUM-1339 | NO terminado (falta una decisión) | LE FALTA ALGO: la señal solo avisa (60 %), la revisión del 15-oct y la salida de 1405 §⑤ sin tomar | ✅ |
| SCRUM-1405 | NO terminado (falta una decisión) | LE FALTA ALGO: la salida C está decidida (c.19584) y sin construir | ✅ |
| SCRUM-1536 | LE FALTA ALGO: el ② | LE FALTA ALGO: «El ② NO está contestado» (c.19534) | ✅ |
| SCRUM-1496 | LE FALTA ALGO: fila NO HECHO hacia S5 | LE FALTA ALGO: `SCRUM-1496.md:204` «Script reutilizable en `scripts/` \| NO HECHO» | ✅ |
| SCRUM-1471, 1538 | hechos y en `main` (veredicto sin dar) | los dos LE FALTA ALGO: 1471 la parte de la factura, que espera a la aceptación 2 de 1470 (`SCRUM-1471.md:53`); 1538 dos causas «NO HECHO → sin dueño» (`SCRUM-1538.md:175-176`) | — |
| **SCRUM-1515** | **TERMINADO** | **LE FALTA ALGO**: solo una decisión TUYA | 🔴 |
| **SCRUM-1331** | **TERMINADO** | **LE FALTA ALGO**: solo una decisión TUYA | 🔴 |

**Los dos rojos los he releído yo, enteros, y mantengo el veredicto de los lectores:**

- **1515.** Las partes ①②③ y las aceptaciones 1, 2 y 4 de c.18971 están en `main`. La 3 («login y
  verificación… visto en ejecución») está ejecutada contra Postgres en el obligatorio de #2324 (c.18996).
  Pero c.18996 escribe, en su propia tabla de aceptación: «En yaqu.app: … el login completo, **NO HECHO →
  lo decide el orquestador** (pide un correo real)». Hay una decisión abierta y es tuya. Si decides que el
  obligatorio basta, se cierra.
- **1331.** ①②④ están en `main` y la población de ③ está medida por ejecución (1.146 ficheros, 1 llama a la
  red al cargar). Pero `SCRUM-1331.md:136`, «## 6 · Lo que NO está hecho, dicho», confiesa un límite de esa
  misma población: «Los 6 ficheros que lanzan `node`/`bash`/`tar` al cargar: la sonda ve que se lanzan, no
  lo que hacen dentro». Aceptar ese límite o pedir que se mida es decisión de quien cierra.

**Por qué no los paso a TERMINADO para que cuadre el control:** con el mismo criterio que a los otros 130,
caen en el grupo de abajo (el hueco es tuyo). Darlos por terminados obligaría a cambiar de criterio en
otros seis tickets. Si tu medición de anoche vale más que mi lectura, gana la tuya, pero dímelo y los
muevo los ocho juntos, no estos dos sueltos.

### ✅ TERMINADOS: 41, se pueden cerrar

`529` `1018` `1022` `1104` `1108` `1110` `1113` `1116` `1119` `1120` `1126` `1128` `1130` `1214` `1245`
`1246` `1253` `1258` `1259` `1304` `1313` `1315` `1319` `1321` `1323` `1327` `1329` `1336` `1344` `1345`
`1392` `1394` `1472` `1477` `1478` `1481` `1514` `1537` `1548` `1550` `1551`

Cada uno, con sus partes y su fichero:línea, está en `veredictos-por-lote.md`. Los que llevan algo que debes
saber ANTES de cerrar:

- **1304** (la cicatriz): el arreglo SÍ está. `src/lib/invoicing.ts` toma `tomarCerrojoDeSerie` y busca la
  factura del cobro con `findFirst({ chargeId, merchantId })` antes de emitir, y avisa con `console.error`
  si ya existía. Hay test, `tests/scrum1304-un-cobro-una-factura.test.mjs`. Entró por #2053 (SCRUM-1330),
  y `bee39d3b5` es ancestro de `76c29b57c`. Comprobado por mí.
- **1477**: el registro dice «NO HECHO» en la ④ (`SCRUM-1477.md:134`, «avisado en SCRUM-1465 cuando esté
  en `main`»). Está caducado: el aviso es SCRUM-1465 c.18790 (7-oct). Comprobado por mí en Jira.
- **1551**: `SCRUM-1551.md:326` dice «aplicar | NO HECHO, por mandato». Aplicar no era parte del encargo, que
  pedía PROPONER sin aplicar (④). R1-R6 y D1 viven ahora en SCRUM-1554.
- **1319**: su «NO HECHO» es el TEXTO que el ticket mandaba escribir en el máster («S1-D ~~✅~~ 🟡 NO HECHO»,
  `docs/YAQU_MASTER.md:986`), no una falta.
- **529**: `SCRUM-529.md:42` «Verlo en yaqu.app · NO HECHO → no hay pantalla que lo enseñe». No es una parte
  de su «Hecho =», y no hay pantalla donde verlo.
- **1259**: nada por construir, pero `SCRUM-1259.md:187` dice «Sigue abierto como sede de este barrido, por
  decisión del orquestador». Ciérralo solo si esa decisión ya no vale.
- **1537**: la rama `scrum-1537-los-dos-cotejos` sigue viva. Es la del #2380, que se cerró sustituido por el
  #2385, que sí entró. Antes de cerrar, borrar esa rama o declararla muerta (regla 42).
- **1108**: la «lista» de su ③ se leyó como lo que manda el servidor por fila; la pantalla de «quién me
  debe» no existe. Si «lista» quería decir pantalla, deja de estar terminado.
- **1126, 1130**: terminados por enunciado; no consta verificación en yaqu.app tras el merge (lo dicen sus
  registros).
- **1550 y 1496 son de J3, como yo.** 1550 sale TERMINADO por un lector, no por mí. «Quien cierra no
  clasifica su propio “no lo vi”»: míralo tú.
- Estados de Jira caducados (el trabajo los dejó atrás): 1018 y 1022 dicen «Acción del fundador», y en
  1116, 1253, 1548, 1550 y 1551 sobran etiquetas `stop-fundador`, `decision-jefe`, `sin-firma` o
  `listo-para-construir`.

### 🔴 LE FALTA ALGO: 91

Cada uno, con lo que le falta y su cita, en `veredictos-por-lote.md`. **Solo te falta a ti (8): una decisión
o una verificación del orquestador, sin nada que construir:**

| ticket | lo único que falta |
|---|---|
| 1515 | decidir si el login a mano en yaqu.app hace falta (c.18996) |
| 1331 | aceptar el límite de los 6 ficheros con hijos al cargar, o pedir que se mida (`SCRUM-1331.md:136`) |
| 1341 | verlo en yaqu.app con sesión de Técnico: «NO HECHO → … lo decide el orquestador» (c.17940) |
| 1249 | la verificación en yaqu.app tras el merge (`SCRUM-1249.md:118`); el código está completo |
| 1257 | verlo en pantalla con sesión: «NO HECHO → pide una sesión iniciada» (c.17953) |
| 1391 | aceptar `staging-gated` como SIN JUZGAR entera (`SCRUM-1345.md:236`) o darle turno |
| 1328 | decidir si se cierra como duplicado de SCRUM-1289 (propuesto en c.17710) |
| 1538 | decidir quién mide las dos causas «NO HECHO → sin dueño» (`SCRUM-1538.md:175-176`) |

Los 83 restantes tienen algo sin construir, una decisión del fundador sin tomar (los 11 que siguen en «Acción del
fundador» esperan lo que dice su fila), el asesor, otro
carril (1503 a S3, 1505 a S5, 1092 a los dos equipos), o una rama viva sin mergear (534 con #2425, 1553 con
`scrum-1553b-la-consulta-vacia`).

### ⚠️ NO HE PODIDO MIRAR: 0

Los 132 se leyeron. Que salga cero no quiere decir que todo se pudiera verificar a fondo, y lo digo abajo.

### Lo que NO se ha hecho y lo que NO se ha medido

- **El veredicto de 128 de los 132 es de un lector, no mío.** Yo releí entero 1515 y 1331 (los dos controles
  rojos), comprobé por efecto 1304 y 1477, y leí en contexto los «NO HECHO» de los TERMINADOS 1319, 1477,
  529 y 1551. Los otros 37 TERMINADOS no los ha leído una segunda persona. Antes de cerrar, lee el
  enunciado (A13): esto es la lista de por dónde empezar, no un permiso.
- **«TERMINADO» lo juzga el lector contra el ENUNCIADO, no contra el protocolo.** Un ticket cuyo enunciado no
  pedía verlo en yaqu.app sale terminado aunque nadie lo haya visto allí (1126 y 1130 lo declaran).
- **Los 40 NADA EN MAIN no se han mirado aquí.** De 38 de ellos ya se ocupó SCRUM-1550 por contenido, y los
  57 que esperan al fundador los audita otra sesión.
- La foto de Jira y la lectura no son del mismo instante: Jira es de las 06:54Z y los lectores leyeron
  comentarios hasta las ~07:30Z. Un comentario posterior a esa hora no está mirado.
- El instrumento del censo no se ha cambiado. La capa de contenido de SCRUM-1550 no hizo falta: sirve para
  los NADA, y aquí todos son ALGO.

### Aceptación (del encargo de `cobroflash-backend-2e`) → dónde se ve

| lo pedido | dónde se ve |
|---|---|
| re-medir el 128 | «La población, otra vez»: 132 de 172 a las 06:54Z |
| tres veredictos por ticket, con evidencia | `docs/master/evidencias/SCRUM-1496c/veredictos-por-lote.md` y las tres secciones de arriba |
| enunciado entero, cada parte por efecto | `criterio-de-lectura.md` (escrito antes) y la columna de partes de cada fila |
| los controles | tabla «Los controles, corridos»: 5 bien, 2 en rojo y explicados |
| la población declarada | 132 clasificados · 0 sin mirar · 128 por un lector, 4 releídos por mí |
| reusar `tabla-ya-esta.mjs` | «La población, otra vez» |

## 20-oct-2026 · SCRUM-1496d · Los 169 abiertos de `equipo-javier`, en cuatro veredictos: 42 TERMINADOS, 50 TRABAJO, 77 ESPERAN, 0 sin mirar

**Medido contra:** `origin/main` = `dc1b2b4db78e75b1af0fcbc495912b29395938af` · 2026-10-20T09:14:22Z

A9: aviso → cicatriz J4 «conté a quién esperan los 77 ESPERA buscando «fundador» en la fila entera y casó con el rótulo «ESPERA AL FUNDADOR» del propio veredicto: el recuento salía inflado por mi columna, no por el dato» — no se pudo comprobar: la cuenta es una línea de node de un solo uso fuera del repo; lo cazó que dos lotes de solo asesor salían con fundador

J4 (`jv-j4a`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-2e`). **Es LECTURA.** No se ha
cerrado, transicionado, comentado ni etiquetado ningún ticket, y no se ha tocado `src/`, ningún test, guard o
workflow, el esquema ni ninguna base. La pregunta: de los abiertos de `equipo-javier`, cuáles están TERMINADOS y
solo les falta cerrarse, y cuáles son TRABAJO que se puede repartir hoy. Viene de SCRUM-1543: estaba arreglado
desde el 14-oct (#2426) y Jira seguía diciendo «Tareas por hacer».

### La población: 169, no 40

- **Jira, 09:15Z.** `project = SCRUM AND labels = equipo-javier AND statusCategory != Done`, en dos páginas (100 +
  69) y la segunda sin página siguiente: **169** claves, **169 únicas** (96 «Tareas por hacer», 51 «En curso», 19
  «Acción del fundador», 3 «En revisión»). El encargo decía «eran 40» y no sé de dónde sale ese número. El 14-oct, el
  censo por número daba **40 NADA EN MAIN** sobre 172 (tramo 1496c): quizá venga de ahí. Foto:
  `docs/master/evidencias/SCRUM-1496d/foto-jira-2026-10-20T0915Z.tsv`.
- **El censo por número**, con el instrumento de siempre y sin cambiarlo, en 5 min 8 s:
  `node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs --jira <foto> --ref dc1b2b4db… --lineas <fuera del árbol>`
  → **132 ALGO EN MAIN · 37 NADA EN MAIN · 0 NO HE PODIDO MIRAR**, salida 0, y el control SCRUM-9999 a tres ceros.
  La tabla está en `tabla-dc1b2b4db.md`. Las 1.035 líneas «queda» no se suben, porque el comando las regenera.
- **Clasificados: 169 de 169. Sin clasificar: 0.**

### Cómo se decidió, y no es un censo nuevo

El método es el de 1496c con dos cambios: LE FALTA ALGO se parte en TRABAJO y ESPERA, y cada TRABAJO lleva su
carril (`node scripts/carriles.mjs de <ruta>`) y su dolor. El criterio se escribió ANTES de leer ningún ticket y sin
los controles dentro; está tal cual en `docs/master/evidencias/SCRUM-1496d/criterio-de-lectura.md`. Para que todos
los lectores leyeran la misma foto, volqué los 169 de Jira a texto con TODOS sus comentarios (recibidos = total en
los 169; unos 2,5 MB). Catorce lectores, uno por lote de 9 a 13 tickets, midieron cada parte por efecto en
`dc1b2b4db`. Cada uno recibió como PISTA, marcada «re-mídela», la fila de 1496c y los commits de main desde el
14-oct (638). La salida de los catorce, sin retocar, está en `veredictos-por-lote.md` (169 filas).

### Los controles

| control | tenía que salir | salió | |
|---|---|---|---|
| SCRUM-9999 en el censo | tres ceros | tres ceros, NADA EN MAIN | ✅ |
| población de los lectores | 169 filas, una por ticket | 169 filas, 169 únicas, ninguna falta, ninguna sobra | ✅ |
| **SCRUM-1543** (el caso del encargo; lo miré DESPUÉS de clasificar y el lector no lo sabía) | TERMINADO | **TERMINADO** (lote-03): ①②④ c.19551 · (b) `botFlow.service.ts:636`, `:694` · (a) `tests/bot-suite.test.mjs:336-337` · `tests/scrum1543-handoff-se-guarda-antes-de-enviar.test.mjs` · `97f52883e` es ancestro de `dc1b2b4db` | ✅ |
| los 6 TERMINADOS nuevos respecto de 1496c (1023, 1320, 1331, 1408, 1543, 1553) | releídos por mí | aguantan los seis: 1023 por `docs/legal/ENVIO_ASESOR_2026-09-28.md:55-62`, 1331 por c.19596, 1408 por `asignacionDeDocumento.ts:13-15`, 1553 por `tests/scrum1553c-…`, 1320 por `tests/scrum1320-…:178-181` | ✅ |

### ✅ TERMINADOS: 42, se pueden cerrar después de leer el enunciado (A13)

`529` `1018` `1022` `1023` `1104` `1108` `1110` `1113` `1116` `1119` `1120` `1126` `1128` `1130` `1214` `1245` `1246`
`1253` `1259` `1313` `1315` `1320` `1321` `1323` `1327` `1329` `1331` `1336` `1345` `1392` `1394` `1408` `1472` `1477`
`1478` `1481` `1514` `1537` `1543` `1548` `1550` `1553`

**De los 41 TERMINADOS de 1496c, 36 siguen abiertos y nadie los ha tocado desde el 14-oct.** El tablero no miente
solo en 1543: lleva seis días mintiendo en 36. Respecto de 1496c, tres ya se cerraron (1258, 1304 y 1319) y dos
dejan de estar terminados: **1344**, porque nadie ha leído por nombre `scrum389` y `scrum728` en un obligatorio
(`SCRUM-1344.md:108-109`), y **1551**, porque c.20051 (19-oct) añade dos frases servidas de `public/terminos.html`
(`:48`, `:80`). Entran 1023, 1320, 1331, 1408, 1543 y 1553.

Lo que hay que saber antes de cerrar (cada uno, con su cita, en `veredictos-por-lote.md`):
- **1259** sigue abierto como sede del barrido por decisión del orquestador (`SCRUM-1259.md:187`). Ciérralo solo si esa
  decisión ya no vale.
- **1023**: la decisión que preparaba («dar por buenas las 17») no se tomó tal cual. La sustituyó otra: mandar las 28
  al asesor (`ENVIO_ASESOR_2026-09-28.md:59-60`).
- **1108**: la lista «quién me debe» no tiene pantalla. Viaja con 1043, que es TRABAJO.
- **1126, 1130** (yaqu.app) y **1116** (un correo real): terminados según el enunciado, pero nadie los ha visto en
  producción.
- **529**: «Verlo en yaqu.app · NO HECHO» (`SCRUM-529.md:42`) no forma parte de su «Hecho =».
- **1477**: el «NO HECHO» de la ④ en su registro está caducado; el aviso es SCRUM-1465 c.18790.
- **1543**: no se ha medido si A8.4 ha vuelto a caer en CI después del 14-oct.
- **1550** es de J3, y lo da por terminado un lector, no su autor.
- Estados o etiquetas caducados que dicen otra cosa: **1018** y **1022** («Acción del fundador»), **1023** y **1253**
  (`decision-jefe`), **1116** (`stop-fundador`), **1408**, **1481**, **1548** y **1550** (`listo-para-construir`).

### 🔵 TRABAJO: 50, y no todo es para una sesión

**Para una sesión, ordenados por lo que más duele hoy** (🔴 usuario, dinero, datos o afirmación pública · 🟠
bloquea a otro o al CI · 🟡 instrumento o documento · ⚪ sin víctima):

| # | ticket | qué falta, exactamente | carril | dolor |
|---|---|---|---|---|
| 1 | **1456** | las 6 lecturas de id autorizadas en c.18731 (`customersAdmin.routes.ts:620`, `:658`; `chargesAdmin.routes.ts:34`, `:117`, `:167`; `psp.routes.ts:37`), y antes de cada una medir que nada reacciona distinto a un 400 (c.18731 ②) | J2 | 🔴 `DELETE /admin/customers/1.5` borraría el cliente 1 (c.18431) |
| 2 | **1455** | las 8 lecturas autorizadas (`invoicesAdmin.routes.ts:550`, `:594`, `:615`, `:875`, `:1027`, `:1190`, `:310`; `invoice.routes.ts:63`) con la misma medición previa; `send-email` (`:700`) espera una decisión del ORQ | J1 | 🔴 `/admin/invoices/1.5/annul` actúa sobre la factura 1 (c.18437) |
| 3 | **1016** | aplicar el subtítulo firmado: `public/index.html:427` sigue diciendo «…y te paga — con tarjeta, Bizum o transferencia», y ya no hay guard que lo bloquee (`21c4df4dd`). Declarar muerta la rama `origin/scrum-1016e-titular-aplicado` | J3 | 🔴 la portada promete cobro (regla 24) |
| 4 | **1551** | proponer la redacción de `public/terminos.html:48` y `:80` y llevarla a la puerta de SCRUM-1554 junto con R1-R6/D1; después, la firma del fundador | J4 propone, J3 aplica | 🔴 /terminos afirma en presente que se factura y se cobra |
| 5 | **1565** | el arreglo según la receta de S1 (`finDelPeriodo`; `stripe.routes.ts:175` sigue con `current_period_end`). Antes, el ORQ elige: responder 200 o anotarlo en `gateway_events` | J2 | 🔴 quien cancela pierde el acceso al instante, y Stripe reintenta sin fin |
| 6 | **1449** | los tres textos firmados (c.18285) en `payMp.routes.ts:31`, `:71` y `:102` | J2 | 🔴 el cliente final lee «merchant» y una promesa que no se cumple |
| 7 | **1509** | lo firmado en c.19620: el límite delante de `POST /webhooks/whatsapp`, y que el tope BLOQUEE cuando no puede comprobar (`whatsapp.ts:382`, `:414`). Antes, volver a medir contra SCRUM-1513 | J2 | 🔴 regla 28: 100 mensajes del cliente producen 100 plantillas |
| 8 | **1149** | regla de 44 px por contenedor en la fila de Clientes y retirar las dos excepciones de `guard-objetivo-tactil.mjs:694-695` (opción ③, `SCRUM-786.md:197`) | J2 | 🔴 leve: botones de 31 px en una pantalla de uso diario |
| 9 | **1527** | recontar las colgadas con `docs/master/evidencias/SCRUM-1527/s3-reproduce-hoy.mjs` sobre más de 100 jobs; si sigue en 0, cerrar por «causa no demostrada» | sin fila (evidencias) | 🟠 PR de los dos equipos sin veredicto |
| 10 | **1410** | ① y ②, en solo lectura: cuántas veces `claude[bot]` empujó a una rama con una sesión viva (positivos: #2128 y #2380), y las salidas con su coste. Cambiar el workflow es de S5 y pasa por el fundador | S5 (el cambio) | 🟠 |
| 11 | **1260** | retirar la rama `type:'JUST'` de `src/lib/invoicing.ts:432`. La decisión está TOMADA (c.19616, «tumbalo ya»), pero es camino de emisión: **antes, el ORQ confirma que eso cuenta como el GO de la regla 40** | J1 | 🟡 |
| 12 | **1395** | la opción ② firmada (c.18744): `censo-mudez.mjs` escribe su veredicto en un JSON versionado y scrum719 lo exige. Pide turno. Ya estaba asignado a J4 (c.18420) | SIN CERRADURA / sin fila | 🟡 |
| 13 | **1556** | las tres filas de §3 en `dos-equipos.md` (decisión del fundador del 14-oct; en c.19641 la S0 dice que son vuestras). Antes, decidir qué fichero es «cotejo» | S0 (por decisión, del equipo J) | 🟡 |
| 14 | **1554** | añadir la entrada 24 (`terminos.html:79-80`), redactar las 16-21 y resolver el #2428. La mitad B espera al fundador | sin fila | 🟡 |
| 15 | **1311** | el suelo de `tests/scrum173-cadena-verifactu-serializada.test.mjs:138`, con turno de staging | sin fila | 🟡 |
| 16 | **1330** | ③: correr scrum173 con la B (turno de staging). ② se da por declarado citando SCRUM-1333 | sin fila | 🟡 |
| 17 | **1039** | llevar 1039b a `CONTABILIDAD.md` §3-§4 (todavía dice «sin fuente») y el visto bueno de J4 a la sección Q-C | J4 | 🟡 |
| 18 | **1101** | ④: un registro persistente por ejecución (hoy solo sale por stdout), o que el ORQ diga que con stdout basta | SIN CERRADURA | 🟡 |
| 19 | **1347** | medir las filas 3 y 4 de S1 contra el código. La fila 2 (`YAQU_MASTER.md:671`) contradice al código: eso es del ORQ | un jefe | 🟡 |
| 20 | **1346** | ⑤, el censo de nombres (solo lectura). `YAQU_MASTER.md:671/:687` contradice al código: eso es del ORQ | un jefe | 🟡 |
| 21 | **1511** | medir el CONTENIDO de las 149 rastreables; decidir ② es del ORQ | SIN CERRADURA | 🟡 |
| 22 | **1390** | medir si un fallo de carga acaba en el mismo cartel que el vacío (`homeView.js:645-648`) | S2 (equipo de Luis) | 🟡 |
| 23 | **1244** | adelgazar los tests pesados (`SCRUM-1244.md:242`) y volver a medir la tanda local | S5 / sin fila | 🟡 |
| 24 | **665** | medir qué costaría congelar el PDF emitido (almacenamiento). Construirlo pide GO del fundador | J1 | 🟡 sin víctima: 0 facturas selladas |
| 25 | **1328** | leer un artefacto `tanda-tap` de CI posterior al arreglo; el ORQ decide si es duplicado de 1289 | S3 | 🟡 |
| 26 | **1043** | la mitad de pantalla (filtro «con deuda», orden, columna de saldo, captura a 390 px); el texto necesita firma | J2 | ⚪ |
| 27 | **1132** | la tarjeta de notas con los 4 literales firmados en c.19617 (decisión TOMADA; sobran `decision-jefe` y `sin-firma`) | J2 | ⚪ |
| 28 | **1145** (con **1044** dentro) | la pestaña «Sitios» y su «Cómo llegar» en cada fila | J2 | ⚪ |
| 29 | **1457** | `supresion.routes.ts:34` (autorizada); las tres de Stripe esperan al fundador | J3 | ⚪ |
| 30 | **1250** | retirar `pay`/`unpay` (`invoicesAdmin.routes.ts:591`, `:612`) con todo lo que depende de ellas | J1 | ⚪ |
| 31 | **1251** | volver a medir el defecto y proponer desde dónde se descarga `evidencias.zip` | J1 | ⚪ |
| 32 | **1159** | identificar qué botones son y medirlos en un navegador real | J2 | ⚪ |
| 33 | **1064** | la pantalla del 303 sobre `GET /admin/modelo-303`; el texto y el nombre necesitan firma | **S2** (fichero nuevo bajo `public/**`) | ⚪ |
| 34 | **658** | medir `maintenancePlan`/SCRUM-354 y diseñar B1/B2; construir pide un GO por cada pieza | **S1** (patrón `src/**`) | ⚪ |

**Lo que solo depende del ORQUESTADOR** (una decisión o una verificación tuya; hasta que la tomes no hay nada que
repartir), 15 tickets:
- **1507**: decidir si el PR-2 de 1404 va entero o partido (c.19511) · 🟠
- **1339**: la revisión del 15-oct no consta. Hay que volver a medir la tasa después de `f13e8664a` y decidir qué
  criterio hace que bloquee · 🟠
- **1538**: el porqué de A8.4 ya lo contesta **1543** (c.19551). Solo quedan las 5 colgadas, que son el tema de 1527
- **1405**: cerrar con la C y decidir qué se hace con las tres copias del flag
- **1218**: decidir si se migran los 42
- **1332**: elegir entre A, B y C
- **1335**: cerrarlo citando 1405
- **1344**: leer por nombre scrum389 y scrum728 en un obligatorio
- **524**: 1127b contesta su ②; falta escribirlo
- **1536**: añadir una línea al máster (regla 44)
- **1058**: cruzarlo con J1
- **1248**: decidir si lo absorbe 1281
- **1092**: comprobar `config.mesas` en esta máquina
- **1391**: dar `staging-gated` por SIN JUZGAR o darle turno
- **1549**: la parte (B) es de S0/S5 del equipo de Luis, y ① vive fuera del repo

### ⛔ ESPERAN: 77

Este reparto por a quién esperan **es orientativo**: lo saqué contando palabras en la columna «a quién espera», y
la primera pasada me salió mal (ver la línea A9). La fila de cada ticket está en `veredictos-por-lote.md`.

| espera a | n | tickets |
|---|---|---|
| fundador | 30 | 143 612 870 906 1000 1005 1028 1066 1109 1115 1195 1247 1252 1257 1310 1322 1401 1402 1403 1406 1447 1470 1471 1497 1499 1501 1502 1508 1510 1566 |
| fundador + asesor | 15 | 19 20 1052 1054 1063 1065 1076 1102 1106 1129 1240 1264 1314 1316 1446 |
| fundador + equipo de Luis | 11 | 957 1105 1238 1324 1387 1389 1393 1396 1498 1506 1552 |
| equipo de Luis | 5 | 1194 1242 1404 1496 1505 |
| asesor | 5 | 18 142 1055 1067 1077 |
| fundador + asesor + equipo de Luis | 4 | 523 534 825 1103 |
| caso real (con o sin fundador o asesor) | 7 | 657 998 1050 1051 1053 1073 1448 |

**Decisiones que ya se tomaron y que la etiqueta no refleja** (el lector encontró la decisión con su cita): 1022
(c.16597), 1023, 1116 (c.16979), 1132 (c.19617), 1253 (c.17441), 1260 (c.19616), 1330 (c.17724), 1346
(c.17828/17932/17952), 1395 (c.18744), 1402 (④, c.18019), 1405 (c.19584), 1509 (c.19620), 1549 (c.19615), 1455 y
1456 (c.18731), 1565 (descripción, 18-oct) y 524 (por 1127b). **En los ESPERA, que la decisión esté tomada no basta
para moverlos:** 998, 1028, 1053 y 1396 están decididos, pero lo decidido es que esperen. En 1066 (D2), 1310 (i) y
1264 se decidió una parte y otra sigue abierta.

**Hoy no hay asesor.** c.19623 (SCRUM-1264): «no tenemos asesor fiscal»; c.20088: «lo arreglo cuando tengamos la
SL». **Los 24 que esperan al asesor esperan, de hecho, a SCRUM-143** (constituir la SL).

### Lo que NO se ha hecho y lo que NO se ha medido

- **El veredicto de 163 de los 169 lo da un lector, no yo.** Releí yo los 6 TERMINADOS nuevos y el cruce entre 1538
  y 1543. Los otros 36 TERMINADOS los han leído dos lectores distintos, con seis días de diferencia (1496c y este).
  Esto dice por dónde empezar, no da permiso para cerrar.
- **Ningún lector miró CI, yaqu.app ni una base de datos.** Lo que solo se ve allí no está medido: 1543 en CI, y
  1126, 1130 y 1116 en producción.
- **Un lector se salió del criterio.** El del lote-08 ejecutó `import('./scripts/_carriles.mjs')` para leer
  `puestoDeNombre`. Es una función pura y de solo lectura, y lo declaró él mismo. El dato que sacó también está
  escrito en `_carriles.mjs:195-205`.
- **El dolor lo pone el lector**, con una línea de motivo. El orden de la tabla es mío: por ese dolor y, dentro del
  🔴, primero datos y dinero, después afirmaciones públicas y por último lo táctil.
- La foto de Jira es de las 09:15-09:24Z. Un comentario posterior no está mirado.
- La capa de contenido de SCRUM-1550 no hizo falta: la lectura ya cubre los 37 NADA EN MAIN.

### Aceptación (del encargo de `cobroflash-backend-2e`) → dónde se ve

| lo pedido | dónde |
|---|---|
| población re-medida y declarada | «La población»: 169 (no 40), 169 clasificados, 0 sin clasificar |
| cuatro veredictos con evidencia | `evidencias/SCRUM-1496d/veredictos-por-lote.md` y las secciones de arriba |
| enunciado entero, cada parte por efecto | `criterio-de-lectura.md` (escrito antes) y la columna de partes |
| ¿la decisión ya se tomó? | «Decisiones que ya se tomaron y que la etiqueta no refleja» |
| TRABAJO con qué falta y su carril, ordenado | la tabla (35 tickets en 34 filas) y la lista de 15 del ORQ |
| reusar 1496c, sin censo nuevo | `tabla-ya-esta.mjs` sin cambios; la pista de 1496c en cada lote |
| control 1543, mirado después | «Los controles»: TERMINADO ✅ |

## 22-oct-2026 · SCRUM-1496e · De los 125 abiertos con algo en `main`, 37 están TERMINADOS y 88 no

**Medido contra:** `origin/main` = `8ad167195af03cf4153337ccc1bf1b80d04c10f8` · 2026-10-22T09:58:13Z

A9: aviso → cicatriz J3 «Metí como controles ciegos dos tickets ya cerrados y el lector vio «Finalizada» en Jira: un control cuyo resultado el sujeto puede leer no mide al lector.» — no se pudo comprobar: elegir los controles de una lectura es un juicio de quien reparte los lotes, y ningún test del árbol lo ve

J3 (`jv-j3y`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-5f`). **Es LECTURA.** No se ha
cerrado, transicionado, comentado ni etiquetado ningún ticket salvo este (el comentario de entrega), y no se ha tocado
`src/`, ningún test, guard o workflow, el esquema ni ninguna base. Pregunta: de los abiertos de `equipo-javier`,
¿cuáles están YA hechos y se pueden cerrar? Por qué: en dos días se repartió dos veces trabajo que ya estaba en `main`
(SCRUM-1548 y SCRUM-1408). El hook de inicio dijo SIN IDENTIDAD; seguí con la orden escrita del orquestador.

### La población

- **Jira, ~09:48Z.** `project = SCRUM AND labels = equipo-javier AND statusCategory != Done`, dos páginas (100 + 66,
  la segunda sin página siguiente): **166** claves, **166 únicas** (99 «Tareas por hacer», 48 «En curso», 17 «Acción
  del fundador», 2 «En revisión»). Foto: `evidencias/SCRUM-1496e/foto-jira-2026-10-22.tsv`.
- **Censo por número**, el mismo instrumento sin tocarlo, en 3 min 49 s:
  `node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs --jira <foto> --ref 8ad167195… --control 9999 --lineas <fuera del árbol>`
  → **130 ALGO EN MAIN · 36 NADA EN MAIN · 0 NO HE PODIDO MIRAR**, salida 0, control SCRUM-9999 a tres ceros.
  Tabla: `tabla-8ad167195.md`.
- **Cinco de los 130 llevan también `equipo-luis`**: 870, 1092, 1505, 1506 y 1507. Están contados aquí y no se han leído.
- **Leídos: 125 abiertos**, más 1548 y 1331 como controles (127 filas, 127 únicas, ni falta ni sobra ninguna).
  **Los 36 NADA EN MAIN no se han leído**: el encargo pedía leer los que tienen ALGO.

### Cómo se decidió, y no es un censo nuevo

El criterio es el de 1496c con tres veredictos (TERMINADO / LE FALTA ALGO / NO HE PODIDO MIRAR). Dentro de LE FALTA
ALGO, la clase de lo que falta: TRABAJO, ORQ o ESPERA. La pista de cada ticket es la fila de 1496d, marcada «re-mídela».
El criterio se escribió ANTES de leer ningún ticket y sin los controles dentro (`criterio-de-lectura.md`).

Trece lectores, uno por lote de 9 o 10 tickets repartidos por turno (`hacer-lotes.cjs`, `lotes/`), leyeron Jira en
vivo, con todos los comentarios, entre las ~10:00Z y las ~10:15Z, y midieron cada parte por efecto en `8ad167195`.
Su salida, sin retocar, está en `veredictos-por-lote.md`. La cuenta sale de `consolida.cjs`, que lee el veredicto de
SU columna y no del texto de la fila. La tabla de entrega es `tabla-entrega.md`: una fila por ticket, con la clase
y lo que falta.

### Los controles

| control | tenía que salir | salió | |
|---|---|---|---|
| SCRUM-9999 en el censo | tres ceros | tres ceros, NADA EN MAIN | ✅ |
| población de los lectores | 127 filas, una por ticket | 127, 127 únicas, ni falta ni sobra ninguna | ✅ |
| **SCRUM-1536** (abierto, y el lector no sabía que era control) | LE FALTA ALGO | LE FALTA ALGO (lote-08): las ramas 1536d y 1536e siguen sin mergear | ✅ |
| **SCRUM-1548** (cerrado) | TERMINADO | TERMINADO (lote-12) | ✅ pero no ciego: el lector vio «Finalizada (c.20168)» |
| **SCRUM-1331** (cerrado) | TERMINADO | TERMINADO (lote-03) | ✅ pero no ciego: el lector vio «Finalizada (c.20216)» |
| ningún TERMINADO de 1496d que siga abierto vuelve atrás | — | 0 vuelven atrás | ✅ |
| 1260 releído por mí (toca el camino de emisión) | `'JUST'` fuera de `invoicing.ts` | 0 líneas en `8ad167195`; en `dc1b2b4db`, `:432` sí la tiene (positivo) | ✅ |

### ✅ TERMINADOS: 37 abiertos que solo esperan a que se cierren (A13: los cierra el orquestador)

`1106` `1116` `1119` `1120` `1126` `1128` `1130` `1214` `1245` `1246` `1253` `1259` `1260` `1313` `1315` `1320` `1321`
`1323` `1327` `1329` `1335` `1336` `1345` `1392` `1394` `1408` `1472` `1477` `1478` `1481` `1514` `1537` `1538` `1543`
`1550` `1553` `1572`

**Respecto de 1496d:** 32 siguen igual. **Diez ya se han cerrado** desde el 20-oct (529, 1018, 1022, 1023, 1104, 1108,
1110, 1113, 1331 y 1548). Entran **cinco nuevos**: 1106 (la decisión estaba tomada en SCRUM-1053 c.16660 y 1496d no
la vio), 1260 (#2635 y #2639), 1335, 1538 y 1572 (este no existía el 20-oct).

Lo que hay que saber antes de cerrar (cada cosa con su cita en `veredictos-por-lote.md`):
- **1259**: sigue abierto como sede del barrido por decisión del orquestador. Ciérralo solo si esa decisión ya no vale.
- **1335**: desde c.18387 su dueño es S3, del equipo de Luis, aunque las etiquetas sigan diciendo `equipo-javier`
  y `area-j6`. Lo cierra el equipo dueño.
- **1538**: queda una «NO HECHO» en `SCRUM-1538.md:290` (por qué se colgó el trinquete). Según el lector, c.20213
  decide no perseguirlo. Si se cierra, es «cerrado, causa no demostrada» (A18). Esa cita no la he releído yo.
- **1477**: el «NO HECHO» de su registro (`:134`) está caducado; el aviso es SCRUM-1465 c.18790.
- **1126 y 1130**: nadie los ha visto en yaqu.app, y verlos no forma parte de su enunciado. **1543**: el CI de
  después no se ha consultado.
- **1550** es de J3, igual que yo. Lo da por terminado un lector, no su autor.
- Etiquetas o estados caducados: `stop-fundador` en 1106, 1116 y 1260 · `decision-jefe` en 1253.
- **De paso**, del lector de 1572: `docs/master/SCRUM-964.md` y `SCRUM-1289.md` siguen rotos en `main` y no tienen
  ticket. No son de mi carril y no los he tocado.

### 🔴 LE FALTA ALGO: 88

Agrupados por la PRIMERA clase que nombra el lector. **Es orientativo**: sale de buscar una palabra en una columna,
igual que la tabla de 1496d, que avisa de este mismo error en su línea A9. La fila buena es la de `tabla-entrega.md`.

| primera clase | n | tickets |
|---|---|---|
| TRABAJO (una sesión, hoy) | 19 | 524 665 1016 1039 1064 1218 1244 1311 1324 1330 1339 1346 1390 1395 1449 1455 1536 1551 1554 |
| ORQ (solo decides o verificas tú) | 15 | 1149 1328 1332 1344 1391 1393 1405 1456 1510 1527 1565 1569 1570 1571 1574 |
| ESPERA (fundador, asesor, caso real o equipo de Luis) | 42 | 523 534 612 657 906 998 1000 1050 1051 1055 1058 1065 1067 1076 1077 1102 1103 1105 1109 1115 1129 1194 1195 1240 1247 1252 1257 1316 1322 1389 1402 1403 1446 1447 1448 1470 1471 1498 1502 1508 1509 1552 |
| la columna no nombra clase | 12 | 20 825 1043 1063 1066 1238 1387 1401 1404 1457 1496 1511 |

Los que se han movido desde 1496d sin llegar a TERMINADO, según sus lectores:
- **1456**: el código ya está en `main`. Falta verlo en yaqu.app (ORQ).
- **1149**: construido (#2627). Falta verlo en yaqu.app (`SCRUM-1149.md:77`).
- **1565**: el arreglo y su test están en `main`. Falta ratificar «200 + console.warn» frente a `gateway_events` (ORQ).
- **1332**: la decisión ya la tomó 1218 (c.20156). Queda enlazarlo y cerrarlo como absorbido (ORQ).
- **1218**: la migración ya ha empezado: quedan 37 de 39 (c.20160).
- **1551**: R1-R6 y D1 ya están en `main`; faltan las dos frases de `terminos.html:48` y `:80`, con su firma.
- **1016**: el subtítulo firmado sigue sin aplicar; la línea es ahora `index.html:442`, y en 1496d era la `:427`.

### Lo que NO se ha hecho y lo que NO se ha medido

- **El veredicto de 125 de los 127 lo da un lector, no yo.** Releí yo 1260 por efecto y miré solo el registro de 1538.
  Los otros 35 TERMINADOS ya los habían leído otros lectores con dos días de diferencia (1496d) o, si son nuevos,
  solo uno. Sirve para decidir por dónde empezar; no da permiso para cerrar.
- **Ningún lector miró CI, yaqu.app ni una base de datos.** Lo que solo se ve allí sigue sin medir.
- **Un lector se saltó parte del criterio:** el del lote-13 no leyó la descripción de 1039, 1102 y 1257, solo los
  comentarios. En los tres había ya una falta citada, así que el veredicto no cambia. Ese mismo lector vio que en 1039
  y 1102 el censo cuenta más comentarios (8 y 16) que el `total` de la API (4 y 8). No lo he medido.
- **Los 36 NADA EN MAIN no se han leído**, y el contenido no se ha medido. Un trabajo que entró bajo otro número sale
  NADA EN MAIN.
- **Los controles 1548 y 1331 no fueron ciegos** (la línea A9 de arriba). El único ciego de verdad fue 1536.
- La foto de Jira es de ~09:48Z. Lo que se haya comentado después de ~10:15Z no está mirado.

### Aceptación (del encargo de `cobroflash-backend-5f`) → dónde se ve

| lo pedido | dónde |
|---|---|
| lista actual de abiertos `equipo-javier` | «La población» y `foto-jira-2026-10-22.tsv` (166) |
| censo por número sobre el `main` de hoy, sin motor nuevo | `tabla-8ad167195.md`: `tabla-ya-esta.mjs` sin cambios |
| leer cada ALGO EN MAIN según 1496c, cada parte por efecto | `criterio-de-lectura.md` y `veredictos-por-lote.md` (127 filas) |
| agentes por lotes de ~10, con el criterio pegado | `lotes/` (13), `hacer-lotes.cjs` |
| controles 1548 y 1331 TERMINADOS, 1536 no | «Los controles»: ✅ los tres (los dos cerrados, sin ser ciegos) |
| tabla ticket · veredicto · evidencia | `tabla-entrega.md` |
| los de `equipo-luis`, solo contados | 870, 1092, 1505, 1506 y 1507 |
| no cerrar ni transicionar | ninguno tocado |

# SCRUM-1416 · Los nombres construidos que quedaban, a literal — por lotes

**Medido contra:** `origin/main` = `c1b146a213d4f5df32a1dcf37a1de053ee437fe6` · 2026-10-02T12:55Z

A9: sin fallo que generalice — conversión mecánica por AST, comprobada fichero a fichero por conjunto de nombres; lo que no era mecánico se dejó fuera del lote y se dice abajo

Carril S3 (tests · bancos · instrumentación). Partido de SCRUM-1415: desenrollar con
`tests/_casos-escritos.mjs` las llamadas `test()` de nombre construido que la señal por nombres de
SCRUM-1339d no puede comparar. La lista `DECLARADAS` de `tests/scrum1415-nombres-construidos.test.mjs`
sólo baja; cada lote baja su parte en su propio PR.

## Lote 1 — los bucles de UNA sentencia (rama `scrum-1416-nombres-construidos-lote-1`)

Clasificación por AST de los 95 sitios en 56 ficheros que dejó SCRUM-1415: **61 sitios son
mecánicos** (un `for…of` de primer nivel cuya única sentencia es el `test()`, con una flecha de 0 o
1 parámetros) y **34 van a mano** (bucles con varios `test()` o con sentencias compartidas, uno
anidado, uno dentro de un bloque). 43 ficheros son enteramente mecánicos; este lote lleva 23.

| | sitios de nombre construido | en ficheros |
|---|---|---|
| antes del lote (lista de SCRUM-1415) | 95 | 56 |
| después del lote | **64** | 33 |

- 31 bucles convertidos en 23 ficheros → **127 casos** con su nombre literal, que pasan a ser
  visibles para la señal. Las llamadas `test()` del árbol suben 96 (127 líneas donde había 31).
- Población del guard tras el lote, sobre el árbol fusionado con `main`:
  `ficheros=1211 llamadas=9915 literales=9851 construidas=64 en_ficheros=33`.
- Sólo cambia la FORMA de declarar los casos. El cuerpo de cada flecha se copia tal cual y la tabla
  es la misma expresión que iteraba el bucle.

### Antes y después, corriendo cada fichero

`node --test-reporter=tap tests/<fichero>` antes y después; se compara el CONJUNTO de líneas
`ok`/`not ok` (nombre, sangría, resultado y directiva, con multiplicidad) y las cifras del resumen.
Un fichero con cero líneas o sin resumen sale CIEGO, no idéntico.

| fichero | casos antes | casos después | fail después | conjunto de nombres |
|---|---|---|---|---|
| `scrum1038-leer-el-ticket-gasto` | 23 | 23 | 0 | idéntico |
| `scrum1108b-pantalla-garantia` | 11 | 11 | 0 | idéntico |
| `scrum1117-anclas-por-bloque` | 12 | 12 | 0 | idéntico |
| `scrum1160-cobrar-ahora-modo-recibo` | 16 | 16 | 0 | idéntico |
| `scrum1164-ocultar-en-receipt-ficha-trabajo` | 7 | 7 | 0 | idéntico |
| `scrum1164-ocultar-en-receipt-inicio-planes` | 7 | 7 | 0 | idéntico |
| `scrum1166-detalle-quote-tiene-numero` | 6 | 6 | 0 | idéntico |
| `scrum1167-irreversible-gana-la-cascada` | 9 | 9 | 0 | idéntico |
| `scrum1168-anio-serie-zona-merchant` | 14 | 14 | 0 | idéntico |
| `scrum1169-linea-tiempo-modo-recibo` | 6 | 6 | 0 | idéntico |
| `scrum1170-seccion-facturas-modo-recibo` | 6 | 6 | 0 | idéntico |
| `scrum1188-plantilla-guarda-el-cobro` | 5 | 5 | 0 | idéntico |
| `scrum1193-mas-acciones-44` | 6 | 6 | 0 | idéntico |
| `scrum1216b-pantalla-arranque` | 14 | 14 | 0 | idéntico |
| `scrum1226-firma-no-baja-el-estado` | 4 | 4 | 0 | idéntico |
| `scrum1235-el-correo-que-no-salio` | 18 | 18 | 0 | idéntico |
| `scrum1292-cobro-pagado-no-retrocede` | 8 | 8 | 0 | idéntico |
| `scrum1293-cargador-de-marcadores` | 18 | 18 | 0 | idéntico |
| `scrum1301-bizum-hoy-de-madrugada` | 7 | 7 | 0 | idéntico |
| `scrum1302a-marca-en-la-vista-de-oficina` | 4 | 4 | 0 | idéntico |
| `scrum1302f-envio-sin-telefono` | 6 | 6 | 0 | idéntico |
| `scrum1323-resumen-vs-detalle-sif1` | 28 | 28 | 0 | idéntico |
| `scrum1344-arnes-de-prueba-con-rol` | 27 | 27 | 0 | idéntico |

23 comparados, 23 idénticos, 0 distintos, 0 ciegos; 262 casos en total. Los literales no se teclean:
salen del TAP de ANTES, en orden, y cada caso comprueba al correr que su nombre escrito es el que
sale de su fila (`casosEscritos`).

### Lo que NO lleva este lote

- 20 ficheros enteramente mecánicos (29 sitios): lote 2.
- 13 ficheros a mano (35 sitios: los 34 de arriba y uno mecánico que comparte fichero con otro que no lo es): `scrum1027`, `scrum1093h`, `scrum1106`, `scrum1153`,
  `scrum1200`, `scrum1213`, `scrum1315`, `scrum264`, `scrum330`, `scrum785`, `scrum809`,
  `scrum899d`, `scrum931`.

### Tests que cubren la rama, en local

`tests:que-cubren` seleccionó 244 de 1.210 ficheros; corridos en 4 tramos con
`--test-concurrency=2`: 2.455 casos, 2.446 pass, 4 fail, 5 skipped. Los 4 rojos, ninguno en un
fichero del lote: `scrum1321` PUERTA 1b (el temporal de esta máquina está en otra unidad que el
repo), `scrum804` ×2 (una rama remota que el censo no ve, estado del clon) y `scrum854` (pedía
este registro, que aún no estaba escrito). El juez es el CI.

# SCRUM-1416b · Lote 2 — el resto de los bucles de UNA sentencia

**Medido contra:** `origin/main` = `b06d474d32e59e2bb04b62fa7fcaf5c3c84fb486` · 2026-10-02T12:54Z

A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

Rama `scrum-1416b-nombres-construidos-lote-2`, apilada sobre la del lote 1. Mismo método y mismo
control: conversión por AST, literales sacados del TAP de ANTES, y conjunto de nombres comparado
corriendo cada fichero.

| | sitios de nombre construido | en ficheros |
|---|---|---|
| antes del lote (tras el lote 1) | 64 | 33 |
| después del lote | **35** | 13 |

29 bucles convertidos en 20 ficheros → **146 casos** con su nombre literal.
Población del guard tras el lote: `ficheros=1211 llamadas=10032 literales=9997 construidas=35 en_ficheros=13 lista=35 en_ficheros=13`.

| fichero | casos antes | casos después | fail después | conjunto de nombres |
|---|---|---|---|---|
| `scrum1354-dueno-de-la-marca` | 13 | 13 | 0 | idéntico |
| `scrum1360-caja-albaran-firma-de-parte` | 7 | 7 | 0 | idéntico |
| `scrum1362-cargador-de-defectos-del-viaje` | 13 | 13 | 0 | idéntico |
| `scrum1388-facturas-recibidas-literales-firmados` | 11 | 11 | 0 | idéntico |
| `scrum176-guard-mensaje` | 26 | 26 | 0 | idéntico |
| `scrum384-min-height-locales` | 9 | 9 | 0 | idéntico |
| `scrum386-hojas-fuera` | 13 | 13 | 0 | idéntico |
| `scrum454-destructivo-sin-comprobacion` | 41 | 41 | 0 | idéntico |
| `scrum522-guards-fuera-de-la-tanda` | 26 | 26 | 0 | idéntico |
| `scrum542-objetivo-tactil` | 14 | 14 | 0 | idéntico |
| `scrum562-arbitro-de-toque` | 16 | 16 | 0 | idéntico |
| `scrum600-un-solo-front-documento` | 14 | 14 | 0 | idéntico |
| `scrum605-atajos-vencimiento` | 15 | 15 | 0 | idéntico |
| `scrum630-default-en-dias` | 19 | 19 | 0 | idéntico |
| `scrum643-zona-del-merchant` | 10 | 10 | 0 | idéntico |
| `scrum885-documento-sin-enviar` | 14 | 14 | 0 | idéntico |
| `scrum893-solo-lo-que-puede-cobrar` | 8 | 8 | 0 | idéntico |
| `scrum905-facturar-solo-si-se-puede` | 14 | 14 | 0 | idéntico |
| `scrum910-la-transferencia-que-no-mira` | 5 | 5 | 0 | idéntico |
| `scrum910d-microcopy-recibo-pendiente` | 5 | 5 | 0 | idéntico |

20 comparados, 20 idénticos; 293 casos en total.

Error propio: el conversor rechazó `scrum600` porque ya importaba `nombreEscrito` de
`_casos-escritos.mjs` y daba por hecho que quien importa ese módulo importa `casosEscritos`. No
escribió nada (lanza antes de tocar el fichero); se añadió el nombre al import a mano y se volvió a
pasar. Lo impide el propio guard: una llamada que se queda sin convertir sigue en `DECLARADAS` y la
mitad ② cae si la lista dice otra cosa.

Quedan 13 ficheros a mano (bucles con varios `test()` o con sentencias compartidas, uno anidado y
uno dentro de un bloque): lote 3.

# SCRUM-1416c · Lote 3 — los bucles con varios `test()`; la lista queda en una entrada

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:15Z

A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

Rama `scrum-1416c-nombres-construidos-lote-3`, apilada sobre la del lote 2.

| | sitios de nombre construido | en ficheros |
|---|---|---|
| antes del lote (tras el lote 2) | 35 | 13 |
| después del lote | **2** | 1 |

33 sitios en 12 ficheros → **98 casos** con su nombre literal. Población del guard tras el lote:
`ficheros=1214 llamadas=10174 literales=10172 construidas=2 en_ficheros=1 lista=2 en_ficheros=1`.

**Convertibles: todas. Bloqueada por decisión pendiente: una.** `scrum809-paywall-tras-cancelar`
(2 sitios, 4 casos, gateado con `{ skip }`) se convirtió y salió idéntico, pero convertirlo sube el
inventario declarado de SCRUM-419 de 42 a 44 (ese fichero pasa de 5 a 7), y esa cifra también vive
en `ci.yml`. Visto en rojo en local: `scrum419` «se declaran 42 tests sin ejecutar y hay 44». No se
cuadra la lista de SCRUM-419 ni se toca `ci.yml` desde aquí: el fichero vuelve a como está en `main`
y se queda en `DECLARADAS` con ese motivo escrito (decisión del orquestador, 2-oct). Se retira cuando
el fundador decida sobre el inventario. Por eso SCRUM-1415 decía «no convertibles: 0» y aquí hay una
entrada declarada: su motivo no es técnico.

Lo que no era un bucle de una sentencia, y cómo se convirtió:

- **Varios `test()` por vuelta** (`scrum1027`, `scrum1093h`, `scrum1106`, `scrum1153`, `scrum1213`,
  `scrum1315`, `scrum264`, `scrum330`, `scrum785`, `scrum931`): un `casosEscritos` por cada `test()`
  del bucle, sobre la MISMA tabla, y las líneas `test('…')` escritas fila a fila, en el orden en que
  el bucle las registraba. Ningún bucle tenía sentencias compartidas entre sus tests.
- **Un `test()` dentro de un `if`** (`scrum264`, `sup.tieneMapa`): su tabla es la del bucle filtrada
  por esa misma condición, así que `todos()` sigue exigiendo un caso por fila que la cumple.
- **Bucle anidado** (`scrum1200`): las dos tablas se aplanan con `flatMap` en una de filas
  `[nombre, error, si]`, en el mismo orden.
- **Bucle dentro de un bloque** (`scrum899d`): a mano, dentro del mismo bloque.

| fichero | casos antes | casos después | fail después | conjunto de nombres |
|---|---|---|---|---|
| `scrum1027-atajo-flag-off-sin-documento` | 14 | 14 | 0 | idéntico |
| `scrum1093h-censo-fecha-sin-zona` | 21 | 21 | 0 | idéntico |
| `scrum1106-respuestas-ia-no-son-del-asesor` | 6 | 6 | 0 | idéntico |
| `scrum1153-censo-entorno-prestado` | 15 | 15 | 0 | idéntico |
| `scrum1200-sin-respuesta` | 8 | 8 | 0 | idéntico |
| `scrum1213-quoteadmin-tenencia-fail-closed` | 6 | 6 | 0 | idéntico |
| `scrum1315-gemelos-estado-dentro-del-where` | 14 | 14 | 0 | idéntico |
| `scrum264-copy-que-llega-al-cliente` | 17 | 17 | 0 | idéntico |
| `scrum330-contador-solo-activas` | 10 | 10 | 0 | idéntico |
| `scrum785-productos-y-proveedores-descuelgan` | 7 | 7 | 0 | idéntico |
| `scrum899d-aviso-de-uso` | 18 | 18 | 0 | idéntico |
| `scrum931-un-solo-importe-de-plantilla` | 25 | 25 | 0 | idéntico |

12 comparados, 12 idénticos; 161 casos en total.

**El guard con la lista casi vacía sigue siendo una red:** la mitad ① no depende de que la lista
tenga entradas — una llamada de nombre construido que no esté declarada cae, y su caso permanente
la prueba contra una lista VACÍA (`veredicto(c, []).deMas`). Visto en rojo de verdad hoy: tres
llamadas nuevas entraron en `main` y el guard las nombró con fichero y línea (SCRUM-1416d).

Errores propios del lote:

- El conversor asignaba al bucle un nombre de un `test()` literal posterior que casaba con la
  plantilla del bucle (`scrum1027`: «SUELO: el extractor encuentra…» existe también suelto). Lanzó
  por desalineado sin escribir nada; ahora corta al llegar al nombre del siguiente literal.
- Di la lista por vacía y lo escribí en el registro antes de correr los tests que cubren la rama;
  fue esa tanda la que enseñó el rojo de SCRUM-419. El registro se ha reescrito con lo medido.
- La mitad ② del guard se vio en ROJO de verdad en este lote: con los ficheros convertidos y la
  lista sin tocar, `exit 1` y «la lista declara … y el árbol tiene 0».

### Añadido al lote 1 · tres sitios que entraron en `main` a la vez que el guard

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:10Z

A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

`tests/scrum1379b-id-fuera-de-rango-resto.test.mjs` (2 sitios, 48 casos) y
`tests/scrum1420-el-pad-avisa-al-cerrarse.test.mjs` (1 sitio, 4 casos) entraron en `main` con
llamadas de nombre construido que `DECLARADAS` no tiene: sus PR se probaron antes de que el guard de
SCRUM-1415 estuviera en `main`, y el guard entró sin ellos. Con los tres juntos, la mitad ① del guard
cae sobre `main` (visto en esta rama al traer `main`: `construidas=66 … lista=64`, `fail 1`).

No se añaden a la lista (sólo baja): se convierten aquí. En `scrum1379b` el bucle llevaba una
constante `nombre` que sólo se usaba dentro de los dos nombres; se ha metido en las dos plantillas.

| fichero | casos antes | casos después | fail después | conjunto de nombres |
|---|---|---|---|---|
| `scrum1379b-id-fuera-de-rango-resto` | 49 | 49 | 0 | idéntico |
| `scrum1420-el-pad-avisa-al-cerrarse` | 11 | 11 | 0 | idéntico |

Población del guard tras el añadido: `ficheros=1214 llamadas=9992 literales=9928 construidas=64 en_ficheros=33 lista=64 en_ficheros=33`.

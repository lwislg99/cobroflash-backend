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

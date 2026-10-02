# SCRUM-1366 · Por qué `scrum237` pierde el fichero ENTERO: su censo sale antes que todo su informe

**Medido contra:** `origin/main` = `f30b1a4052957e245ebe1cfef53bbef410c5816b` · 2026-10-02T16:28:50Z

A9: aviso → A10 «Un carácter que no se ve no lo caza una revisión: lo caza un recuento.» — no se pudo comprobar: el error fue dar por entero un censo sin contar sus líneas, y que alguien cuente antes de escribir «entero» no lo vigila ningún guard.

Puesto S3 (s3-2octe), por encargo del orquestador. Sólo `docs/`: no se toca `scrum237`, ni el suelo, ni
`package.json`, ni `ci.yml`.

## La respuesta, en tres líneas

1. **No es una avería distinta de SCRUM-1405.** Es la misma pérdida de la COLA de la salida del fichero.
2. **En `scrum237` la cola es el informe entero**, porque el fichero escribe primero ~29 KB de censo
   crudo y sólo después el primer evento de su informe. Lo que se corta por el final se lleva los 8 tests.
3. **El censo NO salía entero en las tandas malas.** El ticket lo daba por entero; contado, le faltan sus
   4 o 5 últimas líneas. El corte cae dentro del censo.

## Medición 1 · el orden de los bytes (local, Node 24.8, Windows)

`docs/master/evidencias/scrum1366/sonda-orden-de-salida.mjs.txt` lanza el fichero como lo lanza
`node --test` (un hijo con `NODE_TEST_CONTEXT=child-v8`) y mira en qué byte y en qué milisegundo sale cada
cosa. No modifica nada.

| Fichero | Bytes al padre | Primer byte → último byte | Primer evento del informe | Primer `test:pass` |
|---|---|---|---|---|
| `scrum237` (4 tiradas con el flag, 1 sin él) | 44.547 – 44.548 | 7 ms de ventana, al final de 2,5 – 3,6 s | byte **29.300** | byte **32.695** |
| `scrum312` (control: pierde sólo sus 5 últimos) | 46.050 | 7 ms, al final de 1,5 s | byte 17 | byte 9.312 |
| `scrum834` (control: pierde 10 o 20 de 53) | 83.120 | 10 ms, al final de 0,1 s | byte 17 | byte 16.249 |

- En `scrum237` los bytes 1 a 29.299 son el censo (cabecera y 168 líneas de DÉBIL en este árbol). Los
  ocho `test:enqueue`, `test:start` y `test:pass` van todos detrás.
- En los controles el informe empieza en el byte 17. Un corte por el final les quita los últimos tests y
  deja los primeros: es lo que se ha visto en ellos.
- Los tres ficheros sueltan toda su salida en una ráfaga de milisegundos justo antes de salir. Eso no
  distingue a `scrum237`; lo que lo distingue es qué va delante.
- El orden lo decide el código del fichero y el del corredor, no el sistema: el censo sale por
  `process.stdout.write` dentro del último test y los eventos esperan a la tubería del reportero.
  Medido en Windows; en Linux no lo he medido yo, pero la medición 2 es de Linux y dice lo mismo.

## Medición 2 · los TAP reales del CI (los cuatro del 1-oct, bajados por id de artefacto)

`docs/master/evidencias/scrum1366/censo-en-el-tap.mjs.txt`, sobre el `tanda.tap` de cada intento.

| Run · intento | Artefacto | Cabecera del censo dice DÉBIL | Líneas de DÉBIL que llegaron | Tests de `scrum237` | Entrada de fichero |
|---|---|---|---|---|---|
| 36860171227 · 1 (#2084) | 11161828771 | 163 | **158** | 0 | `ok 346`, 3.682,8 ms |
| 36860171227 · 2 | 11163032993 | 163 | 163 | 8 | — |
| 36863578275 · 1 (#2090) | 11161994827 | 163 | **159** | 0 | `ok 352`, 2.242,9 ms |
| 36863578275 · 2 | 11164124022 | 163 | 163 | 8 | — |

- En las dos malas el censo acaba en `scrum932…` y `scrum967b…`; en las buenas acaba en
  `tenancy-permisos.test.mjs:185`, que es la última por orden. Faltan las últimas, no unas cualesquiera.
- Las «5 líneas de más en la corrida buena» que SCRUM-1366 c.17900 dejó sin explicar son éstas.
- Población: dos pares de corridas, cuatro TAP. El avistamiento de #1959 no lo he releído.

## Lo que queda probado y lo que no

| Afirmación | Estado |
|---|---|
| En las malas se pierde la cola de la salida del fichero, y el corte cae dentro del censo | Medido, 2 de 2 |
| Todo el informe de `scrum237` va detrás del censo | Medido, 5 de 5 tiradas locales |
| Por eso una pérdida de cola aquí es una pérdida total | Se sigue de las dos anteriores |
| El mecanismo de la pérdida de cola (el hijo sale con `--test-force-exit` y bytes sin escribir) | De SCRUM-1405 (PR #2131, abierto). Leído, no remedido |
| Por qué el corte cae casi en el mismo sitio las dos veces (escrituras 160 y 161; 27,6 y 27,8 KB) | **SIN PROBAR.** Ver abajo |

**Hipótesis sobre el sitio del corte, sin probar.** El censo son ~165 escrituras pequeñas, una por línea.
Si el canal entre el hijo y el corredor es un socket y su límite cuenta el coste fijo de cada escritura
además de sus bytes, se llenaría hacia un número de ESCRITURAS y no hacia 64 KB. Eso explicaría que
28 KB «no llenen la tubería» y aun así se corte, y que el corte caiga dos veces casi en la misma línea.
Dos puntos no lo prueban. Lo tumbaría un TAP malo con el censo cortado lejos de la línea 160, o con el
censo entero y los tests perdidos.

## «No registró» frente a «no corrió»

Distinguibles aquí: en las dos malas hay 158 y 159 líneas de censo en el TAP, y el censo se imprime
dentro del octavo test, después de calcular el corpus. El fichero corrió hasta su último test. Lo que no
se puede saber por el TAP es si ese último test llegó a su aserción; el código de salida 0 del hijo dice
que ninguno cayó.

## El chivato ya existe

SCRUM-1380, en `main`: `scripts/_suelo-de-la-tanda.mjs` nombra el fichero y dice «CORRIÓ Y NO REPORTÓ»
cuando su entrada dura 1.000 ms o más y no tiene subtests. No hace falta otro instrumento. Su texto dice
«causa SIN diagnosticar» y «corre entero»: las dos frases quedan viejas con este registro. No las toco:
el fichero es de S5.

## Salidas, sin construir ninguna

| Salida | Qué cambia | Qué no arregla |
|---|---|---|
| La que el fundador elija en SCRUM-1405 | Quita la pérdida de cola en todos los ficheros | Nada de esto; es la cura |
| Que `scrum237` escriba su censo en UNA escritura en vez de ~165 | Si la hipótesis del corte es cierta, deja de cortarse aquí. Si no lo es, no cambia nada | Los otros 17 ficheros. Y es editar la salida de un guard: se decide, no se hace de paso |
| Que el censo salga DESPUÉS del informe (al terminar el fichero) | Una pérdida de cola se llevaría líneas del censo y no los 8 tests | Sigue perdiéndose salida; cambia cuál |

Las dos últimas sólo se pueden comprobar en Linux bajo carga, es decir en el CI. No propongo gastar
tandas en ellas mientras SCRUM-1405 esté sin decidir.

## Mis errores

1. Mi primera lectura fue que la ráfaga al final era lo propio de `scrum237`, por las ~3 s que pasa
   calculando antes de escribir. El control lo tumbó: `scrum312` y `scrum834` también sueltan todo en una
   ráfaga. Lo propio es el orden, no el momento.
2. El script del censo en el TAP lo escribí contando las líneas `· tests/`; no lleva control positivo
   propio. Lo que lo respalda es que en las dos tandas buenas cuenta 163, que es lo que dice la cabecera.

# SCRUM-1485 · Qué tests comparan una ruta de la máquina con un separador escrito a mano

**Rama:** `scrum-1485-censo-rutas-contra-literal` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `8f77f96dd12c0cc7cad87f94d166b58601741b5f` · 2026-10-06T18:12:40Z

A9: comprobación → `tests/scrum1485-censo-rutas-de-maquina.test.mjs`

Gemelo de SCRUM-1473b. Carril S5: un script nuevo en `scripts/equipo/`, su test, y evidencias.
**No se toca ningún test ajeno.**

## Qué mide este censo, y qué no

Mide **sitios donde el resultado de una comparación depende de la máquina por cómo está escrita**: una
ruta hecha con `path.join`, `path.relative`, `path.resolve`, `path.sep`… (en Windows lleva «\», en el
CI «/») que llega a un `===`, un `startsWith`, un `includes`, un `assert.equal` o una regex.

**No mide tests en rojo.** Todo lo que hay en `main` pasó por el CI, que es `ubuntu-latest` en los 13
trabajos de los workflows: en Linux está verde. Lo que este censo busca es lo que en Windows puede caer,
o lo que en una de las dos máquinas compara otra cosa. El riesgo de verdad es el test NUEVO, escrito
aquí, verde aquí y rojo allí: eso es lo que le pasó a #2221.

## Lo medido

`node scripts/equipo/censo-rutas-de-maquina.mjs` · 3 s · por AST (typescript), no por texto.
Salida entera: `docs/master/evidencias/SCRUM-1485/censo-todo.txt`.

| qué | cuántos |
|---|---|
| Ficheros de código leídos en `tests/` (con subcarpetas) | 1.439 |
| Ficheros que no supo leer | 0 |
| Ficheros que tocan rutas de máquina | 1.107 |
| Sitios donde una ruta de máquina llega a una comparación | 78, en 48 ficheros |
| **LITERAL** · contra un «/» o «\» escrito a mano | **1**, en 1 fichero |
| NO-LEIDO · el otro lado no lo sabe seguir | 45, en 24 ficheros |
| MAQUINA · ruta de máquina contra ruta de máquina | 18, en 16 ficheros |
| INOCUO · contra un texto sin separador («..», «.ts») | 14, en 12 ficheros |
| MEZCLAS · un separador pegado a mano a la ruta, llegue o no a comparar | 10, en 4 ficheros |

La población es 1.439 y no los 1.401 del ticket: aquél contaba sólo `tests/*.test.mjs` y `tests/_*.mjs`.
Éste baja a las subcarpetas (los bancos) y cuenta también `.cjs` y `.ts`. El test de este ticket es uno
de los 1.439.

**El censo ve el caso de hoy.** Con el fichero entero de `db94a77986f0d61a087897bef45fecd2d6061388`
(la punta que cayó en el CI) da 1 LITERAL, en la línea 396: el `despues.includes(...)` con la «/»
pegada. Da también 2 mezclas (la de `foto`, línea 112, y esa misma) y deja el filtro por prefijo de la
línea 387 en NO-LEIDO. Con el fichero de hoy: 0 LITERAL y 0 mezclas.

**Segunda sonda, independiente.** `evidencias/SCRUM-1485/sonda-por-texto.mjs` busca lo mismo por texto
y por nombre, sin ámbitos, para ver si el AST se deja algo. Acusa 20 renglones y ninguno coincide con
el censo. Leídos los 20: 7 son las cobayas del test de este ticket (su control: las ve), y los otros 13
son nombres repetidos en otro ámbito, mensajes de error y direcciones `http://`. Ninguno es una ruta
de máquina comparada con un literal.

## Las dos listas

### Lista 1 · compara máquina con máquina, o con algo sin separador: está bien (48 ficheros)

- **El único LITERAL.** `tests/scrum521-resolvedor-de-importadores.test.mjs:112`:
  `path.sep === '\\' ? '/' : '\\'`. Pregunta qué máquina es para escoger el separador AJENO y probar
  que `resolver()` no lo devuelve. Es a propósito. Va declarado en el guard, con su motivo.
- **MAQUINA, 18 sitios en 16 ficheros.** Los dos lados salen de `path`: `p === THIS_FILE`,
  `path.resolve(x).startsWith(RAIZ + path.sep)`. Se mueven juntos.
- **INOCUO, 14 sitios en 12 ficheros.** `rel.startsWith('..')`, `f.endsWith('.ts')`, `rel === ''`.
- **NO-LEIDO, 45 sitios en 24 ficheros.** Leídos uno a uno:
  - *Dentro de un `assert`, en un test verde en las dos máquinas* (15 ficheros, corridos aquí hoy y
    verdes en el CI): `scrum1093h`, `scrum1281`, `scrum1298`, `scrum1430`, `scrum1473`, `scrum253`,
    `scrum393`, `scrum521`, `scrum590`, `scrum813`, `scrum829b`, `scrum899c`, `scrum932`, `scrum951a`,
    `scrum996`. Casi todos son `assert.equal(loQueDevuelveElCódigo, path.join(...))`: el código
    probado y el test hacen la ruta con `path`.
  - *Filtros, que un verde no prueba; leídos*: `scrum590:117` (`f` sale de un recorrido con
    `path.join` y `INTEGRACIONES` es `path.join(SRC, 'integrations')`), `scrum393:97` (`TODOS` son
    rutas absolutas de un recorrido, contra `path.join`), `scrum932:180` (la ruta que el cargador
    devuelve, contra la que se le dio), `scrum899c:139` (un `existe` de mentira que compara con el
    mismo `path.join` que luego se espera).
  - *Ayudantes y bancos, que no son tests*: `_alcance-desde-entradas.mjs:279` (comparación directa a
    propósito; lo explica su comentario y lo vigila `scrum521`), `_censo-arneses-de-router.mjs:318`
    (claves de la caché de módulos contra `path.join(raiz, 'dist') + path.sep`),
    `banco-scrum1102f/mutar.mjs:66` y `banco-scrum1341/mutar.mjs:104` (`en('src')` es `path.join`),
    `banco-scrum1325/mutar.mjs` (4 sitios: `m.f` contra `MOTOR`, los dos de `path.join`).
  - *No corridos en Windows hoy* (4 ficheros): `scrum1398`, `scrum289b`, `scrum381`, `scrum72`. En
    este árbol no hay `dist/` y no se pudo construir (memoria: 1.322 MB libres, hacen falta 2.200).
    Leídos: `scrum289b:382` compara `f` con el único elemento de la lista que recorre; `scrum381`
    compara lo que devuelve `resolver` (un `path.resolve`) con un `path.join`; `scrum1398:172` y
    `scrum72` comparan la ruta que devuelve el código con un `path.join`. Verdes en el CI.

### Lista 2 · compara máquina con literal, hay que arreglarlo

**Vacía.** Ningún test de `main` tiene hoy, a la vista, el defecto de SCRUM-1473. No hay nada que
arreglar ni que partir a otro carril.

**Las 10 mezclas** son todas `pathToFileURL(RAIZ + '/node_modules/...')` o `RAIZ + '/dist/...'` en
cuatro tests de concurrencia (`scrum592`, `scrum767`, `scrum781`, `scrum793`). Van a un `import`, no a
una comparación. En Windows las dos barras valen para abrir un fichero. No se tocan.

## Qué NO puede ver este censo sin Linux

Lo declara el propio script en `LO_QUE_NO_VE`, y lo imprime en cada pasada:

1. Una ruta que llega a la comparación **por un parámetro** (`(l) => l.startsWith(...)`): se ve el
   sitio, no de dónde viene `l`.
2. Una ruta guardada **en un array o en un objeto** y comparada después. El `foto()` de SCRUM-1473
   hacía eso. Por eso existe la lista de mezclas: ve dónde nace la ruta rara aunque no la siga.
3. Una ruta que viene de **otro módulo** o de un `let` reasignado.
4. Lo que hace el **código probado** con sus rutas: sólo se lee `tests/`.
5. Las **otras diferencias** entre Windows y Linux: mayúsculas en nombres, finales de línea, permisos.

O sea: el guard caza la forma que se ve en el propio renglón. El test de hoy la tenía (línea 396).
Un test que sólo tuviera la del filtro (línea 387) habría pasado el guard.

## Qué haría falta para verlo, y lo que se probó

**Se probó emular el separador de Linux en Windows, y NO sirve como instrumento.** Un prototipo
(`evidencias/SCRUM-1485/separador-de-linux.prototipo.mjs`, cargado con `node --import`) hace que
`path`, `fileURLToPath`, `process.cwd()` y `os.tmpdir()` devuelvan «/».

| medida | resultado |
|---|---|
| El test viejo de SCRUM-1473, en Windows, con el prototipo | cae 1 de 12: **el mismo test 11 que cayó en el CI** |
| El test arreglado, con el prototipo | 12 de 12 |
| Los 39 tests que el censo acusa, con y sin el prototipo | de los 28 verdes sin él, **11 caen con él** |

Reproduce el caso de hoy, 1 de 1. Pero esos 11 están verdes en el CI de verdad: son **falsas
alarmas, el 39 %** de la muestra. El prototipo cambia lo que devuelve `path` y no lo que devuelve
`fs.readdirSync`, `import.meta.dirname` ni un proceso hijo. Fabrica una máquina que no es ni Windows
ni Linux, y un test correcto que cruza las dos fuentes cae. La muestra está sesgada (son los tests que
más comparan rutas), así que el 39 % no vale para un test cualquiera: no está medido.

Un instrumento que da rojo en el 39 % de lo sano enseña a no mirarlo. **No entra en `scripts/`.** Se
queda como evidencia, con su salida (`acusados-con-separador.txt`). La primera versión, además,
rompía `path.relative` («..C:/Users/…»): lo cazó el control con el test arreglado, que caía igual que
el viejo.

**Lo que sí lo vería, y es decisión del fundador porque es instalar algo o gastar minutos de CI:**

- Linux en esta máquina (WSL o Docker). Hoy `wsl.exe` es sólo el instalador y Docker no está.
- O un trabajo corto en GitHub que corra **sólo los tests que cambia el PR**, antes que la tanda
  entera, para tener el veredicto de Linux en un minuto y no en veinte. No está construido ni pedido.

Y lo que más pesó hoy no fue no poder predecir el rojo: fue que estuvo tres horas sin que nadie lo
leyera. Eso lo arregla el latido (SCRUM-1474, ya en `main`), no este censo.

## El guard

`tests/scrum1485-censo-rutas-de-maquina.test.mjs` entra en la tanda. Siete tests, 5 s en esta máquina.

- **Suelo:** más de 1.000 ficheros leídos, 0 sin leer, más de 500 que tocan rutas, más de 20 sitios.
  Son suelos holgados a propósito: no es un número que otro ticket tenga que mover.
- **Lo que exige:** el conjunto de LITERAL de `tests/` es exactamente el declarado (hoy, uno). Uno
  nuevo cae, y el mensaje dice la cura. Uno declarado que desaparece también cae.
- **Lo que NO exige:** nada sobre NO-LEIDO ni sobre mezclas. `assert.equal(f(x), path.join(...))` es
  la forma correcta y sale NO-LEIDO: bloquearla sería un rojo sobre código sano.

Mutaciones declaradas (`MUTACIONES_QUE_ME_TUMBAN`), corridas a mano sobre `7c40cdc1304a3521b5d82f68c3511b30a16720d3`
con la base sin mutar en 7 de 7:

| mutación | `git diff --numstat` | cae el test que nombra |
|---|---|---|
| El censo deja de mirar `.includes()` | 1 1 | sí (caen 2) |
| Un separador pegado a la ruta deja de contar | 1 1 | sí (cae 1) |
| Normalizar deja de curar | 1 1 | sí (caen 3) |
| Un texto con «/» deja de ser LITERAL | 1 1 | sí (caen 4) |

Árbol limpio después de las cuatro.

## Desviaciones, declaradas

- **Las mezclas** no están en la aceptación. Las añadí porque el defecto de hoy nacía en una, dentro
  de un array que el censo no sigue.
- **El prototipo del separador** tampoco. Es la respuesta medida a «qué haría falta para verlo».
- **La segunda sonda** es por texto a propósito: para que no comparta los fallos del AST.

## Tests

`tests/scrum1485-censo-rutas-de-maquina.test.mjs` → 7 de 7.

## Lo que se corrió antes de empujar

No `guards:entrada` y ya: los tests que **enumeran** las carpetas que toco (`tests/`, `scripts/`,
`docs/master/`). Sin `dist/`, que en este árbol no hay.

| tanda | población | resultado |
|---|---|---|
| `npm run guards:entrada` | 13 guards, 158 tests | verde |
| Los que enumeran y no piden `dist/` ni base de datos | 146 ficheros, 1.146 tests | 1.044 pasan · 101 caen: 100 por falta de `dist/` y **1 mío** |
| Los que censan tests nuevos (anclas, nombres, cifras, temporales) | 18 ficheros, 105 tests | 100 pasan · 5 caen: 3 por `dist/`, 1 ciego por la unidad del temporal y **1 mío** |
| Los que nombran `evidencias` o `scripts/equipo` y faltaban | 43 ficheros, 499 tests | 489 pasan · 10 caen, los 10 de un banco de vistas que pide `dist/` |

**Los dos rojos míos, cazados aquí y no en el CI:**

1. `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`: su trinquete cuenta los guards que
   declaran mutaciones, y el mío es uno más. Decía 31 y son 32. Subido como pide su mensaje: la
   constante, su ancla de mutación y la nota con fecha y sha. **Toco un test que no es mío**, y es lo
   que ese test manda hacer.
2. `tests/scrum737-cifra-con-arbol-y-hora.test.mjs`: yo había escrito «hoy 1.438 ficheros y 78
   sitios» en un comentario de mi test. Dos cifras sin ancla. Quitadas del comentario: viven aquí.

Después de arreglarlos, `scrum812` da 5 de 5, `scrum737` 5 de 5 y el de este ticket 7 de 7.

**Lo que NO se pudo correr, y es memoria:** 71 tests que enumeran carpetas piden además `dist/` o una
base de datos. Construir `dist/` pide 2.200 MB libres y había 1.340. De esos 71 se corrieron los 9 que
nombran suelos, mutaciones o `scripts/equipo`: 89 tests, 77 pasan y 12 caen, los 12 al cargar `dist/`.
Un rojo de esos 12 que fuera mío no lo habría visto: lo dirá el CI.

Y un tropiezo del instrumento: lancé `scrum737` con el nombre de fichero mal escrito. Salió 0, con
12 tests en verde que eran los de los otros dos ficheros. Lo vi por el recuento, no por el código de
salida. Repetido con el nombre copiado de `git ls-files`.

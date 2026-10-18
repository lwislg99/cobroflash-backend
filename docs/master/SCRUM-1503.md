# SCRUM-1503 · La dirigida y los tests que barren el árbol — medido, sin construir nada

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:37:04Z

A9: aviso → cicatriz J3 «Puse como control a cero un test que no listaba ningún directorio: su cero habría salido igual con el cruce roto.» — no se pudo comprobar: es un guion de evidencias que corre a mano fuera de la tanda; lo que queda es que `cruce.mjs` exige, para salir 0, un control a cero cuyo sujeto SÍ lista un directorio

J3 (sesión `jv-j3`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). **Es LECTURA y
EJECUCIÓN de lo que ya hay:** no se ha tocado `scripts/tests-que-cubren.mjs`, ni `scrum622`, ni ningún test,
workflow o fichero de S3. Todo lo que hay aquí sale de los guiones de `docs/master/evidencias/SCRUM-1503/`, que
importan el lector REAL de la herramienta (`scripts/_tests-que-cubren.mjs`), no una copia.

El hook de arranque dijo «SIN IDENTIDAD… no construyas» porque no reconoce el nombre `jv-j3` (carril de S5,
SCRUM-1498). Se siguió, por orden escrita de la ficha común del 8-oct.

## Lo primero: el hecho del ticket se sostiene, su explicación no

| lo que dice el ticket | lo medido hoy |
|---|---|
| La herramienta elige 222 de 1.286 para la rama de #2280 y `scrum622` no está | **Se sostiene.** Hoy, para el mismo fichero tocado: **223 de 1.290**, `scrum622` fuera (control: `scrum976` dentro, un nombre inventado 0) |
| «No es un fallo: es su forma. Un guard que barre el árbol no cubre un fichero: cubre todos. No hay arista que lo traiga» | **Falso.** La herramienta nació (SCRUM-1363, 1-oct) justo para eso y tiene DOS aristas: `RECORRE` (el test lista un directorio que contiene lo tocado) y `NO_SE` (enumera por un camino que no se puede leer: **entra siempre**). 205 tests están hoy en `NO_SE` y entran en toda dirigida |
| «En un worktree anidado la dirigida devuelve 87 rojos ajenos» | **No reproducido.** Sin `dist/`, `--lanzar` no corre nada: dice `🔴 CIEGO: no hay dist/`, salida 2 (línea escrita el 1-oct, commit `7bf727c36`). Los 87 exigen un `dist/` que exista y esté incompleto o viejo; **cómo estaba el de J6 no lo he medido** |
| SCRUM-1412 (S3) tocó la herramienta «anoche» | **No.** Entró en `main` el **2-oct 12:45:42Z** (PR #2141, merge `2bec29e3e1eac2b2e375dabaee6cb8c8d86b0a8b`). Anoche sólo se cerró el ticket. J6 midió el 7-oct CON SCRUM-1412 dentro: no vacía este ticket ni le quita nada |

**Veredicto de la pregunta de la ficha:** el ticket **sigue en pie, pero es otro y más pequeño**. No es un límite
de forma de la herramienta: son **tres agujeros concretos de su lector**, y dejan fuera a **24 tests de 1.290**.

## ② Cómo decide, y por qué `scrum622` se queda fuera

Un test entra por `NOMBRA` (escribe la ruta o el nombre del fichero tocado), por `RECORRE` (lista un directorio
que lo contiene) o por `NO_SE` (lista algo que el lector no sabe resolver; entra siempre).

El control que separa esto de una teoría (`lo-que-ve-el-lector.mjs`), con el fichero tocado de #2280:

| test | lo que el lector VE de él | razón |
|---|---|---|
| `scrum976` (SÍ entra) | 8 directorios listados, entre ellos `docs/master` · 35 «no sé» | `RECORRE · docs/master` |
| `scrum982` (SÍ entra) | 0 directorios · 1 «no sé» (`readdirSync(path.join(RAIZ, dir))`) | `NO_SE` |
| `scrum622` (NO entra) | **0 directorios · 0 «no sé»** | ninguna |

Para el lector, `scrum622` no lista nada. Y sí lista: ejecutado con la sonda, 425 directorios listados, la raíz
incluida. La causa (`por-que-no-entra.mjs`, cuatro variantes fabricadas en memoria, el árbol no se toca):

| variante | el lector ve |
|---|---|
| A · tal cual: `(function anda(dir) { … })(RAIZ);` | nada |
| B · con nombre: `function anda(dir) { … }  anda(RAIZ);` | un «no sé» → entraría SIEMPRE |
| C · en el sitio, con `docs` escrito | nada |
| D · con nombre, con `docs` escrito | `RECORRE docs` |

El lector sólo apunta una llamada a un caminante cuando lo que se llama es un NOMBRE
(`scripts/_tests-que-cubren.mjs`, `else if (ts.isIdentifier(c)) llamadas.push(n)`). Una función que se invoca en
el mismo sitio donde se escribe no es un nombre, y su llamada no se mira.

## ① Cuántos hay así — población derivada de lo que LISTAN AL EJECUTARSE

`sonda-fs.mjs` se carga dentro del proceso de cada test y apunta cada directorio que se lista y desde qué fichero
del repositorio (así se ve un listado hecho a través de un helper). Corridos los **1.290 tests**, uno por proceso:
1.290 con testigo de que la sonda cargó, 0 sin recuento en su TAP. `cruce.mjs` compara, par a par, lo listado con
lo que el lector atribuye: un par (test, fichero) es CIEGO si el test listó en ejecución el directorio de ese
fichero y tocar el fichero no trae el test.

| | tests |
|---|---|
| Listan en ejecución algún directorio seguido por git | 342 de 1.290 |
| · la herramienta ya los mete siempre (`NO_SE`) | 125 |
| · no están en `NO_SE` y el lector los cubre enteros | 193 |
| · **con algún par ciego — la población del ticket** | **24** |
| Listan la RAÍZ del repositorio | 17 (15 en `NO_SE`, **2 fuera: `scrum622` y `scrum643`**) |

Controles, corridos antes de dar el número: `scrum622` sale, y con el fichero de #2280 entre sus ciegos ·
`scrum713c` (lista un directorio, no está en `NO_SE`, el lector lo ve) **no** sale · un nombre inventado, 0.

Los 24, por causa (`forma.mjs` reescribe en memoria cada caminante «en el sitio» a su forma con nombre y lo vuelve
a pasar por el lector; `desde-cuando.mjs` hace lo mismo con las otras dos):

| causa | tests | con la forma cambiada, el lector… |
|---|---|---|
| El caminante se invoca en el sitio | **22** | los ve a los 22: 7 pasarían a `NO_SE` (siempre) y 15 a `RECORRE` (`src`, `public`) |
| El caminante se pasa como valor (`dirs.forEach(walk)`) | 1 (`scrum164`) | gana un «no sé» |
| Dos `const dir` en el mismo fichero: el lector resuelve el nombre sin ámbito y se queda con la primera | 1 (`scrum628`, por `scripts/_cobertura-visual.mjs`) | gana `tests` |

Lo que dejan sin cubrir: `scrum622` y `scrum643`, ~4.060 ficheros cada uno de 5.764 seguidos (todo lo que no
nombran); `scrum718`, 2.121; `scrum628`, 1.434 (la carpeta `tests/`); los otros 20, entre 131 y 760 (`src/` o
`public/`). **5.561 de 5.764 ficheros seguidos (96,5 %) tienen algún test que lista su carpeta y no entra al
tocarlos; sin los dos de la raíz, 2.257 (39,2 %).** La lista entera, en `por-test.tsv`.

La misma forma está en 29 fuentes de `tests/` y `scripts/` (34 caminantes); 5 no salen ciegos porque ya entran
siempre por otro «no sé».

## ③ Desde cuándo

**Nunca los trajo.** `scripts/_tests-que-cubren.mjs` tiene UN commit (`7bf727c36`, 1-oct-2026, SCRUM-1363) y su
blob es idéntico al de hoy. Pasados por él los 24 ficheros que listan, en su versión de ese día: existían 23 y
**22 no dejaban rastro** (el que sí, `_cobertura-visual.mjs`, dejaba el mismo directorio equivocado que hoy).

Es un hueco de nacimiento que **no está escrito** donde la herramienta dice de qué no responde (su cabecera habla
de rutas compuestas en ejecución y del grafo de `src/`, no de esto). Y no era desconocido: el registro de
SCRUM-1412, del 2-oct, cierra con «la tanda dirigida local no corría `scrum622` contra el fichero nuevo porque el
censo lo recorre por directorio, no lo nombra». Lo dejó anotado como causa y nadie lo convirtió en nada.

Tres veces en seis días el CI ha cazado lo que la dirigida no habría traído:

| fecha | PR | cayó | la dirigida lo habría traído |
|---|---|---|---|
| 2-oct | #2141 (S3, SCRUM-1412) | `SCRUM-622 · EL CENSO` | no (lo dice su registro) |
| 6-oct | #2220 (J3, SCRUM-1470) | `scrum643`, por `src/modules/quotes/domain/presupuestoParaPdf.ts` | no: medido hoy, 290 de 1.290 y `scrum643` fuera. **Si aquel día se corrió la dirigida, no lo sé** |
| 7-oct | #2280 (J6, SCRUM-1339h) | `SCRUM-622 · EL CENSO` | no (reproducido arriba) |

## ④ Qué debería correr una sesión antes de empujar — las salidas, con su coste y SIN elegir

Tiempos: suma de procesos bajo la sonda, en esta máquina (`costes.mjs`). No es lo que tardan en la dirigida ni en
el CI. Los 1.290 tests, 1.622 s; los 205 que hoy entran siempre, 766 s; **los 24, 34 s**; los dos de la raíz, 6,5 s.

| salida | qué es | coste | qué NO arregla |
|---|---|---|---|
| **A · Lista fija** | Los 24 (o sólo los 2 de la raíz) se corren siempre antes de empujar | +34 s (o +6,5 s) por dirigida. Hay que escribir la lista en algún sitio y mantenerla: el test nº 25 con la misma forma no entra solo | Es la lista que el ticket pide no ensanchar. No dice cuándo se queda vieja |
| **B · Que el lector aprenda** | Arreglar los tres agujeros en `scripts/_tests-que-cubren.mjs` | 7 tests más en TODA dirigida y 15 más cuando se toca `src/` o `public/`; los 7 suman 13,8 s. **El fichero es de S3 (equipo de Luis): se le dice, no se le hace** | Los agujeros que la sonda no ve (abajo). El siguiente agujero del lector sale igual de callado |
| **C · Escribirlo** | Decir en la cabecera de la herramienta y en la norma que esta familia sólo la juzga el CI | Ninguno de construcción. Cada caso cuesta un ciclo de CI: rojo legible a 9,6 min p50 (SCRUM-1393), y el obligatorio da veredicto en el 37-39 % de los commits de `main` (SCRUM-1498) | Nada: deja el hueco y lo nombra |
| **D · Vigilar el lector** (no estaba en el ticket) | Repetir este cruce cada cierto tiempo: es lo único que caza el agujero SIGUIENTE | ~9 min de máquina por pasada (242 + 260 + 44 s, tres a la vez). Como test de la tanda no cabe; como trabajo aparte, es un workflow, y eso es de S5 y del fundador | No arregla los 24: los cuenta |

A y B no se excluyen, y D es lo que distingue «arreglado» de «arreglado hasta el próximo». **No elijo.**

## Lo que NO he medido, dicho

- **Listar un directorio no es depender de cada fichero suyo.** Las cifras de ficheros ciegos son el techo.
- **60 tests saltaron enteros** (gateados por base o por staging): no corrieron, no listaron nada, y ninguno está
  en `NO_SE`. Si alguno barre el árbol cuando corre, aquí no se ve. Sólo el CI los ejecuta.
- **76 tests lanzan algún proceso node**; un hijo al que se le limpia el entorno no lleva la sonda. 35 ya están en
  `NO_SE`; de los otros 41 no sé qué lista el hijo.
- **Enumerar con git** (`ls-files`, `ls-tree`, `grep`): 16 tests lo hacen en ejecución, 14 en `NO_SE`. Los otros 2
  (`scrum804b`, `scrum835`, los dos con `git ls-tree`) pueden estar mirando un repositorio de usar y tirar: la
  sonda no apunta el directorio de trabajo.
- **1 test cortado por el techo de 120 s** (`scrum534b`, en `NO_SE`): no he mirado por qué.
- **6 tests cayeron bajo la sonda.** Uno, `scrum1308`, era un rojo MÍO (error 5, abajo). Los otros cinco
  (`scrum1199`, `scrum245-tipo-obliga-declarar`, `scrum385`, `scrum471`, `scrum475`) caen también SIN la sonda,
  y sus mensajes piden `node_modules/express`, `node_modules/typescript/bin/tsc` y el CLI de Prisma DENTRO de este
  árbol: un worktree anidado no trae `node_modules` propio. En el CI los cinco pasaron.
- `forma.mjs` mira `tests/`, `scripts/` y `scripts/equipo/`, sin bajar a más subcarpetas.
- La tanda dirigida no la he corrido entera: sin `dist/` se declaró ciega, y después no hacía falta.
- El cuerpo de los 24 tests no lo he leído: sólo la línea donde listan y la que los llama.

## Errores míos en esta tanda

1. Puse `scrum976` como control a cero y no listaba ningún directorio: daba cero con el cruce bien o mal. Lo
   delató su propia línea («lista 0 directorios»). Sustituido por `scrum713c`, y el guion enseña cuántos lista.
2. Conté los tests que lanzan node partiendo la orden por espacios: la ruta de node lleva uno («Program Files») y
   salió 1 donde eran 76. Lo delató que el recuento a mano de procesos daba 427.
3. El primer control positivo de la selección fue `scrum713c`, que lista `public/dashboard/js` y no tenía por qué
   entrar con un fichero de `docs/`: salió 0 y no probaba nada. Cambiado por `scrum976`.
4. Escribí «los 7 suman ~13 s» antes de sumarlos, y al sumarlos casé por prefijo y entraron tres tests de más
   (15,1 s). Sumados por nombre entero: 13,8 s.

5. **El primer obligatorio de #2290 salió ROJO, y el rojo era mío** (job 113072722432, 7-oct 23:51:05Z: 11.021 pruebas,
   1 cae). Cayó `SCRUM-1308 · fuera de tests/ NINGÚN fichero se llama como un test`: un guion de evidencias se
   llamaba `dato-por-test.mjs`, y `node --test` ejecuta por su nombre todo lo que acaba en `-test`. Renombrado a
   `lo-que-ve-el-lector.mjs`. **Lo tuve delante antes de empujar y no lo miré:** `scrum1308` era uno de los 6 que
   cayeron bajo la sonda, y escribí «no he mirado por qué caen». Y este rojo la dirigida SÍ lo habría traído
   (`scrum1308` está en `NO_SE`, entra siempre): no la corrí por la memoria, y no corrí a mano los que entran siempre.

## Lo que pide → dónde se ve

| lo que pide (literal) | dónde se ve |
|---|---|
| ① ¿CUÁNTOS guards hay así? | `docs/master/evidencias/SCRUM-1503/por-test.tsv` (columna `ficheros_ciegos` > 0: 24) · se rehace con `cruce.mjs` |
| ② ¿Cómo decide `tests-que-cubren.mjs` ahora mismo? | `lo-que-ve-el-lector.mjs` y `por-que-no-entra.mjs`, misma carpeta; tablas de arriba |
| ③ ¿Desde cuándo? | `desde-cuando.mjs`, misma carpeta |
| ④ ¿qué debería correr una sesión antes de empujar? | NO HECHO → es `decision-jefe`: las cuatro salidas van arriba con su coste, sin elegir. La B cae en el carril de S3 |

## Cómo se repite

    node docs/master/evidencias/SCRUM-1503/candidatos.mjs <montones.json, fuera del árbol>
    node docs/master/evidencias/SCRUM-1503/sonda-lanzar.mjs --montones <montones.json> --cual CANDIDATO --salida <dir fuera del árbol>
    (lo mismo con --cual SIEMPRE y --cual SIN-PRIMITIVA, cada uno en su directorio)
    node docs/master/evidencias/SCRUM-1503/cruce.mjs --crudo <los tres directorios> --tsv <fichero>
    node docs/master/evidencias/SCRUM-1503/forma.mjs
    node docs/master/evidencias/SCRUM-1503/desde-cuando.mjs
    node docs/master/evidencias/SCRUM-1503/costes.mjs

Pide `dist/` (aquí, `prisma generate` y `tsc --noCheck`). `sonda-consolidada.json` guarda lo que listó cada test:
`cruce.mjs`, `forma.mjs`, `desde-cuando.mjs` y `costes.mjs` se pueden repetir sin volver a correr la sonda.

## 1503c · la salida B: el lector aprende las tres formas (18-oct-2026, S3)

**Medido contra:** `origin/main` = `183895cdef71c5655a3978352b716a79e1ca2b2b` · 2026-10-18T18:01:02Z

A9: comprobación → `tests/scrum1503c-el-lector-ve-el-caminante.test.mjs`

La salida B la eligió el fundador el 8-oct (c.18852, «2-Ok vamos por B») y pasó a S3. Llevaba diez días parada;
la encargó el orquestador de Luis. Sólo se toca el lector, `scripts/_tests-que-cubren.mjs` (carril S3); ni
`scrum622` ni ningún guard ni workflow.

**Qué cambia en el lector.**
- La llamada a un caminante escrito EN EL SITIO, `(function anda(dir) { … })(RAIZ)`, se resuelve como la llamada
  a un nombre. Se identifica por su NODO y no por su nombre (ver el segundo error, abajo).
- `lista.forEach(caminante)` (y `map`, `flatMap`, `filter`, `some`, `every`): cada elemento de una lista literal
  es su primer argumento. Una lista que no se lee va a NO_SE, nunca a cero.
- El valor de un nombre se busca CON ÁMBITO: gana la declaración del ámbito más cercano que encierra al uso.
- Dos lecturas que salieron al medir: `a || b` y `a ?? b` (gana el lado que es un directorio) y `lista[0]` sobre
  una lista literal.

**La medida que pidió la decisión, con el cruce de J3** (`cruce.mjs`, la misma sonda del 8-oct, sobre los 1.290
tests que tienen salida; los 109 posteriores no la tienen y no cuentan):

| | antes | después |
|---|---|---|
| tests con algún par CIEGO | 24 | **0** |
| ficheros seguidos con algún test ciego | 5.889 de 6.698 | **0** |
| listan la raíz y NO están en NO_SE | 2 (`scrum622`, `scrum643-zona`) | **0** |
| de los 342 que listan, entran siempre (NO_SE) | 125 | **130** |

Controles del cruce: `scrum622` ya no está en la población; `h-entradas.mjs` (el fichero de #2280) ya no es ciego
para nadie; `scrum976` y `scrum713c` siguen fuera de la población y un nombre inventado, 0.

**El techo: que la dirigida NO crezca más de lo medido.** Mismos ficheros tocados, lector de `main` contra el de
la rama, sobre el mismo árbol (1.399 tests, motivos para no fiarse 0 y 0):

| tocado | antes → después | `scrum622` / `scrum643-zona` |
|---|---|---|
| dos ficheros de `docs/` (como 1345b) | 254 → 258 (+6 −2) | no/no → **sí/sí** |
| `h-entradas.mjs` (el caso de #2280) | 254 → 258 (+6 −2) | no/no → **sí/sí** |
| `public/dashboard/js/homeView.js` | 506 → 509 (+6 −3) | sí/no → sí/sí |
| `src/modules/quotes/quotes.routes.ts` | 332 → 350 (+21 −3) | no/no → **sí/sí** |
| `tests/scrum713c-…` | 252 → 256 (+7 −3) | no/no → **sí/sí** |
| `scripts/equipo/ya-esta.mjs` | 247 → 250 (+6 −3) | no/no → **sí/sí** |

+2 a +4 netos fuera de `src/`, frente a los +7 que estimó J3. En `src/`, +18 netos: son los caminantes de `src/`
que estaban ciegos (`scrum245-*`, `scrum397`, `scrum728`…), que J3 ya contaba («15 más al tocar `src/` o
`public/`»). No entran cincuenta. `scrum643-huso-del-sello-fiscal` no entra en ninguno, ni antes ni después: no
estaba entre los 24.

Repetido tras mezclar `main` (`fa163339`, 1.402 tests): las mismas cifras con +1 en casi todos los casos (p. ej.
255 → 260). Ese +1 es el test nuevo de este ticket: escribe la ruta de `scrum622` como cadena, y el lector trata una
ruta de `tests/` escrita así como un script que se lanza (SCRUM-1363), de modo que hereda su NO_SE y entra siempre.
Es el comportamiento de antes, no de este cambio.

**Los que SALEN, uno a uno** (entraban siempre por un NO_SE que ahora se lee):
- `scrum241` y `scrum495` listaban `process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')`
  (`scripts/backup-dump.mjs:167`). Se lee como `backups/`, que no está en el repositorio; en ejecución listan 0
  directorios seguidos.
- `scrum547` lista `dir ?? path.join(raiz, 'docs')` (`tests/_documentos-a-la-espera.mjs`). Ahora entra por
  RECORRE `docs`; en ejecución lista 287 directorios, con 0 ciegos.

**Verificado, ejecutando.**
- `tests/scrum1503c-el-lector-ve-el-caminante.test.mjs`: 6 de 6. Con el lector de `main` puesto en su sitio, rojo
  6 de 6, y restaurado byte a byte (hash).
- Las 5 `MUTACIONES_QUE_ME_TUMBAN`, aplicadas una a una y restauradas byte a byte: cada una tumba el test que nombra.
- La dirigida de esta misma rama, con el lector nuevo: 266 ficheros, 2.595 pruebas, 3 caídas: `scrum854` (faltaba
  este registro), `scrum737` (una cifra sin ancla en mi test, ya anclada) y `scrum1321`, ciego por entorno (temporal
  en C:, árbol en D:).

**Errores míos, los dos cazados por el cruce antes de empujar.**
1. El ámbito, bien leído, rompió otra cosa: `_microcopy-aprobada.mjs:258` declara `const DIR_APROBACIONES = dir ||
   DIR_APROBACIONES_REAL`, que el resolver no sabía leer. Con «la primera declaración» se leía la de la línea 36 y
   salía bien por casualidad. **NO_SE pasó de 125 a 163 y 34 tests entraban en TODA dirigida.** Arreglado leyendo `||`.
2. El caminante en el sitio, buscado por NOMBRE: en `scrum728` hay un `anda(d)` que recorre directorios y dos
   `anda(n)` que recorren el árbol sintáctico, y éstos heredaban el caminante del primero (`anda(sf)` a NO_SE).
   Arreglado por nodo; tiene su mitad en el test (`el homónimo`).

**Lo que NO cubre, dicho.**
- El cruce mide los 1.290 tests que tienen salida de la sonda del 8-oct. Los 109 posteriores no se han medido en
  ejecución, y el «24» de J3 era un suelo: 60 saltaron enteros y 41 lanzan hijos que pueden no llevar la sonda.
- Cuatro caminantes reciben un argumento que no se lee escribiendo (`andar(base)`, `rec(abs)`, `andar(dir)`,
  `anda(abs)`) y van a NO_SE: entran siempre, que es el lado seguro, no el preciso.
- `scrum804b` y `scrum835` enumeran con `git ls-tree` en ejecución y siguen fuera de NO_SE, como antes. Sobre qué
  repositorio lo hacen no lo sabía J3 y yo no lo he mirado: no es de las tres formas de este ticket.

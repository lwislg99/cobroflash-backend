# SCRUM-850 · La tanda podía salir «0 fail» con un test en rojo — y la regla que lo cierra

**Medido contra:** `origin/main` = `9b1392b5f5d28c85473530d5f28248414b3f9b0e` · 2026-09-15T09:42:00+02:00
**Rama:** `scrum-850-la-poblacion-del-instrumento` · **Carril:** instrumentos · proceso
**Gate:** sin gate — corre en `npm test`

> ⛔ **No se ha relajado ningún test ni se ha tocado lo que ningún guard EXIGE.** Esto mira **cómo
> se invoca** la tanda, no qué mide. Un `| grep` se quita del comando, nunca del guard que lo
> denuncia. Ni estado ni flag nuevo (regla 27), ni dependencia nueva (regla 36): `typescript` ya
> compila este repositorio.

---

## 0 · Obligación 0, con su contraste

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-850(-|$)"   ->  NINGUNA
git log origin/main -i --grep="scrum-850"                            ->  vacío
docs/master/SCRUM-850.md                                             ->  no existía
```

**Caso (a): nunca se empujó.** Y el contraste que separa (a) de un fallo del instrumento: un `grep`
**suelto** de `850` sobre `ls-remote` devuelve **1** línea, y la consulta **anclada**, **0**. Esa de
más es `fca4b3796f876f850064b578dc6e646574f968b5` — el número vive **dentro de un sha**, no en un
nombre de rama. Un prefijo no es un nombre, y una subcadena tampoco.

## 1 · El censo — cómo se invoca la tanda hoy, derivado del árbol

`scripts/_invocaciones-de-la-tanda.mjs`. Cinco superficies, y la población se declara siempre:

| superficie | invocaciones | cómo se lee |
|---|---|---|
| `package.json` | 1 | los `scripts`; las claves que empiezan por `//` son comentarios y no cuentan |
| `.github/workflows/` | 1 | los bloques `run:`, escalares y literales, sin sus comentarios `#` |
| `scripts/*.mjs` | 3 | **por AST**, nunca por `grep`: este repositorio tiene a puñados el texto `npm test \| tail` dentro de //comentarios que explican justo esto |
| hooks (`.claude/hooks`, `.husky`) | 0 | `.sh` línea a línea, `.mjs` por AST |
| **instrucciones** (`CLAUDE.md`, `docs/RUNBOOKS.md`, normas comunes) | 5 | los bloques de código cercados |
| **POBLACIÓN** | **10** | 7 de shell + 3 por argumentos |

**La quinta superficie no estaba en el encargo y se añade declarada:** una instrucción que manda
teclear `npm test | grep …` produce exactamente el mismo verde falso que un script que lo hace
solo, y encima lo produce **en todas las sesiones a la vez**. Las dos tuberías que había estaban
justo ahí. `docs/master/` queda fuera a propósito: es el registro de lo hecho, no una instrucción.

### 🔴 Las DOS invocaciones que se comían el código de salida, y dónde estaban

| | |
|---|---|
| `CLAUDE.md:116` | `node --test … tests/*.test.mjs \| grep "# SKIP"` |
| `docs/RUNBOOKS.md:676` | la misma receta, copiada |

**Son las instrucciones que lee toda sesión al arrancar.** Y la ironía está dos líneas más abajo en
el propio `CLAUDE.md`, que ya avisaba: *«NO lo lances con `| tail`»* — para el comando de al lado.

**Arregladas cambiando el COMANDO:** el TAP se escribe a fichero y se lee en un **segundo**
comando, así que el código de salida de la tanda llega entero. Y el fichero va **fuera del árbol**
(`${TMPDIR:-/tmp}/yaqu-tanda.tap`), porque un temporal dentro del repositorio es el rojo
intermitente que midió [SCRUM-824](SCRUM-824.md).

### 🔴 El punto ciego que casi deja el censo en «scripts: 0» — y lo destapó la regla del ticket

La primera pasada dijo **población 7** y **`scripts: 0`**. Era falso: esta casa no lanza la tanda
por cadena de shell, la lanza **por argumentos** —`spawnSync(process.execPath, ['--test', …])` en
`guards-entrada.mjs` y `censo-mudez.mjs`, y un `args: ['--test', …]` en `test-staging-gated.mjs`—.

Sin shell **no puede haber tubería**, así que son sanas por construcción; pero dejarlas fuera hacía
que el censo dijera **CERO** sobre una superficie que tiene **tres**. No lo cazó leer el resultado
—7 y 0 eran perfectamente creíbles— sino **exigirle al instrumento que declarara su población**.
Es la regla de este ticket cobrándose una pieza dentro del propio ticket.

## 2 · 🔒 LA ENTREGA PRINCIPAL: la regla, escrita donde se lee

Va en **`docs/equipo/00-normas-comunes.md`**, que es lectura obligatoria de cada tanda y donde su
§A11 dice que entran las frases nacidas de una medición: en **§A3 «Cómo se mide aquí»** con su
medición delante, y en **§A10 «Frases de la casa»**.

> **UN INSTRUMENTO DECLARA SU POBLACIÓN, NO SÓLO SU RESULTADO.**
> «0 fail» sin «sobre cuántos» no es un verde: es una frase.

Con las dos mediciones del 15-sep que la justifican: una tanda que dijo **«2.681 pass · 0 fail»**
habiendo mirado **355 ficheros de 781** —y el verde era REAL para lo que miró—, y el `scripts: 0`
de arriba. Y la segunda, que es el mecanismo:

> **El código de salida es el del ÚLTIMO tramo de la tubería.** `| tail`, `| head`, `| grep`
> devuelven el suyo. Un `A; B` hace lo mismo. Si necesitas la salida, escríbela a un fichero
> —fuera del árbol— y léela en un SEGUNDO comando.

## 3 · El guard, y sus dos controles

`tests/scrum850-la-poblacion-del-instrumento.test.mjs` · **6 tests · 0 skipped**.

| test | qué sujeta |
|---|---|
| ✅ control positivo | ve las seis formas que se comen el código (`\| tail`, `\| head`, `\| grep`, `; echo`…) |
| 🔴 control negativo | **no** marca `&&`, ni la invocación que **es** el último tramo, ni los comentarios, ni un `\|` dentro de comillas, ni un `//comentario` de un `.mjs` |
| 🔴 suelo | población 0 → **CIEGO**, y además **por superficie**: si `package.json`, workflows, scripts o instrucciones se quedan en cero, el detector ha dejado de ver una familia entera |
| 🔴 el que decide | cero invocaciones que descarten el código, **y el mensaje declara la población** |
| 🔴 control por camino | ver abajo |
| — | las invocaciones por argumentos se cuentan y se declaran sin shell |

Declara **3 mutaciones** en `MUTACIONES_QUE_ME_TUMBAN` para el arnés de SCRUM-745.

### 🔴 EL CONTROL QUE DE VERDAD PRUEBA: cada camino, uno por uno

Que el detector las clasifique bien no prueba nada. Lo que prueba es que **una tanda EN ROJO sale
en rojo por cada camino de invocación que existe**. Para cada invocación de shell del censo se
reconstruye su **FORMA** —la invocación se sustituye por un proceso que sale con `1`, y los tramos
de detrás por algo inofensivo— y se exige que el compuesto **no** salga `0`. Así no se ejecuta
ninguna tanda de verdad y no hay que esquivar las interpolaciones `${{ }}` de los workflows.

Y el control lleva **su propio suelo**, porque un control que se cumple sobre el vacío es una
tautología con forma de prueba: se comprueba antes que el sustituto **falla** y que el shell
**propaga el 0**.

### El ROJO, provocado y pegado

Añadido a propósito un bloque con `npm test | tail -20` al final de `docs/RUNBOOKS.md`:

```
EXIT DEL GUARD CON LA TUBERIA DENTRO: 1 -> ROJO, como debe

AssertionError: 1 invocación(es) de la tanda se comen su código de salida, sobre una población
de 11 en 5 superficies ({"package.json":1,"workflows":1,"scripts":3,"hooks":0,"instrucciones":6}):
    TUBERIA  docs/RUNBOOKS.md:línea 740
      npm test | tail -20

docs/RUNBOOKS.md:línea 740 → «node -e "process.exit(1)" | cat > /dev/null» salió 0 con la tanda en rojo
```

**Cayeron los DOS**: el que decide —con fichero, línea y población— y el control por camino, que
demostró que esa forma concreta devuelve `0` con la tanda en rojo.

**Restaurado byte a byte:** se capturaron los **bytes de disco** antes de tocar (no el blob, que
para un fichero normalizado no es referencia — lección de SCRUM-570) y `Buffer.compare(disco,
ORIGINAL)` devolvió **0**. `git status` quedó con lo previsto y nada más.

## 4 · Punto 4 del ticket (el `grep` de CR): medido, y **va aparte**

**No se hace aquí, y el motivo es el alcance medido**, no la prisa:

| | |
|---|---|
| población barrida (`scripts/`, `tests/`, workflows, hooks) | **1.081 ficheros** |
| líneas que casan la forma «contar caracteres de control con `grep`» | **32** |
| de ésas, **instrumentos vivos** que lo hagan | **0** |

Las 32 son **comentarios que explican la prohibición** y **fixtures del propio guard de
SCRUM-766**. O sea que la barrera que pide el ticket no puede ser textual: se cazaría a sí misma
en el comentario que explica la prohibición —el defecto que esta casa ya tiene nombrado— y se
llevaría por delante al guard que ya resolvió el problema. Necesita AST, exención propia y
exención de fixtures, y eso es un ticket con su propio diseño.

> **Lo que sí queda hecho de ese punto:** este fichero y su guard **no usan `grep` para contar**
> nada. Todo lo que cuentan, lo cuentan en JavaScript.

## 5 · Verificación — y un rojo intermitente que NO es de este ticket

| | |
|---|---|
| este guard, suelto | **6 tests · 6 pass · 0 fail · `# skipped 0`** |
| `npm run guards:entrada` | **22 tests · 22 pass · 0 fail · 0 skipped** |
| el rojo del guard | provocado, pegado en §3, restaurado con `Buffer.compare = 0` |
| `prisma generate` | corrido antes del build, en un árbol con `node_modules` **propio** (comprobado con `realpath`: no es junction, así que regenerar no le rompe la tanda a otra sesión) |

### 🔴 EL DEFECTO DEL TICKET, OCURRIDO DENTRO DEL TICKET

La primera tanda completa salió **`NPM_TEST_EXIT=1`** — y el envoltorio que la lanzó informó
**«exited with code 0»**. Exactamente el modo de fallo que este ticket persigue, en vivo.

**No lo cazó leer el resumen. Lo cazó haber escrito el código de salida a un fichero** en vez de
fiarme de lo que dijera el envoltorio — que es la misma disciplina que la regla del §2.

### Las cuatro pasadas, y por qué el rojo no se le cuelga a nadie

| qué se corrió | resultado |
|---|---|
| tanda completa, esta rama (base `9b1392b5`), reporters `spec`+`tap` | **`exit 1` · 1 fail** |
| **la misma, misma base, sólo reporter `tap`** | **`exit 0` · 0 fail** |
| tanda completa en `origin/main` limpio (`d9a05138`) | `exit 0` · 0 fail |
| `scrum754` suelto, y junto a este guard | 22/22 y 28/28, verde |

El único fallo fue `SCRUM-754b` (`tests/scrum754-el-juez-que-oscila.test.mjs:532`), que no toca
nada de aquí. **Es INTERMITENTE**, queda registrado como `P3-FLAKY-754` en `docs/BUGS.md` con las
cuatro mediciones, y **no se toca**: está prohibido relajar un test para que la tanda pase, y
además es de otro carril (regla 37).

> 🔴 **Y una hipótesis mía que se cayó, escrita porque el informe sin errores propios es el que no
> ha mirado.** Propuse que lo explicaba el arreglo de SCRUM-824 (`ef5395bf`, temporales fuera de
> `tests/`), que el árbol limpio tenía y mi base no — un mecanismo redondo, porque `scrum754`
> vigila justo la huella de ese directorio. **La segunda pasada sobre mi misma base salió verde y
> la tumbó.** La atribución fue prematura: lo único que las cuatro pasadas sostienen es
> «intermitente», y el único confundidor que cambió entre la roja y la verde fue el número de
> reporters, no el código.

### La tanda final, tras mezclar `main` (`bf4381cf`)

```
NPM_TEST_EXIT_FINAL=0          <- el de `npm test`, leído de un FICHERO, no del envoltorio
# tests 6606
# pass 6496
# fail 0
# cancelled 0
# skipped 110                  <- los gateados de siempre, cada uno con su motivo declarado
# todo 0

ok 6433 - SCRUM-850 · ✅ CONTROL POSITIVO: el detector ve cada forma que se come el código
ok 6434 - SCRUM-850 · 🔴 CONTROL NEGATIVO: `&&`, el último tramo y los comentarios NO se marcan
ok 6435 - SCRUM-850 · 🔴 SUELO: el censo DECLARA su población, y una población vacía es CIEGO
ok 6436 - SCRUM-850 · 🔴 ninguna invocación de la tanda descarta su código de salida
ok 6437 - SCRUM-850 · 🔴 CONTROL POR CAMINO: una tanda EN ROJO sale en rojo por CADA forma que existe
ok 6438 - SCRUM-850 · las invocaciones por ARGUMENTOS se cuentan y se declaran sin shell
```

Y este guard **suelto**, que es donde el `# skipped 0` significa algo:

```
# tests 6 · # pass 6 · # fail 0 · # skipped 0 · # todo 0
```

## 6 · Lo que NO se ha tocado

`src/` · `prisma/schema.prisma` · el camino de emisión · ningún guard ni lo que exige · ningún
test relajado · ninguna rama ajena · Jira · producción ni staging · ninguna dependencia.
Lo escrito: `scripts/_invocaciones-de-la-tanda.mjs`, `tests/scrum850-…test.mjs`, dos comandos
corregidos (`CLAUDE.md`, `docs/RUNBOOKS.md`), la regla en las normas comunes y esta entrada.

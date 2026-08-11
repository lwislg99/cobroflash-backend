# SCRUM-476 · dos censos del mismo hecho: por qué difieren, medido

**Medido contra:** `origin/main` = `dd5416f04ed1b8d80a403a9525fab33437fe8b03` · 2026-08-11T21:12:46+01:00

**11-ago-2026** · sin gate, corre en `npm test`

## PASO 0

* `git worktree list`: **cuatro** árboles — `cobroflash-backend` (aquí), `cobroflash-b1`,
  `cobroflash-b2`, `cobroflash-b3`. Ninguno en este carril.
* **Búsqueda por CONTENIDO, no por número.** `git ls-remote --heads origin` completo (**218** ramas)
  + `git log --all --grep` por `junction`, `LinkType`, `topolog`, `worktree`, `wt-`. No existe
  ninguna rama `scrum-476-*`. **Sí apareció trabajo relacionado y se dijo antes de seguir:**
  * `scrum-471-node-modules-al-dia` (`b5a45714`) → **en `main`**;
  * `scrum-351-topologia-node-modules` (`532b5186`) → **en `main`** (PR #707);
  * 🔸 **`scrum-471-pretest-antes-de-la-suite` (`a9a93fc5`) → NO está en `main`.** Un commit,
    `package.json` + `scripts/_node-modules-al-dia.mjs`. **No se toca**: es del carril de al lado.
* `git fetch origin main:main`: **antes `dd5416f0`, después `dd5416f0`** — ya estaba al día.
* `npx prisma generate`: OK (los worktrees no comparten `node_modules`, así que solo mueve éste).
* **`docs/master/SCRUM-476.md` no existía.** `docs/master/SCRUM-471.md` tampoco, y su test lleva en
  `main` desde el mismo día: se crea aquí.

## La contradicción

Dos instrumentos que miran `node_modules` entraron a `main` **el mismo día**, y publicaron números
irreconciliables:

| | commit | dice |
|---|---|---|
| **SCRUM-471** | `b5a45714` · 11-ago **17:32 +0200** | 200 árboles · 147 con `node_modules` · **91 por junction** |
| **SCRUM-351** | `65af562d` · 11-ago **20:22 +0100** | cuatro árboles · **cero enlaces** · 60 directorios `node_modules` |

**3 h 50 m de diferencia, no un día.** La cabecera de `scripts/topologia-node-modules.mjs:20` y
`docs/master/SCRUM-351.md:31` sitúan el censo de 471 «con fecha de **ayer**»; el propio fichero de
471 dice **11-ago-2026** y su commit es de ese día. La entrada de 351 es historia y **no se
reescribe** (regla que ella misma fija: una medición fechada se conserva); queda anotado aquí, que
es donde alguien lo va a buscar.

## Las tres hipótesis, y cuál dice la medición

Se midieron las tres. **No se eligió la que sonaba mejor.**

### (b) «el censo de 471 está mal» — **REFUTADA**

Su instrumento es correcto y se puede volver a correr: le pasas un árbol y compara **lo que pide su
lock** contra **lo instalado**, leyendo el `package.json` de cada paquete. Corrido hoy sobre los
cuatro árboles da 27 dependencias directas comprobadas y cuatro «al día». No hay nada que arreglar
en él.

### (a) «cuenta árboles anidados dentro de `node_modules`, no worktrees» — **REFUTADA**

Es la hipótesis que SCRUM-351 dejó abierta en su hueco #1. Medido hoy sobre los cuatro árboles:

| población candidata | hoy |
|---|---|
| worktrees de `git worktree list` | **4** |
| directorios llamados `node_modules` | **60** |
| directorios con `package.json` (paquetes anidados) | **2.912** |
| **enlaces (symlink/junction) de cualquier tipo** | **0** |

**Ninguna da 200, y —lo que decide— ninguna puede dar 91 junctions, porque no hay ni uno.** Sea cual
sea el subconjunto que se elija de este disco, «91 por junction» es inalcanzable. 471 no contaba
árboles anidados de aquí.

### (c) «los dos eran ciertos» — **CONFIRMADA, pero la diferencia es de SITIO, no de tiempo**

La sospecha del encargo era temporal: que ayer hubiera `wt-*` y se hubieran borrado. **En esta
máquina eso no pasó**, y se puede enseñar:

* `.git/worktrees/` — el directorio donde git registra cada worktree — tiene mtime **2026-08-05
  05:09:54**. Añadir o retirar un worktree cambia esa marca. **Desde el 5-ago no se ha registrado ni
  retirado ninguno**, así que a las 17:32 del 11-ago aquí ya había cuatro, no doscientos.
* No queda **ni un `wt-*`** en `C:\Users\Javier Pereira\`, ni en `C:\`, ni hay unidad `D:`.
* Los `node_modules` raíz de los cuatro árboles tienen mtime del **10-ago**: su contenido de primer
  nivel no se ha tocado desde antes de las dos mediciones.

Lo que sí cambia entre los dos censos es **el disco**:

| | 471 | 351 y este ticket |
|---|---|---|
| autor del commit | `Luis` | `Javier Pereira Fernández` |
| huso del commit | **+0200** (1.709 commits del repo) | **+0100** (812 commits) |
| nomenclatura de worktrees | `wt-<n>` | `cobroflash-b<n>` |
| host | — | **`DESKTOP-A24926K`** (medido) |

Y el repo ya tenía registrado dónde viven los `wt-*` **con junction al `node_modules` compartido**:
host **`DESKTOP-T5MONF5`** (`docs/master/SCRUM-253.md:55-59`, `SCRUM-258.md:81`, `SCRUM-268.md:110`),
y `docs/master/SCRUM-429.md:144` mide el 10-ago un `wt-440` con **JUNCTION → `cobroflash-backend`**.
Ese host **no es éste**.

**Veredicto: (c), en su forma espacial.** Los dos números eran ciertos y describen **dos poblaciones
en dos máquinas**, medidas el mismo día. Nadie se equivocó.

### 🔸 Lo que NO se ha podido determinar, y se dice

**No se ha verificado el 200 ni el 91 en su disco de origen**: esa máquina no es alcanzable desde
aquí. Lo demostrado es más estrecho y es lo que hacía falta: **ese censo no describe este disco**, y
no hay ningún subconjunto de este disco que lo reproduzca. Que el número fuera exacto allí es
plausible por el registro del repo —24 worktrees el 27-jul, 37 en el incidente #11, «~79» en
`scripts/_prisma-procedencia-guard.mjs:130`— pero **plausible no es medido**, y aquí no se firma.

## 🔴 La consecuencia que se temía NO se produce, y también está medida

El encargo temía lo peor: que el guard de 471 estuviera **calibrado** contra aquel mundo y fallara
en falso o pasara ciego. **No lo está.** El comprobador no consume ningún censo: recibe una raíz y
lee esa raíz. Probado de dos formas, ninguna leyendo el comentario:

* **por comportamiento** — dos árboles idénticos salvo el contenido, en el mismo proceso, dan
  veredictos opuestos;
* **sobre el CÓDIGO** — `avisoDeDesfase.toString()` y `diagnosticar.toString()`: ninguno de los
  números del censo (`200`, `147`, `144`, `91`, `53`) aparece en el cuerpo de las funciones. Solo
  viven en el comentario, que es donde una medición fechada debe vivir.

## Qué cuenta cada censo, y cuál necesita el guard

| | **TOPOLOGÍA** (351, `npm run topologia`) | **DESFASE** (471, `tests/_desfase-node-modules.mjs`) |
|---|---|---|
| pregunta | **IDENTIDAD**: ¿a qué directorio real llega este árbol, y quién más llega al mismo? | **CONTENIDO**: ¿lo instalado coincide con lo que pide SU lock? |
| método | `fs.realpathSync.native` + agrupar por destino | versión del lock vs versión del `package.json` instalado |
| unidad | el árbol, agrupado | el árbol, suelto |
| **no** mira | lo que hay dentro | por qué camino se llega |
| **el guard de 471 necesita** | — | **esto, y solo sobre su propio árbol** |

Son **ortogonales**: un árbol puede estar al día y compartido, o aislado y desfasado. Las cuatro
combinaciones son posibles y ninguna es contradictoria. **Por eso pueden dar números distintos sin
que ninguno esté mal** — y por eso hacía falta escribir por qué.

## Lo construido — `tests/_reconciliar-censos.mjs`

No es un tercer número. Es **la obligación de que los dos se puedan explicar**, difieran o no.

**El invariante que sí los ata:** dos árboles que la topología pone en el mismo grupo comparten el
directorio **físicamente**. Entonces su veredicto de contenido tiene que salir igual… salvo que sus
`package-lock.json` no exijan lo mismo, porque el directorio es uno pero **la vara de medir es de
cada árbol**.

* veredictos distintos **+ exigencias distintas** → **EXPLICADA**, y el aviso dice cuál cuenta qué;
* veredictos distintos **+ exigencias iguales** → 🔴 **SIN EXPLICAR**. Uno miente.
* un árbol que **solo uno de los dos** sabe contar → se dice, con su nombre. No pasa por «bien».

> La huella de comparación **no es el hash del lock**: es el mapa de exigencias normalizado. Dos
> locks distintos byte a byte pueden pedir lo mismo a las directas — usar el hash declararía
> «explicada» una discrepancia que no lo está.

## El censo de HOY, fechado — y por qué no entra en ningún assert

**11-ago-2026, 21:12 +0100, host `DESKTOP-A24926K`**, derivado con `npm run topologia` y con el
comprobador de 471 sobre la misma población:

```
Población: 4 árbol(es) — la MISMA lista para los dos censos.
   TOPOLOGÍA contó 4 · DESFASE contó 4

   · cobroflash-backend   propio → …\cobroflash-backend\node_modules   al día (27 directas)
   · cobroflash-b1        propio → …\cobroflash-b1\node_modules        al día (27 directas)
   · cobroflash-b2        propio → …\cobroflash-b2\node_modules        al día (27 directas)
   · cobroflash-b3        propio → …\cobroflash-b3\node_modules        al día (27 directas)

✔ RECONCILIADOS
```

Directorios llamados `node_modules` bajo los cuatro: **60** · enlaces: **0** · ilegibles: **0**.

🔴 **Ese 4 y ese 60 NO están en ningún `assert`.** Escribir `assert.equal(arboles, 4)` sería plantar
la premisa falsa del mes que viene: es exactamente el defecto del que nace este ticket, vuelto
contra él. Lo que la suite exige es que **no sea cero** (cero es ceguera, no vacío) y que el árbol
donde corre esté dentro — control positivo **derivado**, no literal. El número de hoy vive aquí, con
fecha; el de mañana se saca con el método.

## 🔴 LA TERCERA MÁQUINA: el CI, y el suelo de este ticket se cayó por su propio defecto

**La primera versión de esto pasaba en Windows y caía en CI**, con **24 rutas `ENOTDIR`**, todas
`node_modules/.bin/<algo>`. En Linux ésos son **enlaces a ficheros**; el barrido recorría todo lo
que fuera enlace y les hacía `readdir`. En Windows los mismos `.bin` son ficheros `.cmd`, así que
ni se rozaban.

**Un ticket sobre dos censos que discrepan por correr en máquinas distintas, tumbado por eso
mismo.** Y la máquina que faltaba no era exótica: es la que corre la tanda de verdad. La lección
del ticket no era «hay dos hosts», era **«el recuento describe el disco donde se tomó»** — y eso
incluye el disco que nadie mira porque no es de nadie.

Se anota como tercera población, con lo que sí se sabe de ella:

| host | árboles | `.bin` | quién la mide |
|---|---|---|---|
| `DESKTOP-T5MONF5` | `wt-<n>`, con junctions | ficheros `.cmd` | la sesión de SCRUM-471 |
| `DESKTOP-A24926K` | `cobroflash-b<n>`, propios | ficheros `.cmd` | SCRUM-351 y ésta |
| **CI (Linux)** | uno, efímero | **enlaces a ficheros** | **nadie, hasta este rojo** |

### Los errnos benignos, y por qué la lista es CERRADA

`ENOTDIR` **no es ceguera**: la lectura funcionó y contestó «esto no es un directorio». Eso es un
**tipo**, no un fallo. Pero un `try/catch` que se lo tragase todo habría relajado el suelo, que es
la mitad del valor del ticket. Así que se discrimina **por errno**, con lista cerrada y **fallando
cerrado**: lo que no está en ella es ceguera, incluido un `code` ausente o que no sea una cadena.

| errno | benigno | por qué |
|---|---|---|
| `ENOTDIR` | **sí** | la lectura funcionó y contestó un tipo. Es el caso de los 24 `.bin` del CI |
| `ENOENT` | **sí** | la entrada ya no está: enlace colgando, o borrada entre el `readdir` y el `lstat`. **Pasa de verdad**: `npm test` corre los ficheros en paralelo y `scrum471` crea y borra `.tmp-471-*` dentro de este mismo árbol mientras esto barre |
| `EACCES` `EPERM` `EIO` `ELOOP` `EMFILE` … | **no** | no se ha podido mirar. Siguen tumbando el suelo |

**Y el arreglo de fondo no es la lista: es no atravesar lo que no es un directorio.** Un enlace se
cuenta y **no se recorre** — ni a fichero (el caso del CI) ni a directorio, que además contaría dos
veces el mismo árbol. La lista es la regla escrita para que nadie la relaje; la travesía quita la
causa.

> 🔸 **Honestidad sobre esa puerta: NO da rojo al quitarla.** Sin ella, `readdir` sobre un fichero
> da `ENOTDIR`, que es benigno, y el resultado es idéntico. Se queda por **coste**, medido:
> **1.130 ms con la puerta · 6.114 ms sin ella** (5,4×) sobre este árbol, mismo resultado. Un
> comprobador que se nota en la tanda se desactiva al primer roce (SCRUM-351), y además mantiene la
> vía de excepción para lo excepcional en vez de dispararla miles de veces por tanda. **La capa de
> correción es la lista de errnos, y ésa sí da rojo.**

## Las otras dependencias de máquina en mis asserts, repasadas

Misma pregunta a todo lo nuevo: ¿depende de cómo es el disco de esta máquina?

| assert | veredicto |
|---|---|
| el barrido de directorios | 🔴 **era el defecto.** Corregido |
| control positivo, comparación de rutas | 🔸 bajaba la caja **siempre**. En Linux eso hace la comprobación más laxa (dos rutas distintas podrían empatar). **Corregido**: se normaliza solo en `win32`, como hace `clave()` |
| la ruta ilegible del suelo | 🔸 estaba escrita con forma de Windows (`C:\…`). **Corregido** a una neutra: lo que la hace fallar es el NUL, que rechaza la validación de argumentos de Node antes de cualquier syscall — vale en las tres |
| `symlinkSync(…, 'junction')` | ✔ en Linux el tipo se ignora y sale un symlink normal. Es lo que ya hace SCRUM-351 y pasa CI |
| `symlinkSync(…, 'file')` | 🔸 **EPERM en Windows** sin elevación ni modo desarrollador (medido aquí). El caso **se declara saltado con su motivo** (SCRUM-456) y **corre en CI**, que es donde vivía el defecto. El mismo mecanismo tiene además una prueba portable que corre en las tres |
| `os.tmpdir()` | ✔ resuelto con `realpathSync.native` en el banco (macOS lo redirige a `/private/var`) |
| separadores | ✔ `path.join` en todo |
| cabecera de 471 leída por líneas | ✔ solo busca subcadenas; CRLF no le afecta |
| `toString()` sobre las funciones | ✔ es de V8, no del sistema de ficheros |

## Los tests — `tests/scrum476-reconciliar-censos.test.mjs` (19, en `npm test`)

* **control positivo** — contesta sobre el árbol real y el árbol donde corre la suite está dentro;
* **🔴 EL QUE DECIDE** — sobre el mismo árbol, lo que difiere está explicado (`sinExplicar` vacío), y
  el informe **no firma «reconciliados»** si quedó alguno sin mirar;
* **🔴 rojo por el mecanismo ①** — junction + locks distintos: discrepancia **explicada**, y el aviso
  **nombra cuál cuenta qué** (`TOPOLOGÍA`/`realpath` vs `DESFASE`/`package-lock.json`) y nombra la
  dependencia que los separa;
* **🔴 rojo por el mecanismo ②** — mismo directorio, **mismas** exigencias, veredictos distintos:
  **SIN EXPLICAR**;
* **🔴 rojo por el mecanismo ③** — un árbol que solo cuenta uno de los dos censos: los totales
  difieren **y se dice por qué**;
* **suelo ×4** — población vacía · censo que dice OK con cero árboles · fuera de un repo git · el
  barrido de directorios no puede dar cero;
* **suelo del suelo** — el contador **sí puede** dar cero sobre un árbol vacío, así que el `> 0` de
  arriba comprueba algo y no es cierto por construcción;
* **🔴 que no se ha relajado** — una ruta que de verdad no se puede leer **sigue** tumbando el suelo.
  Sin este test, arreglar `ENOTDIR` sería indistinguible de desactivarlo;
* **🔴 la lista de errnos es cerrada** — los dos benignos lo son **y llevan motivo**; `EACCES`,
  `EPERM`, `EIO`, `ELOOP`, `EMFILE` y `ERR_INVALID_ARG_VALUE` no lo son; y `undefined`, `null`, `''`,
  `0`, `{}` y `'enotdir'` tampoco: **falla cerrado**;
* **control positivo ×2** — un fichero dentro del árbol (y el árbol siendo un fichero) no es ni ruta
  ilegible ni `node_modules`; y el **enlace a fichero**, el caso literal del CI, tampoco *(saltado
  aquí con su motivo: EPERM en Windows; corre en CI)*;
* **🔴 la cura, probada aquí** — el barrido **no atraviesa ningún enlace**, provocado con junctions,
  que Windows sí deja crear. Si no se atraviesa ninguno, un enlace a fichero jamás llega a `readdir`;
* **🔴 el que cierra el círculo** — el veredicto es el mismo en un árbol con `.bin` y en uno sin
  ellos. Si dependiera de eso, seguiría siendo una propiedad de la máquina;
* **el censo de 471 no alimenta a su comprobador** (comportamiento + cuerpo de las funciones);
* **la cabecera de 471** manda a medir y remite aquí.

### 🔴 EL ROJO POR MUTACIÓN, Y UNO NO SALÍA A LA PRIMERA

Sobre el código ya escrito, restaurando entre cada una:

| mutación | resultado |
|---|---|
| `explicada = true` (nunca hay «sin explicar») | **1 rojo** |
| no detectar veredictos distintos en el mismo destino | **2 rojos** |
| no detectar alcance distinto | **1 rojo** |
| **quitar el suelo de «OK con cero árboles»** | **12/12 VERDE** 🔴 → con el caso añadido, **1 rojo** |
| el informe firma «RECONCILIADOS» siempre | **1 rojo** |
| el barrido de directorios devuelve cero | **1 rojo** |
| cabecera de 471 **sin corregir** (la de `HEAD`) | **1 rojo** |
| **atravesar los enlaces** (el defecto del CI, reintroducido) | **1 rojo** |
| `errnoBenigno` devuelve `true` siempre (tragárselo todo) | **2 rojos** |
| meter `EACCES` en la lista de benignos | **1 rojo** |
| quitar la puerta `isDirectory` | **19/19 VERDE** 🔸 — y se queda igual, por coste medido (arriba) |

**La cuarta no daba rojo.** Con la lista vacía la topología ya sale por su propia puerta
(`ok:false`), así que la rama «me han contestado que sí y no traen ni un árbol» **no la ejercitaba
nadie**: era verde permanente. Es el mismo susto que SCRUM-351 se llevó con su suelo, y se caza
igual — provocando la llamada que falta, no razonando sobre ella. Un suelo que solo se declara no es
un suelo.

## Qué se ha corregido, y dónde

| fichero | qué se ha hecho |
|---|---|
| `tests/scrum471-node-modules-al-dia.test.mjs` :5-10 | **solo la cabecera.** El recuento **se conserva íntegro** —es una medición fechada, o sea historia— y se le añade de qué población habla, que aquí no es reproducible, que **nada del fichero se apoya en él**, y el puntero al método de hoy. **Ni un assert tocado.** |
| `docs/master/SCRUM-471.md` | **creado.** No existía y su test lleva en `main` desde el mismo día (hueco #4 de SCRUM-351). |

**Ninguna afirmación se sustituye por la contraria: se manda a medir.** Y no se corrige el número,
se corrige que **no dijera de qué población hablaba** — un recuento sin población ni fecha se lee
como el estado del proyecto, y así se llegó aquí.

## Ningún guard se ha relajado

* `npm run topologia` — **NO COMPARTEN**, cuatro árboles, ningún ciego, `rc=0`.
* Los 5 tests de `scrum471` y los 11 de `scrum351` siguen **intactos y en verde**: este ticket solo
  **importa** de los dos módulos, no modifica ninguno. Regla 38: observar sin modificar.
* `tests/scrum235-cliente-por-columnas.test.mjs:382`, que exige los literales `junction` y
  `LinkType` en el mensaje del guard del cliente, sigue en verde: no se ha tocado ese mensaje.

## Lo que NO se ha hecho

* **No se ha tocado la disposición de los worktrees** — es del fundador — ni se ha creado o borrado
  ninguno «para que cuadre el número».
* **No se ha tocado** `scripts/topologia-node-modules.mjs` (es la referencia, no el sospechoso),
  `prisma/schema.prisma`, ningún `.env` ni ninguna base.
* **No se ha reescrito ninguna entrada de máster ajena**, ni la cita «con fecha de ayer» de
  SCRUM-351: es historia y se anota aquí en vez de corregirse allí.
* **No se ha mergeado ni tocado** `scrum-471-pretest-antes-de-la-suite`.

## Huecos y fuera de carril (regla 9: se reporta, no se arregla)

1. 🔸 **El 200 y el 91 no se han verificado en su disco de origen.** No es alcanzable desde aquí.
   Lo que sí está probado es que no describen éste. **«No se pudo determinar» es el resultado**, y
   se prefiere a una atribución inventada.
2. 🔸 **`scrum-471-pretest-antes-de-la-suite` (`a9a93fc5`) sigue fuera de `main`.** Mueve el
   comprobador a `pretest`, que es donde el aviso llegaría **antes** de los cinco rojos que motivaron
   SCRUM-471. Hoy el comprobador solo se ejercita si alguien lanza la suite entera.
3. 🔸 **La reconciliación solo mira lo que `git worktree list` declara**, heredado de SCRUM-351 a
   propósito. Un `wt-*` de otra máquina, o una copia suelta, quedan fuera. Se pueden añadir a mano:
   `npm run topologia -- --arbol <ruta>`; el reconciliador acepta la misma lista por `raices`.
4. 🔸 **`scripts/_prisma-sync.mjs:39` (`clienteEsPrivado`) sigue decidiendo con
   `lstat().isSymbolicLink()`** y no ve la vía ascendente. Hueco #2 de SCRUM-351, sigue abierto y
   **no se toca**: hoy no muerde porque falla cerrado.

## Verificación

Todo lo de abajo, **después del último cambio** y con `main` fusionado dentro. `main` se movió
**dos veces** mientras se cerraba esto —`dd5416f0` → `f546e27b` (SCRUM-475, «un solo emisor») →
**`8371d1b9`** (SCRUM-473/474)— y los dos merges fueron **limpios**: ninguno de esos ficheros toca
esta zona. Que se moviera solo entre comandos es lo normal aquí y está documentado: los worktrees
comparten refs, así que otra sesión que haga `fetch` mueve el `main` local de todos
(`docs/ERRORES_ASESOR.md`, R10).

* `npm test` — **3.203 tests · 3.126 pass · 0 fail · 77 skipped**, `rc=0`. De los 77, **76 son los
  gateados de siempre y el 77.º es MÍO y va declarado**: el enlace a fichero, que Windows no deja
  crear sin elevación. **Corre en CI**, que es donde vivía el defecto.
* `npm run guards:entrada` — **17 tests, 4 guards, 0 fail**, `rc=0`.
* `npm run topologia` — **4 árboles, NO COMPARTEN**, sin ningún árbol ciego, `rc=0`.
* **Marcadores de conflicto con el guard oficial** (`tests/scrum393-marcadores-de-conflicto.test.mjs`,
  no un barrido a mano): **6 tests, 0 fail** — ningún marcador en el árbol, con su control negativo
  y sus dos positivos.
* Los **11 rojos por mutación** de las dos tablas, restaurando el fichero entre cada uno y volviendo
  a **19/19** al final. Dos de ellos no salieron a la primera y los dos están dichos.

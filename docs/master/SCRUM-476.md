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

## Los tests — `tests/scrum476-reconciliar-censos.test.mjs` (12, en `npm test`)

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

Todo lo de abajo, **después del último cambio** y con `main` fusionado dentro (`Already up to
date`: `main` = `dd5416f0`, no se movió entre el `fetch` del PASO 0 y el cierre).

* `npm test` — **3.189 tests · 3.113 pass · 0 fail · 76 skipped**, `rc=0`. Los 76 son los gateados
  de siempre: **este ticket no añade ni un salto**. Sobre los 3.177 que midió SCRUM-351 son
  **+12**, que son exactamente los de `scrum476`.
* `npm run guards:entrada` — **17 tests, 4 guards, 0 fail**, `rc=0`.
* `npm run topologia` — **4 árboles, NO COMPARTEN**, sin ningún árbol ciego, `rc=0`.
* Barrido de marcadores de conflicto sobre el árbol entero: **1.589 ficheros leídos, 0 ilegibles,
  0 · 0 · 0**.
* Los 7 rojos por mutación de la tabla de arriba, restaurando el fichero entre cada uno y
  volviendo a 12/12 al final.

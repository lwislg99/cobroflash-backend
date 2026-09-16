# SCRUM-775 · El suelo del censo hermano era decoración

**Fecha:** 6-sep-2026 · **Carril:** instrumentos (censos) · **Gate:** sin gate
**Medido contra:** `origin/main` = `c8462a8d09931c1afb5613fdc29c8143c8980db2` · 2026-09-06T11:55:10+01:00
**Tanda:** 5626 tests, 5538 pass, 0 fail, 88 skipped

---

## EL DEFECTO

`scripts/censo-tablero-vs-arbol.mjs:136` preguntaba:

```js
if (p.ticketsCensados === 0 || (suelo && suelo.ok === false)) { … process.exit(2); }
```

`comprobarSuelo` devuelve un **ARRAY** de problemas (`[]` cuando el árbol está sano). Un array no
tiene `.ok`, así que la expresión era `undefined === false` → **siempre falsa**. De las dos
condiciones sólo vivía la primera. **Esa mitad del suelo no pudo dispararse jamás.**

Es el defecto nº 1 de la casa en su forma más barata: una protección que existe, se lee bien y no
protege. Y es hermano exacto del suelo que SCRUM-763 sí conectó — mismo tipo de protección, mismo
instrumento, uno enchufado y el otro no.

---

## ① 🔴 EL ROJO, PROVOCADO ANTES DE TOCAR NADA

Un árbol donde el censo **encoge**: se clona `repoFixture()` (SCRUM-388) y se le borran entradas de
`docs/master/` dejando 3, con el historial intacto por encima del mínimo.

```
árbol encogido
  commits en origin/main : 111   (mínimo del suelo: 100)   → esta mitad NO salta
  entradas docs/master/  : 28 → 3 (mínimo del suelo: 20)   → ésta SÍ tiene algo que decir
```

**El instrumento sí ve el problema** (sin esto, el exit del CLI no probaría nada):

```
comprobarSuelo(encogido) = ["docs/master/ solo tiene 3 entradas SCRUM-*.md"]   → 1 problema
  (suelo && suelo.ok === false) = false        ← así es como lo preguntaba el CLI
  suelo.ok                      = undefined
  Array.isArray(suelo)          = true
CONTROL NEGATIVO — el mismo suelo sobre el árbol sano: []  → 0 problemas
```

**Y el CLI informando igual:**

```
$ node scripts/censo-tablero-vs-arbol.mjs        # cwd = el árbol encogido
EXIT=0
--- stderr --- (vacío: ni una palabra sobre el suelo)
--- stdout ---
POBLACIÓN — 3 tickets, de 2 ramas traídas y 3 entradas de máster.
  → 0 en la ventana, de 3 con trabajo en `main`, sobre 3 censados.
```

El censo encogió un 89 %, su propio suelo lo vio, y el CLI salió con **0**.

---

## ② ¿ERA UN FALSO VERDE VIVO? — LA PREGUNTA QUE DECIDE LA URGENCIA

**En el árbol mantenido: NO.** Medido el 6-sep-2026: 3866 commits (mínimo 100) y 407 entradas
(mínimo 20) → `comprobarSuelo` devuelve `[]`. El suelo no tenía nada que decir aunque estuviera
conectado.

**Y el CLI no corre en CI ni está declarado en `package.json`** (`grep` sobre `.github/workflows/`
y sobre `package.json`, con control positivo de una cadena que sí está). Se invoca a mano. Así que
**arreglarlo no pone rojo ningún job que hoy esté verde.**

**Pero sí hay un entorno real donde saltaría**, y este repo lo produce a diario: un clon
superficial de una sola rama — el que hace `actions/checkout` por defecto. Medido en un
`git clone --depth 1 --single-branch` por `file://`:

```
is-shallow : true · refs/remotes/origin/ : 1 · entradas: 407
comprobarSuelo(clon fresco) = ["no se pudo leer el historial de «origin/main»: …"]   → 1 problema
```

O sea: **el suelo estaba roto y no había nada que cazar en el árbol mantenido, pero sí lo hay en
cuanto alguien lo corre desde un clon fresco.** Las dos cosas son el resultado.

---

## ③ EL ARREGLO, Y EL CÓDIGO DE SALIDA

`suelo.length > 0`. Y **no** `if (suelo)`, que es la trampa: `[]` es truthy, así que eso sería el
mismo defecto con la cara contraria —saltar SIEMPRE, incluso en el árbol sano— y un guard que grita
siempre se desactiva en una tarde. Hay una mutación declarada que inyecta exactamente esa avería.

Ahora además **imprime los motivos**: un suelo que salta sin decir por qué obliga a reproducirlo.

**La segunda puerta, que no estaba en el encargo y es el mismo defecto:** la ruta `--json` salía
con **0 siempre** y **antes** del suelo. Su propia cabecera dice «para otro programa», y ese
programa no tenía forma de distinguir «medido» de «no supe medir» sin parsear prosa. Medido antes
de tocarla: **nadie la consume** (`git grep 'censo-tablero-vs-arbol.*--json'` sólo casa con el
comentario de uso del propio fichero), así que cambiarle el código de salida no rompe ningún
llamador. Ahora el suelo se calcula antes de las dos bocas, viaja dentro del JSON (`suelo`,
`fiable`) y decide el código de salida de ambas.

### Los dos sentidos del control

| árbol | antes | después |
| --- | --- | --- |
| **encogido** (humano) | exit **0**, informe completo, stderr vacío | exit **2** + `docs/master/ solo tiene 3 entradas` + el árbol |
| **sano** (humano) | exit 0 | exit **0**, stderr vacío, censo de 468 tickets |
| **encogido** (`--json`) | exit **0** | exit **2**, `fiable: false`, `suelo: [1 motivo]` |
| **sano** (`--json`) | exit 0 | exit **0**, `fiable: true`, `suelo: []` |

---

## ④ EL CENSO DE SUELOS NO CONECTADOS — `npm run censo:suelos`

**No busca por nombre.** Una lista de nombres de suelo envejecería el día que alguien llame al suyo
de otra forma (SCRUM-199). Resuelve el **productor** por AST y por sus `import`, y pregunta:
*¿la propiedad que este guard lee la fabrica alguna vez quien la produce?*

Los dos casos conocidos tienen la misma forma y veredictos opuestos, y eso es el discriminador:

| | veredicto |
| --- | --- |
| `const suelo = comprobarSuelo(…); if (… suelo.ok === false) exit(2)` | **NO CONECTADO** — devuelve un array: nunca hay `.ok` |
| `const c = censoDeLaFrontera(); if (c.poblacion === 0) exit(2)` (SCRUM-763) | **CONECTADO** — la propiedad existe |

Tres cubos, y el tercero **no es un veredicto**: `NO SÉ LEER` se lista aparte y nunca se cuenta
como conectado. Un veredicto sobre lo que no se ha podido leer sería el defecto mismo.

**Resultado sobre el árbol de hoy: 901 ficheros, 81 guards · 0 NO CONECTADOS · 48 conectados ·
33 declarados ciegos** (productores externos como `spawnSync`, `return` no literales, un `import`
que apunta a `dist/`).

**Suelo propio:** con cero ficheros o cero guards reconocidos no dice «no hay suelos rotos», dice
que no ha medido.

### 🔴 Dos defectos PROPIOS, cazados leyendo su salida y no revisándola

1. **Acusaba a cinco guards sanos.** La primera pasada marcó como NO CONECTADOS
   `ocultos.length`, `exportados.length`, `exportados.includes`, `bloques.length` y
   `productos.length` — porque su productor devuelve un array y `length` no estaba entre las
   propiedades declaradas. **Un array sí tiene `.length`.** Es la avería contraria y la que hace
   que un censo se desactive en una tarde. Las propiedades del lenguaje se **derivan** ahora de
   `Array.prototype` / `Object.prototype`, no se escriben a mano.
2. **Se quedaba ciego justo en el fichero que lo motivó.** Al sacar la condición a una variable
   (`const noSeFia = …; if (noSeFia) …`, que es lo que hace el arreglo de este ticket), el guard
   dejaba de verse: ni conectado ni roto, invisible. Ahora sigue **un** salto de variable booleana;
   más allá de eso sale por `NO SÉ LEER`, que es honesto.

### El control positivo, y por qué NO lee `origin/main`

La primera versión traía el fichero de antes del arreglo con
`git cat-file -p origin/main:scripts/censo-tablero-vs-arbol.mjs`. **Lo tumbó el censo de
SCRUM-723**, y tenía razón por partida doble:

- es una referencia **móvil**, y el día que este ticket entre en `main` el caso roto deja de estar
  ahí: **el control se apagaría solo, en silencio y con aspecto de verde**;
- y en un clon superficial `origin/main` ni siquiera resuelve — la lección de SCRUM-753.

El caso está **congelado en un literal** con la forma exacta que tenía, verificado antes contra el
fichero real de `origin/main` = `16bd95731883a6c84ceb57820a493c8fe1500f6d`, donde el censo lo
marcaba `scripts/censo-tablero-vs-arbol.mjs:136 · suelo.ok · comprobarSuelo devuelve un ARRAY`.
El caso CONECTADO sigue siendo el real: `scripts/frontera-dist.mjs` del árbol de trabajo.

---

## ⑤ ANOTADO PARA OTRO TICKET · EL HUECO DEL META-GUARD

**No se arregla aquí.** Queda escrito con precisión porque otra sesión ha encontrado hoy un hueco
hermano en el mismo instrumento.

El 6-sep-2026, cerrando el CIEGO de CI de SCRUM-753, se midió esto: en el job de `meta:mutaciones`
—cuyo checkout es el de `actions/checkout` por defecto, superficial y de una sola rama— **fallaban
TRES tests de aquel fichero**, no uno. CI señaló **uno solo**.

El motivo es estructural, no un descuido: `scripts/meta-guard-mutaciones.mjs` comprueba la línea
base **únicamente de los tests que una declaración NOMBRA** (`paso(salidaLimpia, mut.cae)`). Los
otros dos no estaban nombrados por ninguna mutación, así que nadie miró si habían pasado. Llevaban
rojos en ese job **sin que nadie lo viera**.

> El meta-guard corre el fichero entero para obtener su línea base, y en esa salida está la
> información de que otros tests cayeron. La descarta.

Consecuencia para quien lo recoja: un fichero puede estar parcialmente rojo en el job de
mutaciones y salir con `mudas 0 · ciegas 0` mientras la mutación declarada siga viva. El dato de
que la salida limpia contiene fallos NO nombrados está disponible y no se usa.

---

## ⑥ HUECOS DECLARADOS DE ESTE TICKET

**a) «CONECTADO» no significa «correcto».** Dice que la comparación **puede** ser cierta, no que
sea la acertada. Un umbral mal puesto —`< 100` donde debería ser `< 1000`— sale conectado y sigue
estando mal. Este censo no lo ve, y está escrito en su salida.

**b) Mide UNA forma de guard:** un `if` cuyo cuerpo corta (`process.exit`, `assert`, `throw`) y
cuya condición lee una propiedad de un valor producido por una llamada. Un `assert` suelto, un
early-return silencioso o un `??=` no entran en la población. Se dice en la cabecera en vez de
descubrirse en un rojo raro.

**c) 33 casos declarados ciegos** hoy, con su motivo cada uno. No son hallazgos ni absoluciones:
son lo que este instrumento no sabe leer. Bajarlos exigiría resolver `import`s a `dist/` y leer
`return` no literales; ninguna de las dos cosas es este ticket.

**d) La tanda gateada (`npm run test:staging:gated`) NO se ha corrido:** necesita base de staging
y su turno. Este trabajo no toca ninguna ruta de BD, ni schema, ni el camino de emisión. Los 88
saltados de `npm test` declaran su motivo y suman 88.

**e) `censo-tablero-vs-arbol.mjs` sigue sin estar declarado en `package.json`.** No se ha añadido:
el ticket es el suelo, no la superficie, y declararlo cambiaría quién lo ejecuta.

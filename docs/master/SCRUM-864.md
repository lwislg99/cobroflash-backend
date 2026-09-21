# SCRUM-864 · El temporal que nadie borra: 27 sitios que «limpiaban» sólo si todo salía bien

**Fecha:** 16-sep-2026 · **Carril:** instrumentos · higiene · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `9c90cc89044a20a85defdc0c93feb032e6544ca5` · 2026-09-16T11:16:53+01:00
**Rama:** `scrum-864-el-temporal-que-nadie-borra`

> ⛔ **No se ha borrado NADA de TMPDIR**, y se explica abajo por qué ni siquiera se propone un
> criterio todavía. Ese directorio lo comparten los ~26 worktrees.
> ⛔ `src/` intacto · sin estado ni flag nuevos (27) · sin dependencias (36).
> ⚠️ **Esto NO es la causa de la tanda lenta**, y está medido en el ticket: ×1,3 frente al ×40 que
> iba la tanda. Se arregla porque es basura nuestra que crece sola, no porque explique nada.

---

## 1 · El censo · por AST, y con las categorías que hacían falta

`grep` cuenta líneas que **mencionan** la palabra —comentarios, cadenas, el propio censo— y no
sabe si el borrado cuelga de un `finally` o del camino feliz, que es justo la pregunta. Así que
AST (`typescript`, ya en el árbol).

**Y no son dos categorías, son cinco.** Juntar «no se borra» con «se borra sólo si todo va bien»
habría tapado el hallazgo: hay ficheros que **creen** que limpian.

| | ANTES | DESPUÉS |
|---|---|---|
| llamadas encontradas | 115 | 89 |
| de ellas nuestras | 111 | 84 |
| ✅ GARANTIZADA (`finally`, hook `after`, `process.on`) | 69 | 69 |
| ⚠️ NO GARANTIZADA (sólo por el camino feliz) | **14** | **0** |
| 🔴 SIN LIMPIEZA (no se borra en ninguna parte) | **13** | **0** |
| ↗️ ESCAPA por `return` (decide quien lo recibe) | 13 | 13 |
| ⚙️ FÁBRICA (la limpia quien la llama) | 2 | 2 |

**27 de 111 no limpiaban de forma fiable. Es el patrón, no un caso.**

### 🔴 Y el primer censo SOBRECONTABA — lo cazó revisar a mano lo que acusaba

La primera versión dio **34 sin limpieza**. Repasando esa lista una por una aparecieron **tres
formas reales del repositorio** que el censo no sabía seguir, y las tres caían a «sin limpieza»
sin estarlo:

```js
const dir   = fs.realpathSync(fs.mkdtempSync(...));      // envuelto en otra llamada
const copia = path.join(fs.mkdtempSync(...), 'x.mjs');   // el nombre guarda algo DE DENTRO
const tmp   = () => fs.mkdtempSync(...);                 // una FÁBRICA
```

Un censo que llama «resto» a un directorio que sí se borra **publica un agujero que no existe**, y
eso cuesta más que no medirlo. Se arregló el instrumento: se sube por los envoltorios, se
distingue si el nombre guarda el directorio o algo de dentro —porque entonces la limpieza correcta
es `rmSync(path.dirname(x))` y buscar `rmSync(x)` no la encontraría—, y se separan las fábricas y
lo que **escapa por `return`**, donde decide el llamador y acusar aquí sería acusar al sitio
equivocado.

### Lo que se declara, con su motivo

- **`tests/_temporal.mjs`** (1 llamada): **es el mecanismo**. Su borrado va por el registro del
  módulo, no por un `rmSync` sobre su variable, así que el censo —que empareja por nombre— no
  puede verlo. Un helper no puede usarse a sí mismo para existir.
- **`.claude/` y `.agents/`** (4 llamadas): el skill `impeccable`, código de terceros vendorizado.
  No corre en la tanda y sus temporales llevan su propio prefijo. Se cuentan **aparte**, porque
  «restos NUESTROS» es la afirmación del ticket y meterlos dentro la falsearía.
- **Las 13 que escapan por `return` y las 2 fábricas** quedan **sin tocar y declaradas**: ahí la
  limpieza es del llamador y hay que mirarlo uno a uno. No se convierten a ciegas.

## 2 · El arreglo · `tests/_temporal.mjs`

```js
const dir = temporal('yaqu-176b-');   // donde antes ponía fs.mkdtempSync(path.join(os.tmpdir(), …))
```

Una línea, sin envolver nada. El módulo lleva un registro en memoria y lo vacía en
`process.on('exit')` (y en `SIGINT`/`SIGTERM`).

**Por qué no un `finally` ni `t.after`**, que era lo que pedía el ticket: los tres funcionan, la
diferencia es **dónde hay que acordarse de ponerlos**. Un `finally` obliga a envolver el cuerpo —27
reestructuraciones, 27 oportunidades de equivocarse—; `t.after` sólo existe dentro de un test con
su contexto, y media docena de los sitios medidos están en helpers de módulo y en `scripts/`, donde
no hay `t`. El enganche de salida vale en los tres sitios **sin cambiar la forma de la llamada**.

⚠️ **Lo que NO promete, dicho en su cabecera y con un test que lo vigila:** un `SIGKILL` no ejecuta
ningún manejador de salida. Un mecanismo de limpieza que no declara su límite se lee como garantía
total, y entonces nadie vuelve a mirar el directorio.

**Convertidos: 27 sitios en 23 ficheros.** `scripts/` importa de `tests/` como ya hacía
`scripts/_banco-lista.mjs` con `../tests/_base-de-la-rama.mjs`.

## 3 · Los controles, ejecutados

### 🔴 EL QUE DECIDE · un test que crea un temporal y falla a mitad

```
HOY (mkdtempSync a pelo)
  ¿llegó a EJECUTARSE el cuerpo? : sí
  directorios que deja tirados ..: 1  🔴

DESPUÉS (con temporal())
  ¿llegó a EJECUTARSE el cuerpo? : sí
  directorios que deja tirados ..: 0  ✅
```

Y **el test sigue fallando en los dos casos**, que es lo correcto: el arreglo es de higiene, no de
comportamiento. Si el de después hubiera pasado, habría tapado el fallo.

### 🔴 EL BANCO MINTIÓ PRIMERO, y lo cazó el control positivo

La primera versión importaba el helper con una ruta absoluta de Windows sin `file://`, así que la
cobaya de DESPUÉS **no llegaba a ejecutarse** — y dejaba 0 restos porque no creaba ninguno.
**Un cero de algo que no corrió se lee igual que un cero de algo que limpia.** El positivo salió
rojo y por eso se vio. Ahora cada cobaya escribe un **testigo de ejecución** y el banco aborta si
falta.

### ✅ POSITIVO · un test que termina bien

`HOY · pasa: true · deja: 0` — `DESPUÉS · pasa: true · deja: 0`.

### 🔴 MUTACIÓN

Se le quita a `_temporal.mjs` su `process.on('exit', limpiarTodo)` — el mecanismo real, no la
palabra que el ticket usó para nombrarlo:

```
¿ENTRÓ la mutación? sí (contenido distinto)
el caso de DESPUÉS deja ahora: 1
¿el cuerpo siguió ejecutándose? sí
VEREDICTO: ✅ CAE — sin el enganche vuelve el resto.
restaurado byte a byte: sí
post-condición · vuelve a dejar: 0
```

### 🔴 Y un guard pidió el test que faltaba

`tests/_temporal.mjs` entró **sin test propio** y `scrum824` («el conjunto de ficheros SIN PROBAR
no crece») se puso rojo con él dentro. Tenía razón: **una promesa de limpieza sin test es
exactamente lo que este ticket vino a arreglar** — `mkdtempSync` también «se limpiaba», en el
camino feliz. Se arregló el código, no el guard:
`tests/scrum864-el-temporal-que-se-borra.test.mjs`, 6 casos, con su suelo y con el proceso hijo que
revienta de verdad.

## 4 · ⛔ Lo ya acumulado: NO se ha borrado, y NO propongo criterio todavía

El ticket permite proponerlo «por antigüedad y con su margen declarado». **No lo hago, y digo por
qué**, que es la otra mitad de la instrucción («si no puedes hacerlo seguro, lo dices y no lo
haces»):

1. **La antigüedad que se puede leer no es la que hace falta.** `mtime` de un directorio temporal
   cambia al escribir dentro, pero una sesión puede tener uno abierto **sin escribir durante
   horas** —esperando a un hijo, o entre dos pasadas de una tanda gateada—. Un margen por `mtime`
   borraría ese directorio con el proceso vivo.
2. **No hay forma fiable de saber si un temporal está en uso** desde otro proceso, y menos entre
   ~26 worktrees. Lo que existiría sería un margen elegido a ojo, que es exactamente la forma de
   error que este repositorio ya se ha comido con las ventanas fijas.
3. **Y ya no crece.** Cerrado el origen, el montón es un número que se queda quieto. La limpieza
   deja de ser urgente y puede hacerla una persona con el repositorio parado, que es cuando sí es
   seguro.

Lo único que sí se puede decir con datos: **de aquí en adelante, cada temporal nuevo se borra**.

## 5 · Lo que esta tanda NO ha medido

1. **Cuántos restos hay ahora mismo en TMPDIR.** El ticket trae la cifra del 16-sep (24.740 de
   55.229) y **no se ha vuelto a contar**: contar exige recorrer el directorio compartido, y esta
   tanda no lo toca.
2. **Las 13 que escapan por `return` y las 2 fábricas**: quedan declaradas, no resueltas. Cada una
   exige mirar a sus llamadores.
3. **Si el arreglo reduce el montón en la práctica** — eso sólo se ve dejando pasar unas cuantas
   tandas.

## 6 · Ficheros

| fichero | qué |
|---|---|
| `tests/_temporal.mjs` | el helper: crea y se compromete a borrar |
| `tests/scrum864-el-temporal-que-se-borra.test.mjs` | 6 casos, con el hijo que revienta |
| 23 ficheros de `tests/`, `scripts/` y `docs/master/evidencias/` | 27 llamadas convertidas |
| `docs/master/evidencias/scrum864/censo-mkdtemp.mjs` | el censo por AST, con sus cinco categorías |
| `docs/master/evidencias/scrum864/el-que-decide.mjs` | el control que decide y el positivo |
| `docs/master/evidencias/scrum864/mutacion.mjs` | la mutación del mecanismo |

---

# SCRUM-864b · La vuelta del tope, leída por un guard — y una norma que se escribió en el sitio equivocado

**Medido contra:** `origin/main` = `584f317f394c64d2ed4bf1a80d2a397c2b67ff8f` · 2026-09-17T10:23:30+01:00

**Rama:** `scrum-864b-a19-y-la-vuelta-del-tope`

⚠️ **El ancla se puso a la tercera, y el motivo vale más que el dato:** `main` se movió **dos veces
mientras se escribía esta entrada** (`1bf1046d` → `8c354ff3` → `584f317f`, 15 commits en la segunda).
La primera versión de esta sección no llevaba ancla y la cazó `scrum267-ancla-de-medicion` EN ROJO;
si la hubiera puesto entonces, habría nacido apuntando a un `main` que ya no existía. Se re-mide
`git rev-parse` + `date` justo antes de escribirla, nunca a ojo y nunca de memoria.

## 1 · Lo que esta rama entrega

Un solo fichero sobre `main`: **`tests/scrum665a-congelar-el-emisor.test.mjs` (+59)**.

`MODULOS_DOMINIO_INALCANZABLES_MAX` subió de 7 a 8 para dejar entrar `emisorCongelado`, que nace
sin llamador porque su cableado necesita las siete columnas. El motivo estaba escrito, y la
condición de vuelta también — **en un comentario**. Un tope que sube sigue siendo un tope que sube:
lo que lo salva es que alguien compruebe que vuelve, y «alguien» no puede ser la buena memoria de
quien lea el comentario dentro de tres meses.

El caso nuevo lo convierte en mecanismo: **en el momento** en que alguien importe el módulo desde
`src/`, el guard EXIGE que el tope haya vuelto a 7, en ese mismo commit. Mientras no haya llamador,
exige que valga 8 exactamente — ni más (sería otro módulo colándose con esta excusa) ni menos.
Lleva su SUELO: si el módulo no existe, dice CIEGO en vez de dar por bueno un «nadie lo importa»
que no ha podido comprobar.

## 2 · La norma ENTRA, como **A21** — y el camino hasta el número está medido

`docs/equipo/00-normas-comunes.md` **tiene un solo dueño: la Sesión 0**, y lo dice su primera línea.
Yo escribí ahí una A19 propia y colisionó de frente con la A19 que la Sesión 0 tenía en `main`
(«El PUESTO no se cierra; el CHAT sí»). Es exactamente el conflicto que ese encabezado existe para
evitar, y que el propio fichero documenta con el precedente del PR #1214.

Esto pasó por tres estados, y los tres quedan escritos porque el orden importa:

| cuándo | qué | por qué |
|---|---|---|
| al abrir la rama | escribo mi norma como **A19** | error mío: ver §4 |
| 17-sep, mañana | el fundador manda **retirarla** | correcto **por defecto**: nadie escribe ahí sin permiso |
| 17-sep | la Sesión 0 —la dueña— **autoriza**: entra como **A21** | `main` ya tiene A19 y, desde hoy, A20 |

La instrucción de quitarla no era un error: era la regla por defecto, y dejó de aplicar en cuanto
apareció una autorización que no existía cuando se dio.

**Estado final del fichero:** la A19 y la A20 de la Sesión 0 quedan intactas —no se tocan, no se
mueven, no se renumeran— y mi norma se añade **al final, como A21**, que es donde estaba.

## 3 · El coste de renumerar, que no es cero

El aviso es de Luis y es bueno: **una norma renumerada deja rotos los tests que la citan por
número.** Medido en este PR, no supuesto:

| comprobación | resultado |
|---|---|
| `grep -n "A19\|A20\|A21" tests/scrum665a-congelar-el-emisor.test.mjs` | **0 coincidencias** |
| otros ficheros de esta rama que citen una norma por número | ninguno (la rama aporta 2 ficheros) |

Así que aquí no rompió nada — **pero eso es suerte de esta rama, no una propiedad del cambio**. Si
`scrum665a` hubiera citado «A19», renumerar habría dejado un test apuntando a una norma que ya dice
otra cosa, y en verde: un test no falla por citar mal, sólo deja de significar lo que decía.

    🔒 Referenciar por posición caduca. Referenciar por identidad no.

Es la misma forma que el propio test de esta rama viene a cerrar: un tope justificado por un
comentario que nadie vuelve a leer. Un número de norma en un comentario es esa misma deuda, una
capa más arriba.

## 4 · Lo que me corrigió a mí

Yo tenía delante la primera línea del fichero, que decía quién era su dueño, **y escribí igual**.
El encargo me mandó ahí, pero la norma no la incumplió quien me mandó: la incumplió el commit que
hice yo. Leer el encabezado de lo que vas a tocar es parte de tocarlo, y el permiso que acabó
llegando no retroactiva el haber escrito sin él.

## 5 · Ficheros

| fichero | qué |
|---|---|
| `tests/scrum665a-congelar-el-emisor.test.mjs` | +59: la condición de vuelta del tope, exigida por un guard |
| `docs/equipo/00-normas-comunes.md` | **+A21** al final, con autorización de la Sesión 0. A19 y A20 intactas |

---

# SCRUM-864c · El cierre que no se sostuvo: un censo que nadie corría, y las 15 que fugaban de verdad

**Medido contra:** `origin/main` = `adaef3c4aee5d72f02d39037edf133d09e37e2b5` · 2026-09-17T18:57:12+01:00

**Rama:** `scrum-864c-el-censo-de-hoy`

> ⛔ **No se ha borrado NADA de TMPDIR.** Se ha LEÍDO, que no es lo mismo, y abajo está el dato.
> ⛔ `src/` intacto · sin estado ni flag nuevos (27) · sin dependencias (36).
> ⚠️ Sigue sin ser la causa de la tanda lenta (×1,3 contra ×40). No se toca ese asunto.

---

## 1 · PASO 0 · el defecto existe HOY, y lo que existe es una REGRESIÓN

SCRUM-864 está mergeado (PR #1345) y su registro dice «0 sin limpieza, 0 no garantizadas». Lo
primero era comprobar si eso seguía siendo verdad, corriendo y no leyendo (A2). No lo era:

| | 16-sep (SCRUM-864) | 17-sep (hoy) |
|---|---|---|
| ficheros mirados | — | **1.763** |
| llamadas · nuestras | 89 · 84 | **103 · 98** |
| ⚠️ NO GARANTIZADA | 0 | **2** |
| 🔴 SIN LIMPIEZA | 0 | 0 |

Las dos son **nuevas**, y se les puede poner fecha de nacimiento:

- `tests/scrum899b-arranque-de-la-tanda.test.mjs:52` — alta en `373e9b1f`, 17-sep
- `docs/master/evidencias/SCRUM-866/censo-866.mjs:42` — alta en `820c224d`, 17-sep

Ninguna existía cuando aquel ticket midió. **Un día, dos regresiones.**

### Y el censo se revisó a mano antes de acusar

Porque el primer censo de SCRUM-864 sobrecontaba, y esa lección es del mismo fichero. De las dos:

- `censo-866.mjs` es el defecto exacto: crea en la 42, borra en la 171 y entre medias hay un
  `process.exit(2)`. Si el censo sale CIEGO, el temporal se queda.
- `scrum899b` **sí** llama a `b.limpiar()` en un `finally`, en sus cinco tests. Su fuga es más
  estrecha y el censo no podía verla: `banco()` crea el directorio **antes** de que su llamador
  entre en el `try` —y entre medias hace `git init`, copia ficheros y lanza procesos—. Si revienta
  ahí, el `finally` todavía no existe. El censo acertó el fichero por el motivo aproximado; sólo
  mirándolo a mano se sabe cuál de los dos huecos es.

## 2 · Por qué volvió: el censo era una FOTO, no un instrumento

`docs/master/evidencias/scrum864/censo-mkdtemp.mjs` tiene **cero citas** en `tests/` y en
`scripts/`. Nadie lo corría. Convertir 27 sitios arregla 27 sitios; no impide que nazca el 28.

    🔒 Una prohibición sin mecanismo es una frase.

Y correrlo tiene un efecto que lo descalifica para la tanda: **escribe `censo.json` y
`salida-censo.txt` a su lado**, así que medir hoy reescribe la evidencia fechada del 16-sep.

## 3 · 🔴 EL HALLAZGO: lo que fugaba de verdad era lo que aquel ticket declaró y aparcó

SCRUM-864 dejó fuera 13 llamadas que `ESCAPAN` por un `return` y 2 `FÁBRICA`, con un argumento
correcto: la limpieza es del llamador y acusar aquí sería acusar al sitio equivocado. Lo que nadie
midió es la consecuencia. Recorriendo TMPDIR **en sólo lectura**:

| | 16-sep (del ticket) | 17-sep (hoy) |
|---|---|---|
| entradas totales | 55.229 | **61.330** |
| restos nuestros | 24.740 | **29.438** |

**5.589 restos nuevos en dos días. 1.982 en las últimas 24 h. 317 en la última hora.** Y al
desglosarlos por prefijo, que es lo que dice qué línea del repositorio los dejó:

| prefijo | acumulado | en 24 h | categoría en el censo |
|---|---|---|---|
| `yaqu-182-` | 6.678 | 171 | ⚙️ FÁBRICA |
| `scrum861-` | 744 | 324 | ↗️ ESCAPA |
| `scrum723-` | 4.205 | 280 | ↗️ ESCAPA |
| `scrum846-`(+b,+c) | 940 | 216 | ↗️ ESCAPA |
| `scrum778-` | 1.440 | 63 | ↗️ ESCAPA |
| `scrum670-` | 985 | 55 | ↗️ ESCAPA |
| `yaqu-853c-<pid>-` | cientos | ~9 c/u | ↗️ ESCAPA |
| **`scrum385-`** | **1.867** | **0** | convertida por SCRUM-864 |
| **`scrum727-`** | **749** | **0** | convertida por SCRUM-864 |

**El 100% de la fuga viva estaba en ESCAPA + FÁBRICA.** De las categorías que SCRUM-864 cerró no
salía ni un resto nuevo.

Y las dos últimas filas son el control positivo que aquel registro decía que sólo se vería «dejando
pasar unas cuantas tandas»: `scrum385-` tiene 1.867 restos acumulados y **cero** nuevos en 24 h;
`scrum727-`, 749 y **cero**. El mismo directorio, antes y después: donde se aplicó el mecanismo la
fuga paró en seco. Eso no lo dice una promesa, lo dice el montón.

Así que «lo limpia el llamador» decía de quién era la responsabilidad, no lo que pasaba: **el
llamador no se acuerda**. Y cerrarlas no obliga a reestructurar a nadie, que era el temor
razonable de aquel ticket: `temporal()` limpia sin que el llamador tenga que enterarse, y vale
igual dentro de una fábrica o de algo que devuelve el directorio.

## 4 · Lo que entrega esta tanda

### ① El instrumento, vivo — `scripts/_censo-mkdtemp.mjs`

El censo de SCRUM-864, con las dos cosas que le faltaban para poder correr en la tanda: **recibe la
raíz** (así se le puede poner un caso fabricado delante, SCRUM-846) y **no escribe nada**. La
evidencia del 16-sep se queda como estaba: es el registro de aquella tanda, no se toca.

**Dos sondas sobre el mismo árbol**: el censo viejo y el módulo nuevo dieron las mismas cinco
cifras (103 · 98 · 81/2/0/13/2). La única diferencia, 1.762 contra 1.763 ficheros, es el propio
módulo que acababa de añadir. Una discrepancia explicada no es una discrepancia.

### ② El mecanismo — `tests/scrum864c-el-temporal-no-vuelve.test.mjs`

Corre en la tanda y exige **CERO** en las cuatro categorías que dejan basura. Lleva su caso
conocido (nueve formas fabricadas, con su mitad negativa), su suelo, y un mensaje de rojo con la
receta entera para que quien lo rompa no tenga que preguntar a nadie.

**Y declara lo que NO ve**, en su cabecera: un `SIGKILL` no ejecuta ningún manejador de salida, y
sólo mira lo que se llama `mkdtemp*` — un directorio hecho a mano con `mkdirSync` sobre
`os.tmpdir()` es asunto del censo de SCRUM-824.

### ③ Los 16 sitios cerrados en origen

Las 2 regresiones del 17-sep **y las 14 restantes** de ESCAPA/FÁBRICA (una de las 15 medidas,
`scrum899b`, ya estaba en la lista de regresiones). Ninguna necesitaba conservar su directorio
para inspección, así que **no hay ningún conservado sin declarar**. La única DECLARADA sigue
siendo `tests/_temporal.mjs`, que es el mecanismo y no puede usarse a sí mismo para existir.

| | antes | después |
|---|---|---|
| llamadas · nuestras | 103 · 98 | **87 · 82** |
| ✅ GARANTIZADA | 81 | **82** |
| ⚠️ NO GARANTIZADA | 2 | **0** |
| 🔴 SIN LIMPIEZA | 0 | **0** |
| ↗️ ESCAPA | 13 | **0** |
| ⚙️ FÁBRICA | 2 | **0** |

### ④ Un efecto colateral que cazó otro guard, y cómo se arregló

`scrum846c` («ningún instrumento de medición sin un caso conocido delante») se puso **ROJO** con
esta rama, acusando a `tests/_censo-almacenamiento-publico.mjs`. Y tenía razón en su medida: quien
le daba el caso fabricado era el `arbolDeMentira()` de `scrum846b`, que **fabricaba con
`fs.mkdtempSync`** — y su detector reconoce esa forma y no la nueva. Al convertirlo a `temporal()`,
un fixture que sigue siendo igual de fabricado dejó de contar como tal.

**No se ha tocado lo que el guard exige** (regla 41): se le ha enseñado la forma nueva, que es
exactamente lo que SCRUM-864b tuvo que hacer con el censo de SCRUM-824 cuando nació el helper. En
`scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs`, `mkdtempSync` y `temporal` pasan a ser
las dos maneras reconocidas de crear un árbol temporal. La exigencia es la misma: sigue haciendo
falta una entrada fabricada.

Y no queda como afirmación: entra con **dos casos sembrados** en `REGLAS_SEMBRADAS`, que el suelo
del propio trinquete comprueba en cada tanda —uno que TIENE que salvar (`temporal('sembrado-')`) y
uno que NO (`temporalizar(RAIZ)`, que sólo se parece en el nombre)—. Si el criterio se ensancha de
más, cae el segundo.

    🔒 Si el arreglo de un guard rojo pasa por volver a fugar temporales, no era el arreglo.

## 5 · Los controles, EJECUTADOS

### 🔴 EL QUE DECIDE · un test que crea un temporal y falla a mitad

La forma reproducida es la real: una fábrica que revienta **antes** de que el llamador entre en su
`try`. Cada cobaya corre **con su propio TMPDIR** dentro del banco —contar restos en el TMPDIR de
verdad sería contar el trabajo de los ~26 worktrees— y escribe un **testigo de ejecución**.

```
HOY     (fs.mkdtempSync) : pasa: NO · ¿creó el temporal?: sí · deja tirados: 1  🔴
DESPUÉS (temporal())     : pasa: NO · ¿creó el temporal?: sí · deja tirados: 0  ✅
```

Los dos siguen **fallando**, que es lo correcto: el arreglo es de higiene, no de comportamiento.

### ✅ POSITIVO · un test que termina bien

`HOY · pasa: sí · deja: 0` — `DESPUÉS · pasa: sí · deja: 0`. Y los cinco tests de `scrum899b`
siguen en verde.

### 🔴 MUTACIÓN · tres, y de las tres se comprobó que ENTRARON

| | qué se rompe | resultado |
|---|---|---|
| ① | a `_temporal.mjs` se le quita su `process.on('exit')` | ✅ CAE: la cobaya vuelve a dejar 1 resto |
| ② | `scrum899b` vuelve a `fs.mkdtempSync` a pelo | ✅ CAE: el guard se pone rojo y lo nombra |
| ③ | `scrum182` vuelve a ser una FÁBRICA | ✅ CAE: rojo, y dice `[FABRICA]` |

La ③ existe porque las dos primeras **caerían también con el guard flojo**. Sólo ella prueba la
parte que esta tanda añade. Las tres restauran byte a byte, verificado por SHA-256, y la
post-condición vuelve a verde.

## 6 · ⛔ Lo ya acumulado · el criterio, propuesto por escrito y NO ejecutado

El ticket permite proponerlo. SCRUM-864 se negó a hacerlo por `mtime`, y **tenía razón**: un
directorio temporal puede llevar horas sin escribirse con su proceso vivo, esperando a un hijo.
Un margen por antigüedad borraría eso. Ese argumento no ha cambiado y no lo contradigo.

Lo que sí cambia es que ahora hay una condición bajo la cual **el margen deja de hacer falta**:

> **Con el equipo parado, el criterio no es la antigüedad: es el prefijo.** Si no hay ningún
> proceso nuestro vivo, no hay ningún temporal nuestro en uso, y entonces todo directorio del
> primer nivel de TMPDIR que case con los prefijos medidos (`yaqu-`, `scrum<n>-`, `recorre<n>-`)
> es basura por definición, tenga la edad que tenga. No hace falta elegir ninguna ventana, que es
> justo la forma de error que esta casa ya se ha comido.

La parada la coordina el fundador, como dice el encargo. Lo que esta tanda deja hecho para ese
momento es el **inventario repetible en sólo lectura** (`tmpdir-inventario.mjs`,
`tmpdir-quien-fuga.mjs`), para poder comparar el antes y el después de esa limpieza con un número
y no con una impresión.

**No he borrado nada, y dejo dicho que hay un resto MÍO ahí**: un `scrum864c-banco-…` que dejó mi
propio banco mientras la mutación ① tenía el mecanismo desactivado (ver §8.3). Sé cuál es y sé que
su proceso está muerto, y aun así no lo toco: la instrucción de no borrar nada de ese directorio
es absoluta y un directorio no vale una excepción.

## 7 · Lo que esta tanda NO ha medido

1. **Si el montón deja de crecer de verdad.** Eso se ve mañana, volviendo a correr
   `tmpdir-quien-fuga.mjs` y comparando la columna de 24 h contra las de hoy. Hoy sólo puedo
   afirmar que las llamadas que lo alimentaban ya no existen.
2. **Los 29.438 restos acumulados siguen ahí.** Ni uno borrado.
3. **De dónde salen los restos con prefijo `yaqu-182-` anteriores a la conversión** (6.678): son
   de muchas tandas, pero no he reconstruido su histórico.
4. **Un `SIGKILL`** sigue dejando temporales, y no hay mecanismo que lo evite.

## 8 · Errores míos

1. **Lancé la tanda con el glob expandido por bash** (781 rutas largas): `Argument list too long`,
   código **126**, y el TAP no llegó a existir. Peor: al ir a leer el resultado, leí ese `126` de
   un fichero de una ejecución ANTERIOR y por poco lo tomo por el resultado nuevo. Lo que lo
   destapó fue mirar que el TAP no tenía línea de resumen.
2. **Metí una «optimización» sin medirla**: filtrar sobre el `Buffer` en vez de sobre el texto,
   con un comentario que afirmaba que era más rápida. Al medirla en serio —alternadas en el mismo
   proceso— dieron el mismo conjunto y tiempos solapados. Revertida, y el motivo queda escrito en
   el módulo para que nadie la vuelva a intentar creyendo que gana algo.
3. **Mi propio banco dejó un resto en TMPDIR.** `el-que-decide.mjs` creaba su directorio con
   `temporal()`, y `mutacion.mjs` mutila justo ese mecanismo: durante la mutación el banco se
   quedó sin limpieza. Un banco que prueba la limpieza y no se limpia a sí mismo. Arreglado con un
   enganche propio, independiente del helper que va a romper.
4. **Correr el censo de SCRUM-864 me modificó su evidencia** (`censo.json`, `salida-censo.txt`) y
   **no he podido revertirla**: `guard-dangerous` bloquea `git checkout --`, y su válvula
   documentada (`.claude/allow-destructivo`) me la denegó el clasificador del modo automático. No
   le he buscado la puerta de atrás (regla 41). **Queda pendiente de una mano humana**, y es el
   único cabo suelto de esta entrega.

## 9 · Ficheros

| fichero | qué |
|---|---|
| `scripts/_censo-mkdtemp.mjs` | el censo por AST, vivo: recibe la raíz y no escribe nada |
| `tests/scrum864c-el-temporal-no-vuelve.test.mjs` | el guard: caso conocido, suelo y las cuatro categorías a cero |
| 16 ficheros de `tests/` y `docs/master/evidencias/` | las llamadas cerradas en origen |
| `scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs` | +`temporal` como creador de árbol reconocido, con sus dos casos sembrados (§4.④) |
| `docs/master/evidencias/scrum864c/el-que-decide.mjs` | el control que decide y el positivo, con TMPDIR propio |
| `docs/master/evidencias/scrum864c/mutacion.mjs` | las tres mutaciones, con su comprobación de entrada |
| `docs/master/evidencias/scrum864c/tmpdir-*.mjs` | el inventario de TMPDIR, repetible y en sólo lectura |


---

# SCRUM-864d · Un commit `SCRUM-864c:` dentro de la rama de 970 pide su entrada, y ésta es

**Medido contra:** `origin/main` = `43f4c7fc3f8d0330089edcd785cb0eea58ccb784` · 2026-09-21T07:33:55Z (GitHub)

**Rama:** `scrum-970-la-cifra-se-deriva` (PR #1552)

> ⛔ `src/` intacto · sin estado ni flag nuevos (27) · sin dependencias (36). No se borra nada de TMPDIR.

## 1 · Qué pasó

El commit `fc6d1844b9522b69274b464bda05de861bd1ebcc` de la rama de SCRUM-970 se tituló
`SCRUM-864c: el instrumento de 970 pide su temporal por el helper, que lo borra pase lo que pase`:
el instrumento de 970 (`docs/master/evidencias/scrum970/colision-del-contador.mjs`) creaba su
directorio con `mkdtempSync` a pelo, que es justo lo que el censo de 864c persigue, y se cambió a
`temporal()` de `tests/_temporal.mjs` (el helper que lo borra al salir el proceso pase lo que pase,
también si el script sale con 1 o 2).

El guard de SCRUM-854 lee el ASUNTO de cada commit propio de la rama (`SCRUM-<n>:` al inicio: SCRUM-857 lo
midió como la línea entre SER trabajo de un ticket y MENCIONARLO) y exige que la rama traiga
`docs/master/SCRUM-<n>.md` de CADA ticket con trabajo. Este commit es trabajo de 864 y la rama no tocaba
`SCRUM-864.md`: `build + tests` del #1552 salió rojo con «falta: docs/master/SCRUM-864.md» — la única
falla de 7.786 tests (`ℹ pass 7692 · fail 1`, run 35572760669).

## 2 · La decisión

Se escribe la entrada (norma A7: un guard en rojo se arregla cambiando el código o aquí el registro, nunca lo
que el guard exige) y **no se reescribe la historia**: rebasar para renombrar el commit exigiría `--force`
sobre una rama con PR abierto. Esto es todo lo que 864 tiene que decir de ese commit: no cambia el
censo de 864c ni su criterio.

## 3 · Lo medido y lo que NO

- El instrumento de 970 se RE-EJECUTÓ tras el cambio (21-sep, sobre el árbol fusionado): arranca, mide
  33 guards declarados y da — sin haberlo contrastado línea a línea con su expediente — forma vieja «🔴 LA CIFRA ENTRÓ MAL»
  (su salida es 1 porque `peor` recoge el peor informe, y la vieja falla a propósito), forma nueva
  «✅ ninguna cifra pudo entrar mal».
- No se midió que el directorio de `temporal()` se borre en ESTA ejecución (lo garantiza y lo vigila
  `tests/_temporal.mjs`, no este apéndice).
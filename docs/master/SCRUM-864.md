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

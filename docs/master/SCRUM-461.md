# SCRUM-461 · el censo de deriva no puede encogerse en silencio

**Medido contra:** `origin/main` = `7beafa139a6ba5242f050b00a9bb35a21c13c620` · 2026-08-10T23:31:19Z

**11-ago-2026** · sin gate, corre en `npm test`

## PASO 0

* **`docs/master/SCRUM-461.md` no existía en `main`** — pero eso es un atajo, no la prueba, así que
  se midió **el código**: `generar-sql-deriva.mjs:28` seguía leyendo el DMMF del cliente, ningún
  guard contrastaba contra el `.prisma`, y nada impedía escribir con el cliente atrasado. El
  defecto seguía vivo.
* **`git worktree list`**: cuatro árboles, ninguno en este carril.

## El defecto

```js
paresEsperados(datamodel = require('@prisma/client').Prisma.dmmf.datamodel)
```

No parsea `prisma/schema.prisma`: lee **el cliente generado**. El número que escribe es una
propiedad **del entorno**, no del árbol. El mismo código, el mismo día: **331** (cliente atrasado,
cinco campos por detrás), **345** (el fichero commiteado), **346** (el bueno).

**Y lo que lo convertía en defecto:** `tests/scrum222-deriva-arranque.test.mjs` comprueba ese
fichero contra **el mismo cliente**.

> «Dos testigos que comparten código son un testigo.» Aquí ni compartían: eran el mismo.

Un censo encogido **deja de mirar** las columnas que le faltan y responde «0 filas» —«en sync»—
justo sobre la que le falta. Se evitó porque el fundador vio un número raro. Con una columna en vez
de quince, nadie lo habría notado.

## Lo construido — dos piezas

### ① La puerta que había que cerrar: el generador se niega

`motivoParaNoEscribir()` antes de tocar el disco. **No es motor nuevo:**
`_prisma-procedencia-guard.mjs` ya compara el `.prisma` del repo con la copia que Prisma deja junto
al cliente, y ya sabía nombrar los campos que faltan — el 10-ago dijo los cinco. Aquí sólo se le da
superficie.

**Va en el generador y no en `pretest`** porque `_prisma-sync.mjs` ya protege **la tanda**; este
script lanzado **a mano** no pasa por ahí — y a mano es exactamente como se lanzó.

Y la comprobación va **al escribir**, no dentro de `paresEsperados`: los tests la importan con un
datamodel propio y meterla dentro los haría depender del entorno.

### ② El testigo que no comparte fuente: `scripts/_pares-del-schema.mjs`

Deriva las columnas **parseando el `.prisma`**, sin tocar el cliente. Con eso, el guard contrasta
**tres recuentos por separado** y cada uno con su suelo:

| | Fuente | Hoy |
|---|---|---|
| ① | `prisma/schema.prisma`, parser propio | 346 |
| ② | DMMF del cliente | 346 |
| ③ | `docs/sql/deriva-prod.sql` | 346 |

**Es un parser, y un parser se equivoca.** Por eso su corrección **no se afirma: se comprueba** en
cada tanda contra el DMMF cuando el cliente está al día. Hoy coinciden exactamente —cero
discrepancias en los dos sentidos, sobre 24 modelos y 400 campos, 54 relaciones descartadas—. Si un
día se equivoca en un campo, ese test cae.

> El día que `@prisma/internals` esté instalado, `getDMMF` hace esto mejor y el fichero sobra. Hoy
> no está, y **una dependencia nueva la pide el fundador** (regla 36).

## Verificación

| Mutación (post-condición en disco) | Cae |
|---|---|
| **quitar una entrada al censo commiteado** | *«EL CENSO SE HA ENCOGIDO»*, nombrando la columna |
| el generador no comprueba la procedencia | *«ESCRIBE SIN COMPROBAR»* |
| detecta el cliente atrasado y escribe igual | avisar no es negarse |
| el parser cuenta las relaciones como columnas | 5 tests |
| el parser ignora `@map` | 4 tests |
| el parser pierde el campo pegado a la llave | el corpus sintético |

**Control negativo:** con el cliente al día, `motivoParaNoEscribir()` devuelve `null` y el generador
escribe **exactamente el mismo fichero** (comprobado byte a byte tras normalizar EOL: 13 665 =
13 665). Un guard que estorba en el caso normal se desactiva al primer roce.

**Suelo:** con una fuente ilegible el contraste **no da verde** — «coinciden» y «no pude comparar»
son el mismo verde con significados opuestos.

> ⚠️ **DOS DEFECTOS DEL PARSER, CAZADOS POR EL CORPUS SINTÉTICO AL ESCRIBIRLO.** Perdía el campo
> pegado a la llave de apertura (`model X { id Int @id`, que es válido en Prisma) y el pegado a la
> de cierre. Los dos habrían **encogido el censo en silencio** — el modo de fallo exacto que este
> ticket persigue, cometido por su propio arreglo.
>
> ⚠️ **Y UN DEFECTO DEL GUARD, CAZADO POR LA MUTACIÓN.** El test «el generador comprueba antes de
> escribir» buscaba `motivoParaNoEscribir()` con `indexOf` y **encontraba su propia declaración**:
> quitar la llamada no ponía nada en rojo. Es el «mencionar no es hacer» que ese test dice
> combatir, cometido por el test. Ahora distingue llamar de declarar **por AST**, con su control
> positivo y negativo dentro.

## El aviso del junction, corregido donde lo AFIRMABA

Medido con `fs.realpathSync` sobre los cuatro worktrees vivos: **los cuatro tienen `node_modules`
propio**. No hay junction. El montaje de SCRUM-429 ya no existe.

**No es un detalle de redacción:** sobre ese aviso se desaconsejó un `npm install` por miedo a
romper la tanda de otras dos sesiones, y el miedo era infundado.

Corregidos los tres sitios que lo **afirmaban** — y no sustituyendo una afirmación por otra, sino
**diciendo cómo comprobarlo**, que es cierto con junction y sin él:

| Fichero | Qué era |
|---|---|
| `scripts/_prisma-procedencia-guard.mjs:233` | el **mensaje** que se lee al fallar — el que indujo la decisión |
| `scripts/_prisma-client-guard.mjs:11` | la cabecera que lo daba por hecho |
| `scripts/_artefactos-guard.mjs:131` | causa #2 de su mensaje, dada por hecha |

**Quién más lo cita, y no se ha tocado:** `scripts/_prisma-sync.mjs:10` y
`scripts/_prisma-procedencia-guard.mjs:51,130` lo **condicionan** («si», «cuando»), que sigue siendo
correcto; `tests/scrum182`, `scrum233`, `scrum235`, `scrum238`, `scrum429`; y once documentos
(`docs/ERRORES_ASESOR.md`, `docs/MIGRATIONS_PENDING.md`, `docs/PLAN_EJECUCION_Y_PARALELO.md`,
`docs/QA/SUITE_REGRESION.md` y siete entradas de máster). **Las entradas de máster no se
reescriben**: son la historia de cuando aquello era cierto.

### 🔴 Y LA OTRA CARA, que es la que explica este ticket

Sin junction, **cada worktree deriva por su cuenta**. Nadie regenera para nadie — que suena mejor y
es justo cómo se llegó a un cliente al que le faltaban cinco campos: nada lo arrastraba al día. El
aislamiento quita un modo de fallo y añade otro.

## Lo que NO se ha hecho

* **`scrum222` no se ha relajado.** Este ticket lo **acompaña**, y hay un test que comprueba que
  sigue en pie. Si un guard tiene un defecto se arregla o se acompaña, nunca se afloja.
* **El contenido del censo no cambia:** qué columnas vigila es lo mismo. Esto es **de dónde las
  saca**.
* **No se ha instalado nada.**

## Huecos que se declaran

* **El generador sigue leyendo del cliente.** Lo limpio sería derivar del `.prisma`, y no se ha
  hecho: el parser propio es un testigo, no una fuente de verdad. Cambiar la fuente del generador
  con un parser casero sería sustituir una dependencia del entorno por una dependencia de mi
  regex. **Lo correcto es `@prisma/internals`, y esa decisión es del fundador.**
* **El parser no cubre todo Prisma.** No hay `type` compuestos ni `view` en este schema, y no se
  contemplan. Si aparecieran, el contraste con el DMMF lo diría — en rojo, que es lo que se quiere.
* **El aviso corregido no tiene guard.** Nada impide que mañana alguien vuelva a afirmar un montaje
  sin medirlo. Se corrige el texto, no la costumbre.

## Tests

* `tests/scrum461-censo-no-encoge.test.mjs` — 10 tests

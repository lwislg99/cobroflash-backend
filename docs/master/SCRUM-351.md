# SCRUM-351 · la topología de `node_modules` se MIDE, no se cita

**Medido contra:** `origin/main` = `cffde532a0912803cdf5bea415505f90757874b2` · 2026-08-11T19:22:26Z

**11-ago-2026** · sin gate, corre en `npm test`

## PASO 0

* `git worktree list`: **cuatro** árboles — `cobroflash-backend`, `cobroflash-b1`, `cobroflash-b2`,
  `cobroflash-b3` (aquí). Ninguno en este carril.
* `git ls-remote --heads origin` completo: **no existe ninguna rama `scrum-351-*`**. Sí existe
  `scrum-471-node-modules-al-dia`, carril vecino y ya mergeado — leído antes de tocar nada.
* **`docs/master/SCRUM-351.md` no existía**, ni en `main` ni aquí.
* El guard de Prisma pidió regenerar el cliente al cambiar de rama (causa A). Se regeneró — y ese
  gesto es media entrega, ver más abajo.

## El defecto

`package.json` y las cabeceras de los guards de Prisma **afirmaban** que los worktrees comparten
`node_modules` por junction. De ahí salía la regla que aplicaban todas las sesiones —«quien regenera
el cliente de Prisma regenera para todos», luego no se regenera— y cobró en las **dos** direcciones:

* se **desaconsejó un `npm install`** por miedo a romper la tanda de otras sesiones. El miedo era
  infundado: no había nada compartido;
* una sesión arrancó con la tanda en rojo por cuatro `ERR_MODULE_NOT_FOUND` y **estuvo a punto de no
  arreglarlo** por respetar una restricción que no aplicaba.

SCRUM-461 midió el 10-ago y corrigió **la frase** en tres sitios. Este ticket es lo otro: **el
método**. Y no es una preferencia de estilo — es que una frase corregida caduca:

> `tests/scrum471-node-modules-al-dia.test.mjs:5-10` declara, con fecha de **ayer**, «200 árboles ·
> 147 con `node_modules` · **91 de ellos por junction**». Hoy `git worktree list` da **cuatro**, en
> el disco no queda **ni un `wt-*`** ni `.claude/worktrees/`, y de los **60** directorios llamados
> `node_modules` que hay bajo los cuatro árboles, **0 tienen `LinkType`**.

Y se movió **durante esta sesión**: al empezar, `cobroflash-backend` estaba en `Javierpf28-patch-2`
y `b2` en `scrum-464`; al cerrar, en `scrum-469` y en `main`. Un número medido ayer no describe hoy.

## La medición

`fs.realpathSync.native` sobre los cuatro worktrees de `git worktree list`:

| worktree | vía | destino real |
|---|---|---|
| `cobroflash-backend` | directorio propio | `…\cobroflash-backend\node_modules` |
| `cobroflash-b1` | directorio propio | `…\cobroflash-b1\node_modules` |
| `cobroflash-b2` | directorio propio | `…\cobroflash-b2\node_modules` |
| `cobroflash-b3` | directorio propio | `…\cobroflash-b3\node_modules` |

**Cuatro destinos distintos: no comparten.** Ni junction, ni symlink, ni resolución hacia arriba.

### El control en vivo, que es mejor que la tabla

A las **20:18:09** se regeneró el cliente de Prisma en `b3`. Marcas de
`node_modules/.prisma/client/index.js` justo después:

| árbol | mtime |
|---|---|
| `cobroflash-backend` | 11-ago 20:04:56 |
| `cobroflash-b1` | 11-ago 00:55:29 |
| `cobroflash-b2` | 11-ago 20:07:19 |
| **`cobroflash-b3`** | **11-ago 20:18:09** ← el único que se movió |

Regenerar aquí **no tocó a nadie**. La restricción se reevaluó ejecutándola, no razonándola.

## El método — `scripts/topologia-node-modules.mjs` · `npm run topologia`

La pregunta de verdad **no es «¿hay un junction?»**, es **«¿dos worktrees acaban usando el mismo
directorio?»**. A eso se llega por tres caminos, y los tres se contestan con la MISMA operación
—resolver el destino real y agrupar por él—, sin enumerar mecanismos (la familia de listas que
envejecen, SCRUM-199):

| vía | qué es | qué la delata |
|---|---|---|
| **propio** | directorio real dentro del worktree | — |
| **enlazado** | junction de Windows o symlink | `realpath` sale al destino de otro |
| **ausente** | Node resuelve **hacia arriba** y usa el del padre | 🔴 **nada**: no hay enlace que inspeccionar |

La tercera es la que mata un método basado en `lstat`: la carpeta no está, `lstat` falla, y un
comprobador ingenuo contesta «no hay» o «es tuyo» mientras Node carga el del padre. Está documentada
como la peor en `docs/PLAN_EJECUCION_Y_PARALELO.md:106`, y ningún comprobador del repo la cubría.

**Sale 1 solo cuando no ha podido mirar.** Compartir es una configuración legítima, no un fallo: el
comando no está para prohibirla, está para que nadie tenga que suponerla.

## El suelo, que es la otra mitad

**Un fallo de lectura NO es «son independientes».**

* `lstat` falla por algo que **no** sea `ENOENT` → ese árbol sale **CIEGO**, no «aquí no hay».
* el enlace está pero `realpath` no resuelve —junction cuyo destino borró alguien, que aquí pasó
  **dos veces** (`docs/ERRORES_ASESOR.md`)— → **CIEGO**, no «propio».
* git no contesta, o lista cero worktrees → **NO SUPE MIRAR**, y sin ningún ✔.
* **con un solo árbol ciego, el veredicto NO dice «no comparten»**: sería afirmar sobre un conjunto
  en el que hay alguien a quien no se ha mirado. Dice qué falta por medir.

## Los tests — `tests/scrum351-topologia-node-modules.test.mjs` (11, en `npm test`)

**El que decide si el ticket sirve es el del junction.** Probar el comprobador solo en la
configuración de hoy sería fijar la premisa otra vez, en la dirección contraria: un método que
siempre contesta «no comparten» acierta hoy y miente el día que haga falta.

Las dos configuraciones se **provocan** con el mecanismo real —`fs.symlinkSync(…, 'junction')`, que
es lo que hace `mklink /J` y no necesita elevación— sobre árboles de mentira bajo `os.tmpdir()`.
**No se toca el `node_modules` de nadie.**

* 🔴 **enlazados** → dice COMPARTEN y **nombra a los dos**, sin meter al tercero que tiene el suyo;
* 🔴 **sin `node_modules`** → los dos hijos y el padre caen en el mismo grupo;
* **control negativo sintético** → tres propios, no comparten;
* **control negativo sobre el árbol real** → se comprueba que **CONTESTA** y **cuánto tarda**, no
  QUÉ contesta. Exigir «independientes» pondría la suite en rojo el día que el fundador enlace un
  worktree — que es una decisión suya y una configuración legítima;
* **suelo** ×4: enlace roto · fallo al mirar · git mudo · lista vacía.

### 🔴 EL ROJO POR MUTACIÓN, Y UNO NO SALIÓ A LA PRIMERA

Sobre el código ya commiteado:

| mutación | qué rompe | resultado |
|---|---|---|
| `real = nm` (no resolver el enlace) | el método ingenuo de siempre | **2 rojos** (junction · enlace roto) |
| no subir al padre | ignora la vía ausente | **1 rojo** (resolución hacia arriba) |
| `if (err.code === 'ENOENT')` → `if (true)` | traga cualquier fallo de lectura | **11/11 VERDE** 🔴 |

La tercera **no daba rojo**, y la primera hipótesis fue la correcta: *caso mal elegido, no guard de
sobra*. El test del enlace roto entra por `realpath`, no por `lstat`, así que esa rama no la
ejercitaba nadie. Las causas realistas (`EACCES`/`EPERM`/`EIO`) Windows no las deja provocar sin
elevación; lo que sí se puede es hacer fallar **la misma llamada** por algo que no sea la ausencia.
Con el caso añadido, la mutación da **1 rojo**.

Un suelo que solo se declara no es un suelo. Éste está probado por el mecanismo.

## Qué se ha corregido, y dónde

Ninguna afirmación se sustituye por la contraria — **se manda a medir**:

| fichero | qué decía | por qué se ha tocado |
|---|---|---|
| `package.json:20` (`//postinstall`) | «en local, node_modules se comparte por junction entre worktrees … regenerar afecta a los vecinos» | **NO estaba en el censo de SCRUM-461** |
| `scripts/_prisma-client-guard.mjs` cabecera | — | se añade por qué no vale escribir la conclusión contraria |
| `scripts/_prisma-client-guard.mjs:78` | «no arregla la causa de fondo, **el** `node_modules` compartido» | lo daba por hecho; se le pasó a 461 |
| `scripts/_prisma-client-guard.mjs:174` | «sin tocar el `node_modules` **que comparten todos** los worktrees» | ídem |
| `scripts/_prisma-client-guard.mjs` `mensaje()` causa (B) | mandaba a `(Get-Item node_modules).LinkType` | ese comprobador **no ve la vía ausente** |
| `scripts/_prisma-procedencia-guard.mjs:51` | «—comparten `node_modules` por junction—» | 461 lo clasificó como condicional y **afirma** |
| `scripts/_prisma-procedencia-guard.mjs:130` | «con `node_modules` compartido por junction entre ~79 worktrees» | ídem |
| `scripts/_artefactos-guard.mjs:14` | «lo que **sí se comparte** es `node_modules`» + tres worktrees que ya no existen | medición de julio leída en presente |

### El censo, DERIVADO

Sobre lo que git tiene registrado, **1.401 ficheros leídos · 0 ilegibles**: **29 ficheros y 115
líneas** citan el tema. Por zona:

| zona | ficheros | líneas | qué se hace |
|---|---|---|---|
| código / guard | 5 | 23 | **corregido** lo que afirmaba (arriba) |
| doc operativo | 5 | 20 | 🔸 **no tocado** — ver huecos |
| entrada de máster | 9 | 43 | **no se reescriben**: son la historia de cuando era cierto |
| test | 8 | 24 | 🔸 **no tocado** — son mediciones fechadas |
| otro (`.gitignore`, hook) | 2 | 5 | condicionales, correctos |

**La regla que separa una cosa de otra:** una **medición fechada** es historia y se respeta; una
**afirmación en presente y sin fecha** es una premisa que alguien va a usar mañana, y ésa se corrige.

## Ningún guard ajeno se ha relajado

`tests/scrum235-cliente-por-columnas.test.mjs:382` exige los **literales** `junction` y `LinkType`
en el mensaje del guard del cliente, y mi primera redacción los quitó: **la tanda se puso en rojo**.
No se tocó ese guard. Se cumplió **diciendo la verdad**: que el enlace es *una* de las formas de
acabar compartiendo, y que un `LinkType` vacío **no** significa que sea tuyo. Su requisito real
—nombrar la causa (B) y decir cómo comprobarla— se cumple mejor que antes.

Tampoco se ha relajado `_prisma-client-guard.mjs`: sigue comparando cliente y schema igual, y de
hecho **saltó en esta sesión y tenía razón** (causa A, `Merchant.asesorProgramaPreguntadoAt`).

## La restricción «no regenerar el cliente de Prisma», reevaluada

**No aplica en la configuración de hoy, y aplicarla cuesta dinero** — dejó a una sesión sin arreglar
una tanda rota. Se retira como regla general y queda como **condición que se comprueba**:

* **hoy, con los cuatro worktrees independientes:** regenerar en el tuyo **no toca a nadie**.
  Medido en vivo arriba, no razonado.
* **sigue aplicando si `npm run topologia` dice COMPARTEN**, y entonces dice **con quién** —que es
  lo que hace falta para avisar. `scripts/_prisma-sync.mjs` ya lo implementa así: se niega a
  regenerar solo cuando no puede afirmar que el cliente es privado (falla cerrado).
* **si dice NO SUPE MIRAR:** se trata como compartido. Un fallo de lectura no autoriza nada.

## Lo que NO se ha hecho

* **No se ha tocado la disposición de los worktrees** — es del fundador.
* **No se han tocado** `prisma/schema.prisma`, ningún `.env`, ninguna base.
* **No se ha instalado nada** (regla 36).
* **No se ha reescrito ninguna entrada de máster.**

## Huecos y fuera de carril (regla 9: se reporta, no se arregla)

1. 🔸 **`tests/scrum471-node-modules-al-dia.test.mjs:5-10`** declara «200 árboles · 91 por junction»
   con fecha de ayer, y hoy no cuadra con nada que se pueda medir (4 worktrees, 0 enlaces, ningún
   `wt-*` en disco). **No se toca**: es una medición fechada, o sea historia. Pero si ese PASO 0
   contó árboles anidados dentro de `node_modules` en vez de worktrees, el número que sostiene su
   cabecera —«el compartido de los junctions está DESFASADO»— habría que rehacerlo.
2. 🔸 **`scripts/_prisma-sync.mjs:39` (`clienteEsPrivado`)** decide con `lstat().isSymbolicLink()`:
   **no ve la vía ausente**. Hoy no muerde porque falla cerrado (sin `node_modules` no hay binario
   de Prisma que ejecutar), y por eso **no se ha tocado**. Si algún día vuelve a haber worktrees
   dentro del repo, ese comprobador contestará que el cliente es privado cuando no lo es.
3. ✅ **Los cinco documentos operativos ya están clasificados y corregidos** — ver la sección final.
   (Este punto se cerró en la segunda vuelta: estaba DENTRO del encargo, no fuera de carril.)
4. 🔸 **`docs/master/SCRUM-471.md` no existe**, aunque su test está en `main` desde ayer.
5. 🔸 **El método solo mira lo que `git worktree list` declara.** Copias sueltas y worktrees
   retirados a medias quedan fuera **a propósito** (barrer el disco haría lento el comando y un
   comando lento no se ejecuta). Se pueden añadir a mano: `npm run topologia -- --arbol <ruta>`.

## Verificación

* `npm test` — **3.167 tests · 3.091 pass · 0 fail · 76 skipped** (los gateados de siempre; los
  mismos 76 que antes de tocar nada — este ticket no añade ni un salto).
* `npm run guards:entrada` — **17 tests, 4 guards, 0 fail**.
* Barrido de marcadores de conflicto sobre el árbol entero: **1.586 ficheros leídos, 0 ilegibles,
  0 · 0 · 0**.
* `git merge origin/main` dentro de la rama: *Already up to date*.

---

# Censo de los cinco documentos operativos, clasificados

**El criterio, y es el mismo que separó el código:**

* **medición FECHADA → HISTORIA. No se toca.** Reescribir una medición con fecha es falsificar el
  registro: el número era cierto el día que se tomó, y el documento existe para conservarlo.
* **afirmación EN PRESENTE y SIN FECHA → PREMISA. Se corrige.** Nadie la lee como un dato de
  ayer: la lee como el estado del proyecto, y decide con ella. Así se llegó a este ticket.

**La unidad que encaja en el criterio es el BLOQUE, no el fichero.** Dos de los cinco documentos
contienen los dos grupos a la vez, y clasificarlos «de fichero» habría dado la respuesta
equivocada en las dos direcciones.

## HISTORIA — no se toca (3 documentos + 1 bloque)

| dónde | qué lo fecha | qué dice |
|---|---|---|
| `docs/YAQU_MASTER.md` :1175, :1192, :1211, :1212, :1444 | cinco entradas `✅ SCRUM-nnn · … (fecha)` del registro | las citas viven dentro del relato de SCRUM-182/235/205/206/219 |
| `docs/ERRORES_ASESOR.md` :214, :216, :220, :222 | el encabezado `### 2026-07-27 · #11` | el incidente de los 37 worktrees. La **regla derivada** de :222 («deshacer *sus* enlaces») es **condicional**: no afirma que los haya |
| `docs/ERRORES_ASESOR.md` :429 | bloque de incidentes fechados | «faltaba la junction y `tsc` no existía» — narración de lo que pasó |
| `docs/MIGRATIONS_PENDING.md` :1149 | bloque `SCRUM-145 · ✅ APLICADO en prod (2026-07-24)`, cerrado con `Estado: staging ✅ (24-jul) · prod ✅ (24-jul)` | el ⚠️ es parte del registro de **aquella** migración, ya aplicada |
| `docs/PLAN_EJECUCION_Y_PARALELO.md` :95-106 | `📏 QUÉ COMPARTEN DE VERDAD LOS WORKTREES — **medido, no supuesto** (SCRUM-182, 27-jul-2026, sobre los 24 worktrees vivos)` | la tabla `dist` NO / `node_modules` SÍ por dos vías |

> 🔸 **El bloque 📏 se deja íntegro, y conviene saber lo que eso cuesta:** lleva su fecha en la
> cabecera, así que es historia por el criterio — pero dice «3 worktrees **hoy**» y se lee en un
> documento de plan, donde se busca el estado actual. **No se ha tocado a propósito**: cambiarlo
> sería reescribir una medición. Si el fundador quiere cerrar ese filo, la salida que NO falsifica
> nada es **añadir** debajo una segunda medición fechada — no editar la primera.

## PREMISA — corregido (2 bloques, en 2 documentos)

| dónde | qué afirmaba | qué se ha hecho |
|---|---|---|
| `docs/PLAN_EJECUCION_Y_PARALELO.md` :83 | «Los worktrees **llevan** un junction `node_modules → <repo>/node_modules`» — la fecha del bloque etiqueta el **incidente #11**, no la topología, y la frase sostiene una regla vigente | pasa a pretérito con su fecha; **la regla se conserva entera** («si hay enlace, deshazlo primero») porque no dependía de la afirmación, y se manda a `npm run topologia` |
| `docs/QA/SUITE_REGRESION.md` :757-760 | «`npx prisma` usa el binario LOCAL solo si el worktree tiene `node_modules` **(aquí, por junction)**» + la instrucción **«Crea el junction»** | el paréntesis se fecha; y el remedio pasa a `npm ci` en ESTE árbol o el binario local directo — mandar a crear un junction hoy **construiría** el montaje compartido que el repo acaba de medir que no tiene |
| `docs/QA/SUITE_REGRESION.md` :766-767 | «`node_modules` **está** compartido por junction entre worktrees», presente y sin fecha, como **justificación entera** de «regenerar después del push, nunca antes» | la regla **sobrevive con su motivo verdadero** —un cliente por delante de la BD rompe la lectura **en tu propio árbol**, compartas o no—, y el daño a terceros queda bajo «**si** SÍ compartes» |

⚠️ **Un cambio de conducta, señalado para que se pueda vetar:** en `SUITE_REGRESION.md:760` se ha
retirado el consejo *«Crea el junction»*. No es prosa: es una instrucción que hoy produciría
exactamente el montaje del que salió este ticket.

## Lo que este censo NO cambia

* **Ninguna entrada de máster se ha tocado** (y además sería un STOP).
* **Ninguna regla operativa se ha retirado.** Las dos que se apoyaban en la afirmación falsa siguen
  en pie, con el motivo correcto debajo: son buenas reglas que estaban mal justificadas.

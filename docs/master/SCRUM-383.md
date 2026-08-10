# SCRUM-383 · Un nombre que mentía: `DATABASE_URL_STAGING`

**Medido contra:** `origin/main` = `f56f49038ab9fbeb2e1a21bc2eb9ec0958c48877` · 2026-08-06T14:26:21+02:00

**6-ago-2026** · rama `scrum-383-guard-clave-destino`

## El defecto

`DATABASE_URL_STAGING` significaba **dos bases distintas según la carpeta**. Medido en los cuatro
árboles, imprimiendo `clave → host/base` con `describirBD` (nunca el valor):

| Worktree | `DATABASE_URL_STAGING` apuntaba a | Cuál es |
| --- | --- | --- |
| `cobroflash-backend` | `acela…/yaqu_dev_javier` | **DEV** |
| `cobroflash-b1` · `b2` · `b3` | `acela…/railway` | **STAGING** |

Y el detalle que lo explica todo: **las dos bases viven en el MISMO Postgres**, mismo host y
mismas credenciales. Lo único que cambia es el nombre de la base al final de la URL. Por eso
`_db-guard.mjs`, que valida el **hostname**, no las separaba: para él las dos son «acela», y las
dos pasaban.

## Lo que se arregló, y lo que NO

**Se arregló el NOMBRE, no la fontanería.** Nadie cambió de base. Mover los cuatro carriles a una
sola base habría sido un cambio de comportamiento que nadie pidió — el «de paso» que prohíbe la
regla 9 — y además el reparto por carril **es deliberado** (23-jul-2026): una base por carril,
para aislarlos.

Las tres claves, ahora en los cuatro `.env`:

| Clave | `cobroflash-backend` | `b1` · `b2` · `b3` |
| --- | --- | --- |
| `DATABASE_URL_STAGING` | `acela…/railway` | `acela…/railway` |
| `DATABASE_URL_DEV` | `acela…/yaqu_dev_javier` | `acela…/yaqu_dev_javier` |
| `DATABASE_URL_TESTS` | `acela…/yaqu_dev_javier` | `acela…/railway` |

### El tercer concepto, que no tenía nombre

Los seis consumidores no querían «staging» ni «dev»: querían **la base de pruebas de su carril**.
Eso es un concepto distinto de los otros dos, y hasta ahora se expresaba tomando prestado el
nombre de uno de ellos — que es exactamente por qué mentía.

Que `DATABASE_URL_TESTS` apunte a bases distintas según el worktree **no es el defecto de antes con
otro nombre**. La diferencia es verificable: «la base de pruebas de este carril» es una descripción
**verdadera en los cuatro sitios**, y por eso **se puede declarar** — vive en
`DESTINOS_ESPERADOS.DATABASE_URL_TESTS.porWorktree` y el guard la comprueba contra el árbol en el
que está. «Staging» apuntando a dev no se podía declarar sin escribir una falsedad.

## Los seis consumidores (censo previo, con fichero y línea)

Todos leían `DATABASE_URL_STAGING`; todos pasan a `DATABASE_URL_TESTS`. Comportamiento **idéntico**
al de antes en los cuatro árboles.

| Consumidor | Qué hace |
| --- | --- |
| `scripts/test-staging-gated.mjs:254` | la tanda gateada: toma turno y lanza 3 hijos |
| `tests/_staging-db.mjs:82` | fija la `DATABASE_URL` que verá el PrismaClient de `dist/` |
| `scripts/turno-staging.mjs:96` | toma / suelta / consulta el turno |
| `scripts/clean-staging-tests.mjs:51` | **borra** merchants `@test.local` |
| `scripts/preflight-schema-drift.mjs:68` | compara esquema (no escribe) |
| `scripts/conciliar-auditoria-fiscal.mjs:90` | conciliación fiscal con `--staging` |

### La lectura indirecta, medida antes de tocar nada

Cambiar la clave en un sitio no basta si alguien la recibe por otra vía. Medido:

* **Los hijos de la tanda heredan `{...process.env}`** (`test-staging-gated.mjs:483`) y leen la
  clave **ellos mismos** vía `tests/_staging-db.mjs`, que carga su propio `dotenv` (`:58`). No se
  les pasa por argumento. `HIJOS_SPEC[].env` solo toca los *gates* (`QA_DB_TEST`…), nunca claves de BD.
* **Ningún fallback**: no existe un solo `process.env.X || process.env.Y` sobre estas claves.
* **Ningún paso por argumento**: SCRUM-226 ya lo había prohibido.
* **Los wrappers de npm no exportan claves de BD** (`test:staging` → `node scripts/test-staging-gated.mjs`).
* Propagación *dentro* del proceso: `_staging-db.mjs:110` y `clean-staging-tests.mjs:61` asignan
  `process.env.DATABASE_URL = <url leída>` para el cliente de Prisma. Sigue habiendo **un solo
  punto de lectura** por proceso.

## B · Por qué hay DOS turnos de staging, y no uno

**Este es el dato que hacía peligrosa la otra salida, y no estaba escrito en ninguna parte.**

El marcador del turno **vive DENTRO de la propia base** (`current_database()` + comentario de
schema, `turno-staging.mjs`). O sea que el turno **no es** un servicio central: es un lock *por
base*. Hoy hay dos:

* el del árbol principal, en `yaqu_dev_javier`;
* el que comparten `b1`/`b2`/`b3`, en `railway`.

Nadie compite con nadie por un turno ajeno, y **no es casualidad**: es la consecuencia directa de
que cada carril pruebe en su base. Si los cuatro se hubieran movido a una sola base, los cuatro
habrían pasado a competir por un único turno — y el árbol principal se habría quedado esperando
turno para algo que hoy hace solo. Al no mover a nadie, el problema no llega a existir.

## C · `preflight-schema-drift`: la cabecera decía lo que no hacía

Afirmaba *«Este preflight cubre STAGING y DESARROLLO»*. Falso leído desde un solo árbol: **lee una
clave, luego mira UNA base**. La frase solo era cierta sumando los cuatro worktrees, que no es lo
que hace un comando. Corregida para que diga lo que hace.

**No se amplió su alcance** — eso es otro ticket, y bueno: SCRUM-169 dice que nada está aplicado
hasta estar en las tres BD, y un preflight que mira una no puede contestar eso. Lo abre el fundador.

Es un caso más de la regla de SCRUM-302: *un comentario que afirma un hecho del sistema caduca y
nadie lo revisa porque no está en ninguna suite*. Aquí había caducado **del lado tranquilizador**.

## DECLARADO, NO ARREGLADO

**`cobroflash-backend/.env` no tiene `DATABASE_URL` ni las cinco variables de VeriFactu** (que
`b1`/`b2`/`b3` sí tienen, desde SCRUM-185). Consecuencia medida: **`seed-staging.mjs` y
`marcar-staging.mjs` no arrancan en el árbol principal**, porque leen `DATABASE_URL`.

**Falla cerrado, que es lo correcto** — un script que siembra o marca una base y no encuentra su
URL debe pararse, no elegir otra. No se le han añadido claves: hacerlo sería darle al árbol
principal una vía para tocar producción que hoy no tiene.

## El guard

`scripts/_clave-vs-destino.mjs` compara **host Y NOMBRE DE BASE** (sin la base sería decorado: el
caso real son dos bases del mismo host). Sigue siendo **puro** —no lee entorno ni se conecta—, así
que su rojo se ejercita sin base de datos. Lo que toca el `.env` vive aparte, en
`scripts/comprobar-claves-bd.mjs`, que es el ejecutable:

```
node scripts/comprobar-claves-bd.mjs
```

Suelos, todos ejercitados en `tests/scrum383-clave-vs-destino.test.mjs` (16 en verde):

* destino irresoluble → `no_pude_resolver`, **nunca** `cuadra`;
* clave no declarada → `clave_desconocida`, no se aprueba por defecto;
* **worktree no declarado → `worktree_no_declarado`**: un árbol nuevo no tiene base asignada, y
  aprobarlo sería aprobar sin saber contra qué;
* si no se comprobó **ninguna** clave, el CLI falla en vez de informar de que todo está bien;
* el CLI se reconoce con `fileURLToPath`, no comparando `import.meta.url` con `argv[1]`: esta ruta
  lleva un espacio («Javier Pereira») y esa comparación cruda lo convertiría en un **NO-OP
  silencioso con exit 0** — el defecto exacto de SCRUM-235.

El mensaje de rojo dice **qué prometía, a qué apunta y en qué worktree**, y nombra el worktree por
su **nombre**, nunca por su ruta absoluta (información del disco de quien lo corre; mismo criterio
que `_identidad-sesion.mjs`).

## Hallazgos colaterales

**① El suelo de SCRUM-253 se degradó con este cambio, y seguía verde.**
`tests/scrum253-adopcion.test.mjs` usaba `DATABASE_URL_STAGING` como control positivo de su
analizador AST — *«una que SÍ se lee»*. Al renombrarla, dejó de leerse en ningún sitio y solo quedó
**nombrada** como literal en dos tests… así que el suelo **seguía pasando**, apoyado en la prosa de
otro fichero en vez de en una lectura real. Se apunta a `DATABASE_URL_TESTS`, que hoy se lee en
seis sitios. *Un control que sobrevive a su causa deja de ser control.*

**② `RUNBOOKS.md` afirmaba algo falso, y el procedimiento que daba era dañino.**
Decía que `.env` *«solo existe en el checkout principal, no en los worktrees»*. **Medido: los
cuatro lo tienen.** Y la instrucción que seguía —ejecutar los comandos del turno con el cwd del
principal— habría tomado el turno de `yaqu_dev_javier` cuando lo que se quería sostener era
`railway`. Corregido: **cada carril corre sus comandos desde su propio árbol**.

## Verificación

**Rojo con inyección verificada** (la inyección declara si se aplicó, antes de creerse el rojo):

| Caso | Inyección | Resultado |
| --- | --- | --- |
| `_STAGING` → `yaqu_dev_javier` en el principal | `railway` → `yaqu_dev_javier` ✔ aplicada | **cae**, exit 1 |
| `_TESTS` → `railway` en el principal | `yaqu_dev_javier` → `railway` ✔ aplicada | **cae**, exit 1 |
| `_TESTS` → `yaqu_dev_javier` en `b1` | `railway` → `yaqu_dev_javier` ✔ aplicada | **cae**, nombra `cobroflash-b1` |

Los tres nombran las tres cosas y el worktree. Restaurado y verde de nuevo, comprobado por
relectura. El rojo de `b1` se hizo **en memoria**, sin tocar su `.env` (otra sesión trabaja ahí) y
sin pasar la URL por línea de órdenes (regla 9).

**El guard en los CUATRO worktrees** — probarlo en uno solo no demuestra nada, porque «según la
carpeta» era la dimensión del fallo:

| Worktree | Rama en ese momento | `_TESTS` → | Exit |
| --- | --- | --- | --- |
| `cobroflash-backend` | `scrum-383-guard-clave-destino` | `acela…/yaqu_dev_javier` | **0** ✅ |
| `cobroflash-b1` | `scrum-285-censo-cobro` | `acela…/railway` | **0** ✅ |
| `cobroflash-b2` | `docs-glosario-real-vs-test-local` | `acela…/railway` | **0** ✅ |
| `cobroflash-b3` | `scrum-300-c5-fusion-rebasada` | `acela…/railway` | **0** ✅ |

**Suite:** `npm test` → 1863 tests, **1796 pass, 0 fail**, 67 skipped (los gateados, sin BD).

## Límite declarado

El guard comprueba **el `.env` del árbol donde se ejecuta**. No puede saber qué hay en los otros
tres, y por eso hay que correrlo en los cuatro: es una comprobación *por árbol*, no *del sistema*.
Y la tabla de arriba es una **foto fechada**: si alguien cambia un valor, envejece sin que nadie la
toque. Re-medir antes de usarla.

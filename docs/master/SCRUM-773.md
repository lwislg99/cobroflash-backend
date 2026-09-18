# SCRUM-773 — El backfill apagado: qué escribiría, medido EN SECO

*17-sep-2026 · rama `scrum-773b-el-backfill-en-seco`*

**Medido contra:** `origin/main` = `7340d33116c5ab168aa7c5a67abee02813014cf8` · 2026-09-17T21:15:54+01:00

> **Encargo: sólo el punto ②** — medir en seco qué escribiría hoy `backfill-job-assignees.mjs`.
> **La puerta NO se ha arreglado** (arreglarla es encender un backfill apagado, y eso no lo decide
> una sesión: reglas 9/37). `TECHO_PUERTAS_FRAGILES` **leído, no bajado**. `_prisma-sync.mjs` **no
> tocado**. Cero staging, cero producción, ningún `db push`, ninguna cadena de conexión en argv,
> en el chat ni en un fichero.

## VEREDICTO EN UNA LÍNEA

**Las cifras contra dev salen CIEGO —no hay ninguna clave de base en este árbol— pero la pregunta
① del ticket sí tiene respuesta, y es que HOY el backfill no desbloquea nada.**

---

## ③ ¿SIGUE HACIENDO FALTA? · Va primero, porque cambia qué se decide

### 🔴 No. Hoy no bloquea nada — y la razón está en el código, no en una intuición

**Un técnico asignado por la columna vieja YA VE su trabajo sin que el backfill corra.** La
visibilidad no mira un sitio, mira **tres, en OR**:

```
asignacionDeTrabajo.ts:141   EJES_DE_VISIBILIDAD = ['operarioId', 'assignedUserId', 'asignados']
asignacionDeTrabajo.ts:159     if (trabajo.operarioId     === teamMemberId) return true;
asignacionDeTrabajo.ts:160     if (trabajo.assignedUserId === teamMemberId) return true;
```

**Mientras `assignedUserId` siga siendo un eje, migrarlo a `job_assignees` no cambia quién ve qué.**
El backfill unifica el dato; no desbloquea a nadie. Haría falta **el día que ese eje se retire**, y
ese día no ha llegado.

### Y el dato NUEVO ya no lo necesita: hay doble escritura, con guard

`escribirAsignados` (`asignacionDeTrabajo.ts:115-124`) hace `deleteMany` + `createMany` sobre
`job_assignees`, y **una sola función escribe los dos sitios** precisamente para que no se separen
(`:19-21`, con un guard que cae si discrepan). Así que **lo que el backfill podría cubrir es sólo
el dato HISTÓRICO anterior al paso A** — no el que se crea hoy.

### 🔴 Nunca ha corrido por vía automática, y no por descuido

| vía | estado | por qué |
| --- | --- | --- |
| `docs/sql/scrum-650-paso-c-backfill.sql` | **RECHAZADA** | `MIGRATIONS_PENDING.md:37` · el aplicador sólo ejecuta una **lista blanca** de formas aditivas y el DML *«no está y no va a estarlo, porque esa lista existe para que un `DROP` no pase»* |
| `scripts/backfill-job-assignees.mjs` | **no arranca** | la puerta `:109` compara `import.meta.url` con `file://` + `argv[1]`, que en Windows nunca casa (SCRUM-765) |

**Las dos puertas del mismo backfill están cerradas, y una de ellas a propósito.** Si alguien lo
ejecutó a mano en una consola, **el repositorio no lo sabe** — hueco declarado, no deducido.

### Dónde busqué el sustituto (no sólo qué encontré)

    docs/sql/                     → scrum-650-job-assignees.sql · scrum-650-paso-c-backfill.sql
    scripts/*backfill*            → job-assignees · quote-jobid · quote-numbers  (ninguno lo duplica)
    prisma/migrations/            → NO EXISTE el directorio
    docs/MIGRATIONS_PENDING.md    → lo nombra sólo para decir que fue RECHAZADA
    node scripts/censo-migraciones.mjs → lo censa: {"datos":1,"lectura":3} [SQL en literal]

**No hay sustituto.** Lo que hay es un camino vivo que ya mantiene la tabla al día para el dato
nuevo, y un backfill parado para el viejo.

### Lo que esto significa para la decisión del fundador

**Arreglar la puerta no es la única salida, y probablemente no es la primera.** Si se retira el
script, el techo de puertas frágiles baja a **1** por la vía limpia (`TECHO_PUERTAS_FRAGILES = 2`,
`tests/scrum765-la-puerta-y-el-suelo.test.mjs:174` — **leído, no tocado**). Pero retirar tiene un
coste que conviene ver antes: **es el único ejecutor que queda** de una migración de datos que el
aplicador no puede hacer, y `scrum650c` fija su lógica con seis controles. **La pregunta que decide
no es «¿arreglamos la puerta?» sino «¿queda dato histórico sin migrar?» — y esa exige la base.**

---

## ② LAS TRES CIFRAS · el método está probado; los números, CIEGOS

### 🔴 SUELO · Por qué no hay cifras de dev, dicho por el instrumento de la casa

    node scripts/comprobar-claves-bd.mjs          EXIT 1

    [claves de base] worktree: cobroflash-b5
      🔴 DATABASE_URL_STAGING: AUSENTE del entorno de este árbol.
      🔴 DATABASE_URL_DEV:     AUSENTE del entorno de este árbol.
      🔴 DATABASE_URL_TESTS:   AUSENTE del entorno de este árbol.
      🔴 SUELO: no se leyó ni una sola cadena de conexión. Esto NO es un verde — es que
         no se miró nada. «No hay credencial de producción» y «no supe mirar» se ven
         igual aquí y significan lo contrario.

**No es que la base de dev esté vacía: es que no hay base a la que preguntar.** Y el encargo pedía
abortar CIEGO en ese caso, así que **CIEGO**, con el instrumento de la casa diciéndolo y no yo.

**Había una tentación y la descarto por escrito:** el checkout compartido
`C:\Users\Javier Pereira\cobroflash-backend` **sí** tiene un `.env` (500 bytes, 6-ago-2026) y
**ninguno de los 25 worktrees** lo tiene. Abrirlo para sacar una URL habría dado cifras hoy. **No se
ha hecho**: no sé qué clase de base hay dentro, el encargo prohíbe staging y producción, y leer las
credenciales de otro checkout para conectarme es exactamente el atajo que la regla 3 y SCRUM-418
existen para impedir. **Una cifra obtenida así valdría menos que no tenerla.**

### ✅ Lo que SÍ queda medido: que el método funciona y no escribe

La lógica se ejerció **sin tocar la puerta**: `backfill()` está exportada y recibe `consulta`
inyectable (`:69`), que es justo para esto. Sobre un banco con un **caso conocido** —10 trabajos con
asignado, 7 ya en la tabla—:

    ══ CONTROL POSITIVO · el caso conocido ══
      trabajos con asignado en la columna vieja : 10
      filas en job_assignees ANTES              : 7
      PENDIENTES (con asignado y sin fila)      : 3
      → escrituras REALES que haría             : 3
      → escrituras NO-OPERACIÓN (ya están)      : 7
      ✅ ¿la sonda identifica el caso conocido?  true

    ══ 🔴 NADA SE ESCRIBE ══
      consultas lanzadas: 4 · ¿alguna es el INSERT? false      ✅
    ══ CONTROL NEGATIVO ══
      con aplicar:true ¿lanza el INSERT? true                  ✅  (los dos modos SON distinguibles)
    ══ SUELO ══
      cero candidatos → aborta con CensoCiego                  ✅

El control negativo importa tanto como el positivo: si el modo `--aplicar` **no** lanzara el INSERT,
«en seco no escribe» sería cierto por la razón equivocada y no diría nada.

### Las tres cifras, definidas para cuando haya base

| cifra | cómo sale | SQL |
| --- | --- | --- |
| **cuántas filas tocaría** | `pendientes` | `SQL_PENDIENTES` — con asignado y **sin** fila en la tabla |
| **cuáles, por criterio** | ver abajo — **no** por listado de ids | `SQL_BACKFILL` |
| **cuántas serían NO-OPERACIÓN** | `candidatos − pendientes` | los que ya tienen fila: el `ON CONFLICT DO NOTHING` los descarta |

**El criterio, literal, para que se lea en vez de creerse:**

```sql
INSERT INTO "job_assignees" ("job_id", "team_member_id", "assigned_at")
SELECT j."id", j."assigned_user_id", COALESCE(j."updated_at", j."created_at")
FROM "jobs" j
WHERE j."assigned_user_id" IS NOT NULL
ON CONFLICT ("job_id", "team_member_id") DO NOTHING
```

`operario_id` **no aparece**: es autoría, no ejecución, y meterlo enseñaría trabajos ajenos a quien
sólo redactó un presupuesto (`scrum650c` lo fija con un test).

> **La cifra que decide si esto urge es la tercera.** Si casi todas las escrituras fueran
> no-operaciones, el backfill sería ceremonia. Y hay un indicio fuerte de que así será: la doble
> escritura lleva viva desde el paso A, así que sólo el dato anterior puede faltar. **Indicio no es
> medición, y por eso se declara CIEGO en vez de estimarlo.**

### ✅ NADA SE HA MUTADO — declarado y comprobable

    claves de base disponibles en este árbol : 0   → ninguna conexión era posible
    cliente `pg` instanciado                 : NO  → la sonda inyecta `consulta`, no conecta
    INSERT lanzado en la medición            : NO  → contado, 0 de 4 consultas
    git status --porcelain                   : 0 ficheros

---

## Hallazgos de otro carril · se REPORTAN, no se arreglan (regla 9)

**1 · Las claves de base están AUSENTES de `cobroflash-b5`, y `CLAUDE.md` afirma lo contrario.**
La regla 3 lleva un *«REGISTRO MEDIDO el 10-ago-2026 (SCRUM-418): los cuatro worktrees llevan
`DATABASE_URL_STAGING`, `_DEV` y `_TESTS`»*. SCRUM-880b ya la vio caducar en `b4`; **hoy caduca
también en `b5`**. Y el número tampoco se sostiene: `git worktree list` da **25**, no cuatro. La
propia línea pide re-fecharla, pero `CLAUDE.md` es gobierno (§11bis): lo prepara la S0.

**2 · La skill `cerebro-yaqu` afirma una ruta que no existe.** Dice *«`gh` está instalado FUERA del
PATH (`"C:\Program Files\GitHub CLI\gh.exe"`)»*, con corrección fechada **hoy, 17-sep-2026**.
Medido con **dos sondas independientes** (bash y PowerShell): no está en el PATH **ni en esa ruta ni
en ninguna de las cinco habituales**. *Si tu medición tumba una decisión firmada, gana tu medición.*

**3 · Mi propio censo de SCRUM-811b se dejó dos declaraciones fuera.** Conté `obligatori*` y no cacé
las que obligan diciendo **«SIEMPRE»**: `cerebro-yaqu` (*«Usar SIEMPRE al arrancar cualquier
tarea»*) y `verifactu` (*«Úsala SIEMPRE que la tarea toque facturación española»*). **No son 2
skills obligatorias: son 4**, y `verifactu` encima la descarté por el control negativo —bien
descartada por sus tres menciones de contenido AEAT, pero tenía otra puerta que no miré—. La cifra
«6 declaraciones» es un **suelo**, no un total. Corresponde anexarlo a `SCRUM-811.md`, que sigue
abierto; **no se toca aquí** porque no es este ticket.

---

## 🔴 Mis errores, esta tanda

1. **Mi banco comparaba por SUBCADENA y contestó otra pregunta.** `SQL_PENDIENTES` lleva
   `FROM "job_assignees"` dentro de su `NOT EXISTS`, así que casó con la rama de `SQL_FILAS` y el
   control positivo salió **`false`** con `pendientes = 7` en vez de 3. *Un prefijo no es un nombre,
   y una subcadena tampoco* — el canon de la casa, incumplido por mí en el primer intento. **Lo cazó
   el control positivo, que es exactamente para lo que estaba**: sin él habría publicado un número
   redondo y falso. Rehecho comparando **por identidad** contra las constantes exportadas.
2. **Anuncié una corrección antes de medirla.** Al cargar `cerebro-yaqu` dije en voz alta que la
   skill *«me corrige un hecho que he repetido tres veces»* sobre `gh` — y **luego** comprobé que la
   skill estaba mal. El orden correcto era medir y después hablar. No llegó a la entrega porque
   verifiqué a los treinta segundos, pero lo dije primero.
3. **Rompí mi propia sonda con un heredoc.** Escribí `split('\\n')` dentro de un heredoc y el
   escape se resolvió en un salto de línea real, dejando un `SyntaxError`. Inofensivo —el fichero
   ni compiló— pero es la segunda vez hoy que un heredoc me muerde.

---

## Lo NO tocado

`scripts/backfill-job-assignees.mjs` — **la puerta sigue rota, a propósito** · `TECHO_PUERTAS_FRAGILES`
(leído en `tests/scrum765…:174`, **no bajado**) · `scripts/_prisma-sync.mjs` — **ni abierto**: el
ticket dice que es otra decisión y que no se decidan juntas · `docs/sql/*` · `prisma/schema.prisma` ·
`src/`, `public/`, `tests/` — ni una línea · `CLAUDE.md` y las skills (gobierno, S0) ·
`docs/master/SCRUM-811.md` (la corrección de mi censo se reporta, no se anexa aquí) · Jira:
SCRUM-773 **no tocado**, sigue en *Acción del fundador*.
**Ninguna base de datos fue consultada ni escrita: no había ninguna clave con la que hacerlo.**
**Producción y staging: no tocados, ni para mirar.**

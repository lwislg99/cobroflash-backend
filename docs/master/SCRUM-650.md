# SCRUM-650 (T1) · Asignar un trabajo a VARIOS empleados — PASO 0, y PARO en el schema

**Medido contra:** `origin/main` = `5091091c973d631f22c3ceb15fdd091aebeed389` · 2026-09-02T10:00:00+02:00
**Rama:** `scrum-650-asignacion-trabajos` · **Nada aplicado. Ninguna base tocada.**

> ⚠️ **La descripción de Jira no se ha leído**: el MCP de Atlassian está desconectado en esta
> sesión. Todo lo de abajo se ha medido contra el código. Si la descripción dice algo que lo
> contradiga, este PASO 0 se reajusta.

---

## Veredicto en una línea

> **Medio ticket YA ESTÁ CONSTRUIDO Y PROBADO. La otra mitad —VARIOS— no cabe en el modelo actual y
> toca `prisma/schema.prisma`, así que PARO y propongo.**

## ① ¿Qué es hoy «Equipo»? — un usuario CON CUENTA

`model TeamMember` tiene `email @unique`, `role` (`admin | tecnico`), `status`
(`invited | active | suspended`) y **`authSessions AuthSession[]`**. Se loguea de verdad: `/admin/me`
resuelve `userRole` y `teamMemberId` desde la sesión.

**Asignar es DAR ACCESO, no etiquetar.** El ticket se sostiene tal cual estaba planteado.

## ② ¿Existe ya un vínculo trabajo↔persona? — SÍ, y son DOS, no uno

```prisma
assignedUserId Int? @map("assigned_user_id") // teamMember (Equipo)   ← QUIEN EJECUTA (SCRUM-10)
operarioId     Int? @map("operario_id")                                ← AUTORÍA     (SCRUM-52)
```

**No se unifican**: `operarioId` es quien creó el presupuesto, congelado al aceptar; `assignedUserId`
es a quién se le asigna ejecutarlo. Son dos ideas distintas y el schema lo dice.

## 🔴 Y esto: «un empleado ve SOLO los suyos» YA FUNCIONA

`jobs.routes.ts:477` —

```ts
const restringido = seesOnlyOwnJobs(req.userRole);
if (restringido) where.OR = [{ operarioId: req.teamMemberId }, { assignedUserId: req.teamMemberId }];
```

Y está **fail-closed**: `seesOnlyOwnJobs` complementa un allowlist de `admin`, así que **un rol
desconocido queda RESTRINGIDO**, no abierto. Lo dejó SCRUM-467, que además arregló que asignar un
trabajo no hacía que el técnico lo viera —había **6 con `assignedUserId` escrito que no miraba
nadie**—.

**Con tests, ya en `main`** (`tests/scrum467-tecnico-ve-lo-suyo.test.mjs`), y cubren justo lo que
este ticket pedía como suelo:

- CONTROL NEGATIVO: **un admin sigue viendo TODO**.
- **Un técnico NO puede abrir por id** un albarán que no es suyo.
- Un técnico con trabajo **ASIGNADO lo ve** — los dos ejes, en las dos rutas.

La asignación tiene su escritura: `PATCH /admin/jobs/:id` con `assignedUserId`, y es **admin-only**
por `ADMIN_ONLY_JOB_FIELDS` (`roleCapabilities.ts:90`).

## ③ ¿Admite VARIOS? — NO. Y aquí es donde paro

`assignedUserId` es **un escalar `Int?`**: un trabajo, un asignado. El caso real de Tecnosel
—«Israel, Miguel y Jesús.L» en una línea del parte de papel— **no cabe**.

Esto es `prisma/schema.prisma`, territorio del fundador. **No lo toco.** La propuesta:

```prisma
// ⚠️ SCRUM-674 · CORREGIDO. Este bloque era el del PASO 0 y le faltaba `onDelete` en
// `teamMember`: describia una version PEOR que la que YA esta en `prisma/schema.prisma`. La prosa
// de mas abajo («Corregido a Cascade en los dos padres») lo decia, pero el bloque no, y quien
// copiara de aqui habria reintroducido el defecto que SCRUM-244 cazo. Ahora dice lo que dice el
// schema real, literal.
// SCRUM-650 (T1) · un trabajo se asigna a VARIOS. Tabla puente, NO un array ni un CSV:
// un array pierde la integridad referencial y un CSV no se puede indexar ni filtrar.
model JobAssignee {
  jobId        Int      @map("job_id")
  teamMemberId Int      @map("team_member_id")
  assignedAt   DateTime @default(now()) @map("assigned_at")

  job        Job        @relation(fields: [jobId], references: [id], onDelete: Cascade)
  // onDelete: Cascade en LAS DOS. Sin el, la FK es RESTRICT y borrar un empleado —o su merchant—
  // revienta a mitad de recorrido con las tablas anteriores ya vaciadas (lo cazo SCRUM-244). Y es
  // lo correcto ademas de lo seguro: una asignacion no significa nada sin la persona asignada.
  teamMember TeamMember @relation(fields: [teamMemberId], references: [id], onDelete: Cascade)

  @@id([jobId, teamMemberId])
  @@index([teamMemberId])
  @@map("job_assignees")
}
```

Y su `ALTER TABLE`, para que Luis lo aplique con su verificación de `information_schema`:

```sql
CREATE TABLE "job_assignees" (
  "job_id"         INTEGER NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "team_member_id" INTEGER NOT NULL REFERENCES "team_members"("id"),
  "assigned_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("job_id", "team_member_id")
);
CREATE INDEX "job_assignees_team_member_id_idx" ON "job_assignees"("team_member_id");
```

**Aditivo puro**: no toca `jobs` ni `team_members`, así que **nada de lo que hoy funciona cambia**
mientras la tabla esté vacía. `assignedUserId` **se queda donde está** — retirarlo sería otro ticket
y rompería el filtro probado de SCRUM-467.

### Las tres decisiones que necesito de ti

1. **¿Tabla puente, o `assignedUserId` sigue siendo «el principal» y la tabla es «los demás»?**
   Recomiendo tabla puente como única fuente y `assignedUserId` **derivado o retirado más adelante**:
   dos sitios diciendo quién ejecuta un trabajo es exactamente cómo acaban discrepando.
2. **¿El filtro pasa a mirar los TRES ejes** (`operarioId`, `assignedUserId`, tabla) durante la
   convivencia? Es lo que evita que alguien deje de ver un trabajo que hoy sí ve.
3. **¿Un trabajo puede quedarse sin ningún asignado?** Hoy sí (`Int?` nullable). Si con la tabla
   sigue pudiendo, el listado del técnico no cambia; si no, hace falta decir qué pasa con los que ya
   existen.

## Lo que NO he tocado

`prisma/schema.prisma` · el parte (T3) · la firma (T4) · presupuesto · facturación · camino de
emisión. **Ni una línea de código en esta tanda**: es medición.

---

# FASE B (2-sep-2026) · Construido: pasos A y B. El C tiene DOS paradas declaradas.

> ⚠️ Se ANEXA. El PASO 0 de arriba no se toca.

**Medido contra:** `origin/main` = `5091091c973d631f22c3ceb15fdd091aebeed389` · 2026-09-02
**Ninguna base tocada.** El `CREATE TABLE` y el backfill quedan escritos y **sin aplicar**.

## PASO A · La tabla nace y se escribe en los dos sitios

`JobAssignee` + su `CREATE TABLE` aditivo y re-ejecutable, con verificación de `information_schema`.
La ruta acepta `assignedUserIds` (lista) y `assignedUserId` (uno o `null`), valida **cada** id contra
el merchant y escribe **los dos sitios en la MISMA transacción** — si una escritura se quedara
fuera, la discrepancia que el guard prohíbe se produciría sola.

**El guard que lo hace aceptable:** la coherencia es pura, cae **nombrando el trabajo**, y cubre las
tres formas de separarse. Más un barrido que impide escribir `assignedUserId` fuera de ese camino.
**Suelo de ceguera:** el censo con población vacía **lanza** — un cero se lee igual que «todo
coherente», y es el mismo cero que al técnico le dice «no tienes trabajos».

### 🔴 Un guard de la casa encontró un defecto REAL de mi propuesta de schema

`SCRUM-244` vio que la relación a `TeamMember` **no llevaba `onDelete`**: FK **RESTRICT**. Borrar un
empleado —o su merchant— habría **reventado a mitad de recorrido con las tablas anteriores ya
vacías**. Corregido a `Cascade` **en los dos padres**, en el schema y en el SQL que se aplica.
⚠️ **El `CREATE TABLE` que apruebes es el corregido**, no el del PASO 0.

## PASO B · Los tres ejes, en las dos rutas

`operarioId` OR `assignedUserId` OR `job_assignees`, en el listado de Trabajos **y** en los albaranes
del técnico (listado y detalle). Si una ruta se quedara con dos, el técnico vería su trabajo y **no
sus albaranes**.

- **Control positivo** con dos y con tres: **Israel, Miguel y Jesús.L** ven los tres el mismo
  trabajo. Con uno solo no se distingue «asignación múltiple» de «asignación al último».
- **Control negativo** enumerado: quien no está asignado **no lo ve**, y un trabajo **sin nadie es
  invisible para todo técnico** — solo lo ven los admin.
- **Regla 2:** el `OR` va **encima** de `merchantId`, nunca en su lugar.

### ⚠️ Una concesión medida, y su coste declarado

Escribí los tres ejes en una **función común** y hubo que **retirarla**: el guard de SCRUM-467
comprueba **por su texto** que el `where` nombre `operarioId` y `assignedUserId`, así que la fuente
común lo ponía en rojo **sin que la garantía cambiara ni un ápice** — rojo de FORMA. Su test es de
otro carril y **no se toca**: el literal se queda inline.

Lo que impide que las dos rutas se separen no es una función, entonces, sino el guard de
`scrum650b`: **exige los TRES ejes en LAS DOS rutas** y cae nombrando la que se quede corta.
**Coste:** `loVe` y `EJES_DE_VISIBILIDAD` quedan sin llamador vivo y van al censo de huérfanos **con
ese motivo escrito**, no escondido.

## 🛑 PASO C · Escrito lo que se puede, y PARO en lo que no

El backfill está en `docs/sql/scrum-650-paso-c-backfill.sql`, **idempotente** y con su verificación
(`pendientes` tiene que ser 0: si no, retirar la columna le quitaría el trabajo a algún técnico).
**No se aplica.**

Las otras dos mitades del paso C son **paradas declaradas por tus propias reglas**:

1. **«el filtro deja de mirar `assignedUserId`»** → el guard de SCRUM-467 exige ese literal en el
   filtro y en el detalle. Quitarlo **obliga a editar su test**, y tu instrucción es: *«Si tienes que
   editarlos, PARA: significa que estás cambiando la garantía, no ampliándola.»* Aquí sí se estaría
   cambiando: ese eje deja de existir. **Necesita tu GO explícito para tocar SCRUM-467.**
2. **«la columna se retira»** → `DROP COLUMN` es un **cambio de schema NO aditivo**, STOP de la
   constitución y de tu propia condición («si hace falta algo MÁS del schema, PARAS»).

**El orden que propongo cuando lo autorices:** aplicar `CREATE TABLE` → dejar correr el paso A →
backfill → verificar `pendientes = 0` → **entonces** GO para editar SCRUM-467 y `DROP COLUMN`, en
ese orden y no antes. Retirar la columna con el filtro aún leyéndola deja a todos los técnicos sin
trabajos.

## Lo que NO se ha tocado

`operarioId` (autoría, no ejecución) · el parte de trabajo · el presupuesto · facturación · el
camino de emisión · los tests de SCRUM-467 (**0 líneas modificadas**, verificado en cada paso).

---

# PASO C (2-sep-2026) · El backfill, probado contra un banco real

> ⚠️ Se ANEXA. Nada de lo de arriba se toca.

**Medido contra:** `origin/main` = `795e9c289e7028c33f37df258b3a7611a5a29e02` · 2026-09-02T18:30:00+02:00
**Rama:** `scrum-650-paso-c-backfill`
**Ni produccion ni staging.** Todo contra un Postgres local en `127.0.0.1:55432`, base
`yaqu_paso_c_test` — loopback y `_test`, que es lo que exige `parseBDSegura`.

## 0 · PASO 0 · el backfill YA ESTABA ESCRITO Y MERGEADO

`docs/sql/scrum-650-paso-c-backfill.sql` estaba en `main` desde la tanda A/B. Se reporto y no se
reescribio: **lo que faltaba eran las tres piezas que un `INSERT` de SQL puro no puede tener.**

## 1 · Que campo alimenta la tabla, y por que no el otro

**`jobs.assigned_user_id`**, y solo ese. El `WHERE` es `j."assigned_user_id" IS NOT NULL` y
`operario_id` no aparece en ninguna parte — hay un test que lo comprueba sobre el propio fichero.

- `assignedUserId` = **quien EJECUTA** (SCRUM-10) → es lo que `job_assignees` guarda.
- `operarioId` = **AUTORIA**, congelada al aceptar el presupuesto (SCRUM-52).

Mezclarlas meteria en «los asignados» a gente que solo redacto un presupuesto, y el filtro les
ensenaria trabajos que no ejecutan. **No se unifican.**

## 2 · El esquema del banco, DERIVADO — no escrito a mano

`./node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
--script` (el binario del proyecto, **nunca `npx`** — SCRUM-385). Control positivo: **27
`CREATE TABLE`**, 835 lineas. Aplicado y verificado con `information_schema`:

```
tablas en public: 27
job_assignees: assigned_at,job_id,team_member_id
jobs.assigned_user_id existe: 1
```

Un esquema escrito a mano habria sido un parecido, y medir contra un parecido es medir mal.

## 3 · 🔴 El SUELO DE CEGUERA, probado contra la base vacia

Un `INSERT ... SELECT` sobre cero filas **inserta cero y sale con exito**. Y «cero trabajos con
asignado» es indistinguible de «me he conectado a una base vacia y no he mirado nada». Con la base
vaciada:

```
rc=3
🔴 CENSO CIEGO - cero trabajos con `assigned_user_id`. Eso NO se puede leer como «no hay nada que
migrar»: es indistinguible de «me he conectado a una base vacia o equivocada y no he mirado nada».
  Un `INSERT ... SELECT` sobre cero filas inserta cero y SALE BIEN, y ahi es donde un backfill se
  da por hecho sin haber tocado un dato.
  Si de verdad no hay nada que migrar, dilo a mano: `--permitir-cero`.
```

## 4 · 🔴 IDEMPOTENCIA MEDIDA, no por construccion

Sembrados 4 trabajos (3 con asignado: 11, 12, 11 — y uno sin nadie). Las **dos salidas**, literales:

```
═══════ PRIMERA PASADA ═══════
  trabajos con asignado en la columna vieja : 3
  filas en job_assignees ANTES              : 0
  filas insertadas                          : 3
  filas en job_assignees DESPUES            : 3
  PENDIENTES (con asignado y sin fila)      : 0
  modo                                      : APLICADO
rc=0

═══════ SEGUNDA PASADA ═══════
  trabajos con asignado en la columna vieja : 3
  filas en job_assignees ANTES              : 3
  filas insertadas                          : 0
  filas en job_assignees DESPUES            : 3
  PENDIENTES (con asignado y sin fila)      : 0
  modo                                      : APLICADO
rc=0
```

**Segunda pasada: 0 insertadas, mismo total, 0 pendientes.** El `ON CONFLICT` lo hacia «por
construccion», y por construccion es justo lo que ha costado dos datos falsos esta semana.

## 5 · 🔴 LA EQUIVALENCIA, contra la base real

El filtro de `jobs.routes.ts:477` —`operarioId OR assignedUserId OR job_assignees`— leido por los
dos caminos, para los tres empleados del caso real:

```
  empleado 11  columna=[1,2,4]  tabla=[1,2,4]  IGUAL
  empleado 12  columna=[2,4]    tabla=[2,4]    IGUAL
  empleado 13  columna=[3]      tabla=[3]      IGUAL
rc=0
```

**No hay hallazgo que reportar: devuelve lo mismo.** El empleado 13 lo ve por AUTORIA, que es
justamente el eje que el backfill NO toca — y sigue viendolo, que era lo que habia que comprobar.

## 6 · Lo que NO se ha tocado

`prisma/schema.prisma` · el test de SCRUM-467 (**0 lineas**, verificado, y sigue verde) · ningun
`DROP COLUMN`: la columna vieja se queda, convivencia y no sustitucion.

## 7 · Huecos declarados

1. **No se ha ejecutado contra produccion.** Queda escrito y probado; lo ejecuta el fundador.
2. **El banco local NO es produccion.** Sus datos son cuatro filas sembradas a mano: lo que se ha
   probado es que el backfill y el filtro se comportan como dicen, no que los datos reales de
   produccion tengan la misma forma. Antes de aplicarlo alli, el `pendientes` de la verificacion
   tiene que salir 0 sobre los datos de verdad.
3. 🔴 **`scripts/_scratch-run.mjs` esta sin fuente por mi culpa.** `SCRATCH_DATABASE_URL` vive solo
   en `.env.prod.guardado`, el fichero que renombre desde `.env` en una tanda anterior — y esa
   herramienta busca en `.env`/`.env.local`. Es de otro carril: **se reporta, no se arregla.**

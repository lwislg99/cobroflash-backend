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

> ⚠️ **CONTRADICCIÓN DECLARADA, NO RESUELTA A MANO (2-sep-2026).** Este bloque SQL es el del
> **PASO 0** y **no** es lo que hay en el árbol hoy. La prosa de más abajo dice «Corregido a
> `Cascade` **en los dos padres**» y el APÉNDICE de las 14:35Z dice además que las FK llevan
> `ON UPDATE CASCADE` — pero el bloque de aquí arriba sigue sin `ON DELETE CASCADE` en
> `team_members`, sin `ON UPDATE`, sin nombres de constraint y sin `IF NOT EXISTS`. **Las dos
> quedan**: ésta documenta lo que se propuso, aquélla lo que se aplicó.
>
> **Lo que refleja el árbol de HOY (2-sep-2026, medido sobre `docs/sql/scrum-650-job-assignees.sql`
> tras mergear `main` = `6cc1f459378a8ed4b38665713bb5b156cc0b1e4e`) es el FICHERO, no este bloque:**
> `CREATE TABLE IF NOT EXISTS`, constraints con nombre, y
> `ON DELETE CASCADE ON UPDATE CASCADE` en **las dos** claves ajenas. Si vas a aplicar algo, aplica
> el fichero.

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

> **LAS DOS SECCIONES DE ABAJO SE QUEDAN, EN ORDEN CRONOLÓGICO.** Son entradas FECHADAS del
> mismo día y ninguna sustituye a la otra: el APÉNDICE documenta el DDL que le faltaba a
> producción (medido a las **14:35Z**), y el PASO C documenta el backfill (medido a las
> **16:30Z**). Quitar cualquiera de las dos falsearía el registro.

## APÉNDICE (2-sep-2026) · El DDL que le falta a producción para arrancar

**Fecha:** 2-sep-2026 · **Carril:** incidente de producción · **Alcance:** SCRUM-650 (`job_assignees`) y SCRUM-574 (`customers.contact_kind`)

**Medido contra:** `origin/main` = `283143b4701f75835888e82c25f41ad34e916655` · 2026-09-02T14:35:00Z

> **NO SE APLICA NADA EN PRODUCCIÓN DESDE AQUÍ** (regla 3). Este ticket genera y verifica; el
> fundador ejecuta. `schemaDrift.ts` **no se toca, no se relaja y no se le pone excepción**: la
> alternativa a no arrancar es reventar delante de un cliente.

---

## 1 · PASO 0

### ENTRADA

`yaqu.app` sirve hoy el código del **PR #862** (`010c05d3`, 24-ago-2026 13:27). Todo lo mergeado
después está en `main` y **no lo ha visto ningún profesional**. La entrada del usuario existe y
está congelada nueve días.

### MECANISMO · existe y está haciendo su trabajo

`src/core/db/schemaDrift.ts` para el arranque cuando la base no tiene lo que el código nombra.
El healthcheck de `/health` no responde nunca, Railway reintenta 11 veces y declara «1/1 replicas
never became healthy». **No hay nada que arreglar en el mecanismo: hay que darle a la base lo que
el código nombra.**

---

## 2 · Qué falta, medido del ESQUEMA y no de la cabeza

`node scripts/preview-migracion.mjs --desde <schema del PR #862>` — control positivo dentro
(26 tablas), **veredicto aditivo: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL**.

El schema desplegado se extrajo del propio commit y se comprobó que efectivamente **no contiene**
ninguna de las dos (1026 líneas, 25 modelos, 0 apariciones de `job_assignees` y de `contact_kind`).

El diff propone **cuatro** cosas; producción sólo se queja de **dos**:

| lo que propone el diff | ¿lo pide Railway? | por qué |
| --- | --- | --- |
| `merchants.timezone` | no | **ya está** en la base |
| `products.item_kind` | no | **ya está** en la base |
| `customers.contact_kind` | **sí** | falta |
| tabla `job_assignees` | **sí** | falta |

🔴 **Esa diferencia no se supone, se comprueba:** `mensajeDeDeriva` construye la lista con un
`join(', ')` sobre **todas** las que faltan y la acompaña de su contador — no trunca. Los
contadores del log dicen `(1)` y `(1)`, así que la base tiene exactamente un hueco de cada. El
diff contra el commit desplegado no es el diff contra la base real: **la base ha recibido parches
manuales**, y por eso el DDL cubre sólo los dos huecos reales.

### Mapeo físico, contrastado (no supuesto)

`quotes` mezcla convenciones (`valid_until` con `@map`, `"createdAt"` sin él), así que los nombres
se contrastan contra `docs/sql/deriva-prod.sql`, que es **generado** desde el esquema:

* `customers.contact_kind` — línea 122. ✔
* `job_assignees.assigned_at` · `job_id` · `team_member_id` — líneas 206-208. ✔

> **Corrección a la premisa del carril:** se me dijo que `job_assignees` *no* aparecía en
> `deriva-prod.sql`. **Sí aparece**, con sus tres columnas. El fichero se regeneró después de que
> entrara la tabla.

Y los tipos de las claves ajenas, del esquema: `Job.id` y `TeamMember.id` son `Int` →
`jobs.id` y `team_members.id` son `INTEGER`; tablas físicas `jobs` y `team_members`.

---

## 3 · Cuándo entró cada una — es un censo, no una intuición

| qué | commit | fecha | dónde estaba |
| --- | --- | --- | --- |
| desplegado hoy | `010c05d3` (PR #862) | **24-ago-2026 13:27** | — |
| `customers.contact_kind` | `b47e8341` (SCRUM-574) | **24-ago-2026 13:01** | mergeado a `main` en el PR **#861**, el merge **siguiente** al desplegado |
| `job_assignees` | `2135dfeb` (SCRUM-650) | **2-sep-2026 13:03** | hoy |

**Ahí está la explicación de por qué el primer despliegue posterior falló.** `contact_kind` se
escribió 26 minutos *antes* del commit que hoy sirve producción, pero se mergeó *después*: el
siguiente despliegue ya arrancaba contra una base sin esa columna. Y desde entonces cada intento
ha fallado por lo mismo. `job_assignees` es de hoy y se suma al mismo bloqueo.

---

## 4 · 🔴 Las otras dos bases — el hallazgo que explica el verde

Medido el 2-sep-2026, sólo lectura sobre `information_schema`, con control positivo:

| | producción | `yaqu_dev_javier` | `railway` (staging) |
| --- | :-: | :-: | :-: |
| `customers.contact_kind` | ❌ **falta** | ✅ está | ✅ está |
| `job_assignees` | ❌ falta | ❌ **falta** | ❌ **falta** |
| `merchants.timezone` | ✅ está | ✅ está | ✅ está |
| `products.item_kind` | ✅ está | ✅ está | ✅ está |
| control `customers.name` | — | ✅ 1 | ✅ 1 |
| control `quotes.valid_until` | — | ✅ 1 | ✅ 1 |

**Dos lecturas, y son distintas:**

* **`contact_kind` sólo falta en producción.** Ésta es la respuesta a «por qué la tanda pasa en
  verde y producción no arranca»: dev y staging la recibieron y producción no. Nadie podía verlo
  desde el repo, porque el único sitio donde el hueco existe es la base que nadie mira desde aquí.
* **`job_assignees` falta en LAS TRES.** Entró hoy y no se ha aplicado a ninguna. **El problema no
  es sólo de producción**: dev y staging también están derivadas, y los tests gateados por BD
  (`npm run test:staging:gated`) fallarían contra staging hasta que se aplique.

---

## 5 · Los ficheros, y por qué van separados

| fichero | qué hace |
| --- | --- |
| `docs/sql/scrum-574-customers-contact-kind.sql` | **nuevo** · la columna |
| `docs/sql/scrum-650-job-assignees.sql` | ya existía · la tabla, el índice, la PK y las FK |
| `docs/sql/verificacion-deriva-produccion.sql` | **nuevo** · la comprobación, SOLO LECTURA |

🔴 **La verificación vive en un fichero APARTE y no es un descuido.** La lista blanca de
`scripts/_clasificador-sql.mjs` **rechaza un `SELECT`** — es una lista blanca de formas aditivas y
lo que no reconoce lo rechaza por defecto. Un fichero que mezcle el `ALTER` con su comprobación
queda **inaplicable**. Ya pasó una vez; por eso se separan.

Y por el mismo motivo **las claves ajenas van INLINE dentro del `CREATE TABLE`**: el clasificador
acepta `CREATE TABLE`, `CREATE INDEX` y `ALTER TABLE … ADD COLUMN`, pero
`ALTER TABLE … ADD CONSTRAINT` —que es como lo emite Prisma— cae en «acción no reconocida como
aditiva». Inline, además, la tabla nace entera o no nace: **una tabla a medias es peor que
ninguna**.

### Una divergencia corregida de paso, con su motivo

Prisma emite las FK con `ON UPDATE CASCADE`; el fichero de SCRUM-650 las tenía sin cláusula, o sea
`ON UPDATE NO ACTION`. En la práctica da igual (`autoincrement()`, nadie actualiza un id), pero
dejaría la base diciendo una cosa y el esquema otra — y **eso no lo caza nadie**: `schemaDrift.ts`
y `deriva-prod.sql` sólo miran que existan tabla y columna, no tipos, defaults ni claves ajenas.
Sería deriva silenciosa creada el mismo día que se arregla una. Se alinea sin riesgo porque la
tabla **no existe todavía en ninguna base**.

---

## 6 · Evidencia

**Ensayo previo** (`aplicar-sql-dev.mjs` sin `--go`): los dos ficheros pasan la lista blanca —
`job_assignees` 2 sentencias (`CREATE TABLE`, `CREATE INDEX`), `contact_kind` 1
(`ALTER TABLE … ADD COLUMN`).

**El DDL se ejecutó de verdad**, contra `yaqu_dev_javier` (la única base a la que el aplicador
puede apuntar: está atado por DESTINO, no por variable). La verificación leída del catálogo —no
del mensaje de la herramienta—:

| | antes | después |
| --- | :-: | :-: |
| `job_assignees_tabla` | 0 | **1** |
| `job_assignees_columnas` | 0 | **3** |
| `job_assignees_pk` | 0 | **1** |
| `job_assignees_fks` | 0 | **2** |
| `job_assignees_fks_cascade` | 0 | **2** |
| `job_assignees_idx` | 0 | **1** |

**La verificación se demostró capaz de dar los dos resultados en la MISMA ejecución** —
`contact_kind` a 1 (está) mientras `job_assignees` estaba a 0 (falta)— y de distinguir base por
base: después de aplicar a dev, staging seguía en 0. Un instrumento que sólo hubiera visto ceros no
habría probado nada.

**Re-ejecutable**: segunda pasada de los dos ficheros sobre la misma base → mismos números, sin
duplicar ni fallar. Y `contact_kind` sobre una base que ya la tiene no hace nada.

**Tanda completa** después del último cambio: **4494 tests · 4415 pass · 0 fail · 79 skipped**.
Worktree limpio, Prisma regenerado y `dist/` reconstruido desde este worktree.

---

## 7 · Lo que NO se ha hecho, y por qué

* **No se ha tocado producción.** Regla 3. Las sentencias están listas para pegar; ejecuta el
  fundador.
* **No se ha aplicado a `railway` (staging)**, aunque le falta `job_assignees`. Staging tiene
  sistema de turnos y saltárselo sin necesidad interferiría con quien lo tenga tomado. Queda
  declarado como pendiente: mientras no se aplique, los tests gateados por BD fallarían contra ella.
* **No se ha tocado `schemaDrift.ts`** ni el healthcheck ni ninguna variable.
* **No se incluyen `merchants.timezone` ni `products.item_kind`** en el DDL, porque el chequeo de
  arranque —que no trunca— dice que ya están. Si el fundador quiere cinturón y tirantes, las dos
  sentencias con `IF NOT EXISTS` son inocuas sobre una base que ya las tiene; pero se aplica lo
  medido, no lo temido.

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

## 8 · LOS ROJOS · commit de resguardo `652ce41ed58674dd05fdba34d940aee97463778b`

Cinco inyecciones. Cada una: inyectar → medir → restaurar → verde. Nada sin commitear antes.

| # | Que se rompe | Que cae |
|---|---|---|
| 1 | el suelo de ceguera nunca dispara (`if (false && …)`) | 1 de 5 · «CERO trabajos … PARA» |
| 2 | `ON CONFLICT` fuera de la constante | **NADA en memoria (5/5 verdes)** · el Postgres real revienta |
| 3 | `ON CONFLICT` fuera, con el trinquete puesto | 1 de 6 · «fichero y constante EXACTAMENTE el mismo» |
| 4 | una SEGUNDA sentencia colada en el `.sql` | 1 de 6 · «el fichero tiene 2 sentencias ejecutables y tenia que tener UNA» |
| 5 | `OR j."operario_id" IS NOT NULL` en el `.sql` | 2 de 6 · el trinquete **y** «NO mete la AUTORIA en los asignados» |

### 🔴 El rojo 2 encontro un hueco de verdad, y por eso hay un trinquete nuevo

Quitando el `ON CONFLICT`, **los seis tests en memoria siguieron VERDES**. El banco de mentira
deduplica por su cuenta —simula el `ON CONFLICT` aunque el SQL ya no lo lleve—, asi que no puede
ver lo que le pase al TEXTO del SQL. Contra el Postgres real, la misma edicion:

```
ERROR:  duplicate key value violates unique constraint "job_assignees_pkey"
DETALLE:  Key (job_id, team_member_id)=(1, 11) already exists.
```

Y debajo habia algo peor que la idempotencia: **dos copias del mismo SQL sin nada que las atara**
—la del fichero, que es la que se pega en la consola, y la de la constante, que es la que se
ejercita aqui—. Podian divergir sin que nada se pusiera rojo, y entonces lo probado y lo ejecutado
dejan de ser lo mismo. De ahi el trinquete de igualdad exacta, mas la exigencia de UNA sola
sentencia ejecutable en el fichero: una segunda se ejecutaria en produccion sin que ningun test
la hubiera visto nunca. Commit de la correccion: `ff127dd6a4589d6901b96f98111f087e430f2857`.

Retirado ademas un `import { readFileSync }` muerto del envoltorio (unico uso: el propio import).

---

# PANTALLA (2-sep-2026) · Asignar un trabajo a VARIOS empleados

> ⚠️ Se ANEXA. Nada de lo de arriba se toca.

**Fecha:** 2-sep-2026 · **Carril:** trabajos · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `4982e1c2fd26454183fe1228f01426d5ee3c8a10`

Fila 2 de la certificación: motor ✅, columna ✅, **pantalla 🔴**. Esto es la pantalla.

## 1 · PASO 0 · no había nada hecho, y las coordenadas se verificaron

```
git ls-tree -r --name-only origin/main | grep -iE 'asignacion|job_assignees|JobAssignee'
  src/modules/jobs/domain/asignacionDeTrabajo.ts
  tests/_asignacion-bloques-presupuesto.mjs
  tests/_asignacion-submenus.mjs
  tests/scrum284-asignacion-submenus.test.mjs
  tests/scrum650-asignacion-a-varios.test.mjs

git ls-remote --heads origin | grep -iE 'asignacion|scrum-?650'
  b83060881d02117372622cd10a4bee3ccc7b3a38  refs/heads/scrum-650-asignacion-trabajos
```

Esa rama **ya es ancestro de `origin/main`** y no aporta un solo fichero exclusivo (`git diff
--stat origin/main...` vacío). Buscada además **la cosa** y no el número —«asignar», «asignado»,
`assignedUser` en todo `public/`—: **cero**. Lo único que sale son «Sin asignar» de gastos y de
informes, que es otra idea. **No hay pantalla de asignar en ninguna parte.**

Coordenadas del encargo, comprobadas en el árbol:

| lo que decía la certificación | medido |
| --- | --- |
| motor `asignacionDeTrabajo.ts:120` | ✔ `escribirAsignados` se declara en :115 y su cuerpo está en :120 |
| columna `schema.prisma:1131` (`job_assignees`) | ✔ `model JobAssignee` ahí |
| backfill probado | ✔ `docs/sql/scrum-650-paso-c-backfill.sql` |

Y **el backend ya estaba entero**: `jobs.routes.ts:791` llama a `escribirAsignados` dentro de la
transacción del PATCH, que admite `assignedUserIds` (lista). Faltaba la mitad de LECTURA y la
pantalla.

## 2 · El hueco de lectura, que no estaba en el encargo pero sin él no hay pantalla

`serializeJob` mandaba `assignedUserId` —**uno**— y nada más. La pantalla no tenía de dónde sacar
«Israel, Miguel y Jesús.L». Añadido `asignados: [{id, name}]` en `serializeJobDetail`:

- **en el DETALLE y no en `serializeJob`**: el listado serializa POR FILA y esto sería una consulta
  por Trabajo — el N+1 que SCRUM-58 vino a quitar;
- **en LAS DOS salidas** del detalle, incluida la temprana. Un Trabajo manual sin presupuesto es la
  **avería**, que es el caso que más se reparte entre varios: dejarlo fuera habría dado un selector
  vacío justo donde más falta hace, sin ningún error;
- **regla 2 aunque la clave ajena ya ate**: `where: { teamMember: { merchantId: job.merchantId } }`.
  La FK garantiza que el empleado EXISTE, no que sea de este negocio.

## 3 · La pantalla

`public/dashboard/js/jobAsignados.js` (nuevo) + un bloque en «Datos» de `jobDetailView.js`.

Va en «Datos» y **no en el rail**: el rail es contexto de SOLO LECTURA (patrón B2, regla 4) y su
guard prohíbe que cree un `input`.

🔴 **Y NO es el bloque RESPONSABLE del rail.** Aquél pinta `job.operario` — la AUTORÍA, congelada
al aceptar el presupuesto (SCRUM-52). Esto es **quién EJECUTA** (SCRUM-10). Un presupuesto lo
redacta uno y lo ejecutan tres. El módulo **no nombra `operarioId` en su código**, y hay un test
que lo comprueba sobre el fichero **leído sin comentarios** — la cabecera explica la prohibición, y
un guard por texto se cazaría a sí mismo en la explicación.

Es un módulo aparte y no código dentro de la vista por una razón medible: metido en la vista, la
única forma de probar «quitar a uno deja de enseñarle el trabajo» sería montar un navegador, y ese
test acaba siendo uno que nadie ejecuta.

**Al técnico** se le pinta en solo lectura con los nombres y el motivo — norma de SCRUM-89: un gate
no deja UI huérfana. Y no se le pide `/admin/team`, que es `requireRole('admin')` y sería un 403
garantizado.

## 4 · 🔴 El rojo que importa, medido

Tres asignados, se quita uno:

| | Israel | Miguel | Jesús.L |
| --- | :-: | :-: | :-: |
| asignados los tres | ✔ ve | ✔ ve | ✔ ve |
| **se quita a Miguel** | ✔ **sigue viendo** | 🔴 **deja de ver** | ✔ **sigue viendo** |

**Y cae con el mecanismo viejo.** Con la columna sola —`assignedUserId`, un escalar— asignar a
tres guarda al principal y **pierde a los otros dos sin ningún error**: lo ve UNO de tres. Y quitar
a Miguel de la columna no cambia nada, porque nunca estuvo. Ese contraste está en el test, así que
el verde de arriba no puede volverse un adorno.

**Control positivo:** con UN solo asignado todo sigue igual, la columna vieja sigue guardando al
principal (el filtro todavía la lee, paso A), y **la autoría sigue siendo un eje propio**: el que
redactó el presupuesto lo ve aunque no ejecute.

**El control que no puede caer:** `jobs.routes.ts:477` **no se ha tocado** — los hunks del diff
son `@@ 338`, `@@ 411` y `@@ 487`, y el `where` de los tres ejes no aparece en el diff.
`scrum467-tecnico-ve-lo-suyo` sigue en verde, 5/5.

## 5 · 🔴 El suelo, y una corrección MEDIDA al enunciado

El encargo decía: «si el listado de técnicos asignables devuelve CERO, falla declarándote ciego».
**Midiéndolo, ese cero significa dos cosas distintas y hay que separarlas:**

- **cero MIEMBROS → ciego.** `getTeamOverview` sintetiza SIEMPRE al propietario, así que una lista
  vacía es que la petición falló o devolvió otra forma. Lanza `EquipoCiego`.
- **cero ASIGNABLES con miembros → estado legítimo.** Y no es raro: 🔴 **el propietario tiene
  `id: null` porque NO tiene fila en `team_members`**, así que un negocio de una sola persona tiene
  un miembro y cero asignables. Si eso lanzara, el guard nacería rojo para todo merchant que empieza
  solo. Se dice en pantalla, con su texto, en vez de pintar un desplegable vacío.

Y por eso mismo **el propietario no se ofrece**: asignárselo revienta la clave ajena de
`job_assignees` y el PATCH responde `invalid_assignee`. Sería un clic que siempre falla.

## 6 · Microcopy: PROPUESTA, no aprobada (regla 30)

Los CINCO textos salen de **una sola constante** `MARCA_ASIGNADOS`, así que aprobarlos los apaga de
golpe. Entrada nueva en el censo de SCRUM-402 con **1** (no cinco) y su motivo — el mismo caso que
`jobNuevoModal.js`: **el mecanismo no existe sin texto**, un selector sin rótulo no se puede usar.
Hay un test en `scrum650d` que EXIGE que el literal con marcador sea uno solo, para que ese 1 no se
convierta en cinco sin que salte.

**Propuesta para firmar:** «Quién ejecuta este trabajo» (rótulo) · «Todavía no lo ejecuta nadie» ·
«Solo un administrador puede cambiar quién ejecuta» · «Todavía no hay empleados a los que asignar»
· «No se ha podido guardar quién ejecuta este trabajo».

## 7 · Hallazgo de otro carril — se REPORTA, no se arregla

🔴 **`apiRequest` NO serializa el `body`, y dos sitios le pasan un objeto.** Medido, no deducido:

```
lo que viaja: "[object Object]"
con stringify: "{\"direccion\":\"Av. Rey Juan Carlos 145\"}"
```

Los dos sitios son `jobDetailView.js:791` (renombrar el Trabajo) y `:829` (dirección de la obra, de
SCRUM-424). Con `Content-Type: application/json`, lo que llega al backend es basura: **esos dos
campos no se guardan**. Es de otro carril (SCRUM-31 / SCRUM-424) y no bloquea esta tarea, así que
queda escrito aquí. Mi código usa `JSON.stringify`, como el PATCH del tipo de operación.

## 8 · Lo que NO se ha tocado

`prisma/schema.prisma` · `jobs.routes.ts:477` y el test de SCRUM-467 · los ficheros del parte
(`partes.routes.ts`, `parteDetailView.js`) · el dictado · el camino de emisión.

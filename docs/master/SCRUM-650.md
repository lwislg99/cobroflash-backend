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
// SCRUM-650 (T1) · un trabajo se asigna a VARIOS. Tabla puente, NO un array ni un CSV:
// un array pierde la integridad referencial y un CSV no se puede indexar ni filtrar.
model JobAssignee {
  jobId        Int      @map("job_id")
  teamMemberId Int      @map("team_member_id")
  assignedAt   DateTime @default(now()) @map("assigned_at")

  job        Job        @relation(fields: [jobId], references: [id], onDelete: Cascade)
  teamMember TeamMember @relation(fields: [teamMemberId], references: [id])

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

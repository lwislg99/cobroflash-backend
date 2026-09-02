-- docs/sql/scrum-650-job-assignees.sql — SCRUM-650 (T1), fase B · paso A
--
-- UN TRABAJO SE ASIGNA A VARIOS EMPLEADOS. Tabla puente, aprobada por el fundador.
--
-- ADITIVO PURO: no toca `jobs` ni `team_members`. Mientras la tabla esté vacía, NADA de lo que hoy
-- funciona cambia — el filtro del técnico sigue leyendo `jobs.assigned_user_id` (paso A) y solo
-- pasa a mirar los tres ejes en el paso B.
--
-- RE-EJECUTABLE (`IF NOT EXISTS`): volver a correrlo sobre una base ya aplicada no hace nada.
--
-- ⚠️ NOMBRES DE LA BASE (snake_case), que salen de los `@map`/`@@map` del modelo. No se «corrigen».
--
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- SCRUM-670b (2-sep-2026) · SE ALINEA CON LO QUE PRISMA GENERA, y por qué importa
--
-- `prisma migrate diff` sobre este mismo modelo emite las FK con **`ON UPDATE CASCADE`**; aquí
-- estaban sin cláusula, o sea `ON UPDATE NO ACTION` (el defecto de Postgres). En la práctica da
-- igual —`jobs.id` y `team_members.id` son `autoincrement()` y nadie los actualiza— pero deja la
-- base diciendo una cosa y el esquema otra, y **eso no lo caza nadie**: `schemaDrift.ts` y
-- `deriva-prod.sql` sólo miran que EXISTAN tabla y columna, no tipos, ni defaults, ni claves
-- ajenas. Sería deriva silenciosa creada el mismo día que se arregla una deriva.
--
-- Se puede alinear sin riesgo porque la tabla NO EXISTE TODAVÍA EN NINGUNA BASE — medido el
-- 2-sep-2026 sobre `yaqu_dev_javier` y `railway` (0 tablas, 0 columnas), y producción lo dice en
-- su propio arranque. Si alguna la tuviera ya creada, `IF NOT EXISTS` la dejaría con la FK vieja:
-- por eso la verificación de abajo mira también la regla de actualización.
--
-- Los nombres de constraint se declaran EXPLÍCITOS (`job_assignees_job_id_fkey`, …) en vez de
-- dejárselos a Postgres: coinciden con los que emite Prisma, y así no dependen de una convención
-- automática que podría cambiar.
--
-- ⚠️ LA VERIFICACIÓN NO VIVE AQUÍ: está en `docs/sql/verificacion-deriva-produccion.sql`. La lista
-- blanca del aplicador RECHAZA un `SELECT` —y con razón—, así que un fichero que mezcle el DDL con
-- su comprobación queda inaplicable. Se separan a propósito.

CREATE TABLE IF NOT EXISTS "job_assignees" (
  "job_id"         INTEGER      NOT NULL,
  "team_member_id" INTEGER      NOT NULL,
  "assigned_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_assignees_pkey" PRIMARY KEY ("job_id", "team_member_id"),
  CONSTRAINT "job_assignees_job_id_fkey" FOREIGN KEY ("job_id")
    REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_assignees_team_member_id_fkey" FOREIGN KEY ("team_member_id")
    REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- La consulta CALIENTE es la del técnico: «qué trabajos tengo». Sin este índice, cada listado de
-- un empleado recorrería la tabla entera.
CREATE INDEX IF NOT EXISTS "job_assignees_team_member_id_idx" ON "job_assignees"("team_member_id");

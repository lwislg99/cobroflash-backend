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

CREATE TABLE IF NOT EXISTS "job_assignees" (
  "job_id"         INTEGER      NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "team_member_id" INTEGER      NOT NULL REFERENCES "team_members"("id") ON DELETE CASCADE,
  "assigned_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_assignees_pkey" PRIMARY KEY ("job_id", "team_member_id")
);

-- La consulta CALIENTE es la del técnico: «qué trabajos tengo». Sin este índice, cada listado de
-- un empleado recorrería la tabla entera.
CREATE INDEX IF NOT EXISTS "job_assignees_team_member_id_idx" ON "job_assignees"("team_member_id");

-- ── VERIFICACIÓN, para pegar después en la misma consola ────────────────────────────────────
-- Devuelve 1/1/1 si todo está. Un 0 en cualquiera dice EXACTAMENTE qué falta.
--
-- SELECT
--   (SELECT count(*) FROM information_schema.tables
--     WHERE table_schema='public' AND table_name='job_assignees')::int            AS tabla,
--   (SELECT count(*) FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='job_assignees'
--       AND column_name IN ('job_id','team_member_id','assigned_at'))::int        AS columnas_3,
--   (SELECT count(*) FROM pg_indexes
--     WHERE schemaname='public' AND tablename='job_assignees'
--       AND indexname='job_assignees_team_member_id_idx')::int                    AS idx;

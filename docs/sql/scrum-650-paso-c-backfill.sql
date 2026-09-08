-- docs/sql/scrum-650-paso-c-backfill.sql — SCRUM-650 (T1), fase B · paso C
--
-- MIGRA LAS FILAS EXISTENTES a la tabla puente. ESCRITO Y NO APLICADO.
--
-- Va DESPUÉS de que el paso A lleve un tiempo en producción: hasta entonces la columna y la tabla
-- se escriben juntas, así que lo único que este backfill recoge son los trabajos ASIGNADOS ANTES
-- de que la tabla existiera.
--
-- IDEMPOTENTE (`ON CONFLICT DO NOTHING`): volver a correrlo no duplica ni pisa nada. La clave
-- primaria es (job_id, team_member_id), así que un trabajo ya migrado se salta solo.

INSERT INTO "job_assignees" ("job_id", "team_member_id", "assigned_at")
SELECT j."id", j."assigned_user_id", COALESCE(j."updated_at", j."created_at")
FROM "jobs" j
WHERE j."assigned_user_id" IS NOT NULL
ON CONFLICT ("job_id", "team_member_id") DO NOTHING;

-- ── VERIFICACIÓN, para pegar después ────────────────────────────────────────────────────────
-- `pendientes` tiene que ser 0. Si no lo es, hay trabajos con asignado que NO llegaron a la tabla,
-- y retirar la columna les quitaría el trabajo a sus técnicos.
--
-- SELECT
--   (SELECT count(*) FROM "jobs" WHERE "assigned_user_id" IS NOT NULL)::int AS con_columna,
--   (SELECT count(DISTINCT "job_id") FROM "job_assignees")::int             AS con_tabla,
--   (SELECT count(*) FROM "jobs" j
--     WHERE j."assigned_user_id" IS NOT NULL
--       AND NOT EXISTS (SELECT 1 FROM "job_assignees" a
--                        WHERE a."job_id" = j."id"
--                          AND a."team_member_id" = j."assigned_user_id"))::int AS pendientes;

-- docs/sql/verificacion-deriva-produccion.sql — SCRUM-670b (2-sep-2026)
--
-- ¿TIENE ESTA BASE LO QUE EL CÓDIGO NOMBRA? La comprobación de los dos huecos que hoy impiden
-- arrancar producción, con CONTROL POSITIVO dentro.
--
-- ES DE SOLO LECTURA. Un único SELECT sobre `information_schema` y `pg_*`: no escribe, no bloquea,
-- no crea nada. Se pega en la consola de Postgres (Railway → base → Query).
--
-- ⚠️ VIVE EN UN FICHERO APARTE Y NO ES UN DESCUIDO. La lista blanca del aplicador
-- (`scripts/_clasificador-sql.mjs`) RECHAZA un `SELECT`, y con razón: es una lista blanca de
-- formas ADITIVAS, y lo que no reconoce lo rechaza por defecto. Meter la verificación en el mismo
-- fichero que el `ALTER` deja el fichero **inaplicable**. Ya pasó una vez; por eso se separan.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 CÓMO SE LEE — y el caso que se interpreta AL REVÉS
--
-- Cada columna del resultado es un número. La lectura NO es «cuanto más alto mejor»:
--
--   control_customers_name ......... 1 = la consulta VE el catálogo. **Si sale 0, NADA de lo
--                                    demás significa nada**: no es que falte todo, es que esta
--                                    sesión no está mirando el esquema de la aplicación (otro
--                                    `search_path`) o no pudo leer `information_schema`.
--   control_quotes_valid_until ..... 1 = ídem, y además prueba el mapeo FÍSICO: `valid_until`
--                                    lleva `@map` y `"createdAt"` no. Si este control diera 0
--                                    con el anterior a 1, la sesión ve el catálogo pero la
--                                    convención de nombres no es la que se supone.
--
--   👉 ÉSTE ES EL QUE SE LEE AL REVÉS: un 0 en los controles NO es «no está» — es «no se vio
--      nada». Son el mismo número con significados opuestos, y sin ellos un 0 en las filas de
--      abajo se leería como «falta la columna» cuando puede significar «no supe mirar».
--
--   customers_contact_kind ......... 1 = la columna está.  0 = FALTA → aplica
--                                    `docs/sql/scrum-574-customers-contact-kind.sql`.
--   job_assignees_tabla ............ 1 = la tabla está.    0 = FALTA → aplica
--                                    `docs/sql/scrum-650-job-assignees.sql`.
--   job_assignees_columnas ......... 3 = las tres columnas (`job_id`, `team_member_id`,
--                                    `assigned_at`). **1 ó 2 es PEOR que 0**: significa una tabla
--                                    a medias, y ahí `CREATE TABLE IF NOT EXISTS` no la arregla —
--                                    la salta. Si sale 1 ó 2, PARA y dilo.
--   job_assignees_pk ............... 1 = la clave primaria compuesta existe. Es lo que hace la
--                                    asignación idempotente: sin ella, asignar dos veces al mismo
--                                    empleado crea dos filas.
--   job_assignees_fks .............. 2 = las dos claves ajenas (`jobs`, `team_members`).
--   job_assignees_fks_cascade ...... 2 = las dos con `ON DELETE CASCADE`. Con menos, borrar un
--                                    empleado o un merchant revienta a mitad de recorrido con las
--                                    tablas anteriores ya vaciadas.
--   job_assignees_idx .............. 1 = el índice por `team_member_id`, el de la consulta
--                                    caliente del técnico («qué trabajos tengo»).
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- EL VEREDICTO, en una línea:
--
--   controles a 1  ·  1 · 1 · 3 · 1 · 2 · 2 · 1   →  esta base tiene lo que el código nombra.
--   cualquier control a 0                          →  NO se ha comprobado nada. Repetir.
--   algún 0 en el resto (con los controles a 1)    →  falta eso, y el fichero que lo arregla
--                                                      está nombrado arriba.
--
-- ALCANCE DECLARADO: comprueba EXISTENCIA, forma de la PK, las FK y su regla de borrado. NO
-- compara tipos ni defaults columna a columna, ni mira `ON UPDATE`. Lo que no mira, no lo afirma.

SELECT
  -- ── CONTROLES POSITIVOS · van primero a propósito: se leen antes que nada ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'name')::int                              AS control_customers_name,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'quotes'
       AND column_name = 'valid_until')::int                       AS control_quotes_valid_until,

  -- ── HUECO 1 · SCRUM-574 ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'contact_kind')::int                      AS customers_contact_kind,

  -- ── HUECO 2 · SCRUM-650 ──
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = 'job_assignees')::int                      AS job_assignees_tabla,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'job_assignees'
       AND column_name IN ('job_id','team_member_id','assigned_at'))::int
                                                                   AS job_assignees_columnas,
  (SELECT count(*) FROM information_schema.table_constraints
     WHERE table_schema = current_schema() AND table_name = 'job_assignees'
       AND constraint_type = 'PRIMARY KEY')::int                   AS job_assignees_pk,
  (SELECT count(*) FROM information_schema.table_constraints
     WHERE table_schema = current_schema() AND table_name = 'job_assignees'
       AND constraint_type = 'FOREIGN KEY')::int                   AS job_assignees_fks,
  (SELECT count(*) FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = current_schema() AND t.relname = 'job_assignees'
       AND c.contype = 'f' AND c.confdeltype = 'c')::int           AS job_assignees_fks_cascade,
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname = current_schema() AND tablename = 'job_assignees'
       AND indexname = 'job_assignees_team_member_id_idx')::int    AS job_assignees_idx;

-- docs/sql/verificacion-scrum-674.sql — SCRUM-674 (2-sep-2026)
--
-- ¿TIENE ESTA BASE LAS SEIS COSAS QUE HOY IMPIDEN ARRANCAR PRODUCCIÓN? Con CONTROL POSITIVO
-- dentro, para que un cero no se pueda leer al revés.
--
-- ES DE SOLO LECTURA. Un único SELECT sobre `information_schema` y `pg_*`: no escribe, no bloquea,
-- no crea nada. Se pega en la consola de Postgres (Railway → base → Query).
--
-- ⚠️ VIVE APARTE DEL DDL Y NO ES UN DESCUIDO. La lista blanca del aplicador
-- (`scripts/_aplicar-sql-dev.mjs`) sólo admite `ALTER TABLE … ADD COLUMN`, `CREATE TABLE … ( … )`
-- y `CREATE [UNIQUE] INDEX`: un `SELECT` lo RECHAZA, y con razón — lo que no sabe clasificar no
-- lo permite. Meter esto en el mismo fichero que el DDL lo dejaría INAPLICABLE.
--
-- ⚠️ Y VIVE APARTE DE `verificacion-deriva-produccion.sql`, que es de SCRUM-670b y comprueba los
-- DOS huecos de esta mañana (`customers.contact_kind` y `job_assignees`) — ya resueltos en
-- producción. Mezclarlos haría que aquel fichero dejara de ser el registro de lo que pasó hoy.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 CÓMO SE LEE — y los dos casos que se interpretan AL REVÉS
--
-- Cada columna del resultado es un número. La lectura NO es «cuanto más alto mejor»:
--
--   control_quotes_id .............. 1 = la consulta VE el catálogo. **Si sale 0, NADA de lo
--                                    demás significa nada**: no es que falte todo, es que esta
--                                    sesión no mira el esquema de la aplicación (otro
--                                    `search_path`) o no pudo leer `information_schema`.
--   control_quotes_valid_until ..... 1 = ídem, y además prueba el mapeo FÍSICO: `valid_until`
--                                    lleva `@map` y `"createdAt"` no. Si éste diera 0 con el
--                                    anterior a 1, la sesión ve el catálogo pero la convención
--                                    de nombres no es la que se supone.
--
--   👉 LOS DOS CONTROLES SE LEEN AL REVÉS: un 0 ahí NO es «no está» — es «no se vio nada». Son
--      el mismo número con significados opuestos, y sin ellos un 0 en las filas de abajo se
--      leería como «falta la columna» cuando puede significar «no supe mirar».
--
--   merchants_clausulas_presupuesto  1 = está.  0 = FALTA.
--   quotes_revision .................1 = está.  0 = FALTA.
--   quotes_iva_modo ................ 1 = está.  0 = FALTA.
--   quotes_clausulas_excluidas ..... 1 = está.  0 = FALTA.
--   jobs_tipo_intervencion ......... 1 = está.  0 = FALTA.
--   partes_trabajo_tabla ........... 1 = la tabla está.  0 = FALTA.
--
--   👉 EL SEGUNDO QUE SE LEE AL REVÉS:
--   partes_trabajo_columnas ........ **24** = completa. 0 = no está la tabla (coherente con
--                                    `partes_trabajo_tabla` = 0). **Cualquier número entre 1 y
--                                    23 es PEOR que 0**: es una tabla A MEDIAS, y ahí
--                                    `CREATE TABLE IF NOT EXISTS` NO la arregla — se la salta.
--                                    Si sale entre 1 y 23, **PARA y dilo**: hay que mirar qué
--                                    columnas faltan antes de tocar nada.
--   partes_trabajo_pk .............. 1 = la PK sobre `id` existe.
--   partes_trabajo_indices ......... 2 = los dos índices (`…_fecha_idx`, `…_estado_idx`).
--
--   tipos_correctos ................ **6** = los seis tipos son los que el esquema declara
--                                    (JSONB, JSONB, TEXT, INTEGER, TEXT, y `revision` NOT NULL).
--                                    🔴 ESTA COLUMNA EXISTE PORQUE `schemaDrift` NO MIRA TIPOS:
--                                    una columna creada como TEXT donde el esquema dice JSONB
--                                    ARRANCARÍA EN VERDE y el fallo saldría meses después,
--                                    delante de un cliente. Un número menor que 6 con todo lo
--                                    demás en su sitio significa exactamente eso.
--
-- QUÉ HACER SI FALTA ALGO: aplicar `docs/sql/scrum-674-deriva-produccion.sql` (aditivo,
-- re-ejecutable) y volver a pegar esta consulta. Todos los números tienen que subir a su valor
-- de arriba; ninguno baja.

SELECT
  -- ── CONTROLES POSITIVOS: si alguno sale 0, el resto del resultado NO significa nada ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'quotes' AND column_name = 'id')                        AS control_quotes_id,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'quotes' AND column_name = 'valid_until')               AS control_quotes_valid_until,

  -- ── LAS CINCO COLUMNAS ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'merchants' AND column_name = 'clausulas_presupuesto')  AS merchants_clausulas_presupuesto,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'quotes' AND column_name = 'revision')                  AS quotes_revision,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'quotes' AND column_name = 'iva_modo')                  AS quotes_iva_modo,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'quotes' AND column_name = 'clausulas_excluidas')       AS quotes_clausulas_excluidas,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'jobs' AND column_name = 'tipo_intervencion')           AS jobs_tipo_intervencion,

  -- ── LA TABLA ENTERA: existir no basta, se cuentan sus piezas ──
  (SELECT count(*) FROM information_schema.tables
     WHERE table_name = 'partes_trabajo')                                       AS partes_trabajo_tabla,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'partes_trabajo')                                       AS partes_trabajo_columnas,
  (SELECT count(*) FROM pg_constraint
     WHERE conname = 'partes_trabajo_pkey' AND contype = 'p')                   AS partes_trabajo_pk,
  (SELECT count(*) FROM pg_indexes
     WHERE tablename = 'partes_trabajo'
       AND indexname IN ('partes_trabajo_merchant_id_fecha_idx',
                         'partes_trabajo_merchant_id_estado_idx'))              AS partes_trabajo_indices,

  -- ── LOS TIPOS, que el arranque NO comprueba y por eso se comprueban aquí ──
  (SELECT count(*) FROM information_schema.columns c
     WHERE (c.table_name = 'merchants' AND c.column_name = 'clausulas_presupuesto' AND c.data_type = 'jsonb')
        OR (c.table_name = 'quotes'    AND c.column_name = 'clausulas_excluidas'   AND c.data_type = 'jsonb')
        OR (c.table_name = 'quotes'    AND c.column_name = 'iva_modo'              AND c.data_type = 'text')
        OR (c.table_name = 'quotes'    AND c.column_name = 'revision'
              AND c.data_type = 'integer' AND c.is_nullable = 'NO')
        OR (c.table_name = 'jobs'      AND c.column_name = 'tipo_intervencion'     AND c.data_type = 'text')
        OR (c.table_name = 'partes_trabajo' AND c.column_name = 'lineas'           AND c.data_type = 'jsonb')
  )                                                                             AS tipos_correctos;

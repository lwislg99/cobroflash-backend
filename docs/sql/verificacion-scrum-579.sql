-- docs/sql/verificacion-scrum-579.sql — SCRUM-579 (CONT-06)
--
-- ¿TIENE ESTA BASE LAS CINCO COLUMNAS DE LA DIRECCIÓN DE FACTURACIÓN? Con CONTROL POSITIVO
-- dentro, para que un cero no se pueda leer al revés.
--
-- ES DE SOLO LECTURA. Un único SELECT sobre `information_schema`: no escribe, no bloquea, no crea
-- nada. Se pega en la consola de Postgres (Railway → base → Query).
--
-- ⚠️ VIVE APARTE DEL DDL Y NO ES UN DESCUIDO. La lista blanca del aplicador
-- (`scripts/_aplicar-sql-dev.mjs`) sólo admite `ALTER TABLE … ADD COLUMN`, `CREATE TABLE … ( … )`
-- y `CREATE [UNIQUE] INDEX`: un `SELECT` lo RECHAZA. Meter esto en el fichero del DDL lo dejaría
-- INAPLICABLE.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 CÓMO SE LEE — y los dos casos que se interpretan AL REVÉS
--
--   control_customers_id ........... 1 = la consulta VE el catálogo. **Si sale 0, NADA de lo
--                                    demás significa nada**: no es que falte todo, es que esta
--                                    sesión no mira el esquema de la aplicación (otro
--                                    `search_path`) o no pudo leer `information_schema`.
--   control_billing_periodicity .... 1 = ídem, y además prueba la convención de nombres: es una
--                                    columna `billing_*` que YA existe desde SCRUM-171b. Si ésta
--                                    diera 0 con la anterior a 1, la sesión ve el catálogo pero
--                                    los nombres no son los que se suponen — y entonces los
--                                    ceros de abajo no significarían «falta».
--
--   👉 LOS DOS SE LEEN AL REVÉS: un 0 ahí NO es «no está» — es «no se vio nada». Son el mismo
--      número con significados opuestos.
--
--   billing_address ................ 1 = está.  0 = FALTA.
--   billing_city ................... 1 = está.  0 = FALTA.
--   billing_postal_code ............ 1 = está.  0 = FALTA.
--   billing_province ............... 1 = está.  0 = FALTA.
--   billing_country ................ 1 = está.  0 = FALTA.
--
--   👉 EL TERCERO QUE SE LEE AL REVÉS:
--   billing_completas .............. **5** = las cinco. **1..4 es PEOR que 0**: significa que la
--                                    tabla se quedó a medias —un `ALTER` interrumpido, o aplicado
--                                    sólo en parte— y el código dará por hecho que están las
--                                    cinco. Si sale entre 1 y 4, **PARA y dilo**: hay que mirar
--                                    cuáles faltan antes de tocar nada.
--
--   tipos_correctos ................ **5** = los cinco son TEXT y NULLABLE, que es lo que declara
--                                    el esquema. 🔴 ESTA COLUMNA EXISTE PORQUE `schemaDrift` NO
--                                    MIRA TIPOS: una creada como VARCHAR(10) o con NOT NULL
--                                    arrancaría en VERDE, y el fallo saldría al guardar la
--                                    primera dirección larga o el primer cliente sin dirección.
--                                    Un número menor que 5 con todo lo demás en su sitio
--                                    significa exactamente eso.
--
--   👉 Y `NULLABLE` SE COMPRUEBA A PROPÓSITO: si alguna naciera `NOT NULL`, «cliente sin
--      dirección» dejaría de ser representable — que es la mitad del ticket.
--
-- QUÉ HACER SI FALTA ALGO: aplicar `docs/sql/scrum-579-direccion-facturacion.sql` (aditivo,
-- re-ejecutable) y volver a pegar esta consulta. Todos los números suben a su valor; ninguno baja.

SELECT
  -- ── CONTROLES POSITIVOS: si alguno sale 0, el resto del resultado NO significa nada ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name = 'id')                     AS control_customers_id,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name = 'billing_periodicity')    AS control_billing_periodicity,

  -- ── LAS CINCO, una a una: para saber CUÁL falta, no sólo que falta algo ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name = 'billing_address')        AS billing_address,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name = 'billing_city')           AS billing_city,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name = 'billing_postal_code')    AS billing_postal_code,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name = 'billing_province')       AS billing_province,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers' AND column_name = 'billing_country')        AS billing_country,

  -- ── EL RECUENTO: 5 = completo · 1..4 = a medias, PEOR que 0 ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers'
       AND column_name IN ('billing_address', 'billing_city', 'billing_postal_code',
                           'billing_province', 'billing_country'))              AS billing_completas,

  -- ── LOS TIPOS, que el arranque NO comprueba y por eso se comprueban aquí ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'customers'
       AND column_name IN ('billing_address', 'billing_city', 'billing_postal_code',
                           'billing_province', 'billing_country')
       AND data_type = 'text'
       AND is_nullable = 'YES')                                                 AS tipos_correctos;

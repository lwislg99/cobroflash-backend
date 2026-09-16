-- docs/sql/scrum-729-verificar.sql — SCRUM-729 · la comprobación, APARTE del DDL
--
-- Va en su propio fichero por la lección de SCRUM-650: el clasificador del aplicador rechaza un
-- `SELECT` dentro de un fichero de DDL, así que mezclarlos deja el `ALTER` sin poder ejecutarse.
--
-- ORDEN: ⓪ y ① se corren **ANTES** del ALTER. ②, ③ y ④, después.
-- Sólo lectura: ni una escritura en todo el fichero.

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ⓪ EL SUELO DEL PROPIO GUION · se corre LA PRIMERA y no depende de ningún nombre de columna
--
-- 🔴 POR QUÉ EXISTE: las consultas de abajo escriben nombres físicos —`customer_name`,
-- `customer_tax_id`…— y **un guion que da por buenos sus propios nombres de columna es un
-- instrumento que no se ha probado a sí mismo**. Esto los pone a la vista ANTES, leyéndolos de la
-- base en vez de suponerlos.
--
-- Lo único que da por sabido es el nombre de las TABLAS, y ésos están medidos en dos fuentes:
-- `@@map("invoices")` y `@@map("albaranes")` en `prisma/schema.prisma`, y 36 + 26 filas en
-- `docs/sql/deriva-prod.sql`, que se escribió contra la base real.
--
-- 🔴 SE PARA SI:
--    · no devuelve filas de una de las dos tablas → aquí no se llaman así, y nada de lo de abajo
--      significa nada;
--    · aparece YA alguna `customer_*` de las cinco → el ALTER pisaría algo. `ADD COLUMN IF NOT
--      EXISTS` no fallaría, pero dejaría una columna con otro tipo o con datos que nadie ha mirado.
--
-- ⚠️ MIRA TAMBIÉN `customerId`. Se espera verla **en camello y entre comillas** en `invoices`: es
-- la deuda del modelo antiguo, está documentada en el DDL y NO se toca aquí. Si apareciera como
-- `customer_id`, entonces la base y el esquema han divergido y hay que parar por otro motivo.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('invoices', 'albaranes')
ORDER BY table_name, ordinal_position;

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ① ANTES DEL ALTER · ¿es cierta la premisa del relleno NULL?
--
-- El relleno inicial es NULL en todas las filas, y eso se apoya en una afirmación medible: **hoy
-- ningún documento emitido guarda quién era el cliente entonces** — el PDF lo reimprime del
-- `customers` de hoy, que es el defecto que mide `docs/master/SCRUM-729.md`.
--
-- Esto cuenta cuánto documento hay ya emitido, o sea **cuántas filas se quedan sin ese dato para
-- siempre**. No bloquea el ALTER: lo dimensiona, para que el número no sorprenda después.
--
-- 🔴 SI DEVUELVE 0 FILAS EMITIDAS EN LAS DOS TABLAS, sospecha del entorno antes que del dato:
-- estarías mirando una base vacía, y entonces ② y ③ tampoco dirán nada útil.
SELECT 'invoices'  AS tabla, count(*) AS filas FROM "invoices"
UNION ALL
SELECT 'albaranes' AS tabla, count(*) AS filas FROM "albaranes";

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ② DESPUÉS DEL ALTER · ¿existen las diez columnas, y con la forma pactada?
--
-- Se esperan EXACTAMENTE 10 filas (5 por tabla), todas con:
--    data_type = text · is_nullable = YES · column_default = NULL
--
-- 🔴 Un `NOT NULL` o un `column_default` aquí serían el defecto que este ALTER evita: convertirían
-- todos los documentos históricos en «este era el cliente», que no lo ha dicho nadie.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('invoices', 'albaranes')
  AND column_name IN (
    'customer_name',
    'customer_legal_name',
    'customer_tax_id',
    'customer_email',
    'customer_phone'
  )
ORDER BY table_name, column_name;

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ③ DESPUÉS DEL ALTER · el relleno es NULL en TODAS las filas
--
-- Se espera: `con_dato = 0` en las diez columnas, y `sin_dato = total`.
-- Si `con_dato` > 0 justo después de aplicar, el ALTER llevaba un default que no debía.
SELECT
  'invoices' AS tabla,
  count(*)                        AS total,
  count("customer_name")          AS con_nombre,
  count("customer_legal_name")    AS con_razon_social,
  count("customer_tax_id")        AS con_nif,
  count("customer_email")         AS con_email,
  count("customer_phone")         AS con_telefono
FROM "invoices"
UNION ALL
SELECT
  'albaranes',
  count(*),
  count("customer_name"),
  count("customer_legal_name"),
  count("customer_tax_id"),
  count("customer_email"),
  count("customer_phone")
FROM "albaranes";

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ④ DESPUÉS DEL ALTER · el producto sigue funcionando igual
--
-- Aditivo significa que nada de lo que hay deja de funcionar, y eso se comprueba, no se afirma:
-- las columnas que el documento YA usaba siguen ahí y siguen respondiendo.
--
-- Se espera: las mismas filas que ① devolvió, y `sin_cliente = 0` en las dos tablas (la relación
-- de hoy es obligatoria en `invoices`).
--
-- ⚠️ `"customerId"` VA ENTRE COMILLAS DOBLES Y EN CAMELLO a propósito: es su nombre físico real en
-- `invoices` (ver ⓪). Sin las comillas, Postgres lo bajaría a minúsculas y no lo encontraría.
SELECT
  count(*)                                AS facturas,
  count("customerId")                     AS con_cliente,
  count(*) - count("customerId")          AS sin_cliente
FROM "invoices";

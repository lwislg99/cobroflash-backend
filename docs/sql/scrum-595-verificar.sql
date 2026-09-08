-- SCRUM-595 (DOC-05) · VERIFICACIÓN, CON CONTROL POSITIVO DENTRO. Sólo LEE.
-- Se pega entera en la consola de Postgres de cada base (dev, staging y producción).
--
-- 🔴 PIDE EL TIPO, no sólo la existencia. `schemaDrift` comprueba que la columna esté y NO su
-- tipo, así que un `tags` creado como TEXT pasaría su arranque y rompería al leer un array.
--
-- CÓMO SE INTERPRETA — y el control positivo es lo que hace que un cero signifique algo:
--
--   ✅ CORRECTO → 4 filas, y las DOS nuevas con `data_type = jsonb`:
--        customers | tags   | jsonb  ← CONTROL POSITIVO (SCRUM-580, ya aplicada en las tres)
--        invoices  | tags   | jsonb  ← la nueva
--        quotes    | lines  | jsonb  ← CONTROL POSITIVO de cómo se ve un JSONB de toda la vida
--        quotes    | tags   | jsonb  ← la nueva
--
--   🔴 FALTA UNA    → si no sale `quotes | tags` O no sale `invoices | tags`: el ALTER no está
--                     aplicado entero en esta base. 🔴 LAS DOS O NINGUNA: con una sola, el bloque
--                     funcionaría en un documento y no en el otro, que es justo lo que este
--                     ticket declara «no hecho».
--   🔴 TIPO MALO    → si sale `tags` con un `data_type` distinto de `jsonb`: se creó mal. NO se
--                     arregla con otro ALTER a ciegas; se para y se mira, porque cambiar el tipo
--                     de una columna con datos dentro no es aditivo.
--   ⚠️ NO SE PUDO   → si faltan los DOS controles (`customers.tags` y `quotes.lines`), la consulta
--                     no estaba mirando esta base: la ausencia de las nuevas no significa «no
--                     están», significa «no se vio nada».
--
-- ⚠️ LOS DOS CONTROLES SON DE COSAS DISTINTAS a propósito. `customers.tags` acredita que se está
-- mirando una base donde el mecanismo de CONT-07 ya vive; `quotes.lines` acredita que se está
-- mirando la tabla `quotes` —la del ticket— y no sólo `customers`. Un único control no distingue
-- «esta base no tiene las nuevas» de «esta consulta no llega a esa tabla».

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name IN ('quotes', 'invoices') AND column_name = 'tags')
     OR (table_name = 'customers' AND column_name = 'tags')
     OR (table_name = 'quotes' AND column_name = 'lines') )
ORDER BY table_name, column_name;

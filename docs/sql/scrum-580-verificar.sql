-- SCRUM-580 · VERIFICACIÓN, CON CONTROL POSITIVO DENTRO. Sólo LEE.
-- Se pega entera en la consola de Postgres de cada base (dev, staging y producción).
--
-- 🔴 PIDE EL TIPO, no sólo la existencia. `schemaDrift` comprueba que la columna esté y NO su
-- tipo, así que un `tags` creado como TEXT pasaría su arranque y rompería al leer un array.
--
-- CÓMO SE INTERPRETA — y el control positivo es lo que hace que un cero signifique algo:
--
--   ✅ CORRECTO → 3 filas, y la de `customers.tags` con `data_type = jsonb`:
--        customers | recargo_equivalencia | boolean  ← CONTROL POSITIVO (ya existía)
--        customers | tags                 | jsonb    ← la nueva
--        merchants | clausulas_presupuesto| jsonb    ← CONTROL POSITIVO de que un JSONB se ve así
--
--   🔴 FALTA        → si NO sale `customers | tags`: el ALTER no está aplicado en esta base.
--   🔴 TIPO MALO    → si sale `tags` con otro `data_type` que no sea `jsonb`: se creó mal. NO se
--                     arregla con otro ALTER a ciegas; se para y se mira, porque cambiar el tipo
--                     de una columna con datos dentro no es aditivo.
--   ⚠️ NO SE PUDO   → si faltan las DOS de control, la consulta no estaba mirando esta base y la
--                     ausencia de `tags` no significa «no está»: significa «no se vio nada».

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name = 'customers' AND column_name IN ('tags', 'recargo_equivalencia'))
     OR (table_name = 'merchants' AND column_name = 'clausulas_presupuesto') )
ORDER BY table_name, column_name;

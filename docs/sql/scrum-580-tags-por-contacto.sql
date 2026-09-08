-- SCRUM-580 (CONT-07) · Las etiquetas del contacto.
--
-- ⚠️ NOMBRE DE LA BASE (snake_case), NO DEL MODELO. `customers` es snake_case al 100 %
-- (`legal_name`, `tax_id`, `wa_opt_out`, `billing_address`, `recargo_equivalencia`…), y aquí
-- coinciden: el campo se llama `tags` en el modelo y `tags` en la columna.
--
-- 🔴 EL TIPO **NO ESTÁ ADIVINADO**: lo generó `node scripts/preview-migracion.mjs --desde`, o sea
-- `prisma migrate diff` sobre el esquema modificado. Su veredicto: **aditiva — ni DROP, ni RENAME,
-- ni TRUNCATE, ni DELETE, ni SET NOT NULL**, con control positivo (la herramienta respondió y vio
-- 27 tablas).
--
-- Esto importa más de lo que parece: `schemaDrift` comprueba que la columna EXISTA, **no su tipo**.
-- Crear esto como TEXT arrancaría EN VERDE y se pudriría semanas después, cuando alguien guardara
-- un array y lo leyera como cadena. Dos columnas de la última deriva ya eran JSONB por esto mismo.
--
-- SIN `NOT NULL` Y SIN `DEFAULT`, y no es cosmética: `null` = «no se declararon etiquetas», que NO
-- es `[]` = «se miraron y no hay ninguna». Con un `DEFAULT '[]'` un `IS NOT NULL` diría que TODOS
-- los clientes tienen etiquetas, y el filtro de la lista se construiría sobre esa mentira.
--
-- ADITIVO Y RE-EJECUTABLE: `IF NOT EXISTS`, así que volver a correrlo sobre una base ya aplicada
-- no hace nada y no falla.
--
-- ⚠️ ORDEN: esto va ANTES de que `prisma/schema.prisma` nombre el campo. `schemaDrift` compara
-- esperado ⊆ real al arrancar: una columna de MÁS en la base es inocua, una de MENOS impide
-- arrancar producción. Las tres bases primero; el esquema, el código y los tests después y juntos.

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "tags" JSONB;

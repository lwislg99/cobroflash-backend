-- SCRUM-587 · VERIFICACIÓN, CON CONTROL POSITIVO DENTRO. Sólo LEE.
-- Se pega entera en la consola de Postgres de cada base (dev, staging y producción).
--
-- 🔴 PIDE EL TIPO Y LA ESCALA, no sólo la existencia. `schemaDrift` comprueba que la columna esté
-- y NO su tipo, así que un `dto_por_defecto` creado como INTEGER pasaría su arranque y rompería el
-- primer día que alguien pacte un 12,50 %. Por eso se leen `numeric_precision` y `numeric_scale`:
-- un `DECIMAL(5,0)` es «numeric» igual que el bueno y se distinguen sólo por la escala.
--
-- CÓMO SE INTERPRETA — y el control positivo es lo que hace que un cero signifique algo:
--
--   ✅ CORRECTO → 3 filas, y la de `customers.dto_por_defecto` con `numeric 5,2`, nullable YES y
--      SIN default:
--        customers | dto_por_defecto      | numeric  5,2  | YES | (null)  ← la nueva
--        customers | recargo_equivalencia | boolean       | YES | (null)  ← CONTROL POSITIVO (ya existía)
--        quotes    | discount_global_amount| numeric 12,2 | YES | (null)  ← CONTROL POSITIVO de
--                                                   cómo se ve un DECIMAL bien creado en esta base
--
--   🔴 FALTA      → si NO sale `customers | dto_por_defecto`: el ALTER no está aplicado aquí.
--                   ⛔ Y ENTONCES `prisma/schema.prisma` NO PUEDE NOMBRAR EL CAMPO TODAVÍA: con el
--                   esquema pidiendo una columna que la base no tiene, `schemaDrift` no arranca,
--                   el healthcheck falla y Railway deja vivo el despliegue anterior.
--   🔴 ESCALA MALA→ si sale con `numeric_scale` distinto de 2: se creó mal. NO se arregla con otro
--                   ALTER a ciegas; se para y se mira, porque cambiar el tipo de una columna con
--                   datos dentro no es aditivo.
--   🔴 CON DEFAULT→ si `column_default` no es nulo: alguien le puso un `DEFAULT 0` y acaba de
--                   convertir a TODOS los clientes en «declarados con un 0 %». `NULL` = «no hay
--                   descuento pactado» y `0` = «se pactó un 0 %» son cosas distintas.
--   ⚠️ NO SE PUDO → si faltan las DOS de control, la consulta no estaba mirando esta base y la
--                   ausencia de `dto_por_defecto` no significa «no está»: significa «no se vio nada».

SELECT table_name, column_name, data_type, numeric_precision, numeric_scale,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name = 'customers' AND column_name IN ('dto_por_defecto', 'recargo_equivalencia'))
     OR (table_name = 'quotes' AND column_name = 'discount_global_amount') )
ORDER BY table_name, column_name;

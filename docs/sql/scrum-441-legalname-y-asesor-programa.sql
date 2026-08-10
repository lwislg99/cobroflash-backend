-- SCRUM-441 · Las tres columnas que faltan: la razón social del proveedor (E4) y las DOS del
-- programa del asesor (E2).
--
-- ⚠️ NOMBRES DE LA BASE (snake_case), NO DEL MODELO. Las TABLAS se han LEÍDO del `@@map` del
-- schema, no derivadas por convención: de los 24 modelos, CUATRO no la siguen
-- (`Albaran → albaranes`, `AlbaranLineaFacturada → albaran_lineas_facturadas`,
-- `WhatsAppMessage → whatsapp_messages`, `AuditLog → audit_log`). Aquí:
--     model Provider  →  @@map("providers")   (schema.prisma, model Provider)
--     model Merchant  →  @@map("merchants")   (schema.prisma:109)
--
-- Y la COLUMNA `legal_name` tampoco se deriva: es el nombre físico que YA usan los dos modelos
-- que tienen ese mismo campo — `Merchant.legalName @map("legal_name")` (:15) y
-- `Customer.legalName @map("legal_name")` (:143). Se copia de ellos.
--
-- ADITIVO Y RE-EJECUTABLE: las tres llevan IF NOT EXISTS, así que volver a correrlo sobre una
-- base ya aplicada no hace nada y no falla.
--
-- 🔴 LAS DEL ASESOR SON DOS, Y NO ES UN LUJO. Con solo la respuesta, `NULL` significaría a la vez
-- «no se le preguntó» y «se le preguntó y pasó»: el mismo valor con dos sentidos opuestos, que es
-- exactamente lo que E2 existe para no confundir. La fecha dice SI se preguntó; el texto, QUÉ
-- contestó. `preguntado_at IS NULL` = nunca se le preguntó; `preguntado_at` con `programa NULL` =
-- se le preguntó y no quiso.
--
-- 🔴 TODAS NULLABLE Y SIN DEFAULT, a propósito. Un `DEFAULT` sobre una tabla con filas escribe un
-- valor que nadie ha decidido en cada fila existente — y aquí eso sería inventarle una razón
-- social a un proveedor ya dado de alta, o una respuesta a un profesional al que nadie preguntó.
-- «No se sabe» es NULL, y no puede parecerse a un dato.

-- E4 · razón social del proveedor. `providers` tiene `tax_id` desde E4 pero NO el nombre fiscal:
-- sin él, el libro de recibidas identifica al proveedor por el mote que le pone el profesional
-- en su libreta.
ALTER TABLE "providers"
  ADD COLUMN IF NOT EXISTS "legal_name" TEXT;

-- E2 · ¿se le preguntó por el programa del asesor, y cuándo?
ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "asesor_programa_preguntado_at" TIMESTAMP;

-- E2 · qué contestó. NULL con `preguntado_at` puesto = se le preguntó y pasó.
ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "asesor_programa" TEXT;

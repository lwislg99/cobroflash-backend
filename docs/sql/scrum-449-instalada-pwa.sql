-- SCRUM-449 · `auth_sessions.instalada_pwa` — la columna que desbloquea H5 fase 2 (SCRUM-360).
--
-- ⚠️ NOMBRES DE LA BASE (snake_case), NO DEL MODELO. Salen de los `@@map`/`@map` del schema:
-- la tabla es `auth_sessions` y la convención de ese modelo es snake_case (`merchant_id`,
-- `team_member_id`, `expires_at`, `used_at`, `created_at`). No se "corrigen".
--
-- 🔴 SIN `NOT NULL` Y SIN `DEFAULT`, A PROPÓSITO. `null` es el TERCER ESTADO —«no se pudo
-- saber»— y NO es lo mismo que `false`. Un `DEFAULT false` lo destruiría en la primera fila:
-- «no instalada» y «no supimos si estaba instalada» pasarían a ser el mismo valor, que es
-- justo la clase de recuento tranquilo y falso que SCRUM-360 separó en tres estados.
--
-- ADITIVO Y RE-EJECUTABLE: `IF NOT EXISTS`, así que volver a correrlo sobre una base ya
-- aplicada no hace nada y no falla.

ALTER TABLE "auth_sessions"
  ADD COLUMN IF NOT EXISTS "instalada_pwa" BOOLEAN;

-- docs/sql/scrum-340-verificar.sql — SCRUM-340 · la comprobación, APARTE del DDL
--
-- Va en su propio fichero por la lección de SCRUM-650: el clasificador del aplicador rechaza un
-- `SELECT` dentro de un fichero de DDL, así que mezclarlos deja el `ALTER` sin poder ejecutarse.
--
-- 🔴 LA ① SE CORRE **ANTES** DE APLICAR EL ALTER. Las demás, después.
-- Sólo lectura: ni una escritura en todo el fichero.

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- ① ANTES DEL ALTER · ¿es cierta la premisa del relleno NULL?
--
-- El relleno inicial es NULL para todas las filas, y eso se apoya en una afirmación medible:
-- **nadie ha comprado jamás plaza de fundador**. Esto la comprueba contra la base de verdad en
-- vez de darla por buena.
--
-- 🔴 SI DEVUELVE UNA SOLA FILA, **NO SE APLICA EL ALTER**: hay que decidir el backfill primero.
-- Un NULL sobre una fila que sí compró sería borrar una compra en silencio.
SELECT
  id,
  email,
  plan,
  subscription_status,
  stripe_subscription_id,
  lifecycle_emails_sent
FROM merchants
WHERE plan = 'founding'
   OR subscription_status IN ('active', 'past_due')
   OR (lifecycle_emails_sent ? 'firstPayment')
ORDER BY id;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- ② DESPUÉS DEL ALTER · ¿existe la columna, y con la forma pactada?
--
-- Se espera EXACTAMENTE: is_nullable = YES · column_default = NULL · datetime_precision = 3.
-- Un `NOT NULL` o un default aquí convertirían a todos los merchants históricos en fundadores.
SELECT
  column_name,
  data_type,
  datetime_precision,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'merchants'
  AND column_name = 'founding_purchased_at';

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- ③ DESPUÉS DEL ALTER · el relleno es NULL en TODAS las filas
--
-- Se espera: total = el número de merchants · con_fecha = 0 · sin_fecha = total.
-- Si `con_fecha` > 0 justo después de aplicar, el ALTER llevaba un default que no debía.
SELECT
  count(*)                                        AS total,
  count(founding_purchased_at)                    AS con_fecha,
  count(*) - count(founding_purchased_at)         AS sin_fecha
FROM merchants;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- ④ DESPUÉS DEL ALTER · el contador que la landing publicará
--
-- Es la regla entera, escrita en SQL para poder contrastarla con lo que devuelva el endpoint:
-- ocupa plaza quien tiene `founding_purchased_at` NOT NULL. Y punto — ni el plan ni el estado
-- entran, porque cancelar no libera y `past_due` tampoco.
--
-- Se espera hoy: ocupadas = 0 · quedan = 20.
SELECT
  count(founding_purchased_at)                          AS ocupadas,
  20 - count(founding_purchased_at)                     AS quedan,
  count(*) FILTER (WHERE subscription_status = 'active') AS activas_de_cualquier_plan
FROM merchants;
-- ⚠️ `activas_de_cualquier_plan` va al lado A PROPÓSITO y NO se usa para contar: es el número que
-- el criterio anterior habría publicado. Si algún día difiere de `ocupadas`, ahí está, a la vista,
-- la diferencia entre «compró la plaza» y «está pagando algo» — que es el defecto que esto cierra.

-- docs/sql/scrum-340-verificar.sql — SCRUM-340 · la comprobación, APARTE del DDL
--
-- Va en su propio fichero por la lección de SCRUM-650: el clasificador del aplicador rechaza un
-- `SELECT` dentro de un fichero de DDL, así que mezclarlos deja el `ALTER` sin poder ejecutarse.
--
-- ORDEN: ⓪ y ① se corren **ANTES** del ALTER. ②, ③ y ④, después.
-- Sólo lectura: ni una escritura en todo el fichero.

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ⓪ EL SUELO DEL PROPIO GUION · se corre LA PRIMERA y no depende de ningún nombre de columna
--
-- 🔴 POR QUÉ EXISTE: las consultas de abajo escriben nombres físicos —`subscription_status`,
-- `lifecycle_emails_sent`…— y **un guion que da por buenos sus propios nombres es un instrumento
-- que no se ha probado a sí mismo**. Esto los pone a la vista ANTES, leyéndolos de la base.
--
-- Lo único que da por sabido es el nombre de la TABLA, y ése está medido en dos fuentes:
-- `@@map("merchants")` en `prisma/schema.prisma` y 61 filas `('merchants', …)` en
-- `docs/sql/deriva-prod.sql`, que se escribió contra la base real.
--
-- 🔴 SE PARA SI: no devuelve filas (la tabla no se llama así aquí), o si en la lista NO aparecen
-- los seis nombres que usa ①: `id`, `email`, `plan`, `subscription_status`,
-- `stripe_subscription_id`, `lifecycle_emails_sent`.
--
-- ⚠️ Y MIRA EL `data_type` DE `lifecycle_emails_sent`. Se espera `jsonb` (Prisma mapea `Json` a
-- jsonb en postgres y no hay ningún `@db.Json` en el esquema), pero eso es una DERIVACIÓN del
-- esquema, no una lectura de la base. La consulta ① está escrita para no depender de ello —usa
-- `->`, que existe en `json` y en `jsonb`— así que si sale `json` no hay que reescribir nada; el
-- dato se pide para saberlo, no para decidir.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'merchants'
ORDER BY ordinal_position;

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ① ANTES DEL ALTER · ¿es cierta la premisa del relleno NULL?
--
-- El relleno inicial es NULL para todas las filas, y eso se apoya en una afirmación medible:
-- **nadie ha comprado jamás plaza de fundador**. Esto la comprueba contra la base de verdad en
-- vez de darla por buena.
--
-- 🔴 SI DEVUELVE UNA SOLA FILA, **NO SE APLICA EL ALTER**: hay que decidir el backfill primero.
-- Un NULL sobre una fila que sí compró sería borrar una compra en silencio.
--
-- ⚠️ `->` Y NO `?`: el operador `?` SÓLO existe para `jsonb`, y el tipo real de la columna no se
-- ha leído (ver ⓪). `->` funciona en `json` y en `jsonb`, así que esta consulta vale con los dos
-- y no hay que saber cuál es antes de correrla. `IS NOT NULL` sobre `->` es «la clave existe».
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
   OR (lifecycle_emails_sent -> 'firstPayment') IS NOT NULL
ORDER BY id;

-- ═════════════════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ③ DESPUÉS DEL ALTER · el relleno es NULL en TODAS las filas
--
-- Se espera: con_fecha = 0 · sin_fecha = total.
-- Si `con_fecha` > 0 justo después de aplicar, el ALTER llevaba un default que no debía.
SELECT
  count(*)                                AS total,
  count(founding_purchased_at)            AS con_fecha,
  count(*) - count(founding_purchased_at) AS sin_fecha
FROM merchants;

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ④ DESPUÉS DEL ALTER · el contador que la landing publicará
--
-- Es la regla entera, escrita en SQL para poder contrastarla con lo que devuelva el endpoint:
-- ocupa plaza quien tiene `founding_purchased_at` NOT NULL. Y punto — ni el plan ni el estado
-- entran, porque cancelar no libera y `past_due` tampoco.
--
-- ⚠️ EL TOTAL DE PLAZAS NO SE CABLEA AQUÍ, y antes sí estaba: había un `20` escrito a mano, y un
-- número cableado dentro de una verificación **caduca en silencio** — el día que la oferta pase a
-- 30 plazas, esta consulta seguiría restando 20 y nadie se enteraría.
-- El total vive en UN sitio: `FOUNDING_SEATS` (`src/modules/billing/domain/founding.ts:27`, hoy
-- 20). Aquí sólo se cuentan las ocupadas; las que quedan se restan al leer, contra ese valor.
SELECT
  count(founding_purchased_at)                           AS ocupadas,
  count(*) FILTER (WHERE subscription_status = 'active')  AS activas_de_cualquier_plan
FROM merchants;
-- ⚠️ `activas_de_cualquier_plan` va al lado A PROPÓSITO y NO se usa para contar: es el número que
-- el criterio anterior habría publicado. Si algún día difiere de `ocupadas`, ahí está, a la vista,
-- la diferencia entre «compró la plaza» y «está pagando algo» — que es el defecto que esto cierra.

-- SCRUM-205 · BACKFILL de `invoices.vf_estado` — SE EJECUTA EN LA MISMA VENTANA QUE EL db push.
--
-- 🚨 POR QUÉ NO ES OPCIONAL: la columna entra con
--       DEFAULT 'pendiente_de_sellado'
--    y ese default cae sobre TODAS las filas que ya existen. Sin este backfill, cada factura
--    ya sellada quedaría marcada como pendiente, y la regla nueva —«pendiente de sellado ⇒ ni
--    PDF ni QR»— dejaría de servir el PDF de facturas correctas y ya entregadas.
--
--    El default es el correcto para las filas NUEVAS (fail-closed: lo que nadie fija queda
--    visible y sin PDF). Es exactamente el equivocado para las VIEJAS. Por eso van juntos.
--
-- ORDEN: primero el `ALTER TABLE` del db push, después esto, antes de desplegar el código.
--        Entre los dos pasos, ninguna factura antigua sirve PDF. Ventana corta y de noche.
--
-- IDEMPOTENTE: se puede reejecutar sin efecto. Cada UPDATE fija un valor final, no incrementa
--              nada, y no hay INSERTs. Y va en BEGIN/COMMIT: si algo falla, no se aplica NADA.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 🔴 INCIDENTE (30-jul-2026), y por eso este fichero empieza con una comprobación
--
-- La primera versión murió en staging con:
--
--     Error: column i.merchant_id does not exist
--
-- Causa: escribí los nombres de columna SUPONIENDO snake_case en todas. Es falso. Prisma solo
-- renombra la columna cuando el campo lleva `@map`; si no lo lleva, la columna se llama
-- EXACTAMENTE como el campo, en camelCase, y en PostgreSQL eso exige comillas dobles o el
-- identificador se pasa a minúsculas y no existe.
--
-- Los nombres físicos, DERIVADOS del schema y no supuestos:
--
--     CAMPO PRISMA          @map          COLUMNA FÍSICA     COMILLAS
--     Invoice.merchantId    (ninguno)     merchantId         SÍ  ← el que falló
--     Invoice.createdAt     (ninguno)     createdAt          SÍ  ← el SIGUIENTE que habría fallado
--     Invoice.number        (ninguno)     number             no
--     Invoice.vfHash        vf_hash       vf_hash            no
--     Invoice.vfEstado      vf_estado     vf_estado          no
--     Merchant.id           (ninguno)     id                 no
--     Merchant.country      (ninguno)     country            no
--     Merchant.taxId        tax_id        tax_id             no
--
-- 7 columnas distintas, 2 estaban mal, y las 2 son justo las que NO llevan `@map`.
--
-- La comprobación de abajo existe porque el fallo original solo nombraba UNA columna: al
-- arreglar esa, habría muerto en la siguiente, y así de una en una. Ahora las dice todas de
-- golpe y antes de tocar ninguna fila.

BEGIN;

-- ── 0) SUELO: las columnas que este fichero necesita, comprobadas ANTES de tocar nada ──────
DO $guard$
DECLARE
  faltan text;
BEGIN
  SELECT string_agg(x.t || '.' || x.c, ', ' ORDER BY x.t, x.c)
    INTO faltan
    FROM (VALUES
      ('invoices',  'merchantId'),
      ('invoices',  'number'),
      ('invoices',  'vf_hash'),
      ('invoices',  'vf_estado'),
      ('invoices',  'createdAt'),
      ('merchants', 'id'),
      ('merchants', 'country'),
      ('merchants', 'tax_id')
    ) AS x(t, c)
   WHERE NOT EXISTS (
     SELECT 1
       FROM information_schema.columns ic
      WHERE ic.table_schema = current_schema()
        AND ic.table_name   = x.t
        AND ic.column_name  = x.c
   );

  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION
      'BACKFILL SCRUM-205 ABORTADO. Faltan estas columnas: %. No se ha aplicado nada. Si la unica que falta es invoices.vf_estado, el ALTER TABLE todavia no se ha hecho: ese es el paso 1 del runbook.',
      faltan;
  END IF;
END
$guard$;

-- ── 1) Las que YA tienen huella están selladas, por definición: la huella es el hecho ──────
UPDATE "invoices"
   SET "vf_estado" = 'sellado'
 WHERE "vf_hash" IS NOT NULL;

-- ── 2) Las que NUNCA entran en la cadena ───────────────────────────────────────────────────
--    · justificantes de cobro (`J-…`, V0-0 / regla 26) — no son facturas;
--    · merchants que no son de España, o sin NIF configurado: VeriFactu no les aplica.
--    Se marcan `no_aplica` para que no se confundan con una emisión a medias.
UPDATE "invoices" i
   SET "vf_estado" = 'no_aplica'
  FROM "merchants" m
 WHERE m."id" = i."merchantId"
   AND i."vf_hash" IS NULL
   AND (
        i."number" LIKE 'J-%'
     OR m."country" IS DISTINCT FROM 'ES'
     OR m."tax_id" IS NULL
     OR m."tax_id" = ''
   );

-- ── 3) Lo que quede en 'pendiente_de_sellado' es REAL y hay que mirarlo ────────────────────
--    Son facturas fiscales con número consumido y sin huella — exactamente las «facturas
--    fantasma» que este ticket viene a hacer visibles. NO se tocan aquí: se listan para
--    decidir qué hacer con cada una.
--    (Con INVOICING_ES_ENABLED en OFF desde siempre, lo esperable es que salgan CERO fuera del
--    merchant demo. Si salen más, es un hallazgo, no ruido.)
--
--    ⚠️ `prisma db execute` NO devuelve filas: reporta éxito o fallo. Este SELECT no imprimirá
--    nada por ese camino. La lista se obtiene con la consulta de verificación del runbook.
SELECT i."merchantId",
       i."number",
       i."createdAt",
       i."vf_estado"
  FROM "invoices" i
 WHERE i."vf_estado" = 'pendiente_de_sellado'
 ORDER BY i."merchantId", i."createdAt";

COMMIT;

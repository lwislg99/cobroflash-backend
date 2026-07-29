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
-- IDEMPOTENTE: se puede reejecutar sin efecto. Cada UPDATE fija un valor final.

BEGIN;

-- 1) Las que YA tienen huella están selladas, por definición: la huella es el hecho.
UPDATE "invoices"
   SET "vf_estado" = 'sellado'
 WHERE "vf_hash" IS NOT NULL;

-- 2) Las que NUNCA entran en la cadena:
--    · justificantes de cobro (`J-…`, V0-0 / regla 26) — no son facturas;
--    · merchants que no son de España, o sin NIF configurado: VeriFactu no les aplica.
--    Se marcan `no_aplica` para que no se confundan con una emisión a medias.
UPDATE "invoices" i
   SET "vf_estado" = 'no_aplica'
  FROM "merchants" m
 WHERE m."id" = i."merchant_id"
   AND i."vf_hash" IS NULL
   AND (
        i."number" LIKE 'J-%'
     OR m."country" IS DISTINCT FROM 'ES'
     OR m."tax_id" IS NULL
     OR m."tax_id" = ''
   );

-- 3) Lo que quede en 'pendiente_de_sellado' es REAL y hay que mirarlo: son facturas fiscales
--    con número consumido y sin huella — exactamente las «facturas fantasma» que este ticket
--    viene a hacer visibles. NO se tocan aquí: se listan para decidir qué hacer con cada una.
--    (Con INVOICING_ES_ENABLED en OFF desde siempre, lo esperable es que salgan CERO fuera del
--    merchant demo. Si salen más, es un hallazgo, no un ruido.)
SELECT i."merchant_id",
       i."number",
       i."created_at",
       i."vf_estado"
  FROM "invoices" i
 WHERE i."vf_estado" = 'pendiente_de_sellado'
 ORDER BY i."merchant_id", i."created_at";

COMMIT;

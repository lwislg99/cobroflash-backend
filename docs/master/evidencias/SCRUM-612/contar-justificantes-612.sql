-- docs/master/evidencias/SCRUM-612/contar-justificantes-612.sql — SCRUM-612 (E-4) · jv-j1, 18-sep-2026
--
-- ¿QUEDA ALGÚN JUSTIFICANTE EMITIDO EN ESTA BASE? Y ¿QUEDA SU RASTRO?
--
-- SOLO LECTURA. Autocontenido: se pega ENTERO en la consola de Postgres de la base que sea
-- (Railway → base → Query), igual que `docs/sql/deriva-prod.sql`. Sin credenciales en ninguna
-- parte. Para PRODUCCIÓN lo pega un jefe: ninguna sesión toca producción.
--
-- Cada bloque dice su POBLACIÓN. Si `facturas_total` sale 0, los ceros de abajo NO dicen «no hay
-- justificantes»: dicen que esta base no tiene facturas de ningún tipo, y eso es otra respuesta.

-- ① Dónde se ha medido. Sin esto, el resultado no se puede atribuir a una base.
SELECT current_database() AS base, now() AS medido_en;

-- ② POBLACIÓN Y CONTROL: cuántas filas hay en las tablas que se van a contar.
SELECT (SELECT count(*) FROM invoices)        AS facturas_total,
       (SELECT count(*) FROM charges)         AS cobros_total,
       (SELECT count(*) FROM merchants)       AS merchants_total,
       (SELECT count(*) FROM audit_log)       AS auditoria_total,
       (SELECT count(*) FROM email_messages)  AS correos_total;

-- ③ LOS DOCUMENTOS: por tipo guardado y por forma del número (dos sondas independientes).
SELECT count(*) FILTER (WHERE type = 'JUST')      AS tipo_just,
       count(*) FILTER (WHERE number LIKE 'J-%')  AS numero_j,
       count(*) FILTER (WHERE type = 'F1')        AS tipo_f1,
       count(*) FILTER (WHERE type = 'R1')        AS tipo_r1,
       count(*) FILTER (WHERE type NOT IN ('JUST', 'F1', 'R1')) AS tipo_otro
FROM invoices;

-- ④ Los justificantes que haya, por merchant (sólo ids y recuentos: ningún dato personal).
SELECT "merchantId" AS merchant_id,
       count(*) FILTER (WHERE type = 'JUST' OR number LIKE 'J-%') AS justificantes,
       count(*) AS documentos_del_merchant,
       min("createdAt") AS primero, max("createdAt") AS ultimo
FROM invoices
GROUP BY "merchantId"
HAVING count(*) FILTER (WHERE type = 'JUST' OR number LIKE 'J-%') > 0
ORDER BY 1;

-- ⑤ EL RASTRO que la fase 1 de SCRUM-825 decidió NO borrar (no son documentos: son el registro de
--    que existieron). Valores guardados, leídos del código: `invoiceNumber.service.ts`
--    (meta.tipoFactura / meta.esJustificante), `registroDeEnvios.ts` (kind 'justificante') e
--    `invoiceWhatsApp.service.ts` (concepto «Justificante …» del cobro).
SELECT (SELECT count(*) FROM audit_log
          WHERE meta->>'tipoFactura' = 'JUST' OR meta->>'esJustificante' = 'true') AS auditoria_con_just,
       (SELECT count(*) FROM email_messages WHERE kind = 'justificante')         AS correos_justificante,
       (SELECT count(*) FROM charges WHERE concepto LIKE 'Justificante %')        AS cobros_concepto_justificante;

-- ⑥ ¿ALGÚN MERCHANT TIENE EL FLAG FORZADO? El valor por defecto es OFF, pero `merchants.flags`
--    lo pisa (precedencia merchant > país > entorno > defecto, `src/core/flags.ts`).
SELECT id AS merchant_id, flags->>'INVOICING_ES_ENABLED' AS invoicing_es, flags->>'SIF_ENABLED' AS sif
FROM merchants
WHERE flags ? 'INVOICING_ES_ENABLED' OR flags ? 'SIF_ENABLED'
ORDER BY 1;

-- ⑦ Con qué flag se pidió cada número (el sobre fiscal lo guarda en cada emisión, SCRUM-207).
SELECT meta->'flagsFiscales'->>'INVOICING_ES_ENABLED' AS invoicing_es_al_emitir,
       meta->>'tipoFactura' AS tipo_pedido,
       count(*) AS emisiones
FROM audit_log
WHERE meta ? 'flagsFiscales' AND meta ? 'tipoFactura'
GROUP BY 1, 2
ORDER BY 1, 2;

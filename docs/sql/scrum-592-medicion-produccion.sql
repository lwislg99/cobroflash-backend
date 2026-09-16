-- docs/sql/scrum-592-medicion-produccion.sql — SCRUM-592 (DOC-02)
--
-- 🔴 SÓLO LECTURA. Ni un INSERT, ni un UPDATE, ni un ALTER. La corre EL FUNDADOR contra
-- producción; esta sesión no ha abierto esa base ni ha nombrado ninguna credencial.
--
-- QUÉ CONTESTA, y por qué hace falta antes de decidir:
-- Renumerar reescribe un dato que el cliente ya vio. En dev y staging da igual —son datos de
-- prueba— pero en producción hay que saber DOS cosas antes:
--   ① cuántos presupuestos hay, y
--   ② cuántos SE ENVIARON a un cliente de verdad.
-- Si salen borradores o cero, se renumera igual. Si hay enviados a clientes reales, la decisión
-- vuelve a los dos fundadores.
--
-- 🔴 EL DAÑO POSIBLE ES DE BÚSQUEDA, NO DE ACCESO, y está medido: los enlaces del PDF van por
-- `id`, no por número (4 de 4 en `yaqu_dev_javier`). Ningún PDF deja de abrirse. Lo que puede
-- pasar es que el cliente diga «el #16» y el profesional no lo encuentre — reversible. Romper un
-- enlace no lo sería.

-- ① EL RECUENTO, por merchant y por estado. El SUELO va dentro: si `total` sale 0, eso NO es
--    «no hay que renumerar», es que no había nada que mirar, y hay que decirlo así.
SELECT
  q."merchantId",
  m.email                                              AS merchant_email,
  count(*)                                             AS total,
  count(*) FILTER (WHERE q.status = 'draft')           AS borradores,
  count(*) FILTER (WHERE q.status <> 'draft')          AS fuera_de_borrador,
  count(*) FILTER (WHERE q."pdfUrl" IS NOT NULL)        AS con_pdf_generado,
  min(q."createdAt")                                   AS primero,
  max(q."createdAt")                                   AS ultimo,
  min(q.quote_number)                                  AS num_min,
  max(q.quote_number)                                  AS num_max,
  count(DISTINCT q.quote_number)                       AS numeros_distintos
FROM quotes q
JOIN merchants m ON m.id = q."merchantId"
GROUP BY q."merchantId", m.email
ORDER BY total DESC;

-- ② LOS QUE LLEGARON A UN CLIENTE DE VERDAD. Es la pregunta que decide.
--    «Real» aquí = el email del merchant NO acaba en `@test.local` (el criterio de los censos de
--    esta casa) Y el presupuesto salió del borrador.
SELECT
  count(*)                                             AS enviados_a_cliente_real,
  count(*) FILTER (WHERE q."pdfUrl" IS NOT NULL)        AS de_ellos_con_pdf,
  count(DISTINCT q."merchantId")                        AS merchants_afectados
FROM quotes q
JOIN merchants m ON m.id = q."merchantId"
WHERE q.status <> 'draft'
  AND m.email NOT LIKE '%@test.local';

-- ③ LOS SALTOS, que son la víctima del ticket: cuántos números faltan en cada serie.
--    Si sale 0 en todas partes, la numeración ya era correlativa y este ticket sólo cambia el
--    formato — que también es información útil para decidir.
SELECT
  "merchantId",
  max(quote_number) - count(*)                         AS numeros_que_faltan,
  count(*)                                             AS documentos,
  max(quote_number)                                    AS numero_mas_alto
FROM quotes
WHERE quote_number IS NOT NULL
GROUP BY "merchantId"
HAVING max(quote_number) - count(*) <> 0
ORDER BY numeros_que_faltan DESC;

-- ④ Y LOS ALBARANES, que llevan su número como TEXTO y sí tienen índice único.
SELECT
  merchant_id,
  count(*)                                             AS total,
  count(*) FILTER (WHERE numero LIKE 'ALB-%')          AS formato_viejo,
  count(*) FILTER (WHERE numero ~ '^AB[0-9]{6,}$')     AS formato_nuevo,
  count(*) FILTER (WHERE pdf_url IS NOT NULL)          AS con_pdf_generado
FROM albaranes
GROUP BY merchant_id
ORDER BY total DESC;

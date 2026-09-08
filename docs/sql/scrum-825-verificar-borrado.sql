-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- SCRUM-825b · VERIFICACIÓN del borrado de documentos. SÓLO LEE.
--
-- 🔴 FICHERO APARTE A PROPÓSITO. El clasificador de `scripts/_aplicar-sql-dev.mjs` rechaza un
-- fichero de DDL que lleve `SELECT` dentro (lección de SCRUM-650): mezclar lo que MIDE con lo
-- que ESCRIBE es cómo una verificación acaba ejecutándose creyendo que no toca nada.
--
-- SE PASA **DOS VECES**: ANTES del borrado y DESPUÉS. Un «cero» sin el «antes» no distingue
-- «lo he borrado» de «aquí nunca hubo nada».
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ① EL RECUENTO POR MERCHANT, separando factura de justificante.
--    ANTES: enseña de quién es cada documento — es la comprobación de que el único merchant
--    ajeno (Tecnosel) sigue teniendo CERO. Si tuviera alguno, el borrado NO se ejecuta.
--    DESPUÉS: todo a cero.
SELECT m.id,
       m.name,
       m.email,
       count(*) FILTER (WHERE i.type =  'JUST')::int AS justificantes,
       count(*) FILTER (WHERE i.type <> 'JUST')::int AS facturas,
       count(i.id)::int                              AS total
  FROM merchants m
  LEFT JOIN invoices i ON i."merchantId" = m.id
 GROUP BY m.id, m.name, m.email
 ORDER BY total DESC, m.id;

-- ② EL TAMAÑO DE CADA TABLA DE DOCUMENTO. Después del borrado, las seis a cero.
SELECT 'invoices'                  AS tabla, count(*)::int AS filas FROM invoices
UNION ALL SELECT 'quotes',                   count(*)::int FROM quotes
UNION ALL SELECT 'albaranes',                count(*)::int FROM albaranes
UNION ALL SELECT 'partes_trabajo',           count(*)::int FROM partes_trabajo
UNION ALL SELECT 'albaran_lineas_facturadas', count(*)::int FROM albaran_lineas_facturadas
UNION ALL SELECT 'charges (NO se borra)',    count(*)::int FROM charges
 ORDER BY tabla;

-- ③ 🔴 LAS HUÉRFANAS — la comprobación que de verdad decide si el orden fue el correcto.
--    Estas cinco columnas NO tienen clave ajena, así que la base NO protesta si quedan
--    apuntando a documentos borrados. DESPUÉS del borrado, las cinco tienen que dar CERO.
SELECT 'albaran_lineas_facturadas.albaran_id' AS referencia, count(*)::int AS colgando
  FROM albaran_lineas_facturadas f WHERE NOT EXISTS (SELECT 1 FROM albaranes a WHERE a.id = f.albaran_id)
UNION ALL
SELECT 'albaran_lineas_facturadas.invoice_id', count(*)::int
  FROM albaran_lineas_facturadas f WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = f.invoice_id)
UNION ALL
SELECT 'albaranes.invoice_id', count(*)::int
  FROM albaranes a WHERE a.invoice_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = a.invoice_id)
UNION ALL
SELECT 'jobs.quote_id', count(*)::int
  FROM jobs j WHERE j.quote_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.id = j.quote_id)
UNION ALL
SELECT 'maintenance_plans.quote_id', count(*)::int
  FROM maintenance_plans p WHERE p.quote_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.id = p.quote_id)
 ORDER BY referencia;

-- ④ LOS CONTADORES DE SERIE. El borrado NO los toca: esto enseña dónde quedan, para que el
--    fundador vea con qué número emitiría el primer documento de verdad.
SELECT id,
       name,
       next_invoice_number      AS siguiente_factura,
       next_rect_invoice_number AS siguiente_rectificativa,
       next_quote_number        AS siguiente_presupuesto,
       next_albaran_number      AS siguiente_albaran,
       invoice_series_year      AS anio_serie_factura
  FROM merchants
 ORDER BY id;

-- ⑤ LAS REFERENCIAS POLIMÓRFICAS que quedan colgando y que este guion NO borra a propósito.
--    No es un fallo: es el rastro de lo que pasó. Se enseña para que la decisión de conservarlo
--    o no la tome el fundador con el número delante.
SELECT 'audit_log'          AS tabla, entity_type  AS tipo, count(*)::int AS filas
  FROM audit_log          WHERE entity_type  IN ('invoice', 'quote', 'albaran') GROUP BY entity_type
UNION ALL
SELECT 'whatsapp_messages', related_type, count(*)::int
  FROM whatsapp_messages  WHERE related_type IN ('invoice', 'quote') GROUP BY related_type
UNION ALL
SELECT 'email_messages',    related_type, count(*)::int
  FROM email_messages     WHERE related_type IN ('invoice', 'quote') GROUP BY related_type
 ORDER BY tabla, tipo;

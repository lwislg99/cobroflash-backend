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

-- ① 🔴 EL RECUENTO POR MERCHANT — Y ES LA COMPROBACIÓN QUE PUEDE PARAR EL BORRADO.
--
--    ANTES: enseña de quién es cada documento. Es la comprobación de que el único merchant que
--    NO es del fundador —Tecnosel, la madre de Luis— sigue teniendo CERO documentos.
--
--    🔴 SE PASA CONTRA **PRODUCCIÓN** Y **EL MISMO DÍA** en que se vaya a ejecutar el borrado.
--    La comprobación de ayer NO vale: entre ayer y hoy alguien ha podido emitir. Es un dato que
--    caduca, y darlo por bueno sería exactamente el error que esta casa lleva meses cazando.
--
--    ⛔ SI TECNOSEL TIENE AUNQUE SEA UN DOCUMENTO, EL BORRADO **NO SE EJECUTA** tal cual: hay
--    que acotarlo por merchant, y eso es otra decisión del fundador.
--
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

-- ② EL TAMAÑO DE CADA TABLA QUE EL GUION VACÍA. Después del borrado, TODAS a cero.
--    Los números de la pasada ANTES son los «recuentos esperados» que el guion cita al lado de
--    cada `DELETE`: si al ejecutar sale otro, algo se movió entre las dos pasadas — parar.
SELECT 'invoices'                   AS tabla, count(*)::int AS filas FROM invoices
UNION ALL SELECT 'quotes',                    count(*)::int FROM quotes
UNION ALL SELECT 'albaranes',                 count(*)::int FROM albaranes
UNION ALL SELECT 'partes_trabajo',            count(*)::int FROM partes_trabajo
UNION ALL SELECT 'albaran_lineas_facturadas', count(*)::int FROM albaran_lineas_facturadas
UNION ALL SELECT 'charges',                   count(*)::int FROM charges
UNION ALL SELECT 'events',                    count(*)::int FROM events
UNION ALL SELECT 'reconciliations',           count(*)::int FROM reconciliations
 ORDER BY tabla;

-- ②b LAS QUE **NO** SE BORRAN. Aquí el número tiene que ser EL MISMO antes y después: es el
--     control de que la limpieza no se ha llevado por delante lo que debía quedarse.
SELECT 'customers (se queda)'         AS tabla, count(*)::int AS filas FROM customers
UNION ALL SELECT 'audit_log (se queda)',        count(*)::int FROM audit_log
UNION ALL SELECT 'whatsapp_messages (se queda)', count(*)::int FROM whatsapp_messages
UNION ALL SELECT 'email_messages (se queda)',   count(*)::int FROM email_messages
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

-- ④ LOS CONTADORES DE SERIE. 🔴 EL GUION **SÍ** LOS REINICIA (decisión del fundador, 8-sep-2026).
--    ANTES: enseña dónde estaban — merchant #1 en dev iba por `next_invoice_number = 6` con 5
--    facturas, o sea que sin reiniciar la primera factura real habría salido `2026-FG-006`.
--    DESPUÉS: los cuatro contadores a **1** y los dos `*_series_year` a **NULL**, en TODOS los
--    merchants. Si alguno no está a 1, el `UPDATE` del bloque ⑨ no llegó a correr.
SELECT id,
       name,
       next_invoice_number      AS siguiente_factura,
       next_rect_invoice_number AS siguiente_rectificativa,
       next_quote_number        AS siguiente_presupuesto,
       next_albaran_number      AS siguiente_albaran,
       invoice_series_year      AS anio_serie_factura
  FROM merchants
 ORDER BY id;

-- ⑤ LAS REFERENCIAS POLIMÓRFICAS que quedan colgando. El guion NO las borra: decisión del
--    fundador (8-sep-2026), y el motivo es que son el registro de LO QUE PASÓ. Que apunten a
--    ids muertos está BIEN: son un LOG, no una relación.
--    Aquí el número tiene que ser EL MISMO antes y después. Se enseña para que quede constancia
--    de cuántas quedan apuntando a documentos que ya no existen — a propósito.
SELECT 'audit_log'          AS tabla, entity_type  AS tipo, count(*)::int AS filas
  FROM audit_log          WHERE entity_type  IN ('invoice', 'quote', 'albaran') GROUP BY entity_type
UNION ALL
SELECT 'whatsapp_messages', related_type, count(*)::int
  FROM whatsapp_messages  WHERE related_type IN ('invoice', 'quote') GROUP BY related_type
UNION ALL
SELECT 'email_messages',    related_type, count(*)::int
  FROM email_messages     WHERE related_type IN ('invoice', 'quote') GROUP BY related_type
 ORDER BY tabla, tipo;

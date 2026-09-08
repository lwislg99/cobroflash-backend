-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 LA COMPROBACIÓN QUE FALTA EN PRODUCCIÓN · el SUELO ASIMÉTRICO
--
-- La consulta de verificación del 2-sep pidió las tres columnas nuevas más dos de control, y
-- devolvió 5 filas. Correcto — pero NO preguntó por `albaranes.doc_footer_text`, y comprobar esa
-- AUSENCIA es lo único que separa «el pie del albarán se reutiliza» de una intención escrita en
-- un comentario. En las dos bases alcanzables está comprobado por un test; en producción no.
--
-- SOLO LEE. Se pega entera en la consola de Postgres de PRODUCCIÓN.
--
-- CÓMO SE INTERPRETA — y el orden importa, porque un cero puede significar dos cosas opuestas:
--
--   ✅ CORRECTO   → 5 filas, y NINGUNA dice `doc_footer_text` en la tabla `albaranes`:
--                   · albaranes.doc_header_text   (nueva)
--                   · albaranes.notas             (CONTROL POSITIVO)
--                   · quotes.doc_footer_text      (nueva)
--                   · quotes.doc_header_text      (nueva)
--                   · quotes.valid_until          (CONTROL POSITIVO)
--
--   🔴 HAY QUE PARAR → si aparece `albaranes | doc_footer_text`: existen DOS campos para el pie
--                      del albarán y al día siguiente nadie sabrá cuál manda.
--
--   ⚠️ NO SE PUDO COMPROBAR → si faltan las DOS de control (`albaranes.notas` y
--                      `quotes.valid_until`), la consulta NO estaba mirando esa base. Entonces la
--                      ausencia de `doc_footer_text` no prueba nada: no es «no está», es «no se
--                      vio nada». Un cero sin control positivo no es una medición.

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name = 'albaranes' AND column_name IN ('doc_header_text', 'doc_footer_text', 'notas'))
     OR (table_name = 'quotes'    AND column_name IN ('doc_header_text', 'doc_footer_text', 'valid_until')) )
ORDER BY table_name, column_name;

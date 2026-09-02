-- SCRUM-593 (DOC-03) · Los dos textos libres del documento: cabecera y pie.
--
-- ⚠️ NOMBRES DE LA BASE (snake_case), NO DEL MODELO. `quotes` MEZCLA convenciones y por eso el
-- `@map` del schema irá explícito: las columnas CON `@map` de esa tabla son snake_case
-- (`valid_until`, `doc_fields`, `internal_notes`, `quote_number`, `pay_methods`…) y las camelCase
-- son justamente las que NO lo llevan, donde Prisma conserva el nombre del campo. `albaranes` es
-- snake_case al 100 % (`lugar_entrega`, `firma_token`, `pdf_url`, `modo_valoracion`…).
--
-- 🔴 SON TRES COLUMNAS, NO CUATRO, Y EL ALBARÁN NO SE QUEDA CORTO. El pie del albarán ya existe:
-- es `albaranes.notas` (`String? @db.Text`) y YA SE IMPRIME. Lo único que cambia ahí es el rótulo
-- —de «Notas:» a «Observaciones»—, que es copy, no esquema. Crear un `doc_footer_text` en
-- `albaranes` daría dos campos para lo mismo y el día siguiente ya no se sabría cuál manda.
--
-- 🔴 Y LA FACTURA QUEDA FUERA A PROPÓSITO: `ensureInvoicePdf` (`src/lib/invoicing.ts`) REGENERA el
-- PDF cuando el fichero no está en disco, y el fs de Railway es efímero, así que lo regenera con
-- el código de hoy. Un bloque nuevo cambiaría el aspecto de facturas YA EMITIDAS en el siguiente
-- despliegue — regla 29. Está fichado como SCRUM-665 y no entra aquí.
--
-- SIN `NOT NULL` Y SIN `DEFAULT`. `null` es «el profesional no escribió nada», que NO es `''`;
-- el PDF sólo pinta el bloque cuando hay texto, así que un default vacío no aportaría nada y
-- sí destruiría la distinción.
--
-- ADITIVO Y RE-EJECUTABLE: las tres llevan `IF NOT EXISTS`, así que volver a correrlo sobre una
-- base ya aplicada no hace nada y no falla.
--
-- ⚠️ ORDEN: esto va ANTES de que `prisma/schema.prisma` nombre los campos. `schemaDrift.ts`
-- compara esperado ⊆ real al arrancar: una columna de MÁS en la base es inocua, una de MENOS
-- impide arrancar producción (SCRUM-220). Las tres bases primero; el esquema, el código y los
-- tests después y juntos.

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "doc_header_text" TEXT;

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "doc_footer_text" TEXT;

ALTER TABLE "albaranes"
  ADD COLUMN IF NOT EXISTS "doc_header_text" TEXT;

-- docs/sql/scrum-1216b-arranque-de-serie.sql — SCRUM-1216 (J1: arranque de la serie de facturas) · paso ② de A5
--
-- EL ARRANQUE DE SERIE que declara el profesional: en qué número y en qué año empieza su serie.
--
-- ── PROCEDENCIA, Y POR QUÉ ESTE FICHERO LLEGA TARDE ───────────────────────────────────────────
--   · El DDL lo redactó el orquestador del equipo de Javier y se lo pasó a Javier por chat. Javier
--     lo pegó a mano en STAGING y en PRODUCCIÓN el 28-sep-2026.
--   · Hasta este fichero, SÓLO existía en esa conversación y en un fichero del escritorio de
--     Javier: `git grep invoice_start_seq` en `origin/main` a59dc1e6 → 0 resultados. Es el mismo
--     hueco por el que existe SCRUM-1102 (un DDL aplicado en producción que una sesión buscó en el
--     repositorio y no encontró). Lo escribe J6 (jv-j6), que es quien lo aplicó en DEV.
--
-- ── EL DISEÑO: DOS COLUMNAS PROPIAS, NO REUTILIZAR LAS QUE HAY ────────────────────────────────
--   · NO `next_invoice_number`. Es el contador de la serie VIEJA y ya significa algo: en el
--     merchant 1 de dev vale 6 porque gastó `2026-FG-001..005` antes del corte, no porque nadie
--     declarara nada. Reutilizarlo le habría dado `F260006` a quien NO declaró su arranque. Las
--     columnas nuevas existen para que ese campo no tenga un tercer significado.
--   · NO `invoice_series_year`. `allocateInvoiceNumber` lo pisa con el año en curso cada vez que
--     numera (`src/modules/invoicing/domain/invoiceNumber.service.ts:534`), así que no puede guardar
--     un año DECLARADO. Por eso `invoice_start_year` es propia.
--
-- ── 🔴 NULL ≠ 1, Y ES LA RAZÓN DE QUE NO LLEVEN DEFAULT NI NOT NULL ───────────────────────────
--   `NULL` significa «el profesional no declaró nada», y entonces su primera factura es `F260001`.
--   Con `DEFAULT 1` o `NOT NULL`, el que no contestó y el que contestó «1» serían indistinguibles
--   para siempre. Y eso decide un número de factura, que por la regla 29 no se puede cambiar
--   después.
--
-- ── ESTADO POR BASE (detalle en `docs/MIGRATIONS_PENDING.md`) ──────────────────────────────────
--   · producción — la pegó Javier a mano (28-sep-2026).
--   · staging    — la pegó Javier a mano; el orquestador la verificó leyendo el catálogo (66
--                  columnas en `merchants`, las dos `integer`, nullable, sin default).
--   · dev        — aplicada por J6 con `scripts/aplicar-sql-dev.mjs --go` el 2026-09-28T15:00:43Z
--                  y verificada leyendo el catálogo: de 64 a 66 columnas, y `next_invoice_number`
--                  intacto.
--
-- Aditivo. Lleva `IF NOT EXISTS`, así que re-ejecutarlo no rompe nada.

ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "invoice_start_seq"  INTEGER,
  ADD COLUMN IF NOT EXISTS "invoice_start_year" INTEGER;

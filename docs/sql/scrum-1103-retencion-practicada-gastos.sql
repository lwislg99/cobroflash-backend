-- docs/sql/scrum-1103-retencion-practicada-gastos.sql — SCRUM-1103
--
-- RETENCIÓN IRPF PRACTICADA en gastos (facturas recibidas). Tres columnas aditivas y nullable
-- sobre `expenses`: el tipo de retención, la cuota retenida, y si ya se clasificó. NULL en las
-- tres = «nunca clasificado» (no «sin retención»). Detalle del diseño en
-- `docs/master/SCRUM-1103.md` §4.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🛑 ESTE FICHERO ES EL PASO ② DE LA MIGRACIÓN (regla 3 / A5)
--
--    ① decisión .................. hecha (Javier + asesor, SCRUM-1106: 111/115 dependen de la
--                                  retención que el profesional PRACTICA como pagador)
--    ② ALTER en LAS TRES bases ... producción y staging YA APLICADOS por Javier (23-sep-2026,
--                                  "Query ran successfully" en las dos) · dev, este fichero,
--                                  aplicado por J1 con `scripts/aplicar-sql-dev.mjs`
--    ③ UN SOLO PR ................ esquema + código + tests, DESPUÉS del ②, cuando las tres
--                                  bases tengan las columnas
-- ═════════════════════════════════════════════════════════════════════════════════════════
--
-- ── EL DDL NO ESTÁ ESCRITO A MANO ───────────────────────────────────────────────────────
-- Mismo texto, byte a byte, que Javier aplicó en producción y en staging (§5 de
-- `docs/master/SCRUM-1103.md`, generado offline con `preview-migracion.mjs`, método de
-- SCRUM-1107 SS6/SS7): no se reescribe para que las tres bases queden con el DDL idéntico.
--
-- ── POR QUÉ NULLABLE Y SIN DEFAULT, LAS TRES ────────────────────────────────────────────
-- Mismo patrón que `vatRate`/`vatAmount`/`vatDeducible`, ya en esta misma tabla: NULL = «nunca
-- clasificado», no cero. Un gasto puede legítimamente no llevar retención (una ferretería no la
-- lleva) y eso no puede leerse igual que «nadie lo miró» — por eso `retencion_practicada_declarada`
-- es un booleano NULLABLE de tres valores, no un `NOT NULL DEFAULT false`.
--
-- ── NOMBRE FÍSICO ───────────────────────────────────────────────────────────────────────
-- `retencion_practicada_*`, snake_case, la convención física de `expenses`.

ALTER TABLE "expenses" ADD COLUMN     "retencion_practicada_cuota" DECIMAL(12,2),
ADD COLUMN     "retencion_practicada_declarada" BOOLEAN,
ADD COLUMN     "retencion_practicada_tipo" INTEGER;


-- ═════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — se ejecuta DESPUÉS, y lleva CONTROL POSITIVO dentro
-- ═════════════════════════════════════════════════════════════════════════════════════════
--
-- `control_ve_el_catalogo` es el suelo: si sale 0, nada de lo demás significa nada — no sería
-- «falta todo», sería que la consulta no está mirando el esquema de la aplicación.
--
-- Lo esperado tras aplicar: control > 100, y las tres siguientes a 1.
--
--   SELECT
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public')                                              AS control_ve_el_catalogo,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='expenses'
--         AND column_name='retencion_practicada_tipo')                            AS tipo,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='expenses'
--         AND column_name='retencion_practicada_cuota')                           AS cuota,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='expenses'
--         AND column_name='retencion_practicada_declarada')                       AS declarada;

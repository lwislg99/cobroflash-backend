-- docs/sql/scrum-1107-retencion-garantia-obra.sql — SCRUM-1107
--
-- RETENCIÓN DE GARANTÍA DE OBRA. Cuatro columnas aditivas y nullable sobre `charges`: cuánto se
-- retiene, con qué porcentaje, cuándo se puede reclamar, y si ya se reclamó. NULL en las cuatro
-- = sin garantía retenida en ese cobro. Detalle del diseño en `docs/master/SCRUM-1107.md`.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🛑 ESTE FICHERO ES EL PASO ② DE LA MIGRACIÓN (regla 3 / A5)
--
--    ① decisión .................. hecha (Javier, 23-sep-2026, con el asesor: no es fiscal)
--    ② ALTER en LAS TRES bases ... producción y staging YA APLICADOS por Javier (23-sep-2026,
--                                  "Query ran successfully" en las dos) · dev, este fichero,
--                                  aplicado por J2 con `scripts/aplicar-sql-dev.mjs`
--    ③ UN SOLO PR ................ esquema + código + tests, DESPUÉS del ②, cuando las tres
--                                  bases tengan las columnas
-- ═════════════════════════════════════════════════════════════════════════════════════════
--
-- ── EL DDL NO ESTÁ ESCRITO A MANO ───────────────────────────────────────────────────────
-- Emitido por `node scripts/preview-migracion.mjs --desde <viejo.prisma>` (modo offline, sin
-- tocar ninguna base), comparando el schema de `origin/main` contra una copia temporal CON las
-- cuatro columnas — ninguna de las dos quedó en el árbol. Es el MISMO texto que Javier aplicó en
-- producción y en staging: no se reescribe para que las tres bases queden con el DDL idéntico.
--
-- ── POR QUÉ NULLABLE Y SIN DEFAULT, LAS CUATRO ──────────────────────────────────────────
-- Un cobro que ya existe hoy no tiene garantía retenida declarada por nadie — un `@default`
-- convertiría todos los cobros anteriores en «con retención» sin que nadie lo haya dicho. Y
-- `retencion_garantia_cobrada` en concreto es el marcador del aviso: NULL = pendiente de
-- reclamar (el aviso sigue vivo), con fecha = resuelto. El importe REAL cobrado en la liberación
-- (si difiere del retenido) no vive aquí: vive en el `amount` del `Charge` NUEVO que registre esa
-- liberación — un solo generador de «cuánto se cobró», el mismo principio de SCRUM-397.
--
-- ── NOMBRE FÍSICO ───────────────────────────────────────────────────────────────────────
-- `retencion_garantia_*`, snake_case, la convención física de `charges` (`paid_via`, `paid_at`,
-- `receipt_token`…).

ALTER TABLE "charges" ADD COLUMN     "retencion_garantia_cobrada" TIMESTAMP(3),
ADD COLUMN     "retencion_garantia_importe" DECIMAL(12,2),
ADD COLUMN     "retencion_garantia_liberacion" TIMESTAMP(3),
ADD COLUMN     "retencion_garantia_porcentaje" DECIMAL(5,2);

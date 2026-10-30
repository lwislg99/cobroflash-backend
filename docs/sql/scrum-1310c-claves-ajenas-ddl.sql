-- docs/sql/scrum-1310c-claves-ajenas-ddl.sql — SCRUM-1310c (24-oct-2026)
--
-- EL DDL DE LAS 13 CLAVES AJENAS QUE SOLO VIVÍAN EN LA BASE.
-- Decisión del fundador: SCRUM-1310 c.20776 («Sí, solo las 13»). Medición del hueco: c.20753.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ⛔ NO SE EJECUTA CONTRA NINGUNA BASE. Es DOCUMENTACIÓN de lo que YA EXISTE en producción.
--
--   · Las 13 restricciones ya están en producción (c.20810): ejecutarlo fallaría con «already
--     exists», y en dev y staging no hay nada que añadir que no esté (dev: c.20807).
--   · El aplicador lo RECHAZA: `scripts/_clasificador-sql.mjs` rechaza las 13 sentencias. Lo
--     comprueba `tests/scrum1310b-claves-ajenas-con-ddl.test.mjs`. (Hoy las rechaza como «acción
--     no reconocida» por el prefijo `"public".`, antes de su rama de `ADD CONSTRAINT`, SCRUM-1214.)
--   · No es un paso de A5: no hay ALTER pendiente, ni `db push`, ni cambio de `schema.prisma`.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- DE DÓNDE SALE CADA PARTE DE CADA SENTENCIA
--
--   · NOMBRE de la restricción, ON DELETE y ON UPDATE → PRODUCCIÓN. La consulta de solo lectura
--     `docs/sql/scrum-1310b-claves-ajenas-sin-ddl-consulta.sql`, corrida por Javier en Railway el
--     24-oct-2026 (SCRUM-1310 c.20810). NO salen de la regla implícita de Prisma ni de dev, aunque
--     coincidan con las dos.
--   · TABLA y COLUMNA de la clave → `prisma/schema.prisma`: `@@map` del modelo y `@map` del campo
--     de `@relation(fields:)`.
--   · TABLA y COLUMNA REFERENCIADAS → `prisma/schema.prisma`: `@@map` del modelo al que apunta la
--     relación y `@map` de los campos de `@relation(references:)`. Leídas por programa
--     (`ddlDeClave` en el test). Segundo testigo: casan byte a byte con la columna `ddl` que la
--     misma consulta sacó del catálogo de DEV (`docs/master/evidencias/SCRUM-1310/consulta-1310b-dev.txt`).
--     En producción esta parte NO se vio: las capturas cortaron `ddl` y `pg_def` (c.20810).
--   · FORMA (`ALTER TABLE "public".… ADD CONSTRAINT … ON UPDATE …;`, esquema `"public"`) → la de
--     las migraciones congeladas. Control: el mismo generador escribe `quotes_chargeId_fkey` y sale
--     IDÉNTICO, byte a byte, a `docs/historico/prisma-migrations-frozen-2026-03/
--     20251104175333_add_quote_model/migration.sql:26`. Lo comprueba el test.
--
-- LO QUE NO SE VIO, Y QUEDA DICHO: el veredicto «CONTROL IDÉNTICO AL FICHERO» de la fila 0 en
-- producción, y si `pg_def` trae algo que este DDL no tiene (`DEFERRABLE`, `NOT VALID`,
-- `MATCH FULL`). Las columnas visibles del control casan con su fichero (c.20810).
--
-- ALCANCE (c.20776): solo estas 13 claves ajenas. NO entran los `CREATE TABLE` que faltan, ni
-- índices, ni tipos. Las 13 siguen el orden de la consulta de 1310b (filas 1–13).
-- ═════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_rectifies_id_fkey" FOREIGN KEY ("rectifies_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."quote_requests" ADD CONSTRAINT "quote_requests_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quote_requests" ADD CONSTRAINT "quote_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."quote_templates" ADD CONSTRAINT "quote_templates_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."team_members" ADD CONSTRAINT "team_members_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."customer_events" ADD CONSTRAINT "customer_events_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."customer_events" ADD CONSTRAINT "customer_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

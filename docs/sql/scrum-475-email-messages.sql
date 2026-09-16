-- SCRUM-475 (fase 2) · `email_messages` — la tabla donde consta qué pasó con cada correo.
--
-- PROCEDENCIA: el modelo lo escribió la sesión de SCRUM-475 y está en `docs/master/SCRUM-475.md`
-- §4, copiado aquí SIN REDISEÑAR. Este SQL **no está escrito a mano**: lo generó
-- `prisma migrate diff` a través de `scripts/preview-migracion.mjs` (CLI local por ruta, nunca
-- `npx`, y con su CONTROL POSITIVO delante — 24 CREATE TABLE del esquema entero contra vacío).
-- `prisma/schema.prisma` NO se ha tocado: el diff se hizo contra una copia temporal que se retiró.
--
-- ⚠️ NOMBRES DE LA BASE (snake_case), NO DEL MODELO. Salen de los `@@map`/`@map`, y los de los
-- índices son los que Prisma DERIVA. No se «corrigen»: así se aplican a las tres bases.
--
-- 100 % ADITIVO, COMPROBADO sobre el SQL generado y no prometido: 1 `CREATE TABLE`, 3 índices,
-- CERO columnas tocadas, CERO `NOT NULL` sobre datos existentes, y no aparece ninguna de
-- DROP · ALTER COLUMN · SET NOT NULL · TRUNCATE · DELETE · RENAME. No toca ninguna otra tabla.
-- Si al aplicarlo algo pidiera `--accept-data-loss`, EL DIFF NO ES ÉSTE: hay que parar.
--
-- 🔴 LO ÚNICO AÑADIDO A LA SALIDA DE LA HERRAMIENTA SON LOS `IF NOT EXISTS`, y es la convención
-- de la casa (`scrum-425-clave-idempotencia.sql`, `scrum-449-instalada-pwa.sql`): el fundador
-- aplica esto a mano a staging y a producción, y un fichero re-ejecutable no rompe si se corre
-- dos veces. La ESTRUCTURA —columnas, tipos, defaults, nombres de índice— es la de la
-- herramienta, carácter a carácter.
--
-- SIN BACKFILL: los correos ya enviados no tienen fila y **no se les inventa una**. De ellos no
-- consta nada, que es la verdad. El `@unique` de `provider_id` es lo que permitirá que el
-- webhook del proveedor encuentre su fila.
--
-- ORDEN DE APLICACIÓN: dev ✅ → staging → producción.
--
-- 🔴 DISCRIMINADOR ANTES DE APLICAR: `SELECT current_database()` devuelve `railway` en staging
-- Y en producción, así que NO las separa. Lo que sí: la CUENTA DE `invoices` —
-- dev 0 · staging 7 · producción 55. Si el número no es el que esperas, estás en otra base.
--   ⚠️ El **0 de dev lo he medido yo** (11-ago-2026). Los de staging y producción salen de
--   `docs/MIGRATIONS_PENDING.md`, medidos el 7-ago-2026: son estado y caducan.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ⬆️ EL BLOQUE DE ARRIBA ESTÁ SUPERADO · medido el 7-ago-2026, caducado el 12-ago-2026
--
-- No se borra: era cierto cuando se escribió, y borrar una medición vieja deja al siguiente sin
-- saber que el número se movió. Se marca y se fecha. **Los números de arriba NO se usen**: para
-- eso están los de abajo.
--
-- 🔴 DISCRIMINADOR MEDIDO HOY · 12-ago-2026 · `SELECT COUNT(*) FROM charges`
--
--        staging 3  ·  producción 51
--
-- Si el número no es el que esperas, ESTÁS EN OTRA BASE: para antes de aplicar nada.
--
-- ⚠️ Y LO QUE SE APRENDIÓ APLICÁNDOLO, QUE ES EL MOTIVO DE QUE HAGA FALTA UN NÚMERO:
--
--   **EL NOMBRE MIENTE EN LAS DOS CAPAS, Y EL NÚMERO NO.**
--     · `SELECT current_database()` devuelve `railway` en staging Y en producción.
--     · El ENTORNO de Railway se llama «production» en las DOS.
--   Dos capas distintas, las dos con el mismo nombre para bases distintas. Quien se guíe por el
--   nombre creerá estar en staging estando en producción. La cuenta de filas es lo único que las
--   separa, y por eso va DELANTE de cualquier DDL.
--
-- ⚠️ El `invoices` del bloque viejo sigue dando 7 en staging (comprobado hoy con
-- `scripts/verificar-email-messages.mjs`), así que no estaba equivocado: estaba SIN COMPROBAR, que
-- no es lo mismo. El de producción (55) no se ha vuelto a medir aquí — no hay credencial de
-- producción en este árbol, ni se pide.
--
-- VERIFICACIÓN (una consulta, una fila, con control positivo dentro):
--   node scripts/verificar-email-messages.mjs --clave DATABASE_URL_STAGING
-- La URL nunca va en `argv`: se pasa el NOMBRE de la variable.

CREATE TABLE IF NOT EXISTS "email_messages" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "kind" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "provider_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aceptado_sin_identificador',
    "error" TEXT,
    "related_type" TEXT,
    "related_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_provider_id_key" ON "email_messages"("provider_id");

CREATE INDEX IF NOT EXISTS "email_messages_merchant_id_created_at_idx" ON "email_messages"("merchant_id", "created_at");

CREATE INDEX IF NOT EXISTS "email_messages_related_type_related_id_idx" ON "email_messages"("related_type", "related_id");

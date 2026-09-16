-- docs/sql/scrum-674-aditivo.sql — SCRUM-674, aplicado A MANO (no por `db push`).
--
-- QUÉ APLICA: cinco columnas nuevas (jobs, merchants, quotes ×3) y la tabla `partes_trabajo`
--             con sus dos índices. Nada más.
-- EN QUÉ ORDEN: dev  →  staging  →  producción. Verificando el resultado antes de pasar a la
--             siguiente; el bloque ⑤ de abajo es esa verificación.
-- NO CONTIENE NINGÚN BORRADO: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni ALTER … TYPE.
--             Todo es `ADD COLUMN` nullable o con DEFAULT, `CREATE TABLE` y `CREATE INDEX`.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ESTO VA A MANO Y NO POR `db push`
--
-- `prisma db push` reconcilia el esquema ENTERO. Producción va POR DELANTE de `main` en varias
-- columnas aplicadas a mano estos días, así que un push propondría BORRARLAS TODAS — medido el
-- 2-sep-2026: un preview real propuso `DROP TABLE job_assignees`, `DROP TABLE email_messages` y
-- ~30 columnas. No era un caso raro: es el comportamiento normal de un método equivocado.
--
-- El orden de la casa es ① decisión → ② ALTER en las TRES bases → ③ un solo PR con esquema +
-- código + tests. NUNCA ③ sin ②. Este fichero es el ② de SCRUM-674, cuyo ③ ya está en `main`.
--
-- ES IDEMPOTENTE: `IF NOT EXISTS` en todo lo que lo admite. Aplicarlo dos veces no rompe nada,
-- que es lo que hace falta para correrlo en tres bases sin llevar la cuenta a mano.
--
-- ⚠️ `ADD COLUMN IF NOT EXISTS` y `CREATE TABLE IF NOT EXISTS` existen en PostgreSQL desde 9.5 y
-- 9.1. Se usan a propósito en vez de un `DO $$ … $$` con `information_schema`: menos código que
-- pueda equivocarse, y el motor decide.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ── ① LAS CINCO COLUMNAS ─────────────────────────────────────────────────────────────────
--
-- Las cinco son NULLABLE salvo `quotes.revision`, que es NOT NULL **con DEFAULT 0**: sin el
-- default fallaría en seco sobre una tabla que ya tiene filas, y con él las 130 filas existentes
-- quedan en revisión 0, que es lo correcto — 0 es «el original».

ALTER TABLE "jobs"      ADD COLUMN IF NOT EXISTS "tipo_intervencion"     TEXT;

ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "clausulas_presupuesto" JSONB;

ALTER TABLE "quotes"    ADD COLUMN IF NOT EXISTS "iva_modo"              TEXT;
ALTER TABLE "quotes"    ADD COLUMN IF NOT EXISTS "clausulas_excluidas"   JSONB;
ALTER TABLE "quotes"    ADD COLUMN IF NOT EXISTS "revision"              INTEGER NOT NULL DEFAULT 0;


-- ── ② LA TABLA `partes_trabajo` ──────────────────────────────────────────────────────────
--
-- El DDL sale de `prisma migrate diff --from-empty --to-schema-datamodel`, no está escrito a
-- mano: los tipos son exactamente los que Prisma espera encontrar.

CREATE TABLE IF NOT EXISTS "partes_trabajo" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "job_id" INTEGER,
    "customer_id" INTEGER,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "obra" TEXT,
    "referencia" TEXT,
    "entrada" TEXT,
    "salida" TEXT,
    "desplazamientos" INTEGER,
    "kilometros" DECIMAL(10,2),
    "tecnicos" JSONB NOT NULL DEFAULT '[]',
    "tipo" TEXT,
    "lineas" JSONB NOT NULL,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "firmado_at" TIMESTAMP(3),
    "firmado_por_nombre" TEXT,
    "firmado_por_calidad" TEXT,
    "contenido_hash" TEXT,
    "contenido_version" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partes_trabajo_pkey" PRIMARY KEY ("id")
);


-- ── ③ LOS DOS ÍNDICES QUE EL ESQUEMA DECLARA ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "partes_trabajo_merchant_id_fecha_idx"
  ON "partes_trabajo"("merchant_id", "fecha");

CREATE INDEX IF NOT EXISTS "partes_trabajo_merchant_id_estado_idx"
  ON "partes_trabajo"("merchant_id", "estado");


-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ④ EL ÍNDICE ÚNICO (merchant_id, numero) — LEER ANTES DE APLICAR
-- ═════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 `prisma/schema.prisma` **NO DECLARA HOY** este índice único. Medido: `model ParteTrabajo`
-- sólo tiene `@@index([merchantId, fecha])` y `@@index([merchantId, estado])`.
--
-- Eso importa y no es una pega de estilo: si se crea en las bases y el esquema no lo declara,
-- **el próximo `migrate diff` propondrá BORRARLO**, que es exactamente la deriva contra la que
-- existe este fichero. Aplicarlo sin más cambiaría un problema por otro.
--
-- CÓMO SE CIERRA BIEN, con el orden de la casa: el ③ de este ticket (el PR) tiene que añadir
--     @@unique([merchantId, numero])
-- a `model ParteTrabajo`. Con eso, esquema y bases dicen lo mismo y el diff queda limpio.
--
-- Hace falta de verdad: la numeración del parte (`scripts`… `src/modules/jobs/domain/parteNumero.ts`)
-- deriva del máximo ya emitido dentro de la transacción del create, y **sin índice único la base
-- no rechazaría un duplicado**: dos creaciones simultáneas del mismo merchant pueden acuñar el
-- mismo número. El índice es la red que hoy no está.
--
-- ── ④a · COMPROBACIÓN PREVIA, OBLIGATORIA EN CADA BASE ──────────────────────────────────
--
-- `CREATE UNIQUE INDEX` FALLA si ya hay duplicados. Se comprueba ANTES, base por base. Con la
-- tabla recién creada saldrá vacío, pero en una base donde ya se hubieran creado partes puede no
-- estarlo, y descubrirlo con el error del índice es descubrirlo tarde.
--
-- Lectura del resultado:
--   · 0 filas  → no hay duplicados: se puede crear el índice único.
--   · ≥1 fila  → PARAR. Cada fila es un (merchant_id, numero) repetido y cuántas veces. Hay que
--                decidir qué hacer con esos partes ANTES de crear el índice, y esa decisión no
--                es de este fichero.
--
--   SELECT "merchant_id", "numero", count(*) AS veces
--     FROM "partes_trabajo"
--    GROUP BY "merchant_id", "numero"
--   HAVING count(*) > 1
--    ORDER BY veces DESC;
--
-- ── ④b · EL ÍNDICE, sólo si ④a salió vacío Y el PR añade el `@@unique` ───────────────────
--
--   CREATE UNIQUE INDEX IF NOT EXISTS "partes_trabajo_merchant_id_numero_key"
--     ON "partes_trabajo"("merchant_id", "numero");
--
-- Se deja COMENTADO a propósito: aplicarlo hoy, con el esquema sin declararlo, crea deriva. Se
-- descomenta el día que el PR lleve el `@@unique`, y entonces se aplica en las tres bases.


-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ⑤ VERIFICACIÓN — se ejecuta DESPUÉS, en cada base, y lleva CONTROL POSITIVO dentro
-- ═════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 `control_ve_el_catalogo` es el suelo: si sale 0, **NADA de lo demás significa nada**. No
-- sería «falta todo»: sería que la consulta no está mirando el esquema de la aplicación (otro
-- `search_path`) y no se ha podido comprobar. Un 0 ahí se lee como ceguera, no como ausencia.
--
-- Lo esperado tras aplicar: control > 100, y las seis siguientes a 1.
--
--   SELECT
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public')                                         AS control_ve_el_catalogo,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='jobs'
--         AND column_name='tipo_intervencion')                               AS jobs_tipo_intervencion,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='merchants'
--         AND column_name='clausulas_presupuesto')                           AS merchants_clausulas,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='quotes'
--         AND column_name='iva_modo')                                        AS quotes_iva_modo,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='quotes'
--         AND column_name='clausulas_excluidas')                             AS quotes_clausulas_excluidas,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='quotes'
--         AND column_name='revision')                                        AS quotes_revision,
--     (SELECT count(*) FROM information_schema.tables
--       WHERE table_schema='public' AND table_name='partes_trabajo')         AS tabla_partes_trabajo,
--     (SELECT count(*) FROM pg_indexes
--       WHERE schemaname='public' AND tablename='partes_trabajo')            AS indices_partes_trabajo;

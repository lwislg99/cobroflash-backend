-- docs/sql/scrum-674-deriva-produccion.sql — SCRUM-674, la deriva que hoy impide arrancar
--
-- SEIS COSAS QUE EL CÓDIGO NOMBRA Y LA BASE DE PRODUCCIÓN NO TIENE. Entraron en el esquema con
-- `a88286ba` (SCRUM-674, «los cuatro cambios de schema que faltaban») y nunca se aplicaron: por
-- eso `schemaDrift.ts` niega el arranque y producción sigue sirviendo el código del PR #919.
--
-- ⚠️ MEDIDO CONTRA UN SHA CONCRETO, y sin él este fichero no se puede saber si está completo:
--   · `origin/main` = 78f008cb1aa42678a2db06b1ac31193bf57d205a · 2026-09-02T18:00:28+01:00
--     (re-medido tras entrar #933 `scrum-650-paso-c-backfill` y #935 `scrum-683-parte-dictado`,
--      que eran los dos ultimos anunciados: NINGUNO toca `prisma/schema.prisma`, y el censo
--      sigue dando 403 columnas — el mismo fichero `deriva-prod.sql`, byte a byte. La medicion
--      anterior fue contra `6cc1f459` y dio lo mismo.)
--   · el desplegado en producción = `4b3865f8` (merge del PR #919)
--   · delta medido: 403 columnas esperadas hoy contra 374 en #919 → 29 columnas nuevas,
--     4 tablas afectadas, 0 columnas retiradas.
--
-- 🔴 CONTROL POSITIVO QUE NO HEMOS FABRICADO: nos lo dio la avería. El log de producción nombra
-- exactamente estas seis cosas, y el censo derivado del esquema (`docs/sql/deriva-prod.sql`,
-- regenerado contra el sha de arriba) da EXACTAMENTE las mismas seis. Ni una de menos —el
-- instrumento no está ciego— ni una de más —no ha entrado esquema nuevo por detrás—.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 LOS TIPOS NO ESTÁN ADIVINADOS: SALEN DE `prisma migrate diff`
--
-- `schemaDrift` sólo mira que EXISTAN tabla y columna. No mira tipos, ni nullability, ni claves
-- ajenas, ni índices. O sea que una columna creada con el tipo equivocado **arranca en VERDE** y
-- no se entera nadie hasta que un dato no cabe delante de un cliente. Por eso ni un tipo de este
-- fichero se ha escrito de cabeza: todos salen de
--
--     node scripts/preview-migracion.mjs --desde <schema.prisma de #919>
--
-- que es `prisma migrate diff` con control positivo dentro. Su veredicto sobre este conjunto:
-- **aditiva — ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.**
--
-- Las dos que el nombre deja ambiguas, resueltas por el diff y no por intuición:
--   · `merchants.clausulas_presupuesto` → **JSONB** (no TEXT, no lista). De `Json?` en el schema.
--   · `quotes.clausulas_excluidas` ..... → **JSONB**, ídem. Las tres opciones arrancarían igual y
--     sólo ésta es la buena.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- POR QUÉ CADA UNA ES SEGURA SOBRE UNA TABLA CON FILAS
--
-- Cuatro de las cinco columnas son NULLABLE y sin `DEFAULT`: `ADD COLUMN` así no reescribe la
-- tabla ni la bloquea, y NULL significa «no consta», que es lo que dice el esquema —un `DEFAULT`
-- declararía por el profesional un valor que nadie ha escrito.
--
-- ⚠️ LA EXCEPCIÓN, DECLARADA: `quotes.revision` es `INTEGER NOT NULL DEFAULT 0`. Es la ÚNICA con
-- NOT NULL, y lo es porque el esquema dice `revision Int @default(0)`: `0` = original. Sobre una
-- columna NUEVA con DEFAULT, PostgreSQL ≥ 11 no reescribe la tabla (guarda el default en el
-- catálogo). En PostgreSQL < 11 sí la reescribiría, tomando un lock: si la base de producción
-- fuera anterior a la 11, ESTA es la sentencia que hay que mirar antes de lanzarla.
-- Y no es un `SET NOT NULL` sobre una columna existente, que es lo que el veredicto prohíbe.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- SOBRE `partes_trabajo`: NO LLEVA CLAVES AJENAS, Y ES DEL ESQUEMA, NO UN OLVIDO MÍO
--
-- El encargo pedía las FK INLINE en el `CREATE TABLE` porque un `ADD CONSTRAINT` suelto cae en
-- «no aditiva». Aquí no hay ninguna que poner: el diff **no genera ni un `AddForeignKey`** para
-- esta tabla. El esquema declara `merchant_id`, `job_id` y `customer_id` SUELTOS, sin relaciones
-- Prisma, «misma convención que el resto del schema (SCRUM-192)» — lo dice su propio comentario.
-- (Como contraste medido: `job_assignees`, que le falta a STAGING, SÍ genera dos `AddForeignKey`.)
--
-- La PK sí va INLINE, que es como la emite el diff.
--
-- 🔴 UNA TABLA A MEDIAS ES PEOR QUE NINGUNA: `CREATE TABLE IF NOT EXISTS` se la SALTA en vez de
-- arreglarla. Por eso la verificación cuenta sus 24 columnas y no se conforma con que exista.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- RE-EJECUTABLE (`IF NOT EXISTS` en las ocho sentencias). Medido el 2-sep-2026:
--   · en PRODUCCIÓN faltan las seis (lo dice su log de arranque).
--   · en `yaqu_dev_javier` (DEV) faltan las seis.
--   · en `railway` (STAGING) faltan las seis **y además `job_assignees`**, que NO va en este
--     fichero: es otra deriva, ya resuelta en producción esta mañana, y su DDL es
--     `docs/sql/scrum-650-job-assignees.sql`.
--
-- ⚠️ LA VERIFICACIÓN NO VIVE AQUÍ: `docs/sql/verificacion-scrum-674.sql`. La lista blanca del
-- aplicador (`scripts/_aplicar-sql-dev.mjs`) RECHAZA un `SELECT`, y un fichero que mezcle DDL y
-- comprobación queda inaplicable. Ya pasó una vez; por eso se separan.
--
-- ⚠️ LO QUE ESTE FICHERO **NO** HACE, a propósito: DEV y STAGING tienen además tres columnas de
-- MÁS que el esquema ya no declara (`albaranes.doc_header_text`, `quotes.doc_header_text`,
-- `quotes.doc_footer_text`) y `migrate diff` propone tres `DROP COLUMN` para ellas. **No van
-- aquí.** Que la base vaya por delante del código no impide arrancar —`schemaDrift` no mira las
-- columnas de más— y quitarlas es una operación DESTRUCTIVA que necesita su propia decisión.

ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "clausulas_presupuesto" JSONB;

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "clausulas_excluidas" JSONB;

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "iva_modo" TEXT;

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "tipo_intervencion" TEXT;

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

CREATE INDEX IF NOT EXISTS "partes_trabajo_merchant_id_fecha_idx" ON "partes_trabajo"("merchant_id", "fecha");

CREATE INDEX IF NOT EXISTS "partes_trabajo_merchant_id_estado_idx" ON "partes_trabajo"("merchant_id", "estado");

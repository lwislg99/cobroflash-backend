-- docs/sql/scrum-1127-vf-submissions-dev.sql — SCRUM-1127 §④, versión para `aplicar-sql-dev.mjs`
--
-- ES EL MISMO DDL de §④ de docs/master/SCRUM-1127.md (el que el fundador aplicó a mano en staging
-- y producción), con UNA diferencia de forma y ninguna de efecto:
--
--   · las dos claves ajenas, que allí son `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`, van aquí
--     DENTRO del `CREATE TABLE "vf_submissions"`, con el MISMO nombre, las MISMAS columnas y las
--     MISMAS acciones (ON DELETE RESTRICT ON UPDATE CASCADE). `ADD CONSTRAINT` no es una forma de
--     la lista blanca de `_aplicar-sql-dev.mjs`, y no se ensancha para esto (SCRUM-1197).
--     La equivalencia se comprueba LEYENDO EL CATÁLOGO: `confdeltype = 'r'`, `confupdtype = 'c'`.
--
-- El enum sí necesitó forma nueva: `CREATE TYPE … AS ENUM ( … )` (SCRUM-1197).
-- SÓLO DEV. Uso: node scripts/aplicar-sql-dev.mjs --file docs/sql/scrum-1127-vf-submissions-dev.sql [--go]

-- CreateEnum
CREATE TYPE "VfSubmissionStatus" AS ENUM ('pending', 'sent', 'accepted', 'rejected', 'manual_review');

-- CreateTable (con sus dos claves ajenas dentro)
CREATE TABLE "vf_submissions" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "obligado_nif" TEXT NOT NULL,
    "tipo_operacion" TEXT NOT NULL,
    "registro_xml" TEXT NOT NULL,
    "status" "VfSubmissionStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "last_envio_id" TEXT,
    "csv" TEXT,
    "estado_registro" TEXT,
    "subsanar" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vf_submissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vf_submissions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vf_submissions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vf_flujo_obligado" (
    "obligado_nif" TEXT NOT NULL,
    "tiempo_espera_envio_s" INTEGER,
    "siguiente_envio_desde" TIMESTAMP(3),
    "ultimo_envio_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vf_flujo_obligado_pkey" PRIMARY KEY ("obligado_nif")
);

-- CreateIndex
CREATE INDEX "vf_submissions_status_next_attempt_at_idx" ON "vf_submissions"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "vf_submissions_obligado_nif_status_idx" ON "vf_submissions"("obligado_nif", "status");

-- CreateIndex
CREATE INDEX "vf_submissions_merchant_id_idx" ON "vf_submissions"("merchant_id");

-- CreateIndex
CREATE INDEX "vf_submissions_invoice_id_idx" ON "vf_submissions"("invoice_id");

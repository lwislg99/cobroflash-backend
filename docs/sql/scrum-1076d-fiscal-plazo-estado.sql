-- docs/sql/scrum-1076d-fiscal-plazo-estado.sql — SCRUM-1076d
--
-- CALENDARIO DE PLAZOS: el estado que marca el profesional («Llevado a mi asesor»).
-- Tabla NUEVA y aditiva, aprobada por el fundador en SCRUM-1076 c.21877 (P6), con el modelo de
-- c.21876 §2. Sin fila = «Pendiente». Ni DROP, ni ALTER de otra tabla.
--
-- Salida LITERAL de `node scripts/preview-migracion.mjs --desde <schema de origin/main 37947dc1>`
-- (veredicto: «aditiva»). Orden A5: dev lo aplica la sesión (`aplicar-sql-dev.mjs --go`);
-- staging y producción, el fundador.

-- CreateTable
CREATE TABLE "fiscal_plazo_estado" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL,
    "ejercicio" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "marcado_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marcado_por" INTEGER,

    CONSTRAINT "fiscal_plazo_estado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_plazo_estado_merchant_id_modelo_ejercicio_periodo_key" ON "fiscal_plazo_estado"("merchant_id", "modelo", "ejercicio", "periodo");

-- AddForeignKey
ALTER TABLE "fiscal_plazo_estado" ADD CONSTRAINT "fiscal_plazo_estado_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

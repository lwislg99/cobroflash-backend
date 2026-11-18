-- docs/sql/scrum-1076d-fiscal-plazo-estado-dev.sql — SCRUM-1076d · SOLO PARA DEV
--
-- El MISMO DDL que `scrum-1076d-fiscal-plazo-estado.sql` (salida literal de la preview, que es la
-- que aplica el fundador en staging y producción), con UNA diferencia de forma y ninguna de efecto:
--   · la clave ajena, que allí es `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`, va aquí DENTRO del
--     `CREATE TABLE`, porque `aplicar-sql-dev.mjs` no admite esa forma (lista blanca; mismo camino
--     que `scrum-1127-vf-submissions-dev.sql`, SCRUM-1197). Mismo nombre, misma acción.

CREATE TABLE "fiscal_plazo_estado" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL,
    "ejercicio" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "marcado_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marcado_por" INTEGER,

    CONSTRAINT "fiscal_plazo_estado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_plazo_estado_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fiscal_plazo_estado_merchant_id_modelo_ejercicio_periodo_key" ON "fiscal_plazo_estado"("merchant_id", "modelo", "ejercicio", "periodo");

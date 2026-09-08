-- SCRUM-805 · la evidencia de firma del presupuesto.
-- ADITIVO: columna nueva, anulable, sin defecto. Las filas existentes quedan con NULL, que aquí
-- significa «de este presupuesto no se guardó evidencia» y no «se firmó sin evidencia».
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "evidencia_firma" JSONB;

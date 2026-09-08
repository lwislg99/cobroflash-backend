-- docs/sql/scrum-653-dos-firmas.sql — SCRUM-653 · las DOS firmas del parte de trabajo.
--
-- QUÉ APLICA: cuatro columnas nuevas en `partes_trabajo` — el trazo del CLIENTE (que hoy no se
--             guarda) y las tres de la firma del TÉCNICO. Nada más.
-- EN QUÉ ORDEN: dev → staging → producción, verificando en cada una con el bloque del final.
-- NO CONTIENE NINGÚN BORRADO: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni ALTER … TYPE.
--             Las cuatro son `ADD COLUMN` NULLABLE.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 ESTO VA ANTES QUE EL PR (② antes que ③)
--
-- El orden de la casa: ① decisión → ② ALTER aditivo en las TRES bases → ③ un solo PR con esquema
-- + código + tests. NUNCA ③ sin ②. El 2-sep-2026 el commit de esquema de SCRUM-674 entró en
-- `main` con las columnas sin existir en ninguna base y hubo que rescatarlo a mano.
--
-- Así que este fichero se aplica a las tres bases **antes** de mergear el PR de SCRUM-653.
--
-- ES IDEMPOTENTE (`IF NOT EXISTS`): se corre en tres bases sin llevar la cuenta a mano.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- POR QUÉ SON CUATRO Y NO TRES
--
-- El parte de papel lleva DOS recuadros: «FIRMA CLIENTE» y «FIRMA TÉCNICO». Añadir la del técnico
-- son tres columnas. La cuarta —`signature_url`— **no es de la segunda firma: arregla la primera**.
--
-- Medido el 3-sep-2026: `POST /admin/partes/:id/firmar` VALIDA `signatureData` (regex PNG/JPEG y
-- tope de tamaño) y **no lo guarda en ninguna parte**. El `UPDATE` escribe estado, fecha, nombre,
-- calidad y el hash; el trazo se descarta. El parte guardaba QUE se firmó y QUIÉN dijo ser, pero
-- no la firma. `albaranes.signature_url` sí existe desde SCRUM-14.
--
-- Se le da el MISMO nombre y la misma forma que en `albaranes`: un data-URI en TEXT.
--
-- ⚠️ Y NO HAY `firmado_tecnico_calidad`, a propósito. Las seis opciones de `albaranFirmante.ts`
-- —«portero o conserje», «un familiar o conviviente»…— existen porque quien firma POR EL CLIENTE
-- puede ser cualquiera. El técnico es un empleado identificado: darle ranura de «calidad» sería
-- ofrecerle declarar que firma «en nombre del cliente», que es justo lo que no puede hacer.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ── EL TRAZO DEL CLIENTE, que hoy se tira ────────────────────────────────────────────────
ALTER TABLE "partes_trabajo" ADD COLUMN IF NOT EXISTS "signature_url" TEXT;

-- ── LA FIRMA DEL TÉCNICO ─────────────────────────────────────────────────────────────────
ALTER TABLE "partes_trabajo" ADD COLUMN IF NOT EXISTS "signature_tecnico_url"  TEXT;
ALTER TABLE "partes_trabajo" ADD COLUMN IF NOT EXISTS "firmado_tecnico_at"     TIMESTAMP(3);
ALTER TABLE "partes_trabajo" ADD COLUMN IF NOT EXISTS "firmado_tecnico_nombre" TEXT;


-- ── VERIFICACIÓN — después, en cada base, con control positivo dentro ────────────────────
--
-- 🔴 `control_ve_la_tabla` es el suelo: si sale 0, las otras cuatro a 0 NO significan «no se
-- aplicó», significan que la consulta no está mirando esta tabla. Esperado: las cinco a 1.
--
--   SELECT
--     (SELECT count(*) FROM information_schema.tables
--       WHERE table_schema='public' AND table_name='partes_trabajo')          AS control_ve_la_tabla,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='partes_trabajo'
--         AND column_name='signature_url')                                    AS signature_url,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='partes_trabajo'
--         AND column_name='signature_tecnico_url')                            AS signature_tecnico_url,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='partes_trabajo'
--         AND column_name='firmado_tecnico_at')                               AS firmado_tecnico_at,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='partes_trabajo'
--         AND column_name='firmado_tecnico_nombre')                           AS firmado_tecnico_nombre;

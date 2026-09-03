-- docs/sql/scrum-685b-parte-numero-unico.sql — SCRUM-685b · el número del parte, único por merchant.
--
-- QUÉ APLICA: un índice ÚNICO sobre `partes_trabajo(merchant_id, numero)`. Una sentencia, nada más.
-- EN QUÉ ORDEN: dev → staging → producción, y en CADA una ejecutando antes
--               `scrum-685b-comprobar-duplicados.sql`. Si ése devuelve filas, esta base NO se toca.
-- NO CONTIENE NINGÚN BORRADO: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni ALTER … TYPE.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 ESTO VA ANTES QUE EL PR (② antes que ③)
--
-- El orden de la casa es ① decisión → ② ALTER en las TRES bases → ③ un solo PR con esquema +
-- código + tests. NUNCA ③ sin ②: el 2-sep-2026 el commit de esquema de SCRUM-674 entró en `main`
-- con las columnas sin existir en ninguna base, y hubo que rescatarlo a mano.
--
-- Así que: **este fichero se aplica a las tres bases ANTES de mergear el PR** que declara
-- `@@unique([merchantId, numero])` en `prisma/schema.prisma`.
--
-- ⚠️ Y AL REVÉS TAMBIÉN IMPORTA: aplicarlo sin que el PR entre dejaría un índice que el esquema no
-- declara, y el próximo `migrate diff` propondría BORRARLO. Los dos van juntos, en este orden.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- POR QUÉ HACE FALTA, Y NO ES UNA REDUNDANCIA DEL CÓDIGO
--
-- `siguienteNumeroParte` (`src/modules/jobs/domain/parteNumero.ts`) deriva el número del MÁXIMO ya
-- emitido dentro de la transacción del create. Lo hace así porque `Merchant` no tiene contadores
-- propios para el parte — el albarán sí los tiene (`nextAlbaranNumber` + `albaranSeriesYear`) y
-- reserva contra ellos.
--
-- Derivar del máximo **no impide el duplicado**: dos creaciones simultáneas del mismo merchant
-- pueden leer el mismo máximo y acuñar el mismo número. Sin este índice la base **acepta los dos**,
-- y quedan dos partes distintos diciendo ser el mismo documento: el cliente firma uno y la oficina
-- valora el otro, sin que nada falle hasta que alguien los compara.
--
-- Con el índice, el segundo INSERT revienta RUIDOSAMENTE. Es lo correcto: mejor no crear el parte
-- que crearlo mal identificado.
--
-- ⚠️ EL NOMBRE DEL ÍNDICE NO ES LIBRE. Es el que genera Prisma para `@@unique([merchantId,
-- numero])`, comprobado con `migrate diff --from-empty --to-schema-datamodel`:
--     partes_trabajo_merchant_id_numero_key
-- Con otro nombre, el esquema y la base tendrían el mismo índice con dos nombres y el diff
-- propondría crear uno y borrar el otro.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ⚠️ ANTES: ejecutar `docs/sql/scrum-685b-comprobar-duplicados.sql` en ESTA base.
--    Si devolvió alguna fila, NO continuar.

CREATE UNIQUE INDEX IF NOT EXISTS "partes_trabajo_merchant_id_numero_key"
  ON "partes_trabajo"("merchant_id", "numero");


-- ── VERIFICACIÓN — después, en cada base, con control positivo dentro ────────────────────
--
-- 🔴 `control_ve_los_indices` es el suelo: si sale 0, `indice_unico` = 0 no significa «no se
-- creó», significa que la consulta no está mirando esta tabla. Esperado: control ≥ 3 (la clave
-- primaria y los dos índices de SCRUM-674) e `indice_unico` = 1.
--
--   SELECT
--     (SELECT count(*) FROM pg_indexes
--       WHERE schemaname='public' AND tablename='partes_trabajo')      AS control_ve_los_indices,
--     (SELECT count(*) FROM pg_indexes
--       WHERE schemaname='public' AND tablename='partes_trabajo'
--         AND indexname='partes_trabajo_merchant_id_numero_key')       AS indice_unico;

-- docs/sql/scrum-631-opcion-B-indice-parcial.sql — SCRUM-631 · OPCIÓN B, PREPARADA Y SIN APLICAR
--
-- ⛔ ESTO NO SE HA APLICADO EN NINGUNA BASE, Y NO SE APLICA HASTA QUE EL FUNDADOR ELIJA SALIDA.
--    Hay CUATRO salidas en docs/master/SCRUM-631.md (0, A, B, C). Ésta es la B. Que su SQL esté
--    escrito no la convierte en la elegida: está aquí para que la decisión se tome con el coste
--    delante, no para adelantarla.
--
-- QUÉ HARÍA: cambiar la FRONTERA de la unicidad del nombre — de «todas las filas» a «las filas
--            activas» — para que un producto desactivado deje de secuestrar su nombre.
-- QUÉ BORRA: un índice, `products_merchant_id_name_search_key`. NO borra datos: ni DELETE, ni
--            TRUNCATE, ni DROP COLUMN, ni ALTER ... TYPE. Ninguna fila se pierde.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 EL ORDEN, Y POR QUÉ NO ES EL QUE PARECE
--
-- Las dos sentencias van EN ESTE ORDEN y en la misma transacción: primero CREATE, después DROP.
-- Al revés dejaría una ventana —por corta que sea— en la que DOS PRODUCTOS ACTIVOS pueden nacer
-- con el mismo nombre, y esa es justo la regla que este cambio NO quiere tocar.
--
-- Y va ANTES que el PR que retire `@@unique([merchantId, nameSearch])` de `prisma/schema.prisma`,
-- por la lección de SCRUM-674 citada en `scrum-685b-parte-numero-unico.sql`: el 2-sep-2026 un
-- commit de esquema entró en `main` con la base sin tocar y hubo que rescatarlo a mano.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ EL COSTE DE ESTA OPCIÓN, MEDIDO EL 5-SEP-2026 — Y NO ES EL QUE SE CREÍA
--
-- Se creía (docs/master/SCRUM-631.md, tabla de S1) que `db push` tiraría este índice «en CADA
-- push». MEDIDO: NO lo tira. Prisma 6.18 VE los índices totales y es CIEGO a los parciales; con
-- el índice puesto, `prisma db push` responde «already in sync» y lo deja intacto. Comprobado
-- también con el `@@unique` fuera del esquema, y con control positivo dentro del mismo disparo
-- (el diff SÍ propone tirar el índice TOTAL, así que la herramienta estaba mirando).
--
-- 🔴 PERO EL COSTE REAL ES EL CONTRARIO, Y NO DESAPARECE: este índice queda FUERA DEL ESQUEMA Y
--    SIN VIGILANTE. Los dos guardianes de la casa miran COLUMNAS, no índices:
--      · `src/core/db/schemaDrift.ts:25` — «NO: tipos, nullability, defaults, ÍNDICES...»
--      · `src/core/db/constanciaDelAlter.ts:58` — consulta `information_schema.columns`
--    Una base nueva levantada desde `schema.prisma`, un `--force-reset` o una restauración de
--    copia NO lo tendrían, y NADIE lo diría: producción arrancaría VERDE con la garantía perdida
--    y el primer síntoma serían nombres duplicados entre productos activos.
--
--    Si se elige B, hace falta un guard que compruebe este índice POR PROPIEDAD (indisunique +
--    indpred IS NOT NULL sobre `products`), porque hoy no existe. Sin ese guard, B es una
--    protección que se puede perder sin que nada lo diga. La opción C de S1 no tiene este coste.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- EL NOMBRE DEL ÍNDICE **SÍ** ES LIBRE AQUÍ, Y ES LO CONTRARIO QUE EN SCRUM-685b
--
-- En 685b el nombre estaba forzado porque Prisma genera el suyo para `@@unique`. Aquí Prisma no
-- puede declarar este índice de ninguna forma, así que no hay nombre canónico con el que chocar.
-- Se elige uno que diga qué es y de quién viene.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ⚠️ ANTES, en ESTA base: ejecutar `docs/sql/scrum-631-verificar.sql`. Si `activos_duplicados`
--    devuelve algo distinto de 0, esta base NO se toca: habría filas que el índice nuevo no
--    admitiría y el CREATE fallaría a mitad.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS "products_merchant_nombre_activo_key"
  ON "products" ("merchant_id", "name_search")
  WHERE "is_active" = true;

DROP INDEX IF EXISTS "products_merchant_id_name_search_key";

COMMIT;


-- DESPUÉS, en cada base: `docs/sql/scrum-631-verificar.sql` otra vez.

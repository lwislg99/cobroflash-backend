-- docs/sql/scrum-586-forma-de-pago-por-cliente.sql — SCRUM-586 (CONT-13)
--
-- ⛔ PREPARADO Y NO APLICADO. El fundador tiene el diff; el GO no está dado.
--    Generado el 5-sep-2026 por `node scripts/preview-migracion.mjs --desde <schema previo>`,
--    con su control positivo respondiendo (27 tablas) y veredicto **aditiva**: ni DROP, ni
--    RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.
--
-- 🔴 EL CAMPO ES NULLABLE Y SIN DEFAULT, Y ESO NO ES PEREZA. `NULL` = «a este cliente no se le
--    ha pactado nada», que es la verdad de los clientes que ya existen. Un `DEFAULT` los
--    convertiría a todos en «declarados» y ya no habría forma de saber a cuáles se preguntó —
--    exactamente el motivo que `dtoPorDefecto` (SCRUM-587) dejó escrito en la columna de al lado.
--
-- ⚠️ NO se aplica con este fichero: el camino es `npx prisma db push` tras el preview, y en
--    staging/producción lo hace el fundador. Esto es el REGISTRO de lo que ese push haría.

-- ──────── LO QUE SE APLICARÍA ────────
ALTER TABLE "customers" ADD COLUMN "pay_methods_por_defecto" JSONB;


-- ──────── VERIFICACIÓN · ANTES Y DESPUÉS, CON SUELO DENTRO ────────
--
-- 🔴 `control_ve_la_tabla` ES EL SUELO. Si sale 0, entonces `columna_nueva = 0` NO significa
--    «no se creó»: significa que esta consulta no está mirando esta tabla. Sin el suelo los dos
--    ceros se escriben igual y significan lo contrario.
--    Esperado: control >= 20 (la tabla tiene 24 columnas medidas el 4-sep-2026).
--
-- ⚠️ SE PREGUNTA POR PROPIEDAD, NO POR UN NOMBRE QUE ALGUIEN RECUERDE: `is_nullable` y
--    `column_default` describen lo que la columna HACE.

SELECT
  -- SUELO: ¿estoy viendo las columnas de `customers`?
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'customers')                                AS control_ve_la_tabla,

  -- ¿existe ya la columna? (0 = antes · 1 = después)
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'customers'
      AND column_name = 'pay_methods_por_defecto')                 AS columna_nueva,

  -- 🔴 y que sea NULLABLE y SIN default. Una columna creada NOT NULL o con default
  --    rompería la distinción «no consta» / «declarado», que es media razón del ticket.
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'customers'
      AND column_name = 'pay_methods_por_defecto'
      AND is_nullable = 'YES'
      AND column_default IS NULL)                                  AS nullable_y_sin_default,

  -- CONTROL de que la vecina de la que se copia el patrón sigue como debe: si `dto_por_defecto`
  -- hubiera cambiado de forma, copiar su patrón habría dejado de significar lo que se cree.
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'customers'
      AND column_name = 'dto_por_defecto'
      AND is_nullable = 'YES'
      AND column_default IS NULL)                                  AS control_vecina_dto;

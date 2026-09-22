-- docs/sql/scrum-597-asignados-de-documento.sql — SCRUM-597 (DOC-07)
--
-- UN DOCUMENTO SE ASIGNA A UNO O VARIOS USUARIOS DE LA CUENTA. Dos tablas puente, una por
-- documento: presupuesto y factura.
--
-- ADITIVO PURO: no toca `quotes`, ni `invoices`, ni `team_members`. Mientras las tablas estén
-- vacías NADA de lo que hoy funciona cambia — ningún listado, ningún filtro y ningún orden leen
-- de aquí salvo para pintar quién lleva el documento.
--
-- 🔴 Y POR ESO ASIGNAR A UNA FACTURA EMITIDA NO LA TOCA (regla 29): la asignación se escribe en
-- `invoice_assignees` y en ningún otro sitio. El número, el total y el PDF viven en `invoices`,
-- que este fichero no modifica. No es que se tenga cuidado: es que no hay por dónde.
--
-- RE-EJECUTABLE (`IF NOT EXISTS`): volver a correrlo sobre una base ya aplicada no hace nada.
--
-- ⚠️ NOMBRES DE LA BASE (snake_case), que salen de los `@map`/`@@map` del modelo. No se «corrigen».
--
-- ⚠️ SE ALINEA CON LO QUE PRISMA GENERA, por la lección de SCRUM-670b: las FK llevan
-- `ON UPDATE CASCADE` explícito porque es lo que emite `prisma migrate diff` sobre este mismo
-- modelo. Sin cláusula quedaría `NO ACTION` y la base diría una cosa y el esquema otra — deriva
-- silenciosa, porque `schemaDrift.ts` y `deriva-prod.sql` sólo miran que EXISTAN tabla y columna,
-- no tipos ni claves ajenas. Los nombres de constraint se declaran EXPLÍCITOS por lo mismo.
--
-- ⚠️ `ON DELETE CASCADE` EN LAS DOS COLUMNAS de cada tabla, y es la lección de SCRUM-244: sin él
-- la FK es RESTRICT y borrar un empleado —o su merchant— revienta a mitad de recorrido con las
-- tablas anteriores ya vaciadas. Y es lo correcto además de lo seguro: una asignación no
-- significa nada sin la persona asignada, ni sin el documento asignado.
--
-- ⚠️ LA VERIFICACIÓN NO VIVE AQUÍ: la lista blanca del aplicador (`_clasificador-sql.mjs`)
-- RECHAZA un `SELECT`, así que un fichero que mezcle el DDL con su comprobación queda
-- inaplicable. Se separan a propósito, igual que en SCRUM-650.

CREATE TABLE IF NOT EXISTS "quote_assignees" (
  "quote_id"       INTEGER      NOT NULL,
  "team_member_id" INTEGER      NOT NULL,
  "assigned_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_assignees_pkey" PRIMARY KEY ("quote_id", "team_member_id"),
  CONSTRAINT "quote_assignees_quote_id_fkey" FOREIGN KEY ("quote_id")
    REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quote_assignees_team_member_id_fkey" FOREIGN KEY ("team_member_id")
    REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "invoice_assignees" (
  "invoice_id"     INTEGER      NOT NULL,
  "team_member_id" INTEGER      NOT NULL,
  "assigned_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_assignees_pkey" PRIMARY KEY ("invoice_id", "team_member_id"),
  CONSTRAINT "invoice_assignees_invoice_id_fkey" FOREIGN KEY ("invoice_id")
    REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invoice_assignees_team_member_id_fkey" FOREIGN KEY ("team_member_id")
    REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- La consulta CALIENTE es «qué documentos lleva esta persona» — es la que se hace al abrir la
-- ficha de un empleado y la que haría cualquier filtro por asignado. Sin estos índices, cada una
-- recorrería la tabla entera.
CREATE INDEX IF NOT EXISTS "quote_assignees_team_member_id_idx"   ON "quote_assignees"("team_member_id");
CREATE INDEX IF NOT EXISTS "invoice_assignees_team_member_id_idx" ON "invoice_assignees"("team_member_id");

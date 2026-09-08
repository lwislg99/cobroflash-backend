-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- SCRUM-825b · BORRADO DE TODOS LOS DOCUMENTOS DE PRUEBA
--
-- 🔴 ESTE FICHERO NO SE HA EJECUTADO EN NINGUNA BASE. Ni en dev. Lo ejecuta el FUNDADOR:
--    primero staging, después producción. La sesión que lo escribió sólo midió.
--
-- ⚠️ LEVANTA LA REGLA 29 (una factura emitida no se borra, no se edita, no se renumera).
--    Se levanta UNA VEZ, con fecha, motivo y firma:
--      · Decisión del fundador, 8-sep-2026: «todos los documentos actuales son de prueba».
--      · El único merchant que no es suyo (Tecnosel) tiene CERO documentos — comprobado por él
--        en producción.
--      · SCRUM-525 auditó el camino de emisión: de los nueve pasos, LA COLA DE ENVÍO Y EL ENVÍO
--        A LA AEAT NO EXISTEN. Nunca se ha remitido nada. Borrar no tiene consecuencia fiscal
--        fuera de esta base.
--    🔴 NO ES PRECEDENTE. Fuera de este borrado único, la regla 29 sigue entera: una factura
--    emitida se rectifica con R1 o se anula con registro, jamás se borra.
--
-- ⛔ El aplicador de dev (`scripts/aplicar-sql-dev.mjs`) RECHAZARÁ este fichero, y hace bien:
--    su lista blanca no admite `DELETE`. No es un obstáculo que haya que rodear — es la señal
--    de que esto no es una migración de rutina.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- QUÉ **NO** BORRA ESTE GUION, Y POR QUÉ
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- 1. LOS CONTADORES DE SERIE (`merchants.next_invoice_number`, `next_rect_invoice_number`,
--    `next_quote_number`, `next_albaran_number`, `invoice_series_year`, `albaran_series_year`).
--    🔴 El siguiente número NO se deriva de contar filas: es una COLUMNA GUARDADA
--    (`prisma/schema.prisma:22-29`, y `allocateInvoiceNumber` la lee y la escribe,
--    `invoiceNumber.service.ts:390`). Borrar los documentos NO reinicia la numeración.
--    Medido en dev: el merchant #1 tiene 5 facturas y `next_invoice_number = 6`; tras el
--    borrado seguiría emitiendo `2026-FG-006` con la tabla vacía.
--    ⛔ REINICIARLOS ES DECISIÓN DEL FUNDADOR, NO DE ESTA SESIÓN. Va abajo, comentado.
--
-- 2. LOS CLIENTES (`customers`). No son documentos.
--
-- 3. LOS COBROS (`charges`). Un cobro no es un documento. El vínculo es `invoices."chargeId"`
--    → `charges`, o sea que borrar facturas deja el cobro en pie, no al revés.
--    ❓ PREGUNTA ABIERTA: un cobro cuyo documento ya no existe queda sin respaldo. El fundador
--    decide si también se van.
--
-- 4. LA AUDITORÍA Y LOS MENSAJES (`audit_log`, `whatsapp_messages`, `email_messages`).
--    🔴 Referencian documentos de forma POLIMÓRFICA —`entity_type`+`entity_id`,
--    `related_type`+`related_id`— y por eso NO tienen clave ajena: nada las ata y nada las
--    borra en cascada. Quedarán apuntando a documentos que ya no existen.
--    ⛔ NO SE BORRAN AQUÍ A PROPÓSITO: son el registro de LO QUE PASÓ, y borrarlas convierte
--    un borrado de datos de prueba en un borrado de rastro. Decisión del fundador.
--
-- 5. NADA DE OTROS MERCHANTS QUE NO SEAN DE PRUEBA. Este guion borra de TODOS los merchants
--    porque el fundador lo ha decidido así y ha comprobado que el único ajeno tiene cero.
--    Si eso dejara de ser cierto, la verificación previa (fichero aparte) lo enseña ANTES.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- EL ORDEN, Y POR QUÉ CADA UNA VA DONDE VA
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Derivado de `prisma/schema.prisma`: de las SIETE columnas que apuntan a un documento, sólo
-- DOS tienen clave ajena declarada. Las otras cinco no las ata nada, así que **el orden no lo
-- impone la base: hay que imponerlo a mano**, y las huérfanas hay que limpiarlas explícitamente.
--
--   con FK  →  expenses.quote_id (SetNull) · invoices."quoteId" (SetNull)
--   SIN FK  →  albaran_lineas_facturadas.albaran_id · .invoice_id
--              albaranes.invoice_id · jobs.quote_id · maintenance_plans.quote_id
--
-- ⚠️ TRAMPA DE NOMBRES, medida: `quotes` e `invoices` declaran sus columnas en camelCase SIN
-- `@map` (`"merchantId"`, `"quoteId"`), mientras el resto usa snake_case. En Postgres hay que
-- entrecomillarlas o el identificador se pliega a minúsculas y la sentencia falla.
--
-- ⚠️ TODO EN UNA TRANSACCIÓN. Si algo falla a media lista, no queremos media base.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ① Las líneas de albarán ya facturadas. VAN PRIMERO porque apuntan a DOS documentos a la vez
--    (`albaran_id` e `invoice_id`) y NINGUNA de las dos columnas tiene clave ajena: si se borran
--    después, quedan filas apuntando a nada y la base no dice ni una palabra.
DELETE FROM albaran_lineas_facturadas;

-- ② Los partes de trabajo. Nadie los referencia (cero referencias entrantes, derivado del
--    schema), así que su sitio es aquí: antes que los albaranes, con los que comparten flujo.
DELETE FROM partes_trabajo;

-- ③ Los albaranes. Su `invoice_id` NO tiene clave ajena, así que tienen que irse ANTES que las
--    facturas: al revés quedarían apuntando a facturas borradas.
DELETE FROM albaranes;

-- ④ Las facturas y justificantes — la MISMA tabla, se distinguen por `type` ('F1' | 'JUST').
--    Se borran LAS DOS clases: la decisión del fundador es «todos los documentos».
--    `invoices."rectifiesId"` es una auto-referencia con SetNull; borrarlas todas de una vez la
--    resuelve sola. Y con ellas se va la CADENA DE HUELLAS (`vf_hash` / `vf_prev_hash` viven en
--    esta misma tabla, no hay tabla de registros aparte).
DELETE FROM invoices;

-- ⑤ Las referencias a presupuestos que NO tienen clave ajena. Hay que anularlas A MANO: la base
--    no lo hará, y un `jobs.quote_id` apuntando a un presupuesto borrado es una fila que miente.
--    (`expenses.quote_id` NO está aquí: sí tiene FK con SetNull y se anula sola.)
UPDATE jobs              SET quote_id = NULL WHERE quote_id IS NOT NULL;
UPDATE maintenance_plans SET quote_id = NULL WHERE quote_id IS NOT NULL;

-- ⑥ Los presupuestos, al final: es el documento del que cuelgan los demás.
DELETE FROM quotes;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ❓ PENDIENTE DE FIRMA DEL FUNDADOR — NO SE EJECUTA MIENTRAS SIGA COMENTADO
--
-- Reiniciar los contadores de serie. Si NO se hace, el primer documento tras el borrado seguirá
-- la numeración de los de prueba (medido en dev: `2026-FG-006` con la tabla vacía). Si SÍ se
-- hace, la serie empieza en 1 — que es lo coherente con «todo lo anterior era de prueba», pero
-- es una decisión sobre numeración fiscal y no la toma esta sesión.
--
-- UPDATE merchants SET
--   next_invoice_number      = 1,
--   next_rect_invoice_number = 1,
--   next_quote_number        = 1,
--   next_albaran_number      = 1,
--   invoice_series_year      = NULL,
--   albaran_series_year      = NULL;
-- ═══════════════════════════════════════════════════════════════════════════════════════════

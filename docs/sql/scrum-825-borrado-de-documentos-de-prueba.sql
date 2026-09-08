-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- SCRUM-825b · BORRADO DE TODOS LOS DOCUMENTOS DE PRUEBA — GUION EJECUTABLE
--
-- 🔴 ESTE FICHERO NO SE HA EJECUTADO EN NINGUNA BASE. Ni en dev. Lo ejecuta el FUNDADOR:
--    STAGING primero, PRODUCCIÓN después. La sesión que lo escribió sólo midió.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 QUÉ NO SE PUEDE DESHACER — LÉELO ANTES DE PEGAR NADA
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- NO HAY COPIA DE SEGURIDAD. Railway no la permite en este plan, y el fundador ha autorizado
-- por escrito ejecutar igualmente (8-sep-2026): son datos de prueba, ningún merchant real tiene
-- documentos, y SCRUM-525 auditó que NUNCA se ha remitido nada a la AEAT — de los nueve pasos
-- del camino de emisión, la cola de envío y el envío NO EXISTEN.
--
-- Eso NO baja el listón: lo sube. Sin copia, esto es irreversible línea por línea:
--
--   · **Las facturas y sus números.** Desaparecen las filas y con ellas la CADENA DE HUELLAS
--     (`vf_hash` / `vf_prev_hash` viven en la propia tabla). No se puede reconstruir: la huella
--     encadena con la anterior, y la anterior ya no está.
--   · **Los presupuestos**, con sus líneas, condiciones y firmas de aceptación.
--   · **Los albaranes y los partes**, con sus firmas.
--   · **Los cobros** (`charges`) y su historia (`events`, `reconciliations`): con ellos se va la
--     traza de qué pasarela dijo qué y cuándo.
--   · **Los contadores de serie vuelven a 1.** Después de esto, la primera factura real será la
--     `…-001`, y no hay forma de saber desde la base qué número tuvo la última de prueba.
--
-- LO QUE SÍ SOBREVIVE, y es deliberado: **el rastro** (`audit_log`, `whatsapp_messages`,
-- `email_messages`) y los **clientes**. Ver §③ abajo.
--
-- ⚠️ LEVANTA LA REGLA 29 (una factura emitida no se borra, no se edita, no se renumera).
--    Se levanta UNA VEZ, con fecha, motivo y firma del fundador (8-sep-2026).
--    🔴 NO ES PRECEDENTE. Fuera de este borrado único, la regla 29 sigue entera: una factura
--    emitida se rectifica con R1 o se anula con registro, jamás se borra.
--
-- ⛔ El aplicador de dev (`scripts/aplicar-sql-dev.mjs`) RECHAZARÁ este fichero, y hace bien:
--    su lista blanca no admite `DELETE`. No es un obstáculo que rodear — es la señal de que
--    esto no es una migración de rutina. Se ejecuta a mano, desde la consola de Railway.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- CÓMO SE EJECUTA
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--   1. Pasar `scrum-825-verificar-borrado.sql` — pasada **ANTES**. Guardar la salida.
--      🔴 En PRODUCCIÓN y EL MISMO DÍA: su bloque ① es la comprobación de que Tecnosel sigue a
--      CERO documentos. La de ayer no vale. **Si Tecnosel tiene alguno, NO se ejecuta esto.**
--   2. Pegar este fichero entero. Va en UNA transacción: o entra todo o no entra nada.
--   3. Pasar la verificación otra vez — pasada **DESPUÉS** — y COMPARAR las dos salidas.
--
-- Cada `DELETE` lleva al lado el recuento que debe salir: **el que dio la pasada ANTES para esa
-- tabla**. Si el número que devuelve no es ése, algo se ha movido entre las dos pasadas y hay
-- que parar y mirar, no seguir.
-- (Referencia de tamaño, medida en DEV el 8-sep-2026 — staging y producción tendrán otros:
--  invoices 5 · quotes 15 · charges 8 · albaranes 0 · partes_trabajo 0 · albaran_lineas 0.)
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- EL ORDEN, Y POR QUÉ CADA UNA VA DONDE VA — derivado de `prisma/schema.prisma`
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- De las SIETE columnas que apuntan a un documento, sólo DOS tienen clave ajena declarada. Las
-- otras cinco no las ata nada: **el orden no lo impone la base, hay que imponerlo a mano**, y
-- las huérfanas hay que limpiarlas explícitamente. Un `DELETE` en el orden equivocado NO daría
-- error — dejaría filas apuntando a nada, en silencio.
--
--   con FK  →  expenses.quote_id (SetNull) · invoices."quoteId" (SetNull)
--   SIN FK  →  albaran_lineas_facturadas.albaran_id · .invoice_id
--              albaranes.invoice_id · jobs.quote_id · maintenance_plans.quote_id
--
-- Y hacia `charges` hay CUATRO referencias, con dos comportamientos distintos:
--   RESTRICT →  events.charge_id · reconciliations.charge_id   (obligatorias, sin onDelete)
--   SetNull  →  quotes."chargeId" · invoices.charge_id
-- 🔴 Las dos primeras BLOQUEAN el borrado de un cobro. Por eso `events` y `reconciliations` van
--    LAS PRIMERAS: sin ellas, el `DELETE FROM charges` falla y tumba la transacción entera.
--
-- ⚠️ TRAMPA DE NOMBRES, medida y verificada una a una: la nomenclatura NO es uniforme.
--    camelCase SIN `@map`  →  quotes."merchantId" · quotes."chargeId" · invoices."merchantId"
--                             invoices."quoteId" · invoices."rectifiesId"
--    snake_case            →  invoices.charge_id · albaranes.invoice_id · jobs.quote_id
--                             maintenance_plans.quote_id · events.charge_id · …
--    En Postgres un identificador sin comillas se pliega a minúsculas: los camelCase VAN
--    ENTRECOMILLADOS o la sentencia falla.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ① LA HISTORIA DE LOS COBROS. VA LA PRIMERA, y no por orden lógico sino por una restricción
--    MEDIDA: `events.charge_id` y `reconciliations.charge_id` son obligatorias y SIN `onDelete`,
--    o sea RESTRICT. Con una sola fila aquí, el `DELETE FROM charges` de ⑨ falla y se cae toda
--    la transacción.
--    recuento esperado: el de `events` en la pasada ANTES.
DELETE FROM events;

--    recuento esperado: el de `reconciliations` en la pasada ANTES.
DELETE FROM reconciliations;

-- ②bis LAS ASIGNACIONES DE PERSONA AL DOCUMENTO (SCRUM-597, ya en `main`).
--
--    🔴 SE BORRAN EXPLÍCITAMENTE, Y NO PORQUE HAGA FALTA: PORQUE NO SE PUEDE MEDIR QUE NO HAGA
--    FALTA. El schema ya mezclado declara `onDelete: Cascade` en las CUATRO claves ajenas
--    (`schema.prisma:1596` y `:1613` hacia el documento; las otras dos van a `team_members`),
--    así que ⑤ y ⑦ deberían arrastrarlas solas.
--
--    Pero eso es lo que DECLARA Prisma, no lo que APLICA la base, y esa distinción es justo la
--    que decide aquí: la acción real vive en `information_schema.referential_constraints`, y
--    **no se ha podido leer desde ninguna base permitida** — en dev las dos tablas NO EXISTEN
--    (la migración de 597 no está aplicada allí), y staging y producción están prohibidas para
--    esta sesión. El fundador confirmó que las tablas EXISTEN en las dos; que su `DELETE RULE`
--    sea CASCADE es otra pregunta, y no se ha medido.
--
--    Con estas dos líneas el guion es correcto EN LOS DOS CASOS:
--      · si son CASCADE → borran filas que se habrían ido igual. Coste: cero. Y el recuento
--        queda a la vista, que es mejor que un borrado invisible.
--      · si alguna llegó como RESTRICT → son IMPRESCINDIBLES: sin ellas, ⑤ o ⑦ fallarían y —al
--        ir todo en una transacción— tumbarían el borrado entero.
--    Es más barato que acertar: quita la dependencia de un dato que no se puede comprobar.
--
--    ✅ El bloque ⑥ de la verificación mide el `DELETE RULE` de verdad. Si se pasa en STAGING
--       antes de ejecutar y salen las cuatro CASCADE, estas dos líneas se pueden quitar — pero
--       no hace falta quitarlas.
--    recuento esperado: el de cada tabla en la pasada ANTES (probablemente 0 si nadie ha
--    asignado a nadie todavía).
DELETE FROM invoice_assignees;
DELETE FROM quote_assignees;

-- ② Las líneas de albarán ya facturadas. Apuntan a DOS documentos a la vez (`albaran_id` e
--    `invoice_id`) y NINGUNA de las dos columnas tiene clave ajena: si se borran después,
--    quedan filas apuntando a nada y la base no dice ni una palabra.
--    recuento esperado: el de `albaran_lineas_facturadas` en la pasada ANTES.
DELETE FROM albaran_lineas_facturadas;

-- ③ Los partes de trabajo. Cero referencias entrantes (derivado del schema), así que su sitio
--    es aquí: antes que los albaranes, con los que comparten flujo.
--    recuento esperado: el de `partes_trabajo` en la pasada ANTES.
DELETE FROM partes_trabajo;

-- ④ Los albaranes. Su `invoice_id` NO tiene clave ajena, así que tienen que irse ANTES que las
--    facturas: al revés quedarían apuntando a facturas borradas.
--    recuento esperado: el de `albaranes` en la pasada ANTES.
DELETE FROM albaranes;

-- ⑤ Las facturas Y los justificantes — la MISMA tabla, se distinguen por `type` ('F1' | 'JUST').
--    Se borran LAS DOS clases: la decisión del fundador es «todos los documentos».
--    `invoices."rectifiesId"` es una auto-referencia con SetNull; borrarlas todas de una vez la
--    resuelve sola. Y con ellas se va la CADENA DE HUELLAS: `vf_hash`/`vf_prev_hash` son
--    columnas de esta misma tabla, no hay tabla de registros aparte.
--    (SCRUM-597 ya está en `main`: `invoice_assignees` declara Cascade y esta línea la
--    arrastraría sola. Se vacía igualmente en ②bis, por el motivo que allí se explica.)
--    recuento esperado: el de `invoices` en la pasada ANTES (facturas + justificantes).
DELETE FROM invoices;

-- ⑥ Las referencias a presupuestos que NO tienen clave ajena. Hay que anularlas A MANO: la base
--    no lo hará, y un `jobs.quote_id` apuntando a un presupuesto borrado es una fila que miente.
--    (`expenses.quote_id` NO está aquí: sí tiene FK con SetNull y se anula sola.)
--    recuento esperado: el de «jobs.quote_id colgando» de la pasada ANTES, bloque ③.
UPDATE jobs              SET quote_id = NULL WHERE quote_id IS NOT NULL;
UPDATE maintenance_plans SET quote_id = NULL WHERE quote_id IS NOT NULL;

-- ⑦ Los presupuestos: es el documento del que cuelgan los demás.
--    (Igual que ⑤: `quote_assignees` declara Cascade y se arrastraría sola; se vacía en ②bis.)
--    recuento esperado: el de `quotes` en la pasada ANTES.
DELETE FROM quotes;

-- ⑧ Los cobros, AL FINAL de los borrados. Van después de ① —que quita el RESTRICT— y después de
--    ⑤ y ⑦, que son quienes les apuntaban con SetNull: hacerlo al revés obligaría a la base a
--    actualizar filas que estaban a punto de desaparecer.
--    🔴 Decisión del fundador (8-sep-2026): SÍ se borran. «Un cobro de una factura que ya no
--    existe es dinero que nunca entró.»
--    recuento esperado: el de `charges` en la pasada ANTES.
DELETE FROM charges;

-- ⑨ LOS CONTADORES DE SERIE, REINICIADOS. Decisión del fundador (8-sep-2026): SÍ.
--    🔴 El siguiente número NO se deriva de contar filas: es una COLUMNA GUARDADA
--    (`prisma/schema.prisma:22-29`; `allocateInvoiceNumber` la lee y la escribe,
--    `invoiceNumber.service.ts:390`). Sin este `UPDATE`, con la tabla vacía y `next = 6`, la
--    PRIMERA FACTURA REAL saldría `2026-FG-006` — medido en dev el 8-sep-2026.
--    Los `*_series_year` se ponen a NULL con ellos: son el año de la serie EN CURSO, y una serie
--    que empieza de nuevo no tiene año en curso hasta que se emita el primer documento. Dejarlos
--    puestos con el contador a 1 sería declarar un ejercicio que ya no tiene documentos.
--    recuento esperado: tantas filas como merchants tenga la base (bloque ④ de la verificación).
UPDATE merchants SET
  next_invoice_number      = 1,
  next_rect_invoice_number = 1,
  next_quote_number        = 1,
  next_albaran_number      = 1,
  invoice_series_year      = NULL,
  albaran_series_year      = NULL;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- QUÉ **NO** BORRA ESTE GUION, Y POR QUÉ
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- ① LOS CLIENTES (`customers`). No son documentos.
--
-- ② 🔴 EL RASTRO: `audit_log`, `whatsapp_messages`, `email_messages`. SE QUEDAN ENTEROS.
--    Decisión del fundador (8-sep-2026), y el motivo es el que hace que sea la correcta:
--    **son el registro de LO QUE PASÓ, y borrarlos convertiría una limpieza de datos de prueba
--    en un borrado de auditoría.** Que apunten a ids muertos está BIEN: son un LOG, no una
--    relación — por eso referencian de forma polimórfica (`entity_type`+`entity_id`,
--    `related_type`+`related_id`) y por eso no tienen, ni pueden tener, clave ajena.
--    El bloque ⑤ de la verificación los cuenta para que se vea cuántos quedan apuntando a nada.
--
-- ③ NADA DE MERCHANTS AJENOS. Este guion borra de TODOS los merchants porque el fundador lo ha
--    decidido y ha comprobado que el único que no es suyo (Tecnosel) tiene CERO documentos.
--    🔴 Esa comprobación se REPITE en la pasada ANTES, contra PRODUCCIÓN y el mismo día. Si
--    Tecnosel tuviera aunque fuera uno, este guion NO se ejecuta tal cual.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ✅ RE-DERIVADO CON SCRUM-597 YA EN `main` (8-sep-2026, `main` = 1bbf60af)
--
-- El árbol se ha vuelto a derivar sobre el schema MEZCLADO, no sobre la rama. Resultado:
--
--   · `quote_assignees.quote_id`     → `quotes`,   onDelete **Cascade**  (`schema.prisma:1596`)
--   · `invoice_assignees.invoice_id` → `invoices`, onDelete **Cascade**  (`schema.prisma:1613`)
--   · las otras dos FK nuevas van a `team_members`, también Cascade: no apuntan a un documento
--     y no afectan a este orden.
--
-- ⇒ **EL ORDEN DEL GUION NO CAMBIA.** Ninguna llegó como RESTRICT, así que ninguna tiene que
--   subir por delante de su documento como tuvieron que hacer `events` y `reconciliations`.
--
-- 🔴 LÍMITE DECLARADO DE ESTA MEDICIÓN, porque no es lo mismo declarar que aplicar: lo anterior
--    es lo que dice el SCHEMA ya mezclado. La acción que la BASE aplica de verdad vive en
--    `information_schema.referential_constraints`, y **no se ha podido leer**: en dev las dos
--    tablas NO EXISTEN (la migración de 597 no está aplicada allí) y staging y producción están
--    prohibidas para la sesión que escribió esto.
--    Por eso ②bis las vacía explícitamente: así el guion es correcto con Cascade y sin él.
--    Y por eso el bloque ⑥ de la verificación lee el `DELETE RULE` de verdad — pásalo en
--    STAGING antes de ejecutar y quedará medido, no supuesto.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

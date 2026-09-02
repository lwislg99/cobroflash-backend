# SCRUM-643 · ¿Cuántas facturas emitidas llevan un albarán del mes que no toca?

**Medido contra:** `origin/main` = `9ae6ec070d76da8fbad21d8d6209f2ffd609eab6` · 2026-09-02T09:40:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance: ES UNA CONSULTA. No se arregla nada.** No se tocan los tres tests fiscales de
SCRUM-640 —siguen intactos a propósito, esperando al fundador—, ni `resolverFechaDeCobro`, ni el
PDF del albarán, ni `_navegador.mjs`, ni `guards-visuales.mjs`. **No se introduce ninguna «zona
fiscal del merchant»**: `Europe/Madrid` aparece en el SQL como *referencia de medición*, no como
concepto de producto.

**SOLO LECTURA.** Las tres consultas son `WITH` + `SELECT`. Ni una sentencia escritora: ningún
`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` ni `TRUNCATE`. Las dos de control no
tocan siquiera una tabla.

---

## 1 · Lo que la base de datos NO guarda, y cómo se rodea

Antes de escribir nada hubo que medir qué se puede saber:

* **El `mesKey` de la recapitulativa NO se guarda.** `recapitulativa.service.ts` agrupa por
  `mesNaturalKey` y emite, pero la factura no tiene ningún campo de periodo.
* **Tampoco queda rastro del origen.** El `origen: 'C7-recapitulativa'` va a
  `allocateInvoiceNumber` (a la numeración), **no a `invoices`**.
* Lo que sí hay: `albaranes.invoice_id` (que marca la propia transacción) y
  `invoices.albaran_refs` (JSONB con `{albaranId, numero, fecha}`).

**Cómo se rodea, y es un supuesto que se declara:** el producto agrupó por `mesNaturalKey(fecha)`
con el reloj del proceso, y el proceso de Railway va en **UTC** (sin variable `TZ`). Luego **el
mes al que la factura atribuyó sus albaranes ES el mes UTC de esos albaranes**, que por
construcción es el mismo para todos los del grupo.

> 🔴 **Ese supuesto se autoverifica.** El censo devuelve `meses_utc_distintos`. Si en alguna
> factura sale **> 1**, el supuesto es falso para ella y **no hay que creerse su veredicto**: hay
> que mirarla a mano. Un censo que no puede sostener su premisa tiene que decirlo, no callarla.

## 2 · Columnas comprobadas UNA A UNA contra el DDL, no generalizadas

Se sacó el DDL real con `prisma migrate diff --from-empty` (offline, sin tocar ninguna base). La
regla de `products` y la de `quotes` **no se exportaron**: cada tabla se miró:

| Tabla | Cómo son sus columnas |
|---|---|
| `albaranes` | **snake_case SIN excepción**: `id`, `merchant_id`, `job_id`, `numero`, `fecha`, `fecha_entrega`, `estado`, `invoice_id`, `created_at`… |
| `invoices` | **MEZCLA**: `"merchantId"`, `"customerId"`, `"quoteId"`, `"pdfUrl"`, `"qrData"`, `"registerId"`, `"createdAt"` son **camelCase y exigen comillas dobles**; `number`, `type`, `albaran_refs`, `paid_at`, `vf_estado` son snake_case |

Sin las comillas, Postgres pliega `"createdAt"` a `createdat` y **la consulta falla**. Los tipos
de fecha son `TIMESTAMP(3)` **sin zona**, de ahí el doble `AT TIME ZONE 'UTC' AT TIME ZONE
'Europe/Madrid'`: el primero declara que lo guardado es UTC, el segundo lo lleva al reloj de
pared español. Con uno solo la cuenta sale **al revés**.

## 3 · 🔴 LAS DOS DIRECCIONES, desde el principio

La lección del censo de SCRUM-633 —donde se preguntó por la firma «29 días» y aparecieron 16
filas con 31, su espejo, clasificadas como «no encaja»— se aplica aquí **antes** de escribir:

| Dirección | Cuándo | Qué produce |
|---|---|---|
| **Desfase POSITIVO** (península, +1/+2) | el instante UTC cae en las **últimas 1–2 h del mes** | en España ya es el mes SIGUIENTE → la factura del mes N lleva un albarán de N+1 |
| **Desfase NEGATIVO** (LATAM, −3 a −6) | el instante UTC cae en las **primeras 3–6 h del mes** | allí todavía es el mes ANTERIOR → la factura del mes N+1 lleva un albarán de N |

La positiva se mide **calculando el mes en Madrid**. La negativa se mide de forma **agnóstica**,
en **horas desde el arranque del mes en UTC**, y no fijando una zona: con −3 bastan 3 h, con −6
hacen falta 6. El umbral se pone en el techo (**6 h**) y **se devuelve el número de horas**, para
que se pueda afinar sin volver a escribir la consulta.

## 4 · Las consultas

### 4.1 · CONTROL POSITIVO 1 — la aritmética (no toca ninguna tabla)

Ocho casos sintéticos, las dos direcciones y el cruce de año. **Los ocho coinciden** con su
veredicto esperado, ejecutados contra Postgres real (base de DEV).

```sql
-- SCRUM-643 · CONTROL POSITIVO. SOLO LECTURA: no toca ninguna tabla, solo un VALUES sintetico.
-- Si algun `veredicto_obtenido` no coincide con su `veredicto_esperado`, EL CENSO NO VALE.
WITH casos(caso, fecha_albaran, veredicto_esperado) AS (VALUES
  ('INVIERNO · 31-ene 23:30 UTC = 1-feb 00:30 en Madrid (+1)',
   TIMESTAMP '2026-01-31 23:30:00', 'DESPLAZADO · en zona POSITIVA es del mes SIGUIENTE'),
  ('VERANO · 31-mar 22:30 UTC = 1-abr 00:30 en Madrid (+2)',
   TIMESTAMP '2026-03-31 22:30:00', 'DESPLAZADO · en zona POSITIVA es del mes SIGUIENTE'),
  ('CRUZA ANO · 31-dic 23:30 UTC = 1-ene 00:30 en Madrid',
   TIMESTAMP '2026-12-31 23:30:00', 'DESPLAZADO · en zona POSITIVA es del mes SIGUIENTE'),
  ('EL ESPEJO · 1-abr 02:00 UTC = 31-mar 20:00 en Mexico (-6)',
   TIMESTAMP '2026-04-01 02:00:00', 'RIESGO · en zona NEGATIVA seria del mes ANTERIOR'),
  ('EL ESPEJO, justo al filo · 1-abr 05:59 UTC',
   TIMESTAMP '2026-04-01 05:59:00', 'RIESGO · en zona NEGATIVA seria del mes ANTERIOR'),
  ('BORDE que NO lo es · 31-mar 21:30 UTC = 23:30 en Madrid',
   TIMESTAMP '2026-03-31 21:30:00', 'OK'),
  ('BORDE que NO lo es · 1-abr 06:30 UTC = 00:30 en Mexico, ya es abril alli',
   TIMESTAMP '2026-04-01 06:30:00', 'OK'),
  ('LEJOS de todo borde · 15-abr mediodia',
   TIMESTAMP '2026-04-15 12:00:00', 'OK')
), calc AS (
  SELECT caso, fecha_albaran, veredicto_esperado,
    -- El mes que USO EL PRODUCTO: `mesNaturalKey` corre con el reloj del proceso, y el proceso
    -- de Railway va en UTC (no hay variable TZ). Asi que el mes atribuido es el mes UTC.
    to_char(fecha_albaran, 'YYYY-MM')                                           AS mes_atribuido_utc,
    -- El mes en la peninsula. `Europe/Madrid` se usa aqui como REFERENCIA DE MEDICION, no como
    -- concepto de producto: no se introduce ninguna «zona fiscal del merchant».
    to_char((fecha_albaran AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')
                                                                                AS mes_en_madrid,
    -- Horas desde el arranque del mes en UTC: es la medida AGNOSTICA de la otra direccion.
    ROUND(EXTRACT(EPOCH FROM (fecha_albaran - date_trunc('month', fecha_albaran))) / 3600.0, 2)
                                                                                AS horas_tras_inicio_de_mes_utc
  FROM casos
)
SELECT caso, fecha_albaran, mes_atribuido_utc, mes_en_madrid, horas_tras_inicio_de_mes_utc,
  veredicto_esperado,
  -- 🔴 LAS DOS DIRECCIONES, y la positiva se mira PRIMERO porque es la que ya esta MEDIDA como
  -- defecto vivo (SCRUM-640). La negativa se expresa en HORAS y no en una zona concreta: con
  -- desfase -3 bastan 3 h, con -6 hacen falta 6. Se marca el techo (6 h) y se da el numero.
  CASE
    WHEN mes_en_madrid <> mes_atribuido_utc
      THEN 'DESPLAZADO · en zona POSITIVA es del mes SIGUIENTE'
    WHEN horas_tras_inicio_de_mes_utc < 6
      THEN 'RIESGO · en zona NEGATIVA seria del mes ANTERIOR'
    ELSE 'OK'
  END                                                                           AS veredicto_obtenido
FROM calc;
```

### 4.2 · CONTROL POSITIVO 2 — el censo ENTERO, con tablas sintéticas

El control anterior prueba la aritmética; **no prueba el `JOIN` ni las agregaciones**. Éste corre
el pipeline completo sustituyendo `albaranes` e `invoices` por filas de mentira, y ejercita **las
seis ramas** del veredicto. **Las seis coinciden.**

Hizo falta porque la base de DEV **no tiene ni un albarán**: sin esto, el censo se habría
entregado probado a medias.

```sql
-- SCRUM-643 · CONTROL POSITIVO 2: el censo ENTERO, con las tablas sustituidas por filas
-- sinteticas. SOLO LECTURA y sin tocar `albaranes` ni `invoices`. Prueba en el motor el JOIN,
-- las agregaciones por factura y las SEIS ramas del veredicto. Si alguna fila no coincide con
-- su `esperado`, el censo de la consulta siguiente NO VALE.
WITH albaranes_falsos(id, merchant_id, numero, fecha, estado, invoice_id) AS (VALUES
  -- Factura 1 · recapitulativa de marzo: uno normal + uno del 31-mar 22:30 UTC (= 1-abr en Madrid)
  (1, 10, 'ALB-1', TIMESTAMP '2026-03-10 09:00:00', 'firmado', 101),
  (2, 10, 'ALB-2', TIMESTAMP '2026-03-31 22:30:00', 'firmado', 101),
  -- Factura 2 · recapitulativa de marzo, las dos a mediodia: limpia
  (3, 10, 'ALB-3', TIMESTAMP '2026-03-05 12:00:00', 'firmado', 102),
  (4, 10, 'ALB-4', TIMESTAMP '2026-03-20 12:00:00', 'firmado', 102),
  -- Factura 3 · un solo albaran, 1-abr 02:00 UTC: el ESPEJO (zona negativa)
  (5, 10, 'ALB-5', TIMESTAMP '2026-04-01 02:00:00', 'firmado', 103),
  -- Factura 4 · declara DOS refs pero solo hay UNO ligado: no se puede juzgar
  (6, 10, 'ALB-6', TIMESTAMP '2026-05-10 12:00:00', 'firmado', 104),
  -- Factura 5 · el albaran es de OTRO merchant: tenencia
  (7, 99, 'ALB-7', TIMESTAMP '2026-05-11 12:00:00', 'firmado', 105),
  -- Factura 6 · la factura no declara `albaran_refs`: no se puede juzgar
  (8, 10, 'ALB-8', TIMESTAMP '2026-06-10 12:00:00', 'firmado', 106)
), invoices_falsas(id, "merchantId", number, type, "createdAt", albaran_refs) AS (VALUES
  (101, 10, 'A-2026-001', 'F1', TIMESTAMP '2026-04-02 10:00:00', '[{"albaranId":1},{"albaranId":2}]'::jsonb),
  (102, 10, 'A-2026-002', 'F1', TIMESTAMP '2026-04-02 10:00:00', '[{"albaranId":3},{"albaranId":4}]'::jsonb),
  (103, 10, 'A-2026-003', 'F1', TIMESTAMP '2026-05-02 10:00:00', '[{"albaranId":5}]'::jsonb),
  (104, 10, 'A-2026-004', 'F1', TIMESTAMP '2026-06-02 10:00:00', '[{"albaranId":6},{"albaranId":66}]'::jsonb),
  (105, 10, 'A-2026-005', 'F1', TIMESTAMP '2026-06-02 10:00:00', '[{"albaranId":7}]'::jsonb),
  (106, 10, 'A-2026-006', 'F1', TIMESTAMP '2026-07-02 10:00:00', 'null'::jsonb)
), esperado(factura_numero, veredicto_esperado) AS (VALUES
  ('A-2026-001', '*** DESPLAZADO · lleva albaran(es) de otro mes natural español ***'),
  ('A-2026-002', 'OK'),
  ('A-2026-003', 'RIESGO · solo si el merchant esta en desfase NEGATIVO'),
  ('A-2026-004', 'NO SE PUEDE JUZGAR · `albaran_refs` y los albaranes ligados NO CUADRAN'),
  ('A-2026-005', '🔴 TENENCIA: el albaran y la factura son de merchants DISTINTOS'),
  ('A-2026-006', 'NO SE PUEDE JUZGAR · la factura no declara `albaran_refs` como array')
), ligados AS (
  SELECT a.id AS albaran_id, a.numero AS albaran_numero, a.fecha, a.estado,
         a.merchant_id, a.invoice_id,
         i.number AS factura_numero, i.type AS factura_tipo, i."createdAt" AS factura_creada,
         i."merchantId" AS factura_merchant,
         CASE WHEN jsonb_typeof(i.albaran_refs) = 'array'
              THEN jsonb_array_length(i.albaran_refs) END AS refs_declaradas
  FROM albaranes_falsos a
  JOIN invoices_falsas i ON i.id = a.invoice_id
  WHERE a.invoice_id IS NOT NULL
), calc AS (
  SELECT *,
    to_char(fecha, 'YYYY-MM')                                                    AS mes_atribuido_utc,
    to_char((fecha AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')  AS mes_en_madrid,
    ROUND(EXTRACT(EPOCH FROM (fecha - date_trunc('month', fecha))) / 3600.0, 2)  AS horas_tras_inicio_de_mes_utc
  FROM ligados
), veredicto_albaran AS (
  SELECT *,
    CASE
      WHEN mes_en_madrid <> mes_atribuido_utc
        THEN 'DESPLAZADO · en zona POSITIVA es del mes SIGUIENTE'
      WHEN horas_tras_inicio_de_mes_utc < 6
        THEN 'RIESGO · en zona NEGATIVA seria del mes ANTERIOR'
      ELSE 'OK'
    END AS veredicto_albaran
  FROM calc
), por_factura AS (
  SELECT invoice_id, factura_numero, factura_tipo, factura_creada,
         MIN(refs_declaradas)                                        AS refs_declaradas,
         COUNT(*)                                                    AS albaranes_ligados,
         COUNT(*) FILTER (WHERE veredicto_albaran LIKE 'DESPLAZADO%') AS n_desplazados,
         COUNT(*) FILTER (WHERE veredicto_albaran LIKE 'RIESGO%')     AS n_riesgo,
         BOOL_OR(merchant_id <> factura_merchant)                     AS tenencia_no_cuadra
  FROM veredicto_albaran
  GROUP BY 1, 2, 3, 4
)
SELECT p.factura_numero, p.albaranes_ligados, p.refs_declaradas, p.n_desplazados, p.n_riesgo,
  e.veredicto_esperado,
  CASE
    WHEN p.tenencia_no_cuadra THEN '🔴 TENENCIA: el albaran y la factura son de merchants DISTINTOS'
    WHEN p.refs_declaradas IS NULL
      THEN 'NO SE PUEDE JUZGAR · la factura no declara `albaran_refs` como array'
    WHEN p.refs_declaradas <> p.albaranes_ligados
      THEN 'NO SE PUEDE JUZGAR · `albaran_refs` y los albaranes ligados NO CUADRAN'
    WHEN p.n_desplazados > 0
      THEN '*** DESPLAZADO · lleva albaran(es) de otro mes natural español ***'
    WHEN p.n_riesgo > 0
      THEN 'RIESGO · solo si el merchant esta en desfase NEGATIVO'
    ELSE 'OK'
  END                                                     AS veredicto_obtenido
FROM por_factura p JOIN esperado e ON e.factura_numero = p.factura_numero
ORDER BY p.factura_numero;
```

> El bloque `calc` + `veredicto_albaran` y el `CASE` del veredicto por factura son **idénticos
> byte a byte** entre este control y el censo (comparado con `Buffer.compare` quitando
> comentarios, y con control negativo cruzado del comparador). Si divergieran, el control estaría
> validando otra cosa.

### 4.3 · EL CENSO

```sql
-- SCRUM-643 · EL CENSO. SOLO LECTURA: unicamente WITH y SELECT, ni una sentencia escritora.
-- Columnas comprobadas UNA A UNA contra el DDL que emite Prisma, no generalizadas:
--   albaranes -> snake_case SIN excepcion: id, merchant_id, numero, fecha, estado, invoice_id
--   invoices  -> MEZCLA: "merchantId" y "createdAt" en camelCase (comillas OBLIGATORIAS);
--                number, type, albaran_refs en snake_case.
WITH ligados AS (
  SELECT a.id AS albaran_id, a.numero AS albaran_numero, a.fecha, a.estado,
         a.merchant_id, a.invoice_id,
         i.number AS factura_numero, i.type AS factura_tipo, i."createdAt" AS factura_creada,
         i."merchantId" AS factura_merchant,
         CASE WHEN jsonb_typeof(i.albaran_refs) = 'array'
              THEN jsonb_array_length(i.albaran_refs) END AS refs_declaradas
  FROM albaranes a
  JOIN invoices i ON i.id = a.invoice_id
  WHERE a.invoice_id IS NOT NULL
), calc AS (
  SELECT *,
    -- El mes que USO EL PRODUCTO: `mesNaturalKey` corre con el reloj del proceso, y el de
    -- Railway va en UTC (sin variable TZ). Luego el mes atribuido es el mes UTC.
    to_char(fecha, 'YYYY-MM')                                                    AS mes_atribuido_utc,
    -- `Europe/Madrid` es REFERENCIA DE MEDICION, no un concepto de producto: aqui no se
    -- introduce ninguna «zona fiscal del merchant».
    to_char((fecha AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')  AS mes_en_madrid,
    ROUND(EXTRACT(EPOCH FROM (fecha - date_trunc('month', fecha))) / 3600.0, 2)  AS horas_tras_inicio_de_mes_utc
  FROM ligados
), veredicto_albaran AS (
  SELECT *,
    CASE
      WHEN mes_en_madrid <> mes_atribuido_utc
        THEN 'DESPLAZADO · en zona POSITIVA es del mes SIGUIENTE'
      WHEN horas_tras_inicio_de_mes_utc < 6
        THEN 'RIESGO · en zona NEGATIVA seria del mes ANTERIOR'
      ELSE 'OK'
    END AS veredicto_albaran
  FROM calc
), por_factura AS (
  SELECT invoice_id, factura_numero, factura_tipo, factura_creada,
         MIN(refs_declaradas)                                        AS refs_declaradas,
         COUNT(*)                                                    AS albaranes_ligados,
         COUNT(*) FILTER (WHERE veredicto_albaran LIKE 'DESPLAZADO%') AS n_desplazados,
         COUNT(*) FILTER (WHERE veredicto_albaran LIKE 'RIESGO%')     AS n_riesgo,
         COUNT(DISTINCT mes_atribuido_utc)                            AS meses_utc_distintos,
         COUNT(DISTINCT mes_en_madrid)                                AS meses_madrid_distintos,
         BOOL_OR(merchant_id <> factura_merchant)                     AS tenencia_no_cuadra
  FROM veredicto_albaran
  GROUP BY 1, 2, 3, 4
)
SELECT
  CASE
    WHEN tenencia_no_cuadra THEN '🔴 TENENCIA: el albaran y la factura son de merchants DISTINTOS'
    WHEN refs_declaradas IS NULL
      THEN 'NO SE PUEDE JUZGAR · la factura no declara `albaran_refs` como array'
    WHEN refs_declaradas <> albaranes_ligados
      THEN 'NO SE PUEDE JUZGAR · `albaran_refs` y los albaranes ligados NO CUADRAN'
    WHEN n_desplazados > 0
      THEN '*** DESPLAZADO · lleva albaran(es) de otro mes natural español ***'
    WHEN n_riesgo > 0
      THEN 'RIESGO · solo si el merchant esta en desfase NEGATIVO'
    ELSE 'OK'
  END                                                     AS veredicto,
  CASE WHEN albaranes_ligados > 1 THEN 'AGRUPACION (>1 albaran): es recapitulativa'
       ELSE 'UN SOLO ALBARAN: puede ser recapitulativa de uno, o factura de albaran suelto' END
                                                          AS clase,
  factura_tipo, meses_utc_distintos, meses_madrid_distintos,
  COUNT(*)                                                AS cuantas_facturas,
  SUM(albaranes_ligados)                                  AS albaranes_implicados,
  SUM(n_desplazados)                                      AS albaranes_desplazados,
  MIN(factura_creada)::date                               AS desde,
  MAX(factura_creada)::date                               AS hasta
FROM por_factura
GROUP BY 1, 2, 3, 4, 5
UNION ALL
SELECT 'SIN LIGAR · albaranes sin `invoice_id` (aun no facturados: no se juzgan)',
       '—', '—', NULL, NULL, 0, COUNT(*), 0, MIN(a.fecha)::date, MAX(a.fecha)::date
FROM albaranes a WHERE a.invoice_id IS NULL
ORDER BY 1, 6 DESC;
```

### 4.4 · El detalle, para mirar los marcados uno a uno

Sin datos de cliente: sólo identificadores, fechas y meses.

```sql
-- SCRUM-643 · DETALLE. SOLO LECTURA. Los albaranes concretos que salen marcados, para poder
-- mirarlos uno a uno. Sin datos de cliente: solo identificadores, fechas y meses.
WITH calc AS (
  SELECT a.id AS albaran_id, a.numero AS albaran_numero, a.fecha, a.merchant_id,
         i.number AS factura_numero, i.type AS factura_tipo, i."createdAt" AS factura_creada,
         to_char(a.fecha, 'YYYY-MM')                                                   AS mes_atribuido_utc,
         to_char((a.fecha AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS mes_en_madrid,
         (a.fecha AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid')                     AS fecha_en_madrid,
         ROUND(EXTRACT(EPOCH FROM (a.fecha - date_trunc('month', a.fecha))) / 3600.0, 2)
                                                                                       AS horas_tras_inicio_de_mes_utc
  FROM albaranes a
  JOIN invoices i ON i.id = a.invoice_id
  WHERE a.invoice_id IS NOT NULL
)
SELECT albaran_id, albaran_numero, merchant_id, factura_numero, factura_tipo,
       fecha AS fecha_albaran_utc, fecha_en_madrid,
       mes_atribuido_utc, mes_en_madrid, horas_tras_inicio_de_mes_utc,
       CASE WHEN mes_en_madrid <> mes_atribuido_utc
              THEN 'DESPLAZADO · en zona POSITIVA es del mes SIGUIENTE'
            ELSE 'RIESGO · en zona NEGATIVA seria del mes ANTERIOR' END AS veredicto_albaran
FROM calc
WHERE mes_en_madrid <> mes_atribuido_utc
   OR horas_tras_inicio_de_mes_utc < 6
ORDER BY fecha;
```

## 5 · Cómo se lee, y sus límites DECLARADOS

* **La respuesta al ticket es la fila `*** DESPLAZADO ***`.** Si sale **0 facturas**, no hay
  documentos emitidos con error de periodificación y se arregla hacia adelante. Si sale > 0, hay
  facturas **emitidas** afectadas.
* **`RIESGO` no es `DESPLAZADO`.** Sólo muerde si ese merchant estuvo en desfase negativo. Se
  separa a propósito para no inflar el número con casos que quizá no lo son.
* **No se puede distinguir con certeza una recapitulativa de una factura de albarán suelto**,
  porque el origen no se guarda (§1). Se separa por número de albaranes: **> 1 es agrupación con
  certeza**; **= 1 es ambiguo**. La ambigüedad se muestra en la columna `clase` en vez de
  resolverse por decreto.
* **Los albaranes sin `invoice_id` salen en su propia fila**, no se descuentan en silencio: aún
  no están facturados y no se juzgan.
* **`meses_utc_distintos > 1` invalida el veredicto de esa factura** (§1).
* Se incluye `factura_tipo` para que una **R1** o un justificante no pasen inadvertidos dentro
  de un recuento de F1.
* **Lo que el censo NO ve:** una factura cuyos albaranes no llevaran `invoice_id` marcado
  quedaría fuera del `JOIN`. Por eso el censo compara `albaran_refs` con los albaranes ligados y
  saca **`NO SE PUEDE JUZGAR`** cuando no cuadran, en vez de devolver un número más pequeño.

## 6 · La decisión que NO se toma

Qué hacer con las facturas que salgan en `DESPLAZADO` —dejarlas, rectificarlas por R1, o
anularlas con registro— **es del fundador (regla 29)**: una factura emitida no se edita ni se
borra. Este documento sólo trae el número y cómo obtenerlo.

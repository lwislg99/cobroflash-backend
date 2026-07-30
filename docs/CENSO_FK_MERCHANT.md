# Censo de FK sobre `merchants` — el comando y por qué existe

> **SCRUM-192.** Read-only. Se ejecuta contra cualquiera de las tres BD (staging,
> `yaqu_dev_javier`, producción) y responde dos preguntas: **cuántas FK hay** y **si se podría
> crear una más sin limpieza previa**.

## Por qué hay un documento para dos `SELECT`

Porque la pregunta «¿cuántas tablas con `merchantId` tienen FK?» se respondió **tres veces con
tres números distintos** — 0, 2 y 12 — y los tres se defendieron de buena fe. Ninguno era un
desacuerdo sobre la realidad: **los tres eran artefactos del método**.

| Número | De dónde salió | Por qué era falso |
|---|---|---|
| **0** | consulta con `confrelid = '"Merchant"'::regclass` | la tabla real se llama `merchants` (`@@map`), no `Merchant`. El error «relation does not exist» se leyó como «0 filas». |
| **2** | censo filtrando por la columna `merchantId` | **la grafía de la columna no es uniforme**: `invoices` y `quotes` usan `merchantId`; las otras 19, `merchant_id`. Filtrar por la forma camelCase devuelve exactamente esas dos. |
| **12** | `pg_constraint` (28-jul) e `information_schema` (29-jul) | **el real.** Dos catálogos independientes, la misma respuesta. |

La lección no es «hay que medir mejor», es más concreta: **una consulta anclada a UN nombre —de
tabla o de columna— mide su propia suposición.** Por eso el comando de abajo busca **las dos
grafías** y **descubre las tablas en la base donde se ejecuta**, en vez de llevar dentro la lista
de otra.

## El comando

### Q1 · Censo: cuántas FK y con qué regla

```sql
SELECT c.table_name AS tabla,
       c.column_name AS columna,
       c.is_nullable AS acepta_null,
       COALESCE(fk.delete_rule, '>>> SIN FK <<<') AS on_delete
FROM information_schema.columns c
LEFT JOIN (
  SELECT tc.table_name, kcu.column_name, rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    AND ccu.table_name = 'merchants'
) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
WHERE c.table_schema = 'public' AND c.column_name IN ('merchantId','merchant_id')
ORDER BY (fk.delete_rule IS NULL) DESC, c.table_name;
```

### Q2 · Huérfanas: ¿se podría crear una FK sin limpieza previa?

```sql
SELECT c.table_name AS tabla,
       (xpath('/row/n/text()', query_to_xml(format(
         'SELECT count(*) AS n FROM public.%I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = t.%I)',
         c.table_name, c.column_name, c.column_name), false, true, '')))[1]::text::bigint AS huerfanas,
       (xpath('/row/n/text()', query_to_xml(format(
         'SELECT count(*) AS n FROM public.%I t WHERE t.%I IS NULL',
         c.table_name, c.column_name), false, true, '')))[1]::text::bigint AS con_null
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.column_name IN ('merchantId','merchant_id')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND ccu.table_name = 'merchants'
      AND tc.table_name = c.table_name AND kcu.column_name = c.column_name)
ORDER BY 2 DESC, 1;
```

**Las dos son solo lectura**: `SELECT` sobre catálogos y `COUNT`. No tocan una fila de datos de
cliente. `query_to_xml` ejecuta el `COUNT` que se le formatea — nada más.

## Medición de referencia — STAGING, 29-jul-2026

`information_schema`, con las dos barreras de `_db-guard.mjs` (allowlist de host + marcador
`YAQU_STAGING` de la propia BD) antes de leer nada.

```
UNIVERSO (tablas con columna de merchant): 21
FK que apuntan a "merchants":              12   — TODAS con ON DELETE RESTRICT
SIN FK:                                     9
HUERFANAS en las 9 sin FK:                  0   (y 0 filas con merchant_id NULL)
```

**Con FK (12):** `auth_sessions` · `charges` · `customer_events` · `customers` · `expenses` ·
`invoices` · `products` · `providers` · `quote_requests` · `quote_templates` · `quotes` ·
`team_members`

**Sin FK (9):** `albaran_lineas_facturadas` · `albaranes` · `attachments` · `audit_log` ·
`bot_sessions` · `jobs` · `legal_acceptances` · `maintenance_plans` · `whatsapp_messages`

> **0 huérfanas significa que en STAGING las FK se podrían crear sin limpieza previa.**
> **No vale para producción ni para `yaqu_dev_javier`**: son bases con otra historia, y la
> observación de SCRUM-194 (68 huérfanas en `audit_log` y `whatsapp_messages`) apunta a que
> allí puede no ser 0. Cada base se mide con su propio Q2 antes de crear nada.

## Qué NO son «logs»

La tentación al ver el reparto es pensar que las 12 con red son las de negocio y las 9 sin red
son telemetría. **No es así**, y es lo que más pesa del censo: entre las 9 están `jobs` (el
Trabajo, la entidad central del producto), `albaranes` y sus líneas, `attachments` y
`maintenance_plans`. Son datos de negocio y datos personales de clientes finales.

## `audit_log`: la ausencia de FK puede ser un REQUISITO, no un descuido

Ver **D-4** en `docs/legal/AUDITLOG_FISCAL_CONTRATO.md` §9 — *¿el registro fiscal sobrevive al
borrado del merchant?*, con la lectura de **conservar las filas fiscales redactadas**.

Si esa lectura se confirma, **cualquier** FK cierra esa puerta, no solo `Cascade`:

- `Cascade` → borra el registro fiscal junto al merchant. Contradice conservar.
- `Restrict` → para borrar el merchant hay que borrar antes sus filas. **También** contradice
  conservar.

Conservar una fila fiscal cuyo merchant ya no existe es, literalmente, **una huérfana a
propósito** — y eso **solo es posible sin FK**. Mientras D-4 siga en `[VALIDAR ASESOR]`,
`audit_log` va sin `onDelete` propuesto.

`legal_acceptances` tiene la misma forma (es la prueba de que hubo consentimiento) y **no tiene
su decisión escrita**. Se pregunta, no se decide.

---
*Medido el 29-jul-2026 con `information_schema`. El comando se probó contra staging antes de
entregarse para producción: da un comando sin verificar es el mismo error que este documento
existe para no repetir.*

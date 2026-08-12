# SCRUM-500 (A2-c) · La columna de suplidos, preparada y NO aplicada

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T12:45:13Z` · tabla `invoices`

**Medido contra:** `origin/main` = `bf54914117fb99e596aa7d638c9ebac8ac809564` · 2026-08-12T12:45:13Z

> 🛑 **NADA APLICADO.** Ni `prisma/schema.prisma`, ni ninguna base. `git status` de `prisma/` limpio.
> Jira: **En curso**, asignado.

## 0 · Qué es un suplido, para que se apruebe sabiendo qué se aprueba

**Un suplido es lo que el profesional paga POR CUENTA del cliente y le repercute tal cual: sin IVA
y sin margen** — una tasa municipal, el visado de un colegio profesional, una licencia de obra.

**Poner ahí un material propio es un error fiscal, no un despiste de clasificación:** el material se
compra para uno y se revende con su IVA y su margen; el suplido es dinero ajeno que solo pasa por la
cuenta del profesional.

## 1 · ¿`snake_case` o `camelCase`? — **snake_case, 18 a 13**

Contado sobre el modelo `Invoice`, columna a columna, suma comprobada (18 + 13 = 31 ✓):

| | |
| --- | --- |
| **`snake_case` (con `@map`) · 18** | `chargeId` `status` `paidAt` **`paidVia`** `clientComment` `stageLabel` `albaranRefs` `deductsRefs` `rectifiesId` `vfEstado` `vfHash` `vfPrevHash` `vfTimestamp` `vfAnulHash` `vfAnulTimestamp` `vfAnulPrevHash` `reminder7SentAt` `reminder14SentAt` |
| `camelCase` (sin `@map`) · 13 | `id` `merchantId` `customerId` `quoteId` `number` `total` `currency` `pdfUrl` `qrData` `registerId` `lines` `type` `createdAt` |

El recuento que recordabas era **16 a 7**; hoy es **18 a 13**. Y hay un corte más decisivo que el
total: **los 13 en camelCase son las columnas ORIGINALES de la tabla** (id, número, total, moneda,
líneas, tipo, fechas) y **las 18 en snake son las que se han ido añadiendo** — toda la familia
`vf*`, los recordatorios, y las tres hermanas de este mismo bloque: `paid_via`,
`retencion_irpf_*`, `recargo_equivalencia`.

**Para una columna NUEVA la convención no está 18-13: está 18-0.**

## 2 · ¿Admite «no consta»? — **sí, y encaja el patrón del RECARGO**

| Patrón | Por qué se eligió allí | ¿Encaja aquí? |
| --- | --- | --- |
| **Recargo** · `Boolean?` sin `@default` | el dato es booleano y `NULL` / `false` / `true` dan los tres estados nativos | **SÍ** |
| Retención · **dos** columnas | el dato era un TIPO (`Int?`) y «declaro que no retengo» **no tenía representación**: colapsaba con «no consta» en el mismo `NULL` | no hace falta |

**El dato de un suplido es un IMPORTE, y un importe tiene un cero legítimo.** Por eso basta una
columna nullable:

| Valor | Significa |
| --- | --- |
| `NULL` | **no consta** — la factura es anterior a la casilla, o nadie la miró |
| `0.00` | **declarado: esta factura no lleva suplidos** |
| `> 0` | el importe repercutido por cuenta del cliente |

Sin `@default`: un `0.00` por defecto convertiría **todas las facturas históricas** en «declarado que
no hay suplidos», que no lo ha dicho nadie. Es la misma decisión que en el recargo y por el mismo
motivo.

## 3 · 🔴 ¿POR FACTURA o POR LÍNEA? — **por LÍNEA, y esto cambia el ticket**

El ticket asume `Invoice` sin haberlo medido. Medido:

1. **Un suplido tiene concepto propio.** «Tasa municipal de licencia», «Visado del colegio». Un
   importe suelto en la factura **no dice qué se está repercutiendo**, y el cliente tiene derecho a
   verlo — es dinero suyo.
2. **Pueden ser varios en la misma factura** (una tasa *y* un visado). Un único `Decimal` los
   colapsa en un número.
3. **Y el sitio ya existe:** `InvoiceLine = VatLine & { [key: string]: unknown }`
   (`invoiceLines.service.ts:38`) — el tipo de línea **ya admite claves extra**, y `Invoice.lines`
   es `Json`. Marcar una línea como suplido **no necesita ninguna columna**.

**Así que la respuesta honesta es: el dato es por línea, y por línea no hace falta schema.**

### Pero la decisión de no hacerlo así ya está tomada, y sigue siendo buena

`docs/master/SCRUM-293.md` lo midió y lo decidió, con su tabla:

| | línea marcada (`suplido: true`) | campo propio |
| --- | --- | --- |
| Toca `calcVatBreakdown` | **SÍ** | no |
| Toca el sellado (vía la base del XML) | **SÍ** | no |
| Consumidores que deben aprender a ignorarla | **16** | 0 |
| Necesita campo de schema | no | **SÍ** |

**Marcar la línea es más fiel al dato y más caro en riesgo**: obliga a que dieciséis sitios aprendan
a saltarse una línea, y uno de ellos es el que sella.

**Lo que sí propongo, y no decido:** la columna **no sustituye** al detalle, lo **resume**. El
concepto de cada suplido puede vivir en su línea (Json, sin schema) y la columna llevar el **total
repercutido**, que es lo que el cálculo necesita para restarlo de la base sin recorrer líneas. Las
dos cosas no compiten.

⚠️ **Con la columna sola, el PDF no puede decir POR QUÉ se repercuten esos euros.** Es la
consecuencia de elegir el camino barato, y conviene que se elija sabiéndola.

## 4 · EL `ALTER TABLE`, listo para pegar

```sql
ALTER TABLE "invoices" ADD COLUMN "suplidos" DECIMAL(12,2);
```

**Verificación, detrás y en la misma sesión:**

```sql
-- Tiene que devolver EXACTAMENTE una fila: numeric · 12 · 2 · YES (nullable) · sin default.
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name = 'suplidos';

-- Y el suelo: cero filas significa que el ALTER no se aplicó, no que esté bien.
SELECT count(*) AS columnas_suplidos
FROM information_schema.columns
WHERE table_name = 'invoices' AND column_name = 'suplidos';
```

Si `column_default` viene con algo, **el ALTER no es éste**: la columna nace sin default a propósito.

**Generado con el CLI local y con su control positivo delante** (`--from-empty` devuelve **25
`CREATE TABLE`**, luego la herramienta ve el schema y el diff es de una línea porque el cambio lo
es). **100 % aditivo**: sin `DROP`, sin `ALTER` de columna existente, sin `NOT NULL`, **0 filas
afectadas** — todas quedan en `NULL`, que es «no consta».

## 5 · El campo Prisma, ESCRITO Y NO APLICADO

```prisma
model Invoice {
  …
  deductsRefs Json? @map("deducts_refs")
  // SCRUM-500 (A2-c) · SUPLIDOS: lo pagado POR CUENTA del cliente, repercutido sin IVA y sin margen.
  // NULL = no consta (facturas anteriores a la casilla) · 0.00 = declarado que no hay · >0 = importe.
  suplidos Decimal? @map("suplidos") @db.Decimal(12, 2)
  …
}
```

`Decimal(12,2)` — el mismo tipo y precisión que `Invoice.total` y que `approvalThreshold`: un
importe de factura, no un float.

## 6 · El orden, el mismo de las tres anteriores

**staging → verificar → producción → verificar → `schema.prisma` AL FINAL.**
`assertSchemaSinDeriva()` (`src/index.ts:23`) falla ante columnas **ausentes**; columnas de más no
son deriva. Al revés, producción arranca en deriva.

⚠️ **Y esta migración va SOLA**, como las otras tres.

## 7 · Lo que NO se ha hecho

`prisma/schema.prisma` intacto · ninguna base tocada · ninguna cadena de conexión escrita en ningún
sitio · el cálculo de la factura sin tocar · A2 retención · A3 · el sellado · la casilla y su
microcopy, que son el ticket siguiente y llevan marcador (regla 30).

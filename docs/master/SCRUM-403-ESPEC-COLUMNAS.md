# SCRUM-403 · Especificación de columnas del GASTO — para UNA sola migración

**Fecha:** 9-ago-2026 · **Estado:** ESPECIFICACIÓN, no aplicada · **Aplica:** el fundador

> ⚠️ **`prisma/schema.prisma` NO se toca desde aquí.** Este documento existe para que la migración
> se aplique **una vez** y sirva a los tres consumidores, en vez de tres migraciones seguidas.

## Por qué hace falta

`Expense` guarda **solo `amount`**, y **en ninguna parte está escrito si ese importe es con IVA o
sin él**. Sobre esa ambigüedad se apoyan tres cosas distintas:

| consumidor | qué necesita | hoy |
|---|---|---|
| **SCRUM-403** · beneficio neto | base del gasto, para restar base contra base | ❌ |
| **A5** · modelo 303 | IVA soportado **deducible** (cuota + si es deducible) | ❌ |
| **E4** · libro de facturas recibidas | base, tipo, cuota, deducible, nº y serie del proveedor, NIF | ❌ |

La lista de E4 no me la invento: está **medida en SCRUM-321 (E0, Q2) sobre el DMMF** y escrita en
`src/modules/fiscal/librosAeat/librosAeat.ts` — «de los ocho datos que pide un asiento de compra hay
dos completos, uno a medias y cinco que no existen».

## Las columnas

### En `Expense`

| columna | tipo | nullable | por qué |
|---|---|---|---|
| `baseAmount` | `Decimal @db.Decimal(12,2)` | **sí** (`Decimal?`) | la base imponible. Nullable **obligatoriamente**: las filas que ya existen no la tienen y no se puede deducir. |
| `vatRate` | `Int` | **sí** (`Int?`) | tipo de IVA en **entero de porcentaje** (21/10/4/0), la convención que ya usa `AlbaranLinea.tipoIva`. No la fracción de `Quote.lines[].tax`: mezclar las dos convenciones es un error conocido de esta casa. |
| `vatAmount` | `Decimal @db.Decimal(12,2)` | **sí** (`Decimal?`) | la cuota. **Se guarda, no se calcula al vuelo**: un redondeo distinto entre pantalla y libro es una discrepancia que nadie sabe explicar. |
| `vatDeducible` | `Boolean` | **sí** (`Boolean?`) | `null` = «nunca clasificado», distinto de `false` = «se decidió que no». Misma convención que `Customer.tipoDestinatario` (SCRUM-69). **Sin `@default`**, a propósito. |
| `providerInvoiceNumber` | `String?` | sí | nº y serie de la factura **del proveedor**, que es lo que identifica el asiento. |
| `providerInvoiceDate` | `DateTime?` | sí | fecha de EXPEDICIÓN de la factura del proveedor. `Expense.date` es la del apunte, y no son la misma. |

### En `Provider`

| columna | tipo | nullable | por qué |
|---|---|---|---|
| `taxId` | `String?` | sí | el NIF. Hoy `Provider` **no tiene ningún campo fiscal** (medido: 0). Sin él no hay asiento de compra posible. |

## Qué se hace con las filas existentes

**Nada. `amount` se queda como está y las nuevas columnas quedan a `null`.**

- **No se backfillea.** Deducir la base de `amount` exige saber si lleva IVA y a qué tipo, y **eso no
  está escrito en ninguna parte**. Suponerlo sería cometer el defecto que SCRUM-403 denuncia.
- **`null` es un dato, no un hueco**: significa «este gasto es un apunte de caja, no un asiento». El
  beneficio y el 303 deben **excluir** o **declarar** esas filas, nunca completarlas por su cuenta.
- Por eso **todas las columnas son nullable**. Una `NOT NULL` con `@default` rellenaría el pasado con
  una suposición y la haría indistinguible de un dato real.

## 🔴 Lo que esta especificación NO cubre

Para que nadie lea «columnas aplicadas» como «libro de recibidas resuelto»:

1. **No cierra E4.** Da el *dónde* guardar, no el *cómo se rellena*. Hace falta la pantalla que pida
   esos datos al registrar el gasto — y hoy el alta de gasto es deliberadamente rápida («desde la
   furgoneta», SCRUM-135). Pedir seis campos fiscales ahí **rompería ese flujo**, y esa es una
   decisión de producto, no de schema.
2. **No decide qué es deducible.** `vatDeducible` es un campo, no un criterio. Qué gasto lo es y bajo
   qué condiciones es dictamen fiscal, no código.
3. **No arregla el pasado.** Los gastos ya registrados siguen sin base, y toda cifra que los use
   tiene que decirlo.
4. **No cubre el suplido ni la inversión del sujeto pasivo**, que tienen tratamiento propio.
5. **No toca `Invoice`**: ese lado sí es derivable hoy con `calcVatBreakdown` sobre `lines`.

## Y una consecuencia que conviene ver antes de aplicar

Con las columnas puestas, **el beneficio pasa a tener dos poblaciones de gasto**: los que tienen base
y los que no. Mezclarlos en una sola cifra volvería a producir un número que no significa nada.

La cifra honesta será **«beneficio sobre los gastos clasificados»**, con el resto declarado aparte.
Eso es microcopy y lo aprueba el fundador (regla 30).

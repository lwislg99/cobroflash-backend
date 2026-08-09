# SCRUM-403 · «Beneficio neto» restaba cifras con IVA en los dos lados

**Fecha:** 9-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `5bf38619618979dda949b5f10c1ebc961c0345ee` · 2026-08-09T19:20:00+02:00

## El defecto, con fichero y línea

`reports.routes.ts:85` — `profit: monthlyRevenue[i] - monthlyExpenses[i]`

| lado | de dónde sale | ¿lleva IVA? |
|---|---|---|
| ingresos | `Invoice.total` (`:71`) | **sí** |
| gastos | `Expense.amount` (`:76`) | **no se sabe** |

Se repite en `:120` (totales del año), `:127` (año anterior) y `desgloseEmpleado.ts:118` y `:137`.

**No es un bug de cuentas.** El IVA repercutido no es ingreso: es dinero de Hacienda que el
profesional custodia. Sobre ese número la gente decide si puede comprarse la furgoneta.

## Lo que se entrega, y lo que NO se arregla hoy

Con los vectores del fundador: `1.000 + 210` contra `400 + 84`. El beneficio es **600**. Restando
totales salen **726** — 126 € de IVA enseñados como beneficio.

- **El lado de la FACTURA sí se puede derivar** y se hace: `baseDeFactura()` usa `calcVatBreakdown`
  sobre `lines`. Con su suelo: **si no hay líneas utilizables NO se inventa la base**, se devuelve
  `medible: false`. `null` no es cero — se sumarían igual y significan lo contrario.
- **El lado del GASTO no es derivable.** `Expense` solo tiene `amount` y **en ninguna parte está
  escrito si lleva IVA**. Suponerlo sería cometer el defecto que este ticket denuncia.

> **El beneficio sigue sin ser el beneficio hasta que el gasto tenga su base.** Hay un test que
> falla el día que `Expense` gane esas columnas, para que este aviso no sobreviva a su motivo.

## 🔴 El guard de SCRUM-389 retiró la mitad de mi diseño, y tenía razón

La primera versión traía un `sumaDeBases()` que agregaba el periodo. `SCRUM-389` lo cazó:

> «Lo que no vale es que aparezca uno **que agregue un PERIODO** sin que nadie lo mire: eso es una
> segunda cifra oficial del mismo trimestre, y ya pasó — `/admin/reports/vat` decía su propio total
> hasta SCRUM-389.»

**Censarlo como `DOCUMENTO` para pasar el guard habría sido mentir.** Se retiró.

Su criterio dice que quien agregue un periodo **lea el libro**. Medido: **hoy el libro no sirve para
esta cifra**.

| | libro | Informes |
|---|---|---|
| filtra por | `createdAt` (emisión) | **`paidAt`** (cobro) |
| `paidAt` en el asiento | **0 ocurrencias** | lo necesita para agrupar por mes |

`leerLibroRegistro(db, rango)` acepta rango arbitrario —año y meses ✅— pero una factura emitida en
marzo y cobrada en junio cae en meses distintos: **son dos poblaciones**. Hacerlo posible exige
**modificar el libro** (añadir `paidAt` al asiento o un filtro al rango), y el permiso sobre A6 era
de **lectura**. → **Otro ticket, otro GO.**

`baseSinIva.ts` queda censado como `DOCUMENTO`, con ese motivo escrito en el propio censo.

## El censo derivado de las cifras afectadas

Arreglar una instancia de un patrón y dejar las otras es dejar la trampa puesta con un cartel al
lado. El guard deriva por AST **todas** las cifras de Informes que suman o restan importes, con
suelo: **0 cifras → falla**, y exige al menos las cinco localizadas a mano.

## Los cinco rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | La base vuelve a ser el total con IVA | 🔴 **el test del vector**: «el beneficio sale 726 y son 600» |
| 2 | Sin líneas se devuelve 0 en vez de `null` | 🔴 «se sumarían igual y significan lo contrario» |
| 3 | Se aplica un 21 % supuesto | 🔴 «está aplicando un tipo supuesto en vez del desglose real» |
| 4 | Cegar el censo de importes | 🔴 SUELO: «devuelve 0 cifras» |
| 5 | La suma calla lo que no pudo medir | 🔴 nombrando las que quedaron fuera |

**Suelo en los datos:** hay test de que el fixture lleva IVA de verdad. Si base y total coincidieran,
el rojo no se ejercitaría y sería un verde hueco con otra forma. Fixtures con merchant id **7**.

---

## Especificación de columnas para UNA sola migración

> ⚠️ **`prisma/schema.prisma` NO se toca desde aquí.** Esto existe para que la migración se aplique
> **una vez** y sirva a todos los consumidores, en vez de cuatro migraciones seguidas.

### Por qué hace falta

`Expense` guarda **solo `amount`**, y en ninguna parte está escrito si ese importe es con IVA o sin
él. Sobre esa ambigüedad se apoyan tres cosas:

| consumidor | qué necesita | hoy |
|---|---|---|
| **SCRUM-403** · beneficio | base del gasto, para restar base contra base | ❌ |
| **A5** · modelo 303 | IVA soportado **deducible** | ❌ |
| **E4** · libro de recibidas | base, tipo, cuota, deducible, nº y serie del proveedor, NIF | ❌ |

La lista de E4 no me la invento: está **medida en SCRUM-321 (E0, Q2) sobre el DMMF** y escrita en
`src/modules/fiscal/librosAeat/librosAeat.ts` — «de los ocho datos que pide un asiento de compra hay
dos completos, uno a medias y cinco que no existen».

### En `Expense`

| columna | tipo | nullable | por qué |
|---|---|---|---|
| `baseAmount` | `Decimal @db.Decimal(12,2)` | **sí** | la base imponible. Nullable obligatoriamente: las filas existentes no la tienen y no se puede deducir |
| `vatRate` | `Int` | **sí** | tipo en **entero de porcentaje** (21/10/4/0), la convención de `AlbaranLinea.tipoIva`. **No** la fracción de `Quote.lines[].tax`: mezclar las dos convenciones es un error conocido de esta casa |
| `vatAmount` | `Decimal @db.Decimal(12,2)` | **sí** | la cuota. **Se guarda, no se recalcula**: un redondeo distinto entre pantalla y libro es una discrepancia que nadie sabe explicar |
| `vatDeducible` | `Boolean` | **sí** | `null` = «nunca clasificado», distinto de `false` = «se decidió que no». Convención de `Customer.tipoDestinatario` (SCRUM-69). **Sin `@default`**, a propósito |
| `providerInvoiceNumber` | `String?` | sí | nº y serie de la factura **del proveedor**: es lo que identifica el asiento |
| `providerInvoiceDate` | `DateTime?` | sí | fecha de **expedición** del proveedor. `Expense.date` es la del apunte, y no son la misma |

### En `Provider`

| columna | tipo | nullable | por qué |
|---|---|---|---|
| `taxId` | `String?` | sí | el NIF. `Provider` **no tiene hoy ningún campo fiscal** (medido: 0). Sin él no hay asiento de compra |

### En `Quote` — SCRUM-195, la mitad pendiente

| columna | tipo | nullable | por qué |
|---|---|---|---|
| `esAdicional` | `Boolean` | **sí** | distingue el presupuesto **adicional** del original. Medido: **el campo no existe** (0 ocurrencias en `src/`, `prisma/`) y `sendQuote.service.ts:31` lo dice literalmente — *«Depende del ROL del presupuesto (`Quote.esAdicional`), que es schema del fundador y está PENDIENTE. Deducirlo de otra cosa sería simular el rol.»* Nullable: los presupuestos anteriores no tienen rol asignado y `null` ≠ `false` |

Hoy `Quote.jobId` dice **a qué Trabajo pertenece**, pero no **si es el original o un adicional** —
un adicional aceptado tiene `jobId` igual que el original. Por eso el rol necesita campo propio.

### Qué se hace con las filas existentes

**Nada. `amount` se queda como está y las columnas nuevas quedan a `null`.**

- **No se backfillea.** Deducir la base de `amount` exige saber si lleva IVA y a qué tipo, y eso no
  está escrito en ninguna parte.
- **`null` es un dato**: significa «este gasto es un apunte de caja, no un asiento». El beneficio y
  el 303 deben **excluir o declarar** esas filas, nunca completarlas.
- Por eso **todas son nullable**. Una `NOT NULL` con `@default` rellenaría el pasado con una
  suposición y la haría indistinguible de un dato real.

### 🔴 Lo que esta especificación NO cubre

Para que nadie lea «columnas aplicadas» como «libro de recibidas resuelto»:

1. **No cierra E4.** Da el *dónde* guardar, no el *cómo se rellena*. Hace falta la pantalla que pida
   esos datos — y el alta de gasto es deliberadamente rápida («desde la furgoneta», SCRUM-135).
   Pedir seis campos fiscales ahí **rompería ese flujo**: es decisión de producto, no de schema.
2. **No decide qué es deducible.** `vatDeducible` es un campo, no un criterio. Eso es dictamen fiscal.
3. **No arregla el pasado.** Los gastos ya registrados siguen sin base, y toda cifra que los use
   tiene que decirlo.
4. **No cubre el suplido ni la inversión del sujeto pasivo.**
5. **No toca `Invoice`**: ese lado sí es derivable con `calcVatBreakdown`.
6. **No completa SCRUM-195**: da el campo, no la lógica que lo rellena ni la que lo consume.

### Modelo 130 (IRPF) — medido, y NO añade nada

Buscado en `src/`: **cero rastro de IRPF o del 130**. Con `baseAmount` + `vatDeducible` el 130 tiene
lo que necesita del gasto (ingresos y gastos deducibles se calculan **sobre la base**, no sobre el
total), así que **no pido columnas extra para él**. Lo que le faltaría —retenciones practicadas— es
del lado de la **factura**, no del gasto, y no entra en esta migración.

### Una consecuencia que conviene ver antes de aplicar

Con las columnas puestas, **el beneficio pasa a tener dos poblaciones de gasto**: los que tienen base
y los que no. Mezclarlos en una cifra volvería a producir un número que no significa nada. La cifra
honesta será **«beneficio sobre los gastos clasificados»**, con el resto declarado aparte — y eso es
microcopy que aprueba el fundador (regla 30).

---

## Microcopy propuesta (regla 30 — NO escrita)

Mientras el número no sea el beneficio, **«Beneficio neto» no puede decirse**. Propuesta, para que
la apruebes o la cambies:

| hoy | propuesta | por qué |
|---|---|---|
| `Beneficio neto` | **`Facturado menos gastos`** | dice **exactamente** lo que el número es: una resta de lo que entró menos lo que salió, sin afirmar que sea beneficio |
| — | nota al pie: **`No descuenta el IVA de los gastos`** | el hueco, a la vista, en vez de un número que parece más limpio de lo que es |

**Y una cifra honesta con otro nombre es mejor que ninguna**, como decías: quitar el dato dejaría al
profesional sin nada, y lo que hay —lo facturado menos lo gastado— **sí es cierto**; lo que no es
cierto es llamarlo beneficio.

Cuando la migración esté aplicada y los gastos tengan base, el rótulo puede volver a ser
**`Beneficio`** — con su propia aprobación y contando solo los gastos clasificados.

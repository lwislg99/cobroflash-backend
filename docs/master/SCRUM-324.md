# SCRUM-324 · E3: el hueco del modelo del gasto, MEDIDO (informe, cero construcción)

**Fecha:** 7-ago-2026 · **Carril:** E (medición) · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T18:51:38Z

> **No se ha construido nada.** Ni una línea de dominio, ni un test de comportamiento, ni un campo.
> `prisma/schema.prisma` **solo se ha leído**. Regla 38: leer no es tocar.

---

## 🔴 LA DISCREPANCIA, que es el motivo de parar antes de construir

**E3 (este ticket) especifica TRES campos. El libro de facturas recibidas necesita más.**

Construir los tres de E3 **NO desbloquearía** el libro de recibidas de SCRUM-325 (E4). Se dice
aquí porque en la entrega de E4 quedó escrito que «con ellos el libro deja de estar bloqueado», y
**con los tres de E3 no es así**: faltarían tipo de IVA, cuota, deducible, y el número de la
factura del proveedor.

Y el segundo motivo para parar: esos campos viven en `prisma/schema.prisma`, que es **dominio
exclusivo del fundador**. Construir el dominio sin los campos repetiría lo de A2/A3 — módulos con
tests, sin llamadores, esperando un schema que nadie ha tocado.

---

## 1 · Qué tiene HOY `Expense`

**Ya estaba medido en SCRUM-321 (E0, Q2) y no se re-deriva** — se cita y se contrasta contra el
schema de hoy, que sigue igual: **14 escalares + 3 relaciones**.

`id` · `merchantId` · `quoteId?` · `providerId?` · `concept` · `amount` (`Decimal(12,2)`) ·
`currency` (`"EUR"`) · `category` (`"otros"`) · `date` (`now()`) · `notes?` · `receiptData?` ·
`teamMemberId?` · `createdAt` · `updatedAt`.

⚠️ **`category` NO es contable.** Son cinco categorías de oficio —`materiales`, `desplazamiento`,
`herramientas`, `subcontrata`, `otros`— y **no se puede inferir de ellas un tipo de IVA**: nada dice
que «materiales» sea 21 %.

⚠️ **`amount` no declara qué es.** No hay ningún campo, comentario ni validación que diga si el
profesional teclea la base o el total con IVA. Hoy da igual —solo se usa para margen— y **deja de
dar igual en cuanto haya un libro**.

## 2 · Qué tiene HOY `Provider` — confirmado campo por campo

`id` · `merchantId` · `name` · `phone?` · `email?` · `notes?` · `isActive` · `createdAt` ·
`updatedAt`.

**CERO campos fiscales.** Ni `taxId`, ni `legalName`, ni domicilio. Confirmado.

> **Y la asimetría que lo enmarca:** `Customer` **sí** tiene `legalName` y `taxId` (entraron en el
> lote EXT3). El mismo concepto —la contraparte de una operación— tiene identidad fiscal en el lado
> de la VENTA y ninguna en el lado de la COMPRA. No es que falte un campo: es que el proveedor
> nunca se modeló como sujeto fiscal.

## 3 · La lista UNIFICADA — una sola tabla

| # | Campo | ¿Lo pide **E3**? | ¿Lo pide el **libro de recibidas**? | ¿Existe hoy? | ¿Exige `schema.prisma`? |
| --- | --- | :---: | :---: | --- | --- |
| 1 | **Fecha** | ✅ | ✅ | ✅ `Expense.date` | **NO** — ya está |
| 2 | **Importe total** | ✅ | ✅ | ⚠️ `Expense.amount`, pero **sin declarar** si es base o total | **NO** para el número · **SÍ** si se quiere declarar qué significa |
| 3 | **NIF del proveedor** | ✅ | ✅ | ❌ `Provider` no tiene ni un campo fiscal | **SÍ** |
| 4 | **Base imponible** | ❌ | ✅ | ❌ | **SÍ** *(o derivable — ver §4)* |
| 5 | **Tipo de IVA** | ❌ | ✅ | ❌ · **no inferible** de `category` | **SÍ** |
| 6 | **Cuota de IVA** | ❌ | ✅ | ❌ | **NO — DERIVABLE** de 4 × 5 |
| 7 | **¿Deducible?** | ❌ | ✅ | ❌ | **SÍ** |
| 8 | **Razón social del proveedor** | ❌ | ✅ | ⚠️ `Provider.name` existe, pero es el nombre **comercial**; `Customer` distingue `name` de `legalName` y `Provider` no | **SÍ** (o decidir que `name` vale) |
| 9 | **Nº y serie de la factura del proveedor** | ❌ | ✅ | ❌ | **SÍ** |

**Resumen:** de los 9, **E3 pide 3** (dos ya existen) y **el libro necesita los 9**. Los cinco que
la entrega de E4 llamó «los que faltan» son 3, 4, 5, 6 y 7 — el núcleo; **8 y 9 también faltan** y
no estaban en esa cuenta.

*(Fuera de tabla y anotado: **retención de IRPF** y **cuándo y cómo se pagó el gasto** —`Expense` no
tiene `paidAt` ni método—. No los pide ninguno de los dos tickets; se dejan visibles porque un
asiento de compra completo los acaba pidiendo.)*

## 4 · Qué exige schema y qué se puede derivar

**Exigen `prisma/schema.prisma` (y por tanto al fundador):** 3, 4, 5, 7, 8 y 9.

**NO lo exige — y es el hallazgo más barato de este censo: la CUOTA (6).**

`cuota = base × tipo`. No es un campo que capturar: es una derivación. Y **ya existe la forma en
casa**: `calcVatBreakdown` (`vat.service.ts:17`) hace exactamente eso en el lado de la venta —
recorre las líneas, agrupa por tipo y calcula `base` y `cuota` sin que nadie teclee la segunda.

> **Capturar base y cuota por separado crea un problema que capturar base y tipo no tiene.**

Consecuencia para quien decida el alcance: **con dos campos nuevos (tipo de IVA y la declaración de
qué es `amount`) se obtienen tres de los datos del libro (4, 5 y 6)**, en vez de tres campos para
tres datos.

**Y el 2 no necesita columna, necesita una DECISIÓN:** si se declara que `amount` es el **total con
IVA**, la base se deriva (`total ÷ (1 + tipo)`). Si se declara que es la **base**, el total se
deriva. Lo que no puede seguir es sin declarar — hoy los dos lectores posibles darían cifras
distintas del mismo gasto.

## 5 · Dos números tecleados que deben cuadrar: la forma YA está resuelta en casa

La pregunta no está en ninguno de los dos tickets y tiene **dos respuestas**, en este orden:

### ① La barata: que el problema no exista

En VENTAS **nadie teclea la cuota**: sale de base × tipo (`calcVatBreakdown`). No hay dos números
que cuadrar porque solo se captura uno. Es el principio de la casa —*imposible mejor que
vigilado*— y es la opción que hay que descartar primero antes de construir cualquier aviso.

### ② Si aun así se teclean los dos, la forma a copiar es `payment-anomaly`

Ocurre de verdad: la factura de un proveedor puede traer una cuota que **no es exactamente**
base × tipo por redondeos de su propio programa. Para eso el producto ya tiene una forma decidida
—**`POST /admin/invoices/:id/payment-anomaly`** (A21.2, runbooks V4/V5,
`invoicesAdmin.routes.ts:215`)— y sus cinco rasgos son justo lo que hace falta aquí:

1. **No decide nada automáticamente.** Su propio comentario: *«F1 = NADA automático: si llegó un
   importe DISTINTO, la factura sigue pending y aquí solo se ANOTA»*.
2. **No ajusta ninguno de los dos números.** Ni toca el total ni corrige lo recibido.
3. **Nombra la DIRECCIÓN del descuadre** — `parcial` vs `sobrepago`, dos nombres distintos, no un
   «no cuadra» genérico. Aquí serían «cuota mayor de la esperada» y «cuota menor».
4. **Deja rastro consultable** (`recordCustomerEvent`, tipo `payment_anomaly`, en la ficha 360), no
   un `console.log` que se pierde.
5. **Dice la siguiente acción concreta** y remite al runbook.

⚠️ **Y una advertencia que sale de medir, no de opinar: hoy no existe ninguna noción de TOLERANCIA
en el árbol.** `vat.service.ts` solo tiene `round2`. Una comparación estricta entre `base × tipo` y
la cuota tecleada marcaría como descuadre una diferencia legítima de **un céntimo**, que es la
fábrica de falsos rojos de siempre. Si se construye el aviso, la tolerancia es una decisión
explícita, no un detalle de implementación.

---

## Lo que este informe NO cubre, dicho para que no se le suponga

* **OCR e IA quedan FUERA y ni se miden como opción.** Dependencia nueva y coste recurrente: regla
  36, decide el fundador.
* **Cero microcopy fiscal.** No se propone el texto del aviso del régimen simplificado ni ningún
  otro: un texto fiscal mal escrito le dice a un profesional qué puede deducirse, y eso lo aprueba
  el asesor antes de escribirse.
* **No se decide el alcance.** Esta medición dice qué falta, qué cuesta schema y qué se deriva. Qué
  entra en E3 y qué se le pide al fundador lo decide el asesor.
* **No se ha mirado ninguna base de datos.** Todo sale del schema y del código.

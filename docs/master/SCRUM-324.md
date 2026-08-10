# SCRUM-324 · E3: el hueco del modelo del gasto, MEDIDO (informe, cero construcción)

**Fecha:** 7-ago-2026 · **Carril:** E (medición) · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `572c9414f620f70ef4e980ca4948fccbaf9c47ea` · 2026-08-07T19:07:56Z

> El ancla es la de la **declaración de `amount`** (apartado 1b). El censo original se midió contra
> `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T18:51:38Z y **se ha
> re-verificado contra este main**: `Expense` y `Provider` siguen **idénticos, campo por campo**
> — ningún campo que se diera por inexistente ha aparecido. El censo sigue siendo cierto.

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

⚠️ **`amount` no declaraba qué es.** No había ningún campo, comentario ni validación que dijera si
el profesional teclea la base o el total con IVA. Ya está decidido — ver el apartado siguiente.

## 1b · ✅ DECLARADO: `Expense.amount` es el IMPORTE TOTAL, con IVA incluido

**Decisión del asesor, 7-ago-2026.** Y no es una preferencia: **es lo que el producto ya asumía**.

### La prueba, en tres líneas del árbol

```
reports.routes.ts:71   monthlyRevenue[m] += Number(inv.total);
reports.routes.ts:85   profit = Math.round((monthlyRevenue[i] - monthlyExpenses[i]) * 100) / 100;
recargoEquivalencia.ts:31   «Invoice.total = grossOfLines() = base + cuota»
```

El «Beneficio neto» de Informes **resta gastos a una facturación que lleva IVA**. Esa resta solo
cuadra si el gasto también lo lleva. O sea: la declaración no cambia ni una cifra — **pone por
escrito lo único bajo lo cual el cálculo de hoy tiene sentido**.

### 🔴 LA RESPUESTA CORRECTA POR EL MOTIVO EQUIVOCADO SIGUE SIN ESTAR VERIFICADA

El motivo que se iba a dar por bueno era otro: *«es lo que el profesional lee del ticket del
proveedor»*. Es cierto y es buena razón de producto, pero **no ata nada**: si mañana alguien decide
que el formulario pida la base, ese argumento no se opone — solo cambia lo que se teclea. El que
ata es el de arriba, porque nombra **un cálculo vivo que se rompería en silencio**.

> **Acertar por el motivo equivocado deja la decisión sin verificar: el día que el motivo cambie,
> nadie sabrá que la conclusión dependía de otra cosa.**

Por eso la declaración va con la prueba pegada y no sola.

### Qué CIERRA esta declaración

**No hay defecto vivo entre lectores**, y por tanto **esto NO bloquea E3.** Censo por MODELO
(accesos a `Expense`, no apariciones de la palabra «amount»): **4 escrituras y 12 lecturas**.

* **Ningún lector interpreta `amount`**: nadie le aplica un tipo de IVA ni lo divide por `(1+tipo)`.
  Búsqueda explícita de `1.21`, `/(1+`, `*0.21`, `iva`, `vat`, `tax`, `base` sobre gastos, métricas,
  informes y exports: **cero resultados**. Todos lo SUMAN.
* **Los tres sitios donde lo ve alguien dicen «Importe» a secas** —formulario
  (`expensesView.js:282`), tabla (`:210`) y CSV que va al asesor (`exportData.ts:330`)—, ninguno
  «Importe total» ni «Base imponible». No había declaración de facto en pantalla.
* **El gasto no entra en NADA fiscal:** cero menciones de `Expense` en el modelo 303 (A5), en el
  libro de registro (A6), en el paquete de evidencias (A7) y en VeriFactu. Eso acota el daño de
  cualquier error aquí: llega al «Beneficio neto» que el profesional mira, no a un documento
  oficial.
* **El importador (D1 / SCRUM-312) NO escribe gastos**: los importadores son de clientes
  (`importarClientes.service.ts`) y de productos.

### Qué ABRE — y es **SCRUM-403**, que no se arregla aquí

El «Beneficio neto» resta **cifras con IVA en los dos lados**, y el IVA no es ni ingreso propio ni
gasto propio: es dinero de la Hacienda que pasa por la cuenta. La resta cuadra internamente y el
número está inflado por arriba y por abajo. **Va en SCRUM-403** (regla 9: se reporta, no se
arregla). La declaración de este apartado no lo causa —ya estaba— pero lo deja a la vista.

### ⚠️ Técnica para la próxima sesión: un censo de propiedades pierde los spreads

El primer barrido dio **3 escrituras** y marcó `updateExpense` como «no escribe amount». **Sí lo
escribe**: pasa el objeto entero (`prisma.expense.update({ where, data })`,
`expenses.service.ts:177`), y un censo que busca `amount:` como propiedad literal **no ve un
spread**. Son 4, no 3.

> **Si censas un campo por AST, cuenta también los objetos que se pasan enteros: una propiedad
> literal se ve, una variable propagada no.**

Misma familia que `already_paid` (SCRUM-325): allí el peligro era contar de más —una palabra que no
era un estado—, aquí contar de menos. **En los dos casos la regla es la misma: mira lo que llega al
modelo, no lo que se parece al nombre del campo.**

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


---

# SCRUM-324 (E3) · segunda entrega: EL DOMINIO DEL JUSTIFICANTE

**Medido contra:** `origin/main` = `8159ee4a200c1623493402ecca0bff57b0ca814c` · 2026-08-10T15:23:34+02:00
**Rama:** `scrum-324-gasto-usable`

**10-ago-2026, 15:23 CEST (UTC+0200)** · commit `06928ffdde167a6e857b1dc377cb16ac1e7495f3`

La primera entrega (7-ago) midio el hueco y paro. Ya no esta bloqueada: **las seis columnas de
`Expense` y `providers.tax_id` estan en produccion**, con su semantica decidida en el propio schema.

## Lo que cambia respecto al censo del 7-ago

El censo decia «`Provider` no tiene ni un campo fiscal» y «faltan tipo, cuota, deducible y el numero
de la factura del proveedor». **Ya estan**: `baseAmount`, `vatRate`, `vatAmount`, `vatDeducible`,
`providerInvoiceNumber`, `providerInvoiceDate` y `Provider.taxId`. Verificado contra `origin/main`,
no supuesto — el schema de mi arbol iba detras y lo primero fue comprobarlo.

## La correccion legal, que ordena el diseno entero

**Un ticket o factura SIMPLIFICADA no permite deducir el IVA soportado.** La excepcion es la
**simplificada CUALIFICADA**: NIF del **DESTINATARIO** —el del profesional, no el del proveedor— y
**cuota desglosada**. La v1 listaba el NIF del proveedor, que es otro campo.

## La decision de diseno: el veredicto tiene TRES valores

**Si el papel lleva o no el NIF del profesional no esta en ningun campo.** Es un hecho del
documento, no del modelo.

- Darlo por **SI** repite el error legal de la v1.
- Darlo por **NO** convierte el aviso en ruido, y un aviso que salta siempre se aprende a ignorar
  igual que uno que no salta nunca.

Por eso existe `falta_confirmar`, y lo confirma una persona. Es el mismo principio que regiria el
OCR si algun dia entra: **lo que no se puede comprobar se propone; nunca se da por bueno.** Encaja
ademas con la semantica que el schema ya declaro para `vatDeducible`: `null` = nunca clasificado,
`false` = se decidio que no.

## Cero microcopy, y no es prudencia

El modulo devuelve **codigos**, no frases. Las dos preguntas estan en
`docs/legal/PREGUNTAS_ASESOR.md` con tres versiones propuestas — incluida una que **evita la palabra
«deducir»**, porque un ticket **si** puede ser gasto deducible en IRPF en estimacion directa y decir
«no te lo puedes deducir» a secas seria **falso por exceso**. Mientras no haya respuesta aprobada,
el producto **no dice nada**: mejor un hueco que un relleno que tranquiliza.

## Las verificaciones que exigia el ticket

| exigida | como |
|---|---|
| una factura completa **no** dispara el aviso | control negativo explicito — si avisara siempre seria ruido |
| sin NIF de proveedor no entra en silencio | veredicto `no_deducible` y el fallo **lo nombra** |
| el mismo ticket dos veces **pasa siempre** | clasificar no es dar de alta; un «ya lo vi» no vive aqui |
| `Number('')` es 0 y `0 \|\| 1` es 1 | `aCentimos` separa vacio (`null`) de cero (`0`); **ni un `\|\|`** en ese camino |
| suelo | los **tres** veredictos son alcanzables: si no, el aviso seria una constante disfrazada |

## Dos trampas del schema, respetadas

- **`vatRate` es entero de porcentaje** (21/10/4), no la fraccion de `Quote.lines[].tax`. Un
  `0 < tipo < 1` se declara como incoherencia: mezclarlas multiplica el IVA por cien sin que nada falle.
- **Tolerancia de un centimo.** El censo §5 midio que no existe ninguna nocion de tolerancia en el
  arbol. En estricto, el redondeo del programa del proveedor seria la fabrica de falsos rojos. Y una
  incoherencia **no cambia el veredicto, solo se anota** — doctrina de `payment-anomaly` (A21.2).

## Un hallazgo de entorno, no del codigo

El build fallo con `'deductsRefs' does not exist`. **No era main:** el schema si lo tiene y el
cliente de Prisma compartido estaba viejo (`node_modules` por junction entre worktrees). Regenerado
con el binario local. Se anota porque el sintoma apunta al sitio equivocado y ya mordio antes.

## Lo que NO se ha tocado

`prisma/schema.prisma` · la UI (espera microcopy aprobada) · **E4**, que necesita mas campos y lo
lleva la sesion 2 · el canal al asesor (E1) · el fichero contable (E2).

Ficheros: `src/modules/expenses/domain/justificante.ts` (nuevo) ·
`tests/scrum324-justificante-deducible.test.mjs` (nuevo) · `docs/legal/PREGUNTAS_ASESOR.md`.

# SCRUM-504 · La cantidad vacía — PARADA POR REGLA 38, con el diff preparado

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T12:05:00Z` · Jira: **En curso**, asignado

**Medido contra:** `origin/main` = `bf54914117fb99e596aa7d638c9ebac8ac809564` · 2026-08-12T12:05:00Z

> Comprobado **ANTES de escribir**, como pedía el encargo: el arreglo toca el camino de emisión.
> **Ni una línea de `vat.service.ts` modificada.** Lo que sí entra: la medición, la clasificación de
> los 45 y el diff listo.

## 1 · 🔴 EL GATE, y por eso paro

`calcVatBreakdown` (`vat.service.ts`) lo consumen **16 ficheros**, y uno es
`fiscal/verifactu/registro.builder.ts`, que manda su `base` **literal al XML sellado**
(`:315` → `entrada.base.toFixed(2)` → `<sum1:BaseImponibleOimporteNoSujeto>`).

La casa ya decidió qué es eso, y no lo decido yo hoy — está escrito en `docs/master/SCRUM-293.md`:

> *«modificar la función de la que el sellado saca su base imponible: eso es el camino de emisión,
> por fichero y por lado.»*

Cambiar `Number(l?.qty) || 1` **cambia la base** en el caso defectuoso. Regla 38: **diff preparado,
y paro**.

## 2 · Qué hace HOY la pantalla — y de aquí sale el arreglo

Medido en `quotesView.js`:

```js
:1047  const qty = parseFloat(String(line.qtyInput.value || "").replace(",", "."));
:1079  const safeQty = Number.isFinite(qty) ? qty : 0;      // ← la pantalla ya dice CERO
```

**La pantalla ya trata la cantidad ausente como 0.** El servidor la trataría como 1.

> 🔴 **El defecto no es «cobra 1»: es que el total que el profesional VE y el que el dominio
> CALCULARÍA no coinciden.** Uno dice 0 y el otro 1, sobre la misma línea.

Así que la respuesta a «¿fallar, dar 0, o rechazar?» **no hay que inventarla**: la pantalla ya la
tomó. **0**, y con el mismo criterio de la casa —«no consta» no se rellena— la línea sin cantidad
legible no debe aportar importe.

## 3 · 🔴 Y la premisa del ticket hay que afinarla: por la puerta viva, HOY NO PASA

El ticket dice que está ocurriendo hoy en presupuestos. **Medido: por esa puerta, no.**

```
src/core/validation/schemas.ts:9   qty: z.number().positive()
src/modules/quotes/app/routes/quotes.routes.ts:66   CreateQuoteSchema.parse(req.body)
```

`z.number().positive()` **rechaza `""`** (no es número) **y rechaza `0`** (no es positivo). Así que
un presupuesto con cantidad vacía se va en un **400**, no en un cobro silencioso de 1.

**Lo que sí queda reachable, y es donde hay que mirar:**

| Camino | ¿Valida las líneas? |
| --- | --- |
| `POST /quotes/create` | **sí** — `CreateQuoteSchema` |
| `invoicesAdmin.routes.ts` (factura manual) | **no** — ningún `Schema.parse` de líneas |
| `ai.service.ts:140` | **no**, y además **inventa**: `Math.max(0.01, Number(l.qty) \|\| 1)` |

⚠️ Esto **no rebaja el defecto**: `calcVatBreakdown` sigue estando mal, y su protección hoy es un
validador que vive en otro fichero, a dos saltos, y que **no cubre todos los caminos**. Es
exactamente la forma de SCRUM-441: *la protección que había no se veía desde donde está el defecto*.

Lo que cambia es **la urgencia y el titular**: no es «hoy se está cobrando de más en presupuestos»,
es «el cálculo del dinero se defiende solo si el llamador validó, y hay dos llamadores que no».

## 4 · El diff, PREPARADO Y NO APLICADO

```diff
--- a/src/modules/invoicing/domain/vat.service.ts
+++ b/src/modules/invoicing/domain/vat.service.ts
@@
-    const qty = Number(l?.qty) || 1;
-    const price = Number(l?.price) || 0;
+    // SCRUM-504 · una cantidad AUSENTE no es 1. `Number('')` es 0 y `0 || 1` da 1 en silencio, así
+    // que una línea sin cantidad legible se cobraba como una unidad — y la pantalla, que ya la
+    // trata como 0 (`quotesView.js:1079`), enseñaba otro total distinto del que se calcularía.
+    //
+    // `Number.isFinite` distingue lo que `||` confunde: el 0 escrito por una persona pasa como 0,
+    // y lo ilegible cae a 0 en vez de a 1.
+    const qtyLeida = Number(l?.qty);
+    const qty = Number.isFinite(qtyLeida) ? qtyLeida : 0;
+    const price = Number(l?.price) || 0;   // ← se queda: el defecto ES 0 (ver §5)
```

**Por qué `0` y no lanzar:** `calcVatBreakdown` lo consumen 16 sitios, entre ellos el sellado y el
303. Que lance convierte un dato malo en una caída del cálculo fiscal entero. `0` coincide con lo
que la pantalla ya enseña, y deja la línea sin aportar importe — que es lo honesto para una cantidad
que no consta.

**Lo que NO cubre este diff, y hay que decidir aparte:** que una línea con cantidad ilegible **entre
en una factura** valiendo 0 en vez de ser rechazada. Rechazarla es cambiar el contrato de una
función que consume el sellado, y eso es más que un arreglo de lectura.

## 5 · Los 45 `||`, clasificados uno a uno — **no eran 45 defectos**

Derivados por AST (235 ficheros, **1.051** `||` vistos, control positivo del detector ✓) y
clasificados por un **criterio**, no a ojo:

> Un `||` es correcto si su valor por defecto **significa lo mismo** que el `0` que produce
> `Number('')`. Es sospechoso si `0` es legítimo y el `||` lo sustituye por otra cosa.

| | |
| --- | --- |
| **CORRECTOS · 38** | **33** con defecto `0` — *sustituyen un cero por un cero: no cambian nada nunca*. **5** sobre `process.env` — *una env ausente es `''` y debe caer al defecto: ése es su contrato*. |
| **🔴 A LEER · 7** | defecto ≠ 0 |

**Suma 38 + 7 = 45 ✓.** Y los 38 quedan **declarados correctos con su motivo**: dejan de ser
sospechosos y no vuelven a mirarse.

**Los siete:**

| Sitio | Qué es | Veredicto |
| --- | --- | --- |
| `vat.service.ts:24` | `Number(l?.qty) \|\| 1` | 🔴 **el del ticket** |
| `finalInvoice.service.ts:119` | ídem, factura final | 🔴 mismo defecto, mismo camino |
| `invoiceLines.service.ts:114` | ídem, línea del último tramo | 🔴 mismo defecto |
| `pdf/pdf.service.ts:224` y `:263` | ídem, **al PINTAR el PDF** | 🔴 y el PDF enseñaría 1 donde el cálculo dijera 0 |
| `ai.service.ts:140` | `Math.max(0.01, Number(l.qty) \|\| 1)` | 🔴 **inventa** una cantidad que nadie escribió; la revisa un humano en pantalla antes de enviar |
| `modelo303.ts:227` | `Math.trunc(params.trimestre) \|\| 1` | ✅ **correcto y declarado**: un trimestre `0` no existe, y va acotado a 1-4 en la línea siguiente |

**Cinco de los seis restantes son la MISMA línea copiada** en cinco sitios del camino de la factura.
Arreglar solo `vat.service.ts` dejaría el PDF enseñando `1` donde el cálculo dice `0` — **un
descuadre entre el papel y la cuenta**, que es peor que el defecto original.

> Eso convierte esto en **un solo arreglo de cinco sitios a la vez**, no en cinco arreglos. Y los
> cinco están en el camino de emisión.

## 6 · Lo que hace falta para cerrarlo

1. **GO de regla 38** para tocar `calcVatBreakdown` y sus cuatro hermanas.
2. Con el GO: el arreglo, el rojo que nombra la línea y el importe colado, y el control negativo que
   distingue **el `1` escrito por una persona** del **`1` inventado por el `||`** — que se puede
   hacer justo porque `Number.isFinite` los separa: `qty: 1` pasa como 1 y `qty: ''` pasa a 0.

## 7 · Lo que NO se ha tocado

`vat.service.ts` ni ninguna de las otras cuatro · `prisma/schema.prisma` · el sellado · la cadena de
huellas · el recargo · el criterio de caja · A2.

---

# SCRUM-504 (parte 2) · Arreglado, con GO de regla 38

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T12:35:00Z`

**Medido contra:** `origin/main` = `bf54914117fb99e596aa7d638c9ebac8ac809564` · 2026-08-12T12:35:00Z

> **GO acotado del fundador**, con su motivo medido: `INVOICING_ES_ENABLED` está en `false` para los
> 13 merchants de producción, sin un solo override. **No se está sellando nada**, así que el riesgo
> de tocar la función de la que el sellado saca su base está en su mínimo — y no va a repetirse.

## 1 · Los cinco sitios, y por qué van juntos

La misma línea estaba copiada en cinco: el cálculo del IVA, la factura final, el reparto por tramos
y **dos veces el PDF** (la fila y el subtotal).

Arreglar solo el cálculo dejaría **el papel enseñando 1 donde la cuenta dice 0**. Eso no es medio
arreglo: es un descuadre entre el documento que recibe el cliente y el importe que se le cobra —
**peor que el defecto original**.

## 2 · La semántica NO se ha inventado

`quotesView.js:1079` ya hacía `Number.isFinite(qty) ? qty : 0`. **El dominio se alinea con lo que el
profesional ya ve.** Ni fallar, ni rechazar la línea: **0**, que es lo que la pantalla dice desde
antes de este ticket.

## 3 · Una sola fuente, no cinco copias

```ts
export function cantidadDeLinea(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}
```

**Cinco copias de `Number.isFinite` divergirían igual que divergieron las cinco de `|| 1`.** Lo que
impide que el papel y la cuenta se separen no es que hoy coincidan: es que **solo haya una fuente**.
Hay guard que lo exige, con su suelo (≥ 5 usos: si alguno deja de llamarla, ese sitio puede volver a
inventarse la cantidad sin que nadie lo vea).

| Entrada | Antes | Ahora |
| --- | --- | --- |
| `1` (una persona) | 1 | **1** |
| `0` (una persona, a propósito) | 🔴 **1** | **0** |
| `''` (input rechazado por el navegador) | 🔴 **1** | **0** |
| `'x'`, `null`, `undefined`, `NaN` | 🔴 **1** | **0** |

## 4 · Los cuatro rojos

| Se rompe… | El guard dice… |
| --- | --- |
| vuelve el `\|\| 1` al cálculo | *«SE HA COLADO UN IMPORTE… Base esperada: 200,00 €. Base obtenida: 540,00 €. Diferencia: 340,00 € facturados por una unidad que nadie escribió»* — **nombra la línea y el importe** |
| 🔴 el PDF vuelve y el cálculo no | *«HA VUELTO UN `\|\| <n>` SOBRE UNA CANTIDAD: pdf.service.ts:225»* — el descuadre papel/cuenta, cazado por fichero y línea |
| 🔴 el helper deja de respetar el `0` de una persona | *«UN CERO ESCRITO A PROPÓSITO SE ESTÁ CONVIRTIENDO EN OTRA COSA»* |
| el helper vuelve a confundir vacío con uno | la misma |

## 5 · El control negativo que exigía el ticket, demostrado

El «1» de una persona y el «1» inventado por el `||` **se distinguen dentro del test**:

```
cantidadDeLinea(1)  === 1     ← el uno de una persona
cantidadDeLinea('') === 0     ← lo que el || convertía en uno
assert.notEqual(cantidadDeLinea(''), cantidadDeLinea(1))
```

Con `||` los dos eran el mismo falsy y acababan en 1: **indistinguibles**. Ese `notEqual` es
literalmente el ticket.

Y el grande: **una factura normal calcula exactamente lo de antes** — base 850,00, cuota 151,00 y
sus dos tramos, el mismo caso que ya vigila `scrum294-recargo-caja.test.mjs` sobre el desglose que
va al XML.

## 6 · El test que justifica el alcance

`PDF y cálculo dan LO MISMO sobre la línea defectuosa`: los dos dan **0,00 €**. Y con una cantidad
legítima **también coinciden** — sin esa segunda mitad, el test pasaría por dar cero en los dos
lados sin calcular nada.

## 7 · Los 45 `||`, cerrados

**38 declarados CORRECTOS** con su motivo y no se vuelven a mirar: 33 con defecto `0` —*sustituyen
un cero por un cero*— y 5 sobre `process.env` —*una env ausente es `''` y debe caer al defecto: ése
es su contrato*—.

**De los 7 restantes:**

| | |
| --- | --- |
| `vat.service.ts` · `finalInvoice.service.ts` · `invoiceLines.service.ts` · `pdf.service.ts` ×2 | ✅ **arreglados aquí** |
| `modelo303.ts:227` `Math.trunc(params.trimestre) \|\| 1` | ✅ **CORRECTO, declarado**: un trimestre `0` no existe y la línea siguiente lo acota a 1-4 |
| `ai.service.ts:140` `Math.max(0.01, Number(l.qty) \|\| 1)` | 🔴 **fuera del GO** — ver §8 |

**Total: 44 cerrados, 1 reportado.**

## 8 · 🔴 Reportado y NO arreglado: `ai.service.ts:140`

Queda **fuera del GO**, que cubría los cinco de la línea copiada. Y no es el mismo caso: **inventa**
una cantidad que el modelo no dio, en una propuesta que un humano revisa en pantalla antes de
enviarla. Es más suave que el original —hay un par de ojos en medio— pero sigue siendo el mismo
patrón: `Number('') || 1`.

⚠️ Y hay una consecuencia que conviene ver junta: desde hoy, una línea con cantidad ilegible vale
**0** en el cálculo y en el PDF, pero si viene de la IA vale **1**. Dos respuestas distintas al mismo
dato en el mismo producto. Merece su ticket.

## 9 · Lo que este arreglo cambia sin querer, y está bien

`invoiceLines.service.ts:114` tenía justo debajo `if (!Number.isFinite(qty) || qty === 0) return src;`
— una guarda que **nunca se disparaba**, porque el `|| 1` garantizaba que `qty` jamás fuera 0.
Ahora sí se dispara: una línea sin cantidad legible deja de usarse para cuadrar el total del tramo,
que es exactamente lo que esa guarda quería.

## 10 · Lo que NO se ha tocado

El sellado · la cadena de huellas · el XML · la numeración · ninguna otra regla de cálculo ·
`prisma/schema.prisma` · el recargo · el criterio de caja · A2.

**Suite completa con `main` dentro: 3.513 tests · 3.436 pasan · 0 fallos · 77 saltados.**

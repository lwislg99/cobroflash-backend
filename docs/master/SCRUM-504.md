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

# SCRUM-603 · DOC-13 · Descripción, texto y observaciones en el PDF

**Medido contra:** `origin/main` = `aa9309e7bdf80717373d0273f1d03f01f2008b8c` · 2026-08-25T16:40:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** se construye **(a)**, que tenía dato. **(b)** y **(c)** no lo tienen: diff descrito y
parada.

---

## 1 · 🛑 La víctima del ticket no se reproduce como está escrita

El ticket dice: *«el profesional marca ☐ "Incluir descripción en el PDF" y el PDF sale igualmente
SIN la descripción»*.

**Medido leyendo el documento generado: la descripción SÍ llegaba al PDF.** La cadena estaba
completa de punta a punta, y aquí está con fichero y línea:

| paso | dónde |
|---|---|
| el campo existe | `prisma/schema.prisma` · `model Product` · `description String?` |
| la búsqueda lo selecciona | `src/modules/products/domain/products.service.ts:209` |
| el endpoint lo devuelve | `src/modules/products/app/routes/products.routes.ts:130` (`/autocomplete`) |
| el editor lo guarda en la línea | `public/dashboard/js/quotesView.js:1702` |
| la vista previa lo pinta debajo, 12 px gris | `public/dashboard/js/quotesView.js:1402-1408` |
| el envío lo concatena al concepto tras un `\n` | `public/dashboard/js/quotesView.js:2943-2948` |
| el PDF lo imprime | medido: aparece en factura y en presupuesto |

**Lo que fallaba de verdad era otra cosa, y sólo en la FACTURA:** su tabla imprimía el concepto
**entero de una vez** (`pdf.service.ts`, `doc.text(l.concept …)`), así que la descripción salía
—el salto de línea se respeta— pero con el **mismo tamaño y el mismo peso** que el concepto. No se
leía como descripción: se leía como un concepto largo. **El PDF de PRESUPUESTO ya la separaba
bien** desde antes.

### Y una limitación real que sí puede explicar lo que vio el fundador

La descripción **sólo existe si la línea vino del catálogo** y ese producto tiene una: se borra en
cuanto el concepto se escribe a mano (`quotesView.js:1850`, `:2318`, `:2367`). Con una línea
tecleada, marcar la casilla no puede hacer nada — no hay descripción que incluir. **Eso no se toca
aquí**: sería cambiar qué dato existe, no cómo se imprime.

---

## 2 · El estado de (a), (b) y (c)

| | presupuesto | factura | albarán |
|---|---|---|---|
| **(a) descripción por línea** | dato **SÍ**, y ya se separaba | dato **SÍ**, se imprimía **sin distinguir** → **arreglado** | **el dato NO existe** |
| **(b) texto libre de cabecera** | no existe | no existe | no existe |
| **(c) observaciones al pie** | no existe | no existe | **SÍ, y ya se imprime** |

**(a) en el albarán:** su línea es `{concepto, cantidad, unidad}` — `albaran.service.ts:100`, y su
PDF pinta `l.concepto` a secas (`albaranPdf.service.ts:224`). No hay descripción que partir.

**(b):** no existe en ningún documento. Los `notes` del esquema son de `Customer` (201), `Expense`
(572), `Provider` (658) y `Job` (832) — ninguno es del documento. `Quote.internalNotes` (392) es la
nota **privada**, «nunca visible al cliente»: no es esto.

**(c):** existe **sólo en el albarán** (`albaranPdf.service.ts:65` y `:255-259`, con su rótulo
«Notas:»). Factura y presupuesto no tienen dónde guardarlo.

---

## 3 · Lo construido: la factura pasa a distinguir la descripción

Concepto en su tamaño; **descripción debajo, a 8 pt y en `MUTED` (`#6b756f`)** — el **mismo gris**
que el profesional ya ve en la vista previa del editor, para que el documento no le enseñe algo
distinto de lo que le prometió la pantalla. La altura de fila se mide **con el tamaño de cada
parte**: medir la descripción con el del concepto dejaría la fila corta y el texto se pisaría.

### 🔴 Copias: **1 antes, 0 después**

La partición vivía **una** vez, en el bloque del presupuesto. Escribirla otra vez en el de la
factura habría hecho **dos**, y dos listas que se sincronizan a mano divergen — la familia de
SCRUM-617/620/625/627. Se sacó a `src/modules/invoicing/infra/pdf/conceptoLinea.ts` y **la usan los
dos**. Un test fija que hay exactamente **dos llamadas** y falla tanto si baja (un documento dejó
de separar) como si sube sin documento nuevo (volvió la copia).

El **albarán** no la usa todavía y no es olvido: no tiene descripción que partir. El día que la
tenga, la función ya está y no habrá tercera copia.

---

## 4 · 🛑 Lo que NO se construye, con el diff descrito y sin aplicar

### (b) texto libre de cabecera · (c) observaciones al pie, en factura y presupuesto

```prisma
model Quote {
  // …
  headerText   String?  @map("header_text")   @db.Text  // (b) visible al cliente
  footerNotes  String?  @map("footer_notes")  @db.Text  // (c) observaciones al pie
}

model Invoice {
  // …
  headerText   String?  @map("header_text")   @db.Text
  footerNotes  String?  @map("footer_notes")  @db.Text
}
```

**Aditivo y nullable**, sin `@default`. No se ha tocado `prisma/schema.prisma` ni se ha ejecutado
ningún `db push`.

**Y no basta con la columna.** En la factura el dato tendría además que atravesar
`validarFacturaSuelta` —que reconstruye el cuerpo con dos claves y **descarta el resto**— y
`emitInvoice`: **camino de emisión**, GO explícito. Es la misma frontera de SCRUM-619 y SCRUM-605.

**No se han construido «sólo visuales»**, y es deliberado: un campo que no se guarda no es una
mejora — el profesional lo teclea, cierra y se pierde.

### (a) en el albarán

`Albaran.lineas` es **`Json`**, así que añadir `descripcion` a la línea **no necesita columna**.
Pero sí tocar `albaran.service.ts`, que valida las claves de cada línea **y congela el contenido
para el sellado** (SCRUM-438). Eso es camino de documento firmado: **no se toca sin GO**.

---

## 5 · Verificación

* **Antes / después, leído del documento**: con descripción aparece en factura y presupuesto; **sin
  descripción NO aparece** en ninguno. El control negativo es el que importa: si saliera siempre,
  se habría cambiado el documento en vez de conectar la casilla.
* **Caracteres que muerden**: acentos, `ñ`, comillas tipográficas «…» y raya `—`.
* **Descripción larga**: se comprueba que llega **su final** (no sólo su principio, que seguiría
  estando aunque se truncara) y que **no se come el bloque de totales** — o sea, que la altura de
  fila cuenta la descripción.
* **La función pura**, con sus bordes: sin salto · varias líneas · líneas vacías intermedias ·
  `null`/`undefined`/no-texto.

### Límite declarado, y huecos

* **`_texto-del-pdf.mjs` lee el TEXTO, no renderiza** (ya dicho en SCRUM-623). Sirve para saber
  **qué** se imprime —que es lo que decide si la casilla cumple su promesa— pero **no para juzgar
  cómo queda colocado**. Que la descripción vaya a 8 pt, en gris y en su propia línea se comprueba
  sobre el código; **que se vea bien es juicio visual y queda como hueco**: nadie ha mirado el PDF.
* **Dos grises distintos**: el presupuesto pinta la descripción en `#444` (literal, de antes) y la
  factura en `MUTED` (`#6b756f`, el de la vista previa). No se unifica aquí —sería cambiar lo que
  el presupuesto imprime hoy, y no se ha pedido— pero queda anotado.
* **Los tres tamaños tampoco coinciden**: presupuesto 9 pt sobre título de 10; factura 8 pt sobre
  concepto de 9. Cada tabla tiene su escala; unificarlas es decisión de diseño, no de este ticket.

## Tests que introduce esta entrada

* `tests/scrum603-descripcion-en-el-pdf.test.mjs` — la función pura y sus bordes, el control
  positivo y negativo en los dos documentos, la descripción larga y el recuento de copias.

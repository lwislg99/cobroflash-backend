# SCRUM-442 · B4 · punto 1 — «Menú Facturas = solo facturas»

**Fecha:** 10-ago-2026 · **Carril:** B (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `44a93a3547e45827f613d17fb036617f176607cc` · 2026-08-10T19:52:07+02:00
**Tanda:** 2720 tests · 2646 pass · **0 fail** · 74 gateados · `npm test` exit **0**

> 🔴 **DEPENDENCIA DE ORDEN DE MERGE, y es dura:** esta rama sale de
> `scrum-285-pantalla-cobros`, **no de `main`**, porque la pantalla que recoge los justificantes
> **todavía no está en `main`**. Si esto entrara antes que SCRUM-285, los `J-` saldrían de Facturas
> y no tendrían dónde ir. **285 primero, 442 después.**

## PASO 0

**ENTRADA.** El listado se carga en **un solo sitio**: `invoicesView.js:45`, `fetch('/admin/invoices')`
dentro de `fetchInvoices`. Censado el resto de `public/`: la única otra mención es un **POST** de
crear factura (`nuevaFacturaModal.js:211`), que no es una lista.

**MECANISMO: existe entero, no se rehace.** La distinción está construida y en uso —
`tipoDeFactura` (`jobDocsReparto.js:34`) ya reparte la pila del Trabajo, alimenta el bloque DINERO
del rail y ordena la pantalla de Cobros. El trabajo es **usarla aquí**, no escribir otra.

### 🔴 Antes de filtrar: ¿los justificantes tienen dónde ir? — SÍ, medido

Sacar un documento de donde no le toca no puede significar sacarlo del producto (el defecto de
SCRUM-420 al revés). Dos mediciones:

1. **`Invoice.chargeId` no lo escribe NADIE en todo el árbol.** `ensureInvoiceForCharge`
   (`lib/invoicing.ts`) crea la factura del cobro con `merchantId, customerId, quoteId, number,
   type, total, currency, lines, pdfUrl, qrData` — **sin `chargeId`**. Barrido el resto: las demás
   apariciones son `where`, `Quote.chargeId` o logs.
2. Como `listarCobros` recoge las `Invoice` con `chargeId: null`, **los justificantes entran**.

Y comprobado **con el banco, no razonándolo**: un justificante real (`type: 'JUST'`,
`J-20260802-AB12`) se pinta en Cobros con su número y clasificado como `justificante`.

## Lo que se construye

Una función con nombre en la vista de Facturas:

```js
function soloFacturas(documentos) {
  return documentos.filter((doc) => tipoDeFactura(doc) !== 'justificante');
}
```

y `fetchInvoices` devuelve `soloFacturas(await res.json())`.

**Se clasifica con `tipoDeFactura`, nunca con una copia** — es la restricción que gobierna el
ticket. Un `startsWith('J-')` aquí sería la cuarta forma de decidir lo mismo.

**Se llama SIN guarda `typeof`.** Si `tipoDeFactura` no estuviera, esto tiene que reventar: un
filtro que se desactiva solo devolvería la lista mezclada **en silencio**, que es el defecto que
este cambio cierra.

**Las RECTIFICATIVAS se quedan.** Una `R1` es una factura; sacarla la dejaría sin sitio igual que al
justificante. Hay test.

**No se toca el servidor.** `GET /admin/invoices` sigue devolviendo los dos documentos a propósito:
los usan el detalle y los exports. **El que separa es quien pinta la lista.** Filtrar en servidor,
además, habría obligado a usar `isReceiptNumber` (backend) — o sea, una segunda forma de clasificar,
justo lo prohibido.

## 🔴 El verde hueco que apareció construyendo esto, y cómo se cazó

La primera versión del test **pintaba la vista** con el banco y comprobaba que el `J-` ya no estaba.
**Pasaba en verde, y por avería:** `renderInvoicesView` **revienta en el banco** (`Cannot read
properties of null` — el mini-DOM no representa su marcado anidado; es una de las cinco del hueco
declarado en SCRUM-417). El árbol salía vacío, así que «el justificante ya no está» era cierto **por
la razón equivocada**.

**Lo cazó el control positivo** —«la factura tampoco está»—, que es exactamente para lo que estaba.
Por eso el filtro es una función **con nombre y publicada**: así se prueba de verdad, sin depender
de una vista que el banco todavía no sabe pintar. Y como *mencionar no es hacer*, hay un test aparte
de que la carga **pasa por ella**.

## Verificado

**El test que decide, con las dos mitades EN EL MISMO TEST:** el `J-` **sale de Facturas** y **sigue
en Cobros**, con su número y su tipo. Por separado, cada mitad puede pasar mientras el documento se
pierde. Y la mitad A lleva su propio control dentro (`pasan.length > 0`), porque una lista vacía
también hace verdad «el justificante ya no está».

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | se quita el filtro de la carga | 🔴 «**EL LISTADO VUELVE A MEZCLAR** facturas con justificantes **en 1 de 1 carga(s)**: `invoicesView.js:45`» |
| **R2** | aparece una segunda forma de clasificar `J-` | 🔴 «hay **2** sitios que deciden si algo es un justificante sin pasar por `tipoDeFactura`, y el tope es 1: `quotesListView.js:4`» |
| **R3** | *(control negativo)* una lista sin justificantes | ✅ no cambia nada — el filtro quita solo lo que sobra |

Las dos inyecciones llevan **post-condición**: comprueban que cambió **el fichero que digo** y que
la cadena ya no está; si no, abortan.

**Suelos:** si el escáner no encuentra el filtro ni la definición de `tipoDeFactura`, falla · si el
censo de cargas no encuentra ni la de `invoicesView`, se declara ciego · si el detector de copias no
ve **ni la conocida**, se declara ciego.

**Control negativo del detector:** el comentario de `jobRailBlocks.js:122` que *explica* por qué no
se repite el `startsWith('J-')` **no cuenta como copia**. Cobrárselo sería el impuesto sobre la
claridad que quitó SCRUM-349.

### El trinquete nace en 1 y no en 0, a propósito

Medido: **ya existía una copia a mano**, `invoiceDetailView.js:79`
(`invoice.type === 'JUST' || String(invoice.number||'').startsWith('J-')`), anterior a este ticket.
Exigir 0 hoy pondría el guard **rojo por algo que no es mío**, y un guard que nace rojo lo apaga
alguien en una hora (la lección de SCRUM-402). Lo que sí impide desde hoy: **que aparezca la
siguiente**. Y solo puede bajar: si alguien retira esa copia, el tope baja en el mismo commit.

## Lo que NO cubre

* **La vista de Facturas no se pinta en el banco**, así que no se comprueba el árbol pintado: se
  comprueba la función y que la carga pase por ella. Ampliar el banco hasta que `invoicesView`
  monte es el hueco de SCRUM-417 y es otro carril.
* **`invoiceDetailView.js:79` sigue clasificando a mano.** Declarada en el trinquete, sin ticket.
* **El contador de la cabecera** («Cargando…» → N facturas) sale de la lista ya filtrada, así que
  cuenta bien — pero **no se ha verificado en el navegador**, por lo mismo de arriba.
* **Los exports y el detalle NO cambian**: siguen viendo los dos documentos, a propósito.
* **AB6:** no hay cambio visual más allá de que la lista trae menos filas. Sin capturas.

## Ficheros

* `public/dashboard/js/invoicesView.js` — `soloFacturas` y su uso en `fetchInvoices`.
* `tests/scrum442-facturas-sin-justificantes.test.mjs` (nuevo, 8).

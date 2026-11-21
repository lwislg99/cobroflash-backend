# SCRUM-1786

## SCRUM-1786a · Capítulos con subpartidas en el presupuesto: medición y diseño para firma (solo docs)

**Puesto:** J1 (jv-j1gk) · **Rama:** `scrum-1786a-subpartidas-diseno` · 21-nov-2026
**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-21T03:42:27Z (cabecera `Date:` de `gh api -i zen`)
A9: sin fallo que generalice — tramo de medición; el único tropiezo (pasar el nombre del sitio de Jira como `cloudId`) lo devolvió la propia herramienta con error y se corrigió en la llamada siguiente.

Solo docs. `src/`, `public/` y `prisma/schema.prisma` se LEEN (reglas 38 y 40). Nada contra staging ni
producción. Ningún texto nuevo en código: los literales de §5 se PROPONEN para firma (regla 39).

Orden del fundador (Jira, descripción del ticket, literal): «en las líneas de presupuesto como concepto
debes poder poner en cada línea descripción y poder añadir subproductos. Por ejemplo, si yo te digo
Salón, puedo incluir ahí una descripción y productos, como pintura, aire acondicionado, la mano de obra,
tal. y poderlo poner tanto desglosado como no».

### 1 · Lo que YA existe hoy (medido; la mitad del encargo está construida)

| pieza | dónde | qué hace |
|---|---|---|
| Líneas del presupuesto | `prisma/schema.prisma:689` `Quote.lines Json` | array PLANO en JSONB; sin tabla de líneas |
| Forma de la línea | `src/core/validation/schemas.ts:88` `QuoteLineSchema` | `concept`, `description?`, `qty?`, `price?`, `costeUnitario?`, `dto?` (% por línea), `tax` (FRACCIÓN 0.21, default 0), `suplido?`, `apartado?` |
| **Descripción por línea** | `schemas.ts` (SCRUM-632, clave `description`) + `quotesView.js:5821-5830` | se guarda en `description`; si el profesional marca «Incluir descripción en el PDF», el front la PEGA al concepto tras un `\n` (`conceptForPdf`) y los dos PDF la parten con `partirConceptoYDescripcion` (`infra/pdf/conceptoLinea.ts`, SCRUM-603) |
| **Cabecera de apartado** (= el «Salón» del fundador) | `apartado: true` en la línea · `src/modules/quotes/domain/apartados.ts` (SCRUM-655) | renglón de título dentro del MISMO array; las líneas que la siguen hasta la próxima cabecera son «sus» líneas; NO suma (`lineasQueSuman`, consumida por `calcTotal` en `src/core/utils/utils.ts:203,231`); la puerta rechaza cabecera con `qty`/`price`/`costeUnitario` (`schemas.ts:195-215`) |
| Numeración 1 / 1.01 | `public/dashboard/js/quoteApartados.js:51` `numerarLineas` | derivada de la posición, solo en pantalla |
| IVA por línea | `tax` de cada línea; desglose `calcVatBreakdown` (`src/modules/invoicing/domain/vat.service.ts:56`) | agrupa por (tipo, causa) |
| Descuentos | `dto` % por línea; `Quote.discountGlobalAmount` (€) global (`schema.prisma:686`) | el global con varios tipos NO factura (`invoiceLines.service.ts:121-127`) |
| PDF presupuesto | `pdf.service.ts:1188-1240` (`generateQuotePdf`) | una fila por línea; la cabecera sale como fila con concepto y celdas vacías (`qty` vacío, total `NaN`→`''`). **No hay subtotal por apartado** |
| PDF factura | `pdf.service.ts:599-648` (`generateInvoicePdf`) | una fila por línea de `Invoice.lines`; `cantidadDeLinea` convierte `qty` ausente en 0 |
| Albarán | `schema.prisma:1539` `Albaran.lineas` `{concepto, cantidad, unidad, precioUnitario?, tipoIva?}` | sin descripción ni apartado; IVA en ENTERO de % (otra convención, `schema.prisma:1068-1069`) |
| Parte | `schema.prisma:1726` `lineas` con `bloque` | dos bloques CERRADOS (`parteDictado.ts:48-50`); no son capítulos libres |

**Lo que NO existe:** ① el **total del capítulo** (en ninguna pantalla ni PDF: `subtotal|agrupad` da 0
en `quotesView.js`, `quoteApartados.js` y `quotesDetailView.js`); ② el modo **agrupado** (una fila por
capítulo); ③ la **descripción de la cabecera** como dato propio (la puerta la admite en cualquier línea,
así que en la cabecera cabe ya; pantalla y PDF no medidos para ese caso).

### 2 · 🔴 Defecto previo hallado, en el CAMINO DE EMISIÓN (corrido, no leído)

`docs/master/SCRUM-655.md:120-127` declara: «Al facturar, `Invoice.lines` recibe las líneas sin las
cabeceras y sin la marca». **Es falso.** `lineasParaFacturar` (`invoiceLines.service.ts:105`) copia
TODAS las líneas, cabeceras incluidas, y ningún llamador las filtra (`apartado|lineasQueSuman` da 0 en
`src/lib/invoicing.ts`, `quotes.routes.ts`, `quotesAdmin.routes.ts`, `jobs.routes.ts`,
`albaranes.routes.ts`, `billingPlanView.ts`; positivo: `quotes.routes.ts:16` sí nombra «apartado» en un
comentario, el grep ve el fichero).

Sonda: `docs/master/evidencias/SCRUM-1786/sonda-apartado-en-factura.cjs` (código de `src/` compilado con
`tsc --noCheck` a un directorio temporal fuera del árbol; solo llama funciones) ·
salida: `docs/master/evidencias/SCRUM-1786/salida-sonda.txt`.

| caso | total presupuesto | cabecera en la factura | desglose | registro VeriFactu |
|---|---|---|---|---|
| sin apartado (control) | 121 | no | `21 % · 100 · 21` | OK, 1 detalle |
| con «Salón» (`tax:0`, como la deja la puerta) | 121 | **sí** | `21 % · 100 · 21` **+ `0 % · 0 · 0`** | **LANZA** `verifactu_desglose_no_clasificable` |
| cabecera sin `tax` | 121 | **sí** | igual | **LANZA** |

Consecuencia, leída en el código (NO reproducida contra una base): `construirRegistro`
(`verifactu.service.ts:942`, desglose en `:958-972`) es lo que usan `registroParaRemision` (`:1256`, el
encolado tras sellar) y `buildVerifactuRegistrosXml` (`:715`, la exportación). El encolado no lanza:
deja `encolado_fallido` en auditoría (`encolarRemision.ts:80-97`). O sea: **una factura salida de un
presupuesto con apartados se sella, pero su alta no entra en la cola de remisión y su XML no se puede
exportar.** El importe y la huella no cambian (la fila fantasma es base 0, cuota 0). En el PDF de factura
la cabecera saldría como fila «0,00 · 0,00 · — · 0,00» (leído en `pdf.service.ts:600-645`, no pintado).
**NO medido:** cuántas facturas con cabecera hay en ninguna base, ni si alguna ruta real lo ha producido.
Arreglarlo toca `lineasParaFacturar` o `calcVatBreakdown`: **camino de emisión → STOP, necesita GO**
(pregunta P1). Es de mi carril (J1, `invoiceLines.service.ts`).

### 3 · Diseño propuesto

**Capítulo = la cabecera de apartado que ya existe.** No se crea un segundo mecanismo (dos que deciden
lo mismo divergen; SCRUM-655 ya eligió array plano por compatibilidad). Lo que se añade:

1. **Capítulo:** `concept` («Salón») + `description` (ya admitida por la puerta). Sin importes propios.
2. **Subpartidas:** las líneas que siguen a la cabecera, cada una con su concepto, cantidad, precio, IVA
   y `dto`, como hoy.
3. **Total del capítulo = suma DERIVADA** de sus subpartidas (base, y con IVA si el documento muestra
   IVA incluido). **No se guarda** (un número derivado no se elige: se recalcula). Una función de
   dominio `capitulos(lineas)` que agrupe por posición; la numeración de `quoteApartados.js` y el
   subtotal salen del mismo recorrido.
4. **Modo desglosado / agrupado:** una clave `agrupado: true` en la CABECERA (por capítulo, dentro del
   JSON) → **cabe en lo actual, sin esquema**. Alternativa: una columna `Quote.modoLineas` (todo el
   documento) → ALTER aditivo (A5). Recomiendo por capítulo (P3).
   - **Desglosado:** como hoy + fila «Total del capítulo» bajo sus subpartidas.
   - **Agrupado:** una fila por capítulo: concepto + descripción + total; si sus subpartidas tienen
     varios tipos, la fila no lleva un IVA único y el pie desglosa bases por tipo (ya lo hace).
5. **Compatibilidad:** un presupuesto sin cabeceras no cambia en nada (control: la fila «sin apartado»
   de §2). Uno con cabeceras viejas se lee como desglosado (sin clave `agrupado` = desglosado; no se
   rellena nada hacia atrás).
6. **Factura (regla 40):** `Invoice.lines` debe seguir PLANA y sin cabeceras, que es lo que SCRUM-655
   decidió y no se cumple. Así el desglose, la huella y el XML no ven capítulos. El RD 1619/2012 art.
   6.2 (medido en SCRUM-1771) exige el desglose de bases por tipo, que sale de las líneas planas y no
   cambia. La agrupación en el PAPEL de la factura es otra decisión (P4): para conservarla hay que
   llevar las cabeceras en otro sitio que no sea lo que suma (clave aparte o columna nueva → esquema).
   **Sin asesoría no recomiendo factura agrupada**: «descripción de las operaciones» y «precio unitario»
   (art. 6.1.f) con una sola fila por capítulo no está medido contra el BOE en este tramo.

### 4 · Plan por tramos (cada uno, un PR; carril de `node scripts/carriles.mjs de <ruta>`)

| tramo | qué | ficheros | carril | ¿GO? |
|---|---|---|---|---|
| b | las cabeceras NO entran en `Invoice.lines` (lo que declaró SCRUM-655) + test que pinte la sonda de §2 en rojo antes | `src/modules/invoicing/domain/invoiceLines.service.ts` | J1 | **sí: emisión** (P1) |
| c | `capitulos(lineas)` y total del capítulo, en dominio | `src/modules/quotes/domain/apartados.ts` | S1 (Luis) | cruza de equipo |
| d | clave `agrupado` en la puerta (si P3 = por capítulo) | `src/core/validation/schemas.ts` | S1 (Luis) | cruza de equipo |
| e | editor: descripción del capítulo, subtotal, interruptor desglosado/agrupado | `public/dashboard/js/quotesView.js`, `quoteApartados.js` | S2 (Luis) | textos firmados (§5) |
| f | PDF de presupuesto: subtotal y modo agrupado | `src/modules/invoicing/infra/pdf/pdf.service.ts` | J1 | textos firmados |
| g | página de firma y portal del cliente | `quoteDecisionLanding.routes.ts` (S1), `customerPortal.routes.ts` (J2) | S1 · J2 | textos firmados |

El tramo b va primero: sin él, cualquier presupuesto con capítulos que se facture repite el defecto de §2.

### 5 · Preguntas ✅/❌ para el fundador y textos para firma

- **P1** ¿GO para el tramo b (quitar las cabeceras al pasar a factura, como ya decidió SCRUM-655)? ✅/❌
- **P2** ¿El «Salón» del encargo es el apartado que ya existe (mismo botón, con descripción y subtotal), y no un elemento nuevo? ✅/❌
- **P3** ¿El modo desglosado/agrupado se elige POR CAPÍTULO (sin esquema)? ✅ · ❌ = un solo interruptor para todo el presupuesto (columna nueva, ALTER aditivo).
- **P4** ¿La FACTURA sale siempre desglosada (agrupar solo en presupuesto)? ✅ · ❌ = se estudia factura agrupada con la asesoría antes de construir.
- **P5** En agrupado, ¿se muestran al cliente las cantidades y precios de las subpartidas en algún sitio (p. ej. al desplegar en la página de firma)? ✅/❌

Literales propuestos (no existen en código; se usan solo con firma):

| dónde | literal propuesto |
|---|---|
| fila bajo las subpartidas | «Total del apartado» |
| interruptor en la cabecera, editor | «Mostrar al cliente: Desglosado · Agrupado» |
| fila agrupada con varios tipos de IVA, columna IVA | «Varios» |

«apartado» se mantiene porque es la palabra que ya ven los profesionales en el editor (SCRUM-655);
«capítulo» sería un segundo nombre para lo mismo.

### 6 · Lo que NO se ha medido

Ninguna base de datos (ni cuántos presupuestos o facturas llevan cabeceras). La pantalla del editor con
una cabecera con descripción. Los PDF pintados (solo leídos). La página de firma y el portal con
cabeceras. El paso presupuesto → albarán línea a línea (solo su forma en el esquema). El BOE para la
factura agrupada.

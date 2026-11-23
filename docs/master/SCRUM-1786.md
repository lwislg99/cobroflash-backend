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

## SCRUM-1786b · Las cabeceras de apartado no pasan a `Invoice.lines` al facturar (camino de emisión, con GO)

**Puesto:** J1 (jv-j1gn) · **Rama:** `scrum-1786b-cabeceras-fuera-de-factura` · 21-nov-2026
**Medido contra:** `origin/main` = `db789fd0fb7d604b718529ca1d861e351fc2e756` · 2026-11-21T04:09:21Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum525d-anclas-que-apuntan.test.mjs`
A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`
Mutaciones: catálogo → `tests/scrum1786b-cabeceras-fuera-de-factura.test.mjs`

Relevo (jv-j1gs, 21-nov): el obligatorio del PR #3288 cayó en `scrum1415` porque el test nuevo registraba
6 casos con nombre construido en un `for`; no se vio en local porque la tanda dirigida no incluía ese guard.
Ahora los escribe literales con `casosEscritos`: 10 casos antes y 10 después, con los mismos nombres.

GO del fundador (regla 40): SCRUM-1786 c.22269, P1. Defecto medido en 1786a (§2) y reproducido aquí,
corriéndolo contra el `dist/` de antes del arreglo: con una cabecera, la factura de un tramo lleva 2
líneas, el desglose `[{rate:21,…},{rate:0,base:0,cuota:0}]`, y `clasificarDetalleDesglose` lanza
`DesgloseNoClasificableError` («tramo de IVA al 0%»). Con el arreglo: 1 línea, 1 tramo, no lanza.

**Dónde se quitan (medidos los 7 llamadores de `lineasParaFacturar`).** NO dentro de `lineasParaFacturar`:
el albarán (`albaranes.routes.ts:1631` → `casarLineas`) busca en su salida la línea firmada POR POSICIÓN
(`quoteLineIndex`), y quitar ahí las cabeceras correría los índices y facturaría el precio de otra línea.
Allí una cabecera ya no llegaba a factura (sin precio, va al adicional). Se quitan en:
- `stageLines` (`invoiceLines.service.ts`, J1): el embudo de los cuatro caminos de tramos (`quotes.routes`,
  `jobs.routes`, `quotesAdmin.routes` ×2, todos S1 y sin tocar) y de la vista del plan (`billingPlanView`,
  vía `stageAmountsFromLines`), que así sigue prometiendo lo mismo que factura.
- `src/lib/invoicing.ts` (J1, factura desde el cobro): `lineasQueSuman(lineasParaFacturar(…))`.
El criterio de «cabecera» es `lineasQueSuman` de `apartados.ts` (S1, solo importado, no editado).
Cambio NEUTRO EN LÍNEAS (5+/5−): hay anclas `fichero:línea` hacia los dos ficheros en docs.

**Sin apartados, nada cambia:** huella sha256 de todas las salidas (las líneas, los tramos de los planes
entero, 50/50 y 30/70 y la vista del plan) sobre 6 presupuestos sin cabeceras, con dto de línea, con global
de un IVA y de dos, y vacío. Se tomó del `dist/` de 609a46472 (antes del arreglo) y sale idéntica después.
No cambian ni importes, ni IVA, ni XML, ni huella. No se ha tocado ninguna factura emitida (regla 29). Los
ficheros congelados de 523d no se tocan (523d en verde).

**Pruebas:** test nuevo, 10 casos: ROJO antes del arreglo (7 caídos, por la cabecera en la factura) y verde
después. Dirigida: 188 casos, 178 pasan, 0 caen y 10 saltados; los 10 son gateados por base
(`QA_DB_TEST`/`LIBRO_PG_URL`/`TRAMOS_PG_URL`: 178, 207, 222, 814), así que NO se corrieron. Incluye 523d,
347, 1185, 222, 525d, 419, 887, 887b, 141, 246, 655, 814, 1054, 1585, 1669b, 1717, 178, 207 y `verifactu`.
`scrum456` no existe en `tests/` con ese prefijo. Build con tipos (`tsc -p .`): salida 0.
🔴 **NO se han corrido la suite entera ni los tramos de emisión de la suite:** no cabían en el contexto (aviso
de 200k). Lo verá el check obligatorio del PR.

**Mutaciones** (`aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, solo este guard, `git status` vacío
después): «las cabeceras vuelven a pasar por `stageLines`» → VIVA; «vuelven a pasar por `lib/invoicing.ts`» → VIVA.

**Errores míos, cazados por guards que ya existían:** ① primero envolví la llamada del cobro en una función
nueva (`lineasDeLaFactura`), y `scrum887` cayó porque ya no veía `lineasParaFacturar` en `lib/invoicing.ts`.
Se cambió el código, no el guard (regla 41). ② Una línea de import de más movió dos anclas con testigo de
`docs/legal/AUDITORIA_CAMINO_EMISION.md:148`, y `scrum525d` cayó. Se dejó el cambio neutro en líneas, en vez
de reanclar.

## SCRUM-1786f1 · «Total del apartado» bajo cada apartado, en el PDF del presupuesto

**Puesto:** J1 (jv-j1hg) · **Rama:** `scrum-1786f1-total-del-apartado` · 21-nov-2026
**Medido contra:** `origin/main` = `c27b1dc2513f6abe8ea28f84ad596e0d6aa66b91` · 2026-11-21T20:01:13Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `scripts/meta-guard-mutaciones.mjs`
Mutaciones: catálogo → `tests/scrum1786f1-total-del-apartado.test.mjs`

**Decisión:** SCRUM-1786 c.22329 («1-Sí lánzalo»). Literal firmado en c.22269: `Total del apartado`.
Solo `generateQuotePdf`, modo clásico. El PDF de factura, las tarjetas de opciones y el modo agrupado no se tocan.

**Lo medido antes de tocar** (PDF real leído con `lineasDePdf`): la cabecera de apartado salía como una fila
con su concepto y las celdas vacías (`pdf.service.ts`, bucle `params.lines.forEach` del modo clásico); no había
subtotal. La base del pie sale de `calcVatBreakdown` dentro de `pieDePresupuesto` (`presentacionIva.ts`), y la
columna IMPORTE de cada línea es `qty × price`: sin IVA y sin el `dto` de línea (SCRUM-1446e). El documento no
imprime fecha, así que texto y posiciones son reproducibles.

**El cambio:** cuál es cabecera lo decide `lineasQueSuman` de `apartados.ts` (S1, solo se importa; el criterio no
se copia). Al cerrar cada apartado (llega la siguiente cabecera o se acaba la tabla) se pinta una fila
`Total del apartado` con `calcVatBreakdown(<líneas del apartado>).base` en la columna IMPORTE. Es la misma
primitiva y el mismo redondeo que la base del pie, así que no hay aritmética nueva. Sin descuentos, los totales
suman la «Base imponible»; con `dto` o descuento global, suman la «Suma de líneas», que es la fila del pie
anterior a restarlos, igual que la columna que tienen encima (caso ④ del test). El import entra en la línea
de un comentario que se juntó con la siguiente: el fichero no mueve ninguna línea por encima del bucle, y el
ancla `pdf.service.ts:121` de `docs/legal/AUDITORIA_CAMINO_EMISION.md` sigue donde estaba.

**Captura** (PDF fabricado: dos apartados, 3 y 2 líneas, IVA del 21 % y del 10 %):
`docs/master/evidencias/SCRUM-1786/captura-1786f1-total-del-apartado.png`. Salón 287,25 + Cocina 330,00 = base
617,25. Mirada: la fila va en negrita, alineada a la columna IMPORTE, debajo de la última línea de cada apartado.

**Pruebas:** `tests/scrum1786f1-total-del-apartado.test.mjs`, 4 casos. ROJO sobre el código de antes en ①②④
(no había filas) y verde ③, cuya huella (texto y posición de las 17 líneas) se tomó de ese código. Después, 4/4.
Tanda dirigida (66 ficheros: los que nombran `generateQuotePdf`, 1785, 1785b, 262, 603b, 723, 523d, 1157, 1215,
1415, 836, 719, 1294, 267, 273, 525d, 854, 655 y el nuevo): 577 casos, 569 pasan, 7 saltados y 1 cae. El que cae
es `scrum854` («esta rama, si toca código, trae su entrada de registro»), porque este tramo aún no estaba
escrito. Se vuelve a correr después de escribirlo (ver la entrega en Jira).
🔴 **NO corrida la suite entera**, por orden del orquestador (la máquina iba justa de RAM): la corre el obligatorio.

**Mutaciones** (`correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, `git status` sin cambios en
`src/` después): «la fila desaparece» → VIVA; «suma mal» (el total deja fuera su última línea) → VIVA.

**Error mío, cazado por un guard que ya existía:** la primera ancla de «la fila desaparece» era la llamada de
cierre de después del bucle, y la del bucle la contiene como subcadena. `aplicarUna` contestó CIEGO («el ancla
aparece 2 veces») y no mutó nada. La cambié por la firma de la función, que es única.

**Deuda declarada (c.22329):** cuando S1 escriba `capitulos()` (tramo c), este recorrido pasa a usarla y queda uno
solo. Hasta entonces el PDF agrupa por su cuenta, con el criterio de `lineasQueSuman`.

**Sin medir:** ninguna base de datos, yaqu.app (aún no está en main), un apartado que salta de página (el salto
de página de la fila está escrito como el de las líneas, pero no lo ha ejercitado ningún test), un apartado sin
líneas (pinta `0,00`) y unas líneas con céntimos fraccionarios. Con ese último caso, el redondeo por tipo dentro de
cada apartado puede no sumar al céntimo la base del documento, que redondea por tipo sobre todas las líneas. Es la
misma diferencia que ya hay hoy entre la columna IMPORTE y la base.

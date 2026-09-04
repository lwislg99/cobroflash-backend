# SCRUM-594 · DOC-04 · Descuento por línea (%) y descuento global (€) — acotado al presupuesto

**Fecha:** 3-sep-2026 · **Carril:** documentos / dinero · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `09fb0c5b2988b6b658204c48f4e6f8e10568ea1d` · 2026-09-03T13:08:42Z

**Tanda:** 5012 tests, 4928 pass, 0 fail, 84 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## La víctima

Un fontanero cierra una obra de 3.000 € y el cliente le pide una rebaja. Hasta hoy no podía
aplicar un descuento: ni por línea ni global. Tenía que **falsear los precios a mano, línea a
línea**, y el presupuesto dejaba de reflejar lo que costaba realmente cada cosa.

---

## PASO 0

**ENTRADA.** Dashboard → Presupuestos → nuevo/editar. El editor de líneas vive en
`public/dashboard/js/quotesView.js` y **es el único**: `invoiceDetailView.js` no edita líneas
(cero menciones de `addLine`). Eso es lo que hace la acotación limpia.

**MECANISMO.** Existía entero; el trabajo fue darle superficie:

| pieza | dónde | qué aportó |
|---|---|---|
| `recalcTotals()` | `quotesView.js:1214` | sitio único del cálculo en pantalla |
| `calcTotal()` | `core/utils/utils.ts:118` | sitio único del total que se **guarda** |
| `costeParaPayload` | SCRUM-661 | el patrón **«ausente ≠ cero»** |
| `costeUnitario` en Zod | `schemas.ts:34` | `.optional()` y nunca `.default(0)`, con el motivo escrito |
| `pieDePresupuesto` | `presentacionIva.ts:91` | el **dominio** decide las filas; SCRUM-604b la dejó preparada |
| el hueco de «Margen %» | `quotesView.js:2291` | sitio libre en la tarjeta, retirado por SCRUM-598 |

---

## 🔴 Lo que cazó el barrido de equivalencia: un céntimo entre la pantalla y la base

La aritmética vive en una pieza pura (`quoteDescuentos.js`), igual que `quoteSuplido.js`. El repo
admite dos implementaciones —pantalla y servidor— **sólo con un test que exija que coincidan**, y
ese test encontró esto mientras se escribía el ticket:

```
3 × 9,99 € con −10 %     pantalla 32,63     ·     lo que se guardaba 32,64
```

La pieza acumulaba **en céntimos por línea** y `calcTotal` **en coma flotante**. El profesional
habría visto un número y firmado otro.

**Cede la pieza, NO `calcTotal`,** y el motivo importa: `calcTotal` produce el `Quote.total` que se
guarda y que el PDF imprime tal cual, así que cambiar **su** redondeo movería importes de
presupuestos ya existentes. Hay **cuatro convenciones** conviviendo en el árbol (medido en
SCRUM-624) y cuál debe mandar está en la asesoría con SCRUM-619 y 623: **este ticket no lo decide**.

Los céntimos enteros se usan **sólo** para repartir el descuento global, donde la conservación
exacta sí es la regla.

---

## Las dos decisiones, escritas donde no se puedan «armonizar»

### El de línea es % y el global es €, y no es una incoherencia

Decisión de los dos fundadores, y queda en el código y aquí para que nadie lo uniforme dentro de
seis meses: **por línea** se descuenta sobre un precio unitario, que es naturalmente un porcentaje;
**el global se negocia a bulto** («te dejo 200 € menos»). El importe es lo que el cliente **ve y
firma**; el porcentaje sería una forma de calcularlo — el derivado en vez del dato. Uniformarlos
rompería el que es exacto, y **guardar los dos no es opción**.

### El céntimo que sobra

El global se prorratea **proporcional a la base de cada tipo** —la única forma que no elige
favorecer ni perjudicar a Hacienda— y **el último tipo absorbe la diferencia**, para que la suma de
los repartos sea **exactamente** el importe firmado. No es una convención fiscal: es conservación
aritmética. Si el prorrateo perdiera un céntimo, el documento dejaría de decir lo acordado.

> ⚠️ **REGLA DEL PRESUPUESTO, QUE NO ES DOCUMENTO FISCAL.** Antes de que un descuento llegue a una
> FACTURA, este prorrateo va a la asesoría con SCRUM-619, 623 y 624.

Probado con un barrido de **más de 100 combinaciones** de tipos e importes, no con el ejemplo que
cuadraba.

---

## 🔴 «Dto. %» va en la hoja de ajustes, y lo decidió la medición

Se montó primero en la **tarjeta**, junto al precio, que es lo natural: se descuenta sobre el
precio. Medido en navegador real a **390 px** con el CSS de producción:

```
altura de la fila CON el campo en la tarjeta:   354 px
altura de la fila SIN el campo:                 277 px
                                        coste:  +77 px POR FILA
```

**+77 px por fila es el número exacto que SCRUM-139 F4 midió y RECHAZÓ** para meter margen e IVA en
columnas: *«+770 px en un presupuesto de 10 líneas: dos pantallas más de scroll en obra»*.
Reintroducirlo por otra puerta habría deshecho aquel ticket sin decirlo.

En la hoja de ajustes cuesta **0 px por fila**, y no queda escondido: **el chip lo dice**
(`IVA 21 % · Dto. 10 %`), que es lo que F4 pedía del disparador. Así se cumple CONT-01 ② —un dato
invisible es un dato que nadie corrige— sin pagar el scroll.

**Microcopy: los tres rótulos CABEN, medido, y no hizo falta ningún marcador.**

| rótulo | caja | texto | |
|---|---|---|---|
| `Dto. %` | 90 px | 42 px | cabe |
| `Suma de líneas` | 86,2 px | 86,2 px | cabe |
| `Descuento global` | 100,4 px | 100,4 px | cabe |
| chip `IVA 21 % · Dto. 10 %` | 332 px | 116,3 px | cabe |

Target táctil del campo: **44 px** (AB6). Censo de marcadores **idéntico antes y después: 23 marcas
/ 274 superficies** — comprobado con el número delante, no supuesto.

**«Base imponible» NO se renombra.** Es el rótulo vivo y aprobado, el mismo que imprime el PDF, y
además es el correcto: la base imponible es la que soporta el IVA, o sea la de **después** del
descuento. Las filas nuevas van encima.

---

## La acotación, y su prueba

**SÍ:** captura, cálculo, guardado y PDF **del presupuesto** — que lee `params.total`, el guardado
(`pdf.service.ts:954`), así que no toca el camino en disputa.

**NO:** la propagación a la **factura**. Su PDF **recalcula** el total desde `lines` con un motor
distinto del que alimenta el libro registro y VeriFactu (SCRUM-624, abierto). Meter descuentos ahí
**multiplicaría** ese defecto en vez de heredarlo.

Y el descuento entra a `pieDePresupuesto` **como precio ya efectivo**, para no tocar
`calcVatBreakdown` ni a sus 20 importadores.

> **HUECO QUE SE DECLARA Y NO SE RESUELVE: un presupuesto con descuento que se convierte en
> factura.** Entra cuando la asesoría fije la convención.

---

## 🔴 Los ocho trinquetes que saltaron, y qué obligó a decidir cada uno

Añadir un fichero JS y una columna disparó **20 rojos** en la tanda. Ninguno era ruido: cada uno
exigía **declarar** algo que si no se declara se pierde en silencio. Se anotan porque son el mapa
de lo que cuesta de verdad ampliar el presupuesto:

| trinquete | qué obligó a hacer |
|---|---|
| **SCRUM-655b** · revisiones | 🔴 **el más importante:** clasificar `discountGlobalAmount`. Un campo sin clasificar **no viaja a la revisión**, así que revisar un presupuesto de 3.000 € rebajados a 2.700 lo habría devuelto a 3.000 **subiendo el precio en silencio** |
| **SCRUM-619** · vocabulario de línea | escribir qué hace la factura con `dto`. La respuesta es la acotación: **no viaja**, y lo que se pierde queda dicho en voz alta |
| **SCRUM-229** · un solo recorrido | mi `lines.map(...)` era un **segundo recorrido** sobre las mismas líneas. Se llena dentro del bucle existente: dos recorridos acaban dando dos cifras |
| **SCRUM-698 / 697** · nodos de la vista | identificar **por identidad** los 5 nodos nuevos antes de tocar el número (236 → 241), y comprobar que `.quote-line__dto` suma 0 en esa vista |
| **SCRUM-662 / 274 / 417** · scripts | declarar `quoteDescuentos.js` en la lista del banco **y** en el `SHELL` del service worker — sin eso, la primera visita sin cobertura se queda sin la pantalla |
| **SCRUM-286** · bloques del envío | colocar el descuento global en un bloque: va a **Totales**, no a Líneas — se negocia a bulto |
| **SCRUM-222 / 461** · deriva de producción | regenerar `docs/sql/deriva-prod.sql` **con su script**, no a mano (lo había editado a mano y el guard lo cazó) |
| **SCRUM-624** · mezcla de redondeos | subir el tope de 12 a 13 **con el motivo escrito**: `presentacionIva.ts` usa las dos formas a propósito y separadas |

---

## 🔴 Y un test mío que no podía fallar, cazado por la mutación

El test que prueba la acotación —«la factura sale igual»— comprobaba
`texto.includes('121,00')`. Al inyectar el descuento en el bucle de la factura para verlo caer,
**no cayó**: el documento pasaba a imprimir `50,00 / 10,50 / 60,50` de total y **seguía
conteniendo «121,00»**, porque ese número también aparece en el **importe de la línea**. Es decir,
el test daba verde sobre una factura con el total cambiado — exactamente lo que venía a impedir.

Arreglado comparando **los importes de los dos documentos** (con `dto` y sin `dto`), que es una
igualdad y no una cifra suelta. Con el arreglo, la misma mutación lo tumba y el mensaje enseña los
dos conjuntos. **Lo cazó la mutación, no la lectura.**

---

## Evidencia

- **El que decide:** un presupuesto sin descuento imprime **exactamente** lo de antes, leído del
  PDF real — 117,60 / 105,00 / 12,60 — y **sin ninguna fila de descuento**.
- **La acotación, probada:** la factura recibe una línea con `dto: 50` y sigue imprimiendo
  **121,00**, sin rastro de las filas nuevas.
- **Números concretos:** 10 % sobre tres líneas de 9,99 € → suma 29,97 · descuento 3,00 · base
  26,97 · IVA 5,67 · total **32,64**, y las partes suman el total.
- **El céntimo:** 1,00 € entre bases de 10,00 (21 %) y 5,00 (10 %) → 67 + 33 = **100**, exacto.
- **Suelo:** si el detector de «hay descuento» no distinguiera los dos tipos, falla.
- **Control negativo:** renombrar un rótulo no tumba nada — los tests miran conducta, no textos.

---

## Lo que NO se hizo

- **No se tocó `calcVatBreakdown`** ni ninguna convención de redondeo.
- **No se tocó el PDF de la factura** en su camino de cálculo.
- **No se arregló SCRUM-712** (`price` con decimales ilimitados): tiene ticket propio, y mezclarlos
  haría que ninguno de los dos se pudiera medir por separado.
- **`prisma/schema.prisma` sí se tocó**, y es el paso ③ del orden de migración que la FASE A dejó
  establecido: el ALTER ya estaba aplicado y verificado en las tres bases (`quotes` 39→40,
  `invoices` 32→33, `numeric(12,2)`), y sin el campo en el schema la columna sería inalcanzable.
  En `Invoice` queda declarada **sin uso**, por la acotación de arriba.

# SCRUM-598 · DOC-08 · El margen sale del documento

**Fecha:** 2-sep-2026 · **Carril:** documento (línea y pie) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `61c906171b08a90baa29c02666d9961fb75c132b` · 2026-09-02T13:35:04+01:00

**Tanda:** 4389 tests, 4310 pass, 0 fail, 79 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## 🛑 LO PRIMERO: UN GUARD ME PARÓ, Y ESTO ES EL CAMBIO DE MÁSTER QUE PEDÍA

Al retirar el margen saltó `scrum600-un-solo-front-documento`:

> «SE HA PERDIDO **F9** (coste y margen existen en el producto (markup por línea)). El encargo de
> SCRUM-600 **lo declara innegociable**: si se ha quitado a propósito, **es cambio de máster ANTES
> de codificar**, no un borrado de paso.»

**Y F9 no se ha perdido: se ha MUDADO.** Dice «coste y margen existen **EN EL PRODUCTO**», y desde
CAT-01 (SCRUM-609) el coste y el margen viven en el **catálogo**, con su campo y su aritmética
(`margenCatalogo.js`). Lo que este ticket retira es el margen del **DOCUMENTO**, que es otra cosa.

Lo que caducó fue el **ancla del detector**: apuntaba a `markupTd.appendChild(markupInput)` dentro
de `quotesView.js`, o sea que medía la capacidad **por su dirección vieja**.

> **F9 se retira de los dos censos con su motivo y la fecha de la decisión (fundador, 24-ago-2026),
> y esta entrada es el registro que el guard exigía.** No se ha tocado ningún umbral ni se ha
> relajado nada: se ha retirado una entrada que medía una capacidad en el sitio donde ya no vive.
> **Si el fundador considera que eso necesita su visto bueno explícito, es esto lo que hay que
> mirar antes de mergear.**

---

## PASO 0

**ENTRADA.** El profesional llega al margen por **dos** sitios de la misma pantalla
(`public/dashboard/js/quotesView.js`), los dos detrás del **chip gris** de la fila:

| dónde | qué era |
|---|---|
| el chip de la fila | `resumenAjustes(...)` componía «IVA 21 % · Margen 20 %» — **decía IVA y contenía dos cosas** |
| la hoja «Ajustes de la línea» | el campo **Margen %**, entre SUPLIDO y el IVA |
| el pie de totales | la fila **«Margen 18,00 € (18 %)»** |

**MECANISMO.** Estaba entero y funcionando: el margen se leía de la línea, multiplicaba el precio
base, se agregaba en el pie por `margenDeLinea`/`textoMargen` (`quoteMargen.js`) y se guardaba en el
borrador. El trabajo era **retirarlo sin que se pierda nada por el camino**, no rehacerlo.

---

## Las tres mediciones que el encargo pedía

### ① ¿El `markup` de un borrador VIEJO tiene efecto al restaurarlo? **SÍ — y por eso hay drenaje**

Medido: el borrador guarda el **precio BASE** (`priceInput.value`, que es la base — lo fija
`quotesView.js:1799` con `base.toFixed(2)`) y el **margen aparte**; el precio final se recomponía al
enviar (`finalPrice = safePrice * (1 + safeMarkup / 100)`).

**No es un doble margen diferido.** Es el caso contrario, y también es un defecto: si al restaurar
se ignorara el margen, un borrador con base 100 y margen 20 —que valía **120**— pasaría a valer
**100**. *El precio bajaría solo, sin que nadie lo pida.*

CONT-01 manda: «nunca se esconde un campo que tiene algo escrito — un dato invisible es un dato que
nadie va a corregir y que sigue viajando». Así que **el margen se DRENA: se incorpora al precio y la
clave se borra.** El precio final no cambia; cambia dónde vive el número.

> ⚠️ **Redondea a dos decimales, y se dice.** Es lo que hace este mismo campo con el precio del
> catálogo. Un borrador con base 33,33 y margen 20 % enviaba 39,996 y ahora enviará **40,00** —
> cuatro milésimas, en un campo que el profesional ve y puede tocar.

### ② ¿Las plantillas llevan `markup`? **NO**

Cero apariciones en los módulos de plantillas y presupuestos, y su esquema es `QuoteLineSchema`, que
**no declara `markup`** — así que zod lo borraría aunque llegara. **No hay nada que drenar ahí.**

🔴 Y con esto cae una afirmación que estaba escrita en el código: el comentario de SCRUM-610 dice
que el margen «viaja también en las PLANTILLAS». **Es falso.**

### ③ ¿Qué pasa con lo que dejó SCRUM-610? **Su causa desaparece**

SCRUM-610 ponía el margen a cero al elegir del catálogo para evitar el **doble margen**, con el
motivo escrito «a cero y no escondido, porque el pro lo ve». Después de DOC-08 el pro **no lo ve**:
el campo no existe. **La protección no se relaja — desaparece lo que protegía**, porque sin margen
en la línea no hay nada que se pueda aplicar dos veces. La línea se retira, no se deja como no-op.

---

## Lo construido

| se quita | dónde |
|---|---|
| el campo **Margen %** de la hoja de ajustes | el `campoLinea("Margen %")` y su input |
| el **margen del chip** | `resumenAjustes(..., safeVat, 0)` → el chip ya sólo dice lo que contiene |
| la fila **«Margen»** del pie | el `<div class="quote-totals__apoyo">` y toda su acumulación |

Y con ellos: el margen deja de **guardarse** en el borrador, deja de **recomponer** el precio que
viaja, y el aviso «Final: …» —que existía porque el precio escrito no era el que veía el cliente—
queda vacío, porque eso ya no puede pasar.

**Se queda intacto:** SUPLIDO (F8), el selector de IVA de la línea y el del documento, y las
funciones puras de `quoteMargen.js` (sus nueve casos siguen verdes: el margen sigue existiendo, en
el catálogo).

## El guard

`tests/scrum598-el-margen-sale-del-documento.test.mjs`, 7 casos. **Tres detectores separados, uno
por puerta**, para que el rojo diga CUÁL:

* **El rojo nombra la puerta, y está probado con las tres:** a cada detector se le da un fuente de
  mentira con SU defecto y se comprueba que salta **él y sólo él**. Un rojo que acusa de más no dice
  dónde mirar.
* **Control negativo:** quitar SUPLIDO **no** lo hace caer. Un guard que se queja de cambios
  legítimos se acaba desactivando, y entonces tampoco protege del margen.
* **Suelo:** el desnudado quita prosa (este fichero nombra «margen» muchas veces y no puede cazarse
  a sí mismo) **y** no se come el código.
* **El drenaje se EJECUTA**, no se lee: se extrae la función del fuente por AST y se corre. Con su
  control negativo — sin margen, o con margen ilegible, la línea **no se toca**.
* Y un caso para «mencionar no es hacer»: que `drenarMargen` exista no prueba que el restaurador la
  llame, así que se comprueba la llamada.

---

## Lo que caía y he reapuntado, con su motivo

| test | qué le pasó |
|---|---|
| `scrum600` + `_censo-dos-fronts` | **F9 retirado** (arriba) |
| `scrum229` ×3 | fijaban la PRESENCIA del margen en el pie; ahora fijan su **ausencia**. Los 9 casos de las funciones puras siguen intactos |
| `scrum610` ×3 | sus anclas eran el margen de la línea; se retiran porque **desaparece su causa** |
| `scrum132` | reancló el orden del restaurador — **misma invariante, otra forma** (ya le pasó con SCRUM-660) |
| `scrum139 F4` | la hoja ya no lleva `markupTd` |
| `scrum286` | su suelo era «≥ 92 lecturas de `.value`»; **recontado a 77, con el número del DETECTOR y no con el mío** — mi propia regex decía 80 y habría dejado el suelo por encima de lo que el detector ve |

🔴 **Y una rotura real que introduje y cazó la tanda:** quedó un `ajustesCampos.appendChild(markupTd)`
sin su variable, y la pantalla de presupuestos **reventaba entera** (`markupTd is not defined`). Lo
encontró `scrum660`, no yo. Es la diferencia entre `node --check` (sintaxis) y ejecutar.

---

## Los huecos que declaro

1. **No he verificado en navegador** ni la hoja de ajustes ni el pie: he medido el fuente y he
   ejecutado la regla del drenaje.
2. **No he probado un borrador REAL** de `localStorage` de punta a punta: el drenaje se ejecuta como
   función pura, y que el restaurador la llama se comprueba sobre el fuente.
3. **El redondeo del drenaje** (dos decimales) mueve hasta cuatro milésimas el precio de un borrador
   viejo con base no redonda. Está declarado arriba, no medido contra borradores reales.
4. **No he medido producción.**

## Ficheros

`public/dashboard/js/quotesView.js` · `tests/scrum598-el-margen-sale-del-documento.test.mjs`
(**nuevo**) · `tests/_censo-dos-fronts.mjs` · `tests/scrum600-…` · `tests/scrum229-…` ·
`tests/scrum610-…` · `tests/scrum132-iva-unidad.test.mjs` · `tests/scrum139-hoja-ajustes.test.mjs` ·
`tests/scrum286-bloques-orden.test.mjs` · esta entrada.

**No se ha tocado:** `prisma/schema.prisma` · `pdf.service.ts` ni `src/lib/invoicing.ts` ·
`tests/_banco-vistas.mjs` · los selectores de IVA · `QuoteLineSchema` · el catálogo.
**Ningún microcopy nuevo:** sólo desaparecen campos. Ningún rótulo se ha reordenado ni reescrito.

## Estado del arbol

* origin/main avanzo a fdc98cf0 mientras se cerraba esto (traia mi SCRUM-661). Se ha MERGEADO
  main DENTRO de la rama —no rebase, la historia no se reescribe—, sin conflicto.
* Cliente de Prisma regenerado y dist/ reconstruido DESPUES de mezclar main.
* npm run guards:entrada en verde. Cero CR en disco en los nueve ficheros tocados.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `priceInput.dataset.pfBasePrice` se sigue escribiendo en cinco sitios y **ya no lo lee nadie**: estado muerto.
* El comentario de SCRUM-610 afirma que el margen «viaja también en las PLANTILLAS» y **es falso**: su esquema no lo declara.
* `public/dashboard/js/quoteMargen.js` se sigue cargando en el índice y **el documento ya no lo consume**; sus funciones puras siguen probadas y sirven al catálogo.
* El elemento `priceHint` («Final: …») queda **siempre vacío**: existía sólo para avisar de la diferencia que creaba el margen.

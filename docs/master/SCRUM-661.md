# SCRUM-661 · ①②③ · El coste unitario viaja y se CONGELA en la línea

**Fecha:** 2-sep-2026 · **Carril:** catálogo → línea → esquema · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `283143b4701f75835888e82c25f41ad34e916655` · 2026-09-02T15:06:19+01:00

**Tanda:** 4509 tests, 4430 pass, 0 fail, 79 skipped (los 79 declaran su motivo) — medida DESPUES del ultimo cambio, entrada incluida.

---

## La víctima, y es de largo plazo

`Product.cost` es **mutable y sin histórico**. El día que un fontanero actualice el coste de un
material, **se reescribe el pasado de todas las ventas que lo usaron**: el margen real de aquella
venta deja de ser recuperable ni en teoría. No es que no guardemos el margen — es que **no
guardábamos el hecho del que se derivaría**.

**Decisión ejecutada (no reabierta): salida B**, congelar el coste unitario en la línea. Procedencia:
asesor, 02-sep-2026, por delegación expresa del fundador. Se eligió sobre A (no guardar nada) por
**asimetría del error**: si B sobra, hemos guardado un número de más; si A se queda corta, los meses
intermedios no se reconstruyen jamás.

---

## PASO 0

**ENTRADA.** Dos, y las dos medidas sobre este árbol:

| dónde | ruta exacta |
|---|---|
| el profesional elige del catálogo | `public/dashboard/js/quotesView.js` → `attachProductAutocomplete` → `selectItem(it)` |
| el coste vive hoy | sólo en la ficha de producto (`productsView.js`), **no** en el documento |

**No había ninguna entrada por la que se le pidiera ni se le enseñara el coste en la línea.**

**MECANISMO — existía la mitad de abajo y faltaba la de arriba.** La cadena, medida entera:

| eslabón | antes | dónde |
|---|---|---|
| el coste del producto | **sí**, mutable y sin histórico | `Product.cost` |
| que SALGA hacia el front | **no** | `searchProducts` no lo seleccionaba |
| que la línea lo LLEVE | **no** | el payload no lo ponía |
| que el esquema lo ACEPTE | **no** | `QuoteLineSchema` no lo declaraba |
| que NO llegue al PDF | **con guard** | `scrum661`, ya en `main` |

> Por eso este ticket **paró** en su día en vez de aplicar el diff del esquema: con los dos primeros
> eslabones rotos, ③ habría creado **un campo que nadie rellena**. Los tres van juntos en este PR.

**Lo que ya estaba construido y NO se rehace:** el guard de fuga al papel (`scrum661`), la
aritmética del catálogo (`margenCatalogo.js`), `lineaParaPayload` (`quoteSuplido.js`) y el banco de
vistas. El trabajo era **darles superficie**, no rehacerlos.

---

## Lo construido

### ① `searchProducts` devuelve `cost`

Una clave en el `select` (`products.service.ts`). **Sin filtro por rol**, y es una decisión tomada,
no un descuido:

> «Sí, el operario ve el precio de compra.» — fundador, 02-sep-2026.

La consecuencia —un operario que se va puede llevarse los precios de compra— **está asumida y
escrita**. No se enmascara ni se devuelve una respuesta distinta por rol: eso sería inventar una
regla que nadie ha decidido.

### ② La línea lo lleva, lo enseña y lo envía

Al elegir del catálogo, el coste se **congela** en un campo **visible y editable** de la hoja
«Ajustes de la línea», y viaja en el payload.

**No se esconde, y no es una preferencia: es CONT-01 ②** («nunca se esconde un campo que tiene algo
escrito — un dato invisible es un dato que nadie va a corregir y que sigue viajando»). Guardarlo en
un `dataset` era más barato y creaba exactamente eso. **Ya tenemos uno así en este mismo fichero**
(`pfBasePrice`, hoy estado muerto). No dos.

**Editable**, que es la mitad que hace que la regla sirva: visible-pero-bloqueado cumple «se ve» y
no cumple «alguien lo va a corregir» — una línea escrita a mano no podría llevar coste nunca, y un
coste mal capturado se quedaría mal para siempre.

### ③ `QuoteLineSchema` lo acepta

`costeUnitario: z.number().nonnegative().optional()`. El diff que dejó S2 estaba escrito contra un
esquema anterior (`price` sin `.optional()`, y antes de que SCRUM-655 metiera `apartado`), así que
**se ha adaptado, no aplicado a ciegas**. Y se le añade lo que su forma pedía: **un apartado es un
título y tampoco lleva coste**, con su propio mensaje — decir «cantidad o precio» cuando lo que
sobra es un coste manda a mirar donde no es.

**`prisma/schema.prisma` NO se toca:** `Quote.lines` es `Json`, así que cambia la forma del Json y
no la columna. No hay `ALTER TABLE` ni migración.

---

## 🔴 AUSENTE ≠ CERO, decidido en los tres sitios a la vez

Es la condición 2 del encargo, y se pierde en cualquiera de los tres si sólo se cuida en uno:

| sitio | qué hace | por qué |
|---|---|---|
| la captura | producto sin coste → campo **vacío** | `Number(null)` **es 0**: el `null` se ataja ANTES de convertir |
| el envío | sin dato → **la clave no viaja** (`{}`) | no `{ costeUnitario: 0 }` |
| el esquema | `.optional()` y **no** `.default(0)` | un default convierte el silencio en un dato, y ese dato es falso |

«No se guardaba entonces» y «costó cero» llevan a decisiones opuestas. Si se leyeran igual, el dato
no valdría para nada — y el ticket entero existe para poder calcular un margen con él.

**Coste CERO declarado sí viaja**, y es el caso que separa las dos ideas.

## 🔴 HACIA DELANTE, NUNCA HACIA ATRÁS

Rellenar líneas ya escritas con el `Product.cost` de hoy diría que aquella venta costó lo que cuesta
ahora: **fabricar un hecho histórico falso**. La única forma de que no pase es que la captura viva
en **un solo sitio** —el momento en que el profesional elige—, y hay un guard que **cuenta sus
usos**: un tercer sitio lo tumba. El borrador guarda y restaura tal cual; uno **anterior** a este
campo vuelve sin coste, no con uno inventado.

---

## La alcanzabilidad, que es lo que cierra el ticket

`tests/scrum661b-el-coste-sobrevive-el-viaje.test.mjs`, 14 casos. **Cinco eslabones, cada uno
EJECUTADO o medido por AST**, y el viaje entero seguido:

| eslabón | cómo se comprueba |
|---|---|
| ① el catálogo lo DEVUELVE | AST sobre el `select` de `searchProducts`, **acotado a esa función** |
| ② la vista lo CAPTURA | `costeDeCatalogo` **extraída del fuente y corrida** |
| ③ la línea lo ENVÍA | `costeParaPayload` **corrida** + «mencionar no es hacer» sobre su sitio de uso |
| ④ el esquema lo DEJA PASAR | `CreateQuoteSchema` **ejecutado** |
| ⑤ sobrevive al GUARDADO | round-trip JSON + las dos anclas que unen puerta y columna |

> **Que una puerta deje de borrar un campo NO prueba que el campo llegue.** Por eso el caso «EL
> VIAJE ENTERO» recorre los cinco seguidos: es el único que lo demuestra. La lección es de ayer
> mismo — un `includes(undefined)` daba `true` sobre un comportamiento que la vista ya no tenía.

**El control que da valor al del esquema:** un campo inventado (`campoQueNadieHaDeclarado`) SÍ se
borra. Sin él, el verde de `costeUnitario` no distinguiría «está declarado» de «zod es permisivo».

**Y se pinta la pantalla de verdad** (banco de vistas): el campo se monta, tiene input numérico, no
nace deshabilitado, y **no lo esconde ni `hidden`, ni el estilo, ni una regla de CSS** —
`ocultoPorCss` (SCRUM-666), que sabe declararse **CIEGO** en vez de contestar «visible».

### El rojo, probado por el mecanismo — seis mutaciones, cada una con post-condición

Commit en verde **antes** de mutar. Cada mutación exige que el trozo aparezca exactamente una vez y
que el fichero **haya cambiado**; si no, falla en vez de «probar» sobre un fichero intacto.

| se rompe a propósito | cae |
|---|---|
| `searchProducts` deja de devolver `cost` | ① el catálogo lo devuelve |
| el esquema deja de declarar `costeUnitario` | ④ y EL VIAJE ENTERO (y el suelo del guard de fuga) |
| el payload manda `0` en vez de omitir la clave | ③ «su ausencia NO viaja como cero» |
| el campo nace `hidden` | ③ NO SE ESCONDE — *«🔴 el campo del coste nace `hidden`»* |
| el campo deja de montarse | ② SE MONTA DE VERDAD |
| el coste se recaptura fuera de `selectItem` | HACIA DELANTE |

---

## Condición 1 · el guard de fuga NO se rehace, pero su FRASE sí

Hasta hoy su verde significaba **«aquí no hay coste que filtrar»** — el guard entró antes que el
dato a propósito, porque un guard que llega después del dato llega tarde. **Desde este PR hay
sujeto**, así que su verde significa lo segundo: **el coste está CONTENIDO**. Si esa frase se
quedara como estaba, dentro de seis meses alguien leería una advertencia que ya no aplica.

**Y sus líneas ya no se escriben a mano:** se construyen **por la cadena real**
(`costeDeCatalogo` → `costeParaPayload` → `CreateQuoteSchema`), que es la única forma de probar el
PDF contra la línea que le va a llegar de verdad. Con su suelo: si la cadena no entrega el coste, el
fichero lo dice en vez de «probar» que no sale algo que tampoco entró.

### El interrogatorio del detector — qué ve y qué NO, medido

El hueco estaba declarado en prosa («vigila un número reconocible y el nombre del campo»), y la
prosa envejece. Ahora está **fijado en un test**, con los dos lados:

| **VE** | **NO VE** |
|---|---|
| punto decimal `1234.56` | miles con **espacio** `1 234,56` (normal y duro) |
| coma decimal `1234,56` | **redondeado** `1234.5` o `1235` |
| miles con punto `1.234,56` | partido por un **salto de línea** |
| con el símbolo pegado | apóstrofo de miles `1’234,56` |
| **dentro de una descripción larga** ← lo que preguntaba el encargo | |

No se cierra el hueco entero a propósito: cubrirlo todo exigiría normalizar el texto del PDF, y eso
convierte un detector legible en uno que nadie audita. Lo que hacía falta era **saber qué no cubre y
que esté escrito donde se lee**. Si alguien mejora el detector, ese caso **cae** y le obliga a
actualizar la declaración en vez de dejarla mintiendo.

---

## 🔴 Dos rojos que me enseñó el propio test, no la lectura

1. **El detector del eslabón ① buscaba el primer `select:` DEL FICHERO** y cazaba el de
   `listProducts` — uno de los **cinco** que hay. Daba rojo sobre un `cost` que sí estaba puesto:
   estaba midiendo otra función y no lo decía. La población no es «el fichero», es **la función que
   se afirma**.
2. **El control de montaje no encontraba el campo**, y la conclusión fácil era «no se monta». Falso:
   la hoja de ajustes **no entra en el DOM hasta que se PULSA el chip**. Un control que no pulsa da
   un falso hallazgo — y `scrum660` ya lo había dejado escrito para el selector de IVA. Se pulsa.

Y una suposición mía que costó un rojo: el banco nombra la etiqueta `tagName` (en mayúsculas), no
`tag`. Medir en vez de suponer, también en el instrumento.

---

## 🛑 UN SEGUNDO GUARD ME PARÓ: el trinquete de SCRUM-619, y aquí está su decisión

La tanda salió con **2 fallos**, y los dos eran el mismo guard haciendo su trabajo:

> «HA CAMBIADO EL VOCABULARIO DE UNA LÍNEA DE PRESUPUESTO […] Si has AÑADIDO una clave, esto **no
> es un fallo**: es el aviso. Falta una decisión, y es ésta: **QUÉ HACE LA FACTURA CON ELLA.**»

`tests/scrum619-vocabulario-de-linea.test.mjs` compara los dos vocabularios de una línea. El del
presupuesto acaba de crecer con `costeUnitario`; el de la factura suelta sigue siendo de cuatro
claves y **tira en silencio** todo lo demás.

### Lo que medí antes de decidir — y una hipótesis mía que resultó FALSA

Mi primera lectura fue que el camino presupuesto → factura copiaba `Quote.lines` tal cual, porque
`quotes.routes.ts:556` dice `lines: quote.lines as any`. **Era falso, y lo descubrí mirando el
contexto en vez de quedarme con el `grep`:** esa línea alimenta `generateQuotePdf`, el PDF del
PRESUPUESTO, no una `Invoice`.

Medido de verdad, los **cuatro** caminos que llaman a `emitInvoice` reconstruyen la línea a mano:

| camino | qué líneas emite |
|---|---|
| `albaranes.routes.ts:1042` | `{concept, qty, price, tax}` construido a mano |
| `albaranes.routes.ts:1221` | ídem, vía `lineasParaFactura` |
| `recapitulativa.service.ts:94` | ídem |
| `invoicesAdmin.routes.ts:125` | `val.lineas`, de `validarFacturaSuelta` (4 claves) |

**Ninguno copia `Quote.lines`.** Así que la afirmación que SCRUM-655 dejó escrita sobre `apartado`
es correcta, y mi hipótesis no: bien descartada por medición y no por intuición.

### La decisión, escrita

**`costeUnitario` NO se añade a la puerta de la factura en este ticket.** Dos motivos, y el primero
manda:

1. **Tocar `validarFacturaSuelta` es camino de emisión (reglas 29/38) y es STOP.** Pide el OK del
   fundador; no se hace de paso. Es la misma frontera que ese fichero declara para `suplido` y que
   SCRUM-655 respetó para `apartado`.
2. **Hoy no rellenaría nada:** la factura suelta se teclea a mano en `nuevaFacturaModal.js`, que no
   tiene catálogo ni campo de coste (el censo de SCRUM-600 le contó **cero** capacidades). Sería
   crear un campo que nadie rellena — el mismo error que este ticket evitó al no ensanchar el
   esquema antes de tener los otros dos eslabones.

> 🔴 **Lo que se pierde, dicho en voz alta, porque es la víctima de este mismo ticket:** el coste
> congelado vive en el **presupuesto** y no viaja a la factura. El margen real sigue siendo
> reconstruible desde el presupuesto —que es donde están el coste y el precio—, pero **no lo será
> desde una factura que no tenga presupuesto detrás.** Eso es una decisión del fundador; queda
> escrita en el trinquete y aquí para que sea suya y no del descuido.

La divergencia entre las dos puertas pasa de dos claves a tres: `apartado`, `costeUnitario`,
`suplido`. Cada una es un dato que el presupuesto guarda y la factura no.

---

## 🛑 Microcopy PENDIENTE (regla 30)

El rótulo **«Coste»** NO es inventado: es **literalmente el que ya está aprobado y en pantalla en el
catálogo** (`productsView.js`, en el alta y en la edición), reusado para el mismo concepto. Aun así
**lo aprueba el asesor**, y hasta entonces el nodo lo dice de sí mismo con
`data-microcopy="PENDIENTE_FUNDADOR"` — el marcador que ya usa el índice, no uno nuevo.

## Ficheros

`src/modules/products/domain/products.service.ts` (①) · `src/core/validation/schemas.ts` (③) ·
`public/dashboard/js/quotesView.js` (②) · `tests/scrum661-el-coste-no-llega-al-papel.test.mjs`
(condición 1: la frase, la cadena real y el interrogatorio) ·
`tests/scrum661b-el-coste-sobrevive-el-viaje.test.mjs` (**nuevo**) ·
`tests/scrum619-vocabulario-de-linea.test.mjs` (la lista del trinquete y la decisión) · esta entrada.

**No se ha tocado:** `prisma/schema.prisma` · `pdf.service.ts` ni `src/lib/invoicing.ts` (S3) ·
`tests/_banco-vistas.mjs`, `sw.js` ni los extractores del índice (S2 — el banco se **usa**, no se
modifica) · los tres restos de SCRUM-669 · `quoteSuplido.js` · el catálogo.

## Estado del arbol

* La rama nació **apilada sobre `scrum-598`** (139ebbd1) porque ② toca los dos bloques que
  SCRUM-598 reescribió y ramificar de `main` habría dejado un conflicto a mano **en el bloque donde
  vive el precio**. Se midió que el árbol era el de 598 y no el de `main` (2 `finalPrice = safePrice`
  y 0 `markupInput`, contra 22 `markupInput` en `main`) — comprobado, no supuesto.
* **SCRUM-598 entró en `main` durante la sesión**, así que se ha **MERGEADO main DENTRO** de la rama
  —no rebase, la historia no se reescribe— sin conflicto, y el diff del PR queda **sólo con los 5
  ficheros de este ticket**.
* Cliente de Prisma regenerado desde ESTE worktree y `dist/` reconstruido DESPUÉS de mezclar main.
* `npm run guards:entrada` en verde. Cero CR en disco en los ficheros tocados (medido por BYTES).

## Los huecos que declaro

1. **No he verificado en navegador REAL.** El banco de vistas ejecuta la pantalla y lee el CSS del
   índice, pero no es un navegador: no hay layout ni pintado.
2. **El eslabón ⑤ no toca la base de datos.** Se prueba el round-trip de serialización —que es lo
   que hace una columna `Json`— y se anclan las dos líneas que unen la puerta con la columna. Que
   Postgres devuelva el Json intacto no está medido aquí.
3. **El detector de fuga no cubre cuatro grafías**, listadas arriba y fijadas en un test.
4. **No he probado el autocompletado contra el endpoint real:** ① se comprueba sobre el `select` de
   Prisma, no haciendo la petición.
5. **`homeView.js` también consume ese endpoint** y ahora recibe `cost` sin usarlo. Es exposición sin
   consumidor en ESA pantalla; filtrar por pantalla exigiría dos respuestas distintas del mismo
   endpoint, que es justo lo que la decisión del fundador descarta.
6. **No he medido producción.**

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `ajustesBtn.title` sigue diciendo «Ajustes de la línea (margen e IVA)» y el margen salió en DOC-08: es microcopy, lo aprueba el asesor, y por eso NO lo he tocado.
* `homeView.js` tiene su propio `searchProducts` contra el mismo endpoint, así que la superficie de ① son dos pantallas y no una.
* `priceInput.dataset.pfBasePrice` sigue escribiéndose en cinco sitios sin que nadie lo lea (SCRUM-669), y es el precedente exacto del dato invisible que este ticket ha evitado crear.

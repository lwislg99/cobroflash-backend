# SCRUM-734 · Las tres puertas del PDF de presupuesto dejan de tener tres listas

**Fecha:** 4-sep-2026 · **Carril:** documentos · **Gate:** todo en `npm test`; sin gates de BD

**Medido contra:** `origin/main` = `93ceed21f7fb5d0bebb0a09f37cce84c170e520e` · 2026-09-04T19:40:03Z

**Tanda:** 5258 tests, 5169 pass, **1 fail**, 88 skipped — corrida DESPUES del ultimo cambio,
entrada incluida. El fallo **no es de este ticket**: es `SCRUM-176b`, que construye una ruta con
`new URL(import.meta.url).pathname` y por eso da rojo en cualquier checkout cuya ruta lleve un
espacio, y verde en CI. Sigue sin arreglar en `main`, y S5 lo tiene en su carril.

⚠️ **Esta rama SALE DE `scrum-731-descuento-global-explicado`, no de `main`.** La PR del 731 estaba
pendiente de mergear y este ticket toca **exactamente las mismas tres llamadas**: ramificar de
`main` habría producido dos arreglos del mismo `discountGlobalAmount` y un conflicto seguro. El
orden de merge es 731 → 734.

---

## Las víctimas

- **`modoIva`**: el profesional elige «IVA no incluido» y el PDF servido por P3 **imprime el
  desglose igual**. Es la misma frase con la que SCRUM-656 describió su propio defecto: *«un papel
  equivocado a un cliente, sin que fallara nada»*.
- **`clausulas` / `clausulasExcluidas`**: las condiciones de cierre —garantía, alcance, validez—
  desaparecen del PDF servido. Son las que **acotan a qué se compromete el profesional**: un
  presupuesto sin ellas promete más de lo que su autor quiso prometer.
- **`tiers` en P2**: el cliente firmó eligiendo entre tres opciones y el papel regenerado ya no las
  enseña.

---

## PASO 0

### ENTRADA

Las tres puertas del mismo documento, medidas por AST:

| | ruta | qué hace |
|---|---|---|
| **P1** | `POST /admin/quotes` — `quotes.routes.ts:254` | crea el presupuesto y pinta su PDF |
| **P2** | la decisión del cliente — `quotes.routes.ts:607` | regenera el PDF **con la firma** |
| **P3** | `GET /admin/quotes/:id/pdf` — `quotesAdmin.routes.ts:530` | regenera bajo demanda y **sobrescribe `pdfUrl`** |

### MECANISMO

**No existía.** Cada puerta armaba a mano su objeto de **veinte claves**. Escritas en tickets
distintos —593, 594, 602, 647, 656, 731—, habían divergido en cuatro campos.

**Y el mecanismo que sí existía era el equivocado:** cuatro censos de tests (593c, 602, 731, 647)
vigilaban «las tres puertas llevan el campo X», y los cuatro tenían el mismo supuesto escrito
cuatro veces —«la puerta arma un objeto literal»—. Cuatro censos con el mismo supuesto **se rompen
el mismo día**: no es redundancia, es un punto de fallo escrito cuatro veces.

### La medición que decidió el diseño

**¿Es derivable cada uno de los veinte campos de `quote` + `merchant` + `customer`?** Sí, los
veinte. Campo por campo, incluido el que parecía no serlo:

- `tiers`: lo que P1 pasa (`tiersWithTotal`) **es exactamente lo que se guarda** (`quotes.routes.ts:200`).
- `signatureData` / `signedAt`: parecían tener que pasarse aparte en P2 porque la firma llega en la
  petición. **No**: esa ruta hace el `update` con `signatureUrl` y `acceptedAt` **antes** de
  regenerar el papel. Ya están en la fila.

Con eso, la opción A (una sola fuente) deja de ser una aspiración y pasa a ser posible. Por eso se
elige A y no B (un guard que vigile la divergencia): **lo que se puede hacer imposible no se
vigila.**

---

## Lo que se construye

| fichero | qué hace |
|---|---|
| `src/modules/quotes/domain/presupuestoParaPdf.ts` | **el único sitio** donde se decide qué lleva el documento |
| `pdf.service.ts` | el tipo inline pasa a llamarse `ParamsPdfPresupuesto` — **el mismo texto, movido, sin tocar una letra** |
| las tres rutas | dejan de enumerar veinte claves: le piden el objeto al constructor |
| `tests/_puertas-del-presupuesto.mjs` | el censo de puertas, **compartido** por los cuatro tickets que preguntan lo mismo |

**Neto: −151 líneas** de objeto armado a mano.

### 🔴 El mecanismo es el COMPILADOR, no un guard

```ts
export type Completo<T> = { [K in keyof T]-?: T[K] };
export function paramsDePresupuestoParaPdf(…): Completo<ParamsPdfPresupuesto>
```

`-?` quita el `?` de las veinte claves. Efecto: **una clave que falte no compila.** Y el día que el
documento estrene un parámetro nuevo, **este fichero deja de compilar hasta que alguien decida de
dónde sale** — que es antes de que llegue, no después. Un guard avisa; esto no deja pasar.

Los valores siguen pudiendo ser `null` (los catorce opcionales ya declaraban `| null`), así que «no
hay firma» se sigue diciendo. Lo que se pierde es «esta puerta se olvidó de la firma», que es justo
lo que había que perder.

**El guard de tests cubre lo que el compilador no ve**: que las tres puertas sigan *pidiendo* la
carga en vez de volver a armarla. Su rojo nombra puerta y campos:

```
src/modules/system/app/routes/quotesAdmin.routes.ts:1 arma su propio objeto y NO CONOCE:
quoteNumber, docFields, discountGlobalAmount, docHeaderText, docFooterText, direccionObra,
signatureData, signedAt, country, taxName, modoIva, clausulas, clausulasExcluidas, tiers
```

### 🔴 Lo que destapó el refactor, y es peor que los cuatro campos

**P2 regeneraba el PDF firmado desde la fila ANTERIOR a su propia actualización.** Esa ruta escribe
`total` y `lines` cuando el cliente elige un tramo (`...(tierTotal ? { total: tierTotal } : {})`), y
el bloque del PDF leía `quote`, no `updatedQuote`. El cliente elegía la opción «Better», firmaba, y
**el papel que quedaba guardado enseñaba el total viejo**.

No estaba en el encargo: salió de preguntarse de qué fila se alimenta el constructor.

---

## El control negativo que pidió el asesor

> «un campo que legítimamente sólo aplica a una puerta NO puede hacerlo caer. Y si no existe
> ninguno así, dilo CON ESAS PALABRAS.»

**NO EXISTE NINGUNO ASÍ.** Medido campo por campo, y hasta el caso que lo parecía —la firma— no lo
era. Se dice con estas palabras en vez de inventar una excepción para que el control parezca
completo.

El control negativo que **sí** vale está puesto y es otro: **cambios inocuos que no pueden hacer
caer el guard** — reordenar las fuentes que se le pasan al constructor, o meter un comentario dentro
de la llamada. Los dos siguen en verde.

---

## Mutación · seis defectos, seis cazados

Post-condición en cada uno: cambió el fichero que dice y **sólo** ése, y para las de TypeScript, si
`dist/` se movió. «No compila» cuenta como **cazada** —el sistema de tipos es el guard más fuerte—
y se comprueba igualmente que los tests lo vean.

| # | defecto inyectado | quién lo caza |
|---|---|---|
| ① | el constructor deja de producir `modoIva` | **el compilador** + 2 tests |
| ② | …deja de producir `tiers` | **el compilador** + 2 tests |
| ③ | la firma se relaja al tipo con opcionales | el test de la firma |
| ④ | `Completo<T>` deja de quitar el `?` | el test de la firma |
| ⑤ | P2 vuelve a la fila anterior | el test de `updatedQuote` |
| ⑥ | se pierde el suelo de las cláusulas ilegibles | el test del suelo |

⚠️ ③ y ④ los caza un test de **texto** sobre la firma y sobre `-?`, no el compilador: una mutación
de tipos no emite JS distinto (`dist` no se mueve, y la salida lo dice). La red de abajo es el test
que compara las claves del constructor con las del tipo, que sí caza una clave perdida pase lo que
pase con `Completo`.

Control negativo: sin mutar, cero rojos. Tras restaurar, cero rojos y las huellas vuelven.

---

## Cuatro censos ajenos cayeron a la vez, y era la señal correcta

593c, 602, 731 y 647 se quedaron ciegos el mismo día, porque los cuatro leían objetos literales.
**No se han «adaptado» para que sigan en verde:** la propiedad que vigilan sigue siendo cierta y
sigue importando, y lo que cambia es cómo se comprueba. Un censo cuyo modelo se rompe **tiene que
fallar**, y falló.

Se les devuelve la **pregunta** sobre `tests/_puertas-del-presupuesto.mjs`, que lanza si no
encuentra puertas o si no puede leer las claves del constructor: «no supe mirar» y «esa puerta no
lleva nada» son el mismo resultado con significados opuestos.

Y 647 no da por buena una delegación a ciegas: **comprueba antes que el constructor sigue
produciendo `taxName`**. Si dejara de hacerlo, las tres puertas perderían el impuesto a la vez y esa
línea es la única que lo vería.

**`HUECOS_DECLARADOS` de SCRUM-731 pasa a estar VACÍO**, y el vacío es el resultado: los seis huecos
que aquel ticket declaró están cerrados por construcción. La constante se queda aunque valga cero
—misma decisión que `SIN_APROBAR` en `filtroClientes.js`—: si alguien vuelve a armar un literal, el
hueco nace sin sitio donde declararse y el test cae.

## Dos guards ajenos se respetaron moviendo MI código, no su frontera

- **SCRUM-603b** recorta «de `generateInvoicePdf` al siguiente `export`» y lo exige idéntico byte a
  byte. El tipo nuevo caía dentro y ponía en rojo un guard que protege una factura ya emitida por un
  cambio que no toca la factura. **Se movió el tipo arriba.** Relajar esa frontera para que quepa un
  refactor de presupuestos sería pagar con la vigilancia equivocada.
- **SCRUM-189** caza citas numeradas a la doctrina sin nombrar su fichero: mi comentario decía
  «regla 29 de». Reescrito.
- **SCRUM-411**: el ayudante de cláusulas deja de exportarse — nadie de fuera lo llama, y un export
  sin llamador es indistinguible de una función entregada.

---

## Microcopy

**Ninguna.** Este ticket no estrena ni un texto: mueve datos que ya se imprimían por otras puertas.
No se ha pintado ningún marcador y el censo de SCRUM-402 no se mueve.

---

## Tests

- `tests/scrum734-una-sola-carga.test.mjs` — los 10: suelo de los tres censos, las tres puertas
  delegando, el rojo que nombra puerta y campo, el control negativo de los cambios inocuos, el
  constructor cubriendo el tipo entero, la firma que no deja olvidarse un campo, los cuatro campos,
  la firma desde la fila, P2 sobre `updatedQuote`, y el suelo de las cláusulas tras la mudanza.
- `tests/_puertas-del-presupuesto.mjs` — el censo compartido, con `CensoCiego`.

---

## Huecos declarados · lo que NO verifiqué

- **No he generado los PDF de las tres puertas para compararlos entre sí.** Lo que se comprueba es
  que las tres reciben la misma carga, no que impriman el mismo papel: si el documento leyera algo
  de fuera de sus `params`, esto no lo vería.
- **No he ejercitado las rutas de verdad** (sin BD): el cambio de `quote` a `updatedQuote` en P2 se
  verifica leyendo el fuente, no llamando al endpoint.
- **`FuentesDelPresupuesto` usa `any`** a propósito para no redeclarar el modelo de Prisma; el
  precio es que un `quote` al que le falte un campo no lo caza el compilador, sólo daría `null`.
- **No he corrido `npm run guards:visuales`**: miden la landing y este ticket no toca frontend, pero
  **no lo he ejecutado**.

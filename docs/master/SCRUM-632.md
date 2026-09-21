# SCRUM-632 · La casilla «Incluir descripción» que no puede cumplir lo que promete

**Medido contra:** `origin/main` = `b8bb02cae338b38e0239b36920f95a9a12157862` · 2026-09-01T18:20:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance: MIDE Y PROPÓN. No se construye la salida.** No se toca `conceptoLinea.ts` ni su
trinquete (SCRUM-603), ni el esquema —el diff va **preparado**, sin aplicar—, ni
`pdf.service` / formateadores (S3), ni el banco de vistas (S1).

---

## 1a · ¿Son ésos los únicos sitios donde se borra? Sí — pero **no son tres del mismo tipo**

Censo por **AST** sobre 527 ficheros (`src/`, `public/`, `scripts/`; fuera `node_modules`,
`dist` y `tests`). Busca asignaciones, `delete` y `removeAttribute` sobre cualquier clave de
`dataset` cuyo nombre suene a descripción, incluidas las de **corchetes** y las de **clave
calculada**. **Un solo fichero** tiene alguna: `public/dashboard/js/quotesView.js`.

| Tipo | Línea | Contexto | Qué es |
|---|---|---|---|
| BORRA | `:1893` | `addEventListener("input")` sobre `conceptInput`, dentro de `attachProductAutocomplete` | 🔴 **el defecto** — borra con CUALQUIER tecla |
| BORRA | `:2361` | `addEventListener("input")` sobre `conceptInput`, dentro de `addLine` | 🔴 **el defecto** — borra si el nombre ya no coincide |
| BORRA | `:2410` | `addEventListener("click")` sobre `removeBtn` | ✅ **legítimo**: resetea la última línea al vaciarla |
| ESCRIBE | `:1745` | `selectItem` | el único sitio que la RELLENA, y sólo desde catálogo |
| LEE | `:1271` | `renderPreview` | la vista previa de pantalla |
| LEE | `:2987` | `submitBtn` | el camino del PDF |

**Corrección a la premisa del encargo:** los tres existen, pero el tercero **no es el defecto**.
`:2410` es el botón de quitar línea reseteando la última —que es lo que debe hacer—. Los sitios
del borrado silencioso son **dos**, y los dos escuchan el evento `input` **del mismo campo**.

### El cero está declarado, y el detector sabe ver un cuarto

| Prueba | BORRA |
|---|---|
| población REAL | **3** |
| + un 4.º borrado corriente | 4 |
| + uno con corchetes `dataset["…Description"]` | 4 |
| + uno con `delete` | 4 |
| + uno con `removeAttribute("data-pf-product-description")` | 4 |
| + una asignación CON valor (no borra) — control negativo | 3 |
| + el mismo texto dentro de un COMENTARIO — control negativo | 3 |
| + una clave que no es de descripción (`pfProductName`) — control negativo | 3 |

El comentario es el que justifica el AST: con `grep` habría contado 4.

**Límite declarado:** el censo ve borrados de una clave de `dataset`. **No** vería una pérdida
por reemplazo del elemento entero (`outerHTML`, recrear la fila). No se ha encontrado ninguno,
pero el censo no es quien lo descarta.

## 1b · 🔴 ¿El dato tiene dónde vivir? **NO. Vive DENTRO del concepto.**

Ésta es la pregunta que decide el tamaño de todo, y la respuesta cambia el ticket entero.

Medido ejecutando el esquema compilado de verdad:

```
A · línea con `description` como campo propio
   claves que SOBREVIVEN: concept, price, qty, tax
   description          : NO EXISTE (zod la ha borrado)
B · el mecanismo de HOY: pegada al concepto con un salto de línea
   claves que SOBREVIVEN: concept, price, qty, tax
   concept guardado     : "Sustitucion de llave de paso\nIncluye corte de agua y purgado"
```

* **`QuoteLineSchema` no tiene `description`**, y `z.object` borra en silencio lo que no
  declara — el mismo agujero que `suplido` tuvo hasta SCRUM-500, avisado en el propio comentario
  de esa clave.
* Lo que hace el front hoy es **pegar la descripción al concepto con un `\n`**
  (`quotesView.js:2990`) y mandarlo como `concept`. Es decir: **la descripción no es un dato,
  es parte del texto del concepto**, y lo ha sido siempre.
* Y eso es **exactamente** lo que SCRUM-603 vuelve a partir en el PDF: `partirConceptoYDescripcion`
  devuelve `titulo` + `descripcion` a partir del salto de línea. Comprobado ejecutándolo.

### Tres consecuencias medidas, que abaratan la salida 1

1. **No hay migración de Prisma.** `Quote.lines` es `Json`: cambia la FORMA del Json, no la
   columna. Nada de `db push`.
2. **No toca el sellado.** Las líneas de factura **no se copian del presupuesto**: los cuatro
   llamadores de `emitInvoice` las construyen a mano (`concept/qty/price/tax`) desde albaranes o
   desde el cuerpo validado del admin. `registro.builder.ts` **no lee `lines`** (sólo lo nombra
   en un comentario). Una clave nueva en `Quote.lines` **no llega a VeriFactu**.
3. **Radio:** 14 lecturas de `Quote.lines` en 9 ficheros. Añadir una clave es aditivo para todas
   ellas; ninguna se rompe por no conocerla.

## 2 · El «ANTES», leído del PDF generado (no del código)

Se generan presupuestos de verdad y se les lee el texto con `_texto-del-pdf.mjs` (SCRUM-604).
El modelo del front va **anclado a la fuente por bytes**: si el pegado o el borrado cambian, el
instrumento **declara ciego** en vez de seguir midiendo una pantalla que ya no existe — y lo
hizo cuando el ancla estaba mal escrita.

| Escenario | El PDF |
|---|---|
| 1 · línea escrita a mano + casilla MARCADA | **NO lleva la descripción** |
| 2 · línea del catálogo, SIN TOCAR — **control negativo** | **SÍ la lleva** (exactamente como hoy) |
| 3 · línea del catálogo y corriges una errata del concepto | **NO la lleva** 🔴 *el que duele* |
| 4 · control positivo del lector: el texto SÍ está | **SÍ la lleva** |

La fila 4 es la que hace que las filas 1 y 3 signifiquen algo: sin ella, un lector roto daría
«NO lleva» siempre y se leería como que el defecto existe.

## 3 · Las salidas, cada una con su consecuencia

### S1-a · Descripción editable a mano, **SIN tocar el esquema** ← la más barata

Un campo de descripción en la línea que, al enviar, se pega al concepto con `\n` —**el mecanismo
que ya está en producción**—. La casilla sigue decidiendo si se pega o no.

* **Coste:** sólo `quotesView.js`. Cero esquema, cero migración, cero microcopy si la casilla
  conserva su rótulo aprobado. SCRUM-603 sigue funcionando **sin tocarlo**: ya sabe partir eso.
* **Consecuencia:** el concepto guardado lleva el `\n` dentro. Ya lo lleva hoy, así que no es
  nuevo — pero pasaría de ser excepción a ser lo normal, y hay 14 lecturas de `Quote.lines`
  que lo verán más a menudo. **Hay que mirar cómo lo pintan la landing y el WhatsApp** antes de
  construir; no se ha medido en este ticket.
* **Lo que NO arregla:** la descripción sigue sin poder editarse por separado una vez guardada.

### S1-b · `description` como campo propio de la línea → **DIFF PREPARADO, NO APLICADO**

```diff
--- a/src/core/validation/schemas.ts
+++ b/src/core/validation/schemas.ts
@@
 const QuoteLineSchema = z.object({
   concept: z.string().min(1),
+  /**
+   * SCRUM-632 · LA DESCRIPCIÓN DE LA LÍNEA. Sin declararla aquí, `z.object` la BORRA en
+   * silencio —lo mismo que le pasaba a `suplido` antes de SCRUM-500— y no llegaría nunca a
+   * `Quote.lines`. Que falte significa «esta línea no lleva descripción», que es lo que
+   * tienen todas las líneas de siempre.
+   */
+  description: z.string().optional(),
   qty: z.number().positive(),
```

* **Coste:** ese diff **es todo el cambio de esquema**. `prisma/schema.prisma` **no se toca**.
* **Consecuencia grande, y por eso no la doy por buena:** deja **DOS mecanismos vivos** para lo
  mismo —la descripción pegada al concepto y la descripción como campo—, y el PDF tendría que
  leer los dos. Es la familia de SCRUM-617/620/625/627: *una primitiva existe y aparece una
  segunda implementación al lado*. Si se elige esta salida, hay que **migrar la pegada y
  retirarla**, no sumarla; y eso ya toca `pdf.service` (S3) y el trinquete de SCRUM-603.

### S2 · Que el borrado deje de ser silencioso

El borrado vive en el listener de **`input`**: avisar ahí es avisar **en cada tecla**. Las dos
formas que no molestan son *no borrar hasta que el campo pierda el foco* o *borrar y ofrecer
deshacer*. Las dos necesitan **texto que no existe** → sale con `[PENDIENTE microcopy oficial]`
y **el censo de SCRUM-402 sube de 10 a 11 ficheros** (entra `quotesView.js`, que hoy no está).

### S3 · Deshabilitar la casilla cuando ninguna línea puede tener descripción

Es la única salida que **deja de prometer** sin tocar ni esquema ni dato: la casilla se apaga
cuando todas las líneas tienen la clave vacía, y se enciende sola en cuanto una viene del
catálogo. Se calcula en el `onChange` que ya existe.

* **Consecuencia:** una casilla deshabilitada **sin decir por qué** es peor que una que no hace
  nada. El «por qué» es texto nuevo → `[PENDIENTE microcopy oficial]`, misma subida 10 → 11.
* **Y ojo:** si el fundador responde que **sí** a la pregunta de abajo, esta salida **sobra** —
  no habría ninguna línea incapaz de tener descripción.

## 4 · ⚠️ La pregunta que va debajo de todas, y que NO decido

**¿Debe una línea escrita a mano poder tener descripción?**

Lo que sí puedo aportar es que **no es una pregunta cara**: el dato ya viaja dentro del concepto
y el PDF ya sabe partirlo, así que el «sí» cuesta un campo en una pantalla (S1-a), no un cambio
de modelo. Y que el caso que describe el encargo —el fontanero que escribe
«Sustitución de llave de paso bajo fregadero» a mano porque eso no está en ningún catálogo— es,
por lo medido, el caso en el que la casilla **no puede** hacer nada.

* Si la respuesta es **SÍ** → S1-a, y S3 sobra.
* Si la respuesta es **NO** → el ticket es sólo **dejar de prometerlo**: S3 + S2, ambas con
  microcopy pendiente. Cambia el ticket de arriba abajo, tal como decía el encargo.

**No se elige aquí.**

## 5 · 🔴 HALLAZGOS FUERA DE ALCANCE

1. **Una lectura de una clave que nadie escribe.** `quotesView.js:2987` lee
   `dataset.pfProductDescription || dataset.pfProductDesc`. El censo dice que **`pfProductDesc`
   no se escribe en ningún sitio** (1 escritura en todo el repo, y es de la clave larga): esa
   mitad del `||` está muerta. No se toca.
2. **Dos listeners de `input` sobre el mismo campo hacen el mismo borrado.** `:1893`
   (incondicional, salvo `suppressOpenOnce`) y `:2361` (condicionado a que el nombre haya
   cambiado). Que el segundo sea alcanzable depende del orden de registro y de
   `suppressOpenOnce`; **no se ha ejecutado**, y por eso se deja como observación estática, no
   como conclusión.
3. **Un comentario que quedó viejo.** `quotesView.js:408` dice de la casilla
   «MVP: solo afecta a la vista previa por ahora». Ya no: desde el pegado de `:2990` afecta al
   PDF. Es sólo un comentario, pero es el que hace pensar que la casilla es inofensiva.
4. **Dos lectores distintos del mismo dato.** La vista previa (`:1271` → `:1445`) lo lee como
   `l.description` de un objeto propio; el PDF (`:2987`) lo lee del `dataset` directamente. Hoy
   coinciden; nada los obliga a coincidir mañana.

---

# SCRUM-632b · La línea gana descripción propia — construido

**Fecha:** 08-sep-2026 · **Carril:** producto · **Gate:** ninguno — `prisma/schema.prisma` NO se toca

**Medido contra:** `origin/main` = `2f123b7071d148bc93b87a42354f52ede8bef065` · 2026-09-08T05:41:39+01:00

## La decisión que lo ordena

> «Sí tiene que haberlo. Además la descripción del presupuesto/factura es DISTINTA a la de
> producto: es algo que aparece en el doc, que se utiliza para poner el texto que quiera el
> merchant.» — el fundador, 8-sep-2026

Son **dos datos**, y hasta hoy el producto tenía **uno**:

* descripción del **PRODUCTO** → vive en el catálogo, la escribe quien lo mantiene;
* descripción de la **LÍNEA** → vive en el documento, la escribe el profesional, y es **suya**.

Por eso se borraba al teclear: colgaba de `conceptInput.dataset.pfProductDescription`, es decir
**del input del concepto**. Cualquier cosa que invalidara «este producto» se la llevaba por
delante — incluido el propio profesional escribiendo.

## Lo construido

| | |
|---|---|
| **Esquema** | `QuoteLineSchema` gana `description: z.string().optional()`. **`prisma/schema.prisma` no se toca**: `Quote.lines` es `Json`, así que esa clave es todo el cambio. Sin ALTER y sin migración — no hay nada que parar. |
| **El campo** | Un `textarea` propio en la hoja de ajustes de la línea (con el coste y el descuento; en la fila principal costaría alto por línea, medición de SCRUM-594). |
| **Precarga (req. 2)** | Elegir del catálogo **propone**: rellena el campo desde `it.description`. A partir de ahí es de la línea. Y **no pisa** lo que el profesional ya escribiera — sobrescribir sería el mismo defecto por la otra puerta. |
| **Req. 3, por construcción** | Los **dos sitios de defecto** dejan de tocar la descripción: sueltan el producto (`pfProductId`, `pfProductName`), que es cierto, pero el texto ya no cuelga de ahí. El **tercero es legítimo** —vacía la línea entera— y ahí sí se limpia también el campo. |
| **Req. 4** | Una línea escrita **a mano** con descripción y la casilla marcada ya llega al papel. |
| **Borrador** | La descripción sobrevive a un F5, igual que `costeUnitario`. |

## 🔴 La decisión de diseño que hay que leer entera

`pdf.service` **es camino de emisión** y el encargo lo prohíbe expresamente (regla 38). Así que la
descripción **se sigue pegando al `concept` con `\n`** —el mecanismo que SCRUM-603 ya sabe partir—
y **además** viaja como clave propia.

**Queda una redundancia y se declara en vez de esconderse:** el mismo texto está pegado al
`concept` y en `description`. La dirección es **una sola** —el campo manda, y el concepto se
compone de él en un único sitio— pero mientras el PDF lea el concepto hay dos sitios con el mismo
texto.

**Lo deseable es retirar la pegada**, y eso exige que `pdf.service` prefiera la clave: camino de
emisión, su propio ticket y su propio GO. Se deja dicho para que nadie lo lea como olvido.

**Consecuencia medida, del trinquete de SCRUM-619:** `description` entra en `DIVERGENCIA` — la
CLAVE no sobrevive al facturar, porque los cuatro caminos de emisión reconstruyen la línea con
`concept/qty/price/tax`. Pero el **texto sí** sobrevive, dentro del `concept`. En la factura la
descripción sigue saliendo en el papel; deja de ser un dato separado.

## Verificación

| Control | Cómo | Resultado |
|---|---|---|
| 🔴 **ROJO 1** · línea a mano + casilla → descripción en el PDF | **leído del PDF generado** con `extraerTextoPdf`, no del fuente | ✅ |
| 🔴 **ROJO 2** · editar el concepto ya no la pierde | los dos sitios de defecto, sobre el fuente EJECUTABLE (`soloEjecutable`) | ✅ |
| ✅ **POSITIVO** · línea sin descripción sale exactamente como hoy | PDF generado: no aparece ninguna | ✅ |
| ✅ **NEGATIVO** · editar la línea no toca el catálogo | no existe ninguna escritura a `it.description`; y la precarga no pisa lo escrito | ✅ |
| 🔴 **SUELO** · el barrido de sitios que sueltan el producto no da cero | son tres, y el suelo exige ≥ 3 | ✅ |

**Probado EN ROJO, cada arreglo por separado:** devolviendo el borrado al teclear cae exactamente
el control de los sitios de defecto; devolviendo la lectura del `dataset` en el envío cae
exactamente el del campo propio. Ninguno de los dos arrastra al otro.

**Microcopy:** el rótulo del campo nace con `[PENDIENTE microcopy oficial]` desde una sola
constante (`MARCA_DESC_LINEA`). Censos declarados: SCRUM-402 y SCRUM-755, `quotesView.js` de 3 a 4.

**Suite:** 6137 tests · 6032 pass · 0 fail · 105 skipped · exit 0.

⛔ Sin tocar `conceptoLinea.ts` ni su trinquete (SCRUM-603), sin dependencias nuevas, sin
producción ni staging, y sin tocar el camino de emisión.

---

# SCRUM-632c · La unión con SCRUM-597, y el corte que la unión no contestaba

**Fecha:** 08-sep-2026 · **Carril:** producto · **Gate:** ninguno

**Medido contra:** `origin/main` = `1bbf60afb9eae547e083e1c716fa97c88306d791` · 2026-09-08T07:15:37+01:00

## La unión: dos hunks, los dos lados

Al mergear main —que ya trae SCRUM-597— git marcó **dos** conflictos en `quotesView.js`, los dos
en el mismo sitio de la línea. Se resuelven por UNIÓN, cero líneas borradas:

* **Hunk ①** — se quedan los dos bloques y sus dos declaraciones: `descTd`/`descInput` (632, con su
  explicación de por qué la descripción deja de colgar del `dataset` del concepto) y
  `const veEconomia` (597, con su comentario de P-DOC-3).
* **Hunk ②** — se conserva **íntegro** el comentario de main de los «DOS MOTIVOS INDEPENDIENTES» y
  su línea `if (veEconomia && !esDocumentoSuelto)`. **No** se sustituye por el `if` de esta rama:
  eso habría perdido el motivo de 597, que es justo lo que ese comentario advierte.

## 🔴 La pregunta que la unión no contestaba, decidida MIDIENDO

La rama pintaba `descTd` **siempre**, también en documento suelto. La regla del fichero:

> «Un control aparece en modo documento suelto SI Y SÓLO SI SU DATO SOBREVIVE AL EMISOR.»

**Los dos hechos, comprobados EJECUTANDO y no leyendo:**

**①** Se ejecutó `cuerpoDelDocumentoSuelto(7, [{…, description: 'TEXTO DEL PROFESIONAL'}])`. El
cuerpo salió así:

```json
{ "customerId": 7, "lines": [ { "concept": "Grifo monomando", "qty": 1, "price": 100, "tax": 0.21 } ] }
```

La descripción **no viaja**: ni como clave, ni pegada al concepto.

**②** `descCheck` cuelga de `descLabel` → `descWrapper` → `blockDelivery`, y `blockDelivery` sólo se
añade a la tarjeta con `if (!esDocumentoSuelto)`. En ese modo la casilla **no está en el DOM**: ni
se ve ni se puede marcar.

**Decisión:** `if (!esDocumentoSuelto) ajustesCampos.appendChild(descTd);`, con el motivo escrito al
lado. En ese modo el campo sería lo que este fichero enumera tres veces como defecto: un control que
el profesional rellena y que no llega a ningún sitio.

⚠️ El nodo se sigue **construyendo** —lo leen el autocompletado y el borrador—; lo que no ocurre es
que se pinte. Mismo trato que el coste y por el mismo motivo.

## Verificación de la unión, ejecutada

`tests/scrum632-los-dos-cortes-de-la-linea.test.mjs` extrae del fuente las líneas que deciden y las
**ejecuta** con un DOM de juguete, en los dos modos y con los dos mecanismos:

| Escenario | Coste | Descripción |
|---|---|---|
| técnico · presupuesto | ausente (597) | **presente** — no es economía del negocio, es el texto del documento |
| propietario · presupuesto | presente | presente |
| documento suelto | ausente (600/616) | ausente (632, medido) |

Y la medición que sostiene el corte va **dentro** del test: si algún día la descripción empezara a
viajar en documento suelto, ese caso cae y hay que volver a decidir. Sin él, el corte sería una
opinión de hoy.

**Probado EN ROJO por los dos lados:** dejando el `if` de 600 solo cae el control; dejando el
`appendChild` de la descripción sin gate, también. Cada uno tumba su caso.

**Suite:** 6163 tests · 6058 pass · 0 fail · 105 skipped · exit 0.
Control TAP de `scrum821b`: 3 `ok` · `# skipped 0`.

---

# SCRUM-632c · La variable que no salía del `try` — main roto, y mi suite en verde

**Fecha:** 08-sep-2026 · **Carril:** corrección urgente · **Gate:** ninguno

**Medido contra:** `origin/main` = `f0ec26e86a04a21e9e60b748b4c7c5c2c83bace9` · 2026-09-08T08:04:34+01:00

## El defecto, y es mío

SCRUM-632 declaró `const desc` **dentro** de un `try { … } catch {}` y usó `desc` en el spread
`...(desc ? { description: desc } : {})` **sesenta líneas más abajo, fuera del bloque**. `const` es
de ámbito de bloque, así que **cada línea válida** de un presupuesto lanzaba:

```
ReferenceError: desc is not defined
    at js/quotesView.js   ← dentro del manejador de «Generar presupuesto»
```

**Crear presupuestos dejó de funcionar en `main`.**

## 🔴 Reproducido ANTES de tocar, sobre los bytes de `origin/main`

Se extrajo la región real del payload del `quotesView.js` de main —`git show origin/main:…`, sin una
línea de esta rama— y se **ejecutó** con una línea válida (concepto, cantidad, precio):

```
región extraída de origin/main: 69 líneas
🔴 REVIENTA: ReferenceError: desc is not defined
```

## El arreglo

```js
let desc = '';
try { desc = (…).trim(); if (includeDesc && desc) { … } } catch (_e) {}
```

La declaración sale del bloque **con valor inicial**, para que exista pase lo que pase. El `''` no
es adorno: con él la clave **no viaja** cuando no hay texto, que es exactamente lo que hacía antes
de romperse (ausente ≠ vacío, el criterio de `costeUnitario`).

⛔ El spread **no** se mete dentro del `try`: cambiaría *cuándo* viaja la clave, y eso es otra cosa.
⛔ El `catch` **no** se amplía. No se tragaba el `ReferenceError` —ése nace fuera— pero sí tapaba
cualquier fallo de la lectura, y por eso nadie miró aquí. Un `catch` que se traga más de lo que
vigilaba es cómo esto llegó a main en silencio.

## 🔴 LA LECCIÓN, que es lo que de verdad hay que llevarse

**La tanda de SCRUM-632 salió con 6163 tests en verde, y NINGUNO pasaba por aquí.**

Mis casos miraban el **fuente** —que la clave estuviera escrita, que los sitios de defecto ya no
borraran— o el **PDF ya generado**. Ninguno **ejecutaba la construcción del payload**, que es la
línea que el profesional pulsa. Un guard de texto habría dicho «la clave `description` está ahí»:
y estaba. Lo que no estaba era que se pudiera **llegar** a ella.

Lo encontró el CI de otra rama (scrum-600d), no mi suite. Va escrito en la cabecera del test nuevo
para que quien lo lea entienda por qué existe.

## El control que faltaba

`tests/scrum632c-el-payload-se-construye.test.mjs` **ejecuta** la región real del fichero con una
línea válida, en vez de leerla:

| Control | |
|---|---|
| 🔴 una línea válida **no revienta** y llega al payload | ✅ |
| ✅ con descripción y casilla marcada: viaja en `description` **Y** pegada al `concept` | ✅ |
| con descripción y casilla **sin** marcar: viaja la clave, **no** se pega al papel | ✅ |
| ✅ NEGATIVO: sin descripción la clave **no** viaja (ausente ≠ vacío) | ✅ |
| el respaldo del `dataset` sigue vivo para borradores anteriores al campo | ✅ |

**Probado EN ROJO contra el código de main:** los **cinco** caen con `ReferenceError`. Con el
arreglo, los cinco pasan.

Y el **documento suelto sigue igual**: su camino hace `return` antes y no pasa por esta región —
lo sigue midiendo `scrum632-los-dos-cortes-de-la-linea`, que ya está en main.

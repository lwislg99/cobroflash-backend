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

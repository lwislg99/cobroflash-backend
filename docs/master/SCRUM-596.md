# SCRUM-596 · DOC-06 · La nota interna no sale — y ahora hay PRUEBA de ello

**Fecha:** 5-sep-2026 · **Carril:** documento (prueba, no producto) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `6fa04adc66a95509f52b3b0b38679e19c5b0baa0` · 2026-09-05T18:06:59+01:00

**No entra ni una línea de producto.** Un fichero de tests y esta entrada. No se ha tocado el
esquema, ni `pdf.service.ts`, ni la landing, ni la vista del documento.

---

## PASO −1 · Qué estaba hecho, y qué no

**El campo estaba hecho desde hace tres meses y medio.** `Quote.internalNotes` lo metió `83871c4c`
el **22-may-2026** («notas internas por cotización — autoguardado, privadas, indicador en lista»),
y su comentario en el esquema ya promete lo que DOC-06 pide: *«Notas privadas del profesional,
nunca visibles al cliente»*.

**Lo que NO existía es la PRUEBA**, que es lo que el ticket exige literalmente. Censado el 5-sep:
de los seis ficheros de tests que nombran `internalNotes`, **ninguno** comprueba que no salga en el
PDF ni en la página del cliente. Una promesa escrita en un comentario del esquema es exactamente la
clase de garantía que este árbol no acepta.

### Las TRES notas, que no son la misma y conviene no reutilizar la equivocada

| campo | de quién | dónde se ve | ticket |
|---|---|---|---|
| **`Quote.internalNotes`** | del **presupuesto** | detalle del documento, sección «Notas internas» | **éste** |
| `Customer.notes` | de la **ficha del cliente** | ficha de cliente | — |
| `Job.notes` | del **trabajo** | detalle del Trabajo | SCRUM-427 |

SCRUM-427 dejó escrito que su microcopy es «la MISMA que ya usa Presupuestos, literal». O sea que
el rótulo ya está consolidado y compartido: no hay etiqueta nueva que inventar aquí.

### 🔴 Dónde se decide qué viaja — y las dos superficies NO están igual de protegidas

Esto es lo que cambió el tamaño del ticket, porque la respuesta no es la misma para las dos:

| superficie | cómo queda fuera la nota | qué lo sostiene |
|---|---|---|
| **PDF** | por **CONSTRUCCIÓN** | `ParamsPdfPresupuesto` no declara el campo, y `paramsDePresupuestoParaPdf` (SCRUM-734) es **la lista única**. `Completo<T>` hace que olvidar un campo no compile: lo que no está en el tipo no puede pintarse |
| **LANDING** | por **OMISIÓN** | el dato **SÍ está cargado**. `loadQuote` usa `include`, no `select`, y en Prisma `include` trae **todos los escalares**. Hoy no sale sólo porque nadie escribe la propiedad |

**La landing es el riesgo real y estaba sin vigilar.** `internalNotes` viaja en memoria dentro del
objeto con el que se compone la página del cliente; basta que alguien escriba esa propiedad —o
serialice el objeto entero— para que la nota privada acabe en el navegador del cliente. No hacía
falta un fallo: hacía falta un descuido.

---

## Lo construido · `tests/scrum596-la-nota-interna-no-sale.test.mjs` (11 pruebas)

**Se reutilizan los instrumentos que ya existen** —`_texto-del-pdf.mjs` (SCRUM-659) para leer el
papel y `_solo-codigo.mjs` (SCRUM-696) para mirar código sin comentarios ni cadenas—. Escribir aquí
un segundo lector de PDF habría sido el escalón 4 teniendo el 2 disponible.

| bloque | qué prueba |
|---|---|
| ① la lista única | el proyector **copia lo que debe** (suelo) · la nota **no lo cruza** aunque la fila la traiga · el tipo del PDF **no la declara** · y el detector del tipo **se ve en rojo** contra un fuente sintético |
| ② el papel | el lector **ve un PDF de verdad** (suelo) · **lo que sí debe ver el cliente, sale** (control positivo) · **la nota no está** · y **el rojo provocado**: con el texto metido en un campo que el PDF sí imprime, el detector lo encuentra |
| ③ la página del cliente | el instrumento **ve las lecturas que la landing sí hace** (suelo) · **la landing no lee `internalNotes`** |

**La fila de prueba lleva la nota dentro, como llega de `include`.** Escribirla sin el campo habría
demostrado que un objeto sin nota no imprime la nota, que no es lo que hay que demostrar.

**El texto centinela va sin espacios** (`QA596NOTAINTERNA`): un token con espacios lo puede partir el
salto de línea de `pdfkit`, y una aguja troceada convierte un fallo real en un verde.

### ⛔ Lo que NO se toca, y por qué el detector del tipo se prueba con un fuente sintético

La única forma de ver ese detector en rojo contra el producto sería añadir `internalNotes` a
`pdf.service.ts` — **camino de emisión**, ahí vive `generateInvoicePdf`. No se toca, ni siquiera de
forma efímera. Así que el acotador del tipo se extrajo a una función y se prueba contra dos fuentes
sintéticos (uno que declara el campo y otro que no), más un tercero sin el tipo delante, que tiene
que devolver **ciego** (`null`) y no «no está».

---

## Las mutaciones, y el defecto del meta-guard que salió al declararlas

```
MUTACIONES_QUE_ME_TUMBAN
  ① presupuestoParaPdf.ts   `quoteId: quote.id,` → + `internalNotes: quote.internalNotes,`
                            cae: «LA NOTA INTERNA NO PASA EL PROYECTOR»
  ② quoteDecisionLanding.ts  `q.quoteNumber ?? q.id` → `q.quoteNumber ?? q.internalNotes ?? q.id`
                            cae: «LA LANDING DEL CLIENTE NO LEE LA NOTA INTERNA»
```

Las dos se ejecutaron **a mano antes de declararlas** y cada una tumbó a SU test y sólo a él.
**No se declara una tercera para el PDF**: el meta-guard *aplica* lo que se le declara, así que
declararla sería mandarle mutar el camino de emisión en cada pasada.

Y hay un test que **le pregunta al lector oficial si ve mis declaraciones**
(`mutacionesDeclaradas` de `scripts/meta-guard-mutaciones.mjs`), porque una declaración con forma
propia sale invisible y el meta-guard no lo dice: pasaría por cobertura sin serlo. Comprueba además
que el texto `de` aparece **exactamente una vez** en su fichero — una mutación ambigua muta otra
cosa, o no muta nada y se lee como guard mudo.

### 🔴 EL META-GUARD ME DECLARÓ MUDO, Y TENÍA RAZÓN A MEDIAS — es SCRUM-763 otra vez

Primera tanda del meta-guard, **tres pasadas idénticas**: `vivas 13 · mudas 1`, y la muda era la
mutación ① — la del proyector. **Pero yo la había visto caer a mano.**

La causa es la frontera de SCRUM-763, por tercera vez en el mismo día: **`meta:mutaciones` muta el
fuente `.ts` y no recompila**, y el test del proyector importaba `dist/`. El fuente mutado, el
`dist/` intacto, el test verde — y el veredicto «MUDO» sobre un guard que estaba vivo.

**El arreglo NO fue quitar la mutación** —eso es ensanchar la lista para que pase—, sino hacer que
el guard sea sensible **donde el defecto se escribe**: el test comprueba la regla en las dos capas,
ejecutando `dist/` y leyendo el `.ts`. Si algún día divergen, manda el fuente: es lo que se
despliega.

> 📌 **Y esto es un dato para SCRUM-763, medido aquí:** `tsc` **emite aunque haya error de tipo**
> (`noEmitOnError` desactivado). Comprobado con la mutación ①, que da `error TS2353` y **aun así
> actualiza `dist/`**. O sea que la frontera muerde en las dos direcciones: un `dist/` que no
> refleja el fuente, y un `dist/` que refleja un fuente que no compila.

**Después del arreglo, tres pasadas más: `vivas 14 · mudas 0 · ciegas 0`, salida 0** en las tres, y
el árbol restaurado byte a byte (`Buffer.compare = 0` en los dos ficheros del producto).

---

## Microcopy: **no aplica, y el motivo**

**No se introduce ni un rótulo.** El campo ya existe con su etiqueta —«Notas internas»— y su
marcador de posición, consolidados y compartidos con SCRUM-427. Este ticket añade la prueba de que
lo que se escribe ahí no sale, no una superficie nueva.

Por eso **no hay marcador `[PENDIENTE`, no sube ningún contador y no hay caja que medir a 929 ni a
390 px**. Se dice en vez de dejarlo en blanco: un apartado vacío se lee igual que uno olvidado.

## Documentos emitidos

**Ninguno cambia, y no podía cambiar:** no entra código de producto. El único fichero nuevo es de
tests. Y el campo no llega al PDF ni antes ni después — que es justo lo que estas once pruebas
fijan.

## Estado del árbol

* **Tanda: 5493 tests · 5405 pass · 0 fail · 88 skipped**, medida DESPUÉS del último cambio.
* Los 88 saltados declaran su motivo: 78 por gates de base (`QA_DB_TEST` 76 · `A55_DB_TEST` 1 ·
  `BOT_SUITE_TEST` 1), 9 por `LIBRO_PG_URL` y 1 por `EPERM` de Windows al crear un enlace.
* `meta:mutaciones` en verde, **tres pasadas**, con el árbol restaurado y verificado por bytes.
* Cero CR en disco en el fichero nuevo.

## Los huecos que declaro

1. **La landing se mide por FUENTE, no por ejecución.** `renderQuoteDetail` no está exportada, y
   exportarla sería modificar el producto para poder medirlo. Se observa con AST, que es lo que
   manda en ese caso — pero significa que **si la nota saliera por un camino que no nombra la
   propiedad** (serializar el objeto entero, por ejemplo) este guard no lo vería. **Sigue abierto.**
2. **No se ha abierto un navegador.** Ni la sección de notas del detalle, ni la página del cliente.
3. **Producción: sin medir.** No se puede desde un árbol de trabajo.
4. **El PDF probado es el del PRESUPUESTO.** El de la FACTURA no se ejercita aquí: la nota es de
   `Quote` y el proyector de facturas es otro. No se afirma nada sobre él.

## HALLAZGOS FUERA DE CARRIL

* **`loadQuote` de la landing usa `include` y no `select`**, así que trae escalares que la página no
  necesita —`internalNotes` entre ellos—. No se cambia aquí: tocar esa consulta es del carril de la
  landing y merece su propia medición de qué depende de cada campo.
* **`noEmitOnError` está desactivado** en la configuración de TypeScript. Material para SCRUM-763.

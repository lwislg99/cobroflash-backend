# SCRUM-619 · La marca de suplido se descarta en silencio

**Medido contra:** `origin/main` = `61d35a741e92c0e987d70bc7dba5a0a8302a5630` · 2026-08-24T23:40:00+01:00

> ⚠️ El ancla es el commit contra el que se MIDIÓ —la base de esta rama, merge del PR #852—, no la
> punta de `origin/main` de ahora: entre medias ha avanzado hasta `010c05d3c6066d034fcef831967ffb9a9b14b5ec`.
> Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
>
> ⚠️ **SCRUM-616 no estaba mergeado cuando nació esta rama, y SÍ lo está al cerrarla** (entró en
> `origin/main` mientras se trabajaba). Esta rama NO lo contiene y no depende de él: sale de su
> base y no toca su caracterización. Por eso el recuento de la suite de más abajo es el de ESTA
> base y no incluye los 9 tests de SCRUM-616 — se dice para que nadie compare dos totales que se
> midieron sobre árboles distintos.

**Alcance:** MIDE y PROPONE. No toca el camino de emisión, ni el esquema, ni ningún importe.

---

# 1 · 🔴 PARA EL FUNDADOR Y SU ASESORÍA — el número y la pregunta

*Esta sección se puede leer sin saber programar y sin abrir el código.*

## El caso

Un fontanero hace una factura con dos conceptos:

| concepto | importe | IVA |
|---|---|---|
| Mano de obra | 60,00 € | 21 % |
| Tasa municipal — la paga él al ayuntamiento **por cuenta del cliente** y se la repercute tal cual | 45,00 € | ninguno (es un **suplido**) |

En YaQu marca la segunda línea con la casilla **«Suplido (pagado por cuenta del cliente)»**, cuyo
texto —aprobado— dice que **no lleva IVA ni margen**.

## Lo que produce YaQu hoy

| | |
|---|---|
| Base imponible al 21 % | 60,00 € · cuota 12,60 € |
| Base imponible al 0 % | **45,00 €** · cuota 0,00 € |
| **Base imponible TOTAL** | **105,00 €** |
| Cuota total | 12,60 € |
| **Total de la factura** | **117,60 €** |

> **Los 45 € del suplido están DENTRO de la base imponible, declarados como una base al 0 % de IVA.**

## La pregunta

> **¿Debe el importe de un suplido figurar dentro de la base imponible de la factura —como una
> base al 0 %, que es lo que YaQu hace hoy— o debe quedar FUERA de la base imponible y sumarse
> aparte al total?**

## Dos datos que acotan la pregunta, y que NO son interpretación

**① El cliente paga lo mismo en los dos casos.** Es aritmética, no criterio:

| | hoy (dentro de la base) | fuera de la base |
|---|---|---|
| base imponible | 105,00 € | 60,00 € |
| cuota de IVA | 12,60 € | 12,60 € |
| suplido | *(incluido arriba)* | 45,00 € |
| **total** | **117,60 €** | **117,60 €** |

Lo que cambia **no es lo que se cobra**: es **lo que la factura declara como base imponible** — y
eso es lo que va al desglose del documento, al modelo 303 y al registro de facturación.

**② El producto ya tiene escrito el cálculo alternativo, pero no lo usa.** Existe
`src/modules/invoicing/domain/suplidos.ts` —un módulo que saca los suplidos de la base y los suma
al total— y **no lo llama nadie**. Está registrado como motor sin cable desde SCRUM-411, esperando
una decisión. O sea: la pregunta ya se intuyó antes; lo que faltaba era ponerle un número delante.

## ⛔ Lo que esta sesión NO contesta

**Si eso está bien o mal.** Es interpretación fiscal y no le corresponde ni a esta sesión ni al
encargo. Aquí sólo se deja el caso, el número y la pregunta para que puedan ponerse delante de un
asesor.

---

# 2 · Dónde se cae exactamente, y qué cuesta conservarla

## Se cae en UN sitio, y está localizado

`src/modules/invoicing/domain/facturaSuelta.ts:135` — el validador de la **factura suelta** (camino
C7). Reconstruye cada línea con cuatro claves fijas: `{concept, qty, price, tax}`. Todo lo demás se
pierde ahí.

**No es un problema general del producto: es de esa puerta.** Medido, los demás caminos de
presupuesto → factura **conservan** la marca:

| camino | qué hace con las líneas | ¿conserva? |
|---|---|---|
| **C7 · factura suelta** (`facturaSuelta.ts:135`) | reconstruye con 4 claves | 🔴 **NO** |
| factura desde cobro/presupuesto (`lib/invoicing.ts`) | pasa `quote.lines` tal cual | ✅ sí |
| factura por tramos (`jobs.routes.ts` → `stageLines`) | `{ ...l, price: … }` | ✅ sí |
| rectificativa (`invoicesAdmin.routes.ts`) | `{ ...l, price: -l.price }` | ✅ sí |
| cualquier camino vía **albarán** | otro vocabulario (`concepto`, `cantidad`, `precioUnitario`) | — la marca **nunca existió** ahí |

La última fila importa: `suplido` aparece en `src/` **sólo** en `core/validation/schemas.ts` y en
`invoicing/domain/suplidos.ts`. En todo `src/modules/jobs/` no aparece ni una vez, así que en los
caminos por albarán no se pierde nada — no llegó nunca.

## ¿Hace falta esquema? **NO.** Y mi «puede tocar schema» de SCRUM-616 queda refutado

`Invoice.lines` está declarado **`Json?`** en `prisma/schema.prisma` (y `Quote.lines`, `Json`).
Añadir una clave dentro de ese JSON **no necesita migración, ni columna, ni `db push`**. El «puede»
estaba bien puesto como cautela; medido, la respuesta es que no.

## ¿Hay una salida más barata que tocar el camino de emisión? **No la hay**

* **Aguas arriba** no hay nada que hacer: el front YA manda la marca (`lineaParaPayload`).
* **Aguas abajo** es almacenamiento: cuando la línea llega ahí, la clave ya se ha caído.
* El estrechamiento está **exactamente** en el validador que alimenta `emitInvoice`. Tocarlo es
  tocar el camino de emisión (reglas 29/38) → **STOP**.
* Se consideró y se **descarta** codificar la marca dentro del texto del concepto (un prefijo):
  cambiaría el texto impreso del documento —microcopy, regla 30— y guardaría un dato disfrazado de
  otra cosa, que es peor que no guardarlo.

**Conclusión: una línea de código, cero esquema, pero dentro del camino de emisión.**

---

# 3 · ¿Es `suplido` el único? — la respuesta, y el mecanismo

## Los dos vocabularios de una línea

Medidos, y por vías distintas a propósito (cada una es la que dice la verdad en su lado):

| puerta | vocabulario | cómo se mide |
|---|---|---|
| presupuesto (`QuoteLineSchema`) | `concept, price, qty, suplido, tax` | **declarado**: se lee el `shape` del esquema |
| factura suelta (`validarFacturaSuelta`) | `concept, price, qty, tax` | **comportamiento**: emite un literal fijo, así que lo que sale ES lo declarado |
| **divergencia** | **`suplido`** | | |

**Hoy la divergencia es exactamente una.** Pero la pregunta del ticket no era cuántas hay: era
cuántas pueden caerse mañana.

## 🔴 El hallazgo que ordena el ticket: este fallo YA se arregló en la otra puerta

`QuoteLineSchema` declara `suplido` **a propósito**, con el motivo escrito al lado (SCRUM-500):

> «Sin declararla aquí, `z.object` la BORRA en silencio —zod quita las claves que no conoce— y la
> casilla del editor no llegaría nunca a `Quote.lines`.»

Alguien encontró **este mismo defecto** en la puerta del presupuesto, lo arregló y dejó dicho por
qué. A la puerta de la factura **nadie se lo contó**. No es un descuido nuevo: es el mismo, dos
veces, porque las dos listas de claves se mantienen **a mano y por separado**.

Por eso lo que entrega este ticket no es documentar la divergencia de hoy —eso ya lo hace
SCRUM-616— sino un **trinquete**: el día que alguien añada una clave al vocabulario del
presupuesto, `tests/scrum619-vocabulario-de-linea.test.mjs` cae y le obliga a **decidir qué hace la
factura con ella**. Es la pregunta directa del alcance —«¿alguna está a punto de añadirse por los
tickets del bloque 2?»— convertida en mecanismo: **descuentos (594), etiquetas (595) y nota interna
(596) lo dispararán en cuanto toquen la línea.**

Divergencia imposible sería mejor que divergencia vigilada, pero hacerla imposible es unificar las
dos listas — y eso es tocar el camino de emisión.

## El censo de estrechamientos

**12 sitios en 10 ficheros** reconstruyen una línea con la firma exacta `{concept, price, qty,
tax}`, sobre 244 ficheros `.ts` y 29 literales con forma de línea. Fijado **por fichero**, no por
número de línea (lección de SCRUM-600: un guard que cae porque alguien añadió un comentario lo
apaga el siguiente que pase).

De los 12, **uno solo estrecha una línea que puede traer la marca** (`facturaSuelta.ts`). Los otros
once **fabrican** líneas nuevas (la línea de un producto, la negativa de un anticipo, la propuesta
de la IA, los *fallback* cuando no hay líneas) o vienen del vocabulario del albarán.

**El censo distingue `...spread` de literal fijo, y esa distinción es media medición:** la
rectificativa hace `{ ...l, price: -l.price }` y conserva todo. Contarla como estrechamiento habría
inflado el número y mandado a alguien a «arreglar» un sitio que ya estaba bien.

## ⚠️ Límite declarado del censo

Se ancla en la clave `concept`, así que **no ve** el vocabulario español del albarán (`concepto`,
`cantidad`, `precioUnitario`, `tipoIva`). Para *este* ticket da igual —`suplido` no existe en
`src/modules/jobs/`, medido— pero si algún día la marca llegara al albarán, este censo **no** lo
vería. Queda dicho en vez de descubrirse tarde.

---

# 4 · La propuesta, con su coste separado

## ⬜ P1 · Conservar la marca — **una línea, cero esquema** *(STOP: camino de emisión)*

Declarar `suplido` en la salida de `validarFacturaSuelta`, igual que `QuoteLineSchema` lo declara
en la suya. Sin migración, sin columna, sin `db push`.

**El diff NO se ha preparado ni aplicado**, y el motivo es que el propio encargo lo prohíbe: «si la
única salida es tocarlo, eso es un hallazgo para el informe, no un permiso». Necesita GO explícito
del fundador.

**🔴 Y hay que decir esto antes de que nadie lo apruebe pensando que arregla algo visible: hoy no
cambiaría ninguna salida del producto.** `suplidos.ts` —el módulo que sacaría los suplidos de la
base— **no lo llama nadie** (motor sin cable declarado en SCRUM-411). P1 deja de **perder** el dato;
no lo **usa**. Es el paso barato y reversible que hay que dar *antes* de decidir la pregunta fiscal,
no en vez de decidirla.

## ⬜ P2 · Que el suplido se VEA — depende de la respuesta de la asesoría

Cablear `desgloseConSuplidos` al documento, al desglose y al registro. **Cambia lo que se sella**
(regla 38) y **depende enteramente de la pregunta de la sección 1**: si la asesoría dice que el
suplido va fuera de la base imponible, cambia la base declarada de cada factura con suplidos.

**No se estima aquí**: estimar el coste de construir algo cuya forma depende de una decisión que no
está tomada es inventarse el alcance.

## ⬜ P3 · Que las dos listas no puedan divergir

Derivar el vocabulario de la factura del del presupuesto, en vez de mantener dos listas a mano.
Divergencia **imposible** en vez de vigilada. Es lo correcto a largo plazo y **también** toca el
camino de emisión; el trinquete de este ticket es lo que sostiene la situación mientras tanto.

---

## 5 · Verificación

**Commit de partida:** `4d1c1e19ffad69a4d2e9d833845ad652d8b0a323`. Inyecciones con bytes de disco y
reversión comprobada con `Buffer.compare` (SCRUM-570). Árbol limpio tras cada una.

| control | inyección | resultado |
|---|---|---|
| 🔴 SUELO del punto 3 | añadir `descuentoPct` a `QuoteLineSchema` | **fail=2**, nombrando la clave nueva |
| 🔴 censo | un sitio nuevo con la firma de 4 claves | **fail=1**, nombrando el fichero |
| ✅ POSITIVO | — | los importes **no cambian**: total `45,00` con marca y sin ella |

### 🔴 El suelo cazó un agujero en mi propio instrumento, y merece quedar escrito

La primera versión medía el vocabulario del presupuesto **por comportamiento**: metía una línea de
prueba, la parseaba y miraba qué claves salían. Al inyectar `descuentoPct` —la calibración
obligatoria— **el trinquete no cayó**: zod no inventa las claves opcionales que no vienen en la
entrada, así que `Object.keys(salida)` sólo enseñaba lo que traía *mi sonda*. **Estaba midiendo mi
sonda, no el esquema.**

Y fallaba justo donde apunta el ticket: una clave nueva del bloque 2 habría entrado sin que nada se
enterase — el suceso exacto que el trinquete existe para cazar. Un instrumento ciego para su propio
caso de uso. Ahora se lee el `shape` del esquema, con su suelo: si zod cambia de forma interna, se
declara **ciego** en vez de devolver un conjunto vacío que se leería como «el presupuesto no acepta
ninguna clave».

Sin la calibración que exigía el encargo, esto habría entrado en verde.

## Tests que introduce esta entrada

* `tests/scrum619-vocabulario-de-linea.test.mjs` — los dos vocabularios, el trinquete, el censo de
  estrechamientos y el control de importes.

# SCRUM-602 · DOC-12 · Dirección de la obra por documento

**Fecha:** 4-sep-2026 · **Carril:** documentos · **Gate:** todo en `npm test`; sin gates de BD

**Medido contra:** `origin/main` = `da5af22e347bbdfa3e57e1e658676e1cbd9bf310` · 2026-09-04T16:35:00Z

**Tanda:** 5209 tests, 5120 pass, **1 fail**, 88 skipped — medida DESPUES del ultimo cambio,
entrada incluida. El fallo **no es de este ticket** y esta demostrado abajo, en «El rojo ajeno».

---

## La víctima

Un fontanero trabaja en una nave del polígono y factura a la gestoría del dueño, que está en otra
provincia. Hasta hoy el presupuesto sólo sabía nombrar a **quien paga**: no había ningún sitio
donde decir **dónde se hace el trabajo**. El profesional lo resolvía metiéndolo en el concepto de
una línea, o no lo decía y lo hablaba por teléfono.

---

## PASO 0

### ENTRADA

El editor de presupuesto (`public/dashboard/js/quotesView.js`) tiene cuatro bloques: `1. Cliente`,
`2. Líneas`, `3. Condiciones` y `4. Envío`.

🔴 **`4. Envío` ya existe y NO es esto**: significa el envío del **documento** por WhatsApp o
correo. Ése fue el hallazgo que decidió el rótulo y la colocación: el control va en `1. Cliente`,
junto a los datos con los que sale impreso.

### MECANISMO — 🔴 ya existía, y redefinió el ticket

| pieza | qué había ya |
|---|---|
| `Albaran.lugarEntrega` (SCRUM-300, C5) | **el ticket entero, para el albarán**: campo propio, normalizador, edición y entrada en el hash del sobre v:2 — 164 menciones en el árbol |
| `Customer.billing*` (SCRUM-579, CONT-06) | las cinco columnas de la dirección de facturación, ya en el `select` compartido |
| `normalizarLugarEntrega` | la regla de «vacío se queda vacío», escrita y probada |

**Así que no eran tres vistas: eran dos.** El albarán está hecho, y es **el patrón que se copia**,
suelo incluido. El comentario de su schema dice lo mismo que este ticket: *«el lugar del trabajo
puede no ser el domicilio de quien paga»*.

### El suelo, adoptado literal (asesor, 4-sep-2026)

> «si no hay dirección de obra se deja VACÍO; la sugerencia entra sólo como PLACEHOLDER, porque
> una dirección equivocada en un documento de entrega es peor que ninguna.»

De ahí sale la regla que más se vigila en este ticket: **«Personalizada» nunca se prerrellena con
la de facturación**. Se sugiere en el `placeholder` y decide el profesional. Una dirección
prerrellenada se firma sin leerla.

---

## Lo que se construye

| fichero | qué hace |
|---|---|
| `src/core/documentos/direccionObra.ts` | **UN solo resolvedor**: los tres modos, los normalizadores y la composición de la dirección de facturación |
| `public/dashboard/js/quoteDireccionObra.js` | la pieza pura del navegador: modos, los cuatro textos, `SIN_APROBAR`, el placeholder y lo que viaja |
| `prisma/schema.prisma` | `quotes` e `invoices` · `shipping_address` + `shipping_address_mode` |
| `src/core/validation/schemas.ts` | los dos campos, con el `enum` **derivado** de `MODOS_DIRECCION_OBRA` |
| `src/modules/quotes/app/routes/quotes.routes.ts` | guarda los dos campos normalizados y los pasa al PDF |
| `src/modules/system/app/routes/quotesAdmin.routes.ts` | la tercera puerta del PDF |
| `src/modules/invoicing/infra/pdf/pdf.service.ts` | el bloque del papel, resuelto **dentro del documento** |
| `src/modules/quotes/domain/revision.ts` | los dos campos, clasificados: **HEREDAN** |
| `public/dashboard/css/styles.css` | `.quote-direccion-obra` y su regla `[hidden]` |

### Dos columnas y no una

Tres opciones no se derivan de un campo de texto: «utilizar la de facturación» **no tiene dato
propio** y «no mostrar» tampoco. Con una sola columna, «vacío» tendría que significar las dos
cosas a la vez. El albarán usa un campo único porque allí el modo es implícito: sólo existe el
equivalente de «personalizada».

### Los datos llegan al documento; la DECISIÓN no

Las tres puertas del PDF (crear · regenerar con firma · `GET /admin/quotes/:id/pdf`) pasan modo,
texto y cliente **en crudo**, y `generateQuotePdf` llama a `resolverDireccionObra` una vez. El
motivo está medido en ese mismo fichero: `discountGlobalAmount` se pasa en **dos de las tres**
puertas y no en la tercera. Con la decisión dentro del documento, olvidarse de un dato deja el
bloque **fuera** —el suelo— en vez de imprimir una dirección distinta según por dónde se pida.

---

## 🔴 Los dos defectos que este ticket encontró **en sí mismo**

### ① El `...spread` que dejaba ciego al guard

El payload del front se escribió primero con `...window.quoteDireccionObra.direccionParaPayload(…)`.
**La tanda entera siguió verde**, incluido el censo de SCRUM-286, que existe justamente para cazar
«un campo nuevo que nadie coloca»: ese censo deriva lo que viaja de las **propiedades** del object
literal, y un spread no tiene propiedades que leer.

Con las dos claves escritas a mano el censo se puso **rojo en el acto**. Un campo nuevo nace **sin
registrar**, y ése es exactamente el momento en que el fallo es mudo.

### ② `hidden` no apagaba nada

`.field` declara `display: flex`, y una regla de **autor** gana a la del navegador para `[hidden]`.
Medido en navegador real con control positivo: un `<div>` pelado con `hidden` da `display: none`; el
campo libre daba `flex`. Se apaga con `.quote-direccion-obra[hidden]`, en el CSS y no con
`style.display`, para que quien lea el HTML entienda por qué un elemento con `hidden` no se ve.

⚠️ **Y el mismo defecto está VIVO en `main`**, fuera de este carril: `.quote-dto-global__campo`
(SCRUM-594) también declara `display: flex`, así que su `campo.hidden = true` no oculta nada y el
botón «+ Añadir descuento» convive con el campo abierto. Medido en la misma pasada. **No se toca
aquí** (regla 9): va reportado.

---

## Las mediciones del navegador

Edge real, CSS de producción, la cabecera reproducida.

| viewport | ancho útil del bloque | alto del `<select>` |
|---|---|---|
| **929 px** | 879 px | **44,5 px** |
| **390 px** | 364 px | **44,5 px** |

| texto | ancho |
|---|---|
| `No mostrar` | 75,3 px |
| `Personalizada` | 90,3 px |
| `Dirección de la obra` | 132,7 px |
| `Utilizar dirección de facturación` | **208,7 px** |

**El control cumple AB6 sin tocar nada: 44,5 px ≥ 44.** La FASE A había declarado 43 px como hueco
y **ese número era mío y estaba mal**: la maqueta de aquella medición no llevaba el `line-height`
del `.field` real. No hay `min-height` que añadir; añadirlo sería un cambio que nadie necesita.

**Y el ancho útil de la FASE A también se corrige: dije 681 px a 929, y son 879.** El motivo está
medido: `.quotes-layout` pasa a UNA columna por debajo de 1100 px (`styles.css:1264`), y mi maqueta
de la FASE A reproducía las dos columnas. La conclusión no cambia —el más largo cabe con holgura en
los dos anchos, y la página no hace scroll horizontal en ninguno—, pero el número sí.

---

## Microcopy

**Aprobados por el ASESOR** el 4-sep-2026, **provisionales a la espera de la firma del FUNDADOR**
(regla 30). No van a `docs/microcopy/`, que es el registro del fundador.

| Ranura | Texto aprobado |
|---|---|
| `quoteDireccionObra.TEXTOS.rotulo` | Dirección de la obra |
| `quoteDireccionObra.TEXTOS.noMostrar` | No mostrar |
| `quoteDireccionObra.TEXTOS.facturacion` | Utilizar dirección de facturación |
| `quoteDireccionObra.TEXTOS.personalizada` | Personalizada |

**SIN MARCADOR en pantalla**, mismo criterio que `filtroClientes.js` (2-sep-2026) y que los tres
rótulos de SCRUM-599. Quien lleva la cuenta de lo que falta firmar es `SIN_APROBAR = 4`, declarado
en las **dos** piezas y atado por un test.

⚠️ **El rótulo se imprime también en el PDF**, o sea que lo lee el **cliente final**, no sólo el
profesional. Cuenta como UNA ranura porque es un solo texto —un test ata por identidad el del
front y el `ROTULO_DIRECCION_OBRA_PDF` del dominio—, pero el fundador debe firmarlo sabiendo que
sale en papel.

**No es «Dirección de envío»**, que era la palabra del encargo: el editor ya tiene un bloque
`4. Envío` que significa otra cosa.

---

## La FACTURA no se cablea, y por qué

La decisión del asesor es **copiar el texto al emitir**, y se acata. Lo que la bloquea hoy es una
medición, no una discrepancia:

- El escritor tendría que ir en **`emitInvoice`** (`invoicing.service.ts:78`), que es el camino de
  emisión compartido por cuatro llamadores, **o** en los otros **seis** `tx.invoice.create` del
  árbol. **Modificar el camino de emisión es STOP del fundador** (CLAUDE.md, AA1.4).
- Añadir el bloque al PDF de la factura es el caso que **SCRUM-593 ya se negó a hacer** y aparcó
  como SCRUM-665: `ensureInvoicePdf` regenera el PDF con el código de hoy, y un bloque nuevo
  cambiaría el aspecto de facturas **ya emitidas** (regla 29).

**Las dos columnas de `invoices` entran igual**, porque el DDL de las cuatro se firmó junto y ya
está aplicado en desarrollo. Quedan declaradas en el schema como destino pendiente.

**MEDIDO, para que nadie tenga que suponerlo:** la huella de VeriFactu es una lista **cerrada** de
ocho campos (`computeVeriFactuHash`: NIF, serie, fecha, tipo, cuota, importe, huella anterior y
timestamp). **Ninguna columna nueva entra en el sello.**

---

## Vivo o congelado

| documento | qué hace | por qué |
|---|---|---|
| **Presupuesto** | lee el cliente **EN VIVO** | es una oferta viva, y es lo que el producto ya hace con su nombre y su NIF |
| **Factura** | **copiará el texto al emitir** | regla 29, con el precedente de `Albaran.lugarEntrega`, que queda fijo por el sello |

Que el nombre y el NIF de una factura emitida se sigan leyendo en vivo (`invoicing.ts:115`,
`quotes.routes.ts:253`) es **deuda vieja**, no de este ticket: es SCRUM-729. **No se introduce
deuda nueva para ser coherente con la vieja** — el campo nuevo nace bien.

---

## El DDL

```sql
ALTER TABLE "quotes"   ADD COLUMN "shipping_address" TEXT, ADD COLUMN "shipping_address_mode" TEXT;
ALTER TABLE "invoices" ADD COLUMN "shipping_address" TEXT, ADD COLUMN "shipping_address_mode" TEXT;
```

Aditivo puro (`sentenciasDestructivas` → `[]`), generado con `prisma migrate diff` sobre el schema
viejo. Recuento **antes**: `quotes` 40 · `invoices` 33. **Después**: 42 y 35.

**Aplicado SÓLO en `yaqu_dev_javier`**, verificado por catálogo: las cuatro son `text` y nullable.
**Staging y producción, NO**: los aplica el fundador. `constancia-del-alter` dará rojo mientras
falten, y eso es el guard funcionando.

---

## Tests

- `tests/scrum602-direccion-obra.test.mjs` — los 22: suelo, los tres modos, el suelo del albarán,
  las dos copias comparadas caso por caso, las tres puertas, el papel, el microcopy y el `hidden`.
- `tests/scrum286-bloques-orden.test.mjs` — los dos campos nuevos, registrados en su bloque.
- `tests/scrum655b-revision-con-llamador.test.mjs` — los dos campos, clasificados como heredados.
- `tests/scrum697-un-solo-render.test.mjs` y `tests/scrum698-vistas-que-no-se-miden.test.mjs` —
  242 → **250**, los ocho nodos del control **aislados por identidad**: se toman los dos subárboles
  y la vista sin ellos vuelve a dar 242 exactas. No se restó a ojo.

**Probados en ROJO por mutación**, ocho defectos inyectados y cada uno cae por su test: la
«Personalizada» que se cae a la fiscal · el dominio componiendo con otro separador · una de las
tres puertas sin `direccionObra` · el rótulo volviendo a «envío» · la regla `[hidden]` borrada · el
payload volviendo al spread · el PDF pintando siempre · la ruta guardando el modo sin normalizar.
Control negativo: sin mutar, cero rojos; tras restaurar, cero rojos.

---

## El rojo ajeno

`SCRUM-176b · LAS EXENTAS SON EXACTAMENTE ÉSTAS` falla en este árbol, y **no es de este ticket**:
llega con el merge de `main` (commit `e16815eb`) y el fichero no se ha tocado aquí.

Construye la ruta con `new URL(import.meta.url).pathname`, que devuelve la ruta
**porcentual-codificada**. Medido con control:

| ruta real | lo que calcula SCRUM-176b |
|---|---|
| `C:\Users\Javier Pereira\repo\tests\x.mjs` | `C:\Users\Javier%20Pereira\repo\…` 🔴 |
| `C:\repo-sin-espacios\tests\x.mjs` | `C:\repo-sin-espacios\tests\x.mjs` ✔ |

O sea: **rojo en cualquier checkout cuya ruta lleve un espacio, y verde en CI.** Se arregla con
`fileURLToPath`. Va reportado, no arreglado (regla 9).

---

## Huecos declarados

- **No he medido cuánto ocupa el bloque en el PAPEL** ni si empuja algo hacia abajo en un
  presupuesto largo. El texto va en una línea de `doc.text` sin ancho fijo.
- **No hay edición**: el presupuesto no tiene ruta de actualización (sólo `PUT /:id/notes`), así
  que la dirección se decide **al crear** y no se puede cambiar después. Es el comportamiento de
  todos los demás campos del documento, no una limitación nueva.
- **El borrador de `localStorage` no la guarda**: cerrar la pestaña a medias pierde la dirección
  como pierde el resto de lo no guardado.
- **La factura queda sin escritor** (arriba, con su motivo).

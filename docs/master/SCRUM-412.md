# SCRUM-412 · ninguna acción primaria de pantalla puede ser `btn-sm`

**Fecha:** 10-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `def1d7ae7a4490dcffa87bd1c0233e814d827e4b` · 2026-08-10T12:22:39+02:00

## De dónde viene

SCRUM-380 arregló el CTA del Trabajo y dejó **12 usos más** de `btn-primary btn-sm` censados. Su
guard los **declaraba sin prohibirlos**, a propósito: un guard no distingue una primaria de
pantalla de una acción de fila, y convertirlo en prohibición entonces habría puesto once pantallas
en rojo de golpe — un rediseño encubierto (Parte AB).

Aquí se cierra, clasificando las doce **una por una** con el criterio del fundador: *es primaria si
es la acción que la pantalla existe para que hagas; si al quitarla la pantalla sigue teniendo
sentido, no lo es*.

## Las DOS que eran primaria (pierden el `btn-sm`)

| Sitio | Por qué | Cómo se decidió |
| --- | --- | --- |
| `invoiceDetailView.js` · `btnBizum` | Confirmar el cobro es lo que la ficha de una factura `pending` existe para que hagas | **No es mi criterio: `invoiceActionsRegistry` lo declara `primaria` en `pending`** |
| `invoicesView.js` · `nuevaFacturaBtn` | Crear el documento es la acción de cabecera del listado | criterio del fundador |

## Las DIEZ que se quedan, con su motivo

Fila o modal, y por eso 30 px es correcto: no son la acción de la pantalla, y hay tantas como
filas. Cada una está declarada en el guard con su razón — `btnPdf`, `consolidaConfirm`, `goM`,
`bz`, `save`, `btnQuote`, `btnGuardar`, `btnApprove`, `btnUse` y `okBtn`.

**Dos merecen mención aparte:**

* **`invoiceDetailView.js · btnPdf`** — el registro de C2 lo declara `secundaria` en los CUATRO
  estados, pero está pintado con `btn-primary`. **La clase contradice al registro.** Es un hallazgo
  y no se arregla aquí para no mezclar dos cosas en un ticket.
* **`signaturePad.js · okBtn`** — declarado con DUDA, y se dice en vez de decidirlo solo: es un
  modal, pero **lo pulsa el CLIENTE en una obra** y es el momento más irrepetible del producto
  (SCRUM-404). Si el fundador decide que un modal así cuenta como primaria, sale de la lista.

## El guard pasa de declarar a PROHIBIR

`tests/scrum412-primaria-nunca-es-sm.test.mjs` — 5 tests. La regla es **«ninguna acción primaria de
pantalla puede ser `btn-sm`»**, no «no existe `btn-sm`». Como el guard no sabe distinguirlas, lo que
exige es que cada una esté **clasificada por una persona**: si aparece una sin declarar, el rojo
pide esa decisión, no un cambio de tamaño.

Con trinquete en las **dos direcciones** — probado en rojo:

| Inyección | Resultado |
| --- | --- |
| aparece un `btn-primary btn-sm` sin declarar | exit 1 · lo nombra (`nuevoBtn`) |
| una declaración se queda sin botón (fantasma) | exit 1 · «ya no corresponden a ningún botón: `templatesView.js:btnUse`» |

La segunda importa tanto como la primera: una lista que deja de describir el código es una lista de
la que el siguiente se fía sin motivo.

**El censo se ancla a `fichero:variable`, no a la línea** — un censo anclado a líneas caduca al
primer commit y obliga a reeditarlo por nada.

## ⚠️ SCRUM-352 intacto

`btn-sm` sigue midiendo 30 px y su control negativo sigue verde. Hay un test aquí que lo comprueba
también, para que el atajo por CSS caiga en los dos sitios: **lo que se prohíbe no es el tamaño
pequeño, es que la acción principal lo lleve.**

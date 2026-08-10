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

## Las TRES que eran primaria (pierden el `btn-sm`)

| Sitio | Por qué | Cómo se decidió |
| --- | --- | --- |
| `invoiceDetailView.js` · `btnBizum` | Confirmar el cobro es lo que la ficha de una factura `pending` existe para que hagas | **No es mi criterio: `invoiceActionsRegistry` lo declara `primaria` en `pending`** |
| `invoicesView.js` · `nuevaFacturaBtn` | Crear el documento es la acción de cabecera del listado | criterio del fundador |
| `signaturePad.js` · `okBtn` | **Ese modal existe PARA UNA SOLA COSA**, así que el criterio se le aplica igual que a una pantalla | decisión del fundador (ver abajo) |

### `okBtn`: declarado con DUDA, decidido por el fundador

Se declaró **con duda y sin resolverla en la rama**: por estructura es un modal, pero **lo pulsa el
CLIENTE en una obra** y es el momento más irrepetible del producto — SCRUM-404 midió lo que cuesta
fallarlo: **pedirle a una persona que firme otra vez, delante del profesional.**

El fundador lo resolvió con su propio criterio: *«es primaria si es la acción que la pantalla existe
para que hagas»* — y ese modal existe para una sola cosa. Sale de la lista y pierde el `btn-sm`.

> Que se declarara con duda en vez de decidirlo la sesión es lo correcto: **un criterio que se
> estira para que quepa el caso incómodo deja de ser criterio.**

## Las NUEVE que se quedan, con su motivo

Fila o modal, y por eso 30 px es correcto: no son la acción de la pantalla, y hay tantas como
filas. Cada una está declarada en el guard con su razón — `btnPdf`, `consolidaConfirm`, `goM`,
`bz`, `save`, `btnQuote`, `btnGuardar`, `btnApprove` y `btnUse`.

**Una merece mención aparte:**

* **`invoiceDetailView.js · btnPdf`** — el registro de C2 lo declara `secundaria` en los CUATRO
  estados, pero está pintado con `btn-primary`. **La clase contradice al registro.** No es tamaño
  táctil: es otra familia —el registro y la pintura discrepando—. **Ticket aparte** (lo abre el
  fundador en Jira); aquí no se toca, para no mezclar dos cosas en uno.

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
| se le devuelve el `btn-sm` al botón de firmar | exit 1 · **dos** tests, uno lo nombra: «el botón de firmar vuelve a ser `btn-sm`: lo pulsa el cliente en una obra y no hay segunda toma» |

> El tercer rojo salió **verde en falso** la primera vez: el `\s` y el `\.` de la expresión se
> comieron al escribirla desde la shell y quedó `okBtn.classNames*=s*`, que no casa con nada. Lo
> detectó la propia inyección —el fallo estaba puesto y el test pasaba—, no una revisión posterior.
> **El instrumento vuelve a fallar antes que lo medido**; por eso el rojo se inyecta siempre, también
> cuando la aserción «obviamente» funciona.

La segunda importa tanto como la primera: una lista que deja de describir el código es una lista de
la que el siguiente se fía sin motivo.

**El censo se ancla a `fichero:variable`, no a la línea** — un censo anclado a líneas caduca al
primer commit y obliga a reeditarlo por nada.

## ⚠️ SCRUM-352 intacto

`btn-sm` sigue midiendo 30 px y su control negativo sigue verde. Hay un test aquí que lo comprueba
también, para que el atajo por CSS caiga en los dos sitios: **lo que se prohíbe no es el tamaño
pequeño, es que la acción principal lo lleve.**

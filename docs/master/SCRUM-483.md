# SCRUM-483 · los rótulos aprobados dejan de esperar

**Fecha:** 12-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `db820c35fffa526187057330457593e8b5315aeb` · 2026-08-12T05:10:00+02:00

**Fuente:** `SCRUM-277` en Jira, sección «Rótulos · ESTADO CERRADO DE LA APROBACIÓN». Leída ahí, no
en una copia — 33 aprobados, 2 vetados.

## A1 · `Numeración` fuera, y su ajuste MUDADO

El veto se apoyaba en «detrás no hay habitación». La medición dijo que **no era cierto**:
`invoiceSeriesPrefix` vivía dentro y está en uso. Retirar el contenedor sin mudar el contenido
habría dejado el prefijo de serie sin sitio donde pintarse — **una pérdida de función disfrazada de
limpieza de rótulos, invisible para los guards**, que vigilan el marcador y no la ruta.

`Cumplimiento` **no se tocó**: veto SUSPENDIDO, no retirado. Contiene `modoEmision`, intocable
hasta que se conteste lo de VeriFactu, y desmontar el contenedor de un ajuste intocable es tocarlo.

### Y los dos rojos que atribuimos a `cumplimiento` eran de `facturacion`

Los causó la propia mudanza: su declaración de hueco decía que el prefijo «va a Numeración», y al
mudarlo aquí **esa declaración se volvió falsa**. La zona sensible no había que tocarla.

### El guard aprende a distinguir «vacía» de «borrada»

Al salir el último hueco, el guard de SCRUM-284 se declaró **ciego**: coge el primer elemento de
`VACIOS_DECLARADOS` para montar su caso y se quedó sin caso. **No se apagó.**

| Estado de la lista | Qué hace |
| --- | --- |
| con elementos | el caso de siempre, sin cambios |
| vacía **con** declaración escrita | estado terminal legítimo: pasa y lo dice |
| vacía **sin** declaración | 🔴 rojo |

La declaración **nombra los dos que salieron y por qué**, no dice «vacía a propósito»: así no sirve
para tapar un borrado. Rojo obligatorio probado.

## A2 · tres rótulos encendidos, dieciocho intactos

Se extraen **dos clases** de `NF_PENDIENTE` —títulos de bloque y acción primaria— y se encienden
los aprobados que existen como superficie en esta modal:

| Superficie | Texto |
| --- | --- |
| `labCliente` | `Cliente` |
| `labLineas` | `Líneas` |
| `emitir` | `Emitir factura` |

⚠️ **`Tipo de factura`, `Fechas` y `Datos fiscales` NO se encendieron: no existen como superficie
en esta modal.** Están en el diseño de B3, no en el código. Encenderlos habría exigido inventarlos.

⚠️ **`emitir.textContent = NF_PENDIENTE` aparece DOS veces** y solo una es el rótulo: la otra es el
estado «enviando…», que se restaura al terminar. Encenderla habría dejado el botón diciendo
«Emitir factura» mientras envía. El ancla se desambiguó por sangría.

**Las otras cinco clases NO se parten.** Sus dieciocho textos no están aprobados: se quedan con el
marcador y se partirán el día que se aprueben, partiendo y rellenando en el mismo commit. Cinco
constantes vacías esperando no protegen de nada.

### El guard NO se relajó, y está probado

`scrum289b` ya tenía lista `APROBADOS`: los tres entran ahí **con la fecha y la fuente**. Rojo
probado: un `'Cancelar'` plausible y sin aprobar **sigue cayendo**, nombrándolo.

## Trinquete POR FICHERO

| Fichero | Retirado | Mudado | Sustituido |
| --- | --- | --- | --- |
| `settingsSubmenus.js` | 1 (`Numeración`) | 1 (`invoiceSeriesPrefix`) | 0 |
| `nuevaFacturaModal.js` | 0 | 0 | **3** |

`NF_PENDIENTE` baja de 26 a 23 **contando sin comentarios**. Con comentarios la bajada sale de 2:
el propio comentario que explica el cambio menciona la constante. **La comprobación que exigía
bajar exactamente 3 lo cazó** — auto-referencia, esta vez dentro del contador.

## Censo AST · quién consume `MICROCOPY_PENDIENTE`

**8 ficheros**, y por eso no se toca a la ligera:

* `albaranDetailView.js` — **8 usos**, el consumidor principal
* `invoiceActionsRegistry.js` · `invoiceDetailView.js` · `jobDetailView.js` — la reexportan o la
  leen de `window`
* `tests/scrum283-microcopy-marcador.test.mjs` — **la vigila**: cambiarla rompe su guard
* `albaranes.routes.ts` e `invoicesAdmin.routes.ts` — **copias propias en el servidor**
  (`MICROCOPY_PENDIENTE_290`, `_308`), no la misma constante

**Conclusión: no se toca en este ticket.** Un cambio suyo alcanza el detalle de albarán, dos
registros de acciones y un guard ajeno. Y el hallazgo aparte: **hay tres marcadores distintos con
el mismo texto** —uno de front y dos de servidor—, así que «el marcador» no es uno solo.

## Lo que queda fuera, con su motivo

* **Los dieciocho textos** de la modal: visibles hoy (medido: la modal se abre con
  `INVOICING_ES_ENABLED` apagado, porque la puerta es `getEmissionMode`, que solo devuelve `'no'`
  sin merchant). Sin víctima **hoy** —no hay merchant pagando— y se recogen antes de la landing.
* **En modo `receipt` la modal se llama «nueva factura» y produce un justificante.** Reportado,
  no arreglado (regla 9): es material del bloque F.

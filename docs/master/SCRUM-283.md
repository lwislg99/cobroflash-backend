# SCRUM-283 · B2 · EL CENSO DERIVADO de las acciones de la vista de FACTURA

**Fecha:** 4-ago-2026 · **Carril:** B · **Gate:** sin gate — sin schema, sin fiscal, sin dinero, sin UI (solo test)
**Medido contra:** `origin/main` = `17289f59f73e041b8989bddd69868aca056eec17` · 2026-08-04T15:20:57+01:00
**Tanda:** 1277 tests, 1210 pass, 0 fail (67 gateados a staging)

## Qué entrega esta tarea, y qué NO

SCRUM-283 gobierna el Bloque B: la LEY del patrón de detalle (1 primaria que cambia con el estado +
2 secundarias + «⋮»), aplicada a la FACTURA. Pero la tabla de estados del ticket **choca con el
árbol en cinco puntos medidos** (abajo) y su resolución la decide el fundador. Lo que SÍ se puede
construir hoy, sin depender de esas cinco, es el **CENSO**: enumerar las acciones que EXISTEN, con
su condición de aparición. **El censo enumera; el mapeo coloca.** Esta entrega es el censo.

**NO se construye** (límite duro): la tabla de estados —ni una celda— · el guard de «ninguna acción
sin sitio» (necesita la tabla) · ninguna acción que no exista hoy (Registrar cobro, Ver justificante,
Modificar, Duplicar, Guardar como plantilla, Borrar borrador, Ver original) · ningún renombre (un
renombre ES microcopy nueva, la aprueba el fundador) · **no se toca «Anular»** (tensión declarada
SCRUM-153 vs regla 5) · sin migración · vanilla.

## El censo — `tests/_censo-acciones-factura.mjs`

DERIVADO de la estructura (AST de TypeScript sobre `invoiceDetailView.js`), **nunca una lista a
mano**. Por cada acción produce: **identificador, línea, texto y CONDICIÓN de aparición** (los `if`
que la envuelven, con las `const` nombradas resueltas). La condición es media dato: una acción no
está «en la pantalla», está en la pantalla **en ciertos estados**.

**El censo dijo solo lo que el ticket no vio:** el ticket contó 8 acciones; el árbol tiene **9**. La
9ª es «Anular» (SCRUM-153), en su sección propia. Una lista escrita a mano no lo habría avisado.

Salida sobre el árbol (`renderInvoiceDetailView`, L15–572):

| # | id | L | texto | condición de aparición |
|---|----|----|-------|-----------------------|
| 1 | `btnPdf` | 203 | `Abrir PDF` | siempre |
| 2 | `btnWhatsApp` | 212 | `Reenviar por WhatsApp` | `invoice.type !== 'R1'` |
| 3 | `btnTogglePaid` | 289 | `st === 'paid' ? 'Marcar como PENDIENTE' : 'Marcar como PAGADA'` | `invoice.type !== 'R1' && st !== 'annulled'` |
| 4 | `btnDispute` | 368 | `📎 Paquete de disputa` | `invoice.chargeId` |
| 5 | `btnBizum` | 384 | `📲 Confirmar Bizum recibido` | `st === 'pending' && invoice.chargeId && invoice.type !== 'R1'` |
| 6 | `btnReminder` | 425 | `💬 Recordar pago` | `st === 'pending' && invoice.customer?.phone` |
| 7 | `btnRectify` | 461 | `⎌ Rectificar factura` | `invoice.type !== 'R1' && !alreadyRectified` |
| 8 | `btnAnular` | 527 | `Anular factura…` | `puedeAnular (= invoice.type !== 'R1' && st === 'pending' && !/^J-/i.test(invoice.number || ''))` |
| 9 | `btnRegen` | 551 | `↻ Regenerar PDF` / `↻ Regenerar PDF (VeriFactu)` | siempre |

Navegación (NO acción, no se coloca en el patrón): `btnBack` (L43, `← Volver a facturas`).

## Cómo distingue el censo

- **Acción vs navegación:** derivado de la cadena de `appendChild`. Un botón cuya cadena pasa por
  `header` (la cabecera) es navegación; el resto, acción. Y solo cuenta lo APPENDEADO: un botón
  creado y nunca añadido no está en pantalla.
- **La trampa de la casa:** el censo se ciñe al cuerpo de `renderInvoiceDetailView`. El mismo fichero
  tiene `abrirModalAnular` (L600+) con botones de confirmar/cancelar del modal, que **no** son
  acciones de la factura — como el `job_without_quote` que vivía en el fichero de albaranes pero
  pertenecía a `collect-rest`.

## Las tres pruebas + la trampa — `tests/scrum283-censo-acciones-factura.test.mjs`

- **Suelo:** cegado el detector (vista sin botones) da 0; sobre el árbol real se exige `> 0`. «No hay
  defecto» y «no supe mirar» son el mismo número; el suelo los distingue.
- **Rojo por el mecanismo:** quitar `actions.appendChild(btnX)` borra la acción del censo, cayendo
  POR ESO (una menos) y no por un SyntaxError. Verificado además sobre el árbol real (quitar Rectificar
  → el censo baja a 8 y el recuento canta la caída; restaurado sin commitear).
- **Control negativo:** el toggle PAGADA/PENDIENTE es UNA acción en dos caras; el censo la cuenta una
  vez (**9, no 10**). Demuestra que distingue «botón con texto condicional» de «dos botones».
- **Trampa de la casa:** toda acción cae dentro del rango de la vista; los botones del modal no.

## Las cinco contradicciones (para la decisión del fundador)

- **A** · «Paquete de etiqueta» (ticket) → «Paquete de disputa» (árbol, L370). **CONFIRMADO** por el
  fundador: es disputa; el rótulo no se toca.
- **B** · «Anular» (9ª acción) en tensión: SCRUM-153 la puso en sección propia con explicación; la
  regla 5 de B2 dice «destructivo solo en ⋮». **Decide el fundador.**
- **C** · «Borrador» de la tabla no existe hoy para facturas (nacen emitidas del ciclo). SCRUM-276/A0
  lo prevé (factura suelta); la tabla de B2 describe la factura **POST-A0**. **Decide el fundador.**
- **D** · Falta el estado «Anulada» en la tabla, que el árbol sí maneja (SCRUM-153). **Decide el fundador.**
- **E** · Acciones nombradas que aún no existen (Registrar cobro, Ver justificante, Modificar,
  Duplicar, Guardar como plantilla, Borrar borrador, Ver original). No se construyen aquí.

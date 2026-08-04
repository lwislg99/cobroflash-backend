# SCRUM-283 · B2 · La LEY del patrón de detalle, aplicada a FACTURA (censo + TABLA)

**Fecha:** 4-ago-2026 · **Carril:** B · **Gate:** sin gate — front vanilla + tests; sin schema/fiscal/dinero
**Medido contra:** `origin/main` = `eebc191dc75da0040f4934ccd8b92cc857726832` · 2026-08-04T16:03:42+01:00
**Tanda:** 1311 tests, 1244 pass, 0 fail, 67 skipped (`npm test`, exit **0**)

> **DOS ENTREGAS.** (1) El **CENSO** (ancla histórica `17289f5`) se mergeó por el PR #400 y ya vive en
> main. (2) La **TABLA** (esta entrega, ancla `eebc191`) se construye encima, ahora que el fundador
> decidió las cinco contradicciones y los dos huecos (a: Anular en sección propia; b: la primaria de
> `pending` como un slot con dos ocupantes). Lo de abajo describe la entrega completa.

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

> **Resueltas (4-ago, Luis + fundador):** **A** confirmada (disputa, rótulo intacto). **B** gana
> SCRUM-153 con excepción escrita en la regla 5 (acto fiscal irreversible → sección propia). **C**
> «Borrador» = hueco estructurado; sus acciones llegan con SCRUM-289. **D** «annulled» ya es fila real
> de la tabla. **E** no se construyen. Y una 6ª que salió del censo: Rectificar-en-annulled → **SCRUM-308**.

---

# LA TABLA — segunda mitad, construida

## Qué cambia para quien la usa

El detalle de factura pasa de **9 botones apilados del mismo peso** a **1 primaria + ≤2 secundarias +
«⋮»**, y la primaria **cambia con el estado**: siempre es el siguiente paso. Se pinta desde un
**registro declarativo** (`public/dashboard/js/invoiceActionsRegistry.js`), la MISMA fuente que el
guard verifica — nadie escribe la tabla dos veces. El «⋮» reutiliza `overflowMenu` de AB3 (a11y,
teclado, hoja inferior ≤640px); no se crea componente nuevo (regla 4). **Los handlers de cobro/firma/
WhatsApp/PDF no se tocan**: solo cambia el RÓTULO (a marcador) y el SITIO de cada botón.

| Estado | Primaria | Secundarias | «⋮» |
| --- | --- | --- | --- |
| **pending** | Cobro *(contextual)* | WhatsApp · PDF | Recordar · Rectificar · Regenerar · Disputa |
| **paid** | — | WhatsApp · PDF | Marcar PENDIENTE · Rectificar · Regenerar · Disputa |
| **annulled** | — | PDF | Regenerar |
| **R1** | — | PDF | Regenerar |

- **Primaria contextual de `pending`** (un slot, dos ocupantes; ninguna desaparece): con `chargeId` →
  **btnBizum** («el Bizum que esperaba ha llegado»); sin él → **btnTogglePaid** («márcalo pagado»).
- **Anular** (`btnAnular`): **intacto**, en su sección propia con su explicación (excepción de la
  regla 5). El registro lo declara `seccion-propia` — destino VÁLIDO, para que el guard de «sin sitio»
  no dé rojo en falso el primer día (un guard que da rojo en falso es un guard que alguien silencia).
- **Cambios de visibilidad que exige la tabla, todo front:** Rectificar deja de pintarse en `annulled`
  (**SCRUM-308**; NO se toca `/rectify` ni el back); WhatsApp y Disputa quedan fuera donde la tabla no
  los lista (annulled/R1).

## Cómo se pinta y cómo se verifica

`ubicarAccion(btn, id)` lee el destino del registro para el estado actual y reparte a primaria/
secundaria/«⋮» (o lo oculta). El censo se actualizó para reconocer `ubicarAccion(...)` como la señal
de «aparece en pantalla» (antes miraba `appendChild`); la CONDICIÓN que ahora capta son los data-gates
(`chargeId`/`phone`/`alreadyRectified`), porque el ESTADO bajó al registro.

**Guards** (`tests/scrum283-tabla-patron-factura.test.mjs`, 12): ninguna acción del censo sin sitio
(y ningún sitio sin acción) · reglas 1 (≤1 primaria) y 2 (≤2 secundarias) en los 4 estados × contexto
· **rojo por el mecanismo en los CUATRO estados** (romper la fila de cada uno lo delata; demostrado
ascendiendo btnRegen a 2ª primaria en cada estado) · los dos ocupantes de la primaria de `pending`
(test **con** y **sin** `chargeId`) · **regla 29** (ningún estado surfacea editar/borrar de una
emitida; las vías permitidas son rectificar→R1 y anular con registro) · control negativo (reordenar el
«⋮» no rompe nada) · suelo. **Microcopy** (`tests/scrum283-microcopy-marcador.test.mjs`): todo rótulo
del patrón es el marcador `[PENDIENTE microcopy oficial]`, con suelo y test de inyección.

## Microcopy — alcance declarado (regla 30)

Los **8 rótulos** del patrón reorganizado se pintan con el marcador `[PENDIENTE microcopy oficial]`: el
fundador aún no ha aprobado los textos, y un RENOMBRE también es microcopy nueva. Fuera del marcador, a
propósito: **Anular** (rótulo y código intactos, excepción de la regla 5) y los textos de FEEDBACK
dentro de los handlers («Enviando…», toasts) — copy existente, reusado, y los handlers no se tocan;
reusar lo existente no es microcopy nueva. El guard mira el RÓTULO (primer `textContent`), no el feedback.

## 🔴 AB6 — checklist INCOMPLETO POR CONSTRUCCIÓN (paso humano pendiente)

Esta entrega toca UI, así que AB6 aplica, y **dos de sus puntos no los puede producir esta sesión**:

- **Capturas antes/después** — requieren navegador con datos reales. NO hechas.
- **Matriz de dispositivos** (Android gama media / iPhone / tablet, V0-5) — el máster la marca ⏳ HUMANO.
  NO corrida contra dispositivos reales.

Se declara el hueco, no se finge: «no corrí esto contra dispositivos reales» es información, no un
fallo que se arregle escribiéndolo mejor. Lo verificable por código SÍ está: sintaxis (`node --check`),
render desde el registro, a11y heredada de `overflowMenu` (AB3), y que el «⋮» degrada a botones sueltos
si el helper no carga (perder el menú no puede costar una acción). **Pendiente de un humano:** las
capturas y la matriz de dispositivos antes de considerar AB6 cerrado.

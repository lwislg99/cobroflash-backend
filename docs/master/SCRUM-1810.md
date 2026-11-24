# SCRUM-1810 · En el «⋯» de un documento pagado sigue saliendo «Marcar como cobrada»

## SCRUM-1810b · factura pagada sin el botón; justificante pagado con «Marcar como pendiente»

**Medido contra:** `origin/main` = `9067651f76c23ded05ae3b63be1385a3ba90170e` · 2026-11-24T07:51:25Z

Carril J1 (`public/dashboard/js/invoiceDetailView.js`). Sesión jv-j1jl. Rama `scrum-1810b-marcar-pendiente-y-oculto-en-factura`.

**Skill UI:** `yaqu-premium-ui` cargada antes de tocar la vista. Sin tokens, clases ni componentes nuevos: cambia el rótulo
de un botón existente y si se pinta.

**Medición (SCRUM-1810 c.22530, jv-j1jk, resumida).** `btnTogglePaid` no es «marcar cobrada otra vez»: es un conmutador.
Sobre un documento `paid` manda `PUT /admin/invoices/:id/status` con `status: 'pending'` (deshacer el pago), con el rótulo
fijo «Marcar como cobrada». El servidor (`src/modules/system/invoiceAdmin.ts`, `UnpayNotAllowedError`) solo admite
`paid → pending` en un justificante (`type === 'JUST'` o número `J-…`); en una factura lo rechaza siempre. Ocultarlo en todo
documento pagado quitaba la única vía del panel para deshacer el pago de un justificante (camino `deshacer_pago`, SCRUM-1803b).

**Decisión (SCRUM-1810 c.22535, fundador):** A+B. A — en una FACTURA pagada `btnTogglePaid` no se pinta. B — en un
JUSTIFICANTE pagado se queda y su rótulo es el literal firmado `Marcar como pendiente`. En no pagados, «Marcar como
cobrada» no cambia. C (ocultarlo siempre) descartada.

**Lo construido.** A: `if (!(constaPagado && !isReceipt)) ubicarAccion(btnTogglePaid, …)`, con `constaPagado = st === 'paid'
|| Boolean(invoice.paidAt)`, el criterio de 1532d/1800c. B: `if (isReceipt && st === 'paid')` el rótulo pasa al literal
firmado. ⚠️ Desvío del encargo, a sabiendas: B NO usa `paidAt`, usa el mismo `st === 'paid'` que elige `targetStatus` en el
clic. Si el rótulo usara `paidAt`, un justificante con `paidAt` y otro estado diría «Marcar como pendiente» y mandaría
`status: 'paid'`: rótulo y acción discreparían. `isReceipt` es el de la vista (l.100), el mismo criterio que el servidor.
El primer `textContent` sigue siendo «Marcar como cobrada», así que `scrum283-microcopy-marcador` (que lee el primero) no
cambia; el literal nuevo lo fija el test de este tramo.

Mezclado antes de empujar: `origin/scrum-1800c-boton-cancelar-con-factura-pagada` (`53c2ba27`; `scrum-1800d-…` no existía en
el remoto al hacer `git fetch`) y `origin/main` (ya al día). 0 marcadores; la condición de 1800c (`&& !invoice.paidAt`) y su
literal `document_already_paid` siguen en la vista.

| qué | esperado | visto |
|---|---|---|
| test nuevo ANTES del arreglo | ①② rojos, ③ verdes | 3 rojos (① ×2, ②) · 2 verdes (③ ×2) |
| test nuevo con el arreglo | 5/5 | 5 pass · 0 fail |
| mutación del catálogo (`aplicarUna` de `scripts/meta-guard-mutaciones.mjs`) | cae el caso nombrado | `ok: true`; cae ① factura pagada + 1 colateral (① con `paidAt`); `git status` limpio después |
| tests que nombran `invoiceDetailView` + 1532d, 1800c, 1802, 601, 1415, 1294, 267, 854, 719, 283, 1316l, 1787b (44 ficheros) | 0 fail | 369 tests · 368 pass · 1 fail: scrum854 ② pedía este registro, aún sin escribir |
| captura 1280 · factura pagada, «⋯» abierto | sin «Marcar como cobrada» | menú: «Emitir factura rectificativa», «Volver a generar el PDF» |
| captura 1280 · justificante pagado, «⋯» abierto | «Marcar como pendiente» | primera entrada del menú |
| capturas 390 | ídem en la hoja inferior | justificante 390 regenerado y mirado: hoja inferior con «Marcar como pendiente» primera; factura 390 mirada en la versión de página entera (sin el conmutador), no reabierta tras regenerar |
| suite ENTERA en local | — | NO CORRIDA (encargo: no correrla; tope 165k) |

Capturas y guion: `docs/master/evidencias/SCRUM-1810/` (`capturar-1810b.mjs`, cuatro PNG `1810b-*-pagado-{390,1280}.png`).
Datos de ejemplo, sin base ni sesión; el guion quita la bienvenida (J3), que tapaba la ficha en el banco.

Mutaciones: catálogo → `tests/scrum1810b-marcar-pendiente-y-oculto-en-factura.test.mjs`

A9: comprobación → `tests/scrum1810b-marcar-pendiente-y-oculto-en-factura.test.mjs`

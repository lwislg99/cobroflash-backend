# SCRUM-1037 · CONTABILIDAD — Comprobar en staging los cuatro fallos de cifras

**Medido contra:** `origin/main` = `f5111cf184179e59a2b58e121a57816799724cb2` · 2026-09-22T09:43:00Z
**Puesto:** S0 (medición)

Medido/leído — el camino de emisión fiscal se lee, no se modifica (STOP de AA1.4). Detalle completo,
citas de código y la comprobación en vivo del punto (a): `docs/master/evidencias/scrum1037/HALLAZGOS.md`.

## Veredicto

| # | Descripción | Veredicto |
|---|---|---|
| a | Selector de retención del perfil no carga NI guarda | **OCURRE 🔴** (doble: `GET` no expone los campos, `PUT` los descarta) |
| b | `JUST` entra en el libro/IVA repercutido | **OCURRE en el generador** (sin filtro por `type`); SCRUM-1027 cerró la vía más común de creación — falta confirmar otras vías. Para J1. |
| c | Criterio de caja usa `paidAt` | Cierto, pero documentado con advertencia y sin consumidor (303) todavía. Para J1. |
| d | Gastos sin `baseAmount` fuera del libro | Ocurre, pero es diseño deliberado y declarado (`sinClasificar`) — no es un bug. |

## Sin código de producto

Solo medición y lectura (S0). (a) es CRM/Contabilidad puro (`src/modules/system`,
`src/core/validation`) y queda para su ticket de arreglo. (b) y (c) tocan el camino de emisión
fiscal: se documentan y se pasan a J1 con la evidencia, sin abrir arreglo desde aquí (aceptación del
propio SCRUM-1037, punto 2). (d) se cierra sin acción — no es un defecto.

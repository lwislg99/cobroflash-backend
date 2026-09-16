# SCRUM-442 · El listado de «Facturas» mezclaba facturas y justificantes

**Medido contra:** `origin/main` = `9d52ddb9bed8cf527e336d5b64df8a6e8bbc25d7` · 2026-08-11T17:37:21+02:00
**Rama:** `scrum-442-solo-facturas`

## El defecto

Los dos documentos viven en la MISMA tabla, discriminados por `type` (`invoicesAdmin.routes.ts:126`
escribe `F1`, `:142` escribe `JUST`). El `where` de `listInvoicesAdmin` (`invoiceAdmin.ts:14`) tenía
**cuatro criterios** —merchant, estado, búsqueda, fechas— y **`type` no estaba en ninguno**.

**44 de 55 documentos en producción no eran facturas** (10-ago-2026). Cuatro de cada cinco. Un
justificante vive fuera de toda serie fiscal, y el profesional los contaba como facturas.

## 🔴 El suelo del ticket, comprobado ANTES de excluir

Excluirlos solo es legítimo si su sitio existe. `cobros.service.ts` lista **la unión** de todo
`Charge` **más** toda `Invoice` con `chargeId: null` —que hoy son todas— y **no filtra por `type`**.
**Los 44 siguen alcanzables.**

Si Cobros listara solo `Charge`, excluirlos aquí los habría **borrado del producto**: un cobro por
transferencia o efectivo no crea `Charge` (SCRUM-441). Ese módulo ya lo dice: «una pantalla que
lista solo `Charge` no está incompleta: miente por omisión».

## El arreglo

Un quinto criterio: `type: { not: JUST }`. **Exclusión, no lista blanca** — con `type: 'F1'` se
caerían del listado las rectificativas R1 y cualquier tipo futuro.

**Regla 29: cambia qué se lista, jamás qué se guarda.** Ni una fila tocada. Sin microcopy nueva: el
menú Cobros ya existe (diseño §B4), así que no hay rótulo que aprobar.

## Verificación

| | |
|---|---|
| **SUELO** | si no se localiza el `where`, falla declarándose ciego |
| **El vector** | el `where` excluye `JUST`; el rojo dice `SE HA COLADO EL JUSTIFICANTE` (caen 2) |
| **Control positivo** | se comprueba que es exclusión y no `type: 'F1'`, que se llevaría las R1 |
| **Control negativo** | los otros cuatro criterios siguen enteros — un `where` de cinco que rompa estado o fechas es regresión |
| **El suelo del ticket** | Cobros sigue listando `invoice` y NO excluye `JUST`: si algún día lo hiciera, cae |

Suite: 3042 tests · 2966 pass · 0 fail · 76 skip · `npm ci` exit 0 antes de medir.

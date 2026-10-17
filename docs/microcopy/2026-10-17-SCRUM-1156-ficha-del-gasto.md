# SCRUM-1156 · la ficha de lectura del gasto

**Aprobado por el orquestador por delegación del fundador** el 2026-09-20 — SCRUM-920 comentario 15992 (sección «El detalle y el «⋯» de la fila» del borrador `docs/prototipos/SCRUM-920/ficha-microcopy-DRAFT.md`). Construido en SCRUM-1156, casi un mes después de firmarse: la ficha no existía, y cuatro de estos textos eran rótulos de controles que tampoco.

## Dónde se pinta

`public/dashboard/js/expensesView.js`, `renderExpenseDetailView` (la vista `expenses-detail` de `app.js`).

## Los literales, tal cual se pintan

> La foto del ticket
> Ver a tamaño completo
> Cambiar la foto
> De este gasto no guardaste ninguna foto.
> 📷 Añadir la foto ahora
> Datos de la factura del proveedor
> Este gasto no cuenta para el margen de ningún trabajo.
> Vincular a un trabajo
> Ver la foto
> 📷 Añadir la foto

## Reusados, no nuevos

- «Editar», «Ver trabajo» (SCRUM-302), «🗑 Eliminar», «Foto guardada», «Sin foto», «Sin trabajo» y «Presupuesto sin
  trabajo»: los de la lista, tal cual.
- Los rótulos de los datos —«Nº de factura del proveedor», «Fecha de la factura», «Base imponible», «Tipo de IVA», «Cuota
  de IVA»— y «Notas»: los del alta. «Trabajo» y «Gastos» (la miga): los nombres que el panel ya usa.
- «NIF del proveedor» NO se pinta: la fila que devuelve `GET /admin/expenses/:id` no trae el NIF (`provider` es
  `{ id, name }`), y sin dato no hay fila.

## Pendiente de referencia de Jira (no cuenta todavía)

Firmado por el orquestador en el encargo a la S2 del 16-oct-2026, pero sin comentario de Jira que citar en la línea
de firma (lo exige `tests/_microcopy-aprobada.mjs`). Hasta que lo haya, NO van como cita y la rama no se empuja:

- «Ese gasto ya no existe.» — el aviso de `DETALLES` en `app.js` y de la ficha ante un 4xx. Séptimo del patrón.
- **Propuesto, sin firma:** «No se ha podido cargar el gasto. Vuelve a intentarlo.» — la ficha ante un 5xx o sin red.
  Octavo hermano de «No se ha podido cargar el parte. Vuelve a intentarlo.» (SCRUM-720).

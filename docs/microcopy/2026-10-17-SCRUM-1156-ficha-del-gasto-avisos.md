# SCRUM-1156 · los dos avisos de la carga de la ficha del gasto

**Aprobado por el orquestador por delegación del fundador** el 2026-10-17 — SCRUM-1156 comentario 19907. La firma cubre estos dos literales en estos dos sitios y nada más.

## Dónde se pinta

- `public/dashboard/js/app.js`, `DETALLES['expenses-detail'].aviso`: el id del hash que ya no existe.
- `public/dashboard/js/expensesView.js`, `TEXTO_FICHA_NO_EXISTE` (la ficha ante un 4xx) y `TEXTO_FICHA_NO_CARGA` (la
  ficha ante un 5xx o sin red).

## Los literales, tal cual se pintan

> Ese gasto ya no existe.
> No se ha podido cargar el gasto. Vuelve a intentarlo.

## De dónde salen

- El primero es el séptimo del patrón de `DETALLES` («Ese presupuesto / trabajo / … ya no existe.»).
- El segundo es el singular de `expensesView.js` para la lista: «No se han podido cargar los gastos. Vuelve a
  intentarlo.». Se elige «Vuelve a intentarlo.» y no «Inténtalo de nuevo.» por ser la forma de ese mismo fichero.

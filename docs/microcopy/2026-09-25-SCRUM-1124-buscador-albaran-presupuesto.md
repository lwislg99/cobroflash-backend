# SCRUM-1124 · buscador «Nuevo albarán desde presupuesto»: 6 textos

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## Los literales, tal cual se pintan

`public/dashboard/js/albaranDesdePresupuestoModal.js`:

> Busca por nº de presupuesto, cliente o teléfono

Placeholder del buscador.

> Ningún presupuesto coincide con esa búsqueda

Estado vacío de la búsqueda.

> Todavía no tiene trabajo: acepta el presupuesto y vuelve

Motivo `sin_trabajo`.

> Ese trabajo es de otro técnico

Motivo `trabajo_no_visible`. 🔄 CAMBIADO respecto a la propuesta («Su trabajo no es tuyo»): el
orquestador firmó esta versión por lenguaje llano — la original sonaba a reproche y no decía
quién lo tiene.

> Puede haber más: afina la búsqueda

Aviso de lista truncada.

> No se han podido cargar los presupuestos

Error de carga.

## Qué cambió

Los seis salían de una sola constante `MARCA` (`[PENDIENTE microcopy oficial]`), declarada junto
a `ALB_ORIGEN_SIN_APROBAR = 6`. Las dos se retiraron enteras en el mismo commit que se aplicó el
texto.

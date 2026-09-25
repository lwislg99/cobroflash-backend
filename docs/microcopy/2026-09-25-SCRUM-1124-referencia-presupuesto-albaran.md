# SCRUM-1124 · referencia al presupuesto de origen en el pie del albarán

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## El literal, tal cual se pinta

`src/modules/jobs/domain/albaranPrecios.ts`, `ROTULO_PRESUPUESTO_ORIGEN`:

> Presupuesto nº

Se imprime seguido del número visible por merchant (o el id si no hay número), p. ej.
«Presupuesto nº 7». Va impreso en el papel del albarán que recibe el CLIENTE.

## Qué cambió

Antes salía `Presupuesto nº [PENDIENTE microcopy oficial]`. El marcador se retiró en el mismo
commit que se aplicó el texto.

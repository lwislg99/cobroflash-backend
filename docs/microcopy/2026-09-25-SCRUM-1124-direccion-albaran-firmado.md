# SCRUM-1124 · error al cambiar la dirección con un albarán ya firmado

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## El literal, tal cual se pinta

`src/modules/jobs/domain/jobDireccion.ts`, `MSG_DIRECCION_SELLADA`:

> No se puede añadir la dirección a este trabajo: tiene un albarán ya firmado que la lleva dentro de su firma. Cambiarla dejaría esa firma sin poder verificarse.

Caso raro: un Trabajo con un albarán firmado ANTES de SCRUM-300 (regla 40; el esquema exige el
ALTER previo — no aplica aquí, es sólo el texto).

## Qué cambió

Antes salía envuelto en `[PENDIENTE microcopy oficial · propuesta: … ]`. El marcador se retiró
en el mismo commit que se aplicó el texto propuesto en el informe original de SCRUM-424.

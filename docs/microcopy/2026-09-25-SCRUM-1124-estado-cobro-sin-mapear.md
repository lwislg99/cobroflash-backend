# SCRUM-1124 · estado de cobro sin mapear (semáforo de facturas)

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## El literal, tal cual se pinta

`public/dashboard/js/invoicesView.js`, `metaDelSemaforo` cuando el código no está en
`SEMAFORO_META`:

> Estado no reconocido: ${codigo}

`${codigo}` es el código real que mandó el servidor, en mayúsculas y sin espacios colgando (o el
guion «—» si viene vacío).

## Qué cambió

Antes salía `[PENDIENTE microcopy oficial] ${codigo}`, desde la constante
`INV_MARCADOR_MICROCOPY`. Esa constante y su contador `INV_SIN_APROBAR = 1` se retiraron enteros
en el mismo commit que se aplicó el texto.

## Lo que NO cambia

El cuarto estado sigue sin construirse (regla 27): esto sólo deja de mentir sobre un estado que
el semáforo no reconoce, no añade un estado nuevo al dominio.

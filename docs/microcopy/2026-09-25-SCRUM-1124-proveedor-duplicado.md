# SCRUM-1124 · aviso de proveedor duplicado

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## El literal, tal cual se pinta

`public/dashboard/js/providersView.js`, `mensajeDeErrorProveedor` para el código
`name_duplicate`:

> Ya tienes un proveedor con ese nombre

## Qué cambió

Antes salía `[PENDIENTE microcopy oficial] nombre ya en uso`, concatenado desde
`PRV_MARCADOR_MICROCOPY`. Esa constante NO se retira: se conserva como respaldo de ÚLTIMO RECURSO
para un código sin mapear y sin respaldo en castellano — mismo reparto que el fichero gemelo
`productsView.js` (SCRUM-641/644).

`provider_in_use` no está en esta aprobación: su texto ya existía en la pantalla y no se ha
tocado.

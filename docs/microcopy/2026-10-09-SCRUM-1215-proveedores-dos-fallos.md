# Los dos fallos que explica la pantalla de Proveedores

**Aprobado por el orquestador por delegación del fundador** el 9-oct-2026 — SCRUM-1215 comentario 19084.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. El comentario los firma «sin
cambiar una letra» (F1 y F2), sobre la medición de S4 del mismo día (SCRUM-1215 comentario 19077).

## Texto aprobado, literal

Al borrar un proveedor que está asignado a algún producto:

> No se puede borrar el proveedor porque está asignado a uno o más productos.

Al guardar un proveedor con un NIF/CIF que el servidor no da por válido:

> Ese NIF/CIF no es válido. Compruébalo.

## Dónde se pinta

- `public/dashboard/js/providersView.js`, objeto `M`, claves `provider_in_use` y `taxId_invalido`: es la traducción del
  código de error que contesta el servidor. Cada clave lleva la marca de la firma en su línea.

## Qué decía antes

Lo mismo. Los dos textos ya estaban en pantalla; lo que no tenían era firma escrita.

## Límite de la firma

La del segundo es del TEXTO, no del criterio de validez del NIF, que sigue siendo de la asesora (así lo dice el
comentario de la firma). Si la asesora pide otra redacción, cambia y se vuelve a firmar.

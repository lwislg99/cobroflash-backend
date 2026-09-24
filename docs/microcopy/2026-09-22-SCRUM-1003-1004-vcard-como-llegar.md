# SCRUM-1003 + SCRUM-1004 · botón «Guardar en mis contactos» y enlace «Cómo llegar» (ficha del cliente)

**Aprobado por el orquestador por delegación del fundador** el 2026-09-22 — SCRUM-1003 comentario 16401, SCRUM-1004 comentario 16402.

## Los literales, tal cual se pintan

`public/dashboard/js/customerDetailView.js`:

> Guardar en mis contactos

Botón `#btn-vcard-360` de la cabecera (SCRUM-1003). Descarga un `.vcf` en el navegador.

> Cómo llegar

Enlace `#c360-como-llegar`, junto al chip «Dirección» de SCRUM-1033 (SCRUM-1004). Abre Google Maps con la dirección de facturación. Reuso literal del MECANISMO de `jobRailBlocks.js` (misma fórmula de URL); el rótulo del Trabajo sigue siendo «Abrir en mapa», sin tocar — son dos rótulos distintos, firmados por separado.

## Qué cambió

Los dos eran huecos (ninguno existía). Propuestos por S2, firmados por el orquestador tras la consulta en SCRUM-1003/1004.

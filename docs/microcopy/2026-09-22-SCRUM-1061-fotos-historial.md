# SCRUM-1061 · miniaturas de fotos del Trabajo en el historial del cliente

**Aprobado por el orquestador por delegación del fundador** el 2026-09-22 — SCRUM-1061 comentario 16433 (propuesta) y su respuesta de firma.

## Los literales, tal cual se pintan

`public/dashboard/js/customerDetailView.js`:

> Foto del trabajo

`alt` de cada `<img>` miniatura.

> +{n} más

Texto del indicador cuando el trabajo tiene más de 3 fotos (ej. «+2 más»). El número se compone, no es texto.

> {n} fotos más

`aria-label` del indicador anterior (ej. «2 fotos más»), mismo patrón que ya usa `ariaFotos` para el contador antiguo por albarán.

## Qué cambió

Los tres eran huecos (no existía ninguna miniatura, solo un contador «📷 n» por albarán). Propuestos por S2, firmados por el orquestador.

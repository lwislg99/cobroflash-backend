# SCRUM-1150d · el albarán que no se pudo cargar

Aprobado por el orquestador por delegación del fundador · SCRUM-1150 comentario 19658 (14-oct-2026).

Sobre la propuesta de c.19657, con la apertura cambiada por lo medido («No se pudo…» en 75 sitios del panel,
SCRUM-1273 c.19604) y la forma de reintento de la casa (SCRUM-1215 c.19460):

> No se pudo cargar el albarán. Inténtalo de nuevo.

## Dónde se ve

`public/dashboard/js/albaranDetailView.js`, `COPY_ALBARAN_NO_SE_PUDO_CARGAR`: la ficha del albarán cuando su
`GET` falla con respuesta del servidor y sin albarán precargado. Si el servidor manda un `message` para
personas, se enseña ése (`mensajeParaPersona`); si no, este texto.

## Qué cambió

Antes pintaba `'No se pudo cargar el albarán: ' + (e.data.message || e.message)`: con un 500 sin `message`,
«No se pudo cargar el albarán: API 500: internal_error». Desde SCRUM-1150d, el hash abre la ficha con un 5xx
(antes decía «Ese albarán ya no existe.»), así que ese texto crudo se habría visto también por ahí.

Sin red no cambia: sigue su texto firmado (`COPY_ALBARAN_SIN_PRECARGA`).

Lo sujeta `tests/scrum832-atras-vuelve-a-la-lista.test.mjs`.

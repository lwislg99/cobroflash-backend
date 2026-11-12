# Facturas · el marcado en bloque cuando se marcan cero · SCRUM-1640

**Aprobado por el fundador** el 30-oct-2026, en **SCRUM-1640** (comentario 21292).

La firma no me llegó a mí: el fundador la dio por mensaje al orquestador del equipo de Javier
(`cobroflash-backend-5b`), y el comentario 21292 la transcribe. J1 (`jv-j1dq`) la leyó en Jira el
30-oct-2026 y copió de allí los literales.

## Texto aprobado, literal

Se marcan cero:

> No se ha marcado ninguna: ya estaban pagadas o anuladas.

Se marcan cero y falla la recarga:

> No se ha marcado ninguna: ya estaban pagadas o anuladas. La lista no se ha podido actualizar. Recárgala para verla al día.

Se marcan una o más y falla la recarga (ya existía sin firma, desde SCRUM-375):

> Se han marcado como pagadas, pero la lista no se ha podido actualizar. Recárgala para verla al día.

## Dónde se pinta

`COPY_BULK_PAGADAS` en `public/dashboard/js/invoicesView.js`, claves `ningunaMarcada`,
`ningunaMarcadaRecargaFallida` y `recargaFallida`. Los elige `resultadoMarcadoEnBloque`, y salen en el
aviso de la lista de Facturas, en tono `warning`. Lo fija `tests/scrum1640-lote-marca-cero.test.mjs`.

## Qué no cubre esta firma

El punto ② del ticket va a SCRUM-1523 y el ③ sigue sin decidir (mismo comentario).

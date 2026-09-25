# SCRUM-1124 · pantalla de detalle del albarán: procesando, rótulo sin mapear y error genérico

**Aprobado por el orquestador por delegación del fundador** el 2026-09-25 — SCRUM-1124 comentario 17002.

## Los literales, tal cual se pintan

`public/dashboard/js/patronDetalleAcciones.js` (la ley del patrón, compartida con la factura),
consumidos en `public/dashboard/js/albaranDetailView.js` (10 usos):

> Procesando…

Estado `info` mientras una acción está en vuelo (emitir, enviar para firmar, enviar por
WhatsApp, facturar).

> Acción

Rótulo de un botón, o de una etiqueta del rail lateral, que no tiene texto mapeado.

> No se ha podido completar la acción. Vuelve a intentarlo.

Error genérico cuando la llamada falla sin traer su propio mensaje.

## Qué cambió

Los tres papeles salían de una sola constante `MICROCOPY_PENDIENTE`
(`[PENDIENTE microcopy oficial]`), declarada en `patronDetalleAcciones.js` y reexportada por
`invoiceActionsRegistry.js` para los guards. Se partió en tres constantes con nombre
(`TEXTO_PROCESANDO`, `TEXTO_ROTULO_SIN_MAPEAR`, `TEXTO_ERROR_GENERICO`) y `MICROCOPY_PENDIENTE`
se retiró entera, junto con su reexportación.

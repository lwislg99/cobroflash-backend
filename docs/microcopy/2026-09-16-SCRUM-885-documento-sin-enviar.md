# Aviso de que el documento del cobro no le ha llegado al cliente

**Aprobado por el orquestador por delegación del fundador** el 16-sep-2026 — SCRUM-885 comentario 15615.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> El documento no se ha enviado: el cliente no tiene email. Añade su email en su ficha y envíaselo.

## Dónde se pinta

Vive en UN sitio, `public/dashboard/js/avisoDocumentoSinEnviar.js` (`AVISO_DOCUMENTO_SIN_ENVIAR`), y
las vistas lo piden a esa regla; ninguna lo copia:

- **Fila de la factura en el trabajo** — `jobDetailView.js`, `.alert.warning` fija.
- **Toast `warn` tras «Confirmar Bizum recibido» en el trabajo** — `jobDetailView.js`.
- **Aviso fijo en la ficha de la factura** — `invoiceDetailView.js`, `.alert.warning` (SCRUM-885b).
- **Toast `warn` tras «Confirmar Bizum recibido» en la ficha de la factura** — `invoiceDetailView.js`.

Sale cuando el envío automático al cobrar está encendido, el cliente no tiene email y el WhatsApp
del cobro no se intentó o no consta enviado (en cola más de 10 minutos cuenta como no enviado).

## Qué cambió

Antes no había texto: el cobro se confirmaba con su ✓ y nadie decía que el documento no había
salido ni por email ni por WhatsApp. El ✓ se queda, porque el cobro sí está hecho; el aviso va
aparte.

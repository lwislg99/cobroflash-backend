# El correo del documento que no salió · SCRUM-1235

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1235 comentario 17384.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (referencia SCRUM-1121), verificada hoy en `origin/main`.

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `cobros.correoFallidoFactura` | No se pudo enviar la factura al cliente por email. |
| `cobros.correoFallidoJustificante` | No se pudo enviar el justificante al cliente por email. |
| `cobros.reenviar` | Enviar de nuevo |
| `cobros.reenviando` | Enviando… |
| `cobros.reenviado` | ✓ Enviado por email |

Para el fallo del reintento NO hay texto nuevo: se pinta el `message` que el servidor ya manda
(`src/lib/sendOutcome.ts`, `email_send_failed`).

## Dónde se pintan

`public/dashboard/js/cobrosView.js`, en la celda «Documento» de la fila de un cobro cuyo último
intento de mandar el documento por email consta como `fallo_envio` en `email_messages`. El botón
llama a `POST /admin/invoices/:id/send-email`, que ya existía.

## Por qué son dos avisos y no uno

La fila de `email_messages` distingue `kind = invoice` de `kind = justificante`. Un merchant español
con `INVOICING_ES_ENABLED` en OFF no recibe facturas: recibe justificantes (reglas 24 y 26). Decirle
«no se pudo enviar la factura» sería afirmar que YaQu le emitió una factura.

⚠️ Si `kind` dejara de distinguirlos, o cambiara el criterio de las reglas 24/26, los dos literales
vuelven a firma. No se heredan.

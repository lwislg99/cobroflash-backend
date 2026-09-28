# SCRUM-1212 — El correo «presupuesto aceptado» (punto 1: ocultar la frase fiscal)

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:40:14Z

Carril S1 · sesión s1-28b · rama `scrum-1212-sin-emitir-factura-en-recibo`. La medición completa del ticket está en el comentario 17338 de Jira.

## Qué se construye (decisión del orquestador, 28-sep)

`sendMerchantQuoteAcceptedEmail` (`src/modules/messaging/domain/merchantNotifications.ts`) decía «Ya puedes emitir la factura.» a todos los profesionales. Con `INVOICING_ES_ENABLED` en OFF, un merchant ES real no puede emitir factura por YaQu (regla 24): era una afirmación fiscal falsa que llegaba a su bandeja.

- La frase **se oculta, no se reescribe** (patrón de SCRUM-1160): no hay texto nuevo ni firma nueva.
- Criterio: la frase solo sale en modo `fiscal` o `demo`, con el modo leído de la fuente única `modoEmisionVisible` → `getEmissionMode`. Es el mismo criterio y el mismo fallo cerrado que `facturaFiscalDisponible()` en el panel (SCRUM-905): con el modo desconocido, no sale.
- El parámetro `modoEmision` es **obligatorio**: el compilador obliga a cualquier llamador futuro a decidirlo.
- Único llamador vivo: el bot (`whatsappIncoming.routes.ts`). Ahora selecciona también `id`, `country` y `flags` del merchant y pasa el modo.

## Lo que NO se hace aquí

- «El cliente ha firmado digitalmente» sigue en el correo, pero **no es cierto en el único camino que lo manda**: el bot acepta por texto, sin trazo. Está en el punto 2: medir qué sabe cada camino, y después firmar textos.
- El texto del ajuste en Configuración («…desde su portal») no se toca (punto 3, va con lo anterior).
- No se manda el correo desde `/decision`: es un envío nuevo, J6 no lo cubre y lo decide el fundador.
- El demo conserva la frase, igual que el panel le ofrece facturar (factura con marca de agua).

## Pruebas

`tests/scrum1212-correo-aceptado-sin-emitir-factura.test.mjs`. El test recorre merchant → `modoEmisionVisible` (real) → correo (real) → HTML, con solo el emisor `enviarCorreo` doblado, sin red. **Rojo medido contra el `dist` anterior:** fallaban 2 de 4 (ES sin flag y modo desconocido), y los dos controles positivos (fiscal y demo) pasaban. Verde después. Tests relacionados: 136 pasan, 2 saltados (staging).

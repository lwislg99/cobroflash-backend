# Ficha del cliente — pestaña «WhatsApp» · SCRUM-1133

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1133 comentario 17448.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente». Los propuso
J2; la firma puso dos condiciones, y las dos se resolvieron así:

- **① El «20» de «(20+)» no se escribe.** El tamaño de página lo decide el servidor, así que la
  pestaña pinta lo cargado: «WhatsApp (n)», y «WhatsApp (n+)» si hay más páginas, igual que
  «Trabajos (n+)» de SCRUM-980. Aprobado por el orquestador en su orden de relevo a J2 del
  29-sep-2026 (por chat, no en Jira).
- **② La línea del cliente de baja NO se publica.** Estaba firmada con la condición de que fuera
  verdad, y medido no lo es: `isWaOptedOut` sólo se consulta en 2 de los 8 envíos de WhatsApp, el
  corte de la plantilla va condicionado a `params.merchantId &&`, y si la consulta falla no bloquea.
  Por eso no está en la tabla de abajo. El hallazgo vive en **SCRUM-1262**.

## Textos aprobados, literales

`n` es el número de mensajes cargados, y `N` el número del documento: datos, no texto.

| Ranura | Texto aprobado |
|---|---|
| `pestana` | WhatsApp |
| `columnas` | Fecha |
| `columnas` | Documento |
| `columnas` | Estado |
| `factura` | Factura |
| `cobro` | Cobro |
| `sinDocumento` | — |
| `vacio` | Sin mensajes de WhatsApp |
| `verMas` | Ver más mensajes |

El presupuesto se nombra con `appLocale.quote` («Presupuesto» por defecto) y su número, que sale de
las listas que la ficha ya tiene; si no está, sin número. Nunca el id interno.

## Dónde se pinta

En la ficha del cliente (`public/dashboard/js/customerDetailView.js`), cuarta pestaña, sólo para el
rol admin (la ruta es `requireRole('admin')`). Los textos viven en `WHATSAPP_CLIENTE.TEXTOS`. El
estado de cada mensaje es el chip de WA-0b (`waDeliveryChip`, `api.js`), sin tocar.

## Lo que NO se pinta, a propósito

- `error`: el texto crudo de Meta, en inglés.
- `templateName`: el nombre interno de la plantilla (sólo va en el `title` del chip, como ya hace en
  presupuestos y facturas).
- `waOptOut`: ver condición ②.

# SCRUM-1133 · la ficha del cliente enseña los WhatsApp que se le han enviado

**Medido contra:** `origin/main` = `b7880db80707af65480b90ae00c89a3959cef540` · 2026-09-28T22:52:58Z (J2, equipo de Javier)

## Qué pasaba

`GET /admin/customers/:id/whatsapp` (SCRUM-1062) existía y la sonda AST de SCRUM-1185
(`scripts/_censo-sin-consumir.mjs`) lo daba SIN consumidor. SCRUM-1062 se cerró con «servidor solo
(falta la pestaña)». El profesional tenía que ir documento por documento para saber si un WhatsApp
se entregó, se leyó o falló.

## Qué cambia (sólo front)

- `public/dashboard/js/customerDetailView.js`: `WHATSAPP_CLIENTE` (textos, `tituloPestana`,
  `documento`) y la cuarta pestaña de la ficha, «WhatsApp (n)». Columnas Fecha · Documento · Estado;
  el estado es el chip de WA-0b (`waDeliveryChip`) sin tocar; «Ver más mensajes» pide la página
  siguiente con `despuesDe`.
- Se pide en paralelo y aparte: si falla, la ficha sale entera sin esa pestaña. Sólo para el rol
  `admin` (la ruta es `requireRole('admin')`): a un técnico ni se le pide ni se le pinta.
- El número del documento sale de las listas que la ficha ya tiene; si no está, el tipo sin número.
  Nunca el id interno.
- **No se pinta**: `error` (texto crudo de Meta, en inglés) ni `templateName` como texto.
- `scripts/_sin-consumir-declarados.json`: la ruta pasa a `retiradas`.

Textos firmados en SCRUM-1133 comentario 17448 (registro
`docs/microcopy/2026-09-28-SCRUM-1133-whatsapp-del-cliente.md`), con sus dos condiciones:

- **① «(n+)».** El tamaño de página lo decide el servidor, así que no se escribe ningún 20: la
  pestaña pinta lo cargado, «WhatsApp (n+)» con más páginas, igual que «Trabajos (n+)» de SCRUM-980.
  Lo aprobó el orquestador en su orden de relevo del 29-sep-2026.

## 🔴 Por qué falta la línea del cliente de baja, y adónde ha ido

La firma incluía «Se dio de baja de WhatsApp: no se le envían mensajes.» con la condición ②: que
fuera verdad, medida ejecutando. **No lo es.** `isWaOptedOut` sólo se consulta en 2 de los 8 envíos
de WhatsApp (`sendWhatsAppTemplate` y `sendWhatsAppWindowFirst`); el corte de la plantilla va
condicionado a `params.merchantId &&`; y si la consulta falla, NO bloquea: el corte falla ABIERTO.

Así que la línea **no se publica**: ni está en `TEXTOS`, ni se pinta aunque la respuesta traiga
`waOptOut: true`, ni está en la tabla de textos aprobados. El hallazgo tiene ticket propio,
**SCRUM-1262**, con un matiz que hay que medir antes de llamarlo agujero: parte de esos 6 envíos
pueden ser respuestas del bot a quien escribió primero. Esta pestaña no toca el canal (regla 28).

El caso 4 del test ahora exige lo contrario que antes: con `waOptOut: true` en la respuesta (positivo
con el mismo token), la ficha NO afirma la baja. Y el 8.º (textos firmados) sigue en verde sin ese
texto, y cae si vuelve a aparecer en `TEXTOS` antes de que se cierre SCRUM-1262.

## Cómo se prueba

`tests/scrum1133-whatsapp-del-cliente.test.mjs`, sobre la ficha real en el banco de vistas: 8/8.

## Lo que queda fuera

- **yaqu.app: NO VERIFICADO.**
- Todo lo de SCRUM-1262.

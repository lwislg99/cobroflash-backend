# SCRUM-1288 · Dinero en formato es-ES en los avisos y el historial (los tres sitios de S1)

**Medido contra:** `origin/main` = `51d81311b01e19d592ad99a1f1f0817e4121cb55` · 2026-09-29T17:18:35Z

Ticket repartido entre carriles: aquí **solo los tres de S1**. Los de J1 (`invoiceWhatsApp.service.ts`,
`invoicesAdmin.routes.ts`) y J2 (`payBizum.routes.ts`, `mpWebhook.routes.ts`) no se tocan; si otro equipo
escribe su parte, que AÑADA una sección a este fichero, no lo reescriba.

## Rama `scrum-1288-dinero-es-avisos-s1` (S1)

`toFixed(2)` + código de moneda a mano → `formatMoneyEs` (el formateador único, A6.6):

| Sitio | Qué es de verdad |
|---|---|
| `quotes.routes.ts` (`POST /quote/create`) | WhatsApp de texto libre al propietario «Nuevo presupuesto … pendiente de tu aprobación» |
| `sendQuote.service.ts` (`recordCustomerEvent`) | línea del **historial** del cliente al enviar por WhatsApp |
| `quotesAdmin.routes.ts` (`POST /:id/send-email`) | línea del **historial** del cliente al enviar por email |

**Corrección al inventario del ticket (lo escribí yo en SCRUM-1277):** los dos del historial no son avisos
por WhatsApp: son el `detail` de `recordCustomerEvent`, que la ficha del cliente pinta tal cual
(`customerDetailView.js`). Nadie parsea ese texto (medido: `quote_sent` solo se usa para el icono). Las
filas ya guardadas conservan «1234.50 EUR»: no se reescribe historia.

**No es STOP de plantilla:** el primero es `sendWhatsAppText` (texto libre, no plantilla de Meta); los otros
dos no salen por WhatsApp.

## Test — `tests/scrum1288-dinero-es-en-avisos-s1.test.mjs`

Lee lo que sale de verdad, con importe de MILES (1.234,50 €): el WhatsApp del `__waDryRunOutbox` tras
`POST /quote/create` por su manejador (técnico con umbral de aprobación), y la fila que se escribe en
`customerEvent` por `sendQuoteWhatsAppToCustomer` y por `POST /:id/send-email`. Control: dos importes
distintos salen distintos y el de 1277 sigue diciendo 363,00 € (el mensaje real de 1277 lo sigue
vigilando `scrum1277-aviso-importe-aceptado`).

**Rojo contra `51d81311`: 3/3** — «por 1234.50 EUR pendiente de tu aprobación», «el historial dice
1234.50 EUR».

## Pendiente de otros carriles

- J1: `invoiceWhatsApp.service.ts:137`, `invoicesAdmin.routes.ts:306-361` (regla 40: se lee el camino de emisión).
- J2: `payBizum.routes.ts:197`, `mpWebhook.routes.ts:200`.
- S3: el guard que cace `toFixed` junto a un literal de moneda (aceptación 4).

# SCRUM-1277 · El aviso «X aceptó tu presupuesto por N» dice el importe que el cliente aceptó

**Medido contra:** `origin/main` = `d2451dbe39f38afc2116e11ce87f5d57c7f1458d` · 2026-09-29T16:19:56Z

Carril S1 · rama `scrum-1277-aviso-importe-aceptado`. Sale de la auditoría del viaje «el cliente acepta
un presupuesto» (hallazgo H2, ver SCRUM-1276).

## El defecto (medido por la ruta real)

Presupuesto con tramos, fila en 121 €, el cliente elige el tramo de 363 €. La fila y la respuesta decían
363; el WhatsApp al profesional decía «✅ … aceptó tu presupuesto … por `121.00 EUR`». Dos fallos en la
misma línea (`quotes.routes.ts:706` en `d2451dbe`): leía `quote.total` —la fila de ANTES del `update`
que aplica el tramo— y escribía el número a mano en formato inglés.

## Arreglo

`amount = formatMoneyEs(updatedQuote.total, updatedQuote.currency)`. `updatedQuote` es la fila que dejó
el `update` (el mismo origen del que tira el Trabajo, `ensureJobForQuote`), y `formatMoneyEs`
(`core/utils/utils.ts`) es el formateador único de dinero para el cliente (A6.6): «363,00 €».

**No es STOP de plantilla:** el importe es el VALOR de una variable. El texto libre lo compone el código,
y en el respaldo con ventana cerrada viaja como el parámetro `detail` de `merchant_alert_es`; el
redactado de la plantilla aprobada en Meta no cambia.

## Test — `tests/scrum1277-aviso-importe-aceptado.test.mjs`

Entra por `POST /quote/:token/decision` (`dist`), base doblada, WhatsApp en dry-run, y LEE el mensaje
que sale de `__waDryRunOutbox`. Tramo mayor (121→363), tramo menor (363→121), **control positivo** sin
tramos (1.234,50 €) y formato es-ES.

**Rojo medido** contra el código de `d2451dbe`: 4/4 caen — `'121.00 EUR'` donde se espera `'363,00 €'`
y `'363.00 EUR'` donde se espera `'121,00 €'`. Con el arreglo, 4/4 verdes; guards 237/775/976 y vecinos
de la ruta de decisión: 61/61.

## Fuera de alcance (anotado, NO arreglado de paso)

El mismo formato inglés a mano (`toFixed(2)` + código de moneda) sigue en otros avisos al profesional:
`payBizum.routes.ts:197`, `mpWebhook.routes.ts:200`, `invoiceWhatsApp.service.ts:137`,
`sendQuote.service.ts:122`, `quotesAdmin.routes.ts:758`, `quotes.routes.ts:247` e
`invoicesAdmin.routes.ts:306-361`. Se reporta al orquestador para ticket propio.

## Verificación en yaqu.app

Pendiente tras el merge: el aviso sale por WhatsApp al teléfono del merchant; con la cuenta QA se mira
el `<meta name="yaqu-build">` para confirmar el despliegue.

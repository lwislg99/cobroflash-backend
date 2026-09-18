# SCRUM-931 · UN SOLO IMPORTE DE PLANTILLA: el cliente leía «419.87 EUR» en siete sitios y tres canales

**Fecha:** 18-sep-2026 · **Carril:** S1 · **Gate:** STOP con GO (empujar = desplegar; toca facturas y peticiones de pago)
**Medido contra:** `origin/main` = `16733a223b3d09d3fdf03bf03c67a2b278b4906c` · 2026-09-18T06:38:46Z
**Tanda:** pendiente de turno (se anota aquí al correrla)

El PASO 0 (17-sep-2026, contra `fa9ff832e5d64a60ea9ef50bf863e138ef4de423`) está entero en el
comentario de Jira del ticket. Aquí va lo que se decidió, lo que se hizo y cómo se comprobó.

---

## El defecto

Los builders de `src/integrations/whatsappTemplates.ts` nacieron para que ningún llamante armara
los componentes por su cuenta. Centralizaron el **número de variables** —lo que Meta comprueba— y
dejaron a cada llamante el **formato del importe**, que Meta no comprueba. Los siete productores
lo escribían a mano:

```ts
totalWithCurrency: `${Number(quote.total).toFixed(2)} ${quote.currency}`   // → «419.87 EUR»
```

| plantilla | productor |
|---|---|
| `quote_decision_es` | `sendQuote.service.ts` |
| `quote_decision_es` (recordatorio) | `reminder.service.ts` |
| `payment_request_es` | `invoiceWhatsApp.service.ts` |
| `payment_request_es` (recordatorio) | `invoiceReminder.service.ts` |
| `payment_request_es` (manual) | `invoicesAdmin.routes.ts` |
| `payment_confirmation_invoice_es` | `psp.routes.ts` |
| `payment_confirmation_invoice_es` | `mpWebhook.routes.ts` |

Y el mismo presupuesto salía también por **correo** (`email.service.ts`), con el mismo crudo en el
sitio más visible del mensaje.

Lo peor no era el punto decimal: era que **el mismo importe, al mismo cliente, salía en dos formas
según el camino.** En varios envíos el texto de ventana ya iba en español y la plantilla no (o al
revés, en `invoiceReminder`: el botón en español y el texto de al lado en crudo). La diferencia no la
decidía nadie.

---

## La decisión: cerrar la puerta, no parchear siete sitios

**El importe entra en los builders como `amount: number` + `currency: string`, y la forma se da
DENTRO, con `formatMoneyEs`.** No hay una función nueva: `formatMoneyEs` (`core/utils/utils.ts`) ya
era la forma de la casa para dinero client-facing (A6.6), y su propio comentario dice «nunca
"2383.70 EUR"». No entra una cuarta forma de escribir dinero (los trinquetes de SCRUM-636/743
exigen tres y siguen verdes).

La razón de hacerlo por tipo y no con un guard: mientras la propiedad fuese `string`, formatear era
una costumbre del llamante, y el octavo sitio la rompería sin que nada cayera (la trampa del
«tercer sitio» de SCRUM-577 y SCRUM-929). Con `amount: number`, **el compilador rechaza la cadena
hecha a mano**: el octavo sitio no puede nacer sin que `tsc` lo diga.

Dentro de cada envío, el texto libre de ventana usa la **misma variable** que la plantilla (`importe`),
de modo que los tres caminos de un envío (texto, botón de ventana, plantilla) ya no pueden divergir.

### Alcance, y lo que se declara como ensanche

Decidido por el orquestador el 17-sep: los **siete de WhatsApp** + el **correo**. El panel NO.

⚠️ **Declarado:** al unificar la variable dentro de cada envío cambian también de forma **cinco textos
libres de WhatsApp al cliente** que iban en crudo y que no están en la tabla de los siete (son el
mismo envío por la ventana de 24 h): el texto de ventana y el botón de ventana de
`sendPaymentConfirmationInvoice` (lo usan psp y mpWebhook), el texto de ventana y el texto de
respaldo de `invoiceReminder`, el texto de ventana de `invoiceWhatsApp` y el texto de respaldo de
`invoicesAdmin`. **Solo cambia cómo se escribe el número; ni una palabra del copy.** Dejarlos en
crudo habría sido justo la divergencia que el ticket viene a cerrar. El orquestador decidió el
18-sep que el ensanche se queda dentro, con la condición de que lo de «ni una palabra» esté MEDIDO.

**Medido, fichero por fichero, por AST** (`tests/banco-scrum931/copy-por-ast.cjs`): se sacan todos los
literales de texto de los diez ficheros de `src/` en la base (`7340d331`) y en el arreglo
(`d7d83e04`), fuera de comentarios; en cada plantilla, la expresión del importe se cambia por un
marcador (y la pareja vieja `importe divisa` cuenta como el mismo hueco), y se comparan los
multiconjuntos. **759 literales en la base. Diferencias: las 3 rutas de `import` nuevas y 8
plantillas que eran SOLO el importe (`${…toFixed(2)} ${cur}`) y desaparecen. Ni una frase distinta.**
Control positivo: con `MUTAR=1` se cambia una sola palabra («Hemos confirmado» → «Confirmamos») y el
instrumento la saca como diferencia; sin ese control, un «idénticos» podría ser un instrumento ciego.

---

## Verificado en rojo, y que cada test mira lo suyo

**1 · Sin el arreglo** (`src/` de la base, test nuevo presente, recompilado): **caen 20 de 25.** Los 5
que quedan verdes son los suelos, que es lo que deben hacer.

⚠️ Ese rojo, solo, no basta: los tests de los builders caen en la base porque reciben `amount` y el
builder viejo espera la cadena (sale `undefined`), no porque midan el formato. Por eso:

**2 · Mutaciones puntuales sobre el código YA arreglado**, una a una, recompilando cada vez:

| mutación | qué cae | qué NO cae |
|---|---|---|
| `buildQuoteDecision` vuelve a `toFixed` | los 3 de `quote_decision_es` que miden el formato (419,87 · millar · MXN) | su validador de Meta, y los otros tres builders |
| el correo vuelve a componer a mano | solo «el correo manda el importe en la forma de la casa» | todo lo demás |
| `buildPaymentRequest` acepta otra vez `amountWithCurrency?: string` | solo «LA PUERTA: ninguna plantilla acepta el importe YA formateado» | |
| `reminder.service` pasa un `toFixed` en el argumento | solo «TRINQUETE: ningún productor formatea el importe por su cuenta» | |

Cuatro mutaciones, cuatro caídas distintas y solo por su nombre: los tests no son el mismo verde
repetido. Revertido todo: **44/44** en los dos ficheros.

**3 · Lo que da `formatMoneyEs`, medido en el `dist`:** `419.87 EUR` → `419,87 €` · `1234.5` →
`1.234,50 €` · `1500 MXN` → `1.500,00 MXN` (fuera del euro sale el código, no un `€` impostado) · y
un `Decimal`/cadena da lo mismo que el número. El espacio es U+00A0.

---

## Por qué el `€` no es un riesgo sin medir

Meta **no** valida el formato de una variable contra su muestra (PASO 0, punto 3, con la doc): los
códigos del enunciado original eran de CANTIDAD (#132000) y de plantilla inexistente (#132001). Y lo
cierra un envío que ya se hace: `payments/disputes.service.ts:111` manda hoy la salida de
`formatMoneyEs` —con `€` y U+00A0— como `{{3}}` de `merchant_alert_es`, plantilla aprobada, en
producción; y la muestra de `payment_request_es` (`350,00 EUR`) ya no coincide con lo que el código
mandaba (`419.87 EUR`), y funciona.

**Lo que NO se ha podido mirar, y se dice:** no se ha mandado ningún mensaje real con `€` por
`quote_decision_es`, `payment_request_es` ni `payment_confirmation_invoice_es`. Hace falta número y
permiso del fundador. Lo que hay es la documentación y el envío de `merchant_alert_es`.

---

## Lo que NO cubre

* **El panel** (`CustomerEvent.detail`): sigue en crudo en `sendQuote`, `quotesAdmin`,
  `invoiceWhatsApp`, `mpWebhook` y `psp`, mientras `maintenance.service.ts` ya usa `formatMoneyEs`.
  Fuera por decisión del orquestador; queda apuntado en Jira.
* **`merchant_alert_es`** (aviso al PRO): tres productores en crudo (`quotes.routes`,
  `payBizum.routes`, `mpWebhook.routes`) y uno en español (`disputes.service`). Va al profesional, no
  al cliente; mismo criterio que el panel.
* **El correo tiene una garantía más débil que WhatsApp**: no hay builder al que ponerle un tipo; lo
  vigila un guard de texto sobre `email.service.ts`, y se dice así en el propio test.
* **`sendPaymentConfirmation`** (la vieja, `payment_confirmation_es`) no tiene llamadores; se adapta
  su firma para que compile y no se decide aquí si se retira.
* **Ninguna plantilla de Meta se toca**: ni estructura, ni número de variables, ni orden. Solo el
  valor de una variable de texto.

---

## Ficheros

* `src/integrations/whatsappTemplates.ts` — los cuatro builders: `amount` + `currency`, forma dentro.
* `src/integrations/whatsappNotifications.ts` — `sendPaymentConfirmation*` en bruto; una sola forma
  para texto, botón y plantilla.
* Los siete productores + `src/modules/messaging/domain/email.service.ts`.
* `tests/scrum931-un-solo-importe-de-plantilla.test.mjs` — 25 tests, sin base y sin gate.
* `tests/banco-scrum931/copy-por-ast.cjs` — la medición de «ni una palabra de copy» (no entra en
  `npm test`: compara dos commits fijos, es la prueba de esta entrega y no un guard).
* `tests/whatsappTemplates.test.mjs` — adaptado al contrato nuevo (su «sale tal cual» era el defecto
  escrito como garantía).

# SCRUM-1436b · El recordatorio manual nombra el documento por su número

> Este tramo es **SCRUM-1436b**: sólo la parte de J1 del hallazgo 2 del ticket. Los hallazgos 1 y 3
> son de J2 y van en su propia rama, con su propio tramo en este fichero. Por eso hay dos tramos.

**Medido contra:** `origin/main` = `12ecc7bb3bad377e729a01b09fd755f978e125b9` · 2026-10-07T15:47:30Z

A9: comprobación → `tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`

Sesión J1 (`jv-j1`, 7-oct) · rama `scrum-1436b-el-recordatorio-nombra-por-el-numero`. Encargo del
orquestador de Javier, sobre lo que midió el equipo de Luis en SCRUM-1436.

## El defecto

`POST /admin/invoices/:id/send-reminder` manda al cliente, cuando el documento no tiene cobro, un
texto libre. Ese texto decía «el pago de la factura *N*» escrito a mano, también para un `J-…`, que
es un justificante y no una factura (reglas 24 y 26).

Visto ejecutando la ruta real de `dist/` (base doblada, WhatsApp en dry-run), antes de tocar nada:

    J-2026-0007 → «…tienes pendiente el pago de la factura *J-2026-0007* por *419,87 €*…»
    F260007     → «…tienes pendiente el pago de la factura *F260007* por *419,87 €*…»

## El arreglo

Una línea, en `src/modules/system/app/routes/invoicesAdmin.routes.ts`: la palabra la decide
`isReceiptNumber(invoice.number)`. Es el criterio que ya usan los otros dos emisores del mismo
documento (`invoiceWhatsApp.service.ts` y `invoiceReminder.service.ts`); el fichero ya lo importaba.
No hay criterio nuevo.

La forma es la acordada en el comentario 18287 del ticket: el artículo va dentro de la etiqueta,
«de la factura» / «del justificante». Ese comentario lo escribió la cuenta de Luis; aquí se cita
como la forma acordada, no como firma del fundador. Para una factura la frase no cambia ni una
letra, y el test lo comprueba entera.

No se ha tocado el camino de emisión: el cambio está dentro del handler del recordatorio y no
mueve ninguna línea del fichero (1 insertada, 1 borrada).

## El test

`tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`, 5 casos, por la ruta real:

| caso | antes del arreglo | después |
|---|---|---|
| SUELO: sin cobro sale un texto libre | pasa | pasa |
| 🔴 un `J-…` se llama «justificante» y no «factura» | **cae** | pasa |
| ✅ una factura dice «factura», con la frase entera de siempre | pasa | pasa |
| la palabra coincide con `isReceiptNumber` sobre 7 números (3 justificantes, 4 facturas) | **cae** | pasa |
| CONTROL: con cobro sigue yendo por la plantilla | pasa | pasa |

Antes: 5 casos, 3 pasan, 2 caen. Después: 5 casos, 5 pasan, 0 caen.

## Mi error

El positivo cayó la primera vez sobre el código SIN tocar. El importe lleva un espacio de no
separación (U+00A0) y yo lo había escrito en el test como un espacio normal: dos cadenas que en
pantalla son iguales. Lo delató que un caso que tenía que pasar cayera, no leerlo. Ahora el test
saca el importe del helper de la casa (`formatMoneyEs`) y comprueba su forma antes de usarlo.

## Lo que NO lleva

- **El camino con cobro.** Ahí el recordatorio va por la plantilla `payment_request_es`, cuyo texto
  es de Meta. No se ha mirado qué palabra lleva esa plantilla para un justificante.
- **El recordatorio automático** (`invoiceReminder.service.ts`, «el pago del factura»): es de J2.
- **La otra rama del hallazgo 2:** el recordatorio manual con cobro manda siempre la plantilla, sin
  probar antes la ventana abierta. No se ha tocado.
- **No se ha visto en yaqu.app.** Pide una sesión con un justificante sin cobro y un cliente con
  teléfono.
- **Tipos:** el build local es `--noCheck`. Los tipos los comprueba el CI.

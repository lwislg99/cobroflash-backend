# SCRUM-1243 · El correo de la factura que falla ANTES de Resend también deja fila

**Medido contra:** `origin/main` = `51d81311b01e19d592ad99a1f1f0817e4121cb55` · 2026-09-29T17:26:09Z (J1, `jv-j1`)

## 0 · El permiso

GO del fundador: **SCRUM-1243, comentario 17582** (según el orquestador, `cobroflash-backend-47`).

⚠️ **J1 NO lo ha leído.** La sesión corre en segundo plano y su conector de Jira pedía autenticación
interactiva. El orquestador le pasó el contenido por mensaje; la copia literal de ese permiso a este
fichero **no la hace J1** porque no puede verificarla de primera mano: queda pendiente para quien sí
pueda abrir el comentario. Lo que J1 ha aplicado como límites es lo del encargo: la respuesta al
proveedor no cambia, no se toca la emisión ni el sellado, y nada más del camino de cobro que lo
estrictamente necesario para dejar la fila.

## 1 · El defecto

`sendInvoiceEmail` (`src/modules/messaging/domain/email.service.ts`) llamaba a `ensureInvoicePdf`,
leía el PDF del disco y, si no había PDF, lanzaba `invoice_pdf_unavailable` — todo ANTES de llamar a
`enviarPorResend`, que es quien escribe la fila del envío. En el envío automático tras el cobro
(`psp.routes.ts`, `mpWebhook.routes.ts`) esa excepción muere en un `console.error`. Sin fila, el aviso
de Cobros de SCRUM-1235 no sale.

Rojo ANTES del cambio (sección ⑥ de `tests/scrum1235-el-correo-que-no-salio.test.mjs`, por el camino
real: webhook de `psp.routes` → `sendInvoiceEmail` → `registrarEnvio` → `listarCobrosConCorreo`):
**4 fail** — con el PDF ausente y con `ensureInvoicePdf` lanzando, **0 filas** en `email_messages`.

## 2 · El cambio (un solo fichero de código)

En `sendInvoiceEmail`:

- El contexto de la fila (`registro`) pasa a ser UNA constante, usada por los dos sitios que escriben
  la fila de este correo: el fallo previo y `enviarPorResend` (shorthand `registro`). Mismo contenido
  que antes.
- Un `try` envuelve **solo la preparación del adjunto** (`ensureInvoicePdf` + lectura + el
  `invoice_pdf_unavailable`). En su `catch`: `registrarEnvio` con `constanciaDeFallo(e)` y se
  **relanza la misma excepción**.

**El discriminante es el SITIO, no el mensaje.** El envío a Resend queda fuera del `try`, así que su
fallo no pasa por ese `catch`: no puede escribir dos veces. Ningún `if` mira el texto del error —
cualquier excepción de esa etapa deja su fila, se llame como se llame (el caso `revienta` del test
lanza un `EACCES`, no `invoice_pdf_unavailable`).

**Solo con `RESEND_API_KEY`.** Es el camino en el que un envío bueno deja fila y apaga el aviso. En el
respaldo SMTP/outbox de dev el éxito no escribe fila, y una fila de fallo sin su «salió» avisaría
para siempre. En producción siempre hay `RESEND_API_KEY`.

**Lo que NO cambia:**

- `psp.routes.ts` y `mpWebhook.routes.ts`: **no se tocan**. La respuesta al proveedor es la misma
  (test: 200 `paid` con el fallo previo).
- La emisión y el sellado: `ensureInvoicePdf` se sigue llamando igual, con los mismos argumentos; sólo
  se envuelve su llamada para registrar el fallo. `lib/invoicing.ts` no se toca.
- La semántica de fallo: `sendInvoiceEmail` sigue lanzando la misma excepción (test dedicado).
  `registrarEnvio` no lanza ni se cuelga (SCRUM-501).
- `email_messages` se sigue escribiendo solo desde `registroDeEnvios.ts` (scrum508 verde).

Además, solo comentarios/registro: `cobros.service.ts` (el comentario de `correoNoSalio` decía que el
fallo previo no dejaba fila) y una línea añadida al hueco 1 de `docs/master/SCRUM-1235.md`.

## 3 · Hueco declarado: `invoice_not_found`

**No se tapa**: si la factura no existe no hay `merchantId`, y la columna es `NOT NULL`.
`registrarEnvio` devolvería `sin_contexto`, y pasar el merchant desde las rutas sería tocar el camino
de cobro más allá de lo estrictamente necesario. En el envío automático además no se da: la factura
acaba de devolverla `ensureInvoiceForCharge`. Inventar un merchant sería peor que no tener la fila
(cabecera de `registroDeEnvios.ts`).

## 4 · Verificación

`tests/scrum1235-el-correo-que-no-salio.test.mjs`, sección ⑥ (el banco de SCRUM-1235 con una opción
`pdf` nueva — `ok` / `falta` / `revienta` — y un contador de POST a Resend; no un segundo banco):

| Caso | Qué fija |
|---|---|
| fallo previo, `pdf: falta` | 0 POST a Resend, **1** fila `fallo_envio` (invoice, 7000, merchant, `providerId` nulo), el aviso sale, webhook 200 `paid` |
| fallo previo, `pdf: revienta` | ídem con una excepción cualquiera de `ensureInvoicePdf` |
| Resend falla | 1 POST, **exactamente 1** fila — no dos |
| todo sale | 1 fila, no de fallo |
| justificante `J-…` con fallo previo | `kind: justificante`, aviso como justificante |
| `sendInvoiceEmail` directo | sigue rechazando con `invoice_pdf_unavailable`, y deja 1 fila |

Tras el cambio: 18/18 en el fichero.

**Rojo visto en las dos mitades (mutaciones con el código quieto, restauradas después):**

- M1 · escribir también la fila cuando Resend falla (el duplicado) → cae **«NO HAY DOS FILAS»** (y dos
  casos de SCRUM-1235 que cuentan filas).
- M2 · quitar el `registrarEnvio` del `catch` → caen los **4** casos de fallo previo.
- M3 · fijar `kind: factura` en la fila previa → cae el caso del justificante.

Guards de suite corridos en verde: scrum508, scrum501, scrum475, scrum206, scrum72, scrum931.

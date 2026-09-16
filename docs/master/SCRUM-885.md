# SCRUM-885 · El cobro a un cliente sin email: el documento no salía y el profesional no se enteraba

**Medido contra:** `origin/main` = `4b0d5739bc19e7bad5109a32822ef7039d9ca860` · 2026-09-16T13:36:13Z
**Rama:** `scrum-885-cliente-sin-email` · **Estado:** EN CURSO — falta la mitad de la vista (ver «Lo que falta»)

## PASO 0 · medido corriendo, en local (nunca producción ni staging)

Postgres desechable propio (`127.0.0.1:55885`, base `yaqu_885_test`, esquema por `migrate diff
--from-empty` con el CLI local), `node dist/index.js` con `AUTO_INVOICE_ON_PAID` y
`AUTO_EMAIL_INVOICE_ON_PAID` encendidos y sin ninguna clave externa. «Confirmar Bizum recibido» con
la sesión del profesional sobre tres cobros.

**La primera pasada NO llegó al envío** (líneas de presupuesto mal formadas en la semilla →
`factura_sin_lineas`, sin factura): se contó como «no pude mirar» y se rehízo el banco.

| | sin email ni teléfono | solo teléfono | con email (control positivo) |
|---|---|---|---|
| Factura emitida | F260001 | F260002 | F260003 |
| ¿Se intenta el email? | **no** | **no** | sí — `invoice-F260003.eml`, `To:` el cliente |
| ¿Queda algo? | **nada**: ni evento, ni fila, ni log | nada del email (sí el intento de WhatsApp) | evento `emailed` |
| Respuesta al profesional | `{"ok":true,"status":"paid"}` | igual | igual |
| Pantalla | toast fijo «✓ Bizum confirmado: factura cobrada.» | igual | igual |

El detalle del trabajo y el de la factura eran idénticos con y sin email salvo el propio email. Causa:
`psp.routes.ts:199`, `AUTO_EMAIL_INVOICE_ON_PAID && customer.email` no entra y no deja nada. Todos
los caminos de cobro (Bizum manual, Stripe, Connect, recibo) desembocan en ese webhook.

## Decidido (orquestador, 16-sep-2026)

1. **Opción (b):** se avisa SOLO si el documento no salió ni por email ni por WhatsApp. El WhatsApp
   vale si su fila dice enviado o más (`SENT_OR_MORE` de `whatsappLog.service.ts`, que incluye
   `read`: es la definición de la casa, no una nueva). Fallido —ahora o después, por el webhook de
   estado— o sin intento, no cuenta.
2. **Dos sitios:** la respuesta de «Confirmar Bizum» (toast) y, permanente, la fila de la factura del
   trabajo. Calculado de lo ya guardado, una sola regla para dashboard y test.
3. **Con `AUTO_EMAIL_INVOICE_ON_PAID` APAGADO no se avisa.** Ese caso —no le llega a NADIE— es otro
   problema y NO es de este ticket. El valor de producción lo mira el fundador.

**Literal firmado:** «El documento no se ha enviado: el cliente no tiene email. Añade su email en su ficha y envíaselo.»

## Commits

| sha | qué |
|---|---|
| `61a6cbdcc63260597d792724bec0040c540a7dd5` | el ROJO: cae hoy por aserción en 3 casos, con el suelo de emisión cumplido |
| `11ca3d1e4ebce690b4d36ef8de2edfe2b64068e3` · 2026-09-16T14:01:03Z | hechos + regla: 7/7 verde |

### El rojo, sobre el código de `4b0d5739`

`tests/scrum885-documento-sin-enviar.test.mjs` conduce los handlers REALES (`confirm-bizum` → `psp`
por su «red» → `GET /admin/jobs/:id`) con base, emisión, correo y WhatsApp doblados. Hoy:
**3 ✖ por aserción** (sin email ni WhatsApp: «la respuesta de Confirmar Bizum no deja aviso visible»;
WhatsApp fallido; fallo posterior) y 4 ✔ (con email, WhatsApp enviado, flag apagado, ningún envío
nuevo). Suelo: si el cobro no emite el documento, falla «NO PUDE MIRAR».

### Lo construido

* `src/modules/billing/domain/envioDelDocumento.ts` — los HECHOS: `autoEmail`
  (`AUTO_INVOICE_ON_PAID` **y** `AUTO_EMAIL_INVOICE_ON_PAID`, las dos condiciones con las que psp
  envía), `clienteTieneEmail`, `whatsapp` ∈ `enviado | no_enviado | sin_intento | en_curso`.
  `no_enviado` incluye `failed` y un `queued` que no avanzó.
* `confirm-bizum` devuelve `envioDocumento`. psp lanza el WhatsApp sin `await`, así que al volver
  puede no haber fila: se espera **como mucho 3 s** y sólo si el aviso depende de ello (sin email y
  con número). Si no llega → `en_curso`, que **no avisa** en el toast; la fila del trabajo, que se
  relee, dirá lo que acabe pasando. Consecuencia declarada: un cliente con número y baja de WhatsApp
  (J3, sin fila) no avisa en el toast pero sí en la fila.
* `GET /admin/jobs/:id` — cada factura con cobro **pagado** lleva `envioDocumento` (`null` si no).
  Dos consultas para todas, filtradas por `merchantId` (regla 2).
* `public/dashboard/js/avisoDocumentoSinEnviar.js` — la regla y el literal firmado.
* **`psp.routes.ts` no se toca. Ningún envío nuevo. Sin schema. El camino de emisión, intacto.**

## Lo que falta (traspaso)

1. `jobDetailView.js`: pintar `avisoDocumentoSinEnviar(inv.envioDocumento)` en la fila de la factura
   (`invoices.forEach`, ~l. 1791) y usar `avisoDocumentoSinEnviar(respuesta.envioDocumento)` en el
   toast de «Confirmar Bizum» (~l. 1863), reutilizando un componente de aviso del inventario AB3
   (yaqu-premium-ui). También `invoiceDetailView.js:560`, que llama al mismo endpoint.
2. Cargar el script en `public/dashboard/index.html` antes de `jobDetailView.js`, y lo que pidan los
   guards de la lista de scripts y del `SHELL` del service worker.
3. Añadir al test la atadura vista↔regla (por AST/`_solo-codigo`, no `grep`).
4. Suite completa, rojos por mutación (quitar `no_enviado` de la regla; quitar el filtro `paid`),
   QA visual, entrada del literal en la microcopy aplicada, PR.

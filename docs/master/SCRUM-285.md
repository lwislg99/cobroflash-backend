# SCRUM-285 · B4 — CENSO de las acciones que tocan el cobro desde la vista de factura

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate — solo lee ficheros y parsea el AST; ni BD ni red
**Medido contra:** `origin/main` = `193f9a4d2f46c0b7c15e55784408f6bf3da28976` · 2026-08-05T00:04:02+01:00
**Tanda:** 1347 tests, 1280 pass, 0 fail, 67 skipped (`npm test`, exit **0**)

## Qué entrega, y qué NO

**NO separa nada.** La construcción de B4 (mover cobros al menú `Cobros`) necesita **B1** (la entrada
de menú), que sigue parada. Esto es el **CENSO**: enumerar las acciones que TOCAN EL COBRO desde la
vista de factura, con su destino, para que cuando se separe **ninguna se pierda** — «o se queda en la
factura, o se muda al cobro». El riesgo que B4 declara: hoy hay cobro dentro de la factura (Marcar
como PAGADA, Confirmar Bizum, Recordar pago); al separar, una que desaparezca es el fallo mudo.

**La pregunta es distinta a la del 283.** El 283 preguntó «¿está en la vista?». B4 pregunta «¿toca el
cobro?», y se responde por el **ENDPOINT** que llama el handler de cada acción — **NO por el registro**
(está en el registro ≠ toca cobro; por esa vía btnPdf tocaría cobro por llevar un enlace de pago
dentro del documento, y eso es señal de criterio malo). Se mide lo que la acción HACE.

## Población declarada

- **Fichero:** `public/dashboard/js/invoiceDetailView.js`
- **Frontera:** la función `renderInvoiceDetailView` (el cuerpo de la vista)
- **Mido:** el endpoint (`fetch` / `apiRequest` / `window.open`) del handler de cada botón, por AST
- **Excluyo:** la carga (`fetchInvoiceDetail`, no es acción), la navegación (`btnBack`), y los botones
  cuyo endpoint no opera sobre el pago o el charge

## El censo — 4 acciones-cobro, con su destino (DECISIÓN DEL ASESOR)

**Criterio:** una acción toca cobro si su endpoint opera sobre el pago/charge; el **destino sale del
OBJETO** sobre el que actúa el endpoint — `/charges/:id/…` → **Cobros** · `/invoices/:id/…` → **Factura**.

| id | L | endpoint (medido) | objeto | destino |
|----|----|-------------------|--------|---------|
| `btnTogglePaid` | 315 | `/invoices/:id/status` · `/payment-anomaly` | invoice (estado de pago) | **Factura** |
| `btnDispute` | 394 | `/invoices/:id/dispute-package` | **charge** (chargeback) | **Cobros** |
| `btnBizum` | 410 | `/charges/:chargeId/confirm-bizum` | charge | **Cobros** |
| `btnReminder` | 451 | `/invoices/:id/send-reminder` | invoice (deuda a perseguir) | **Factura** |

**No-cobro (6):** `btnBack` (navegación) · `btnPdf` (`/pdf`) · `btnWhatsApp` (`/resend-whatsapp`, `/send-email`)
· `btnRectify` (`/rectify`) · `btnAnular` (su `/annul` vive en el modal, fuera de la vista) · `btnRegen` (`/regenerate-pdf`).

### 🔴 Divergencia medida: `btnDispute`

Su endpoint es `/invoices/:id/dispute-package` — **URL bajo `/invoices/`, no `/charges/`**. Por el atajo
de URL iría a Factura; por el OBJETO (un chargeback es el cobro yéndose para atrás, opera sobre el
charge como Bizum) va a **Cobros**. Es el ÚNICO caso donde la URL y el objeto divergen; manda el objeto.
_(Por qué Bizum-manual y Marcar-pagada van a sitios distintos siendo las dos «registrar un cobro a
mano»: no es intención, es objeto. En Bizum-manual EXISTE un charge; en transferencia/efectivo no hay
charge y el registro se escribe en la factura.)_

### Los bordes, decididos por MEDICIÓN (no intuición)

`btnReminder` aparece **solo en pending** (impagada) → su existencia depende del estado del dinero →
**toca cobro**. `btnWhatsApp` aparece en **pending y paid** → no depende → **no toca cobro**. La
condición de aparición decidió, no la opinión.

## Los cuatro guards — `tests/scrum285-censo-cobro-factura.test.mjs`

- **Huérfana:** una acción cuyo endpoint toca cobro (señal amplia) pero sin regla de destino → falla.
  Cero huérfanas en el árbol; probado con un `/collect-rest` sintético sin destino.
- **Suelo:** si el censo deja de ver acciones-cobro, FALLA (no dice «0 huérfanas»).
- **Rojo por el mecanismo:** cambiar el endpoint de `btnBizum` a `/pdf` lo baja de cobro; el censo cae
  por eso, no por un SyntaxError.
- **Control negativo:** `btnPdf` y `btnWhatsApp` (mueven el documento, no el dinero) no se cuelan.

## Contraste — cobro FUERA de la vista de factura (reportado, NO tocado)

`jobDetailView.js` tiene las MISMAS acciones de cobro duplicadas, más una propia del trabajo:
**Marcar como PAGADA** (`/status`, L1373) · **Confirmar Bizum** (`/charges/confirm-bizum`, L1417) ·
**Recordar pago** (`/send-reminder`, L1435) · **Cobrar el resto** (`/collect-rest`, L244). Cuando B4
separe, estas también son candidatas a `Cobros`. **No se tocan aquí.**

## 🔴 Hallazgo E0 (salió de esta medición; SCRUM-321 Q4 / SCRUM-294 / SCRUM-295)

`btnTogglePaid` → `/status` escribe `paidAt: new Date()`. Rastreado el mecanismo por método:

| Método | `paid` lo escribe… | Sitio |
|--------|--------------------|-------|
| Tarjeta | webhook (evento del proveedor) | `psp.routes.ts:121/167` |
| Bizum checkout (`bizum_auto`) | webhook | `paidVia.ts:42` |
| Bizum manual | acción del usuario (el comercio confirma) | `chargesAdmin.routes.ts:44` |
| Transferencia | **acción del usuario, A MANO** | `invoicesAdmin.routes.ts:243` |
| Efectivo | **acción del usuario, a mano** | mismo `/status` |

**Dos resultados, medidos:** (1) **no existe forma de introducir la fecha REAL del ingreso** —
`updateInvoiceStatusAdmin` (`invoiceAdmin.ts:138`) hace `paidAt = new Date()` y no acepta fecha. (2)
**incluso los webhooks usan `new Date()`** (la llegada), no la fecha del evento del proveedor. Para el
criterio de caja del Modelo 303, la transferencia/efectivo marcados a mano pueden caer en el trimestre
equivocado. Contradice el argumento de venta «sabemos exactamente cuándo entró cada euro» (Bloques A y
E). Es un resultado, no un fracaso.

## Lo que NO toca

El mecanismo de cobro (Bizum/tarjeta/Stripe/conciliación) · el PDF del justificante · `/rectify` y el
back (regla 38) · el modelo de datos · `jobDetailView.js` (contraste, solo reportado) · regla 30.

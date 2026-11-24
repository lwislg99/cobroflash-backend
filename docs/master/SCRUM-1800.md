# SCRUM-1800 · Cancelar un cobro cuyo documento ya consta pagado

**Medido contra:** `origin/main` = `f8dc0244675d00709b896101b97c89bd22468923` · 2026-11-24T02:42:22Z

Carril J2 (`src/modules/billing/**`). Sesión jv-j2ej. Hallazgo de staging de SCRUM-1532 c.22487 (cobro 889).

## ① Medición (solo lectura, 24-nov-2026, `docs/master/evidencias/SCRUM-1800/` no la guarda: va aquí)

Consulta: cobros `pending` y su documento con el criterio de `facturaDelCobro` y de psp
(`invoices.charge_id` = cobro, o factura del presupuesto con `quotes.chargeId` = cobro), dentro del comercio.
Solo `SELECT`. Producción no se tocó.

| base | cobros por estado | pending con documento | pending con documento `paid` | control positivo (cobro `paid` + documento `paid`) |
|---|---|---|---|---|
| STAGING (`railway`) | cancelled=1 · pending=8 | 8 de 8 | **3 de 8** (890, 891, 893; comercio 2) | 0 filas |
| DEV (`yaqu_dev_javier`) | paid=12 · pending=3 | 3 de 3 | 0 de 3 | 9 filas |
| TESTS | **la misma base que DEV** (`yaqu_dev_javier`): no es una tercera población | — | — | — |

- Los 3 de staging son justificantes `J-20260916-*` (tipo `JUST`), enlazados por `charge_id`, pagados el 16-sep,
  `paid_via` NULL, y su auditoría dice `marcar_pagado_manual` = 3 (ninguna otra acción).
- 889, el del hallazgo, ya está `cancelled`: no entra en los 8 (era el cuarto de los 4 de 9 de la descripción).
  Su `paid_via` = `bizum_manual` viene de la descripción, no lo he releído.
- El control positivo de la consulta es DEV (9 filas): la misma consulta sí ve documentos pagados.
- `comprobar-claves-bd.mjs` no da por buena `DATABASE_URL_TESTS` en este árbol (no está declarada por worktree);
  leí solo su host y su base (`acela.proxy.rlwy.net/yaqu_dev_javier`), que es la de DEV.

**De dónde salen (leído en el código):** el marcado manual de una factura —`PUT /admin/invoices/:id/status`
(`updateInvoiceStatusAdmin`, `src/modules/system/invoiceAdmin.ts`) y `POST /admin/invoices/bulk-paid`—
pone el documento en `paid` y apunta su `invoice_payments`, pero **no cierra el cobro**. Quien cierra los dos es
psp (`/webhooks/psp`, `psp.routes.ts`), y por él pasan `confirm-bizum` y las pasarelas. La auditoría de los tres
casos de staging dice que vinieron del primer camino. Esas rutas son del carril J1 (`invoicesAdmin.routes.ts`,
`invoiceAdmin.ts`): no las toco. Si el marcado manual debería cerrar el cobro es una pregunta para J1 y el fundador.

## ② Lo construido

`POST /admin/charges/:id/cancel` lee en la MISMA consulta del cobro su documento pagado (por `invoices` y por
`Quote.Invoice`, los dos con `merchantId` y `status: 'paid'` en el `where`) y, si existe, contesta
**409 `{ error: 'document_already_paid' }`** antes del `update`. Es un código, no un texto de usuario.
El orden se conserva: 404 → idempotente si ya `cancelled` → `charge_not_pending` → `document_already_paid` → `update`.
La lectura va dentro de `charge.findFirst` para que la ruta siga sin tocar `invoice.*` (lo exige el caso ④ de 1532b).
Lo que NO cubre: un documento que pase a `paid` entre la lectura y el `update`. Esa ventana sigue abierta.

| qué | esperado | visto |
|---|---|---|
| test nuevo antes del arreglo | rojo en los dos casos de documento pagado | 2 de 5 caen (200 en vez de 409) |
| test nuevo con el arreglo | 5 de 5 | 5 de 5 |
| `scrum1532b-cancelar-cobro` | sin cambios | 16 de 16 |
| control: documento sin pagar | sigue cancelando | 200 y una escritura `charge.update` |
| regla 2: documento pagado de otro comercio | no bloquea | 200 |
| mutación del catálogo | VIVA | VIVA, línea base igual antes y después |
| `tsc -p .` con tipos | 0 | 0 |

Test: `tests/scrum1800-cancelar-cobro-con-documento-pagado.test.mjs`, contra la app montada (`_banco-camino-real.mjs`).
Mutaciones: catálogo → `tests/scrum1800-cancelar-cobro-con-documento-pagado.test.mjs`
(pasada con `docs/master/evidencias/SCRUM-1800/mutar.mjs`, `aplicarUna` de la casa).

## ③ El botón de 1532d (PR #3340, carril J1, leído en `1ca2c91c83b772c91743637d463132d96e52684f`, no tocado)

`invoiceDetailView.js` traduce solo `charge_not_pending`. Cualquier otro error, también `document_already_paid`,
pinta el genérico «Error actualizando estado: inténtalo de nuevo». El código nuevo lo hereda, así que no hace falta
un literal para que funcione. Pero ese texto invita a reintentar algo que va a fallar siempre. Además, el botón sale
cuando el cobro está `pending`, sin mirar si la factura ya está pagada. **PROPUESTA para firma (regla 39), no escrita
en código:** «Este documento ya consta como pagado: su cobro no se puede cancelar.» Si se firma, la pone J1.

## ④ El recibo pendiente dice «más arriba» y los botones están debajo

`src/modules/billing/app/routes/receipt.routes.ts:213`, `:215` y `:217` (literales firmados de SCRUM-910 c.16527).
La plantilla pinta `${statusMessage}` en `:402` y los botones (`pay-stack`) en `:403`, o sea, **debajo** del texto.
Leído en el código. **La captura a 390 px NO la hice**: el contexto pasó de 170k antes de llegar. **PROPUESTA para firma**
(cambia solo «que aparece(n) más arriba» por «que aparece(n) a continuación», en los tres):
- «Estamos esperando tu pago. Puedes completarlo usando los botones de <b>pago por banco</b> o <b>pago con tarjeta</b> que aparecen a continuación.»
- «Estamos esperando tu pago. Puedes completarlo usando el botón de <b>pago por banco</b> que aparece a continuación.»
- «Estamos esperando tu pago. Puedes completarlo usando el botón de <b>pago con tarjeta</b> que aparece a continuación.»
Sin firma no se cambia.

## Lo que NO hice

- La suite entera en local: no me cabía en el contexto. Corrí los dirigidos (más abajo) y lo digo antes de empujar.
- La captura a 390 px del ④.
- Nada en staging ni en producción, aparte de los `SELECT`.

A9: aviso → cicatriz J2 «crucé el tope de contexto del encargo antes de empujar: me medí al acabar el arranque (102k) y no volví a medirme hasta el final de la construcción (174k, tope 170k); el ④ se quedó sin captura y la suite entera sin correr» — no se pudo comprobar: la medición del contexto la hace la propia sesión y ningún hook la lee a mitad de tanda

# SCRUM-1800b · El recibo pendiente dice «a continuación»

**Medido contra:** `origin/main` = `3c6c651fecd17adcad2ec6088d1cf44da0110154` · 2026-11-24T06:33:51Z

Carril J2. Sesión jv-j2el, relevo de jv-j2ek: su commit `05d2459f3` se aplicó por cherry-pick sin conflictos, y el mío va encima.
Literales firmados en Jira SCRUM-1800 c.22496 ②.

| qué | esperado | visto |
|---|---|---|
| tres literales de `receipt.routes.ts` | idénticos a c.22496 ② | 3 de 3 casan por bytes en src, en el test nuevo y en 910d |
| test por la ruta montada (`GET /recibo/:token`) | banco · tarjeta · los dos · control pagado/cancelado, con nombres literales | 6 de 6. El WIP construía los nombres en bucles: pasados a `casosEscritos` (scrum1415) |
| scrum910d re-anclado | frase ENTERA, no la cola | sí, con nota que cita c.22496 |
| captura a 390 px del pendiente con banco | texto arriba, botón debajo | `docs/master/evidencias/SCRUM-1800/1800b-recibo-pendiente-banco-390.png`: la nota acaba en y=362 y `.pay-stack` empieza en y=378, con ancho 390 |

Mutaciones: catálogo → `tests/scrum1800b-recibo-pendiente-a-continuacion.test.mjs`. Pasada una vez con
`docs/master/evidencias/SCRUM-1800/mutar-1800b.mjs`: VIVA 1 de 1, con la línea base igual al principio y al final.
`tsc -p .` con tipos: 0. Los vecinos no se corrieron en local: los corre el obligatorio, por orden del orquestador.

A9: comprobación → `tests/scrum1800b-recibo-pendiente-a-continuacion.test.mjs`

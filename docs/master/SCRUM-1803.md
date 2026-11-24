# SCRUM-1803 · Marcar pagada a mano una factura cierra su cobro pendiente

**Medido contra:** `origin/main` = `3c6c651fecd17adcad2ec6088d1cf44da0110154` · 2026-11-24T06:31:54Z

Carril J1 (`src/modules/system/invoiceAdmin.ts`, `src/modules/system/app/routes/invoicesAdmin.routes.ts`).
Sesión jv-j1je, con el plan de jv-j1jd (SCRUM-1803 c.22499). Decisión del fundador: SCRUM-1800 c.22496 ③.
Causa raíz de SCRUM-1800: en staging, 3 de los 8 cobros `pending` tenían su documento en `paid`, los tres
marcados a mano (medición de jv-j2ej, `docs/master/SCRUM-1800.md`).

## ① Medición (de jv-j1jd, c.22499; no repetida)

- Vínculo factura↔cobro: `Charge` no tiene campo de factura; el único vínculo DIRECTO es `Invoice.chargeId`.
  Lo escriben `invoiceWhatsApp.service.ts` (crea el cobro `pending` al mandar la factura) y
  `src/lib/invoicing.ts` (`ensureInvoiceForCharge`). Indirecto: `Quote.chargeId`.
- Quién escribe `Invoice.paidAt` — población: 83 `.ts` de `src/modules/system`, `src/modules/invoicing` y
  `src/lib/invoicing.ts`; 4 escrituras: `bulk-paid` (a mano), `updateInvoiceStatusAdmin` desde
  `PUT /admin/invoices/:id/status` (a mano), `POST /invoices/:id/paid-webhook` (webhook) y el alta de la R1
  (camino de emisión, no es un pago). Ninguna de las cuatro tocaba `Charge`.

## ② Lo construido

- `cerrarCobroDeFacturaPagada` en `src/modules/system/invoiceAdmin.ts`: `prisma.charge.update` con
  `where: { id: chargeId, merchantId, status: 'pending' }` y `data` de la función de la casa
  `datosDeCobroPagado(fecha, payload)` (estado, `paidAt` y evento `paid` en un instante). Un cobro `paid`,
  `cancelled` o `expired` no casa (P2025 → «no había pendiente») y se queda como estaba, sin leerlo antes.
  `update` y no `updateMany`: `datosDeCobroPagado` lleva `events.create` anidado.
- `method`: solo si el profesional lo declaró (`paidVia`, ya filtrado por `campoPaidViaAlMarcar`) y
  `esMetodoValido` lo reconoce; si no, se conserva el del cobro.
- `PUT /:id/status`: en `updateInvoiceStatusAdmin`, al pasar a `paid` desde otro estado, con
  `fecha = updated.paidAt` (la misma que la factura).
- `bulk-paid`: una llamada por factura en el bucle de `marcadas`, con `fecha.fecha` y sin medio (el lote
  no lo recoge). ⚠️ **El lote NO es transaccional y no lo he hecho transaccional:** el `updateMany` de las
  facturas lo leen 289/397 por su texto; no se ha movido ni cambiado su `where`. El cierre del cobro va
  después, factura a factura, como `apuntarCobroDeFactura`.
- Un fallo al cerrar el cobro se registra en el log y NO rompe el marcado de la factura (como SCRUM-1732).
- Regla 29: ninguna factura emitida se edita; la única escritura nueva es sobre `Charge`. Regla 40: no se
  ha tocado `crearFacturaEmitida`, `sellarTrasEmision` ni el PDF.

## ③ Qué · esperado · visto

| qué | esperado | visto |
|---|---|---|
| `PUT status paid` con `paidVia:'transfer'` y `paidAt` | cobro `paid`, misma fecha, `method='transfer'`, evento `paid` | ✔ `tests/scrum1803-pago-manual-cierra-el-cobro.test.mjs` |
| `PUT status paid` sin medio | cobro `paid`, `method` sin tocar | ✔ mismo test |
| `bulk-paid` | cobro `paid` con la fecha del lote, `method` intacto | ✔ mismo test |
| factura sin `chargeId` (PUT y lote) | ningún `Charge` escrito | ✔ mismo test |
| cobro ya `paid` / `cancelled` (PUT y lote) | intacto: estado, fecha, método, sin evento | ✔ mismo test |
| rojo primero (antes del cambio) | caen los 3 positivos, pasan los 3 controles | ✔ 6 casos: 3 fail · 3 pass |
| mutación: quitar `status: 'pending'` del `where` | cae «un cobro ya `paid` queda intacto» | ✔ VIVA (`aplicarUna` de la casa; colateral: el de `cancelled`) |
| tanda dirigida (289, 397, 441, 627, 1316l, 1800, 1185, 1294, 267, 854, 719 y los que nombran `bulk-paid`, `invoiceAdmin` o `updateInvoiceStatusAdmin`: 45 ficheros + el nuevo) | 0 fail | 423 casos: 421 pass · 1 skip (gateado por `QA_DB_TEST`) · 1 fail = `scrum854 ②` (esta rama sin registro, antes de escribir este fichero) |
| build con tipos (`tsc -p .`) | salida 0 | ✔ 0 |
| suite entera | — | NO corrida en local (el encargo la deja al obligatorio) |
| yaqu.app | — | NO verificado: antes del merge no hay nada que ver |

Mutaciones: catálogo → `tests/scrum1803-pago-manual-cierra-el-cobro.test.mjs`

## ④ Las tres preguntas de c.22499

1. ¿También `Quote.chargeId` (vínculo indirecto)? → decidido c.22506: solo el directo (lo construido aquí).
2. ¿`paid-webhook` también cierra el cobro? → decidido c.22506, lo construye 1803b.
3. ¿`deshacer_pago` devuelve a `pending` el cobro que cerró el marcado manual? → decidido c.22506, lo construye 1803b.

## ⑤ Lo que no hice y por qué

- El comentario caducado de `src/modules/billing/domain/cobros.service.ts:24-30` («nadie escribe
  `Invoice.chargeId`», falso desde SCRUM-445) **NO lo he corregido**: ese fichero es carril J2
  (`node scripts/carriles.mjs de` → J2) y el encargo no declaraba la excepción en su primera línea (A20).
  Queda para J2.

## ⑥ A9

De jv-j1jd: el primer barrido usó el pathspec `src/modules/system/**/*.ts`, que no casa con los ficheros
directos de `system/`, y perdía `invoiceAdmin.ts`.
A9: aviso → A10 «Un prefijo no es un nombre, y una subcadena tampoco.» — no se pudo comprobar: un pathspec mal elegido en un barrido a mano no pasa por ningún guard

Mío (jv-j1je): el primer borrador del test generaba los dos casos «queda intacto» en un `for` con el nombre
en plantilla, contra lo que pedía el encargo (nombres literales); lo desenrollé antes de correrlo.
A9: comprobación → `tests/scrum1415-nombres-construidos.test.mjs`

# SCRUM-1803b · El aviso `paid-webhook` cierra el cobro y `deshacer_pago` lo reabre

**Medido contra:** `origin/main` = `093a128766d1d45c01c0f1cef3557c8680b1463c` · 2026-11-24T06:54:34Z

Carril J1 (jv-j1jh). Decisiones del fundador: SCRUM-1803 c.22506 b) y c), sobre el plan de jv-j1jd
(c.22499). Nace sobre la rama de #3353, que ya estaba en `main` al arrancar: este PR no lleva sus commits.

## ① Medición

- La ruta es `POST /invoice/:id/paid-webhook` (`invoice.routes.ts`), montada en `src/app.ts` como
  `app.use('/invoice', requireInternalSecret, invoiceRouter)`, no `/invoices` ni la línea 83 que citaba el
  encargo. Autentica SOLO el secreto interno (sin sesión ni comercio). Llamadores: 0 en `src/`, `public/`,
  `scripts/` y `.github/` (solo comentarios; `app.ts` la llama «legacy n8n»). Ruta muerta: construida igual.
- El webhook no lee el cuerpo: no trae medio, así que `method` se conserva.
- `Event.type` es un `String` libre (`model Event`). Ningún evento de cobro de la casa des-paga: `unpaid` no
  existía. Lo nombra literal la decisión firmada c.22506 c), y es el que se escribe.
- Cómo distingue la casa el origen del `paid`: por el `payload` del evento. El marcado manual (SCRUM-1803)
  deja `{ origen: 'marcar_pagado_manual', via, invoiceId }`; `psp.routes.ts` guarda el cuerpo del webhook,
  `mpWebhook.routes.ts` el pago de MP, la liberación de garantía `{ tipo: … }`. No hay campo `source`.

## ② Lo construido

- b) `invoice.routes.ts`: tras marcar la factura, `cerrarCobroDeFacturaPagada` (la de 1803, `where`
  con `status: 'pending'`) con `updated.paidAt`, sin medio y `payload { origen: 'paid_webhook', invoiceId }`.
- c) `invoiceAdmin.ts`: `reabrirCobroDeJustificanteDespagado`, llamada en `updateInvoiceStatusAdmin` al pasar
  de `paid` a `pending` (solo un justificante llega ahí). Lee el cobro `paid` y sus eventos `paid`; si
  TODOS son del marcado manual de ESA factura (`esPagoDelMarcadoManual`), lo pasa a `pending`, `paidAt`
  null y evento `unpaid` `{ origen: 'deshacer_pago', invoiceId }`. El `where` lleva `status: 'paid'` y
  «ningún evento `paid` fuera de los leídos»: un pago que entre en medio da P2025 y no se escribe nada.
  Un pago del aviso `paid-webhook` NO es manual: `deshacer_pago` no lo reabre.
- Un fallo al cerrar o reabrir el cobro se loguea y no rompe el marcado (como 1803).
- Regla 29: ninguna factura emitida se edita; las escrituras nuevas son sobre `Charge`. Regla 40: no se
  ha tocado `crearFacturaEmitida`, `sellarTrasEmision` ni el PDF.

## ③ Qué · esperado · visto

| qué | esperado | visto |
|---|---|---|
| `paid-webhook` con cobro `pending` | cobro `paid`, misma fecha que la factura, evento `paid`, `method` sin escribir | ✔ `tests/scrum1803b-webhook-y-deshacer-pago.test.mjs` |
| `paid-webhook`, factura sin `chargeId` | ningún `Charge` escrito | ✔ mismo test |
| `paid-webhook`, cobro `cancelled` | intacto | ✔ mismo test |
| `deshacer_pago` tras marcado manual | cobro `pending`, `paidAt` null, evento `unpaid` | ✔ mismo test |
| `deshacer_pago`, cobro pagado por pasarela | intacto, 0 escrituras de `Charge` | ✔ mismo test |
| `deshacer_pago`, pago manual + pasarela | intacto | ✔ mismo test |
| `deshacer_pago`, justificante sin `chargeId` | ningún `Charge` escrito | ✔ mismo test |
| rojo primero (antes del cambio) | caen los 2 positivos | ✔ 7 casos: 2 fail (por su aserción) · 5 pass |
| mutación: `esPagoDelMarcadoManual` devuelve `true` | cae «cobro pagado por una pasarela» | ✔ VIVA (`aplicarUna` de la casa; colateral: el caso mixto) |
| build con tipos (`tsc -p .`) | salida 0 | ✔ 0 |
| suite entera | — | NO corrida en local (orden del encargo) |
| yaqu.app | — | NO verificado: antes del merge no hay nada que ver |

Mutaciones: catálogo → `tests/scrum1803b-webhook-y-deshacer-pago.test.mjs`

## ④ A9

El encargo citaba la ruta como `/invoices/:id/paid-webhook` en `app.ts:83`: es `/invoice` y la línea era
otra. Lo cacé leyendo el montaje antes de escribir el test; una ruta mal copiada habría dado un 404 en
un test con suelo, no un verde falso.
A9: aviso → A10 «Referenciar por posición caduca. Referenciar por identidad no.» — no se pudo comprobar: la posición venía en el texto de un encargo, que no pasa por ningún guard

Mío (jv-j1jh): en los comentarios de `invoiceAdmin.ts` nombré la ruta por su nombre, y `scrum1455c ②` censa
esa palabra en `src/` como «alguien la llama»: rojo en la tanda dirigida. Cambié mi texto, no el guard.
A9: comprobación → `tests/scrum1455c-anomalia-y-webhook-id-que-cabe.test.mjs`

# SCRUM-1803c · El comentario de `chargeId` dice la verdad de hoy, y el test 445 ② la exige

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24T12:13:38Z

Origen: medición de jv-j2ep en c.22598, comentarios de jv-j2eq, test por decisión c.22604
(«Cambiar el test (Recomendado)», regla 41). Rama `scrum-1803d-test-445-dice-la-verdad`. Sin lógica:
sólo comentarios y un test.

- `src/modules/billing/domain/cobros.service.ts`: los dos comentarios de jv-j2eq (su commit local
  `09510bf99194db36a7af5e02a19bf8fea42ccb7c`, aplicado limpio con `cherry-pick`): 9+/9−, mismo número de
  líneas. Ya no dicen que `Invoice.chargeId` no lo escribe nadie (falso desde `eae75c3f4`, 2026-08-11, el
  propio SCRUM-445): nombran a sus dos escritores (`ensureInvoiceForCharge` y `sendInvoicePaymentRequest`)
  y dicen que el filtro «No basta solo».
- `tests/scrum445-cobros-sin-duplicar.test.mjs` ②: deja de exigir «HOY NO EXCLUYE NADA». Exige, por
  identidad y no por línea, que el bloque de comentario pegado a `where: { merchantId, chargeId: null }`
  diga «No basta solo», y que los comentarios del fichero nombren a los dos escritores. Si la consulta
  desaparece, cae (no se calla). La cabecera narrativa (la historia del 10-ago) queda intacta, con una
  línea fechada añadida.

Control negativo (salidas de `node --test` sobre el fichero, spec):

| comentario | resultado |
|---|---|
| el de `origin/main` (copiado con `git show` y restaurado después; `git diff` vacío) | tests 7 · pass 6 · fail 1 — cae ② con «el comentario de `chargeId: null` ya no dice que ese filtro solo no basta» |
| el nuevo | tests 7 · pass 7 · fail 0 |
| el nuevo con `sendInvoicePaymentRequest` cambiado a mano (sed local, deshecho; no reproducible desde git) | tests 7 · pass 6 · fail 1 — cae ② con «ya no nombran a `sendInvoicePaymentRequest`» |

Verde: los 12 ficheros que nombran `cobros.service` en `tests/` (285 ×2, 441, 442, 445 ×2, 474, 499,
503, 506, 1235, 1576) → TAP de 27.438 B, tests 110 · pass 110 · fail 0 · skipped 0. `tsc -p .` con tipos:
salida 0, 0 líneas. Registro: 1294, 267, 525d, 719 y 854 → tests 69 · pass 69 · fail 0 (719 en verde: el
censo de mudez no cambia). `npm run guards:entrada` → salida 0, tests 177 · pass 177 · fail 0. De la suite,
411 (lee `_huerfanos-declarados`), 237, 976, 553, 737, 747, 1415 y 709 → tests 84 · pass 84 · fail 0 ·
skipped 0. Suite entera: NO corrida (el encargo lo prohíbe por contexto); CI la corre.

A9: aviso → A10 «Referenciar por posición caduca. Referenciar por identidad no.» — no se pudo comprobar: la ruta y la línea del escritor venían en el texto del encargo, que no pasa por ningún guard

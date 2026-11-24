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

# SCRUM-1303 · Anular y cobrar se pisaban en las dos direcciones — el estado va dentro del `where`

**Medido contra:** `origin/main` = `f98f3ee1f8dc968b8158e769b98e83dbfa09c8ab` · 2026-10-01T00:25:25+01:00

1-oct-2026 · **J2** (equipo de Javier). Medición de J6 (30-sep); GO del fundador en el comentario
17640 («4-Go»), que autoriza meter la condición de estado en el `where` de los tres sitios y **no**
tocar el sellado, ni la respuesta al proveedor, ni texto nuevo.

## PASO 0 — la premisa, re-medida

La medición era contra `b6243e1c`. Entre esa base y la de este trabajo sólo entró SCRUM-1296 en
`src/modules/invoicing`, y no toca ninguno de los tres sitios. Grep del número y del patrón: nada
hecho con otra redacción. Las líneas se movieron: el `annul` escribe ahora en `invoicesAdmin.routes.ts`
~913 (el ticket decía 907).

## Qué cambia

| Sitio | Antes | Ahora | Si pierde la carrera |
| --- | --- | --- | --- |
| ① `POST /admin/invoices/:id/annul` | `where: { id }` | `where: { id, status: 'pending' }` | P2025 → la transacción se deshace (ni albaranes ni libro) → el mismo 409 `invoice_not_pending` de la guarda de entrada |
| ② `updateInvoiceStatusAdmin` (PUT `/:id/status`, `/:id/pay`, `/:id/unpay`) | `where: { id }` | `where: { id, status: <el leído> }` | P2025 → se relee UNA vez y las MISMAS guardas deciden; «anulada en medio» da el texto ya firmado de SCRUM-153. Un segundo cambio en medio sale como error |
| ③ `/webhooks/psp`, `payment.confirmed`, puerta de SCRUM-502 | `where: { id }` | `where: { id, status: { not: ESTADO_ANULADA } }` | P2025 → no se escribe; al proveedor se le contesta igual que antes |

El 409 de ① se sube a una constante (`NO_SE_ANULA_SI_NO_ESTA_PENDIENTE`) porque ahora lo dan dos
puntos de la misma ruta. Es el mismo literal firmado, una sola vez: no hay texto nuevo.

## Lo que NO arregla — el residual de ①, declarado

`docs/BUGS.md` **P1-1303**. El sellado de la anulación corre ANTES de la escritura de estado y en
su propia transacción. Si el cobro entra mientras se sella, la factura queda ahora `paid` (cierto)
pero **con su eslabón de anulación ya sellado** (`vfAnulHash`). Ese eslabón ya existía antes de este
arreglo cada vez que saltaba la carrera; lo que cambia es que el estado deja de taparlo. Cerrarlo
exige tocar el sellado: STOP (reglas 5 y 40), decide el fundador.

- **No queda constancia.** No se escribe `factura_anulada` (no se anuló) ni un evento nuevo (unión
  cerrada, regla 5). Sólo un `console.error` con el número, y **un `console.error` NO es constancia**.
- El 409 reusado es cierto pero **calla** que se selló una anulación: si el profesional emite la R1,
  la cadena lleva las dos.
- El caso «RESIDUAL CONOCIDO» del test lo fija: si alguien cambia este comportamiento, cae y remite
  a P1-1303.

## ③ es alcanzable HOY

La escritura de ③ está FUERA del bloque `if (config.AUTO_INVOICE_ON_PAID)`: se ejecuta con cualquier
`payment.confirmed` que traiga una factura enlazada por `chargeId` o `quoteId`. No depende del flag
que hace inalcanzable SCRUM-1304.

## Dos gemelos, NO tocados (fuera del ticket, A7)

El mismo patrón —guarda `puedeCobrarPorPasarela` sobre un estado leído y `update` con `where: { id }`—
vive en otros dos sitios, los dos DENTRO de `if (config.AUTO_INVOICE_ON_PAID)`, así que hoy son
inalcanzables (flag `false`, medido para SCRUM-1304):

- `psp.routes.ts`, la escritura tras `ensureInvoiceForCharge` (`invoiceId`, estado de `inv.status`).
- `mpWebhook.routes.ts`, la escritura de MercadoPago (con su `.catch(() => {})`, que fija SCRUM-502).

Se diferencian de ③ en eso: dependen del flag y el estado lo trae `ensureInvoiceForCharge`, no un
`findFirst` propio. El orquestador les abre ticket.

## Cómo se midió

`tests/scrum1303-estado-dentro-del-where.test.mjs`: las carreras se juegan ejecutando la ruta REAL
de enfrente en el hueco (dentro del cerrojo del sellado, o justo antes de que la base evalúe la
escritura), y el doble evalúa el `where` entero y lanza P2025 si no casa. **Rojo visto primero** con
los tres ficheros de `origin/main` compilados: ① quedaba `annulled` sobre una cobrada, ② y ③
quedaban `paid` sobre una anulada; los tres controles positivos, en verde en los dos lados. Con el
arreglo: 9 de 9. Tests que leen los ficheros tocados + `scrum237` + `scrum976`: 534, 0 rojos, 1
salto (el gateado de SCRUM-13/28, por falta de base).

A9: comprobación → `tests/scrum1303-estado-dentro-del-where.test.mjs`

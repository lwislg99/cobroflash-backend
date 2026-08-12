# SCRUM-502 · Las tres puertas de pasarela no resucitan una factura anulada

**Medido contra:** `origin/main` = `01025aafdb065b682f0da1b70141aa7baebf3a4f` · 2026-08-12T16:20:00+02:00
**Rama:** `scrum-475-firma-del-webhook` (main mergeado dentro, nunca rebase — AA2)
**Jira:** SCRUM-502, puesto En curso y asignado a Luis Lara antes de empezar.
**Ninguna base tocada, tampoco en lectura.**

---

## 1 · LA TRAZA (lectura, sin GO): ¿puede una anulada llegar a cada puerta?

La pregunta no era retórica: *que no haya filtro dice «si llega, entra», no dice que llegue*. Se midió
antes de tocar nada, y **ninguna de las tres resultó inalcanzable.**

### El enlace SOBREVIVE a la anulación

Anular escribe **solo `status`** (`invoicesAdmin.routes.ts:799`): `chargeId` y `quoteId` siguen
apuntando. Una factura anulada conserva intacto todo lo que las tres puertas usan para encontrarla.

### Censo con SUELO, y un hallazgo que corrige a otro

Instrumento por AST sobre las 26 escrituras de `Invoice`, mirando **dentro de `data`**:

| campo | escrituras | dónde |
|---|---|---|
| `data.status` | **7** | ← **SUELO/control positivo**: el instrumento sí ve dentro de `data` |
| `data.quoteId` | 7 | `invoicing.ts:322`, `invoicing.service.ts:84`, `jobs.routes.ts:1002`, `quotes.routes.ts:615`, `invoicesAdmin.routes.ts:923`, `quotesAdmin.routes.ts:205` y `:408` |
| `data.chargeId` | **1** | `lib/invoicing.ts:322` |

🔴 **Ese 1 corrige un hallazgo viejo.** SCRUM-445 dejó escrito que *«`Invoice.chargeId` no lo escribe
nadie en todo el árbol»*, y **hoy es falso**: el propio SCRUM-445 lo arregló, y `ensureInvoiceForCharge`
lo escribe. Un recuento que cambia es sospecha, y la sospecha se resolvió leyendo la línea: la rama
`{ chargeId: updated.id }` de `psp:143` **sí puede casar**.

### Puerta por puerta

| puerta | cómo encuentra la factura | ¿alcanzable por una anulada? |
|---|---|---|
| `psp.routes.ts:143` | `OR: [{chargeId}, {quoteId}]`, sin filtro de estado | **SÍ** — los dos campos se escriben y sobreviven a la anulación |
| `psp.routes.ts:184` | `ensureInvoiceForCharge` → `inv.id` | **SÍ** — ver abajo |
| `mpWebhook.routes.ts:151` | `ensureInvoiceForCharge` → `inv.id` | **SÍ** — ver abajo |

**Y la vía que abre las dos últimas:** `ensureInvoiceForCharge` **puede devolver una factura que ya
existía**, buscándola por el evento `invoiced` (`lib/invoicing.ts:288`) y por `quoteId` (`:295`),
**las dos sin filtro de estado**. Si esa factura está anulada, se devuelve tal cual y la puerta la
marca cobrada.

> **El caso real:** el profesional emite la factura, manda el enlace de pago, y luego la anula —el
> trabajo se cayó, o fue un error—. El enlace sigue vivo. El cliente paga, o el proveedor reintenta
> su webhook, y el documento dado de baja ante la AEAT **vuelve a salir como cobrado**. Aquí nadie
> pulsa un botón: basta con que llegue algo por la red.

---

## 2 · La guarda, REUTILIZADA

`puedeCobrarPorPasarela` vive en `invoiceAdmin.ts` —al lado de la guarda de una factura y del
conjunto del lote— y **consume `ESTADO_ANULADA`**. Las tres puertas la llaman; ninguna escribe su
propio criterio, y un assert lo impide.

**Por qué NO reusa `NO_SE_MARCAN_PAGADAS_EN_LOTE`:** ese conjunto excluye también `paid`, y para una
pasarela **reescribir `paid` sobre una ya pagada es idempotente y pasa de verdad** (los webhooks se
reintentan). Excluirlo habría cambiado el camino del cobro, y el GO era **solo** la guarda de anulada.

**La guarda va sobre la ESCRITURA, no sobre el `where`**, para que lo demás —el número de factura que
alimenta la confirmación al cliente— se comporte exactamente igual que hoy.

---

## 3 · Rojo por el HECHO, y nombrando la ruta

Tres inyecciones, cada una revertida y con el árbol limpio después:

| inyección | resultado |
|---|---|
| el predicado devuelve `true` siempre | `rc=1` · *«UNA FACTURA ANULADA SE PUEDE MARCAR COMO COBRADA DESDE UNA PASARELA»* |
| desconectar `psp.routes.ts` | `rc=1` · nombra **`psp.routes.ts` (PSP · la factura enlazada por chargeId/quoteId)** |
| desconectar `mpWebhook.routes.ts` | `rc=1` · nombra **`mpWebhook.routes.ts` (MercadoPago · la factura del charge)** |

### 🔴 Y mi propio trinquete me corrigió

La primera versión del suelo contaba el texto `status: 'paid'` y dio **4 donde había 3**. La cuarta
era `res.json({ ok: true, status: 'paid' })` — **una respuesta HTTP, no una escritura**. Un
instrumento que confunde lo que se devuelve con lo que se guarda no puede vigilar puertas: ahora
cuenta `prisma.invoice.update(`, o sea PUERTAS. Se leyó la lista, no el número.

---

## 4 · CONTROL NEGATIVO — el que más importa aquí

**El dinero sigue entrando.** `pending`, `sent`, `expired` y `paid` siguen cobrando por pasarela, y
está medido, no afirmado. Cortar esa vía sería peor que el defecto que se arregla: el cliente paga,
la pasarela lo confirma, y la factura se quedaría sin marcar.

---

## 5 · Lo que NO se ha tocado

🛑 **El `.catch(() => {})` de `mpWebhook.routes.ts` sigue ahí.** Es otro defecto —si la escritura
falla, nadie se entera— y era condición explícita no tocarlo en esta tanda. Queda **un test que deja
constancia de que sigue puesto**: el día que se arregle, ese test cae y se actualiza en el mismo
commit, para que el cambio no pase en silencio.

**No se ha tocado lógica de pasarela, ni sellado, ni la cadena de huellas.** El cambio son tres
condiciones sobre la escritura y un `status: true` en un `select`.

## 6 · Hueco declarado

**No se ha ejercitado un webhook de verdad contra una base.** Lo medido es que el camino existe —los
enlaces sobreviven, los campos se escriben, y `ensureInvoiceForCharge` devuelve existentes sin mirar
el estado— y que la guarda corta. Reproducirlo de punta a punta pediría base y proveedor.

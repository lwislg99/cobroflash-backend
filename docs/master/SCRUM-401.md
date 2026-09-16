# SCRUM-401 · Anular una factura cobrada — VEREDICTO: el defecto NO es alcanzable

**Fecha:** 9-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `64c19884a97d240544a203df81a67b33744c1724` · 2026-08-09T20:25:43+02:00

## El enunciado, y lo que la medición dice

El ticket decía: «Anular una factura BORRA si estaba cobrada: `annulled` y el estado de cobro
comparten el mismo campo, y el dato se pierde».

**Una factura cobrada no se puede anular.** `POST /admin/invoices/:id/annul` corta antes:

```ts
// Una factura COBRADA no se anula: el dinero entró, la operación existió. Eso es devolución
// + R1 (y ninguno de los motivos de arriba podría ser cierto).
if (invoice.status !== 'pending') {
  return res.status(409).json({ error: 'invoice_not_pending', … });
}
```

Lo puso **SCRUM-153** (commit `bae054a`), y el mensaje dirige al camino correcto: *«Si ya se cobró,
hay que rectificarla (R1), no anularla»*.

Y hay una segunda red que el ticket no contemplaba: el `update` de la anulación **solo toca
`status`**. `paidAt` no se borra ni aunque se llegara.

## 🔴 Pero NINGÚN test lo protegía, y eso sí era real

Quitar ese `if` no rompía nada en la suite. Y sin él, el defecto del ticket **sí ocurre**:
`paid → annulled` pierde para siempre que el dinero entró.

> Perder el estado de cobro de una factura anulada es perder **cuándo entró un euro**.

Eso es lo único que se construye aquí: **no se reconstruye la guarda — se fija**.

| test | qué protege |
|---|---|
| una cobrada no se anula | la guarda existe y devuelve `invoice_not_pending` |
| la guarda va ANTES de escribir | un `if` correcto detrás del `update` no protege nada |
| el `update` no borra `paidAt` | segunda red por si algún día se permite |
| SUELO: un único sitio escribe `annulled` | la guarda vive en la RUTA, no en el modelo: un segundo camino se la salta |
| el residuo sigue declarado | el libro deja la celda de cobro VACÍA, no «Pendiente» |

## El residuo, que sigue ahí y está declarado

Los dos ejes **siguen compartiendo `status`**. Hoy no hace daño porque la transición peligrosa está
cerrada, y `librosAeat.ts` ya lo documenta sin disimularlo: para una anulada la celda de cobro va
**vacía** — «no se sabe» — en vez de «Pendiente», que sería **afirmar** que no se cobró.

Separar los dos ejes es un cambio de modelo y **no es de este ticket**.

## Los cuatro rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Quitar la guarda de «solo pendiente» | 🔴 nombrando lo que se pierde |
| 2 | Borrar `paidAt` de paso | 🔴 «borra un hecho que ocurrió (regla 29)» |
| 3 | Mover la guarda detrás del `update` | 🔴 «no impide nada» |
| 4 | El libro rellena el hueco con «Pendiente» | 🔴 «un hueco dice no se sabe; una palabra afirma» |

## Hallazgo de camino (regla 9)

`verifactu.service.ts:318` dice: *«Hoy nada anula facturas: `annulled` no aparece en `src/`»*.
**Está caducado**: la ruta existe desde SCRUM-153 y escribe `annulled`. Un comentario que describe
un mundo anterior es el tipo de cosa que hace que el siguiente que lo lea mida mal.

## Lo que NO se tocó

El camino de emisión (regla 38) · `prisma/schema.prisma` · la ruta de anular · el libro.

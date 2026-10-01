# SCRUM-1272 — Una factura anulada o rectificada no es deuda del cliente

**Medido contra:** `origin/main` = `77051e2a50a735484ef08a113c3117114b71db87` · 2026-09-29T09:55:52Z

Carril S2 (`jobCobroHuecos.js`) · rama `scrum-1272-anulada-no-es-deuda` · sesión `s2-29a`. Sale del lote 5
de SCRUM-1215 (c.17505, fila 6).

## El defecto

«X facturados sin cobrar», en la ficha del Trabajo, sumaba toda factura con `status !== 'paid'`. Había
dos casos falsos:

- **Anulada:** queda `status: 'annulled'` (`invoicesAdmin.routes.ts`, anular) y seguía contando como deuda.
- **Rectificada con R1:** la R1 nace `paid` y con el total negado, y la original **no cambia de estado**.
  La original salía entera como deuda.

La misma raíz afectaba a `importesDeCobro` (la anulada contaba como «facturado») y a `sin-facturar-nada`
(con la única factura anulada, el Trabajo no decía «aceptados y sin facturar»).

## R1 parcial: medido que NO existe

Solo hay un sitio que crea R1 (`invoicesAdmin.routes.ts`, la ruta de rectificar). Niega la factura
ENTERA (`total: -original.total`, todas sus líneas negadas) y solo admite UNA por original
(`already_rectified`). Por eso no se construye el neteo `max(0, …)` que se propuso: una original con R1
está rectificada entera. Si algún día existe la R1 parcial, `facturasVigentes` hay que revisarla.

## Lo construido

- `facturasVigentes(job)` en `jobCobroHuecos.js`: quita las `annulled`, las R1 y las originales que tienen
  una R1 en la lista (`rectifiesId`). Se usa en los tres sitios (facturado, `sin-facturar-nada` y
  `sin-cobrar`). El dato ya venía del servidor (`status`, `type`, `rectifiesId`): no se toca el servidor
  ni el camino de emisión. Sin texto nuevo.

## Tests

`tests/scrum1272-anulada-no-es-deuda.test.mjs`: ficha REAL del Trabajo en el banco, en modo factura, y se
leen los huecos PINTADOS.

- Una anulada no sale como «sin cobrar».
- Una factura con su R1 no sale como «sin cobrar».
- Con la única factura anulada, el Trabajo vuelve a decir «500,00 € aceptados y sin facturar».
- Controles: una pendiente normal sí sale; una pagada no sale; una anulada no tapa a la viva de al lado.
- Rojo por mutación: con el `jobCobroHuecos.js` de `origin/main` caen 4 de 5; solo pasa el control normal.
- Vecinos (`jobCobroHuecos`, `jobDetailView`): 794/795, 1 saltado (staging).

**NO VERIFICADO en yaqu.app:** solo se ve en modo factura, y la cuenta QA no tiene trabajos.

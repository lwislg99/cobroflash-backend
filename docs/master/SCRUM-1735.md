# SCRUM-1735 · La factura cobrada toma la fecha declarada del cobro, no el momento de la confirmación

## SCRUM-1735 · Rojo primero y arreglo en las dos bocas de `/webhooks/psp`

> Lo escribe la sesión jv-j2c5 (puesto J2, equipo de Javier), no el fundador. Carril J2
> (`node scripts/carriles.mjs de src/modules/billing/app/routes/psp.routes.ts` → J2), con un cruce
> declarado a J1 en `src/modules/invoicing/domain/criterioCaja.ts` (solo un comentario).

**Medido contra:** `origin/main` = `8c61c10e34728282942cb896151cfde331a26072` · 2026-11-13T17:01:17Z (hora de GitHub)

A9: comprobación → `tests/scrum1735-factura-cobrada-fecha-del-cobro.test.mjs`

### De dónde sale

Hallazgo de jv-j1em en SCRUM-1732 c.21820, ejecutado: el `Charge` guardaba la fecha declarada del
Bizum (31-mar, SCRUM-397/1301) y la factura guardaba `paidAt = new Date()`, la hora de la confirmación
(13-nov). Con criterio de caja, el libro la devengaba en el T4 y no en el T1. GO: SCRUM-1732 c.21824
(«GO a J2: rojo primero y arreglo»). Decisión sobre el guard que chocaba: SCRUM-1735 c.21828 («Sí a las dos»).

### Qué bocas reciben una fecha declarada (medido en el código)

| boca | ¿fecha declarada? | ahora escribe |
| --- | --- | --- |
| `psp.routes.ts`, marcado robusto (P0-3, era `:198`) | sí: `body.ts`, resuelto en `resolverInstanteDeCobro` | `resolucion.fecha` |
| `psp.routes.ts`, tras `ensureInvoiceForCharge` (era `:265`) | sí, la misma | `resolucion.fecha` |
| `mpWebhook.routes.ts:175` | **no**: confirma Mercado Pago y no llega ninguna fecha declarada | `new Date()`, sin cambios |

Sin `ts`, `resolucion.fecha` es el instante del aviso, así que un cobro sin fecha declarada se
comporta como antes. `invoice.paidAt` no entra en el XML, la huella ni la emisión: lo leen el libro de
caja (`devengoPorCaja.ts`) y el aviso del 303. Esquema, sin tocar.

### El guard que chocaba (regla 41)

`tests/scrum397-fecha-real-de-cobro.test.mjs`, «CONTROL NEGATIVO: los webhooks siguen guardando el
instante del aviso», exigía `new Date()` en las tres escrituras. Con el arreglo, y antes de tocarlo,
salió 11 de 12 (medido, c.21826). Me paré, y con la decisión de c.21828 el control se **estrecha**:
`mpWebhook` sigue exigiendo el reloj, y las dos de `psp` exigen ahora `resolucion.fecha`. Es más
estricto sobre esas dos líneas. El comentario de `criterioCaja.ts` que decía «los tres webhooks siguen
con `new Date()` a propósito» se corrige en sitio, sin mover líneas (hay citas por número: `:77`, `:90`, `:29-34`).

### Medido

* **Rojo primero:** `tests/scrum1735-…` con el código de hoy da 2 de 4 en rojo. Caen los dos casos de
  fecha declarada («LA FACTURA SE FECHA CON EL RELOJ: 2026-11-13T17:04:15Z y el cobro es del
  2026-03-31»), y los dos controles sin fecha pasan. Con el arreglo, 4 de 4.
* **Mutaciones**, con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`: el censo de la
  casa ve 2 declaraciones; pasada limpia con 4 pasados, 0 caídos y 0 movidos; **2 vivas de 2, 0
  colaterales**. Cada una tumba solo su caso, así que cada boca tiene su test.
* `scrum397-fecha-real-de-cobro` + `scrum397-instante-de-cobro`: 24 de 24.
* **Build con tipos: salida 0.** El cliente Prisma compartido va por detrás de main
  (`Job.queHayQueHacer`, ajeno). Generé un cliente propio en el temporal de la sesión, sin regenerar el
  compartido (misma hora y mismo tamaño antes y después). Control positivo: un `resolucion.fechaX` metido
  a propósito da TS2551.
* **Suite entera en local**, por tramos (`tanda-entera-por-tramos.mjs`, 1.670 ficheros en 14 tramos):
  veredicto ROJO con 18 casos. Clasificados:
  * 1 mío: `scrum854` («esta rama, si toca código, trae su entrada de registro»), porque el registro
    aún no estaba escrito. Es este tramo.
  * 16 de entorno, comprobados: los mismos 16 nombres caen en los 9 ficheros con el árbol de
    `origin/main`, sin mis cambios (`scrum1298b`, `222`, `235`, `252`, `351`, `461`, `733`, `932`: cliente
    compartido por detrás y árbol anidado sin `node_modules` propio).
  * 1 intermitente: `scrum763 · SUELO`. Con mis cambios y solo, pasa 5 de 5, dos veces de dos.

### Sin medir

* Ninguna base de datos. Nada contra staging ni producción. Ningún envío nuevo.
* `main` avanzó 5 commits mientras medía (`257e5c10…` a las 17:33:48Z). Ninguno toca mis ficheros,
  pero la suite no se repitió sobre ese main: lo prueba el obligatorio de CI.
* `mpWebhook`: Mercado Pago trae `date_approved`, y `getMpPayment` no lo expone. No se propone: SCRUM-397
  decidió el reloj del aviso para esa boca.
* El cobro parcial y la retención de garantía (SCRUM-1732, opciones A y C) no son de este ticket.

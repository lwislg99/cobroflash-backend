# SCRUM-1304 · Un cobro, una factura — la pregunta por `chargeId`, dentro del cerrojo de serie

**Medido contra:** `origin/main` = `84e1fd80882d1231d0c4fa6f72d8aa08b0fad51f` · 2026-10-01T03:18:28Z

1-oct-2026 · **J1d** (equipo de Javier). Medición de partida de J6 (30-sep). GO del fundador en
SCRUM-1304, comentario 17704 («1-Ok, Go»): **me llegó por el orquestador** (`cobroflash-backend-5b`),
que se lo oyó al fundador; yo no. Autoriza construir el arreglo y excluye tocar el sellado, cambiar
el esquema y editar o borrar duplicadas que ya existan.

🔴 **ESTE ARREGLO NO PUEDE ENTRAR SOLO.** En España desemboca en un re-sellado que ya existe en
`main` (§ «Por qué se paró»). Está construido y medido; lo que falta lo decide el fundador en
**SCRUM-1330**.

A9: comprobación → `tests/scrum1304-un-cobro-una-factura.test.mjs`

## PASO 0 — la premisa, re-medida

El ticket se midió contra `b6243e1c`. Sobre `f5d99bd7` el defecto sigue: el rojo se vio corriendo
antes de tocar nada (`docs/master/evidencias/scrum1304/rojo-sobre-main-f5d99bd7.txt`: 13 casos,
7 rojos, 6 controles verdes). Sin rama remota ni PR del ticket, y nada hecho con otra redacción.

Una precisión al enunciado: dice que por `Invoice.chargeId` «no busca», y es cierto, pero el dato
**ya está escrito** desde SCRUM-445. Por eso el arreglo no necesita ni columna ni índice.

## Qué cambia

`ensureInvoiceForCharge` (`src/lib/invoicing.ts`), dentro de la transacción que emite:

1. `tomarCerrojoDeSerie(tx, merchantId)` — el de la reserva de número, re-entrante; el mismo y con
   la misma forma que el recuento de tramos de SCRUM-814.
2. `findFirst` por `chargeId` + `merchantId`. Si hay factura, se devuelve **sin pedir número**: la
   entrega que no emite no deja hueco en la serie.
3. La entrega que no emite lo dice por `console.error`, con el cobro y el número de la factura.

Las dos búsquedas de antes (evento `invoiced`, factura del presupuesto) no se tocan. La respuesta al
proveedor de pagos no cambia.

## Los casos, por efecto

Corre el código compilado: `/webhooks/psp`, `ensureInvoiceForCharge`, `allocateInvoiceNumber`,
`crearFacturaEmitida`, `sellarTrasEmision`. Se doblan la base, el PDF y el correo, y nada más.

| Caso | `main` | Con el arreglo |
| --- | --- | --- |
| C · una entrega | 1 factura | 1 |
| ④a · dos seguidas | 1 | 1 |
| ④d · el presupuesto ya tiene factura | 1 | 1 |
| dos cobros distintos, a la vez | una por cobro | una por cobro |
| ④b · dos entregas a la vez | 🔴 2 | 1 |
| ④b′ · la segunda entra mientras la primera espera el cerrojo | 🔴 2 | 1 |
| ④c · dos a la vez, presupuesto sin factura | 🔴 2 | 1 |
| ④e · el PDF cae una vez, sin carrera | 🔴 2 | 1, y la segunda entrega la termina |
| ④f · el cobro es el enlace de pago de una factura ya emitida | 🔴 2 | 1 |
| la función suelta, dos llamadas a la vez | 🔴 2 | 1 |

**④f es nuevo y no necesita ni carrera ni fallo.** `invoiceWhatsApp.service` crea un cobro para
cobrar una factura que ya existe y le escribe su `chargeId`. Al pagarse con el flag encendido no hay
evento `invoiced` ni presupuesto que la encuentren, y se emitía otra por el mismo dinero.

④b′ es el que separa el arreglo entero del arreglo a medias: cuando la primera entrega pide el
cerrojo, se ejecuta entera la ruta real de la segunda. Una pregunta hecha fuera del cerrojo ya ha
contestado «no hay» cuando la otra escribe.

## Mutaciones

`docs/master/evidencias/scrum1304/mutar.mjs` y su salida, `mutaciones.json`. Base sin mutar primero.

| Mutación | Resultado |
| --- | --- |
| M1 · sin el cerrojo | cae: ④b, ④b′, ④c, el aviso y la función suelta |
| M2 · la pregunta no decide | caen los 7 |
| M3 · la pregunta ignora el cobro | cae «dos cobros distintos» |
| M4 · la entrega que no emite se calla | cae el aviso |
| M5 · la pregunta ignora el merchant | **MUDA** en la primera pasada; cae tras añadir el caso de la regla 2 |

M5 era muda porque un cobro es de un solo merchant: con datos sanos, acotar no cambia nada. Se
añadió el caso que lo sujeta (una factura de otro merchant con ese `chargeId` no se devuelve).

## Por qué se paró — medido por ejecución (SCRUM-1330)

`ensurePdfAndEvent` llama a `sellarTrasEmision` siempre, y `applyVeriFactu` no comprueba si la
factura ya está sellada: recalcula y pisa `vfHash`, `vfPrevHash` y `vfTimestamp`. Con un merchant
de España con el flag por merchant:

- **Ya pasa en `main`, sin este cambio (④a):** una segunda entrega 1,2 s después deja la misma
  F260001 con la huella cambiada, `9E45613C…` → `B6ABC7EB…`. Una factura sellada, editada.
- **Con este arreglo, ④f es peor que el defecto.** F260001 sellada un mes antes, con F260002
  encadenada detrás. Al pagarse su enlace no se emite otra, pero F260001 se re-sella: huella nueva,
  encadenada a la posterior, y F260002 queda apuntando a una huella que ya no tiene ninguna
  factura. `main`, en ese caso, emite una duplicada y deja la cadena intacta.
- **④b con el arreglo:** una factura, sellada dos veces.

Los tres quedan fijados en el test como RESIDUAL CONOCIDO, contando sellados y no sólo la huella
(dos sellados en el mismo segundo dan la misma). Cuando SCRUM-1330 lo arregle, caen y se reescriben
con lo contrario en el mismo cambio.

Fuera de España el arreglo es completo: no hay cadena.

**Una guarda en el punto de llamada** («si la fila ya está `sellado`, no se llama a
`sellarTrasEmision`») se midió como experimento local y se deshizo, con `porcelain` vacío: ④f queda
intacta byte a byte y 0 sellados, y arregla también el ④a de `main`. No cierra ④b: la entrega que
pierde lee la fila aún `pendiente_de_sellado` y sella también. Cerrarlo del todo pide la guarda
dentro del cerrojo del sellado, que choca con el caso «resellar un alta» de `tests/scrum173`; eso
está leído, **no medido**.

## Lo que NO se midió

- **La carrera contra un Postgres real.** En la máquina no hay ninguno y dárselo en CI es tocar un
  workflow. El banco modela el cerrojo consultivo como una exclusión por clave que se suelta al
  terminar la transacción, re-entrante dentro de ella, y su suelo comprueba que excluye. No deshace
  una transacción que lanza y no aísla lecturas.
- **Si el re-sellado encola dos veces el alta a la AEAT** (`vfSubmission`): en el banco el registro
  XML no llega a montarse.
- **Facturas duplicadas que ya existan.** Este árbol no tiene acceso a ninguna base y producción no
  se toca. No se han contado. `AUTO_INVOICE_ON_PAID` no existe en Railway (c.17639), así que por
  `/webhooks/psp` y `/webhooks/mp` no se ha podido producir ninguna allí.
- **Dos eventos `invoiced`** con la misma factura cuando dos entregas coinciden: se ve en el banco,
  no rompe ninguna búsqueda (las dos apuntan a la misma), y no se ha tocado.

## Lo que salió mal

- El caso ④c dio rojo por otro motivo la primera vez: el presupuesto de prueba llevaba `tax: 21`
  y el IVA va en fracción, así que ninguna entrega emitía y el recuento era 0, no 2. Lo delató el
  mensaje. Ahora el caso exige primero que ninguna entrega falle al emitir.
- En el comentario 17725 de Jira puse la hora del estado a ojo (diez minutos de más), y al
  corregirlo puse a ojo la hora de la corrección. Dos veces el mismo error en el mismo comentario.
  Ya no lleva ninguna hora escrita a mano; las buenas son las de Jira. Apuntado en las cicatrices
  del puesto, sin comprobación: un comentario de Jira no pasa por ningún guard.
- La mutación M5 salió muda y la había declarado antes de mirar si el comportamiento cambiaba.
- Un doc de auditoría cita  por línea ():
  el  nuevo movió dos coordenadas y lo cazó , no yo. Coordenadas llevadas a
  su sitio en el mismo cambio.

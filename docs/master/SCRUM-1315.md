# SCRUM-1315 · Los dos gemelos que SCRUM-1303 dejó fuera — el estado va dentro del `where`

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:35:30+01:00

1-oct-2026 · **J4** (equipo de Javier). El ticket lleva `area-j2`: me lo dio el orquestador
(`cobroflash-backend-5b`) cruzando carril, dicho por él y con su motivo (J2 está con SCRUM-1262).
No hay rama de J2 que toque estos dos ficheros.

A9: comprobación → `tests/scrum1315-gemelos-estado-dentro-del-where.test.mjs`

## PASO 0 — la premisa, re-medida

El ticket se midió contra `f98f3ee1`. En `e9e71cab` las dos escrituras siguen como las describe:
guarda `puedeCobrarPorPasarela` sobre el estado que devolvió `ensureInvoiceForCharge`, y `update` con
`where: { id }`. Grep del número y del patrón: nada hecho con otra redacción.

Una precisión sobre «dentro de `if (config.AUTO_INVOICE_ON_PAID)`»: las dos **escrituras** están
fuera del `if`; lo que está dentro es lo único que rellena `invoiceId`. El efecto es el mismo —con el
flag apagado no se llega— y el caso «con el flag APAGADO» del test lo fija ejecutando la ruta.

## Qué cambia

| Sitio | Antes | Ahora | Si pierde la carrera |
| --- | --- | --- | --- |
| ① `/webhooks/psp`, `payment.confirmed`, tras `ensureInvoiceForCharge` | `where: { id }` | `where: { id, status: { not: ESTADO_ANULADA } }` | P2025 → no se escribe y sale por `console.error` nombrando la factura; al proveedor se le contesta igual |
| ② `/webhooks/mp`, pago `approved` | `where: { id }` + `.catch` que no miraba qué recibía | el mismo `where` + el `.catch` reconoce la negativa | P2025 → no se escribe y sale por `console.error`; el aviso se procesa entero |

Es la forma que SCRUM-1303 dio a su ③ (`not: ESTADO_ANULADA` y `esFilaQueNoCasa`), no una segunda.
Un reintento sobre una factura ya `paid` sigue escribiendo, como decidió SCRUM-502.

## La decisión sobre el `.catch` de MercadoPago

Ese `.catch` se tragaba cualquier fallo, y se habría tragado también el P2025 del arreglo.

- **La negativa de la carrera se dice** (`console.error`, con el id de la factura).
- **Cualquier otro fallo de esa escritura se sigue tragando, exactamente como antes.** Es el defecto
  que `docs/master/SCRUM-502.md` §5 dejó reportado; sigue abierto y no es de este ticket (A7). El
  caso «DEFECTO REPORTADO EN SCRUM-502, NO TOCADO» lo fija por comportamiento: si alguien lo arregla,
  cae y remite aquí.

⚠️ **Un `console.error` no es constancia** (lo dijo SCRUM-1303 de su ③ y vale igual): no queda evento
ni auditoría de que un pago llegó sobre una factura que se anuló en medio. El cobro sí queda `paid`.

## Lo que NO arregla

- **SCRUM-1314** (el eslabón de anulación sobre una factura cobrada, `docs/BUGS.md` P1-1303): es la
  carrera en el otro sentido, exige tocar el sellado y es del fundador. No se ha tocado el sellado.
- El fallo de escritura mudo de MercadoPago, arriba.
- `AUTO_INVOICE_ON_PAID` no se ha encendido en ninguna base ni entorno.

## Hallazgo al lado, NO tocado (A7)

El caso de `tests/scrum502-pasarela-no-resucita-anulada.test.mjs` que deja constancia de que el
`.catch(() => {})` de MercadoPago «sigue ahí» busca ese texto en el fichero ENTERO, comentarios
incluidos. Antes de este cambio ya casaba con cuatro sitios (un comentario y tres llamadas); ahora
casa con las dos llamadas de envío de WhatsApp, que no son la que nombra. Sigue verde sin medir lo que
dice. No lo he tocado (es un guard y es de otro ticket); la constancia por comportamiento está en el
test de éste.

## Cómo se midió

`tests/scrum1315-gemelos-estado-dentro-del-where.test.mjs`, 14 casos, con las rutas reales y dobles
en `require.cache`; sin base y sin red.

- **La carrera** se juega ejecutando la ruta real `POST /:id/annul` justo antes de que la base evalúe
  la escritura. El doble evalúa el `where` entero —`id`, estado, `not`, `in`, `notIn`, `OR`— y lanza con
  lo que no sabe (`tests/_where-como-prisma.mjs`, con su suelo).
- **El flag.** Se enciende en el objeto `config` del proceso del test, caso por caso, y se restaura. No
  depende del entorno, así que en CI no sale mudo: cada caso con el flag encendido exige haber pasado
  por `ensureInvoiceForCharge`, y hay un caso por puerta con el flag apagado.
- **Aislamiento en `/webhooks/psp`:** la factura del banco no lleva `chargeId`, así que la escritura
  de SCRUM-502/1303 no la encuentra y la única escritura de estado posible es la del gemelo. Tiene su
  suelo.
- 🔴 **Rojo visto primero**, con los dos ficheros de `origin/main` compilados: 14 casos, cayeron los 2
  de la carrera (`paid` sobre una anulada) y los otros 12 en verde. Con el arreglo: 14 de 14.
- **Mutaciones sobre el compilado, las tres caen:** la negativa de MercadoPago otra vez tragada → cae
  «y se DICE»; `where` con `status: 'pending'` en psp → cae el reintento sobre `paid`; el P2025 de psp
  sin reconocer → cae «y se DICE».

## Mis errores

- Un aserto mío contaba TODAS las escrituras a la fila y esperaba una; el sellado de la anulación
  escribe además su eslabón. Lo cazó la primera pasada en verde (falló mi aserto, no el arreglo); en
  la pasada en rojo no se había llegado a esa línea. Ahora cuenta sólo las de estado.
- La tercera mutación salió MUDA la primera vez: mi script buscaba la primera aparición de
  «SCRUM-1315» en el compilado —un comentario— y desde ahí mutó la guarda de SCRUM-1303, no la del
  gemelo. Lo vi mirando qué línea había cambiado antes de acusar al test; repetida apuntando al
  mensaje, cae. Cicatriz en `docs/equipo/cicatrices/J4.md`.

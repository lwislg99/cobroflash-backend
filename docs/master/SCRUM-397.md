# SCRUM-397 · ¿La fecha de cobro es un hecho o una declaración?

**Medido contra:** `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T19:13:03+01:00

**7-ago-2026** · rama `scrum-397-fecha-de-cobro` · **CENSO: no se construyó nada**

> Produce la respuesta que le falta a F1 (posicionamiento de la landing). La frase «sabemos
> exactamente cuándo entró cada euro y por qué vía» sostiene el argumento de A3 (SCRUM-294), el de
> E5 (SCRUM-326) y es candidata a la landing.

## ① Las cinco formas de cobro — el comentario es CORRECTO

Fuente única y cerrada, `src/modules/billing/domain/paidVia.ts:23` (commit `6924398`, 28-jul-2026):

```ts
export const PAID_VIA = ['card', 'bizum_auto', 'bizum_manual', 'transfer', 'cash'] as const;
```

`modelo303.ts:236` dice «tres de las cinco formas de cobro se marcan A MANO». **Confirmado**:
`bizum_manual`, `transfer` y `cash` son tres, y las tres las confirma una persona.

Y la distinción no la inventa este censo — está escrita en el propio módulo (`paidVia.ts:17`):

> **«Y la distinción importa fiscalmente: uno lo confirma una PERSONA, el otro un WEBHOOK.** Son
> dos cadenas de evidencia distintas ante una inspección, y colapsarlas en un solo valor destruye
> justo el dato que las separa.»

## ② Hecho o declaración, una por una

| # | Forma | Quién escribe `paidAt` | Fichero:línea | ¿Qué es? |
| --- | --- | --- | --- | --- |
| 1 | `card` | webhook de Stripe | `psp.routes.ts:121,167` (`a1764a7`) | **HECHO** |
| 2 | `bizum_auto` | webhook de Stripe (mismo checkout) | `psp.routes.ts` · `connectWebhook.routes.ts:76` | **HECHO** |
| 3 | `bizum_manual` | el PRO, con doble toque en el panel | `chargesAdmin.routes.ts:44` | **DECLARACIÓN** |
| 4 | `transfer` | el PRO, marcando la factura | `invoicesAdmin.routes.ts:371` · `invoiceAdmin.ts:138` (`ca9d4c3`) | **DECLARACIÓN** |
| 5 | `cash` | **nadie** — ver abajo | solo la constante | **no alcanzable** |

*(MercadoPago existe como sexta vía por webhook —`mpWebhook.routes.ts:142`— pero `mp` no está en
`PAID_VIA`; ver el hallazgo de vocabulario más abajo.)*

**`paidAt` NUNCA se teclea.** En los seis sitios donde se escribe es `new Date()`: el instante del
webhook, o el instante del clic. Nadie introduce una fecha a mano.

Eso matiza el problema en las dos direcciones, y conviene decir las dos:

* **A favor:** no hay fechas inventadas. Ninguna forma permite escribir «cobré el 3 de mayo».
* **En contra:** para las declarativas, `paidAt` es **cuándo alguien lo marcó**, no cuándo entró
  el dinero. Un cobro del día 2 marcado el día 20 queda fechado el 20. Y a efectos de criterio de
  caja, eso puede cruzar un trimestre.

## ③ La transferencia — medida, y era lo que SCRUM-326 declaraba «sin medir»

**Nada la detecta.** `payBank.routes.ts` (`2b1374a`) solo pinta instrucciones: IBAN, importe y
concepto exacto. El paso 4 que ve el cliente dice *«Recibirás confirmación cuando se procese el
pago»* (`:157`) — y **quien la procesa es una persona**, marcando la factura desde el panel.

No hay integración bancaria, ni conciliación automática, ni lectura de extractos. Es exactamente
lo que SCRUM-326 (E5) declara pendiente y bloqueado por SCRUM-321.

> El botón «Simular pago confirmado» de `payBank.routes.ts:165` está gateado por `isDev` y **no
> existe en producción**. Comprobado para que nadie lo lea como una vía de confirmación real.

## ④ ¿La interfaz distingue una fecha medida de una declarada? **NO. En ningún sitio.**

Tu sospecha era correcta. Los tres sitios donde se pinta una fecha de cobro la pintan igual:

| Dónde | Código |
| --- | --- |
| `invoiceDetailView.js:184` (`5287f3f`) | `addDefRow(dl, 'Pagada', invoice.paidAt ? new Date(invoice.paidAt).toLocaleString('es-ES') : null)` |
| `jobDetailView.js:1404` | `const when = paid ? (inv.paidAt \|\| inv.createdAt) : inv.createdAt` |
| `quotesDetailView.js:1126` | `date: paidInv ? fmtD(paidInv.paidAt \|\| paidInv.createdAt) : ''` |

Ninguno consulta `method` ni `paid_via` para decidir cómo pintar la fecha. **Una fecha puesta por
un webhook de Stripe y una puesta por un profesional pulsando un botón salen idénticas en
pantalla**, sin distintivo, sin nota y sin diferencia de tono.

Lo más cerca que hay es el **desglose por método** de `reportsView.js:381`, que sí etiqueta
`manual: '✍️ Marcado a mano'` — pero es una fila más de la misma lista, con la misma barra, y **no
dice nada sobre la fiabilidad de la fecha**. Es una etiqueta de método, no un aviso de origen.

## ⑤ La frase que SÍ es cierta hoy

**Microcopy sin aprobar — la aprueba el fundador (regla 30).** Propuesta:

> **«Cuando te pagan con tarjeta o Bizum, la fecha del cobro la registra la pasarela, no tú.»**

Y si hace falta la versión con el resto dentro, sin perder la honestidad:

> **«Tarjeta y Bizum se confirman solos, con su fecha y su hora. Transferencia y efectivo los
> confirmas tú, y YaQu guarda cuándo lo hiciste.»**

**Por qué esto es más fuerte de lo que parece, y no un recorte:** para `card` y `bizum_auto` la
fecha **es un hecho medido por un tercero** (Stripe), no una afirmación nuestra ni del usuario. Ese
subconjunto es defendible ante una inspección — es la «cadena de evidencia» que nombra
`paidVia.ts:17` — y es exactamente lo que el competidor no tiene, porque no tiene pasarela.

**Lo que NO se puede decir hoy**, y está escrito en tres sitios del propio código:

* «Sabemos exactamente cuándo entró **cada** euro» — falso para `transfer` y `bizum_manual`.
* «Podemos liquidar el criterio de caja» — `modelo303.ts:239`: *«NO para liquidar por criterio de
  caja — eso es E5 y no está construido»*.

Cuando E5 (SCRUM-326) exista, la frase completa pasa a ser cierta. Hoy no lo es.

## Hallazgo fuera de carril (se reporta, no se arregla)

**Hay dos vocabularios de método y no coinciden.** El conjunto cerrado de la regla 22 es
`['card','bizum_auto','bizum_manual','transfer','cash']`, pero:

* la UI de informes (`reportsView.js:381`) etiqueta además `bizum`, `bank`, `manual` y
  `mercadopago`, que **no están en `PAID_VIA`**;
* el código escribe `method: 'mp'` (`mpWebhook.routes.ts`), que tampoco está;
* y `cash` está en el conjunto pero **ninguna ruta lo escribe**: hoy es inalcanzable.

Consecuencia medida: `METHOD_LABELS[m.method] || m.method` degrada al valor crudo, así que un
método fuera del mapa se le enseña al profesional **sin traducir**. No rompe nada, pero el
«conjunto cerrado» de la regla 22 lo es solo en `paidVia.ts`: los demás sitios usan valores que él
no reconoce. No lo toco — es superficie de cobro y de la regla 22.

# SCRUM-340 · El contador de plazas cuenta compras, no campos — y si no puede, no pinta

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `2aaba3dccd763333b020c3c3a37514ee3b803d76` · 2026-08-05T05:20:32+01:00

> **UI en tres superficies. Las capturas AB6 van en un segundo commit** (ver «Lo que NO cubre»):
> el código y el guard se entregan primero para no dejar el trabajo sin commitear mientras se monta
> el arnés del navegador.

---

## Las tres mediciones previas (ninguna deducida del traspaso)

**1 · El contrato de hoy.** `getFoundingStatus` devolvía `{price, seatsTotal, seatsLeft, taken}` y
**no tenía forma de decir «no lo sé»**: cualquier fallo salía por el `catch` del endpoint como un
500 (`app.ts:231-239`), y el front lo trataba igual que «no quedan plazas». No había que inventar un
contrato: había que **añadir la única distinción que faltaba**.

**2 · Qué acredita un cobro.** Medido campo a campo, y **tres de los cuatro candidatos no valen**:

| Señal | Qué la escribe | ¿Sirve? |
| --- | --- | --- |
| `plan === 'founding'` | se asigna a mano **y** el webhook | ❌ **es el bug**. Y al cancelar vuelve a `trial` (`stripe.routes.ts:128,141`), así que **liberaba la plaza** |
| `stripeCustomerId` | **antes** de pagar, al crear el checkout (`subscriptions.routes.ts:114-116`) | ❌ significa «empezó», no «pagó» |
| `stripeSubscriptionId` | webhook de suscripción | ❌ se pone a `null` al cancelar: no acredita un pago pasado |
| `subscriptionStatus` ∈ `{active, past_due}` | webhook `customer.subscription.updated` | ✅ **sirve** |
| `subscriptionStatus === 'canceled'` | — | ⚠️ **no distingue**: el webhook escribe ese mismo valor para `canceled` **y** para `incomplete_expired` (`stripe.routes.ts:125`), o sea que mezcla a quien pagó y canceló con quien nunca pagó |

**El proxy declarado, y por qué es el más cercano:** `lifecycleEmailsSent.firstPayment`. Lo escribe
`sendFirstPaymentEmail`, que se llama **desde un solo sitio**: la rama de
`checkout.session.completed` del webhook (`stripe.routes.ts:80`), justo detrás de la recompensa de
referido. **Nada lo borra nunca** (`markSent` solo añade), así que **sobrevive a la cancelación** —
que es exactamente lo que hace falta para que la plaza no se libere.
**Límite:** si ese webhook nunca llegó, no hay marcador y esa plaza no se cuenta. El error va en la
dirección segura —contar de menos, nunca de más— y es el mismo dato del que ya dependen la
recompensa de referido y el correo de bienvenida a Pro.

**3 · Los puntos de pintado: son CUATRO elementos en tres ficheros, no tres.** Derivados:

| Fichero | Qué pinta |
| --- | --- |
| `public/index.html:295-300` | **la barra de anuncio** (`#announce`) con «quedan X plazas» |
| `public/index.html:480` | **el banner founding** de la tarjeta de precio (`#founding-banner`) |
| `public/precios.html:63-68`, `:117-125` | banner + píldora de plazas **+ el precio tachado + el texto del CTA** |
| `public/dashboard/js/plansView.js:40`, `:108` | banner del panel + «Quedan X de Y plazas» |

El cuarto que el traspaso no nombraba: **en `precios.html` el contador también decidía el precio
tachado y el texto del botón**. Si el contador no se pinta, había que decidir qué pasa con esos dos.

---

## Lo que se ha hecho

**Dos decisiones que antes eran una, y confundirlas era el defecto:**

* **`ofertaVigente`** — ¿se sigue pudiendo comprar? De ahí depende **anunciar la oferta** (precio
  9,90 €, precio tachado, texto del botón). Es cierto o no **con independencia de cuánta gente haya
  comprado**.
* **`mostrar`** — ¿se pinta el **contador**? Solo si además **hay al menos una plaza ocupada de
  verdad**.

Las dos se calculan **en el servidor, una sola vez** (`founding.ts`) y viajan resueltas. Antes la
condición estaba **copiada tres veces**, cada una escrita a su manera (`seatsLeft > 0` en dos
sitios y `founding.seatsLeft > 0` en el panel): tres copias de una regla son tres sitios donde
olvidar el cambio siguiente.

**El suelo:** si la consulta falla, `getFoundingStatus` devuelve `{resoluble:false}` y **no se pinta
nada** — ni contador ni oferta. Nunca un número inventado.

**Y una decisión que tomé y puedes revertir:** el checkout founding pasa a **fallar cerrado**
(`subscriptions.routes.ts`): si el contador no se puede resolver, **409** en vez de vender. Vender
una plaza de una oferta limitada sin poder acreditar cuántas quedan es cómo se sobrevende. Es un
caso raro (solo si la consulta falla) y el error va en la dirección segura.

---

## Verificado en rojo

| Caso | Qué se hizo | Resultado |
| --- | --- | --- |
| **R2** | Se vuelve a filtrar por `plan: 'founding'` en la consulta real | 🔴 cae «NO filtra por `plan`» (AST) |
| **R3** | Una superficie real vuelve a decidir con `seatsLeft > 0` | 🔴 cae «pintan por `mostrar`» |
| **El rojo del día** | Fijado **dentro** del guard: la condición de antes (`seatsLeft > 0`) es **cierta con cero compras** (20 > 0) — por eso pintaba «quedan 20» sin que nadie hubiera pagado — y la nueva es falsa. Las dos reglas **solo divergen en ese caso**, que es el de hoy | 🟢 el guard falla si dejan de divergir |
| **Estados** | `active` ✅ · `past_due` ✅ · `canceled` **con** marcador ✅ · `canceled` sin marcador ❌ · `incomplete` ❌ · `incomplete_expired` ❌ · solo `plan` ❌ | 🟢 |
| **Control negativo** | Un `plan: 'founding'` suelto **no** ocupa plaza | 🟢 |

**⚠️ Sobre R1, y lo digo porque no salió como pretendía:** intenté correr el guard contra el árbol
de **antes** (sacado de `git show`), como en SCRUM-336. Sale rojo, **pero por el motivo equivocado**:
el guard ni siquiera carga, porque la regla que prueba (`plazaOcupada`) no existía. Eso no demuestra
que cazara el defecto — demuestra que el fichero no compila contra el pasado. Por eso la
demostración del defecto está **dentro del guard** (fila «el rojo del día»), que sí es permanente y
no depende del historial.

**Y un tropiezo que merece quedar escrito:** la primera versión del guard **se cazó a sí misma**.
Buscaba `seatsLeft > 0` en el texto de las superficies… y señaló `precios.html` por el **comentario**
que explica por qué ya no se decide así. Es la trampa que este repo lleva documentada desde
SCRUM-176/168/3/193 y que volvió a morder hace dos horas en SCRUM-299. Arreglado quitando los
comentarios antes de mirar (`sinComentarios`), no reescribiendo la explicación.

## Lo que NO cubre

* 🔴 **Las capturas AB6 no están en este commit.** Son tres superficies y hay que montar un arnés
  (servidor estático local + navegador) para el antes/después a 360 y 390 px. Van en el commit
  siguiente, **y el PR no debería mergearse sin ellas**. Lo que sí se anota, porque sale de las
  capturas de SCRUM-341: la barra de anuncio de `index.html` está hoy a **tres líneas en móvil** y
  una de ellas es el contador; al dejar de pintarse, **esa franja vuelve sola a dos líneas**. Es un
  efecto colateral bueno y tiene que verse en el antes/después para que quede claro que no lo he
  roto yo.
* **No se ha ejecutado `getFoundingStatus` contra una base de datos.** La regla (`plazaOcupada`) se
  prueba con casos y la decisión de pintado también; lo que no se prueba aquí es la consulta en sí.
* **La lectura completa de `merchant` para contar** es deliberada (la regla vive en una función pura
  y así se puede probar sin BD). A la escala de la oferta es irrelevante; si la tabla crece, esto
  pasa a un `count` con filtro JSON.
* No se ha tocado `prisma/schema.prisma`, ni Stripe, ni producción, ni microcopy: **ni una palabra
  nueva** — el fragmento del contador se **oculta** y las frases de la oferta quedan intactas.

## Ficheros

* `src/modules/billing/domain/founding.ts` — la regla, el suelo y las dos decisiones.
* `src/modules/billing/app/routes/subscriptions.routes.ts` — checkout fail-closed.
* `public/index.html`, `public/precios.html`, `public/dashboard/js/plansView.js` — pintan por
  `ofertaVigente` / `mostrar`.
* `tests/scrum340-contador-plazas-reales.test.mjs` — el guard (6 asserts).
* `docs/master/SCRUM-340.md` — este registro.

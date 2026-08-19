# SCRUM-512 (mitad independiente) · Que el producto no olvide que alguien pagó

**Fecha:** 19-ago-2026 · **Carril:** billing / registro del pago · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d59d5cd97546e394bdb027dea59c9cb6ba1f587b` · 2026-08-19T08:11:34Z

**Paso 0.** `main` se movió durante el arranque: `a241b6e4` → `d59d5cd9`, ocho commits, todos de
microcopy y censo de superficies (SCRUM-402). Nada de billing, así que la medición de este ticket
no la afecta. `docs/master/SCRUM-512.md` no existía y no hay rama `scrum-512` ni local ni remota.

**La premisa se verificó antes de construir, y SIGUE SIENDO CIERTA.** El ticket la daba en
`billing/app/routes/stripe.routes.ts:138` y `:151`; la ruta real es
`src/modules/billing/app/routes/stripe.routes.ts` y las dos líneas son las que decía.

## 1 · Qué pasa hoy, exactamente, cuando un merchant cancela

Recorrido el webhook entero. Hay **cinco** `prisma.merchant.update` en el fichero, extraídos
balanceando llaves sobre el fuente del ancla:

| línea del `update` | evento | qué escribe |
| --- | --- | --- |
| `:75` | `checkout.session.completed` (subscription) | `stripeCustomerId, plan, subscriptionStatus` |
| `:121` | `subscription.updated` → `active`/`trialing` | `plan, subscriptionStatus, stripeSubscriptionId, planExpiresAt` |
| `:131` | `subscription.updated` → `past_due`/`unpaid` | `plan, subscriptionStatus, stripeSubscriptionId` |
| **`:136`** *(su `data:` en :138)* | `subscription.updated` → `canceled`/`incomplete_expired` | `plan, subscriptionStatus, stripeSubscriptionId, planExpiresAt` |
| **`:149`** *(su `data:` en :151)* | `customer.subscription.deleted` | `plan, subscriptionStatus, stripeSubscriptionId, planExpiresAt` |

Los dos caminos de cancelación escriben **el mismo objeto**:

```
{ plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null }
```

Los cuatro campos que decían que esa persona había comprado algo quedan a `'trial'` o a `null`. Y
`subscriptionStatus: 'canceled'` **no distingue**: el mismo `else if` cubre `canceled` y
`incomplete_expired`, o sea que recibe ese valor tanto quien pagó nueve meses como quien no llegó
a pagar nunca. Después de cancelar, los dos son **la misma fila**.

## 2 · Lo que este trabajo NO decide, y por qué se puede hacer igualmente

`PLAZA_OCUPADA` en `src/modules/billing/domain/founding.ts` no se toca: sigue siendo
`{ plan: 'founding', subscriptionStatus: 'active' }`. La pregunta de si una plaza la ocupa quien
pagó alguna vez o quien está pagando ahora **sigue abierta y es del fundador**.

Lo que se vigila aquí es **anterior a esa pregunta y no depende de su respuesta**: que el hecho de
haber pagado siga escrito en algún sitio. Sin eso, la decisión que se tome no se podrá aplicar,
porque el dato ya no existirá. Es la mitad que SCRUM-409 fase 5 dejó dicho que era independiente.

## 3 · El rastro: se adopta el precedente, no se inventa otro

`lifecycleEmailsSent.firstPayment`, el proxy razonado en `docs/master/SCRUM-409.md` fase 5. Los
otros candidatos se volvieron a descartar **midiendo hoy sobre el ancla**, no citando:

| candidato | por qué no |
| --- | --- |
| `stripeCustomerId` | se escribe al ABRIR el checkout (`subscriptions.routes.ts:116`), antes de pagar |
| `stripeSubscriptionId` | la cancelación lo pone a `null` |
| `subscriptionStatus` | `'canceled'` vale igual para quien pagó y para `incomplete_expired` |
| `plan` | la cancelación lo devuelve a `'trial'` |

### 🔴 Y por qué NO se arregla conservando `plan` al cancelar, que era la vía obvia

Era la solución elegante —el mismo `switch` ya conserva el plan en `past_due`, «gracia con banner
y portal»— y **se descartó al medirla**: `plan` GOBIERNA PERMISOS.

| quién lo lee | qué decide |
| --- | --- |
| `getEntitlements(merchant?.plan)` — `team.routes.ts:74` | cuántos usuarios puede tener |
| `referral.service.ts:53` — `plan !== 'trial'` | si cuenta como referido que paga |
| `lifecycle.service.ts:183` — `isTrial` | qué correos de ciclo recibe |

Dejar `plan: 'founding'` en quien canceló no registraría un hecho: **regalaría el producto**. Un
rastro de contabilidad no puede vivir en el campo que abre las puertas. Por eso el rastro va donde
va — en un campo que no gobierna nada salvo no repetir un correo.

## 4 · Lo que se construye

`tests/scrum512-el-pago-no-se-olvida.test.mjs`, sin gate: ni BD, ni red, ni servidor.

Lee el fuente **balanceando llaves** —no un `grep` por línea, que se apagaría solo el día que
alguien reparta el objeto en varias— y aplica a una fila simulada **las claves extraídas del
código**, no un objeto copiado al test. Ésa es la diferencia entre probar el código y probar la
copia: si mañana alguien añade `lifecycleEmailsSent` a esos `data`, la simulación lo aplica y el
test cae. Con el objeto copiado a mano seguiría verde para siempre.

| caso | de qué responde |
| --- | --- |
| SUELO · el extractor VE los caminos | 5 updates y **2** cancelaciones, con sus claves parseadas. Cero caminos = ciego, no «ya no se cancela» |
| SUELO · el rastro se escribe donde el test cree | `markSent(…, 'firstPayment')` sigue ahí, y sigue FUSIONANDO en vez de sustituir |
| CONTROL positivo **y negativo** | quien paga queda registrado; quien nunca pagó (`incomplete_expired`) NO |
| 🔴 SECUENCIA | paga → cancela **por las dos puertas** → el rastro sigue |
| el censo CUADRA | escritos + intactos = campos de la fila, y la partición no es trivial |

## 5 · Verificación

**Línea base de `npm test`**, en el ancla, worktree materializado hoy: **3.674 tests · 3.597 pass ·
0 fail · 77 skip** (los gateados sin BD). El aviso del protocolo se cumple: este árbol no es
veterano y `scrum480` sale en verde.

**Commit en verde previo a la inyección del rojo:** `9ff680b14766ee4b47953dfdbc6f7c2c2568a652`.

**ROJO POR EL MECANISMO.** Añadido `lifecycleEmailsSent: {}` al `data` de la cancelación de `:138`
—el borrado que hoy nadie impide— el caso de la secuencia cae **nombrando a quién le pasó**:

```
🔴 «Fontanería Pereira» (merchant 4242) PAGÓ, y después de la cancelación de
  src/modules/billing/app/routes/stripe.routes.ts:136 el producto ya no lo sabe.

  esa cancelación escribe: plan, subscriptionStatus, stripeSubscriptionId, planExpiresAt,
                           lifecycleEmailsSent
  y entre ellas está `lifecycleEmailsSent`, que es donde vivía la única prueba de que pagó.
```

Y cae **sólo ese caso**. El del censo también caía en la primera versión, porque le había puesto un
assert sobre el rastro que era del otro; se quitó. Dos casos que caen por el mismo hecho no dicen
qué se rompió: ahora si falla el censo lo roto es el instrumento, y si falla la secuencia lo roto
es el producto.

**Y QUE HOY PASA EN SILENCIO ESTÁ MEDIDO, NO SUPUESTO.** Con la inyección puesta, la tanda entera:

| | tests | pass | fail | skip |
| --- | --- | --- | --- | --- |
| línea base, sin este fichero | 3.674 | 3.597 | **0** | 77 |
| con este fichero y con el rojo inyectado | 3.679 | 3.601 | **1** | 77 |

Ese 1 es `SCRUM-512 · 🔴 SECUENCIA`. **Los 3.674 tests que ya había pasan con el rastro del pago
borrado**: nada en el árbol lo impedía, y por eso este fichero no es una comprobación de más.

El control positivo vive DENTRO del caso de la secuencia, antes de cancelar. Si la simulación
dejara de escribir el rastro, el bucle fallaría igual pero acusando a la cancelación de borrar algo
que nunca existió — un rojo con el diagnóstico cambiado manda a quien lo lee al fichero equivocado,
y cuesta más que no tener rojo.

**Restauración:** la inyección se retiró con `git stash` (nunca `checkout --`) y
`src/modules/billing/app/routes/stripe.routes.ts` quedó **idéntico al ancla**, verificado con
`git diff d59d5cd9`. Este ticket no cambia ni una línea de código de producción.

## 6 · Huecos declarados

**① El límite del proxy es más estrecho de lo que SCRUM-409 dejó anotado, y este ticket NO lo
cierra.** `markSent(…, 'firstPayment')` corre **sólo `if (r.enviado)`**, y `enviarCorreo` se niega
a propósito a contar como enviado el transporte de mentira: sin `RESEND_API_KEY` y sin `SMTP_URL`
devuelve no-enviado (SCRUM-406, «un `sendMail` que resuelve contra un buffer es la forma que tiene
*no configurado* de disfrazarse de *enviado*»). Consecuencia: **en un entorno sin correo
configurado, un pago no deja rastro ninguno**. En producción, con Resend configurado, lo deja. El
test vigila que el rastro que exista sobreviva; no puede vigilar el que nunca se escribió.

**② Por eso el control positivo no ejecuta `sendFirstPaymentEmail` de verdad.** Hacerlo exigiría
red, y sin red ese camino devuelve no-enviado y no marcaría nada — el control positivo probaría lo
contrario de lo que pretende. En su lugar, la simulación reproduce la fusión de `markSent` y **un
suelo la ata al fuente real**: si `markSent` deja de fusionar, o deja de escribirse bajo
`if (r.enviado)`, el suelo cae y avisa de que este documento ha dejado de ser cierto.

**③ El rastro sigue siendo un proxy, no un hecho.** Se llama `lifecycleEmailsSent` y significa
«correos ya enviados»; que además sirva de prueba de pago es un uso prestado, declarado aquí y en
SCRUM-409. La forma de cerrarlo sería un campo propio en `prisma/schema.prisma`, y eso es de los
fundadores: **no se ha preparado diff porque no ha hecho falta** — el ticket se resuelve sin tocar
el esquema.

## 7 · Fuera de carril · se reporta, no se arregla (regla 37)

1. `subscriptions.routes.ts:116` escribe `stripeCustomerId` al abrir el checkout, así que un
   merchant que abandonó la pasarela sin pagar queda con id de cliente de Stripe puesto — inocuo
   hoy, pero es la razón por la que ese campo no sirve como prueba de pago y conviene que conste.
2. La cancelación de `:136` y la de `:149` escriben el mismo objeto literal duplicado; hoy cuadran,
   y nada impide que mañana sólo se toque una de las dos.
3. `plan` mezcla dos cosas —qué compró y qué permisos tiene— y por eso no puede conservar historia;
   es lo que obliga a que el registro del pago viva prestado en otro campo.

## 8 · Lo que no se ha tocado

`prisma/schema.prisma`, el camino de emisión y el sellado, `PLAZA_OCUPADA` y `founding.ts`, el
texto del contador, `public/index.html`, `public/precios.html` y cualquier otra superficie pública,
la regla de `past_due`, y la rama `scrum-340-contador-plazas-reales` — leída en
`docs/master/SCRUM-409.md` fase 5, **no mergeada**, y de ella sólo se ha tomado el razonamiento.
Cero cambios en código de producción: el commit del carril añade un fichero de test y nada más.

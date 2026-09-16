# SCRUM-512 (mitad independiente) · Que el producto no olvide que alguien pagó

**Fecha:** 19-ago-2026 · **Carril:** billing / registro del pago · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d59d5cd97546e394bdb027dea59c9cb6ba1f587b` · 2026-08-19T08:11:34Z

**Paso 0.** `main` se movió durante el arranque: `a241b6e4` → `d59d5cd9`, ocho commits, todos de
microcopy y censo de superficies (SCRUM-402). Nada de billing, así que la medición de este ticket
no la afecta. `docs/master/SCRUM-512.md` no existía y no hay rama `scrum-512` ni local ni remota.

**La premisa se verificó antes de construir, y SIGUE SIENDO CIERTA.** El ticket la daba en
`billing/app/routes/stripe.routes.ts:138` y `:151`; la ruta real es
`src/modules/billing/app/routes/stripe.routes.ts` y las dos líneas son las que decía.

**Y el ancla se volvió a comprobar al terminar, porque `main` se movió otra vez** —a `f215ca5d`,
diecisiete commits, entre ellos el merge de SCRUM-517—. Ninguno de los cinco ficheros sobre los que
se midió cambió: `stripe.routes.ts`, `lifecycle.service.ts`, `founding.ts`,
`subscriptions.routes.ts` y `team.routes.ts` están idénticos entre `d59d5cd9` y `f215ca5d`. La
medición se sostiene sobre su ancla; se dice aquí para que quien lea no tenga que fiarse de que
nadie tocó nada mientras tanto.

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
---
---

# APÉNDICE (7-sep-2026) · Se vuelve a pedir esta mitad, y PARA: no hay estado que usar — pero hay algo peor debajo

**Carril:** billing · **Gate:** sin gate (AST y lectura) + una medición en la BD de **desarrollo**
**Medido contra:** `origin/main` = `5af8e7e9cdcd15ac90eb9b8a1473737872b6625c` · 2026-09-06T23:20:04+01:00
**Tanda:** 5728 tests, 5626 pass, 0 fail, 102 skipped (salida 0)

> **Paso 0 · esta mitad YA ESTABA HECHA.** El encargo pedía abrir `scrum-512-la-plaza-que-no-se-libera`
> desde main. El barrido completo de `git ls-remote` encontró **`scrum-512-el-pago-no-se-olvida`**,
> y está **mergeada en main con 0 commits vivos**; y `docs/master/SCRUM-512.md` —este fichero— ya
> existía, del 19-ago-2026. Su test sigue en el árbol y **sigue en verde: 5/5**.
>
> Más importante todavía: **aquella entrega ya midió y RECHAZÓ el arreglo que este encargo insinúa**
> (§3 de arriba, «por qué NO se arregla conservando `plan` al cancelar»). No se da por bueno de
> oídas: abajo se vuelve a medir, y la resolución se sostiene.

## B1 · Obligación 1 · El rojo, provocado en desarrollo

Base `yaqu_dev_javier`, comprobada por el mecanismo de la casa antes de escribir nada
(`exigirDestinoCorrecto` + `parseBDSegura`): `DATABASE_URL_DEV → …/yaqu_dev_javier (DESARROLLO) ✅`.
Cero producción y cero staging.

**El objeto de la cancelación se EXTRAE del fuente por AST, no se copia** — si mañana alguien le
añade un campo, esta medición lo aplica. Las dos puertas escriben exactamente lo mismo:

```
stripe.routes.ts:138 -> {"plan":"trial","subscriptionStatus":"canceled","stripeSubscriptionId":null,"planExpiresAt":null}
stripe.routes.ts:151 -> {"plan":"trial","subscriptionStatus":"canceled","stripeSubscriptionId":null,"planExpiresAt":null}
```

Y las consecuencias se evalúan con las funciones **reales** (`getEntitlements` de `dist/`) y con la
condición del paywall **leída del fuente**, no reescrita:

```
condición del paywall, leída del fuente: plan === 'trial' && planExpiresAt && planExpiresAt < new Date()
control del evaluador · trial caducado dispara el paywall: true
```

| momento | plan | planExpiresAt | ¿salta el paywall? | entitlements | ¿correos de trial? |
|---|---|---|---|---|---|
| ① paga | `pro` | +30 días | no | `maxUsers 1 · wa 300` | no |
| ② cancela por `:138` | `trial` | **`null`** | **NO** | `maxUsers 1 · wa 300` | **sí** |
| ② cancela por `:151` | `trial` | **`null`** | **NO** | `maxUsers 1 · wa 300` | **sí** |
| ✅ **positivo** · nunca pagó, trial agotado | `trial` | ayer | **SÍ** | `maxUsers 1 · wa 300` | sí |

**Limpieza:** el merchant de prueba (id 1031, marcado `SCRUM512-PRUEBA-BORRAR-`) se borró y se
**verificó**: 0 por email y 0 por nombre.

### 🔴 Y lo que se ve al mirar las consecuencias no es lo que decía el ticket

El ticket dice «el producto olvida que esa persona pagó». Es cierto, y es lo de menos. Lo medido:

**LA CANCELACIÓN DEJA AL MERCHANT EN UN ESTADO DONDE EL PAYWALL NO PUEDE SALTAR NUNCA.** No es que
salte tarde: es que **la condición es insatisfacible**. Exige `planExpiresAt &&`, y la cancelación
escribe `planExpiresAt: null`. Comprobado que no hay red debajo:

- `authMiddleware.ts:72` es **el único** `403 trial_expired` del árbol.
- **Nadie lee `subscriptionStatus` para decidir acceso**: en `founding.ts` sólo aparece como filtro
  del contador de plazas — que no se toca.
- `getEntitlements('trial')` y `getEntitlements('pro')` devuelven **la misma fila**
  (`maxUsers 1 · wa 300`), así que los permisos tampoco cambian.

O sea: **quien paga y cancela se queda con el producto gratis y para siempre; quien nunca pagó y
agota el trial se queda fuera.** Está del revés, y la fila del control positivo lo enseña al lado.

## B2 · Obligación 2 · Qué valores admite `plan`, y si hay uno que sirva

Medido por AST sobre `src/` + `public/` (**357 ficheros**), recogiendo todo literal que se **asigna**
a `plan` o se **compara** con él. No la lista del comentario del schema, que además está **caducada**:
dice `trial | basic | pro | empresa` y ni `basic` ni `empresa` aparecen en el código, mientras que
`founding` sí y no está en el comentario.

| valor | dónde | qué significa |
|---|---|---|
| `trial` | 11 sitios | prueba, **y también «canceló»** — ahí está el defecto |
| `pro` | `plansView.js:40`, `entitlements.ts` | de pago |
| `founding` | 5 sitios, incl. `founding.ts:34` | plaza fundadora |
| `equipo` | `entitlements.ts` (`BY_PLAN`) | oferta manual W1 |
| `""` | 3 comparaciones | ausencia |

### 🛑 NO EXISTE ninguno que signifique «canceló después de pagar». PARO.

Es literalmente la instrucción de la obligación 2. Crear uno es **inventar un estado**, y la regla 27
lo prohíbe: se describe y lo firma el fundador. **Y hay motivo de fondo, ya medido en §3 de arriba y
reconfirmado hoy**: `plan` gobierna permisos, así que no puede llevar historia. Meter ahí «canceló»
obliga a decidir su fila en `BY_PLAN`, su respuesta en el paywall, si cuenta como referido y qué
correos recibe — cuatro decisiones de producto en un campo que hoy sólo dice qué compró.

## B3 · Obligación 3 · Quién lee `plan` y qué decide

Por AST y sin lista cableada. **✅ Control positivo del encargo: el censo VE `stripe.routes.ts:138`
y `:151`**, las dos con `plan: "trial"` — sin eso, nada de lo que dijera valdría.

**19 escrituras · 21 lecturas en 11 ficheros.** Las que deciden algo:

| quién lee | qué decide | qué le pasa al que canceló |
|---|---|---|
| `authMiddleware.ts:72` | **el paywall** | queda **fuera de alcance** (`planExpiresAt: null`) |
| `entitlements.ts:25` → `team.routes.ts:74` | cuántos usuarios | nada: `trial` y `pro` dan la misma fila |
| `referral.service.ts:53` (`plan !== 'trial'`) | si cuenta como referido que paga | **deja de contar** |
| `lifecycle.service.ts:183` (`plan === 'trial'`) | qué correos recibe | **vuelve a los de prueba** |
| `subscriptions.routes.ts:36` | `currentPlan` de la pantalla de Planes | se le enseña como si nunca hubiera pagado |
| `app.ts:414` | la etiqueta del dashboard | ídem |

Esta tabla **amplía** la de §3: aquella nombraba tres lectores; el censo encuentra los tres y además
`authMiddleware` y `entitlements`, que son justo los del acceso. La conclusión de §3 no sólo se
sostiene: sale reforzada.

## B4 · Obligación 4 · Qué se entrega, y qué NO se aplica

**No se construye nada.** El arreglo que el encargo describe necesita estado nuevo → medición y diff
preparado, sin aplicar.

### Diff preparado ① — el mínimo, y NO necesita estado nuevo

El defecto grave de B1 se cierra **sin tocar `plan`**: basta con que la cancelación deje de borrar
`planExpiresAt`. Con una fecha ahí, el paywall vuelve a ser alcanzable y el que canceló pasa a estar
donde está el trial agotado.

```diff
--- a/src/modules/billing/app/routes/stripe.routes.ts
+++ b/src/modules/billing/app/routes/stripe.routes.ts
@@ (las DOS puertas, :138 y :151)
-  data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null },
+  data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null },
```

Quitar `planExpiresAt: null` conserva la fecha que ya había —el final del periodo pagado— así que el
merchant mantiene el acceso **hasta donde pagó** y lo pierde después. Ni estado nuevo, ni literal, ni
schema.

**🛑 NO SE APLICA, y no por la regla 27:** esto cambia **quién pierde el acceso y cuándo**, o sea el
flujo de cobro. Es una STOP CONDITION de `CLAUDE.md` («dinero real o flujo de cobro en producción»)
y la firma el fundador. Van también las dos preguntas que no puedo contestar yo:

1. ¿El que cancela conserva el acceso **hasta el final del periodo pagado** (lo que hace este diff)
   o **inmediatamente**? Stripe manda `subscription.deleted` en momentos distintos según se cancele
   «al vencimiento» o «ya».
2. Si al cancelar `planExpiresAt` ya estaba en el pasado, el paywall salta **al instante**. ¿Es lo
   que se quiere?

### Diff preparado ② — el que el encargo insinuaba, y que sigue sin proceder

Un valor de `plan` que diga «canceló después de pagar». **No se prepara**: elegirlo es elegir un
estado (regla 27) y arrastra las cuatro decisiones de B2 sobre los seis lectores de B3. Si el
fundador lo quiere, lo que hace falta primero es su firma sobre el valor y sobre qué contesta cada
lector, no un diff.

## B5 · Lo que NO se ha tocado

El **contador de plazas** entero: `founding.ts`, `PLAZA_OCUPADA`, `public/index.html`,
`public/precios.html` y cualquier claim de la landing. La rama `scrum-340-contador-plazas-reales`:
**ni mergeada ni abierta ni leída** — sólo se la nombra porque §8 de arriba ya la nombraba.
`prisma/schema.prisma`. Ningún estado, ningún flag, ningún literal. **Cero código de producción**:
esta entrega es medición y documento.

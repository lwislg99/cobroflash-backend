# SCRUM-809 · PAYWALL: cancelar deja de borrar la fecha, y el bloqueo vuelve a alcanzar a quien debe

**Fecha:** 7-sep-2026 · **Carril:** producto · cobro · **Gate:** gateado (`QA_DB_TEST=1`)
**Medido contra:** `origin/main` = `e8ae10697d61fef37f87156cc227eecae4a9a39d` · 2026-09-07T07:56:14Z
Re-medido al CERRAR, no al empezar, y **cambió**: el trabajo se hizo sobre `64b5d80a` y main avanzó
7 commits (SCRUM-759 y SCRUM-797) mientras tanto. Se ha MEZCLADO main DENTRO de la rama —sin reescribir
historia— y todo lo de abajo está re-medido sobre el árbol mezclado. Ninguno de esos 7 toca
`stripe.routes.ts` ni `authMiddleware.ts`: el merge salió sin conflicto y las dos puertas quedaron intactas.
**Tanda:** 5862 tests, 5753 pass, 0 fail, 109 skipped (exit 0) — sobre el árbol YA mezclado con main

## El defecto

`requireActivePlan` ([authMiddleware.ts](../../src/core/http/authMiddleware.ts)) es **el único
403 `trial_expired` del árbol**, y bloquea con:

```ts
plan === 'trial' && planExpiresAt && planExpiresAt < new Date()
```

Las dos puertas de cancelación del webhook de Stripe escribían `planExpiresAt: null`. Con ese
`null` el segundo operando es *falsy* y **la condición se vuelve insatisfacible**: quien cancela
no puede ser alcanzado por el paywall NUNCA. Quien no pagó jamás sí lo es, porque conserva la
fecha de fin de su trial.

|            | `plan` | `planExpiresAt` | ¿le alcanza el paywall? |
|------------|--------|-----------------|--------------------------|
| paga       | `pro`  | +30 d           | no (correcto) |
| **cancela**| `trial`| **`null`**      | 🔴 **NO PUEDE NUNCA** |
| nunca pagó | `trial`| ayer            | sí |

**El que paga y cancela se quedaba el producto gratis para siempre; el que nunca pagó, fuera.**
Estaba del revés. Y no había red debajo: nadie lee `subscriptionStatus` para decidir acceso, y
`getEntitlements('trial')` y `('pro')` devuelven la misma fila.

## La decisión, y por qué

🟢 **Firma del fundador (7-sep-2026), literal:**

> «El que cancela **CONSERVA EL ACCESO HASTA EL FIN DEL PERIODO QUE YA PAGÓ**.»

O sea: cancelar deja de borrar la fecha. El arreglo es **quitar `planExpiresAt: null`** de las dos
puertas, y nada más. El campo conserva lo que ya tenía —el fin del periodo pagado, escrito por el
evento `active`— y el paywall vuelve a alcanzarle **cuando esa fecha venza, no antes**.

Sin estado nuevo, sin flag nuevo, sin literal de pantalla nuevo, sin tocar `prisma/schema.prisma`
ni `getEntitlements`. **El camino de emisión no se toca**: el dato ya estaba donde hacía falta.

**Las dos puertas, y por qué no bastaba una.** Censadas sobre el árbol entero (`git grep` de
`canceled` y de `planExpiresAt: null` bajo `src/`, sin lista cableada) — son exactamente dos, y
son **dos caminos distintos de Stripe**, no dos copias del mismo:

| | evento | línea |
|---|---|---|
| A | `customer.subscription.updated\|created` con `canceled`/`incomplete_expired` | rama `st === 'canceled' \|\| st === 'incomplete_expired'` |
| B | `customer.subscription.deleted` | su propia rama del webhook |

Se nombran por su **evento** y no por su línea: este mismo commit escribe comentarios encima de
las dos y las desplaza, así que un `:138`/`:151` escrito aquí nacería ya caducado. El trinquete de
SCRUM-710b saltó contra la primera versión de este guard, que sí los llevaba, y tenía razón.

Arreglar una y no la otra dejaba vivo el defecto en la mitad de las cancelaciones.

## Lo que se midió

Contra `yaqu_dev_javier` (**dev**; foto — la base es compartida y se mueve), recorriendo el
webhook **de verdad**: cuerpo crudo + cabecera `stripe-signature` válida verificada por
`stripe.webhooks.constructEvent`, mismo router y mismo handler. Nada viaja a Stripe:
`constructEvent` es HMAC local.

**El defecto, reproducido (7-sep-2026 06:24 UTC), antes de tocar nada:**

```
inicial        plan=trial expira=2026-09-12  estado=null
PAGA           plan=pro   expira=2026-10-07  estado=active
CANCELA        plan=trial expira=null        estado=canceled   ← se pierde la fecha
/quote/create  400 validation_error ........................... ATRAVIESA EL PAYWALL
```

El `400` es la prueba de que **atravesó**: la petición llegó al validador del handler, o sea pasó
`requireActivePlan` sin que le cortara. Un `403 trial_expired` habría muerto antes.

**Se mide ACCESO, no la columna.** Comprobar `planExpiresAt !== null` habría dado el mismo verde
sin decir nada de lo que le ocurre a la persona: la columna es el medio, no el defecto.

### La pregunta que el fundador dejó abierta

> *Si la fecha YA ESTABA VENCIDA cuando cancela, ¿qué pasa?*

**Medido, por las dos puertas: el paywall le alcanza INMEDIATAMENTE.** Conserva una fecha ya
pasada, así que `plan === 'trial' && planExpiresAt && planExpiresAt < new Date()` se cumple en la
siguiente petición. Es coherente con la firma: no hay periodo pagado vivo que conservar, luego no
hay nada que conservarle. **No hace falta decisión nueva para este caso** — está en el guard como
test propio, por puerta.

### Dos casos vecinos, medidos porque nadie los había nombrado

* **`incomplete_expired`** (primer pago fallido; entra por la puerta A). Antes, ese evento ponía la
  fecha a `null` y **un pago FALLIDO regalaba acceso ilimitado**. Medido tras el arreglo: el
  merchant con trial vencido estaba bloqueado antes del evento y **sigue bloqueado después**.
  Mejora de rebote, no buscada.
* **`planExpiresAt` que ya era `null` antes de cancelar** → sigue `null` → sigue pasando. **Este
  arreglo no lo cambia ni lo empeora**, pero es un agujero real y se deja anotado abajo.

## Verificado en rojo

Los dos sentidos, sobre el mismo guard y la misma BD:

| | antes del arreglo | después |
|---|---|---|
| 🔴 EL QUE DECIDE · puerta A | **falla** (400, atraviesa) | ok |
| 🔴 EL QUE DECIDE · puerta B | **falla** (400, atraviesa) | ok |
| pregunta abierta · puerta A | **falla** | ok |
| pregunta abierta · puerta B | **falla** | ok |
| ✅ POSITIVO · nunca pagó, trial agotado | ok | ok |
| ✅ NEGATIVO · paga y no cancela | ok | ok |
| | **4 fail / 2 pass** | **6 pass / 0 fail** |

Los dos controles que **no debían moverse** estaban verdes antes y siguen verdes después.

**El escenario que decide cruza el vencimiento con el reloj de verdad**: se paga un periodo de 4 s,
se cancela, y se pregunta dos veces —antes y después—, mismo merchant y misma cookie. No se
reescribe la fecha a mano después de cancelar, que habría medido otra cosa.

**Suelo:** si la máquina tardara tanto que la comprobación «antes de vencer» cayera ya pasada la
fecha, el guard sale **CIEGO** diciéndolo, en vez de dar un verde que no se ha ganado.

**Guarda de presencia:** antes de afirmar ningún bloqueo, se exige que el merchant con plan vigente
**llegue al handler** (400 `validation_error`). Sin eso, un 403 podría venir de que la fixture
nunca se montó.

### Las mutaciones declaradas: **vivas 3 · mudas 0 · ciegas 0**

Cada una tumba al guard **por su propio test declarado**, que es lo que prueba que las dos puertas
están cubiertas de verdad y no una dos veces:

| mutación | cae por | colaterales |
|---|---|---|
| puerta A vuelve a escribir `planExpiresAt: null` | `EL QUE DECIDE · A` | +1 |
| puerta B vuelve a escribir `planExpiresAt: null` | `EL QUE DECIDE · B` | +2 |
| el paywall deja de mirar la fecha (`if (false)`) | `✅ POSITIVO · el que NUNCA pagó` | +4 |

### ⚠️ AVISO AL SIGUIENTE QUE CORRA `meta:mutaciones` — dejó el árbol MUTADO

Medido hoy, dos pasadas completas con `QA_DB_TEST=1` (hace falta el gate: sin él, las declaraciones
de un guard gateado no aparecen en verde en la pasada limpia y salen **ciegas sin llegar a mutarse**):

1. **Primera pasada:** `vivas 145 · mudas 0 · ciegas 2`, exit 2. Las dos ciegas, de este guard: el
   campo `cae` que escribí no era *substring* de ningún nombre de test real, y `cayo()` empareja con
   `nombre.includes(cae)`. **El instrumento acertó**: dijo CIEGO, no MUDO — no acusó al guard de no
   caer, dijo que no se había podido medir. Corregido contra los nombres que imprime el runner, y
   verificado el `includes` **antes** de relanzar.
2. **Segunda pasada:** murió con **exit 127** al llegar a este guard —140 líneas escritas, la última
   `scrum808`, sin línea de resumen—. Como murió, **no ejecutó su `finally` de restauración** y dejó
   la mutación de la puerta A puesta **en `src` Y en `dist`**. Se detectó con `git status`, no por
   aviso del instrumento: no podía avisar, estaba muerto. Reparado y verificado por post-condición
   (cero `planExpiresAt: null`, las dos puertas presentes, diff de vuelta a 8+/2−).

**La causa del 127 NO está medida y no se afirma aquí.** El dato que sí hay: la pasada completa
sobrevive cuando este guard sale ciego sin mutarse, y muere la primera vez que lo muta de verdad.

Por eso las tres de arriba se midieron **acotadas**, reutilizando el mecanismo de la casa
(`mutacionesDeclaradas` por AST, `correr`, `aplicarUna`) — el veredicto lo emite su código, no una
capa mía— más una post-condición propia sobre los bytes del árbol, porque ya quedó demostrado que
un proceso que muere se salta el `finally`. **No se suman las dos pasadas como si fueran una
medición**: son dos, con alcances distintos, y así se dejan escritas.

### El merge trajo un schema nuevo, y el cliente de Prisma había que regenerarlo

SCRUM-797 quitó el `@default(1)` de `merchantId` («la columna deja de donárselo al demo»), así que
tras mezclar, `pretest` cayó con **PROCEDENCIA DEL CLIENTE DE PRISMA**: el cliente generado no salía
de este `schema.prisma`. Dos cosas antes de regenerar, ninguna supuesta:

* **`npm run topologia`** primero — si este árbol compartiera `node_modules` con otro worktree,
  regenerar el mío rompería la tanda de otra sesión. Medido: *«NO COMPARTEN: cada árbol llega a un
  `node_modules` distinto»*.
* **Sin `npx`**, aunque sea lo que imprime el propio guard como remedio: si falta el CLI local, `npx`
  se baja otro de la red en silencio (incidente del 5-ago-2026). Se usó el binario local,
  `node node_modules/prisma/build/index.js generate`.

`prisma/schema.prisma` **no se ha tocado** en esta rama: lo que cambió vino de main por el merge.

## Lo que NO cubre

* 🔴 **DECISIÓN PENDIENTE DEL FUNDADOR — un merchant sin `planExpiresAt` no es alcanzable por el
  paywall, nunca.** No lo introduce este ticket ni lo empeora: es anterior y ortogonal. Pero la
  foto de dev del 7-sep-2026 06:32 UTC decía **6 de 8 merchants sin fecha**, así que no es
  teórico. Qué debe pasar con esa población es una decisión de producto (¿se les da fecha al
  registrarse? ¿el paywall trata `null` como vencido?) y **no se toma aquí**.
* **`getEntitlements('trial')` y `('pro')` devuelven la misma fila.** Defecto declarado y medido,
  fuera del alcance de este ticket por instrucción expresa.
* **El contador de plazas y `founding.ts`**: aparcados por decisión del fundador, sin tocar.
* **La tanda gateada completa (`npm run test:staging:gated`) no se lanzó**: ese runner **toma el
  turno de staging y escribe en él**, y este ticket se hizo con «cero staging» y con cinco sesiones
  más trabajando. El guard se corrió directamente con `node --test` y su gate, contra dev.

## Ficheros

| fichero | qué |
|---|---|
| `src/modules/billing/app/routes/stripe.routes.ts` | las dos puertas dejan de escribir `planExpiresAt: null` (+ el porqué) |
| `tests/scrum809-paywall-tras-cancelar.test.mjs` | el guard: 6 tests, las dos puertas, con `MUTACIONES_QUE_ME_TUMBAN` |
| `docs/master/SCRUM-809.md` | esta entrada |

## SCRUM-809b · el banner de impago no podía salir, y la fecha de fin no se escribe al suscribirse

**Medido contra:** `origin/main` = `06c6289d46d5998493ec014fa26ff3353946b58b` · 2026-10-18T17:32:44Z (hora de GitHub)
A9: comprobación → `tests/scrum809b-banner-de-impago-lee-el-estado.test.mjs`

Carril S1 · árbol `s1-809b` · rama `scrum-809b-banner-de-impago-lee-el-estado`. Encargo del orquestador
(`cobroflash-backend-f3`), 18-oct-2026 ~17:40Z: arreglar (1) con su test; declarar (2) sin tocar el webhook.

### (1) ARREGLADO · `GET /admin/me` devolvía `subscriptionStatus: null` a todo merchant

`app.js` pinta el banner de impago (A10.2) cuando `/admin/me` dice `subscriptionStatus: 'past_due'`. La ruta lo
leía de `session.merchant`, y `getSession` (`auth.service.ts`) **no selecciona ese campo**: para todo merchant que
no fuera el dueño de la plataforma valía `null`, y el banner no podía salir nunca. Medido en yaqu.app el
18-oct-2026 a las 17:36Z con la cuenta QA: `subscriptionStatus: null`.

🔵 **Lo que enseña, más allá del banner:** un `null` en `subscriptionStatus` NO significaba «está al día»:
significaba «no lo hemos leído». Es la familia «no pude mirar = no hay nada», esta vez con forma de campo de base
de datos. Por eso el `null` de la cuenta QA no dice nada de su estado real.

- **Dónde se arregla, y por qué no donde se encargó:** el encargo decía `auth.service.ts`, pero `src/modules/auth/**`
  es carril de J3 (`.claude/carriles.json`). `/admin/me` (`src/app.ts`, S1) ya lee la fila del merchant en esa misma
  petición (`merchantFull`): `subscriptionStatus` entra en SU `select` y la ruta lo lee de ahí. Una línea, sin
  tocar el carril de otro y sin añadir un campo a cada `getSession` de cada petición. Dicho al orquestador.
- **Texto:** ninguno nuevo. El banner ya existía (`app.js`) y su texto no cambia; lo que cambia es que ahora PUEDE
  salir. El orquestador se lo dice al fundador con el texto delante; si lo veta, se revierte este cambio.
- **Test:** app REAL por HTTP (`_banco-camino-real.mjs`). El doble de `merchant.findUnique` **respeta el `select`**
  (sin eso el test no mide nada: un doble que devuelve la fila entera tapa justo un campo que nadie pidió), y la
  sesión del banco trae el merchant sin `subscriptionStatus`, como `getSession`. Rojo sobre `dist/` de la punta, sin
  el arreglo: cae el caso `past_due`. Con el arreglo: **3 de 3**.
- 120 ficheros de `tests/` que leen `src/app.ts`, `/admin/me` o `dist/app.js`: **852 pasan, 1 cae, 66 saltados**. El
  que cae es SCRUM-854 (esta rama aún no traía su registro, que es esta entrada).
- `tsc`: sólo el error conocido de `merchantAdmin.ts:147` (cliente de Prisma viejo; sin `prisma generate`).

### (2) DECLARADO, NO arreglado · `planExpiresAt` se queda viejo al suscribirse

**Hecho, medido en yaqu.app** (cuenta QA, suscrita por el fundador el 18-oct en Stripe modo pruebas):
`GET /admin/billing/plans` a las 17:36:14Z → `currentPlan: "pro"`, `planExpiresAt: 2026-10-12T14:41:58.799Z` (en
el pasado). El orquestador vio lo mismo unos diez minutos antes.

**Hecho, en el código** (`stripe.routes.ts`): el único sitio que pone `plan` a algo distinto de `trial` es ese
webhook. `checkout.session.completed` escribe `plan` y `subscriptionStatus`, **sin** `planExpiresAt`;
`customer.subscription.created/updated` en estado activo escribe los tres. Que la fecha siga vieja dice que esa
segunda rama **no se ha ejecutado con éxito** para este merchant.

**Por qué importa, y es la firma de arriba:** al cancelar, el webhook pone `plan: 'trial'` y conserva
`planExpiresAt` (SCRUM-809). Con la fecha en el pasado, quien cancela cae en el 403 `trial_expired` **al instante**,
no al acabar el periodo que pagó.

**Dos hipótesis, sin medir, por orden:**

| | causa | qué se vería |
|---|---|---|
| (a) | el endpoint del webhook en Stripe no está suscrito a `customer.subscription.created/updated` | ninguna entrega de esos eventos; ninguna fila suya en `gateway_events` |
| (b) | llegan y revientan: desde la API de Stripe 2025-03-31, `current_period_end` ya no viene en la raíz de la `Subscription` (pasó a sus items). La versión del payload la fija el ENDPOINT, no el `apiVersion` del cliente (`stripe.ts`). `new Date(undefined * 1000)` es una fecha inválida, Prisma la rechaza y la ruta responde 400 | entregas con 400 y «Webhook Error: …»; fila en `gateway_events` con `processed_at` NULL y el mensaje de error (`anotarFalloDeEvento`) |

Los dos eventos van por `gateway_events` (`EVENTOS_CON_REGISTRO`), así que **esa fila decide entre (a) y (b)**. Sin
tocar código, también lo decide el panel de Stripe (modo pruebas) → Webhooks → el endpoint: qué eventos escucha, su
versión de API y las entregas de hoy de `customer.subscription.created`. Lo mira el fundador; el orquestador se lo
ha pedido. **No se arregla hasta saber cuál de las dos es:** arreglar la causa equivocada en el camino del dinero
es peor que no arreglar nada. Y no se descarta que Stripe reintente más tarde con éxito.

## SCRUM-809c · CONFIRMADA la (b): Stripe escribe el `Invalid Date` en su propio panel

**Medido contra:** `origin/main` = `bbb9bfe544b692765e84dec7d1f6686bfd526618` · 2026-10-18T18:14:23Z (hora de GitHub al escribir: 18:15:21Z)
A9: sin fallo que generalice — la causa la confirma el panel de Stripe del fundador, no una prueba nuestra; aquí sólo se registra.

Carril S1 · árbol `s1-809c` · rama `scrum-809c-webhook-invalid-date-confirmado`. Sólo este registro: **el webhook
NO se toca** (`stripe.routes.ts` y `src/modules/billing/**` son de J2, y el cobro es STOP del fundador).

### Lo que trajo el panel (Stripe en modo pruebas, endpoint `https://yaqu.app/webhooks/stripe`)

Captura del fundador, transcrita por el orquestador (`cobroflash-backend-f3`) el 18-oct-2026. Versión de API del
endpoint y del evento: **`2025-10-29.clover`**, posterior al corte `2025-03-31` que nombraba la hipótesis (b).

| hora (del panel) | evento | resultado |
|---|---|---|
| 17:23:40 | `checkout.session.completed` | 200 |
| 17:23:40 | `customer.subscription.created` | 200 |
| 17:23:40 | `customer.subscription.updated` | **400** |
| 17:23:40 | `invoice.payment_succeeded` | 200 |
| 17:23:57 | `customer.subscription.updated` | **400** (reintento; el panel anuncia el siguiente) |

El cuerpo del 400, literal:

> `Webhook Error: Invalid prisma.merchant.update() invocation: { where: { id: 46 }, data: { plan: "pro", subscriptionStatus: "active", stripeSubscriptionId: "sub_1URxo4EJBIeVR6H8UbVeN1XZ", planExpiresAt: new Date("Invalid Date") }} Invalid value for argument 'planExpiresAt': Provided Date object is invalid. Expected Date.`

Es la rama activa de `customer.subscription.created/updated` (`stripe.routes.ts`, la que hace
`new Date(sub.current_period_end * 1000)`): con esta versión de la API, `current_period_end` no viene en la raíz de
la `Subscription` y la fecha sale inválida. **(a) queda descartada** para `updated`: el evento llega.

### Lo que esto cambia

- **La receta deja de ser defensiva: es el arreglo de la causa confirmada.** Es la que pasó S1 al orquestador para
  J2: leer `current_period_end` de la raíz o, si no está, de los items de la suscripción; no escribir nunca una
  fecha inválida; sin fecha utilizable, guardar plan y estado sin tocar `planExpiresAt`, dejar constancia y
  contestar 200, porque un 400 hace que Stripe reintente algo que el reintento no arregla. Test con tres payloads:
  raíz (el viejo), items (`clover`) y sin fecha.
- **Mientras no se arregle, le pasa a TODO suscriptor nuevo**, no sólo a la cuenta QA: el `updated` a `active` es el
  paso normal de una suscripción que se paga.
- **Después del arreglo**, la cuenta QA no se corrige sola. Hay que reenviar esa entrega desde el panel de Stripe
  (botón de reenvío de la entrega fallida). Reenviarla antes del arreglo sólo repite el 400.

### Lo que NO está explicado

`customer.subscription.created` salió **200** y `updated` **400** en el mismo segundo, y los dos entran en la misma
rama del código. **No se ha medido por qué.** Lectura de S1, sin comprobar: una suscripción que crea Checkout
suele nacer `incomplete` hasta que se paga la primera factura. `incomplete` no entra en ninguna rama (va al
«estado de suscripción sin mapeo directo») y devuelve 200; el `updated` llega ya `active` y entra en la rama que
revienta. Se comprueba mirando el `status` del payload de ese `created` en el panel.

### 🔴 La autorización del fundador para ARREGLARLO: NO consta

El orquestador trasladó como autorización «2 autorizo», citando la transcripción `ed676fd1-…`. **Leída por S1, ese
texto no está.** La pregunta del webhook se hizo (turno 36421). El último mensaje antes de la respuesta del fundador
(turno 36528) era otra lista: «1. ¿Te conecto a Meta? … 2. ¿Preparo lo de la demo para que sólo tengas que pegar una
línea en Railway?». La respuesta (turno 36531, uuid `c1f48323-a767-446d-807d-793047029345`) es, literal,
**«1 si conectame / 2 si hazlo»**, y contesta a ESA lista. **El STOP de cobro sigue puesto** hasta una respuesta
del fundador a la pregunta del webhook, copiada literal con su localizador.

**Actualización (hora de GitHub 18:31:19Z): la autorización NO constaba a las 18:19 y SÍ consta desde las 18:35.**
El orquestador volvió a preguntarlo SOLO, sin otra lista al lado (turno 36703, 18:27:33Z): «¿Autorizas que se
arregle el fallo del webhook de Stripe? Es la fecha que no se guarda al suscribirse. Hoy no mueve dinero real (está
en pruebas), pero toca el flujo de cobro, y por eso necesito tu sí o tu no escrito. Contéstame sólo a esto.»

> **«si autorizo»** — el fundador · transcripción `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl` · turno 36706 ·
> `uuid: 1c5a7185-addc-4245-9438-ef4f0313eb81` · `ts: 2026-10-18T18:35:52.798Z` (reloj de la transcripción) ·
> `type: user`, sólo texto · es el primer turno humano después de la pregunta.

Leído por S1 en la transcripción, no recibido de oídas. **Con eso el STOP de cobro queda levantado para ESTE
arreglo**, que hace J2: el fichero sigue siendo suyo. Lo de arriba no se borra: es por qué una autorización se
pide sola y se lee con su localizador. El «2 autorizo» que circuló antes no está en la transcripción.

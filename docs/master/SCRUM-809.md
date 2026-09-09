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

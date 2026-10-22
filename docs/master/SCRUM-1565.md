# SCRUM-1565 · El webhook de Stripe escribía `planExpiresAt: new Date("Invalid Date")`

**Medido contra:** `origin/main` = `dc1b2b4db78e75b1af0fcbc495912b29395938af` · 2026-10-19T12:28:30Z (hora de GitHub al escribir: 2026-10-20T09:23:49Z)
A9: comprobación → `tests/scrum809b-paywall-sin-banco.test.mjs`

Carril J2 · árbol `j2a-1565-fecha-invalida` · rama `scrum-1565-fin-de-periodo-clover`. Autorización del fundador
para tocar el cobro: «si autorizo», uuid `1c5a7185-addc-4245-9438-ef4f0313eb81`, 2026-10-18T18:35:52.798Z (leída por S1,
citada en `SCRUM-809.md`, tramo SCRUM-809c). La receta es la de S1 en ese mismo tramo.

## PASO 0: ¿estaba vivo?

| pregunta | cómo | resultado |
|---|---|---|
| ¿commits con el número? | `git log origin/main --grep="SCRUM-1565\b" -E` | 2 (`67bf965ac` y su merge `dc5aaae13`): el estado del producto de SCRUM-1563c, que sólo NOMBRA el ticket. Ninguno toca código |
| ¿registro previo? | `ls docs/master/ \| grep 1565` | ninguno |
| ¿guarda ya puesta? | `src/modules/billing/app/routes/stripe.routes.ts:175` en `origin/main` | `planExpiresAt: new Date((sub as any).current_period_end * 1000)`, sin guarda |

**Vivo.**

## ¿Puede llegar `current_period_end` vacío? Sí: llega vacío SIEMPRE

No es un caso raro. Es el payload normal de hoy:

- Desde la API de Stripe `2025-03-31`, `current_period_end` ya no está en la raíz de la `Subscription`. Está en cada
  item: `items.data[].current_period_end`. El SDK instalado (`stripe` 19.3.0) ya no lo tiene en el tipo de la
  `Subscription`, sólo en el de `SubscriptionItem` (`node_modules/stripe/types/SubscriptionItems.d.ts:53`). **Por eso
  estaba el `as any`**: sin él no compilaba, y con él el compilador no podía avisar.
- La versión del payload la fija el ENDPOINT, no el `apiVersion: '2024-06-20'` de `src/integrations/stripe.ts`. El
  endpoint de yaqu.app está en **`2025-10-29.clover`** (panel del fundador, SCRUM-809c).
- El panel guarda el 400 literal: `planExpiresAt: new Date("Invalid Date") … Provided Date object is invalid`, en
  `customer.subscription.updated`, 2 entregas fallidas (SCRUM-809c).

Entran por esa rama `customer.subscription.created` y `.updated` con `status` `active` o `trialing`. Con `clover`,
ninguno de los dos trae la fecha en la raíz. El `created` salió 200 en el panel. Lo más probable es que naciera
`incomplete`, que no entra en la rama. **No lo he medido**: lo dejó escrito S1 y sigue sin medir.

## ¿Revienta o entra como basura? Revienta, antes de llegar a la base

`docs/master/evidencias/SCRUM-1565/prisma-rechaza.cjs` usa el cliente de Prisma 6.18 de verdad, con una URL a un puerto
cerrado de loopback, así que no toca ninguna base. Pasa la misma llamada con tres valores:

| valor | resultado |
|---|---|
| fecha válida (control) | `Can't reach database server`: pasa la validación y llega a conectar |
| `new Date(undefined * 1000)` | `Invalid value for argument planExpiresAt: Provided Date object is invalid`, **antes** de conectar |
| `undefined` (el arreglo) | `Can't reach database server`: Prisma lo acepta, y significa «no toques la columna» |

Salida 0 con los tres veredictos a `true`. Una fecha inválida no entra nunca en Postgres. Lo que se pierde es el
`update` ENTERO: plan, estado y `stripeSubscriptionId` caen junto con la fecha. La ruta contesta 400 y Stripe
reintenta algo que el reintento no arregla.

**Hallazgo de paso, que el ticket no nombraba:** con `current_period_end` igual a `null`, `0` o negativo en la raíz,
la ruta de `main` no revienta. Escribe **1970-01-01**, una fecha válida y ya vencida (medido en el rojo de abajo).

## Qué le pasa al paywall

El paywall corta con `plan === 'trial' && planExpiresAt && planExpiresAt < new Date()` (`authMiddleware.ts:72`).

- **Hoy:** la fecha del pago no se escribe nunca, así que `planExpiresAt` se queda con la del trial (alta + 14 días,
  `auth.service.ts:358`). La cuenta QA tenía `2026-10-12T14:41:58.799Z`, ya en el pasado (SCRUM-809). Mientras paga
  no pasa nada, porque el plan es `pro`. **Al cancelar, el webhook pone `plan: 'trial'` y conserva esa fecha vencida
  (SCRUM-809), y el paywall corta con un 403 `trial_expired` AL INSTANTE**, no al acabar el periodo pagado. Si
  alguien se suscribe el día 3 del trial y cancela, conserva el acceso hasta el día 14, no hasta el fin del mes
  pagado. Le pasa a todo suscriptor nuevo.
- **No abre el paywall a nadie:** un `Invalid Date` en la columna haría que `<` diera siempre `false`, y nadie
  quedaría bloqueado nunca. Pero no llega a la columna (tabla de arriba).
- **El 1970 de `null`/`0`** acaba igual que hoy: 403 al cancelar.
- **Con el arreglo:** el test de abajo encadena la cadena por el middleware real (`requireActivePlan`). Primero el pago
  `clover`, que escribe la fecha del item. Luego `customer.subscription.deleted`, que no toca la fecha. Después
  `trial` con esa fecha: pasa. El control, con la fecha que se quedaba hoy, da 403.

## El arreglo (`stripe.routes.ts`, sólo la rama `active`/`trialing`)

`finDePeriodo(sub)` lee la raíz si trae un entero mayor que cero (API vieja). Si no, lee los items: sólo si todos traen
un entero mayor que cero **y coinciden**. Si los items no coinciden no se elige uno, porque esa política no está
decidida. Con fecha, se escribe como antes. Sin fecha, se guardan plan, estado y suscripción con
`planExpiresAt: undefined` (Prisma no toca la columna), sale un `console.warn` con el evento y el merchant, y se
contesta 200. El `as any` desaparece: la raíz se lee con un tipo estrecho (`{ current_period_end?: unknown }`).

**Lo que NO toca:** las dos puertas de cancelación (SCRUM-809, firmado el 7-sep). `past_due`/`unpaid`.
`checkout.session.completed`. El esquema. Ninguna base.

## El rojo primero, por la ruta real

`tests/scrum1565-fin-de-periodo-clover.test.mjs` usa el banco de scrum1402: el router de producción montado como en
`src/app.ts`, eventos FIRMADOS con HMAC local y la base doblada. El doble de `merchant.update` revienta ante una fecha
inválida con el mensaje de Prisma de la evidencia, y un test propio lo comprueba.

| contra | resultado |
|---|---|
| `stripe.routes.ts` de `origin/main` | **3 de 6 caen**: `clover` (400 con el mensaje del panel), sin fecha (8 de 8 payloads mal: 400 o 1970) y el paywall. Los 3 de control siguen en verde: raíz vieja, raíz que gana a los items y el control del doble |
| el arreglo | 6 de 6 |

Vecinos del webhook, con el arreglo: scrum1402, scrum809, scrum809b, scrum815 (los tres), webhooks-idempotencia,
scrum475 y scrum512. **72 tests, 64 pasan y 8 se saltan** (scrum809 necesita Postgres, `LIBRO_PG_URL`). `guards:entrada`:
15 guards, 170 tests, 0 fallos.

## Cambios en guards ajenos

- `tests/scrum815-idempotencia-del-webhook.test.mjs`: se añade `finDePeriodo: 1` al censo de efectos, con su motivo,
  como hizo SCRUM-1402 con `planQueExiste`. No es un efecto: no escribe en BD ni sale del proceso. El reparto de
  reversibles no cambia.
- `tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs`: la «Puerta 2» de `MUTACIONES_QUE_ME_TUMBAN` estaba anclada
  a `if (planQueExiste(…)) await prisma.merchant.update({`, y ahora la pregunta abre un bloque. La cazó
  `scrum836` en la tanda. Se reancla a `if (planQueExiste(planId, merchantId, event)) {` → `if (true) {`, que es la
  misma mutación: quitar la pregunta. **Aplicada a mano y medida:** scrum1402 cae en
  «(active, trialing) con un plan que NO existe» y en «el rechazo NO es un fallo de entrega». Después se deshizo,
  `git diff -- src` salió vacío y scrum836 quedó en verde.

## La tanda entera (en este árbol)

`node --test 'tests/*.test.mjs'`, con el TAP a un fichero fuera del árbol: **11.977 tests, 11.797 pasan, 24 fallan y
156 se saltan.** Los 24 se agrupan en 13 ficheros:

- 1 era mío: scrum836, por el ancla de arriba. Ya está arreglado.
- Los otros 23, en 12 ficheros, son del ENTORNO: scrum1199, 1298b, 222, 235, 245, 252, 385, 461, 471, 475, 476 y 733.
  Este árbol no tiene `node_modules` propio, hereda los del checkout compartido, y el cliente de Prisma de ahí no
  casa con `schema.prisma`. Los mensajes lo dicen: «no hay CLI de Prisma en node_modules», «EL CLIENTE DE PRISMA NO
  CORRESPONDE A schema.prisma», «no hay `node_modules` en este árbol», `Cannot find module …/node_modules/express`.
  **Ninguno de esos 12 ficheros nombra** `stripe.routes`, scrum815, scrum1402 ni SCRUM-1565 (lo comprobé con un
  guion sobre el TAP).
- **No los corrí contra `main` en este mismo árbol**, así que lo de «son del entorno» se apoya en el mensaje de cada
  uno y no en un control. El veredicto que vale es el del CI.

`tsc --noEmit`: 17 errores, todos en ficheros ajenos (`quotes.routes.ts`, `quotesAdmin.routes.ts`,
`merchantAdmin.ts` y `quoteAdmin.ts`), por el mismo cliente desfasado. En `stripe.routes.ts` hay 0.

## Error propio

Mi primera versión escribía la fecha con un spread (`...(fin ? { planExpiresAt: fin } : {})`). El censo por AST de
scrum809b busca `planExpiresAt` como clave escrita en la escritura del pago, que es su control positivo, y con el
spread salió ciego y en ROJO. **Se cambió el código, no el guard** (regla 41): `planExpiresAt: fin ?? undefined`
deja la clave a la vista y significa lo mismo para Prisma, y la evidencia lo mide. Antes, la primera pasada de mi
propia evidencia recortaba el mensaje a 400 caracteres y daba «rechazado = false» justo por el corte. Lo vi porque
el instrumento sale 1 cuando su veredicto no cuadra.

## Lo que queda fuera

- **La cuenta QA no se corrige sola.** Hay que reenviar desde el panel de Stripe la entrega fallida de
  `customer.subscription.updated`, después del despliegue. Antes del despliegue sólo repite el 400. Lo hace el fundador.
- Por qué `created` salió 200: sin medir (arriba).

## SCRUM-1565b · Sin víctima HOY, y cuánto duró: 1 evento, 3 entregas

**Medido contra:** `origin/main` = `e0c32fb5297e0ea98383d9f983ed8abfa67553c2` · 2026-10-20T09:50:25Z (hora de GitHub al escribir: 2026-10-20T10:03:14Z)
A9: sin fallo que generalice — este tramo sólo registra lo que trajeron el fundador y el orquestador, y el CI ya leído; aquí no se mide nada nuevo.

El arreglo de arriba entró en `main` con el PR #2619 (merge `47a78ef4`, 2026-10-20T09:47:30Z).

### Cómo se cuenta: bomba con fecha, no daño hecho

- **El defecto estaba VIVO en el código** desde que el endpoint pasó a la versión `clover`.
- **No tiene víctima HOY.** Stripe no está activado: no puede estarlo hasta que exista la SL (mediados de noviembre,
  SCRUM-143). El único comercio que tocó la suscripción es **una cuenta de prueba del equipo de Luis**. Literal del
  fundador, transmitido por el orquestador (`cobroflash-backend-09`): «no podemos hasta que tengamos la SL por eso no
  te preocupes».
- **La habría tenido el día del go-live** si no entra el arreglo: el primero que cancelara.

Donde arriba dice «le pasa a todo suscriptor nuevo» y «al cancelar, 403 al instante», es lo que **haría** el código.
**No hubo profesionales afectados.**

### Cuánto duró, por `gateway_events`

La consulta de solo lectura sobre `gateway_events` (filas de `customer.subscription.*` de Stripe con
`processed_at IS NULL` y `planExpiresAt` en el error) la corrió **el fundador**, no esta sesión. Su resultado, tal
como lo trajo el orquestador: **1 evento, 3 entregas, desde el 2026-10-18 a las 17:23:40**, igual en producción y en
staging. Las dos variantes de la consulta (con y sin el filtro por el texto del error) dan las mismas filas, así que
ese filtro no escondía nada. **Fueron dos días, no meses.**

- **Queda aparcado** reenviar la entrega fallida desde el panel de Stripe (arriba, «Lo que queda fuera»): era para
  recuperar el plan de una cuenta de prueba.

### El rojo de «guards de navegador» del PR #2619: no es de este ticket

Ese job no es el obligatorio, y el obligatorio («build + tests») salió en verde. El de navegador terminó con
veredicto, no colgado: «34 verdes · 1 CIEGO · 3 rojos» (`guard:cls-barra-anuncio`, `guard:objetivo-tactil` y
`guard:escalera-por-estado`, más `guard:marcadores-en-pantalla` CIEGO). El PR sólo toca `stripe.routes.ts`, tests y
`docs/master/`. **Control:** sobre `main` sale la misma anotación, letra por letra, en la base del PR (`dc1b2b4db`) y en `a60e12bf6`.
En la historia de `main`, leída de las anotaciones de los runs de CI:

| desde (el primer run de `main` en rojo que he visto) | qué aparece |
|---|---|
| ≤ `17a2d891b` 2026-10-16T12:57Z (el más antiguo leído) | `cls-barra-anuncio` |
| `4aae2b7d8` 2026-10-17T20:02Z (#2535) | + `objetivo-tactil` |
| `4d4c43773` 2026-10-17T22:33Z (#2548) | + `marcadores-en-pantalla` CIEGO |
| `57b0bc822` 2026-10-18T00:52Z (#2561, toca `public/dashboard/js/jobsView.js`) | + `escalera-por-estado` |

⚠️ **De quién es cada uno: SIN medir.** Que el rojo aparezca en un merge no quiere decir que ese merge lo cause.
#2535 y #2548 no tocan `public/` ni `scripts/guard-*`. Sólo #2561 toca una pantalla, y es una causa plausible que
nadie ha comprobado. Los guards son `scripts/guard-cls-barra-anuncio.mjs`, `scripts/guard-objetivo-tactil.mjs`,
`scripts/guard-escalera-por-estado.mjs` y `scripts/guard-marcadores-en-pantalla.mjs`. No se arreglan aquí: el ticket lo abre el orquestador.

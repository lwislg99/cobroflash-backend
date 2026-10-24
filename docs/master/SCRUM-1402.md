# SCRUM-1402 · El webhook de Stripe ya no escribe un plan que no existe, y lo dice · CRUCE DE CARRIL en UN fichero: `tests/scrum815-idempotencia-del-webhook.test.mjs` es compartido con el equipo de Luis (sección Ⓚ)

**Medido contra:** `origin/main` = `6aaec0dc8f0267518a50f626299ae901f81e2ae1` · 2026-10-06T13:26:13Z

A9: comprobación → `tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs`

Sesión J5d, por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). Ticket de
`area-j5`; lo puso «En curso» el orquestador el 6-oct-2026. El ticket no trae su lista bajo la palabra
«Aceptación»: el orquestador aceptó por mensaje que la aceptación son los puntos ①–⑤ de «Lo que pide»
más las consecuencias que fija el comentario 18019.

## Ⓐ La decisión, y dónde se puede leer

SCRUM-1402, comentario 18019 (2-oct-2026), publicado por el orquestador con la respuesta literal del
fundador: **«1-Ok A»**. Opción A: se **rechaza** el cambio de plan y el merchant se queda con el que
tenía. El mismo comentario fija cuatro cosas que mandan al construir, y las cuatro están hechas así:

| lo que dice el comentario 18019 | cómo queda |
|---|---|
| ① y ② se miden ANTES de construir | sección Ⓑ |
| el rechazo es RUIDOSO: valor entre comillas, merchant y planes que existen, con la forma de SCRUM-1342 | `planQueExiste`, en la ruta; sale en las tres puertas, impago incluido |
| la lista se DERIVA de `src/core/entitlements.ts` | la ruta importa `PLANES_CONOCIDOS`; un guard por AST lo sujeta |
| un plan legítimo se activa exactamente igual | sección Ⓓ |

## Ⓑ ① y ②: quién escribe `metadata.plan`

Medido por lectura de los caminos, sobre el ancla. Población: los sitios de `src/` y `scripts/` que
llaman a la API de Stripe (`checkout`, `subscriptions`, `customers`, `billingPortal`, `prices`,
`products`, `paymentIntents`): 15 llamadas en 7 ficheros, 0 sin mirar.

- **El único sitio del código que pone `metadata.plan`** es el checkout propio
  (`POST /admin/billing/checkout`, en `subscriptions.routes.ts`): lo pone en la sesión y en la
  suscripción, y el valor solo puede ser `founding` o un `id` de su lista `PLANS`, que hoy tiene uno:
  `pro`. Cualquier otro valor recibe un 400 `invalid_plan` antes de llegar a Stripe.
- La otra sesión de Checkout que crea el código (`payCard.routes.ts`, el cobro de una factura) es
  `mode: 'payment'` y no lleva `plan`. El portal de Stripe se abre sin metadatos. Los dos guiones de
  precios (`scripts/setup-stripe-prices.mjs`, `scripts/migrate-stripe-prices-live.mjs`) crean precios,
  no suscripciones.

**Para `pro` y `founding`, por tanto, esto es un cinturón de seguridad, y baja de prioridad**: el
código propio no puede mandar un valor de fuera de la lista. No se infla.

**Y el otro lado, que va junto:**

- `equipo` **no puede salir de nuestro código**: no está en `PLANS` y ninguna ruta lo pone. Es «oferta
  manual» (Parte W1 del máster). Si llega por el webhook es porque alguien lo escribió a mano en
  Stripe. **No consta** en `docs/` ningún procedimiento que diga cómo se activa Equipo, ni por Stripe ni
  por la base. No digo que no exista: digo que no lo he encontrado escrito.
- La firma del webhook se verifica, así que un tercero no puede inyectar un evento; y el cliente no
  puede editar los metadatos de su suscripción. Lo que queda es el panel o la API de Stripe con la
  clave de la cuenta. **Qué hay hoy en ese panel no lo he medido ni lo puedo medir**: esta sesión no
  toca claves.

## Ⓒ El rojo primero

`docs/master/evidencias/scrum1402/rojo-antes.txt`: el test sobre el código sin tocar (commit
`150c19eb3`, el primero de la rama). **12 casos · 7 pasan · 5 caen.** Por el router de producción, con
el evento firmado y la base doblada, los nueve valores inventados se escribían en `Merchant.plan` tal
cual: **9 de 9** en el checkout, 36 de 36 en la suscripción activa y 18 de 18 en el impago. Entre ellos
`constructor`, `toString` y `__proto__`, los que antes de SCRUM-1342 dejaban la cuenta sin límite de
usuarios. Pasan los que tienen que pasar siempre: los planes legítimos por las tres puertas, la
cancelación y la idempotencia.

## Ⓓ El arreglo

Un solo fichero de `src/`: `src/modules/billing/app/routes/stripe.routes.ts`. Una función,
`planQueExiste`, que pregunta a `PLANES_CONOCIDOS` y, si el plan no está, avisa y devuelve `false`. La
llaman las **tres** escrituras que copiaban `metadata.plan`: `checkout.session.completed` y, en
`customer.subscription.updated|created`, la rama activa y la del impago.

Lo que hace un rechazo: **en ese evento no se escribe nada en la fila del merchant.** Y sale un
`console.warn` como éste (es un log, no un texto que vea el usuario):

    [stripe] ⚠️ plan desconocido "Equipo" (merchant 12) en checkout.session.completed evt_…: NO se cambia
    el plan, el merchant se queda con el que tenía. Hay que mirarlo a mano en Stripe: puede haber un
    pago sin plan activado. Los planes que existen: trial, pro, founding, equipo.

**El positivo que manda**, medido y no supuesto: `trial`, `pro`, `founding` y `equipo` se escriben
byte a byte igual que antes por las tres puertas (4 casos en el checkout, 16 en la suscripción activa,
8 en el impago), con su premio al referido y su correo, y sin un solo aviso.

Lo que no se toca: la idempotencia por `event.id` (hay un caso que lo fija), las dos puertas de
cancelación (escriben el literal `trial`, no lo que llega, y siguen aplicándose venga el plan que
venga), `prisma/schema.prisma`, `src/core/entitlements.ts`, ningún límite de ningún plan, ninguna ruta
nueva, ningún texto de pantalla y nada de la emisión fiscal. No hay CHECK en la base.

## Ⓔ Tres consecuencias de «no se escribe nada», dichas una a una

Las vio el orquestador antes de empujar y las aceptó por mensaje; la tercera la sube al fundador.

1. **A Stripe se le contesta 200 y el evento queda procesado.** Un 400 le haría reintentar tres días
   algo que no va a cambiar. El aviso sale igual.
2. **En el checkout no salen ni el premio al referido ni el correo de primer pago.** No se ha activado
   nada, así que no se anuncia nada.
3. **Un impago (`past_due`, `unpaid`) que llega con un plan que no existe tampoco se marca.** Es
   consecuencia mecánica de la opción A. La alternativa —marcar el impago sin tocar el plan— no está en
   el comentario 18019 y no se ha construido. La frase para el fundador: *«Si la suscripción de un
   merchant lleva en Stripe un nombre de plan que no existe y ese merchant deja de pagar, YaQu no se
   entera del impago: no le sale el aviso de pago pendiente y conserva el plan que tuviera. Lo único
   que queda es una línea en el log. ¿Lo dejamos así, o el impago se marca aunque el plan no se toque?»*

## Ⓕ Lo que la decisión NO resuelve

**Ninguna de las dos salidas devuelve el dinero.** Si llega un pago con un plan que no existe, alguien
ha pagado algo que no se le ha dado, y eso lo resuelve el fundador a mano, caso por caso. El código no
lo adivina y no intenta compensarlo: lo único que hace es dejar de callarlo.

Y «ruidoso» es, hoy, una línea de `console.warn` en el log del servidor. Suena para quien lea ese log.
No he medido si alguien lo lee ni si hay una alerta montada encima; no he construido ninguna.

## Ⓖ Fuera de alcance, solo reportado

- **Una suscripción pagada que llega SIN `metadata.plan`** (o con él vacío) tampoco activa nada, y eso
  no lo dice nadie: ni antes ni ahora. La decisión habla del plan que no existe, no del que no viene.
  No se toca; el test lo fija como «sin cambios» y el ticket lo abre el orquestador.
- **`trial` está en la lista**, así que una suscripción activa con `metadata.plan = trial` se acepta.
  Qué límites tiene `trial` es SCRUM-1406, sin decidir; este trabajo no usa ninguno.
- Cómo se activa Equipo (sección Ⓑ) es pregunta para el fundador; la hace el orquestador.

## Ⓗ Mutaciones

Ocho declaradas en el propio test (`MUTACIONES_QUE_ME_TUMBAN`). Sonda local
`docs/master/evidencias/scrum1402/mutar.mjs`, con la base sin mutar primero; salida en
`docs/master/evidencias/scrum1402/mutaciones.txt`: **base 12 casos y 0 caen · 8 vivas · 0 mudas ·
0 ciegas, de 8.** Cubren las tres puertas sin validar, el rechazo callado, el rechazo de todo (el
arreglo peor que el defecto), la pregunta por lo que la lista hereda, la aceptación «amable» de
`Equipo` y la segunda lista copiada a mano. La red de la casa (`npm run meta:mutaciones`) no se ha
corrido en local: la corre el CI.

## Ⓘ Límites de lo medido

- El doble de la base no tiene estado. «Se queda con el que tenía» está medido como «no se escribe
  nada en su fila», no leyendo la fila después.
- El test monta el router como lo monta `src/app.ts` (misma ruta, mismo `rawBody`), pero no levanta
  `dist/app.js` entero. Que `app.ts` siga montándolo así lo cubren los tests de SCRUM-809 y SCRUM-100.
- `dist/` se emitió con `tsc --noCheck` (worktree anidado, sin cliente de Prisma propio): los tipos
  los comprueba el `build` del CI, no esta máquina.
- Nada se ha visto en `yaqu.app`: el cambio no tiene pantalla, y provocar el caso en producción sería
  mandar un evento de Stripe con dinero de verdad. No se hace.

## Ⓙ Lo corrido

Sobre la rama con `origin/main` = `6aaec0dc` ya mezclado, `dist/` emitido después del merge, y sin
`FORCE_COLOR` (comprobado en el mismo comando).

| qué | resultado |
|---|---|
| el test nuevo, solo | 12 casos · 12 pasan · 0 caen · 0 saltan |
| 30 ficheros sueltos (el nuevo, `scrum237`, `scrum976`, `scrum622`, los de registro `scrum267`/`scrum1294`/`scrum525d`/`scrum859`/`scrum1306`, `scrum921*`, `scrum710b`, `scrum850`, `scrum824`, `scrum864c`, los de `scrum815*`, `scrum475`, `scrum512`, `scrum1342`, `webhooks-idempotencia`) | 236 casos · 234 pasan · **1 cae** · 1 salta (pide `QA_DB_TEST`). El que cae es el censo de efectos de SCRUM-815: sección Ⓚ. Fue ANTES de declararlo |
| `npm run tanda:dirigida`, con turno del orquestador, 3.609 MB libres medidos justo antes | 306 ficheros de 1.248 · 2.956 casos · 2.949 pasan · **1 cae** · los 6 restantes no los desglosa el resumen (el TAP no se conservó). Terminó sola (5 min 39 s), no la mató nadie. Ya con el censo declarado |
| después de escribir este registro: el test nuevo, el de SCRUM-815 y los guards de registro y de suite (`scrum267`, `scrum1294`, `scrum525d`, `scrum921*`, `scrum710b`, `scrum859`, `scrum1306`, `scrum514`, `scrum237`, `scrum976`) | 163 casos · 163 pasan · 0 caen · 0 saltan |
| `npm run guards:entrada`, lo último | 13 guards · 158 casos · 0 caen |
| las mutaciones que OTROS tests declaran sobre el mismo fichero | 7 tests mirados, 10 mutaciones (8 de este ticket, 2 de `scrum809b`): las 10 siguen casando una sola vez |

**El único caído de la dirigida no es de este cambio:** «SCRUM-476 · SUELO: el censo de directorios
`node_modules` no puede dar cero» (`tests/scrum476-reconciliar-censos.test.mjs`). Este worktree es
anidado y no tiene `node_modules` propio —node resuelve hacia arriba—, así que ese suelo cae aquí por
la máquina. En el CI el árbol sí lo tiene. No lo he corrido en un árbol con `node_modules`: lo dirá el
obligatorio.

**No corrido:** la tanda completa (no es alcanzable en esta máquina; la da el obligatorio del CI), los
tests gateados por base (`scrum809`, `scrum340`, `scrum330`: recorren este mismo webhook contra un
Postgres; solo los ejecuta el CI) y `npm run meta:mutaciones`.

## Ⓚ El trinquete de SCRUM-815 que saltó, y lo que pide

`tests/scrum815-idempotencia-del-webhook.test.mjs`, caso «el censo de EFECTOS del manejador no crece
sin decirlo», cayó con el arreglo: cuenta por AST toda llamada no pura del manejador y `planQueExiste`
aparece tres veces. El fichero es compartido (lleva commits de los dos equipos), así que tocarlo es
cruce de carril; el orquestador lo autorizó por mensaje y avisa él al equipo de Luis.

**Lo que NO se hizo:** sacar la validación antes del corte del despacho para que el censo no la viera.
Habría dejado el guard verde sin medir nada.

**Lo que se hizo:** declararla. Una entrada, `planQueExiste: 3`, con su motivo. Ninguna otra cifra
cambia. Interrogado después: con una cuarta llamada inyectada (`git diff --numstat` 1/0), el caso
**cae** diciendo `planQueExiste: 4` contra `3`. Retirada la inyección, el árbol vuelve a ser el del
commit (0 diferencias).

**Y lo que el mensaje del guard manda hacer: releer la propuesta de columnas** (`docs/master/SCRUM-815.md`,
paso ①, §2 y §4, y el §4 del apéndice 815b). Releída con este cambio dentro:

- La propuesta **ya está aplicada** (la tabla `gateway_events` existe y el escritor está encendido para
  cinco tipos). Lo que queda por comprobar es si lo que la sostenía sigue siendo verdad.
- **El reparto de efectos no cambia:** 1 disputa, 3 salidas HTTP, 5 escrituras de plan, 1 recompensa y
  1 correo. No nace ningún efecto, y ninguno pasa de reversible a no reversible. Un rechazo solo
  **quita**: salta una escritura de plan y, en el checkout, también la recompensa y el correo.
- **El protocolo de tres pasos sigue igual:** un evento rechazado termina sin excepción, así que se
  cierra con `processed_at`; una segunda entrega del mismo evento se contesta sin trabajo. Repetirla no
  cambiaría nada: el plan seguiría sin existir.
- **Un matiz que la propuesta no contemplaba:** para ella `processed_at` puesto significa «terminó
  bien». Desde hoy también puede significar «se atendió y se rechazó». La tabla no distingue los dos:
  el rechazo consta **solo en el log**, no en `gateway_events` (`last_error` queda vacío). No he
  construido esa marca: no está en el comentario 18019.

Conclusión: **la propuesta sigue en pie.** Con ese matiz dicho.

Una cosa más, **inferida y no medida**: si alguien corrige el nombre del plan en la suscripción desde
Stripe, Stripe manda un `customer.subscription.updated` nuevo, con otro identificador, y ése sí entra y
escribe el plan. El premio al referido y el correo de primer pago no salen por ese camino.

# SCRUM-1402g · Qué hace hoy el webhook con una suscripción que llega SIN `metadata.plan` · carril J3 (su bloque en `stripe.routes.ts`, contenedor de J2) · SOLO MEDIR, sin código

**Medido contra:** `origin/main` = `2c45bf589aeae007eb12ed388b3e0f4d2d8d98ed` · 2026-10-23T20:55:47Z

A9: aviso → cicatriz J3 «Comparé dos versiones con una sonda cuya salida no podía distinguirlas: lo mismo habría salido si la copia de la rama no se hubiera cargado.» — no se pudo comprobar: es cómo monto una medición puntual fuera de la tanda; lo que queda es el control de versión dentro de `sonda-1402g.mjs`

Sesión jv-j3aw (puesto J3), por encargo del orquestador `cobroflash-backend-62`. Responde a Ⓖ de arriba
(«una suscripción pagada que llega SIN `metadata.plan` tampoco activa nada, y eso no lo dice nadie») y a
lo que dejaron abierto los comentarios 20651 y 20663. **No toca `src/` ni ningún test.**

## Cómo se ha medido

`docs/master/evidencias/scrum1402/sonda-1402g.mjs`: el mismo banco que `tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs`.
El router de producción montado como en `src/app.ts`, el evento **firmado** con un HMAC local (no viaja nada
a Stripe) y la base doblada con `tests/_envio-doblado.mjs`, que **no tiene estado**: se mide qué se
ESCRIBE en la fila del merchant, no la fila después.

**Población: 108 eventos por versión** — `checkout.session.completed` (modo suscripción),
`customer.subscription.created` y `.updated` en 8 estados de Stripe (`active`, `trialing`, `past_due`,
`unpaid`, `canceled`, `incomplete_expired`, `incomplete`, `paused`) y `customer.subscription.deleted`, cada
uno con 6 metadatos: `plan=pro` (control), **sin plan**, **plan vacío**, **sin metadata**, `plan` sin
`merchant_id` (control a cero) y un plan que no existe (control de versión).

**Dos versiones:** `main` en el ancla y la punta de #2782 (1402e, `efce6a0e6e7e82bdf4d2cb58c463d96ab84b9846`,
**sin mergear** al medir). La de 1402e se compiló sólo su `stripe.routes.ts` con `ts.transpileModule`; el
método se validó antes contra el `dist/` de `main` (byte a byte idéntico al de `tsc --noCheck`).

**Controles, en las dos versiones:** positivo **9 de 9** (`plan=pro` escribe `pro` en las 9 combinaciones que
escriben un plan: el checkout y `created`/`updated` en `active`, `trialing`, `past_due` y `unpaid`) · a cero **0** (sin `merchant_id` no se escribe nada) · de versión **0 de 4 en
`main` y 4 de 4 en 1402e** (plan que no existe + impago). Las dos salidas difieren en esas 4 filas y en
ninguna más. Salidas: `sonda-1402g-main.txt` y `sonda-1402g-1402e.txt`, en la misma carpeta.

## La tabla — con `merchant_id` y SIN plan (sin la clave, o vacía: dan lo mismo en las 18 puertas)

| evento · estado en Stripe | qué escribe en `Merchant` | qué contesta a Stripe | registro `gateway_events` | aviso o log | estado de la Parte L en YaQu | se pierde en silencio |
|---|---|---|---|---|---|---|
| `checkout.session.completed` (control `pro`: `{stripeCustomerId, plan:'pro', subscriptionStatus:'active'}` + premio + correo) | **nada** | 200 `{"received":true}` | no lleva (va por el LRU en memoria) | **ninguno** | se queda en el que tenía (un alta nueva, en `trial`) mientras Stripe cobra: **`trial → active` no ocurre** | **sí**: la activación, el premio al referido y el correo de primer pago |
| `sub.created` / `.updated` · `active`, `trialing` | **nada** | 200 | abre y marca `processedAt` (sin `lastError`) | **ninguno** | el que tenía; **la renovación no mueve `planExpiresAt`** ni guarda `stripeSubscriptionId` | **sí** |
| `sub.created` / `.updated` · `past_due`, `unpaid` | **nada**, **también con 1402e** (medido: idéntico) | 200 | `processedAt` | **ninguno** | **`active → past_due` no ocurre**: no sale el banner de pago pendiente | **sí** — es el caso de 20651 sin plan, y 1402e no lo cubre (lo dice su c.20663) |
| `sub.created` / `.updated` · `canceled`, `incomplete_expired` (control `pro`: `{plan:'trial', subscriptionStatus:'canceled', stripeSubscriptionId:null}`) | **nada** | 200 | `processedAt` | **ninguno** | **`active → canceled` no ocurre**: el merchant conserva el plan de pago y `subscriptionStatus:'active'` | **sí**, y en el sentido contrario: **YaQu sigue dando lo que ya no se paga** |
| `sub.created` / `.updated` · `incomplete`, `paused` | nada (igual que con plan) | 200 | `processedAt` | **ninguno** — con plan sale el log «estado de suscripción sin mapeo directo»; sin plan, ni eso | el que tenía (igual que con plan) | sólo la línea de log |
| `customer.subscription.deleted` | **`{plan:'trial', subscriptionStatus:'canceled', stripeSubscriptionId:null}`, igual que con plan** | 200 | `processedAt` | ninguno (tampoco con plan) | **coherente**: `→ canceled` | no |

**Sin `metadata` del todo** (ni `merchant_id`): nada en **ninguna** de las 18 puertas, `deleted` incluida;
200 y ningún aviso. Es lo mismo que el control a cero: sin `merchant_id` el webhook no sabe de quién es.

**El porqué, leído en el código y no supuesto:** en `customer.subscription.created|updated` toda la
máquina de estados, **la cancelación incluida**, cuelga de `if (Number.isInteger(merchantId) && planId)`
(`src/modules/billing/app/routes/stripe.routes.ts:175` en el ancla), aunque la cancelación escribe el
literal `trial` y no usa `planId`. `customer.subscription.deleted` sólo pide `merchant_id` (`:228`). En
el checkout, la condición es `merchantId && planId && s.customer && planQueExiste(…)` (`:133`).

## Lo que esto añade a Ⓖ

1. **Ⓖ se queda corta:** no es sólo que «no activa nada». **Sin plan, tampoco se marca el impago ni se
   aplica la cancelación que llega por `updated`.** De las cuatro transiciones de la Parte L que mueve el
   webhook, sin plan sólo ocurre una: la cancelación por `deleted`.
2. **Las 17 puertas que no escriben callan:** ni un `console.warn` ni un `console.log`. Lo contrario que
   pidió el fundador para el plan que no existe (c.18019: «el rechazo tiene que ser RUIDOSO»).
3. **Stripe no vuelve a intentarlo:** la respuesta es 200 y, en los cinco tipos con registro, la entrega
   queda con `processedAt` y sin `lastError`. *Leído en el código, no medido:* una segunda entrega del
   mismo evento se contesta «duplicate» sin trabajo (`stripe.routes.ts:96-98`), así que arreglar el código
   después no recupera ese evento: haría falta uno nuevo.
4. **1402e (#2782) no cambia nada de esto:** las 18 puertas sin plan dan lo mismo en las dos versiones.

## Lo que NO se ha medido

- **Si en la práctica llega alguna suscripción sin plan.** Nuestro checkout la pone siempre, en la sesión
  y en la suscripción (`subscriptions.routes.ts`, `subMeta`, sección Ⓑ), y además guarda el
  `stripeCustomerId` ANTES de mandar a Stripe. Sin plan sólo llega lo creado o editado a mano en el panel
  o la API de Stripe. Qué hay hoy en ese panel no lo puedo medir: esta sesión no toca claves.
- **Qué eventos manda Stripe de verdad en cada caso** (si una cancelación llega por `updated` con
  `status: canceled`, por `deleted`, o por los dos). Inferido de la documentación de Stripe, no medido:
  una baja al final del periodo suele llegar por `deleted`, que funciona; `incomplete_expired` llega por
  `updated` y es un primer pago que nunca entró. Si eso es así, el hueco de la cancelación es más
  estrecho de lo que dice la tabla; **no lo afirmo**.
- **La fila después:** el doble de la base no tiene estado; «se queda con el que tenía» es «no se escribe
  nada en su fila».
- Nada en `yaqu.app`: provocarlo exigiría un evento de Stripe de verdad. No se hace.

## La pregunta para el fundador (no elijo)

> «Si llega de Stripe una suscripción de un merchant SIN el nombre del plan (sólo puede pasar si alguien
> la crea o la edita a mano en Stripe), hoy YaQu no hace nada y no lo dice a nadie: no activa el plan
> aunque pague, no marca el impago, y si se cancela le deja el plan de pago, salvo cuando Stripe borra la
> suscripción del todo. ¿Qué hacemos?»

- **A · Avisar y nada más.** Sigue sin escribir nada, pero cada evento sin plan deja una línea en el log
  con el merchant y el evento, como el plan que no existe.
- **B · Tratarla como un plan que no existe.** El plan no se toca y se avisa (c.18019), el impago se marca
  (c.20651) y la cancelación se aplica: pasa a `trial`, igual que cuando Stripe la borra.
- **C · Sólo la cancelación.** La cancelación se aplica siempre que venga el merchant, con plan o sin él
  (lo que ya hace `deleted`); lo demás sigue como hoy, con aviso.

Ninguna de las tres pide un estado ni un texto nuevos: `past_due`, `canceled` y `trial` ya están en la
Parte L (`YAQU_MASTER.md`, línea de **Subscription**). Ninguna devuelve dinero.

## Lo corrido

| qué | resultado |
|---|---|
| `tsc --noCheck` del árbol en el ancla | salida vacía, código 0 |
| control del método de compilación de 1402e: `transpileModule` de `stripe.routes.ts` de `main` contra el de `tsc` | idéntico byte a byte |
| la sonda sobre `main` | 108 eventos · positivo 9/9 · cero 0 · versión 0/4 · MIDE · código 0 |
| la sonda sobre la punta de 1402e | 108 eventos · positivo 9/9 · cero 0 · versión 4/4 · MIDE · código 0 |
| `diff` de las dos salidas (sin la línea de cabecera ni la de controles) | 4 filas distintas, las 4 del control de versión |
| guards de registro y de suite (`scrum1294`, `scrum267*`, `scrum525d*`, `scrum921*`, `scrum859*`, `scrum1306*`, `scrum273*`, `scrum710b*`) más `scrum1402`, con este tramo y la cicatriz dentro | 106 casos · 106 pasan · 0 caen · 0 saltan |
| `npm run guards:entrada` | 15 guards · 170 casos · 0 caen |
| los 5 de árbol entero (`scrum195`, `scrum414`, `scrum694`, `scrum710b`, `scrum737`) | 38 casos · 38 pasan · 0 caen · 0 saltan |

**Sin correr:** la tanda completa y los gateados por base (no se ha cambiado ningún test ni nada de `src/`). La copia de
`dist/` para 1402e se creó dentro del árbol y se borró en la misma orden; `git status` lo comprobó.

# SCRUM-1402e · El impago de una suscripción con un plan que no existe se marca igual · carril J3 (su bloque en `stripe.routes.ts`, contenedor de J2)

**Medido contra:** `origin/main` = `cc06e4a72a62accb2ca8c0115d1bf40ded968924` · 2026-10-23T20:36:12Z

A9: comprobación → `tests/scrum1402e-impago-con-plan-desconocido.test.mjs`

## La decisión

SCRUM-1402, comentario **20651** (23-oct-2026), respuesta del fundador a la pregunta de Ⓔ.3: **«Marcar el
impago»**. El impago se marca y sale el aviso de pago pendiente que ya existe, aunque el plan no se
toque; el plan desconocido se sigue ignorando como hace la opción A (#2222). No cubre ningún texto nuevo
ni ninguna transición de la Parte L que no exista.

## El arreglo

Un bloque de `src/modules/billing/app/routes/stripe.routes.ts`, la rama `past_due`/`unpaid` de
`customer.subscription.updated|created` (marcada `// J3 · SCRUM-1402e`). Antes: si `planQueExiste` decía
que no, no se escribía nada. Ahora se escribe siempre una vez, y con un plan desconocido la escritura es
**exactamente** `{ subscriptionStatus: 'past_due' }`: ni `plan` ni `stripeSubscriptionId`.

- **Estado:** `past_due` es el mismo que escribe hoy el impago con un plan conocido (A10.2, FSM de la
  Parte L en el propio fichero). No nace ningún estado ni ninguna transición.
- **Aviso:** el que ya existe. `/me` sirve `subscriptionStatus` de la fila del merchant (`src/app.ts`,
  SCRUM-809b) y el panel pinta el banner cuando vale `past_due` (`public/dashboard/js/app.js`, «A10.2
  (Parte L): past_due → banner»). Ningún texto nuevo; tampoco el `console.warn` del plan, que sale igual.
- **Lo que no se toca:** las ramas activa y de cancelación, el checkout, la idempotencia, `entitlements.ts`,
  `prisma/schema.prisma`, la emisión fiscal. El censo de efectos de SCRUM-815 no cambia: siguen siendo 5
  `prisma.merchant.update` y 3 `planQueExiste` (la llamada se hace una vez y elige el `data`).

## Rojo primero, por la ruta real

El test nuevo monta el router como `src/app.ts` (`/webhooks/stripe`, `rawBody`, `router`) y le manda
eventos firmados con un HMAC local; la base va doblada, nada viaja a Stripe. Sobre el código sin tocar
(`b6dd5d1a8`): **6 casos · 4 pasan · 2 caen**. El que manda: **36 de 36** impagos con plan desconocido sin
marcar (2 eventos × 2 estados × 9 valores). El otro, el de la regla 2, cae porque no había escritura que
mirar. Salida en `docs/master/evidencias/scrum1402/rojo-antes-1402e.txt`.

## Controles (en el mismo fichero)

| control | qué mide | resultado |
|---|---|---|
| plan conocido + impago | 16 casos: `plan`, `past_due` y la suscripción, byte a byte como hoy, sin aviso | pasa antes y después |
| plan desconocido sin impago (`active`, `trialing`) | 36 casos: no se escribe nada (el plan no cambia), un aviso; positivo con `pro` activo | pasa antes y después |
| regla 2 | el impago de un merchant escribe sólo `where: { id }` de ese merchant, ninguna escritura masiva | cae antes (no había escritura), pasa después |
| respuesta a Stripe | 200 y el mismo cuerpo (`{"received":true}`) que con un plan legítimo; el evento queda procesado, sin error | pasa antes y después |

`tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs` fijaba «el impago con plan desconocido no
escribe NADA», que es justo lo que la decisión cambia. Se le ha cambiado esa aserción a lo que sigue
siendo cierto —**no escribe el PLAN**— y su mutación de la puerta 3 pasa a ser la del defecto que guarda:
que con un plan desconocido se escriba también el plan. Ese test no es un guard (no lo nombra ningún
trinquete); lo cambio porque su propio enunciado lo pide la decisión de 2-oct, y la de 23-oct lo sustituye.

## Mutaciones

Sonda `docs/master/evidencias/scrum1402/mutar.mjs`, con un segundo argumento opcional para el test (sin él,
como antes). Base sin mutar primero.

- `scrum1402e`: **base 6 casos y 0 caen · 3 vivas · 0 mudas · 0 ciegas, de 3** (volver a no escribir nada;
  escribir también la suscripción; dejar de escribir el plan legítimo). `mutaciones-1402e.txt`.
- `scrum1402`, re-corrido tras el cambio: **8 vivas · 0 mudas · 0 ciegas, de 8**. `mutaciones-1402-tras-1402e.txt`.

`npm run meta:mutaciones` no se ha corrido en local: lo corre el CI.

## Lo corrido

Sobre la rama con `origin/main` = `cc06e4a72` ya mezclado (no tocaba ninguno de estos ficheros), `dist/`
re-emitido después del merge y sin `FORCE_COLOR`.

| qué | resultado |
|---|---|
| el test nuevo + `scrum1402`, `scrum815-idempotencia`, `scrum1565`, antes del merge | 4 ficheros · 30 casos · 30 pasan · 0 caen |
| 32 ficheros: los dos de este ticket, `scrum1342`, `scrum1565`, los seis `scrum815*`, los de suite (`scrum237`, `976`, `824`, `824b`×2, `836`, `419`, `702`, `700`, `719`, `1415`, `113`, `262`) y los de registro (`scrum267`, `273`, `1294`, `525d`, `859`, `1306`, `921`, `921c`, `710b`) | 299 casos · 299 pasan · 0 caen · 0 saltan (TAP de 129.088 B; 12 líneas nombran `SCRUM-1402e`) |
| `npm run guards:entrada` | 15 guards · 170 casos · 0 caen |
| los 5 de árbol entero que nombra esa salida (`scrum195`, `414`, `694`, `710b`, `737`) | 38 casos · 38 pasan · 0 caen |

**No corrido:** la tanda completa (la da el obligatorio), los gateados por base (`scrum809`, `scrum340`,
`scrum330`, que recorren este webhook contra un Postgres) y `npm run meta:mutaciones`. La fila de 32 ficheros
se corrió con este tramo ya escrito salvo esta tabla; los de registro se vuelven a correr tras escribirla.

## Límites de lo medido

- El doble de la base no tiene estado: «el plan no se toca» es «la escritura no lleva `plan`».
- El banner no se ha visto pintarse para este caso: el test mide el campo que el banner lee, y que `/me`
  lo sirve de la fila lo cubre SCRUM-809b. En `yaqu.app` no se ha visto nada: provocar el caso es mandar
  un evento de Stripe de verdad. No se hace.
- `dist/` emitido con `tsc --noCheck` (worktree anidado): los tipos los comprueba el `build` del CI.
- **No lo resuelve esto:** Ⓑ (cómo se activa Equipo) y Ⓖ (la suscripción sin `metadata.plan`), abiertos
  según el propio comentario 20651. Una suscripción en impago SIN `metadata.plan` sigue sin marcarse.

# SCRUM-1402h · La suscripción sin `metadata.plan` se trata como un plan que no existe · carril J3 (su bloque en `stripe.routes.ts`, contenedor de J2)

**Medido contra:** `origin/main` = `eb43dbe5b94aab3fa11da2f2dc721e82381b1954` · 2026-10-23T21:23:51Z

A9: comprobación → `tests/scrum1402h-sin-plan-como-plan-desconocido.test.mjs`

## La decisión

SCRUM-1402, comentario **20681** (23-oct-2026), respuesta del fundador a Ⓖ de 1402g (c.20677): **«B · Como
plan desconocido»**. El plan del merchant no se toca; lo que no depende del plan se aplica igual: el impago
(`past_due`, con el aviso que ya existe) y la cancelación; la activación y la renovación de un plan que no se
sabe cuál es quedan como hoy, con su línea en el log. Ningún texto nuevo, ninguna transición nueva de la
Parte L, la respuesta a Stripe no cambia.

## El arreglo

Una línea de `src/modules/billing/app/routes/stripe.routes.ts`, la puerta de
`customer.subscription.updated|created` (marcada `// J3 · SCRUM-1402h`): `if (Number.isInteger(merchantId)
&& planId)` pasa a `if (Number.isInteger(merchantId))`. Lo demás sale de lo que ya había:
`planQueExiste('')` es `false` y avisa, así que activar y renovar no escriben; el impago escribe
`{ subscriptionStatus: 'past_due' }` (1402e); la cancelación escribe el literal `trial`, como con plan.

- **Lo que no se toca:** el checkout (sin plan sigue sin escribir y sin avisar: 1402h no lo cubre),
  `customer.subscription.deleted`, la idempotencia, `entitlements.ts`, `prisma/schema.prisma`, la emisión
  fiscal. El censo de efectos de SCRUM-815 no cambia: 5 `prisma.merchant.update` y 3 `planQueExiste`.
- **Por qué esta forma y no otra:** una rama aparte para «sin plan» añadía escrituras al censo de SCRUM-815,
  y poner `planId &&` delante de la puerta activa rompía el ancla de la mutación 2 de `scrum1402`.

## Rojo primero, por la ruta real

Test nuevo con el mismo banco que 1402e (router montado como en `src/app.ts`, evento firmado con HMAC local,
base doblada; nada viaja a Stripe). Sobre `main` sin tocar: **7 casos · 3 pasan · 4 caen**. Los dos que
mandan: impago sin plan **8 de 8** sin marcar y cancelación sin plan **8 de 8** sin aplicar (2 eventos × 2
estados × «sin la clave» y «plan vacío»). Los otros dos caen porque no había escritura que mirar (regla 2) ni
línea en el log (activar sin plan). Salida en `docs/master/evidencias/scrum1402/rojo-antes-1402h.txt`. Después: 7 de 7.

## La sonda de 1402g, fila a fila

`sonda-1402g.mjs` (en `main` desde #2788) sobre `main` y sobre el arreglo: **108 eventos** en las dos, positivo
9/9, cero 0, MIDE, código 0 (`sonda-1402h-antes.txt`, `sonda-1402h-despues.txt`). La comparación es por
(tipo, estado, metadata), no por posición: `compara-1402h.mjs`, que sale CIEGA (código 2) si las dos
poblaciones no son el mismo conjunto o una no dice MIDE. Controles del comparador: una salida contra sí misma da
0 de 108 distintas; contra una salida cortada a 300 B da CIEGA.

**32 de 108 filas cambian, todas «sin plan» o «plan vacío» de `sub.created|updated`; 76 idénticas**
(`compara-1402h.txt`): el checkout, `deleted`, `plan=pro`, plan desconocido, sin metadata y el control a cero.

| filas que cambian | escritura | aviso / log |
|---|---|---|
| impago (`past_due`, `unpaid`) · 8 | `{"subscriptionStatus":"past_due"}` | 1 aviso del plan (`""`) |
| cancelación (`canceled`, `incomplete_expired`) · 8 | `{"plan":"trial","subscriptionStatus":"canceled","stripeSubscriptionId":null}` | ninguno, como con plan |
| activar y renovar (`active`, `trialing`) · 8 | **ninguna, igual que antes** | **1 aviso nuevo** |
| `incomplete`, `paused` · 8 | **ninguna, igual que antes** | **1 log nuevo** («sin mapeo directo», el mismo que con plan) |

🔴 **Lo digo porque el encargo pedía que sólo cambiaran las filas de impago y cancelación:** las 16 de abajo
cambian en el log, no en lo que se escribe ni en la respuesta. Es lo que hace un plan desconocido en esas
mismas filas, y c.20681 dice «con su línea en el log»; si el fundador no quería esas líneas, se quitan sin
tocar la base.

## Controles (en el mismo fichero)

| control | qué mide | resultado |
|---|---|---|
| activar y renovar sin plan | 8 casos: no se escribe nada, una línea de log; positivo con `pro` activo | cae antes (no había línea), pasa después |
| plan legítimo (`pro`, `equipo`) | 12 casos: activar, impago y cancelación byte a byte como hoy, sin aviso | pasa antes y después |
| sin `merchant_id` y sin plan | 4 casos: nada escrito, 200 | pasa antes y después |
| regla 2 | la cancelación y el impago sin plan escriben sólo `where: { id }` de ese merchant, ninguna masiva | cae antes (no había escritura), pasa después |
| respuesta a Stripe | 200 y `{"received":true}`, el mismo cuerpo que con plan; evento procesado, sin error | pasa antes y después |

`tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs` tenía un caso 📌 que fijaba «sin `metadata.plan`
ni escribe ni avisa … no está decidido». Ya está decidido. Se le cambia a lo que sigue siendo cierto: **no
se ACTIVA nada** (el checkout y la suscripción activa no escriben), el checkout sigue sin avisar y la
suscripción activa deja ahora su línea. No es un guard (no lo nombra ningún trinquete), y es el mismo tipo de
cambio que hizo 1402e en ese fichero.

## Mutaciones

A mano con `docs/master/evidencias/scrum1402/mutar-1402h.mjs` (aplica en `src/`, emite `dist/` con `tsc
--noCheck`, corre el test, exige que caiga un caso cuyo nombre contiene `cae`, restaura y compara por bytes).
Base sin mutar primero.

- `scrum1402h`: **base 7 y 0 caen · 3 vivas de 3** (la puerta vuelve a pedir plan; sólo la cancelación,
  que es la opción C; «sin plan» pasa por plan que existe). `mutaciones-1402h.txt`, con las de `scrum1402e`:
  **base 6 · 3 vivas de 3**.
- `scrum1402`: con el arreglo y antes de cambiarle el caso 📌, la base no salía verde y la sonda la dio por
  CIEGA, que es como lo vi. El reporter `spec` dice **12 casos · 11 pasan · 1 cae** (el 📌); mi sonda contó
  «10 pasan, 2 caen». **Error mío, sin investigar:** su lector de TAP cuenta mal cuando cae un caso; suman 12,
  así que el control de la suma no lo habría cazado. No cambia ningún veredicto de abajo (sólo se fía de los
  nombres que caen, y con la base verde contó 12 de 12 y 7 de 7 como `spec`). Tras el cambio: **base 12 y 0
  caen · 8 vivas de 8**. `mutaciones-1402-tras-1402h.txt`.

`npm run meta:mutaciones` no se ha corrido en local: lo corre el CI.

## Lo corrido

Sobre la rama con `origin/main` = `eb43dbe5b` mezclado (fast-forward: sólo traía docs, entre ellos 1402g),
`dist/` emitido con `tsc --noCheck` después del arreglo.

| qué | resultado |
|---|---|
| 34 ficheros: los tres de este ticket (`1402`, `1402e`, `1402h`), `scrum1342`, `scrum1565`, los seis `scrum815*`, los de suite (`scrum237`, `976`, `824`, `824b`×2, `836`, `419`, `702`, `700`, `719`, `1415`, `113`, `262`) y los de registro (`scrum267`, `273`, `1294`, `525d`, `859`, `1306`, `921`, `921c`, `710b`) | 306 casos · 306 pasan · 0 caen · 0 saltan (TAP de 131.280 B; 15 líneas nombran `1402h`) |
| los 17 ficheros de `tests/` que nombran `stripe.routes` | 126 casos · 125 pasan · 0 caen · 1 salta (`QA_DB_TEST`) |
| `npm run guards:entrada` | 15 guards · 170 casos · 0 caen |
| los 5 de árbol entero (`scrum195`, `414`, `694`, `710b`, `737`) | 38 casos · 38 pasan · 0 caen · 0 saltan |

**No corrido:** la tanda completa (la da el obligatorio), los gateados por base (`scrum809`, `scrum340`,
`scrum330`, que recorren este webhook contra un Postgres; su verde no habla de ellos) y `meta:mutaciones`. La fila
de 34 ficheros se corrió con este tramo escrito salvo esta sección; los de registro se vuelven a correr tras ella.

## Límites de lo medido

- El doble de la base no tiene estado: «el plan no se toca» es «la escritura no lleva `plan`».
- **No está medido si llega en la práctica una suscripción sin plan** (lo dijo 1402g: nuestro checkout lo pone
  siempre; sólo lo creado o editado a mano en Stripe). Nada se ha visto en `yaqu.app`: provocarlo es mandar un
  evento de Stripe de verdad. No se hace.
- **Leído en el código, no medido:** `Number('')` es `0`, que es entero. Un evento con `merchant_id: ''` y sin
  plan, en impago o cancelado, intenta ahora escribir en el merchant `0`, igual que ya hacía `deleted` y que
  hacía esta misma puerta con plan. No lo cambio: no es de este ticket.
- El checkout sin plan no se mueve: sigue sin escribir y sin avisar (c.20681 habla de la suscripción).
- `dist/` emitido con `tsc --noCheck` (worktree anidado): los tipos los comprueba el `build` del CI.
- **De paso:** al mezclar `main`, el tramo 1402g terminaba pegado al encabezado de 1402e, sin línea en blanco
  (lo dejó así la mezcla de #2788). Se la he puesto; no cambia ninguna línea más.

# SCRUM-1402i · Ⓑ medido: cómo se activa hoy el plan Equipo, de punta a punta · sólo docs, carril J5

**Medido contra:** `origin/main` = `c6d3aa11f15a0a582f92b8ec4a8c9838ea426dd8` · 2026-10-24T15:35:19Z

A9: sin fallo que generalice — el único error propio (correr `carriles.mjs` en un árbol 11 commits por detrás) ya lo cubre el aviso de `CLAUDE.md` de medir sobre `origin/main`; repetido tras `merge --ff-only` dio los mismos dueños

Sesión jv-j5ak (puesto J5), por encargo del orquestador `cobroflash-backend-95`. **Sólo se mide y se pregunta:
no hay código.** Lectura de `origin/main` con `git show`/`git grep`. No se ha llamado a Stripe ni mirado su panel,
y nada se ha visto en yaqu.app. Entrega en Jira: **SCRUM-1402, comentario 20825** (allí van las preguntas enteras).

## Lo hecho en main, y lo único abierto

③④ #2222 (`c6606bd5c`) · Ⓔ.3 #2782 (`a0673b33a`) · Ⓖ medido #2788 (`25c673a30`) · Ⓖ construido #2795
(`34e90eb10`). **Abierto: sólo Ⓑ.** No consta en `docs/` ningún procedimiento de activación (búsqueda de
`yaqu_equipo_monthly`, `plan='equipo'`, `metadata.plan…equipo`; control positivo: la misma búsqueda encuentra
el censo de SCRUM-1496f).

## La cadena, medida

| tramo | hoy | dónde |
|---|---|---|
| precio | `yaqu_equipo_monthly`, 59 €/mes, sin anual; existencia en Stripe SIN MEDIR | `scripts/setup-stripe-prices.mjs:26`, `src/modules/billing/domain/stripePrices.ts:15` |
| quién lo usa | nadie: `resolvePriceId` tiene 2 llamadas, ninguna con `equipo_monthly` | `subscriptions.routes.ts:97`, `:101` |
| checkout | `equipo` → 400 `invalid_plan` | `subscriptions.routes.ts:14-24`, `:99-100` |
| escritura de `Merchant.plan='equipo'` | sólo el webhook, con `metadata.merchant_id` y `metadata.plan` exacto `equipo` | `stripe.routes.ts:133`, `:188` |
| nombre mal escrito o ausente | no activa; `console.warn` | `stripe.routes.ts:46` |
| qué desbloquea | sólo `maxUsers: 5`; `waFairUseMonthly` sin ningún lector en `src/` (control: `maxUsers`, 1 lector) | `src/core/entitlements.ts:21`, `team.routes.ts:75-79` |
| cómo se pide | «escríbenos y te lo activamos» en el 409 | `team.routes.ts:84` |

Lo que ve quien tiene `equipo` (leído, no ejecutado): «Plan activo: Pro» (`plansView.js:86`); banner founding
(`:40`); botón «Suscribirme» activo (`:46`, `:181`) y un checkout que no mira si ya hay suscripción
(`subscriptions.routes.ts:70-130`); «equipo» en crudo en la barra lateral (`app.js:184`); correo «Bienvenido al
plan Pro» (`lifecycle.service.ts:167`, `:176`).

**Lo que el ticket daba por cierto y no lo es:** «`equipo` tiene que seguir funcionando» vale por el webhook,
pero ningún camino de YaQu lo pone. Y las dos cancelaciones (`stripe.routes.ts:229`, `:244`) escriben `trial`
sin comparar `sub.id` con `stripeSubscriptionId`: con dos suscripciones vivas, cancelar la vieja baja a `trial`
a quien paga la nueva (leído, sin sonda).

## Las preguntas (texto entero en c.20825)

- **P1** ¿Equipo se activa en Stripe sobre la MISMA suscripción (precio + `metadata.plan = equipo`) con
  procedimiento en `docs/RUNBOOKS.md`? Recomiendo ✅. Sólo docs, sesión J.
- **P2** ¿Antes del primer Equipo se quita la oferta de Pro/founding a quien ya paga y se rechaza la segunda
  suscripción? Recomiendo ✅ (J3, GO de dinero). Los nombres «Plan activo: Equipo» y «Plan Equipo» piden firma
  (regla 39); la barra lateral es S2.
- **P3** ¿La cancelación sólo baja el plan si es la suscripción apuntada? Recomiendo ❌ si P1 y P2 son ✅;
  ✅ si no (J3).

## Carriles (`node scripts/carriles.mjs de`, tras traer main)

`stripe.routes.ts` J2 (contenedor; bloques de J3) · `subscriptions.routes.ts` J3 · `plansView.js` J3 ·
`lifecycle.service.ts` J3 · `entitlements.ts` S1 · `team.routes.ts` S1 · `app.js` S2 · `docs/RUNBOOKS.md` sin
fila · `scripts/setup-stripe-prices.mjs` sin cerradura.

## Límites de lo medido

- Sin medir: el contenido de la cuenta de Stripe (precio de Equipo, configuración del portal).
- Ninguna consecuencia se ha ejecutado: cancelación y doble suscripción, leídas en el código. La sonda de 1402g
  podría medirlas sin Stripe.
- Que cambiar el precio en Stripe no cambia `metadata.plan` es comportamiento de Stripe sin medir aquí.
- La hora del ancla es la del commit de `main`, no la cabecera `Date:` de GitHub.
- Sin tanda, sin build, sin tests: sólo docs. El obligatorio lo dice el CI.

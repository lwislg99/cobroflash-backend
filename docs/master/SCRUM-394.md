# SCRUM-394 · El plan de mantenimiento que se paraba en silencio

**Fecha:** 7-ago-2026 · **Carril:** S3 · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T19:13:03+01:00
**Tanda:** 2211 tests · 2138 pass · **0 fail** · 73 gateados

> El cron comprueba `customer.waOptOut` para decidir si propone, y **la propuesta va al
> PROFESIONAL**, que no es quien se dio de baja. El plan dejaba de proponerse y el único rastro era
> el `skipped` del log del cron, que él no ve jamás. «Todavía no le toca» y «se paró por el opt-out
> de otro» producían la misma bandeja vacía.

## 🔴 Lo que NO se ha arreglado, y es la decisión del ticket

**El `continue` sigue exactamente igual. No se reprograma `nextDueAt`.**

El ticket proponía copiar el mecanismo de la rama vecina —el cooldown de 90 días, que sí
reprograma tres líneas más abajo—. **Se midió y no encaja**, por dos motivos:

1. **El cooldown caduca solo, por tiempo.** `resumeAt = last + 90d` es una fecha **calculable**. El
   opt-out caduca cuando el cliente vuelve a darse de alta: un evento externo e impredecible. **No
   hay `resumeAt` que calcular.**
2. **Reprogramar rompería una propiedad que el código ya tenía.** El comentario original decía «si
   vuelve, se retoma», y eso **es cierto precisamente por el `continue`**: `nextDueAt` se queda en
   el pasado, el `where` del cron recoge el plan cada día, y se retoma al día siguiente de que el
   cliente vuelva. Con una fecha futura, el plan dormiría hasta ella **aunque el cliente volviera
   mañana** — se retrasaría el ciclo del profesional por una decisión del cliente ya revertida.

> **El `continue` sin tocar el plan no era el defecto. El defecto era que no se decía.**

Lo fija **R5**, y lo defiende **R4** por AST: si alguien «arregla» esto reprogramando, el test cae —
y con él la microcopy, que dice «el mantenimiento sigue vivo» y solo es cierto mientras no se
reprograme.

## Lo que se construye: la voz, con el mecanismo que ya estaba en el mismo bucle

`recordCustomerEvent`, que este bucle **ya usa cuando sí propone**. El modelo `CustomerEvent` ya
existe (no se toca `prisma/schema.prisma`), la ruta lo sirve (`customersAdmin.routes.ts` →
`listCustomerEvents`) y el dashboard lo pinta (`customerDetailView.js:160-161`).

⚠️ **LÍMITE DECLARADO: es CONSULTABLE, no una notificación.** El profesional lo ve si entra en la
ficha de ese cliente. Que se entere **sin ir a buscarlo** es superficie nueva y **otro ticket**: hoy
no hay pantalla de planes de mantenimiento — las rutas solo tienen `POST` y `DELETE`, no hay `GET`.

## Una vez por EPISODIO, no una por ejecución

Un cron diario grabando lo mismo llenaría la ficha de entradas idénticas: spam de otra clase, y lo
paga el profesional, que deja de leer su propia ficha. Resuelto **sin tocar el schema**:

| Pieza | Cómo |
|---|---|
| ¿ya se avisó? | `existeEventoDePlan(...)` busca un evento de ese tipo para ese cliente |
| ¿de qué plan? | **`meta: { planId }`** — `meta` es un `Json` que ya existe, así dos planes del mismo cliente son dos episodios |
| ¿desde cuándo? | **`plan.lastProposedAt`** — el episodio se cierra cuando el plan vuelve a proponerse, o sea cuando el cliente vuelve. Solo se **lee**; el anti-spam no se toca |

El filtro por `planId` se hace **en memoria** a propósito: Postgres sabe consultar dentro de `meta`,
pero eso ata el código al motor y se comporta distinto con `meta` a `null`. Los candidatos son
pocos.

🔴 **Y si la consulta falla, devuelve `false` — «no lo he visto, regístralo».** La asimetría es la
del ticket: un evento duplicado cuesta una línea repetida en una ficha; el silencio cuesta
exactamente el defecto que veníamos a cerrar.

## Microcopy — aprobada, con las tres afirmaciones medidas

**Aprobada por el fundador el 7-ago-2026**, con la condición de verificar cada afirmación contra el
mecanismo. Las tres se verificaron:

> **Mantenimiento no propuesto** · «Este cliente no recibe mensajes de WhatsApp. El mantenimiento
> sigue vivo: si quieres proponérselo, tendrás que llegar a él por otra vía.»

| Afirmación | Medición |
|---|---|
| «no recibe mensajes de WhatsApp» | `whatsapp.ts:251-253` bloquea el envío a un número con `waOptOut` de ese merchant y devuelve `wa_opt_out` |
| «el mantenimiento sigue vivo» | cierto, **y solo porque NO se reprograma**: el plan queda `active` con `nextDueAt` en el pasado y el cron lo recoge al día siguiente |
| «tendrás que llegar a él por otra vía» | el opt-out es del **canal**; nada impide llamarle |

Se descartaron dos alternativas: una que solo daba el hecho sin salida, y otra que ocultaba el canal
«para proteger al cliente» — no protegía nada (el dato ya es del profesional) y a cambio le escondía
que la vía telefónica sigue abierta. **El sujeto de las dos frases es el mantenimiento, no el
cliente**: no se reprocha nada ni se le atribuye intención.

## Verificado en rojo — 9 mutaciones, inyección comprobada en disco

| Qué se rompe | Qué cae |
|---|---|
| **R7** · se neutraliza la rama del `waOptOut` | 🔴 «ESCÁNER CIEGO: no encuentro el bloque `if (customer.waOptOut)`» |
| **R1** · el bucle deja de llamar al aviso | 🔴 «la rama del opt-out YA NO LLAMA a `avisarPlanSinCanal`» |
| **R2** · se pierde el control de episodio | 🔴 «el aviso se repite en cada pasada: un cron DIARIO llenaría la ficha» |
| **R2** · se pierde el `planId` de `meta` | 🔴 «dos planes del mismo cliente comparten episodio y uno se queda mudo» |
| **R2** · la consulta deja de acotar por `lastProposedAt` | 🔴 «un plan solo avisaría UNA vez en toda su vida» |
| **R4/R5** · la rama del opt-out empieza a reprogramar | 🔴 «rompe «si vuelve, se retoma» y deja la microcopy mintiendo» |
| **R4** · la rama del cooldown deja de reprogramar | 🔴 «la rama del cooldown ya no reprograma el plan» |
| microcopy · cambia una palabra del detalle | 🔴 «el detalle ha cambiado y no consta aprobación nueva» |

> ⚠️ **Dos salieron mal al primer intento y las dos enseñaron algo.**
>
> **(1) R1 salió VERDE, y era un hueco real.** Los tests ejercitaban `avisarPlanSinCanal`
> directamente, así que **borrar la llamada del bucle los dejaba a todos en verde** y el plan volvía
> a pararse en silencio: probaban código que ya no ejecutaba nadie. Se añadió el test que faltaba —
> por AST y **dentro** del bloque del opt-out, porque la función se nombra a sí misma en su
> definición y un `grep` se cazaría solo.
>
> **(2) R7 caía por «BUILD ROTO», no por el test.** `if (customer.waOptOut && false)` no compila
> (`'customer' is possibly null`), así que el rojo no probaba nada. Con una mutación que **sí**
> compila —cambiar la condición por otra— el test cae por donde tenía que caer. *Un rojo que sale
> por donde no esperabas no es el rojo que querías probar.*

## Nota de diseño: por qué el aviso vive APARTE del bucle

`avisarPlanSinCanal` se extrajo a su propia función con dependencias inyectables **y default al
real** — el patrón que la casa ya declara (`tests/_audit-log-sync.mjs:66`,
`_merchant-fixture.mjs:332`). El motivo: lo que este ticket tiene que demostrar es que **queda un
evento**, y eso es un EFECTO, no una decisión; sin inyección solo se podría probar contra una base
real con turno de staging, y la garantía principal del ticket viviría fuera de `npm test`.

**Se extrajo SOLO esta rama.** El mecanismo de propuesta no se toca: la primera versión inyectaba
las dependencias en `runMaintenanceProposals` entera y se retiró por eso.

## 🔴 EL SIGUIENTE DE ESTA CADENA: SCRUM-399 (el lote de 50)

Medido aquí y **no arreglado a propósito**: el recorrido es `orderBy: nextDueAt asc, take: 50`. Un
plan en opt-out se queda con `nextDueAt` en el pasado **para siempre**, así que ocupa un hueco de
esos 50 todos los días, y además en las primeras posiciones porque su fecha es la más antigua. Con
suficientes planes en opt-out, el cron dejaría de llegar a los buenos — y ese fallo también sería
mudo.

**Va DESPUÉS de éste, y el orden importa:** si los planes en opt-out dejaran de entrar en el bucle,
desaparecería el sitio donde se registra este aviso.

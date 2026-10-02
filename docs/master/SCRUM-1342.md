# SCRUM-1342 · Un plan mal escrito deja la cuenta en 1 usuario, y ahora lo dice

**Medido contra:** `origin/main` = `d2ed6c8a2c4d2b3487c4557094d12915e9dfb83c` · 2026-10-02T02:15:53Z

A9: comprobación → `tests/scrum1342-plan-desconocido-no-calla.test.mjs`

Sesión J5a, por encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`). Ticket de
`area-j5`, cogido a las 2026-10-02T02:04:39Z (hora de GitHub) con `origin/main` en el sha del ancla.
El ticket no traía su lista bajo la palabra «Aceptación»; el orquestador aceptó por mensaje que la
aceptación son sus cuatro puntos ①–④ más el control positivo de `null`/`undefined`.

## Ⓐ Qué se toca

| fichero | qué cambia |
|---|---|
| `src/core/entitlements.ts` | `getEntitlements` distingue ausente / conocido / presente y desconocido; pregunta por clave propia; exporta `PLANES_CONOCIDOS`. Los cuatro planes y sus límites, sin tocar. |
| `src/modules/team/app/routes/team.routes.ts` | la línea 74, en sitio: le pasa a `getEntitlements` el `merchantId`. |
| `prisma/schema.prisma` | la línea 97, en sitio: **solo el comentario** del campo `plan`. |
| `tests/scrum1342-plan-desconocido-no-calla.test.mjs` | nuevo: 13 casos y 6 mutaciones declaradas. |
| `docs/master/evidencias/scrum1342/` | el rojo de antes, la segunda sonda de mutaciones y el censo de ④. |

No se toca ningún `maxUsers` ni `waFairUseMonthly`, ninguna ruta nueva, ningún texto que vea el
usuario (el cuerpo del 409 es el mismo byte a byte), el webhook de Stripe, ni nada de la emisión.

## Ⓑ Una premisa del ticket no era verdad entera

El ticket decía: «el `?? BY_PLAN.trial` es fail-closed y eso está bien». Ejecutado sobre el `dist/` de
`d2ed6c8a`, antes de tocar nada:

| `getEntitlements(…)` | devolvía | `maxUsers` |
|---|---|---|
| `'empresa'`, `'basic'`, `'Equipo'`, `'equipo '`, `''` | los límites de trial | 1 |
| `null`, `undefined` | los límites de trial | 1 |
| `'constructor'`, `'toString'`, `'hasOwnProperty'` | **una función** | `undefined` |
| `'__proto__'` | **`{}`** | `undefined` |

`BY_PLAN` es un objeto literal: lo que hereda de `Object.prototype` no es `undefined`, así que el `??`
no saltaba. Población: los 12 nombres propios de `Object.prototype`, y los 12 devolvían algo sin
límite. En la ruta, `1 + activos >= undefined` es `false`: medido por `POST /admin/team` con la base
doblada, una cuenta con plan `constructor` y 3 miembros **cruzaba el límite** y llegaba a
`createTeamMember`. Para lo desconocido «normal» sí era fail-closed; para esos doce nombres no era «el
límite más pequeño», como decía el enunciado: era **ningún límite**. Una puerta de límite que se abría
escribiendo un nombre de plan. El orquestador decidió por mensaje que cerrarlo entra en el ticket, y
con el arreglo la frase «es fail-closed» pasa a ser verdad para cualquier valor por primera vez.

Lo que acota el daño, y lo que no sé: hace falta que alguien escriba uno de esos nombres en `plan`. El
único escritor del código es el webhook de Stripe, que guarda `metadata.plan` **tal cual llega**
(`stripe.routes.ts:96` y `:138`, sin validar); el checkout propio solo manda `pro` o `founding`. No he
medido si alguien puede editar ese `metadata` desde el panel de Stripe.

## Ⓒ El rojo primero

`docs/master/evidencias/scrum1342/rojo-antes.txt`: el test nuevo sobre el código sin tocar (commit
local `de48cb75`, antes del arreglo). **13 casos · 4 pasan · 9 caen.** Pasan los cuatro que tienen que
pasar siempre: los cuatro planes conocidos, los dos controles de la ruta con `equipo` y el control del
lector del esquema. Caen el silencio con `empresa`, los doce nombres heredados, la ruta dejando pasar a
`constructor`, la lista del esquema, y los casos cuyo control positivo necesita que el aviso exista.

## Ⓓ El arreglo, y las dos decisiones que el ticket dejaba abiertas

Tres casos, que antes eran dos:

| el plan llega | antes | ahora |
|---|---|---|
| ausente (`null`, `undefined`, merchant no encontrado) | trial, en silencio | **igual** |
| conocido (`trial`, `pro`, `founding`, `equipo`) | sus límites | **igual** |
| presente y desconocido (`empresa`, `Equipo`, `equipo `, `''`) | trial, en silencio | trial, **con un aviso** |
| presente y heredado (`constructor`, `__proto__`…) | algo sin límite | trial, con un aviso |

El aviso, tal cual sale:

    [entitlements] ⚠️ plan desconocido "empresa" (merchant 7): se le aplican los límites de trial. Los planes que existen: trial, pro, founding, equipo.

El valor va entre comillas (un espacio de más se ve) y recortado a 60 caracteres.

**Decisión 1 · aviso al leer, no validación al escribir.** El ticket ofrecía las dos. Validar al escribir
solo cubre a quien escribe pasando por el código, y ése es el webhook de Stripe; el camino que el ticket
teme es un `UPDATE` a mano, que no pasa por ninguna línea de TypeScript. Lo único que ve un valor venga
de donde venga es quien lo lee. Además, rechazar en el webhook un plan que no conozco sería dejar sin
activar a alguien que ha pagado, y eso es flujo de cobro: no es de este ticket.

**Decisión 2 · el comentario del esquema remite, no lista.** Una lista vigilada por un guard sigue
siendo dos listas. Ahora dice dónde están los que valen, y el test cae si vuelve a nombrar un plan.

**Lo que este arreglo NO consigue, y hay que decirlo:** el aviso va al log del servidor. Se entera
quien mire el log, y sale cuando alguien intenta invitar a un miembro, no cuando se escribe el plan.
Quien haga el `UPDATE` a mano no ve nada en ese momento. Lo único que avisaría en el momento de
escribir es una restricción en la base (un `CHECK` sobre `plan`), que es un ALTER y una decisión del
fundador: no está hecho ni propuesto como ticket, solo dicho.

El aviso sale una vez por llamada. Hoy `getEntitlements` tiene **un** llamante en `src/`
(`team.routes.ts:74`), que corre cuando alguien invita. Si un día se le pregunta en cada petición,
hay que agruparlo; lo dice el comentario del código.

## Ⓔ Los controles que mandan

- **Los cuatro planes:** `trial`, `pro`, `founding` → 1 y 300; `equipo` → 5 y 1000. El test los compara
  contra una tabla escrita a mano, no contra el código, y exige cero avisos.
- **Ausente no es desconocido:** `null`, `undefined` y sin argumento → trial, 0 avisos; y por la ruta,
  merchant no encontrado → 409 con 1 usuario, 0 avisos. Cada uno de esos ceros lleva en la misma prueba
  el caso que sí avisa, sobre la misma escucha.
- **El esquema solo cambia un comentario:** `git diff --numstat` da `1 1`, y
  `node scripts/preview-migracion.mjs --desde <el esquema de d2ed6c8a>` contesta «sin cambios
  pendientes» después de su control positivo (33 tablas).
- **La ruta entra por el router** (`router.handle`), no por el handler sacado de `route.stack`: cruza
  el `requireRole('admin')` de producción, con `reqDeSesion({ rol: 'admin', … })`.

## Ⓕ Mutaciones

Seis declaradas en el test (`MUTACIONES_QUE_ME_TUMBAN`); el censo de la casa las ve
(`meta-guard-mutaciones --solo-censo`: 6 de 424 declaraciones). Corridas con una segunda sonda propia,
`docs/master/evidencias/scrum1342/mutar.mjs`, cuya salida está en `mutar-salida.txt`:

| # | mutación | cae |
|---|---|---|
| 1 | se vuelve a preguntar por lo heredado (`BY_PLAN[plan]`) | el de los nombres heredados |
| 2 | el aviso deja de salir | el de «deja UN aviso» (y 5 más) |
| 3 | el aviso salta también sin plan | el de «ausente no es desconocido» |
| 4 | `equipo` pasa de 5 a 10 usuarios | el de los cuatro planes |
| 5 | lo desconocido cae a `equipo` en vez de a `trial` | el de la ruta con `empresa` (y 4 más) |
| 6 | la ruta deja de pasar el `merchantId` | el de la ruta con `empresa` |

Base sin mutar 13/13 · **6 vivas, 0 mudas, 0 ciegas** · 13/13 después de restaurar, árbol limpio.

La línea del esquema no lleva mutación declarada: ningún instrumento de la casa muta
`prisma/schema.prisma` y este ticket no lo estrena. Su rojo es el del fichero real (Ⓒ).

La sonda de la casa (`npm run meta:mutaciones`) no se corrió en local: corre las 424 del árbol. La
ejecuta el job del meta-guard en el CI, que no es obligatorio.

## Ⓖ El censo: comentarios del esquema que enumeran valores

`node docs/master/evidencias/scrum1342/censo-comentarios-lista.mjs` (salida en `censo-salida.txt`).
Población: 1.828 líneas, 33 modelos, 56 campos con comentario en su línea, 873 líneas que son solo
comentario.

- **36 comentarios enumeran con «|»** tras este arreglo: 19 en la línea de su campo y 17 en línea
  propia. Sobre el esquema de `d2ed6c8a` son 37, y el que sobra es `Merchant.plan` (control positivo).
- Es un **suelo**: el instrumento no ve listas separadas por comas, por «/» o partidas en dos líneas.

Cada uno comparado, como CONJUNTO, con lo que el código decide para ese campo:

| veredicto | cuántos |
|---|---|
| coincide hoy con el código | 20 |
| **diverge hoy** | **14** |
| no es la lista de valores de un campo (describe la forma de un Json) | 2 |
| sin fuente encontrada | 0 |
| total | 36 |

Los 14 que divergen:

| línea | campo | qué no cuadra | fuente |
|---|---|---|---|
| 70 | `Merchant.subscriptionStatus` | dice `ok`; el código escribe `active`. **Contradice al comentario de la línea 72**, dos más abajo, sobre el mismo campo | `stripe.routes.ts:102` |
| 580 | `Quote.origin` | nombra `manual`, que nadie escribe | `maintenance.service.ts:416` |
| 672 | `Quote.createdVia` | faltan `maintenance` y `revision` | `maintenance.service.ts:420` |
| 892 | `Invoice.type` | falta `JUST` | `tipoDocumento.ts:52` |
| 1138 | `BotSession.state` | falta `confirming_request` | `botFlow.service.ts:11` y `:438` |
| 1157 | `QuoteTemplate.paymentTerms` | no hay validador, y el código añade `SIN_CONDICIONES` | `billingPlan.ts:14` |
| 1198 | `CustomerEvent.type` | sobran 2 y faltan 10 | `customerEvents.service.ts:11` |
| 1270 | `WhatsAppMessage.type` | falta `inbound` | `whatsappLog.service.ts:14` |
| 1274 | `WhatsAppMessage.status` | falta `received` | `whatsappLog.service.ts:81` |
| 1277 | `WhatsAppMessage.relatedType` | faltan `albaran` y `review` | `whatsappLog.service.ts:15` |
| 1409 | `Attachment.entityType` | nombra `job`; falta `albaran` | `attachment.service.ts:21` |
| 1412 | `Attachment.kind` | nombra `audio`, que da por futuro | `attachment.service.ts:23` |
| 1563 | `EmailMessage.kind` | faltan 5; acaba en «...» | `registroDeEnvios.ts:87` |
| 1571 | `EmailMessage.relatedType` | nombra `charge`, que nadie escribe | `email.service.ts:51` |

**Cómo se midió, y hasta dónde llega.** La comparación de 34 la hizo un agente de solo lectura, que cita
`fichero:línea`; los dos que el censo añadió (1335 y 1448) los miré yo, y coinciden. De los 14 que
divergen comprobé yo contra la fuente once: 70, 580, 672, 892, 1138, 1157, 1270, 1274, 1277, 1563 y
1571. **Los otros tres (1198, 1409 y 1412) son la lectura del agente, sin repetir**: mi búsqueda sobre
el 1198 salió vacía —ciega, no limpia— y la del 1409 mezcla el `entityType` de otros modelos. Ninguno
se ha ejecutado: es comparación de texto contra texto.

Ninguno se arregla aquí. El que más se parece al del ticket es el 1138: los estados del bot son
cerrados (regla 27), y la lista del esquema tiene uno menos que la del código.

## Ⓗ Hallazgos que NO se arreglan aquí

1. **La misma forma en otros 15 sitios de `src/`.** `MAPA[clave] ?? defecto` (o `||`) sobre una
   constante en mayúsculas: 16 líneas en 312 ficheros `.ts` contando la de entitlements (control: la
   línea vieja casa). Por texto y **sin clasificar**: no sé en cuáles la clave viene de fuera ni cuáles
   son objetos literales. Uno está en una página pública (`quoteDecisionLanding.routes.ts:891`,
   `REASON_LABELS[String(reason)]`). Los mapas con nombre en minúsculas no entran en el recuento.
2. **El webhook de Stripe guarda `metadata.plan` sin validar** (Ⓑ). Con este arreglo un valor raro
   queda en trial y avisa al invitar; antes de este arreglo, doce valores concretos quitaban el límite.
3. **Nada avisa en el momento de escribir el plan a mano** (Ⓓ).

## Ⓘ Lo que me salió mal

- **Una mutación mal escrita.** La 2 era `void (` y la llamada acaba en coma colgante: `void (…,)` no
  parsea, el fichero entero dejaba de cargar y el test nombrado no llegaba a correr. Mi sonda la dio
  CIEGA («el test nombrado no aparece») en vez de VIVA; con `String(` cae como debe.
- **Una lista hecha a ojo antes que el instrumento.** Conté los comentarios-lista con un `grep` y salieron
  34; el censo escrito después encontró 36 (los dos de más: líneas 1335 y 1448). La revisión contra el
  código ya estaba lanzada sobre los 34, y esos dos los miré aparte.

## Ⓙ La tanda

%%TANDA%%

# SCRUM-399 · El hambre del lote: el plan en opt-out que se comía un hueco del cron

**Fecha:** 7-ago-2026 · **Carril:** S3 · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `91ec5ef54585ae81bc113374161c20eb9ea862ba` · 2026-08-07T20:11:10+01:00
**Tanda:** 2264 tests · 2191 pass · **0 fail** · 73 gateados

> El recorrido coge `orderBy: nextDueAt asc, take: 50` y el opt-out se filtraba **dentro del
> bucle**. Un plan sin canal **nunca se reprograma** —y es correcto: es lo que hace cierto el «si
> vuelve, se retoma» de SCRUM-394— así que su `nextDueAt` se queda en el pasado para siempre y
> `asc` lo pone **en cabeza**. Se comía un hueco de los 50 todos los días, por delante de los demás.
> Con 50 así, el cron no llegaba a **ningún** plan bueno. Y ese fallo también era mudo.

## 🔴 La trampa, y cómo se resuelve: DOS LOTES, no un filtro

Filtrar y ya habría **borrado el sitio donde SCRUM-394 registra su aviso**: para poder decir que un
plan está parado hay que verlo. Las dos cosas se resuelven juntas o no se resuelve ninguna.

| Lote | Qué trae | Para qué |
|---|---|---|
| `aProponer` | vencidos **con** canal | el lote de trabajo — ya no compite con nadie |
| `sinCanalVencidos` | vencidos **sin** canal | su propio recorrido, con su propio techo: no se proponen, pero **se ven**, y por eso se les puede avisar |

⚠️ Se filtra por `customerId` con una lista y no con `where: { customer: … }` porque **`MaintenancePlan`
no declara relación con `Customer`** (solo `customerId Int`) y el schema es territorio del fundador.
Medido, no supuesto.

⚠️ Y el `where` se construye **sin la cláusula** cuando no hay ningún opt-out, en vez de mandar un
`notIn: []`: una cláusula vacía viajando a la base es justo donde un motor puede decidir por su
cuenta que no pasa nadie — y eso vaciaría el lote entero **en el caso más común de todos**, que es
el que nadie prueba. Lo fija R4.

## El filtro del bucle no se borra: pasa a ser una DEFENSA

`if (customer.waOptOut)` sigue ahí, pero ya no filtra: marca `wa_opt_out_INESPERADO_en_lote`. Si un
plan sin canal llega hasta el bucle, el filtro de la consulta se ha roto y eso **se ve** en vez de
callarse. No es una segunda opinión sobre el criterio: es que respetar el opt-out no puede depender
de que una consulta salga bien. El aviso **no** se registra ahí — ya lo hizo su recorrido — porque
duplicarlo rompería el «una vez por episodio».

## 🔴 Una REGRESIÓN que cazó el guard, no yo

`tests/scrum243` (trinquete multi-tenant) se puso rojo: *«HAN APARECIDO LECTURAS SIN NINGUNA
COMPROBACIÓN DE MERCHANT: maintenance.service.ts (×3) — FICHERO NUEVO»*.

Y **tenía razón, no era ruido**. El bucle comprobaba `customer.merchantId !== plan.merchantId`
**antes** de tocar nada, y el recorrido nuevo de los mudos se la había saltado: habría registrado un
`CustomerEvent` en la ficha de un cliente que puede no ser de ese merchant — contarle a un
profesional algo de un cliente ajeno.

**Se arregló el código, no el censo.** `seleccionarLotes` trae ahora el `merchantId` del cliente y
solo entran en el lote de mudos los planes cuya pareja plan↔cliente coincide. El guard ofrecía
también la salida de «añádela al censo con su motivo», y **no se usó**: había un defecto real
debajo, y subir un trinquete multi-tenant es decisión del fundador, no una forma de seguir
adelante.

## Verificado en rojo — 7 mutaciones, inyección comprobada en disco

| Qué se rompe | Qué cae |
|---|---|
| **R5** · el filtro vuelve al bucle | 🔴 «EL HAMBRE DEL LOTE: los 60 planes en opt-out se han comido los huecos…» |
| **R2** · desaparece el lote de los mudos | 🔴 «los planes sin canal han desaparecido del ciclo (0). Sin recorrido propio no hay dónde avisar» |
| **R2** · el recorrido deja de llamar al aviso | 🔴 «existe pero NO llama a `avisarPlanSinCanal`… se habría cambiado un defecto mudo por otro» |
| **R4** · se manda `notIn: []` sin nadie a quien excluir | 🔴 «una cláusula vacía viajando a la base…» |
| **R3** · el lote pierde el `nextDueAt asc` | 🔴 «el cliente que vuelve NO entra en cabeza (entró 70)» |
| **multi-tenant** · se quita la comprobación de pareja | 🔴 «un plan que apunta a un cliente de OTRO merchant ha entrado… fuga entre tenants» |
| **SCRUM-394** · se rompe el cableado del aviso | 🔴 lo caza **su** test, no el mío |

> ⚠️ **Dos salieron mal al primer intento, y las dos eran mías.**
>
> **(1) R3 salió VERDE, y el defecto estaba en el doble.** Mi `prismaDoble` ordenaba **siempre** por
> `nextDueAt asc` por su cuenta, ignorando el `orderBy` que recibía: cambiar el orden en el código
> no movía nada porque el test estaba comprobando el doble, no el ciclo. *Un doble que arregla lo
> que el código pide mal es un doble que esconde el defecto.* Ahora honra el `orderBy`, y entonces
> sí cae.
>
> **(2) Un ancla no casó por los finales de línea** (`\n` sobre un fichero CRLF). Es el caso A de
> `METODO_YAQU.md`, y es la **tercera vez en el día**: cuando un script de mutación toca un fichero
> del repo, el salto de línea se detecta, no se escribe a mano.

## SCRUM-394 sigue en pie, y su test se mudó con el cableado

R2 vigila las dos mitades: que los planes sin canal **sigan viéndose** y que el aviso siga siendo
**una vez por episodio**. Y el test de cableado de SCRUM-394 se actualizó —antes miraba dentro de
`if (customer.waOptOut)`, ahora mira el recorrido `for (… of sinCanalVencidos)`—: **lo que vigila no
ha cambiado, solo dónde**, y sigue poniéndose rojo si se borra la llamada.

## Hallazgo fuera de carril: colisión de número en el remoto

Existe `scrum-399-censo-sistema-de-facturacion` (`e7a0b326`), **viva y sin fusionar**, sobre *«P14
PRIORITARIA — los hechos del producto para preguntar al asesor si fabricamos un SIF»*. Es un trabajo
completamente distinto con **el mismo número 399**. O el número está reusado en Jira, o una de las
dos ramas está mal nombrada. Se reporta, no se toca (reglas 9/37).

# SCRUM-371 · BARRIDO DE POBLACIÓN: el verificador del sello deja de depender de que alguien lo llame

**Fecha:** 5-ago-2026 · **Carril:** A (garantía probatoria del albarán firmado) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `f734e33d2df6afc67380e7933db87f01383fed63` · 2026-08-05T16:05:18+01:00

**Tanda:** 1719 tests, 1652 pass, 0 fail, 67 skipped (los 67 son los gateados de staging, que
`npm test` no corre)

> **El ancla se movió DOS VECES durante el ticket, y la segunda cambia una afirmación.** El trabajo
> empezó midiendo que SCRUM-369 **no** estaba en `main` (comprobado a las 15:49: `origin/main` =
> `cce60b16`, sin `albaranVerificacion.ts`), así que la rama se apiló sobre la de 369. A las 16:03
> el PR #463 ya estaba mergeado y esta rama se rebasó sobre el `main` resultante. Los ficheros que
> este ticket lee o toca —`albaran.service.ts`, `cron.ts`, `index.ts`— son **byte a byte idénticos**
> entre las dos bases, así que ninguna medición del cuerpo caducó: lo que cambió fue de dónde
> cuelga la rama.

## El defecto

SCRUM-369 entregó el verificador del sello —recetas por versión, `verificarSobre`,
`verificarPoblacion`, suelo en el tipo y nueve sabotajes en rojo— y **ninguna superficie lo
llamaba**.

Es el patrón que ese mismo ticket vino a cerrar —el mecanismo existe y nadie lo dispara— cometido
por el arreglo. Un verificador que no corre da exactamente la misma tranquilidad que uno roto.

## La decisión, y por qué

### ① Dónde vive: cron diario, decidido midiendo lo que ya hay

`src/core/cron/cron.ts` ya registra cinco trabajos con `node-cron`, arrancados desde `src/index.ts`
salvo `DISABLE_CRONS`. El barrido entra ahí (03:15) y no como comando: **un verificador que solo
corre cuando alguien se acuerda de lanzarlo es «verde porque nadie lo ejecuta»**, que es la misma
garantía muda de partida. A las 3:15 porque no envía nada a nadie —solo lee y escribe una línea de
log—, así que no compite con los cinco de arriba, que sí envían, ni toca horas tranquilas.

**Y hay un guard que lo exige** (⑦): si el barrido deja de estar dentro de un callback de
`cron.schedule`, la suite se pone roja. Sin él, este ticket se podría cerrar en falso exactamente
igual que el anterior.

### ② Solo lee. Ni siquiera en `AuditLog`

Si un albarán no cuadra, se **declara** en el informe y en el log, con su número y su merchant. No
se recalcula, no se migra, no se «deja bien»: lo firmado no se toca **ni siquiera para arreglarlo**
(espíritu de la regla 29) — un sobre reescrito deja de ser prueba de nada, y el arreglo destruiría
justo el dato que documenta el incidente.

Tampoco escribe en `AuditLog`, y no es un olvido: `AuditAction` es una unión **cerrada**
(`system/audit.service.ts`) y ampliarla es decisión del fundador (regla 5). Un guard AST comprueba
que ninguna llamada a `prisma` del módulo está fuera de las de lectura.

### ③ La pieza delicada no es la consulta: es el adaptador

El verificador recalcula el hash a partir de unas FUENTES. Si el barrido las resuelve distinto a
como las resolvió `buildFirmaEvidencia` al sellar —un `||` donde había un `??`, el nombre comercial
donde iba el fiscal— el hash sale distinto **sobre albaranes intactos**, y el informe acusaría de
manipulación **a toda la población de golpe**. Es la peor salida posible de esta herramienta.

Por eso `entradaDesdeFilas` copia la resolución del sellador campo a campo y un guard las **cara
sobre el AST**, resolviendo también las abreviaturas (`cliente,` contra su `const`) — sin eso, el
campo más delicado se compararía contra un texto vacío.

Lo que **no** se hace: importar nada del sellador para «reutilizar» esa resolución. Las recetas del
verificador están escritas aparte a propósito (SCRUM-369) para que sellador y verificador sean **dos
testigos independientes**; acoplar el barrido al sellador los convertiría en un espejo y se perdería
lo único que hace que carearlos signifique algo. Un guard lo vigila.

### ④ No se amplió `albaranVerificacion.ts`, y eso también se midió

El ticket autorizaba a ampliarlo con su propio rojo si el barrido necesitaba algo que el módulo no
diera. **No hizo falta**: `verificarPoblacion` ya devuelve censo por versión, hallazgos con motivo,
versiones no soportadas y la conclusión con el suelo dentro. El barrido no reimplementa la regla del
suelo — tener dos sitios donde decidir si «cero examinados» es «todo cuadra» acabaría con los dos
diciendo cosas distintas.

## Lo que se midió

| Medición | Resultado |
| --- | --- |
| Mecanismos periódicos que ya existen | **5 crons** en `core/cron/cron.ts` (node-cron), arrancados en `index.ts` salvo `DISABLE_CRONS` |
| Relación Prisma `Albaran → Job` | **no existe** (`jobId` es un `Int` suelto) → las fuentes se resuelven con consultas por merchant, no con `include` |
| Escrituras de auditoría disponibles | `AuditAction` es unión **cerrada** → el barrido no escribe |
| Clasificación de tenencia de las 3 lecturas | **`filtra`** las tres, con el analizador de la casa (`_tenencia-lectura.mjs`), ninguna «sin red» |
| Versiones de sobre en el árbol | **{1}** — v:2 (C5) sigue sin estar; un sobre v:2 se declara no soportado, no se aproxima |

## Verificado en rojo

Ocho sabotajes, cada uno aplicado, compilado, corrido y revertido con verificación byte a byte:

| Se quita la cosa vigilada | Sale rojo |
| --- | --- |
| El adaptador resuelve `cliente` con el nombre comercial en vez del fiscal | ⑥ el careo, ① el positivo y 2 más |
| El adaptador deja de leer la obra del Trabajo | ⑥ el careo, ① el positivo y 2 más |
| El barrido corta tras el primer lote | la paginación (250 albaranes) |
| El barrido escribe en la base | ⑤ solo lee, y 7 más |
| El resumen con hallazgos vuelve a decir «cuadran» | ② el negativo |
| El resumen de un barrido vacío enseña marcador | ③ el suelo |
| El barrido se salta el albarán cuyo Trabajo no pudo leer | tenencia |
| **El barrido existe pero fuera del callback del cron** | **solo** ⑦ el enganche |

El último es el que mide este ticket: compila igual, se exporta igual, y lo único que cambia es que
**nadie lo dispara**. Sin ese guard, este ticket se cerraría en verde con el defecto de SCRUM-369
intacto y un fichero más encima.

## Lo que NO cubre

* **No verifica v:2**, porque v:2 no existe todavía. El barrido lo declara y lo cuenta en el censo;
  la receta la exige el guard de SCRUM-369 el día que el sellador gane la versión.
* **La conclusión `no_se_pudo_mirar` es correcta y en producción será común al principio**: un
  merchant sin albaranes firmados no tiene nada que comprobar. El suelo no existe para alarmar, sino
  para que eso **no se lea como «todo cuadra»** — por eso el log usa `warn` y la frase dice
  explícitamente lo que NO significa.
* **Todo el barrido se acumula en memoria antes de verificar.** Es deliberado: el dueño de la regla
  del suelo es `verificarPoblacion`, y trocearlo exigiría fusionar informes, o sea decidir la
  conclusión en dos sitios. A volumen actual (cientos de filas) no se nota; si algún día se nota, la
  fusión va **dentro del verificador con su propio rojo**, no aquí.
* **`Albaran.estado` no tiene índice** y la consulta filtra por `merchantId + estado`. Hoy es
  irrelevante por volumen; añadir el índice es un cambio de esquema, o sea turno del fundador.
* **No prueba contra ninguna base real.** No se ha tocado producción (prohibida incluso en lectura)
  ni staging: la población de los tests es un lector falso con la misma interfaz. Lo que queda sin
  demostrar es la consulta contra Postgres, no la lógica del barrido.
* **Nadie recibe un aviso activo.** Un hallazgo sale por `console.error` en los logs de Railway. Que
  eso llegue a un humano (email, alerta) es otra decisión de producto, y no se toma aquí.

## Ficheros

* `src/modules/jobs/domain/albaranBarrido.ts` — **nuevo**. Adaptador, lector Prisma por merchant,
  barrido y resumen para el log.
* `src/core/cron/cron.ts` — el trabajo diario de las 3:15 (única modificación de un fichero
  existente en este ticket).
* `tests/scrum371-barrido-poblacion.test.mjs` — **nuevo**. 13 tests: positivo, negativo que nombra,
  suelo, censo por versión, tenencia, paginación, solo-lee, careo del adaptador y el enganche al cron.

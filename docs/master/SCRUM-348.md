# SCRUM-348 · La tenencia se decide POR LECTURA, no por mención en el handler

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `111e7d2f6e10ab807d6f54e4e1a8a7201dd2a69e` · 2026-08-09T18:22:41+02:00
(anclado con `git ls-remote`)
**Tanda:** 2301 tests · 2228 pass · **0 fail** · 73 skipped · `npm test` **`$? = 0`**

## El agujero, y su tamaño

SCRUM-243 marca una lectura como cubierta si **la función que la envuelve menciona `merchantId`**
(`mencionaMerchantId(fn)`). Eso la cubre con cosas que no la protegen: el `merchantId` de **otra**
consulta del mismo handler, uno dentro de un `select`, o un `const { merchantId } = req` que no
llega a ese `where`. Y **crece solo**: cuanto más grande es un handler, más probable es que
contenga la palabra en alguna parte, así que las lecturas nuevas nacen «cubiertas» sin que nadie
las mire. Por eso en A6 y A7 me negué a apoyarme en ese guard y monté los controles negativos
contra Postgres a mano.

**Medido con el criterio por lectura, sobre el árbol real:**

| | |
|---|---|
| lecturas de modelos con `merchantId` | **367** |
| su propio `where` filtra | 243 |
| sin filtro | 118 |
| no resolubles | 6 |
| ⚠️ **lecturas que 243 daba por cubiertas SOLO por la mención en la función** | **80** |
| …de ellas sin filtro | **74** |
| …de ellas en ruta **autenticada** | **7** |

## El criterio nuevo: la lectura se defiende sola

Una lectura está cubierta si **su propio `where`** filtra. Y para no repetir el error contrario
—243 sobrecontaba porque no sabía resolver `where: whereRango(...)`— la indirección **se resuelve**:

| forma | veredicto |
|---|---|
| `where: { merchantId }` | CUBIERTA |
| `where: { AND: [{ merchantId }, …] }` | CUBIERTA (anidado) |
| `where: base` con `const base = { merchantId… }` en la misma función | CUBIERTA (resuelta) |
| `where: whereRango(merchantId, …)` | **NO_RESOLUBLE** — se declara, no se da por buena |
| literal sin `merchantId`, o sin `where` | **SIN FILTRO** |

**«No pude resolverlo» no es «filtra» y tampoco es «no filtra».** Confundir dos de los tres cubos
es lo que hace inútil una medición de seguridad: una inflada no se puede atender, una corta
tranquiliza.

## Las 7 lecturas destapadas — NINGUNA es una puerta abierta, y por eso el veredicto importa

**No las he arreglado** (regla 9): van censadas con su veredicto para que decidas tú.

| fichero:línea | lectura | veredicto |
|---|---|---|
| `jobs.routes.ts:97` | `quote.findMany` por ids de `jobs` | PROCEDENCIA |
| `jobs.routes.ts:109` | `customer.findMany` por ids de `jobs` | PROCEDENCIA |
| `jobs.routes.ts:156` | `quote.findUnique` por `job.quoteId` | PROCEDENCIA |
| `jobs.routes.ts:199` · `:302` | `customer.findUnique` por `job.customerId` | PROCEDENCIA |
| `quotesAdmin.routes.ts:629` | `teamMember.findUnique` por `quote.teamMemberId` | PROCEDENCIA |
| `exports.routes.ts:465` | `charge.findMany` de toda la plataforma | **PLATAFORMA** (a propósito, C1-2) |

**PROCEDENCIA** significa: el id sale de una fila **ya filtrada por merchant** (los `jobs` de la
lista, el `job` del detalle, el `quote` ya leído). No hay fuga **mientras la procedencia siga
siendo esa** — y eso no lo comprueba nada. Es deuda declarada, no un agujero, y tiene su tope
(`PROCEDENCIA_MAX = 5`) que **solo puede bajar**.

## El suelo es doble, y la segunda mitad es la que importa

1. Si el censo no encuentra lecturas, **falla**: «cero agujeros» y «no supe mirar» son el mismo cero.
2. Y si no encontrara ninguna desprotegida, **tiene que demostrar que sabría encontrarla**. Hay
   tres controles positivos con código sintético —una lectura sin filtro, **una cuya función SÍ
   menciona `merchantId` en otra consulta** (el agujero exacto de 243) y un `merchantId` en el
   `select`— y un control negativo con las tres formas que sí filtran.

## Verificado en rojo — los dos por `$?`

| inyección | lo que dijo |
|---|---|
| el criterio vuelve a ser el de 243 | *«la lectura SIN filtro se da por cubierta porque OTRA consulta del mismo handler filtra»* |
| una ruta nueva sin filtrar en un router autenticado | *«invoicesAdmin.routes.ts:45 invoice.findMany»* |

## Lo que NO cubre — declarado

* **No retiro el guard de SCRUM-243.** Sigue midiendo lo suyo (su ratchet de 44 excepciones no se
  toca). Este mide otra cosa, más estricta, y su test deja **constancia del número** que el viejo
  tapaba (80). Si quieres que 243 pase a usar este criterio, es un ticket aparte: cambiar su
  `sinRed` moverá su ratchet y eso se decide, no se hace de paso.
* **Solo mira lecturas de modelos con `merchantId`**, y solo `prisma.<modelo>.<lectura>`. Una
  lectura por `$queryRaw` no la ve.
* **La PROCEDENCIA no se verifica.** El censo dice que ese id viene de una fila acotada porque lo
  he leído yo, no porque una máquina lo compruebe. Verificarlo es análisis de flujo y es otro
  ticket.
* **Las 118 lecturas sin filtro fuera de rutas autenticadas no se censan una a una** (crons,
  webhooks, servicios internos): el censo exige clasificación solo donde hay sesión de un
  profesional. Ahí el criterio sigue siendo el montaje.

## Dos hallazgos del entorno, reportados (regla 9)

1. **El cliente de Prisma compartido estaba desalineado con `main`.** El guard del `pretest`
   (`_prisma-client-guard.mjs`) lo cazó: `Albaran.fechaEntrega` estaba en el schema y no en el
   cliente — bloqueaba `npm test` **para todas las sesiones**, porque `node_modules` va por
   junction. Regenerado con el binario **local 6.18.0** (nunca `npx`, SCRUM-385) tras parar el
   `npm run dev` que yo mismo había dejado corriendo en `wt-313` desde el 6-ago, que era lo único
   que tenía abierto el DLL. **No se ha tocado ningún proceso de otra sesión.**
   ⚠️ Y un detalle que merece constancia: `prisma generate` **devolvió `$? = 0` imprimiendo el
   `EPERM`**. Ahí el código de salida es el que miente, no el texto.
2. **La rueda de SCRUM-297 giró, y la respondió otra sesión.** C5 entró: `lugarEntrega` ya está en
   el schema. Mi guard estaba **verde**, y al mirar por qué resultó que el `select` del paquete ya
   lleva las cuatro columnas nuevas, con un comentario que cita el guard por su nombre. Es lo que
   se pedía de un mecanismo frente a un aviso escrito en una entrada: **funcionó en manos de otro,
   sin que nadie releyera nada.**

## Ficheros

* `tests/_tenencia-por-lectura.mjs` (nuevo) — el analizador por lectura; reutiliza el lector de
  modelos y el mapa de montajes de SCRUM-243 en vez de duplicarlos.
* `tests/scrum348-tenencia-por-lectura.test.mjs` (10, sin gate) — censo, suelo doble y controles.

# SCRUM-717 · El comprobador de `select` ↔ uso YA EXISTE: es el compilador

**Fecha:** 4-sep-2026 · **Carril:** integridad de las consultas · **Gate:** sin gate — corre en `npm test`, que llama a `npm run build`

**Medido contra:** `origin/main` = `5bfc11360ba26146369d6f994812de665996f566` · 2026-09-04T12:40:00+02:00

> **Este ticket se entrega como DIAGNÓSTICO y sin guard nuevo, a propósito.** No porque no diera
> tiempo: porque el guard que pedía **ya está construido, ya corre en cada tanda, y lo que faltaba
> era saber DÓNDE deja de mirar.** Construir un analizador que imite al compilador habría sido
> añadir un segundo mecanismo peor para una propiedad que el primero ya cubre.

## 1 · PASO 0

Nadie ha metido un comprobador de `select` ↔ uso: los ficheros que salen por nombre
(`scrum138-export-selectivo`, `scrum584-selector-de-columnas`…) son de selección de columnas de
exportación y de selectores de UI, otra cosa. **Control positivo del mismo `git grep`:**
`serializeJobDetail` sí aparece, en tres tests. El comando ve.

## 2 · 🔴 La medición que cambia el ticket

Mi analizador de ayer daba **0 hallazgos sobre 162 consultas** y **no pasaba su propio control
positivo**: no veía el campo leído a través de un `Map` ni por el parámetro de un callback.

Antes de reescribirlo, la pregunta que había que hacer: **¿lo caza ya `tsc`?** Cinco inyecciones,
todas ejecutadas, ninguna deducida:

| # | Inyección | ¿la caza `tsc`? |
| :-: | --- | :-: |
| 1 | quitar `status` del `select` de `hermanas` — se lee vía **`Map`** (`porId.get(r.id)!.status`) | ✅ **SÍ** |
| 2 | leer `paymentTerms` sin pedirlo — por el **parámetro de un callback** (`.filter((h) => h.paymentTerms)`) | ✅ **SÍ** |
| 3 | *(mía, fuera de la lista)* leer `internalNotes` por **desestructuración** (`const [{ internalNotes }] = …`) | ✅ **SÍ** |
| 4 | *(mía)* quitar `total` de un `select` de `job.service.ts` leído en el mismo fichero | ✅ **SÍ** |
| 5 | *(mía)* quitar `phone` de `CUSTOMER_SELECT` — se lee **tras cruzar un `any`** | 🔴 **NO** |

Y el rojo **nombra el campo**, que es lo que se le pedía al guard:

```
error TS2339: Property 'status' does not exist on type
  '{ id: number; createdAt: Date; quoteNumber: number | null; total: Decimal;
     signatureUrl: string | null; revision: number; } | …'
```

**Control positivo del instrumento** (no de mi intuición): con un error de tipos deliberado
—`const base: number = String(...)`— `tsc` sale con `rc=2` y lo nombra. No estaba mudo.

## 3 · Dónde deja de mirar, exactamente

**Donde el valor cruza un `any`.** La inyección 5 lo fija: `refs.customers` está declarado
`Map<number, any>`, así que `refs.customers.get(job.customerId)` devuelve `any` y todo lo que se
lea de ahí deja de comprobarse.

Quitar `phone` de `CUSTOMER_SELECT` da **`tsc rc=0`** — y el teléfono desaparece del rail del
Trabajo, donde `jobRailBlocks.js:45` lo pinta con tap-to-call:

> «📞 34600000000» como texto plano es un número que hay que copiar a mano con las manos sucias;
> pulsable es una llamada.

Se pierde una función que el profesional usa en obra, **sin un solo error**.

## 4 · El alcance, medido — y por qué no cabe en una tanda

| | |
| --- | :-: |
| `select:` explícitos | **343** en **84** ficheros |
| ficheros con `select:` **y** con `any` | **62** |
| anotaciones `any` en esos ficheros | **506** |
| ficheros con `select:` y **sin ningún** `any` | **22** |

Los tres primeros de la lista son `quotes.routes.ts` (41 `any`), `jobs.routes.ts` (34) y
`albaranes.routes.ts` (31). Quitar un `any` ahí **no es un cambio de tipos**: es tocar el camino de
emisión (regla 38) y ficheros que ahora mismo editan otras tres sesiones.

**Y un trinquete sobre esos 506 tampoco se entrega**, aunque sea barato de escribir: sería un guard
que se pone rojo en las PR de otras sesiones por ficheros que no son míos — exactamente el defecto
que este árbol acaba de corregir dos veces (`SCRUM-402`: *«nacería ROJO y lo apagaría alguien en
una hora»*; `SCRUM-652f`: *«un trinquete de igualdad exacta sobre un número que no es mío»*).

## 5 · Lo que hay que hacer con esto, dimensionado

El trabajo **no es escribir un analizador**: es **retirar `any` de las fronteras por las que pasa
un resultado de consulta**, de uno en uno, con su dueño. Cada `any` que se retira devuelve esa
consulta a la vigilancia del compilador — que ya está encendida y ya nombra el campo.

Orden propuesto por relación esfuerzo/valor, **con la medida delante**:

1. `JobRefs` — `quotes`, `quotesPorJob` y `customers` son `Map<number, any>`. Es **una declaración
   de tipo** y devuelve a la vigilancia los `select` de la lista de Trabajos, que es la pantalla más
   vista. **Empezaría por aquí.**
2. `serializeJob(job: any)` y `serializeJobDetail(job: any)` — la frontera grande.
3. El resto, por fichero y por dueño.

## 6 · Lo que NO se entrega, y por qué

**No hay guard nuevo.** La condición innegociable del encargo era no entregar uno que dé verde por
no mirar, y cualquier analizador que escriba aquí sería una imitación parcial de lo que el
compilador ya hace entero: seguir el valor por callbacks, desestructuración y `Map` es trabajo de
tipos, no de identificadores. Lo demostraron las cinco inyecciones.

**Lo que sí queda escrito** es dónde está el agujero, cuánto mide y por dónde se empieza — que era
lo que no se sabía cuando se abrió el ticket.

## 7 · Hallazgo de otro carril — se reporta, no se arregla

🔴 **`CUSTOMER_SELECT` (`jobs.routes.ts:84`) no está vigilado por nadie.** Hoy trae `phone` y el
rail lo pinta; si alguien lo quita, `tsc` calla, la suite queda verde y el teléfono desaparece de
la pantalla. No lo toco —es de otro carril y su arreglo es el punto 1 de arriba— pero queda dicho
con su línea.

---

> ⚠️ Se ANEXA. El diagnóstico de arriba se queda: es lo que dimensionó este trabajo.

## APÉNDICE (4-sep-2026) · Tipar `JobRefs`: la frontera no se cierra tipando UNA cosa

**Fecha:** 4-sep-2026 · **Carril:** integridad de las consultas · **Gate:** sin gate — lo comprueba `tsc`, que corre dentro de `npm test`

**Medido contra:** `origin/main` = `119484af9d0fdf9f4beb008751a2be86d5179acd` · 2026-09-04T16:30:00+02:00

> 🔴 **EL CASO QUE EL ENCARGO ELIGIÓ COMO PRUEBA NO SE CONSIGUE, Y NO SE DA POR BUENO.** Quitar
> `phone` de `CUSTOMER_SELECT` **sigue dando `tsc rc=0`** después de tipar. Abajo está por qué,
> medido — y lo que sí se ha conseguido, que es real y se verifica igual.

## 1 · PASO 0

Los tres `Map<…, any>` siguen ahí (`quotes`, `quotesPorJob`, `customers`); `operarios` ya estaba
tipado, y es el precedente dentro del mismo `type`. Control positivo del mismo comando: `operarios`
aparece 1 vez. `docs/master/SCRUM-717.md` sólo tiene mi commit — ninguna otra sesión escribiendo.

## 2 · 🔴 El mecanismo viejo, y el suelo de que `tsc` corre

Antes de tocar nada, con `phone` quitado de `CUSTOMER_SELECT`:

```
tsc rc=0 · 0 errores
```

**SUELO:** con un error deliberado en el mismo fichero (`const _CTL: number = "x";`), `tsc` sale
`rc=2 · 1 error`. **No estaba mudo: es que no tenía nada que decir.**

## 3 · Lo que se ha tipado, y de dónde salen los tipos

```ts
type QuoteDelLote       = Prisma.QuoteGetPayload<{ select: typeof QUOTE_SELECT }>;
type QuoteDelLoteConJob = Prisma.QuoteGetPayload<{ select: typeof QUOTE_SELECT & { jobId: true } }>;
type ClienteDelLote     = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>;
```

**El `select` es la fuente del tipo.** Escribirlo aparte crearía dos fuentes para el mismo hecho: el
día que alguien añada un campo a una y no a la otra, el compilador dejaría de saber cuál manda.

## 4 · 🔴 Tipar `JobRefs` NO bastó — la frontera se MOVIÓ, no se cerró

Con los tres `Map` tipados y nada más, quitar `currency` de `QUOTE_SELECT` seguía dando **`rc=0`**.

El valor sale del `Map` tipado y **vuelve a `any` en el mismo gesto**:

```
JobRefs.quotesPorJob  →  quotesDeJob(job, refs): Promise<any[]>  →  quote: any
```

Cerrado el segundo eslabón —el tipo de retorno de `quotesDeJob` y su acumulador `salida`— la misma
inyección cae:

```
tsc rc=2 · 3 errores
jobs.routes.ts(277,80): error TS2339: Property 'currency' does not exist on type
  '{ id: number; lines: JsonValue; quoteNumber: number | null; total: Decimal;
     paymentTerms: string | null; customBillingPlan: JsonValue;
     Invoice: { id: number; status: string; total: Decimal; }[]; } | { ...; }'.
jobs.routes.ts(283,37): error TS2345: Argument of type '…' is not assignable to parameter of type
  '{ …; currency: string; …; }'.
jobs.routes.ts(330,108): error TS2339: Property 'currency' does not exist on type '…'.
```

**Antes rc=0, ahora rc=2 y nombra el campo.** Eso es lo que se ha ganado: **cualquier campo del
lote que TypeScript lea vuelve a estar vigilado.**

## 5 · 🔴 Por qué `phone` NO se consigue, medido

`serializeJob` **no lee `customer.phone`**: devuelve `customer` **entero** (`jobs.routes.ts:314`).
Quien lo lee es el **front**, `jobRailBlocks.js:45`, que es JavaScript vanilla (regla 4) y **no pasa
por el compilador**:

```js
const telefono = limpio(job && job.customer && job.customer.phone);
```

> **El tipado alcanza hasta donde llega TypeScript.** Un campo que sólo consume el navegador no lo
> vigila nadie por esta vía — y `phone` es exactamente ese caso.

No se fuerza: meter un `customer.phone` artificial en el serializador sólo para que el tipo lo mire
sería escribir código para el guard, no para el producto. **Se dice y queda como hueco.**

## 6 · Verificación

**CONTROL POSITIVO — las cuatro inyecciones que `tsc` ya cazaba, corridas otra vez:**

| # | inyección | resultado |
| :-: | --- | --- |
| 1 | `status` del select de `hermanas`, leído por **`Map`** | `rc=2 · Property 'status' does not exist` |
| 2 | `paymentTerms` por el **parámetro de un callback** | `rc=2 · Property 'paymentTerms' does not exist` |
| 3 | `internalNotes` por **desestructuración** | `rc=2 · Property 'internalNotes' does not exist` |
| 4 | `total` de un select de `job.service.ts` | `rc=2 · Property 'total' does not exist` |

**Tipar una frontera no ha perdido detección en ninguna otra.**

**CONTROL NEGATIVO — el producto pinta lo mismo:** suite entera **5092 tests · 5008 pass · 0 fail**
· 84 skipped. Y **cero `as any` nuevos** en el diff: no se ha apagado ningún error, y **no ha
aparecido ninguno** que apagar — el tipo derivado del `select` describía la realidad.

**El diff toca UN fichero**: `jobs.routes.ts`. No obliga a tocar `quotes.routes.ts` ni
`albaranes.routes.ts`.

## 7 · Huecos declarados

1. 🔴 **`phone` sigue sin vigilancia**, y con él **cualquier campo que sólo consuma el front**. No es
   un fallo del tipado: es su límite. Ya estaba reportado en SCRUM-717 §7 y **no se abre ticket
   nuevo** (regla 37).
2. **`serializeJob(job: any)` y `serializeJobDetail(job: any)` siguen en `any`.** Es el siguiente
   eslabón y es más grande: el `job` viene de consultas sin `select` explícito. Queda para su turno.
3. **`loadJobRefs(jobs: any[])`** y los `any` internos de la construcción de los `Map` no se han
   tocado: los `Map` se declaran tipados y eso basta para lo que LEE `serializeJob`.

---

## APÉNDICE (4-sep-2026, tarde) · El tercer eslabón: `serializeJob`

**Medido contra:** `origin/main` = `7ac80025df1ca0fcc12bc61bf3c1a9025ceeb772` · 2026-09-04T18:40:00+02:00

## 1 · El número que decidía el trabajo — y decía lo contrario de lo esperado

El encargo temía que, sin `select`, no hubiera de dónde derivar el tipo. Medido:

| | |
| --- | :-: |
| consultas que alimentan a `serializeJob` / `serializeJobDetail` | **5** |
| de ellas, **con `select` explícito** | **0** |
| 🔴 control positivo del recuento: `select:` en el fichero | **26** |

**Ese cero lo hace más fácil, no más difícil.** Sin `select`, Prisma devuelve el **modelo entero**,
y su tipo (`Job`) ya está generado. No había nada que derivar: el tipo estaba escrito desde el
principio. **No hacía falta otro ticket.**

## 2 · 🔴 El rojo, y el mecanismo viejo

Campo elegido comprobando ANTES que TypeScript lo lee (`job.titulo`, usado en `serializeJob`):

```
DESPUÉS (job: Job) → tsc rc=2
  jobs.routes.ts(305,43): error TS2551: Property 'tituloo' does not exist on type
    '{ id: number; customerId: number; status: string; createdAt: Date; ... 7 more ...;
       tipoIntervencion: string | null; }'. Did you mean 'titulo'?

ANTES   (job: any)  → tsc rc=0 · 0 errores
```

**SUELO:** con un error deliberado, `tsc` sale `rc=2` y lo nombra. No estaba mudo.

## 3 · CONTROL POSITIVO · las cinco, corridas

| # | inyección | resultado |
| :-: | --- | --- |
| 1 | `status` por **`Map`** | `rc=2 · Property 'status' does not exist` |
| 2 | `paymentTerms` por **callback** | `rc=2 · Property 'paymentTerms' does not exist` |
| 3 | `internalNotes` por **desestructuración** | `rc=2 · Property 'internalNotes' does not exist` |
| 4 | `total` en `job.service.ts` | `rc=2 · Property 'total' does not exist` |
| 5 | `currency` de `QUOTE_SELECT` (717b) | `rc=2 · Property 'currency' does not exist` |

Tipar el tercer eslabón no ha perdido detección en ninguno de los anteriores.

**CONTROL NEGATIVO:** suite **5123 · 5039 pass · 0 fail** · 84 skipped · `tsc` 0 errores · **cero
`as any` nuevos** en `src/`, y ninguno que apagar: el tipo describía la realidad.

## 4 · 🔴 `serializeJobDetail` SE QUEDA EN `any`, y el motivo es un guard de otro carril

`tests/scrum363-eje-de-cobro.test.mjs:108` fija **por texto** la firma:

```js
assert.match(rutas, /async function serializeJobDetail\(job: any\) \{\s*
\s*const base = await serializeJob\(job\);/)
```

Tiparlo **hace caer ese guard sin que la propiedad se haya roto**: la delegación sigue ahí. Es un
control anclado a la FORMA, no al hecho, y cobra un impuesto sobre mejorar el código.

**Lo intenté y lo revertí.** Acotar el regex a `\(job: [^)]+\)` funciona —comprobado: sigue cazando
la delegación rota— **pero desencadena una cascada de anclajes por posición**:

1. mi comentario en `scrum363` desplaza seis líneas;
2. `scrum553-etiquetas-pegadas` ancla `tests/scrum363-eje-de-cobro.test.mjs:133` y falla;
3. actualizar ese número a `139` hace caer a **`scrum710b` · «los anclajes por NÚMERO DE LÍNEA no
   crecen»**, que lo cuenta como un ancla nueva.

**Tres ficheros de otros carriles para tipar una firma.** Se revirtieron los dos que llegué a tocar
y `serializeJobDetail` se queda en `any` **con el motivo escrito en el propio código**.

## 5 · Lo que queda, con su número

- **1 firma sin tipar** (`serializeJobDetail`), bloqueada por 1 guard anclado a la forma
  (`scrum363:108`) y 2 más en cascada (`scrum553:90`, `scrum710b`).
- **`loadJobRefs(jobs: any[])`** y los `any` internos de la construcción de los `Map`.
- Lo de siempre: **los campos que sólo consume el front** no los alcanza `tsc` (SCRUM-717 §7).

## 6 · Hallazgo del camino — se reporta, no se arregla

🔴 **El cliente de Prisma estaba desfasado** y dio un error que no era mío
(`quotes.routes.ts:203 · discountGlobalAmount`). Medido: 2 apariciones en `schema.prisma`, **0 en
el cliente generado**; tras `./node_modules/.bin/prisma generate` (binario local, nunca `npx`),
134. El `node_modules` lo comparten cinco worktrees míos.

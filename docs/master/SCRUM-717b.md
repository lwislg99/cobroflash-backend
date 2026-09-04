# SCRUM-717b · Tipar `JobRefs`: la frontera no se cierra tipando UNA cosa

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

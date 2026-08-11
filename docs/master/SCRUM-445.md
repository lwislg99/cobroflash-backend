# SCRUM-445 · PASO 0: la duplicación se REPRODUCE, y el mecanismo es la clave nula

**Medido contra:** `origin/main` = `9d52ddb9bed8cf527e336d5b64df8a6e8bbc25d7` · 2026-08-11T17:30:52+02:00
**Rama:** `scrum-445-cobros-duplicados`

## (a) REPRODUCIDA — ejecutando la fusión, no leyéndola

`fundirCobros` es puro, así que se puede fabricar la población y ejecutarlo. **Tres formas de que el
mismo dinero salga dos veces:**

| caso | filas | orígenes | |
|---|---|---|---|
| con evento y `invoice_id` **numérico** | **1** | `charge` | correcto |
| **sin evento** | 2 | `charge`, `invoice` | 🔴 duplicado |
| `invoice_id` como **cadena** `"42"` | 2 | `charge`, `invoice` | 🔴 duplicado |
| payload **nulo** | 2 | `charge`, `invoice` | 🔴 duplicado |

## (b) El mecanismo: **la clave de desduplicación cuelga de un solo canal frágil**

De los tres arreglos posibles que planteaba el encargo, **es el segundo**:

- ~~se lee de dos sitios~~ — **a propósito**, y no es el defecto: fundir `Charge` con las `Invoice`
  sueltas es lo que hace visible el **dinero cobrado a mano**. Quitarlo sería volver a esconderlo.
- **la clave es nula** — ✅ **es esto**. El campo que existe para vincular, `Invoice.chargeId`,
  **no lo escribe nadie**; el propio código lo dice: *«`chargeId: null` se conserva y HOY NO EXCLUYE
  NADA»*. Así que **toda** la desduplicación depende de que exista un `Event{type:'invoiced'}` y de
  que su `payload.invoice_id` pase el filtro `typeof === 'number'`.
- ~~el filtro no excluye~~ — cierto, pero es **consecuencia** de lo anterior, no la causa.

## ⚠️ Lo que NO afirmo, y es la mitad del informe

**No he demostrado que hoy esté duplicando en producción.** El camino normal de pasarela
(`ensurePdfAndEvent`, `src/lib/invoicing.ts:270`) **sí** escribe el evento con `updated.id`, que es
un número. En ese flujo **no duplica**.

Lo reproducido es **el mecanismo en aislamiento**. Decir «está duplicando» sin ese dato sería
justamente lo que hoy nos ha ahorrado un ticket entero.

**Lo que falta para cerrarlo, y no lo he podido hacer:** contar en una base real cuántos `Charge`
tienen factura **sin** su `Event{invoiced}`. Eso exige leer producción, y esta tanda no toca ninguna
base. Es el dato que separa «puede pasar» de «está pasando».

## (c) El merge de `cobrosView.js`

Las 140 líneas de `24047c3a` **no tocan la duplicación**: la vista **no desduplica** — solo filtra
por método (`cuboDeMetodo`). Quien decide qué filas hay es `listarCobros`, en el backend. **Ni la
provoca ni la tapa.**

## Un falso positivo de mi propio detector, y por qué se queda escrito

Mi primera heurística marcaba duplicado por `cliente|importe`. Con eso, **dos cobros legítimos del
mismo importe al mismo cliente salían marcados**. Un guard que da falsos positivos se acaba
silenciando, así que el test define el duplicado por lo que es: **la misma operación apareciendo por
los dos orígenes**.

## Lo entregado

`tests/scrum445-cobros-duplicados.test.mjs` — 5 tests que **dejan la reproducción fijada**, con
suelo (si la fusión devuelve cero filas, se declara ciego) y con la mitad que pesa igual: **el
dinero marcado a mano no puede desaparecer al desduplicar**. Cualquier arreglo que se lo lleve por
delante es peor que el defecto.

**No se ha arreglado nada todavía**: el arreglo depende de la respuesta a la pregunta de arriba —si
basta con endurecer el filtro, o hay que **escribir `Invoice.chargeId`**, que es schema y es del
fundador.

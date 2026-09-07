# SCRUM-815 · El webhook de Stripe marca el evento como visto ANTES de terminar de procesarlo

**Fecha:** 7-sep-2026 · **Carril:** dinero (cobro en producción) · **Gate:** PASO 0, medición · **Prioridad:** Highest

**Medido contra:** `origin/main` = `af08201502a3978a484de3933132dfcdf26df790` · 2026-09-07T13:25:00+02:00
**Preámbulo:** `./node_modules/.bin/prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** · `npm run build` rc=0

> ⛔ Esto es **medir, no arreglar**. No se toca `prisma/schema.prisma`, ni el camino de emisión
> (regla 38), ni ninguna clave de Stripe — ni real ni de ejemplo, ni en el código ni en un comentario.

---

## VEREDICTO: **EL DEFECTO EXISTE**

Un pago que Stripe da por entregado y nosotros no registramos. Y no se nota: no hay error, no hay
aviso, hay un cobro que existe en Stripe y no existe en YaQu.

---

## 1 · Dónde se marca, y en qué momento

[`stripe.routes.ts:20-29`](../../src/modules/billing/app/routes/stripe.routes.ts#L20-L29) —
`isDuplicateStripeEvent` **pregunta y marca en la misma llamada**: `:24` consulta el `Set`, `:25`
lo añade. No hay dos pasos, así que no hay ningún sitio donde decir «ya terminé».

El orden de la ruta, leído del fichero:

| línea | qué pasa |
| :-: | --- |
| `:39` | `stripe.webhooks.constructEvent(...)` |
| **`:42`** | **`if (isDuplicateStripeEvent(event.id))` → ACK 200 y NO se procesa** |
| `:47`+ | …**aquí empieza el trabajo**: `axios.post` a `/webhooks/psp`, `prisma.merchant.update`, la recompensa de referido, el email de activación |
| `:170` | `catch` → `res.status(400)` — y un 400 hace que **Stripe reintente** |

La marca está **128 líneas antes** de que termine el trabajo, y el fallo se responde con el código
que provoca el reintento que la marca acaba de inutilizar.

## 2 · Memoria del proceso, no base de datos

```ts
const seenStripeEvents = new Set<string>();   // :20
const seenOrder: string[] = [];               // :21  — LRU de 500
```

No hay tabla ni columna. Se pierde al reiniciar —cada merge a `main` redespliega— y **no se
comparte entre instancias**.

Esto **ya estaba documentado y no se cerró**: [`docs/master/SCRUM-358.md`](SCRUM-358.md) lo censó
el 11-ago-2026 como «la forma F1», con esta frase exacta: *«Se pierde al reiniciar (cada merge a
`main` redeploya) y no se comparte entre instancias»*. Aquel ticket iba de la cola de albaranes y
citó esto como precedente; nadie volvió. Un año de webhook con la avería declarada por escrito.

## 3 · 🔴 El control que decide, corrido

```
🔴 EL CONTROL QUE DECIDE · el MISMO evento dos veces, con fallo en medio del 1º:
   1ª entrega (falla a mitad)         → HTTP 400 · FALLO a medio procesar → Stripe reintentará
   2ª entrega (reintento de Stripe)   → HTTP 200 · DESCARTADO como duplicado
```

El reintento que Stripe manda **porque le dijimos 400** se descarta con un 200. Stripe deja de
reintentar. El cobro se queda sin registrar y nadie se entera.

## 4 · Control positivo — distingue idempotencia de «hay un Set»

```
a) dos eventos DISTINTOS se procesan los dos:
   evt_A → PROCESADO          evt_B → PROCESADO
b) el MISMO evento repetido SIN fallo se descarta una vez:
   evt_C (1ª) → PROCESADO     evt_C (2ª) → DESCARTADO
```

Las dos cosas que la idempotencia **sí** debe hacer, y las hace. Sin este control, la medición de
arriba sólo probaría que existe un `Set`.

Y la otra mitad, en un **proceso nuevo**:

```
🔁 PROCESO NUEVO (el reinicio de Railway, o una segunda instancia):
   evt_C, ya PROCESADO en el proceso anterior → HTTP 200 · PROCESADO
```

Falla por los dos lados: **pierde el reintento** dentro del proceso y **reprocesa** tras un
reinicio o en una segunda instancia.

## 5 · Método, y su límite declarado

Se ejercita `isDuplicateStripeEvent`, que es la misma función que la ruta llama en `:42` y que el
propio código exporta *«para la suite»* (A12.2, `:22`). **No se monta la ruta entera**, y el motivo
es una prohibición, no una comodidad: `integrations/stripe.ts` deja `stripe = null` sin
`STRIPE_SECRET_KEY`, así que la ruta contesta 501 antes de llegar a nada, y montarla exigiría
escribir una clave de Stripe aunque fuese de mentira.

Lo que el banco **no** demuestra por sí solo es el orden de las llamadas dentro de la ruta; eso se
lee en el fichero y está en la tabla de §1.

## 6 · El banco

[`docs/master/evidencias/scrum815/idempotencia-webhook.mjs`](evidencias/scrum815/idempotencia-webhook.mjs)
· salida completa en [`salida.txt`](evidencias/scrum815/salida.txt). No necesita base de datos ni
red. Tiene **suelo**: si `isDuplicateStripeEvent` no se exporta, dice *«no encuentro lo que se
describe»* y sale con 3 — que es un dato distinto de «el defecto no existe».

## 7 · Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión · ninguna clave de Stripe · ninguna cadena de conexión.

# SCRUM-286 · B3 — censo derivado del ENVÍO de «Nuevo presupuesto»

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `eebc191dc75da0040f4934ccd8b92cc857726832` · 2026-08-04T16:03:42+01:00
**Tanda:** 1302 tests, 1235 pass, 0 fail, 67 skipped (`npm test` con exit **0**)
**Ficheros:** `tests/_censo-nuevo-presupuesto.mjs`, `tests/scrum286-censo-nuevo-presupuesto.test.mjs` (6)

> **ALCANCE:** solo el **censo**. No reordena ni un bloque — la construcción espera a B2 (estilo de
> tarjetas) y a la respuesta del fundador sobre AB6.

## La población, declarada — y por qué eso es media tarea

Lección de **SCRUM-311**, encontrada hoy: el guard de SCRUM-271 aparentaba cobertura porque su
ticket estaba Finalizada, pero leía **dos ficheros enumerados a mano**. El número era cierto y
engañaba, porque no decía sobre qué población se había calculado.

Por eso aquí la población **sale en la salida del censo**, no solo en un comentario:

| | |
|---|---|
| **fichero** | `public/dashboard/js/quotesView.js` |
| **frontera** | el objeto que se pasa a `createQuote(...)` + la sub-población de `payloadLines` |
| **mide** | lo que se **ENVÍA** al servidor |
| **excluido** | `saveDraft` → `localStorage`: otra población |

## Por qué el ENVÍO y no lo que se pinta

Son dos poblaciones distintas y el ticket vigila la segunda:

- Un campo **pintado que no viaja** es un control muerto: el pro lo rellena y no pasa nada.
- Un campo **que viaja sin pintarse** es un valor que el pro no controla — legítimo, pero no suyo.

El fallo mudo que declara el ticket —*«un campo que se pierde al reordenar»*— **se paga en el
envío**, y no se ve mirando la pantalla. La población «lo que se pinta» es una medición distinta y
**no está hecha**.

## El censo: 10 + 4

**Envío (10):** `merchant_id`(2900) · `customer_id`(2901) · `currency`(2902) · `lines`(2903) ·
`paymentTerms`(2904) · `customBillingPlan`(2905) · `payMethods`(2906) · `docFields`(2907) ·
`created_via`(2908) · `validUntil`(2910)

**Por línea (4):** `concept`(2872) · `qty`(2873) · `price`(2874) · `tax`(2875)

## 🔀 Contraste con los cinco bloques del ticket

| Bloque | Campos que le corresponden |
|---|---|
| Cliente | `customer_id` |
| Líneas | `lines` + `concept`, `qty`, `price`, `tax` |
| Condiciones | `paymentTerms`, `customBillingPlan`, `validUntil` |
| Envío | `payMethods`, `docFields` |
| **Notas** | **NINGUNO — no viaja nada** |

**Dos diferencias, y las dos son para el fundador:**

1. **«Notas» no existe en el envío.** El ticket lo enumera como uno de los cinco bloques, pero
   ninguna propiedad del payload lo lleva. O el bloque es de la pantalla y no del envío, o hay que
   añadirlo — pero un bloque que no viaja no se puede reordenar en la construcción.
2. **Tres campos no caben en ninguno de los cinco:** `merchant_id`, `currency` y `created_via`.
   Son exactamente el caso «viaja sin pintarse»: contexto, no ajustes del pro. No necesitan bloque,
   pero conviene que conste que están.

## Verificado en rojo

Quitando `docFields` de la línea 2907: cae con
`🔴 solo 9 campos en el envío (esperados ≥10)`. Commiteado **antes** de inyectar; árbol restaurado.

**Suelos:** ≥10 de envío, ≥4 por línea, y todo campo con su línea real del árbol.
**Negativos:** el borrador de `localStorage` no entra (otra población); un `push` a otro array
tampoco.

## Detalle que evitó un falso cero

`createQuote(quotePayload)` **no lleva el literal dentro**: se sigue la **variable**. Mirar solo el
argumento habría dado **cero campos** — y cero se lee como «no hay», que es el falso verde que este
censo existe para no producir.

# SCRUM-315 · D4: el checklist llega hasta donde llega el dinero

**Fecha:** 5-ago-2026 · **Carril:** A (onboarding) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `23e5ab207714998f8337bafcfa5e22a9119d3662` · 2026-08-05T10:52:11+02:00
**Tanda:** 1545 tests, 1478 pass, 0 fail (el resto, gateados a staging)

## Qué cambia, y qué NO

**El checklist no se rehace: se amplía.** Lo que ya hacía mejor que el del competidor —cada paso
dice **para qué sirve**— se conserva, y los tres nuevos lo llevan también. Los cinco pasos que ya
existían siguen exactamente donde estaban, y hay un test que lo fija.

Acababa en «Crea tu primer presupuesto», que es la mitad del camino: **un presupuesto sin firmar no
prueba nada, y un trabajo sin cobrar no ha terminado.** Ahora acaba en el cobro.

| Paso nuevo | Para qué sirve |
|---|---|
| Carga tus precios | Para que un presupuesto salga en 30 segundos |
| Que tu cliente firme un presupuesto | Es tu prueba si luego dice que no lo pidió |
| Cobra tu primer trabajo | Bizum, tarjeta o transferencia, desde el mismo enlace |

Microcopy aprobada por el fundador, literal (regla 30).

## La regla que no se relaja, aplicada

**Un paso cuyo mecanismo no existe no se pinta.** «Carga tus precios» entra porque **se midió**,
no porque nos lo dijeran: hay ruta (`POST /admin/products/load-catalog`) y botón en
`productsView.js`. Y esa comprobación **queda como test**: si mañana desaparece la carga de
catálogo, el paso pasa a ser inalcanzable y salta el rojo — porque un checklist con pasos
imposibles entrena al usuario a ignorarlo entero, incluidos los que sí puede hacer.

## Cada paso sabe si está hecho — y se mide, no se supone

Las tres señales se calculan en el backend, donde ya se consulta la BD, y viajan como booleanos con
nombre propio (`onboarding: { precios, firma, cobro }`). La interfaz **no reimplementa el
criterio**, igual que en SCRUM-314.

- **precios** → `product.count({ merchantId })`
- **firma** → `quote.count({ signatureUrl: { not: null } })` — ⚠️ **no `acceptedAt`**: aceptar y
  firmar no son lo mismo, y el valor del paso está justo en la firma.
- **cobro** → `charge.count({ status: 'paid' })`

## 🔑 Si el mecanismo de comprobar falla, el paso NO se marca

La interfaz exige `=== true`. No es manía: si el bloque no llega —endpoint viejo, respuesta a
medias, cálculo roto— cualquier otra forma dejaría el paso en un valor ambiguo, y **un checklist
que se marca solo por error le dice al profesional que ya está listo cuando no lo está.**

Entre los dos errores posibles, solo uno hace daño: pedirle algo que ya hizo es un incordio;
**darle por hecho un cobro que no ha ocurrido lo manda a la calle creyendo que puede cobrar.**

**Verificado en rojo, por el mecanismo:** relajando el estricto a `!!data.onboarding?.precios`, el
test cae — «se marca como HECHO con valores que no son booleanos». Se prueban las cuatro formas de
fallo: sin bloque, bloque vacío, valores nulos y valores que no son booleanos. Y el control
opuesto: con la señal en `true`, el paso **sí** se marca — sin él, «no marcar nunca» pasaría todo.

## Un defecto que cazó mi propio guard

Los dos pasos nuevos apuntaban a la vista `quotes`, **que no existe** (es `quotes-list`). El test
de «cada paso lleva a una vista registrada» lo pilló antes de salir: un paso cuyo botón no lleva a
ninguna parte es la misma regla incumplida por otro lado. Corregidos a `quotes-list` e
`invoices`.

## Lo que NO cubre

- **No se ha visto en un navegador.** Lo verificado es la lógica de los pasos y sus señales; el
  render del checklist no ha cambiado de forma.
- **AB6 · matriz de dispositivos: hueco declarado.** Tres filas más en una tarjeta que ya existía.
- **El paso de reseñas de Google** sigue donde estaba: no se toca lo que ya funcionaba.

## Ficheros

`src/modules/metrics/domain/metrics.service.ts` (las tres señales) ·
`public/dashboard/js/homeView.js` (los tres pasos) ·
`tests/scrum315-checklist-hasta-el-cobro.test.mjs` (8).

# SCRUM-367 · Atar cada línea de albarán a su línea de presupuesto (`quoteLineIndex`)

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `c711b7968777f29fd00fcddae69c2ba8489c576a` · 2026-08-05T14:47:33+02:00

## El problema

Nada ataba una línea de albarán con su línea de presupuesto. El único enlace por línea del esquema
—`AlbaranLineaFacturada`— da lo **facturado**, no lo **presupuestado**: está al lado equivocado del
ciclo. Sin este campo, «quedan 3 metros de bajante por entregar» (C6) y media G5 solo se pueden
responder cruzando textos, que no es un mecanismo: es una apuesta.

## Sin migración, como decía el ticket

`Albaran.lineas` ya es `Json`, así que el campo cabe dentro. **`prisma/schema.prisma` no se toca**, y
hay un test que falla si `quoteLineIndex` aparece ahí — y otro que falla si `lineas` deja de ser
`Json`, porque entonces la premisa que hizo barata esta decisión habría dejado de ser cierta.

## Los tres puntos

**1 · El campo.** `quoteLineIndex?: number` en `AlbaranLinea`. Opcional: **ausente = línea añadida
en obra**. Ése pasa a ser el dato que distingue las dos categorías — lo que SCRUM-257 declaró fuera
de alcance por no tener con qué.

**2 · `validarLineas` lo conserva. Éste es el punto que hace que todo lo demás valga.** Reconstruye
cada línea campo a campo, así que hasta hoy se comía cualquier extra: se podía guardar el índice al
crear y **desaparecía en la primera edición**, en silencio. Por eso EL test no es «se guarda» sino
**«sobrevive a la edición»**, y se comprueba en tres pasadas seguidas.

**3 · El prellenado lo rellena.** `lineasDeQuoteParaAlbaran` es el único camino que llena un albarán
desde el presupuesto, así que es el único sitio donde el vínculo se puede establecer con certeza.

> ⚠️ **El índice es el de `lines`, no el de `out`.** Esa función **descarta** las líneas que no
> pueden ser línea de albarán, así que las dos listas se desalinean en cuanto se cae una: usar la
> posición de salida ataría la línea 3 del albarán a la 3 del presupuesto cuando en realidad es la
> 4. Un enlace **desplazado** es peor que ninguno, porque C6 se lo creería y respondería sobre la
> partida equivocada. Tiene test propio y su rojo.

## Un enlace roto se rechaza, nunca se guarda como si fuera bueno

El rango se valida contra el **presupuesto real** (`contarLineasDePresupuesto`, scopeado por
merchant), no contra lo que diga el cliente. Sin presupuesto a mano el índice se conserva sin
validar el rango — lo que no se hace es **fingir que se comprobó**.

## 🔴 La familia SCRUM-271 mordió de verdad aquí

La primera versión hacía `Number(bruto)` y comprobaba `Number.isInteger`. **`Number([])` es `0`**, un
entero ≥ 0 perfectamente válido: un array vacío —o cualquier objeto que convierta a 0— se guardaba
**atado a la primera partida del presupuesto, en silencio**. Lo cazó el propio guard, que probaba
`[]` entre la basura.

Ahora se exige que el tipo sea número o cadena de dígitos **antes** de convertir. Y hay test aparte
de que `''`, `null` y `undefined` se traten como ausentes y no como el índice 0.

## Los cuatro rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Quitar la conservación en `validarLineas` | 🔴 **nombrándola**: «EL ÍNDICE SE PIERDE AL EDITAR» |
| 2 | El prellenado usa el índice de salida | 🔴 «con una línea descartada, todas las siguientes quedarían atadas a la partida equivocada» |
| 3 | Aceptar un índice fuera de rango | 🔴 «un enlace roto es PEOR que ninguno» |
| 4 | Volver al `Number()` a pelo | 🔴 «se acepta quoteLineIndex=[]» |

### El rojo 2 salió contaminado la primera vez

Reverti el `.ts` del rojo 1 con `git checkout --` pero **no reconstruí `dist`**, así que el test
seguía leyendo la inyección anterior y el rojo 2 mostró cuatro fallos en vez de uno. Repetido con
`npm run build` entre medias.

**Es la misma regla de la sesión con un matiz nuevo:** en TypeScript, revertir la fuente no revierte
lo que ejecuta el test. `git checkout --` deja `dist` con la inyección dentro.

## Un guard ajeno se puso en rojo, y tenía media razón

`SCRUM-257 (a)` comparaba la forma **exacta** del objeto del prellenado, y el campo nuevo la rompía.
Su invariante real es «no se cuela precio ni IVA», y sigue entero. Ahora compara los campos de
entrega y **además comprueba el origen** — que es literalmente lo que aquel ticket dio por imposible
por no tener con qué.

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0**: **1625 tests · 1558 pass · 0 fail · 67
  skipped**.

## Lo que queda pendiente, dicho claro

El campo se rellena **desde el prellenado del front**. Un albarán creado por otra vía (API directa)
puede mandarlo y se conserva, pero **nadie lo rellena por él**. C6 y G5 deben tratar la ausencia
como «línea de obra», nunca como «no hay correspondencia».

## Lo que NO se tocó

`prisma/schema.prisma` · el cálculo de C6 (**SCRUM-305**) · G5 (**SCRUM-320**) · la firma · el camino
de emisión (regla 38).

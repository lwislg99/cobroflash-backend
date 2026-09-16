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

---

## La construcción: el formulario en CUATRO bloques (segunda entrega de B3)

**Fecha:** 5-ago-2026 · **Carril:** UI (una pantalla) · **Gate:** ninguno

**Medido contra:** `origin/main` = `c2be01e9347a2b0b761e764de7033f322f820f85` · 2026-08-05T06:00:31+01:00

**Suite en esa base:** 1438 tests · 1371 pass · **0 fail** · 67 skip · exit **0**
**Suite con este cambio:** 1462 tests · 1395 pass · **0 fail** · 67 skip · exit **0** (+24)

> `prisma/schema.prisma` intacto. Sin BD, sin red, sin producción. No se toca el camino de emisión
> (regla 38), ni el cálculo del presupuesto, ni el modelo de datos.

### 🔴 Lo primero: el orden que afirmaba el ticket NO era el orden real

El ticket describía el defecto así: «empieza por *Estación de calor* y las condiciones de pago, y
las líneas **y el cliente** vienen después». Eso venía de mirar una pantalla, no el código. Se ha
medido, y **dos de las tres afirmaciones son falsas**:

| afirmación del ticket | medido |
|---|---|
| «empieza por *Estación de calor*» | ❌ **No existe.** Una sola aparición en todo el repo, en `docs/diseno/bloque-b.md:175`, y es prosa describiendo una captura. **Cero** en `quotesView.js`. Es el nombre de una línea de ejemplo, no un campo. |
| «el cliente viene después» | ❌ **El cliente ya era lo PRIMERO.** `fieldCustomer` (`customer_id`) se pintaba el primero de todos. |
| «las condiciones de pago antes que las líneas» | ✅ **Cierto**, y es el defecto de verdad. |

Orden real, derivado con AST (`tests/_orden-pintado-presupuesto.mjs`) y confirmado
**independientemente** leyendo el DOM en un navegador real (banco AB6):

```
customer_id → vat_default → include_description → payment_terms → [tramos] →
validUntil → payMethods → docFields → ...y AHÍ empezaban las líneas
```

**El defecto, dicho bien:** no era un orden invertido, era **UN SOLO BLOQUE titulado «Datos del
cliente» con siete controles de cuatro asuntos distintos**. El título mentía sobre su contenido, y
cinco de esos asuntos se pintaban entre el cliente y las líneas.

No se reordena bien lo que no se ha medido en qué orden está. Por eso esta medición fue **antes**
que el reordenado.

### Los CUATRO bloques (decisión del asesor: «Notas» sale)

```
1. Cliente        customer_id
2. Líneas         vat_default + lines (concept, qty, price, tax)
3. Condiciones    payment_terms · tramos (customBillingPlan) · validUntil
4. Envío          include_description · payMethods · docFields
```

«Notas» **no existe** — medido en la primera entrega con control positivo. No hay control muerto:
hay un bloque de más en el diseño. Añadirlo tocaría el modelo, fuera de alcance. Los tres campos
que **viajan sin pintarse** (`merchant_id`, `currency`, `created_via`) constan en
`tests/_asignacion-bloques-presupuesto.mjs` para que nadie los busque en la pantalla.

### Cómo se hizo, y por qué así

**Los cuatro contenedores se crean por delante y sólo cambia el DESTINO de siete `appendChild`.**
El orden del DOM lo fija el orden en que los bloques se cuelgan de `leftCard`, no el orden en que se
rellenan — así que el código que construye cada campo **se queda exactamente donde estaba**. Mover
código es donde se pierde un campo en silencio, y ése es el fallo mudo que este ticket declara.

**Sin factoría `crearBloque()`, a propósito.** El censo de orden deriva el esqueleto estático como
«los `appendChild` que NO están dentro de una función anidada». Una factoría metería el
`leftCard.appendChild` dentro de una función y el censo dejaría de ver el formulario — habría que
retocar el censo para que aceptase justo la forma recién escrita, que es medir contra uno mismo. Se
paga la repetición y el censo sigue siendo independiente.

**Cero CSS nuevo.** Los cuatro bloques usan `.quote-block` y `.quote-block-title`, que ya existían
(`styles.css:1022-1023`). No nace un segundo lenguaje visual.

**Microcopy (regla 30):** los cuatro títulos salen como `[PENDIENTE microcopy oficial] N. Xxx`,
misma convención que SCRUM-284/B1. Un guard falla si un título se escribe directo.

### El guard: dos poblaciones, y ninguna sola habría bastado

`tests/scrum286-bloques-orden.test.mjs` (24 tests) une lo ya medido con lo nuevo:

* `_censo-nuevo-presupuesto.mjs` → **qué se ENVÍA** (10 + 4, primera entrega)
* `_orden-pintado-presupuesto.mjs` → **qué se PINTA y en qué orden** (nuevo)

El guard de la primera entrega dice «solo 9 campos (esperados ≥10)» **sin decir cuál**, y no ve un
campo que sigue viajando pero se quedó en el bloque equivocado. El nuevo nombra las cinco averías:
dejó de viajar · viaja sin control en pantalla · está en el bloque equivocado · nadie lo colocó ·
está asignado a un bloque inexistente.

**Suelos:** raíz derivada (`leftCard`), ≥4 bloques, ≥150 inserciones, ≥20 nodos colocados, ≥10
campos de envío y ≥4 por línea. Y **el supuesto se comprueba**: si aparece un `insertBefore` /
`prepend` sobre un contenedor del formulario, el orden derivado dejaría de ser el real y el guard
**falla** en vez de reportar un orden inventado. Los reordenadores legítimos (`moverLinea` sobre
`linesBody`, la modal de compartir) quedan **declarados fuera**, no ignorados en silencio.

**Rojo por el mecanismo** — 6 tests que mutan la fuente REAL en memoria:

| mutación | lo que sale |
|---|---|
| quitar `docFields` del payload | `dejaronDeViajar: ['docFields']` |
| descolgar `docFieldsWrapper` del bloque | `sinControlEnPantalla: ['docFields (control …)']` |
| mover `payMethodsWrapper` de bloque | `payMethods: … está en blockClient, se esperaba blockDelivery` |
| añadir un campo nuevo al payload | `sinSitio: ['notas']` |
| **vaciar el bloque de Condiciones** | nombra **sus tres** campos, uno a uno |
| romper `createQuote(quotePayload)` | cae el **SUELO**, no el recuento |

Cada mutación **comprueba primero que se aplicó de verdad**: un patrón que dejara de existir haría
que la mutación no cambiase nada y el test seguiría verde «demostrando» un rojo que nunca ocurrió.

**Negativos:** un comentario nuevo no lo tumba; reordenar **dentro** de un bloque tampoco — sólo se
vigila el cambio de bloque, porque un guard que impide tocar el orden interno se acaba desactivando.

### SCRUM-271/311: la forma no ha vuelto

`<input type="number">` vacío devuelve `""`, `Number("")` es `0`, y `0 || 1` inventa un `1`. El
guard vivo de SCRUM-311 sigue verde y se le añade la comprobación en el fichero que este ticket
toca. **No se ha introducido ningún `|| <valor>` nuevo sobre una lectura de input.**

### 🔎 Hallazgos — reportados, no arreglados (regla 9)

1. **La excepción de SCRUM-311 está anclada por NÚMERO DE LÍNEA.** Al meter 49 líneas por encima,
   `quotesView.js:2585` pasó a `:2634` y el guard cayó él solo con «ya no corresponde a nada:
   bórrala» — exactamente lo que tenía que hacer. Se **actualiza el número**, no se borra la
   excepción: ni el código vigilado ni la decisión pendiente del fundador han cambiado.
   **El hallazgo es el anclaje**: cualquier edición de más arriba lo rompe aunque no toque lo
   vigilado. Cambiarlo a un anclaje estable es rediseñar el guard. **Carril: SCRUM-311.**
2. **`include_description` está pintado y NO viaja.** «Incluir descripción en el PDF» sólo afecta a
   la vista previa («MVP: solo afecta a la vista previa por ahora», comentario del propio código).
   El pro lo marca y no llega al servidor. Se coloca en Envío porque es donde pertenece por asunto,
   pero **decidir si debe viajar es otro ticket** y toca el modelo. **Lo decide el fundador.**

### Lo que NO se ha hecho, y es la frontera

* **El formulario de «Nueva factura».** Sus bloques 1 y 4 son hueco estructurado y su contenido es
  Bloque A (A1/A2/A3). No se toca: ni tipo de factura ni IRPF.
* **Unificar el selector de cliente con el de facturas** (deuda declarada en SCRUM-289): tocaría
  `invoicesView` además de `quotesView` — dos pantallas, y eso choca con la regla 4.
* Modelo de datos · fiscal · cobro · firma · PDF · la lógica de cálculo del presupuesto.
* **El orden dentro de cada bloque se deja como estaba.** El ticket lista «validez, forma de pago,
  anticipo» para Condiciones, pero el editor de tramos está gobernado por el `select` de
  condiciones y separarlos empeora la pantalla. El defecto medido era de bloques, no de orden
  interno, y mover ese código sólo añadía riesgo de perder un campo.

### Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/js/quotesView.js` | cuatro bloques por delante; siete `appendChild` cambian de destino |
| `tests/_orden-pintado-presupuesto.mjs` | **nuevo** · deriva el orden de pintado (AST) |
| `tests/_asignacion-bloques-presupuesto.mjs` | **nuevo** · la junta de las dos poblaciones |
| `tests/scrum286-bloques-orden.test.mjs` | **nuevo** · 24 tests: suelos, orden, asignación, 6 rojos, negativos |
| `tests/_censo-cantidad-inventada.mjs` | excepción de SCRUM-311: línea 2585 → 2634, con su motivo |
| `docs/capturas/scrum-286/` | 6 capturas AB6 (3 anchos × antes/después) + README |

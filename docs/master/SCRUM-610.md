# SCRUM-610 · CAT-02 — el precio final al elegir del catálogo

**Medido contra:** `origin/main` = `558765adf2d2f09288e20e2b878c69d6edc3380b` · 2026-09-02T22:20:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** el **precio** de la línea al elegir del catálogo. No se toca el selector de IVA
(DOC-16, S1), ni la cabecera ni las observaciones del pie (DOC-03, S3), ni el margen del catálogo
(CAT-01, entregado), ni la zona horaria ni el semáforo. **P6 se mide y se propone; no se decide.**

---

## 1 · Lo primero que cambió el tamaño del ticket: **cuatro de los cinco casos ya pasaban**

CAT-01 (SCRUM-609) dejó el terreno hecho, y no por convenio: **el catálogo NO guarda el margen, lo
DERIVA** de coste y precio (`margenCatalogo.margenDesde`). O sea que **`Product.price` YA ES el
precio final**. Medido sobre el modelo de la pantalla, anclado a la fuente:

| Caso del control | Antes de tocar nada |
|---|---|
| elegir un **PRODUCTO** → la línea trae el precio final | ✅ 121,00 € |
| elegir un **SERVICIO** → también, y sin pedir coste | ✅ 45,00 € |
| **cambiar el precio a mano** → se respeta | ✅ 150,00 € |
| **NEGATIVO:** línea a mano, sin catálogo | ✅ 80,00 €, como hoy |

**El único roto no estaba en la lista.**

## 2 · 🔴 EL DOBLE MARGEN

Una línea que **ya traía margen** y en la que después se elige del catálogo:

```
producto: coste 100 · precio 121 (margen derivado del 21 %, YA dentro del precio)
línea con margen del 20 %  ->  el documento llevaba 145,20 €
```

El margen del catálogo estaba dentro del precio **y se volvía a aplicar encima**. El profesional
cobraría un margen que no ha decidido, sobre un precio que creía cerrado.

**No es un caso raro, y está medido:** el margen de la línea **se guarda en el autoguardado del
borrador** (`markup` en el estado que se restaura) **y viaja en las plantillas**
(`template.lines.forEach(addLine)`). Una línea puede llegar con margen puesto antes de que nadie
elija nada del catálogo.

**Mitigante que conviene no perder:** no era silencioso. El pie de la línea pinta
`Final: 145,20 €` cuando hay margen. Se veía; simplemente contradecía la premisa del ticket.

### El arreglo

Al elegir del catálogo, **el margen de la línea se pone a cero**, porque el precio que entra ya lo
lleva dentro. Una línea, dentro del bloque del precio de `selectItem`.

**Se pone a 0 en vez de esconder el campo:** el margen del documento es DOC-08 y no es este
ticket. Así el profesional **lo ve**, y si quiere margen extra sobre el precio de catálogo lo
escribe después — que es lo que ya podía hacer, y **se sigue respetando** (⑥ abajo).

## 3 · El control, en las dos direcciones

| | Después |
|---|---|
| ① PRODUCTO del catálogo | 121,00 € |
| ② SERVICIO (sin coste) | 45,00 € |
| ③ precio cambiado a mano | 150,00 € · y con coma decimal, 99,50 € |
| ④ **NEGATIVO:** línea a mano | 80,00 € · con margen propio del 10 %, 88,00 € |
| ⑤ **línea con margen 20 % y LUEGO se elige** | **121,00 €** (antes 145,20) |
| ⑥ **elegir y DESPUÉS poner 20 %** | **145,20 €** — el margen a conciencia se respeta |

⑥ es la mitad que impide que esto sea «quitar el margen» en vez de «quitar el doble margen».

### 🔴 Un defecto en MI PROPIO TEST, cazado al provocar el rojo

La primera versión del modelo llevaba el `markup = '0'` **escrito a mano**. Al quitar el arreglo de
`quotesView.js` para ver el rojo, **el test del doble margen SEGUÍA EN VERDE**: sólo caía el suelo.
Un test que no puede fallar por el cambio que dice vigilar es decoración con forma de aserción.

Corregido: las dos reglas **se leen de la fuente** (`VISTA.includes(...)`) en vez de copiarse. Con
eso, cada rojo tumba el test que le corresponde:

| Inyección en `quotesView.js` | Cae |
|---|---|
| ① se quita el arreglo → vuelve el doble margen | el suelo **y** el test del doble margen **y** la frontera |
| ② el precio deja de rellenarse desde el catálogo | el suelo **y** «un PRODUCTO trae el precio final» |
| ③ el arreglo se muda al bloque del IVA (invade a S1) | el suelo **y** el doble margen **y** la frontera |

Las tres revertidas con `Buffer.compare` sobre bytes de disco; verde otra vez (8/8).

## 4 · ⚠️ P6 · el margen real cuando el precio cambia — **MEDIDO, NO DECIDIDO**

**La pregunta:** si el profesional cambia el precio en la línea, el margen real de esa venta deja
de ser el del catálogo. ¿Se registra en algún sitio o se ignora?

### 4.1 · Lo que se midió, y es peor que «no se guarda»

| | Medido |
|---|---|
| ¿sobrevive algo al documento? | `QuoteLineSchema` deja pasar **sólo** `concept, qty, price, tax` (+ `suplido`). `productId`, `costeUnitario` y `markup` los **borra zod en silencio** |
| ¿dónde vive el coste? | Sólo en `Product.cost`, del catálogo |
| ¿es estable? | **NO.** `PATCH` lo sobrescribe (`patch.cost = …`) y **no hay histórico** |

**La consecuencia, que es el nudo:** el margen real de una venta **no es recuperable a
posteriori**, ni siquiera en teoría. Aunque se supiera el precio de venta, **el coste de aquel día
ya no existe** si alguien lo actualizó después. No es que no se guarde el margen: es que no se
guarda el hecho del que se derivaría.

### 4.2 · Las salidas, con su consecuencia

| | Salida | Consecuencia |
|---|---|---|
| **A** | **No registrar nada** (lo de hoy) | Cero trabajo. «¿Cuánto gané en este trabajo?» queda sin respuesta exacta para siempre, y en silencio: nada avisa de que el número no se puede reconstruir |
| **B** | **Congelar el COSTE unitario en la línea** al elegir del catálogo | Guarda el **hecho**, no la conclusión: de coste + precio se deriva el margen cuando haga falta, con el mismo criterio que CAT-01 usa en el catálogo. Es aditivo y **no toca Prisma** (`Quote.lines` es `Json`). Sí toca `QuoteLineSchema` → **diff preparado abajo** |
| **C** | **Registrar el margen ya calculado** | 🔴 Guarda la **conclusión**. Si alguien edita el precio después, el margen guardado queda incoherente con la línea y no hay forma de saber cuál manda. B no tiene ese problema |
| **D** | **Guardar sólo el `productId`** y mirar el catálogo | 🔴 No resuelve: el coste es mutable y sin histórico (§4.1). Devolvería el margen de HOY, no el de la venta |

**Lo que aporto sin elegir:** B es la única que sobrevive a que el catálogo cambie, y es coherente
con la decisión que CAT-01 ya tomó —guardar los hechos y derivar lo demás—. **A es defendible si
la respuesta del producto es «el margen es del catálogo, no de la venta»**, y en ese caso conviene
que quede escrito, porque hoy parece un olvido y sería una decisión.

**Y no choca con DOC-08:** aquello quita el margen del **documento**; esto guardaría un dato
**interno** que no se pinta. Parece que se contradicen y no.

### 4.3 · ⛔ DIFF PREPARADO para la salida B — NO APLICADO

> ## ⏱️ NOTA DE CADUCIDAD — 5-sep-2026: **ESTE DIFF YA ESTÁ EN `main`. NO LO APLIQUES.**
>
> Lo aplicó **SCRUM-661** (`2e3e7685`, «el coste unitario viaja y se CONGELA en la línea»), y es
> **la salida B**, con el mismo argumento que la sostiene aquí: `Product.cost` es mutable y sin
> histórico, así que actualizar un coste reescribe el pasado de todas las ventas que lo usaron.
>
> **La medición de abajo NO estaba mal cuando se hizo, y eso importa para leerla:** en el ancla de
> esta entrada (`558765ad`, 2-sep 12:42) `costeUnitario` **no existía** — comprobado sobre ese
> mismo árbol, 0 coincidencias en `schemas.ts`. SCRUM-661 entró **2 h 21 min después**, a las
> 15:03. No es un error de nadie: es una línea base que caducó mientras se escribía.
>
> **Lo que hay hoy en `main`** (`schemas.ts:113`), refinado luego por SCRUM-712 para acotar los
> decimales — mismo campo, misma semántica, y sigue siendo `.optional()` porque **ausente ≠ cero**:
>
> ```ts
> costeUnitario: conDecimales(z.number().nonnegative(), DECIMALES_PRECIO_UNITARIO, 'el coste unitario').optional(),
> ```
>
> ### 🔴 Y lo que esto NO significa
>
> **P6 sigue SIN FIRMAR.** Censado el 5-sep-2026 en todo `docs/`: la única línea que la nombra en
> este carril es el título de §4 («MEDIDO, NO DECIDIDO»). O sea que **la salida B está construida y
> la pregunta sigue abierta** — la implementación llegó por otro carril y por su propio motivo, no
> porque alguien eligiera B aquí.
>
> Eso deja dos cosas por hacer, y ninguna es código:
>
> 1. **Firmar P6** (o dejar escrito que la respuesta es «el margen es del catálogo, no de la venta»,
>    la salida A) — hoy el repo no distingue «se decidió B» de «B apareció por otro sitio».
> 2. Si se firma A, **hay que decir qué se hace con el `costeUnitario` que ya se está guardando**,
>    porque A y lo construido no conviven en silencio.

```diff
--- a/src/core/validation/schemas.ts
+++ b/src/core/validation/schemas.ts
@@ const QuoteLineSchema = z.object({
   concept: z.string().min(1),
   qty: z.number().positive(),
   price: z.number().nonnegative(),
+  /**
+   * SCRUM-610 (P6) · EL COSTE UNITARIO CONGELADO EN EL MOMENTO DE LA VENTA.
+   *
+   * Sin declararlo aquí, `z.object` lo BORRA en silencio —igual que le pasaba a `suplido` antes
+   * de SCRUM-500— y no llegaría nunca a `Quote.lines`.
+   *
+   * Se guarda el COSTE y no el margen a propósito: el margen es una conclusión y quedaría
+   * incoherente si alguien edita el precio; el coste es un HECHO de ese día. Y hace falta
+   * congelarlo porque `Product.cost` es mutable y NO tiene histórico: sin esto, el margen real
+   * de una venta no se puede reconstruir ni en teoría.
+   *
+   * Que falte significa «no se sabe» —línea escrita a mano, o anterior a este campo—, que es
+   * distinto de coste cero.
+   */
+  costeUnitario: z.number().nonnegative().optional(),
   tax: z.number()
```

**`prisma/schema.prisma` no se toca:** `Quote.lines` es `Json`, así que cambia la forma del Json y
no la columna. **No hay `ALTER TABLE` ni migración.**

## 5 · Frontera con S1 y S3

Los tres estamos en la misma pantalla: S1 lleva el **tipo de IVA** de la línea (DOC-16), S3 la
**cabecera y las observaciones** del pie (DOC-03), y este ticket **el precio**.

El cambio son **cuatro líneas dentro del bloque del precio** de `selectItem`, y hay un test que
comprueba que **sigue estando antes del bloque del IVA**: si alguien lo muda, cae. No es celo —
es lo que mantiene tres diffs separables en un fichero que estamos tocando a la vez.

**No me encontré tocando ni el selector de IVA ni el pie.**

## Tests que introduce esta entrada

* `tests/scrum610-precio-final-del-catalogo.test.mjs` — 8 pruebas: el suelo de las ocho anclas, los
  cuatro casos del control, el doble margen, el margen legítimo puesto después, el control
  negativo de la línea a mano y el guard de frontera con S1.

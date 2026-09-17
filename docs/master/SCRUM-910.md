# SCRUM-910 · Lo que se ofrece sin comprobar su condición — ① medido, y el resto PARADO

**Medido contra:** `origin/main` = `0888df9e1e07d9678c87f5555a1d160db1c97eb8` · 2026-09-17T11:33:54+01:00
**Rama:** `scrum-910-lo-que-se-ofrece-sin-condicion`
**Carril:** cobro · superficie del cliente final · **Gate:** sin gate

> 🔴 **ESTA ENTREGA ESTÁ PARADA A PROPÓSITO, en el punto donde el encargo mandaba parar.** El caso
> que el fundador pidió medir **EXISTE**. Los bloques ② (los `href="undefined"` de `admin.html`) y
> ③ (la propuesta de microcopy) **no se han tocado**: esperan su decisión de prioridad.
>
> ⛔ `prisma/schema.prisma` intacto · `payCard.routes.ts` intacto · sin flags ni estados nuevos
> ⛔ **Ni una línea de `src/` modificada en esta rama.** Sólo instrumento y expediente.
> ⛔ Ningún texto escrito en el producto. Ninguna base consultada. Staging no se ha tocado.

> ⚠️ **DEPENDE DE SCRUM-893, que aún no está en `main`.** Esta rama la lleva mergeada porque el
> caso **sólo existe después** de aquel arreglo: mientras la tarjeta se siga ofreciendo a todo el
> mundo, esta clienta tiene una opción más —rota, pero visible—. **Se mergea después de la 893.**

---

## 1 · El caso existe. Y es peor que el defecto que cerró SCRUM-893

**Un merchant sin Stripe Connect y sin IBAN**, con la 893 aplicada. Medido corriendo las tres rutas
públicas con dobles de `prisma` y de Stripe — ni BD, ni red, ni staging:

| ruta | qué ve la clienta |
|---|---|
| `/pay/invoice/:token` | **ningún método**, y el bloque «El profesional te indicará cómo pagar» ✅ |
| `/recibo/:token` | **un solo botón: «Pagar por transferencia»** 🔴 |
| `/pay/bank/:token` | HTTP **200**, **sin número de cuenta**, y la instrucción dice «Haz una transferencia por 250,00 €» **sin decir a dónde** 🔴 |

🔴 **La clienta pulsa el único botón que tiene y llega a una página de transferencia sin cuenta a la
que transferir.**

**Y por qué es peor que el bucle de SCRUM-893**, que es lo que lo sube de prioridad:

- En la 893 el callejón **se anunciaba**: un 409 que decía «este negocio aún no ha activado los
  cobros con tarjeta» y un enlace de vuelta. Era un bucle, pero legible.
- Aquí **no hay error**. La página responde 200 y parece completa: tiene el importe, el concepto,
  los pasos numerados. Lo único que falta es el dato que hace que sirva para algo. La clienta no
  concluye «esto no está disponible», concluye que ya ha pagado o que lo hará luego.

Y las dos superficies **se contradicen sobre el mismo merchant y el mismo cobro**: el selector dice
que no hay forma de pago; el recibo ofrece una que no funciona.

    🔒 Un callejón sin salida que devuelve 200 es peor que uno que devuelve 409:
       el segundo se ve, el primero se confunde con haber terminado.

## 2 · La población, medida por COMPORTAMIENTO

Lo pedido: cuántas formas de pago se ofrecen sin comprobar su condición y cuántas la comprueban.
No se ha leído el código para contestarlo — a cada oferta se le pone delante un merchant para el
que **esa vía no es cobrable** y se mira si la página la ofrece igual. Leer el fuente diría «hay un
`if`»; esto dice si el `if` sirve.

**POBLACIÓN: 7 ofertas de forma de pago, en 3 superficies públicas.**

| # | superficie | forma | condición | ¿la comprueba? |
|---|---|---|---|---|
| 1 | `/pay/invoice` | tarjeta | Stripe Connect activo | ✅ |
| 2 | `/pay/invoice` | transferencia | IBAN o CLABE | ✅ |
| 3 | `/pay/invoice` | Bizum | flag `BIZUM_MANUAL_ENABLED` | ✅ |
| 4 | `/pay/invoice` | Bizum | móvil para Bizum | ✅ |
| 5 | `/recibo` | tarjeta | Stripe Connect activo | ✅ *(por SCRUM-893)* |
| 6 | **`/recibo`** | **transferencia** | **IBAN o CLABE** | **🔴 NO** |
| 7 | `/cliente` | tarjeta | Stripe Connect activo | ✅ *(por SCRUM-893)* |

**6 de 7 comprueban su condición. Una no: la transferencia en `/recibo`.**

**Cada fila lleva su control positivo** —el mismo merchant con la condición cumplida— y las 7 lo
pasan: **0 filas ciegas**. Sin eso, una oferta oculta por cualquier otro motivo se habría contado
como «comprueba su condición» y el censo habría salido perfecto midiendo otra cosa.

El mecanismo, para el que venga a arreglarlo: en `receipt.routes.ts` el botón se pinta con
`ch.status === 'pending'` y nada más; y en `payBank.routes.ts` el bloque de cuenta sólo se compone
si hay `iban` o `clabe`, así que sin ellos **desaparece en silencio** en vez de negarse.

## 3 · Los dos estados, para que se vea qué cambia con la 893

| | `/pay/invoice` | `/recibo` | `/pay/bank` |
|---|---|---|---|
| **hoy en `main`** (sin 893) | ofrece tarjeta 🔴 | tarjeta + transferencia | sin cuenta 🔴 |
| **con la 893** | ningún método, y lo dice ✅ | **sólo transferencia** 🔴 | sin cuenta 🔴 |

La 893 no crea este defecto: **lo deja al descubierto**. Hoy la clienta ya llegaría a la misma
página vacía de `/pay/bank`; lo que cambia es que antes tenía otro botón donde estrellarse y ahora
ése es el único camino que se le ofrece.

## 4 · 🔴 Y mi primera sonda dio un falso «sí», que casi reporto

El detector de «¿hay número de cuenta en pantalla?» era `/account-value/`, y daba **`true` para el
merchant sin IBAN**. `account-value` es una **clase CSS** que el documento lleva siempre en su
`<style>`: la sonda estaba midiendo la hoja de estilos, no el dato. Con ese detector, el caso más
grave de este ticket salía como «todo correcto».

El detector bueno es `id="account-num"`, que **sólo** aparece dentro del bloque de cuenta —
comprobado, no supuesto: `account-value` sale 6 veces en el fichero (CSS incluido) y `account-num`
exactamente 2, las dos dentro de ese bloque.

    🔒 Contar texto no es contar cosas. Un prefijo no es un nombre, y una clase CSS tampoco.

## 5 · Lo que NO se ha hecho, y por qué

1. **No se ha arreglado nada.** El encargo decía: mídelo, y si el caso existe, para y dilo. Existe.
2. **② `admin.html` y ③ la propuesta de microcopy: sin tocar.** Esperan la decisión de prioridad.
3. **No se ha medido cuántos merchants reales están en este estado** (sin Connect y sin IBAN). Eso
   exige consultar una base, y esta sesión no lo hace. Es la cifra que diría si el defecto tiene
   una víctima o cien, y **no la tengo**.
4. **No se ha mirado `/pay/mp`** (Mercado Pago), que es la cuarta ruta de `/pay` y no entró en el
   censo por no estar en el camino ES. Queda declarado como no medido, no como correcto.

## 6 · Ficheros

| fichero | qué |
|---|---|
| `docs/master/evidencias/scrum910/censo-formas-de-pago.mjs` | el censo por comportamiento, 7 ofertas con su control positivo |
| `docs/master/SCRUM-910.md` | esto |
| `src/` | **sin tocar** |

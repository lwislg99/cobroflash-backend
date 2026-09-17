# SCRUM-910 · Lo que se ofrece sin comprobar su condición — la transferencia, arreglada

**Medido contra:** `origin/main` = `0888df9e1e07d9678c87f5555a1d160db1c97eb8` · 2026-09-17T11:33:54+01:00
**Rama:** `scrum-910-lo-que-se-ofrece-sin-condicion`
**Carril:** cobro · superficie del cliente final · **Gate:** sin gate

> **Este expediente se escribió en DOS tandas y se lee en ese orden.** §1–§4 son la medición que el
> encargo pidió **antes** de tocar nada, y que mandaba parar si el caso existía: existe. §5–§7 son
> lo que vino después, cuando el fundador autorizó el arreglo (17-sep-2026). Las secciones de la
> primera tanda **no se han reescrito** — §5 corrige una de ellas, y esa corrección es parte del
> registro.
>
> ⛔ `prisma/schema.prisma` intacto · `payCard.routes.ts` y `payBank.routes.ts` intactos, cero
> líneas de diff · sin flags ni estados nuevos (27) · sin dependencias (36)
> ⛔ **Ningún texto escrito en el producto.** Hay una propuesta de microcopy PARADA en §7.
> ⛔ Ninguna base consultada. Ninguna credencial. Staging no se ha tocado.
>
> **Bloques que siguen esperando decisión:** ② los `href="undefined"` de `admin.html` y ③ la firma
> del microcopy.

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

## 5 · 🔴 CORRECCIÓN A MI PROPIO CENSO — la fila #2 estaba mal medida

La Sesión 3 encontró (comentario 15679 de SCRUM-893) que **un negocio ES con sólo CLABE** ve
«Transferencia» y aterriza en un `/pay/bank` que le dice que el profesional no ha configurado su
cuenta. Medido corriendo, y confirmado.

**Y eso destapa que mi censo de §2 dio la fila #2 por buena con la condición equivocada.** Declaré
que la transferencia del selector comprobaba «IBAN o CLABE» ✅ — que es la condición que **el código
usaba**, no la que hace falta para que la transferencia **sirva**. La de verdad la fija la página
destino: CLABE **sólo** en México, IBAN en cualquier otro caso.

Un censo que toma la condición del código como si fuera la verdad no puede cazar este defecto:
pregunta «¿hay un `if`?» en vez de «¿el `if` es el correcto?». Es el error que el censo existía
para evitar, cometido por el censo.

    🔒 La condición contra la que mides no la pone el código que ofrece: la pone la página que
       tiene que cumplirlo.

### Y una segunda corrección, sobre lo que yo mismo reporté en §1

Dije que en `/pay/bank` «no hay error» y que la página «parece completa». **Es incompleto**: sí hay
un aviso — «ℹ️ El profesional aún no ha configurado su cuenta bancaria». Mi detector no lo miró.
Sigue siendo un callejón sin alternativa, pero **se le avisa**, y eso lo hace menos grave de lo que
conté. La frase «se confunde con haber terminado» estaba exagerada.

## 6 · El arreglo · la misma pregunta para ofrecer que para poder enseñar la cuenta

Había **CUATRO** criterios para la transferencia — uno más que los tres de la tarjeta:

| dónde | criterio |
|---|---|
| `payInvoice.routes.ts:57` · el selector | `!!(iban \|\| clabe)` ← **no miraba el país** |
| `receipt.routes.ts:110` · el recibo | **ninguno** (`status === 'pending'` y ya) |
| `payBank.routes.ts:41` · la página destino | `country === 'MX' && clabe` · `else if (iban)` |
| `viasDeCobro.ts:79` · el dashboard del PRO | **sólo `iban`** — ignora la CLABE |

El que decide es el tercero: es quien pinta —o no— el número de cuenta. Los otros tres opinan.
`transferenciaDisponible(merchant)` replica esa regla y la usan el selector y el recibo.

**`payBank.routes.ts` conserva cero líneas de diff**, igual que `payCard.routes.ts` en SCRUM-893: el
banco lo ata contra la ruta **EJECUTADA** —se le pide `/pay/bank/:token` a cada combinación y se
mira si pinta cuenta—, no contra su fuente.

⚠️ **`viasDeCobro.transferencia` NO se toca**, y es deuda declarada: sigue ignorando la CLABE, igual
que `viasDeCobro.tarjeta` sigue ignorando el flag y el demo. Cambiarlo altera lo que el PROFESIONAL
ve sobre su propia cuenta, y eso lo decide el fundador.

### Los controles, ejecutados

- **② la tabla**: 12 combinaciones de país × IBAN × CLABE (tres países, no dos: con sólo ES y MX,
  «no-MX» y «ES» serían indistinguibles y la regla es «CLABE sólo en MX»), comparadas contra
  `/pay/bank` ejecutada, con su control de que la página destino no contesta lo mismo a todo.
- **③ y ④**: rojo y verde real en el selector y en el recibo, y el caso del ticket.
- **Los tres rojos inyectados en `src/`** (`docs/master/evidencias/scrum910/rojos-910.mjs`):

| mutación | qué tumba |
|---|---|
| el dominio deja de mirar el país | ② y los dos ③ |
| el selector vuelve a su condición vieja | **sólo** ③ el selector |
| el recibo vuelve a ofrecerla sin mirar nada | ③ el recibo y ④ |

Cada sitio que decide tiene quien lo vigile, y el árbol queda idéntico después.

## 7 · 🔴 PROPUESTA DE MICROCOPY — se propone y SE PARA (regla 30 / A7)

**Este arreglo empeora un texto que ya estaba mal, y hay que decirlo.** `receipt.routes.ts:167` dice,
para un cobro pendiente:

    Estamos esperando tu pago. Puedes completarlo usando los botones de pago por banco
    o pago con tarjeta que aparecen más arriba.

Antes, para un merchant sin Connect y sin IBAN, esa frase nombraba **un** botón que no funcionaba.
Ahora no queda **ninguno**, así que manda a la clienta a buscar dos botones que no existen.

**No lo he tocado.** Las alternativas, con sus contras, para que el fundador elija y firme:

| # | propuesta | contra |
|---|---|---|
| **A** | Que la frase nombre sólo lo que se está pintando, variable según los botones disponibles. | El texto deja de ser un literal fijo: hay que firmar **tres** variantes (sólo banco, sólo tarjeta, ninguno), no una. |
| **B** | Una frase neutra que no nombre botones: «Estamos esperando tu pago.» y nada más. | Pierde la indicación de dónde pulsar para quien **sí** tiene botones, que era lo útil de la frase. |
| **C** | Frase neutra **+** una línea distinta cuando no hay ningún método, que diga cómo seguir. | Es la que más ayuda a esta clienta y la que **más texto nuevo necesita**: dos literales, no uno. |

⛔ **No he escrito ninguna de las tres en el producto.** Y la línea que haría falta para C —qué se le
dice a una clienta que no puede pagar por ninguna vía— **no la propongo yo**: es exactamente el tipo
de frase que decide el negocio, no el código.

## 8 · Lo que NO se ha hecho, y por qué

1. **② `admin.html` (`href="undefined"`) y ③ el microcopy: sin tocar.** Esperan decisión. Lo de §7
   es una propuesta parada, no un cambio.
2. **`viasDeCobro` no se toca** (ni `.tarjeta` ni `.transferencia`): decisión del fundador.
3. **No sé cuántos merchants reales están en este estado.** Producción tiene hoy 0 facturas y 0
   albaranes —medido por el fundador en consola—, así que hoy la respuesta es **cero**. Eso no lo
   hace menos urgente: lo hace **barato de arreglar ahora**.
4. **`/pay/mp` (Mercado Pago) sigue sin medirse.** Declarado como no medido, no como correcto.

## 9 · Ficheros

| fichero | qué |
|---|---|
| `src/modules/billing/domain/transferenciaDisponible.ts` | **nuevo**: la pregunta, una sola vez |
| `src/modules/billing/app/routes/payInvoice.routes.ts` | el selector deriva `hasTransfer` del dominio |
| `src/modules/billing/app/routes/receipt.routes.ts` | el botón de transferencia, condicionado |
| `tests/scrum910-la-transferencia-que-no-mira.test.mjs` | 5 casos: suelo, tabla de 12, dos puertas, el caso del ticket |
| `docs/master/evidencias/scrum910/censo-formas-de-pago.mjs` | el censo por comportamiento |
| `docs/master/evidencias/scrum910/rojos-910.mjs` | las tres mutaciones reales, con su discriminación |
| `src/modules/billing/app/routes/payBank.routes.ts` | **sin tocar — cero líneas de diff** |
| `src/modules/billing/domain/viasDeCobro.ts` | **sin tocar** — deuda declarada |

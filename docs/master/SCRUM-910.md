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

---

# SCRUM-910b · La decisión del criterio, y `admin.html` medido de verdad

**Medido contra:** `origin/main` = `765a15f1c6f1ed75736c25d2dd311bcfc43e303c` · 2026-09-17T15:24:27+01:00
**Rama:** `scrum-910b-la-nota-de-la-lista`

> ⛔ Ni una línea de `src/` · ningún texto en el producto · ninguna base consultada.
> Esta sección **sólo registra una decisión y corrige una medición**.

## 1 · DECIDIDO (17-sep-2026): en `viasDeCobro`, manda `payBank`

El criterio que manda es **el del que HACE, no el del que OFRECE**. Es la misma regla que ya
gobierna la tarjeta (`cardChargeMode` deriva de lo que hace la puerta de cobro) y que gobierna la
transferencia desde §6 (`transferenciaDisponible` replica lo que hace `payBank`).

La medición lo respalda: arreglar sólo el caso del IBAN habría dejado vivo el de la CLABE, porque
la condición se estaba copiando del código que ofrece en vez de derivarla del que cumple.

**Lo que NO cambia todavía:** las 15 discrepancias de `viasDeCobro.tarjeta` siguen como lista
cerrada en `tests/scrum893-solo-lo-que-puede-cobrar.test.mjs` ⑥. Lo decidido es **cuál gana**, no
cuándo se aplica. La nota del test dice ahora por qué se puede esperar — y con qué caduca.

## 2 · 🔴 TERCERA CORRECCIÓN a mi hallazgo de `admin.html`

Reporté que `admin.html` **pinta** `href="undefined"`. **Medido corriendo la ruta real: hoy no llega
a pintarlos.** Son dos defectos encadenados, y sólo el segundo es el que yo describí.

| # | dónde | qué pasa |
|---|---|---|
| **1** | `admin.html:917` manda `created.id` | `POST /quote/:token/accept` exige el **`decisionToken`** (SCRUM-95: «NUNCA el id autoincremental — era la sexta puerta de la misma fuga»). Y `POST /quote/create` devuelve `{id, number, status, total, currency}`: **el id, no el token**. → **HTTP 404**, `!acceptRes.ok`, `throw`, y la pantalla muestra «Error creando el presupuesto/cobro. Revisa la consola.» |
| **2** | la respuesta de `accept` | Devuelve `{ok, status, quote_id, accepted_at}` — **sin** `paycard_url`, `paybank_url` ni `charge_id`. Si se arreglara (1), **entonces** sí se pintarían los `undefined`. |

**Medido con control positivo**, y el control hizo su trabajo: la primera pasada dio 404 en los DOS
casos —incluido el que debía salir bien— porque mi token de ejemplo no era hexadecimal y
`parseToken` filtra a hex. Con un token válido: **id → 404 · token → 200**. Sin ese control, habría
reportado «el id da 404» sobre una sonda que daba 404 a todo.

    🔒 Un 404 que también le sale al caso bueno no prueba nada del caso malo.

**Y `public/dashboard/js/api.js:1398` define `acceptQuote(id, …)` con el mismo error de id-por-token
— pero NADIE la llama.** Código muerto, no una tercera víctima. Se declara para que quien lo lea no
lo cuente dos veces.

## 3 · Las dos opciones para `admin.html` — SIN elegir

| | **A · que la ruta devuelva los enlaces** | **B · que esos enlaces no se pinten** |
|---|---|---|
| **qué se hace** | `POST /quote/:token/accept` añade `charge_id`, `paybank_url` y `paycard_url` a su respuesta. Y `admin.html` pasa a mandar el `decisionToken`. | `admin.html` deja de pintar el bloque de enlaces. Sigue diciendo que el presupuesto se aceptó. |
| **arrastra** | Es **cambiar un contrato público**: `/quote/:token/accept` es la ruta que usa el **cliente final** desde la landing de decisión, no sólo esta pantalla. Añadir campos es compatible, pero pone **URLs de cobro en una respuesta que hoy no las lleva** — y esa respuesta la recibe el navegador de la clienta. | No toca ninguna ruta. Pero **quita de la pantalla de admin la única forma que tenía de obtener los enlaces de cobro tras aceptar**: quien la use tendría que ir a buscarlos a otro sitio. |
| **el defecto (1) sigue vivo?** | No: hay que arreglarlo para que A funcione. | **Sí.** B esconde el síntoma pero la pantalla seguiría dando 404 al aceptar. |
| **superficie** | ruta pública + una pantalla | una pantalla |
| **regla que roza** | La 22 y el criterio de SCRUM-95: los enlaces de cobro van por token opaco. Hay que comprobar que meterlos aquí no reabre la puerta que aquél cerró. | ninguna |

⚠️ **Lo que no sé y pesa en la decisión: quién usa `public/admin.html` hoy.** No he encontrado quién
la sirve ni una declaración de acceso para ella. Si no la usa nadie, B es gratis y A es trabajo
sobre una pantalla muerta; si la usa el fundador para dar de alta cobros a mano, es al revés. **Esa
respuesta no está en el repositorio.**

---

# SCRUM-910c · ① decidido (B) y aplicado — J2, traspaso de Luis

**Medido contra:** `origin/main` = `763d37e5225ea4897827b1a997e34cf5e117c5c3` · 2026-09-22T22:24:27Z
**Rama:** `scrum-910-admin-enlaces-undefined`
**Carril:** J2 (Clientes y cobro) — ticket asignado por Luis fuera de tabla, Jira SCRUM-910 comentario 16278 (21-sep-2026) y confirmado por el orquestador de J en el comentario 16420 (22-sep-2026).

## 0 · Quién decide y con qué dato nuevo

**DECIDIDO: opción B** (`admin.html` deja de pintar el bloque de enlaces). Lo decide Luis en el
comentario 16278, y esta sesión lo re-verificó antes de tocar nada, en vez de darlo por bueno:
**0 referencias a `admin.html`** en `src/` ni en `public/` (grep propio, hoy — no solo la medición
de Luis del 21-sep). Sigue sin saberse **quién usa la página** fuera del repositorio (§3 de arriba
lo declaraba como el dato que faltaba); lo que cambia es que la pregunta relevante para B —¿algo
del código la referencia?— ya tiene 0 como respuesta medida dos veces, por dos sesiones distintas.

**No arregla el defecto (1)** (el 404 por mandar `created.id` donde se espera `decisionToken`,
comentario 15795). Sigue vivo, sigue documentado ahí y en §3 de este expediente. No es un hallazgo
nuevo — no se abre ticket aparte — y no tiene víctima medida (0 referencias a la página). Queda
declarado, no arreglado: si algún día se usa `admin.html` para algo, el botón «Aceptar» seguirá
dando el error de consola de siempre, ya no seguido de enlaces `undefined`.

## 1 · El arreglo

`public/admin.html`: se retira el bloque `.link-list` (los dos `<a href="${accepted.paybank_url}">`
/ `${accepted.paycard_url}`) y su CSS asociado (única consumidora), y se quita `accepted.charge_id`
del mensaje de estado — ninguno de los tres campos existe en la respuesta real de
`POST /quote/:token/accept` (`quotes.routes.ts:373-378`: `{ok, status, quote_id, accepted_at}`).
`accepted.quote_id` y `accepted.status`, que sí existen, se quedan. Cero líneas tocadas fuera de
`admin.html`. 43 líneas de diff, 2 inserciones + 41 borrados.

## 2 · Rojo primero

`tests/scrum910-admin-sin-enlaces-undefined.test.mjs`: lee `admin.html` como texto (vanilla, sin
runtime que montar) y falla si aparece `accepted.paybank_url` / `accepted.paycard_url` /
`accepted.charge_id`, con control positivo de que `accepted.quote_id` y `accepted.status` —que SÍ
existen— se siguen usando (guarda del detector, SCRUM-113: sin el positivo, un fichero vaciado de
más también pasaría).

Corrido contra el árbol SIN tocar → rojo por el motivo esperado (`accepted.paybank_url` presente).
Aplicado el arreglo → verde. `npm run guards:entrada` 112/112 · `npm run guard:marcadores-en-pantalla`
verde (27 vistas × 3 estados, control negativo corrido). `npm test` completo: ver informe de entrega.

## 3 · Ficheros

| fichero | qué |
|---|---|
| `public/admin.html` | retirado el bloque de enlaces rotos y su CSS |
| `tests/scrum910-admin-sin-enlaces-undefined.test.mjs` | nuevo — rojo primero + control positivo |

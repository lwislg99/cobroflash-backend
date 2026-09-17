# SCRUM-893 · La clienta no puede pagar: se le ofrecía la única vía que ese negocio no podía cobrar

**Medido contra:** `origin/main` = `76c786f60721e0caeb7eac056b5f65863abb6b6b` · 2026-09-17T10:44:42+01:00
**Rama:** `scrum-893-solo-lo-que-puede-cobrar`
**Carril:** cobro · superficie del cliente final · **Gate:** sin gate, corre en `npm test`

> ⛔ `prisma/schema.prisma` intacto · sin estado ni flag nuevos (27) · sin dependencias (36)
> ⛔ **Ningún pago procesado en la cuenta de plataforma.** El camino del cobro no se toca: sólo
> cambia **qué se OFRECE**. `payCard.routes.ts` conserva **cero líneas de diff**, y está verificado.
> ⛔ **Ningún texto nuevo.** El único literal que este arreglo vuelve alcanzable ya existía,
> escrito para ese caso exacto. Hay **una propuesta de microcopy parada**, en §6.
> ⛔ Ninguna base consultada. Ninguna credencial. Staging no se ha tocado.

---

## 1 · PASO 0 — el defecto existe HOY, y se midió CORRIENDO

No leyendo: levantando la ruta real `/pay/invoice/:token` contra un doble de `prisma`
(`dist/` es CommonJS, así que el doble entra por `require.cache`). Cinco casos, con su población
declarada, **antes de tocar una línea**:

| caso | tarjeta | bizum | transferencia | primero | chip RECOMENDADO |
|---|---|---|---|---|---|
| A · sin Connect, CON IBAN *(el de staging)* | **sí** | no | sí | Pagar con tarjeta | **sí** |
| B · sin Connect, SIN IBAN, sin teléfono | **sí** | no | no | Pagar con tarjeta | no |
| C · **CON Connect activo** *(control positivo)* | sí | no | no | Pagar con tarjeta | no |
| D · merchant DEMO (id=1) | sí | no | no | Pagar con tarjeta | no |
| E · sin Connect, CON IBAN, 900 € | **sí** | no | sí | Pagar con tarjeta | **sí** |

El caso A reproduce exactamente lo medido en staging (SCRUM-882b b2). El caso B es peor: la tarjeta
era **la única opción**, y no funcionaba.

🔴 **Y el dato está en la columna, no en las filas: los CINCO dan `tarjeta=sí`, incluido el control
positivo.** Un instrumento cuyas ramas responden todas igual no está midiendo. Aquí el que no medía
era el producto.

## 2 · Las dos preguntas del PASO 0

### a) ¿Qué interruptor decide Bizum?

No es uno, son cuatro condiciones en `payInvoice.routes.ts`, y las siete mitades están medidas
**corriendo la ruta real**:

| # | caso | ¿ofrece Bizum? |
|---|---|---|
| 1 | flag OFF (su valor por defecto) + teléfono | no |
| 2 | flag ON por env + `bizumPhone` | **sí** |
| 3 | flag ON + **sin** teléfono | no |
| 4 | flag ON + sólo `whatsappPhone` | **sí** *(cae al de WhatsApp)* |
| 5 | flag ON + teléfono + importe 1.500 € | no *(techo de 1.000 €, W4)* |
| 6 | flag ON **por `merchant.flags`**, sin env | **sí** *(precedencia merchant > env)* |
| 7 | flag ON + teléfono, pero `payMethods=['card']` | no *(el PRO limitó el cobro)* |

El interruptor es **`BIZUM_MANUAL_ENABLED`** (tabla P, default `false`), y hay un segundo,
`BIZUM_AUTO_ENABLED`, para el Bizum automático por Stripe (también `false`).

⚠️ **Su valor EFECTIVO en staging no lo puedo dar, y no lo invento.** El valor sale de
`merchants.flags` (por merchant) o de la variable de Railway; leer cualquiera de las dos exige
tocar staging o sus credenciales, que esta sesión tiene prohibido. Lo que sí está medido:
`.env` del árbol **no declara** ninguna de las dos variables, y el default de la tabla es `false`.
El registro previo del repositorio —`docs/master/SCRUM-328.md`, 12-ago-2026— dice «ningún flag
encendido, en ningún entorno y por ningún medio». **Eso es un registro fechado, no una medición de
hoy**, y la diferencia importa: no sé si alguien lo encendió después.

### b) ¿Cómo sabía la página si ese merchant tiene Connect? ¿Lo consultaba o lo suponía?

**Lo SUPONÍA.** Literal, en `payInvoice.routes.ts`:

```ts
const connectFlag = isFlagEnabled('PAYMENTS_CONNECT_ENABLED', { merchant: m });
const hasCard = !connectFlag ? true : (m?.connectStatus === 'active' || isDemoMerchant(m));
```

`PAYMENTS_CONNECT_ENABLED` está **OFF por defecto** (tabla P, «OFF hasta CONNECT-1»), así que la
primera rama ganaba siempre y `connectStatus` **no se leía nunca**. La condición que parecía
gobernar el caso sólo existía para el día en que el flag se encendiera.

Y el comentario de `cardCharge.ts` (SCRUM-130) llevaba desde entonces afirmando lo contrario —
«sin Connect… sólo lo tapaba el selector de la UI (no ofrecía tarjeta)». No lo tapaba. Un
comentario que describe una intención no es una medición de lo que hace el código.

## 3 · El censo: no era una página, eran TRES (y una cuarta que no se toca)

Población barrida: **1.557 ficheros** (285 `src/` · 104 `public/` · 978 `tests/` · 190 `scripts/`).
Control positivo: el instrumento encuentra el productor conocido, `charges.routes.ts:80`.

| # | superficie | condición para ofrecer tarjeta | ¿miraba Connect? |
|---|---|---|---|
| 1 | `payInvoice.routes.ts:110` · el selector | `!flag ? true : (active \|\| demo)` | **lo suponía** |
| 2 | `receipt.routes.ts:104` · `/recibo/:token` | `ch.status === 'pending'` | **no, nunca** |
| 3 | `customerPortal.routes.ts:359` · portal | `inv.status === 'pending' && payToken` | **no, nunca** |
| 4 | `charges.routes.ts:80` · API `POST /charges` | devuelve `paycard_url` siempre | **no** — ver §6 |

Las tres primeras llevan al **mismo 409**. Arreglar sólo la primera habría cerrado la puerta que
estábamos mirando y dejado las otras dos abiertas, con el defecto dado por resuelto:

> Un arreglo parcial de un defecto con tres puertas no reduce el defecto. Reduce su visibilidad.

## 4 · El arreglo · la misma pregunta para ofrecer que para cobrar

**El bucle no lo causó un criterio mal escrito: lo causó que hubiera dos.** `cardChargeMode(merchant)`
entra en `src/modules/billing/domain/cardCharge.ts`, junto al `cardChargeDecision` que la puerta de
cobro ya usaba, y devuelve el **modo completo** (`connect` / `demo_platform` / `refuse`), no un
booleano: un `puedeCobrarConTarjeta` sería un tercer criterio derivado, y un tercer criterio es cómo
vuelve el defecto dentro de seis meses. Quien ofrece pregunta `!== 'refuse'`.

Las tres páginas pasan a preguntar lo mismo. El portal necesitó además **tres columnas más en su
`select`** (`connectStatus`, `stripeAccountId`, `flags`): sin ellas la pregunta no se podía hacer, y
por eso su botón se pintaba sin mirar nada. Es lectura, no esquema.

### ⚠️ Lo que este arreglo NO consigue, declarado

`payCard.routes.ts` **sigue calculando su `useConnect` con esta misma expresión escrita a mano**.
Unificarlo era tocar el camino del cobro, acotado por decisión del fundador (17-sep-2026), así que
esa ruta conserva **cero líneas de diff**. La duplicación queda. Lo que cambia es que ya **no puede
crecer en silencio**: la tabla de verdad de §5 compara las 32 combinaciones contra la puerta
**ejecutada**, y cae el día que diverjan, nombrando cuál.

    🔒 Lo que no se puede unir, que al menos no pueda separarse sin avisar.

Es deuda **conocida**, no escondida. La diferencia es que ésta tiene quien la vigile.

## 5 · Los controles, ejecutados

### ② La tabla de verdad · 32 combinaciones

Las entradas que deciden la tarjeta son **cuatro**: flag (2) × `connectStatus` (4 valores reales:
`none`/`pending`/`active`/`restricted`) × `stripeAccountId` (2) × demo (2) = **32**, todas
construibles, ninguna declarada imposible.

**IBAN y Bizum no están en esta tabla y no es un olvido**: la puerta de cobro no los lee. Meterlos
multiplicaría por cuatro casos idénticos sin discriminar nada. Donde sí cuentan es en ④ y ⑤, que
miran la página entera.

🔴 **La puerta se EJECUTA, no se lee.** Para cada combinación se levanta `GET /pay/card/:token` con
dobles de `prisma` y de Stripe, y se observa qué hace: 409 → `refuse`; 303 con `stripeAccount` →
`connect`; 303 sin él → `demo_platform`. Leer su fuente habría medido el texto; esto mide el
comportamiento, y sin tocar el fichero. El flag va por `merchant.flags`, no por `process.env`: una
tabla que depende del entorno mide el entorno.

### ③ Control positivo · el comparador, roto a propósito

Se muta `cardChargeMode` **en una sola combinación** (merchant real, sin Connect, flag ON: la puerta
dice `refuse`, el mutante dirá `connect` — el defecto del ticket en pequeño). Exigido: que caiga
**exactamente 1**, y que el veredicto **nombre la combinación** y diga qué ofrecía y qué hacía la
puerta. Un «no coinciden» sobre 32 casos no sirve a las tres de la mañana. Y la otra mitad: con el
criterio sano, cero.

### ④ Los TRES ROJOS, inyectados de verdad en `src/`

`docs/master/evidencias/scrum893/rojos-893.mjs` — una mutación cada vez, con línea base a cero:

| mutación | casos que caen | casos AJENOS de ④ |
|---|---|---|
| `payInvoice` · el selector | ④ selector **y** ⑤ | **0** |
| `receipt` · el recibo | ④ recibo | **0** |
| `customerPortal` · el portal | ④ portal | **0** |

Cada una tumba **lo suyo y sólo lo suyo**, y el árbol queda idéntico (`sha256` por fichero y
`git status` comparado con el de antes). **Eso es lo que prueba que los tres verdes no son el mismo
verde tres veces.**

### 🔴 Y el banco me mintió primero — dos veces, por la misma causa

La primera pasada dio **«0 casos caen» en las tres mutaciones**, que leído deprisa es «el banco no
discrimina». No lo era: el instrumento imprimía `¿compila? no` y el banco estaba corriendo contra
un `dist/` **viejo**, el sano. Un verde prestado.

Lo peor vino después: **le atribuí una causa plausible y falsa** — «al mutar, el import queda sin
usar y `tsc` falla». Suena bien y es mentira: comprobado a mano, esa mutación compila. La causa real
era que `execFileSync('npm', …)` en Windows no encuentra `npm.cmd` sin `shell: true`, así que **el
build no llegaba a ejecutarse nunca**. Estuve a punto de reescribir una mutación que estaba bien.

    🔒 Un build roto no es un rojo: es un verde que no vale.
    🔒 La causa plausible que no se comprueba es la que te hace arreglar lo que no estaba roto.

El instrumento ahora llama a `tsc` directo y **aborta declarando CIEGO** si el build falla, en vez de
seguir y contar un cero.

### ⑤ El tercer caso: sin Connect y SIN IBAN

Este camino era **inalcanzable**: como `hasCard` valía `true` para todos, la lista nunca quedaba
vacía. El arreglo lo vuelve alcanzable, así que pasa a ser el mensaje real de un negocio sin Connect
y sin IBAN. **No se ha inventado texto** (regla 30): el literal ya existía en `payInvoice.routes.ts`
escrito para ese caso. El test fija que el camino existe, que se sigue viendo el importe y que la
página no se queda muda. **Que ese mensaje sea el adecuado es decisión del fundador**, y va en §6.

## 6 · Hallazgos — se reportan, no se arreglan

**① `public/admin.html` pinta `undefined` en los enlaces de cobro.** Lee `accepted.paycard_url`,
`accepted.paybank_url` y `accepted.charge_id` de la respuesta de `POST /quote/:id/accept`
([quotes.routes.ts:364](../../src/modules/quotes/app/routes/quotes.routes.ts#L364)), que devuelve
`{ok, status, quote_id, accepted_at}` y **ninguno de los tres**. Resultado: «Abrir link» con
`href="undefined"`, un `<code>undefined</code>` y «cargo #undefined». Otro carril.

**② PROPUESTA DE MICROCOPY, PARADA.** `receipt.routes.ts:167` dice, para un cobro pendiente:
«Puedes completarlo usando los botones de **pago por banco** o **pago con tarjeta** que aparecen más
arriba». Con este arreglo, un merchant sin Connect ya no pinta el de tarjeta, así que **ese texto
manda a la clienta a un botón que no existe**. No lo he tocado: es microcopy y lo firma el fundador
(reglas 30 y 39). Se propone y se para.

**③ En `/recibo/:token`, «Pagar por transferencia» tampoco mira si hay IBAN.** Es el mismo defecto
de este ticket por la otra vía, y es **preexistente**: el botón se pinta con `status === 'pending'`
y nada más. No entra aquí porque el encargo acota la tarjeta.

**Nota (fuera del tope de 3, no es ticket todavía):** si Stripe no está configurado en el servidor,
`/pay/card` devuelve **501** — y esa página **no lleva enlace de vuelta**, al contrario que el 409.
No es estado del merchant sino del servidor, y en producción Stripe está configurado.

## 7 · La API `POST /charges` · medida, no tocada

Lo pedido: quién la consume. **Población: 1.557 ficheros.**

- Va detrás de `requireInternalSecret` ([app.ts:351](../../src/app.ts#L351)) — es **interna**, y
  `app.ts:322` declara que la llama CI.
- **Consumidores de su respuesta dentro del repositorio: CERO.** Nadie en `src/`, `public/`,
  `tests/` ni `scripts/` hace `POST /charges`.
- El único sitio que **nombra** `paycard_url` fuera del productor es `public/admin.html`, y lo lee
  de otro endpoint que no lo devuelve (hallazgo ①).

**Ese cero NO autoriza a tocarla**, y es la razón de que no se haya tocado: significa que el
consumidor está **fuera de este repositorio**, donde no sé buscar. Cambiar lo que devuelve es
cambiar un contrato a ciegas.

## 8 · La tanda, y los dos intermitentes que NO son míos

**`7253 tests · 7142 pass · 1 fail · 110 skipped`** (primera) y **`7253 · 7141 · 2 fail · 110`**
(segunda). Ninguna limpia, y ninguno de los fallos es de esta rama. Lo que lo demuestra no es mi
opinión, son **fallos DISJUNTOS**:

| | tanda 1 | tanda 2 | aislado | ¿toca algo mío? |
|---|---|---|---|---|
| `scrum451-plazo-de-red` | **cae** | pasa | 12/12 ✅ | no |
| `scrum804-la-rama-viva` (2 casos) | pasa | **cae** | 9/9 ✅ | no |
| los 7 casos de SCRUM-893 | **7 ✔** | **7 ✔** | 7/7 ✅ | — |

Una regresión real cae en las dos. Estas se turnan, y cada una declara su propio SUELO en vez de
dar un verde falso: `451` dice «las cabeceras tenían que haber llegado, o esto no prueba lo del
cuerpo» (timing bajo carga) y `804` dice «el censo cuenta 148 ramas y `for-each-ref` 149» — refs
moviéndose bajo los ~26 worktrees que comparten este `.git` mientras la tanda corre.

🔴 **Y la pregunta incómoda, medida en vez de esquivada:** mi banco levanta ~40 servidores HTTP
efímeros, así que podría ser yo quien añade la carga que tumba a `451`. Control: los tres ficheros
juntos, dos pasadas → **28 pass · 0 fail** las dos veces. No interfiero. Además `804` ya caía en la
rama `scrum-864b`, que no lleva una línea de este ticket.

## 9 · Ficheros

| fichero | qué |
|---|---|
| `src/modules/billing/domain/cardCharge.ts` | **+`cardChargeMode(merchant)`**: la pregunta, una sola vez |
| `src/modules/billing/app/routes/payInvoice.routes.ts` | el selector deriva `hasCard` del dominio |
| `src/modules/billing/app/routes/receipt.routes.ts` | el botón de tarjeta, condicionado |
| `src/modules/system/app/routes/customerPortal.routes.ts` | botón condicionado + 3 columnas al `select` |
| `tests/scrum893-solo-lo-que-puede-cobrar.test.mjs` | 7 casos: suelo, tabla de 32, control positivo, 3 páginas, tercer caso |
| `docs/master/evidencias/scrum893/rojos-893.mjs` | las tres mutaciones reales sobre `src/`, con su discriminación |
| `src/modules/billing/app/routes/payCard.routes.ts` | **sin tocar — cero líneas de diff** |

### 🔴 Y «cero líneas de diff» casi lo afirmo con la sonda equivocada

Al verificarlo, dos sondas se contradijeron: `git diff origin/main -- payCard.routes.ts` daba **0
bytes**, pero el `sha256` del fichero **no coincidía** con el de `origin/main`. La discrepancia era
el dato, y la causa está medida, no supuesta:

| | bytes | bytes CR (`0x0D`) |
|---|---|---|
| el fichero **en disco** | 6.988 | **137** |
| la versión **en git** | 6.851 | 0 |

**6.988 − 6.851 = 137**, exactamente los CR del checkout de Windows. El contenido es idéntico; lo
que difería era el final de línea del árbol de trabajo. La sonda válida para «qué lleva este PR» es
`git diff` / `git status` —vacías las dos—, no un `sha256` sobre el disco, que mide el checkout y no
el commit. Un `sha256` que no cuadra da un susto legítimo; darlo por bueno en cualquiera de los dos
sentidos sin medir habría sido el error.

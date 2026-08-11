# SCRUM-473 · El censo de escritores de `Charge.method` y el validador de la FORMA

> **Esto documenta trabajo AJENO.** Describe el commit **`ef067bbc`** («SCRUM-474/473: Charge.method
> hacia dos trabajos — se cortan las fugas y se valida la FORMA»), de **Luis**, del **11-ago-2026
> 19:52:42 +0200**, **leído y remedido por la sesión 3 el 11-ago-2026**. No lo firmo, no lo juzgo:
> lo describo, lo verifico y digo dónde mi medida no coincide con la suya.
>
> El commit existía solo en su propio mensaje y en comentarios de código. Este fichero es para que
> el censo se pueda **auditar y encontrar**.

**Medido contra:** `origin/main` = `dd5416f04ed1b8d80a403a9525fab33437fe8b03` · 2026-08-11T21:10:34+01:00
**Rama de lectura:** `scrum-473-documentar-lo-mergeado`
**En main desde:** `e33e9506` (merge del PR #703, rama `scrum-474-metodo-un-solo-trabajo`, ya borrada
de `origin`). `git merge-base --is-ancestor ef067bbc main` → **sí**.

---

## 1. Qué hay en main, fichero a fichero

`ef067bbc` toca 5 ficheros, +236/−3:

| fichero | qué hace |
|---|---|
| `src/modules/billing/domain/metodoDeCobro.ts` | **nuevo**, 100 líneas. `partirMetodo`, `esMetodoValido`, `metodoParaAgrupar`, `metodoDesdeMercadoPago`, `METODO_DESCONOCIDO`. |
| `src/modules/billing/app/routes/psp.routes.ts` | `:110` — `method: body.method ?? charge.method` pasa a `method: esMetodoValido(body.method) ? body.method : charge.method`. |
| `src/modules/billing/app/routes/charges.routes.ts` | `:39` — el caso por defecto del ternario pasa de `'bank'` a `'transfer'`. |
| `src/integrations/mercadopago.ts` | `:89` — `method: data.payment_type_id ?? 'mp'` pasa a `method: metodoDesdeMercadoPago(data.payment_type_id)`. |
| `tests/scrum473-metodo-validado.test.mjs` | **nuevo**, 117 líneas, 5 tests. |

### La FORMA que instala

`<metodo>` ó `<metodo>:<pasarela>`, con `<metodo>` obligatoriamente en `PAID_VIA`
(`src/modules/billing/domain/paidVia.ts:23` = `['card','bizum_auto','bizum_manual','transfer','cash']`).
Así `card:stripe` pasa —`card` está en el conjunto— sin destruir la pasarela, que hoy solo vive en
esa etiqueta. `esMetodoValido` **importa** `PAID_VIA`, no la copia, y
`tests/scrum473-metodo-validado.test.mjs:24-37` lo sostiene.

---

## 2. El censo, con DOS instrumentos, y qué encontró cada uno POR SEPARADO

**Alcance declarado:** `src/**/*.ts`. Lo de `scripts/` va aparte, en §5.

### Instrumento A — AST (API del compilador de TypeScript)

Recorre cada `.ts` de `src/`, localiza las llamadas `<algo>.charge.<create|update|updateMany|upsert|createMany>(…)`
y busca toda propiedad `method` —normal o *shorthand*— que cuelgue del `data`, **a cualquier
profundidad**. Se corrió además una variante que solo mira las propiedades **directas** de `data`.

**Encontró 3, y las mismas en las dos variantes:**

```
src/modules/billing/app/routes/charges.routes.ts:48   [charge.create]  method (shorthand)
src/modules/billing/app/routes/mpWebhook.routes.ts:107 [charge.update]  method: 'mp'
src/modules/billing/app/routes/psp.routes.ts:110      [charge.update]  method: esMetodoValido(body.method) ? body.method : charge.method
```

Corrido también contra `ef067bbc^` (el árbol **antes** del arreglo): **3, las mismas**, con
`charges.routes.ts:46` y `psp.routes.ts:101 · method: body.method ?? charge.method`.

### Instrumento B — textual, sin *parser*

Red ancha a propósito sobre todo `src/`, en tres barridos: (B.1) cualquier clave o variable llamada
exactamente `method` que se asigne; (B.2) los emisores del webhook interno `/webhooks/psp`; (B.3)
SQL crudo que pudiera escribir la columna por detrás del cliente.

**Encontró:** B.1 → **230** coincidencias (con falsos positivos a mansalva: `<form method="post">`,
`ADMIN_ONLY_ROUTES`, `payment_method_types`…, que es el precio de no saber de estructura).
B.2 → **10 `axios.post` reales** a `/webhooks/psp`, de los cuales **7 llevan clave `method`**.
B.3 → **9 coincidencias, ninguna escribe `Charge`**: ocho son `pg_advisory_xact_lock` y una es el
`SELECT 1` de *health*. **No hay escritor por SQL crudo.**

### El censo consolidado: **DIEZ**

**Escrituras directas de la columna** (las que ve el instrumento A):

| # | sitio | valor que escribe |
|---|---|---|
| 1 | `charges.routes.ts:48` (`create`, *shorthand*; el valor se calcula en `:39`) | `'card'` · **`'mp'`** · `'transfer'` |
| 2 | `mpWebhook.routes.ts:107` (`update`) | **`'mp'`** literal |
| 3 | `psp.routes.ts:110` (`update`) | `body.method` si pasa `esMetodoValido`; si no, conserva el que había |

**Emisores de `body.method` hacia `/webhooks/psp`**, que acaban escribiendo por el nº 3 (los que ve
el instrumento B y el A no puede ver):

| # | sitio | valor que manda |
|---|---|---|
| 4 | `receipt.routes.ts:56` | `'card:stripe'` |
| 5 | `stripe.routes.ts:60` (`checkout.session.completed`) | `'card:stripe'` |
| 6 | `stripe.routes.ts:92` (`payment_intent.payment_failed`) | `'card:stripe'` |
| 7 | `stripe.routes.ts:151` (`checkout.session.expired`) | `'card:stripe'` |
| 8 | `chargesAdmin.routes.ts:51` (confirmar Bizum a mano) | `'bizum_manual'` |
| 9 | `connectWebhook.routes.ts:96` | `paidViaDesdeStripe(...)`, o se **omite** la clave si no se resuelve |
| 10 | `dev.routes.ts:26` (`/dev/sim/pay/:id`) | **`'SCTinst'`** — solo montado si `NODE_ENV !== 'production'` (`app.ts:300`) |

### 🔴 Dónde mi medida NO coincide con la del commit

Son tres cosas distintas, y conviene no mezclarlas.

**(i) «El AST solo veía DOS».** El mío ve **tres**, y las ve igual antes y después del commit. No
puedo reproducir el 2.

**(ii) «Los otros siete escriben dentro de objetos anidados».** Esto **no se sostiene con mi
medida**: las variantes profunda y superficial del instrumento A dan **exactamente el mismo
resultado**, así que el anidamiento no está ocultando nada. Lo que hace invisibles a seis de ellos
para *cualquier* consulta AST con forma de Prisma es otra cosa, y es más grave: **no tocan Prisma**.
Salen por HTTP a `/webhooks/psp` y entran por el escritor nº 3. Un AST de Prisma no puede verlos por
mucho que profundice — hay un salto de proceso por medio.

> **La conclusión del commit sobrevive intacta: con un instrumento no bastaba.** Lo que no se
> sostiene es el motivo que dio. Y la diferencia importa, porque quien lea «anidamiento» irá a
> arreglar su AST, y el AST no tenía arreglo posible.

**(iii) `mercadopago.ts:89` no escribe la columna.** El commit lo cuenta como el noveno escritor y
como «el de MÁS fuga». Lo que mide mi lectura: `getMpPayment()` devuelve un DTO con campo `method`;
su **único** llamante es `mpWebhook.routes.ts:76`, que lo mete con *spread* en el `payload` del
evento (`datosDeCobroPagado(fecha, payload)` → `Event.payload`, `instanteDeCobro.ts:67-73`) y acto
seguido escribe la columna con **`method: 'mp'` a fuego** en `:107`. `payment.method` no lo lee
nadie: `grep` de `.method` en `mpWebhook.routes.ts` devuelve cero.

El arreglo de `mercadopago.ts` **no es inútil** —limpia el `method` que va al `Event.payload`, que
es rastro de auditoría—, pero no toca `Charge.method`. Y **la fuga que se le atribuye sigue abierta
un piso más arriba**: mientras `mpWebhook:107` escriba `'mp'` literal, traducir bien en MercadoPago
no cambia el valor que se guarda.

**Cuadre:** el commit dice nueve (7 ficheros: `charges`, `receipt`, `stripe`×3, `mpWebhook`, `psp`,
`chargesAdmin`, `mercadopago`). Yo digo diez. **Coincidimos en ocho.** Él suma `mercadopago.ts`, que
no escribe la columna; a él le faltan `connectWebhook.routes.ts:96` y `dev.routes.ts:26`.

**Suelo:** el mío da diez, por encima del nueve exigido. Si alguien lo remide y le salen menos,
el ciego es él.

---

## 3. 🔴 Hallazgo (a): CONFIRMADO — `charges.routes.ts:39` escribe `'mp'`

```ts
// src/modules/billing/app/routes/charges.routes.ts
36:  const methodPref = body.method_preference;
37:  // SCRUM-474 · «bank» NO está en PAID_VIA y era el caso POR DEFECTO: todo lo que no fuera
38:  // tarjeta ni MercadoPago caía ahí. El valor del conjunto cerrado para eso es «transfer».
39:  const method = methodPref === 'card' ? 'card' : methodPref === 'mp' ? 'mp' : 'transfer';
...
41:  const charge = await prisma.charge.create({
42:    data: {
48:      method,
```

Las tres preguntas, con la línea delante:

1. **¿`'mp'` está en `PAID_VIA`?** No. `paidVia.ts:23` = `['card','bizum_auto','bizum_manual','transfer','cash']`.
2. **¿El propio test mergeado asserta que es inválido?** Sí, `tests/scrum473-metodo-validado.test.mjs:69`:
   `assert.equal(esMetodoValido('mp'), false, '🔴 «mp» no está en PAID_VIA y pasa.')`.
3. **¿Escribe directo a `prisma.charge.create` saltándose el validador?** Sí. `charges.routes.ts`
   **no importa nada de `metodoDeCobro`** —sus siete `import` son `express`, `prisma`,
   `CreateChargeSchema`, `utils`, `BASE_URL` y `ensureChargeReceiptToken`— y escribe la columna en
   `:48` sin pasar por `esMetodoValido`.
4. **¿El commit arregló `bank → transfer` en esa misma línea y dejó `mp`?** **Sí, en la misma línea
   y en el mismo ternario.** El diff de `ef067bbc` cambia `: 'bank'` por `: 'transfer'` y deja
   intacto el `methodPref === 'mp' ? 'mp'` que está tres tokens antes.

**Alcanzabilidad:** `'mp'` no es texto muerto. `CreateChargeSchema` lo **admite explícitamente**:
`schemas.ts:112` → `method_preference: z.enum(['bank','card','mp']).optional().default('bank')`. La
ruta está tras `requireInternalSecret` (`app.ts:280`) y el único llamante del árbol manda `'card'`
(`invoiceWhatsApp.service.ts:67`), así que hoy no se ejerce — que es exactamente la categoría que el
propio commit definió: *«`mp` y `bank` no aparecen en los datos y sí en el árbol»*. La mitad de esa
frase se arregló; la otra mitad quedó escrita en el comentario de la línea que la incumple.

> **Consecuencia:** el guard de `psp.routes.ts:110` es real para el camino del webhook, pero la
> creación del cobro entra por otra puerta y esa puerta no tiene validador.

**NO SE ARREGLA AQUÍ.** Es un carril del fundador (dos columnas), y esta sesión lee.

---

## 4. 🔴 Hallazgo (b): CONFIRMADO — `metodoParaAgrupar` no tiene llamantes, y el lado lector NO está cableado

`grep` sobre `src/ public/ tests/ scripts/ docs/` de `metodoParaAgrupar` devuelve **6 líneas, y
ninguna es un llamante de producto**:

```
src/modules/billing/domain/metodoDeCobro.ts:72   ← su propia definición
tests/scrum473-metodo-validado.test.mjs:17,89,90,92,96   ← el import del test y sus 4 asserts
```

**Cero llamantes en `src/`. Cero en `public/`.** La función está exportada, probada, y muerta.

El mensaje del commit afirma: *«los lectores normalizan al leer (`metodoParaAgrupar`), así que `card`
y `card:stripe` caen en el mismo cubo. Son 38 de 51 cobros hoy repartidos en dos.»`*

**Ese lado NO está cableado en main.** Lo que hay en main es la función y su test unitario. La frase
describe un efecto sobre lo que el profesional ve, y en main ese efecto no ocurre: el filtro de la
pantalla de Cobros (`public/dashboard/js/cobrosView.js:105-110`, `cuboDeMetodo`) sigue comparando el
valor **entero** contra `COBROS_METODOS[i].casa`, así que `card:stripe` sigue cayendo en «Método no
registrado».

El arreglo del lector existe, pero **está en una rama sin mergear** — ver `docs/master/SCRUM-474.md`.

---

## 5. Huecos que la lectura ha dejado a la vista (regla 9: se reportan, no se arreglan)

1. **`charges.routes.ts:39` escribe `'mp'`** sin validador. §3.
2. **`mpWebhook.routes.ts:107` escribe `'mp'` literal** sin validador. Es el hermano del anterior y
   el que deja sin efecto, sobre la columna, el arreglo de `mercadopago.ts`.
3. **`dev.routes.ts:26` manda `method: 'SCTinst'`**, que no está en `PAID_VIA` ni cumple la forma.
   Hoy lo para el guard nuevo (`esMetodoValido('SCTinst')` → `false` → se conserva el método
   anterior), pero eso significa que **la simulación de pago de `/dev` ya no escribe el método que
   dice escribir**. Solo afecta a entornos con `NODE_ENV !== 'production'`.
4. **`METODO_DESCONOCIDO = 'desconocido'` no está en `PAID_VIA`**, así que
   `esMetodoValido(metodoDesdeMercadoPago('lo-que-sea'))` es `false`. Es coherente con el diseño
   —lo desconocido se declara— pero conviene que conste: hay un valor que el propio módulo produce y
   su propio validador rechaza. El test lo comprueba solo para los tres tipos que sí traducen
   (`:109-112`), no para el caso `desconocido`.
5. **Dos comentarios quedaron desfasados por este mismo commit**:
   `connectWebhook.routes.ts:85` y `:121-122` siguen citando `body.method ?? charge.method` como el
   código de `/webhooks/psp`. Esa expresión ya no existe; ahora es
   `esMetodoValido(body.method) ? body.method : charge.method`. El comportamiento que describen
   (omitir → se conserva) sigue siendo cierto; la cita literal, no.
6. **Escritores fuera de `src/`, que ningún censo de los dos cubrió** —los añado porque uno de ellos
   toca directamente una afirmación del commit—:
   - `scripts/seed-demo.mjs:290` (variable, valores `'card'`/`'bizum_manual'`/`'transfer'` desde
     `:337-343`) y `:356` (`'card'`). Todos válidos.
   - `scripts/e2e-critico.mjs:209` → `'card'` vía `/webhooks/psp`. Válido.
   - 🔴 **`scripts/seed-video.mjs:480-488`** → `const method = (i % 2 === 0) ? 'bizum' : 'transfer';`
     seguido de `tx.charge.create({ data: { … method … } })`. **Escribe `bizum` a secas, con
     `prisma`, sin pasar por `psp.routes.ts`.**

### 🔴 Sobre la atribución de los 6 cobros con `bizum` a secas

El commit afirma que `psp.routes.ts` era *«el único de los nueve capaz de meter un valor arbitrario,
y el único que explica los 6 cobros con `bizum` a secas que ningún camino vivo escribe»*.

Lo que puedo medir: **hay un segundo escritor de ese valor exacto en el árbol**, `seed-video.mjs:480`,
y el commit no lo considera. Lo que **no** puedo medir desde aquí: cuál de los dos produjo esas 6
filas — no tengo ni voy a tocar la base de producción. Así que el enunciado correcto es *«hay al
menos dos orígenes posibles y el commit descartó uno sin nombrarlo»*, no *«la atribución es falsa»*.

Cerrar la puerta de `psp.routes.ts` estaba bien igual: era una puerta abierta con o sin esos 6 cobros.

---

## 6. Cómo se remide esto

Los dos instrumentos son de esta sesión y **viven en el *scratchpad*, no en la suite**: son una
medición, no un guard. El guard de este trabajo ya existe y sí corre en `npm test`
(`tests/scrum473-metodo-validado.test.mjs`). La receta para rehacer el censo:

- **Instrumento A:** recorrer `src/**/*.ts` con `ts.createSourceFile`, quedarse con las
  `CallExpression` cuya `expression` sea `<x>.charge.<create|update|updateMany|upsert|createMany>`, y
  recolectar `PropertyAssignment`/`ShorthandPropertyAssignment` de nombre `method` bajo su `data`.
  Correrlo **con y sin** límite de profundidad: si los dos números coinciden, el anidamiento no es
  la causa de lo que falta.
- **Instrumento B:** barrido por líneas de `src/**/*.ts` con `/(^|[^A-Za-z_$.])method\s*[:=](?!=)/`,
  `/webhooks\/psp/` y `/\$executeRaw|\$queryRaw|UPDATE\s+"?Charge"?/i`. Se imprime **todo** y se
  clasifica a mano: el instrumento informa, no decide.
- El cruce de los dos es lo que da el diez. **Ninguno de los dos, solo, lo habría dado**: A no puede
  ver los emisores del webhook, y B no puede distinguir un escritor de un `<form method="post">`.

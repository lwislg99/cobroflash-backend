# SCRUM-815 · El webhook de Stripe marca el evento como visto ANTES de terminar de procesarlo

**Fecha:** 7-sep-2026 · **Carril:** dinero (cobro en producción) · **Gate:** PASO 0, medición · **Prioridad:** Highest

**Medido contra:** `origin/main` = `af08201502a3978a484de3933132dfcdf26df790` · 2026-09-07T13:25:00+02:00
**Preámbulo:** `./node_modules/.bin/prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** · `npm run build` rc=0

> ⛔ Esto es **medir, no arreglar**. No se toca `prisma/schema.prisma`, ni el camino de emisión
> (regla 38), ni ninguna clave de Stripe — ni real ni de ejemplo, ni en el código ni en un comentario.

---

## VEREDICTO: **EL DEFECTO EXISTE**

Un pago que Stripe da por entregado y nosotros no registramos. Y no se nota: no hay error, no hay
aviso, hay un cobro que existe en Stripe y no existe en YaQu.

---

## 1 · Dónde se marca, y en qué momento

[`stripe.routes.ts:20-29`](../../src/modules/billing/app/routes/stripe.routes.ts#L20-L29) —
`isDuplicateStripeEvent` **pregunta y marca en la misma llamada**: `:24` consulta el `Set`, `:25`
lo añade. No hay dos pasos, así que no hay ningún sitio donde decir «ya terminé».

El orden de la ruta, leído del fichero:

| línea | qué pasa |
| :-: | --- |
| `:39` | `stripe.webhooks.constructEvent(...)` |
| **`:42`** | **`if (isDuplicateStripeEvent(event.id))` → ACK 200 y NO se procesa** |
| `:47`+ | …**aquí empieza el trabajo**: `axios.post` a `/webhooks/psp`, `prisma.merchant.update`, la recompensa de referido, el email de activación |
| `:170` | `catch` → `res.status(400)` — y un 400 hace que **Stripe reintente** |

La marca está **128 líneas antes** de que termine el trabajo, y el fallo se responde con el código
que provoca el reintento que la marca acaba de inutilizar.

## 2 · Memoria del proceso, no base de datos

```ts
const seenStripeEvents = new Set<string>();   // :20
const seenOrder: string[] = [];               // :21  — LRU de 500
```

No hay tabla ni columna. Se pierde al reiniciar —cada merge a `main` redespliega— y **no se
comparte entre instancias**.

Esto **ya estaba documentado y no se cerró**: [`docs/master/SCRUM-358.md`](SCRUM-358.md) lo censó
el 11-ago-2026 como «la forma F1», con esta frase exacta: *«Se pierde al reiniciar (cada merge a
`main` redeploya) y no se comparte entre instancias»*. Aquel ticket iba de la cola de albaranes y
citó esto como precedente; nadie volvió. Un año de webhook con la avería declarada por escrito.

## 3 · 🔴 El control que decide, corrido

```
🔴 EL CONTROL QUE DECIDE · el MISMO evento dos veces, con fallo en medio del 1º:
   1ª entrega (falla a mitad)         → HTTP 400 · FALLO a medio procesar → Stripe reintentará
   2ª entrega (reintento de Stripe)   → HTTP 200 · DESCARTADO como duplicado
```

El reintento que Stripe manda **porque le dijimos 400** se descarta con un 200. Stripe deja de
reintentar. El cobro se queda sin registrar y nadie se entera.

## 4 · Control positivo — distingue idempotencia de «hay un Set»

```
a) dos eventos DISTINTOS se procesan los dos:
   evt_A → PROCESADO          evt_B → PROCESADO
b) el MISMO evento repetido SIN fallo se descarta una vez:
   evt_C (1ª) → PROCESADO     evt_C (2ª) → DESCARTADO
```

Las dos cosas que la idempotencia **sí** debe hacer, y las hace. Sin este control, la medición de
arriba sólo probaría que existe un `Set`.

Y la otra mitad, en un **proceso nuevo**:

```
🔁 PROCESO NUEVO (el reinicio de Railway, o una segunda instancia):
   evt_C, ya PROCESADO en el proceso anterior → HTTP 200 · PROCESADO
```

Falla por los dos lados: **pierde el reintento** dentro del proceso y **reprocesa** tras un
reinicio o en una segunda instancia.

## 5 · Método, y su límite declarado

Se ejercita `isDuplicateStripeEvent`, que es la misma función que la ruta llama en `:42` y que el
propio código exporta *«para la suite»* (A12.2, `:22`). **No se monta la ruta entera**, y el motivo
es una prohibición, no una comodidad: `integrations/stripe.ts` deja `stripe = null` sin
`STRIPE_SECRET_KEY`, así que la ruta contesta 501 antes de llegar a nada, y montarla exigiría
escribir una clave de Stripe aunque fuese de mentira.

Lo que el banco **no** demuestra por sí solo es el orden de las llamadas dentro de la ruta; eso se
lee en el fichero y está en la tabla de §1.

## 6 · El banco

[`docs/master/evidencias/scrum815/idempotencia-webhook.mjs`](evidencias/scrum815/idempotencia-webhook.mjs)
· salida completa en [`salida.txt`](evidencias/scrum815/salida.txt). No necesita base de datos ni
red. Tiene **suelo**: si `isDuplicateStripeEvent` no se exporta, dice *«no encuentro lo que se
describe»* y sale con 3 — que es un dato distinto de «el defecto no existe».

## 7 · Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión · ninguna clave de Stripe · ninguna cadena de conexión.
# SCRUM-815 · Idempotencia del webhook de Stripe — paso ① decisión

**Medido contra:** `origin/main` = `af08201502a3978a484de3933132dfcdf26df790` · 2026-09-07T13:42:46+02:00
**Rama:** `scrum-815-idempotencia-webhook`

> ⛔ **Aquí no hay arreglo.** El orden de la casa es ① decisión → ② ALTER aditivo en las TRES
> bases → ③ PR, y esto es ①. Lo que se entrega es la medición y la propuesta de columnas.
> `prisma/schema.prisma` no se toca; el 400 ante fallo tampoco.
>
> ⛔ Ni una clave de Stripe, ni real ni de ejemplo. No hace falta ninguna: lo medido es puro.

---

## 1 · ¿Existe ya dónde registrar un evento de pasarela procesado?

**Censo por identidad sobre `schema.prisma`** (`scripts/censo-eventos-de-pasarela.mjs`), no por
subcadena: se parsea en modelos y campos y se pregunta por el identificador entero. **27 modelos,
484 campos**, con control positivo del parser (`Merchant` e `Invoice` aparecen).

**La respuesta a la pregunta literal es NO — y hay algo mejor que un no.**

| | |
|---|---|
| `Event` | eventos **de un cobro** (`chargeId`, `type`, `payload`). No guarda el id del evento de la pasarela |
| `CustomerEvent` | línea de tiempo del cliente. Tampoco |
| `Merchant.stripeAccountId` · `stripeCustomerId` · `stripeSubscriptionId` · `pspId` | identifican **al comercio en Stripe**, no un evento. **Ninguno lleva `@unique`** |
| **`event.id` en `src/`** | **271 ficheros barridos · 3 apariciones, las TRES en `stripe.routes.ts`**, y ninguna escribe en la base: una en un comentario, una en el `Set`, una en un `console.log` |

### 🔴 Lo que sí existe, y es el hallazgo más valioso

**`Albaran.claveIdempotencia`**, con `@@unique([merchantId, claveIdempotencia])` y su módulo
`src/modules/jobs/domain/albaranIdempotencia.ts` (SCRUM-358). **El patrón ya está resuelto en esta
casa y documentado con su porqué**, incluido lo que aquí importa:

> «la consulta va DENTRO del `pg_advisory_xact_lock(...)`, cuya clave es `merchantId` — exactamente
> el alcance del índice. Dentro de ese cerrojo, "¿existe ya esta clave?" no tiene carrera.»

**No hay que inventar nada: hay que copiar eso.** Y con él viene su disciplina de `@map`: la tabla
nueva va en snake_case explícito, como `albaranes` (25 campos, cero columnas camelCase de verdad).

⚠️ **Pero el precedente no se puede copiar entero, y ahí está el ticket.** En el albarán, marca y
trabajo son **el mismo `INSERT`**: la clave es una columna de la fila que se crea. En el webhook, el
trabajo son tres llamadas HTTP fuera del proceso, cinco escrituras y un correo. No caben en un
`INSERT`.

## 2 · Qué hace el manejador entre `:47` y el final

Enumerado **por AST**, no a ojo, y fijado en el banco para que no crezca en silencio:

| línea | efecto | ¿reversible? |
|---|---|---|
| `:49` | `handleStripeDispute` | escritura en BD |
| `:60` | `axios.post /webhooks/psp` · **payment.confirmed** | 🔴 **fuera del proceso** — es el que aplica el cobro |
| `:75` | `prisma.merchant.update` (plan `active`) | sí — idempotente por valor |
| `:81` | `rewardReferralOnFirstPayment` | guardada por `referralRewardedAt`… **sin cerrojo** |
| `:92` | `conConstancia(sendFirstPaymentEmail)` **sin `await`** | 🔴 **NO: es un correo** |
| `:100` | `axios.post` · payment.failed | fuera del proceso |
| `:121` `:131` `:136` `:149` | `prisma.merchant.update` | sí — idempotentes por valor |
| `:159` | `axios.post` · payment.expired | fuera del proceso |

**Seis clases de efecto: 1 disputa · 3 salidas HTTP · 5 escrituras de plan · 1 recompensa · 1
correo.** De ellas, **el correo no se puede deshacer** y las tres HTTP cruzan un límite de proceso.

## 3 · 🔴 La pregunta que decide: ¿y si el proceso se cae entre el trabajo y la marca?

**No pueden ir en la misma transacción.** Una transacción de Prisma no abarca un `axios.post` a
otro servicio ni un correo: si el commit falla, el dinero ya se aplicó y el correo ya salió.

Así que la marca va **DESPUÉS** del trabajo, y hay que contestar qué pasa si el proceso muere en
medio. **El caso concreto, medido, no teórico:**

Un `checkout.session.completed` de un cobro de 480 € a un instituto. El manejador hace el
`axios.post` a `/webhooks/psp` (`:60`), el cobro **se aplica y la factura se emite**. El contenedor
muere antes de escribir la marca. Stripe reintenta a los minutos. La segunda entrega vuelve a
ejecutar el mismo trabajo, y en `/webhooks/psp` cae en `psp.routes.ts:38`:

```ts
if (charge.status === 'paid' && body.event === 'payment.confirmed') {
  await prisma.event.create({ data: { chargeId, type: 'paid', payload: { duplicate: true, body } } });
  if (config.AUTO_INVOICE_ON_PAID) { … sendInvoiceEmail(…) … }
  return res.json({ ok: true, status: 'already_paid' });
}
```

**El dinero NO se cobra dos veces** — el cobro ya está en `paid` y esa rama no vuelve a aplicarlo.
Eso es una buena noticia y hay que decirla: **el receptor interno ya es idempotente por estado**.

🔴 **Lo que sí pasa dos veces:**

1. **El cliente recibe otra vez su factura por correo.** La rama `already_paid` llama a
   `ensureInvoiceForCharge` y **reenvía `sendInvoiceEmail`**, condicionado a
   `AUTO_INVOICE_ON_PAID` + `AUTO_EMAIL_INVOICE_ON_PAID`. Los dos flags salen de variables de
   entorno y **no puedo leer su valor en producción desde aquí** — se declara como límite, no se
   supone. Si están activos, cada reintento es un correo más al instituto con la misma factura.
2. **Una fila `Event` `duplicate: true` por reintento**, que es ruido acotado y hasta útil.
3. **El referidor puede llevarse DOS meses gratis.** `rewardReferralOnFirstPayment` lee
   `referralRewardedAt` y **después** escribe, sin cerrojo: dos entregas simultáneas leen `null`
   las dos y las dos incrementan `freeMonthsEarned`.

> 🔒 **Conclusión de diseño: «exactamente una vez» no es alcanzable** cruzando un límite de proceso,
> y perseguirlo es lo que produce el defecto de hoy —marcar antes para no repetir, y perder el
> trabajo cuando falla—. Lo alcanzable es **al menos una vez con trabajo repetible**, y ya lo es
> casi todo. Lo que hay que cerrar son los dos huecos nombrados arriba, no la ruta entera.

## 4 · Propuesta de columnas, para el colaborador

Una tabla nueva. **Aditiva**: no toca ninguna existente.

```prisma
model GatewayEvent {
  id          Int       @id @default(autoincrement())
  provider    String    @db.VarChar(24)          // 'stripe' hoy; 'mercadopago' cabe sin migrar
  eventId     String    @map("event_id") @db.VarChar(255)
  type        String    @db.VarChar(120)
  receivedAt  DateTime  @default(now()) @map("received_at")   // ← VISTO
  processedAt DateTime? @map("processed_at")                  // ← PROCESADO CON ÉXITO (null = no)
  attempts    Int       @default(1)
  lastError   String?   @map("last_error") @db.VarChar(500)

  @@unique([provider, eventId])
  @@index([provider, processedAt])
  @@map("gateway_events")
}
```

### 🔴 Por qué DOS marcas de tiempo y no un booleano

**Confundir «visto» con «procesado» ES el defecto de hoy**, y guardarlo mal en la base sería el
mismo defecto pero permanente. Las dos columnas dicen cosas distintas y las tres combinaciones
tienen significado:

| `receivedAt` | `processedAt` | qué significa | qué hay que hacer |
|---|---|---|---|
| puesto | **null** | llegó y **no terminó** — o está en curso, o el proceso murió | **dejar pasar el reintento**: el trabajo no está hecho |
| puesto | puesto | terminó bien | ACK 200 sin repetir nada |
| — | — | no ha llegado nunca | procesarlo |

Un `Boolean processed` no distingue «en curso» de «murió a medias», y sería exactamente el `Set`
de hoy con más pasos.

* **`@@unique([provider, eventId])` es el mecanismo**, no un adorno: es lo que hace imposible que
  dos réplicas se crean las dos las primeras. Es lo mismo que sostiene
  `@@unique([merchantId, claveIdempotencia])` en el albarán.
* **`attempts` y `lastError`** existen para que un evento que no termina nunca sea **visible**. Sin
  ellos, un evento atascado en `processedAt = null` es indistinguible de uno recién llegado.
* **`@map` en todas las multipalabra**, por la disciplina medida en `albaranes`.

### El protocolo que habilita (③, no ahora)

1. **Al llegar:** `INSERT` con la clave única. Si choca y la fila tiene `processedAt` **no nulo** →
   duplicado real → 200 sin trabajo. Si choca y es **nulo** → el intento anterior no terminó →
   `attempts++` y **se hace el trabajo**.
2. **Al terminar bien:** `UPDATE … SET processed_at = now()`.
3. **Si falla:** se guarda `lastError` y se responde 400 — que es lo que hace que Stripe reintente,
   y **no se toca**.

### Y los dos huecos que quedan al repetir el trabajo

Se nombran aquí porque la tabla sola no los cierra, y son de ③:

* **el correo de factura duplicado** en `psp.routes.ts:38` — la rama `already_paid` no debería
  reenviarlo;
* **la carrera del referido** — `rewardReferralOnFirstPayment` debería escribir con
  `updateMany({ where: { referralRewardedAt: null } })` en vez de leer y luego escribir.

## 5 · El banco

`tests/scrum815-idempotencia-del-webhook.test.mjs` — **6 tests, y no arregla nada**: fija el
defecto de hoy para que el arreglo tenga línea base.

* **①** fallo a mitad → el reintento se descarta.
* **②** proceso nuevo → se reprocesa. **En un proceso hijo de verdad**: la primera versión
  recargaba el módulo con un `?instancia=` en la URL y **no vale**, porque `dist/` es CommonJS y
  `import()` resuelve por ruta y devuelve el de la caché. El test salió rojo diciendo que la otra
  instancia sí conocía el evento — **y el defecto era del instrumento**: no había segunda instancia.
* **③ el tercero, que no estaba en el encargo:** con **una sola** instancia, el tope de 500 del LRU
  también lo olvida. Stripe reintenta hasta 3 días; en ese hueco caben 500 eventos de sobra. **No
  hace falta escalar para perder un cobro.**
* Dos trinquetes: que pregunta y marca sigan en la misma llamada (si alguien las separa, esta
  decisión se tomó sobre otro código), y que **el censo de efectos no crezca sin decirlo** — de esa
  lista depende la propuesta.

**BUILD exit 0** · suite **5896 · 5794 pass · 0 fail · 102 skipped** · `guards:entrada` **21/21**.

## ⛔ No tocado

`prisma/schema.prisma` · el 400 ante fallo · `isDuplicateStripeEvent` y su `Set` · `psp.routes.ts` ·
`referral.service.ts` · ninguna base · ninguna clave.

---

# SCRUM-815b · Vigencia de la medición, y el censo por TIPO DE EVENTO que faltaba

**Fecha:** 15-sep-2026 · **Carril:** dinero (webhook de Stripe) · **Gate:** medición · **MIDE Y PARA**

**Medido contra:** `origin/main` = `ef5395bf6fe6b385ae385002a6b1001e8fce4ce0` · 2026-09-15T10:09:51Z
**Rama:** `scrum-815b-vigencia-y-censo-por-evento`
**Preámbulo (A1):** `./node_modules/.bin/prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** · `npm run build` rc=0

> ⛔ **No se construye el escritor.** No se toca `prisma/schema.prisma` —S1 está en él para este
> mismo ticket—, ni el camino de emisión, ni ninguna clave de Stripe. Aquí sólo se lee y se mide.

---

## 0 · Por qué este apéndice existe, y lo que NO repite

El encargo pedía medir el defecto. **Ya estaba medido y mergeado** (las dos entradas de arriba,
7-sep-2026), y con más de lo que el encargo pide: el enunciado habla de **dos** modos de pérdida y
la medición encontró **tres** —el tope de 500 del LRU olvida sin necesidad de reiniciar ni de
escalar—. Rehacerlo habría sido gastar la tanda (norma A2).

Lo que sí faltaba, y es lo único que aporta este apéndice:

1. **¿Sigue siendo verdad?** Una medición caduca si su objeto se movió.
2. **El censo por TIPO DE EVENTO.** Lo de arriba censa **clases de EFECTO** (6). El encargo
   pregunta otra cosa: *cuántos eventos distintos maneja y cuáles no son idempotentes*.
3. Un **efecto no reversible que el censo anterior no vio**.

---

## 1 · Vigencia: la medición del 7-sep sigue describiendo el código de hoy

| comprobación | resultado |
|---|---|
| `git diff af082015 → origin/main -- stripe.routes.ts` | **vacío: el fichero está INTACTO** |
| Las anclas `:22-29` (el `Set` y la función) y `:42` (la llamada) | siguen donde dice §1 |
| `tests/scrum815-idempotencia-del-webhook.test.mjs` | **6 pass · 0 fail · `# skipped 0`** |
| `GatewayEvent`/`gateway_events` en `prisma/schema.prisma` | **no está todavía** (S1 sigue en ello) |

**El defecto sigue vivo y la propuesta de columnas sigue sin aplicar.** Nada de lo escrito el
7-sep ha caducado.

---

## 2 · 🔴 SIETE tipos de evento, y DOS no son idempotentes

Censado por AST sobre `event.type` —las dos formas de despacho, `=== 'x'` y `[...].includes(...)`—
con **control positivo** del extractor de efectos sobre fuente sintética (ve 2 de 2) y **suelo**:
si no encontrara ningún tipo se declara CIEGO con salida 3, que es un dato distinto de cero.

| # | tipo de evento | línea | efectos | ¿idempotente al repetir? |
|---|---|---|---|---|
| 1 | `charge.dispute.created` | `:47` | `handleStripeDispute` | 🔴 **NO** — ver §3 |
| 2 | `checkout.session.completed` | `:53` | `axios.post` + `merchant.update` + referido + **correo** | 🔴 **NO** — el correo no se deshace y el referido tiene carrera (ya medido arriba) |
| 3 | `payment_intent.payment_failed` | `:96` | `axios.post` → psp | ✅ sí — corta en `already_failed` (`psp.routes.ts:82-86`) |
| 4 | `customer.subscription.updated` | `:108` | `merchant.update` | ✅ sí — idempotente por valor |
| 5 | `customer.subscription.created` | `:109` | `merchant.update` | ✅ sí — idempotente por valor |
| 6 | `customer.subscription.deleted` | `:145` | `merchant.update` | ✅ sí — idempotente por valor |
| 7 | `checkout.session.expired` | `:155` | `axios.post` → psp | ✅ sí — corta en `already_expired` (`psp.routes.ts:82-86`) |

**Cinco de siete son seguros de repetir.** Eso importa para el tamaño: el arreglo no tiene que
proteger la ruta entera, sólo los dos tipos que sí muerden.

---

## 3 · 🔴 Lo que el censo anterior NO vio: la disputa manda un WhatsApp

El censo de efectos de arriba anota `handleStripeDispute: 1 // escribe en BD`, y el trinquete del
banco (`tests/scrum815-…:141`) lo fija así. **Es un censo de PRIMER NIVEL**: mira las llamadas de
`stripe.routes.ts` y **no entra en la función**. Dentro (`src/modules/payments/disputes.service.ts`)
hay dos efectos, y el segundo no es una escritura:

* `recordCustomerEvent(...)` → `customerEvent.create` **sin clave de deduplicación**: una fila de
  línea de tiempo **por cada reintento**.
* `notifyMerchantAlert(...)` → 🔴 **un WhatsApp al profesional, por cada reintento.** «⚠️ El banco
  de X ha abierto una disputa por N €.» Repetido tantas veces como Stripe reentregue.

**Esto no contradice la medición anterior: la completa.** Su lista de no reversibles nombraba
**un** correo; son **dos** canales hacia una persona, y el segundo va al profesional, no al
cliente. *Un censo que no sigue las envolturas devuelve un número más bajo en vez de declararse
ciego* — y aquí devolvió «1 escritura en BD» donde hay una fila y un mensaje.

> 📌 **Límite declarado:** este apéndice tampoco ha seguido las envolturas de los otros seis tipos
> hasta el fondo. Lo medido es un nivel más que antes, no todos los niveles.

---

## 4 · Propuesta: qué encaja, y qué NO cierra `gateway_events`

**La propuesta de columnas y el protocolo de tres pasos ya están escritos arriba** (`SCRUM-815`,
paso ①, §4) y siguen siendo válidos: `received_at` al recibir, `processed_at` sólo al terminar con
éxito, `attempts`, `last_error`, y `@@unique([provider, eventId])` como mecanismo. Las tres
combinaciones de los dos timestamps tienen significado y un booleano no las distingue —«en curso»
y «murió a medias» se leen igual—, que es exactamente el defecto de hoy guardado en disco.

Este apéndice no la reescribe. Añade **dónde encaja cada tipo** y **qué queda fuera**:

### El orden, aplicado a los 7 tipos

1. **Al recibir**, antes de despachar: `INSERT` con la clave única.
   * choca y `processed_at` **no nulo** → duplicado real → **200 sin trabajo**;
   * choca y es **nulo** → el intento anterior no terminó → `attempts++`, `last_error` a la vista,
     **y se hace el trabajo**;
   * no choca → primer intento, se hace el trabajo.
2. **Al terminar bien**: `UPDATE … SET processed_at = now()`. **Nunca antes**, que es el defecto.
3. **Si falla**: `last_error` y **400**, para que Stripe reintente. El 400 no se toca.

### 🔴 Lo que la tabla NO arregla, y hay que decirlo

`gateway_events` cierra la ventana del **proceso** (reinicio, segunda instancia, tope del LRU).
**No hace idempotente el trabajo repetido**, y el trabajo se repite a propósito: si el intento
anterior murió a medias, el reintento vuelve a entrar. Con el protocolo puesto, de los dos tipos
no idempotentes siguen abiertos:

| hueco | dónde | qué se lleva el usuario |
|---|---|---|
| correo de factura duplicado | `psp.routes.ts:38`, rama `already_paid` | otro correo con la misma factura |
| carrera del referido | `rewardReferralOnFirstPayment`, lee y luego escribe | dos meses gratis |
| 🔴 **WhatsApp de disputa duplicado** | `disputes.service.ts`, §3 | otro «han disputado tu cobro» |
| 🔴 **fila de timeline duplicada** | `recordCustomerEvent` en el mismo sitio | ruido en la ficha del cliente |

Los dos primeros ya estaban nombrados arriba; **los dos últimos son de este apéndice**. Ninguno se
arregla aquí: son de ③, y ③ no es este encargo.

---

## 4bis · 🔴 EL BANCO QUE EL EXPEDIENTE PROMETE NO ESTÁ EN EL REPOSITORIO

La entrada del 7-sep dice, en su §6:

> `docs/master/evidencias/scrum815/idempotencia-webhook.mjs` · salida completa en `salida.txt`

**Ninguno de los dos existe.** Medido sobre `origin/main`, no sobre un árbol de trabajo:
`git ls-tree -r origin/main -- docs/master/evidencias/` filtrado por `815` devuelve **vacío**,
mientras que su hermano de la misma tanda sí subió el suyo (`evidencias/scrum814/`, tres ficheros).

**Qué significa y qué no.** La evidencia viva **no se perdió**: el banco de verdad quedó como
`tests/scrum815-idempotencia-del-webhook.test.mjs`, que corre en la suite y hoy da 6/6. Lo que
falta es el script suelto del PASO 0 y su salida — el enlace del expediente lleva a la nada.
*El banco SE SUBE: si no está en git, no existe* (norma A8).

**Por qué ningún guard lo cazó:** `guards:entrada` pasa 22/22. Su comprobación de documentos
prometidos (SCRUM-242) mira **los scripts**, no las entradas de `docs/master/`. Un expediente
puede enlazar un fichero inexistente sin que nada proteste. Se reporta, no se arregla aquí.

**No se reconstruye el banco ajeno**: no tengo su script, y fabricar uno y llamarlo como el suyo
sería inventar una evidencia. Lo que sí queda es la carpeta creada con el banco de ESTE apéndice.

## 4ter · El banco de este apéndice

`docs/master/evidencias/scrum815/censo-por-tipo-de-evento.mjs` · salida en
`salida-censo-por-tipo.txt`. No necesita base de datos, ni red, ni clave alguna.

* **SUELO, probado:** apuntado a un fichero sin tipos de evento (`roleCapabilities.ts`) dice
  `🔴 CENSO CIEGO: cero tipos de evento. No es "no maneja ninguno"` y sale con **3** — un dato
  distinto de cero. Acepta la ruta por `argv` justo para poder enseñar ese rojo.
* **CONTROL POSITIVO** del extractor de efectos sobre fuente sintética: ve 2 de 2.
* Cuenta las **dos** formas de despacho (`=== 'x'` y `[…].includes(event.type)`), por AST y no
  por `grep`: `event.type` aparece también en `console.log` y en comentarios.

## 5 · Lo NO tocado

`prisma/schema.prisma` (S1 está en él) · el escritor · `isDuplicateStripeEvent` y su `Set` ·
el 400 ante fallo · `psp.routes.ts` · `disputes.service.ts` · el camino de emisión · ninguna base ·
ninguna clave. **Nada ejecutado contra producción ni contra staging.**

## 6 · Documentos consultados

`docs/master/SCRUM-815.md` (las dos entradas de arriba) · `docs/master/SCRUM-358.md` ·
`docs/equipo/00-normas-comunes.md` (A1, A2, A7, A8, A16) · `CLAUDE.md`

---

# SCRUM-815 · APÉNDICE · 15-sep-2026 · El efecto ③ cerrado: la disputa avisa UNA vez

**Medido contra:** `origin/main` = `5359f41d9593c22cbba7926bbe5a41510d79f3a1` · 2026-09-15T10:28:46Z
**Rama:** `scrum-815-disputa-una-sola-vez` · **Carril:** dinero · **Gate:** sin gate — corre en `npm test`

> 📌 Encabezado `# SCRUM-815` y no `# APÉNDICE`, por el delimitador de
> `tests/scrum267-ancla-de-medicion.test.mjs:147` (misma razón escrita en `SCRUM-825.md:590`).

Este apéndice **no re-mide nada**: parte de la medición del 7-sep y del censo por tipo de evento
del apéndice 815b, y construye **un solo efecto** — el que tiene víctima visible.

---

## 1 · Lo que estaba roto, con su víctima

`charge.dispute.created` disparaba **dos efectos sin deduplicar**, y Stripe reentrega hasta 3 días:

* un **WhatsApp al profesional** — «⚠️ El banco de X ha abierto una disputa por N €»;
* una **fila de línea de tiempo** en la ficha del cliente.

La memoria del proceso no lo tapaba: `isDuplicateStripeEvent` (`stripe.routes.ts:22`) es un `Set`
del módulo con tope 500, y **el webhook de Connect no lo llama siquiera**. En tres días de
reintentos el proceso se reinicia: cada entrada vuelve a encontrar un `Set` vacío.

### 🔴 EL ROJO, EJECUTADO ANTES DEL ARREGLO

```
not ok 2 - SCRUM-815 · 🔴 tres entregas del MISMO evento → UN WhatsApp, no tres
  error: 🔴 EL PROFESIONAL HA RECIBIDO 3 WHATSAPP POR LA MISMA DISPUTA. …
  3 !== 1
```

---

## 2 · El arreglo: la marca vive en DISCO, y se escribe AL TERMINAR

La clave se **deriva** del evento (`event.id`, estable entre reintentos) y, si faltara, del id de
la disputa — que también lo es. **Ninguna se inventa**, y ninguna vive en memoria.

La marca es una fila de `events` —el registro por cobro que ya usan `paid`, `invoiced`,
`emailed`— con `payload = { stripeEventId, disputeId }`.

> 🔒 **SE ESCRIBE AL TERMINAR, NUNCA ANTES.** Es la semántica de `processed_at` que fija el paso ①
> §4 de este mismo expediente: **marcar antes de hacer el trabajo es EL defecto del ticket**
> (`isDuplicateStripeEvent` pregunta y marca en la misma llamada, antes de empezar). Marcando al
> final, una entrega que muriese a medias no deja marca y el reintento vuelve a entrar: se paga con
> un aviso repetido en un caso raro, en vez de con **silencio sobre una disputa**, que es dinero.

Y `recordCustomerEvent` pasa a esperarse: una marca escrita mientras el trabajo sigue en vuelo no
deduplica nada.

### Las dos asimetrías, y las dos van hacia «avisa»

Si la consulta de la marca falla, `yaAtendida` devuelve `false` — «no lo he visto, avisa». Es la
misma asimetría y el mismo motivo que `existeEventoDePlan` (SCRUM-394), que está a tres funciones
de distancia: equivocarse hacia un aviso repetido cuesta un WhatsApp; equivocarse hacia el silencio
cuesta que el profesional no se entere de que le han disputado un cobro.

---

## 3 · El banco: `tests/scrum815-disputa-una-sola-vez.test.mjs`

Sin base, sin claves, sin red — con el doble que YA existe (`tests/_envio-doblado.mjs`:
`require.cache` para `prisma`, `WHATSAPP_DRY_RUN=1` + `__waDryRunOutbox` para Meta). En dry-run los
senders pasan **todos** los guards y sólo se saltan el HTTP, así que `handleStripeDispute` entero
es código de producción sin tocar.

| control | qué fija |
|---|---|
| 🔴 SUELO | una entrega → **1** WhatsApp y **1** fila. Si el detector no ve ninguno, se declara CIEGO: lo de abajo se cumpliría sobre un buzón vacío |
| 🔴 EL DEFECTO | tres entregas del mismo evento → **1**, no 3 |
| ✅ POSITIVO | **dos disputas distintas siguen avisando DOS veces** — comerse la segunda sería romper el producto por el lado bueno |
| ✅ POSITIVO | una disputa NUEVA sobre la MISMA charge vuelve a avisar: la clave es el evento, no el cobro |
| 🔴 EN DISCO | se borra la marca de la base y **vuelve a avisar** — prueba de que lo que corta es la fila leída, no un residuo en memoria |

**Mutación corrida** para probar que no es decoración: con `yaAtendida` devolviendo siempre `false`,
caen los dos (`3 !== 1` y `2 !== 1`). Fuente restaurada byte a byte — sha256 `3b786ea84f53a40b`
antes y después.

---

## 4 · ⚠️ Límite declarado: la ventana que esto NO cierra

Entre leer la marca y escribirla hay ventana. **No se puede cerrar aquí sin
`@@unique([provider, eventId])`**, y esa tabla (`gateway_events`) es de otra sesión y del paso ③.
Los reintentos de Stripe van espaciados, así que la ventana es estrecha — y lo que este arreglo
quita, *tres días de avisos repetidos*, no depende de ella.

## 5 · Por qué esto NO es un estado nuevo (regla 27)

`Event.type` **no es una FSM**. La Parte L enumera las máquinas de Quote, Invoice, Charge,
QuoteRequest, Customer, WhatsAppMessage, VfSubmission, Subscription, Job y Albaran; `events` es un
registro de **sólo-añadir** por cobro (`paid`, `invoiced`, `emailed`, `bizum_claimed`…). No se ha
tocado ningún `status`, ninguna transición y ningún flag. Es la misma distinción que el master hace
en SCRUM-170 —«VOCABULARIO DERIVADO, no una FSM»— y en SCRUM-17 —«FSM Parte L intacta, regla 27».

Y `disputes.service.ts`, `stripe.routes.ts` y `connectWebhook.routes.ts` **no figuran en**
`docs/legal/AUDITORIA_CAMINO_EMISION.md`: la regla 38 no se dispara.

## 6 · Lo NO tocado

`prisma/schema.prisma` (S1 está en él) · el escritor de `gateway_events` · `isDuplicateStripeEvent`
y su `Set` · los otros tres efectos (correo de factura, referido, timeline de otros eventos) · **el
texto del WhatsApp** (regla 30) · el 400 ante fallo · el camino de emisión. Ninguna base, ninguna
clave. **Nada ejecutado contra producción ni contra staging.**
# SCRUM-815 · APENDICE · 15-sep-2026 · paso ⑥ — el modelo entra en `schema.prisma`

**Medido contra:** `origin/main` = `d9a05138cb61a30916300951a979db84121d8002` · 2026-09-15T11:19:51+01:00
**Rama:** `scrum-815-el-modelo-del-evento`

> El orden de la casa es ① decisión → ② DDL en las TRES bases → ③ PR con esquema y código.
> ① está en la entrada de arriba; ② ya está aplicado (`gateway_events` existe en desarrollo,
> staging y producción). Esto es **sólo la mitad de ③ que abre el sitio**: el modelo. El
> protocolo del webhook —insertar, reintentar, decidir— NO se escribe aquí: toca el flujo de
> cobro en producción y va en su propio trabajo.

---

## 1 · Lo que entra, y es todo

18 líneas al final de `prisma/schema.prisma`: el `model GatewayEvent` del §4 de la entrada
anterior, copiado de allí. **Cero borrados, cero reordenaciones, cero cambios de formato.** El
fichero pasa de 1633 a 1651 líneas y el diff no tiene ni una línea de resta.

Los cuatro `@map` **se verificaron contra el DDL que creó la tabla**
(`docs/sql/scrum-815-el-evento-que-no-se-pierde.sql`), no contra la memoria: `event_id`,
`received_at`, `processed_at`, `last_error`. Los otros cuatro campos (`id`, `provider`, `type`,
`attempts`) van sin `@map` porque son de una palabra y ahí camello y guion bajo no se distinguen.

## 2 · 🔴 FORMA CONTRA HECHO — y `validate` sólo contesta la primera

`prisma validate` en verde dice que el fichero está **bien escrito**. No dice que los campos hayan
llegado a ninguna parte. Lo que decide es el cliente generado, y se comprueba leyendo su DMMF:

```
modelo   : GatewayEvent -> tabla gateway_events
  eventId      -> columna event_id        String
  receivedAt   -> columna received_at      DateTime
  processedAt  -> columna processed_at     DateTime?
  lastError    -> columna last_error       String?
unique   : [["provider","eventId"]]
delegado en el cliente: object
```

### ⚠️ Y para que `validate` corriera hizo falta una `DATABASE_URL` que no existe

Ningún worktree tiene `DATABASE_URL` —sólo `_DEV`, `_STAGING` y `_TESTS`, tal y como registra
`CLAUDE.md`— y `validate` falla con `P1012` sin ella aunque **no conecte a nada**. Se le pasó una
URL **sintética** (`127.0.0.1:1`, base inexistente) por ENTORNO, no en argv. Si hubiera intentado
conectar, el puerto 1 del loopback lo habría rechazado al instante; contestó en verde sin demora.

## 3 · 🔴 EL HALLAZGO: `scrum235` NO puede ver este fallo, y no es culpa suya

`scrum235` compara el SCHEMA contra el CLIENTE en los dos sentidos, `@map` incluido. Es un buen
guard. Pero **sus dos mitades salen del mismo fichero**: si alguien le quita el `@map("event_id")`
a `eventId` y regenera, el schema y el cliente vuelven a cuadrar al instante.

Medido, no supuesto — con el `@map` arrancado y el cliente regenerado:

```
pass=25 fail=3     (28 = 7 de scrum815 + 21 de scrum235)
CAE · SCRUM-815 · 🔴 CADA campo del modelo apunta a una columna que la tabla TIENE
CAE · SCRUM-815 · 🔴 CADA columna de la tabla tiene su campo (nada queda inalcanzable)
CAE · SCRUM-815 · 🔴 el UNIQUE (provider, event_id) está en el modelo Y en la tabla
```

**Los tres que caen son de `scrum815`. Los 21 de `scrum235` siguen en verde.**

> 🔒 Dos copias que se generan la una de la otra siempre cuadran. El tercer extremo —la BASE— es
> el único que puede decir que el nombre está mal, y ningún guard lo estaba mirando.

Por eso `tests/scrum815-el-modelo-apunta-a-la-tabla.test.mjs` no compara contra `schema.prisma`:
compara el cliente generado contra el DDL, y **lee** los nombres físicos de ahí en vez de
escribirlos a mano — una lista copiada sería una cuarta copia que puede divergir como las otras.

Sin `@map`, Prisma pide una columna `"eventId"` que en `gateway_events` no existe. Eso no lo caza
`tsc` ni `generate`: sale en la **primera consulta**, en ejecución, en el camino de un webhook de
cobro.

## 4 · Los cuatro rojos, y el árbol después

| rojo | qué cae |
|---|---|
| a `eventId` se le quita el `@map` | 3 · los dos sentidos y el único |
| desaparece el campo `attempts` | 2 · el suelo del modelo y la columna inalcanzable |
| `processedAt` deja de ser NULLABLE | 1 · el que guarda el ticket entero |
| se cae el `@@map` de la tabla | 1 · el suelo (el modelo buscaría `GatewayEvent`) |

Cada uno REGENERÓ el cliente antes de juzgar —mutar el `.prisma` sin regenerar no le llega al
test— y restauró después el fichero **y** el cliente: restaurar el fuente no es restaurar el
árbol cuando hay un artefacto generado de por medio. `Buffer.compare === 0` sobre
`prisma/schema.prisma`, y el sha256 al final es el mismo que al principio.

## ⛔ No tocado

**Ninguna base**: ni producción, ni staging, ni desarrollo. Ni con `--dry-run`.
**Ningún comando de los prohibidos**: `migrate` (dev/deploy/reset/resolve), `db push` y
`migrate diff` no se han ejecutado — tampoco «para comprobar». `npx` no se ha usado para el CLI de
Prisma: el binario es el local de `node_modules`.
**El protocolo del webhook**: ni una línea. El sitio queda abierto y ahí se para.
**Ningún otro modelo** de `schema.prisma`, y ningún fichero de `src/`.


---

# SCRUM-815 · APÉNDICE · 15-sep-2026 · El efecto ② cerrado: la carrera del referido

**Medido contra:** `origin/main` = `e12da8e394102d3f216dcc9b851b91014bf73458` · 2026-09-15T11:01:29Z
**Rama:** `scrum-815-carrera-del-referido` · **Carril:** dinero · **Gate:** sin gate

> 📌 Encabezado `# SCRUM-815` por el delimitador de `scrum267-ancla-de-medicion.test.mjs:147`.
> No re-mide nada: parte del paso ① §3 y cierra **un solo efecto**.

---

## 1 · El defecto, y lo que se llevaba

`rewardReferralOnFirstPayment` LEÍA `referralRewardedAt`, comprobaba en JavaScript y DESPUÉS
escribía. Entre el `if` y el `update` no hay nada. Dos entregas simultáneas del mismo primer pago
leen `null` las dos, las dos pasan la guarda y las dos incrementan `freeMonthsEarned`.

### 🔴 EL ROJO, EJECUTADO ANTES DEL ARREGLO

```
not ok 2 - SCRUM-815 · 🔴 dos entregas SIMULTÁNEAS del mismo primer pago → UN mes, no dos
  error: 🔴 EL REFERIDOR SE HA LLEVADO 2 MESES GRATIS POR UN SOLO REFERIDO. …
  2 !== 1
```

---

## 2 · El arreglo: la condición viaja DENTRO del UPDATE

```ts
const reclamo = await tx.merchant.updateMany({
  where: { id: referredMerchantId, referralRewardedAt: null },
  data: { referralRewardedAt: new Date() },
});
if (reclamo.count !== 1) return false;   // otra entrega se adelantó
```

La base comprueba y escribe **de una pieza**; el que llega segundo recibe `count: 0` y se va sin
cobrar. Es el mismo patrón —y por el mismo motivo— que el guard anti-doble-consolidación de
`recapitulativa.service.ts:118`, que este máster describe como «lo que hace segura la concurrencia».

> 🔴 **`count` NO ES DECORATIVO.** Es lo único que distingue «he reclamado yo» de «alguien se me
> adelantó». Medido con mutación: sustituyendo `if (reclamo.count !== 1)` por `if (false)`, el banco
> vuelve a dar **`2 !== 1`**. Un update condicional cuyo resultado no se mira tiene el mismo defecto
> con otra forma. Fuente restaurada byte a byte — sha256 `4c9f6cfb3da0972e` antes y después.

La lectura de arriba **se queda, pero como atajo barato**, no como cerrojo: evita abrir transacción
en el caso normal (la reentrega de días después). Está dicho en el código para que nadie la
confunda con la guarda.

---

## 3 · El banco: `tests/scrum815-referido-una-sola-vez.test.mjs`

| control | qué fija |
|---|---|
| 🔴 SUELO | un primer pago da **1** mes. Sin esto, «no da dos» se cumpliría sobre un sistema que no recompensa nunca |
| 🔴 LA CARRERA | dos entregas **simultáneas** → **1** mes, no 2 |
| ✅ LA BASE DECIDE | la segunda llamada afecta a **cero** filas |
| ✅ POSITIVO | dos referidos **distintos** siguen dando un mes **cada uno** |
| ✅ POSITIVO | sin referidor no se marca ni se paga a nadie |
| 🔴 ESTRUCTURAL | la guarda está en el `where` **y** el código mira el `count` |

### 🔴 Por qué este fichero NO usa `tests/_envio-doblado.mjs`

Su doble corta por lo sano con todo lo que empieza por `$`:

```js
if (nombre.startsWith('$')) return async () => undefined;   // _envio-doblado.mjs:66
```

O sea que **`$transaction(cb)` devuelve `undefined` sin llamar a `cb`**. Con ese doble el cuerpo de
la transacción no se ejecuta y el test saldría verde sin haber probado nada. Un doble que se traga
la transacción no puede arbitrar una carrera que vive dentro de ella. Por eso hay un doble propio
que modela lo único que decide: que un UPDATE condicional es atómico y devuelve cuántas filas tocó.

> ⚠️ **LÍMITE DECLARADO:** ese doble es un MODELO, no Postgres. Por eso el banco lleva además el
> control ESTRUCTURAL, que no depende del modelo: si alguien vuelve a leer-y-luego-escribir, el
> modelo podría no enterarse y la forma sí.

---

## 4 · 🔴 EL PATRÓN SE REPITE: 3 sitios más en este mismo fichero

Se arregla **sólo el del encargo** (regla 9), pero el censo se deja hecho y con línea:

| sitio | forma | qué se lleva |
|---|---|---|
| 🔴 `redeemFreeMonth` :73 → :78 → :84 | lee `freeMonthsEarned`, comprueba `< 1`, y **después** `decrement: 1` | **es dinero y es la misma carrera**: dos canjes simultáneos con UN crédito pasan los dos → el saldo queda en **−1** y el merchant estira `planExpiresAt` **dos veces**. Su propio comentario dice «Idempotente por crédito», y la carrera lo desmiente |
| `ensureReferralCode` :31 → :35 → :37 | lee `referralCode`, y si falta genera y escribe | dos llamadas a la vez generan dos códigos y gana el último. Molesto, no caro |
| `generateUniqueReferralCode` :21 → :22 | comprueba existencia y el que escribe es otro | TOCTOU **amortiguado por la base**: `referralCode` es `@unique`, así que una colisión real revienta en vez de corromper |

**`redeemFreeMonth` merece ticket propio**: mismo carril (dinero), misma forma, y el arreglo es la
misma línea —`updateMany({ where: { id, freeMonthsEarned: { gte: 1 } }, data: { decrement: 1 } })`
mirando el `count`—. No se toca aquí porque no es este encargo.

## 5 · Lo NO tocado

`prisma/schema.prisma` (S1 está en él, rama `scrum-815-el-modelo-del-evento`, viva al medir) · los
otros huecos (correo de factura, disputa —cerrada en el apéndice anterior—) · el 400 ante fallo ·
`redeemFreeMonth` y los otros dos del censo · microcopy. Ninguna base, ninguna clave. **Nada
ejecutado contra producción ni contra staging.**

---

# SCRUM-815 · APENDICE · 15-sep-2026 · ③ el escritor, solo para los cinco seguros

**Medido contra:** `origin/main` = `e96298e66933fef459218889118a2e6f08eff1e6` · 2026-09-15T12:35:08+01:00
**Y main siguió moviéndose mientras:** a `c3dce7aa`. No se re-ancla porque **no se ha medido
contra él**; comprobado que su diff no toca `src/modules/billing/`, `prisma/` ni los tests de
este ticket. El ancla dice el árbol que se midió, no el último que pasó por delante.
**Rama:** `scrum-815-el-escritor-de-los-cinco`

> ⚠️ **Esta rama sale de `scrum-815-el-modelo-del-evento`, no de `main`.** El modelo
> `GatewayEvent` está en esa rama y **todavía NO está en `main`** (medido: `merge-base
> --is-ancestor` dice SIN MERGEAR, y `git show origin/main:prisma/schema.prisma` no lo tiene).
> Sin el modelo esto no compila, así que la dependencia es real: **este PR no se puede mergear
> antes que el del modelo.**

---

## 1 · Qué se enciende, y para quién

`src/modules/billing/domain/gatewayEvents.service.ts` — tres pasos, y el orden es toda la
propiedad:

1. **Al recibir**, antes de despachar: `INSERT`. Choca contra `@@unique([provider, eventId])` →
   si la fila tiene `processed_at` **no nulo**, duplicado real, ACK sin trabajo; si es **NULL**,
   el intento anterior no terminó → `attempts++` **y se hace el trabajo**.
2. **Al terminar con éxito**: `processed_at = now()`. **Nunca antes.**
3. **Si falla**: `last_error` y el 400 de siempre, que es lo que hace que Stripe reintente.

El `INSERT` es el mecanismo y no hay ventana de comprobar-y-escribir: no se comprueba nada, se
escribe y se mira el choque. Dos réplicas a la vez → una escribe, la otra choca.

### Los CINCO que entran, y los DOS que no

Del censo por tipo (apéndice de SCRUM-815b): entran `payment_intent.payment_failed`, las tres de
`customer.subscription.*` y `checkout.session.expired`.

**Quedan FUERA a propósito** `charge.dispute.created` y `checkout.session.completed`, y la
exclusión está escrita en el código —en `EVENTOS_SIN_REGISTRO`, enumerados, no omitidos— porque
una exclusión que no se nombra parece un olvido.

> 🔒 **Hoy el defecto es SILENCIOSO: se pierden eventos.** Encender el protocolo para los siete
> lo volvería RUIDOSO —correo de primer pago reenviado, WhatsApp de disputa repetido, posible mes
> gratis duplicado—. Cambiar un fallo callado por uno que el cliente ve no es progreso.

Los dos excluidos siguen **exactamente** con el LRU en memoria de la ruta. La disputa, además, ya
la dedupe su propio servicio en disco (efecto ③ de esta misma jornada): encenderla aquí sería un
segundo mecanismo sobre el mismo evento.

## 2 · 🔴 El rojo: el defecto, ejecutado contra la función REAL

```
SCRUM-815c · 🔴 EL DEFECTO: con la memoria, un evento que FALLA pierde su reintento
  entrega 1 → isDuplicateStripeEvent = false → se hace el trabajo → REVIENTA → 400
  entrega 2 → isDuplicateStripeEvent = TRUE  → descartada sin trabajo
  trabajos hechos: 1. El evento se pierde, y nadie se entera: la ruta ya respondió 200.
```

La marca se pone al **recibir**. El trabajo no se pierde por el fallo: se pierde por la marca
puesta antes de tiempo. Con el registro, esa misma segunda entrega devuelve `hacer`, el trabajo
se rehace y `attempts` queda en 2.

## 3 · Los siete rojos del arreglo

| rojo inyectado | qué cae |
|---|---|
| se marca procesado AL RECIBIR (el defecto vuelto a nacer) | 2 |
| el choque devuelve siempre `ya_procesado` (ignora el NULL) | 2 |
| un excluido se cuela en la lista | 2 |
| el motivo del fallo deja de recortarse a 500 | 1 |
| `attempts` deja de subir | 1 |
| la ruta abre registro FUERA de la puerta | 1 |
| la ruta deja de marcar procesado al terminar | 1 |

Fuente restaurado y verificado byte a byte tras cada uno.

## 4 · 🔴 TRES COSAS QUE SALIERON MAL EN EL INSTRUMENTO, Y LAS TRES IMPORTAN

**① El banco daba VERDE sobre el defecto central.** La mutación «marcar procesado al recibir»
—que es literalmente el defecto que este ticket cierra— dejaba la tanda en **10 de 10**. La causa
no estaba en los tests sino en el doble de la tabla: sus valores por defecto iban **detrás** del
`...data`, así que machacaban a `null` el `processed_at` que el código mutado escribía. El banco
se tragaba el defecto y contestaba que todo iba bien.

> 🔒 Un doble que no guarda lo que le mandan no es la tabla: es un sitio donde el defecto no cabe.
> Y eso no se ve mirando el test — se ve cuando el rojo no cae.

**② Un rojo que no caía destapó un hueco de cobertura.** Envolver la marca de procesado en una
condición imposible tampoco tumbaba nada: los casos probaban el SERVICIO y el guard de AST
miraba que la ruta **abriera** el registro, pero **ninguno miraba que lo CERRARA**. De ahí sale
el caso «LA RUTA CIERRA el registro al terminar, y sin más condiciones», que exige que la única
guarda de esa llamada sea `entregaConRegistro`.

**③ `import('…?v=1')` NO aísla el módulo.** Se iba a simular el reinicio del proceso con dos
importaciones distintas del mismo fichero. Medido antes de usarlo:
`a.isDuplicateStripeEvent === b.isDuplicateStripeEvent` → **`true`**. Habría dado un verde sobre
la memoria del vecino. Un reinicio es un **proceso** nuevo, así que se mide con subprocesos, que
además es lo fiel.

## 4bis · 🔴 EL TRINQUETE DE ESTE MISMO TICKET ESTABA ANCLADO A UN NÚMERO DE LÍNEA

`el censo de EFECTOS del manejador no crece sin decirlo` cortaba con **`if (linea >= 47)`** — el
47 era «donde empieza el despacho» el día que se escribió. Al añadir el registro, todo bajó unas
líneas y el censo empezó a contar `stripe.webhooks.constructEvent` e `isDuplicateStripeEvent`,
**que llevan ahí desde siempre**. No midió un cambio del manejador: midió su propio
desplazamiento.

> 🔒 Un ancla por número de línea no vigila el código: vigila dónde estaba el código. El primer
> commit que escriba encima la rompe, y lo que denuncia entonces no es un defecto.

Se ancla al CONTENIDO: el despacho empieza donde `event.type` se **compara** con un tipo. Y hubo
que afinarlo dos veces, lo cual es el propio ejemplo: «el primer `if` que NOMBRA `event.type`» se
enganchaba a la puerta nueva (`if (llevaRegistro(event.type))`), que lo nombra sin despachar
nada. La señal no es mencionar el tipo — es compararlo.

Con el ancla arreglada, los efectos que de verdad añade este trabajo son **dos**, y se declaran
con su motivo: `marcarEventoProcesado` y `anotarFalloDeEvento`. La APERTURA del registro no sale
en el censo a propósito: vive en la puerta, antes del despacho.

### Y el otro trinquete: cuatro exports huérfanos

`SCRUM-411` los cazó y dijo qué hacer con cada uno, que no era lo mismo para todos:
`PROVEEDOR_STRIPE`, `MAX_LAST_ERROR` y `EVENTOS_CON_REGISTRO` **pierden el `export`** —su
consumidor real está dentro del módulo y de fuera sólo entraba su test—; `EVENTOS_SIN_REGISTRO`
**lo conserva y se declara**, porque nadie la usa dentro: su trabajo es constar.

El test, en consecuencia, ya no importa lo que no es superficie pública: lee la lista de los
cinco por AST del fuente y **deriva el tope de `last_error` del propio `schema.prisma`**, que es
mejor ancla que la constante — si la columna cambia de tamaño, el test lo sigue.

## 5 · Lo que esto NO arregla, y sigue abierto

El registro cierra la ventana del **proceso** (reinicio, segunda instancia, tope de 500 del LRU).
**No hace idempotente el trabajo repetido** — y se repite a propósito: si el intento anterior
murió a medias, el reintento vuelve a entrar. Los huecos que el apéndice anterior ya nombraba
(correo de factura duplicado, carrera del referido, WhatsApp de disputa, fila de timeline) siguen
donde estaban: son de los DOS tipos excluidos, y por eso están excluidos.

## ⛔ No tocado

**Los dos eventos excluidos**: ni su camino ni su deduplicación · **`prisma/schema.prisma`**: no
se abre (el modelo ya estaba) · **el 400** de la ruta, que es lo que dispara el reintento ·
**ningún estado ni flag nuevo** (regla 27) · **ninguna dependencia nueva** (regla 36) · **ningún
microcopy** (regla 30) · **ninguna base**: ni producción, ni staging, ni `--dry-run`.

**El camino de emisión fiscal**: `stripe.routes.ts` vive en `src/modules/billing/`, no bajo
`src/modules/invoicing/` ni es `src/lib/invoicing.ts` — comprobado antes de escribir. No hay STOP
de regla 38 que declarar.

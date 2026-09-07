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

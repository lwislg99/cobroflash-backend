# SCRUM-678 · Los webhooks sin secreto — ① y ② medidos, ③ PARADO donde mandaba el encargo

**Medido contra:** `origin/main` = `45a62542fff7b104813308a59e50426ef3fc38c7` · 2026-09-17T16:59:25+01:00
**Rama:** `scrum-678-los-webhooks-sin-secreto`
**Carril:** cobro · integraciones · **Gate:** sin gate

> 🔴 **PARADO EN ②, a propósito.** El encargo decía: «si un cobro se confirma sólo por webhook,
> PARA en ese punto y dímelo antes de seguir midiendo ③». **Se confirma sólo por webhook.** ③ («desde
> cuándo sale el aviso») no se ha medido.
>
> ⛔ **NADA arreglado.** Ni una línea de `src/`. El diseño fail-closed **no se toca**: es correcto.
> ⛔ Ningún secreto escrito, impreso ni inventado — tampoco de ejemplo, tampoco su forma.
> ⛔ Cero producción. Ninguna base consultada. Ninguna credencial.

---

## 1 · ¿Se usan esos dos webhooks hoy?

**POBLACIÓN barrida:** 288 ficheros `src/*.ts` · 105 `public/` · 1.007 `tests/` · 203 `scripts/` ·
729 `docs/*.md`.

Las dos rutas **existen y están montadas**: `/webhooks/stripe-connect` (`app.ts:151`) y `/webhooks/mp`
(`app.ts:366`). Pero **mencionar no es hacer**, así que la pregunta se contesta por el camino que
haría que la pasarela llamase:

| | **Stripe Connect** | **Mercado Pago** |
|---|---|---|
| ¿quién le dice a la pasarela dónde llamar? | **Nadie desde el código.** Se da de alta a mano en el panel de Stripe — censo de `webhookEndpoints`/`endpoints.create`: **0 ocurrencias** | **El propio código**: `mercadopago.ts:46` manda `notification_url` en cada preferencia |
| ¿qué lo dispara? | que exista una cuenta Connect: `connect.routes.ts:47` (`accounts.create`) | que alguien visite `/pay/mp/:token`: `payMp.routes.ts` llama a `createMpPreference` |
| ¿está abierto ese camino? | **NO.** `POST /admin/connect/onboard` está gateado por `PAYMENTS_CONNECT_ENABLED` (`connect.routes.ts:41`), que es **`false` por defecto** (tabla P, «OFF hasta CONNECT-1») | **NO desde ninguna pantalla.** `/pay/mp` **no está en el selector**: sus métodos son `card`, `bizum`, `bizum_auto` y `transfer`. El único productor de `paymp_url` es la API interna `POST /charges` (`charges.routes.ts:81`), cuyos consumidores en el repo son **cero** (medido en SCRUM-893) |

**Veredicto de ①: las dos integraciones están DORMIDAS** — no porque el código no exista, sino porque
**nada las despierta hoy**. Ninguna pantalla lleva a `/pay/mp`, y el onboarding de Connect está
cerrado por un flag apagado.

### ⚠️ El hueco de ①, con su nombre

**No puedo saber si el endpoint de Stripe Connect está dado de alta en el panel de Stripe, ni si
alguien encendió el flag en Railway.** Eso vive en producción y esta sesión no la toca. Lo que
digo es lo que el **repositorio** permite afirmar: con los valores por defecto, nada dispara esos
webhooks. Si el flag estuviera encendido en producción, ① cambia de respuesta — y entonces ② es
urgente, no teórico.

## 2 · 🔴 ¿Algún cobro depende del aviso como VÍA ÚNICA? SÍ. Los dos.

Ésta es la pregunta que decide la gravedad, y la respuesta no es la que esperaba.

### Stripe Connect — medido EJECUTANDO las dos rutas, no leyéndolas

`docs/master/evidencias/scrum678/via-unica-678.mjs` levanta `payCard` y `receipt` con dobles y
observa **qué le piden a Stripe**:

```
payCard  [HTTP 303]  crea la sesión con stripeAccount = "acct_CONECTADA"
receipt  [HTTP 200]  el fallback recupera con stripeAccount = null
```

`receipt.routes.ts:51` tiene un fallback «Stripe sin webhooks» que, al volver de `success_url`,
recupera la sesión y confirma el cobro. **Pero la recupera en la cuenta de PLATAFORMA**, y un direct
charge de Connect vive en la **cuenta conectada**. El fallback no puede encontrarla.

→ **Para un cobro con tarjeta vía Connect, el webhook `checkout.session.completed` es la única vía
que marca el cobro como pagado.**

### Mercado Pago — mismo resultado, por otro camino

`payMp.routes.ts` importa **sólo** `createMpPreference`: **no importa `getMpPayment`**. Su página
`/pay/mp/:token/result` pinta «✅ ¡Pago aprobado!» a partir del **`status` de la query string**, sin
consultar a MP y sin escribir nada.

→ **Para un cobro por MP, `/webhooks/mp` es la única vía que lo marca pagado.**

### Y no hay red de seguridad detrás

**POBLACIÓN de crons: 6** (`src/core/cron/cron.ts`) — recordatorio de cotizaciones, recordatorio de
facturas, mantenimientos, digest semanal, lifecycle emails y sellos de albarán. **Ninguno concilia
cobros ni consulta a las pasarelas.**

Quién más escribe `status: 'paid'` en un cobro: `/webhooks/psp` (interno, y son **los webhooks
quienes lo llaman**) y `confirm-bizum` (a mano, y **sólo** para Bizum manual). No hay más.

### 🔴 La distinción que cambia el remedio

El encargo temía «un camino de confirmación **sin autenticar**». **No es eso, y conviene decirlo
claro: es lo contrario.** El webhook está fail-closed y sin su secreto devuelve 500 / rechaza. Nadie
puede falsificar un «pagado».

Lo que ocurre es que **la confirmación no llega nunca**:

> La clienta paga, el dinero sale de su cuenta y entra en la del profesional — y YaQu se queda
> creyendo que el cobro sigue pendiente.

No es un agujero de seguridad. Es un **agujero de confirmación**, y el daño es el inverso del que se
temía: no entra dinero falso, se pierde el rastro del verdadero.

**Hoy no hiere a nadie**, por lo medido en ①: sin Connect encendido y sin nadie que llegue a
`/pay/mp`, no hay cobros que confirmar. **El día que se encienda Connect sin ese secreto, cada cobro
con tarjeta quedará cobrado y sin registrar.**

    🔒 Un fail-closed correcto sobre una vía única no protege el cobro: lo pierde en silencio.

## 3 · ③ NO MEDIDO — parado a propósito

«Desde cuándo sale el aviso» no se ha medido: el encargo mandaba parar al encontrar ②, y ② se
encontró. **Declarado como no medido, no como irrelevante.**

Y de antemano, el hueco que tendría: la fecha del **primer arranque que lo imprimió** sólo está en
los logs de Railway, que esta sesión no puede mirar. Del repositorio se puede sacar cuándo entró el
código que lo emite, que es **otra cosa** — y presentarlo como «desde cuándo sale» sería deducir un
dato de producción a partir del historial.

## 4 · Un error propio

La primera versión de la sonda de ② habría bastado para reportar, y no valía: iba a comparar contra
lo que el fallback **devuelve**, no contra **con qué pregunta**. El dato que decide no es si el
fallback encuentra la sesión en mi doble —eso lo decido yo al escribir el doble—, sino **si le pasa
`stripeAccount` a Stripe**. Un doble que contesta lo que quieras no mide nada; lo que se mide es la
llamada, no la respuesta.

## 5 · Ficheros

| fichero | qué |
|---|---|
| `docs/master/evidencias/scrum678/via-unica-678.mjs` | la sonda de ②: ejecuta las dos rutas y observa con qué llaman a Stripe |
| `docs/master/SCRUM-678.md` | esto |
| `src/` | **sin tocar** |

---

## SCRUM-678b (9-oct-2026) · qué variable, con qué nombre, y qué pasa hoy sin ella

**Medido contra:** `origin/main` = `be48345279da158bc81aebbea543eb926ae9eb88` · 2026-10-09T08:18:36Z
A9: sin fallo que generalice — sólo documentación y una sonda de lectura; su único tropiezo (salir con `process.exit` tras `fetch` daba en Windows un código que no era el suyo) lo delató el control negativo y ya estaba contado en SCRUM-893b.

Sesión `s1-9octm` (S1) · rama `scrum-678b-que-variable-y-que-pasa-sin-ella`. **No toca `src/`**: el
código de los dos webhooks es del puesto J2 y el ticket está asignado a Javier. Esto es lo que pedía
el encargo —dejarlo ESCRITO para quien tiene que poner las variables— más una sonda que se puede
repetir. Producción servía `be483452` al medir (`/version`).

> ⛔ Los valores los pega un jefe **directo en Railway**. Nunca en un chat, un ticket ni un fichero,
> ni reales ni de ejemplo (regla 9). Aquí sólo van los NOMBRES.

### 1 · Las dos variables

| | **`STRIPE_CONNECT_WEBHOOK_SECRET`** | **`MP_WEBHOOK_SECRET`** |
|---|---|---|
| qué es | el secreto de firma del endpoint de tipo **Connect** del panel de Stripe | la clave secreta de los Webhooks del panel de Mercado Pago |
| a qué ruta protege | `POST /webhooks/stripe-connect` (`app.ts:152`) | `POST /webhooks/mp` (`app.ts:367`) |
| quién da de alta el endpoint | **un jefe, a mano, en Stripe**: en el repo nadie lo crea (0 ocurrencias de `webhookEndpoints` en `src/` y `scripts/`) | el código manda la URL en cada preferencia (`mercadopago.ts:46`); la clave se saca del panel |
| ¿falta HOY en producción? | **SÍ, medido hoy**: un POST sin firma contesta `500 Missing STRIPE_CONNECT_WEBHOOK_SECRET` | **no se puede medir desde fuera**: la ruta contesta `200` antes de verificar. Sólo lo dice el aviso de arranque en los logs de Railway (leído por última vez el 2-sep) |
| qué pasa HOY sin ella | **nada**: Connect está apagado y nadie puede llegar a generar un evento | **nada**: ninguna pantalla lleva a `/pay/mp` |
| cuándo hay que ponerla | **ANTES** de encender `PAYMENTS_CONNECT_ENABLED` para nadie | antes de ofrecer Mercado Pago a nadie |

### 2 · Cómo se ha medido que falta la de Connect

`docs/master/evidencias/scrum678/sonda-produccion-678b.mjs` manda un POST **sin firma** a cada
webhook. Los tres rechazan sin firma antes de tocar nada; lo que cambia es con qué:

```
/webhooks/stripe           [HTTP 400]  Webhook Error: No stripe-signature header value was provided.
/webhooks/stripe-connect   [HTTP 500]  Missing STRIPE_CONNECT_WEBHOOK_SECRET
/webhooks/mp               [HTTP 200]  {"ok":true}
/webhooks/no-existe-678b   [HTTP 404]  {"error":"not_found"}
```

El control es `/webhooks/stripe`: su secreto está puesto y por eso llega a mirar la firma (400). La
de Connect no llega: se para en la línea que comprueba la variable (`connectWebhook.routes.ts:29`).
Contra un servidor que no es el nuestro la sonda sale **CIEGA** (código 2), no «falta»: probado.

**Que Connect está apagado**, también leído en producción y no del valor por defecto:
`GET /admin/connect/status` con la cuenta QA → `enabled:false`, `connectStatus:"none"`. ⚠️ Es UN
negocio: el interruptor también se puede encender por negocio (`merchants.flags`) y los demás no
los veo.

### 3 · Lo que ya NO es verdad de la sección de arriba

El apartado 2 de arriba (17-sep) concluye que, para un cobro con tarjeta por Connect, el webhook es
la **única** vía que lo marca pagado. **Dejó de serlo el 22-sep**: SCRUM-923 (#1647,
`cae002af2aec5a777d866cc8e50cc71f0d555f8f`) hizo que el fallback del recibo recupere la sesión en
la cuenta conectada. La misma sonda de entonces, ejecutada hoy sin tocarla:

```
payCard  [HTTP 303]  crea la sesion con stripeAccount = "acct_CONECTADA"
receipt  [HTTP 200]  el fallback recupera con stripeAccount = "acct_CONECTADA"
  el fallback la BUSCA en la de plataforma .... false
```

(Se corre con la raíz del árbol como argumento y contra un `dist/` cuyo `receipt.routes` y
`payCard.routes` sean los de `main`; hoy lo eran los del árbol `s1-893b`, sin diferencias con
`main` en esos dos ficheros.) Para **Mercado Pago no ha cambiado nada**: `payMp.routes.ts` sigue
sin importar `getMpPayment`, así que su webhook sigue siendo la única vía.

### 4 · Qué se rompe el día que se encienda sin la variable

**Stripe Connect** (los cuatro eventos que atiende `connectWebhook.routes.ts`):

| evento | qué se pierde sin el secreto | ¿hay otra vía? |
|---|---|---|
| `account.updated` | el negocio no pasa a `active` cuando Stripe lo aprueba, y sin `active` no se le ofrece tarjeta | a medias: `syncConnectStatus` lo consulta al VOLVER del alta (`/admin/connect/return`); si Stripe aprueba después, nadie se entera |
| `checkout.session.completed` | el cobro no se marca pagado | a medias: el fallback del recibo, **sólo si la clienta vuelve** a la página tras pagar. Si cierra la pestaña, queda cobrado y sin registrar |
| `charge.dispute.created` | la disputa no avisa ni prepara su paquete de evidencia | **ninguna** |
| `payment_intent.payment_failed` | el intento fallido no se apunta | ninguna |

**Mercado Pago:** todo aviso se descarta en silencio. La ruta contesta `200`, así que Mercado Pago
no reintenta, y el cobro queda **pagado y sin registrar siempre**, no a veces.

En los dos casos el mecanismo es correcto y **no se relaja**: sin secreto no se puede verificar la
firma, y aceptar sin verificar sería dejar que cualquiera invente un «pagado».

### 5 · Cómo se comprueba después de ponerlas

1. Repetir la sonda: `/webhooks/stripe-connect` tiene que pasar de `500` a `400`. **Eso prueba que
   hay una variable, no que sea la correcta.**
2. Lo que prueba que es la correcta: mandar un evento de prueba desde el panel de Stripe al
   endpoint de Connect y ver un `200`. Con el secreto de otro endpoint da `400`.
3. Mercado Pago: su simulador de notificaciones, y que en el log NO salga
   «`MP_WEBHOOK_SECRET` no configurado» ni «Firma inválida». Desde fuera no hay otra forma.

### 6 · De paso: a las dos listas del fundador les faltaba un evento

`docs/PENDIENTES_FUNDADOR.md` y `docs/DEMO_READY_CHECKLIST_FUNDADOR.md` le dicen al fundador con
qué eventos dar de alta el endpoint de Connect, y nombraban **tres**. El código atiende **cuatro**:
faltaba `charge.dispute.created` (en el código desde el 6-jul, `0cc87b28f`). Stripe sólo entrega los
eventos suscritos, así que siguiendo la lista una disputa en una cuenta conectada no habría llegado
nunca, con el secreto bien puesto. Corregidas las dos en esta rama. Ningún test ata esas listas al
código: es lectura contra `connectWebhook.routes.ts`, hecha hoy.

### 7 · Lo que no se ha medido

- Si `MP_WEBHOOK_SECRET` falta hoy (apartado 1). Ni si Mercado Pago está configurado en producción.
- Si el endpoint de Connect existe en el panel de Stripe: vive en Stripe.
- «Desde cuándo sale el aviso» (el ③ de arriba): sigue sin medirse, está en los logs de Railway.
- Ningún evento firmado: esta sesión no tiene ni debe tener ningún secreto.

### 8 · Ficheros de esta sección

| fichero | qué |
|---|---|
| `docs/master/evidencias/scrum678/sonda-produccion-678b.mjs` | la sonda del apartado 2 (códigos: 0 está · 1 falta · 2 no he podido mirar) |
| `docs/PENDIENTES_FUNDADOR.md` · `docs/DEMO_READY_CHECKLIST_FUNDADOR.md` | el evento que faltaba (apartado 6) |
| `docs/master/SCRUM-678.md` | esta sección |
| `src/` | **sin tocar** |

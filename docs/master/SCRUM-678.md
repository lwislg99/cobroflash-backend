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

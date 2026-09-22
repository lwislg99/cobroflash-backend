# SCRUM-923 — El fallback "Stripe sin webhooks" nunca encuentra la sesión de un merchant con Connect

*22-sep-2026 · J2 (jv-j2) · rama `scrum-923-924-cobro-no-verificado`*

**Medido contra:** `origin/main` = `f319add31e4e414ab9e9a70e10bc179dc13996c9` · 2026-09-22T08:19:27Z

---

## El defecto

`payCard.routes.ts:103-105` crea la Checkout Session así:

```ts
const session = useConnect
  ? await stripe.checkout.sessions.create(sessionParams, { stripeAccount: merchant!.stripeAccountId! })
  : await stripe.checkout.sessions.create(sessionParams);
```

Con Connect activo (regla 23: el merchant es merchant-of-record, direct charge en SU cuenta), la
sesión vive en la cuenta **conectada**, no en la de plataforma.

`receipt.routes.ts` (el recibo público, `/recibo/:token`) trae un fallback para cuando el cliente
vuelve de Stripe con `?card=success&session_id=…` pero el webhook aún no ha llegado — recupera la
sesión para confirmar el pago sin esperar. Lo hacía así:

```ts
const s = await stripe.checkout.sessions.retrieve(sessId);
```

**Sin `stripeAccount`.** Stripe es *account-scoped*: una sesión creada en la cuenta conectada
`acct_…` no existe para quien la pide sin decir de qué cuenta — el SDK responde
`No such checkout.session: '…'` (`resource_missing`). Ese error lo traga un `catch` que sólo hace
`console.error(...)` y sigue mostrando el recibo con el estado que ya tenía en BD. El cliente
paga, vuelve del checkout, y el recibo sigue diciendo «pendiente» hasta que el webhook real
(`webhooks/psp` vía Stripe) llega — que puede tardar, o no llegar si `SCRUM-678` (los secretos de
webhook que faltan en producción) sigue sin resolverse.

Confirmado **leyendo** el código el 22-sep (tanda anterior, `project_j2_traspaso.md`) y **corriendo**
en esta tanda con dobles reales (abajo): el rojo es real, no una lectura.

## PASO 0 / Rojo primero

`tests/scrum923-fallback-cuenta-conectada.test.mjs`, montando la ruta REAL sobre un Express real y
doblando `dist/core/db/prisma.js`, `dist/integrations/stripe.js` y `axios` en `require.cache`
(mismo patrón que `tests/scrum910-la-transferencia-que-no-mira.test.mjs`). El doble de Stripe sólo
«encuentra» la sesión si `options?.stripeAccount` coincide con la cuenta esperada — igual que
Stripe de verdad — y si no, lanza el mismo error que lanza Stripe (`No such checkout.session`,
`resource_missing`).

Corrido contra `receipt.routes.ts` sin tocar:

    recibo/stripe-fallback error No such checkout.session: 'cs_923'
    ✖ SCRUM-923 · ① merchant con Connect: el fallback SÍ encuentra la sesión y confirma el pago
      → axios.post se llamó 0 veces, se esperaba 1 (el `retrieve` cortó el paso antes de confirmar)
    ✔ SCRUM-923 · ② CONTROL: merchant SIN Connect (cuenta de plataforma) sigue funcionando igual
    1 fail · 1 pass

El control ② confirma que el caso sin Connect (el que ya funcionaba, cuenta de plataforma, sin
`stripeAccount` en ningún lado) sigue verde ANTES del arreglo — así el rojo de ① no es un fallo del
test, es el defecto real, aislado.

## El arreglo

`receipt.routes.ts`, en el fallback de `GET /:token` — se recomputa el MISMO criterio que ya usa la
creación (`cardChargeMode(charge.merchant)`, importado desde SCRUM-893 en la línea 15 de este mismo
fichero, usado ya para `puedeTarjeta`) y, si da `'connect'`, se le pasa la cuenta conectada al
`retrieve`:

```ts
const retrieveOpts =
  cardChargeMode(charge.merchant) === 'connect'
    ? { stripeAccount: (charge.merchant as any)?.stripeAccountId }
    : undefined;
const s = await stripe.checkout.sessions.retrieve(sessId, retrieveOpts);
```

Cero texto nuevo, cero import nuevo, reutiliza un helper ya existente y ya probado
(`cardCharge.ts`, cubierto por `scrum893-solo-lo-que-puede-cobrar`): atado contra lo que la puerta
de cobro HACE (`payCard.routes.ts`), no contra una copia del criterio.

## Verde + control

    ✔ SCRUM-923 · ① merchant con Connect: el fallback SÍ encuentra la sesión y confirma el pago
    ✔ SCRUM-923 · ② CONTROL: merchant SIN Connect (cuenta de plataforma) sigue funcionando igual
    2 pass · 0 fail

El control ② corrido DESPUÉS del arreglo es lo que descarta que el remedio haya empezado a mandar
`stripeAccount` también cuando no hace falta (regresión sobre el caso de plataforma, que es
mayoría hoy: Connect está apagado por defecto, Parte P).

## Un error propio, esta tanda

El primer borrador de `pedir()` usaba `fetch` para la única petición de cada caso — no debería
disparar el crash de libuv de SCRUM-556 (hace falta 3+ peticiones sobre el mismo `app.listen(0)`,
y aquí cada `pedir()` abre y cierra su propio servidor), pero lo cambié a `node:http` con
`agent:false` de todos modos, igual que en `scrum924-pay-mp-no-inventa-estado.test.mjs` de esta
misma rama: escribir DOS test files nuevos con el patrón sabido-flaky (`fetch` + `app.listen(0)`)
en el mismo PR, aunque cada uno individualmente esté bajo el umbral de 3 peticiones, es la clase de
decisión que se revisa más barata ANTES de que la tanda de CI decida si hoy toca o no.

## Lo NO tocado

`payCard.routes.ts` (la creación de la sesión) — cero líneas de diff, sigue calculando `useConnect`
con su propia expresión escrita a mano, tal como lo dejó SCRUM-893 declarado — · `cardCharge.ts` —
se REUSA, no se toca · ningún texto de usuario, ningún copy nuevo (regla 30 no aplica: no hay texto
nuevo) · `prisma/schema.prisma` · el webhook real (`webhooks/psp`), que sigue siendo el camino
principal — este fallback es sólo el atajo cuando el cliente vuelve antes de que el webhook llegue
· publicar el PR — queda EN BORRADOR, auto-merge desarmado, a la espera del GO de Javier (regla:
dinero real / flujo de cobro en producción, aunque hoy `INVOICING_ES_ENABLED=OFF` en España deja
este camino sin víctima real, regla 24).

## Autorizaciones

Ninguna usada. Ningún GO de dinero, alta ni borrado — el arreglo reutiliza una decisión (Connect
sí/no) que YA toma el código existente; no se ha activado Connect en ningún merchant.

# SCRUM-330 · F3: el contador cuenta plazas VENDIDAS, y con cero no se pinta

**Fecha:** 5-ago-2026 · **Carril:** A (landing + billing) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `522d43c300439656701e13fa42ee79563b6beeab` · 2026-08-05T09:43:21+02:00
**Tanda:** 1474 tests, 1407 pass, 0 fail (el resto, gateados a staging)

## El defecto

«Quedan 18 de 20 plazas» le dice al visitante que **dos profesionales ya compraron**. Debajo, el
dato era `merchant.count({ plan: 'founding' })` — el **campo**, no una venta. Medido en SCRUM-327
sobre el webhook de Stripe (`stripe.routes.ts:110-124`), ese campo queda puesto en tres
situaciones:

| Estado en Stripe | Qué escribe el webhook | ¿Ha pagado? |
|---|---|---|
| `active` | `plan: planId`, estado `active` | **sí** |
| `trialing` | `plan: planId`, estado `active` | **no** — no se ha cobrado nada |
| `past_due` / `unpaid` | `plan: planId` **se conserva** (gracia con banner + portal) | **no** — el cobro falló |

…más cualquier fila puesta a mano o por un seed, que ni siquiera tiene `subscriptionStatus`. Es
**prueba social falsa en material publicado**, y por eso no esperaba al rediseño.

**La pieza que faltaba estaba al lado sin usar:** `subscriptionStatus` distingue los tres estados y
el contador no la miraba.

## Lo construido — tres reglas

1. **Solo cuenta la suscripción activa de verdad.** `PLAZA_OCUPADA = { plan: 'founding',
   subscriptionStatus: 'active' }` (`founding.ts`). Dos condiciones porque son dos preguntas:
   `plan` dice **qué** compró y `subscriptionStatus` dice **si sigue pagando**; ninguna sustituye a
   la otra, y hay un test que impide que un día se «simplifique» a una.
2. **Con cero vendidas no se pinta la escasez.** «Quedan 20 de 20» no comunica escasez: comunica
   que no ha comprado nadie, y lo dice justo donde se presume lo contrario.
3. **Si el dato no se puede leer, no se inventa un número.** Se oculta. Un contador que falla y
   enseña «20» es peor que uno ausente: quien lo lee no tiene forma de saber que es inventado.
   Cubre las cinco formas de «no lo sé»: sin cuerpo, sin el campo, `null`, y con basura donde va el
   número.

## La decisión de diseño que evita romper el producto

En `index.html` **la escasez y la OFERTA viven en el mismo elemento** («Oferta de lanzamiento:
9,90 €/mes… · quedan – plazas»). Gatear el bloque entero por ventas habría hecho desaparecer el
precio founding **justo cuando no ha comprado nadie** — y entonces nadie podría comprarlo: el pez
que se muerde la cola. Sería cambiar el producto, no arreglar el dato.

Por eso se gobiernan **por separado**: la oferta sigue mostrándose mientras queden plazas (su
condición no cambia), y la escasez se envuelve en `#ann-plazas` / `#founding-plazas` para poder
ocultarla sola. **Ni una palabra de texto cambia** — solo dos `<span>` contenedores y *cuándo* se
enseña. Hay un test que lo fija: la oferta tiene que seguir ahí, y los literales de la escasez
tienen que ser los mismos (regla 30).

La decisión vive con el **mismo nombre** en las dos páginas (`pintarPlazas`), así que el test la
extrae con el mismo patrón: si una se renombra, falla nombrando el fichero en vez de comprobar una
y dar por buena la otra.

## Verificado en rojo

- **7 de 12** antes de tocar nada, incluido el del criterio del contador.
- **Las dos mitades del arreglo son portantes**, comprobado neutralizándolas por separado:
  quitando `subscriptionStatus` del criterio caen 2; quitando el gate de ventas del front caen 3.
- **El guard de SCRUM-341 cazó mi propio comentario**, y merece quedar escrito: la primera versión
  explicaba el diseño citando «9,90 … para siempre», y eso **es** una promesa de permanencia sin su
  condición a ojos de un guard que lee texto. Es la trampa de auto-referencia de siempre. **Se
  reescribió el comentario, no el guard** — el guard tenía razón.

## Lo que NO toca (fuera de alcance por decisión del fundador)

- **El tachado 19,90 → 9,90**: sigue igual. Pendiente de que el fundador compruebe en Stripe si ese
  precio se cobró alguna vez (SCRUM-327 · Q16); mientras, es un precio de referencia no verificado.
- **El badge de VeriFactu** (`index.html:365`): decisión suya, sin tocar.
- **Las condiciones de la oferta** («mientras mantengas la suscripción activa», «de por vida»):
  intactas, y ahora explícitamente protegidas por el guard de 341 en este mismo fichero.
- **`trialing`** entraría en la cuenta porque mapea a nuestro `subscriptionStatus: 'active'`. Hoy no
  es alcanzable —el checkout founding omite `trial_period_days` a propósito— y queda **declarado en
  el código**: si algún día se configura un trial en el precio de Stripe, el sitio de distinguirlo
  es `founding.ts`, no la landing.
- **El render en producción no se verifica** (sin acceso): lo medido es el código que se sirve.

## Ficheros

`src/modules/billing/domain/founding.ts` · `public/index.html` · `public/precios.html` ·
`tests/scrum330-contador-solo-activas.test.mjs` (12).

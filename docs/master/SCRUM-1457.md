# SCRUM-1457 · CRUCE DE CARRIL DECLARADO (`area-j3`, lo trabaja J2e) — un `merchantId` que no cabe en la columna: NADA construido; una línea espera el GO y tres son una decisión, no un arreglo

**Medido contra:** `origin/main` = `b71719f32f623729debec40518e3c7c6d3601086` · 2026-10-06T13:45:45Z

6-oct-2026 · **J2e** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por J2e, una sesión; no por el fundador.]

El ticket es del carril de J3. Lo trabaja J2 porque el orquestador dio los tres de la familia (1455,
1456, 1457) a una sola sesión. La forma única (`cabeEnColumnaInt`) y el borde derivado del esquema están
en `docs/master/SCRUM-1456.md` (Ⓐ y Ⓑ).

A9: aviso → cicatriz J2 «otra hora a ojo en un mensaje al orquestador: puse ~13:50Z y GitHub, leído minutos después, decía 13:28Z; es la quinta línea de J2 con lo mismo» — no se pudo comprobar: el mensaje al orquestador sale por la herramienta de mensajes, que ningún hook del repositorio ve antes de enviar

## Ⓐ Las cuatro líneas, y por qué ninguna está tocada

| Línea (`origin/main` `8dcc6d2a`) | Qué hace con el id | Estado |
|---|---|---|
| `system/app/routes/supresion.routes.ts:34` | `prisma.merchant.findUnique`, detrás del flag `MERCHANT_DELETE_ENABLED` y de la comparación con `req.merchantId` | NO HECHO → al fundador (SCRUM-1456 c.18414: borrado de datos) |
| `billing/app/routes/stripe.routes.ts:97` | `prisma.merchant.update` (suscripción nueva) | NO HECHO → **decisión**, abajo |
| `stripe.routes.ts:139` | `prisma.merchant.update` (`customer.subscription.*`) | NO HECHO → **decisión**, abajo |
| `stripe.routes.ts:177` | `prisma.merchant.update` (`customer.subscription.deleted`) | NO HECHO → **decisión**, abajo |

**`supresion.routes.ts:34`, leído:** un `merchantId` enorme pasa la línea 34, pero la 46 lo compara con
`req.merchantId` ANTES de tocar la base y contesta 404. Como `req.merchantId` es un id que existe, un
valor que no cabe **no puede ser igual** y nunca llega al `findUnique`. O sea: en esa ruta el defecto
del ticket (llegar a la base) **no es alcanzable hoy ni con el flag encendido**; lo que cambiaría el
arreglo es el código de la respuesta, de 404 a 400. LEÍDO, no ejecutado.

## Ⓑ La decisión: la aceptación 3 no se puede cumplir con el arreglo que el ticket propone

La aceptación 3 dice: «un `merchant_id` que no cabe se ignora igual que hoy se ignora uno que no es
entero; **ninguna respuesta a Stripe cambia**». Las dos mitades no caben juntas. LEÍDO en
`stripe.routes.ts`:

- **Hoy**, con un `merchant_id` que no cabe: `prisma.merchant.update` lanza, el `catch` anota el fallo
  del evento y contesta **400**. Stripe reintenta.
- **Con `cabeEnColumnaInt` en esas líneas:** el bloque se salta, el evento se marca procesado y se
  contesta **200**. Stripe deja de reintentar.

Para el valor que no cabe, la respuesta a Stripe CAMBIA (400 → 200). Si se quiere «ignorar», cambia el
reintento; si se quiere «que nada cambie», no hay nada que arreglar en esas tres líneas. Cuál de las dos
es una decisión de un jefe sobre la fuente única de la FSM de la Parte L, no de la sesión.

El ticket ya avisa de que ese `merchant_id` lo escribimos nosotros en la `metadata`: un valor enorme no
lo pone un tercero. No ejecutado: pide fabricar un evento firmado de Stripe.

Subido al orquestador el 6-oct. Lo dejó escrito en SCRUM-1456 c.18414: esas tres **no se tocan**, y la
contradicción queda para quien la decida.

## Ⓒ Lo que queda sin hacer, dicho

Las cuatro líneas. **Este ticket no tiene nada construido en este PR:** lo que lleva es la medición
de por qué no se construye sin una decisión.

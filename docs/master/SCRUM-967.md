# SCRUM-967 · El cliente nunca recibía el enlace de su portal

## SCRUM-967b · la mitad sin Meta: el correo del presupuesto y la firma del parte

**Medido contra:** `origin/main` = `b950b04365813b976d06fa18e25d9b51b45c0d5f` · 2026-09-21T07:30:52Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-967b-enlace-del-portal`
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-967-enlace-del-portal.md` (firma delegada, SCRUM-967 comentario 16055).

### Paso 0: el defecto existía hoy

Ningún envío llevaba `/cliente/`: `sendQuoteEmail` solo enlazaba `/pay/quote/…` y las pantallas
de «gracias» del presupuesto y del parte no llevaban nada. El test nuevo lo confirmó **en rojo**
contra el código de `b950b043`: `① el envío del correo debía dejarle al cliente su token de portal`
(y su suelo, «el correo decodificado enseña `/pay/quote/`», pasó: el lector no estaba ciego).

### Alcance, y lo que se dejó fuera a propósito

| sitio | ¿va? | por qué |
|---|---|---|
| correo del presupuesto | **sí** (L1) | llega a un solo destinatario, el propio cliente |
| respuesta de `POST /albaran/:token/firmar` | **sí** (L3) | un solo uso, después de sellar, solo quien firma |
| correo del albarán | no | **no existe**: el albarán solo sale por WhatsApp, y crearlo sería un envío nuevo (J6, regla 28) |
| página «Ya aceptaste» del presupuesto | no | GET persistente: un presupuesto reenviado a un tercero le abriría el portal entero, para siempre. Riesgo no aceptado por el orquestador |
| `POST /quote/:token/decision` | no se toca | es el camino del cobro (lanza `payment_request`) |
| WhatsApp | no | texto de plantilla de Meta: STOP del fundador, va con SCRUM-975 |

### Lo que cambia

- `customerAdmin.ts` · `portalUrlDelCliente(merchantId, customerId)`: la URL en un sitio, con la
  misma forma que `GET /admin/customers/:id/portal-url`, sobre el `ensurePortalToken` que ya existía.
- `emailLayout.ts` · hueco opcional `bajoElBotonHtml`. Sin él, los demás correos salen idénticos.
- `email.service.ts` · L1 en el correo del presupuesto. Best-effort: si no hay token, no hay frase,
  y el presupuesto sale igual.
- `albaranPublic.routes.ts` · `portalUrl` en la respuesta de la primera firma (después de sellar,
  sin tocar nada sellado); la rama `already` no lo devuelve. En la pantalla, L3 con `textContent` y
  el enlace como atributo; el nombre del negocio va a un literal de JS con `<` escapado (lo escribe
  el profesional, y un `</script>` en él cerraría el bloque).

### El juez: `tests/scrum967b-el-portal-en-el-envio.test.mjs`

Gateado con los dos destinos de SCRUM-876 (staging o el banco desechable de CI). Medido aquí contra
un Postgres 16 propio en loopback (`yaqu_967b_test`, 30 tablas de 30 modelos, esquema por
`migrate diff --from-empty` con el binario local 6.18.0): **1 pass · 0 fail · 0 skipped**.

Mutaciones sobre el `dist` compilado, una a una, con la base en verde antes y después:

| mutación | cae con |
|---|---|
| M1 · la rama `already` devuelve `portalUrl` | ③ «un segundo POST sobre un parte YA firmado devuelve el portal» |
| M2 · la primera firma responde sin `portalUrl` | ② «la respuesta de la firma NO trae el enlace del portal de ESE cliente» |
| M3 · la página «Ya aceptaste» enlaza a `/cliente/` | ④ «la página del presupuesto accepted enlaza a un portal» |

**La pantalla, medida en Edge headless a 390 px** con una sonda de un solo uso (no versionada),
firmando con el ratón sobre el canvas y leyendo el DOM DESPUÉS de pulsar: `h1` «¡Parte firmado!»,
las dos líneas («Gracias, … WhatsApp.» y L3), botón «Abrir mi portal de cliente» de 308×52 con
`href` a `/cliente/<token de ESE cliente>`, y un negocio llamado `Fontanería <Pepe> & Hijos` pintado
como texto (0 `<script>` en la tarjeta).

**No medido:** staging.

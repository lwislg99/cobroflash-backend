# SCRUM-1202 — Se cierra la vía antigua de decisión del presupuesto (superficie pública sin autenticar)

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:16:32Z

Carril S1 · rama `scrum-1202-cerrar-accept-sin-firma` · sesiones s1-28a (construcción) y s1-28b (relevo por caída: recuperó el trabajo sin commit del disco, lo verificó y lo entregó).

## Qué había

`POST /quote/:token/accept` y `POST /quote/:token/reject`, públicas y sin autenticar, seguían vivas desde antes de SCRUM-95 sin que nadie las llamara: la landing decide por `POST /quote/:token/decision`. `/accept` marcaba el presupuesto `accepted` **sin trazo ni sello (SCRUM-805) ni caducidad**, y **reescribía `paymentTerms` y `evidence`** con lo que trajera el cuerpo. Cualquiera con el enlace del cliente podía aceptar sin firmar y cambiar las condiciones de cobro.

## Medición previa (PASO 0)

- `public/`: ninguna llamada a `/quote/:token/accept` ni `/reject` por ninguna vía. La única llamada a `/accept` era `admin.html` (consola interna), con el id NUMÉRICO: 404 siempre desde SCRUM-95. Los `/admin/quotes/:id/accept|reject` de `api.js` son otras rutas, autenticadas, y no se tocan.
- `acceptQuote` (`api.js`) sin llamador. `qq-send` de `homeView.js` es otro elemento del panel y no se toca.
- `AcceptQuoteSchema` / `RejectQuoteSchema`: sin otro uso.

## Qué cambia

- Retiradas las dos rutas, sus esquemas, `acceptQuote` y sus entradas en `PUBLIC_ACCESS_DECLARED`.
- `admin.html`: fuera el paso 2 muerto y los mandos `qq-method` / `qq-send` (solo alimentaban a `/accept`). Textos según la **firma del comentario 17328**: «Presupuesto #N creado.» / «Presupuesto #N creado para el cliente ID X.»; el intermedio queda en «Creando presupuesto…» y el de error no cambia.
- Censo SCRUM-1185: las 6 piezas pasan a `retiradas` con motivo.
- `scrum275` (respuestas sin `message`): 29 → 21, bajada declarada — se fueron 8 respuestas con las rutas, no se arregló ningún texto.
- `scrum910`: su control positivo leía la respuesta de `/accept`; se reescribe (retirada a propósito, explicada en la cabecera del test) para medir que la consola sigue creando por `/quote/create` y ya no llama a `/accept`.

- Censos de avisos (SCRUM-475/477): suelos 31 → 30 llamadas y 4 → 3 avisos al profesional, bajada declarada — se fue la llamada a `sendMerchantQuoteAcceptedEmail` que vivía en `/accept`.

## Hallazgo (no se arregla aquí)

La vía viva `/decision` **no** manda el correo «presupuesto aceptado» al profesional aunque tenga `notifyEmailOnQuoteAccepted` (solo el aviso por WhatsApp, `notifyMerchantAlert`). El único camino web que lo mandaba era la ruta muerta. El correo sigue saliendo cuando se acepta por el bot (`whatsappIncoming.routes.ts:506`). Cablearlo en `/decision` es un envío automático nuevo (regla 28): se pasa al orquestador.

## Pruebas

`tests/scrum1202-sin-accept-publico.test.mjs`: control positivo del router, las dos rutas ausentes, la declaración pública sin ellas, y la vía viva `/decision` rechazando una firma sin trazo (422) sin escribir.

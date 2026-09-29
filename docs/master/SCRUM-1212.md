# SCRUM-1212 — El correo «presupuesto aceptado» (punto 1: ocultar la frase fiscal)

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:40:14Z

Carril S1 · sesión s1-28b · rama `scrum-1212-sin-emitir-factura-en-recibo`. La medición completa del ticket está en el comentario 17338 de Jira.

## Qué se construye (decisión del orquestador, 28-sep)

`sendMerchantQuoteAcceptedEmail` (`src/modules/messaging/domain/merchantNotifications.ts`) decía «Ya puedes emitir la factura.» a todos los profesionales. Con `INVOICING_ES_ENABLED` en OFF, un merchant ES real no puede emitir factura por YaQu (regla 24): era una afirmación fiscal falsa que llegaba a su bandeja.

- La frase **se oculta, no se reescribe** (patrón de SCRUM-1160): no hay texto nuevo ni firma nueva.
- Criterio: la frase solo sale en modo `fiscal` o `demo`, con el modo leído de la fuente única `modoEmisionVisible` → `getEmissionMode`. Es el mismo criterio y el mismo fallo cerrado que `facturaFiscalDisponible()` en el panel (SCRUM-905): con el modo desconocido, no sale.
- El parámetro `modoEmision` es **obligatorio**: el compilador obliga a cualquier llamador futuro a decidirlo.
- Único llamador vivo: el bot (`whatsappIncoming.routes.ts`). Ahora selecciona también `id`, `country` y `flags` del merchant y pasa el modo.

## Lo que NO se hace aquí

- «El cliente ha firmado digitalmente» sigue en el correo, pero **no es cierto en el único camino que lo manda**: el bot acepta por texto, sin trazo. Está en el punto 2: medir qué sabe cada camino, y después firmar textos.
- El texto del ajuste en Configuración («…desde su portal») no se toca (punto 3, va con lo anterior).
- No se manda el correo desde `/decision`: es un envío nuevo, J6 no lo cubre y lo decide el fundador.
- El demo conserva la frase, igual que el panel le ofrece facturar (factura con marca de agua).

## Pruebas

`tests/scrum1212-correo-aceptado-sin-emitir-factura.test.mjs`. El test recorre merchant → `modoEmisionVisible` (real) → correo (real) → HTML, con solo el emisor `enviarCorreo` doblado, sin red. **Rojo medido contra el `dist` anterior:** fallaban 2 de 4 (ES sin flag y modo desconocido), y los dos controles positivos (fiscal y demo) pasaban. Verde después. Tests relacionados: 136 pasan, 2 saltados (staging).

## Apéndice 28-sep-2026 · firma 1 (c.17355): «El cliente ha aceptado el presupuesto.»

Rama `scrum-1212b-correo-ha-aceptado`, medido sobre `origin/main` `a59dc1e6`.

- El correo decía «El cliente ha firmado digitalmente el presupuesto.», y el único camino que lo manda (el bot, que acepta por texto) nunca trae firma. Queda el texto firmado. **Uno solo**: la variante «ha firmado» se descartó porque sería una rama muerta.
- **El cinturón** (`tests/scrum1212b-correo-aceptado-sin-firma.test.mjs`): por AST sobre `src/`, ningún camino que llame a `sendMerchantQuoteAcceptedEmail` puede conocer `signatureUrl` ni `signatureData`. Tiene un control positivo: el mismo detector ve la firma en el handler de `/decision`. **Mutación comprobada:** al meter una llamada al emisor dentro de `/decision`, el test cae y nombra `quotes.routes.ts:330`. El fichero se restauró después.
- **La firma 2 (el texto del ajuste en Configuración, `settingsView.js:664`) NO se hace aquí:** es del carril J, decidido por el orquestador sin excepción. Su condición de verdad está medida y se cumple: el correo solo sale por el bot, porque `/accept` se retiró en SCRUM-1202 y era el único otro llamador.
- Tests relacionados: 107 pasan y 2 saltados (staging).

## Apéndice 29-sep-2026 · el texto del ajuste en Configuración (firma 2), y por qué la web NO manda el correo

Sesión J3 (jv-j3), rama `scrum-1212-correo-aceptado-web`, medido sobre `origin/main` `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T15:36Z.

**Decisión (Javier, 29-sep, c.17558, que corrige c.17557): «Nos alineamos».** Se mantiene la firma de Luis del 28-sep (c.17355): **no se conecta ningún correo nuevo**. El correo «presupuesto aceptado» sigue saliendo **solo por el bot**; `POST /quote/:token/decision` no lo manda. No se abre fila en §J6.

### Qué se construye

- **`public/dashboard/js/settingsView.js:670`**, el texto de ayuda del ajuste `notifyEmailOnQuoteAccepted`.
    - Antes: «Te notificamos cuando el cliente firma y acepta desde su portal.». Era falso: el único camino que manda el correo es el bot, que acepta por texto, sin portal y sin firma.
    - Ahora: «Te avisamos por correo cuando un cliente acepte un presupuesto desde WhatsApp.», el texto firmado por Luis en c.17355.
    - Es la «firma 2» que el apéndice anterior dejó al carril J (`dos-equipos.md:135`).
- **`tests/scrum1212c-ajuste-correo-aceptado-desde-whatsapp.test.mjs`** protege las dos cosas:
    - (1) el ajuste dice el texto firmado, y no «desde su portal» ni «firma y acepta»;
    - (2) 🔴 **la condición que lo hace verdad**: por AST sobre `src/`, el único fichero que LLAMA a `sendMerchantQuoteAcceptedEmail` es el del bot (`whatsappIncoming.routes.ts`). Tiene control positivo: si el detector no ve la llamada del bot, cae como CIEGO en vez de dar por bueno un vacío. Si alguien engancha el correo en otro camino, el ajuste pasaría a mentir y se estaría deshaciendo c.17558.
- `tests/scrum1212b-correo-aceptado-sin-firma.test.mjs` **no se toca** y sigue verde.

### Lo que NO se hace (retirado el 29-sep con c.17558)

- No se manda el correo desde `/decision`, **no se toca `quotes.routes.ts`** (tampoco el handler que emite y sella, C1) y no se toca el cinturón `scrum1212b`.
- La ① (regla 28) queda resuelta por la firma de Luis.
- La ocultación de la frase por `/decision` y la allowlist del cinturón se decidieron en un primer momento y **se retiraron**: sin correo por la web, no tienen objeto.

### Material medido (no es una decisión, pero explica la que se tomó)

- **Por qué «el mismo correo por la web y por el bot» no se podía construir sin mentir.**
    - El correo acaba en «Ya puedes emitir la factura.» cuando el merchant está en modo `fiscal` o `demo` (`merchantNotifications.ts:135`).
    - Por el bot es verdad: aceptar por WhatsApp no emite nada.
    - Por `/decision` es **falsa**: esa ruta **ya emite y sella** la factura (C1) siempre que quede un tramo por emitir y el modo no sea `receipt`. Le diría «ya puedes emitir» de una factura que ya está emitida.
    - Si algún día se reabre conectar la web, esto va primero.
- **«Ha aceptado» vale también cuando el cliente firmó.** Firmar es aceptar, y en `/decision` la firma es opcional.
- **La tabla anti-spam no está en `docs/equipo/puesto-j6.md`.** Su línea 15 lo dice: ese «J6» es un puesto del equipo. La política es §J6 del máster (`YAQU_MASTER.md:319`): una sola línea sobre WhatsApp a clientes finales, que no nombra correos al profesional.
- **El conflicto que hubo**, para que no se lea al revés. Entre ~15:30Z y la decisión, la ① estuvo en conflicto: el «Sí cubre» de Javier (recogido en c.17557) contra la firma de Luis del 28-sep (c.17355). El orquestador había firmado por delegación otro texto para el ajuste, sin «desde WhatsApp», sin comprobar que la ranura ya estaba firmada por el otro equipo. Lo retiró él mismo.
- **SCRUM-1202 no causa el defecto ni lo empeora.** `/accept` ya estaba muerta desde SCRUM-95, así que el correo no salía por la web antes de tocar nada; 1202 solo lo destapa.

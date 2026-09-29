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

## Apéndice 29-sep-2026 · el correo también por la web (`/decision`): decisiones ② y ③, y lo que falta

Sesión J3 (jv-j3), rama `scrum-1212-correo-aceptado-web`, medido sobre `origin/main` `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T15:27Z. **Aquí no hay código todavía.** Este apéndice deja escritas las decisiones ya tomadas y el plan, para que no se pierdan salga lo que salga de las dos que siguen abiertas.

**El defecto.** El profesional marca «avísame por correo cuando acepten un presupuesto» (`notifyEmailOnQuoteAccepted`) y el correo sale o no según por dónde acepte su cliente. Por el bot (`whatsappIncoming.routes.ts`) sale; por `POST /quote/:token/decision`, la vía viva de la web, no sale y la ruta ni mira el ajuste. SCRUM-1202 **no lo causa**: `/accept` ya estaba muerta desde SCRUM-95, y 1202 solo lo destapa. Decisión del fundador (29-sep): «Pasa el correo».

### ② El texto: por `/decision` se OCULTA «Ya puedes emitir la factura.» (aprobado por el orquestador, 29-sep)

- **Lo medido.** El correo (`merchantNotifications.ts:135`) dice «El cliente ha aceptado el presupuesto. Ya puedes emitir la factura.»; la segunda frase sale en modo `fiscal` o `demo`.
    - Por el bot es verdad: aceptar por WhatsApp no emite nada.
    - Por `/decision` es **falsa**: esa ruta **ya emite y sella** la factura (C1) siempre que quede tramo y el modo no sea `receipt`. Le diríamos «ya puedes emitir» de una factura ya emitida.
- **Por tanto, el encargo original («el MISMO correo por los dos caminos») era imposible de cumplir sin mentir.**
- **Decidido:** por `/decision` la frase se oculta cuando la aceptación ha emitido factura, **y también cuando la emisión falla** (`facturaPendiente`): sería media verdad, y en un correo automático se prefiere decir de menos.
- Patrón de SCRUM-1160: se oculta, no se reescribe. **No hay texto nuevo** → no hace falta firma del fundador. Lo que queda, «El cliente ha aceptado el presupuesto.», es verdad por los dos caminos.

### ③ El cinturón `scrum1212b` evoluciona a allowlist (aprobado por el orquestador, 29-sep, con tres condiciones)

- **Por qué hay que tocarlo.** Enchufar `/decision` lo pone **rojo por construcción**: ese handler conoce la firma de verdad (`signatureData`), y arreglar el código no lo apaga. El propio guard pide lo que se ha hecho: «decide el texto con el orquestador antes de enchufarlo».
- **Decidido:** «ha aceptado» es válido **también** cuando el cliente firmó. Firmar es aceptar, y en `/decision` la firma es opcional; «ha firmado» sería falso para quien acepta sin firmar.
- **Condiciones, no negociables:**
    1. `/decision` va declarado en la allowlist **con su motivo escrito**, citando esta decisión y el ②.
    2. **Mutación con el código quieto, después de commitear:** una llamada al emisor en un camino que conoce la firma y **no** está declarado tiene que poner el guard rojo y nombrarlo. Si no cae, la allowlist ha apagado el guard y no vale.
    3. **Lo que protegía sigue protegido:** la llamada al emisor no puede **pasarle** `signatureUrl` ni `signatureData`. Se declara que `/decision` puede llamarlo, no que pueda pasarle la firma.
- **Plan de la mutación** (se declara cuando el código esté quieto): (i) un camino no declarado que conoce la firma y llama al emisor → rojo, nombrando `fichero:línea`; (ii) en `/decision`, pasar `signatureData` dentro de los argumentos del emisor → rojo por la condición 3. En los dos casos: restaurar y `git status` limpio después.

### Lo que sigue ABIERTO (sube al fundador; no se empieza nada)

- **① Regla 28.** §J6 del máster (`YAQU_MASTER.md:319`) es una sola línea sobre WhatsApp a clientes finales; no nombra correos al profesional. Este registro ya decía que mandarlo desde `/decision` es «un envío nuevo, J6 no lo cubre y lo decide el fundador». Queda por decidir si «Pasa el correo» basta o si hace falta una entrada en §J6, que sería cambio de máster. (Nota: la tabla **no** está en `docs/equipo/puesto-j6.md`: su línea 15 dice que ese «J6» es otra cosa.)
- **(b) Reglas 38 y 40.** La llamada va **dentro** del handler que sella facturas (C1). No modifica la emisión, pero **añade un efecto en ese handler**, y es STOP hasta que decida el fundador.
    - Si sale adelante: la llamada va **después del sellado**, sin `await` que bloquee y con su propio `catch`.
    - Y lleva un test que lo pruebe: el correo revienta y la factura queda sellada igual.
- **(a) El texto del ajuste en Configuración** (`settingsView.js`, «…cuando el cliente firma y acepta desde su portal»). Hoy ya es falso, porque solo avisa el bot, que no tiene ni portal ni firma. El orquestador lo firmará cuando estén decididos ① y (b), porque el texto correcto depende de ellos.
- **Pruebas exigidas cuando se construya:** con el ajuste en ON y aceptación por la web, **sale**; con el ajuste en **OFF**, **no sale**; y web y bot mandan el mismo correo en todo salvo la frase del ②.

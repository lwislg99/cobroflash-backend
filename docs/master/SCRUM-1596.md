# SCRUM-1596 · Los dos llamadores de J2 que mandan plantilla sin cliente: quién los llama, a quién van y si salen hoy con el tope del cliente lleno — medido, sin arreglar nada

**Medido contra:** `origin/main` = `e306a6a5e5b45a2e98792d30eee02fdec5ea2362` · 2026-10-23T16:00:55Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1596/medir.mjs`

J2 (sesión `jv-j2an`, equipo de Javier), por encargo del orquestador `cobroflash-backend-62`. **Es EJECUCIÓN y LECTURA:**
no se ha tocado ningún fichero de `src/`, test, plantilla, texto ni workflow, ni `reminder.service.ts` (S1). Entran este
registro y `docs/master/evidencias/SCRUM-1596/` (sonda y sus tres salidas). Nada contra producción ni staging: base doblada
en memoria y transporte doblado; no sale un byte. `dist` con `tsc --noCheck` del mismo `e306a6a5e`; no se corrió
`prisma generate`. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió porque el encargo es medir.

## 0 · PASO 0

Sin commits `SCRUM-1596` en `main` (el `--grep=1596` sólo casa con el PR #1596, de otro ticket), sin rama `scrum-1596*` en el
remoto y sin `docs/master/SCRUM-1596.md`. Lo que 1509d midió el 8-oct (c.18907, c.18914) se ha **vuelto a ejecutar hoy**,
después de 1513 (la reserva), 1509g (fail-closed), 1509h (20 entrantes por hora) y 1509k (#2753).

**De paso: los dos guiones de 1509d ya no miden.** `evidencias/SCRUM-1509d/medir.cjs` y `avisos.cjs`, corridos sobre el
`dist` de hoy, salen **MUDOS (código 2)**: su base en memoria no modela la transacción de `reservarPlantilla` (SCRUM-1513),
toda plantilla cae en `tope_no_comprobable` (1509g) y cuentan 0. Sus positivos lo cazan, así que no dan un verde falso. Son
la foto del 8-oct, no un test; no los he tocado.

## 1 · Lo medido, por llamador

Tope por cliente leído en `dist`: **3**; tope de comercio: **100** (por día del comercio).

### `sendPaymentConfirmation` (`src/integrations/whatsappNotifications.ts:21`, carril J2)

| pregunta | medido |
|---|---|
| ¿Quién la llama? | **Nadie.** AST sobre 2.411 ficheros de `src/`, `tests/`, `scripts/` y `public/`: 1 declaración, **0 llamadas**, 0 imports, 0 referencias. Ya declarada sin consumir en `scripts/_sin-consumir-declarados.json:40` (SCRUM-1185) |
| ¿A quién va, y con qué plantilla? | Al **cliente final**, `payment_confirmation_es` (leído en la petición doblada, B0). Su firma no recibe cliente: no tiene qué pasar |
| ¿Sale hoy con el tope del cliente lleno? | **En el producto, 0: no hay camino que la ejecute.** Ejecutada a mano: **sí sale** (B1), la pregunta del tope por cliente se hace 0 veces y la fila queda sin cliente. 5 veces seguidas al mismo cliente: salen 5 (B3) |
| Control: tope libre | sale 1 (B0) |
| POSITIVO: su hermana `sendPaymentConfirmationInvoice`, que sí pasa cliente, con el mismo cliente lleno | **bloqueada**, preguntada por el cliente 701 (B2) |
| ¿Otro tope la frena? | **El de comercio, sí:** con 100 plantillas hoy, bloqueada `daily_cap` (B4). Por número o por hora: **no hay** ninguno en el camino de plantillas (`reservarPlantilla` cuenta por comercio y por `customerId`, no por teléfono) — leído en el código y coherente con B3 |

### `notifyMerchantAlert` (`src/integrations/whatsappNotifications.ts:151`, carril J2)

| pregunta | medido |
|---|---|
| ¿Quién la llama? | **9 llamadas** por AST: 8 sitios (`payBizum.routes.ts:198`, `disputes.service.ts:183`, `quotes.routes.ts:785`, `whatsappIncoming.routes.ts:306` y `:418`, `botFlow.service.ts:495`, `:637` y `:695`) + el atajo `notifyMerchantPaid` (`:195`), que a su vez tiene **2** llamadas (`psp.routes.ts`, `mpWebhook.routes.ts`). Fuera de `src/`, sólo referencias en 5 tests |
| ¿A quién va, y con qué plantilla? | Al **PROFESIONAL** (el `whatsappPhone` del comercio). Primero texto libre; si la ventana de 24 h del profesional está cerrada, `merchant_alert_es` (C0). Con la ventana abierta, 0 plantillas (C2) |
| ¿Sale hoy con el tope del cliente lleno? | **Sí** — por la ruta real `POST /pay/bizum/:token/claimed` de la app entera: el cliente que paga tiene 3 plantillas hoy y el aviso sale igual (C1); la fila del aviso queda con `customerId = null` y la pregunta por cliente se hace 0 veces |
| Control: tope libre | sale 1 plantilla al profesional y 0 al cliente (C0) |
| ¿Otro tope lo frena? | **El de comercio, sí, y COMPARTE cupo con los clientes:** con 100 hoy, el aviso no sale (C4: el texto falla por ventana y la plantilla cae en `daily_cap`); con 99, el aviso se lleva la última y la plantilla siguiente a un cliente ya no sale (C5). **Por sitio:** «ya he pagado» 5 veces sobre el mismo cobro da 1 aviso (C3, el evento `bizum_claimed`). **Por número y hora:** el límite de 20 entrantes por número y hora (1509h) frena a los avisos que nacen de un mensaje del cliente (`whatsappIncoming` y el bot): su test, corrido hoy, 8 de 8 (120 textos de un número → 20 avisos) |

## 2 · Opciones para el fundador — ninguna elegida (regla 28)

**`sendPaymentConfirmation`**

| opción | qué cambia | coste |
|---|---|---|
| A · Retirarla | borrar el export muerto y su entrada en `_sin-consumir-declarados.json` | cambio de código de J2 y una línea de `docs/WHATSAPP_TEMPLATES.md:204`, que la nombra como helper; ningún envío cambia hoy (salen 0). La plantilla de Meta no se toca |
| B · Pasarle el cliente | añadir `customerId` a la firma y mandarlo en `log`, como su hermana | protege un camino que hoy no envía nada; un test nuevo; si nadie la llama, es código que se mantiene sin uso |
| C · Nada | queda como está | hoy 0 envíos; si alguien la vuelve a llamar, sale sin tope por cliente (B1, B3) y sólo el de comercio la frena |

**`notifyMerchantAlert`**

| opción | qué cambia | coste |
|---|---|---|
| A · Contarlo en el tope del cliente que lo provoca | pasar el `customerId` del cliente causante | **el profesional dejaría de enterarse** de un pago o una decisión si ese cliente ya recibió 3 plantillas hoy (C1 pasaría de 1 a 0); mezcla dos destinatarios en un contador; 9 sitios que tocar, varios de otros ficheros |
| B · Un tope propio para los avisos al profesional (por comercio y día) | un contador aparte, p. ej. por `merchant_alert_es`, con un número que decide el fundador | decidir el número y qué pasa con el aviso que no cabe (se pierde); cambio en `whatsapp.ts`/`whatsappLog.service.ts` (J2); sin esquema si se cuenta por nombre de plantilla (leído, no probado). Opcionalmente sacar los avisos del cupo de 100 de los clientes, que es el daño medido en C5 |
| C · Ninguno nuevo | quedan los frenos de hoy: ventana primero (texto gratis), 1 por cobro/disputa/decisión, 20 entrantes por número y hora, y el cupo de comercio de 100 | un cliente que escribe puede provocar hasta 20 avisos por hora como plantilla si la ventana del profesional está cerrada, y esos avisos se comen el cupo de los clientes del comercio (C5). La cuenta «20 por hora llena 100 en 5 horas» es aritmética mía, no medida |

## 3 · El instrumento y sus controles

`medir.mjs` (16 casos, 16 cuadran; `salida.txt`). Censo por AST con el compilador de TypeScript (identificador EXACTO: un
prefijo no casa). B ejecuta la función de `dist`; C carga `dist/app.js` entero con el banco de la casa
(`tests/_banco-camino-real.mjs`) y pide la ruta por HTTP. El transporte se dobla en el adaptador de axios y rechaza el texto
al profesional con el código de fuera de ventana mientras su ventana está «cerrada». El registro de mensajes del doble cuenta
como `reservarPlantilla`: plantillas enviadas o en cola, por comercio, y por cliente sólo si la pregunta lo lleva.

| control | esperado | salió |
|---|---|---|
| SEMBRADO en memoria: 2 llamadas, más un prefijo y un comentario | 2 llamadas, 4 identificadores | 2 y 4 |
| sin el sembrado (`--sin-sembrado`) | CIEGO, código 2 | código 2 (`salida-ciego-sin-sembrado.txt`) |
| CERO: un nombre que no existe | 0 | 0 |
| POSITIVO del tope por cliente: la hermana con cliente | bloqueada | bloqueada (B2) |
| POSITIVO del camino real: el aviso se produce | 1 plantilla al profesional | 1 (C0) |
| CERO de plantillas: ventana del profesional abierta | 0 | 0 (C2) |
| un esperado roto a propósito (`--esperado-roto`) | ROJO, código 1 | código 1, 1 caso (`salida-rojo-esperado-roto.txt`) |
| los casos que cuadran más los que no | 16 | 16 + 0 |

## 4 · Lo que NO se midió

- **Postgres real**: la base es un doble. La transacción y el cerrojo de la reserva no se ejercitan de verdad.
- Los avisos de los demás sitios **por su camino**: sólo se ejecutó Bizum. Los del webhook de entrantes los mide el test de
  1509h (con dry-run: cuenta avisos, no plantillas). Disputas, presupuesto aceptado, bot y los dos webhooks de pago: leídos.
- Cuántos profesionales tienen la ventana cerrada, y cuántos avisos al día hay de verdad: no hay comercios con clientes reales.
- yaqu.app: no se ha intentado (haría falta un envío real, que el encargo prohíbe).
- Que el límite de 1509h es por proceso: con más de una instancia, cada una contaría lo suyo (lo dice 1509h; no medido aquí).

## 5 · Errores propios

- El esperado de A3 lo escribí de memoria con la cuenta de 1509d («10 sitios + el atajo» = 11) y la sonda salió roja: hoy son
  9 llamadas directas porque los dos webhooks de pago van por `notifyMerchantPaid`. Cambié el esperado a 9 DESPUÉS de ver la
  salida, así que ese número no es un control previo: lo sostiene la lista sitio por sitio de `salida.txt`, y añadí el atajo
  al censo (A4, 2 llamadas) para que esos dos sitios no se pierdan.

Reproducir: `tsc --noCheck` y `node docs/master/evidencias/SCRUM-1596/medir.mjs` (rojo a propósito: `--esperado-roto`;
ciego: `--sin-sembrado`).

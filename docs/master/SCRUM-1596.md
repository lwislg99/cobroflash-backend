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


# SCRUM-1596b · Se retira `sendPaymentConfirmation`, y los avisos al profesional tienen su tope de 30 y salen del cupo de 100

**Medido contra:** `origin/main` = `c81f07621b6e21204722d42d3021e36965382949` · 2026-10-23T16:42:55Z (hora de GitHub al escribir: 2026-10-23T16:43:43Z)
A9: comprobación → `tests/scrum1596b-tope-de-avisos-al-profesional.test.mjs`

Sesión `jv-j2aq` (puesto J2, equipo de Javier), por encargo del orquestador `cobroflash-backend-62`. Construye la decisión del
fundador de SCRUM-1596 c.20602 sobre las opciones de c.20601 (tramo de arriba). Carriles, con `node scripts/carriles.mjs de …`:
`whatsappNotifications.ts`, `whatsapp.ts` y `whatsappLog.service.ts` (el contador y `reservarPlantilla`) → J2;
`scripts/_sin-consumir-declarados.json` → S0 contenedor (cada puesto retira o declara SU pieza, `dos-equipos.md:178`);
`docs/WHATSAPP_TEMPLATES.md` → sin fila. Ningún texto que vea el usuario, ninguna plantilla de Meta, sin esquema, ningún envío
nuevo (regla 28). `dist` con `tsc --noCheck`; no se corrió `prisma generate`. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498).

## ① `sendPaymentConfirmation`, retirada

- Se borra el export de `src/integrations/whatsappNotifications.ts` y su import de `buildPaymentConfirmation`.
- `scripts/_sin-consumir-declarados.json`: sale de `declaradas` y entra en `retiradas`, con su motivo.
- `docs/WHATSAPP_TEMPLATES.md` §3: la línea del helper. **De paso**, las otras dos líneas de «Código que lo envía» también
  eran falsas: `psp.routes.ts` y `mpWebhook.routes.ts` mandan la §4 (`sendPaymentConfirmationInvoice`), no ésta. Ahora la
  sección dice que no la envía ningún código.
- **Ningún envío cambia.** Censo por AST de cada llamada a un sender de WhatsApp en los 334 `.ts` de `src/`
  (`docs/master/evidencias/SCRUM-1596/envios-1596b.mjs`): antes 56, después 55. La diferencia es UNA línea,
  `whatsappNotifications.ts · sendPaymentConfirmation → sendWhatsAppTemplate`, la de la función con 0 llamadores (c.20601 A2).
  Salidas: `salida-envios-antes-1596b.txt` (`--ref` del commit anterior) y `salida-envios-despues-1596b.txt`. Control
  sembrado: 1 llamada, más un comentario y una cadena que no lo son; sin el sembrado sale CIEGO, con código 2
  (`salida-envios-ciego-1596b.txt`).
- `buildPaymentConfirmation` se queda sin llamadores en `src/`: lo cazó scrum1185. Lo usan `scripts/wa-prueba.mjs`,
  `tests/whatsappTemplates.test.mjs` y `tests/scrum931-…`, y la plantilla sigue existiendo en Meta. **Se declara** en la
  lista, con carril J2 y ticket SCRUM-1596. No se retira, porque el GO no lo cubre.

## ② El tope de los avisos al profesional

En `reservarPlantilla` (`whatsappLog.service.ts`), dentro del mismo cerrojo de comercio de SCRUM-1513:

- **Si es `merchant_alert_es`** (`WA_TEMPLATES.merchantAlert`), sólo se cuentan los avisos de hoy de ese comercio contra
  `TOPE_AVISOS_AL_PROFESIONAL = 30`. No se pregunta el cupo de comercio ni el del cliente: el aviso va sin cliente.
- **Si es otra plantilla**, el cupo de 100 y el de 3 por cliente cuentan como antes, pero **sin los avisos**. El filtro es
  `AND: [{ OR: [{ templateName: null }, { templateName: { not: … } }] }]`: un `{ not }` a secas, en SQL, dejaría fuera también
  las filas sin nombre (`NULL <> x` no es verdad).
- **El aviso que no cabe** devuelve `daily_cap`. `whatsapp.ts` lo anota igual que hoy (fila `failed`, error `daily_cap`).
  El log de Railway dice el tope que le tocó: la reserva devuelve ahora `tope` al lado de `cuenta`.
- **Lo que no cambia:** el texto con la ventana abierta no pasa por la reserva (sigue gastando 0); el freno de 1 aviso por
  cobro y el de 20 entrantes por número y hora (1509h) están en sus rutas y no se tocan.
- El 30 vive en `whatsappLog.service.ts` y no en `env.ts`, que es de S1 (`src/core/**`).

**Test:** `tests/scrum1596b-tope-de-avisos-al-profesional.test.mjs`, 9 casos. Va por la ruta REAL: la app entera de
`dist/app.js` (`_banco-camino-real.mjs`), `POST /pay/bizum/:token/claimed` por HTTP, y WhatsApp por el dry-run de la casa.
Lo único que se dobla de WhatsApp es la respuesta al texto al profesional («fuera de ventana»), porque el dry-run da por bueno
cualquier texto. No se usó el transporte bloqueado de SCRUM-180: una petición bloqueada devuelve el hueco a la reserva, y con
eso el caso C5 no puede caer nunca. El registro de mensajes del doble evalúa el `where` que le piden, con la semántica SQL
de `NULL`. Lo que no sabe evaluar lo apunta, y el caso cae.

- el 31.º aviso no sale y queda `daily_cap`; el 30.º sale;
- **el C5 de c.20601, al revés:** con 99 plantillas a clientes, el aviso sale Y la siguiente al cliente también;
- con las 100 de los clientes gastadas, el aviso sale;
- controles: el cupo de 100 sigue igual para los clientes (con 100, la siguiente no sale; con 99 más 30 avisos, sale); el de
  3 por cliente, igual; y las filas sin nombre siguen contando;
- cero: con la ventana del profesional abierta va por texto, 0 plantillas, aunque el tope de avisos esté lleno.

**Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN` del test, que corre el meta-guard; `--solo-censo` las ve: 4 sobre
`whatsappLog.service.ts`). Antes de pasarlas al catálogo las medí a mano sobre `dist`: base 9 de 9, y las cuatro mueren.

| mutante | caen |
|---|---|
| M1 · como antes (el aviso entra por el cupo de comercio) | 4: el 31.º, el C5, el cupo lleno y el control del cupo |
| M2 · el cupo de comercio sigue contando los avisos | 2: el C5 y el control del cupo |
| M3 · `{ not }` a secas | 1: las filas sin nombre |
| M4 · el borde (`>` en vez de `>=`) | 1: el 31.º |

En todos, los que caen más los que pasan suman 9 de 9. El meta-guard entero NO lo corrí en local: lo corre el CI.

**Tests de otros que cambian, sin aflojar nada:** `scrum1513d` compara la reserva bloqueada con `deepEqual`, y ahora lleva
también `tope`. El doble de `scrum1522b` aprende a evaluar `AND`; sin eso no lo sabía evaluar y cortaba el caso.

## Lo que queda para quien decida

- **El «Hoy: N plantillas» del panel** (`getWhatsAppMetrics`, SCRUM-1522) sigue contando TODAS las plantillas del día,
  avisos incluidos: es lo que cuestan. Desde aquí puede decir más de lo que cuenta el cupo. Nunca dice menos, así que no
  vuelve el «parece que quedan y no sale» de c.19157. No lo he cambiado porque el GO no habla de la pantalla.
- `docs/master/evidencias/SCRUM-1596/medir.mjs` (1596a) ya no corre entero: su parte B llama a la función retirada. Es la
  foto del tramo de arriba y no se toca.

## No medido

- PostgreSQL real: que Prisma traduce el filtro como lo evalúa el doble está leído, no ejecutado. Por eso el filtro lleva
  los dos lados explícitos.
- Los otros 8 sitios que llaman al aviso: todos pasan por el mismo `sendWhatsAppTemplate`, pero sólo he ejecutado Bizum.
- yaqu.app: no lo he intentado, porque haría falta un envío real.

## Errores propios

- Mi primer guion de mutaciones (`mutar-1596b.mjs`, retirado) salía con `process.exit` DENTRO del `try`, así que se saltaba
  el `finally` que restaura. Salió CIEGO en M4 y **dejó el mutante M3 escrito en `dist`**. Lo vi al buscarlo en el fichero
  después; recompilé y comprobé byte a byte. Ese banco suelto, además, lo tumbaba scrum1387: el sitio es el catálogo del test.
- No preví que, al quitar la función, `buildPaymentConfirmation` se quedaba sin consumir. Lo cazó scrum1185 en la muestra local.

Reproducir: `tsc --noCheck`; `node --test tests/scrum1596b-tope-de-avisos-al-profesional.test.mjs`;
`node docs/master/evidencias/SCRUM-1596/envios-1596b.mjs [--ref <commit>] [--sin-sembrado]`.

## Lo corrido

- 37 ficheros: los guards de suite (237, 976, 824, 824b, 836, 419, 702, 700, 719, 113, 262), los de registro (267, 273, 1294,
  921c, 1572, 124, 180, 850, 850b) y los vecinos (1415, 1185, 1387, 1513d, 1522b, 1509g, 1509h, 1509k, 529, 1177, 747,
  `whatsappTemplates`, 931 y el nuevo). Resultado: 334 casos, 334 pasan, 0 caen, 0 saltados.
- **Suite entera local: NO CORRIDA.** La lancé una vez y la cortó mi `timeout` a los 590 s, sin veredicto. Después el
  orquestador ordenó no correrla: hoy el arnés la mata por memoria. Hace de suite el obligatorio.

## Tras el primer empujón

El obligatorio de `aeb6052edf25fb7dc6433160db38cc76da24c8cf` (PR #2760) salió ROJO: 12.384 casos, de los que 3 caen, y los
3 son míos. scrum411 (2 casos): `TOPE_AVISOS_AL_PROFESIONAL` estaba exportado y sólo lo usaba el test, así que deja de
exportarse y el test fija el 30 por el borde. scrum737: un comentario del test afirmaba un recuento sin ancla, y se
reformula. Ninguno de los dos guards estaba en mi muestra local de 37 ficheros. Con ellos dentro: 81 de 81. «guards de
navegador» (no obligatorio) también cae, con los dos `INPUT.input` de 35 px, igual que en `main` @ `7083e0ddc`, y mi diff
no toca `public/`.

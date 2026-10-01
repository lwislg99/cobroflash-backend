# SCRUM-1262 · La baja de WhatsApp corta las ocho vías, y falla cerrada

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:44:19+01:00

1-oct-2026 · **J2** (equipo de Javier). Encargo del orquestador. Regla 28 y J3 del máster.

## PASO 0 — la premisa, re-medida

El ticket decía «2 de los 8 envíos» y «el corte que existe no bloquea si falla la consulta». Las
dos cosas siguen siendo ciertas sobre esta base, pero **«seis vías abiertas» no era el tamaño del
agujero**. Medido leyendo y después ejecutando:

| | Cuántos | Qué |
| --- | --- | --- |
| Senders en `src/integrations/whatsapp.ts` | 8 | `Template`, `WindowFirst`, `Text`, `Buttons`, `List`, `CtaUrl`, `Document`, `LocationRequest` |
| Con corte de la baja | 2 | `Template` y `WindowFirst` |
| Llamadas a las 6 vías sin corte, fuera de `whatsapp.ts` | 48 | `Text` 37 · `CtaUrl` 5 · `Buttons` 3 · `List` 2 · `LocationRequest` 1 · `Document` 0 |
| …que escriben a un CLIENTE por iniciativa nuestra | **4** | el agujero real (abajo) |
| …que son avisos al PROFESIONAL | 8 | `notifyMerchantAlert` ×2, mantenimiento ×2, aprobación de presupuesto, solicitud del portal, y dos del bot |
| …que son la respuesta del bot a quien acaba de escribir | 36 | `botFlow.service.ts` y `whatsappIncoming.routes.ts`; 31 llevan merchant y 5 van sin él |

**`sendWhatsAppDocument` es un sender muerto**: no tiene ni un llamador. Contarlo como «vía
abierta» inflaba el número.

Las 4 que escribían a un cliente dado de baja:

1. `invoicesAdmin.routes.ts`, «Recordar pago» manual, rama de texto (factura sin cobro). Sin ninguna
   comprobación.
2. `psp.routes.ts`, la petición de reseña de Google tras pagar. Sin comprobación.
3. `mpWebhook.routes.ts`, la misma petición por Mercado Pago. Sin comprobación.
4. `invoiceReminder.service.ts`, el recordatorio del cron en su rama de texto. **Parcial, no
   ausente:** su consulta filtra `waOptOut: false` por FICHA, y la baja es por NÚMERO. Dos fichas
   con el mismo número, una de baja, y el recordatorio salía.

Los otros dos puntos del ticket:

- **`params.merchantId &&` en `Template`.** El único llamador que puede omitirlo es
  `sendPaymentConfirmation`, que no tiene llamadores. La baja se guarda por merchant: sin él no
  hay contra qué preguntarla.
- **La confirmación de la propia baja** («Hecho ✅…») sale con `sinMerchant: 'multi-merchant'`,
  DESPUÉS de marcarla. Un corte ciego la habría matado: el cliente se daría de baja sin que nadie
  le confirmara que lo ha hecho.

## Qué cambia

Todo en `src/integrations/whatsapp.ts`, más las declaraciones del bot. No se toca ningún llamador
de otro carril: el corte vive en el sender.

- **`corteDeLaBaja`**, un helper único por el que pasan los 8 senders. Devuelve el motivo del
  corte o `null`.
- **Falla cerrado.** `isWaOptedOut` ya no captura el error; lo decide su único llamador. Si la
  consulta revienta, no se envía, y el motivo es `baja_no_comprobable`, **no** `wa_opt_out`:
  decirle al profesional «este cliente se dio de baja» cuando no se sabe sería afirmar algo falso.
  El motivo nuevo no está en `SEND_FAILURE_MESSAGES`, así que los llamadores lo llevan al genérico
  ya firmado de «no se pudo enviar por WhatsApp». **No hay texto nuevo.**
- **Una exención, declarada:** `exentoDeLaBaja: 'respuesta-a-entrante'`. Contestar a quien acaba
  de escribir no es escribirle; sin esto, un cliente de baja que escribe «hola» recibiría silencio
  (y a mitad de flujo: los textos sí y las listas no). Es un parámetro PROPIO en los 5 senders que
  pueden ser una respuesta, y **no se hereda de `exentoDelDemo`**: son dos políticas distintas.
  `Template`, `WindowFirst` y `Document` no lo tienen en su firma, así que no pueden acogerse.
- **31 declaraciones**, todas en el bot y todas hacia `from`: las 24 respuestas de texto que ya
  declaraban la exención del demo, y 7 que no declaraban nada (el menú, la petición de ubicación,
  los dos botones de confirmación, los dos botones-enlace y el acuse del albarán). `sendMenu`
  recibía su destino como `to`; pasa a llamarse `from`, que es lo que le pasan sus 7 llamadores.

## Decisiones, y de quién son

- **Fail-closed:** del orquestador, por el mismo principio de SCRUM-1307 (una comprobación que
  falla no es un permiso). El ticket lo marcaba como decisión y no como arreglo.
- **La exención de la respuesta:** el criterio es del propio ticket. El orquestador la aprueba y
  la sube a Javier ANTES de empujar, porque define a quién sí se le escribe tras una baja.

## Un test de OTRO carril, tocado — y sólo su montaje

`tests/scrum195-loop-adicional.test.mjs` es del carril S1 (equipo de Luis). Lo he tocado yo,
cruzando carril, con el sí del orquestador.

- **Por qué.** Sus tres casos de `sinPlantilla` llaman a `sendWhatsAppWindowFirst` SIN base. La
  consulta de la baja reventaba, el fail-open la leía como «no se dio de baja» y el envío seguía
  hasta `ventana_cerrada` o `via: 'template'`. Su premisa —«el destinatario no está de baja»— la
  ponía el defecto que este ticket elimina. Con el fail-closed los tres caían (`baja_no_comprobable`,
  `via: 'none'`), aquí y en CI, que tampoco le da base a Prisma.
- **Qué.** Sólo el montaje: la consulta de la baja contesta «nadie». Es lo único que se dobla; el
  resto sigue yendo al cliente real, sin base, como antes. **Ninguna aserción cambia.**
- **El precedente.** El doble de la base de `tests/scrum590-el-movil-es-el-canal.test.mjs`.
- **Control.** Sin el doble y con el arreglo: 3 rojos. Con el doble: 10 de 10, doce veces seguidas.
- **Una trampa al hacerlo.** Mi primera versión cargaba `createRequire` con un `await import(…)` de
  más, antes de los casos. Con `--test-force-exit` el corredor daba la tanda por terminada en ese
  hueco y CANCELABA los tres casos («Promise resolution is still pending…»); sin la bandera pasaban.
  Ahora es un `import` estático. No he llegado a explicar el mecanismo entero: lo medido es que el
  `await` de más lo provocaba y que quitarlo lo cura.

## Lo que NO arregla, y lo que cambia sin haberse pedido

- **Un recordatorio del cron cortado por la baja se reintenta cada día** (no marca su candado) y
  deja cada día su evento de «no entregado». Ya pasaba en la rama de plantilla; ahora también en
  la de texto, para el caso de las dos fichas con un número.
- **El corte es por número, también hacia el profesional.** Si el WhatsApp del profesional es
  además el de un cliente suyo dado de baja, sus avisos se cortan. Ya ocurría con la plantilla de
  reserva; ahora ocurre también con el texto.
- **La petición de reseña** (`psp.routes.ts`, `mpWebhook.routes.ts`) respeta ya la baja, pero
  sigue siendo un mensaje no transaccional y J6 dice «cero no-transaccional». Fuera de este ticket.
- **El literal de SCRUM-1133** («Se dio de baja de WhatsApp: no se le envían mensajes.») sigue sin
  publicar. Con este cambio ya no se le escribe por iniciativa nuestra, pero el bot sí le contesta
  si escribe: si la frase es publicable tal cual lo decide quien la firmó.
- **yaqu.app: NO VERIFICADO.** No se ha empujado.

## Cómo se midió

`tests/scrum1262-la-baja-corta-todas-las-vias.test.mjs`: ejecuta los 8 senders de
`dist/integrations/whatsapp.js` con la base doblada y Meta en dry-run. 35 casos.

- **Rojo visto primero**, con el `dist/` de `origin/main`: 24 de 35 caían. ① en las 6 vías sin
  corte (el número de baja aparecía en el buzón); ④ en las 8 (con la consulta reventando, enviaba).
  El ③ de las 6 vías caía también, y no porque no enviara: enviaba SIN PREGUNTAR, que es lo que su
  aserción de suelo exige.
- **Con el arreglo: 35 de 35.**
- **5 mutaciones sobre el compilado, las 5 caen:** el `catch` deja pasar (8 rojos) · la exención
  se hereda del demo (1) · el corte ignora la exención (5) · el corte actúa sin merchant (1) ·
  `Document` admite la exención (1).
- **Muestra, NO la tanda completa:** 644 ficheros de `tests/`, 5.185 casos. Salieron 6 rojos: los
  3 de `scrum195` (arreglado su montaje, arriba), 1 mío en `scrum921` (abajo, corregido) y dos
  trinquetes que caducaron por FECHA el 30-sep
  (`tests/scrum128-send-endpoints-fail-closed.test.mjs` y `tests/scrum55-admin-fail-closed.test.mjs`).
  Esos dos **siguen en rojo**, son ajenos a este diff y no se tocan aquí: piden una decisión, no
  una fecha nueva. Los medí sobre esta rama; sobre `main` limpio los midió el orquestador.

## Lo que me salió mal

- Le di al orquestador **49 llamadas y 37 respuestas** sumando a ojo los recuentos por fichero. Son
  **48 y 36**: lo vi al cuadrar la tabla de arriba (los recuentos por sender suman 48, no 49) y
  lo recalculé con un solo `git grep` sobre las seis vías. Las 4 del agujero y las
  8 al profesional estaban bien.

- Escribí «SCRUM-1262» en un comentario pegado a «copy v2 aprobado por el fundador», en
  `botFlow.service.ts`. El censo de `tests/scrum921-firmas-con-respaldo.test.mjs` lo leyó como la
  procedencia de esa firma y su trinquete bajó de 27 a 26 sin que nadie hubiera arreglado nada: le
  había fabricado respaldo a una aprobación que no es mía. Lo cazó el guard, no yo. Quitado.
- Puse el tipo de la exención en `whatsappPolicy.ts`, donde `scrum245-exencion-demo` cuenta los
  motivos y exige uno. Lo vi al leer el guard antes de correrlo; el tipo vive en `whatsapp.ts`.
- Mi primer guard por AST contaba como «declaración» el reenvío del parámetro dentro de los
  propios senders. Ahora distingue declarar (un literal) de reenviar, y exige que el reenvío sólo
  ocurra en `whatsapp.ts`.

A9: comprobación → `tests/scrum1262-la-baja-corta-todas-las-vias.test.mjs`

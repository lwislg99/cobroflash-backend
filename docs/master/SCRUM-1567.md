# SCRUM-1567 · el cliente final lee «factura» donde el modo no la permite: re-medido en el presente

**Medido contra:** `origin/main` = `40986008354181a012a7f0eeb46579d0bfe7bec7` · 2026-10-27T16:11:47Z (cabecera `Date` de GitHub; los ficheros medidos no cambian entre `c992358dc` y este sha)

A9: sin fallo que generalice — el único tropiezo propio fue dar a Jira un `cloudId` sacado del dueño del repo: la herramienta lo rechazó en la primera llamada y no tuvo efecto.

Lo escribe J4 (`jv-j4au`). Sólo lectura: **no se ha cambiado ni una palabra de texto de usuario** (reglas 24, 26 y 39). Ninguna base consultada.

## La premisa, en el presente

El ticket (19-oct) dice que en modo `receipt` el documento «sólo permite justificante». **Eso cayó el 22-sep:** desde SCRUM-1027, con `INVOICING_ES_ENABLED` en OFF no nace NINGÚN documento (`src/modules/invoicing/domain/invoiceNumber.service.ts:448-450`, `throw new Error('invoicing_es_disabled')`), y SCRUM-825 retiró el generador `J-`. Consecuencias:

- El interruptor que el ticket llama «el modo» (`isReceiptNumber` / `docLabel`) **decide por el NÚMERO del documento**, no por el comercio. Sin documentos `J-` nuevos, sólo distingue documentos ANTIGUOS (anteriores al 22-sep). Para un comercio nuevo, con el flag en OFF, no hay nada que etiquetar.
- El interruptor que sí mira el comercio es `getEmissionMode(merchant)` (`src/modules/invoicing/domain/emission.service.ts:36`). La página de aceptar ya lo usa.
- Con el flag en ON, el modo es `fiscal`, todo documento es una factura de verdad, y la palabra «factura» es correcta en las seis superficies.

## Las seis superficies (comercio ES real, no demo)

| superficie | fichero:línea (hoy) | carril | flag OFF: qué ve el cliente | flag ON |
|---|---|---|---|---|
| página de aceptar | `src/modules/system/app/routes/quoteDecisionLanding.routes.ts:765` y `:859` | S1 (equipo de Luis) | **ALCANZABLE**: «El profesional te enviará la factura y las instrucciones de pago por su cuenta.» | no sale (`sinBotonDePago` es falso) |
| plantilla de Meta `payment_request_es` | `src/integrations/whatsappTemplates.ts:164`; texto en `docs/WHATSAPP_TEMPLATES.md` §2 | J2 | **sólo con un documento `J-` antiguo**: «Tu factura está lista» / «te ha emitido la factura: Factura #…». Todos los que la llaman reciben una factura que ya existe (`invoiceWhatsApp.service.ts:128`, `invoiceReminder.service.ts:202`, `invoicesAdmin.routes.ts:747`), y con OFF no nace ninguna | correcto (factura) |
| portal del cliente | `src/modules/system/app/routes/customerPortal.routes.ts:503`, `:530`, `:458`; con documento `:445`, `:431` | J2 | **ALCANZABLE sin documento**: «Aquí tienes tus presupuestos, facturas y pagos.», el apartado «Facturas» y «No hay facturas aún.» Con un `J-` antiguo, además: «Factura J-…» y «📄 Descargar factura». El fichero sigue sin mirar ni `getEmissionMode` ni `isReceiptNumber` (0 apariciones) | correcto |
| email | `src/modules/messaging/domain/email.service.ts:91` | S1 (por `src/**`) | sólo con un documento antiguo, y ahí ya dice «justificante de cobro» | correcto |
| PDF | `src/modules/invoicing/infra/pdf/pdf.service.ts:472` | J1 | sólo con un documento antiguo `JUST`, y ahí ya dice «JUSTIFICANTE DE COBRO» | correcto |
| texto de ventana de WhatsApp | `src/modules/billing/domain/invoiceWhatsApp.service.ts:102` | J1 | sólo con un documento antiguo, y ahí ya dice «justificante» | correcto |

Lo que cambió desde el 19-oct en estos ficheros (`git log --since=2026-10-19`): sólo SCRUM-1568 (la línea con descuento del portal), 1596b y 1471b (la fecha del portal). **Ninguno toca la palabra.** De 1573b y 1624b no hay rastro en estos tres ficheros ni en `src/` por número (`git grep SCRUM-1573`: 0); no lo he leído más allá.

Control de la herramienta de carriles: `node scripts/carriles.mjs de` sobre un fichero inventado (`src/modules/system/app/routes/noExiste1567.routes.ts`) contesta «S1» igual. Por eso cada fila va primero con `git ls-tree origin/main <ruta>`: los seis existen. `docs/WHATSAPP_TEMPLATES.md` no tiene dueño en §3.

## No medido, y se dice

- **Cuántos documentos `J-` / `JUST` antiguos quedan PENDIENTES de cobro en las tres bases.** Es lo único que hace alcanzables la plantilla, el email, el PDF, la ventana y las filas del portal. No tengo acceso y el encargo prohíbe tocar staging o producción. Una sesión anterior de este puesto pidió ese mismo recuento el 13-oct y no consta respuesta. Los recordatorios (`invoiceReminder.service.ts:40-52`) no excluyen los `J-`: un `J-` pendiente con su cobro sigue pudiendo recibir «Tu factura está lista». Un `J-` tiene como mínimo 35 días, así que su recordatorio de 7 y de 14 días ya habrá salido salvo que fallara. **Eso es una deducción, no una medición.**
- Las plantillas §7 y §8 (albarán): su texto vive sólo en Meta. No lo he comprobado.
- El ticket no lleva etiqueta de equipo ni de área (`equipo-*`, `area-*`; A13 paso 1).

## De paso (otro carril, sólo se nombra)

La cabecera de `src/modules/invoicing/domain/emission.service.ts:3-6` y la definición de `'receipt'` (`:34`) siguen diciendo que con el flag en OFF «su documento post-pago es un JUSTIFICANTE DE COBRO». Es falso desde SCRUM-1027. Es un comentario en el camino de emisión, carril J1: se lee y no se toca.

## Para el fundador (✅/❌)

1. **Página de aceptar** (S1, equipo de Luis). La premisa ha caído: con el flag en OFF YaQu no emite nada, y la factura la hace el profesional por su cuenta, que es justo lo que dice la frase. «justificante» sería ahora FALSO, porque ya no existe. **Recomiendo: no hace falta cambiarla.** ✅ se queda «El profesional te enviará la factura y las instrucciones de pago por su cuenta.» / ❌ otro literal (dígalo usted).
2. **Plantilla de Meta §2.** **Recomiendo: no hace falta re-aprobación.** Con el flag en OFF no nace ningún documento al que mandarla, y con el flag en ON lo que se manda es una factura. El hueco que queda son los `J-` antiguos pendientes, y se cierra midiendo antes de tocar nada. ✅ que alguien con acceso cuente, sólo leyendo, los `J-`/`JUST` pendientes con cobro en las tres bases; si salen 0, este punto se cierra sin cambio / ❌ cerrar ya el camino en el código: no enviar `payment_request_es` a un `J-`. Esto cambia un envío (regla 28) y es carril J2.
3. **Portal del cliente** (J2). Éste sí está vivo con el flag en OFF y sin documento ninguno. Propuesta, cuando `getEmissionMode(merchant) === 'receipt'`:
   - saludo: «Aquí tienes tus presupuestos.» en vez de «Aquí tienes tus presupuestos, facturas y pagos.» Con OFF tampoco hay cobro por YaQu (regla 24), así que también sobra «pagos»;
   - el apartado «Facturas» y «No hay facturas aún.» **no se pintan**;
   - con un `J-` antiguo, «Justificante J-…» y «📄 Descargar justificante», como hacen ya el email y el PDF.

   ✅ esos tres literales / ❌ otros.
4. **¿Se propaga el interruptor o se arregla una a una?** **Recomiendo una a una, con `getEmissionMode` y no con `docLabel`.** `docLabel` pregunta por el número de un documento, y lo que falla hoy son pantallas SIN documento. Propagarlo no arreglaría ni la página de aceptar ni el portal. Hoy sólo queda una superficie viva por arreglar, el portal. Para la «cuarta superficie que se escriba», un guard que exija que toda ruta pública que pinte «factura» llame a `getEmissionMode` cubriría el caso; habría que diseñarlo, y nadie lo ha hecho. ✅ una a una (el portal, J2) / ❌ guard además (es de J6).

## SCRUM-1567b · El portal del cliente no habla de facturas a un comercio que no puede emitir (J2, jv-j2bp, 27-oct-2026)

**Medido contra:** `origin/main` = `75d4878628254b3e6b72c1dfe69f2d8575b978ef` · 2026-11-12T10:20:49Z (cabecera `Date` de GitHub)

A9: comprobación → `tests/scrum1567b-portal-sin-facturas-en-receipt.test.mjs`
A9: aviso → cicatriz J2 «otra vez la muestra local de guards elegida a mano: no llevaba scrum553, y un control de mi test con el `>` pegado tumbó el obligatorio de #3098» — no se pudo comprobar: qué guards entran en la muestra local lo decide la sesión

Lo construye J2 con la firma del fundador sobre la propuesta de arriba (SCRUM-1567 c.21121, puntos 3 y 4). Los literales se copiaron de Jira. Se construyó el 27-oct contra `922fddaab477767cbf9b9e0f789d39a48e85cd2e` y se quedó sin empujar, a la espera de #2937 (1573b) y del PR de 1624b, que tocan el mismo fichero; el 12-nov el relevo (jv-j2bp) lo puso al día con `git merge origin/main` y lo volvió a medir entero. Lo de abajo es la medición del 12-nov.

### Lo que trajo main, y lo que obligó a cambiar

- **Conflicto en `customerPortal.routes.ts`**, en la línea de `puedeTarjeta`: 1573b la cambió a `!comercioSuprimido(m) && cardChargeMode(m) !== 'refuse'`. Se conservan las dos: la de 1573b tal cual y, debajo, `sinFacturas`. El resto del fichero (la fila de 1624b incluida) entró sin conflicto. El registro no se entrelazó: el tramo de J4 queda intacto encima de éste.
- **SCRUM-1585 hizo obligatorio `llevaLibrosPorSii` en `MerchantLike`.** Con la consulta del 27-oct, `tsc -p .` daba `TS2345` en la llamada a `getEmissionMode`. La consulta del comercio lee ahora también esa columna (lectura, ni esquema ni camino de emisión). Consecuencia que sale sola de mirar `getEmissionMode`, como pide el punto 4 de la firma: con el flag en ON y el SII en «Sí» o «No consta», el comercio es `receipt` (no emite) y su portal tampoco habla de facturas. No es texto nuevo: son los mismos tres literales del punto 3. Tiene caso propio en el test.
- El banco del test fija `llevaLibrosPorSii` en «No» para el comercio `fiscal`; sin eso, el control ① sale rojo, que es lo que tiene que hacer.

### Qué se ha cambiado

Sólo `src/modules/system/app/routes/customerPortal.routes.ts`. El portal pregunta una vez por página `getEmissionMode(merchant)` y, si es `receipt`:

- el saludo es «Aquí tienes tus presupuestos.»;
- no se pinta el apartado «Facturas» ni «No hay facturas aún.»;
- un documento con número `J-` (`isReceiptNumber`) se titula «Justificante J-…» y su botón es «📄 Descargar justificante».

Con el flag en ON (`fiscal`) el portal sale como estaba (medido); en el comercio demo (`demo`), también, pero eso se lee del código y no tiene caso propio. La consulta del comercio lee además `email`, que `getEmissionMode` usa para reconocer al demo; no es esquema ni camino de emisión. Del camino de emisión sólo se importan dos funciones de lectura; no se ha tocado.

### El rojo, antes del cambio

Re-medido el 12-nov sobre la base nueva: el `customerPortal.routes.ts` de `origin/main` (`75d48786…`) compilado con el test de esta rama: 5 casos, **3 caen** (los tres de `receipt`, los tres con el saludo «Aquí tienes tus presupuestos, facturas y pagos.») y **2 pasan** (los dos controles: el modo del banco y el portal con el flag en ON). Con la rama, 5 de 5. El control del flag en ON pasó ANTES y DESPUÉS: el portal de un comercio `fiscal` no ha cambiado ni en el saludo, ni en el apartado, ni en «Factura J-…». (El 27-oct eran 4 casos y caían 2; el quinto es el del SII.)

Mutaciones: las dos de `MUTACIONES_QUE_ME_TUMBAN`, corridas con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (línea base limpia: 5 pasan, 0 caen, 0 saltan): **2 de 2 tumban su caso**. La de `sinFacturas` tumba además 2 colaterales (el caso del SII y el del `J-`, que dependen de la misma constante). Árbol y `dist/` restaurados, comprobado después con `git status` y leyendo las dos líneas en el fuente y en el compilado.

Build con tipos (`tsc -p .`, sin `--noCheck`): salida 0. Tests dirigidos, 18 ficheros (el nuevo, 1568, 1573b, 1624b, scrum237, 976, 1387, 411, 737, 1415, 812, 1204, 910, 745, 1177, 747, 700, 719): 160 casos, 160 pasan, 0 caen, 0 saltan.

### No cubierto por la firma, sin texto nuevo

Un comercio en `receipt` con un `J-` antiguo: la firma quita el apartado «Facturas» y a la vez pide «Justificante J-…», así que la tarjeta tiene que salir en algún sitio. Sale en su propio bloque **sin título**, debajo de los presupuestos. El orquestador J (`cobroflash-backend-8b`) lo dio por bueno como consecuencia mecánica de quitar «Facturas». No hay texto nuevo; si el fundador quiere un título para ese bloque, es otra firma. El 27-oct había 2 `J-` en producción, del comercio 18, de prueba (dato de SCRUM-1448 c.21012; no re-medido el 12-nov).

### El obligatorio del primer empujón cayó, y era mío

Empujado `76031fb1eb08b4b89383e64ce0a8dd3143ae7265` (PR #3098), el obligatorio salió rojo: 13.343 casos, 13.333 pasan, **1 cae** y 9 se saltan. El que cae es `scrum553`: «🔴 HAN APARECIDO EXTRACTORES NUEVOS CON EL `>` PEGADO: 21 (el tope es 20)», y el nuevo era mi control `vacio.includes('<p class="pf-empty">No hay facturas aún.</p>')` (línea 163 del test). Se arregla en el test, no en el guard: ahora es `/<p class="pf-empty"[^>]*>No hay facturas aún\.<\/p>/`. En local, `scrum553` + el test nuevo dan 21 de 21. `scrum553` no estaba en mi muestra de 18 ficheros: es la cicatriz de arriba.

### No medido, y se dice

- La suite entera en local: NO CORRIDA (encargo: hoy la cola se satura). La hace el obligatorio de CI.
- Ninguna pantalla en navegador ni en yaqu.app: el test pide la ruta real con un Prisma de mentira. Se verá en yaqu.app tras el despliegue del merge.
- El modo `demo` y el SII en «Sí» (frente a «No consta») no tienen caso propio en el portal: se leen del código de `getEmissionMode`.

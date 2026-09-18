# SCRUM-612 · E-1 medido HOY: qué pasa en el código cuando se le cobra a un cliente con la facturación apagada

**Medido contra:** `origin/main` = `4d8f3a15f6b3489d7f53bfbde550c587ee9d7c61` · 2026-09-18T15:10:15Z

**Puesto:** J1 · Facturación y VeriFactu (`jv-j1`, equipo de Javier) · **Rama:** `scrum-612-e1-medido-hoy`
**Gate:** LECTURA. Cero líneas de `src/`, `public/`, `prisma/` o del máster tocadas.

> ⛔ Este expediente **no decide E-1** (la decidió Javier, §0), **no escribe la enmienda al máster**
> (es de un jefe, regla 35) y **no toca** el camino del justificante, `INVOICING_ES_ENABLED`, su
> vuelta atrás, la marca de agua ni el microcopy N3/N5: siguen congelados hasta que la enmienda
> esté escrita y aprobada. Mide, y dice qué habría que tocar.

> 📌 La hora del ancla es la de GitHub (`gh api -i zen`, cabecera `Date:`), no la de la máquina. Y
> coincide con la de la base: la consulta de staging devolvió `now()` = 15:09:54Z.

---

## 0 · La decisión, tal como está escrita

Jira SCRUM-612, comentario 15946, 18-sep-2026 ~15:05Z. Palabras de Javier, literales:

> «Nada hasta que factura no esté lista no hay documento. No nos andamos con medias tintas.»

Y cómo quedó escrita la decisión en ese mismo comentario: *«mientras `INVOICING_ES_ENABLED` esté en
OFF, no se emite ningún documento. El profesional cobra y lo registra como hoy, el cliente recibe el
aviso de cobro por WhatsApp, y no hay documento intermedio de ningún tipo.»*

**Esa segunda frase es la que esta medición contrasta con el código**, y no la sostiene tal cual
(§1). No se reabre E-1 aquí: si hay que reabrirla, la reabre Javier con esto delante.

---

## 1 · 🔴 LO PRIMERO: el justificante no sale después de cobrar — sale ANTES, y el cobro cuelga de él

**Veredicto: CONFIRMADO** (el aviso preliminar que jv-j1 mandó al orquestador el 18-sep). Medido por
AST con el comprobador de tipos sobre `src/` entero, no leído.

### Dicho en plano, para Javier

Hoy, en YaQu, **el enlace para que el cliente pague sale del justificante**. El orden es este:

1. el profesional (o el propio cliente, al aceptar el presupuesto) genera el documento del tramo, que
   para un profesional español real es un **justificante `J-…`**;
2. de ese documento se crea el **cobro** y su **enlace de pago**, y se le manda al cliente por
   WhatsApp: *«… te envía el justificante J-… · A pagar: … · Pagar»*;
3. si paga por el enlace, le llega *«Hemos confirmado tu pago… (documento de cobro J-…)»* con un
   enlace a su recibo;
4. si paga de otra forma y el profesional lo **marca como cobrado a mano**, al cliente **no le llega
   nada**: marcar cobrado a mano no envía ningún mensaje.

Así que «no se emite ningún documento» **no deja al profesional cobrando y registrándolo como hoy**:
sin documento no hay enlace de pago, ni recordatorios, ni nada que marcar como cobrado, ni aviso al
cliente. Salvo que el cobro se separe del documento, que es una pregunta para J2 y para Javier (§1.4),
no una propuesta de esta sesión.

### 1.1 · La medición (población · control · resultado)

| qué se buscaba | población | control positivo | resultado |
|---|---|---|---|
| quién **crea** una fila de cobro (`Charge`): llamadas `*.charge.create/createMany/upsert`, escritura anidada `charge(s): { create… }`, SQL `INSERT INTO charges` | 289 ficheros de `src/` (todos los del `tsconfig`, cargados con tipos) | ve la creación conocida de `charges.routes.ts`; la misma forma anidada ve `events: { create }` (5) | **1** creación: `src/modules/billing/app/routes/charges.routes.ts:53` (`POST /charges`). 0 anidadas, 0 SQL |
| quién **llama** a `POST /charges`: literales que nombran la ruta `/charges` (no `/admin/charges`) usados como URL de `fetch`/`axios` | 289 de `src/` + 96 `.js` de `public/` + 224 de `scripts/` | la misma búsqueda ve «/webhooks/psp» (16), que es la ruta que llama «Confirmar Bizum» | **1** llamador: `src/modules/billing/domain/invoiceWhatsApp.service.ts:57`, dentro de `sendInvoicePaymentRequest(invoiceId)` |
| qué **entradas** del servidor llegan a crear un cobro, por el grafo de llamadas | 227 entradas: 221 rutas + 6 crons | el grafo cruza ficheros: `POST /webhooks/psp` → `sendPaymentConfirmationInvoice` → `sendWhatsAppWindowFirst` | **3**, y las tres pasan por un documento ya emitido: `POST /quote/:token/decision` (el cliente acepta), `POST /admin/jobs/:id/collect-rest` (cobrar el resto), `POST /admin/invoices/:id/resend-whatsapp` |
| de qué tabla sale lo que cobra cada **página de pago** | las 13 rutas públicas bajo `/pay` y `/recibo` | `GET /pay/card/:token` lee `charge` | las 5 de pago (`/pay/card`, `/pay/bank`, `/pay/mp`, `/pay/invoice`, `/pay/bizum`) leen `charge`; `/recibo` lee `charge`, `invoice` y `quote`; las 3 de `/pay/quote` son del presupuesto, no cobran |
| pasarelas que abren un pago por su cuenta | 289 de `src/` | — | 3 `checkout.sessions.create` de Stripe: 2 en `GET /pay/card/:token` (salen del cobro) y 1 en la suscripción a YaQu (`subscriptions.routes.ts:121`, no es cobro a cliente) |

Instrumento: `docs/master/evidencias/SCRUM-612/medir-e1-612.mjs` (secciones 0, A y C) · salida
entera: `salida-medir-e1-612.txt` · 16 controles, 16 OK.

⚠️ **Lo que esta medición NO ve, declarado:** un llamador de `POST /charges` que viva **fuera del
repositorio**. La ruta va con secreto interno (`app.ts:351`), así que sólo la puede llamar quien lo
tenga; y el máster retiró n8n (regla 1). Eso no se puede medir desde el código.

### 1.2 · Lo que «no emitir nada» se lleva por delante (una línea por cosa, con su fichero)

| se pierde | por qué, medido | dónde vive |
|---|---|---|
| **el enlace de pago** | el único creador de cobros lo llama sólo `sendInvoicePaymentRequest(invoiceId)` | `billing/domain/invoiceWhatsApp.service.ts:57` → `billing/app/routes/charges.routes.ts:53` |
| **el WhatsApp «te envía el justificante · Pagar»** | es el mismo envío, con el número del documento dentro | `invoiceWhatsApp.service.ts` (plantilla `payment_request_es`) |
| **el cobro de la señal al aceptar el presupuesto** | la aceptación del cliente emite el documento del tramo (`C1`) y, si el pago es por adelantado, manda el enlace | `quotes/app/routes/quotes.routes.ts:736` (emite) y `:818` (envía) |
| **los recordatorios de pago** | el cron diario y el botón «Recordar» recorren FACTURAS pendientes | `core/cron/cron.ts:73-76` (`sendInvoicePaymentReminders`) y `invoicesAdmin.routes.ts:700` |
| **marcar como cobrada** | las tres puertas del panel actúan sobre una fila de factura; «Confirmar Bizum», sobre un cobro que sólo existe si hubo documento | `invoicesAdmin.routes.ts:515` (estado), `:559` (pagar), `:432` (en lote) · `chargesAdmin.routes.ts:23` |
| **el aviso al cliente de que se ha cobrado** | sólo sale de los webhooks de pasarela (`psp`, `mp`), y «Confirmar Bizum» llega ahí saltando por HTTP a `/webhooks/psp`. Los dos necesitan un cobro. Las 3 puertas que marcan una factura a mano **no mandan nada**: 0 envíos alcanzados por el grafo, que sí cruza a `job.service` (control) | `psp.routes.ts:260`, `mpWebhook.routes.ts:179` |
| **la pantalla Cobros y lo cobrado del Trabajo** | Cobros funde cobros y facturas marcadas; el total cobrado del Trabajo se recalcula desde facturas pagadas | `billing/app/routes/cobrosAdmin.routes.ts` · `jobs/domain/job.service.ts` (`recalcJobCobradoForInvoice`) |
| **el recibo público** | `/recibo/:token` sale del cobro | `billing/app/routes/receipt.routes.ts` |

**Lo que NO se lleva** (medido en la sección B del instrumento: 41 de 227 entradas llegan a un envío
o a emitir, y éstas no dependen del documento de cobro): enviar el presupuesto por WhatsApp y por
correo; la aceptación y firma del presupuesto (menos su tramo de cobro); los albaranes/partes para
firmar y firmados; el recordatorio de presupuestos (cron horario); los mantenimientos; los avisos al
propio profesional. Y **no cambia nada** para el merchant demo (modo `demo`: factura con marca de
agua), para un profesional de fuera de España (modo `fiscal`) ni para un merchant con el flag forzado
a ON en su ficha.

### 1.3 · Y un detalle que cambia qué ve el cliente si se quita el documento sin más

Los dos webhooks nombran el documento en la confirmación de pago, y **si no hay documento ponen el
número interno del cobro**: `psp.routes.ts:256` (`invConf?.number || paidInvoiceNumber ||
String(updated.id)`) y `mpWebhook.routes.ts:175`. Hoy no se da porque siempre hay documento; sin
documento, el cliente leería *«documento de cobro 123»*. Se reporta, no se toca (es de J2 y es texto
que ve un usuario: regla 39).

### 1.4 · La pregunta que queda — como PREGUNTA, no como propuesta

**¿Se puede cobrar sin documento?** Lo que dice el código, sin opinar:

- **El modelo de datos no ata el cobro al documento.** `Charge` no tiene columna de factura: es la
  factura la que apunta al cobro (`Invoice.chargeId`), y `POST /charges` acepta cliente, concepto e
  importe sin factura. Un cobro sin documento **se puede guardar**.
- **Lo que lo ata es el flujo**: el único que pide un cobro lo hace desde una factura (§1.1), y las
  pantallas de marcar, recordar y listar cobros trabajan sobre facturas.

Cobros, enlaces de pago y el canal de WhatsApp son de **J2** (`dos-equipos.md` §3.1). Si hace falta
trabajo ahí, es un encargo del orquestador a J2, no de J1. Lo que Javier tiene delante es:
**con el flag en OFF, ¿el profesional cobra por YaQu sin documento (y alguien construye ese
camino), o no cobra por YaQu hasta que la factura esté lista?**

---

## 2 · La tabla que pidió el encargo

| # | pregunta | lo que decía la recomendación (18-sep ~12:40Z) | lo que mide HOY el código | cómo se mide |
|---|---|---|---|---|
| 1 | ¿existe hoy el camino del justificante? ¿dónde? | lo daba por existente («hoy recibe el justificante») | **Sí, vivo y por defecto.** Decide `getEmissionMode` (`invoicing/domain/emission.service.ts:40`: ES real sin flag → `receipt`); numera `allocateInvoiceNumber` (`invoiceNumber.service.ts:487`: en `receipt` da un `J-…`); lo tipa `emitInvoice` (`invoicing.service.ts:104`: `J-` → `type: 'JUST'`); lo pinta el PDF (`pdf.service.ts:295` y el título «JUSTIFICANTE DE COBRO» de `:378`). **16 sitios** ramifican por él en 12 ficheros; **29 textos** visibles lo nombran en 16 ficheros (17 del panel, 12 del servidor: PDF, WhatsApp, correo). En pantalla: el botón «+ Nuevo justificante» de Facturas (`invoicesView.js:223`) y «Se emiten justificantes de cobro» en Ajustes (`settingsView.js:39`). **Y corre:** staging tiene 9 justificantes emitidos el 16 y 17-sep (pregunta 3) | `medir-e1-612.mjs` §F y §G · `ejecutar-e1-612.mjs` §2 (7 casos, 7 como se esperaba) |
| 2 | con el flag en OFF, ¿qué recibe el cliente al cobrarle? | «el profesional cobra y lo apunta como hoy, y el cliente recibe el WhatsApp de "cobro recibido", sin documento» | **Antes de pagar:** el justificante `J-…` por WhatsApp con el botón de pagar (y, si el profesional lo manda, por correo). **Al pagar por el enlace:** un WhatsApp «Hemos confirmado tu pago (documento de cobro J-…)» con enlace al recibo; el correo con el documento sólo si `AUTO_INVOICE_ON_PAID` y `AUTO_EMAIL_INVOICE_ON_PAID` están encendidos en el entorno (en el código, apagados por defecto). **Si el profesional lo marca cobrado a mano: nada** (0 envíos desde las 3 puertas de factura; «Confirmar Bizum» sí avisa, porque pasa por el webhook). **La premisa de la recomendación no se sostiene:** ese WhatsApp de «cobro recibido» existe, pero cuelga del cobro, y el cobro, del documento (§1) | `medir-e1-612.mjs` §B y §C (227 entradas, grafo con tipos) |
| 3 | ¿queda algún justificante emitido? | «se borraron el 8-sep: V1 a 0 en producción y en staging. E-4 resuelta» | **Staging NO está a cero:** 9 documentos, los 9 `J-` y `type = 'JUST'`, todos del merchant 2, creados entre el 16-sep 13:43Z y el 17-sep 10:05Z (después del borrado); con su rastro: 9 filas de auditoría con `tipoFactura: 'JUST'` y 9 cobros «Justificante …». Staging es base de pruebas (declarada contaminada por las suites, SCRUM-668): son documentos de prueba, pero la frase «a 0 en staging» ya no es verdad hoy. **Desarrollo** (`yaqu_dev_javier`): 0 justificantes sobre 5 facturas F1 (el cero vale: el instrumento ve las 5). **Producción: NO MEDIDA** — no se toca (§4). Así que **E-4 no se puede dar por resuelta** hasta que un jefe corra la consulta en producción | `contar-justificantes-612.mjs` sobre staging y dev, en transacción `READ ONLY` · para producción, `contar-justificantes-612.sql` (lo pega un jefe) |
| 4 | valor por defecto de `INVOICING_ES_ENABLED` y `SIF_ENABLED`; quién los lee | lo daba por OFF | **Los dos `false`** (`core/flags.ts:16` y `:17`), confirmado ejecutando `isFlagEnabled` con el entorno limpio. Precedencia: ficha del merchant > país > variable de entorno > defecto, y los dos sólo existen para España. **`INVOICING_ES_ENABLED` decide de verdad en 3 sitios:** el modo de emisión (`emission.service.ts:40`), el XML VeriFactu (`exports.routes.ts:544`, 404 si está en OFF) y si el paquete `datos.zip` lo incluye (`:144`); además lo copian al registro de auditoría `invoiceNumber.service.ts:455` y `audit.service.ts:253`, y lo cambia `flagFiscal.service.ts:133` (que también lo lee con el nombre en una variable, `:106` y `:110`; son las dos únicas que da una búsqueda de texto de `isFlagEnabled(` sin literal en `src/` y `public/` — texto, no AST: se dice como localización, no como censo). **`SIF_ENABLED` no decide nada:** sólo se copia al registro (`invoiceNumber.service.ts:456`, `audit.service.ts:254`) y se cambia en `flagFiscal.service.ts:134`. Ningún merchant de staging ni de dev lo tiene forzado (0 filas). Probado ejecutando: con la variable de entorno `INVOICING_ES_ENABLED=true` **todos** los españoles sin ficha propia pasan a `fiscal` | `medir-e1-612.mjs` §E · `ejecutar-e1-612.mjs` §1-2 · consulta ⑥ |
| 5 | ¿sigue la marca de agua «DEMO — no válida fiscalmente»? ¿dónde se pinta? | no la trataba | **Sí.** Constante en `emission.service.ts:12`; la pasan los 3 generadores de PDF de factura (`lib/invoicing.ts:131` y `:268`, `invoicesAdmin.routes.ts:1170`), siempre como `isDemoMerchant(m) ? DEMO_WATERMARK : null`; se dibuja en diagonal en cada página (`pdf.service.ts:331-336`); y en pantalla la pone el detalle de factura (`invoiceDetailView.js:100`). **Probado generando los dos PDF con el generador real:** el del demo lleva «DEMO» y «no válida fiscalmente»; el del profesional real, no | `medir-e1-612.mjs` §H · `ejecutar-e1-612.mjs` §3 |

**Las otras dos afirmaciones de la recomendación, contrastadas de paso:**

- *«Hoy no afecta a nadie: no hay merchants reales.»* No es medible desde el código ni desde staging;
  es un dato de producción y no se ha medido (§4).
- *«E-2: el flag pasa a significar "se emite factura o no se emite nada", y así conserva un lado OFF
  seguro.»* Medido: el lado OFF **no es solo «no emitir»**. Hoy apaga también el enlace de pago, los
  recordatorios y el marcar cobrado (§1.2). Ese «lado seguro» deja al profesional sin cobro por YaQu
  mientras dure el OFF, salvo lo que se decida en §1.4.

---

## 3 · Qué haría falta para que «no se emite nada» sea verdad — en orden

Nada de esto se hace en esta tanda: el congelado sigue vigente. Es la lista para SCRUM-825 y para el
borrador de enmienda con J4.

### 3.a · Cambio de MÁSTER (lo firma un jefe; el borrador, J1 con J4)

1. **Regla 24** (E-2): qué significa el flag en OFF.
2. **Parte P**, fila de `INVOICING_ES_ENABLED`: hoy su vuelta atrás dice *«vuelve a justificante»*.
3. **Parte U, V0-0**, y el microcopy **N3/N5** que define el justificante.
4. **La línea 51 del máster**, el resumen del producto: *«antes de SIF-1 el flujo entrega justificante
   no fiscal»*.
5. **Si se cobra sin documento o no** (§1.4): es el flujo de cobro que describe la misma línea 51
   («firma → cobro de señal»), así que también es máster, no sólo código.

### 3.b · Cambio de CÓDIGO (cada punto que toca el camino de emisión es STOP: reglas 38 y 40)

1. **El punto único de decisión.** `allocateInvoiceNumber` (`invoiceNumber.service.ts:487`) hoy
   devuelve un `J-` en modo `receipt`; «no emitir» es que ahí no salga número, como ya pasa con las
   rectificativas (`invoicing_es_disabled`). **Camino de emisión → STOP.**
2. **Cada boca que hoy emite un justificante tiene que parar ANTES de pedir número**, con un 409 con
   nombre, como ya hacen las cuatro que están cerradas (`albaranes.routes.ts:444`, `:1223`, `:1416` y
   `jobs.routes.ts:1571`). Si no, el punto 1 las convierte en errores 500. Las que hoy emiten `J-`:
   - `quotes.routes.ts:736` — **el cliente aceptando el presupuesto** (la más delicada: es pública y
     la aceptación ya está guardada antes);
   - `jobs.routes.ts:1448` — cobrar el resto;
   - `quotesAdmin.routes.ts:291` y `:560` — el documento de un tramo y el manual;
   - `invoicesAdmin.routes.ts:152` — el documento suelto, cuyo gate (`facturaSuelta.ts:78`) hoy dice
     `justificante` y tendría que decir `no`;
   - `lib/invoicing.ts:338` — el que se crea al cobrar (`ensureInvoiceForCharge`), sólo si
     `AUTO_INVOICE_ON_PAID` está encendido en el entorno.
   La rectificativa (`invoicesAdmin.routes.ts:1022`) ya falla hoy en modo `receipt`.
3. **El cobro** (§1.4): o se construye un camino de cobro sin documento (J2), o se acepta que con el
   flag en OFF no hay enlace, recordatorios ni marcar cobrado.
4. **Los 29 textos** que nombran el justificante (§2, fila 1): cada uno desaparece o cambia, y **lo
   que vea el profesional donde estaba el justificante es microcopy nueva: se propone el literal exacto
   y se para** hasta que lo firme un jefe (regla 39).
5. **Los 16 sitios que ramifican** por `receipt`/`JUST`: o se quedan leyendo documentos antiguos
   (regla 29: lo emitido no se borra) o se retiran — depende de §4 y de lo que haya en producción.
6. **Los tests que se pondrán en rojo:** SCRUM-825 fase 2 contó 22 ficheros el 8-sep; ese número
   hay que **rederivarlo** el día de la ejecución, no copiarlo.

---

## 4 · Lo que NO se ha medido, y por qué

| qué | por qué no | quién lo puede medir |
|---|---|---|
| justificantes en **producción** | tocar producción está prohibido para una sesión | un jefe: pegar `contar-justificantes-612.sql` en la consola de Postgres de producción (Railway → base → Query). Solo lectura, sin credenciales en el fichero |
| el valor de `INVOICING_ES_ENABLED`, `AUTO_INVOICE_ON_PAID` y `AUTO_EMAIL_INVOICE_ON_PAID` **en el entorno de producción** | vive en Railway, no en el código | un jefe, en Railway. El máster decía el 17-ago que `INVOICING_ES_ENABLED` estaba **sin definir** en producción; no se ha vuelto a comprobar |
| si algún merchant de **producción** tiene el flag forzado en su ficha | producción | la consulta ⑥ del mismo SQL |
| llamadores de `POST /charges` de **fuera del repositorio** | no están en el código | nadie desde aquí |
| la pantalla en un navegador | la medición es de código; no se ha pulsado nada | — |

---

## 5 · Errores propios (A9)

1. **Una hora escrita a ojo.** El aviso preliminar al orquestador decía «~15:30Z (reloj local)». No
   la medí: la hora de GitHub diez minutos DESPUÉS de ese mensaje era **15:10:15Z**. Iba ~25 minutos
   adelantada, y es justo lo que A14 prohíbe.
2. **Un instrumento que no llegó a correr.** La primera pasada del contador sobre staging salió
   `EXIT=1` sin un solo recuento: la ruta del SQL se leía con `%20` en el espacio de «Javier Pereira».
   Se trató como «no arrancó», no como resultado, y se arregló (`fileURLToPath`).
3. **La primera población del «quién llama a /charges» no incluía `scripts/`**. Se amplió antes de
   dar el veredicto: 224 ficheros más, ningún llamador nuevo.

---

## 6 · Lo que NO se ha tocado

`src/`, `public/`, `prisma/`, `docs/YAQU_MASTER.md`, `CLAUDE.md`: ni una línea. Ni producción. Staging
y desarrollo, sólo en una transacción `READ ONLY`. Los PDF de prueba se escribieron en una carpeta
temporal fuera del repositorio.

## Evidencias — `docs/master/evidencias/SCRUM-612/`

| fichero | qué es |
|---|---|
| `medir-e1-612.mjs` | el censo por AST y el grafo de llamadas con tipos (§1, §2) |
| `ejecutar-e1-612.mjs` | las funciones reales de `dist/`: flags, modo de emisión, los dos PDF |
| `contar-justificantes-612.sql` | la consulta de solo lectura, para pegar en cualquier base |
| `contar-justificantes-612.mjs` | la corre en una transacción `READ ONLY`; se niega si la clave apunta a producción |
| `salida-*.txt` | las salidas de esta tanda, tal cual (sin rutas de la máquina) |

Para repetirlo (con `npm run build` hecho):

    node docs/master/evidencias/SCRUM-612/medir-e1-612.mjs .
    node docs/master/evidencias/SCRUM-612/ejecutar-e1-612.mjs . <carpeta temporal FUERA del repo>
    node --env-file=<.env con las claves> docs/master/evidencias/SCRUM-612/contar-justificantes-612.mjs . DATABASE_URL_STAGING

---

# SCRUM-612b · BORRADOR de la enmienda al máster: con el interruptor en OFF, ni documento ni cobro

**Medido contra:** `origin/main` = `17b0c86b84fb0544013923314d250d7181d913db` · 2026-09-18T15:45:01Z (hora de GitHub)

**Puesto:** J1 · Facturación y VeriFactu (`jv-j1`, segunda sesión del 18-sep) · **Rama:** `scrum-612-borrador-enmienda`
**Gate:** SOLO DOCUMENTOS. Cero líneas de `docs/YAQU_MASTER.md`, `CLAUDE.md`, `.claude/`, `src/`, `public/` o `prisma/`.

> ⛔ **Esto es un BORRADOR para que un jefe lo firme, no la enmienda.** El máster y `CLAUDE.md` son de un
> jefe (regla 35), y SCRUM-273 bloquea escribir en el máster desde una rama de ticket. Hasta que un jefe
> firme este texto, **el congelado del expediente sigue vigente**: el justificante y el cobro funcionan hoy
> exactamente como hasta ahora, y SCRUM-825 no se ejecuta.

> 📌 **Los números de línea son de `17b0c86b`.** Si `main` mueve el máster, se desplazan. El instrumento
> de §9 comprueba que **cada cita de este borrador sigue en su línea** (82 de 82 hoy) y, si una se movió,
> dice dónde está ahora. Se corre antes de pegar nada.

---

## 0 · Las dos decisiones que este borrador pasa a texto

Literales, de Jira SCRUM-612. No se parafrasean ni se reabren aquí.

- **E-1**, comentario 15946: «Nada hasta que factura no esté lista no hay documento. No nos andamos con medias tintas.»
- **El cobro**, comentario 15950: «B: no se cobra hasta que no haya factura. La factura en formato correcto, Verifactu, es nuestro cuello de botella y prioridad»

**Lo que este borrador NO decide** (siguen donde estaban): E-3 (declaración responsable), E-4 (justificantes
ya emitidos: staging tiene 9 y producción está sin medir, §4 de arriba), E-5 (guion H2 y pack de gestoría) y
E-6 (argumentario). Donde el máster choca con B **en lo comercial**, este borrador lo señala y **no propone
texto** (§4): eso es E-5 y E-6, de J4, y lo firma un jefe.

---

## 1 · Cómo se buscó: por contenido, con población y controles

Instrumento: `docs/master/evidencias/SCRUM-612/censo-enmienda-612.mjs`. Lee los ficheros con
`git show <sha>:<ruta>`, no del árbol de trabajo. Salida: `salida-censo-enmienda-612.txt`.

**Familias** (una pregunta cada una; una línea puede casar varias): el justificante (`justificante`,
`JUST`, `J-`); el interruptor (`INVOICING_ES_ENABLED`); señal, anticipo, depósito, «por adelantado»; el
enlace de pago (`/pay/`, «Pagar», `payment_request`); cobrar y cobro (sin contar «cobroflash», el nombre
del repositorio); los medios (Stripe, Bizum, transferencia, Connect, pasarela); recordatorio; recibo; y el
flujo «presupuesto → firma → cobro».

| fichero | población | casan alguna familia | historial (`>` o ✅ SCRUM-) | candidatas, leídas una a una |
|---|---|---|---|---|
| `docs/YAQU_MASTER.md` | 1.883 líneas · 494.324 bytes | 292 | 141 | **151** |
| `CLAUDE.md` | 168 líneas · 13.085 bytes | 10 | 0 | **10** |

**Controles**, todos en verde:

- **4 positivos:** frases que están hoy y que su familia tiene que ver — `vuelve a "justificante"` (la fila
  de la Parte P), `INVOICING_ES_ENABLED` (22 líneas), `señal` (39) y `cobro de señal/total` (`CLAUDE.md`).
- **1 negativo:** una frase inventada con «cobroflash» dentro no casa ninguna familia.
- **La clasificación se compara como CONJUNTOS:** cada una de las 151 candidatas tiene exactamente una
  clase, y ninguna clase nombra una línea que no sea candidata (más una extra en cada fichero, declarada
  con su motivo). Probado en rojo en una copia: quitar la L1880 de su clase → «candidatas SIN clase:
  1880».
- **Cada cita de este borrador se comprueba en su línea:** 82 de 82 (fuera del máster y de `CLAUDE.md` también se citan, y se comprueban, `ALCANCE_BETA.md`, `PREGUNTAS_ASESOR.md`, el test de SCRUM-302, una skill y cinco ficheros de código). Probado en rojo: desplazar una cita
  una línea → «ahora en: 7».

| clase | máster | `CLAUDE.md` | qué significa |
|---|---|---|---|
| **CAMBIA** | 21 | 6 | este borrador propone texto (§2 y §3) |
| **COMERCIAL** | 12 | — | choca con B en la venta: se señala, no se redacta (§4) |
| **ABIERTA** | 1 | — | choca y no es de J1: pregunta (§7) |
| **CUBIERTA** | 50 | — | describe el cobro cuando existe; la regla 24 nueva lo acota sin tocarle el texto (§5) |
| **OTRO_SENTIDO** | 5 | — | «señal» como indicio; recordatorio de mantenimiento o de visita |
| **HISTORIA** | 2 | — | registro de trabajo hecho que el filtro automático no reconoce |
| **NO_CHOCA** | 61 | 5 | otra fase u otro país, investigación, la suscripción de YaQu, diseño, seguridad, herramientas |

⚠️ **Lo que la búsqueda NO ve, declarado:** una idea escrita sin ninguna de esas palabras («el cliente
abona»). Para acotarlo se leyeron **enteras** las secciones que describen el producto de punta a punta: el
Project Brief (L29-L45), A1 (L50-L55), C1, la Parte L (L395-L410), N1-N5 (L420-L437) y la Parte V (V1-V9).
El historial (141 líneas) no se reescribe: el máster se actualiza «con motivo; nunca borrar» (AA1.7).

---

## 2 · El texto propuesto — MÁSTER (`docs/YAQU_MASTER.md`)

Cada punto: **hoy dice** (literal, con su línea) → **propuesto** (entero, para pegarlo tal cual; lo nuevo en
negrita) → **por qué**.

### 2.1 · El núcleo: la regla 24 (E-2) — Parte I, L245

Hoy dice:

> 24) `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1 v2 completo; facturas demo con marca de agua SIEMPRE.

Propuesto:

> 24) `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1 v2 completo; facturas demo con marca de agua SIEMPRE. **Con el interruptor en OFF, YaQu no emite ningún documento para ese merchant —ni factura, ni justificante, ni ningún otro documento de cobro— y no cobra por YaQu a sus clientes: ni enlace de pago, ni señal al aceptar el presupuesto, ni recordatorios de pago, ni «marcar como cobrada», ni aviso de pago al cliente, ni la pantalla de Cobros, ni la página pública del recibo. Presupuestos, firma, albaranes y partes siguen igual. El profesional cobra por fuera de YaQu hasta que exista la factura. Lo ya emitido no se toca (regla 29). (SCRUM-612: E-1, comentario 15946, y B, comentario 15950, 18-sep-2026.)**

Por qué: es la única regla que dice qué significa el interruptor. La lista es la que midió la entrega
anterior en el código (§1.2 de arriba), una cosa por línea, para que nadie tenga que deducir si «el
recordatorio» o «el recibo» entran. «Ni ningún otro documento de cobro» cierra la tercera opción que se
presentó y se descartó en el 15946 (un recibo de reposo sin numeración).

### 2.2 · Parte P — la fila del interruptor, L463

Hoy dice:

> | `INVOICING_ES_ENABLED` | país ES / merchant | **OFF** | admin tras SIF-1 v2 8/8 | factura fiscal ES a reales | SIF-1 + datos fiscales | seguro: vuelve a "justificante" |

Propuesto:

> | `INVOICING_ES_ENABLED` | país ES / merchant | **OFF** | admin tras SIF-1 v2 8/8 | factura fiscal ES a reales **y el cobro por YaQu a sus clientes (regla 24)** | SIF-1 + datos fiscales | seguro: **no se emite ningún documento ni se cobra por YaQu; lo ya emitido no se toca (regla 29)** |

Por qué: «vuelve a justificante» es exactamente lo que E-1 retira. Y con B el interruptor pasa a ser la
llave del cobro, así que va en «Desbloquea». Qué pasa con un enlace de pago **ya enviado** cuando se apaga
el interruptor en un merchant que lo tenía encendido es la pregunta P-2 (§7).

### 2.3 · Parte P — una línea NUEVA debajo de la tabla (entre L474 y L475)

Propuesto (se inserta antes de «Gates que NO son flags:», L475, que no cambia):

> **Precedencia entre los flags de cobro (SCRUM-612, 18-sep-2026):** en un merchant ES con `INVOICING_ES_ENABLED` en OFF no hay cobro por YaQu (regla 24), así que `PAYMENTS_CONNECT_ENABLED`, `BIZUM_MANUAL_ENABLED` y `BIZUM_AUTO_ENABLED` no tienen efecto para él mientras tanto. Fuera de España, y en el merchant demo, no cambia nada.

Por qué: las filas de esos tres flags dicen `seguro: transfer/Bizum` (L465) y `seguro: se oculta` (L466 y
L467). Leídas solas, prometen un cobro de reserva que con B no existe en España. Una línea de precedencia
evita reescribir tres filas. Es un cambio de la Parte P (cerrada, regla 27), y por eso va aquí y no en el
código.

### 2.4 · La regla 18 — Parte I, L243

Hoy dice:

> 18) Tarjeta para clientes reales SOLO con Connect activo en ese merchant; mientras, transferencia/Bizum manual.

Propuesto:

> 18) Tarjeta para clientes reales SOLO con Connect activo en ese merchant; mientras, transferencia/Bizum manual. **En España, todo lo anterior solo en un merchant con `INVOICING_ES_ENABLED` en ON (regla 24): con el interruptor en OFF no hay cobro por YaQu de ningún tipo.**

Por qué: «mientras, transferencia/Bizum manual» se lee hoy como el cobro de reserva de un merchant español
sin Connect, que es justo el caso que B apaga.

**La regla 23 (L244) no cambia:** dice DÓNDE se puede procesar el dinero («PSP = cuenta conectada del
merchant o nada»), no CUÁNDO; con B, en España y en OFF, simplemente no hay nada que procesar. Lo mismo
la regla 10 (L241) y la 22 (L244).

### 2.5 · Project Brief — L31

Hoy dice (el resto de la línea no cambia):

> **Hasta entonces, la beta vende presupuestos, firma y cobro con justificante no fiscal: nunca "facturación" ni claims fiscales** (reglas 17, 24, 26).

Propuesto:

> **Hasta entonces, en España la beta vende presupuestos, firma y albaranes, y no emite ningún documento ni cobra por YaQu hasta que haya factura: nunca "facturación" ni claims fiscales** (reglas 17, 24, 26).

Por qué: E-1 y B, con las palabras de B («hasta que haya factura»). El principio de la misma línea, que
enumera lo que hace el producto (cobrar la señal o el total y, con SIF-1 cerrado, emitir la factura),
describe el producto entero y no cambia.

### 2.6 · Project Brief — el flujo core, L39 a L42

Hoy dice:

```
  → se genera justificante no fiscal — o factura VeriFactu si INVOICING_ES_ENABLED (post SIF-1)
  → cliente paga señal/total (tarjeta Connect · Bizum manual · transferencia)
  → merchant recibe confirmación por WhatsApp; factura/justificante al cliente por email
  → recordatorios automáticos persiguen lo pendiente (24h / 7d / 14d)
```

Propuesto:

```
  → con INVOICING_ES_ENABLED (post SIF-1): se genera la factura VeriFactu
      (sin él, en España, el flujo acaba en la firma: ni documento ni cobro por YaQu — regla 24)
  → cliente paga señal/total (tarjeta Connect · Bizum manual · transferencia)
  → merchant recibe confirmación por WhatsApp; factura al cliente por email
  → recordatorios automáticos persiguen lo pendiente (24h el presupuesto; 7d / 14d la factura)
```

Por qué: el flujo de hoy pone el justificante ANTES del pago, que es el orden que midió la entrega
anterior en el código (§1: el cobro cuelga del documento). Con E-1 no hay justificante, y con B los tres
pasos de abajo solo existen si hay factura. El recordatorio de 24 h es el del PRESUPUESTO (plantilla
`quote_decision_es`, L292), no es un cobro y se queda.

### 2.7 · A1 — L51

Hoy dice (el principio de la línea no cambia):

> **con el gate fiscal cerrado (SIF-1, regla 24) la factura VeriFactu se emite sola — antes de SIF-1 el flujo entrega justificante no fiscal.**

Propuesto:

> **con el gate fiscal cerrado (SIF-1, regla 24) la factura VeriFactu se emite sola — antes de SIF-1, en España, no se emite ningún documento ni se cobra por YaQu: la señal, el cobro y los recordatorios de pago llegan con la factura.**

Por qué: es «la línea 51» que ya señaló la entrega anterior. El principio de A1 («paga la señal sin salir
de la conversación», «Los recordatorios persiguen al moroso automáticamente») es la definición del producto y es verdad
después de SIF-1; la última frase dice desde cuándo. Si esa frase sirve para VENDER antes de SIF-1 es E-6
(§4).

### 2.8 · F1 — los gates, L197

Hoy dice:

> **Gates:** SIF-1 = gate de venta fuerte, de TODO claim fiscal y de `INVOICING_ES_ENABLED`. CONNECT-1 = gate solo de tarjeta real. Conflicto un día dado → gana SIF-1 SIEMPRE.

Propuesto:

> **Gates:** SIF-1 = gate de venta fuerte, de TODO claim fiscal y de `INVOICING_ES_ENABLED` **—y, por la regla 24, del cobro por YaQu en España (SCRUM-612)—**. CONNECT-1 = gate solo de tarjeta real. Conflicto un día dado → gana SIF-1 SIEMPRE.

Por qué: B pone el cobro detrás de SIF-1 («nuestro cuello de botella y prioridad»). Sin esta frase, F1
sigue diciendo que el único gate del dinero es CONNECT-1.

### 2.9 · U1.3 SIF-1 — L1044

Hoy dice:

> **Solo con 8/8 ✅:** claim VeriFactu + `INVOICING_ES_ENABLED` a reales + GTM-1 etapa 2.

Propuesto:

> **Solo con 8/8 ✅:** claim VeriFactu + `INVOICING_ES_ENABLED` a reales **(y con él, el cobro por YaQu a sus clientes: regla 24)** + GTM-1 etapa 2.

### 2.10 · B2 — checklist regulatorio, L100

Hoy dice (el principio de la línea no cambia):

> Hasta entonces, cobros reales SOLO transferencia/Bizum manual; tarjeta limitada a demo/test (regla 18).

Propuesto:

> Hasta entonces, cobros reales SOLO transferencia/Bizum manual **—y en España, solo en un merchant con `INVOICING_ES_ENABLED` en ON (regla 24)—**; tarjeta limitada a demo/test (regla 18).

### 2.11 · Parte L — el presupuesto (L397) y el Trabajo (L405)

La Parte L es cerrada (regla 27): **no se añade ningún estado ni ninguna transición**; solo se dice
cuándo no hay documento ni cobro.

L397, hoy dice (dentro de `sent→accepted`):

> factura(s) según paymentTerms; WA al pro; PDF

Propuesto:

> factura(s) según paymentTerms **—ninguna con `INVOICING_ES_ENABLED` en OFF en un merchant ES (regla 24)—**; WA al pro; PDF

L405, hoy dice:

> `terminado` → CTA "Cobrar el resto" si hay tramo pendiente; `cerrado` = todo cobrado o decisión del pro.

Propuesto:

> `terminado` → CTA "Cobrar el resto" si hay tramo pendiente **y el merchant factura (regla 24)**; `cerrado` = todo cobrado o decisión del pro.

Por qué: son dos de las tres entradas que hoy crean un cobro (§1.1 de arriba: `POST /quote/:token/decision`
y `POST /admin/jobs/:id/collect-rest`). El literal «Cobrar el resto» no se toca.

### 2.12 · Parte M — L415

Hoy dice (dos trozos de la misma línea; el resto no cambia):

> Cobro → sin `charge_ready`, modal inline "Añade tu IBAN o tu Bizum para que te puedan pagar".

> sin ellos el documento post-pago es **"justificante de cobro"** (sin numeración de factura, sin QR) — el copy NUNCA dice "factura".

Propuesto:

> Cobro → **(merchant ES: solo con `INVOICING_ES_ENABLED` en ON, regla 24)** sin `charge_ready`, modal inline "Añade tu IBAN o tu Bizum para que te puedan pagar".

> sin ellos **no se emite ningún documento ni se cobra por YaQu (regla 24)** — el copy NUNCA dice **que se emite una factura**.

Por qué: el «justificante de cobro» es lo que E-1 retira. Y pedir el IBAN o el Bizum «para que te puedan
pagar» promete un cobro que B apaga en España (el literal del modal no se toca). ⚠️ **El cambio de «el
copy NUNCA dice "factura"» solo hace falta si se acepta la microcopy M-1 y M-5 (§6)**, que nombran la
facturación en negativo («no está activa»). Si un jefe no la acepta, esa cláusula se deja como está.

### 2.13 · Parte N — N3, L429

Hoy dice (el resto de la línea no cambia):

> "Descargar factura (PDF)" (o "justificante"), fecha/método.

Propuesto:

> "Descargar factura (PDF)", fecha/método.

Por qué: E-1. ⚠️ **E-4 sigue abierta:** si quedan justificantes emitidos (staging 9, producción sin medir),
qué enseñan sus páginas lo decide SCRUM-825; el máster describe el producto de aquí en adelante.

**N5 (L435) no cambia:** sus literales («Pagar [importe]», «He pagado por Bizum», «Confirmar Bizum
recibido», «Pago recibido. ¡Gracias!») solo se pintan donde hay cobro. La confirmación de la aceptación
(«¡Presupuesto aceptado y firmado! [Negocio] ya tiene tu confirmación.») es verdad sin cobro. **N2
(L425-L426) no cambia:** la página solo existe si hay un cobro. **N1 (L423)** es la pregunta P-5 (§7).

### 2.14 · Parte U — VALIDA-0: V0-0 (L977) y su resumen (L956)

V0-0 es el paso que introdujo el justificante. No se borra: se anota con su motivo.

L977, hoy dice:

> - **V0-0 · Flag de facturación ES:** `INVOICING_ES_ENABLED=false` para merchants ES reales no-demo hasta SIF-1 (flag por merchant/país). Demo conserva facturas con marca de agua "DEMO — no válida fiscalmente" en PDF y pantalla. Done: imposible emitir factura fiscal a un real. Rollback: flag.

Propuesto (se conserva la línea y se añade al final):

> - **V0-0 · Flag de facturación ES:** `INVOICING_ES_ENABLED=false` para merchants ES reales no-demo hasta SIF-1 (flag por merchant/país). Demo conserva facturas con marca de agua "DEMO — no válida fiscalmente" en PDF y pantalla. Done: imposible emitir factura fiscal a un real. Rollback: flag. **⚠️ Ampliado por SCRUM-612 (18-sep-2026): con el interruptor en OFF tampoco se emite el justificante `J-` que este paso introdujo, ni se cobra por YaQu (regla 24). Done nuevo: imposible emitir NINGÚN documento a un merchant ES real con el interruptor en OFF, e imposible cobrarle por YaQu. Lo ejecuta SCRUM-825; hasta que esté en `main`, V0-0 vuelve a 🟡.**

L956, hoy dice:

> V0-0 ✅ (`INVOICING_ES_ENABLED` off + justificante `J-` + watermark DEMO)

Propuesto:

> V0-0 🟡 (`INVOICING_ES_ENABLED` off + ~~justificante `J-`~~ **ningún documento ni cobro con el interruptor en OFF: SCRUM-612, lo ejecuta SCRUM-825** + watermark DEMO)

Por qué: el «Done» de V0-0 deja de ser verdad el día que se firme esto, y el registro no puede seguir
diciendo ✅ sobre un comportamiento que la regla 24 retira. **Volver a 🟡 es una decisión del registro (Parte
U)**: si el jefe prefiere una línea V0-0b nueva con el mismo texto, vale igual (P-6, §7).

### 2.15 · Parte U — V0-6, el alcance de los founding, L985

Hoy dice (el resto de la línea no cambia):

> "presupuestos+firma+cobro; la facturación VeriFactu se activa al cerrar la certificación, sin cambio de precio"

Propuesto:

> "presupuestos+firma+**albaranes**; **el cobro a tus clientes y** la facturación VeriFactu se activa**n** al cerrar la certificación, sin cambio de precio"

Por qué: es el alcance que firma un founding ANTES de pagar su suscripción, y hoy incluye «cobro» entre
lo que ya tiene; con B, en España, eso no es verdad hasta SIF-1. ⚠️ Dos límites declarados: (1) «se activan
al cerrar la certificación» es una promesa que **ya estaba** en el texto; este borrador no la añade, solo
mueve el cobro a ella. Si se promete o no es E-6 y del asesor. (2) El documento al que apunta,
`docs/legal/ALCANCE_BETA.md`, dice lo mismo y hay que cambiarlo también (§8); su línea 5 lo marca como
borrador «NO usar con clientes hasta el visto bueno del asesor».

### 2.16 · Parte V — V3, anticipos, L1622

Hoy dice (el principio de la línea no cambia):

> Pre-SIF: señal con recibo no fiscal (coherente con flag). Post-SIF: implementar el dictamen (regla 32).

Propuesto:

> Pre-SIF **(interruptor en OFF): no hay señal por YaQu ni documento de ningún tipo (regla 24); si el profesional pacta una señal con su cliente, la cobra por fuera.** Post-SIF: implementar el dictamen (regla 32).

Por qué: el «recibo no fiscal» es el justificante con otro nombre.

### 2.17 · Parte Q — el E2E crítico, L571

Hoy dice:

> - **E2E crítico (release blocker):** registro→onboarding→producto→quote→WA→landing→firma→factura/justificante→pago (cada método)→estados BD esperados (status, paidAt, paid_via, eventos)→confirmaciones WA/email→PDF.

Propuesto:

> - **E2E crítico (release blocker):** registro→onboarding→producto→quote→WA→landing→firma→factura→pago (cada método)→estados BD esperados (status, paidAt, paid_via, eventos)→confirmaciones WA/email→PDF, **en un merchant que factura (demo, de fuera de España, o español con el interruptor en ON). Y su espejo: un merchant ES real con el interruptor en OFF llega a la firma y ahí acaba — ningún documento, ningún enlace de pago, ningún recordatorio de cobro (regla 24).**

Por qué: si el bloqueante de release no prueba el lado OFF, una regresión que vuelva a emitir un `J-` pasa
en verde.

---

## 3 · El texto propuesto — `CLAUDE.md` (también derivado, también de un jefe)

### 3.1 · L6-L7, la cabecera

Hoy dice:

> **YaQu** — cobro por WhatsApp para oficios en España: presupuesto en 30s → WhatsApp con botones →
> firma del cliente → cobro de señal/total → (post SIF-1) factura VeriFactu. España-first.

Propuesto:

> **YaQu** — cobro por WhatsApp para oficios en España: presupuesto en 30s → WhatsApp con botones →
> firma del cliente → (post SIF-1) factura VeriFactu → cobro de señal/total. **Antes de SIF-1, en España,
> ni documento ni cobro por YaQu (regla 24; SCRUM-612).** España-first.

Por qué: pone el cobro ANTES de la factura, que es el orden que B invierte («no se cobra hasta que no haya
factura»). Es la primera frase que lee toda sesión.

### 3.2 · L89-L90, regla dura 7

Hoy dice:

> 7. **Cero claims fiscales hasta SIF-1 8/8** (reglas 17/24/26): `INVOICING_ES_ENABLED=OFF` para
>    merchants ES reales; demo con marca de agua; la pregunta VeriFactu se responde SOLO con el guion H2.

Propuesto:

> 7. **Cero claims fiscales hasta SIF-1 8/8** (reglas 17/24/26): `INVOICING_ES_ENABLED=OFF` para
>    merchants ES reales **—y con OFF, ni documento ni cobro por YaQu (regla 24)—**; demo con marca de agua; la pregunta VeriFactu se responde SOLO con el guion H2.

### 3.3 · L91-L92, regla dura 8

Hoy dice:

> 8. **Tarjeta real solo con Stripe Connect activo en ese merchant** (reglas 18/23). PROHIBIDO
>    procesar pagos de clientes finales en la cuenta Stripe de plataforma. Mientras: transferencia/Bizum manual.

Propuesto:

> 8. **Tarjeta real solo con Stripe Connect activo en ese merchant** (reglas 18/23). PROHIBIDO
>    procesar pagos de clientes finales en la cuenta Stripe de plataforma. Mientras: transferencia/Bizum manual **—en España, solo con `INVOICING_ES_ENABLED` en ON (regla 24)—**.

**No cambian** en `CLAUDE.md`: L44 (el STOP de «dinero real o flujo de cobro en producción»), L65, L147,
L151 y L167.

### 3.4 · `.claude/**` (derivado, de un jefe): nada que proponer con la enmienda

- `.claude/skills/verifactu/SKILL.md:38` («1. Decide qué documento corresponde (factura / justificante /
  ninguno)») describe el CÓDIGO: cambia cuando se ejecute SCRUM-825, no cuando se firme esto.
- `.claude/skills/cerebro-yaqu/SKILL.md:94` («INVOICING_ES_ENABLED OFF para merchants reales») sigue siendo
  verdad.
- **Visto de paso, fuera de este encargo y anterior a él:** `.claude/skills/verifactu/SKILL.md:271` dice
  que `INVOICING_ES_ENABLED` está «off para merchants reales» y remata «Sin excepción.», y el máster tiene desde el 19-ago
  la EXCEPCIÓN THE PIONEER (L477 en adelante), que lo enciende para un merchant real con la llave auditada.
  Se reporta; no se toca.

---

## 4 · Lo que choca con B en lo COMERCIAL — se señala y NO se redacta (E-5 y E-6)

Con B, antes de SIF-1 un profesional español no cobra por YaQu. Estas líneas venden precisamente eso. **No
se propone texto** porque el argumentario (E-6) y el guion H2 (E-5) siguen abiertos, son de J4 y los firma
un jefe. Lo que sí es de este borrador es decir dónde están:

| línea | literal de hoy | por qué choca |
|---|---|---|
| L52 (A1, promesa de calle) | "Cobra la señal antes de empezar y no persigas a nadie nunca más." | es la promesa primaria, y antes de SIF-1 no se cumple en España |
| L90 (B1, España) | Competencia "gratis" Kit Digital → vender cobro, no factura | la estrategia es vender justo lo que B apaga hasta SIF-1 |
| L214 (H2, Etapa 1 = **pre-SIF**) | categoría = "herramienta para presupuestar, firmar y cobrar señales por WhatsApp" | la categoría de venta ANTES de SIF-1 incluye cobrar |
| L214 (el guion H2, regla 26) | por eso la beta es de presupuestos y cobros | el guion que la regla 26 declara única respuesta dice que la beta cobra. Es E-5, y el guion ya está en revisión por decir cosas falsas (SCRUM-534, J4) |
| L225, L226, L227 (H5, guiones) | te paga la señal antes de que empieces · señal cobrada antes de empezar y recordatorios que persiguen al que no paga · señal cobrada antes de empezar | guiones de calle |
| L231 (H6) | no cobra la señal y no persigue al moroso solo | objeción → respuesta |
| L234 (H7) y L1839 (AB5, héroe de la landing) | "¿Cuántas señales has dejado de cobrar este mes?" | mensaje titular |
| L245 (regla 26b) | el gancho comercial nº1 es la MOROSIDAD/el cobro | la regla fija el gancho en lo que B deja para después de SIF-1 |
| L437 (N5, A22 · landing) | **"El ERP por WhatsApp para los oficios · Del presupuesto al cobro, sin salir de WhatsApp"** | ⚠️ la landing PÚBLICA ofrece cobros («Seis herramientas»: cobros) y su copy oficial es el de `public/index.html` (S2/S4): ofrece hoy una función que, firmado esto, en España no existe hasta SIF-1 |
| L985 (V0-6, vídeo) | 40-52s paga la seña[l] | el vídeo de calle enseña el pago |
| L78 (A5, métrica norte F1) | **% de cobros del merchant vía plataforma** (instrumentar desde el día 1) | con B, en España, ese porcentaje es 0 hasta SIF-1: la métrica de F1 (30-sep-2026) no se puede mover. Decisión de un jefe |
| L1634 (W1, qué incluye el plan) | cobros todos los métodos | el plan que se paga incluye una función apagada hasta SIF-1 (PRECIOS-1) |

**No chocan, comprobado:** L215 (Etapa 2 es post-SIF) y L1061 (GTM-1 va detrás de SIF-1 8/8, L1044).

---

## 5 · Lo que la regla 24 nueva acota sin tocarle el texto (CUBIERTA, 50 líneas)

Describen el cobro **cuando existe**: siguen siendo verdad después de SIF-1, fuera de España y en el
merchant demo. La regla 24 nueva (§2.1) y la línea de precedencia de la Parte P (§2.3) las acotan. Las
líneas: A2 L59 · C1 L124-L125 · C2 L133 · L136 · D3 L165-L166 · Parte E L177-L178 · reglas 10, 22 y 23
(L241, L244) · plantillas J1 L293-L295 y la nota de L299 · J6 L319 · K1 L375, L384, L386 · Charge L399 ·
readiness L408 · M L414 · N2 L425-L426 · N5 L435 · runbooks L444-L447 y L455 · filas de Parte P L465-L467 ·
Q L575-L576, L580 · MANT-1 L602 · CONNECT-1 L971, L1046-L1049, L1051 · V0-3 L982 · V2 L1621 · V6, V8, V9
L1625, L1627, L1628 · W4 L1636 · X2 L1681.

Dos, con nota:

- **L299** («copy neutro **"tu documento de cobro"** (válido para factura y justificante)»): la mitad
  «justificante» queda sin objeto, pero el texto vale para la factura y **las plantillas de Meta son STOP de
  un jefe**. No se propone cambio.
- **K1 (BOT-1, F2):** «Pagar pendiente» saldrá vacío en un merchant español en OFF (no hay cobros). Es
  especificación F2; no se toca.

---

## 6 · Microcopy — ⛔ PROPUESTA SIN FIRMA (regla 39): nada de esto se escribe en el código hasta que un jefe lo firme

**Lo comprobado antes de proponer:**

- `MICROCOPY_BLOQUEADA` (`tests/scrum302-rotulos-completos.test.mjs:78`) tiene **una** clave:
  `btnConvertirFactura`, bloqueada por `docs/legal/PREGUNTAS_ASESOR.md` §G (L187, pregunta 25). **No se
  propone texto para ella.**
- `docs/legal/PREGUNTAS_ASESOR.md`: §G bloquea lo que le dice al profesional qué puede cobrarle a su
  cliente; P14 (L419) y P16.1 (L648) tratan el justificante; C.10 (L67) el alcance founding. **Ninguna
  pregunta abierta cubre un aviso de «no se emite / no se cobra».**
- **La regla 26, tal como la aplica hoy el código** (`invoicesView.js:217`): «NO se acompaña de ningún
  texto que explique POR QUÉ sale un justificante». Por eso **ninguna propuesta explica por qué**: ni
  VeriFactu, ni Hacienda, ni la AEAT, ni fechas.
- **El hueco sin texto ya existe:** el panel tiene un tercer modo, `'no'` (`app.js:44`: «Son TRES valores
  —'factura' | 'justificante' | 'no'—»), y en él el botón de nuevo documento **no se pinta**
  (`invoicesView.js:208`). En Facturas no hace falta texto nuevo.
- El 409 `facturacion_no_disponible` estaba **parado por lo que nombra** (`albaranes.routes.ts:1333`: «el
  justificante está retirado y lo que se emite en su lugar no tiene nombre todavía»). Con E-1 ya se sabe:
  no se emite nada. **Ahora se puede redactar.**

| # | dónde | hoy dice | PROPUESTA SIN FIRMA |
|---|---|---|---|
| M-1 | Ajustes, fila del modo de emisión: título (`settingsView.js:39`) | «Se emiten justificantes de cobro» | «La facturación no está activa en tu cuenta» |
| M-2 | la misma fila: detalle (`settingsView.js:44`) | «Cada cobro genera un justificante para tu cliente, con su propia referencia. No es una factura y no consume tu serie de facturación.» | «YaQu no emite documentos ni gestiona cobros en tu cuenta: cobra a tus clientes como lo haces habitualmente. Presupuestos, firmas y albaranes funcionan con normalidad.» |
| M-3 | Ajustes, datos fiscales, cuando faltan (`settingsView.js:1287`) | «Sin ellos, el documento tras el pago es un justificante de cobro» | «Sin ellos no se pueden emitir facturas» |
| M-4 | Facturas, botón de nuevo documento (`invoicesView.js:223`) | «+ Nuevo justificante» | **ningún texto**: el botón no se pinta, como ya hace hoy el modo `'no'` |
| M-5 | la respuesta cuando algo pide un documento o un cobro con el interruptor en OFF (hoy `facturacion_no_disponible`: `albaranes.routes.ts:1224` y `:1319` dicen «La facturación por partes no está disponible en este modo.»; `:1434` y `:1626`, el marcador) | (ver columna anterior) | «La facturación no está activa en tu cuenta, así que desde aquí no se genera ningún documento ni ningún cobro.» |
| M-6 | presupuesto y Trabajo, donde hoy salen los botones de cobro (lista de pantallas en §1.2 de arriba) | (los rótulos de hoy) | **ningún texto**: los botones no se pintan |

Notas para quien firme:

- **M-1, M-2 y M-5 nombran la facturación en negativo.** No es un claim (no dice que cumpla nada), pero
  choca con la letra de la Parte M («el copy NUNCA dice "factura"»): por eso §2.12 propone cambiar esa
  cláusula. Si no se acepta, M-1, M-2 y M-5 se reescriben sin la palabra.
- **M-2 dice «cobra a tus clientes como lo haces habitualmente»:** pasa a pantalla la frase del 15950 («El
  profesional cobra por fuera de YaQu hasta que exista la factura»). Sin ella, el profesional ve que el
  cobro ha desaparecido y no sabe si es un fallo.
- **M-5 es un solo texto para todas las bocas** (las que ya cortan con 409 y las que SCRUM-825 hará cortar
  antes de pedir número, §3.b de arriba). Lo ve el profesional si una pestaña vieja o un doble clic llega al
  servidor.
- **Lo que ve el CLIENTE no se propone aquí** (es de S1 y J2): pregunta P-5.

---

## 7 · Preguntas para el jefe que firme (este borrador no las decide)

| # | pregunta | lo que asume el borrador |
|---|---|---|
| P-1 | **El merchant demo** (id=1): ¿sigue emitiendo factura con marca de agua y cobrando en TEST? | Sí: la regla 24 ya dice «facturas demo con marca de agua SIEMPRE», y el modo `demo` se decide en `emission.service.ts:39`, una línea ANTES de leer el interruptor (`:40`). Si no, es una frase en §2.1 |
| P-2 | **Un enlace de pago YA enviado** en un merchant que tenía el interruptor en ON (The Pioneer) cuando se apaga: ¿sigue cobrando? | Que sí: detrás hay una factura, y B dice «no se cobra hasta que no haya factura», no «no se cobra con el interruptor en OFF». Lo ejecuta SCRUM-825 |
| P-3 | **Merchants forales** (PV/Navarra): la regla 33 les bloquea la facturación. Con B, **tampoco cobran por YaQu** hasta que exista TicketBAI, que es cajón F3 | Nada: se señala la consecuencia |
| P-4 | **La métrica norte de F1** (L78, «% de cobros del merchant vía plataforma»): con B es 0 en España hasta SIF-1 | Nada: decisión de un jefe |
| P-5 | **La página del cliente** (N1, L423) enseña las condiciones de pago («Señal del 50 % al aceptar · resto al terminar») y, con el interruptor en OFF, después de aceptar **no hay botón de pagar**. ¿Necesita una línea? | Nada: la página es de S1 y el paso de pago de J2; si hace falta, la proponen ellos y la firma un jefe |
| P-6 | **V0-0 vuelve a 🟡** (§2.14), ¿o línea nueva V0-0b? | 🟡 con la anotación |
| P-7 | **La regla 25** («Cobro a founding pre-SIF…», L245) es la suscripción de YaQu al profesional, no el cobro del profesional a su cliente | No se toca: el 15949 preguntó y el 15950 decidió sobre lo segundo. Si Javier quiso incluir también la suscripción, es otra decisión y no está escrita |

**Y lo que NO cambia, comprobado:** la EXCEPCIÓN THE PIONEER (L477-L569; L487: «`INVOICING_ES_ENABLED`
sigue estando **off para merchants reales**.»). Un merchant con el interruptor en ON por la llave auditada
factura y cobra; E-1 y B hablan del OFF.

---

## 8 · Otros documentos que la decisión deja desfasados (ni máster ni `CLAUDE.md`; no se redactan aquí)

| fichero | qué dice hoy | de quién |
|---|---|---|
| `docs/legal/ALCANCE_BETA.md` L21-L22 (y §2) | «**Cobro integrado**: tu cliente paga desde el móvil; recordatorios automáticos de cobro.» · «**Justificantes de cobro** por cada pago recibido (documento no fiscal).» | J4 propone, firma un jefe. Es borrador «NO usar con clientes hasta el visto bueno del asesor» (L5) |
| `docs/legal/PREGUNTAS_ASESOR.md` L419 (P14, tabla A) y L648 (P16.1) | el merchant español real en OFF emite «Justificante de cobro, serie `J-…`» | J4. P16.1 (¿el justificante entra en el registro?) sigue viva mientras E-4 esté abierta |
| `docs/QA_MASTER.md` (4 menciones de «justificante»), `docs/WHATSAPP_TEMPLATES.md` (2), `docs/RUNBOOKS.md` (1) | — | se actualizan con la ejecución (SCRUM-825). ⚠️ Solo contadas (`git grep -c`), **no leídas** |

**El código** no se propone aquí: lo enumeró la entrega anterior (§3.b de arriba) y es SCRUM-825.

---

## 9 · Evidencias y cómo repetirlo

| fichero | qué es |
|---|---|
| `censo-enmienda-612.mjs` | el censo por contenido, la clasificación comparada por conjuntos y la comprobación de las 82 citas |
| `salida-censo-enmienda-612.txt` | su salida en `17b0c86b` (sin la lista de líneas; se saca con `--lineas`) |

    node docs/master/evidencias/SCRUM-612/censo-enmienda-612.mjs . origin/main            # resumen, controles, clases, citas
    node docs/master/evidencias/SCRUM-612/censo-enmienda-612.mjs . origin/main --lineas   # + cada línea casada, con su sección

**Antes de pegar nada en el máster, se corre contra el `origin/main` de ese día:** si una cita salió de su
línea, lo dice y dice dónde está ahora.

---

## 10 · Errores propios (A9)

1. **Un control escrito de memoria.** El primer control positivo buscaba `vuelve a justificante`, copiado
   de mi traspaso. El máster dice `vuelve a "justificante"`, con comillas. El control **FALLÓ** (EXIT=1) y
   se arregló leyendo la línea. Es el mismo error que el control existía para cazar.
2. **Una cita partida.** Cité `ALCANCE_BETA.md:5` con la frase entera, y la frase sigue en la línea 6. Lo
   cazó la comprobación de citas (74 de 75) antes de escribir el borrador.
3. **Una pasada exploratoria con `FORCE_COLOR` puesto** (salió con color: el entorno lo hereda). No era una
   medición que se entregue; las que se entregan se corrieron sin él y el log lo declara en su segunda línea.

## 11 · Lo que NO se ha tocado

`docs/YAQU_MASTER.md`, `CLAUDE.md`, `.claude/`, `src/`, `public/`, `prisma/`, `tests/`: ni una línea. Ni
bases de datos ni producción. Ni Jira: este borrador no abre ni cierra nada.

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

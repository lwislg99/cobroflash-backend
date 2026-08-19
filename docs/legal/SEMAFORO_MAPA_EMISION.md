# MAPA DE LA SUPERFICIE DE EMISIÓN — SCRUM-200

> **RECON. No cambia ni una línea de código de producto.** Mide la superficie por la que puede
> acabar existiendo una factura, antes de poder decidir dónde se ponen los frenos.
>
> **Ejecutado el 29-jul-2026** sobre `origin/main` en **`0b6e8d3`**. Worktree propio
> (`scrum-200-mapa-emision`). No toca staging, no toca schema, no toca la cadena VeriFactu.
>
> **Método (R1):** todo lo que entra aquí está leído en el código, con fichero:línea comprobado
> uno a uno. Graphify se usó solo como generador de candidatos — su balance está en el §9.

---

> ## 🔴 AVISO DE VIGENCIA — SCRUM-513 (17-ago-2026)
>
> **Los enlaces de este documento ya NO llevan número de línea, y es a propósito.** Llevaban 75
> anclas `#L<n>` y, medidas contra el árbol de hoy, **41 de las 43 comprobables apuntaban a otro
> sitio** (las 32 restantes no eran comprobables por el instrumento; el método y los números están
> en `docs/master/SCRUM-513.md`). Un desvío típico era de más de cien líneas, así que no se trataba
> de un enlace despistado: el sistema de coordenadas entero había caducado.
>
> **Se han QUITADO los números en vez de actualizarlos.** Quitar una coordenada equivocada no
> afirma nada; escribir 41 coordenadas nuevas sin verificar cada una a mano sería inventar una
> medición, y además volverían a derivar con el siguiente commit. Ahora se apunta al **fichero y al
> SÍMBOLO** (nombre de función, constante o código de error), que es lo único que sobrevive a que
> alguien añada un import diez líneas más arriba.
>
> **⚠️ LO QUE ESTE AVISO *NO* HACE, dicho en voz alta:** SCRUM-513 corrigió coordenadas, **no
> re-midió las afirmaciones**. Este documento es un RECON del 29-jul-2026 y hay al menos dos sitios
> cuyo contenido parece superado por tickets posteriores: la fila *«Cualquier fallo de sellado →
> SIGUE, sin rastro»* de §6.3 (SCRUM-205/206 dicen haber cerrado ese fail-open) y el §*«AuditLog no
> cubre lo fiscal»* (SCRUM-207 añadió `factura_emitida` y las acciones bloqueantes). **Están
> marcados donde tocan y NO se han reescrito aquí**: cambiarlos exige re-medir cada uno, que es otro
> trabajo con su propia evidencia. Hasta entonces, para el estado de hoy manda el código, no esta
> foto.

---

## 1. La respuesta, primero

**¿Existe un punto único por el que pase toda emisión, o hay que crearlo?**

**Las dos cosas, y esa es la buena noticia.** No hay un punto único de *emisión*: hay **7 sitios
distintos que crean una factura** repartidos en **6 ficheros**. Pero sí hay un punto único de
**numeración**: los 7 pasan, sin excepción, por
[`allocateInvoiceNumber()`](../../src/modules/invoicing/domain/invoiceNumber.service.ts).

Ese embudo ya existe, ya está en el sitio correcto (dentro de la transacción que crea la factura)
y **ya se usa como gate fiscal**: es donde vive hoy el interruptor `INVOICING_ES_ENABLED`, en
[invoiceNumber.service.ts](../../src/modules/invoicing/domain/invoiceNumber.service.ts).

> **Pero no vale tal cual, por una razón concreta de firma:** `allocateInvoiceNumber(tx,
> merchantId, opts, now)` **solo recibe el `merchantId`**. No ve las líneas, ni el cliente, ni las
> fechas, ni el importe. Puede decidir *"este merchant emite o no emite"*, y no puede decidir
> *"esta factura cumple o no cumple"* — que es exactamente lo que pide el criterio de IMPEDIR.

**Conclusión operativa:** no hay que crear un embudo desde cero ni reescribir la emisión. Hay que
**darle contenido al embudo que ya existe** — que reciba la factura, no solo su emisor. Es un
cambio de firma y sus 7 llamadores, no una refactorización de la emisión.

**El matiz vinculante encaja limpio con esta forma.** Impedir lo ROJO cabe dentro de
`allocateInvoiceNumber` (antes de consumir número: si no se numera, no hay factura). Avisar lo
ÁMBAR **no** cabe ahí — un aviso que el usuario decide es interacción, y ocurre antes, en cada
camino. Son dos mecanismos en dos sitios, no uno.

---

## 2. P1 · Los caminos de emisión

### 2.1 Los 7 sitios que CREAN una factura

| # | Camino | Ruta / disparador | Guard de acceso | Crea en |
|---|---|---|---|---|
| **C1** | **Cliente acepta el presupuesto** | `POST /quote/:token/decision` · `/accept` — **el CLIENTE**, desde WhatsApp | ⚠️ **Sin login**: token opaco + rate-limit ([quotes.routes.ts](../../src/modules/quotes/app/routes/quotes.routes.ts)) | [quotes.routes.ts](../../src/modules/quotes/app/routes/quotes.routes.ts) |
| **C2** | **Cobrar el resto** | `POST /admin/jobs/:id/collect-rest` — el pro | `requireRole('admin')` ([jobs.routes.ts](../../src/modules/jobs/app/routes/jobs.routes.ts)) | [jobs.routes.ts](../../src/modules/jobs/app/routes/jobs.routes.ts) |
| **C3** | **Facturar un presupuesto** | `POST /admin/quotes/:id/invoice` | `requireRole('admin')` ([quotesAdmin.routes.ts](../../src/modules/system/app/routes/quotesAdmin.routes.ts)) | [quotesAdmin.routes.ts](../../src/modules/system/app/routes/quotesAdmin.routes.ts) |
| **C4** | **Emisión manual** (SCRUM-178) | `POST /admin/quotes/:id/invoice-manual` | `requireRole('admin')` ([quotesAdmin.routes.ts](../../src/modules/system/app/routes/quotesAdmin.routes.ts)) | [quotesAdmin.routes.ts](../../src/modules/system/app/routes/quotesAdmin.routes.ts) |
| **C5** | **Rectificativa R1** (SCRUM-153) | `POST /admin/invoices/:id/rectify` | `requireRole('admin')` ([invoicesAdmin.routes.ts](../../src/modules/system/app/routes/invoicesAdmin.routes.ts)) | [invoicesAdmin.routes.ts](../../src/modules/system/app/routes/invoicesAdmin.routes.ts) |
| **C6** | **Cobro pagado → factura** | `ensureInvoiceForCharge()` — **webhooks e interno** (§2.2) | según el llamador | [lib/invoicing.ts](../../src/lib/invoicing.ts) |
| **C7** | **`emitInvoice()` compartido** | recapitulativas y albarán parcial (§2.3) | según el llamador | [invoicing.service.ts](../../src/modules/invoicing/domain/invoicing.service.ts) |

### 2.2 C6 — los disparadores NO de interfaz (los que se olvidan)

`ensureInvoiceForCharge()` es un solo cuerpo con **cuatro bocas**, tres de ellas sin usuario delante:

| Boca | Ruta | Disparador | Guard |
|---|---|---|---|
| **Webhook Mercado Pago** | `POST /webhooks/mp` | **el PSP**, no una persona ([mpWebhook.routes.ts](../../src/modules/billing/app/routes/mpWebhook.routes.ts)) | firma del webhook |
| **Webhook PSP genérico** | `POST /webhooks/psp` | **el PSP** ([psp.routes.ts](../../src/modules/billing/app/routes/psp.routes.ts)) | `requireInternalSecret` ([app.ts](../../src/app.ts)) |
| **API de cobros** | `/charges` | interno ([psp.routes.ts](../../src/modules/billing/app/routes/psp.routes.ts)) | `requireInternalSecret` ([app.ts](../../src/app.ts)) |
| **API de emisión** | `POST /invoice/issue` | interno ([invoice.routes.ts](../../src/modules/invoicing/app/routes/invoice.routes.ts)) | `requireInternalSecret` ([app.ts](../../src/app.ts)) |

*(Existe una quinta boca en [dev.routes.ts](../../src/modules/system/app/routes/dev.routes.ts), montada solo si `NODE_ENV !== 'production'` — [app.ts](../../src/app.ts). No cuenta como camino de producción.)*

### 2.3 C7 — los dos llamadores de `emitInvoice()`

| Llamador | Ruta | Guard |
|---|---|---|
| **Recapitulativa** (art. 13, SCRUM-17/171a) | `POST /admin/jobs/:id/consolidar-albaranes` ([jobs.routes.ts](../../src/modules/jobs/app/routes/jobs.routes.ts)) y la vía de ámbito CLIENTE (`/admin/albaranes/consolidar`, [albaranes.routes.ts](../../src/modules/jobs/app/routes/albaranes.routes.ts)) → ambas por [recapitulativa.service.ts](../../src/modules/jobs/domain/recapitulativa.service.ts) | `requireRole('admin')` |
| **Albarán parcial** (SCRUM-170) | `POST /admin/albaranes/:id/facturar-parcial` ([albaranes.routes.ts](../../src/modules/jobs/app/routes/albaranes.routes.ts)) → [albaranes.routes.ts](../../src/modules/jobs/app/routes/albaranes.routes.ts) | `requireRole('admin')` |

### 2.4 Negativos verificados — dónde NO hay emisión

Esto se midió porque el ticket lo pide explícitamente, y el resultado **negativo también es dato**:

| Superficie | Resultado | Cómo se comprobó |
|---|---|---|
| **Los 5 crons** (`expireQuotes`, recordatorios de presupuesto y de factura, mantenimientos, digest semanal, lifecycle) | 🟢 **Ninguno emite** | Leídos los 6 servicios de [cron.ts](../../src/core/cron/cron.ts): cero primitivas de emisión en los seis |
| **Bot de WhatsApp** (`/webhooks/whatsapp`, `botFlow.service.ts`) | 🟢 **No emite** | Módulo `whatsappBot/` completo: cero primitivas |
| **Webhooks de Stripe** (`/webhooks/stripe`, `/webhooks/stripe-connect`) | 🟢 **No emiten** | Sin `invoice.create` ni `ensureInvoiceForCharge` |

> **Ojo con la lectura de esto:** hoy ningún cron emite, pero **el bot y los crons SÍ disparan
> WhatsApp**, y `POST /quote/:token/decision` está al otro lado de ese WhatsApp. La cadena
> *bot → mensaje → cliente pulsa → C1 emite* existe; lo que no existe es un cron que emita por
> sí solo. Un freno que solo mire "peticiones con sesión de admin" no ve C1.

---

## 3. P2 · Qué valida cada camino — **y no validan lo mismo**

| Camino | Gate de rol | Gate de modo fiscal | Validación de negocio propia | **¿Sella VeriFactu?** |
|---|---|---|---|---|
| **C1** cliente acepta | ❌ ninguno (token) | solo el implícito de `allocateInvoiceNumber` | plan de facturación y tramo ([quotes.routes.ts](../../src/modules/quotes/app/routes/quotes.routes.ts)) | 🔴 **NO** |
| **C2** collect-rest | `admin` | solo el implícito | `job.status==='terminado'`, `quoteId`, tramo pendiente ([jobs.routes.ts](../../src/modules/jobs/app/routes/jobs.routes.ts)) | 🔴 **NO** |
| **C3** facturar presupuesto | `admin` | implícito | — | ✅ [quotesAdmin.routes.ts](../../src/modules/system/app/routes/quotesAdmin.routes.ts) |
| **C4** emisión manual | `admin` | implícito | — | ✅ [quotesAdmin.routes.ts](../../src/modules/system/app/routes/quotesAdmin.routes.ts) |
| **C5** rectificativa R1 | `admin` | implícito + serie R (`isReceiptNumber`) | — | ✅ [invoicesAdmin.routes.ts](../../src/modules/system/app/routes/invoicesAdmin.routes.ts) · `sellarTrasEmision` |
| **C6** cobro→factura | según boca | implícito | `charge.status==='paid'` ([lib/invoicing.ts](../../src/lib/invoicing.ts)) | ✅ [lib/invoicing.ts](../../src/lib/invoicing.ts) |
| **C7a** recapitulativa | `admin` | ✅ **explícito** `getEmissionMode` ([jobs.routes.ts](../../src/modules/jobs/app/routes/jobs.routes.ts), [albaranes.routes.ts](../../src/modules/jobs/app/routes/albaranes.routes.ts)) | `validarConsolidacion` + rotura art. 13 ([jobs.routes.ts](../../src/modules/jobs/app/routes/jobs.routes.ts)) | ✅ [recapitulativa.service.ts](../../src/modules/jobs/domain/recapitulativa.service.ts) |
| **C7b** albarán parcial | `admin` | ✅ **explícito** ([albaranes.routes.ts](../../src/modules/jobs/app/routes/albaranes.routes.ts)) | — | ✅ [albaranes.routes.ts](../../src/modules/jobs/app/routes/albaranes.routes.ts) |

**Tres asimetrías, todas verificadas leyendo:**

1. **🔴 C1 y C2 crean una factura `F1` con número consumido y NO la sellan.** Ninguno de los dos
   llama a `applyVeriFactu`. Se comprobó también el eslabón que parecía taparlo:
   `sendInvoicePaymentRequest()` ([invoiceWhatsApp.service.ts](../../src/modules/billing/domain/invoiceWhatsApp.service.ts)),
   que los dos invocan después, **no sella ni genera PDF**. La factura queda numerada y sin huella
   hasta que *alguien, alguna vez*, renderice su PDF (§5).
2. **El gate de rol es desigual por diseño… salvo en C1.** Cinco caminos exigen `admin`; C1 no
   exige nada porque quien actúa es el cliente. Es coherente con el producto y a la vez significa
   que **el camino menos protegido es el más transitado**.
3. **El gate de modo fiscal se comprueba dos veces en C7 y una sola en el resto.** C7a/C7b lo
   miran explícitamente y devuelven `409` antes de tocar nada; los demás confían en que
   `allocateInvoiceNumber` degrade a justificante. El resultado es el mismo, el mensaje al usuario no.

---

## 4. P3 · Dónde viven las reglas fiscales — **¿se pueden enumerar?**

**Parcialmente, y la parte que falta es la que hace falta.** Están en tres capas de naturaleza distinta:

| Capa | Dónde | ¿Enumerable? |
|---|---|---|
| **Modo de emisión** (fiscal vs justificante) | [emission.service.ts](../../src/modules/invoicing/domain/emission.service.ts) — una función, un flag, precedencia merchant > país > env | ✅ **Sí.** Una sola regla, un solo sitio |
| **Numeración y series** | [invoiceNumber.service.ts](../../src/modules/invoicing/domain/invoiceNumber.service.ts) — serie anual, serie R separada, reset de año, J- para justificantes | ✅ **Sí** |
| **Integridad del registro** | [verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts): sin líneas no se sella (`invoice_without_lines_not_sealable`), justificante nunca entra (`isReceiptNumber`), cerrojo por merchant (`pg_advisory_xact_lock`), cadena rota lanza (`verifactu_cadena_rota`) | ⚠️ **A medias.** Son 4 guards reales y sólidos, pero viven como `throw` dentro del sellador, no como catálogo |
| **Contenido de la factura** (lo que la AEAT valida de verdad) | **En ningún sitio** | 🔴 **No.** No existe |

**El hueco concreto.** Ninguna regla del catálogo AEAT sobre el *contenido* está implementada como
validación previa: ni destinatario obligatorio en `F1`, ni el techo de 3.000 € de la simplificada,
ni fecha de expedición ≥ 28-10-2024, ni tipos de IVA admitidos, ni cuadre de `ImporteTotal`. La
calibración de esas reglas es justo lo que produce SCRUM-201; aquí lo que se mide es que **no hay
dónde colgarlas**: no existe una función *"¿esta factura cumple?"* a la que añadirlas.

> Aplicando el criterio del propio ticket — *si no se pueden enumerar, no se pueden probar, ni
> bloquear, ni explicar* —: **las reglas de contenido no son enumerables hoy porque no existen.**
> Las de proceso (modo, serie, cadena) sí, y están mejor de lo que cabría esperar.

---

## 5. P4 · El punto de no retorno — **hay dos, y están separados en el tiempo**

Este es el hallazgo que más cambia el diseño de cualquier freno.

### Punto A — se consume el número (irreversible)

[`allocateInvoiceNumber`](../../src/modules/invoicing/domain/invoiceNumber.service.ts) hace
`merchant.update({ nextInvoiceNumber: seq + 1 })` **dentro de la misma transacción** que crea la
factura. En ese commit:

- el número existe y está consumido,
- la serie ha avanzado,
- y **un fallo posterior deja un hueco en la serie**, que es fiscalmente relevante por sí mismo.

**Un freno colocado después del commit de esa transacción no impide nada.** Es el punto de no
retorno real de los 7 caminos, y es el mismo para todos — porque el embudo de numeración es único.

### Punto B — se sella la huella (irreversible y encadenado)

`applyVeriFactu` persiste `vfHash`/`vfPrevHash`/`vfTimestamp`
([verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts)) bajo
cerrojo consultivo por merchant. A partir de ahí la factura es un eslabón: corregirla exige una R1
(regla 29).

### Lo que hace esto peligroso: **B es perezoso, y lo puede disparar el cliente**

En C1 y C2 el sellado no ocurre en la emisión. Ocurre la primera vez que se renderiza el PDF,
dentro de `ensureInvoicePdf` ([lib/invoicing.ts](../../src/lib/invoicing.ts)) — y ese
helper cuelga de cuatro sitios, uno de ellos **público**:

| Quién puede disparar el sellado | Ruta | Guard |
|---|---|---|
| 🔴 **El cliente final** | `GET /recibo/:token/pdf` ([receipt.routes.ts](../../src/modules/billing/app/routes/receipt.routes.ts)) | **sin login** — token opaco |
| El pro | `GET /admin/invoices/:id/pdf` ([invoicesAdmin.routes.ts](../../src/modules/system/app/routes/invoicesAdmin.routes.ts)) | sesión |
| Un export | `GET /admin/exports/datos.zip` ([exports.routes.ts](../../src/modules/exports/app/routes/exports.routes.ts)) | sesión |
| Un email automático | [email.service.ts](../../src/modules/messaging/domain/email.service.ts) | ninguno (proceso) |

> **En una frase:** en dos de los siete caminos, **el momento en que una factura entra en la cadena
> de huellas lo elige el cliente final descargando un PDF**, no el profesional emitiendo. El orden
> de la cadena depende de en qué orden los clientes abran sus recibos.
>
> Esto **no está roto hoy** —el cerrojo de SCRUM-173 serializa el sellado y `vfPrevHash` guarda el
> eslabón como dato— pero significa que un freno puesto "al emitir" no cubre el punto B, y que
> `INVOICING_ES_ENABLED` se evalúa en el punto A mientras la huella se calcula en el B, que puede
> ser días después.

---

## 6. P5 · Qué pasa hoy cuando algo no cumple

### 6.1 El fail-open del sellado — **el más grave, y no es el patrón que buscaba el ticket**

Los dos sitios donde se sella dentro de `lib/invoicing.ts` capturan y siguen:

```js
// lib/invoicing.ts:58-60          y          lib/invoicing.ts:152-154
} catch (e) { console.error('[ensureInvoicePdf] VeriFactu error:', e); }
} catch (e) { console.error('[verifactu] Error al aplicar VeriFactu, se omite:', e); }
```

**Consecuencia exacta, leída:** si el sellado falla, el `qrData` cae a la cadena **no fiscal**
`INV:<num>|AMOUNT:<total>|CUR:<div>` ([lib/invoicing.ts](../../src/lib/invoicing.ts)),
`vfHash` queda `null`, **el PDF se genera igual y se entrega igual**, y lo único que queda es una
línea en el log de un servidor. La factura existe, tiene número, tiene PDF y no tiene huella.

Es el **fallo mudo** exacto que describe el comentario de Javier, en el camino fiscal, y con la
palabra *«se omite»* escrita en el código. Nada en el producto lo distingue de una emisión correcta.

⚖️ **Matiz honesto, para no exagerarlo:** ese `catch` es deliberado y está argumentado en el
código — *"preferir NO sellar antes que sellar mal"*
([verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts)),
y los guards que lo alimentan (justificante, factura sin líneas) son fail-closed a propósito. **El
problema no es que capture: es que capturar no deja rastro consultable.** Falta el registro, no el `try`.

### 6.2 El patrón `process.env.X || ''` — **24 casos, 5 en el camino fiscal**

Barrido completo sobre `src/`: **24 apariciones, todas en
[core/config/env.ts](../../src/core/config/env.ts)** (ninguna dispersa). De ellas, **5 son
configuración fiscal obligatoria** — los datos del productor del SIF (art. 13 RRSIF):

`VERIFACTU_PRODUCTOR_NOMBRE` · `VERIFACTU_PRODUCTOR_NIF` · `VERIFACTU_ID_SISTEMA` ·
`VERIFACTU_VERSION` · `VERIFACTU_NUM_INSTALACION` — [env.ts](../../src/core/config/env.ts).

**Pero aquí la sospecha del ticket no se confirma, y conviene decirlo con la misma claridad que si
se hubiera confirmado.** Aguas abajo hay un guard explícito y fail-**closed**:

```js
// verifactu.service.ts:512-513
if (!productor.nombre || !productor.nif || !productor.idSistema || !productor.version || !productor.numInstalacion) {
  throw new Error('verifactu_productor_no_configurado');
}
```

Con su comentario razonándolo (en [verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts), sobre `verifactu_productor_no_configurado`):
*"un `SistemaInformatico` relleno con placeholders sería un registro fiscal que miente sobre quién
produjo el software"*. **El `|| ''` es fail-open en la lectura; el uso es fail-closed.**

⚠️ **Con una limitación real:** ese guard vive en `buildVerifactuRegistrosXml` — el **XML**. No
está en `applyVeriFactu`, que es donde se calcula la **huella**. Hoy no importa (el productor no
entra en la huella), pero significa que la protección cubre la exportación del registro, no el sellado.

### 6.3 Resumen del comportamiento

| Incumplimiento | Hoy | Fichero · símbolo |
|---|---|---|
| Merchant ES sin `INVOICING_ES_ENABLED` | 🟢 **Degrada** a justificante `J-` (no bloquea, no miente) | [invoiceNumber.service.ts](../../src/modules/invoicing/domain/invoiceNumber.service.ts) |
| Rectificativa sin flag | 🟢 **Bloquea** (`invoicing_es_disabled`) | [invoiceNumber.service.ts](../../src/modules/invoicing/domain/invoiceNumber.service.ts) |
| Factura sin líneas | 🟢 **Bloquea el sellado** (fail-closed) | [verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts) |
| Sellar dentro de una `$transaction` | 🟢 **Bloquea** (fail-closed, mensaje explícito) | [verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts) |
| Cadena rota al exportar | 🟢 **Bloquea** (`verifactu_cadena_rota`) | [verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts) |
| Productor del SIF sin configurar | 🟢 **Bloquea el XML** / ⚠️ no cubre el sellado | [verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts) |
| **Cualquier fallo de sellado** | 🔴 **SIGUE**, sin rastro consultable — ⚠️ **fila NO re-medida: SCRUM-205/206 dicen haber cerrado este fail-open. Ver el aviso al final de §6.3** | [lib/invoicing.ts](../../src/lib/invoicing.ts) · `ensureInvoicePdf` y `ensureInvoiceForCharge` |
| **Contenido fiscalmente inválido** | 🔴 **SIGUE** — no se comprueba nada | (no existe) |

---

## 7. P6 · Qué rastro queda de cada envío *(6º punto, comentario de Javier)*

**Respuesta corta: la CADENA es reconstruible; el ENVÍO no existe, así que no hay rastro que medir.**

| Pregunta del comentario | Hoy | Evidencia |
|---|---|---|
| **¿Qué se envió?** — ¿el XML exacto o solo los datos? | 🔴 **Solo los datos.** El XML se **regenera** desde la BD en cada petición | `buildVerifactuRegistrosXml` ([verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts)) construye al vuelo; no se persiste |
| **¿Cuándo?** | ⚠️ Hay `vfTimestamp`, pero es el sello de **generación de la huella**, no de envío | [schema.prisma](../../prisma/schema.prisma) |
| **¿Qué contestó la AEAT?** | 🔴 **No existe.** No hay tabla ni columna de respuesta | Sin `VfSubmission` en el schema |
| **Si falló, ¿en qué estado quedó?** | 🔴 **No existe.** Sin estado, sin reintentos | ídem |
| **¿Se puede verificar la cadena entera?** | 🟢 **Sí** — `vfPrevHash` se guarda como **dato**, no como inferencia | [schema.prisma](../../prisma/schema.prisma) · `vfPrevHash` y `vfAnulPrevHash` |
| **¿Se detecta que está rota?** | 🟠 **Sí, pero solo de rebote** | [verifactu.service.ts](../../src/modules/invoicing/domain/verifactu.service.ts) lanza `verifactu_cadena_rota` — **solo si alguien exporta el XML**. No hay chequeo proactivo |

**Lectura justa de esto, y es importante no cobrarlo como deuda:** no hay rastro de envío **porque
no hay envío**. La remisión al SIF (S1-D) no está construida y `VfSubmission` es un modelo del
máster que aún no existe en el schema. Lo que sí se puede afirmar con evidencia es que **la mitad
de trazabilidad que sí debería existir ya —la cadena— existe y es verificable**: `vfPrevHash` y
`vfAnulPrevHash` guardan exactamente lo que se hasheó.

**Los dos huecos reales, ya hoy, sin esperar a S1-D:**

1. **La detección de cadena rota es pasiva.** Se entera quien exporta. Si nadie exporta, una cadena
   rota no se descubre — el fallo mudo, otra vez.
2. **El XML no se persiste.** Cuando exista la remisión, *"regenerarlo"* no es *"lo que se envió"*:
   si el generador cambia entre el envío y la consulta, el XML reconstruido no reproduce el
   remitido. Esto hay que decidirlo **antes** de encender el envío, no después.

### Y un hueco que sí es de ahora: **AuditLog no cubre lo fiscal**

> ⚠️ **FOTO DEL 29-jul-2026, NO RE-MEDIDA (aviso de SCRUM-513).** SCRUM-207 añadió después
> `factura_emitida` —escrita DENTRO de la transacción que consume el número— y la lista de acciones
> bloqueantes. Lo que sigue describe el estado ANTERIOR a eso. No se reescribe aquí porque exige
> re-medir el módulo entero, con su propia evidencia.

`recordAudit` existe y funciona ([audit.service.ts](../../src/modules/system/audit.service.ts)),
con 8 acciones tipadas. **Ninguna es la emisión de una factura**: hay `anular_factura`,
`marcar_pagado_manual`, `deshacer_pago`, `cambio_flag`… y el propio fichero declara que *"el
AuditLog completo (login, **fiscal**, Connect…) es F2"*
(cabecera de [audit.service.ts](../../src/modules/system/audit.service.ts)).

> ⚠️ **Esto choca de frente con el MATIZ VINCULANTE.** El matiz dice que en un ÁMBAR *"queda en
> AuditLog el texto del aviso y su elección"*. Hoy **no hay ninguna acción de AuditLog para eso**,
> ni se escribe nada al emitir. Registrar la decisión del usuario ante un ámbar requiere una acción
> nueva y un call-site por camino. No es un detalle de implementación: es la mitad "demostrable"
> del compromiso, y hoy vale cero.

---

## 8. Cierre — lo que este mapa deja decidido y lo que no

**Decidido con evidencia:**

- **7 sitios de creación, 6 ficheros, 0 puntos únicos de emisión** — pero **1 embudo de numeración
  real** (`allocateInvoiceNumber`) por el que pasan los 7.
- **El embudo no sirve tal cual**: solo recibe `merchantId`. Ampliarlo es un cambio de firma + 7
  llamadores, no una reescritura.
- **Dos puntos de no retorno**, separados en el tiempo, y el segundo lo puede disparar el cliente
  final descargando un PDF.
- **Dos caminos (C1, C2) numeran sin sellar.**
- **Las reglas de proceso son enumerables; las de contenido no existen.**
- **Un fail-open real** (el `catch` del sellado) y **una sospecha no confirmada** (los `|| ''`, que
  tienen guard fail-closed aguas abajo).

**No decidido aquí, a propósito** (fuera de alcance del recon): qué se bloquea, cómo se avisa, si
el XML se persiste, y si el embudo pasa a recibir la factura entera. Eso es criterio fiscal y
diseño, y va después — con este mapa delante.

**El margen sigue intacto:** `INVOICING_ES_ENABLED` está OFF, la cadena está vacía, y ninguno de
los huecos de arriba ha producido todavía una sola irregularidad.

---

## 9. ANEXO — experimento Graphify, las 3 métricas

Instalado con `pip install graphifyy` (v**0.9.29**) en un venv **fuera del repo** (el scratchpad de
la sesión): no toca `package.json`, no se commitea, y `graphify-out/` no entra en git. `uv` no está
disponible en esta máquina, así que se usó `pip` — mismo paquete.

**1 · ¿Cuántos caminos reveló el grafo que la lectura/grep NO habrían encontrado?**

> ## **0**

Los nodos semilla que devolvió (`allocateInvoiceNumber`, `applyVeriFactu`, `emitInvoice`,
`emitirRecapitulativas`, `ensureInvoiceForCharge`, `ensureInvoicePdf`) son **exactamente** el
conjunto que ya había dado un `grep` de dos líneas sobre las mismas primitivas, ejecutado antes de
que terminara la indexación. Ninguno de los 7 sitios de creación ni ninguna de las 4 bocas de C6
salió del grafo primero.

**Por qué, en concreto:** de las 14.204 aristas, las que tocan estos nodos son casi todas
`imports` a nivel de **fichero**. Las aristas `calls` existen pero son escasas y parciales — el
grafo registró `emitirRecapitulativas → applyVeriFactu` y `ensureInvoiceForCharge →
allocateInvoiceNumber`, pero **no vio** las llamadas de `quotes.routes.ts` ni de `jobs.routes.ts`,
que son justo los dos caminos sin sellar, es decir **el hallazgo principal de este recon**. Para
"quién puede acabar emitiendo", un índice de imports responde a una pregunta más floja que la que
se hacía.

**2 · ¿Cuántos propuso que resultaron falsos al verificarlos?**

> ## **0**

No hubo falsos positivos porque no hubo propuestas propias: todo lo que señaló estaba también en
el grep. **Ni acertó de más ni se equivocó** — no aportó señal en ninguna dirección.

**3 · Tiempo de indexación y `GRAPH_REPORT.md`**

- **27 s** para 613 ficheros → **7.188 nodos / 15.378 aristas** (`graphify update . --no-cluster`).
  Rápido y sin fricción. *(Un primer intento con `--no-label` falló: ese flag es de `cluster-only`,
  no de `update`.)*
- **`GRAPH_REPORT.md` salió CON contenido: 117.881 bytes, 471 comunidades** — pero **solo tras un
  segundo comando**, `graphify cluster-only . --no-label --no-viz`. **`update` por sí solo no
  genera el informe**, y con `--no-cluster` no lo genera nunca.
- ⚠️ Dos avisos propios: 12 ficheros produjeron cero nodos y **13 ficheros `.sql` quedaron fuera
  del grafo** por falta de `tree_sitter_sql`. En un proyecto donde el schema es zona fiscal, un
  grafo que no ve el SQL tiene un punto ciego relevante.

**Recomendación (dato, no opinión):** con **(1) = 0** en el caso de uso para el que se probó, no
justifica adoptarse **como fuente de caminos**. La métrica que lo condenaba estaba bien elegida.
Puede seguir siendo útil para otras preguntas (mapa de módulos, comunidades), pero eso es otro
experimento y otro ticket. **El recon no dependió de él en ningún momento.**

---

## 10. Lo que este recon NO ha medido

Para que nadie lo dé por cubierto:

- **No se ha ejecutado nada.** Todo es lectura estática sobre `0b6e8d3`; no se levantó el servidor
  ni se tocó staging.
- **No se han medido los caminos de SCRUM-16, 18 y 20**, que el ticket cita como futuros: no
  existen en `main` a día de hoy.
- **No se ha auditado el frontend.** Un botón que llame a una de estas rutas no añade camino, pero
  sí puede añadir una forma de llegar que no se ha inventariado.
- **No se ha verificado el comportamiento con `INVOICING_ES_ENABLED` en ON**, porque no hay ningún
  merchant en ese estado. Todo lo dicho sobre el modo fiscal sale de leer el gate, no de ejercitarlo.

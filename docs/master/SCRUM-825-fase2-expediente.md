# SCRUM-825 · FASE 2 · Expediente de retirada de `JUST` — **PARA FIRMA**

**Medido contra:** `origin/main` = `56fed423` · rama `scrum-825-fase2-expediente` · 8-sep-2026

> ⚠️ La fecha es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Carril:** fiscal (camino de emisión) · **Gate:** LECTURA. **Cero código.**

> ⛔ Este documento **no borra, no sustituye y no toca ni un rótulo**. Enumera, propone y para.
> El cambio de máster de §4 lo firma el fundador; las tres preguntas de §3 **no las contesta
> esta sesión**.

**OBLIGACIÓN 0.** `git ls-remote --heads origin | grep scrum-825` → **vacío**: no hay ninguna rama
`scrum-825*` viva en el remoto. No es la causa «nunca se empujó»: en `origin/main` constan
**cinco** commits del ticket —`79f33e0e` (el censo del renombrado, PR #1171), `793825e1`,
`a610739f` y `4d8c0650` (las tres vueltas del guion de borrado, PRs #1175 y #1182)—. La rama
`scrum-825-el-documento-que-cambia-de-nombre` **era la del censo, está mergeada**, y su contenido
vive en `docs/master/SCRUM-825.md` (582 líneas). **Se ha leído entero y no se repite.**

---

## 0 · 🔴 LO QUE CAMBIA EL ENCARGO, Y VA ANTES DE LOS CUATRO CUBOS

El encargo trata `JUST` como un tipo a retirar. **Medido, `JUST` no es un residuo: es el modo de
emisión por defecto de todo merchant español real que no sea el demo, hoy, en producción.**

La cadena completa, con `fichero:línea`, derivada leyendo (regla 38, nada modificado):

| paso | dónde | qué dice |
|---|---|---|
| ① el flag | `src/core/flags.ts:16` | `INVOICING_ES_ENABLED: false` — **default de la tabla P** |
| ② el modo | `src/modules/invoicing/domain/emission.service.ts:40` | `return isFlagEnabled('INVOICING_ES_ENABLED', …) ? 'fiscal' : 'receipt'` |
| ③ la serie | `src/modules/invoicing/domain/invoiceNumber.service.ts:487-494` | `if (getEmissionMode(m) === 'receipt') { … return reservarReferenciaJustificante(...) }` → `J-YYYYMMDD-XXXX` |
| ④ el tipo | `src/modules/invoicing/domain/invoicing.service.ts:91` | `type: isReceiptNumber(number) ? 'JUST' : (input.type ?? 'F1')` |

Que las tablas estén a cero filas dice que **no hay datos**. No dice que **no haya camino**. El
camino está vivo y es el que corre por defecto: **la próxima factura que emita un fontanero
español real sale `J-…` con `type: 'JUST'`**, hoy mismo, sin que nadie toque nada.

### La consecuencia exacta

> **Retirar `JUST` no es limpieza: es encender la facturación fiscal española para todos los
> merchants reales.**

Y eso es exactamente lo que la **regla 24** prohíbe (*«`INVOICING_ES_ENABLED=false` para merchants
ES reales hasta SIF-1 v2 completo»*, máster :245) y lo que la **excepción THE PIONEER**
(máster :475-564, firmada el 19-ago-2026) autorizó **para un merchant nombrado, por identificador,
y con la llave auditada de SCRUM-218** — declarando en la misma página que *«la regla general NO
cambia»* y que *«esta excepción no la deroga: la perfora para UN merchant»* (:485-486).

Por eso este expediente **no puede ser una lista de borrado con tres preguntas al margen**. La
pregunta ⓪ de §3 es **previa** a los cuatro cubos, y los cubos de §2 están redactados
**condicionados a su respuesta**, con eso dicho en cada cabecera.

---

## 1 · VERIFICACIÓN DEL CONTEXTO QUE EL ENCARGO DABA POR MEDIDO

Se ha verificado, no re-medido. **Dos entradas no sobreviven a la verificación.**

| lo que decía el encargo | veredicto | evidencia |
|---|---|---|
| `Invoice.type ∈ {'F1','JUST'}` | ⚠️ **incompleto: son TRES** | `tipoDocumento.ts:52` → `'F1' \| 'R1' \| 'JUST'`. `R1` (rectificativa) también existe y el filtro del listado depende de que **no** se le excluya (`tests/scrum442…:47-49`) |
| serie con prefijo `J-` | ✅ confirmado | `invoiceNumber.service.ts:82` → `RECEIPT_NUMBER_PREFIX = 'J-'` |
| `invoiceAdmin.ts:38` → `{ merchantId, type: { not: 'JUST' } }` | ⚠️ **se movió a `:40`** | el `where` está hoy en `src/modules/system/invoiceAdmin.ts:40`, literal idéntico |
| «23 rótulos + 65 apariciones en 31 ficheros» | ⚠️ **caduco** | ver §1.a |
| documentos de producción y staging borrados (0 filas) | ⛔ **no verificable desde aquí** | ver §1.b |
| nada llegó nunca a la AEAT | ✅ compatible con el código | hay **generador** de XML (`registro.builder.ts:536-575`) y **cero transmisor**: ningún `POST` a la AEAT en `src/`. `SIF_ENABLED: false` (`flags.ts:17`) |
| `INVOICING_ES_ENABLED = false` **explícito** | 🔴 **al revés** | ver §1.c |

### 1.a · El censo de 23/65/31 caducó, y se ha rederivado

No caduca por viejo: caduca porque **sus objetos se movieron**. Comprobado en tres puntos que el
censo anterior citaba y que hoy son otra cosa:

* `invoiceDetailView.js:451` era el rótulo de la disputa; **hoy está en `:493`**;
* `schema.prisma:104` era `Invoice.type`; **hoy está en `:836`**;
* `invoicesAdmin.routes.ts:142` «escribía `JUST`»; **hoy esa ruta ya no escribe `JUST` en ningún
  sitio** — lo escribe `invoicing.service.ts:91` a partir del número. El comentario que lo afirma
  sigue en `invoiceAdmin.ts:21` y **miente**.

**Censo fresco (8-sep-2026, contra `56fed423`):** **57 ficheros** de `src/` y `public/` contienen
`justificante` / `'JUST'` / `isReceiptNumber` / `RECEIPT_NUMBER_PREFIX` / `'receipt'`. De ellos,
**2 son homónimos y NO entran** (`src/modules/expenses/domain/justificante.ts` y su vista
`expensesView.js`: ahí «justificante» es el **justificante de un GASTO** y su deducibilidad de IVA,
SCRUM-324 — nada que ver con `Invoice.type`). **Población real: 55 ficheros.**

Superficie visible al usuario medida en §2, cubo 🔴-C: **34 textos**, no 23. Los once que el censo
anterior no contaba están en `settingsView.js` (3), `jobDetailView.js` (1), `email.service.ts` (3,
y son **asunto y cuerpo del correo al cliente**), y el PDF (4 ramas de rótulo, no 2).

### 1.b · Lo de las bases NO lo puedo verificar, y por diseño

Producción y staging están **prohibidas para esta sesión**, y `dev` es otra base con otros datos
(el propio SCRUM-825 lo dejó escrito: *«un cero aquí no dice nada sobre producción»*). **El «0
filas» se toma como dato del fundador, no como medición de esta sesión.**

Y hay un matiz que sí puedo derivar del guion de la fase 1, y **contradice «no hay migración de
datos que hacer»**: el guion **NO borra el rastro polimórfico** —`audit_log`,
`whatsapp_messages`, `email_messages`—, por respuesta ③ del fundador, y su bloque ②b exige que esas
tablas den **el mismo número antes y después**. Esas filas **contienen `JUST` como valor guardado**:

* `audit_log.meta.tipoFactura = 'JUST'` y `meta.esJustificante = true` (`invoiceNumber.service.ts:473,477`);
* `email_messages.kind = 'justificante'` (`registroDeEnvios.ts:91`, escrito por `email.service.ts:79`).

⇒ **Hay datos con `JUST` dentro y nadie los ha borrado.** No son documentos, son el registro de
que existieron. Cuántos hay, no lo sé desde aquí; **que existen, sí**.

### 1.c · 🔴 El flag no está en `false` explícito: está en `false` por AUSENCIA

El máster lo dice, medido el 17-ago-2026 (:542-544):

> *«en producción (`cobroflash-backend`) y en `yaqu-staging` esa variable está **sin definir**,
> luego vale `false` por defecto del código. Está en `false` **por ausencia, no por mecanismo**.»*

No es un matiz de redacción. Con `false` explícito, encenderlo exige que alguien **cambie** un
valor. Por ausencia, encenderlo exige que alguien **defina** la variable — y el máster escribe la
consecuencia en la línea siguiente (:546-548): *«si esa variable se pusiera en `true`, todos los
merchants españoles sin override propio quedarían con la facturación encendida sin una sola fila
`cambio_flag`»*. El máster lo llama **«el hueco conocido»** y su puerta sigue abierta:
*«una prohibición sin mecanismo es una costumbre que falla una vez de cada seis»* (:558).

**Esto entra en el orden de §5 como paso 1, y es la razón de que la pregunta ⓪ exista.**

---

## 2 · LA LISTA DE MUERTE

**Regla de admisión: sin `fichero:línea` no entra.** Todas las líneas verificadas en esta sesión
contra `56fed423`.

Los cubos 🟢 y 🟡 están escritos **bajo el supuesto de que se firme que el modo `receipt`
desaparece** (pregunta ⓪). Si no se firma, **todo su contenido se muda al cubo 🔴** sin excepción.

---

### 🟢 SE BORRA SIN SUSTITUTO — 8 piezas, 31 líneas

Existen **sólo** para producir o reconocer un documento que ya no se produciría. Al desaparecer el
modo, nada ocupa su sitio.

| # | fichero:línea | qué es | por qué no deja hueco |
|---|---|---|---|
| G1 | `src/modules/invoicing/domain/invoiceNumber.service.ts:82` | `RECEIPT_NUMBER_PREFIX = 'J-'` | nadie genera ya un `J-` |
| G2 | `src/modules/invoicing/domain/invoiceNumber.service.ts:88-92` | `makeReceiptNumber()` | idem; su único llamador es G4 |
| G3 | `src/modules/invoicing/domain/invoiceNumber.service.ts:164-182` | `reservarReferenciaJustificante()` | idem; y con ella `INTENTOS_REFERENCIA_JUSTIFICANTE` y `ReferenciaJustificanteAgotada` (SCRUM-396 entero) |
| G4 | `src/modules/invoicing/domain/invoiceNumber.service.ts:487-494` | el bloque `if (getEmissionMode(m) === 'receipt')` | la serie fiscal pasa a ser la única |
| G5 | `src/modules/invoicing/domain/emission.service.ts:10` (`'receipt'` de `EmissionMode`) · `:34` (su doc) | el tercer valor del modo | quedan `'fiscal'` y `'demo'` |
| G6 | `src/modules/invoicing/domain/modoVisible.ts:45` · `:48` | `'receipt'` en `ModoVisible` y en `MODOS_VISIBLES` | **deriva** de G5: la unión se estrecha sola |
| G7 | `src/modules/invoicing/infra/pdf/pdf.service.ts:281` y sus 7 ramas (`:285, :364, :368, :372, :626, :639, :672-677`) | `const isReceipt = params.type === 'JUST'` | el PDF vuelve a tener **una** maqueta |
| G8 | `src/modules/system/quoteAdmin.ts:4` | `import { allocateInvoiceNumber, isReceiptNumber }` | ⚪ **ya muerto hoy** — ver el cubo ⚪, entrada M1 |

> ⚠️ **G1-G4 y G7 están DENTRO del camino de emisión fiscal.** Leerlos no es STOP (regla 38);
> tocarlos **sí** (regla 40). No se han tocado.

---

### 🟡 SE SUSTITUYE — 14 piezas, y aquí está el trabajo de verdad

Cada entrada dice **qué pasa a valer ese sitio**, que es lo que el encargo pide y lo que un
`grep`-y-borra no puede contestar.

#### 🟡-A · El predicado que hoy ramifica, y mañana no

`isReceiptNumber` (`invoiceNumber.service.ts:84-86`) tiene **hoy 78 apariciones**. No se borra de
golpe: **cada llamador se resuelve a su constante y luego la función desaparece**. Son dos valores
distintos según el sitio, y confundirlos es el error caro:

| # | fichero:línea | hoy | pasa a valer | por qué |
|---|---|---|---|---|
| Y1 | `verifactu.service.ts:207-209` | `if (isReceiptNumber(number)) throw 'receipt_document_not_invoiceable'` | **se retira el corte** | sin `J-`, nada llega aquí; el corte hermano por TIPO (`:210+`, SCRUM-413) **se queda**: vigila el otro eje |
| Y2 | `verifactu.service.ts:379-381` | idem en `applyVeriFactuAnulacion` | **se retira** | mismo motivo |
| Y3 | `portonDocumento.ts:84` | `country==='ES' && !!taxId && !isReceiptNumber(numero)` | `country==='ES' && !!taxId` | el tercer término pasa a ser **siempre `true`** |
| Y4 | `selladoEstado.ts:72` | idéntico literal | idéntico cambio | 🔴 **son dos copias de la misma condición**: el día que se toque una hay que tocar la otra, y hoy nada lo obliga |
| Y5 | `invoicesAdmin.routes.ts:830-835` | 409 `receipt_not_annullable` | **se retira la puerta** | toda factura pasa a ser anulable por su vía normal |
| Y6 | `invoicesAdmin.routes.ts:973-975` | 409 `cannot_rectify_receipt` | **se retira** | toda factura pasa a ser rectificable (R1) |
| Y7 | `recapitulativa.service.ts:106` · `albaranes.routes.ts:1201` · `:1417` | `throw 'consolidacion_no_disponible'` / `'facturacion_no_disponible'` | **se retiran los tres cinturones post-emisión** | eran «si de la serie sale un J- pese al gate, aborta»; sin serie `J-` no pueden disparar |
| Y8 | `invoiceAdmin.ts:40` | `{ merchantId, type: { not: 'JUST' } }` | **decisión pendiente** → pregunta ② | ver 🔴-B |
| Y9 | `invoiceAdmin.ts:251` | `existing.type === 'JUST' \|\| /^J-/i.test(...)` permite des-pagar | `false` | **cambia comportamiento**: hoy un `JUST` cobrado **sí** se puede devolver a `pending`; al desaparecer, **ninguno** puede, y salta *«Una factura emitida no se des-paga: emite una rectificativa (R1)»*. Es una función que el pro usa hoy y perdería |

#### 🟡-B · Los gates por modo: dejan de poder cerrarse

| # | fichero:línea | hoy | pasa a valer |
|---|---|---|---|
| Y10 | `albaranes.routes.ts:435-437` · `:1153-1155` · `:1312-1314` | `if (getEmissionMode(merchant)==='receipt') → 409` (recapitulativa, parcial, facturar-trabajo) | **se retiran**: las tres puertas se abren para el merchant español real, que es el 100 % de la clientela |
| Y11 | `jobs.routes.ts:1417-1419` | idem, consolidación | idem |

> 🔴 **Y10-Y11 no son limpieza: son producto nuevo puesto en manos de gente.** Tres funciones
> fiscales que hoy nadie español puede usar —recapitulativa, factura parcial de albarán, facturar
> el trabajo— **se encienden a la vez**. Ninguna se ha probado nunca contra un merchant real.

#### 🟡-C · Los clasificadores del front: de tres tipos a dos

| # | fichero:línea | hoy | pasa a valer |
|---|---|---|---|
| Y12 | `public/dashboard/js/jobDocsReparto.js:34-38` | `tipoDeFactura()` devuelve `rectificativa \| justificante \| factura` | **dos**: `rectificativa \| factura`. Y con ella `DESTINO_POR_TIPO.justificante: 'rail-dinero'` (`:55`) — **el bloque DINERO del rail del Trabajo se queda vacío** (`jobRailBlocks.js:121-130`) |
| Y13 | `public/dashboard/js/invoicesView.js:79-84` | `soloFacturas()` filtra `!== 'justificante'` | **el filtro deja de filtrar** → misma decisión que Y8, pregunta ② |
| Y14 | `public/dashboard/js/app.js:38-39` · `rotulosDelDocumento.js:53-54` · `invoicesView.js:208,222` | `window.appDocumentoSuelto ∈ {factura, justificante, no}` | **dos valores** → o **uno**: depende de la pregunta ③ |

---

### 🔴 NO SE PUEDE TOCAR SIN DECIDIR ANTES — 5 bloques

#### 🔴-A · El modo `receipt` entero — **la decisión ⓪, y bloquea todo lo demás**

`emission.service.ts:36-41` · `flags.ts:16` · `facturaSuelta.ts:76-79`

Retirar `JUST` **es** encender `INVOICING_ES_ENABLED` para todos. La decisión que falta no es
técnica: es si se deroga la regla 24 y se generaliza lo que la excepción THE PIONEER autorizó para
**un** merchant. **Nada de §2 se ejecuta sin esto firmado.**

#### 🔴-B · `invoiceAdmin.ts:40` — el filtro que dejaría de filtrar

Y su gemelo del front, `invoicesView.js:81`. La decisión que falta es la pregunta ②. **Y hay un
guard en medio que no se puede ignorar:** `tests/scrum442-facturas-sin-justificantes.test.mjs:35`
exige el literal `type: { not: 'JUST' }` y `:69` exige que Cobros **no** lo tenga. Retirarlo pone
ese fichero **en rojo**, y la regla 41 dice qué hacer entonces: *«un guard en rojo se arregla
cambiando el CÓDIGO, nunca lo que el guard exige»*. Aquí el código **es** lo que el guard exige, así
que **no es un caso de la regla 41: es un cambio de máster**, y por eso está aquí y no en 🟡.

#### 🔴-C · Los 34 textos que ve un usuario — regla 30 y regla 39

**Ninguno se toca en esta fase, ni en la siguiente sin firma del literal.** Van censados porque un
expediente que no los cuenta hace creer que la retirada es interna.

*Panel del profesional (17):*
`rotulosDelDocumento.js:70, :71, :74, :75, :76, :77, :80` (los siete de SCRUM-776) ·
`invoicesView.js:223` · `invoiceDetailView.js:81, :82, :126, :493` · `quotesDetailView.js:286` ·
`jobDetailView.js:24` · `settingsView.js:39, :44, :1193`

*PDF que se lleva el cliente (5):*
`pdf.service.ts:364` (`JUSTIFICANTE DE COBRO`) · `:372` (`Ref.` vs `Nº`) · `:626` (`TOTAL COBRADO:`
vs `TOTAL:`) · `:675` · `:677` (`No constituye una factura…`)

*Respuesta de API que el pro lee (1):*
`invoicesAdmin.routes.ts:833`

*🔴 Que salen del panel y llegan al CLIENTE FINAL (11):*
`receipt.routes.ts:95, :96` → usados en `:141, :149, :161, :164` (página pública de recibo, con
concordancia `lo`/`la`) · `invoiceWhatsApp.service.ts:66` (concepto del cobro) y `:88` (texto de
ventana de WhatsApp) · `invoiceReminder.service.ts:138` (recordatorio) ·
`payInvoice.routes.ts:47` (referencia del pago) · `psp.routes.ts:257` y `mpWebhook.routes.ts:197`
(timeline) · `email.service.ts:42` → `:44` (**asunto**), `:47` y `:49` (**cuerpo**)

Cinco de ellos llevan escrito en el código el motivo por el que dicen «justificante»:
`// Regla 24/26: un J-… es JUSTIFICANTE — el copy jamás dice "factura"`.

Y **cuatro no tienen traducción**, ya medido en SCRUM-825 §3 y sigue siendo cierto: «Factura de
cobro» no existe; `pdf.service.ts:677` («No constituye una factura») **se contradice** si el
documento pasa a ser una factura; y `invoicesAdmin.routes.ts:833` renombrado diría *«Este documento
es una factura, no una factura fiscal»*.

#### 🔴-D · Los datos guardados con `JUST` dentro que NADIE borró

`registroDeEnvios.ts:87-106` — `CLASES_DE_CORREO` es una lista **cerrada** y su comentario dice por
qué: *«al ser un tipo, un valor mal escrito no compila. Una divergencia imposible gana a una
vigilada»*. `justificante: 'justificante'` (`:91`) es un **valor persistido** en
`email_messages.kind`. Retirarlo de la unión deja filas históricas con un valor que el tipo ya no
admite — y esa tabla es de las que la fase 1 **decidió no borrar**.

Igual con `audit_log`: `invoiceNumber.service.ts:473` (`esJustificante`) y `:477`
(`tipoFactura: 'JUST'`) escriben dentro de `meta`, y el máster tiene un contrato firmado para ese
registro (`docs/legal/AUDITLOG_FISCAL_CONTRATO.md`). **Un registro de auditoría no se reescribe
para limpiarlo**: eso es exactamente lo que ese módulo existe para impedir (SCRUM-207).

**La decisión que falta:** ¿la clase de correo `justificante` y el `tipoFactura: 'JUST'` del
AuditLog **se conservan como valores históricos** —marcados «no se emite más, se sigue leyendo»— o
se retiran? No es lo mismo dejar de escribir un valor que dejar de reconocerlo.

#### 🔴-E · `tipoDocumento.ts` — la unión cerrada y su mapeo a la AEAT

`:52` (`'F1' | 'R1' | 'JUST'`) y `:67-72` (`AEAT_POR_TIPO.JUST: null`, con el comentario *«Fuera de
toda serie fiscal. No se declara: ni F1, ni F2, ni con marcador»*).

Quitar `JUST` de ahí hace que `declarabilidadDe('JUST')` deje de devolver `no_es_una_factura` y
pase a devolver **`tipo_desconocido`**. Para el XML el resultado es el mismo —se excluye—, pero
**el motivo que se escribe cambia**: `documento_no_declarable:JUST` pasaría a
`tipo_de_factura_desconocido:JUST` (`verifactu.service.ts:788`). Es lo que una inspección leería
sobre las filas históricas. **La decisión: `JUST` sale de la unión, o se queda como tipo conocido y
no declarable.** Recomendación derivada de la propia cabecera del módulo —tres desenlaces distintos
que no se pueden aplastar en dos—, pero **no la firmo yo**.

---

### ⚪ YA ESTÁ MUERTO HOY — 3 piezas, y ninguna se descubrió buscándola

| # | fichero:línea | qué pasa | evidencia |
|---|---|---|---|
| M1 | `src/modules/system/quoteAdmin.ts:4` | `allocateInvoiceNumber` e `isReceiptNumber` se importan y **ninguno de los dos se usa** en el fichero | cada identificador aparece **exactamente una vez** en el fichero: la propia línea del import. Resto de SCRUM-149, que retiró `createInvoiceFromQuoteAdmin` por código muerto y dejó los imports |
| M2 | `public/dashboard/js/nuevaFacturaModal.js` (fichero entero, 266 líneas) | **no tiene puerta en el producto desde SCRUM-600**: ningún botón lo abre; el de Facturas navega a la página (`invoicesView.js:236-238`). Sigue cargándose en `index.html:297` y cacheándose en `sw.js:84` | lo declara el propio código: *«se queda en el árbol y DEJA DE TENER PUERTA. No es un descuido: es la referencia contra la que `scrum600b` comprueba…»* (`invoicesView.js:232-235`). **Sus únicos ejecutores son un guard y unos tests** |
| M3 | `src/modules/system/app/routes/invoicesAdmin.routes.ts:163-169` | el cinturón `modoSuelto === 'factura' && isReceiptNumber(invoice.number)` **no puede disparar hoy** | las dos resoluciones del modo miran el mismo merchant **con los mismos campos** desde que SCRUM-81 metió `flags` en el `select` de `allocateInvoiceNumber` (`:456`). Sólo dispararía si volvieran a divergir. **Es un cinturón, no un camino** — y su rótulo (`:167`) sí llega al usuario |

> ⚠️ **M2 tiene una consecuencia que este expediente no puede callar:**
> `guard:caja-documento-suelto` (`scripts/guard-caja-documento-suelto.mjs:106`) mide **en navegador,
> en los dos modos**, una pantalla **que el producto ya no abre**. Es verde y mide algo real; sólo
> que ese algo dejó de ser lo que ve un profesional. Cuando el modo `justificante` desaparezca
> (`:53`, `MODOS = ['justificante','factura']`), **medirá el mismo texto dos veces**, que es la
> misma familia de falso verde que SCRUM-825 §5 ya había anticipado para este guard.
> **Se reporta, no se toca** (regla 37: otra zona, no bloquea esta tarea).

---

### La red que se pone en rojo — 22 ficheros de test, medido

No es un cubo: es lo que **cae a la vez** el día de la ejecución, y por eso va aquí. Ordenados por
lo que significa su rojo.

**Rojo que es una DECISIÓN, no una regresión (hay que cambiar el test con su firma):**
`scrum442-facturas-sin-justificantes` (`:35`, `:69`) · `scrum413-tipo-factura-cerrado` (`:58`
`TIPOS_DECLARADOS`, `:253-268` el vector) · `scrum776-una-sola-voz` (los siete rótulos en dos
modos) · `scrum601-copy-del-documento-vs-flag` (`:102-104`, la cadena de portadores completa) ·
`scrum346-justificante-suelto` (`:128-135`) · `scrum289b-factura-suelta` (`:104-129`) ·
`tests/_censo-copy-vs-flag.mjs:102` (`SEMILLA_TIPO`)

**Rojo por desaparición del caso (el test se queda sin escenario):**
`scrum396-referencia-justificante` (fichero entero) · `emission.test.mjs` (`:46-51`, `:91`) ·
`scrum81-allocate-flags` (`:43, :48, :69`) · `scrum178-emision-manual` (`:109-111`) ·
`scrum308-caracterizacion-rectify` (`:154`) · `scrum207-emision-auditada` (`:99`) ·
`scrum608-tipo-de-documento-en-la-cabecera` (`:159`) · `pdfs.test.mjs` (`:63, :76, :83`) ·
`scrum319-documentos-por-tipo` (`:254`) · `scrum362-banco-sin-cobertura` (`:75`) ·
`scrum445-cobros-sin-duplicar` (`:38, :45`) · `scrum600b` (`:59, :73`) · `scrum600d` (`:134`) ·
`scrum292-nif-antes-de-emitir` (`:159`)

**🔴 Y uno que NO se pone en rojo, y es el peligroso:**
`scrum299-copy-factura-publico` vigila que el copy **público** no prometa «factura» sobre el
documento post-pago, con baseline en **0**. El día que el documento **sea** una factura, ese guard
sigue verde **midiendo una promesa que ya no es falsa**. Su `DEUDA_ORIGINAL` (`:18`) y su baseline
(`:26-35`) quedarían describiendo un mundo que dejó de existir, sin una sola línea roja que lo
diga. **Es la entrada que hay que revisar aunque no se queje.**

---

## 3 · LAS PREGUNTAS QUE SOLO PUEDE CONTESTAR EL FUNDADOR

**Ninguna la contesta esta sesión.** Cada una se puede responder con una frase.

### ⓪ · LA PREVIA, que no estaba en el encargo y bloquea a las demás

> **Retirar `JUST` equivale a encender `INVOICING_ES_ENABLED` para todos los merchants españoles
> reales, que es lo que la regla 24 prohíbe y lo que la excepción THE PIONEER autorizó para uno
> solo. ¿Se deroga la regla 24 y se generaliza, o la fase 2 se limita a lo que no toca el modo de
> emisión?**

Contexto para responder, medido: hoy el flag está en `false` **por ausencia de la variable**, no
por mecanismo (máster :542-544), y encenderlo globalmente **no deja fila `cambio_flag`**
(:546-548). No hay ningún merchant real de pago en producción.

### ① · La serie `J-`: ¿desaparece, o se conserva el hueco?

> **`RECEIPT_NUMBER_PREFIX = 'J-'` (`invoiceNumber.service.ts:82`) y el reconocedor
> `isReceiptNumber` (`:84-86`): ¿se retiran los dos, o se conserva el reconocedor —sin generador—
> para que un `J-` histórico siga identificándose?**

**Hoy no hay ningún `J-` en ninguna base de documentos**, según el dato del fundador (fase 1
ejecutada, 0 filas). Pero **sí quedan `J-` fuera de esas tablas**: en `email_messages`,
`whatsapp_messages` y `audit_log`, que la fase 1 decidió no borrar (§1.b). Conservar el
reconocedor sin generador cuesta 3 líneas; retirarlo obliga a que 78 llamadores se resuelvan a
constante primero (§2, 🟡-A).

### ② · `invoiceAdmin.ts:40`: un filtro que no filtra

> **Sin `JUST`, `type: { not: 'JUST' }` deja de excluir nada. ¿Se retira, o se queda como red?**

Sin adornarlo: un filtro que no filtra es un guard que ya no mira nada, y esos envejecen mintiendo.
Pero retirarlo **pone en rojo `scrum442`** (`:35`), que es un guard firmado y con su motivo escrito
(44 de 55 documentos de producción no eran facturas, 10-ago-2026). **Retirar el filtro y retirar su
guard son la misma decisión y hay que tomarla junta**, o queda un guard rojo que alguien acabará
relajando (regla 41). Lo mismo, en el front, para `invoicesView.js:81`.

### ③ · El «documento suelto»: ¿desaparece con el tipo, o sobrevive apuntando a factura?

> **`ModoDocumentoSuelto = 'factura' | 'justificante' | 'no'` (`facturaSuelta.ts:74`),
> `modoDocumentoSuelto()` (`:76-79`) y `window.appDocumentoSuelto` (`app.js:38-39`): ¿el veredicto
> se queda en dos valores (`factura` | `no`), o desaparece y el botón se muestra siempre?**

Medido: el veredicto **no existe para nombrar el documento**, existe para decidir si el botón
aparece. Con `justificante` fuera, `modoDocumentoSuelto` devolvería `'factura'` para todo merchant
y `'no'` sólo cuando no hay merchant (fallo cerrado, `:77`) — un caso que la ruta ya cubre por
separado (`invoicesAdmin.routes.ts:108`). **Sobrevive con sentido, pero degradado.**

### ④ · Nueva, salida de la medición: los tres gates que se abrirían a la vez

> **Retirar el modo `receipt` abre de golpe la recapitulativa, la factura parcial de albarán y el
> facturar-trabajo a todo merchant español (`albaranes.routes.ts:435, :1153, :1312` ·
> `jobs.routes.ts:1417`). ¿Se abren las tres a la vez, o se mantienen cerradas por otro gate
> mientras se prueban?**

Ninguna de las tres se ha ejercitado nunca contra un merchant real: hasta hoy el 409 las tapaba
para el 100 % de la clientela española.

### ⑤ · Nueva: el valor histórico en las tablas que no se borraron

> **`CLASES_DE_CORREO.justificante` (`registroDeEnvios.ts:91`) y `meta.tipoFactura: 'JUST'` del
> AuditLog: ¿se conservan como valores históricos que se leen y ya no se escriben, o se retiran de
> las uniones dejando filas con un valor que el código ya no reconoce?**

### ⑥ · Nueva: `Invoice.type` en el schema

> **`prisma/schema.prisma:836` es `String @default("F1")`, sin enum. La retirada de `JUST` ¿toca el
> schema, o se queda fuera?**

Recomendación derivada, no decisión: **no tocarlo**. Sería un cambio no aditivo (STOP AA1.4), y la
unión cerrada de `tipoDocumento.ts:52` ya da la garantía en compilación sin pisar la base. **No se
ha tocado el schema en esta sesión.**

---

## 4 · EL TEXTO DEL CAMBIO DE MÁSTER — redactado para pegar (regla 27)

> ⛔ **NO se ha escrito en `docs/YAQU_MASTER.md`.** Está aquí, listo. Lo firma el fundador.
> Va con `[  ]` en los huecos que sólo él puede rellenar.

### 4.a · Entrada nueva, al final de la **EXCEPCIÓN TEMPORAL DE FACTURACIÓN · THE PIONEER** (tras la línea 564)

```markdown
### Cierre de la excepción por generalización · SCRUM-825 fase 2 · [FECHA]

Esta excepción se cierra **por generalización, no por caducidad**: lo que autorizaba para un
merchant nombrado pasa a ser la regla. Queda constancia de que no expiró sola.

**Lo que se deroga:** la regla 24 (`INVOICING_ES_ENABLED=false` para merchants ES reales hasta
SIF-1 v2 completo) en su mitad de flag. La prohibición de claims fiscales (reglas 7, 17, 26) **NO
se deroga**: sigue entera hasta SIF-1 8/8.

**Lo que se autoriza:** que todo merchant ES real emita factura fiscal, retirando el modo de
emisión `receipt` y con él el tipo de documento `JUST` y la serie `J-`.

**Motivo:** [  el fundador escribe aquí por qué ahora, y qué lo hace seguro  ]

**Precondiciones, TODAS verificadas antes de ejecutar:**
1. las cinco constantes `VERIFACTU_PRODUCTOR_*` presentes en producción (SCRUM-247: sin ellas el
   emisor falla en claro con `verifactu_productor_no_configurado`, y encender el flag no emitiría
   nada);
2. el hueco declarado del interruptor global (máster :537-558) cerrado o explícitamente asumido:
   la variable de entorno sigue sin gobernar la llave auditada de SCRUM-218;
3. cero documentos vivos en producción y staging, verificado el mismo día
   (`docs/sql/scrum-825-verificar-borrado.sql`).

**Lo que NO autoriza:** cambiar ni un rótulo. Los 34 textos censados en
`docs/master/SCRUM-825-fase2-expediente.md` §2 🔴-C siguen bajo las reglas 30 y 39: se proponen y
se firman uno a uno.
```

### 4.b · Enmienda en la **PARTE I — REGLAS**, regla 24 (línea 245)

```markdown
24) `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1 v2 completo; facturas demo
con marca de agua SIEMPRE. **[DEROGADA la mitad del flag el [FECHA] por SCRUM-825 fase 2 — ver
«Cierre de la excepción por generalización». La marca de agua del demo y la prohibición de claims
fiscales (reglas 7, 17, 26) siguen VIGENTES.]**
```

### 4.c · Enmienda en la **PARTE P — FEATURE FLAGS**, fila del flag (línea 461)

```markdown
| `INVOICING_ES_ENABLED` | país ES / merchant | **ON** *(desde [FECHA], SCRUM-825 fase 2)* | —
| factura fiscal ES a reales | SIF-1 + datos fiscales | 🔴 **el rollback ya NO devuelve a
«justificante»: ese modo se retiró del código.** Apagar el flag deja al merchant ES real **sin
poder emitir** — no es un rollback seguro, es una parada |
```

> 🔴 Esa última celda es la que hay que leer dos veces. Hoy el flag tiene **rollback seguro**
> («vuelve a justificante»). Después de la fase 2 **deja de tenerlo**, porque el sitio al que
> volvía ya no existe. Es una propiedad que se pierde, y el máster tiene que decirlo.

### 4.d · Enmienda en la **PARTE U**, entrada V0-0 (línea 975)

```markdown
- **V0-0 · Flag de facturación ES:** ~~`INVOICING_ES_ENABLED=false` para merchants ES reales
  no-demo hasta SIF-1~~ **CERRADO el [FECHA] por SCRUM-825 fase 2: el flag pasa a ON y el modo
  `receipt` se retira.** Demo conserva facturas con marca de agua "DEMO — no válida fiscalmente"
  en PDF y pantalla (esto NO cambia). Done original: imposible emitir factura fiscal a un real.
  ~~Rollback: flag.~~ **Ya no hay rollback por flag — ver Parte P.**
```

---

## 5 · EL ORDEN DE EJECUCIÓN, Y QUÉ ROMPE CADA PASO FUERA DE ORDEN

Como en el borrado: **el orden no lo impone la base, lo impone quien escribe el guion.** Aquí no lo
impone ni la base ni el compilador — lo impone **qué ve un profesional mientras dura la
transición**, que es lo único que no se puede deshacer.

**Regla que gobierna todo el orden:** *el rótulo va DESPUÉS del documento, nunca antes.* Un panel
que dice «factura» sobre un `J-` le está mintiendo a alguien que responde ante Hacienda.

| # | paso | qué rompe si se hace ANTES de tiempo |
|---|---|---|
| **0** | **Firmar §4** (cambio de máster) y contestar las **seis** preguntas de §3 | sin esto, cualquier paso siguiente inventa una decisión de flag y de estado — reglas 5 y 27 |
| **1** | **Encender el flag por el camino auditado** (`scripts/cambiar-flag-fiscal.mjs`, SCRUM-218), merchant a merchant. **NUNCA la variable de entorno global** | por la variable global, todos los merchants ES quedan encendidos **sin una sola fila `cambio_flag`** (máster :546-548): nadie puede demostrar después cuándo se encendió ni para quién. Y `VERIFACTU_PRODUCTOR_*` ausentes en producción ⇒ el emisor falla en claro y **no se emite nada** (SCRUM-247) |
| **2** | **Verificar por emisión real** que sale `F…`/serie fiscal y **no** `J-` | saltarlo deja el paso 3 apoyado en una lectura de código en vez de en un documento emitido. Es lo que el propio SCRUM-825 llamó «afirmación de estado» frente a «registro medido» |
| **3** | **Retirar el generador**: 🟢 G1-G4 (`invoiceNumber.service.ts:82, 88-92, 164-182, 487-494`) | **antes del paso 1**, un merchant ES real se queda **sin ninguna serie**: `getEmissionMode` devuelve `receipt`, entra en un bloque que ya no existe y la emisión revienta. Es la parada total del producto |
| **4** | **Retirar el modo**: 🟢 G5-G6 y 🟡 Y10-Y11 (`emission.service.ts:10,34,40` · `modoVisible.ts:45,48` · los cuatro gates de albaranes/jobs) | **antes del 3**, `getEmissionMode` ya no devuelve `receipt` pero el generador sigue ahí: código inalcanzable que el siguiente que pase leerá como vivo. **Y abre tres funciones fiscales a la vez** — si la pregunta ④ dijo «no a la vez», este paso se parte en dos |
| **5** | **Resolver los llamadores de `isReceiptNumber` uno a uno**: 🟡 Y1-Y7 y Y9 (78 apariciones) | **antes del 3**, se retiran cortes que aún protegen de un `J-` que todavía se puede generar: `verifactu.service.ts:207` es el que impide que un justificante entre en la cadena de huellas. **Un fallo aquí sella algo que no se puede des-sellar** (regla 29) |
| **6** | **La decisión ②**: el filtro del listado (`invoiceAdmin.ts:40`, `invoicesView.js:81`) **y su guard `scrum442` a la vez** | separarlos deja `scrum442` en rojo, y un guard rojo que nadie puede arreglar cambiando el código acaba relajado (regla 41). **Van en el mismo PR o no van** |
| **7** | **La decisión ⑤**: `tipoDocumento.ts:52` y `AEAT_POR_TIPO.JUST`, más `CLASES_DE_CORREO.justificante` | **antes del 5**, `declarabilidadDe('JUST')` cambia de motivo mientras aún hay documentos `JUST` en el camino: el XML pasaría de excluirlos por `documento_no_declarable` a excluirlos por `tipo_desconocido`. Se excluyen igual, pero **el motivo escrito ante una inspección cambia** |
| **8** | **Los 34 rótulos** (🔴-C), **uno a uno, cada literal firmado** | **ÉSTE ES EL QUE NO SE PUEDE ADELANTAR.** Antes del 2, el panel y el WhatsApp dicen «factura» sobre un documento que sigue siendo `J-`: es la promesa fiscal falsa que las reglas 7, 17 y 26 prohíben, y llega **al cliente del profesional**, no sólo al panel |
| **9** | **Revisar `scrum299`** aunque esté verde, y decidir sobre el modal muerto M2 y el guard `caja-documento-suelto` | saltarlo deja **dos guards verdes midiendo un mundo que ya no existe**: uno vigila una promesa que dejó de ser falsa, el otro compara un texto consigo mismo |

### Los tres pasos que NO se pueden dividir entre dos PRs

* **3 + 5** — retirar el generador sin resolver los cortes deja la cadena de huellas desprotegida
  durante el hueco.
* **6 entero** — filtro y guard, o ninguno.
* **8 por rótulo** — cada literal es su propia firma; **agruparlos es pedir una firma en blanco**.

---

## 6 · LO QUE NO SE HA TOCADO EN ESTA SESIÓN

- **Ningún fichero de `src/`**, `public/`, `tests/`, `scripts/` ni `prisma/schema.prisma`.
- **El camino de emisión fiscal: sólo LEÍDO** (regla 38 / regla 40). Ni un helper extraído, ni una
  firma cambiada, ni un export nuevo.
- **Ni un rótulo** (reglas 30 y 39). Los 34 están censados, ninguno propuesto.
- **`docs/YAQU_MASTER.md` intacto**: el cambio de máster de §4 está **aquí**, sin aplicar.
- **Ningún estado ni flag nuevo** (regla 27). **Ninguna dependencia** (regla 36).
- **Ninguna base**: ni dev, ni staging, ni producción. Cero consultas.
- **Las seis preguntas de §3 sin contestar**, que es el encargo.

**Entregable único:** este fichero.

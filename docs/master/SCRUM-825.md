# SCRUM-825 · «Justificante» → «factura»: la medición, y por qué el renombrado NO se puede hacer así

**Medido contra:** `origin/main` = `da938ba0cee102b560edc7f4d935d7b0f67c1f14` · 2026-09-08T12:00:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Rama:** `scrum-825-el-documento-que-cambia-de-nombre`
**Carril:** fiscal (superficie pública) · **Gate:** medición, **cero rótulos cambiados**

> ⛔ Este documento **no cambia ni un rótulo**. Propone una tabla; la firma el fundador; la aplica
> otra sesión (regla 30).

**OBLIGACIÓN 0:** no existe rama `scrum-825-*` en el remoto, y `origin/main` no tiene ningún commit
que la mencione. Causa (a) —nunca se empujó—, así que se construye la medición.

---

## 1 · 🔴 LA PREGUNTA QUE DECIDE TODO: son DOS FLUJOS, y por eso esto PARA

La respuesta sale del código, no de la pantalla.

| | «Nuevo justificante» | menú «Facturas» |
|---|---|---|
| modelo | `Invoice` | `Invoice` |
| tabla | `invoices` (`@@map`, `schema.prisma:164`) | `invoices` |
| endpoint | `POST /admin/invoices` | `GET /admin/invoices` |
| router | `src/modules/system/app/routes/invoicesAdmin.routes.ts` | el mismo |

Mismo modelo, misma tabla, mismo router. **Y aun así son dos flujos**, porque hay un
DISCRIMINADOR GUARDADO y la lista lo usa para excluir:

```ts
// src/modules/system/invoiceAdmin.ts:38 — listInvoicesAdmin
const where: Prisma.InvoiceWhereInput = { merchantId, type: { not: 'JUST' } };
```

* `Invoice.type` (`schema.prisma:104`, `@default("F1")`) vale **`'F1'`** o **`'JUST'`**
  (`invoicesAdmin.routes.ts:126` y `:142`).
* La serie de numeración también difiere: el justificante lleva prefijo **`J-`**, y hay un
  cinturón que **rechaza con 409** si sale un `J-` con el gate de factura abierto
  (`invoicesAdmin.routes.ts:152`).
* **La pantalla «Facturas» EXCLUYE los justificantes a propósito**, y SCRUM-442 dejó escrito por
  qué: *«Un justificante de cobro no es una factura —vive fuera de toda serie fiscal, V0-0— y el
  profesional los estaba contando como si lo fueran»*. Midieron **44 de 55 documentos en
  producción**. Su sitio es **Cobros**.

### 🔴 La consecuencia exacta del renombrado, si se hiciera hoy

El botón vive DENTRO de la pantalla de Facturas. Renombrarlo produce esto:

> El profesional pulsa **«+ Nueva factura»** en la pantalla **Facturas**, se crea un documento con
> `type: 'JUST'`, y **ese documento NO aparece en la lista de Facturas** — porque la lista filtra
> `type: { not: 'JUST' }`. Aparece en **Cobros**.

Pulsar «Nueva factura» en Facturas y que la factura no salga en Facturas es **peor que el nombre
de hoy**, que al menos avisa de que es otro documento. Es el caso que el encargo manda parar.

**Esto no se arregla en el rótulo.** O el renombrado incluye quitar ese filtro —y entonces cambia
qué lista la pantalla de Facturas, que es una decisión de producto y fiscal, no de copy— o el
botón deja de vivir en Facturas. Las dos son del fundador.

---

## 2 · EL CENSO — 16 derivados, y 7 que el instrumento derivado NO ve

Suelo del encargo: «si devuelve menos de 3, está roto». Devuelve **16** por el camino derivado.

### Grupo A · 16 rótulos visibles, derivados por AST (`_censo-copy-vs-flag.mjs`, SCRUM-601)

| # | ruta:línea | texto |
|---|---|---|
| 1 | `public/dashboard/js/invoiceDetailView.js:81` | `Justificante de cobro` |
| 2 | `public/dashboard/js/invoiceDetailView.js:82` | `Detalle y acciones del justificante.` |
| 3 | `public/dashboard/js/invoiceDetailView.js:126` | `JUSTIFICANTE` |
| 4 | `public/dashboard/js/invoiceDetailView.js:451` | `Presupuesto firmado + evidencia de aceptación + justificante + registro de mensajes, listo para responder al banco` |
| 5 | `public/dashboard/js/invoicesView.js:223` | `+ Nuevo justificante` |
| 6 | `public/dashboard/js/quotesDetailView.js:286` | `🧾 Ver justificante` |
| 7 | `public/dashboard/js/rotulosDelDocumento.js:70` | `Justificantes` |
| 8 | `public/dashboard/js/rotulosDelDocumento.js:71` | `Nº justificante` |
| 9 | `public/dashboard/js/rotulosDelDocumento.js:74` | `Nuevo justificante` |
| 10 | `public/dashboard/js/rotulosDelDocumento.js:75` | `Emitir justificante` |
| 11 | `public/dashboard/js/rotulosDelDocumento.js:76` | `Crear un justificante nuevo` |
| 12 | `public/dashboard/js/rotulosDelDocumento.js:77` | `Justificante emitido` |
| 13 | `public/dashboard/js/rotulosDelDocumento.js:80` | `No hemos podido emitir el justificante. Inténtalo otra vez.` |
| 14 | `src/modules/invoicing/infra/pdf/pdf.service.ts:364` | `JUSTIFICANTE DE COBRO` *(en el PDF)* |
| 15 | `src/modules/invoicing/infra/pdf/pdf.service.ts:675` | `Justificante de cobro — este documento acredita el cobro recibido.` *(en el PDF)* |
| 16 | `src/modules/system/app/routes/invoicesAdmin.routes.ts:778` | `Este documento es un justificante, no una factura fiscal: no entra en la cadena VeriFactu.` |

### 🔴 Grupo B · 7 que el censo derivado clasifica como INTERNOS y llegan al usuario igual

El literal va dentro de un **ternario metido en una plantilla**, así que el censo lo ve como valor
y no como rótulo. Es la misma ceguera que corrigió SCRUM-600 en el extractor de ranuras. **Y son
los peores, porque cinco de los siete salen del panel y llegan al CLIENTE del profesional:**

| # | ruta:línea | a dónde llega |
|---|---|---|
| B1 | `src/modules/billing/domain/invoiceWhatsApp.service.ts:66` | el **concepto del cobro** — lo ve el cliente |
| B2 | `src/modules/billing/domain/invoiceWhatsApp.service.ts:88` | el **texto de ventana de WhatsApp** al cliente |
| B3 | `src/modules/billing/domain/invoiceReminder.service.ts:138` | el **recordatorio por WhatsApp** al cliente |
| B4 | `src/modules/billing/app/routes/receipt.routes.ts:95` | la **página pública de recibo** que abre el cliente |
| B5 | `src/modules/billing/app/routes/payInvoice.routes.ts:47` | la **referencia del pago** |
| B6 | `src/modules/billing/app/routes/psp.routes.ts:257` | el **timeline del cliente** (ficha 360) |
| B7 | `src/modules/billing/app/routes/mpWebhook.routes.ts:197` | ídem, vía Mercado Pago |

**Total de superficie afectada: 23**, no 16.

🔴 Y los cinco primeros llevan escrito en el código, literalmente, el motivo por el que dicen
«justificante»:

> `// Regla 24/26: un J-… es JUSTIFICANTE — el copy jamás dice "factura"`

Renombrarlos no es cambiar un rótulo del panel: es **decirle «factura» al cliente del profesional,
por WhatsApp y en una página pública, sobre un documento que no entra en la cadena VeriFactu.**

---

## 3 · LA TABLA PROPUESTA (hoy → propuesto). **No aplicada.**

«Factura» es femenino y «justificante» masculino: no es un reemplazo de texto. La concordancia va
resuelta una por una.

| hoy | propuesto |
|---|---|
| `Justificantes` | `Facturas` |
| `Nº justificante` | `Nº factura` |
| `Nuevo justificante` | `Nueva factura` |
| `+ Nuevo justificante` | `+ Nueva factura` |
| `Emitir justificante` | `Emitir factura` |
| `Crear un justificante nuevo` | `Crear una factura nueva` |
| `Justificante emitido` | `Factura emitida` |
| `No hemos podido emitir el justificante. Inténtalo otra vez.` | `No hemos podido emitir la factura. Inténtalo otra vez.` |
| `Detalle y acciones del justificante.` | `Detalle y acciones de la factura.` |
| `🧾 Ver justificante` | `🧾 Ver factura` |
| `JUSTIFICANTE` (chip) | `FACTURA` |
| `…evidencia de aceptación + justificante + registro…` | `…evidencia de aceptación + factura + registro…` |

### 🔴 Y CUATRO que NO tienen traducción, que es el segundo motivo para parar

| hoy | qué pasa al renombrarlo |
|---|---|
| `Justificante de cobro` (ficha, `invoiceDetailView.js:81`) | «Factura de cobro» **no existe** en castellano. Habría que decidir un término, no traducirlo. |
| `JUSTIFICANTE DE COBRO` (**en el PDF**, `pdf.service.ts:364`) | ídem, y además **va impreso en el papel que ve el cliente**. |
| `Justificante de cobro — este documento acredita el cobro recibido.` (**PDF**) | La frase **describe lo que el documento es**. Cambiarla a «factura» convierte una descripción correcta en una **afirmación fiscal**. |
| `Este documento es un justificante, no una factura fiscal: no entra en la cadena VeriFactu.` | Renombrado sale: *«Este documento es una factura, no una factura fiscal»*. **Se contradice a sí mismo.** |

Estos cuatro no son rótulos del nombre del documento: son **enunciados sobre qué es el documento**.
Un renombrado mecánico los rompe.

---

## 4 · IDENTIFICADORES INTERNOS — 65 apariciones en 31 ficheros. **NO SE TOCAN** (regla 27)

Aquí «justificante» / `JUST` / `J-` no es un rótulo: es un estado, un modo, una clave o un valor
guardado. Cambiar uno no es renombrar, es **migrar datos**.

| identificador | dónde vive | qué es |
|---|---|---|
| `Invoice.type` = `'JUST'` / `'F1'` | `schema.prisma:104` · `invoicesAdmin.routes.ts:126,142` · `lib/invoicing.ts:348` | **valor guardado** en la tabla |
| prefijo `J-` del número | `invoiceNumber.service.ts` · `isReceiptNumber` en 8 ficheros | **serie de numeración guardada** |
| `ModoDocumentoSuelto = 'factura' \| 'justificante' \| 'no'` | `facturaSuelta.ts:74` | **tipo del dominio** |
| `modoDocumentoSuelto(merchant)` | `facturaSuelta.ts` · `app.ts:477` | el **veredicto** que viaja en `/admin/me` |
| `window.appDocumentoSuelto === 'justificante'` | `app.js:38` · `rotulosDelDocumento.js:54` · `invoicesView.js:222` | el **predicado** del front |
| `tipoDeFactura(doc) !== 'justificante'` | `invoicesView.js:81` · `jobDocsReparto.js:36` · `jobRailBlocks.js:130` | **clasificador** interno |

---

## 5 · EL GUARD QUE CAMBIA DE VEREDICTO: `guard:caja-documento-suelto`

Su ficha dice que existe porque *«los rótulos del modo justificante son más largos que los de
factura y hay que ver si caben»*. **Medido, es cierto en los SIETE:**

| rótulo | justificante | factura | Δ |
|---|--:|--:|--:|
| `tituloListado` | 13 | 8 | −5 |
| `columnaNumero` | 15 | 10 | −5 |
| `tituloModal` | 18 | 13 | −5 |
| `accionPrimaria` | 19 | 14 | −5 |
| `ariaDialogo` | 27 | 23 | −4 |
| `avisoEmitido` | 20 | 15 | −5 |
| `errorAlEmitir` | 59 | 54 | −5 |

Máximo: **59 → 54**.

🔴 **El guard no «cambia de veredicto»: deja de discriminar.** Mide los mismos siete rótulos EN LOS
DOS MODOS; si los dos modos dicen «factura», mide **el mismo texto dos veces**. Su caso peor —el
que justifica que exista— desaparece. Seguiría verde, y ese verde ya no significaría nada.

Consecuencia práctica: **no habría que aflojarlo, habría que re-decidir para qué sirve.** Un guard
que compara una cosa consigo misma es la familia de falso verde que esta casa lleva meses cerrando.

---

## 6 · Observación de paso, sólo reportada (regla 37): «Sugerir con IA»

**Aparece UNA vez en el código** —`quotesView.js:1223`, `linesHeader.appendChild(aiBtn)`— y se
pinta en **DOS pantallas**, porque desde SCRUM-600 la misma página sirve al presupuesto
(`quotes-new`) y al documento suelto (`invoices-new`).

**La observación del fundador se confirma midiendo el orden de pintado** dentro del bloque
«2. Líneas»:

```
blockLines
 ├─ blockLinesTitle  «2. Líneas»                    quotesView.js:397
 ├─ linesVatRow                                      :560
 │    └─ fieldVatDefault  «IVA por defecto (%)»      :561
 └─ linesHeader                                      :1241
      └─ aiBtn  «✨ Sugerir con IA»                   :1223
```

El botón se pinta **inmediatamente después de la fila del «IVA por defecto (%)»**, así que la
lectura de la captura es correcta: parece que sugiere el IVA. **No se toca**: es otro carril y otra
firma. Queda contado y situado.

---

## 7 · POR QUÉ ESTO PARA — dos motivos, y ninguno es de tiempo

1. **Son dos flujos** (§1). Renombrar deja al profesional pulsando «Nueva factura» en Facturas para
   crear algo que Facturas no lista.
2. **Siete de los rótulos salen del panel y llegan al cliente** (§2, grupo B), y cuatro más son
   enunciados sobre qué es el documento que el renombrado convierte en contradicción o en
   afirmación fiscal (§3). Está pendiente la respuesta del agente VeriFactu sobre si un documento
   **sin NIF del destinatario** (medido en SCRUM-729: `taxId` no viaja al PDF) puede llamarse
   «factura». Escribirlo antes de esa respuesta es la familia de SCRUM-534.

**Nada tocado:** ni un rótulo, ni `prisma/schema.prisma`, ni el camino de emisión, ni el guard.

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

---

# APÉNDICE · 8-sep-2026 · FASE 0 · El guion del borrado de documentos de prueba — MEDIDO, no ejecutado

**Medido contra:** `origin/main` = `2f123b7071d148bc93b87a42354f52ede8bef065` · 2026-09-08T18:00:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Fase 0 de SCRUM-825.** Produce un GUION; **no se ha ejecutado en ninguna base, ni en dev.**
Lo ejecuta el fundador: staging primero, producción después.

**OBLIGACIÓN 0:** no hay rama `scrum-825b-*`. La única `scrum-825*` que hubo era la fantasma que
creé al empujar sobre `main`, y ya no está en el remoto. En `main` sólo consta `79f33e0e`
(la medición del renombrado, PR #1171). Causa (a): se construye.

**Levanta la regla 29 UNA VEZ**, con su motivo escrito en la cabecera del `.sql`, y **no es
precedente**.

---

## 1 · EL ÁRBOL DE DEPENDENCIAS — derivado del schema, y el hallazgo es lo que NO ata

Suelo: el barrido tiene que ver referencias a `invoices`. **Las ve.** Y ve más de las que se
esperaban por otro sitio.

### 1.a · Lo que declara Prisma: 27 modelos, 29 claves ajenas

| raíz | tabla | referencias DIRECTAS con FK |
|---|---|---|
| `Invoice` | `invoices` | 1 — `invoices."rectifiesId"` (auto-referencia, `SetNull` implícito) |
| `Quote` | `quotes` | 2 — `expenses.quote_id` · `invoices."quoteId"` (los dos `SetNull` implícito) |
| `Albaran` | `albaranes` | 0 |
| `ParteTrabajo` | `partes_trabajo` | 0 |

⚠️ Los tres `onDelete` son **implícitos**: Prisma aplica `SetNull` por ser relaciones opcionales.
Ninguno está escrito en el schema. Se dice porque un defecto implícito es el que nadie recuerda.

### 1.b · 🔴 EL HALLAZGO: de SIETE columnas que apuntan a un documento, sólo DOS tienen FK

| tabla | columna | ¿FK? | qué pasa al borrar |
|---|---|:-:|---|
| `expenses` | `quote_id` | **sí** → `quotes`, `SetNull` | se anula sola |
| `invoices` | `"quoteId"` | **sí** → `quotes`, `SetNull` | se anula sola |
| `albaran_lineas_facturadas` | `albaran_id` | 🔴 **NO** | queda huérfana, en silencio |
| `albaran_lineas_facturadas` | `invoice_id` | 🔴 **NO** | ídem |
| `albaranes` | `invoice_id` | 🔴 **NO** | ídem |
| `jobs` | `quote_id` | 🔴 **NO** | ídem |
| `maintenance_plans` | `quote_id` | 🔴 **NO** | ídem |

**Consecuencia para el guion:** el orden **no lo impone la base**, hay que imponerlo a mano, y las
cinco sin FK hay que limpiarlas explícitamente. Un `DELETE` en el orden equivocado no daría error:
dejaría filas apuntando a nada.

### 1.c · Y TRES referencias POLIMÓRFICAS que un barrido por nombre de columna NO ve

| tabla | cómo referencia | valores |
|---|---|---|
| `audit_log` | `entity_type` + `entity_id` | `invoice` · `quote` · `albaran` |
| `whatsapp_messages` | `related_type` + `related_id` | `quote` \| `invoice` \| `charge` |
| `email_messages` | `related_type` + `related_id` | `invoice` \| `quote` \| `charge` |

No pueden tener FK —son polimórficas— así que **nada las ata y nada las borra**. El guion **no las
toca a propósito**: son el registro de lo que pasó, y borrarlas convierte un borrado de datos de
prueba en un borrado de rastro. **Queda para el fundador**, con su recuento en el fichero de
verificación.

> ⚠️ **Corrección de mi propio instrumento, dicha en voz alta:** mi primer barrido buscaba columnas
> `*Id` y marcó las siete como «sin FK», incluidas las dos que sí la tienen. En Prisma el
> `@relation(fields: [x])` va en la línea HERMANA, no en la columna escalar. Se corrigió cruzando
> los dos barridos. La tabla de arriba es la del barrido cruzado.

### 1.d · Lo que el encargo daba por hecho y no está

**`invoice_assignees` NO EXISTE en el schema de `main`.** El encargo la nombra («la creamos hoy»),
así que vive en otra rama sin mergear. Si entra después, **hay que volver a derivar el árbol**: es
una referencia más a `invoices` y cambiaría el orden del guion.

---

## 2 · LOS CONTADORES — es un CONTADOR GUARDADO, no un derivado. Decisión del fundador.

**No se deriva de contar filas.** Vive en columnas de `merchants`:

| columna | schema | qué numera |
|---|---|---|
| `next_invoice_number` | `:22` | la serie de facturas |
| `next_rect_invoice_number` | `:24` | las rectificativas |
| `next_quote_number` | `:25` | los presupuestos |
| `next_albaran_number` | `:28` | los albaranes |
| `invoice_series_year` · `albaran_series_year` | `:23` · `:29` | el año, para el reinicio anual |

Quien lo lee y lo escribe: `allocateInvoiceNumber` (`invoiceNumber.service.ts:390`), con un
read-then-write dentro de transacción.

🔴 **Así que borrar los documentos NO reinicia la numeración.** Medido en dev: el merchant #1
tiene **5 facturas** y `next_invoice_number = 6`; tras el borrado emitiría `2026-FG-006` con la
tabla vacía.

**❓ PREGUNTA PARA EL FUNDADOR:** ¿se reinician a 1? El `UPDATE` está escrito y **comentado** al
final del `.sql`. No lo descomenta esta sesión: es una decisión sobre numeración fiscal.

---

## 3 · LA CADENA DE HUELLAS — el producto SÍ puede seguir emitiendo

Ésta era la pregunta que podía dejar el producto muerto. **No lo deja.**

* La cadena vive **dentro de `invoices`**: `vf_hash` y `vf_prev_hash` son columnas de la propia
  tabla (`schema.prisma:855-856`). **No hay tabla de registros aparte**, así que borrar las
  facturas se lleva la cadena entera y no deja nada colgando.
* Y el código soporta empezar de cero. `ultimaHuellaDeLaCadena`
  (`verifactu.service.ts:444`) termina así:

```ts
if (!ultimaAnul?.vfAnulHash) return ultimaAlta?.vfHash ?? '';   // :474
```

  Con la tabla vacía devuelve **cadena vacía**, y el propio código lo declara legítimo:
  *«Vacío = primer registro de la cadena. Es legítimo, no un fallo.»* (`:500`).

* **Está fijado por test**, no es una lectura optimista: `tests/verifactu.test.mjs:20` usa
  `prevHash: ''  // primer registro → VACÍO (no '0')` con huella dorada
  `3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60`.

**Veredicto: la primera factura tras el borrado será el primer eslabón de una cadena nueva, que es
exactamente lo que fue la primera factura de siempre.** Sin blocker.

⚠️ Sólo se ha LEÍDO el camino de emisión (regla 38). No se ha modificado nada.

---

## 4 · LOS JUST — cero en dev, y el suelo NO se puede dar por cumplido desde aquí

Medido en **`yaqu_dev_javier`** (la única base que este encargo permite tocar; cero producción,
cero staging), sólo lectura:

| merchant | JUST | facturas | total |
|---|--:|--:|--:|
| #1 Fontanería García | 0 | 5 | 5 |
| #2 QA Staging · #114 · #173 · #210 · #742 | 0 | 0 | 0 |
| **TOTAL dev** | **0** | **5** | **5** |

Otras tablas en dev: `quotes` **15** · `albaranes` 0 · `partes_trabajo` 0 ·
`albaran_lineas_facturadas` 0 · `charges` 8.

### 🔴 El suelo del encargo decía «si sale cero, está roto». Sale cero, y NO está roto.

El encargo apoya el suelo en SCRUM-442, que midió **44 de 55 · 10-ago-2026 · en PRODUCCIÓN**. Dev
es otra base con otros datos: **un cero aquí no dice nada sobre producción.**

Y que el instrumento funciona se prueba con un **control positivo**, no con una afirmación:

```
CONTROL · el clasificador SÍ lee la columna `type`:   type="F1"  5
los números de serie:  2026-FG-001 … 2026-FG-005      (ningún prefijo J-)
```

Cuenta filas, lee `type`, y las cinco que hay son `F1` con serie fiscal. **Dev de verdad no tiene
justificantes.** El 44/55 sigue siendo un dato de producción **y no se puede reproducir desde aquí
por diseño**: hacerlo exigiría tocar producción, que este encargo prohíbe.

---

## 5 · LO QUE SE ENTREGA

| fichero | qué es |
|---|---|
| `docs/sql/scrum-825-borrado-de-documentos-de-prueba.sql` | el guion, en orden, cada sentencia comentada con por qué va donde va, y arriba qué NO borra |
| `docs/sql/scrum-825-verificar-borrado.sql` | los `SELECT`, **en fichero aparte** (SCRUM-650): recuento por merchant, tamaños, **huérfanas**, contadores y las polimórficas |

El orden del guion: `albaran_lineas_facturadas` → `partes_trabajo` → `albaranes` → `invoices` →
anular `jobs.quote_id` y `maintenance_plans.quote_id` → `quotes`. Todo en una transacción.

⚠️ El aplicador de dev lo **rechazará**: su lista blanca no admite `DELETE`, y hace bien. No es un
obstáculo que rodear — es la señal de que esto no es una migración de rutina.

---

## 6 · LAS PREGUNTAS QUE QUEDAN ABIERTAS PARA EL FUNDADOR

1. **¿Se reinician los contadores de serie a 1?** Si no, el primer documento de verdad seguirá la
   numeración de los de prueba. El `UPDATE` está escrito y comentado (§2).
2. **¿Se borran también los `charges`?** Un cobro no es un documento, pero tras el borrado queda
   sin documento que lo respalde. En dev hay 8.
3. **¿Se borra el rastro polimórfico** de `audit_log`, `whatsapp_messages` y `email_messages`? Hoy
   quedará apuntando a documentos que ya no existen. El guion **no** los toca (§1.c).
4. **Antes de ejecutar, ¿sigue Tecnosel con cero documentos?** El fichero de verificación lo
   contesta con el recuento por merchant, y hay que pasarlo **antes** y **después**.
5. **Si `invoice_assignees` entra en `main`**, hay que volver a derivar el árbol y rehacer el orden
   (§1.d).

## 7 · Lo que NO se ha tocado

- **Ninguna base**: ni dev, ni staging, ni producción. Sólo se ha LEÍDO dev para contar.
- `prisma/schema.prisma` · el camino de emisión (sólo lectura, regla 38) · ningún rótulo · ningún
  estado ni flag nuevo · ninguna dependencia nueva.

---

# APÉNDICE · 8-sep-2026 · FASE 0 (2ª vuelta) · el guion, EJECUTABLE

**Medido contra:** `origin/main` = `2f123b7071d148bc93b87a42354f52ede8bef065` · 2026-09-08T20:00:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

Las **cinco respuestas del fundador (8-sep-2026)** están dentro del guion, cada una con su motivo
escrito al lado de la sentencia que la aplica. Sigue **sin ejecutarse en ninguna base, ni en dev**.

## Lo que cambia respecto a la primera vuelta

| | 1ª vuelta | ahora |
|---|---|---|
| ① contadores | `UPDATE` comentado, pregunta abierta | **descomentado**, con los `*_series_year` a `NULL` |
| ② charges | no se borraban, pregunta abierta | **se borran**, y `events` + `reconciliations` van LOS PRIMEROS |
| ③ rastro polimórfico | pregunta abierta | **no se toca**, con el motivo escrito en el guion |
| ④ Tecnosel | «pasar la verificación» | **bloqueante**: contra PRODUCCIÓN y EL MISMO DÍA |
| ⑤ SCRUM-597 | «hay que rederivar» | derivado de su rama, **pendiente de confirmar en `main`** |

## 🔴 ② El orden de `charges` no es de gusto: es una restricción MEDIDA

Hacia `charges` hay **cuatro** referencias, con dos comportamientos:

| referencia | onDelete | efecto al borrar el cobro |
|---|---|---|
| `events.charge_id` | **Restrict** (obligatoria, sin `onDelete`) | 🔴 **lo BLOQUEA** |
| `reconciliations.charge_id` | **Restrict** (ídem) | 🔴 **lo BLOQUEA** |
| `quotes."chargeId"` | SetNull | se anula sola |
| `invoices.charge_id` | SetNull | se anula sola |

Con **una sola fila** en `events`, el `DELETE FROM charges` falla y —al ir todo en una
transacción— tumba el borrado entero. Por eso `events` y `reconciliations` son ① y ②, antes que
ningún documento. La instrucción del fundador era correcta; ahora está medida.

## ① Los contadores: el número exacto que lo justifica

`next_invoice_number` es una **columna guardada** (`schema.prisma:22-29`), no un derivado de
contar filas. Medido en dev: merchant #1 con **5 facturas** y `next_invoice_number = 6`. Sin el
reinicio, **la primera factura real saldría `2026-FG-006`** sobre una tabla vacía.

Los `*_series_year` van a `NULL` con los contadores: son el año de la serie **en curso**, y una
serie que empieza de nuevo no tiene año en curso hasta que se emita algo. Dejarlos puestos con el
contador a 1 sería declarar un ejercicio que ya no tiene documentos.

## ⑤ SCRUM-597 — derivado de su rama, y NO dado por bueno

**No está en `main`.** Comprobado dos veces durante esta sesión: `origin/main` = `2f123b70`, sin
commit que lo mencione y sin las tablas en el schema. La rama
`scrum-597-asignar-usuario-al-documento` (`7450af1f`) sigue viva.

Leído **en esa rama**, las dos tablas declaran `onDelete: Cascade` sobre el documento:

```prisma
quote   Quote   @relation(fields: [quoteId],   references: [id], onDelete: Cascade)
invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
```

Con su propio comentario: *«onDelete: Cascade en LAS DOS, por la lección de SCRUM-244: sin él la
FK es RESTRICT y borrar un empleado —o su merchant— revienta a mitad de recorrido».*

⇒ **Se arrastran solas y el orden del guion NO cambia.** Pero eso es una **previsión derivada de
una rama sin mergear**, no una medición del árbol que se va a ejecutar. Queda escrito en el guion
que **antes de ejecutar hay que rederivar con las dos tablas ya en `main`** y confirmar que el
Cascade sobrevivió a la mezcla: si alguna llegara con RESTRICT, tendría que ir antes que su
documento, como `events`.

## Lo que exige la ausencia de copia de seguridad

El guion se abre con **qué NO se puede deshacer**, enumerado: las facturas y su cadena de huellas
(irreconstruible: cada huella encadena con la anterior, y la anterior ya no está), los
presupuestos con sus firmas, los albaranes y partes, los cobros con su traza de pasarela, y los
contadores, que vuelven a 1 sin dejar constancia de por dónde iban.

Todo en **una transacción**. Cada `DELETE` lleva al lado **el recuento que debe salir** —el de la
pasada ANTES— para que quien ejecuta sepa si el número que ve es el que debía ver. Y la
verificación gana un bloque **②b** con las tablas que NO se tocan (`customers`, `audit_log`,
`whatsapp_messages`, `email_messages`): ahí el número tiene que ser **el mismo antes y después**,
que es el control de que la limpieza no se llevó por delante lo que debía quedarse.

## Lo que NO se ha tocado

- **Ninguna base.** Ni dev. Sólo se leyó dev en la primera vuelta, para contar.
- `prisma/schema.prisma` · el camino de emisión · ningún rótulo · ningún estado ni flag nuevo ·
  ninguna dependencia nueva.

---

# APÉNDICE · 8-sep-2026 · FASE 0 (3ª vuelta) · rederivado con SCRUM-597 dentro

**Medido contra:** `origin/main` = `1bbf60afb9eae547e083e1c716fa97c88306d791` · 2026-09-08T22:00:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

Era el punto ⑤, el único que la vuelta anterior dejó sin dar por bueno. **Ya se puede cerrar, con
una salvedad que se declara en vez de callarse.**

## Lo rederivado, sobre el schema YA MEZCLADO

`main` = `1bbf60af` trae SCRUM-597 (PR #1172). Vuelto a correr el derivador del árbol:

| columna | destino | onDelete | schema |
|---|---|---|---|
| `quote_assignees.quote_id` | `quotes` | **Cascade** | `:1596` |
| `invoice_assignees.invoice_id` | `invoices` | **Cascade** | `:1613` |
| `quote_assignees.team_member_id` | `team_members` | Cascade | `:1597` |
| `invoice_assignees.team_member_id` | `team_members` | Cascade | `:1614` |

**Las cuatro, Cascade.** Las dos que apuntan a un documento se arrastran solas, así que
**el orden del guion NO cambia**: ninguna tiene que subir por delante de su documento como
tuvieron que hacer `events` y `reconciliations`.

El resto del árbol sigue igual: **de las nueve columnas que apuntan a un documento, cuatro tienen
FK** (las dos nuevas con Cascade, más `expenses.quote_id` e `invoices."quoteId"` con SetNull) y
**cinco no las ata nada**.

## 🔴 LA SALVEDAD, y por qué el guion no depende de ella

Lo de arriba es lo que **DECLARA** el schema. Lo que la **BASE APLICA** vive en
`information_schema.referential_constraints`, y **no se ha podido medir desde ninguna base
permitida**:

* en **dev** las dos tablas **NO EXISTEN** — la migración de SCRUM-597 no está aplicada allí.
  Medido, no supuesto: el script se declaró incapaz y salió con 3 en vez de devolver un verde;
* **staging y producción** están prohibidas para esta sesión. El fundador confirmó que las tablas
  EXISTEN en las dos, que es otra pregunta distinta de cuál es su `DELETE RULE`.

**Así que no se ha hecho depender el guion de un dato que no se puede comprobar.** El bloque
②bis **vacía las dos tablas explícitamente**, y con eso el guion es correcto en los dos casos:

* si son CASCADE → borra filas que se habrían ido igual. Coste: cero, y el recuento queda a la
  vista en vez de desaparecer en un borrado invisible;
* si alguna llegó como RESTRICT → son **imprescindibles**: sin ellas, ⑤ o ⑦ fallarían y —al ir
  todo en una transacción— tumbarían el borrado entero.

Es más barato que acertar. Y para cerrarlo del todo, el fichero de verificación gana un **bloque
⑥ que LEE el `DELETE RULE` de verdad**: pasado en staging antes de ejecutar, la salvedad deja de
existir con una consulta.

## Lo demás que cambia

* Bloque ② de la verificación: entran `quote_assignees` e `invoice_assignees` — el guion las
  vacía, así que **después tienen que dar cero**. No van al ②b (las que no se tocan).
* Bloque ②b, sin cambios: `customers`, `audit_log`, `whatsapp_messages`, `email_messages`.

## VEREDICTO

**EJECUTABLE.** El guion queda listo para que lo pase el fundador: staging primero, producción
después. Con sus tres condiciones, que no son negociables porque no hay copia de seguridad:

1. pasada **ANTES** de la verificación, en **PRODUCCIÓN** y **el mismo día** — bloque ① y su
   ⛔ sobre Tecnosel;
2. bloque ⑥ en **staging** antes de ejecutar, para cerrar la salvedad de arriba;
3. pasada **DESPUÉS**, y **comparar** las dos salidas.

**Nada ejecutado por esta sesión.** Ni en dev.

---

# SCRUM-825 · APÉNDICE · 8-sep-2026 · FASE 2 · El expediente de retirada de `JUST` — **PARA FIRMA**

**Medido contra:** `origin/main` = `61d14a15bd414116a69ed8f6a8f88367164bff65` · 2026-09-08T23:00:00+02:00

> 📌 **El encabezado empieza por `# SCRUM-825` A PROPÓSITO, y no por `# APÉNDICE` como los tres de
> la fase 0.** Es el delimitador que `tests/scrum267-ancla-de-medicion.test.mjs:147` usa para
> trocear un fichero en entradas (`^# SCRUM-\d+` fuera de bloque cercado). Con `# APÉNDICE` este
> bloque **no es una entrada** para el guard, y su ancla no se comprueba: la daría por buena la de
> la línea 3, que es de otra medición. Medido, no supuesto — ver §7.

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Carril:** fiscal (camino de emisión) · **Gate:** LECTURA. **Cero código.**

> ⛔ Este apéndice **no borra, no sustituye y no toca ni un rótulo**. Enumera, propone y para.
> El cambio de máster de §4 lo firma el fundador; las seis preguntas de §3 **no las contesta
> esta sesión**.

**Sobre el ancla, dicho antes de que nadie lo pregunte:** el censo de código se levantó sobre
`origin/main` = `56fed4234542f565c3dece1428147347950c770d`. Al reanclarlo se comprobó que los **13
commits** posteriores (`56fed423..61d14a15`) **no tocan ni un fichero de la superficie medida** —
SCRUM-340, SCRUM-637, SCRUM-824, todos en `docs/`, `tests/` y `founding.ts`—, así que el censo se
mantiene. Lo que **sí** se movió es `docs/YAQU_MASTER.md` (+2 líneas, por la regla 39 y la
renumeración a 42 de SCRUM-637), y **todas las citas del máster de este apéndice están
re-derivadas contra `61d14a15`**, no copiadas de la pasada anterior.

**OBLIGACIÓN 0.** `git ls-remote --heads origin | grep scrum-825` → **vacío**: no hay ninguna rama
`scrum-825*` viva en el remoto. No es la causa «nunca se empujó»: en `origin/main` constan
**cinco** commits del ticket —`79f33e0e` (el censo del renombrado, PR #1171), `793825e1`,
`a610739f` y `4d8c0650` (las tres vueltas del guion de borrado, PRs #1175 y #1182)—. La rama
`scrum-825-el-documento-que-cambia-de-nombre` **era la del censo, está mergeada**, y su contenido
son las secciones 1-7 de este mismo fichero. **Se leyeron enteras y no se repiten.**

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
(máster :477-566, firmada el 19-ago-2026) autorizó **para un merchant nombrado, por identificador,
y con la llave auditada de SCRUM-218** — declarando en la misma página que *«la regla general NO
cambia»* y que *«esta excepción no la deroga: la perfora para UN merchant»* (:485-488).

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

**Censo fresco (8-sep-2026):** **57 ficheros** de `src/` y `public/` contienen `justificante` /
`'JUST'` / `isReceiptNumber` / `RECEIPT_NUMBER_PREFIX` / `'receipt'`. De ellos, **2 son homónimos
y NO entran** (`src/modules/expenses/domain/justificante.ts` y su vista `expensesView.js`: ahí
«justificante» es el **justificante de un GASTO** y su deducibilidad de IVA, SCRUM-324 — nada que
ver con `Invoice.type`). **Población real: 55 ficheros.**

Superficie visible al usuario medida en §2, cubo 🔴-C: **34 textos**, no 23. Los once que el censo
anterior no contaba están en `settingsView.js` (3), `jobDetailView.js` (1), `email.service.ts` (3,
y son **asunto y cuerpo del correo al cliente**), y el PDF (4 ramas de rótulo, no 2).

### 1.b · Lo de las bases NO lo puedo verificar, y por diseño

Producción y staging están **prohibidas para esta sesión**, y `dev` es otra base con otros datos
(la fase 0 lo dejó escrito arriba: *«un cero aquí no dice nada sobre producción»*). **El «0 filas»
se toma como dato del fundador, no como medición de esta sesión.**

Y hay un matiz que sí puedo derivar del guion de la fase 1, y **contradice «no hay migración de
datos que hacer»**: el guion **NO borra el rastro polimórfico** —`audit_log`,
`whatsapp_messages`, `email_messages`—, por respuesta ③ del fundador, y su bloque ②b exige que esas
tablas den **el mismo número antes y después**. Esas filas **contienen `JUST` como valor guardado**:

* `audit_log.meta.tipoFactura = 'JUST'` y `meta.esJustificante = true` (`invoiceNumber.service.ts:473,477`);
* `email_messages.kind = 'justificante'` (`registroDeEnvios.ts:91`, escrito por `email.service.ts:79`).

⇒ **Hay datos con `JUST` dentro y nadie los ha borrado.** No son documentos, son el registro de
que existieron. Cuántos hay, no lo sé desde aquí; **que existen, sí**.

### 1.c · 🔴 El flag no está en `false` explícito: está en `false` por AUSENCIA

El máster lo dice, medido el 17-ago-2026 (:544-546):

> *«en producción (`cobroflash-backend`) y en `yaqu-staging` esa variable está **sin definir**,
> luego vale `false` por defecto del código. Está en `false` **por ausencia, no por mecanismo**.»*

No es un matiz de redacción. Con `false` explícito, encenderlo exige que alguien **cambie** un
valor. Por ausencia, encenderlo exige que alguien **defina** la variable — y el máster escribe la
consecuencia en la línea siguiente (:548-550): *«si esa variable se pusiera en `true`, todos los
merchants españoles sin override propio quedarían con la facturación encendida sin una sola fila
`cambio_flag`»*. El máster lo llama **«el hueco conocido»** (:539-560) y su puerta sigue abierta:
*«una prohibición sin mecanismo es una costumbre que falla una vez de cada seis»* (:560).

**Esto entra en el orden de §5 como paso 1, y es la razón de que la pregunta ⓪ exista.**

---

## 2 · LA LISTA DE MUERTE

**Regla de admisión: sin `fichero:línea` no entra.** Todas las líneas verificadas en esta sesión.

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

Y **cuatro no tienen traducción**, ya medido en la sección 3 de este mismo fichero y sigue siendo
cierto: «Factura de cobro» no existe; `pdf.service.ts:677` («No constituye una factura») **se
contradice** si el documento pasa a ser una factura; y `invoicesAdmin.routes.ts:833` renombrado
diría *«Este documento es una factura, no una factura fiscal»*.

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
> misma familia de falso verde que la sección 5 de este fichero ya había anticipado para este
> guard. **Se reporta, no se toca** (regla 37: otra zona, no bloquea esta tarea).

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
por mecanismo (máster :544-546), y encenderlo globalmente **no deja fila `cambio_flag`**
(:548-550). No hay ningún merchant real de pago en producción.

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
> Va con `[  ]` en los huecos que sólo él puede rellenar. Las líneas de destino están medidas
> contra `origin/main` = `61d14a15`; si el máster se mueve antes de la firma, se re-derivan.

### 4.a · Entrada nueva, al final de la **EXCEPCIÓN TEMPORAL DE FACTURACIÓN · THE PIONEER** (tras la línea 566)

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
2. el hueco declarado del interruptor global (máster «El hueco conocido», dentro de esta misma
   excepción) cerrado o explícitamente asumido: la variable de entorno sigue sin gobernar la llave
   auditada de SCRUM-218;
3. cero documentos vivos en producción y staging, verificado el mismo día
   (`docs/sql/scrum-825-verificar-borrado.sql`).

**Lo que NO autoriza:** cambiar ni un rótulo. Los 34 textos censados en el APÉNDICE FASE 2 de
`docs/master/SCRUM-825.md` (§2, cubo 🔴-C) siguen bajo las reglas 30 y 39: se proponen y se firman
uno a uno.
```

### 4.b · Enmienda en la **PARTE I — REGLAS**, regla 24 (línea 245)

```markdown
24) `INVOICING_ES_ENABLED=false` para merchants ES reales hasta SIF-1 v2 completo; facturas demo
con marca de agua SIEMPRE. **[DEROGADA la mitad del flag el [FECHA] por SCRUM-825 fase 2 — ver
«Cierre de la excepción por generalización». La marca de agua del demo y la prohibición de claims
fiscales (reglas 7, 17, 26) siguen VIGENTES.]**
```

### 4.c · Enmienda en la **PARTE P — FEATURE FLAGS**, fila del flag (línea 463)

```markdown
| `INVOICING_ES_ENABLED` | país ES / merchant | **ON** *(desde [FECHA], SCRUM-825 fase 2)* | —
| factura fiscal ES a reales | SIF-1 + datos fiscales | 🔴 **el rollback ya NO devuelve a
«justificante»: ese modo se retiró del código.** Apagar el flag deja al merchant ES real **sin
poder emitir** — no es un rollback seguro, es una parada |
```

> 🔴 Esa última celda es la que hay que leer dos veces. Hoy el flag tiene **rollback seguro**
> («seguro: vuelve a "justificante"», máster :463). Después de la fase 2 **deja de tenerlo**,
> porque el sitio al que volvía ya no existe. Es una propiedad que se pierde, y el máster tiene
> que decirlo.

### 4.d · Enmienda en la **PARTE U**, entrada V0-0 (línea 977)

```markdown
- **V0-0 · Flag de facturación ES:** ~~`INVOICING_ES_ENABLED=false` para merchants ES reales
  no-demo hasta SIF-1~~ **CERRADO el [FECHA] por SCRUM-825 fase 2: el flag pasa a ON y el modo
  `receipt` se retira.** Demo conserva facturas con marca de agua "DEMO — no válida fiscalmente"
  en PDF y pantalla (esto NO cambia). Done original: imposible emitir factura fiscal a un real.
  ~~Rollback: flag.~~ **Ya no hay rollback por flag — ver Parte P.**
```

---

## 5 · EL ORDEN DE EJECUCIÓN, Y QUÉ ROMPE CADA PASO FUERA DE ORDEN

> 📌 **DÓNDE VIVE ESTA SECCIÓN, Y CUÁNDO SE MUDA.** Hoy esto **no es un procedimiento vigente**:
> es la propuesta de orden de un cambio que **nadie ha firmado todavía**, y por eso vive aquí,
> con la decisión que la justifica, y **no** en `docs/RUNBOOKS.md`.
>
> **El día que el cambio de máster de §4 esté FIRMADO, esta sección §5 se muda a
> `docs/RUNBOOKS.md`** —entonces sí es un procedimiento que alguien ejecuta— **y esta entrada lo
> NOMBRA con su ruta**, que es lo que exige el registro por fichero (SCRUM-273). Queda escrito
> aquí para que no haya que redescubrirlo leyendo el guard.

Como en el borrado: **el orden no lo impone la base, lo impone quien escribe el guion.** Aquí no lo
impone ni la base ni el compilador — lo impone **qué ve un profesional mientras dura la
transición**, que es lo único que no se puede deshacer.

**Regla que gobierna todo el orden:** *el rótulo va DESPUÉS del documento, nunca antes.* Un panel
que dice «factura» sobre un `J-` le está mintiendo a alguien que responde ante Hacienda.

| # | paso | qué rompe si se hace ANTES de tiempo |
|---|---|---|
| **0** | **Firmar §4** (cambio de máster) y contestar las **seis** preguntas de §3 | sin esto, cualquier paso siguiente inventa una decisión de flag y de estado — reglas 5 y 27 |
| **1** | **Encender el flag por el camino auditado** (`scripts/cambiar-flag-fiscal.mjs`, SCRUM-218), merchant a merchant. **NUNCA la variable de entorno global** | por la variable global, todos los merchants ES quedan encendidos **sin una sola fila `cambio_flag`** (máster :548-550): nadie puede demostrar después cuándo se encendió ni para quién. Y `VERIFACTU_PRODUCTOR_*` ausentes en producción ⇒ el emisor falla en claro y **no se emite nada** (SCRUM-247) |
| **2** | **Verificar por emisión real** que sale `F…`/serie fiscal y **no** `J-` | saltarlo deja el paso 3 apoyado en una lectura de código en vez de en un documento emitido. Es lo que la fase 0 de este mismo ticket llamó «afirmación de estado» frente a «registro medido» |
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
- **Las 582 líneas anteriores de este fichero, intactas.** Verificado por `Buffer.compare` del
  prefijo antes y después de añadir este apéndice: **30.491 bytes idénticos**, sha256
  `6275dd742c4316c733e800254f6d2317649a338f55534a4a1731d7d3c8153915`.

---

## 7 · EL DEFECTO DE ESTA MISMA ENTREGA, Y LO QUE DESTAPÓ

Este apéndice nació como fichero suelto, `docs/master/SCRUM-825-fase2-expediente.md`, y se empujó
**sin correr `npm run guards:entrada`**. Estaba en rojo: `tests/scrum273-registro-por-fichero.test.mjs`
exige que las entradas de `docs/master/` se llamen `SCRUM-<n>.md` **exacto**, porque el nombre es
lo que garantiza que dos tickets no escriban en el mismo sitio.

**Y el nombre libre no era sólo cosmético — se llevaba por delante a otro guard.** Medido:
`tests/scrum267-ancla-de-medicion.test.mjs:82` filtra el censo con `/^SCRUM-\d+\.md$/`. Un fichero
fuera de patrón **no entra en ese censo**, así que su ancla no se comprueba. La del expediente
suelto decía `` `56fed423` `` — sha **abreviado y sin hora**, tres motivos de rojo — y **ningún
guard lo dijo**, porque el nombre malo lo había sacado de la vista.

⇒ **Un nombre fuera de patrón no rompe un guard: lo deja mirando a otro lado.** Por eso los cuatro
guards de entrada (273, 267, 391, 242) se corren **juntos y ANTES de empujar**:

```bash
npm run guards:entrada
```

El propio mensaje de fallo de SCRUM-273 ya avisaba de que cada sesión los descubría en rojo **con
el PR ya abierto**. Ésta fue una más. Queda escrito aquí, y no sólo en el mensaje del guard, porque
un aviso que sólo aparece cuando ya fallaste llega tarde por definición.

### 🔴 Y al mover el fichero apareció un segundo punto ciego, éste del guard 267

Con el apéndice ya dentro de `SCRUM-825.md`, los cuatro guards daban **21/21 en verde**. Ese verde
era **prestado**, y se destapó probándolo en rojo en vez de creérselo: **rota el ancla de este
apéndice a propósito —sha abreviado y sin hora—, el guard 267 seguía dando 9/9.**

El motivo, medido en el propio guard: `trocearEntradas` (`tests/scrum267-ancla-de-medicion.test.mjs:147`)
corta por **`^# SCRUM-\d+` fuera de bloque cercado**, y los tres apéndices de la fase 0 de este
fichero se encabezan **`# APÉNDICE · …`**. Así que `SCRUM-825.md` entero era **UNA sola entrada**,
y le bastaba el ancla de la línea 3 —la del censo del renombrado, de otra medición— para dar por
buenas todas las de abajo.

**Es el hueco que el propio SCRUM-267 dice haber cerrado**, y su cabecera lo enuncia con estas
palabras (`:95-100`):

> *«Un ancla mal escrita en un apéndice no la veía nadie. Y lo grave es la INTERACCIÓN: SCRUM-273
> obliga a un fichero por ticket, así que un registro nuevo sobre un ticket viejo va como apéndice
> al final — justo donde este guard era ciego.»*

Lo cerró **para los apéndices que se encabezan `# SCRUM-<n>`**, que es el delimitador que midió
estable sobre 226 ficheros. **Los que se encabezan `# APÉNDICE` siguen fuera**, y son los cuatro de
este fichero.

**Qué se ha hecho aquí, y qué NO:**

* **Sí:** este apéndice se encabeza `# SCRUM-825 · APÉNDICE · …`, de modo que **es una entrada** y
  su ancla se comprueba. Verificado en las dos direcciones: con el ancla rota el guard cae
  nombrando `SCRUM-825.md#2 (línea 586) — el sha está ABREVIADO`; restaurada, 9/9.
* **No:** no se han tocado los tres encabezados de la fase 0 (regla: no se borra ni se reescribe
  nada de lo que ya había), **ni el guard**. Cambiar el delimitador del 267 para que trague
  `# APÉNDICE` es un ticket suyo, con su medición sobre los 226 ficheros y sus rojos previsibles
  — y hacerlo «de paso» aquí sería tocar el instrumento desde el encargo que acaba de fallar su
  medición, que es exactamente lo que la regla 41 prohíbe. **Se reporta** (regla 37).

**Lo que queda abierto para quien recoja esto:** este fichero lleva **cinco** anclas (líneas 3,
233, 430, 517 y 588) y **las cinco pasan `RE_ANCLA`** —comprobado ejecutando la regex del propio
guard sobre las cinco líneas, no leyéndolas—. Pero de las cinco, **el guard sólo mira dos**: la de
la línea 3 y la de la 588, que son las que encabezan una entrada. Las tres de la fase 0 están bien
**por cuidado de quien las escribió, no porque nadie lo verifique**. Vale para todo apéndice del
registro encabezado `# APÉNDICE`.

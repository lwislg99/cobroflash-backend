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

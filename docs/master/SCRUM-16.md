# SCRUM-16 / 142 · Qué falta EXACTAMENTE para cablear `buildFinalInvoice`

**Medido contra:** `origin/main` = `3f9585c29af64ed5b326cd89ccd10cd4f83c4c31` · 2026-08-10T12:05:11+02:00
**Rama:** `scrum-16-medir-anticipo`

> **MEDICIÓN, NO CONSTRUCCIÓN.** No se cablea nada: SCRUM-142 espera el dictamen P1 sobre la fecha
> de devengo. Esto es el inventario de lo que falta el día que llegue esa respuesta, con ancla.
> Cero líneas de `src/` tocadas.

---

## El punto de partida, confirmado

`buildFinalInvoice` (`src/modules/invoicing/domain/finalInvoice.service.ts`, 128 líneas) es un motor
**puro y completo** de la aritmética de compensación: líneas positivas de la operación + una línea
**negativa por tipo de IVA** por cada documento descontado, más `deductsRefs` para la auditoría.

Censo AST sobre 587 ficheros (`src` + `tests`), 513.729 nodos:

| símbolo | en `src/` | en `tests/` |
|---|---|---|
| `buildFinalInvoice` | **0 llamadas** (solo su propia declaración) | 6, todas en `scrum141-factura-final.test.mjs` |
| `deductsRefs` | 5, todas dentro del propio fichero | 7, mismo test |
| `DeductibleDoc` | 2, dentro del propio fichero | 0 |

**Nadie lo importa.** Y no es una impresión: `finalInvoice.service.ts` es **uno de los 8 módulos de
dominio inalcanzables** que cuenta el trinquete de SCRUM-411 (8 de 84). La lista completa hoy:

```
criterioCaja.ts · finalInvoice.service.ts · huecosSerie.ts · recargoEquivalencia.ts
retencionIrpf.ts · albaranSerie.ts · entregaPendiente.ts · flagFiscal.service.ts
```

👉 **Cablearlo baja el tope de 8 a 7**, que es la única dirección que el trinquete admite.

---

## Los seis huecos, en orden de quién los desbloquea

### 1 · La columna donde vive la auditoría — 🔴 NO EXISTE · **dominio del fundador**

El motor devuelve `deductsRefs` y su comentario dice que van a `Invoice.deductsRefs`.
**Esa columna no está en el schema.** Medido sobre el bloque `model Invoice` (89 líneas):

| campo | estado |
|---|---|
| `lines` | `Json?` ✅ |
| `albaranRefs` | `Json? @map("albaran_refs")` ✅ |
| `type` | `String @default("F1")` ✅ |
| **`deductsRefs`** | **🔴 no existe** |

Es una migración aditiva —`deductsRefs Json?`, mismo patrón exacto que `albaranRefs`— y
`prisma/schema.prisma` es dominio exclusivo del fundador. **Sin esta columna, la compensación se
emite sin rastro de qué descontó**, que es justo lo que la hace auditable (§P5).

Cabe en el mismo lote que las columnas de `Expense` de SCRUM-403.

### 2 · El embudo no puede transportarlo — **STOP regla 38**

`EmitInvoiceInput` admite hoy 11 campos; `deductsRefs` **no está entre ellos**, y `emitInvoice`
tampoco lo escribe en su `create`. Añadirlo es **modificar el camino de emisión**, así que va con
GO y diff delante, y con actualización del sello `EMISOR_SHA256` si arrastra
`invoiceNumber.service.ts` (no debería: el cambio es en `invoicing.service.ts`).

### 3 · Nadie sabe QUÉ documentos deducir — falta la consulta

Barrido de los 202 ficheros de `src/`: **la única consulta que busca facturas por `quoteId` está en
`metrics.service.ts:453`**, y es para métricas. En el camino de emisión no existe «dame las facturas
previas de este presupuesto». Es código nuevo, sin bloqueo externo — pero hay que decidir el
criterio (¿todas las del `quoteId`? ¿solo las `paid`? ¿se excluyen las `annulled` y las `R1`?), y
ese criterio **sí** roza el dictamen.

### 4 · 🔴 El validador de líneas rechaza el mecanismo

`facturaSuelta.ts:127` corta con `precio inválido` ante cualquier `price < 0`:

```ts
if (!esNumeroFinito(price) || price < 0) {
  return { ok: false, error: ERROR_LINEAS_INVALIDAS, message: 'Cada línea necesita un precio válido.' };
}
```

Y las líneas negativas **son** el mecanismo de la final. Medido su alcance: ese validador lo usa
**solo `invoicesAdmin.routes.ts`** (la factura suelta, A0.5) — no el camino general. O sea: es un
blocker únicamente si la final se emite por esa ruta, que es justo la candidata natural para una
final manual. **Decisión, no accidente:** o la final tiene ruta propia, o ese validador necesita una
excepción declarada.

### 5 · La fecha de devengo no tiene DÓNDE vivir — **esto es lo que P1 bloquea**

`model Invoice` **no tiene ninguna fecha propia de operación**: ni `issuedAt`, ni `fechaOperacion`,
ni `devengo`. Solo `createdAt`. Y los tres consumidores fiscales beben de ahí:

| consumidor | fecha que usa |
|---|---|
| `libroRegistro.ts:201` | `f.createdAt` |
| `verifactu.service.ts` | `fecha` → `FechaExpedicionFactura` |
| `librosAeat.ts` | `fecha` |

Hoy **devengo = fecha de creación de la factura**, implícitamente. Para un anticipo eso es
justamente lo que está en duda: el devengo del anticipo es el **cobro**, no la expedición. Si el
dictamen dice que hay que registrar una fecha distinta de `createdAt`, hace falta **columna nueva**
(otra vez schema, fundador) **y** tocar los tres consumidores de arriba.

**Éste es el único hueco que no se puede ni empezar sin la respuesta.** Los otros cinco no dependen
de ella.

### 6 · El tipo de documento

`Invoice.type` es `String` libre con `@default("F1")`; en el código solo aparecen `'F1'` y `'R1'`
(más `'JUST'`, que lo pone la numeración). Una final que compensa anticipos **no es una R1** —no
rectifica nada, no hay error que corregir (regla 29)—. Si necesita tipo propio, es un valor nuevo, y
`Invoice.type` no está cerrado por enum: **nada obliga hoy a declararlo**, que es un hueco en sí
mismo. Alternativa sin tipo nuevo: sigue siendo `F1` y lo que la distingue es tener `deductsRefs`.
Decisión del fundador.

---

## Resumen ejecutable

| # | hueco | quién lo desbloquea | ¿espera a P1? |
|---|---|---|---|
| 1 | `Invoice.deductsRefs Json?` | fundador (migración) | **no** |
| 2 | `EmitInvoiceInput.deductsRefs` + el `create` | GO regla 38 | **no** |
| 3 | consulta «facturas previas de este presupuesto» | código nuevo | parcial (el criterio) |
| 4 | `price < 0` en `facturaSuelta.ts:127` | decisión de ruta | **no** |
| 5 | **dónde vive la fecha de devengo** | **dictamen P1** + migración | **SÍ** |
| 6 | tipo de documento de la final | fundador | **no** |

**Cuatro de los seis se pueden cerrar antes de que llegue el dictamen.** Lo que P1 bloquea de verdad
es uno solo: dónde se guarda y qué fecha se registra. Y una vez cableado, el trinquete de SCRUM-411
baja de 8 a 7.

---

## Lo que NO se ha hecho aquí, a propósito

- No se ha cableado nada. `git diff` sobre `src/` está **vacío**.
- No se ha tocado `prisma/schema.prisma`.
- No se ha propuesto microcopy: si la final necesita rótulo, se propone, no se escribe (regla 30).

---
---

# SCRUM-16 / 142 · segunda entrega · los cuatro huecos que NO esperan al dictamen

**Medido contra:** `origin/main` = `def1d7ae7a4490dcffa87bd1c0233e814d827e4b` · 2026-08-10T12:37:47+02:00

> Sigue sin cablearse nada. `git diff` sobre `src/` y `prisma/` está **vacío**. Los dos diffs que
> tocan el camino de emisión van escritos aquí, **sin aplicar**, esperando GO (regla 38).

---

## 🔴 Lo primero, porque es más grande que este ticket

**Hoy la fecha de devengo es, implícitamente, la fecha de creación de la fila.**

`model Invoice` tiene 30 campos y **ninguno es una fecha de operación**: no hay `issuedAt`, ni
`fechaOperacion`, ni `devengo`. Lo único que hay es `createdAt DateTime @default(now())` — y también
`paidAt`, que es otra cosa. De `createdAt` beben los tres consumidores fiscales:

| consumidor | fecha que usa |
|---|---|
| `libroRegistro.ts:201` | `f.createdAt` |
| `verifactu.service.ts` | la misma, formateada a `FechaExpedicionFactura` |
| `librosAeat.ts` | la que le llega del libro |

**Eso no es una elección que alguien tomó: es una que nadie tomó.** Nadie escribió «el devengo es la
fecha de expedición»; simplemente no había otro campo, y `@default(now())` rellenó el hueco. Para una
factura ordinaria coincide y no se nota. Para un anticipo es justo lo que está en duda, y es lo que
P1 tiene que responder.

**No se arregla aquí.** Queda medido y nombrado, que es lo que se pidió.

---

## #4 · El validador rechaza el mecanismo — medido POR EJECUCIÓN

No leído: ejecutado. Se fabrican las líneas que produce `buildFinalInvoice` y se pasan por cada
consumidor.

### Lo que produce el motor (obra 1.000 + IVA, anticipo de 400 + IVA)

```
    1000 × 1  IVA 0.21  Reforma baño
    -400 × 1  IVA 0.21  Menos anticipo facturado 2026-CF-001 (2026-03-04)
    total neto: 726
```

### Qué hace cada consumidor con esas líneas

| caso | `grossOfLines` | `calcVatBreakdown` | ¿algo negativo llega al libro/303? |
|---|---|---|---|
| anticipo 400 de 1.000 | 726 ✅ cuadra | base **600** · cuota **126** | no |
| **100 % anticipado → final de 0,00** | 0 ✅ cuadra | base 0 · cuota 0 | no |
| multi-IVA (21 % + 10 %) | 1166 ✅ cuadra | base 1000 · cuota 166 · **2 tipos** | no |

**Los negativos se cancelan DENTRO del documento.** Lo que sale hacia el libro y el 303 es siempre
≥ 0, y el multi-IVA se desglosa por tipo correctamente — que era la razón de emitir una negativa por
tipo en vez de una por factura.

Censo de aguas abajo (`libroRegistro` · `verifactu.service` · `invoiceLines.service` · `librosAeat` ·
`exportData`): **nada aplasta el signo**. El único `Math.abs` está en `verifactu.service.ts:67` y es
el **huso horario**, no un importe.

### El único obstáculo, y su alcance exacto

```
validarFacturaSuelta({ customerId: 3, lines: <las de la final> })
  → { ok: false, error: 'lineas_invalidas', message: 'Cada línea necesita un precio válido.' }

CONTROL solo positivas   → { ok: true, … }           ← acepta
CONTROL qty: 0           → 'cantidad mayor que cero' ← discrimina, no rechaza en bloque
```

Un `if`, en `facturaSuelta.ts:127`, usado por **una sola ruta**: `invoicesAdmin.routes.ts`
(`POST /admin/invoices`, C7-suelta). **Respuesta al encargo: no se rompería nada más.**

### 📋 DIFF PROPUESTO — NO APLICADO (regla 38, esperando GO)

Parámetro **obligatorio** y unión **cerrada**, no un booleano opcional: así un llamador nuevo **no
compila** hasta declarar qué está validando, que es el patrón de `CaminoEmision` y `OrigenC7`. Hay
un único llamador, así que hacerlo obligatorio es barato y es más fuerte.

```diff
--- a/src/modules/invoicing/domain/facturaSuelta.ts
+++ b/src/modules/invoicing/domain/facturaSuelta.ts
+/**
+ * QUÉ se está validando. Unión CERRADA y parámetro OBLIGATORIO: un llamador nuevo no compila
+ * hasta decirlo, en vez de heredar por defecto un permiso que nadie le dio.
+ *
+ * `final-con-deduccion` es el ÚNICO que admite precios negativos, y no es una licencia: las
+ * negativas SON el mecanismo del descuento de anticipos (una por tipo de IVA, para que la
+ * deducción neutralice exactamente la cuota que aquel documento repercutió). Medido: el neto que
+ * sale hacia el libro y el 303 sigue siendo ≥ 0 — los negativos se cancelan dentro del documento.
+ */
+export type ClaseDeFactura = 'suelta' | 'final-con-deduccion';
+
-export function validarFacturaSuelta(body: unknown): ResultadoValidacion {
+export function validarFacturaSuelta(body: unknown, clase: ClaseDeFactura): ResultadoValidacion {
   const b = (body ?? {}) as Record<string, unknown>;
+  const admiteNegativas = clase === 'final-con-deduccion';
@@
-    if (!esNumeroFinito(price) || price < 0) {
+    if (!esNumeroFinito(price) || (!admiteNegativas && price < 0)) {
       return { ok: false, error: ERROR_LINEAS_INVALIDAS, message: 'Cada línea necesita un precio válido.' };
     }

--- a/src/modules/system/app/routes/invoicesAdmin.routes.ts
+++ b/src/modules/system/app/routes/invoicesAdmin.routes.ts
-  const v = validarFacturaSuelta(req.body);
+  const v = validarFacturaSuelta(req.body, 'suelta');
```

**Decisión que queda abierta y no tomo:** si la final debe además exigir **neto ≥ 0**. Una deducción
mayor que el total daría una final negativa, que ya no es una final: es un abono. Hoy nada lo
impide, ni antes ni después de este diff.

---

## #6 · El tipo de documento — la respuesta está PARTIDA en dos ejes

### Eje AEAT: no hace falta nada nuevo, y está medido

El catálogo de VeriFactu **sí está cerrado en el código**: `registro.builder.ts:247` y `:356`
declaran `tipoFactura: 'F1' | 'F2' | 'R1'`. Y el mapeo desde el tipo interno es esto, en dos sitios:

```ts
verifactu.service.ts:286   tipoFactura: invoice.type === 'R1' ? 'R1' : 'F1'
verifactu.service.ts:703   const tipoBase: 'F1' | 'R1' = inv.type === 'R1' ? 'R1' : 'F1'
```

Una final que compensa anticipos **es una factura completa**: para AEAT es **F1**. No es una R1 —no
rectifica nada, no hay error que corregir (regla 29)— y no es una F2 —no es simplificada—. **El eje
fiscal no necesita valor nuevo.**

### 🔴 Pero ese mapeo tiene un hueco, y aparece al medirlo

`inv.type === 'R1' ? 'R1' : 'F1'` significa que **cualquier tipo interno que no sea `R1` se sella
como F1, en silencio**. Y `Invoice.type` es `String @default("F1")` **sin enum, sin unión, sin guard
que lo cierre** — barrido completo de `src/`: no hay `TIPOS_FACTURA` ni `InvoiceType` en ninguna
parte. Hoy se puede escribir cualquier cadena en ese campo y VeriFactu la sellará como F1 sin que
nada avise.

Y no es hipotético: **`invoicing.service.ts:28` ya reserva un valor futuro en un comentario** —
`// default 'F1' (se fuerza 'JUST' si la serie sale J-); FISCAL-1 usará 'ANT'`. El día que alguien
escriba `'ANT'`, se sellará como F1 por el `else` de arriba. Que para el anticipo *es* lo correcto
—un anticipo es una factura completa— pero lo sería **por accidente, no por decisión**.

### Eje interno: es decisión de producto, no de norma

Dos opciones, y no la tomo:
- **(a)** la final no tiene tipo propio: sigue siendo `F1` y lo que la distingue es **tener
  `deductsRefs`**. Cero campos nuevos, cero riesgo de sellado.
- **(b)** tipo interno propio (`'FIN'`), con el mapeo a AEAT declarado explícitamente en vez de
  caer por el `else`.

### ❓ Lo que SÍ es pregunta al asesor, y no se decide aquí

1. ¿La deducción del anticipo en la final debe ir como **líneas negativas** en el cuerpo, o basta
   con **identificar** las facturas previas (art. 6.1 RD 1619/2012) y descontar el importe? El motor
   hace lo primero; las dos formas se ven en la práctica.
2. En el caso **100 % anticipado**, ¿debe emitirse una final de **0,00 €**, o no procede factura
   final ninguna?

Ambas dependen de la norma, no del código. **Van con P1, no aquí.**

---

## #3 · Nadie sabe qué deducir — qué se deriva hoy y qué falta

### Lo que YA se puede derivar, sin campo nuevo

`Invoice` tiene los mimbres: `quoteId` (con relación a `Quote`), `status`, `type`, `rectifiesId` /
`rectifiedBy`, `paidAt`. Con eso se construye hoy, sin migración:

> las facturas de este `quoteId`, del mismo merchant, **excluyendo** las `annulled`, **excluyendo**
> las `R1`, y **excluyendo** las que ya han sido rectificadas (`rectifiedBy` no vacío).

Es una consulta que hoy no existe en el camino de emisión: barrido de los 202 ficheros de `src/`, la
**única** `invoice.findMany` por `quoteId` está en `metrics.service.ts:453` y es para métricas.

### 🔴 Lo que falta, y es más grave que la consulta

**No existe el concepto de «anticipo» en el dominio.** Barrido completo de `src/` sobre código
ejecutable: la palabra aparece en **dos** sitios, y ninguno es un concepto —

- `finalInvoice.service.ts`: dentro del **texto del concepto** de la línea negativa;
- `billingPlan.ts:184`: como **ejemplo dentro de un mensaje de validación** («Cada tramo necesita
  una etiqueta (p. ej. "Anticipo")»).

O sea: **lo único que distingue un anticipo de cualquier otro tramo facturado es `stageLabel`, texto
libre que escribe el profesional.** Deducir por ahí sería derivar una consecuencia fiscal de una
cadena que alguien teclea — el mismo error que denuncia SCRUM-403 en el otro lado.

### El trozo que sí depende del dictamen

**¿Una factura previa `pending` (emitida y no cobrada) cuenta como anticipo deducible?** Si el
devengo del anticipo es el **cobro**, un anticipo sin cobrar no debería estar generando devengo — y
entonces la respuesta cambia el criterio de la consulta. Por eso este hueco es **parcial**: la
consulta se puede escribir, el filtro por `status` no.

---

## #2 · El embudo no lo transporta — DIFF, no aplicado

`EmitInvoiceInput` admite hoy 11 campos y ninguno es `deductsRefs`; `emitInvoice` tampoco lo
escribe. El diff es simétrico al de `albaranRefs`, que ya viaja por ahí:

```diff
--- a/src/modules/invoicing/domain/invoicing.service.ts
+++ b/src/modules/invoicing/domain/invoicing.service.ts
@@ export interface EmitInvoiceInput {
   albaranRefs?: AlbaranRef[];
+  /**
+   * SCRUM-16/142 · las facturas que esta final DESCUENTA, con su base y su cuota. Es lo que hace
+   * auditable la compensación: sin esto, la final dice un importe menor y no consta contra qué.
+   *
+   * Mismo patrón EXACTO que `albaranRefs`: `Json?` en la fila, tipado aquí. NO se deriva de las
+   * líneas negativas — de un concepto en texto no se saca un identificador de factura.
+   */
+  deductsRefs?: DeductRef[];
@@ return tx.invoice.create({
       albaranRefs: (input.albaranRefs as any) ?? undefined,
+      deductsRefs: (input.deductsRefs as any) ?? undefined,
```

**Depende del hueco #1**: la columna `Invoice.deductsRefs Json?` no existe, así que este diff **no
compila** hasta que la migración entre. Orden obligatorio: **#1 → #2**.

---

## Estado de los seis huecos tras esta medición

| # | hueco | qué falta ahora | bloqueo |
|---|---|---|---|
| 1 | `Invoice.deductsRefs Json?` | la migración | fundador (lote de schema) |
| 2 | el embudo lo transporta | **diff escrito**, no aplicado | GO regla 38 · y depende de #1 |
| 3 | qué deducir | consulta escribible; **falta el concepto de anticipo** | parcial: el filtro por `status` espera a P1 |
| 4 | negativas | **diff escrito**, no aplicado · nada más se rompe | GO regla 38 |
| 5 | fecha de devengo | **nadie la eligió: es `createdAt`** | P1 |
| 6 | tipo de documento | AEAT no necesita nada; el interno es decisión de producto | 2 preguntas al asesor |

**Ninguno de los cuatro se ha escrito en `src/`.** Dos son diffs esperando GO, uno espera la
migración, y el otro (#6) tiene la parte de código medida y la parte de norma convertida en dos
preguntas concretas para el asesor.

## Hallazgo, no arreglado (regla 37)

**`Invoice.type` no está cerrado por nada** y VeriFactu sella como `F1` todo lo que no sea `R1`, en
silencio. No es de este carril y no bloquea este ticket: se reporta, no se arregla. La forma de
cerrarlo sería la misma que `CaminoEmision`/`OrigenC7` — unión cerrada y mapeo explícito a AEAT, de
modo que un tipo interno nuevo **no compile** hasta declarar con qué `TipoFactura` se sella.

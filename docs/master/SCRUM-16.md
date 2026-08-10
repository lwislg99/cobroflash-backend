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

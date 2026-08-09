# SCRUM-347 · El origen de la factura: `C7` era un cajón con cuatro caminos dentro

**Fecha:** 9-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `111e7d2f6e10ab807d6f54e4e1a8a7201dd2a69e` · 2026-08-09T18:05:00+02:00

## El enunciado del ticket estaba mal, y la medición lo corrige

Decía: **«la auditoría no distingue el ORIGEN de una factura: la suelta, la recapitulativa y el
parcial de albarán se registran igual».**

**La auditoría SÍ registraba el origen, desde SCRUM-207.** `allocateInvoiceNumber` recibe `camino`
como parámetro **obligatorio** y lo escribe en `meta.camino` del `factura_emitida`, dentro de la
misma `tx`. Y el tipo hace de guard: *«un camino nuevo NO COMPILA hasta que declara cuál es»*.
**Seis de los siete orígenes se distinguían bien.**

El defecto estaba en el séptimo:

> **`C7` no era un fallo de la auditoría: era un cajón con cuatro caminos dentro.**

Etiquetaba a `emitInvoice()` ENTERO. En una inspección, «esta factura nació de un albarán firmado»
y «ésta nació suelta» eran las dos `C7`.

## El censo derivado — 4 llamadores, medidos por AST

| llamador | ruta / función | origen nuevo |
|---|---|---|
| `albaranes.routes.ts:917` | `POST /albaranes/:id/facturar-parcial` | `C7-parcial` |
| `albaranes.routes.ts:1094` | `POST /albaranes/:id/convertir-en-factura` (A0.4) | `C7-albaran` |
| `recapitulativa.service.ts:94` | `emitirRecapitulativas()` | `C7-recapitulativa` |
| `invoicesAdmin.routes.ts:119` | `POST /admin/invoices` (A0.5) | `C7-suelta` |

**Suelo del censo: 199 ficheros `.ts` barridos.** Derivado, no a mano — han aparecido dos caminos
esta semana y aparecerán más.

## La condición que había que medir ANTES de ampliar la unión

Ampliar una unión cerrada tiene dos comportamientos opuestos:

- un **switch exhaustivo** se rompe **en compilación** → es lo que queremos;
- un **objeto indexado** `ALGO[camino]` se queda en `undefined` **en silencio** → ése es el fallo.

Censo por AST sobre **714 ficheros**: **0 indexados, 0 switches, 1 anotación de tipo.** El patrón
que muerde no existe para este tipo, así que ampliar era seguro. Los 2 `===` que aparecían eran
falsos positivos de `scrum344`, donde `x.origen` es otra cosa.

## ⚠️ El sello de SCRUM-291, tocado con GO

`tests/scrum291-series-huecos.test.mjs` sella `invoiceNumber.service.ts` con un SHA-256, y su
mensaje dice: *«si algún día hace falta tocar ese fichero, se pide GO con el diff delante — y este
rojo es el recordatorio»*.

**Hizo exactamente su trabajo.** Se pidió el GO con el diff delante, y aquí queda el rastro, que es
el precio de tocarlo:

- **hash anterior:** `fb0d6216f96bb1e3a8cae6989be06baaab8190c598a647938dd106be06d696bd`
- **hash nuevo:** `f5d1f65d905da4840ea6c6c9b508078f4028d6cfd3d60263ee3ce10ca76953a8`
- **fecha:** 9-ago-2026
- **GO del fundador 9-ago-2026, SCRUM-347, opción A**

> Un sello que se actualiza **después de que un humano mire el diff** no está silenciado: está usado.

### El diff completo del fichero sellado

Es **una sola hunk**, y se pega entera para que no haya que fiarse de un resumen:

```diff
--- a/src/modules/invoicing/domain/invoiceNumber.service.ts
+++ b/src/modules/invoicing/domain/invoiceNumber.service.ts
@@ -27,7 +27,44 @@ export type CaminoEmision =
   | 'C4' // emisión manual (SCRUM-178)
   | 'C5' // rectificativa R1 (SCRUM-153)
   | 'C6' // un cobro pagado se convierte en factura (webhooks e interno)
-  | 'C7'; // `emitInvoice()` compartido — recapitulativa y albarán parcial
+  | OrigenC7; // SCRUM-347: los cuatro de `emitInvoice()` — ver abajo
+
+/**
+ * SCRUM-347 · LOS CUATRO CAMINOS QUE `C7` METÍA EN LA MISMA ETIQUETA.
+ *
+ * `C7` no era un fallo de la auditoría: **era un cajón**. La auditoría registra el origen desde
+ * SCRUM-207 —`meta.camino`, obligatorio por tipo— y distingue bien seis. El séptimo etiquetaba a
+ * `emitInvoice()` ENTERO, y por ahí pasan cuatro caminos con historias distintas.
+ *
+ * En una inspección, «esta factura nació de un albarán firmado» y «ésta nació suelta» son dos
+ * cosas distintas — y hasta hoy las dos eran `C7`.
+ *
+ * Censo DERIVADO por AST (SCRUM-347), 199 ficheros `.ts` barridos, 4 llamadores:
+ *   · `POST /albaranes/:id/facturar-parcial`      → `C7-parcial`
+ *   · `POST /albaranes/:id/convertir-en-factura`  → `C7-albaran`      (A0.4)
+ *   · `emitirRecapitulativas()`                   → `C7-recapitulativa`
+ *   · `POST /admin/invoices`                      → `C7-suelta`       (A0.5)
+ *
+ * ⚠️ `'C7'` A SECAS YA NO EXISTE EN EL TIPO, y es deliberado: dejarlo habría permitido que un
+ * llamador nuevo volviera a elegir la etiqueta vaga. Lo que sí sigue existiendo es el DATO: las
+ * facturas ya registradas conservan su `meta.camino: 'C7'` histórico. **No se reescribe, no se
+ * backfillea y no se supone de cuál de los cuatro venía** (regla 29). No saber su origen es un
+ * dato, no un hueco: el censo las cuenta como «N con origen C7 sin desglosar».
+ *
+ * Se comprobó antes de ampliar (condición del GO) que nadie INDEXA por este tipo: un
+ * `ALGO[camino]` se habría quedado en `undefined` **en silencio** al añadir variantes. Medido por
+ * AST sobre 714 ficheros — 0 indexados, 0 switches, 1 anotación de tipo.
+ */
+export type OrigenC7 =
+  | 'C7-parcial'         // parcial de un albarán
+  | 'C7-albaran'         // albarán → factura (A0.4)
+  | 'C7-recapitulativa'  // recapitulativa mensual
+  | 'C7-suelta';         // factura suelta desde admin (A0.5)
+
+/** Los cuatro, para que un guard los DERIVE en vez de reescribir la lista. */
+export const ORIGENES_C7: readonly OrigenC7[] = [
+  'C7-parcial', 'C7-albaran', 'C7-recapitulativa', 'C7-suelta',
+] as const;
 
 /**
  * Justificantes de cobro (V0-0): los merchants ES reales con `INVOICING_ES_ENABLED`
```

### Y lo que NO cambió, demostrado por el diff y no afirmado

En ese diff **no aparece ni una línea de `allocateInvoiceNumber`**: ni el `pg_advisory_xact_lock`,
ni `SERIE_LOCK_NS`, ni la reserva, ni el `recordAuditOrThrow`, ni el orden de las sentencias. Todo
el cambio está **por encima**, en las declaraciones de tipo.

Lo único que varía **en ejecución** es el valor que llega en `opts.camino` — que es exactamente lo
que el GO autoriza.

### Y el trinquete sigue siendo un trinquete

Actualizar el hash no puede dejarlo permanentemente verde, o lo habría desactivado sin querer:

```
① antes de tocar nada         → exit 0
② añado UNA línea al fichero  → exit 1   («… ha cambiado»)
③ revierto                    → exit 0
```

## Regla 29: lo ya registrado no se toca

`'C7'` a secas **sale del tipo** —para que un llamador nuevo no pueda volver a elegir la etiqueta
vaga— pero **sigue siendo un dato válido**: las facturas ya emitidas conservan su
`meta.camino: 'C7'` histórico. No se reescribe, no se backfillea y **no se supone de cuál de los
cuatro venía**.

El censo puede contarlas: «N facturas con origen `C7` sin desglosar». **No saber su origen es un
dato, no un hueco.**

## Los cinco rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Quitar el `origen` de UN llamador | 🔴 **no compila** — `error TS2345`. El tipo es el guard |
| 2 | Colapsar dos caminos en la misma etiqueta | 🔴 nombrando los dos ficheros |
| 3 | Auditar un camino distinto del que emitió | 🔴 «emitiendo por X se auditó Y» |
| 4 | Devolver `'C7'` a la unión | 🔴 listando los miembros derivados |
| 5 | Que uno de los SEIS deje de auditarse igual | 🔴 control positivo |

### Dos guards míos que no saltaban a la primera

- Uno **se cazaba a sí mismo**: buscaba «backfill» sobre el fichero entero y saltaba con **mi propio
  comentario**, el que explica que eso no se hace. Corregido leyendo solo el código ejecutable.
- Otro estaba **atado a la puntuación**: exigía el texto `| 'C7';` y la inyección dejaba un salto de
  línea detrás, así que no casaba y el rojo no salía. **Cuarta vez que este patrón muerde.** Ahora
  **deriva la unión del AST** y pregunta por sus miembros, que es el hecho.

## Verificación

- Fixtures con **merchant de id real (7)**, nunca `id: 1` — el demo desactiva comprobaciones sin
  tocar una línea del guard.
- **Suelo en los DATOS**, no solo en el guard: el test recorre `ORIGENES_C7` y **falla si no
  ejercita los cuatro**. Un rojo que no cambia nada porque ningún caso lo ejercita es un verde hueco
  con otra forma.

## Lo que NO se tocó

`prisma/schema.prisma` · la lógica de emisión y el sellado · `applyVeriFactu` · las series y la
reserva del número · microcopy (regla 30) · el alcance de SCRUM-207.

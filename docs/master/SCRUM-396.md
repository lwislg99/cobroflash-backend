# SCRUM-396 · La referencia del justificante se comprobaba contra NADA

**Medido contra:** origin/main = `74a7592e2b4287106718b42eef61fdba49cff745` · 2026-08-10T11:20:28+02:00
**Rama:** `scrum-396-referencia-justificante`
**GO del fundador:** 9-ago-2026, SCRUM-396 — tocar `invoiceNumber.service.ts` (regla 38),
actualizar `EMISOR_SHA256` con rastro completo, TRES intentos.

---

## El defecto

`makeReceiptNumber` tira 4 caracteres de `[0-9A-Z]` al aire y **nadie preguntaba si esa referencia
ya estaba usada**. La fecha va dentro de la referencia (`J-YYYYMMDD-XXXX`), así que el espacio no
es global: se reparte **por merchant y por día**.

| volumen | choque en ese merchant-día |
|---|---|
| espacio total | 36⁴ = **1.679.616** sufijos |
| 10 justificantes/día | 1 entre 37.325 |
| 200 justificantes/día | **1 entre 85** |
| 200 merchants activos | **~1,3 choques al año** |

No es teórico: es un martes. Y cuando chocaba, el número volvía tal cual, el llamador hacía su
`invoice.create` y reventaba contra `@@unique([merchantId, number])` → **`500 internal_error` en la
cara del profesional, al emitir**. La segunda emisión era perfectamente válida.

---

## 🔴 La medición corrige la FORMA del ticket: el `P2002` no es capturable aquí

El ticket pedía «reintentar ante P2002». Medido antes de escribir, eso **no se puede hacer donde
el ticket lo pone**, por dos motivos independientes:

1. **`allocateInvoiceNumber` DEVUELVE un string.** El `invoice.create` que choca vive en el
   llamador. Censo por AST (201 ficheros `.ts` barridos): **8 sitios de emisión**, ninguno dentro
   del fichero sellado. Un `try/catch` aquí no envuelve la sentencia que falla.
2. **En PostgreSQL una sentencia fallida aborta la transacción.** Aunque el `catch` estuviera en el
   sitio, el «segundo intento» no daría otro número: daría `25P02 current transaction is aborted`.
   Reintentar dentro de la misma `tx` no es reintentar, es insistir sobre una tx muerta.

**Lo que sí se puede, y cumple la condición (b) de forma más fuerte: preguntarle al índice por su
nombre.** Este código corre dentro del `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)` que se
toma como PRIMERA sentencia de `allocateInvoiceNumber` (línea 191, intacta). La clave del cerrojo
es `merchantId` — **exactamente el alcance del índice `[merchantId, number]`**. Dentro de ese
cerrojo la comprobación no tiene carrera para el mismo merchant, y entre merchants distintos el
choque es imposible por construcción.

La consulta usa `where: { merchantId_number: … }`, que es el nombre que Prisma le da a ESE índice:
**si el constraint cambiara de forma, esto no compilaría.** Ésa es la diferencia entre comprobar el
constraint y reconocer un código de error de memoria — «es un P2002» y «es NUESTRO P2002».

### Por qué TRES, y por qué un tope

Al peor volumen medido, agotar tres intentos tiene probabilidad **1,7·10⁻¹²**. Es decir: agotar
tres **ya no significa colisión, significa que pasa otra cosa** — el reloj, el generador, la
consulta. Por eso el agotamiento lanza error propio en vez de reintentar en silencio. Y por eso hay
tope: un reintento sin límite convertiría ese «otra cosa» en un bucle infinito **dentro de una
transacción con un cerrojo tomado**, que es la forma de tumbar la emisión de todo el merchant.

---

## Las cuatro condiciones del GO

| condición | cómo queda comprobada |
|---|---|
| **(a)** cada vuelta genera referencia NUEVA | `makeReceiptNumber` se llama DENTRO del bucle. El test fuerza la colisión y exige `new Set(candidatas).size === 3`. **Rojo 1** lo demuestra: sacando el generador fuera del bucle, el guard casa «LAS TRES VUELTAS PIDEN LA MISMA REFERENCIA». |
| **(b)** solo ante NUESTRO constraint | Se comprueba el índice por su compound key, no un código de error. El test lee el `where` con el que se consultó y exige `merchantId_number` con el merchant y la candidata correctos. **Rojo 2**: preguntando por `merchantId: 1` el guard casa «se pregunta por OTRO merchant». Y si la consulta FALLA, el error **sube**: no se reintenta a ciegas (**rojo 5**). |
| **(c)** error de agotamiento propio, y nadie lo tapa | `ReferenciaJustificanteAgotada` con `merchantId`, `intentos` y las tres candidatas. **Rojo 4**: con un `Error` genérico el guard casa. Censo AST de los manejadores que envuelven los 8 sitios de emisión: 6 tienen `catch`, 2 dejan subir el error; **los 6 loguean el objeto de error**, así que el nombre llega al log. El cuerpo HTTP sigue siendo un 500 genérico — eso es política de superficie pública, no un tragón. **Rojo 8**: quitando la variable del `console.error` de una ruta, el guard la nombra. |
| **(d)** el trinquete de 291 sigue siendo trinquete | **Rojo 7**: tocando UNA línea del emisor (`SERIE_LOCK_NS`) → 291 falla; revertido y recompilado → 15/15 verde. |

**SUELO EN LOS DATOS:** el test que fuerza la colisión existe. Sin un caso que la fuerce, el
reintento no se ejercita y el verde no significa nada. Se comprueba además que el generador
conserva entropía (500 muestras, ≥490 distintas) — si se volviera determinista, el reintento
pediría tres veces lo mismo.

---

## ⚠️ Sello `EMISOR_SHA256` actualizado (SCRUM-291)

```
anterior: f5d1f65d905da4840ea6c6c9b508078f4028d6cfd3d60263ee3ce10ca76953a8   (SCRUM-347)
nuevo:    def716fd0dcaaceddb8e1dabab328f5b97f64d504d1b6e39f85d8a7649a7c56d   (SCRUM-396)
fecha:    2026-08-10 · GO del fundador 9-ago-2026, SCRUM-396
```

Tercera vez que este trinquete hace su trabajo: **avisó, y el cambio pasó por un humano con el diff
delante antes de que nadie tocara el hash.** Un sello que se actualiza después de que alguien mire
el diff no está silenciado: está usado.

### Qué NO cambió, verificable en el diff de abajo y no solo afirmado

- el `pg_advisory_xact_lock` sigue siendo la **primera sentencia** y con el mismo `SERIE_LOCK_NS`;
- la reserva de la serie fiscal —`resolveSeriesSeq`, los dos contadores, el reinicio anual, el
  `merchant.update`— **no tiene ni una línea tocada**;
- el `recordAuditOrThrow` sigue dentro de la misma `tx` y en el mismo punto;
- el justificante **no consume serie fiscal**, ni antes ni ahora.

En el cuerpo de `allocateInvoiceNumber` cambia **UNA línea**: la del modo `receipt`.

### El diff completo del fichero sellado

```diff
@@ -89,6 +89,96 @@ export function makeReceiptNumber(now = new Date()): string {
   return `${RECEIPT_NUMBER_PREFIX}${ymd}-${rand}`;
 }
 
+/**
+ * SCRUM-396 · LA REFERENCIA DEL JUSTIFICANTE SE COMPROBABA CONTRA NADA.
+ *
+ * `makeReceiptNumber` tira 4 caracteres de `[0-9A-Z]` al aire: 36⁴ = 1.679.616 sufijos, y el
+ * espacio se reparte POR MERCHANT Y POR DÍA porque la fecha va dentro. A 10 justificantes/día la
+ * probabilidad de choque en ese día es 1 entre 37.325; a 200/día baja a **1 entre 85**. Con 200
+ * merchants activos son ~1,3 choques al año. No es teórico: es un martes.
+ *
+ * Y cuando chocaba, ¿qué pasaba? Nada bueno. El número volvía tal cual, el llamador hacía su
+ * `invoice.create` y reventaba contra `@@unique([merchantId, number])` — un `500 internal_error`
+ * en la cara del profesional, al emitir. La segunda emisión era perfectamente válida.
+ *
+ * ── POR QUÉ SE COMPRUEBA EL CONSTRAINT Y NO SE CAPTURA EL `P2002` ─────────────────────────
+ *
+ * Medido, y corrige la forma natural de escribir esto: **el `P2002` no es capturable aquí.**
+ *
+ *   · `allocateInvoiceNumber` DEVUELVE un string. El `invoice.create` que choca vive en el
+ *     llamador —`emitInvoice` y otros 7 sitios—, así que un `try/catch` en este fichero no
+ *     envuelve la sentencia que falla;
+ *   · y aunque lo envolviera: en PostgreSQL una sentencia fallida **aborta la transacción**. El
+ *     segundo intento no daría otro número, daría `25P02 current transaction is aborted`.
+ *     Reintentar dentro de la misma `tx` no es reintentar: es insistir sobre una tx muerta.
+ *
+ * Lo que sí se puede —y es más fuerte— es PREGUNTARLE AL PROPIO CONSTRAINT. Este código corre
+ * dentro del `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)` que se toma como PRIMERA sentencia
+ * de `allocateInvoiceNumber`, y la clave del cerrojo es `merchantId` — **exactamente el alcance del
+ * índice `[merchantId, number]`**. Dentro de ese cerrojo, «¿está ocupada esta referencia?» no tiene
+ * carrera para el mismo merchant, y entre merchants distintos el choque es imposible por
+ * construcción. La consulta usa `merchantId_number`, que es el nombre que Prisma le da a ESE índice:
+ * si el constraint cambiara de forma, esto **no compilaría** — que es la diferencia entre comprobar
+ * el constraint y reconocer un código de error de memoria.
+ *
+ * ── POR QUÉ TRES, Y POR QUÉ UN TOPE ──────────────────────────────────────────────────────
+ *
+ * Al peor volumen medido, agotar tres intentos tiene probabilidad 1,7·10⁻¹². Es decir: **agotar
+ * tres ya no significa colisión, significa que pasa otra cosa** —el reloj, el generador, la
+ * consulta— y por eso el agotamiento tiene error PROPIO en vez de reintentar en silencio. Un
+ * reintento sin tope haría lo contrario: convertiría ese «otra cosa» en un bucle infinito dentro de
+ * una transacción con un cerrojo tomado, que es la forma de tumbar la emisión de todo el merchant.
+ */
+export const INTENTOS_REFERENCIA_JUSTIFICANTE = 3;
+
+/**
+ * Agotar los intentos NO es una colisión: a 1,7·10⁻¹² es otra cosa. Error propio y con nombre para
+ * que quien lo lea en el log no lo confunda con el choque que este mecanismo sí resuelve.
+ */
+export class ReferenciaJustificanteAgotada extends Error {
+  readonly merchantId: number;
+  readonly intentos: number;
+  readonly candidatas: readonly string[];
+
+  constructor(merchantId: number, candidatas: readonly string[]) {
+    super(
+      `referencia_justificante_agotada: ${candidatas.length} intentos ocupados para el merchant ` +
+      `${merchantId} (${candidatas.join(', ')}). A esta probabilidad esto NO es una colisión: ` +
+      'revisa el generador, el reloj del proceso o la consulta.',
+    );
+    this.name = 'ReferenciaJustificanteAgotada';
+    this.merchantId = merchantId;
+    this.intentos = candidatas.length;
+    this.candidatas = candidatas;
+  }
+}
+
+/**
+ * Devuelve una referencia `J-YYYYMMDD-XXXX` LIBRE para este merchant, o lanza.
+ *
+ * ⚠️ Cada vuelta llama a `makeReceiptNumber` OTRA VEZ. Si reutilizara la candidata, los tres
+ * intentos serían uno y el tope sería decorativo.
+ */
+async function reservarReferenciaJustificante(
+  tx: Prisma.TransactionClient,
+  merchantId: number,
+  now: Date,
+): Promise<string> {
+  const candidatas: string[] = [];
+  for (let intento = 0; intento < INTENTOS_REFERENCIA_JUSTIFICANTE; intento += 1) {
+    const candidata = makeReceiptNumber(now);
+    candidatas.push(candidata);
+    // El índice, por su nombre. Un error de la consulta SUBE: no se reintenta a ciegas, porque
+    // «no pude comprobar si está ocupada» y «está libre» no pueden dar el mismo resultado.
+    const ocupada = await tx.invoice.findUnique({
+      where: { merchantId_number: { merchantId, number: candidata } },
+      select: { id: true },
+    });
+    if (!ocupada) return candidata;
+  }
+  throw new ReferenciaJustificanteAgotada(merchantId, candidatas);
+}
+
 /** Formatea un número de la serie. `rectifying` usa la serie propia de rectificativas (R). */
 export function formatInvoiceNumber(
   prefix: string | null | undefined,
@@ -250,7 +340,9 @@ export async function allocateInvoiceNumber(
   // para justificantes (solo rectifican facturas emitidas — regla 29).
   if (getEmissionMode(m) === 'receipt') {
     if (rect) throw new Error('invoicing_es_disabled');
-    const numero = makeReceiptNumber(now);
+    // SCRUM-396: la referencia se comprueba contra el índice antes de devolverla. Va DENTRO del
+    // cerrojo de arriba, que es lo que hace que la comprobación no tenga carrera.
+    const numero = await reservarReferenciaJustificante(tx, merchantId, now);
     await auditar(numero, true);
     return numero;
   }
```

---

## Cuatro dobles de `tx` preexistentes se quedaron cortos

El cambio añade una capacidad nueva al `tx` que `allocateInvoiceNumber` necesita en el camino del
justificante: `invoice.findUnique`. Cuatro dobles no la tenían y salieron en rojo — **señal buena,
no ruido: los dobles modelan el cliente de transacción y el real sí la tiene.**

- `tests/emission.test.mjs`
- `tests/scrum81-allocate-flags.test.mjs`
- `tests/scrum207-emision-auditada.test.mjs`
- `tests/scrum346-justificante-suelto.test.mjs` (va DENTRO del objeto `invoice`; el `Proxy` de
  reserva no lo cubre, porque `invoice` sí está en el destino y el `get` no llega a mirarlo)

En los cuatro devuelve `null` = referencia libre, que es su comportamiento de siempre.

---

## Dos trampas del arnés de rojos, anotadas porque volverán

1. **`execFileSync('npm', …)` no existe en Windows** (es `npm.cmd`). Fallaba siempre, y las ocho
   inyecciones salían «NO COMPILA» sin que el compilador llegara a correr ni una vez. Ahora el
   arnés compila el **árbol limpio primero**: si eso no pasa, se para y lo dice — «no compila» y
   «mi script está roto» no pueden dar el mismo resultado.
2. **El fuente está en CRLF** y los anclas se escriben con `\n`: `replace` no casaba y la inyección
   se daba por aplicada sobre un fichero intacto. El arnés detecta el EOL del fichero y adapta el
   ancla, y **verifica que el texto cambió** antes de creerse el rojo.

---

## Verificación

- Suite completa: **2396 tests, 0 fallos**, 73 skipped (los gateados por Postgres).
- Los **8 rojos** salen por su motivo, cada uno con recompilación entre inyecciones —en TypeScript
  revertir el fuente no revierte lo que el test ejecuta.
- Árbol limpio tras revertir; `git diff --diff-filter=D --name-only origin/main...HEAD` vacío.
- La corrección se comiteó **antes** de inyectar el primer rojo.

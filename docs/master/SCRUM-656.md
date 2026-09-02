# SCRUM-656 (T7, sprint Tecnosel) · El IVA al final del presupuesto y las cláusulas de cierre

**Fecha:** 2-sep-2026 · **Carril:** presupuestos · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `443a9e224c14204c0a01ee75751c067762ef04a0` · 2026-09-02T13:20:00+02:00

## 1 · 🔴 Lo que este ticket NO ha añadido: aritmética

El peligro estaba escrito en el encargo y viene de la tanda anterior: `calcTierTotal` era una
**segunda copia** de `calcTotal`. Tocar totales invita a escribir «una funcioncita para el IVA del
pie», y ésa sería la tercera.

**No la hay.** `pieDePresupuesto` llama a `calcVatBreakdown` —la primitiva de siempre— y **solo
decide qué filas se pintan**. El modo no mueve un céntimo: cambia lo que el documento dice.

### El censo, antes y después — y subió, con su motivo

```
ficheros que hacen aritmética de IVA SIN llamar a la primitiva:   8  →  9
```

🔴 **Subió, y NO porque se haya añadido una copia.** Entra `pdf.service.ts`, y por lo contrario:
porque se ha **destapado** lo que ya tenía. Ese fichero pinta **dos documentos**, y el bloque de
totales de la **factura** agrupa el IVA a mano —a propósito y documentado, con el comentario «DE
DÓNDE SALEN LAS CIFRAS, Y POR QUÉ NO DE `calcVatBreakdown`»—. Lo que lo mantenía fuera de la lista
era que el bloque del **presupuesto**, en el mismo fichero, sí llamaba a la primitiva:

> **El criterio del censo es POR FICHERO, así que la llamada de un documento tapaba la aritmética
> a mano del otro.**

Al mudar el pie del presupuesto a `quotes/domain/presentacionIva.ts` la máscara desaparece y el
fichero aparece por lo que lleva haciendo desde siempre. **No se arregla aquí**: es el camino de
emisión de la factura (regla 38) y son las mismas veinte líneas que SCRUM-623/624 dejaron paradas
esperando a la asesoría. Queda declarado en las dos tablas.

## 2 · La aritmética, con céntimos y a mano

```
4 × 45,00 = 180,00 · 2 × 32,50 = 65,00 · 1 × 35,00 = 35,00   →  base   280,00
280,00 × 0,21                                                →  cuota   58,80
                                                                total  338,80
```

Ninguno de los tres sale de llamar a lo que se prueba. Con dos tipos salen las dos cuotas
(1.050,00 → 168,00 al 21 % y 25,00 al 10 %), y el rótulo del impuesto es un **dato**: en Canarias
pone `IGIC` porque se lo pasan, no porque lo deduzca del país (SCRUM-647).

## 3 · Los dos modos, y el control negativo que decide

| modo | qué pinta |
| --- | --- |
| `sumar` | Base imponible · una fila por tipo con cuota · Total |
| `no_incluido` | **ninguna cuota** y la leyenda «IVA NO INCLUIDO» bajo el total |

En `no_incluido` **no se calcula ni se oculta**: ese documento *no afirma* cuánto será el impuesto.
Pintar la cuota «por si acaso» convertiría una oferta sin IVA en una oferta con IVA a los ojos del
cliente — y es la cifra por la que después se discute.

**Por defecto: `sumar`**, y no es una preferencia: es lo que el PDF hace hoy desde SCRUM-623. Poner
`no_incluido` por defecto le quitaría el IVA, en silencio, a todos los presupuestos de quien no ha
elegido nada.

### 🔴 Y la casilla NO llega a la factura

Probado por AST sobre el cuerpo de `generateInvoicePdf`: ni `modoIva`, ni `pieDePresupuesto`, ni
`leerModoIva`, ni la leyenda. Con su suelo —si el extractor no encontrara la función, el `!includes`
pasaría sobre una cadena vacía— y con el positivo simétrico: el presupuesto **sí** los usa.

Más la frontera por construcción: ningún fichero de `invoicing/domain` importa `presentacionIva`.
Una factura lleva base, cuota y total **siempre**; si el modo se propagara, sería un defecto fiscal.

## 4 · Las cláusulas

Del **merchant**, escritas una vez, y en todos. Excluir una de un presupuesto **no la borra**: la
configuración no se toca y el siguiente vuelve a llevarla — hay test que lo comprueba sobre la lista
original.

**Ausente y vacío no son lo mismo.** Con la configuración vacía no se abre sección, ni título, ni
hueco. Y una cláusula con título y el texto en blanco **no se pinta**: «GARANTÍA» y debajo nada se
lee, en un documento que el cliente firma, como que la garantía existe y no dice cuál.

⛔ El texto lo escribe el merchant. Aquí se hace la caja.

## 5 · 🛑 La persistencia: diff preparado, cable parado

El PDF se genera **del presupuesto guardado** (medido: lee `quote.docFields`), así que el modo
necesita su columna. `prisma/schema.prisma` es del fundador.

```prisma
model Quote {
  …
  // SCRUM-656 (T7) · cómo presenta el IVA ESTE presupuesto: 'sumar' | 'no_incluido'.
  // NULL = anterior a la casilla → sale como salía. Sin @default: «no consta» y «suma» no son
  // lo mismo, aunque hoy se pinten igual.
  ivaModo            String? @map("iva_modo")
  // Los id de las cláusulas del merchant que ESTE presupuesto no lleva. Excluir no es borrar.
  clausulasExcluidas Json?   @map("clausulas_excluidas")
}

model Merchant {
  …
  // Las cláusulas de cierre, escritas UNA vez: [{id, titulo, texto}].
  clausulasPresupuesto Json? @map("clausulas_presupuesto")
}
```

```sql
ALTER TABLE "quotes"    ADD COLUMN "iva_modo" TEXT;
ALTER TABLE "quotes"    ADD COLUMN "clausulas_excluidas" JSONB;
ALTER TABLE "merchants" ADD COLUMN "clausulas_presupuesto" JSONB;

-- Verificación, detrás y en la misma sesión. Suelo: cero filas significa que no se aplicó.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_name = 'quotes' AND column_name IN ('iva_modo','clausulas_excluidas'))
   OR (table_name = 'merchants' AND column_name = 'clausulas_presupuesto');
```

100 % aditivo, todo nullable, 0 filas afectadas. **El cable ya está puesto**: la ruta lee
`(quote as any).ivaModo ?? null` — el mismo patrón defensivo que `docFields`— así que empieza a
funcionar el día que se aplique el ALTER, sin tocar código.

## 6 · Los guards ajenos que saltaron

Ocho, y ninguno se apagó. Los dos que valen:

- **SCRUM-647** acusaba a una llamada que **sí** pasa el nombre del impuesto. La causa: su detector
  usaba `src.slice(i, i + 1400)` — una **ventana de tamaño fijo** que mis tres parámetros nuevos
  desbordaron. Ahora recorta **la llamada**, equilibrando paréntesis. Es la misma familia que la
  ventana de 3.000 caracteres de SCRUM-413: *una ventana fija mide la longitud del código, no lo
  que quiere vigilar*.
- **SCRUM-604b** exigía «≥2 `push` sobre `filasDeTotales`», y su intención es que el desglose sea
  **datos y no dibujo** para que quepa una cuarta fila. Las filas se construyen ahora en el dominio:
  el guard sigue exigiendo lo mismo, en el sitio donde ocurre.

Y el canario del suelo de SCRUM-647 era el literal `'Base imponible'`, que **se mudó** con las
filas: se cambia por código que sigue viviendo en la maqueta.

## 7 · Lo que NO se ha tocado

La factura y el camino de emisión · los apartados de T6 · trabajos, partes y empleados ·
`prisma/schema.prisma` · las veinte líneas de aritmética de la factura, declaradas y paradas.

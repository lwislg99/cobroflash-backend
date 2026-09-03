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

---

# SCRUM-656 fase B · la pantalla de las cláusulas — y la ESCRITURA que nadie había echado en falta

**Medido contra:** `origin/main` = `2aeb71c041c855e35974f3a1c45937343e7f7e3e` · 2026-09-02T20:40:32+02:00

---

## 0 · PASO 0, y el barrido de LA COSA

```
git ls-tree -r --name-only origin/main | grep -iE 'clausula|scrum-?656'
  → docs/master/SCRUM-656.md · src/modules/quotes/domain/clausulas.ts
  → tests/scrum656-iva-y-clausulas.test.mjs                              [exit 0]
git ls-remote --heads origin | grep -iE 'clausula|scrum-?656'            → vacío [exit 1]

LA COSA (una pantalla de ajustes con garantía / alcance / validez):
  «clausula» en public/ ............ 0 coincidencias
  «garantía|validez|alcance» ....... 0
  CONTROL POSITIVO «suplido» ....... 70   ← el barrido ve lo que sí existe
```

**La pantalla no existía.** No es la undécima.

---

## 1 · 🔴 La fila 8 estaba mejor y peor de lo que decía

Verificado abriendo, no copiando:

| pieza | estado real |
|---|---|
| motor | ✅ `pdf.service.ts:972` — `clausulasParaDocumento`, y solo abre sección si hay alguna |
| columnas | ✅ `schema.prisma:163` y `:445` |
| **lectura** | ✅ y **no estaba en la fila**: `quotes.routes.ts:214-215` ya las pasaba al PDF |
| **escritura** | 🔴 **NO EXISTÍA NINGUNA DE LAS DOS.** Cero rutas escribían `clausulasPresupuesto`; el `create` del presupuesto no guardaba `clausulasExcluidas` |
| pantalla | 🔴 no existía |

**Sin la escritura, la pantalla no habría tenido dónde guardar.** Eso es lo que faltaba de verdad.

### Y un defecto de la fase A, que era MÍO

`quotesView.js:3294` manda `ivaModo`, `schemas.ts` lo acepta y `quotes.routes.ts:213` lo lee para el
PDF — pero **el `create` no lo guardaba**. El PDF recibía `null` SIEMPRE: el profesional elegía
«IVA no incluido» y el documento salía con el IVA sumado. **Un papel equivocado a un cliente, sin
que fallara nada.** Se arregla aquí, en la misma línea que su gemelo.

---

## 2 · Lo entregado

* **Dominio** (`clausulas.ts`): `normalizarClausulasParaGuardar` —**ids estables**, tope, y lo que no
  es pintable **no se guarda**— y `leerClausulasDelMerchant`, el suelo.
* **Backend**: el perfil acepta y **sanea** `clausulasPresupuesto`; el `create` del presupuesto
  guarda `clausulasExcluidas` **e** `ivaModo`.
* **Pantalla**: sección en Configuración → Facturación, con su entrada en el censo de submenús y el
  aviso de columna ilegible.
* **El PDF lee por el lector con suelo**: **mismo documento** —una columna rota sigue dando cero
  cláusulas, que es lo único seguro— pero ahora queda **registrado**. Sin eso, un JSON roto deja de
  imprimir la garantía de todos los presupuestos de ese merchant y no hay una línea en ningún sitio
  que lo diga.

> 🔴 **Los `id` no se recalculan al reeditar**, y es lo que impide el fallo silencioso: la exclusión
> de un presupuesto es una lista de `id`, así que reasignarlos haría que un presupuesto que quitó la
> garantía pasara a quitar otra cláusula. No falla nada: **solo sale mal el papel**.

---

## 3 · Verificación — los tres rojos

**Commit de todo ANTES de inyectar: `6064c1cc719c4cf12d3841b83e4345e160380563`** (verde, 4.596 · 4.517).

| rojo | resultado |
|---|---|
| **el `create` vuelve al estado de ayer** (sin las dos escrituras) | 🔴 exit 1 — *«EL CREATE NO GUARDA `clausulasExcluidas`»* |
| **excluir pasa a BORRAR** de la configuración del merchant | 🔴 exit 1 — *«EXCLUIR HA BORRADO… ha dejado sin garantía a TODOS los demás»* |
| **el suelo se cae**: ilegible se lee como «no tiene ninguna» | 🔴 exit 1, nombrando el valor roto |

El primero **es literalmente el mecanismo viejo**, no una avería inventada: prueba que el ticket
hacía falta. El segundo es el rojo que pediste, y el tercero el suelo.

**Control positivo:** un merchant sin cláusulas (`null`, `undefined`, `[]`) → cero, y el PDF **no
abre sección** — comprobado también sobre el propio código del pie.
**Control negativo:** el módulo de cláusulas **no hace una sola operación de dinero**, verificado
sobre el código **sin comentarios** (su cabecera habla de garantías y de discusiones de dinero en
prosa, y un guard de texto se caza a sí mismo).

> El guard del `create` está **atado al BLOQUE** `data: { … }`, con llaves balanceadas — no al
> fichero. Buscando en todo `quotes.routes.ts` habría dado verde con las LECTURAS que ya existían y
> con el comentario que explica esto mismo.

---

## 4 · Microcopy PROPUESTA, sin aprobar (regla 30) — los rótulos EXACTOS

Son rótulos de **nuestra** pantalla. El texto que ve el cliente en el PDF lo escribe el merchant y
no se toca desde aquí: no hay plantilla, ni ejemplo, ni sugerencia.

| ranura | rótulo propuesto |
|---|---|
| título de la sección | `Condiciones del presupuesto` |
| pista | `Se escriben una vez y salen en todos tus presupuestos.` |
| campo título | `Título (GARANTÍA, ALCANCE…)` |
| campo texto | `Texto de la condición` |
| botón quitar | `Quitar` |
| botón añadir | `Añadir condición` |
| lista vacía | `Todavía no has escrito ninguna condición.` |
| columna ilegible | `No hemos podido leer tus condiciones. No se ha guardado nada.` |

> ⚠️ **La marca va factorizada** en una constante y concatenada, igual que `MARCA_RETENCION`. El
> censo de SCRUM-402 cuenta **literales que contienen la marca**, no superficies marcadas: por eso
> su número **no se mueve** con estos ocho rótulos. Queda dicho aquí para que nadie lea ese censo
> como «no hay nada nuevo pendiente de aprobar».

---

## 5 · Censos que movió el ticket

* **SCRUM-284**: la sección **declara su clave** (`cajaClausulas.name`), como el selector de país.
  ⚠️ Es un campo **compuesto** —una lista de filas, no un input—, y ésa es una **quinta forma** que
  `_censo-configuracion.mjs` no modela; su propia cabecera avisa de que podría aparecer. Se declara
  así para que el censo diga la verdad. **Ampliarlo es de su carril.**
* **SCRUM-411**: `MAX_CLAUSULAS` **deja de exportarse** (su consumidor está dentro; el tope se
  prueba por la superficie) y `leerClausulasDelMerchant` **se cablea** en vez de declararse.

## 6 · El merge de main

Conflicto en `quotes.routes.ts`: main traía `docHeaderText`/`docFooterText` (SCRUM-593) y este lado
la lectura con suelo. **Se quedan las dos**: se tomó el lado de main —con sus dos campos y su
sangrado— y se le devolvió la única aportación de éste.

⚠️ El fallo de `docHeaderText` que tenía la PR anterior **era el cliente de Prisma viejo**, no
código: se regenera con el binario **del proyecto** (`./node_modules/.bin/prisma generate`), nunca
`npx` (SCRUM-385). No va en ningún commit.
